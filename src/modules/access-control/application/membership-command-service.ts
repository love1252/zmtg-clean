import { randomBytes } from 'node:crypto';

import {
  decideMembershipLifecycle,
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

export const AUTH_BINDING_MAX_VERSION = 2_147_483_647;

export type MembershipCommandBlockCode =
  | MembershipLifecycleBlockCode
  | MembershipCommandPersistenceErrorCode
  | 'binding_version_exhausted'
  | 'binding_version_invalid'
  | 'binding_active_conflict';

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
  return command.kind === 'revoke' || command.kind === 'delete';
}

function persistenceBlockCode(error: unknown): MembershipCommandBlockCode {
  if (error instanceof MembershipCommandPersistenceError) {
    return error.code;
  }
  return 'membership_command_repository_unavailable';
}

/**
 * 在调用方已经开启的外层事务中执行 Owner command。
 *
 * 此入口绝不创建事务。任何写阶段错误会抛出固定低敏错误，调用方必须让该错误
 * 穿透外层事务以触发整批回滚；不得捕获后继续提交。
 */
export async function executeMembershipCommandWithUnitOfWork(input: Readonly<{
  unitOfWork: MembershipCommandUnitOfWork;
  command: MembershipOwnerCommand;
  createTransitionId?: () => string;
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

  const recordedAt = (input.now ?? (() => new Date()))().toISOString();
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
      revision: decision.current.revision as number,
      lifecycleStatus: decision.current.lifecycleStatus as
        | 'active'
        | 'revoked'
        | 'deleted',
      role: decision.current.role,
      commandPersisted: false,
    });
  }

  if (decision.bindingAction.kind === 'create') {
    activeBinding = await input.unitOfWork.lockActiveBinding({
      tenantId: decision.bindingAction.tenantId,
      accountId: decision.bindingAction.accountId,
    });
  } else if (
    decision.bindingAction.kind === 'revoke_active' &&
    current !== null &&
    requiresActiveBindingLock(input.command)
  ) {
    activeBinding = await input.unitOfWork.lockActiveBinding({
      tenantId: current.tenantId,
      accountId: current.userId,
    });
  }

  if (decision.bindingAction.kind === 'create' && activeBinding !== null) {
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

  if (input.command.kind === 'create') {
    requireOneAffected(
      await input.unitOfWork.insertMembership(decision.nextCurrent),
    );
  } else {
    requireOneAffected(
      await input.unitOfWork.updateMembershipByCas({
        previous: current!,
        next: decision.nextCurrent,
        expectedRevision: input.command.expectedRevision,
        expectedLifecycleStatus: current!.lifecycleStatus as
          | 'active'
          | 'revoked'
          | 'deleted',
      }),
    );
  }

  let bindingResult: Extract<MembershipCommandResult, { status: 'applied' }>['binding'] = {
    kind: 'unchanged',
  };
  if (decision.bindingAction.kind === 'create') {
    requireOneAffected(
      await input.unitOfWork.insertActiveBinding(decision.bindingAction),
    );
    bindingResult = { kind: 'created', version: 1 };
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
  }

  requireOneAffected(
    await input.unitOfWork.appendTransition(decision.transition),
  );

  return Object.freeze({
    status: 'applied',
    commandId: input.command.commandId,
    transitionId: decision.transition.transitionId,
    membershipId: decision.nextCurrent.membershipId,
    revision: decision.nextCurrent.revision as number,
    lifecycleStatus: decision.nextCurrent.lifecycleStatus as
      | 'active'
      | 'revoked'
      | 'deleted',
    role: decision.nextCurrent.role,
    binding: Object.freeze(bindingResult),
  });
}

export function createMembershipCommandService(input: Readonly<{
  transactionPort: MembershipCommandTransactionPort;
  createTransitionId?: () => string;
  now?: () => Date;
}>): Readonly<{
  execute(command: MembershipOwnerCommand): Promise<MembershipCommandResult>;
}> {
  return Object.freeze({
    execute: async (command: MembershipOwnerCommand): Promise<MembershipCommandResult> => {
      try {
        return await input.transactionPort.run((unitOfWork) =>
          executeMembershipCommandWithUnitOfWork({
            unitOfWork,
            command,
            createTransitionId: input.createTransitionId,
            now: input.now,
          }),
        );
      } catch (error) {
        return blocked(persistenceBlockCode(error));
      }
    },
  });
}
