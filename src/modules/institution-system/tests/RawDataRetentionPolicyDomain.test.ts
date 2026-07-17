import { describe, expect, it } from 'vitest';

import {
  parseRawDataRetentionPolicySnapshot,
  RAW_DATA_RETENTION_DEFAULT_DAYS,
  RAW_DATA_RETENTION_MAX_DAYS,
  RAW_DATA_RETENTION_MIN_DAYS,
  RAW_DATA_RETENTION_POLICY_KEY,
} from '@/modules/institution-system/domain/raw-data-retention-policy';

const scope = {
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  policyKey: RAW_DATA_RETENTION_POLICY_KEY,
} as const;

type MutablePolicyInput = {
  readiness: string;
  scope: {
    tenantId: string;
    institutionId: string;
    policyKey: typeof RAW_DATA_RETENTION_POLICY_KEY;
  };
  revision: string;
  current: {
    retentionDays: number;
    source: string;
  };
  pending: null | {
    targetRetentionDays: number;
    effectiveAt: string;
    effectiveBusinessDate: string;
    effectiveTimeZone: string;
    requestedAt: string;
    reasonCode: string;
    operatorReference: string;
  };
};

function readySnapshot(): MutablePolicyInput {
  return {
    readiness: 'ready',
    scope: { ...scope },
    revision: 'revision-1',
    current: {
      retentionDays: 180,
      source: 'product_default',
    },
    pending: {
      targetRetentionDays: 120,
      effectiveAt: '2026-07-18T00:00:00+08:00',
      effectiveBusinessDate: '2026-07-18',
      effectiveTimeZone: 'Asia/Shanghai',
      requestedAt: '2026-07-17T10:20:30.123Z',
      reasonCode: 'data_minimization',
      operatorReference: 'operator-a',
    },
  };
}

