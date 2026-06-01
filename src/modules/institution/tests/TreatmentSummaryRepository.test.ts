import { describe, expect, it, vi } from 'vitest';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, treatmentSummaries } from '@/server/db/schema';
import {
  decodeTreatmentSummaryCursor,
  encodeTreatmentSummaryCursor,
} from '@/modules/institution/server/treatment-summary-query-parser';
import {
  createTreatmentSummaryRepository,
  mapTreatmentSummaryRowToRecord,
} from '@/modules/institution/server/treatment-summary-repository';

type TreatmentSummaryRow = typeof treatmentSummaries.$inferSelect;

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
const gteMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'gte',
    value,
  })),
);
const lteMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'lte',
    value,
  })),
);
const ltMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'lt',
    value,
  })),
);
const gtMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'gt',
    value,
  })),
);
const orMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({
    conditions,
    operator: 'or',
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
    gt: gtMock,
    gte: gteMock,
    lt: ltMock,
    lte: lteMock,
    or: orMock,
  };
});

function createTreatmentSummarySelectDatabase(rows: unknown[] = []) {
  const orderBy = vi.fn(async (...columns: unknown[]) => {
    void columns;
    return rows;
  });
  const where = vi.fn((condition: unknown) => {
    void condition;
    return { orderBy };
  });
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    orderBy,
    select,
    where,
  };
}

function createTreatmentSummaryListDatabase(rows: unknown[] = []) {
  const limit = vi.fn(async (value: number) => {
    void value;
    return rows;
  });
  const orderBy = vi.fn((...columns: unknown[]) => {
    void columns;
    return { limit };
  });
  const where = vi.fn((condition: unknown) => {
    void condition;
    return { orderBy };
  });
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    limit,
    orderBy,
    select,
    where,
  };
}

function createTreatmentSummaryInsertDatabase(row: TreatmentSummaryRow) {
  const returning = vi.fn(async () => [row]);
  const values = vi.fn((value: unknown) => {
    void value;
    return { returning };
  });
  const insert = vi.fn((table: unknown) => {
    void table;
    return { values };
  });

  return {
    database: { insert } as unknown as TenantDatabase,
    insert,
    returning,
    values,
  };
}

function createAppointmentOwnershipDatabase(rows: Array<{ customerId: string }> = []) {
  const where = vi.fn(async (condition: unknown) => {
    void condition;
    return rows;
  });
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    select,
    where,
  };
}

const treatmentSummaryRow = {
  id: 'trt_001',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_qin_review',
  appointmentId: 'appt_qin_arrived',
  treatmentDate: new Date('2026-05-30T03:45:00.000Z'),
  treatmentProject: '玻尿酸复诊',
  treatmentCategory: 'injection_review',
  treatmentStage: 'D7 复诊',
  recoveryStage: 'D7',
  riskLevel: 'watch',
  ownerUserId: 'doctor-lin',
  summary: '结构化摘要：恢复进展稳定，安排补水护理观察。',
  nextCareAction: 'D14 人工回访恢复阶段。',
  tags: ['结构化摘要', '复诊'],
  createdAt: new Date('2026-05-30T03:45:00.000Z'),
  updatedAt: new Date('2026-05-30T03:45:00.000Z'),
} satisfies typeof treatmentSummaries.$inferSelect;

const secondTreatmentSummaryRow = {
  ...treatmentSummaryRow,
  id: 'trt_002',
  customerId: 'cust_wang_repurchase',
  appointmentId: null,
  treatmentDate: new Date('2026-05-29T08:30:00.000Z'),
  treatmentProject: '热玛吉修复组合',
  treatmentCategory: 'skin_repair',
  treatmentStage: 'D28 复购评估',
  recoveryStage: 'D28',
  riskLevel: 'urgent',
  ownerUserId: 'consultant-lin',
  summary: '结构化摘要：恢复窗口进入复购建议期，适合人工承接。',
  nextCareAction: '安排顾问跟进修复组合意向。',
  tags: ['结构化摘要', '复购窗口'],
  createdAt: new Date('2026-05-29T08:30:00.000Z'),
  updatedAt: new Date('2026-05-29T08:30:00.000Z'),
} satisfies typeof treatmentSummaries.$inferSelect;

const thirdTreatmentSummaryRow = {
  ...treatmentSummaryRow,
  id: 'trt_003',
  treatmentDate: new Date('2026-05-28T08:30:00.000Z'),
  riskLevel: 'normal',
} satisfies typeof treatmentSummaries.$inferSelect;

