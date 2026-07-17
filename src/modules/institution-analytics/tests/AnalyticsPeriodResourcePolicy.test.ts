import { describe, expect, it } from 'vitest';

import {
  resolveAnalyticsPeriodBuckets,
  validateAnalyticsPeriodBucketSequence,
  type AnalyticsPeriodBucketRequest,
} from '@/modules/institution-analytics/domain/analytics-period-buckets';
import {
  ANALYTICS_PERIOD_RESOURCE_POLICY,
  evaluateAnalyticsCustomPeriodResourceBudget,
  resolveAnalyticsCustomPeriodResourceBudget,
} from '@/modules/institution-analytics/domain/analytics-period-resource-policy';
import {
  resolveAnalyticsPeriod,
  type AnalyticsPeriodPair,
  type AnalyticsPeriodRequest,
  type AnalyticsPeriodWindow,
} from '@/modules/institution-analytics/domain/analytics-periods';

function period(request: AnalyticsPeriodRequest): AnalyticsPeriodPair {
  const result = resolveAnalyticsPeriod(request);
  if (!result.ok) throw new Error(result.reasonCode);
  return result.value;
}

function bucketResult(request: AnalyticsPeriodBucketRequest) {
  return resolveAnalyticsPeriodBuckets(request);
}

function customPeriod(input: {
  readonly timeZone?: string;
  readonly startDate: string;
  readonly endDateInclusive: string;
  readonly asOf?: string;
}) {
  return period({
    preset: 'custom',
    timeZone: input.timeZone ?? 'Asia/Shanghai',
    asOf: input.asOf ?? '2026-07-17T04:00:00.000Z',
    startDate: input.startDate,
    endDateInclusive: input.endDateInclusive,
  });
}

const allCustomGranularities = Object.freeze({
  allowedGranularities: Object.freeze(['day', 'week', 'month'] as const),
});

