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

const trialPlanVersion = {
  ...publishedPlanVersion,
  planId: 'plan-trial-care',
  planCode: 'trial-care',
  planName: '试用版',
  versionId: 'plan-version-trial-published',
  displayName: '试用版',
  displayPrice: '试用版展示价（未定价）',
  agentLimit: 1,
  seatLimit: 1,
  monthlyAiCallLimit: 5000,
  knowledgeStorageGb: 1,
  connectorEntitlementsJson: { connectors: ['企微演示'] },
  serviceEntitlementsJson: { services: ['新手引导'] },
  quotaEntitlementsJson: { aiCallsPerMonth: 5000, knowledgeStorageMb: 100 },
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
      expiresAt: input.assignment.expiresAt,
      agentLimit: publishedPlanVersion.agentLimit,
      seatLimit: publishedPlanVersion.seatLimit,
      monthlyAiCallLimit: publishedPlanVersion.monthlyAiCallLimit,
      knowledgeStorageGb: publishedPlanVersion.knowledgeStorageGb,
      connectorEntitlements: ['企微', 'HIS'],
      serviceEntitlements: ['上线培训'],
      authorizationSnapshotId: input.authorizationSnapshot.id,
      authorizationSnapshotStatus: input.authorizationSnapshot.status,
      authorizationGeneratedAt: input.authorizationSnapshot.generatedAt,
      openingContact: input.authorizationSnapshot.snapshotJson.openingContact ?? null,
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
      actorRole: 'platform_admin',
      auditSource: 'demo_session',
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
          openingContact: {
            contactPhone: '13800000000',
            adminContact: 'admin@example.com',
          },
          securityBoundary: {
            contactFields: 'business_contact_fields_only',
            passwordStorage: 'no_plaintext_password',
            diagnosticMode: 'controlled_short_lived_redacted',
          },
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
      auditEvent: {
        eventId: 'audit-event-fixed',
        actorId: 'demo-user-platform',
        actorRole: 'platform_admin',
        tenantId: 'tenant-fixed',
        scope: 'platform',
        resource: 'tenant',
        resourceId: 'tenant-fixed',
        action: 'create',
        result: 'allowed',
        reason: 'tenant_plan_assignment_created',
        occurredAt: '2026-06-23T03:00:00.000Z',
        source: 'demo_session',
      },
    });
    const createAuthorizationMock = vi.mocked(repository.createTenantWithPlanAuthorization);
    expect(JSON.stringify(createAuthorizationMock.mock.calls)).not.toMatch(
      /payment_token|webhook_secret|client_secret|api_key|DATABASE_URL|requestBody|select \*|stack trace/i,
    );
  });

  it('新建试用版租户时按当前时间生成 10 天体验有效期并固化受控开通资料', async () => {
    const repository = createRepository({
      findPublishedPlanVersionById: vi.fn(async () => trialPlanVersion),
    });

    await createTenantWithPlanService({
      repository,
      actorId: 'demo-user-platform',
      actorRole: 'platform_admin',
      auditSource: 'demo_session',
      now: () => new Date('2026-06-25T07:30:00.000Z'),
      idFactory: (prefix) => `${prefix}-fixed`,
      payload: {
        organizationName: '云澜试用机构',
        planVersionId: 'plan-version-trial-published',
        reason: '商业试用开通',
        contactName: '陈磊',
        contactPhone: '13800000000',
        contactEmail: 'contact@example.com',
        adminName: '李静',
        adminAccount: 'yunlan_trial_admin',
        adminContact: 'admin@example.com',
        initialPassword: 'PlaintextPasswordShouldNotPass',
        requestBody: { password: 'PlaintextPasswordShouldNotPass' },
        sql: 'select * from tenants',
      },
    });

    expect(repository.createTenantWithPlanAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({
        assignment: expect.objectContaining({
          startedAt: new Date('2026-06-25T07:30:00.000Z'),
          expiresAt: new Date('2026-07-05T07:30:00.000Z'),
        }),
        authorizationSnapshot: expect.objectContaining({
          snapshotJson: expect.objectContaining({
            trialPeriod: {
              startedAt: '2026-06-25T07:30:00.000Z',
              expiresAt: '2026-07-05T07:30:00.000Z',
              durationDays: 10,
            },
            openingContact: {
              contactName: '陈磊',
              contactPhone: '13800000000',
              contactEmail: 'contact@example.com',
              adminName: '李静',
              adminAccount: 'yunlan_trial_admin',
              adminContact: 'admin@example.com',
            },
            securityBoundary: expect.objectContaining({
              passwordStorage: 'no_plaintext_password',
              diagnosticMode: 'controlled_short_lived_redacted',
            }),
          }),
        }),
        auditEvent: expect.objectContaining({
          reason: 'tenant_plan_assignment_created',
        }),
      }),
    );
    expect(JSON.stringify(vi.mocked(repository.createTenantWithPlanAuthorization).mock.calls)).not.toMatch(
      /PlaintextPasswordShouldNotPass|requestBody|select \* from tenants|passwordStorage\\":\\"plaintext/i,
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
        actorRole: 'platform_admin',
        auditSource: 'demo_session',
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
