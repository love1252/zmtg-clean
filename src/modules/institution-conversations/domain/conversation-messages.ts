export const conversationMessageDirections = Object.freeze([
  'inbound',
  'outbound',
  'system',
] as const);
export const conversationMessageSenderKinds = Object.freeze([
  'customer',
  'human',
  'ai',
  'system',
] as const);
export const conversationMessageReplyLinkBases = Object.freeze([
  'source_message_reference',
  'channel_reply_reference',
  'manual_verified',
] as const);

export type ConversationMessageDirection = (typeof conversationMessageDirections)[number];
export type ConversationMessageSenderKind = (typeof conversationMessageSenderKinds)[number];
export type ConversationMessageReplyLinkBasis = (typeof conversationMessageReplyLinkBases)[number];

export const conversationMessageSafeSummaryTexts = Object.freeze({
  customer_message_received: '已收到客户消息。',
  human_message_recorded: '人工消息已记录。',
  ai_message_recorded: 'AI 消息已记录。',
  system_event_recorded: '系统已记录会话事件。',
} as const);

export type ConversationMessageSafeSummaryCode = keyof typeof conversationMessageSafeSummaryTexts;
export type ConversationMessageSafeSummary = Readonly<{
  code: ConversationMessageSafeSummaryCode;
  text: (typeof conversationMessageSafeSummaryTexts)[ConversationMessageSafeSummaryCode];
}>;

type ConversationMessageCommon = Readonly<{
  tenantId: string;
  institutionId: string;
  messageId: string;
  conversationId: string;
  segmentId: string;
  occurredAt: string;
  receivedAt: string;
  authorizedContentReference: string;
  safeSummary: ConversationMessageSafeSummary | null;
}>;

export type ConversationMessage =
  | ConversationMessageCommon & Readonly<{
      direction: 'inbound';
      senderKind: 'customer';
      sourceMessageRef: string;
      idempotencyKey: string;
    }>
  | ConversationMessageCommon & Readonly<{
      direction: 'outbound';
      senderKind: 'human' | 'ai';
      sourceMessageRef: null;
      idempotencyKey: null;
    }>
  | ConversationMessageCommon & Readonly<{
      direction: 'system';
      senderKind: 'system';
      sourceMessageRef: null;
      idempotencyKey: null;
    }>;

export type ConversationMessageHistory = readonly ConversationMessage[];

export type ConversationMessageBlockCode =
  | 'invalid_message_history'
  | 'scope_mismatch'
  | 'invalid_message_shape'
  | 'invalid_identifier'
  | 'invalid_timestamp'
  | 'received_before_occurred'
  | 'invalid_direction'
  | 'invalid_sender_kind'
  | 'sender_direction_mismatch'
  | 'invalid_content_reference'
  | 'invalid_safe_summary'
  | 'source_message_reference_required'
  | 'source_message_reference_not_allowed'
  | 'invalid_source_message_reference'
  | 'idempotency_key_required'
  | 'idempotency_key_not_allowed'
  | 'idempotency_key_invalid'
  | 'idempotency_conflict'
  | 'message_id_conflict';

export type ConversationMessageAppendResult =
  | Readonly<{
      kind: 'created';
      message: ConversationMessage;
      history: ConversationMessageHistory;
    }>
  | Readonly<{
      kind: 'reused';
      message: ConversationMessage;
      history: ConversationMessageHistory;
    }>
  | Readonly<{
      kind: 'blocked';
      code: ConversationMessageBlockCode;
    }>;

export type ConversationMessageSortResult =
  | Readonly<{
      kind: 'sorted';
      history: ConversationMessageHistory;
    }>
  | Readonly<{
      kind: 'blocked';
      code: 'invalid_message_history' | 'scope_mismatch';
    }>;

export type ConversationMessageReplyLink = Readonly<{
  tenantId: string;
  institutionId: string;
  outboundMessageId: string;
  inboundMessageId: string;
  linkedAt: string;
  basis: ConversationMessageReplyLinkBasis;
}>;

export type ConversationMessageReplyLinkHistory = readonly ConversationMessageReplyLink[];

