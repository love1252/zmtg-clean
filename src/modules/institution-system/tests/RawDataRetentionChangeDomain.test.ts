import { describe, expect, it } from 'vitest';

import { decideRawDataRetentionChange } from '@/modules/institution-system/domain/raw-data-retention-change';
import { RAW_DATA_RETENTION_POLICY_KEY } from '@/modules/institution-system/domain/raw-data-retention-policy';

const scope = {
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
  policyKey: RAW_DATA_RETENTION_POLICY_KEY,
} as const;

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
  policySnapshot: {
    readiness: string;
    scope: { tenantId: string; institutionId: string; policyKey: typeof RAW_DATA_RETENTION_POLICY_KEY };
    revision?: string;
    current?: { retentionDays: number; source: string };
    pending?: null | {
      targetRetentionDays: number;
      effectiveAt: string;
      effectiveBusinessDate: string;
      effectiveTimeZone: string;
      requestedAt: string;
      reasonCode: string;
      operatorReference: string;
    };
  };
  capabilityStatus: string;
  operatingContext: { readiness: string; timeZone?: string; source?: string };
  auditWriteReadiness: string;
  idempotencyState: unknown;
};

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

function decide(overrides?: (value: ReturnType<typeof input>) => void) {
  const value = input();
  overrides?.(value);
  return decideRawDataRetentionChange(value);
}

function requestFingerprintFor(value: MutableChangeInput): string {
  const values = [
    value.request.scope.tenantId,
    value.request.scope.institutionId,
    value.request.scope.policyKey,
    value.request.action,
    value.request.targetRetentionDays === null ? 'null' : String(value.request.targetRetentionDays),
    value.request.expectedRevision,
    value.request.reasonCode,
    value.actor.operatorReference,
  ];
  return values.map((part) => `${part.length}:${part}`).join('|');
}

