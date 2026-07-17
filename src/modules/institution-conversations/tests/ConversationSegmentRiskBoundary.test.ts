import { describe, expect, it, vi } from 'vitest';
import {
  checkConversationRiskSetForNormalClose,
  type ConversationRiskHistory,
  type CurrentClinicalClosureCheck,
} from '@/modules/institution-conversations/domain/conversation-risks';
import {
  closeConversationSegmentManually,
  forceCloseConversationSegment,
  type ConversationSegment,
  type SegmentManualCloseInput,
} from '@/modules/institution-conversations/domain/conversation-segments';

const target = {
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  conversationId: 'conversation-001',
  segmentId: 'segment-001',
} as const;

const decisionAt = '2026-07-17T01:05:00.000Z';

function nonClinicalHistory(index: number): ConversationRiskHistory {
  const suffix = String(index).padStart(3, '0');
  return [
    {
      kind: 'risk_unconfirmed',
      eventId: `risk-event-${suffix}-1`,
      riskId: `risk-${suffix}`,
      ...target,
      sourceMessageId: `message-${suffix}`,
      riskDomain: 'non_clinical',
      riskCode: 'complaint',
      occurredAt: `2026-07-17T01:0${index}:00.000Z`,
    },
    {
      kind: 'risk_confirmed',
      eventId: `risk-event-${suffix}-2`,
      riskId: `risk-${suffix}`,
      confirmedByActorId: 'actor-reviewer-001',
      occurredAt: `2026-07-17T01:0${index}:10.000Z`,
    },
    {
      kind: 'risk_resolved',
      eventId: `risk-event-${suffix}-3`,
      riskId: `risk-${suffix}`,
      resolvedByActorId: 'actor-reviewer-002',
      occurredAt: `2026-07-17T01:0${index}:20.000Z`,
      clinicalClosureReference: null,
    },
  ];
}

function clinicalHistory(
  index: number,
  referenceId: string,
): ConversationRiskHistory {
  const suffix = String(index).padStart(3, '0');
  return [
    {
      kind: 'risk_unconfirmed',
      eventId: `clinical-event-${suffix}-1`,
      riskId: `clinical-risk-${suffix}`,
      ...target,
      sourceMessageId: `clinical-message-${suffix}`,
      riskDomain: 'clinical',
      riskCode: 'clinical_alert',
      occurredAt: `2026-07-17T01:0${index}:00.000Z`,
    },
    {
      kind: 'risk_confirmed',
      eventId: `clinical-event-${suffix}-2`,
      riskId: `clinical-risk-${suffix}`,
      confirmedByActorId: 'actor-reviewer-001',
      occurredAt: `2026-07-17T01:0${index}:10.000Z`,
    },
    {
      kind: 'risk_resolved',
      eventId: `clinical-event-${suffix}-3`,
      riskId: `clinical-risk-${suffix}`,
      resolvedByActorId: 'actor-reviewer-002',
      occurredAt: `2026-07-17T01:0${index}:20.000Z`,
      clinicalClosureReference: {
        referenceId,
        scope: {
          tenantId: target.tenantId,
          institutionId: target.institutionId,
        },
        verificationState: 'valid',
        revocationState: 'not_revoked',
        verifiedAt: `2026-07-17T01:0${index}:15.000Z`,
      },
    },
  ];
}

function currentCheck(
  referenceId: string,
  overrides: Partial<CurrentClinicalClosureCheck> = {},
): CurrentClinicalClosureCheck {
  return {
    referenceId,
    tenantId: target.tenantId,
    institutionId: target.institutionId,
    valid: true,
    revoked: false,
    checkedAt: '2026-07-17T01:04:00.000Z',
    validUntil: '2026-07-17T01:06:00.000Z',
    ...overrides,
  };
}

function closeCheckInput(
  overrides: Partial<Parameters<typeof checkConversationRiskSetForNormalClose>[1]> = {},
): Parameters<typeof checkConversationRiskSetForNormalClose>[1] {
  return {
    ...target,
    decisionAt,
    currentClinicalClosureChecks: [],
    ...overrides,
  };
}

function humanSegment(
  overrides: Partial<ConversationSegment> = {},
): ConversationSegment {
  return {
    ...target,
    sequenceNo: 1,
    state: 'human_handling',
    currentHandlerId: 'actor-handler-001',
    everHumanHandled: true,
    openedByCustomerMessageId: 'message-inbound-001',
    openedAt: '2026-07-17T01:00:00.000Z',
    lastCustomerMessageId: 'message-inbound-001',
    lastCustomerMessageAt: '2026-07-17T01:00:00.000Z',
    latestInboundRevision: 1,
    waitingAfterCustomerMessageId: null,
    waitingAfterCustomerMessageAt: null,
    waitingAfterInboundRevision: null,
    stateChangedAt: '2026-07-17T01:02:00.000Z',
    closedAt: null,
    segmentCloseKind: 'open',
    resolutionState: 'open',
    resolvedAt: null,
    blockingReasonCodes: [],
    ...overrides,
  };
}

