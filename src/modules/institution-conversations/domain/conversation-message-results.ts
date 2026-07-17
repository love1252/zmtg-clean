import type { ConversationMessage } from '@/modules/institution-conversations/domain/conversation-messages';

export const conversationMessageResultStages = Object.freeze([
  'message_transport',
  'provider_acceptance',
  'channel_delivery',
] as const);

export const conversationMessageTransportStatuses = Object.freeze([
  'inbound_received',
  'outbound_created',
  'outbound_submitted',
  'outbound_failed',
  'outbound_skipped',
  'outbound_unknown',
] as const);

export const conversationMessageProviderAcceptanceStatuses = Object.freeze([
  'provider_accepted',
  'provider_rejected',
  'provider_unknown',
] as const);

export const conversationMessageChannelDeliveryStatuses = Object.freeze([
  'delivery_not_reported',
  'channel_delivered',
  'channel_failed',
  'channel_unknown',
] as const);

export const conversationMessageResultFailureCodes = Object.freeze([
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
] as const);

export type ConversationMessageResultStage = (typeof conversationMessageResultStages)[number];
export type ConversationMessageTransportStatus =
  (typeof conversationMessageTransportStatuses)[number];
export type ConversationMessageProviderAcceptanceStatus =
  (typeof conversationMessageProviderAcceptanceStatuses)[number];
export type ConversationMessageChannelDeliveryStatus =
  (typeof conversationMessageChannelDeliveryStatuses)[number];
export type ConversationMessageResultFailureCode =
  (typeof conversationMessageResultFailureCodes)[number];

export type LowSensitiveChannelReceiptReference = Readonly<{
  referenceId: string;
  verificationState: 'authoritative';
  verifiedAt: string;
}>;

type ConversationMessageResultBase = Readonly<{
  tenantId: string;
  institutionId: string;
  resultId: string;
  messageId: string;
  occurredAt: string;
  attemptNo: number;
  dedupeKey: string;
  providerMessageRef: string | null;
  failureCode: ConversationMessageResultFailureCode | null;
}>;

export type ConversationMessageTransportResult = ConversationMessageResultBase & Readonly<{
  stage: 'message_transport';
  status: ConversationMessageTransportStatus;
  channelReceiptReference: null;
}>;

export type ConversationMessageProviderAcceptanceResult = ConversationMessageResultBase & Readonly<{
  stage: 'provider_acceptance';
  status: ConversationMessageProviderAcceptanceStatus;
  channelReceiptReference: null;
}>;

export type ConversationMessageChannelDeliveryResult = ConversationMessageResultBase & Readonly<{
  stage: 'channel_delivery';
  status: ConversationMessageChannelDeliveryStatus;
  channelReceiptReference: LowSensitiveChannelReceiptReference | null;
}>;

export type ConversationMessageResult =
  | ConversationMessageTransportResult
  | ConversationMessageProviderAcceptanceResult
  | ConversationMessageChannelDeliveryResult;

export type ConversationMessageResultHistory = readonly ConversationMessageResult[];

export type ConversationMessageResultSubject = Readonly<Pick<
  ConversationMessage,
  'tenantId' | 'institutionId' | 'messageId' | 'direction'
>>;

export type ConversationMessageResultProjectionTarget = Readonly<Pick<
  ConversationMessage,
  'tenantId' | 'institutionId' | 'messageId'
>>;

export type ConversationMessageResultBlockCode =
  | 'invalid_result_shape'
  | 'invalid_result_history'
  | 'invalid_identifier'
  | 'invalid_timestamp'
  | 'invalid_attempt_no'
  | 'invalid_dedupe_key'
  | 'invalid_safe_reference'
  | 'stage_status_mismatch'
  | 'failure_code_mismatch'
  | 'message_id_mismatch'
  | 'message_direction_mismatch'
  | 'scope_mismatch'
  | 'authoritative_channel_receipt_required'
  | 'channel_receipt_not_allowed'
  | 'channel_receipt_invalid'
  | 'reference_message_conflict'
  | 'idempotency_conflict'
  | 'result_id_conflict';

