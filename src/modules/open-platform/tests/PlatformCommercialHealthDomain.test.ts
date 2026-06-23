import { describe, expect, it } from 'vitest';
import type { AuditEventListItem } from '@/modules/audit/domain/audit-event-query';
import type { TenantManagementListItem } from '@/modules/open-platform/domain/tenant-management';
import {
  COMMERCIAL_HEALTH_QUOTA_LIMIT_REACHED_THRESHOLD,
  COMMERCIAL_HEALTH_QUOTA_RISK_THRESHOLD,
  buildPlatformCommercialHealthViewModel,
} from '@/modules/open-platform/domain/platform-commercial-health';

const NOW = '2026-06-01T00:00:00.000Z';

function tenant(
  overrides: Partial<TenantManagementListItem> & { tenantId: string; tenantName: string },
): TenantManagementListItem {
  const { tenantId, tenantName, ...rest } = overrides;

  return {
    tenantId,
    tenantName,
    tenantStatus: 'active',
    createdAt: '2026-05-30T00:00:00.000Z',
    updatedAt: '2026-05-31T00:00:00.000Z',
    planName: '成长版',
    planCode: 'growth-care',
    planStatus: 'active',
    planVersionId: 'plan-version-growth-care',
    planVersionCode: '2026-06-v1',
    planDisplayName: 'Growth Plan 2026-06',
    planDisplayPrice: '¥1999/月',
    assignmentStatus: 'active',
    startedAt: '2026-05-31T00:00:00.000Z',
    expiresAt: null,
    agentLimit: 2,
    seatLimit: 20,
    monthlyAiCallLimit: 100000,
    knowledgeStorageGb: 50,
    connectorEntitlements: ['企微'],
    serviceEntitlements: ['基础培训'],
    authorizationSnapshotId: 'auth-snapshot-growth-care',
    authorizationSnapshotStatus: 'active',
    authorizationGeneratedAt: '2026-05-31T08:00:00.000Z',
    maxCustomers: 100,
    maxAppointments: 100,
    maxFollowUps: 100,
    maxAiCalls: 100,
    currentCustomers: 10,
    currentAppointments: 10,
    currentFollowUps: 10,
    currentAiCalls: 10,
    snapshotAt: '2026-05-31T08:00:00.000Z',
    ...rest,
  };
}

function auditEvent(
  overrides: Partial<AuditEventListItem> & { id: string; tenantId: string | null },
): AuditEventListItem {
  const { id, tenantId, ...rest } = overrides;

  return {
    id,
    tenantId,
    resource: 'customer',
    resourceId: 'cust_001',
    action: 'create',
    result: 'denied',
    reason: 'quota_exceeded_customers',
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    occurredAt: '2026-05-31T10:00:00.000Z',
    ...rest,
  };
}

