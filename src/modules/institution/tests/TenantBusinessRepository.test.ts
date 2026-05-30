import { describe, expect, it, vi } from 'vitest';
import { appointments, customers, followUpTasks } from '@/server/db/schema';
import type { TenantDatabase } from '@/server/db/client';
import {
  createTenantBusinessRepository,
  mapAppointmentRowToRecord,
  mapCustomerRowToRecord,
  mapFollowUpTaskRowToRecord,
} from '@/modules/institution/server/tenant-business-repository';

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
    eq: eqMock,
  };
});

function createSelectDatabase(rows: unknown[] = []) {
  const where = vi.fn(async () => rows);
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    select,
    where,
  };
}

function createMutationDatabase(row: unknown | null = null) {
  const returning = vi.fn(async () => (row ? [row] : []));
  const where = vi.fn((condition: unknown) => {
    void condition;
    return { returning };
  });
  const set = vi.fn((values: Record<string, unknown>) => {
    void values;
    return { where };
  });
  const update = vi.fn(() => ({ set }));
  const values = vi.fn((input: unknown) => {
    void input;
    return { returning };
  });
  const insert = vi.fn(() => ({ values }));

  return {
    database: { insert, update, select: vi.fn() } as unknown as TenantDatabase,
    insert,
    update,
    values,
    set,
    where,
    returning,
  };
}

function createFollowUpTransitionDatabase(currentRow: unknown | null, updatedRow: unknown | null) {
  const selectWhere = vi.fn(async (condition: unknown) => {
    void condition;
    return currentRow ? [currentRow] : [];
  });
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));
  const returning = vi.fn(async () => (updatedRow ? [updatedRow] : []));
  const updateWhere = vi.fn((condition: unknown) => {
    void condition;
    return { returning };
  });
  const set = vi.fn((values: Record<string, unknown>) => {
    void values;
    return { where: updateWhere };
  });
  const update = vi.fn(() => ({ set }));

  return {
    database: { insert: vi.fn(), update, select } as unknown as TenantDatabase,
    from,
    returning,
    select,
    selectWhere,
    set,
    update,
    updateWhere,
  };
}

const customerRow = {
  id: 'cust_001',
  tenantId: 'demo-tenant-001',
  displayName: '王女士',
  lifecycle: 'repurchase_window',
  priority: 'high',
  ownerUserId: 'consultant-lin',
  projectInterest: '热玛吉修复组合',
  maskedPhone: '138****1208',
  maskedMedicalRecordNo: 'MR****001',
  lastTouchSummary: '术后第 28 天',
  nextAction: '人工回访',
  tags: ['高价值'],
  createdAt: new Date('2026-05-30T00:00:00.000Z'),
  updatedAt: new Date('2026-05-30T00:00:00.000Z'),
} satisfies typeof customers.$inferSelect;

const appointmentRow = {
  id: 'appt_001',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_001',
  customerDisplayName: '王女士',
  project: '水光补水',
  scheduledAt: new Date('2026-06-01T02:30:00.000Z'),
  consultantUserId: 'consultant-xu',
  status: 'pending_confirmation',
  note: '待确认',
  createdAt: new Date('2026-05-30T00:00:00.000Z'),
  updatedAt: new Date('2026-05-30T00:00:00.000Z'),
} satisfies typeof appointments.$inferSelect;

const followUpTaskRow = {
  id: 'fu_001',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_001',
  customerDisplayName: '王女士',
  journeyId: 'journey_repurchase',
  stage: 'D28 复购建议',
  status: 'due',
  dueAt: new Date('2026-05-30T10:00:00.000Z'),
  suggestedAction: '人工回访',
  riskLevel: 'urgent',
  updatedBy: null,
  updatedAt: null,
  createdAt: new Date('2026-05-30T00:00:00.000Z'),
} satisfies typeof followUpTasks.$inferSelect;

