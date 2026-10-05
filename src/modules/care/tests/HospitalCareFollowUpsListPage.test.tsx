import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestOwners = vi.hoisted(() => new WeakSet<object>());
const navigationOwners = vi.hoisted(() => new WeakSet<object>());
const mocks = vi.hoisted(() => ({
  authorizeNavigation: vi.fn(),
  readFollowUps: vi.fn(),
  resolveCapability: vi.fn(),
  resolveServerAuthorization: vi.fn(),
  matchesScope: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/modules/institution/server/institution-server-runtime', () => ({
  resolveInstitutionServerAuthorizationV1: mocks.resolveServerAuthorization,
}));
vi.mock('@/modules/security/server/institution-request-authorization', () => ({
  isInstitutionRequestAuthorizationV1(value: unknown) {
    return value !== null && typeof value === 'object' && requestOwners.has(value);
  },
}));
vi.mock('@/modules/security/server/institution-section-guard', () => ({
  isInstitutionNavigationAuthorizationV1(value: unknown) {
    return value !== null && typeof value === 'object' && navigationOwners.has(value);
  },
  readInstitutionNavigationWorkspaceScopeKeyV1(value: unknown) {
    return value !== null && typeof value === 'object' && navigationOwners.has(value)
      ? 'V'.repeat(43)
      : null;
  },
  matchesInstitutionNavigationAuthorizationScopeV1: mocks.matchesScope,
}));
vi.mock('@/server/orchestration/institution-capability-authority', () => ({
  resolveInstitutionCapabilityAuthorityStatusV1: mocks.resolveCapability,
}));
vi.mock('@/server/orchestration/institution-formal-follow-up-runtime', () => ({
  readCurrentInstitutionFormalFollowUpsV1: mocks.readFollowUps,
}));

vi.mock(
  '@/modules/institution/components/InstitutionNavigationShell',
  () => ({
    InstitutionNavigationShell: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="institution-navigation-shell">{children}</div>
    ),
  }),
);


vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
import HospitalCareFollowUpsPage, { dynamic } from '@/app/hospital/care/followups/page';
const requestAuthorization = Object.freeze({ authorizeCurrentInstitutionNavigationV1: mocks.authorizeNavigation });
function navigation(targetAccess = 'allowed', targetSectionId = 'care') {
  const value = { kind: 'institution_navigation_authorization', targetSectionId, targetAccess, availableSectionIds: ['care'] };
  navigationOwners.add(value); return value;
}
function capability() {
  return {
    contractVersion: 'v1', scope: { tenantId: 'tenant-test', institutionId: 'institution-test' }, readiness: 'ready', failureCode: null,
    partitions: [{ key: 'page_care_followups', readiness: 'ready', failureCode: null }],
    data: { capabilities: [{ key: 'page_care_followups', decision: 'operational', safeSummary: '随访任务可用', dimensions: {
      codeMaturity: 'verified', institutionAuthorization: 'authorized', connectionAvailability: 'not_required', dataReadiness: 'ready', productionRelease: 'pilot_released',
    } }] },
  };
}
const ready = {
  kind: 'ready', records: [], canCreate: false, hasMore: false,
  pageInfo: { page: 1, pageSize: 20, total: 0, pageCount: 0, hasMore: false },
  summary: { total: 0, stateCounts: { pending: 0, in_progress: 0, waiting_customer: 0, escalated: 0, completed: 0, cancelled: 0 }, dueBucketCounts: { overdue: 0, due_today: 0, not_due: 0 } },
  observedAt: '2026-10-05T00:00:00.000Z', timeZone: 'Asia/Shanghai', operatingContextVersion: 'v1',
};
beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  requestOwners.add(requestAuthorization);
  mocks.resolveServerAuthorization.mockResolvedValue(requestAuthorization);
  mocks.authorizeNavigation.mockResolvedValue(navigation());
  mocks.resolveCapability.mockResolvedValue(capability());
  mocks.matchesScope.mockReturnValue(true);
  mocks.readFollowUps.mockResolvedValue(ready);
});

