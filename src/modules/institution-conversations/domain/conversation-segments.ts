import {
  checkConversationRiskSetForNormalClose,
  type ConversationRiskHistory,
  type ConversationRiskNormalCloseBlockCode,
  type CurrentClinicalClosureCheck,
} from './conversation-risks';

export const conversationSegmentStates = [
  'ai_handling',
  'awaiting_human',
  'human_handling',
  'waiting_customer',
  'closed',
] as const;

export const conversationSegmentCloseKinds = ['open', 'normal', 'forced'] as const;
export const conversationSegmentRiskStates = ['none', 'unconfirmed', 'confirmed', 'resolved'] as const;
export const segmentLocalBlockingReasonCodes = ['forced_close_unresolved'] as const;
export const segmentManualCloseResultCodes = ['unresolved', 'resolved'] as const;

export type ConversationSegmentState = (typeof conversationSegmentStates)[number];
export type ConversationSegmentCloseKind = (typeof conversationSegmentCloseKinds)[number];
export type ConversationSegmentRiskState = (typeof conversationSegmentRiskStates)[number];
export type SegmentLocalBlockingReasonCode = (typeof segmentLocalBlockingReasonCodes)[number];
export type SegmentManualCloseResultCode = (typeof segmentManualCloseResultCodes)[number];
export type SegmentResolutionState = 'open' | 'resolved';
export type SegmentGuardReadiness = 'ready' | 'not_ready' | 'unknown';
export type SegmentOutboundGuardState = 'clear' | 'pending' | 'unknown';

export type ConversationSegment = Readonly<{
  tenantId: string;
  institutionId: string;
  segmentId: string;
  conversationId: string;
  sequenceNo: number;
  state: ConversationSegmentState;
  currentHandlerId: string | null;
  everHumanHandled: boolean;
  openedByCustomerMessageId: string;
  openedAt: string;
  lastCustomerMessageId: string;
  lastCustomerMessageAt: string;
  latestInboundRevision: number;
  waitingAfterCustomerMessageId: string | null;
  waitingAfterCustomerMessageAt: string | null;
  waitingAfterInboundRevision: number | null;
  stateChangedAt: string;
  closedAt: string | null;
  segmentCloseKind: ConversationSegmentCloseKind;
  resolutionState: SegmentResolutionState;
  resolvedAt: string | null;
  blockingReasonCodes: readonly SegmentLocalBlockingReasonCode[];
}>;

export type SegmentTransitionBlockCode =
  | 'segment_closed'
  | 'segment_not_closed'
  | 'transition_not_allowed'
  | 'active_assignment_missing'
  | 'multiple_active_assignments'
  | 'operator_not_active_assignee'
  | 'operator_not_current_handler'
  | 'risk_not_none'
  | 'blocking_reason_present'
  | 'unconfirmed_business_action'
  | 'outbound_pending'
  | 'outbound_unknown'
  | 'ai_not_ready'
  | 'knowledge_not_ready'
  | 'sensitive_authorization_not_ready'
  | 'message_type_not_allowed'
  | 'institution_policy_not_allowed'
  | 'ever_human_handled'
  | 'waiting_window_not_elapsed'
  | 'channel_auto_close_not_allowed'
  | 'new_inbound_during_wait'
  | 'inbound_status_unknown'
  | 'inbound_cursor_invalid'
  | 'customer_inbound_required'
  | 'customer_inbound_invalid'
  | 'customer_inbound_target_mismatch'
  | 'customer_inbound_not_new'
  | 'blocking_status_unknown'
  | 'risk_status_unknown'
  | 'force_close_not_authorized'
  | 'close_result_invalid'
  | 'close_result_mismatch'
  | 'invalid_timestamp'
  | 'invalid_identifier'
  | 'sequence_exhausted'
  | ConversationRiskNormalCloseBlockCode;

export type SegmentTransitionResult =
  | Readonly<{
      kind: 'applied';
      segment: ConversationSegment;
    }>
  | Readonly<{
      kind: 'blocked';
      code: SegmentTransitionBlockCode;
    }>;

export type SegmentSendEligibilityResult =
  | Readonly<{
      kind: 'allowed';
    }>
  | Readonly<{
      kind: 'blocked';
      code: 'segment_closed';
    }>;

export type ActiveAssignmentGuard = Readonly<{
  activeAssignmentCount: number;
  assigneeId: string | null;
}>;

export type SegmentReturnToAiInput = Readonly<{
  operatorId: string;
  occurredAt: string;
  riskState: ConversationSegmentRiskState;
  hasBlockingReason: boolean;
  hasUnconfirmedBusinessAction: boolean;
  outboundState: SegmentOutboundGuardState;
  aiReadiness: SegmentGuardReadiness;
  knowledgeReadiness: SegmentGuardReadiness;
  sensitiveAuthorizationReadiness: SegmentGuardReadiness;
  messageTypeAllowed: boolean;
  institutionPolicyAllowsAi: boolean;
}>;

export type SegmentAutoCloseInput = Readonly<{
  occurredAt: string;
  riskState: ConversationSegmentRiskState;
  hasBlockingReason: boolean;
  outboundState: SegmentOutboundGuardState;
  channelAllowsAutoClose: boolean;
  windowAnchor: SegmentAutoCloseWindowAnchor;
  currentInboundCursor: SegmentCurrentInboundCursor;
}>;

export type SegmentCustomerInboundFact = Readonly<{
  tenantId: string;
  institutionId: string;
  messageId: string;
  conversationId: string;
  segmentId: string;
  direction: 'inbound';
  senderKind: 'customer';
  inboundRevision: number;
  occurredAt: string;
  receivedAt: string;
}>;

