import { describe, expect, it } from 'vitest';

import {
  resolveAnalyticsConsumptionFacts,
  type AnalyticsConsumptionFactInput,
} from '@/modules/institution-analytics/domain/analytics-consumption-facts';

const baseFact = {
  tenantId: 'tenant-analytics-001',
  institutionId: 'institution-analytics-001',
  source: 'approved-source',
  sourceRecordRef: 'source-record-safe-001',
  sourceRevision: 'revision-root',
  supersedesSourceRevision: null,
  eventType: 'payment_succeeded',
  eventAt: '2026-07-17T02:00:00.000Z',
  receivedAt: '2026-07-17T02:01:00.000Z',
  batchOrConnectionRef: 'connection-safe-001',
  amountMinor: 10_000,
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

const inputScopes = [
  {
    tenantId: baseFact.tenantId,
    institutionId: baseFact.institutionId,
  },
] as const;

function fact(
  patch: Partial<AnalyticsConsumptionFactInput> = {},
): AnalyticsConsumptionFactInput {
  return {
    ...baseFact,
    ...patch,
  };
}

function refundFact(
  patch: Partial<AnalyticsConsumptionFactInput> = {},
): AnalyticsConsumptionFactInput {
  return fact({
    sourceRecordRef: 'refund-source-safe-001',
    eventType: 'refund_confirmed',
    refundLinkStatus: 'linked',
    ...patch,
  });
}

describe('经营分析消费事实解析', () => {
  it('只保留最终成功实付和确认退款，pending/failed/cancelled 最终态不计金额', () => {
    const result = resolveAnalyticsConsumptionFacts([
      fact({ sourceRecordRef: 'payment-success' }),
      refundFact({ sourceRecordRef: 'refund-confirmed' }),
      fact({ sourceRecordRef: 'payment-pending', eventType: 'payment_pending' }),
      fact({ sourceRecordRef: 'payment-failed', eventType: 'payment_failed' }),
      fact({ sourceRecordRef: 'payment-cancelled', eventType: 'payment_cancelled' }),
      refundFact({ sourceRecordRef: 'refund-pending', eventType: 'refund_pending' }),
      refundFact({ sourceRecordRef: 'refund-failed', eventType: 'refund_failed' }),
      refundFact({ sourceRecordRef: 'refund-cancelled', eventType: 'refund_cancelled' }),
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'complete',
        excludedFinalStateCount: 6,
      }),
    );
    if (!result.ok) throw new Error('expected resolved facts');
    expect(result.effectiveFacts.map((item) => item.eventType).sort()).toEqual([
      'payment_succeeded',
      'refund_confirmed',
    ]);
  });

  it.each([
    ['zero amount', { amountMinor: 0 }, 'invalid_amount_minor'],
    ['negative amount', { amountMinor: -1 }, 'invalid_amount_minor'],
    ['fractional amount', { amountMinor: 1.5 }, 'invalid_amount_minor'],
    ['unsafe amount', { amountMinor: Number.MAX_SAFE_INTEGER + 1 }, 'invalid_amount_minor'],
    ['lowercase currency', { currency: 'cny' }, 'invalid_currency'],
    ['unknown currency', { currency: 'ZZZ' }, 'invalid_currency'],
    ['instant without offset', { eventAt: '2026-07-17T10:00:00' }, 'invalid_event_at'],
    ['invalid calendar instant', { eventAt: '2026-02-30T10:00:00Z' }, 'invalid_event_at'],
    [
      'instant before supported UTC year',
      { eventAt: '1000-01-01T00:00:00+14:00' },
      'invalid_event_at',
    ],
    [
      'instant after supported UTC year',
      { eventAt: '9999-12-31T23:59:59-14:00' },
      'invalid_event_at',
    ],
    ['blank trace reference', { sourceRevision: ' ' }, 'invalid_required_reference'],
  ] as const)(
    '对 %s fail-closed',
    (_label, patch, reasonCode) => {
      const result = resolveAnalyticsConsumptionFacts([
        fact(patch as Partial<AnalyticsConsumptionFactInput>),
      ]);

      expect(result).toEqual({
        ok: false,
        status: 'rejected',
        inputScopes: [],
        effectiveFacts: [],
        replayedFactCount: 0,
        excludedFinalStateCount: 0,
        rejectedChainCount: 0,
        issues: [{ reasonCode, count: 1 }],
      });
    },
  );

  it('混合非法行时保留无关合法链并返回固定低敏 issue', () => {
    const forbiddenInvalidRowRef = 'raw-invalid-row-do-not-return';
    const result = resolveAnalyticsConsumptionFacts([
      fact({ sourceRecordRef: 'valid-payment-chain-a', amountMinor: 800 }),
      fact({
        sourceRecordRef: forbiddenInvalidRowRef,
        amountMinor: 0,
      }),
      refundFact({ sourceRecordRef: 'valid-refund-chain-b', amountMinor: 200 }),
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'partial',
        effectiveFacts: [
          expect.objectContaining({ eventType: 'payment_succeeded', amountMinor: 800 }),
          expect.objectContaining({ eventType: 'refund_confirmed', amountMinor: 200 }),
        ],
        rejectedChainCount: 1,
        issues: [{ reasonCode: 'invalid_amount_minor', count: 1 }],
      }),
    );
    expect(JSON.stringify(result)).not.toContain(forbiddenInvalidRowRef);
  });

  it('全部输入均非法时仍整批 rejected', () => {
    const result = resolveAnalyticsConsumptionFacts([
      fact({ sourceRecordRef: 'invalid-amount-row', amountMinor: 0 }),
      fact({ sourceRecordRef: 'invalid-currency-row', currency: 'cny' }),
    ]);

    expect(result).toEqual({
      ok: false,
      status: 'rejected',
      inputScopes: [],
      effectiveFacts: [],
      replayedFactCount: 0,
      excludedFinalStateCount: 0,
      rejectedChainCount: 0,
      issues: [
        { reasonCode: 'invalid_amount_minor', count: 1 },
        { reasonCode: 'invalid_currency', count: 1 },
      ],
    });
  });

  it('非法 correction 隔离受影响链但不清空无关合法链', () => {
    const affectedRoot = fact({
      sourceRecordRef: 'affected-chain',
      sourceRevision: 'affected-root',
      amountMinor: 500,
    });
    const invalidCorrection = fact({
      sourceRecordRef: 'affected-chain',
      sourceRevision: 'affected-leaf',
      supersedesSourceRevision: 'affected-root',
      amountMinor: 0,
    });
    const unrelated = fact({
      sourceRecordRef: 'unrelated-valid-chain',
      amountMinor: 700,
    });

    const result = resolveAnalyticsConsumptionFacts([
      affectedRoot,
      invalidCorrection,
      unrelated,
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'partial',
        effectiveFacts: [expect.objectContaining({ amountMinor: 700 })],
        rejectedChainCount: 1,
        issues: [{ reasonCode: 'invalid_amount_minor', count: 1 }],
      }),
    );
  });

  it('非法事件类型 correction 按来源记录隔离旧 root', () => {
    const affectedRoot = fact({
      sourceRecordRef: 'invalid-event-affected-chain',
      sourceRevision: 'invalid-event-root',
      amountMinor: 500,
    });
    const invalidCorrection = {
      ...fact({
        sourceRecordRef: 'invalid-event-affected-chain',
        sourceRevision: 'invalid-event-leaf',
        supersedesSourceRevision: 'invalid-event-root',
        amountMinor: 700,
      }),
      eventType: 'payment_reversed',
    } as unknown as AnalyticsConsumptionFactInput;
    const unrelated = fact({
      sourceRecordRef: 'invalid-event-unrelated-chain',
      amountMinor: 900,
    });

    const result = resolveAnalyticsConsumptionFacts([
      affectedRoot,
      invalidCorrection,
      unrelated,
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'partial',
        effectiveFacts: [expect.objectContaining({ amountMinor: 900 })],
        rejectedChainCount: 1,
        issues: [{ reasonCode: 'invalid_event_type', count: 1 }],
      }),
    );
  });

  it('跨 payment/refund family correction 不回退旧事实', () => {
    const result = resolveAnalyticsConsumptionFacts([
      fact({
        sourceRecordRef: 'cross-family-chain',
        sourceRevision: 'cross-family-root',
        amountMinor: 500,
      }),
      refundFact({
        sourceRecordRef: 'cross-family-chain',
        sourceRevision: 'cross-family-leaf',
        supersedesSourceRevision: 'cross-family-root',
        amountMinor: 200,
      }),
      fact({ sourceRecordRef: 'cross-family-unrelated', amountMinor: 800 }),
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'partial',
        effectiveFacts: [expect.objectContaining({ amountMinor: 800 })],
        rejectedChainCount: 2,
        issues: [{ reasonCode: 'revision_chain_broken', count: 1 }],
      }),
    );
  });

  it('混合输入失败与断链时合并并稳定排序低敏 issues', () => {
    const result = resolveAnalyticsConsumptionFacts([
      fact({ sourceRecordRef: 'combined-valid-chain', amountMinor: 600 }),
      fact({ sourceRecordRef: 'combined-invalid-row', amountMinor: 0 }),
      fact({
        sourceRecordRef: 'combined-broken-chain',
        sourceRevision: 'combined-broken-leaf',
        supersedesSourceRevision: 'combined-missing-root',
      }),
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'partial',
        effectiveFacts: [expect.objectContaining({ amountMinor: 600 })],
        rejectedChainCount: 2,
        issues: [
          { reasonCode: 'invalid_amount_minor', count: 1 },
          { reasonCode: 'revision_chain_broken', count: 1 },
        ],
      }),
    );
  });

  it('接受微秒/纳秒 instant 并保留规范化后的有效精度', () => {
    const result = resolveAnalyticsConsumptionFacts([
      fact({ eventAt: '2026-07-17T10:00:00.123456Z' }),
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        effectiveFacts: [
          expect.objectContaining({ eventAt: '2026-07-17T10:00:00.123456Z' }),
        ],
      }),
    );
  });

  it('等价 offset instant 可重放，亚毫秒差异仍判为业务冲突', () => {
    const equivalent = resolveAnalyticsConsumptionFacts([
      fact({ eventAt: '2026-07-17T10:00:00.123400+08:00' }),
      fact({
        eventAt: '2026-07-17T02:00:00.1234Z',
        receivedAt: '2026-07-17T03:00:00.000Z',
        batchOrConnectionRef: 'equivalent-instant-replay',
      }),
    ]);
    expect(equivalent).toEqual(
      expect.objectContaining({
        ok: true,
        replayedFactCount: 1,
        effectiveFacts: [
          expect.objectContaining({ eventAt: '2026-07-17T02:00:00.1234Z' }),
        ],
      }),
    );

    const distinctNanoseconds = resolveAnalyticsConsumptionFacts([
      fact({ eventAt: '2026-07-17T02:00:00.123456001Z' }),
      fact({
        eventAt: '2026-07-17T02:00:00.123456002Z',
        receivedAt: '2026-07-17T03:00:00.000Z',
      }),
    ]);
    expect(distinctNanoseconds).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'partial',
        effectiveFacts: [],
        replayedFactCount: 0,
        rejectedChainCount: 1,
        issues: [{ reasonCode: 'conflicting_replay', count: 1 }],
      }),
    );
  });

  it('按机构+来源+记录+revision+事件类型折叠跨批次重放', () => {
    const original = fact();
    const replay = fact({
      receivedAt: '2026-07-17T03:00:00.000Z',
      batchOrConnectionRef: 'batch-safe-replay-002',
    });
    const result = resolveAnalyticsConsumptionFacts([original, replay]);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'complete',
        replayedFactCount: 1,
        effectiveFacts: [expect.objectContaining({ amountMinor: 10_000 })],
      }),
    );
  });

  it('同一幂等 identity 的业务材料冲突时整链不计', () => {
    const result = resolveAnalyticsConsumptionFacts([
      fact(),
      fact({ amountMinor: 10_001, receivedAt: '2026-07-17T03:00:00.000Z' }),
    ]);

    expect(result).toEqual({
      ok: true,
      status: 'partial',
      inputScopes,
      effectiveFacts: [],
      replayedFactCount: 0,
      excludedFinalStateCount: 0,
      rejectedChainCount: 1,
      issues: [{ reasonCode: 'conflicting_replay', count: 1 }],
    });
  });

  it('冲突重放质量统计与输入排列无关', () => {
    const variantA = fact({ amountMinor: 10_000 });
    const variantB = fact({
      amountMinor: 10_001,
      receivedAt: '2026-07-17T03:00:00.000Z',
      batchOrConnectionRef: 'conflict-variant-b-first',
    });
    const variantBReplay = fact({
      amountMinor: 10_001,
      receivedAt: '2026-07-17T04:00:00.000Z',
      batchOrConnectionRef: 'conflict-variant-b-replay',
    });
    const permutations = [
      [variantA, variantB, variantBReplay],
      [variantB, variantBReplay, variantA],
      [variantBReplay, variantA, variantB],
    ];

    const results = permutations.map((inputs) =>
      resolveAnalyticsConsumptionFacts(inputs),
    );
    for (const result of results) {
      expect(result).toEqual({
        ok: true,
        status: 'partial',
        inputScopes,
        effectiveFacts: [],
        replayedFactCount: 0,
        excludedFinalStateCount: 0,
        rejectedChainCount: 1,
        issues: [{ reasonCode: 'conflicting_replay', count: 1 }],
      });
    }
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
  });

  it('只沿显式 predecessor 采用唯一叶 revision，不按数组顺序或 revision 文本猜测', () => {
    const root = fact({ sourceRevision: 'revision-z-root', amountMinor: 10_000 });
    const correction = fact({
      sourceRevision: 'revision-a-correction',
      supersedesSourceRevision: 'revision-z-root',
      amountMinor: 12_500,
    });

    const forward = resolveAnalyticsConsumptionFacts([root, correction]);
    const reversed = resolveAnalyticsConsumptionFacts([correction, root]);

    expect(forward).toEqual(reversed);
    expect(forward).toEqual(
      expect.objectContaining({
        ok: true,
        effectiveFacts: [expect.objectContaining({ amountMinor: 12_500 })],
      }),
    );
  });

  it('支持 pending→success 与 success→cancelled 的显式状态纠正', () => {
    const result = resolveAnalyticsConsumptionFacts([
      fact({
        sourceRecordRef: 'payment-event-a',
        sourceRevision: 'a-root',
        eventType: 'payment_pending',
      }),
      fact({
        sourceRecordRef: 'payment-event-a',
        sourceRevision: 'a-leaf',
        supersedesSourceRevision: 'a-root',
        eventType: 'payment_succeeded',
      }),
      fact({
        sourceRecordRef: 'payment-event-b',
        sourceRevision: 'b-root',
        eventType: 'payment_succeeded',
      }),
      fact({
        sourceRecordRef: 'payment-event-b',
        sourceRevision: 'b-leaf',
        supersedesSourceRevision: 'b-root',
        eventType: 'payment_cancelled',
      }),
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        excludedFinalStateCount: 1,
        effectiveFacts: [expect.objectContaining({ eventType: 'payment_succeeded' })],
      }),
    );
  });

  it.each([
    [
      '断链',
      [fact({ sourceRevision: 'leaf', supersedesSourceRevision: 'missing' })],
      'revision_chain_broken',
    ],
    [
      '分叉',
      [
        fact({ sourceRevision: 'root' }),
        fact({ sourceRevision: 'child-a', supersedesSourceRevision: 'root' }),
        fact({ sourceRevision: 'child-b', supersedesSourceRevision: 'root' }),
      ],
      'revision_chain_forked',
    ],
    [
      '成环',
      [
        fact({ sourceRevision: 'cycle-a', supersedesSourceRevision: 'cycle-b' }),
        fact({ sourceRevision: 'cycle-b', supersedesSourceRevision: 'cycle-a' }),
      ],
      'revision_chain_cycle',
    ],
  ] as const)('%s 时整条纠正链 fail-closed', (_label, inputs, reasonCode) => {
    const result = resolveAnalyticsConsumptionFacts(inputs);

    expect(result).toEqual({
      ok: true,
      status: 'partial',
      inputScopes,
      effectiveFacts: [],
      replayedFactCount: 0,
      excludedFinalStateCount: 0,
      rejectedChainCount: 1,
      issues: [{ reasonCode, count: 1 }],
    });
  });

  it('缺稳定消费单引用不丢弃可靠金额事实', () => {
    const result = resolveAnalyticsConsumptionFacts([
      fact({ stableConsumptionRecordRef: null }),
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        effectiveFacts: [
          expect.objectContaining({
            amountMinor: 10_000,
            stableConsumptionRecordRef: null,
          }),
        ],
      }),
    );
  });

  it('可靠孤儿退款可同时具有机构内安全稳定消费单引用', () => {
    const result = resolveAnalyticsConsumptionFacts([
      refundFact({
        refundLinkStatus: 'orphan_verified',
        stableConsumptionRecordRef: 'consumption-safe-orphan-refund-001',
      }),
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        effectiveFacts: [
          expect.objectContaining({
            eventType: 'refund_confirmed',
            refundLinkStatus: 'orphan_verified',
            stableConsumptionRecordRef: 'consumption-safe-orphan-refund-001',
          }),
        ],
      }),
    );
  });

  it('客户与项目 pending_review 保留统一安全候选引用', () => {
    const result = resolveAnalyticsConsumptionFacts([
      fact({
        customerAttribution: {
          status: 'pending_review',
          candidateReference: 'candidate-customer-safe-001',
        },
        projectAttribution: {
          status: 'pending_review',
          candidateReference: 'candidate-project-safe-001',
        },
      }),
    ]);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        effectiveFacts: [
          expect.objectContaining({
            customerAttribution: {
              status: 'pending_review',
              candidateReference: 'candidate-customer-safe-001',
            },
            projectAttribution: {
              status: 'pending_review',
              candidateReference: 'candidate-project-safe-001',
            },
          }),
        ],
      }),
    );
  });

  it.each([
    [
      '客户候选',
      {
        customerAttribution: {
          status: 'pending_review',
          candidateReference: 'unsafe/customer-reference',
        },
      },
      'invalid_customer_attribution',
      'unsafe/customer-reference',
    ],
    [
      '项目候选',
      {
        projectAttribution: {
          status: 'pending_review',
          candidateReference: 'unsafe@project-reference',
        },
      },
      'invalid_project_attribution',
      'unsafe@project-reference',
    ],
  ] as const)(
    '%s引用不满足内部低敏格式时拒绝且不回显原值',
    (_label, patch, reasonCode, forbiddenValue) => {
      const result = resolveAnalyticsConsumptionFacts([
        fact(patch as Partial<AnalyticsConsumptionFactInput>),
      ]);

      expect(result).toEqual(
        expect.objectContaining({
          ok: false,
          status: 'rejected',
          issues: [{ reasonCode, count: 1 }],
        }),
      );
      expect(JSON.stringify(result)).not.toContain(forbiddenValue);
    },
  );

  it('不修改输入且对输入排列给出确定结果', () => {
    const inputs = [
      fact({ sourceRecordRef: 'record-b' }),
      refundFact({ sourceRecordRef: 'record-a', amountMinor: 2_000 }),
      fact({ sourceRecordRef: 'record-c', eventType: 'payment_failed' }),
    ];
    const before = structuredClone(inputs);

    const forward = resolveAnalyticsConsumptionFacts(inputs);
    const reversed = resolveAnalyticsConsumptionFacts([...inputs].reverse());

    expect(inputs).toEqual(before);
    expect(forward).toEqual(reversed);
  });

  it('解析结果不回显来源记录、revision、批次或原支付标识', () => {
    const forbiddenSourceRecord = 'original-payment-number-raw-7788';
    const forbiddenRevision = 'original-refund-number-raw-9911';
    const forbiddenBatch = 'provider-payload-with-secret-marker';
    const result = resolveAnalyticsConsumptionFacts([
      fact({
        sourceRecordRef: forbiddenSourceRecord,
        sourceRevision: forbiddenRevision,
        batchOrConnectionRef: forbiddenBatch,
      }),
    ]);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(forbiddenSourceRecord);
    expect(serialized).not.toContain(forbiddenRevision);
    expect(serialized).not.toContain(forbiddenBatch);
    expect(serialized).not.toMatch(/sourceRecordRef|sourceRevision|batchOrConnectionRef/iu);
  });

  it('仅保留白名单字段并丢弃客户姓名、联系方式、自由文本和 provider payload', () => {
    const forbiddenValues = [
      '张三',
      '13800001111',
      'untrusted-free-text',
      'provider-secret-payload',
    ];
    const poisonedInput = {
      ...fact(),
      customerAttribution: {
        status: 'matched',
        customerId: 'customer-safe-001',
        customerName: forbiddenValues[0],
        customerPhone: forbiddenValues[1],
      },
      freeText: forbiddenValues[2],
      providerPayload: { raw: forbiddenValues[3] },
    } as unknown as AnalyticsConsumptionFactInput;

    const serialized = JSON.stringify(
      resolveAnalyticsConsumptionFacts([poisonedInput]),
    );

    for (const value of forbiddenValues) {
      expect(serialized).not.toContain(value);
    }
    expect(serialized).not.toMatch(
      /customerName|customerPhone|freeText|providerPayload/iu,
    );
  });
});
