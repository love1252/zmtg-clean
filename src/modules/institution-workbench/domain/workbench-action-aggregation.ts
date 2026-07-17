import {
  CARE_ACTION_PARTITION_KEYS_V1,
  CARE_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1,
  type CareActionCardV1,
  type CareActionItemV1,
  type CareActionOwnerV1,
  type CareActionPartitionKeyV1,
  type CareActionSourceV1,
} from '@/modules/institution-contracts/v1/care-action';
import {
  CONVERSATION_ACTION_PARTITION_KEYS_V1,
  CONVERSATION_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1,
  type ConversationActionAssigneeV1,
  type ConversationActionItemV1,
  type ConversationActionPartitionKeyV1,
  type ConversationActionSourceV1,
} from '@/modules/institution-contracts/v1/conversation-action';
import {
  INSTITUTION_ACTION_SORT_SIGNALS_V1,
  type InstitutionActionSortSignalV1,
} from '@/modules/institution-contracts/v1/institution-action';

import {
  WORKBENCH_DESKTOP_ACTION_LIMIT,
  WORKBENCH_MOBILE_ACTION_LIMIT,
  type WorkbenchActionFilter,
  type WorkbenchActionProjection,
  type WorkbenchActionRowViewModel,
  type WorkbenchActionStableKey,
  type WorkbenchActionSubjectViewModel,
  type WorkbenchAppointmentActionRowViewModel,
  type WorkbenchCareCardViewModel,
  type WorkbenchCareOwnerViewModel,
  type WorkbenchConversationActionRowViewModel,
  type WorkbenchConversationAssigneeViewModel,
  type WorkbenchFollowUpActionRowViewModel,
} from './workbench-action-view-models';

export type BuildWorkbenchActionProjectionInput = {
  care: CareActionSourceV1;
  conversation: ConversationActionSourceV1;
  filter: WorkbenchActionFilter;
};

type CareCardDefinition = {
  [K in CareActionPartitionKeyV1]: {
    key: K;
    title: string;
    canonicalHref: Extract<CareActionCardV1, { key: K }>['canonicalHref'];
  };
}[CareActionPartitionKeyV1];

const CARE_CARD_DEFINITIONS = Object.freeze([
  {
    key: 'pending_confirmation_appointments',
    title: '待确认预约',
    canonicalHref: '/hospital/care/appointments?status=pending_confirmation',
  },
  {
    key: 'reschedule_requested_appointments',
    title: '改约申请',
    canonicalHref: '/hospital/care/appointments?status=reschedule_requested',
  },
  {
    key: 'overdue_followups',
    title: '逾期随访',
    canonicalHref: '/hospital/care/followups?bucket=overdue',
  },
  {
    key: 'today_due_followups',
    title: '今日到期随访',
    canonicalHref: '/hospital/care/followups?bucket=today',
  },
] as const satisfies readonly CareCardDefinition[]);

const CARE_APPOINTMENT_PARTITION_KEYS = Object.freeze([
  'pending_confirmation_appointments',
  'reschedule_requested_appointments',
] as const satisfies readonly CareActionPartitionKeyV1[]);

const CARE_FOLLOW_UP_PARTITION_KEYS = Object.freeze([
  'overdue_followups',
  'today_due_followups',
] as const satisfies readonly CareActionPartitionKeyV1[]);

type ActionSource = CareActionSourceV1 | ConversationActionSourceV1;

type ActionCandidate = {
  key: WorkbenchActionStableKey;
  row: WorkbenchActionRowViewModel;
  businessTimestamp: number;
  fingerprint: string;
};

type CandidateAttempt = {
  key: WorkbenchActionStableKey | null;
  candidate: ActionCandidate | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !value.includes('T')) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isOptionalTimestamp(value: unknown): value is string | null {
  return value === null || toTimestamp(value) !== null;
}

function isSafeSummary(value: unknown, maximumLength: number): value is string | null {
  return value === null || (typeof value === 'string' && [...value].length <= maximumLength);
}

function hasScopeMismatch(source: ActionSource): boolean {
  return (
    source.failureCode === 'scope_mismatch' ||
    source.partitions.some((partition) => partition.failureCode === 'scope_mismatch')
  );
}

