import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import { createAppointmentCommandRepository } from '@/modules/care/server/appointment-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import { appointments, customers } from '@/server/db/schema';

type AppointmentRow = typeof appointments.$inferSelect;

const scope = { tenantId: 'tenant-a', institutionId: 'institution-a' };

const row: AppointmentRow = {
  id: 'appointment-a',
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  customerId: 'customer-a',
  customerDisplayName: '权威客户',
  project: 'low-sensitive-project',
  scheduledAt: new Date('2026-08-10T03:00:00.000Z'),
  consultantUserId: 'consultant-a',
  status: 'pending_confirmation',
  note: 'manual confirmation',
  createdAt: new Date('2026-08-09T13:00:00.000Z'),
  updatedAt: new Date('2026-08-09T13:00:00.000Z'),
};

const createInput = {
  ...scope,
  id: 'appointment-a',
  customerId: 'customer-a',
  project: 'low-sensitive-project',
  scheduledAt: new Date('2026-08-10T03:00:00.000Z'),
  consultantUserId: 'consultant-a',
  status: 'pending_confirmation' as const,
  note: 'manual confirmation',
};

function dbMock(input: {
  selectRows?: unknown[][];
  insertRow?: AppointmentRow | null;
  updateRow?: AppointmentRow | null;
} = {}) {
  let selectIndex = 0;
  const selectWhere = vi.fn(async (condition: SQL) => {
    void condition;
    const rows = input.selectRows?.[selectIndex] ?? [];
    selectIndex += 1;
    return rows;
  });
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));

  const insertReturning = vi.fn(async () => (input.insertRow ? [input.insertRow] : []));
  const values = vi.fn((insertValues: unknown) => {
    void insertValues;
    return { returning: insertReturning };
  });
  const insert = vi.fn(() => ({ values }));

  const updateReturning = vi.fn(async () => (input.updateRow ? [input.updateRow] : []));
  const updateWhere = vi.fn((condition: SQL) => ({ condition, returning: updateReturning }));
  const set = vi.fn((updateValues: unknown) => {
    void updateValues;
    return { where: updateWhere };
  });
  const update = vi.fn(() => ({ set }));

  return {
    database: { insert, select, update } as unknown as TenantDatabase,
    insert,
    selectWhere,
    set,
    update,
    updateWhere,
    values,
  };
}

function sql(condition: SQL) {
  return new PgDialect().sqlToQuery(condition).sql;
}

