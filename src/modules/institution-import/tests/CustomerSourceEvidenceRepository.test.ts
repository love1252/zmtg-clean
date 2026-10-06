import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { createInstitutionExcelImportRepositoryV1 } from '@/modules/institution-import/server/institution-excel-import-repository';
import type { TenantDatabase } from '@/server/db/client';
import { customers, institutionExcelImportBatches, institutionExcelImportRows } from '@/server/db/schema';

const scope = { tenantId: 'tenant-a', institutionId: 'institution-a', customerId: 'customer-1' };
const compile = (value: SQL) => { const { sql, params } = new PgDialect().sqlToQuery(value); return { sql, params }; };
function fixture(found = true) {
  const customer = { id: scope.customerId, updatedAt: new Date('2026-10-01T00:00:00Z') };
  const rows = [{ batchId: 'old-batch', rowNumber: 5, matchedBatchId: null, completedAt: null }];
  const query = () => {
    const limit = vi.fn(async (_value: number): Promise<unknown[]> => []);
    const orderBy = vi.fn((..._values: SQL[]) => ({ limit }));
    const where = vi.fn((_condition: SQL) => ({ limit, orderBy }));
    const leftJoin = vi.fn((_table: unknown, _condition: SQL) => ({ where }));
    const from = vi.fn((_table: unknown) => ({ where, leftJoin }));
    return { from, where, leftJoin, orderBy, limit };
  };
  const first = query(); first.limit.mockResolvedValue(found ? [customer] : []);
  const second = query(); second.limit.mockResolvedValue(rows);
  const select = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  const transaction = vi.fn(async (callback: (tx: { select: typeof select }) => Promise<unknown>) => callback({ select }));
  const outsideSelect = vi.fn(() => { throw new Error('读取绕过快照'); });
  return { database: { transaction, select: outsideSelect } as unknown as TenantDatabase, transaction, outsideSelect, select, first, second, customer, rows };
}

describe('客户来源元数据仓库', () => {
  it('同一只读快照内执行窄投影，完整客户范围与保留损坏关联的左连接', async () => {
    const db = fixture();
    await expect(createInstitutionExcelImportRepositoryV1(db.database).readCustomerSourceSnapshot(scope))
      .resolves.toEqual({ customer: db.customer, rows: db.rows });
    expect(db.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'repeatable read', accessMode: 'read only' });
    expect(db.outsideSelect).not.toHaveBeenCalled();
    expect(db.select.mock.calls[0][0]).toEqual({ id: customers.id, updatedAt: customers.updatedAt });
    expect(db.first.from).toHaveBeenCalledWith(customers);
    expect(compile(db.first.where.mock.calls[0][0])).toEqual({
      sql: '("customers"."tenant_id" = $1 and "customers"."institution_id" = $2 and "customers"."id" = $3)',
      params: ['tenant-a', 'institution-a', 'customer-1'],
    });
    expect(db.first.limit).toHaveBeenCalledWith(1);
    expect(db.second.from).toHaveBeenCalledWith(institutionExcelImportRows);
    expect(db.select.mock.calls[1][0]).toEqual({ batchId: institutionExcelImportRows.batchId, rowNumber: institutionExcelImportRows.rowNumber, matchedBatchId: institutionExcelImportBatches.id, completedAt: institutionExcelImportBatches.completedAt });
    expect(db.second.leftJoin.mock.calls[0][0]).toBe(institutionExcelImportBatches);
    expect(compile(db.second.leftJoin.mock.calls[0][1])).toEqual({
      sql: '("institution_excel_import_batches"."tenant_id" = $1 and "institution_excel_import_batches"."institution_id" = $2 and "institution_excel_import_batches"."id" = "institution_excel_import_rows"."batch_id")',
      params: ['tenant-a', 'institution-a'],
    });
    expect(compile(db.second.where.mock.calls[0][0])).toEqual({
      sql: '("institution_excel_import_rows"."tenant_id" = $1 and "institution_excel_import_rows"."institution_id" = $2 and "institution_excel_import_rows"."sheet_kind" = $3 and "institution_excel_import_rows"."canonical_record_id" = $4)',
      params: ['tenant-a', 'institution-a', 'customer', 'customer-1'],
    });
    expect(db.second.orderBy.mock.calls[0].map(compile)).toEqual([
      { sql: '"institution_excel_import_rows"."batch_id" asc', params: [] },
      { sql: '"institution_excel_import_rows"."row_number" asc', params: [] },
    ]);
    expect(db.second.limit).toHaveBeenCalledWith(2);
  });

  it('客户不存在或跨机构时不查询任何导入行', async () => {
    const db = fixture(false);
    await expect(createInstitutionExcelImportRepositoryV1(db.database).readCustomerSourceSnapshot(scope))
      .resolves.toEqual({ customer: null, rows: [] });
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.second.from).not.toHaveBeenCalled();
  });
});