export type ConversationMessageReplyLinkBlockCode =
  | 'invalid_message_history'
  | 'invalid_reply_link_history'
  | 'scope_mismatch'
  | 'invalid_reply_link_shape'
  | 'invalid_identifier'
  | 'invalid_timestamp'
  | 'invalid_reply_link_basis'
  | 'reply_message_not_found'
  | 'reply_direction_invalid'
  | 'reply_conversation_mismatch'
  | 'reply_inbound_before_outbound'
  | 'reply_link_before_inbound_received'
  | 'reply_link_conflict';

export type ConversationMessageReplyLinkAppendResult =
  | Readonly<{
      kind: 'created';
      link: ConversationMessageReplyLink;
      history: ConversationMessageReplyLinkHistory;
    }>
  | Readonly<{
      kind: 'reused';
      link: ConversationMessageReplyLink;
      history: ConversationMessageReplyLinkHistory;
    }>
  | Readonly<{
      kind: 'blocked';
      code: ConversationMessageReplyLinkBlockCode;
    }>;

type ParsedMessageResult =
  | Readonly<{ kind: 'parsed'; message: ConversationMessage }>
  | Readonly<{ kind: 'blocked'; code: Exclude<ConversationMessageBlockCode, 'invalid_message_history' | 'scope_mismatch' | 'idempotency_conflict' | 'message_id_conflict'> }>;

type ParsedReplyLinkResult =
  | Readonly<{ kind: 'parsed'; link: ConversationMessageReplyLink }>
  | Readonly<{ kind: 'blocked'; code: 'invalid_reply_link_shape' | 'invalid_identifier' | 'invalid_timestamp' | 'invalid_reply_link_basis' }>;

const messageKeys = [
  'tenantId',
  'institutionId',
  'messageId',
  'conversationId',
  'segmentId',
  'direction',
  'senderKind',
  'occurredAt',
  'receivedAt',
  'authorizedContentReference',
  'safeSummary',
  'sourceMessageRef',
  'idempotencyKey',
] as const;

const replyLinkKeys = [
  'tenantId',
  'institutionId',
  'outboundMessageId',
  'inboundMessageId',
  'linkedAt',
  'basis',
] as const;

const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const safeIdempotencyKeyPattern = /^[A-Za-z0-9_-]{16,128}$/u;
const canonicalUtcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const safeContentReferencePattern = /^content:authorized:ref_[a-f][0-9a-f]{15,63}$/u;
const safeSourceMessageReferencePattern = /^source:message:ref_[a-f][0-9a-f]{15,63}$/u;
const safeSummaryKeys = ['code', 'text'] as const;

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => (
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
);

const hasExactOwnKeys = (
  value: Record<PropertyKey, unknown>,
  expectedKeys: readonly string[],
): boolean => {
  const actualKeys = Reflect.ownKeys(value);
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key) => typeof key === 'string' && expectedKeys.includes(key));
};

const isSafeIdentifier = (value: unknown): value is string => (
  typeof value === 'string' && safeIdentifierPattern.test(value)
);

const isSafeContentReference = (value: unknown): value is string => (
  typeof value === 'string' && safeContentReferencePattern.test(value)
);

const isSafeSourceMessageReference = (value: unknown): value is string => (
  typeof value === 'string' && safeSourceMessageReferencePattern.test(value)
);

const parseCanonicalUtcTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'string' || !canonicalUtcTimestampPattern.test(value)) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    return null;
  }
  return timestamp;
};

type ParsedSafeSummaryResult =
  | Readonly<{ kind: 'parsed'; summary: ConversationMessageSafeSummary | null }>
  | Readonly<{ kind: 'blocked' }>;

const parseSafeSummary = (
  value: unknown,
  expectedCode: ConversationMessageSafeSummaryCode,
): ParsedSafeSummaryResult => {
  if (value === null) {
    return { kind: 'parsed', summary: null };
  }
  if (!isRecord(value) || !hasExactOwnKeys(value, safeSummaryKeys)) {
    return { kind: 'blocked' };
  }
  if (
    typeof value.code !== 'string'
    || value.code !== expectedCode
    || value.text !== conversationMessageSafeSummaryTexts[expectedCode]
  ) {
    return { kind: 'blocked' };
  }
  return {
    kind: 'parsed',
    summary: Object.freeze({
      code: expectedCode,
      text: conversationMessageSafeSummaryTexts[expectedCode],
    }),
  };
};