function scopesCanBeCombined(
  care: CareActionSourceV1,
  conversation: ConversationActionSourceV1,
): boolean {
  if (
    care.contractVersion !== 'v1' ||
    conversation.contractVersion !== 'v1' ||
    hasScopeMismatch(care) ||
    hasScopeMismatch(conversation)
  ) {
    return false;
  }

  const careScope = care.scope;
  const conversationScope = conversation.scope;

  return (
    isNonEmptyString(careScope.tenantId) &&
    isNonEmptyString(careScope.institutionId) &&
    careScope.tenantId === conversationScope.tenantId &&
    careScope.institutionId === conversationScope.institutionId
  );
}

function findUniqueCarePartition(source: CareActionSourceV1, key: CareActionPartitionKeyV1) {
  const matches = source.partitions.filter((partition) => partition.key === key);
  return matches.length === 1 ? matches[0] : null;
}

function findUniqueCareCard(source: CareActionSourceV1, key: CareActionPartitionKeyV1) {
  const matches = source.data?.cards.filter((card) => card.key === key) ?? [];
  return matches.length === 1 ? matches[0] : null;
}

function isValidCardCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function unavailableCard(definition: CareCardDefinition): WorkbenchCareCardViewModel {
  return {
    key: definition.key,
    title: definition.title,
    status: 'unavailable',
    count: null,
  } as WorkbenchCareCardViewModel;
}

function projectCareCard(
  source: CareActionSourceV1,
  definition: CareCardDefinition,
): WorkbenchCareCardViewModel | null {
  const partition = findUniqueCarePartition(source, definition.key);
  if (!partition) {
    return null;
  }

  if (partition.readiness === 'denied' || partition.readiness === 'disabled') {
    return null;
  }

  if (partition.readiness === 'unavailable') {
    return unavailableCard(definition);
  }

  const card = findUniqueCareCard(source, definition.key);
  const observedAt = partition.freshness?.observedAt ?? null;
  const cardMatchesDefinition =
    card !== null &&
    card.canonicalHref === definition.canonicalHref &&
    isValidCardCount(card.count);

  if (partition.readiness === 'stale') {
    const topAllowsStale = source.readiness === 'stale' || source.readiness === 'partial';
    if (!topAllowsStale || !cardMatchesDefinition || toTimestamp(observedAt) === null) {
      return {
        key: definition.key,
        title: definition.title,
        status: 'stale',
        count: null,
        observedAt: null,
      } as WorkbenchCareCardViewModel;
    }

    return {
      key: definition.key,
      title: definition.title,
      status: 'stale',
      count: card.count,
      observedAt,
    } as WorkbenchCareCardViewModel;
  }

  const topAllowsCurrent =
    source.readiness === 'ready' ||
    source.readiness === 'empty' ||
    source.readiness === 'partial';
  if (!topAllowsCurrent || !cardMatchesDefinition || toTimestamp(observedAt) === null) {
    return unavailableCard(definition);
  }

  if (partition.readiness === 'empty') {
    if (card.count !== 0) {
      return unavailableCard(definition);
    }

    return {
      key: definition.key,
      title: definition.title,
      status: 'empty',
      count: 0,
      observedAt,
      canonicalHref: definition.canonicalHref,
    } as WorkbenchCareCardViewModel;
  }

  if (card.count === 0) {
    return unavailableCard(definition);
  }

  return {
    key: definition.key,
    title: definition.title,
    status: 'ready',
    count: card.count,
    observedAt,
    canonicalHref: definition.canonicalHref,
  } as WorkbenchCareCardViewModel;
}

function buildCareCards(source: CareActionSourceV1): WorkbenchCareCardViewModel[] {
  if (source.readiness === 'denied' || source.readiness === 'disabled') {
    return [];
  }

  return CARE_CARD_DEFINITIONS.flatMap((definition) => {
    const card = projectCareCard(source, definition);
    return card ? [card] : [];
  });
}

function encodeObjectId(value: string): string | null {
  if (!isNonEmptyString(value) || value === '.' || value === '..') {
    return null;
  }

  try {
    return encodeURIComponent(value);
  } catch {
    return null;
  }
}

function projectCustomerSubject(customer: CareActionItemV1['customer']):
  | Extract<WorkbenchActionSubjectViewModel, { kind: 'customer' }>
  | null {
  if (
    customer.contractVersion !== 'v1' ||
    !isNonEmptyString(customer.customerId) ||
    !isNonEmptyString(customer.displayName) ||
    (customer.maskedReference !== null && typeof customer.maskedReference !== 'string')
  ) {
    return null;
  }

  return {
    kind: 'customer',
    displayName: customer.displayName,
    maskedReference: customer.maskedReference,
  };
}

