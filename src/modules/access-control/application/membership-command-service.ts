import { randomBytes } from 'node:crypto';

import { createBindingTransitionId } from '@/modules/access-control/application/binding-command-service';
import type { BindingTransitionEvidence } from '@/modules/access-control/domain/binding-lifecycle';
import {
  decideMembershipLifecycle,
  isCompleteMembershipCurrent,
  validateMembershipOwnerCommandIdentity,
  type MembershipLifecycleBlockCode,
  type MembershipOwnerCommand,
} from '@/modules/access-control/domain/membership-lifecycle';
import {
  MembershipCommandPersistenceError,
  type ActiveMembershipBinding,
  type MembershipCommandPersistenceErrorCode,
  type MembershipCommandTransactionPort,
  type MembershipCommandUnitOfWork,
} from '@/modules/access-control/ports/membership-command-unit-of-work';
import type {
  TransactionBoundInstitutionScopeAssertion,
  TransactionBoundInstitutionScopeResolution,
} from '@/modules/tenancy/ports/transaction-bound-institution-scope';

export const AUTH_BINDING_MAX_VERSION = 2_147_483_647;

export type MembershipCommandBlockCode =
  | MembershipLifecycleBlockCode
  | MembershipCommandPersistenceErrorCode
  | 'binding_version_exhausted'
  | 'binding_version_invalid'
  | 'binding_active_conflict'
  | 'binding_scope_denied'
  | 'binding_scope_invalid'
  | 'binding_scope_unavailable';

export type MembershipCommandResult =
  | Readonly<{
      status: 'applied';
      commandId: string;
      transitionId: string;
      membershipId: string;
      revision: number;
      lifecycleStatus: 'active' | 'revoked' | 'deleted';
      role: string;
      binding:
        | Readonly<{ kind: 'unchanged' }>
        | Readonly<{ kind: 'created'; version: 1 }>
        | Readonly<{ kind: 'revoked'; version: number }>;
    }>
  | Readonly<{
      status: 'observed';
      commandId: string;
      membershipId: string;
      revision: number;
      lifecycleStatus: 'active' | 'revoked' | 'deleted';
      role: string;
      commandPersisted: false;
    }>
  | Readonly<{ status: 'blocked'; code: MembershipCommandBlockCode }>;

const ID_PAYLOAD_BYTES = 32;

function createRandomIdentifier(prefix: 'mcmd1_' | 'mtr1_'): string {
  return `${prefix}${randomBytes(ID_PAYLOAD_BYTES).toString('base64url')}`;
}

export function createMembershipCommandId(): string {
  return createRandomIdentifier('mcmd1_');
}

export function createMembershipTransitionId(): string {
  return createRandomIdentifier('mtr1_');
}

function blocked(code: MembershipCommandBlockCode): MembershipCommandResult {
  return Object.freeze({ status: 'blocked', code });
}

function requireOneAffected(value: number): void {
  if (value !== 1) {
    throw new MembershipCommandPersistenceError(
      'membership_command_affected_rows_invalid',
    );
  }
}

function requiresActiveBindingLock(command: MembershipOwnerCommand): boolean {
  return (
    command.kind === 'revoke' ||
    command.kind === 'reactivate' ||
    command.kind === 'delete'
  );
}

function persistenceBlockCode(error: unknown): MembershipCommandBlockCode {
  if (error instanceof MembershipCommandPersistenceError) {
    return error.code;
  }
  return 'membership_command_repository_unavailable';
}

function scopeBlockCode(
  resolution: TransactionBoundInstitutionScopeResolution,
): MembershipCommandBlockCode | null {
  if (resolution.kind === 'active_scope') return null;
  if (resolution.code === 'scope_missing' || resolution.code === 'scope_inactive') {
    return 'binding_scope_denied';
  }
  if (resolution.code === 'scope_invalid') return 'binding_scope_invalid';
  return 'binding_scope_unavailable';
}

/**
 * 在调用方已经开启的外层事务中执行 Owner command。
 *
 * 此入口绝不创建事务。任何写阶段错误会抛出固定低敏错误，调用方必须让该错误
 * 穿透外层事务以触发整批回滚；不得捕获后继续提交。
 */
