import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  MEMBERSHIP_MAX_REVISION,
  classifyMembershipCurrent,
  decideMembershipLifecycle,
  isCompleteMembershipCurrent,
  type CompleteMembershipCurrent,
  type MembershipCurrent,
  type MembershipOwnerCommand,
} from '@/modules/access-control/domain/membership-lifecycle';

const COMMAND_ID = `mcmd1_${'A'.repeat(43)}`;
const SECOND_COMMAND_ID = `mcmd1_${'E'.repeat(43)}`;
const TRANSITION_ID = `mtr1_${'I'.repeat(43)}`;
const OCCURRED_AT = '2026-08-01T08:00:00.000Z';
const RECORDED_AT = '2026-08-01T08:00:01.000Z';

function current(overrides: Partial<MembershipCurrent> = {}): MembershipCurrent {
  return {
    membershipId: 'member-001',
    tenantId: 'tenant-001',
    userId: 'user-001',
    role: 'tenant_admin',
    displayName: '受控管理员',
    revision: 4,
    lifecycleStatus: 'active',
    provenanceSource: 'access_control_command',
    provenanceActorId: 'actor-001',
    provenanceReasonCode: 'membership_role_changed',
    provenanceCommandId: COMMAND_ID,
    provenanceOccurredAt: '2026-08-01T07:00:00.000Z',
    provenanceRecordedAt: '2026-08-01T07:00:01.000Z',
    revokedAt: null,
    deletedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-08-01T07:00:01.000Z',
    ...overrides,
  };
}

function createCommand(
  overrides: Partial<Extract<MembershipOwnerCommand, { kind: 'create' }>> = {},
): Extract<MembershipOwnerCommand, { kind: 'create' }> {
  return {
    kind: 'create',
    commandId: SECOND_COMMAND_ID,
    expectedRevision: null,
    membershipId: 'member-002',
    tenantId: 'tenant-001',
    userId: 'user-002',
    role: 'tenant_operator',
    displayName: '运营成员',
    source: 'formal_onboarding',
    actorId: 'actor-001',
    reasonCode: 'formal_onboarding',
    occurredAt: OCCURRED_AT,
    binding: null,
    ...overrides,
  };
}

function command<K extends Exclude<MembershipOwnerCommand['kind'], 'create'>>(
  kind: K,
  overrides: Record<string, unknown> = {},
): Extract<MembershipOwnerCommand, { kind: K }> {
  const base = {
    kind,
    commandId: SECOND_COMMAND_ID,
    membershipId: 'member-001',
    tenantId: 'tenant-001',
    expectedRevision: 4,
    actorId: 'actor-002',
    reasonCode: `membership_${kind}`,
    occurredAt: OCCURRED_AT,
    ...(kind === 'refresh' ? { role: 'consultant' as const } : {}),
    ...(kind === 'adopt_legacy'
      ? {
          expectedRevision: 1,
          expectedDisplayName: '演示管理员',
          displayName: '系统管理员',
          role: 'tenant_admin' as const,
          reasonCode: 'post_rebuild_formal_identity_adoption',
        }
      : {}),
    ...overrides,
  };
  return base as Extract<MembershipOwnerCommand, { kind: K }>;
}

function decide(input: {
  current: MembershipCurrent | null;
  command: MembershipOwnerCommand;
}) {
  return decideMembershipLifecycle({
    ...input,
    transitionId: TRANSITION_ID,
    recordedAt: RECORDED_AT,
  });
}

