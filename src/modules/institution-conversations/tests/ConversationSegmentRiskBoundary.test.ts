import { describe, expect, it } from 'vitest';
import {
  autoCloseConversationSegment,
  closeConversationSegmentManually,
  forceCloseConversationSegment,
  returnSegmentToAi,
  type ConversationSegment,
  type SegmentAutoCloseInput,
  type SegmentManualCloseInput,
  type SegmentReturnToAiInput,
} from '@/modules/institution-conversations/domain/conversation-segments';
import {
  confirmConversationRisk,
  projectCompleteConversationRiskHistories,
  recordUnconfirmedRisk,
  resolveConversationRisk,
  type ConversationRiskHistory,
  type ConversationRiskMutationResult,
  type ConversationRiskTarget,
  type CurrentClinicalClosureCheck,
} from '@/modules/institution-conversations/domain/conversation-risks';

const target: ConversationRiskTarget = {
  tenantId: 'ten_aaaaaaaaaaaaaaaa',
  institutionId: 'ins_bbbbbbbbbbbbbbbb',
  conversationId: 'con_cccccccccccccccc',
  segmentId: 'seg_dddddddddddddddd',
};

const riskIds = {
  a: 'rsk_aaaaaaaaaaaaaaaa',
  b: 'rsk_bbbbbbbbbbbbbbbb',
  c: 'rsk_cccccccccccccccc',
} as const;

const closureIds = {
  a: 'ccr_aaaaaaaaaaaaaaaa',
  b: 'ccr_bbbbbbbbbbbbbbbb',
  c: 'ccr_cccccccccccccccc',
} as const;

const riskEventIds = {
  a: ['rke_aaaaaaaaaaaaaaa1', 'rke_aaaaaaaaaaaaaaa2', 'rke_aaaaaaaaaaaaaaa3'],
  b: ['rke_bbbbbbbbbbbbbbb1', 'rke_bbbbbbbbbbbbbbb2', 'rke_bbbbbbbbbbbbbbb3'],
  c: ['rke_ccccccccccccccc1', 'rke_ccccccccccccccc2', 'rke_ccccccccccccccc3'],
} as const;

const sourceMessageIds = {
  a: 'msg_aaaaaaaaaaaaaaaa',
  b: 'msg_bbbbbbbbbbbbbbbb',
  c: 'msg_cccccccccccccccc',
} as const;

const actorIds = {
  a: ['usr_aaaaaaaaaaaaaaa1', 'usr_aaaaaaaaaaaaaaa2'],
  b: ['usr_bbbbbbbbbbbbbbb1', 'usr_bbbbbbbbbbbbbbb2'],
  c: ['usr_ccccccccccccccc1', 'usr_ccccccccccccccc2'],
} as const;

const appliedRiskHistory = (result: ConversationRiskMutationResult): ConversationRiskHistory => {
  expect(result.kind).toBe('applied');
  if (result.kind !== 'applied') {
    throw new Error('expected applied risk mutation, received ' + result.code);
  }
  return result.history;
};

const riskHistory = (
  state: 'unconfirmed' | 'confirmed' | 'resolved',
  riskDomain: 'clinical' | 'non_clinical' = 'non_clinical',
  key: keyof typeof riskIds = 'a',
  targetOverride: Partial<ConversationRiskTarget> = {},
): ConversationRiskHistory => {
  const riskTarget = { ...target, ...targetOverride };
  const unconfirmed = appliedRiskHistory(recordUnconfirmedRisk([], {
    eventId: riskEventIds[key][0],
    riskId: riskIds[key],
    ...riskTarget,
    sourceMessageId: sourceMessageIds[key],
    riskDomain,
    riskCode: riskDomain === 'clinical' ? 'clinical_alert' : 'service_alert',
    occurredAt: '2026-07-17T01:01:00.000Z',
  }));
  if (state === 'unconfirmed') {
    return unconfirmed;
  }

  const confirmed = appliedRiskHistory(confirmConversationRisk(unconfirmed, {
    eventId: riskEventIds[key][1],
    riskId: riskIds[key],
    actorId: actorIds[key][0],
    actorKind: 'human',
    occurredAt: '2026-07-17T01:02:00.000Z',
  }));
  if (state === 'confirmed') {
    return confirmed;
  }

  return appliedRiskHistory(resolveConversationRisk(confirmed, {
    eventId: riskEventIds[key][2],
    riskId: riskIds[key],
    actorId: actorIds[key][1],
    actorKind: 'human',
    occurredAt: '2026-07-17T01:03:00.000Z',
    clinicalClosureVerification: riskDomain === 'clinical'
      ? {
          referenceId: closureIds[key],
          tenantId: riskTarget.tenantId,
          institutionId: riskTarget.institutionId,
          valid: true,
          revoked: false,
          verifiedAt: '2026-07-17T01:02:30.000Z',
        }
      : undefined,
  }));
};