export type SegmentAutoCloseWindowAnchor = Readonly<{
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
  customerMessageId: string;
  lastCustomerMessageAt: string;
  latestInboundRevision: number;
  waitWindowEndsAt: string;
}>;

export type SegmentCurrentInboundCursor =
  | Readonly<{
      readiness: 'unknown';
    }>
  | Readonly<{
      readiness: 'ready';
      tenantId: string;
      institutionId: string;
      conversationId: string;
      segmentId: string;
      customerMessageId: string;
      lastCustomerMessageAt: string;
      latestInboundRevision: number;
      checkedAt: string;
      validUntil: string;
    }>;

export type SegmentBlockingSnapshot =
  | Readonly<{
      readiness: 'unknown';
    }>
  | Readonly<{
      readiness: 'ready';
      tenantId: string;
      institutionId: string;
      conversationId: string;
      segmentId: string;
      checkedAt: string;
      validUntil: string;
      state: 'clear' | 'present';
    }>;

export type SegmentRiskSetSnapshot =
  | Readonly<{
      readiness: 'unknown';
    }>
  | Readonly<{
      readiness: 'ready';
      tenantId: string;
      institutionId: string;
      conversationId: string;
      segmentId: string;
      checkedAt: string;
      validUntil: string;
      histories: readonly ConversationRiskHistory[];
      currentClinicalClosureChecks: readonly CurrentClinicalClosureCheck[];
    }>;

export type SegmentManualCloseInput = Readonly<{
  operatorId: string;
  occurredAt: string;
  closeResultCode: SegmentManualCloseResultCode;
  blockingSnapshot: SegmentBlockingSnapshot;
  riskSet: SegmentRiskSetSnapshot;
}>;

const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const canonicalUtcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const customerInboundFactKeys = [
  'tenantId',
  'institutionId',
  'messageId',
  'conversationId',
  'segmentId',
  'direction',
  'senderKind',
  'inboundRevision',
  'occurredAt',
  'receivedAt',
] as const;
const autoCloseWindowAnchorKeys = [
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'customerMessageId',
  'lastCustomerMessageAt',
  'latestInboundRevision',
  'waitWindowEndsAt',
] as const;
const readyInboundCursorKeys = [
  'readiness',
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'customerMessageId',
  'lastCustomerMessageAt',
  'latestInboundRevision',
  'checkedAt',
  'validUntil',
] as const;
const unknownReadinessKeys = ['readiness'] as const;
const readyBlockingSnapshotKeys = [
  'readiness',
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'checkedAt',
  'validUntil',
  'state',
] as const;
const readyRiskSetKeys = [
  'readiness',
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'checkedAt',
  'validUntil',
  'histories',
  'currentClinicalClosureChecks',
] as const;
const manualCloseInputKeys = [
  'operatorId',
  'occurredAt',
  'closeResultCode',
  'blockingSnapshot',
  'riskSet',
] as const;
const resumeHumanInputKeys = [
  'operatorId',
  'occurredAt',
  'customerInbound',
  'currentInboundCursor',
] as const;
const autoCloseInputKeys = [
  'occurredAt',
  'riskState',
  'hasBlockingReason',
  'outboundState',
  'channelAllowsAutoClose',
  'windowAnchor',
  'currentInboundCursor',
] as const;
const conversationSegmentKeys = [
  'tenantId',
  'institutionId',
  'segmentId',
  'conversationId',
  'sequenceNo',
  'state',
  'currentHandlerId',
  'everHumanHandled',
  'openedByCustomerMessageId',
  'openedAt',
  'lastCustomerMessageId',
  'lastCustomerMessageAt',
  'latestInboundRevision',
  'waitingAfterCustomerMessageId',
  'waitingAfterCustomerMessageAt',
  'waitingAfterInboundRevision',
  'stateChangedAt',
  'closedAt',
  'segmentCloseKind',
  'resolutionState',
  'resolvedAt',
  'blockingReasonCodes',
] as const;

const blocked = (code: SegmentTransitionBlockCode): SegmentTransitionResult => ({
  kind: 'blocked',
  code,
});

const applied = (segment: ConversationSegment): SegmentTransitionResult => ({
  kind: 'applied',
  segment,
});

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => (
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
);

const captureOneOfExactDataRecords = (
  value: unknown,
  expectedKeySets: readonly (readonly string[])[],
): Record<string, unknown> | null => {
  if (!isRecord(value)) {
    return null;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value) as unknown as Record<
    PropertyKey,
    PropertyDescriptor
  >;
  const ownKeys = Reflect.ownKeys(descriptors);
  const expectedKeys = expectedKeySets.find((keys) => (
    ownKeys.length === keys.length
    && ownKeys.every((key) => typeof key === 'string' && keys.includes(key))
  ));
  if (
    expectedKeys === undefined
  ) {
    return null;
  }
  const captured: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined
      || !Object.hasOwn(descriptor, 'value')
      || descriptor.get !== undefined
      || descriptor.set !== undefined
    ) {
      return null;
    }
    captured[key] = descriptor.value;
  }
  return captured;
};

