/** Internal pure reducer only; it performs no persistence, provider, or Care action. */

export const careDispositionClassifications = Object.freeze([
  'simple_confirmation',
  'substantive_consultation',
  'ambiguous',
  'risk',
] as const);

export const careDispositionBlockingReasonCodes = Object.freeze([
  'clinical_risk',
  'complaint',
  'refund_dispute',
  'opt_out',
  'privacy_request',
  'unresolved_consultation',
  'identity_unconfirmed',
  'forced_close_unresolved',
] as const);

export type CareDispositionClassification =
  (typeof careDispositionClassifications)[number];
export type CareDispositionBlockingReasonCode =
  (typeof careDispositionBlockingReasonCodes)[number];
export type CareDispositionIdentityState = 'matched' | 'pending_review' | 'unmatched' | 'conflict';
export type CareDispositionRiskState = 'none' | 'unconfirmed' | 'confirmed' | 'resolved';
export type CareDispositionRiskDomain = 'clinical' | 'non_clinical';
export type CareDispositionResolutionState = 'open' | 'resolved' | 'invalidated';
export type CareDispositionCloseKind = 'open' | 'normal' | 'forced';

export type CareDisposition = Readonly<{
  dispositionId: string;
  revision: number;
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
  sourceMessageId: string;
  sourceMessageOccurredAt: string;
  sourceMessageRevision: number;
  lastCustomerMessageAt: string;
  identityState: CareDispositionIdentityState;
  classification: CareDispositionClassification | null;
  resolutionState: CareDispositionResolutionState;
  segmentCloseKind: CareDispositionCloseKind;
  riskState: CareDispositionRiskState;
  riskDomain: CareDispositionRiskDomain | null;
  riskClosureReference: string | null;
  blockingReasonCodes: readonly CareDispositionBlockingReasonCode[];
  classifiedAt: string | null;
  resolvedAt: string | null;
  segmentClosedAt: string | null;
  snapshotCreatedAt: string;
  invalidatedAt: string | null;
  auditReference: string;
}>;

export type CreatePendingCareDispositionInput = Readonly<{
  dispositionId: unknown;
  tenantId: unknown;
  institutionId: unknown;
  conversationId: unknown;
  segmentId: unknown;
  sourceMessageId: unknown;
  sourceMessageOccurredAt: unknown;
  sourceMessageRevision: unknown;
  lastCustomerMessageAt: unknown;
  identityState: unknown;
  riskState: unknown;
  riskDomain: unknown;
  riskClosureReference: unknown;
  blockingReasonCodes: unknown;
  auditReference: unknown;
  snapshotCreatedAt: unknown;
}>;

type CareCommandResult =
  | Readonly<{ kind: 'created'; disposition: CareDisposition }>
  | Readonly<{ kind: 'appended'; previous: CareDisposition; current: CareDisposition }>
  | Readonly<{ kind: 'blocked'; code: CareDispositionBlockCode }>;

type CareCreateResult = Extract<CareCommandResult, { kind: 'created' | 'blocked' }>;

export type CareDispositionBlockCode =
  | 'classification_already_present'
  | 'input_invalid'
  | 'not_current'
  | 'risk_conflict'
  | 'revision_conflict'
  | 'scope_mismatch'
  | 'source_message_mismatch'
  | 'source_message_not_new'
  | 'state_conflict'
  | 'target_mismatch'
  | 'timestamp_conflict';

type CapturedRecord = Readonly<Record<string, unknown>>;

const safeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const canonicalTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const auditReferencePattern = /^audit_[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;
const riskClosureReferencePattern = /^risk_closure_[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u;

const dispositionKeys = Object.freeze([
  'dispositionId', 'revision', 'tenantId', 'institutionId', 'conversationId', 'segmentId',
  'sourceMessageId', 'sourceMessageOccurredAt', 'sourceMessageRevision', 'lastCustomerMessageAt',
  'identityState', 'classification', 'resolutionState', 'segmentCloseKind', 'riskState', 'riskDomain',
  'riskClosureReference', 'blockingReasonCodes', 'classifiedAt', 'resolvedAt', 'segmentClosedAt',
  'snapshotCreatedAt', 'invalidatedAt', 'auditReference',
] as const);

const createKeys = Object.freeze([
  'dispositionId', 'tenantId', 'institutionId', 'conversationId', 'segmentId', 'sourceMessageId',
  'sourceMessageOccurredAt', 'sourceMessageRevision', 'lastCustomerMessageAt', 'identityState',
  'riskState', 'riskDomain', 'riskClosureReference', 'blockingReasonCodes', 'auditReference',
  'snapshotCreatedAt',
] as const);

const classifyKeys = Object.freeze([
  'tenantId', 'institutionId', 'dispositionId', 'expectedRevision', 'conversationId', 'segmentId',
  'sourceMessageId', 'classification', 'resolutionState', 'classifiedAt', 'resolvedAt', 'riskState',
  'riskDomain', 'riskClosureReference', 'blockingReasonCodes', 'auditReference',
] as const);

const inboundKeys = Object.freeze([
  'tenantId', 'institutionId', 'dispositionId', 'expectedRevision', 'conversationId', 'segmentId',
  'sourceMessageId', 'sourceMessageOccurredAt', 'sourceMessageRevision', 'lastCustomerMessageAt',
  'identityState', 'riskState', 'riskDomain', 'riskClosureReference', 'blockingReasonCodes',
  'auditReference', 'snapshotCreatedAt',
] as const);

const closeKeys = Object.freeze([
  'tenantId', 'institutionId', 'dispositionId', 'expectedRevision', 'conversationId', 'segmentId',
  'sourceMessageId', 'segmentClosedAt', 'auditReference',
] as const);

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nestedValue of Object.values(value as Record<string, unknown>)) deepFreeze(nestedValue);
  return Object.freeze(value);
}

function blocked(code: CareDispositionBlockCode): Readonly<{ kind: 'blocked'; code: CareDispositionBlockCode }> {
  return deepFreeze({ kind: 'blocked' as const, code });
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function captureExactRecord(raw: unknown, expectedKeys: readonly string[]): CapturedRecord | null {
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw) || Object.getPrototypeOf(raw) !== Object.prototype) return null;
    const ownKeys = Reflect.ownKeys(raw);
    if (ownKeys.length !== expectedKeys.length || ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function captureString(value: unknown): string | null {
  return typeof value === 'string' && safeIdentifierPattern.test(value) ? value : null;
}

function captureTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !canonicalTimestampPattern.test(value) || Number.isNaN(Date.parse(value))) return null;
  return value;
}

function capturePositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function captureNullableTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  return captureTimestamp(value) ?? undefined;
}

function captureBlockers(value: unknown): readonly CareDispositionBlockingReasonCode[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(value);
    const expectedKeys = [...Array.from({ length: value.length }, (_, index) => String(index)), 'length'];
    if (ownKeys.length !== expectedKeys.length || ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))) return null;
    const codes: CareDispositionBlockingReasonCode[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable || !isOneOf(descriptor.value, careDispositionBlockingReasonCodes)) return null;
      if (codes.includes(descriptor.value)) return null;
      codes.push(descriptor.value);
    }
    return deepFreeze([...codes].sort((left, right) => careDispositionBlockingReasonCodes.indexOf(left) - careDispositionBlockingReasonCodes.indexOf(right)));
  } catch {
    return null;
  }
}

