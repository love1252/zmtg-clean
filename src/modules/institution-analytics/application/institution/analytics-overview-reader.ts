import {
  aggregateAnalyticsConsumptionFacts,
  type AnalyticsCurrencyComparisons,
  type AnalyticsPeriodCurrencyMetrics,
} from '@/modules/institution-analytics/domain/analytics-aggregation';
import {
  ANALYTICS_CONSUMPTION_EVENT_TYPES,
  resolveAnalyticsConsumptionFacts,
  type AnalyticsConsumptionFactInput,
  type AnalyticsCustomerAttribution,
  type AnalyticsProjectAttribution,
  type AnalyticsRefundLinkStatus,
} from '@/modules/institution-analytics/domain/analytics-consumption-facts';
import { resolveAnalyticsPeriod } from '@/modules/institution-analytics/domain/analytics-periods';
import {
  INSTITUTION_ANALYTICS_OVERVIEW_MAX_FACTS_V1,
  type InstitutionAnalyticsOverviewSourceRowV1,
  type InstitutionAnalyticsOverviewSourceV1,
} from '@/modules/institution-analytics/ports/institution-analytics-overview-source';

export type AnalyticsOverviewPeriodMetricsV1 = Readonly<{
  availability: 'available' | 'unavailable';
  paidAmountMinor: number | null;
  refundAmountMinor: number | null;
  netAmountMinor: number | null;
  paidCustomerCount: number | null;
  averageNetAmountPerPaidCustomer: Readonly<{
    numeratorMinor: number;
    denominator: number;
  }> | null;
}>;

export type AnalyticsOverviewV1 = Readonly<{
  contractVersion: 'v1';
  preset: 'month';
  comparisonMode: 'previous_equal_length_period';
  timeZone: string;
  defaultCurrency: string;
  asOfBusinessDate: string;
  currentPeriod: Readonly<{
    startDate: string;
    endDateExclusive: string;
    localDayCount: number;
  }>;
  previousPeriod: Readonly<{
    startDate: string;
    endDateExclusive: string;
    localDayCount: number;
  }>;
  dataState: 'empty' | 'ready';
  currencies: readonly Readonly<{
    currency: string;
    current: AnalyticsOverviewPeriodMetricsV1;
    previous: AnalyticsOverviewPeriodMetricsV1;
    comparisons: AnalyticsCurrencyComparisons;
  }>[];
}>;

export type AnalyticsOverviewReaderResultV1 =
  | Readonly<{ kind: 'ready'; overview: AnalyticsOverviewV1 }>
  | Readonly<{ kind: 'unavailable' }>;

export type AnalyticsOverviewReaderV1 = Readonly<{
  read(input: Readonly<{
    tenantId: string;
    institutionId: string;
    timeZone: string;
    defaultCurrency: string;
    asOf: string;
  }>): Promise<AnalyticsOverviewReaderResultV1>;
}>;

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const refundLinkStatuses = new Set<AnalyticsRefundLinkStatus>([
  'not_applicable',
  'linked',
  'orphan_verified',
]);
const eventTypes = new Set<string>(ANALYTICS_CONSUMPTION_EVENT_TYPES);
const supportedCurrencies = new Set(Intl.supportedValuesOf('currency'));
const UNAVAILABLE = Object.freeze({ kind: 'unavailable' } as const);

function toInstant(value: unknown): string | null {
  try {
    if (!(value instanceof Date)) return null;
    const epochMs = value.getTime();
    if (!Number.isSafeInteger(epochMs)) return null;
    return value.toISOString();
  } catch {
    return null;
  }
}

function customerAttribution(
  row: InstitutionAnalyticsOverviewSourceRowV1,
): AnalyticsCustomerAttribution | null {
  if (
    row.customerAttributionStatus === 'matched'
    && typeof row.customerId === 'string'
    && row.customerCandidateReference === null
  ) {
    return Object.freeze({ status: 'matched' as const, customerId: row.customerId });
  }
  if (
    row.customerAttributionStatus === 'unmatched'
    && row.customerId === null
    && row.customerCandidateReference === null
  ) {
    return Object.freeze({ status: 'unmatched' as const });
  }
  if (
    row.customerAttributionStatus === 'pending_review'
    && row.customerId === null
    && typeof row.customerCandidateReference === 'string'
  ) {
    return Object.freeze({
      status: 'pending_review' as const,
      candidateReference: row.customerCandidateReference,
    });
  }
  return null;
}

