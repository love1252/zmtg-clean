import type {
  AnalyticsFactIssueSummary,
  AnalyticsFactResolution,
  AnalyticsFactResolutionIssueCode,
  EffectiveAnalyticsConsumptionFact,
} from '@/modules/institution-analytics/domain/analytics-consumption-facts';
import {
  isAnalyticsPeriodWindowValid,
  isInstantInAnalyticsPeriod,
  type AnalyticsPeriodPair,
  type AnalyticsPeriodWindow,
} from '@/modules/institution-analytics/domain/analytics-periods';
import {
  resolveAnalyticsStableConsumptionRecordGate,
  type AnalyticsStableConsumptionRecordCurrencyGate,
} from '@/modules/institution-analytics/domain/analytics-stable-consumption-record';

export const ANALYTICS_AGGREGATION_COMPLETENESS = [
  'complete',
  'partial',
  'stale',
  'unavailable',
] as const;

export type AnalyticsAggregationCompleteness =
  (typeof ANALYTICS_AGGREGATION_COMPLETENESS)[number];

const aggregationCompletenessSet = new Set<string>(
  ANALYTICS_AGGREGATION_COMPLETENESS,
);

export type AnalyticsExactRatio = Readonly<{
  numerator: string;
  denominator: string;
}>;

export type AnalyticsMoneyBreakdown = Readonly<{
  paidAmountMinor: number;
  refundAmountMinor: number;
  netAmountMinor: number;
}>;

export type AnalyticsAverageAmount = Readonly<{
  numeratorMinor: number;
  denominator: number;
}>;

export type AnalyticsComparisonReason =
  | 'stale'
  | 'incomplete'
  | 'currency_set_changed'
  | 'metric_mismatch'
  | 'previous_zero'
  | 'metric_unavailable';

export type AnalyticsMetricComparison =
  | Readonly<{
      status: 'comparable';
      delta: number;
      percentageRatio: AnalyticsExactRatio;
    }>
  | Readonly<{
      status: 'not_comparable';
      reasonCode: AnalyticsComparisonReason;
      delta: number | null;
      percentageRatio: null;
    }>;

export type AnalyticsAverageComparison =
  | Readonly<{
      status: 'comparable';
      delta: AnalyticsExactRatio;
      percentageRatio: AnalyticsExactRatio;
    }>
  | Readonly<{
      status: 'not_comparable';
      reasonCode: AnalyticsComparisonReason;
      delta: null;
      percentageRatio: null;
    }>;

export type AnalyticsMappedProjectMetric = AnalyticsMoneyBreakdown &
  Readonly<{
    hisDirectoryVersion: string;
    canonicalProjectId: string;
  }>;

export type AnalyticsCurrencyQualitySummary = Readonly<{
  missingStableConsumptionReferenceCount: number;
  conflictingStableConsumptionRecordCount: number;
  linkedRefundWithoutPaymentCount: number;
  linkedRefundAttributionMismatchCount: number;
  linkedRefundCurrencyMismatchCount: number;
  unmatchedCustomer: AnalyticsMoneyBreakdown;
  unmappedProject: AnalyticsMoneyBreakdown;
  orphanRefundCount: number;
  orphanRefundAmountMinor: number;
}>;

export type AnalyticsCalculatedPeriodCurrencyMetrics = AnalyticsMoneyBreakdown &
  Readonly<{
    dataAvailability:
      | 'observed'
      | 'partial_observation'
      | 'stale_snapshot';
    completeness: AnalyticsAggregationCompleteness;
    hasFinancialFacts: boolean;
    paidCustomerCount: number;
    averageNetAmountPerPaidCustomer: AnalyticsAverageAmount | null;
    consumptionRecordCount: number | null;
    countAvailability:
      | 'available'
      | 'unavailable_unstable_reference'
      | 'unavailable_incomplete_source';
    mappedProjectRanking: readonly AnalyticsMappedProjectMetric[];
    quality: AnalyticsCurrencyQualitySummary;
  }>;

export type AnalyticsUnavailablePeriodCurrencyMetrics = Readonly<{
  dataAvailability: 'not_available';
  completeness: AnalyticsAggregationCompleteness;
  hasFinancialFacts: false;
  paidAmountMinor: null;
  refundAmountMinor: null;
  netAmountMinor: null;
  paidCustomerCount: null;
  averageNetAmountPerPaidCustomer: null;
  consumptionRecordCount: null;
  countAvailability: 'not_available';
  mappedProjectRanking: readonly [];
  quality: null;
}>;

