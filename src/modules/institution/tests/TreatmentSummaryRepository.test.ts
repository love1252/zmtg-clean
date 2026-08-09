import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { TenantDatabase } from '@/server/db/client';
import { appointments, customers, treatmentSummaries } from '@/server/db/schema';
import {
  createTreatmentSummaryRepository,
  mapTreatmentSummaryRowToRecord,
} from '@/modules/institution/server/treatment-summary-repository';

const row = {
  id: 'trt_001',
  tenantId: 'demo-tenant-001',
  institutionId: 'inst-001',
  customerId: 'cust-a',
  appointmentId: 'appt-a',
  treatmentDate: new Date('2026-05-30T03:45:00.000Z'),
  treatmentProject: '玻尿酸复诊',
  treatmentCategory: 'injection_review',
  treatmentStage: 'D7 复诊',
  recoveryStage: 'D7',
  riskLevel: 'watch' as const,
  ownerUserId: 'doctor-lin',
  summary: '结构化摘要：恢复进展稳定。',
  nextCareAction: 'D14 人工回访。',
  tags: ['结构化摘要', '复诊'],
  voidedAt: null,
  voidedBy: null,
  voidReasonCode: null,
  voidReason: null,
  createdAt: new Date('2026-05-30T03:45:00.000Z'),
  updatedAt: new Date('2026-05-30T03:45:00.000Z'),
} satisfies typeof treatmentSummaries.$inferSelect;

describe('TreatmentSummaryRepository legacy compatibility', () => {
  it('保留低敏 row mapping', () => {
    expect(mapTreatmentSummaryRowToRecord(row)).toMatchObject({
      id: 'trt_001',
      tenantId: 'demo-tenant-001',
      customerId: 'cust-a',
      appointmentId: 'appt-a',
      riskLevel: 'watch',
      status: 'active',
    });
  });

  it('保留 tenant + customer read/list compatibility', async () => {
    const orderBy = vi.fn(async () => [row]);
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createTreatmentSummaryRepository({ select } as unknown as TenantDatabase);

    const result = await repository.listTreatmentSummariesByTenantAndCustomer({
      tenantId: 'demo-tenant-001',
      customerId: 'cust-a',
    });

    expect(from).toHaveBeenCalledWith(treatmentSummaries);
    expect(result[0]?.id).toBe('trt_001');
  });

  it('保留 institution join read compatibility', async () => {
    const orderBy = vi.fn(async () => []);
    const where = vi.fn(() => ({ orderBy }));
    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    const select = vi.fn(() => ({ from }));
    const repository = createTreatmentSummaryRepository({ select } as unknown as TenantDatabase);

    await repository.listTreatmentSummariesByTenantInstitutionAndCustomer({
      tenantId: 'demo-tenant-001',
      institutionId: 'inst-001',
      customerId: 'cust-a',
    });

    expect(innerJoin).toHaveBeenCalledWith(customers, expect.any(Object));
  });

  it('保留 getTreatmentSummaryByTenant read compatibility', async () => {
    const where = vi.fn(async () => [row]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createTreatmentSummaryRepository({ select } as unknown as TenantDatabase);

    await expect(
      repository.getTreatmentSummaryByTenant({
        tenantId: 'demo-tenant-001',
        id: 'trt_001',
      }),
    ).resolves.toMatchObject({ id: 'trt_001' });
  });

  it('保留 appointment ownership read helper', async () => {
    const where = vi.fn(async () => [{ customerId: 'cust-a' }]);
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    const repository = createTreatmentSummaryRepository({ select } as unknown as TenantDatabase);

    await expect(
      repository.checkAppointmentBelongsToTenantAndCustomer({
        tenantId: 'demo-tenant-001',
        customerId: 'cust-a',
        appointmentId: 'appt-a',
      }),
    ).resolves.toEqual({ kind: 'matched' });

    expect(from).toHaveBeenCalledWith(appointments);
  });

  it('legacy create/update/void Writer 全部 fail-closed', async () => {
    const insert = vi.fn();
    const update = vi.fn();
    const repository = createTreatmentSummaryRepository({
      insert,
      update,
    } as unknown as TenantDatabase);

    await expect(repository.createTreatmentSummary({} as never))
      .rejects.toThrow('legacy_treatment_summary_writer_disabled');
    await expect(repository.updateTreatmentSummaryByTenant({} as never))
      .rejects.toThrow('legacy_treatment_summary_writer_disabled');
    await expect(repository.voidTreatmentSummaryByTenant({} as never))
      .rejects.toThrow('legacy_treatment_summary_writer_disabled');

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('legacy source 不再直写 treatmentSummaries', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/institution/server/treatment-summary-repository.ts'),
      'utf8',
    );
    expect(source).not.toContain('.insert(treatmentSummaries)');
    expect(source).not.toContain('.update(treatmentSummaries)');
    expect(source).toContain('legacy_treatment_summary_writer_disabled');
  });
});