function captureRisk(
  rawState: unknown,
  rawDomain: unknown,
  rawClosureReference: unknown,
  blockers: readonly CareDispositionBlockingReasonCode[],
): Readonly<{ state: CareDispositionRiskState; domain: CareDispositionRiskDomain | null; closureReference: string | null }> | null {
  if (!isOneOf(rawState, ['none', 'unconfirmed', 'confirmed', 'resolved'] as const)) return null;
  const domain = rawDomain === null ? null : isOneOf(rawDomain, ['clinical', 'non_clinical'] as const) ? rawDomain : undefined;
  const closureReference = rawClosureReference === null ? null : typeof rawClosureReference === 'string' && riskClosureReferencePattern.test(rawClosureReference) ? rawClosureReference : undefined;
  if (domain === undefined || closureReference === undefined) return null;
  if (rawState === 'none' && (domain !== null || closureReference !== null || blockers.includes('clinical_risk'))) return null;
  if (rawState !== 'none' && domain === null) return null;
  if (rawState !== 'resolved' && closureReference !== null) return null;
  if (rawState === 'resolved' && domain === 'clinical' && closureReference === null) return null;
  if (domain !== 'clinical' && blockers.includes('clinical_risk')) return null;
  if (domain === 'clinical' && rawState !== 'resolved' && !blockers.includes('clinical_risk')) return null;
  return deepFreeze({ state: rawState, domain, closureReference });
}

function validateState(input: {
  classification: CareDispositionClassification | null;
  resolutionState: CareDispositionResolutionState;
  segmentCloseKind: CareDispositionCloseKind;
  risk: Readonly<{ state: CareDispositionRiskState; domain: CareDispositionRiskDomain | null; closureReference: string | null }>;
  blockers: readonly CareDispositionBlockingReasonCode[];
  classifiedAt: string | null;
  resolvedAt: string | null;
  segmentClosedAt: string | null;
  invalidatedAt: string | null;
}): CareDispositionBlockCode | null {
  if (input.resolutionState === 'invalidated') {
    if (input.invalidatedAt === null) return 'state_conflict';
  } else if (input.invalidatedAt !== null) return 'state_conflict';
  if (input.classification === 'risk' && input.risk.state === 'none') return 'risk_conflict';
  if (input.classification !== null && input.classification !== 'risk' && input.risk.state !== 'none') return 'risk_conflict';
  if (input.resolutionState !== 'invalidated') {
    if (input.classification === null && (input.classifiedAt !== null || input.resolutionState !== 'open' || input.resolvedAt !== null)) return 'state_conflict';
    if (input.classification !== null && input.classifiedAt === null) return 'state_conflict';
    if (input.resolutionState === 'resolved' && input.resolvedAt === null) return 'state_conflict';
    if (input.resolutionState !== 'resolved' && input.resolvedAt !== null) return 'state_conflict';
    if (input.segmentCloseKind === 'open' && input.segmentClosedAt !== null) return 'state_conflict';
    if (input.segmentCloseKind !== 'open' && input.segmentClosedAt === null) return 'state_conflict';
    if (input.segmentCloseKind === 'forced' && (input.resolutionState !== 'open' || input.resolvedAt !== null || !input.blockers.includes('forced_close_unresolved'))) return 'state_conflict';
    if (input.segmentCloseKind !== 'forced' && input.blockers.includes('forced_close_unresolved')) return 'state_conflict';
  }
  return null;
}

function makeDisposition(input: {
  dispositionId: string; revision: number; tenantId: string; institutionId: string; conversationId: string; segmentId: string;
  sourceMessageId: string; sourceMessageOccurredAt: string; sourceMessageRevision: number; lastCustomerMessageAt: string;
  identityState: CareDispositionIdentityState; classification: CareDispositionClassification | null;
  resolutionState: CareDispositionResolutionState; segmentCloseKind: CareDispositionCloseKind;
  risk: Readonly<{ state: CareDispositionRiskState; domain: CareDispositionRiskDomain | null; closureReference: string | null }>;
  blockers: readonly CareDispositionBlockingReasonCode[]; classifiedAt: string | null; resolvedAt: string | null;
  segmentClosedAt: string | null; snapshotCreatedAt: string; invalidatedAt: string | null; auditReference: string;
}): CareDisposition {
  return deepFreeze({
    dispositionId: input.dispositionId, revision: input.revision, tenantId: input.tenantId, institutionId: input.institutionId,
    conversationId: input.conversationId, segmentId: input.segmentId, sourceMessageId: input.sourceMessageId,
    sourceMessageOccurredAt: input.sourceMessageOccurredAt, sourceMessageRevision: input.sourceMessageRevision,
    lastCustomerMessageAt: input.lastCustomerMessageAt, identityState: input.identityState, classification: input.classification,
    resolutionState: input.resolutionState, segmentCloseKind: input.segmentCloseKind, riskState: input.risk.state,
    riskDomain: input.risk.domain, riskClosureReference: input.risk.closureReference, blockingReasonCodes: [...input.blockers],
    classifiedAt: input.classifiedAt, resolvedAt: input.resolvedAt, segmentClosedAt: input.segmentClosedAt,
    snapshotCreatedAt: input.snapshotCreatedAt, invalidatedAt: input.invalidatedAt, auditReference: input.auditReference,
  });
}

