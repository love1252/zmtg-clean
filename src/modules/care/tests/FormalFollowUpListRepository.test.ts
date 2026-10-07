import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import { parseFormalFollowUpListQueryV1 } from '@/modules/care/application/formal-follow-up-list-query';
import type { FormalFollowUpPageQueryV1 } from '@/modules/care/ports/formal-follow-up-store';
import { createFormalFollowUpRepositoryV1 } from '@/modules/care/server/formal-follow-up-repository';
import type { TenantDatabase } from '@/server/db/client';
import { careFormalFollowUpTasks } from '@/server/db/schema';

type TaskRow = typeof careFormalFollowUpTasks.$inferSelect;
const input: FormalFollowUpPageQueryV1 = {
  tenantId: 'tenant-a', institutionId: 'institution-a', actorId: 'staff-a', actorRole: 'consultant',
  query: parseFormalFollowUpListQueryV1(new URLSearchParams())!,
  businessDate: '2026-10-05', timeZone: 'Asia/Shanghai',
};

function row(index: number): TaskRow {
  return {
    tenantId: 'tenant-a', institutionId: 'institution-a', id: `task-${String(index).padStart(4, '0')}`,
    customerId: `customer-${index}`, customerDisplayName: '演示客户', customerMaskedReference: '***001',
    stageCode: 'manual_followup', actionCode: 'manual_contact', dueAt: new Date('2026-10-05T00:00:00Z'),
    state: 'pending', revision: 1, riskLevel: 'none', riskKind: null, riskEventId: null,
    completionCode: null, completionFeedback: null, cancellationReason: null,
    assigneeKind: 'user', assigneeUserId: 'staff-a', assigneeDisplayName: '员工甲', assigneeRole: null,
    claimedFromRolePool: null, idempotencyKey: `idem-${index}`, requestDigest: 'digest',
    sourceKind: 'manual_controlled_create', createdBy: 'admin-a', updatedBy: 'admin-a',
    createdAt: new Date('2026-10-01T00:00:00Z'), updatedAt: new Date('2026-10-01T00:00:00Z'),
  };
}

// 仅模拟数据库传输。真实 Drizzle 谓词、参数和排序另外编译校验，不接触数据库。
function databaseFixture(
  rows: TaskRow[],
  counts: unknown[] = [{ state: 'pending', total: rows.length, overdue: 0, due_today: rows.length, not_due: 0 }],
) {
  const offset = vi.fn(async (value: number) => rows.slice(value, value + pageSize));
  let pageSize = 0;
  const limit = vi.fn((value: number) => { pageSize = value; return { offset }; });
  const orderBy = vi.fn((..._values: SQL[]) => ({ limit }));
  const pageWhere = vi.fn((_condition: SQL) => ({ orderBy }));
  const groupBy = vi.fn(async () => counts);
  const summaryWhere = vi.fn((_condition: SQL) => ({ groupBy }));
  const select = vi.fn((selection?: Record<string, unknown>) => ({
    from: vi.fn(() => ({ where: selection ? summaryWhere : pageWhere })),
  }));
  const session = { select };
  const transaction = vi.fn(async (read: (value: typeof session) => Promise<unknown>, _config: unknown) => read(session));
  return {
    database: { transaction } as unknown as TenantDatabase,
    transaction, select, summaryWhere, pageWhere, orderBy, limit, offset, groupBy,
  };
}

function compile(condition: SQL) {
  return new PgDialect().sqlToQuery(condition);
}

