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

function snapshotExactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some(
        (key) => typeof key !== 'string' || !expectedKeys.includes(key),
      )
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

export function isFollowUpRolePoolRole(value: unknown): value is FollowUpRolePoolRole {
  return includesValue(FOLLOW_UP_ROLE_POOL_ROLES, value);
}

function readMember(value: unknown): FollowUpAssignmentMember | null {
  const member = snapshotExactDataRecord(value, [
    'institutionId',
    'userId',
    'role',
    'active',
  ]);
  if (!member) return null;
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
  const command = snapshotExactDataRecord(input, [
    'institutionId',
    'expectedUserId',
    'requiredRole',
    'member',
  ]);
  if (!command) return { ok: false, code: 'invalid_command_context' };
  if (
    !isStableIdentifier(command.institutionId) ||
    !isStableIdentifier(command.expectedUserId) ||
    (command.requiredRole !== null && !isFollowUpRolePoolRole(command.requiredRole))
  ) {
    return { ok: false, code: 'invalid_command_context' };
  }

  const member = readMember(command.member);
  if (!member) return { ok: false, code: 'invalid_member' };
  if (member.institutionId !== command.institutionId) {
    return { ok: false, code: 'scope_mismatch' };
  }
  if (!member.active) return { ok: false, code: 'inactive_member' };
  if (member.userId !== command.expectedUserId) {
    return { ok: false, code: 'member_mismatch' };
  }
  if (command.requiredRole !== null && member.role !== command.requiredRole) {
    return { ok: false, code: 'role_mismatch' };
  }

  return { ok: true, userId: member.userId };
}

export function checkFollowUpAssignmentTargetEligibility(input: Readonly<{
  institutionId: unknown;
  target: unknown;
  targetMember: unknown;
}>): FollowUpAssignmentTargetEligibilityResult {
  const command = snapshotExactDataRecord(input, [
    'institutionId',
    'target',
    'targetMember',
  ]);
  if (!command || !isStableIdentifier(command.institutionId)) {
    return { ok: false, code: 'invalid_command_context' };
  }
  const target =
    snapshotExactDataRecord(command.target, [
      'kind',
      'institutionId',
      'assigneeUserId',
    ]) ?? snapshotExactDataRecord(command.target, ['kind', 'institutionId', 'role']);
  if (!target) {
    return { ok: false, code: 'invalid_target_assignment' };
  }

  if (target.kind === 'user') {
    if (!isStableIdentifier(target.institutionId) || !isStableIdentifier(target.assigneeUserId)) {
      return { ok: false, code: 'invalid_target_assignment' };
    }
    if (target.institutionId !== command.institutionId) {
      return { ok: false, code: 'scope_mismatch' };
    }
    if (command.targetMember === null || command.targetMember === undefined) {
      return { ok: false, code: 'target_member_required' };
    }

    const memberResult = checkFollowUpAssignmentMemberEligibility({
      institutionId: command.institutionId,
      expectedUserId: target.assigneeUserId,
      requiredRole: null,
      member: command.targetMember,
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
    if (!isStableIdentifier(target.institutionId) || !isFollowUpRolePoolRole(target.role)) {
      return { ok: false, code: 'invalid_target_assignment' };
    }
    if (target.institutionId !== command.institutionId) {
      return { ok: false, code: 'scope_mismatch' };
    }
    if (command.targetMember !== null) return { ok: false, code: 'member_mismatch' };

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
