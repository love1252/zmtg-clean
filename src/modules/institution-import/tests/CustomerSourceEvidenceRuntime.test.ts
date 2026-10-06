import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), getDatabase: vi.fn(), snapshot: vi.fn(), decrypt: vi.fn(), encrypt: vi.fn(),
}));
vi.mock('@/server/orchestration/institution-customer-controlled-write-runtime', () => ({ authorizeInstitutionCustomerControlledWriteV1: mocks.authorize }));
vi.mock('@/server/db/client', () => ({ getDatabase: mocks.getDatabase }));
vi.mock('@/modules/institution-import/server/institution-excel-import-repository', () => ({ createInstitutionExcelImportRepositoryV1: () => ({ readCustomerSourceSnapshot: mocks.snapshot }) }));
vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: mocks.decrypt, encryptSecret: mocks.encrypt }));

import { readCurrentInstitutionCustomerSourceEvidenceV1 as read } from '@/server/orchestration/institution-excel-import-runtime';

const scope = { tenantId: 'tenant-a', institutionId: 'institution-a' };
const customer = { id: 'manual-customer-1', updatedAt: new Date('2026-10-01T00:00:00Z') };
const batchId = 'imp-b-' + 'a'.repeat(48);
const row = { batchId, matchedBatchId: batchId, rowNumber: 5, completedAt: new Date('2025-01-01T00:00:00Z') };
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-06T05:00:00Z'));
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('DATABASE_URL', 'postgresql://localhost:5432/isolated');
  mocks.getDatabase.mockReturnValue({});
  mocks.authorize.mockResolvedValue({ kind: 'allowed', actor: { ...scope, role: 'tenant_admin' } });
  mocks.snapshot.mockResolvedValue({ customer, rows: [row] });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('客户来源证据编排', () => {
  it.each(['tenant_admin', 'tenant_operator'])('保持%s门禁，不按客户前缀或最近批次判断来源', async role => {
    mocks.authorize.mockResolvedValue({ kind: 'allowed', actor: { ...scope, role } });
    expect(await read(customer.id)).toEqual({
      kind: 'ready', contractVersion: 'customer-source-evidence.v1', customerId: customer.id,
      customerUpdatedAt: customer.updatedAt.toISOString(), observedAt: '2026-10-06T05:00:00.000Z',
      evidence: { status: 'recorded', importRecord: { batchId, sheetKind: 'customer', rowNumber: 5, completedAt: row.completedAt.toISOString() } },
    });
    expect(mocks.authorize).toHaveBeenCalledWith(true);
    expect(mocks.snapshot).toHaveBeenCalledWith({ ...scope, customerId: customer.id });
    expect(mocks.decrypt).not.toHaveBeenCalled(); expect(mocks.encrypt).not.toHaveBeenCalled();
  });
  it.each([0, 2])('%s条关联不返回单一来源', async count => {
    mocks.snapshot.mockResolvedValue({ customer, rows: Array.from({ length: count }, (_, i) => ({ ...row, rowNumber: i + 5 })) });
    expect(await read(customer.id)).toMatchObject({ kind: 'ready', evidence: { status: count ? 'ambiguous' : 'not_recorded', importRecord: null } });
  });
  it('客户不可见与无证据区分', async () => {
    mocks.snapshot.mockResolvedValue({ customer: null, rows: [] });
    expect(await read(customer.id)).toEqual({ kind: 'not_found', code: 'customer_source_not_found' });
  });
  it.each([
    { matchedBatchId: null }, { matchedBatchId: 'other' }, { batchId: 'bad' },
    { rowNumber: 4 }, { rowNumber: 5.5 }, { completedAt: null }, { completedAt: new Date('invalid') },
  ])('损坏关联失败关闭 %j', async change => {
    mocks.snapshot.mockResolvedValue({ customer, rows: [row, { ...row, ...change }] });
    expect(await read(customer.id)).toEqual({ kind: 'unavailable', code: 'customer_source_unavailable' });
  });
  it.each([{ ...customer, id: 'other' }, { ...customer, updatedAt: new Date('invalid') }])('错误客户元数据失败关闭', async value => {
    mocks.snapshot.mockResolvedValue({ customer: value, rows: [row] });
    expect(await read(customer.id)).toMatchObject({ kind: 'unavailable' });
  });
  it('仓库异常和超出查询边界均不作为空数据', async () => {
    mocks.snapshot.mockRejectedValueOnce(new Error('private-db-error'));
    expect(await read(customer.id)).toEqual({ kind: 'unavailable', code: 'customer_source_unavailable' });
    mocks.snapshot.mockResolvedValueOnce({ customer, rows: [row, row, row] });
    expect(await read(customer.id)).toMatchObject({ kind: 'unavailable' });
  });
  it.each(['consultant', 'customer_service'])('禁止普通角色%s读取', async role => {
    mocks.authorize.mockResolvedValue({ kind: 'allowed', actor: { ...scope, role } });
    expect(await read(customer.id)).toMatchObject({ kind: 'forbidden' });
    expect(mocks.getDatabase).not.toHaveBeenCalled(); expect(mocks.snapshot).not.toHaveBeenCalled();
  });
  it.each(['forbidden', 'unavailable'])('保持授权%s语义', async kind => {
    mocks.authorize.mockResolvedValue({ kind });
    expect(await read(customer.id)).toMatchObject({ kind });
    expect(mocks.getDatabase).not.toHaveBeenCalled();
  });
  it.each(['production', 'remote'])('环境%s拒绝且不查询业务对象', async mode => {
    if (mode === 'production') vi.stubEnv('NODE_ENV', 'production');
    else vi.stubEnv('DATABASE_URL', 'postgresql://example.invalid:5432/isolated');
    expect(await read(customer.id)).toMatchObject({ kind: 'unavailable' });
    expect(mocks.authorize).not.toHaveBeenCalled(); expect(mocks.getDatabase).not.toHaveBeenCalled();
  });
  it.each(['', '../other', 'a'.repeat(97)])('非法客户标识不读取 %s', async id => {
    expect(await read(id)).toMatchObject({ kind: 'not_found' });
    expect(mocks.authorize).not.toHaveBeenCalled(); expect(mocks.snapshot).not.toHaveBeenCalled();
  });
});