function projectConversationSubject(
  subject: ConversationActionItemV1['subject'],
): WorkbenchActionSubjectViewModel | null {
  if (subject.kind === 'customer') {
    return projectCustomerSubject(subject.customer);
  }

  if (subject.kind === 'unmatched_contact' && subject.label === '待匹配联系人') {
    return {
      kind: 'unmatched_contact',
      label: '待匹配联系人',
    };
  }

  return null;
}

function projectCareOwner(owner: CareActionOwnerV1 | null): WorkbenchCareOwnerViewModel | null {
  if (owner === null) {
    return null;
  }

  if (owner.kind === 'user') {
    if (!isNonEmptyString(owner.userId) || !isNonEmptyString(owner.displayName)) {
      return null;
    }

    return {
      kind: 'user',
      displayName: owner.displayName,
    };
  }

  if (!isNonEmptyString(owner.role)) {
    return null;
  }

  return {
    kind: 'role_pool',
    role: owner.role,
  };
}

function projectConversationAssignee(
  assignee: ConversationActionAssigneeV1 | null,
): WorkbenchConversationAssigneeViewModel | null {
  if (assignee === null) {
    return null;
  }

  if (!isNonEmptyString(assignee.userId) || !isNonEmptyString(assignee.displayName)) {
    return null;
  }

  return {
    displayName: assignee.displayName,
  };
}

function customerFingerprint(customer: CareActionItemV1['customer']) {
  return [
    customer.contractVersion,
    customer.customerId,
    customer.displayName,
    customer.maskedReference,
  ] as const;
}

function careOwnerFingerprint(owner: CareActionOwnerV1 | null) {
  if (owner === null) {
    return null;
  }

  return owner.kind === 'user'
    ? (['user', owner.userId, owner.displayName] as const)
    : (['role_pool', owner.role] as const);
}

function conversationSubjectFingerprint(subject: ConversationActionItemV1['subject']) {
  return subject.kind === 'customer'
    ? (['customer', customerFingerprint(subject.customer)] as const)
    : (['unmatched_contact', subject.label] as const);
}

function conversationAssigneeFingerprint(assignee: ConversationActionAssigneeV1 | null) {
  return assignee === null ? null : ([assignee.userId, assignee.displayName] as const);
}

function careActionFingerprint(item: CareActionItemV1): string {
  return JSON.stringify([
    item.entityType,
    item.objectId,
    item.sourceVersion,
    customerFingerprint(item.customer),
    item.businessState,
    item.appointmentAt,
    item.dueAt,
    item.slaAt,
    item.riskLevel,
    item.priority,
    careOwnerFingerprint(item.owner),
    item.safeSummary,
    item.detailHref,
  ]);
}

function conversationActionFingerprint(item: ConversationActionItemV1): string {
  return JSON.stringify([
    item.conversationId,
    item.segmentId,
    item.sourceVersion,
    item.production,
    conversationSubjectFingerprint(item.subject),
    item.conversationState,
    item.riskState,
    item.lastCustomerMessageAt,
    item.slaAt,
    item.priority,
    conversationAssigneeFingerprint(item.assignee),
    item.safeSummary,
    item.detailHref,
  ]);
}

function normalizeSortSignals(
  values: readonly InstitutionActionSortSignalV1[],
): InstitutionActionSortSignalV1[] | null {
  if (
    !Array.isArray(values) ||
    values.some((value) => !INSTITUTION_ACTION_SORT_SIGNALS_V1.includes(value))
  ) {
    return null;
  }

  const requested = new Set(values);
  return INSTITUTION_ACTION_SORT_SIGNALS_V1.filter((signal) => requested.has(signal));
}

function hasUniqueReadyCarePartition(
  source: CareActionSourceV1,
  key: CareActionPartitionKeyV1,
): boolean {
  const partition = findUniqueCarePartition(source, key);
  return partition?.readiness === 'ready';
}

function normalizeCareMembership(
  source: CareActionSourceV1,
  values: readonly CareActionPartitionKeyV1[],
  allowed: readonly CareActionPartitionKeyV1[],
): CareActionPartitionKeyV1[] | null {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !allowed.includes(value))) {
    return null;
  }

  const requested = new Set(values);
  const normalized = CARE_ACTION_PARTITION_KEYS_V1.filter((key) => requested.has(key));

  return normalized.every((key) => hasUniqueReadyCarePartition(source, key)) ? normalized : null;
}

