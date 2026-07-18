import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/institution/opportunities/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => ({
  createTenantBusinessRepository: vi.fn(),
  generateOpportunityPools: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return {
    ...actual,
    getDatabase: routeMocks.getDatabase,
  };
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
  return {
    ...actual,
    generateOpportunityPools: routeMocks.generateOpportunityPools,
  };
});

const tenantAdminContext: AccessContext = {
  userId: 'tenant-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  source: 'demo_session',
};

function request() {
  return new Request('http://localhost/api/institution/opportunities');
}

beforeEach(() => {
  routeMocks.createTenantBusinessRepository.mockReset();
  routeMocks.generateOpportunityPools.mockReset();
  routeMocks.getDatabase.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantAdminContext);
});

describe('legacy opportunity-pool API route', () => {
  it('keeps the unauthenticated boundary', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
  });

  it('fails closed instead of turning tenant/demo customer facts into analytics opportunities', async () => {
    const response = await GET(request());

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: '旧机会池不提供机构级经营分析数据',
      code: 'legacy_opportunity_pool_disabled',
    });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.generateOpportunityPools).not.toHaveBeenCalled();
  });
});
