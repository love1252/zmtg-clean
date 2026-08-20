import type { ConversationSegmentState } from '@/modules/institution-conversations/domain/conversation-segments';

export const conversationAssignmentStatuses = Object.freeze([
  'assigned',
  'accepted',
  'rejected',
  'released',
] as const);

export const conversationAssignmentReasonCodes = Object.freeze([
  'manual_assign',
  'manual_reassign',
  'manual_fallback',
  'assignee_reject',
  'handler_release',
] as const);

export const conversationAssignmentActorRoles = Object.freeze([
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
] as const);

export type ConversationAssignmentStatus = (typeof conversationAssignmentStatuses)[number];
export type ConversationAssignmentReasonCode = (typeof conversationAssignmentReasonCodes)[number];
export type ConversationAssignmentActorRole = (typeof conversationAssignmentActorRoles)[number];

export type ConversationAssignmentFact = Readonly<{
  eventId: string;
  assignmentId: string;
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
  revision: number;
  status: ConversationAssignmentStatus;
  assigneeUserId: string;
  assigneeRole: ConversationAssignmentActorRole;
  actorUserId: string;
  actorRole: ConversationAssignmentActorRole;
  reasonCode: ConversationAssignmentReasonCode;
  sourceSegmentState: ConversationSegmentState;
  occurredAt: string;
  idempotencyKey: string;
}>;

export type ConversationAssignmentHistory = readonly ConversationAssignmentFact[];

export type ConversationAssignmentTarget = Readonly<{
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
}>;

export type ConversationAssignmentProjection = Readonly<{
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
  revision: number;
  assignmentId: string | null;
  assigneeRole: ConversationAssignmentActorRole | null;
  assignmentStatus: 'assigned' | 'accepted' | null;
  activeAssignmentCount: 0 | 1;
  assigneeId: string | null;
}>;

export type ConversationAssignmentBlockCode =
  | 'invalid_command'
  | 'invalid_identifier'
  | 'invalid_timestamp'
  | 'invalid_assignment_history'
  | 'scope_mismatch'
  | 'target_mismatch'
  | 'revision_conflict'
  | 'revision_exhausted'
  | 'idempotency_conflict'
  | 'actor_role_not_allowed'
  | 'actor_not_assignee'
  | 'transition_not_allowed'
  | 'assignment_id_conflict'
  | 'event_id_conflict'
  | 'assignee_unchanged';

export type ConversationAssignmentProjectionResult =
  | Readonly<{
      kind: 'projected';
      projection: ConversationAssignmentProjection;
    }>
  | Readonly<{
      kind: 'blocked';
      code: ConversationAssignmentBlockCode;
    }>;

export type ConversationAssignmentMutationResult =
  | Readonly<{
      kind: 'applied' | 'replayed';
      history: ConversationAssignmentHistory;
      operationFacts: ConversationAssignmentHistory;
      projection: ConversationAssignmentProjection;
    }>
  | Readonly<{
      kind: 'blocked';
      code: ConversationAssignmentBlockCode;
    }>;

type AssignCommand = Readonly<{
  eventId: string;
  assignmentId: string;
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
  expectedRevision: number;
  idempotencyKey: string;
  actorUserId: string;
  actorRole: ConversationAssignmentActorRole;
  assigneeUserId: string;
  assigneeRole: ConversationAssignmentActorRole;
  sourceSegmentState: ConversationSegmentState;
  occurredAt: string;
}>;

type AssignmentDecisionCommand = Readonly<{
  eventId: string;
  assignmentId: string;
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
  expectedRevision: number;
  idempotencyKey: string;
  actorUserId: string;
  actorRole: ConversationAssignmentActorRole;
  sourceSegmentState: ConversationSegmentState;
  occurredAt: string;
}>;

type ReassignCommand = Readonly<{
  releaseEventId: string;
  assignedEventId: string;
  currentAssignmentId: string;
  newAssignmentId: string;
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
  expectedRevision: number;
  idempotencyKey: string;
  actorUserId: string;
  actorRole: ConversationAssignmentActorRole;
  newAssigneeUserId: string;
  newAssigneeRole: ConversationAssignmentActorRole;
  sourceSegmentState: ConversationSegmentState;
  occurredAt: string;
}>;

type ActiveAssignment = Readonly<{
  assignmentId: string;
  assigneeUserId: string;
  assigneeRole: ConversationAssignmentActorRole;
  status: 'assigned' | 'accepted';
  originReasonCode: 'manual_assign' | 'manual_reassign' | 'manual_fallback';
}>;

type HistoryInspection = Readonly<{
  facts: ConversationAssignmentHistory;
  target: ConversationAssignmentTarget | null;
  revision: number;
  activeAssignment: ActiveAssignment | null;
  eventIds: ReadonlySet<string>;
  assignedIds: ReadonlySet<string>;
  operationsByIdempotencyKey: ReadonlyMap<string, ConversationAssignmentHistory>;
  handlerReleased: boolean;
}>;

type HistoryInspectionResult =
  | Readonly<{ kind: 'valid'; inspection: HistoryInspection }>
  | Readonly<{ kind: 'blocked'; code: 'invalid_assignment_history' }>;

type ParsedCommand<T> =
  | Readonly<{ kind: 'valid'; command: T }>
  | Readonly<{
      kind: 'blocked';
      code: 'invalid_command' | 'invalid_identifier' | 'invalid_timestamp';
    }>;

