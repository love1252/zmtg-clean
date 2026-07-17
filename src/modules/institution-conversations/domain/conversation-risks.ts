export const conversationRiskStates = ['none', 'unconfirmed', 'confirmed', 'resolved'] as const;
export const conversationRiskDomains = ['clinical', 'non_clinical'] as const;

export type ConversationRiskState = (typeof conversationRiskStates)[number];
export type ConversationRiskDomain = (typeof conversationRiskDomains)[number];

export type LowSensitiveClinicalClosureReference = Readonly<{
  referenceId: string;
  scope: Readonly<{
    tenantId: string;
    institutionId: string;
  }>;
  verificationState: 'valid';
  revocationState: 'not_revoked';
  verifiedAt: string;
}>;

export type ConversationRiskEvent =
  | Readonly<{
      kind: 'risk_unconfirmed';
      eventId: string;
      riskId: string;
      tenantId: string;
      institutionId: string;
      conversationId: string;
      segmentId: string;
      sourceMessageId: string;
      riskDomain: ConversationRiskDomain;
      riskCode: string;
      occurredAt: string;
    }>
  | Readonly<{
      kind: 'risk_confirmed';
      eventId: string;
      riskId: string;
      confirmedByActorId: string;
      occurredAt: string;
    }>
  | Readonly<{
      kind: 'risk_resolved';
      eventId: string;
      riskId: string;
      resolvedByActorId: string;
      occurredAt: string;
      clinicalClosureReference: LowSensitiveClinicalClosureReference | null;
    }>;

export type ConversationRiskHistory = readonly ConversationRiskEvent[];

export type ConversationRiskProjection =
  | Readonly<{
      state: 'none';
    }>
  | Readonly<{
      state: 'unconfirmed' | 'confirmed' | 'resolved';
      riskId: string;
      tenantId: string;
      institutionId: string;
      conversationId: string;
      segmentId: string;
      sourceMessageId: string;
      riskDomain: ConversationRiskDomain;
      riskCode: string;
      detectedAt: string;
      confirmedAt: string | null;
      resolvedAt: string | null;
      clinicalClosureReferenceId: string | null;
    }>;

export type ConversationRiskBlockCode =
  | 'invalid_object_id'
  | 'invalid_timestamp'
  | 'invalid_risk_code'
  | 'invalid_risk_domain'
  | 'invalid_risk_history'
  | 'risk_already_recorded'
  | 'risk_id_mismatch'
  | 'risk_confirmation_requires_unconfirmed'
  | 'risk_resolution_requires_confirmed'
  | 'human_confirmation_required'
  | 'clinical_closure_reference_required'
  | 'clinical_closure_scope_mismatch'
  | 'clinical_closure_reference_invalid'
  | 'clinical_closure_reference_revoked';

export type ConversationRiskProjectionResult =
  | Readonly<{
      kind: 'projected';
      projection: ConversationRiskProjection;
    }>
  | Readonly<{
      kind: 'blocked';
      code: 'invalid_risk_history';
    }>;

export type ConversationRiskMutationResult =
  | Readonly<{
      kind: 'applied';
      history: ConversationRiskHistory;
      projection: ConversationRiskProjection;
      appendedEvent: ConversationRiskEvent;
    }>
  | Readonly<{
      kind: 'blocked';
      code: ConversationRiskBlockCode;
    }>;

export type ClinicalClosureVerification = Readonly<{
  referenceId: string;
  tenantId: string;
  institutionId: string;
  valid: boolean;
  revoked: boolean;
  verifiedAt: string;
}>;

export type ConversationRiskTarget = Readonly<{
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
}>;

export type CurrentClinicalClosureCheck = Readonly<{
  riskId: string;
  referenceId: string;
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
  verificationState: 'valid';
  revocationState: 'not_revoked';
  checkedAt: string;
}>;

export type ProjectedRiskSetEntry =
  | Readonly<{
      riskId: string;
      state: 'unconfirmed' | 'confirmed';
      riskDomain: ConversationRiskDomain;
      clinicalClosureCheckState: 'not_applicable';
    }>
  | Readonly<{
      riskId: string;
      state: 'resolved';
      riskDomain: 'non_clinical';
      clinicalClosureCheckState: 'not_required';
    }>
  | Readonly<{
      riskId: string;
      state: 'resolved';
      riskDomain: 'clinical';
      clinicalClosureCheckState: 'missing' | 'current';
    }>;

export type CompleteConversationRiskProjection = Readonly<{
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
  provenance: 'caller_declared_complete_histories';
  risks: readonly ProjectedRiskSetEntry[];
}>;

export type ConversationRiskSetBlockCode =
  | 'invalid_target'
  | 'invalid_identifier'
  | 'invalid_timestamp'
  | 'invalid_risk_histories'
  | 'scope_mismatch'
  | 'target_mismatch'
  | 'invalid_clinical_closure_checks';

