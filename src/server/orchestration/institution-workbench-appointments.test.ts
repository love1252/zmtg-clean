import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(), consume: vi.fn(), capability: vi.fn(), database: vi.fn(), read: vi.fn(),
}));
vi.mock('./institution-care-read-authorization', () => ({
  resolveInstitutionCareReadAuthorizationV1: mocks.resolve,
  consumeInstitutionCareReadAuthorizationV1: mocks.consume,
}));
vi.mock('./institution-capability-authority', () => ({
  resolveInstitutionCapabilityAuthorityStatusV1: mocks.capability,
}));
vi.mock('@/server/db/client', () => ({ getDatabase: mocks.database }));
vi.mock('@/modules/care/server/workbench-appointment-repository', () => ({
  readWorkbenchAppointmentsV1: mocks.read,
}));

import { readCurrentInstitutionWorkbenchAppointmentsV1 } from './institution-workbench-appointments';

const authorization = Object.freeze({ opaque: true });
const scope = { tenantId: 'tenant-a', institutionId: 'institution-a' };
const database = Object.freeze({ isolated: true });
function capabilityStatus() {
  return {
    scope: { ...scope }, contractVersion: 'v1', readiness: 'ready', failureCode: null,
    partitions: [{ key: 'page_care_appointments', readiness: 'ready', failureCode: null }],
    data: { capabilities: [{
      key: 'page_care_appointments', decision: 'operational', safeSummary: '预约管理可用',
      dimensions: {
        codeMaturity: 'verified', institutionAuthorization: 'authorized',
        connectionAvailability: 'not_required', dataReadiness: 'ready', productionRelease: 'pilot_released',
      },
    }] },
  };
}

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.resolve.mockResolvedValue({ kind: 'allowed', authorization });
  mocks.consume.mockReturnValue(scope);
  mocks.capability.mockResolvedValue(capabilityStatus());
  mocks.database.mockReturnValue(database);
  mocks.read.mockResolvedValue({ kind: 'ready', today: { total: 135, records: [] } });
});

describe('工作台预约正式读取边界', () => {
  it('当前授权消费后按同一机构读取全量统计，不接受客户端范围', async () => {
    await expect(readCurrentInstitutionWorkbenchAppointmentsV1()).resolves.toMatchObject({ kind: 'ready' });
    expect(mocks.consume).toHaveBeenCalledExactlyOnceWith(authorization);
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith(database, { ...scope, referenceTime: expect.any(String) });
    expect(mocks.consume.mock.invocationCallOrder[0]).toBeLessThan(mocks.database.mock.invocationCallOrder[0]!);
  });

  it('正式只读预约能力允许读取统计', async () => {
    const status = capabilityStatus();
    status.data.capabilities[0]!.decision = 'read_only';
    status.data.capabilities[0]!.safeSummary = '预约管理仅供查看';
    mocks.capability.mockResolvedValue(status);
    await expect(readCurrentInstitutionWorkbenchAppointmentsV1()).resolves.toMatchObject({ kind: 'ready' });
  });

  it.each(['forbidden', 'unavailable'])('%s 授权不触及数据源', async kind => {
    mocks.resolve.mockResolvedValue({ kind });
    await expect(readCurrentInstitutionWorkbenchAppointmentsV1()).resolves.toEqual({ kind });
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it('已消费或伪造授权在数据读取前停止', async () => {
    mocks.consume.mockReturnValue(null);
    await expect(readCurrentInstitutionWorkbenchAppointmentsV1()).resolves.toEqual({ kind: 'unavailable' });
    expect(mocks.capability).not.toHaveBeenCalled();
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it.each([
    'tenant', 'institution', 'hidden', 'duplicate', 'unreleased', 'stale', 'partition', 'summary',
  ])('能力状态 %s 不可信时不读数据库', async fault => {
    const status = capabilityStatus();
    if (fault === 'tenant') status.scope.tenantId = 'other';
    if (fault === 'institution') status.scope.institutionId = 'other';
    if (fault === 'hidden') status.data.capabilities[0]!.decision = 'hidden';
    if (fault === 'duplicate') status.data.capabilities.push(status.data.capabilities[0]!);
    if (fault === 'unreleased') status.data.capabilities[0]!.dimensions.productionRelease = 'not_released';
    if (fault === 'stale') status.readiness = 'stale';
    if (fault === 'partition') status.partitions = [];
    if (fault === 'summary') status.data.capabilities[0]!.safeSummary = 'unknown';
    mocks.capability.mockResolvedValue(status);
    await expect(readCurrentInstitutionWorkbenchAppointmentsV1()).resolves.toEqual({ kind: 'unavailable' });
    expect(mocks.database).not.toHaveBeenCalled();
  });

  it('底层失败不泄露细节或伪装成零条', async () => {
    mocks.read.mockRejectedValue(new Error('private connection details'));
    await expect(readCurrentInstitutionWorkbenchAppointmentsV1()).resolves.toEqual({ kind: 'unavailable' });
  });
});
