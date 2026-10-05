import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorization: vi.fn(), consume: vi.fn(), capability: vi.fn(), database: vi.fn(),
  repository: vi.fn(), query: vi.fn(), context: vi.fn(),
}));
vi.mock('@/server/orchestration/institution-care-write-authorization', () => ({
  resolveInstitutionCareWriteAuthorizationV1: mocks.authorization,
  consumeInstitutionCareWriteAuthorizationV1: mocks.consume,
}));
vi.mock('@/server/orchestration/institution-capability-authority', () => ({
  resolveInstitutionCapabilityAuthorityStatusV1: mocks.capability,
}));
vi.mock('@/server/db/client', () => ({ getDatabase: mocks.database }));
vi.mock('@/modules/care/server/formal-follow-up-repository', () => ({ createFormalFollowUpRepositoryV1: mocks.repository }));
vi.mock('@/modules/institution/server/institution-operating-context-reader', () => ({
  readInstitutionOperatingContextForCareV1: mocks.context,
}));

import type { FormalFollowUpTaskRecordV1 } from '@/modules/care/ports/formal-follow-up-store';
import { readCurrentInstitutionCareActionSourceV1 } from '@/server/orchestration/institution-care-action-source';

const actor = { tenantId: 'tenant-a', institutionId: 'institution-a', accountId: 'staff-a', role: 'consultant' };
const capability = {
  contractVersion: 'v1', scope: { tenantId: 'tenant-a', institutionId: 'institution-a' },
  readiness: 'ready', failureCode: null,
  data: { capabilities: [{
    key: 'page_care_followups', decision: 'operational', safeSummary: '随访任务可用',
    dimensions: { productionRelease: 'pilot_released' },
  }] },
  partitions: [{ key: 'page_care_followups', readiness: 'ready', failureCode: null }],
};
const records: FormalFollowUpTaskRecordV1[] = Array.from({ length: 6 }, (_, i) => ({
  tenantId: 'tenant-a', institutionId: 'institution-a', taskId: `task-${i}`, customerId: `customer-${i}`,
  customerDisplayName: '演示客户', customerMaskedReference: '***001',
  stageCode: 'manual_followup', actionCode: 'manual_contact', dueAt: '2026-10-04T16:00:00.000Z',
  state: 'pending', revision: 1, riskLevel: 'none', riskKind: null, riskEventId: null,
  completionCode: null, completionFeedback: '私有内部信息', cancellationReason: null,
  assignment: { kind: 'user', userId: 'staff-a', displayName: '员工甲', claimedFromRolePool: null },
  idempotencyKey: 'private-key', requestDigest: 'private-digest', createdBy: 'admin-a', updatedBy: 'admin-a',
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
}));

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-04T16:00:00.000Z'));
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.authorization.mockResolvedValue({ kind: 'allowed', authorization: {} });
  mocks.consume.mockReturnValue(actor); mocks.capability.mockResolvedValue(capability);
  mocks.database.mockReturnValue({ isolated: true });
  mocks.repository.mockReturnValue({ queryWorkbenchVisible: mocks.query });
  mocks.context.mockResolvedValue({ timeZone: 'Asia/Shanghai', version: '1' });
  mocks.query.mockResolvedValue({ records, counts: { overdue: 0, dueToday: 155 } });
});
afterEach(() => vi.useRealTimers());

