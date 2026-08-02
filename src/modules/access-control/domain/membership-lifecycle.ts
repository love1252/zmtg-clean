import {
  AUTH_ROLES,
  isAuthRole,
  type AuthRole,
} from '@/modules/auth/domain/session';

export const MEMBERSHIP_MAX_REVISION = 2_147_483_647;
export const MEMBERSHIP_ROLES = AUTH_ROLES;

export type MembershipRole = AuthRole;
export type MembershipLifecycleStatus = 'active' | 'revoked' | 'deleted';
export type MembershipProvenanceSource =
  | 'formal_onboarding'
  | 'access_control_command'
  | 'legacy_calibration';
export type MembershipTransitionType =
  | 'create'
  | 'refresh'
  | 'revoke'
  | 'reactivate'
  | 'delete';

export const MEMBERSHIP_LIFECYCLE_BLOCK_CODES = [
  'membership_command_shape_invalid',
  'membership_command_time_invalid',
  'membership_current_envelope_invalid',
  'membership_identity_mismatch',
  'membership_not_found',
  'membership_already_exists',
  'new_incarnation_not_supported',
  'legacy_membership_not_calibrated',
  'membership_revision_invalid',
  'membership_revision_stale',
  'membership_revision_future',
  'revision_exhausted',
  'membership_transition_not_allowed',
] as const;

export type MembershipLifecycleBlockCode =
  (typeof MEMBERSHIP_LIFECYCLE_BLOCK_CODES)[number];