describe('正式随访分页仓库', () => {
  it('155 条记录可越过第 100 条，统计不随页数改变且使用同一只读快照', async () => {
    const rows = Array.from({ length: 155 }, (_, index) => row(index));
    const database = databaseFixture(rows);
    const repository = createFormalFollowUpRepositoryV1(database.database);
    const first = await repository.queryVisible(input);
    const second = await repository.queryVisible({ ...input, query: { ...input.query, page: 2 } });
    expect(first.records).toHaveLength(100);
    expect(second.records).toHaveLength(55);
    expect(second.records[0]?.taskId).toBe('task-0100');
    expect(new Set([...first.records, ...second.records].map((item) => item.taskId)).size).toBe(155);
    expect(first.summary).toEqual(second.summary);
    expect(second.summary).toMatchObject({ total: 155, stateCounts: { pending: 155 }, dueBucketCounts: { due_today: 155 } });
    expect(database.offset.mock.calls).toEqual([[0], [100]]);
    expect(database.limit).toHaveBeenCalledWith(100);
    expect(database.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'repeatable read', accessMode: 'read only',
    });
    expect(database.summaryWhere.mock.calls[0]?.[0]).toBe(database.pageWhere.mock.calls[0]?.[0]);
    expect(database.groupBy).toHaveBeenCalledWith(careFormalFollowUpTasks.state);
    expect(compile(database.select.mock.calls[0]![0]!.total as SQL).sql).toBe('count(*)');
    const sorting = database.orderBy.mock.calls[0]!.map((value) => compile(value).sql);
    expect(sorting).toEqual(['"care_formal_follow_up_tasks"."due_at" asc', '"care_formal_follow_up_tasks"."id" asc']);
  });

  it.each(['tenant_admin', 'tenant_operator', 'consultant', 'customer_service'] as const)(
    '%s 的列表与统计均使用机构、租户及相同的成员可见性', async (actorRole) => {
      const database = databaseFixture([row(1)]);
      await createFormalFollowUpRepositoryV1(database.database).queryVisible({ ...input, actorRole });
      const where = compile(database.pageWhere.mock.calls[0]![0]);
      expect(where.sql).toContain('"tenant_id" =');
      expect(where.sql).toContain('"institution_id" =');
      expect(where.params.slice(0, 2)).toEqual(['tenant-a', 'institution-a']);
      if (actorRole === 'tenant_admin' || actorRole === 'tenant_operator') {
        expect(where.sql).not.toContain('"assignee_user_id"');
      } else {
        expect(where.sql).toContain('"assignee_user_id" =');
        expect(where.sql).toContain(' or ');
        expect(where.sql).toContain('"assignee_role" =');
        expect(where.params.slice(2)).toEqual(['user', 'staff-a', 'role_pool', actorRole]);
      }
      expect(database.summaryWhere.mock.calls[0]?.[0]).toBe(database.pageWhere.mock.calls[0]?.[0]);
    },
  );

  it('状态、到期桶及低敏关键词联合过滤；通配符转义且统计不放宽范围', async () => {
    const database = databaseFixture([{ ...row(1), state: 'escalated' }], [
      { state: 'escalated', total: 1, overdue: 1, due_today: 0, not_due: 0 },
    ]);
    await createFormalFollowUpRepositoryV1(database.database).queryVisible({
      ...input, query: { ...input.query, state: 'escalated', dueBucket: 'overdue', keyword: '客户_50%\\' },
    });
    const where = compile(database.pageWhere.mock.calls[0]![0]);
    expect(where.sql).toContain('"state" =');
    expect(where.sql).toContain("not in ('completed', 'cancelled')");
    expect(where.sql).toContain(' at time zone ');
    expect(where.sql).toContain('::date <');
    expect(where.sql).toContain('"customer_display_name" ilike');
    expect(where.sql).toContain('"customer_masked_reference" ilike');
    expect(where.params).toContain('escalated');
    expect(where.params).toContain('Asia/Shanghai');
    expect(where.params).toContain('2026-10-05');
    expect(where.params.filter((value) => value === '%客户\\_50\\%\\\\%')).toHaveLength(2);
    expect(database.summaryWhere.mock.calls[0]?.[0]).toBe(database.pageWhere.mock.calls[0]?.[0]);
  });

  it('到期统计排除终态；SQL 与业务日期按同一机构时区分桶', async () => {
    const database = databaseFixture([row(1), row(2), row(3)], [
      { state: 'escalated', total: 1, overdue: 1, due_today: 0, not_due: 0 },
      { state: 'completed', total: 1, overdue: 0, due_today: 0, not_due: 0 },
      { state: 'cancelled', total: 1, overdue: 0, due_today: 0, not_due: 0 },
    ]);
    const result = await createFormalFollowUpRepositoryV1(database.database).queryVisible(input);
    expect(result.summary).toMatchObject({
      total: 3, dueBucketCounts: { overdue: 1, due_today: 0, not_due: 0 },
    });
    const selection = database.select.mock.calls[0]![0]!;
    for (const [key, operator] of [['overdue', '<'], ['due_today', '='], ['not_due', '>']]) {
      const expression = compile(selection[key!] as SQL);
      expect(expression.sql).toContain('count(*) filter (where ');
      expect(expression.sql).toContain("not in ('completed', 'cancelled')");
      expect(expression.sql).toContain(`::date ${operator}`);
      expect(expression.params).toEqual(['Asia/Shanghai', '2026-10-05']);
    }
  });

  it.each([0, 155])('空集或超末页返回空列表，保留真实总数 %s', async (total) => {
    const database = databaseFixture([], total ? [{ state: 'pending', total, overdue: 0, due_today: total, not_due: 0 }] : []);
    const result = await createFormalFollowUpRepositoryV1(database.database).queryVisible({
      ...input, query: { ...input.query, page: 9999 },
    });
    expect(result.records).toEqual([]);
    expect(result.summary.total).toBe(total);
    expect(database.pageWhere).not.toHaveBeenCalled();
  });

  it('缺时区时基础统计可用，到期统计明确为 null；到期过滤不能降级', async () => {
    const database = databaseFixture([row(1)], [{ state: 'pending', total: 1, overdue: null, due_today: null, not_due: null }]);
    const repository = createFormalFollowUpRepositoryV1(database.database);
    const query = { ...input, timeZone: null, businessDate: null };
    expect((await repository.queryVisible(query)).summary.dueBucketCounts).toBeNull();
    database.transaction.mockClear();
    await expect(repository.queryVisible({ ...query, query: { ...input.query, dueBucket: 'overdue' } }))
      .rejects.toThrow('follow_up_time_zone_unavailable');
    expect(database.transaction).not.toHaveBeenCalled();
  });

  it.each([
    [{ state: 'pending', total: -1, overdue: 0, due_today: 0, not_due: 0 }],
    [{ state: 'other', total: 1, overdue: 0, due_today: 1, not_due: 0 }],
    [{ state: 'completed', total: 1, overdue: 1, due_today: 0, not_due: 0 }],
    [{ state: 'pending', total: 1, overdue: 0, due_today: 0, not_due: 0 }],
  ])('损坏的聚合结果使读取失败，不伪造空数据：%o', async (summary) => {
    const database = databaseFixture([row(1)], [summary]);
    await expect(createFormalFollowUpRepositoryV1(database.database).queryVisible(input))
      .rejects.toThrow('invalid_follow_up_summary');
  });

  it.each([[2, 1], [1, 2]])('统计 %s 条但读取 %s 条时不接受不一致分页', async (total, returned) => {
    const database = databaseFixture(Array.from({ length: returned }, (_, index) => row(index)), [
      { state: 'pending', total, overdue: 0, due_today: total, not_due: 0 },
    ]);
    await expect(createFormalFollowUpRepositoryV1(database.database).queryVisible(input))
      .rejects.toThrow('invalid_follow_up_page');
  });
});


it('精确 customerId 与机构、成员范围共用列表及统计谓词，两个同名客户不混查', async () => {
  const db = databaseFixture([row(1)]);
  const repo = createFormalFollowUpRepositoryV1(db.database);
  for (const customerId of ['customer-a', 'customer-b']) {
    await repo.queryVisible({ ...input, customerId });
    const where = compile(db.pageWhere.mock.calls.at(-1)![0]);
    expect(where.sql).toContain('"customer_id" =');
    expect(where.params).toContain(customerId);
    expect(where.params).toContain('tenant-a');
    expect(where.params).toContain('institution-a');
    expect(where.params).toContain('staff-a');
    expect(where.sql).not.toContain('ilike');
    expect(db.summaryWhere.mock.calls.at(-1)?.[0]).toBe(db.pageWhere.mock.calls.at(-1)?.[0]);
  }
});