const opaqueReferencePatterns = Object.freeze({
  eventId: /^ase_[a-f][a-f0-9]{15,63}$/u,
  assignmentId: /^asn_[a-f][a-f0-9]{15,63}$/u,
  tenantId: /^ten_[a-f][a-f0-9]{15,63}$/u,
  institutionId: /^ins_[a-f][a-f0-9]{15,63}$/u,
  conversationId: /^con_[a-f][a-f0-9]{15,63}$/u,
  segmentId: /^seg_[a-f][a-f0-9]{15,63}$/u,
  userId: /^usr_[a-f][a-f0-9]{15,63}$/u,
} as const);
const safeIdempotencyKeyPattern = /^idem_[a-f][a-f0-9]{31,63}$/u;
const canonicalUtcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const targetKeys = ['tenantId', 'institutionId', 'conversationId', 'segmentId'] as const;
const factKeys = [
  'eventId',
  'assignmentId',
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'revision',
  'status',
  'assigneeUserId',
  'assigneeRole',
  'actorUserId',
  'actorRole',
  'reasonCode',
  'sourceSegmentState',
  'occurredAt',
  'idempotencyKey',
] as const;
const assignCommandKeys = [
  'eventId',
  'assignmentId',
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'expectedRevision',
  'idempotencyKey',
  'actorUserId',
  'actorRole',
  'assigneeUserId',
  'assigneeRole',
  'sourceSegmentState',
  'occurredAt',
] as const;
const decisionCommandKeys = [
  'eventId',
  'assignmentId',
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'expectedRevision',
  'idempotencyKey',
  'actorUserId',
  'actorRole',
  'sourceSegmentState',
  'occurredAt',
] as const;
const reassignCommandKeys = [
  'releaseEventId',
  'assignedEventId',
  'currentAssignmentId',
  'newAssignmentId',
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'expectedRevision',
  'idempotencyKey',
  'actorUserId',
  'actorRole',
  'newAssigneeUserId',
  'newAssigneeRole',
  'sourceSegmentState',
  'occurredAt',
] as const;

const deepFreeze = <T>(value: T, seen = new Set<object>()): T => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return value;
  }
  const objectValue = value as object;
  if (seen.has(objectValue)) {
    return value;
  }
  seen.add(objectValue);
  for (const key of Reflect.ownKeys(objectValue)) {
    const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
    if (descriptor && 'value' in descriptor) {
      deepFreeze(descriptor.value, seen);
    }
  }
  return Object.freeze(value);
};

const blocked = (
  code: ConversationAssignmentBlockCode,
): Extract<ConversationAssignmentMutationResult, { kind: 'blocked' }> => deepFreeze({
  kind: 'blocked',
  code,
});

const projectionBlocked = (
  code: ConversationAssignmentBlockCode,
): Extract<ConversationAssignmentProjectionResult, { kind: 'blocked' }> => deepFreeze({
  kind: 'blocked',
  code,
});

const isOpaqueReference = (
  value: unknown,
  kind: keyof typeof opaqueReferencePatterns,
): value is string => (
  typeof value === 'string' && opaqueReferencePatterns[kind].test(value)
);

const isSafeIdempotencyKey = (value: unknown): value is string => (
  typeof value === 'string' && safeIdempotencyKeyPattern.test(value)
);

const isCanonicalUtcTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string' || !canonicalUtcTimestampPattern.test(value)) {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
};

const isSafeRevision = (value: unknown): value is number => (
  typeof value === 'number'
  && Number.isSafeInteger(value)
  && value >= 0
);

const captureExactDataRecord = (
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | null => {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const ownKeys = Reflect.ownKeys(value);
    if (
      ownKeys.length !== keys.length
      || ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))
    ) {
      return null;
    }
    const captured: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) {
        return null;
      }
      if (
        descriptor.value !== null
        && (typeof descriptor.value === 'object' || typeof descriptor.value === 'function')
      ) {
        return null;
      }
      captured[key] = descriptor.value;
    }
    structuredClone(value);
    return captured;
  } catch {
    return null;
  }
};

const capturePlainHistoryArray = (value: unknown): unknown[] | null => {
  try {
    if (!Array.isArray(value)) {
      return null;
    }
    const length = value.length;
    if (!Number.isSafeInteger(length) || length < 0) {
      return null;
    }
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.length !== length + 1 || !ownKeys.includes('length')) {
      return null;
    }
    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      if (!ownKeys.includes(key)) {
        return null;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) {
        return null;
      }
      snapshot.push(descriptor.value);
    }
    return snapshot;
  } catch {
    return null;
  }
};

const isRole = (value: unknown): value is ConversationAssignmentActorRole => (
  typeof value === 'string'
  && conversationAssignmentActorRoles.includes(value as ConversationAssignmentActorRole)
);

const isStatus = (value: unknown): value is ConversationAssignmentStatus => (
  typeof value === 'string'
  && conversationAssignmentStatuses.includes(value as ConversationAssignmentStatus)
);

const isReasonCode = (value: unknown): value is ConversationAssignmentReasonCode => (
  typeof value === 'string'
  && conversationAssignmentReasonCodes.includes(value as ConversationAssignmentReasonCode)
);

const isSegmentState = (value: unknown): value is ConversationSegmentState => (
  value === 'ai_handling'
  || value === 'awaiting_human'
  || value === 'human_handling'
  || value === 'waiting_customer'
  || value === 'closed'
);

const isAssignmentOriginReason = (
  value: ConversationAssignmentReasonCode,
): value is ActiveAssignment['originReasonCode'] => (
  value === 'manual_assign'
  || value === 'manual_reassign'
  || value === 'manual_fallback'
);

