export const BINDING_MAX_VERSION = 2_147_483_647;

export type BindingStatus = 'active' | 'revoked';
export type BindingAssignmentSource =
  | 'manual_admin'
  | 'migration_placeholder'
  | 'system';
export type RuntimeBindingAssignmentSource = Exclude<
  BindingAssignmentSource,
  'migration_placeholder'
>;
export type BindingProvenanceSource =
  | 'formal_onboarding'
  | 'access_control_command';
export type BindingTransitionType = 'create' | 'rebind' | 'revoke' | 'expire';

export const BINDING_LIFECYCLE_BLOCK_CODES = [
  'binding_command_shape_invalid',
  'binding_command_time_invalid',
  'binding_current_envelope_invalid',
  'binding_identity_mismatch',
  'binding_membership_not_found',
  'binding_membership_inactive',
  'binding_membership_revision_invalid',
  'binding_membership_revision_stale',
  'binding_not_found',
  'binding_active_conflict',
  'binding_not_active',
  'binding_version_invalid',
  'binding_version_stale',
  'binding_version_exhausted',
  'binding_expired',
  'binding_expiry_missing',
  'binding_not_expired',
  'binding_rebind_same_institution',
  'binding_scope_denied',
  'binding_scope_invalid',
  'binding_scope_unavailable',
] as const;

export type BindingLifecycleBlockCode =
  (typeof BINDING_LIFECYCLE_BLOCK_CODES)[number];

export interface BindingCurrent {
  readonly bindingId: string;
  readonly accountId: string;
  readonly tenantId: string;
  readonly institutionId: string;
  readonly status: BindingStatus;
  readonly source: BindingAssignmentSource;
  readonly assignedBy: string;
  readonly assignedAt: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BindingTransitionEvidence {
  readonly transitionId: string;
  readonly tenantId: string;
  readonly bindingId: string;
  readonly replacementBindingId: string | null;
  readonly commandId: string;
  readonly transitionType: BindingTransitionType;
  readonly provenanceSource:
    | BindingProvenanceSource
    | 'legacy_calibration';
  readonly assignmentSource: BindingAssignmentSource;
  readonly actorId: string | null;
  readonly reasonCode: string;
  readonly fromStatus: BindingStatus | null;
  readonly toStatus: BindingStatus;
  readonly fromVersion: number | null;
  readonly toVersion: number;
  readonly membershipRevision: number;
  readonly scopeRevision: number | null;
  readonly occurredAt: string | null;
  readonly recordedAt: string;
}

interface BindingCommandIdentity {
  readonly commandId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly accountId: string;
  readonly expectedMembershipRevision: number;
}

export interface CreateBindingCommand extends BindingCommandIdentity {
  readonly kind: 'create';
  readonly bindingId: string;
  readonly institutionId: string;
  readonly assignmentSource: RuntimeBindingAssignmentSource;
  readonly provenanceSource: BindingProvenanceSource;
  readonly actorId: string;
  readonly reasonCode: string;
  readonly occurredAt: string;
  readonly expiresAt: string | null;
}

export interface RebindBindingCommand extends BindingCommandIdentity {
  readonly kind: 'rebind';
  readonly bindingId: string;
  readonly expectedBindingVersion: number;
  readonly replacementBindingId: string;
  readonly institutionId: string;
  readonly assignmentSource: RuntimeBindingAssignmentSource;
  readonly actorId: string;
  readonly reasonCode: string;
  readonly occurredAt: string;
  readonly expiresAt: string | null;
}

export interface RevokeBindingCommand extends BindingCommandIdentity {
  readonly kind: 'revoke';
  readonly bindingId: string;
  readonly expectedBindingVersion: number;
  readonly actorId: string;
  readonly reasonCode: string;
  readonly occurredAt: string;
}

export interface ExpireBindingCommand extends BindingCommandIdentity {
  readonly kind: 'expire';
  readonly bindingId: string;
  readonly expectedBindingVersion: number;
}

export type BindingOwnerCommand =
  | CreateBindingCommand
  | RebindBindingCommand
  | RevokeBindingCommand
  | ExpireBindingCommand;

const RUNTIME_COMMAND_ID_PATTERN =
  /^bcmd1_[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;
const RUNTIME_TRANSITION_ID_PATTERN =
  /^btr1_[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;
const REASON_CODE_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,95}$/u;

const COMMAND_KEYS = {
  create: [
    'accountId',
    'actorId',
    'assignmentSource',
    'bindingId',
    'commandId',
    'expectedMembershipRevision',
    'expiresAt',
    'institutionId',
    'kind',
    'membershipId',
    'occurredAt',
    'provenanceSource',
    'reasonCode',
    'tenantId',
  ],
  rebind: [
    'accountId',
    'actorId',
    'assignmentSource',
    'bindingId',
    'commandId',
    'expectedBindingVersion',
    'expectedMembershipRevision',
    'expiresAt',
    'institutionId',
    'kind',
    'membershipId',
    'occurredAt',
    'reasonCode',
    'replacementBindingId',
    'tenantId',
  ],
  revoke: [
    'accountId',
    'actorId',
    'bindingId',
    'commandId',
    'expectedBindingVersion',
    'expectedMembershipRevision',
    'kind',
    'membershipId',
    'occurredAt',
    'reasonCode',
    'tenantId',
  ],
  expire: [
    'accountId',
    'bindingId',
    'commandId',
    'expectedBindingVersion',
    'expectedMembershipRevision',
    'kind',
    'membershipId',
    'tenantId',
  ],
} as const;

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

export function isCanonicalBindingInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

export function isPositiveBindingVersion(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= BINDING_MAX_VERSION
  );
}

export function isPositiveObservedRevision(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= BINDING_MAX_VERSION
  );
}