function findUniqueConversationPartition(
  source: ConversationActionSourceV1,
  key: ConversationActionPartitionKeyV1,
) {
  const matches = source.partitions.filter((partition) => partition.key === key);
  return matches.length === 1 ? matches[0] : null;
}

function normalizeConversationMembership(
  source: ConversationActionSourceV1,
  values: readonly ConversationActionPartitionKeyV1[],
): ConversationActionPartitionKeyV1[] | null {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.some((value) => !CONVERSATION_ACTION_PARTITION_KEYS_V1.includes(value))
  ) {
    return null;
  }

  const requested = new Set(values);
  const normalized = CONVERSATION_ACTION_PARTITION_KEYS_V1.filter((key) => requested.has(key));
  return normalized.every(
    (key) => findUniqueConversationPartition(source, key)?.readiness === 'ready',
  )
    ? normalized
    : null;
}

function careStableKey(item: CareActionItemV1): WorkbenchActionStableKey | null {
  if (!isNonEmptyString(item.objectId)) {
    return null;
  }

  return item.entityType === 'appointment'
    ? `appointment:${item.objectId}`
    : `followup:${item.objectId}`;
}

function conversationStableKey(item: ConversationActionItemV1): WorkbenchActionStableKey | null {
  return isNonEmptyString(item.conversationId) ? `conversation:${item.conversationId}` : null;
}

function invalidAttempt(key: WorkbenchActionStableKey | null): CandidateAttempt {
  return { key, candidate: null };
}

function normalizeCareAction(
  source: CareActionSourceV1,
  item: CareActionItemV1,
): CandidateAttempt {
  const key = careStableKey(item);
  const encodedId = encodeObjectId(item.objectId);
  const subject = projectCustomerSubject(item.customer);
  const owner = projectCareOwner(item.owner);
  const sortSignals = normalizeSortSignals(item.sortSignals);

  if (
    key === null ||
    encodedId === null ||
    !isNonEmptyString(item.sourceVersion) ||
    subject === null ||
    (item.owner !== null && owner === null) ||
    sortSignals === null ||
    !isOptionalTimestamp(item.appointmentAt) ||
    !isOptionalTimestamp(item.dueAt) ||
    !isOptionalTimestamp(item.slaAt) ||
    !isSafeSummary(item.safeSummary, CARE_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1) ||
    (sortSignals.includes('sla_due') && item.slaAt === null)
  ) {
    return invalidAttempt(key);
  }

  const slaTimestamp = item.slaAt === null ? null : toTimestamp(item.slaAt);
  if (sortSignals.includes('sla_due') && slaTimestamp === null) {
    return invalidAttempt(key);
  }

  if (item.entityType === 'appointment') {
    const appointmentAt = item.appointmentAt;
    const appointmentTimestamp = toTimestamp(appointmentAt);
    const cardKeys = normalizeCareMembership(
      source,
      item.cardKeys,
      CARE_APPOINTMENT_PARTITION_KEYS,
    );
    const detailHref = `/hospital/care/appointments/${encodedId}` as const;

    if (
      appointmentAt === null ||
      appointmentTimestamp === null ||
      cardKeys === null ||
      item.detailHref !== detailHref
    ) {
      return invalidAttempt(key);
    }

    const row: WorkbenchAppointmentActionRowViewModel = {
      key: key as `appointment:${string}`,
      kind: 'appointment',
      subject,
      businessState: item.businessState,
      cardKeys,
      sortSignals,
      appointmentAt,
      slaAt: item.slaAt,
      riskLevel: item.riskLevel,
      priority: item.priority,
      owner,
      safeSummary: item.safeSummary,
      detailHref,
    };

    return {
      key,
      candidate: {
        key,
        row,
        businessTimestamp: appointmentTimestamp,
        fingerprint: careActionFingerprint(item),
      },
    };
  }

  const dueAt = item.dueAt;
  const dueTimestamp = toTimestamp(dueAt);
  const cardKeys = normalizeCareMembership(
    source,
    item.cardKeys,
    CARE_FOLLOW_UP_PARTITION_KEYS,
  );
  const detailHref = `/hospital/care/followups/${encodedId}` as const;

  if (
    dueAt === null ||
    dueTimestamp === null ||
    cardKeys === null ||
    item.detailHref !== detailHref
  ) {
    return invalidAttempt(key);
  }

  const row: WorkbenchFollowUpActionRowViewModel = {
    key: key as `followup:${string}`,
    kind: 'followup',
    subject,
    businessState: item.businessState,
    cardKeys,
    sortSignals,
    dueAt,
    slaAt: item.slaAt,
    riskLevel: item.riskLevel,
    priority: item.priority,
    owner,
    safeSummary: item.safeSummary,
    detailHref,
  };

  return {
    key,
    candidate: {
      key,
      row,
      businessTimestamp: dueTimestamp,
      fingerprint: careActionFingerprint(item),
    },
  };
}

