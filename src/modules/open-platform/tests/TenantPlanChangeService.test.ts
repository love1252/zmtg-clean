import { describe, expect, it, vi } from 'vitest';
import {
  applyTenantPlanChangeService,
  previewTenantPlanChangeService,
  type TenantPlanChangeRepository,
} from '@/modules/open-platform/server/tenant-plan-change-service';
import type { TenantPlanPublishedVersionRecord } from '@/modules/open-platform/domain/tenant-plan-binding';

const currentPlanVersion: TenantPlanPublishedVersionRecord = {
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

const targetPlanVersion: TenantPlanPublishedVersionRecord = {
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
  serviceEntitlementsJson: { services: ['上线培训', '季度复盘'] },
};

const openingContactSnapshot = {
  contactName: '陈磊',
  contactPhone: '13985162773',
  contactEmail: 'contact@example.com',
  adminName: '陈磊',
  adminAccount: 'zhengpu',
  adminContact: '13985162273',
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
    snapshotJson: {
      openingContact: {
        ...openingContactSnapshot,
        requestBody: { password: 'PlaintextPasswordShouldNotPass' },
        sql: 'select * from tenants',
      },
      securityBoundary: {
        passwordStorage: 'hash_or_reset_only',
      },
    },
    generatedAt: new Date('2026-06-01T00:00:00.000Z'),
  },
};

