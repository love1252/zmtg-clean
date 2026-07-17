import { types as nodeUtilTypes } from 'node:util';

import {
  isRawDataRetentionDays,
  isRawDataRetentionOperatorReference,
  isRawDataRetentionSafeToken,
  isRawDataRetentionTimeZone,
  parseRawDataRetentionPolicySnapshot,
  RAW_DATA_RETENTION_POLICY_KEY,
  type RawDataRetentionPolicySource,
  type RawDataRetentionPolicyValueSnapshot,
  type RawDataRetentionReasonCode,
} from '@/modules/institution-system/domain/raw-data-retention-policy';

export type RawDataRetentionChangeAction = 'schedule_change' | 'cancel_pending_change';

export type RawDataRetentionActivationPolicy = Readonly<{
  kind: 'next_institution_calendar_day_midnight';
  timeZone: string;
  timeZoneSource: RawDataRetentionPolicySource;
}>;

export type RawDataRetentionChangeIntent = Readonly<{
  action: RawDataRetentionChangeAction;
  policyKey: typeof RAW_DATA_RETENTION_POLICY_KEY;
  targetRetentionDays: number | null;
  reasonCode: RawDataRetentionReasonCode;
  operatorReference: string;
  expectedRevision: string;
  activationPolicy: RawDataRetentionActivationPolicy;
}>;

export type RawDataRetentionCompletedResult =
  | Readonly<{
      kind: 'accepted';
      code: 'create_pending' | 'replace_pending' | 'cancel_pending';
      intent: RawDataRetentionChangeIntent;
    }>
  | Readonly<{ kind: 'ok'; code: 'no_change' }>;

export type RawDataRetentionChangeBlockedCode =
  | 'invalid_input'
  | 'idempotency_key_invalid'
  | 'scope_mismatch'
  | 'permission_denied'
  | 'idempotency_conflict'
  | 'idempotency_in_progress'
  | 'idempotency_corrupt'
  | 'idempotency_unavailable'
  | 'capability_disabled'
  | 'not_released'
  | 'source_invalid'
  | 'source_unavailable'
  | 'source_partial'
  | 'source_stale'
  | 'source_denied'
  | 'source_disabled'
  | 'operating_context_unavailable'
  | 'revision_conflict'
  | 'retention_days_out_of_range'
  | 'action_not_allowed'
  | 'audit_unavailable';

export type RawDataRetentionChangeDecision =
  | Readonly<{ kind: 'blocked'; code: RawDataRetentionChangeBlockedCode }>
  | Readonly<{ kind: 'ok'; code: 'no_change' }>
  | Readonly<{
      kind: 'ok';
      code: 'idempotent_replay';
      originalResult: RawDataRetentionCompletedResult;
    }>
  | Readonly<{
      kind: 'accepted';
      code: 'create_pending' | 'replace_pending' | 'cancel_pending';
      requestFingerprint: string;
      intent: RawDataRetentionChangeIntent;
    }>;

const objectGetPrototypeOf = Object.getPrototypeOf;
const objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const objectFreeze = Object.freeze;
const reflectOwnKeys = Reflect.ownKeys;
const isProxy = nodeUtilTypes.isProxy;

const inputKeys = [
  'request',
  'actor',
  'policySnapshot',
  'capabilityStatus',
  'operatingContext',
  'auditWriteReadiness',
  'idempotencyState',
] as const;
const requestKeys = [
  'scope',
  'action',
  'targetRetentionDays',
  'expectedRevision',
  'reasonCode',
  'idempotencyKey',
] as const;
const scopeKeys = ['tenantId', 'institutionId', 'policyKey'] as const;
const actorKeys = ['tenantId', 'institutionId', 'role', 'operatorReference'] as const;
const operatingContextReadyKeys = ['readiness', 'timeZone', 'source'] as const;
const operatingContextUnavailableKeys = ['readiness'] as const;
const idempotencyAbsentKeys = ['status'] as const;
const idempotencyCompletedKeys = ['status', 'requestFingerprint', 'result'] as const;
const idempotencyInProgressKeys = ['status', 'requestFingerprint'] as const;
const completedAcceptedKeys = ['kind', 'code', 'intent'] as const;
const completedOkKeys = ['kind', 'code'] as const;
const intentKeys = [
  'action',
  'policyKey',
  'targetRetentionDays',
  'reasonCode',
  'operatorReference',
  'expectedRevision',
  'activationPolicy',
] as const;
const activationPolicyKeys = ['kind', 'timeZone', 'timeZoneSource'] as const;

