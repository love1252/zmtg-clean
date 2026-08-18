import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appointments,
  authUsers,
  customers,
  tenantMembers,
  tenantPlanAssignments,
  tenantPlans,
  tenantPlanVersions,
  tenantQuotaSnapshots,
} from '@/server/db/schema';
import type { TenantDatabase } from '@/server/db/client';
import {
  checkTenantQuotaForCreate,
  createTenantQuotaEnforcementRepository,
  CUSTOMER_CREATE_QUOTA_LOCK_NAMESPACE,
  lockTenantCustomerCreateQuotaV1,
} from '@/modules/institution/server/tenant-quota-enforcement';

const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({
    conditions,
    operator: 'and',
  })),
);
const countMock = vi.hoisted(() =>
  vi.fn(() => ({
    aggregate: 'count',
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

const inArrayMock = vi.hoisted(() =>
  vi.fn((column: unknown, values: unknown[]) => ({
    column,
    operator: 'inArray',
    values,
  })),
);
const sqlMock = vi.hoisted(() =>
  vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    operator: 'sql',
    strings,
    values,
  })),
);
const sumMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    aggregate: 'sum',
    column,
  })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: andMock,
    count: countMock,
    desc: descMock,
    eq: eqMock,
    inArray: inArrayMock,
    sql: sqlMock,
    sum: sumMock,
  };
});

type QuotaQueryRow = {
  assignment: {
    id: string;
    tenantId: string;
    planId: string;
    status: 'active' | 'scheduled' | 'expired';
  } | null;
  plan: {
    id: string;
    name: string;
    code: string;
    description: string;
    status: 'active' | 'retired';
  } | null;
  planVersion: {
    id: string;
    quotaEntitlementsJson?: unknown;
    knowledgeStorageGb?: number | null;
    monthlyAiCallLimit?: number | null;
    seatLimit?: number | null;
  } | null;
  quotaSnapshot: {
    id: string;
    tenantId: string;
    planAssignmentId: string;
    maxCustomers?: number | null;
    maxAppointments?: number | null;
    currentCustomers?: number | null;
    currentAppointments?: number | null;
    snapshotAt?: Date;
  } | null;
};

function createQuotaRow(input?: {
  planCode?: string;
  maxCustomers?: number | null;
  maxAppointments?: number | null;
  currentCustomers?: number | null;
  currentAppointments?: number | null;
  withSnapshot?: boolean;
}): QuotaQueryRow {
  const {
    planCode = 'growth-care',
    maxCustomers = 5000,
    maxAppointments = 2000,
    currentCustomers = 24,
    currentAppointments = 12,
    withSnapshot = true,
  } = input ?? {};

  return {
    assignment: {
      id: 'assign-demo-tenant-001-growth',
      tenantId: 'demo-tenant-001',
      planId: 'plan-growth-care',
      status: 'active',
    },
    plan: {
      id: 'plan-growth-care',
      name: '成长版',
      code: planCode,
      description: '适合增长期机构的演示套餐',
      status: 'active',
    },
    planVersion: null,
    quotaSnapshot: withSnapshot
      ? {
          id: 'quota-demo-tenant-001-current',
          tenantId: 'demo-tenant-001',
          planAssignmentId: 'assign-demo-tenant-001-growth',
          maxCustomers,
          maxAppointments,
          currentCustomers,
          currentAppointments,
          snapshotAt: new Date('2026-05-31T08:00:00.000Z'),
        }
      : null,
  };
}

function createQuotaEnforcementDatabase(input?: {
  quotaRows?: QuotaQueryRow[];
  customerCount?: number;
  appointmentCount?: number;
}) {
  const { quotaRows = [], customerCount = 0, appointmentCount = 0 } = input ?? {};

  const limit = vi.fn(async (_value: number) => quotaRows);
  const orderBy = vi.fn(() => ({ limit }));
  const activePlanWhere = vi.fn(() => ({ orderBy }));
  const leftJoinQuotaSnapshots = vi.fn(() => ({ where: activePlanWhere }));
  const leftJoinPlanVersions = vi.fn(() => ({ leftJoin: leftJoinQuotaSnapshots }));
  const innerJoinPlans = vi.fn(() => ({ leftJoin: leftJoinPlanVersions }));
  const activePlanFrom = vi.fn(() => ({ innerJoin: innerJoinPlans }));

  const customerWhere = vi.fn(async (_condition: unknown) => [{ value: customerCount }]);
  const appointmentWhere = vi.fn(async (_condition: unknown) => [{ value: appointmentCount }]);
  const countFrom = vi.fn((table: unknown) => {
    if (table === customers) {
      return { where: customerWhere };
    }

    if (table === appointments) {
      return { where: appointmentWhere };
    }

    throw new Error('unexpected count table');
  });

  const select = vi.fn((selection: Record<string, unknown>) => {
    if ('assignment' in selection) {
      return { from: activePlanFrom };
    }

    return { from: countFrom };
  });

  return {
    activePlanFrom,
    activePlanWhere,
    appointmentWhere,
    countFrom,
    customerWhere,
    database: { select } as unknown as TenantDatabase,
    innerJoinPlans,
    leftJoinPlanVersions,
    leftJoinQuotaSnapshots,
    limit,
    orderBy,
    select,
  };
}

