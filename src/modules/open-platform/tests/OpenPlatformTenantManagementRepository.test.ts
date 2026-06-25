import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  tenantAuthorizationSnapshots,
  tenantPlanAssignments,
  tenantPlanVersions,
  tenantPlans,
  tenantQuotaSnapshots,
  tenants,
} from '@/server/db/schema';
import type { TenantDatabase } from '@/server/db/client';
import { createTenantManagementRepository } from '@/modules/open-platform/server/tenant-management-repository';

const ascMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    direction: 'asc',
  })),
);
const descMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    direction: 'desc',
  })),
);
const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'eq',
    value,
  })),
);
const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({
    conditions,
    operator: 'and',
  })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: andMock,
    asc: ascMock,
    desc: descMock,
    eq: eqMock,
  };
});

function createTenantManagementDatabase(rows: unknown[] = []) {
  const orderBy = vi.fn(async (..._orders: unknown[]) => rows);
  const leftJoinQuotaSnapshots = vi.fn(() => ({ orderBy }));
  const leftJoinAuthorizationSnapshots = vi.fn(() => ({ leftJoin: leftJoinQuotaSnapshots }));
  const leftJoinPlanVersions = vi.fn(() => ({ leftJoin: leftJoinAuthorizationSnapshots }));
  const leftJoinPlans = vi.fn(() => ({ leftJoin: leftJoinPlanVersions }));
  const leftJoinPlanAssignments = vi.fn(() => ({ leftJoin: leftJoinPlans }));
  const from = vi.fn(() => ({ leftJoin: leftJoinPlanAssignments }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    leftJoinAuthorizationSnapshots,
    leftJoinPlanAssignments,
    leftJoinPlanVersions,
    leftJoinPlans,
    leftJoinQuotaSnapshots,
    orderBy,
    select,
  };
}

const tenantRow = {
  id: 'demo-tenant-001',
  name: '智美天工演示机构',
  status: 'active',
  createdAt: new Date('2026-05-30T00:00:00.000Z'),
  updatedAt: new Date('2026-05-31T00:00:00.000Z'),
};

const planRow = {
  id: 'plan-growth-care',
  name: '成长版',
  code: 'growth-care',
  description: '适合增长期机构的演示套餐',
  status: 'active',
  createdAt: new Date('2026-05-30T00:00:00.000Z'),
  updatedAt: new Date('2026-05-30T00:00:00.000Z'),
};

const assignmentRow = {
  id: 'assign-demo-tenant-001-growth',
  tenantId: 'demo-tenant-001',
  planId: 'plan-growth-care',
  planVersionId: 'plan-version-growth-202606',
  status: 'active',
  startedAt: new Date('2026-05-31T00:00:00.000Z'),
  expiresAt: null,
  createdAt: new Date('2026-05-31T00:00:00.000Z'),
  updatedAt: new Date('2026-05-31T00:00:00.000Z'),
};

const planVersionRow = {
  id: 'plan-version-growth-202606',
  planId: 'plan-growth-care',
  versionCode: '2026-06-v1',
  status: 'published',
  displayName: 'Growth Care 2026-06',
  displayPrice: '¥2999/月',
  priceNote: '人工展示价格',
  agentLimit: 3,
  seatLimit: 40,
  monthlyAiCallLimit: 300000,
  knowledgeStorageGb: 100,
  connectorEntitlementsJson: { connectors: ['企微', 'HIS'] },
  serviceEntitlementsJson: { services: ['上线培训', '季度复盘'] },
  featureEntitlementsJson: { modules: ['客户管理', '知识库'] },
  quotaEntitlementsJson: { aiCallsPerMonth: 300000, knowledgeStorageGb: 100 },
  changeSummary: '首个正式版本',
  createdBy: 'demo-user-platform',
  updatedBy: 'demo-user-platform',
  publishedBy: 'demo-user-platform',
  publishedAt: new Date('2026-06-23T01:00:00.000Z'),
  retiredAt: null,
  createdAt: new Date('2026-06-23T00:00:00.000Z'),
  updatedAt: new Date('2026-06-23T01:00:00.000Z'),
};

const authorizationSnapshotRow = {
  id: 'auth-snapshot-demo-tenant-001-active',
  tenantId: 'demo-tenant-001',
  planAssignmentId: 'assign-demo-tenant-001-growth',
  planVersionId: 'plan-version-growth-202606',
  status: 'active',
  snapshotJson: {
    openingContact: {
      contactName: '陈磊',
      contactPhone: '13985162773',
      contactEmail: 'contact@example.com',
      adminName: '陈磊',
      adminAccount: 'zhengpu',
      adminContact: '13985162273',
      requestBody: { password: 'PlaintextPasswordShouldNotPass' },
      sql: 'select * from tenants',
    },
  },
  quotaJson: {},
  connectorJson: { connectors: ['企微', 'HIS'] },
  serviceJson: { services: ['上线培训', '季度复盘'] },
  sourceChangeRecordId: null,
  generatedBy: 'demo-user-platform',
  generatedAt: new Date('2026-06-23T02:00:00.000Z'),
  supersededAt: null,
  createdAt: new Date('2026-06-23T02:00:00.000Z'),
};

const snapshotRow = {
  id: 'quota-demo-tenant-001-current',
  tenantId: 'demo-tenant-001',
  planAssignmentId: 'assign-demo-tenant-001-growth',
  maxCustomers: 5000,
  maxAppointments: 2000,
  maxFollowUps: 10000,
  maxAiCalls: 50000,
  currentCustomers: 24,
  currentAppointments: 12,
  currentFollowUps: 36,
  currentAiCalls: 0,
  snapshotAt: new Date('2026-05-31T08:00:00.000Z'),
  createdAt: new Date('2026-05-31T08:00:00.000Z'),
};

beforeEach(() => {
  andMock.mockClear();
  ascMock.mockClear();
  descMock.mockClear();
  eqMock.mockClear();
});

describe('平台租户管理 repository', () => {
  it('查询租户列表并关联当前套餐和配额快照', async () => {
    const query = createTenantManagementDatabase([
      {
        tenant: tenantRow,
        plan: planRow,
        assignment: assignmentRow,
        planVersion: planVersionRow,
        authorizationSnapshot: authorizationSnapshotRow,
        quotaSnapshot: snapshotRow,
      },
    ]);

    const result = await createTenantManagementRepository(query.database).listTenantManagementRecords();

    expect(query.select).toHaveBeenCalledWith({
      tenant: tenants,
      plan: tenantPlans,
      assignment: tenantPlanAssignments,
      planVersion: tenantPlanVersions,
      authorizationSnapshot: tenantAuthorizationSnapshots,
      quotaSnapshot: tenantQuotaSnapshots,
    });
    expect(query.from).toHaveBeenCalledWith(tenants);
    expect(query.leftJoinPlanAssignments).toHaveBeenCalledWith(
      tenantPlanAssignments,
      {
        conditions: [
          { column: tenantPlanAssignments.tenantId, operator: 'eq', value: tenants.id },
          { column: tenantPlanAssignments.status, operator: 'eq', value: 'active' },
        ],
        operator: 'and',
      },
    );
    expect(query.leftJoinPlans).toHaveBeenCalledWith(
      tenantPlans,
      { column: tenantPlans.id, operator: 'eq', value: tenantPlanAssignments.planId },
    );
    expect(query.leftJoinPlanVersions).toHaveBeenCalledWith(
      tenantPlanVersions,
      { column: tenantPlanVersions.id, operator: 'eq', value: tenantPlanAssignments.planVersionId },
    );
    expect(query.leftJoinAuthorizationSnapshots).toHaveBeenCalledWith(
      tenantAuthorizationSnapshots,
      {
        conditions: [
          { column: tenantAuthorizationSnapshots.tenantId, operator: 'eq', value: tenants.id },
          { column: tenantAuthorizationSnapshots.status, operator: 'eq', value: 'active' },
        ],
        operator: 'and',
      },
    );
    expect(query.leftJoinQuotaSnapshots).toHaveBeenCalledWith(
      tenantQuotaSnapshots,
      {
        column: tenantQuotaSnapshots.planAssignmentId,
        operator: 'eq',
        value: tenantPlanAssignments.id,
      },
    );
    expect(result).toEqual([
      {
        tenantId: 'demo-tenant-001',
        tenantName: '智美天工演示机构',
        tenantStatus: 'active',
        createdAt: '2026-05-30T00:00:00.000Z',
        updatedAt: '2026-05-31T00:00:00.000Z',
        planName: '成长版',
        planCode: 'growth-care',
        planStatus: 'active',
        planVersionId: 'plan-version-growth-202606',
        planVersionCode: '2026-06-v1',
        planDisplayName: 'Growth Care 2026-06',
        planDisplayPrice: '¥2999/月',
        assignmentStatus: 'active',
        startedAt: '2026-05-31T00:00:00.000Z',
        expiresAt: null,
        agentLimit: 3,
        seatLimit: 40,
        monthlyAiCallLimit: 300000,
        knowledgeStorageGb: 100,
        connectorEntitlements: ['企微', 'HIS'],
        serviceEntitlements: ['上线培训', '季度复盘'],
        authorizationSnapshotId: 'auth-snapshot-demo-tenant-001-active',
        authorizationSnapshotStatus: 'active',
        authorizationGeneratedAt: '2026-06-23T02:00:00.000Z',
        openingContact: {
          contactName: '陈磊',
          contactPhone: '13985162773',
          contactEmail: 'contact@example.com',
          adminName: '陈磊',
          adminAccount: 'zhengpu',
          adminContact: '13985162273',
        },
        maxCustomers: 5000,
        maxAppointments: 2000,
        maxFollowUps: 10000,
        maxAiCalls: 50000,
        currentCustomers: 24,
        currentAppointments: 12,
        currentFollowUps: 36,
        currentAiCalls: 0,
        snapshotAt: '2026-05-31T08:00:00.000Z',
      },
    ]);
  });

  it('无套餐或无配额快照租户也能稳定返回 null 字段', async () => {
    const query = createTenantManagementDatabase([
      {
        tenant: { ...tenantRow, id: 'demo-tenant-003', name: '未分配套餐机构', status: 'suspended' },
        plan: null,
        assignment: null,
        planVersion: null,
        authorizationSnapshot: null,
        quotaSnapshot: null,
      },
    ]);

    const result = await createTenantManagementRepository(query.database).listTenantManagementRecords();

    expect(result).toEqual([
      {
        tenantId: 'demo-tenant-003',
        tenantName: '未分配套餐机构',
        tenantStatus: 'suspended',
        createdAt: '2026-05-30T00:00:00.000Z',
        updatedAt: '2026-05-31T00:00:00.000Z',
        planName: null,
        planCode: null,
        planStatus: null,
        planVersionId: null,
        planVersionCode: null,
        planDisplayName: null,
        planDisplayPrice: null,
        assignmentStatus: null,
        startedAt: null,
        expiresAt: null,
        agentLimit: null,
        seatLimit: null,
        monthlyAiCallLimit: null,
        knowledgeStorageGb: null,
        connectorEntitlements: [],
        serviceEntitlements: [],
        authorizationSnapshotId: null,
        authorizationSnapshotStatus: null,
        authorizationGeneratedAt: null,
        openingContact: null,
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
    ]);
  });

  it('返回 DTO 不包含业务明细、PII、SQL、stack、token 或 secret', async () => {
    const query = createTenantManagementDatabase([
      {
        tenant: {
          ...tenantRow,
          customers: [{ phoneNumber: '13800000000' }],
          sql: 'select * from customers',
        },
        plan: { ...planRow, token: 'sk_test_should_not_return' },
        assignment: { ...assignmentRow, secret: 'raw-secret' },
        planVersion: {
          ...planVersionRow,
          payment_token: 'payment_token_should_not_return',
          webhook_secret: 'webhook_secret_should_not_return',
        },
        authorizationSnapshot: {
          ...authorizationSnapshotRow,
          contract_body: '完整合同正文',
        },
        quotaSnapshot: {
          ...snapshotRow,
          treatmentRecord: '完整治疗记录正文',
          consultationTranscript: '咨询对话全文',
          stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
        },
      },
    ]);

    const result = await createTenantManagementRepository(query.database).listTenantManagementRecords();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('customers');
    expect(serialized).not.toContain('phoneNumber');
    expect(serialized).not.toContain('13800000000');
    expect(serialized).not.toContain('treatmentRecord');
    expect(serialized).not.toContain('完整治疗记录正文');
    expect(serialized).not.toContain('consultationTranscript');
    expect(serialized).not.toContain('咨询对话全文');
    expect(serialized).not.toContain('sql');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('payment_token');
    expect(serialized).not.toContain('webhook_secret');
    expect(serialized).not.toContain('contract_body');
    expect(serialized).not.toContain('PlaintextPasswordShouldNotPass');
    expect(serialized).not.toContain('select * from tenants');
  });
});