export type AnalyticsPeriodCurrencyMetrics =
  | AnalyticsCalculatedPeriodCurrencyMetrics
  | AnalyticsUnavailablePeriodCurrencyMetrics;

export type AnalyticsCurrencyComparisons = Readonly<{
  paidAmountMinor: AnalyticsMetricComparison;
  refundAmountMinor: AnalyticsMetricComparison;
  netAmountMinor: AnalyticsMetricComparison;
  paidCustomerCount: AnalyticsMetricComparison;
  averageNetAmountPerPaidCustomer: AnalyticsAverageComparison;
}>;

export type AnalyticsCurrencyAggregation = Readonly<{
  currency: string;
  current: AnalyticsPeriodCurrencyMetrics;
  previous: AnalyticsPeriodCurrencyMetrics;
  comparisons: AnalyticsCurrencyComparisons;
}>;

export type AnalyticsAggregationInput = Readonly<{
  tenantId: string;
  institutionId: string;
  factResolution: AnalyticsFactResolution;
  periods: AnalyticsPeriodPair;
  comparison: Readonly<{
    currentCompleteness: AnalyticsAggregationCompleteness;
    previousCompleteness: AnalyticsAggregationCompleteness;
    currentMetricVersion: string;
    previousMetricVersion: string;
  }>;
}>;

export type AnalyticsAggregationValue = Readonly<{
  tenantId: string;
  institutionId: string;
  timeZone: string;
  currentPeriod: AnalyticsPeriodWindow;
  previousPeriod: AnalyticsPeriodWindow;
  periodCompleteness: Readonly<{
    current: AnalyticsAggregationCompleteness;
    previous: AnalyticsAggregationCompleteness;
  }>;
  factResolution: Readonly<{
    status: 'complete' | 'partial';
    replayedFactCount: number;
    excludedFinalStateCount: number;
    rejectedChainCount: number;
    issues: readonly AnalyticsFactIssueSummary<AnalyticsFactResolutionIssueCode>[];
  }>;
  currencies: readonly AnalyticsCurrencyAggregation[];
}>;

export type AnalyticsAggregationFailureCode =
  | 'invalid_fact_resolution'
  | 'mixed_scope_input'
  | 'invalid_period'
  | 'invalid_comparison_context'
  | 'unsafe_integer_overflow';

export type AnalyticsAggregationResult =
  | Readonly<{ ok: true; value: AnalyticsAggregationValue }>
  | Readonly<{ ok: false; reasonCode: AnalyticsAggregationFailureCode }>;

type MutableMoneyBreakdown = {
  paidAmountMinor: number;
  refundAmountMinor: number;
};

type MutableProjectMetric = MutableMoneyBreakdown & {
  hisDirectoryVersion: string;
  canonicalProjectId: string;
};

type MutableCurrencyBucket = {
  facts: EffectiveAnalyticsConsumptionFact[];
  totals: MutableMoneyBreakdown;
  unmatchedCustomer: MutableMoneyBreakdown;
  unmappedProject: MutableMoneyBreakdown;
  projectMetrics: Map<string, MutableProjectMetric>;
  paidCustomerIds: Set<string>;
  customerMetrics: Map<string, MutableMoneyBreakdown>;
  orphanRefundAmountMinor: number;
};

type FinalizedCurrencyMetrics = Omit<
  AnalyticsCalculatedPeriodCurrencyMetrics,
  'dataAvailability' | 'completeness'
>;

type FinalizedBucketResult =
  | Readonly<{ ok: true; value: FinalizedCurrencyMetrics }>
  | Readonly<{ ok: false }>;

type PeriodCurrencyMetricsResult =
  | Readonly<{ ok: true; value: AnalyticsPeriodCurrencyMetrics }>
  | Readonly<{ ok: false }>;

function emptyMutableMoneyBreakdown(): MutableMoneyBreakdown {
  return { paidAmountMinor: 0, refundAmountMinor: 0 };
}

function emptyCurrencyBucket(): MutableCurrencyBucket {
  return {
    facts: [],
    totals: emptyMutableMoneyBreakdown(),
    unmatchedCustomer: emptyMutableMoneyBreakdown(),
    unmappedProject: emptyMutableMoneyBreakdown(),
    projectMetrics: new Map(),
    paidCustomerIds: new Set(),
    customerMetrics: new Map(),
    orphanRefundAmountMinor: 0,
  };
}