describe('平台商业化健康领域派生模型', () => {
  it('基于租户列表派生套餐覆盖率并识别无 active plan 租户', () => {
    const viewModel = buildPlatformCommercialHealthViewModel({
      tenants: [
        tenant({ tenantId: 'tenant-active', tenantName: '有效套餐机构' }),
        tenant({
          tenantId: 'tenant-missing-plan',
          tenantName: '未分配套餐机构',
          planName: null,
          planCode: null,
          planStatus: null,
          assignmentStatus: null,
        }),
      ],
      auditEvents: [],
      now: NOW,
    });

    expect(viewModel.planCoverage).toEqual({
      tenantTotal: 2,
      activePlanTenantCount: 1,
      missingActivePlanTenantCount: 1,
      coverageRate: 0.5,
    });
    expect(viewModel.summaryCards).toContainEqual(
      expect.objectContaining({ key: 'active_plan_coverage_rate', value: 0.5 }),
    );
    expect(viewModel.missingConfigurationTenants).toContainEqual(
      expect.objectContaining({
        tenantId: 'tenant-missing-plan',
        tenantName: '未分配套餐机构',
        reasons: expect.arrayContaining([
          expect.objectContaining({ key: 'missing_active_plan' }),
        ]),
      }),
    );
  });

  it('识别缺少 quota limit、缺少 quota snapshot 与过旧 snapshot', () => {
    const viewModel = buildPlatformCommercialHealthViewModel({
      tenants: [
        tenant({
          tenantId: 'tenant-missing-limit',
          tenantName: '缺少配额机构',
          maxCustomers: null,
        }),
        tenant({
          tenantId: 'tenant-missing-snapshot',
          tenantName: '缺少快照机构',
          currentCustomers: null,
          currentAppointments: null,
          currentFollowUps: null,
          currentAiCalls: null,
          snapshotAt: null,
        }),
        tenant({
          tenantId: 'tenant-stale-snapshot',
          tenantName: '快照过旧机构',
          snapshotAt: '2026-05-20T08:00:00.000Z',
        }),
      ],
      auditEvents: [],
      now: NOW,
    });

    expect(viewModel.missingConfigurationTenants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'tenant-missing-limit',
          reasons: expect.arrayContaining([
            expect.objectContaining({
              key: 'missing_quota_limit',
              quotaKeys: ['customers'],
            }),
          ]),
        }),
        expect.objectContaining({
          tenantId: 'tenant-missing-snapshot',
          reasons: expect.arrayContaining([
            expect.objectContaining({ key: 'missing_quota_snapshot' }),
          ]),
        }),
        expect.objectContaining({
          tenantId: 'tenant-stale-snapshot',
          reasons: expect.arrayContaining([
            expect.objectContaining({ key: 'stale_quota_snapshot' }),
          ]),
        }),
      ]),
    );
    expect(viewModel.snapshotHealth).toEqual({
      totalTenants: 3,
      withSnapshotTenantCount: 2,
      missingSnapshotTenantCount: 1,
      staleSnapshotTenantCount: 1,
      staleSnapshotDays: 7,
      operationalReferenceOnly: true,
    });
  });

  it('按稳定阈值识别配额接近上限与已达上限', () => {
    expect(COMMERCIAL_HEALTH_QUOTA_RISK_THRESHOLD).toBe(0.8);
    expect(COMMERCIAL_HEALTH_QUOTA_LIMIT_REACHED_THRESHOLD).toBe(1);

    const viewModel = buildPlatformCommercialHealthViewModel({
      tenants: [
        tenant({
          tenantId: 'tenant-risk',
          tenantName: '接近上限机构',
          currentCustomers: 80,
          currentAppointments: 79,
          currentFollowUps: 80,
          currentAiCalls: 80,
        }),
        tenant({
          tenantId: 'tenant-reached',
          tenantName: '已达上限机构',
          currentCustomers: 100,
          currentAppointments: 120,
          currentFollowUps: 10,
          currentAiCalls: 0,
        }),
      ],
      auditEvents: [],
      now: NOW,
    });

    expect(viewModel.riskTenants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'tenant-risk',
          quotaKey: 'customers',
          currentSnapshotUsage: 80,
          quotaLimit: 100,
          usageRatio: 0.8,
          status: 'near_limit',
          source: 'tenant_quota_snapshot_operational_reference',
          operationalReferenceOnly: true,
        }),
        expect.objectContaining({
          tenantId: 'tenant-risk',
          quotaKey: 'followUps',
          status: 'near_limit',
        }),
        expect.objectContaining({
          tenantId: 'tenant-risk',
          quotaKey: 'aiCalls',
          status: 'near_limit',
        }),
        expect.objectContaining({
          tenantId: 'tenant-reached',
          quotaKey: 'customers',
          usageRatio: 1,
          status: 'limit_reached',
        }),
        expect.objectContaining({
          tenantId: 'tenant-reached',
          quotaKey: 'appointments',
          usageRatio: 1.2,
          status: 'limit_reached',
        }),
      ]),
    );
    expect(viewModel.riskTenants).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'tenant-risk',
          quotaKey: 'appointments',
        }),
      ]),
    );
  });

  it('正确聚合 quota denied 审计事件数量、reason、resource 与最近发生时间', () => {
    const viewModel = buildPlatformCommercialHealthViewModel({
      tenants: [tenant({ tenantId: 'tenant-active', tenantName: '有效套餐机构' })],
      auditEvents: [
        auditEvent({
          id: 'evt-001',
          tenantId: 'tenant-active',
          resource: 'customer',
          reason: 'quota_exceeded_customers',
          occurredAt: '2026-05-31T08:00:00.000Z',
        }),
        auditEvent({
          id: 'evt-002',
          tenantId: 'tenant-active',
          resource: 'customer',
          reason: 'quota_exceeded_customers',
          occurredAt: '2026-05-31T09:00:00.000Z',
        }),
        auditEvent({
          id: 'evt-003',
          tenantId: 'tenant-active',
          resource: 'appointment',
          reason: 'quota_exceeded_appointments',
          occurredAt: '2026-05-31T10:30:00.000Z',
        }),
        auditEvent({
          id: 'evt-004',
          tenantId: 'tenant-active',
          resource: 'tenant',
          reason: 'missing_active_plan',
          occurredAt: '2026-05-31T11:00:00.000Z',
        }),
        auditEvent({
          id: 'evt-ignored',
          tenantId: 'tenant-active',
          resource: 'customer',
          result: 'allowed',
          reason: 'allowed_by_policy',
          occurredAt: '2026-05-31T12:00:00.000Z',
        }),
      ],
      now: NOW,
    });

    expect(viewModel.quotaDeniedSignals).toEqual({
      totalCount: 4,
      latestOccurredAt: '2026-05-31T11:00:00.000Z',
      byReason: [
        { reason: 'quota_exceeded_customers', count: 2 },
        { reason: 'missing_active_plan', count: 1 },
        { reason: 'quota_exceeded_appointments', count: 1 },
      ],
      byResource: [
        { resource: 'customer', count: 2 },
        { resource: 'appointment', count: 1 },
        { resource: 'tenant', count: 1 },
      ],
    });
    expect(viewModel.summaryCards).toContainEqual(
      expect.objectContaining({ key: 'quota_denied_events', value: 4 }),
    );
  });

  it('snapshot current usage 仅作为运营参考，不作为强一致计费或 enforcement 依据', () => {
    const viewModel = buildPlatformCommercialHealthViewModel({
      tenants: [
        tenant({
          tenantId: 'tenant-risk',
          tenantName: '接近上限机构',
          currentCustomers: 90,
          maxCustomers: 100,
        }),
      ],
      auditEvents: [],
      now: NOW,
    });
    const serialized = JSON.stringify(viewModel).toLowerCase();

    expect(viewModel.riskTenants[0]).toEqual(
      expect.objectContaining({
        currentSnapshotUsage: 90,
        source: 'tenant_quota_snapshot_operational_reference',
        operationalReferenceOnly: true,
      }),
    );
    expect(serialized).toContain('operational_reference');
    expect(serialized).toContain('snapshot');
    expect(serialized).not.toContain('billingusage');
    expect(serialized).not.toContain('billableusage');
    expect(serialized).not.toContain('enforcementusage');
    expect(serialized).not.toContain('strongconsistent');
  });

  it('不返回客户、预约、随访业务明细、PII 或服务端敏感错误细节', () => {
    const unsafeTenant = {
      ...tenant({
        tenantId: 'tenant-sensitive',
        tenantName: '敏感字段机构',
        currentCustomers: 99,
      }),
      customers: [{ phoneNumber: '13800000000' }],
      appointments: [{ customerId: 'cust_001' }],
      followUpTasks: [{ customerId: 'cust_001' }],
      treatmentRecord: '完整治疗记录正文',
      consultationTranscript: '咨询对话全文',
      medicalRecordNo: 'MR-RAW-001',
      idNumber: '110101199001010011',
      sql: 'select * from customers',
      stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_should_not_return',
      secret: 'raw-secret',
    } as TenantManagementListItem;
    const unsafeEvent = {
      ...auditEvent({ id: 'evt-sensitive', tenantId: 'tenant-sensitive' }),
      requestBody: { phoneNumber: '13800000000' },
      metadata: { sql: 'select * from audit_events' },
      stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      token: 'sk_test_should_not_return',
      secret: 'raw-secret',
    } as AuditEventListItem;

    const viewModel = buildPlatformCommercialHealthViewModel({
      tenants: [unsafeTenant],
      auditEvents: [unsafeEvent],
      now: NOW,
    });
    const serialized = JSON.stringify(viewModel);

    expect(serialized).not.toContain('"customers":[');
    expect(serialized).not.toContain('"appointments":[');
    expect(serialized).not.toContain('followUpTasks');
    expect(serialized).not.toContain('phoneNumber');
    expect(serialized).not.toContain('13800000000');
    expect(serialized).not.toContain('idNumber');
    expect(serialized).not.toContain('110101199001010011');
    expect(serialized).not.toContain('medicalRecordNo');
    expect(serialized).not.toContain('MR-RAW-001');
    expect(serialized).not.toContain('treatmentRecord');
    expect(serialized).not.toContain('完整治疗记录正文');
    expect(serialized).not.toContain('consultationTranscript');
    expect(serialized).not.toContain('咨询对话全文');
    expect(serialized).not.toContain('select * from');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('secret');
  });

  it('空租户列表和空审计事件返回稳定空态 view model', () => {
    const viewModel = buildPlatformCommercialHealthViewModel({
      tenants: [],
      auditEvents: [],
      now: NOW,
    });

    expect(viewModel).toEqual({
      summaryCards: [
        { key: 'tenant_total', label: '租户总数', value: 0 },
        { key: 'active_plan_coverage_rate', label: '套餐覆盖率', value: 0 },
        { key: 'quota_risk_items', label: '配额风险项', value: 0 },
        { key: 'missing_configuration_tenants', label: '配置缺失租户', value: 0 },
        { key: 'quota_denied_events', label: '近期 quota denied', value: 0 },
      ],
      planCoverage: {
        tenantTotal: 0,
        activePlanTenantCount: 0,
        missingActivePlanTenantCount: 0,
        coverageRate: 0,
      },
      riskTenants: [],
      missingConfigurationTenants: [],
      quotaDeniedSignals: {
        totalCount: 0,
        latestOccurredAt: null,
        byReason: [],
        byResource: [],
      },
      snapshotHealth: {
        totalTenants: 0,
        withSnapshotTenantCount: 0,
        missingSnapshotTenantCount: 0,
        staleSnapshotTenantCount: 0,
        staleSnapshotDays: 7,
        operationalReferenceOnly: true,
      },
      lastUpdatedAt: NOW,
    });
  });
});
