import { describe, expect, it } from 'vitest';
import type { TenantManagementListItem } from '@/modules/open-platform/domain/tenant-management';
import {
  buildTenantManagementOverview,
  filterTenantManagementRecords,
  getTenantAuthorizationState,
  getTenantExpiryState,
  getTenantQuotaRiskState,
} from '@/modules/open-platform/domain/tenant-management-view';

const baseTenant: TenantManagementListItem = {
  tenantId: 'tenant-a',
  tenantName: '星澜医美中心',
  tenantStatus: 'active',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-20T00:00:00.000Z',
  planName: '专业版',
  planCode: 'professional',
  planStatus: 'active',
  assignmentStatus: 'active',
  startedAt: '2026-06-01T00:00:00.000Z',
  expiresAt: '2026-06-29T00:00:00.000Z',
  maxCustomers: 100,
  maxAppointments: 200,
  maxFollowUps: 300,
  maxAiCalls: 1000,
  currentCustomers: 88,
  currentAppointments: 20,
  currentFollowUps: 30,
  currentAiCalls: 100,
  snapshotAt: '2026-06-20T00:00:00.000Z',
};

describe('租户管理 V1.1 视图派生', () => {
  it('计算总览指标', () => {
    const missingPlan = {
      ...baseTenant,
      tenantId: 'tenant-b',
      tenantName: '未授权机构',
      planName: null,
      planCode: null,
      planStatus: null,
      assignmentStatus: null,
      snapshotAt: null,
    };
    const trialTenant = {
      ...baseTenant,
      tenantId: 'tenant-c',
      tenantName: '试用机构',
      tenantStatus: 'trialing',
      expiresAt: '2026-12-31T00:00:00.000Z',
      currentCustomers: 10,
    };

    const overview = buildTenantManagementOverview([baseTenant, missingPlan, trialTenant], {
      now: '2026-06-22T00:00:00.000Z',
    });

    expect(overview.total).toBe(3);
    expect(overview.active).toBe(2);
    expect(overview.trialing).toBe(1);
    expect(overview.expiringSoon).toBe(2);
    expect(overview.authorizationIssues).toBe(1);
  });

  it('识别授权异常、配额风险和即将到期', () => {
    expect(getTenantAuthorizationState(baseTenant).status).toBe('normal');
    expect(getTenantQuotaRiskState(baseTenant).status).toBe('near_limit');
    expect(getTenantExpiryState(baseTenant, { now: '2026-06-22T00:00:00.000Z' }).status).toBe(
      'expiring_soon',
    );

    expect(
      getTenantAuthorizationState({
        ...baseTenant,
        planCode: null,
        snapshotAt: null,
      }).status,
    ).toBe('issue');
  });

  it('按关键词、状态、套餐、有效期、授权和配额风险筛选', () => {
    const records = [
      baseTenant,
      {
        ...baseTenant,
        tenantId: 'tenant-b',
        tenantName: '低风险机构',
        planCode: 'basic',
        planName: '基础版',
        expiresAt: '2026-12-31T00:00:00.000Z',
        currentCustomers: 10,
      },
    ];

    const filtered = filterTenantManagementRecords(records, {
      keyword: '星澜',
      tenantStatus: 'active',
      planCode: 'professional',
      expiry: 'expiring_soon',
      authorization: 'normal',
      quotaRisk: 'near_limit',
      now: '2026-06-22T00:00:00.000Z',
    });

    expect(filtered.map((record) => record.tenantId)).toEqual(['tenant-a']);
  });
});