export type ConversationRiskSetProjectionResult =
  | Readonly<{
      kind: 'projected';
      projection: CompleteConversationRiskProjection;
    }>
  | Readonly<{
      kind: 'blocked';
      code: ConversationRiskSetBlockCode;
    }>;

const safeObjectIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const safeRiskCodePattern = /^[a-z][a-z0-9._-]{0,63}$/u;
const canonicalUtcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const opaqueReferencePatterns = {
  tenantId: /^ten_[a-f][a-f0-9]{15,63}$/u,
  institutionId: /^ins_[a-f][a-f0-9]{15,63}$/u,
  conversationId: /^con_[a-f][a-f0-9]{15,63}$/u,
  segmentId: /^seg_[a-f][a-f0-9]{15,63}$/u,
  riskId: /^rsk_[a-f][a-f0-9]{15,63}$/u,
  riskEventId: /^rke_[a-f][a-f0-9]{15,63}$/u,
  messageId: /^msg_[a-f][a-f0-9]{15,63}$/u,
  userId: /^usr_[a-f][a-f0-9]{15,63}$/u,
  clinicalClosureReferenceId: /^ccr_[a-f][a-f0-9]{15,63}$/u,
} as const;

const riskUnconfirmedEventKeys = [
  'kind',
  'eventId',
  'riskId',
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'sourceMessageId',
  'riskDomain',
  'riskCode',
  'occurredAt',
] as const;
const riskConfirmedEventKeys = [
  'kind',
  'eventId',
  'riskId',
  'confirmedByActorId',
  'occurredAt',
] as const;
const riskResolvedEventKeys = [
  'kind',
  'eventId',
  'riskId',
  'resolvedByActorId',
  'occurredAt',
  'clinicalClosureReference',
] as const;
const clinicalClosureReferenceKeys = [
  'referenceId',
  'scope',
  'verificationState',
  'revocationState',
  'verifiedAt',
] as const;
const institutionScopeKeys = ['tenantId', 'institutionId'] as const;
const riskTargetKeys = ['tenantId', 'institutionId', 'conversationId', 'segmentId'] as const;
const currentClinicalClosureCheckKeys = [
  'riskId',
  'referenceId',
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'verificationState',
  'revocationState',
  'checkedAt',
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

const mutationBlocked = (code: ConversationRiskBlockCode): ConversationRiskMutationResult => deepFreeze({
  kind: 'blocked',
  code,
});

const riskSetBlocked = (code: ConversationRiskSetBlockCode): ConversationRiskSetProjectionResult => (
  deepFreeze({ kind: 'blocked', code })
);

const isValidTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string' || !canonicalUtcTimestampPattern.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
};
const isSafeObjectId = (value: unknown): value is string => (
  typeof value === 'string' && safeObjectIdPattern.test(value)
);
const isSafeRiskCode = (value: unknown): value is string => (
  typeof value === 'string' && safeRiskCodePattern.test(value)
);

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

const hasExactRiskEventKeys = (value: unknown, expectedKind: ConversationRiskEvent['kind']): boolean => {
  if (!isRecord(value) || value.kind !== expectedKind) {
    return false;
  }
  if (expectedKind === 'risk_unconfirmed') {
    return hasExactOwnKeys(value, riskUnconfirmedEventKeys);
  }
  if (expectedKind === 'risk_confirmed') {
    return hasExactOwnKeys(value, riskConfirmedEventKeys);
  }
  return hasExactOwnKeys(value, riskResolvedEventKeys);
};