function normalizeConversationAction(
  source: ConversationActionSourceV1,
  item: ConversationActionItemV1,
): CandidateAttempt {
  const key = conversationStableKey(item);
  const encodedId = encodeObjectId(item.conversationId);
  const subject = projectConversationSubject(item.subject);
  const assignee = projectConversationAssignee(item.assignee);
  const partitions = normalizeConversationMembership(source, item.partitions);
  const sortSignals = normalizeSortSignals(item.sortSignals);

  if (
    key === null ||
    encodedId === null ||
    !isNonEmptyString(item.segmentId) ||
    !isNonEmptyString(item.sourceVersion) ||
    item.production !== true ||
    subject === null ||
    (item.assignee !== null && assignee === null) ||
    partitions === null ||
    sortSignals === null ||
    !isOptionalTimestamp(item.slaAt) ||
    !isSafeSummary(item.safeSummary, CONVERSATION_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1)
  ) {
    return invalidAttempt(key);
  }

  const businessTimestamp = toTimestamp(item.lastCustomerMessageAt);
  const slaTimestamp = item.slaAt === null ? null : toTimestamp(item.slaAt);
  const detailHref = `/hospital/conversations/${encodedId}` as const;

  if (
    businessTimestamp === null ||
    (sortSignals.includes('sla_due') && slaTimestamp === null) ||
    item.detailHref !== detailHref
  ) {
    return invalidAttempt(key);
  }

  const row: WorkbenchConversationActionRowViewModel = {
    key: key as `conversation:${string}`,
    kind: 'conversation',
    subject,
    conversationState: item.conversationState,
    riskState: item.riskState,
    partitions,
    sortSignals,
    lastCustomerMessageAt: item.lastCustomerMessageAt,
    slaAt: item.slaAt,
    priority: item.priority,
    assignee,
    safeSummary: item.safeSummary,
    detailHref,
  };

  return {
    key,
    candidate: {
      key,
      row,
      businessTimestamp,
      fingerprint: conversationActionFingerprint(item),
    },
  };
}

function sourceContributesCurrentActions(source: ActionSource): boolean {
  return source.readiness === 'ready' || source.readiness === 'partial';
}

function collectCandidateAttempts(
  care: CareActionSourceV1,
  conversation: ConversationActionSourceV1,
): CandidateAttempt[] {
  const careAttempts =
    sourceContributesCurrentActions(care) && care.data !== null
      ? care.data.actions.map((item) => normalizeCareAction(care, item))
      : [];
  const conversationAttempts =
    sourceContributesCurrentActions(conversation) && conversation.data !== null
      ? conversation.data.actions.map((item) => normalizeConversationAction(conversation, item))
      : [];

  return [...careAttempts, ...conversationAttempts];
}

function mergeSignals(
  left: readonly InstitutionActionSortSignalV1[],
  right: readonly InstitutionActionSortSignalV1[],
): InstitutionActionSortSignalV1[] {
  const requested = new Set([...left, ...right]);
  return INSTITUTION_ACTION_SORT_SIGNALS_V1.filter((signal) => requested.has(signal));
}

function mergeCareKeys(
  left: readonly CareActionPartitionKeyV1[],
  right: readonly CareActionPartitionKeyV1[],
): CareActionPartitionKeyV1[] {
  const requested = new Set([...left, ...right]);
  return CARE_ACTION_PARTITION_KEYS_V1.filter((key) => requested.has(key));
}

function mergeConversationKeys(
  left: readonly ConversationActionPartitionKeyV1[],
  right: readonly ConversationActionPartitionKeyV1[],
): ConversationActionPartitionKeyV1[] {
  const requested = new Set([...left, ...right]);
  return CONVERSATION_ACTION_PARTITION_KEYS_V1.filter((key) => requested.has(key));
}