function safeAdd(left: number, right: number) {
  const value = left + right;
  return Number.isSafeInteger(value) ? value : null;
}

function safeSubtract(left: number, right: number) {
  const value = left - right;
  return Number.isSafeInteger(value) ? value : null;
}

function addFactAmount(
  breakdown: MutableMoneyBreakdown,
  fact: EffectiveAnalyticsConsumptionFact,
) {
  if (fact.eventType === 'payment_succeeded') {
    const next = safeAdd(breakdown.paidAmountMinor, fact.amountMinor);
    if (next === null) return false;
    breakdown.paidAmountMinor = next;
    return true;
  }

  const next = safeAdd(breakdown.refundAmountMinor, fact.amountMinor);
  if (next === null) return false;
  breakdown.refundAmountMinor = next;
  return true;
}

function finalizeMoneyBreakdown(
  breakdown: MutableMoneyBreakdown,
): AnalyticsMoneyBreakdown | null {
  const netAmountMinor = safeSubtract(
    breakdown.paidAmountMinor,
    breakdown.refundAmountMinor,
  );
  return netAmountMinor === null
    ? null
    : {
        paidAmountMinor: breakdown.paidAmountMinor,
        refundAmountMinor: breakdown.refundAmountMinor,
        netAmountMinor,
      };
}

function addFactToBucket(
  bucket: MutableCurrencyBucket,
  fact: EffectiveAnalyticsConsumptionFact,
) {
  bucket.facts.push(fact);
  if (!addFactAmount(bucket.totals, fact)) return false;

  if (fact.customerAttribution.status !== 'matched') {
    if (!addFactAmount(bucket.unmatchedCustomer, fact)) return false;
  } else {
    const customerId = fact.customerAttribution.customerId;
    const customerMetric =
      bucket.customerMetrics.get(customerId) ?? emptyMutableMoneyBreakdown();
    if (!addFactAmount(customerMetric, fact)) return false;
    bucket.customerMetrics.set(customerId, customerMetric);
    if (fact.eventType === 'payment_succeeded') {
      bucket.paidCustomerIds.add(customerId);
    }
  }

  if (fact.projectAttribution.status !== 'mapped') {
    if (!addFactAmount(bucket.unmappedProject, fact)) return false;
  } else {
    const projectKey = JSON.stringify([
      fact.projectAttribution.hisDirectoryVersion,
      fact.projectAttribution.canonicalProjectId,
    ]);
    const projectMetric = bucket.projectMetrics.get(projectKey) ?? {
      hisDirectoryVersion: fact.projectAttribution.hisDirectoryVersion,
      canonicalProjectId: fact.projectAttribution.canonicalProjectId,
      ...emptyMutableMoneyBreakdown(),
    };
    if (!addFactAmount(projectMetric, fact)) return false;
    bucket.projectMetrics.set(projectKey, projectMetric);
  }

  if (
    fact.eventType === 'refund_confirmed' &&
    fact.refundLinkStatus === 'orphan_verified'
  ) {
    const nextAmount = safeAdd(bucket.orphanRefundAmountMinor, fact.amountMinor);
    if (nextAmount === null) return false;
    bucket.orphanRefundAmountMinor = nextAmount;
  }

  return true;
}

function emptyStableConsumptionRecordCurrencyGate(): Omit<
  AnalyticsStableConsumptionRecordCurrencyGate,
  'currency'
> {
  return {
    consumptionRecordCount: 0,
    countAvailability: 'available',
    quality: {
      missingStableConsumptionReferenceCount: 0,
      conflictingStableConsumptionRecordCount: 0,
      linkedRefundWithoutPaymentCount: 0,
      linkedRefundAttributionMismatchCount: 0,
      linkedRefundCurrencyMismatchCount: 0,
      orphanRefundCount: 0,
    },
  };
}

