import { types as nodeUtilTypes } from 'node:util';

export const RAW_DATA_RETENTION_POLICY_KEY = 'raw_conversation_and_qa_preview' as const;
export const RAW_DATA_RETENTION_DEFAULT_DAYS = 180 as const;
export const RAW_DATA_RETENTION_MIN_DAYS = 90 as const;
export const RAW_DATA_RETENTION_MAX_DAYS = 365 as const;

export type RawDataRetentionPolicyKey = typeof RAW_DATA_RETENTION_POLICY_KEY;
export type RawDataRetentionPolicySource = 'product_default' | 'institution_config';
export type RawDataRetentionReasonCode =
  | 'periodic_policy_review'
  | 'data_minimization'
  | 'service_continuity'
  | 'compliance_requirement'
  | 'correct_pending_change'
  | 'withdraw_pending_change';

export type RawDataRetentionOwnerRequirement =
  | 'authenticated_actor_identity'
  | 'fresh_institution_membership'
  | 'institution_scope_allow'
  | 'object_scope_allow'
  | 'capability_evidence'
  | 'release_evidence'
  | 'current_policy_revision_with_ttl'
  | 'trusted_institution_time_zone'
  | 'independent_server_reference_time'
  | 'audit_writer_readiness'
  | 'authoritative_idempotency_record'
  | 'atomic_policy_change_transaction';

export const RAW_DATA_RETENTION_OWNER_REQUIREMENTS = Object.freeze([
  'authenticated_actor_identity',
  'fresh_institution_membership',
  'institution_scope_allow',
  'object_scope_allow',
  'capability_evidence',
  'release_evidence',
  'current_policy_revision_with_ttl',
  'trusted_institution_time_zone',
  'independent_server_reference_time',
  'audit_writer_readiness',
  'authoritative_idempotency_record',
  'atomic_policy_change_transaction',
] satisfies readonly RawDataRetentionOwnerRequirement[]);

export type ParseRawDataRetentionPolicySnapshotResult =
  | Readonly<{ kind: 'blocked'; code: 'invalid_input' }>
  | Readonly<{
      kind: 'non_authorizing_candidate';
      code: 'owner_evidence_required';
      ownerRequirements: readonly RawDataRetentionOwnerRequirement[];
    }>;

const objectGetPrototypeOf = Object.getPrototypeOf;
const objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const objectFreeze = Object.freeze;
const reflectOwnKeys = Reflect.ownKeys;
const isProxy = nodeUtilTypes.isProxy;

const MAX_RECORD_KEYS = 12;
const MAX_SAFE_TOKEN_LENGTH = 128;
const MAX_TIME_ZONE_LENGTH = 64;
const MAX_ISO_INSTANT_LENGTH = 35;
const MAX_ENUM_LENGTH = 64;

const reasonCodes = new Set<RawDataRetentionReasonCode>([
  'periodic_policy_review',
  'data_minimization',
  'service_continuity',
  'compliance_requirement',
  'correct_pending_change',
  'withdraw_pending_change',
]);
const valueClaims = new Set(['ready', 'stale']);
const unavailableClaims = new Set([
  'partial',
  'unavailable',
  'invalid',
  'denied',
  'disabled',
  'scope_mismatch',
]);

const scopeKeys = ['tenantId', 'institutionId', 'policyKey'] as const;
const valueSnapshotKeys = ['readiness', 'scope', 'revision', 'current', 'pending'] as const;
const unavailableSnapshotKeys = ['readiness', 'scope'] as const;
const currentKeys = ['retentionDays', 'source'] as const;
const pendingKeys = [
  'targetRetentionDays',
  'effectiveAt',
  'effectiveBusinessDate',
  'effectiveTimeZone',
  'requestedAt',
  'reasonCode',
  'operatorReference',
] as const;

type ExactRecord = Record<string, unknown>;

function readExactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
): ExactRecord | null {
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

export function isRawDataRetentionSafeToken(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_SAFE_TOKEN_LENGTH
    && /^[A-Za-z0-9._:-]+$/u.test(value)
  );
}

export function isRawDataRetentionOperatorReference(value: unknown): value is string {
  return isRawDataRetentionSafeToken(value) && /[A-Za-z]/u.test(value);
}

export function isRawDataRetentionDays(value: unknown): value is number {
  return (
    typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= RAW_DATA_RETENTION_MIN_DAYS
    && value <= RAW_DATA_RETENTION_MAX_DAYS
    && !Object.is(value, -0)
  );
}

function isReasonCode(value: unknown): value is RawDataRetentionReasonCode {
  return (
    typeof value === 'string'
    && value.length <= MAX_ENUM_LENGTH
    && reasonCodes.has(value as RawDataRetentionReasonCode)
  );
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1]!;
  return day <= daysInMonth;
}

function isBusinessDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 10) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  return Boolean(
    match && isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3])),
  );
}

type ParsedIsoInstant = Readonly<{
  epochMs: number;
  millisecond: number;
}>;

function daysFromCivil(year: number, month: number, day: number): number {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * adjustedMonth + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365
    + Math.floor(yearOfEra / 4)
    - Math.floor(yearOfEra / 100)
    + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

function parseIsoInstant(value: unknown): ParsedIsoInstant | null {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_ISO_INSTANT_LENGTH
  ) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|[+-]\d{2}:\d{2})$/u.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = match[7] === undefined ? 0 : Number(match[7]);
  if (!isCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  let offsetMinutes = 0;
  if (match[8] !== 'Z') {
    const offsetMatch = /^[+-](\d{2}):(\d{2})$/u.exec(match[8]!);
    if (!offsetMatch || Number(offsetMatch[1]) > 23 || Number(offsetMatch[2]) > 59) {
      return null;
    }
    const absoluteOffsetMinutes = Number(offsetMatch[1]) * 60 + Number(offsetMatch[2]);
    offsetMinutes = match[8]!.startsWith('-') ? -absoluteOffsetMinutes : absoluteOffsetMinutes;
  }

  const epochMs = (
    daysFromCivil(year, month, day) * 86_400_000
    + hour * 3_600_000
    + minute * 60_000
    + second * 1_000
    + millisecond
    - offsetMinutes * 60_000
  );
  return Number.isSafeInteger(epochMs) ? { epochMs, millisecond } : null;
}

