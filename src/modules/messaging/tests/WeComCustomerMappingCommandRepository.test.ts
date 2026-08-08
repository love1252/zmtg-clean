import { describe, expect, it, vi } from 'vitest';

import { weComCustomerMappingStates } from '@/server/db/schema';
import type { TenantDatabase } from '@/server/db/client';
import { createWeComMappingCommandRepository } from '@/modules/messaging/server/wecom-customer-mapping-command-repository';

const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({ column, operator: 'eq', value })),
);
const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({ conditions, operator: 'and' })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: eqMock, and: andMock };
});

const row = {
  id: 'mapping-01',
  tenantId: 'tenant-a',
  institutionId: 'inst-a',
  proofContactId: 'contact-proof-a',
  proofEmployeeId: 'employee-proof-a',
  sourceMode: 'real_readonly_proof',
  customerId: 'customer-a',
  status: 'confirmed',
  decidedBy: 'user-a',
  decidedAt: new Date('2026-08-08T08:00:00.000Z'),
  createdAt: new Date('2026-08-08T08:00:00.000Z'),
  updatedAt: new Date('2026-08-08T08:00:00.000Z'),
} satisfies typeof weComCustomerMappingStates.$inferSelect;

function createDatabase(returned: typeof row | null = row) {
  const returning = vi.fn(async () => (returned ? [returned] : []));
  const onConflictDoNothing = vi.fn(() => ({ returning }));
  const values = vi.fn((input: Record<string, unknown>) => {
    void input;
    return { onConflictDoNothing };
  });
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn((condition: unknown) => {
    void condition;
    return { returning };
  });
  const set = vi.fn((input: Record<string, unknown>) => {
    void input;
    return { where };
  });
  const update = vi.fn(() => ({ set }));

  return {
    database: { insert, update } as unknown as TenantDatabase,
    returning,
    onConflictDoNothing,
    values,
    insert,
    where,
    set,
    update,
  };
}

describe('WeComMappingCommandRepository', () => {
  it('create 写入同一 canonical table 并携带 tenant + institution + proofContact', async () => {
    const mutation = createDatabase();
    const repository = createWeComMappingCommandRepository(mutation.database);

    await repository.create({
      id: 'mapping-01',
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      proofContactId: 'contact-proof-a',
      proofEmployeeId: 'employee-proof-a',
      sourceMode: 'real_readonly_proof',
      customerId: 'customer-a',
      status: 'confirmed',
      decidedBy: 'user-a',
      decidedAt: '2026-08-08T08:00:00.000Z',
    });

    expect(mutation.insert).toHaveBeenCalledWith(weComCustomerMappingStates);
    expect(mutation.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        proofContactId: 'contact-proof-a',
        customerId: 'customer-a',
        status: 'confirmed',
      }),
    );
    expect(mutation.onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it('update WHERE 锁定 tenant + institution + proofContact + expected customer + expected status', async () => {
    const mutation = createDatabase(null);
    const repository = createWeComMappingCommandRepository(mutation.database);

    await expect(
      repository.update({
        tenantId: 'tenant-a',
        institutionId: 'inst-b',
        proofContactId: 'contact-proof-a',
        customerId: 'customer-b',
        expectedCustomerId: 'customer-a',
        expectedStatus: 'confirmed',
        status: 'revoked',
        decidedBy: 'user-a',
        decidedAt: '2026-08-08T09:00:00.000Z',
      }),
    ).resolves.toBeNull();

    expect(andMock).toHaveBeenCalledWith(
      { column: weComCustomerMappingStates.tenantId, operator: 'eq', value: 'tenant-a' },
      { column: weComCustomerMappingStates.institutionId, operator: 'eq', value: 'inst-b' },
      { column: weComCustomerMappingStates.proofContactId, operator: 'eq', value: 'contact-proof-a' },
      { column: weComCustomerMappingStates.customerId, operator: 'eq', value: 'customer-a' },
      { column: weComCustomerMappingStates.status, operator: 'eq', value: 'confirmed' },
    );
  });

  it('update set 不允许篡改 tenant/institution/proofContact/expected state', async () => {
    const mutation = createDatabase();
    const repository = createWeComMappingCommandRepository(mutation.database);

    await repository.update({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      proofContactId: 'contact-proof-a',
      customerId: 'customer-b',
      expectedCustomerId: 'customer-a',
      expectedStatus: 'confirmed',
      status: 'revoked',
      decidedBy: 'user-a',
      decidedAt: '2026-08-08T09:00:00.000Z',
      attacker: 'ignored',
    } as never);

    const setValue = mutation.set.mock.calls[0]?.[0];
    expect(setValue).toEqual(
      expect.objectContaining({
        customerId: 'customer-b',
        status: 'revoked',
        decidedBy: 'user-a',
        decidedAt: new Date('2026-08-08T09:00:00.000Z'),
        updatedAt: new Date('2026-08-08T09:00:00.000Z'),
      }),
    );
    expect(setValue).not.toHaveProperty('tenantId');
    expect(setValue).not.toHaveProperty('institutionId');
    expect(setValue).not.toHaveProperty('proofContactId');
    expect(setValue).not.toHaveProperty('expectedCustomerId');
    expect(setValue).not.toHaveProperty('expectedStatus');
    expect(setValue).not.toHaveProperty('attacker');
  });

  it('create conflict 返回 null，不覆盖现有 mapping', async () => {
    const mutation = createDatabase(null);
    const repository = createWeComMappingCommandRepository(mutation.database);

    await expect(
      repository.create({
        id: 'mapping-02',
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        proofContactId: 'contact-proof-a',
        proofEmployeeId: 'employee-proof-a',
        sourceMode: 'real_readonly_proof',
        customerId: 'customer-b',
        status: 'rejected',
        decidedBy: 'user-a',
        decidedAt: '2026-08-08T10:00:00.000Z',
      }),
    ).resolves.toBeNull();
  });
});