describe('经营分析期间资源策略', () => {
  it('冻结不可由调用者覆盖的 366 日与 366 桶硬上限', () => {
    expect(ANALYTICS_PERIOD_RESOURCE_POLICY).toEqual({
      maxLocalDayCount: 366,
      maxBucketCount: 366,
    });
    expect(Object.isFrozen(ANALYTICS_PERIOD_RESOURCE_POLICY)).toBe(true);
    expect(Object.keys(ANALYTICS_PERIOD_RESOURCE_POLICY).sort()).toEqual([
      'maxBucketCount',
      'maxLocalDayCount',
    ]);
  });

  it('日数和桶数正好等于上限时通过，超过一项即 fail-closed', () => {
    expect(
      evaluateAnalyticsCustomPeriodResourceBudget({
        localDayCount: 365,
        projectedBucketCount: 365,
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateAnalyticsCustomPeriodResourceBudget({
        localDayCount: 366,
        projectedBucketCount: 366,
      }),
    ).toEqual({ ok: true });
    expect(
      evaluateAnalyticsCustomPeriodResourceBudget({
        localDayCount: 367,
        projectedBucketCount: 1,
      }),
    ).toEqual({
      ok: false,
      reasonCode: 'custom_period_local_day_limit_exceeded',
    });
    expect(
      evaluateAnalyticsCustomPeriodResourceBudget({
        localDayCount: 366,
        projectedBucketCount: 367,
      }),
    ).toEqual({
      ok: false,
      reasonCode: 'period_bucket_count_limit_exceeded',
    });
  });

  it.each([
    ['零日', { localDayCount: 0, projectedBucketCount: 1 }],
    ['负数', { localDayCount: -1, projectedBucketCount: 1 }],
    ['小数', { localDayCount: 1.5, projectedBucketCount: 1 }],
    ['非有限数', { localDayCount: 1, projectedBucketCount: Number.POSITIVE_INFINITY }],
    ['非安全整数', { localDayCount: Number.MAX_SAFE_INTEGER + 1, projectedBucketCount: 1 }],
  ])('%s资源计数固定拒绝', (_label, input) => {
    expect(evaluateAnalyticsCustomPeriodResourceBudget(input)).toEqual({
      ok: false,
      reasonCode: 'invalid_period_window',
    });
  });

  it.each([
    ['day', '2026-01-01', '2026-01-10', 9],
    ['week', '2026-01-05', '2026-01-12', 1],
    ['week', '2026-01-06', '2026-01-13', 2],
    ['month', '2026-01-01', '2026-02-01', 1],
    ['month', '2026-01-31', '2026-02-02', 2],
  ] as const)(
    '%s 按首尾裁切后的本地日历边界投影 %s 桶',
    (granularity, startDate, endDateExclusive, projectedBucketCount) => {
      const start = Date.parse(`${startDate}T00:00:00.000Z`);
      const end = Date.parse(`${endDateExclusive}T00:00:00.000Z`);
      const window: AnalyticsPeriodWindow = {
        timeZone: 'Asia/Shanghai',
        startDate,
        endDateExclusive,
        localDayCount: (end - start) / 86_400_000,
      };

      expect(
        resolveAnalyticsCustomPeriodResourceBudget({ window, granularity }),
      ).toEqual({ ok: true, projectedBucketCount });
    },
  );
});

describe('经营分析 custom 资源门禁集成', () => {
  const underLimit = customPeriod({
    startDate: '2025-01-01',
    endDateInclusive: '2025-12-31',
  });
  const leapYear = customPeriod({
    startDate: '2024-01-01',
    endDateInclusive: '2024-12-31',
  });
  const overLimit = customPeriod({
    startDate: '2024-01-01',
    endDateInclusive: '2025-01-01',
  });

  it.each([
    ['day', 365],
    ['week', 53],
    ['month', 12],
  ] as const)('365 个本地日 %s 粒度预投影并实际生成 %s 桶', (granularity, count) => {
    expect(
      resolveAnalyticsCustomPeriodResourceBudget({
        window: underLimit.current,
        granularity,
      }),
    ).toEqual({ ok: true, projectedBucketCount: count });

    const result = bucketResult({
      period: underLimit,
      side: 'current',
      granularity,
      customPolicy: allCustomGranularities,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reasonCode);
    expect(result.series.buckets).toHaveLength(count);
  });

  it.each([
    ['day', 366],
    ['week', 53],
    ['month', 12],
  ] as const)('完整闰年 %s 粒度预投影 %s 桶', (granularity, count) => {
    expect(
      resolveAnalyticsCustomPeriodResourceBudget({
        window: leapYear.current,
        granularity,
      }),
    ).toEqual({ ok: true, projectedBucketCount: count });

    const result = bucketResult({
      period: leapYear,
      side: 'current',
      granularity,
      customPolicy: allCustomGranularities,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reasonCode);
    expect(result.series.buckets).toHaveLength(count);
  });

  it('完整闰年 day 粒度生成 366 桶，current 与 previous 分别消费预算', () => {
    for (const side of ['current', 'previous'] as const) {
      const result = bucketResult({
        period: leapYear,
        side,
        granularity: 'day',
        customPolicy: allCustomGranularities,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reasonCode);
      expect(result.series.buckets).toHaveLength(366);
      expect(result.series.startDate).toBe(leapYear[side].startDate);
      expect(result.series.endDateExclusive).toBe(
        leapYear[side].endDateExclusive,
      );
    }
  });

  it.each(['day', 'week', 'month'] as const)(
    '367 个本地日请求 %s 时 current/previous 均整次拒绝且不自动改粒度',
    (granularity) => {
      for (const side of ['current', 'previous'] as const) {
        const result = bucketResult({
          period: overLimit,
          side,
          granularity,
          customPolicy: allCustomGranularities,
        });

        expect(result).toEqual({
          ok: false,
          reasonCode: 'custom_period_local_day_limit_exceeded',
        });
        expect(Object.keys(result).sort()).toEqual(['ok', 'reasonCode']);
      }
    },
  );

  it('请求附带伪造资源策略也不能提高或覆盖硬上限', () => {
    expect(
      bucketResult({
        period: overLimit,
        side: 'current',
        granularity: 'day',
        customPolicy: { allowedGranularities: ['day'] },
        resourcePolicy: {
          maxLocalDayCount: Number.MAX_SAFE_INTEGER,
          maxBucketCount: Number.MAX_SAFE_INTEGER,
        },
      } as AnalyticsPeriodBucketRequest),
    ).toEqual({
      ok: false,
      reasonCode: 'custom_period_local_day_limit_exceeded',
    });
  });

  it('结构与显式粒度错误优先于资源日数门禁', () => {
    const mismatchedPair = {
      ...overLimit,
      previous: {
        ...overLimit.previous,
        timeZone: 'UTC',
      },
    } satisfies AnalyticsPeriodPair;
    expect(
      bucketResult({
        period: mismatchedPair,
        side: 'current',
        granularity: 'day',
        customPolicy: { allowedGranularities: ['day'] },
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_period_window' });
    expect(
      bucketResult({
        period: overLimit,
        side: 'comparison',
        granularity: 'day',
        customPolicy: { allowedGranularities: ['day'] },
      } as unknown as AnalyticsPeriodBucketRequest),
    ).toEqual({ ok: false, reasonCode: 'invalid_period_window' });
    expect(
      bucketResult({
        period: overLimit,
        side: 'current',
        granularity: 'hour',
        customPolicy: allCustomGranularities,
      }),
    ).toEqual({ ok: false, reasonCode: 'chart_granularity_not_allowed' });
    expect(
      bucketResult({
        period: overLimit,
        side: 'current',
        granularity: 'day',
        customPolicy: { allowedGranularities: [] },
      }),
    ).toEqual({
      ok: false,
      reasonCode: 'invalid_custom_granularity_policy',
    });
  });

  it('资源失败先于逐日边界解析，且 366 日仍保留跳过日失败', () => {
    const apia367 = customPeriod({
      timeZone: 'Pacific/Apia',
      startDate: '2011-01-01',
      endDateInclusive: '2012-01-02',
      asOf: '2012-01-02T12:00:00.000Z',
    });
    const apia366 = customPeriod({
      timeZone: 'Pacific/Apia',
      startDate: '2011-01-01',
      endDateInclusive: '2012-01-01',
      asOf: '2012-01-02T12:00:00.000Z',
    });

    expect(
      bucketResult({
        period: apia367,
        side: 'current',
        granularity: 'month',
        customPolicy: allCustomGranularities,
      }),
    ).toEqual({
      ok: false,
      reasonCode: 'custom_period_local_day_limit_exceeded',
    });
    expect(
      bucketResult({
        period: apia366,
        side: 'current',
        granularity: 'month',
        customPolicy: allCustomGranularities,
      }),
    ).toEqual({ ok: false, reasonCode: 'unresolvable_period_boundary' });
  });

  it.each([
    ['Asia/Shanghai 午夜', 'Asia/Shanghai', '2026-07-17', '2026-07-17T04:00:00.000Z', 24, 24],
    [
      'America/New_York 春季 DST',
      'America/New_York',
      '2026-03-08',
      '2026-03-08T12:00:00.000Z',
      23,
      24,
    ],
    [
      'America/New_York 秋季 DST',
      'America/New_York',
      '2026-11-01',
      '2026-11-01T12:00:00.000Z',
      25,
      24,
    ],
  ] as const)(
    '%s 的本地日资源计数不使用固定 24 小时',
    (_label, timeZone, localDate, asOf, currentHours, previousHours) => {
      const resolved = customPeriod({
        timeZone,
        startDate: localDate,
        endDateInclusive: localDate,
        asOf,
      });

      for (const [side, elapsedHours] of [
        ['current', currentHours],
        ['previous', previousHours],
      ] as const) {
        const result = bucketResult({
          period: resolved,
          side,
          granularity: 'day',
          customPolicy: { allowedGranularities: ['day'] },
        });
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error(result.reasonCode);
        expect(result.series.buckets).toHaveLength(1);
        expect(
          (Date.parse(result.series.endInstantExclusive) -
            Date.parse(result.series.startInstant)) /
            3_600_000,
        ).toBe(elapsedHours);
      }
    },
  );

  it('重复资源失败确定、输入不变且不暴露策略或部分桶', () => {
    const request = Object.freeze({
      period: Object.freeze({
        ...overLimit,
        current: Object.freeze({ ...overLimit.current }),
        previous: Object.freeze({ ...overLimit.previous }),
      }),
      side: 'current',
      granularity: 'day',
      customPolicy: Object.freeze({
        allowedGranularities: Object.freeze(['day'] as const),
      }),
    }) satisfies AnalyticsPeriodBucketRequest;
    const before = structuredClone(request);

    const first = bucketResult(request);
    const second = bucketResult(request);

    expect(request).toEqual(before);
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/bucket|maxLocalDayCount|maxBucketCount/iu);
  });
});

describe('经营分析桶数量防御', () => {
  it.each([365, 366])('公开序列校验允许 %s 桶', (count) => {
    const start = Date.parse('2026-01-01T00:00:00.000Z');
    const buckets = Array.from({ length: count }, (_, index) => ({
      startInstant: new Date(start + index * 3_600_000).toISOString(),
      endInstantExclusive: new Date(start + (index + 1) * 3_600_000).toISOString(),
    }));

    expect(
      validateAnalyticsPeriodBucketSequence({
        startInstant: buckets[0]!.startInstant,
        endInstantExclusive: buckets.at(-1)!.endInstantExclusive,
        buckets,
      }),
    ).toEqual({ ok: true });
  });

  it('B+1 在读取元素前拒绝，且不返回部分序列', () => {
    const oversized = new Array<{
      startInstant: string;
      endInstantExclusive: string;
    }>(367);
    Object.defineProperty(oversized, 0, {
      get() {
        throw new Error('不应读取超限序列元素');
      },
    });

    const input = {
      startInstant: '2026-01-01T00:00:00.000Z',
      endInstantExclusive: '2026-01-02T00:00:00.000Z',
      buckets: oversized,
    } as const;
    const result = validateAnalyticsPeriodBucketSequence(input);
    const repeated = validateAnalyticsPeriodBucketSequence(input);

    expect(result).toEqual({
      ok: false,
      reasonCode: 'period_bucket_count_limit_exceeded',
    });
    expect(repeated).toEqual(result);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result).sort()).toEqual(['ok', 'reasonCode']);
  });
});
