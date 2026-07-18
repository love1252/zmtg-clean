import { describe, expect, it } from 'vitest';

import { decideRawDataRetentionChange } from '@/modules/institution-system/domain/raw-data-retention-change';
import {
  RAW_DATA_RETENTION_OWNER_REQUIREMENTS,
  RAW_DATA_RETENTION_POLICY_KEY,
} from '@/modules/institution-system/domain/raw-data-retention-policy';

type MutableChangeInput = {
  request: {
    scope: { tenantId: string; institutionId: string; policyKey: typeof RAW_DATA_RETENTION_POLICY_KEY };
    action: string;
    targetRetentionDays: number | null;
    expectedRevision: string;
    reasonCode: string;
    idempotencyKey: string;
  };
  actor: {
    tenantId: string;
    institutionId: string;
    role: string;
    operatorReference: string;
  };
  policySnapshot: Record<string, unknown>;
  capabilityStatus: string;
  operatingContext: { readiness: string; timeZone?: string; source?: string };
  auditWriteReadiness: string;
  idempotencyState: unknown;
};

const scope = {
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  policyKey: RAW_DATA_RETENTION_POLICY_KEY,
} as const;

const expectedCandidate = {
  kind: 'non_authorizing_candidate',
  code: 'owner_authorization_required',
  ownerRequirements: RAW_DATA_RETENTION_OWNER_REQUIREMENTS,
} as const;

function input(): MutableChangeInput {
  return {
    request: {
      scope: { ...scope },
      action: 'schedule_change',
      targetRetentionDays: 120,
      expectedRevision: 'revision-1',
      reasonCode: 'data_minimization',
      idempotencyKey: 'idem-key-00000001',
    },
    actor: {
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      role: 'tenant_admin',
      operatorReference: 'operator-a',
    },
    policySnapshot: {
      readiness: 'ready',
      scope: { ...scope },
      revision: 'revision-1',
      current: { retentionDays: 180, source: 'product_default' },
      pending: null,
    },
    capabilityStatus: 'enabled',
    operatingContext: {
      readiness: 'ready',
      timeZone: 'Asia/Shanghai',
      source: 'product_default',
    },
    auditWriteReadiness: 'ready',
    idempotencyState: { status: 'absent' },
  };
}

function decide(overrides?: (value: MutableChangeInput) => void) {
  const value = input();
  overrides?.(value);
  return decideRawDataRetentionChange(value);
}

