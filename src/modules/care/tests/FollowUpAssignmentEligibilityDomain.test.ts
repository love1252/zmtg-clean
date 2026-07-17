import { describe, expect, it } from 'vitest';

import {
  FOLLOW_UP_ASSIGNMENT_ELIGIBILITY_ERROR_CODES,
  FOLLOW_UP_ROLE_POOL_ROLES,
  checkFollowUpAssignmentMemberEligibility,
  checkFollowUpAssignmentTargetEligibility,
} from '@/modules/care/domain/follow-up-assignment-eligibility';

function member(overrides: Record<string, unknown> = {}) {
  return {
    institutionId: 'institution-a',
    userId: 'user-a',
    role: 'consultant',
    active: true,
    ...overrides,
  };
}

describe('随访分配成员资格纯领域守卫', () => {
  it('固定四个角色和受控失败码', () => {
    expect(FOLLOW_UP_ROLE_POOL_ROLES).toEqual([
      'tenant_admin',
      'tenant_operator',
      'consultant',
      'customer_service',
    ]);
    expect(FOLLOW_UP_ASSIGNMENT_ELIGIBILITY_ERROR_CODES).toEqual([
      'invalid_command_context',
      'invalid_member',
      'invalid_target_assignment',
      'target_member_required',
      'member_mismatch',
      'scope_mismatch',
      'inactive_member',
      'role_mismatch',
    ]);
  });

  it('同机构有效成员与预期用户、角色一致时确定性通过且输入不变', () => {
    const memberFact = Object.freeze(member());
    const input = Object.freeze({
      institutionId: 'institution-a',
      expectedUserId: 'user-a',
      requiredRole: 'consultant' as const,
      member: memberFact,
    });
    const before = structuredClone(input);
    const first = checkFollowUpAssignmentMemberEligibility(input);

    expect(first).toEqual({ ok: true, userId: 'user-a' });
    expect(checkFollowUpAssignmentMemberEligibility(input)).toEqual(first);
    expect(input).toEqual(before);
  });

  it('非法命令上下文或非精确成员事实 fail-closed', () => {
    const valid = {
      institutionId: 'institution-a',
      expectedUserId: 'user-a',
      requiredRole: null,
      member: member(),
    };
    const invalidInputs = [
      { institutionId: null },
      { institutionId: ' ' },
      { institutionId: 'institution\n-a' },
      { expectedUserId: null },
      { expectedUserId: '' },
      { expectedUserId: 'user\u0000-a' },
      { requiredRole: 'doctor' },
    ];

    for (const overrides of invalidInputs) {
      expect(
        checkFollowUpAssignmentMemberEligibility({ ...valid, ...overrides }),
        JSON.stringify(overrides),
      ).toEqual({ ok: false, code: 'invalid_command_context' });
    }

    for (const invalidMember of [
      null,
      [],
      {},
      member({ institutionId: '' }),
      member({ userId: ' ' }),
      member({ role: 'doctor' }),
      member({ active: 'yes' }),
      member({ displayName: '不应进入领域事实' }),
    ]) {
      expect(
        checkFollowUpAssignmentMemberEligibility({ ...valid, member: invalidMember }),
      ).toEqual({ ok: false, code: 'invalid_member' });
    }
  });

  it('精确区分跨机构、失效、用户不匹配和角色不匹配', () => {
    const input = {
      institutionId: 'institution-a',
      expectedUserId: 'user-a',
      requiredRole: 'consultant' as const,
      member: member(),
    };

    expect(
      checkFollowUpAssignmentMemberEligibility({
        ...input,
        member: member({ institutionId: 'institution-b' }),
      }),
    ).toEqual({ ok: false, code: 'scope_mismatch' });
    expect(
      checkFollowUpAssignmentMemberEligibility({
        ...input,
        member: member({ active: false }),
      }),
    ).toEqual({ ok: false, code: 'inactive_member' });
    expect(
      checkFollowUpAssignmentMemberEligibility({
        ...input,
        member: member({ userId: 'user-b' }),
      }),
    ).toEqual({ ok: false, code: 'member_mismatch' });
    expect(
      checkFollowUpAssignmentMemberEligibility({
        ...input,
        member: member({ role: 'customer_service' }),
      }),
    ).toEqual({ ok: false, code: 'role_mismatch' });
  });

  it('四个稳定角色都可形成经验证的具体员工目标', () => {
    for (const role of FOLLOW_UP_ROLE_POOL_ROLES) {
      const target = {
        kind: 'user' as const,
        institutionId: 'institution-a',
        assigneeUserId: `user-${role}`,
      };
      expect(
        checkFollowUpAssignmentTargetEligibility({
          institutionId: 'institution-a',
          target,
          targetMember: member({ userId: target.assigneeUserId, role }),
        }),
      ).toEqual({ ok: true, target });
    }
  });

  it('具体员工目标必须有精确匹配的成员事实', () => {
    const target = {
      kind: 'user' as const,
      institutionId: 'institution-a',
      assigneeUserId: 'user-next',
    };

    expect(
      checkFollowUpAssignmentTargetEligibility({
        institutionId: 'institution-a',
        target,
        targetMember: null,
      }),
    ).toEqual({ ok: false, code: 'target_member_required' });
    expect(
      checkFollowUpAssignmentTargetEligibility({
        institutionId: 'institution-a',
        target,
        targetMember: member({ userId: 'user-other' }),
      }),
    ).toEqual({ ok: false, code: 'member_mismatch' });
    expect(
      checkFollowUpAssignmentTargetEligibility({
        institutionId: 'institution-a',
        target: { ...target, institutionId: 'institution-b' },
        targetMember: member({ institutionId: 'institution-b', userId: 'user-next' }),
      }),
    ).toEqual({ ok: false, code: 'scope_mismatch' });
    expect(
      checkFollowUpAssignmentTargetEligibility({
        institutionId: 'institution-a',
        target,
        targetMember: member({ userId: 'user-next', active: false }),
      }),
    ).toEqual({ ok: false, code: 'inactive_member' });
  });

  it('角色池目标只允许固定角色且必须显式不携带成员', () => {
    const target = {
      kind: 'role_pool' as const,
      institutionId: 'institution-a',
      role: 'customer_service',
    };
    const input = Object.freeze({
      institutionId: 'institution-a',
      target: Object.freeze(target),
      targetMember: null,
    });
    const before = structuredClone(input);
    const first = checkFollowUpAssignmentTargetEligibility(input);

    expect(first).toEqual({ ok: true, target });
    expect(checkFollowUpAssignmentTargetEligibility(input)).toEqual(first);
    expect(input).toEqual(before);
    expect(
      checkFollowUpAssignmentTargetEligibility({ ...input, targetMember: member() }),
    ).toEqual({ ok: false, code: 'member_mismatch' });
    expect(
      checkFollowUpAssignmentTargetEligibility({ ...input, targetMember: undefined }),
    ).toEqual({ ok: false, code: 'member_mismatch' });
    expect(
      checkFollowUpAssignmentTargetEligibility({
        ...input,
        target: { ...target, role: 'doctor' },
      }),
    ).toEqual({ ok: false, code: 'invalid_target_assignment' });
    expect(
      checkFollowUpAssignmentTargetEligibility({
        ...input,
        target: { ...target, skillGroup: 'vip' },
      }),
    ).toEqual({ ok: false, code: 'invalid_target_assignment' });
  });
});
