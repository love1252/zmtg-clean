import { describe, expect, it } from 'vitest';
import {
  acceptHumanHandling,
  autoCloseConversationSegment,
  checkConversationSegmentCanSend,
  closeConversationSegmentManually,
  conversationSegmentCloseKinds,
  conversationSegmentRiskStates,
  conversationSegmentStates,
  forceCloseConversationSegment,
  markWaitingForCustomer,
  openNextSegmentFromCustomerInbound,
  requestHumanHandling,
  resumeHumanHandling,
  returnSegmentToAi,
  type ConversationSegment,
  type SegmentAutoCloseInput,
  type SegmentCustomerInboundFact,
  type SegmentManualCloseInput,
  type SegmentReturnToAiInput,
  type SegmentTransitionResult,
} from '@/modules/institution-conversations/domain/conversation-segments';
import type {
  ConversationRiskHistory,
  CurrentClinicalClosureCheck,
} from '@/modules/institution-conversations/domain/conversation-risks';

const baseTime = '2026-07-17T01:00:00.000Z';

const segment = (
  overrides: Partial<ConversationSegment> = {},
): ConversationSegment => {
  const state = overrides.state ?? 'ai_handling';
  const everHumanHandled = overrides.everHumanHandled ?? false;
  const hasWaitingAnchor = state === 'waiting_customer'
    || (state === 'ai_handling' && everHumanHandled === false);
  return {
    tenantId: 'tenant-001',
    institutionId: 'institution-001',
    segmentId: 'segment-001',
    conversationId: 'conversation-001',
    sequenceNo: 1,
    state,
    currentHandlerId: null,
    everHumanHandled,
    openedByCustomerMessageId: 'message-inbound-001',
    openedAt: baseTime,
    lastCustomerMessageId: 'message-inbound-001',
    lastCustomerMessageAt: baseTime,
    latestInboundRevision: 1,
    waitingAfterCustomerMessageId: hasWaitingAnchor ? 'message-inbound-001' : null,
    waitingAfterCustomerMessageAt: hasWaitingAnchor ? baseTime : null,
    waitingAfterInboundRevision: hasWaitingAnchor ? 1 : null,
    stateChangedAt: baseTime,
    closedAt: null,
    segmentCloseKind: 'open',
    resolutionState: 'open',
    resolvedAt: null,
    blockingReasonCodes: [],
    ...overrides,
  };
};

const humanSegment = (
  state: 'human_handling' | 'waiting_customer' = 'human_handling',
): ConversationSegment => segment({
  state,
  currentHandlerId: 'actor-handler-001',
  everHumanHandled: true,
  stateChangedAt: '2026-07-17T01:02:00.000Z',
  waitingAfterCustomerMessageId: state === 'waiting_customer'
    ? 'message-inbound-001'
    : null,
  waitingAfterCustomerMessageAt: state === 'waiting_customer' ? baseTime : null,
  waitingAfterInboundRevision: state === 'waiting_customer' ? 1 : null,
});

const closedSegment = (): ConversationSegment => segment({
  state: 'closed',
  stateChangedAt: '2026-07-17T01:05:00.000Z',
  closedAt: '2026-07-17T01:05:00.000Z',
  segmentCloseKind: 'normal',
  waitingAfterCustomerMessageId: null,
  waitingAfterCustomerMessageAt: null,
  waitingAfterInboundRevision: null,
});

const returnToAiInput = (
  overrides: Partial<SegmentReturnToAiInput> = {},
): SegmentReturnToAiInput => ({
  operatorId: 'actor-handler-001',
  occurredAt: '2026-07-17T01:03:00.000Z',
  riskState: 'none',
  hasBlockingReason: false,
  hasUnconfirmedBusinessAction: false,
  outboundState: 'clear',
  aiReadiness: 'ready',
  knowledgeReadiness: 'ready',
  sensitiveAuthorizationReadiness: 'ready',
  messageTypeAllowed: true,
  institutionPolicyAllowsAi: true,
  ...overrides,
});

const autoCloseWindowAnchor = (
  overrides: Partial<SegmentAutoCloseInput['windowAnchor']> = {},
): SegmentAutoCloseInput['windowAnchor'] => ({
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  conversationId: 'conversation-001',
  segmentId: 'segment-001',
  customerMessageId: 'message-inbound-001',
  lastCustomerMessageAt: baseTime,
  latestInboundRevision: 1,
  waitWindowEndsAt: '2026-07-17T01:05:00.000Z',
  ...overrides,
});

const currentInboundCursor = (
  overrides: Partial<Extract<
    SegmentAutoCloseInput['currentInboundCursor'],
    { readiness: 'ready' }
  >> = {},
): Extract<SegmentAutoCloseInput['currentInboundCursor'], { readiness: 'ready' }> => ({
  readiness: 'ready',
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  conversationId: 'conversation-001',
  segmentId: 'segment-001',
  customerMessageId: 'message-inbound-001',
  lastCustomerMessageAt: baseTime,
  latestInboundRevision: 1,
  checkedAt: '2026-07-17T01:05:59.000Z',
  validUntil: '2026-07-17T01:06:30.000Z',
  ...overrides,
});