const isAssignmentAdministrator = (role: ConversationAssignmentActorRole): boolean => (
  role === 'tenant_admin' || role === 'tenant_operator'
);

const factTarget = (fact: ConversationAssignmentFact): ConversationAssignmentTarget => ({
  tenantId: fact.tenantId,
  institutionId: fact.institutionId,
  conversationId: fact.conversationId,
  segmentId: fact.segmentId,
});

const commandTarget = (
  command: AssignCommand | AssignmentDecisionCommand | ReassignCommand,
): ConversationAssignmentTarget => ({
  tenantId: command.tenantId,
  institutionId: command.institutionId,
  conversationId: command.conversationId,
  segmentId: command.segmentId,
});

const sameTarget = (
  left: ConversationAssignmentTarget,
  right: ConversationAssignmentTarget,
): boolean => (
  left.tenantId === right.tenantId
  && left.institutionId === right.institutionId
  && left.conversationId === right.conversationId
  && left.segmentId === right.segmentId
);

const compareTarget = (
  expected: ConversationAssignmentTarget,
  actual: ConversationAssignmentTarget,
): ConversationAssignmentBlockCode | null => {
  if (
    expected.tenantId !== actual.tenantId
    || expected.institutionId !== actual.institutionId
  ) {
    return 'scope_mismatch';
  }
  if (
    expected.conversationId !== actual.conversationId
    || expected.segmentId !== actual.segmentId
  ) {
    return 'target_mismatch';
  }
  return null;
};

const cloneFact = (fact: ConversationAssignmentFact): ConversationAssignmentFact => ({ ...fact });
const cloneHistory = (history: ConversationAssignmentHistory): ConversationAssignmentFact[] => (
  history.map(cloneFact)
);

const buildProjection = (
  target: ConversationAssignmentTarget,
  revision: number,
  activeAssignment: ActiveAssignment | null,
): ConversationAssignmentProjection => ({
  ...target,
  revision,
  assignmentId: activeAssignment?.assignmentId ?? null,
  assigneeRole: activeAssignment?.assigneeRole ?? null,
  assignmentStatus: activeAssignment?.status ?? null,
  activeAssignmentCount: activeAssignment === null ? 0 : 1,
  assigneeId: activeAssignment?.assigneeUserId ?? null,
});

const parseTarget = (value: unknown): ParsedCommand<ConversationAssignmentTarget> => {
  const captured = captureExactDataRecord(value, targetKeys);
  if (!captured) {
    return { kind: 'blocked', code: 'invalid_command' };
  }
  if (
    !isOpaqueReference(captured.tenantId, 'tenantId')
    || !isOpaqueReference(captured.institutionId, 'institutionId')
    || !isOpaqueReference(captured.conversationId, 'conversationId')
    || !isOpaqueReference(captured.segmentId, 'segmentId')
  ) {
    return { kind: 'blocked', code: 'invalid_identifier' };
  }
  return {
    kind: 'valid',
    command: {
      tenantId: captured.tenantId,
      institutionId: captured.institutionId,
      conversationId: captured.conversationId,
      segmentId: captured.segmentId,
    },
  };
};

const parseCommandTarget = (
  value: unknown,
  keys: readonly string[],
): ParsedCommand<ConversationAssignmentTarget> => {
  const captured = captureExactDataRecord(value, keys);
  if (!captured) {
    return { kind: 'blocked', code: 'invalid_command' };
  }
  return parseTarget({
    tenantId: captured.tenantId,
    institutionId: captured.institutionId,
    conversationId: captured.conversationId,
    segmentId: captured.segmentId,
  });
};

const parseAssignCommand = (value: unknown): ParsedCommand<AssignCommand> => {
  const captured = captureExactDataRecord(value, assignCommandKeys);
  if (!captured) {
    return { kind: 'blocked', code: 'invalid_command' };
  }
  if (
    !isOpaqueReference(captured.eventId, 'eventId')
    || !isOpaqueReference(captured.assignmentId, 'assignmentId')
    || !isOpaqueReference(captured.tenantId, 'tenantId')
    || !isOpaqueReference(captured.institutionId, 'institutionId')
    || !isOpaqueReference(captured.conversationId, 'conversationId')
    || !isOpaqueReference(captured.segmentId, 'segmentId')
    || !isOpaqueReference(captured.actorUserId, 'userId')
    || !isOpaqueReference(captured.assigneeUserId, 'userId')
    || !isSafeIdempotencyKey(captured.idempotencyKey)
  ) {
    return { kind: 'blocked', code: 'invalid_identifier' };
  }
  if (
    !isSafeRevision(captured.expectedRevision)
    || !isRole(captured.actorRole)
    || !isRole(captured.assigneeRole)
    || !isSegmentState(captured.sourceSegmentState)
  ) {
    return { kind: 'blocked', code: 'invalid_command' };
  }
  if (!isCanonicalUtcTimestamp(captured.occurredAt)) {
    return { kind: 'blocked', code: 'invalid_timestamp' };
  }
  return { kind: 'valid', command: captured as AssignCommand };
};

