import { describe, expect, it, vi } from 'vitest';

import type { BroadcastOutcomeState } from '@/modules/messaging/application/wecom-customer-broadcast-task-outcome-command-service';
import { createBroadcastOutcomeCommandRepository } from '@/modules/messaging/server/wecom-customer-broadcast-task-outcome-command-repository';
import type { TenantDatabase } from '@/server/db/client';
import { weComCustomerBroadcastTaskProviderAttempts } from '@/server/db/schema';

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
  return { ...actual, eq: eqMock, and: andMock };
});

const row = {
  id: 'attempt-a',
  operationId: 'operation-a',
  operationRef: 'operation-ref-a',
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  customerId: 'customer-a',
  capabilityKind: 'customer_broadcast_task',
  providerKind: 'wecom_official_customer_broadcast',
  dispatchState: 'not_started',
  dispatchCount: 0,
  dispatchStartedAt: null,
  dispatchTerminalAt: null,
  taskRefDigest: null,
  memberConfirmationRequired: true,
  providerResultCategory: null,
  sendResultStatus: 'not_checked',
  sendResultCheckedAt: null,
  finalizeState: 'not_finalized',
  reconciliationState: 'none',
  manualReviewRequired: false,
  automaticRetryAllowed: false,
  version: 1,
  createdAt: new Date('2026-08-08T12:00:00.000Z'),
  updatedAt: new Date('2026-08-08T12:00:00.000Z'),
} satisfies typeof weComCustomerBroadcastTaskProviderAttempts.$inferSelect;

function nextOutcome(overrides: Partial<BroadcastOutcomeState> = {}): BroadcastOutcomeState {
  return {
    ...row,
    capabilityKind: 'customer_broadcast_task',
    providerKind: 'wecom_official_customer_broadcast',
    memberConfirmationRequired: true,
    automaticRetryAllowed: false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: '2026-08-08T12:01:00.000Z',
    dispatchState: 'task_create_attempted',
    dispatchCount: 1,
    version: 2,
    ...overrides,
  };
}

