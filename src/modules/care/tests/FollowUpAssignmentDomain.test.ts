import { describe, expect, it } from 'vitest';
import {
  FOLLOW_UP_ASSIGNMENT_ADMINISTRATIVE_ROLES,
  FOLLOW_UP_ASSIGNMENT_KINDS,
  FOLLOW_UP_ROLE_POOL_ROLES,
  claimFollowUpRolePoolAssignment,
  isFollowUpAssignmentKind,
  isFollowUpRolePoolRole,
  reassignFollowUpAssignment,
  unclaimFollowUpAssignment,
} from '@/modules/care/domain/follow-up-assignment';
import type {
  FollowUpAssignment,
  FollowUpAssignmentMember,
  FollowUpRolePoolAssignment,
  FollowUpUserAssignment,
} from '@/modules/care/domain/follow-up-assignment';

function rolePoolAssignment(
  overrides: Partial<FollowUpRolePoolAssignment> = {},
): FollowUpRolePoolAssignment {
  return {
    kind: 'role_pool',
    institutionId: 'institution-a',
    revision: 4,
    role: 'consultant',
    ...overrides,
  };
}

function directUserAssignment(
  overrides: Partial<FollowUpUserAssignment> = {},
): FollowUpUserAssignment {
  return {
    kind: 'user',
    institutionId: 'institution-a',
    revision: 4,
    assigneeUserId: 'user-direct',
    claimedFromRolePool: null,
    ...overrides,
  };
}

function activeConsultant(overrides: Partial<FollowUpAssignmentMember> = {}) {
  return {
    institutionId: 'institution-a',
    userId: 'user-consultant',
    role: 'consultant',
    active: true,
    ...overrides,
  } satisfies FollowUpAssignmentMember;
}

