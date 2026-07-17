import { types as nodeUtilTypes } from 'node:util';

export const RAW_DATA_RETENTION_POLICY_KEY = 'raw_conversation_and_qa_preview' as const;
export const RAW_DATA_RETENTION_DEFAULT_DAYS = 180 as const;
export const RAW_DATA_RETENTION_MIN_DAYS = 90 as const;
export const RAW_DATA_RETENTION_MAX_DAYS = 365 as const;

export type RawDataRetentionPolicyKey = typeof RAW_DATA_RETENTION_POLICY_KEY;
export type RawDataRetentionPolicySource = 'product_default' | 'institution_config';
export type RawDataRetentionPolicyReadiness =
  | 'ready'
  | 'stale'
  | 'partial'
  | 'unavailable'
  | 'invalid'
  | 'denied'
  | 'disabled'
  | 'scope_mismatch';
export type RawDataRetentionReasonCode =
  | 'periodic_policy_review'
  | 'data_minimization'
  | 'service_continuity'
  | 'compliance_requirement'
  | 'correct_pending_change'
  | 'withdraw_pending_change';

export type RawDataRetentionPolicyScope = Readonly<{
  tenantId: string;
  institutionId: string;
  policyKey: RawDataRetentionPolicyKey;
}>;

export type RawDataRetentionCurrentPolicy = Readonly<{
  retentionDays: number;
  source: RawDataRetentionPolicySource;
}>;

export type RawDataRetentionPendingPolicy = Readonly<{
  targetRetentionDays: number;
  effectiveAt: string;
  effectiveBusinessDate: string;
  effectiveTimeZone: string;
  requestedAt: string;
  reasonCode: RawDataRetentionReasonCode;
  operatorReference: string;
}>;

export type RawDataRetentionPolicyValueSnapshot = Readonly<{
  readiness: 'ready' | 'stale';
  scope: RawDataRetentionPolicyScope;
  revision: string;
  current: RawDataRetentionCurrentPolicy;
  pending: RawDataRetentionPendingPolicy | null;
}>;

export type RawDataRetentionPolicyUnavailableSnapshot = Readonly<{
  readiness: Exclude<RawDataRetentionPolicyReadiness, 'ready' | 'stale'>;
  scope: RawDataRetentionPolicyScope;
}>;

export type RawDataRetentionPolicySnapshot =
  | RawDataRetentionPolicyValueSnapshot
  | RawDataRetentionPolicyUnavailableSnapshot;

export type ParseRawDataRetentionPolicySnapshotResult =
  | Readonly<{ ok: true; snapshot: RawDataRetentionPolicySnapshot }>
  | Readonly<{ ok: false; code: 'invalid_input' }>;

const objectGetPrototypeOf = Object.getPrototypeOf;
const objectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const objectFreeze = Object.freeze;
const reflectOwnKeys = Reflect.ownKeys;
const isProxy = nodeUtilTypes.isProxy;

const reasonCodes = new Set<RawDataRetentionReasonCode>([
  'periodic_policy_review',
  'data_minimization',
  'service_continuity',
  'compliance_requirement',
  'correct_pending_change',
  'withdraw_pending_change',
]);

const valueReadiness = new Set<RawDataRetentionPolicyReadiness>(['ready', 'stale']);
const unavailableReadiness = new Set<RawDataRetentionPolicyReadiness>([
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
  if (
    value === null
    || typeof value !== 'object'
    || Array.isArray(value)
    || isProxy(value)
  ) {
    return null;
  }

  const prototype = objectGetPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }

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
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      return null;
    }
    result[key] = descriptor.value;
  }
  return result;
}

export function isRawDataRetentionSafeToken(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length > 0
    && value.length <= 256
    && /^[A-Za-z0-9._:-]+$/u.test(value)
  );
}

