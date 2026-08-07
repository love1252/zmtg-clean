import { describe, expect, it, vi } from 'vitest';

import {
  CrossTenantTransferTransactionError,
  createCrossTenantTransferService,
  type CrossTenantTransferIntent,
  type CrossTenantTransferTransactionPort,
} from '@/modules/access-control/application/cross-tenant-transfer-service';
import type { BindingTransitionEvidence } from '@/modules/access-control/domain/binding-lifecycle';
import type {
  CompleteMembershipCurrent,
  MembershipTransition,
} from '@/modules/access-control/domain/membership-lifecycle';
import type {
  ActiveMembershipBinding,
  MembershipCommandUnitOfWork,
} from '@/modules/access-control/ports/membership-command-unit-of-work';
import type { TransactionBoundScopeRejectionCode } from '@/modules/tenancy/ports/transaction-bound-institution-scope';

const COMMAND_ID = `mcmd1_${'A'.repeat(43)}`;
const NOW = new Date('2026-08-07T14:00:01.000Z');
const OCCURRED_AT = '2026-08-07T14:00:00.000Z';

function sourceMembership(
  overrides: Partial<CompleteMembershipCurrent> = {},
): CompleteMembershipCurrent {
  return {
    membershipId: 'membership-source',
    tenantId: 'tenant-source',
    userId: 'account-001',
    role: 'tenant_operator',
    displayName: '运营成员',
    revision: 4,
    lifecycleStatus: 'active',
    provenanceSource: 'access_control_command',
    provenanceActorId: 'actor-old',
    provenanceReasonCode: 'membership-refresh',
    provenanceCommandId: `mcmd1_${'I'.repeat(43)}`,
    provenanceOccurredAt: '2026-08-07T13:00:00.000Z',
    provenanceRecordedAt: '2026-08-07T13:00:01.000Z',
    revokedAt: null,
    deletedAt: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-07T13:00:01.000Z',
    ...overrides,
  };
}

