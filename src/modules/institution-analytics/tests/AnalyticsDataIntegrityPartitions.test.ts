import { describe, expect, it } from 'vitest';

import {
  adjudicateAnalyticsDataIntegrity,
  type AnalyticsDataIntegrityInput,
} from '@/modules/institution-analytics/domain/analytics-data-integrity';

function partition(
  currency: string,
  patch: Partial<AnalyticsDataIntegrityInput['partitions'][number]> = {},
): AnalyticsDataIntegrityInput['partitions'][number] {
  return {
    currency,
    sourceState: 'complete',
    sourceIsAuthoritative: true,
    financialFacts: 'present',
    quality: {
      duplicateExcluded: 'absent',
      orphanRefund: 'absent',
      unmatchedCustomer: 'absent',
      unmappedProject: 'absent',
    },
    ...patch,
  };
}

describe('经营分析完整性分区', () => {
  it('按币种输出规范排序且绝不跨币种合并', () => {
    const result = adjudicateAnalyticsDataIntegrity({
      partitions: [
        partition('USD', {
          sourceState: 'partial',
          quality: {
            duplicateExcluded: 'present',
            orphanRefund: 'absent',
            unmatchedCustomer: 'absent',
            unmappedProject: 'present',
          },
        }),
        partition('CNY', {
          financialFacts: 'empty',
          quality: {
            duplicateExcluded: 'absent',
            orphanRefund: 'present',
            unmatchedCustomer: 'present',
            unmappedProject: 'absent',
          },
        }),
      ],
    });

    expect(result).toEqual({
      ok: true,
      partitions: [
        expect.objectContaining({
          currency: 'CNY',
          availability: 'complete',
          financialFacts: 'empty',
          zeroDisplay: 'allowed',
          quality: expect.objectContaining({
            orphanRefund: 'present',
            unmatchedCustomer: 'present',
          }),
        }),
        expect.objectContaining({
          currency: 'USD',
          availability: 'partial',
          financialFacts: 'present',
          zeroDisplay: 'withheld',
          quality: expect.objectContaining({
            duplicateExcluded: 'present',
            unmappedProject: 'present',
          }),
        }),
      ],
    });
  });

  it('对重复币种和非法分区 fail-closed，不制造空金额或默认币种', () => {
    expect(
      adjudicateAnalyticsDataIntegrity({
        partitions: [partition('CNY'), partition('CNY')],
      }),
    ).toEqual({ ok: false, reasonCode: 'duplicate_currency_partition' });

    expect(
      adjudicateAnalyticsDataIntegrity({
        partitions: [
          partition('cny'),
        ] as unknown as AnalyticsDataIntegrityInput['partitions'],
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_partition' });

    expect(
      adjudicateAnalyticsDataIntegrity({ partitions: [] }),
    ).toEqual({ ok: false, reasonCode: 'invalid_partition_set' });
  });

  it('从分区中隔离 stale 与 unavailable，不让它们污染另一币种的裁决', () => {
    const result = adjudicateAnalyticsDataIntegrity({
      partitions: [
        partition('CNY', { sourceState: 'stale', financialFacts: 'empty' }),
        partition('USD', {
          sourceState: 'unavailable',
          financialFacts: 'empty',
        }),
        partition('EUR', { financialFacts: 'empty' }),
      ],
    });

    expect(result).toEqual({
      ok: true,
      partitions: [
        expect.objectContaining({
          currency: 'CNY',
          availability: 'stale',
          financialFacts: 'unknown',
          zeroDisplay: 'withheld',
        }),
        expect.objectContaining({
          currency: 'EUR',
          availability: 'complete',
          financialFacts: 'empty',
          zeroDisplay: 'allowed',
        }),
        expect.objectContaining({
          currency: 'USD',
          availability: 'unavailable',
          financialFacts: 'unknown',
          zeroDisplay: 'withheld',
        }),
      ],
    });
  });
});
