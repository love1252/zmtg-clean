import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import { projectFollowUpBusinessDate } from '@/modules/care/domain/follow-up-business-time';
import type { FormalFollowUpWorkbenchQueryV1 } from '@/modules/care/ports/formal-follow-up-store';
import { createFormalFollowUpRepositoryV1 } from '@/modules/care/server/formal-follow-up-repository';
import type { TenantDatabase } from '@/server/db/client';
import { careFormalFollowUpTasks } from '@/server/db/schema';

type TaskRow = typeof careFormalFollowUpTasks.$inferSelect;
const input: FormalFollowUpWorkbenchQueryV1 = {
  tenantId: 'tenant-a', institutionId: 'institution-a', actorId: 'staff-a', actorRole: 'consultant',
  businessDate: '2026-10-05', timeZone: 'Asia/Shanghai',
};

function row(index: number, changes: Partial<TaskRow> = {}): TaskRow {
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
    ...changes,
  };
}

function compile(value: SQL) { return new PgDialect().sqlToQuery(value); }

// 隔离数据传输模拟；另外编译实际 SQL，核验其过滤、参数、聚合及排序，未连接真实数据库。
function fixture(rows: TaskRow[], query = input, overrides: { summaries?: unknown[]; records?: TaskRow[] } = {}) {
  const management = query.actorRole === 'tenant_admin' || query.actorRole === 'tenant_operator';
  const visible = rows.filter((task) => task.tenantId === query.tenantId && task.institutionId === query.institutionId
    && (management || (task.assigneeKind === 'user' && task.assigneeUserId === query.actorId)
      || (task.assigneeKind === 'role_pool' && task.assigneeRole === query.actorRole)));
  const due = visible.filter((task) => task.state !== 'completed' && task.state !== 'cancelled')
    .map((task) => ({ task, date: projectFollowUpBusinessDate({
      instant: task.dueAt.toISOString(), timeZone: query.timeZone, operatingContextVersion: '1',
    })!.date }));
  const counts = {
    overdue: due.filter(({ date }) => date < query.businessDate).length,
    dueToday: due.filter(({ date }) => date === query.businessDate).length,
  };
  const candidates = due.filter(({ date }) => date <= query.businessDate).map(({ task }) => task)
    .sort((a, b) => Number(b.riskLevel === 'high') - Number(a.riskLevel === 'high')
      || a.dueAt.getTime() - b.dueAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const limit = vi.fn(async (maximum: number) => overrides.records ?? candidates.slice(0, maximum));
  const orderBy = vi.fn((..._values: SQL[]) => ({ limit }));
  const candidateWhere = vi.fn((_condition: SQL) => ({ orderBy }));
  const summaryWhere = vi.fn(async (_condition: SQL) => overrides.summaries ?? [counts]);
  const select = vi.fn((selection?: Record<string, unknown>) => ({
    from: vi.fn(() => ({ where: selection ? summaryWhere : candidateWhere })),
  }));
  const session = { select };
  const transaction = vi.fn(async (read: (value: typeof session) => Promise<unknown>, _config: unknown) => read(session));
  return { database: { transaction } as unknown as TenantDatabase, transaction, select, summaryWhere, candidateWhere, orderBy, limit };
}

describe('工作台随访全量统计仓库', () => {
  it('前101条终态不挤占今日待办，后段高风险仍进入候选，全量155条仅取6条', async () => {
    const rows = [
      ...Array.from({ length: 101 }, (_, i) => row(i, {
        state: i % 2 ? 'completed' : 'cancelled', dueAt: new Date('2026-10-01T00:00:00Z'),
      })),
      ...Array.from({ length: 155 }, (_, i) => row(101 + i, { riskLevel: i === 154 ? 'high' : 'none' })),
      row(300, { dueAt: new Date('2026-10-06T00:00:00Z') }),
    ];
    const db = fixture(rows);
    const result = await createFormalFollowUpRepositoryV1(db.database).queryWorkbenchVisible(input);
    expect(result.counts).toEqual({ overdue: 0, dueToday: 155 });
    expect(result.records.map(({ taskId }) => taskId)).toEqual([
      'task-0255', 'task-0101', 'task-0102', 'task-0103', 'task-0104', 'task-0105',
    ]);
    expect(db.limit).toHaveBeenCalledWith(6);
    expect(db.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'repeatable read', accessMode: 'read only',
    });
    const selection = db.select.mock.calls[0]![0]!;
    for (const [key, comparison] of [['overdue', '<'], ['dueToday', '=']] as const) {
      const expression = compile(selection[key] as SQL);
      expect(expression.sql).toBe(`count(*) filter (where "care_formal_follow_up_tasks"."state" not in ('completed', 'cancelled') and ("care_formal_follow_up_tasks"."due_at" at time zone $1)::date ${comparison} $2::date)`);
      expect(expression.params).toEqual(['Asia/Shanghai', '2026-10-05']);
    }
    const where = compile(db.candidateWhere.mock.calls[0]![0]);
    expect(where.sql).toContain("not in ('completed', 'cancelled')");
    expect(where.sql).toContain('::date <');
    expect(where.sql).toContain('::date =');
    expect(where.params).toContain('Asia/Shanghai');
    expect(where.params).toContain('2026-10-05');
    expect(db.orderBy.mock.calls[0]!.map((value) => compile(value).sql)).toEqual([
      'case when "care_formal_follow_up_tasks"."risk_level" = \'high\' then 0 else 1 end asc',
      '"care_formal_follow_up_tasks"."due_at" asc',
      '"care_formal_follow_up_tasks"."id" collate "C" asc',
    ]);
  });

  it.each(['tenant_admin', 'tenant_operator', 'consultant', 'customer_service'] as const)(
    '%s 的统计和候选共享租户、机构及人员/角色池可见范围', async (actorRole) => {
      const query = { ...input, actorRole };
      const db = fixture([
        row(1), row(2, { tenantId: 'foreign' }), row(3, { institutionId: 'foreign' }),
        row(4, { assigneeUserId: 'other-staff' }),
        row(5, { assigneeKind: 'role_pool', assigneeUserId: null, assigneeRole: actorRole === 'customer_service' ? 'customer_service' : 'consultant' }),
      ], query);
      const result = await createFormalFollowUpRepositoryV1(db.database).queryWorkbenchVisible(query);
      const management = actorRole === 'tenant_admin' || actorRole === 'tenant_operator';
      expect(result.counts.dueToday).toBe(management ? 3 : 2);
      expect(result.records).toHaveLength(management ? 3 : 2);
      const summary = compile(db.summaryWhere.mock.calls[0]![0]);
      const candidates = compile(db.candidateWhere.mock.calls[0]![0]);
      const table = '"care_formal_follow_up_tasks"';
      const institutionScope = `(${table}."tenant_id" = $1 and ${table}."institution_id" = $2)`;
      const memberScope = `((${table}."assignee_kind" = $3 and ${table}."assignee_user_id" = $4) or (${table}."assignee_kind" = $5 and ${table}."assignee_role" = $6))`;
      const expectedScope = management ? institutionScope : `(${institutionScope} and ${memberScope})`;
      // 锁定权限布尔关系，AND→OR 或括号丢失必须失败，不能仅检查参数存在。
      expect(summary.sql).toBe(expectedScope);
      const scopeParams = management ? ['tenant-a', 'institution-a'] : ['tenant-a', 'institution-a', 'user', 'staff-a', 'role_pool', actorRole];
      expect(summary.params).toEqual(scopeParams);
      const p = scopeParams.length + 1;
      const active = `${table}."state" not in ('completed', 'cancelled')`;
      expect(candidates.sql).toBe(`(${expectedScope} and (${active} and (${table}."due_at" at time zone $${p})::date < $${p + 1}::date or ${active} and (${table}."due_at" at time zone $${p + 2})::date = $${p + 3}::date))`);
      expect(candidates.params).toEqual([...scopeParams, 'Asia/Shanghai', '2026-10-05', 'Asia/Shanghai', '2026-10-05']);
    },
  );

  it('高风险今日优先于普通逾期，同风险和时间按ASCII ID稳定排列', async () => {
    const db = fixture([
      row(1, { id: 'b', riskLevel: 'high' }), row(2, { id: 'a', riskLevel: 'high' }),
      row(3, { id: 'A', riskLevel: 'high' }), row(4, { dueAt: new Date('2026-10-04T00:00:00Z') }),
    ]);
    const result = await createFormalFollowUpRepositoryV1(db.database).queryWorkbenchVisible(input);
    expect(result.records.map(({ taskId }) => taskId)).toEqual(['A', 'a', 'b', 'task-0004']);
    expect(result.counts).toEqual({ overdue: 1, dueToday: 3 });
  });

  it.each([0, 5, 155])('可信计数%s条，候选为min(6,计数)', async (size) => {
    const db = fixture(Array.from({ length: size }, (_, i) => row(i)));
    const result = await createFormalFollowUpRepositoryV1(db.database).queryWorkbenchVisible(input);
    expect(result.counts).toEqual({ overdue: 0, dueToday: size });
    expect(result.records).toHaveLength(Math.min(6, size));
  });

  it.each([
    ['Asia/Shanghai', '2026-10-05', 0, 1], ['America/New_York', '2026-10-04', 0, 1],
  ])('%s按机构业务日%s统计，不用浏览器或数据库默认时区', async (timeZone, businessDate, overdue, dueToday) => {
    const query = { ...input, timeZone, businessDate };
    const db = fixture([row(1, { dueAt: new Date('2026-10-04T16:00:00Z') })], query);
    expect((await createFormalFollowUpRepositoryV1(db.database).queryWorkbenchVisible(query)).counts)
      .toEqual({ overdue, dueToday });
    expect(compile(db.select.mock.calls[0]![0]!.dueToday as SQL).params).toEqual([timeZone, businessDate]);
  });

  it.each([
    { summaries: [] }, { summaries: [{ overdue: -1, dueToday: 0 }] },
    { summaries: [{ overdue: 0, dueToday: 0.5 }] },
    { summaries: [{ overdue: Number.MAX_SAFE_INTEGER, dueToday: 1 }] },
    { summaries: [{ overdue: 0, dueToday: 0 }, { overdue: 0, dueToday: 0 }] },
  ])('损坏聚合%o在读取候选前拒绝', async ({ summaries }) => {
    const db = fixture([], input, { summaries });
    await expect(createFormalFollowUpRepositoryV1(db.database).queryWorkbenchVisible(input))
      .rejects.toThrow('invalid_follow_up_workbench_summary');
    expect(db.candidateWhere).not.toHaveBeenCalled();
  });

  it.each([[0, 1], [5, 4], [155, 5], [155, 7]])('统计%s条但候选%s条时拒绝矛盾快照', async (total, returned) => {
    const db = fixture([], input, {
      summaries: [{ overdue: 0, dueToday: total }], records: Array.from({ length: returned }, (_, i) => row(i)),
    });
    await expect(createFormalFollowUpRepositoryV1(db.database).queryWorkbenchVisible(input))
      .rejects.toThrow('invalid_follow_up_workbench_candidates');
  });
});
