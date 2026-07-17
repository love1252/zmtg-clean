import { describe, expect, it } from 'vitest';
import {
  confirmConversationRisk,
  conversationRiskDomains,
  conversationRiskStates,
  projectCompleteConversationRiskHistories,
  projectConversationRisk,
  recordUnconfirmedRisk,
  resolveConversationRisk,
  type ClinicalClosureVerification,
  type ConversationRiskHistory,
  type ConversationRiskMutationResult,
  type ConversationRiskProjection,
  type ConversationRiskTarget,
} from '@/modules/institution-conversations/domain/conversation-risks';
import type { ConversationSegment } from '@/modules/institution-conversations/domain/conversation-segments';

type RecordRiskInput = Parameters<typeof recordUnconfirmedRisk>[1];

const recordInput: RecordRiskInput = {
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
};

const confirmInput = {
  eventId: 'risk-event-002',
  riskId: recordInput.riskId,
  actorId: 'actor-reviewer-001',
  actorKind: 'human',
  occurredAt: '2026-07-17T01:02:00.000Z',
} as const;

const closureVerification: ClinicalClosureVerification = {
  referenceId: 'clinical-closure-001',
  tenantId: recordInput.tenantId,
  institutionId: recordInput.institutionId,
  valid: true,
  revoked: false,
  verifiedAt: '2026-07-17T01:02:30.000Z',
};

const resolveInput = {
  eventId: 'risk-event-003',
  riskId: recordInput.riskId,
  actorId: 'actor-reviewer-002',
  actorKind: 'human',
  occurredAt: '2026-07-17T01:03:00.000Z',
  clinicalClosureVerification: closureVerification,
} as const;

const compositionTarget: ConversationRiskTarget = {
  tenantId: 'ten_aaaaaaaaaaaaaaaa',
  institutionId: 'ins_bbbbbbbbbbbbbbbb',
  conversationId: 'con_cccccccccccccccc',
  segmentId: 'seg_dddddddddddddddd',
};

const applied = (result: ConversationRiskMutationResult): Extract<
  ConversationRiskMutationResult,
  { kind: 'applied' }
> => {
  expect(result.kind).toBe('applied');
  if (result.kind !== 'applied') {
    throw new Error('expected applied risk mutation, received ' + result.code);
  }
  return result;
};

const projection = (history: ConversationRiskHistory): ConversationRiskProjection => {
  const result = projectConversationRisk(history);
  expect(result.kind).toBe('projected');
  if (result.kind !== 'projected') {
    throw new Error('expected projected risk history, received ' + result.code);
  }
  return result.projection;
};

const unconfirmedHistory = (
  overrides: Partial<RecordRiskInput> = {},
): ConversationRiskHistory => applied(recordUnconfirmedRisk([], {
  ...recordInput,
  ...overrides,
})).history;

const confirmedHistory = (
  overrides: Partial<RecordRiskInput> = {},
): ConversationRiskHistory => applied(confirmConversationRisk(
  unconfirmedHistory(overrides),
  confirmInput,
)).history;