describe('raw data retention change domain', () => {
  it('无 pending 时创建下一机构日历日零点生效的意图，且不返回幂等键', () => {
    const result = decide();

    expect(result).toEqual({
      kind: 'accepted',
      code: 'create_pending',
      requestFingerprint: expect.any(String),
      intent: {
        action: 'schedule_change',
        policyKey: RAW_DATA_RETENTION_POLICY_KEY,
        targetRetentionDays: 120,
        reasonCode: 'data_minimization',
        operatorReference: 'operator-a',
        expectedRevision: 'revision-1',
        activationPolicy: {
          kind: 'next_institution_calendar_day_midnight',
          timeZone: 'Asia/Shanghai',
          timeZoneSource: 'product_default',
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('idem-key-00000001');
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.kind === 'accepted' && Object.isFrozen(result.intent)).toBe(true);
  });

  it('pending 存在时支持 replace、cancel 和确定性 no_change', () => {
    const addPending = (value: ReturnType<typeof input>) => {
      value.policySnapshot.pending = {
        targetRetentionDays: 150,
        effectiveAt: '2026-07-18T00:00:00+08:00',
        effectiveBusinessDate: '2026-07-18',
        effectiveTimeZone: 'Asia/Shanghai',
        requestedAt: '2026-07-17T10:00:00Z',
        reasonCode: 'periodic_policy_review',
        operatorReference: 'operator-old',
      };
    };

    expect(decide(addPending)).toMatchObject({ kind: 'accepted', code: 'replace_pending' });
    expect(decide((value) => {
      addPending(value);
      value.request.targetRetentionDays = 150;
    })).toEqual({ kind: 'ok', code: 'no_change' });
    expect(decide((value) => {
      addPending(value);
      value.request.action = 'cancel_pending_change';
      value.request.targetRetentionDays = null;
      value.request.reasonCode = 'withdraw_pending_change';
    })).toMatchObject({
      kind: 'accepted',
      code: 'cancel_pending',
      intent: { action: 'cancel_pending_change', targetRetentionDays: null },
    });
    expect(decide((value) => {
      value.request.action = 'cancel_pending_change';
      value.request.targetRetentionDays = null;
      value.request.reasonCode = 'withdraw_pending_change';
    })).toEqual({ kind: 'ok', code: 'no_change' });
  });

  it('pending 时不得用 schedule 把目标改回 current', () => {
    expect(decide((value) => {
      value.policySnapshot.pending = {
        targetRetentionDays: 120,
        effectiveAt: '2026-07-18T00:00:00+08:00',
        effectiveBusinessDate: '2026-07-18',
        effectiveTimeZone: 'Asia/Shanghai',
        requestedAt: '2026-07-17T10:00:00Z',
        reasonCode: 'data_minimization',
        operatorReference: 'operator-old',
      };
      value.request.targetRetentionDays = 180;
    })).toEqual({ kind: 'blocked', code: 'action_not_allowed' });
  });

  it.each([
    ['scope_mismatch', (value: ReturnType<typeof input>) => { value.actor.institutionId = 'institution-b'; }],
    ['permission_denied', (value: ReturnType<typeof input>) => { value.actor.role = 'tenant_operator'; }],
    ['capability_disabled', (value: ReturnType<typeof input>) => { value.capabilityStatus = 'disabled'; }],
    ['not_released', (value: ReturnType<typeof input>) => { value.capabilityStatus = 'not_released'; }],
    ['source_unavailable', (value: ReturnType<typeof input>) => { value.policySnapshot = { readiness: 'unavailable', scope: { ...scope } } as never; }],
    ['source_partial', (value: ReturnType<typeof input>) => { value.policySnapshot = { readiness: 'partial', scope: { ...scope } } as never; }],
    ['source_stale', (value: ReturnType<typeof input>) => { value.policySnapshot.readiness = 'stale'; }],
    ['source_denied', (value: ReturnType<typeof input>) => { value.policySnapshot = { readiness: 'denied', scope: { ...scope } } as never; }],
    ['source_disabled', (value: ReturnType<typeof input>) => { value.policySnapshot = { readiness: 'disabled', scope: { ...scope } } as never; }],
    ['source_invalid', (value: ReturnType<typeof input>) => { value.policySnapshot = { readiness: 'invalid', scope: { ...scope } } as never; }],
    ['operating_context_unavailable', (value: ReturnType<typeof input>) => { value.operatingContext = { readiness: 'unavailable' } as never; }],
    ['revision_conflict', (value: ReturnType<typeof input>) => { value.request.expectedRevision = 'revision-old'; }],
    ['retention_days_out_of_range', (value: ReturnType<typeof input>) => { value.request.targetRetentionDays = 89; }],
    ['action_not_allowed', (value: ReturnType<typeof input>) => { value.request.reasonCode = 'withdraw_pending_change'; }],
    ['audit_unavailable', (value: ReturnType<typeof input>) => { value.auditWriteReadiness = 'unavailable'; }],
  ])('返回受控阻断码 %s', (code, mutate) => {
    expect(decide(mutate)).toEqual({ kind: 'blocked', code });
  });

  it('严格保持错误优先级', () => {
    expect(decide((value) => {
      value.actor.institutionId = 'institution-b';
      value.actor.role = 'tenant_operator';
      value.capabilityStatus = 'disabled';
      value.auditWriteReadiness = 'unavailable';
    })).toEqual({ kind: 'blocked', code: 'scope_mismatch' });

    expect(decide((value) => {
      value.actor.role = 'tenant_operator';
      value.idempotencyState = { status: 'unavailable' };
      value.capabilityStatus = 'disabled';
    })).toEqual({ kind: 'blocked', code: 'permission_denied' });

    expect(decide((value) => {
      value.request.targetRetentionDays = 180;
      value.auditWriteReadiness = 'unavailable';
    })).toEqual({ kind: 'ok', code: 'no_change' });
  });

  it('幂等状态在权限之后、capability 之前处理 replay/conflict/in-progress/corrupt/unavailable', () => {
    const originalResult = {
      kind: 'ok',
      code: 'no_change',
    } as const;
    const initial = decide();
    if (initial.kind !== 'accepted') throw new Error('expected accepted');

    expect(decide((value) => {
      value.idempotencyState = {
        status: 'completed',
        requestFingerprint: initial.requestFingerprint,
        result: originalResult,
      };
      value.capabilityStatus = 'disabled';
    })).toEqual({ kind: 'ok', code: 'idempotent_replay', originalResult });

    expect(decide((value) => {
      value.idempotencyState = { status: 'completed', requestFingerprint: 'different', result: originalResult };
    })).toEqual({ kind: 'blocked', code: 'idempotency_conflict' });
    expect(decide((value) => {
      value.idempotencyState = { status: 'in_progress', requestFingerprint: initial.requestFingerprint };
    })).toEqual({ kind: 'blocked', code: 'idempotency_in_progress' });
    expect(decide((value) => { value.idempotencyState = { status: 'corrupt' }; })).toEqual({ kind: 'blocked', code: 'idempotency_corrupt' });
    expect(decide((value) => { value.idempotencyState = { status: 'unavailable' }; })).toEqual({ kind: 'blocked', code: 'idempotency_unavailable' });
  });

  it.each([
    ['policyKey', (result: Record<string, unknown>, intent: Record<string, unknown>) => { intent.policyKey = 'other_policy'; }],
    ['action', (result: Record<string, unknown>, intent: Record<string, unknown>) => { result.code = 'cancel_pending'; intent.action = 'cancel_pending_change'; intent.targetRetentionDays = null; }],
    ['target', (_result: Record<string, unknown>, intent: Record<string, unknown>) => { intent.targetRetentionDays = 121; }],
    ['reason', (_result: Record<string, unknown>, intent: Record<string, unknown>) => { intent.reasonCode = 'service_continuity'; }],
    ['operator', (_result: Record<string, unknown>, intent: Record<string, unknown>) => { intent.operatorReference = 'operator-b'; }],
    ['revision', (_result: Record<string, unknown>, intent: Record<string, unknown>) => { intent.expectedRevision = 'revision-2'; }],
  ])('fingerprint 相同但 completed accepted 的 %s 不匹配时视为 corrupt', (_name, mutate) => {
    const accepted = decide();
    if (accepted.kind !== 'accepted') throw new Error('expected accepted');
    const originalResult = {
      kind: 'accepted',
      code: 'create_pending',
      intent: structuredClone(accepted.intent),
    };
    mutate(
      originalResult as unknown as Record<string, unknown>,
      originalResult.intent as unknown as Record<string, unknown>,
    );

    expect(decide((value) => {
      value.idempotencyState = {
        status: 'completed',
        requestFingerprint: accepted.requestFingerprint,
        result: originalResult,
      } as never;
    })).toEqual({ kind: 'blocked', code: 'idempotency_corrupt' });
  });

  it('fingerprint 稳定绑定低敏请求字段而不绑定 raw idempotencyKey', () => {
    const first = decide();
    const second = decide((value) => { value.request.idempotencyKey = 'another-key-00001'; });
    expect(first.kind).toBe('accepted');
    expect(second.kind).toBe('accepted');
    if (first.kind === 'accepted' && second.kind === 'accepted') {
      expect(first.requestFingerprint).toBe(second.requestFingerprint);
    }
  });

  it('completed accepted 即使 fingerprint 相同也拒绝 schedule + withdraw 非法语义', () => {
    const value = input();
    value.request.reasonCode = 'withdraw_pending_change';
    const originalResult = {
      kind: 'accepted',
      code: 'create_pending',
      intent: {
        action: 'schedule_change',
        policyKey: RAW_DATA_RETENTION_POLICY_KEY,
        targetRetentionDays: 120,
        reasonCode: 'withdraw_pending_change',
        operatorReference: 'operator-a',
        expectedRevision: 'revision-1',
        activationPolicy: {
          kind: 'next_institution_calendar_day_midnight',
          timeZone: 'Asia/Shanghai',
          timeZoneSource: 'product_default',
        },
      },
    };
    value.idempotencyState = {
      status: 'completed',
      requestFingerprint: requestFingerprintFor(value),
      result: originalResult,
    };

    expect(decideRawDataRetentionChange(value)).toEqual({
      kind: 'blocked',
      code: 'idempotency_corrupt',
    });
  });

  it('completed no_change 即使 fingerprint 相同也拒绝越界 retentionDays', () => {
    const value = input();
    value.request.targetRetentionDays = 89;
    value.idempotencyState = {
      status: 'completed',
      requestFingerprint: requestFingerprintFor(value),
      result: { kind: 'ok', code: 'no_change' },
    };

    expect(decideRawDataRetentionChange(value)).toEqual({
      kind: 'blocked',
      code: 'idempotency_corrupt',
    });
  });

  it.each([
    'x'.repeat(15),
    'x'.repeat(129),
    'idem.key.0000001',
    'idem:key:0000001',
    'idem/key/0000001',
    'idem key 0000001',
  ])('幂等键 %s 非法时返回专用错误', (idempotencyKey) => {
    expect(decide((value) => { value.request.idempotencyKey = idempotencyKey; })).toEqual({
      kind: 'blocked',
      code: 'idempotency_key_invalid',
    });
  });

  it.each([
    'x'.repeat(16),
    'x'.repeat(128),
    '_idem-key-0000001',
    '-idem-key-0000001',
  ])('幂等键 %s 符合精确闭集与边界', (idempotencyKey) => {
    expect(decide((value) => { value.request.idempotencyKey = idempotencyKey; })).toMatchObject({
      kind: 'accepted',
      code: 'create_pending',
    });
  });

  it.each([
    { name: '最小边界', value: 90, expected: 'accepted' },
    { name: '产品默认值', value: 180, expected: 'ok' },
    { name: '最大边界', value: 365, expected: 'accepted' },
    { name: '低于最小值', value: 89, expected: 'retention_days_out_of_range' },
    { name: '高于最大值', value: 366, expected: 'retention_days_out_of_range' },
    { name: '小数', value: 120.5, expected: 'retention_days_out_of_range' },
    { name: 'NaN', value: Number.NaN, expected: 'retention_days_out_of_range' },
    { name: 'Infinity', value: Number.POSITIVE_INFINITY, expected: 'retention_days_out_of_range' },
    { name: '负零', value: -0, expected: 'retention_days_out_of_range' },
  ])('retentionDays $name 保持业务结果', ({ value, expected }) => {
    const result = decide((candidate) => { candidate.request.targetRetentionDays = value; });
    if (expected === 'accepted') {
      expect(result).toMatchObject({ kind: 'accepted', code: 'create_pending' });
    } else if (expected === 'ok') {
      expect(result).toEqual({ kind: 'ok', code: 'no_change' });
    } else {
      expect(result).toEqual({ kind: 'blocked', code: expected });
    }
  });

  it.each([
    'person@example.com',
    '13800138000',
    '1'.repeat(16),
    '1'.repeat(18),
    '1'.repeat(19),
    'Alice Smith',
  ])('operatorReference 拒绝高敏或自由文本 %s', (operatorReference) => {
    expect(decide((value) => { value.actor.operatorReference = operatorReference; })).toEqual({
      kind: 'blocked',
      code: 'invalid_input',
    });
  });

  it('严格拒绝 extra/accessor/proxy，且 accessor/proxy 零读取', () => {
    expect(decideRawDataRetentionChange({ ...input(), extra: true })).toEqual({ kind: 'blocked', code: 'invalid_input' });

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

    let proxyReads = 0;
    const proxy = new Proxy(input(), {
      get(target, key, receiver) {
        proxyReads += 1;
        return Reflect.get(target, key, receiver);
      },
      ownKeys(target) {
        proxyReads += 1;
        return Reflect.ownKeys(target);
      },
    });
    expect(decideRawDataRetentionChange(proxy)).toEqual({ kind: 'blocked', code: 'invalid_input' });
    expect(proxyReads).toBe(0);
  });

  it('product_default operating context 只允许 Asia/Shanghai', () => {
    expect(decide((value) => { value.operatingContext.timeZone = 'Asia/Tokyo'; })).toEqual({
      kind: 'blocked',
      code: 'invalid_input',
    });
  });
});
