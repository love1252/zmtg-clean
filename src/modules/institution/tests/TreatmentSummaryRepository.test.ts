import { describe, expect, it, vi } from 'vitest';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, treatmentSummaries } from '@/server/db/schema';
import { mapTreatmentSummaryRecordToListItem } from '@/modules/institution/domain/treatment-summaries';
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

function createTreatmentSummaryLookupDatabase(rows: unknown[] = []) {
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

function createTreatmentSummaryUpdateDatabase(input: {
  updatedRow?: TreatmentSummaryRow | null;
  summaryRows?: Array<{ customerId: string }>;
  appointmentRows?: Array<{ customerId: string }>;
} = {}) {
  const summaryWhere = vi.fn(async (condition: unknown) => {
    void condition;
    return input.summaryRows ?? [];
  });
  const summaryFrom = vi.fn(() => ({ where: summaryWhere }));
  const appointmentWhere = vi.fn(async (condition: unknown) => {
    void condition;
    return input.appointmentRows ?? [];
  });
  const appointmentFrom = vi.fn(() => ({ where: appointmentWhere }));
  const select = vi
    .fn()
    .mockReturnValueOnce({ from: summaryFrom })
    .mockReturnValueOnce({ from: appointmentFrom });
  const returning = vi.fn(async () => (input.updatedRow ? [input.updatedRow] : []));
  const where = vi.fn((condition: unknown) => {
    void condition;
    return { returning };
  });
  const set = vi.fn((values: Record<string, unknown>) => {
    void values;
    return { where };
  });
  const update = vi.fn((table: unknown) => {
    void table;
    return { set };
  });

  return {
    database: { select, update } as unknown as TenantDatabase,
    appointmentFrom,
    appointmentWhere,
    returning,
    select,
    set,
    summaryFrom,
    summaryWhere,
    update,
    where,
  };
}

function createTreatmentSummaryVoidDatabase(input: {
  lookupRows?: TreatmentSummaryRow[];
  voidedRow?: TreatmentSummaryRow | null;
} = {}) {
  const lookupWhere = vi.fn(async (condition: unknown) => {
    void condition;
    return input.lookupRows ?? [];
  });
  const lookupFrom = vi.fn(() => ({ where: lookupWhere }));
  const select = vi.fn(() => ({ from: lookupFrom }));
  const returning = vi.fn(async () => (input.voidedRow ? [input.voidedRow] : []));
  const where = vi.fn((condition: unknown) => {
    void condition;
    return { returning };
  });
  const set = vi.fn((values: Record<string, unknown>) => {
    void values;
    return { where };
  });
  const update = vi.fn((table: unknown) => {
    void table;
    return { set };
  });
  const deleteMock = vi.fn();

  return {
    database: { delete: deleteMock, select, update } as unknown as TenantDatabase,
    deleteMock,
    lookupFrom,
    lookupWhere,
    returning,
    select,
    set,
    update,
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
  voidedAt: null,
  voidedBy: null,
  voidReasonCode: null,
  voidReason: null,
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
      status: 'active',
      voidedAt: null,
      voidedBy: null,
      voidReasonCode: null,
      voidReason: null,
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

  it('按 tenantId + id 读取单条治疗摘要且不跨租户返回', async () => {
    const query = createTreatmentSummaryLookupDatabase([
      treatmentSummaryRow,
      {
        ...treatmentSummaryRow,
        id: 'trt_other_tenant',
        tenantId: 'demo-tenant-002',
      },
    ]);

    const record = await createTreatmentSummaryRepository(query.database).getTreatmentSummaryByTenant({
      tenantId: 'demo-tenant-001',
      id: 'trt_001',
    });

    expect(query.from).toHaveBeenCalledWith(treatmentSummaries);
    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: treatmentSummaries.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: treatmentSummaries.id, operator: 'eq', value: 'trt_001' },
      ],
      operator: 'and',
    });
    expect(record).toEqual(mapTreatmentSummaryRowToRecord(treatmentSummaryRow));
  });

  it('单条治疗摘要 lookup 查不到时返回 null', async () => {
    const query = createTreatmentSummaryLookupDatabase([]);

    await expect(
      createTreatmentSummaryRepository(query.database).getTreatmentSummaryByTenant({
        tenantId: 'demo-tenant-001',
        id: 'trt_missing',
      }),
    ).resolves.toBeNull();
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
        status: 'active',
        voidedAt: null,
        voidedBy: null,
        voidReasonCode: null,
        voidReason: null,
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

  it('按服务端 tenantId + summaryId 更新治疗摘要，并只写入编辑白名单字段', async () => {
    const updatedRow = {
      ...treatmentSummaryRow,
      riskLevel: 'urgent',
      summary: '复诊后恢复稳定，提醒人工观察。',
      tags: ['复诊', '风险观察'],
      updatedAt: new Date('2026-06-02T02:30:00.000Z'),
    } satisfies typeof treatmentSummaries.$inferSelect;
    const query = createTreatmentSummaryUpdateDatabase({ updatedRow });

    const result = await createTreatmentSummaryRepository(query.database).updateTreatmentSummaryByTenant({
      tenantId: 'demo-tenant-001',
      summaryId: 'trt_001',
      values: {
        riskLevel: 'urgent',
        summary: '复诊后恢复稳定，提醒人工观察。',
        tags: ['复诊', '风险观察'],
        tenantId: 'demo-tenant-002',
        customerId: 'cust_other',
        fullTreatmentRecord: '完整治疗记录正文',
      } as Parameters<
        ReturnType<typeof createTreatmentSummaryRepository>['updateTreatmentSummaryByTenant']
      >[0]['values'],
    });

    expect(query.update).toHaveBeenCalledWith(treatmentSummaries);
    expect(query.set).toHaveBeenCalledWith({
      riskLevel: 'urgent',
      summary: '复诊后恢复稳定，提醒人工观察。',
      tags: ['复诊', '风险观察'],
      updatedAt: expect.any(Date),
    });
    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: treatmentSummaries.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: treatmentSummaries.id, operator: 'eq', value: 'trt_001' },
      ],
      operator: 'and',
    });
    expect(JSON.stringify(query.set.mock.calls[0]?.[0])).not.toMatch(
      /tenantId|customerId|fullTreatmentRecord|medicalRecordText|consultationTranscript|phoneNumber|DATABASE_URL|secret|token/i,
    );
    expect(result).toEqual({
      kind: 'updated',
      record: mapTreatmentSummaryRowToRecord(updatedRow),
    });
    expect(JSON.stringify(result)).not.toMatch(
      /fullTreatmentRecord|medicalRecordText|consultationTranscript|phoneNumber|idNumber|rawMedicalRecordNo|imageUrl|fileUrl|requestBody|DATABASE_URL|secret|token/i,
    );
  });

  it('治疗摘要更新不会跨租户，按 tenantId + summaryId 查不到时返回 not_found_or_not_owned', async () => {
    const query = createTreatmentSummaryUpdateDatabase({ updatedRow: null });

    await expect(
      createTreatmentSummaryRepository(query.database).updateTreatmentSummaryByTenant({
        tenantId: 'demo-tenant-001',
        summaryId: 'trt_other_tenant',
        values: { summary: '只允许当前租户更新。' },
      }),
    ).resolves.toEqual({ kind: 'not_found_or_not_owned' });

    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: treatmentSummaries.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: treatmentSummaries.id, operator: 'eq', value: 'trt_other_tenant' },
      ],
      operator: 'and',
    });
  });

  it('更新 appointmentId 前校验预约同租户且属于摘要客户', async () => {
    const updatedRow = {
      ...treatmentSummaryRow,
      appointmentId: 'appt_qin_arrived',
      nextCareAction: 'D14 人工复诊提醒。',
    } satisfies typeof treatmentSummaries.$inferSelect;
    const query = createTreatmentSummaryUpdateDatabase({
      summaryRows: [{ customerId: 'cust_qin_review' }],
      appointmentRows: [{ customerId: 'cust_qin_review' }],
      updatedRow,
    });

    const result = await createTreatmentSummaryRepository(query.database).updateTreatmentSummaryByTenant({
      tenantId: 'demo-tenant-001',
      summaryId: 'trt_001',
      values: {
        appointmentId: 'appt_qin_arrived',
        nextCareAction: 'D14 人工复诊提醒。',
      },
    });

    expect(query.select).toHaveBeenNthCalledWith(1, {
      customerId: treatmentSummaries.customerId,
    });
    expect(query.summaryFrom).toHaveBeenCalledWith(treatmentSummaries);
    expect(query.summaryWhere).toHaveBeenCalledWith({
      conditions: [
        { column: treatmentSummaries.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: treatmentSummaries.id, operator: 'eq', value: 'trt_001' },
      ],
      operator: 'and',
    });
    expect(query.select).toHaveBeenNthCalledWith(2, { customerId: appointments.customerId });
    expect(query.appointmentFrom).toHaveBeenCalledWith(appointments);
    expect(query.appointmentWhere).toHaveBeenCalledWith({
      conditions: [
        { column: appointments.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: appointments.id, operator: 'eq', value: 'appt_qin_arrived' },
      ],
      operator: 'and',
    });
    expect(result).toEqual({
      kind: 'updated',
      record: mapTreatmentSummaryRowToRecord(updatedRow),
    });
  });

  it('appointmentId 不属于同一客户或当前租户时拒绝更新', async () => {
    const mismatchQuery = createTreatmentSummaryUpdateDatabase({
      summaryRows: [{ customerId: 'cust_qin_review' }],
      appointmentRows: [{ customerId: 'cust_other' }],
      updatedRow: treatmentSummaryRow,
    });
    const notFoundQuery = createTreatmentSummaryUpdateDatabase({
      summaryRows: [{ customerId: 'cust_qin_review' }],
      appointmentRows: [],
      updatedRow: treatmentSummaryRow,
    });
    const missingSummaryQuery = createTreatmentSummaryUpdateDatabase({
      summaryRows: [],
      appointmentRows: [{ customerId: 'cust_qin_review' }],
      updatedRow: treatmentSummaryRow,
    });

    await expect(
      createTreatmentSummaryRepository(mismatchQuery.database).updateTreatmentSummaryByTenant({
        tenantId: 'demo-tenant-001',
        summaryId: 'trt_001',
        values: { appointmentId: 'appt_other_customer' },
      }),
    ).resolves.toEqual({
      kind: 'invalid_reference',
      reason: 'customer_mismatch',
    });
    expect(mismatchQuery.update).not.toHaveBeenCalled();

    await expect(
      createTreatmentSummaryRepository(notFoundQuery.database).updateTreatmentSummaryByTenant({
        tenantId: 'demo-tenant-001',
        summaryId: 'trt_001',
        values: { appointmentId: 'appt_other_tenant' },
      }),
    ).resolves.toEqual({
      kind: 'invalid_reference',
      reason: 'not_found_or_not_owned',
    });
    expect(notFoundQuery.update).not.toHaveBeenCalled();

    await expect(
      createTreatmentSummaryRepository(missingSummaryQuery.database).updateTreatmentSummaryByTenant({
        tenantId: 'demo-tenant-001',
        summaryId: 'trt_missing',
        values: { appointmentId: 'appt_qin_arrived' },
      }),
    ).resolves.toEqual({ kind: 'not_found_or_not_owned' });
    expect(missingSummaryQuery.update).not.toHaveBeenCalled();
  });

  it('按服务端 tenantId + summaryId 作废治疗摘要并只写入作废白名单字段', async () => {
    const voidedRow = {
      ...treatmentSummaryRow,
      voidedAt: new Date('2026-06-02T09:00:00.000Z'),
      voidedBy: 'demo-user-admin',
      voidReasonCode: 'duplicate_summary',
      voidReason: '重复录入，保留较新的治疗摘要',
      updatedAt: new Date('2026-06-02T09:00:00.000Z'),
    } satisfies typeof treatmentSummaries.$inferSelect;
    const query = createTreatmentSummaryVoidDatabase({
      lookupRows: [treatmentSummaryRow],
      voidedRow,
    });

    const result = await createTreatmentSummaryRepository(query.database).voidTreatmentSummaryByTenant({
      tenantId: 'demo-tenant-001',
      summaryId: 'trt_001',
      voidedBy: 'demo-user-admin',
      reasonCode: 'duplicate_summary',
      reasonText: '重复录入，保留较新的治疗摘要',
    });

    expect(query.lookupFrom).toHaveBeenCalledWith(treatmentSummaries);
    expect(query.lookupWhere).toHaveBeenCalledWith({
      conditions: [
        { column: treatmentSummaries.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: treatmentSummaries.id, operator: 'eq', value: 'trt_001' },
      ],
      operator: 'and',
    });
    expect(query.update).toHaveBeenCalledWith(treatmentSummaries);
    expect(query.set).toHaveBeenCalledWith({
      voidedAt: expect.any(Date),
      voidedBy: 'demo-user-admin',
      voidReasonCode: 'duplicate_summary',
      voidReason: '重复录入，保留较新的治疗摘要',
      updatedAt: expect.any(Date),
    });
    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: treatmentSummaries.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: treatmentSummaries.id, operator: 'eq', value: 'trt_001' },
      ],
      operator: 'and',
    });
    expect(query.deleteMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: 'voided',
      record: mapTreatmentSummaryRecordToListItem(mapTreatmentSummaryRowToRecord(voidedRow)),
    });
    expect(JSON.stringify(result)).not.toMatch(
      /tenantId|phoneNumber|idNumber|medicalRecordNo|完整治疗记录正文|完整病历正文|咨询对话全文|requestBody|DATABASE_URL|secret|token/i,
    );
  });

  it('重复作废返回稳定 already_voided 结果且不再次更新', async () => {
    const alreadyVoidedRow = {
      ...treatmentSummaryRow,
      voidedAt: new Date('2026-06-02T09:00:00.000Z'),
      voidedBy: 'demo-user-admin',
      voidReasonCode: 'duplicate_summary',
      voidReason: '重复录入，保留较新的治疗摘要',
    } satisfies typeof treatmentSummaries.$inferSelect;
    const query = createTreatmentSummaryVoidDatabase({
      lookupRows: [alreadyVoidedRow],
    });

    await expect(
      createTreatmentSummaryRepository(query.database).voidTreatmentSummaryByTenant({
        tenantId: 'demo-tenant-001',
        summaryId: 'trt_001',
        voidedBy: 'demo-user-admin',
        reasonCode: 'duplicate_summary',
        reasonText: '重复录入',
      }),
    ).resolves.toEqual({
      kind: 'already_voided',
      record: mapTreatmentSummaryRecordToListItem(
        mapTreatmentSummaryRowToRecord(alreadyVoidedRow),
      ),
    });

    expect(query.update).not.toHaveBeenCalled();
    expect(query.deleteMock).not.toHaveBeenCalled();
  });

  it('治疗摘要作废不会跨租户，查不到时不更新、不硬删除、不触碰来源随访任务', async () => {
    const query = createTreatmentSummaryVoidDatabase({ lookupRows: [] });

    await expect(
      createTreatmentSummaryRepository(query.database).voidTreatmentSummaryByTenant({
        tenantId: 'demo-tenant-001',
        summaryId: 'trt_other_tenant',
        voidedBy: 'demo-user-admin',
        reasonCode: 'wrong_customer_or_appointment',
        reasonText: '误关联其他客户或预约',
      }),
    ).resolves.toEqual({ kind: 'not_found_or_not_owned' });

    expect(query.lookupWhere).toHaveBeenCalledWith({
      conditions: [
        { column: treatmentSummaries.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: treatmentSummaries.id, operator: 'eq', value: 'trt_other_tenant' },
      ],
      operator: 'and',
    });
    expect(query.update).not.toHaveBeenCalled();
    expect(query.deleteMock).not.toHaveBeenCalled();
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
