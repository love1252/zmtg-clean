import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorization: vi.fn(), consume: vi.fn(), capability: vi.fn(), database: vi.fn(),
  repository: vi.fn(), query: vi.fn(), context: vi.fn(), customerAuthorization: vi.fn(), customer: vi.fn(), getVisible: vi.fn(),
}));
vi.mock('@/server/orchestration/institution-care-write-authorization', () => ({
  resolveInstitutionCareWriteAuthorizationV1: mocks.authorization,
  consumeInstitutionCareWriteAuthorizationV1: mocks.consume,
}));
vi.mock('@/server/orchestration/institution-capability-authority', () => ({
  resolveInstitutionCapabilityAuthorityStatusV1: mocks.capability,
}));
vi.mock('@/server/db/client', () => ({ getDatabase: mocks.database }));
vi.mock('@/modules/care/server/formal-follow-up-repository', () => ({
  createFormalFollowUpRepositoryV1: mocks.repository,
}));
vi.mock('@/modules/institution/server/institution-operating-context-reader', () => ({
  readInstitutionOperatingContextForCareV1: mocks.context,
}));

vi.mock('@/server/orchestration/institution-customer-controlled-write-runtime', () => ({ authorizeInstitutionCustomerControlledWriteV1: mocks.customerAuthorization }));
vi.mock('@/modules/customer-center/server/customer-reference-repository', () => ({ createCustomerReferenceRepositoryV1: () => ({ resolve: mocks.customer }) }));

import type { FormalFollowUpPageQueryV1, FormalFollowUpTaskRecordV1 } from '@/modules/care/ports/formal-follow-up-store';
import { readCurrentInstitutionFormalFollowUpsV1, readCurrentInstitutionCustomerFormalFollowUpsV1, readCurrentInstitutionFormalFollowUpV1 } from '@/server/orchestration/institution-formal-follow-up-runtime';