function finalizeBucket(
  bucket: MutableCurrencyBucket,
  stableConsumptionRecordGate?: AnalyticsStableConsumptionRecordCurrencyGate,
): FinalizedBucketResult {
  const totals = finalizeMoneyBreakdown(bucket.totals);
  const unmatchedCustomer = finalizeMoneyBreakdown(bucket.unmatchedCustomer);
  const unmappedProject = finalizeMoneyBreakdown(bucket.unmappedProject);
  if (!totals || !unmatchedCustomer || !unmappedProject) {
    return { ok: false };
  }

  const matchedPaidCustomerTotals = emptyMutableMoneyBreakdown();
  for (const customerId of [...bucket.paidCustomerIds].sort((left, right) =>
    left.localeCompare(right),
  )) {
    const customerMetric = bucket.customerMetrics.get(customerId);
    if (!customerMetric) continue;
    const nextPaid = safeAdd(
      matchedPaidCustomerTotals.paidAmountMinor,
      customerMetric.paidAmountMinor,
    );
    const nextRefund = safeAdd(
      matchedPaidCustomerTotals.refundAmountMinor,
      customerMetric.refundAmountMinor,
    );
    if (nextPaid === null || nextRefund === null) {
      return { ok: false };
    }
    matchedPaidCustomerTotals.paidAmountMinor = nextPaid;
    matchedPaidCustomerTotals.refundAmountMinor = nextRefund;
  }

  const matchedPaidCustomerNet = safeSubtract(
    matchedPaidCustomerTotals.paidAmountMinor,
    matchedPaidCustomerTotals.refundAmountMinor,
  );
  if (matchedPaidCustomerNet === null) {
    return { ok: false };
  }

  const mappedProjectRanking: AnalyticsMappedProjectMetric[] = [];
  for (const projectMetric of bucket.projectMetrics.values()) {
    const money = finalizeMoneyBreakdown(projectMetric);
    if (!money) return { ok: false };
    mappedProjectRanking.push({
      hisDirectoryVersion: projectMetric.hisDirectoryVersion,
      canonicalProjectId: projectMetric.canonicalProjectId,
      ...money,
    });
  }

  mappedProjectRanking.sort((left, right) => {
    if (left.netAmountMinor !== right.netAmountMinor) {
      return left.netAmountMinor > right.netAmountMinor ? -1 : 1;
    }
    const versionOrder = left.hisDirectoryVersion.localeCompare(right.hisDirectoryVersion);
    return versionOrder !== 0
      ? versionOrder
      : left.canonicalProjectId.localeCompare(right.canonicalProjectId);
  });

  const paidCustomerCount = bucket.paidCustomerIds.size;
  const stableGate =
    stableConsumptionRecordGate ?? emptyStableConsumptionRecordCurrencyGate();

  return {
    ok: true,
    value: {
      ...totals,
      hasFinancialFacts: bucket.facts.length > 0,
      paidCustomerCount,
      averageNetAmountPerPaidCustomer:
        paidCustomerCount === 0
          ? null
          : {
              numeratorMinor: matchedPaidCustomerNet,
              denominator: paidCustomerCount,
            },
      consumptionRecordCount: stableGate.consumptionRecordCount,
      countAvailability: stableGate.countAvailability,
      mappedProjectRanking,
      quality: {
        missingStableConsumptionReferenceCount:
          stableGate.quality.missingStableConsumptionReferenceCount,
        conflictingStableConsumptionRecordCount:
          stableGate.quality.conflictingStableConsumptionRecordCount,
        linkedRefundWithoutPaymentCount:
          stableGate.quality.linkedRefundWithoutPaymentCount,
        linkedRefundAttributionMismatchCount:
          stableGate.quality.linkedRefundAttributionMismatchCount,
        linkedRefundCurrencyMismatchCount:
          stableGate.quality.linkedRefundCurrencyMismatchCount,
        unmatchedCustomer,
        unmappedProject,
        orphanRefundCount: stableGate.quality.orphanRefundCount,
        orphanRefundAmountMinor: bucket.orphanRefundAmountMinor,
      },
    },
  };
}

function greatestCommonDivisor(left: bigint, right: bigint) {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a === 0n ? 1n : a;
}

function exactRatio(numerator: bigint, denominator: bigint): AnalyticsExactRatio {
  const sign = denominator < 0n ? -1n : 1n;
  const signedNumerator = numerator * sign;
  const positiveDenominator = denominator * sign;
  const divisor = greatestCommonDivisor(signedNumerator, positiveDenominator);
  return {
    numerator: (signedNumerator / divisor).toString(),
    denominator: (positiveDenominator / divisor).toString(),
  };
}