const parseDecisionCommand = (value: unknown): ParsedCommand<AssignmentDecisionCommand> => {
  const captured = captureExactDataRecord(value, decisionCommandKeys);
  if (!captured) {
    return { kind: 'blocked', code: 'invalid_command' };
  }
  if (
    !isOpaqueReference(captured.eventId, 'eventId')
    || !isOpaqueReference(captured.assignmentId, 'assignmentId')
    || !isOpaqueReference(captured.tenantId, 'tenantId')
    || !isOpaqueReference(captured.institutionId, 'institutionId')
    || !isOpaqueReference(captured.conversationId, 'conversationId')
    || !isOpaqueReference(captured.segmentId, 'segmentId')
    || !isOpaqueReference(captured.actorUserId, 'userId')
    || !isSafeIdempotencyKey(captured.idempotencyKey)
  ) {
    return { kind: 'blocked', code: 'invalid_identifier' };
  }
  if (
    !isSafeRevision(captured.expectedRevision)
    || !isRole(captured.actorRole)
    || !isSegmentState(captured.sourceSegmentState)
  ) {
    return { kind: 'blocked', code: 'invalid_command' };
  }
  if (!isCanonicalUtcTimestamp(captured.occurredAt)) {
    return { kind: 'blocked', code: 'invalid_timestamp' };
  }
  return { kind: 'valid', command: captured as AssignmentDecisionCommand };
};

const parseReassignCommand = (value: unknown): ParsedCommand<ReassignCommand> => {
  const captured = captureExactDataRecord(value, reassignCommandKeys);
  if (!captured) {
    return { kind: 'blocked', code: 'invalid_command' };
  }
  if (
    !isOpaqueReference(captured.releaseEventId, 'eventId')
    || !isOpaqueReference(captured.assignedEventId, 'eventId')
    || !isOpaqueReference(captured.currentAssignmentId, 'assignmentId')
    || !isOpaqueReference(captured.newAssignmentId, 'assignmentId')
    || !isOpaqueReference(captured.tenantId, 'tenantId')
    || !isOpaqueReference(captured.institutionId, 'institutionId')
    || !isOpaqueReference(captured.conversationId, 'conversationId')
    || !isOpaqueReference(captured.segmentId, 'segmentId')
    || !isOpaqueReference(captured.actorUserId, 'userId')
    || !isOpaqueReference(captured.newAssigneeUserId, 'userId')
    || !isSafeIdempotencyKey(captured.idempotencyKey)
  ) {
    return { kind: 'blocked', code: 'invalid_identifier' };
  }
  if (
    !isSafeRevision(captured.expectedRevision)
    || !isRole(captured.actorRole)
    || !isRole(captured.newAssigneeRole)
    || !isSegmentState(captured.sourceSegmentState)
  ) {
    return { kind: 'blocked', code: 'invalid_command' };
  }
  if (!isCanonicalUtcTimestamp(captured.occurredAt)) {
    return { kind: 'blocked', code: 'invalid_timestamp' };
  }
  return { kind: 'valid', command: captured as ReassignCommand };
};

const parseFact = (value: unknown): ConversationAssignmentFact | null => {
  const captured = captureExactDataRecord(value, factKeys);
  if (!captured) {
    return null;
  }
  if (
    !isOpaqueReference(captured.eventId, 'eventId')
    || !isOpaqueReference(captured.assignmentId, 'assignmentId')
    || !isOpaqueReference(captured.tenantId, 'tenantId')
    || !isOpaqueReference(captured.institutionId, 'institutionId')
    || !isOpaqueReference(captured.conversationId, 'conversationId')
    || !isOpaqueReference(captured.segmentId, 'segmentId')
    || !isOpaqueReference(captured.assigneeUserId, 'userId')
    || !isOpaqueReference(captured.actorUserId, 'userId')
    || !isSafeIdempotencyKey(captured.idempotencyKey)
    || !isSafeRevision(captured.revision)
    || captured.revision < 1
    || !isStatus(captured.status)
    || !isRole(captured.assigneeRole)
    || !isRole(captured.actorRole)
    || !isReasonCode(captured.reasonCode)
    || !isSegmentState(captured.sourceSegmentState)
    || !isCanonicalUtcTimestamp(captured.occurredAt)
  ) {
    return null;
  }
  return captured as ConversationAssignmentFact;
};

const invalidHistory = (): HistoryInspectionResult => ({
  kind: 'blocked',
  code: 'invalid_assignment_history',
});