function mergeCandidates(left: ActionCandidate, right: ActionCandidate): ActionCandidate | null {
  if (left.fingerprint !== right.fingerprint || left.row.kind !== right.row.kind) {
    return null;
  }

  const sortSignals = mergeSignals(left.row.sortSignals, right.row.sortSignals);
  let row: WorkbenchActionRowViewModel;

  if (left.row.kind === 'appointment' && right.row.kind === 'appointment') {
    row = {
      ...left.row,
      cardKeys: mergeCareKeys(left.row.cardKeys, right.row.cardKeys),
      sortSignals,
    };
  } else if (left.row.kind === 'followup' && right.row.kind === 'followup') {
    row = {
      ...left.row,
      cardKeys: mergeCareKeys(left.row.cardKeys, right.row.cardKeys),
      sortSignals,
    };
  } else if (left.row.kind === 'conversation' && right.row.kind === 'conversation') {
    row = {
      ...left.row,
      partitions: mergeConversationKeys(left.row.partitions, right.row.partitions),
      sortSignals,
    };
  } else {
    return null;
  }

  return {
    ...left,
    row,
  };
}

function deduplicateCandidates(attempts: readonly CandidateAttempt[]): ActionCandidate[] {
  const rejectedKeys = new Set<WorkbenchActionStableKey>();
  const candidates = new Map<WorkbenchActionStableKey, ActionCandidate>();

  for (const attempt of attempts) {
    if (attempt.key === null) {
      continue;
    }

    if (attempt.candidate === null) {
      rejectedKeys.add(attempt.key);
      candidates.delete(attempt.key);
      continue;
    }

    if (rejectedKeys.has(attempt.key)) {
      continue;
    }

    const existing = candidates.get(attempt.key);
    if (!existing) {
      candidates.set(attempt.key, attempt.candidate);
      continue;
    }

    const merged = mergeCandidates(existing, attempt.candidate);
    if (!merged) {
      rejectedKeys.add(attempt.key);
      candidates.delete(attempt.key);
      continue;
    }

    candidates.set(attempt.key, merged);
  }

  return [...candidates.values()].filter((candidate) => !rejectedKeys.has(candidate.key));
}

function matchesFilter(row: WorkbenchActionRowViewModel, filter: WorkbenchActionFilter): boolean {
  if (filter === 'all') {
    return true;
  }

  return row.kind === filter;
}

function sortRank(row: WorkbenchActionRowViewModel): number {
  const signals = new Set(row.sortSignals);
  const rank = INSTITUTION_ACTION_SORT_SIGNALS_V1.findIndex((signal) => signals.has(signal));
  return rank === -1 ? INSTITUTION_ACTION_SORT_SIGNALS_V1.length : rank;
}

function compareStableKeys(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function compareCandidates(left: ActionCandidate, right: ActionCandidate): number {
  const rankDelta = sortRank(left.row) - sortRank(right.row);
  if (rankDelta !== 0) {
    return rankDelta;
  }

  const timeDelta = left.businessTimestamp - right.businessTimestamp;
  if (timeDelta !== 0) {
    return timeDelta;
  }

  return compareStableKeys(left.key, right.key);
}

/**
 * Pure projection over typed snapshots that an approved reader/parser has already validated and
 * scope-filtered. This function is not a wire parser, provider, authorizer, or target-page access
 * decision. It never reads repositories and never grants permission from matching scope strings.
 */
export function buildWorkbenchActionProjection(
  input: BuildWorkbenchActionProjectionInput,
): WorkbenchActionProjection {
  if (!scopesCanBeCombined(input.care, input.conversation)) {
    return {
      status: 'blocked',
      filter: input.filter,
      cards: [],
      desktopActions: [],
      mobileActions: [],
    };
  }

  const orderedActions = deduplicateCandidates(
    collectCandidateAttempts(input.care, input.conversation),
  )
    .filter((candidate) => matchesFilter(candidate.row, input.filter))
    .sort(compareCandidates)
    .map((candidate) => candidate.row);
  const desktopActions = orderedActions.slice(0, WORKBENCH_DESKTOP_ACTION_LIMIT);
  const mobileActions = desktopActions.slice(0, WORKBENCH_MOBILE_ACTION_LIMIT);

  return {
    status: 'projected',
    filter: input.filter,
    sourceReadiness: {
      care: input.care.readiness,
      conversation: input.conversation.readiness,
    },
    cards: buildCareCards(input.care),
    desktopActions,
    mobileActions,
  };
}
