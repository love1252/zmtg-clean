import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import { createTreatmentSummaryCommandRepository } from '@/modules/care/server/treatment-summary-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, customers, treatmentSummaries } from '@/server/db/schema';

const scope = { tenantId: 'tenant-a', institutionId: 'institution-a' };

type TreatmentSummaryRow = typeof treatmentSummaries.$inferSelect;

const row: TreatmentSummaryRow = {
  id: 'summary-a',
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  customerId: 'customer-a',
  appointmentId: 'appointment-a',
  treatmentDate: new Date('2026-08-09T03:00:00.000Z'),
  treatmentProject: 'project',
  treatmentCategory: 'category',
  treatmentStage: 'D7',
  recoveryStage: 'D7',
  riskLevel: 'watch' as const,
  ownerUserId: 'operator-a',
  summary: 'low-sensitive-summary',
  nextCareAction: 'manual',
  tags: ['D7'],
  voidedAt: null,
  voidedBy: null,
  voidReasonCode: null,
  voidReason: null,
  createdAt: new Date('2026-08-09T03:00:00.000Z'),
  updatedAt: new Date('2026-08-09T03:00:00.000Z'),
};

function dbMock(input: {
  selectRows?: unknown[][];
  insertRow?: TreatmentSummaryRow | null;
  updateRow?: TreatmentSummaryRow | null;
} = {}) {
  let index = 0;
  const selectWhere = vi.fn(async (condition: SQL) => {
    void condition;
    const result = input.selectRows?.[index] ?? [];
    index += 1;
    return result;
  });
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));

  const insertReturning = vi.fn(async () => input.insertRow ? [input.insertRow] : []);
  const values = vi.fn(() => ({ returning: insertReturning }));
  const insert = vi.fn(() => ({ values }));

  const updateReturning = vi.fn(async () => input.updateRow ? [input.updateRow] : []);
  const updateWhere = vi.fn((condition: SQL) => ({ returning: updateReturning, condition }));
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));

  return {
    database: { insert, select, update } as unknown as TenantDatabase,
    insert, selectWhere, update, updateWhere, values,
  };
}

function sql(condition: SQL) {
  return new PgDialect().sqlToQuery(condition).sql;
}

const createInput = {
  ...scope,
  id: 'summary-a',
  customerId: 'customer-a',
  appointmentId: 'appointment-a',
  treatmentDate: new Date('2026-08-09T03:00:00.000Z'),
  treatmentProject: 'project',
  treatmentCategory: 'category',
  treatmentStage: 'D7',
  recoveryStage: 'D7',
  riskLevel: 'watch' as const,
  ownerUserId: 'operator-a',
  summary: 'low-sensitive-summary',
  nextCareAction: 'manual',
  tags: ['D7'],
};