describe('正式随访列表页面接线和权限', () => {
  it('仅在可信导航和能力通过后读取，并完整传递组合查询', async () => {
    render(await HospitalCareFollowUpsPage({ searchParams: Promise.resolve({ page: '6', pageSize: '20', state: 'pending', dueBucket: 'overdue', q: '客户A' }) }));
    expect(dynamic).toBe('force-dynamic');
    expect(Object.fromEntries(mocks.readFollowUps.mock.calls[0][0])).toEqual({ page: '6', pageSize: '20', state: 'pending', dueBucket: 'overdue', q: '客户A' });
    expect(mocks.authorizeNavigation).toHaveBeenCalledWith({ targetSectionId: 'care' });
    expect(mocks.resolveCapability.mock.invocationCallOrder[0]).toBeLessThan(mocks.readFollowUps.mock.invocationCallOrder[0]);
    expect(screen.getByText('当前筛选下没有随访任务。')).toBeInTheDocument();
  });
  it.each(['today', 'overdue'])('工作台 bucket=%s 与 create=1兼容且不扩大权限', async (bucket) => {
    render(await HospitalCareFollowUpsPage({ searchParams: Promise.resolve({ create: '1', bucket }) }));
    expect(Object.fromEntries(mocks.readFollowUps.mock.calls[0][0])).toEqual({ page: '1', pageSize: '20', dueBucket: bucket === 'today' ? 'due_today' : 'overdue' });
    expect(screen.queryByRole('button', { name: '创建任务' })).not.toBeInTheDocument();
  });
  it.each(['unowned_request', 'unowned_navigation', 'blocked', 'wrong_section', 'scope_mismatch', 'auth_error'])('%s 不调用业务读取器', async (scenario) => {
    if (scenario === 'unowned_request') mocks.resolveServerAuthorization.mockResolvedValue({ ...requestAuthorization });
    if (scenario === 'unowned_navigation') mocks.authorizeNavigation.mockResolvedValue({ ...navigation() });
    if (scenario === 'blocked') mocks.authorizeNavigation.mockResolvedValue(navigation('blocked'));
    if (scenario === 'wrong_section') mocks.authorizeNavigation.mockResolvedValue(navigation('allowed', 'customers'));
    if (scenario === 'scope_mismatch') mocks.matchesScope.mockReturnValue(false);
    if (scenario === 'auth_error') mocks.resolveServerAuthorization.mockRejectedValue(new Error('private reason'));
    render(await HospitalCareFollowUpsPage({}));
    expect(mocks.readFollowUps).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: '随访查询结果' })).not.toBeInTheDocument();
  });
  it.each(['hidden', 'missing', 'duplicate', 'unreleased', 'partition_missing', 'unavailable'])('能力 %s 不调用业务读取器', async (scenario) => {
    const value = capability();
    if (scenario === 'hidden') value.data.capabilities[0].decision = 'hidden';
    if (scenario === 'missing') value.data.capabilities = [];
    if (scenario === 'duplicate') value.data.capabilities.push(value.data.capabilities[0]);
    if (scenario === 'unreleased') value.data.capabilities[0].dimensions.productionRelease = 'not_released';
    if (scenario === 'partition_missing') value.partitions = [];
    mocks.resolveCapability.mockResolvedValue(scenario === 'unavailable' ? null : value);
    render(await HospitalCareFollowUpsPage({}));
    expect(mocks.readFollowUps).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: '随访查询结果' })).not.toBeInTheDocument();
  });
  it.each([{ state: ['pending', 'completed'] }, { unknown: '1' }, { page: '0' }])('无效查询 %j 可清除且不调用读取器', async (params) => {
    render(await HospitalCareFollowUpsPage({ searchParams: Promise.resolve(params) }));
    expect(screen.getByRole('alert')).toHaveTextContent('随访查询条件无效');
    expect(screen.getByRole('link', { name: '清除筛选' })).toHaveAttribute('href', '/hospital/care/followups');
    expect(mocks.readFollowUps).not.toHaveBeenCalled();
  });
  it.each(['unavailable', 'exception', 'forbidden', 'invalid_query'])('读取失败 %s 不展示空集或统计；可重试错误保留条件', async (kind) => {
    if (kind === 'exception') mocks.readFollowUps.mockRejectedValue(new Error('private database reason'));
    else mocks.readFollowUps.mockResolvedValue({ kind });
    render(await HospitalCareFollowUpsPage({ searchParams: Promise.resolve({ page: '6', q: '客户A' }) }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '当前筛选统计' })).not.toBeInTheDocument();
    expect(screen.queryByText('当前筛选下没有随访任务。')).not.toBeInTheDocument();
    expect(screen.queryByText(/private database/)).not.toBeInTheDocument();
    if (kind === 'unavailable' || kind === 'exception') {
      const href = screen.getByRole('link', { name: '重试当前查询' }).getAttribute('href')!;
      expect(Object.fromEntries(new URL(href, 'http://localhost').searchParams)).toEqual({ page: '6', pageSize: '20', q: '客户A' });
    }
    if (kind === 'forbidden') expect(screen.queryByRole('link', { name: '重试当前查询' })).not.toBeInTheDocument();
  });
});
