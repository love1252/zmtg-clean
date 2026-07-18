import { types as nodeUtilTypes } from 'node:util';

import {
  isRawDataRetentionDays,
  isRawDataRetentionOperatorReference,
  isRawDataRetentionSafeToken,
  isRawDataRetentionTimeZone,
  parseRawDataRetentionPolicySnapshot,
  RAW_DATA_RETENTION_OWNER_REQUIREMENTS,
  RAW_DATA_RETENTION_POLICY_KEY,
  type RawDataRetentionOwnerRequirement,
  type RawDataRetentionReasonCode,
} from '@/modules/institution-system/domain/raw-data-retention-policy';

export type RawDataRetentionChangeAction = 'schedule_change' | 'cancel_pending_change';

export type RawDataRetentionChangeBlockedCode =
  | 'invalid_input'
  | 'idempotency_key_invalid'
  | 'retention_days_out_of_range'
  | 'action_not_allowed';

export type RawDataRetentionChangeDecision =
  | Readonly<{ kind: 'blocked'; code: RawDataRetentionChangeBlockedCode }>
  | Readonly<{
      kind: 'non_authorizing_candidate';
      code: 'owner_authorization_required';
      ownerRequirements: readonly RawDataRetentionOwnerRequirement[];
    }>;

declare const authoritativeRawDataRetentionEvidenceBrand: unique symbol;

/**
 * Compile-time-only owner boundary. This module deliberately exposes no parser,
 * factory, promotion path, or runtime consumer for authoritative evidence.
 */
type _AuthoritativeRawDataRetentionEvidence = Readonly<{
  [authoritativeRawDataRetentionEvidenceBrand]: 'owner_only';
  authenticatedActorIdentity: unknown;
  freshInstitutionMembership: unknown;
  institutionScopeAllow: unknown;
  objectScopeAllow: unknown;
  capabilityEvidence: unknown;
  releaseEvidence: unknown;
  currentPolicyRevisionWithTtl: unknown;
  trustedInstitutionTimeZone: unknown;
  independentServerReferenceTime: unknown;
  auditWriterReadiness: unknown;
  authoritativeIdempotencyRecord: unknown;
  atomicPolicyChangeTransaction: unknown;
}>;

const objectGetPrototypeOf = Object.getPrototypeOf;
const objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const objectFreeze = Object.freeze;
const reflectOwnKeys = Reflect.ownKeys;
const isProxy = nodeUtilTypes.isProxy;

const MAX_RECORD_KEYS = 12;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const MIN_IDEMPOTENCY_KEY_LENGTH = 16;
const MAX_ENUM_LENGTH = 64;

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
const idempotencySimpleKeys = ['status'] as const;
const idempotencyTrackedKeys = ['status', 'requestFingerprint'] as const;
const idempotencyCompletedKeys = ['status', 'requestFingerprint', 'result'] as const;
const completedClaimKeys = ['kind'] as const;

type ExactRecord = Record<string, unknown>;

