import { describe, expect, it, vi } from 'vitest';

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

describe('经营分析候选完整性分区', () => {
  it('按币种规范排序、不跨币种合并，所有质量信号保持候选 unknown', () => {
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
          financialFacts: 'unknown',
          zeroDisplay: 'authority_required',
          quality: {
            duplicateExcluded: 'unknown',
            orphanRefund: 'unknown',
            unmatchedCustomer: 'unknown',
            unmappedProject: 'unknown',
          },
        }),
        expect.objectContaining({
          currency: 'USD',
          availability: 'partial',
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
  });

  it('跨币种、时间或来源重放候选空集时永不产生 allowed', () => {
    for (const currency of ['CNY', 'USD', 'EUR']) {
      for (const replay of [
        'time-window-a',
        'time-window-b',
        'source-revision-a',
        'source-revision-b',
      ]) {
        const result = adjudicateAnalyticsDataIntegrity({
          partitions: [partition(currency, { financialFacts: 'empty' })],
        });
        expect(replay).toBeTruthy();
        expect(result).toEqual({
          ok: true,
          partitions: [
            expect.objectContaining({
              currency,
              financialFacts: 'unknown',
              zeroDisplay: 'authority_required',
            }),
          ],
        });
      }
    }
  });

  it('拒绝 accessor、Proxy、symbol/hidden/extra/null-prototype 与稀疏数组，且不触发 getter', () => {
    let getterReads = 0;
    const accessorInput = {};
    Object.defineProperty(accessorInput, 'partitions', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('must not read accessor');
      },
    });

    const throwingProxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('descriptor trap');
        },
      },
    );
    const transparentProxy = new Proxy({ partitions: [partition('CNY')] }, {});
    const symbolInput = {
      partitions: [partition('CNY')],
      [Symbol('hidden')]: true,
    };
    const hiddenInput = { partitions: [partition('CNY')] };
    Object.defineProperty(hiddenInput, 'hidden', { value: true });
    const extraInput = { partitions: [partition('CNY')], extra: true };
    const nullPrototypeInput = Object.assign(Object.create(null), {
      partitions: [partition('CNY')],
    });
    const sparsePartitions = [] as unknown[];
    sparsePartitions[1] = partition('CNY');

    expect(adjudicateAnalyticsDataIntegrity(accessorInput)).toEqual({
      ok: false,
      reasonCode: 'invalid_input',
    });
    expect(getterReads).toBe(0);
    expect(() => adjudicateAnalyticsDataIntegrity(throwingProxy)).not.toThrow();
    expect(adjudicateAnalyticsDataIntegrity(throwingProxy)).toEqual({
      ok: false,
      reasonCode: 'invalid_input',
    });
    expect(adjudicateAnalyticsDataIntegrity(transparentProxy)).toEqual({
      ok: false,
      reasonCode: 'invalid_input',
    });
    for (const input of [
      symbolInput,
      hiddenInput,
      extraInput,
      nullPrototypeInput,
    ]) {
      expect(adjudicateAnalyticsDataIntegrity(input)).toEqual({
        ok: false,
        reasonCode: 'invalid_input',
      });
    }
    expect(
      adjudicateAnalyticsDataIntegrity({ partitions: sparsePartitions }),
    ).toEqual({ ok: false, reasonCode: 'invalid_partition_set' });
  });

  it('超过固定币种分区上限时不读取元素 descriptor 或复制数组', () => {
    const oversized = [] as unknown[];
    oversized.length = Intl.supportedValuesOf('currency').length + 1;
    let getterReads = 0;
    Object.defineProperty(oversized, '0', {
      enumerable: true,
      get() {
        getterReads += 1;
        return partition('CNY');
      },
    });

    const originalGetOwnPropertyDescriptors = Object.getOwnPropertyDescriptors;
    let oversizedDescriptorReads = 0;
    const descriptorSpy = vi
      .spyOn(Object, 'getOwnPropertyDescriptors')
      .mockImplementation((value) => {
        if (value === oversized) oversizedDescriptorReads += 1;
        return originalGetOwnPropertyDescriptors(value);
      });
    try {
      expect(
        adjudicateAnalyticsDataIntegrity({ partitions: oversized }),
      ).toEqual({ ok: false, reasonCode: 'invalid_partition_set' });
      expect(getterReads).toBe(0);
      expect(oversizedDescriptorReads).toBe(0);
    } finally {
      descriptorSpy.mockRestore();
    }
  });

  it('缺少 Node Proxy detector 时整体 fail-closed', async () => {
    vi.resetModules();
    vi.doMock('node:util/types', () => ({
      default: { isProxy: undefined },
      isProxy: undefined,
    }));
    try {
      const isolatedDomain = await import(
        '@/modules/institution-analytics/domain/analytics-data-integrity'
      );
      expect(
        isolatedDomain.adjudicateAnalyticsDataIntegrity({
          partitions: [partition('CNY')],
        }),
      ).toEqual({ ok: false, reasonCode: 'invalid_input' });
    } finally {
      vi.doUnmock('node:util/types');
      vi.resetModules();
    }
  });

  it('对重复币种和非法分区 fail-closed，不制造空金额或默认币种', () => {
    expect(
      adjudicateAnalyticsDataIntegrity({
        partitions: [partition('CNY'), partition('CNY')],
      }),
    ).toEqual({ ok: false, reasonCode: 'duplicate_currency_partition' });

    expect(
      adjudicateAnalyticsDataIntegrity({
        partitions: [partition('cny')],
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_partition' });
  });
});
