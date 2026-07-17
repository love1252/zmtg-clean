import {
  type AiUsageLowSensitivitySummary,
  type AiUsageMetrics,
  type AiUsageServiceKeySummary,
  type AiUsageSuccessRate,
} from '@/modules/institution-system/domain/ai-usage-metrics';
import {
  createAiUsageServiceKeyPolicySnapshot,
  type AiUsageServiceKeyPolicy,
} from '@/modules/institution-system/domain/ai-usage-service-keys';

export type AiUsageMetricsSnapshotResult =
  | Readonly<{
      ok: true;
      snapshot: AiUsageMetrics;
    }>
  | Readonly<{
      ok: false;
      code: 'invalid_service_key_policy' | 'invalid_metrics_snapshot';
    }>;

const successRateKeys = [
  'numerator',
  'denominator',
  'value',
] as const;

const summaryKeys = [
  'totalCallCount',
  'serviceUnits',
  'failureCount',
  'rejectionCount',
  'incompleteCount',
  'successRate',
] as const;

const metricsKeys = [
  ...summaryKeys,
  'byServiceKey',
] as const;

const serviceKeySummaryKeys = [
  'serviceKey',
  ...summaryKeys,
] as const;

const successRateKeySet = new Set<PropertyKey>(successRateKeys);
const metricsKeySet = new Set<PropertyKey>(metricsKeys);
const serviceKeySummaryKeySet = new Set<PropertyKey>(serviceKeySummaryKeys);

const invalidServiceKeyPolicyResult = Object.freeze({
  ok: false,
  code: 'invalid_service_key_policy',
} as const);

const invalidMetricsSnapshotResult = Object.freeze({
  ok: false,
  code: 'invalid_metrics_snapshot',
} as const);

type ExactPlainRecord = Record<string, unknown>;

function readExactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
  expectedKeySet: ReadonlySet<PropertyKey>,
): ExactPlainRecord | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }

  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== expectedKeys.length
    || ownKeys.some((key) => typeof key !== 'string' || !expectedKeySet.has(key))
  ) {
    return null;
  }

  const record: ExactPlainRecord = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      return null;
    }

    const propertyValue: unknown = descriptor.value;
    record[key] = propertyValue;
  }

  return record;
}

function isCanonicalArrayIndex(key: string, length: number): boolean {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(key)) {
    return false;
  }

  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length && String(index) === key;
}

function readDenseArray(value: unknown): readonly unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return null;
  }

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (!lengthDescriptor || !('value' in lengthDescriptor)) {
    return null;
  }

  const lengthValue: unknown = lengthDescriptor.value;
  if (
    typeof lengthValue !== 'number'
    || !Number.isSafeInteger(lengthValue)
    || lengthValue < 0
  ) {
    return null;
  }

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== lengthValue + 1) {
    return null;
  }

  for (const key of ownKeys) {
    if (
      key !== 'length'
      && (typeof key !== 'string' || !isCanonicalArrayIndex(key, lengthValue))
    ) {
      return null;
    }
  }

  const items: unknown[] = [];
  for (let index = 0; index < lengthValue; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      return null;
    }

    const item: unknown = descriptor.value;
    items.push(item);
  }

  return items;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return (
    typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && !Object.is(value, -0)
  );
}

function isServiceUnits(value: unknown): value is number | null {
  return (
    value === null
    || (
      typeof value === 'number'
      && Number.isFinite(value)
      && value >= 0
      && !Object.is(value, -0)
    )
  );
}

function addSafeIntegers(values: readonly number[]): number | null {
  let total = 0;

  for (const value of values) {
    const nextTotal = total + value;
    if (!Number.isSafeInteger(nextTotal)) {
      return null;
    }
    total = nextTotal;
  }

  return total;
}

function parseSuccessRate(value: unknown): AiUsageSuccessRate | null {
  const record = readExactPlainRecord(value, successRateKeys, successRateKeySet);
  if (!record) {
    return null;
  }

  const numerator = record.numerator;
  const denominator = record.denominator;
  const rateValue = record.value;

  if (
    !isNonNegativeSafeInteger(numerator)
    || !isNonNegativeSafeInteger(denominator)
  ) {
    return null;
  }

  if (denominator === 0) {
    if (rateValue !== null) {
      return null;
    }
  } else if (
    typeof rateValue !== 'number'
    || !Object.is(rateValue, numerator / denominator)
  ) {
    return null;
  }

  return Object.freeze({
    numerator,
    denominator,
    value: rateValue,
  });
}

function parseSummaryFields(record: ExactPlainRecord): AiUsageLowSensitivitySummary | null {
  const totalCallCount = record.totalCallCount;
  const serviceUnits = record.serviceUnits;
  const failureCount = record.failureCount;
  const rejectionCount = record.rejectionCount;
  const incompleteCount = record.incompleteCount;
  const successRate = parseSuccessRate(record.successRate);

  if (
    !isNonNegativeSafeInteger(totalCallCount)
    || !isServiceUnits(serviceUnits)
    || !isNonNegativeSafeInteger(failureCount)
    || !isNonNegativeSafeInteger(rejectionCount)
    || !isNonNegativeSafeInteger(incompleteCount)
    || !successRate
  ) {
    return null;
  }

  const expectedDenominator = addSafeIntegers([
    successRate.numerator,
    failureCount,
    rejectionCount,
  ]);
  const expectedTotalCallCount = expectedDenominator === null
    ? null
    : addSafeIntegers([expectedDenominator, incompleteCount]);

  if (
    expectedDenominator === null
    || expectedTotalCallCount === null
    || successRate.denominator !== expectedDenominator
    || totalCallCount !== expectedTotalCallCount
  ) {
    return null;
  }

  return Object.freeze({
    totalCallCount,
    serviceUnits,
    failureCount,
    rejectionCount,
    incompleteCount,
    successRate,
  });
}

