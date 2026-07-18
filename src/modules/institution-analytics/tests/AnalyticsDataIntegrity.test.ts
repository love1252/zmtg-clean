import { describe, expect, it } from 'vitest';

import {
  adjudicateAnalyticsDataIntegrity,
  type AnalyticsDataIntegrityInput,
} from '@/modules/institution-analytics/domain/analytics-data-integrity';

function partition(
  patch: Partial<AnalyticsDataIntegrityInput['partitions'][number]> = {},
): AnalyticsDataIntegrityInput['partitions'][number] {
  return {
    currency: 'CNY',
    sourceState: 'complete',
    sourceIsAuthoritative: true,
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
  it('只在权威完整空集时允许消费者显示 0，且不产出金额', () => {
    const result = adjudicateAnalyticsDataIntegrity({
      partitions: [partition()],
    });

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
    if (!result.ok) throw new Error('expected valid integrity decision');
    expect(result.partitions[0]).not.toHaveProperty('amountMinor');
    expect(result.partitions[0]).not.toHaveProperty('paidAmountMinor');
    expect(result.partitions[0]).not.toHaveProperty('refundAmountMinor');
    expect(result.partitions[0]).not.toHaveProperty('netAmountMinor');
  });

  it.each([
    ['unknown', 'unknown'],
    ['partial', 'partial'],
    ['stale', 'stale'],
    ['unavailable', 'unavailable'],
  ] as const)(
    '%s 不把上游声称的空集变成可显示的 0',
    (sourceState, availability) => {
      const result = adjudicateAnalyticsDataIntegrity({
        partitions: [partition({ sourceState, financialFacts: 'empty' })],
      });

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

  it('非权威完整空集也 fail-closed，并保留四类质量信号的独立语义', () => {
    const result = adjudicateAnalyticsDataIntegrity({
      partitions: [
        partition({
          sourceIsAuthoritative: false,
          quality: {
            duplicateExcluded: 'present',
            orphanRefund: 'present',
            unmatchedCustomer: 'present',
            unmappedProject: 'present',
          },
        }),
      ],
    });

    expect(result).toEqual({
      ok: true,
      partitions: [
        {
          currency: 'CNY',
          availability: 'unknown',
          financialFacts: 'unknown',
          zeroDisplay: 'withheld',
          quality: {
            duplicateExcluded: 'present',
            orphanRefund: 'present',
            unmatchedCustomer: 'present',
            unmappedProject: 'present',
          },
        },
      ],
    });
  });

  it('不修改输入，重复裁决得到相同的冻结结果', () => {
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

    const first = adjudicateAnalyticsDataIntegrity(input);
    const second = adjudicateAnalyticsDataIntegrity(input);

    expect(input).toEqual(before);
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    if (first.ok) expect(Object.isFrozen(first.partitions)).toBe(true);
  });
});
