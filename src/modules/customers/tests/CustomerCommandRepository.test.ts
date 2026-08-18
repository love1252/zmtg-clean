
import { describe, expect, it, vi } from 'vitest';

import type { TenantDatabase } from '@/server/db/client';
import { customers } from '@/server/db/schema';
import { createCustomerCommandRepository } from '@/modules/customers/server/customer-command-repository';

const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'eq',
    value,
  })),
);
const gteMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'gte',
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
const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({ conditions, operator: 'and' })),
);

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: eqMock,
  gte: gteMock,
  lt: ltMock,
  and: andMock,
}));

const UPDATED_AT = new Date('2026-08-18T12:00:00.000Z');
const customerRow = {
  id: 'cust_001',
  tenantId: 'tenant_001',
  institutionId: 'inst_001',
  displayName: '王女士',
  lifecycle: 'consulting',
  priority: 'high',
  ownerUserId: 'user_001',
  projectInterest: '皮肤管理',
  maskedPhone: '',
  maskedMedicalRecordNo: '',
  lastTouchSummary: '',
  nextAction: '',
  tags: [],
  gender: '',
  birthDate: '',
  referralSource: '',
  notes: '',
  createdAt: UPDATED_AT,
  updatedAt: UPDATED_AT,
} satisfies typeof customers.$inferSelect;

function createMutationDatabase(row: typeof customerRow | null = customerRow) {
  const returning = vi.fn(async () => (row ? [row] : []));
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn((values: Record<string, unknown>) => {
    void values;
    return { where };
  });
  const update = vi.fn(() => ({ set }));
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));

  return {
    database: { insert, update } as unknown as TenantDatabase,
    returning,
    where,
    set,
    update,
    values,
    insert,
  };
}

describe('CustomerCommandRepository', () => {
  it('create persists exact tenant/institution and returns updatedAt', async () => {
    const mutation = createMutationDatabase();
    const repository = createCustomerCommandRepository(mutation.database);

    const record = await repository.create({
      id: 'cust_001',
      tenantId: 'tenant_001',
      institutionId: 'inst_001',
      displayName: '王女士',
      lifecycle: 'consulting',
      priority: 'high',
      ownerUserId: 'user_001',
      projectInterest: '皮肤管理',
      maskedPhone: '',
      maskedMedicalRecordNo: '',
      lastTouchSummary: '',
      nextAction: '',
      tags: [],
      gender: '',
      birthDate: '',
      referralSource: '',
      notes: '',
    });

    expect(mutation.insert).toHaveBeenCalledWith(customers);
    expect(record.updatedAt).toBe(UPDATED_AT.toISOString());
  });

  it('update CAS accepts the exact client millisecond bucket for PostgreSQL microseconds', async () => {
    const mutation = createMutationDatabase(null);
    const repository = createCustomerCommandRepository(mutation.database);

    await repository.update({
      tenantId: 'tenant_001',
      institutionId: 'inst_002',
      id: 'cust_001',
      expectedUpdatedAt: UPDATED_AT.toISOString(),
      changes: { displayName: '更新' },
    });

    expect(andMock).toHaveBeenCalledWith(
      { column: customers.tenantId, operator: 'eq', value: 'tenant_001' },
      { column: customers.institutionId, operator: 'eq', value: 'inst_002' },
      { column: customers.id, operator: 'eq', value: 'cust_001' },
      { column: customers.updatedAt, operator: 'gte', value: UPDATED_AT },
      {
        column: customers.updatedAt,
        operator: 'lt',
        value: new Date(UPDATED_AT.getTime() + 1),
      },
    );
  });

  it('controlled update advances updatedAt strictly beyond the prior client token', async () => {
    const mutation = createMutationDatabase();
    const repository = createCustomerCommandRepository(mutation.database);

    await repository.update({
      tenantId: 'tenant_001',
      institutionId: 'inst_001',
      id: 'cust_001',
      expectedUpdatedAt: UPDATED_AT.toISOString(),
      changes: { priority: 'medium' },
    });

    const values = mutation.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(values.updatedAt).toBeInstanceOf(Date);
    expect((values.updatedAt as Date).getTime()).toBeGreaterThan(
      UPDATED_AT.getTime(),
    );
  });

  it('unsafe changes cannot overwrite identity or attribution columns', async () => {
    const mutation = createMutationDatabase();
    const repository = createCustomerCommandRepository(mutation.database);

    await repository.update({
      tenantId: 'tenant_001',
      institutionId: 'inst_001',
      id: 'cust_001',
      expectedUpdatedAt: UPDATED_AT.toISOString(),
      changes: {
        displayName: '更新',
        id: 'attacker',
        tenantId: 'attacker',
        institutionId: 'attacker',
      } as never,
    });

    const values = mutation.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(values).not.toHaveProperty('id');
    expect(values).not.toHaveProperty('tenantId');
    expect(values).not.toHaveProperty('institutionId');
  });

  it('create without returning row fails closed', async () => {
    const mutation = createMutationDatabase(null);
    const repository = createCustomerCommandRepository(mutation.database);

    await expect(
      repository.create({
        id: 'cust_001',
        tenantId: 'tenant_001',
        institutionId: 'inst_001',
        displayName: '王女士',
        lifecycle: 'consulting',
        priority: 'high',
        ownerUserId: 'user_001',
        projectInterest: '',
        maskedPhone: '',
        maskedMedicalRecordNo: '',
        lastTouchSummary: '',
        nextAction: '',
        tags: [],
        gender: '',
        birthDate: '',
        referralSource: '',
        notes: '',
      }),
    ).rejects.toThrow('customer_create_returning_missing');
  });
});