const captureExactDataRecord = (
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> | null => captureOneOfExactDataRecords(value, [expectedKeys]);

const captureDenseDataArray = (value: unknown): readonly unknown[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const descriptors = Object.getOwnPropertyDescriptors(value) as unknown as Record<
    PropertyKey,
    PropertyDescriptor
  >;
  const ownKeys = Reflect.ownKeys(descriptors);
  const lengthDescriptor = descriptors.length;
  if (
    lengthDescriptor === undefined
    || !Object.hasOwn(lengthDescriptor, 'value')
    || lengthDescriptor.get !== undefined
    || lengthDescriptor.set !== undefined
    || typeof lengthDescriptor.value !== 'number'
    || !Number.isSafeInteger(lengthDescriptor.value)
    || lengthDescriptor.value < 0
    || ownKeys.some((key) => (
      typeof key === 'symbol'
      || (key !== 'length' && !/^(0|[1-9]\d*)$/u.test(key))
    ))
  ) {
    return null;
  }
  const length = lengthDescriptor.value;
  if (ownKeys.length !== length + 1) {
    return null;
  }
  const captured: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined
      || !Object.hasOwn(descriptor, 'value')
      || descriptor.get !== undefined
      || descriptor.set !== undefined
    ) {
      return null;
    }
    captured.push(descriptor.value);
  }
  return captured;
};

const isPositiveSafeRevision = (value: unknown): value is number => (
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value > 0
);

const parseCanonicalUtcTimestamp = (value: string): number | null => {
  if (!canonicalUtcTimestampPattern.test(value)) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    return null;
  }
  return timestamp;
};

const captureConversationSegment = (value: unknown): ConversationSegment | null => {
  try {
    const captured = captureExactDataRecord(value, conversationSegmentKeys);
    if (captured === null) {
      return null;
    }
    const rawBlockingReasonCodes = captureDenseDataArray(captured.blockingReasonCodes);
    if (
      rawBlockingReasonCodes === null
      || rawBlockingReasonCodes.some((code) => code !== 'forced_close_unresolved')
      || new Set(rawBlockingReasonCodes).size !== rawBlockingReasonCodes.length
    ) {
      return null;
    }
    return {
      tenantId: captured.tenantId as string,
      institutionId: captured.institutionId as string,
      segmentId: captured.segmentId as string,
      conversationId: captured.conversationId as string,
      sequenceNo: captured.sequenceNo as number,
      state: captured.state as ConversationSegmentState,
      currentHandlerId: captured.currentHandlerId as string | null,
      everHumanHandled: captured.everHumanHandled as boolean,
      openedByCustomerMessageId: captured.openedByCustomerMessageId as string,
      openedAt: captured.openedAt as string,
      lastCustomerMessageId: captured.lastCustomerMessageId as string,
      lastCustomerMessageAt: captured.lastCustomerMessageAt as string,
      latestInboundRevision: captured.latestInboundRevision as number,
      waitingAfterCustomerMessageId: captured.waitingAfterCustomerMessageId as string | null,
      waitingAfterCustomerMessageAt: captured.waitingAfterCustomerMessageAt as string | null,
      waitingAfterInboundRevision: captured.waitingAfterInboundRevision as number | null,
      stateChangedAt: captured.stateChangedAt as string,
      closedAt: captured.closedAt as string | null,
      segmentCloseKind: captured.segmentCloseKind as ConversationSegmentCloseKind,
      resolutionState: captured.resolutionState as SegmentResolutionState,
      resolvedAt: captured.resolvedAt as string | null,
      blockingReasonCodes: rawBlockingReasonCodes as readonly SegmentLocalBlockingReasonCode[],
    };
  } catch {
    return null;
  }
};

const hasValidSegmentTimeOrder = (segment: ConversationSegment): boolean => {
  const openedAt = parseCanonicalUtcTimestamp(segment.openedAt);
  const stateChangedAt = parseCanonicalUtcTimestamp(segment.stateChangedAt);
  const lastCustomerMessageAt = parseCanonicalUtcTimestamp(segment.lastCustomerMessageAt);
  if (
    !safeIdentifierPattern.test(segment.tenantId)
    || !safeIdentifierPattern.test(segment.institutionId)
    || !safeIdentifierPattern.test(segment.conversationId)
    || !safeIdentifierPattern.test(segment.segmentId)
    || !safeIdentifierPattern.test(segment.openedByCustomerMessageId)
    || !safeIdentifierPattern.test(segment.lastCustomerMessageId)
    || !isPositiveSafeRevision(segment.latestInboundRevision)
    || openedAt === null
    || stateChangedAt === null
    || lastCustomerMessageAt === null
    || openedAt > stateChangedAt
    || lastCustomerMessageAt < openedAt
    || lastCustomerMessageAt > stateChangedAt
  ) {
    return false;
  }

  const requiresWaitingAnchor = segment.state === 'waiting_customer'
    || (segment.state === 'ai_handling' && segment.everHumanHandled === false);
  if (requiresWaitingAnchor) {
    if (
      segment.waitingAfterCustomerMessageId !== segment.lastCustomerMessageId
      || segment.waitingAfterCustomerMessageAt !== segment.lastCustomerMessageAt
      || segment.waitingAfterInboundRevision !== segment.latestInboundRevision
    ) {
      return false;
    }
  } else if (
    segment.waitingAfterCustomerMessageId !== null
    || segment.waitingAfterCustomerMessageAt !== null
    || segment.waitingAfterInboundRevision !== null
  ) {
    return false;
  }

  if (segment.resolutionState === 'open') {
    if (segment.resolvedAt !== null) {
      return false;
    }
  } else {
    const resolvedAt = segment.resolvedAt === null
      ? null
      : parseCanonicalUtcTimestamp(segment.resolvedAt);
    if (
      resolvedAt === null
      || resolvedAt < openedAt
      || resolvedAt > stateChangedAt
    ) {
      return false;
    }
  }

  if (segment.closedAt === null) {
    return segment.state !== 'closed';
  }

  const closedAt = parseCanonicalUtcTimestamp(segment.closedAt);
  return segment.state === 'closed'
    && closedAt !== null
    && stateChangedAt <= closedAt;
};