const inspectHistory = (rawHistory: unknown): HistoryInspectionResult => {
  try {
    const historySnapshot = capturePlainHistoryArray(rawHistory);
    if (!historySnapshot) {
      return invalidHistory();
    }
    const facts: ConversationAssignmentFact[] = [];
    for (const rawFact of historySnapshot) {
      const fact = parseFact(rawFact);
      if (!fact) {
        return invalidHistory();
      }
      facts.push(fact);
    }
    structuredClone(rawHistory);

    if (facts.length === 0) {
      return {
        kind: 'valid',
        inspection: {
          facts,
          target: null,
          revision: 0,
          activeAssignment: null,
          eventIds: new Set(),
          assignedIds: new Set(),
          operationsByIdempotencyKey: new Map(),
          handlerReleased: false,
        },
      };
    }

    const target = factTarget(facts[0]!);
    const eventIds = new Set<string>();
    const assignedIds = new Set<string>();
    let previousOccurredAt: string | null = null;

    for (let index = 0; index < facts.length; index += 1) {
      const fact = facts[index]!;
      if (
        fact.revision !== index + 1
        || !sameTarget(target, factTarget(fact))
        || eventIds.has(fact.eventId)
        || (previousOccurredAt !== null && fact.occurredAt < previousOccurredAt)
      ) {
        return invalidHistory();
      }
      eventIds.add(fact.eventId);
      previousOccurredAt = fact.occurredAt;
    }

    const operationsByIdempotencyKey = new Map<string, ConversationAssignmentHistory>();
    let activeAssignment: ActiveAssignment | null = null;
    let handlerReleased = false;

    for (let index = 0; index < facts.length; index += 1) {
      const fact = facts[index]!;

      if (fact.status === 'released' && fact.reasonCode === 'manual_reassign') {
        const replacement = facts[index + 1];
        if (
          !replacement
          || replacement.status !== 'assigned'
          || replacement.reasonCode !== 'manual_reassign'
          || replacement.idempotencyKey !== fact.idempotencyKey
          || replacement.revision !== fact.revision + 1
          || replacement.occurredAt !== fact.occurredAt
          || replacement.actorUserId !== fact.actorUserId
          || replacement.actorRole !== fact.actorRole
          || replacement.sourceSegmentState !== 'awaiting_human'
          || fact.sourceSegmentState !== 'awaiting_human'
          || !isAssignmentAdministrator(fact.actorRole)
          || activeAssignment === null
          || activeAssignment.status !== 'assigned'
          || fact.assignmentId !== activeAssignment.assignmentId
          || fact.assigneeUserId !== activeAssignment.assigneeUserId
          || fact.assigneeRole !== activeAssignment.assigneeRole
          || replacement.assignmentId === activeAssignment.assignmentId
          || replacement.assigneeUserId === activeAssignment.assigneeUserId
          || assignedIds.has(replacement.assignmentId)
          || operationsByIdempotencyKey.has(fact.idempotencyKey)
        ) {
          return invalidHistory();
        }
        assignedIds.add(replacement.assignmentId);
        activeAssignment = {
          assignmentId: replacement.assignmentId,
          assigneeUserId: replacement.assigneeUserId,
          assigneeRole: replacement.assigneeRole,
          status: 'assigned',
          originReasonCode: 'manual_reassign',
        };
        operationsByIdempotencyKey.set(fact.idempotencyKey, [fact, replacement]);
        index += 1;
        continue;
      }

      if (operationsByIdempotencyKey.has(fact.idempotencyKey)) {
        return invalidHistory();
      }

      if (fact.status === 'assigned') {
        if (
          !isAssignmentOriginReason(fact.reasonCode)
          || fact.reasonCode === 'manual_reassign'
          || fact.sourceSegmentState !== 'awaiting_human'
          || !isAssignmentAdministrator(fact.actorRole)
          || activeAssignment !== null
          || assignedIds.has(fact.assignmentId)
        ) {
          return invalidHistory();
        }
        assignedIds.add(fact.assignmentId);
        handlerReleased = false;
        activeAssignment = {
          assignmentId: fact.assignmentId,
          assigneeUserId: fact.assigneeUserId,
          assigneeRole: fact.assigneeRole,
          status: 'assigned',
          originReasonCode: fact.reasonCode,
        };
      } else if (fact.status === 'accepted') {
        if (
          activeAssignment === null
          || activeAssignment.status !== 'assigned'
          || fact.assignmentId !== activeAssignment.assignmentId
          || fact.assigneeUserId !== activeAssignment.assigneeUserId
          || fact.assigneeRole !== activeAssignment.assigneeRole
          || fact.actorUserId !== activeAssignment.assigneeUserId
          || fact.reasonCode !== activeAssignment.originReasonCode
          || fact.sourceSegmentState !== 'awaiting_human'
        ) {
          return invalidHistory();
        }
        activeAssignment = {
          assignmentId: fact.assignmentId,
          assigneeUserId: fact.assigneeUserId,
          assigneeRole: fact.assigneeRole,
          status: 'accepted',
          originReasonCode: fact.reasonCode as ActiveAssignment['originReasonCode'],
        };
      } else if (fact.status === 'rejected') {
        if (
          activeAssignment === null
          || activeAssignment.status !== 'assigned'
          || fact.assignmentId !== activeAssignment.assignmentId
          || fact.assigneeUserId !== activeAssignment.assigneeUserId
          || fact.assigneeRole !== activeAssignment.assigneeRole
          || fact.actorUserId !== activeAssignment.assigneeUserId
          || fact.reasonCode !== 'assignee_reject'
          || fact.sourceSegmentState !== 'awaiting_human'
        ) {
          return invalidHistory();
        }
        activeAssignment = null;
      } else if (fact.status === 'released') {
        if (
          fact.reasonCode !== 'handler_release'
          || (fact.sourceSegmentState !== 'human_handling'
            && fact.sourceSegmentState !== 'waiting_customer')
          || activeAssignment === null
          || activeAssignment.status !== 'accepted'
          || fact.assignmentId !== activeAssignment.assignmentId
          || fact.assigneeUserId !== activeAssignment.assigneeUserId
          || fact.assigneeRole !== activeAssignment.assigneeRole
          || fact.actorUserId !== activeAssignment.assigneeUserId
        ) {
          return invalidHistory();
        }
        activeAssignment = null;
        handlerReleased = true;
      } else {
        return invalidHistory();
      }

      operationsByIdempotencyKey.set(fact.idempotencyKey, [fact]);
    }

    return {
      kind: 'valid',
      inspection: {
        facts,
        target,
        revision: facts.length,
        activeAssignment,
        eventIds,
        assignedIds,
        operationsByIdempotencyKey,
        handlerReleased,
      },
    };
  } catch {
    return invalidHistory();
  }
};