describe('租户业务仓储映射', () => {
  it('把客户数据库行映射为领域记录且只保留脱敏字段', () => {
    const record = mapCustomerRowToRecord(customerRow);

    expect(record).toEqual({
      id: 'cust_001',
      tenantId: 'demo-tenant-001',
      displayName: '王女士',
      lifecycle: 'repurchase_window',
      priority: 'high',
      ownerUserId: 'consultant-lin',
      projectInterest: '热玛吉修复组合',
      maskedPhone: '138****1208',
      maskedMedicalRecordNo: 'MR****001',
      lastTouchSummary: '术后第 28 天',
      nextAction: '人工回访',
      tags: ['高价值'],
    });
    expect(JSON.stringify(record)).not.toMatch(/phoneNumber|idNumber|medicalRecordNo/);
    expect(record).not.toHaveProperty('createdAt');
    expect(record).not.toHaveProperty('updatedAt');
  });

  it('把预约和随访行映射为领域记录', () => {
    const appointment = mapAppointmentRowToRecord(appointmentRow);

    expect(appointment).toEqual({
      id: 'appt_001',
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
      customerDisplayName: '王女士',
      project: '水光补水',
      scheduledAt: '2026-06-01T02:30:00.000Z',
      consultantUserId: 'consultant-xu',
      status: 'pending_confirmation',
      note: '待确认',
    });
    expect(appointment).not.toHaveProperty('createdAt');
    expect(appointment).not.toHaveProperty('updatedAt');

    const followUpTask = mapFollowUpTaskRowToRecord(followUpTaskRow);

    expect(followUpTask).toEqual({
      id: 'fu_001',
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
      customerDisplayName: '王女士',
      journeyId: 'journey_repurchase',
      stage: 'D28 复购建议',
      status: 'due',
      dueAt: '2026-05-30T10:00:00.000Z',
      suggestedAction: '人工回访',
      riskLevel: 'urgent',
      updatedBy: null,
      updatedAt: null,
    });
    expect(followUpTask).not.toHaveProperty('createdAt');
  });

  it('列表查询按 tenantId 过滤客户、预约和随访任务', async () => {
    const customerQuery = createSelectDatabase();
    await createTenantBusinessRepository(customerQuery.database).listCustomersByTenant(
      'demo-tenant-001',
    );

    expect(customerQuery.from).toHaveBeenCalledWith(customers);
    expect(eqMock).toHaveBeenLastCalledWith(customers.tenantId, 'demo-tenant-001');
    expect(customerQuery.where).toHaveBeenCalledWith({
      column: customers.tenantId,
      operator: 'eq',
      value: 'demo-tenant-001',
    });

    const appointmentQuery = createSelectDatabase();
    await createTenantBusinessRepository(appointmentQuery.database).listAppointmentsByTenant(
      'demo-tenant-001',
    );

    expect(appointmentQuery.from).toHaveBeenCalledWith(appointments);
    expect(eqMock).toHaveBeenLastCalledWith(appointments.tenantId, 'demo-tenant-001');
    expect(appointmentQuery.where).toHaveBeenCalledWith({
      column: appointments.tenantId,
      operator: 'eq',
      value: 'demo-tenant-001',
    });

    const followUpQuery = createSelectDatabase();
    await createTenantBusinessRepository(followUpQuery.database).listFollowUpTasksByTenant(
      'demo-tenant-001',
    );

    expect(followUpQuery.from).toHaveBeenCalledWith(followUpTasks);
    expect(eqMock).toHaveBeenLastCalledWith(followUpTasks.tenantId, 'demo-tenant-001');
    expect(followUpQuery.where).toHaveBeenCalledWith({
      column: followUpTasks.tenantId,
      operator: 'eq',
      value: 'demo-tenant-001',
    });
  });

  it('创建客户写入 customers、使用调用方 tenantId 并返回脱敏记录', async () => {
    const mutation = createMutationDatabase(customerRow);
    const input = {
      ...customerRow,
      tenantId: 'demo-tenant-001',
      createdAt: undefined,
      updatedAt: undefined,
    };

    const record = await createTenantBusinessRepository(mutation.database).createCustomer(input);

    expect(mutation.insert).toHaveBeenCalledWith(customers);
    expect(mutation.values).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: input.tenantId }),
    );
    expect(record).toEqual(mapCustomerRowToRecord(customerRow));
    expect(JSON.stringify(record)).not.toMatch(/phoneNumber|idNumber|medicalRecordNo/);
  });

  it('updateCustomer 按 tenantId + id 更新客户且无返回行时返回 null', async () => {
    const mutation = createMutationDatabase(null);

    const record = await createTenantBusinessRepository(mutation.database).updateCustomer({
      tenantId: 'demo-tenant-001',
      id: 'cust_001',
      displayName: '王女士更新',
      projectInterest: undefined,
    });

    expect(mutation.update).toHaveBeenCalledWith(customers);
    expect(mutation.set).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: '王女士更新',
        updatedAt: expect.any(Date),
      }),
    );
    expect(mutation.set).toHaveBeenCalled();
    const updateValues = mutation.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateValues).not.toHaveProperty('projectInterest');
    expect(eqMock).toHaveBeenCalledWith(customers.tenantId, 'demo-tenant-001');
    expect(eqMock).toHaveBeenCalledWith(customers.id, 'cust_001');
    expect(andMock).toHaveBeenCalledWith(
      { column: customers.tenantId, operator: 'eq', value: 'demo-tenant-001' },
      { column: customers.id, operator: 'eq', value: 'cust_001' },
    );
    expect(mutation.where).toHaveBeenCalledWith({
      conditions: [
        { column: customers.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: customers.id, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
    expect(record).toBeNull();
  });

  it('创建预约写入调用方 tenantId 并映射 scheduledAt', async () => {
    const mutation = createMutationDatabase(appointmentRow);

    const record = await createTenantBusinessRepository(mutation.database).createAppointment({
      ...appointmentRow,
      tenantId: 'demo-tenant-001',
      createdAt: undefined,
      updatedAt: undefined,
    });

    expect(mutation.insert).toHaveBeenCalledWith(appointments);
    expect(mutation.values).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'demo-tenant-001' }),
    );
    expect(record).toEqual({
      ...mapAppointmentRowToRecord(appointmentRow),
      scheduledAt: '2026-06-01T02:30:00.000Z',
    });
  });

  it('更新预约使用 appointments 设置状态和备注并返回映射记录', async () => {
    const mutation = createMutationDatabase({
      ...appointmentRow,
      status: 'confirmed',
      note: '已确认',
    });

    const record = await createTenantBusinessRepository(mutation.database).updateAppointment({
      tenantId: 'demo-tenant-001',
      id: 'appt_001',
      status: 'confirmed',
      note: '已确认',
    });

    expect(mutation.update).toHaveBeenCalledWith(appointments);
    expect(mutation.set).toHaveBeenCalledWith({
      status: 'confirmed',
      note: '已确认',
      updatedAt: expect.any(Date),
    });
    expect(mutation.where).toHaveBeenCalledWith({
      conditions: [
        { column: appointments.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: appointments.id, operator: 'eq', value: 'appt_001' },
      ],
      operator: 'and',
    });
    expect(record).toEqual(
      mapAppointmentRowToRecord({
        ...appointmentRow,
        status: 'confirmed',
        note: '已确认',
      }),
    );
  });

  it('随访状态流转先按 tenantId + id 查询，查不到时返回 not_found', async () => {
    const mutation = createFollowUpTransitionDatabase(null, null);

    const result = await createTenantBusinessRepository(mutation.database).transitionFollowUpTask({
      tenantId: 'demo-tenant-001',
      id: 'fu_001',
      nextStatus: 'in_progress',
      actorId: 'consultant-lin',
      occurredAt: '2026-05-30T11:00:00.000Z',
    });

    expect(mutation.from).toHaveBeenCalledWith(followUpTasks);
    expect(mutation.selectWhere).toHaveBeenCalledWith({
      conditions: [
        { column: followUpTasks.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: followUpTasks.id, operator: 'eq', value: 'fu_001' },
      ],
      operator: 'and',
    });
    expect(mutation.update).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'not_found' });
  });

  it('随访状态非法流转返回 invalid_transition 且不写库', async () => {
    const mutation = createFollowUpTransitionDatabase(followUpTaskRow, null);

    const result = await createTenantBusinessRepository(mutation.database).transitionFollowUpTask({
      tenantId: 'demo-tenant-001',
      id: 'fu_001',
      nextStatus: 'completed',
      actorId: 'consultant-lin',
      occurredAt: '2026-05-30T11:00:00.000Z',
    });

    expect(mutation.update).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'invalid_transition', from: 'due', to: 'completed' });
  });

  it('随访状态合法流转按 tenantId + id 更新状态、操作人和更新时间', async () => {
    const updatedRow = {
      ...followUpTaskRow,
      status: 'in_progress' as const,
      updatedBy: 'consultant-lin',
      updatedAt: new Date('2026-05-30T11:00:00.000Z'),
    };
    const mutation = createFollowUpTransitionDatabase(followUpTaskRow, updatedRow);

    const result = await createTenantBusinessRepository(mutation.database).transitionFollowUpTask({
      tenantId: 'demo-tenant-001',
      id: 'fu_001',
      nextStatus: 'in_progress',
      actorId: 'consultant-lin',
      occurredAt: '2026-05-30T11:00:00.000Z',
    });

    expect(mutation.update).toHaveBeenCalledWith(followUpTasks);
    expect(mutation.set).toHaveBeenCalledWith({
      status: 'in_progress',
      updatedBy: 'consultant-lin',
      updatedAt: new Date('2026-05-30T11:00:00.000Z'),
    });
    expect(mutation.updateWhere).toHaveBeenCalledWith({
      conditions: [
        { column: followUpTasks.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: followUpTasks.id, operator: 'eq', value: 'fu_001' },
      ],
      operator: 'and',
    });
    expect(result).toEqual({
      kind: 'updated',
      task: mapFollowUpTaskRowToRecord(updatedRow),
    });
  });
});