export type ConversationMessageResultAppendResult =
  | Readonly<{
      kind: 'applied';
      history: ConversationMessageResultHistory;
      result: ConversationMessageResult;
    }>
  | Readonly<{
      kind: 'replayed';
      history: ConversationMessageResultHistory;
      result: ConversationMessageResult;
    }>
  | Readonly<{
      kind: 'blocked';
      code: ConversationMessageResultBlockCode;
    }>;

export type ConversationMessageResultProjection = Readonly<{
  tenantId: string;
  institutionId: string;
  messageId: string;
  latestAttempt: Readonly<{
    attemptNo: number;
    transport: ConversationMessageTransportStatus | null;
    provider: ConversationMessageProviderAcceptanceStatus | null;
    channel: ConversationMessageChannelDeliveryStatus;
  }> | null;
  authoritativeChannelDelivery: Readonly<{
    status: 'channel_delivered';
    attemptNo: number;
    occurredAt: string;
    channelReceiptReference: LowSensitiveChannelReceiptReference;
  }> | null;
}>;

export type ConversationMessageResultProjectionResult =
  | Readonly<{
      kind: 'projected';
      projection: ConversationMessageResultProjection;
    }>
  | Readonly<{
      kind: 'blocked';
      code:
        | 'invalid_identifier'
        | 'invalid_result_history'
        | 'scope_mismatch'
        | 'reference_message_conflict';
    }>;

export type ConversationMessageResultOrderResult =
  | Readonly<{
      kind: 'ordered';
      results: ConversationMessageResultHistory;
    }>
  | Readonly<{
      kind: 'blocked';
      code: 'invalid_result_history' | 'scope_mismatch' | 'reference_message_conflict';
    }>;

const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const safeDedupeKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const canonicalUtcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const safeProviderMessageReferencePattern = /^provider:message:ref_[a-f][0-9a-f]{15,63}$/u;
const safeChannelReceiptReferencePattern = /^channel:receipt:ref_[a-f][0-9a-f]{15,63}$/u;
const resultKeys = [
  'tenantId',
  'institutionId',
  'resultId',
  'messageId',
  'stage',
  'status',
  'occurredAt',
  'attemptNo',
  'dedupeKey',
  'providerMessageRef',
  'failureCode',
  'channelReceiptReference',
] as const;
const channelReceiptReferenceKeys = [
  'referenceId',
  'verificationState',
  'verifiedAt',
] as const;

const transportStatusSet = new Set<string>(conversationMessageTransportStatuses);
const providerStatusSet = new Set<string>(conversationMessageProviderAcceptanceStatuses);
const channelStatusSet = new Set<string>(conversationMessageChannelDeliveryStatuses);
const failureCodeSet = new Set<string>(conversationMessageResultFailureCodes);

const failureCodesByStatus: Readonly<Record<
  ConversationMessageTransportStatus
    | ConversationMessageProviderAcceptanceStatus
    | ConversationMessageChannelDeliveryStatus,
  readonly ConversationMessageResultFailureCode[]
>> = {
  inbound_received: [],
  outbound_created: [],
  outbound_submitted: [],
  outbound_failed: ['outbound_submission_failed'],
  outbound_skipped: ['outbound_submission_skipped'],
  outbound_unknown: [
    'outbound_submission_timeout',
    'outbound_submission_indeterminate',
  ],
  provider_accepted: [],
  provider_rejected: ['provider_rejected'],
  provider_unknown: [
    'provider_timeout',
    'provider_unavailable',
    'provider_indeterminate',
  ],
  delivery_not_reported: [],
  channel_delivered: [],
  channel_failed: ['channel_failed'],
  channel_unknown: [
    'channel_receipt_timeout',
    'channel_receipt_unavailable',
    'channel_receipt_indeterminate',
  ],
};

