import { describe, expect, it } from 'vitest';
import {
  createAiUsageTimeWindowSnapshot,
  type AiUsageTimeWindow,
} from '@/modules/institution-system/domain/ai-usage-time-window';

const timeWindow = {
  startInclusiveEpochMs: 1_000,
  endExclusiveEpochMs: 2_000,
} as const satisfies AiUsageTimeWindow;

function requireTimeWindowSnapshot(window: AiUsageTimeWindow = timeWindow) {
  const result = createAiUsageTimeWindowSnapshot(window);
  expect(result.ok).toBe(true);
  if (!result.ok) {
    throw new Error(result.code);
  }
  return result.classify;
}

describe('AI usage time window domain', () => {
  it('使用 UTC epoch ms 半开窗，允许安全整数范围内的负 epoch', () => {
    const classify = requireTimeWindowSnapshot({
      startInclusiveEpochMs: -2,
      endExclusiveEpochMs: 2,
    });

    expect(classify(-3)).toBe('outside');
    expect(classify(-2)).toBe('inside');
    expect(classify(1)).toBe('inside');
    expect(classify(2)).toBe('outside');
  });

  it('不修改输入，并在创建时快照两个窗口端点', () => {
    const mutableWindow = {
      startInclusiveEpochMs: 1_000,
      endExclusiveEpochMs: 2_000,
    };
    const before = structuredClone(mutableWindow);
    const classify = requireTimeWindowSnapshot(mutableWindow);

    expect(mutableWindow).toEqual(before);

    mutableWindow.startInclusiveEpochMs = 1_500;
    mutableWindow.endExclusiveEpochMs = 1_600;

    expect(classify(1_000)).toBe('inside');
    expect(classify(1_999)).toBe('inside');
    expect(classify(2_000)).toBe('outside');
  });

  it.each([
    { name: 'null', value: null },
    { name: '数组', value: [1_000, 2_000] },
    { name: 'Date', value: new Date(0) },
    { name: '缺少终点', value: { startInclusiveEpochMs: 1_000 } },
    {
      name: '起点为字符串',
      value: { startInclusiveEpochMs: '1000', endExclusiveEpochMs: 2_000 },
    },
    {
      name: '终点为字符串',
      value: { startInclusiveEpochMs: 1_000, endExclusiveEpochMs: '2000' },
    },
    {
      name: '空窗口',
      value: { startInclusiveEpochMs: 1_000, endExclusiveEpochMs: 1_000 },
    },
    {
      name: '反向窗口',
      value: { startInclusiveEpochMs: 2_000, endExclusiveEpochMs: 1_000 },
    },
    {
      name: '起点 NaN',
      value: { startInclusiveEpochMs: Number.NaN, endExclusiveEpochMs: 2_000 },
    },
    {
      name: '终点正无穷',
      value: { startInclusiveEpochMs: 1_000, endExclusiveEpochMs: Number.POSITIVE_INFINITY },
    },
    {
      name: '起点负无穷',
      value: { startInclusiveEpochMs: Number.NEGATIVE_INFINITY, endExclusiveEpochMs: 2_000 },
    },
    {
      name: '小数端点',
      value: { startInclusiveEpochMs: 1_000.5, endExclusiveEpochMs: 2_000 },
    },
    {
      name: '超过最大安全整数',
      value: {
        startInclusiveEpochMs: 1_000,
        endExclusiveEpochMs: Number.MAX_SAFE_INTEGER + 1,
      },
    },
    {
      name: '小于最小安全整数',
      value: {
        startInclusiveEpochMs: Number.MIN_SAFE_INTEGER - 1,
        endExclusiveEpochMs: 2_000,
      },
    },
  ])('拒绝$name且不创建部分窗口快照', ({ value }) => {
    expect(createAiUsageTimeWindowSnapshot(
      value as unknown as AiUsageTimeWindow,
    )).toEqual({
      ok: false,
      code: 'invalid_time_window',
    });
  });

  it.each([
    null,
    undefined,
    '',
    '1500',
    1_500n,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    1_500.5,
    Number.MAX_SAFE_INTEGER + 1,
    Number.MIN_SAFE_INTEGER - 1,
  ])('将非法记录时间 %s 统一归为 invalid', (occurredAtEpochMs) => {
    expect(requireTimeWindowSnapshot()(occurredAtEpochMs)).toBe('invalid');
  });
});
