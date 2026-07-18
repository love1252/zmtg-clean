import { isProxy } from 'node:util/types';

const REPORT_DIRECTIONS = [
  'overall_operations',
  'consumption_trend',
  'project_structure',
  'customer_repurchase',
  'appointment_followup_effectiveness',
] as const;
const METRIC_KEYS = [
  'paid_minor',
  'refund_minor',
  'net_minor',
  'paid_customer_count',
  'average_order_value_minor',
  'mapped_project_amount_minor',
  'unmapped_project_amount_minor',
  'repurchase_customer_count',
  'revisit_opportunity_count',
  'repurchase_opportunity_count',
  'reactivation_opportunity_count',
  'appointment_completed_count',
  'followup_completed_count',
] as const;
const ROOT_KEYS = [
  'direction',
  'snapshotVersion',
  'timeZone',
  'period',
  'metrics',
  'missing',
] as const;
const PERIOD_KEYS = ['startDate', 'endDateExclusive'] as const;
const METRIC_KEYS_SHAPE = ['key', 'value', 'currency', 'evidenceReferences'] as const;
const MISSING_KEYS = ['severity', 'code', 'evidenceReferences'] as const;
const MAX_METRIC_COUNT = 32;
const MAX_MISSING_COUNT = 16;
const MAX_EVIDENCE_REFERENCE_COUNT = 8;
const OWNER_REQUIREMENTS = Object.freeze([
  'central_contract_owner_must_declare_report_input',
  'owner_authoritative_snapshot_projection_required',
  'owner_readiness_and_freshness_required',
  'owner_direction_required_metrics_required',
  'owner_missing_classification_revalidation_required',
  'trusted_evidence_registry_scope_validation_required',
  'server_scope_allow_must_be_verified',
  'approved_report_provider_adapter_required',
  'manual_generation_authorization_required',
] as const);

export type AnalyticsReportDirection = (typeof REPORT_DIRECTIONS)[number];
export type AnalyticsReportMetricKey = (typeof METRIC_KEYS)[number];
export type AnalyticsReportProposalOwnerRequirement =
  (typeof OWNER_REQUIREMENTS)[number];

export type AnalyticsReportInputProposalMetric = Readonly<{
  key: AnalyticsReportMetricKey;
  value: number;
  currency: string | null;
  evidenceReferences: readonly string[];
}>;

export type AnalyticsReportInputProposalMissing = Readonly<{
  severity: 'critical' | 'non_critical';
  code: string;
  evidenceReferences: readonly string[];
}>;

export type AnalyticsReportInputProposalCandidate = Readonly<{
  direction: AnalyticsReportDirection;
  snapshotVersion: string;
  timeZone: string;
  period: Readonly<{ startDate: string; endDateExclusive: string }>;
  untrustedMetricClaims: readonly AnalyticsReportInputProposalMetric[];
  untrustedMissingClaims: readonly AnalyticsReportInputProposalMissing[];
  manualConfirmationRequired: true;
  ownerRequirements: readonly AnalyticsReportProposalOwnerRequirement[];
}>;

export type AnalyticsReportInputProposalResult =
  | Readonly<{
      outcome: 'blocked';
      reasonCodes: readonly 'invalid_input'[];
      ownerRequirements: readonly AnalyticsReportProposalOwnerRequirement[];
    }>
  | Readonly<{
      outcome: 'frozen_non_authorizing_candidate';
      candidate: AnalyticsReportInputProposalCandidate;
    }>;

function includesValue<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

const ISO_4217_CURRENCIES = (() => {
  try {
    return new Set(Intl.supportedValuesOf('currency'));
  } catch {
    return null;
  }
})();

function isSupportedCurrency(value: string): boolean {
  return ISO_4217_CURRENCIES !== null && ISO_4217_CURRENCIES.has(value);
}

function isRuntimeProxy(value: object): boolean {
  try {
    return typeof isProxy !== 'function' || isProxy(value);
  } catch {
    return true;
  }
}

function snapshotObject(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      typeof value !== 'object' ||
      value === null ||
      isRuntimeProxy(value) ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) {
      return null;
    }
    const snapshot: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        !('value' in descriptor) ||
        descriptor.enumerable !== true
      ) {
        return null;
      }
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        writable: false,
        configurable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotDenseArray(value: unknown, maximum: number): readonly unknown[] | null {
  try {
    if (
      typeof value !== 'object' ||
      value === null ||
      isRuntimeProxy(value) ||
      !Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Array.prototype
    ) {
      return null;
    }
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      lengthDescriptor === undefined ||
      !('value' in lengthDescriptor) ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > maximum
    ) {
      return null;
    }
    const length = lengthDescriptor.value;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== length + 1) return null;
    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (
        descriptor === undefined ||
        !('value' in descriptor) ||
        descriptor.enumerable !== true
      ) {
        return null;
      }
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function isIanaTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 64) return false;
  try {
    return Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions()
      .timeZone === value;
  } catch {
    return false;
  }
}

function isReference(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === 70 &&
    /^evref_[a-f0-9]{64}$/.test(value)
  );
}

