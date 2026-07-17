import { describe, expect, it } from 'vitest';

import type {
  AnalyticsCustomGranularityPolicy,
} from '@/modules/institution-analytics/domain/analytics-chart-granularity';
import {
  resolveAnalyticsPeriodBuckets,
  validateAnalyticsPeriodBucketSequence,
  type AnalyticsCalendarPeriodBucket,
  type AnalyticsPeriodBucketRequest,
  type AnalyticsPeriodBucketSeries,
} from '@/modules/institution-analytics/domain/analytics-period-buckets';
import {
  resolveAnalyticsPeriod,
  resolveAnalyticsLocalDateStartInstant,
  type AnalyticsPeriodPreset,
  type AnalyticsPeriodRequest,
  type AnalyticsPeriodWindow,
} from '@/modules/institution-analytics/domain/analytics-periods';

function period(request: AnalyticsPeriodRequest) {
  const result = resolveAnalyticsPeriod(request);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reasonCode);
  return result.value;
}

function fixedPeriod(preset: Exclude<AnalyticsPeriodPreset, 'custom'>) {
  return period({
    preset,
    timeZone: 'Asia/Shanghai',
    asOf: '2026-07-17T04:00:00.000Z',
  });
}

function bucketResult(
  request: AnalyticsPeriodBucketRequest,
) {
  return resolveAnalyticsPeriodBuckets(request);
}

function buckets(request: AnalyticsPeriodBucketRequest) {
  const result = bucketResult(request);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reasonCode);
  return result.series;
}

function expectContinuous(series: AnalyticsPeriodBucketSeries) {
  expect(series.buckets.length).toBeGreaterThan(0);
  expect(series.buckets[0]?.startInstant).toBe(series.startInstant);
  expect(series.buckets.at(-1)?.endInstantExclusive).toBe(
    series.endInstantExclusive,
  );

  for (const [index, bucket] of series.buckets.entries()) {
    expect(Date.parse(bucket.startInstant)).toBeLessThan(
      Date.parse(bucket.endInstantExclusive),
    );
    if (index > 0) {
      expect(series.buckets[index - 1]?.endInstantExclusive).toBe(
        bucket.startInstant,
      );
    }
  }
}

function calendarBuckets(
  series: AnalyticsPeriodBucketSeries,
): readonly AnalyticsCalendarPeriodBucket[] {
  expect(series.granularity).not.toBe('hour');
  return series.buckets as readonly AnalyticsCalendarPeriodBucket[];
}

function localHour(instant: string, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA-u-ca-iso8601-nu-latn', {
    timeZone,
    calendar: 'iso8601',
    numberingSystem: 'latn',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  return formatter.formatToParts(new Date(instant)).find((part) => part.type === 'hour')
    ?.value;
}

