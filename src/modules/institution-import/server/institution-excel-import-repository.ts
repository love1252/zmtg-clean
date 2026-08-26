import { and, desc, eq } from 'drizzle-orm';

import type { TenantDatabase } from '@/server/db/client';
import {
  institutionExcelImportBatches,
  institutionExcelImportRows,
} from '@/server/db/schema';

type InstitutionExcelImportRowInsertV1 = typeof institutionExcelImportRows.$inferInsert;

export type InstitutionExcelImportBatchRecordV1 = Readonly<{
  id: string;
  tenantId: string;
  institutionId: string;
  fileDigest: string;
  fileNameDigest: string;
  customerCount: number;
  appointmentCount: number;
  treatmentCount: number;
  consumptionCount: number;
  createdBy: string;
  completedAt: Date;
}>;

export type InstitutionExcelImportRowRecordV1 = Readonly<{
  id: string;
  tenantId: string;
  institutionId: string;
  batchId: string;
  sheetKind: 'customer' | 'appointment' | 'treatment' | 'consumption';
  rowNumber: number;
  externalReferenceDigest: string;
  canonicalRecordId: string;
  protectedPayload: InstitutionExcelImportRowInsertV1['protectedPayload'];
}>;

export type InstitutionExcelImportHistoryRecordV1 = Readonly<{
  completedAt: Date;
  customerCount: number;
  appointmentCount: number;
  treatmentCount: number;
  consumptionCount: number;
}>;

export function createInstitutionExcelImportRepositoryV1(database: TenantDatabase) {
  return Object.freeze({
    async hasCompletedFile(input: Readonly<{
      tenantId: string;
      institutionId: string;
      fileDigest: string;
    }>): Promise<boolean> {
      const [row] = await database
        .select({ id: institutionExcelImportBatches.id })
        .from(institutionExcelImportBatches)
        .where(and(
          eq(institutionExcelImportBatches.tenantId, input.tenantId),
          eq(institutionExcelImportBatches.institutionId, input.institutionId),
          eq(institutionExcelImportBatches.fileDigest, input.fileDigest),
        ))
        .limit(1);
      return Boolean(row);
    },
    async listRecentCompleted(input: Readonly<{
      tenantId: string;
      institutionId: string;
      limit: number;
    }>): Promise<readonly InstitutionExcelImportHistoryRecordV1[]> {
      return database
        .select({
          completedAt: institutionExcelImportBatches.completedAt,
          customerCount: institutionExcelImportBatches.customerCount,
          appointmentCount: institutionExcelImportBatches.appointmentCount,
          treatmentCount: institutionExcelImportBatches.treatmentCount,
          consumptionCount: institutionExcelImportBatches.consumptionCount,
        })
        .from(institutionExcelImportBatches)
        .where(and(
          eq(institutionExcelImportBatches.tenantId, input.tenantId),
          eq(institutionExcelImportBatches.institutionId, input.institutionId),
        ))
        .orderBy(desc(institutionExcelImportBatches.completedAt))
        .limit(Math.min(Math.max(input.limit, 1), 20));
    },
    async createBatch(input: InstitutionExcelImportBatchRecordV1): Promise<void> {
      await database.insert(institutionExcelImportBatches).values(input);
    },
    async createRows(input: readonly InstitutionExcelImportRowRecordV1[]): Promise<void> {
      if (input.length === 0) return;
      await database.insert(institutionExcelImportRows).values([...input]);
    },
  });
}