function captureDisposition(raw: unknown): CareDisposition | null {
  const snapshot = captureExactRecord(raw, dispositionKeys);
  if (!snapshot) return null;
  const dispositionId = captureString(snapshot.dispositionId);
  const revision = capturePositiveInteger(snapshot.revision);
  const tenantId = captureString(snapshot.tenantId);
  const institutionId = captureString(snapshot.institutionId);
  const conversationId = captureString(snapshot.conversationId);
  const segmentId = captureString(snapshot.segmentId);
  const sourceMessageId = captureString(snapshot.sourceMessageId);
  const sourceMessageOccurredAt = captureTimestamp(snapshot.sourceMessageOccurredAt);
  const sourceMessageRevision = capturePositiveInteger(snapshot.sourceMessageRevision);
  const lastCustomerMessageAt = captureTimestamp(snapshot.lastCustomerMessageAt);
  const identityState = isOneOf(snapshot.identityState, ['matched', 'pending_review', 'unmatched', 'conflict'] as const) ? snapshot.identityState : null;
  const classification = snapshot.classification === null ? null : isOneOf(snapshot.classification, careDispositionClassifications) ? snapshot.classification : undefined;
  const resolutionState = isOneOf(snapshot.resolutionState, ['open', 'resolved', 'invalidated'] as const) ? snapshot.resolutionState : null;
  const segmentCloseKind = isOneOf(snapshot.segmentCloseKind, ['open', 'normal', 'forced'] as const) ? snapshot.segmentCloseKind : null;
  const blockers = captureBlockers(snapshot.blockingReasonCodes);
  const classifiedAt = captureNullableTimestamp(snapshot.classifiedAt);
  const resolvedAt = captureNullableTimestamp(snapshot.resolvedAt);
  const segmentClosedAt = captureNullableTimestamp(snapshot.segmentClosedAt);
  const snapshotCreatedAt = captureTimestamp(snapshot.snapshotCreatedAt);
  const invalidatedAt = captureNullableTimestamp(snapshot.invalidatedAt);
  const auditReference = typeof snapshot.auditReference === 'string' && auditReferencePattern.test(snapshot.auditReference) ? snapshot.auditReference : null;
  if (!dispositionId || !revision || !tenantId || !institutionId || !conversationId || !segmentId || !sourceMessageId || !sourceMessageOccurredAt || !sourceMessageRevision || !lastCustomerMessageAt || !identityState || classification === undefined || !resolutionState || !segmentCloseKind || !blockers || classifiedAt === undefined || resolvedAt === undefined || segmentClosedAt === undefined || !snapshotCreatedAt || invalidatedAt === undefined || !auditReference) return null;
  const risk = captureRisk(snapshot.riskState, snapshot.riskDomain, snapshot.riskClosureReference, blockers);
  if (!risk || validateState({ classification, resolutionState, segmentCloseKind, risk, blockers, classifiedAt, resolvedAt, segmentClosedAt, invalidatedAt })) return null;
  return makeDisposition({ dispositionId, revision, tenantId, institutionId, conversationId, segmentId, sourceMessageId, sourceMessageOccurredAt, sourceMessageRevision, lastCustomerMessageAt, identityState, classification, resolutionState, segmentCloseKind, risk, blockers, classifiedAt, resolvedAt, segmentClosedAt, snapshotCreatedAt, invalidatedAt, auditReference });
}

export function isValidCareDisposition(value: unknown): value is CareDisposition {
  return captureDisposition(value) !== null;
}

