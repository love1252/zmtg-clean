import { desc, eq } from 'drizzle-orm';

import { mapTenantCommercialRecordToDto } from '@/modules/open-platform/domain/tenant-commercial-records';
import type { TenantDatabase } from '@/server/db/client';
import { tenantCommercialRecords } from '@/server/db/schema';

type TenantCommercialRecordRow = typeof tenantCommercialRecords.$inferSelect;

export type InsertCommercialRecordInput = {
  id: string;
  tenantId: string;
  recordType: string;
  status?: string;
  displayCode: string;
  displayAmount?: string | null;
  periodLabel?: string | null;
  relatedPlanChangeId?: string | null;
  note?: string | null;
  occurredAt?: Date | null;
  createdBy: string;
  updatedBy: string;
};

export function insertOneCommercialRecord(
  database: TenantDatabase,
  input: InsertCommercialRecordInput,
) {
  const now = new Date();
  const safeStatus = (['draft', 'pending', 'manual_review', 'completed', 'cancelled'] as const).includes(
    input.status as 'draft' | 'pending' | 'manual_review' | 'completed' | 'cancelled',
  )
    ? (input.status as 'draft' | 'pending' | 'manual_review' | 'completed' | 'cancelled')
    : 'completed';
  return database.insert(tenantCommercialRecords).values({
    id: input.id,
    tenantId: input.tenantId,
    recordType: input.recordType as typeof tenantCommercialRecords.$inferSelect['recordType'],
    status: safeStatus,
    displayCode: input.displayCode,
    displayAmount: input.displayAmount ?? null,
    periodLabel: input.periodLabel ?? null,
    relatedPlanChangeId: input.relatedPlanChangeId ?? null,
    note: input.note ?? null,
    occurredAt: input.occurredAt ?? now,
    createdBy: input.createdBy,
    updatedBy: input.updatedBy,
    createdAt: now,
    updatedAt: now,
  });
}

export function createTenantCommercialRecordsRepository(database: TenantDatabase) {
  return {
    async listTenantCommercialRecords(tenantId: string) {
      const rows = await database
        .select()
        .from(tenantCommercialRecords)
        .where(eq(tenantCommercialRecords.tenantId, tenantId))
        .orderBy(desc(tenantCommercialRecords.createdAt));

      return (rows as TenantCommercialRecordRow[]).map(mapTenantCommercialRecordToDto);
    },
  };
}

export type TenantCommercialRecordsRepository = ReturnType<
  typeof createTenantCommercialRecordsRepository
>;
