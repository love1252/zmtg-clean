import {
  AUTH_BINDING_MAX_VERSION,
  createMembershipCommandId,
  executeMembershipCommandWithUnitOfWork,
} from '@/modules/access-control/application/membership-command-service';
import {
  MEMBERSHIP_MAX_REVISION,
  isCompleteMembershipCurrent,
  isMembershipProvenanceReasonCode,
  isRuntimeMembershipCommandId,
  type CompleteMembershipCurrent,
} from '@/modules/access-control/domain/membership-lifecycle';
import type {
  ActiveMembershipBinding,
  MembershipCommandUnitOfWork,
} from '@/modules/access-control/ports/membership-command-unit-of-work';
import type { TransactionBoundInstitutionScopeAssertion } from '@/modules/tenancy/ports/transaction-bound-institution-scope';

export const CROSS_TENANT_TRANSFER_TRANSACTION_ERROR_CODES = [
  'transfer_repository_unavailable',
  'transfer_outcome_unknown',
  'transfer_account_lock_required',
  'transfer_account_lock_mismatch',
] as const;

export type CrossTenantTransferTransactionErrorCode =
  (typeof CROSS_TENANT_TRANSFER_TRANSACTION_ERROR_CODES)[number];

export class CrossTenantTransferTransactionError extends Error {
  constructor(readonly code: CrossTenantTransferTransactionErrorCode) {
    super(code);
    this.name = 'CrossTenantTransferTransactionError';
  }
}

export const CROSS_TENANT_TRANSFER_BLOCK_CODES = [
  'transfer_command_shape_invalid',
  'transfer_command_identity_invalid',
  'transfer_command_time_invalid',
  'transfer_same_tenant',
  'transfer_source_membership_not_found',
  'transfer_source_membership_invalid',
  'transfer_source_membership_identity_mismatch',
  'transfer_source_account_mismatch',
  'transfer_source_membership_inactive',
  'transfer_source_membership_revision_stale',
  'transfer_source_membership_revision_exhausted',
  'transfer_source_binding_not_found',
  'transfer_source_binding_identity_mismatch',
  'transfer_source_binding_version_invalid',
  'transfer_source_binding_version_stale',
  'transfer_source_binding_version_exhausted',
  'transfer_source_binding_expired',
  'transfer_target_membership_conflict',
  'transfer_target_binding_conflict',
  'transfer_target_scope_missing',
  'transfer_target_scope_inactive',
  'transfer_target_scope_invalid',
  'transfer_target_scope_unavailable',
  'transfer_command_replay_rejected',
  'transfer_owner_result_invalid',
  'transfer_repository_unavailable',
  'transfer_account_lock_required',
  'transfer_account_lock_mismatch',
] as const;

export type CrossTenantTransferBlockCode =
  (typeof CROSS_TENANT_TRANSFER_BLOCK_CODES)[number];

export type CrossTenantTransferIntent = Readonly<{
  accountId: string;
  sourceTenantId: string;
  sourceMembershipId: string;
  sourceExpectedMembershipRevision: number;
  sourceBindingId: string;
  sourceExpectedBindingVersion: number;
  targetTenantId: string;
  targetInstitutionId: string;
  targetMembershipId: string;
  targetBindingId: string;
  actorId: string;
  reasonCode: string;
  occurredAt: string;
  targetBindingExpiresAt: string | null;
}>;

export type CrossTenantTransferResult =
  | Readonly<{
      status: 'applied';
      commandId: string;
      source: Readonly<{
        membershipId: string;
        membershipRevision: number;
        lifecycleStatus: 'revoked';
        bindingId: string;
        bindingVersion: number;
      }>;
      target: Readonly<{
        membershipId: string;
        membershipRevision: 1;
        lifecycleStatus: 'active';
        bindingId: string;
        bindingVersion: 1;
      }>;
    }>
  | Readonly<{
      status: 'blocked';
      commandId: string | null;
      code: CrossTenantTransferBlockCode;
    }>
  | Readonly<{
      status: 'outcome_unknown';
      commandId: string;
      code: 'transfer_outcome_unknown';
    }>;