const matchesCommonFact = (
  fact: ConversationAssignmentFact,
  command: AssignCommand | AssignmentDecisionCommand,
  expectedStatus: ConversationAssignmentStatus,
  expectedReasonCode: ConversationAssignmentReasonCode,
): boolean => (
  fact.eventId === command.eventId
  && fact.assignmentId === command.assignmentId
  && sameTarget(factTarget(fact), commandTarget(command))
  && fact.revision === command.expectedRevision + 1
  && fact.status === expectedStatus
  && fact.actorUserId === command.actorUserId
  && fact.reasonCode === expectedReasonCode
  && fact.sourceSegmentState === command.sourceSegmentState
  && fact.occurredAt === command.occurredAt
  && fact.idempotencyKey === command.idempotencyKey
);

const makeMutationResult = (
  kind: 'applied' | 'replayed',
  inspection: HistoryInspection,
  operationFacts: ConversationAssignmentHistory,
): ConversationAssignmentMutationResult => {
  if (inspection.target === null) {
    return blocked('invalid_assignment_history');
  }
  return deepFreeze({
    kind,
    history: cloneHistory(inspection.facts),
    operationFacts: cloneHistory(operationFacts),
    projection: buildProjection(
      inspection.target,
      inspection.revision,
      inspection.activeAssignment,
    ),
  });
};

const inspectForCommand = (
  rawHistory: unknown,
  target: ConversationAssignmentTarget,
): HistoryInspection | Extract<ConversationAssignmentMutationResult, { kind: 'blocked' }> => {
  const historyResult = inspectHistory(rawHistory);
  if (historyResult.kind === 'blocked') {
    return blocked(historyResult.code);
  }
  if (historyResult.inspection.target !== null) {
    const mismatch = compareTarget(historyResult.inspection.target, target);
    if (mismatch) {
      return blocked(mismatch);
    }
  }
  return historyResult.inspection;
};

const isBlockedResult = (
  value: HistoryInspection | Extract<ConversationAssignmentMutationResult, { kind: 'blocked' }>,
): value is Extract<ConversationAssignmentMutationResult, { kind: 'blocked' }> => 'kind' in value;

const replayOrConflict = (
  inspection: HistoryInspection,
  idempotencyKey: string,
  matches: (facts: ConversationAssignmentHistory) => boolean,
): ConversationAssignmentMutationResult | null => {
  const existing = inspection.operationsByIdempotencyKey.get(idempotencyKey);
  if (!existing) {
    return null;
  }
  return matches(existing)
    ? makeMutationResult('replayed', inspection, existing)
    : blocked('idempotency_conflict');
};

const validateNewIdentifiers = (
  inspection: HistoryInspection,
  eventIds: readonly string[],
  assignmentId?: string,
): ConversationAssignmentMutationResult | null => {
  if (eventIds.some((eventId) => inspection.eventIds.has(eventId))) {
    return blocked('event_id_conflict');
  }
  if (assignmentId && inspection.assignedIds.has(assignmentId)) {
    return blocked('assignment_id_conflict');
  }
  return null;
};

const validateRevision = (
  inspection: HistoryInspection,
  expectedRevision: number,
  appendedFactCount: 1 | 2,
): ConversationAssignmentMutationResult | null => {
  if (inspection.revision !== expectedRevision) {
    return blocked('revision_conflict');
  }
  if (inspection.revision > Number.MAX_SAFE_INTEGER - appendedFactCount) {
    return blocked('revision_exhausted');
  }
  return null;
};

const validateNewOccurredAt = (
  inspection: HistoryInspection,
  occurredAt: string,
): ConversationAssignmentMutationResult | null => {
  const previous = inspection.facts[inspection.facts.length - 1];
  return previous && occurredAt < previous.occurredAt
    ? blocked('invalid_timestamp')
    : null;
};

const applyFacts = (
  inspection: HistoryInspection,
  target: ConversationAssignmentTarget,
  facts: ConversationAssignmentHistory,
): ConversationAssignmentMutationResult => {
  const nextHistory = [...inspection.facts, ...facts];
  const nextInspectionResult = inspectHistory(nextHistory);
  if (nextInspectionResult.kind === 'blocked' || nextInspectionResult.inspection.target === null) {
    return blocked('invalid_assignment_history');
  }
  if (!sameTarget(target, nextInspectionResult.inspection.target)) {
    return blocked('invalid_assignment_history');
  }
  return makeMutationResult('applied', nextInspectionResult.inspection, facts);
};

const assignWithReason = (
  rawHistory: unknown,
  rawCommand: unknown,
  reasonCode: 'manual_assign' | 'manual_fallback',
): ConversationAssignmentMutationResult => {
  const preliminaryTarget = parseCommandTarget(rawCommand, assignCommandKeys);
  if (preliminaryTarget.kind === 'blocked') {
    return blocked(preliminaryTarget.code);
  }
  const inspected = inspectForCommand(rawHistory, preliminaryTarget.command);
  if (isBlockedResult(inspected)) {
    return inspected;
  }
  const parsed = parseAssignCommand(rawCommand);
  if (parsed.kind === 'blocked') {
    return blocked(parsed.code);
  }
  const command = parsed.command;
  const target = commandTarget(command);

  const replay = replayOrConflict(inspected, command.idempotencyKey, (facts) => {
    const fact = facts[0];
    return facts.length === 1
      && fact !== undefined
      && matchesCommonFact(fact, command, 'assigned', reasonCode)
      && fact.actorRole === command.actorRole
      && fact.assigneeUserId === command.assigneeUserId
      && fact.assigneeRole === command.assigneeRole;
  });
  if (replay) {
    return replay;
  }
  if (!isAssignmentAdministrator(command.actorRole)) {
    return blocked('actor_role_not_allowed');
  }
  if (command.sourceSegmentState !== 'awaiting_human') {
    return blocked('transition_not_allowed');
  }
  if (inspected.activeAssignment !== null) {
    return blocked('transition_not_allowed');
  }
  const revisionFailure = validateRevision(inspected, command.expectedRevision, 1);
  if (revisionFailure) {
    return revisionFailure;
  }
  const identifierFailure = validateNewIdentifiers(
    inspected,
    [command.eventId],
    command.assignmentId,
  );
  if (identifierFailure) {
    return identifierFailure;
  }
  const timeFailure = validateNewOccurredAt(inspected, command.occurredAt);
  if (timeFailure) {
    return timeFailure;
  }

  return applyFacts(inspected, target, [{
    eventId: command.eventId,
    assignmentId: command.assignmentId,
    ...target,
    revision: inspected.revision + 1,
    status: 'assigned',
    assigneeUserId: command.assigneeUserId,
    assigneeRole: command.assigneeRole,
    actorUserId: command.actorUserId,
    actorRole: command.actorRole,
    reasonCode,
    sourceSegmentState: command.sourceSegmentState,
    occurredAt: command.occurredAt,
    idempotencyKey: command.idempotencyKey,
  }]);
};