describe('随访任务分配纯领域契约', () => {
  it('只允许 user/role_pool 和四个固定角色池', () => {
    expect(FOLLOW_UP_ASSIGNMENT_KINDS).toEqual(['user', 'role_pool']);
    expect(FOLLOW_UP_ROLE_POOL_ROLES).toEqual([
      'tenant_admin',
      'tenant_operator',
      'consultant',
      'customer_service',
    ]);
    expect(isFollowUpAssignmentKind('team')).toBe(false);
    expect(isFollowUpRolePoolRole('doctor')).toBe(false);
  });

  it('同机构同角色有效成员可按 expectedRevision 原子认领且输入不变', () => {
    const assignment = rolePoolAssignment();
    const member = activeConsultant();
    const assignmentBefore = structuredClone(assignment);
    const memberBefore = structuredClone(member);

    const claimed = claimFollowUpRolePoolAssignment({
      assignment,
      expectedRevision: 4,
      member,
    });

    expect(assignment).toEqual(assignmentBefore);
    expect(member).toEqual(memberBefore);
    expect(claimed).toEqual({
      ok: true,
      changed: true,
      assignment: {
        kind: 'user',
        institutionId: 'institution-a',
        revision: 5,
        assigneeUserId: 'user-consultant',
        claimedFromRolePool: 'consultant',
      },
    });
    if (!claimed.ok) throw new Error('expected claim success');

    expect(
      claimFollowUpRolePoolAssignment({
        assignment: claimed.assignment,
        expectedRevision: 4,
        member,
      }),
    ).toEqual({ ok: true, changed: false, assignment: claimed.assignment });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: claimed.assignment,
        expectedRevision: 5,
        member,
      }),
    ).toEqual({ ok: true, changed: false, assignment: claimed.assignment });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: claimed.assignment,
        expectedRevision: 3,
        member,
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: claimed.assignment,
        expectedRevision: 6,
        member,
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
  });

  it('具体员工任务不得认领，已被他人认领返回 claim_conflict', () => {
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: directUserAssignment(),
        expectedRevision: 4,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'assignment_not_claimable' });

    const claimedByOther: FollowUpUserAssignment = {
      kind: 'user',
      institutionId: 'institution-a',
      revision: 5,
      assigneeUserId: 'user-other',
      claimedFromRolePool: 'consultant',
    };
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: claimedByOther,
        expectedRevision: 4,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'claim_conflict' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: claimedByOther,
        expectedRevision: 99,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'claim_conflict' });
  });

  it('区分 revision_conflict，并拒绝跨机构、角色不匹配和无效成员', () => {
    const assignment = rolePoolAssignment();

    expect(
      claimFollowUpRolePoolAssignment({
        assignment,
        expectedRevision: 3,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment,
        expectedRevision: 4,
        member: activeConsultant({ institutionId: 'institution-b' }),
      }),
    ).toEqual({ ok: false, code: 'scope_mismatch' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment,
        expectedRevision: 4,
        member: activeConsultant({ role: 'customer_service' }),
      }),
    ).toEqual({ ok: false, code: 'role_mismatch' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment,
        expectedRevision: 4,
        member: activeConsultant({ active: false }),
      }),
    ).toEqual({ ok: false, code: 'inactive_member' });
  });

  it('改派只接受管理员/运营及受控 reason，并返回审计要求而不写审计', () => {
    const assignment = directUserAssignment();

    expect(
      reassignFollowUpAssignment({
        assignment,
        target: { kind: 'role_pool', institutionId: 'institution-a', role: 'customer_service' },
        expectedRevision: 4,
        institutionId: 'institution-a',
        actorRole: 'consultant',
        reason: 'workload_rebalance',
      }),
    ).toEqual({ ok: false, code: 'administrative_role_required' });
    expect(
      reassignFollowUpAssignment({
        assignment,
        target: { kind: 'role_pool', institutionId: 'institution-a', role: 'customer_service' },
        expectedRevision: 4,
        institutionId: 'institution-a',
        actorRole: 'tenant_admin',
        reason: 'free text',
      }),
    ).toEqual({ ok: false, code: 'invalid_override_reason' });

    const reassigned = reassignFollowUpAssignment({
      assignment,
      target: { kind: 'role_pool', institutionId: 'institution-a', role: 'customer_service' },
      expectedRevision: 4,
      institutionId: 'institution-a',
      actorRole: 'tenant_admin',
      reason: 'workload_rebalance',
    });
    expect(reassigned).toEqual({
      ok: true,
      changed: true,
      assignment: {
        kind: 'role_pool',
        institutionId: 'institution-a',
        revision: 5,
        role: 'customer_service',
      },
      control: {
        operation: 'reassign',
        actorRole: 'tenant_admin',
        reason: 'workload_rebalance',
        requiredActorRoles: FOLLOW_UP_ASSIGNMENT_ADMINISTRATIVE_ROLES,
        auditRequired: true,
      },
    });

    const claimed: FollowUpUserAssignment = {
      kind: 'user',
      institutionId: 'institution-a',
      revision: 5,
      assigneeUserId: 'user-consultant',
      claimedFromRolePool: 'consultant',
    };
    const claimedBefore = structuredClone(claimed);
    const convertedToDirect = reassignFollowUpAssignment({
      assignment: claimed,
      target: {
        kind: 'user',
        institutionId: 'institution-a',
        assigneeUserId: 'user-consultant',
      },
      expectedRevision: 5,
      institutionId: 'institution-a',
      actorRole: 'tenant_admin',
      reason: 'assignment_correction',
    });
    expect(claimed).toEqual(claimedBefore);
    expect(convertedToDirect).toMatchObject({
      ok: true,
      changed: true,
      assignment: {
        kind: 'user',
        revision: 6,
        assigneeUserId: 'user-consultant',
        claimedFromRolePool: null,
      },
    });
    if (!convertedToDirect.ok) throw new Error('expected direct reassignment success');
    expect(
      unclaimFollowUpAssignment({
        assignment: convertedToDirect.assignment,
        expectedRevision: 6,
        institutionId: 'institution-a',
        actorRole: 'tenant_admin',
        reason: 'assignment_correction',
      }),
    ).toEqual({ ok: false, code: 'assignment_not_claimed' });
  });

  it('改派对跨机构目标、未知角色池和旧 revision fail-closed', () => {
    const assignment = directUserAssignment();

    expect(
      reassignFollowUpAssignment({
        assignment,
        target: { kind: 'user', institutionId: 'institution-b', assigneeUserId: 'user-next' },
        expectedRevision: 4,
        institutionId: 'institution-a',
        actorRole: 'tenant_operator',
        reason: 'assignment_correction',
      }),
    ).toEqual({ ok: false, code: 'scope_mismatch' });
    expect(
      reassignFollowUpAssignment({
        assignment,
        target: { kind: 'role_pool', institutionId: 'institution-a', role: 'doctor' },
        expectedRevision: 4,
        institutionId: 'institution-a',
        actorRole: 'tenant_operator',
        reason: 'assignment_correction',
      }),
    ).toEqual({ ok: false, code: 'invalid_target_assignment' });
    expect(
      reassignFollowUpAssignment({
        assignment,
        target: { kind: 'user', institutionId: 'institution-a', assigneeUserId: 'user-next' },
        expectedRevision: 3,
        institutionId: 'institution-a',
        actorRole: 'tenant_operator',
        reason: 'assignment_correction',
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
  });

  it('撤销认领恢复原角色池并携带管理员/运营受控 reason 要求', () => {
    const claimed: FollowUpUserAssignment = {
      kind: 'user',
      institutionId: 'institution-a',
      revision: 5,
      assigneeUserId: 'user-consultant',
      claimedFromRolePool: 'consultant',
    };
    const before = structuredClone(claimed);

    expect(
      unclaimFollowUpAssignment({
        assignment: claimed,
        expectedRevision: 5,
        institutionId: 'institution-a',
        actorRole: 'consultant',
        reason: 'member_unavailable',
      }),
    ).toEqual({ ok: false, code: 'administrative_role_required' });
    expect(
      unclaimFollowUpAssignment({
        assignment: claimed,
        expectedRevision: 5,
        institutionId: 'institution-a',
        actorRole: 'tenant_operator',
        reason: '',
      }),
    ).toEqual({ ok: false, code: 'override_reason_required' });
    expect(
      unclaimFollowUpAssignment({
        assignment: claimed,
        expectedRevision: 5,
        institutionId: 'institution-a',
        actorRole: 'tenant_operator',
        reason: 'free text',
      }),
    ).toEqual({ ok: false, code: 'invalid_override_reason' });
    expect(
      unclaimFollowUpAssignment({
        assignment: claimed,
        expectedRevision: 5,
        institutionId: 'institution-b',
        actorRole: 'tenant_operator',
        reason: 'member_unavailable',
      }),
    ).toEqual({ ok: false, code: 'scope_mismatch' });

    const unclaimed = unclaimFollowUpAssignment({
      assignment: claimed,
      expectedRevision: 5,
      institutionId: 'institution-a',
      actorRole: 'tenant_operator',
      reason: 'member_unavailable',
    });

    expect(claimed).toEqual(before);
    expect(unclaimed).toEqual({
      ok: true,
      changed: true,
      assignment: {
        kind: 'role_pool',
        institutionId: 'institution-a',
        revision: 6,
        role: 'consultant',
      },
      control: {
        operation: 'unclaim',
        actorRole: 'tenant_operator',
        reason: 'member_unavailable',
        requiredActorRoles: FOLLOW_UP_ASSIGNMENT_ADMINISTRATIVE_ROLES,
        auditRequired: true,
      },
    });
  });

  it('直接分配员工不得撤销认领，已是角色池时同一命令不产生变化', () => {
    expect(
      unclaimFollowUpAssignment({
        assignment: directUserAssignment(),
        expectedRevision: 4,
        institutionId: 'institution-a',
        actorRole: 'tenant_admin',
        reason: 'assignment_correction',
      }),
    ).toEqual({ ok: false, code: 'assignment_not_claimed' });

    const pool = rolePoolAssignment();
    expect(
      unclaimFollowUpAssignment({
        assignment: pool,
        expectedRevision: 4,
        institutionId: 'institution-a',
        actorRole: 'tenant_admin',
        reason: 'assignment_correction',
      }),
    ).toEqual({
      ok: true,
      changed: false,
      assignment: pool,
      control: {
        operation: 'unclaim',
        actorRole: 'tenant_admin',
        reason: 'assignment_correction',
        requiredActorRoles: FOLLOW_UP_ASSIGNMENT_ADMINISTRATIVE_ROLES,
        auditRequired: true,
      },
    });
  });

  it('拒绝不完整或非法 assignment 快照', () => {
    const invalidAssignment = {
      kind: 'role_pool',
      institutionId: 'institution-a',
      revision: 1,
      role: 'doctor',
    } as unknown as FollowUpAssignment;

    expect(
      claimFollowUpRolePoolAssignment({
        assignment: invalidAssignment,
        expectedRevision: 1,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'invalid_assignment' });

    const invalidKind = {
      kind: 'team',
      institutionId: 'institution-a',
      revision: 1,
      assigneeUserId: 'user-team',
      claimedFromRolePool: null,
    } as unknown as FollowUpAssignment;
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: invalidKind,
        expectedRevision: 1,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'invalid_assignment' });
  });
});