const freezeMessage = (message: ConversationMessage): ConversationMessage => Object.freeze(message);

const parseMessage = (raw: unknown): ParsedMessageResult => {
  if (!isRecord(raw) || !hasExactOwnKeys(raw, messageKeys)) {
    return { kind: 'blocked', code: 'invalid_message_shape' };
  }
  if (
    !isSafeIdentifier(raw.tenantId)
    || !isSafeIdentifier(raw.institutionId)
    || !isSafeIdentifier(raw.messageId)
    || !isSafeIdentifier(raw.conversationId)
    || !isSafeIdentifier(raw.segmentId)
  ) {
    return { kind: 'blocked', code: 'invalid_identifier' };
  }
  if (
    typeof raw.direction !== 'string'
    || !(conversationMessageDirections as readonly string[]).includes(raw.direction)
  ) {
    return { kind: 'blocked', code: 'invalid_direction' };
  }
  if (
    typeof raw.senderKind !== 'string'
    || !(conversationMessageSenderKinds as readonly string[]).includes(raw.senderKind)
  ) {
    return { kind: 'blocked', code: 'invalid_sender_kind' };
  }

  let expectedSummaryCode: ConversationMessageSafeSummaryCode;
  if (raw.direction === 'inbound' && raw.senderKind === 'customer') {
    expectedSummaryCode = 'customer_message_received';
  } else if (raw.direction === 'outbound' && raw.senderKind === 'human') {
    expectedSummaryCode = 'human_message_recorded';
  } else if (raw.direction === 'outbound' && raw.senderKind === 'ai') {
    expectedSummaryCode = 'ai_message_recorded';
  } else if (raw.direction === 'system' && raw.senderKind === 'system') {
    expectedSummaryCode = 'system_event_recorded';
  } else {
    return { kind: 'blocked', code: 'sender_direction_mismatch' };
  }

  const occurredAt = parseCanonicalUtcTimestamp(raw.occurredAt);
  const receivedAt = parseCanonicalUtcTimestamp(raw.receivedAt);
  if (occurredAt === null || receivedAt === null) {
    return { kind: 'blocked', code: 'invalid_timestamp' };
  }
  if (receivedAt < occurredAt) {
    return { kind: 'blocked', code: 'received_before_occurred' };
  }
  if (!isSafeContentReference(raw.authorizedContentReference)) {
    return { kind: 'blocked', code: 'invalid_content_reference' };
  }
  const safeSummary = parseSafeSummary(raw.safeSummary, expectedSummaryCode);
  if (safeSummary.kind === 'blocked') {
    return { kind: 'blocked', code: 'invalid_safe_summary' };
  }

  const common = {
    tenantId: raw.tenantId,
    institutionId: raw.institutionId,
    messageId: raw.messageId,
    conversationId: raw.conversationId,
    segmentId: raw.segmentId,
    occurredAt: raw.occurredAt as string,
    receivedAt: raw.receivedAt as string,
    authorizedContentReference: raw.authorizedContentReference,
    safeSummary: safeSummary.summary,
  } satisfies ConversationMessageCommon;

  if (raw.direction === 'inbound') {
    if (raw.senderKind !== 'customer') {
      return { kind: 'blocked', code: 'sender_direction_mismatch' };
    }
    if (raw.sourceMessageRef === null || raw.sourceMessageRef === undefined || raw.sourceMessageRef === '') {
      return { kind: 'blocked', code: 'source_message_reference_required' };
    }
    if (!isSafeSourceMessageReference(raw.sourceMessageRef)) {
      return { kind: 'blocked', code: 'invalid_source_message_reference' };
    }
    if (raw.idempotencyKey === null || raw.idempotencyKey === undefined || raw.idempotencyKey === '') {
      return { kind: 'blocked', code: 'idempotency_key_required' };
    }
    if (typeof raw.idempotencyKey !== 'string' || !safeIdempotencyKeyPattern.test(raw.idempotencyKey)) {
      return { kind: 'blocked', code: 'idempotency_key_invalid' };
    }
    return {
      kind: 'parsed',
      message: freezeMessage({
        ...common,
        direction: 'inbound',
        senderKind: 'customer',
        sourceMessageRef: raw.sourceMessageRef,
        idempotencyKey: raw.idempotencyKey,
      }),
    };
  }

  if (raw.sourceMessageRef !== null) {
    return { kind: 'blocked', code: 'source_message_reference_not_allowed' };
  }
  if (raw.idempotencyKey !== null) {
    return { kind: 'blocked', code: 'idempotency_key_not_allowed' };
  }

  if (raw.direction === 'outbound') {
    if (raw.senderKind !== 'human' && raw.senderKind !== 'ai') {
      return { kind: 'blocked', code: 'sender_direction_mismatch' };
    }
    return {
      kind: 'parsed',
      message: freezeMessage({
        ...common,
        direction: 'outbound',
        senderKind: raw.senderKind,
        sourceMessageRef: null,
        idempotencyKey: null,
      }),
    };
  }

  if (raw.senderKind !== 'system') {
    return { kind: 'blocked', code: 'sender_direction_mismatch' };
  }
  return {
    kind: 'parsed',
    message: freezeMessage({
      ...common,
      direction: 'system',
      senderKind: 'system',
      sourceMessageRef: null,
      idempotencyKey: null,
    }),
  };
};

