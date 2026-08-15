import { describe, expect, it, vi } from 'vitest';

import type { TenantDatabase } from '@/server/db/client';
import { customers } from '@/server/db/schema';
import { createCustomerListRepository } from '@/modules/customers/server/customer-list-repository';

const query = Object.freeze({
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  lifecycle: null,
  priority: null,
  limit: 21,
  offset: 0,
});

const row = Object.freeze({
  customerId: 'customer-001',
  displayName: '客户甲',
  lifecycle: 'consulting' as const,
  priority: 'high' as const,
  updatedAt: new Date('2026-08-15T08:00:00.000Z'),
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});

const drizzleMocks = vi.hoisted(() => ({
  and: vi.fn((...conditions: unknown[]) => ({ operator: 'and', conditions })),
  asc: vi.fn((column: unknown) => ({ direction: 'asc', column })),
  desc: vi.fn((column: unknown) => ({ direction: 'desc', column })),
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

describe('Customers CUS-01 exact list repository', () => {
  it('单次 exact SELECT、pair predicate、稳定顺序与 bounded limit/offset', async () => {
    const db = createDatabase();
    const repository = createCustomerListRepository(db.database);

    await expect(repository.list(query)).resolves.toEqual([
      {
        ...row,
        updatedAt: '2026-08-15T08:00:00.000Z',
      },
    ]);

    expect(db.select).toHaveBeenCalledOnce();
    expect(db.select).toHaveBeenCalledWith({
      customerId: customers.id,
      displayName: customers.displayName,
      lifecycle: customers.lifecycle,
      priority: customers.priority,
      updatedAt: customers.updatedAt,
      tenantId: customers.tenantId,
      institutionId: customers.institutionId,
    });
    expect(Object.keys(db.select.mock.calls[0]?.[0] ?? {})).not.toEqual(
      expect.arrayContaining([
        'phone',
        'email',
        'notes',
        'maskedPhone',
        'medicalRecordNo',
        'ownerUserId',
        'projectInterest',
        'tags',
      ]),
    );
    expect(drizzleMocks.and).toHaveBeenCalledWith(
      { operator: 'eq', column: customers.tenantId, value: 'tenant-001' },
      { operator: 'eq', column: customers.institutionId, value: 'institution-001' },
    );
    expect(db.orderBy).toHaveBeenCalledWith(
      { direction: 'desc', column: customers.updatedAt },
      { direction: 'asc', column: customers.id },
    );
    expect(db.limit).toHaveBeenCalledWith(21);
    expect(db.offset).toHaveBeenCalledWith(0);
  });

  it('lifecycle 与 priority 以 exact enum predicate 下推', async () => {
    const db = createDatabase();
    const repository = createCustomerListRepository(db.database);
    await repository.list({
      ...query,
      lifecycle: 'scheduled',
      priority: 'observe',
      offset: 1980,
    });

    expect(drizzleMocks.and).toHaveBeenLastCalledWith(
      { operator: 'eq', column: customers.tenantId, value: 'tenant-001' },
      { operator: 'eq', column: customers.institutionId, value: 'institution-001' },
      { operator: 'eq', column: customers.lifecycle, value: 'scheduled' },
      { operator: 'eq', column: customers.priority, value: 'observe' },
    );
    expect(db.offset).toHaveBeenCalledWith(1980);
  });

  it.each([
    { ...query, tenantId: '' },
    { ...query, institutionId: '' },
    { ...query, lifecycle: 'legacy' },
    { ...query, priority: 'watch' },
    { ...query, limit: 20 },
    { ...query, offset: 1 },
    { ...query, offset: 2000 },
  ])('非法或无界 query 在 DB 前 fail-closed', async (invalid) => {
    const db = createDatabase();
    const repository = createCustomerListRepository(db.database);
    await expect(repository.list(invalid as never)).rejects.toThrow(
      'invalid_customer_list_source_query',
    );
    expect(db.select).not.toHaveBeenCalled();
  });

  it('null institution attribution 与异常 overflow fail-closed', async () => {
    const nullInstitution = createDatabase([{ ...row, institutionId: null }]);
    await expect(
      createCustomerListRepository(nullInstitution.database).list(query),
    ).rejects.toThrow('customer_institution_attribution_missing');

    const overflow = createDatabase(Array.from({ length: 22 }, () => row));
    await expect(
      createCustomerListRepository(overflow.database).list(query),
    ).rejects.toThrow('customer_list_source_overflow');
  });
});
