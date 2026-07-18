import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/institution/opportunities/route';
import type { DecodedAuthSession } from '@/modules/auth/domain/session';
import {
  DEMO_SESSION_COOKIE,
  encodeDemoSession,
} from '@/modules/auth/server/demo-session';

const routeMocks = vi.hoisted(() => ({
  createTenantBusinessRepository: vi.fn(),
  generateOpportunityPools: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return {
    ...actual,
    getDatabase: routeMocks.getDatabase,
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
  return {
    ...actual,
    generateOpportunityPools: routeMocks.generateOpportunityPools,
  };
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

const platformAdminSession: DecodedAuthSession = {
  user: {
    id: 'platform-admin',
    username: 'platform-admin',
    name: 'Platform Admin',
    role: 'platform_admin',
    tenantId: null,
  },
  expiresAt: Date.now() + 60_000,
  source: 'demo_session',
};

function request(session?: DecodedAuthSession) {
  return new Request('http://localhost/api/institution/opportunities', {
    headers: session
      ? { cookie: `${DEMO_SESSION_COOKIE}=${encodeDemoSession(session)}` }
      : undefined,
  });
}

function expectLegacyDataChainUnused() {
  expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
  expect(routeMocks.generateOpportunityPools).not.toHaveBeenCalled();
}

beforeEach(() => {
  routeMocks.createTenantBusinessRepository.mockReset();
  routeMocks.generateOpportunityPools.mockReset();
  routeMocks.getDatabase.mockReset();
});

describe('legacy opportunity-pool API route', () => {
  it('keeps the unauthenticated boundary', async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expectLegacyDataChainUnused();
  });

  it('keeps the platform-scope forbidden boundary without querying legacy data', async () => {
    const response = await GET(request(platformAdminSession));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expectLegacyDataChainUnused();
  });

  it('fails closed instead of turning tenant/demo customer facts into analytics opportunities', async () => {
    const response = await GET(request(tenantAdminSession));

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: '旧机会池不提供机构级经营分析数据',
      code: 'legacy_opportunity_pool_disabled',
    });
    expectLegacyDataChainUnused();
  });
});
