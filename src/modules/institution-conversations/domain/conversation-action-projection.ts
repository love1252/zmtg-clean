import {
  CONVERSATION_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1,
  type ConversationActionItemV1,
  type ConversationActionPartitionKeyV1,
  type ConversationActionSourceV1,
} from '@/modules/institution-contracts/v1/conversation-action';
import {
  INSTITUTION_ACTION_SORT_SIGNALS_V1,
  type InstitutionActionSortSignalV1,
} from '@/modules/institution-contracts/v1/institution-action';
import type {
  InstitutionSourceFailureCodeV1,
  InstitutionSourceFreshnessV1,
  InstitutionSourcePartitionReadinessV1,
} from '@/modules/institution-contracts/v1/institution-source';
import type { ConversationAssignmentProjection } from '@/modules/institution-conversations/domain/conversation-assignments';
import type { ConversationMessage } from '@/modules/institution-conversations/domain/conversation-messages';
import { conversationMessageSafeSummaryTexts } from '@/modules/institution-conversations/domain/conversation-messages';
import type { ConversationRiskProjection } from '@/modules/institution-conversations/domain/conversation-risks';
import type { ConversationSegment } from '@/modules/institution-conversations/domain/conversation-segments';
import type { ConversationV1 } from '@/modules/institution-conversations/domain/conversations';

export const conversationActionProjectionRoles = Object.freeze([
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
] as const);

export type ConversationActionProjectionRole =
  (typeof conversationActionProjectionRoles)[number];

export type ConversationActionProjectionInput = Readonly<{
  scope: Readonly<{ tenantId: string; institutionId: string }>;
  /** Server-issued authorization context; this provider must never infer it from browser state. */
  viewer: Readonly<{
    authority: 'server_authorized';
    role: ConversationActionProjectionRole;
    userId: string;
  }>;
  freshness: InstitutionSourceFreshnessV1;
  partitions: readonly ConversationActionProjectionPartition[];
  candidates: readonly ConversationActionProjectionCandidate[];
}>;

export type ConversationActionProjectionPartition = Readonly<{
  key: ConversationActionPartitionKeyV1;
  readiness: InstitutionSourcePartitionReadinessV1;
  freshness: InstitutionSourceFreshnessV1 | null;
  failureCode: InstitutionSourceFailureCodeV1 | null;
}>;

export type ConversationActionProjectionCandidate = Readonly<{
  productionEvidence: Readonly<{
    kind: 'server_persisted_current';
    tenantId: string;
    institutionId: string;
    conversationId: string;
    segmentId: string;
    sourceVersion: string;
  }>;
  conversation: ConversationV1;
  segment: ConversationSegment;
  assignment: ConversationAssignmentProjection;
  risk: ConversationRiskProjection;
  lastCustomerMessage: ConversationMessage;
  approved: Readonly<{
    sourceVersion: string;
    sortSignals: readonly InstitutionActionSortSignalV1[];
    slaAt: string | null;
    priority: 'normal' | 'high';
    assignee: Readonly<{ userId: string; displayName: string }> | null;
  }>;
}>;

export type ConversationActionProjectionResult =
  | Readonly<{ kind: 'projected'; source: ConversationActionSourceV1 }>
  | Readonly<{ kind: 'blocked'; code: 'invalid_input' }>;

type CapturedRecord = Readonly<Record<string, unknown>>;
type ParsedScope = Readonly<{ tenantId: string; institutionId: string }>;
type ParsedPartition = Readonly<{
  key: ConversationActionPartitionKeyV1;
  readiness: InstitutionSourcePartitionReadinessV1;
  freshness: InstitutionSourceFreshnessV1 | null;
  failureCode: InstitutionSourceFailureCodeV1 | null;
}>;
type ParsedCandidate = Readonly<{
  item: ConversationActionItemV1;
  assigneeRole: ConversationActionProjectionRole | null;
  partitions: readonly ConversationActionPartitionKeyV1[];
}>;