function readExactPlainRecord(value: unknown, expectedKeys: readonly string[]): ExactRecord | null {
  if (value === null || typeof value !== 'object') return null;

  try {
    if (isProxy(value)) return null;
  } catch {
    return null;
  }

  try {
    // The public raw schemas accept no arrays, so the accepted item limit is zero.
    if (Array.isArray(value)) return null;
    if (objectGetPrototypeOf(value) !== Object.prototype) return null;
    const ownKeys = reflectOwnKeys(value);
    if (
      expectedKeys.length > MAX_RECORD_KEYS
      || ownKeys.length > MAX_RECORD_KEYS
      || ownKeys.length !== expectedKeys.length
      || ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }

    const result: ExactRecord = {};
    for (const key of expectedKeys) {
      const descriptor = objectGetOwnPropertyDescriptor(value, key);
      if (
        !descriptor
        || !descriptor.enumerable
        || !('value' in descriptor)
      ) {
        return null;
      }
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

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

type ParsedRequestClaim = Readonly<{
  action: RawDataRetentionChangeAction;
  targetRetentionDays: unknown;
  reasonCode: unknown;
  idempotencyKey: unknown;
}>;

function isBoundedEnumClaim(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_ENUM_LENGTH;
}

function parseScopeClaim(value: unknown): boolean {
  const record = readExactPlainRecord(value, scopeKeys);
  return Boolean(
    record
    && isRawDataRetentionSafeToken(record.tenantId)
    && isRawDataRetentionSafeToken(record.institutionId)
    && record.policyKey === RAW_DATA_RETENTION_POLICY_KEY,
  );
}

function parseRequestClaim(value: unknown): ParsedRequestClaim | null {
  const record = readExactPlainRecord(value, requestKeys);
  if (
    !record
    || !parseScopeClaim(record.scope)
    || (record.action !== 'schedule_change' && record.action !== 'cancel_pending_change')
    || !isRawDataRetentionSafeToken(record.expectedRevision)
    || !isBoundedEnumClaim(record.reasonCode)
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
    action: record.action,
    targetRetentionDays: record.targetRetentionDays,
    reasonCode: record.reasonCode,
    idempotencyKey: record.idempotencyKey,
  };
}

function parseActorClaim(value: unknown): boolean {
  const record = readExactPlainRecord(value, actorKeys);
  return Boolean(
    record
    && isRawDataRetentionSafeToken(record.tenantId)
    && isRawDataRetentionSafeToken(record.institutionId)
    && isBoundedEnumClaim(record.role)
    && (record.role === 'tenant_admin' || record.role === 'tenant_operator')
    && isRawDataRetentionOperatorReference(record.operatorReference),
  );
}

function parseOperatingContextClaim(value: unknown): boolean {
  const readyRecord = readExactPlainRecord(value, operatingContextReadyKeys);
  if (readyRecord) {
    return Boolean(
      isBoundedEnumClaim(readyRecord.readiness)
      && readyRecord.readiness === 'ready'
      && isRawDataRetentionTimeZone(readyRecord.timeZone)
      && isBoundedEnumClaim(readyRecord.source)
      && (
        readyRecord.source === 'institution_config'
        || readyRecord.source === 'product_default'
      )
      && (
        readyRecord.source !== 'product_default'
        || readyRecord.timeZone === 'Asia/Shanghai'
      ),
    );
  }
  const unavailableRecord = readExactPlainRecord(value, operatingContextUnavailableKeys);
  return (
    isBoundedEnumClaim(unavailableRecord?.readiness)
    && unavailableRecord.readiness === 'unavailable'
  );
}

function isIdempotencyKey(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length >= MIN_IDEMPOTENCY_KEY_LENGTH
    && value.length <= MAX_IDEMPOTENCY_KEY_LENGTH
    && /^[A-Za-z0-9_-]+$/u.test(value)
  );
}

function isClaimedFingerprint(value: unknown): value is string {
  return isRawDataRetentionSafeToken(value);
}

function parseIdempotencyClaim(value: unknown): boolean {
  const simpleRecord = readExactPlainRecord(value, idempotencySimpleKeys);
  if (simpleRecord) {
    return (
      isBoundedEnumClaim(simpleRecord.status)
      && (
        simpleRecord.status === 'absent'
        || simpleRecord.status === 'corrupt'
        || simpleRecord.status === 'unavailable'
      )
    );
  }

  const trackedRecord = readExactPlainRecord(value, idempotencyTrackedKeys);
  if (trackedRecord) {
    return (
      isBoundedEnumClaim(trackedRecord.status)
      && trackedRecord.status === 'in_progress'
      && isClaimedFingerprint(trackedRecord.requestFingerprint)
    );
  }

  const completedRecord = readExactPlainRecord(value, idempotencyCompletedKeys);
  if (
    !completedRecord
    || !isBoundedEnumClaim(completedRecord.status)
    || completedRecord.status !== 'completed'
    || !isClaimedFingerprint(completedRecord.requestFingerprint)
  ) {
    return false;
  }
  const completedClaim = readExactPlainRecord(completedRecord.result, completedClaimKeys);
  return (
    isBoundedEnumClaim(completedClaim?.kind)
    && completedClaim.kind === 'claimed_completion'
  );
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

const candidateResult = objectFreeze({
  kind: 'non_authorizing_candidate',
  code: 'owner_authorization_required',
  ownerRequirements: RAW_DATA_RETENTION_OWNER_REQUIREMENTS,
} as const);

export function decideRawDataRetentionChange(input: unknown): RawDataRetentionChangeDecision {
  const inputRecord = readExactPlainRecord(input, inputKeys);
  if (!inputRecord) return blocked('invalid_input');

  const request = parseRequestClaim(inputRecord.request);
  const policyClaim = parseRawDataRetentionPolicySnapshot(inputRecord.policySnapshot);
  if (
    !request
    || !parseActorClaim(inputRecord.actor)
    || policyClaim.kind !== 'non_authorizing_candidate'
    || !parseOperatingContextClaim(inputRecord.operatingContext)
    || !parseIdempotencyClaim(inputRecord.idempotencyState)
    || !isBoundedEnumClaim(inputRecord.capabilityStatus)
    || (
      inputRecord.capabilityStatus !== 'enabled'
      && inputRecord.capabilityStatus !== 'disabled'
      && inputRecord.capabilityStatus !== 'not_released'
    )
    || !isBoundedEnumClaim(inputRecord.auditWriteReadiness)
    || (
      inputRecord.auditWriteReadiness !== 'ready'
      && inputRecord.auditWriteReadiness !== 'unavailable'
    )
  ) {
    return blocked('invalid_input');
  }

  if (!isIdempotencyKey(request.idempotencyKey)) {
    return blocked('idempotency_key_invalid');
  }
  if (
    request.action === 'schedule_change'
    && !isRawDataRetentionDays(request.targetRetentionDays)
  ) {
    return blocked('retention_days_out_of_range');
  }

  const reasonAllowed = request.action === 'schedule_change'
    ? scheduleReasonCodes.has(request.reasonCode as RawDataRetentionReasonCode)
    : cancelReasonCodes.has(request.reasonCode as RawDataRetentionReasonCode);
  if (!reasonAllowed) return blocked('action_not_allowed');

  // Raw claims can establish only shape, never authority, readiness, or mutation intent.
  return candidateResult;
}
