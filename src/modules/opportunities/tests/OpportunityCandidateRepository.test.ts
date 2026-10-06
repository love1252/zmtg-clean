import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { createOpportunityCandidateRepository } from '@/modules/opportunities/server/opportunity-candidate-repository';
import type { OpportunityQuery } from '@/modules/opportunities/domain/opportunity-candidate';
import type { TenantDatabase } from '@/server/db/client';
import { customers } from '@/server/db/schema';

const compile = (value: SQL) => { const { sql, params } = new PgDialect().sqlToQuery(value); return { sql, params }; };
function fixture() {
  const offset = vi.fn(async (_value: number) => []);
  const limit = vi.fn((_value: number) => ({ offset }));
  const orderBy = vi.fn((..._values: SQL[]) => ({ limit }));
  const listWhere = vi.fn((_value: SQL) => ({ orderBy }));
  const countWhere = vi.fn(async (_value: SQL) => [{ total: 155 }]);
  const countFrom = vi.fn((_table: unknown) => ({ where: countWhere }));
  const listFrom = vi.fn((_table: unknown) => ({ where: listWhere }));
  const select = vi.fn().mockReturnValueOnce({ from: countFrom }).mockReturnValueOnce({ from: listFrom });
  const transaction = vi.fn(async (fn: (tx: { select: typeof select }) => Promise<unknown>) => fn({ select }));
  const outsideSelect = vi.fn(() => { throw new Error('禁止快照外读取'); });
  return { db: { transaction, select: outsideSelect } as unknown as TenantDatabase, select, transaction, outsideSelect, countFrom, listFrom, countWhere, listWhere, orderBy, limit, offset };
}
describe('机会候选服务端统一查询', () => {
  it.each(['all', 'repurchase'] as const)('%s同一只读快照的count和分页包含完整范围，统一稳定排序', async type => {
    const f = fixture(); const query: OpportunityQuery = { page: 6, pageSize: 20, type, priority: 'high' };
    expect(await createOpportunityCandidateRepository(f.db).read({ tenantId: 'tenant-a', institutionId: 'institution-a', query }))
      .toEqual({ total: 155, rows: [] });
    expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'repeatable read', accessMode: 'read only' });
    expect(f.outsideSelect).not.toHaveBeenCalled();
    expect(f.countFrom).toHaveBeenCalledWith(customers); expect(f.listFrom).toHaveBeenCalledWith(customers);
    const conditions = compile(f.countWhere.mock.calls[0][0]);
    expect(conditions).toEqual(type === 'all' ? {
      sql: '("customers"."tenant_id" = $1 and "customers"."institution_id" = $2 and "customers"."lifecycle" in ($3, $4, $5) and "customers"."priority" = $6)',
      params: ['tenant-a', 'institution-a', 'post_care', 'repurchase_window', 'silent_reactivation', 'high'],
    } : {
      sql: '("customers"."tenant_id" = $1 and "customers"."institution_id" = $2 and "customers"."lifecycle" in ($3) and "customers"."priority" = $4)',
      params: ['tenant-a', 'institution-a', 'repurchase_window', 'high'],
    });
    expect(compile(f.listWhere.mock.calls[0][0])).toEqual(conditions);
    expect(f.select.mock.calls[1][0]).toEqual({ tenantId: customers.tenantId, institutionId: customers.institutionId, customerId: customers.id, displayName: customers.displayName, lifecycle: customers.lifecycle, priority: customers.priority, updatedAt: customers.updatedAt });
    expect(f.orderBy.mock.calls[0].map(compile)).toEqual([
      { sql: '"customers"."updated_at" desc', params: [] },
      { sql: '"customers"."id" COLLATE "C" asc', params: [] },
    ]);
    expect(f.limit).toHaveBeenCalledWith(20); expect(f.offset).toHaveBeenCalledWith(100);
  });
});
