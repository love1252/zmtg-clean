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
  keyword: null,
  scheduledFrom: null,
  scheduledBefore: null,
  limit: 21,
  offset: 0,
});

const summaryRow = Object.freeze({
  status: 'pending_confirmation' as const,
  total: 1,
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});

const row = Object.freeze({
  appointmentId: 'appointment-001',
  customerDisplayName: '张女士',
  project: '光子嫩肤复诊',
  scheduledAt: new Date('2026-08-16T08:30:00.000Z'),
  status: 'pending_confirmation' as const,
  updatedAt: new Date('2026-08-16T08:00:00.000Z'),
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});

const drizzleMocks = vi.hoisted(() => ({
  and: vi.fn((...conditions: unknown[]) => ({ operator: 'and', conditions })),
  asc: vi.fn((column: unknown) => ({ direction: 'asc', column })),
  count: vi.fn((column: unknown) => ({ operator: 'count', column })),
  eq: vi.fn((column: unknown, value: unknown) => ({ operator: 'eq', column, value })),
  gte: vi.fn((column: unknown, value: unknown) => ({ operator: 'gte', column, value })),
  ilike: vi.fn((column: unknown, value: unknown) => ({ operator: 'ilike', column, value })),
  lt: vi.fn((column: unknown, value: unknown) => ({ operator: 'lt', column, value })),
  or: vi.fn((...conditions: unknown[]) => ({ operator: 'or', conditions })),
}));

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  ...drizzleMocks,
}));

function createDatabase(
  rows: readonly unknown[] = [row],
  summaryRows: readonly unknown[] = [summaryRow],
) {
  const offset = vi.fn(async () => rows);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const groupBy = vi.fn(async () => summaryRows);
  const summaryWhere = vi.fn(() => ({ groupBy }));
  const summaryFrom = vi.fn(() => ({ where: summaryWhere }));
  const select = vi.fn((selection?: Record<string, unknown>) =>
    selection && Object.hasOwn(selection, 'appointmentId')
      ? { from }
      : { from: summaryFrom },
  );
  return {
    database: { select } as unknown as TenantDatabase,
    select,
    from,
    where,
    orderBy,
    limit,
    offset,
    groupBy,
    summaryWhere,
  };
}