export function isRawDataRetentionOperatorReference(value: unknown): value is string {
  return (
    isRawDataRetentionSafeToken(value)
    && /[A-Za-z]/u.test(value)
  );
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
  return typeof value === 'string' && reasonCodes.has(value as RawDataRetentionReasonCode);
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
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;
  return isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

type ParsedIsoInstant = Readonly<{
  value: string;
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
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|[+-]\d{2}:\d{2})$/u.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = match[7] === undefined ? 0 : Number(match[7]);
  if (!isCalendarDate(year, month, day)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  let offsetMinutes = 0;
  if (match[8] !== 'Z') {
    const offsetMatch = /^[+-](\d{2}):(\d{2})$/u.exec(match[8]!);
    if (!offsetMatch || Number(offsetMatch[1]) > 23 || Number(offsetMatch[2]) > 59) return null;
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
  return Number.isSafeInteger(epochMs) ? { value, epochMs, millisecond } : null;
}

export function isRawDataRetentionTimeZone(value: unknown): value is string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.trim() !== value
    || /\s/u.test(value)
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

function parseScope(value: unknown): RawDataRetentionPolicyScope | null {
  const record = readExactPlainRecord(value, scopeKeys);
  if (
    !record
    || !isRawDataRetentionSafeToken(record.tenantId)
    || !isRawDataRetentionSafeToken(record.institutionId)
    || record.policyKey !== RAW_DATA_RETENTION_POLICY_KEY
  ) {
    return null;
  }
  return objectFreeze({
    tenantId: record.tenantId,
    institutionId: record.institutionId,
    policyKey: RAW_DATA_RETENTION_POLICY_KEY,
  });
}

function parseCurrent(value: unknown): RawDataRetentionCurrentPolicy | null {
  const record = readExactPlainRecord(value, currentKeys);
  if (!record || !isRawDataRetentionDays(record.retentionDays)) return null;
  if (record.source === 'product_default') {
    if (record.retentionDays !== RAW_DATA_RETENTION_DEFAULT_DAYS) return null;
  } else if (record.source !== 'institution_config') {
    return null;
  }
  return objectFreeze({
    retentionDays: record.retentionDays,
    source: record.source,
  });
}

function instantMatchesBusinessMidnight(
  instant: ParsedIsoInstant,
  businessDate: string,
  timeZone: string,
): boolean {
  if (instant.millisecond !== 0) return false;
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
    const localDate = `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`;
    return (
      localDate === businessDate
      && byType.get('hour') === '00'
      && byType.get('minute') === '00'
      && byType.get('second') === '00'
    );
  } catch {
    return false;
  }
}

function formatBusinessDateAtInstant(instant: ParsedIsoInstant, timeZone: string): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      calendar: 'iso8601',
      numberingSystem: 'latn',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(instant.epochMs);
    const byType = new Map(parts.map((part) => [part.type, part.value]));
    const year = byType.get('year');
    const month = byType.get('month');
    const day = byType.get('day');
    return year && month && day ? `${year}-${month}-${day}` : null;
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

function parsePending(value: unknown): RawDataRetentionPendingPolicy | null {
  const record = readExactPlainRecord(value, pendingKeys);
  const effectiveAt = parseIsoInstant(record?.effectiveAt);
  const requestedAt = parseIsoInstant(record?.requestedAt);
  const requestedBusinessDate = requestedAt && typeof record?.effectiveTimeZone === 'string'
    ? formatBusinessDateAtInstant(requestedAt, record.effectiveTimeZone)
    : null;
  if (
    !record
    || !isRawDataRetentionDays(record.targetRetentionDays)
    || !effectiveAt
    || !isBusinessDate(record.effectiveBusinessDate)
    || !isRawDataRetentionTimeZone(record.effectiveTimeZone)
    || !requestedAt
    || !instantMatchesBusinessMidnight(
      effectiveAt,
      record.effectiveBusinessDate,
      record.effectiveTimeZone,
    )
    || requestedAt.epochMs >= effectiveAt.epochMs
    || requestedBusinessDate === null
    || nextBusinessDate(requestedBusinessDate) !== record.effectiveBusinessDate
    || !isReasonCode(record.reasonCode)
    || record.reasonCode === 'withdraw_pending_change'
    || !isRawDataRetentionOperatorReference(record.operatorReference)
  ) {
    return null;
  }
  return objectFreeze({
    targetRetentionDays: record.targetRetentionDays,
    effectiveAt: effectiveAt.value,
    effectiveBusinessDate: record.effectiveBusinessDate,
    effectiveTimeZone: record.effectiveTimeZone,
    requestedAt: requestedAt.value,
    reasonCode: record.reasonCode,
    operatorReference: record.operatorReference,
  });
}

const invalidInput = objectFreeze({ ok: false, code: 'invalid_input' } as const);

export function parseRawDataRetentionPolicySnapshot(
  input: unknown,
): ParseRawDataRetentionPolicySnapshotResult {
  const discriminatorRecord = readExactPlainRecord(input, valueSnapshotKeys)
    ?? readExactPlainRecord(input, unavailableSnapshotKeys);
  if (!discriminatorRecord) return invalidInput;

  const readiness = discriminatorRecord.readiness;
  if (typeof readiness !== 'string') return invalidInput;
  const scope = parseScope(discriminatorRecord.scope);
  if (!scope) return invalidInput;

  if (unavailableReadiness.has(readiness as RawDataRetentionPolicyReadiness)) {
    if (reflectOwnKeys(discriminatorRecord).length !== unavailableSnapshotKeys.length) {
      return invalidInput;
    }
    return objectFreeze({
      ok: true,
      snapshot: objectFreeze({
        readiness: readiness as RawDataRetentionPolicyUnavailableSnapshot['readiness'],
        scope,
      }),
    });
  }

  if (!valueReadiness.has(readiness as RawDataRetentionPolicyReadiness)) return invalidInput;
  if (reflectOwnKeys(discriminatorRecord).length !== valueSnapshotKeys.length) return invalidInput;
  const revision = discriminatorRecord.revision;
  const current = parseCurrent(discriminatorRecord.current);
  const pending = discriminatorRecord.pending === null
    ? null
    : parsePending(discriminatorRecord.pending);
  if (
    !isRawDataRetentionSafeToken(revision)
    || !current
    || (discriminatorRecord.pending !== null && !pending)
    || (pending !== null && pending.targetRetentionDays === current.retentionDays)
  ) {
    return invalidInput;
  }

  return objectFreeze({
    ok: true,
    snapshot: objectFreeze({
      readiness: readiness as 'ready' | 'stale',
      scope,
      revision,
      current,
      pending,
    }),
  });
}
