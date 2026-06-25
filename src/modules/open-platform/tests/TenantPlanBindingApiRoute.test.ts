import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as tenantPlanOptionsRoute from '@/app/api/v1/open-platform/tenant-plan-options/route';
import * as tenantCreateRoute from '@/app/api/v1/open-platform/tenants/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const repository = {
    listPublishedPlanVersions: vi.fn(),
    findPublishedPlanVersionById: vi.fn(),
    createTenantWithPlanAuthorization: vi.fn(),
  };
  const database = { database: 'tenant-plan-binding-db' };

  return {
    createTenantPlanBindingRepository: vi.fn(() => repository),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    repository,
  };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return {
    ...actual,
    getDatabase: routeMocks.getDatabase,
  };
});

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/server/access-context')>();
  return {
    ...actual,
    getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
  };
});

vi.mock('@/modules/open-platform/server/tenant-plan-binding-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/open-platform/server/tenant-plan-binding-repository')>();
  return {
    ...actual,
    createTenantPlanBindingRepository: routeMocks.createTenantPlanBindingRepository,
  };
});

const platformAdminContext: AccessContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const platformOperatorContext: AccessContext = {
  userId: 'demo-user-platform-operator',
  role: 'platform_operator',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const publishedPlanVersion = {
  planId: 'plan-professional',
  planCode: 'professional',
  planName: 'Professional 专业版',
  planStatus: 'active',
  versionId: 'plan-version-professional-published',
  versionCode: '2026-06-v1',
  status: 'published',
  displayName: 'Professional 专业版 2026-06',
  displayPrice: '¥2999/月',
  priceNote: '展示价格，人工确认口径',
  agentLimit: 3,
  seatLimit: 40,
  monthlyAiCallLimit: 300000,
  knowledgeStorageGb: 100,
  connectorEntitlementsJson: { connectors: ['企微', 'HIS'] },
  serviceEntitlementsJson: { services: ['上线培训'] },
  featureEntitlementsJson: { modules: ['客户管理', '知识库'] },
  quotaEntitlementsJson: { aiCallsPerMonth: 300000 },
};

function request(url: string, init?: RequestInit) {
  return new Request(`http://localhost${url}`, init);
}

function createTenantRequest(body: unknown) {
  return request('/api/v1/open-platform/tenants', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function expectNoSensitivePayload(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /payment_token|webhook_secret|client_secret|api_key|DATABASE_URL|postgres:\/\/|PlaintextPasswordShouldNotPass|requestBody|select \*|stack trace/i,
  );
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.createTenantPlanBindingRepository.mockClear();
  routeMocks.repository.listPublishedPlanVersions.mockReset();
  routeMocks.repository.findPublishedPlanVersionById.mockReset();
  routeMocks.repository.createTenantWithPlanAuthorization.mockReset();
  routeMocks.repository.listPublishedPlanVersions.mockResolvedValue([publishedPlanVersion]);
  routeMocks.repository.findPublishedPlanVersionById.mockResolvedValue(publishedPlanVersion);
  routeMocks.repository.createTenantWithPlanAuthorization.mockImplementation(async (input) => ({
    tenantId: input.tenant.id,
    tenantName: input.tenant.name,
    tenantStatus: 'active',
    createdAt: input.tenant.createdAt.toISOString(),
    updatedAt: input.tenant.updatedAt.toISOString(),
    planName: 'Professional 专业版',
    planCode: 'professional',
    planStatus: 'active',
    planVersionId: 'plan-version-professional-published',
    planVersionCode: '2026-06-v1',
    planDisplayName: 'Professional 专业版 2026-06',
    planDisplayPrice: '¥2999/月',
    assignmentStatus: 'active',
    startedAt: input.assignment.startedAt.toISOString(),
    expiresAt: null,
    agentLimit: 3,
    seatLimit: 40,
    monthlyAiCallLimit: 300000,
    knowledgeStorageGb: 100,
    connectorEntitlements: ['企微', 'HIS'],
    serviceEntitlements: ['上线培训'],
    authorizationSnapshotId: input.authorizationSnapshot.id,
    authorizationSnapshotStatus: 'active',
    authorizationGeneratedAt: input.authorizationSnapshot.generatedAt.toISOString(),
    maxCustomers: null,
    maxAppointments: null,
    maxFollowUps: null,
    maxAiCalls: null,
    currentCustomers: null,
    currentAppointments: null,
    currentFollowUps: null,
    currentAiCalls: null,
    snapshotAt: null,
  }));
});

describe('租户套餐绑定 API', () => {
  it('platform_admin 可读取 published 套餐版本选项', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const response = await tenantPlanOptionsRoute.GET(
      request('/api/v1/open-platform/tenant-plan-options'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.createTenantPlanBindingRepository).toHaveBeenCalledWith(routeMocks.database);
    expect(payload.options).toEqual([
      expect.objectContaining({
        planVersionId: 'plan-version-professional-published',
        displayPrice: '¥2999/月',
        connectorEntitlements: ['企微', 'HIS'],
      }),
    ]);
    expectNoSensitivePayload(payload);
  });

  it('platform_admin 可新建租户、绑定套餐版本并返回授权快照摘要', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const response = await tenantCreateRoute.POST(
      createTenantRequest({
        organizationName: '星澜医美中心',
        planVersionId: 'plan-version-professional-published',
        reason: '测试服开通',
        contactName: '陈磊',
        contactPhone: '13800000000',
        contactEmail: 'contact@example.com',
        adminName: '李静',
        adminAccount: 'xinglan_admin',
        adminContact: 'admin@example.com',
        initialPassword: 'PlaintextPasswordShouldNotPass',
        requestBody: { password: 'PlaintextPasswordShouldNotPass' },
        sql: 'select * from tenants',
        payment_token: 'payment_token_should_not_pass',
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.status).toBe('tenant_created');
    expect(payload.tenant).toEqual(
      expect.objectContaining({
        tenantName: '星澜医美中心',
        planVersionId: 'plan-version-professional-published',
        authorizationSnapshotStatus: 'active',
      }),
    );
    expect(routeMocks.repository.createTenantWithPlanAuthorization).toHaveBeenCalledTimes(1);
    expectNoSensitivePayload(payload);
    expectNoSensitivePayload(routeMocks.repository.createTenantWithPlanAuthorization.mock.calls);
    expect(JSON.stringify(routeMocks.repository.createTenantWithPlanAuthorization.mock.calls)).toContain(
      '13800000000',
    );
    expect(JSON.stringify(routeMocks.repository.createTenantWithPlanAuthorization.mock.calls)).toContain(
      'contact@example.com',
    );
  });

  it('无登录态返回 401 且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const optionsResponse = await tenantPlanOptionsRoute.GET(
      request('/api/v1/open-platform/tenant-plan-options'),
    );
    const createResponse = await tenantCreateRoute.POST(createTenantRequest({}));

    expect(optionsResponse.status).toBe(401);
    expect(createResponse.status).toBe(401);
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('非 platform_admin 写入返回 403 且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformOperatorContext);

    const response = await tenantCreateRoute.POST(
      createTenantRequest({
        organizationName: '星澜医美中心',
        planVersionId: 'plan-version-professional-published',
        reason: '测试服开通',
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, errorCode: 'FORBIDDEN' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('非法 payload 返回 400 且不泄露请求体敏感字段', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const response = await tenantCreateRoute.POST(
      createTenantRequest({
        contactPhone: '13800000000',
        adminContact: 'admin@example.com',
        payment_token: 'payment_token_should_not_pass',
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      ok: false,
      status: 'validation_error',
      errors: ['TENANT_NAME_REQUIRED', 'PLAN_VERSION_REQUIRED', 'REASON_REQUIRED'],
    });
    expectNoSensitivePayload(payload);
  });

  it('未发布或不存在的套餐版本返回 404', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    routeMocks.repository.findPublishedPlanVersionById.mockResolvedValue(null);

    const response = await tenantCreateRoute.POST(
      createTenantRequest({
        organizationName: '星澜医美中心',
        planVersionId: 'plan-version-draft',
        reason: '测试服开通',
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      errorCode: 'PUBLISHED_PLAN_VERSION_NOT_FOUND',
    });
  });

  it('数据服务异常返回稳定低敏 503', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const response = await tenantPlanOptionsRoute.GET(
      request('/api/v1/open-platform/tenant-plan-options'),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ ok: false, errorCode: 'TENANT_PLAN_BINDING_UNAVAILABLE' });
    expectNoSensitivePayload(payload);
  });
});