type ConversationMessageScope = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

type ValidatedMessageHistoryResult =
  | Readonly<{
      kind: 'valid';
      history: ConversationMessageHistory;
      scope: ConversationMessageScope | null;
    }>
  | Readonly<{
      kind: 'blocked';
      code: 'invalid_message_history' | 'scope_mismatch';
    }>;

const hasSameScope = (
  left: ConversationMessageScope,
  right: ConversationMessageScope,
): boolean => (
  left.tenantId === right.tenantId
  && left.institutionId === right.institutionId
);

const getMessageScope = (message: ConversationMessage): ConversationMessageScope => ({
  tenantId: message.tenantId,
  institutionId: message.institutionId,
});

const validateMessageHistory = (rawHistory: unknown): ValidatedMessageHistoryResult => {
  if (!Array.isArray(rawHistory)) {
    return { kind: 'blocked', code: 'invalid_message_history' };
  }

  const messageIds = new Set<string>();
  const inboundIdempotencyKeys = new Set<string>();
  const messages: ConversationMessage[] = [];
  let scope: ConversationMessageScope | null = null;
  for (const rawMessage of rawHistory) {
    const parsed = parseMessage(rawMessage);
    if (parsed.kind === 'blocked') {
      return { kind: 'blocked', code: 'invalid_message_history' };
    }
    const messageScope = getMessageScope(parsed.message);
    if (scope !== null && !hasSameScope(scope, messageScope)) {
      return { kind: 'blocked', code: 'scope_mismatch' };
    }
    scope ??= Object.freeze(messageScope);
    if (messageIds.has(parsed.message.messageId)) {
      return { kind: 'blocked', code: 'invalid_message_history' };
    }
    if (parsed.message.direction === 'inbound') {
      if (inboundIdempotencyKeys.has(parsed.message.idempotencyKey)) {
        return { kind: 'blocked', code: 'invalid_message_history' };
      }
      inboundIdempotencyKeys.add(parsed.message.idempotencyKey);
    }
    messageIds.add(parsed.message.messageId);
    messages.push(parsed.message);
  }
  return {
    kind: 'valid',
    history: Object.freeze(messages),
    scope,
  };
};

const hasSameInboundSemanticPayload = (
  first: Extract<ConversationMessage, { direction: 'inbound' }>,
  next: Extract<ConversationMessage, { direction: 'inbound' }>,
): boolean => (
  hasSameScope(first, next)
  && first.conversationId === next.conversationId
  && first.segmentId === next.segmentId
  && first.senderKind === next.senderKind
  && first.occurredAt === next.occurredAt
  && first.authorizedContentReference === next.authorizedContentReference
  && first.safeSummary?.code === next.safeSummary?.code
  && first.sourceMessageRef === next.sourceMessageRef
);

