import { types as nodeUtilTypes } from 'node:util';

import type { CustomerReferenceV1 } from '@/modules/institution-contracts/v1/customer';
import type {
  ConversationSegment,
  SegmentCustomerInboundFact,
} from '@/modules/institution-conversations/domain/conversation-segments';

export const conversationRootIdentityStates = Object.freeze([
  'matched',
  'pending_review',
  'unmatched',
  'conflict',
] as const);

export const conversationIdentityReviewStates = Object.freeze([
  'pending_review',
  'awaiting_customer_creation',
  'conflict',
  'matched',
  'rejected',
  'withdrawn',
  'expired',
  'revoked',
] as const);

export type ConversationRootIdentityState =
  (typeof conversationRootIdentityStates)[number];
export type ConversationIdentityReviewState =
  (typeof conversationIdentityReviewStates)[number];

export type ConversationRootScope = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

export type ConversationConnectionBinding = Readonly<{
  tenantId: string;
  institutionId: string;
  channelType: string;
  serviceProviderType: string;
  connectionInstanceId: string;
  channelConversationRef: string;
}>;

export type ConversationV1 = Readonly<{
  conversationId: string;
  tenantId: string;
  institutionId: string;
  channelType: string;
  serviceProviderType: string;
  connectionInstanceId: string;
  channelConversationRef: string;
  customerReference: CustomerReferenceV1 | null;
  identityState: ConversationRootIdentityState;
  activeSegmentId: string | null;
  latestCustomerInboundMessageId: string | null;
  latestCustomerInboundAt: string | null;
  latestCustomerInboundRevision: number | null;
  lastClosedSegmentId: string | null;
  lastSegmentClosedAt: string | null;
  lastClosedSegmentInboundMessageId: string | null;
  lastClosedSegmentInboundAt: string | null;
  lastClosedSegmentInboundRevision: number | null;
  identityUpdatedAt: string;
  segmentUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}>;

/**
 * All callbacks are server-owned trust boundaries. A syntactically safe identifier is not proof
 * that a channel reference is low-sensitive, server-issued, or owned by the supplied scope.
 */
export type ConversationRootPolicy = Readonly<{
  isTrustedConnectionBinding: (
    binding: ConversationConnectionBinding,
  ) => boolean;
  isTrustedCustomerReferenceForScope: (
    scope: ConversationRootScope,
    customer: CustomerReferenceV1,
  ) => boolean;
  isTrustedCustomerInboundFactForConnection: (
    binding: ConversationConnectionBinding,
    fact: SegmentCustomerInboundFact,
  ) => boolean;
  isTrustedClosedSegmentFact: (segment: ConversationSegment) => boolean;
}>;

export type CreateConversationInput = Readonly<{
  conversationId: unknown;
  tenantId: unknown;
  institutionId: unknown;
  channelType: unknown;
  serviceProviderType: unknown;
  connectionInstanceId: unknown;
  channelConversationRef: unknown;
  identityReviewState: unknown;
  customerReference: unknown;
  customerInboundFact: unknown;
}>;

export type ApplyConversationIdentityReviewInput = Readonly<{
  reviewState: unknown;
  customerReference: unknown;
  occurredAt: unknown;
}>;

/**
 * Raw identity-review input can only request this non-authorizing projection.
 * The identity owner must resolve every requirement before it can change a
 * persisted conversation or customer relation.
 */
export const conversationIdentityProjectionOwnerRequirements = Object.freeze([
  'owner_repository_current_snapshot',
  'revision_cas',
  'trusted_server_clock',
  'fresh_institution_action_object_guard',
  'customer_center_same_institution_owner_verified_customer_reference',
  'low_sensitivity_audit_append',
  'idempotency',
] as const);

export type ConversationIdentityProjectionProposal = Readonly<{
  kind: 'non_authorizing_projection_proposal';
  conversationId: string;
  scope: ConversationRootScope;
  expectedIdentityUpdatedAt: string;
  requestedReviewState: ConversationIdentityReviewState;
  projectedIdentityState: ConversationRootIdentityState;
  ownerRequirements: typeof conversationIdentityProjectionOwnerRequirements;
}>;

export type RecordConversationCustomerInboundInput = SegmentCustomerInboundFact;
export type CloseConversationActiveSegmentInput = ConversationSegment;

export type ConversationRootBlockCode =
  | 'active_segment_exists'
  | 'active_segment_mismatch'
  | 'active_segment_missing'
  | 'closed_segment_untrusted'
  | 'connection_binding_untrusted'
  | 'conversation_invalid'
  | 'customer_inbound_not_new'
  | 'customer_inbound_untrusted'
  | 'closed_segment_conflict'
  | 'identity_customer_mismatch'
  | 'identity_owner_transition_required'
  | 'input_invalid'
  | 'segment_inbound_mismatch'
  | 'target_mismatch'
  | 'timestamp_conflict'
  | 'timestamp_regression';