export type CrossTenantTransferTransactionContext = Readonly<{
  unitOfWork: MembershipCommandUnitOfWork;
  scopeAssertion?: TransactionBoundInstitutionScopeAssertion;
  lockTransferAccount(input: Readonly<{ accountId: string }>): Promise<void>;
}>;

export interface CrossTenantTransferTransactionPort {
  run<T>(
    work: (context: CrossTenantTransferTransactionContext) => Promise<T>,
  ): Promise<T>;
}

class CrossTenantTransferAbort extends Error {
  constructor(readonly code: CrossTenantTransferBlockCode) {
    super(code);
    this.name = 'CrossTenantTransferAbort';
  }
}

const INTENT_KEYS = [
  'accountId',
  'actorId',
  'occurredAt',
  'reasonCode',
  'sourceBindingId',
  'sourceExpectedBindingVersion',
  'sourceExpectedMembershipRevision',
  'sourceMembershipId',
  'sourceTenantId',
  'targetBindingExpiresAt',
  'targetBindingId',
  'targetInstitutionId',
  'targetMembershipId',
  'targetTenantId',
] as const;

function blocked(
  code: CrossTenantTransferBlockCode,
  commandId: string | null,
): CrossTenantTransferResult {
  return Object.freeze({ status: 'blocked', code, commandId });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isCanonicalText(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximumLength &&
    value.trim() === value &&
    value.normalize('NFC') === value
  );
}

function isCanonicalInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function isPositiveVersion(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MEMBERSHIP_MAX_REVISION
  );
}

function validateIntent(value: unknown): CrossTenantTransferBlockCode | null {
  if (!isRecord(value) || !hasExactKeys(value, INTENT_KEYS)) {
    return 'transfer_command_shape_invalid';
  }
  if (
    !isCanonicalText(value.accountId, 96) ||
    !isCanonicalText(value.sourceTenantId, 64) ||
    !isCanonicalText(value.sourceMembershipId, 64) ||
    !isCanonicalText(value.sourceBindingId, 64) ||
    !isCanonicalText(value.targetTenantId, 64) ||
    !isCanonicalText(value.targetInstitutionId, 64) ||
    !isCanonicalText(value.targetMembershipId, 64) ||
    !isCanonicalText(value.targetBindingId, 64) ||
    !isCanonicalText(value.actorId, 96) ||
    !isMembershipProvenanceReasonCode(value.reasonCode) ||
    !isPositiveVersion(value.sourceExpectedMembershipRevision) ||
    !isPositiveVersion(value.sourceExpectedBindingVersion)
  ) {
    return 'transfer_command_shape_invalid';
  }
  if (
    !isCanonicalInstant(value.occurredAt) ||
    (
      value.targetBindingExpiresAt !== null &&
      !isCanonicalInstant(value.targetBindingExpiresAt)
    )
  ) {
    return 'transfer_command_time_invalid';
  }
  if (
    value.targetBindingExpiresAt !== null &&
    value.targetBindingExpiresAt <= value.occurredAt
  ) {
    return 'transfer_command_time_invalid';
  }
  if (value.sourceTenantId === value.targetTenantId) {
    return 'transfer_same_tenant';
  }
  return null;
}

function safeNow(now: () => Date): string | null {
  try {
    const value = now();
    if (!(value instanceof Date) || Number.isNaN(value.valueOf())) return null;
    const canonical = value.toISOString();
    return isCanonicalInstant(canonical) ? canonical : null;
  } catch {
    return null;
  }
}