export async function executeMembershipCommandWithUnitOfWork(input: Readonly<{
  unitOfWork: MembershipCommandUnitOfWork;
  scopeAssertion?: TransactionBoundInstitutionScopeAssertion;
  command: MembershipOwnerCommand;
  createTransitionId?: () => string;
  createBindingTransitionId?: () => string;
  now?: () => Date;
}>): Promise<MembershipCommandResult> {
  const commandError = validateMembershipOwnerCommandIdentity(input.command);
  if (commandError) return blocked(commandError);

  let current = null;
  let activeBinding: ActiveMembershipBinding | null = null;

  if (input.command.kind === 'create') {
    await input.unitOfWork.lockCreateIdentity({
      tenantId: input.command.tenantId,
      userId: input.command.userId,
    });
    current = await input.unitOfWork.lockMembershipByTenantUser({
      tenantId: input.command.tenantId,
      userId: input.command.userId,
    });
  } else {
    current = await input.unitOfWork.lockMembershipById({
      tenantId: input.command.tenantId,
      membershipId: input.command.membershipId,
    });
  }

  if (
    await input.unitOfWork.commandExists({
      tenantId: input.command.tenantId,
      commandId: input.command.commandId,
    })
  ) {
    return blocked('command_replay_rejected');
  }

  let recordedAt: string;
  try {
    recordedAt = (input.now ?? (() => new Date()))().toISOString();
  } catch {
    return blocked('membership_command_time_invalid');
  }
  const transitionId = (input.createTransitionId ?? createMembershipTransitionId)();
  const decision = decideMembershipLifecycle({
    current,
    command: input.command,
    transitionId,
    recordedAt,
  });
  if (decision.kind === 'blocked') return blocked(decision.code);
  if (decision.kind === 'observed') {
    return Object.freeze({
      status: 'observed',
      commandId: input.command.commandId,
      membershipId: decision.current.membershipId,
      revision: decision.current.revision,
      lifecycleStatus: decision.current.lifecycleStatus,
      role: decision.current.role,
      commandPersisted: false,
    });
  }

  let scopeRevision: number | null = null;

  if (decision.bindingAction.kind === 'create') {
    activeBinding = await input.unitOfWork.lockActiveBinding({
      tenantId: decision.bindingAction.tenantId,
      accountId: decision.bindingAction.accountId,
    });
  } else if (current !== null && requiresActiveBindingLock(input.command)) {
    activeBinding = await input.unitOfWork.lockActiveBinding({
      tenantId: current.tenantId,
      accountId: current.userId,
    });
  }

  if (decision.bindingAction.kind === 'create' && activeBinding !== null) {
    return blocked('binding_active_conflict');
  }
  if (input.command.kind === 'reactivate' && activeBinding !== null) {
    return blocked('binding_active_conflict');
  }
  if (
    decision.bindingAction.kind === 'revoke_active' &&
    activeBinding !== null
  ) {
    if (!Number.isSafeInteger(activeBinding.version) || activeBinding.version < 1) {
      return blocked('binding_version_invalid');
    }
    if (activeBinding.version >= AUTH_BINDING_MAX_VERSION) {
      return blocked('binding_version_exhausted');
    }
  }

  if (decision.bindingAction.kind === 'create') {
    if (!input.scopeAssertion) return blocked('binding_scope_unavailable');
    const resolution = await input.scopeAssertion.assertActive({
      tenantId: decision.bindingAction.tenantId,
      institutionId: decision.bindingAction.institutionId,
    });
    const scopeError = scopeBlockCode(resolution);
    if (scopeError) return blocked(scopeError);
    if (resolution.kind !== 'active_scope') {
      return blocked('binding_scope_invalid');
    }
    scopeRevision = resolution.revision;
  }

  if (input.command.kind === 'create') {
    requireOneAffected(
      await input.unitOfWork.insertMembership(decision.nextCurrent),
    );
  } else {
    if (current === null || !isCompleteMembershipCurrent(current)) {
      return blocked('membership_current_envelope_invalid');
    }
    requireOneAffected(
      await input.unitOfWork.updateMembershipByCas({
        previous: current,
        next: decision.nextCurrent,
        expectedRevision: input.command.expectedRevision,
        expectedLifecycleStatus: current.lifecycleStatus,
      }),
    );
  }

  let bindingResult: Extract<MembershipCommandResult, { status: 'applied' }>['binding'] = {
    kind: 'unchanged',
  };
  let bindingEvidence: BindingTransitionEvidence | null = null;

  if (decision.bindingAction.kind === 'create') {
    requireOneAffected(
      await input.unitOfWork.insertActiveBinding(decision.bindingAction),
    );
    bindingResult = { kind: 'created', version: 1 };
    bindingEvidence = Object.freeze({
      transitionId: (
        input.createBindingTransitionId ?? createBindingTransitionId
      )(),
      tenantId: decision.bindingAction.tenantId,
      bindingId: decision.bindingAction.bindingId,
      replacementBindingId: null,
      commandId: input.command.commandId,
      transitionType: 'create',
      provenanceSource: decision.transition.source,
      assignmentSource: decision.bindingAction.source,
      actorId: decision.transition.actorId,
      reasonCode: decision.transition.reasonCode,
      fromStatus: null,
      toStatus: 'active',
      fromVersion: null,
      toVersion: 1,
      membershipRevision: decision.nextCurrent.revision,
      scopeRevision,
      occurredAt: decision.bindingAction.assignedAt,
      recordedAt: decision.bindingAction.recordedAt,
    });
  } else if (
    decision.bindingAction.kind === 'revoke_active' &&
    activeBinding !== null
  ) {
    requireOneAffected(
      await input.unitOfWork.revokeActiveBindingByCas({
        binding: activeBinding,
        revokedAt: input.command.occurredAt,
        recordedAt,
      }),
    );
    bindingResult = { kind: 'revoked', version: activeBinding.version + 1 };
    bindingEvidence = Object.freeze({
      transitionId: (
        input.createBindingTransitionId ?? createBindingTransitionId
      )(),
      tenantId: activeBinding.tenantId,
      bindingId: activeBinding.bindingId,
      replacementBindingId: null,
      commandId: input.command.commandId,
      transitionType: 'revoke',
      provenanceSource: 'access_control_command',
      assignmentSource: activeBinding.source,
      actorId: input.command.actorId,
      reasonCode: input.command.reasonCode,
      fromStatus: 'active',
      toStatus: 'revoked',
      fromVersion: activeBinding.version,
      toVersion: activeBinding.version + 1,
      membershipRevision: decision.nextCurrent.revision,
      scopeRevision: null,
      occurredAt: input.command.occurredAt,
      recordedAt,
    });
  }

  if (bindingEvidence !== null) {
    requireOneAffected(
      await input.unitOfWork.appendBindingTransition(bindingEvidence),
    );
  }

  requireOneAffected(
    await input.unitOfWork.appendTransition(decision.transition),
  );

  return Object.freeze({
    status: 'applied',
    commandId: input.command.commandId,
    transitionId: decision.transition.transitionId,
    membershipId: decision.nextCurrent.membershipId,
    revision: decision.nextCurrent.revision,
    lifecycleStatus: decision.nextCurrent.lifecycleStatus,
    role: decision.nextCurrent.role,
    binding: Object.freeze(bindingResult),
  });
}

export function createMembershipCommandService(input: Readonly<{
  transactionPort: MembershipCommandTransactionPort;
  createTransitionId?: () => string;
  createBindingTransitionId?: () => string;
  now?: () => Date;
}>): Readonly<{
  execute(command: MembershipOwnerCommand): Promise<MembershipCommandResult>;
}> {
  return Object.freeze({
    execute: async (command: MembershipOwnerCommand): Promise<MembershipCommandResult> => {
      try {
        return await input.transactionPort.run((unitOfWork, scopeAssertion) =>
          executeMembershipCommandWithUnitOfWork({
            unitOfWork,
            scopeAssertion,
            command,
            createTransitionId: input.createTransitionId,
            createBindingTransitionId: input.createBindingTransitionId,
            now: input.now,
          }),
        );
      } catch (error) {
        return blocked(persistenceBlockCode(error));
      }
    },
  });
}
