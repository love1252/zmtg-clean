import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestOwners = vi.hoisted(() => new WeakSet<object>());
const navigationOwners = vi.hoisted(() => new WeakSet<object>());
const mocks = vi.hoisted(() => ({
  authorizeNavigation: vi.fn(),
  readAppointments: vi.fn(),
  resolveCapability: vi.fn(),
  resolveServerAuthorization: vi.fn(),
  canCreateAppointment: vi.fn(),
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
vi.mock('@/server/orchestration/institution-appointment-list-reader', () => ({
  readCurrentInstitutionAppointmentsV1: mocks.readAppointments,
}));
vi.mock('@/server/orchestration/institution-care-create-availability', () => ({
  canCurrentInstitutionCreateFormalAppointmentV1:
    mocks.canCreateAppointment,
}));
vi.mock(
  '@/modules/institution/components/InstitutionNavigationShell',
  () => ({
    InstitutionNavigationShell: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="institution-navigation-shell">{children}</div>
    ),
  }),
);

import HospitalCareAppointmentsPage, {
  dynamic,
} from '@/app/hospital/care/appointments/page';

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
      appointmentId: 'appointment-001',
      scheduledAt: '2026-08-16T08:30:00.000Z',
      status: 'pending_confirmation' as const,
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
    targetSectionId: 'care',
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
        key: 'page_care_appointments',
        readiness: 'ready',
        failureCode: null,
      }),
    ]),
    data: Object.freeze({
      capabilities: Object.freeze([
        Object.freeze({
          key: 'page_care_appointments',
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
              ? '预约管理仅供查看'
              : decision === 'operational'
                ? '预约管理可用'
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
  mocks.readAppointments.mockResolvedValue(ready);
  mocks.canCreateAppointment.mockResolvedValue(true);
});

describe('/hospital/care/appointments readonly release page', () => {
  it('canonical page 存在、force-dynamic，并按安全顺序渲染低敏预约', async () => {
    expect(
      existsSync(
        resolve(process.cwd(), 'src/app/hospital/care/appointments/page.tsx'),
      ),
    ).toBe(true);
    expect(dynamic).toBe('force-dynamic');
    render(
      await HospitalCareAppointmentsPage({
        searchParams: Promise.resolve({ status: 'pending_confirmation' }),
      }),
    );
    expect(screen.getByRole('heading', { name: '预约管理' })).toBeInTheDocument();
    expect(screen.getByText('待确认')).toBeInTheDocument();
    expect(screen.getByText(/预约时间 2026-08-16/u)).toBeInTheDocument();
    expect(screen.getByText('READ ONLY')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: '查看 / 操作' }),
    ).not.toBeInTheDocument();
    expect(mocks.authorizeNavigation).toHaveBeenCalledWith({
      targetSectionId: 'care',
    });
    expect(mocks.resolveCapability.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.readAppointments.mock.invocationCallOrder[0]!,
    );
  });

  it.each(['pending_confirmation', 'reschedule_requested'] as const)(
    '保留 Workbench status=%s query 给 formal Reader',
    async (status) => {
      render(
        await HospitalCareAppointmentsPage({
          searchParams: Promise.resolve({ status }),
        }),
      );
      const params = mocks.readAppointments.mock.calls[0]?.[0] as URLSearchParams;
      expect(params.get('status')).toBe(status);
    },
  );

  it('operational capability + management availability exposes controlled create without changing list Reader query', async () => {
    mocks.resolveCapability.mockResolvedValueOnce(
      capability('operational'),
    );
    render(
      await HospitalCareAppointmentsPage({
        searchParams: Promise.resolve({ create: '1' }),
      }),
    );
    expect(
      screen.getByRole('heading', { name: '新建预约' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('CONTROLLED WRITE'),
    ).toBeInTheDocument();
    const detailLink = screen.getByRole('link', {
      name: '查看 / 操作',
    });
    expect(detailLink).toHaveAttribute(
      'href',
      '/hospital/care/appointments/appointment-001',
    );
    const params =
      mocks.readAppointments.mock.calls[0]?.[0] as URLSearchParams;
    expect(params.has('create')).toBe(false);
    expect(mocks.canCreateAppointment).toHaveBeenCalledTimes(1);
  });

  it('navigation forbidden 与 capability hidden 均不调用 business Reader', async () => {
    mocks.authorizeNavigation.mockResolvedValueOnce(navigation('blocked'));
    const blocked = render(await HospitalCareAppointmentsPage({}));
    expect(screen.getByText('当前账号不可访问预约管理')).toBeInTheDocument();
    expect(mocks.resolveCapability).not.toHaveBeenCalled();
    expect(mocks.readAppointments).not.toHaveBeenCalled();
    blocked.unmount();

    mocks.authorizeNavigation.mockResolvedValueOnce(navigation('allowed'));
    mocks.resolveCapability.mockResolvedValueOnce(capability('hidden'));
    render(await HospitalCareAppointmentsPage({}));
    expect(screen.getByText('预约管理尚未开放')).toBeInTheDocument();
    expect(mocks.readAppointments).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: 'forbidden' }, '当前账号不可访问预约管理'],
    [{ kind: 'unavailable' }, '预约管理暂时不可用'],
    [
      { kind: 'invalid_query', code: 'invalid_appointment_query' },
      '预约查询条件无效',
    ],
  ] as const)('Reader %o 显示安全状态', async (result, title) => {
    mocks.readAppointments.mockResolvedValueOnce(result);
    render(await HospitalCareAppointmentsPage({}));
    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('duplicate/unknown search params 不在 page 层丢弃', async () => {
    render(
      await HospitalCareAppointmentsPage({
        searchParams: Promise.resolve({
          status: ['pending_confirmation', 'reschedule_requested'],
          unknown: 'value',
        }),
      }),
    );
    const params = mocks.readAppointments.mock.calls[0]?.[0] as URLSearchParams;
    expect(params.getAll('status')).toEqual([
      'pending_confirmation',
      'reschedule_requested',
    ]);
    expect(params.getAll('unknown')).toEqual(['value']);
  });

  it('合法页码翻页时保留 status 并正确替换 page', async () => {
    mocks.readAppointments.mockResolvedValueOnce(readyPage(2, true));
    render(
      await HospitalCareAppointmentsPage({
        searchParams: Promise.resolve({
          page: '2',
          status: 'reschedule_requested',
        }),
      }),
    );

    const previous = linkSearchParams('上一页');
    const next = linkSearchParams('下一页');
    expect(Object.fromEntries(previous)).toEqual({
      page: '1',
      status: 'reschedule_requested',
    });
    expect(Object.fromEntries(next)).toEqual({
      page: '3',
      status: 'reschedule_requested',
    });
  });

  it('page=100 即使 hasMore=true 也不生成 page=101 link', async () => {
    mocks.readAppointments.mockResolvedValueOnce(readyPage(100, true));
    render(
      await HospitalCareAppointmentsPage({
        searchParams: Promise.resolve({
          page: '100',
          status: 'pending_confirmation',
        }),
      }),
    );

    expect(screen.queryByRole('link', { name: '下一页' })).not.toBeInTheDocument();
    const previous = linkSearchParams('上一页');
    expect(previous.get('page')).toBe('99');
    expect(previous.get('status')).toBe('pending_confirmation');
  });

  it('页面和 DTO view 不包含 legacy owner、mutation 或扩展业务字段', () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), 'src/app/hospital/care/appointments/page.tsx'),
      'utf8',
    );
    const componentSource = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/care/components/AppointmentListReadonlyShell.tsx',
      ),
      'utf8',
    );
    expect(pageSource).toContain('InstitutionNavigationShell');
    expect(pageSource).toContain('readCurrentInstitutionAppointmentsV1');
    expect(`${pageSource}\n${componentSource}`).not.toMatch(
      /AppointmentCenterShell|tenant-business-client|createAppointment|updateAppointment|\?create=1|customerDisplayName|project|consultantUserId|note|treatment/iu,
    );
  });
});
