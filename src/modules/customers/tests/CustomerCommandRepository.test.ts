import { describe, expect, it, vi } from 'vitest';

import { customers } from '@/server/db/schema';
import type { TenantDatabase } from '@/server/db/client';
import { createCustomerCommandRepository } from '@/modules/customers/server/customer-command-repository';

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

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: eqMock,
    and: andMock,
  };
});

const customerRow = {
  id: 'cust_001',
  tenantId: 'tenant_001',
  institutionId: 'inst_001',
  displayName: '王女士',
  lifecycle: 'consulting',
  priority: 'high',
  ownerUserId: 'user_001',
  projectInterest: '皮肤管理',
  maskedPhone: '138****0001',
  maskedMedicalRecordNo: 'MR****001',
  lastTouchSummary: '首次咨询',
  nextAction: '人工跟进',
  tags: ['重点'],
  gender: 'female',
  birthDate: '1990-01',
  referralSource: '转介绍',
  notes: '低敏备注',
  createdAt: new Date('2026-08-08T00:00:00.000Z'),
  updatedAt: new Date('2026-08-08T00:00:00.000Z'),
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
  it('create 同时持久化 tenantId + institutionId，且只写 Customers canonical shape', async () => {
    const mutation = createMutationDatabase();
    const repository = createCustomerCommandRepository(mutation.database);

    await repository.create({
      id: 'cust_001',
      tenantId: 'tenant_001',
      institutionId: 'inst_001',
      displayName: '王女士',
      lifecycle: 'consulting',
      priority: 'high',
      ownerUserId: 'user_001',
      projectInterest: '皮肤管理',
      maskedPhone: '138****0001',
      maskedMedicalRecordNo: 'MR****001',
      lastTouchSummary: '首次咨询',
      nextAction: '人工跟进',
      tags: ['重点'],
      gender: 'female',
      birthDate: '1990-01',
      referralSource: '转介绍',
      notes: '低敏备注',
    });

    expect(mutation.insert).toHaveBeenCalledWith(customers);
    expect(mutation.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cust_001',
        tenantId: 'tenant_001',
        institutionId: 'inst_001',
      }),
    );
  });

  it('update WHERE 同时绑定 tenant + institution + customer，跨机构无返回即 fail-closed', async () => {
    const mutation = createMutationDatabase(null);
    const repository = createCustomerCommandRepository(mutation.database);

    await expect(
      repository.update({
        tenantId: 'tenant_001',
        institutionId: 'inst_002',
        id: 'cust_001',
        changes: { displayName: '非法跨机构更新' },
      }),
    ).resolves.toBeNull();

    expect(mutation.update).toHaveBeenCalledWith(customers);
    expect(andMock).toHaveBeenCalledWith(
      { column: customers.tenantId, operator: 'eq', value: 'tenant_001' },
      { column: customers.institutionId, operator: 'eq', value: 'inst_002' },
      { column: customers.id, operator: 'eq', value: 'cust_001' },
    );
    expect(mutation.where).toHaveBeenCalledWith({
      conditions: [
        { column: customers.tenantId, operator: 'eq', value: 'tenant_001' },
        { column: customers.institutionId, operator: 'eq', value: 'inst_002' },
        { column: customers.id, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
  });

  it('update 对不安全 changes 再次剥离 identity/attribution 字段', async () => {
    const mutation = createMutationDatabase();
    const repository = createCustomerCommandRepository(mutation.database);

    await repository.update({
      tenantId: 'tenant_001',
      institutionId: 'inst_001',
      id: 'cust_001',
      changes: {
        displayName: '王女士更新',
        id: 'attacker_customer',
        tenantId: 'attacker_tenant',
        institutionId: 'attacker_institution',
        createdAt: new Date(),
      } as never,
    });

    const values = mutation.set.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(values).toEqual(
      expect.objectContaining({
        displayName: '王女士更新',
        updatedAt: expect.any(Date),
      }),
    );
    expect(values).not.toHaveProperty('id');
    expect(values).not.toHaveProperty('tenantId');
    expect(values).not.toHaveProperty('institutionId');
    expect(values).not.toHaveProperty('createdAt');
  });

  it('create 无 returning row 时 fail-closed', async () => {
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
        projectInterest: '皮肤管理',
        maskedPhone: '138****0001',
        maskedMedicalRecordNo: 'MR****001',
        lastTouchSummary: '首次咨询',
        nextAction: '人工跟进',
        tags: ['重点'],
        gender: 'female',
        birthDate: '1990-01',
        referralSource: '转介绍',
        notes: '低敏备注',
      }),
    ).rejects.toThrow('customer_create_returning_missing');
  });
});