describe('AppointmentCommandRepository', () => {
  it('create customer ownership 同时绑定 tenant + institution + customer', async () => {
    const db = dbMock({ selectRows: [[]] });
    const repository = createAppointmentCommandRepository(db.database);

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

  it('create 使用权威 customer displayName 并写入 server-side institutionId', async () => {
    const db = dbMock({
      selectRows: [[{ id: 'customer-a', displayName: '权威客户' }]],
      insertRow: row,
    });
    const repository = createAppointmentCommandRepository(db.database);

    const result = await repository.create(createInput);

    expect(db.insert).toHaveBeenCalledWith(appointments);
    expect(db.values).toHaveBeenCalledWith({
      id: 'appointment-a',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      customerId: 'customer-a',
      customerDisplayName: '权威客户',
      project: 'low-sensitive-project',
      scheduledAt: new Date('2026-08-10T03:00:00.000Z'),
      consultantUserId: 'consultant-a',
      status: 'pending_confirmation',
      note: 'manual confirmation',
    });
    expect(result).toMatchObject({
      kind: 'created',
      record: {
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
        customerId: 'customer-a',
        customerDisplayName: '权威客户',
      },
    });
  });

  it('update 首次读取绑定 tenant + institution + appointment', async () => {
    const db = dbMock({ selectRows: [[]] });
    const repository = createAppointmentCommandRepository(db.database);

    await expect(
      repository.update({
        ...scope,
        appointmentId: 'appointment-a',
        expectedUpdatedAt: row.updatedAt.toISOString(),
        status: 'confirmed',
        note: 'confirmed',
      }),
    ).resolves.toEqual({ kind: 'not_found_or_not_owned' });

    expect(db.update).not.toHaveBeenCalled();
    const q = sql(db.selectWhere.mock.calls[0]?.[0] as SQL);
    expect(q).toContain('"tenant_id"');
    expect(q).toContain('"institution_id"');
    expect(q).toContain('"id"');
  });

  it('update 在 appointment customer 不属于同 institution 时 fail-closed', async () => {
    const db = dbMock({ selectRows: [[row], []] });
    const repository = createAppointmentCommandRepository(db.database);

    await expect(
      repository.update({
        ...scope,
        appointmentId: 'appointment-a',
        expectedUpdatedAt: row.updatedAt.toISOString(),
        status: 'confirmed',
        note: 'confirmed',
      }),
    ).resolves.toEqual({ kind: 'not_found_or_not_owned' });

    expect(db.update).not.toHaveBeenCalled();
    const q = sql(db.selectWhere.mock.calls[1]?.[0] as SQL);
    expect(q).toContain('"tenant_id"');
    expect(q).toContain('"institution_id"');
    expect(q).toContain('"id"');
  });

  it('明显 stale expectedUpdatedAt 在 update 前返回 conflict', async () => {
    const db = dbMock({
      selectRows: [[row], [{ id: 'customer-a', displayName: '权威客户' }]],
    });
    const repository = createAppointmentCommandRepository(db.database);

    await expect(
      repository.update({
        ...scope,
        appointmentId: 'appointment-a',
        expectedUpdatedAt: '2026-08-09T12:59:59.000Z',
        status: 'confirmed',
        note: 'stale',
      }),
    ).resolves.toEqual({
      kind: 'conflict',
      resourceId: 'appointment-a',
      reason: 'stale_update',
    });
    expect(db.update).not.toHaveBeenCalled();
  });

  it('update WHERE 绑定 tenant + institution + customer + appointment + expectedUpdatedAt CAS', async () => {
    const updated: AppointmentRow = {
      ...row,
      status: 'confirmed',
      note: 'confirmed',
      updatedAt: new Date('2026-08-09T13:30:00.000Z'),
    };
    const db = dbMock({
      selectRows: [[row], [{ id: 'customer-a', displayName: '权威客户' }]],
      updateRow: updated,
    });
    const repository = createAppointmentCommandRepository(db.database);

    const result = await repository.update({
      ...scope,
      appointmentId: 'appointment-a',
      expectedUpdatedAt: row.updatedAt.toISOString(),
      status: 'confirmed',
      note: 'confirmed',
    });

    const q = sql(db.updateWhere.mock.calls[0]?.[0] as SQL);
    expect(q).toContain('"tenant_id"');
    expect(q).toContain('"institution_id"');
    expect(q).toContain('"customer_id"');
    expect(q).toContain('"id"');
    expect(q).toContain('"updated_at"');
    expect(result).toMatchObject({
      kind: 'updated',
      record: { status: 'confirmed', updatedAt: '2026-08-09T13:30:00.000Z' },
    });
  });

  it('并发写导致 CAS miss 时返回 stale conflict', async () => {
    const db = dbMock({
      selectRows: [[row], [{ id: 'customer-a', displayName: '权威客户' }]],
      updateRow: null,
    });
    const repository = createAppointmentCommandRepository(db.database);

    await expect(
      repository.update({
        ...scope,
        appointmentId: 'appointment-a',
        expectedUpdatedAt: row.updatedAt.toISOString(),
        status: 'confirmed',
        note: 'concurrent',
      }),
    ).resolves.toEqual({
      kind: 'conflict',
      resourceId: 'appointment-a',
      reason: 'stale_update',
    });
    expect(db.update).toHaveBeenCalledWith(appointments);
  });

  it('Care 是普通业务唯一 appointment Writer；Trial Provisioning 保持独立 exception', () => {
    const canonical = readFileSync(
      resolve(process.cwd(), 'src/modules/care/server/appointment-command-repository.ts'),
      'utf8',
    );
    const legacy = readFileSync(
      resolve(process.cwd(), 'src/modules/institution/server/tenant-business-repository.ts'),
      'utf8',
    );
    const provisioning = readFileSync(
      resolve(process.cwd(), 'src/modules/institution/server/trial-provisioning-service.ts'),
      'utf8',
    );

    expect(canonical).toContain('.insert(appointments)');
    expect(canonical).toContain('.update(appointments)');
    expect(canonical).toContain('appointments.institutionId');
    expect(legacy).not.toContain('.insert(appointments)');
    expect(legacy).not.toContain('.update(appointments)');
    expect(legacy).toContain('legacy_appointment_writer_disabled');
    expect(provisioning).toContain('.insert(appointments)');
  });

  it('existing schema 已支持 appointment institution attribution 与 CAS', () => {
    expect(customers.institutionId).toBeDefined();
    expect(appointments.institutionId).toBeDefined();
    expect(appointments.updatedAt).toBeDefined();
  });
});
