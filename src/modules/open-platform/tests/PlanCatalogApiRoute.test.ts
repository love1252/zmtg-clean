import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as createVersionRoute from '@/app/api/v1/open-platform/plan-catalog/[planId]/versions/route';
import * as planCatalogRoute from '@/app/api/v1/open-platform/plan-catalog/route';
import * as publishVersionRoute from '@/app/api/v1/open-platform/plan-catalog/versions/[versionId]/publish/route';
import * as retireVersionRoute from '@/app/api/v1/open-platform/plan-catalog/versions/[versionId]/retire/route';
import * as versionRoute from '@/app/api/v1/open-platform/plan-catalog/versions/[versionId]/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const repository = {
    listPlanCatalogRecords: vi.fn(),
    findPlan: vi.fn(),
    findVersion: vi.fn(),
    listVersionsByPlanId: vi.fn(),
    createVersion: vi.fn(),
    updateVersionDraft: vi.fn(),
    updateVersionStatus: vi.fn(),
    retirePublishedVersionsForPlan: vi.fn(),
  };
  const database = { database: 'plan-catalog-route-db' };

  return {
    createPlanCatalogRepository: vi.fn(() => repository),
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

vi.mock('@/modules/open-platform/server/plan-catalog-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/open-platform/server/plan-catalog-repository')>();
  return {
    ...actual,
    createPlanCatalogRepository: routeMocks.createPlanCatalogRepository,
  };
});