function inspectParsedRiskHistory(history: ConversationRiskHistory): ConversationRiskProjectionResult {
  if (history.length === 0) {
    return { kind: 'projected', projection: { state: 'none' } };
  }
  if (history.length > 3) {
    return { kind: 'blocked', code: 'invalid_risk_history' };
  }
  const expectedKinds = ['risk_unconfirmed', 'risk_confirmed', 'risk_resolved'] as const;
  if (history.some((event, index) => !hasExactRiskEventKeys(event, expectedKinds[index]!))) {
    return { kind: 'blocked', code: 'invalid_risk_history' };
  }

  const unconfirmed = history[0];
  if (
    unconfirmed.kind !== 'risk_unconfirmed'
    || !isSafeObjectId(unconfirmed.eventId)
    || !isSafeObjectId(unconfirmed.riskId)
    || !isSafeObjectId(unconfirmed.tenantId)
    || !isSafeObjectId(unconfirmed.institutionId)
    || !isSafeObjectId(unconfirmed.conversationId)
    || !isSafeObjectId(unconfirmed.segmentId)
    || !isSafeObjectId(unconfirmed.sourceMessageId)
    || !conversationRiskDomains.includes(unconfirmed.riskDomain)
    || !isSafeRiskCode(unconfirmed.riskCode)
    || !isValidTimestamp(unconfirmed.occurredAt)
  ) {
    return { kind: 'blocked', code: 'invalid_risk_history' };
  }

  const eventIds = new Set<string>();
  let previousOccurredAt = unconfirmed.occurredAt;
  for (const event of history) {
    if (
      !isSafeObjectId(event.eventId)
      || !isSafeObjectId(event.riskId)
      || event.riskId !== unconfirmed.riskId
      || eventIds.has(event.eventId)
      || !isValidTimestamp(event.occurredAt)
      || event.occurredAt < previousOccurredAt
    ) {
      return { kind: 'blocked', code: 'invalid_risk_history' };
    }
    if (event.kind === 'risk_confirmed' && !isSafeObjectId(event.confirmedByActorId)) {
      return { kind: 'blocked', code: 'invalid_risk_history' };
    }
    if (event.kind === 'risk_resolved') {
      if (!isSafeObjectId(event.resolvedByActorId)) {
        return { kind: 'blocked', code: 'invalid_risk_history' };
      }
      if (
        unconfirmed.riskDomain === 'clinical'
        && (
          event.clinicalClosureReference === null
          || !isRecord(event.clinicalClosureReference)
          || !hasExactOwnKeys(event.clinicalClosureReference, clinicalClosureReferenceKeys)
          || !isSafeObjectId(event.clinicalClosureReference.referenceId)
          || !isRecord(event.clinicalClosureReference.scope)
          || !hasExactOwnKeys(event.clinicalClosureReference.scope, institutionScopeKeys)
          || event.clinicalClosureReference.scope.tenantId !== unconfirmed.tenantId
          || event.clinicalClosureReference.scope.institutionId !== unconfirmed.institutionId
          || event.clinicalClosureReference.verificationState !== 'valid'
          || event.clinicalClosureReference.revocationState !== 'not_revoked'
          || !isValidTimestamp(event.clinicalClosureReference.verifiedAt)
          || event.clinicalClosureReference.verifiedAt > event.occurredAt
        )
      ) {
        return { kind: 'blocked', code: 'invalid_risk_history' };
      }
      if (unconfirmed.riskDomain === 'non_clinical' && event.clinicalClosureReference !== null) {
        return { kind: 'blocked', code: 'invalid_risk_history' };
      }
    }
    eventIds.add(event.eventId);
    previousOccurredAt = event.occurredAt;
  }

  const confirmed = history[1]?.kind === 'risk_confirmed' ? history[1] : null;
  const resolved = history[2]?.kind === 'risk_resolved' ? history[2] : null;
  const state: Exclude<ConversationRiskState, 'none'> = resolved
    ? 'resolved'
    : confirmed
      ? 'confirmed'
      : 'unconfirmed';

  return {
    kind: 'projected',
    projection: {
      state,
      riskId: unconfirmed.riskId,
      tenantId: unconfirmed.tenantId,
      institutionId: unconfirmed.institutionId,
      conversationId: unconfirmed.conversationId,
      segmentId: unconfirmed.segmentId,
      sourceMessageId: unconfirmed.sourceMessageId,
      riskDomain: unconfirmed.riskDomain,
      riskCode: unconfirmed.riskCode,
      detectedAt: unconfirmed.occurredAt,
      confirmedAt: confirmed?.occurredAt ?? null,
      resolvedAt: resolved?.occurredAt ?? null,
      clinicalClosureReferenceId: resolved?.clinicalClosureReference?.referenceId ?? null,
    },
  };
}

type CapturedDataRecord = Readonly<{
  keys: readonly string[];
  values: Readonly<Record<string, unknown>>;
}>;

const captureDataRecord = (raw: unknown): CapturedDataRecord | null => {
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
    if (ownKeys.some((key) => typeof key !== 'string')) {
      return null;
    }
    const keys = ownKeys as string[];
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const values: Record<string, unknown> = {};
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor)) {
        return null;
      }
      values[key] = descriptor.value;
    }
    return { keys, values };
  } catch {
    return null;
  }
};

const hasCapturedKeys = (
  captured: CapturedDataRecord,
  expectedKeys: readonly string[],
): boolean => (
  captured.keys.length === expectedKeys.length
  && captured.keys.every((key) => expectedKeys.includes(key))
);

const captureExactDataRecord = (
  raw: unknown,
  expectedKeys: readonly string[],
): CapturedDataRecord | null => {
  const captured = captureDataRecord(raw);
  return captured && hasCapturedKeys(captured, expectedKeys) ? captured : null;
};