export interface MembershipCurrent {
  readonly membershipId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly role: MembershipRole;
  readonly displayName: string;
  readonly revision: number | null;
  readonly lifecycleStatus: MembershipLifecycleStatus | null;
  readonly provenanceSource: MembershipProvenanceSource | null;
  readonly provenanceActorId: string | null;
  readonly provenanceReasonCode: string | null;
  readonly provenanceCommandId: string | null;
  readonly provenanceOccurredAt: string | null;
  readonly provenanceRecordedAt: string | null;
  readonly revokedAt: string | null;
  readonly deletedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MembershipTransition {
  readonly transitionId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly commandId: string;
  readonly transitionType: MembershipTransitionType;
  readonly source: Exclude<MembershipProvenanceSource, 'legacy_calibration'>;
  readonly actorId: string;
  readonly reasonCode: string;
  readonly fromRevision: number | null;
  readonly toRevision: number;
  readonly fromLifecycleStatus: MembershipLifecycleStatus | null;
  readonly toLifecycleStatus: MembershipLifecycleStatus;
  readonly fromRole: MembershipRole | null;
  readonly toRole: MembershipRole;
  readonly occurredAt: string;
  readonly recordedAt: string;
}

export interface CreateMembershipBindingRequest {
  readonly bindingId: string;
  readonly institutionId: string;
  readonly source: 'manual_admin' | 'system';
  readonly expiresAt: string | null;
}

interface MembershipCommandContext {
  readonly commandId: string;
  readonly tenantId: string;
  readonly membershipId: string;
  readonly actorId: string;
  readonly reasonCode: string;
  readonly occurredAt: string;
}

export interface CreateMembershipCommand extends MembershipCommandContext {
  readonly kind: 'create';
  readonly expectedRevision: null;
  readonly userId: string;
  readonly role: MembershipRole;
  readonly displayName: string;
  readonly source: 'formal_onboarding' | 'access_control_command';
  readonly binding: CreateMembershipBindingRequest | null;
}

export interface RefreshMembershipCommand extends MembershipCommandContext {
  readonly kind: 'refresh';
  readonly expectedRevision: number;
  readonly role: MembershipRole;
}

export interface RevokeMembershipCommand extends MembershipCommandContext {
  readonly kind: 'revoke';
  readonly expectedRevision: number;
}

export interface ReactivateMembershipCommand extends MembershipCommandContext {
  readonly kind: 'reactivate';
  readonly expectedRevision: number;
}

export interface DeleteMembershipCommand extends MembershipCommandContext {
  readonly kind: 'delete';
  readonly expectedRevision: number;
}

export type MembershipOwnerCommand =
  | CreateMembershipCommand
  | RefreshMembershipCommand
  | RevokeMembershipCommand
  | ReactivateMembershipCommand
  | DeleteMembershipCommand;

export type MembershipBindingAction =
  | Readonly<{ kind: 'none' }>
  | Readonly<{
      kind: 'create';
      bindingId: string;
      accountId: string;
      tenantId: string;
      institutionId: string;
      source: 'manual_admin' | 'system';
      assignedBy: string;
      assignedAt: string;
      expiresAt: string | null;
      recordedAt: string;
    }>
  | Readonly<{ kind: 'revoke_active' }>;

export type MembershipLifecycleDecision =
  | Readonly<{
      kind: 'apply';
      nextCurrent: MembershipCurrent;
      transition: MembershipTransition;
      bindingAction: MembershipBindingAction;
    }>
  | Readonly<{
      kind: 'observed';
      current: MembershipCurrent;
      bindingAction: Readonly<{ kind: 'none' }>;
    }>
  | Readonly<{ kind: 'blocked'; code: MembershipLifecycleBlockCode }>;

const RUNTIME_COMMAND_ID_PATTERN =
  /^mcmd1_[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;
const RUNTIME_TRANSITION_ID_PATTERN =
  /^mtr1_[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u;
const LEGACY_COMMAND_ID_PATTERN = /^mcal1_[0-9a-f]{64}$/u;
const REASON_CODE_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,95}$/u;

const COMMAND_KEYS = {
  create: [
    'actorId',
    'binding',
    'commandId',
    'displayName',
    'expectedRevision',
    'kind',
    'membershipId',
    'occurredAt',
    'reasonCode',
    'role',
    'source',
    'tenantId',
    'userId',
  ],
  refresh: [
    'actorId',
    'commandId',
    'expectedRevision',
    'kind',
    'membershipId',
    'occurredAt',
    'reasonCode',
    'role',
    'tenantId',
  ],
  revoke: [
    'actorId',
    'commandId',
    'expectedRevision',
    'kind',
    'membershipId',
    'occurredAt',
    'reasonCode',
    'tenantId',
  ],
  reactivate: [
    'actorId',
    'commandId',
    'expectedRevision',
    'kind',
    'membershipId',
    'occurredAt',
    'reasonCode',
    'tenantId',
  ],
  delete: [
    'actorId',
    'commandId',
    'expectedRevision',
    'kind',
    'membershipId',
    'occurredAt',
    'reasonCode',
    'tenantId',
  ],
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
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

function isRole(value: unknown): value is MembershipRole {
  return isAuthRole(value);
}

function isPositiveRevision(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= MEMBERSHIP_MAX_REVISION
  );
}

export function isRuntimeMembershipCommandId(value: unknown): value is string {
  return typeof value === 'string' && RUNTIME_COMMAND_ID_PATTERN.test(value);
}

export function isLegacyMembershipCalibrationCommandId(
  value: unknown,
): value is string {
  return typeof value === 'string' && LEGACY_COMMAND_ID_PATTERN.test(value);
}

export function isMembershipProvenanceReasonCode(
  value: unknown,
): value is string {
  return typeof value === 'string' && REASON_CODE_PATTERN.test(value);
}

export function isRuntimeMembershipTransitionId(value: unknown): value is string {
  return typeof value === 'string' && RUNTIME_TRANSITION_ID_PATTERN.test(value);
}

function isBindingRequest(value: unknown): value is CreateMembershipBindingRequest {
  if (!isRecord(value) || !hasExactKeys(value, [
    'bindingId',
    'expiresAt',
    'institutionId',
    'source',
  ])) {
    return false;
  }
  return (
    isCanonicalText(value.bindingId, 64) &&
    isCanonicalText(value.institutionId, 64) &&
    (value.source === 'manual_admin' || value.source === 'system') &&
    (value.expiresAt === null || isCanonicalInstant(value.expiresAt))
  );
}

export function validateMembershipOwnerCommand(
  value: unknown,
): MembershipLifecycleBlockCode | null {
  const identityError = validateMembershipOwnerCommandIdentity(value);
  if (identityError) return identityError;
  const command = value as Record<string, unknown>;
  const keys = COMMAND_KEYS[command.kind as keyof typeof COMMAND_KEYS];
  if (!keys || !hasExactKeys(command, keys)) {
    return 'membership_command_shape_invalid';
  }
  if (
    !isCanonicalText(command.actorId, 96) ||
    typeof command.reasonCode !== 'string' ||
    !REASON_CODE_PATTERN.test(command.reasonCode)
  ) {
    return 'membership_command_shape_invalid';
  }
  if (!isCanonicalInstant(command.occurredAt)) {
    return 'membership_command_time_invalid';
  }

  if (command.kind === 'create') {
    if (
      command.expectedRevision !== null ||
      !isRole(command.role) ||
      !isCanonicalText(command.displayName, 120) ||
      (command.source !== 'formal_onboarding' &&
        command.source !== 'access_control_command') ||
      (command.binding !== null && !isBindingRequest(command.binding))
    ) {
      return 'membership_command_shape_invalid';
    }
    if (
      command.binding !== null &&
      isBindingRequest(command.binding) &&
      command.binding.expiresAt !== null &&
      command.binding.expiresAt <= command.occurredAt
    ) {
      return 'membership_command_time_invalid';
    }
    return null;
  }

  if (!isPositiveRevision(command.expectedRevision)) {
    return 'membership_revision_invalid';
  }
  if (command.kind === 'refresh' && !isRole(command.role)) {
    return 'membership_command_shape_invalid';
  }
  return null;
}

/**
 * 只校验定位已提交 command identity 所需的最小路由字段。完整 payload 必须在
 * replay 查询之后再校验，确保重复 commandId 不因 payload 差异改报其他错误。
 */
export function validateMembershipOwnerCommandIdentity(
  value: unknown,
): MembershipLifecycleBlockCode | null {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return 'membership_command_shape_invalid';
  }
  if (!Object.hasOwn(COMMAND_KEYS, value.kind)) {
    return 'membership_command_shape_invalid';
  }
  if (
    !isRuntimeMembershipCommandId(value.commandId) ||
    !isCanonicalText(value.tenantId, 64) ||
    !isCanonicalText(value.membershipId, 64)
  ) {
    return 'membership_command_shape_invalid';
  }
  if (value.kind === 'create' && !isCanonicalText(value.userId, 96)) {
    return 'membership_command_shape_invalid';
  }
  return null;
}

type EnvelopeKind = 'legacy' | 'complete' | 'invalid';

export function classifyMembershipCurrent(current: MembershipCurrent): EnvelopeKind {
  if (
    !isCanonicalText(current.membershipId, 64) ||
    !isCanonicalText(current.tenantId, 64) ||
    !isCanonicalText(current.userId, 96) ||
    !isRole(current.role) ||
    !isCanonicalText(current.displayName, 120) ||
    !isCanonicalInstant(current.createdAt) ||
    !isCanonicalInstant(current.updatedAt)
  ) {
    return 'invalid';
  }
  const envelope = [
    current.revision,
    current.lifecycleStatus,
    current.provenanceSource,
    current.provenanceActorId,
    current.provenanceReasonCode,
    current.provenanceCommandId,
    current.provenanceOccurredAt,
    current.provenanceRecordedAt,
    current.revokedAt,
    current.deletedAt,
  ];
  if (envelope.every((value) => value === null)) {
    return 'legacy';
  }
  if (
    !isPositiveRevision(current.revision) ||
    (current.lifecycleStatus !== 'active' &&
      current.lifecycleStatus !== 'revoked' &&
      current.lifecycleStatus !== 'deleted') ||
    (current.provenanceSource !== 'formal_onboarding' &&
      current.provenanceSource !== 'access_control_command' &&
      current.provenanceSource !== 'legacy_calibration') ||
    typeof current.provenanceReasonCode !== 'string' ||
    !REASON_CODE_PATTERN.test(current.provenanceReasonCode) ||
    !isCanonicalText(current.provenanceCommandId, 128) ||
    !isCanonicalInstant(current.provenanceRecordedAt)
  ) {
    return 'invalid';
  }

  if (current.provenanceSource === 'legacy_calibration') {
    if (
      current.revision !== 1 ||
      current.lifecycleStatus !== 'active' ||
      current.provenanceActorId !== null ||
      current.provenanceReasonCode !== 'legacy_unknown' ||
      !LEGACY_COMMAND_ID_PATTERN.test(current.provenanceCommandId) ||
      current.provenanceOccurredAt !== null
    ) {
      return 'invalid';
    }
  } else if (
    !isCanonicalText(current.provenanceActorId, 96) ||
    !isRuntimeMembershipCommandId(current.provenanceCommandId) ||
    !isCanonicalInstant(current.provenanceOccurredAt) ||
    current.provenanceRecordedAt < current.provenanceOccurredAt
  ) {
    return 'invalid';
  } else if (
    current.provenanceSource === 'formal_onboarding' &&
    (current.revision !== 1 || current.lifecycleStatus !== 'active')
  ) {
    return 'invalid';
  }

  if (
    (current.lifecycleStatus === 'active' &&
      (current.revokedAt !== null || current.deletedAt !== null)) ||
    (current.lifecycleStatus === 'revoked' &&
      (!isCanonicalInstant(current.revokedAt) ||
        current.revokedAt !== current.provenanceOccurredAt ||
        current.deletedAt !== null ||
        current.revision < 2)) ||
    (current.lifecycleStatus === 'deleted' &&
      (!isCanonicalInstant(current.deletedAt) ||
        current.deletedAt !== current.provenanceOccurredAt ||
        current.revision < 2 ||
        (current.revokedAt !== null &&
          (!isCanonicalInstant(current.revokedAt) || current.revokedAt > current.deletedAt))))
  ) {
    return 'invalid';
  }
  return 'complete';
}

function blocked(code: MembershipLifecycleBlockCode): MembershipLifecycleDecision {
  return { kind: 'blocked', code };
}

function createTransition(input: {
  command: MembershipOwnerCommand;
  transitionId: string;
  recordedAt: string;
  current: MembershipCurrent | null;
  next: MembershipCurrent;
}): MembershipTransition {
  return Object.freeze({
    transitionId: input.transitionId,
    tenantId: input.next.tenantId,
    membershipId: input.next.membershipId,
    commandId: input.command.commandId,
    transitionType: input.command.kind,
    source: input.command.kind === 'create'
      ? input.command.source
      : 'access_control_command',
    actorId: input.command.actorId,
    reasonCode: input.command.reasonCode,
    fromRevision: input.current?.revision ?? null,
    toRevision: input.next.revision as number,
    fromLifecycleStatus: input.current?.lifecycleStatus ?? null,
    toLifecycleStatus: input.next.lifecycleStatus as MembershipLifecycleStatus,
    fromRole: input.current?.role ?? null,
    toRole: input.next.role,
    occurredAt: input.command.occurredAt,
    recordedAt: input.recordedAt,
  });
}

function createNextCurrent(input: {
  current: MembershipCurrent;
  command: Exclude<MembershipOwnerCommand, CreateMembershipCommand>;
  recordedAt: string;
  role: MembershipRole;
  status: MembershipLifecycleStatus;
  revokedAt: string | null;
  deletedAt: string | null;
}): MembershipCurrent {
  return Object.freeze({
    ...input.current,
    role: input.role,
    revision: (input.current.revision as number) + 1,
    lifecycleStatus: input.status,
    provenanceSource: 'access_control_command',
    provenanceActorId: input.command.actorId,
    provenanceReasonCode: input.command.reasonCode,
    provenanceCommandId: input.command.commandId,
    provenanceOccurredAt: input.command.occurredAt,
    provenanceRecordedAt: input.recordedAt,
    revokedAt: input.revokedAt,
    deletedAt: input.deletedAt,
    updatedAt: input.recordedAt,
  });
}

export function decideMembershipLifecycle(input: Readonly<{
  current: MembershipCurrent | null;
  command: MembershipOwnerCommand;
  transitionId: string;
  recordedAt: string;
}>): MembershipLifecycleDecision {
  const commandError = validateMembershipOwnerCommand(input.command);
  if (commandError) return blocked(commandError);
  if (
    !isRuntimeMembershipTransitionId(input.transitionId) ||
    !isCanonicalInstant(input.recordedAt)
  ) {
    return blocked('membership_command_shape_invalid');
  }
  if (input.recordedAt < input.command.occurredAt) {
    return blocked('membership_command_time_invalid');
  }

  if (input.command.kind === 'create') {
    if (input.current !== null) {
      const envelopeKind = classifyMembershipCurrent(input.current);
      if (envelopeKind === 'invalid') {
        return blocked('membership_current_envelope_invalid');
      }
      if (
        envelopeKind === 'complete' &&
        input.current.lifecycleStatus === 'deleted'
      ) {
        return blocked('new_incarnation_not_supported');
      }
      return blocked('membership_already_exists');
    }
    const nextCurrent: MembershipCurrent = Object.freeze({
      membershipId: input.command.membershipId,
      tenantId: input.command.tenantId,
      userId: input.command.userId,
      role: input.command.role,
      displayName: input.command.displayName,
      revision: 1,
      lifecycleStatus: 'active',
      provenanceSource: input.command.source,
      provenanceActorId: input.command.actorId,
      provenanceReasonCode: input.command.reasonCode,
      provenanceCommandId: input.command.commandId,
      provenanceOccurredAt: input.command.occurredAt,
      provenanceRecordedAt: input.recordedAt,
      revokedAt: null,
      deletedAt: null,
      createdAt: input.recordedAt,
      updatedAt: input.recordedAt,
    });
    const bindingAction: MembershipBindingAction = input.command.binding === null
      ? { kind: 'none' }
      : Object.freeze({
          kind: 'create',
          bindingId: input.command.binding.bindingId,
          accountId: input.command.userId,
          tenantId: input.command.tenantId,
          institutionId: input.command.binding.institutionId,
          source: input.command.binding.source,
          assignedBy: input.command.actorId,
          assignedAt: input.command.occurredAt,
          expiresAt: input.command.binding.expiresAt,
          recordedAt: input.recordedAt,
        });
    return Object.freeze({
      kind: 'apply',
      nextCurrent,
      transition: createTransition({
        command: input.command,
        transitionId: input.transitionId,
        recordedAt: input.recordedAt,
        current: null,
        next: nextCurrent,
      }),
      bindingAction,
    });
  }

  if (input.current === null) return blocked('membership_not_found');
  const envelopeKind = classifyMembershipCurrent(input.current);
  if (envelopeKind === 'legacy') {
    return blocked('legacy_membership_not_calibrated');
  }
  if (envelopeKind === 'invalid') {
    return blocked('membership_current_envelope_invalid');
  }
  if (
    input.current.tenantId !== input.command.tenantId ||
    input.current.membershipId !== input.command.membershipId
  ) {
    return blocked('membership_identity_mismatch');
  }
  if (input.command.expectedRevision < (input.current.revision as number)) {
    return blocked('membership_revision_stale');
  }
  if (input.command.expectedRevision > (input.current.revision as number)) {
    return blocked('membership_revision_future');
  }
  if (input.command.kind === 'refresh' && input.command.role === input.current.role) {
    if (input.current.lifecycleStatus !== 'active') {
      return blocked('membership_transition_not_allowed');
    }
    return Object.freeze({
      kind: 'observed',
      current: input.current,
      bindingAction: { kind: 'none' as const },
    });
  }
  if ((input.current.revision as number) >= MEMBERSHIP_MAX_REVISION) {
    return blocked('revision_exhausted');
  }

  let nextCurrent: MembershipCurrent;
  let bindingAction: MembershipBindingAction = { kind: 'none' };
  switch (input.command.kind) {
    case 'refresh':
      if (input.current.lifecycleStatus !== 'active') {
        return blocked('membership_transition_not_allowed');
      }
      nextCurrent = createNextCurrent({
        current: input.current,
        command: input.command,
        recordedAt: input.recordedAt,
        role: input.command.role,
        status: 'active',
        revokedAt: null,
        deletedAt: null,
      });
      break;
    case 'revoke':
      if (input.current.lifecycleStatus !== 'active') {
        return blocked('membership_transition_not_allowed');
      }
      nextCurrent = createNextCurrent({
        current: input.current,
        command: input.command,
        recordedAt: input.recordedAt,
        role: input.current.role,
        status: 'revoked',
        revokedAt: input.command.occurredAt,
        deletedAt: null,
      });
      bindingAction = { kind: 'revoke_active' };
      break;
    case 'reactivate':
      if (input.current.lifecycleStatus !== 'revoked') {
        return blocked('membership_transition_not_allowed');
      }
      nextCurrent = createNextCurrent({
        current: input.current,
        command: input.command,
        recordedAt: input.recordedAt,
        role: input.current.role,
        status: 'active',
        revokedAt: null,
        deletedAt: null,
      });
      break;
    case 'delete':
      if (
        input.current.lifecycleStatus !== 'active' &&
        input.current.lifecycleStatus !== 'revoked'
      ) {
        return blocked('membership_transition_not_allowed');
      }
      if (
        input.current.revokedAt !== null &&
        input.current.revokedAt > input.command.occurredAt
      ) {
        return blocked('membership_command_time_invalid');
      }
      nextCurrent = createNextCurrent({
        current: input.current,
        command: input.command,
        recordedAt: input.recordedAt,
        role: input.current.role,
        status: 'deleted',
        revokedAt: input.current.revokedAt,
        deletedAt: input.command.occurredAt,
      });
      bindingAction = { kind: 'revoke_active' };
      break;
  }

  return Object.freeze({
    kind: 'apply',
    nextCurrent,
    transition: createTransition({
      command: input.command,
      transitionId: input.transitionId,
      recordedAt: input.recordedAt,
      current: input.current,
      next: nextCurrent,
    }),
    bindingAction,
  });
}