function projectAttribution(
  row: InstitutionAnalyticsOverviewSourceRowV1,
): AnalyticsProjectAttribution | null {
  if (
    row.projectAttributionStatus === 'mapped'
    && typeof row.hisDirectoryVersion === 'string'
    && typeof row.canonicalProjectId === 'string'
    && row.projectCandidateReference === null
  ) {
    return Object.freeze({
      status: 'mapped' as const,
      hisDirectoryVersion: row.hisDirectoryVersion,
      canonicalProjectId: row.canonicalProjectId,
    });
  }
  if (
    row.projectAttributionStatus === 'unmapped'
    && row.hisDirectoryVersion === null
    && row.canonicalProjectId === null
    && row.projectCandidateReference === null
  ) {
    return Object.freeze({ status: 'unmapped' as const });
  }
  if (
    row.projectAttributionStatus === 'pending_review'
    && row.hisDirectoryVersion === null
    && row.canonicalProjectId === null
    && typeof row.projectCandidateReference === 'string'
  ) {
    return Object.freeze({
      status: 'pending_review' as const,
      candidateReference: row.projectCandidateReference,
    });
  }
  return null;
}

function parseRow(
  row: InstitutionAnalyticsOverviewSourceRowV1,
  tenantId: string,
  institutionId: string,
): AnalyticsConsumptionFactInput | null {
  if (
    row.tenantId !== tenantId
    || row.institutionId !== institutionId
    || !idPattern.test(row.sourceId)
    || typeof row.batchOrConnectionRef !== 'string'
    || typeof row.sourceRecordRef !== 'string'
    || typeof row.sourceRevision !== 'string'
    || (row.supersedesSourceRevision !== null
      && typeof row.supersedesSourceRevision !== 'string')
    || !eventTypes.has(row.eventType)
    || !Number.isSafeInteger(row.amountMinor)
    || row.amountMinor <= 0
    || typeof row.currency !== 'string'
    || !supportedCurrencies.has(row.currency)
    || (row.stableConsumptionRecordRef !== null
      && typeof row.stableConsumptionRecordRef !== 'string')
    || !refundLinkStatuses.has(row.refundLinkStatus as AnalyticsRefundLinkStatus)
  ) return null;

  const eventAt = toInstant(row.eventAt);
  const receivedAt = toInstant(row.receivedAt);
  const customer = customerAttribution(row);
  const project = projectAttribution(row);
  if (!eventAt || !receivedAt || !customer || !project) return null;

  const expectedFamily = row.eventType.startsWith('payment_') ? 'payment' : 'refund';
  if (row.eventFamily !== expectedFamily) return null;

  return Object.freeze({
    tenantId,
    institutionId,
    source: row.sourceId,
    sourceRecordRef: row.sourceRecordRef,
    sourceRevision: row.sourceRevision,
    supersedesSourceRevision: row.supersedesSourceRevision,
    eventType: row.eventType as AnalyticsConsumptionFactInput['eventType'],
    eventAt,
    receivedAt,
    batchOrConnectionRef: row.batchOrConnectionRef,
    amountMinor: row.amountMinor,
    currency: row.currency,
    stableConsumptionRecordRef: row.stableConsumptionRecordRef,
    customerAttribution: customer,
    projectAttribution: project,
    refundLinkStatus: row.refundLinkStatus as AnalyticsRefundLinkStatus,
  });
}

