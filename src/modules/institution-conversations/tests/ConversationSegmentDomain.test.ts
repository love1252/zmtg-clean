import { describe, expect, it } from 'vitest';
import {
  acceptHumanHandling,
  autoCloseConversationSegment,
  checkConversationSegmentCanSend,
  closeConversationSegmentManually,
  conversationSegmentCloseKinds,
  conversationSegmentStates,
  forceCloseConversationSegment,
  markWaitingForCustomer,
  openNextSegmentFromCustomerInbound,
  requestHumanHandling,
  resumeHumanHandling,
  returnSegmentToAi,
  type ConversationSegment,
  type SegmentAutoCloseInput,
  type SegmentManualCloseInput,
  type SegmentReturnToAiInput,
  type SegmentTransitionResult,
} from '@/modules/institution-conversations/domain/conversation-segments';
import type { ConversationRiskTarget } from '@/modules/institution-conversations/domain/conversation-risks';

const baseTime = '2026-07-17T01:00:00.000Z';
const riskTarget: ConversationRiskTarget = {
  tenantId: 'ten_aaaaaaaaaaaaaaaa',
  institutionId: 'ins_bbbbbbbbbbbbbbbb',
  conversationId: 'con_cccccccccccccccc',
  segmentId: 'seg_dddddddddddddddd',
};

const segment = (
  overrides: Partial<ConversationSegment> = {},
): ConversationSegment => ({
  segmentId: riskTarget.segmentId,
  conversationId: riskTarget.conversationId,
  sequenceNo: 1,
  state: 'ai_handling',
  currentHandlerId: null,
  everHumanHandled: false,
  openedByCustomerMessageId: 'message-inbound-001',
  openedAt: baseTime,
  stateChangedAt: baseTime,
  closedAt: null,
  segmentCloseKind: 'open',
  resolutionState: 'open',
  resolvedAt: null,
  blockingReasonCodes: [],
  ...overrides,
});

const humanSegment = (
  state: 'human_handling' | 'waiting_customer' = 'human_handling',
): ConversationSegment => segment({
  state,
  currentHandlerId: 'actor-handler-001',
  everHumanHandled: true,
  stateChangedAt: '2026-07-17T01:02:00.000Z',
});

const closedSegment = (): ConversationSegment => segment({
  state: 'closed',
  stateChangedAt: '2026-07-17T01:05:00.000Z',
  closedAt: '2026-07-17T01:05:00.000Z',
  segmentCloseKind: 'normal',
});

