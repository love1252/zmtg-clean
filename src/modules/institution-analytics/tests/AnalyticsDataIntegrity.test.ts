import { describe, expect, it } from 'vitest';

import {
  adjudicateAnalyticsDataIntegrity,
  createAnalyticsDataIntegrityAuthorityContextForServerCompositionRoot,
  type AnalyticsDataIntegrityAuthorityContext,
  type AnalyticsDataIntegrityInput,
} from '@/modules/institution-analytics/domain/analytics-data-integrity';

function partition(
  patch: Partial<AnalyticsDataIntegrityInput['partitions'][number]> = {},
): AnalyticsDataIntegrityInput['partitions'][number] {
  return {
    currency: 'CNY',
    sourceState: 'complete',
    financialFacts: 'empty',
    quality: {
      duplicateExcluded: 'absent',
      orphanRefund: 'absent',
      unmatchedCustomer: 'absent',
      unmappedProject: 'absent',
    },
    ...patch,
  };
}

describe('经营分析数据完整性裁决', () => {
  it('只有服务端组合根注入的权威上下文允许完整空集显示 0', () => {
    const input = { partitions: [partition()] };
    const authority =
      createAnalyticsDataIntegrityAuthorityContextForServerCompositionRoot();

    expect(adjudicateAnalyticsDataIntegrity(input)).toEqual({
      ok: true,
      partitions: [
        expect.objectContaining({
          availability: 'unknown',
          financialFacts: 'unknown',
          zeroDisplay: 'withheld',
          quality: {
            duplicateExcluded: 'unknown',
            orphanRefund: 'unknown',
            unmatchedCustomer: 'unknown',
            unmappedProject: 'unknown',
          },
        }),
      ],
    });

    const result = adjudicateAnalyticsDataIntegrity(input, authority);
    expect(result).toEqual({
      ok: true,
      partitions: [
        {
          currency: 'CNY',
          availability: 'complete',
          financialFacts: 'empty',
          zeroDisplay: 'allowed',
          quality: {
            duplicateExcluded: 'absent',
            orphanRefund: 'absent',
            unmatchedCustomer: 'absent',
            unmappedProject: 'absent',
          },
        },
      ],
    });

    const expanded = { ...authority } as AnalyticsDataIntegrityAuthorityContext;
    expect(adjudicateAnalyticsDataIntegrity(input, expanded)).toEqual(
      expect.objectContaining({
        ok: true,
        partitions: [expect.objectContaining({ zeroDisplay: 'withheld' })],
      }),
    );
  });

  it.each([
    ['unknown', 'unknown'],
    ['partial', 'partial'],
    ['stale', 'stale'],
    ['unavailable', 'unavailable'],
  ] as const)(
    '%s 不把输入声称的空集变成可显示的 0',
    (sourceState, availability) => {
      const result = adjudicateAnalyticsDataIntegrity(
        { partitions: [partition({ sourceState, financialFacts: 'empty' })] },
        createAnalyticsDataIntegrityAuthorityContextForServerCompositionRoot(),
      );

      expect(result).toEqual({
        ok: true,
        partitions: [
          expect.objectContaining({
            currency: 'CNY',
            availability,
            financialFacts: 'unknown',
            zeroDisplay: 'withheld',
          }),
        ],
      });
    },
  );

  it('不修改输入，重复裁决得到相同的冻结结果且不产出金额', () => {
    const input = {
      partitions: [
        partition({
          financialFacts: 'present',
          quality: {
            duplicateExcluded: 'present',
            orphanRefund: 'absent',
            unmatchedCustomer: 'present',
            unmappedProject: 'absent',
          },
        }),
      ],
    } satisfies AnalyticsDataIntegrityInput;
    const before = structuredClone(input);
    const authority =
      createAnalyticsDataIntegrityAuthorityContextForServerCompositionRoot();

    const first = adjudicateAnalyticsDataIntegrity(input, authority);
    const second = adjudicateAnalyticsDataIntegrity(input, authority);

    expect(input).toEqual(before);
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    if (first.ok) {
      expect(Object.isFrozen(first.partitions)).toBe(true);
      expect(first.partitions[0]).not.toHaveProperty('amountMinor');
      expect(first.partitions[0]).not.toHaveProperty('paidAmountMinor');
      expect(first.partitions[0]).not.toHaveProperty('refundAmountMinor');
      expect(first.partitions[0]).not.toHaveProperty('netAmountMinor');
    }
  });
});
