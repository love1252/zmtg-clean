import { describe, expect, it } from 'vitest';
import {
  appendConversationMessageResult,
  conversationMessageChannelDeliveryStatuses,
  conversationMessageProviderAcceptanceStatuses,
  conversationMessageResultFailureCodes,
  conversationMessageResultStages,
  conversationMessageTransportStatuses,
  orderConversationMessageResults,
  projectConversationMessageResults,
  type ConversationMessageChannelDeliveryResult,
  type ConversationMessageProviderAcceptanceResult,
  type ConversationMessageResult,
  type ConversationMessageResultAppendResult,
  type ConversationMessageResultHistory,
  type ConversationMessageResultSubject,
  type ConversationMessageTransportResult,
} from '@/modules/institution-conversations/domain/conversation-message-results';

const baseTime = '2026-07-17T02:00:00.000Z';
const tenantId = 'tenant-001';
const institutionId = 'institution-001';

const subject = (
  direction: ConversationMessageResultSubject['direction'] = 'outbound',
  messageId = 'message-001',
  scope: Readonly<{ tenantId: string; institutionId: string }> = { tenantId, institutionId },
): ConversationMessageResultSubject => ({ ...scope, messageId, direction });

const projectionTarget = (
  messageId = 'message-001',
  scope: Readonly<{ tenantId: string; institutionId: string }> = { tenantId, institutionId },
) => ({ ...scope, messageId });

const transportResult = (
  overrides: Partial<ConversationMessageTransportResult> = {},
): ConversationMessageTransportResult => ({
  tenantId,
  institutionId,
  resultId: 'result-transport-001',
  messageId: 'message-001',
  stage: 'message_transport',
  status: 'outbound_created',
  occurredAt: baseTime,
  attemptNo: 1,
  dedupeKey: 'dedupe-transport-001',
  providerMessageRef: null,
  failureCode: null,
  channelReceiptReference: null,
  ...overrides,
});

const providerResult = (
  overrides: Partial<ConversationMessageProviderAcceptanceResult> = {},
): ConversationMessageProviderAcceptanceResult => ({
  tenantId,
  institutionId,
  resultId: 'result-provider-001',
  messageId: 'message-001',
  stage: 'provider_acceptance',
  status: 'provider_accepted',
  occurredAt: '2026-07-17T02:01:00.000Z',
  attemptNo: 1,
  dedupeKey: 'dedupe-provider-001',
  providerMessageRef: 'provider:message:ref_a000000000000001',
  failureCode: null,
  channelReceiptReference: null,
  ...overrides,
});

const channelResult = (
  overrides: Partial<ConversationMessageChannelDeliveryResult> = {},
): ConversationMessageChannelDeliveryResult => ({
  tenantId,
  institutionId,
  resultId: 'result-channel-001',
  messageId: 'message-001',
  stage: 'channel_delivery',
  status: 'channel_delivered',
  occurredAt: '2026-07-17T02:02:00.000Z',
  attemptNo: 1,
  dedupeKey: 'dedupe-channel-001',
  providerMessageRef: 'provider:message:ref_a000000000000001',
  failureCode: null,
  channelReceiptReference: {
    referenceId: 'channel:receipt:ref_a000000000000001',
    verificationState: 'authoritative',
    verifiedAt: '2026-07-17T02:01:30.000Z',
  },
  ...overrides,
});

const applied = (
  result: ConversationMessageResultAppendResult,
): Extract<ConversationMessageResultAppendResult, { kind: 'applied' }> => {
  expect(result.kind).toBe('applied');
  if (result.kind !== 'applied') {
    throw new Error(
      result.kind === 'blocked'
        ? `expected applied result, received ${result.code}`
        : 'expected applied result, received replayed result',
    );
  }
  return result;
};

const appendAll = (
  inputs: readonly ConversationMessageResult[],
  message: ConversationMessageResultSubject = subject(),
): ConversationMessageResultHistory => inputs.reduce<ConversationMessageResultHistory>(
  (history, input) => applied(appendConversationMessageResult(history, message, input)).history,
  [],
);

