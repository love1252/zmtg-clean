import { describe, expect, it } from 'vitest';
import {
  appendConversationMessage,
  appendConversationMessageReplyLink,
  conversationMessageDirections,
  conversationMessageReplyLinkBases,
  conversationMessageSafeSummaryTexts,
  conversationMessageSenderKinds,
  sortConversationMessages,
  type ConversationMessage,
  type ConversationMessageReplyLink,
} from '@/modules/institution-conversations/domain/conversation-messages';

const baseOccurredAt = '2026-07-17T02:00:00.000Z';
const baseReceivedAt = '2026-07-17T02:00:01.000Z';
const tenantId = 'tenant-001';
const institutionId = 'institution-001';

const customerMessageSummary = {
  code: 'customer_message_received',
  text: conversationMessageSafeSummaryTexts.customer_message_received,
} as const;
const humanMessageSummary = {
  code: 'human_message_recorded',
  text: conversationMessageSafeSummaryTexts.human_message_recorded,
} as const;
const aiMessageSummary = {
  code: 'ai_message_recorded',
  text: conversationMessageSafeSummaryTexts.ai_message_recorded,
} as const;
const systemMessageSummary = {
  code: 'system_event_recorded',
  text: conversationMessageSafeSummaryTexts.system_event_recorded,
} as const;

const inboundMessage = (
  overrides: Partial<Extract<ConversationMessage, { direction: 'inbound' }>> = {},
): Extract<ConversationMessage, { direction: 'inbound' }> => ({
  tenantId,
  institutionId,
  messageId: 'message-in-001',
  conversationId: 'conversation-001',
  segmentId: 'segment-001',
  direction: 'inbound',
  senderKind: 'customer',
  occurredAt: baseOccurredAt,
  receivedAt: baseReceivedAt,
  authorizedContentReference: 'content:authorized:ref_a000000000000001',
  safeSummary: customerMessageSummary,
  sourceMessageRef: 'source:message:ref_a000000000000001',
  idempotencyKey: 'inbound_message_0001',
  ...overrides,
});

const outboundMessage = (
  overrides: Partial<Extract<ConversationMessage, { direction: 'outbound' }>> = {},
): Extract<ConversationMessage, { direction: 'outbound' }> => {
  const senderKind = overrides.senderKind ?? 'human';
  return {
    tenantId,
    institutionId,
    messageId: 'message-out-001',
    conversationId: 'conversation-001',
    segmentId: 'segment-001',
    direction: 'outbound',
    senderKind,
    occurredAt: '2026-07-17T02:01:00.000Z',
    receivedAt: '2026-07-17T02:01:00.000Z',
    authorizedContentReference: 'content:authorized:ref_a000000000000002',
    safeSummary: senderKind === 'ai' ? aiMessageSummary : humanMessageSummary,
    sourceMessageRef: null,
    idempotencyKey: null,
    ...overrides,
  };
};

const systemMessage = (
  overrides: Partial<Extract<ConversationMessage, { direction: 'system' }>> = {},
): Extract<ConversationMessage, { direction: 'system' }> => ({
  tenantId,
  institutionId,
  messageId: 'message-system-001',
  conversationId: 'conversation-001',
  segmentId: 'segment-001',
  direction: 'system',
  senderKind: 'system',
  occurredAt: '2026-07-17T02:02:00.000Z',
  receivedAt: '2026-07-17T02:02:00.000Z',
  authorizedContentReference: 'content:authorized:ref_a000000000000003',
  safeSummary: systemMessageSummary,
  sourceMessageRef: null,
  idempotencyKey: null,
  ...overrides,
});

const createdMessage = (input: ConversationMessage): ConversationMessage => {
  const result = appendConversationMessage([], input);
  if (result.kind !== 'created') throw new Error(`expected created, received ${result.kind}`);
  return result.message;
};

