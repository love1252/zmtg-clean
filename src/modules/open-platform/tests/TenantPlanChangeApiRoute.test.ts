import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as planChangePreviewRoute from '@/app/api/v1/open-platform/tenants/[tenantId]/plan-change-preview/route';
import * as planChangeRoute from '@/app/api/v1/open-platform/tenants/[tenantId]/plan-change/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const repository = {
    findCurrentTenantPlanState: vi.fn(),
    findPublishedPlanVersionById: vi.fn(),
    applyTenantPlanChange: vi.fn(),
  };
  const database = { database: 'tenant-plan-change-db' };

  return {
    createTenantPlanChangeRepository: vi.fn(() => repository),
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

vi.mock('@/modules/open-platform/server/tenant-plan-change-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/open-platform/server/tenant-plan-change-repository')>();
  return {
    ...actual,
    createTenantPlanChangeRepository: routeMocks.createTenantPlanChangeRepository,
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

const currentPlanVersion = {
  planId: 'plan-growth',
  planCode: 'growth-care',
  planName: 'Growth 成长版',
  planStatus: 'active',
  versionId: 'plan-version-growth-202606',
  versionCode: '2026-06-v1',
  status: 'published',
  displayName: 'Growth 成长版 2026-06',
  displayPrice: '¥1999/月',
  priceNote: '展示价格，人工确认口径',
  agentLimit: 2,
  seatLimit: 20,
  monthlyAiCallLimit: 100000,
  knowledgeStorageGb: 50,
  connectorEntitlementsJson: { connectors: ['企微'] },
  serviceEntitlementsJson: { services: ['基础培训'] },
  featureEntitlementsJson: {},
  quotaEntitlementsJson: {},
};

const targetPlanVersion = {
  ...currentPlanVersion,
  planId: 'plan-professional',
  planCode: 'professional',
  planName: 'Professional 专业版',
  versionId: 'plan-version-professional-202606',
  displayName: 'Professional 专业版 2026-06',
  displayPrice: '¥2999/月',
  agentLimit: 3,
  seatLimit: 40,
  monthlyAiCallLimit: 300000,
  knowledgeStorageGb: 100,
  connectorEntitlementsJson: { connectors: ['企微', 'HIS'] },
  serviceEntitlementsJson: { services: ['上线培训'] },
};

const currentTenantState = {
  tenant: {
    id: 'tenant-001',
    name: '星澜医美中心',
    status: 'active',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
  },
  assignment: {
    id: 'assignment-growth-active',
    tenantId: 'tenant-001',
    planId: 'plan-growth',
    planVersionId: 'plan-version-growth-202606',
    status: 'active',
    startedAt: new Date('2026-06-01T00:00:00.000Z'),
    expiresAt: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
  },
  planVersion: currentPlanVersion,
  authorizationSnapshot: {
    id: 'auth-snapshot-growth-active',
    tenantId: 'tenant-001',
    planAssignmentId: 'assignment-growth-active',
    planVersionId: 'plan-version-growth-202606',
    status: 'active',
    generatedAt: new Date('2026-06-01T00:00:00.000Z'),
  },
};

function request(url: string, body: unknown = {}) {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function routeContext(tenantId = 'tenant-001') {
  return { params: Promise.resolve({ tenantId }) };
}

function expectNoSensitivePayload(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /13800000000|payment_token|webhook_secret|client_secret|api_key|DATABASE_URL|postgres:\/\//i,
  );
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.createTenantPlanChangeRepository.mockClear();
  routeMocks.repository.findCurrentTenantPlanState.mockReset();
  routeMocks.repository.findPublishedPlanVersionById.mockReset();
  routeMocks.repository.applyTenantPlanChange.mockReset();
  routeMocks.repository.findCurrentTenantPlanState.mockResolvedValue(currentTenantState);
  routeMocks.repository.findPublishedPlanVersionById.mockResolvedValue(targetPlanVersion);
  routeMocks.repository.applyTenantPlanChange.mockImplementation(async (input) => ({
    status: 'plan_changed',
    changeRecordId: input.changeRecord.id,
    auditEventId: input.auditEvent.eventId,
    tenant: {
      tenantId: input.tenant.id,
      tenantName: input.tenant.name,
      tenantStatus: input.tenant.status,
      createdAt: input.tenant.createdAt.toISOString(),
      updatedAt: input.appliedAt.toISOString(),
      planName: targetPlanVersion.planName,
      planCode: targetPlanVersion.planCode,
      planStatus: targetPlanVersion.planStatus,
      planVersionId: targetPlanVersion.versionId,
      planVersionCode: targetPlanVersion.versionCode,
      planDisplayName: targetPlanVersion.displayName,
      planDisplayPrice: targetPlanVersion.displayPrice,
      assignmentStatus: input.newAssignment.status,
      startedAt: input.newAssignment.startedAt.toISOString(),
      expiresAt: null,
      agentLimit: targetPlanVersion.agentLimit,
      seatLimit: targetPlanVersion.seatLimit,
      monthlyAiCallLimit: targetPlanVersion.monthlyAiCallLimit,
      knowledgeStorageGb: targetPlanVersion.knowledgeStorageGb,
      connectorEntitlements: ['企微', 'HIS'],
      serviceEntitlements: ['上线培训'],
      authorizationSnapshotId: input.newAuthorizationSnapshot.id,
      authorizationSnapshotStatus: input.newAuthorizationSnapshot.status,
      authorizationGeneratedAt: input.newAuthorizationSnapshot.generatedAt.toISOString(),
      maxCustomers: null,
      maxAppointments: null,
      maxFollowUps: null,
      maxAiCalls: null,
      currentCustomers: null,
      currentAppointments: null,
      currentFollowUps: null,
      currentAiCalls: null,
      snapshotAt: null,
    },
  }));
});

describe('租户套餐变更 API', () => {
  it('platform_admin 可预览套餐变更差异且不写入变更', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const response = await planChangePreviewRoute.POST(
      request('/api/v1/open-platform/tenants/tenant-001/plan-change-preview', {
        toPlanVersionId: 'plan-version-professional-202606',
        reason: '机构升级到专业版',
      }),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('preview_ready');
    expect(payload.preview).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-001',
        changedItemCount: 8,
      }),
    );
    expect(routeMocks.repository.applyTenantPlanChange).not.toHaveBeenCalled();
    expectNoSensitivePayload(payload);
  });

  it('platform_admin 可应用套餐变更并返回新授权快照、change record 和 audit id', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const response = await planChangeRoute.POST(
      request('/api/v1/open-platform/tenants/tenant-001/plan-change', {
        toPlanVersionId: 'plan-version-professional-202606',
        reason: '机构升级到专业版',
        payment_token: 'payment_token_should_not_pass',
        contactPhone: '13800000000',
      }),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('plan_changed');
    expect(payload.changeRecordId).toMatch(/^tenant-plan-change-/u);
    expect(payload.auditEventId).toMatch(/^audit-event-/u);
    expect(payload.tenant).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-001',
        planVersionId: 'plan-version-professional-202606',
        authorizationSnapshotStatus: 'active',
      }),
    );
    expect(routeMocks.repository.applyTenantPlanChange).toHaveBeenCalledTimes(1);
    expectNoSensitivePayload(payload);
    expectNoSensitivePayload(routeMocks.repository.applyTenantPlanChange.mock.calls);
  });

  it('无登录态或非 platform_admin 返回低敏错误且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const unauthorized = await planChangePreviewRoute.POST(
      request('/api/v1/open-platform/tenants/tenant-001/plan-change-preview'),
      routeContext(),
    );
    expect(unauthorized.status).toBe(401);

    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformOperatorContext);
    const forbidden = await planChangeRoute.POST(
      request('/api/v1/open-platform/tenants/tenant-001/plan-change', {
        toPlanVersionId: 'plan-version-professional-202606',
        reason: '机构升级到专业版',
      }),
      routeContext(),
    );
    expect(forbidden.status).toBe(403);
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('缺少原因返回 400，同版本返回 409，未找到当前套餐返回 404', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const validation = await planChangeRoute.POST(
      request('/api/v1/open-platform/tenants/tenant-001/plan-change', {
        toPlanVersionId: 'plan-version-professional-202606',
      }),
      routeContext(),
    );
    expect(validation.status).toBe(400);
    await expect(validation.json()).resolves.toEqual({
      ok: false,
      status: 'validation_error',
      errors: ['REASON_REQUIRED'],
    });

    routeMocks.repository.findPublishedPlanVersionById.mockResolvedValueOnce(currentPlanVersion);
    const sameVersion = await planChangePreviewRoute.POST(
      request('/api/v1/open-platform/tenants/tenant-001/plan-change-preview', {
        toPlanVersionId: 'plan-version-growth-202606',
        reason: '保持不变',
      }),
      routeContext(),
    );
    expect(sameVersion.status).toBe(409);
    await expect(sameVersion.json()).resolves.toEqual({
      ok: false,
      errorCode: 'SAME_PLAN_VERSION',
    });

    routeMocks.repository.findCurrentTenantPlanState.mockResolvedValueOnce(null);
    const missing = await planChangePreviewRoute.POST(
      request('/api/v1/open-platform/tenants/tenant-missing/plan-change-preview', {
        toPlanVersionId: 'plan-version-professional-202606',
        reason: '升级',
      }),
      routeContext('tenant-missing'),
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      ok: false,
      errorCode: 'CURRENT_PLAN_NOT_FOUND',
    });
  });

  it('数据服务异常返回稳定低敏 503', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const response = await planChangePreviewRoute.POST(
      request('/api/v1/open-platform/tenants/tenant-001/plan-change-preview', {
        toPlanVersionId: 'plan-version-professional-202606',
        reason: '升级',
      }),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ ok: false, errorCode: 'TENANT_PLAN_CHANGE_UNAVAILABLE' });
    expectNoSensitivePayload(payload);
  });
});
