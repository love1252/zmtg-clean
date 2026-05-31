import { and, asc, desc, eq } from 'drizzle-orm';
import type { TreatmentSummaryRecord } from '@/modules/institution/domain/treatment-summaries';
import type { TenantDatabase } from '@/server/db/client';
import { treatmentSummaries } from '@/server/db/schema';

type TreatmentSummaryRow = typeof treatmentSummaries.$inferSelect;
type TreatmentSummaryLookupInput = {
  tenantId: string;
  customerId: string;
};

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
