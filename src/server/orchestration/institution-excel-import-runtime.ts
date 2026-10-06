import { createHash, randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';

import {
  createAppointmentCommandService,
} from '@/modules/care/application/appointment-command-service';
import { createTreatmentSummaryCommandService } from '@/modules/care/application/treatment-summary-command-service';
import { createAppointmentCommandRepository } from '@/modules/care/server/appointment-command-repository';
import { createTreatmentSummaryCommandRepository } from '@/modules/care/server/treatment-summary-command-repository';
import {
  createVerifiedInstitutionAttributedTenantAuditEventV1,
  type VerifiedInstitutionAuditAttributionHandleV1,
} from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createCustomerCommandService } from '@/modules/customers/application/customer-command-service';
import { createCustomerCommandRepository } from '@/modules/customers/server/customer-command-repository';
import { createCustomerSensitiveProfileRepositoryV1 } from '@/modules/customers/server/customer-sensitive-profile-repository';
import { createAnalyticsConsumptionFactWriterV1 } from '@/modules/institution-analytics/server/analytics-consumption-fact-writer';
import { createInstitutionExcelImportRepositoryV1 } from '@/modules/institution-import/server/institution-excel-import-repository';
import {
  INSTITUTION_EXCEL_IMPORT_MAX_ROWS,
  parseInstitutionExcelImportWorkbookV1,
  type InstitutionExcelImportWorkbookV1,
} from '@/modules/institution-import/server/institution-excel-workbook-parser';
import { checkTenantQuotaForUsage } from '@/modules/institution/server/tenant-quota-enforcement';
import { decryptSecret, encryptSecret } from '@/modules/security/server/secretEncryption';
import { getDatabase, type TenantDatabase } from '@/server/db/client';
import { resolveInstitutionAuditWriterVerifiedAttributionV1 } from '@/server/orchestration/institution-audit-writer-scope';
import {
  authorizeInstitutionCustomerControlledWriteV1,
  type InstitutionCustomerControlledAuthorizationV1,
} from '@/server/orchestration/institution-customer-controlled-write-runtime';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export type InstitutionExcelImportSummaryV1 = Readonly<{
  customers: number;
  appointments: number;
  treatments: number;
  consumptions: number;
  totalRows: number;
}>;

export type InstitutionExcelImportExecutionStageV1 =
  | 'transaction'
  | 'quota'
  | 'batch'
  | 'customers'
  | 'appointments'
  | 'treatments'
  | 'analytics'
  | 'row_evidence'
  | 'audit_attribution'
  | 'audit_event'
  | 'audit_insert';

export type InstitutionExcelImportResultV1 =
  | Readonly<{
      kind: 'ready';
      mode: 'preview' | 'completed';
      summary: InstitutionExcelImportSummaryV1;
      batchId?: string;
    }>
  | Readonly<{
      kind: 'invalid';
      code: string;
      issues: readonly Readonly<{
        sheet: string;
        row: number | null;
        field: string | null;
        code: string;
      }>[];
    }>
  | Readonly<{
      kind: 'forbidden' | 'unavailable' | 'conflict' | 'quota_denied';
      code: string;
      stage?: InstitutionExcelImportExecutionStageV1;
    }>;

export type InstitutionExcelImportHistoryResultV1 =
  | Readonly<{
      kind: 'ready';
      records: readonly Readonly<{
        batchId: string;
        completedAt: string;
        summary: InstitutionExcelImportSummaryV1;
      }>[];
    }>
  | Readonly<{
      kind: 'forbidden' | 'unavailable';
      code: string;
    }>;

export const INSTITUTION_EXCEL_IMPORT_DETAIL_PAGE_SIZES = [10, 20, 50, 100] as const;