describe('经营分析图表粒度门禁', () => {
  it.each([
    ['today', 'hour'],
    ['week', 'day'],
    ['month', 'day'],
    ['quarter', 'week'],
    ['quarter', 'day'],
    ['year', 'month'],
    ['year', 'week'],
  ] as const)('%s 显式允许 %s', (preset, granularity) => {
    const resolved = fixedPeriod(preset);
    const series = buckets({
      period: resolved,
      side: 'current',
      granularity,
    });

    expect(series.granularity).toBe(granularity);
    expect(series.policySnapshot).toEqual({
      source: 'fixed',
      allowedGranularities:
        preset === 'today'
          ? ['hour']
          : preset === 'week' || preset === 'month'
            ? ['day']
            : preset === 'quarter'
              ? ['day', 'week']
              : ['week', 'month'],
    });
    expectContinuous(series);
  });

  it.each([
    ['today', 'day'],
    ['today', 'week'],
    ['today', 'month'],
    ['week', 'hour'],
    ['week', 'week'],
    ['week', 'month'],
    ['month', 'hour'],
    ['month', 'week'],
    ['month', 'month'],
    ['quarter', 'hour'],
    ['quarter', 'month'],
    ['year', 'hour'],
    ['year', 'day'],
  ] as const)('%s 拒绝未批准粒度 %s', (preset, granularity) => {
    const resolved = fixedPeriod(preset);
    expect(
      bucketResult({
        period: resolved,
        side: 'current',
        granularity,
      }),
    ).toEqual({ ok: false, reasonCode: 'chart_granularity_not_allowed' });
  });

  it.each([
    ['缺失', undefined],
    ['大小写别名', 'DAY'],
    ['近义值', 'quarter'],
    ['空值', ''],
  ])('不为%s粒度猜测默认值', (_label, granularity) => {
    const resolved = fixedPeriod('month');
    expect(
      bucketResult({
        period: resolved,
        side: 'current',
        granularity,
      } as unknown as AnalyticsPeriodBucketRequest),
    ).toEqual({ ok: false, reasonCode: 'invalid_chart_granularity' });
  });

  it('非法 preset 不回退为 custom 或其他固定策略', () => {
    const resolved = fixedPeriod('month');
    expect(
      bucketResult({
        period: { ...resolved, preset: 'rolling_month' },
        side: 'current',
        granularity: 'day',
      } as unknown as AnalyticsPeriodBucketRequest),
    ).toEqual({ ok: false, reasonCode: 'invalid_period_preset' });
  });

  it('preset 不得与其期间窗口重新组合以绕过粒度门禁', () => {
    const resolved = fixedPeriod('month');

    expect(
      bucketResult({
        period: { ...resolved, preset: 'today' },
        side: 'current',
        granularity: 'hour',
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_period_window' });
  });
});

describe('经营分析本地日历桶', () => {
  it('week/day 逐日覆盖本周截至今日', () => {
    const resolved = period({
      preset: 'week',
      timeZone: 'Asia/Shanghai',
      asOf: '2026-07-16T04:00:00.000Z',
    });
    const series = buckets({
      period: resolved,
      side: 'current',
      granularity: 'day',
    });
    const items = calendarBuckets(series);

    expect(items).toHaveLength(4);
    expect(items.map(({ startDate, endDateExclusive }) => [
      startDate,
      endDateExclusive,
    ])).toEqual([
      ['2026-07-13', '2026-07-14'],
      ['2026-07-14', '2026-07-15'],
      ['2026-07-15', '2026-07-16'],
      ['2026-07-16', '2026-07-17'],
    ]);
    expectContinuous(series);
  });

  it('month/day 生成 17 个本地日桶', () => {
    const resolved = fixedPeriod('month');
    const series = buckets({
      period: resolved,
      side: 'current',
      granularity: 'day',
    });
    const items = calendarBuckets(series);

    expect(items).toHaveLength(17);
    expect([items[0]?.startDate, items[0]?.endDateExclusive]).toEqual([
      '2026-07-01',
      '2026-07-02',
    ]);
    expect([items.at(-1)?.startDate, items.at(-1)?.endDateExclusive]).toEqual([
      '2026-07-17',
      '2026-07-18',
    ]);
    expectContinuous(series);
  });

  it('显式生成上一等长期的连续 day 桶', () => {
    const resolved = fixedPeriod('month');
    const series = buckets({
      period: resolved,
      side: 'previous',
      granularity: 'day',
    });
    const items = calendarBuckets(series);

    expect(items).toHaveLength(17);
    expect([series.startDate, series.endDateExclusive]).toEqual([
      '2026-06-14',
      '2026-07-01',
    ]);
    expect([items[0]?.startDate, items.at(-1)?.endDateExclusive]).toEqual([
      '2026-06-14',
      '2026-07-01',
    ]);
    expectContinuous(series);
  });

  it('quarter/week 以 ISO 周一切分并裁切首尾', () => {
    const resolved = period({
      preset: 'quarter',
      timeZone: 'Asia/Shanghai',
      asOf: '2026-05-18T04:00:00.000Z',
    });
    const series = buckets({
      period: resolved,
      side: 'current',
      granularity: 'week',
    });
    const items = calendarBuckets(series);

    expect(items).toHaveLength(8);
    expect([items[0]?.startDate, items[0]?.endDateExclusive]).toEqual([
      '2026-04-01',
      '2026-04-06',
    ]);
    expect([items.at(-1)?.startDate, items.at(-1)?.endDateExclusive]).toEqual([
      '2026-05-18',
      '2026-05-19',
    ]);
    for (const item of items.slice(1, -1)) {
      expect(
        new Date(`${item.startDate}T00:00:00.000Z`).getUTCDay(),
      ).toBe(1);
    }
    expectContinuous(series);
  });

  it('quarter/day 保留全部 48 个本地日', () => {
    const resolved = period({
      preset: 'quarter',
      timeZone: 'Asia/Shanghai',
      asOf: '2026-05-18T04:00:00.000Z',
    });
    const series = buckets({
      period: resolved,
      side: 'current',
      granularity: 'day',
    });

    expect(series.buckets).toHaveLength(48);
    expectContinuous(series);
  });

  it('year/month 按自然月并裁切当前月末端', () => {
    const resolved = fixedPeriod('year');
    const series = buckets({
      period: resolved,
      side: 'current',
      granularity: 'month',
    });
    const items = calendarBuckets(series);

    expect(items).toHaveLength(7);
    expect([items[0]?.startDate, items[0]?.endDateExclusive]).toEqual([
      '2026-01-01',
      '2026-02-01',
    ]);
    expect([items.at(-1)?.startDate, items.at(-1)?.endDateExclusive]).toEqual([
      '2026-07-01',
      '2026-07-18',
    ]);
    expectContinuous(series);
  });

  it('year/week 按 ISO 周一并裁切年度首尾', () => {
    const resolved = fixedPeriod('year');
    const series = buckets({
      period: resolved,
      side: 'current',
      granularity: 'week',
    });
    const items = calendarBuckets(series);

    expect(items).toHaveLength(29);
    expect([items[0]?.startDate, items[0]?.endDateExclusive]).toEqual([
      '2026-01-01',
      '2026-01-05',
    ]);
    expect([items.at(-1)?.startDate, items.at(-1)?.endDateExclusive]).toEqual([
      '2026-07-13',
      '2026-07-18',
    ]);
    expectContinuous(series);
  });
});

describe('经营分析 custom 粒度快照', () => {
  const resolved = period({
    preset: 'custom',
    timeZone: 'Asia/Shanghai',
    asOf: '2026-03-09T16:00:00.000Z',
    startDate: '2026-01-15',
    endDateInclusive: '2026-03-09',
  });
  const policy = Object.freeze({
    allowedGranularities: Object.freeze(['month', 'day', 'week'] as const),
  }) satisfies AnalyticsCustomGranularityPolicy;

  it.each([
    ['day', 54, ['2026-01-15', '2026-01-16'], ['2026-03-09', '2026-03-10']],
    ['week', 9, ['2026-01-15', '2026-01-19'], ['2026-03-09', '2026-03-10']],
    ['month', 3, ['2026-01-15', '2026-02-01'], ['2026-03-01', '2026-03-10']],
  ] as const)(
    'custom/%s 只按显式 policy 生成 %s 桶',
    (granularity, count, first, last) => {
      const series = buckets({
        period: resolved,
        side: 'current',
        granularity,
        customPolicy: policy,
      });
      const items = calendarBuckets(series);

      expect(items).toHaveLength(count);
      expect([items[0]?.startDate, items[0]?.endDateExclusive]).toEqual(first);
      expect([items.at(-1)?.startDate, items.at(-1)?.endDateExclusive]).toEqual(last);
      expect(series.policySnapshot).toEqual({
        source: 'custom',
        allowedGranularities: ['day', 'week', 'month'],
      });
      expectContinuous(series);
    },
  );

  it('custom 拒绝未列入允许集合的粒度且永不允许 hour', () => {
    expect(
      bucketResult({
        period: resolved,
        side: 'current',
        granularity: 'month',
        customPolicy: { allowedGranularities: ['day', 'week'] },
      }),
    ).toEqual({ ok: false, reasonCode: 'chart_granularity_not_allowed' });
    expect(
      bucketResult({
        period: resolved,
        side: 'current',
        granularity: 'hour',
        customPolicy: policy,
      }),
    ).toEqual({ ok: false, reasonCode: 'chart_granularity_not_allowed' });
  });

  it.each([
    ['缺失', undefined],
    ['null', null],
    ['非对象', ['day']],
    ['空集合', { allowedGranularities: [] }],
    ['含 hour', { allowedGranularities: ['day', 'hour'] }],
    ['含未知值', { allowedGranularities: ['day', 'quarter'] }],
    ['重复项', { allowedGranularities: ['day', 'day'] }],
    ['额外字段', { allowedGranularities: ['day'], threshold: 30 }],
  ])('custom policy %s 时 fail-closed', (_label, customPolicy) => {
    expect(
      bucketResult({
        period: resolved,
        side: 'current',
        granularity: 'day',
        customPolicy,
      } as unknown as AnalyticsPeriodBucketRequest),
    ).toEqual({ ok: false, reasonCode: 'invalid_custom_granularity_policy' });
  });

  it('固定 preset 携带 custom policy 时拒绝而非静默忽略', () => {
    expect(
      bucketResult({
        period: fixedPeriod('month'),
        side: 'current',
        granularity: 'day',
        customPolicy: { allowedGranularities: ['day'] },
      } as AnalyticsPeriodBucketRequest),
    ).toEqual({ ok: false, reasonCode: 'invalid_custom_granularity_policy' });
  });
});

describe('经营分析小时桶与 DST', () => {
  it.each([
    [
      'Asia/Shanghai 午夜',
      'Asia/Shanghai',
      '2026-07-17T04:00:00.000Z',
      24,
      '2026-07-16T16:00:00.000Z',
      '2026-07-17T16:00:00.000Z',
      24,
    ],
    [
      'America/New_York 春季 DST',
      'America/New_York',
      '2026-03-08T12:00:00.000Z',
      23,
      '2026-03-08T05:00:00.000Z',
      '2026-03-09T04:00:00.000Z',
      23,
    ],
    [
      'America/New_York 秋季 DST',
      'America/New_York',
      '2026-11-01T12:00:00.000Z',
      25,
      '2026-11-01T04:00:00.000Z',
      '2026-11-02T05:00:00.000Z',
      25,
    ],
  ] as const)(
    '%s 产生 %s 个真实 elapsed-hour 桶',
    (_label, timeZone, asOf, count, startInstant, endInstant, elapsedHours) => {
      const resolved = period({ preset: 'today', timeZone, asOf });
      const series = buckets({
        period: resolved,
        side: 'current',
        granularity: 'hour',
      });

      expect(series.buckets).toHaveLength(count);
      expect(series.startInstant).toBe(startInstant);
      expect(series.endInstantExclusive).toBe(endInstant);
      expect(
        (Date.parse(series.endInstantExclusive) - Date.parse(series.startInstant)) /
          3_600_000,
      ).toBe(elapsedHours);
      for (const bucket of series.buckets) {
        expect(Date.parse(bucket.endInstantExclusive) - Date.parse(bucket.startInstant)).toBe(
          3_600_000,
        );
      }
      expectContinuous(series);
    },
  );

  it('春季不生成不存在的 02 时，秋季保留两个真实 01 时', () => {
    const spring = period({
      preset: 'today',
      timeZone: 'America/New_York',
      asOf: '2026-03-08T12:00:00.000Z',
    });
    const springSeries = buckets({
      period: spring,
      side: 'current',
      granularity: 'hour',
    });
    expect(
      springSeries.buckets.map((bucket) =>
        localHour(bucket.startInstant, springSeries.timeZone),
      ),
    ).not.toContain('02');

    const autumn = period({
      preset: 'today',
      timeZone: 'America/New_York',
      asOf: '2026-11-01T12:00:00.000Z',
    });
    const autumnSeries = buckets({
      period: autumn,
      side: 'current',
      granularity: 'hour',
    });
    const repeatedHours = autumnSeries.buckets.filter(
      (bucket) => localHour(bucket.startInstant, autumnSeries.timeZone) === '01',
    );
    expect(repeatedHours.map((bucket) => bucket.startInstant)).toEqual([
      '2026-11-01T05:00:00.000Z',
      '2026-11-01T06:00:00.000Z',
    ]);
  });

  it.each([
    ['春季', '2026-03-08T12:00:00.000Z', 23],
    ['秋季', '2026-11-01T12:00:00.000Z', 25],
  ] as const)(
    'America/New_York %s today 的上一等长本地日为 24 桶，当期为 %s 桶',
    (_label, asOf, currentCount) => {
      const resolved = period({
        preset: 'today',
        timeZone: 'America/New_York',
        asOf,
      });
      const current = buckets({
        period: resolved,
        side: 'current',
        granularity: 'hour',
      });
      const previous = buckets({
        period: resolved,
        side: 'previous',
        granularity: 'hour',
      });

      expect(current.buckets).toHaveLength(currentCount);
      expect(previous.buckets).toHaveLength(24);
      expect(previous.endDateExclusive).toBe(current.startDate);
      expectContinuous(previous);
    },
  );

  it.each([
    ['春季', '2026-03-08', '2026-03-08T12:00:00.000Z', 23],
    ['秋季', '2026-11-01', '2026-11-01T12:00:00.000Z', 25],
  ] as const)(
    'America/New_York %s DST 的 calendar day 桶保留真实 %s 小时',
    (_label, localDate, asOf, elapsedHours) => {
      const resolved = period({
        preset: 'custom',
        timeZone: 'America/New_York',
        asOf,
        startDate: localDate,
        endDateInclusive: localDate,
      });
      const series = buckets({
        period: resolved,
        side: 'current',
        granularity: 'day',
        customPolicy: { allowedGranularities: ['day'] },
      });

      expect(series.buckets).toHaveLength(1);
      expect(
        (Date.parse(series.endInstantExclusive) -
          Date.parse(series.startInstant)) /
          3_600_000,
      ).toBe(elapsedHours);
      expectContinuous(series);
    },
  );
});

describe('经营分析桶 fail-closed 与纯函数边界', () => {
  const validPeriod = fixedPeriod('month');
  const validWindow = validPeriod.current;

  it.each([
    ['1000-01-01', '1000-01-01T00:00:00.000Z'],
    ['9999-12-31', '9999-12-31T00:00:00.000Z'],
  ] as const)('解析四位年份范围边界 %s', (localDate, instant) => {
    expect(
      resolveAnalyticsLocalDateStartInstant({ localDate, timeZone: 'UTC' }),
    ).toEqual({ ok: true, instant });
  });

  it.each([
    [
      '下界导致上一等长期越界',
      { preset: 'today', timeZone: 'UTC', asOf: '1000-01-01T12:00:00.000Z' },
    ],
    [
      '上界导致当期排他结束日越界',
      { preset: 'today', timeZone: 'UTC', asOf: '9999-12-31T12:00:00.000Z' },
    ],
  ] as const)('%s 时 period resolver 不返回内部无效成功结果', (_label, request) => {
    expect(resolveAnalyticsPeriod(request)).toEqual({
      ok: false,
      reasonCode: 'invalid_local_date',
    });
  });

  it.each([
    [
      '上期时区不同',
      { previous: { ...validPeriod.previous, timeZone: 'UTC' } },
    ],
    [
      '上期天数不同',
      { previous: { ...validPeriod.previous, localDayCount: 16 } },
    ],
    [
      '上期未衔接当期',
      {
        previous: {
          ...validPeriod.previous,
          startDate: '2026-06-13',
          endDateExclusive: '2026-06-30',
        },
      },
    ],
    ['asOf 未对应当期末端', { asOfBusinessDate: '2026-07-16' }],
  ] as const)('%s 时整个 period pair 拒绝', (_label, override) => {
    expect(
      bucketResult({
        period: { ...validPeriod, ...override },
        side: 'current',
        granularity: 'day',
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_period_window' });
  });

  it.each([
    ['非法日期', { ...validWindow, startDate: '2026-02-30' }],
    ['非标准日期', { ...validWindow, startDate: '2026-7-01' }],
    [
      '空范围',
      { ...validWindow, startDate: '2026-07-18', endDateExclusive: '2026-07-18' },
    ],
    [
      '反向范围',
      { ...validWindow, startDate: '2026-07-19', endDateExclusive: '2026-07-18' },
    ],
    ['天数不一致', { ...validWindow, localDayCount: 16 }],
    ['非法 IANA 时区', { ...validWindow, timeZone: 'Invalid/Zone' }],
    ['缩写时区', { ...validWindow, timeZone: 'CST' }],
    ['固定偏移', { ...validWindow, timeZone: '+08:00' }],
  ])('%s窗口整次拒绝且不返回部分桶', (_label, window) => {
    expect(
      bucketResult({
        period: { ...validPeriod, current: window },
        side: 'current',
        granularity: 'day',
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_period_window' });
  });

  it('无法解析的机构本地业务日边界整次 fail-closed', () => {
    const skippedDateWindow = {
      timeZone: 'Pacific/Apia',
      startDate: '2011-12-30',
      endDateExclusive: '2011-12-31',
      localDayCount: 1,
    } satisfies AnalyticsPeriodWindow;
    const skippedDatePeriod = {
      preset: 'custom',
      asOfBusinessDate: '2011-12-31',
      current: skippedDateWindow,
      previous: {
        timeZone: 'Pacific/Apia',
        startDate: '2011-12-29',
        endDateExclusive: '2011-12-30',
        localDayCount: 1,
      },
    } as const;

    expect(
      bucketResult({
        period: skippedDatePeriod,
        side: 'current',
        granularity: 'day',
        customPolicy: { allowedGranularities: ['day'] },
      }),
    ).toEqual({ ok: false, reasonCode: 'unresolvable_period_boundary' });
  });

  it.each(['week', 'month'] as const)(
    '跳过日位于 %s 粗粒度桶内部时仍整次 fail-closed',
    (granularity) => {
      const skippedDateInsidePeriod = {
        preset: 'custom',
        asOfBusinessDate: '2012-01-01',
        current: {
          timeZone: 'Pacific/Apia',
          startDate: '2011-12-26',
          endDateExclusive: '2012-01-02',
          localDayCount: 7,
        },
        previous: {
          timeZone: 'Pacific/Apia',
          startDate: '2011-12-19',
          endDateExclusive: '2011-12-26',
          localDayCount: 7,
        },
      } as const;

      expect(
        bucketResult({
          period: skippedDateInsidePeriod,
          side: 'current',
          granularity,
          customPolicy: { allowedGranularities: ['week', 'month'] },
        }),
      ).toEqual({ ok: false, reasonCode: 'unresolvable_period_boundary' });
    },
  );

  it('序列校验器拒绝缺口、重叠、零宽、覆盖不足和不可解析边界', () => {
    const startInstant = '2026-07-16T16:00:00.000Z';
    const endInstantExclusive = '2026-07-16T19:00:00.000Z';
    const valid = [
      {
        startInstant,
        endInstantExclusive: '2026-07-16T17:00:00.000Z',
      },
      {
        startInstant: '2026-07-16T17:00:00.000Z',
        endInstantExclusive: '2026-07-16T18:00:00.000Z',
      },
      {
        startInstant: '2026-07-16T18:00:00.000Z',
        endInstantExclusive,
      },
    ];

    expect(
      validateAnalyticsPeriodBucketSequence({
        startInstant,
        endInstantExclusive,
        buckets: valid,
      }),
    ).toEqual({ ok: true });

    for (const sequence of [
      valid.map((bucket, index) =>
        index === 1
          ? { ...bucket, startInstant: '2026-07-16T17:00:00.001Z' }
          : bucket,
      ),
      valid.map((bucket, index) =>
        index === 1
          ? { ...bucket, startInstant: '2026-07-16T16:59:59.999Z' }
          : bucket,
      ),
      valid.map((bucket, index) =>
        index === 1 ? { ...bucket, endInstantExclusive: bucket.startInstant } : bucket,
      ),
      [valid[1]!, valid[0]!, valid[2]!],
      valid.slice(1),
      valid.slice(0, -1),
      [],
    ]) {
      expect(
        validateAnalyticsPeriodBucketSequence({
          startInstant,
          endInstantExclusive,
          buckets: sequence,
        }),
      ).toEqual({ ok: false, reasonCode: 'non_contiguous_period_buckets' });
    }

    expect(
      validateAnalyticsPeriodBucketSequence({
        startInstant,
        endInstantExclusive,
        buckets: [{ startInstant: 'not-an-instant', endInstantExclusive }],
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_bucket_boundary' });
    expect(
      validateAnalyticsPeriodBucketSequence({
        startInstant: 'not-an-instant',
        endInstantExclusive,
        buckets: valid,
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_bucket_boundary' });
  });

  it('不修改输入、重复调用确定且输出全链冻结', () => {
    const resolved = period({
      preset: 'custom',
      timeZone: 'Asia/Shanghai',
      asOf: '2026-05-18T04:00:00.000Z',
      startDate: '2026-04-01',
      endDateInclusive: '2026-05-18',
    });
    const frozenPeriod = Object.freeze({
      ...resolved,
      current: Object.freeze({ ...resolved.current }),
      previous: Object.freeze({ ...resolved.previous }),
    });
    const allowedGranularities = Object.freeze(['week', 'day'] as const);
    const customPolicy = Object.freeze({ allowedGranularities });
    const request = Object.freeze({
      period: frozenPeriod,
      side: 'current',
      granularity: 'week',
      customPolicy,
    }) satisfies AnalyticsPeriodBucketRequest;
    const before = structuredClone(request);

    const first = bucketResult(request);
    const second = bucketResult(request);

    expect(request).toEqual(before);
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.reasonCode);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.series)).toBe(true);
    expect(Object.isFrozen(first.series.policySnapshot)).toBe(true);
    expect(Object.isFrozen(first.series.policySnapshot.allowedGranularities)).toBe(true);
    expect(Object.isFrozen(first.series.buckets)).toBe(true);
    expect(first.series.buckets.every((bucket) => Object.isFrozen(bucket))).toBe(true);
    expect(Object.keys(first.series).sort()).toEqual([
      'buckets',
      'endDateExclusive',
      'endInstantExclusive',
      'granularity',
      'policySnapshot',
      'preset',
      'startDate',
      'startInstant',
      'timeZone',
    ]);
    expect(Object.keys(first.series.buckets[0] ?? {}).sort()).toEqual([
      'endDateExclusive',
      'endInstantExclusive',
      'granularity',
      'startDate',
      'startInstant',
    ]);
    expect(JSON.stringify(first.series)).not.toMatch(
      /readiness|amount|metric|customer|project|data|value/iu,
    );
  });

  it('小时桶只输出时间边界与粒度', () => {
    const series = buckets({
      period: fixedPeriod('today'),
      side: 'current',
      granularity: 'hour',
    });

    expect(Object.keys(series.buckets[0] ?? {}).sort()).toEqual([
      'endInstantExclusive',
      'granularity',
      'startInstant',
    ]);
  });

  it('非法 side 不默认选择当前或上期', () => {
    expect(
      bucketResult({
        period: validPeriod,
        side: 'comparison',
        granularity: 'day',
      } as unknown as AnalyticsPeriodBucketRequest),
    ).toEqual({ ok: false, reasonCode: 'invalid_period_window' });
  });

  it('非法 period 对象不抛异常', () => {
    expect(
      bucketResult({
        period: null,
        side: 'current',
        granularity: 'day',
      } as unknown as AnalyticsPeriodBucketRequest),
    ).toEqual({ ok: false, reasonCode: 'invalid_period_window' });
  });
});
