import { describe, expect, it, vi } from 'vitest';
import type { TenantDatabase } from '@/server/db/client';
import { treatmentSummaries } from '@/server/db/schema';
import {
  createTreatmentSummaryRepository,
  mapTreatmentSummaryRowToRecord,
} from '@/modules/institution/server/treatment-summary-repository';

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
});
