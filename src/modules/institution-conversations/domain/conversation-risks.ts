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

const safeObjectIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const safeRiskCodePattern = /^[a-z][a-z0-9._-]{0,63}$/u;
const canonicalUtcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

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

const mutationBlocked = (code: ConversationRiskBlockCode): ConversationRiskMutationResult => ({
  kind: 'blocked',
  code,
});

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

function inspectRiskHistory(history: ConversationRiskHistory): ConversationRiskProjectionResult {
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

export function projectConversationRisk(
  history: Readonly<ConversationRiskHistory>,
): ConversationRiskProjectionResult {
  return inspectRiskHistory(history);
}

const appendEvent = (
  history: ConversationRiskHistory,
  event: ConversationRiskEvent,
): ConversationRiskMutationResult => {
  const nextHistory = [...history, event];
  const projected = inspectRiskHistory(nextHistory);
  if (projected.kind === 'blocked') {
    return mutationBlocked('invalid_risk_history');
  }
  return {
    kind: 'applied',
    history: nextHistory,
    projection: projected.projection,
    appendedEvent: event,
  };
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
