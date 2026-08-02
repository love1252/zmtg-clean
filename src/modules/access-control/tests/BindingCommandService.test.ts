import { describe, expect, it, vi } from 'vitest';

import {
  createBindingCommandId,
  createBindingCommandService,
  createBindingTransitionId,
  executeBindingCommandWithUnitOfWork,
  type BindingCommandBlockCode,
} from '@/modules/access-control/application/binding-command-service';
import type {
  BindingCurrent,
  BindingOwnerCommand,
} from '@/modules/access-control/domain/binding-lifecycle';
import type { CompleteMembershipCurrent } from '@/modules/access-control/domain/membership-lifecycle';
import type {
  ActiveMembershipBinding,
  MembershipCommandTransactionPort,
  MembershipCommandUnitOfWork,
} from '@/modules/access-control/ports/membership-command-unit-of-work';
import type { TransactionBoundInstitutionScopeAssertion } from '@/modules/tenancy/ports/transaction-bound-institution-scope';

const COMMAND_ID = `bcmd1_${'A'.repeat(43)}`;
const TRANSITION_ID = `btr1_${'E'.repeat(43)}`;
const NOW = new Date('2026-08-03T02:00:00.000Z');

function membership(
  overrides: Partial<CompleteMembershipCurrent> = {},
): CompleteMembershipCurrent {
  return {
    membershipId: 'member-001',
    tenantId: 'tenant-001',
    userId: 'user-001',
    role: 'tenant_admin',
    displayName: '受控管理员',
    revision: 4,
    lifecycleStatus: 'active',
    provenanceSource: 'access_control_command',
    provenanceActorId: 'actor-001',
    provenanceReasonCode: 'membership_refresh',
    provenanceCommandId: `mcmd1_${'I'.repeat(43)}`,
    provenanceOccurredAt: '2026-08-03T00:00:00.000Z',
    provenanceRecordedAt: '2026-08-03T00:00:01.000Z',
    revokedAt: null,
    deletedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:01.000Z',
    ...overrides,
  };
}

