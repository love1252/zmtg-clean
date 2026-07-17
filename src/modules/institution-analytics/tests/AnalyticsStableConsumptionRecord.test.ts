import { describe, expect, it } from 'vitest';

import {
  aggregateAnalyticsConsumptionFacts,
  type AnalyticsAggregationInput,
} from '@/modules/institution-analytics/domain/analytics-aggregation';
import {
  resolveAnalyticsConsumptionFacts,
  type AnalyticsConsumptionFactInput,
} from '@/modules/institution-analytics/domain/analytics-consumption-facts';
import { resolveAnalyticsPeriod } from '@/modules/institution-analytics/domain/analytics-periods';
import { resolveAnalyticsStableConsumptionRecordGate } from '@/modules/institution-analytics/domain/analytics-stable-consumption-record';

const tenantId = 'tenant-analytics-001';
const institutionId = 'institution-analytics-001';

const baseFact = {
  tenantId,
  institutionId,
  source: 'approved-source-a',
  sourceRecordRef: 'payment-source-safe-001',
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

function refund(
  sourceRecordRef: string,
  patch: Partial<AnalyticsConsumptionFactInput> = {},
): AnalyticsConsumptionFactInput {
  return fact(sourceRecordRef, {
    eventType: 'refund_confirmed',
    refundLinkStatus: 'linked',
    ...patch,
  });
}

function resolve(facts: readonly AnalyticsConsumptionFactInput[]) {
  const result = resolveAnalyticsConsumptionFacts(facts);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected resolved facts');
  return result;
}

function gate(
  facts: readonly AnalyticsConsumptionFactInput[],
  periodFacts?: ReadonlyArray<ReturnType<typeof resolve>['effectiveFacts'][number]>,
) {
  const input = {
    tenantId,
    institutionId,
    factResolution: resolve(facts),
    ...(periodFacts === undefined ? {} : { periodFacts }),
  };
  return resolveAnalyticsStableConsumptionRecordGate(input);
}

function aggregate(facts: readonly AnalyticsConsumptionFactInput[]) {
  const periods = resolveAnalyticsPeriod({
    preset: 'custom',
    timeZone: 'Asia/Shanghai',
    asOf: '2026-07-12T04:00:00.000Z',
    startDate: '2026-07-10',
    endDateInclusive: '2026-07-12',
  });
  expect(periods.ok).toBe(true);
  if (!periods.ok) throw new Error('expected periods');

  const input = {
    tenantId,
    institutionId,
    factResolution: resolve(facts),
    periods: periods.value,
    comparison: {
      currentCompleteness: 'complete',
      previousCompleteness: 'complete',
      currentMetricVersion: 'analytics-an01-v1',
      previousMetricVersion: 'analytics-an01-v1',
    },
  } satisfies AnalyticsAggregationInput;
  const result = aggregateAnalyticsConsumptionFacts(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reasonCode);
  return result.value;
}

describe('经营分析稳定消费单门禁', () => {
  it('以来源与稳定引用共同计数；合法纠正和重放不重复计数且不回显引用', () => {
    const facts = [
      fact('payment-a', { amountMinor: 900 }),
      fact('payment-a', {
        sourceRevision: 'revision-corrected',
        supersedesSourceRevision: 'revision-root',
        amountMinor: 1_000,
      }),
      fact('payment-a', {
        sourceRevision: 'revision-corrected',
        supersedesSourceRevision: 'revision-root',
        amountMinor: 1_000,
        receivedAt: '2026-07-10T04:02:00.000Z',
        batchOrConnectionRef: 'connection-safe-replay-001',
      }),
      fact('payment-b', {
        source: 'approved-source-b',
        stableConsumptionRecordRef: 'consumption-safe-001',
      }),
    ];
    const result = gate(facts);

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        replayedFactCount: 1,
        rejectedCorrectionChainCount: 0,
        currencies: [
          expect.objectContaining({
            currency: 'CNY',
            consumptionRecordCount: 2,
            countAvailability: 'available',
          }),
        ],
      }),
    });
    expect(JSON.stringify(result)).not.toContain('consumption-safe-001');
    expect(JSON.stringify(result)).not.toContain('approved-source-a');
  });

  it('缺稳定引用只关闭次数，失败取消不进入金额，可靠金额仍按币种聚合', () => {
    const result = aggregate([
      fact('payment-without-stable-ref', {
        stableConsumptionRecordRef: null,
        amountMinor: 880,
      }),
      fact('payment-failed', { eventType: 'payment_failed', currency: 'USD' }),
      fact('payment-cancelled', { eventType: 'payment_cancelled', currency: 'USD' }),
    ]);

    expect(result.currencies).toHaveLength(1);
    expect(result.currencies[0]).toEqual(
      expect.objectContaining({ currency: 'CNY' }),
    );
    expect(result.currencies[0]?.current).toEqual(
      expect.objectContaining({
        paidAmountMinor: 880,
        refundAmountMinor: 0,
        netAmountMinor: 880,
        consumptionRecordCount: null,
        countAvailability: 'unavailable_unstable_reference',
        quality: expect.objectContaining({
          missingStableConsumptionReferenceCount: 1,
        }),
      }),
    );
  });

  it('同一来源的冲突引用与不可靠退款归属只产生受控质量结果，不污染金额、客户或项目统计', () => {
    const result = aggregate([
      fact('payment-conflict-a', {
        stableConsumptionRecordRef: 'consumption-conflict-001',
        amountMinor: 1_000,
      }),
      fact('payment-conflict-b', {
        stableConsumptionRecordRef: 'consumption-conflict-001',
        amountMinor: 300,
        customerAttribution: { status: 'unmatched' },
        projectAttribution: { status: 'unmapped' },
      }),
      refund('refund-currency-mismatch', {
        stableConsumptionRecordRef: 'consumption-conflict-001',
        currency: 'USD',
        amountMinor: 1_400,
        customerAttribution: { status: 'unmatched' },
        projectAttribution: { status: 'unmapped' },
      }),
      refund('orphan-refund', {
        stableConsumptionRecordRef: 'consumption-orphan-001',
        currency: 'USD',
        amountMinor: 60,
        refundLinkStatus: 'orphan_verified',
        customerAttribution: { status: 'unmatched' },
        projectAttribution: { status: 'unmapped' },
      }),
    ]);

    const cny = result.currencies.find((currency) => currency.currency === 'CNY');
    const usd = result.currencies.find((currency) => currency.currency === 'USD');
    expect(cny?.current).toEqual(
      expect.objectContaining({
        paidAmountMinor: 1_300,
        netAmountMinor: 1_300,
        paidCustomerCount: 1,
        consumptionRecordCount: null,
        countAvailability: 'unavailable_unstable_reference',
        mappedProjectRanking: expect.any(Array),
        quality: expect.objectContaining({
          conflictingStableConsumptionRecordCount: 1,
          unmatchedCustomer: expect.objectContaining({ paidAmountMinor: 300 }),
          unmappedProject: expect.objectContaining({ paidAmountMinor: 300 }),
        }),
      }),
    );
    expect(usd?.current).toEqual(
      expect.objectContaining({
        paidAmountMinor: 0,
        refundAmountMinor: 1_460,
        netAmountMinor: -1_460,
        paidCustomerCount: 0,
        averageNetAmountPerPaidCustomer: null,
        consumptionRecordCount: null,
        quality: expect.objectContaining({
          linkedRefundCurrencyMismatchCount: 1,
          orphanRefundCount: 1,
          orphanRefundAmountMinor: 60,
        }),
      }),
    );
  });

  it('断裂纠正链使次数不可用但保留其他合法金额，并对 scope mismatch fail-closed', () => {
    const facts = [
      fact('valid-payment', { amountMinor: 600 }),
      fact('broken-payment', {
        sourceRevision: 'revision-leaf',
        supersedesSourceRevision: 'revision-missing',
      }),
    ];
    const result = aggregate(facts);
    const current = result.currencies[0]?.current;
    expect(current).toEqual(
      expect.objectContaining({
        paidAmountMinor: 600,
        consumptionRecordCount: null,
        countAvailability: 'unavailable_incomplete_source',
      }),
    );
    expect(result.factResolution).toEqual(
      expect.objectContaining({ rejectedChainCount: 1 }),
    );

    const scopeMismatch = resolveAnalyticsStableConsumptionRecordGate({
      tenantId: 'tenant-other',
      institutionId,
      factResolution: resolve([fact('scope-payment')]),
    });
    expect(scopeMismatch).toEqual({ ok: false, reasonCode: 'scope_mismatch' });
  });

  it('可靠孤儿退款仍影响净额，但不把未知稳定消费单数写成零', () => {
    const result = gate([
      refund('orphan-only', {
        stableConsumptionRecordRef: 'consumption-orphan-only-001',
        refundLinkStatus: 'orphan_verified',
      }),
    ]);

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        currencies: [
          expect.objectContaining({
            currency: 'CNY',
            consumptionRecordCount: null,
            countAvailability: 'unavailable_unstable_reference',
            quality: expect.objectContaining({ orphanRefundCount: 1 }),
          }),
        ],
      }),
    });
  });
});