const clinicalCheck = (
  key: keyof typeof riskIds = 'a',
  overrides: Partial<CurrentClinicalClosureCheck> = {},
): CurrentClinicalClosureCheck => ({
  riskId: riskIds[key],
  referenceId: closureIds[key],
  ...target,
  verificationState: 'valid',
  revocationState: 'not_revoked',
  checkedAt: '2026-07-17T01:05:00.000Z',
  ...overrides,
});

const segment = (
  overrides: Partial<ConversationSegment> = {},
): ConversationSegment => ({
  segmentId: target.segmentId,
  conversationId: target.conversationId,
  sequenceNo: 1,
  state: 'human_handling',
  currentHandlerId: 'actor-handler-001',
  everHumanHandled: true,
  openedByCustomerMessageId: 'message-safe-open',
  openedAt: '2026-07-17T01:00:00.000Z',
  stateChangedAt: '2026-07-17T01:02:00.000Z',
  closedAt: null,
  segmentCloseKind: 'open',
  resolutionState: 'open',
  resolvedAt: null,
  blockingReasonCodes: [],
  ...overrides,
});

const returnInput = (
  overrides: Partial<SegmentReturnToAiInput> = {},
): SegmentReturnToAiInput => ({
  operatorId: 'actor-handler-001',
  occurredAt: '2026-07-17T01:05:00.000Z',
  riskTarget: target,
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
  occurredAt: '2026-07-17T01:05:00.000Z',
  riskTarget: target,
  completeRiskHistories: [],
  hasBlockingReason: false,
  outboundState: 'clear',
  waitWindowEndsAt: '2026-07-17T01:04:00.000Z',
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
  riskTarget: target,
  completeRiskHistories: [],
  currentClinicalClosureChecks: [],
  ...overrides,
});