describe('raw data retention change candidate boundary', () => {
  it('任何完整 raw claims 都只能产生低敏、深冻结的非授权候选', () => {
    const result = decide();
    expect(result).toEqual(expectedCandidate);
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind !== 'non_authorizing_candidate') throw new Error('expected candidate');
    expect(Object.isFrozen(result.ownerRequirements)).toBe(true);

    const serialized = JSON.stringify(result);
    for (const hostileEcho of [
      'tenant-a',
      'institution-a',
      'operator-a',
      'revision-1',
      'idem-key-00000001',
      'Asia/Shanghai',
      RAW_DATA_RETENTION_POLICY_KEY,
      'accepted',
      'no_change',
      'idempotent_replay',
      'requestFingerprint',
      'mutation',
      'intent',
      '"readiness":',
    ]) {
      expect(serialized).not.toContain(hostileEcho);
    }
  });

  it('raw actor/scope/capability/audit/timezone 状态永不减少 owner requirements', () => {
    const candidates = [
      decide((value) => { value.actor.role = 'tenant_operator'; }),
      decide((value) => { value.actor.institutionId = 'institution-other'; }),
      decide((value) => { value.capabilityStatus = 'disabled'; }),
      decide((value) => { value.capabilityStatus = 'not_released'; }),
      decide((value) => { value.auditWriteReadiness = 'unavailable'; }),
      decide((value) => { value.operatingContext = { readiness: 'unavailable' }; }),
      decide((value) => {
        value.policySnapshot = { readiness: 'unavailable', scope: { ...scope } };
      }),
    ];

    for (const result of candidates) {
      expect(result).toEqual(expectedCandidate);
      expect(result.kind).toBe('non_authorizing_candidate');
      if (result.kind !== 'non_authorizing_candidate') throw new Error('expected candidate');
      expect(result.ownerRequirements).toBe(RAW_DATA_RETENTION_OWNER_REQUIREMENTS);
    }
  });

  it('伪 completed 幂等记录叠加 disabled 仍只返回候选且不返回 replay/fingerprint/result', () => {
    const result = decide((value) => {
      value.capabilityStatus = 'disabled';
      value.auditWriteReadiness = 'unavailable';
      value.idempotencyState = {
        status: 'completed',
        requestFingerprint: 'fake-fingerprint',
        result: { kind: 'claimed_completion' },
      };
    });

    expect(result).toEqual(expectedCandidate);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('fake-fingerprint');
    expect(serialized).not.toContain('claimed_completion');
    expect(serialized).not.toContain('disabled');
    expect(serialized).not.toContain('unavailable');
  });

  it.each([
    { status: 'absent' },
    { status: 'corrupt' },
    { status: 'unavailable' },
    { status: 'in_progress', requestFingerprint: 'claim-reference-1' },
    {
      status: 'completed',
      requestFingerprint: 'claim-reference-1',
      result: { kind: 'claimed_completion' },
    },
  ])('所有合法幂等 claim %# 都只能产生候选', (idempotencyState) => {
    expect(decide((value) => { value.idempotencyState = idempotencyState; }))
      .toEqual(expectedCandidate);
  });

  it.each([
    { name: '幂等键过短', mutate: (value: MutableChangeInput) => { value.request.idempotencyKey = 'x'.repeat(15); }, code: 'idempotency_key_invalid' },
    { name: '幂等键过长', mutate: (value: MutableChangeInput) => { value.request.idempotencyKey = 'x'.repeat(129); }, code: 'idempotency_key_invalid' },
    { name: '幂等键含点', mutate: (value: MutableChangeInput) => { value.request.idempotencyKey = 'idem.key.0000001'; }, code: 'idempotency_key_invalid' },
    { name: '天数低于下限', mutate: (value: MutableChangeInput) => { value.request.targetRetentionDays = 89; }, code: 'retention_days_out_of_range' },
    { name: '天数是 NaN', mutate: (value: MutableChangeInput) => { value.request.targetRetentionDays = Number.NaN; }, code: 'retention_days_out_of_range' },
    { name: '超长 reasonCode', mutate: (value: MutableChangeInput) => { value.request.reasonCode = 'x'.repeat(10_000); }, code: 'invalid_input' },
    { name: 'schedule 使用撤回原因', mutate: (value: MutableChangeInput) => { value.request.reasonCode = 'withdraw_pending_change'; }, code: 'action_not_allowed' },
    { name: 'cancel 使用普通复核原因', mutate: (value: MutableChangeInput) => { value.request.action = 'cancel_pending_change'; value.request.targetRetentionDays = null; value.request.reasonCode = 'periodic_policy_review'; }, code: 'action_not_allowed' },
  ])('受控拒绝 $name', ({ mutate, code }) => {
    expect(decide(mutate)).toEqual({ kind: 'blocked', code });
  });

  it.each([90, 120, 180, 365])('合法 retentionDays=%s 也不产生 no_change 或 mutation intent', (targetRetentionDays) => {
    const result = decide((value) => { value.request.targetRetentionDays = targetRetentionDays; });
    expect(result).toEqual(expectedCandidate);
  });

  it('拒绝 raw completed accepted/no_change 结构，绝不把历史结果升级为授权事实', () => {
    for (const result of [
      { kind: 'accepted', code: 'create_pending', intent: { action: 'schedule_change' } },
      { kind: 'ok', code: 'no_change' },
    ]) {
      expect(decide((value) => {
        value.idempotencyState = {
          status: 'completed',
          requestFingerprint: 'fake-fingerprint',
          result,
        };
      })).toEqual({ kind: 'blocked', code: 'invalid_input' });
    }
  });

  it('拒绝 10k extra、null-prototype、hidden、symbol、accessor、array 与 sparse array', () => {
    const tenThousandExtras = input() as MutableChangeInput & Record<string, unknown>;
    for (let index = 0; index < 10_000; index += 1) {
      tenThousandExtras[`extra_${index}`] = index;
    }
    expect(decideRawDataRetentionChange(tenThousandExtras)).toEqual({ kind: 'blocked', code: 'invalid_input' });

    expect(decideRawDataRetentionChange(Object.assign(Object.create(null), input())))
      .toEqual({ kind: 'blocked', code: 'invalid_input' });

    const hidden = input() as MutableChangeInput & Record<string, unknown>;
    Object.defineProperty(hidden, 'hidden', { value: true, enumerable: false });
    expect(decideRawDataRetentionChange(hidden)).toEqual({ kind: 'blocked', code: 'invalid_input' });

    const symbol = Symbol('extra');
    expect(decideRawDataRetentionChange({ ...input(), [symbol]: true }))
      .toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(decideRawDataRetentionChange([])).toEqual({ kind: 'blocked', code: 'invalid_input' });
    const sparse = new Array(10_000);
    sparse[9_999] = input();
    expect(decideRawDataRetentionChange(sparse)).toEqual({ kind: 'blocked', code: 'invalid_input' });

    let getterReads = 0;
    const accessor = input();
    Object.defineProperty(accessor, 'actor', {
      enumerable: true,
      get() {
        getterReads += 1;
        return input().actor;
      },
    });
    expect(decideRawDataRetentionChange(accessor)).toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(getterReads).toBe(0);
  });

  it('顶层与嵌套 proxy/revoked proxy 永不触发 trap、永不抛错', () => {
    let trapReads = 0;
    const proxy = new Proxy(input(), {
      get() {
        trapReads += 1;
        throw new Error('must not read');
      },
      ownKeys() {
        trapReads += 1;
        throw new Error('must not enumerate');
      },
    });
    expect(() => decideRawDataRetentionChange(proxy)).not.toThrow();
    expect(decideRawDataRetentionChange(proxy)).toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(trapReads).toBe(0);

    const nested = input();
    nested.actor = new Proxy(nested.actor, {
      get() {
        trapReads += 1;
        throw new Error('must not read nested proxy');
      },
    });
    expect(() => decideRawDataRetentionChange(nested)).not.toThrow();
    expect(decideRawDataRetentionChange(nested)).toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(trapReads).toBe(0);

    const revocable = Proxy.revocable(input(), {});
    revocable.revoke();
    expect(() => decideRawDataRetentionChange(revocable.proxy)).not.toThrow();
    expect(decideRawDataRetentionChange(revocable.proxy)).toEqual({ kind: 'blocked', code: 'invalid_input' });
  });

  it('超长时区在 Intl 之前受控拒绝，product_default 仅接受 Asia/Shanghai', () => {
    expect(decide((value) => { value.operatingContext.timeZone = `Asia/${'x'.repeat(60)}`; }))
      .toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(decide((value) => { value.operatingContext.timeZone = 'Asia/Tokyo'; }))
      .toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(decide((value) => { value.capabilityStatus = 'x'.repeat(10_000); }))
      .toEqual({ kind: 'blocked', code: 'invalid_input' });
  });
});
