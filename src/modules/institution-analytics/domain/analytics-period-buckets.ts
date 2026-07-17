import {
  resolveAnalyticsChartGranularity,
  type AnalyticsChartGranularity,
  type AnalyticsChartGranularityFailureCode,
  type AnalyticsChartGranularityPolicySnapshot,
  type AnalyticsCustomChartGranularity,
  type AnalyticsCustomGranularityPolicy,
} from '@/modules/institution-analytics/domain/analytics-chart-granularity';
import {
  isAnalyticsPeriodPairValid,
  isAnalyticsPeriodWindowValid,
  parseAnalyticsLocalDate,
  resolveAnalyticsLocalDateStartInstant,
  type AnalyticsPeriodPair,
  type AnalyticsPeriodPreset,
  type AnalyticsPeriodWindow,
} from '@/modules/institution-analytics/domain/analytics-periods';
import {
  ANALYTICS_PERIOD_RESOURCE_POLICY,
  resolveAnalyticsCustomPeriodResourceBudget,
  type AnalyticsPeriodResourceFailureCode,
} from '@/modules/institution-analytics/domain/analytics-period-resource-policy';

export type AnalyticsHourPeriodBucket = Readonly<{
  granularity: 'hour';
  startInstant: string;
  endInstantExclusive: string;
}>;

export type AnalyticsCalendarPeriodBucket = Readonly<{
  granularity: AnalyticsCustomChartGranularity;
  startDate: string;
  endDateExclusive: string;
  startInstant: string;
  endInstantExclusive: string;
}>;

export type AnalyticsPeriodBucket =
  | AnalyticsHourPeriodBucket
  | AnalyticsCalendarPeriodBucket;

export type AnalyticsPeriodBucketSeries = Readonly<{
  preset: AnalyticsPeriodPreset;
  granularity: AnalyticsChartGranularity;
  timeZone: string;
  startDate: string;
  endDateExclusive: string;
  startInstant: string;
  endInstantExclusive: string;
  policySnapshot: AnalyticsChartGranularityPolicySnapshot;
  buckets: readonly AnalyticsPeriodBucket[];
}>;

export type AnalyticsPeriodBucketRequest = Readonly<{
  period: AnalyticsPeriodPair;
  side: 'current' | 'previous';
  granularity: AnalyticsChartGranularity;
  customPolicy?: AnalyticsCustomGranularityPolicy;
}>;

export type AnalyticsPeriodBucketFailureCode =
  | AnalyticsChartGranularityFailureCode
  | AnalyticsPeriodResourceFailureCode
  | 'unresolvable_period_boundary'
  | 'invalid_bucket_boundary'
  | 'non_contiguous_period_buckets';

export type AnalyticsPeriodBucketResolution =
  | Readonly<{ ok: true; series: AnalyticsPeriodBucketSeries }>
  | Readonly<{ ok: false; reasonCode: AnalyticsPeriodBucketFailureCode }>;

export type AnalyticsPeriodBucketSequenceValidation =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      reasonCode:
        | 'invalid_bucket_boundary'
        | 'non_contiguous_period_buckets'
        | 'period_bucket_count_limit_exceeded';
    }>;

export type AnalyticsPeriodBucketSequenceInput = Readonly<{
  startInstant: string;
  endInstantExclusive: string;
  buckets: readonly Readonly<{
    startInstant: string;
    endInstantExclusive: string;
  }>[];
}>;

const millisecondsPerCalendarDay = 86_400_000;
const millisecondsPerHour = 3_600_000;

