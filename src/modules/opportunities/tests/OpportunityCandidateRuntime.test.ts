import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), consume: vi.fn(), read: vi.fn(), database: vi.fn() }));
vi.mock('@/server/orchestration/institution-customer-read-authorization', () => ({ resolveInstitutionCustomerReadAuthorizationV1: mocks.resolve, consumeInstitutionCustomerReadAuthorizationV1: mocks.consume }));
vi.mock('@/server/db/client', () => ({ getDatabase: mocks.database }));
vi.mock('@/modules/opportunities/server/opportunity-candidate-repository', () => ({ createOpportunityCandidateRepository: () => ({ read: mocks.read }) }));
import { readCurrentInstitutionOpportunitiesV1 as read } from '@/server/orchestration/institution-opportunity-reader';

const scope = { tenantId: 'tenant-a', institutionId: 'institution-a', observedAt: '2026-10-06T00:00:00.000Z' };
const row = { ...scope, customerId: 'customer-a', displayName: '客户甲', lifecycle: 'post_care', priority: 'high', updatedAt: new Date('2026-10-01T00:00:00Z') };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.resolve.mockResolvedValue({ kind: 'allowed', authorization: 'trusted-handle' });
  mocks.consume.mockReturnValue(scope); mocks.database.mockReturnValue({});
  mocks.read.mockResolvedValue({ total: 1, rows: [row] });
});
describe('机会候选可信来源与范围', () => {
  it('只输出低敏字段，指纹重复稳定且来源变化后改变', async () => {
    const first = await read(new URLSearchParams());
    expect(first.kind).toBe('ready'); if (first.kind !== 'ready') throw new Error('未返回候选');
    expect(first.records[0]).toMatchObject({ customerId: row.customerId, opportunityType: 'revisit', basis: '客户主档生命周期 = 术后关怀', sourceKind: 'customer_lifecycle', ruleVersion: 'customer-lifecycle.v1' });
    expect(first.records[0].sourceVersion).toMatch(/^opp-src-v1:[a-f0-9]{64}$/u);
    expect(first.records[0]).not.toHaveProperty('tenantId'); expect(first.records[0]).not.toHaveProperty('institutionId');
    expect(await read(new URLSearchParams())).toEqual(first);
    mocks.read.mockResolvedValue({ total: 1, rows: [{ ...row, priority: 'medium' }] });
    const changed = await read(new URLSearchParams());
    expect(changed.kind).toBe('ready'); if (changed.kind === 'ready') expect(changed.records[0].sourceVersion).not.toBe(first.records[0].sourceVersion);
    expect(mocks.consume).toHaveBeenCalledWith('trusted-handle');
    expect(mocks.read).toHaveBeenCalledWith({ tenantId: scope.tenantId, institutionId: scope.institutionId, query: { page: 1, pageSize: 20, type: 'all', priority: null } });
  });
  it('超过100条时只返回当前页，总数为完整筛选范围', async () => {
    mocks.read.mockResolvedValue({ total: 155, rows: Array.from({ length: 20 }, (_, index) => ({ ...row, customerId: 'customer-' + (index + 101) })) });
    const result = await read(new URLSearchParams('page=6&pageSize=20'));
    expect(result).toMatchObject({ kind: 'ready', pageInfo: { page: 6, total: 155, pageCount: 8, hasMore: true } });
    if (result.kind === 'ready') expect(result.records).toHaveLength(20);
  });
  it.each(['forbidden', 'unavailable'])('%s不访问数据库', async kind => {
    mocks.resolve.mockResolvedValue({ kind });
    expect(await read(new URLSearchParams())).toEqual({ kind });
    expect(mocks.database).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });
  it('不可消费句柄及非法查询不访问数据库', async () => {
    mocks.consume.mockReturnValueOnce(null);
    expect(await read(new URLSearchParams())).toEqual({ kind: 'unavailable' });
    expect(await read(new URLSearchParams('tenantId=other'))).toEqual({ kind: 'invalid_query' });
    expect(mocks.database).not.toHaveBeenCalled();
  });
  it.each([{ tenantId: 'other' }, { institutionId: 'other' }, { lifecycle: 'consulting' }, { priority: 'unknown' }, { updatedAt: new Date('invalid') }, { customerId: '../other' }])('损坏或跨范围来源失败关闭 %j', async change => {
    mocks.read.mockResolvedValue({ total: 1, rows: [{ ...row, ...change }] });
    expect(await read(new URLSearchParams())).toEqual({ kind: 'unavailable' });
  });
  it('返回行不符合筛选也不能泄漏', async () => {
    expect(await read(new URLSearchParams('type=repurchase'))).toEqual({ kind: 'unavailable' });
    expect(await read(new URLSearchParams('priority=observe'))).toEqual({ kind: 'unavailable' });
  });
  it.each([{ total: -1, rows: [] }, { total: NaN, rows: [] }, { total: 1.5, rows: [row] }, { total: 2, rows: [row] }, { total: 2, rows: [row, row] }])('损坏总数、缺行与重复行不伪装正常', async snapshot => {
    mocks.read.mockResolvedValue(snapshot);
    expect(await read(new URLSearchParams())).toEqual({ kind: 'unavailable' });
  });
  it('空集、越界页与数据库失败保持不同状态', async () => {
    mocks.read.mockResolvedValueOnce({ total: 0, rows: [] });
    expect(await read(new URLSearchParams())).toMatchObject({ kind: 'ready', records: [], pageInfo: { total: 0, pageCount: 0 } });
    mocks.read.mockResolvedValueOnce({ total: 1, rows: [] });
    expect(await read(new URLSearchParams('page=2'))).toMatchObject({ kind: 'ready', records: [], pageInfo: { total: 1, page: 2, pageCount: 1, hasMore: false } });
    mocks.read.mockRejectedValueOnce(new Error('private-db-error'));
    expect(await read(new URLSearchParams())).toEqual({ kind: 'unavailable' });
  });
});
