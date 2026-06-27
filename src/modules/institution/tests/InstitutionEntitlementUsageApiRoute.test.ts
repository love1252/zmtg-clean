import { describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/institution/entitlement-usage/route';

const routeMocks = vi.hoisted(() => {
  const database = { database: 'entitlement-usage-api-test-db' };
  const getTenantEntitlementUsageService = vi.fn();
  return {
    database,
    getDatabase: vi.fn(() => database),
    getDemoAccessContextFromRequest: vi.fn(),
    getTenantEntitlementUsageService,
  };
});

vi.mock('@/server/db/client', () => ({
  getDatabase: routeMocks.getDatabase,
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));

vi.mock('@/modules/institution/server/entitlement-usage-service', () => ({
  getTenantEntitlementUsageService: routeMocks.getTenantEntitlementUsageService,
}));

function createMockRequest(init?: { headers?: Record<string, string> }): Request {
  return new Request('http://localhost:3000/api/institution/entitlement-usage', {
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

const mockView = {
  tenantId: 'demo-tenant-001',
  institutionId: 'inst-001',
  planCode: 'growth-care',
  planName: '成长版',
  items: [
    { resource: 'customers', label: '客户数', used: 80, limit: 100, remaining: 20, status: 'normal' },
    { resource: 'staff_seats', label: '员工席位', used: 15, limit: 20, remaining: 5, status: 'normal' },
    { resource: 'knowledge_files', label: '知识库文件', used: 90, limit: 100, remaining: 10, status: 'near_limit' },
    { resource: 'ai_calls', label: 'AI 调用（本月）', used: 200, limit: 500, remaining: 300, status: 'normal' },
  ],
  readable: true,
  source: 'mixed' as const,
};

describe('机构端 GET /api/institution/entitlement-usage', () => {
  // 1. 未登录返回 401
  it('未登录返回 401', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    const response = await GET(createMockRequest());
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('unauthorized');
  });

  // 2. 平台账号访问返回 403
  it('平台 scope 访问返回 403', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      userId: 'platform-admin',
      role: 'platform_admin',
      scope: 'platform',
      tenantId: null,
      source: 'demo_session',
    });
    const response = await GET(createMockRequest());
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('forbidden');
  });

  it('tenant scope 无 tenantId 返回 403', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      userId: 'user-no-tenant',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: null,
      source: 'demo_session',
    });
    const response = await GET(createMockRequest());
    expect(response.status).toBe(403);
  });

  // 3. 机构账号成功读取自己 tenant 的用量
  it('机构账号返回 200 和用量视图', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      userId: 'tenant-admin',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'demo-tenant-001',
      institutionId: 'inst-001',
      source: 'demo_session',
    });
    routeMocks.getTenantEntitlementUsageService.mockResolvedValue(mockView);

    const response = await GET(createMockRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.tenantId).toBe('demo-tenant-001');
    expect(body.planCode).toBe('growth-care');
    expect(body.planName).toBe('成长版');
    expect(body.items).toHaveLength(4);
    expect(body.readable).toBe(true);
  });

  // 4. 不接受客户端 tenantId 覆盖
  it('始终使用 accessContext.tenantId 不从请求参数取值', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      userId: 'tenant-admin',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'demo-tenant-001',
      institutionId: 'inst-001',
      source: 'demo_session',
    });
    routeMocks.getTenantEntitlementUsageService.mockResolvedValue(mockView);

    await GET(createMockRequest());

    // service 调用应使用 accessContext.tenantId
    expect(routeMocks.getTenantEntitlementUsageService).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'demo-tenant-001',
        institutionId: 'inst-001',
      }),
    );
  });

  // 5. service 异常返回 503
  it('service 异常返回 503', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      userId: 'tenant-admin',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'demo-tenant-001',
      institutionId: 'inst-001',
      source: 'demo_session',
    });
    routeMocks.getTenantEntitlementUsageService.mockRejectedValue(new Error('db error'));

    const response = await GET(createMockRequest());
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe('service_unavailable');
  });

  // 6. response 不泄露敏感字段
  it('response 不泄露数据库连接串', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      userId: 'tenant-admin',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'demo-tenant-001',
      institutionId: 'inst-001',
      source: 'demo_session',
    });
    routeMocks.getTenantEntitlementUsageService.mockResolvedValue(mockView);

    const response = await GET(createMockRequest());
    const bodyText = JSON.stringify(await response.json());

    expect(bodyText).not.toContain('DATABASE_URL');
    expect(bodyText).not.toContain('postgres://');
    expect(bodyText).not.toContain('secret');
    expect(bodyText).not.toContain('password');
    expect(bodyText).not.toContain('token');
    expect(bodyText).not.toContain('api_key');
    expect(bodyText).not.toContain('stack');
    expect(bodyText).not.toContain('sql');
    expect(bodyText).not.toContain('baseUrl');
  });

  // 7. cross-tenant 隔离
  it('不同 tenantId 不会泄露到 response 中', async () => {
    const otherTenantView = {
      ...mockView,
      tenantId: 'other-tenant-999',
      planCode: 'enterprise',
      planName: '集团版',
    };

    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      userId: 'tenant-admin-other',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'other-tenant-999',
      institutionId: 'inst-999',
      source: 'demo_session',
    });
    routeMocks.getTenantEntitlementUsageService.mockResolvedValue(otherTenantView);

    const response = await GET(createMockRequest());
    const body = await response.json();

    // service 用正确的 tenantId 调用
    expect(routeMocks.getTenantEntitlementUsageService).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'other-tenant-999' }),
    );
    expect(body.tenantId).toBe('other-tenant-999');
    expect(body.planCode).toBe('enterprise');
  });
});