function failure(
  reasonCode: AnalyticsPeriodBucketFailureCode,
): AnalyticsPeriodBucketResolution {
  return Object.freeze({ ok: false, reasonCode });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function parseCanonicalInstant(value: unknown) {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  try {
    return new Date(timestamp).toISOString() === value ? timestamp : null;
  } catch {
    return null;
  }
}

export function validateAnalyticsPeriodBucketSequence(
  input: AnalyticsPeriodBucketSequenceInput,
): AnalyticsPeriodBucketSequenceValidation {
  if (
    !isPlainObject(input) ||
    !Array.isArray(input.buckets)
  ) {
    return Object.freeze({ ok: false, reasonCode: 'invalid_bucket_boundary' });
  }
  if (
    input.buckets.length > ANALYTICS_PERIOD_RESOURCE_POLICY.maxBucketCount
  ) {
    return Object.freeze({
      ok: false,
      reasonCode: 'period_bucket_count_limit_exceeded',
    });
  }
  if (
    parseCanonicalInstant(input.startInstant) === null ||
    parseCanonicalInstant(input.endInstantExclusive) === null
  ) {
    return Object.freeze({ ok: false, reasonCode: 'invalid_bucket_boundary' });
  }

  for (const bucket of input.buckets) {
    if (!isPlainObject(bucket)) {
      return Object.freeze({ ok: false, reasonCode: 'invalid_bucket_boundary' });
    }
    const start = parseCanonicalInstant(bucket.startInstant);
    const end = parseCanonicalInstant(bucket.endInstantExclusive);
    if (start === null || end === null) {
      return Object.freeze({ ok: false, reasonCode: 'invalid_bucket_boundary' });
    }
  }

  if (
    input.buckets.length === 0 ||
    input.buckets[0]?.startInstant !== input.startInstant ||
    input.buckets.at(-1)?.endInstantExclusive !== input.endInstantExclusive
  ) {
    return Object.freeze({
      ok: false,
      reasonCode: 'non_contiguous_period_buckets',
    });
  }

  for (const [index, bucket] of input.buckets.entries()) {
    const start = parseCanonicalInstant(bucket.startInstant);
    const end = parseCanonicalInstant(bucket.endInstantExclusive);
    if (
      start === null ||
      end === null ||
      start >= end ||
      (index > 0 &&
        input.buckets[index - 1]?.endInstantExclusive !== bucket.startInstant)
    ) {
      return Object.freeze({
        ok: false,
        reasonCode: 'non_contiguous_period_buckets',
      });
    }
  }

  return Object.freeze({ ok: true });
}

function localDateFromOrdinal(ordinal: number) {
  if (!Number.isSafeInteger(ordinal)) return null;
  const date = new Date(ordinal * millisecondsPerCalendarDay);
  const year = date.getUTCFullYear();
  if (year < 1000 || year > 9999) return null;
  const value = `${String(year).padStart(4, '0')}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  return parseAnalyticsLocalDate(value) ? value : null;
}

function nextCalendarBoundaryOrdinal(
  ordinal: number,
  granularity: AnalyticsCustomChartGranularity,
) {
  const currentDate = localDateFromOrdinal(ordinal);
  const current = parseAnalyticsLocalDate(currentDate);
  if (!current) return null;

  if (granularity === 'day') return ordinal + 1;
  if (granularity === 'week') {
    const weekday = new Date(ordinal * millisecondsPerCalendarDay).getUTCDay();
    return ordinal + (weekday === 1 ? 7 : (8 - weekday) % 7);
  }

  const nextMonth = Date.UTC(current.year, current.month, 1);
  return Number.isFinite(nextMonth)
    ? nextMonth / millisecondsPerCalendarDay
    : null;
}

function resolveBoundaryInstant(
  localDate: string,
  timeZone: string,
  cache: Map<string, string>,
) {
  const cached = cache.get(localDate);
  if (cached) return cached;

  const resolved = resolveAnalyticsLocalDateStartInstant({ localDate, timeZone });
  if (!resolved.ok) return null;
  cache.set(localDate, resolved.instant);
  return resolved.instant;
}

function preloadPeriodBoundaryInstants(
  window: AnalyticsPeriodWindow,
  cache: Map<string, string>,
) {
  const start = parseAnalyticsLocalDate(window.startDate);
  const end = parseAnalyticsLocalDate(window.endDateExclusive);
  if (!start || !end || start.ordinal >= end.ordinal) return false;

  let previousTimestamp: number | null = null;
  for (let ordinal = start.ordinal; ordinal <= end.ordinal; ordinal += 1) {
    const localDate = localDateFromOrdinal(ordinal);
    if (!localDate) return false;
    const instant = resolveBoundaryInstant(localDate, window.timeZone, cache);
    const timestamp = parseCanonicalInstant(instant);
    if (
      timestamp === null ||
      (previousTimestamp !== null && timestamp <= previousTimestamp)
    ) {
      return false;
    }
    previousTimestamp = timestamp;
  }
  return true;
}

type AnalyticsPeriodBucketGeneration<T extends AnalyticsPeriodBucket> =
  | Readonly<{ ok: true; buckets: T[] }>
  | Readonly<{
      ok: false;
      reasonCode:
        | 'unresolvable_period_boundary'
        | 'period_bucket_count_limit_exceeded';
    }>;

function generationFailure(
  reasonCode:
    | 'unresolvable_period_boundary'
    | 'period_bucket_count_limit_exceeded',
): Readonly<{
  ok: false;
  reasonCode:
    | 'unresolvable_period_boundary'
    | 'period_bucket_count_limit_exceeded';
}> {
  return Object.freeze({ ok: false, reasonCode });
}

function generateHourBuckets(
  startInstant: string,
  endInstantExclusive: string,
): AnalyticsPeriodBucketGeneration<AnalyticsHourPeriodBucket> {
  const start = parseCanonicalInstant(startInstant);
  const end = parseCanonicalInstant(endInstantExclusive);
  if (start === null || end === null || start >= end) {
    return generationFailure('unresolvable_period_boundary');
  }

  const buckets: AnalyticsHourPeriodBucket[] = [];
  let cursor = start;
  while (cursor < end) {
    if (
      buckets.length >= ANALYTICS_PERIOD_RESOURCE_POLICY.maxBucketCount
    ) {
      return generationFailure('period_bucket_count_limit_exceeded');
    }
    const next = Math.min(cursor + millisecondsPerHour, end);
    buckets.push(
      Object.freeze({
        granularity: 'hour',
        startInstant: new Date(cursor).toISOString(),
        endInstantExclusive: new Date(next).toISOString(),
      }),
    );
    cursor = next;
  }
  return Object.freeze({ ok: true, buckets });
}

function generateCalendarBuckets(
  window: AnalyticsPeriodWindow,
  granularity: AnalyticsCustomChartGranularity,
  boundaryCache: Map<string, string>,
): AnalyticsPeriodBucketGeneration<AnalyticsCalendarPeriodBucket> {
  const start = parseAnalyticsLocalDate(window.startDate);
  const end = parseAnalyticsLocalDate(window.endDateExclusive);
  if (!start || !end || start.ordinal >= end.ordinal) {
    return generationFailure('unresolvable_period_boundary');
  }

  const buckets: AnalyticsCalendarPeriodBucket[] = [];
  let cursor = start.ordinal;
  while (cursor < end.ordinal) {
    if (
      buckets.length >= ANALYTICS_PERIOD_RESOURCE_POLICY.maxBucketCount
    ) {
      return generationFailure('period_bucket_count_limit_exceeded');
    }
    const proposedEnd = nextCalendarBoundaryOrdinal(cursor, granularity);
    if (
      proposedEnd === null ||
      !Number.isSafeInteger(proposedEnd) ||
      proposedEnd <= cursor
    ) {
      return generationFailure('unresolvable_period_boundary');
    }
    const next = Math.min(proposedEnd, end.ordinal);
    const startDate = localDateFromOrdinal(cursor);
    const endDateExclusive = localDateFromOrdinal(next);
    if (!startDate || !endDateExclusive) {
      return generationFailure('unresolvable_period_boundary');
    }

    const startInstant = resolveBoundaryInstant(
      startDate,
      window.timeZone,
      boundaryCache,
    );
    const endInstantExclusive = resolveBoundaryInstant(
      endDateExclusive,
      window.timeZone,
      boundaryCache,
    );
    if (!startInstant || !endInstantExclusive) {
      return generationFailure('unresolvable_period_boundary');
    }

    buckets.push(
      Object.freeze({
        granularity,
        startDate,
        endDateExclusive,
        startInstant,
        endInstantExclusive,
      }),
    );
    cursor = next;
  }
  return Object.freeze({ ok: true, buckets });
}

export function resolveAnalyticsPeriodBuckets(
  input: AnalyticsPeriodBucketRequest,
): AnalyticsPeriodBucketResolution {
  if (!isPlainObject(input?.period)) {
    return failure('invalid_period_window');
  }
  const granularity = resolveAnalyticsChartGranularity({
    preset: input.period.preset,
    granularity: input?.granularity,
    customPolicy: input?.customPolicy,
  });
  if (!granularity.ok) return failure(granularity.reasonCode);

  if (input.side !== 'current' && input.side !== 'previous') {
    return failure('invalid_period_window');
  }

  const window = input.period[input.side];
  if (
    !isAnalyticsPeriodPairValid(input.period) ||
    !isAnalyticsPeriodWindowValid(window)
  ) {
    return failure('invalid_period_window');
  }

  let projectedBucketCount: number | null = null;
  if (input.period.preset === 'custom') {
    if (granularity.plan.granularity === 'hour') {
      return failure('chart_granularity_not_allowed');
    }
    const resourceBudget = resolveAnalyticsCustomPeriodResourceBudget({
      window,
      granularity: granularity.plan.granularity,
    });
    if (!resourceBudget.ok) return failure(resourceBudget.reasonCode);
    projectedBucketCount = resourceBudget.projectedBucketCount;
  }
  const boundaryCache = new Map<string, string>();
  if (!preloadPeriodBoundaryInstants(window, boundaryCache)) {
    return failure('unresolvable_period_boundary');
  }
  const startInstant = resolveBoundaryInstant(
    window.startDate,
    window.timeZone,
    boundaryCache,
  );
  const endInstantExclusive = resolveBoundaryInstant(
    window.endDateExclusive,
    window.timeZone,
    boundaryCache,
  );
  if (!startInstant || !endInstantExclusive) {
    return failure('unresolvable_period_boundary');
  }

  const generated =
    granularity.plan.granularity === 'hour'
      ? generateHourBuckets(startInstant, endInstantExclusive)
      : generateCalendarBuckets(
          window,
          granularity.plan.granularity,
          boundaryCache,
        );
  if (!generated.ok) return failure(generated.reasonCode);
  if (
    projectedBucketCount !== null &&
    generated.buckets.length !== projectedBucketCount
  ) {
    return failure('invalid_bucket_boundary');
  }

  const buckets = Object.freeze(generated.buckets);
  const validation = validateAnalyticsPeriodBucketSequence({
    startInstant,
    endInstantExclusive,
    buckets,
  });
  if (!validation.ok) return failure(validation.reasonCode);

  const series = Object.freeze({
    preset: granularity.plan.preset,
    granularity: granularity.plan.granularity,
    timeZone: window.timeZone,
    startDate: window.startDate,
    endDateExclusive: window.endDateExclusive,
    startInstant,
    endInstantExclusive,
    policySnapshot: granularity.plan.policySnapshot,
    buckets,
  });
  return Object.freeze({ ok: true, series });
}