const isValidTransitionTime = (segment: ConversationSegment, occurredAt: string): boolean => (
  hasValidSegmentTimeOrder(segment)
  && parseCanonicalUtcTimestamp(occurredAt) !== null
  && Date.parse(occurredAt) >= Date.parse(segment.stateChangedAt)
);

const transition = (
  segment: ConversationSegment,
  occurredAt: string,
  changes: Partial<ConversationSegment>,
): SegmentTransitionResult => {
  if (!isValidTransitionTime(segment, occurredAt)) {
    return blocked('invalid_timestamp');
  }
  return applied({
    ...segment,
    ...changes,
    stateChangedAt: occurredAt,
  });
};

const operatorIsCurrentHandler = (
  segment: ConversationSegment,
  operatorId: string,
): SegmentTransitionResult | null => (
  segment.currentHandlerId === operatorId
    ? null
    : blocked('operator_not_current_handler')
);

export function checkConversationSegmentCanSend(
  segment: Readonly<ConversationSegment>,
): SegmentSendEligibilityResult {
  return segment.state === 'closed'
    ? { kind: 'blocked', code: 'segment_closed' }
    : { kind: 'allowed' };
}

export function requestHumanHandling(
  segment: Readonly<ConversationSegment>,
  input: Readonly<{ occurredAt: string }>,
): SegmentTransitionResult {
  if (segment.state === 'closed') {
    return blocked('segment_closed');
  }
  if (segment.state !== 'ai_handling') {
    return blocked('transition_not_allowed');
  }
  return transition(segment, input.occurredAt, {
    state: 'awaiting_human',
    currentHandlerId: null,
    waitingAfterCustomerMessageId: null,
    waitingAfterCustomerMessageAt: null,
    waitingAfterInboundRevision: null,
  });
}

export function acceptHumanHandling(
  segment: Readonly<ConversationSegment>,
  input: Readonly<{
    operatorId: string;
    occurredAt: string;
    assignment: ActiveAssignmentGuard;
  }>,
): SegmentTransitionResult {
  if (segment.state === 'closed') {
    return blocked('segment_closed');
  }
  if (segment.state !== 'awaiting_human') {
    return blocked('transition_not_allowed');
  }
  if (input.assignment.activeAssignmentCount < 1) {
    return blocked('active_assignment_missing');
  }
  if (input.assignment.activeAssignmentCount !== 1) {
    return blocked('multiple_active_assignments');
  }
  if (
    !safeIdentifierPattern.test(input.operatorId)
    || input.assignment.assigneeId === null
    || !safeIdentifierPattern.test(input.assignment.assigneeId)
  ) {
    return blocked('invalid_identifier');
  }
  if (input.assignment.assigneeId !== input.operatorId) {
    return blocked('operator_not_active_assignee');
  }
  return transition(segment, input.occurredAt, {
    state: 'human_handling',
    currentHandlerId: input.operatorId,
    everHumanHandled: true,
  });
}

export function markWaitingForCustomer(
  segment: Readonly<ConversationSegment>,
  input: Readonly<{ operatorId: string; occurredAt: string }>,
): SegmentTransitionResult {
  if (segment.state === 'closed') {
    return blocked('segment_closed');
  }
  if (segment.state !== 'human_handling') {
    return blocked('transition_not_allowed');
  }
  const handlerFailure = operatorIsCurrentHandler(segment, input.operatorId);
  if (handlerFailure) {
    return handlerFailure;
  }
  return transition(segment, input.occurredAt, {
    state: 'waiting_customer',
    waitingAfterCustomerMessageId: segment.lastCustomerMessageId,
    waitingAfterCustomerMessageAt: segment.lastCustomerMessageAt,
    waitingAfterInboundRevision: segment.latestInboundRevision,
  });
}

type ValidatedInboundCursor = Readonly<{
  readiness: 'ready';
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
  customerMessageId: string;
  lastCustomerMessageAt: string;
  latestInboundRevision: number;
  checkedAt: string;
  validUntil: string;
}>;

type InboundCursorValidationResult =
  | Readonly<{ kind: 'validated'; cursor: ValidatedInboundCursor }>
  | Readonly<{
      kind: 'blocked';
      code: 'inbound_status_unknown' | 'inbound_cursor_invalid' | 'customer_inbound_target_mismatch';
    }>;

