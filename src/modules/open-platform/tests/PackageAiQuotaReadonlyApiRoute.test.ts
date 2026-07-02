import { describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/v1/open-platform/package-ai-quota/route';

const routeMocks = vi.hoisted(() => ({
  getDemoAccessContextFromRequest: vi.fn(),
  canAccessResource: vi.fn(),
  getDatabase: vi.fn(() => {
    throw new Error('package-ai-quota readonly route must not access database');
  }),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));

vi.mock('@/modules/security/domain/access-control', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/domain/access-control')>();
  return {
    ...actual,
    canAccessResource: routeMocks.canAccessResource,
  };
});

vi.mock('@/server/db/client', () => ({
  getDatabase: routeMocks.getDatabase,
}));

const platformContext = {
  userId: 'platform-admin',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const tenantContext = {
  userId: 'tenant-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-demo-low-sensitive',
  source: 'demo_session',
};

function request(path = '/api/v1/open-platform/package-ai-quota') {
  return new Request(`http://localhost${path}`, {
    headers: { 'content-type': 'application/json' },
  });
}

function expectNoSensitivePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toMatch(
    /apiKey|encryptedApiKey|Authorization|Cookie|prompt|answer|rawResponse|metadata|meteringDetails|realCostAmount|客户姓名|手机号|身份证|病历详情|shouldDeduct|deducted|shouldAlert|exportUrl/i,
  );
}

describe('平台端 GET /api/v1/open-platform/package-ai-quota', () => {
  it('未登录返回低敏 401', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, errorCode: 'UNAUTHORIZED' });
  });

  it('非平台账号返回低敏 403', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.canAccessResource.mockReturnValue({ allowed: true });

    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, errorCode: 'FORBIDDEN' });
  });

  it('平台账号返回 mock-based readonly DTO 且不访问 DB', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);
    routeMocks.canAccessResource.mockReturnValue({ allowed: true });

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();

    const payload = await response.json();
    expect(payload.requestId).toBe('platform-package-ai-quota-readonly');
    expect(payload.readonly).toBe(true);
    expect(payload.packages).toHaveLength(3);
    expect(payload.entitlements.length).toBeGreaterThan(0);
    expect(payload.tenantBindings.length).toBeGreaterThan(0);
    expect(payload.tenantQuotaSummaries.length).toBeGreaterThan(0);
    expect(payload.serviceProjectQuotaAttributions.length).toBeGreaterThan(0);
    expect(payload.quotaStatuses.map((item: { status: string }) => item.status)).toEqual([
      'unlinked',
      'active',
      'warning',
      'overLimit',
      'expired',
    ]);
    expect(payload.notes).toEqual(
      expect.arrayContaining([expect.stringContaining('mock/fixture-based readonly contract')]),
    );
    expectNoSensitivePayload(payload);
  });

  it('支持 query 筛选 fixture 数据', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);
    routeMocks.canAccessResource.mockReturnValue({ allowed: true });

    const response = await GET(request('/api/v1/open-platform/package-ai-quota?packageCode=basic&quotaStatus=active'));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.filters).toEqual({
      tenantId: null,
      packageCode: 'basic',
      quotaStatus: 'active',
    });
    expect(payload.packages.map((item: { packageCode: string }) => item.packageCode)).toEqual(['basic']);
    expect(payload.tenantQuotaSummaries).toHaveLength(1);
    expect(payload.tenantQuotaSummaries[0].quota.status).toBe('active');
    expectNoSensitivePayload(payload);
  });
});