describe('TreatmentSummaryCommandRepository', () => {
  it('customer 不属于 tenant + institution 时 fail-closed', async () => {
    const db = dbMock({ selectRows: [[]] });
    const repository = createTreatmentSummaryCommandRepository(db.database);

    await expect(repository.create(createInput)).resolves.toEqual({
      kind: 'invalid_reference',
      reason: 'customer_not_found_or_not_owned',
    });
    expect(db.insert).not.toHaveBeenCalled();

    const q = sql(db.selectWhere.mock.calls[0]?.[0] as SQL);
    expect(q).toContain('"tenant_id"');
    expect(q).toContain('"institution_id"');
    expect(q).toContain('"id"');
  });

  it('appointment 必须同时属于 tenant + institution + customer', async () => {
    const db = dbMock({ selectRows: [[{ id: 'customer-a' }], []] });
    const repository = createTreatmentSummaryCommandRepository(db.database);

    await expect(repository.create(createInput)).resolves.toEqual({
      kind: 'invalid_reference',
      reason: 'appointment_not_found_or_not_owned',
    });
    expect(db.insert).not.toHaveBeenCalled();

    const q = sql(db.selectWhere.mock.calls[1]?.[0] as SQL);
    expect(q).toContain('"tenant_id"');
    expect(q).toContain('"institution_id"');
    expect(q).toContain('"customer_id"');
    expect(q).toContain('"id"');
  });

  it('create 写入 institutionId', async () => {
    const db = dbMock({
      selectRows: [[{ id: 'customer-a' }], [{ id: 'appointment-a' }]],
      insertRow: row,
    });
    const repository = createTreatmentSummaryCommandRepository(db.database);

    const result = await repository.create(createInput);

    expect(db.insert).toHaveBeenCalledWith(treatmentSummaries);
    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
        customerId: 'customer-a',
        appointmentId: 'appointment-a',
      }),
    );
    expect(result).toMatchObject({
      kind: 'created',
      record: { institutionId: 'institution-a' },
    });
  });

  it('update cross-institution 时不 update', async () => {
    const db = dbMock({ selectRows: [[]] });
    const repository = createTreatmentSummaryCommandRepository(db.database);

    await expect(
      repository.update({
        ...scope,
        summaryId: 'summary-a',
        changes: { treatmentProject: 'project-b' },
      }),
    ).resolves.toEqual({ kind: 'not_found_or_not_owned' });

    expect(db.update).not.toHaveBeenCalled();
    const q = sql(db.selectWhere.mock.calls[0]?.[0] as SQL);
    expect(q).toContain('"tenant_id"');
    expect(q).toContain('"institution_id"');
    expect(q).toContain('"id"');
  });

  it('update appointment mismatch 时不 update', async () => {
    const db = dbMock({
      selectRows: [[row], [{ id: 'customer-a' }], []],
    });
    const repository = createTreatmentSummaryCommandRepository(db.database);

    await expect(
      repository.update({
        ...scope,
        summaryId: 'summary-a',
        changes: { appointmentId: 'appointment-b' },
      }),
    ).resolves.toEqual({
      kind: 'invalid_reference',
      reason: 'appointment_not_found_or_not_owned',
    });

    expect(db.update).not.toHaveBeenCalled();
  });

  it('update WHERE 绑定 tenant + institution + customer + summary', async () => {
    const updated = { ...row, treatmentProject: 'project-b' };
    const db = dbMock({
      selectRows: [[row], [{ id: 'customer-a' }]],
      updateRow: updated,
    });
    const repository = createTreatmentSummaryCommandRepository(db.database);

    await repository.update({
      ...scope,
      summaryId: 'summary-a',
      changes: { treatmentProject: 'project-b' },
    });

    const q = sql(db.updateWhere.mock.calls[0]?.[0] as SQL);
    expect(q).toContain('"tenant_id"');
    expect(q).toContain('"institution_id"');
    expect(q).toContain('"customer_id"');
    expect(q).toContain('"id"');
  });

  it('void 已作废记录保持幂等', async () => {
    const voided = {
      ...row,
      voidedAt: new Date('2026-08-09T04:00:00.000Z'),
      voidedBy: 'operator-a',
      voidReasonCode: 'manual_governance_review' as const,
      voidReason: 'manual review',
    };
    const db = dbMock({ selectRows: [[voided], [{ id: 'customer-a' }]] });
    const repository = createTreatmentSummaryCommandRepository(db.database);

    const result = await repository.void({
      ...scope,
      summaryId: 'summary-a',
      voidedBy: 'operator-a',
      reasonCode: 'manual_governance_review',
      reasonText: 'manual review',
    });

    expect(result).toMatchObject({ kind: 'already_voided', record: { status: 'voided' } });
    expect(db.update).not.toHaveBeenCalled();
  });

  it('void WHERE 绑定 scope + customer + not-yet-voided', async () => {
    const voided = {
      ...row,
      voidedAt: new Date('2026-08-09T04:00:00.000Z'),
      voidedBy: 'operator-a',
      voidReasonCode: 'manual_governance_review' as const,
      voidReason: 'manual review',
    };
    const db = dbMock({
      selectRows: [[row], [{ id: 'customer-a' }]],
      updateRow: voided,
    });
    const repository = createTreatmentSummaryCommandRepository(db.database);

    await repository.void({
      ...scope,
      summaryId: 'summary-a',
      voidedBy: 'operator-a',
      reasonCode: 'manual_governance_review',
      reasonText: 'manual review',
    });

    const q = sql(db.updateWhere.mock.calls[0]?.[0] as SQL);
    expect(q).toContain('"tenant_id"');
    expect(q).toContain('"institution_id"');
    expect(q).toContain('"customer_id"');
    expect(q).toContain('"id"');
    expect(q).toContain('"voided_at" is null');
  });

  it('canonical Care 写普通业务 mutation；legacy direct Writer 已移除', () => {
    const canonical = readFileSync(
      resolve(process.cwd(), 'src/modules/care/server/treatment-summary-command-repository.ts'),
      'utf8',
    );
    const legacy = readFileSync(
      resolve(process.cwd(), 'src/modules/institution/server/treatment-summary-repository.ts'),
      'utf8',
    );

    expect(canonical).toContain('.insert(treatmentSummaries)');
    expect(canonical).toContain('.update(treatmentSummaries)');
    expect(canonical).toContain('treatmentSummaries.institutionId');
    expect(canonical).not.toContain('auditEvents');
    expect(legacy).not.toContain('.insert(treatmentSummaries)');
    expect(legacy).not.toContain('.update(treatmentSummaries)');
    expect(legacy).toContain('legacy_treatment_summary_writer_disabled');
  });

  it('现有 schema 已有 institution attribution，无需 Schema/Migration', () => {
    expect(customers.institutionId).toBeDefined();
    expect(appointments.institutionId).toBeDefined();
    expect(treatmentSummaries.institutionId).toBeDefined();
  });
});