export function projectConversationAssignments(
  rawHistory: unknown,
  rawTarget: unknown,
): ConversationAssignmentProjectionResult {
  const targetResult = parseTarget(rawTarget);
  if (targetResult.kind === 'blocked') {
    return projectionBlocked(targetResult.code);
  }
  const historyResult = inspectHistory(rawHistory);
  if (historyResult.kind === 'blocked') {
    return projectionBlocked(historyResult.code);
  }
  const { inspection } = historyResult;
  if (inspection.target !== null) {
    const mismatch = compareTarget(inspection.target, targetResult.command);
    if (mismatch) {
      return projectionBlocked(mismatch);
    }
  }
  return deepFreeze({
    kind: 'projected',
    projection: buildProjection(
      targetResult.command,
      inspection.revision,
      inspection.activeAssignment,
    ),
  });
}

export function assignConversationSegment(
  rawHistory: unknown,
  rawCommand: unknown,
): ConversationAssignmentMutationResult {
  return assignWithReason(rawHistory, rawCommand, 'manual_assign');
}

export function fallbackConversationSegment(
  rawHistory: unknown,
  rawCommand: unknown,
): ConversationAssignmentMutationResult {
  return assignWithReason(rawHistory, rawCommand, 'manual_fallback');
}

const decideAssignment = (
  rawHistory: unknown,
  rawCommand: unknown,
  decision: 'accept' | 'reject' | 'release',
): ConversationAssignmentMutationResult => {
  const preliminaryTarget = parseCommandTarget(rawCommand, decisionCommandKeys);
  if (preliminaryTarget.kind === 'blocked') {
    return blocked(preliminaryTarget.code);
  }
  const inspected = inspectForCommand(rawHistory, preliminaryTarget.command);
  if (isBlockedResult(inspected)) {
    return inspected;
  }
  const parsed = parseDecisionCommand(rawCommand);
  if (parsed.kind === 'blocked') {
    return blocked(parsed.code);
  }
  const command = parsed.command;
  const target = commandTarget(command);

  const active = inspected.activeAssignment;
  const expectedStatus: ConversationAssignmentStatus = decision === 'accept'
    ? 'accepted'
    : decision === 'reject'
      ? 'rejected'
      : 'released';
  const expectedReason: ConversationAssignmentReasonCode = decision === 'reject'
    ? 'assignee_reject'
    : decision === 'release'
      ? 'handler_release'
      : active?.originReasonCode ?? 'manual_assign';
  const replay = replayOrConflict(inspected, command.idempotencyKey, (facts) => {
    const fact = facts[0];
    return facts.length === 1
      && fact !== undefined
      && matchesCommonFact(fact, command, expectedStatus, fact.reasonCode)
      && (
        decision === 'accept'
          ? isAssignmentOriginReason(fact.reasonCode)
          : fact.reasonCode === expectedReason
      );
  });
  if (replay) {
    return replay;
  }
  if (
    active === null
    || active.assignmentId !== command.assignmentId
    || active.assigneeUserId !== command.actorUserId
  ) {
    return blocked('actor_not_assignee');
  }
  if (decision === 'accept' || decision === 'reject') {
    if (active.status !== 'assigned' || command.sourceSegmentState !== 'awaiting_human') {
      return blocked('transition_not_allowed');
    }
  } else if (
    active.status !== 'accepted'
    || (command.sourceSegmentState !== 'human_handling'
      && command.sourceSegmentState !== 'waiting_customer')
  ) {
    return blocked('transition_not_allowed');
  }
  const revisionFailure = validateRevision(inspected, command.expectedRevision, 1);
  if (revisionFailure) {
    return revisionFailure;
  }
  const identifierFailure = validateNewIdentifiers(inspected, [command.eventId]);
  if (identifierFailure) {
    return identifierFailure;
  }
  const timeFailure = validateNewOccurredAt(inspected, command.occurredAt);
  if (timeFailure) {
    return timeFailure;
  }

  const reasonCode: ConversationAssignmentReasonCode = decision === 'accept'
    ? active.originReasonCode
    : decision === 'reject'
      ? 'assignee_reject'
      : 'handler_release';
  return applyFacts(inspected, target, [{
    eventId: command.eventId,
    assignmentId: active.assignmentId,
    ...target,
    revision: inspected.revision + 1,
    status: expectedStatus,
    assigneeUserId: active.assigneeUserId,
    assigneeRole: active.assigneeRole,
    actorUserId: command.actorUserId,
    actorRole: command.actorRole,
    reasonCode,
    sourceSegmentState: command.sourceSegmentState,
    occurredAt: command.occurredAt,
    idempotencyKey: command.idempotencyKey,
  }]);
};