const validateCurrentInboundCursor = (
  segment: ConversationSegment,
  rawCursor: unknown,
  decisionAt: string,
): InboundCursorValidationResult => {
  try {
    const ready = captureOneOfExactDataRecords(rawCursor, [
      readyInboundCursorKeys,
      unknownReadinessKeys,
    ]);
    if (ready === null || ready.readiness !== 'ready') {
      return ready?.readiness === 'unknown'
        ? { kind: 'blocked', code: 'inbound_status_unknown' }
        : { kind: 'blocked', code: 'inbound_cursor_invalid' };
    }
    if (
      ready.readiness !== 'ready'
      || typeof ready.tenantId !== 'string'
      || typeof ready.institutionId !== 'string'
      || typeof ready.conversationId !== 'string'
      || typeof ready.segmentId !== 'string'
      || typeof ready.customerMessageId !== 'string'
      || typeof ready.lastCustomerMessageAt !== 'string'
      || typeof ready.checkedAt !== 'string'
      || typeof ready.validUntil !== 'string'
      || !safeIdentifierPattern.test(ready.tenantId)
      || !safeIdentifierPattern.test(ready.institutionId)
      || !safeIdentifierPattern.test(ready.conversationId)
      || !safeIdentifierPattern.test(ready.segmentId)
      || !safeIdentifierPattern.test(ready.customerMessageId)
      || !isPositiveSafeRevision(ready.latestInboundRevision)
      || parseCanonicalUtcTimestamp(ready.lastCustomerMessageAt) === null
      || parseCanonicalUtcTimestamp(ready.checkedAt) === null
      || parseCanonicalUtcTimestamp(ready.validUntil) === null
      || ready.checkedAt < ready.lastCustomerMessageAt
      || ready.checkedAt > decisionAt
      || ready.validUntil < ready.checkedAt
      || ready.validUntil < decisionAt
    ) {
      return { kind: 'blocked', code: 'inbound_cursor_invalid' };
    }
    if (
      ready.tenantId !== segment.tenantId
      || ready.institutionId !== segment.institutionId
      || ready.conversationId !== segment.conversationId
      || ready.segmentId !== segment.segmentId
    ) {
      return { kind: 'blocked', code: 'customer_inbound_target_mismatch' };
    }
    return {
      kind: 'validated',
      cursor: ready as ValidatedInboundCursor,
    };
  } catch {
    return { kind: 'blocked', code: 'inbound_cursor_invalid' };
  }
};

export function resumeHumanHandling(
  segmentValue: Readonly<ConversationSegment>,
  input: Readonly<{
    operatorId: string;
    occurredAt: string;
    customerInbound: SegmentCustomerInboundFact;
    currentInboundCursor: SegmentCurrentInboundCursor;
  }>,
): SegmentTransitionResult {
  try {
    const segment = captureConversationSegment(segmentValue);
    if (segment === null) {
      return blocked('customer_inbound_invalid');
    }
    if (segment.state === 'closed') {
      return blocked('segment_closed');
    }
    if (segment.state !== 'waiting_customer') {
      return blocked('transition_not_allowed');
    }
    const capturedInput = captureExactDataRecord(input, resumeHumanInputKeys);
    if (
      capturedInput === null
      || typeof capturedInput.operatorId !== 'string'
      || typeof capturedInput.occurredAt !== 'string'
    ) {
      return blocked('customer_inbound_invalid');
    }
    const handlerFailure = operatorIsCurrentHandler(segment, capturedInput.operatorId);
    if (handlerFailure) {
      return handlerFailure;
    }
    if (capturedInput.customerInbound === undefined || capturedInput.customerInbound === null) {
      return blocked('customer_inbound_required');
    }
    const inbound = captureExactDataRecord(
      capturedInput.customerInbound,
      customerInboundFactKeys,
    );
    if (inbound === null) {
      return blocked('customer_inbound_invalid');
    }
    if (
      inbound.tenantId !== segment.tenantId
      || inbound.institutionId !== segment.institutionId
      || inbound.conversationId !== segment.conversationId
      || inbound.segmentId !== segment.segmentId
    ) {
      return blocked('customer_inbound_target_mismatch');
    }
    if (
      inbound.direction !== 'inbound'
      || inbound.senderKind !== 'customer'
      || typeof inbound.tenantId !== 'string'
      || typeof inbound.institutionId !== 'string'
      || typeof inbound.messageId !== 'string'
      || !safeIdentifierPattern.test(inbound.tenantId)
      || !safeIdentifierPattern.test(inbound.institutionId)
      || !safeIdentifierPattern.test(inbound.messageId)
      || !isPositiveSafeRevision(inbound.inboundRevision)
      || typeof inbound.occurredAt !== 'string'
      || typeof inbound.receivedAt !== 'string'
      || parseCanonicalUtcTimestamp(inbound.occurredAt) === null
      || parseCanonicalUtcTimestamp(inbound.receivedAt) === null
    ) {
      return blocked('customer_inbound_invalid');
    }
    if (
      segment.waitingAfterCustomerMessageId === null
      || segment.waitingAfterCustomerMessageAt === null
      || segment.waitingAfterInboundRevision === null
      || inbound.messageId === segment.waitingAfterCustomerMessageId
      || inbound.inboundRevision <= segment.waitingAfterInboundRevision
      || Date.parse(inbound.occurredAt) <= Date.parse(segment.waitingAfterCustomerMessageAt)
      || Date.parse(inbound.occurredAt) <= Date.parse(segment.stateChangedAt)
      || Date.parse(inbound.receivedAt) < Date.parse(inbound.occurredAt)
      || parseCanonicalUtcTimestamp(capturedInput.occurredAt) === null
      || Date.parse(capturedInput.occurredAt) < Date.parse(inbound.receivedAt)
    ) {
      return blocked('customer_inbound_not_new');
    }
    const cursorResult = validateCurrentInboundCursor(
      segment,
      capturedInput.currentInboundCursor,
      capturedInput.occurredAt,
    );
    if (cursorResult.kind === 'blocked') {
      return blocked(cursorResult.code);
    }
    const cursor = cursorResult.cursor;
    if (
      cursor.customerMessageId !== inbound.messageId
      || cursor.lastCustomerMessageAt !== inbound.occurredAt
      || cursor.latestInboundRevision !== inbound.inboundRevision
      || cursor.checkedAt < inbound.receivedAt
    ) {
      return blocked('customer_inbound_not_new');
    }
    return transition(segment, capturedInput.occurredAt, {
      state: 'human_handling',
      lastCustomerMessageId: inbound.messageId,
      lastCustomerMessageAt: inbound.occurredAt,
      latestInboundRevision: inbound.inboundRevision,
      waitingAfterCustomerMessageId: null,
      waitingAfterCustomerMessageAt: null,
      waitingAfterInboundRevision: null,
    });
  } catch {
    return blocked('customer_inbound_invalid');
  }
}