type ExactRecord = Record<string, unknown>;

function readExactPlainRecord(value: unknown, expectedKeys: readonly string[]): ExactRecord | null {
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || isProxy(value)
  ) {
    return null;
  }
  const prototype = objectGetPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const ownKeys = reflectOwnKeys(value);
  if (
    ownKeys.length !== expectedKeys.length
    || ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
  ) {
    return null;
  }
  const result: ExactRecord = {};
  for (const key of expectedKeys) {
    const descriptor = objectGetOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
    result[key] = descriptor.value;
  }
  return result;
}

const reasonCodes = new Set<RawDataRetentionReasonCode>([
  'periodic_policy_review',
  'data_minimization',
  'service_continuity',
  'compliance_requirement',
  'correct_pending_change',
  'withdraw_pending_change',
]);
const scheduleReasonCodes = new Set<RawDataRetentionReasonCode>([
  'periodic_policy_review',
  'data_minimization',
  'service_continuity',
  'compliance_requirement',
  'correct_pending_change',
]);
const cancelReasonCodes = new Set<RawDataRetentionReasonCode>([
  'correct_pending_change',
  'withdraw_pending_change',
]);

function isReasonCode(value: unknown): value is RawDataRetentionReasonCode {
  return typeof value === 'string' && reasonCodes.has(value as RawDataRetentionReasonCode);
}

function isIdempotencyKey(value: unknown): value is string {
  return (
    typeof value === 'string'
    && /^[A-Za-z0-9_-]{16,128}$/u.test(value)
  );
}

type ParsedScope = Readonly<{
  tenantId: string;
  institutionId: string;
  policyKey: typeof RAW_DATA_RETENTION_POLICY_KEY;
}>;

function parseScope(value: unknown): ParsedScope | null {
  const record = readExactPlainRecord(value, scopeKeys);
  if (
    !record
    || !isRawDataRetentionSafeToken(record.tenantId)
    || !isRawDataRetentionSafeToken(record.institutionId)
    || record.policyKey !== RAW_DATA_RETENTION_POLICY_KEY
  ) {
    return null;
  }
  return {
    tenantId: record.tenantId,
    institutionId: record.institutionId,
    policyKey: RAW_DATA_RETENTION_POLICY_KEY,
  };
}

type ParsedRequest = Readonly<{
  scope: ParsedScope;
  action: RawDataRetentionChangeAction;
  targetRetentionDays: number | null;
  expectedRevision: string;
  reasonCode: RawDataRetentionReasonCode;
  idempotencyKey: unknown;
}>;

function parseRequest(value: unknown): ParsedRequest | null {
  const record = readExactPlainRecord(value, requestKeys);
  if (!record) return null;
  const scope = parseScope(record.scope);
  if (
    !scope
    || (record.action !== 'schedule_change' && record.action !== 'cancel_pending_change')
    || !isRawDataRetentionSafeToken(record.expectedRevision)
    || !isReasonCode(record.reasonCode)
  ) {
    return null;
  }
  if (
    (record.action === 'schedule_change' && typeof record.targetRetentionDays !== 'number')
    || (record.action === 'cancel_pending_change' && record.targetRetentionDays !== null)
  ) {
    return null;
  }
  return {
    scope,
    action: record.action,
    targetRetentionDays: record.targetRetentionDays as number | null,
    expectedRevision: record.expectedRevision,
    reasonCode: record.reasonCode,
    idempotencyKey: record.idempotencyKey,
  };
}

type ParsedActor = Readonly<{
  tenantId: string;
  institutionId: string;
  role: 'tenant_admin' | 'tenant_operator';
  operatorReference: string;
}>;

function parseActor(value: unknown): ParsedActor | null {
  const record = readExactPlainRecord(value, actorKeys);
  if (
    !record
    || !isRawDataRetentionSafeToken(record.tenantId)
    || !isRawDataRetentionSafeToken(record.institutionId)
    || (record.role !== 'tenant_admin' && record.role !== 'tenant_operator')
    || !isRawDataRetentionOperatorReference(record.operatorReference)
  ) {
    return null;
  }
  return {
    tenantId: record.tenantId,
    institutionId: record.institutionId,
    role: record.role,
    operatorReference: record.operatorReference,
  };
}

type ParsedOperatingContext =
  | Readonly<{
      readiness: 'ready';
      timeZone: string;
      source: RawDataRetentionPolicySource;
    }>
  | Readonly<{ readiness: 'unavailable' }>;

