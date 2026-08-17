import { describe, expect, it, vi } from 'vitest';

import {
  createAnalyticsOverviewReaderV1,
} from '@/modules/institution-analytics/application/institution/analytics-overview-reader';
import type {
  InstitutionAnalyticsOverviewSourceRowV1,
} from '@/modules/institution-analytics/ports/institution-analytics-overview-source';

const tenantId = 'growth-tenant-chengxing';
const institutionId = 'growth-inst-chengxing';

function row(
  overrides: Partial<InstitutionAnalyticsOverviewSourceRowV1> = {},
): InstitutionAnalyticsOverviewSourceRowV1 {
  return {
    tenantId,
    institutionId,
    sourceId: 'source-1',
    batchOrConnectionRef: 'batch-1',
    sourceRecordRef: 'record-1',
    eventFamily: 'payment',
    sourceRevision: '1',
    supersedesSourceRevision: null,
    eventType: 'payment_succeeded',
    eventAt: new Date('2026-08-05T03:00:00.000Z'),
    receivedAt: new Date('2026-08-05T03:01:00.000Z'),
    amountMinor: 10_000,
    currency: 'CNY',
    stableConsumptionRecordRef: 'stable-1',
    customerAttributionStatus: 'matched',
    customerId: 'customer-1',
    customerCandidateReference: null,
    projectAttributionStatus: 'mapped',
    hisDirectoryVersion: 'directory-v1',
    canonicalProjectId: 'project-1',
    projectCandidateReference: null,
    refundLinkStatus: 'not_applicable',
    ...overrides,
  };
}

function makeReader(rows: readonly InstitutionAnalyticsOverviewSourceRowV1[]) {
  return createAnalyticsOverviewReaderV1({
    source: Object.freeze({
      listFacts: vi.fn().mockResolvedValue(rows),
    }),
  });
}

const input = Object.freeze({
  tenantId,
  institutionId,
  timeZone: 'Asia/Shanghai',
  defaultCurrency: 'CNY',
  asOf: '2026-08-17T01:00:00.000Z',
});

describe('Analytics overview formal runtime', () => {
  it('权威空 cohort 返回 empty，不伪造 0 指标卡', async () => {
    const result = await makeReader([]).read(input);

    expect(result).toEqual({
      kind: 'ready',
      overview: {
        contractVersion: 'v1',
        preset: 'month',
        comparisonMode: 'previous_equal_length_period',
        timeZone: 'Asia/Shanghai',
        defaultCurrency: 'CNY',
        asOfBusinessDate: '2026-08-17',
        currentPeriod: {
          startDate: '2026-08-01',
          endDateExclusive: '2026-08-18',
          localDayCount: 17,
        },
        previousPeriod: {
          startDate: '2026-07-15',
          endDateExclusive: '2026-08-01',
          localDayCount: 17,
        },
        dataState: 'empty',
        currencies: [],
      },
    });
  });

  it('同币种按正式支付退款事实确定性计算五项指标', async () => {
    const rows = [
      row(),
      row({
        sourceRecordRef: 'refund-1',
        eventFamily: 'refund',
        eventType: 'refund_confirmed',
        eventAt: new Date('2026-08-06T03:00:00.000Z'),
        receivedAt: new Date('2026-08-06T03:01:00.000Z'),
        amountMinor: 2_000,
        stableConsumptionRecordRef: 'stable-1',
        refundLinkStatus: 'linked',
      }),
      row({
        sourceRecordRef: 'previous-1',
        eventAt: new Date('2026-07-20T03:00:00.000Z'),
        receivedAt: new Date('2026-07-20T03:01:00.000Z'),
        amountMinor: 5_000,
        stableConsumptionRecordRef: 'stable-2',
        customerId: 'customer-2',
      }),
    ];

    const result = await makeReader(rows).read(input);
    expect(result.kind).toBe('ready');
    if (result.kind !== 'ready') return;

    expect(result.overview.dataState).toBe('ready');
    expect(result.overview.currencies).toHaveLength(1);
    expect(result.overview.currencies[0]).toMatchObject({
      currency: 'CNY',
      current: {
        availability: 'available',
        paidAmountMinor: 10_000,
        refundAmountMinor: 2_000,
        netAmountMinor: 8_000,
        paidCustomerCount: 1,
        averageNetAmountPerPaidCustomer: {
          numeratorMinor: 8_000,
          denominator: 1,
        },
      },
      previous: {
        availability: 'available',
        paidAmountMinor: 5_000,
        refundAmountMinor: 0,
        netAmountMinor: 5_000,
        paidCustomerCount: 1,
      },
    });
  });

  it('跨机构来源行 fail-closed', async () => {
    await expect(
      makeReader([row({ institutionId: 'other-institution' })]).read(input),
    ).resolves.toEqual({ kind: 'unavailable' });
  });

  it('超过 10000 行时不发布不完整聚合', async () => {
    const rows = Array.from({ length: 10_001 }, () => row());
    await expect(makeReader(rows).read(input)).resolves.toEqual({
      kind: 'unavailable',
    });
  });
});