const autoCloseInput = (
  overrides: Partial<SegmentAutoCloseInput> = {},
): SegmentAutoCloseInput => ({
  occurredAt: '2026-07-17T01:06:00.000Z',
  riskState: 'none',
  hasBlockingReason: false,
  outboundState: 'clear',
  channelAllowsAutoClose: true,
  windowAnchor: autoCloseWindowAnchor(),
  currentInboundCursor: currentInboundCursor(),
  ...overrides,
});

const customerInboundFact = (
  overrides: Partial<SegmentCustomerInboundFact> = {},
): SegmentCustomerInboundFact => ({
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  messageId: 'message-inbound-002',
  conversationId: 'conversation-001',
  segmentId: 'segment-001',
  direction: 'inbound',
  senderKind: 'customer',
  inboundRevision: 2,
  occurredAt: '2026-07-17T01:03:30.000Z',
  receivedAt: '2026-07-17T01:03:31.000Z',
  ...overrides,
});

const resumeInboundCursor = (
  overrides: Partial<ReturnType<typeof currentInboundCursor>> = {},
): ReturnType<typeof currentInboundCursor> => currentInboundCursor({
  customerMessageId: 'message-inbound-002',
  lastCustomerMessageAt: '2026-07-17T01:03:30.000Z',
  latestInboundRevision: 2,
  checkedAt: '2026-07-17T01:03:59.000Z',
  validUntil: '2026-07-17T01:04:30.000Z',
  ...overrides,
});

const manualCloseInput = (
  overrides: Partial<SegmentManualCloseInput> = {},
): SegmentManualCloseInput => ({
  operatorId: 'actor-handler-001',
  occurredAt: '2026-07-17T01:05:00.000Z',
  closeResultCode: 'unresolved',
  blockingSnapshot: {
    readiness: 'ready',
    tenantId: 'tenant-001',
    institutionId: 'institution-001',
    conversationId: 'conversation-001',
    segmentId: 'segment-001',
    checkedAt: '2026-07-17T01:04:30.000Z',
    validUntil: '2026-07-17T01:05:30.000Z',
    state: 'clear',
  },
  riskSet: {
    readiness: 'ready',
    tenantId: 'tenant-001',
    institutionId: 'institution-001',
    conversationId: 'conversation-001',
    segmentId: 'segment-001',
    checkedAt: '2026-07-17T01:04:30.000Z',
    validUntil: '2026-07-17T01:05:30.000Z',
    histories: [clinicalRiskHistory()],
    currentClinicalClosureChecks: [currentClinicalClosureCheck()],
  },
  ...overrides,
});

const clinicalRiskHistory = (): ConversationRiskHistory => [
  {
    kind: 'risk_unconfirmed',
    eventId: 'risk-event-001',
    riskId: 'risk-001',
    tenantId: 'tenant-001',
    institutionId: 'institution-001',
    conversationId: 'conversation-001',
    segmentId: 'segment-001',
    sourceMessageId: 'message-inbound-001',
    riskDomain: 'clinical',
    riskCode: 'clinical_alert',
    occurredAt: '2026-07-17T01:01:00.000Z',
  },
  {
    kind: 'risk_confirmed',
    eventId: 'risk-event-002',
    riskId: 'risk-001',
    confirmedByActorId: 'actor-reviewer-001',
    occurredAt: '2026-07-17T01:02:00.000Z',
  },
  {
    kind: 'risk_resolved',
    eventId: 'risk-event-003',
    riskId: 'risk-001',
    resolvedByActorId: 'actor-reviewer-002',
    occurredAt: '2026-07-17T01:03:00.000Z',
    clinicalClosureReference: {
      referenceId: 'clinical-closure-001',
      scope: { tenantId: 'tenant-001', institutionId: 'institution-001' },
      verificationState: 'valid',
      revocationState: 'not_revoked',
      verifiedAt: '2026-07-17T01:02:30.000Z',
    },
  },
];

const currentClinicalClosureCheck = (
  overrides: Partial<CurrentClinicalClosureCheck> = {},
): CurrentClinicalClosureCheck => ({
  referenceId: 'clinical-closure-001',
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  valid: true,
  revoked: false,
  checkedAt: '2026-07-17T01:04:30.000Z',
  validUntil: '2026-07-17T01:05:30.000Z',
  ...overrides,
});

const appliedSegment = (result: SegmentTransitionResult): ConversationSegment => {
  expect(result.kind).toBe('applied');
  if (result.kind !== 'applied') {
    throw new Error('expected applied segment, received ' + result.code);
  }
  return result.segment;
};