function validateSourceMembership(
  current: CompleteMembershipCurrent | null,
  intent: CrossTenantTransferIntent,
): CrossTenantTransferBlockCode | null {
  if (current === null) return 'transfer_source_membership_not_found';
  if (
    current.tenantId !== intent.sourceTenantId ||
    current.membershipId !== intent.sourceMembershipId
  ) {
    return 'transfer_source_membership_identity_mismatch';
  }
  if (current.userId !== intent.accountId) {
    return 'transfer_source_account_mismatch';
  }
  if (current.lifecycleStatus !== 'active') {
    return 'transfer_source_membership_inactive';
  }
  if (current.revision !== intent.sourceExpectedMembershipRevision) {
    return 'transfer_source_membership_revision_stale';
  }
  if (current.revision >= MEMBERSHIP_MAX_REVISION) {
    return 'transfer_source_membership_revision_exhausted';
  }
  return null;
}

function validateSourceBinding(
  binding: ActiveMembershipBinding | null,
  intent: CrossTenantTransferIntent,
  recordedAt: string,
): CrossTenantTransferBlockCode | null {
  if (binding === null) return 'transfer_source_binding_not_found';
  if (
    binding.bindingId !== intent.sourceBindingId ||
    binding.tenantId !== intent.sourceTenantId ||
    binding.accountId !== intent.accountId
  ) {
    return 'transfer_source_binding_identity_mismatch';
  }
  if (!isPositiveVersion(binding.version)) {
    return 'transfer_source_binding_version_invalid';
  }
  if (binding.version !== intent.sourceExpectedBindingVersion) {
    return 'transfer_source_binding_version_stale';
  }
  if (binding.version >= AUTH_BINDING_MAX_VERSION) {
    return 'transfer_source_binding_version_exhausted';
  }
  if (binding.expiresAt !== null && binding.expiresAt <= recordedAt) {
    return 'transfer_source_binding_expired';
  }
  return null;
}

function targetScopeBlockCode(
  resolution:
    | Awaited<ReturnType<TransactionBoundInstitutionScopeAssertion['assertActive']>>
    | null,
): CrossTenantTransferBlockCode | null {
  if (resolution === null) return 'transfer_target_scope_unavailable';
  if (resolution.kind === 'active_scope') return null;
  if (resolution.code === 'scope_missing') return 'transfer_target_scope_missing';
  if (resolution.code === 'scope_inactive') return 'transfer_target_scope_inactive';
  if (resolution.code === 'scope_invalid') return 'transfer_target_scope_invalid';
  return 'transfer_target_scope_unavailable';
}

function requireAppliedTarget(
  result: Awaited<ReturnType<typeof executeMembershipCommandWithUnitOfWork>>,
  intent: CrossTenantTransferIntent,
  commandId: string,
): void {
  if (
    result.status !== 'applied' ||
    result.commandId !== commandId ||
    result.membershipId !== intent.targetMembershipId ||
    result.revision !== 1 ||
    result.lifecycleStatus !== 'active' ||
    result.binding.kind !== 'created' ||
    result.binding.version !== 1
  ) {
    throw new CrossTenantTransferAbort('transfer_owner_result_invalid');
  }
}

function requireAppliedSource(
  result: Awaited<ReturnType<typeof executeMembershipCommandWithUnitOfWork>>,
  intent: CrossTenantTransferIntent,
  commandId: string,
): Readonly<{ revision: number; bindingVersion: number }> {
  if (
    result.status !== 'applied' ||
    result.commandId !== commandId ||
    result.membershipId !== intent.sourceMembershipId ||
    result.revision !== intent.sourceExpectedMembershipRevision + 1 ||
    result.lifecycleStatus !== 'revoked' ||
    result.binding.kind !== 'revoked' ||
    result.binding.version !== intent.sourceExpectedBindingVersion + 1
  ) {
    throw new CrossTenantTransferAbort('transfer_owner_result_invalid');
  }
  return Object.freeze({
    revision: result.revision,
    bindingVersion: result.binding.version,
  });
}