function createRepository(overrides: Partial<TenantPlanChangeRepository> = {}) {
  return {
    findCurrentTenantPlanState: vi.fn(async () => currentTenantState),
    findPublishedPlanVersionById: vi.fn(async () => targetPlanVersion),
    applyTenantPlanChange: vi.fn(async (input) => ({
      status: 'plan_changed' as const,
      changeRecordId: input.changeRecord.id,
      auditEventId: input.auditEvent.eventId,
      tenant: {
        tenantId: input.tenant.id,
        tenantName: input.tenant.name,
        tenantStatus: input.tenant.status,
        createdAt: input.tenant.createdAt.toISOString(),
        updatedAt: input.tenant.updatedAt.toISOString(),
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
        serviceEntitlements: ['上线培训', '季度复盘'],
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
    })),
    ...overrides,
  } satisfies TenantPlanChangeRepository;
}

describe('租户套餐变更 service', () => {
  it('预览套餐变更只返回差异对照，不写入仓库', async () => {
    const repository = createRepository();

    const result = await previewTenantPlanChangeService({
      repository,
      tenantId: 'tenant-001',
      payload: {
        toPlanVersionId: 'plan-version-professional-202606',
        reason: '机构升级到专业版',
      },
    });

    expect(result.status).toBe('preview_ready');
    expect(result.preview?.changedItemCount).toBe(8);
    expect(repository.findCurrentTenantPlanState).toHaveBeenCalledWith('tenant-001');
    expect(repository.findPublishedPlanVersionById).toHaveBeenCalledWith(
      'plan-version-professional-202606',
    );
    expect(repository.applyTenantPlanChange).not.toHaveBeenCalled();
  });

  it('应用套餐变更时生成新 assignment、active 授权快照、change record 和审计事件', async () => {
    const repository = createRepository();

    const result = await applyTenantPlanChangeService({
      repository,
      actorId: 'demo-user-platform',
      actorRole: 'platform_admin',
      tenantId: 'tenant-001',
      payload: {
        toPlanVersionId: 'plan-version-professional-202606',
        reason: '机构升级到专业版',
        payment_token: 'payment_token_should_not_pass',
        contactPhone: '13800000000',
      },
      now: () => new Date('2026-06-23T04:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-fixed`,
    });

    expect(result.status).toBe('plan_changed');
    expect(repository.applyTenantPlanChange).toHaveBeenCalledWith({
      tenant: currentTenantState.tenant,
      currentAssignment: currentTenantState.assignment,
      currentAuthorizationSnapshot: {
        ...currentTenantState.authorizationSnapshot,
        snapshotJson: {
          openingContact: openingContactSnapshot,
        },
      },
      toPlanVersion: targetPlanVersion,
      newAssignment: {
        id: 'tenant-plan-assignment-fixed',
        tenantId: 'tenant-001',
        planId: 'plan-professional',
        planVersionId: 'plan-version-professional-202606',
        status: 'active',
        startedAt: new Date('2026-06-23T04:00:00.000Z'),
        expiresAt: null,
        createdAt: new Date('2026-06-23T04:00:00.000Z'),
        updatedAt: new Date('2026-06-23T04:00:00.000Z'),
      },
      newAuthorizationSnapshot: expect.objectContaining({
        id: 'tenant-authorization-snapshot-fixed',
        tenantId: 'tenant-001',
        planAssignmentId: 'tenant-plan-assignment-fixed',
        planVersionId: 'plan-version-professional-202606',
        status: 'active',
        snapshotJson: expect.objectContaining({
          openingContact: openingContactSnapshot,
          securityBoundary: {
            contactFields: 'business_contact_fields_only',
            passwordStorage: 'no_plaintext_password',
            diagnosticMode: 'controlled_short_lived_redacted',
          },
        }),
        generatedBy: 'demo-user-platform',
        generatedAt: new Date('2026-06-23T04:00:00.000Z'),
      }),
      changeRecord: expect.objectContaining({
        id: 'tenant-plan-change-fixed',
        tenantId: 'tenant-001',
        fromPlanVersionId: 'plan-version-growth-202606',
        toPlanVersionId: 'plan-version-professional-202606',
        fromSnapshotId: 'auth-snapshot-growth-active',
        toSnapshotId: 'tenant-authorization-snapshot-fixed',
        status: 'applied',
        reason: '机构升级到专业版',
        requestedBy: 'demo-user-platform',
        appliedBy: 'demo-user-platform',
      }),
      auditEvent: {
        eventId: 'audit-event-fixed',
        actorId: 'demo-user-platform',
        actorRole: 'platform_admin',
        tenantId: 'tenant-001',
        scope: 'platform',
        resource: 'tenant',
        resourceId: 'tenant-001',
        action: 'manage_status',
        result: 'transitioned',
        reason: 'tenant_plan_changed',
        occurredAt: '2026-06-23T04:00:00.000Z',
        source: 'server_session',
      },
      appliedAt: new Date('2026-06-23T04:00:00.000Z'),
    });
    expect(JSON.stringify(vi.mocked(repository.applyTenantPlanChange).mock.calls)).not.toMatch(
      /13800000000|payment_token|PlaintextPasswordShouldNotPass|select \* from tenants|webhook_secret|client_secret|api_key/i,
    );
  });

  it('拒绝未配置当前套餐、目标版本不存在、同版本和缺少原因的变更', async () => {
    await expect(
      previewTenantPlanChangeService({
        repository: createRepository({ findCurrentTenantPlanState: vi.fn(async () => null) }),
        tenantId: 'tenant-missing',
        payload: { toPlanVersionId: 'plan-version-professional-202606', reason: '升级' },
      }),
    ).resolves.toEqual({ status: 'not_found', errorCode: 'CURRENT_PLAN_NOT_FOUND' });

    await expect(
      previewTenantPlanChangeService({
        repository: createRepository({ findPublishedPlanVersionById: vi.fn(async () => null) }),
        tenantId: 'tenant-001',
        payload: { toPlanVersionId: 'plan-version-missing', reason: '升级' },
      }),
    ).resolves.toEqual({ status: 'not_found', errorCode: 'PUBLISHED_PLAN_VERSION_NOT_FOUND' });

    await expect(
      previewTenantPlanChangeService({
        repository: createRepository({ findPublishedPlanVersionById: vi.fn(async () => currentPlanVersion) }),
        tenantId: 'tenant-001',
        payload: { toPlanVersionId: 'plan-version-growth-202606', reason: '升级' },
      }),
    ).resolves.toEqual({ status: 'invalid_transition', errorCode: 'SAME_PLAN_VERSION' });

    await expect(
      applyTenantPlanChangeService({
        repository: createRepository(),
        actorId: 'demo-user-platform',
        actorRole: 'platform_admin',
        tenantId: 'tenant-001',
        payload: { toPlanVersionId: 'plan-version-professional-202606' },
      }),
    ).resolves.toEqual({ status: 'validation_error', errors: ['REASON_REQUIRED'] });
  });
});