beforeEach(() => {
  andMock.mockClear();
  countMock.mockClear();
  descMock.mockClear();
  eqMock.mockClear();
  inArrayMock.mockClear();
  sqlMock.mockClear();
  sumMock.mockClear();
});

describe('租户套餐配额 enforcement helper', () => {
  it('客户 Controlled Create 使用 tenant-scoped transaction advisory lock', async () => {
    const execute = vi.fn(async (_statement: unknown) => undefined);
    const database = { execute } as unknown as TenantDatabase;

    await lockTenantCustomerCreateQuotaV1({
      database,
      tenantId: 'demo-tenant-001',
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(sqlMock.mock.calls.at(-1)?.slice(1)).toEqual([
      CUSTOMER_CREATE_QUOTA_LOCK_NAMESPACE,
      'demo-tenant-001',
    ]);
  });

  it('员工席位只统计 active Membership 与 active 账号', async () => {
    const where = vi.fn(async () => [{ value: 2 }]);
    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn(() => ({ from }));
    const repository = createTenantQuotaEnforcementRepository({
      select,
    } as unknown as TenantDatabase);

    await expect(
      repository.countActiveStaffSeatsByTenant('demo-tenant-001'),
    ).resolves.toBe(2);
    expect(from).toHaveBeenCalledWith(tenantMembers);
    expect(innerJoin).toHaveBeenCalledWith(authUsers, {
      column: authUsers.id,
      operator: 'eq',
      value: tenantMembers.userId,
    });
    expect(where).toHaveBeenCalledWith({
      conditions: [
        { column: tenantMembers.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: tenantMembers.role, operator: 'eq', value: 'tenant_admin' },
        { column: tenantMembers.lifecycleStatus, operator: 'eq', value: 'active' },
        { column: authUsers.status, operator: 'eq', value: 'active' },
      ],
      operator: 'and',
    });
  });

  it('有 active plan 且未超客户上限时允许新增客户', async () => {
    const query = createQuotaEnforcementDatabase({
      quotaRows: [createQuotaRow({ maxCustomers: 5000, currentCustomers: 9999 })],
      customerCount: 24,
    });

    await expect(
      checkTenantQuotaForCreate({
        database: query.database,
        tenantId: 'demo-tenant-001',
        resource: 'customers',
      }),
    ).resolves.toEqual({
      allowed: true,
      current: 24,
      limit: 5000,
      resource: 'customers',
    });

    expect(query.countFrom).toHaveBeenCalledWith(customers);
    expect(query.customerWhere).toHaveBeenCalledWith({
      column: customers.tenantId,
      operator: 'eq',
      value: 'demo-tenant-001',
    });
  });

  it('有 active plan 且已达客户上限时拒绝新增客户', async () => {
    const query = createQuotaEnforcementDatabase({
      quotaRows: [createQuotaRow({ maxCustomers: 24 })],
      customerCount: 24,
    });

    await expect(
      checkTenantQuotaForCreate({
        database: query.database,
        tenantId: 'demo-tenant-001',
        resource: 'customers',
      }),
    ).resolves.toEqual({
      allowed: false,
      current: 24,
      limit: 24,
      reason: 'quota_exceeded_customers',
      resource: 'customers',
    });
  });

  it('有 active plan 且未超预约上限时允许新增预约', async () => {
    const query = createQuotaEnforcementDatabase({
      appointmentCount: 1999,
      quotaRows: [createQuotaRow({ maxAppointments: 2000, currentAppointments: 9999 })],
    });

    await expect(
      checkTenantQuotaForCreate({
        database: query.database,
        tenantId: 'demo-tenant-001',
        resource: 'appointments',
      }),
    ).resolves.toEqual({
      allowed: true,
      current: 1999,
      limit: 2000,
      resource: 'appointments',
    });

    expect(query.countFrom).toHaveBeenCalledWith(appointments);
    expect(query.appointmentWhere).toHaveBeenCalledWith({
      column: appointments.tenantId,
      operator: 'eq',
      value: 'demo-tenant-001',
    });
  });

  it('有 active plan 且已达预约上限时拒绝新增预约', async () => {
    const query = createQuotaEnforcementDatabase({
      appointmentCount: 2000,
      quotaRows: [createQuotaRow({ maxAppointments: 2000 })],
    });

    await expect(
      checkTenantQuotaForCreate({
        database: query.database,
        tenantId: 'demo-tenant-001',
        resource: 'appointments',
      }),
    ).resolves.toEqual({
      allowed: false,
      current: 2000,
      limit: 2000,
      reason: 'quota_exceeded_appointments',
      resource: 'appointments',
    });
  });

  it('无 active plan 时 fail closed 且不读取业务表计数', async () => {
    const query = createQuotaEnforcementDatabase({ quotaRows: [], customerCount: 0 });

    await expect(
      checkTenantQuotaForCreate({
        database: query.database,
        tenantId: 'demo-tenant-001',
        resource: 'customers',
      }),
    ).resolves.toEqual({
      allowed: false,
      current: null,
      limit: null,
      reason: 'missing_active_plan',
      resource: 'customers',
    });

    expect(query.countFrom).not.toHaveBeenCalled();
  });

  it('无 quota limit 时 fail closed 且不读取业务表计数', async () => {
    const query = createQuotaEnforcementDatabase({
      quotaRows: [createQuotaRow({ planCode: 'unknown-plan', withSnapshot: false })],
    });

    await expect(
      checkTenantQuotaForCreate({
        database: query.database,
        tenantId: 'demo-tenant-001',
        resource: 'customers',
      }),
    ).resolves.toEqual({
      allowed: false,
      current: null,
      limit: null,
      reason: 'missing_quota_limit',
      resource: 'customers',
    });

    expect(query.countFrom).not.toHaveBeenCalled();
  });

  it('无 quota snapshot 但 active plan 可解析 quota limit 时按 live count 判断', async () => {
    const query = createQuotaEnforcementDatabase({
      appointmentCount: 399,
      quotaRows: [createQuotaRow({ planCode: 'starter-care', withSnapshot: false })],
    });

    await expect(
      checkTenantQuotaForCreate({
        database: query.database,
        tenantId: 'demo-tenant-001',
        resource: 'appointments',
      }),
    ).resolves.toEqual({
      allowed: true,
      current: 399,
      limit: 400,
      resource: 'appointments',
    });
  });

  it('active plan、quota limit 和 live count 查询均按当前 tenantId 过滤', async () => {
    const query = createQuotaEnforcementDatabase({
      quotaRows: [createQuotaRow({ maxCustomers: 25 })],
      customerCount: 24,
    });

    await checkTenantQuotaForCreate({
      database: query.database,
      tenantId: 'demo-tenant-001',
      resource: 'customers',
    });

    expect(query.activePlanFrom).toHaveBeenCalledWith(tenantPlanAssignments);
    expect(query.innerJoinPlans).toHaveBeenCalledWith(
      tenantPlans,
      { column: tenantPlans.id, operator: 'eq', value: tenantPlanAssignments.planId },
    );
    expect(query.leftJoinPlanVersions).toHaveBeenCalledWith(
      tenantPlanVersions,
      { column: tenantPlanVersions.id, operator: 'eq', value: tenantPlanAssignments.planVersionId },
    );
    expect(query.leftJoinQuotaSnapshots).toHaveBeenCalledWith(
      tenantQuotaSnapshots,
      {
        column: tenantQuotaSnapshots.planAssignmentId,
        operator: 'eq',
        value: tenantPlanAssignments.id,
      },
    );
    expect(query.activePlanWhere).toHaveBeenCalledWith({
      conditions: [
        { column: tenantPlanAssignments.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: tenantPlanAssignments.status, operator: 'eq', value: 'active' },
        { column: tenantPlans.status, operator: 'eq', value: 'active' },
      ],
      operator: 'and',
    });
    expect(query.orderBy).toHaveBeenCalledWith(
      {
        column: tenantQuotaSnapshots.snapshotAt,
        direction: 'desc',
      },
      {
        column: tenantPlanAssignments.updatedAt,
        direction: 'desc',
      },
    );
  });

  it('enforcement 结果不包含 PII、SQL、stack 或连接串', async () => {
    const baseRow = createQuotaRow({ maxCustomers: 25 });

    const query = createQuotaEnforcementDatabase({
      customerCount: 24,
      quotaRows: [
        {
          ...baseRow,
          plan: {
            ...baseRow.plan!,
            token: 'sk_test_should_not_return',
          } as QuotaQueryRow['plan'],
          quotaSnapshot: {
            ...baseRow.quotaSnapshot!,
            consultationTranscript: '咨询对话全文',
            phoneNumber: '13800000000',
            stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
          } as QuotaQueryRow['quotaSnapshot'],
        },
      ],
    });

    const result = await checkTenantQuotaForCreate({
      database: query.database,
      tenantId: 'demo-tenant-001',
      resource: 'customers',
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('13800000000');
    expect(serialized).not.toContain('phoneNumber');
    expect(serialized).not.toContain('consultationTranscript');
    expect(serialized).not.toContain('咨询对话全文');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('secret');
  });

  it('不会写入客户、预约或 quota snapshot 业务表', async () => {
    const query = createQuotaEnforcementDatabase({
      customerCount: 24,
      quotaRows: [createQuotaRow({ maxCustomers: 25 })],
    });
    const database = {
      ...query.database,
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as TenantDatabase;

    await checkTenantQuotaForCreate({
      database,
      tenantId: 'demo-tenant-001',
      resource: 'customers',
    });

    expect(database.insert).not.toHaveBeenCalled();
    expect(database.update).not.toHaveBeenCalled();
    expect(database.delete).not.toHaveBeenCalled();
  });
});