describe('conversation message domain', () => {
  it('创建 inbound、human/AI outbound 和 system 四种合法组合', () => {
    expect(Object.isFrozen(conversationMessageDirections)).toBe(true);
    expect(Object.isFrozen(conversationMessageSenderKinds)).toBe(true);
    expect(Object.isFrozen(conversationMessageReplyLinkBases)).toBe(true);
    for (const message of [
      inboundMessage(),
      outboundMessage(),
      outboundMessage({ messageId: 'message-out-ai', senderKind: 'ai' }),
      systemMessage(),
    ]) {
      const result = appendConversationMessage([], message);
      expect(result).toMatchObject({ kind: 'created', message });
      if (result.kind !== 'created') continue;
      expect(Object.isFrozen(result)).toBe(true);
      expect(result.history).toEqual([message]);
      expect(Object.isFrozen(result.message)).toBe(true);
      expect(Object.isFrozen(result.history)).toBe(true);
      if (result.message.safeSummary !== null) {
        expect(Object.isFrozen(result.message.safeSummary)).toBe(true);
        expect(result.message.safeSummary).not.toBe(message.safeSummary);
      }
    }
  });

  it('允许固定摘要投影或 null，且 code 必须匹配方向和 senderKind', () => {
    expect(Object.isFrozen(conversationMessageSafeSummaryTexts)).toBe(true);
    expect(appendConversationMessage([], inboundMessage({ safeSummary: null })).kind).toBe('created');
    expect(appendConversationMessage([], {
      ...inboundMessage(),
      safeSummary: humanMessageSummary,
    })).toEqual({ kind: 'blocked', code: 'invalid_safe_summary' });
    expect(appendConversationMessage([], {
      ...outboundMessage({ senderKind: 'ai' }),
      safeSummary: humanMessageSummary,
    })).toEqual({ kind: 'blocked', code: 'invalid_safe_summary' });
  });

  it('outbound 固定摘要只声明消息事实已记录，不声明发送或送达', () => {
    expect(conversationMessageSafeSummaryTexts.human_message_recorded).toBe('人工消息已记录。');
    expect(conversationMessageSafeSummaryTexts.ai_message_recorded).toBe('AI 消息已记录。');
    expect(JSON.stringify([
      conversationMessageSafeSummaryTexts.human_message_recorded,
      conversationMessageSafeSummaryTexts.ai_message_recorded,
    ])).not.toMatch(/发送|送达/u);
  });

  it.each([
    { direction: 'inbound', senderKind: 'human' },
    { direction: 'inbound', senderKind: 'system' },
    { direction: 'outbound', senderKind: 'customer' },
    { direction: 'outbound', senderKind: 'system' },
    { direction: 'system', senderKind: 'customer' },
    { direction: 'system', senderKind: 'ai' },
  ])('拒绝不匹配的方向和 senderKind：$direction/$senderKind', ({ direction, senderKind }) => {
    expect(appendConversationMessage([], {
      ...inboundMessage(),
      direction,
      senderKind,
      sourceMessageRef: direction === 'inbound'
        ? 'source:message:ref_a000000000000001'
        : null,
      idempotencyKey: direction === 'inbound' ? 'inbound_message_0001' : null,
    })).toEqual({ kind: 'blocked', code: 'sender_direction_mismatch' });
  });

  it('区分非法 direction 与非法 senderKind', () => {
    expect(appendConversationMessage([], {
      ...inboundMessage(),
      direction: 'incoming',
    })).toEqual({ kind: 'blocked', code: 'invalid_direction' });
    expect(appendConversationMessage([], {
      ...inboundMessage(),
      senderKind: 'operator',
    })).toEqual({ kind: 'blocked', code: 'invalid_sender_kind' });
  });

  it.each(['tenantId', 'institutionId', 'messageId', 'conversationId', 'segmentId'] as const)(
    '拒绝非法对象标识 %s',
    (field) => {
      expect(appendConversationMessage([], {
        ...inboundMessage(),
        [field]: 'bad id',
      })).toEqual({ kind: 'blocked', code: 'invalid_identifier' });
    },
  );

  it('拒绝非法授权内容引用', () => {
    for (const authorizedContentReference of [
      'https://example.invalid/content',
      'credential:message-content',
      '138-0013-8000',
      'diagnosis-cancer',
      'content:authorized:ref_1380013800000000',
    ]) {
      expect(appendConversationMessage([], inboundMessage({
        authorizedContentReference,
      }))).toEqual({ kind: 'blocked', code: 'invalid_content_reference' });
    }
  });

  it.each([
    '2026-07-17T02:00:00Z',
    '2026-07-17 02:00:00.000Z',
    '2026-02-30T02:00:00.000Z',
    '2026-07-17T10:00:00.000+08:00',
  ])('只接受 canonical UTC 时间：%s', (occurredAt) => {
    expect(appendConversationMessage([], inboundMessage({ occurredAt }))).toEqual({
      kind: 'blocked',
      code: 'invalid_timestamp',
    });
  });

  it('receivedAt 不得早于 occurredAt', () => {
    expect(appendConversationMessage([], inboundMessage({
      receivedAt: '2026-07-17T01:59:59.999Z',
    }))).toEqual({ kind: 'blocked', code: 'received_before_occurred' });
  });

  it.each([
    '',
    '请联系 138-0013-8000',
    '邮箱 customer@example.invalid',
    '患者张三住址上海市示例路 1 号',
    '诊断为示例疾病',
    { code: 'customer_message_received', text: '请联系 138-0013-8000' },
    { code: 'customer_message_received', text: '已收到客户消息。', extra: 'forbidden' },
    { code: 'free_text', text: '已收到客户消息。' },
  ])('任意 caller 自由文本不能作为 safeSummary 进入输出：%j', (safeSummary) => {
    expect(appendConversationMessage([], {
      ...inboundMessage(),
      safeSummary,
    })).toEqual({
      kind: 'blocked',
      code: 'invalid_safe_summary',
    });
  });

  it('inbound 强制安全 sourceMessageRef 和 idempotencyKey', () => {
    expect(appendConversationMessage([], {
      ...inboundMessage(),
      sourceMessageRef: null,
    })).toEqual({ kind: 'blocked', code: 'source_message_reference_required' });
    expect(appendConversationMessage([], inboundMessage({
      sourceMessageRef: 'unsafe/source',
    }))).toEqual({ kind: 'blocked', code: 'invalid_source_message_reference' });
    expect(appendConversationMessage([], inboundMessage({
      sourceMessageRef: 'payload:source-message',
    }))).toEqual({ kind: 'blocked', code: 'invalid_source_message_reference' });
    for (const sourceMessageRef of [
      '138-0013-8000',
      'customer@example.invalid',
      'diagnosis-cancer',
      'source:message:ref_1380013800000000',
    ]) {
      expect(appendConversationMessage([], inboundMessage({
        sourceMessageRef,
      }))).toEqual({ kind: 'blocked', code: 'invalid_source_message_reference' });
    }
    expect(appendConversationMessage([], {
      ...inboundMessage(),
      idempotencyKey: null,
    })).toEqual({ kind: 'blocked', code: 'idempotency_key_required' });
    expect(appendConversationMessage([], inboundMessage({
      idempotencyKey: 'short',
    }))).toEqual({ kind: 'blocked', code: 'idempotency_key_invalid' });
    expect(appendConversationMessage([], inboundMessage({
      idempotencyKey: 'inbound key with spaces',
    }))).toEqual({ kind: 'blocked', code: 'idempotency_key_invalid' });
  });

  it('outbound/system 禁止 sourceMessageRef 和 idempotencyKey', () => {
    expect(appendConversationMessage([], {
      ...outboundMessage(),
      sourceMessageRef: 'source:outbound:001',
    })).toEqual({ kind: 'blocked', code: 'source_message_reference_not_allowed' });
    expect(appendConversationMessage([], {
      ...systemMessage(),
      idempotencyKey: 'system_message_0001',
    })).toEqual({ kind: 'blocked', code: 'idempotency_key_not_allowed' });
  });

  it('输入必须精确字段且禁止额外 payload 字段透传', () => {
    expect(appendConversationMessage([], {
      ...inboundMessage(),
      providerPayload: { opaque: 'forbidden-fixture' },
    })).toEqual({ kind: 'blocked', code: 'invalid_message_shape' });
    const missing = { ...inboundMessage() } as Record<string, unknown>;
    delete missing.safeSummary;
    expect(appendConversationMessage([], missing)).toEqual({
      kind: 'blocked',
      code: 'invalid_message_shape',
    });
  });

  it('同 key 同语义复用首次事实，忽略重试的新提议 messageId/receivedAt', () => {
    const first = appendConversationMessage([], inboundMessage());
    expect(first.kind).toBe('created');
    if (first.kind !== 'created') return;

    const replay = appendConversationMessage(first.history, inboundMessage({
      messageId: 'message-in-retry',
      receivedAt: '2026-07-17T02:00:09.000Z',
    }));
    expect(replay).toMatchObject({
      kind: 'reused',
      message: {
        messageId: 'message-in-001',
        receivedAt: baseReceivedAt,
      },
    });
    if (replay.kind !== 'reused') return;
    expect(replay.history).toHaveLength(1);
    expect(Object.isFrozen(replay)).toBe(true);
    expect(Object.isFrozen(replay.message)).toBe(true);
    expect(Object.isFrozen(replay.history)).toBe(true);
  });

  it.each([
    { conversationId: 'conversation-002' },
    { segmentId: 'segment-002' },
    { occurredAt: '2026-07-17T02:00:00.001Z' },
    { authorizedContentReference: 'content:authorized:ref_a000000000000004' },
    { safeSummary: null },
    { sourceMessageRef: 'source:message:ref_a000000000000004' },
  ])('同 key 不同语义 fail-closed：%j', (overrides) => {
    const first = appendConversationMessage([], inboundMessage());
    if (first.kind !== 'created') throw new Error('expected first message');
    expect(appendConversationMessage(first.history, inboundMessage({
      messageId: 'message-in-retry',
      ...overrides,
    }))).toEqual({ kind: 'blocked', code: 'idempotency_conflict' });
  });

  it('idempotencyKey 区分大小写', () => {
    const first = appendConversationMessage([], inboundMessage());
    if (first.kind !== 'created') throw new Error('expected first message');
    const second = appendConversationMessage(first.history, inboundMessage({
      messageId: 'message-in-002',
      idempotencyKey: 'INBOUND_MESSAGE_0001',
    }));
    expect(second.kind).toBe('created');
  });

  it.each([
    { tenantId: 'tenant-002' },
    { institutionId: 'institution-002' },
  ])('同名 messageId 与 idempotencyKey 跨 scope 在 lookup 前阻断：%j', (scopeOverride) => {
    const first = appendConversationMessage([], inboundMessage());
    if (first.kind !== 'created') throw new Error('expected first message');

    expect(appendConversationMessage(first.history, inboundMessage({
      ...scopeOverride,
    }))).toEqual({ kind: 'blocked', code: 'scope_mismatch' });
    expect(appendConversationMessage(first.history, inboundMessage({
      ...scopeOverride,
      messageId: 'message-in-other-scope',
      idempotencyKey: 'inbound_message_other_scope',
      sourceMessageRef: 'source:message:ref_a000000000000005',
    }))).toEqual({ kind: 'blocked', code: 'scope_mismatch' });
  });

  it('跨机构同名 ID/key 的 message history 优先按 scope fail-closed', () => {
    const mixedHistory = [
      inboundMessage(),
      inboundMessage({
        institutionId: 'institution-002',
      }),
    ];
    expect(appendConversationMessage(mixedHistory, outboundMessage())).toEqual({
      kind: 'blocked',
      code: 'scope_mismatch',
    });
    expect(sortConversationMessages(mixedHistory)).toEqual({
      kind: 'blocked',
      code: 'scope_mismatch',
    });
  });

  it('不同 key 复用 messageId 时固定阻断', () => {
    const first = appendConversationMessage([], inboundMessage());
    if (first.kind !== 'created') throw new Error('expected first message');
    expect(appendConversationMessage(first.history, inboundMessage({
      idempotencyKey: 'inbound_message_0002',
      sourceMessageRef: 'source:message:ref_a000000000000002',
    }))).toEqual({ kind: 'blocked', code: 'message_id_conflict' });
  });

  it('损坏、重复或带额外字段的历史 fail-closed', () => {
    const message = inboundMessage();
    expect(appendConversationMessage('not-an-array', message)).toEqual({
      kind: 'blocked',
      code: 'invalid_message_history',
    });
    expect(appendConversationMessage([message, message], inboundMessage({
      messageId: 'message-new',
      idempotencyKey: 'inbound_message_0002',
    }))).toEqual({ kind: 'blocked', code: 'invalid_message_history' });
    expect(appendConversationMessage([{
      ...message,
      providerPayload: 'forbidden-fixture',
    }], inboundMessage({
      messageId: 'message-new',
      idempotencyKey: 'inbound_message_0002',
    }))).toEqual({ kind: 'blocked', code: 'invalid_message_history' });
  });

  it('append 不改变输入消息或历史', () => {
    const existing = inboundMessage();
    const history = [existing];
    const input = outboundMessage();
    const historyBefore = structuredClone(history);
    const inputBefore = structuredClone(input);
    const result = appendConversationMessage(history, input);
    expect(result.kind).toBe('created');
    expect(history).toEqual(historyBefore);
    expect(input).toEqual(inputBefore);
    expect(history).toHaveLength(1);
    expect(Object.isFrozen(history)).toBe(false);
    expect(Object.isFrozen(existing)).toBe(false);
    expect(Object.isFrozen(existing.safeSummary)).toBe(false);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(input.safeSummary)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('复制后按 occurredAt/receivedAt/messageId 稳定排序且不改变输入', () => {
    const messages = [
      systemMessage({
        messageId: 'message-c',
        occurredAt: '2026-07-17T02:03:00.000Z',
        receivedAt: '2026-07-17T02:03:00.000Z',
      }),
      outboundMessage({
        messageId: 'message-b',
        occurredAt: '2026-07-17T02:01:00.000Z',
        receivedAt: '2026-07-17T02:01:01.000Z',
      }),
      inboundMessage({
        messageId: 'message-a',
        occurredAt: '2026-07-17T02:01:00.000Z',
        receivedAt: '2026-07-17T02:01:00.000Z',
      }),
    ];
    const before = structuredClone(messages);
    const result = sortConversationMessages(messages);
    expect(result).toMatchObject({ kind: 'sorted' });
    if (result.kind !== 'sorted') return;
    expect(result.history.map((message) => message.messageId)).toEqual([
      'message-a',
      'message-b',
      'message-c',
    ]);
    expect(messages).toEqual(before);
    expect(Object.isFrozen(result.history)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(sortConversationMessages(result.history)).toEqual(result);
  });

  it('排序对非法历史 fail-closed', () => {
    expect(sortConversationMessages([{ ...inboundMessage(), extra: true }])).toEqual({
      kind: 'blocked',
      code: 'invalid_message_history',
    });
  });
});

describe('conversation message reply link domain', () => {
  const link = (overrides: Partial<ConversationMessageReplyLink> = {}): ConversationMessageReplyLink => ({
    tenantId,
    institutionId,
    outboundMessageId: 'message-out-001',
    inboundMessageId: 'message-in-001',
    linkedAt: '2026-07-17T02:05:00.000Z',
    basis: 'source_message_reference',
    ...overrides,
  });

  const messages = (): ConversationMessage[] => [
    createdMessage(outboundMessage()),
    createdMessage(inboundMessage({
      segmentId: 'segment-002',
      occurredAt: '2026-07-17T02:04:00.000Z',
      receivedAt: '2026-07-17T02:04:01.000Z',
    })),
  ];

  it('追加同 conversation 的 outbound→inbound 关联，允许跨 segment', () => {
    const input = link();
    const result = appendConversationMessageReplyLink(messages(), [], input);
    expect(result).toEqual({ kind: 'created', link: link(), history: [link()] });
    if (result.kind !== 'created') return;
    expect(Object.isFrozen(result.link)).toBe(true);
    expect(Object.isFrozen(result.history)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.link).not.toBe(input);
    expect(Object.isFrozen(input)).toBe(false);
  });

  it.each([
    [inboundMessage({
      messageId: 'message-out-001',
      sourceMessageRef: 'source:message:ref_a000000000000004',
      idempotencyKey: 'inbound_message_other',
    }), inboundMessage(), 'reply_direction_invalid'],
    [outboundMessage(), outboundMessage({ messageId: 'message-in-001' }), 'reply_direction_invalid'],
    [outboundMessage({ conversationId: 'conversation-other' }), inboundMessage(), 'reply_conversation_mismatch'],
  ] as const)('拒绝非法方向或跨 conversation 关联', (outbound, inbound, code) => {
    expect(appendConversationMessageReplyLink([
      createdMessage(outbound),
      createdMessage(inbound),
    ], [], link())).toEqual({ kind: 'blocked', code });
  });

  it.each([
    { tenantId: 'tenant-002' },
    { institutionId: 'institution-002' },
  ])('同名消息 ID 的 reply link 跨 scope fail-closed：%j', (scopeOverride) => {
    expect(appendConversationMessageReplyLink(messages(), [], link(scopeOverride))).toEqual({
      kind: 'blocked',
      code: 'scope_mismatch',
    });
  });

  it('跨机构消息 history 和 reply history 都在关联 lookup 前阻断', () => {
    const crossInstitutionMessages = [
      createdMessage(outboundMessage()),
      createdMessage(inboundMessage({
        institutionId: 'institution-002',
        occurredAt: '2026-07-17T02:04:00.000Z',
        receivedAt: '2026-07-17T02:04:01.000Z',
      })),
    ];
    expect(appendConversationMessageReplyLink(crossInstitutionMessages, [], link())).toEqual({
      kind: 'blocked',
      code: 'scope_mismatch',
    });
    expect(appendConversationMessageReplyLink(messages(), [link({
      institutionId: 'institution-002',
    })], link())).toEqual({
      kind: 'blocked',
      code: 'scope_mismatch',
    });
  });

  it('关联消息缺失时 fail-closed', () => {
    expect(appendConversationMessageReplyLink(
      [createdMessage(outboundMessage())],
      [],
      link(),
    )).toEqual({ kind: 'blocked', code: 'reply_message_not_found' });
  });

  it('linkedAt 必须 canonical 且不早于 inbound.receivedAt', () => {
    expect(appendConversationMessageReplyLink(messages(), [], link({
      linkedAt: '2026-07-17T02:05:00Z',
    }))).toEqual({ kind: 'blocked', code: 'invalid_timestamp' });
    expect(appendConversationMessageReplyLink(messages(), [], link({
      linkedAt: '2026-07-17T02:04:00.999Z',
    }))).toEqual({ kind: 'blocked', code: 'reply_link_before_inbound_received' });
  });

  it('inbound 来源时间不得早于被回复的 outbound', () => {
    const sourceMessages = messages();
    const inbound = sourceMessages[1];
    if (!inbound || inbound.direction !== 'inbound') {
      throw new Error('expected inbound message');
    }
    expect(appendConversationMessageReplyLink([
      sourceMessages[0]!,
      createdMessage({
        ...inbound,
        occurredAt: '2026-07-17T02:00:59.999Z',
      }),
    ], [], link())).toEqual({ kind: 'blocked', code: 'reply_inbound_before_outbound' });
  });

  it('basis 只接受受控值', () => {
    expect(appendConversationMessageReplyLink(messages(), [], {
      ...link(),
      basis: 'same_conversation',
    })).toEqual({ kind: 'blocked', code: 'invalid_reply_link_basis' });
  });

  it('同一消息对同载荷幂等重放，不同载荷固定冲突', () => {
    const first = appendConversationMessageReplyLink(messages(), [], link());
    if (first.kind !== 'created') throw new Error('expected created link');
    const replay = appendConversationMessageReplyLink(messages(), first.history, link());
    expect(replay).toMatchObject({
      kind: 'reused',
      link: link(),
    });
    expect(Object.isFrozen(replay)).toBe(true);
    const conflict = appendConversationMessageReplyLink(messages(), first.history, link({
      basis: 'manual_verified',
    }));
    expect(conflict).toEqual({ kind: 'blocked', code: 'reply_link_conflict' });
    expect(Object.isFrozen(conflict)).toBe(true);
  });

  it('关联输入与历史必须精确字段', () => {
    expect(appendConversationMessageReplyLink(messages(), [], {
      ...link(),
      completed: true,
    })).toEqual({ kind: 'blocked', code: 'invalid_reply_link_shape' });
    expect(appendConversationMessageReplyLink(messages(), [{
      ...link(),
      replied: true,
    }], link())).toEqual({ kind: 'blocked', code: 'invalid_reply_link_history' });
  });

  it('关联不修改消息，也不制造 replied/completed 属性', () => {
    const sourceMessages = messages();
    const before = structuredClone(sourceMessages);
    const result = appendConversationMessageReplyLink(sourceMessages, [], link());
    expect(result.kind).toBe('created');
    expect(sourceMessages).toEqual(before);
    for (const message of sourceMessages) {
      expect(message).not.toHaveProperty('replied');
      expect(message).not.toHaveProperty('completed');
    }
  });

  it('损坏消息历史或重复 link 历史 fail-closed', () => {
    expect(appendConversationMessageReplyLink([
      { ...messages()[0], extra: true },
      messages()[1],
    ], [], link())).toEqual({ kind: 'blocked', code: 'invalid_message_history' });
    expect(appendConversationMessageReplyLink(messages(), [link(), link()], link())).toEqual({
      kind: 'blocked',
      code: 'invalid_reply_link_history',
    });
  });
});