function parseOperatingContext(value: unknown): ParsedOperatingContext | null {
  const readyRecord = readExactPlainRecord(value, operatingContextReadyKeys);
  if (readyRecord) {
    if (
      readyRecord.readiness !== 'ready'
      || !isRawDataRetentionTimeZone(readyRecord.timeZone)
      || (readyRecord.source !== 'institution_config' && readyRecord.source !== 'product_default')
      || (readyRecord.source === 'product_default' && readyRecord.timeZone !== 'Asia/Shanghai')
    ) {
      return null;
    }
    return {
      readiness: 'ready',
      timeZone: readyRecord.timeZone,
      source: readyRecord.source,
    };
  }
  const unavailableRecord = readExactPlainRecord(value, operatingContextUnavailableKeys);
  return unavailableRecord?.readiness === 'unavailable'
    ? { readiness: 'unavailable' }
    : null;
}

function parseActivationPolicy(value: unknown): RawDataRetentionActivationPolicy | null {
  const record = readExactPlainRecord(value, activationPolicyKeys);
  if (
    !record
    || record.kind !== 'next_institution_calendar_day_midnight'
    || !isRawDataRetentionTimeZone(record.timeZone)
    || (record.timeZoneSource !== 'institution_config' && record.timeZoneSource !== 'product_default')
    || (record.timeZoneSource === 'product_default' && record.timeZone !== 'Asia/Shanghai')
  ) {
    return null;
  }
  return objectFreeze({
    kind: 'next_institution_calendar_day_midnight',
    timeZone: record.timeZone,
    timeZoneSource: record.timeZoneSource,
  });
}

function parseIntent(value: unknown): RawDataRetentionChangeIntent | null {
  const record = readExactPlainRecord(value, intentKeys);
  if (
    !record
    || (record.action !== 'schedule_change' && record.action !== 'cancel_pending_change')
    || !isRawDataRetentionSafeToken(record.policyKey)
    || !isReasonCode(record.reasonCode)
    || !isRawDataRetentionOperatorReference(record.operatorReference)
    || !isRawDataRetentionSafeToken(record.expectedRevision)
  ) {
    return null;
  }
  if (
    (record.action === 'schedule_change' && !isRawDataRetentionDays(record.targetRetentionDays))
    || (record.action === 'cancel_pending_change' && record.targetRetentionDays !== null)
  ) {
    return null;
  }
  const activationPolicy = parseActivationPolicy(record.activationPolicy);
  if (!activationPolicy) return null;
  return objectFreeze({
    action: record.action,
    policyKey: record.policyKey as typeof RAW_DATA_RETENTION_POLICY_KEY,
    targetRetentionDays: record.targetRetentionDays as number | null,
    reasonCode: record.reasonCode,
    operatorReference: record.operatorReference,
    expectedRevision: record.expectedRevision,
    activationPolicy,
  });
}

function parseCompletedResult(value: unknown): RawDataRetentionCompletedResult | null {
  const okRecord = readExactPlainRecord(value, completedOkKeys);
  if (okRecord?.kind === 'ok' && okRecord.code === 'no_change') {
    return objectFreeze({ kind: 'ok', code: 'no_change' });
  }
  const acceptedRecord = readExactPlainRecord(value, completedAcceptedKeys);
  if (
    !acceptedRecord
    || acceptedRecord.kind !== 'accepted'
    || (
      acceptedRecord.code !== 'create_pending'
      && acceptedRecord.code !== 'replace_pending'
      && acceptedRecord.code !== 'cancel_pending'
    )
  ) {
    return null;
  }
  const intent = parseIntent(acceptedRecord.intent);
  if (!intent) return null;
  if (
    (acceptedRecord.code === 'cancel_pending' && intent.action !== 'cancel_pending_change')
    || (acceptedRecord.code !== 'cancel_pending' && intent.action !== 'schedule_change')
  ) {
    return null;
  }
  return objectFreeze({ kind: 'accepted', code: acceptedRecord.code, intent });
}

type ParsedIdempotencyState =
  | Readonly<{ status: 'absent' }>
  | Readonly<{
      status: 'completed';
      requestFingerprint: string;
      result: RawDataRetentionCompletedResult;
    }>
  | Readonly<{ status: 'in_progress'; requestFingerprint: string }>
  | Readonly<{ status: 'corrupt' | 'unavailable' }>;