export async function executeCrossTenantTransferWithTransactionContext(input: Readonly<{
  context: CrossTenantTransferTransactionContext;
  intent: CrossTenantTransferIntent;
  commandId: string;
  now?: () => Date;
}>): Promise<CrossTenantTransferResult> {
  const intentError = validateIntent(input.intent);
  if (intentError) return blocked(intentError, input.commandId);
  if (!isRuntimeMembershipCommandId(input.commandId)) {
    return blocked('transfer_command_identity_invalid', input.commandId);
  }

  const recordedAt = safeNow(input.now ?? (() => new Date()));
  if (recordedAt === null || input.intent.occurredAt > recordedAt) {
    return blocked('transfer_command_time_invalid', input.commandId);
  }

  await input.context.lockTransferAccount({
    accountId: input.intent.accountId,
  });

  const sourceCandidate = await input.context.unitOfWork.lockMembershipById({
    tenantId: input.intent.sourceTenantId,
    membershipId: input.intent.sourceMembershipId,
  });
  if (
    sourceCandidate !== null &&
    !isCompleteMembershipCurrent(sourceCandidate)
  ) {
    return blocked('transfer_source_membership_invalid', input.commandId);
  }
  const sourceCurrent = sourceCandidate === null ? null : sourceCandidate;
  const sourceMembershipError = validateSourceMembership(
    sourceCurrent,
    input.intent,
  );
  if (sourceMembershipError) {
    return blocked(sourceMembershipError, input.commandId);
  }
  if (sourceCurrent === null) {
    return blocked('transfer_source_membership_not_found', input.commandId);
  }

  const sourceBinding = await input.context.unitOfWork.lockActiveBinding({
    tenantId: input.intent.sourceTenantId,
    accountId: input.intent.accountId,
  });
  const sourceBindingError = validateSourceBinding(
    sourceBinding,
    input.intent,
    recordedAt,
  );
  if (sourceBindingError) {
    return blocked(sourceBindingError, input.commandId);
  }

  await input.context.unitOfWork.lockCreateIdentity({
    tenantId: input.intent.targetTenantId,
    userId: input.intent.accountId,
  });
  const targetCurrent =
    await input.context.unitOfWork.lockMembershipByTenantUser({
      tenantId: input.intent.targetTenantId,
      userId: input.intent.accountId,
    });
  if (targetCurrent !== null) {
    return blocked('transfer_target_membership_conflict', input.commandId);
  }

  const targetBinding = await input.context.unitOfWork.lockActiveBinding({
    tenantId: input.intent.targetTenantId,
    accountId: input.intent.accountId,
  });
  if (targetBinding !== null) {
    return blocked('transfer_target_binding_conflict', input.commandId);
  }

  if (!input.context.scopeAssertion) {
    return blocked('transfer_target_scope_unavailable', input.commandId);
  }
  const targetScope = await input.context.scopeAssertion.assertActive({
    tenantId: input.intent.targetTenantId,
    institutionId: input.intent.targetInstitutionId,
  });
  const targetScopeError = targetScopeBlockCode(targetScope);
  if (targetScopeError) {
    return blocked(targetScopeError, input.commandId);
  }
  if (
    targetScope.kind !== 'active_scope' ||
    targetScope.tenantId !== input.intent.targetTenantId ||
    targetScope.institutionId !== input.intent.targetInstitutionId
  ) {
    return blocked('transfer_target_scope_invalid', input.commandId);
  }

  if (
    await input.context.unitOfWork.commandExists({
      tenantId: input.intent.sourceTenantId,
      commandId: input.commandId,
    })
  ) {
    return blocked('transfer_command_replay_rejected', input.commandId);
  }
  if (
    await input.context.unitOfWork.commandExists({
      tenantId: input.intent.targetTenantId,
      commandId: input.commandId,
    })
  ) {
    return blocked('transfer_command_replay_rejected', input.commandId);
  }

  const targetResult = await executeMembershipCommandWithUnitOfWork({
    unitOfWork: input.context.unitOfWork,
    scopeAssertion: input.context.scopeAssertion,
    command: Object.freeze({
      kind: 'create' as const,
      commandId: input.commandId,
      tenantId: input.intent.targetTenantId,
      membershipId: input.intent.targetMembershipId,
      actorId: input.intent.actorId,
      reasonCode: input.intent.reasonCode,
      occurredAt: input.intent.occurredAt,
      expectedRevision: null,
      userId: input.intent.accountId,
      role: sourceCurrent.role,
      displayName: sourceCurrent.displayName,
      source: 'access_control_command' as const,
      binding: Object.freeze({
        bindingId: input.intent.targetBindingId,
        institutionId: input.intent.targetInstitutionId,
        source: 'manual_admin' as const,
        expiresAt: input.intent.targetBindingExpiresAt,
      }),
    }),
    now: input.now,
  });
  requireAppliedTarget(targetResult, input.intent, input.commandId);

  const sourceApplied = requireAppliedSource(
    await executeMembershipCommandWithUnitOfWork({
      unitOfWork: input.context.unitOfWork,
      scopeAssertion: input.context.scopeAssertion,
      command: Object.freeze({
        kind: 'revoke' as const,
        commandId: input.commandId,
        tenantId: input.intent.sourceTenantId,
        membershipId: input.intent.sourceMembershipId,
        actorId: input.intent.actorId,
        reasonCode: input.intent.reasonCode,
        occurredAt: input.intent.occurredAt,
        expectedRevision: input.intent.sourceExpectedMembershipRevision,
      }),
      now: input.now,
    }),
    input.intent,
    input.commandId,
  );

  return Object.freeze({
    status: 'applied',
    commandId: input.commandId,
    source: Object.freeze({
      membershipId: input.intent.sourceMembershipId,
      membershipRevision: sourceApplied.revision,
      lifecycleStatus: 'revoked' as const,
      bindingId: input.intent.sourceBindingId,
      bindingVersion: sourceApplied.bindingVersion,
    }),
    target: Object.freeze({
      membershipId: input.intent.targetMembershipId,
      membershipRevision: 1 as const,
      lifecycleStatus: 'active' as const,
      bindingId: input.intent.targetBindingId,
      bindingVersion: 1 as const,
    }),
  });
}