const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const safeVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const safeDisplayNamePattern = /^[A-Za-z0-9\u4E00-\u9FFF·_-]{1,40}$/u;
const canonicalUtcTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const inputKeys = ['scope', 'viewer', 'freshness', 'partitions', 'candidates'] as const;
const scopeKeys = ['tenantId', 'institutionId'] as const;
const viewerKeys = ['authority', 'role', 'userId'] as const;
const partitionKeys = ['key', 'readiness', 'freshness', 'failureCode'] as const;
const freshnessKeys = ['observedAt', 'freshUntil'] as const;
const candidateKeys = [
  'productionEvidence',
  'conversation',
  'segment',
  'assignment',
  'risk',
  'lastCustomerMessage',
  'approved',
] as const;
const productionEvidenceKeys = [
  'kind',
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'sourceVersion',
] as const;
const conversationKeys = [
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
] as const;
const segmentKeys = [
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
const assignmentKeys = [
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'revision',
  'assignmentId',
  'assigneeRole',
  'assignmentStatus',
  'activeAssignmentCount',
  'assigneeId',
] as const;
const riskNoneKeys = ['state'] as const;
const riskActiveKeys = [
  'state',
  'riskId',
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'sourceMessageId',
  'riskDomain',
  'riskCode',
  'detectedAt',
  'confirmedAt',
  'resolvedAt',
  'clinicalClosureReferenceId',
] as const;
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
const safeSummaryKeys = ['code', 'text'] as const;
const approvedKeys = ['sourceVersion', 'sortSignals', 'slaAt', 'priority', 'assignee'] as const;
const assigneeKeys = ['userId', 'displayName'] as const;
const customerReferenceKeys = ['contractVersion', 'customerId', 'displayName', 'maskedReference'] as const;

const actionPartitionOrder = ['waiting_human', 'unresolved_risk'] as const;

function captureOneOfExactRecords(
  raw: unknown,
  expectedKeySets: readonly (readonly string[])[],
): CapturedRecord | null {
  try {
    if (
      typeof raw !== 'object'
      || raw === null
      || Array.isArray(raw)
      || Object.getPrototypeOf(raw) !== Object.prototype
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(raw);
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
    const captured: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
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
  } catch {
    return null;
  }
}

function captureExactRecord(raw: unknown, expectedKeys: readonly string[]): CapturedRecord | null {
  return captureOneOfExactRecords(raw, [expectedKeys]);
}

function captureDenseArray(raw: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(raw)) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(raw) as unknown as Record<
      PropertyKey,
      PropertyDescriptor
    >;
    const length = descriptors.length;
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      length === undefined
      || !Object.hasOwn(length, 'value')
      || typeof length.value !== 'number'
      || !Number.isSafeInteger(length.value)
      || length.value < 0
      || ownKeys.length !== length.value + 1
    ) {
      return null;
    }
    const captured: unknown[] = [];
    for (let index = 0; index < length.value; index += 1) {
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
  } catch {
    return null;
  }
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === 'string' && safeIdentifierPattern.test(value);
}

function isCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !canonicalUtcTimestampPattern.test(value)) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function captureScope(raw: unknown): ParsedScope | null {
  const scope = captureExactRecord(raw, scopeKeys);
  if (
    scope === null
    || !isSafeIdentifier(scope.tenantId)
    || !isSafeIdentifier(scope.institutionId)
  ) {
    return null;
  }
  return { tenantId: scope.tenantId, institutionId: scope.institutionId };
}

function sameScope(left: ParsedScope, right: ParsedScope): boolean {
  return left.tenantId === right.tenantId && left.institutionId === right.institutionId;
}

function captureFreshness(raw: unknown): InstitutionSourceFreshnessV1 | null {
  const freshness = captureExactRecord(raw, freshnessKeys);
  if (
    freshness === null
    || !isCanonicalTimestamp(freshness.observedAt)
    || !isCanonicalTimestamp(freshness.freshUntil)
    || freshness.observedAt > freshness.freshUntil
  ) {
    return null;
  }
  return { observedAt: freshness.observedAt, freshUntil: freshness.freshUntil };
}