export function returnSegmentToAi(
  segment: Readonly<ConversationSegment>,
  input: SegmentReturnToAiInput,
): SegmentTransitionResult {
  if (segment.state === 'closed') {
    return blocked('segment_closed');
  }
  if (segment.state !== 'human_handling' && segment.state !== 'waiting_customer') {
    return blocked('transition_not_allowed');
  }
  const handlerFailure = operatorIsCurrentHandler(segment, input.operatorId);
  if (handlerFailure) {
    return handlerFailure;
  }
  if (input.riskState !== 'none') {
    return blocked('risk_not_none');
  }
  if (input.hasBlockingReason || segment.blockingReasonCodes.length > 0) {
    return blocked('blocking_reason_present');
  }
  if (input.hasUnconfirmedBusinessAction) {
    return blocked('unconfirmed_business_action');
  }
  if (input.outboundState === 'pending') {
    return blocked('outbound_pending');
  }
  if (input.outboundState === 'unknown') {
    return blocked('outbound_unknown');
  }
  if (input.aiReadiness !== 'ready') {
    return blocked('ai_not_ready');
  }
  if (input.knowledgeReadiness !== 'ready') {
    return blocked('knowledge_not_ready');
  }
  if (input.sensitiveAuthorizationReadiness !== 'ready') {
    return blocked('sensitive_authorization_not_ready');
  }
  if (!input.messageTypeAllowed) {
    return blocked('message_type_not_allowed');
  }
  if (!input.institutionPolicyAllowsAi) {
    return blocked('institution_policy_not_allowed');
  }
  return transition(segment, input.occurredAt, {
    state: 'ai_handling',
    currentHandlerId: null,
    everHumanHandled: true,
    waitingAfterCustomerMessageId: null,
    waitingAfterCustomerMessageAt: null,
    waitingAfterInboundRevision: null,
  });
}

export function autoCloseConversationSegment(
  segmentValue: Readonly<ConversationSegment>,
  input: SegmentAutoCloseInput,
): SegmentTransitionResult {
  try {
    const segment = captureConversationSegment(segmentValue);
    if (segment === null) {
      return blocked('inbound_cursor_invalid');
    }
    if (segment.state === 'closed') {
      return blocked('segment_closed');
    }
    if (segment.state !== 'ai_handling') {
      return blocked('transition_not_allowed');
    }
    if (segment.everHumanHandled) {
      return blocked('ever_human_handled');
    }
    const capturedInput = captureExactDataRecord(input, autoCloseInputKeys);
    if (capturedInput === null || typeof capturedInput.occurredAt !== 'string') {
      return blocked('inbound_cursor_invalid');
    }
    if (!isValidTransitionTime(segment, capturedInput.occurredAt)) {
      return blocked('invalid_timestamp');
    }
    const anchor = captureExactDataRecord(
      capturedInput.windowAnchor,
      autoCloseWindowAnchorKeys,
    );
    if (anchor === null) {
      return blocked('inbound_cursor_invalid');
    }
    if (
      typeof anchor.tenantId !== 'string'
      || typeof anchor.institutionId !== 'string'
      || typeof anchor.conversationId !== 'string'
      || typeof anchor.segmentId !== 'string'
      || typeof anchor.customerMessageId !== 'string'
      || !safeIdentifierPattern.test(anchor.tenantId)
      || !safeIdentifierPattern.test(anchor.institutionId)
      || !safeIdentifierPattern.test(anchor.conversationId)
      || !safeIdentifierPattern.test(anchor.segmentId)
      || !safeIdentifierPattern.test(anchor.customerMessageId)
      || !isPositiveSafeRevision(anchor.latestInboundRevision)
      || typeof anchor.lastCustomerMessageAt !== 'string'
      || typeof anchor.waitWindowEndsAt !== 'string'
      || parseCanonicalUtcTimestamp(anchor.lastCustomerMessageAt) === null
      || parseCanonicalUtcTimestamp(anchor.waitWindowEndsAt) === null
      || Date.parse(anchor.lastCustomerMessageAt) < Date.parse(segment.openedAt)
      || Date.parse(anchor.waitWindowEndsAt) < Date.parse(anchor.lastCustomerMessageAt)
    ) {
      return blocked('invalid_timestamp');
    }
    if (
      anchor.tenantId !== segment.tenantId
      || anchor.institutionId !== segment.institutionId
      || anchor.conversationId !== segment.conversationId
      || anchor.segmentId !== segment.segmentId
    ) {
      return blocked('customer_inbound_target_mismatch');
    }
    if (
      anchor.customerMessageId !== segment.lastCustomerMessageId
      || anchor.lastCustomerMessageAt !== segment.lastCustomerMessageAt
      || anchor.latestInboundRevision !== segment.latestInboundRevision
      || anchor.customerMessageId !== segment.waitingAfterCustomerMessageId
      || anchor.lastCustomerMessageAt !== segment.waitingAfterCustomerMessageAt
      || anchor.latestInboundRevision !== segment.waitingAfterInboundRevision
    ) {
      return blocked('inbound_cursor_invalid');
    }
    const cursorResult = validateCurrentInboundCursor(
      segment,
      capturedInput.currentInboundCursor,
      capturedInput.occurredAt,
    );
    if (cursorResult.kind === 'blocked') {
      return blocked(cursorResult.code);
    }
    const cursor = cursorResult.cursor;
    if (cursor.latestInboundRevision > anchor.latestInboundRevision) {
      return blocked('new_inbound_during_wait');
    }
    if (
      cursor.tenantId !== anchor.tenantId
      || cursor.institutionId !== anchor.institutionId
      || cursor.conversationId !== anchor.conversationId
      || cursor.segmentId !== anchor.segmentId
      || cursor.latestInboundRevision < anchor.latestInboundRevision
      || cursor.customerMessageId !== anchor.customerMessageId
      || cursor.lastCustomerMessageAt !== anchor.lastCustomerMessageAt
    ) {
      return blocked('inbound_cursor_invalid');
    }
    if (capturedInput.riskState !== 'none') {
      return blocked('risk_not_none');
    }
    if (capturedInput.hasBlockingReason !== false || segment.blockingReasonCodes.length > 0) {
      return blocked('blocking_reason_present');
    }
    if (capturedInput.outboundState === 'pending') {
      return blocked('outbound_pending');
    }
    if (capturedInput.outboundState !== 'clear') {
      return blocked('outbound_unknown');
    }
    if (Date.parse(capturedInput.occurredAt) < Date.parse(anchor.waitWindowEndsAt)) {
      return blocked('waiting_window_not_elapsed');
    }
    if (capturedInput.channelAllowsAutoClose !== true) {
      return blocked('channel_auto_close_not_allowed');
    }
    return transition(segment, capturedInput.occurredAt, {
      state: 'closed',
      closedAt: capturedInput.occurredAt,
      segmentCloseKind: 'normal',
      waitingAfterCustomerMessageId: null,
      waitingAfterCustomerMessageAt: null,
      waitingAfterInboundRevision: null,
    });
  } catch {
    return blocked('inbound_cursor_invalid');
  }
}

