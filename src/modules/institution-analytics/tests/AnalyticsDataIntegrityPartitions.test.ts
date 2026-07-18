import { describe, expect, it } from 'vitest';

import {
  adjudicateAnalyticsDataIntegrity,
  createAnalyticsDataIntegrityAuthorityContextForServerCompositionRoot,
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

const authority =
  createAnalyticsDataIntegrityAuthorityContextForServerCompositionRoot();

describe('经营分析完整性分区', () => {
  it('按币种规范排序、不跨币种合并，并在 partial 只保留可证明的正向质量信号', () => {
    const result = adjudicateAnalyticsDataIntegrity(
      {
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
      },
      authority,
    );

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
          quality: {
            duplicateExcluded: 'present',
            orphanRefund: 'unknown',
            unmatchedCustomer: 'unknown',
            unmappedProject: 'present',
          },
        }),
      ],
    });
  });

  it('将 unavailable 与未注入权威的四类质量信号全部降级为 unknown', () => {
    const quality = {
      duplicateExcluded: 'present',
      orphanRefund: 'present',
      unmatchedCustomer: 'present',
      unmappedProject: 'present',
    } as const;

    const unavailable = adjudicateAnalyticsDataIntegrity(
      {
        partitions: [
          partition('CNY', { sourceState: 'unavailable', quality }),
        ],
      },
      authority,
    );
    const candidate = adjudicateAnalyticsDataIntegrity({
      partitions: [partition('USD', { quality })],
    });

    for (const result of [unavailable, candidate]) {
      expect(result).toEqual({
        ok: true,
        partitions: [
          expect.objectContaining({
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
    }
  });

  it('拒绝 accessor、throwing Proxy、symbol/hidden/extra/null-prototype 与稀疏数组，且不触发 getter', () => {
    let getterReads = 0;
    const accessorInput = {};
    Object.defineProperty(accessorInput, 'partitions', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('must not read accessor');
      },
    });

    const proxy = new Proxy(
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

    expect(adjudicateAnalyticsDataIntegrity(accessorInput, authority)).toEqual({
      ok: false,
      reasonCode: 'invalid_input',
    });
    expect(getterReads).toBe(0);
    expect(() => adjudicateAnalyticsDataIntegrity(proxy, authority)).not.toThrow();
    expect(adjudicateAnalyticsDataIntegrity(proxy, authority)).toEqual({
      ok: false,
      reasonCode: 'invalid_input',
    });
    expect(adjudicateAnalyticsDataIntegrity(transparentProxy, authority)).toEqual({
      ok: false,
      reasonCode: 'invalid_input',
    });
    for (const input of [
      symbolInput,
      hiddenInput,
      extraInput,
      nullPrototypeInput,
    ]) {
      expect(adjudicateAnalyticsDataIntegrity(input, authority)).toEqual({
        ok: false,
        reasonCode: 'invalid_input',
      });
    }
    expect(
      adjudicateAnalyticsDataIntegrity({ partitions: sparsePartitions }, authority),
    ).toEqual({ ok: false, reasonCode: 'invalid_partition_set' });
  });

  it('对重复币种和非法分区 fail-closed，不制造空金额或默认币种', () => {
    expect(
      adjudicateAnalyticsDataIntegrity(
        { partitions: [partition('CNY'), partition('CNY')] },
        authority,
      ),
    ).toEqual({ ok: false, reasonCode: 'duplicate_currency_partition' });

    expect(
      adjudicateAnalyticsDataIntegrity(
        { partitions: [partition('cny')] },
        authority,
      ),
    ).toEqual({ ok: false, reasonCode: 'invalid_partition' });
  });
});