describe('conversation segment and risk boundary', () => {
  it('空外层集合只形成 caller 声明的 target-bound 投影，不冒充权威无风险', () => {
    const result = projectCompleteConversationRiskHistories(
      [],
      target,
      [],
      '2026-07-17T01:05:00.000Z',
    );

    expect(result).toEqual({
      kind: 'projected',
      projection: {
        ...target,
        provenance: 'caller_declared_complete_histories',
        risks: [],
      },
    });
    expect(result).not.toHaveProperty('authoritative');
    expect(result).not.toHaveProperty('repositoryVerified');
    expect(result).not.toHaveProperty('state');
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === 'projected') {
      expect(Object.isFrozen(result.projection)).toBe(true);
      expect(Object.isFrozen(result.projection.risks)).toBe(true);
    }
  });

  it('新 target 与 current check 只接受字段级 opaque reference，不接受语义化标识', () => {
    for (const riskTarget of [
      { ...target, tenantId: 'phone-fictional-001' },
      { ...target, institutionId: 'diagnosis-fictional-001' },
      { ...target, conversationId: 'address-fictional-001' },
      { ...target, segmentId: 'name-fictional-001' },
    ]) {
      expect(projectCompleteConversationRiskHistories(
        [],
        riskTarget,
        [],
        '2026-07-17T01:05:00.000Z',
      )).toEqual({ kind: 'blocked', code: 'invalid_target' });
    }

    expect(closeConversationSegmentManually(segment(), manualCloseInput({
      completeRiskHistories: [riskHistory('resolved', 'clinical')],
      currentClinicalClosureChecks: [clinicalCheck('a', {
        referenceId: 'diagnosis-fictional-closure',
      })],
    }))).toEqual({ kind: 'blocked', code: 'risk_guard_invalid' });

    const semanticEvent = structuredClone(
      riskHistory('unconfirmed'),
    ) as unknown as Array<Record<string, unknown>>;
    semanticEvent[0]!.eventId = 'patient-fictional-diagnosis';
    const semanticMessage = structuredClone(
      riskHistory('unconfirmed'),
    ) as unknown as Array<Record<string, unknown>>;
    semanticMessage[0]!.sourceMessageId = 'phone-fictional-message';
    const semanticActor = structuredClone(
      riskHistory('confirmed'),
    ) as unknown as Array<Record<string, unknown>>;
    semanticActor[1]!.confirmedByActorId = 'name-fictional-reviewer';
    for (const history of [semanticEvent, semanticMessage, semanticActor]) {
      expect(projectCompleteConversationRiskHistories(
        [history],
        target,
        [],
        '2026-07-17T01:05:00.000Z',
      )).toEqual({ kind: 'blocked', code: 'invalid_identifier' });
    }
  });

  it.each(['unconfirmed', 'confirmed', 'resolved'] as const)(
    'return_to_ai 与 auto_close 对 %s 风险均阻断，包括 resolved',
    (state) => {
      const history = riskHistory(state);
      expect(returnSegmentToAi(segment(), returnInput({
        completeRiskHistories: [history],
      }))).toEqual({ kind: 'blocked', code: 'risk_not_none' });
      expect(autoCloseConversationSegment(
        segment({ state: 'ai_handling', currentHandlerId: null, everHumanHandled: false }),
        autoCloseInput({ completeRiskHistories: [history] }),
      )).toEqual({ kind: 'blocked', code: 'risk_not_none' });
    },
  );

  it('return_to_ai 与 auto_close 只有 caller 声明的空集合可通过风险守卫', () => {
    expect(returnSegmentToAi(segment(), returnInput())).toMatchObject({ kind: 'applied' });
    expect(autoCloseConversationSegment(
      segment({ state: 'ai_handling', currentHandlerId: null, everHumanHandled: false }),
      autoCloseInput(),
    )).toMatchObject({ kind: 'applied' });
  });

  it('人工普通结束阻断活动风险，允许全 resolved 非临床风险', () => {
    for (const state of ['unconfirmed', 'confirmed'] as const) {
      expect(closeConversationSegmentManually(segment(), manualCloseInput({
        completeRiskHistories: [riskHistory(state)],
      }))).toEqual({ kind: 'blocked', code: 'risk_not_resolved' });
    }

    expect(closeConversationSegmentManually(segment(), manualCloseInput({
      completeRiskHistories: [
        riskHistory('resolved', 'non_clinical', 'a'),
        riskHistory('resolved', 'non_clinical', 'b'),
      ],
    }))).toMatchObject({ kind: 'applied' });

    expect(closeConversationSegmentManually(segment(), manualCloseInput({
      completeRiskHistories: [
        riskHistory('resolved', 'non_clinical', 'a'),
        riskHistory('confirmed', 'non_clinical', 'b'),
      ],
    }))).toEqual({ kind: 'blocked', code: 'risk_not_resolved' });
  });

  it('人工普通结束要求每个 resolved 临床风险都有当次一对一 closure check', () => {
    const clinicalA = riskHistory('resolved', 'clinical', 'a');
    const clinicalB = riskHistory('resolved', 'clinical', 'b');

    expect(closeConversationSegmentManually(segment(), manualCloseInput({
      completeRiskHistories: [clinicalA],
    }))).toEqual({ kind: 'blocked', code: 'clinical_closure_check_required' });

    expect(closeConversationSegmentManually(segment(), manualCloseInput({
      completeRiskHistories: [clinicalA, clinicalB],
      currentClinicalClosureChecks: [clinicalCheck('a'), clinicalCheck('b')],
    }))).toMatchObject({ kind: 'applied' });

    expect(closeConversationSegmentManually(segment(), manualCloseInput({
      completeRiskHistories: [clinicalA, clinicalB],
      currentClinicalClosureChecks: [clinicalCheck('a')],
    }))).toEqual({ kind: 'blocked', code: 'clinical_closure_check_required' });
  });

  it.each([
    [[clinicalCheck('a', { referenceId: closureIds.b })], 'risk_guard_invalid'],
    [[clinicalCheck('a', { institutionId: 'ins_cccccccccccccccc' })], 'risk_guard_invalid'],
    [[clinicalCheck('a', { tenantId: 'ten_bbbbbbbbbbbbbbbb' })], 'risk_guard_invalid'],
    [[clinicalCheck('a', { conversationId: 'con_dddddddddddddddd' })], 'risk_guard_invalid'],
    [[clinicalCheck('a', { segmentId: 'seg_eeeeeeeeeeeeeeee' })], 'risk_guard_invalid'],
    [[clinicalCheck('a', { verificationState: 'invalid' as 'valid' })], 'risk_guard_invalid'],
    [[clinicalCheck('a', { revocationState: 'revoked' as 'not_revoked' })], 'risk_guard_invalid'],
    [[clinicalCheck('a', { checkedAt: '2026-07-17T01:04:59.999Z' })], 'risk_guard_invalid'],
    [[clinicalCheck('a', { checkedAt: '2026-07-17T01:05:00.001Z' })], 'risk_guard_invalid'],
    [[clinicalCheck('a'), clinicalCheck('a')], 'risk_guard_invalid'],
    [[clinicalCheck('a'), clinicalCheck('b')], 'risk_guard_invalid'],
  ] as const)('人工普通结束拒绝无效、错绑、重复或额外 current check：%j', (checks, code) => {
    expect(closeConversationSegmentManually(segment(), manualCloseInput({
      completeRiskHistories: [riskHistory('resolved', 'clinical', 'a')],
      currentClinicalClosureChecks: checks,
    }))).toEqual({ kind: 'blocked', code });
  });

  it('scope 与 target 在处理人、状态和业务守卫前 fail-closed', () => {
    const crossScope = riskHistory('unconfirmed', 'clinical', 'a', {
      institutionId: 'ins_cccccccccccccccc',
    });
    expect(returnSegmentToAi(
      segment({ state: 'ai_handling' }),
      returnInput({
        operatorId: 'actor-other-001',
        completeRiskHistories: [crossScope],
      }),
    )).toEqual({ kind: 'blocked', code: 'risk_guard_invalid' });

    const crossTarget = riskHistory('unconfirmed', 'clinical', 'a', {
      segmentId: 'seg_eeeeeeeeeeeeeeee',
    });
    expect(autoCloseConversationSegment(
      segment({ state: 'human_handling' }),
      autoCloseInput({ completeRiskHistories: [crossTarget] }),
    )).toEqual({ kind: 'blocked', code: 'risk_guard_invalid' });

    expect(returnSegmentToAi(segment(), returnInput({
      riskTarget: { ...target, conversationId: 'con_dddddddddddddddd' },
    }))).toEqual({ kind: 'blocked', code: 'risk_guard_invalid' });
  });

  it('projector 对 scope/target 的比较优先于后续结构损坏与非法时间', () => {
    const crossScope = riskHistory('unconfirmed', 'clinical', 'a', {
      institutionId: 'ins_cccccccccccccccc',
    });
    const crossTarget = riskHistory('unconfirmed', 'clinical', 'a', {
      conversationId: 'con_dddddddddddddddd',
    });
    const sparse = new Array(1);

    expect(projectCompleteConversationRiskHistories(
      [crossScope, sparse],
      target,
      [],
      'not-a-timestamp',
    )).toEqual({ kind: 'blocked', code: 'scope_mismatch' });
    expect(projectCompleteConversationRiskHistories(
      [crossTarget, sparse],
      target,
      [],
      'not-a-timestamp',
    )).toEqual({ kind: 'blocked', code: 'target_mismatch' });

    const sparseChecks = new Array(1);
    let checkContainerTouches = 0;
    const throwingChecks = new Proxy([], {
      getPrototypeOf: () => {
        checkContainerTouches += 1;
        throw new Error('must not inspect checks after known scope mismatch');
      },
    });
    expect(projectCompleteConversationRiskHistories(
      [crossScope],
      target,
      sparseChecks,
      'not-a-timestamp',
    )).toEqual({ kind: 'blocked', code: 'scope_mismatch' });
    expect(() => projectCompleteConversationRiskHistories(
      [crossScope],
      target,
      throwingChecks,
      'not-a-timestamp',
    )).not.toThrow();
    expect(projectCompleteConversationRiskHistories(
      [crossScope],
      target,
      throwingChecks,
      'not-a-timestamp',
    )).toEqual({ kind: 'blocked', code: 'scope_mismatch' });
    expect(checkContainerTouches).toBe(0);

    const crossScopeWithExtraKey = structuredClone(
      crossScope,
    ) as unknown as Array<Record<string, unknown>>;
    crossScopeWithExtraKey[0]!.messageBody = 'fictional-message-body';
    expect(projectCompleteConversationRiskHistories(
      [crossScopeWithExtraKey],
      target,
      [],
      'not-a-timestamp',
    )).toEqual({ kind: 'blocked', code: 'scope_mismatch' });

    let laterHistoryTouches = 0;
    const throwingLaterHistory = new Proxy([], {
      getPrototypeOf: () => {
        laterHistoryTouches += 1;
        throw new Error('must not inspect history after known scope mismatch');
      },
    });
    expect(projectCompleteConversationRiskHistories(
      [crossScope, throwingLaterHistory],
      target,
      [],
      'not-a-timestamp',
    )).toEqual({ kind: 'blocked', code: 'scope_mismatch' });
    expect(laterHistoryTouches).toBe(0);

    let laterCheckTouches = 0;
    const throwingLaterCheck = new Proxy({}, {
      getPrototypeOf: () => {
        laterCheckTouches += 1;
        throw new Error('must not inspect check after known scope mismatch');
      },
    });
    expect(projectCompleteConversationRiskHistories(
      [],
      target,
      [
        clinicalCheck('a', { institutionId: 'ins_cccccccccccccccc' }),
        throwingLaterCheck,
      ],
      'not-a-timestamp',
    )).toEqual({ kind: 'blocked', code: 'scope_mismatch' });
    expect(laterCheckTouches).toBe(0);

    expect(projectCompleteConversationRiskHistories(
      [],
      target,
      [{
        ...clinicalCheck('a', { institutionId: 'ins_cccccccccccccccc' }),
        providerPayload: 'fictional-provider-payload',
      }],
      'not-a-timestamp',
    )).toEqual({ kind: 'blocked', code: 'scope_mismatch' });
  });

  it.each(['riskState', 'hasRisk', 'riskProjection'] as const)(
    '旧裸风险信任字段 %s 即使叠加合法输入也会被 exact-key 拒绝',
    (key) => {
      const rawInput = { ...returnInput(), [key]: key === 'riskState' ? 'none' : false };
      expect(returnSegmentToAi(segment(), rawInput as SegmentReturnToAiInput)).toEqual({
        kind: 'blocked',
        code: 'risk_guard_invalid',
      });
    },
  );

  it('auto_close 与 manual_close 同样拒绝旧裸风险字段', () => {
    const aiSegment = segment({
      state: 'ai_handling',
      currentHandlerId: null,
      everHumanHandled: false,
    });
    expect(autoCloseConversationSegment(aiSegment, {
      ...autoCloseInput(),
      riskState: 'none',
    } as SegmentAutoCloseInput)).toEqual({ kind: 'blocked', code: 'risk_guard_invalid' });
    expect(closeConversationSegmentManually(segment(), {
      ...manualCloseInput(),
      hasRisk: false,
    } as SegmentManualCloseInput)).toEqual({ kind: 'blocked', code: 'risk_guard_invalid' });
  });

  it('三类组合输入对布尔、枚举和操作者值域做 runtime fail-closed 校验', () => {
    const invalidReturnInputs = [
      returnInput({ hasBlockingReason: 'false' as unknown as boolean }),
      returnInput({ hasUnconfirmedBusinessAction: undefined as unknown as boolean }),
      returnInput({ outboundState: 'garbage' as 'clear' }),
      returnInput({ aiReadiness: 'garbage' as 'ready' }),
      returnInput({ knowledgeReadiness: 'garbage' as 'ready' }),
      returnInput({ sensitiveAuthorizationReadiness: 'garbage' as 'ready' }),
      returnInput({ messageTypeAllowed: 'true' as unknown as boolean }),
      returnInput({ institutionPolicyAllowsAi: 1 as unknown as boolean }),
    ];
    for (const invalidInput of invalidReturnInputs) {
      expect(returnSegmentToAi(segment(), invalidInput)).toEqual({
        kind: 'blocked',
        code: 'risk_guard_invalid',
      });
    }

    const aiSegment = segment({
      state: 'ai_handling',
      currentHandlerId: null,
      everHumanHandled: false,
    });
    const invalidAutoInputs = [
      autoCloseInput({ hasBlockingReason: 'false' as unknown as boolean }),
      autoCloseInput({ outboundState: 'garbage' as 'clear' }),
      autoCloseInput({ channelAllowsAutoClose: 'true' as unknown as boolean }),
      autoCloseInput({ newInboundState: 'garbage' as 'none' }),
    ];
    for (const invalidInput of invalidAutoInputs) {
      expect(autoCloseConversationSegment(aiSegment, invalidInput)).toEqual({
        kind: 'blocked',
        code: 'risk_guard_invalid',
      });
    }

    expect(closeConversationSegmentManually(segment(), manualCloseInput({
      operatorId: { nested: true } as unknown as string,
    }))).toEqual({ kind: 'blocked', code: 'risk_guard_invalid' });
  });

  it('嵌套 getter 值在 structuredClone 前被 primitive/literal 校验拒绝且读取次数为 0', () => {
    let reads = 0;
    const nestedValue = {};
    Object.defineProperty(nestedValue, 'secret', {
      enumerable: true,
      get: () => {
        reads += 1;
        return 'fictional-secret';
      },
    });

    const nestedTarget = {
      ...target,
      tenantId: nestedValue,
    } as unknown as ConversationRiskTarget;
    expect(projectCompleteConversationRiskHistories(
      [], nestedTarget, [], '2026-07-17T01:05:00.000Z',
    )).toEqual({ kind: 'blocked', code: 'invalid_target' });

    const historyWithNestedRiskCode = structuredClone(
      riskHistory('unconfirmed'),
    ) as unknown as Array<Record<string, unknown>>;
    historyWithNestedRiskCode[0]!.riskCode = nestedValue;
    expect(projectCompleteConversationRiskHistories(
      [historyWithNestedRiskCode], target, [], '2026-07-17T01:05:00.000Z',
    )).toEqual({ kind: 'blocked', code: 'invalid_risk_histories' });

    const checkWithNestedReference = {
      ...clinicalCheck(),
      referenceId: nestedValue,
    };
    expect(projectCompleteConversationRiskHistories(
      [riskHistory('resolved', 'clinical')],
      target,
      [checkWithNestedReference],
      '2026-07-17T01:05:00.000Z',
    )).toEqual({ kind: 'blocked', code: 'invalid_clinical_closure_checks' });

    expect(returnSegmentToAi(segment(), returnInput({
      outboundState: nestedValue as unknown as 'clear',
    }))).toEqual({ kind: 'blocked', code: 'risk_guard_invalid' });
    expect(reads).toBe(0);
  });

  it('额外自由文本或 Symbol 不进入风险组合守卫', () => {
    const withText = { ...manualCloseInput(), note: 'fictional diagnosis and address' };
    const withSymbol = { ...autoCloseInput() } as Record<PropertyKey, unknown>;
    withSymbol[Symbol('providerPayload')] = 'fictional-provider-secret';

    expect(closeConversationSegmentManually(
      segment(),
      withText as SegmentManualCloseInput,
    )).toEqual({ kind: 'blocked', code: 'risk_guard_invalid' });
    expect(autoCloseConversationSegment(
      segment({ state: 'ai_handling', currentHandlerId: null, everHumanHandled: false }),
      withSymbol as SegmentAutoCloseInput,
    )).toEqual({ kind: 'blocked', code: 'risk_guard_invalid' });
  });

  it('完整集合拒绝空 inner、重复 riskId、跨链重复 eventId 和混合 target', () => {
    const historyA = riskHistory('unconfirmed', 'non_clinical', 'a');
    const historyB = riskHistory('unconfirmed', 'non_clinical', 'b');
    const duplicateRisk = riskHistory('unconfirmed', 'non_clinical', 'a');
    const duplicateEvent = [
      { ...historyB[0], eventId: historyA[0]!.eventId },
    ] as ConversationRiskHistory;
    const mixedTarget = riskHistory('unconfirmed', 'non_clinical', 'c', {
      conversationId: 'con_dddddddddddddddd',
    });

    for (const histories of [
      [[]],
      [historyA, duplicateRisk],
      [historyA, duplicateEvent],
      [historyA, mixedTarget],
    ]) {
      expect(projectCompleteConversationRiskHistories(
        histories,
        target,
        [],
        '2026-07-17T01:05:00.000Z',
      )).toMatchObject({ kind: 'blocked' });
    }
  });

  it('target、外层与内层数组、事件、check 的 sparse/accessor/Proxy 均受控阻断', () => {
    const sparseOuter = new Array(1);
    const sparseInner = new Array(1);
    const accessorHistory = structuredClone(riskHistory('unconfirmed')) as ConversationRiskHistory;
    let eventReads = 0;
    Object.defineProperty(accessorHistory[0] as object, 'riskCode', {
      enumerable: true,
      configurable: true,
      get: () => {
        eventReads += 1;
        return 'clinical_alert';
      },
    });

    const proxyTarget = new Proxy({ ...target }, {});
    const proxyOuter = new Proxy([] as ConversationRiskHistory[], {});
    const invalidCalls = [
      () => projectCompleteConversationRiskHistories(
        sparseOuter,
        target,
        [],
        '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        [sparseInner],
        target,
        [],
        '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        [accessorHistory],
        target,
        [],
        '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        [],
        proxyTarget,
        [],
        '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        proxyOuter,
        target,
        [],
        '2026-07-17T01:05:00.000Z',
      ),
    ];

    for (const invoke of invalidCalls) {
      expect(invoke).not.toThrow();
      expect(invoke()).toMatchObject({ kind: 'blocked' });
    }
    expect(eventReads).toBe(0);
  });

  it('内层 Proxy、临床引用/scope、check accessor 与 Symbol 均 fail-closed 且不读 getter', () => {
    const unconfirmed = structuredClone(riskHistory('unconfirmed')) as ConversationRiskHistory;
    const innerProxy = new Proxy([...unconfirmed], {});
    const eventProxyHistory = [new Proxy({ ...unconfirmed[0]! }, {})];
    const resolved = structuredClone(
      riskHistory('resolved', 'clinical'),
    ) as ConversationRiskHistory;
    const resolvedEvent = resolved[2];
    if (resolvedEvent?.kind !== 'risk_resolved' || resolvedEvent.clinicalClosureReference === null) {
      throw new Error('expected clinical closure reference');
    }
    const referenceProxyHistory = [
      resolved[0]!,
      resolved[1]!,
      {
        ...resolvedEvent,
        clinicalClosureReference: new Proxy(
          { ...resolvedEvent.clinicalClosureReference },
          {},
        ),
      },
    ];
    const scopeAccessorHistory = structuredClone(resolved) as ConversationRiskHistory;
    const scopeResolvedEvent = scopeAccessorHistory[2];
    if (
      scopeResolvedEvent?.kind !== 'risk_resolved'
      || scopeResolvedEvent.clinicalClosureReference === null
    ) {
      throw new Error('expected clinical closure scope');
    }
    let scopeReads = 0;
    Object.defineProperty(scopeResolvedEvent.clinicalClosureReference.scope, 'tenantId', {
      enumerable: true,
      configurable: true,
      get: () => {
        scopeReads += 1;
        return target.tenantId;
      },
    });

    const checkWithAccessor = { ...clinicalCheck() } as Record<string, unknown>;
    let checkReads = 0;
    Object.defineProperty(checkWithAccessor, 'referenceId', {
      enumerable: true,
      configurable: true,
      get: () => {
        checkReads += 1;
        return closureIds.a;
      },
    });
    const sparseChecks = new Array(1);
    const checkProxy = new Proxy({ ...clinicalCheck() }, {});
    const checkWithSymbol = { ...clinicalCheck() } as Record<PropertyKey, unknown>;
    checkWithSymbol[Symbol('credential')] = 'fictional-credential';
    const eventWithSymbolHistory = structuredClone(
      unconfirmed,
    ) as unknown as Array<Record<PropertyKey, unknown>>;
    eventWithSymbolHistory[0]![Symbol('messageBody')] = 'fictional-message-body';
    const targetWithSymbol = { ...target } as Record<PropertyKey, unknown>;
    targetWithSymbol[Symbol('externalAccount')] = 'fictional-account';
    const outerWithSymbol: unknown[] = [];
    Object.defineProperty(outerWithSymbol, Symbol('providerPayload'), {
      value: 'fictional-payload',
      enumerable: true,
    });

    const calls = [
      () => projectCompleteConversationRiskHistories(
        [innerProxy], target, [], '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        [eventProxyHistory], target, [], '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        [referenceProxyHistory], target, [], '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        [scopeAccessorHistory], target, [], '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        [resolved], target, [checkWithAccessor], '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        [resolved], target, sparseChecks, '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        [resolved], target, [checkProxy], '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        [resolved], target, [checkWithSymbol], '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        [eventWithSymbolHistory], target, [], '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        [], targetWithSymbol, [], '2026-07-17T01:05:00.000Z',
      ),
      () => projectCompleteConversationRiskHistories(
        outerWithSymbol, target, [], '2026-07-17T01:05:00.000Z',
      ),
    ];
    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toMatchObject({ kind: 'blocked' });
    }
    expect(scopeReads).toBe(0);
    expect(checkReads).toBe(0);
  });

  it('Segment 根输入与 riskTarget accessor 不会被读取或抛出', () => {
    let rootReads = 0;
    let targetReads = 0;
    const root = { ...returnInput() } as Record<string, unknown>;
    Object.defineProperty(root, 'operatorId', {
      enumerable: true,
      configurable: true,
      get: () => {
        rootReads += 1;
        return 'actor-handler-001';
      },
    });
    const accessorTarget = { ...target } as Record<string, unknown>;
    Object.defineProperty(accessorTarget, 'tenantId', {
      enumerable: true,
      configurable: true,
      get: () => {
        targetReads += 1;
        return target.tenantId;
      },
    });

    expect(() => returnSegmentToAi(segment(), root as SegmentReturnToAiInput)).not.toThrow();
    expect(returnSegmentToAi(segment(), root as SegmentReturnToAiInput)).toEqual({
      kind: 'blocked',
      code: 'risk_guard_invalid',
    });
    expect(returnSegmentToAi(segment(), returnInput({
      riskTarget: accessorTarget as ConversationRiskTarget,
    }))).toEqual({ kind: 'blocked', code: 'risk_guard_invalid' });
    expect(rootReads).toBe(0);
    expect(targetReads).toBe(0);
  });

  it('风险事实晚于转换时间时 fail-closed，不能消费未来事实', () => {
    expect(returnSegmentToAi(segment(), returnInput({
      occurredAt: '2026-07-17T01:00:30.000Z',
      completeRiskHistories: [riskHistory('unconfirmed')],
    }))).toEqual({ kind: 'blocked', code: 'risk_guard_invalid' });
  });

  it('blocked 只输出受控 kind/code，不泄露 scope、风险、消息、引用或 actor', () => {
    const result = returnSegmentToAi(segment(), returnInput({
      completeRiskHistories: [riskHistory('confirmed', 'clinical')],
    }));
    expect(Reflect.ownKeys(result)).toEqual(['kind', 'code']);
    expect(result).toEqual({ kind: 'blocked', code: 'risk_not_none' });
    expect(JSON.stringify(result)).not.toMatch(
      /tenant|institution|conversation|segment|riskId|riskCode|message|reference|actor/iu,
    );
    expect(Object.isFrozen(result)).toBe(true);

    const projectorBlocked = projectCompleteConversationRiskHistories(
      [riskHistory('resolved', 'clinical')],
      target,
      [clinicalCheck('a', { referenceId: closureIds.b })],
      '2026-07-17T01:05:00.000Z',
    );
    expect(Reflect.ownKeys(projectorBlocked)).toEqual(['kind', 'code']);
    expect(projectorBlocked).toEqual({
      kind: 'blocked',
      code: 'invalid_clinical_closure_checks',
    });
    expect(Object.isFrozen(projectorBlocked)).toBe(true);
  });

  it('成功输出深冻结且不别名或冻结调用方输入', () => {
    const current = segment();
    const input = returnInput();
    const originalBlockingReasons = current.blockingReasonCodes;
    const result = returnSegmentToAi(current, input);

    expect(result.kind).toBe('applied');
    expect(Object.isFrozen(current)).toBe(false);
    expect(Object.isFrozen(originalBlockingReasons)).toBe(false);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.completeRiskHistories)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === 'applied') {
      expect(Object.isFrozen(result.segment)).toBe(true);
      expect(Object.isFrozen(result.segment.blockingReasonCodes)).toBe(true);
      expect(result.segment.blockingReasonCodes).not.toBe(originalBlockingReasons);
    }
  });

  it('非空集合投影不修改或冻结 caller facts，只返回低敏深冻结快照', () => {
    const history = structuredClone(
      riskHistory('resolved', 'clinical'),
    ) as ConversationRiskHistory;
    const checks = [{ ...clinicalCheck() }];
    const histories = [history];
    const historiesBefore = structuredClone(histories);
    const checksBefore = structuredClone(checks);
    const result = projectCompleteConversationRiskHistories(
      histories,
      target,
      checks,
      '2026-07-17T01:05:00.000Z',
    );

    expect(result).toEqual({
      kind: 'projected',
      projection: {
        ...target,
        provenance: 'caller_declared_complete_histories',
        risks: [{
          riskId: riskIds.a,
          state: 'resolved',
          riskDomain: 'clinical',
          clinicalClosureCheckState: 'current',
        }],
      },
    });
    expect(histories).toEqual(historiesBefore);
    expect(checks).toEqual(checksBefore);
    expect(Object.isFrozen(histories)).toBe(false);
    expect(Object.isFrozen(history)).toBe(false);
    expect(Object.isFrozen(checks)).toBe(false);
    expect(Object.isFrozen(checks[0])).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === 'projected') {
      expect(Object.isFrozen(result.projection.risks[0])).toBe(true);
      expect(result.projection.risks[0]).not.toBe(history[0]);
      expect(result.projection.risks[0]).not.toBe(checks[0]);
      expect(result.projection.risks[0]).not.toHaveProperty('riskCode');
      expect(result.projection.risks[0]).not.toHaveProperty('sourceMessageId');
      expect(result.projection.risks[0]).not.toHaveProperty('referenceId');
    }
  });

  it('非空风险阻断路径同样不修改、不冻结 caller history', () => {
    const history = structuredClone(
      riskHistory('confirmed', 'non_clinical'),
    ) as ConversationRiskHistory;
    const histories = [history];
    const input = returnInput({ completeRiskHistories: histories });
    const before = structuredClone(input);
    const result = returnSegmentToAi(segment(), input);

    expect(result).toEqual({ kind: 'blocked', code: 'risk_not_none' });
    expect(input).toEqual(before);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(histories)).toBe(false);
    expect(Object.isFrozen(history)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('force close 不读取、清除或改写风险集合，也不制造 resolved', () => {
    const histories = [riskHistory('confirmed', 'clinical')];
    const before = structuredClone(histories);
    const result = forceCloseConversationSegment(segment(), {
      forceCloseAuthorized: true,
      occurredAt: '2026-07-17T01:05:00.000Z',
    });

    expect(result).toMatchObject({
      kind: 'applied',
      segment: {
        state: 'closed',
        segmentCloseKind: 'forced',
        resolutionState: 'open',
        resolvedAt: null,
        blockingReasonCodes: ['forced_close_unresolved'],
      },
    });
    expect(histories).toEqual(before);
    expect(histories[0]![histories[0]!.length - 1]!.kind).toBe('risk_confirmed');
  });
});
