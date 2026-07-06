import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { appointments, customers, followUpTasks, treatmentSummaries } from '@/server/db/schema';
import type { TenantDatabase } from '@/server/db/client';
import {
  createTenantBusinessRepository,
  mapAppointmentRowToRecord,
  mapCustomerRowToRecord,
  mapFollowUpTaskSourceRowToRecord,
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
const isNotNullMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    operator: 'isNotNull',
  })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: andMock,
    eq: eqMock,
    isNotNull: isNotNullMock,
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

function createSourceFollowUpCreateDatabase(input: {
  sourceRows?: unknown[];
  existingRows?: unknown[];
  insertedRow?: unknown | null;
}) {
  const sourceWhere = vi.fn(async (condition: unknown) => {
    void condition;
    return input.sourceRows ?? [];
  });
  const sourceFrom = vi.fn(() => ({ where: sourceWhere }));
  const existingWhere = vi.fn(async (condition: unknown) => {
    void condition;
    return input.existingRows ?? [];
  });
  const existingFrom = vi.fn(() => ({ where: existingWhere }));
  const select = vi
    .fn()
    .mockReturnValueOnce({ from: sourceFrom })
    .mockReturnValueOnce({ from: existingFrom });
  const returning = vi.fn(async () => (input.insertedRow ? [input.insertedRow] : []));
  const values = vi.fn((valuesInput: unknown) => {
    void valuesInput;
    return { returning };
  });
  const insert = vi.fn(() => ({ values }));

  return {
    database: { insert, update: vi.fn(), select } as unknown as TenantDatabase,
    existingFrom,
    existingWhere,
    insert,
    returning,
    select,
    sourceFrom,
    sourceWhere,
    values,
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
  sourceTreatmentSummaryId: null,
  sourceSuggestionKey: null,
  updatedBy: null,
  updatedAt: null,
  createdAt: new Date('2026-05-30T00:00:00.000Z'),
} satisfies typeof followUpTasks.$inferSelect;

const sourceTreatmentSummaryRow = {
  id: 'ts_001',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_001',
  appointmentId: 'appt_001',
  treatmentDate: new Date('2026-05-29T02:00:00.000Z'),
  treatmentProject: '水光补水',
  treatmentCategory: 'injectable',
  treatmentStage: 'post_treatment',
  recoveryStage: 'early_recovery',
  riskLevel: 'watch',
  ownerUserId: 'consultant-lin',
  summary: '结构化安全摘要',
  nextCareAction: '确认术后护理情况',
  tags: ['术后护理'],
  voidedAt: null,
  voidedBy: null,
  voidReasonCode: null,
  voidReason: null,
  createdAt: new Date('2026-05-30T00:00:00.000Z'),
  updatedAt: new Date('2026-05-30T00:00:00.000Z'),
} satisfies typeof treatmentSummaries.$inferSelect;

const sourceFollowUpTaskRow = {
  ...followUpTaskRow,
  id: 'fu_from_summary_001',
  status: 'scheduled' as const,
  sourceTreatmentSummaryId: 'ts_001',
  sourceSuggestionKey: 'ts_001:risk-fast-check:offset-1d',
} satisfies typeof followUpTasks.$inferSelect;

const sourceFollowUpCreateInput = {
  id: 'fu_from_summary_001',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_001',
  customerDisplayName: '王女士',
  journeyId: 'journey_post_treatment_care',
  stage: '术后护理确认',
  dueAt: '2026-05-31T10:00:00.000Z',
  suggestedAction: '人工确认恢复情况并记录异常',
  riskLevel: 'watch' as const,
  sourceTreatmentSummaryId: 'ts_001',
  sourceSuggestionKey: 'ts_001:risk-fast-check:offset-1d',
};

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
      requiresHumanHandling: true,
      forbidAutoReachOut: true,
      updatedBy: null,
      updatedAt: null,
      source: null,
      sourceTreatmentSummaryId: null,
      sourceSuggestionKey: null,
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

  it('按来源筛选随访任务时始终绑定当前 tenantId 并返回安全来源字段', async () => {
    const sourceQuery = createSelectDatabase([sourceFollowUpTaskRow]);

    const sourceRecords = await createTenantBusinessRepository(
      sourceQuery.database,
    ).listFollowUpTasksByTenant({
      tenantId: 'demo-tenant-001',
      filters: {
        source: 'treatment_summary',
        sourceTreatmentSummaryId: null,
      },
    });

    expect(sourceQuery.from).toHaveBeenCalledWith(followUpTasks);
    expect(sourceQuery.where).toHaveBeenCalledWith({
      conditions: [
        { column: followUpTasks.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: followUpTasks.sourceTreatmentSummaryId, operator: 'isNotNull' },
        { column: followUpTasks.sourceSuggestionKey, operator: 'isNotNull' },
      ],
      operator: 'and',
    });
    expect(sourceRecords).toEqual([mapFollowUpTaskRowToRecord(sourceFollowUpTaskRow)]);
    expect(JSON.stringify(sourceRecords)).not.toMatch(
      /phoneNumber|idNumber|medicalRecordNo|完整治疗记录正文|完整病历正文|咨询对话全文|sql|stack|token|secret|DATABASE_URL/i,
    );

    const summaryQuery = createSelectDatabase([sourceFollowUpTaskRow]);

    const summaryRecords = await createTenantBusinessRepository(
      summaryQuery.database,
    ).listFollowUpTasksByTenant({
      tenantId: 'demo-tenant-001',
      filters: {
        source: null,
        sourceTreatmentSummaryId: 'ts_001',
      },
    });

    expect(summaryQuery.where).toHaveBeenCalledWith({
      conditions: [
        { column: followUpTasks.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: followUpTasks.sourceTreatmentSummaryId, operator: 'eq', value: 'ts_001' },
        { column: followUpTasks.sourceSuggestionKey, operator: 'isNotNull' },
      ],
      operator: 'and',
    });
    expect(summaryRecords).toEqual([mapFollowUpTaskRowToRecord(sourceFollowUpTaskRow)]);
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

  it('更新客户方法按 tenantId + id 更新客户且无返回行时返回 null', async () => {
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

  it('更新客户方法即使收到不安全入参也不会写入 createdAt、tenantId 或 id', async () => {
    const mutation = createMutationDatabase(customerRow);
    const repository = createTenantBusinessRepository(mutation.database);

    await repository.updateCustomer({
      tenantId: 'demo-tenant-001',
      id: 'cust_001',
      displayName: '王女士更新',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    } as unknown as Parameters<typeof repository.updateCustomer>[0]);

    expect(mutation.set).toHaveBeenCalled();
    const updateValues = mutation.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateValues).toEqual(
      expect.objectContaining({
        displayName: '王女士更新',
        updatedAt: expect.any(Date),
      }),
    );
    expect(updateValues).not.toHaveProperty('createdAt');
    expect(updateValues).not.toHaveProperty('tenantId');
    expect(updateValues).not.toHaveProperty('id');
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

  it('按 tenantId + id 检查客户是否属于当前租户', async () => {
    const query = createSelectDatabase([{ id: 'cust_001' }]);

    const exists = await createTenantBusinessRepository(query.database).customerExistsByTenant({
      tenantId: 'demo-tenant-001',
      id: 'cust_001',
    });

    expect(exists).toBe(true);
    expect(query.from).toHaveBeenCalledWith(customers);
    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: customers.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: customers.id, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
  });

  it('按 tenantId + id 读取单客户详情摘要，查不到时返回 null', async () => {
    const foundQuery = createSelectDatabase([customerRow]);

    const record = await createTenantBusinessRepository(foundQuery.database).getCustomerByTenant({
      tenantId: 'demo-tenant-001',
      id: 'cust_001',
    });

    expect(foundQuery.from).toHaveBeenCalledWith(customers);
    expect(foundQuery.where).toHaveBeenCalledWith({
      conditions: [
        { column: customers.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: customers.id, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
    expect(record).toEqual(mapCustomerRowToRecord(customerRow));

    const missingQuery = createSelectDatabase([]);
    await expect(
      createTenantBusinessRepository(missingQuery.database).getCustomerByTenant({
        tenantId: 'demo-tenant-001',
        id: 'missing_customer',
      }),
    ).resolves.toBeNull();
  });

  it('按 tenantId + customerId 读取客户相关预约和随访任务', async () => {
    const appointmentQuery = createSelectDatabase([appointmentRow]);
    const appointmentsResult = await createTenantBusinessRepository(
      appointmentQuery.database,
    ).listAppointmentsByTenantAndCustomer({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
    });

    expect(appointmentQuery.from).toHaveBeenCalledWith(appointments);
    expect(appointmentQuery.where).toHaveBeenCalledWith({
      conditions: [
        { column: appointments.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: appointments.customerId, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
    expect(appointmentsResult).toEqual([mapAppointmentRowToRecord(appointmentRow)]);

    const followUpQuery = createSelectDatabase([followUpTaskRow]);
    const followUpsResult = await createTenantBusinessRepository(
      followUpQuery.database,
    ).listFollowUpTasksByTenantAndCustomer({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
    });

    expect(followUpQuery.from).toHaveBeenCalledWith(followUpTasks);
    expect(followUpQuery.where).toHaveBeenCalledWith({
      conditions: [
        { column: followUpTasks.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: followUpTasks.customerId, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
    expect(followUpsResult).toEqual([mapFollowUpTaskRowToRecord(followUpTaskRow)]);
  });

  it('更新预约方法设置 appointments 状态和备注并返回映射记录', async () => {
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

  it('随访状态流转先按 tenantId + id 查询，查不到时返回未找到结果', async () => {
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

  it('随访状态非法流转返回非法流转结果且不写库', async () => {
    const mutation = createFollowUpTransitionDatabase(followUpTaskRow, null);

    const result = await createTenantBusinessRepository(mutation.database).transitionFollowUpTask({
      tenantId: 'demo-tenant-001',
      id: 'fu_001',
      nextStatus: 'completed',
      actorId: 'consultant-lin',
      occurredAt: '2026-05-30T11:00:00.000Z',
    });

    expect(mutation.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: 'invalid_transition',
      resourceId: 'fu_001',
      from: 'due',
      to: 'completed',
    });
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
        { column: followUpTasks.status, operator: 'eq', value: 'due' },
      ],
      operator: 'and',
    });
    expect(result).toEqual({
      kind: 'updated',
      task: mapFollowUpTaskRowToRecord(updatedRow),
    });
  });

  it('随访状态合法但写入时状态已变化则返回冲突结果', async () => {
    const mutation = createFollowUpTransitionDatabase(followUpTaskRow, null);

    const result = await createTenantBusinessRepository(mutation.database).transitionFollowUpTask({
      tenantId: 'demo-tenant-001',
      id: 'fu_001',
      nextStatus: 'in_progress',
      actorId: 'consultant-lin',
      occurredAt: '2026-05-30T11:00:00.000Z',
    });

    expect(mutation.updateWhere).toHaveBeenCalledWith({
      conditions: [
        { column: followUpTasks.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: followUpTasks.id, operator: 'eq', value: 'fu_001' },
        { column: followUpTasks.status, operator: 'eq', value: 'due' },
      ],
      operator: 'and',
    });
    expect(result).toEqual({
      kind: 'conflict',
      resourceId: 'fu_001',
      reason: 'stale_transition',
    });
  });

  it('把治疗摘要来源随访行映射为安全 DTO', () => {
    const record = mapFollowUpTaskSourceRowToRecord(sourceFollowUpTaskRow);

    expect(record).toEqual({
      ...mapFollowUpTaskRowToRecord(sourceFollowUpTaskRow),
      source: 'treatment_summary',
      sourceTreatmentSummaryId: 'ts_001',
      sourceSuggestionKey: 'ts_001:risk-fast-check:offset-1d',
    });
    expect(JSON.stringify(record)).not.toMatch(
      /phoneNumber|idNumber|medicalRecordNo|treatmentRecord|medicalRecordBody|consultationTranscript|sql|stack|token|secret|database_url/i,
    );
    expect(record).not.toHaveProperty('createdAt');
  });

  it('创建治疗摘要来源随访任务时保存来源字段且只写入白名单字段', async () => {
    const mutation = createSourceFollowUpCreateDatabase({
      sourceRows: [sourceTreatmentSummaryRow],
      existingRows: [],
      insertedRow: sourceFollowUpTaskRow,
    });
    const repository = createTenantBusinessRepository(mutation.database);

    const result = await repository.createFollowUpTaskFromTreatmentSummarySuggestion({
      ...sourceFollowUpCreateInput,
      tenantIdFromClient: 'demo-tenant-999',
      treatmentRecordBody: '不应写入的正文',
      consultationTranscript: '不应写入的咨询内容',
      stack: '不应写入的堆栈',
    } as unknown as Parameters<typeof repository.createFollowUpTaskFromTreatmentSummarySuggestion>[0]);

    expect(mutation.sourceFrom).toHaveBeenCalledWith(treatmentSummaries);
    expect(mutation.sourceWhere).toHaveBeenCalledWith({
      conditions: [
        { column: treatmentSummaries.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: treatmentSummaries.id, operator: 'eq', value: 'ts_001' },
        { column: treatmentSummaries.customerId, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
    expect(mutation.existingFrom).toHaveBeenCalledWith(followUpTasks);
    expect(mutation.existingWhere).toHaveBeenCalledWith({
      conditions: [
        { column: followUpTasks.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: followUpTasks.sourceTreatmentSummaryId, operator: 'eq', value: 'ts_001' },
        {
          column: followUpTasks.sourceSuggestionKey,
          operator: 'eq',
          value: 'ts_001:risk-fast-check:offset-1d',
        },
      ],
      operator: 'and',
    });
    expect(mutation.insert).toHaveBeenCalledWith(followUpTasks);
    expect(mutation.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'fu_from_summary_001',
        tenantId: 'demo-tenant-001',
        customerId: 'cust_001',
        customerDisplayName: '王女士',
        journeyId: 'journey_post_treatment_care',
        stage: '术后护理确认',
        status: 'scheduled',
        dueAt: new Date('2026-05-31T10:00:00.000Z'),
        suggestedAction: '人工确认恢复情况并记录异常',
        riskLevel: 'watch',
        sourceTreatmentSummaryId: 'ts_001',
        sourceSuggestionKey: 'ts_001:risk-fast-check:offset-1d',
      }),
    );
    const insertValues = mutation.values.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertValues).not.toHaveProperty('tenantIdFromClient');
    expect(insertValues).not.toHaveProperty('treatmentRecordBody');
    expect(insertValues).not.toHaveProperty('consultationTranscript');
    expect(insertValues).not.toHaveProperty('stack');
    expect(result).toEqual({
      kind: 'created',
      task: mapFollowUpTaskSourceRowToRecord(sourceFollowUpTaskRow),
    });
  });

  it('同一租户同一治疗摘要同一 suggestionKey 已有未完成未取消任务时返回冲突', async () => {
    const mutation = createSourceFollowUpCreateDatabase({
      sourceRows: [sourceTreatmentSummaryRow],
      existingRows: [sourceFollowUpTaskRow],
      insertedRow: sourceFollowUpTaskRow,
    });

    const result = await createTenantBusinessRepository(
      mutation.database,
    ).createFollowUpTaskFromTreatmentSummarySuggestion(sourceFollowUpCreateInput);

    expect(result).toEqual({
      kind: 'conflict',
      resourceId: 'fu_from_summary_001',
      reason: 'active_source_follow_up_exists',
    });
    expect(mutation.insert).not.toHaveBeenCalled();
  });

  it('不同租户或不同 suggestionKey 不互相阻塞来源随访创建', async () => {
    const otherSuggestionMutation = createSourceFollowUpCreateDatabase({
      sourceRows: [sourceTreatmentSummaryRow],
      existingRows: [
        {
          ...sourceFollowUpTaskRow,
          id: 'fu_other_suggestion',
          sourceSuggestionKey: 'ts_001:early-care-check:offset-3d',
        },
      ],
      insertedRow: sourceFollowUpTaskRow,
    });
    const otherTenantMutation = createSourceFollowUpCreateDatabase({
      sourceRows: [
        {
          ...sourceTreatmentSummaryRow,
          id: 'ts_other_tenant',
          tenantId: 'demo-tenant-002',
          customerId: 'cust_other',
        },
      ],
      existingRows: [],
      insertedRow: {
        ...sourceFollowUpTaskRow,
        id: 'fu_other_tenant_source',
        tenantId: 'demo-tenant-002',
        customerId: 'cust_other',
        sourceTreatmentSummaryId: 'ts_other_tenant',
      },
    });

    await expect(
      createTenantBusinessRepository(
        otherSuggestionMutation.database,
      ).createFollowUpTaskFromTreatmentSummarySuggestion(sourceFollowUpCreateInput),
    ).resolves.toEqual({
      kind: 'created',
      task: mapFollowUpTaskSourceRowToRecord(sourceFollowUpTaskRow),
    });
    await expect(
      createTenantBusinessRepository(
        otherTenantMutation.database,
      ).createFollowUpTaskFromTreatmentSummarySuggestion({
        ...sourceFollowUpCreateInput,
        id: 'fu_other_tenant_source',
        tenantId: 'demo-tenant-002',
        customerId: 'cust_other',
        sourceTreatmentSummaryId: 'ts_other_tenant',
      }),
    ).resolves.toEqual({
      kind: 'created',
      task: mapFollowUpTaskSourceRowToRecord({
        ...sourceFollowUpTaskRow,
        id: 'fu_other_tenant_source',
        tenantId: 'demo-tenant-002',
        customerId: 'cust_other',
        sourceTreatmentSummaryId: 'ts_other_tenant',
      }),
    });
    expect(otherTenantMutation.existingWhere).toHaveBeenCalledWith({
      conditions: [
        { column: followUpTasks.tenantId, operator: 'eq', value: 'demo-tenant-002' },
        { column: followUpTasks.sourceTreatmentSummaryId, operator: 'eq', value: 'ts_other_tenant' },
        {
          column: followUpTasks.sourceSuggestionKey,
          operator: 'eq',
          value: 'ts_001:risk-fast-check:offset-1d',
        },
      ],
      operator: 'and',
    });
  });

  it('同一来源已有 completed 或 cancelled 任务时允许重新创建', async () => {
    const mutation = createSourceFollowUpCreateDatabase({
      sourceRows: [sourceTreatmentSummaryRow],
      existingRows: [
        { ...sourceFollowUpTaskRow, id: 'fu_completed', status: 'completed' },
        { ...sourceFollowUpTaskRow, id: 'fu_cancelled', status: 'cancelled' },
      ],
      insertedRow: sourceFollowUpTaskRow,
    });

    await expect(
      createTenantBusinessRepository(mutation.database).createFollowUpTaskFromTreatmentSummarySuggestion(
        sourceFollowUpCreateInput,
      ),
    ).resolves.toEqual({
      kind: 'created',
      task: mapFollowUpTaskSourceRowToRecord(sourceFollowUpTaskRow),
    });
    expect(mutation.insert).toHaveBeenCalledWith(followUpTasks);
  });

  it('治疗摘要不存在、跨租户或不属于当前客户时不创建来源随访任务', async () => {
    const mutation = createSourceFollowUpCreateDatabase({
      sourceRows: [],
      existingRows: [],
      insertedRow: sourceFollowUpTaskRow,
    });

    const result = await createTenantBusinessRepository(
      mutation.database,
    ).createFollowUpTaskFromTreatmentSummarySuggestion({
      ...sourceFollowUpCreateInput,
      sourceTreatmentSummaryId: 'ts_cross_tenant',
    });

    expect(result).toEqual({
      kind: 'invalid_source',
      reason: 'source_treatment_summary_not_found_or_cross_tenant',
    });
    expect(mutation.existingFrom).not.toHaveBeenCalled();
    expect(mutation.insert).not.toHaveBeenCalled();
  });

  it('来源随访 repository 地基不调用外部系统、不写审计且不接入 quota enforcement', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/modules/institution/server/tenant-business-repository.ts'),
      'utf8',
    );

    expect(source).toContain('follow-up quota');
    expect(source).not.toMatch(
      /tenant-quota-enforcement|enforceTenantQuota|openai|rag|\bagent\b|wecom|wechat|sms|phone_call|external_system|auditEvents|createAuditEvent|fetch\(|axios/i,
    );
  });
});