/** An internal guard only; cross-line reader/envelope behavior remains out of this slice. */
export function isCareDispositionConsumable(value: unknown): boolean {
  const disposition = captureDisposition(value);
  return disposition !== null
    && disposition.invalidatedAt === null
    && disposition.resolutionState !== 'invalidated'
    && disposition.classification !== null;
}

export function createPendingCareDisposition(rawInput: unknown): CareCreateResult {
  const input = captureExactRecord(rawInput, createKeys);
  if (!input) return blocked('input_invalid');
  const dispositionId = captureString(input.dispositionId);
  const tenantId = captureString(input.tenantId);
  const institutionId = captureString(input.institutionId);
  const conversationId = captureString(input.conversationId);
  const segmentId = captureString(input.segmentId);
  const sourceMessageId = captureString(input.sourceMessageId);
  const sourceMessageOccurredAt = captureTimestamp(input.sourceMessageOccurredAt);
  const sourceMessageRevision = capturePositiveInteger(input.sourceMessageRevision);
  const lastCustomerMessageAt = captureTimestamp(input.lastCustomerMessageAt);
  const identityState = isOneOf(input.identityState, ['matched', 'pending_review', 'unmatched', 'conflict'] as const) ? input.identityState : null;
  const blockers = captureBlockers(input.blockingReasonCodes);
  const auditReference = typeof input.auditReference === 'string' && auditReferencePattern.test(input.auditReference) ? input.auditReference : null;
  const snapshotCreatedAt = captureTimestamp(input.snapshotCreatedAt);
  if (!dispositionId || !tenantId || !institutionId || !conversationId || !segmentId || !sourceMessageId || !sourceMessageOccurredAt || !sourceMessageRevision || !lastCustomerMessageAt || !identityState || !blockers || !auditReference || !snapshotCreatedAt) return blocked('input_invalid');
  if (Date.parse(lastCustomerMessageAt) < Date.parse(sourceMessageOccurredAt) || Date.parse(snapshotCreatedAt) < Date.parse(sourceMessageOccurredAt)) return blocked('timestamp_conflict');
  const risk = captureRisk(input.riskState, input.riskDomain, input.riskClosureReference, blockers);
  if (!risk) return blocked('risk_conflict');
  const stateCode = validateState({ classification: null, resolutionState: 'open', segmentCloseKind: 'open', risk, blockers, classifiedAt: null, resolvedAt: null, segmentClosedAt: null, invalidatedAt: null });
  if (stateCode) return blocked(stateCode);
  return deepFreeze({ kind: 'created' as const, disposition: makeDisposition({ dispositionId, revision: 1, tenantId, institutionId, conversationId, segmentId, sourceMessageId, sourceMessageOccurredAt, sourceMessageRevision, lastCustomerMessageAt, identityState, classification: null, resolutionState: 'open', segmentCloseKind: 'open', risk, blockers, classifiedAt: null, resolvedAt: null, segmentClosedAt: null, snapshotCreatedAt, invalidatedAt: null, auditReference }) });
}

function captureCommandTarget(
  input: CapturedRecord,
  current: CareDisposition,
  requireCurrentSourceMessage = true,
): CareDispositionBlockCode | null {
  const tenantId = captureString(input.tenantId);
  const institutionId = captureString(input.institutionId);
  if (!tenantId || !institutionId) return 'input_invalid';
  if (tenantId !== current.tenantId || institutionId !== current.institutionId) return 'scope_mismatch';
  const dispositionId = captureString(input.dispositionId);
  const conversationId = captureString(input.conversationId);
  const segmentId = captureString(input.segmentId);
  if (!dispositionId || !conversationId || !segmentId) return 'input_invalid';
  if (dispositionId !== current.dispositionId || conversationId !== current.conversationId || segmentId !== current.segmentId) return 'target_mismatch';
  const sourceMessageId = captureString(input.sourceMessageId);
  if (!sourceMessageId) return 'input_invalid';
  if (requireCurrentSourceMessage && sourceMessageId !== current.sourceMessageId) return 'source_message_mismatch';
  const expectedRevision = capturePositiveInteger(input.expectedRevision);
  if (!expectedRevision || expectedRevision !== current.revision) return 'revision_conflict';
  if (current.invalidatedAt !== null || current.resolutionState === 'invalidated') return 'not_current';
  return null;
}