function isFingerprint(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096;
}

function parseIdempotencyState(value: unknown): ParsedIdempotencyState | null {
  const simpleRecord = readExactPlainRecord(value, idempotencyAbsentKeys);
  if (simpleRecord) {
    if (
      simpleRecord.status === 'absent'
      || simpleRecord.status === 'corrupt'
      || simpleRecord.status === 'unavailable'
    ) {
      return { status: simpleRecord.status };
    }
    return null;
  }
  const completedRecord = readExactPlainRecord(value, idempotencyCompletedKeys);
  if (completedRecord?.status === 'completed' && isFingerprint(completedRecord.requestFingerprint)) {
    const result = parseCompletedResult(completedRecord.result);
    return result
      ? { status: 'completed', requestFingerprint: completedRecord.requestFingerprint, result }
      : null;
  }
  const inProgressRecord = readExactPlainRecord(value, idempotencyInProgressKeys);
  if (inProgressRecord?.status === 'in_progress' && isFingerprint(inProgressRecord.requestFingerprint)) {
    return { status: 'in_progress', requestFingerprint: inProgressRecord.requestFingerprint };
  }
  return null;
}

function fingerprintPart(value: string): string {
  return `${value.length}:${value}`;
}

function createRequestFingerprint(request: ParsedRequest, actor: ParsedActor): string {
  return [
    request.scope.tenantId,
    request.scope.institutionId,
    request.scope.policyKey,
    request.action,
    request.targetRetentionDays === null ? 'null' : String(request.targetRetentionDays),
    request.expectedRevision,
    request.reasonCode,
    actor.operatorReference,
  ].map(fingerprintPart).join('|');
}

function completedAcceptedResultMatchesRequest(
  result: RawDataRetentionCompletedResult,
  request: ParsedRequest,
  actor: ParsedActor,
): boolean {
  if (result.kind !== 'accepted') return true;
  return (
    result.intent.policyKey === request.scope.policyKey
    && result.intent.action === request.action
    && Object.is(result.intent.targetRetentionDays, request.targetRetentionDays)
    && result.intent.reasonCode === request.reasonCode
    && result.intent.operatorReference === actor.operatorReference
    && result.intent.expectedRevision === request.expectedRevision
  );
}

function requestHasValidReplaySemantics(request: ParsedRequest): boolean {
  if (request.action === 'schedule_change') {
    return (
      isRawDataRetentionDays(request.targetRetentionDays)
      && scheduleReasonCodes.has(request.reasonCode)
    );
  }
  return request.targetRetentionDays === null && cancelReasonCodes.has(request.reasonCode);
}

const blockedResults = new Map<RawDataRetentionChangeBlockedCode, Readonly<{
  kind: 'blocked';
  code: RawDataRetentionChangeBlockedCode;
}>>();

function blocked(code: RawDataRetentionChangeBlockedCode): RawDataRetentionChangeDecision {
  const existing = blockedResults.get(code);
  if (existing) return existing;
  const result = objectFreeze({ kind: 'blocked', code } as const);
  blockedResults.set(code, result);
  return result;
}

const noChangeResult = objectFreeze({ kind: 'ok', code: 'no_change' } as const);

function sourceFailureCode(
  readiness: Exclude<RawDataRetentionPolicyValueSnapshot['readiness'], 'ready'> | string,
): RawDataRetentionChangeBlockedCode | null {
  switch (readiness) {
    case 'invalid': return 'source_invalid';
    case 'unavailable': return 'source_unavailable';
    case 'partial': return 'source_partial';
    case 'stale': return 'source_stale';
    case 'denied': return 'source_denied';
    case 'disabled': return 'source_disabled';
    default: return null;
  }
}

