export const FOLLOW_UP_ASSIGNMENT_KINDS = ['user', 'role_pool'] as const;

export type FollowUpAssignmentKind = (typeof FOLLOW_UP_ASSIGNMENT_KINDS)[number];

export const FOLLOW_UP_ROLE_POOL_ROLES = [
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
] as const;

export type FollowUpRolePoolRole = (typeof FOLLOW_UP_ROLE_POOL_ROLES)[number];

export const FOLLOW_UP_ASSIGNMENT_ADMINISTRATIVE_ROLES = [
  'tenant_admin',
  'tenant_operator',
] as const;

export type FollowUpAssignmentAdministrativeRole =
  (typeof FOLLOW_UP_ASSIGNMENT_ADMINISTRATIVE_ROLES)[number];

export const FOLLOW_UP_ASSIGNMENT_OVERRIDE_REASONS = [
  'assignment_correction',
  'member_unavailable',
  'workload_rebalance',
  'escalation_handling',
] as const;

export type FollowUpAssignmentOverrideReason =
  (typeof FOLLOW_UP_ASSIGNMENT_OVERRIDE_REASONS)[number];

export type FollowUpUserAssignment = Readonly<{
  kind: 'user';
  institutionId: string;
  revision: number;
  assigneeUserId: string;
  claimedFromRolePool: FollowUpRolePoolRole | null;
}>;

export type FollowUpRolePoolAssignment = Readonly<{
  kind: 'role_pool';
  institutionId: string;
  revision: number;
  role: FollowUpRolePoolRole;
}>;

export type FollowUpAssignment = FollowUpUserAssignment | FollowUpRolePoolAssignment;

export type FollowUpAssignmentTarget =
  | Readonly<{
      kind: 'user';
      institutionId: string;
      assigneeUserId: string;
    }>
  | Readonly<{
      kind: 'role_pool';
      institutionId: string;
      role: unknown;
    }>;

export type FollowUpAssignmentMember = Readonly<{
  institutionId: string;
  userId: string;
  role: unknown;
  active: boolean;
}>;

export type FollowUpAssignmentAdministrativeControl = Readonly<{
  operation: 'reassign' | 'unclaim';
  actorRole: FollowUpAssignmentAdministrativeRole;
  reason: FollowUpAssignmentOverrideReason;
  requiredActorRoles: typeof FOLLOW_UP_ASSIGNMENT_ADMINISTRATIVE_ROLES;
  auditRequired: true;
}>;

export type FollowUpAssignmentError =
  | 'invalid_assignment'
  | 'invalid_member'
  | 'invalid_target_assignment'
  | 'scope_mismatch'
  | 'role_mismatch'
  | 'inactive_member'
  | 'assignment_not_claimable'
  | 'assignment_not_claimed'
  | 'claim_conflict'
  | 'revision_conflict'
  | 'administrative_role_required'
  | 'override_reason_required'
  | 'invalid_override_reason';

export type FollowUpAssignmentResult =
  | Readonly<{
      ok: true;
      changed: boolean;
      assignment: FollowUpAssignment;
      control?: FollowUpAssignmentAdministrativeControl;
    }>
  | Readonly<{ ok: false; code: FollowUpAssignmentError }>;