describe('治疗结构化摘要仓储', () => {
  it('把治疗摘要数据库行映射为领域记录且只保留白名单字段', () => {
    const record = mapTreatmentSummaryRowToRecord(treatmentSummaryRow);

    expect(record).toEqual({
      id: 'trt_001',
      tenantId: 'demo-tenant-001',
      customerId: 'cust_qin_review',
      appointmentId: 'appt_qin_arrived',
      treatmentDate: '2026-05-30T03:45:00.000Z',
      treatmentProject: '玻尿酸复诊',
      treatmentCategory: 'injection_review',
      treatmentStage: 'D7 复诊',
      recoveryStage: 'D7',
      riskLevel: 'watch',
      ownerUserId: 'doctor-lin',
      summary: '结构化摘要：恢复进展稳定，安排补水护理观察。',
      nextCareAction: 'D14 人工回访恢复阶段。',
      tags: ['结构化摘要', '复诊'],
      createdAt: '2026-05-30T03:45:00.000Z',
      updatedAt: '2026-05-30T03:45:00.000Z',
    });
    expect(JSON.stringify(record)).not.toMatch(
      /phoneNumber|idNumber|medicalRecordNo|treatmentRecord|medicalRecordBody|diagnosisText|clinicalNote|consultationTranscript|requestBody|rawPayload|DATABASE_URL|secret|token/i,
    );
  });

  it('按 tenantId + customerId 查询并按治疗时间倒序返回', async () => {
    const query = createTreatmentSummarySelectDatabase([treatmentSummaryRow]);

    const records = await createTreatmentSummaryRepository(
      query.database,
    ).listTreatmentSummariesByTenantAndCustomer({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_qin_review',
    });

    expect(query.from).toHaveBeenCalledWith(treatmentSummaries);
    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: treatmentSummaries.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: treatmentSummaries.customerId, operator: 'eq', value: 'cust_qin_review' },
      ],
      operator: 'and',
    });
    expect(query.orderBy).toHaveBeenCalledWith(
      { column: treatmentSummaries.treatmentDate, direction: 'desc' },
      { column: treatmentSummaries.id, direction: 'asc' },
    );
    expect(records).toEqual([mapTreatmentSummaryRowToRecord(treatmentSummaryRow)]);
  });

  it('即使数据库 mock 返回混合数据也不会跨租户或跨客户返回', async () => {
    const query = createTreatmentSummarySelectDatabase([
      treatmentSummaryRow,
      {
        ...treatmentSummaryRow,
        id: 'trt_other_tenant',
        tenantId: 'demo-tenant-002',
      },
      {
        ...treatmentSummaryRow,
        id: 'trt_other_customer',
        customerId: 'cust_other',
      },
    ]);

    const records = await createTreatmentSummaryRepository(
      query.database,
    ).listTreatmentSummariesByTenantAndCustomer({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_qin_review',
    });

    expect(records).toEqual([mapTreatmentSummaryRowToRecord(treatmentSummaryRow)]);
  });

  it('按 tenantId、白名单筛选、治疗时间倒序和 limit + 1 查询治疗摘要列表', async () => {
    const query = createTreatmentSummaryListDatabase([
      treatmentSummaryRow,
      secondTreatmentSummaryRow,
      thirdTreatmentSummaryRow,
    ]);

    const result = await createTreatmentSummaryRepository(
      query.database,
    ).listTreatmentSummariesByTenant({
      tenantId: 'demo-tenant-001',
      query: {
        filters: {
          customerId: 'cust_qin_review',
          treatmentProject: '玻尿酸复诊',
          riskLevel: 'watch',
          from: '2026-05-29T00:00:00.000Z',
          to: '2026-05-31T00:00:00.000Z',
        },
        limit: 2,
      },
    });

    expect(query.from).toHaveBeenCalledWith(treatmentSummaries);
    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: treatmentSummaries.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: treatmentSummaries.customerId, operator: 'eq', value: 'cust_qin_review' },
        { column: treatmentSummaries.treatmentProject, operator: 'eq', value: '玻尿酸复诊' },
        { column: treatmentSummaries.riskLevel, operator: 'eq', value: 'watch' },
        { column: treatmentSummaries.treatmentDate, operator: 'gte', value: new Date('2026-05-29T00:00:00.000Z') },
        { column: treatmentSummaries.treatmentDate, operator: 'lte', value: new Date('2026-05-31T00:00:00.000Z') },
      ],
      operator: 'and',
    });
    expect(query.orderBy).toHaveBeenCalledWith(
      { column: treatmentSummaries.treatmentDate, direction: 'desc' },
      { column: treatmentSummaries.id, direction: 'asc' },
    );
    expect(query.limit).toHaveBeenCalledWith(3);
    expect(result.records).toEqual([
      {
        id: 'trt_001',
        customerId: 'cust_qin_review',
        appointmentId: 'appt_qin_arrived',
        treatmentDate: '2026-05-30T03:45:00.000Z',
        treatmentProject: '玻尿酸复诊',
        treatmentCategory: 'injection_review',
        treatmentStage: 'D7 复诊',
        recoveryStage: 'D7',
        riskLevel: 'watch',
        ownerUserId: 'doctor-lin',
        summary: '结构化摘要：恢复进展稳定，安排补水护理观察。',
        nextCareAction: 'D14 人工回访恢复阶段。',
        tags: ['结构化摘要', '复诊'],
        createdAt: '2026-05-30T03:45:00.000Z',
        updatedAt: '2026-05-30T03:45:00.000Z',
      },
    ]);
    expect(result.pageInfo).toEqual({
      hasMore: false,
      limit: 2,
      nextCursor: null,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /tenantId|phoneNumber|idNumber|medicalRecordNo|完整治疗记录正文|完整病历正文|诊疗原文|咨询对话全文|sql|stack|token|secret|DATABASE_URL|postgres:\/\//i,
    );
  });

  it('用稳定 cursor 翻页，并返回下一页 cursor', async () => {
    const cursor = encodeTreatmentSummaryCursor({
      id: 'trt_001',
      treatmentDate: '2026-05-30T03:45:00.000Z',
    });
    const decoded = decodeTreatmentSummaryCursor(cursor);
    expect(decoded.ok).toBe(true);
    const query = createTreatmentSummaryListDatabase([
      secondTreatmentSummaryRow,
      thirdTreatmentSummaryRow,
      {
        ...treatmentSummaryRow,
        id: 'trt_004',
        treatmentDate: new Date('2026-05-27T08:30:00.000Z'),
      },
    ]);

    const result = await createTreatmentSummaryRepository(
      query.database,
    ).listTreatmentSummariesByTenant({
      tenantId: 'demo-tenant-001',
      query: {
        filters: {},
        limit: 2,
        cursor: decoded.ok ? decoded.cursor : undefined,
      },
    });

    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: treatmentSummaries.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        {
          conditions: [
            { column: treatmentSummaries.treatmentDate, operator: 'lt', value: new Date('2026-05-30T03:45:00.000Z') },
            {
              conditions: [
                { column: treatmentSummaries.treatmentDate, operator: 'eq', value: new Date('2026-05-30T03:45:00.000Z') },
                { column: treatmentSummaries.id, operator: 'gt', value: 'trt_001' },
              ],
              operator: 'and',
            },
          ],
          operator: 'or',
        },
      ],
      operator: 'and',
    });
    expect(result.records.map((record) => record.id)).toEqual(['trt_002', 'trt_003']);
    expect(result.pageInfo.hasMore).toBe(true);
    expect(result.pageInfo.limit).toBe(2);
    expect(decodeTreatmentSummaryCursor(result.pageInfo.nextCursor ?? '')).toEqual({
      ok: true,
      cursor: {
        id: 'trt_003',
        treatmentDate: '2026-05-28T08:30:00.000Z',
      },
    });
  });

  it('数据库无数据时返回稳定空数组，并且 mock 混入跨租户数据也不会返回', async () => {
    const emptyQuery = createTreatmentSummaryListDatabase([]);

    await expect(
      createTreatmentSummaryRepository(emptyQuery.database).listTreatmentSummariesByTenant({
        tenantId: 'demo-tenant-001',
        query: { filters: {}, limit: 50 },
      }),
    ).resolves.toEqual({
      records: [],
      pageInfo: { hasMore: false, limit: 50, nextCursor: null },
    });

    const mixedQuery = createTreatmentSummaryListDatabase([
      treatmentSummaryRow,
      {
        ...treatmentSummaryRow,
        id: 'trt_other_tenant',
        tenantId: 'demo-tenant-002',
      },
    ]);

    await expect(
      createTreatmentSummaryRepository(mixedQuery.database).listTreatmentSummariesByTenant({
        tenantId: 'demo-tenant-001',
        query: { filters: {}, limit: 50 },
      }),
    ).resolves.toEqual({
      records: [expect.objectContaining({ id: 'trt_001' })],
      pageInfo: { hasMore: false, limit: 50, nextCursor: null },
    });
  });

  it('创建治疗摘要时只写入服务端确认的 tenantId、customerId 和白名单字段', async () => {
    const insertedRow = {
      ...treatmentSummaryRow,
      id: 'trt_created_001',
      appointmentId: null,
      tags: ['结构化摘要', '术后关怀'],
    };
    const query = createTreatmentSummaryInsertDatabase(insertedRow);

    const record = await createTreatmentSummaryRepository(query.database).createTreatmentSummary({
      id: 'trt_created_001',
      tenantId: 'demo-tenant-001',
      customerId: 'cust_qin_review',
      appointmentId: null,
      treatmentDate: new Date('2026-05-31T01:30:00.000Z'),
      treatmentProject: '水光补水复诊',
      treatmentCategory: 'injection_review',
      treatmentStage: 'D7 复诊',
      recoveryStage: 'D7',
      riskLevel: 'watch',
      ownerUserId: 'doctor-lin',
      summary: '恢复稳定，局部泛红已缓解。',
      nextCareAction: 'D14 人工复诊提醒。',
      tags: ['结构化摘要', '术后关怀'],
      phoneNumber: '13800000000',
      fullTreatmentRecord: '完整治疗记录正文',
      DATABASE_URL: 'postgres://example',
    } as Parameters<
      ReturnType<typeof createTreatmentSummaryRepository>['createTreatmentSummary']
    >[0]);

    expect(query.insert).toHaveBeenCalledWith(treatmentSummaries);
    expect(query.values).toHaveBeenCalledWith({
      id: 'trt_created_001',
      tenantId: 'demo-tenant-001',
      customerId: 'cust_qin_review',
      appointmentId: null,
      treatmentDate: new Date('2026-05-31T01:30:00.000Z'),
      treatmentProject: '水光补水复诊',
      treatmentCategory: 'injection_review',
      treatmentStage: 'D7 复诊',
      recoveryStage: 'D7',
      riskLevel: 'watch',
      ownerUserId: 'doctor-lin',
      summary: '恢复稳定，局部泛红已缓解。',
      nextCareAction: 'D14 人工复诊提醒。',
      tags: ['结构化摘要', '术后关怀'],
    });
    expect(JSON.stringify(query.values.mock.calls[0]?.[0])).not.toMatch(
      /phoneNumber|fullTreatmentRecord|DATABASE_URL|tenantIdFromPayload|secret|token/i,
    );
    expect(record).toEqual(mapTreatmentSummaryRowToRecord(insertedRow));
    expect(JSON.stringify(record)).not.toMatch(/phoneNumber|fullTreatmentRecord|DATABASE_URL|secret|token/i);
  });

  it('提供 appointmentId 归属校验 helper，区分同租户同客户、客户不匹配和不可见预约', async () => {
    const matchedQuery = createAppointmentOwnershipDatabase([{ customerId: 'cust_qin_review' }]);
    const mismatchQuery = createAppointmentOwnershipDatabase([{ customerId: 'cust_other' }]);
    const notFoundQuery = createAppointmentOwnershipDatabase([]);

    await expect(
      createTreatmentSummaryRepository(
        matchedQuery.database,
      ).checkAppointmentBelongsToTenantAndCustomer({
        tenantId: 'demo-tenant-001',
        customerId: 'cust_qin_review',
        appointmentId: 'appt_qin_arrived',
      }),
    ).resolves.toEqual({ kind: 'matched' });

    expect(matchedQuery.select).toHaveBeenCalledWith({ customerId: appointments.customerId });
    expect(matchedQuery.from).toHaveBeenCalledWith(appointments);
    expect(matchedQuery.where).toHaveBeenCalledWith({
      conditions: [
        { column: appointments.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: appointments.id, operator: 'eq', value: 'appt_qin_arrived' },
      ],
      operator: 'and',
    });

    await expect(
      createTreatmentSummaryRepository(
        mismatchQuery.database,
      ).checkAppointmentBelongsToTenantAndCustomer({
        tenantId: 'demo-tenant-001',
        customerId: 'cust_qin_review',
        appointmentId: 'appt_other_customer',
      }),
    ).resolves.toEqual({ kind: 'customer_mismatch' });

    await expect(
      createTreatmentSummaryRepository(
        notFoundQuery.database,
      ).checkAppointmentBelongsToTenantAndCustomer({
        tenantId: 'demo-tenant-001',
        customerId: 'cust_qin_review',
        appointmentId: 'appt_other_tenant',
      }),
    ).resolves.toEqual({ kind: 'not_found_or_not_owned' });
  });
});