const stageRank: Readonly<Record<ConversationMessageResultStage, number>> = {
  message_transport: 0,
  provider_acceptance: 1,
  channel_delivery: 2,
};

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

type ConversationMessageResultScope = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

const isValidScope = (value: unknown): boolean => (
  isRecord(value)
  && isSafeIdentifier(value.tenantId)
  && isSafeIdentifier(value.institutionId)
);

const isSameScope = (
  left: ConversationMessageResultScope,
  right: ConversationMessageResultScope,
): boolean => (
  left.tenantId === right.tenantId
  && left.institutionId === right.institutionId
);

const isSafeProviderMessageReference = (value: unknown): value is string => (
  typeof value === 'string' && safeProviderMessageReferencePattern.test(value)
);

const isSafeChannelReceiptReference = (value: unknown): value is string => (
  typeof value === 'string' && safeChannelReceiptReferencePattern.test(value)
);

const isCanonicalUtcTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string' || !canonicalUtcTimestampPattern.test(value)) {
    return false;
  }
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.valueOf()) && timestamp.toISOString() === value;
};

const isSafeAttemptNo = (value: unknown): value is number => (
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value > 0
);

const isStageStatusPair = (
  stage: unknown,
  status: unknown,
): stage is ConversationMessageResultStage => {
  if (typeof stage !== 'string' || typeof status !== 'string') {
    return false;
  }
  if (stage === 'message_transport') {
    return transportStatusSet.has(status);
  }
  if (stage === 'provider_acceptance') {
    return providerStatusSet.has(status);
  }
  return stage === 'channel_delivery' && channelStatusSet.has(status);
};

const validateFailureCode = (
  status: ConversationMessageResult['status'],
  failureCode: unknown,
): boolean => {
  const allowed = failureCodesByStatus[status];
  if (allowed.length === 0) {
    return failureCode === null;
  }
  return typeof failureCode === 'string'
    && failureCodeSet.has(failureCode)
    && allowed.includes(failureCode as ConversationMessageResultFailureCode);
};

const validateChannelReceiptReference = (
  value: unknown,
  occurredAt: string,
): value is LowSensitiveChannelReceiptReference => (
  isRecord(value)
  && hasExactOwnKeys(value, channelReceiptReferenceKeys)
  && isSafeChannelReceiptReference(value.referenceId)
  && value.verificationState === 'authoritative'
  && isCanonicalUtcTimestamp(value.verifiedAt)
  && value.verifiedAt <= occurredAt
);

const validateResult = (
  value: unknown,
): ConversationMessageResultBlockCode | null => {
  if (!isRecord(value) || !hasExactOwnKeys(value, resultKeys)) {
    return 'invalid_result_shape';
  }
  if (
    !isValidScope(value)
    || !isSafeIdentifier(value.resultId)
    || !isSafeIdentifier(value.messageId)
  ) {
    return 'invalid_identifier';
  }
  if (!isCanonicalUtcTimestamp(value.occurredAt)) {
    return 'invalid_timestamp';
  }
  if (!isSafeAttemptNo(value.attemptNo)) {
    return 'invalid_attempt_no';
  }
  if (typeof value.dedupeKey !== 'string' || !safeDedupeKeyPattern.test(value.dedupeKey)) {
    return 'invalid_dedupe_key';
  }
  if (
    value.providerMessageRef !== null
    && !isSafeProviderMessageReference(value.providerMessageRef)
  ) {
    return 'invalid_safe_reference';
  }
  if (!isStageStatusPair(value.stage, value.status)) {
    return 'stage_status_mismatch';
  }
  if (!validateFailureCode(
    value.status as ConversationMessageResult['status'],
    value.failureCode,
  )) {
    return 'failure_code_mismatch';
  }
  if (value.stage === 'message_transport' && value.providerMessageRef !== null) {
    return 'invalid_safe_reference';
  }
  if (value.stage !== 'channel_delivery') {
    return value.channelReceiptReference === null
      ? null
      : 'channel_receipt_not_allowed';
  }
  if (value.status === 'channel_delivered' || value.status === 'channel_failed') {
    if (value.channelReceiptReference === null) {
      return 'authoritative_channel_receipt_required';
    }
    return validateChannelReceiptReference(value.channelReceiptReference, value.occurredAt)
      ? null
      : 'channel_receipt_invalid';
  }
  return value.channelReceiptReference === null
    ? null
    : 'channel_receipt_not_allowed';
};