export function appendConversationMessage(
  rawHistory: unknown,
  rawInput: unknown,
): ConversationMessageAppendResult {
  const validatedHistory = validateMessageHistory(rawHistory);
  if (validatedHistory.kind === 'blocked') {
    return Object.freeze(validatedHistory);
  }
  const parsed = parseMessage(rawInput);
  if (parsed.kind === 'blocked') {
    return Object.freeze(parsed);
  }
  const message = parsed.message;
  const { history, scope } = validatedHistory;

  if (scope !== null && !hasSameScope(scope, message)) {
    return Object.freeze({ kind: 'blocked', code: 'scope_mismatch' });
  }

  if (message.direction === 'inbound') {
    const existing = history.find(
      (candidate): candidate is Extract<ConversationMessage, { direction: 'inbound' }> => (
        candidate.direction === 'inbound' && candidate.idempotencyKey === message.idempotencyKey
      ),
    );
    if (existing) {
      return hasSameInboundSemanticPayload(existing, message)
        ? Object.freeze({ kind: 'reused', message: existing, history })
        : Object.freeze({ kind: 'blocked', code: 'idempotency_conflict' });
    }
  }

  if (history.some((candidate) => candidate.messageId === message.messageId)) {
    return Object.freeze({ kind: 'blocked', code: 'message_id_conflict' });
  }

  return Object.freeze({
    kind: 'created',
    message,
    history: Object.freeze([...history, message]),
  });
}

const compareStrings = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);

export function sortConversationMessages(rawHistory: unknown): ConversationMessageSortResult {
  const validatedHistory = validateMessageHistory(rawHistory);
  if (validatedHistory.kind === 'blocked') {
    return Object.freeze(validatedHistory);
  }
  const { history } = validatedHistory;
  const sorted = history
    .map((message, originalIndex) => ({ message, originalIndex }))
    .sort((left, right) => (
      compareStrings(left.message.occurredAt, right.message.occurredAt)
      || compareStrings(left.message.receivedAt, right.message.receivedAt)
      || compareStrings(left.message.messageId, right.message.messageId)
      || left.originalIndex - right.originalIndex
    ))
    .map(({ message }) => message);
  return Object.freeze({ kind: 'sorted', history: Object.freeze(sorted) });
}

const freezeReplyLink = (
  link: ConversationMessageReplyLink,
): ConversationMessageReplyLink => Object.freeze(link);

const parseReplyLink = (raw: unknown): ParsedReplyLinkResult => {
  if (!isRecord(raw) || !hasExactOwnKeys(raw, replyLinkKeys)) {
    return { kind: 'blocked', code: 'invalid_reply_link_shape' };
  }
  if (
    !isSafeIdentifier(raw.tenantId)
    || !isSafeIdentifier(raw.institutionId)
    || !isSafeIdentifier(raw.outboundMessageId)
    || !isSafeIdentifier(raw.inboundMessageId)
  ) {
    return { kind: 'blocked', code: 'invalid_identifier' };
  }
  if (parseCanonicalUtcTimestamp(raw.linkedAt) === null) {
    return { kind: 'blocked', code: 'invalid_timestamp' };
  }
  if (
    typeof raw.basis !== 'string'
    || !(conversationMessageReplyLinkBases as readonly string[]).includes(raw.basis)
  ) {
    return { kind: 'blocked', code: 'invalid_reply_link_basis' };
  }
  return {
    kind: 'parsed',
    link: freezeReplyLink({
      tenantId: raw.tenantId,
      institutionId: raw.institutionId,
      outboundMessageId: raw.outboundMessageId,
      inboundMessageId: raw.inboundMessageId,
      linkedAt: raw.linkedAt as string,
      basis: raw.basis as ConversationMessageReplyLinkBasis,
    }),
  };
};