function publicMetrics(
  metrics: AnalyticsPeriodCurrencyMetrics,
): AnalyticsOverviewPeriodMetricsV1 {
  if (metrics.dataAvailability === 'not_available') {
    return Object.freeze({
      availability: 'unavailable' as const,
      paidAmountMinor: null,
      refundAmountMinor: null,
      netAmountMinor: null,
      paidCustomerCount: null,
      averageNetAmountPerPaidCustomer: null,
    });
  }

  return Object.freeze({
    availability: 'available' as const,
    paidAmountMinor: metrics.paidAmountMinor,
    refundAmountMinor: metrics.refundAmountMinor,
    netAmountMinor: metrics.netAmountMinor,
    paidCustomerCount: metrics.paidCustomerCount,
    averageNetAmountPerPaidCustomer:
      metrics.averageNetAmountPerPaidCustomer === null
        ? null
        : Object.freeze({ ...metrics.averageNetAmountPerPaidCustomer }),
  });
}

export function createAnalyticsOverviewReaderV1(input: Readonly<{
  source: InstitutionAnalyticsOverviewSourceV1;
}>): AnalyticsOverviewReaderV1 {
  return Object.freeze({
    async read(value) {
      try {
        if (
          !idPattern.test(value.tenantId)
          || !idPattern.test(value.institutionId)
          || typeof value.timeZone !== 'string'
          || value.timeZone.length === 0
          || typeof value.defaultCurrency !== 'string'
          || !supportedCurrencies.has(value.defaultCurrency)
          || typeof value.asOf !== 'string'
        ) return UNAVAILABLE;

        const periods = resolveAnalyticsPeriod({
          preset: 'month',
          timeZone: value.timeZone,
          asOf: value.asOf,
        });
        if (!periods.ok) return UNAVAILABLE;

        const rawRows = await input.source.listFacts({
          tenantId: value.tenantId,
          institutionId: value.institutionId,
        });
        if (
          !Array.isArray(rawRows)
          || rawRows.length > INSTITUTION_ANALYTICS_OVERVIEW_MAX_FACTS_V1
        ) return UNAVAILABLE;

        const facts: AnalyticsConsumptionFactInput[] = [];
        for (const rawRow of rawRows) {
          const fact = parseRow(rawRow, value.tenantId, value.institutionId);
          if (!fact) return UNAVAILABLE;
          facts.push(fact);
        }

        const factResolution = resolveAnalyticsConsumptionFacts(facts);
        if (!factResolution.ok || factResolution.status !== 'complete') {
          return UNAVAILABLE;
        }

        const aggregation = aggregateAnalyticsConsumptionFacts({
          tenantId: value.tenantId,
          institutionId: value.institutionId,
          factResolution,
          periods: periods.value,
          comparison: {
            currentCompleteness: 'complete',
            previousCompleteness: 'complete',
            currentMetricVersion: 'analytics_overview_v1',
            previousMetricVersion: 'analytics_overview_v1',
          },
        });
        if (!aggregation.ok) return UNAVAILABLE;

        const currencies = Object.freeze(
          aggregation.value.currencies.map((currency) => Object.freeze({
            currency: currency.currency,
            current: publicMetrics(currency.current),
            previous: publicMetrics(currency.previous),
            comparisons: currency.comparisons,
          })),
        );

        const overview = Object.freeze({
          contractVersion: 'v1' as const,
          preset: 'month' as const,
          comparisonMode: 'previous_equal_length_period' as const,
          timeZone: value.timeZone,
          defaultCurrency: value.defaultCurrency,
          asOfBusinessDate: periods.value.asOfBusinessDate,
          currentPeriod: Object.freeze({
            startDate: periods.value.current.startDate,
            endDateExclusive: periods.value.current.endDateExclusive,
            localDayCount: periods.value.current.localDayCount,
          }),
          previousPeriod: Object.freeze({
            startDate: periods.value.previous.startDate,
            endDateExclusive: periods.value.previous.endDateExclusive,
            localDayCount: periods.value.previous.localDayCount,
          }),
          dataState: currencies.length === 0 ? 'empty' as const : 'ready' as const,
          currencies,
        }) satisfies AnalyticsOverviewV1;

        return Object.freeze({ kind: 'ready' as const, overview });
      } catch {
        return UNAVAILABLE;
      }
    },
  });
}
