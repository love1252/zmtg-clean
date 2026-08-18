
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestOwners = vi.hoisted(() => new WeakSet<object>());
const navigationOwners = vi.hoisted(() => new WeakSet<object>());
const mocks = vi.hoisted(() => ({
  authorizeNavigation: vi.fn(),
  readCustomers: vi.fn(),
  resolveCapability: vi.fn(),
  resolveServerAuthorization: vi.fn(),
  canCreateCustomer: vi.fn(),
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
}));
vi.mock('@/server/orchestration/institution-capability-authority', () => ({
  resolveInstitutionCapabilityAuthorityStatusV1: mocks.resolveCapability,
}));
vi.mock('@/server/orchestration/institution-customer-list-reader', () => ({
  readCurrentInstitutionCustomersV1: mocks.readCustomers,
}));
vi.mock('@/server/orchestration/institution-customer-create-availability', () => ({
  canCurrentInstitutionCreateFormalCustomerV1: mocks.canCreateCustomer,
}));
vi.mock('@/modules/institution/components/InstitutionNavigationShell', () => ({
  InstitutionNavigationShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="institution-navigation-shell">{children}</div>
  ),
}));

import HospitalCustomersPage, {
  dynamic,
} from '@/app/hospital/customers/page';

const allSections = Object.freeze([
  'workbench',
  'customers',
  'conversations',
  'care',
  'knowledge',
  'analytics',
  'system',
] as const);

const requestAuthorization = Object.freeze({
  authorizeCurrentInstitutionNavigationV1: mocks.authorizeNavigation,
});

const ready = Object.freeze({
  kind: 'ready' as const,
  records: Object.freeze([
    Object.freeze({
      contractVersion: 'v1' as const,
      customerId: 'customer-001',
      displayName: '客户甲',
      lifecycle: 'consulting' as const,
      priority: 'high' as const,
      updatedAt: '2026-08-18T12:00:00.000Z',
    }),
  ]),
  pageInfo: Object.freeze({
    page: 1,
    pageSize: 20 as const,
    hasMore: false,
  }),
});

function navigation(targetAccess: 'allowed' | 'blocked') {
  const value = Object.freeze({
    kind: 'institution_navigation_authorization',
    targetSectionId: 'customers',
    targetAccess,
    availableSectionIds: allSections,
  });
  navigationOwners.add(value);
  return value;
}

function capability(
  decision: 'read_only' | 'operational' | 'hidden' = 'read_only',
) {
  return Object.freeze({
    contractVersion: 'v1',
    readiness: 'ready',
    failureCode: null,
    partitions: Object.freeze([
      Object.freeze({
        key: 'page_customer_list',
        readiness: 'ready',
        failureCode: null,
      }),
    ]),
    data: Object.freeze({
      capabilities: Object.freeze([
        Object.freeze({
          key: 'page_customer_list',
          decision,
          dimensions: Object.freeze({
            codeMaturity: 'verified',
            institutionAuthorization: 'authorized',
            connectionAvailability: 'not_required',
            dataReadiness: 'ready',
            productionRelease:
              decision === 'hidden' ? 'not_released' : 'pilot_released',
          }),
          safeSummary:
            decision === 'read_only'
              ? '客户列表仅供查看'
              : decision === 'operational'
                ? '客户列表可用'
                : null,
        }),
      ]),
    }),
  });
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  requestOwners.add(requestAuthorization);
  mocks.resolveServerAuthorization.mockResolvedValue(requestAuthorization);
  mocks.authorizeNavigation.mockResolvedValue(navigation('allowed'));
  mocks.resolveCapability.mockResolvedValue(capability());
  mocks.readCustomers.mockResolvedValue(ready);
  mocks.canCreateCustomer.mockResolvedValue(true);
});

describe('/hospital/customers controlled-write release page', () => {
  it('keeps force-dynamic readonly compatibility', async () => {
    expect(dynamic).toBe('force-dynamic');

    render(await HospitalCustomersPage({}));
    expect(screen.getByRole('heading', { name: '客户列表' })).toBeInTheDocument();
    expect(screen.getByText('READ ONLY')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '查看 / 操作' }),
    ).not.toBeInTheDocument();
  });

  it('operational release exposes create and list-to-detail entry', async () => {
    mocks.resolveCapability.mockResolvedValueOnce(capability('operational'));

    render(
      await HospitalCustomersPage({
        searchParams: Promise.resolve({ create: '1' }),
      }),
    );

    expect(screen.getByRole('heading', { name: '新建客户' })).toBeInTheDocument();
    expect(screen.getByText('CONTROLLED WRITE')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看 / 操作' })).toHaveAttribute(
      'href',
      '/hospital/customers/customer-001',
    );

    const params = mocks.readCustomers.mock.calls[0]?.[0] as URLSearchParams;
    expect(params.has('create')).toBe(false);
    expect(mocks.canCreateCustomer).toHaveBeenCalledTimes(1);
  });

  it('navigation forbidden stops before capability and Reader', async () => {
    mocks.authorizeNavigation.mockResolvedValueOnce(navigation('blocked'));
    render(await HospitalCustomersPage({}));
    expect(screen.getByText('当前账号不可访问客户列表')).toBeInTheDocument();
    expect(mocks.resolveCapability).not.toHaveBeenCalled();
    expect(mocks.readCustomers).not.toHaveBeenCalled();
  });

  it('hidden capability never reads business data', async () => {
    mocks.resolveCapability.mockResolvedValueOnce(capability('hidden'));
    render(await HospitalCustomersPage({}));
    expect(screen.getByText('客户列表尚未开放')).toBeInTheDocument();
    expect(mocks.readCustomers).not.toHaveBeenCalled();
  });

  it('preserves strict list query handoff after stripping controlled create marker', async () => {
    render(
      await HospitalCustomersPage({
        searchParams: Promise.resolve({
          page: ['1', '2'],
          unknown: 'value',
        }),
      }),
    );

    const params = mocks.readCustomers.mock.calls[0]?.[0] as URLSearchParams;
    expect(params.getAll('page')).toEqual(['1', '2']);
    expect(params.getAll('unknown')).toEqual(['value']);
  });
});
