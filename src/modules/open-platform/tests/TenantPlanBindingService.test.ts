import { describe, expect, it, vi } from 'vitest';
import {
  createTenantWithPlanService,
  listTenantPlanOptionsService,
  type TenantPlanBindingRepository,
} from '@/modules/open-platform/server/tenant-plan-binding-service';

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

function createRepository(overrides: Partial<TenantPlanBindingRepository> = {}) {
  return {
    listPublishedPlanVersions: vi.fn(async () => [publishedPlanVersion]),
    findPublishedPlanVersionById: vi.fn(async () => publishedPlanVersion),
    createTenantWithPlanAuthorization: vi.fn(async (input) => ({
      tenantId: input.tenant.id,
      tenantName: input.tenant.name,
      tenantStatus: input.tenant.status,
      createdAt: input.tenant.createdAt,
      updatedAt: input.tenant.updatedAt,
      planName: publishedPlanVersion.planName,
      planCode: publishedPlanVersion.planCode,
      planStatus: publishedPlanVersion.planStatus,
      planVersionId: publishedPlanVersion.versionId,
      planVersionCode: publishedPlanVersion.versionCode,
      planDisplayName: publishedPlanVersion.displayName,
      planDisplayPrice: publishedPlanVersion.displayPrice,
      assignmentStatus: input.assignment.status,
      startedAt: input.assignment.startedAt,
      expiresAt: null,
      agentLimit: publishedPlanVersion.agentLimit,
      seatLimit: publishedPlanVersion.seatLimit,
      monthlyAiCallLimit: publishedPlanVersion.monthlyAiCallLimit,
      knowledgeStorageGb: publishedPlanVersion.knowledgeStorageGb,
      connectorEntitlements: ['企微', 'HIS'],
      serviceEntitlements: ['上线培训'],
      authorizationSnapshotId: input.authorizationSnapshot.id,
      authorizationSnapshotStatus: input.authorizationSnapshot.status,
      authorizationGeneratedAt: input.authorizationSnapshot.generatedAt,
      maxCustomers: null,
      maxAppointments: null,
      maxFollowUps: null,
      maxAiCalls: null,
      currentCustomers: null,
      currentAppointments: null,
      currentFollowUps: null,
      currentAiCalls: null,
      snapshotAt: null,
    })),
    ...overrides,
  } satisfies TenantPlanBindingRepository;
}

describe('租户套餐绑定 service', () => {
  it('返回 published 套餐版本选项', async () => {
    const repository = createRepository();

    await expect(listTenantPlanOptionsService({ repository })).resolves.toEqual({
      options: [
        {
          planId: 'plan-professional',
          planCode: 'professional',
          planName: 'Professional 专业版',
          planVersionId: 'plan-version-professional-published',
          versionCode: '2026-06-v1',
          displayName: 'Professional 专业版 2026-06',
          displayPrice: '¥2999/月',
          priceNote: '展示价格，人工确认口径',
          agentLimit: 3,
          seatLimit: 40,
          monthlyAiCallLimit: 300000,
          knowledgeStorageGb: 100,
          connectorEntitlements: ['企微', 'HIS'],
          serviceEntitlements: ['上线培训'],
        },
      ],
    });
    expect(repository.listPublishedPlanVersions).toHaveBeenCalledWith();
  });

  it('新建租户时绑定 published 套餐版本并生成 active 授权快照', async () => {
    const repository = createRepository();

    const result = await createTenantWithPlanService({
      repository,
      actorId: 'demo-user-platform',
      now: () => new Date('2026-06-23T03:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-fixed`,
      payload: {
        organizationName: '星澜医美中心',
        planVersionId: 'plan-version-professional-published',
        reason: '测试服开通',
        contactPhone: '13800000000',
        adminContact: 'admin@example.com',
        payment_token: 'payment_token_should_not_pass',
      },
    });

    expect(result.status).toBe('tenant_created');
    expect(repository.findPublishedPlanVersionById).toHaveBeenCalledWith(
      'plan-version-professional-published',
    );
    expect(repository.createTenantWithPlanAuthorization).toHaveBeenCalledWith({
      planVersion: publishedPlanVersion,
      tenant: {
        id: 'tenant-fixed',
        name: '星澜医美中心',
        status: 'active',
        createdAt: new Date('2026-06-23T03:00:00.000Z'),
        updatedAt: new Date('2026-06-23T03:00:00.000Z'),
      },
      assignment: {
        id: 'tenant-plan-assignment-fixed',
        tenantId: 'tenant-fixed',
        planId: 'plan-professional',
        planVersionId: 'plan-version-professional-published',
        status: 'active',
        startedAt: new Date('2026-06-23T03:00:00.000Z'),
        expiresAt: null,
        createdAt: new Date('2026-06-23T03:00:00.000Z'),
        updatedAt: new Date('2026-06-23T03:00:00.000Z'),
      },
      authorizationSnapshot: {
        id: 'tenant-authorization-snapshot-fixed',
        tenantId: 'tenant-fixed',
        planAssignmentId: 'tenant-plan-assignment-fixed',
        planVersionId: 'plan-version-professional-published',
        status: 'active',
        snapshotJson: {
          planId: 'plan-professional',
          planCode: 'professional',
          planName: 'Professional 专业版',
          planVersionId: 'plan-version-professional-published',
          versionCode: '2026-06-v1',
          displayName: 'Professional 专业版 2026-06',
          displayPrice: '¥2999/月',
        },
        quotaJson: {
          agentLimit: 3,
          seatLimit: 40,
          monthlyAiCallLimit: 300000,
          knowledgeStorageGb: 100,
        },
        connectorJson: { connectors: ['企微', 'HIS'] },
        serviceJson: { services: ['上线培训'] },
        sourceChangeRecordId: null,
        generatedBy: 'demo-user-platform',
        generatedAt: new Date('2026-06-23T03:00:00.000Z'),
        supersededAt: null,
        createdAt: new Date('2026-06-23T03:00:00.000Z'),
      },
    });
    const createAuthorizationMock = vi.mocked(repository.createTenantWithPlanAuthorization);
    expect(JSON.stringify(createAuthorizationMock.mock.calls)).not.toMatch(
      /13800000000|admin@example.com|payment_token|webhook_secret|client_secret|api_key/i,
    );
  });

  it('拒绝未发布或不存在的套餐版本', async () => {
    const repository = createRepository({
      findPublishedPlanVersionById: vi.fn(async () => null),
    });

    await expect(
      createTenantWithPlanService({
        repository,
        actorId: 'demo-user-platform',
        payload: {
          organizationName: '星澜医美中心',
          planVersionId: 'plan-version-draft',
          reason: '测试服开通',
        },
      }),
    ).resolves.toEqual({
      status: 'not_found',
      errorCode: 'PUBLISHED_PLAN_VERSION_NOT_FOUND',
    });
  });
});
