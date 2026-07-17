import type { AnalyticsCustomChartGranularity } from '@/modules/institution-analytics/domain/analytics-chart-granularity';
import {
  parseAnalyticsLocalDate,
  type AnalyticsPeriodWindow,
} from '@/modules/institution-analytics/domain/analytics-periods';

export type AnalyticsPeriodResourcePolicy = Readonly<{
  maxLocalDayCount: number;
  maxBucketCount: number;
}>;

export const ANALYTICS_PERIOD_RESOURCE_POLICY: AnalyticsPeriodResourcePolicy =
  Object.freeze({
    maxLocalDayCount: 366,
    maxBucketCount: 366,
  });

export type AnalyticsPeriodResourceFailureCode =
  | 'invalid_period_window'
  | 'custom_period_local_day_limit_exceeded'
  | 'period_bucket_count_limit_exceeded';

export type AnalyticsPeriodResourceBudgetEvaluation =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reasonCode: AnalyticsPeriodResourceFailureCode }>;

export type AnalyticsCustomPeriodResourceBudgetRequest = Readonly<{
  window: AnalyticsPeriodWindow;
  granularity: AnalyticsCustomChartGranularity;
}>;

export type AnalyticsCustomPeriodResourceBudgetResolution =
  | Readonly<{ ok: true; projectedBucketCount: number }>
  | Readonly<{ ok: false; reasonCode: AnalyticsPeriodResourceFailureCode }>;

const millisecondsPerCalendarDay = 86_400_000;
const customGranularitySet = new Set<string>(['day', 'week', 'month']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function resourceFailure(
  reasonCode: AnalyticsPeriodResourceFailureCode,
): Readonly<{ ok: false; reasonCode: AnalyticsPeriodResourceFailureCode }> {
  return Object.freeze({ ok: false, reasonCode });
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function evaluateAnalyticsCustomPeriodResourceBudget(input: {
  readonly localDayCount: number;
  readonly projectedBucketCount: number;
}): AnalyticsPeriodResourceBudgetEvaluation {
  if (
    !isPlainObject(input) ||
    !isPositiveSafeInteger(input.localDayCount) ||
    !isPositiveSafeInteger(input.projectedBucketCount)
  ) {
    return resourceFailure('invalid_period_window');
  }
  if (
    input.localDayCount >
    ANALYTICS_PERIOD_RESOURCE_POLICY.maxLocalDayCount
  ) {
    return resourceFailure('custom_period_local_day_limit_exceeded');
  }
  if (
    input.projectedBucketCount >
    ANALYTICS_PERIOD_RESOURCE_POLICY.maxBucketCount
  ) {
    return resourceFailure('period_bucket_count_limit_exceeded');
  }
  return Object.freeze({ ok: true });
}

function projectWeekBucketCount(startOrdinal: number, endOrdinal: number) {
  const weekday = new Date(startOrdinal * millisecondsPerCalendarDay).getUTCDay();
  const daysToNextMonday = weekday === 1 ? 7 : (8 - weekday) % 7;
  const firstEnd = Math.min(startOrdinal + daysToNextMonday, endOrdinal);
  return 1 + Math.ceil((endOrdinal - firstEnd) / 7);
}

function projectMonthBucketCount(startOrdinal: number, endOrdinal: number) {
  const start = new Date(startOrdinal * millisecondsPerCalendarDay);
  const lastIncluded = new Date((endOrdinal - 1) * millisecondsPerCalendarDay);
  return (
    (lastIncluded.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (lastIncluded.getUTCMonth() - start.getUTCMonth()) +
    1
  );
}

export function resolveAnalyticsCustomPeriodResourceBudget(
  input: AnalyticsCustomPeriodResourceBudgetRequest,
): AnalyticsCustomPeriodResourceBudgetResolution {
  if (
    !isPlainObject(input) ||
    !isPlainObject(input.window) ||
    typeof input.granularity !== 'string' ||
    !customGranularitySet.has(input.granularity)
  ) {
    return resourceFailure('invalid_period_window');
  }

  const start = parseAnalyticsLocalDate(input.window.startDate);
  const end = parseAnalyticsLocalDate(input.window.endDateExclusive);
  const localDayCount = input.window.localDayCount;
  if (
    !start ||
    !end ||
    !isPositiveSafeInteger(localDayCount) ||
    end.ordinal - start.ordinal !== localDayCount
  ) {
    return resourceFailure('invalid_period_window');
  }

  if (
    localDayCount > ANALYTICS_PERIOD_RESOURCE_POLICY.maxLocalDayCount
  ) {
    return resourceFailure('custom_period_local_day_limit_exceeded');
  }

  const projectedBucketCount =
    input.granularity === 'day'
      ? localDayCount
      : input.granularity === 'week'
        ? projectWeekBucketCount(start.ordinal, end.ordinal)
        : projectMonthBucketCount(start.ordinal, end.ordinal);
  const budget = evaluateAnalyticsCustomPeriodResourceBudget({
    localDayCount,
    projectedBucketCount,
  });
  if (!budget.ok) return budget;

  return Object.freeze({ ok: true, projectedBucketCount });
}