const sameReceiptReference = (
  left: LowSensitiveChannelReceiptReference | null,
  right: LowSensitiveChannelReceiptReference | null,
): boolean => (
  left === null
    ? right === null
    : right !== null
      && left.referenceId === right.referenceId
      && left.verificationState === right.verificationState
      && left.verifiedAt === right.verifiedAt
);

const sameResultFact = (
  left: ConversationMessageResult,
  right: ConversationMessageResult,
): boolean => (
  left.tenantId === right.tenantId
  && left.institutionId === right.institutionId
  && left.resultId === right.resultId
  && left.messageId === right.messageId
  && left.stage === right.stage
  && left.status === right.status
  && left.occurredAt === right.occurredAt
  && left.attemptNo === right.attemptNo
  && left.dedupeKey === right.dedupeKey
  && left.providerMessageRef === right.providerMessageRef
  && left.failureCode === right.failureCode
  && sameReceiptReference(left.channelReceiptReference, right.channelReceiptReference)
);

const inspectHistory = (
  history: unknown,
  expectedScope?: ConversationMessageResultScope,
): ConversationMessageResultBlockCode | null => {
  if (!Array.isArray(history)) {
    return 'invalid_result_history';
  }
  const resultIds = new Set<string>();
  const dedupeKeys = new Set<string>();
  const providerReferenceOwners = new Map<string, string>();
  const channelReferenceOwners = new Map<string, string>();
  let historyScope: ConversationMessageResultScope | null = null;
  for (const rawResult of history) {
    if (validateResult(rawResult) !== null) {
      return 'invalid_result_history';
    }
    const result = rawResult as ConversationMessageResult;
    historyScope ??= result;
    if (
      !isSameScope(result, historyScope)
      || (expectedScope !== undefined && !isSameScope(result, expectedScope))
    ) {
      return 'scope_mismatch';
    }
    if (resultIds.has(result.resultId) || dedupeKeys.has(result.dedupeKey)) {
      return 'invalid_result_history';
    }
    if (result.providerMessageRef !== null) {
      const ownerMessageId = providerReferenceOwners.get(result.providerMessageRef);
      if (ownerMessageId !== undefined && ownerMessageId !== result.messageId) {
        return 'reference_message_conflict';
      }
      providerReferenceOwners.set(result.providerMessageRef, result.messageId);
    }
    if (result.channelReceiptReference !== null) {
      const ownerMessageId = channelReferenceOwners.get(
        result.channelReceiptReference.referenceId,
      );
      if (ownerMessageId !== undefined && ownerMessageId !== result.messageId) {
        return 'reference_message_conflict';
      }
      channelReferenceOwners.set(
        result.channelReceiptReference.referenceId,
        result.messageId,
      );
    }
    resultIds.add(result.resultId);
    dedupeKeys.add(result.dedupeKey);
  }
  return null;
};

const isDirectionAllowed = (
  direction: ConversationMessage['direction'],
  result: ConversationMessageResult,
): boolean => {
  if (direction === 'system') {
    return false;
  }
  if (result.stage !== 'message_transport') {
    return direction === 'outbound';
  }
  return result.status === 'inbound_received'
    ? direction === 'inbound'
    : direction === 'outbound';
};

const copyResult = (result: ConversationMessageResult): ConversationMessageResult => {
  if (result.stage === 'channel_delivery') {
    const channelReceiptReference = result.channelReceiptReference === null
      ? null
      : Object.freeze({ ...result.channelReceiptReference });
    return Object.freeze({
      ...result,
      channelReceiptReference,
    });
  }
  return Object.freeze({ ...result, channelReceiptReference: null });
};