function binding(
  overrides: Partial<BindingCurrent> = {},
): BindingCurrent {
  return {
    bindingId: 'binding-001',
    accountId: 'user-001',
    tenantId: 'tenant-001',
    institutionId: 'institution-001',
    status: 'active',
    source: 'manual_admin',
    assignedBy: 'actor-001',
    assignedAt: '2026-08-01T00:00:00.000Z',
    expiresAt: null,
    revokedAt: null,
    version: 8,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function activeBinding(value: BindingCurrent): ActiveMembershipBinding {
  return {
    bindingId: value.bindingId,
    accountId: value.accountId,
    tenantId: value.tenantId,
    institutionId: value.institutionId,
    source: value.source,
    assignedBy: value.assignedBy,
    assignedAt: value.assignedAt,
    expiresAt: value.expiresAt,
    version: value.version,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function createCommand(
  overrides: Record<string, unknown> = {},
): BindingOwnerCommand {
  return {
    kind: 'create',
    commandId: COMMAND_ID,
    tenantId: 'tenant-001',
    membershipId: 'member-001',
    accountId: 'user-001',
    expectedMembershipRevision: 4,
    bindingId: 'binding-002',
    institutionId: 'institution-002',
    assignmentSource: 'system',
    provenanceSource: 'access_control_command',
    actorId: 'actor-002',
    reasonCode: 'binding_create',
    occurredAt: '2026-08-03T01:00:00.000Z',
    expiresAt: null,
    ...overrides,
  } as BindingOwnerCommand;
}

function command(
  kind: 'rebind' | 'revoke' | 'expire',
  overrides: Record<string, unknown> = {},
): BindingOwnerCommand {
  const common = {
    kind,
    commandId: COMMAND_ID,
    tenantId: 'tenant-001',
    membershipId: 'member-001',
    accountId: 'user-001',
    expectedMembershipRevision: 4,
    bindingId: 'binding-001',
    expectedBindingVersion: 8,
  };
  if (kind === 'rebind') {
    return {
      ...common,
      replacementBindingId: 'binding-002',
      institutionId: 'institution-002',
      assignmentSource: 'system',
      actorId: 'actor-002',
      reasonCode: 'binding_rebind',
      occurredAt: '2026-08-03T01:00:00.000Z',
      expiresAt: null,
      ...overrides,
    } as BindingOwnerCommand;
  }
  if (kind === 'revoke') {
    return {
      ...common,
      actorId: 'actor-002',
      reasonCode: 'binding_revoke',
      occurredAt: '2026-08-03T01:00:00.000Z',
      ...overrides,
    } as BindingOwnerCommand;
  }
  return { ...common, ...overrides } as BindingOwnerCommand;
}

const scopeAssertion: TransactionBoundInstitutionScopeAssertion = {
  assertActive: vi.fn(async ({ tenantId, institutionId }) => ({
    kind: 'active_scope' as const,
    tenantId,
    institutionId,
    revision: 9,
  })),
};

function context(input: {
  currentMembership?: CompleteMembershipCurrent | null;
  currentBinding?: BindingCurrent | null;
  active?: ActiveMembershipBinding | null;
  commandExists?: boolean;
  appendBindingAffected?: number;
} = {}) {
  const operations: string[] = [];
  const record = <T extends unknown[], R>(name: string, value: R) =>
    vi.fn(async (..._args: T): Promise<R> => {
      operations.push(name);
      return value;
    });
  const currentBinding = input.currentBinding === undefined
    ? binding()
    : input.currentBinding;
  const uow: MembershipCommandUnitOfWork = {
    lockCreateIdentity: record('lock_create_identity', undefined),
    lockMembershipByTenantUser: record('lock_membership_by_user', null),
    lockMembershipById: record(
      'lock_membership',
      input.currentMembership === undefined ? membership() : input.currentMembership,
    ),
    lockActiveBinding: record(
      'lock_active_binding',
      input.active === undefined ? null : input.active,
    ),
    lockBindingById: record('lock_binding', currentBinding),
    commandExists: record('command_exists', input.commandExists ?? false),
    insertMembership: record('insert_membership', 1),
    updateMembershipByCas: record('update_membership', 1),
    insertActiveBinding: record('insert_binding', 1),
    revokeActiveBindingByCas: record('revoke_binding', 1),
    appendBindingTransition: record(
      'append_binding_transition',
      input.appendBindingAffected ?? 1,
    ),
    appendTransition: record('append_membership_transition', 1),
  };
  return { uow, operations };
}

const dependencies = {
  createTransitionId: () => TRANSITION_ID,
  now: () => NOW,
};

describe('Binding command service', () => {
  it('生成 canonical command/evidence identity', () => {
    expect(createBindingCommandId()).toMatch(/^bcmd1_[A-Za-z0-9_-]{43}$/u);
    expect(createBindingTransitionId()).toMatch(/^btr1_[A-Za-z0-9_-]{43}$/u);
  });

  it('create 固定 Membership→active Binding→Scope→insert→evidence 顺序', async () => {
    const state = context();
    const result = await executeBindingCommandWithUnitOfWork({
      unitOfWork: state.uow,
      scopeAssertion,
      command: createCommand(),
      ...dependencies,
    });
    expect(result).toEqual({
      status: 'applied',
      commandId: COMMAND_ID,
      transitionId: TRANSITION_ID,
      bindingId: 'binding-002',
      replacementBindingId: null,
      bindingStatus: 'active',
      bindingVersion: 1,
      membershipRevision: 4,
    });
    expect(state.operations).toEqual([
      'lock_membership',
      'command_exists',
      'lock_active_binding',
      'insert_binding',
      'append_binding_transition',
    ]);
    expect(state.uow.appendBindingTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        transitionType: 'create',
        toVersion: 1,
        membershipRevision: 4,
        scopeRevision: 9,
      }),
    );
  });

  it('rebind 固定 revoke-old + create-new + 单条 lineage evidence', async () => {
    const old = binding();
    const state = context({ currentBinding: old });
    const result = await executeBindingCommandWithUnitOfWork({
      unitOfWork: state.uow,
      scopeAssertion,
      command: command('rebind'),
      ...dependencies,
    });
    expect(result).toMatchObject({
      status: 'applied',
      bindingId: 'binding-001',
      replacementBindingId: 'binding-002',
      bindingStatus: 'revoked',
      bindingVersion: 9,
    });
    expect(state.operations).toEqual([
      'lock_membership',
      'command_exists',
      'lock_binding',
      'revoke_binding',
      'insert_binding',
      'append_binding_transition',
    ]);
    expect(state.uow.appendBindingTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        transitionType: 'rebind',
        bindingId: 'binding-001',
        replacementBindingId: 'binding-002',
        fromVersion: 8,
        toVersion: 9,
        scopeRevision: 9,
      }),
    );
  });

  it('revoke 与 expire 使用独立 version CAS；expire 使用可信服务端时间', async () => {
    const revokeState = context({ currentBinding: binding() });
    expect(await executeBindingCommandWithUnitOfWork({
      unitOfWork: revokeState.uow,
      command: command('revoke'),
      ...dependencies,
    })).toMatchObject({
      status: 'applied',
      bindingStatus: 'revoked',
      bindingVersion: 9,
    });

    const expired = binding({
      expiresAt: '2026-08-03T01:30:00.000Z',
    });
    const expireState = context({ currentBinding: expired });
    expect(await executeBindingCommandWithUnitOfWork({
      unitOfWork: expireState.uow,
      command: command('expire'),
      ...dependencies,
    })).toMatchObject({
      status: 'applied',
      bindingStatus: 'revoked',
      bindingVersion: 9,
    });
    expect(expireState.uow.revokeActiveBindingByCas).toHaveBeenCalledWith(
      expect.objectContaining({
        revokedAt: '2026-08-03T01:30:00.000Z',
        recordedAt: NOW.toISOString(),
      }),
    );
    expect(expireState.uow.appendBindingTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        transitionType: 'expire',
        actorId: 'system',
        reasonCode: 'binding_expired',
        occurredAt: '2026-08-03T01:30:00.000Z',
      }),
    );
  });

  const failureCases: Array<[
    string,
    Parameters<typeof context>[0],
    BindingOwnerCommand,
    BindingCommandBlockCode,
  ]> = [
    ['replay', { commandExists: true }, createCommand(), 'command_replay_rejected'],
    ['membership missing', { currentMembership: null }, createCommand(), 'binding_membership_not_found'],
    [
      'membership inactive',
      {
        currentMembership: membership({
          revision: 5,
          lifecycleStatus: 'revoked',
          provenanceReasonCode: 'membership_revoke',
          provenanceCommandId: `mcmd1_${'Q'.repeat(43)}`,
          provenanceOccurredAt: '2026-08-03T00:00:00.000Z',
          provenanceRecordedAt: '2026-08-03T00:00:01.000Z',
          revokedAt: '2026-08-03T00:00:00.000Z',
          updatedAt: '2026-08-03T00:00:01.000Z',
        }),
      },
      createCommand(),
      'binding_membership_inactive',
    ],
    [
      'duplicate active',
      { active: activeBinding(binding()) },
      createCommand(),
      'binding_active_conflict',
    ],
    [
      'rebind same institution',
      { currentBinding: binding() },
      command('rebind', { institutionId: 'institution-001' }),
      'binding_rebind_same_institution',
    ],
    [
      'expire too early',
      { currentBinding: binding({ expiresAt: '2026-08-03T03:00:00.000Z' }) },
      command('expire'),
      'binding_not_expired',
    ],
  ];

  it.each(failureCases)('%s fail-closed 且零 mutation', async (
    _label,
    setup,
    ownerCommand,
    code,
  ) => {
    const state = context(setup);
    expect(await executeBindingCommandWithUnitOfWork({
      unitOfWork: state.uow,
      scopeAssertion,
      command: ownerCommand,
      ...dependencies,
    })).toEqual({ status: 'blocked', code });
    expect(state.uow.insertActiveBinding).not.toHaveBeenCalled();
    expect(state.uow.revokeActiveBindingByCas).not.toHaveBeenCalled();
    expect(state.uow.appendBindingTransition).not.toHaveBeenCalled();
  });

  it('evidence affected rows 非 1 时由唯一外层事务失败且不重试', async () => {
    const state = context({ appendBindingAffected: 0 });
    let attempts = 0;
    const transactionPort: MembershipCommandTransactionPort = {
      run: vi.fn(async (work) => {
        attempts += 1;
        return work(state.uow, scopeAssertion);
      }),
    };
    const service = createBindingCommandService({
      transactionPort,
      ...dependencies,
    });
    expect(await service.execute(createCommand())).toEqual({
      status: 'blocked',
      code: 'membership_command_affected_rows_invalid',
    });
    expect(attempts).toBe(1);
    expect(transactionPort.run).toHaveBeenCalledTimes(1);
  });
});