const actor = {
  tenantId: 'tenant-a', institutionId: 'institution-a', accountId: 'staff-a', role: 'consultant',
};
const capability = {
  contractVersion: 'v1', scope: { tenantId: 'tenant-a', institutionId: 'institution-a' },
  readiness: 'ready', failureCode: null,
  data: { capabilities: [{
    key: 'page_care_followups', decision: 'operational', safeSummary: '随访任务可用',
    dimensions: {
      codeMaturity: 'verified', institutionAuthorization: 'authorized', connectionAvailability: 'not_required',
      dataReadiness: 'ready', productionRelease: 'pilot_released',
    },
  }] },
  partitions: [{ key: 'page_care_followups', readiness: 'ready', failureCode: null }],
};
const records: FormalFollowUpTaskRecordV1[] = Array.from({ length: 155 }, (_, index) => ({
  tenantId: 'tenant-a', institutionId: 'institution-a', taskId: `task-${index}`, customerId: `customer-${index}`,
  customerDisplayName: `客户${index}`, customerMaskedReference: '***001',
  stageCode: 'manual_followup', actionCode: 'manual_contact', dueAt: '2026-10-05T00:00:00.000Z',
  state: 'pending', revision: 1, riskLevel: 'none', riskKind: null, riskEventId: null,
  completionCode: null, completionFeedback: '内部低敏摘要', cancellationReason: null,
  assignment: { kind: 'user', userId: 'staff-a', displayName: '员工甲', claimedFromRolePool: null },
  idempotencyKey: `private-key-${index}`, requestDigest: 'private-digest', createdBy: 'admin-a', updatedBy: 'admin-a',
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-04T16:00:00.000Z'));
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.authorization.mockResolvedValue({ kind: 'allowed', authorization: {} });
  mocks.consume.mockReturnValue(actor);
  mocks.capability.mockResolvedValue(capability);
  mocks.database.mockReturnValue({ database: 'isolated-mock' });
  mocks.repository.mockReturnValue({ queryVisible: mocks.query, getVisible: mocks.getVisible });
  mocks.customerAuthorization.mockResolvedValue({ kind: 'allowed', actor });
  mocks.customer.mockResolvedValue({ customerId: 'customer-a' });
  mocks.context.mockResolvedValue({ timeZone: 'Asia/Shanghai', version: '1' });
  mocks.query.mockImplementation(async (input: FormalFollowUpPageQueryV1) => {
    const offset = (input.query.page - 1) * input.query.pageSize;
    return {
      records: records.slice(offset, offset + input.query.pageSize),
      summary: {
        total: 155,
        stateCounts: { pending: 155, in_progress: 0, waiting_customer: 0, escalated: 0, completed: 0, cancelled: 0 },
        dueBucketCounts: input.timeZone ? { overdue: 0, due_today: 155, not_due: 0 } : null,
      },
    };
  });
});
afterEach(() => vi.useRealTimers());

describe('正式随访分页编排', () => {
  it('无参保持原 100 条与 hasMore，并添加全部 155 条统计', async () => {
    const result = await readCurrentInstitutionFormalFollowUpsV1();
    expect(result).toMatchObject({
      kind: 'ready', canCreate: false, hasMore: true,
      pageInfo: { page: 1, pageSize: 100, total: 155, pageCount: 2, hasMore: true },
      summary: { total: 155, stateCounts: { pending: 155 } },
      timeZone: 'Asia/Shanghai', operatingContextVersion: '1', observedAt: '2026-10-04T16:00:00.000Z',
    });
    if (result.kind !== 'ready') throw new Error('预期读取成功');
    expect(result.records).toHaveLength(100);
    expect(result.records[0]?.permissions.canOperate).toBe(true);
    const serialized = JSON.stringify(result);
    for (const privateField of ['tenantId', 'institutionId', 'requestDigest', 'idempotencyKey', 'completionFeedback', '内部低敏摘要', 'userId']) {
      expect(serialized).not.toContain(privateField);
    }
  });

  it('后续页读取第 101 条之后的任务；最后一页及超末页元数据准确', async () => {
    const seen: string[] = [];
    for (let page = 1; page <= 9; page += 1) {
      const result = await readCurrentInstitutionFormalFollowUpsV1(new URLSearchParams(`page=${page}&pageSize=20`));
      if (result.kind !== 'ready') throw new Error('预期读取成功');
      expect(result.summary.total).toBe(155);
      expect(result.pageInfo.pageCount).toBe(8);
      expect(result.hasMore).toBe(page < 8);
      seen.push(...result.records.map((record) => record.taskId));
      if (page === 6) expect(result.records[0]?.taskId).toBe('task-100');
      if (page === 8) expect(result.records).toHaveLength(15);
      if (page === 9) expect(result.records).toEqual([]);
    }
    expect(seen).toHaveLength(155);
    expect(new Set(seen).size).toBe(155);
  });

  it('筛选不改变服务端授权范围，并使用机构业务日传入仓库', async () => {
    await readCurrentInstitutionFormalFollowUpsV1(new URLSearchParams('state=escalated&dueBucket=overdue&q=客户120'));
    expect(mocks.query).toHaveBeenCalledWith({
      tenantId: 'tenant-a', institutionId: 'institution-a', actorId: 'staff-a', actorRole: 'consultant',
      query: { page: 1, pageSize: 100, state: 'escalated', dueBucket: 'overdue', keyword: '客户120' },
      businessDate: '2026-10-05', timeZone: 'Asia/Shanghai',
    });
    expect(mocks.context).toHaveBeenCalledWith({ database: 'isolated-mock' }, {
      tenantId: 'tenant-a', institutionId: 'institution-a',
    });
  });

  it.each([
    ['2026-10-04T15:59:59.999Z', '2026-10-04'],
    ['2026-10-04T16:00:00.000Z', '2026-10-05'],
    ['2026-12-31T15:59:59.999Z', '2026-12-31'],
    ['2026-12-31T16:00:00.000Z', '2027-01-01'],
  ])('上海机构时区在 %s 派生 %s，不依赖浏览器日期', async (instant, date) => {
    vi.setSystemTime(new Date(instant));
    await readCurrentInstitutionFormalFollowUpsV1(new URLSearchParams('dueBucket=due_today'));
    expect(mocks.query.mock.calls[0]?.[0].businessDate).toBe(date);
  });

  it('使用可信机构配置的时区，不写死上海时区', async () => {
    mocks.context.mockResolvedValue({ timeZone: 'America/New_York', version: '2' });
    const result = await readCurrentInstitutionFormalFollowUpsV1();
    expect(mocks.query.mock.calls[0]?.[0]).toMatchObject({ businessDate: '2026-10-04', timeZone: 'America/New_York' });
    expect(result).toMatchObject({ timeZone: 'America/New_York', operatingContextVersion: '2' });
  });

  it.each([null, { timeZone: 'invalid/zone', version: '1' }])('缺少可信时区 %o 不伪造到期统计，也不破坏无参调用', async (context) => {
    mocks.context.mockResolvedValue(context);
    expect(await readCurrentInstitutionFormalFollowUpsV1()).toMatchObject({
      kind: 'ready', timeZone: null, operatingContextVersion: null, summary: { dueBucketCounts: null, total: 155 },
    });
    mocks.query.mockClear();
    expect(await readCurrentInstitutionFormalFollowUpsV1(new URLSearchParams('dueBucket=overdue')))
      .toEqual({ kind: 'unavailable' });
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each(['tenant_admin', 'tenant_operator', 'consultant', 'customer_service'] as const)(
    '保留 %s 的角色与创建权限', async (role) => {
      mocks.consume.mockReturnValue({ ...actor, role });
      expect(await readCurrentInstitutionFormalFollowUpsV1()).toMatchObject({
        kind: 'ready', canCreate: role === 'tenant_admin' || role === 'tenant_operator',
      });
      expect(mocks.query.mock.calls[0]?.[0].actorRole).toBe(role);
    },
  );

  it.each(['forbidden', 'unavailable'])('授权 %s 时不访问数据库', async (kind) => {
    mocks.authorization.mockResolvedValue({ kind });
    expect(await readCurrentInstitutionFormalFollowUpsV1()).toEqual({ kind });
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it('能力机构错配或无效授权句柄时不访问数据库', async () => {
    mocks.capability.mockResolvedValue({ ...capability, scope: { tenantId: 'other', institutionId: 'institution-a' } });
    expect(await readCurrentInstitutionFormalFollowUpsV1()).toEqual({ kind: 'unavailable' });
    expect(mocks.database).not.toHaveBeenCalled();
    mocks.consume.mockReturnValue(null);
    expect(await readCurrentInstitutionFormalFollowUpsV1()).toEqual({ kind: 'unavailable' });
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it('非法查询在权限解析前拒绝；仓库故障不回退为零', async () => {
    expect(await readCurrentInstitutionFormalFollowUpsV1(new URLSearchParams('institutionId=other')))
      .toEqual({ kind: 'invalid_query' });
    expect(mocks.authorization).not.toHaveBeenCalled();
    mocks.query.mockRejectedValue(new Error('内部数据库信息'));
    expect(await readCurrentInstitutionFormalFollowUpsV1()).toEqual({ kind: 'unavailable' });
  });

  it('仓库返回其他机构记录时失败关闭', async () => {
    mocks.query.mockResolvedValue({ records: [{ ...records[0], institutionId: 'other' }], summary: { total: 1 } });
    expect(await readCurrentInstitutionFormalFollowUpsV1()).toEqual({ kind: 'unavailable' });
  });
});


describe('客户精确关联随访与完成摘要回显', () => {
  it('155 条客户任务完整分页，客户范围不依赖机构前 100 条或名称匹配', async () => {
    const fixtures = [
      ...Array.from({ length: 155 }, (_, index) => ({ ...records[index], customerId: 'customer-a', customerDisplayName: '同名客户', state: 'completed', completionCode: 'contact_completed', completionFeedback: '已告知后续安排' })),
      { ...records[0], taskId: 'other-customer-task', customerId: 'customer-b', customerDisplayName: '同名客户' },
    ];
    mocks.query.mockImplementation(async (input: FormalFollowUpPageQueryV1) => {
      const visible = fixtures.filter(record => record.customerId === input.customerId);
      const offset = (input.query.page - 1) * input.query.pageSize;
      return { records: visible.slice(offset, offset + input.query.pageSize), summary: { total: visible.length } };
    });
    const first = await readCurrentInstitutionCustomerFormalFollowUpsV1('customer-a');
    const second = await readCurrentInstitutionCustomerFormalFollowUpsV1('customer-a', new URLSearchParams('page=2'));
    expect(first).toMatchObject({ kind: 'ready', customerId: 'customer-a', canCreate: false, pageInfo: { total: 155, pageCount: 2 } });
    expect(second).toMatchObject({ kind: 'ready', pageInfo: { page: 2, total: 155, hasMore: false } });
    if (first.kind !== 'ready' || second.kind !== 'ready') throw new Error('预期读取成功');
    expect(first.records).toHaveLength(100);
    expect(second.records).toHaveLength(55);
    expect(new Set([...first.records, ...second.records].map(record => record.taskId)).size).toBe(155);
    expect(first.records[0]?.completionFeedback).toEqual({ kind: 'manual_low_sensitivity', summary: '已告知后续安排' });
    expect(JSON.stringify([first, second])).not.toContain('other-customer-task');
    expect(mocks.customer).toHaveBeenCalledWith({ tenantId: 'tenant-a', institutionId: 'institution-a', customerId: 'customer-a' });
    expect(mocks.query.mock.calls[0]?.[0]).toMatchObject({ actorId: 'staff-a', customerId: 'customer-a' });
  });
  it.each(['customerId=other', 'tenantId=other', 'q=a&q=b'])('拒绝通过参数扩大客户范围 %s', async query => {
    expect(await readCurrentInstitutionCustomerFormalFollowUpsV1('customer-a', new URLSearchParams(query))).toEqual({ kind: 'invalid_query' });
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('客户不可见时不读取任务；身份错配不复用另一账号权限', async () => {
    mocks.customer.mockResolvedValue(null);
    expect(await readCurrentInstitutionCustomerFormalFollowUpsV1('customer-a')).toEqual({ kind: 'not_found' });
    expect(mocks.query).not.toHaveBeenCalled();
    mocks.customerAuthorization.mockResolvedValue({ kind: 'allowed', actor: { ...actor, institutionId: 'other' } });
    expect(await readCurrentInstitutionCustomerFormalFollowUpsV1('customer-a')).toEqual({ kind: 'forbidden' });
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('仓库返回同机构另一客户的记录时失败关闭', async () => {
    expect(await readCurrentInstitutionCustomerFormalFollowUpsV1('customer-a')).toEqual({ kind: 'unavailable' });
  });
  it.each(['手机号 13800138000', '病历已经填写', 'a'.repeat(241)])('历史摘要仍通过低敏校验：%s', async summary => {
    mocks.getVisible.mockResolvedValue({ ...records[0], state: 'completed', completionCode: 'contact_completed', completionFeedback: summary });
    const result = await readCurrentInstitutionFormalFollowUpV1('task-0');
    expect(result).toMatchObject({ kind: 'ready', record: { completionCode: 'contact_completed', completionFeedback: null } });
    expect(JSON.stringify(result)).not.toContain(summary);
  });
  it('详情回显合法摘要但不暴露任务内部标识', async () => {
    mocks.getVisible.mockResolvedValue({ ...records[0], state: 'completed', completionCode: 'customer_declined', completionFeedback: '暂不需要联系' });
    const result = await readCurrentInstitutionFormalFollowUpV1('task-0');
    expect(result).toMatchObject({ kind: 'ready', record: { completionCode: 'customer_declined', completionFeedback: { kind: 'manual_low_sensitivity', summary: '暂不需要联系' } } });
    expect(JSON.stringify(result)).not.toContain('private-key');
  });
});
