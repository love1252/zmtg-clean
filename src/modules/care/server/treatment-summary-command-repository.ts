import { and, eq, isNull } from 'drizzle-orm';

import type {
  CreateTreatmentSummaryCommandResult,
  TreatmentSummaryCommandAttribution,
  TreatmentSummaryCommandFields,
  TreatmentSummaryCommandRecord,
  TreatmentSummaryCommandRepository,
  UpdateTreatmentSummaryCommandResult,
  VoidTreatmentSummaryCommandResult,
} from '@/modules/care/application/treatment-summary-command-service';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, customers, treatmentSummaries } from '@/server/db/schema';

type TreatmentSummaryRow = typeof treatmentSummaries.$inferSelect;

function mapScopedRow(
  row: TreatmentSummaryRow,
  expectedInstitutionId: string,
): TreatmentSummaryCommandRecord | null {
  if (row.institutionId !== expectedInstitutionId) return null;

  return {
    id: row.id,
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    customerId: row.customerId,
    appointmentId: row.appointmentId,
    treatmentDate: row.treatmentDate.toISOString(),
    treatmentProject: row.treatmentProject,
    treatmentCategory: row.treatmentCategory,
    treatmentStage: row.treatmentStage,
    recoveryStage: row.recoveryStage,
    riskLevel: row.riskLevel,
    ownerUserId: row.ownerUserId,
    summary: row.summary,
    nextCareAction: row.nextCareAction,
    tags: [...row.tags],
    status: row.voidedAt ? 'voided' : 'active',
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidedBy: row.voidedBy,
    voidReasonCode: row.voidReasonCode,
    voidReason: row.voidReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function customerOwned(
  database: TenantDatabase,
  input: TreatmentSummaryCommandAttribution & Readonly<{ customerId: string }>,
) {
  const [row] = await database
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, input.tenantId),
        eq(customers.institutionId, input.institutionId),
        eq(customers.id, input.customerId),
      ),
    );
  return Boolean(row);
}

async function appointmentOwned(
  database: TenantDatabase,
  input: TreatmentSummaryCommandAttribution &
    Readonly<{ customerId: string; appointmentId: string }>,
) {
  const [row] = await database
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, input.tenantId),
        eq(appointments.institutionId, input.institutionId),
        eq(appointments.customerId, input.customerId),
        eq(appointments.id, input.appointmentId),
      ),
    );
  return Boolean(row);
}

async function findScoped(
  database: TenantDatabase,
  input: TreatmentSummaryCommandAttribution & Readonly<{ summaryId: string }>,
): Promise<TreatmentSummaryRow | null> {
  const [row] = await database
    .select()
    .from(treatmentSummaries)
    .where(
      and(
        eq(treatmentSummaries.tenantId, input.tenantId),
        eq(treatmentSummaries.institutionId, input.institutionId),
        eq(treatmentSummaries.id, input.summaryId),
      ),
    );
  return row ?? null;
}

function pickUpdateValues(
  changes: Partial<TreatmentSummaryCommandFields>,
): Partial<typeof treatmentSummaries.$inferInsert> {
  const values: Partial<typeof treatmentSummaries.$inferInsert> = {};
  if (changes.appointmentId !== undefined) values.appointmentId = changes.appointmentId;
  if (changes.treatmentDate !== undefined) values.treatmentDate = changes.treatmentDate;
  if (changes.treatmentProject !== undefined) values.treatmentProject = changes.treatmentProject;
  if (changes.treatmentCategory !== undefined) values.treatmentCategory = changes.treatmentCategory;
  if (changes.treatmentStage !== undefined) values.treatmentStage = changes.treatmentStage;
  if (changes.recoveryStage !== undefined) values.recoveryStage = changes.recoveryStage;
  if (changes.riskLevel !== undefined) values.riskLevel = changes.riskLevel;
  if (changes.ownerUserId !== undefined) values.ownerUserId = changes.ownerUserId;
  if (changes.summary !== undefined) values.summary = changes.summary;
  if (changes.nextCareAction !== undefined) values.nextCareAction = changes.nextCareAction;
  if (changes.tags !== undefined) values.tags = [...changes.tags];
  return values;
}