export function closeConversationSegmentManually(
  segmentValue: Readonly<ConversationSegment>,
  input: SegmentManualCloseInput,
): SegmentTransitionResult {
  try {
    const segment = captureConversationSegment(segmentValue);
    if (segment === null) {
      return blocked('risk_status_unknown');
    }
    if (segment.state === 'closed') {
      return blocked('segment_closed');
    }
    if (segment.state !== 'human_handling' && segment.state !== 'waiting_customer') {
      return blocked('transition_not_allowed');
    }
    const capturedInput = captureExactDataRecord(input, manualCloseInputKeys);
    if (
      capturedInput === null
      || typeof capturedInput.operatorId !== 'string'
      || typeof capturedInput.occurredAt !== 'string'
    ) {
      return blocked('close_result_invalid');
    }
    const handlerFailure = operatorIsCurrentHandler(segment, capturedInput.operatorId);
    if (handlerFailure) {
      return handlerFailure;
    }
    if (
      typeof capturedInput.closeResultCode !== 'string'
      || !segmentManualCloseResultCodes.includes(
        capturedInput.closeResultCode as SegmentManualCloseResultCode,
      )
    ) {
      return blocked('close_result_invalid');
    }
    if (!isValidTransitionTime(segment, capturedInput.occurredAt)) {
      return blocked('invalid_timestamp');
    }
    const expectedCloseResult = segment.resolutionState === 'resolved'
      ? 'resolved'
      : 'unresolved';
    if (capturedInput.closeResultCode !== expectedCloseResult) {
      return blocked('close_result_mismatch');
    }

    const blockingSnapshot = captureOneOfExactDataRecords(
      capturedInput.blockingSnapshot,
      [readyBlockingSnapshotKeys, unknownReadinessKeys],
    );
    if (blockingSnapshot === null || blockingSnapshot.readiness !== 'ready') {
      return blocked('blocking_status_unknown');
    }
    if (
      blockingSnapshot.readiness !== 'ready'
      || (blockingSnapshot.state !== 'clear' && blockingSnapshot.state !== 'present')
      || typeof blockingSnapshot.tenantId !== 'string'
      || typeof blockingSnapshot.institutionId !== 'string'
      || typeof blockingSnapshot.conversationId !== 'string'
      || typeof blockingSnapshot.segmentId !== 'string'
      || typeof blockingSnapshot.checkedAt !== 'string'
      || typeof blockingSnapshot.validUntil !== 'string'
      || blockingSnapshot.tenantId !== segment.tenantId
      || blockingSnapshot.institutionId !== segment.institutionId
      || blockingSnapshot.conversationId !== segment.conversationId
      || blockingSnapshot.segmentId !== segment.segmentId
      || parseCanonicalUtcTimestamp(blockingSnapshot.checkedAt) === null
      || parseCanonicalUtcTimestamp(blockingSnapshot.validUntil) === null
      || blockingSnapshot.checkedAt < segment.stateChangedAt
      || blockingSnapshot.checkedAt > capturedInput.occurredAt
      || blockingSnapshot.validUntil < blockingSnapshot.checkedAt
      || blockingSnapshot.validUntil < capturedInput.occurredAt
    ) {
      return blocked('blocking_status_unknown');
    }
    if (
      blockingSnapshot.state === 'present'
      || segment.blockingReasonCodes.length > 0
    ) {
      return blocked('blocking_reason_present');
    }

    const riskSet = captureOneOfExactDataRecords(capturedInput.riskSet, [
      readyRiskSetKeys,
      unknownReadinessKeys,
    ]);
    if (riskSet === null || riskSet.readiness !== 'ready') {
      return blocked('risk_status_unknown');
    }
    if (
      riskSet.readiness !== 'ready'
      || typeof riskSet.tenantId !== 'string'
      || typeof riskSet.institutionId !== 'string'
      || typeof riskSet.conversationId !== 'string'
      || typeof riskSet.segmentId !== 'string'
      || typeof riskSet.checkedAt !== 'string'
      || typeof riskSet.validUntil !== 'string'
      || riskSet.tenantId !== segment.tenantId
      || riskSet.institutionId !== segment.institutionId
      || riskSet.conversationId !== segment.conversationId
      || riskSet.segmentId !== segment.segmentId
      || parseCanonicalUtcTimestamp(riskSet.checkedAt) === null
      || parseCanonicalUtcTimestamp(riskSet.validUntil) === null
      || riskSet.checkedAt < segment.stateChangedAt
      || riskSet.checkedAt > capturedInput.occurredAt
      || riskSet.validUntil < riskSet.checkedAt
      || riskSet.validUntil < capturedInput.occurredAt
      || !Array.isArray(riskSet.histories)
      || !Array.isArray(riskSet.currentClinicalClosureChecks)
    ) {
      return blocked('risk_status_unknown');
    }
    const riskGuard = checkConversationRiskSetForNormalClose(
      riskSet.histories as readonly ConversationRiskHistory[],
      {
        tenantId: segment.tenantId,
        institutionId: segment.institutionId,
        conversationId: segment.conversationId,
        segmentId: segment.segmentId,
        decisionAt: capturedInput.occurredAt,
        currentClinicalClosureChecks: riskSet.currentClinicalClosureChecks as readonly CurrentClinicalClosureCheck[],
      },
    );
    if (riskGuard.kind === 'blocked') {
      return blocked(riskGuard.code);
    }
    return applied({
      ...segment,
      state: 'closed',
      stateChangedAt: capturedInput.occurredAt,
      closedAt: capturedInput.occurredAt,
      segmentCloseKind: 'normal',
      waitingAfterCustomerMessageId: null,
      waitingAfterCustomerMessageAt: null,
      waitingAfterInboundRevision: null,
    });
  } catch {
    return blocked('risk_status_unknown');
  }
}