const copyHistory = (
  history: ConversationMessageResultHistory,
): ConversationMessageResultHistory => Object.freeze(history.map(copyResult));

const freezeBlocked = <Code extends ConversationMessageResultBlockCode>(
  code: Code,
): Readonly<{ kind: 'blocked'; code: Code }> => Object.freeze({
  kind: 'blocked' as const,
  code,
});

const hasReferenceMessageConflict = (
  history: ConversationMessageResultHistory,
  input: ConversationMessageResult,
): boolean => (
  (input.providerMessageRef !== null && history.some((result) => (
    result.providerMessageRef === input.providerMessageRef
    && result.messageId !== input.messageId
  )))
  || (input.channelReceiptReference !== null && history.some((result) => (
    result.channelReceiptReference?.referenceId === input.channelReceiptReference?.referenceId
    && result.messageId !== input.messageId
  )))
);

const compareStrings = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);

const compareResults = (
  left: ConversationMessageResult,
  right: ConversationMessageResult,
): number => (
  compareStrings(left.occurredAt, right.occurredAt)
  || left.attemptNo - right.attemptNo
  || stageRank[left.stage] - stageRank[right.stage]
  || compareStrings(left.resultId, right.resultId)
);

const findLastResult = <T extends ConversationMessageResult>(
  results: ConversationMessageResultHistory,
  predicate: (result: ConversationMessageResult) => result is T,
): T | undefined => {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index];
    if (result && predicate(result)) {
      return result;
    }
  }
  return undefined;
};

export function appendConversationMessageResult(
  history: unknown,
  message: ConversationMessageResultSubject,
  input: ConversationMessageResult,
): ConversationMessageResultAppendResult {
  if (!isValidScope(message) || !isSafeIdentifier(message.messageId)) {
    return freezeBlocked('invalid_identifier');
  }
  const historyFailure = inspectHistory(history, message);
  if (historyFailure !== null) {
    return freezeBlocked(
      historyFailure === 'scope_mismatch' || historyFailure === 'reference_message_conflict'
        ? historyFailure
        : 'invalid_result_history',
    );
  }
  const validHistory = history as ConversationMessageResultHistory;
  if (
    message.direction !== 'inbound'
    && message.direction !== 'outbound'
    && message.direction !== 'system'
  ) {
    return freezeBlocked('message_direction_mismatch');
  }
  if (validHistory.some((result) => (
    result.messageId === message.messageId
    && !isDirectionAllowed(message.direction, result)
  ))) {
    return freezeBlocked('invalid_result_history');
  }
  const validationFailure = validateResult(input);
  if (validationFailure !== null) {
    return freezeBlocked(validationFailure);
  }
  if (!isSameScope(input, message)) {
    return freezeBlocked('scope_mismatch');
  }
  if (input.messageId !== message.messageId) {
    return freezeBlocked('message_id_mismatch');
  }
  if (!isDirectionAllowed(message.direction, input)) {
    return freezeBlocked('message_direction_mismatch');
  }
  const existingByDedupeKey = validHistory.find(
    (result) => result.dedupeKey === input.dedupeKey,
  );
  if (existingByDedupeKey) {
    if (!sameResultFact(existingByDedupeKey, input)) {
      return freezeBlocked('idempotency_conflict');
    }
    const canonicalHistory = copyHistory(validHistory);
    const canonicalResult = canonicalHistory.find(
      (result) => result.dedupeKey === input.dedupeKey,
    );
    if (!canonicalResult) {
      return freezeBlocked('invalid_result_history');
    }
    return Object.freeze({
      kind: 'replayed',
      history: canonicalHistory,
      result: canonicalResult,
    });
  }
  if (hasReferenceMessageConflict(validHistory, input)) {
    return freezeBlocked('reference_message_conflict');
  }
  if (validHistory.some((result) => result.resultId === input.resultId)) {
    return freezeBlocked('result_id_conflict');
  }

  const result = copyResult(input);
  return Object.freeze({
    kind: 'applied',
    history: Object.freeze([...validHistory.map(copyResult), result]),
    result,
  });
}