function capturePartitions(raw: unknown): readonly ParsedPartition[] | null {
  const values = captureDenseArray(raw);
  if (values === null || values.length !== actionPartitionOrder.length) {
    return null;
  }
  const seen = new Set<string>();
  const result: ParsedPartition[] = [];
  for (const value of values) {
    const partition = captureExactRecord(value, partitionKeys);
    if (
      partition === null
      || (partition.key !== 'waiting_human' && partition.key !== 'unresolved_risk')
      || seen.has(partition.key)
      || !['ready', 'empty', 'stale', 'unavailable', 'denied', 'disabled'].includes(
        partition.readiness as string,
      )
      || (partition.failureCode !== null && ![
        'upstream_unavailable', 'timeout', 'invalid_payload', 'scope_mismatch',
        'permission_denied', 'not_released', 'data_incomplete',
      ].includes(partition.failureCode as string))
    ) {
      return null;
    }
    const freshness = partition.freshness === null ? null : captureFreshness(partition.freshness);
    if (
      (partition.readiness === 'ready' || partition.readiness === 'empty' || partition.readiness === 'stale')
      && freshness === null
    ) {
      return null;
    }
    if (
      ['unavailable', 'denied', 'disabled'].includes(partition.readiness as string)
      && freshness !== null
    ) {
      return null;
    }
    seen.add(partition.key);
    result.push({
      key: partition.key,
      readiness: partition.readiness as InstitutionSourcePartitionReadinessV1,
      freshness,
      failureCode: partition.failureCode as InstitutionSourceFailureCodeV1 | null,
    });
  }
  return actionPartitionOrder.map((key) => result.find((partition) => partition.key === key)!);
}

function sourceFailure(
  scope: ParsedScope,
  partitions: readonly ParsedPartition[],
  readiness: 'unavailable' | 'denied' | 'disabled',
  failureCode: InstitutionSourceFailureCodeV1,
): ConversationActionSourceV1 {
  return {
    contractVersion: 'v1',
    scope,
    readiness,
    freshness: null,
    partitions: partitions.map((partition) => ({
      key: partition.key,
      readiness: readiness === 'denied' ? 'denied' : readiness,
      freshness: null,
      failureCode,
    })),
    data: null,
    failureCode,
  };
}

function captureViewer(raw: unknown): Readonly<{ role: ConversationActionProjectionRole; userId: string }> | null {
  const viewer = captureExactRecord(raw, viewerKeys);
  if (
    viewer === null
    || viewer.authority !== 'server_authorized'
    || !conversationActionProjectionRoles.includes(viewer.role as ConversationActionProjectionRole)
    || !isSafeIdentifier(viewer.userId)
  ) {
    return null;
  }
  return { role: viewer.role as ConversationActionProjectionRole, userId: viewer.userId };
}

function captureCustomerSubject(raw: unknown): ConversationActionItemV1['subject'] | null {
  const customer = captureExactRecord(raw, customerReferenceKeys);
  if (
    customer === null
    || customer.contractVersion !== 'v1'
    || typeof customer.customerId !== 'string'
    || typeof customer.displayName !== 'string'
    || typeof customer.maskedReference !== 'string'
    || !isSafeIdentifier(customer.customerId)
    || customer.displayName.length === 0
    || customer.displayName.length > 80
    || customer.maskedReference.length === 0
    || customer.maskedReference.length > 80
  ) {
    return null;
  }
  return {
    kind: 'customer',
    customer: {
      contractVersion: 'v1',
      customerId: customer.customerId,
      displayName: customer.displayName,
      maskedReference: customer.maskedReference,
    },
  };
}

