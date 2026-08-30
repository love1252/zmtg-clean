import { describe, expect, it, vi } from 'vitest';

import type { TenantDatabase } from '@/server/db/client';
import { customers } from '@/server/db/schema';
import { createCustomerListRepository } from '@/modules/customers/server/customer-list-repository';

const query = Object.freeze({
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  lifecycle: null,
  priority: null,
  keyword: null,
  gender: null,
  ageBand: null,
  createdFrom: null,
  createdTo: null,
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
  count: vi.fn((column: unknown) => ({ operator: 'count', column })),
  eq: vi.fn((column: unknown, value: unknown) => ({ operator: 'eq', column, value })),
  gte: vi.fn((column: unknown, value: unknown) => ({ operator: 'gte', column, value })),
  ilike: vi.fn((column: unknown, value: unknown) => ({ operator: 'ilike', column, value })),
  inArray: vi.fn((column: unknown, value: unknown) => ({ operator: 'inArray', column, value })),
  lte: vi.fn((column: unknown, value: unknown) => ({ operator: 'lte', column, value })),
  or: vi.fn((...conditions: unknown[]) => ({ operator: 'or', conditions })),
}));

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  ...drizzleMocks,
}));

function createDatabase(
  rows: readonly unknown[] = [row],
  countRows: readonly unknown[] = [{ total: rows.length }],
) {
  let selectionKind: 'list' | 'count' = 'list';
  const offset = vi.fn(async () => rows);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => selectionKind === 'count'
    ? Promise.resolve(countRows)
    : { orderBy });
  const from = vi.fn(() => ({ where }));
  const select = vi.fn((selection?: Record<string, unknown>) => {
    selectionKind = selection && Object.hasOwn(selection, 'total')
      ? 'count'
      : 'list';
    return { from };
  });
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

  it('姓名、性别、年龄段与创建日期只作为服务端 predicate，不进入低敏 DTO', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T08:00:00.000Z'));
    const db = createDatabase();
    const repository = createCustomerListRepository(db.database);

    await repository.list({
      ...query,
      keyword: '客户甲',
      gender: 'female',
      ageBand: '30_39',
      createdFrom: '2026-08-01',
      createdTo: '2026-08-28',
    });

    expect(drizzleMocks.ilike).toHaveBeenCalledWith(customers.displayName, '%客户甲%');
    expect(drizzleMocks.eq).toHaveBeenCalledWith(customers.gender, '女');
    expect(drizzleMocks.gte).toHaveBeenCalledWith(customers.birthDate, '1986-08-29');
    expect(drizzleMocks.lte).toHaveBeenCalledWith(customers.birthDate, '1996-08-28');
    expect(drizzleMocks.inArray).toHaveBeenCalledWith(customers.birthDate, ['低敏年龄:30-39']);
    expect(drizzleMocks.gte).toHaveBeenCalledWith(
      customers.createdAt,
      new Date('2026-08-01T00:00:00.000Z'),
    );
    expect(drizzleMocks.lte).toHaveBeenCalledWith(
      customers.createdAt,
      new Date('2026-08-28T23:59:59.999Z'),
    );
    vi.useRealTimers();
  });

  it('count 使用同一 tenant + institution + filter 边界且只返回安全整数', async () => {
    const db = createDatabase([], [{ total: 30 }]);
    const repository = createCustomerListRepository(db.database);

    await expect(repository.count({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      lifecycle: 'scheduled',
      priority: 'observe',
      keyword: null,
      gender: null,
      ageBand: null,
      createdFrom: null,
      createdTo: null,
    })).resolves.toBe(30);
    expect(drizzleMocks.and).toHaveBeenLastCalledWith(
      { operator: 'eq', column: customers.tenantId, value: 'tenant-001' },
      { operator: 'eq', column: customers.institutionId, value: 'institution-001' },
      { operator: 'eq', column: customers.lifecycle, value: 'scheduled' },
      { operator: 'eq', column: customers.priority, value: 'observe' },
    );
    expect(db.select).toHaveBeenCalledWith({
      total: { operator: 'count', column: customers.id },
    });
  });

  it.each([
    { ...query, tenantId: '' },
    { ...query, institutionId: '' },
    { ...query, lifecycle: 'legacy' },
    { ...query, priority: 'watch' },
    { ...query, limit: 20 },
    { ...query, limit: 31 },
    { ...query, offset: 1 },
    { ...query, offset: 10_000 },
  ])('非法或无界 query 在 DB 前 fail-closed', async (invalid) => {
    const db = createDatabase();
    const repository = createCustomerListRepository(db.database);
    await expect(repository.list(invalid as never)).rejects.toThrow(
      'invalid_customer_list_source_query',
    );
    expect(db.select).not.toHaveBeenCalled();
  });

  it('非法 count query 与异常 count 结果在低敏边界内拒绝', async () => {
    const invalid = createDatabase();
    await expect(
      createCustomerListRepository(invalid.database).count({
        tenantId: '',
        institutionId: 'institution-001',
        lifecycle: null,
        priority: null,
        keyword: null,
        gender: null,
        ageBand: null,
        createdFrom: null,
        createdTo: null,
      }),
    ).rejects.toThrow('invalid_customer_list_count_query');
    expect(invalid.select).not.toHaveBeenCalled();

    const unavailable = createDatabase([], [{ total: -1 }]);
    await expect(
      createCustomerListRepository(unavailable.database).count({
        tenantId: 'tenant-001',
        institutionId: 'institution-001',
        lifecycle: null,
        priority: null,
        keyword: null,
        gender: null,
        ageBand: null,
        createdFrom: null,
        createdTo: null,
      }),
    ).rejects.toThrow('customer_list_count_unavailable');
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
