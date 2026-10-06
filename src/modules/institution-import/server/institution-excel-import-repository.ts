import { and, asc, desc, eq } from 'drizzle-orm';

import type { TenantDatabase } from '@/server/db/client';
import {
  customers,
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
  id: string;
  completedAt: Date;
  customerCount: number;
  appointmentCount: number;
  treatmentCount: number;
  consumptionCount: number;
}>;

export function createInstitutionExcelImportRepositoryV1(database: TenantDatabase) {
  return Object.freeze({
    async readCustomerSourceSnapshot(input: Readonly<{
      tenantId: string;
      institutionId: string;
      customerId: string;
    }>) {
      return database.transaction(async (transaction) => {
        const [customer] = await transaction.select({ id: customers.id, updatedAt: customers.updatedAt })
          .from(customers)
          .where(and(
            eq(customers.tenantId, input.tenantId),
            eq(customers.institutionId, input.institutionId),
            eq(customers.id, input.customerId),
          ))
          .limit(1);
        if (!customer) return { customer: null, rows: [] };
        const rows = await transaction.select({
          batchId: institutionExcelImportRows.batchId,
          rowNumber: institutionExcelImportRows.rowNumber,
          matchedBatchId: institutionExcelImportBatches.id,
          completedAt: institutionExcelImportBatches.completedAt,
        })
          .from(institutionExcelImportRows)
          .leftJoin(institutionExcelImportBatches, and(
            eq(institutionExcelImportBatches.tenantId, input.tenantId),
            eq(institutionExcelImportBatches.institutionId, input.institutionId),
            eq(institutionExcelImportBatches.id, institutionExcelImportRows.batchId),
          ))
          .where(and(
            eq(institutionExcelImportRows.tenantId, input.tenantId),
            eq(institutionExcelImportRows.institutionId, input.institutionId),
            eq(institutionExcelImportRows.sheetKind, 'customer'),
            eq(institutionExcelImportRows.canonicalRecordId, input.customerId),
          ))
          .orderBy(asc(institutionExcelImportRows.batchId), asc(institutionExcelImportRows.rowNumber))
          .limit(2);
        return { customer, rows };
      }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
    },
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
          id: institutionExcelImportBatches.id,
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
    async findCompletedBatch(input: Readonly<{
      tenantId: string;
      institutionId: string;
      batchId: string;
    }>): Promise<InstitutionExcelImportHistoryRecordV1 | null> {
      const [record] = await database
        .select({
          id: institutionExcelImportBatches.id,
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
          eq(institutionExcelImportBatches.id, input.batchId),
        ))
        .limit(1);
      return record ?? null;
    },
    async listBatchRows(input: Readonly<{
      tenantId: string;
      institutionId: string;
      batchId: string;
      sheetKind: InstitutionExcelImportRowRecordV1['sheetKind'];
      limit: number;
      offset: number;
    }>): Promise<readonly InstitutionExcelImportRowRecordV1[]> {
      return database
        .select({
          id: institutionExcelImportRows.id,
          tenantId: institutionExcelImportRows.tenantId,
          institutionId: institutionExcelImportRows.institutionId,
          batchId: institutionExcelImportRows.batchId,
          sheetKind: institutionExcelImportRows.sheetKind,
          rowNumber: institutionExcelImportRows.rowNumber,
          externalReferenceDigest: institutionExcelImportRows.externalReferenceDigest,
          canonicalRecordId: institutionExcelImportRows.canonicalRecordId,
          protectedPayload: institutionExcelImportRows.protectedPayload,
        })
        .from(institutionExcelImportRows)
        .where(and(
          eq(institutionExcelImportRows.tenantId, input.tenantId),
          eq(institutionExcelImportRows.institutionId, input.institutionId),
          eq(institutionExcelImportRows.batchId, input.batchId),
          eq(institutionExcelImportRows.sheetKind, input.sheetKind),
        ))
        .orderBy(asc(institutionExcelImportRows.rowNumber))
        .limit(Math.min(Math.max(input.limit, 1), 100))
        .offset(Math.max(input.offset, 0));
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