const platformAdminContext: AccessContext = {
  userId: 'platform-user',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const platformOperatorContext: AccessContext = {
  userId: 'platform-operator',
  role: 'platform_operator',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const tenantAdminContext: AccessContext = {
  userId: 'tenant-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const publishedVersion = {
  versionId: 'plan-version-professional-published',
  planId: 'plan-professional',
  versionCode: '2026-06-v1',
  status: 'published',
  displayName: 'Professional 专业版',
  displayPrice: '¥2999/月',
  priceNote: '参考价，线下确认',
  agentLimit: 3,
  seatLimit: 40,
  monthlyAiCallLimit: 300000,
  knowledgeStorageGb: 100,
  connectorEntitlementsJson: { connectors: ['企微', 'HIS'] },
  serviceEntitlementsJson: { services: ['实施支持'] },
  featureEntitlementsJson: { modules: ['客户运营'] },
  quotaEntitlementsJson: { aiCallsPerMonth: 300000 },
  changeSummary: '首次发布',
  createdBy: 'platform-user',
  updatedBy: 'platform-user',
  publishedBy: 'platform-user',
  publishedAt: new Date('2026-06-21T08:00:00.000Z'),
  retiredAt: null,
  createdAt: new Date('2026-06-20T08:00:00.000Z'),
  updatedAt: new Date('2026-06-21T08:00:00.000Z'),
} as const;

const draftVersion = {
  ...publishedVersion,
  versionId: 'plan-version-professional-draft',
  versionCode: '2026-06-v2',
  status: 'draft',
  publishedBy: null,
  publishedAt: null,
  createdAt: new Date('2026-06-22T08:00:00.000Z'),
  updatedAt: new Date('2026-06-22T08:00:00.000Z'),
} as const;

const planRecord = {
  planId: 'plan-professional',
  planName: 'Professional 专业版',
  planCode: 'professional',
  planDescription: '适合增长期机构',
  planStatus: 'active',
  versions: [draftVersion, publishedVersion],
};

function planRequest(path = '/api/v1/open-platform/plan-catalog', init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

function routeContext<TParams extends Record<string, string>>(params: TParams) {
  return { params: Promise.resolve(params) };
}

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');
  return response.json() as Promise<Record<string, unknown>>;
}

function expectNoSensitivePlanPayload(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /payment_token|webhook_secret|card_number|contract_body|invoice_tax_no|client_secret|api_key|encrypted_api_key|DATABASE_URL|postgres:\/\/|stack/i,
  );
}

describe('平台套餐目录 API route', () => {
  beforeEach(() => {
    routeMocks.getDatabase.mockReset();
    routeMocks.getDatabase.mockReturnValue(routeMocks.database);
    routeMocks.getDemoAccessContextFromRequest.mockReset();
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    routeMocks.createPlanCatalogRepository.mockClear();
    Object.values(routeMocks.repository).forEach((mock) => mock.mockReset());
    routeMocks.repository.listPlanCatalogRecords.mockResolvedValue([planRecord]);
    routeMocks.repository.findPlan.mockResolvedValue({
      planId: 'plan-professional',
      planName: 'Professional 专业版',
      planCode: 'professional',
      planDescription: '适合增长期机构',
      planStatus: 'active',
    });
    routeMocks.repository.findVersion.mockResolvedValue(draftVersion);
    routeMocks.repository.listVersionsByPlanId.mockResolvedValue([publishedVersion]);
    routeMocks.repository.createVersion.mockImplementation(async (record) => record);
    routeMocks.repository.updateVersionDraft.mockImplementation(async (_versionId, input) => ({
      ...draftVersion,
      ...input,
      updatedAt: new Date('2026-06-23T08:00:00.000Z'),
    }));
    routeMocks.repository.updateVersionStatus.mockImplementation(
      async (versionId, status, input) => ({
        ...(versionId === publishedVersion.versionId ? publishedVersion : draftVersion),
        versionId,
        status,
        ...input,
        updatedAt: new Date('2026-06-23T08:00:00.000Z'),
      }),
    );
    routeMocks.repository.retirePublishedVersionsForPlan.mockResolvedValue(undefined);
  });

  it('GET 返回套餐目录、概览和低敏版本字段', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    routeMocks.repository.listPlanCatalogRecords.mockResolvedValue([
      {
        ...planRecord,
        versions: [
          {
            ...draftVersion,
            connectorEntitlementsJson: { api_key: 'sk_test_should_not_return' },
          },
          publishedVersion,
        ],
      },
    ]);

    const response = await planCatalogRoute.GET(planRequest());
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(routeMocks.createPlanCatalogRepository).toHaveBeenCalledWith(routeMocks.database);
    expect(payload.summary).toEqual({
      planCount: 1,
      draftVersionCount: 1,
      publishedVersionCount: 1,
      retiredVersionCount: 0,
    });
    expect(payload.plans).toEqual([
      expect.objectContaining({
        planId: 'plan-professional',
        publishedVersionId: 'plan-version-professional-published',
        draftVersionId: 'plan-version-professional-draft',
      }),
    ]);
    expectNoSensitivePlanPayload(payload);
  });

  it('POST plan versions 从已发布版本复制新草稿，不允许租户侧访问', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const response = await createVersionRoute.POST(
      planRequest('/api/v1/open-platform/plan-catalog/plan-professional/versions', {
        method: 'POST',
        body: JSON.stringify({ sourceVersionId: publishedVersion.versionId }),
      }),
      routeContext({ planId: 'plan-professional' }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe('draft_created');
    expect(payload.version).toEqual(expect.objectContaining({ status: 'draft' }));
    expect(routeMocks.repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'plan-professional',
        status: 'draft',
        createdBy: 'platform-user',
        updatedBy: 'platform-user',
      }),
    );

    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantAdminContext);
    const denied = await createVersionRoute.POST(
      planRequest('/api/v1/open-platform/plan-catalog/plan-professional/versions', {
        method: 'POST',
      }),
      routeContext({ planId: 'plan-professional' }),
    );
    expect(denied.status).toBe(403);
  });

  it('PUT version 只能保存 draft，payload 非法时返回 400 且不写库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const response = await versionRoute.PUT(
      planRequest('/api/v1/open-platform/plan-catalog/versions/plan-version-professional-draft', {
        method: 'PUT',
        body: JSON.stringify({
          versionCode: '2026-06-v2',
          displayName: 'Professional 专业版',
          displayPrice: '¥3999/月',
          agentLimit: 5,
          seatLimit: 60,
          monthlyAiCallLimit: 500000,
          knowledgeStorageGb: 200,
          connectorEntitlementsJson: { connectors: ['企微'] },
          serviceEntitlementsJson: { services: ['实施支持'] },
          featureEntitlementsJson: { modules: ['客户运营'] },
          quotaEntitlementsJson: { aiCallsPerMonth: 500000 },
          changeSummary: '增加权益',
        }),
      }),
      routeContext({ versionId: 'plan-version-professional-draft' }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.status).toBe('draft_saved');
    expect(routeMocks.repository.updateVersionDraft).toHaveBeenCalledWith(
      'plan-version-professional-draft',
      expect.objectContaining({ displayPrice: '¥3999/月', updatedBy: 'platform-user' }),
    );

    const invalid = await versionRoute.PUT(
      planRequest('/api/v1/open-platform/plan-catalog/versions/plan-version-professional-draft', {
        method: 'PUT',
        body: JSON.stringify({
          versionCode: '',
          displayName: '',
          displayPrice: '真实扣费 ¥3999',
          agentLimit: -1,
          connectorEntitlementsJson: { api_key: 'sk_test_should_not_save' },
        }),
      }),
      routeContext({ versionId: 'plan-version-professional-draft' }),
    );

    expect(invalid.status).toBe(400);
  });

  it('POST publish 发布 draft 并停用同套餐旧 published；POST retire 停用 published', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const publishResponse = await publishVersionRoute.POST(
      planRequest(
        '/api/v1/open-platform/plan-catalog/versions/plan-version-professional-draft/publish',
        { method: 'POST' },
      ),
      routeContext({ versionId: 'plan-version-professional-draft' }),
    );
    const publishPayload = await readJson(publishResponse);

    expect(publishResponse.status).toBe(200);
    expect(publishPayload.status).toBe('published');
    expect(routeMocks.repository.retirePublishedVersionsForPlan).toHaveBeenCalledWith(
      'plan-professional',
      expect.objectContaining({ exceptVersionId: 'plan-version-professional-draft' }),
    );
    expect(routeMocks.repository.updateVersionStatus).toHaveBeenCalledWith(
      'plan-version-professional-draft',
      'published',
      expect.objectContaining({ publishedBy: 'platform-user' }),
    );

    routeMocks.repository.findVersion.mockResolvedValueOnce(publishedVersion);
    const retireResponse = await retireVersionRoute.POST(
      planRequest(
        '/api/v1/open-platform/plan-catalog/versions/plan-version-professional-published/retire',
        { method: 'POST' },
      ),
      routeContext({ versionId: 'plan-version-professional-published' }),
    );

    expect(retireResponse.status).toBe(200);
    await expect(readJson(retireResponse)).resolves.toEqual(
      expect.objectContaining({ status: 'retired' }),
    );
  });

  it('未登录、非平台管理员和数据服务异常返回低敏错误', async () => {
    const unauthorized = await planCatalogRoute.GET(planRequest());
    expect(unauthorized.status).toBe(401);

    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformOperatorContext);
    const forbidden = await versionRoute.PUT(
      planRequest('/api/v1/open-platform/plan-catalog/versions/plan-version-professional-draft', {
        method: 'PUT',
        body: JSON.stringify({}),
      }),
      routeContext({ versionId: 'plan-version-professional-draft' }),
    );
    expect(forbidden.status).toBe(403);

    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    routeMocks.getDatabase.mockImplementationOnce(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });
    const unavailable = await planCatalogRoute.GET(planRequest());
    const payload = await readJson(unavailable);

    expect(unavailable.status).toBe(503);
    expect(payload).toEqual({ ok: false, errorCode: 'PLAN_CATALOG_UNAVAILABLE' });
    expectNoSensitivePlanPayload(payload);
  });
});