function captureCandidate(
  raw: unknown,
  scope: ParsedScope,
): ParsedCandidate | 'scope_mismatch' | 'invalid' | 'ended' {
  const candidate = captureExactRecord(raw, candidateKeys);
  if (candidate === null) {
    return 'invalid';
  }
  const evidence = captureExactRecord(candidate.productionEvidence, productionEvidenceKeys);
  const conversation = captureExactRecord(candidate.conversation, conversationKeys);
  const segment = captureExactRecord(candidate.segment, segmentKeys);
  const assignment = captureExactRecord(candidate.assignment, assignmentKeys);
  const approved = captureExactRecord(candidate.approved, approvedKeys);
  if (
    evidence === null
    || conversation === null
    || segment === null
    || assignment === null
    || approved === null
    || evidence.kind !== 'server_persisted_current'
    || !isSafeIdentifier(evidence.tenantId)
    || !isSafeIdentifier(evidence.institutionId)
    || !isSafeIdentifier(evidence.conversationId)
    || !isSafeIdentifier(evidence.segmentId)
    || typeof evidence.sourceVersion !== 'string'
    || !safeVersionPattern.test(evidence.sourceVersion)
  ) {
    return 'invalid';
  }
  const candidateScope = { tenantId: evidence.tenantId, institutionId: evidence.institutionId };
  if (!sameScope(scope, candidateScope)) {
    return 'scope_mismatch';
  }
  if (
    conversation.tenantId !== scope.tenantId
    || conversation.institutionId !== scope.institutionId
    || segment.tenantId !== scope.tenantId
    || segment.institutionId !== scope.institutionId
    || assignment.tenantId !== scope.tenantId
    || assignment.institutionId !== scope.institutionId
    || conversation.conversationId !== evidence.conversationId
    || segment.conversationId !== evidence.conversationId
    || assignment.conversationId !== evidence.conversationId
    || segment.segmentId !== evidence.segmentId
    || assignment.segmentId !== evidence.segmentId
  ) {
    return 'scope_mismatch';
  }
  if (
    !isSafeIdentifier(conversation.conversationId)
    || !isSafeIdentifier(segment.segmentId)
    || conversation.activeSegmentId !== segment.segmentId
    || !isSafeIdentifier(segment.lastCustomerMessageId)
    || !isCanonicalTimestamp(segment.lastCustomerMessageAt)
    || typeof segment.latestInboundRevision !== 'number'
    || !Number.isSafeInteger(segment.latestInboundRevision)
    || segment.latestInboundRevision < 1
  ) {
    return 'invalid';
  }
  if (segment.state === 'closed') {
    return 'ended';
  }
  if (!['ai_handling', 'awaiting_human', 'human_handling', 'waiting_customer'].includes(segment.state as string)) {
    return 'invalid';
  }
  if (
    conversation.latestCustomerInboundMessageId !== segment.lastCustomerMessageId
    || conversation.latestCustomerInboundAt !== segment.lastCustomerMessageAt
    || conversation.latestCustomerInboundRevision !== segment.latestInboundRevision
  ) {
    return 'invalid';
  }

  const message = captureExactRecord(candidate.lastCustomerMessage, messageKeys);
  if (
    message === null
    || message.tenantId !== scope.tenantId
    || message.institutionId !== scope.institutionId
    || message.conversationId !== conversation.conversationId
    || message.segmentId !== segment.segmentId
    || message.messageId !== segment.lastCustomerMessageId
    || message.direction !== 'inbound'
    || message.senderKind !== 'customer'
    || message.occurredAt !== segment.lastCustomerMessageAt
    || !isCanonicalTimestamp(message.occurredAt)
    || !isCanonicalTimestamp(message.receivedAt)
    || message.receivedAt < message.occurredAt
  ) {
    return 'invalid';
  }
  const safeSummary = captureExactRecord(message.safeSummary, safeSummaryKeys);
  if (
    safeSummary === null
    || safeSummary.code !== 'customer_message_received'
    || safeSummary.text !== conversationMessageSafeSummaryTexts.customer_message_received
  ) {
    return 'invalid';
  }

  const assignmentActive = assignment.activeAssignmentCount === 1;
  if (
    (assignment.activeAssignmentCount !== 0 && assignment.activeAssignmentCount !== 1)
    || (assignmentActive && (
      !isSafeIdentifier(assignment.assignmentId)
      || !isSafeIdentifier(assignment.assigneeId)
      || !['assigned', 'accepted'].includes(assignment.assignmentStatus as string)
      || !conversationActionProjectionRoles.includes(
        assignment.assigneeRole as ConversationActionProjectionRole,
      )
    ))
    || (!assignmentActive && (
      assignment.assignmentId !== null
      || assignment.assigneeId !== null
      || assignment.assigneeRole !== null
      || assignment.assignmentStatus !== null
    ))
  ) {
    return 'invalid';
  }

  const risk = captureOneOfExactRecords(candidate.risk, [riskNoneKeys, riskActiveKeys]);
  if (risk === null || !['none', 'unconfirmed', 'confirmed', 'resolved'].includes(risk.state as string)) {
    return 'invalid';
  }
  if (risk.state !== 'none' && (
    risk.tenantId !== scope.tenantId
    || risk.institutionId !== scope.institutionId
    || risk.conversationId !== conversation.conversationId
    || risk.segmentId !== segment.segmentId
  )) {
    return 'scope_mismatch';
  }

  const sortSignals = captureDenseArray(approved.sortSignals);
  if (
    sortSignals === null
    || new Set(sortSignals).size !== sortSignals.length
    || sortSignals.some(
      (signal) => !INSTITUTION_ACTION_SORT_SIGNALS_V1.includes(signal as InstitutionActionSortSignalV1),
    )
    || approved.sourceVersion !== evidence.sourceVersion
    || typeof approved.sourceVersion !== 'string'
    || !safeVersionPattern.test(approved.sourceVersion)
    || (approved.slaAt !== null && !isCanonicalTimestamp(approved.slaAt))
    || (approved.priority !== 'normal' && approved.priority !== 'high')
  ) {
    return 'invalid';
  }
  let assignee: ConversationActionItemV1['assignee'] = null;
  if (assignmentActive) {
    const approvedAssignee = captureExactRecord(approved.assignee, assigneeKeys);
    if (
      approvedAssignee === null
      || approvedAssignee.userId !== assignment.assigneeId
      || !isSafeIdentifier(approvedAssignee.userId)
      || typeof approvedAssignee.displayName !== 'string'
      || !safeDisplayNamePattern.test(approvedAssignee.displayName)
    ) {
      return 'invalid';
    }
    assignee = { userId: approvedAssignee.userId, displayName: approvedAssignee.displayName };
  } else if (approved.assignee !== null) {
    return 'invalid';
  }

  const subject = conversation.identityState === 'matched'
    ? captureCustomerSubject(conversation.customerReference)
    : { kind: 'unmatched_contact' as const, label: '待匹配联系人' as const };
  if (subject === null) {
    return 'invalid';
  }
  const partitions: ConversationActionPartitionKeyV1[] = [];
  if (segment.state === 'awaiting_human') {
    partitions.push('waiting_human');
  }
  if (risk.state === 'unconfirmed' || risk.state === 'confirmed') {
    partitions.push('unresolved_risk');
  }
  const orderedPartitions = actionPartitionOrder.filter((key) => partitions.includes(key));
  const actionSafeSummary = safeSummary.text as string;
  const item: ConversationActionItemV1 = {
    conversationId: conversation.conversationId as string,
    segmentId: segment.segmentId as string,
    sourceVersion: evidence.sourceVersion,
    production: true,
    subject,
    conversationState: segment.state as ConversationActionItemV1['conversationState'],
    riskState: risk.state as ConversationActionItemV1['riskState'],
    partitions: orderedPartitions,
    sortSignals: sortSignals as InstitutionActionSortSignalV1[],
    lastCustomerMessageAt: message.occurredAt as string,
    slaAt: approved.slaAt as string | null,
    priority: approved.priority as 'normal' | 'high',
    assignee,
    safeSummary: actionSafeSummary,
    detailHref: `/hospital/conversations/${conversation.conversationId as string}`,
  };
  if (actionSafeSummary.length > CONVERSATION_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1) {
    return 'invalid';
  }
  return {
    item,
    assigneeRole: assignmentActive
      ? assignment.assigneeRole as ConversationActionProjectionRole
      : null,
    partitions: orderedPartitions,
  };
}