function invalidatePrevious(current: CareDisposition, invalidatedAt: string): CareDisposition {
  return makeDisposition({
    ...current, resolutionState: 'invalidated', invalidatedAt,
    risk: { state: current.riskState, domain: current.riskDomain, closureReference: current.riskClosureReference },
    blockers: current.blockingReasonCodes,
  });
}

function appended(previous: CareDisposition, current: CareDisposition): CareCommandResult {
  return deepFreeze({ kind: 'appended' as const, previous, current });
}

export function classifyCareDisposition(rawCurrent: unknown, rawInput: unknown): CareCommandResult {
  const current = captureDisposition(rawCurrent);
  const input = captureExactRecord(rawInput, classifyKeys);
  if (!current || !input) return blocked('input_invalid');
  const targetCode = captureCommandTarget(input, current);
  if (targetCode) return blocked(targetCode);
  if (current.classification !== null) return blocked('classification_already_present');
  const classification = isOneOf(input.classification, careDispositionClassifications) ? input.classification : null;
  const resolutionState = isOneOf(input.resolutionState, ['open', 'resolved'] as const) ? input.resolutionState : null;
  const classifiedAt = captureTimestamp(input.classifiedAt);
  const resolvedAt = captureNullableTimestamp(input.resolvedAt);
  const blockers = captureBlockers(input.blockingReasonCodes);
  const auditReference = typeof input.auditReference === 'string' && auditReferencePattern.test(input.auditReference) ? input.auditReference : null;
  if (!classification || !resolutionState || !classifiedAt || resolvedAt === undefined || !blockers || !auditReference) return blocked('input_invalid');
  if (Date.parse(classifiedAt) < Date.parse(current.snapshotCreatedAt) || (resolvedAt !== null && Date.parse(resolvedAt) < Date.parse(classifiedAt))) return blocked('timestamp_conflict');
  const risk = captureRisk(input.riskState, input.riskDomain, input.riskClosureReference, blockers);
  if (!risk) return blocked('risk_conflict');
  const stateCode = validateState({ classification, resolutionState, segmentCloseKind: current.segmentCloseKind, risk, blockers, classifiedAt, resolvedAt, segmentClosedAt: current.segmentClosedAt, invalidatedAt: null });
  if (stateCode) return blocked(stateCode);
  const next = makeDisposition({
    ...current, revision: current.revision + 1, classification, resolutionState, risk, blockers, classifiedAt, resolvedAt,
    snapshotCreatedAt: classifiedAt, invalidatedAt: null, auditReference,
  });
  return appended(invalidatePrevious(current, classifiedAt), next);
}