export function createTreatmentSummaryCommandRepository(
  database: TenantDatabase,
): TreatmentSummaryCommandRepository {
  return Object.freeze({
    async create(
      input: Parameters<TreatmentSummaryCommandRepository['create']>[0],
    ): Promise<CreateTreatmentSummaryCommandResult> {
      if (!(await customerOwned(database, input))) {
        return { kind: 'invalid_reference', reason: 'customer_not_found_or_not_owned' };
      }

      if (
        input.appointmentId !== null &&
        !(await appointmentOwned(database, {
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          customerId: input.customerId,
          appointmentId: input.appointmentId,
        }))
      ) {
        return { kind: 'invalid_reference', reason: 'appointment_not_found_or_not_owned' };
      }

      const [row] = await database
        .insert(treatmentSummaries)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          customerId: input.customerId,
          appointmentId: input.appointmentId,
          treatmentDate: input.treatmentDate,
          treatmentProject: input.treatmentProject,
          treatmentCategory: input.treatmentCategory,
          treatmentStage: input.treatmentStage,
          recoveryStage: input.recoveryStage,
          riskLevel: input.riskLevel,
          ownerUserId: input.ownerUserId,
          summary: input.summary,
          nextCareAction: input.nextCareAction,
          tags: [...input.tags],
        })
        .returning();

      if (!row) return { kind: 'not_found_or_not_owned' };
      const record = mapScopedRow(row, input.institutionId);
      return record ? { kind: 'created', record } : { kind: 'not_found_or_not_owned' };
    },

    async update(
      input: Parameters<TreatmentSummaryCommandRepository['update']>[0],
    ): Promise<UpdateTreatmentSummaryCommandResult> {
      const current = await findScoped(database, input);
      if (!current) return { kind: 'not_found_or_not_owned' };

      if (
        !(await customerOwned(database, {
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          customerId: current.customerId,
        }))
      ) {
        return { kind: 'not_found_or_not_owned' };
      }

      if (
        typeof input.changes.appointmentId === 'string' &&
        !(await appointmentOwned(database, {
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          customerId: current.customerId,
          appointmentId: input.changes.appointmentId,
        }))
      ) {
        return { kind: 'invalid_reference', reason: 'appointment_not_found_or_not_owned' };
      }

      const [row] = await database
        .update(treatmentSummaries)
        .set({ ...pickUpdateValues(input.changes), updatedAt: new Date() })
        .where(
          and(
            eq(treatmentSummaries.tenantId, input.tenantId),
            eq(treatmentSummaries.institutionId, input.institutionId),
            eq(treatmentSummaries.customerId, current.customerId),
            eq(treatmentSummaries.id, input.summaryId),
          ),
        )
        .returning();

      if (!row) return { kind: 'not_found_or_not_owned' };
      const record = mapScopedRow(row, input.institutionId);
      return record ? { kind: 'updated', record } : { kind: 'not_found_or_not_owned' };
    },

    async void(
      input: Parameters<TreatmentSummaryCommandRepository['void']>[0],
    ): Promise<VoidTreatmentSummaryCommandResult> {
      const current = await findScoped(database, input);
      if (!current) return { kind: 'not_found_or_not_owned' };

      if (
        !(await customerOwned(database, {
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          customerId: current.customerId,
        }))
      ) {
        return { kind: 'not_found_or_not_owned' };
      }

      const currentRecord = mapScopedRow(current, input.institutionId);
      if (!currentRecord) return { kind: 'not_found_or_not_owned' };
      if (current.voidedAt) return { kind: 'already_voided', record: currentRecord };

      const now = new Date();
      const [row] = await database
        .update(treatmentSummaries)
        .set({
          voidedAt: now,
          voidedBy: input.voidedBy,
          voidReasonCode: input.reasonCode,
          voidReason: input.reasonText,
          updatedAt: now,
        })
        .where(
          and(
            eq(treatmentSummaries.tenantId, input.tenantId),
            eq(treatmentSummaries.institutionId, input.institutionId),
            eq(treatmentSummaries.customerId, current.customerId),
            eq(treatmentSummaries.id, input.summaryId),
            isNull(treatmentSummaries.voidedAt),
          ),
        )
        .returning();

      if (!row) return { kind: 'not_found_or_not_owned' };
      const record = mapScopedRow(row, input.institutionId);
      return record ? { kind: 'voided', record } : { kind: 'not_found_or_not_owned' };
    },
  });
}
