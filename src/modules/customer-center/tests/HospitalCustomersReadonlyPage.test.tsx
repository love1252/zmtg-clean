import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestOwners = vi.hoisted(() => new WeakSet<object>());
const navigationOwners = vi.hoisted(() => new WeakSet<object>());
const mocks = vi.hoisted(() => ({
  authorizeNavigation: vi.fn(),
  readCustomers: vi.fn(),
  resolveCapability: vi.fn(),
  resolveServerAuthorization: vi.fn(),
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
vi.mock(
  '@/modules/institution/components/InstitutionNavigationShell',
  () => ({
    InstitutionNavigationShell: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="institution-navigation-shell">{children}</div>
    ),
  }),
);

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
      updatedAt: '2026-08-16T08:00:00.000Z',
    }),
  ]),
  pageInfo: Object.freeze({ page: 1, pageSize: 20 as const, hasMore: false }),
});

function readyPage(page: number, hasMore: boolean) {
  return Object.freeze({
    ...ready,
    pageInfo: Object.freeze({ page, pageSize: 20 as const, hasMore }),
  });
}

function linkSearchParams(name: '上一页' | '下一页') {
  const href = screen.getByRole('link', { name }).getAttribute('href');
  if (!href) throw new Error('expected pagination href');
  return new URL(href, 'http://localhost').searchParams;
}

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
  options: Readonly<{
    decision?: 'read_only' | 'hidden';
    summary?: string | null;
  }> = {},
) {
  const decision = options.decision ?? 'read_only';
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
              decision === 'read_only' ? 'pilot_released' : 'not_released',
          }),
          safeSummary:
            options.summary === undefined
              ? decision === 'read_only'
                ? '客户列表仅供查看'
                : null
              : options.summary,
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
});

describe('/hospital/customers readonly release page', () => {
  it('canonical page 存在、force-dynamic，并按 navigation → capability → formal Reader 渲染', async () => {
    expect(
      existsSync(resolve(process.cwd(), 'src/app/hospital/customers/page.tsx')),
    ).toBe(true);
    expect(dynamic).toBe('force-dynamic');

    render(
      await HospitalCustomersPage({
        searchParams: Promise.resolve({ page: '1' }),
      }),
    );
    expect(screen.getByRole('heading', { name: '客户列表' })).toBeInTheDocument();
    expect(screen.getByText('客户甲')).toBeInTheDocument();
    expect(screen.getByText(/咨询中.*高优先级/u)).toBeInTheDocument();
    expect(mocks.authorizeNavigation).toHaveBeenCalledWith({
      targetSectionId: 'customers',
    });
    expect(mocks.readCustomers).toHaveBeenCalledOnce();
    expect(mocks.authorizeNavigation.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.resolveCapability.mock.invocationCallOrder[0]!,
    );
    expect(mocks.resolveCapability.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.readCustomers.mock.invocationCallOrder[0]!,
    );
  });

  it('navigation forbidden 在 capability 与 business Reader 前停止', async () => {
    mocks.authorizeNavigation.mockResolvedValueOnce(navigation('blocked'));
    render(await HospitalCustomersPage({}));
    expect(screen.getByText('当前账号不可访问客户列表')).toBeInTheDocument();
    expect(mocks.resolveCapability).not.toHaveBeenCalled();
    expect(mocks.readCustomers).not.toHaveBeenCalled();
  });

  it('capability hidden/off 不调用 business Reader', async () => {
    mocks.resolveCapability.mockResolvedValueOnce(
      capability({ decision: 'hidden' }),
    );
    render(await HospitalCustomersPage({}));
    expect(screen.getByText('客户列表尚未开放')).toBeInTheDocument();
    expect(mocks.readCustomers).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: 'forbidden' }, '当前账号不可访问客户列表'],
    [{ kind: 'unavailable' }, '客户列表暂时不可用'],
    [
      { kind: 'invalid_query', code: 'invalid_customer_query' },
      '客户查询条件无效',
    ],
  ] as const)('Reader %o 显示安全状态', async (result, title) => {
    mocks.readCustomers.mockResolvedValueOnce(result);
    render(await HospitalCustomersPage({}));
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('page 层保留 duplicate array 与 unknown key 交给 Reader fail-closed', async () => {
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

  it('lifecycle filter 在 previous/next 保留并正确替换 page', async () => {
    mocks.readCustomers.mockResolvedValueOnce(readyPage(2, true));
    render(
      await HospitalCustomersPage({
        searchParams: Promise.resolve({ page: '2', lifecycle: 'consulting' }),
      }),
    );

    const previous = linkSearchParams('上一页');
    const next = linkSearchParams('下一页');
    expect(previous.get('page')).toBe('1');
    expect(next.get('page')).toBe('3');
    expect(previous.get('lifecycle')).toBe('consulting');
    expect(next.get('lifecycle')).toBe('consulting');
    expect(previous.has('priority')).toBe(false);
    expect(next.has('priority')).toBe(false);
  });

  it('priority filter 在 previous/next 保留且不携带不存在的 lifecycle', async () => {
    mocks.readCustomers.mockResolvedValueOnce(readyPage(2, true));
    render(
      await HospitalCustomersPage({
        searchParams: Promise.resolve({ page: '2', priority: 'high' }),
      }),
    );

    for (const name of ['上一页', '下一页'] as const) {
      const params = linkSearchParams(name);
      expect(params.get('priority')).toBe('high');
      expect(params.has('lifecycle')).toBe(false);
    }
  });

  it('lifecycle + priority 在 previous/next 同时保留', async () => {
    mocks.readCustomers.mockResolvedValueOnce(readyPage(4, true));
    render(
      await HospitalCustomersPage({
        searchParams: Promise.resolve({
          page: '4',
          lifecycle: 'post_care',
          priority: 'observe',
        }),
      }),
    );

    const previous = linkSearchParams('上一页');
    const next = linkSearchParams('下一页');
    expect(Object.fromEntries(previous)).toEqual({
      page: '3',
      lifecycle: 'post_care',
      priority: 'observe',
    });
    expect(Object.fromEntries(next)).toEqual({
      page: '5',
      lifecycle: 'post_care',
      priority: 'observe',
    });
  });

  it('page=100 即使 hasMore=true 也不生成 page=101 link', async () => {
    mocks.readCustomers.mockResolvedValueOnce(readyPage(100, true));
    render(
      await HospitalCustomersPage({
        searchParams: Promise.resolve({ page: '100', lifecycle: 'consulting' }),
      }),
    );

    expect(screen.queryByRole('link', { name: '下一页' })).not.toBeInTheDocument();
    expect(linkSearchParams('上一页').get('page')).toBe('99');
  });

  it('source 不导入 legacy shell/client，不发布 mutation 或 create query', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/hospital/customers/page.tsx'),
      'utf8',
    );
    const component = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/customer-center/components/CustomerListReadonlyShell.tsx',
      ),
      'utf8',
    );
    expect(source).toContain('InstitutionNavigationShell');
    expect(source).toContain('readCurrentInstitutionCustomersV1');
    expect(`${source}\n${component}`).not.toMatch(
      /CustomerCenterShell|tenant-business-client|createCustomer|updateCustomer|importCustomer|\?create=1/iu,
    );
  });
});
