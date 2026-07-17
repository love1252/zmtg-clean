import { describe, expect, it } from 'vitest';

import {
  aggregateAnalyticsConsumptionFacts,
  type AnalyticsAggregationInput,
  type AnalyticsPeriodCurrencyMetrics,
} from '@/modules/institution-analytics/domain/analytics-aggregation';
import {
  resolveAnalyticsConsumptionFacts,
  type AnalyticsConsumptionFactInput,
} from '@/modules/institution-analytics/domain/analytics-consumption-facts';
import {
  isInstantInAnalyticsPeriod,
  resolveAnalyticsPeriod,
  toInstitutionBusinessDate,
  type AnalyticsPeriodPair,
  type AnalyticsPeriodRequest,
} from '@/modules/institution-analytics/domain/analytics-periods';

const tenantId = 'tenant-analytics-001';
const institutionId = 'institution-analytics-001';

const baseFact = {
  tenantId,
  institutionId,
  source: 'approved-source',
  sourceRecordRef: 'source-record-safe-001',
  sourceRevision: 'revision-root',
  supersedesSourceRevision: null,
  eventType: 'payment_succeeded',
  eventAt: '2026-07-10T04:00:00.000Z',
  receivedAt: '2026-07-10T04:01:00.000Z',
  batchOrConnectionRef: 'connection-safe-001',
  amountMinor: 1_000,
  currency: 'CNY',
  stableConsumptionRecordRef: 'consumption-safe-001',
  customerAttribution: { status: 'matched', customerId: 'customer-safe-001' },
  projectAttribution: {
    status: 'mapped',
    hisDirectoryVersion: 'his-directory-v1',
    canonicalProjectId: 'project-safe-001',
  },
  refundLinkStatus: 'not_applicable',
} satisfies AnalyticsConsumptionFactInput;

function fact(
  sourceRecordRef: string,
  patch: Partial<AnalyticsConsumptionFactInput> = {},
): AnalyticsConsumptionFactInput {
  return { ...baseFact, sourceRecordRef, ...patch };
}

function refundFact(
  sourceRecordRef: string,
  patch: Partial<AnalyticsConsumptionFactInput> = {},
): AnalyticsConsumptionFactInput {
  return fact(sourceRecordRef, {
    eventType: 'refund_confirmed',
    refundLinkStatus: 'linked',
    ...patch,
  });
}

function expectPeriod(request: AnalyticsPeriodRequest) {
  const result = resolveAnalyticsPeriod(request);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reasonCode);
  return result.value;
}

function analyticsPeriods() {
  return expectPeriod({
    preset: 'custom',
    timeZone: 'Asia/Shanghai',
    asOf: '2026-07-12T04:00:00.000Z',
    startDate: '2026-07-10',
    endDateInclusive: '2026-07-12',
  });
}

const completeComparison = {
  currentCompleteness: 'complete',
  previousCompleteness: 'complete',
  currentMetricVersion: 'analytics-an01-v1',
  previousMetricVersion: 'analytics-an01-v1',
} as const;

function aggregationResult(
  facts: readonly AnalyticsConsumptionFactInput[],
  options: Readonly<{
    periods?: AnalyticsPeriodPair;
    comparison?: Partial<AnalyticsAggregationInput['comparison']>;
  }> = {},
) {
  const factResolution = resolveAnalyticsConsumptionFacts(facts);
  expect(factResolution.ok).toBe(true);
  if (!factResolution.ok) throw new Error('expected valid fact resolution');

  return aggregateAnalyticsConsumptionFacts({
    tenantId,
    institutionId,
    factResolution,
    periods: options.periods ?? analyticsPeriods(),
    comparison: { ...completeComparison, ...options.comparison },
  });
}

function expectAggregation(
  facts: readonly AnalyticsConsumptionFactInput[],
  options: Parameters<typeof aggregationResult>[1] = {},
) {
  const result = aggregationResult(facts, options);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reasonCode);
  return result.value;
}

function expectCalculatedMetrics(metrics: AnalyticsPeriodCurrencyMetrics) {
  expect(metrics.dataAvailability).not.toBe('not_available');
  if (metrics.dataAvailability === 'not_available') {
    throw new Error('expected calculated period currency metrics');
  }
  return metrics;
}

