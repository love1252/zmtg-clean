import { randomBytes } from 'node:crypto';

import {
  BINDING_MAX_VERSION,
  isBindingCurrent,
  isCanonicalBindingInstant,
  validateBindingOwnerCommand,
  validateBindingOwnerCommandIdentity,
  type BindingCurrent,
  type BindingLifecycleBlockCode,
  type BindingOwnerCommand,
  type BindingTransitionEvidence,
} from '@/modules/access-control/domain/binding-lifecycle';
import {
  isCompleteMembershipCurrent,
  type CompleteMembershipCurrent,
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

export type BindingCommandBlockCode =
  | BindingLifecycleBlockCode
  | MembershipCommandPersistenceErrorCode;

export type BindingCommandResult =
  | Readonly<{
      status: 'applied';
      commandId: string;
      transitionId: string;
      bindingId: string;
      replacementBindingId: string | null;
      bindingStatus: 'active' | 'revoked';
      bindingVersion: number;
      membershipRevision: number;
    }>
  | Readonly<{ status: 'blocked'; code: BindingCommandBlockCode }>;

const ID_PAYLOAD_BYTES = 32;

function createRandomIdentifier(prefix: 'bcmd1_' | 'btr1_'): string {
  return `${prefix}${randomBytes(ID_PAYLOAD_BYTES).toString('base64url')}`;
}

export function createBindingCommandId(): string {
  return createRandomIdentifier('bcmd1_');
}

export function createBindingTransitionId(): string {
  return createRandomIdentifier('btr1_');
}

function blocked(code: BindingCommandBlockCode): BindingCommandResult {
  return Object.freeze({ status: 'blocked', code });
}

function requireOneAffected(value: number): void {
  if (value !== 1) {
    throw new MembershipCommandPersistenceError(
      'membership_command_affected_rows_invalid',
    );
  }
}

function persistenceBlockCode(error: unknown): BindingCommandBlockCode {
  if (error instanceof MembershipCommandPersistenceError) {
    return error.code;
  }
  return 'membership_command_repository_unavailable';
}

function safeNow(now: () => Date): string | null {
  try {
    const value = now();
    if (
      !(value instanceof Date) ||
      Number.isNaN(value.valueOf())
    ) {
      return null;
    }
    const canonical = value.toISOString();
    return isCanonicalBindingInstant(canonical) ? canonical : null;
  } catch {
    return null;
  }
}

function asActiveBinding(
  current: BindingCurrent,
): ActiveMembershipBinding | null {
  if (current.status !== 'active' || current.revokedAt !== null) return null;
  return Object.freeze({
    bindingId: current.bindingId,
    accountId: current.accountId,
    tenantId: current.tenantId,
    institutionId: current.institutionId,
    source: current.source,
    assignedBy: current.assignedBy,
    assignedAt: current.assignedAt,
    expiresAt: current.expiresAt,
    version: current.version,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
  });
}

function validateMembershipForBinding(
  current: CompleteMembershipCurrent | null,
  command: BindingOwnerCommand,
): BindingLifecycleBlockCode | null {
  if (current === null) return 'binding_membership_not_found';
  if (
    current.tenantId !== command.tenantId ||
    current.membershipId !== command.membershipId ||
    current.userId !== command.accountId
  ) {
    return 'binding_identity_mismatch';
  }
  if (current.lifecycleStatus !== 'active') {
    return 'binding_membership_inactive';
  }
  if (
    !Number.isSafeInteger(current.revision) ||
    current.revision < 1 ||
    current.revision > BINDING_MAX_VERSION
  ) {
    return 'binding_membership_revision_invalid';
  }
  if (current.revision !== command.expectedMembershipRevision) {
    return 'binding_membership_revision_stale';
  }
  return null;
}

function scopeBlockCode(
  resolution: TransactionBoundInstitutionScopeResolution,
): BindingLifecycleBlockCode | null {
  if (resolution.kind === 'active_scope') return null;
  if (resolution.code === 'scope_missing' || resolution.code === 'scope_inactive') {
    return 'binding_scope_denied';
  }
  if (resolution.code === 'scope_invalid') return 'binding_scope_invalid';
  return 'binding_scope_unavailable';
}

async function assertScope(input: Readonly<{
  scopeAssertion: TransactionBoundInstitutionScopeAssertion | undefined;
  tenantId: string;
  institutionId: string;
}>): Promise<
  | Readonly<{ kind: 'active_scope'; revision: number }>
  | Readonly<{ kind: 'blocked'; code: BindingLifecycleBlockCode }>
> {
  if (!input.scopeAssertion) {
    return Object.freeze({
      kind: 'blocked',
      code: 'binding_scope_unavailable',
    });
  }
  const resolution = await input.scopeAssertion.assertActive({
    tenantId: input.tenantId,
    institutionId: input.institutionId,
  });
  const code = scopeBlockCode(resolution);
  if (code) return Object.freeze({ kind: 'blocked', code });
  if (resolution.kind !== 'active_scope') {
    return Object.freeze({
      kind: 'blocked',
      code: 'binding_scope_invalid',
    });
  }
  return Object.freeze({
    kind: 'active_scope',
    revision: resolution.revision,
  });
}

function validateLockedBinding(
  value: BindingCurrent | null,
  command: Exclude<BindingOwnerCommand, { kind: 'create' }>,
): BindingLifecycleBlockCode | null {
  if (value === null) return 'binding_not_found';
  if (!isBindingCurrent(value)) return 'binding_current_envelope_invalid';
  if (
    value.bindingId !== command.bindingId ||
    value.tenantId !== command.tenantId ||
    value.accountId !== command.accountId
  ) {
    return 'binding_identity_mismatch';
  }
  if (value.status !== 'active' || value.revokedAt !== null) {
    return 'binding_not_active';
  }
  if (!Number.isSafeInteger(value.version) || value.version < 1) {
    return 'binding_version_invalid';
  }
  if (value.version !== command.expectedBindingVersion) {
    return 'binding_version_stale';
  }
  if (value.version >= BINDING_MAX_VERSION) {
    return 'binding_version_exhausted';
  }
  return null;
}

/**
 * 在调用方已经开启的唯一外层事务中执行 standalone Binding command。
 * 本入口不创建 transaction、不自动重试，也不捕获写阶段异常后继续提交。
 */
export async function executeBindingCommandWithUnitOfWork(input: Readonly<{
  unitOfWork: MembershipCommandUnitOfWork;
  scopeAssertion?: TransactionBoundInstitutionScopeAssertion;
  command: BindingOwnerCommand;
  createTransitionId?: () => string;
  now?: () => Date;
}>): Promise<BindingCommandResult> {
  const identityError = validateBindingOwnerCommandIdentity(input.command);
  if (identityError) return blocked(identityError);

  const membershipCandidate = await input.unitOfWork.lockMembershipById({
    tenantId: input.command.tenantId,
    membershipId: input.command.membershipId,
  });

  if (
    await input.unitOfWork.commandExists({
      tenantId: input.command.tenantId,
      commandId: input.command.commandId,
    })
  ) {
    return blocked('command_replay_rejected');
  }

  const commandError = validateBindingOwnerCommand(input.command);
  if (commandError) return blocked(commandError);

  if (
    membershipCandidate !== null &&
    !isCompleteMembershipCurrent(membershipCandidate)
  ) {
    return blocked('binding_current_envelope_invalid');
  }
  const membership = membershipCandidate === null
    ? null
    : membershipCandidate;
  const membershipError = validateMembershipForBinding(
    membership,
    input.command,
  );
  if (membershipError) return blocked(membershipError);
  if (membership === null) return blocked('binding_membership_not_found');

  const recordedAt = safeNow(input.now ?? (() => new Date()));
  if (recordedAt === null) return blocked('binding_command_time_invalid');

  let currentBinding: BindingCurrent | null = null;
  let activeBinding: ActiveMembershipBinding | null = null;
  let scopeRevision: number | null = null;

  if (input.command.kind === 'create') {
    activeBinding = await input.unitOfWork.lockActiveBinding({
      tenantId: input.command.tenantId,
      accountId: input.command.accountId,
    });
    if (activeBinding !== null) return blocked('binding_active_conflict');
    if (input.command.occurredAt > recordedAt) {
      return blocked('binding_command_time_invalid');
    }
    const scope = await assertScope({
      scopeAssertion: input.scopeAssertion,
      tenantId: input.command.tenantId,
      institutionId: input.command.institutionId,
    });
    if (scope.kind === 'blocked') return blocked(scope.code);
    scopeRevision = scope.revision;
  } else {
    currentBinding = await input.unitOfWork.lockBindingById({
      tenantId: input.command.tenantId,
      bindingId: input.command.bindingId,
    });
    const lockedError = validateLockedBinding(currentBinding, input.command);
    if (lockedError) return blocked(lockedError);
    if (currentBinding === null) return blocked('binding_not_found');
    activeBinding = asActiveBinding(currentBinding);
    if (activeBinding === null) return blocked('binding_not_active');

    if (
      input.command.kind !== 'expire' &&
      currentBinding.expiresAt !== null &&
      currentBinding.expiresAt <= recordedAt
    ) {
      return blocked('binding_expired');
    }

    if (input.command.kind === 'rebind') {
      if (input.command.institutionId === currentBinding.institutionId) {
        return blocked('binding_rebind_same_institution');
      }
      if (input.command.occurredAt > recordedAt) {
        return blocked('binding_command_time_invalid');
      }
      const scope = await assertScope({
        scopeAssertion: input.scopeAssertion,
        tenantId: input.command.tenantId,
        institutionId: input.command.institutionId,
      });
      if (scope.kind === 'blocked') return blocked(scope.code);
      scopeRevision = scope.revision;
    } else if (input.command.kind === 'revoke') {
      if (input.command.occurredAt > recordedAt) {
        return blocked('binding_command_time_invalid');
      }
    } else {
      if (currentBinding.expiresAt === null) {
        return blocked('binding_expiry_missing');
      }
      if (currentBinding.expiresAt > recordedAt) {
        return blocked('binding_not_expired');
      }
    }
  }

  const transitionId = (
    input.createTransitionId ?? createBindingTransitionId
  )();

  let transition: BindingTransitionEvidence;
  const resultBindingId = input.command.bindingId;
  let replacementBindingId: string | null = null;
  let resultStatus: 'active' | 'revoked';
  let resultVersion: number;

  if (input.command.kind === 'create') {
    requireOneAffected(
      await input.unitOfWork.insertActiveBinding({
        bindingId: input.command.bindingId,
        accountId: input.command.accountId,
        tenantId: input.command.tenantId,
        institutionId: input.command.institutionId,
        source: input.command.assignmentSource,
        assignedBy: input.command.actorId,
        assignedAt: input.command.occurredAt,
        expiresAt: input.command.expiresAt,
        recordedAt,
      }),
    );
    transition = Object.freeze({
      transitionId,
      tenantId: input.command.tenantId,
      bindingId: input.command.bindingId,
      replacementBindingId: null,
      commandId: input.command.commandId,
      transitionType: 'create',
      provenanceSource: input.command.provenanceSource,
      assignmentSource: input.command.assignmentSource,
      actorId: input.command.actorId,
      reasonCode: input.command.reasonCode,
      fromStatus: null,
      toStatus: 'active',
      fromVersion: null,
      toVersion: 1,
      membershipRevision: membership.revision,
      scopeRevision,
      occurredAt: input.command.occurredAt,
      recordedAt,
    });
    resultStatus = 'active';
    resultVersion = 1;
  } else if (input.command.kind === 'rebind') {
    if (activeBinding === null) return blocked('binding_not_active');
    requireOneAffected(
      await input.unitOfWork.revokeActiveBindingByCas({
        binding: activeBinding,
        revokedAt: input.command.occurredAt,
        recordedAt,
      }),
    );
    requireOneAffected(
      await input.unitOfWork.insertActiveBinding({
        bindingId: input.command.replacementBindingId,
        accountId: input.command.accountId,
        tenantId: input.command.tenantId,
        institutionId: input.command.institutionId,
        source: input.command.assignmentSource,
        assignedBy: input.command.actorId,
        assignedAt: input.command.occurredAt,
        expiresAt: input.command.expiresAt,
        recordedAt,
      }),
    );
    transition = Object.freeze({
      transitionId,
      tenantId: input.command.tenantId,
      bindingId: input.command.bindingId,
      replacementBindingId: input.command.replacementBindingId,
      commandId: input.command.commandId,
      transitionType: 'rebind',
      provenanceSource: 'access_control_command',
      assignmentSource: input.command.assignmentSource,
      actorId: input.command.actorId,
      reasonCode: input.command.reasonCode,
      fromStatus: 'active',
      toStatus: 'revoked',
      fromVersion: activeBinding.version,
      toVersion: activeBinding.version + 1,
      membershipRevision: membership.revision,
      scopeRevision,
      occurredAt: input.command.occurredAt,
      recordedAt,
    });
    replacementBindingId = input.command.replacementBindingId;
    resultStatus = 'revoked';
    resultVersion = activeBinding.version + 1;
  } else if (input.command.kind === 'revoke') {
    if (activeBinding === null) return blocked('binding_not_active');
    requireOneAffected(
      await input.unitOfWork.revokeActiveBindingByCas({
        binding: activeBinding,
        revokedAt: input.command.occurredAt,
        recordedAt,
      }),
    );
    transition = Object.freeze({
      transitionId,
      tenantId: input.command.tenantId,
      bindingId: input.command.bindingId,
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
      membershipRevision: membership.revision,
      scopeRevision: null,
      occurredAt: input.command.occurredAt,
      recordedAt,
    });
    resultStatus = 'revoked';
    resultVersion = activeBinding.version + 1;
  } else {
    if (
      activeBinding === null ||
      currentBinding === null ||
      currentBinding.expiresAt === null
    ) {
      return blocked('binding_expiry_missing');
    }
    requireOneAffected(
      await input.unitOfWork.revokeActiveBindingByCas({
        binding: activeBinding,
        revokedAt: currentBinding.expiresAt,
        recordedAt,
      }),
    );
    transition = Object.freeze({
      transitionId,
      tenantId: input.command.tenantId,
      bindingId: input.command.bindingId,
      replacementBindingId: null,
      commandId: input.command.commandId,
      transitionType: 'expire',
      provenanceSource: 'access_control_command',
      assignmentSource: activeBinding.source,
      actorId: 'system',
      reasonCode: 'binding_expired',
      fromStatus: 'active',
      toStatus: 'revoked',
      fromVersion: activeBinding.version,
      toVersion: activeBinding.version + 1,
      membershipRevision: membership.revision,
      scopeRevision: null,
      occurredAt: currentBinding.expiresAt,
      recordedAt,
    });
    resultStatus = 'revoked';
    resultVersion = activeBinding.version + 1;
  }

  requireOneAffected(
    await input.unitOfWork.appendBindingTransition(transition),
  );

  return Object.freeze({
    status: 'applied',
    commandId: input.command.commandId,
    transitionId,
    bindingId: resultBindingId,
    replacementBindingId,
    bindingStatus: resultStatus,
    bindingVersion: resultVersion,
    membershipRevision: membership.revision,
  });
}

export function createBindingCommandService(input: Readonly<{
  transactionPort: MembershipCommandTransactionPort;
  createTransitionId?: () => string;
  now?: () => Date;
}>): Readonly<{
  execute(command: BindingOwnerCommand): Promise<BindingCommandResult>;
}> {
  return Object.freeze({
    execute: async (command: BindingOwnerCommand): Promise<BindingCommandResult> => {
      try {
        return await input.transactionPort.run((unitOfWork, scopeAssertion) =>
          executeBindingCommandWithUnitOfWork({
            unitOfWork,
            scopeAssertion,
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
