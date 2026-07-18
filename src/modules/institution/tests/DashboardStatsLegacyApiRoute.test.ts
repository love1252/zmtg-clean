import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/institution/dashboard-stats/route';
import type { DecodedAuthSession } from '@/modules/auth/domain/session';
import {
  DEMO_SESSION_COOKIE,
  encodeDemoSession,
} from '@/modules/auth/server/demo-session';

const routeMocks = vi.hoisted(() => ({
  createAuditEventRepository: vi.fn(),
  createTenantBusinessRepository: vi.fn(),
  deriveSafetySwitchViewModel: vi.fn(),
  generateOpportunityPools: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return { ...actual, getDatabase: routeMocks.getDatabase };
});

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/security/server/access-context')
  >();
  return {
    ...actual,
    getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
  };
});

vi.mock('@/modules/institution/server/tenant-business-repository', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/tenant-business-repository')
  >();
  return {
    ...actual,
    createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
  };
});

vi.mock('@/modules/institution/server/opportunity-pool-service', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/opportunity-pool-service')
  >();
  return { ...actual, generateOpportunityPools: routeMocks.generateOpportunityPools };
});

vi.mock('@/modules/security/domain/safety-switch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/domain/safety-switch')>();
  return { ...actual, deriveSafetySwitchViewModel: routeMocks.deriveSafetySwitchViewModel };
});

vi.mock('@/modules/audit/server/audit-event-repository', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/audit/server/audit-event-repository')
  >();
  return { ...actual, createAuditEventRepository: routeMocks.createAuditEventRepository };
});

const tenantAdminSession: DecodedAuthSession = {
  user: {
    id: 'tenant-admin',
    username: 'tenant-admin',
    name: 'Tenant Admin',
    role: 'tenant_admin',
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
  },
  expiresAt: Date.now() + 60_000,
  source: 'demo_session',
};

function request(session?: DecodedAuthSession) {
  return new Request('http://localhost/api/institution/dashboard-stats', {
    headers: session
      ? { cookie: `${DEMO_SESSION_COOKIE}=${encodeDemoSession(session)}` }
      : undefined,
  });
}

function expectLegacyDataChainUnused() {
  expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
  expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
  expect(routeMocks.generateOpportunityPools).not.toHaveBeenCalled();
  expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
  expect(routeMocks.deriveSafetySwitchViewModel).not.toHaveBeenCalled();
}

async function expectLegacyDisabled(response: Response) {
  expect(response.status).toBe(410);
  const payload = await response.json() as Record<string, unknown>;
  expect(payload).toEqual({
    error: '旧经营看板统计不提供机构级经营分析数据',
    code: 'legacy_dashboard_stats_disabled',
  });
  expect(payload).not.toHaveProperty('opportunityCount');
  expect(payload).not.toHaveProperty('customerCount');
  expect(payload).not.toHaveProperty('customers');
  expect(payload).not.toHaveProperty('records');
}

beforeEach(() => {
  for (const mock of Object.values(routeMocks)) mock.mockReset();
});

describe('legacy dashboard-stats API route', () => {
  it('returns the fixed disabled response before parsing an unsigned request', async () => {
    await expectLegacyDisabled(await GET(request()));
    expectLegacyDataChainUnused();
  });

  it('returns the same disabled response before parsing a signed demo session', async () => {
    await expectLegacyDisabled(await GET(request(tenantAdminSession)));
    expectLegacyDataChainUnused();
  });

  it('does not access a hostile Request proxy', async () => {
    let propertyReads = 0;
    const hostileRequest = new Proxy({} as Request, {
      get() {
        propertyReads += 1;
        throw new Error('request_must_not_be_read');
      },
    });

    await expectLegacyDisabled(await GET(hostileRequest));
    expect(propertyReads).toBe(0);
    expectLegacyDataChainUnused();
  });
});