export function forceCloseConversationSegment(
  segment: Readonly<ConversationSegment>,
  input: Readonly<{
    forceCloseAuthorized: boolean;
    occurredAt: string;
  }>,
): SegmentTransitionResult {
  if (segment.state === 'closed') {
    return blocked('segment_closed');
  }
  if (!input.forceCloseAuthorized) {
    return blocked('force_close_not_authorized');
  }
  const nextBlockingReasonCodes = segment.blockingReasonCodes.includes('forced_close_unresolved')
    ? [...segment.blockingReasonCodes]
    : [...segment.blockingReasonCodes, 'forced_close_unresolved' as const];
  return transition(segment, input.occurredAt, {
    state: 'closed',
    closedAt: input.occurredAt,
    segmentCloseKind: 'forced',
    resolutionState: 'open',
    resolvedAt: null,
    blockingReasonCodes: nextBlockingReasonCodes,
    waitingAfterCustomerMessageId: null,
    waitingAfterCustomerMessageAt: null,
    waitingAfterInboundRevision: null,
  });
}

export function openNextSegmentFromCustomerInbound(
  closedSegment: Readonly<ConversationSegment>,
  input: Readonly<{
    segmentId: string;
    customerMessageId: string;
    inboundRevision: number;
    occurredAt: string;
  }>,
): SegmentTransitionResult {
  if (closedSegment.state !== 'closed') {
    return blocked('segment_not_closed');
  }
  if (
    !safeIdentifierPattern.test(input.segmentId)
    || !safeIdentifierPattern.test(input.customerMessageId)
    || !isPositiveSafeRevision(input.inboundRevision)
    || input.segmentId === closedSegment.segmentId
  ) {
    return blocked('invalid_identifier');
  }
  if (
    !Number.isSafeInteger(closedSegment.sequenceNo)
    || closedSegment.sequenceNo < 1
    || closedSegment.sequenceNo >= Number.MAX_SAFE_INTEGER
  ) {
    return blocked('sequence_exhausted');
  }
  if (
    !hasValidSegmentTimeOrder(closedSegment)
    || closedSegment.closedAt === null
    || parseCanonicalUtcTimestamp(input.occurredAt) === null
    || Date.parse(input.occurredAt) < Date.parse(closedSegment.closedAt)
  ) {
    return blocked('invalid_timestamp');
  }
  return applied({
    tenantId: closedSegment.tenantId,
    institutionId: closedSegment.institutionId,
    segmentId: input.segmentId,
    conversationId: closedSegment.conversationId,
    sequenceNo: closedSegment.sequenceNo + 1,
    state: 'ai_handling',
    currentHandlerId: null,
    everHumanHandled: false,
    openedByCustomerMessageId: input.customerMessageId,
    openedAt: input.occurredAt,
    lastCustomerMessageId: input.customerMessageId,
    lastCustomerMessageAt: input.occurredAt,
    latestInboundRevision: input.inboundRevision,
    waitingAfterCustomerMessageId: input.customerMessageId,
    waitingAfterCustomerMessageAt: input.occurredAt,
    waitingAfterInboundRevision: input.inboundRevision,
    stateChangedAt: input.occurredAt,
    closedAt: null,
    segmentCloseKind: 'open',
    resolutionState: 'open',
    resolvedAt: null,
    blockingReasonCodes: [],
  });
}