function isMissingCode(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(value);
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function metricIsSemanticallyValid(
  key: AnalyticsReportMetricKey,
  value: number,
  currency: string | null,
): boolean {
  const monetary = new Set<AnalyticsReportMetricKey>([
    'paid_minor', 'refund_minor', 'net_minor', 'average_order_value_minor',
    'mapped_project_amount_minor', 'unmapped_project_amount_minor',
  ]);
  if (monetary.has(key)) {
    if (currency === null || !isSupportedCurrency(currency) || !Number.isSafeInteger(value)) return false;
    return key === 'net_minor' ? true : value >= 0;
  }
  return currency === null && Number.isSafeInteger(value) && value >= 0;
}

function snapshotReferences(value: unknown): readonly string[] | null {
  const values = snapshotDenseArray(value, MAX_EVIDENCE_REFERENCE_COUNT);
  if (
    values === null ||
    values.length === 0 ||
    values.some((reference) => !isReference(reference))
  ) {
    return null;
  }
  return Object.freeze([...values] as string[]);
}

function snapshotMetric(value: unknown): AnalyticsReportInputProposalMetric | null {
  const snapshot = snapshotObject(value, METRIC_KEYS_SHAPE);
  if (
    snapshot === null ||
    !includesValue(METRIC_KEYS, snapshot.key) ||
    typeof snapshot.value !== 'number' ||
    !Number.isFinite(snapshot.value) ||
    (snapshot.currency !== null && typeof snapshot.currency !== 'string') ||
    !metricIsSemanticallyValid(snapshot.key, snapshot.value, snapshot.currency)
  ) {
    return null;
  }
  const evidenceReferences = snapshotReferences(snapshot.evidenceReferences);
  if (evidenceReferences === null) return null;
  return Object.freeze({
    key: snapshot.key,
    value: snapshot.value,
    currency: snapshot.currency,
    evidenceReferences,
  });
}

function snapshotMissing(value: unknown): AnalyticsReportInputProposalMissing | null {
  const snapshot = snapshotObject(value, MISSING_KEYS);
  if (
    snapshot === null ||
    (snapshot.severity !== 'critical' && snapshot.severity !== 'non_critical') ||
    !isMissingCode(snapshot.code)
  ) {
    return null;
  }
  const evidenceReferences = snapshotReferences(snapshot.evidenceReferences);
  if (evidenceReferences === null) return null;
  return Object.freeze({
    severity: snapshot.severity,
    code: snapshot.code,
    evidenceReferences,
  });
}

function blocked(
  reasonCodes: readonly 'invalid_input'[],
): AnalyticsReportInputProposalResult {
  return Object.freeze({
    outcome: 'blocked',
    reasonCodes: Object.freeze([...reasonCodes]),
    ownerRequirements: OWNER_REQUIREMENTS,
  });
}

/**
 * Creates a frozen, non-authorizing candidate only. It does not declare the
 * public AnalyticsReportInputV1 contract, call AI, or create a report.
 */
export function proposeAnalyticsReportInput(
  input: unknown,
): AnalyticsReportInputProposalResult {
  const root = snapshotObject(input, ROOT_KEYS);
  if (
    root === null ||
    !includesValue(REPORT_DIRECTIONS, root.direction) ||
    typeof root.snapshotVersion !== 'string' ||
    !/^[A-Za-z0-9._:-]{1,64}$/.test(root.snapshotVersion) ||
    !isIanaTimeZone(root.timeZone)
  ) {
    return blocked(['invalid_input']);
  }
  const period = snapshotObject(root.period, PERIOD_KEYS);
  if (
    period === null ||
    typeof period.startDate !== 'string' ||
    typeof period.endDateExclusive !== 'string' ||
    !isCalendarDate(period.startDate) ||
    !isCalendarDate(period.endDateExclusive) ||
    period.startDate >= period.endDateExclusive
  ) {
    return blocked(['invalid_input']);
  }
  const rawMetrics = snapshotDenseArray(root.metrics, MAX_METRIC_COUNT);
  const rawMissing = snapshotDenseArray(root.missing, MAX_MISSING_COUNT);
  if (rawMetrics === null || rawMissing === null) return blocked(['invalid_input']);

  const metrics = rawMetrics.map(snapshotMetric);
  const missing = rawMissing.map(snapshotMissing);
  if (metrics.some((metric) => metric === null) || missing.some((item) => item === null)) {
    return blocked(['invalid_input']);
  }
  const frozenMetrics = Object.freeze(metrics as AnalyticsReportInputProposalMetric[]);
  const frozenMissing = Object.freeze(missing as AnalyticsReportInputProposalMissing[]);
  const identities = new Set<string>();
  for (const metric of frozenMetrics) {
    const identity = metric.currency === null ? metric.key : `${metric.key}:${metric.currency}`;
    if (identities.has(identity)) return blocked(['invalid_input']);
    identities.add(identity);
  }
  return Object.freeze({
    outcome: 'frozen_non_authorizing_candidate',
    candidate: Object.freeze({
      direction: root.direction,
      snapshotVersion: root.snapshotVersion,
      timeZone: root.timeZone,
      period: Object.freeze({
        startDate: period.startDate,
        endDateExclusive: period.endDateExclusive,
      }),
      untrustedMetricClaims: frozenMetrics,
      untrustedMissingClaims: frozenMissing,
      manualConfirmationRequired: true,
      ownerRequirements: OWNER_REQUIREMENTS,
    }),
  });
}
