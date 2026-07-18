import { describe, expect, it } from 'vitest';

import * as integrityDomain from '@/modules/institution-analytics/domain/analytics-data-integrity';
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

describe('经营分析候选完整性裁决', () => {
  it('不存在 authority factory，完整空集只能要求未来权威证据，不能显示 0', () => {
    const result = adjudicateAnalyticsDataIntegrity({
      partitions: [partition()],
    });

    expect(integrityDomain).not.toHaveProperty(
      'createAnalyticsDataIntegrityAuthorityContextForServerCompositionRoot',
    );
    expect(result).toEqual({
      ok: true,
      partitions: [
        {
          currency: 'CNY',
          availability: 'complete',
          financialFacts: 'unknown',
          zeroDisplay: 'authority_required',
          quality: {
            duplicateExcluded: 'unknown',
            orphanRefund: 'unknown',
            unmatchedCustomer: 'unknown',
            unmappedProject: 'unknown',
          },
        },
      ],
    });
  });

  it.each([
    ['unknown', 'withheld'],
    ['partial', 'withheld'],
    ['stale', 'withheld'],
    ['unavailable', 'withheld'],
  ] as const)(
    '%s 输入不会被候选裁决提升为可显示的 0',
    (sourceState, zeroDisplay) => {
      const result = adjudicateAnalyticsDataIntegrity({
        partitions: [partition({ sourceState, financialFacts: 'empty' })],
      });

      expect(result).toEqual({
        ok: true,
        partitions: [
          expect.objectContaining({
            currency: 'CNY',
            availability: sourceState,
            financialFacts: 'unknown',
            zeroDisplay,
          }),
        ],
      });
    },
  );

  it('不修改输入，重复裁决得到相同的冻结候选且不产出金额', () => {
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
    if (first.ok) {
      expect(Object.isFrozen(first.partitions)).toBe(true);
      expect(first.partitions[0]).not.toHaveProperty('amountMinor');
      expect(first.partitions[0]).not.toHaveProperty('paidAmountMinor');
      expect(first.partitions[0]).not.toHaveProperty('refundAmountMinor');
      expect(first.partitions[0]).not.toHaveProperty('netAmountMinor');
    }
  });
});
