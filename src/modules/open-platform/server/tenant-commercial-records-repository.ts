import { desc, eq } from 'drizzle-orm';

import { mapTenantCommercialRecordToDto } from '@/modules/open-platform/domain/tenant-commercial-records';
import type { TenantDatabase } from '@/server/db/client';
import { tenantCommercialRecords } from '@/server/db/schema';

type TenantCommercialRecordRow = typeof tenantCommercialRecords.$inferSelect;

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
