import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  tenantPlanAssignments,
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

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    asc: ascMock,
    desc: descMock,
    eq: eqMock,
  };
});

function createTenantManagementDatabase(rows: unknown[] = []) {
  const orderBy = vi.fn(async (..._orders: unknown[]) => rows);
  const leftJoinQuotaSnapshots = vi.fn(() => ({ orderBy }));
  const leftJoinPlanAssignments = vi.fn(() => ({ leftJoin: leftJoinQuotaSnapshots }));
  const leftJoinPlans = vi.fn(() => ({ leftJoin: leftJoinPlanAssignments }));
  const from = vi.fn(() => ({ leftJoin: leftJoinPlans }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    leftJoinPlanAssignments,
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
  status: 'active',
  startedAt: new Date('2026-05-31T00:00:00.000Z'),
  expiresAt: null,
  createdAt: new Date('2026-05-31T00:00:00.000Z'),
  updatedAt: new Date('2026-05-31T00:00:00.000Z'),
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
        quotaSnapshot: snapshotRow,
      },
    ]);

    const result = await createTenantManagementRepository(query.database).listTenantManagementRecords();

    expect(query.from).toHaveBeenCalledWith(tenants);
    expect(query.leftJoinPlans).toHaveBeenCalledWith(
      tenantPlanAssignments,
      { column: tenantPlanAssignments.tenantId, operator: 'eq', value: tenants.id },
    );
    expect(query.leftJoinPlanAssignments).toHaveBeenCalledWith(
      tenantPlans,
      { column: tenantPlans.id, operator: 'eq', value: tenantPlanAssignments.planId },
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
        planName: '成长版',
        planCode: 'growth-care',
        planStatus: 'active',
        assignmentStatus: 'active',
        startedAt: '2026-05-31T00:00:00.000Z',
        expiresAt: null,
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
        quotaSnapshot: null,
      },
    ]);

    const result = await createTenantManagementRepository(query.database).listTenantManagementRecords();

    expect(result).toEqual([
      {
        tenantId: 'demo-tenant-003',
        tenantName: '未分配套餐机构',
        tenantStatus: 'suspended',
        planName: null,
        planCode: null,
        planStatus: null,
        assignmentStatus: null,
        startedAt: null,
        expiresAt: null,
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
  });
});
