import { describe, expect, it } from 'vitest';

import {
  parseRawDataRetentionPolicySnapshot,
  RAW_DATA_RETENTION_DEFAULT_DAYS,
  RAW_DATA_RETENTION_MAX_DAYS,
  RAW_DATA_RETENTION_MIN_DAYS,
  RAW_DATA_RETENTION_OWNER_REQUIREMENTS,
  RAW_DATA_RETENTION_POLICY_KEY,
} from '@/modules/institution-system/domain/raw-data-retention-policy';

type MutablePolicyClaim = {
  readiness: string;
  scope: {
    tenantId: string;
    institutionId: string;
    policyKey: typeof RAW_DATA_RETENTION_POLICY_KEY;
  };
  revision: string;
  current: { retentionDays: number; source: string };
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

const scope = {
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  policyKey: RAW_DATA_RETENTION_POLICY_KEY,
} as const;

const expectedCandidate = {
  kind: 'non_authorizing_candidate',
  code: 'owner_evidence_required',
  ownerRequirements: RAW_DATA_RETENTION_OWNER_REQUIREMENTS,
} as const;

function readyClaim(): MutablePolicyClaim {
  return {
    readiness: 'ready',
    scope: { ...scope },
    revision: 'revision-1',
    current: { retentionDays: 180, source: 'product_default' },
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

describe('raw data retention policy claim boundary', () => {
  it('冻结获准常量与不可减少的 owner requirements', () => {
    expect(RAW_DATA_RETENTION_POLICY_KEY).toBe('raw_conversation_and_qa_preview');
    expect(RAW_DATA_RETENTION_DEFAULT_DAYS).toBe(180);
    expect(RAW_DATA_RETENTION_MIN_DAYS).toBe(90);
    expect(RAW_DATA_RETENTION_MAX_DAYS).toBe(365);
    expect(RAW_DATA_RETENTION_OWNER_REQUIREMENTS).toEqual([
      'authenticated_actor_identity',
      'fresh_institution_membership',
      'institution_scope_allow',
      'object_scope_allow',
      'capability_evidence',
      'release_evidence',
      'current_policy_revision_with_ttl',
      'trusted_institution_time_zone',
      'independent_server_reference_time',
      'audit_writer_readiness',
      'authoritative_idempotency_record',
      'atomic_policy_change_transaction',
    ]);
    expect(Object.isFrozen(RAW_DATA_RETENTION_OWNER_REQUIREMENTS)).toBe(true);
  });

  it('只把 ready/stale raw 快照视为非授权候选，不回显任何 raw 值', () => {
    for (const readiness of ['ready', 'stale']) {
      const value = readyClaim();
      value.readiness = readiness;
      const result = parseRawDataRetentionPolicySnapshot(value);

      expect(result).toEqual(expectedCandidate);
      expect(Object.isFrozen(result)).toBe(true);
      if (result.kind !== 'non_authorizing_candidate') throw new Error('expected candidate');
      expect(Object.isFrozen(result.ownerRequirements)).toBe(true);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('tenant-a');
      expect(serialized).not.toContain('institution-a');
      expect(serialized).not.toContain('revision-1');
      expect(serialized).not.toContain('operator-a');
      expect(serialized).not.toContain('Asia/Shanghai');
      expect(serialized).not.toContain(RAW_DATA_RETENTION_POLICY_KEY);
      expect(serialized).not.toContain('"readiness":');
    }
  });

  it.each([
    'partial',
    'unavailable',
    'invalid',
    'denied',
    'disabled',
    'scope_mismatch',
  ])('%s raw claim 也只能产生相同的非授权候选', (readiness) => {
    expect(parseRawDataRetentionPolicySnapshot({ readiness, scope: { ...scope } }))
      .toEqual(expectedCandidate);
  });

  it.each([
    { name: '产品默认天数不是 180', mutate: (value: MutablePolicyClaim) => { value.current.retentionDays = 179; } },
    { name: '机构配置小于 90', mutate: (value: MutablePolicyClaim) => { value.current = { retentionDays: 89, source: 'institution_config' }; } },
    { name: '机构配置大于 365', mutate: (value: MutablePolicyClaim) => { value.current = { retentionDays: 366, source: 'institution_config' }; } },
    { name: '待生效天数越界', mutate: (value: MutablePolicyClaim) => { value.pending!.targetRetentionDays = 89; } },
    { name: 'revision 含空格', mutate: (value: MutablePolicyClaim) => { value.revision = ' revision-1'; } },
    { name: '标识超过固定上限', mutate: (value: MutablePolicyClaim) => { value.scope.tenantId = 'x'.repeat(129); } },
    { name: '超长 readiness', mutate: (value: MutablePolicyClaim) => { value.readiness = 'x'.repeat(10_000); } },
    { name: '超长 reasonCode', mutate: (value: MutablePolicyClaim) => { value.pending!.reasonCode = 'x'.repeat(10_000); } },
    { name: 'ISO 时间缺少时区', mutate: (value: MutablePolicyClaim) => { value.pending!.effectiveAt = '2026-07-18T00:00:00'; } },
    { name: '无效日历日期', mutate: (value: MutablePolicyClaim) => { value.pending!.effectiveBusinessDate = '2026-02-30'; } },
    { name: '超长时区', mutate: (value: MutablePolicyClaim) => { value.pending!.effectiveTimeZone = `Asia/${'x'.repeat(60)}`; } },
    { name: '无效时区', mutate: (value: MutablePolicyClaim) => { value.pending!.effectiveTimeZone = 'Asia/Not_A_Zone'; } },
    { name: '生效时间不是机构零点', mutate: (value: MutablePolicyClaim) => { value.pending!.effectiveAt = '2026-07-18T00:00:01+08:00'; } },
    { name: '请求时间晚于生效时间', mutate: (value: MutablePolicyClaim) => { value.pending!.requestedAt = '2026-07-18T00:00:01Z'; } },
    { name: '请求日与生效业务日相隔两天', mutate: (value: MutablePolicyClaim) => { value.pending!.effectiveAt = '2026-07-19T00:00:00+08:00'; value.pending!.effectiveBusinessDate = '2026-07-19'; } },
    { name: '撤回原因伪装待生效策略', mutate: (value: MutablePolicyClaim) => { value.pending!.reasonCode = 'withdraw_pending_change'; } },
    { name: '高敏 operator 邮箱', mutate: (value: MutablePolicyClaim) => { value.pending!.operatorReference = 'person@example.com'; } },
  ])('拒绝 $name', ({ mutate }) => {
    const value = readyClaim();
    mutate(value);
    expect(parseRawDataRetentionPolicySnapshot(value)).toEqual({
      kind: 'blocked',
      code: 'invalid_input',
    });
  });

  it.each([
    {
      name: '最小边界且无 pending',
      mutate: (value: MutablePolicyClaim) => {
        value.current = { retentionDays: 90, source: 'institution_config' };
        value.pending = null;
      },
    },
    {
      name: '最大边界且无 pending',
      mutate: (value: MutablePolicyClaim) => {
        value.current = { retentionDays: 365, source: 'institution_config' };
        value.pending = null;
      },
    },
    {
      name: 'DST 切换后的下一业务日零点',
      mutate: (value: MutablePolicyClaim) => {
        value.pending = {
          ...value.pending!,
          requestedAt: '2026-03-08T01:30:00-05:00',
          effectiveAt: '2026-03-09T00:00:00-04:00',
          effectiveBusinessDate: '2026-03-09',
          effectiveTimeZone: 'America/New_York',
        };
      },
    },
  ])('合法边界仍只产生候选：$name', ({ mutate }) => {
    const value = readyClaim();
    mutate(value);
    expect(parseRawDataRetentionPolicySnapshot(value)).toEqual(expectedCandidate);
  });

  it('拒绝 10k extra、null-prototype、hidden、symbol、accessor、array 和非普通原型', () => {
    const tenThousandExtras = readyClaim() as MutablePolicyClaim & Record<string, unknown>;
    for (let index = 0; index < 10_000; index += 1) {
      tenThousandExtras[`extra_${index}`] = index;
    }
    expect(parseRawDataRetentionPolicySnapshot(tenThousandExtras)).toEqual({ kind: 'blocked', code: 'invalid_input' });

    expect(parseRawDataRetentionPolicySnapshot(Object.assign(Object.create(null), readyClaim())))
      .toEqual({ kind: 'blocked', code: 'invalid_input' });

    const hidden = readyClaim() as MutablePolicyClaim & Record<string, unknown>;
    Object.defineProperty(hidden, 'hidden', { value: true, enumerable: false });
    expect(parseRawDataRetentionPolicySnapshot(hidden)).toEqual({ kind: 'blocked', code: 'invalid_input' });

    const symbol = Symbol('extra');
    expect(parseRawDataRetentionPolicySnapshot({ ...readyClaim(), [symbol]: true }))
      .toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(parseRawDataRetentionPolicySnapshot([])).toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(parseRawDataRetentionPolicySnapshot(new Date())).toEqual({ kind: 'blocked', code: 'invalid_input' });

    let getterReads = 0;
    const accessor = readyClaim();
    Object.defineProperty(accessor, 'revision', {
      enumerable: true,
      get() {
        getterReads += 1;
        return 'revision-1';
      },
    });
    expect(parseRawDataRetentionPolicySnapshot(accessor)).toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(getterReads).toBe(0);
  });

  it('proxy 与 revoked proxy 永不触发 trap、永不抛错', () => {
    let trapReads = 0;
    const proxy = new Proxy(readyClaim(), {
      get() {
        trapReads += 1;
        throw new Error('must not read');
      },
      ownKeys() {
        trapReads += 1;
        throw new Error('must not enumerate');
      },
    });
    expect(() => parseRawDataRetentionPolicySnapshot(proxy)).not.toThrow();
    expect(parseRawDataRetentionPolicySnapshot(proxy)).toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(trapReads).toBe(0);

    const revocable = Proxy.revocable(readyClaim(), {});
    revocable.revoke();
    expect(() => parseRawDataRetentionPolicySnapshot(revocable.proxy)).not.toThrow();
    expect(parseRawDataRetentionPolicySnapshot(revocable.proxy)).toEqual({ kind: 'blocked', code: 'invalid_input' });
  });
});
