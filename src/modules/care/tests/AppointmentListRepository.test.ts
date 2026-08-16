import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createAppointmentListRepository } from '@/modules/care/server/appointment-list-repository';
import type { TenantDatabase } from '@/server/db/client';
import { appointments } from '@/server/db/schema';

const query = Object.freeze({
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  status: null,
  limit: 21,
  offset: 0,
});

const row = Object.freeze({
  appointmentId: 'appointment-001',
  scheduledAt: new Date('2026-08-16T08:30:00.000Z'),
  status: 'pending_confirmation' as const,
  updatedAt: new Date('2026-08-16T08:00:00.000Z'),
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});

const drizzleMocks = vi.hoisted(() => ({
  and: vi.fn((...conditions: unknown[]) => ({ operator: 'and', conditions })),
  asc: vi.fn((column: unknown) => ({ direction: 'asc', column })),
  eq: vi.fn((column: unknown, value: unknown) => ({ operator: 'eq', column, value })),
}));

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  ...drizzleMocks,
}));

function createDatabase(rows: readonly unknown[] = [row]) {
  const offset = vi.fn(async () => rows);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn((_selection?: unknown) => ({ from }));
  return {
    database: { select } as unknown as TenantDatabase,
    select,
    from,
    where,
    orderBy,
    limit,
    offset,
  };
}

describe('Care appointment exact list repository', () => {
  it('只查询 appointments 的 exact 6 columns、正式 pair、稳定顺序和固定分页', async () => {
    const db = createDatabase();
    const repository = createAppointmentListRepository(db.database);

    await expect(repository.list(query)).resolves.toEqual([
      {
        ...row,
        scheduledAt: '2026-08-16T08:30:00.000Z',
        updatedAt: '2026-08-16T08:00:00.000Z',
      },
    ]);
    expect(db.select).toHaveBeenCalledWith({
      appointmentId: appointments.id,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      updatedAt: appointments.updatedAt,
      tenantId: appointments.tenantId,
      institutionId: appointments.institutionId,
    });
    expect(Object.keys(db.select.mock.calls[0]?.[0] ?? {})).toEqual([
      'appointmentId',
      'scheduledAt',
      'status',
      'updatedAt',
      'tenantId',
      'institutionId',
    ]);
    expect(drizzleMocks.and).toHaveBeenCalledWith(
      { operator: 'eq', column: appointments.tenantId, value: 'tenant-001' },
      {
        operator: 'eq',
        column: appointments.institutionId,
        value: 'institution-001',
      },
    );
    expect(db.orderBy).toHaveBeenCalledWith(
      { direction: 'asc', column: appointments.scheduledAt },
      { direction: 'asc', column: appointments.id },
    );
    expect(db.limit).toHaveBeenCalledWith(21);
    expect(db.offset).toHaveBeenCalledWith(0);
  });

  it('optional status 作为第三个 exact predicate 下推', async () => {
    const db = createDatabase();
    await createAppointmentListRepository(db.database).list({
      ...query,
      status: 'reschedule_requested',
      offset: 1980,
    });
    expect(drizzleMocks.and).toHaveBeenLastCalledWith(
      { operator: 'eq', column: appointments.tenantId, value: 'tenant-001' },
      {
        operator: 'eq',
        column: appointments.institutionId,
        value: 'institution-001',
      },
      {
        operator: 'eq',
        column: appointments.status,
        value: 'reschedule_requested',
      },
    );
    expect(db.offset).toHaveBeenCalledWith(1980);
  });

  it.each([
    { ...query, tenantId: '' },
    { ...query, institutionId: '' },
    { ...query, status: 'unknown' },
    { ...query, limit: 20 },
    { ...query, offset: 1 },
    { ...query, offset: 2000 },
  ])('非法或无界 query 在 DB 前 fail-closed', async (invalid) => {
    const db = createDatabase();
    await expect(
      createAppointmentListRepository(db.database).list(invalid as never),
    ).rejects.toThrow('invalid_appointment_list_source_query');
    expect(db.select).not.toHaveBeenCalled();
  });

  it('null institution attribution 与 overflow fail-closed', async () => {
    const missing = createDatabase([{ ...row, institutionId: null }]);
    await expect(
      createAppointmentListRepository(missing.database).list(query),
    ).rejects.toThrow('appointment_institution_attribution_missing');

    const overflow = createDatabase(Array.from({ length: 22 }, () => row));
    await expect(
      createAppointmentListRepository(overflow.database).list(query),
    ).rejects.toThrow('appointment_list_source_overflow');
  });

  it('source 不 join Customers、不读 full row、无 DML 或 transaction', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/care/server/appointment-list-repository.ts'),
      'utf8',
    );
    expect(source).toContain('.select({');
    expect(source).toContain('.from(appointments)');
    expect(source).not.toMatch(/customers|customerId|customerDisplayName|project|consultant|note/iu);
    expect(source).not.toMatch(/\.select\(\s*\)|\.insert\(|\.update\(|\.delete\(|transaction|raw\s*sql/iu);
  });
});
