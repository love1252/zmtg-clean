import { describe, expect, it } from 'vitest';

import {
  deriveFollowUpDueBucket,
  FOLLOW_UP_DUE_BUCKETS,
} from '@/modules/care/domain/follow-up-due-bucket';

const version = 'operating-context-17';

function derive(
  overrides: Partial<Parameters<typeof deriveFollowUpDueBucket>[0]> = {},
) {
  return deriveFollowUpDueBucket({
    state: 'pending',
    dueAt: '2026-07-16T16:00:00.000Z',
    now: '2026-07-16T16:00:00.000Z',
    timeZone: 'Asia/Shanghai',
    operatingContextVersion: version,
    ...overrides,
  });
}

describe('随访到期桶纯领域派生', () => {
  it('只输出三个读取时派生桶', () => {
    expect(FOLLOW_UP_DUE_BUCKETS).toEqual(['not_due', 'due_today', 'overdue']);
  });

  it('按 Asia/Shanghai 本地日界区分逾期、今日与未到期', () => {
    expect(derive({ dueAt: '2026-07-16T15:59:59.999Z' })).toBe('overdue');
    expect(derive({ dueAt: '2026-07-16T16:00:00.000Z' })).toBe('due_today');
    expect(derive({ dueAt: '2026-07-17T15:59:59.999Z' })).toBe('due_today');
    expect(derive({ dueAt: '2026-07-17T16:00:00.000Z' })).toBe('not_due');
  });

  it('四个非终态均可产生当前到期桶', () => {
    for (const state of ['pending', 'in_progress', 'waiting_customer', 'escalated']) {
      expect(derive({ state }), state).toBe('due_today');
    }
  });

  it('completed 和 cancelled 永不进入当前到期桶', () => {
    expect(derive({ state: 'completed' })).toBeNull();
    expect(derive({ state: 'cancelled' })).toBeNull();
  });

  it('正确处理 America/New_York 春季 23 小时业务日', () => {
    const base = {
      timeZone: 'America/New_York',
      now: '2026-03-08T05:00:00.000Z',
    };

    expect(derive({ ...base, dueAt: '2026-03-09T03:59:59.999Z' })).toBe(
      'due_today',
    );
    expect(derive({ ...base, dueAt: '2026-03-09T04:00:00.000Z' })).toBe('not_due');
    expect(
      derive({
        ...base,
        dueAt: '2026-03-08T05:00:00.000Z',
        now: '2026-03-09T04:00:00.000Z',
      }),
    ).toBe('overdue');
  });

  it('正确处理 America/New_York 秋季 25 小时业务日', () => {
    const base = {
      timeZone: 'America/New_York',
      now: '2026-11-01T04:00:00.000Z',
    };

    expect(derive({ ...base, dueAt: '2026-11-02T04:59:59.999Z' })).toBe(
      'due_today',
    );
    expect(derive({ ...base, dueAt: '2026-11-02T05:00:00.000Z' })).toBe('not_due');
    expect(
      derive({
        ...base,
        dueAt: '2026-11-01T04:00:00.000Z',
        now: '2026-11-02T05:00:00.000Z',
      }),
    ).toBe('overdue');
  });

  it('非法状态、时间、时区或版本全部 fail-closed', () => {
    for (const state of ['due_today', 'overdue', 'unknown', 1, null]) {
      expect(derive({ state }), String(state)).toBeNull();
    }

    expect(derive({ dueAt: '2026-02-30T00:00:00.000Z' })).toBeNull();
    expect(derive({ now: '2026-07-17' })).toBeNull();
    expect(derive({ timeZone: '+08:00' })).toBeNull();
    expect(derive({ operatingContextVersion: '' })).toBeNull();
    expect(
      derive({
        dueAt: '9999-12-31T23:59:59.999-23:59',
        now: '9999-12-31T00:00:00.000Z',
        timeZone: 'UTC',
      }),
    ).toBeNull();
  });

  it('输入不变且重复调用确定，时区和版本变化不回写任务事实', () => {
    const input = Object.freeze({
      state: 'waiting_customer',
      dueAt: '2026-07-17T05:00:00.000Z',
      now: '2026-07-17T00:30:00.000Z',
      timeZone: 'Asia/Shanghai',
      operatingContextVersion: version,
    });
    const before = structuredClone(input);

    expect(deriveFollowUpDueBucket(input)).toBe('due_today');
    expect(deriveFollowUpDueBucket(input)).toBe('due_today');
    expect(input).toEqual(before);
    expect(
      deriveFollowUpDueBucket({
        ...input,
        timeZone: 'America/New_York',
      }),
    ).toBe('not_due');
    expect(
      deriveFollowUpDueBucket({
        ...input,
        operatingContextVersion: 'operating-context-18',
      }),
    ).toBe('due_today');
    expect(input).toEqual(before);
  });
});