describe('raw data retention policy domain', () => {
  it('冻结统一策略键、默认值和获准范围', () => {
    expect(RAW_DATA_RETENTION_POLICY_KEY).toBe('raw_conversation_and_qa_preview');
    expect(RAW_DATA_RETENTION_DEFAULT_DAYS).toBe(180);
    expect(RAW_DATA_RETENTION_MIN_DAYS).toBe(90);
    expect(RAW_DATA_RETENTION_MAX_DAYS).toBe(365);
  });

  it('解析 ready/stale 权威快照并深复制、深冻结', () => {
    const input = readySnapshot();
    const before = structuredClone(input);
    const result = parseRawDataRetentionPolicySnapshot(input);

    expect(result).toEqual({ ok: true, snapshot: before });
    if (!result.ok) throw new Error(result.code);

    expect(result.snapshot).not.toBe(input);
    expect(result.snapshot.scope).not.toBe(input.scope);
    if (result.snapshot.readiness !== 'ready') throw new Error('expected ready snapshot');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.snapshot)).toBe(true);
    expect(Object.isFrozen(result.snapshot.scope)).toBe(true);
    expect(Object.isFrozen(result.snapshot.current)).toBe(true);
    expect(Object.isFrozen(result.snapshot.pending)).toBe(true);

    input.current.retentionDays = 365;
    input.pending!.targetRetentionDays = 365;
    expect(result.snapshot).toEqual(before);

    const stale = parseRawDataRetentionPolicySnapshot({ ...before, readiness: 'stale' });
    expect(stale.ok).toBe(true);
  });

  it.each([
    'partial',
    'unavailable',
    'invalid',
    'denied',
    'disabled',
    'scope_mismatch',
  ])('%s 只允许 readiness 和 scope', (readiness) => {
    const result = parseRawDataRetentionPolicySnapshot({ readiness, scope });
    expect(result).toEqual({ ok: true, snapshot: { readiness, scope } });

    expect(parseRawDataRetentionPolicySnapshot({
      readiness,
      scope,
      revision: 'must-not-leak',
    })).toEqual({ ok: false, code: 'invalid_input' });
  });

  it.each([
    { name: '产品默认天数非 180', mutate: (value: ReturnType<typeof readySnapshot>) => { value.current.retentionDays = 179; } },
    { name: '机构配置小于 90', mutate: (value: ReturnType<typeof readySnapshot>) => { value.current = { retentionDays: 89, source: 'institution_config' }; } },
    { name: '机构配置大于 365', mutate: (value: ReturnType<typeof readySnapshot>) => { value.current = { retentionDays: 366, source: 'institution_config' }; } },
    { name: '待生效天数越界', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.targetRetentionDays = 89; } },
    { name: 'revision 含首尾空格', mutate: (value: ReturnType<typeof readySnapshot>) => { value.revision = ' revision-1'; } },
    { name: '标识超过 256 字符', mutate: (value: ReturnType<typeof readySnapshot>) => { value.scope.tenantId = 'x'.repeat(257); } },
    { name: 'ISO 时间缺少时区', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.effectiveAt = '2026-07-18T00:00:00'; } },
    { name: '无效日历日期', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.effectiveBusinessDate = '2026-02-30'; } },
    { name: '无效时区', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.effectiveTimeZone = 'Asia/Not_A_Zone'; } },
    { name: '待生效 reason 使用撤回原因', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.reasonCode = 'withdraw_pending_change'; } },
    { name: '待生效值与当前值相同', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.targetRetentionDays = 180; } },
    { name: 'effectiveAt 与业务日期矛盾', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.effectiveBusinessDate = '2026-07-19'; } },
    { name: 'effectiveAt 不是机构零点', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.effectiveAt = '2026-07-18T00:00:01+08:00'; } },
    { name: 'requestedAt 等于 effectiveAt', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.requestedAt = '2026-07-17T16:00:00Z'; } },
    { name: 'requestedAt 晚于 effectiveAt', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.requestedAt = '2026-07-18T00:00:01Z'; } },
    { name: '请求日与生效业务日相隔两天', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.effectiveAt = '2026-07-19T00:00:00+08:00'; value.pending!.effectiveBusinessDate = '2026-07-19'; } },
    { name: 'operator 是邮箱', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.operatorReference = 'person@example.com'; } },
    { name: 'operator 是纯手机号', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.operatorReference = '13800138000'; } },
    { name: 'operator 是 16 位纯数字', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.operatorReference = '1'.repeat(16); } },
    { name: 'operator 是 18 位纯数字', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.operatorReference = '1'.repeat(18); } },
    { name: 'operator 是 19 位纯数字', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.operatorReference = '1'.repeat(19); } },
    { name: 'operator 是带空格姓名', mutate: (value: ReturnType<typeof readySnapshot>) => { value.pending!.operatorReference = 'Alice Smith'; } },
    { name: '标识是 URL 路径', mutate: (value: ReturnType<typeof readySnapshot>) => { value.scope.tenantId = 'https://tenant-a'; } },
    { name: '标识包含控制字符', mutate: (value: ReturnType<typeof readySnapshot>) => { value.scope.tenantId = 'tenant\na'; } },
  ])('拒绝$name', ({ mutate }) => {
    const value = readySnapshot();
    mutate(value);
    expect(parseRawDataRetentionPolicySnapshot(value)).toEqual({
      ok: false,
      code: 'invalid_input',
    });
  });

  it('接受合法边界、null prototype 普通对象和 null pending', () => {
    for (const retentionDays of [90, 365]) {
      const value = readySnapshot();
      value.current = { retentionDays, source: 'institution_config' };
      value.pending = null;
      value.scope = Object.assign(Object.create(null), scope);
      expect(parseRawDataRetentionPolicySnapshot(value).ok).toBe(true);
    }
  });

  it.each([
    {
      name: '跨月',
      requestedAt: '2026-07-31T12:00:00+08:00',
      effectiveAt: '2026-08-01T00:00:00+08:00',
      effectiveBusinessDate: '2026-08-01',
      effectiveTimeZone: 'Asia/Shanghai',
    },
    {
      name: '跨年',
      requestedAt: '2026-12-31T12:00:00+08:00',
      effectiveAt: '2027-01-01T00:00:00+08:00',
      effectiveBusinessDate: '2027-01-01',
      effectiveTimeZone: 'Asia/Shanghai',
    },
    {
      name: 'DST 切换',
      requestedAt: '2026-03-08T01:30:00-05:00',
      effectiveAt: '2026-03-09T00:00:00-04:00',
      effectiveBusinessDate: '2026-03-09',
      effectiveTimeZone: 'America/New_York',
    },
  ])('接受请求机构业务日的下一自然日生效：$name', ({
    requestedAt,
    effectiveAt,
    effectiveBusinessDate,
    effectiveTimeZone,
  }) => {
    const value = readySnapshot();
    value.pending = {
      ...value.pending!,
      requestedAt,
      effectiveAt,
      effectiveBusinessDate,
      effectiveTimeZone,
    };
    expect(parseRawDataRetentionPolicySnapshot(value).ok).toBe(true);
  });

  it('严格拒绝 extra、symbol、accessor、proxy、数组和非普通原型，且 accessor/proxy 零读取', () => {
    const symbol = Symbol('extra');
    expect(parseRawDataRetentionPolicySnapshot({ ...readySnapshot(), extra: true })).toEqual({ ok: false, code: 'invalid_input' });
    expect(parseRawDataRetentionPolicySnapshot({ ...readySnapshot(), [symbol]: true })).toEqual({ ok: false, code: 'invalid_input' });
    expect(parseRawDataRetentionPolicySnapshot([])).toEqual({ ok: false, code: 'invalid_input' });
    expect(parseRawDataRetentionPolicySnapshot(new Date())).toEqual({ ok: false, code: 'invalid_input' });

    let getterReads = 0;
    const accessor = readySnapshot();
    Object.defineProperty(accessor, 'revision', {
      enumerable: true,
      get() {
        getterReads += 1;
        return 'revision-1';
      },
    });
    expect(parseRawDataRetentionPolicySnapshot(accessor)).toEqual({ ok: false, code: 'invalid_input' });
    expect(getterReads).toBe(0);

    let proxyReads = 0;
    const proxy = new Proxy(readySnapshot(), {
      get(target, key, receiver) {
        proxyReads += 1;
        return Reflect.get(target, key, receiver);
      },
      ownKeys(target) {
        proxyReads += 1;
        return Reflect.ownKeys(target);
      },
    });
    expect(parseRawDataRetentionPolicySnapshot(proxy)).toEqual({ ok: false, code: 'invalid_input' });
    expect(proxyReads).toBe(0);
  });
});
