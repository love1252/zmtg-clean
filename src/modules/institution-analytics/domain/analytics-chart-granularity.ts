import {
  ANALYTICS_PERIOD_PRESETS,
  type AnalyticsPeriodPreset,
} from '@/modules/institution-analytics/domain/analytics-periods';

export const ANALYTICS_CHART_GRANULARITIES = Object.freeze([
  'hour',
  'day',
  'week',
  'month',
] as const);

export type AnalyticsChartGranularity =
  (typeof ANALYTICS_CHART_GRANULARITIES)[number];

export const ANALYTICS_CUSTOM_CHART_GRANULARITIES = Object.freeze([
  'day',
  'week',
  'month',
] as const);

export type AnalyticsCustomChartGranularity =
  (typeof ANALYTICS_CUSTOM_CHART_GRANULARITIES)[number];

export type AnalyticsCustomGranularityPolicy = Readonly<{
  allowedGranularities: readonly AnalyticsCustomChartGranularity[];
}>;

export type AnalyticsChartGranularityPolicySnapshot = Readonly<{
  source: 'fixed' | 'custom';
  allowedGranularities: readonly AnalyticsChartGranularity[];
}>;

export type AnalyticsChartGranularityRequest = Readonly<{
  preset: AnalyticsPeriodPreset;
  granularity: AnalyticsChartGranularity;
  customPolicy?: AnalyticsCustomGranularityPolicy;
}>;

export type AnalyticsChartGranularityFailureCode =
  | 'invalid_period_preset'
  | 'invalid_chart_granularity'
  | 'invalid_custom_granularity_policy'
  | 'chart_granularity_not_allowed';

export type AnalyticsChartGranularityPlan = Readonly<{
  preset: AnalyticsPeriodPreset;
  granularity: AnalyticsChartGranularity;
  policySnapshot: AnalyticsChartGranularityPolicySnapshot;
}>;

export type AnalyticsChartGranularityResolution =
  | Readonly<{ ok: true; plan: AnalyticsChartGranularityPlan }>
  | Readonly<{ ok: false; reasonCode: AnalyticsChartGranularityFailureCode }>;

const presetSet = new Set<string>(ANALYTICS_PERIOD_PRESETS);
const granularitySet = new Set<string>(ANALYTICS_CHART_GRANULARITIES);
const customGranularitySet = new Set<string>(
  ANALYTICS_CUSTOM_CHART_GRANULARITIES,
);

const fixedGranularities = Object.freeze({
  today: Object.freeze(['hour'] as const),
  week: Object.freeze(['day'] as const),
  month: Object.freeze(['day'] as const),
  quarter: Object.freeze(['day', 'week'] as const),
  year: Object.freeze(['week', 'month'] as const),
});

function failure(
  reasonCode: AnalyticsChartGranularityFailureCode,
): AnalyticsChartGranularityResolution {
  return Object.freeze({ ok: false, reasonCode });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function normalizeCustomPolicy(value: unknown) {
  if (!isPlainObject(value)) return null;

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'allowedGranularities') return null;

  const allowed = value.allowedGranularities;
  if (!Array.isArray(allowed) || allowed.length === 0) return null;

  const unique = new Set<string>();
  for (const granularity of allowed) {
    if (
      typeof granularity !== 'string' ||
      !customGranularitySet.has(granularity) ||
      unique.has(granularity)
    ) {
      return null;
    }
    unique.add(granularity);
  }

  return Object.freeze(
    ANALYTICS_CUSTOM_CHART_GRANULARITIES.filter((granularity) =>
      unique.has(granularity),
    ),
  );
}

function success(
  preset: AnalyticsPeriodPreset,
  granularity: AnalyticsChartGranularity,
  source: AnalyticsChartGranularityPolicySnapshot['source'],
  allowedGranularities: readonly AnalyticsChartGranularity[],
): AnalyticsChartGranularityResolution {
  const policySnapshot = Object.freeze({
    source,
    allowedGranularities,
  });
  const plan = Object.freeze({ preset, granularity, policySnapshot });
  return Object.freeze({ ok: true, plan });
}

export function resolveAnalyticsChartGranularity(
  input: AnalyticsChartGranularityRequest,
): AnalyticsChartGranularityResolution {
  if (typeof input?.preset !== 'string' || !presetSet.has(input.preset)) {
    return failure('invalid_period_preset');
  }
  if (
    typeof input?.granularity !== 'string' ||
    !granularitySet.has(input.granularity)
  ) {
    return failure('invalid_chart_granularity');
  }

  if (input.preset === 'custom') {
    const allowedGranularities = normalizeCustomPolicy(input.customPolicy);
    if (!allowedGranularities) {
      return failure('invalid_custom_granularity_policy');
    }
    if (!allowedGranularities.some((granularity) => granularity === input.granularity)) {
      return failure('chart_granularity_not_allowed');
    }
    return success(
      input.preset,
      input.granularity,
      'custom',
      allowedGranularities,
    );
  }

  if (input.customPolicy !== undefined) {
    return failure('invalid_custom_granularity_policy');
  }

  const allowedGranularities = fixedGranularities[input.preset];
  if (!allowedGranularities.some((granularity) => granularity === input.granularity)) {
    return failure('chart_granularity_not_allowed');
  }
  return success(
    input.preset,
    input.granularity,
    'fixed',
    allowedGranularities,
  );
}