function comparisonBaseReason(input: {
  readonly resolutionStatus: 'complete' | 'partial';
  readonly currentCompleteness: AnalyticsAggregationCompleteness;
  readonly previousCompleteness: AnalyticsAggregationCompleteness;
  readonly currentMetricVersion: string;
  readonly previousMetricVersion: string;
  readonly currencySetsMatch: boolean;
}): Exclude<AnalyticsComparisonReason, 'previous_zero' | 'metric_unavailable'> | null {
  if (input.currentMetricVersion !== input.previousMetricVersion) {
    return 'metric_mismatch';
  }
  if (
    input.currentCompleteness === 'stale' ||
    input.previousCompleteness === 'stale'
  ) {
    return 'stale';
  }
  if (
    input.resolutionStatus === 'partial' ||
    input.currentCompleteness !== 'complete' ||
    input.previousCompleteness !== 'complete'
  ) {
    return 'incomplete';
  }
  if (!input.currencySetsMatch) {
    return 'currency_set_changed';
  }
  return null;
}

function compareMetric(
  current: number | null,
  previous: number | null,
  baseReason: Exclude<AnalyticsComparisonReason, 'previous_zero' | 'metric_unavailable'> | null,
): AnalyticsMetricComparison | null {
  if (
    baseReason === 'currency_set_changed' &&
    (current === null || previous === null)
  ) {
    return {
      status: 'not_comparable',
      reasonCode: 'metric_unavailable',
      delta: null,
      percentageRatio: null,
    };
  }
  if (baseReason) {
    return {
      status: 'not_comparable',
      reasonCode: baseReason,
      delta: null,
      percentageRatio: null,
    };
  }
  if (current === null || previous === null) {
    return {
      status: 'not_comparable',
      reasonCode: 'metric_unavailable',
      delta: null,
      percentageRatio: null,
    };
  }

  const delta = safeSubtract(current, previous);
  if (delta === null) return null;
  if (previous === 0) {
    return {
      status: 'not_comparable',
      reasonCode: 'previous_zero',
      delta,
      percentageRatio: null,
    };
  }

  return {
    status: 'comparable',
    delta,
    percentageRatio: exactRatio(BigInt(delta), BigInt(previous)),
  };
}

function compareAverage(
  current: AnalyticsAverageAmount | null,
  previous: AnalyticsAverageAmount | null,
  baseReason: Exclude<AnalyticsComparisonReason, 'previous_zero' | 'metric_unavailable'> | null,
): AnalyticsAverageComparison {
  if (
    baseReason === 'currency_set_changed' &&
    (!current || !previous)
  ) {
    return {
      status: 'not_comparable',
      reasonCode: 'metric_unavailable',
      delta: null,
      percentageRatio: null,
    };
  }
  if (baseReason) {
    return {
      status: 'not_comparable',
      reasonCode: baseReason,
      delta: null,
      percentageRatio: null,
    };
  }
  if (!previous) {
    return {
      status: 'not_comparable',
      reasonCode: 'previous_zero',
      delta: null,
      percentageRatio: null,
    };
  }
  if (!current) {
    return {
      status: 'not_comparable',
      reasonCode: 'metric_unavailable',
      delta: null,
      percentageRatio: null,
    };
  }

  const currentNumerator = BigInt(current.numeratorMinor);
  const currentDenominator = BigInt(current.denominator);
  const previousNumerator = BigInt(previous.numeratorMinor);
  const previousDenominator = BigInt(previous.denominator);
  if (previousNumerator === 0n) {
    return {
      status: 'not_comparable',
      reasonCode: 'previous_zero',
      delta: null,
      percentageRatio: null,
    };
  }

  const deltaNumerator =
    currentNumerator * previousDenominator -
    previousNumerator * currentDenominator;
  const deltaDenominator = currentDenominator * previousDenominator;
  return {
    status: 'comparable',
    delta: exactRatio(deltaNumerator, deltaDenominator),
    percentageRatio: exactRatio(
      deltaNumerator,
      currentDenominator * previousNumerator,
    ),
  };
}

function unavailablePeriodMetrics(
  completeness: AnalyticsAggregationCompleteness,
): AnalyticsUnavailablePeriodCurrencyMetrics {
  return {
    dataAvailability: 'not_available',
    completeness,
    hasFinancialFacts: false,
    paidAmountMinor: null,
    refundAmountMinor: null,
    netAmountMinor: null,
    paidCustomerCount: null,
    averageNetAmountPerPaidCustomer: null,
    consumptionRecordCount: null,
    countAvailability: 'not_available',
    mappedProjectRanking: [],
    quality: null,
  };
}

