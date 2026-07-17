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

export type CurrentClinicalClosureCheck = Readonly<{
  referenceId: string;
  tenantId: string;
  institutionId: string;
  valid: boolean;
  revoked: boolean;
  checkedAt: string;
  validUntil: string;
}>;

export type ConversationRiskNormalCloseBlockCode =
  | 'invalid_timestamp'
  | 'risk_history_invalid'
  | 'risk_set_completeness_unverified'
  | 'risk_target_mismatch'
  | 'risk_not_resolved'
  | 'clinical_closure_reference_required'
  | 'clinical_closure_reference_mismatch'
  | 'clinical_closure_scope_mismatch'
  | 'clinical_closure_reference_invalid'
  | 'clinical_closure_reference_revoked'
  | 'clinical_closure_verification_expired';

export type ConversationRiskNormalCloseResult =
  | Readonly<{
      kind: 'allowed';
    }>
  | Readonly<{
      kind: 'blocked';
      code: ConversationRiskNormalCloseBlockCode;
    }>;

export type ConversationRiskNormalCloseInput = Readonly<{
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
  decisionAt: string;
  currentClinicalClosureChecks: readonly CurrentClinicalClosureCheck[];
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
const currentClinicalClosureCheckKeys = [
  'referenceId',
  'tenantId',
  'institutionId',
  'valid',
  'revoked',
  'checkedAt',
  'validUntil',
] as const;
const normalCloseInputKeys = [
  'tenantId',
  'institutionId',
  'conversationId',
  'segmentId',
  'decisionAt',
  'currentClinicalClosureChecks',
] as const;
const recordRiskInputKeys = [
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
const confirmRiskInputKeys = [
  'eventId',
  'riskId',
  'actorId',
  'actorKind',
  'occurredAt',
] as const;
const resolveRiskInputKeys = [
  'eventId',
  'riskId',
  'actorId',
  'actorKind',
  'occurredAt',
] as const;
const resolveClinicalRiskInputKeys = [
  ...resolveRiskInputKeys,
  'clinicalClosureVerification',
] as const;
const clinicalClosureVerificationKeys = [
  'referenceId',
  'tenantId',
  'institutionId',
  'valid',
  'revoked',
  'verifiedAt',
] as const;

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

const captureDataRecord = (
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
  if (!expectedKeys) {
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

const hasCapturedKeys = (
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean => {
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && keys.every((key) => expectedKeys.includes(key));
};

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
    ||
    ownKeys.some((key) => (
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

const captureClinicalClosureReference = (
  value: unknown,
): LowSensitiveClinicalClosureReference | null => {
  const reference = captureDataRecord(value, [clinicalClosureReferenceKeys]);
  if (reference === null) {
    return null;
  }
  const scope = captureDataRecord(reference.scope, [institutionScopeKeys]);
  if (scope === null) {
    return null;
  }
  return {
    referenceId: reference.referenceId as string,
    scope: {
      tenantId: scope.tenantId as string,
      institutionId: scope.institutionId as string,
    },
    verificationState: reference.verificationState as 'valid',
    revocationState: reference.revocationState as 'not_revoked',
    verifiedAt: reference.verifiedAt as string,
  };
};

const captureRiskEvent = (value: unknown): ConversationRiskEvent | null => {
  const captured = captureDataRecord(value, [
    riskUnconfirmedEventKeys,
    riskConfirmedEventKeys,
    riskResolvedEventKeys,
  ]);
  if (captured === null) {
    return null;
  }
  if (captured.kind === 'risk_unconfirmed' && hasCapturedKeys(captured, riskUnconfirmedEventKeys)) {
    return {
      kind: 'risk_unconfirmed',
      eventId: captured.eventId as string,
      riskId: captured.riskId as string,
      tenantId: captured.tenantId as string,
      institutionId: captured.institutionId as string,
      conversationId: captured.conversationId as string,
      segmentId: captured.segmentId as string,
      sourceMessageId: captured.sourceMessageId as string,
      riskDomain: captured.riskDomain as ConversationRiskDomain,
      riskCode: captured.riskCode as string,
      occurredAt: captured.occurredAt as string,
    };
  }
  if (captured.kind === 'risk_confirmed' && hasCapturedKeys(captured, riskConfirmedEventKeys)) {
    return {
      kind: 'risk_confirmed',
      eventId: captured.eventId as string,
      riskId: captured.riskId as string,
      confirmedByActorId: captured.confirmedByActorId as string,
      occurredAt: captured.occurredAt as string,
    };
  }
  if (captured.kind === 'risk_resolved' && hasCapturedKeys(captured, riskResolvedEventKeys)) {
    const clinicalClosureReference = captured.clinicalClosureReference === null
      ? null
      : captureClinicalClosureReference(captured.clinicalClosureReference);
    if (captured.clinicalClosureReference !== null && clinicalClosureReference === null) {
      return null;
    }
    return {
      kind: 'risk_resolved',
      eventId: captured.eventId as string,
      riskId: captured.riskId as string,
      resolvedByActorId: captured.resolvedByActorId as string,
      occurredAt: captured.occurredAt as string,
      clinicalClosureReference,
    };
  }
  return null;
};

type InspectedRiskHistory = Readonly<{
  result: ConversationRiskProjectionResult;
  history: ConversationRiskHistory | null;
}>;

function inspectRiskHistory(historyValue: unknown): InspectedRiskHistory {
  try {
    const rawEvents = captureDenseDataArray(historyValue);
    if (rawEvents === null) {
      return {
        result: { kind: 'blocked', code: 'invalid_risk_history' },
        history: null,
      };
    }
    const history: ConversationRiskEvent[] = [];
    for (const rawEvent of rawEvents) {
      const event = captureRiskEvent(rawEvent);
      if (event === null) {
        return {
          result: { kind: 'blocked', code: 'invalid_risk_history' },
          history: null,
        };
      }
      history.push(event);
    }
  if (history.length === 0) {
      return {
        result: { kind: 'projected', projection: { state: 'none' } },
        history,
      };
  }
  if (history.length > 3) {
      return {
        result: { kind: 'blocked', code: 'invalid_risk_history' },
        history: null,
      };
  }
  const expectedKinds = ['risk_unconfirmed', 'risk_confirmed', 'risk_resolved'] as const;
    if (history.some((event, index) => event.kind !== expectedKinds[index])) {
      return {
        result: { kind: 'blocked', code: 'invalid_risk_history' },
        history: null,
      };
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
      return {
        result: { kind: 'blocked', code: 'invalid_risk_history' },
        history: null,
      };
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
        return {
          result: { kind: 'blocked', code: 'invalid_risk_history' },
          history: null,
        };
    }
    if (event.kind === 'risk_confirmed' && !isSafeObjectId(event.confirmedByActorId)) {
        return {
          result: { kind: 'blocked', code: 'invalid_risk_history' },
          history: null,
        };
    }
    if (event.kind === 'risk_resolved') {
      if (!isSafeObjectId(event.resolvedByActorId)) {
        return {
          result: { kind: 'blocked', code: 'invalid_risk_history' },
          history: null,
        };
      }
      if (
        unconfirmed.riskDomain === 'clinical'
        && (
          event.clinicalClosureReference === null
          || !isSafeObjectId(event.clinicalClosureReference.referenceId)
          || event.clinicalClosureReference.scope.tenantId !== unconfirmed.tenantId
          || event.clinicalClosureReference.scope.institutionId !== unconfirmed.institutionId
          || event.clinicalClosureReference.verificationState !== 'valid'
          || event.clinicalClosureReference.revocationState !== 'not_revoked'
          || !isValidTimestamp(event.clinicalClosureReference.verifiedAt)
          || event.clinicalClosureReference.verifiedAt > event.occurredAt
        )
      ) {
          return {
            result: { kind: 'blocked', code: 'invalid_risk_history' },
            history: null,
          };
      }
      if (unconfirmed.riskDomain === 'non_clinical' && event.clinicalClosureReference !== null) {
          return {
            result: { kind: 'blocked', code: 'invalid_risk_history' },
            history: null,
          };
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
      result: {
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
      },
      history,
    };
  } catch {
    return {
      result: { kind: 'blocked', code: 'invalid_risk_history' },
      history: null,
    };
  }
}

export function projectConversationRisk(
  history: Readonly<ConversationRiskHistory>,
): ConversationRiskProjectionResult {
  return inspectRiskHistory(history).result;
}

const normalCloseBlocked = (
  code: ConversationRiskNormalCloseBlockCode,
): ConversationRiskNormalCloseResult => ({ kind: 'blocked', code });

export function checkConversationRiskSetForNormalClose(
  histories: readonly ConversationRiskHistory[],
  input: ConversationRiskNormalCloseInput,
): ConversationRiskNormalCloseResult {
  try {
    const capturedInput = captureDataRecord(input, [normalCloseInputKeys]);
    if (
      capturedInput === null
      || !isSafeObjectId(capturedInput.tenantId)
      || !isSafeObjectId(capturedInput.institutionId)
      || !isSafeObjectId(capturedInput.conversationId)
      || !isSafeObjectId(capturedInput.segmentId)
    ) {
      return normalCloseBlocked('risk_target_mismatch');
    }
    if (!isValidTimestamp(capturedInput.decisionAt)) {
      return normalCloseBlocked('invalid_timestamp');
    }

    const capturedHistories = captureDenseDataArray(histories);
    const capturedChecks = captureDenseDataArray(capturedInput.currentClinicalClosureChecks);
    if (capturedHistories === null || capturedChecks === null) {
      return normalCloseBlocked('risk_history_invalid');
    }
    if (capturedHistories.length === 0) {
      return normalCloseBlocked('risk_set_completeness_unverified');
    }

    const projections: Exclude<ConversationRiskProjection, { state: 'none' }>[] = [];
    const riskIds = new Set<string>();
    const eventIds = new Set<string>();
    const clinicalClosureReferenceIds = new Set<string>();
    for (const history of capturedHistories) {
      const capturedHistory = captureDenseDataArray(history);
      if (capturedHistory === null || capturedHistory.length === 0) {
        return normalCloseBlocked('risk_history_invalid');
      }
      const anchor = captureDataRecord(capturedHistory[0], [riskUnconfirmedEventKeys]);
      if (anchor === null) {
        return normalCloseBlocked('risk_history_invalid');
      }
      if (
        isSafeObjectId(anchor.tenantId)
        && isSafeObjectId(anchor.institutionId)
        && isSafeObjectId(anchor.conversationId)
        && isSafeObjectId(anchor.segmentId)
        && (
          anchor.tenantId !== capturedInput.tenantId
          || anchor.institutionId !== capturedInput.institutionId
          || anchor.conversationId !== capturedInput.conversationId
          || anchor.segmentId !== capturedInput.segmentId
        )
      ) {
        return normalCloseBlocked('risk_target_mismatch');
      }
      const inspected = inspectRiskHistory(history);
      if (
        inspected.result.kind === 'blocked'
        || inspected.result.projection.state === 'none'
        || inspected.history === null
      ) {
        return normalCloseBlocked('risk_history_invalid');
      }
      const projection = inspected.result.projection;
      if (
        projection.tenantId !== capturedInput.tenantId
        || projection.institutionId !== capturedInput.institutionId
        || projection.conversationId !== capturedInput.conversationId
        || projection.segmentId !== capturedInput.segmentId
      ) {
        return normalCloseBlocked('risk_target_mismatch');
      }
      if (riskIds.has(projection.riskId)) {
        return normalCloseBlocked('risk_history_invalid');
      }
      riskIds.add(projection.riskId);
      for (const event of inspected.history) {
        if (eventIds.has(event.eventId)) {
          return normalCloseBlocked('risk_history_invalid');
        }
        eventIds.add(event.eventId);
      }
      if (
        projection.state === 'resolved'
        && projection.riskDomain === 'clinical'
        && projection.clinicalClosureReferenceId !== null
      ) {
        if (clinicalClosureReferenceIds.has(projection.clinicalClosureReferenceId)) {
          return normalCloseBlocked('risk_history_invalid');
        }
        clinicalClosureReferenceIds.add(projection.clinicalClosureReferenceId);
      }
      projections.push(projection);
    }

    const checks: CurrentClinicalClosureCheck[] = [];
    for (const rawCheck of capturedChecks) {
      const check = captureDataRecord(rawCheck, [currentClinicalClosureCheckKeys]);
      if (check === null) {
        return normalCloseBlocked('clinical_closure_reference_invalid');
      }
      if (
        isSafeObjectId(check.tenantId)
        && isSafeObjectId(check.institutionId)
        && (
          check.tenantId !== capturedInput.tenantId
          || check.institutionId !== capturedInput.institutionId
        )
      ) {
        return normalCloseBlocked('clinical_closure_scope_mismatch');
      }
      checks.push({
        referenceId: check.referenceId as string,
        tenantId: check.tenantId as string,
        institutionId: check.institutionId as string,
        valid: check.valid as boolean,
        revoked: check.revoked as boolean,
        checkedAt: check.checkedAt as string,
        validUntil: check.validUntil as string,
      });
    }

    const requiredClinicalReferences = new Set<string>();
    for (const projection of projections) {
      if (projection.state !== 'resolved') {
        return normalCloseBlocked('risk_not_resolved');
      }
      if (projection.resolvedAt === null || projection.resolvedAt > capturedInput.decisionAt) {
        return normalCloseBlocked('risk_history_invalid');
      }
      if (projection.riskDomain !== 'clinical') {
        continue;
      }
      if (
        projection.clinicalClosureReferenceId === null
      ) {
        return normalCloseBlocked('clinical_closure_reference_required');
      }
      requiredClinicalReferences.add(projection.clinicalClosureReferenceId);
      const matchingChecks = checks.filter(
        (check) => check.referenceId === projection.clinicalClosureReferenceId,
      );
      if (matchingChecks.length === 0) {
        return normalCloseBlocked(
          checks.length === 0
            ? 'clinical_closure_reference_required'
            : 'clinical_closure_reference_mismatch',
        );
      }
      if (matchingChecks.length !== 1) {
        return normalCloseBlocked('clinical_closure_reference_mismatch');
      }
      const check = matchingChecks[0]!;
      if (
        !isSafeObjectId(check.referenceId)
        || !isSafeObjectId(check.tenantId)
        || !isSafeObjectId(check.institutionId)
        || typeof check.valid !== 'boolean'
        || typeof check.revoked !== 'boolean'
        || !isValidTimestamp(check.checkedAt)
        || !isValidTimestamp(check.validUntil)
        || check.checkedAt > capturedInput.decisionAt
        || check.checkedAt < projection.resolvedAt
        || check.validUntil < check.checkedAt
      ) {
        return normalCloseBlocked('clinical_closure_reference_invalid');
      }
      if (
        check.tenantId !== capturedInput.tenantId
        || check.institutionId !== capturedInput.institutionId
        || check.tenantId !== projection.tenantId
        || check.institutionId !== projection.institutionId
      ) {
        return normalCloseBlocked('clinical_closure_scope_mismatch');
      }
      if (check.valid !== true) {
        return normalCloseBlocked('clinical_closure_reference_invalid');
      }
      if (check.revoked !== false) {
        return normalCloseBlocked('clinical_closure_reference_revoked');
      }
      if (check.validUntil < capturedInput.decisionAt) {
        return normalCloseBlocked('clinical_closure_verification_expired');
      }
    }

    if (
      checks.length !== requiredClinicalReferences.size
      || checks.some((check) => !requiredClinicalReferences.has(check.referenceId))
    ) {
      return normalCloseBlocked('clinical_closure_reference_mismatch');
    }
    return { kind: 'allowed' };
  } catch {
    return normalCloseBlocked('risk_history_invalid');
  }
}

const appendEvent = (
  history: ConversationRiskHistory,
  event: ConversationRiskEvent,
): ConversationRiskMutationResult => {
  const nextHistory = [...history, event];
  const inspected = inspectRiskHistory(nextHistory);
  if (inspected.result.kind === 'blocked' || inspected.history === null) {
    return mutationBlocked('invalid_risk_history');
  }
  return {
    kind: 'applied',
    history: inspected.history,
    projection: inspected.result.projection,
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
  try {
    const current = inspectRiskHistory(history);
    if (current.result.kind === 'blocked' || current.history === null) {
      return mutationBlocked('invalid_risk_history');
    }
    if (current.result.projection.state !== 'none') {
      return mutationBlocked('risk_already_recorded');
    }
    const capturedInput = captureDataRecord(input, [recordRiskInputKeys]);
    if (
      capturedInput === null
      || !isSafeObjectId(capturedInput.eventId)
      || !isSafeObjectId(capturedInput.riskId)
      || !isSafeObjectId(capturedInput.tenantId)
      || !isSafeObjectId(capturedInput.institutionId)
      || !isSafeObjectId(capturedInput.conversationId)
      || !isSafeObjectId(capturedInput.segmentId)
      || !isSafeObjectId(capturedInput.sourceMessageId)
    ) {
      return mutationBlocked('invalid_object_id');
    }
    if (!conversationRiskDomains.includes(capturedInput.riskDomain as ConversationRiskDomain)) {
      return mutationBlocked('invalid_risk_domain');
    }
    if (!isSafeRiskCode(capturedInput.riskCode)) {
      return mutationBlocked('invalid_risk_code');
    }
    if (!isValidTimestamp(capturedInput.occurredAt)) {
      return mutationBlocked('invalid_timestamp');
    }
    return appendEvent(current.history, {
      kind: 'risk_unconfirmed',
      eventId: capturedInput.eventId,
      riskId: capturedInput.riskId,
      tenantId: capturedInput.tenantId,
      institutionId: capturedInput.institutionId,
      conversationId: capturedInput.conversationId,
      segmentId: capturedInput.segmentId,
      sourceMessageId: capturedInput.sourceMessageId,
      riskDomain: capturedInput.riskDomain as ConversationRiskDomain,
      riskCode: capturedInput.riskCode,
      occurredAt: capturedInput.occurredAt,
    });
  } catch {
    return mutationBlocked('invalid_risk_history');
  }
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
  try {
    const current = inspectRiskHistory(history);
    if (current.result.kind === 'blocked' || current.history === null) {
      return mutationBlocked('invalid_risk_history');
    }
    if (current.result.projection.state !== 'unconfirmed') {
      return mutationBlocked('risk_confirmation_requires_unconfirmed');
    }
    const capturedInput = captureDataRecord(input, [confirmRiskInputKeys]);
    if (capturedInput === null) {
      return mutationBlocked('invalid_object_id');
    }
    if (current.result.projection.riskId !== capturedInput.riskId) {
      return mutationBlocked('risk_id_mismatch');
    }
    if (capturedInput.actorKind !== 'human') {
      return mutationBlocked('human_confirmation_required');
    }
    if (!isSafeObjectId(capturedInput.eventId) || !isSafeObjectId(capturedInput.actorId)) {
      return mutationBlocked('invalid_object_id');
    }
    const lastOccurredAt = current.history[current.history.length - 1]?.occurredAt;
    if (
      !isValidTimestamp(capturedInput.occurredAt)
      || (lastOccurredAt && capturedInput.occurredAt < lastOccurredAt)
    ) {
      return mutationBlocked('invalid_timestamp');
    }
    return appendEvent(current.history, {
      kind: 'risk_confirmed',
      eventId: capturedInput.eventId,
      riskId: capturedInput.riskId as string,
      confirmedByActorId: capturedInput.actorId,
      occurredAt: capturedInput.occurredAt,
    });
  } catch {
    return mutationBlocked('invalid_risk_history');
  }
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
  try {
    const current = inspectRiskHistory(history);
    if (current.result.kind === 'blocked' || current.history === null) {
      return mutationBlocked('invalid_risk_history');
    }
    if (current.result.projection.state !== 'confirmed') {
      return mutationBlocked('risk_resolution_requires_confirmed');
    }
    const capturedInput = captureDataRecord(input, [
      resolveRiskInputKeys,
      resolveClinicalRiskInputKeys,
    ]);
    if (capturedInput === null) {
      return mutationBlocked('invalid_object_id');
    }
    if (current.result.projection.riskId !== capturedInput.riskId) {
      return mutationBlocked('risk_id_mismatch');
    }
    if (capturedInput.actorKind !== 'human') {
      return mutationBlocked('human_confirmation_required');
    }
    if (!isSafeObjectId(capturedInput.eventId) || !isSafeObjectId(capturedInput.actorId)) {
      return mutationBlocked('invalid_object_id');
    }
    const lastOccurredAt = current.history[current.history.length - 1]?.occurredAt;
    if (
      !isValidTimestamp(capturedInput.occurredAt)
      || (lastOccurredAt && capturedInput.occurredAt < lastOccurredAt)
    ) {
      return mutationBlocked('invalid_timestamp');
    }

    let clinicalClosureReference: LowSensitiveClinicalClosureReference | null = null;
    if (current.result.projection.riskDomain === 'clinical') {
      if (capturedInput.clinicalClosureVerification === undefined) {
        return mutationBlocked('clinical_closure_reference_required');
      }
      const verification = captureDataRecord(
        capturedInput.clinicalClosureVerification,
        [clinicalClosureVerificationKeys],
      );
      if (verification === null) {
        return mutationBlocked('clinical_closure_reference_invalid');
      }
      if (
        verification.tenantId !== current.result.projection.tenantId
        || verification.institutionId !== current.result.projection.institutionId
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
        || verification.verifiedAt > capturedInput.occurredAt
      ) {
        return mutationBlocked('clinical_closure_reference_invalid');
      }
      clinicalClosureReference = {
        referenceId: verification.referenceId,
        scope: {
          tenantId: verification.tenantId as string,
          institutionId: verification.institutionId as string,
        },
        verificationState: 'valid',
        revocationState: 'not_revoked',
        verifiedAt: verification.verifiedAt,
      };
    } else if (capturedInput.clinicalClosureVerification !== undefined) {
      return mutationBlocked('clinical_closure_reference_invalid');
    }

    return appendEvent(current.history, {
      kind: 'risk_resolved',
      eventId: capturedInput.eventId,
      riskId: capturedInput.riskId as string,
      resolvedByActorId: capturedInput.actorId,
      occurredAt: capturedInput.occurredAt,
      clinicalClosureReference,
    });
  } catch {
    return mutationBlocked('invalid_risk_history');
  }
}
