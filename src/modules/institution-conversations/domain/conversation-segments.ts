import {
  projectCompleteConversationRiskHistories,
  type ConversationRiskHistory,
  type ConversationRiskTarget,
  type CurrentClinicalClosureCheck,
  type ProjectedRiskSetEntry,
} from '@/modules/institution-conversations/domain/conversation-risks';

export const conversationSegmentStates = [
  'ai_handling',
  'awaiting_human',
  'human_handling',
  'waiting_customer',
  'closed',
] as const;

export const conversationSegmentCloseKinds = ['open', 'normal', 'forced'] as const;
export const segmentLocalBlockingReasonCodes = ['forced_close_unresolved'] as const;

export type ConversationSegmentState = (typeof conversationSegmentStates)[number];
export type ConversationSegmentCloseKind = (typeof conversationSegmentCloseKinds)[number];
export type SegmentLocalBlockingReasonCode = (typeof segmentLocalBlockingReasonCodes)[number];
export type SegmentResolutionState = 'open' | 'resolved';
export type SegmentGuardReadiness = 'ready' | 'not_ready' | 'unknown';
export type SegmentOutboundGuardState = 'clear' | 'pending' | 'unknown';
export type SegmentNewInboundState = 'none' | 'present' | 'unknown';

export type ConversationSegment = Readonly<{
  segmentId: string;
  conversationId: string;
  sequenceNo: number;
  state: ConversationSegmentState;
  currentHandlerId: string | null;
  everHumanHandled: boolean;
  openedByCustomerMessageId: string;
  openedAt: string;
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
  | 'risk_guard_invalid'
  | 'risk_not_none'
  | 'risk_not_resolved'
  | 'clinical_closure_check_required'
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
  | 'force_close_not_authorized'
  | 'close_result_invalid'
  | 'invalid_timestamp'
  | 'invalid_identifier'
  | 'sequence_exhausted';

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
  riskTarget: ConversationRiskTarget;
  completeRiskHistories: readonly ConversationRiskHistory[];
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
  riskTarget: ConversationRiskTarget;
  completeRiskHistories: readonly ConversationRiskHistory[];
  hasBlockingReason: boolean;
  outboundState: SegmentOutboundGuardState;
  waitWindowEndsAt: string;
  channelAllowsAutoClose: boolean;
  newInboundState: SegmentNewInboundState;
}>;

export type SegmentManualCloseResolution =
  | Readonly<{
      kind: 'unresolved';
    }>
  | Readonly<{
      kind: 'resolved';
      resolvedAt: string;
    }>;

export type SegmentManualCloseInput = Readonly<{
  operatorId: string;
  occurredAt: string;
  resolution: SegmentManualCloseResolution;
  riskTarget: ConversationRiskTarget;
  completeRiskHistories: readonly ConversationRiskHistory[];
  currentClinicalClosureChecks: readonly CurrentClinicalClosureCheck[];
}>;

const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const canonicalUtcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const returnToAiInputKeys = [
  'operatorId',
  'occurredAt',
  'riskTarget',
  'completeRiskHistories',
  'hasBlockingReason',
  'hasUnconfirmedBusinessAction',
  'outboundState',
  'aiReadiness',
  'knowledgeReadiness',
  'sensitiveAuthorizationReadiness',
  'messageTypeAllowed',
  'institutionPolicyAllowsAi',
] as const;
const autoCloseInputKeys = [
  'occurredAt',
  'riskTarget',
  'completeRiskHistories',
  'hasBlockingReason',
  'outboundState',
  'waitWindowEndsAt',
  'channelAllowsAutoClose',
  'newInboundState',
] as const;
const manualCloseInputKeys = [
  'operatorId',
  'occurredAt',
  'resolution',
  'riskTarget',
  'completeRiskHistories',
  'currentClinicalClosureChecks',
] as const;

const deepFreeze = <T>(value: T): T => {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && 'value' in descriptor) {
      deepFreeze(descriptor.value);
    }
  }
  return Object.freeze(value);
};

type CapturedSegmentInput = Readonly<Record<string, unknown>>;