const validateReplyLinkAgainstMessages = (
  link: ConversationMessageReplyLink,
  messages: ConversationMessageHistory,
): ConversationMessageReplyLinkBlockCode | null => {
  const firstMessage = messages[0];
  if (firstMessage && !hasSameScope(firstMessage, link)) {
    return 'scope_mismatch';
  }
  const outbound = messages.find((message) => message.messageId === link.outboundMessageId);
  const inbound = messages.find((message) => message.messageId === link.inboundMessageId);
  if (!outbound || !inbound) {
    return 'reply_message_not_found';
  }
  if (outbound.direction !== 'outbound' || inbound.direction !== 'inbound') {
    return 'reply_direction_invalid';
  }
  if (!hasSameScope(outbound, inbound) || !hasSameScope(outbound, link)) {
    return 'scope_mismatch';
  }
  if (outbound.conversationId !== inbound.conversationId) {
    return 'reply_conversation_mismatch';
  }
  if (inbound.occurredAt < outbound.occurredAt) {
    return 'reply_inbound_before_outbound';
  }
  if (link.linkedAt < inbound.receivedAt) {
    return 'reply_link_before_inbound_received';
  }
  return null;
};

const validateReplyLinkHistory = (
  rawHistory: unknown,
  messages: ConversationMessageHistory,
):
  | Readonly<{ kind: 'valid'; history: ConversationMessageReplyLinkHistory }>
  | Readonly<{ kind: 'blocked'; code: 'invalid_reply_link_history' | 'scope_mismatch' }> => {
  if (!Array.isArray(rawHistory)) {
    return { kind: 'blocked', code: 'invalid_reply_link_history' };
  }
  const pairKeys = new Set<string>();
  const links: ConversationMessageReplyLink[] = [];
  for (const rawLink of rawHistory) {
    const parsed = parseReplyLink(rawLink);
    if (parsed.kind === 'blocked') {
      return { kind: 'blocked', code: 'invalid_reply_link_history' };
    }
    const validationFailure = validateReplyLinkAgainstMessages(parsed.link, messages);
    if (validationFailure !== null) {
      return {
        kind: 'blocked',
        code: validationFailure === 'scope_mismatch'
          ? 'scope_mismatch'
          : 'invalid_reply_link_history',
      };
    }
    const pairKey = `${parsed.link.tenantId.length}:${parsed.link.tenantId}${parsed.link.institutionId.length}:${parsed.link.institutionId}${parsed.link.outboundMessageId.length}:${parsed.link.outboundMessageId}${parsed.link.inboundMessageId.length}:${parsed.link.inboundMessageId}`;
    if (pairKeys.has(pairKey)) {
      return { kind: 'blocked', code: 'invalid_reply_link_history' };
    }
    pairKeys.add(pairKey);
    links.push(parsed.link);
  }
  return { kind: 'valid', history: Object.freeze(links) };
};

export function appendConversationMessageReplyLink(
  rawMessages: unknown,
  rawHistory: unknown,
  rawInput: unknown,
): ConversationMessageReplyLinkAppendResult {
  const validatedMessages = validateMessageHistory(rawMessages);
  if (validatedMessages.kind === 'blocked') {
    return Object.freeze(validatedMessages);
  }
  const { history: messages } = validatedMessages;
  const validatedHistory = validateReplyLinkHistory(rawHistory, messages);
  if (validatedHistory.kind === 'blocked') {
    return Object.freeze(validatedHistory);
  }
  const { history } = validatedHistory;
  const parsed = parseReplyLink(rawInput);
  if (parsed.kind === 'blocked') {
    return Object.freeze(parsed);
  }
  const linkFailure = validateReplyLinkAgainstMessages(parsed.link, messages);
  if (linkFailure) {
    return Object.freeze({ kind: 'blocked', code: linkFailure });
  }

  const existing = history.find((candidate) => (
    hasSameScope(candidate, parsed.link)
    && candidate.outboundMessageId === parsed.link.outboundMessageId
    && candidate.inboundMessageId === parsed.link.inboundMessageId
  ));
  if (existing) {
    return existing.linkedAt === parsed.link.linkedAt && existing.basis === parsed.link.basis
      ? Object.freeze({ kind: 'reused', link: existing, history })
      : Object.freeze({ kind: 'blocked', code: 'reply_link_conflict' });
  }

  return Object.freeze({
    kind: 'created',
    link: parsed.link,
    history: Object.freeze([...history, parsed.link]),
  });
}