function parseMetrics(
  value: unknown,
  isAllowedServiceKey: (serviceKey: unknown) => serviceKey is string,
): AiUsageMetrics | null {
  const metricsRecord = readExactPlainRecord(value, metricsKeys, metricsKeySet);
  if (!metricsRecord) {
    return null;
  }

  const totalSummary = parseSummaryFields(metricsRecord);
  const serviceKeyValues = readDenseArray(metricsRecord.byServiceKey);
  if (!totalSummary || !serviceKeyValues) {
    return null;
  }

  const byServiceKey: AiUsageServiceKeySummary[] = [];
  let previousServiceKey: string | null = null;
  let totalCallCount = 0;
  let failureCount = 0;
  let rejectionCount = 0;
  let incompleteCount = 0;
  let numerator = 0;
  let denominator = 0;
  let hasUnknownServiceUnits = false;

  for (const serviceKeyValue of serviceKeyValues) {
    const serviceKeyRecord = readExactPlainRecord(
      serviceKeyValue,
      serviceKeySummaryKeys,
      serviceKeySummaryKeySet,
    );
    if (!serviceKeyRecord) {
      return null;
    }

    const serviceKey = serviceKeyRecord.serviceKey;
    const summary = parseSummaryFields(serviceKeyRecord);
    if (
      !isAllowedServiceKey(serviceKey)
      || !summary
      || (previousServiceKey !== null && !(previousServiceKey < serviceKey))
    ) {
      return null;
    }

    const nextTotalCallCount = addSafeIntegers([totalCallCount, summary.totalCallCount]);
    const nextFailureCount = addSafeIntegers([failureCount, summary.failureCount]);
    const nextRejectionCount = addSafeIntegers([rejectionCount, summary.rejectionCount]);
    const nextIncompleteCount = addSafeIntegers([incompleteCount, summary.incompleteCount]);
    const nextNumerator = addSafeIntegers([numerator, summary.successRate.numerator]);
    const nextDenominator = addSafeIntegers([denominator, summary.successRate.denominator]);
    if (
      nextTotalCallCount === null
      || nextFailureCount === null
      || nextRejectionCount === null
      || nextIncompleteCount === null
      || nextNumerator === null
      || nextDenominator === null
    ) {
      return null;
    }

    totalCallCount = nextTotalCallCount;
    failureCount = nextFailureCount;
    rejectionCount = nextRejectionCount;
    incompleteCount = nextIncompleteCount;
    numerator = nextNumerator;
    denominator = nextDenominator;
    previousServiceKey = serviceKey;

    if (summary.serviceUnits === null) {
      hasUnknownServiceUnits = true;
    }

    byServiceKey.push(Object.freeze({
      serviceKey,
      totalCallCount: summary.totalCallCount,
      serviceUnits: summary.serviceUnits,
      failureCount: summary.failureCount,
      rejectionCount: summary.rejectionCount,
      incompleteCount: summary.incompleteCount,
      successRate: summary.successRate,
    }));
  }

  if (
    totalSummary.totalCallCount !== totalCallCount
    || totalSummary.failureCount !== failureCount
    || totalSummary.rejectionCount !== rejectionCount
    || totalSummary.incompleteCount !== incompleteCount
    || totalSummary.successRate.numerator !== numerator
    || totalSummary.successRate.denominator !== denominator
    || (hasUnknownServiceUnits && totalSummary.serviceUnits !== null)
    || (
      serviceKeyValues.length === 0
      && !Object.is(totalSummary.serviceUnits, 0)
    )
  ) {
    return null;
  }

  const frozenByServiceKey = Object.freeze(byServiceKey);
  return Object.freeze({
    totalCallCount: totalSummary.totalCallCount,
    serviceUnits: totalSummary.serviceUnits,
    failureCount: totalSummary.failureCount,
    rejectionCount: totalSummary.rejectionCount,
    incompleteCount: totalSummary.incompleteCount,
    successRate: totalSummary.successRate,
    byServiceKey: frozenByServiceKey,
  });
}

export function createAiUsageMetricsSnapshot(input: Readonly<{
  metrics: unknown;
  serviceKeyPolicy: AiUsageServiceKeyPolicy;
}>): AiUsageMetricsSnapshotResult {
  let serviceKeyPolicyResult: ReturnType<typeof createAiUsageServiceKeyPolicySnapshot>;
  try {
    serviceKeyPolicyResult = createAiUsageServiceKeyPolicySnapshot(input.serviceKeyPolicy);
  } catch {
    return invalidServiceKeyPolicyResult;
  }

  if (!serviceKeyPolicyResult.ok) {
    return invalidServiceKeyPolicyResult;
  }

  try {
    const snapshot = parseMetrics(input.metrics, serviceKeyPolicyResult.isAllowed);
    if (!snapshot) {
      return invalidMetricsSnapshotResult;
    }

    return Object.freeze({ ok: true, snapshot });
  } catch {
    return invalidMetricsSnapshotResult;
  }
}