export function isRuntimeBindingCommandId(value: unknown): value is string {
  return typeof value === 'string' && RUNTIME_COMMAND_ID_PATTERN.test(value);
}

export function isRuntimeBindingTransitionId(value: unknown): value is string {
  return typeof value === 'string' && RUNTIME_TRANSITION_ID_PATTERN.test(value);
}

export function isBindingReasonCode(value: unknown): value is string {
  return typeof value === 'string' && REASON_CODE_PATTERN.test(value);
}

export function validateBindingOwnerCommandIdentity(
  value: unknown,
): BindingLifecycleBlockCode | null {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return 'binding_command_shape_invalid';
  }
  if (!Object.hasOwn(COMMAND_KEYS, value.kind)) {
    return 'binding_command_shape_invalid';
  }
  if (
    !isRuntimeBindingCommandId(value.commandId) ||
    !isCanonicalText(value.tenantId, 64) ||
    !isCanonicalText(value.membershipId, 64) ||
    !isCanonicalText(value.accountId, 96) ||
    !isPositiveObservedRevision(value.expectedMembershipRevision)
  ) {
    return 'binding_command_shape_invalid';
  }
  if (!isCanonicalText(value.bindingId, 64)) {
    return 'binding_command_shape_invalid';
  }
  if (
    value.kind === 'rebind' &&
    !isCanonicalText(value.replacementBindingId, 64)
  ) {
    return 'binding_command_shape_invalid';
  }
  return null;
}

export function validateBindingOwnerCommand(
  value: unknown,
): BindingLifecycleBlockCode | null {
  const identityError = validateBindingOwnerCommandIdentity(value);
  if (identityError) return identityError;

  const command = value as Record<string, unknown>;
  const keys = COMMAND_KEYS[command.kind as keyof typeof COMMAND_KEYS];
  if (!keys || !hasExactKeys(command, keys)) {
    return 'binding_command_shape_invalid';
  }

  if (command.kind === 'expire') {
    return isPositiveBindingVersion(command.expectedBindingVersion)
      ? null
      : 'binding_version_invalid';
  }

  if (
    !isCanonicalText(command.actorId, 96) ||
    !isBindingReasonCode(command.reasonCode)
  ) {
    return 'binding_command_shape_invalid';
  }
  if (!isCanonicalBindingInstant(command.occurredAt)) {
    return 'binding_command_time_invalid';
  }

  if (command.kind === 'create') {
    if (
      !isCanonicalText(command.institutionId, 64) ||
      (command.assignmentSource !== 'manual_admin' &&
        command.assignmentSource !== 'system') ||
      (command.provenanceSource !== 'formal_onboarding' &&
        command.provenanceSource !== 'access_control_command') ||
      (command.expiresAt !== null &&
        !isCanonicalBindingInstant(command.expiresAt))
    ) {
      return 'binding_command_shape_invalid';
    }
    if (
      command.expiresAt !== null &&
      command.expiresAt <= command.occurredAt
    ) {
      return 'binding_command_time_invalid';
    }
    return null;
  }

  if (!isPositiveBindingVersion(command.expectedBindingVersion)) {
    return 'binding_version_invalid';
  }

  if (command.kind === 'rebind') {
    if (
      !isCanonicalText(command.institutionId, 64) ||
      !isCanonicalText(command.replacementBindingId, 64) ||
      command.replacementBindingId === command.bindingId ||
      (command.assignmentSource !== 'manual_admin' &&
        command.assignmentSource !== 'system') ||
      (command.expiresAt !== null &&
        !isCanonicalBindingInstant(command.expiresAt))
    ) {
      return 'binding_command_shape_invalid';
    }
    if (
      command.expiresAt !== null &&
      command.expiresAt <= command.occurredAt
    ) {
      return 'binding_command_time_invalid';
    }
  }

  return null;
}

export function isBindingCurrent(value: unknown): value is BindingCurrent {
  if (!isRecord(value)) return false;
  if (
    !isCanonicalText(value.bindingId, 64) ||
    !isCanonicalText(value.accountId, 96) ||
    !isCanonicalText(value.tenantId, 64) ||
    !isCanonicalText(value.institutionId, 64) ||
    (value.status !== 'active' && value.status !== 'revoked') ||
    (value.source !== 'manual_admin' &&
      value.source !== 'migration_placeholder' &&
      value.source !== 'system') ||
    !isCanonicalText(value.assignedBy, 96) ||
    !isCanonicalBindingInstant(value.assignedAt) ||
    (value.expiresAt !== null &&
      !isCanonicalBindingInstant(value.expiresAt)) ||
    (value.revokedAt !== null &&
      !isCanonicalBindingInstant(value.revokedAt)) ||
    !isPositiveBindingVersion(value.version) ||
    !isCanonicalBindingInstant(value.createdAt) ||
    !isCanonicalBindingInstant(value.updatedAt)
  ) {
    return false;
  }
  if (
    value.expiresAt !== null &&
    value.expiresAt <= value.assignedAt
  ) {
    return false;
  }
  return (
    (value.status === 'active' && value.revokedAt === null) ||
    (value.status === 'revoked' &&
      value.revokedAt !== null &&
      value.revokedAt >= value.assignedAt)
  );
}