export type CustomerSourceEvidenceResultV1 =
  | Readonly<{
      kind: 'ready';
      contractVersion: 'customer-source-evidence.v1';
      customerId: string;
      customerUpdatedAt: string;
      observedAt: string;
      evidence:
        | Readonly<{
            status: 'recorded';
            importRecord: Readonly<{
              batchId: string;
              sheetKind: 'customer';
              rowNumber: number;
              completedAt: string;
            }>;
          }>
        | Readonly<{ status: 'not_recorded' | 'ambiguous'; importRecord: null }>;
    }>
  | Readonly<{ kind: 'forbidden' | 'not_found' | 'unavailable'; code: string }>;

export type InstitutionExcelImportDetailSheetV1 =
  | 'customer'
  | 'appointment'
  | 'treatment'
  | 'consumption';

export type InstitutionExcelImportDetailRecordV1 = Readonly<{
  rowNumber: number;
  canonicalReference: string;
  displayName?: string;
  maskedPhone?: string;
  gender?: string;
  source?: string;
  acquisitionSource?: string;
  owner?: string;
  createdAt?: string;
  customerReference?: string;
  occurredAt?: string;
  project?: string;
  practitioner?: string;
  resource?: string;
  department?: string;
  status?: string;
  amountMinor?: number;
  currency?: string;
  eventType?: string;
}>;

export type InstitutionExcelImportDetailResultV1 =
  | Readonly<{
      kind: 'ready';
      batchId: string;
      completedAt: string;
      summary: InstitutionExcelImportSummaryV1;
      sheet: InstitutionExcelImportDetailSheetV1;
      records: readonly InstitutionExcelImportDetailRecordV1[];
      pageInfo: Readonly<{
        page: number;
        pageSize: number;
        total: number;
        pageCount: number;
        hasPrevious: boolean;
        hasNext: boolean;
      }>;
    }>
  | Readonly<{
      kind: 'invalid' | 'forbidden' | 'not_found' | 'unavailable';
      code: string;
    }>;

type AllowedAuthorization = Extract<InstitutionCustomerControlledAuthorizationV1, { kind: 'allowed' }>;