describe('conversation risk domain', () => {
  it('冻结四态投影和两个风险域，空历史投影为 none', () => {
    expect(conversationRiskStates).toEqual(['none', 'unconfirmed', 'confirmed', 'resolved']);
    expect(conversationRiskDomains).toEqual(['clinical', 'non_clinical']);
    expect(projectConversationRisk([])).toEqual({
      kind: 'projected',
      projection: { state: 'none' },
    });
  });

  it.each(['clinical', 'non_clinical'] as const)(
    '以追加事件创建 %s unconfirmed 风险',
    (riskDomain) => {
      const result = applied(recordUnconfirmedRisk([], {
        ...recordInput,
        riskDomain,
      }));
      expect(result.history).toHaveLength(1);
      expect(result.projection).toMatchObject({
        state: 'unconfirmed',
        riskDomain,
        riskCode: 'clinical_alert',
      });
      expect(result.appendedEvent.kind).toBe('risk_unconfirmed');
    },
  );

  it.each([
    '',
    ' ',
    'Clinical Alert',
    'clinical\nalert',
    'clinical/alert',
    'a' + 'b'.repeat(64),
  ])('risk code 仅接受非空安全格式：%j', (riskCode) => {
    expect(recordUnconfirmedRisk([], {
      ...recordInput,
      riskCode,
    })).toEqual({ kind: 'blocked', code: 'invalid_risk_code' });
  });

  it.each([
    '2026-07-17T01:01:00.000',
    '2026-07-17T01:01:00',
    '2026-07-17',
    '2026-02-30T01:01:00.000Z',
  ])('时间只接受 canonical UTC 毫秒格式：%j', (occurredAt) => {
    expect(recordUnconfirmedRisk([], {
      ...recordInput,
      occurredAt,
    })).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
  });

  it('确认、解决及临床引用时间均拒绝无时区格式', () => {
    expect(confirmConversationRisk(unconfirmedHistory(), {
      ...confirmInput,
      occurredAt: '2026-07-17T01:02:00.000',
    })).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });

    const history = confirmedHistory();
    expect(resolveConversationRisk(history, {
      ...resolveInput,
      occurredAt: '2026-07-17T01:03:00.000',
    })).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
    expect(resolveConversationRisk(history, {
      ...resolveInput,
      clinicalClosureVerification: {
        ...closureVerification,
        verifiedAt: '2026-07-17T01:02:30.000',
      },
    })).toEqual({ kind: 'blocked', code: 'clinical_closure_reference_invalid' });
  });

  it('已有风险时禁止覆盖为新的 unconfirmed，原历史不变', () => {
    const history = unconfirmedHistory();
    const before = structuredClone(history);
    expect(recordUnconfirmedRisk(history, {
      ...recordInput,
      eventId: 'risk-event-099',
      riskId: 'risk-099',
    })).toEqual({ kind: 'blocked', code: 'risk_already_recorded' });
    expect(history).toEqual(before);
  });

  it('人工按 unconfirmed → confirmed → resolved 追加，旧历史不被覆盖', () => {
    const unconfirmed = unconfirmedHistory({ riskDomain: 'non_clinical' });
    const unconfirmedBefore = structuredClone(unconfirmed);
    const confirmed = applied(confirmConversationRisk(unconfirmed, confirmInput));
    expect(confirmed.projection.state).toBe('confirmed');
    expect(confirmed.history.map((event) => event.kind)).toEqual([
      'risk_unconfirmed',
      'risk_confirmed',
    ]);
    expect(unconfirmed).toEqual(unconfirmedBefore);

    const confirmedBefore = structuredClone(confirmed.history);
    const resolved = applied(resolveConversationRisk(confirmed.history, {
      ...resolveInput,
      clinicalClosureVerification: undefined,
    }));
    expect(resolved.projection).toMatchObject({
      state: 'resolved',
      riskDomain: 'non_clinical',
      clinicalClosureReferenceId: null,
    });
    expect(resolved.history.map((event) => event.kind)).toEqual([
      'risk_unconfirmed',
      'risk_confirmed',
      'risk_resolved',
    ]);
    expect(confirmed.history).toEqual(confirmedBefore);
  });

  it.each(['clinical', 'non_clinical'] as const)(
    'AI 不得自动确认 %s 风险',
    (riskDomain) => {
      expect(confirmConversationRisk(unconfirmedHistory({ riskDomain }), {
        ...confirmInput,
        actorKind: 'ai',
      })).toEqual({ kind: 'blocked', code: 'human_confirmation_required' });
    },
  );

  it('非临床风险也不得由 AI 自动解决', () => {
    expect(resolveConversationRisk(
      confirmedHistory({ riskDomain: 'non_clinical' }),
      {
        ...resolveInput,
        actorKind: 'ai',
        clinicalClosureVerification: undefined,
      },
    )).toEqual({ kind: 'blocked', code: 'human_confirmation_required' });
  });

  it('禁止跳级、重复、回退式写入', () => {
    expect(confirmConversationRisk([], confirmInput)).toEqual({
      kind: 'blocked',
      code: 'risk_confirmation_requires_unconfirmed',
    });
    expect(resolveConversationRisk(unconfirmedHistory(), resolveInput)).toEqual({
      kind: 'blocked',
      code: 'risk_resolution_requires_confirmed',
    });

    const confirmed = confirmedHistory();
    expect(confirmConversationRisk(confirmed, {
      ...confirmInput,
      eventId: 'risk-event-009',
      occurredAt: '2026-07-17T01:03:00.000Z',
    })).toEqual({
      kind: 'blocked',
      code: 'risk_confirmation_requires_unconfirmed',
    });

    const resolved = applied(resolveConversationRisk(confirmed, resolveInput)).history;
    expect(resolveConversationRisk(resolved, {
      ...resolveInput,
      eventId: 'risk-event-010',
      occurredAt: '2026-07-17T01:04:00.000Z',
    })).toEqual({
      kind: 'blocked',
      code: 'risk_resolution_requires_confirmed',
    });
    expect(confirmConversationRisk(resolved, {
      ...confirmInput,
      eventId: 'risk-event-011',
      occurredAt: '2026-07-17T01:04:00.000Z',
    })).toEqual({
      kind: 'blocked',
      code: 'risk_confirmation_requires_unconfirmed',
    });
  });

  it.each([
    [undefined, 'clinical_closure_reference_required'],
    [{ ...closureVerification, tenantId: 'tenant-other' }, 'clinical_closure_scope_mismatch'],
    [{ ...closureVerification, institutionId: 'institution-other' }, 'clinical_closure_scope_mismatch'],
    [{ ...closureVerification, valid: false }, 'clinical_closure_reference_invalid'],
    [{ ...closureVerification, revoked: true }, 'clinical_closure_reference_revoked'],
  ] as const)('临床 resolved 引用守卫 fail-closed：%j', (clinicalClosureVerification, code) => {
    const history = confirmedHistory();
    const before = structuredClone(history);
    expect(resolveConversationRisk(history, {
      ...resolveInput,
      clinicalClosureVerification,
    })).toEqual({ kind: 'blocked', code });
    expect(history).toEqual(before);
  });

  it('同机构、有效、未撤销的临床关闭引用仍需人工确认后才能 resolved', () => {
    const history = confirmedHistory();
    expect(resolveConversationRisk(history, {
      ...resolveInput,
      actorKind: 'ai',
    })).toEqual({ kind: 'blocked', code: 'human_confirmation_required' });

    const result = applied(resolveConversationRisk(history, resolveInput));
    expect(result.projection).toMatchObject({
      state: 'resolved',
      riskDomain: 'clinical',
      clinicalClosureReferenceId: closureVerification.referenceId,
    });
    expect(result.appendedEvent).toEqual({
      kind: 'risk_resolved',
      eventId: 'risk-event-003',
      riskId: 'risk-001',
      resolvedByActorId: 'actor-reviewer-002',
      occurredAt: '2026-07-17T01:03:00.000Z',
      clinicalClosureReference: {
        referenceId: 'clinical-closure-001',
        scope: {
          tenantId: 'tenant-001',
          institutionId: 'institution-001',
        },
        verificationState: 'valid',
        revocationState: 'not_revoked',
        verifiedAt: '2026-07-17T01:02:30.000Z',
      },
    });
    expect(result.appendedEvent).not.toHaveProperty('valid');
    expect(result.appendedEvent).not.toHaveProperty('revoked');
    expect(result.appendedEvent).not.toHaveProperty('providerPayload');
  });

  it('临床关闭引用必须在 resolved 事件发生前完成验证', () => {
    const history = confirmedHistory();
    expect(resolveConversationRisk(history, {
      ...resolveInput,
      clinicalClosureVerification: {
        ...closureVerification,
        verifiedAt: '2026-07-17T01:03:00.001Z',
      },
    })).toEqual({ kind: 'blocked', code: 'clinical_closure_reference_invalid' });
  });

  it('riskId 不一致和倒序时间均 fail-closed', () => {
    expect(confirmConversationRisk(unconfirmedHistory(), {
      ...confirmInput,
      riskId: 'risk-other',
    })).toEqual({ kind: 'blocked', code: 'risk_id_mismatch' });
    expect(confirmConversationRisk(unconfirmedHistory(), {
      ...confirmInput,
      occurredAt: '2026-07-17T00:59:00.000Z',
    })).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
  });

  it('非法历史顺序、重复 eventId、riskId 混用和时间回退均拒绝投影', () => {
    const unconfirmed = unconfirmedHistory();
    const confirmed = confirmedHistory();
    const confirmedEvent = confirmed[1];
    if (!confirmedEvent || confirmedEvent.kind !== 'risk_confirmed') {
      throw new Error('expected confirmed event');
    }

    const invalidHistories: ConversationRiskHistory[] = [
      [confirmedEvent],
      [
        unconfirmed[0]!,
        { ...confirmedEvent, eventId: unconfirmed[0]!.eventId },
      ],
      [
        unconfirmed[0]!,
        { ...confirmedEvent, riskId: 'risk-other' },
      ],
      [
        unconfirmed[0]!,
        { ...confirmedEvent, occurredAt: '2026-07-17T00:59:00.000Z' },
      ],
    ];
    for (const history of invalidHistories) {
      expect(projectConversationRisk(history)).toEqual({
        kind: 'blocked',
        code: 'invalid_risk_history',
      });
    }
  });

  it('临床 resolved 历史对跨 scope、失效、撤销及未来验证逐项 fail-closed', () => {
    const resolved = applied(resolveConversationRisk(confirmedHistory(), resolveInput)).history;
    const resolvedEvent = resolved[2];
    if (resolvedEvent?.kind !== 'risk_resolved' || resolvedEvent.clinicalClosureReference === null) {
      throw new Error('expected resolved clinical risk event');
    }
    const reference = resolvedEvent.clinicalClosureReference;
    const withReference = (clinicalClosureReference: unknown): ConversationRiskHistory => [
      resolved[0]!,
      resolved[1]!,
      {
        ...resolvedEvent,
        clinicalClosureReference,
      },
    ] as unknown as ConversationRiskHistory;

    const invalidReferences = [
      {
        ...reference,
        scope: { ...reference.scope, institutionId: 'institution-other' },
      },
      { ...reference, verificationState: 'invalid' },
      { ...reference, revocationState: 'revoked' },
      { ...reference, verifiedAt: '2026-07-17T01:03:00.001Z' },
    ];
    for (const invalidReference of invalidReferences) {
      expect(projectConversationRisk(withReference(invalidReference))).toEqual({
        kind: 'blocked',
        code: 'invalid_risk_history',
      });
    }
  });

  it('所有风险事件、临床引用及其 scope 均拒绝额外 own keys', () => {
    const unconfirmed = unconfirmedHistory();
    const confirmed = confirmedHistory();
    const resolved = applied(resolveConversationRisk(confirmed, resolveInput)).history;
    const unconfirmedEvent = unconfirmed[0]!;
    const confirmedEvent = confirmed[1]!;
    const resolvedEvent = resolved[2];
    if (resolvedEvent?.kind !== 'risk_resolved' || resolvedEvent.clinicalClosureReference === null) {
      throw new Error('expected resolved clinical risk event');
    }
    const reference = resolvedEvent.clinicalClosureReference;

    const historiesWithExtraKeys = [
      [{ ...unconfirmedEvent, messageBody: 'fictional-sensitive-text' }],
      [unconfirmedEvent, { ...confirmedEvent, providerPayload: 'fictional-provider-data' }],
      [
        unconfirmedEvent,
        confirmedEvent,
        { ...resolvedEvent, externalAccount: 'fictional-account' },
      ],
      [
        unconfirmedEvent,
        confirmedEvent,
        {
          ...resolvedEvent,
          clinicalClosureReference: { ...reference, credential: 'fictional-credential' },
        },
      ],
      [
        unconfirmedEvent,
        confirmedEvent,
        {
          ...resolvedEvent,
          clinicalClosureReference: {
            ...reference,
            scope: { ...reference.scope, providerPayload: 'fictional-provider-data' },
          },
        },
      ],
    ] as unknown as ConversationRiskHistory[];

    for (const history of historiesWithExtraKeys) {
      expect(projectConversationRisk(history)).toEqual({
        kind: 'blocked',
        code: 'invalid_risk_history',
      });
    }
  });

  it('风险状态机与 segment 正交，不关闭分段、不清 blocker、不制造临床结论', () => {
    const currentSegment: ConversationSegment = {
      segmentId: 'segment-001',
      conversationId: 'conversation-001',
      sequenceNo: 1,
      state: 'awaiting_human',
      currentHandlerId: null,
      everHumanHandled: false,
      openedByCustomerMessageId: 'message-inbound-001',
      openedAt: '2026-07-17T01:00:00.000Z',
      stateChangedAt: '2026-07-17T01:00:00.000Z',
      closedAt: null,
      segmentCloseKind: 'open',
      resolutionState: 'open',
      resolvedAt: null,
      blockingReasonCodes: ['forced_close_unresolved'],
    };
    const before = structuredClone(currentSegment);
    const resolvedRisk = applied(resolveConversationRisk(confirmedHistory(), resolveInput));

    expect(currentSegment).toEqual(before);
    expect(resolvedRisk.history.every((event) => !('segmentState' in event))).toBe(true);
    expect(resolvedRisk.history.every((event) => !('clinicalConclusion' in event))).toBe(true);
    expect(resolvedRisk.history.every((event) => !('messageBody' in event))).toBe(true);
    expect(resolvedRisk.history.every((event) => !('externalAccount' in event))).toBe(true);
    expect(resolvedRisk.history.every((event) => !('providerPayload' in event))).toBe(true);
    expect(resolvedRisk.history.every((event) => !('credential' in event))).toBe(true);
  });

  it('成功和失败均不修改只读历史、命令或关闭引用输入', () => {
    const history = confirmedHistory();
    const command = {
      ...resolveInput,
      clinicalClosureVerification: { ...closureVerification },
    };
    const historyBefore = structuredClone(history);
    const commandBefore = structuredClone(command);

    expect(resolveConversationRisk(history, command).kind).toBe('applied');
    expect(history).toEqual(historyBefore);
    expect(command).toEqual(commandBefore);

    const revokedCommand = {
      ...command,
      clinicalClosureVerification: {
        ...closureVerification,
        revoked: true,
      },
    };
    const revokedBefore = structuredClone(revokedCommand);
    expect(resolveConversationRisk(history, revokedCommand)).toEqual({
      kind: 'blocked',
      code: 'clinical_closure_reference_revoked',
    });
    expect(history).toEqual(historyBefore);
    expect(revokedCommand).toEqual(revokedBefore);
  });

  it('完整历史可分别投影 unconfirmed、confirmed、resolved', () => {
    const unconfirmed = unconfirmedHistory();
    const confirmed = applied(confirmConversationRisk(unconfirmed, confirmInput)).history;
    const resolved = applied(resolveConversationRisk(confirmed, resolveInput)).history;

    expect(projection(unconfirmed).state).toBe('unconfirmed');
    expect(projection(confirmed).state).toBe('confirmed');
    expect(projection(resolved).state).toBe('resolved');
  });

  it('target-bound 完整集合稳定排序并保留 caller 声明 provenance', () => {
    const historyB = unconfirmedHistory({
      eventId: 'rke_bbbbbbbbbbbbbbb1',
      riskId: 'rsk_bbbbbbbbbbbbbbbb',
      ...compositionTarget,
      sourceMessageId: 'msg_bbbbbbbbbbbbbbbb',
    });
    const historyA = unconfirmedHistory({
      eventId: 'rke_aaaaaaaaaaaaaaa1',
      riskId: 'rsk_aaaaaaaaaaaaaaaa',
      ...compositionTarget,
      sourceMessageId: 'msg_aaaaaaaaaaaaaaaa',
    });

    expect(projectCompleteConversationRiskHistories(
      [historyB, historyA],
      compositionTarget,
      [],
      '2026-07-17T01:05:00.000Z',
    )).toEqual({
      kind: 'projected',
      projection: {
        ...compositionTarget,
        provenance: 'caller_declared_complete_histories',
        risks: [
          {
            riskId: 'rsk_aaaaaaaaaaaaaaaa',
            state: 'unconfirmed',
            riskDomain: 'clinical',
            clinicalClosureCheckState: 'not_applicable',
          },
          {
            riskId: 'rsk_bbbbbbbbbbbbbbbb',
            state: 'unconfirmed',
            riskDomain: 'clinical',
            clinicalClosureCheckState: 'not_applicable',
          },
        ],
      },
    });
  });

  it('单链投影对 sparse、Proxy 和 accessor 历史受控 fail-closed', () => {
    const sparse = new Array(1) as ConversationRiskHistory;
    const proxied = new Proxy(unconfirmedHistory(), {});
    const accessor = structuredClone(unconfirmedHistory()) as ConversationRiskHistory;
    let reads = 0;
    Object.defineProperty(accessor[0] as object, 'riskCode', {
      enumerable: true,
      configurable: true,
      get: () => {
        reads += 1;
        return 'clinical_alert';
      },
    });

    for (const history of [sparse, proxied, accessor]) {
      expect(() => projectConversationRisk(history)).not.toThrow();
      expect(projectConversationRisk(history)).toEqual({
        kind: 'blocked',
        code: 'invalid_risk_history',
      });
    }
    expect(reads).toBe(0);
  });
});