export type ConversationRootMutationResult =
  | Readonly<{ kind: 'applied'; conversation: ConversationV1 }>
  | Readonly<{ kind: 'replayed'; conversation: ConversationV1 }>
  | ConversationIdentityProjectionProposal
  | Readonly<{ kind: 'blocked'; code: ConversationRootBlockCode }>;

const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const canonicalUtcTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const rootKeys = Object.freeze([
  'conversationId',
  'tenantId',
  'institutionId',
  'channelType',
  'serviceProviderType',
  'connectionInstanceId',
  'channelConversationRef',
  'customerReference',
  'identityState',
  'activeSegmentId',
  'latestCustomerInboundMessageId',
  'latestCustomerInboundAt',
  'latestCustomerInboundRevision',
  'lastClosedSegmentId',
  'lastSegmentClosedAt',
  'lastClosedSegmentInboundMessageId',
  'lastClosedSegmentInboundAt',
  'lastClosedSegmentInboundRevision',
  'identityUpdatedAt',
  'segmentUpdatedAt',
  'createdAt',
  'updatedAt',
] as const);

const createInputKeys = Object.freeze([
  'conversationId',
  'tenantId',
  'institutionId',
  'channelType',
  'serviceProviderType',
  'connectionInstanceId',
  'channelConversationRef',
  'identityReviewState',
  'customerReference',
  'customerInboundFact',
] as const);

const identityInputKeys = Object.freeze([
  'reviewState',
  'customerReference',
  'occurredAt',
] as const);

const policyKeys = Object.freeze([
  'isTrustedConnectionBinding',
  'isTrustedCustomerReferenceForScope',
  'isTrustedCustomerInboundFactForConnection',
  'isTrustedClosedSegmentFact',
] as const);

const customerReferenceKeys = Object.freeze([
  'contractVersion',
  'customerId',
  'displayName',
  'maskedReference',
] as const);

const customerInboundFactKeys = Object.freeze([
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
] as const);

const conversationSegmentKeys = Object.freeze([
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
] as const);

type CapturedRecord = Readonly<Record<string, unknown>>;