const returnToAiInput = (
  overrides: Partial<SegmentReturnToAiInput> = {},
): SegmentReturnToAiInput => ({
  operatorId: 'actor-handler-001',
  occurredAt: '2026-07-17T01:03:00.000Z',
  riskTarget,
  completeRiskHistories: [],
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

const autoCloseInput = (
  overrides: Partial<SegmentAutoCloseInput> = {},
): SegmentAutoCloseInput => ({
  occurredAt: '2026-07-17T01:06:00.000Z',
  riskTarget,
  completeRiskHistories: [],
  hasBlockingReason: false,
  outboundState: 'clear',
  waitWindowEndsAt: '2026-07-17T01:05:00.000Z',
  channelAllowsAutoClose: true,
  newInboundState: 'none',
  ...overrides,
});

const manualCloseInput = (
  overrides: Partial<SegmentManualCloseInput> = {},
): SegmentManualCloseInput => ({
  operatorId: 'actor-handler-001',
  occurredAt: '2026-07-17T01:05:00.000Z',
  resolution: { kind: 'unresolved' },
  riskTarget,
  completeRiskHistories: [],
  currentClinicalClosureChecks: [],
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
  it('冻结五个主状态和三个关闭类型', () => {
    expect(conversationSegmentStates).toEqual([
      'ai_handling',
      'awaiting_human',
      'human_handling',
      'waiting_customer',
      'closed',
    ]);
    expect(conversationSegmentCloseKinds).toEqual(['open', 'normal', 'forced']);
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

  it('仅当前处理人可在 human_handling 与 waiting_customer 间往返', () => {
    const waiting = appliedSegment(markWaitingForCustomer(humanSegment(), {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:03:00.000Z',
    }));
    expect(waiting.state).toBe('waiting_customer');

    const resumed = appliedSegment(resumeHumanHandling(waiting, {
      operatorId: 'actor-handler-001',
      occurredAt: '2026-07-17T01:04:00.000Z',
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
    })).toEqual({ kind: 'blocked', code: 'operator_not_current_handler' });
  });

  it.each([
    [{ operatorId: 'actor-other-001' }, 'operator_not_current_handler'],
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
    [{ hasBlockingReason: true }, 'blocking_reason_present'],
    [{ outboundState: 'pending' }, 'outbound_pending'],
    [{ outboundState: 'unknown' }, 'outbound_unknown'],
    [{ waitWindowEndsAt: '2026-07-17T01:07:00.000Z' }, 'waiting_window_not_elapsed'],
    [{ channelAllowsAutoClose: false }, 'channel_auto_close_not_allowed'],
    [{ newInboundState: 'present' }, 'new_inbound_during_wait'],
    [{ newInboundState: 'unknown' }, 'inbound_status_unknown'],
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

  it('auto-close 要求 canonical UTC 截止时间，并由 occurredAt 比较等待窗口', () => {
    expect(autoCloseConversationSegment(segment(), autoCloseInput({
      waitWindowEndsAt: '2026-07-17T01:05:00',
    }))).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
    expect(autoCloseConversationSegment(segment(), autoCloseInput({
      occurredAt: '2026-07-17T01:04:59.999Z',
      waitWindowEndsAt: '2026-07-17T01:05:00.000Z',
    }))).toEqual({ kind: 'blocked', code: 'waiting_window_not_elapsed' });
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

  it('人工正常结束要求当前处理人，并由显式 resolution 输入决定 resolvedAt', () => {
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

    const resolved = appliedSegment(closeConversationSegmentManually(
      humanSegment('waiting_customer'),
      manualCloseInput({
        resolution: {
          kind: 'resolved',
          resolvedAt: '2026-07-17T01:04:00.000Z',
        },
      }),
    ));
    expect(resolved).toMatchObject({
      state: 'closed',
      resolutionState: 'resolved',
      resolvedAt: '2026-07-17T01:04:00.000Z',
    });

    expect(closeConversationSegmentManually(humanSegment(), manualCloseInput({
      operatorId: 'actor-other-001',
    }))).toEqual({ kind: 'blocked', code: 'operator_not_current_handler' });
  });

  it('拒绝未知人工关闭结果和调用者提供的非法时间', () => {
    expect(closeConversationSegmentManually(humanSegment(), manualCloseInput({
      resolution: { kind: 'other' } as never,
    }))).toEqual({ kind: 'blocked', code: 'close_result_invalid' });

    expect(closeConversationSegmentManually(humanSegment(), manualCloseInput({
      resolution: {
        kind: 'resolved',
        resolvedAt: '2026-07-17T01:06:00.000Z',
      },
    }))).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
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
      segmentId: 'seg_eeeeeeeeeeeeeeee',
      customerMessageId: 'message-inbound-002',
      occurredAt: '2026-07-17T01:06:00.000Z',
    }));
    expect(next).toEqual({
      segmentId: 'seg_eeeeeeeeeeeeeeee',
      conversationId: current.conversationId,
      sequenceNo: 2,
      state: 'ai_handling',
      currentHandlerId: null,
      everHumanHandled: false,
      openedByCustomerMessageId: 'message-inbound-002',
      openedAt: '2026-07-17T01:06:00.000Z',
      stateChangedAt: '2026-07-17T01:06:00.000Z',
      closedAt: null,
      segmentCloseKind: 'open',
      resolutionState: 'open',
      resolvedAt: null,
      blockingReasonCodes: [],
    });
    expect(current).toEqual(before);
    expect(openNextSegmentFromCustomerInbound(segment(), {
      segmentId: 'seg_eeeeeeeeeeeeeeee',
      customerMessageId: 'message-inbound-002',
      occurredAt: '2026-07-17T01:06:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'segment_not_closed' });
  });

  it('新入站要求 closedAt 存在且为 canonical UTC，并且不早于 closedAt', () => {
    const input = {
      segmentId: 'seg_eeeeeeeeeeeeeeee',
      customerMessageId: 'message-inbound-002',
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