describe('conversation message result domain', () => {
  it('冻结三个独立 stage、各自 status 和受控 failure code', () => {
    expect(conversationMessageResultStages).toEqual([
      'message_transport',
      'provider_acceptance',
      'channel_delivery',
    ]);
    expect(conversationMessageTransportStatuses).toEqual([
      'inbound_received',
      'outbound_created',
      'outbound_submitted',
      'outbound_failed',
      'outbound_skipped',
      'outbound_unknown',
    ]);
    expect(conversationMessageProviderAcceptanceStatuses).toEqual([
      'provider_accepted',
      'provider_rejected',
      'provider_unknown',
    ]);
    expect(conversationMessageChannelDeliveryStatuses).toEqual([
      'delivery_not_reported',
      'channel_delivered',
      'channel_failed',
      'channel_unknown',
    ]);
    expect(conversationMessageResultFailureCodes).toEqual([
      'outbound_submission_failed',
      'outbound_submission_skipped',
      'outbound_submission_timeout',
      'outbound_submission_indeterminate',
      'provider_rejected',
      'provider_timeout',
      'provider_unavailable',
      'provider_indeterminate',
      'channel_failed',
      'channel_receipt_timeout',
      'channel_receipt_unavailable',
      'channel_receipt_indeterminate',
    ]);
    for (const values of [
      conversationMessageResultStages,
      conversationMessageTransportStatuses,
      conversationMessageProviderAcceptanceStatuses,
      conversationMessageChannelDeliveryStatuses,
      conversationMessageResultFailureCodes,
    ]) {
      expect(Object.isFrozen(values)).toBe(true);
    }
  });

  it.each([
    ['inbound_received', 'inbound', null],
    ['outbound_created', 'outbound', null],
    ['outbound_submitted', 'outbound', null],
    ['outbound_failed', 'outbound', 'outbound_submission_failed'],
    ['outbound_skipped', 'outbound', 'outbound_submission_skipped'],
    ['outbound_unknown', 'outbound', 'outbound_submission_timeout'],
  ] as const)('接受 message_transport 状态 %s 与对应消息方向', (status, direction, failureCode) => {
    const result = appendConversationMessageResult([], subject(direction), transportResult({
      status,
      failureCode,
    }));
    expect(result.kind).toBe('applied');
  });

  it.each([
    ['provider_accepted', null],
    ['provider_rejected', 'provider_rejected'],
    ['provider_unknown', 'provider_timeout'],
  ] as const)('接受 provider stage 状态 %s', (status, failureCode) => {
    expect(appendConversationMessageResult([], subject(), providerResult({
      status,
      failureCode,
    })).kind).toBe('applied');
  });

  it.each([
    ['delivery_not_reported', null, null],
    ['channel_delivered', null, channelResult().channelReceiptReference],
    ['channel_failed', 'channel_failed', channelResult().channelReceiptReference],
    ['channel_unknown', 'channel_receipt_timeout', null],
  ] as const)('接受 channel stage 状态 %s', (status, failureCode, channelReceiptReference) => {
    expect(appendConversationMessageResult([], subject(), channelResult({
      status,
      failureCode,
      channelReceiptReference,
    })).kind).toBe('applied');
  });

  it('stage 与 status 必须精确配对', () => {
    const mismatched = {
      ...transportResult(),
      stage: 'provider_acceptance',
    } as unknown as ConversationMessageResult;
    expect(appendConversationMessageResult([], subject(), mismatched)).toEqual({
      kind: 'blocked',
      code: 'stage_status_mismatch',
    });
  });

  it.each([
    [subject('inbound'), providerResult()],
    [subject('inbound'), channelResult()],
    [subject('outbound'), transportResult({ status: 'inbound_received' })],
    [subject('system'), transportResult()],
    [subject('system'), providerResult()],
  ])('消息方向守卫拒绝不适用的结果事实', (message, input) => {
    expect(appendConversationMessageResult([], message, input)).toEqual({
      kind: 'blocked',
      code: 'message_direction_mismatch',
    });
  });

  it('结果必须绑定传入消息', () => {
    expect(appendConversationMessageResult([], subject('outbound', 'message-other'), transportResult())).toEqual({
      kind: 'blocked',
      code: 'message_id_mismatch',
    });
  });

  it.each([
    [{ tenantId: 'tenant-002', institutionId }, { tenantId, institutionId }],
    [{ tenantId, institutionId: 'institution-002' }, { tenantId, institutionId }],
  ])('结果必须绑定消息的同一 tenantId + institutionId scope', (resultScope, messageScope) => {
    expect(appendConversationMessageResult(
      [],
      subject('outbound', 'message-001', messageScope),
      providerResult(resultScope),
    )).toEqual({ kind: 'blocked', code: 'scope_mismatch' });
  });

  it('跨机构同名 messageId/resultId/dedupeKey 不得复用、关联或投影', () => {
    const otherScope = { tenantId, institutionId: 'institution-002' } as const;
    const otherInstitutionFact = providerResult(otherScope);

    expect(appendConversationMessageResult(
      [otherInstitutionFact],
      subject(),
      providerResult(),
    )).toEqual({ kind: 'blocked', code: 'scope_mismatch' });
    expect(projectConversationMessageResults(projectionTarget(), [otherInstitutionFact])).toEqual({
      kind: 'blocked',
      code: 'scope_mismatch',
    });
    expect(orderConversationMessageResults([
      providerResult(),
      providerResult({
        ...otherScope,
        resultId: 'result-provider-002',
        dedupeKey: 'dedupe-provider-002',
      }),
    ])).toEqual({ kind: 'blocked', code: 'scope_mismatch' });
  });

  it('非法 tenantId 或 institutionId 被受控阻断', () => {
    expect(appendConversationMessageResult(
      [],
      subject(),
      transportResult({ tenantId: 'tenant id' }),
    )).toEqual({ kind: 'blocked', code: 'invalid_identifier' });
    expect(projectConversationMessageResults(
      projectionTarget('message-001', { tenantId, institutionId: 'institution/id' }),
      [],
    )).toEqual({ kind: 'blocked', code: 'invalid_identifier' });
  });

  it.each([
    transportResult({ status: 'outbound_failed', failureCode: null }),
    transportResult({ status: 'outbound_created', failureCode: 'outbound_submission_failed' }),
    providerResult({ status: 'provider_rejected', failureCode: null }),
    providerResult({ status: 'provider_accepted', failureCode: 'provider_timeout' }),
    channelResult({ status: 'channel_unknown', failureCode: null, channelReceiptReference: null }),
    channelResult({ status: 'channel_delivered', failureCode: 'channel_failed' }),
  ])('failureCode 必须与 status 精确映射', (input) => {
    expect(appendConversationMessageResult([], subject(), input)).toEqual({
      kind: 'blocked',
      code: 'failure_code_mismatch',
    });
  });

  it('拒绝任意 provider failure 原文', () => {
    expect(appendConversationMessageResult([], subject(), {
      ...providerResult({ status: 'provider_unknown' }),
      failureCode: 'raw_provider_timeout_stack',
    } as unknown as ConversationMessageResult)).toEqual({
      kind: 'blocked',
      code: 'failure_code_mismatch',
    });
  });

  it.each([
    '2026-07-17T02:00:00',
    '2026-07-17T02:00:00.000',
    '2026-07-17',
    '2026-02-30T02:00:00.000Z',
  ])('结果时间只接受 canonical UTC 毫秒格式：%s', (occurredAt) => {
    expect(appendConversationMessageResult([], subject(), transportResult({ occurredAt }))).toEqual({
      kind: 'blocked',
      code: 'invalid_timestamp',
    });
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    'attemptNo 只接受安全正整数：%s',
    (attemptNo) => {
      expect(appendConversationMessageResult([], subject(), transportResult({ attemptNo }))).toEqual({
        kind: 'blocked',
        code: 'invalid_attempt_no',
      });
    },
  );

  it.each(['', 'dedupe key', 'dedupe/key', '去重键', `d${'a'.repeat(128)}`])(
    'dedupeKey 拒绝空值、不安全字符和超长值：%s',
    (dedupeKey) => {
      expect(appendConversationMessageResult([], subject(), transportResult({ dedupeKey }))).toEqual({
        kind: 'blocked',
        code: 'invalid_dedupe_key',
      });
    },
  );

  it('结果及 provider 引用只接受安全标识', () => {
    expect(appendConversationMessageResult([], subject(), transportResult({ resultId: 'bad id' }))).toEqual({
      kind: 'blocked',
      code: 'invalid_identifier',
    });
    for (const providerMessageRef of [
      'provider/raw/ref',
      'credential:provider-message',
      'provider-access_token-001',
      '138-0013-8000',
      'customer@example.invalid',
      'diagnosis-cancer',
      'provider:message:ref_1380013800000000',
    ]) {
      expect(appendConversationMessageResult([], subject(), providerResult({
        providerMessageRef,
      }))).toEqual({ kind: 'blocked', code: 'invalid_safe_reference' });
    }
    expect(appendConversationMessageResult([], subject(), transportResult({
      providerMessageRef: 'provider-ref-001',
    }))).toEqual({ kind: 'blocked', code: 'invalid_safe_reference' });
  });

  it('exact own keys 阻断夹带 provider payload', () => {
    const withPayload = {
      ...transportResult(),
      providerPayload: { raw: true },
    } as unknown as ConversationMessageResult;
    expect(appendConversationMessageResult([], subject(), withPayload)).toEqual({
      kind: 'blocked',
      code: 'invalid_result_shape',
    });
  });

  it.each(['channel_delivered', 'channel_failed'] as const)(
    '%s 必须携带可重放验证的权威渠道引用',
    (status) => {
      expect(appendConversationMessageResult([], subject(), channelResult({
        status,
        failureCode: status === 'channel_failed' ? 'channel_failed' : null,
        channelReceiptReference: null,
      }))).toEqual({
        kind: 'blocked',
        code: 'authoritative_channel_receipt_required',
      });
    },
  );

  it.each([
    {
      referenceId: 'channel:receipt:ref_a000000000000001',
      verificationState: 'unverified',
      verifiedAt: '2026-07-17T02:01:30.000Z',
    },
    {
      referenceId: 'channel receipt 001',
      verificationState: 'authoritative',
      verifiedAt: '2026-07-17T02:01:30.000Z',
    },
    {
      referenceId: 'channel:receipt:ref_a000000000000001',
      verificationState: 'authoritative',
      verifiedAt: '2026-07-17T02:01:30.000',
    },
    {
      referenceId: 'channel:receipt:ref_a000000000000001',
      verificationState: 'authoritative',
      verifiedAt: '2026-07-17T02:02:00.001Z',
    },
    {
      referenceId: 'channel:receipt:ref_a000000000000001',
      verificationState: 'authoritative',
      verifiedAt: '2026-07-17T02:01:30.000Z',
      rawReceipt: true,
    },
    {
      referenceId: 'payload:channel-receipt',
      verificationState: 'authoritative',
      verifiedAt: '2026-07-17T02:01:30.000Z',
    },
    ...[
      '138-0013-8000',
      'customer@example.invalid',
      'diagnosis-cancer',
      'channel:receipt:ref_1380013800000000',
    ].map((referenceId) => ({
      referenceId,
      verificationState: 'authoritative',
      verifiedAt: '2026-07-17T02:01:30.000Z',
    })),
  ])('权威渠道引用 shape、标识、时间和验证状态 fail-closed', (channelReceiptReference) => {
    expect(appendConversationMessageResult([], subject(), channelResult({
      channelReceiptReference: channelReceiptReference as never,
    }))).toEqual({ kind: 'blocked', code: 'channel_receipt_invalid' });
  });

  it.each(['delivery_not_reported', 'channel_unknown'] as const)(
    '%s 不得携带权威回执并伪装确定送达',
    (status) => {
      expect(appendConversationMessageResult([], subject(), channelResult({
        status,
        failureCode: status === 'channel_unknown' ? 'channel_receipt_timeout' : null,
      }))).toEqual({ kind: 'blocked', code: 'channel_receipt_not_allowed' });
    },
  );

  it('provider 与 transport stage 不得夹带渠道回执', () => {
    expect(appendConversationMessageResult([], subject(), {
      ...providerResult(),
      channelReceiptReference: channelResult().channelReceiptReference,
    } as unknown as ConversationMessageResult)).toEqual({
      kind: 'blocked',
      code: 'channel_receipt_not_allowed',
    });
  });

  it('同 dedupeKey 同完整事实语义复用并返回冻结副本', () => {
    const first = applied(appendConversationMessageResult([], subject(), providerResult()));
    const before = structuredClone(first.history);
    const replay = appendConversationMessageResult(first.history, subject(), providerResult());
    expect(replay.kind).toBe('replayed');
    if (replay.kind !== 'replayed') {
      throw new Error('expected replayed result');
    }
    expect(replay.history).toEqual(first.history);
    expect(replay.result).toEqual(first.result);
    expect(replay.history).not.toBe(first.history);
    expect(replay.result).not.toBe(first.result);
    expect(Object.isFrozen(replay.history)).toBe(true);
    expect(Object.isFrozen(replay.result)).toBe(true);
    expect(first.history).toEqual(before);
  });

  it('同 dedupeKey 任一完整事实不同均 fail-closed', () => {
    const original = providerResult();
    const history = applied(appendConversationMessageResult([], subject(), original)).history;
    const changes: readonly ConversationMessageProviderAcceptanceResult[] = [
      providerResult({ resultId: 'result-provider-other' }),
      providerResult({ messageId: 'message-other' }),
      providerResult({ status: 'provider_unknown', failureCode: 'provider_timeout' }),
      providerResult({ occurredAt: '2026-07-17T02:01:01.000Z' }),
      providerResult({ attemptNo: 2 }),
      providerResult({ providerMessageRef: 'provider:message:ref_a000000000000002' }),
    ];
    for (const changed of changes) {
      const changedSubject = subject('outbound', changed.messageId);
      expect(appendConversationMessageResult(history, changedSubject, changed)).toEqual({
        kind: 'blocked',
        code: 'idempotency_conflict',
      });
    }
  });

  it('相同 resultId 使用不同 dedupeKey 时冲突', () => {
    const history = applied(appendConversationMessageResult([], subject(), providerResult())).history;
    expect(appendConversationMessageResult(history, subject(), providerResult({
      dedupeKey: 'dedupe-provider-other',
    }))).toEqual({ kind: 'blocked', code: 'result_id_conflict' });
  });

  it('同一 scope 的 provider/channel 权威引用不得绑定两个不同 messageId', () => {
    const providerHistory = applied(appendConversationMessageResult(
      [],
      subject(),
      providerResult(),
    )).history;
    expect(appendConversationMessageResult(
      providerHistory,
      subject('outbound', 'message-002'),
      providerResult({
        resultId: 'result-provider-002',
        messageId: 'message-002',
        dedupeKey: 'dedupe-provider-002',
      }),
    )).toEqual({ kind: 'blocked', code: 'reference_message_conflict' });

    const channelHistory = applied(appendConversationMessageResult(
      [],
      subject(),
      channelResult({ providerMessageRef: null }),
    )).history;
    expect(appendConversationMessageResult(
      channelHistory,
      subject('outbound', 'message-002'),
      channelResult({
        resultId: 'result-channel-002',
        messageId: 'message-002',
        dedupeKey: 'dedupe-channel-002',
        providerMessageRef: null,
      }),
    )).toEqual({ kind: 'blocked', code: 'reference_message_conflict' });
  });

  it('已存历史的跨消息引用冲突在 append/order/project 前 fail-closed', () => {
    const conflictingHistory = [
      providerResult(),
      providerResult({
        resultId: 'result-provider-002',
        messageId: 'message-002',
        dedupeKey: 'dedupe-provider-002',
      }),
    ];
    expect(appendConversationMessageResult(
      conflictingHistory,
      subject(),
      transportResult(),
    )).toEqual({ kind: 'blocked', code: 'reference_message_conflict' });
    expect(orderConversationMessageResults(conflictingHistory)).toEqual({
      kind: 'blocked',
      code: 'reference_message_conflict',
    });
    expect(projectConversationMessageResults(projectionTarget(), conflictingHistory)).toEqual({
      kind: 'blocked',
      code: 'reference_message_conflict',
    });
  });

  it('同一 messageId 允许多个追加事实复用同一 provider 引用', () => {
    const history = applied(appendConversationMessageResult([], subject(), providerResult())).history;
    expect(appendConversationMessageResult(history, subject(), providerResult({
      resultId: 'result-provider-002',
      status: 'provider_unknown',
      occurredAt: '2026-07-17T02:01:01.000Z',
      dedupeKey: 'dedupe-provider-002',
      failureCode: 'provider_timeout',
    })).kind).toBe('applied');
  });

  it('非法既有 history 在任何追加、排序或投影前 fail-closed', () => {
    const first = providerResult();
    const duplicateDedupe = providerResult({
      resultId: 'result-provider-002',
    });
    const invalidHistory = [first, duplicateDedupe];
    expect(appendConversationMessageResult(invalidHistory, subject(), transportResult())).toEqual({
      kind: 'blocked',
      code: 'invalid_result_history',
    });
    expect(orderConversationMessageResults(invalidHistory)).toEqual({
      kind: 'blocked',
      code: 'invalid_result_history',
    });
    expect(projectConversationMessageResults(projectionTarget(), invalidHistory)).toEqual({
      kind: 'blocked',
      code: 'invalid_result_history',
    });
    expect(appendConversationMessageResult('not-an-array', subject(), transportResult())).toEqual({
      kind: 'blocked',
      code: 'invalid_result_history',
    });
    expect(orderConversationMessageResults('not-an-array')).toEqual({
      kind: 'blocked',
      code: 'invalid_result_history',
    });
    expect(projectConversationMessageResults(projectionTarget(), 'not-an-array')).toEqual({
      kind: 'blocked',
      code: 'invalid_result_history',
    });
    expect(appendConversationMessageResult([{
      ...providerResult(),
      providerPayload: 'forbidden-fixture',
    }], subject(), transportResult())).toEqual({
      kind: 'blocked',
      code: 'invalid_result_history',
    });
  });

  it('既有结果与当前消息方向冲突时历史 fail-closed', () => {
    expect(appendConversationMessageResult(
      [providerResult()],
      subject('inbound'),
      transportResult({ status: 'inbound_received' }),
    )).toEqual({ kind: 'blocked', code: 'invalid_result_history' });
  });

  it('同一 attempt 可追加不同 stage 和后续事实，不覆盖旧结果', () => {
    const inputs: readonly ConversationMessageResult[] = [
      transportResult({ status: 'outbound_submitted' }),
      providerResult({
        status: 'provider_unknown',
        failureCode: 'provider_timeout',
      }),
      providerResult({
        resultId: 'result-provider-002',
        status: 'provider_accepted',
        occurredAt: '2026-07-17T02:01:30.000Z',
        dedupeKey: 'dedupe-provider-002',
        failureCode: null,
      }),
    ];
    const history = appendAll(inputs);
    expect(history).toHaveLength(3);
    expect(history.map((result) => result.status)).toEqual([
      'outbound_submitted',
      'provider_unknown',
      'provider_accepted',
    ]);
    expect(projectConversationMessageResults(projectionTarget(), history)).toEqual({
      kind: 'projected',
      projection: {
        tenantId,
        institutionId,
        messageId: 'message-001',
        latestAttempt: {
          attemptNo: 1,
          transport: 'outbound_submitted',
          provider: 'provider_accepted',
          channel: 'delivery_not_reported',
        },
        authoritativeChannelDelivery: null,
      },
    });
  });

  it('provider_accepted 绝不推导 channel_delivered', () => {
    const history = appendAll([providerResult()]);
    expect(projectConversationMessageResults(projectionTarget(), history)).toEqual({
      kind: 'projected',
      projection: {
        tenantId,
        institutionId,
        messageId: 'message-001',
        latestAttempt: {
          attemptNo: 1,
          transport: null,
          provider: 'provider_accepted',
          channel: 'delivery_not_reported',
        },
        authoritativeChannelDelivery: null,
      },
    });
    expect(history.some((result) => result.status === 'channel_delivered')).toBe(false);
  });

  it('latest attempt 保持独立无回执状态，同时保留旧 attempt 权威送达事实', () => {
    const history = appendAll([
      channelResult(),
      transportResult({
        resultId: 'result-transport-002',
        status: 'outbound_submitted',
        occurredAt: '2026-07-17T02:03:00.000Z',
        attemptNo: 2,
        dedupeKey: 'dedupe-transport-002',
      }),
      providerResult({
        resultId: 'result-provider-002',
        occurredAt: '2026-07-17T02:04:00.000Z',
        attemptNo: 2,
        dedupeKey: 'dedupe-provider-002',
      }),
    ]);
    expect(projectConversationMessageResults(projectionTarget(), history)).toMatchObject({
      kind: 'projected',
      projection: {
        latestAttempt: {
          attemptNo: 2,
          transport: 'outbound_submitted',
          provider: 'provider_accepted',
          channel: 'delivery_not_reported',
        },
        authoritativeChannelDelivery: {
          status: 'channel_delivered',
          attemptNo: 1,
        },
      },
    });
  });

  it('超时与重试只追加 attempt 事实，不伪造渠道送达', () => {
    const history = appendAll([
      providerResult({ status: 'provider_unknown', failureCode: 'provider_timeout' }),
      transportResult({
        resultId: 'result-transport-002',
        status: 'outbound_submitted',
        occurredAt: '2026-07-17T02:02:00.000Z',
        attemptNo: 2,
        dedupeKey: 'dedupe-transport-002',
      }),
      providerResult({
        resultId: 'result-provider-002',
        occurredAt: '2026-07-17T02:03:00.000Z',
        attemptNo: 2,
        dedupeKey: 'dedupe-provider-002',
      }),
    ]);
    const projection = projectConversationMessageResults(projectionTarget(), history);
    expect(projection).toMatchObject({
      kind: 'projected',
      projection: {
        latestAttempt: {
          attemptNo: 2,
          channel: 'delivery_not_reported',
        },
      },
    });
    expect(history.some((result) => result.status === 'channel_delivered')).toBe(false);
  });

  it('channel_unknown 可由后续同 attempt 权威回执追加为 delivered', () => {
    const history = appendAll([
      channelResult({
        status: 'channel_unknown',
        failureCode: 'channel_receipt_timeout',
        channelReceiptReference: null,
      }),
      channelResult({
        resultId: 'result-channel-002',
        occurredAt: '2026-07-17T02:03:00.000Z',
        dedupeKey: 'dedupe-channel-002',
        channelReceiptReference: {
          referenceId: 'channel:receipt:ref_a000000000000002',
          verificationState: 'authoritative',
          verifiedAt: '2026-07-17T02:02:30.000Z',
        },
      }),
    ]);
    expect(projectConversationMessageResults(projectionTarget(), history)).toMatchObject({
      kind: 'projected',
      projection: {
        latestAttempt: { channel: 'channel_delivered' },
        authoritativeChannelDelivery: {
          status: 'channel_delivered',
          attemptNo: 1,
          occurredAt: '2026-07-17T02:03:00.000Z',
        },
      },
    });
  });

  it.each([
    ['channel_unknown', 'channel_receipt_timeout', null],
    ['channel_failed', 'channel_failed', channelResult().channelReceiptReference],
  ] as const)('同 attempt 权威 delivered 后迟到 %s 不降级消息级送达事实', (
    status,
    failureCode,
    channelReceiptReference,
  ) => {
    const history = appendAll([
      channelResult(),
      channelResult({
        resultId: 'result-channel-late',
        status,
        occurredAt: '2026-07-17T02:05:00.000Z',
        dedupeKey: 'dedupe-channel-late',
        failureCode,
        channelReceiptReference,
      }),
    ]);
    expect(projectConversationMessageResults(projectionTarget(), history)).toMatchObject({
      kind: 'projected',
      projection: {
        latestAttempt: { attemptNo: 1, channel: status },
        authoritativeChannelDelivery: {
          status: 'channel_delivered',
          attemptNo: 1,
          occurredAt: '2026-07-17T02:02:00.000Z',
        },
      },
    });
  });

  it('新 attempt 的 unknown 保持最新 attempt 语义但不清除消息级权威送达', () => {
    const history = appendAll([
      channelResult(),
      channelResult({
        resultId: 'result-channel-002',
        status: 'channel_unknown',
        occurredAt: '2026-07-17T02:06:00.000Z',
        attemptNo: 2,
        dedupeKey: 'dedupe-channel-002',
        failureCode: 'channel_receipt_timeout',
        channelReceiptReference: null,
      }),
    ]);
    expect(projectConversationMessageResults(projectionTarget(), history)).toMatchObject({
      kind: 'projected',
      projection: {
        latestAttempt: { attemptNo: 2, channel: 'channel_unknown' },
        authoritativeChannelDelivery: {
          status: 'channel_delivered',
          attemptNo: 1,
        },
      },
    });
  });

  it('乱序较早 unknown 与重复权威回执均不覆盖 delivered', () => {
    const delivered = channelResult();
    const first = applied(appendConversationMessageResult([], subject(), delivered));
    const replay = appendConversationMessageResult(first.history, subject(), delivered);
    expect(replay.kind).toBe('replayed');

    const history = applied(appendConversationMessageResult(
      replay.kind === 'replayed' ? replay.history : first.history,
      subject(),
      channelResult({
        resultId: 'result-channel-earlier-unknown',
        status: 'channel_unknown',
        occurredAt: '2026-07-17T02:01:00.000Z',
        dedupeKey: 'dedupe-channel-earlier-unknown',
        failureCode: 'channel_receipt_indeterminate',
        channelReceiptReference: null,
      }),
    )).history;
    expect(projectConversationMessageResults(projectionTarget(), history)).toMatchObject({
      kind: 'projected',
      projection: {
        latestAttempt: { channel: 'channel_delivered' },
        authoritativeChannelDelivery: {
          status: 'channel_delivered',
          attemptNo: 1,
        },
      },
    });
  });

  it('稳定排序复制后按 occurredAt → attemptNo → stage rank → resultId', () => {
    const results: ConversationMessageResult[] = [
      channelResult({
        resultId: 'result-c',
        occurredAt: '2026-07-17T02:04:00.000Z',
        dedupeKey: 'dedupe-c',
        channelReceiptReference: {
          referenceId: 'channel:receipt:ref_a00000000000000c',
          verificationState: 'authoritative',
          verifiedAt: '2026-07-17T02:03:00.000Z',
        },
      }),
      providerResult({
        resultId: 'result-b',
        occurredAt: '2026-07-17T02:04:00.000Z',
        dedupeKey: 'dedupe-b',
      }),
      transportResult({
        resultId: 'result-d',
        status: 'outbound_submitted',
        occurredAt: '2026-07-17T02:04:00.000Z',
        dedupeKey: 'dedupe-d',
      }),
      transportResult({
        resultId: 'result-a',
        status: 'outbound_submitted',
        occurredAt: '2026-07-17T02:03:00.000Z',
        attemptNo: 2,
        dedupeKey: 'dedupe-a',
      }),
    ];
    const reversed = [...results].reverse();
    const before = structuredClone(results);
    const first = orderConversationMessageResults(results);
    const second = orderConversationMessageResults(reversed);
    expect(first.kind).toBe('ordered');
    expect(second.kind).toBe('ordered');
    if (first.kind !== 'ordered' || second.kind !== 'ordered') {
      throw new Error('expected ordered results');
    }
    expect(first.results.map((result) => result.resultId)).toEqual([
      'result-a',
      'result-d',
      'result-b',
      'result-c',
    ]);
    expect(second.results).toEqual(first.results);
    expect(results).toEqual(before);
    expect(first.results).not.toBe(results);
    expect(Object.isFrozen(first.results)).toBe(true);
    expect(first.results.every(Object.isFrozen)).toBe(true);
  });

  it('追加成功不修改输入，并复制嵌套渠道引用', () => {
    const history = [transportResult()];
    const input = channelResult();
    const historyBefore = structuredClone(history);
    const inputBefore = structuredClone(input);
    const result = applied(appendConversationMessageResult(history, subject(), input));
    expect(history).toEqual(historyBefore);
    expect(input).toEqual(inputBefore);
    expect(result.history).not.toBe(history);
    expect(result.result).not.toBe(input);
    expect(result.result.channelReceiptReference).not.toBe(input.channelReceiptReference);
    expect(Object.isFrozen(history)).toBe(false);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.channelReceiptReference)).toBe(false);
    expect(Object.isFrozen(result.history)).toBe(true);
    expect(result.history.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(result.result)).toBe(true);
    expect(Object.isFrozen(result.result.channelReceiptReference)).toBe(true);
  });

  it('投影与嵌套权威回执均冻结', () => {
    const projected = projectConversationMessageResults(
      projectionTarget(),
      appendAll([channelResult()]),
    );
    expect(projected.kind).toBe('projected');
    if (projected.kind !== 'projected') {
      throw new Error('expected projected result');
    }
    expect(Object.isFrozen(projected)).toBe(true);
    expect(Object.isFrozen(projected.projection)).toBe(true);
    expect(Object.isFrozen(projected.projection.latestAttempt)).toBe(true);
    expect(Object.isFrozen(projected.projection.authoritativeChannelDelivery)).toBe(true);
    expect(Object.isFrozen(
      projected.projection.authoritativeChannelDelivery?.channelReceiptReference,
    )).toBe(true);
  });

  it('投影按 messageId 隔离，空消息仍明确 delivery_not_reported', () => {
    const first = applied(appendConversationMessageResult([], subject(), providerResult())).history;
    const history = applied(appendConversationMessageResult(
      first,
      subject('outbound', 'message-other'),
      providerResult({
        resultId: 'result-provider-other',
        messageId: 'message-other',
        attemptNo: 5,
        dedupeKey: 'dedupe-provider-other',
        providerMessageRef: 'provider:message:ref_a000000000000009',
      }),
    )).history;
    expect(projectConversationMessageResults(projectionTarget(), history)).toMatchObject({
      kind: 'projected',
      projection: { latestAttempt: { attemptNo: 1, provider: 'provider_accepted' } },
    });
    expect(projectConversationMessageResults(projectionTarget('message-empty'), history)).toEqual({
      kind: 'projected',
      projection: {
        tenantId,
        institutionId,
        messageId: 'message-empty',
        latestAttempt: null,
        authoritativeChannelDelivery: null,
      },
    });
  });

  it('结果域不包含客户回复、业务完成、总状态或 provider payload', () => {
    const result = applied(appendConversationMessageResult([], subject(), channelResult())).result;
    expect(Object.keys(result).sort()).toEqual([
      'attemptNo',
      'channelReceiptReference',
      'dedupeKey',
      'failureCode',
      'institutionId',
      'messageId',
      'occurredAt',
      'providerMessageRef',
      'resultId',
      'stage',
      'status',
      'tenantId',
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /replied|completed|business|totalStatus|providerPayload|requestBody|responseBody|credential|token/iu,
    );
  });

  it('非法投影 messageId 被受控阻断', () => {
    const projected = projectConversationMessageResults(projectionTarget('message id'), []);
    expect(projected).toEqual({
      kind: 'blocked',
      code: 'invalid_identifier',
    });
    expect(Object.isFrozen(projected)).toBe(true);

    const appended = appendConversationMessageResult(
      [],
      subject('outbound', 'message-other'),
      providerResult(),
    );
    expect(appended).toEqual({ kind: 'blocked', code: 'message_id_mismatch' });
    expect(Object.isFrozen(appended)).toBe(true);

    const ordered = orderConversationMessageResults([{
      ...providerResult(),
      providerPayload: 'forbidden-fixture',
    }]);
    expect(ordered).toEqual({ kind: 'blocked', code: 'invalid_result_history' });
    expect(Object.isFrozen(ordered)).toBe(true);
  });
});
