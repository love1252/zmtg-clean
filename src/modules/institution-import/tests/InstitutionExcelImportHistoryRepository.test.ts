import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import { createInstitutionExcelImportRepositoryV1 } from '@/modules/institution-import/server/institution-excel-import-repository';
import type { TenantDatabase } from '@/server/db/client';
import { institutionExcelImportBatches, institutionExcelImportRows } from '@/server/db/schema';

const compile = (value: SQL) => new PgDialect().sqlToQuery(value);
const scope = { tenantId: 'tenant-a', institutionId: 'institution-a', batchId: 'batch-a' };
function fixture() {
  const offset = vi.fn(async (_value: number) => []);
  const limit = vi.fn((_value: number) => ({ offset, then: (done: (rows: unknown[]) => void) => Promise.resolve([]).then(done) }));
  const orderBy = vi.fn((..._values: SQL[]) => ({ limit }));
  const where = vi.fn((_condition: SQL) => ({ limit, orderBy }));
  const from = vi.fn((_table: unknown) => ({ where }));
  const select = vi.fn((_selection: Record<string, unknown>) => ({ from }));
  return { database: { select } as unknown as TenantDatabase, select, from, where, limit, orderBy, offset };
}

describe('导入历史仓库范围与SQL', () => {
  it('批次必须同时匹配租户、机构和ID，不查询其他机构批次', async () => {
    const db = fixture();
    expect(await createInstitutionExcelImportRepositoryV1(db.database).findCompletedBatch(scope)).toBeNull();
    expect(db.from).toHaveBeenCalledWith(institutionExcelImportBatches);
    const condition = compile(db.where.mock.calls[0][0]);
    expect(condition.sql).toBe('("institution_excel_import_batches"."tenant_id" = $1 and "institution_excel_import_batches"."institution_id" = $2 and "institution_excel_import_batches"."id" = $3)');
    expect(condition.params).toEqual(['tenant-a', 'institution-a', 'batch-a']);
    expect(db.limit).toHaveBeenCalledWith(1);
    expect(db.select.mock.calls[0][0]).not.toHaveProperty('fileDigest');
    expect(db.select.mock.calls[0][0]).not.toHaveProperty('createdBy');
  });

  it.each(['customer', 'appointment', 'treatment', 'consumption'] as const)('%s明细SQL含完整范围与Sheet、稳定排序及数据库分页', async sheetKind => {
    const db = fixture();
    await createInstitutionExcelImportRepositoryV1(db.database).listBatchRows({ ...scope, sheetKind, limit: 20, offset: 100 });
    expect(db.from).toHaveBeenCalledWith(institutionExcelImportRows);
    const condition = compile(db.where.mock.calls[0][0]);
    expect(condition.sql).toBe('("institution_excel_import_rows"."tenant_id" = $1 and "institution_excel_import_rows"."institution_id" = $2 and "institution_excel_import_rows"."batch_id" = $3 and "institution_excel_import_rows"."sheet_kind" = $4)');
    expect(condition.params).toEqual(['tenant-a', 'institution-a', 'batch-a', sheetKind]);
    expect(db.orderBy.mock.calls[0].map(value => compile(value).sql)).toEqual(['"institution_excel_import_rows"."row_number" asc']);
    expect(db.limit).toHaveBeenCalledWith(20);
    expect(db.offset).toHaveBeenCalledWith(100);
  });
});