describe('Access Control Membership 生命周期状态机', () => {
  it('create 仅在 expected-absence 建立 revision 1 与同源 evidence', () => {
    const input = Object.freeze(createCommand());
    const before = structuredClone(input);
    const result = decide({ current: null, command: input });

    expect(input).toEqual(before);
    expect(result).toMatchObject({
      kind: 'apply',
      bindingAction: { kind: 'none' },
      nextCurrent: {
        membershipId: 'member-002',
        revision: 1,
        lifecycleStatus: 'active',
        provenanceSource: 'formal_onboarding',
        provenanceCommandId: SECOND_COMMAND_ID,
        revokedAt: null,
        deletedAt: null,
      },
      transition: {
        transitionType: 'create',
        commandId: SECOND_COMMAND_ID,
        fromRevision: null,
        toRevision: 1,
        fromLifecycleStatus: null,
        toLifecycleStatus: 'active',
        fromRole: null,
        toRole: 'tenant_operator',
        occurredAt: OCCURRED_AT,
        recordedAt: RECORDED_AT,
      },
    });
    if (result.kind !== 'apply') throw new Error('expected create apply');
    expect({
      commandId: result.transition.commandId,
      source: result.transition.source,
      actorId: result.transition.actorId,
      reasonCode: result.transition.reasonCode,
      occurredAt: result.transition.occurredAt,
      recordedAt: result.transition.recordedAt,
      revision: result.transition.toRevision,
      lifecycleStatus: result.transition.toLifecycleStatus,
      role: result.transition.toRole,
    }).toEqual({
      commandId: result.nextCurrent.provenanceCommandId,
      source: result.nextCurrent.provenanceSource,
      actorId: result.nextCurrent.provenanceActorId,
      reasonCode: result.nextCurrent.provenanceReasonCode,
      occurredAt: result.nextCurrent.provenanceOccurredAt,
      recordedAt: result.nextCurrent.provenanceRecordedAt,
      revision: result.nextCurrent.revision,
      lifecycleStatus: result.nextCurrent.lifecycleStatus,
      role: result.nextCurrent.role,
    });
  });

  it('create 的显式 Binding 只派生低敏事实，不猜 institution', () => {
    const result = decide({
      current: null,
      command: createCommand({
        binding: {
          bindingId: 'binding-002',
          institutionId: 'institution-002',
          source: 'manual_admin',
          expiresAt: '2026-09-01T08:00:00.000Z',
        },
      }),
    });

    expect(result).toMatchObject({
      kind: 'apply',
      bindingAction: {
        kind: 'create',
        bindingId: 'binding-002',
        accountId: 'user-002',
        tenantId: 'tenant-001',
        institutionId: 'institution-002',
        source: 'manual_admin',
        assignedBy: 'actor-001',
        assignedAt: OCCURRED_AT,
        recordedAt: RECORDED_AT,
      },
    });
  });

  it('create 对既有 current fail-closed，deleted 不创建新 incarnation', () => {
    expect(decide({ current: current(), command: createCommand() })).toEqual({
      kind: 'blocked',
      code: 'membership_already_exists',
    });
    expect(
      decide({
        current: current({
          revision: 6,
          lifecycleStatus: 'deleted',
          provenanceOccurredAt: OCCURRED_AT,
          provenanceRecordedAt: RECORDED_AT,
          deletedAt: OCCURRED_AT,
          updatedAt: RECORDED_AT,
        }),
        command: createCommand(),
      }),
    ).toEqual({ kind: 'blocked', code: 'new_incarnation_not_supported' });
  });

  it('refresh 仅允许 active 的 role 实际变化并保持 identity/displayName', () => {
    const original = Object.freeze(current());
    const before = structuredClone(original);
    const result = decide({ current: original, command: command('refresh') });

    expect(original).toEqual(before);
    expect(result).toMatchObject({
      kind: 'apply',
      bindingAction: { kind: 'none' },
      nextCurrent: {
        membershipId: original.membershipId,
        tenantId: original.tenantId,
        userId: original.userId,
        displayName: original.displayName,
        role: 'consultant',
        revision: 5,
        lifecycleStatus: 'active',
      },
      transition: {
        transitionType: 'refresh',
        fromRevision: 4,
        toRevision: 5,
        fromRole: 'tenant_admin',
        toRole: 'consultant',
      },
    });
  });

  it('同 role refresh 仅对 active 是纯观察并保持零 transition', () => {
    const observed = current();
    const result = decide({
      current: observed,
      command: command('refresh', { role: observed.role }),
    });
    expect(result).toEqual({
      kind: 'observed',
      current: observed,
      bindingAction: { kind: 'none' },
    });
    expect('transition' in result).toBe(false);

    for (const lifecycleStatus of ['revoked', 'deleted'] as const) {
      const occurredAt = '2026-08-01T07:00:00.000Z';
      const inactive = current({
        lifecycleStatus,
        revokedAt: lifecycleStatus === 'revoked' ? occurredAt : null,
        deletedAt: lifecycleStatus === 'deleted' ? occurredAt : null,
        provenanceOccurredAt: occurredAt,
      });
      expect(decide({
        current: inactive,
        command: command('refresh', { role: inactive.role }),
      })).toEqual({
        kind: 'blocked',
        code: 'membership_transition_not_allowed',
      });
    }
  });

  it('adopt_legacy 只采用精确校准 legacy，并以 refresh evidence 落为 revision 2', () => {
    const legacy = Object.freeze(current({
      membershipId: 'member-demo-admin',
      tenantId: 'growth-tenant-chengxing',
      userId: 'demo-user-admin',
      displayName: '演示管理员',
      revision: 1,
      lifecycleStatus: 'active',
      provenanceSource: 'legacy_calibration',
      provenanceActorId: null,
      provenanceReasonCode: 'legacy_unknown',
      provenanceCommandId: `mcal1_${'a'.repeat(64)}`,
      provenanceOccurredAt: null,
      provenanceRecordedAt: '2026-08-01T07:00:01.000Z',
      revokedAt: null,
      deletedAt: null,
    }));
    const before = structuredClone(legacy);
    const adoption = command('adopt_legacy', {
      membershipId: legacy.membershipId,
      tenantId: legacy.tenantId,
      actorId: legacy.userId,
    });

    const result = decide({ current: legacy, command: adoption });

    expect(legacy).toEqual(before);
    expect(result).toMatchObject({
      kind: 'apply',
      bindingAction: { kind: 'none' },
      nextCurrent: {
        membershipId: legacy.membershipId,
        tenantId: legacy.tenantId,
        userId: legacy.userId,
        role: legacy.role,
        displayName: '系统管理员',
        revision: 2,
        lifecycleStatus: 'active',
        provenanceSource: 'access_control_command',
        provenanceActorId: legacy.userId,
        provenanceReasonCode: 'post_rebuild_formal_identity_adoption',
        provenanceCommandId: SECOND_COMMAND_ID,
        provenanceOccurredAt: OCCURRED_AT,
        provenanceRecordedAt: RECORDED_AT,
        revokedAt: null,
        deletedAt: null,
        createdAt: legacy.createdAt,
      },
      transition: {
        transitionType: 'refresh',
        source: 'access_control_command',
        reasonCode: 'post_rebuild_formal_identity_adoption',
        fromRevision: 1,
        toRevision: 2,
      },
    });
  });

  it.each([
    ['wrong display', { displayName: '其他旧名称' }, {},
      'membership_transition_not_allowed'],
    ['wrong provenance', { provenanceSource: 'access_control_command' }, {},
      'membership_current_envelope_invalid'],
    ['wrong revision', {}, { expectedRevision: 2 },
      'membership_revision_future'],
    ['wrong role', {}, { role: 'consultant' },
      'membership_transition_not_allowed'],
  ] as const)('adopt_legacy 对 %s fail-closed', (
    _label,
    currentOverrides,
    commandOverrides,
    code,
  ) => {
    const legacy = current({
      membershipId: 'member-demo-admin',
      tenantId: 'growth-tenant-chengxing',
      userId: 'demo-user-admin',
      displayName: '演示管理员',
      revision: 1,
      provenanceSource: 'legacy_calibration',
      provenanceActorId: null,
      provenanceReasonCode: 'legacy_unknown',
      provenanceCommandId: `mcal1_${'b'.repeat(64)}`,
      provenanceOccurredAt: null,
      ...currentOverrides,
    });
    expect(decide({
      current: legacy,
      command: command('adopt_legacy', {
        membershipId: legacy.membershipId,
        tenantId: legacy.tenantId,
        actorId: legacy.userId,
        ...commandOverrides,
      }),
    })).toEqual({ kind: 'blocked', code });
  });

  it('revoke、reactivate 与 delete 固定状态、时间和 Binding 动作', () => {
    const revoked = decide({ current: current(), command: command('revoke') });
    expect(revoked).toMatchObject({
      kind: 'apply',
      bindingAction: { kind: 'revoke_active' },
      nextCurrent: {
        revision: 5,
        lifecycleStatus: 'revoked',
        revokedAt: OCCURRED_AT,
        deletedAt: null,
      },
      transition: {
        fromLifecycleStatus: 'active',
        toLifecycleStatus: 'revoked',
      },
    });
    if (revoked.kind !== 'apply') throw new Error('expected revoke apply');

    const reactivated = decide({
      current: revoked.nextCurrent,
      command: command('reactivate', { expectedRevision: 5 }),
    });
    expect(reactivated).toMatchObject({
      kind: 'apply',
      bindingAction: { kind: 'none' },
      nextCurrent: {
        revision: 6,
        lifecycleStatus: 'active',
        revokedAt: null,
      },
    });

    const deletedFromActive = decide({ current: current(), command: command('delete') });
    expect(deletedFromActive).toMatchObject({
      kind: 'apply',
      bindingAction: { kind: 'revoke_active' },
      nextCurrent: { lifecycleStatus: 'deleted', deletedAt: OCCURRED_AT },
    });

    const deletedFromRevoked = decide({
      current: current({
        revision: 5,
        lifecycleStatus: 'revoked',
        provenanceOccurredAt: '2026-08-01T07:30:00.000Z',
        provenanceRecordedAt: '2026-08-01T07:30:01.000Z',
        revokedAt: '2026-08-01T07:30:00.000Z',
      }),
      command: command('delete', { expectedRevision: 5 }),
    });
    expect(deletedFromRevoked).toMatchObject({
      kind: 'apply',
      nextCurrent: {
        lifecycleStatus: 'deleted',
        revokedAt: '2026-08-01T07:30:00.000Z',
        deletedAt: OCCURRED_AT,
      },
    });
  });

  it('非法 lifecycle 转换与 deleted 复活一律拒绝', () => {
    const revoked = current({
      revision: 5,
      lifecycleStatus: 'revoked',
      provenanceOccurredAt: OCCURRED_AT,
      provenanceRecordedAt: RECORDED_AT,
      revokedAt: OCCURRED_AT,
    });
    const deleted = current({
      revision: 5,
      lifecycleStatus: 'deleted',
      provenanceOccurredAt: OCCURRED_AT,
      provenanceRecordedAt: RECORDED_AT,
      deletedAt: OCCURRED_AT,
    });
    const cases: Array<[MembershipCurrent, MembershipOwnerCommand]> = [
      [revoked, command('refresh', { expectedRevision: 5 })],
      [revoked, command('revoke', { expectedRevision: 5 })],
      [current(), command('reactivate')],
      [deleted, command('reactivate', { expectedRevision: 5 })],
      [deleted, command('delete', { expectedRevision: 5 })],
    ];
    for (const [membership, ownerCommand] of cases) {
      expect(decide({ current: membership, command: ownerCommand })).toEqual({
        kind: 'blocked',
        code: 'membership_transition_not_allowed',
      });
    }
  });

  it('legacy all-null 与 partial envelope 严格区分', () => {
    const legacy = current({
      revision: null,
      lifecycleStatus: null,
      provenanceSource: null,
      provenanceActorId: null,
      provenanceReasonCode: null,
      provenanceCommandId: null,
      provenanceOccurredAt: null,
      provenanceRecordedAt: null,
      revokedAt: null,
      deletedAt: null,
    });
    const partial = { ...legacy, revision: 1 };
    expect(classifyMembershipCurrent(legacy)).toBe('legacy');
    expect(classifyMembershipCurrent(partial)).toBe('invalid');
    expect(isCompleteMembershipCurrent(legacy)).toBe(false);
    expect(isCompleteMembershipCurrent(partial)).toBe(false);

    const complete = current();
    expect(isCompleteMembershipCurrent(complete)).toBe(true);
    if (!isCompleteMembershipCurrent(complete)) {
      throw new Error('expected complete membership current');
    }
    expectTypeOf(complete).toMatchTypeOf<CompleteMembershipCurrent>();

    for (const kind of ['refresh', 'revoke', 'reactivate', 'delete'] as const) {
      expect(decide({ current: legacy, command: command(kind) })).toEqual({
        kind: 'blocked',
        code: 'legacy_membership_not_calibrated',
      });
      expect(decide({ current: partial, command: command(kind) })).toEqual({
        kind: 'blocked',
        code: 'membership_current_envelope_invalid',
      });
    }
  });

  it('M4 完整校准后的 legacy current 可进入正式命令，不退回 updated_at', () => {
    const calibrated = current({
      revision: 1,
      lifecycleStatus: 'active',
      provenanceSource: 'legacy_calibration',
      provenanceActorId: null,
      provenanceReasonCode: 'legacy_unknown',
      provenanceCommandId: `mcal1_${'a'.repeat(64)}`,
      provenanceOccurredAt: null,
      provenanceRecordedAt: '2026-08-01T07:00:01.000Z',
    });
    expect(classifyMembershipCurrent(calibrated)).toBe('complete');
    expect(decide({
      current: calibrated,
      command: command('refresh', { expectedRevision: 1 }),
    })).toMatchObject({
      kind: 'apply',
      nextCurrent: {
        revision: 2,
        provenanceSource: 'access_control_command',
      },
      transition: {
        fromRevision: 1,
        toRevision: 2,
      },
    });
  });

  it('stale、future、非法与上限 revision 使用稳定失败码', () => {
    expect(decide({ current: current(), command: command('refresh', { expectedRevision: 3 }) }))
      .toEqual({ kind: 'blocked', code: 'membership_revision_stale' });
    expect(decide({ current: current(), command: command('refresh', { expectedRevision: 5 }) }))
      .toEqual({ kind: 'blocked', code: 'membership_revision_future' });
    expect(decide({
      current: current(),
      command: command('refresh', { expectedRevision: 0 }) as MembershipOwnerCommand,
    })).toEqual({ kind: 'blocked', code: 'membership_revision_invalid' });

    const atLimit = current({ revision: MEMBERSHIP_MAX_REVISION });
    expect(decide({
      current: atLimit,
      command: command('revoke', { expectedRevision: MEMBERSHIP_MAX_REVISION }),
    })).toEqual({ kind: 'blocked', code: 'revision_exhausted' });
    expect(decide({
      current: atLimit,
      command: command('refresh', {
        expectedRevision: MEMBERSHIP_MAX_REVISION,
        role: atLimit.role,
      }),
    })).toMatchObject({ kind: 'observed' });
  });

  it('identity、命令精确 shape 与时间顺序 fail-closed', () => {
    expect(decide({
      current: current(),
      command: command('revoke', { membershipId: 'member-other' }),
    })).toEqual({ kind: 'blocked', code: 'membership_identity_mismatch' });
    expect(decide({
      current: current(),
      command: { ...command('revoke'), displayName: '不可修改' } as MembershipOwnerCommand,
    })).toEqual({ kind: 'blocked', code: 'membership_command_shape_invalid' });
    expect(decideMembershipLifecycle({
      current: current(),
      command: command('revoke'),
      transitionId: TRANSITION_ID,
      recordedAt: '2026-08-01T07:59:59.000Z',
    })).toEqual({ kind: 'blocked', code: 'membership_command_time_invalid' });

    expect(classifyMembershipCurrent(current({
      provenanceReasonCode: '自由文本 不得作为低敏 reason code',
    }))).toBe('invalid');

    expect(decide({
      current: current(),
      command: {
        ...command('revoke'),
        kind: 'toString',
      } as unknown as MembershipOwnerCommand,
    })).toEqual({ kind: 'blocked', code: 'membership_command_shape_invalid' });
  });
});
