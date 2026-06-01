import { describe, expect, it, vi } from 'vitest';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, treatmentSummaries } from '@/server/db/schema';
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