describe('conversation segment domain', () => {
  it('冻结五个主状态、三个关闭类型和四个风险投影输入', () => {
    expect(conversationSegmentStates).toEqual([
      'ai_handling',
      'awaiting_human',
      'human_handling',
      'waiting_customer',
      'closed',
    ]);
    expect(conversationSegmentCloseKinds).toEqual(['open', 'normal', 'forced']);
    expect(conversationSegmentRiskStates).toEqual(['none', 'unconfirmed', 'confirmed', 'resolved']);
  });

  it('执行 ai → awaiting_human → human_handling 的合法链路', () => {
    const awaiting = appliedSegment(requestHumanHandling(segment(), {
      occurredAt: '2026-07-17T01:01:00.000Z',
    }));
    expect(awaiting).toMatchObject({
      state: 'awaiting_human',
      currentHandlerId: null,
      everHumanHandled: false,
    });

    const human = appliedSegment(acceptHumanHandling(awaiting, {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:02:00.000Z',
      assignment: {
        activeAssignmentCount: 1,
        assigneeId: 'actor-handler-001',
      },
    }));
    expect(human).toMatchObject({
      state: 'human_handling',
      currentHandlerId: 'actor-handler-001',
      everHumanHandled: true,
    });
  });

  it.each([
    [0, null, 'active_assignment_missing'],
    [2, 'actor-handler-001', 'multiple_active_assignments'],
    [1, 'actor-other-001', 'operator_not_active_assignee'],
  ] as const)('接管要求唯一活动分配：count=%s', (activeAssignmentCount, assigneeId, code) => {
    expect(acceptHumanHandling(segment({ state: 'awaiting_human' }), {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:02:00.000Z',
      assignment: { activeAssignmentCount, assigneeId },
    })).toEqual({ kind: 'blocked', code });
  });

  it.each([
    ['', 'actor-handler-001'],
    ['actor handler 001', 'actor-handler-001'],
    ['actor-handler-001', ''],
    ['actor-handler-001', 'actor handler 001'],
  ] as const)('接管拒绝不安全操作者或分配人标识：operator=%s assignee=%s', (operatorId, assigneeId) => {
    expect(acceptHumanHandling(segment({ state: 'awaiting_human' }), {
      operatorId,
      occurredAt: '2026-07-17T01:02:00.000Z',
      assignment: { activeAssignmentCount: 1, assigneeId },
    })).toEqual({ kind: 'blocked', code: 'invalid_identifier' });
  });

  it('当前处理人只能用同目标的新客户入站事实恢复人工处理', () => {
    const waiting = appliedSegment(markWaitingForCustomer(humanSegment(), {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:03:00.000Z',
    }));
    expect(waiting.state).toBe('waiting_customer');

    const resumed = appliedSegment(resumeHumanHandling(waiting, {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:04:00.000Z',
      customerInbound: customerInboundFact(),
      currentInboundCursor: resumeInboundCursor(),
    }));
    expect(resumed.state).toBe('human_handling');
    expect(resumed.everHumanHandled).toBe(true);

    expect(markWaitingForCustomer(humanSegment(), {
      operatorId: 'actor-other-001',
      occurredAt: '2026-07-17T01:03:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'operator_not_current_handler' });
    expect(resumeHumanHandling(humanSegment('waiting_customer'), {
      operatorId: 'actor-other-001',
      occurredAt: '2026-07-17T01:03:00.000Z',
      customerInbound: customerInboundFact(),
      currentInboundCursor: resumeInboundCursor(),
    })).toEqual({ kind: 'blocked', code: 'operator_not_current_handler' });
  });

  it.each([
    [undefined, 'customer_inbound_required'],
    [customerInboundFact({ direction: 'outbound' as never }), 'customer_inbound_invalid'],
    [customerInboundFact({ senderKind: 'operator' as never }), 'customer_inbound_invalid'],
    [customerInboundFact({ conversationId: 'conversation-other' }), 'customer_inbound_target_mismatch'],
    [customerInboundFact({ segmentId: 'segment-other' }), 'customer_inbound_target_mismatch'],
    [customerInboundFact({ inboundRevision: 0 }), 'customer_inbound_invalid'],
    [customerInboundFact({ inboundRevision: 1.5 }), 'customer_inbound_invalid'],
    [customerInboundFact({ occurredAt: '2026-07-17T01:02:00.000Z' }), 'customer_inbound_not_new'],
    [customerInboundFact({ receivedAt: '2026-07-17T01:04:00.001Z' }), 'customer_inbound_not_new'],
  ] as const)('waiting_customer 恢复对不可变客户入站 fail-closed：%s', (customerInbound, code) => {
    expect(resumeHumanHandling(humanSegment('waiting_customer'), {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:04:00.000Z',
      customerInbound,
      currentInboundCursor: resumeInboundCursor(),
    } as never)).toEqual({ kind: 'blocked', code });
  });

  it('恢复人工处理拒绝携带正文的入站事实，且不修改输入', () => {
    const waiting = humanSegment('waiting_customer');
    const fact = customerInboundFact();
    const factBefore = structuredClone(fact);
    expect(resumeHumanHandling(waiting, {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:04:00.000Z',
      customerInbound: { ...fact, messageBody: '虚构敏感正文' } as never,
      currentInboundCursor: resumeInboundCursor(),
    })).toEqual({ kind: 'blocked', code: 'customer_inbound_invalid' });
    expect(resumeHumanHandling(waiting, {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:04:00.000Z',
      customerInbound: fact,
      currentInboundCursor: resumeInboundCursor(),
    }).kind).toBe('applied');
    expect(fact).toEqual(factBefore);
  });

  it.each([
    [{ operatorId: 'actor-other-001' }, 'operator_not_current_handler'],
    [{ riskState: 'unconfirmed' }, 'risk_not_none'],
    [{ riskState: 'confirmed' }, 'risk_not_none'],
    [{ riskState: 'resolved' }, 'risk_not_none'],
    [{ hasBlockingReason: true }, 'blocking_reason_present'],
    [{ hasUnconfirmedBusinessAction: true }, 'unconfirmed_business_action'],
    [{ outboundState: 'pending' }, 'outbound_pending'],
    [{ outboundState: 'unknown' }, 'outbound_unknown'],
    [{ aiReadiness: 'not_ready' }, 'ai_not_ready'],
    [{ knowledgeReadiness: 'unknown' }, 'knowledge_not_ready'],
    [{ sensitiveAuthorizationReadiness: 'not_ready' }, 'sensitive_authorization_not_ready'],
    [{ messageTypeAllowed: false }, 'message_type_not_allowed'],
    [{ institutionPolicyAllowsAi: false }, 'institution_policy_not_allowed'],
  ] as const)('交回 AI 守卫 fail-closed：%j', (overrides, code) => {
    expect(returnSegmentToAi(
      humanSegment(),
      returnToAiInput(overrides as Partial<SegmentReturnToAiInput>),
    )).toEqual({ kind: 'blocked', code });
  });

  it.each(['human_handling', 'waiting_customer'] as const)(
    '%s 通过全部守卫后可交回 AI，但 everHumanHandled 永久为 true',
    (state) => {
      const returned = appliedSegment(returnSegmentToAi(
        humanSegment(state),
        returnToAiInput(),
      ));
      expect(returned).toMatchObject({
        state: 'ai_handling',
        currentHandlerId: null,
        everHumanHandled: true,
      });
      expect(autoCloseConversationSegment(returned, autoCloseInput())).toEqual({
        kind: 'blocked',
        code: 'ever_human_handled',
      });

      const escalatedAgain = appliedSegment(requestHumanHandling(returned, {
        occurredAt: '2026-07-17T01:04:00.000Z',
      }));
      expect(escalatedAgain).toMatchObject({
        state: 'awaiting_human',
        everHumanHandled: true,
      });
    },
  );

  it.each([
    [{ riskState: 'unconfirmed' }, 'risk_not_none'],
    [{ riskState: 'confirmed' }, 'risk_not_none'],
    [{ riskState: 'resolved' }, 'risk_not_none'],
    [{ hasBlockingReason: true }, 'blocking_reason_present'],
    [{ outboundState: 'pending' }, 'outbound_pending'],
    [{ outboundState: 'unknown' }, 'outbound_unknown'],
    [{ windowAnchor: autoCloseWindowAnchor({ waitWindowEndsAt: '2026-07-17T01:07:00.000Z' }) }, 'waiting_window_not_elapsed'],
    [{ channelAllowsAutoClose: false }, 'channel_auto_close_not_allowed'],
    [{ currentInboundCursor: currentInboundCursor({
      customerMessageId: 'message-inbound-002',
      lastCustomerMessageAt: '2026-07-17T01:04:00.000Z',
      latestInboundRevision: 2,
    }) }, 'new_inbound_during_wait'],
    [{ currentInboundCursor: { readiness: 'unknown' } }, 'inbound_status_unknown'],
  ] as const)('纯 AI auto-close 守卫 fail-closed：%j', (overrides, code) => {
    expect(autoCloseConversationSegment(
      segment(),
      autoCloseInput(overrides as Partial<SegmentAutoCloseInput>),
    )).toEqual({ kind: 'blocked', code });
  });

  it('从未人工处理的纯 AI 分段可 auto-close，但关闭不制造 resolved 事实', () => {
    const closed = appliedSegment(autoCloseConversationSegment(segment(), autoCloseInput()));
    expect(closed).toMatchObject({
      state: 'closed',
      segmentCloseKind: 'normal',
      resolutionState: 'open',
      resolvedAt: null,
      closedAt: '2026-07-17T01:06:00.000Z',
      everHumanHandled: false,
    });
  });

  it('auto-close 窗口同时绑定 lastCustomerMessageAt 和最新入站 revision', () => {
    expect(autoCloseConversationSegment(segment(), autoCloseInput({
      windowAnchor: autoCloseWindowAnchor({ waitWindowEndsAt: '2026-07-17T01:05:00' }),
    }))).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
    expect(autoCloseConversationSegment(segment(), autoCloseInput({
      occurredAt: '2026-07-17T01:04:59.999Z',
      currentInboundCursor: currentInboundCursor({
        checkedAt: '2026-07-17T01:04:59.000Z',
        validUntil: '2026-07-17T01:05:30.000Z',
      }),
    }))).toEqual({ kind: 'blocked', code: 'waiting_window_not_elapsed' });
    expect(autoCloseConversationSegment(segment(), autoCloseInput({
      windowAnchor: autoCloseWindowAnchor({
        lastCustomerMessageAt: '2026-07-17T01:05:00.001Z',
      }),
    }))).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });

    expect(autoCloseConversationSegment(segment(), autoCloseInput({
      currentInboundCursor: currentInboundCursor({ latestInboundRevision: 2 }),
    }))).toEqual({ kind: 'blocked', code: 'new_inbound_during_wait' });
    expect(autoCloseConversationSegment(segment(), autoCloseInput({
      currentInboundCursor: currentInboundCursor({ latestInboundRevision: 0 }),
    }))).toEqual({ kind: 'blocked', code: 'inbound_cursor_invalid' });
    expect(autoCloseConversationSegment(segment(), autoCloseInput({
      currentInboundCursor: currentInboundCursor({
        lastCustomerMessageAt: '2026-07-17T01:00:00.001Z',
      }),
    }))).toEqual({ kind: 'blocked', code: 'inbound_cursor_invalid' });
    expect(autoCloseConversationSegment(segment(), autoCloseInput({
      currentInboundCursor: currentInboundCursor({ conversationId: 'conversation-other' }),
    }))).toEqual({ kind: 'blocked', code: 'customer_inbound_target_mismatch' });
  });

  it('auto-close 拒绝 cursor 的额外敏感字段且不修改 anchor/cursor', () => {
    const anchor = autoCloseWindowAnchor();
    const cursor = currentInboundCursor();
    const anchorBefore = structuredClone(anchor);
    const cursorBefore = structuredClone(cursor);
    expect(autoCloseConversationSegment(segment(), autoCloseInput({
      windowAnchor: anchor,
      currentInboundCursor: { ...cursor, messageBody: '虚构正文' } as never,
    }))).toEqual({ kind: 'blocked', code: 'inbound_cursor_invalid' });
    expect(autoCloseConversationSegment(segment(), autoCloseInput({
      windowAnchor: anchor,
      currentInboundCursor: cursor,
    })).kind).toBe('applied');
    expect(anchor).toEqual(anchorBefore);
    expect(cursor).toEqual(cursorBefore);
  });

  it('segment 本地 blocker 同时阻断交回 AI 与 auto-close', () => {
    const humanWithLocalBlocker = segment({
      state: 'human_handling',
      currentHandlerId: 'actor-handler-001',
      everHumanHandled: true,
      stateChangedAt: '2026-07-17T01:02:00.000Z',
      blockingReasonCodes: ['forced_close_unresolved'],
    });
    expect(returnSegmentToAi(humanWithLocalBlocker, returnToAiInput())).toEqual({
      kind: 'blocked',
      code: 'blocking_reason_present',
    });
    expect(autoCloseConversationSegment(segment({
      blockingReasonCodes: ['forced_close_unresolved'],
    }), autoCloseInput())).toEqual({
      kind: 'blocked',
      code: 'blocking_reason_present',
    });
  });

  it('所有转换时间只接受 canonical UTC，并校验 segment 时间顺序', () => {
    expect(requestHumanHandling(segment(), {
      occurredAt: '2026-07-17T01:01:00',
    })).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
    expect(requestHumanHandling(segment({
      openedAt: '2026-07-17T01:00:00',
    }), {
      occurredAt: '2026-07-17T01:01:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
    expect(requestHumanHandling(segment({
      openedAt: '2026-07-17T01:02:00.000Z',
      stateChangedAt: '2026-07-17T01:01:00.000Z',
    }), {
      occurredAt: '2026-07-17T01:03:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
    expect(requestHumanHandling(segment({
      closedAt: '2026-07-17T01:00:30.000Z',
    }), {
      occurredAt: '2026-07-17T01:01:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
  });

  it('人工正常结束要求当前处理人，且只保留已有解决事实', () => {
    const unresolved = appliedSegment(closeConversationSegmentManually(
      humanSegment(),
      manualCloseInput(),
    ));
    expect(unresolved).toMatchObject({
      state: 'closed',
      segmentCloseKind: 'normal',
      resolutionState: 'open',
      resolvedAt: null,
    });

    const preResolved = humanSegment('waiting_customer');
    const resolved = appliedSegment(closeConversationSegmentManually({
      ...preResolved,
      stateChangedAt: '2026-07-17T01:04:00.000Z',
      resolutionState: 'resolved',
      resolvedAt: '2026-07-17T01:04:00.000Z',
    }, manualCloseInput({ closeResultCode: 'resolved' })));
    expect(resolved).toMatchObject({
      state: 'closed',
      resolutionState: 'resolved',
      resolvedAt: '2026-07-17T01:04:00.000Z',
    });

    expect(closeConversationSegmentManually(humanSegment(), manualCloseInput({
      operatorId: 'actor-other-001',
    }))).toEqual({ kind: 'blocked', code: 'operator_not_current_handler' });
  });

  it('关闭命令不得自行制造 resolved，未知结果或旧 resolution 输入 fail-closed', () => {
    expect(closeConversationSegmentManually(humanSegment(), manualCloseInput({
      closeResultCode: 'resolved',
    }))).toEqual({ kind: 'blocked', code: 'close_result_mismatch' });
    expect(closeConversationSegmentManually(humanSegment(), manualCloseInput({
      closeResultCode: 'other' as never,
    }))).toEqual({ kind: 'blocked', code: 'close_result_invalid' });
    expect(closeConversationSegmentManually(humanSegment(), {
      ...manualCloseInput(),
      resolution: {
        kind: 'resolved',
        resolvedAt: '2026-07-17T01:04:00.000Z',
      },
    } as never)).toEqual({ kind: 'blocked', code: 'close_result_invalid' });
  });

  it('人工普通结束必须消费当前 blocker 和完整风险集', () => {
    const unconfirmed = clinicalRiskHistory().slice(0, 1);
    const confirmed = clinicalRiskHistory().slice(0, 2);
    const readyBlockingSnapshot = manualCloseInput().blockingSnapshot;
    const readyRiskSet = manualCloseInput().riskSet;
    if (readyBlockingSnapshot.readiness !== 'ready' || readyRiskSet.readiness !== 'ready') {
      throw new Error('expected ready close snapshots');
    }
    const cases: readonly [Partial<SegmentManualCloseInput>, string][] = [
      [{ blockingSnapshot: {
        readiness: 'ready',
        tenantId: 'tenant-001',
        institutionId: 'institution-001',
        conversationId: 'conversation-001',
        segmentId: 'segment-001',
        checkedAt: '2026-07-17T01:04:30.000Z',
        validUntil: '2026-07-17T01:05:30.000Z',
        state: 'present',
      } }, 'blocking_reason_present'],
      [{ blockingSnapshot: { readiness: 'unknown' } }, 'blocking_status_unknown'],
      [{ blockingSnapshot: {
        ...readyBlockingSnapshot,
        conversationId: 'conversation-other',
      } }, 'blocking_status_unknown'],
      [{ blockingSnapshot: {
        ...readyBlockingSnapshot,
        validUntil: '2026-07-17T01:04:59.999Z',
      } }, 'blocking_status_unknown'],
      [{ riskSet: { readiness: 'unknown' } }, 'risk_status_unknown'],
      [{ riskSet: {
        ...readyRiskSet,
        segmentId: 'segment-other',
      } }, 'risk_status_unknown'],
      [{ riskSet: {
        ...readyRiskSet,
        validUntil: '2026-07-17T01:04:59.999Z',
      } }, 'risk_status_unknown'],
      [{
        riskSet: {
          readiness: 'ready',
          tenantId: 'tenant-001',
          institutionId: 'institution-001',
          conversationId: 'conversation-001',
          segmentId: 'segment-001',
          checkedAt: '2026-07-17T01:04:30.000Z',
          validUntil: '2026-07-17T01:05:30.000Z',
          histories: [unconfirmed],
          currentClinicalClosureChecks: [],
        },
      }, 'risk_not_resolved'],
      [{
        riskSet: {
          readiness: 'ready',
          tenantId: 'tenant-001',
          institutionId: 'institution-001',
          conversationId: 'conversation-001',
          segmentId: 'segment-001',
          checkedAt: '2026-07-17T01:04:30.000Z',
          validUntil: '2026-07-17T01:05:30.000Z',
          histories: [confirmed],
          currentClinicalClosureChecks: [],
        },
      }, 'risk_not_resolved'],
      [{
        riskSet: {
          readiness: 'ready',
          tenantId: 'tenant-001',
          institutionId: 'institution-001',
          conversationId: 'conversation-001',
          segmentId: 'segment-001',
          checkedAt: '2026-07-17T01:04:30.000Z',
          validUntil: '2026-07-17T01:05:30.000Z',
          histories: [clinicalRiskHistory()],
          currentClinicalClosureChecks: [currentClinicalClosureCheck({ revoked: true })],
        },
      }, 'clinical_closure_reference_revoked'],
    ];

    for (const [overrides, code] of cases) {
      expect(closeConversationSegmentManually(
        humanSegment(),
        manualCloseInput(overrides),
      )).toEqual({ kind: 'blocked', code });
    }

    expect(closeConversationSegmentManually(segment({
      ...humanSegment(),
      blockingReasonCodes: ['forced_close_unresolved'],
    }), manualCloseInput())).toEqual({ kind: 'blocked', code: 'blocking_reason_present' });
  });

  it('已解决临床风险仅在关闭时当前引用仍有效且未撤销时允许普通结束', () => {
    const riskSet = {
      readiness: 'ready',
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      conversationId: 'conversation-001',
      segmentId: 'segment-001',
      checkedAt: '2026-07-17T01:04:30.000Z',
      validUntil: '2026-07-17T01:05:30.000Z',
      histories: [clinicalRiskHistory()],
      currentClinicalClosureChecks: [currentClinicalClosureCheck()],
    } as const;
    const riskSetBefore = structuredClone(riskSet);
    expect(closeConversationSegmentManually(
      humanSegment(),
      manualCloseInput({ riskSet }),
    ).kind).toBe('applied');
    expect(riskSet).toEqual(riskSetBefore);
  });

  it.each([
    'ai_handling',
    'awaiting_human',
    'human_handling',
    'waiting_customer',
  ] as const)('force close 只消费上层授权并固定语义：%s', (state) => {
    const current = segment({
      state,
      currentHandlerId: state === 'human_handling' || state === 'waiting_customer'
        ? 'actor-handler-001'
        : null,
      everHumanHandled: state === 'human_handling' || state === 'waiting_customer',
    });
    const closed = appliedSegment(forceCloseConversationSegment(current, {
      forceCloseAuthorized: true,
      occurredAt: '2026-07-17T01:05:00.000Z',
    }));
    expect(closed).toMatchObject({
      state: 'closed',
      segmentCloseKind: 'forced',
      resolutionState: 'open',
      resolvedAt: null,
      blockingReasonCodes: ['forced_close_unresolved'],
      currentHandlerId: current.currentHandlerId,
      everHumanHandled: current.everHumanHandled,
    });
  });

  it('force close 未经上层授权时 fail-closed', () => {
    expect(forceCloseConversationSegment(humanSegment(), {
      forceCloseAuthorized: false,
      occurredAt: '2026-07-17T01:05:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'force_close_not_authorized' });
  });

  it('force close 去重追加 blocker，且不修改输入对象或数组', () => {
    const current = humanSegment();
    const withBlocker: ConversationSegment = {
      ...current,
      blockingReasonCodes: ['forced_close_unresolved'],
    };
    const before = structuredClone(withBlocker);
    const originalBlockingReasons = withBlocker.blockingReasonCodes;
    const closed = appliedSegment(forceCloseConversationSegment(withBlocker, {
      forceCloseAuthorized: true,
      occurredAt: '2026-07-17T01:05:00.000Z',
    }));

    expect(closed.blockingReasonCodes).toEqual(['forced_close_unresolved']);
    expect(withBlocker).toEqual(before);
    expect(withBlocker.blockingReasonCodes).toBe(originalBlockingReasons);
    expect(closed.blockingReasonCodes).not.toBe(originalBlockingReasons);
  });

  it('closed 是终态，所有原分段转换均拒绝', () => {
    const current = closedSegment();
    const expected = { kind: 'blocked', code: 'segment_closed' };
    expect(requestHumanHandling(current, { occurredAt: '2026-07-17T01:06:00.000Z' })).toEqual(expected);
    expect(acceptHumanHandling(current, {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:06:00.000Z',
      assignment: { activeAssignmentCount: 1, assigneeId: 'actor-handler-001' },
    })).toEqual(expected);
    expect(markWaitingForCustomer(current, {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:06:00.000Z',
    })).toEqual(expected);
    expect(resumeHumanHandling(current, {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:06:00.000Z',
      customerInbound: customerInboundFact(),
      currentInboundCursor: resumeInboundCursor(),
    })).toEqual(expected);
    expect(returnSegmentToAi(current, returnToAiInput())).toEqual(expected);
    expect(autoCloseConversationSegment(current, autoCloseInput())).toEqual(expected);
    expect(closeConversationSegmentManually(current, manualCloseInput({
      occurredAt: '2026-07-17T01:06:00.000Z',
    }))).toEqual(expected);
    expect(forceCloseConversationSegment(current, {
      forceCloseAuthorized: true,
      occurredAt: '2026-07-17T01:06:00.000Z',
    })).toEqual(expected);
    expect(checkConversationSegmentCanSend(current)).toEqual(expected);
  });

  it.each([
    'ai_handling',
    'awaiting_human',
    'human_handling',
    'waiting_customer',
  ] as const)('仅提供发送资格 guard，活动状态 %s 可继续由消息域做后续判断', (state) => {
    expect(checkConversationSegmentCanSend(segment({ state }))).toEqual({ kind: 'allowed' });
  });

  it('只有新客户入站 helper 从 closed 派生同会话 sequenceNo+1 新分段', () => {
    const current = closedSegment();
    const before = structuredClone(current);
    const next = appliedSegment(openNextSegmentFromCustomerInbound(current, {
      segmentId: 'segment-002',
      customerMessageId: 'message-inbound-002',
      inboundRevision: 2,
      occurredAt: '2026-07-17T01:06:00.000Z',
    }));
    expect(next).toEqual({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      segmentId: 'segment-002',
      conversationId: current.conversationId,
      sequenceNo: 2,
      state: 'ai_handling',
      currentHandlerId: null,
      everHumanHandled: false,
      openedByCustomerMessageId: 'message-inbound-002',
      openedAt: '2026-07-17T01:06:00.000Z',
      lastCustomerMessageId: 'message-inbound-002',
      lastCustomerMessageAt: '2026-07-17T01:06:00.000Z',
      latestInboundRevision: 2,
      waitingAfterCustomerMessageId: 'message-inbound-002',
      waitingAfterCustomerMessageAt: '2026-07-17T01:06:00.000Z',
      waitingAfterInboundRevision: 2,
      stateChangedAt: '2026-07-17T01:06:00.000Z',
      closedAt: null,
      segmentCloseKind: 'open',
      resolutionState: 'open',
      resolvedAt: null,
      blockingReasonCodes: [],
    });
    expect(current).toEqual(before);
    expect(openNextSegmentFromCustomerInbound(segment(), {
      segmentId: 'segment-002',
      customerMessageId: 'message-inbound-002',
      inboundRevision: 2,
      occurredAt: '2026-07-17T01:06:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'segment_not_closed' });
  });

  it('新入站要求 closedAt 存在且为 canonical UTC，并且不早于 closedAt', () => {
    const input = {
      segmentId: 'segment-002',
      customerMessageId: 'message-inbound-002',
      inboundRevision: 2,
      occurredAt: '2026-07-17T01:06:00.000Z',
    } as const;
    expect(openNextSegmentFromCustomerInbound(closedSegment(), {
      ...input,
      occurredAt: '2026-07-17T01:04:59.999Z',
    })).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
    expect(openNextSegmentFromCustomerInbound({
      ...closedSegment(),
      closedAt: null,
    }, input)).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
    expect(openNextSegmentFromCustomerInbound({
      ...closedSegment(),
      closedAt: '2026-07-17T01:05:00',
    }, input)).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
    expect(openNextSegmentFromCustomerInbound({
      ...closedSegment(),
      stateChangedAt: '2026-07-17T01:05:01.000Z',
    }, input)).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
  });

  it('代表性非法来源状态均 fail-closed', () => {
    expect(requestHumanHandling(segment({ state: 'awaiting_human' }), {
      occurredAt: '2026-07-17T01:01:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'transition_not_allowed' });
    expect(acceptHumanHandling(segment(), {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:02:00.000Z',
      assignment: { activeAssignmentCount: 1, assigneeId: 'actor-handler-001' },
    })).toEqual({ kind: 'blocked', code: 'transition_not_allowed' });
    expect(markWaitingForCustomer(humanSegment('waiting_customer'), {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:03:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'transition_not_allowed' });
    expect(resumeHumanHandling(humanSegment(), {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:03:00.000Z',
      customerInbound: customerInboundFact(),
      currentInboundCursor: resumeInboundCursor(),
    })).toEqual({ kind: 'blocked', code: 'transition_not_allowed' });
    expect(returnSegmentToAi(segment(), returnToAiInput())).toEqual({
      kind: 'blocked',
      code: 'transition_not_allowed',
    });
    expect(autoCloseConversationSegment(humanSegment(), autoCloseInput())).toEqual({
      kind: 'blocked',
      code: 'transition_not_allowed',
    });
    expect(closeConversationSegmentManually(segment(), manualCloseInput())).toEqual({
      kind: 'blocked',
      code: 'transition_not_allowed',
    });
  });

  it('成功与阻断路径均不修改只读 segment 或守卫输入', () => {
    const current = humanSegment();
    const guard = returnToAiInput();
    const currentBefore = structuredClone(current);
    const guardBefore = structuredClone(guard);

    expect(returnSegmentToAi(current, guard).kind).toBe('applied');
    expect(current).toEqual(currentBefore);
    expect(guard).toEqual(guardBefore);

    const blockedGuard = returnToAiInput({ outboundState: 'unknown' });
    const blockedGuardBefore = structuredClone(blockedGuard);
    expect(returnSegmentToAi(current, blockedGuard)).toEqual({
      kind: 'blocked',
      code: 'outbound_unknown',
    });
    expect(current).toEqual(currentBefore);
    expect(blockedGuard).toEqual(blockedGuardBefore);
  });
});