export function invalidateCareDispositionForCustomerInbound(rawCurrent: unknown, rawInput: unknown): CareCommandResult {
  const current = captureDisposition(rawCurrent);
  const input = captureExactRecord(rawInput, inboundKeys);
  if (!current || !input) return blocked('input_invalid');
  const targetCode = captureCommandTarget(input, current, false);
  if (targetCode) return blocked(targetCode);
  if (current.segmentCloseKind !== 'open') return blocked('state_conflict');
  const sourceMessageId = captureString(input.sourceMessageId);
  const sourceMessageOccurredAt = captureTimestamp(input.sourceMessageOccurredAt);
  const sourceMessageRevision = capturePositiveInteger(input.sourceMessageRevision);
  const lastCustomerMessageAt = captureTimestamp(input.lastCustomerMessageAt);
  const identityState = isOneOf(input.identityState, ['matched', 'pending_review', 'unmatched', 'conflict'] as const) ? input.identityState : null;
  const blockers = captureBlockers(input.blockingReasonCodes);
  const auditReference = typeof input.auditReference === 'string' && auditReferencePattern.test(input.auditReference) ? input.auditReference : null;
  const snapshotCreatedAt = captureTimestamp(input.snapshotCreatedAt);
  if (!sourceMessageId || !sourceMessageOccurredAt || !sourceMessageRevision || !lastCustomerMessageAt || !identityState || !blockers || !auditReference || !snapshotCreatedAt) return blocked('input_invalid');
  if (sourceMessageId === current.sourceMessageId || sourceMessageRevision <= current.sourceMessageRevision || Date.parse(sourceMessageOccurredAt) <= Date.parse(current.sourceMessageOccurredAt) || Date.parse(lastCustomerMessageAt) < Date.parse(sourceMessageOccurredAt) || Date.parse(snapshotCreatedAt) < Date.parse(sourceMessageOccurredAt)) return blocked('source_message_not_new');
  const risk = captureRisk(input.riskState, input.riskDomain, input.riskClosureReference, blockers);
  if (!risk) return blocked('risk_conflict');
  const stateCode = validateState({ classification: null, resolutionState: 'open', segmentCloseKind: 'open', risk, blockers, classifiedAt: null, resolvedAt: null, segmentClosedAt: null, invalidatedAt: null });
  if (stateCode) return blocked(stateCode);
  const next = makeDisposition({
    ...current, revision: current.revision + 1, sourceMessageId, sourceMessageOccurredAt, sourceMessageRevision,
    lastCustomerMessageAt, identityState, classification: null, resolutionState: 'open', segmentCloseKind: 'open',
    risk, blockers, classifiedAt: null, resolvedAt: null, segmentClosedAt: null, snapshotCreatedAt, invalidatedAt: null,
    auditReference,
  });
  return appended(invalidatePrevious(current, snapshotCreatedAt), next);
}

function appendClose(rawCurrent: unknown, rawInput: unknown, kind: 'normal' | 'forced'): CareCommandResult {
  const current = captureDisposition(rawCurrent);
  const input = captureExactRecord(rawInput, closeKeys);
  if (!current || !input) return blocked('input_invalid');
  const targetCode = captureCommandTarget(input, current);
  if (targetCode) return blocked(targetCode);
  if (current.segmentCloseKind !== 'open') return blocked('state_conflict');
  const segmentClosedAt = captureTimestamp(input.segmentClosedAt);
  const auditReference = typeof input.auditReference === 'string' && auditReferencePattern.test(input.auditReference) ? input.auditReference : null;
  if (!segmentClosedAt || !auditReference) return blocked('input_invalid');
  if (Date.parse(segmentClosedAt) < Date.parse(current.snapshotCreatedAt)) return blocked('timestamp_conflict');
  const blockers = kind === 'forced'
    ? deepFreeze([...new Set([...current.blockingReasonCodes, 'forced_close_unresolved' as const])].sort((left, right) => careDispositionBlockingReasonCodes.indexOf(left) - careDispositionBlockingReasonCodes.indexOf(right)))
    : current.blockingReasonCodes;
  const resolutionState = kind === 'forced' ? 'open' as const : current.resolutionState;
  const resolvedAt = kind === 'forced' ? null : current.resolvedAt;
  const risk = { state: current.riskState, domain: current.riskDomain, closureReference: current.riskClosureReference } as const;
  const stateCode = validateState({ classification: current.classification, resolutionState, segmentCloseKind: kind, risk, blockers, classifiedAt: current.classifiedAt, resolvedAt, segmentClosedAt, invalidatedAt: null });
  if (stateCode) return blocked(stateCode);
  const next = makeDisposition({
    ...current, revision: current.revision + 1, resolutionState, segmentCloseKind: kind, resolvedAt, blockers,
    risk, segmentClosedAt, snapshotCreatedAt: segmentClosedAt, invalidatedAt: null, auditReference,
  });
  return appended(invalidatePrevious(current, segmentClosedAt), next);
}

export function closeCareDispositionNormally(rawCurrent: unknown, rawInput: unknown): CareCommandResult {
  return appendClose(rawCurrent, rawInput, 'normal');
}

export function forceCloseCareDisposition(rawCurrent: unknown, rawInput: unknown): CareCommandResult {
  return appendClose(rawCurrent, rawInput, 'forced');
}
