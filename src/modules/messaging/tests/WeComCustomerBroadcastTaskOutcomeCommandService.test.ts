import { describe, expect, it, vi } from 'vitest';

import {
  BroadcastOutcomeCommandInputError,
  createBroadcastOutcomeCommandService,
  type BroadcastOutcomeCommandRepository,
  type BroadcastOutcomeState,
} from '@/modules/messaging/application/wecom-customer-broadcast-task-outcome-command-service';

const initial: BroadcastOutcomeState = {
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
  createdAt: '2026-08-08T12:00:00.000Z',
  updatedAt: '2026-08-08T12:00:00.000Z',
};

function createRepositoryMock() {
  const createNotStarted = vi.fn(async () => initial);
  const updateWhenVersionMatches = vi.fn(async () => ({
    ...initial,
    dispatchState: 'task_create_attempted' as const,
    dispatchCount: 1 as const,
    version: 2,
    updatedAt: '2026-08-08T12:01:00.000Z',
  }));

  return {
    repository: {
      createNotStarted,
      updateWhenVersionMatches,
    } satisfies BroadcastOutcomeCommandRepository,
    createNotStarted,
    updateWhenVersionMatches,
  };
}

describe('BroadcastOutcomeCommandService', () => {
  it('create 只使用 canonical scope，忽略伪造的额外 attribution', async () => {
    const mock = createRepositoryMock();
    const service = createBroadcastOutcomeCommandService(mock.repository);

    await service.createNotStarted({
      scope: {
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
        customerId: 'customer-a',
        operationId: 'operation-a',
        operationRef: 'operation-ref-a',
        attackerTenantId: 'tenant-b',
      } as never,
      id: 'attempt-a',
      occurredAt: '2026-08-08T12:00:00.000Z',
    });

    expect(mock.createNotStarted).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      customerId: 'customer-a',
      operationId: 'operation-a',
      operationRef: 'operation-ref-a',
      id: 'attempt-a',
      occurredAt: '2026-08-08T12:00:00.000Z',
    });
  });

  it('缺 tenant / institution / customer / operation scope 时 fail-closed', async () => {
    const mock = createRepositoryMock();
    const service = createBroadcastOutcomeCommandService(mock.repository);

    await expect(
      service.createNotStarted({
        scope: {
          tenantId: 'tenant-a',
          institutionId: '',
          customerId: 'customer-a',
          operationId: 'operation-a',
          operationRef: 'operation-ref-a',
        },
        id: 'attempt-a',
        occurredAt: '2026-08-08T12:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BroadcastOutcomeCommandInputError);

    expect(mock.createNotStarted).not.toHaveBeenCalled();
  });

  it('update 拒绝 cross-tenant / institution / customer / operation outcome', async () => {
    const mock = createRepositoryMock();
    const service = createBroadcastOutcomeCommandService(mock.repository);
    const next: BroadcastOutcomeState = {
      ...initial,
      dispatchState: 'task_create_attempted',
      dispatchCount: 1,
      version: 2,
      updatedAt: '2026-08-08T12:01:00.000Z',
    };

    for (const outcome of [
      { ...next, tenantId: 'tenant-b' },
      { ...next, institutionId: 'institution-b' },
      { ...next, customerId: 'customer-b' },
      { ...next, operationId: 'operation-b' },
      { ...next, operationRef: 'operation-ref-b' },
    ]) {
      await expect(
        service.updateWhenVersionMatches({
          scope: {
            tenantId: 'tenant-a',
            institutionId: 'institution-a',
            customerId: 'customer-a',
            operationId: 'operation-a',
            operationRef: 'operation-ref-a',
          },
          expectedVersion: 1,
          outcome,
        }),
      ).rejects.toThrow('broadcast_outcome_scope_mismatch');
    }

    expect(mock.updateWhenVersionMatches).not.toHaveBeenCalled();
  });

  it('update 拒绝 stale version 与 finalized outcome', async () => {
    const mock = createRepositoryMock();
    const service = createBroadcastOutcomeCommandService(mock.repository);
    const next: BroadcastOutcomeState = {
      ...initial,
      dispatchState: 'task_create_attempted',
      dispatchCount: 1,
      version: 2,
      updatedAt: '2026-08-08T12:01:00.000Z',
    };

    await expect(
      service.updateWhenVersionMatches({
        scope: {
          tenantId: 'tenant-a',
          institutionId: 'institution-a',
          customerId: 'customer-a',
          operationId: 'operation-a',
          operationRef: 'operation-ref-a',
        },
        expectedVersion: 8,
        outcome: next,
      }),
    ).rejects.toThrow('broadcast_outcome_version_mismatch');

    await expect(
      service.updateWhenVersionMatches({
        scope: {
          tenantId: 'tenant-a',
          institutionId: 'institution-a',
          customerId: 'customer-a',
          operationId: 'operation-a',
          operationRef: 'operation-ref-a',
        },
        expectedVersion: 1,
        outcome: {
          ...next,
          finalizeState: 'success_recorded',
        },
      }),
    ).rejects.toThrow('broadcast_outcome_already_finalized');

    expect(mock.updateWhenVersionMatches).not.toHaveBeenCalled();
  });

  it('repository CAS conflict 的 null 语义保持 fail-closed', async () => {
    const repository = {
      createNotStarted: vi.fn(async () => null),
      updateWhenVersionMatches: vi.fn(async () => null),
    } satisfies BroadcastOutcomeCommandRepository;
    const service = createBroadcastOutcomeCommandService(repository);
    const next: BroadcastOutcomeState = {
      ...initial,
      dispatchState: 'task_create_attempted',
      dispatchCount: 1,
      version: 2,
      updatedAt: '2026-08-08T12:01:00.000Z',
    };

    await expect(
      service.updateWhenVersionMatches({
        scope: {
          tenantId: 'tenant-a',
          institutionId: 'institution-a',
          customerId: 'customer-a',
          operationId: 'operation-a',
          operationRef: 'operation-ref-a',
        },
        expectedVersion: 1,
        outcome: next,
      }),
    ).resolves.toBeNull();
  });
});