export function isRawDataRetentionTimeZone(value: unknown): value is string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > MAX_TIME_ZONE_LENGTH
    || value.trim() !== value
    || !/^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)*$/u.test(value)
  ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function isValidScopeClaim(value: unknown): boolean {
  const record = readExactPlainRecord(value, scopeKeys);
  return Boolean(
    record
    && isRawDataRetentionSafeToken(record.tenantId)
    && isRawDataRetentionSafeToken(record.institutionId)
    && record.policyKey === RAW_DATA_RETENTION_POLICY_KEY,
  );
}

function isValidCurrentClaim(value: unknown): boolean {
  const record = readExactPlainRecord(value, currentKeys);
  if (
    !record
    || !isRawDataRetentionDays(record.retentionDays)
    || typeof record.source !== 'string'
    || record.source.length > MAX_ENUM_LENGTH
  ) {
    return false;
  }
  if (record.source === 'product_default') {
    return record.retentionDays === RAW_DATA_RETENTION_DEFAULT_DAYS;
  }
  return record.source === 'institution_config';
}

function formatBusinessDateAtInstant(
  instant: ParsedIsoInstant,
  timeZone: string,
): Readonly<{ date: string; isMidnight: boolean }> | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      calendar: 'iso8601',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant.epochMs);
    const byType = new Map(parts.map((part) => [part.type, part.value]));
    const year = byType.get('year');
    const month = byType.get('month');
    const day = byType.get('day');
    if (!year || !month || !day) return null;
    return {
      date: `${year}-${month}-${day}`,
      isMidnight: byType.get('hour') === '00'
        && byType.get('minute') === '00'
        && byType.get('second') === '00',
    };
  } catch {
    return null;
  }
}

function nextBusinessDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return null;
  let year = Number(match[1]);
  let month = Number(match[2]);
  let day = Number(match[3]);
  if (!isCalendarDate(year, month, day)) return null;
  const monthLength = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1]!;
  if (day < monthLength) {
    day += 1;
  } else if (month < 12) {
    month += 1;
    day = 1;
  } else {
    year += 1;
    month = 1;
    day = 1;
  }
  if (year > 9999) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isValidPendingClaim(value: unknown): boolean {
  const record = readExactPlainRecord(value, pendingKeys);
  if (!record) return false;
  if (
    !isRawDataRetentionDays(record.targetRetentionDays)
    || !isBusinessDate(record.effectiveBusinessDate)
    || !isRawDataRetentionTimeZone(record.effectiveTimeZone)
    || !isReasonCode(record.reasonCode)
    || record.reasonCode === 'withdraw_pending_change'
    || !isRawDataRetentionOperatorReference(record.operatorReference)
  ) {
    return false;
  }

  const effectiveAt = parseIsoInstant(record.effectiveAt);
  const requestedAt = parseIsoInstant(record.requestedAt);
  if (!effectiveAt || !requestedAt || requestedAt.epochMs >= effectiveAt.epochMs) return false;

  const effectiveBusinessDate = formatBusinessDateAtInstant(
    effectiveAt,
    record.effectiveTimeZone,
  );
  const requestedBusinessDate = formatBusinessDateAtInstant(
    requestedAt,
    record.effectiveTimeZone,
  );
  return (
    effectiveAt.millisecond === 0
    && effectiveBusinessDate?.isMidnight === true
    && effectiveBusinessDate.date === record.effectiveBusinessDate
    && requestedBusinessDate !== null
    && nextBusinessDate(requestedBusinessDate.date) === record.effectiveBusinessDate
  );
}

const blockedResult = objectFreeze({ kind: 'blocked', code: 'invalid_input' } as const);
const candidateResult = objectFreeze({
  kind: 'non_authorizing_candidate',
  code: 'owner_evidence_required',
  ownerRequirements: RAW_DATA_RETENTION_OWNER_REQUIREMENTS,
} as const);

export function parseRawDataRetentionPolicySnapshot(
  input: unknown,
): ParseRawDataRetentionPolicySnapshotResult {
  const valueRecord = readExactPlainRecord(input, valueSnapshotKeys);
  if (valueRecord) {
    const pendingValid = valueRecord.pending === null
      || isValidPendingClaim(valueRecord.pending);
    if (
      typeof valueRecord.readiness === 'string'
      && valueRecord.readiness.length <= MAX_ENUM_LENGTH
      && valueClaims.has(valueRecord.readiness)
      && isValidScopeClaim(valueRecord.scope)
      && isRawDataRetentionSafeToken(valueRecord.revision)
      && isValidCurrentClaim(valueRecord.current)
      && pendingValid
    ) {
      return candidateResult;
    }
    return blockedResult;
  }

  const unavailableRecord = readExactPlainRecord(input, unavailableSnapshotKeys);
  if (
    unavailableRecord
    && typeof unavailableRecord.readiness === 'string'
    && unavailableRecord.readiness.length <= MAX_ENUM_LENGTH
    && unavailableClaims.has(unavailableRecord.readiness)
    && isValidScopeClaim(unavailableRecord.scope)
  ) {
    return candidateResult;
  }
  return blockedResult;
}