const coreFacts = [
  fact('previous-payment', {
    eventAt: '2026-07-08T04:00:00.000Z',
    amountMinor: 1_000,
    stableConsumptionRecordRef: 'consumption-previous-001',
  }),
  fact('current-payment-matched', {
    eventAt: '2026-07-10T04:00:00.000Z',
    amountMinor: 1_500,
    stableConsumptionRecordRef: 'consumption-current-001',
  }),
  refundFact('current-refund-linked', {
    eventAt: '2026-07-11T04:00:00.000Z',
    amountMinor: 200,
    stableConsumptionRecordRef: 'consumption-current-001',
  }),
  fact('current-payment-unmatched', {
    eventAt: '2026-07-11T05:00:00.000Z',
    amountMinor: 500,
    stableConsumptionRecordRef: 'consumption-current-002',
    customerAttribution: { status: 'unmatched' },
    projectAttribution: { status: 'unmapped' },
  }),
] satisfies readonly AnalyticsConsumptionFactInput[];

describe('经营分析机构时区与期间', () => {
  it('按 Asia/Shanghai 午夜切换本地业务日期', () => {
    expect(
      toInstitutionBusinessDate({
        instant: '2026-07-16T15:59:59.999Z',
        timeZone: 'Asia/Shanghai',
      }),
    ).toEqual({ ok: true, businessDate: '2026-07-16' });
    expect(
      toInstitutionBusinessDate({
        instant: '2026-07-16T16:00:00.000Z',
        timeZone: 'Asia/Shanghai',
      }),
    ).toEqual({ ok: true, businessDate: '2026-07-17' });
  });

  it.each([
    [
      'today',
      { preset: 'today', timeZone: 'Asia/Shanghai', asOf: '2026-07-17T04:00:00Z' },
      ['2026-07-17', '2026-07-18', 1, '2026-07-16', '2026-07-17'],
    ],
    [
      'week',
      { preset: 'week', timeZone: 'Asia/Shanghai', asOf: '2026-07-17T04:00:00Z' },
      ['2026-07-13', '2026-07-18', 5, '2026-07-08', '2026-07-13'],
    ],
    [
      'month',
      { preset: 'month', timeZone: 'Asia/Shanghai', asOf: '2026-07-17T04:00:00Z' },
      ['2026-07-01', '2026-07-18', 17, '2026-06-14', '2026-07-01'],
    ],
    [
      'quarter',
      { preset: 'quarter', timeZone: 'Asia/Shanghai', asOf: '2026-05-18T04:00:00Z' },
      ['2026-04-01', '2026-05-19', 48, '2026-02-12', '2026-04-01'],
    ],
    [
      'year',
      { preset: 'year', timeZone: 'Asia/Shanghai', asOf: '2026-07-17T04:00:00Z' },
      ['2026-01-01', '2026-07-18', 198, '2025-06-17', '2026-01-01'],
    ],
    [
      'custom',
      {
        preset: 'custom',
        timeZone: 'America/New_York',
        asOf: '2026-03-08T12:00:00Z',
        startDate: '2026-03-07',
        endDateInclusive: '2026-03-09',
      },
      ['2026-03-07', '2026-03-10', 3, '2026-03-04', '2026-03-07'],
    ],
  ] as const)('解析 %s 与上一等长本地日周期', (_preset, request, expected) => {
    const result = expectPeriod(request as AnalyticsPeriodRequest);

    expect([
      result.current.startDate,
      result.current.endDateExclusive,
      result.current.localDayCount,
      result.previous.startDate,
      result.previous.endDateExclusive,
    ]).toEqual(expected);
    expect(result.previous.localDayCount).toBe(result.current.localDayCount);
  });

  it('America/New_York 2026 春季 DST 当地日覆盖实际 23 小时', () => {
    const period = expectPeriod({
      preset: 'today',
      timeZone: 'America/New_York',
      asOf: '2026-03-08T12:00:00Z',
    });

    expect(period.current).toEqual({
      timeZone: 'America/New_York',
      startDate: '2026-03-08',
      endDateExclusive: '2026-03-09',
      localDayCount: 1,
    });
    expect(period.previous).toEqual({
      timeZone: 'America/New_York',
      startDate: '2026-03-07',
      endDateExclusive: '2026-03-08',
      localDayCount: 1,
    });
    expect(
      isInstantInAnalyticsPeriod(period.current, '2026-03-08T04:59:59.999Z'),
    ).toEqual({ ok: true, contains: false, businessDate: '2026-03-07' });
    expect(isInstantInAnalyticsPeriod(period.current, '2026-03-08T05:00:00Z')).toEqual(
      { ok: true, contains: true, businessDate: '2026-03-08' },
    );
    expect(
      isInstantInAnalyticsPeriod(period.current, '2026-03-09T03:59:59.999Z'),
    ).toEqual({ ok: true, contains: true, businessDate: '2026-03-08' });
    expect(isInstantInAnalyticsPeriod(period.current, '2026-03-09T04:00:00Z')).toEqual(
      { ok: true, contains: false, businessDate: '2026-03-09' },
    );
  });

  it('America/New_York 2026 秋季 DST 当地日覆盖实际 25 小时及重复小时', () => {
    const period = expectPeriod({
      preset: 'today',
      timeZone: 'America/New_York',
      asOf: '2026-11-01T12:00:00Z',
    });

    expect(period.current).toEqual({
      timeZone: 'America/New_York',
      startDate: '2026-11-01',
      endDateExclusive: '2026-11-02',
      localDayCount: 1,
    });
    expect(period.previous).toEqual({
      timeZone: 'America/New_York',
      startDate: '2026-10-31',
      endDateExclusive: '2026-11-01',
      localDayCount: 1,
    });
    expect(
      isInstantInAnalyticsPeriod(period.current, '2026-11-01T03:59:59.999Z'),
    ).toEqual({ ok: true, contains: false, businessDate: '2026-10-31' });
    expect(isInstantInAnalyticsPeriod(period.current, '2026-11-01T04:00:00Z')).toEqual(
      { ok: true, contains: true, businessDate: '2026-11-01' },
    );
    expect(
      isInstantInAnalyticsPeriod(period.current, '2026-11-02T04:59:59.999Z'),
    ).toEqual({ ok: true, contains: true, businessDate: '2026-11-01' });
    expect(isInstantInAnalyticsPeriod(period.current, '2026-11-02T05:00:00Z')).toEqual(
      { ok: true, contains: false, businessDate: '2026-11-02' },
    );
    expect(
      [
        '2026-11-01T05:30:00Z',
        '2026-11-01T06:30:00Z',
      ].map((instant) => toInstitutionBusinessDate({
        instant,
        timeZone: 'America/New_York',
      })),
    ).toEqual([
      { ok: true, businessDate: '2026-11-01' },
      { ok: true, businessDate: '2026-11-01' },
    ]);
  });

  it('非 IANA/无效时区、非法 instant、非法日期和反向 custom 范围均 fail-closed', () => {
    expect(
      toInstitutionBusinessDate({
        instant: '2026-07-17T10:00:00Z',
        timeZone: 'Invalid/Zone',
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_time_zone' });
    for (const timeZone of ['CST', '+08:00']) {
      expect(
        toInstitutionBusinessDate({
          instant: '2026-07-17T10:00:00Z',
          timeZone,
        }),
      ).toEqual({ ok: false, reasonCode: 'invalid_time_zone' });
    }
    expect(
      toInstitutionBusinessDate({
        instant: '2026-07-17T10:00:00',
        timeZone: 'Asia/Shanghai',
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_instant' });
    expect(
      toInstitutionBusinessDate({
        instant: '2026-02-30T10:00:00Z',
        timeZone: 'Asia/Shanghai',
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_instant' });
    expect(
      toInstitutionBusinessDate({
        instant: '2026-07-17T10:00:00.123456Z',
        timeZone: 'Asia/Shanghai',
      }),
    ).toEqual({ ok: true, businessDate: '2026-07-17' });
    expect(
      resolveAnalyticsPeriod({
        preset: 'custom',
        timeZone: 'Asia/Shanghai',
        asOf: '2026-07-17T10:00:00Z',
        startDate: '2026-02-30',
        endDateInclusive: '2026-03-01',
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_local_date' });
    expect(
      resolveAnalyticsPeriod({
        preset: 'custom',
        timeZone: 'Asia/Shanghai',
        asOf: '2026-07-17T10:00:00Z',
        startDate: '2026-03-02',
        endDateInclusive: '2026-03-01',
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_custom_range' });
    expect(
      resolveAnalyticsPeriod({
        preset: 'rolling_month',
        timeZone: 'Asia/Shanghai',
        asOf: '2026-07-17T10:00:00Z',
      } as unknown as AnalyticsPeriodRequest),
    ).toEqual({ ok: false, reasonCode: 'invalid_period_preset' });
  });

  it('期间解析不修改请求且显式机构时区结果保持确定', () => {
    const request = Object.freeze({
      preset: 'month',
      timeZone: 'Asia/Shanghai',
      asOf: '2026-07-17T16:30:00+08:00',
    }) satisfies AnalyticsPeriodRequest;
    const before = structuredClone(request);

    const first = resolveAnalyticsPeriod(request);
    const second = resolveAnalyticsPeriod(request);

    expect(request).toEqual(before);
    expect(first).toEqual(second);
    expect(first).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({ asOfBusinessDate: '2026-07-17' }),
      }),
    );
  });
});

describe('经营分析按机构与币种聚合', () => {
  it('支付按成功日、退款按确认日聚合，并精确计算客户与项目口径', () => {
    const value = expectAggregation(coreFacts);
    const cny = value.currencies[0];
    const current = expectCalculatedMetrics(cny.current);

    expect(value.currencies.map((item) => item.currency)).toEqual(['CNY']);
    expect(current).toEqual(
      expect.objectContaining({
        dataAvailability: 'observed',
        completeness: 'complete',
        paidAmountMinor: 2_000,
        refundAmountMinor: 200,
        netAmountMinor: 1_800,
        paidCustomerCount: 1,
        averageNetAmountPerPaidCustomer: {
          numeratorMinor: 1_300,
          denominator: 1,
        },
        consumptionRecordCount: 2,
        countAvailability: 'available',
      }),
    );
    expect(cny.previous).toEqual(
      expect.objectContaining({
        paidAmountMinor: 1_000,
        refundAmountMinor: 0,
        netAmountMinor: 1_000,
      }),
    );
    expect(current.quality.unmatchedCustomer).toEqual({
      paidAmountMinor: 500,
      refundAmountMinor: 0,
      netAmountMinor: 500,
    });
    expect(current.quality.unmappedProject).toEqual({
      paidAmountMinor: 500,
      refundAmountMinor: 0,
      netAmountMinor: 500,
    });
    expect(current.mappedProjectRanking).toEqual([
      {
        hisDirectoryVersion: 'his-directory-v1',
        canonicalProjectId: 'project-safe-001',
        paidAmountMinor: 1_500,
        refundAmountMinor: 200,
        netAmountMinor: 1_300,
      },
    ]);
    expect(cny.comparisons.paidAmountMinor).toEqual({
      status: 'comparable',
      delta: 1_000,
      percentageRatio: { numerator: '1', denominator: '1' },
    });
    expect(cny.comparisons.refundAmountMinor).toEqual({
      status: 'not_comparable',
      reasonCode: 'previous_zero',
      delta: 200,
      percentageRatio: null,
    });
    expect(cny.comparisons.netAmountMinor).toEqual({
      status: 'comparable',
      delta: 800,
      percentageRatio: { numerator: '4', denominator: '5' },
    });
    expect(cny.comparisons.averageNetAmountPerPaidCustomer).toEqual({
      status: 'comparable',
      delta: { numerator: '300', denominator: '1' },
      percentageRatio: { numerator: '3', denominator: '10' },
    });
  });

  it('部分、全额及可靠孤儿退款均以正数输入并作为减项，净额允许为负', () => {
    const value = expectAggregation([
      fact('payment-500', { amountMinor: 500 }),
      refundFact('refund-partial-200', { amountMinor: 200 }),
      refundFact('refund-remaining-300', { amountMinor: 300 }),
      refundFact('refund-orphan-200', {
        amountMinor: 200,
        stableConsumptionRecordRef: 'consumption-safe-orphan-refund-001',
        customerAttribution: { status: 'unmatched' },
        projectAttribution: { status: 'unmapped' },
        refundLinkStatus: 'orphan_verified',
      }),
    ]);
    const current = expectCalculatedMetrics(value.currencies[0].current);

    expect(current).toEqual(
      expect.objectContaining({
        paidAmountMinor: 500,
        refundAmountMinor: 700,
        netAmountMinor: -200,
      }),
    );
    expect(current.quality.orphanRefundCount).toBe(1);
    expect(current.quality.orphanRefundAmountMinor).toBe(200);
  });

  it('全额退款净额精确为 0，且上期支付与当期确认退款按各自业务日跨期', () => {
    const sharedStableRef = 'consumption-safe-cross-period-001';
    const value = expectAggregation([
      fact('previous-payment-cross-period', {
        eventAt: '2026-07-08T04:00:00Z',
        amountMinor: 600,
        stableConsumptionRecordRef: sharedStableRef,
      }),
      refundFact('current-refund-cross-period', {
        eventAt: '2026-07-10T04:00:00Z',
        amountMinor: 600,
        stableConsumptionRecordRef: sharedStableRef,
      }),
    ]);
    const current = expectCalculatedMetrics(value.currencies[0].current);
    const previous = expectCalculatedMetrics(value.currencies[0].previous);

    expect(previous).toEqual(
      expect.objectContaining({
        paidAmountMinor: 600,
        refundAmountMinor: 0,
        netAmountMinor: 600,
      }),
    );
    expect(current).toEqual(
      expect.objectContaining({
        paidAmountMinor: 0,
        refundAmountMinor: 600,
        netAmountMinor: -600,
      }),
    );

    const fullyRefundedSamePeriod = expectAggregation([
      fact('current-payment-full-refund', { amountMinor: 600 }),
      refundFact('current-refund-full-refund', { amountMinor: 600 }),
    ]);
    expect(fullyRefundedSamePeriod.currencies[0].current.netAmountMinor).toBe(0);
  });

  it('退款不创造付费客户，0 客户时客单价为 null', () => {
    const value = expectAggregation([
      fact('unmatched-payment', {
        customerAttribution: { status: 'unmatched' },
      }),
      refundFact('matched-refund-without-current-payment', {
        amountMinor: 200,
        customerAttribution: {
          status: 'matched',
          customerId: 'customer-refund-only',
        },
      }),
    ]);

    expect(value.currencies[0].current.paidCustomerCount).toBe(0);
    expect(value.currencies[0].current.averageNetAmountPerPaidCustomer).toBeNull();
  });

  it('缺稳定消费单引用时保留金额但消费单数为 null 且不生成明细', () => {
    const value = expectAggregation([
      fact('payment-without-stable-record', {
        stableConsumptionRecordRef: null,
        amountMinor: 880,
      }),
    ]);
    const current = expectCalculatedMetrics(value.currencies[0].current);

    expect(current.paidAmountMinor).toBe(880);
    expect(current.consumptionRecordCount).toBeNull();
    expect(current.countAvailability).toBe('unavailable_unstable_reference');
    expect(current.quality.missingStableConsumptionReferenceCount).toBe(1);
    expect(current).not.toHaveProperty('details');
  });

  it('CNY 与 USD 始终独立分区，不产生跨币种总和或换算', () => {
    const value = expectAggregation([
      fact('cny-current', { amountMinor: 1_000, currency: 'CNY' }),
      fact('usd-current', {
        amountMinor: 2_000,
        currency: 'USD',
        stableConsumptionRecordRef: 'consumption-usd-001',
      }),
    ]);

    expect(value.currencies.map(({ currency }) => currency)).toEqual(['CNY', 'USD']);
    expect(value.currencies.map(({ current }) => current.paidAmountMinor)).toEqual([
      1_000,
      2_000,
    ]);
    expect(value).not.toHaveProperty('totalAmountMinor');
    expect(JSON.stringify(value)).not.toMatch(/converted|exchangeRate|allCurrenciesTotal/iu);
  });

  it('stale、币种变化、指标版本变化和不完整纠正链均不造百分比', () => {
    const stale = expectAggregation(coreFacts, {
      comparison: { currentCompleteness: 'stale' },
    });
    expect(stale.currencies[0].comparisons.netAmountMinor).toEqual({
      status: 'not_comparable',
      reasonCode: 'stale',
      delta: null,
      percentageRatio: null,
    });

    const currencyChanged = expectAggregation([
      fact('usd-current-only', {
        currency: 'USD',
        stableConsumptionRecordRef: 'consumption-usd-001',
      }),
    ]);
    expect(currencyChanged.currencies[0].comparisons.paidAmountMinor).toEqual({
      status: 'not_comparable',
      reasonCode: 'currency_set_changed',
      delta: null,
      percentageRatio: null,
    });

    const expandedCurrencySet = expectAggregation([
      ...coreFacts,
      fact('usd-current-added', {
        currency: 'USD',
        stableConsumptionRecordRef: 'consumption-safe-usd-current-added',
      }),
    ]);
    expect(
      expandedCurrencySet.currencies.map(({ comparisons }) =>
        comparisons.netAmountMinor,
      ),
    ).toEqual([
      {
        status: 'not_comparable',
        reasonCode: 'currency_set_changed',
        delta: null,
        percentageRatio: null,
      },
      {
        status: 'not_comparable',
        reasonCode: 'currency_set_changed',
        delta: null,
        percentageRatio: null,
      },
    ]);

    const metricMismatch = expectAggregation(coreFacts, {
      comparison: { previousMetricVersion: 'analytics-an01-v0' },
    });
    expect(metricMismatch.currencies[0].comparisons.netAmountMinor).toEqual({
      status: 'not_comparable',
      reasonCode: 'metric_mismatch',
      delta: null,
      percentageRatio: null,
    });

    const incompleteFacts = [
      ...coreFacts,
      fact('broken-chain', {
        sourceRevision: 'broken-leaf',
        supersedesSourceRevision: 'missing-root',
      }),
    ];
    const incomplete = expectAggregation(incompleteFacts);
    expect(incomplete.factResolution.status).toBe('partial');
    expect(incomplete.currencies[0].comparisons.netAmountMinor).toEqual({
      status: 'not_comparable',
      reasonCode: 'incomplete',
      delta: null,
      percentageRatio: null,
    });
  });

  it('非完整期间缺失币种返回不可用而非可信 0，并保留期间完整性', () => {
    const previousOnlyFacts = [
      fact('previous-cny-only', {
        eventAt: '2026-07-08T04:00:00Z',
        amountMinor: 700,
      }),
    ];
    const value = expectAggregation(
      previousOnlyFacts,
      { comparison: { currentCompleteness: 'unavailable' } },
    );
    const cny = value.currencies[0];

    expect(value.periodCompleteness).toEqual({
      current: 'unavailable',
      previous: 'complete',
    });
    expect(cny.current).toEqual({
      dataAvailability: 'not_available',
      completeness: 'unavailable',
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
    });
    expect(cny.comparisons.netAmountMinor).toEqual({
      status: 'not_comparable',
      reasonCode: 'incomplete',
      delta: null,
      percentageRatio: null,
    });

    for (const [currentCompleteness, reasonCode] of [
      ['partial', 'incomplete'],
      ['stale', 'stale'],
    ] as const) {
      const nonComplete = expectAggregation(previousOnlyFacts, {
        comparison: { currentCompleteness },
      });
      expect(nonComplete.currencies[0].current).toEqual(
        expect.objectContaining({
          dataAvailability: 'not_available',
          completeness: currentCompleteness,
          paidAmountMinor: null,
          refundAmountMinor: null,
          netAmountMinor: null,
        }),
      );
      expect(nonComplete.currencies[0].comparisons.netAmountMinor).toEqual({
        status: 'not_comparable',
        reasonCode,
        delta: null,
        percentageRatio: null,
      });
    }

    const partialResolution = expectAggregation([
      ...previousOnlyFacts,
      fact('broken-current-chain-for-empty-bucket', {
        sourceRevision: 'broken-current-leaf',
        supersedesSourceRevision: 'missing-current-root',
      }),
    ]);
    expect(partialResolution.factResolution.status).toBe('partial');
    expect(partialResolution.currencies[0].current).toEqual(
      expect.objectContaining({
        dataAvailability: 'not_available',
        completeness: 'complete',
        paidAmountMinor: null,
        refundAmountMinor: null,
        netAmountMinor: null,
      }),
    );
    expect(partialResolution.currencies[0].previous).toEqual(
      expect.objectContaining({ dataAvailability: 'partial_observation' }),
    );
  });

  it('scope 混入与安全整数聚合溢出均 fail-closed', () => {
    const mixedScope = aggregationResult([
      fact('other-institution', { institutionId: 'institution-other' }),
    ]);
    expect(mixedScope).toEqual({ ok: false, reasonCode: 'mixed_scope_input' });

    for (const hiddenScopeFact of [
      fact('other-institution-cancelled', {
        institutionId: 'institution-other',
        eventType: 'payment_cancelled',
      }),
      fact('other-institution-broken-chain', {
        institutionId: 'institution-other',
        sourceRevision: 'other-broken-leaf',
        supersedesSourceRevision: 'other-missing-root',
      }),
      fact('other-tenant-cancelled', {
        tenantId: 'tenant-other',
        eventType: 'payment_cancelled',
      }),
    ]) {
      const hiddenMixedScope = aggregationResult([
        fact('local-institution-payment'),
        hiddenScopeFact,
      ]);
      expect(hiddenMixedScope).toEqual({
        ok: false,
        reasonCode: 'mixed_scope_input',
      });
    }

    const overflow = aggregationResult([
      fact('max-safe', {
        amountMinor: Number.MAX_SAFE_INTEGER,
        stableConsumptionRecordRef: 'consumption-max-safe',
      }),
      fact('overflow-one', {
        amountMinor: 1,
        stableConsumptionRecordRef: 'consumption-overflow-one',
      }),
    ]);
    expect(overflow).toEqual({ ok: false, reasonCode: 'unsafe_integer_overflow' });
  });

  it('空事实也独立校验期间日期、日数和 IANA 时区', () => {
    const valid = analyticsPeriods();
    const invalidTimeZone = {
      ...valid,
      current: { ...valid.current, timeZone: 'CST' },
      previous: { ...valid.previous, timeZone: 'CST' },
    } satisfies AnalyticsPeriodPair;
    expect(aggregationResult([], { periods: invalidTimeZone })).toEqual({
      ok: false,
      reasonCode: 'invalid_period',
    });

    const invalidDayCount = {
      ...valid,
      current: { ...valid.current, localDayCount: 99 },
      previous: { ...valid.previous, localDayCount: 99 },
    } satisfies AnalyticsPeriodPair;
    expect(aggregationResult([], { periods: invalidDayCount })).toEqual({
      ok: false,
      reasonCode: 'invalid_period',
    });
  });

  it('不修改输入、与输入排列无关，且输出不回显客户、原支付、文件或 provider 材料', () => {
    const forbidden = {
      customer: 'customer-phone-13800001111',
      payment: 'original-payment-number-7788',
      stable: 'original-order-number-9911',
      batch: 'provider-payload-secret-marker',
    } as const;
    const inputs = [
      fact(forbidden.payment, {
        stableConsumptionRecordRef: forbidden.stable,
        customerAttribution: { status: 'matched', customerId: forbidden.customer },
        batchOrConnectionRef: forbidden.batch,
      }),
      fact('deterministic-second', {
        amountMinor: 300,
        projectAttribution: { status: 'unmapped' },
      }),
    ];
    const before = structuredClone(inputs);

    const forward = expectAggregation(inputs);
    const reversed = expectAggregation([...inputs].reverse());
    const serialized = JSON.stringify(forward);

    expect(inputs).toEqual(before);
    expect(forward).toEqual(reversed);
    for (const value of Object.values(forbidden)) {
      expect(serialized).not.toContain(value);
    }
    expect(serialized).not.toMatch(
      /customerId|sourceRecordRef|sourceRevision|batchOrConnectionRef|fileContent|freeText|sql|stack|credential|providerPayload/iu,
    );
  });
});