function renderSource(
  scope: ParsedScope,
  freshness: InstitutionSourceFreshnessV1,
  partitions: readonly ParsedPartition[],
  candidates: readonly ParsedCandidate[],
  viewer: Readonly<{ role: ConversationActionProjectionRole; userId: string }>,
): ConversationActionSourceV1 {
  const actionsBySegment = new Map<string, ConversationActionItemV1>();
  for (const candidate of candidates) {
    const visible = viewer.role === 'tenant_admin' || viewer.role === 'tenant_operator'
      || (
        candidate.assigneeRole === viewer.role
        && candidate.item.assignee?.userId === viewer.userId
      );
    if (!visible) {
      continue;
    }
    const readyPartitions = candidate.partitions.filter((key) => (
      partitions.find((partition) => partition.key === key)?.readiness === 'ready'
    ));
    if (readyPartitions.length === 0) {
      continue;
    }
    const existing = actionsBySegment.get(candidate.item.segmentId);
    actionsBySegment.set(candidate.item.segmentId, {
      ...candidate.item,
      partitions: existing === undefined
        ? readyPartitions
        : actionPartitionOrder.filter((key) => (
          existing.partitions.includes(key) || readyPartitions.includes(key)
        )),
    });
  }
  const actions = [...actionsBySegment.values()];
  const outputPartitions = partitions.map((partition) => {
    if (partition.readiness !== 'ready') {
      return partition;
    }
    const hasAction = actions.some((action) => action.partitions.includes(partition.key));
    return { ...partition, readiness: hasAction ? 'ready' as const : 'empty' as const };
  });
  const currentPartitions = outputPartitions.filter(
    (partition) => partition.readiness === 'ready' || partition.readiness === 'empty',
  );
  if (currentPartitions.length === outputPartitions.length) {
    return {
      contractVersion: 'v1', scope, readiness: actions.length > 0 ? 'ready' : 'empty', freshness,
      partitions: outputPartitions, data: { actions }, failureCode: null,
    };
  }
  if (currentPartitions.length > 0) {
    const failureCode = outputPartitions.find((partition) => partition.failureCode !== null)?.failureCode
      ?? 'data_incomplete';
    return {
      contractVersion: 'v1', scope, readiness: 'partial', freshness: null,
      partitions: outputPartitions, data: { actions }, failureCode,
    };
  }
  if (outputPartitions.every((partition) => partition.readiness === 'stale')) {
    return {
      contractVersion: 'v1', scope, readiness: 'stale', freshness,
      partitions: outputPartitions, data: { actions: [] },
      failureCode: outputPartitions[0]?.failureCode ?? 'data_incomplete',
    };
  }
  if (outputPartitions.every((partition) => partition.readiness === 'disabled')) {
    return sourceFailure(scope, outputPartitions, 'disabled', 'not_released');
  }
  if (outputPartitions.every((partition) => partition.readiness === 'denied')) {
    return sourceFailure(scope, outputPartitions, 'denied', 'permission_denied');
  }
  return sourceFailure(scope, outputPartitions, 'unavailable', 'data_incomplete');
}