function captureExactRecord(
  raw: unknown,
  expectedKeys: readonly string[],
): CapturedRecord | null {
  try {
    if (
      typeof raw !== 'object' ||
      raw === null ||
      Array.isArray(raw) ||
      nodeUtilTypes.isProxy(raw) ||
      Object.getPrototypeOf(raw) !== Object.prototype
    ) {
      return null;
    }

    const ownKeys = Reflect.ownKeys(raw);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some(
        (key) => typeof key !== 'string' || !expectedKeys.includes(key),
      )
    ) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function captureDenseBlockingCodes(
  raw: unknown,
): readonly 'forced_close_unresolved'[] | null {
  try {
    if (!Array.isArray(raw)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(raw) as unknown as Record<
      PropertyKey,
      PropertyDescriptor
    >;
    const ownKeys = Reflect.ownKeys(descriptors);
    const lengthDescriptor = descriptors.length;
    if (
      !lengthDescriptor ||
      !('value' in lengthDescriptor) ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      ownKeys.length !== lengthDescriptor.value + 1
    ) {
      return null;
    }
    const captured: 'forced_close_unresolved'[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = descriptors[String(index)];
      if (
        !descriptor ||
        !('value' in descriptor) ||
        descriptor.value !== 'forced_close_unresolved'
      ) {
        return null;
      }
      captured.push(descriptor.value);
    }
    return new Set(captured).size === captured.length
      ? Object.freeze(captured)
      : null;
  } catch {
    return null;
  }
}

function capturePolicy(raw: unknown): ConversationRootPolicy | null {
  const snapshot = captureExactRecord(raw, policyKeys);
  if (
    !snapshot ||
    typeof snapshot.isTrustedConnectionBinding !== 'function' ||
    typeof snapshot.isTrustedCustomerReferenceForScope !== 'function' ||
    typeof snapshot.isTrustedCustomerInboundFactForConnection !== 'function' ||
    typeof snapshot.isTrustedClosedSegmentFact !== 'function'
  ) {
    return null;
  }

  return Object.freeze({
    isTrustedConnectionBinding:
      snapshot.isTrustedConnectionBinding as ConversationRootPolicy['isTrustedConnectionBinding'],
    isTrustedCustomerReferenceForScope:
      snapshot.isTrustedCustomerReferenceForScope as ConversationRootPolicy['isTrustedCustomerReferenceForScope'],
    isTrustedCustomerInboundFactForConnection:
      snapshot.isTrustedCustomerInboundFactForConnection as ConversationRootPolicy['isTrustedCustomerInboundFactForConnection'],
    isTrustedClosedSegmentFact:
      snapshot.isTrustedClosedSegmentFact as ConversationRootPolicy['isTrustedClosedSegmentFact'],
  });
}

function passesPolicyCheck<TArgs extends readonly unknown[]>(
  check: (...args: TArgs) => boolean,
  ...args: TArgs
): boolean {
  try {
    return check(...args) === true;
  } catch {
    return false;
  }
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === 'string' && safeIdentifierPattern.test(value);
}

function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !canonicalUtcTimestampPattern.test(value)
  ) {
    return false;
  }
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isOneOf<const TValues extends readonly string[]>(
  value: unknown,
  values: TValues,
): value is TValues[number] {
  return (
    typeof value === 'string' &&
    (values as readonly string[]).includes(value)
  );
}

function freezeScope(
  tenantId: string,
  institutionId: string,
): ConversationRootScope {
  return Object.freeze({ tenantId, institutionId });
}

function freezeConnectionBindingFromRoot(
  conversation: ConversationV1,
): ConversationConnectionBinding {
  return Object.freeze({
    tenantId: conversation.tenantId,
    institutionId: conversation.institutionId,
    channelType: conversation.channelType,
    serviceProviderType: conversation.serviceProviderType,
    connectionInstanceId: conversation.connectionInstanceId,
    channelConversationRef: conversation.channelConversationRef,
  });
}

function captureTrustedConnectionBinding(
  raw: Readonly<{
    tenantId: unknown;
    institutionId: unknown;
    channelType: unknown;
    serviceProviderType: unknown;
    connectionInstanceId: unknown;
    channelConversationRef: unknown;
  }>,
  policy: ConversationRootPolicy,
): ConversationConnectionBinding | null {
  if (
    !isSafeIdentifier(raw.tenantId) ||
    !isSafeIdentifier(raw.institutionId) ||
    !isSafeIdentifier(raw.channelType) ||
    !isSafeIdentifier(raw.serviceProviderType) ||
    !isSafeIdentifier(raw.connectionInstanceId) ||
    !isSafeIdentifier(raw.channelConversationRef)
  ) {
    return null;
  }
  const binding = Object.freeze({
    tenantId: raw.tenantId,
    institutionId: raw.institutionId,
    channelType: raw.channelType,
    serviceProviderType: raw.serviceProviderType,
    connectionInstanceId: raw.connectionInstanceId,
    channelConversationRef: raw.channelConversationRef,
  });
  return passesPolicyCheck(policy.isTrustedConnectionBinding, binding)
    ? binding
    : null;
}

function freezeCustomerReference(
  customer: CustomerReferenceV1,
): CustomerReferenceV1 {
  return Object.freeze({
    contractVersion: 'v1',
    customerId: customer.customerId,
    displayName: customer.displayName,
    maskedReference: customer.maskedReference,
  });
}

function captureTrustedCustomerReference(
  raw: unknown,
  scope: ConversationRootScope,
  policy: ConversationRootPolicy,
): CustomerReferenceV1 | null {
  const snapshot = captureExactRecord(raw, customerReferenceKeys);
  if (
    !snapshot ||
    snapshot.contractVersion !== 'v1' ||
    !isSafeIdentifier(snapshot.customerId) ||
    typeof snapshot.displayName !== 'string' ||
    snapshot.displayName.trim().length === 0 ||
    !(
      snapshot.maskedReference === null ||
      (typeof snapshot.maskedReference === 'string' &&
        snapshot.maskedReference.trim().length > 0)
    )
  ) {
    return null;
  }

  const customer = freezeCustomerReference({
    contractVersion: 'v1',
    customerId: snapshot.customerId,
    displayName: snapshot.displayName,
    maskedReference: snapshot.maskedReference,
  });
  return passesPolicyCheck(
    policy.isTrustedCustomerReferenceForScope,
    scope,
    customer,
  )
    ? customer
    : null;
}

function captureTrustedCustomerInboundFact(
  raw: unknown,
  binding: ConversationConnectionBinding,
  policy: ConversationRootPolicy,
): SegmentCustomerInboundFact | null {
  const snapshot = captureExactRecord(raw, customerInboundFactKeys);
  if (
    !snapshot ||
    !isSafeIdentifier(snapshot.tenantId) ||
    !isSafeIdentifier(snapshot.institutionId) ||
    !isSafeIdentifier(snapshot.messageId) ||
    !isSafeIdentifier(snapshot.conversationId) ||
    !isSafeIdentifier(snapshot.segmentId) ||
    snapshot.direction !== 'inbound' ||
    snapshot.senderKind !== 'customer' ||
    !isPositiveSafeInteger(snapshot.inboundRevision) ||
    !isCanonicalUtcTimestamp(snapshot.occurredAt) ||
    !isCanonicalUtcTimestamp(snapshot.receivedAt) ||
    snapshot.receivedAt < snapshot.occurredAt
  ) {
    return null;
  }
  const fact: SegmentCustomerInboundFact = Object.freeze({
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
    messageId: snapshot.messageId,
    conversationId: snapshot.conversationId,
    segmentId: snapshot.segmentId,
    direction: 'inbound',
    senderKind: 'customer',
    inboundRevision: snapshot.inboundRevision,
    occurredAt: snapshot.occurredAt,
    receivedAt: snapshot.receivedAt,
  });
  return passesPolicyCheck(
    policy.isTrustedCustomerInboundFactForConnection,
    binding,
    fact,
  )
    ? fact
    : null;
}

function captureTrustedClosedSegment(
  raw: unknown,
  policy: ConversationRootPolicy,
): ConversationSegment | null {
  const snapshot = captureExactRecord(raw, conversationSegmentKeys);
  const blockingReasonCodes = snapshot
    ? captureDenseBlockingCodes(snapshot.blockingReasonCodes)
    : null;
  if (
    !snapshot ||
    !blockingReasonCodes ||
    !isSafeIdentifier(snapshot.tenantId) ||
    !isSafeIdentifier(snapshot.institutionId) ||
    !isSafeIdentifier(snapshot.segmentId) ||
    !isSafeIdentifier(snapshot.conversationId) ||
    !isPositiveSafeInteger(snapshot.sequenceNo) ||
    snapshot.state !== 'closed' ||
    !(
      snapshot.currentHandlerId === null ||
      isSafeIdentifier(snapshot.currentHandlerId)
    ) ||
    typeof snapshot.everHumanHandled !== 'boolean' ||
    (snapshot.everHumanHandled === false && snapshot.currentHandlerId !== null) ||
    !isSafeIdentifier(snapshot.openedByCustomerMessageId) ||
    !isCanonicalUtcTimestamp(snapshot.openedAt) ||
    !isSafeIdentifier(snapshot.lastCustomerMessageId) ||
    !isCanonicalUtcTimestamp(snapshot.lastCustomerMessageAt) ||
    !isPositiveSafeInteger(snapshot.latestInboundRevision) ||
    snapshot.waitingAfterCustomerMessageId !== null ||
    snapshot.waitingAfterCustomerMessageAt !== null ||
    snapshot.waitingAfterInboundRevision !== null ||
    !isCanonicalUtcTimestamp(snapshot.stateChangedAt) ||
    !isCanonicalUtcTimestamp(snapshot.closedAt) ||
    !['normal', 'forced'].includes(snapshot.segmentCloseKind as string) ||
    !['open', 'resolved'].includes(snapshot.resolutionState as string) ||
    !(
      snapshot.resolvedAt === null ||
      isCanonicalUtcTimestamp(snapshot.resolvedAt)
    ) ||
    snapshot.openedAt > snapshot.lastCustomerMessageAt ||
    snapshot.lastCustomerMessageAt > snapshot.stateChangedAt ||
    snapshot.stateChangedAt !== snapshot.closedAt ||
    (snapshot.resolutionState === 'open' && snapshot.resolvedAt !== null) ||
    (snapshot.resolutionState === 'resolved' && snapshot.resolvedAt === null) ||
    (snapshot.resolvedAt !== null &&
      (snapshot.resolvedAt < snapshot.lastCustomerMessageAt ||
        snapshot.resolvedAt > snapshot.stateChangedAt)) ||
    (snapshot.segmentCloseKind === 'forced' &&
      (snapshot.resolutionState !== 'open' ||
        !blockingReasonCodes.includes('forced_close_unresolved'))) ||
    (snapshot.segmentCloseKind === 'normal' &&
      (blockingReasonCodes.includes('forced_close_unresolved') ||
        (snapshot.everHumanHandled && snapshot.currentHandlerId === null)))
  ) {
    return null;
  }
  const segment: ConversationSegment = Object.freeze({
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
    segmentId: snapshot.segmentId,
    conversationId: snapshot.conversationId,
    sequenceNo: snapshot.sequenceNo,
    state: 'closed',
    currentHandlerId: snapshot.currentHandlerId,
    everHumanHandled: snapshot.everHumanHandled,
    openedByCustomerMessageId: snapshot.openedByCustomerMessageId,
    openedAt: snapshot.openedAt,
    lastCustomerMessageId: snapshot.lastCustomerMessageId,
    lastCustomerMessageAt: snapshot.lastCustomerMessageAt,
    latestInboundRevision: snapshot.latestInboundRevision,
    waitingAfterCustomerMessageId: null,
    waitingAfterCustomerMessageAt: null,
    waitingAfterInboundRevision: null,
    stateChangedAt: snapshot.stateChangedAt,
    closedAt: snapshot.closedAt,
    segmentCloseKind: snapshot.segmentCloseKind as 'normal' | 'forced',
    resolutionState: snapshot.resolutionState as 'open' | 'resolved',
    resolvedAt: snapshot.resolvedAt,
    blockingReasonCodes,
  });
  return passesPolicyCheck(policy.isTrustedClosedSegmentFact, segment)
    ? segment
    : null;
}

export function projectConversationRootIdentityState(
  reviewState: unknown,
): ConversationRootIdentityState | null {
  if (!isOneOf(reviewState, conversationIdentityReviewStates)) return null;
  if (
    reviewState === 'pending_review' ||
    reviewState === 'awaiting_customer_creation'
  ) {
    return 'pending_review';
  }
  if (reviewState === 'matched' || reviewState === 'conflict') {
    return reviewState;
  }
  return 'unmatched';
}

function latestTimestamp(left: string, right: string): string {
  return left >= right ? left : right;
}

function freezeConversation(conversation: ConversationV1): ConversationV1 {
  return Object.freeze({
    conversationId: conversation.conversationId,
    tenantId: conversation.tenantId,
    institutionId: conversation.institutionId,
    channelType: conversation.channelType,
    serviceProviderType: conversation.serviceProviderType,
    connectionInstanceId: conversation.connectionInstanceId,
    channelConversationRef: conversation.channelConversationRef,
    customerReference:
      conversation.customerReference === null
        ? null
        : freezeCustomerReference(conversation.customerReference),
    identityState: conversation.identityState,
    activeSegmentId: conversation.activeSegmentId,
    latestCustomerInboundMessageId: conversation.latestCustomerInboundMessageId,
    latestCustomerInboundAt: conversation.latestCustomerInboundAt,
    latestCustomerInboundRevision: conversation.latestCustomerInboundRevision,
    lastClosedSegmentId: conversation.lastClosedSegmentId,
    lastSegmentClosedAt: conversation.lastSegmentClosedAt,
    lastClosedSegmentInboundMessageId:
      conversation.lastClosedSegmentInboundMessageId,
    lastClosedSegmentInboundAt: conversation.lastClosedSegmentInboundAt,
    lastClosedSegmentInboundRevision:
      conversation.lastClosedSegmentInboundRevision,
    identityUpdatedAt: conversation.identityUpdatedAt,
    segmentUpdatedAt: conversation.segmentUpdatedAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  });
}

function validateConversationRoot(
  raw: unknown,
  policy: ConversationRootPolicy,
): ConversationV1 | null {
  const snapshot = captureExactRecord(raw, rootKeys);
  if (
    !snapshot ||
    !isSafeIdentifier(snapshot.conversationId) ||
    !isOneOf(snapshot.identityState, conversationRootIdentityStates) ||
    !(
      snapshot.activeSegmentId === null ||
      isSafeIdentifier(snapshot.activeSegmentId)
    ) ||
    !(
      snapshot.latestCustomerInboundMessageId === null ||
      isSafeIdentifier(snapshot.latestCustomerInboundMessageId)
    ) ||
    !(
      snapshot.latestCustomerInboundAt === null ||
      isCanonicalUtcTimestamp(snapshot.latestCustomerInboundAt)
    ) ||
    !(
      snapshot.latestCustomerInboundRevision === null ||
      isPositiveSafeInteger(snapshot.latestCustomerInboundRevision)
    ) ||
    !(
      snapshot.lastClosedSegmentId === null ||
      isSafeIdentifier(snapshot.lastClosedSegmentId)
    ) ||
    !(
      snapshot.lastSegmentClosedAt === null ||
      isCanonicalUtcTimestamp(snapshot.lastSegmentClosedAt)
    ) ||
    !(
      snapshot.lastClosedSegmentInboundMessageId === null ||
      isSafeIdentifier(snapshot.lastClosedSegmentInboundMessageId)
    ) ||
    !(
      snapshot.lastClosedSegmentInboundAt === null ||
      isCanonicalUtcTimestamp(snapshot.lastClosedSegmentInboundAt)
    ) ||
    !(
      snapshot.lastClosedSegmentInboundRevision === null ||
      isPositiveSafeInteger(snapshot.lastClosedSegmentInboundRevision)
    ) ||
    !isCanonicalUtcTimestamp(snapshot.identityUpdatedAt) ||
    !isCanonicalUtcTimestamp(snapshot.segmentUpdatedAt) ||
    !isCanonicalUtcTimestamp(snapshot.createdAt) ||
    !isCanonicalUtcTimestamp(snapshot.updatedAt) ||
    snapshot.latestCustomerInboundMessageId === null ||
    snapshot.latestCustomerInboundAt === null ||
    snapshot.latestCustomerInboundRevision === null ||
    snapshot.identityUpdatedAt < snapshot.createdAt ||
    snapshot.segmentUpdatedAt < snapshot.createdAt ||
    snapshot.updatedAt !==
      (snapshot.identityUpdatedAt >= snapshot.segmentUpdatedAt
        ? snapshot.identityUpdatedAt
        : snapshot.segmentUpdatedAt) ||
    (snapshot.lastClosedSegmentId === null) !==
      (snapshot.lastSegmentClosedAt === null) ||
    (snapshot.lastClosedSegmentId === null) !==
      (snapshot.lastClosedSegmentInboundMessageId === null) ||
    (snapshot.lastClosedSegmentId === null) !==
      (snapshot.lastClosedSegmentInboundAt === null) ||
    (snapshot.lastClosedSegmentId === null) !==
      (snapshot.lastClosedSegmentInboundRevision === null) ||
    snapshot.latestCustomerInboundAt > snapshot.segmentUpdatedAt ||
    (snapshot.lastSegmentClosedAt !== null &&
      (snapshot.lastSegmentClosedAt > snapshot.segmentUpdatedAt ||
        snapshot.lastSegmentClosedAt < snapshot.createdAt)) ||
    (snapshot.lastClosedSegmentInboundAt !== null &&
      snapshot.lastSegmentClosedAt !== null &&
      snapshot.lastClosedSegmentInboundAt > snapshot.lastSegmentClosedAt) ||
    (snapshot.activeSegmentId === null &&
      snapshot.lastClosedSegmentId === null) ||
    (snapshot.activeSegmentId !== null &&
      snapshot.activeSegmentId === snapshot.lastClosedSegmentId) ||
    (snapshot.activeSegmentId === null &&
      snapshot.lastSegmentClosedAt !== null &&
      (snapshot.segmentUpdatedAt !== snapshot.lastSegmentClosedAt ||
        snapshot.latestCustomerInboundMessageId !==
          snapshot.lastClosedSegmentInboundMessageId ||
        snapshot.latestCustomerInboundAt !==
          snapshot.lastClosedSegmentInboundAt ||
        snapshot.latestCustomerInboundRevision !==
          snapshot.lastClosedSegmentInboundRevision)) ||
    (snapshot.activeSegmentId !== null &&
      snapshot.lastSegmentClosedAt !== null &&
      snapshot.lastSegmentClosedAt > snapshot.latestCustomerInboundAt)
  ) {
    return null;
  }

  const binding = captureTrustedConnectionBinding(
    {
      tenantId: snapshot.tenantId,
      institutionId: snapshot.institutionId,
      channelType: snapshot.channelType,
      serviceProviderType: snapshot.serviceProviderType,
      connectionInstanceId: snapshot.connectionInstanceId,
      channelConversationRef: snapshot.channelConversationRef,
    },
    policy,
  );
  if (!binding) return null;
  const scope = freezeScope(binding.tenantId, binding.institutionId);
  const customerReference =
    snapshot.customerReference === null
      ? null
      : captureTrustedCustomerReference(
          snapshot.customerReference,
          scope,
          policy,
        );
  if (
    (snapshot.identityState === 'matched' && !customerReference) ||
    (snapshot.identityState !== 'matched' && snapshot.customerReference !== null)
  ) {
    return null;
  }

  return freezeConversation({
    conversationId: snapshot.conversationId,
    ...binding,
    customerReference,
    identityState: snapshot.identityState,
    activeSegmentId: snapshot.activeSegmentId,
    latestCustomerInboundMessageId: snapshot.latestCustomerInboundMessageId,
    latestCustomerInboundAt: snapshot.latestCustomerInboundAt,
    latestCustomerInboundRevision: snapshot.latestCustomerInboundRevision,
    lastClosedSegmentId: snapshot.lastClosedSegmentId,
    lastSegmentClosedAt: snapshot.lastSegmentClosedAt,
    lastClosedSegmentInboundMessageId:
      snapshot.lastClosedSegmentInboundMessageId,
    lastClosedSegmentInboundAt: snapshot.lastClosedSegmentInboundAt,
    lastClosedSegmentInboundRevision:
      snapshot.lastClosedSegmentInboundRevision,
    identityUpdatedAt: snapshot.identityUpdatedAt,
    segmentUpdatedAt: snapshot.segmentUpdatedAt,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  });
}

export function isValidConversationRoot(
  raw: unknown,
  rawPolicy: ConversationRootPolicy,
): raw is ConversationV1 {
  const policy = capturePolicy(rawPolicy);
  return policy !== null && validateConversationRoot(raw, policy) !== null;
}

function blocked(code: ConversationRootBlockCode): ConversationRootMutationResult {
  return Object.freeze({ kind: 'blocked', code });
}

function applied(conversation: ConversationV1): ConversationRootMutationResult {
  return Object.freeze({
    kind: 'applied',
    conversation: freezeConversation(conversation),
  });
}

function replayed(conversation: ConversationV1): ConversationRootMutationResult {
  return Object.freeze({
    kind: 'replayed',
    conversation: freezeConversation(conversation),
  });
}

function proposeIdentityProjection(
  conversation: ConversationV1,
  requestedReviewState: ConversationIdentityReviewState,
  projectedIdentityState: ConversationRootIdentityState,
): ConversationIdentityProjectionProposal {
  return Object.freeze({
    kind: 'non_authorizing_projection_proposal' as const,
    conversationId: conversation.conversationId,
    scope: Object.freeze({
      tenantId: conversation.tenantId,
      institutionId: conversation.institutionId,
    }),
    expectedIdentityUpdatedAt: conversation.identityUpdatedAt,
    requestedReviewState,
    projectedIdentityState,
    ownerRequirements: conversationIdentityProjectionOwnerRequirements,
  });
}

export function createConversation(
  rawInput: CreateConversationInput,
  rawPolicy: ConversationRootPolicy,
): ConversationRootMutationResult {
  const input = captureExactRecord(rawInput, createInputKeys);
  const policy = capturePolicy(rawPolicy);
  if (!input || !policy || !isSafeIdentifier(input.conversationId)) {
    return blocked('input_invalid');
  }

  const binding = captureTrustedConnectionBinding(
    {
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      channelType: input.channelType,
      serviceProviderType: input.serviceProviderType,
      connectionInstanceId: input.connectionInstanceId,
      channelConversationRef: input.channelConversationRef,
    },
    policy,
  );
  if (!binding) return blocked('connection_binding_untrusted');

  const customerInboundFact = captureTrustedCustomerInboundFact(
    input.customerInboundFact,
    binding,
    policy,
  );
  if (!customerInboundFact) return blocked('customer_inbound_untrusted');
  if (
    customerInboundFact.tenantId !== binding.tenantId ||
    customerInboundFact.institutionId !== binding.institutionId ||
    customerInboundFact.conversationId !== input.conversationId
  ) {
    return blocked('target_mismatch');
  }

  const identityState = projectConversationRootIdentityState(
    input.identityReviewState,
  );
  if (!identityState) return blocked('input_invalid');
  if (
    input.customerReference !== null ||
    (identityState !== 'pending_review' && identityState !== 'unmatched')
  ) return blocked('identity_owner_transition_required');

  return applied({
    conversationId: input.conversationId,
    ...binding,
    customerReference: null,
    identityState,
    activeSegmentId: customerInboundFact.segmentId,
    latestCustomerInboundMessageId: customerInboundFact.messageId,
    latestCustomerInboundAt: customerInboundFact.occurredAt,
    latestCustomerInboundRevision: customerInboundFact.inboundRevision,
    lastClosedSegmentId: null,
    lastSegmentClosedAt: null,
    lastClosedSegmentInboundMessageId: null,
    lastClosedSegmentInboundAt: null,
    lastClosedSegmentInboundRevision: null,
    identityUpdatedAt: customerInboundFact.receivedAt,
    segmentUpdatedAt: customerInboundFact.receivedAt,
    createdAt: customerInboundFact.receivedAt,
    updatedAt: customerInboundFact.receivedAt,
  });
}

export function applyConversationIdentityReview(
  rawConversation: unknown,
  rawInput: ApplyConversationIdentityReviewInput,
  rawPolicy: ConversationRootPolicy,
): ConversationRootMutationResult {
  const policy = capturePolicy(rawPolicy);
  if (!policy) return blocked('input_invalid');
  const conversation = validateConversationRoot(rawConversation, policy);
  if (!conversation) return blocked('conversation_invalid');

  const input = captureExactRecord(rawInput, identityInputKeys);
  if (!input || !isCanonicalUtcTimestamp(input.occurredAt)) {
    return blocked('input_invalid');
  }

  const requestedReviewState = isOneOf(input.reviewState, conversationIdentityReviewStates)
    ? input.reviewState
    : null;
  const projectedIdentityState = projectConversationRootIdentityState(requestedReviewState);
  if (!requestedReviewState || !projectedIdentityState) return blocked('input_invalid');
  if (input.customerReference !== null) return blocked('identity_owner_transition_required');

  return proposeIdentityProjection(
    conversation,
    requestedReviewState,
    projectedIdentityState,
  );
}

export function recordConversationCustomerInbound(
  rawConversation: unknown,
  rawInput: RecordConversationCustomerInboundInput,
  rawPolicy: ConversationRootPolicy,
): ConversationRootMutationResult {
  const policy = capturePolicy(rawPolicy);
  if (!policy) return blocked('input_invalid');
  const conversation = validateConversationRoot(rawConversation, policy);
  if (!conversation) return blocked('conversation_invalid');
  if (
    conversation.latestCustomerInboundMessageId === null ||
    conversation.latestCustomerInboundAt === null ||
    conversation.latestCustomerInboundRevision === null
  ) {
    return blocked('conversation_invalid');
  }

  const binding = freezeConnectionBindingFromRoot(conversation);
  const customerInboundFact = captureTrustedCustomerInboundFact(
    rawInput,
    binding,
    policy,
  );
  if (!customerInboundFact) return blocked('customer_inbound_untrusted');
  if (
    customerInboundFact.tenantId !== conversation.tenantId ||
    customerInboundFact.institutionId !== conversation.institutionId ||
    customerInboundFact.conversationId !== conversation.conversationId
  ) {
    return blocked('target_mismatch');
  }
  if (customerInboundFact.receivedAt < conversation.segmentUpdatedAt) {
    return blocked('timestamp_regression');
  }
  if (
    conversation.activeSegmentId !== null &&
    conversation.activeSegmentId !== customerInboundFact.segmentId
  ) {
    return blocked('active_segment_exists');
  }
  if (
    conversation.activeSegmentId === null &&
    (conversation.lastClosedSegmentId === customerInboundFact.segmentId ||
      conversation.lastSegmentClosedAt === null ||
      customerInboundFact.occurredAt < conversation.lastSegmentClosedAt)
  ) {
    return blocked('customer_inbound_not_new');
  }

  if (
    customerInboundFact.occurredAt <= conversation.latestCustomerInboundAt
  ) {
    return conversation.activeSegmentId === customerInboundFact.segmentId &&
      customerInboundFact.messageId ===
        conversation.latestCustomerInboundMessageId &&
      customerInboundFact.occurredAt === conversation.latestCustomerInboundAt &&
      customerInboundFact.inboundRevision ===
        conversation.latestCustomerInboundRevision &&
      customerInboundFact.receivedAt === conversation.segmentUpdatedAt
      ? replayed(conversation)
      : blocked('customer_inbound_not_new');
  }
  if (
    conversation.activeSegmentId === customerInboundFact.segmentId &&
    customerInboundFact.inboundRevision <=
      conversation.latestCustomerInboundRevision
  ) {
    return blocked('customer_inbound_not_new');
  }

  return applied({
    ...conversation,
    activeSegmentId: customerInboundFact.segmentId,
    latestCustomerInboundMessageId: customerInboundFact.messageId,
    latestCustomerInboundAt: customerInboundFact.occurredAt,
    latestCustomerInboundRevision: customerInboundFact.inboundRevision,
    segmentUpdatedAt: customerInboundFact.receivedAt,
    updatedAt: latestTimestamp(
      conversation.identityUpdatedAt,
      customerInboundFact.receivedAt,
    ),
  });
}

export function closeConversationActiveSegment(
  rawConversation: unknown,
  rawInput: CloseConversationActiveSegmentInput,
  rawPolicy: ConversationRootPolicy,
): ConversationRootMutationResult {
  const policy = capturePolicy(rawPolicy);
  if (!policy) return blocked('input_invalid');
  const conversation = validateConversationRoot(rawConversation, policy);
  if (!conversation) return blocked('conversation_invalid');
  if (
    conversation.latestCustomerInboundMessageId === null ||
    conversation.latestCustomerInboundAt === null ||
    conversation.latestCustomerInboundRevision === null
  ) {
    return blocked('conversation_invalid');
  }

  const closedSegment = captureTrustedClosedSegment(rawInput, policy);
  if (!closedSegment) return blocked('closed_segment_untrusted');
  if (
    closedSegment.tenantId !== conversation.tenantId ||
    closedSegment.institutionId !== conversation.institutionId ||
    closedSegment.conversationId !== conversation.conversationId
  ) {
    return blocked('target_mismatch');
  }
  if (closedSegment.closedAt === null) {
    return blocked('closed_segment_untrusted');
  }
  const matchesCurrentInbound =
    closedSegment.lastCustomerMessageId ===
      conversation.latestCustomerInboundMessageId &&
    closedSegment.lastCustomerMessageAt ===
      conversation.latestCustomerInboundAt &&
    closedSegment.latestInboundRevision ===
      conversation.latestCustomerInboundRevision;
  if (conversation.lastClosedSegmentId === closedSegment.segmentId) {
    return conversation.lastSegmentClosedAt === closedSegment.closedAt &&
      closedSegment.lastCustomerMessageId ===
        conversation.lastClosedSegmentInboundMessageId &&
      closedSegment.lastCustomerMessageAt ===
        conversation.lastClosedSegmentInboundAt &&
      closedSegment.latestInboundRevision ===
        conversation.lastClosedSegmentInboundRevision
      ? replayed(conversation)
      : blocked('closed_segment_conflict');
  }
  if (conversation.activeSegmentId === null) {
    return blocked('active_segment_missing');
  }
  if (conversation.activeSegmentId !== closedSegment.segmentId) {
    return blocked('active_segment_mismatch');
  }
  if (!matchesCurrentInbound) {
    return blocked('segment_inbound_mismatch');
  }
  if (closedSegment.closedAt < conversation.segmentUpdatedAt) {
    return blocked('timestamp_regression');
  }

  return applied({
    ...conversation,
    activeSegmentId: null,
    lastClosedSegmentId: closedSegment.segmentId,
    lastSegmentClosedAt: closedSegment.closedAt,
    lastClosedSegmentInboundMessageId: closedSegment.lastCustomerMessageId,
    lastClosedSegmentInboundAt: closedSegment.lastCustomerMessageAt,
    lastClosedSegmentInboundRevision: closedSegment.latestInboundRevision,
    segmentUpdatedAt: closedSegment.closedAt,
    updatedAt: latestTimestamp(
      conversation.identityUpdatedAt,
      closedSegment.closedAt,
    ),
  });
}
