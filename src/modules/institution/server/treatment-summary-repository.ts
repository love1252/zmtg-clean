import { and, asc, desc, eq } from 'drizzle-orm';
import type { TreatmentSummaryRecord } from '@/modules/institution/domain/treatment-summaries';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, treatmentSummaries } from '@/server/db/schema';

type TreatmentSummaryRow = typeof treatmentSummaries.$inferSelect;
type TreatmentSummaryLookupInput = {
  tenantId: string;
  customerId: string;
};
export type CreateTreatmentSummaryInput = Omit<
  TreatmentSummaryRecord,
  'createdAt' | 'updatedAt' | 'treatmentDate'
> & {
  treatmentDate: Date;
};

export type TreatmentSummaryAppointmentOwnershipInput = {
  tenantId: string;
  customerId: string;
  appointmentId: string;
};

export type TreatmentSummaryAppointmentOwnershipResult =
  | { kind: 'matched' }
  | { kind: 'customer_mismatch' }
  | { kind: 'not_found_or_not_owned' };

export function mapTreatmentSummaryRowToRecord(row: TreatmentSummaryRow): TreatmentSummaryRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createTreatmentSummaryRepository(database: TenantDatabase) {
  return {
    async createTreatmentSummary(
      input: CreateTreatmentSummaryInput,
    ): Promise<TreatmentSummaryRecord> {
      const [row] = await database
        .insert(treatmentSummaries)
        .values({
          id: input.id,
          tenantId: input.tenantId,
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

      if (!row) {
        throw new Error('Failed to create treatment summary');
      }

      return mapTreatmentSummaryRowToRecord(row);
    },

    async checkAppointmentBelongsToTenantAndCustomer(
      input: TreatmentSummaryAppointmentOwnershipInput,
    ): Promise<TreatmentSummaryAppointmentOwnershipResult> {
      const [appointment] = await database
        .select({ customerId: appointments.customerId })
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.id, input.appointmentId),
          ),
        );

      if (!appointment) {
        return { kind: 'not_found_or_not_owned' };
      }

      if (appointment.customerId !== input.customerId) {
        return { kind: 'customer_mismatch' };
      }

      return { kind: 'matched' };
    },

    async listTreatmentSummariesByTenantAndCustomer(
      input: TreatmentSummaryLookupInput,
    ): Promise<TreatmentSummaryRecord[]> {
      const rows = await database
        .select()
        .from(treatmentSummaries)
        .where(
          and(
            eq(treatmentSummaries.tenantId, input.tenantId),
            eq(treatmentSummaries.customerId, input.customerId),
          ),
        )
        .orderBy(desc(treatmentSummaries.treatmentDate), asc(treatmentSummaries.id));

      return rows
        .filter(
          (row) => row.tenantId === input.tenantId && row.customerId === input.customerId,
        )
        .map(mapTreatmentSummaryRowToRecord);
    },
  };
}