export function acceptConversationAssignment(
  rawHistory: unknown,
  rawCommand: unknown,
): ConversationAssignmentMutationResult {
  return decideAssignment(rawHistory, rawCommand, 'accept');
}

export function rejectConversationAssignment(
  rawHistory: unknown,
  rawCommand: unknown,
): ConversationAssignmentMutationResult {
  return decideAssignment(rawHistory, rawCommand, 'reject');
}

export function releaseConversationAssignment(
  rawHistory: unknown,
  rawCommand: unknown,
): ConversationAssignmentMutationResult {
  return decideAssignment(rawHistory, rawCommand, 'release');
}

export function reassignConversationSegment(
  rawHistory: unknown,
  rawCommand: unknown,
): ConversationAssignmentMutationResult {
  const preliminaryTarget = parseCommandTarget(rawCommand, reassignCommandKeys);
  if (preliminaryTarget.kind === 'blocked') {
    return blocked(preliminaryTarget.code);
  }
  const inspected = inspectForCommand(rawHistory, preliminaryTarget.command);
  if (isBlockedResult(inspected)) {
    return inspected;
  }
  const parsed = parseReassignCommand(rawCommand);
  if (parsed.kind === 'blocked') {
    return blocked(parsed.code);
  }
  const command = parsed.command;
  const target = commandTarget(command);

  const replay = replayOrConflict(inspected, command.idempotencyKey, (facts) => {
    const released = facts[0];
    const assigned = facts[1];
    return facts.length === 2
      && released !== undefined
      && assigned !== undefined
      && released.eventId === command.releaseEventId
      && assigned.eventId === command.assignedEventId
      && released.assignmentId === command.currentAssignmentId
      && assigned.assignmentId === command.newAssignmentId
      && sameTarget(factTarget(released), target)
      && sameTarget(factTarget(assigned), target)
      && released.revision === command.expectedRevision + 1
      && assigned.revision === command.expectedRevision + 2
      && released.status === 'released'
      && assigned.status === 'assigned'
      && released.actorUserId === command.actorUserId
      && assigned.actorUserId === command.actorUserId
      && released.actorRole === command.actorRole
      && assigned.actorRole === command.actorRole
      && released.reasonCode === 'manual_reassign'
      && assigned.reasonCode === 'manual_reassign'
      && released.sourceSegmentState === command.sourceSegmentState
      && assigned.sourceSegmentState === command.sourceSegmentState
      && released.occurredAt === command.occurredAt
      && assigned.occurredAt === command.occurredAt
      && released.idempotencyKey === command.idempotencyKey
      && assigned.idempotencyKey === command.idempotencyKey
      && assigned.assigneeUserId === command.newAssigneeUserId
      && assigned.assigneeRole === command.newAssigneeRole;
  });
  if (replay) {
    return replay;
  }
  if (!isAssignmentAdministrator(command.actorRole)) {
    return blocked('actor_role_not_allowed');
  }
  if (command.sourceSegmentState !== 'awaiting_human') {
    return blocked('transition_not_allowed');
  }
  const active = inspected.activeAssignment;
  if (
    active === null
    || active.status !== 'assigned'
    || active.assignmentId !== command.currentAssignmentId
  ) {
    return blocked('transition_not_allowed');
  }
  if (active.assigneeUserId === command.newAssigneeUserId) {
    return blocked('assignee_unchanged');
  }
  if (command.currentAssignmentId === command.newAssignmentId) {
    return blocked('assignment_id_conflict');
  }
  const revisionFailure = validateRevision(inspected, command.expectedRevision, 2);
  if (revisionFailure) {
    return revisionFailure;
  }
  const identifierFailure = validateNewIdentifiers(
    inspected,
    [command.releaseEventId, command.assignedEventId],
    command.newAssignmentId,
  );
  if (identifierFailure) {
    return identifierFailure;
  }
  if (command.releaseEventId === command.assignedEventId) {
    return blocked('event_id_conflict');
  }
  const timeFailure = validateNewOccurredAt(inspected, command.occurredAt);
  if (timeFailure) {
    return timeFailure;
  }

  const releasedFact: ConversationAssignmentFact = {
    eventId: command.releaseEventId,
    assignmentId: active.assignmentId,
    ...target,
    revision: inspected.revision + 1,
    status: 'released',
    assigneeUserId: active.assigneeUserId,
    assigneeRole: active.assigneeRole,
    actorUserId: command.actorUserId,
    actorRole: command.actorRole,
    reasonCode: 'manual_reassign',
    sourceSegmentState: command.sourceSegmentState,
    occurredAt: command.occurredAt,
    idempotencyKey: command.idempotencyKey,
  };
  const assignedFact: ConversationAssignmentFact = {
    eventId: command.assignedEventId,
    assignmentId: command.newAssignmentId,
    ...target,
    revision: inspected.revision + 2,
    status: 'assigned',
    assigneeUserId: command.newAssigneeUserId,
    assigneeRole: command.newAssigneeRole,
    actorUserId: command.actorUserId,
    actorRole: command.actorRole,
    reasonCode: 'manual_reassign',
    sourceSegmentState: command.sourceSegmentState,
    occurredAt: command.occurredAt,
    idempotencyKey: command.idempotencyKey,
  };
  return applyFacts(inspected, target, [releasedFact, assignedFact]);
}
