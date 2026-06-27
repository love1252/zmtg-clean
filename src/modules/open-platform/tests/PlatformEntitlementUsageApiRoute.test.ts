import { describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/v1/open-platform/tenants/[tenantId]/entitlement-usage/route';

const routeMocks = vi.hoisted(() => {
  const database = { database: 'platform-entitlement-usage-api-test-db' };
  const getTenantEntitlementUsageService = vi.fn();
  return {
    database,
    getDatabase: vi.fn(() => database),
    getDemoAccessContextFromRequest: vi.fn(),
    getTenantEntitlementUsageService,
    canAccessResource: vi.fn(),
  };
});

vi.mock('@/server/db/client', () => ({
  getDatabase: routeMocks.getDatabase,
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

vi.mock('@/modules/institution/server/entitlement-usage-service', () => ({
  getTenantEntitlementUsageService: routeMocks.getTenantEntitlementUsageService,
}));

function createMockRequest(init?: { headers?: Record<string, string> }): Request {
  return new Request('http://localhost:3000/api/v1/open-platform/tenants/demo-tenant-001/entitlement-usage', {
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
  tenantId: 'demo-tenant-001',
  institutionId: 'inst-001',
  source: 'demo_session',
};

describe('平台端 GET /api/v1/open-platform/tenants/[tenantId]/entitlement-usage', () => {
  // 1. 未登录返回 401
  it('未登录返回 401', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    const response = await GET(createMockRequest(), { params: Promise.resolve({ tenantId: 'demo-tenant-001' }) });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('unauthorized');
  });

  // 2. 机构账号访问返回 403
  it('机构 scope 访问返回 403', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.canAccessResource.mockReturnValue({ allowed: true });

    const response = await GET(createMockRequest(), { params: Promise.resolve({ tenantId: 'demo-tenant-001' }) });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('forbidden');
  });

  // 3. 平台账号可读取指定 tenant
  it('平台账号返回 200 和指定 tenant 用量视图', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);
    routeMocks.canAccessResource.mockReturnValue({ allowed: true });
    routeMocks.getTenantEntitlementUsageService.mockResolvedValue(mockView);

    const response = await GET(createMockRequest(), { params: Promise.resolve({ tenantId: 'demo-tenant-001' }) });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.tenantId).toBe('demo-tenant-001');
    expect(body.planCode).toBe('growth-care');
    expect(body.planName).toBe('成长版');
    expect(body.items).toHaveLength(4);
  });

  // 4. tenantId 从 route params 获取
  it('tenantId 从 route params 取值', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);
    routeMocks.canAccessResource.mockReturnValue({ allowed: true });
    routeMocks.getTenantEntitlementUsageService.mockResolvedValue(mockView);

    const response = await GET(createMockRequest(), { params: Promise.resolve({ tenantId: 'tenant-abc-123' }) });
    expect(response.status).toBe(200);

    expect(routeMocks.getTenantEntitlementUsageService).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-abc-123' }),
    );
  });

  // 5. 权限校验失败返回 403
  it('canAccessResource 拒绝时返回 403', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);
    routeMocks.canAccessResource.mockReturnValue({ allowed: false });

    const response = await GET(createMockRequest(), { params: Promise.resolve({ tenantId: 'demo-tenant-001' }) });
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('forbidden');
  });

  // 6. service 异常返回 503
  it('service 异常返回 503', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);
    routeMocks.canAccessResource.mockReturnValue({ allowed: true });
    routeMocks.getTenantEntitlementUsageService.mockRejectedValue(new Error('db error'));

    const response = await GET(createMockRequest(), { params: Promise.resolve({ tenantId: 'demo-tenant-001' }) });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe('service_unavailable');
  });

  // 7. response 不泄露敏感字段
  it('response 不泄露数据库连接串和密钥', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);
    routeMocks.canAccessResource.mockReturnValue({ allowed: true });
    routeMocks.getTenantEntitlementUsageService.mockResolvedValue(mockView);

    const response = await GET(createMockRequest(), { params: Promise.resolve({ tenantId: 'demo-tenant-001' }) });
    const bodyText = JSON.stringify(await response.json());

    // 标准字段存在
    expect(bodyText).toContain('tenantId');
    expect(bodyText).toContain('planCode');
    expect(bodyText).toContain('items');

    // 不泄露服务器敏感信息
    expect(bodyText).not.toContain('DATABASE_URL');
    expect(bodyText).not.toContain('postgres://');
    expect(bodyText).not.toContain('connectionString');
    expect(bodyText).not.toContain('sql');
    expect(bodyText).not.toContain('stack');
    expect(bodyText).not.toContain('secret');
    expect(bodyText).not.toContain('password');
    expect(bodyText).not.toContain('token');
    expect(bodyText).not.toContain('api_key');
    expect(bodyText).not.toContain('baseUrl');
    expect(bodyText).not.toContain('authorization');
    expect(bodyText).not.toContain('accessContext');
    expect(bodyText).not.toContain('userId');
    expect(bodyText).not.toContain('role');
  });

  // 8. 跨租户隔离
  it('不同 tenantId 使用不同的 params 不串号', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);
    routeMocks.canAccessResource.mockReturnValue({ allowed: true });
    routeMocks.getTenantEntitlementUsageService.mockResolvedValue({ ...mockView, tenantId: 'tenant-bbb' });

    const response = await GET(createMockRequest(), { params: Promise.resolve({ tenantId: 'tenant-bbb' }) });
    expect(response.status).toBe(200);

    expect(routeMocks.getTenantEntitlementUsageService).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-bbb' }),
    );
  });
});