describe('Care appointment exact list repository', () => {
  it('只查询 appointments 的 exact 8 columns、正式 pair、稳定顺序和固定分页', async () => {
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
      customerDisplayName: appointments.customerDisplayName,
      project: appointments.project,
      scheduledAt: appointments.scheduledAt,
      status: appointments.status,
      updatedAt: appointments.updatedAt,
      tenantId: appointments.tenantId,
      institutionId: appointments.institutionId,
    });
    expect(Object.keys(db.select.mock.calls[0]?.[0] ?? {})).toEqual([
      'appointmentId',
      'customerDisplayName',
      'project',
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

  it('客户或项目关键词使用参数化 ilike，并保持同一机构边界', async () => {
    const db = createDatabase();
    const repository = createAppointmentListRepository(db.database);

    await repository.list({ ...query, keyword: '张_女士%' });
    expect(drizzleMocks.ilike).toHaveBeenNthCalledWith(
      1,
      appointments.customerDisplayName,
      '%张\\_女士\\%%',
    );
    expect(drizzleMocks.ilike).toHaveBeenNthCalledWith(
      2,
      appointments.project,
      '%张\\_女士\\%%',
    );
    expect(drizzleMocks.and).toHaveBeenLastCalledWith(
      { operator: 'eq', column: appointments.tenantId, value: 'tenant-001' },
      {
        operator: 'eq',
        column: appointments.institutionId,
        value: 'institution-001',
      },
      expect.objectContaining({ operator: 'or' }),
    );

    await repository.summarize({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      keyword: '光子嫩肤',
      scheduledFrom: null,
      scheduledBefore: null,
    });
    expect(drizzleMocks.and).toHaveBeenLastCalledWith(
      expect.objectContaining({ operator: 'eq' }),
      expect.objectContaining({ operator: 'eq' }),
      expect.objectContaining({ operator: 'or' }),
    );
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

  it('日期范围以闭开区间下推，状态汇总保持同一 tenant + institution 边界', async () => {
    const db = createDatabase();
    const repository = createAppointmentListRepository(db.database);
    const scheduledFrom = '2026-08-14T16:00:00.000Z';
    const scheduledBefore = '2026-08-16T16:00:00.000Z';

    await repository.list({ ...query, scheduledFrom, scheduledBefore });
    expect(drizzleMocks.and).toHaveBeenLastCalledWith(
      { operator: 'eq', column: appointments.tenantId, value: 'tenant-001' },
      {
        operator: 'eq',
        column: appointments.institutionId,
        value: 'institution-001',
      },
      {
        operator: 'gte',
        column: appointments.scheduledAt,
        value: new Date(scheduledFrom),
      },
      {
        operator: 'lt',
        column: appointments.scheduledAt,
        value: new Date(scheduledBefore),
      },
    );

    await expect(repository.summarize({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      keyword: null,
      scheduledFrom,
      scheduledBefore,
    })).resolves.toEqual([summaryRow]);
    expect(db.select).toHaveBeenLastCalledWith({
      status: appointments.status,
      total: { operator: 'count', column: appointments.id },
      tenantId: appointments.tenantId,
      institutionId: appointments.institutionId,
    });
    expect(db.groupBy).toHaveBeenCalledWith(
      appointments.status,
      appointments.tenantId,
      appointments.institutionId,
    );
    expect(drizzleMocks.and).toHaveBeenLastCalledWith(
      { operator: 'eq', column: appointments.tenantId, value: 'tenant-001' },
      {
        operator: 'eq',
        column: appointments.institutionId,
        value: 'institution-001',
      },
      expect.objectContaining({ operator: 'gte' }),
      expect.objectContaining({ operator: 'lt' }),
    );
  });

  it('支持 10/20/50/100 页容量且总 offset 保持有界', async () => {
    for (const [limit, offset] of [[11, 990], [21, 1980], [51, 4950], [101, 9900]] as const) {
      const db = createDatabase([]);
      await createAppointmentListRepository(db.database).list({
        ...query,
        limit,
        offset,
      });
      expect(db.limit).toHaveBeenCalledWith(limit);
      expect(db.offset).toHaveBeenCalledWith(offset);
    }
  });

  it.each([
    { ...query, tenantId: '' },
    { ...query, institutionId: '' },
    { ...query, status: 'unknown' },
    { ...query, limit: 20 },
    { ...query, offset: 1 },
    { ...query, offset: 10_000 },
    { ...query, scheduledFrom: 'invalid', scheduledBefore: '2026-08-16T16:00:00.000Z' },
    { ...query, scheduledFrom: '2026-08-16T16:00:00.000Z', scheduledBefore: null },
  ])('非法或无界 query 在 DB 前 fail-closed', async (invalid) => {
    const db = createDatabase();
    await expect(
      createAppointmentListRepository(db.database).list(invalid as never),
    ).rejects.toThrow('invalid_appointment_list_source_query');
    expect(db.select).not.toHaveBeenCalled();
  });

  it('非法或异常 summary 在低敏边界内 fail-closed', async () => {
    const invalid = createDatabase();
    await expect(
      createAppointmentListRepository(invalid.database).summarize({
        tenantId: '',
        institutionId: 'institution-001',
        keyword: null,
        scheduledFrom: null,
        scheduledBefore: null,
      }),
    ).rejects.toThrow('invalid_appointment_list_summary_query');
    expect(invalid.select).not.toHaveBeenCalled();

    for (const rows of [
      [{ ...summaryRow, institutionId: null }],
      [{ ...summaryRow, total: -1 }],
      Array.from({ length: 7 }, () => summaryRow),
    ]) {
      await expect(
        createAppointmentListRepository(createDatabase([], rows).database).summarize({
          tenantId: 'tenant-001',
          institutionId: 'institution-001',
          keyword: null,
          scheduledFrom: null,
          scheduledBefore: null,
        }),
      ).rejects.toThrow(/appointment_list_summary_/u);
    }
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

  it('source 不 join Customers、不读 full row/备注、无 DML 或 transaction', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/care/server/appointment-list-repository.ts'),
      'utf8',
    );
    expect(source).toContain('.select({');
    expect(source).toContain('.from(appointments)');
    expect(source).not.toMatch(/customers|customerId|consultant|note/iu);
    expect(source).not.toMatch(/\.select\(\s*\)|\.insert\(|\.update\(|\.delete\(|transaction|raw\s*sql/iu);
  });
});