export function decideRawDataRetentionChange(input: unknown): RawDataRetentionChangeDecision {
  const inputRecord = readExactPlainRecord(input, inputKeys);
  if (!inputRecord) return blocked('invalid_input');

  const request = parseRequest(inputRecord.request);
  const actor = parseActor(inputRecord.actor);
  const policyResult = parseRawDataRetentionPolicySnapshot(inputRecord.policySnapshot);
  const operatingContext = parseOperatingContext(inputRecord.operatingContext);
  const idempotencyState = parseIdempotencyState(inputRecord.idempotencyState);
  const capabilityStatus = inputRecord.capabilityStatus;
  const auditWriteReadiness = inputRecord.auditWriteReadiness;

  if (
    !request
    || !actor
    || !policyResult.ok
    || !operatingContext
    || !idempotencyState
    || (capabilityStatus !== 'enabled' && capabilityStatus !== 'disabled' && capabilityStatus !== 'not_released')
    || (auditWriteReadiness !== 'ready' && auditWriteReadiness !== 'unavailable')
  ) {
    return blocked('invalid_input');
  }

  if (!isIdempotencyKey(request.idempotencyKey)) return blocked('idempotency_key_invalid');

  const policySnapshot = policyResult.snapshot;
  if (
    policySnapshot.readiness === 'scope_mismatch'
    || actor.tenantId !== request.scope.tenantId
    || actor.institutionId !== request.scope.institutionId
    || policySnapshot.scope.tenantId !== request.scope.tenantId
    || policySnapshot.scope.institutionId !== request.scope.institutionId
    || policySnapshot.scope.policyKey !== request.scope.policyKey
  ) {
    return blocked('scope_mismatch');
  }

  if (actor.role !== 'tenant_admin') return blocked('permission_denied');

  const requestFingerprint = createRequestFingerprint(request, actor);
  if (idempotencyState.status === 'completed') {
    if (idempotencyState.requestFingerprint !== requestFingerprint) {
      return blocked('idempotency_conflict');
    }
    if (!completedAcceptedResultMatchesRequest(idempotencyState.result, request, actor)) {
      return blocked('idempotency_corrupt');
    }
    if (!requestHasValidReplaySemantics(request)) {
      return blocked('idempotency_corrupt');
    }
    return objectFreeze({
      kind: 'ok',
      code: 'idempotent_replay',
      originalResult: idempotencyState.result,
    });
  }
  if (idempotencyState.status === 'in_progress') {
    return idempotencyState.requestFingerprint === requestFingerprint
      ? blocked('idempotency_in_progress')
      : blocked('idempotency_conflict');
  }
  if (idempotencyState.status === 'corrupt') return blocked('idempotency_corrupt');
  if (idempotencyState.status === 'unavailable') return blocked('idempotency_unavailable');

  if (capabilityStatus === 'disabled') return blocked('capability_disabled');
  if (capabilityStatus === 'not_released') return blocked('not_released');

  if (policySnapshot.readiness !== 'ready') {
    const code = sourceFailureCode(policySnapshot.readiness);
    return blocked(code ?? 'source_invalid');
  }

  if (operatingContext.readiness === 'unavailable') {
    return blocked('operating_context_unavailable');
  }

  if (request.expectedRevision !== policySnapshot.revision) {
    return blocked('revision_conflict');
  }

  if (
    request.action === 'schedule_change'
    && !isRawDataRetentionDays(request.targetRetentionDays)
  ) {
    return blocked('retention_days_out_of_range');
  }

  const reasonAllowed = request.action === 'schedule_change'
    ? scheduleReasonCodes.has(request.reasonCode)
    : cancelReasonCodes.has(request.reasonCode);
  if (!reasonAllowed) return blocked('action_not_allowed');

  let acceptedCode: 'create_pending' | 'replace_pending' | 'cancel_pending' | null = null;
  if (request.action === 'cancel_pending_change') {
    if (policySnapshot.pending === null) return noChangeResult;
    acceptedCode = 'cancel_pending';
  } else if (policySnapshot.pending === null) {
    if (request.targetRetentionDays === policySnapshot.current.retentionDays) return noChangeResult;
    acceptedCode = 'create_pending';
  } else {
    if (request.targetRetentionDays === policySnapshot.pending.targetRetentionDays) return noChangeResult;
    if (request.targetRetentionDays === policySnapshot.current.retentionDays) {
      return blocked('action_not_allowed');
    }
    acceptedCode = 'replace_pending';
  }

  if (auditWriteReadiness === 'unavailable') return blocked('audit_unavailable');

  const activationPolicy = objectFreeze({
    kind: 'next_institution_calendar_day_midnight',
    timeZone: operatingContext.timeZone,
    timeZoneSource: operatingContext.source,
  } as const);
  const intent = objectFreeze({
    action: request.action,
    policyKey: RAW_DATA_RETENTION_POLICY_KEY,
    targetRetentionDays: request.targetRetentionDays,
    reasonCode: request.reasonCode,
    operatorReference: actor.operatorReference,
    expectedRevision: request.expectedRevision,
    activationPolicy,
  });

  return objectFreeze({
    kind: 'accepted',
    code: acceptedCode,
    requestFingerprint,
    intent,
  });
}