describe('正式工作台随访读取编排', () => {
  it('读取可信上下文后查询全量计数，固定同一时间并投影6个低敏候选', async () => {
    const source = await readCurrentInstitutionCareActionSourceV1();
    expect(source?.data?.cards.map(({ count }) => count)).toEqual([0, 155]);
    expect(source?.data?.actions).toHaveLength(6);
    expect(mocks.context).toHaveBeenCalledWith({ isolated: true }, { tenantId: 'tenant-a', institutionId: 'institution-a' });
    expect(mocks.context.mock.invocationCallOrder[0]).toBeLessThan(mocks.query.mock.invocationCallOrder[0]!);
    expect(mocks.query).toHaveBeenCalledWith({
      tenantId: 'tenant-a', institutionId: 'institution-a', actorId: 'staff-a', actorRole: 'consultant',
      businessDate: '2026-10-05', timeZone: 'Asia/Shanghai',
    });
    expect(source?.partitions[3]?.freshness?.observedAt).toBe('2026-10-04T16:00:00.000Z');
    for (const privateText of ['private-key', 'private-digest', '私有内部信息', 'completionFeedback', 'idempotencyKey', 'requestDigest']) {
      expect(JSON.stringify(source)).not.toContain(privateText);
    }
  });

  it.each([
    ['Asia/Shanghai', '2026-10-04T15:59:59.999Z', '2026-10-04'],
    ['Asia/Shanghai', '2026-10-04T16:00:00.000Z', '2026-10-05'],
    ['America/New_York', '2026-10-04T16:00:00.000Z', '2026-10-04'],
    ['America/New_York', '2026-10-05T03:59:59.999Z', '2026-10-04'],
    ['America/New_York', '2026-10-05T04:00:00.000Z', '2026-10-05'],
  ])('%s在%s固定业务日期%s', async (timeZone, instant, businessDate) => {
    mocks.context.mockResolvedValue({ timeZone, version: '2' }); vi.setSystemTime(new Date(instant));
    mocks.query.mockResolvedValue({ records: [], counts: { overdue: 0, dueToday: 0 } });
    expect((await readCurrentInstitutionCareActionSourceV1())?.data?.actions).toEqual([]);
    expect(mocks.query.mock.calls[0]?.[0]).toMatchObject({ timeZone, businessDate });
  });

  it.each(['tenant_admin', 'tenant_operator', 'consultant', 'customer_service'] as const)(
    '%s沿用当前授权成员身份查询', async (role) => {
      mocks.consume.mockReturnValue({ ...actor, role }); await readCurrentInstitutionCareActionSourceV1();
      expect(mocks.query.mock.calls[0]?.[0].actorRole).toBe(role);
    },
  );

  it.each(['forbidden', 'unavailable'])('授权%s时不访问数据库', async (kind) => {
    mocks.authorization.mockResolvedValue({ kind });
    expect(await readCurrentInstitutionCareActionSourceV1()).toBeNull();
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it('不可消费授权句柄不访问数据库', async () => {
    mocks.consume.mockReturnValue(null);
    expect(await readCurrentInstitutionCareActionSourceV1()).toBeNull();
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it.each([
    { scope: { tenantId: 'foreign', institutionId: 'institution-a' } },
    { scope: { tenantId: 'tenant-a', institutionId: 'foreign' } },
    { readiness: 'partial' }, { failureCode: 'data_incomplete' },
    { data: { capabilities: [] } }, { partitions: [] },
    { data: { capabilities: [...capability.data.capabilities, ...capability.data.capabilities] } },
    { partitions: [...capability.partitions, ...capability.partitions] },
    { data: { capabilities: [{ ...capability.data.capabilities[0], decision: 'disabled' }] } },
    { data: { capabilities: [{ ...capability.data.capabilities[0], dimensions: { productionRelease: 'not_released' } }] } },
  ])('能力或机构门禁异常%o时不访问数据库', async (change) => {
    mocks.capability.mockResolvedValue({ ...capability, ...change });
    expect(await readCurrentInstitutionCareActionSourceV1()).toBeNull();
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it.each([null, { timeZone: 'invalid/zone', version: '1' }, { timeZone: 'Asia/Shanghai', version: '' }])(
    '上下文%o不可用时不查询随访、不补零', async (context) => {
      mocks.context.mockResolvedValue(context);
      expect(await readCurrentInstitutionCareActionSourceV1()).toBeNull();
      expect(mocks.query).not.toHaveBeenCalled();
    },
  );

  it.each(['context', 'query'] as const)('%s读取故障不伪造空数据或透出内部错误', async (stage) => {
    mocks[stage].mockRejectedValue(new Error('内部数据库信息'));
    expect(await readCurrentInstitutionCareActionSourceV1()).toBeNull();
  });

  it('损坏快照通过不可用数据源表现，不显示为零或有限样本的全量数', async () => {
    mocks.query.mockResolvedValue({ records: [{ ...records[0], institutionId: 'foreign' }], counts: { overdue: 0, dueToday: 1 } });
    expect(await readCurrentInstitutionCareActionSourceV1()).toMatchObject({ readiness: 'unavailable', data: null });
  });
});