function sourceBinding(
  overrides: Partial<ActiveMembershipBinding> = {},
): ActiveMembershipBinding {
  return {
    bindingId: 'binding-source',
    accountId: 'account-001',
    tenantId: 'tenant-source',
    institutionId: 'institution-source',
    source: 'migration_placeholder',
    assignedBy: 'legacy-actor',
    assignedAt: '2026-08-01T00:00:00.000Z',
    expiresAt: null,
    version: 7,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function targetBinding(): ActiveMembershipBinding {
  return {
    bindingId: 'binding-target-existing',
    accountId: 'account-001',
    tenantId: 'tenant-target',
    institutionId: 'institution-target',
    source: 'manual_admin',
    assignedBy: 'actor-001',
    assignedAt: OCCURRED_AT,
    expiresAt: null,
    version: 1,
    createdAt: OCCURRED_AT,
    updatedAt: OCCURRED_AT,
  };
}

function intent(
  overrides: Partial<CrossTenantTransferIntent> = {},
): CrossTenantTransferIntent {
  return {
    accountId: 'account-001',
    sourceTenantId: 'tenant-source',
    sourceMembershipId: 'membership-source',
    sourceExpectedMembershipRevision: 4,
    sourceBindingId: 'binding-source',
    sourceExpectedBindingVersion: 7,
    targetTenantId: 'tenant-target',
    targetInstitutionId: 'institution-target',
    targetMembershipId: 'membership-target',
    targetBindingId: 'binding-target',
    actorId: 'actor-transfer',
    reasonCode: 'base02-cross-tenant-transfer',
    occurredAt: OCCURRED_AT,
    targetBindingExpiresAt: null,
    ...overrides,
  };
}

type CommittedState = {
  sourceMembership: CompleteMembershipCurrent | null;
  targetMembership: CompleteMembershipCurrent | null;
  sourceActiveBinding: ActiveMembershipBinding | null;
  targetActiveBinding: ActiveMembershipBinding | null;
  membershipEvidence: MembershipTransition[];
  bindingEvidence: BindingTransitionEvidence[];
};

type HarnessOptions = Readonly<{
  sourceMembership?: CompleteMembershipCurrent | null;
  sourceActiveBinding?: ActiveMembershipBinding | null;
  targetMembership?: CompleteMembershipCurrent | null;
  targetActiveBinding?: ActiveMembershipBinding | null;
  scopeCode?: TransactionBoundScopeRejectionCode | null;
  blockSourceOwnerWithReplay?: boolean;
}>;

function cloneMembership(
  value: CompleteMembershipCurrent | null,
): CompleteMembershipCurrent | null {
  return value === null ? null : { ...value };
}

function cloneBinding(
  value: ActiveMembershipBinding | null,
): ActiveMembershipBinding | null {
  return value === null ? null : { ...value };
}

function cloneState(value: CommittedState): CommittedState {
  return {
    sourceMembership: cloneMembership(value.sourceMembership),
    targetMembership: cloneMembership(value.targetMembership),
    sourceActiveBinding: cloneBinding(value.sourceActiveBinding),
    targetActiveBinding: cloneBinding(value.targetActiveBinding),
    membershipEvidence: [...value.membershipEvidence],
    bindingEvidence: [...value.bindingEvidence],
  };
}

function harness(options: HarnessOptions = {}) {
  const operations: string[] = [];
  let runCount = 0;
  const committed: CommittedState = {
    sourceMembership:
      options.sourceMembership === undefined
        ? sourceMembership()
        : options.sourceMembership,
    targetMembership: options.targetMembership ?? null,
    sourceActiveBinding:
      options.sourceActiveBinding === undefined
        ? sourceBinding()
        : options.sourceActiveBinding,
    targetActiveBinding: options.targetActiveBinding ?? null,
    membershipEvidence: [],
    bindingEvidence: [],
  };
  const initial = cloneState(committed);

  const transactionPort: CrossTenantTransferTransactionPort = {
    run: async (work) => {
      runCount += 1;
      const draft: CommittedState = {
        sourceMembership: cloneMembership(committed.sourceMembership),
        targetMembership: cloneMembership(committed.targetMembership),
        sourceActiveBinding: cloneBinding(committed.sourceActiveBinding),
        targetActiveBinding: cloneBinding(committed.targetActiveBinding),
        membershipEvidence: [...committed.membershipEvidence],
        bindingEvidence: [...committed.bindingEvidence],
      };
      const commandCalls = new Map<string, number>();

      const uow: MembershipCommandUnitOfWork = {
        lockCreateIdentity: async ({ tenantId }) => {
          operations.push(`lock_create:${tenantId}`);
        },
        lockMembershipByTenantUser: async ({ tenantId, userId }) => {
          operations.push(`lock_tenant_user:${tenantId}`);
          if (userId !== 'account-001') return null;
          if (tenantId === 'tenant-target') return draft.targetMembership;
          if (tenantId === 'tenant-source') return draft.sourceMembership;
          return null;
        },
        lockMembershipById: async ({ tenantId, membershipId }) => {
          operations.push(`lock_membership:${tenantId}`);
          if (
            tenantId === 'tenant-source' &&
            membershipId === 'membership-source'
          ) {
            return draft.sourceMembership;
          }
          if (
            tenantId === 'tenant-target' &&
            membershipId === 'membership-target'
          ) {
            return draft.targetMembership;
          }
          return null;
        },
        lockActiveBinding: async ({ tenantId, accountId }) => {
          operations.push(`lock_binding:${tenantId}`);
          if (accountId !== 'account-001') return null;
          if (tenantId === 'tenant-source') return draft.sourceActiveBinding;
          if (tenantId === 'tenant-target') return draft.targetActiveBinding;
          return null;
        },
        lockBindingById: async () => null,
        commandExists: async ({ tenantId }) => {
          operations.push(`command_exists:${tenantId}`);
          const nextCount = (commandCalls.get(tenantId) ?? 0) + 1;
          commandCalls.set(tenantId, nextCount);
          return (
            options.blockSourceOwnerWithReplay === true &&
            tenantId === 'tenant-source' &&
            nextCount >= 2
          );
        },
        insertMembership: async (current) => {
          operations.push(`insert_membership:${current.tenantId}`);
          if (current.tenantId === 'tenant-target') {
            draft.targetMembership = { ...current };
          }
          return 1;
        },
        updateMembershipByCas: async ({ next }) => {
          operations.push(`update_membership:${next.tenantId}`);
          if (next.tenantId === 'tenant-source') {
            draft.sourceMembership = { ...next };
          }
          return 1;
        },
        insertActiveBinding: async (row) => {
          operations.push(`insert_binding:${row.tenantId}`);
          const nextBinding: ActiveMembershipBinding = {
            bindingId: row.bindingId,
            accountId: row.accountId,
            tenantId: row.tenantId,
            institutionId: row.institutionId,
            source: row.source,
            assignedBy: row.assignedBy,
            assignedAt: row.assignedAt,
            expiresAt: row.expiresAt,
            version: 1,
            createdAt: row.recordedAt,
            updatedAt: row.recordedAt,
          };
          if (row.tenantId === 'tenant-target') {
            draft.targetActiveBinding = nextBinding;
          }
          return 1;
        },
        revokeActiveBindingByCas: async ({ binding: lockedBinding }) => {
          operations.push(`revoke_binding:${lockedBinding.tenantId}`);
          if (lockedBinding.tenantId === 'tenant-source') {
            draft.sourceActiveBinding = null;
          }
          return 1;
        },
        appendBindingTransition: async (transition) => {
          operations.push(`binding_evidence:${transition.tenantId}`);
          draft.bindingEvidence.push(transition);
          return 1;
        },
        appendTransition: async (transition) => {
          operations.push(`membership_evidence:${transition.tenantId}`);
          draft.membershipEvidence.push(transition);
          return 1;
        },
      };

      const scopeAssertion = {
        assertActive: vi.fn(
          async ({
            tenantId,
            institutionId,
          }: Readonly<{ tenantId: string; institutionId: string }>) => {
            operations.push(`scope:${tenantId}`);
            if (options.scopeCode) {
              return {
                kind: 'rejected' as const,
                code: options.scopeCode,
              };
            }
            return {
              kind: 'active_scope' as const,
              tenantId,
              institutionId,
              revision: 9,
            };
          },
        ),
      };

      try {
        const result = await work({
          unitOfWork: uow,
          scopeAssertion,
          lockTransferAccount: async ({ accountId }) => {
            operations.push(`account_lock:${accountId}`);
          },
        });
        committed.sourceMembership = draft.sourceMembership;
        committed.targetMembership = draft.targetMembership;
        committed.sourceActiveBinding = draft.sourceActiveBinding;
        committed.targetActiveBinding = draft.targetActiveBinding;
        committed.membershipEvidence = draft.membershipEvidence;
        committed.bindingEvidence = draft.bindingEvidence;
        return result;
      } catch (error) {
        operations.push('rollback');
        throw error;
      }
    },
  };

  const service = createCrossTenantTransferService({
    transactionPort,
    createCommandId: () => COMMAND_ID,
    now: () => NOW,
  });

  return {
    service,
    committed,
    initial,
    operations,
    getRunCount: () => runCount,
  };
}

describe('BASE-B5 cross-tenant transfer application service', () => {
  it('以同一外层事务完成 target create + source revoke，并复用同一 command evidence correlation', async () => {
    const test = harness();

    const result = await test.service.execute(intent());

    expect(result.status).toBe('applied');
    if (result.status !== 'applied') throw new Error('expected applied');

    expect(test.operations[0]).toBe('account_lock:account-001');
    expect(test.committed.sourceMembership?.lifecycleStatus).toBe('revoked');
    expect(test.committed.sourceMembership?.revision).toBe(5);
    expect(test.committed.sourceActiveBinding).toBeNull();
    expect(test.committed.targetMembership?.lifecycleStatus).toBe('active');
    expect(test.committed.targetMembership?.revision).toBe(1);
    expect(test.committed.targetMembership?.role).toBe('tenant_operator');
    expect(test.committed.targetMembership?.displayName).toBe('运营成员');
    expect(test.committed.targetActiveBinding).toMatchObject({
      bindingId: 'binding-target',
      tenantId: 'tenant-target',
      institutionId: 'institution-target',
      accountId: 'account-001',
      source: 'manual_admin',
      version: 1,
    });

    expect(test.committed.membershipEvidence).toHaveLength(2);
    expect(test.committed.bindingEvidence).toHaveLength(2);
    expect([
      ...test.committed.membershipEvidence,
      ...test.committed.bindingEvidence,
    ].every((evidence) => evidence.commandId === COMMAND_ID)).toBe(true);

    expect(result.source).toEqual({
      membershipId: 'membership-source',
      membershipRevision: 5,
      lifecycleStatus: 'revoked',
      bindingId: 'binding-source',
      bindingVersion: 8,
    });
    expect(result.target).toEqual({
      membershipId: 'membership-target',
      membershipRevision: 1,
      lifecycleStatus: 'active',
      bindingId: 'binding-target',
      bindingVersion: 1,
    });
  });

  it('同 tenant transfer 在进入 transaction 前 fail-closed', async () => {
    const test = harness();

    const result = await test.service.execute(
      intent({ targetTenantId: 'tenant-source' }),
    );

    expect(result).toEqual({
      status: 'blocked',
      commandId: null,
      code: 'transfer_same_tenant',
    });
    expect(test.getRunCount()).toBe(0);
  });

  const blockedCases: ReadonlyArray<
    readonly [
      string,
      ReturnType<typeof harness>,
      CrossTenantTransferIntent,
      string,
    ]
  > = [
    [
      'source membership revision stale',
      harness(),
      intent({ sourceExpectedMembershipRevision: 3 }),
      'transfer_source_membership_revision_stale',
    ],
    [
      'source binding version stale',
      harness(),
      intent({ sourceExpectedBindingVersion: 6 }),
      'transfer_source_binding_version_stale',
    ],
    [
      'source binding expired',
      harness({
        sourceActiveBinding: sourceBinding({
          expiresAt: '2026-08-07T13:59:59.000Z',
        }),
      }),
      intent(),
      'transfer_source_binding_expired',
    ],
    [
      'target membership conflict',
      harness({
        targetMembership: sourceMembership({
          membershipId: 'membership-target-existing',
          tenantId: 'tenant-target',
        }),
      }),
      intent(),
      'transfer_target_membership_conflict',
    ],
    [
      'target binding conflict',
      harness({ targetActiveBinding: targetBinding() }),
      intent(),
      'transfer_target_binding_conflict',
    ],
    [
      'target scope missing',
      harness({ scopeCode: 'scope_missing' }),
      intent(),
      'transfer_target_scope_missing',
    ],
  ];

  for (const [name, test, transferIntent, code] of blockedCases) {
    it(`${name} 时不发布任何 mutation`, async () => {
      const result = await test.service.execute(transferIntent);

      expect(result.status).toBe('blocked');
      if (result.status !== 'blocked') throw new Error('expected blocked');
      expect(result.code).toBe(code);
      expect(test.committed).toEqual(test.initial);
      expect(test.committed.membershipEvidence).toHaveLength(0);
      expect(test.committed.bindingEvidence).toHaveLength(0);
    });
  }

  it('target Owner 已 staging 后 source Owner blocked 时必须由 outer transaction 整体 rollback', async () => {
    const test = harness({ blockSourceOwnerWithReplay: true });

    const result = await test.service.execute(intent());

    expect(result).toEqual({
      status: 'blocked',
      commandId: COMMAND_ID,
      code: 'transfer_owner_result_invalid',
    });
    expect(test.operations).toContain('insert_membership:tenant-target');
    expect(test.operations).toContain('rollback');
    expect(test.committed.sourceMembership?.lifecycleStatus).toBe('active');
    expect(test.committed.sourceActiveBinding).not.toBeNull();
    expect(test.committed.targetMembership).toBeNull();
    expect(test.committed.targetActiveBinding).toBeNull();
    expect(test.committed.membershipEvidence).toHaveLength(0);
    expect(test.committed.bindingEvidence).toHaveLength(0);
  });

  it('COMMIT outcome unknown 返回专用状态且 application 不自动 retry', async () => {
    const transactionPort: CrossTenantTransferTransactionPort = {
      run: vi.fn(async () => {
        throw new CrossTenantTransferTransactionError(
          'transfer_outcome_unknown',
        );
      }),
    };
    const service = createCrossTenantTransferService({
      transactionPort,
      createCommandId: () => COMMAND_ID,
      now: () => NOW,
    });

    const result = await service.execute(intent());

    expect(result).toEqual({
      status: 'outcome_unknown',
      commandId: COMMAND_ID,
      code: 'transfer_outcome_unknown',
    });
    expect(transactionPort.run).toHaveBeenCalledTimes(1);
  });
});