function includesValue(values: readonly string[], value: unknown): value is string {
  return typeof value === 'string' && values.includes(value);
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isFollowUpAssignmentKind(value: unknown): value is FollowUpAssignmentKind {
  return includesValue(FOLLOW_UP_ASSIGNMENT_KINDS, value);
}

export function isFollowUpRolePoolRole(value: unknown): value is FollowUpRolePoolRole {
  return includesValue(FOLLOW_UP_ROLE_POOL_ROLES, value);
}

export function isFollowUpAssignmentAdministrativeRole(
  value: unknown,
): value is FollowUpAssignmentAdministrativeRole {
  return includesValue(FOLLOW_UP_ASSIGNMENT_ADMINISTRATIVE_ROLES, value);
}

export function isFollowUpAssignmentOverrideReason(
  value: unknown,
): value is FollowUpAssignmentOverrideReason {
  return includesValue(FOLLOW_UP_ASSIGNMENT_OVERRIDE_REASONS, value);
}

function isValidRevision(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isValidAssignment(assignment: FollowUpAssignment) {
  if (!isFollowUpAssignmentKind(assignment.kind)) return false;
  if (!isNonEmptyText(assignment.institutionId) || !isValidRevision(assignment.revision)) {
    return false;
  }

  if (assignment.kind === 'role_pool') return isFollowUpRolePoolRole(assignment.role);

  return (
    isNonEmptyText(assignment.assigneeUserId) &&
    (assignment.claimedFromRolePool === null ||
      isFollowUpRolePoolRole(assignment.claimedFromRolePool))
  );
}

function failure(code: FollowUpAssignmentError): FollowUpAssignmentResult {
  return { ok: false, code };
}

function success(
  assignment: FollowUpAssignment,
  changed: boolean,
  control?: FollowUpAssignmentAdministrativeControl,
): FollowUpAssignmentResult {
  return control
    ? { ok: true, changed, assignment, control }
    : { ok: true, changed, assignment };
}

function readAdministrativeContext(input: Readonly<{
  actorRole: unknown;
  reason: unknown;
}>):
  | Readonly<{
      ok: true;
      actorRole: FollowUpAssignmentAdministrativeRole;
      reason: FollowUpAssignmentOverrideReason;
    }>
  | Readonly<{ ok: false; code: FollowUpAssignmentError }> {
  if (!isFollowUpAssignmentAdministrativeRole(input.actorRole)) {
    return { ok: false, code: 'administrative_role_required' };
  }
  if (input.reason === null || input.reason === undefined || input.reason === '') {
    return { ok: false, code: 'override_reason_required' };
  }
  if (!isFollowUpAssignmentOverrideReason(input.reason)) {
    return { ok: false, code: 'invalid_override_reason' };
  }

  return { ok: true, actorRole: input.actorRole, reason: input.reason };
}

function administrativeControl(input: Readonly<{
  operation: FollowUpAssignmentAdministrativeControl['operation'];
  actorRole: FollowUpAssignmentAdministrativeRole;
  reason: FollowUpAssignmentOverrideReason;
}>): FollowUpAssignmentAdministrativeControl {
  return {
    ...input,
    requiredActorRoles: FOLLOW_UP_ASSIGNMENT_ADMINISTRATIVE_ROLES,
    auditRequired: true,
  };
}

export function claimFollowUpRolePoolAssignment(input: Readonly<{
  assignment: FollowUpAssignment;
  expectedRevision: number;
  member: FollowUpAssignmentMember;
}>): FollowUpAssignmentResult {
  const { assignment, member } = input;
  if (!isValidAssignment(assignment)) return failure('invalid_assignment');
  if (
    !isNonEmptyText(member.institutionId) ||
    !isNonEmptyText(member.userId) ||
    !isFollowUpRolePoolRole(member.role) ||
    typeof member.active !== 'boolean'
  ) {
    return failure('invalid_member');
  }
  if (member.institutionId !== assignment.institutionId) return failure('scope_mismatch');
  if (!member.active) return failure('inactive_member');

  if (assignment.kind === 'user') {
    if (assignment.claimedFromRolePool === null) return failure('assignment_not_claimable');
    if (
      assignment.assigneeUserId !== member.userId ||
      assignment.claimedFromRolePool !== member.role
    ) {
      return failure('claim_conflict');
    }

    const isCurrentNoop = input.expectedRevision === assignment.revision;
    const isImmediateReplay =
      assignment.revision > 0 && input.expectedRevision === assignment.revision - 1;
    return isCurrentNoop || isImmediateReplay
      ? success(assignment, false)
      : failure('revision_conflict');
  }

  if (member.role !== assignment.role) return failure('role_mismatch');
  if (input.expectedRevision !== assignment.revision) return failure('revision_conflict');

  return success(
    {
      kind: 'user',
      institutionId: assignment.institutionId,
      revision: assignment.revision + 1,
      assigneeUserId: member.userId,
      claimedFromRolePool: assignment.role,
    },
    true,
  );
}

function readTargetAssignment(
  target: FollowUpAssignmentTarget,
  nextRevision: number,
): FollowUpAssignment | null {
  if (!isNonEmptyText(target.institutionId)) return null;

  if (target.kind === 'user') {
    return isNonEmptyText(target.assigneeUserId)
      ? {
          kind: 'user',
          institutionId: target.institutionId,
          revision: nextRevision,
          assigneeUserId: target.assigneeUserId,
          claimedFromRolePool: null,
        }
      : null;
  }

  if (target.kind === 'role_pool' && isFollowUpRolePoolRole(target.role)) {
    return {
      kind: 'role_pool',
      institutionId: target.institutionId,
      revision: nextRevision,
      role: target.role,
    };
  }

  return null;
}

function assignmentsMatch(left: FollowUpAssignment, right: FollowUpAssignment) {
  if (left.kind !== right.kind || left.institutionId !== right.institutionId) return false;
  if (left.kind === 'role_pool' && right.kind === 'role_pool') return left.role === right.role;
  if (left.kind === 'user' && right.kind === 'user') {
    return (
      left.assigneeUserId === right.assigneeUserId &&
      left.claimedFromRolePool === right.claimedFromRolePool
    );
  }
  return false;
}

export function reassignFollowUpAssignment(input: Readonly<{
  assignment: FollowUpAssignment;
  target: FollowUpAssignmentTarget;
  expectedRevision: number;
  institutionId: string;
  actorRole: unknown;
  reason: unknown;
}>): FollowUpAssignmentResult {
  const { assignment } = input;
  if (!isValidAssignment(assignment)) return failure('invalid_assignment');
  if (input.institutionId !== assignment.institutionId) return failure('scope_mismatch');

  const context = readAdministrativeContext(input);
  if (!context.ok) return failure(context.code);

  const target = readTargetAssignment(input.target, assignment.revision + 1);
  if (!target) return failure('invalid_target_assignment');
  if (target.institutionId !== assignment.institutionId) return failure('scope_mismatch');
  if (input.expectedRevision !== assignment.revision) return failure('revision_conflict');

  const control = administrativeControl({
    operation: 'reassign',
    actorRole: context.actorRole,
    reason: context.reason,
  });
  if (assignmentsMatch(assignment, target)) return success(assignment, false, control);

  return success(target, true, control);
}

export function unclaimFollowUpAssignment(input: Readonly<{
  assignment: FollowUpAssignment;
  expectedRevision: number;
  institutionId: string;
  actorRole: unknown;
  reason: unknown;
}>): FollowUpAssignmentResult {
  const { assignment } = input;
  if (!isValidAssignment(assignment)) return failure('invalid_assignment');
  if (input.institutionId !== assignment.institutionId) return failure('scope_mismatch');

  const context = readAdministrativeContext(input);
  if (!context.ok) return failure(context.code);
  if (input.expectedRevision !== assignment.revision) return failure('revision_conflict');

  const control = administrativeControl({
    operation: 'unclaim',
    actorRole: context.actorRole,
    reason: context.reason,
  });
  if (assignment.kind === 'role_pool') return success(assignment, false, control);
  if (assignment.claimedFromRolePool === null) return failure('assignment_not_claimed');

  return success(
    {
      kind: 'role_pool',
      institutionId: assignment.institutionId,
      revision: assignment.revision + 1,
      role: assignment.claimedFromRolePool,
    },
    true,
    control,
  );
}
