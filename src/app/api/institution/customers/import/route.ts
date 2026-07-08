import { NextResponse } from 'next/server';
import { createAuditEvent } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import {
  getCustomerImportRowsForExecution,
  previewLowSensitiveCustomerImport,
} from '@/modules/institution/domain/customer-import';
import { runTenantBusinessAuditTransaction } from '@/modules/institution/server/tenant-business-audit-transaction';
import { createTenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import { checkTenantQuotaForUsage } from '@/modules/institution/server/tenant-quota-enforcement';
import { canAccessResource, type AccessContext } from '@/modules/security/domain/access-control';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

function createAuditEventId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

async function readJsonBody(request: Request) {
  try {
    return { ok: true as const, value: await request.json() };
  } catch {
    return { ok: false as const };
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function parseRowsPayload(input: unknown) {
  if (!isRecord(input)) {
    return { ok: false as const, error: '请求体必须是 JSON object' };
  }

  if ('tenantId' in input || 'institutionId' in input || 'operatorRef' in input) {
    return { ok: false as const, error: '请求不允许提交 tenantId / institutionId / operatorRef' };
  }

  if (!Array.isArray(input.rows)) {
    return { ok: false as const, error: '字段 rows 必须是数组' };
  }

  return { ok: true as const, rows: input.rows };
}

function createForbiddenResponse(status: 401 | 403, error: string) {
  return NextResponse.json({ error }, { status });
}

async function authorizeCustomerImport(input: {
  context: AccessContext | null;
  action: 'preview' | 'execute';
}) {
  if (!input.context) {
    return {
      ok: false as const,
      response: createForbiddenResponse(401, '请先登录'),
    };
  }

  const decision = canAccessResource({
    context: input.context,
    resource: 'customer',
    action: 'import',
    targetTenantId: input.context.tenantId,
  });

  if (!decision.allowed || !input.context.tenantId) {
    return {
      ok: false as const,
      response: createForbiddenResponse(403, '没有访问权限'),
    };
  }

  return { ok: true as const, tenantId: input.context.tenantId };
}

function hasSensitiveBlockedRows(preview: ReturnType<typeof previewLowSensitiveCustomerImport>) {
  return preview.importBatch.rows.some((row) =>
    row.issues.some((issue) => issue.reason === 'sensitive_field_detected'),
  );
}

function auditReasonForPreview(preview: ReturnType<typeof previewLowSensitiveCustomerImport>) {
  if (hasSensitiveBlockedRows(preview)) return 'customer_import_sensitive_field_blocked';
  if (preview.successCount === 0 && preview.totalCount > 0) return 'customer_import_rejected';
  return 'customer_import_previewed';
}

function auditReasonForExecute(preview: ReturnType<typeof previewLowSensitiveCustomerImport>) {
  if (hasSensitiveBlockedRows(preview)) return 'customer_import_sensitive_field_blocked';
  if (preview.successCount === 0) return 'customer_import_rejected';
  if (preview.skippedCount > 0) return 'customer_import_partially_completed';
  return 'customer_import_completed';
}

export async function POST(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  const authorized = await authorizeCustomerImport({ context, action: 'preview' });
  if (!authorized.ok) return authorized.response;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const parsed = parseRowsPayload(body.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const repository = createTenantBusinessRepository(db);
    const auditRepository = createAuditEventRepository(db);
    const occurredAt = new Date().toISOString();
    const existingCustomers = await repository.listCustomersByTenant(authorized.tenantId);
    const preview = previewLowSensitiveCustomerImport({
      tenantId: authorized.tenantId,
      institutionId: context?.institutionId ?? null,
      operatorRef: context?.userId ?? 'tenant-operator',
      rows: parsed.rows,
      existingCustomers,
      occurredAt,
    });

    await auditRepository.record(
      createAuditEvent({
        eventId: createAuditEventId(),
        context: context as AccessContext,
        resource: 'customer',
        resourceId: preview.importBatch.importBatchId,
        action: 'import',
        result: preview.successCount > 0 ? 'allowed' : 'denied',
        reason: preview.successCount > 0
          ? 'customer_import_permission_checked'
          : auditReasonForPreview(preview),
        occurredAt,
      }),
    );

    return NextResponse.json(preview);
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const context = getDemoAccessContextFromRequest(request);
  const authorized = await authorizeCustomerImport({ context, action: 'execute' });
  if (!authorized.ok) return authorized.response;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: '请求格式不正确' }, { status: 400 });
  }

  const parsed = parseRowsPayload(body.value);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const occurredAt = new Date().toISOString();
    const readRepository = createTenantBusinessRepository(db);
    const existingCustomers = await readRepository.listCustomersByTenant(authorized.tenantId);
    const { preview, drafts } = getCustomerImportRowsForExecution({
      tenantId: authorized.tenantId,
      institutionId: context?.institutionId ?? null,
      operatorRef: context?.userId ?? 'tenant-operator',
      rows: parsed.rows,
      existingCustomers,
      occurredAt,
    });

    if (drafts.length === 0) {
      const auditRepository = createAuditEventRepository(db);
      await auditRepository.record(
        createAuditEvent({
          eventId: createAuditEventId(),
          context: context as AccessContext,
          resource: 'customer',
          resourceId: preview.importBatch.importBatchId,
          action: 'import',
          result: 'denied',
          reason: auditReasonForExecute(preview),
          occurredAt,
        }),
      );

      return NextResponse.json({ ...preview, importedCustomerIds: [] }, { status: 409 });
    }

    const quotaDecision = await checkTenantQuotaForUsage({
      database: db,
      tenantId: authorized.tenantId,
      resource: 'customers',
      quantity: drafts.length,
    });

    if (!quotaDecision.allowed) {
      const auditRepository = createAuditEventRepository(db);
      await auditRepository.record(
        createAuditEvent({
          eventId: createAuditEventId(),
          context: context as AccessContext,
          resource: 'customer',
          resourceId: preview.importBatch.importBatchId,
          action: 'import',
          result: 'denied',
          reason: quotaDecision.reason,
          occurredAt,
        }),
      );

      return NextResponse.json({ code: quotaDecision.reason, error: '客户数量已达到当前套餐上限，请联系平台管理员调整套餐' }, { status: 409 });
    }

    const importedCustomerIds = await runTenantBusinessAuditTransaction(db, async ({ repository, auditRepository }) => {
      const ids: string[] = [];
      for (const draft of drafts) {
        const record = await repository.createCustomer(draft);
        ids.push(record.id);
      }

      await auditRepository.record(
        createAuditEvent({
          eventId: createAuditEventId(),
          context: context as AccessContext,
          resource: 'customer',
          resourceId: preview.importBatch.importBatchId,
          action: 'import',
          result: 'allowed',
          reason: auditReasonForExecute(preview),
          occurredAt,
        }),
      );

      return ids;
    });

    return NextResponse.json({ ...preview, importedCustomerIds });
  } catch {
    return NextResponse.json({ error: '数据服务暂时不可用' }, { status: 503 });
  }
}