describe('BroadcastOutcomeCommandRepository', () => {
  it('create 写入同一 provider-attempt fact source 与完整 attribution', async () => {
    const returning = vi.fn(async () => [row]);
    const onConflictDoNothing = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    const repository = createBroadcastOutcomeCommandRepository(
      { insert } as unknown as TenantDatabase,
    );

    await repository.createNotStarted({
      id: 'attempt-a',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      customerId: 'customer-a',
      operationId: 'operation-a',
      operationRef: 'operation-ref-a',
      occurredAt: '2026-08-08T12:00:00.000Z',
    });

    expect(insert).toHaveBeenCalledWith(weComCustomerBroadcastTaskProviderAttempts);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'attempt-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
        customerId: 'customer-a',
        operationId: 'operation-a',
        operationRef: 'operation-ref-a',
        dispatchState: 'not_started',
        dispatchCount: 0,
        finalizeState: 'not_finalized',
        automaticRetryAllowed: false,
        version: 1,
      }),
    );
    expect(onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it('update WHERE 强制完整 scope + expectedVersion CAS + not_finalized', async () => {
    const returning = vi.fn(async () => []);
    const where = vi.fn((condition: unknown) => {
      void condition;
      return { returning };
    });
    const set = vi.fn((input: Record<string, unknown>) => {
      void input;
      return { where };
    });
    const update = vi.fn(() => ({ set }));
    const repository = createBroadcastOutcomeCommandRepository(
      { update } as unknown as TenantDatabase,
    );
    const outcome = nextOutcome();

    await expect(
      repository.updateWhenVersionMatches({
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
        customerId: 'customer-a',
        operationId: 'operation-a',
        operationRef: 'operation-ref-a',
        expectedVersion: 1,
        outcome,
      }),
    ).resolves.toBeNull();

    expect(andMock).toHaveBeenCalledWith(
      { column: weComCustomerBroadcastTaskProviderAttempts.tenantId, operator: 'eq', value: 'tenant-a' },
      { column: weComCustomerBroadcastTaskProviderAttempts.institutionId, operator: 'eq', value: 'institution-a' },
      { column: weComCustomerBroadcastTaskProviderAttempts.customerId, operator: 'eq', value: 'customer-a' },
      { column: weComCustomerBroadcastTaskProviderAttempts.operationId, operator: 'eq', value: 'operation-a' },
      { column: weComCustomerBroadcastTaskProviderAttempts.operationRef, operator: 'eq', value: 'operation-ref-a' },
      { column: weComCustomerBroadcastTaskProviderAttempts.version, operator: 'eq', value: 1 },
      { column: weComCustomerBroadcastTaskProviderAttempts.finalizeState, operator: 'eq', value: 'not_finalized' },
    );
  });

  it('cross-scope / stale-version-shape / finalized outcome 不发出 update', async () => {
    const update = vi.fn();
    const repository = createBroadcastOutcomeCommandRepository(
      { update } as unknown as TenantDatabase,
    );

    const cases = [
      nextOutcome({ institutionId: 'institution-b' }),
      nextOutcome({ customerId: 'customer-b' }),
      nextOutcome({ operationId: 'operation-b' }),
      nextOutcome({ operationRef: 'operation-ref-b' }),
      nextOutcome({ version: 7 }),
      nextOutcome({ finalizeState: 'success_recorded' }),
    ];

    for (const outcome of cases) {
      await expect(
        repository.updateWhenVersionMatches({
          tenantId: 'tenant-a',
          institutionId: 'institution-a',
          customerId: 'customer-a',
          operationId: 'operation-a',
          operationRef: 'operation-ref-a',
          expectedVersion: 1,
          outcome,
        }),
      ).resolves.toBeNull();
    }

    expect(update).not.toHaveBeenCalled();
  });

  it('update set 不允许改写 identity、expectedVersion 或 retry policy', async () => {
    const returning = vi.fn(async () => [
      {
        ...row,
        dispatchState: 'task_create_attempted',
        dispatchCount: 1,
        version: 2,
        updatedAt: new Date('2026-08-08T12:01:00.000Z'),
      },
    ]);
    const where = vi.fn((condition: unknown) => {
      void condition;
      return { returning };
    });
    const set = vi.fn((input: Record<string, unknown>) => {
      void input;
      return { where };
    });
    const update = vi.fn(() => ({ set }));
    const repository = createBroadcastOutcomeCommandRepository(
      { update } as unknown as TenantDatabase,
    );

    await repository.updateWhenVersionMatches({
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      customerId: 'customer-a',
      operationId: 'operation-a',
      operationRef: 'operation-ref-a',
      expectedVersion: 1,
      outcome: nextOutcome(),
    });

    const setValue = set.mock.calls[0]?.[0];

    expect(setValue).toEqual(
      expect.objectContaining({
        dispatchState: 'task_create_attempted',
        dispatchCount: 1,
        finalizeState: 'not_finalized',
        automaticRetryAllowed: false,
        version: 2,
      }),
    );
    expect(setValue).not.toHaveProperty('tenantId');
    expect(setValue).not.toHaveProperty('institutionId');
    expect(setValue).not.toHaveProperty('customerId');
    expect(setValue).not.toHaveProperty('operationId');
    expect(setValue).not.toHaveProperty('operationRef');
    expect(setValue).not.toHaveProperty('expectedVersion');
  });

  it('create conflict 返回 null，不覆盖已有 provider attempt', async () => {
    const returning = vi.fn(async () => []);
    const onConflictDoNothing = vi.fn(() => ({ returning }));
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    const repository = createBroadcastOutcomeCommandRepository(
      { insert } as unknown as TenantDatabase,
    );

    await expect(
      repository.createNotStarted({
        id: 'attempt-b',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
        customerId: 'customer-a',
        operationId: 'operation-a',
        operationRef: 'operation-ref-a',
        occurredAt: '2026-08-08T12:00:00.000Z',
      }),
    ).resolves.toBeNull();
  });
});