const captureExactSegmentInput = (
  raw: unknown,
  expectedKeys: readonly string[],
): CapturedSegmentInput | null => {
  try {
    if (
      typeof raw !== 'object'
      || raw === null
      || Array.isArray(raw)
      || Object.getPrototypeOf(raw) !== Object.prototype
    ) {
      return null;
    }
    const ownKeys = Reflect.ownKeys(raw);
    if (
      ownKeys.length !== expectedKeys.length
      || ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const values: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor)) {
        return null;
      }
      values[key] = descriptor.value;
    }
    return values;
  } catch {
    return null;
  }
};

const isStructuredCloneable = (raw: unknown): boolean => {
  try {
    structuredClone(raw);
    return true;
  } catch {
    return false;
  }
};

const isReturnToAiInputValueSetValid = (values: CapturedSegmentInput): boolean => (
  typeof values.operatorId === 'string'
  && safeIdentifierPattern.test(values.operatorId)
  && typeof values.hasBlockingReason === 'boolean'
  && typeof values.hasUnconfirmedBusinessAction === 'boolean'
  && ['clear', 'pending', 'unknown'].includes(values.outboundState as string)
  && ['ready', 'not_ready', 'unknown'].includes(values.aiReadiness as string)
  && ['ready', 'not_ready', 'unknown'].includes(values.knowledgeReadiness as string)
  && ['ready', 'not_ready', 'unknown'].includes(
    values.sensitiveAuthorizationReadiness as string,
  )
  && typeof values.messageTypeAllowed === 'boolean'
  && typeof values.institutionPolicyAllowsAi === 'boolean'
);

const isAutoCloseInputValueSetValid = (values: CapturedSegmentInput): boolean => (
  typeof values.hasBlockingReason === 'boolean'
  && ['clear', 'pending', 'unknown'].includes(values.outboundState as string)
  && typeof values.waitWindowEndsAt === 'string'
  && typeof values.channelAllowsAutoClose === 'boolean'
  && ['none', 'present', 'unknown'].includes(values.newInboundState as string)
);

const isManualCloseInputValueSetValid = (values: CapturedSegmentInput): boolean => (
  typeof values.operatorId === 'string'
  && safeIdentifierPattern.test(values.operatorId)
);

const blocked = (code: SegmentTransitionBlockCode): SegmentTransitionResult => deepFreeze({
  kind: 'blocked',
  code,
});

const applied = (segment: ConversationSegment): SegmentTransitionResult => deepFreeze({
  kind: 'applied',
  segment: {
    ...segment,
    blockingReasonCodes: [...segment.blockingReasonCodes],
  },
});

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

