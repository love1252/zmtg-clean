export const FOLLOW_UP_ROLE_POOL_ROLES = [
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
] as const;

export type FollowUpRolePoolRole = (typeof FOLLOW_UP_ROLE_POOL_ROLES)[number];

export type FollowUpAssignmentMember = Readonly<{
  institutionId: string;
  userId: string;
  role: FollowUpRolePoolRole;
  active: boolean;
}>;

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

export const FOLLOW_UP_ASSIGNMENT_ELIGIBILITY_ERROR_CODES = [
  'invalid_command_context',
  'invalid_member',
  'invalid_target_assignment',
  'target_member_required',
  'member_mismatch',
  'scope_mismatch',
  'inactive_member',
  'role_mismatch',
] as const;

export type FollowUpAssignmentEligibilityError =
  (typeof FOLLOW_UP_ASSIGNMENT_ELIGIBILITY_ERROR_CODES)[number];

type FollowUpAssignmentMemberEligibilityResult =
  | Readonly<{ ok: true; userId: string }>
  | Readonly<{ ok: false; code: FollowUpAssignmentEligibilityError }>;

type ValidatedFollowUpAssignmentTarget =
  | Readonly<{
      kind: 'user';
      institutionId: string;
      assigneeUserId: string;
    }>
  | Readonly<{
      kind: 'role_pool';
      institutionId: string;
      role: FollowUpRolePoolRole;
    }>;

type FollowUpAssignmentTargetEligibilityResult =
  | Readonly<{ ok: true; target: ValidatedFollowUpAssignmentTarget }>
  | Readonly<{ ok: false; code: FollowUpAssignmentEligibilityError }>;

function includesValue(values: readonly string[], value: unknown): value is string {
  return typeof value === 'string' && values.includes(value);
}

function isStableIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f-\u009f]/u.test(value)
  );
}

function hasExactKeys(value: object, expectedKeys: readonly string[]) {
  const keys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

export function isFollowUpRolePoolRole(value: unknown): value is FollowUpRolePoolRole {
  return includesValue(FOLLOW_UP_ROLE_POOL_ROLES, value);
}

function readMember(value: unknown): FollowUpAssignmentMember | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  if (!hasExactKeys(value, ['institutionId', 'userId', 'role', 'active'])) return null;

  const member = value as Record<string, unknown>;
  if (
    !isStableIdentifier(member.institutionId) ||
    !isStableIdentifier(member.userId) ||
    !isFollowUpRolePoolRole(member.role) ||
    typeof member.active !== 'boolean'
  ) {
    return null;
  }

  return {
    institutionId: member.institutionId,
    userId: member.userId,
    role: member.role,
    active: member.active,
  };
}

export function checkFollowUpAssignmentMemberEligibility(input: Readonly<{
  institutionId: unknown;
  expectedUserId: unknown;
  requiredRole: unknown;
  member: unknown;
}>): FollowUpAssignmentMemberEligibilityResult {
  if (
    !isStableIdentifier(input.institutionId) ||
    !isStableIdentifier(input.expectedUserId) ||
    (input.requiredRole !== null && !isFollowUpRolePoolRole(input.requiredRole))
  ) {
    return { ok: false, code: 'invalid_command_context' };
  }

  const member = readMember(input.member);
  if (!member) return { ok: false, code: 'invalid_member' };
  if (member.institutionId !== input.institutionId) {
    return { ok: false, code: 'scope_mismatch' };
  }
  if (!member.active) return { ok: false, code: 'inactive_member' };
  if (member.userId !== input.expectedUserId) {
    return { ok: false, code: 'member_mismatch' };
  }
  if (input.requiredRole !== null && member.role !== input.requiredRole) {
    return { ok: false, code: 'role_mismatch' };
  }

  return { ok: true, userId: member.userId };
}

export function checkFollowUpAssignmentTargetEligibility(input: Readonly<{
  institutionId: unknown;
  target: unknown;
  targetMember: unknown;
}>): FollowUpAssignmentTargetEligibilityResult {
  if (!isStableIdentifier(input.institutionId)) {
    return { ok: false, code: 'invalid_command_context' };
  }
  if (typeof input.target !== 'object' || input.target === null || Array.isArray(input.target)) {
    return { ok: false, code: 'invalid_target_assignment' };
  }

  const target = input.target as Record<string, unknown>;
  if (target.kind === 'user') {
    if (!hasExactKeys(target, ['kind', 'institutionId', 'assigneeUserId'])) {
      return { ok: false, code: 'invalid_target_assignment' };
    }
    if (!isStableIdentifier(target.institutionId) || !isStableIdentifier(target.assigneeUserId)) {
      return { ok: false, code: 'invalid_target_assignment' };
    }
    if (target.institutionId !== input.institutionId) {
      return { ok: false, code: 'scope_mismatch' };
    }
    if (input.targetMember === null || input.targetMember === undefined) {
      return { ok: false, code: 'target_member_required' };
    }

    const memberResult = checkFollowUpAssignmentMemberEligibility({
      institutionId: input.institutionId,
      expectedUserId: target.assigneeUserId,
      requiredRole: null,
      member: input.targetMember,
    });
    if (!memberResult.ok) return memberResult;

    return {
      ok: true,
      target: {
        kind: 'user',
        institutionId: target.institutionId,
        assigneeUserId: target.assigneeUserId,
      },
    };
  }

  if (target.kind === 'role_pool') {
    if (!hasExactKeys(target, ['kind', 'institutionId', 'role'])) {
      return { ok: false, code: 'invalid_target_assignment' };
    }
    if (!isStableIdentifier(target.institutionId) || !isFollowUpRolePoolRole(target.role)) {
      return { ok: false, code: 'invalid_target_assignment' };
    }
    if (target.institutionId !== input.institutionId) {
      return { ok: false, code: 'scope_mismatch' };
    }
    if (input.targetMember !== null) return { ok: false, code: 'member_mismatch' };

    return {
      ok: true,
      target: {
        kind: 'role_pool',
        institutionId: target.institutionId,
        role: target.role,
      },
    };
  }

  return { ok: false, code: 'invalid_target_assignment' };
}