export function projectConversationActionSource(
  raw: ConversationActionProjectionInput,
): ConversationActionProjectionResult {
  const input = captureExactRecord(raw, inputKeys);
  if (input === null) {
    return { kind: 'blocked', code: 'invalid_input' };
  }
  const scope = captureScope(input.scope);
  const viewer = captureViewer(input.viewer);
  const freshness = captureFreshness(input.freshness);
  const partitions = capturePartitions(input.partitions);
  const rawCandidates = captureDenseArray(input.candidates);
  if (scope === null || viewer === null || freshness === null || partitions === null || rawCandidates === null) {
    return { kind: 'blocked', code: 'invalid_input' };
  }
  if (partitions.some((partition) => partition.failureCode === 'scope_mismatch')) {
    return { kind: 'projected', source: sourceFailure(scope, partitions, 'denied', 'scope_mismatch') };
  }
  const candidates: ParsedCandidate[] = [];
  const segmentIds = new Set<string>();
  for (const rawCandidate of rawCandidates) {
    const candidate = captureCandidate(rawCandidate, scope);
    if (candidate === 'scope_mismatch') {
      return { kind: 'projected', source: sourceFailure(scope, partitions, 'denied', 'scope_mismatch') };
    }
    if (candidate === 'invalid') {
      return { kind: 'projected', source: sourceFailure(scope, partitions, 'unavailable', 'invalid_payload') };
    }
    if (candidate !== 'ended') {
      if (segmentIds.has(candidate.item.segmentId)) {
        return { kind: 'projected', source: sourceFailure(scope, partitions, 'unavailable', 'invalid_payload') };
      }
      segmentIds.add(candidate.item.segmentId);
      candidates.push(candidate);
    }
  }
  return { kind: 'projected', source: renderSource(scope, freshness, partitions, candidates, viewer) };
}