function manualCloseInput(
  histories: readonly ConversationRiskHistory[],
  currentClinicalClosureChecks: readonly CurrentClinicalClosureCheck[] = [],
): SegmentManualCloseInput {
  return {
    operatorId: 'actor-handler-001',
    occurredAt: decisionAt,
    closeResultCode: 'unresolved',
    blockingSnapshot: {
      readiness: 'ready',
      ...target,
      checkedAt: '2026-07-17T01:04:30.000Z',
      validUntil: '2026-07-17T01:05:30.000Z',
      state: 'clear',
    },
    riskSet: {
      readiness: 'ready',
      ...target,
      checkedAt: '2026-07-17T01:04:30.000Z',
      validUntil: '2026-07-17T01:05:30.000Z',
      histories,
      currentClinicalClosureChecks,
    },
  };
}

describe('conversation segment and complete risk history boundary', () => {
  it('完整性未知时保持 fail-closed，空历史不得冒充权威无风险', () => {
    expect(checkConversationRiskSetForNormalClose([], closeCheckInput())).toEqual({
      kind: 'blocked',
      code: 'risk_set_completeness_unverified',
    });
    expect(closeConversationSegmentManually(
      humanSegment(),
      manualCloseInput([]),
    )).toEqual({
      kind: 'blocked',
      code: 'risk_set_completeness_unverified',
    });
  });

  it('完整历史投影允许多个已解决非临床风险且不修改输入', () => {
    const histories = [nonClinicalHistory(1), nonClinicalHistory(2)];
    const before = structuredClone(histories);
    expect(checkConversationRiskSetForNormalClose(
      histories,
      closeCheckInput(),
    )).toEqual({ kind: 'allowed' });
    expect(histories).toEqual(before);
  });

  it('不同风险复用事件 ID 时整组拒绝', () => {
    const first = nonClinicalHistory(1);
    const second = nonClinicalHistory(2).map((event, index) => (
      index === 1 ? { ...event, eventId: first[1]!.eventId } : { ...event }
    )) as ConversationRiskHistory;
    expect(checkConversationRiskSetForNormalClose(
      [first, second],
      closeCheckInput(),
    )).toEqual({ kind: 'blocked', code: 'risk_history_invalid' });
  });

  it('不同临床风险不得共享同一关闭引用', () => {
    const sharedReferenceId = 'clinical-closure-shared';
    expect(checkConversationRiskSetForNormalClose(
      [
        clinicalHistory(1, sharedReferenceId),
        clinicalHistory(2, sharedReferenceId),
      ],
      closeCheckInput({
        currentClinicalClosureChecks: [currentCheck(sharedReferenceId)],
      }),
    )).toEqual({ kind: 'blocked', code: 'risk_history_invalid' });
  });

  it('当前临床校验先执行机构 scope 守卫，不被未知引用掩盖', () => {
    const referenceId = 'clinical-closure-001';
    expect(checkConversationRiskSetForNormalClose(
      [clinicalHistory(1, referenceId)],
      closeCheckInput({
        currentClinicalClosureChecks: [
          currentCheck('clinical-closure-other', { institutionId: 'institution-other' }),
        ],
      }),
    )).toEqual({ kind: 'blocked', code: 'clinical_closure_scope_mismatch' });
  });

  it('跨目标历史在读取后续恶意字段前拒绝', () => {
    const [first, ...remaining] = nonClinicalHistory(1);
    const crossScopeFirst = { ...first, institutionId: 'institution-other' };
    const getter = vi.fn(() => 'complaint');
    Object.defineProperty(crossScopeFirst, 'riskCode', {
      enumerable: true,
      configurable: true,
      get: getter,
    });
    const history = [crossScopeFirst, ...remaining] as ConversationRiskHistory;
    expect(checkConversationRiskSetForNormalClose(
      [history],
      closeCheckInput(),
    )).toEqual({ kind: 'blocked', code: 'risk_history_invalid' });
    expect(getter).not.toHaveBeenCalled();
  });

  it('稀疏、符号键和 accessor 风险集合均低敏 fail-closed', () => {
    const sparse = new Array(1) as ConversationRiskHistory[];
    const symbolHistories = [nonClinicalHistory(1)];
    Object.defineProperty(symbolHistories, Symbol('unexpected'), {
      enumerable: false,
      value: true,
    });
    const accessorHistories = [nonClinicalHistory(1)];
    const getter = vi.fn(() => nonClinicalHistory(1));
    Object.defineProperty(accessorHistories, 0, {
      enumerable: true,
      configurable: true,
      get: getter,
    });

    for (const histories of [sparse, symbolHistories, accessorHistories]) {
      expect(checkConversationRiskSetForNormalClose(
        histories,
        closeCheckInput(),
      )).toEqual({ kind: 'blocked', code: 'risk_history_invalid' });
    }
    expect(getter).not.toHaveBeenCalled();
  });

  it('强制结束只关闭服务窗口，不伪造风险解决事实', () => {
    const result = forceCloseConversationSegment(humanSegment(), {
      forceCloseAuthorized: true,
      occurredAt: decisionAt,
    });
    expect(result.kind).toBe('applied');
    if (result.kind !== 'applied') throw new Error('expected forced close');
    expect(result.segment).toMatchObject({
      state: 'closed',
      segmentCloseKind: 'forced',
      resolutionState: 'open',
      resolvedAt: null,
      blockingReasonCodes: ['forced_close_unresolved'],
    });
  });
});