export function createCrossTenantTransferService(input: Readonly<{
  transactionPort: CrossTenantTransferTransactionPort;
  createCommandId?: () => string;
  now?: () => Date;
}>): Readonly<{
  execute(intent: CrossTenantTransferIntent): Promise<CrossTenantTransferResult>;
}> {
  return Object.freeze({
    execute: async (
      intent: CrossTenantTransferIntent,
    ): Promise<CrossTenantTransferResult> => {
      const intentError = validateIntent(intent);
      if (intentError) return blocked(intentError, null);

      let commandId: string;
      try {
        commandId = (input.createCommandId ?? createMembershipCommandId)();
      } catch {
        return blocked('transfer_command_identity_invalid', null);
      }
      if (!isRuntimeMembershipCommandId(commandId)) {
        return blocked('transfer_command_identity_invalid', commandId);
      }

      try {
        return await input.transactionPort.run((context) =>
          executeCrossTenantTransferWithTransactionContext({
            context,
            intent,
            commandId,
            now: input.now,
          }),
        );
      } catch (error) {
        if (error instanceof CrossTenantTransferAbort) {
          return blocked(error.code, commandId);
        }
        if (error instanceof CrossTenantTransferTransactionError) {
          if (error.code === 'transfer_outcome_unknown') {
            return Object.freeze({
              status: 'outcome_unknown',
              commandId,
              code: 'transfer_outcome_unknown' as const,
            });
          }
          return blocked(error.code, commandId);
        }
        return blocked('transfer_repository_unavailable', commandId);
      }
    },
  });
}