const captureDenseArray = (raw: unknown): readonly unknown[] | null => {
  try {
    if (!Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype) {
      return null;
    }
    const ownKeys = Reflect.ownKeys(raw);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(raw, 'length');
    if (
      ownKeys.some((key) => typeof key !== 'string')
      || !lengthDescriptor
      || !('value' in lengthDescriptor)
      || !Number.isSafeInteger(lengthDescriptor.value)
      || lengthDescriptor.value < 0
      || ownKeys.length !== lengthDescriptor.value + 1
      || !ownKeys.includes('length')
    ) {
      return null;
    }
    const values: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(raw, String(index));
      if (!descriptor || !('value' in descriptor)) {
        return null;
      }
      values.push(descriptor.value);
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

const parseClinicalClosureReference = (
  raw: unknown,
): LowSensitiveClinicalClosureReference | null => {
  const captured = captureExactDataRecord(raw, clinicalClosureReferenceKeys);
  if (!captured) {
    return null;
  }
  const scope = captureExactDataRecord(captured.values.scope, institutionScopeKeys);
  if (
    !scope
    || !isSafeObjectId(captured.values.referenceId)
    || !isSafeObjectId(scope.values.tenantId)
    || !isSafeObjectId(scope.values.institutionId)
    || captured.values.verificationState !== 'valid'
    || captured.values.revocationState !== 'not_revoked'
    || !isValidTimestamp(captured.values.verifiedAt)
    || !isStructuredCloneable(captured.values.scope)
    || !isStructuredCloneable(raw)
  ) {
    return null;
  }
  return {
    referenceId: captured.values.referenceId as string,
    scope: {
      tenantId: scope.values.tenantId as string,
      institutionId: scope.values.institutionId as string,
    },
    verificationState: captured.values.verificationState as 'valid',
    revocationState: captured.values.revocationState as 'not_revoked',
    verifiedAt: captured.values.verifiedAt as string,
  };
};

const parseRiskEvent = (raw: unknown): ConversationRiskEvent | null => {
  const captured = captureDataRecord(raw);
  if (!captured) {
    return null;
  }
  const kind = captured.values.kind;
  if (kind === 'risk_unconfirmed' && hasCapturedKeys(captured, riskUnconfirmedEventKeys)) {
    if (
      !isSafeObjectId(captured.values.eventId)
      || !isSafeObjectId(captured.values.riskId)
      || !isSafeObjectId(captured.values.tenantId)
      || !isSafeObjectId(captured.values.institutionId)
      || !isSafeObjectId(captured.values.conversationId)
      || !isSafeObjectId(captured.values.segmentId)
      || !isSafeObjectId(captured.values.sourceMessageId)
      || !conversationRiskDomains.includes(captured.values.riskDomain as ConversationRiskDomain)
      || !isSafeRiskCode(captured.values.riskCode)
      || !isValidTimestamp(captured.values.occurredAt)
      || !isStructuredCloneable(raw)
    ) {
      return null;
    }
    return {
      kind,
      eventId: captured.values.eventId as string,
      riskId: captured.values.riskId as string,
      tenantId: captured.values.tenantId as string,
      institutionId: captured.values.institutionId as string,
      conversationId: captured.values.conversationId as string,
      segmentId: captured.values.segmentId as string,
      sourceMessageId: captured.values.sourceMessageId as string,
      riskDomain: captured.values.riskDomain as ConversationRiskDomain,
      riskCode: captured.values.riskCode as string,
      occurredAt: captured.values.occurredAt as string,
    };
  }
  if (kind === 'risk_confirmed' && hasCapturedKeys(captured, riskConfirmedEventKeys)) {
    if (
      !isSafeObjectId(captured.values.eventId)
      || !isSafeObjectId(captured.values.riskId)
      || !isSafeObjectId(captured.values.confirmedByActorId)
      || !isValidTimestamp(captured.values.occurredAt)
      || !isStructuredCloneable(raw)
    ) {
      return null;
    }
    return {
      kind,
      eventId: captured.values.eventId as string,
      riskId: captured.values.riskId as string,
      confirmedByActorId: captured.values.confirmedByActorId as string,
      occurredAt: captured.values.occurredAt as string,
    };
  }
  if (kind === 'risk_resolved' && hasCapturedKeys(captured, riskResolvedEventKeys)) {
    const rawReference = captured.values.clinicalClosureReference;
    const clinicalClosureReference = rawReference === null
      ? null
      : parseClinicalClosureReference(rawReference);
    if (
      (rawReference !== null && clinicalClosureReference === null)
      || !isSafeObjectId(captured.values.eventId)
      || !isSafeObjectId(captured.values.riskId)
      || !isSafeObjectId(captured.values.resolvedByActorId)
      || !isValidTimestamp(captured.values.occurredAt)
      || !isStructuredCloneable(raw)
    ) {
      return null;
    }
    return {
      kind,
      eventId: captured.values.eventId as string,
      riskId: captured.values.riskId as string,
      resolvedByActorId: captured.values.resolvedByActorId as string,
      occurredAt: captured.values.occurredAt as string,
      clinicalClosureReference,
    };
  }
  return null;
};

const parseRiskHistorySnapshot = (raw: unknown): ConversationRiskHistory | null => {
  const captured = captureDenseArray(raw);
  if (!captured) {
    return null;
  }
  const events = captured.map(parseRiskEvent);
  if (events.some((event) => event === null) || !isStructuredCloneable(raw)) {
    return null;
  }
  return events as ConversationRiskEvent[];
};

function inspectRiskHistory(rawHistory: unknown): ConversationRiskProjectionResult {
  const snapshot = parseRiskHistorySnapshot(rawHistory);
  return snapshot === null
    ? { kind: 'blocked', code: 'invalid_risk_history' }
    : inspectParsedRiskHistory(snapshot);
}

export function projectConversationRisk(
  history: Readonly<ConversationRiskHistory>,
): ConversationRiskProjectionResult {
  return deepFreeze(inspectRiskHistory(history));
}

const appendEvent = (
  history: ConversationRiskHistory,
  event: ConversationRiskEvent,
): ConversationRiskMutationResult => {
  const currentSnapshot = parseRiskHistorySnapshot(history);
  if (currentSnapshot === null) {
    return mutationBlocked('invalid_risk_history');
  }
  const nextHistory = [...currentSnapshot, structuredClone(event)];
  const projected = inspectRiskHistory(nextHistory);
  if (projected.kind === 'blocked') {
    return mutationBlocked('invalid_risk_history');
  }
  return deepFreeze({
    kind: 'applied',
    history: nextHistory,
    projection: projected.projection,
    appendedEvent: nextHistory[nextHistory.length - 1]!,
  });
};

export function recordUnconfirmedRisk(
  history: Readonly<ConversationRiskHistory>,
  input: Readonly<{
    eventId: string;
    riskId: string;
    tenantId: string;
    institutionId: string;
    conversationId: string;
    segmentId: string;
    sourceMessageId: string;
    riskDomain: ConversationRiskDomain;
    riskCode: string;
    occurredAt: string;
  }>,
): ConversationRiskMutationResult {
  const current = inspectRiskHistory(history);
  if (current.kind === 'blocked') {
    return mutationBlocked('invalid_risk_history');
  }
  if (current.projection.state !== 'none') {
    return mutationBlocked('risk_already_recorded');
  }
  if (
    !isSafeObjectId(input.eventId)
    || !isSafeObjectId(input.riskId)
    || !isSafeObjectId(input.tenantId)
    || !isSafeObjectId(input.institutionId)
    || !isSafeObjectId(input.conversationId)
    || !isSafeObjectId(input.segmentId)
    || !isSafeObjectId(input.sourceMessageId)
  ) {
    return mutationBlocked('invalid_object_id');
  }
  if (!conversationRiskDomains.includes(input.riskDomain)) {
    return mutationBlocked('invalid_risk_domain');
  }
  if (!isSafeRiskCode(input.riskCode)) {
    return mutationBlocked('invalid_risk_code');
  }
  if (!isValidTimestamp(input.occurredAt)) {
    return mutationBlocked('invalid_timestamp');
  }
  return appendEvent(history, {
    kind: 'risk_unconfirmed',
    eventId: input.eventId,
    riskId: input.riskId,
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    conversationId: input.conversationId,
    segmentId: input.segmentId,
    sourceMessageId: input.sourceMessageId,
    riskDomain: input.riskDomain,
    riskCode: input.riskCode,
    occurredAt: input.occurredAt,
  });
}

export function confirmConversationRisk(
  history: Readonly<ConversationRiskHistory>,
  input: Readonly<{
    eventId: string;
    riskId: string;
    actorId: string;
    actorKind: 'human' | 'ai';
    occurredAt: string;
  }>,
): ConversationRiskMutationResult {
  const current = inspectRiskHistory(history);
  if (current.kind === 'blocked') {
    return mutationBlocked('invalid_risk_history');
  }
  if (current.projection.state !== 'unconfirmed') {
    return mutationBlocked('risk_confirmation_requires_unconfirmed');
  }
  if (current.projection.riskId !== input.riskId) {
    return mutationBlocked('risk_id_mismatch');
  }
  if (input.actorKind !== 'human') {
    return mutationBlocked('human_confirmation_required');
  }
  if (!isSafeObjectId(input.eventId) || !isSafeObjectId(input.actorId)) {
    return mutationBlocked('invalid_object_id');
  }
  const lastOccurredAt = history[history.length - 1]?.occurredAt;
  if (
    !isValidTimestamp(input.occurredAt)
    || (lastOccurredAt && input.occurredAt < lastOccurredAt)
  ) {
    return mutationBlocked('invalid_timestamp');
  }
  return appendEvent(history, {
    kind: 'risk_confirmed',
    eventId: input.eventId,
    riskId: input.riskId,
    confirmedByActorId: input.actorId,
    occurredAt: input.occurredAt,
  });
}

export function resolveConversationRisk(
  history: Readonly<ConversationRiskHistory>,
  input: Readonly<{
    eventId: string;
    riskId: string;
    actorId: string;
    actorKind: 'human' | 'ai';
    occurredAt: string;
    clinicalClosureVerification?: ClinicalClosureVerification;
  }>,
): ConversationRiskMutationResult {
  const current = inspectRiskHistory(history);
  if (current.kind === 'blocked') {
    return mutationBlocked('invalid_risk_history');
  }
  if (current.projection.state !== 'confirmed') {
    return mutationBlocked('risk_resolution_requires_confirmed');
  }
  if (current.projection.riskId !== input.riskId) {
    return mutationBlocked('risk_id_mismatch');
  }
  if (input.actorKind !== 'human') {
    return mutationBlocked('human_confirmation_required');
  }
  if (!isSafeObjectId(input.eventId) || !isSafeObjectId(input.actorId)) {
    return mutationBlocked('invalid_object_id');
  }
  const lastOccurredAt = history[history.length - 1]?.occurredAt;
  if (
    !isValidTimestamp(input.occurredAt)
    || (lastOccurredAt && input.occurredAt < lastOccurredAt)
  ) {
    return mutationBlocked('invalid_timestamp');
  }

  let clinicalClosureReference: LowSensitiveClinicalClosureReference | null = null;
  if (current.projection.riskDomain === 'clinical') {
    const verification = input.clinicalClosureVerification;
    if (!verification) {
      return mutationBlocked('clinical_closure_reference_required');
    }
    if (
      verification.tenantId !== current.projection.tenantId
      || verification.institutionId !== current.projection.institutionId
    ) {
      return mutationBlocked('clinical_closure_scope_mismatch');
    }
    if (verification.valid !== true) {
      return mutationBlocked('clinical_closure_reference_invalid');
    }
    if (verification.revoked !== false) {
      return mutationBlocked('clinical_closure_reference_revoked');
    }
    if (
      !isSafeObjectId(verification.referenceId)
      || !isValidTimestamp(verification.verifiedAt)
      || verification.verifiedAt > input.occurredAt
    ) {
      return mutationBlocked('clinical_closure_reference_invalid');
    }
    clinicalClosureReference = {
      referenceId: verification.referenceId,
      scope: {
        tenantId: verification.tenantId,
        institutionId: verification.institutionId,
      },
      verificationState: 'valid',
      revocationState: 'not_revoked',
      verifiedAt: verification.verifiedAt,
    };
  }

  return appendEvent(history, {
    kind: 'risk_resolved',
    eventId: input.eventId,
    riskId: input.riskId,
    resolvedByActorId: input.actorId,
    occurredAt: input.occurredAt,
    clinicalClosureReference,
  });
}

const parseRiskTarget = (raw: unknown): ConversationRiskTarget | null => {
  const captured = captureExactDataRecord(raw, riskTargetKeys);
  if (!captured) {
    return null;
  }
  const target = {
    tenantId: captured.values.tenantId,
    institutionId: captured.values.institutionId,
    conversationId: captured.values.conversationId,
    segmentId: captured.values.segmentId,
  };
  if (
    typeof target.tenantId !== 'string'
    || !opaqueReferencePatterns.tenantId.test(target.tenantId)
    || typeof target.institutionId !== 'string'
    || !opaqueReferencePatterns.institutionId.test(target.institutionId)
    || typeof target.conversationId !== 'string'
    || !opaqueReferencePatterns.conversationId.test(target.conversationId)
    || typeof target.segmentId !== 'string'
    || !opaqueReferencePatterns.segmentId.test(target.segmentId)
    || !isStructuredCloneable(raw)
  ) {
    return null;
  }
  return target as ConversationRiskTarget;
};

type RiskSetAnchor = Readonly<{
  rawHistory: unknown;
  values: CapturedDataRecord['values'];
}>;

type ClinicalCheckAnchor = Readonly<{
  rawCheck: unknown;
  values: CapturedDataRecord['values'];
}>;

export function projectCompleteConversationRiskHistories(
  rawHistories: unknown,
  rawTarget: unknown,
  rawChecks: unknown,
  rawOccurredAt: unknown,
): ConversationRiskSetProjectionResult {
  const target = parseRiskTarget(rawTarget);
  if (!target) {
    return riskSetBlocked('invalid_target');
  }

  const capturedHistories = captureDenseArray(rawHistories);
  if (!capturedHistories) {
    return riskSetBlocked('invalid_risk_histories');
  }
  const riskAnchors: RiskSetAnchor[] = [];
  let hasInvalidRiskHistoryStructure = false;
  for (const rawHistory of capturedHistories) {
    const capturedHistory = captureDenseArray(rawHistory);
    if (!capturedHistory || capturedHistory.length === 0) {
      hasInvalidRiskHistoryStructure = true;
      continue;
    }
    const firstEvent = captureDataRecord(capturedHistory[0]);
    if (!firstEvent) {
      hasInvalidRiskHistoryStructure = true;
      continue;
    }
    if (
      typeof firstEvent.values.tenantId !== 'string'
      || typeof firstEvent.values.institutionId !== 'string'
    ) {
      hasInvalidRiskHistoryStructure = true;
      continue;
    }
    if (
      firstEvent.values.tenantId !== target.tenantId
      || firstEvent.values.institutionId !== target.institutionId
    ) {
      return riskSetBlocked('scope_mismatch');
    }
    if (!hasCapturedKeys(firstEvent, riskUnconfirmedEventKeys)) {
      hasInvalidRiskHistoryStructure = true;
      continue;
    }
    riskAnchors.push({ rawHistory, values: firstEvent.values });
  }

  const capturedChecks = captureDenseArray(rawChecks);
  if (!capturedChecks) {
    return riskSetBlocked('invalid_clinical_closure_checks');
  }
  const checkAnchors: ClinicalCheckAnchor[] = [];
  let hasInvalidClinicalCheckStructure = false;
  for (const rawCheck of capturedChecks) {
    const captured = captureDataRecord(rawCheck);
    if (!captured) {
      hasInvalidClinicalCheckStructure = true;
      continue;
    }
    if (
      typeof captured.values.tenantId !== 'string'
      || typeof captured.values.institutionId !== 'string'
    ) {
      hasInvalidClinicalCheckStructure = true;
      continue;
    }
    if (
      captured.values.tenantId !== target.tenantId
      || captured.values.institutionId !== target.institutionId
    ) {
      return riskSetBlocked('scope_mismatch');
    }
    if (!hasCapturedKeys(captured, currentClinicalClosureCheckKeys)) {
      hasInvalidClinicalCheckStructure = true;
      continue;
    }
    checkAnchors.push({ rawCheck, values: captured.values });
  }

  for (const anchor of riskAnchors) {
    if (
      typeof anchor.values.conversationId !== 'string'
      || typeof anchor.values.segmentId !== 'string'
    ) {
      return riskSetBlocked('invalid_risk_histories');
    }
    if (
      anchor.values.conversationId !== target.conversationId
      || anchor.values.segmentId !== target.segmentId
    ) {
      return riskSetBlocked('target_mismatch');
    }
  }

  for (const anchor of checkAnchors) {
    if (
      typeof anchor.values.conversationId !== 'string'
      || typeof anchor.values.segmentId !== 'string'
    ) {
      return riskSetBlocked('invalid_clinical_closure_checks');
    }
    if (
      anchor.values.conversationId !== target.conversationId
      || anchor.values.segmentId !== target.segmentId
    ) {
      return riskSetBlocked('target_mismatch');
    }
  }

  if (hasInvalidRiskHistoryStructure) {
    return riskSetBlocked('invalid_risk_histories');
  }
  if (hasInvalidClinicalCheckStructure) {
    return riskSetBlocked('invalid_clinical_closure_checks');
  }

  if (!isValidTimestamp(rawOccurredAt)) {
    return riskSetBlocked('invalid_timestamp');
  }

  const riskIds = new Set<string>();
  const eventIds = new Set<string>();
  const closureReferenceIds = new Set<string>();
  const inspectedRisks: Array<Readonly<{
    projection: Exclude<ConversationRiskProjection, { state: 'none' }>;
    clinicalClosureReferenceId: string | null;
  }>> = [];

  for (const anchor of riskAnchors) {
    const snapshot = parseRiskHistorySnapshot(anchor.rawHistory);
    if (!snapshot) {
      return riskSetBlocked('invalid_risk_histories');
    }
    const inspected = inspectParsedRiskHistory(snapshot);
    if (inspected.kind === 'blocked' || inspected.projection.state === 'none') {
      return riskSetBlocked('invalid_risk_histories');
    }
    const projection = inspected.projection;
    if (
      projection.tenantId !== target.tenantId
      || projection.institutionId !== target.institutionId
    ) {
      return riskSetBlocked('scope_mismatch');
    }
    if (
      projection.conversationId !== target.conversationId
      || projection.segmentId !== target.segmentId
    ) {
      return riskSetBlocked('target_mismatch');
    }
    if (!opaqueReferencePatterns.riskId.test(projection.riskId)) {
      return riskSetBlocked('invalid_identifier');
    }
    if (riskIds.has(projection.riskId)) {
      return riskSetBlocked('invalid_risk_histories');
    }
    riskIds.add(projection.riskId);

    for (const event of snapshot) {
      if (
        !opaqueReferencePatterns.riskEventId.test(event.eventId)
        || (
          event.kind === 'risk_unconfirmed'
          && !opaqueReferencePatterns.messageId.test(event.sourceMessageId)
        )
        || (
          event.kind === 'risk_confirmed'
          && !opaqueReferencePatterns.userId.test(event.confirmedByActorId)
        )
        || (
          event.kind === 'risk_resolved'
          && !opaqueReferencePatterns.userId.test(event.resolvedByActorId)
        )
      ) {
        return riskSetBlocked('invalid_identifier');
      }
      if (eventIds.has(event.eventId) || event.occurredAt > rawOccurredAt) {
        return riskSetBlocked(
          event.occurredAt > rawOccurredAt ? 'invalid_timestamp' : 'invalid_risk_histories',
        );
      }
      eventIds.add(event.eventId);
    }

    let clinicalClosureReferenceId: string | null = null;
    if (projection.state === 'resolved' && projection.riskDomain === 'clinical') {
      const resolvedEvent = snapshot[2];
      if (
        resolvedEvent?.kind !== 'risk_resolved'
        || resolvedEvent.clinicalClosureReference === null
        || !opaqueReferencePatterns.clinicalClosureReferenceId.test(
          resolvedEvent.clinicalClosureReference.referenceId,
        )
      ) {
        return riskSetBlocked('invalid_identifier');
      }
      clinicalClosureReferenceId = resolvedEvent.clinicalClosureReference.referenceId;
      if (closureReferenceIds.has(clinicalClosureReferenceId)) {
        return riskSetBlocked('invalid_risk_histories');
      }
      closureReferenceIds.add(clinicalClosureReferenceId);
    }
    inspectedRisks.push({ projection, clinicalClosureReferenceId });
  }

  const consumedChecks = new Set<string>();
  for (const anchor of checkAnchors) {
    const values = anchor.values;
    if (
      typeof values.riskId !== 'string'
      || !opaqueReferencePatterns.riskId.test(values.riskId)
      || typeof values.referenceId !== 'string'
      || !opaqueReferencePatterns.clinicalClosureReferenceId.test(values.referenceId)
      || values.verificationState !== 'valid'
      || values.revocationState !== 'not_revoked'
      || !isValidTimestamp(values.checkedAt)
      || values.checkedAt !== rawOccurredAt
      || !isStructuredCloneable(anchor.rawCheck)
    ) {
      return riskSetBlocked('invalid_clinical_closure_checks');
    }
    const key = `${values.riskId}:${values.referenceId}`;
    if (consumedChecks.has(key)) {
      return riskSetBlocked('invalid_clinical_closure_checks');
    }
    const matchingRisk = inspectedRisks.find((risk) => (
      risk.projection.riskId === values.riskId
      && risk.clinicalClosureReferenceId === values.referenceId
    ));
    if (!matchingRisk) {
      return riskSetBlocked('invalid_clinical_closure_checks');
    }
    consumedChecks.add(key);
  }

  if (
    !isStructuredCloneable(rawHistories)
    || !isStructuredCloneable(rawChecks)
  ) {
    return riskSetBlocked('invalid_risk_histories');
  }

  const risks: ProjectedRiskSetEntry[] = inspectedRisks.map((risk) => {
    const { projection, clinicalClosureReferenceId } = risk;
    if (projection.state === 'unconfirmed' || projection.state === 'confirmed') {
      return {
        riskId: projection.riskId,
        state: projection.state,
        riskDomain: projection.riskDomain,
        clinicalClosureCheckState: 'not_applicable',
      };
    }
    if (projection.riskDomain === 'non_clinical') {
      return {
        riskId: projection.riskId,
        state: 'resolved',
        riskDomain: 'non_clinical',
        clinicalClosureCheckState: 'not_required',
      };
    }
    const checkKey = `${projection.riskId}:${clinicalClosureReferenceId}`;
    return {
      riskId: projection.riskId,
      state: 'resolved',
      riskDomain: 'clinical',
      clinicalClosureCheckState: consumedChecks.has(checkKey) ? 'current' : 'missing',
    };
  });
  risks.sort((left, right) => left.riskId.localeCompare(right.riskId));

  return deepFreeze({
    kind: 'projected',
    projection: {
      ...target,
      provenance: 'caller_declared_complete_histories',
      risks,
    },
  });
}
