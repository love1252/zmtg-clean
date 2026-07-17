import {
  checkFollowUpAssignmentMemberEligibility,
  checkFollowUpAssignmentTargetEligibility,
  isFollowUpRolePoolRole,
} from './follow-up-assignment-eligibility';
import type {
  FollowUpAssignmentEligibilityError,
  FollowUpAssignmentTarget,
  FollowUpRolePoolRole,
} from './follow-up-assignment-eligibility';
import { checkFollowUpCommandPreconditions } from './follow-up-command-preconditions';

export { FOLLOW_UP_ROLE_POOL_ROLES, isFollowUpRolePoolRole } from './follow-up-assignment-eligibility';
export type {
  FollowUpAssignmentMember,
  FollowUpAssignmentTarget,
  FollowUpRolePoolRole,
} from './follow-up-assignment-eligibility';

export const FOLLOW_UP_ASSIGNMENT_KINDS = ['user', 'role_pool'] as const;

export type FollowUpAssignmentKind = (typeof FOLLOW_UP_ASSIGNMENT_KINDS)[number];

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

export type FollowUpAssignmentAdministrativeControl = Readonly<{
  operation: 'reassign' | 'unclaim';
  actorRole: FollowUpAssignmentAdministrativeRole;
  reason: FollowUpAssignmentOverrideReason;
  requiredActorRoles: typeof FOLLOW_UP_ASSIGNMENT_ADMINISTRATIVE_ROLES;
  authorizationRequired: true;
  auditRequired: true;
}>;

export type FollowUpAssignmentError =
  | FollowUpAssignmentEligibilityError
  | 'invalid_assignment'
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
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f-\u009f]/u.test(value)
  );
}

export function isFollowUpAssignmentKind(value: unknown): value is FollowUpAssignmentKind {
  return includesValue(FOLLOW_UP_ASSIGNMENT_KINDS, value);
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
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isValidAssignment(value: unknown): value is FollowUpAssignment {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

  const assignment = value as Record<string, unknown>;
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

function checkAssignmentCommandPreconditions(input: Readonly<{
  assignment: FollowUpAssignment;
  institutionId: unknown;
  expectedRevision: unknown;
}>): FollowUpAssignmentResult | null {
  const result = checkFollowUpCommandPreconditions({
    taskInstitutionId: input.assignment.institutionId,
    currentRevision: input.assignment.revision,
    institutionId: input.institutionId,
    expectedRevision: input.expectedRevision,
  });

  return result.ok ? null : failure(result.code);
}

function nextRevision(assignment: FollowUpAssignment): number | null {
  return assignment.revision < Number.MAX_SAFE_INTEGER ? assignment.revision + 1 : null;
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
    authorizationRequired: true,
    auditRequired: true,
  };
}

export function claimFollowUpRolePoolAssignment(input: Readonly<{
  assignment: FollowUpAssignment;
  institutionId: unknown;
  actorUserId: unknown;
  expectedRevision: unknown;
  member: unknown;
}>): FollowUpAssignmentResult {
  const { assignment } = input;
  if (!isValidAssignment(assignment)) return failure('invalid_assignment');
  const preconditionFailure = checkAssignmentCommandPreconditions(input);
  if (preconditionFailure) return preconditionFailure;

  const requiredRole =
    assignment.kind === 'role_pool' ? assignment.role : assignment.claimedFromRolePool;
  const memberResult = checkFollowUpAssignmentMemberEligibility({
    institutionId: assignment.institutionId,
    expectedUserId: input.actorUserId,
    requiredRole,
    member: input.member,
  });
  if (!memberResult.ok) return failure(memberResult.code);

  if (assignment.kind === 'user') {
    if (assignment.claimedFromRolePool === null) return failure('assignment_not_claimable');
    return assignment.assigneeUserId === memberResult.userId
      ? success(assignment, false)
      : failure('claim_conflict');
  }

  const revision = nextRevision(assignment);
  if (revision === null) return failure('invalid_command_context');

  return success(
    {
      kind: 'user',
      institutionId: assignment.institutionId,
      revision,
      assigneeUserId: memberResult.userId,
      claimedFromRolePool: assignment.role,
    },
    true,
  );
}

function assignmentFromTarget(
  target: FollowUpAssignmentTarget,
  revision: number,
): FollowUpAssignment | null {
  if (target.kind === 'user') {
    return {
      kind: 'user',
      institutionId: target.institutionId,
      revision,
      assigneeUserId: target.assigneeUserId,
      claimedFromRolePool: null,
    };
  }

  if (isFollowUpRolePoolRole(target.role)) {
    return {
      kind: 'role_pool',
      institutionId: target.institutionId,
      revision,
      role: target.role,
    };
  }

  return null;
}

function assignmentMatchesTarget(left: FollowUpAssignment, right: FollowUpAssignmentTarget) {
  if (left.kind !== right.kind || left.institutionId !== right.institutionId) return false;
  if (left.kind === 'role_pool' && right.kind === 'role_pool') return left.role === right.role;
  if (left.kind === 'user' && right.kind === 'user') {
    return left.assigneeUserId === right.assigneeUserId && left.claimedFromRolePool === null;
  }
  return false;
}

export function reassignFollowUpAssignment(input: Readonly<{
  assignment: FollowUpAssignment;
  target: FollowUpAssignmentTarget;
  targetMember: unknown;
  expectedRevision: unknown;
  institutionId: unknown;
  actorRole: unknown;
  reason: unknown;
}>): FollowUpAssignmentResult {
  const { assignment } = input;
  if (!isValidAssignment(assignment)) return failure('invalid_assignment');
  const preconditionFailure = checkAssignmentCommandPreconditions(input);
  if (preconditionFailure) return preconditionFailure;

  const context = readAdministrativeContext(input);
  if (!context.ok) return failure(context.code);

  const targetResult = checkFollowUpAssignmentTargetEligibility({
    institutionId: assignment.institutionId,
    target: input.target,
    targetMember: input.targetMember,
  });
  if (!targetResult.ok) return failure(targetResult.code);

  const control = administrativeControl({
    operation: 'reassign',
    actorRole: context.actorRole,
    reason: context.reason,
  });
  if (assignmentMatchesTarget(assignment, targetResult.target)) {
    return success(assignment, false, control);
  }

  const revision = nextRevision(assignment);
  if (revision === null) return failure('invalid_command_context');

  const target = assignmentFromTarget(targetResult.target, revision);
  if (!target) return failure('invalid_target_assignment');

  return success(target, true, control);
}

export function unclaimFollowUpAssignment(input: Readonly<{
  assignment: FollowUpAssignment;
  expectedRevision: unknown;
  institutionId: unknown;
  actorRole: unknown;
  reason: unknown;
}>): FollowUpAssignmentResult {
  const { assignment } = input;
  if (!isValidAssignment(assignment)) return failure('invalid_assignment');
  const preconditionFailure = checkAssignmentCommandPreconditions(input);
  if (preconditionFailure) return preconditionFailure;

  const context = readAdministrativeContext(input);
  if (!context.ok) return failure(context.code);

  const control = administrativeControl({
    operation: 'unclaim',
    actorRole: context.actorRole,
    reason: context.reason,
  });
  if (assignment.kind === 'role_pool') return success(assignment, false, control);
  if (assignment.claimedFromRolePool === null) return failure('assignment_not_claimed');

  const revision = nextRevision(assignment);
  if (revision === null) return failure('invalid_command_context');

  return success(
    {
      kind: 'role_pool',
      institutionId: assignment.institutionId,
      revision,
      role: assignment.claimedFromRolePool,
    },
    true,
    control,
  );
}