function localDevelopmentDatabaseAllowed() {
  if (process.env.NODE_ENV !== 'development') return false;
  try {
    const url = new URL(process.env.DATABASE_URL ?? '');
    return ['postgres:', 'postgresql:'].includes(url.protocol) && LOCAL_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function sha256(...values: readonly string[]) {
  const hash = createHash('sha256');
  values.forEach((value) => hash.update(value).update('\0'));
  return hash.digest('hex');
}

function stableId(prefix: string, tenantId: string, institutionId: string, externalReference: string) {
  return `${prefix}${sha256(tenantId, institutionId, externalReference).slice(0, 48)}`;
}

function summary(workbook: InstitutionExcelImportWorkbookV1): InstitutionExcelImportSummaryV1 {
  const result = {
    customers: workbook.customers.length,
    appointments: workbook.appointments.length,
    treatments: workbook.treatments.length,
    consumptions: workbook.consumptions.length,
    totalRows:
      workbook.customers.length + workbook.appointments.length
      + workbook.treatments.length + workbook.consumptions.length,
  };
  return Object.freeze(result);
}

function historySummary(record: Readonly<{
  customerCount: number;
  appointmentCount: number;
  treatmentCount: number;
  consumptionCount: number;
}>): InstitutionExcelImportSummaryV1 {
  const counts = [record.customerCount, record.appointmentCount, record.treatmentCount, record.consumptionCount];
  if (counts.some(count => !Number.isSafeInteger(count) || count < 0)
    || record.customerCount < 1
    || counts.reduce((total, count) => total + count, 0) > INSTITUTION_EXCEL_IMPORT_MAX_ROWS) {
    throw new Error('invalid_import_batch_evidence');
  }
  return Object.freeze({
    customers: record.customerCount,
    appointments: record.appointmentCount,
    treatments: record.treatmentCount,
    consumptions: record.consumptionCount,
    totalRows:
      record.customerCount + record.appointmentCount
      + record.treatmentCount + record.consumptionCount,
  });
}

function maskPhone(phone: string) {
  return phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '已保护';
}

function maskReference(value: string) {
  return value ? `***${value.slice(-4)}` : '';
}

function safeDetailString(value: unknown, maxLength = 160) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function readProtectedImportRow(payload: Parameters<typeof decryptSecret>[0]) {
  const parsed: unknown = JSON.parse(decryptSecret(payload));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid_import_row_evidence');
  }
  return parsed as Readonly<Record<string, unknown>>;
}

function detailRecord(
  sheet: InstitutionExcelImportDetailSheetV1,
  row: Readonly<{
    rowNumber: number;
    canonicalRecordId: string;
    protectedPayload: Parameters<typeof decryptSecret>[0];
  }>,
): InstitutionExcelImportDetailRecordV1 {
  const evidence = readProtectedImportRow(row.protectedPayload);
  if (evidence.rowNumber !== row.rowNumber || typeof row.canonicalRecordId !== 'string' || !row.canonicalRecordId) {
    throw new Error('invalid_import_row_evidence');
  }
  const canonicalReference = maskReference(row.canonicalRecordId);
  if (sheet === 'customer') {
    return Object.freeze({
      rowNumber: row.rowNumber,
      canonicalReference,
      displayName: safeDetailString(evidence.displayName, 120),
      maskedPhone: maskPhone(safeDetailString(evidence.phone, 32)),
      gender: safeDetailString(evidence.gender, 20),
      source: safeDetailString(evidence.source, 80),
      acquisitionSource: safeDetailString(evidence.acquisitionSource, 80),
      owner: safeDetailString(evidence.owner, 96),
      createdAt: safeDetailString(evidence.createdAt, 40),
    });
  }
  const base = {
    rowNumber: row.rowNumber,
    canonicalReference,
    customerReference: maskReference(safeDetailString(evidence.customerExternalReference, 96)),
    project: safeDetailString(evidence.project, 160),
    source: safeDetailString(evidence.source, 80),
    status: safeDetailString(evidence.status, 40),
  };
  if (sheet === 'appointment') {
    return Object.freeze({
      ...base,
      occurredAt: safeDetailString(evidence.scheduledAt, 40),
      practitioner: safeDetailString(evidence.consultant, 96),
      resource: safeDetailString(evidence.resource, 160),
    });
  }
  if (sheet === 'treatment') {
    return Object.freeze({
      ...base,
      occurredAt: safeDetailString(evidence.treatmentAt, 40),
      practitioner: safeDetailString(evidence.doctor, 96),
      department: safeDetailString(evidence.department, 160),
    });
  }
  if (typeof evidence.amountMinor !== 'number' || !Number.isSafeInteger(evidence.amountMinor)
    || evidence.amountMinor < 1 || typeof evidence.currency !== 'string'
    || !/^[A-Z]{3}$/u.test(evidence.currency)) {
    throw new Error('invalid_import_row_evidence');
  }
  const amountMinor = evidence.amountMinor;
  return Object.freeze({
    ...base,
    occurredAt: safeDetailString(evidence.eventAt, 40),
    amountMinor,
    currency: safeDetailString(evidence.currency, 8),
    eventType: safeDetailString(evidence.eventType, 40),
  });
}

function joinNotes(values: readonly [string, string][]) {
  return values
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}：${value}`)
    .join('；')
    .slice(0, 4_000);
}

function firstProject(workbook: InstitutionExcelImportWorkbookV1, customerExternalReference: string) {
  return workbook.appointments.find((row) => row.customerExternalReference === customerExternalReference)?.project
    ?? workbook.treatments.find((row) => row.customerExternalReference === customerExternalReference)?.project
    ?? workbook.consumptions.find((row) => row.customerExternalReference === customerExternalReference)?.project
    ?? '';
}

async function authorizeImport(): Promise<AllowedAuthorization | null | 'forbidden'> {
  if (!localDevelopmentDatabaseAllowed()) return null;
  const authorization = await authorizeInstitutionCustomerControlledWriteV1(true).catch(() => null);
  if (!authorization) return null;
  if (authorization.kind === 'forbidden') return 'forbidden';
  if (authorization.kind !== 'allowed') return null;
  if (authorization.actor.role !== 'tenant_admin' && authorization.actor.role !== 'tenant_operator') {
    return 'forbidden';
  }
  return authorization;
}

function parseWorkbook(content: Uint8Array): InstitutionExcelImportResultV1 | InstitutionExcelImportWorkbookV1 {
  const parsed = parseInstitutionExcelImportWorkbookV1(content);
  return parsed.kind === 'ready'
    ? parsed.workbook
    : Object.freeze({ kind: 'invalid' as const, code: parsed.code, issues: parsed.issues });
}

async function auditCompleted(
  database: TenantDatabase,
  authorization: AllowedAuthorization,
  attribution: VerifiedInstitutionAuditAttributionHandleV1,
  batchId: string,
  occurredAt: Date,
  setStage: (stage: InstitutionExcelImportExecutionStageV1) => void,
) {
  const actor = authorization.actor;
  setStage('audit_event');
  const event = createVerifiedInstitutionAttributedTenantAuditEventV1({
    event: {
      eventId: randomUUID(),
      actorId: actor.accountId,
      actorRole: actor.role,
      tenantId: actor.tenantId,
      scope: 'tenant',
      resource: 'customer',
      resourceId: batchId,
      action: 'import',
      result: 'transitioned',
      reason: 'customer_import_completed',
      occurredAt: occurredAt.toISOString(),
      source: 'server_session',
    },
    attribution,
  });
  if (!event) throw new Error('import_audit_event_invalid');
  setStage('audit_insert');
  await createAuditEventRepository(database).recordAttributed(event);
}

export async function listCurrentInstitutionExcelImportHistoryV1(): Promise<InstitutionExcelImportHistoryResultV1> {
  const authorization = await authorizeImport();
  if (authorization === 'forbidden') {
    return Object.freeze({ kind: 'forbidden', code: 'customer_import_forbidden' });
  }
  if (!authorization) {
    return Object.freeze({ kind: 'unavailable', code: 'customer_import_local_only' });
  }

  try {
    const records = await createInstitutionExcelImportRepositoryV1(getDatabase())
      .listRecentCompleted({
        tenantId: authorization.actor.tenantId,
        institutionId: authorization.actor.institutionId,
        limit: 20,
      });
    return Object.freeze({
      kind: 'ready' as const,
      records: Object.freeze(records.map((record) => Object.freeze({
        batchId: record.id,
        completedAt: record.completedAt.toISOString(),
        summary: historySummary(record),
      }))),
    });
  } catch {
    return Object.freeze({ kind: 'unavailable', code: 'customer_import_unavailable' });
  }
}

export async function readCurrentInstitutionCustomerSourceEvidenceV1(
  customerId: string,
): Promise<CustomerSourceEvidenceResultV1> {
  if (typeof customerId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u.test(customerId)) {
    return Object.freeze({ kind: 'not_found', code: 'customer_source_not_found' });
  }
  const authorization = await authorizeImport();
  if (authorization === 'forbidden') {
    return Object.freeze({ kind: 'forbidden', code: 'customer_source_forbidden' });
  }
  if (!authorization) {
    return Object.freeze({ kind: 'unavailable', code: 'customer_source_unavailable' });
  }
  try {
    const snapshot = await createInstitutionExcelImportRepositoryV1(getDatabase()).readCustomerSourceSnapshot({
      tenantId: authorization.actor.tenantId,
      institutionId: authorization.actor.institutionId,
      customerId,
    });
    if (!snapshot.customer) {
      return Object.freeze({ kind: 'not_found', code: 'customer_source_not_found' });
    }
    const { customer, rows } = snapshot;
    const validDate = (value: unknown): value is Date => value instanceof Date && Number.isFinite(value.getTime());
    if (customer.id !== customerId || !validDate(customer.updatedAt)
      || !Array.isArray(rows) || rows.length > 2
      || rows.some(row => !/^imp-b-[0-9a-f]{48}$/u.test(row.batchId)
        || row.matchedBatchId !== row.batchId || !validDate(row.completedAt)
        || !Number.isSafeInteger(row.rowNumber) || row.rowNumber < 5)) {
      throw new Error('invalid_customer_source_metadata');
    }
    const row = rows[0];
    const evidence: Extract<CustomerSourceEvidenceResultV1, { kind: 'ready' }>['evidence'] = rows.length === 1
      ? Object.freeze({
          status: 'recorded',
          importRecord: Object.freeze({
            batchId: row.batchId,
            sheetKind: 'customer',
            rowNumber: row.rowNumber,
            completedAt: row.completedAt!.toISOString(),
          }),
        })
      : Object.freeze({ status: rows.length === 0 ? 'not_recorded' : 'ambiguous', importRecord: null });
    return Object.freeze({
      kind: 'ready',
      contractVersion: 'customer-source-evidence.v1',
      customerId,
      customerUpdatedAt: customer.updatedAt.toISOString(),
      observedAt: new Date().toISOString(),
      evidence,
    });
  } catch {
    return Object.freeze({ kind: 'unavailable', code: 'customer_source_unavailable' });
  }
}

export async function getCurrentInstitutionExcelImportDetailV1(input: Readonly<{
  batchId: string;
  sheet: InstitutionExcelImportDetailSheetV1;
  page: number;
  pageSize: number;
}>): Promise<InstitutionExcelImportDetailResultV1> {
  if (
    !/^imp-b-[0-9a-f]{48}$/u.test(input.batchId)
    || !(['customer', 'appointment', 'treatment', 'consumption'] as const).includes(input.sheet)
    || !Number.isInteger(input.page)
    || input.page < 1
    || input.page > 500
    || !INSTITUTION_EXCEL_IMPORT_DETAIL_PAGE_SIZES.includes(
      input.pageSize as (typeof INSTITUTION_EXCEL_IMPORT_DETAIL_PAGE_SIZES)[number],
    )
  ) {
    return Object.freeze({ kind: 'invalid', code: 'invalid_customer_import_detail_query' });
  }

  const authorization = await authorizeImport();
  if (authorization === 'forbidden') {
    return Object.freeze({ kind: 'forbidden', code: 'customer_import_forbidden' });
  }
  if (!authorization) {
    return Object.freeze({ kind: 'unavailable', code: 'customer_import_local_only' });
  }

  try {
    const repository = createInstitutionExcelImportRepositoryV1(getDatabase());
    const scope = {
      tenantId: authorization.actor.tenantId,
      institutionId: authorization.actor.institutionId,
      batchId: input.batchId,
    };
    const batch = await repository.findCompletedBatch(scope);
    if (!batch) {
      return Object.freeze({ kind: 'not_found', code: 'customer_import_batch_not_found' });
    }
    if (batch.id !== input.batchId || !(batch.completedAt instanceof Date)
      || !Number.isFinite(batch.completedAt.getTime())) {
      throw new Error('invalid_import_batch_evidence');
    }
    const totals = historySummary(batch);
    const totalBySheet = {
      customer: totals.customers,
      appointment: totals.appointments,
      treatment: totals.treatments,
      consumption: totals.consumptions,
    } as const;
    const total = totalBySheet[input.sheet];
    const rows = await repository.listBatchRows({
      ...scope,
      sheetKind: input.sheet,
      limit: input.pageSize,
      offset: (input.page - 1) * input.pageSize,
    });
    const pageCount = total > 0 ? Math.ceil(total / input.pageSize) : 0;
    const expectedRows = Math.min(input.pageSize, Math.max(0, total - (input.page - 1) * input.pageSize));
    if (!Array.isArray(rows) || rows.length !== expectedRows || rows.some((row, index) =>
      row.tenantId !== scope.tenantId || row.institutionId !== scope.institutionId
      || row.batchId !== scope.batchId || row.sheetKind !== input.sheet
      || !Number.isSafeInteger(row.rowNumber) || row.rowNumber < 5
      || (index > 0 && row.rowNumber <= rows[index - 1].rowNumber))) {
      throw new Error('invalid_import_row_evidence');
    }
    return Object.freeze({
      kind: 'ready' as const,
      batchId: batch.id,
      completedAt: batch.completedAt.toISOString(),
      summary: totals,
      sheet: input.sheet,
      records: Object.freeze(rows.map((row) => detailRecord(input.sheet, row))),
      pageInfo: Object.freeze({
        page: input.page,
        pageSize: input.pageSize,
        total,
        pageCount,
        hasPrevious: input.page > 1,
        hasNext: input.page < pageCount,
      }),
    });
  } catch {
    return Object.freeze({ kind: 'unavailable', code: 'customer_import_detail_unavailable' });
  }
}

export async function previewCurrentInstitutionExcelImportV1(input: Readonly<{
  fileName: string;
  content: Uint8Array;
}>): Promise<InstitutionExcelImportResultV1> {
  const authorization = await authorizeImport();
  if (authorization === 'forbidden') return Object.freeze({ kind: 'forbidden', code: 'customer_import_forbidden' });
  if (!authorization) return Object.freeze({ kind: 'unavailable', code: 'customer_import_local_only' });
  const workbook = parseWorkbook(input.content);
  if ('kind' in workbook) return workbook;
  const fileDigest = createHash('sha256').update(input.content).digest('hex');
  try {
    const repository = createInstitutionExcelImportRepositoryV1(getDatabase());
    if (await repository.hasCompletedFile({
      tenantId: authorization.actor.tenantId,
      institutionId: authorization.actor.institutionId,
      fileDigest,
    })) {
      return Object.freeze({ kind: 'conflict', code: 'customer_import_file_already_completed' });
    }
  } catch {
    return Object.freeze({ kind: 'unavailable', code: 'customer_import_unavailable' });
  }
  return Object.freeze({ kind: 'ready', mode: 'preview', summary: summary(workbook) });
}

export async function executeCurrentInstitutionExcelImportV1(input: Readonly<{
  fileName: string;
  content: Uint8Array;
}>): Promise<InstitutionExcelImportResultV1> {
  const authorization = await authorizeImport();
  if (authorization === 'forbidden') return Object.freeze({ kind: 'forbidden', code: 'customer_import_forbidden' });
  if (!authorization) return Object.freeze({ kind: 'unavailable', code: 'customer_import_local_only' });
  const workbook = parseWorkbook(input.content);
  if ('kind' in workbook) return workbook;

  const actor = authorization.actor;
  const fileDigest = createHash('sha256').update(input.content).digest('hex');
  const batchId = stableId('imp-b-', actor.tenantId, actor.institutionId, fileDigest);
  const completedAt = new Date();
  const counts = summary(workbook);
  const customerIds = new Map(
    workbook.customers.map((row) => [
      row.externalReference,
      stableId('imp-c-', actor.tenantId, actor.institutionId, row.externalReference),
    ]),
  );
  let executionStage: InstitutionExcelImportExecutionStageV1 = 'transaction';

  executionStage = 'audit_attribution';
  const auditAttribution = await resolveInstitutionAuditWriterVerifiedAttributionV1({
    tenantId: actor.tenantId,
    institutionId: actor.institutionId,
  }).catch(() => null);
  if (!auditAttribution) {
    return Object.freeze({
      kind: 'conflict',
      code: 'customer_import_transaction_rejected',
      stage: executionStage,
    });
  }
  executionStage = 'transaction';

  try {
    return await getDatabase().transaction(async (transactionDatabase) => {
      const database = transactionDatabase as unknown as TenantDatabase;
      await database.execute(sql`
        SELECT pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtext('institution-excel-import-v1'),
          pg_catalog.hashtext(${`${actor.tenantId}:${actor.institutionId}`})
        )
      `);
      const repository = createInstitutionExcelImportRepositoryV1(database);
      if (await repository.hasCompletedFile({
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        fileDigest,
      })) {
        return Object.freeze({ kind: 'conflict' as const, code: 'customer_import_file_already_completed' });
      }
      executionStage = 'quota';
      const customerQuota = await checkTenantQuotaForUsage({
        database, resource: 'customers', tenantId: actor.tenantId, quantity: workbook.customers.length,
      });
      if (!customerQuota.allowed) {
        return Object.freeze({ kind: 'quota_denied' as const, code: customerQuota.reason });
      }
      const appointmentQuota = await checkTenantQuotaForUsage({
        database, resource: 'appointments', tenantId: actor.tenantId, quantity: workbook.appointments.length,
      });
      if (!appointmentQuota.allowed) {
        return Object.freeze({ kind: 'quota_denied' as const, code: appointmentQuota.reason });
      }

      executionStage = 'batch';
      await repository.createBatch({
        id: batchId,
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        fileDigest,
        fileNameDigest: sha256(input.fileName),
        customerCount: counts.customers,
        appointmentCount: counts.appointments,
        treatmentCount: counts.treatments,
        consumptionCount: counts.consumptions,
        createdBy: actor.accountId,
        completedAt,
      });

      const customerService = createCustomerCommandService(createCustomerCommandRepository(database));
      const sensitiveProfiles = createCustomerSensitiveProfileRepositoryV1(database);
      executionStage = 'customers';
      for (const row of workbook.customers) {
        const customerId = customerIds.get(row.externalReference)!;
        await customerService.createCustomer({
          attribution: { tenantId: actor.tenantId, institutionId: actor.institutionId },
          customer: {
            id: customerId,
            displayName: row.displayName,
            lifecycle: 'consulting',
            priority: 'observe',
            ownerUserId: actor.accountId,
            projectInterest: firstProject(workbook, row.externalReference),
            maskedPhone: maskPhone(row.phone),
            maskedMedicalRecordNo: maskReference(row.externalPatientId),
            lastTouchSummary: '由机构 Excel 导入',
            nextAction: '请人工复核客户主档',
            tags: ['Excel导入'],
            gender: row.gender,
            birthDate: row.birthDate,
            referralSource: row.acquisitionSource || row.source,
            notes: joinNotes([
              ['客户来源', row.source], ['获客来源', row.acquisitionSource], ['原负责人', row.owner],
              ['原建档时间', row.createdAt], ['备注', row.notes],
            ]),
          },
        });
        await sensitiveProfiles.createImportedProfile({
          id: stableId('imp-sp-', actor.tenantId, actor.institutionId, row.externalReference),
          tenantId: actor.tenantId,
          institutionId: actor.institutionId,
          customerId,
          phoneDigest: sha256(actor.tenantId, actor.institutionId, row.phone),
          protectedPhone: encryptSecret(row.phone),
          nationalIdDigest: row.nationalId ? sha256(actor.tenantId, actor.institutionId, row.nationalId) : null,
          protectedNationalId: row.nationalId ? encryptSecret(row.nationalId) : null,
          externalPatientIdDigest: row.externalPatientId ? sha256(actor.tenantId, actor.institutionId, row.externalPatientId) : null,
          protectedExternalPatientId: row.externalPatientId ? encryptSecret(row.externalPatientId) : null,
          actorId: actor.accountId,
        });
      }

      const appointmentService = createAppointmentCommandService(createAppointmentCommandRepository(database));
      executionStage = 'appointments';
      for (const row of workbook.appointments) {
        const result = await appointmentService.createAppointment({
          attribution: { tenantId: actor.tenantId, institutionId: actor.institutionId },
          appointment: {
            id: stableId('imp-a-', actor.tenantId, actor.institutionId, row.externalReference),
            customerId: customerIds.get(row.customerExternalReference)!,
            project: row.project,
            scheduledAt: new Date(row.scheduledAt),
            consultantUserId: actor.accountId,
            status: row.status,
            note: joinNotes([
              ['原医生或顾问', row.consultant], ['资源', row.resource], ['数据来源', row.source],
              ['HIS预约ID', row.hisAppointmentId], ['原创建人', row.createdBy], ['备注', row.notes],
            ]),
          },
        });
        if (result.kind !== 'created') throw new Error('appointment_import_failed');
      }

      const treatmentService = createTreatmentSummaryCommandService(createTreatmentSummaryCommandRepository(database));
      executionStage = 'treatments';
      for (const row of workbook.treatments) {
        const result = await treatmentService.createTreatmentSummary({
          attribution: { tenantId: actor.tenantId, institutionId: actor.institutionId },
          treatmentSummary: {
            id: stableId('imp-t-', actor.tenantId, actor.institutionId, row.externalReference),
            customerId: customerIds.get(row.customerExternalReference)!,
            appointmentId: null,
            treatmentDate: new Date(row.treatmentAt),
            treatmentProject: row.project,
            treatmentCategory: row.department || 'Excel导入',
            treatmentStage: row.status,
            recoveryStage: row.status === '已完成' ? '已完成' : '待人工确认',
            riskLevel: 'normal',
            ownerUserId: actor.accountId,
            summary: joinNotes([
              ['原医生', row.doctor], ['数据来源', row.source], ['原始记录ID', row.sourceRecordId], ['备注', row.notes],
            ]),
            nextCareAction: '请人工复核导入治疗记录',
            tags: ['Excel导入'],
          },
        });
        if (result.kind !== 'created') throw new Error('treatment_import_failed');
      }

      executionStage = 'analytics';
      await createAnalyticsConsumptionFactWriterV1(database).createImport({
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        sourceId: stableId('imp-src-', actor.tenantId, actor.institutionId, fileDigest),
        sourceLabel: '机构 Excel 客户数据导入',
        batchReference: batchId,
        provenanceDigest: fileDigest,
        actorId: actor.accountId,
        receivedAt: completedAt,
        facts: workbook.consumptions.map((row) => ({
          sourceRecordRef: sha256(actor.tenantId, actor.institutionId, row.externalReference),
          eventType: row.eventType,
          eventAt: new Date(row.eventAt),
          receivedAt: completedAt,
          amountMinor: row.amountMinor,
          currency: row.currency,
          stableConsumptionRecordRef: row.orderReference
            ? sha256(actor.tenantId, actor.institutionId, row.orderReference)
            : null,
          customerId: customerIds.get(row.customerExternalReference)!,
          projectCandidateReference: `project_${sha256(row.project).slice(0, 40)}`,
        })),
      });

      const importRows = [
        ...workbook.customers.map((row) => ({ kind: 'customer' as const, row, canonicalId: customerIds.get(row.externalReference)! })),
        ...workbook.appointments.map((row) => ({ kind: 'appointment' as const, row, canonicalId: stableId('imp-a-', actor.tenantId, actor.institutionId, row.externalReference) })),
        ...workbook.treatments.map((row) => ({ kind: 'treatment' as const, row, canonicalId: stableId('imp-t-', actor.tenantId, actor.institutionId, row.externalReference) })),
        ...workbook.consumptions.map((row) => ({ kind: 'consumption' as const, row, canonicalId: sha256(actor.tenantId, actor.institutionId, row.externalReference) })),
      ];
      executionStage = 'row_evidence';
      await repository.createRows(importRows.map(({ kind, row, canonicalId }) => ({
        id: stableId(`imp-r-${kind.slice(0, 1)}-`, actor.tenantId, actor.institutionId, row.externalReference),
        tenantId: actor.tenantId,
        institutionId: actor.institutionId,
        batchId,
        sheetKind: kind,
        rowNumber: row.rowNumber,
        externalReferenceDigest: sha256(actor.tenantId, actor.institutionId, kind, row.externalReference),
        canonicalRecordId: canonicalId,
        protectedPayload: encryptSecret(JSON.stringify(row)),
      })));

      await auditCompleted(
        database,
        authorization,
        auditAttribution,
        batchId,
        completedAt,
        (stage) => { executionStage = stage; },
      );
      return Object.freeze({ kind: 'ready' as const, mode: 'completed' as const, summary: counts, batchId });
    });
  } catch {
    return Object.freeze({
      kind: 'conflict',
      code: 'customer_import_transaction_rejected',
      stage: executionStage,
    });
  }
}
