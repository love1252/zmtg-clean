import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import {
  appointments,
  customers,
  followUpCustomerTimelineEvents,
  followUpMessageDrafts,
  followUpPathEnrollments,
  followUpTasks,
} from '@/server/db/schema';
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
const ascMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    direction: 'asc',
  })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: andMock,
    asc: ascMock,
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

const customerRow = {
  id: 'cust_001',
  tenantId: 'demo-tenant-001',
  institutionId: 'inst-001',
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
  gender: 'female',
  birthDate: '1990-01',
  referralSource: '朋友转介绍',
  notes: '仅测试低敏备注',
  createdAt: new Date('2026-05-30T00:00:00.000Z'),
  updatedAt: new Date('2026-05-30T00:00:00.000Z'),
} satisfies typeof customers.$inferSelect;

const appointmentRow = {
  id: 'appt_001',
  tenantId: 'demo-tenant-001',
  institutionId: 'inst-001',
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
  institutionId: 'inst-001',
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
      institutionId: 'inst-001',
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
      gender: 'female',
      birthDate: '1990-01',
      referralSource: '朋友转介绍',
      notes: '仅测试低敏备注',
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

  it('客户 timeline 的预约查询通过 customers join 绑定 tenant + institution + customer', async () => {
    const where = vi.fn(async () => []);
    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn(() => ({ from }));
    const repository = createTenantBusinessRepository({ select } as unknown as TenantDatabase);

    await repository.listAppointmentsByTenantInstitutionAndCustomer({
      tenantId: 'demo-tenant-001', institutionId: 'inst-001', customerId: 'cust_001',
    });

    expect(innerJoin).toHaveBeenCalledWith(customers, expect.any(Object));
    expect(where).toHaveBeenCalledWith({
      conditions: [
        { column: appointments.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: appointments.customerId, operator: 'eq', value: 'cust_001' },
        { column: customers.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: customers.institutionId, operator: 'eq', value: 'inst-001' },
        { column: customers.id, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
  });

  it('客户 timeline 的随访查询通过 customers join 绑定 tenant + institution + customer', async () => {
    const where = vi.fn(async () => []);
    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn(() => ({ from }));
    const repository = createTenantBusinessRepository({ select } as unknown as TenantDatabase);

    await repository.listFollowUpTasksByTenantInstitutionAndCustomer({
      tenantId: 'demo-tenant-001', institutionId: 'inst-001', customerId: 'cust_001',
    });

    expect(innerJoin).toHaveBeenCalledWith(customers, expect.any(Object));
    expect(where).toHaveBeenCalledWith({
      conditions: [
        { column: followUpTasks.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: followUpTasks.customerId, operator: 'eq', value: 'cust_001' },
        { column: customers.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: customers.institutionId, operator: 'eq', value: 'inst-001' },
        { column: customers.id, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
  });

  it('客户 timeline 事件查询在 SQL 绑定 tenant + institution + customer', async () => {
    const orderBy = vi.fn(async () => []);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createTenantBusinessRepository({ select } as unknown as TenantDatabase);

    await repository.listCustomerFollowUpTimelineEventsByTenantInstitutionAndCustomer({
      tenantId: 'demo-tenant-001', institutionId: 'inst-001', customerId: 'cust_001',
    });

    expect(where).toHaveBeenCalledWith({
      conditions: [
        { column: followUpCustomerTimelineEvents.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: followUpCustomerTimelineEvents.institutionId, operator: 'eq', value: 'inst-001' },
        { column: followUpCustomerTimelineEvents.customerId, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
  });

  it('客户 timeline overview 的 enrollment/task/draft 查询均绑定 tenant + institution + customer', async () => {
    const enrollmentWhere = vi.fn(async () => []);
    const taskWhere = vi.fn(async () => []);
    const draftWhere = vi.fn(async () => []);
    const taskInnerJoin = vi.fn(() => ({ where: taskWhere }));
    let selectCount = 0;
    const select = vi.fn(() => {
      selectCount += 1;
      if (selectCount === 1) {
        return { from: vi.fn(() => ({ where: enrollmentWhere })) };
      }
      if (selectCount === 2) {
        return { from: vi.fn(() => ({ innerJoin: taskInnerJoin })) };
      }
      return { from: vi.fn(() => ({ where: draftWhere })) };
    });
    const repository = createTenantBusinessRepository({ select } as unknown as TenantDatabase);

    await repository.getCustomerFollowUpOverviewByTenantInstitutionAndCustomer({
      tenantId: 'demo-tenant-001', institutionId: 'inst-001', customerId: 'cust_001',
    });

    expect(enrollmentWhere).toHaveBeenCalledWith({
      conditions: [
        { column: followUpPathEnrollments.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: followUpPathEnrollments.institutionId, operator: 'eq', value: 'inst-001' },
        { column: followUpPathEnrollments.customerId, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
    expect(taskInnerJoin).toHaveBeenCalledWith(customers, expect.any(Object));
    expect(taskWhere).toHaveBeenCalledWith({
      conditions: [
        { column: followUpTasks.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: followUpTasks.customerId, operator: 'eq', value: 'cust_001' },
        { column: customers.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: customers.institutionId, operator: 'eq', value: 'inst-001' },
        { column: customers.id, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
    expect(draftWhere).toHaveBeenCalledWith({
      conditions: [
        { column: followUpMessageDrafts.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: followUpMessageDrafts.institutionId, operator: 'eq', value: 'inst-001' },
        { column: followUpMessageDrafts.customerId, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
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

  it('机构范围客户查询同时绑定 tenantId、institutionId 并将 limit 限制为 20', async () => {
    const limit = vi.fn(async () => [customerRow]);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const database = { select } as unknown as TenantDatabase;

    const records = await createTenantBusinessRepository(database).listCustomersByTenantAndInstitution({
      tenantId: 'demo-tenant-001',
      institutionId: 'inst-001',
      limit: 99,
    });

    expect(where).toHaveBeenCalledWith({
      conditions: [
        { column: customers.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: customers.institutionId, operator: 'eq', value: 'inst-001' },
      ],
      operator: 'and',
    });
    expect(orderBy).toHaveBeenCalledWith({ column: customers.id, direction: 'asc' });
    expect(limit).toHaveBeenCalledWith(20);
    expect(records).toEqual([mapCustomerRowToRecord(customerRow)]);
  });

  it('机构范围客户列表将非有限或非正 limit 安全限制为 1', async () => {
    const limit = vi.fn(async () => []);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const database = { select } as unknown as TenantDatabase;
    const repository = createTenantBusinessRepository(database);

    await expect(
      repository.listCustomersByTenantAndInstitution({
        tenantId: 'demo-tenant-001',
        institutionId: 'inst-001',
        limit: Number.NaN,
      }),
    ).resolves.toEqual([]);
    await expect(
      repository.listCustomersByTenantAndInstitution({
        tenantId: 'demo-tenant-001',
        institutionId: 'inst-001',
        limit: Number.POSITIVE_INFINITY,
      }),
    ).resolves.toEqual([]);
    await expect(
      repository.listCustomersByTenantAndInstitution({
        tenantId: 'demo-tenant-001',
        institutionId: 'inst-001',
        limit: 0,
      }),
    ).resolves.toEqual([]);

    expect(limit).toHaveBeenCalledTimes(3);
    expect(limit).toHaveBeenNthCalledWith(1, 1);
    expect(limit).toHaveBeenNthCalledWith(2, 1);
    expect(limit).toHaveBeenNthCalledWith(3, 1);
    expect(orderBy).toHaveBeenCalledTimes(3);
  });

  it('导入专用机构客户列表覆盖 20 条以后记录并保持稳定排序', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      ...customerRow,
      id: `cust_${String(index + 1).padStart(3, '0')}`,
    }));
    const orderBy = vi.fn(async () => rows);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const database = { select } as unknown as TenantDatabase;

    const records = await createTenantBusinessRepository(
      database,
    ).listCustomersByTenantAndInstitutionForImport({
      tenantId: 'demo-tenant-001',
      institutionId: 'inst-001',
    });

    expect(where).toHaveBeenCalledWith({
      conditions: [
        { column: customers.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: customers.institutionId, operator: 'eq', value: 'inst-001' },
      ],
      operator: 'and',
    });
    expect(orderBy).toHaveBeenCalledWith({ column: customers.id, direction: 'asc' });
    expect(records).toHaveLength(25);
    expect(records[20]?.id).toBe('cust_021');
    expect(records[24]?.id).toBe('cust_025');
  });

  it('机构范围单客户查询拒绝同 tenant 下其他机构和 null 机构客户', async () => {
    const query = createSelectDatabase([]);

    const record = await createTenantBusinessRepository(query.database).getCustomerByTenantAndInstitution({
      tenantId: 'demo-tenant-001',
      institutionId: 'inst-001',
      id: 'cust-other-inst',
    });

    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: customers.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: customers.institutionId, operator: 'eq', value: 'inst-001' },
        { column: customers.id, operator: 'eq', value: 'cust-other-inst' },
      ],
      operator: 'and',
    });
    expect(record).toBeNull();
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

  it('legacy customer create/update Writer 均 fail-closed 且不再直接写 customers', async () => {
    const mutation = createMutationDatabase(customerRow);
    const repository = createTenantBusinessRepository(mutation.database);

    await expect(
      repository.createCustomer({
        ...customerRow,
        createdAt: undefined,
        updatedAt: undefined,
      }),
    ).rejects.toThrow('legacy_customer_writer_disabled');

    await expect(
      repository.updateCustomer({
        tenantId: 'demo-tenant-001',
        id: 'cust_001',
        displayName: '不应写入',
      }),
    ).rejects.toThrow('legacy_customer_writer_disabled');

    expect(mutation.insert).not.toHaveBeenCalled();
    expect(mutation.update).not.toHaveBeenCalled();
    expect(mutation.values).not.toHaveBeenCalled();
    expect(mutation.set).not.toHaveBeenCalled();
  });

  it('legacy appointment create/update Writer 均 fail-closed 且不再直接写 appointments', async () => {
    const mutation = createMutationDatabase(appointmentRow);
    const repository = createTenantBusinessRepository(mutation.database);

    await expect(
      repository.createAppointment({
        ...appointmentRow,
        createdAt: undefined,
        updatedAt: undefined,
      }),
    ).rejects.toThrow('legacy_appointment_writer_disabled');

    await expect(
      repository.updateAppointment({
        tenantId: 'demo-tenant-001',
        id: 'appt_001',
        status: 'confirmed',
        note: '不应写入',
      }),
    ).rejects.toThrow('legacy_appointment_writer_disabled');

    expect(mutation.insert).not.toHaveBeenCalled();
    expect(mutation.update).not.toHaveBeenCalled();
    expect(mutation.values).not.toHaveBeenCalled();
    expect(mutation.set).not.toHaveBeenCalled();
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

  it('来源随访 repository 地基不调用外部系统、不写审计且不接入 quota enforcement', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/modules/institution/server/tenant-business-repository.ts'),
      'utf8',
    );

    expect(source).toContain('follow-up quota');
    expect(source).not.toMatch(
      /tenant-quota-enforcement|enforceTenantQuota|openai|rag|\bagent\b|wechat|sms|phone_call|external_system|auditEvents|createAuditEvent|fetch\(|axios/i,
    );
  });
  it('returns one minimal scoped customer object fact source row', async () => {
    const projectedRow = {
      customerId: customerRow.id,
      tenantId: customerRow.tenantId,
      institutionId: customerRow.institutionId,
      updatedAt: customerRow.updatedAt,
    };
    const query = createSelectDatabase([projectedRow]);
    const result = await createTenantBusinessRepository(
      query.database,
    ).getCustomerObjectFactSourceByScope({
      customerId: customerRow.id,
      tenantId: customerRow.tenantId,
      institutionId: customerRow.institutionId,
    });

    expect(result).toEqual({
      customerId: customerRow.id,
      tenantId: customerRow.tenantId,
      institutionId: customerRow.institutionId,
      updatedAt: customerRow.updatedAt.toISOString(),
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Reflect.ownKeys(result as object)).toEqual([
      'customerId',
      'tenantId',
      'institutionId',
      'updatedAt',
    ]);
    expect(query.select).toHaveBeenCalledWith({
      customerId: customers.id,
      tenantId: customers.tenantId,
      institutionId: customers.institutionId,
      updatedAt: customers.updatedAt,
    });
    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        {
          column: customers.tenantId,
          operator: 'eq',
          value: customerRow.tenantId,
        },
        {
          column: customers.institutionId,
          operator: 'eq',
          value: customerRow.institutionId,
        },
        {
          column: customers.id,
          operator: 'eq',
          value: customerRow.id,
        },
      ],
      operator: 'and',
    });
    expect(JSON.stringify(result)).not.toMatch(
      /displayName|phone|medical|tags|notes/i,
    );
  });

  it('returns null for not-found and defensive cross-scope source rows', async () => {
    const notFound = createSelectDatabase([]);
    const crossScope = createSelectDatabase([
      {
        customerId: customerRow.id,
        tenantId: customerRow.tenantId,
        institutionId: 'institution-other',
        updatedAt: customerRow.updatedAt,
      },
    ]);
    const input = {
      customerId: customerRow.id,
      tenantId: customerRow.tenantId,
      institutionId: customerRow.institutionId,
    };

    await expect(
      createTenantBusinessRepository(
        notFound.database,
      ).getCustomerObjectFactSourceByScope(input),
    ).resolves.toBeNull();
    await expect(
      createTenantBusinessRepository(
        crossScope.database,
      ).getCustomerObjectFactSourceByScope(input),
    ).resolves.toBeNull();
  });

  it('customer fact bridge contains no profile projection or mutation', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/modules/institution/server/tenant-business-repository.ts',
      ),
      'utf8',
    );
    const start = source.indexOf(
      'async getCustomerObjectFactSourceByScope(',
    );
    const end = source.indexOf(
      'async listAppointmentsByTenantAndCustomer(',
      start,
    );
    const block = source.slice(start, end);

    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(block).toContain('customers.updatedAt');
    expect(block).toContain('customers.institutionId');
    expect(block).not.toMatch(
      /displayName|maskedPhone|maskedMedicalRecordNo|tags|notes/i,
    );
    expect(block).not.toMatch(/\.(insert|update|delete)\s*\(/i);
  });

  it('legacy P2B task/path/timeline Writers 全部 fail-closed', async () => {
    const mutation = createMutationDatabase(followUpTaskRow);
    const repository = createTenantBusinessRepository(mutation.database);
    await expect(repository.createFollowUpTaskFromTreatmentSummarySuggestion(sourceFollowUpCreateInput)).rejects.toThrow('legacy_follow_up_writer_disabled');
    await expect(repository.createManualFollowUpTask({id:'manual-task-1',tenantId:'demo-tenant-001',customerId:'cust_001',customerDisplayName:'王女士',stage:'D1',status:'scheduled',dueAt:'2026-05-31T10:00:00.000Z',suggestedAction:'人工随访',riskLevel:'watch'})).rejects.toThrow('legacy_follow_up_writer_disabled');
    await expect(repository.transitionFollowUpTask({tenantId:'demo-tenant-001',id:'fu_001',nextStatus:'in_progress',actorId:'consultant-lin',occurredAt:'2026-05-30T11:00:00.000Z'})).rejects.toThrow('legacy_follow_up_writer_disabled');
    await expect(repository.createFollowUpPathEnrollment({id:'enrollment-1',tenantId:'demo-tenant-001',institutionId:'inst-001',customerId:'cust_001',treatmentSummaryId:'ts_001',sourceType:'treatment_summary',sourceId:'ts_001',templateKey:'hydro_injection_care',templateVersion:'v0.6-static',templateSnapshotJson:{},status:'active',startedAt:new Date('2026-05-30T11:00:00.000Z'),completedAt:null,safeReasonCode:'treatment_summary_path_enrolled',metadataJson:{}})).rejects.toThrow('legacy_follow_up_writer_disabled');
    await expect(repository.createFollowUpPathStages([{id:'stage-1',tenantId:'demo-tenant-001',institutionId:'inst-001',enrollmentId:'enrollment-1',nodeKey:'d1',stageKey:'D1',dueAt:'2026-05-31T10:00:00.000Z',status:'scheduled',followUpTaskId:'fu_001',handlerRole:'consultant',riskLevel:'watch',safeMessage:'人工处理',createdAt:'2026-05-30T11:00:00.000Z',updatedAt:'2026-05-30T11:00:00.000Z'}])).rejects.toThrow('legacy_follow_up_writer_disabled');
    await expect(repository.cancelFollowUpPathEnrollment({tenantId:'demo-tenant-001',institutionId:'inst-001',enrollmentId:'enrollment-1'})).rejects.toThrow('legacy_follow_up_writer_disabled');
    await expect(repository.recordFollowUpCustomerTimelineEvent({id:'event-1',tenantId:'demo-tenant-001',institutionId:'inst-001',customerId:'cust_001',sourceType:'followup_task',sourceId:'fu_001:in_progress',eventType:'followup_task_status_changed',eventTitle:'状态变化',safeSummary:'人工随访状态变化',riskLevel:null,occurredAt:'2026-05-30T11:00:00.000Z',safeActorRole:'consultant',safeReasonCode:'followup_task_status_changed',metadataJson:{}})).rejects.toThrow('legacy_follow_up_writer_disabled');
    expect(repository.runCareFollowUpTransaction).toBeTypeOf('function');
    expect(repository.runAttributedCareFollowUpTransaction).toBeTypeOf('function');
    expect(mutation.insert).not.toHaveBeenCalled(); expect(mutation.update).not.toHaveBeenCalled(); expect(mutation.values).not.toHaveBeenCalled(); expect(mutation.set).not.toHaveBeenCalled();
  });


  it('legacy P2C message draft / controlled reach-out Writers 全部 fail-closed', async () => {
    const mutation = createMutationDatabase(followUpTaskRow);
    const repository = createTenantBusinessRepository(mutation.database);
    const baseDraft = {
      id: 'draft-a', tenantId: 'demo-tenant-001', institutionId: 'inst-001', followUpTaskId: 'fu_001',
      enrollmentId: null, stageId: null, customerId: 'cust_001', templateId: null, channelType: 'manual' as const,
      status: 'draft' as const, draftContent: '低敏草稿', editedContent: null, safePreview: '低敏草稿', approvedBy: null,
      approvedAt: null, rejectedBy: null, rejectedAt: null, markedSentBy: null, markedSentAt: null,
      safeReasonCode: 'fallback_generated' as const, metadataJson: {}, createdAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-08-10T00:00:00.000Z',
    };
    await expect(repository.createFollowUpMessageDraft(baseDraft)).rejects.toThrow('legacy_follow_up_message_draft_writer_disabled');
    await expect(repository.updateFollowUpMessageDraftContent({ tenantId: 'demo-tenant-001', institutionId: 'inst-001', draftId: 'draft-a', editedContent: '低敏', safePreview: '低敏', safeReasonCode: 'draft_content_updated', occurredAt: '2026-08-10T00:05:00.000Z' })).rejects.toThrow('legacy_follow_up_message_draft_writer_disabled');
    await expect(repository.approveFollowUpMessageDraft({ tenantId: 'demo-tenant-001', institutionId: 'inst-001', draftId: 'draft-a', actorId: 'admin-a', occurredAt: '2026-08-10T00:05:00.000Z' })).rejects.toThrow('legacy_follow_up_message_draft_writer_disabled');
    await expect(repository.rejectFollowUpMessageDraft({ tenantId: 'demo-tenant-001', institutionId: 'inst-001', draftId: 'draft-a', actorId: 'admin-a', occurredAt: '2026-08-10T00:05:00.000Z' })).rejects.toThrow('legacy_follow_up_message_draft_writer_disabled');
    await expect(repository.markFollowUpMessageDraftAsSent({ tenantId: 'demo-tenant-001', institutionId: 'inst-001', draftId: 'draft-a', actorId: 'admin-a', occurredAt: '2026-08-10T00:05:00.000Z' })).rejects.toThrow('legacy_follow_up_message_draft_writer_disabled');
    await expect(repository.updateFollowUpMessageDraftControlledReachOut({ tenantId: 'demo-tenant-001', institutionId: 'inst-001', draftId: 'draft-a', expectedUpdatedAt: '2026-08-10T00:00:00.000Z', expectedMetadataJson: {}, metadataJson: { weComControlledReachOut: { status: 'ready_no_send' } }, occurredAt: '2026-08-10T00:05:00.000Z' })).rejects.toThrow('legacy_follow_up_message_draft_writer_disabled');
    expect(mutation.insert).not.toHaveBeenCalled();
    expect(mutation.update).not.toHaveBeenCalled();
  });

});