function periodCurrencyMetrics(input: Readonly<{
  bucket: MutableCurrencyBucket | undefined;
  completeness: AnalyticsAggregationCompleteness;
  resolutionStatus: 'complete' | 'partial';
  stableConsumptionRecordGate?: AnalyticsStableConsumptionRecordCurrencyGate;
}>): PeriodCurrencyMetricsResult {
  if (input.completeness === 'unavailable') {
    return { ok: true, value: unavailablePeriodMetrics(input.completeness) };
  }

  if (!input.bucket) {
    return { ok: true, value: unavailablePeriodMetrics(input.completeness) };
  }

  const finalized = finalizeBucket(
    input.bucket,
    input.stableConsumptionRecordGate,
  );
  if (!finalized.ok) return finalized;

  const dataAvailability =
    input.completeness === 'stale'
      ? 'stale_snapshot'
      : input.completeness === 'partial' || input.resolutionStatus === 'partial'
        ? 'partial_observation'
        : 'observed';
  return {
    ok: true,
    value: {
      ...finalized.value,
      dataAvailability,
      completeness: input.completeness,
    },
  };
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

export function aggregateAnalyticsConsumptionFacts(
  input: AnalyticsAggregationInput,
): AnalyticsAggregationResult {
  if (!input.factResolution.ok) {
    return { ok: false, reasonCode: 'invalid_fact_resolution' };
  }
  if (
    !aggregationCompletenessSet.has(input.comparison.currentCompleteness) ||
    !aggregationCompletenessSet.has(input.comparison.previousCompleteness) ||
    typeof input.comparison.currentMetricVersion !== 'string' ||
    input.comparison.currentMetricVersion.length === 0 ||
    typeof input.comparison.previousMetricVersion !== 'string' ||
    input.comparison.previousMetricVersion.length === 0
  ) {
    return { ok: false, reasonCode: 'invalid_comparison_context' };
  }
  if (
    !isAnalyticsPeriodWindowValid(input.periods.current) ||
    !isAnalyticsPeriodWindowValid(input.periods.previous) ||
    input.periods.current.timeZone !== input.periods.previous.timeZone ||
    input.periods.previous.endDateExclusive !== input.periods.current.startDate ||
    input.periods.previous.localDayCount !== input.periods.current.localDayCount
  ) {
    return { ok: false, reasonCode: 'invalid_period' };
  }

  const currentBuckets = new Map<string, MutableCurrencyBucket>();
  const previousBuckets = new Map<string, MutableCurrencyBucket>();

  for (const scope of input.factResolution.inputScopes) {
    if (
      scope.tenantId !== input.tenantId ||
      scope.institutionId !== input.institutionId
    ) {
      return { ok: false, reasonCode: 'mixed_scope_input' };
    }
  }

  for (const fact of input.factResolution.effectiveFacts) {
    if (
      fact.tenantId !== input.tenantId ||
      fact.institutionId !== input.institutionId
    ) {
      return { ok: false, reasonCode: 'mixed_scope_input' };
    }

    const currentContainment = isInstantInAnalyticsPeriod(
      input.periods.current,
      fact.eventAt,
    );
    const previousContainment = isInstantInAnalyticsPeriod(
      input.periods.previous,
      fact.eventAt,
    );
    if (!currentContainment.ok || !previousContainment.ok) {
      return { ok: false, reasonCode: 'invalid_period' };
    }

    const targetBuckets = currentContainment.contains
      ? currentBuckets
      : previousContainment.contains
        ? previousBuckets
        : null;
    if (!targetBuckets) continue;

    const bucket = targetBuckets.get(fact.currency) ?? emptyCurrencyBucket();
    if (!addFactToBucket(bucket, fact)) {
      return { ok: false, reasonCode: 'unsafe_integer_overflow' };
    }
    targetBuckets.set(fact.currency, bucket);
  }

  const stableRecordGateForBucket = (
    bucket: MutableCurrencyBucket | undefined,
  ) => {
    if (!bucket) return { ok: true as const, value: undefined };
    const gate = resolveAnalyticsStableConsumptionRecordGate({
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      factResolution: input.factResolution,
      periodFacts: bucket.facts,
    });
    if (!gate.ok) {
      return {
        ok: false as const,
        reasonCode:
          gate.reasonCode === 'scope_mismatch'
            ? ('mixed_scope_input' as const)
            : ('invalid_fact_resolution' as const),
      };
    }
    if (gate.value.currencies.length !== 1) {
      return { ok: false as const, reasonCode: 'invalid_fact_resolution' as const };
    }
    return { ok: true as const, value: gate.value.currencies[0] };
  };

  const currencies = new Set([...currentBuckets.keys(), ...previousBuckets.keys()]);
  const currencySetsMatch = setsEqual(
    new Set(currentBuckets.keys()),
    new Set(previousBuckets.keys()),
  );
  const currencyAggregations: AnalyticsCurrencyAggregation[] = [];

  for (const currency of [...currencies].sort((left, right) => left.localeCompare(right))) {
    const currentStableRecordGate = stableRecordGateForBucket(
      currentBuckets.get(currency),
    );
    const previousStableRecordGate = stableRecordGateForBucket(
      previousBuckets.get(currency),
    );
    if (!currentStableRecordGate.ok) {
      return {
        ok: false,
        reasonCode: currentStableRecordGate.reasonCode,
      };
    }
    if (!previousStableRecordGate.ok) {
      return {
        ok: false,
        reasonCode: previousStableRecordGate.reasonCode,
      };
    }
    const current = periodCurrencyMetrics({
      bucket: currentBuckets.get(currency),
      completeness: input.comparison.currentCompleteness,
      resolutionStatus: input.factResolution.status,
      stableConsumptionRecordGate: currentStableRecordGate.value,
    });
    const previous = periodCurrencyMetrics({
      bucket: previousBuckets.get(currency),
      completeness: input.comparison.previousCompleteness,
      resolutionStatus: input.factResolution.status,
      stableConsumptionRecordGate: previousStableRecordGate.value,
    });
    if (!current.ok || !previous.ok) {
      return { ok: false, reasonCode: 'unsafe_integer_overflow' };
    }

    const baseReason = comparisonBaseReason({
      resolutionStatus: input.factResolution.status,
      currentCompleteness: input.comparison.currentCompleteness,
      previousCompleteness: input.comparison.previousCompleteness,
      currentMetricVersion: input.comparison.currentMetricVersion,
      previousMetricVersion: input.comparison.previousMetricVersion,
      currencySetsMatch,
    });

    const paidComparison = compareMetric(
      current.value.paidAmountMinor,
      previous.value.paidAmountMinor,
      baseReason,
    );
    const refundComparison = compareMetric(
      current.value.refundAmountMinor,
      previous.value.refundAmountMinor,
      baseReason,
    );
    const netComparison = compareMetric(
      current.value.netAmountMinor,
      previous.value.netAmountMinor,
      baseReason,
    );
    const paidCustomerComparison = compareMetric(
      current.value.paidCustomerCount,
      previous.value.paidCustomerCount,
      baseReason,
    );
    if (
      !paidComparison ||
      !refundComparison ||
      !netComparison ||
      !paidCustomerComparison
    ) {
      return { ok: false, reasonCode: 'unsafe_integer_overflow' };
    }

    currencyAggregations.push({
      currency,
      current: current.value,
      previous: previous.value,
      comparisons: {
        paidAmountMinor: paidComparison,
        refundAmountMinor: refundComparison,
        netAmountMinor: netComparison,
        paidCustomerCount: paidCustomerComparison,
        averageNetAmountPerPaidCustomer: compareAverage(
          current.value.averageNetAmountPerPaidCustomer,
          previous.value.averageNetAmountPerPaidCustomer,
          baseReason,
        ),
      },
    });
  }

  return {
    ok: true,
    value: {
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      timeZone: input.periods.current.timeZone,
      currentPeriod: { ...input.periods.current },
      previousPeriod: { ...input.periods.previous },
      periodCompleteness: {
        current: input.comparison.currentCompleteness,
        previous: input.comparison.previousCompleteness,
      },
      factResolution: {
        status: input.factResolution.status,
        replayedFactCount: input.factResolution.replayedFactCount,
        excludedFinalStateCount: input.factResolution.excludedFinalStateCount,
        rejectedChainCount: input.factResolution.rejectedChainCount,
        issues: input.factResolution.issues.map((issue) => ({ ...issue })),
      },
      currencies: currencyAggregations,
    },
  };
}