const hasValidSegmentTimeOrder = (segment: ConversationSegment): boolean => {
  const openedAt = parseCanonicalUtcTimestamp(segment.openedAt);
  const stateChangedAt = parseCanonicalUtcTimestamp(segment.stateChangedAt);
  if (openedAt === null || stateChangedAt === null || openedAt > stateChangedAt) {
    return false;
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

const projectSegmentRiskSet = (
  segment: Readonly<ConversationSegment>,
  values: CapturedSegmentInput,
  rawChecks: unknown,
): readonly ProjectedRiskSetEntry[] | null => {
  const result = projectCompleteConversationRiskHistories(
    values.completeRiskHistories,
    values.riskTarget,
    rawChecks,
    values.occurredAt,
  );
  if (
    result.kind === 'blocked'
    || result.projection.conversationId !== segment.conversationId
    || result.projection.segmentId !== segment.segmentId
  ) {
    return null;
  }
  return result.projection.risks;
};

const parseManualCloseResolution = (raw: unknown): SegmentManualCloseResolution | null => {
  const unresolved = captureExactSegmentInput(raw, ['kind']);
  if (unresolved?.kind === 'unresolved' && isStructuredCloneable(raw)) {
    return { kind: 'unresolved' };
  }
  const resolved = captureExactSegmentInput(raw, ['kind', 'resolvedAt']);
  if (
    resolved?.kind === 'resolved'
    && typeof resolved.resolvedAt === 'string'
    && isStructuredCloneable(raw)
  ) {
    return { kind: 'resolved', resolvedAt: resolved.resolvedAt };
  }
  return null;
};

export function checkConversationSegmentCanSend(
  segment: Readonly<ConversationSegment>,
): SegmentSendEligibilityResult {
  return deepFreeze(segment.state === 'closed'
    ? { kind: 'blocked', code: 'segment_closed' }
    : { kind: 'allowed' });
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
  return transition(segment, input.occurredAt, { state: 'waiting_customer' });
}

export function resumeHumanHandling(
  segment: Readonly<ConversationSegment>,
  input: Readonly<{ operatorId: string; occurredAt: string }>,
): SegmentTransitionResult {
  if (segment.state === 'closed') {
    return blocked('segment_closed');
  }
  if (segment.state !== 'waiting_customer') {
    return blocked('transition_not_allowed');
  }
  const handlerFailure = operatorIsCurrentHandler(segment, input.operatorId);
  if (handlerFailure) {
    return handlerFailure;
  }
  return transition(segment, input.occurredAt, { state: 'human_handling' });
}

export function returnSegmentToAi(
  segment: Readonly<ConversationSegment>,
  input: SegmentReturnToAiInput,
): SegmentTransitionResult {
  const values = captureExactSegmentInput(input, returnToAiInputKeys);
  if (!values) {
    return blocked('risk_guard_invalid');
  }
  const risks = projectSegmentRiskSet(segment, values, []);
  if (
    risks === null
    || !isReturnToAiInputValueSetValid(values)
    || !isStructuredCloneable(input)
  ) {
    return blocked('risk_guard_invalid');
  }
  if (segment.state === 'closed') {
    return blocked('segment_closed');
  }
  if (segment.state !== 'human_handling' && segment.state !== 'waiting_customer') {
    return blocked('transition_not_allowed');
  }
  const handlerFailure = operatorIsCurrentHandler(segment, values.operatorId as string);
  if (handlerFailure) {
    return handlerFailure;
  }
  if (risks.length > 0) {
    return blocked('risk_not_none');
  }
  if (values.hasBlockingReason === true || segment.blockingReasonCodes.length > 0) {
    return blocked('blocking_reason_present');
  }
  if (values.hasUnconfirmedBusinessAction === true) {
    return blocked('unconfirmed_business_action');
  }
  if (values.outboundState === 'pending') {
    return blocked('outbound_pending');
  }
  if (values.outboundState === 'unknown') {
    return blocked('outbound_unknown');
  }
  if (values.aiReadiness !== 'ready') {
    return blocked('ai_not_ready');
  }
  if (values.knowledgeReadiness !== 'ready') {
    return blocked('knowledge_not_ready');
  }
  if (values.sensitiveAuthorizationReadiness !== 'ready') {
    return blocked('sensitive_authorization_not_ready');
  }
  if (values.messageTypeAllowed !== true) {
    return blocked('message_type_not_allowed');
  }
  if (values.institutionPolicyAllowsAi !== true) {
    return blocked('institution_policy_not_allowed');
  }
  return transition(segment, values.occurredAt as string, {
    state: 'ai_handling',
    currentHandlerId: null,
    everHumanHandled: true,
  });
}

export function autoCloseConversationSegment(
  segment: Readonly<ConversationSegment>,
  input: SegmentAutoCloseInput,
): SegmentTransitionResult {
  const values = captureExactSegmentInput(input, autoCloseInputKeys);
  if (!values) {
    return blocked('risk_guard_invalid');
  }
  const risks = projectSegmentRiskSet(segment, values, []);
  if (
    risks === null
    || !isAutoCloseInputValueSetValid(values)
    || !isStructuredCloneable(input)
  ) {
    return blocked('risk_guard_invalid');
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
  if (
    !isValidTransitionTime(segment, values.occurredAt as string)
    || parseCanonicalUtcTimestamp(values.waitWindowEndsAt as string) === null
  ) {
    return blocked('invalid_timestamp');
  }
  if (risks.length > 0) {
    return blocked('risk_not_none');
  }
  if (values.hasBlockingReason === true || segment.blockingReasonCodes.length > 0) {
    return blocked('blocking_reason_present');
  }
  if (values.outboundState === 'pending') {
    return blocked('outbound_pending');
  }
  if (values.outboundState === 'unknown') {
    return blocked('outbound_unknown');
  }
  if (Date.parse(values.occurredAt as string) < Date.parse(values.waitWindowEndsAt as string)) {
    return blocked('waiting_window_not_elapsed');
  }
  if (values.channelAllowsAutoClose !== true) {
    return blocked('channel_auto_close_not_allowed');
  }
  if (values.newInboundState === 'present') {
    return blocked('new_inbound_during_wait');
  }
  if (values.newInboundState === 'unknown') {
    return blocked('inbound_status_unknown');
  }
  return transition(segment, values.occurredAt as string, {
    state: 'closed',
    closedAt: values.occurredAt as string,
    segmentCloseKind: 'normal',
    resolutionState: 'open',
    resolvedAt: null,
  });
}

export function closeConversationSegmentManually(
  segment: Readonly<ConversationSegment>,
  input: SegmentManualCloseInput,
): SegmentTransitionResult {
  const values = captureExactSegmentInput(input, manualCloseInputKeys);
  if (!values) {
    return blocked('risk_guard_invalid');
  }
  const risks = projectSegmentRiskSet(
    segment,
    values,
    values.currentClinicalClosureChecks,
  );
  if (risks === null) {
    return blocked('risk_guard_invalid');
  }
  if (!isManualCloseInputValueSetValid(values)) {
    return blocked('risk_guard_invalid');
  }
  const resolution = parseManualCloseResolution(values.resolution);
  if (!resolution) {
    return blocked('close_result_invalid');
  }
  if (!isStructuredCloneable(input)) {
    return blocked('risk_guard_invalid');
  }
  if (segment.state === 'closed') {
    return blocked('segment_closed');
  }
  if (segment.state !== 'human_handling' && segment.state !== 'waiting_customer') {
    return blocked('transition_not_allowed');
  }
  const handlerFailure = operatorIsCurrentHandler(segment, values.operatorId as string);
  if (handlerFailure) {
    return handlerFailure;
  }
  if (risks.some((risk) => risk.state !== 'resolved')) {
    return blocked('risk_not_resolved');
  }
  if (risks.some((risk) => (
    risk.state === 'resolved'
    && risk.riskDomain === 'clinical'
    && risk.clinicalClosureCheckState !== 'current'
  ))) {
    return blocked('clinical_closure_check_required');
  }
  if (!isValidTransitionTime(segment, values.occurredAt as string)) {
    return blocked('invalid_timestamp');
  }
  if (
    resolution.kind === 'resolved'
    && (
      parseCanonicalUtcTimestamp(resolution.resolvedAt) === null
      || Date.parse(resolution.resolvedAt) < Date.parse(segment.openedAt)
      || Date.parse(resolution.resolvedAt) > Date.parse(values.occurredAt as string)
    )
  ) {
    return blocked('invalid_timestamp');
  }
  return applied({
    ...segment,
    state: 'closed',
    stateChangedAt: values.occurredAt as string,
    closedAt: values.occurredAt as string,
    segmentCloseKind: 'normal',
    resolutionState: resolution.kind === 'resolved' ? 'resolved' : 'open',
    resolvedAt: resolution.kind === 'resolved' ? resolution.resolvedAt : null,
  });
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
  });
}

export function openNextSegmentFromCustomerInbound(
  closedSegment: Readonly<ConversationSegment>,
  input: Readonly<{
    segmentId: string;
    customerMessageId: string;
    occurredAt: string;
  }>,
): SegmentTransitionResult {
  if (closedSegment.state !== 'closed') {
    return blocked('segment_not_closed');
  }
  if (
    !safeIdentifierPattern.test(input.segmentId)
    || !safeIdentifierPattern.test(input.customerMessageId)
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
    segmentId: input.segmentId,
    conversationId: closedSegment.conversationId,
    sequenceNo: closedSegment.sequenceNo + 1,
    state: 'ai_handling',
    currentHandlerId: null,
    everHumanHandled: false,
    openedByCustomerMessageId: input.customerMessageId,
    openedAt: input.occurredAt,
    stateChangedAt: input.occurredAt,
    closedAt: null,
    segmentCloseKind: 'open',
    resolutionState: 'open',
    resolvedAt: null,
    blockingReasonCodes: [],
  });
}