export function orderConversationMessageResults(
  history: unknown,
): ConversationMessageResultOrderResult {
  const historyFailure = inspectHistory(history);
  if (historyFailure !== null) {
    return freezeBlocked(
      historyFailure === 'scope_mismatch' || historyFailure === 'reference_message_conflict'
        ? historyFailure
        : 'invalid_result_history',
    );
  }
  const validHistory = history as ConversationMessageResultHistory;
  return Object.freeze({
    kind: 'ordered',
    results: Object.freeze(validHistory.map(copyResult).sort(compareResults)),
  });
}

export function projectConversationMessageResults(
  target: ConversationMessageResultProjectionTarget,
  history: unknown,
): ConversationMessageResultProjectionResult {
  if (!isValidScope(target) || !isSafeIdentifier(target.messageId)) {
    return freezeBlocked('invalid_identifier');
  }
  const historyFailure = inspectHistory(history, target);
  if (historyFailure !== null) {
    return freezeBlocked(
      historyFailure === 'scope_mismatch' || historyFailure === 'reference_message_conflict'
        ? historyFailure
        : 'invalid_result_history',
    );
  }
  const ordered = orderConversationMessageResults(history);
  if (ordered.kind === 'blocked') {
    return ordered;
  }
  const messageResults = ordered.results.filter((result) => result.messageId === target.messageId);
  const latestAttemptNo = messageResults.reduce<number | null>(
    (latest, result) => latest === null || result.attemptNo > latest ? result.attemptNo : latest,
    null,
  );
  if (latestAttemptNo === null) {
    return Object.freeze({
      kind: 'projected',
      projection: Object.freeze({
        tenantId: target.tenantId,
        institutionId: target.institutionId,
        messageId: target.messageId,
        latestAttempt: null,
        authoritativeChannelDelivery: null,
      }),
    });
  }

  const latestAttemptResults = messageResults.filter(
    (result) => result.attemptNo === latestAttemptNo,
  );
  const transport = findLastResult(
    latestAttemptResults,
    (result): result is ConversationMessageTransportResult => result.stage === 'message_transport',
  );
  const provider = findLastResult(
    latestAttemptResults,
    (result): result is ConversationMessageProviderAcceptanceResult => (
      result.stage === 'provider_acceptance'
    ),
  );
  const channel = findLastResult(
    latestAttemptResults,
    (result): result is ConversationMessageChannelDeliveryResult => result.stage === 'channel_delivery',
  );
  const authoritativeChannelDelivery = findLastResult(
    messageResults,
    (result): result is ConversationMessageChannelDeliveryResult & Readonly<{
      status: 'channel_delivered';
      channelReceiptReference: LowSensitiveChannelReceiptReference;
    }> => (
      result.stage === 'channel_delivery'
      && result.status === 'channel_delivered'
      && result.channelReceiptReference !== null
    ),
  );
  const authoritativeDeliveryProjection = authoritativeChannelDelivery === undefined
    ? null
    : Object.freeze({
        status: 'channel_delivered' as const,
        attemptNo: authoritativeChannelDelivery.attemptNo,
        occurredAt: authoritativeChannelDelivery.occurredAt,
        channelReceiptReference: Object.freeze({
          ...authoritativeChannelDelivery.channelReceiptReference,
        }),
      });

  return Object.freeze({
    kind: 'projected',
    projection: Object.freeze({
      tenantId: target.tenantId,
      institutionId: target.institutionId,
      messageId: target.messageId,
      latestAttempt: Object.freeze({
        attemptNo: latestAttemptNo,
        transport: transport?.status ?? null,
        provider: provider?.status ?? null,
        channel: channel?.status ?? 'delivery_not_reported',
      }),
      authoritativeChannelDelivery: authoritativeDeliveryProjection,
    }),
  });
}
