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

  it('同机构同角色有效成员可按 expectedRevision 计算认领结果且输入不变', () => {
    const assignment = rolePoolAssignment();
    const member = activeConsultant();
    const assignmentBefore = structuredClone(assignment);
    const memberBefore = structuredClone(member);

    const claimed = claimFollowUpRolePoolAssignment({
      assignment,
      institutionId: 'institution-a',
      actorUserId: 'user-consultant',
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
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 4,
        member,
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: claimed.assignment,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 5,
        member,
      }),
    ).toEqual({ ok: true, changed: false, assignment: claimed.assignment });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: claimed.assignment,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 3,
        member,
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: claimed.assignment,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 6,
        member,
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
  });

  it('具体员工任务不得认领，已被他人认领返回 claim_conflict', () => {
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: directUserAssignment(),
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 4,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'assignment_not_claimable' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: directUserAssignment(),
        institutionId: 'institution-a',
        actorUserId: null,
        expectedRevision: 4,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'invalid_command_context' });

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
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 4,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: claimedByOther,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 99,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: claimedByOther,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 5,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'claim_conflict' });
  });

  it('区分 revision_conflict，并拒绝跨机构、角色不匹配和无效成员', () => {
    const assignment = rolePoolAssignment();

    expect(
      claimFollowUpRolePoolAssignment({
        assignment,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 3,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 4,
        member: activeConsultant({ institutionId: 'institution-b' }),
      }),
    ).toEqual({ ok: false, code: 'scope_mismatch' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 4,
        member: activeConsultant({ role: 'customer_service' }),
      }),
    ).toEqual({ ok: false, code: 'role_mismatch' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 4,
        member: activeConsultant({ active: false }),
      }),
    ).toEqual({ ok: false, code: 'inactive_member' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment,
        institutionId: 'institution-a',
        actorUserId: 'user-other',
        expectedRevision: 4,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'member_mismatch' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment,
        institutionId: 'institution-a',
        actorUserId: null,
        expectedRevision: 4,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'invalid_command_context' });
  });

  it('改派只表达管理员/运营及受控 reason 前置要求，不代表已授权或已写审计', () => {
    const assignment = directUserAssignment();

    expect(
      reassignFollowUpAssignment({
        assignment,
        target: { kind: 'role_pool', institutionId: 'institution-a', role: 'customer_service' },
        targetMember: null,
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
        targetMember: null,
        expectedRevision: 4,
        institutionId: 'institution-a',
        actorRole: 'tenant_admin',
        reason: 'free text',
      }),
    ).toEqual({ ok: false, code: 'invalid_override_reason' });

    const reassigned = reassignFollowUpAssignment({
      assignment,
      target: { kind: 'role_pool', institutionId: 'institution-a', role: 'customer_service' },
      targetMember: null,
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
        authorizationRequired: true,
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
      targetMember: activeConsultant(),
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
        targetMember: activeConsultant({
          institutionId: 'institution-b',
          userId: 'user-next',
        }),
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
        targetMember: null,
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
        targetMember: activeConsultant({ userId: 'user-next' }),
        expectedRevision: 3,
        institutionId: 'institution-a',
        actorRole: 'tenant_operator',
        reason: 'assignment_correction',
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
  });

  it('具体员工改派必须重验目标成员事实且当前同事实可幂等', () => {
    const assignment = directUserAssignment();
    const target = {
      kind: 'user' as const,
      institutionId: 'institution-a',
      assigneeUserId: 'user-direct',
    };
    const validInput = {
      assignment,
      target,
      targetMember: activeConsultant({ userId: 'user-direct' }),
      expectedRevision: 4,
      institutionId: 'institution-a',
      actorRole: 'tenant_operator',
      reason: 'assignment_correction',
    } as const;

    expect(reassignFollowUpAssignment(validInput)).toEqual({
      ok: true,
      changed: false,
      assignment,
      control: {
        operation: 'reassign',
        actorRole: 'tenant_operator',
        reason: 'assignment_correction',
        requiredActorRoles: FOLLOW_UP_ASSIGNMENT_ADMINISTRATIVE_ROLES,
        authorizationRequired: true,
        auditRequired: true,
      },
    });
    expect(
      reassignFollowUpAssignment({ ...validInput, expectedRevision: 3 }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
    expect(
      reassignFollowUpAssignment({ ...validInput, targetMember: null }),
    ).toEqual({ ok: false, code: 'target_member_required' });
    expect(
      reassignFollowUpAssignment({
        ...validInput,
        targetMember: activeConsultant({ userId: 'user-other' }),
      }),
    ).toEqual({ ok: false, code: 'member_mismatch' });
    expect(
      reassignFollowUpAssignment({
        ...validInput,
        targetMember: activeConsultant({ userId: 'user-direct', active: false }),
      }),
    ).toEqual({ ok: false, code: 'inactive_member' });
    expect(
      reassignFollowUpAssignment({
        ...validInput,
        target: {
          kind: 'role_pool',
          institutionId: 'institution-a',
          role: 'consultant',
        },
        targetMember: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'member_mismatch' });
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
        authorizationRequired: true,
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
        authorizationRequired: true,
        auditRequired: true,
      },
    });
  });

  it('安全整数上界只允许当前事实 no-op，任何变化不得溢出', () => {
    const lastRevision = Number.MAX_SAFE_INTEGER - 1;
    const claimed = claimFollowUpRolePoolAssignment({
      assignment: rolePoolAssignment({ revision: lastRevision }),
      institutionId: 'institution-a',
      actorUserId: 'user-consultant',
      expectedRevision: lastRevision,
      member: activeConsultant(),
    });
    expect(claimed).toMatchObject({
      ok: true,
      changed: true,
      assignment: { revision: Number.MAX_SAFE_INTEGER },
    });
    if (!claimed.ok) throw new Error('expected upper-bound claim success');

    expect(
      claimFollowUpRolePoolAssignment({
        assignment: claimed.assignment,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: Number.MAX_SAFE_INTEGER,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: true, changed: false, assignment: claimed.assignment });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: rolePoolAssignment({ revision: Number.MAX_SAFE_INTEGER }),
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: Number.MAX_SAFE_INTEGER,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'invalid_command_context' });

    const directAtLimit = directUserAssignment({ revision: Number.MAX_SAFE_INTEGER });
    expect(
      reassignFollowUpAssignment({
        assignment: directAtLimit,
        target: {
          kind: 'user',
          institutionId: 'institution-a',
          assigneeUserId: 'user-direct',
        },
        targetMember: activeConsultant({ userId: 'user-direct' }),
        expectedRevision: Number.MAX_SAFE_INTEGER,
        institutionId: 'institution-a',
        actorRole: 'tenant_admin',
        reason: 'assignment_correction',
      }),
    ).toMatchObject({ ok: true, changed: false, assignment: directAtLimit });
    expect(
      reassignFollowUpAssignment({
        assignment: directAtLimit,
        target: {
          kind: 'role_pool',
          institutionId: 'institution-a',
          role: 'consultant',
        },
        targetMember: null,
        expectedRevision: Number.MAX_SAFE_INTEGER,
        institutionId: 'institution-a',
        actorRole: 'tenant_admin',
        reason: 'assignment_correction',
      }),
    ).toEqual({ ok: false, code: 'invalid_command_context' });
    expect(
      unclaimFollowUpAssignment({
        assignment: claimed.assignment,
        expectedRevision: Number.MAX_SAFE_INTEGER,
        institutionId: 'institution-a',
        actorRole: 'tenant_admin',
        reason: 'assignment_correction',
      }),
    ).toEqual({ ok: false, code: 'invalid_command_context' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: rolePoolAssignment({ revision: Number.MAX_SAFE_INTEGER + 1 }),
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: Number.MAX_SAFE_INTEGER + 1,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'invalid_assignment' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: rolePoolAssignment(),
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: Number.MAX_SAFE_INTEGER + 1,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'invalid_command_context' });
  });

  it('拒绝不完整、非法或非对象 assignment 快照', () => {
    const invalidAssignment = {
      kind: 'role_pool',
      institutionId: 'institution-a',
      revision: 1,
      role: 'doctor',
    } as unknown as FollowUpAssignment;

    expect(
      claimFollowUpRolePoolAssignment({
        assignment: invalidAssignment,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
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
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 1,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'invalid_assignment' });

    for (const nonObject of [null, undefined, []]) {
      const invalid = nonObject as unknown as FollowUpAssignment;
      expect(
        claimFollowUpRolePoolAssignment({
          assignment: invalid,
          institutionId: 'institution-a',
          actorUserId: 'user-consultant',
          expectedRevision: 1,
          member: activeConsultant(),
        }),
      ).toEqual({ ok: false, code: 'invalid_assignment' });
      expect(
        reassignFollowUpAssignment({
          assignment: invalid,
          target: { kind: 'role_pool', institutionId: 'institution-a', role: 'consultant' },
          targetMember: null,
          expectedRevision: 1,
          institutionId: 'institution-a',
          actorRole: 'tenant_admin',
          reason: 'assignment_correction',
        }),
      ).toEqual({ ok: false, code: 'invalid_assignment' });
      expect(
        unclaimFollowUpAssignment({
          assignment: invalid,
          expectedRevision: 1,
          institutionId: 'institution-a',
          actorRole: 'tenant_admin',
          reason: 'assignment_correction',
        }),
      ).toEqual({ ok: false, code: 'invalid_assignment' });
    }
  });

  it('将 hostile command、assignment、member 和 target 快照 fail-closed，且不抛异常', () => {
    const validClaimCommand = {
      assignment: rolePoolAssignment(),
      institutionId: 'institution-a',
      actorUserId: 'user-consultant',
      expectedRevision: 4,
      member: activeConsultant(),
    };
    const hostileCommand = new Proxy(
      validClaimCommand,
      {
        ownKeys() {
          throw new Error('hostile command');
        },
      },
    );
    const hostileAssignment = new Proxy(rolePoolAssignment(), {
      getOwnPropertyDescriptor() {
        throw new Error('hostile assignment');
      },
    });
    const hostileMember = new Proxy(activeConsultant(), {
      ownKeys() {
        throw new Error('hostile member');
      },
    });
    const hostileTarget = new Proxy(
      { kind: 'role_pool', institutionId: 'institution-a', role: 'consultant' },
      {
        getPrototypeOf() {
          throw new Error('hostile target');
        },
      },
    );
    let descriptorAmplificationCommandDescriptorCalls = 0;
    let descriptorAmplificationMemberDescriptorCalls = 0;
    const descriptorAmplificationCommand = new Proxy(
      {
        ...validClaimCommand,
        ...Object.fromEntries(
          Array.from({ length: 2048 }, (_, index) => [`extra_${index}`, index]),
        ),
      },
      {
        getOwnPropertyDescriptor(target, key) {
          descriptorAmplificationCommandDescriptorCalls += 1;
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      },
    );
    const descriptorAmplificationMember = new Proxy(
      {
        ...activeConsultant(),
        ...Object.fromEntries(
          Array.from({ length: 2048 }, (_, index) => [`extra_${index}`, index]),
        ),
      },
      {
        getOwnPropertyDescriptor(target, key) {
          descriptorAmplificationMemberDescriptorCalls += 1;
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
      },
    );
    const accessorCommand = { ...validClaimCommand };
    let accessorReads = 0;
    Object.defineProperty(accessorCommand, 'member', {
      enumerable: true,
      get() {
        accessorReads += 1;
        return validClaimCommand.member;
      },
    });
    const hiddenFieldCommand = { ...validClaimCommand };
    Object.defineProperty(hiddenFieldCommand, 'hidden', {
      enumerable: false,
      value: 'hidden',
    });
    const symbolFieldCommand = { ...validClaimCommand };
    Object.defineProperty(symbolFieldCommand, Symbol('hidden'), {
      enumerable: true,
      value: 'hidden',
    });
    const revokedCommand = Proxy.revocable({ ...validClaimCommand }, {});
    revokedCommand.revoke();
    const nullPrototypeCommand = Object.assign(Object.create(null), validClaimCommand);

    expect(() => claimFollowUpRolePoolAssignment(hostileCommand as never)).not.toThrow();
    expect(claimFollowUpRolePoolAssignment(hostileCommand as never)).toEqual({
      ok: false,
      code: 'invalid_command_context',
    });
    expect(() =>
      claimFollowUpRolePoolAssignment({
        assignment: hostileAssignment as never,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 4,
        member: activeConsultant(),
      }),
    ).not.toThrow();
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: hostileAssignment as never,
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 4,
        member: activeConsultant(),
      }),
    ).toEqual({ ok: false, code: 'invalid_assignment' });
    expect(
      claimFollowUpRolePoolAssignment({
        assignment: rolePoolAssignment(),
        institutionId: 'institution-a',
        actorUserId: 'user-consultant',
        expectedRevision: 4,
        member: hostileMember,
      }),
    ).toEqual({ ok: false, code: 'invalid_member' });
    expect(() =>
      reassignFollowUpAssignment({
        assignment: rolePoolAssignment(),
        target: hostileTarget as never,
        targetMember: null,
        expectedRevision: 4,
        institutionId: 'institution-a',
        actorRole: 'tenant_admin',
        reason: 'assignment_correction',
      }),
    ).not.toThrow();
    expect(
      reassignFollowUpAssignment({
        assignment: rolePoolAssignment(),
        target: hostileTarget as never,
        targetMember: null,
        expectedRevision: 4,
        institutionId: 'institution-a',
        actorRole: 'tenant_admin',
        reason: 'assignment_correction',
      }),
    ).toEqual({ ok: false, code: 'invalid_target_assignment' });
    expect(
      claimFollowUpRolePoolAssignment(descriptorAmplificationCommand as never),
    ).toEqual({ ok: false, code: 'invalid_command_context' });
    expect(descriptorAmplificationCommandDescriptorCalls).toBe(0);
    expect(
      claimFollowUpRolePoolAssignment({
        ...validClaimCommand,
        member: descriptorAmplificationMember,
      }),
    ).toEqual({ ok: false, code: 'invalid_member' });
    expect(descriptorAmplificationMemberDescriptorCalls).toBe(0);
    expect(claimFollowUpRolePoolAssignment(accessorCommand)).toEqual({
      ok: false,
      code: 'invalid_command_context',
    });
    expect(accessorReads).toBe(0);
    expect(claimFollowUpRolePoolAssignment(hiddenFieldCommand)).toEqual({
      ok: false,
      code: 'invalid_command_context',
    });
    expect(claimFollowUpRolePoolAssignment(symbolFieldCommand)).toEqual({
      ok: false,
      code: 'invalid_command_context',
    });
    expect(() => claimFollowUpRolePoolAssignment(revokedCommand.proxy as never)).not.toThrow();
    expect(claimFollowUpRolePoolAssignment(revokedCommand.proxy as never)).toEqual({
      ok: false,
      code: 'invalid_command_context',
    });
    expect(claimFollowUpRolePoolAssignment(nullPrototypeCommand)).toMatchObject({
      ok: true,
      changed: true,
    });
  });
});
