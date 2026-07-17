import { describe, expect, it } from 'vitest';

import { readInstitutionCapabilityStatusV1 } from '@/modules/institution/server/institution-capability-status-reader';

const scope = {
  tenantId: 'tenant-safe-reference',
  institutionId: 'institution-safe-reference',
};

const freshness = {
  observedAt: '2026-07-17T02:00:00.000Z',
  freshUntil: '2026-07-17T02:05:00.000Z',
};

const dimensions = {
  codeMaturity: 'verified',
  institutionAuthorization: 'authorized',
  connectionAvailability: 'not_required',
  dataReadiness: 'ready',
  productionRelease: 'released',
};

function evaluation(key: string, overrides: Record<string, unknown> = {}) {
  return {
    key,
    dimensions,
    safeSummary: '当前能力已核验',
    diagnosticTargetKey: null,
    ...overrides,
  };
}

function partition(key: string, overrides: Record<string, unknown> = {}) {
  return {
    key,
    readiness: 'ready',
    freshness,
    failureCode: null,
    ...overrides,
  };
}

function read(
  provider: unknown,
  expectedScope: unknown = scope,
  reachableDiagnosticTargetKeys: unknown = ['page_system_data'],
) {
  return readInstitutionCapabilityStatusV1({
    expectedScope,
    provider,
    reachableDiagnosticTargetKeys,
  });
}

function readyProvider() {
  return {
    scope,
    partitions: [partition('page_customer_list')],
    evaluations: [evaluation('page_customer_list')],
  };
}

describe('InstitutionCapabilityStatusReader', () => {
  it('从可信五维输入生成完整 ready envelope，且不接受 provider decision', () => {
    const result = read(readyProvider());

    expect(result).toEqual({
      contractVersion: 'v1',
      scope,
      readiness: 'ready',
      freshness,
      partitions: [partition('page_customer_list')],
      data: {
        capabilities: [
          {
            key: 'page_customer_list',
            decision: 'operational',
            dimensions,
            safeSummary: '当前能力已核验',
            diagnosticTargetKey: null,
          },
        ],
      },
      failureCode: null,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('输出始终使用公共 registry 顺序，不信任 provider 数组顺序', () => {
    const result = read({
      scope,
      partitions: [
        partition('page_customer_list'),
        partition('section_customers'),
      ],
      evaluations: [
        evaluation('page_customer_list'),
        evaluation('section_customers'),
      ],
    });

    expect(result.partitions.map((item) => item.key)).toEqual([
      'section_customers',
      'page_customer_list',
    ]);
    expect(result.data?.capabilities.map((item) => item.key)).toEqual([
      'section_customers',
      'page_customer_list',
    ]);
  });

  it('partial envelope 保留可用项并把 operational 限制为 read_only', () => {
    const result = read({
      scope,
      partitions: [
        partition('page_customer_list'),
        partition('page_customer_treatments', {
          readiness: 'unavailable',
          freshness: null,
          failureCode: 'upstream_unavailable',
        }),
      ],
      evaluations: [evaluation('page_customer_list')],
    });

    expect(result).toMatchObject({
      readiness: 'partial',
      failureCode: 'upstream_unavailable',
      data: { capabilities: [{ key: 'page_customer_list', decision: 'read_only' }] },
    });
    expect(result.partitions).toHaveLength(2);
  });

  it('stale source 即使五维原本可操作也最多 read_only', () => {
    const result = read({
      scope,
      partitions: [
        partition('page_customer_list', {
          readiness: 'stale',
          failureCode: 'data_incomplete',
        }),
      ],
      evaluations: [evaluation('page_customer_list')],
    });

    expect(result).toMatchObject({
      readiness: 'stale',
      failureCode: 'data_incomplete',
      data: { capabilities: [{ decision: 'read_only' }] },
    });
  });

  it.each([
    ['denied', 'permission_denied'],
    ['disabled', 'not_released'],
  ] as const)('%s 顶层状态必须 data:null', (readiness, failureCode) => {
    const result = read({
      scope,
      partitions: [
        partition('page_customer_list', {
          readiness,
          freshness: null,
          failureCode,
        }),
      ],
      evaluations: [],
    });

    expect(result).toMatchObject({ readiness, failureCode, data: null, freshness: null });
  });

  it('expected scope 缺失或 provider scope 不匹配均 scope_mismatch 且不返回 data', () => {
    const missingInstitution = read(readyProvider(), { tenantId: scope.tenantId });
    expect(missingInstitution).toEqual({
      contractVersion: 'v1',
      scope: {
        tenantId: scope.tenantId,
        institutionId: 'scope_unavailable',
      },
      readiness: 'denied',
      freshness: null,
      partitions: [],
      data: null,
      failureCode: 'scope_mismatch',
    });

    const mismatch = read({
      ...readyProvider(),
      scope: { ...scope, institutionId: 'institution-other' },
    });
    expect(mismatch).toMatchObject({
      scope,
      readiness: 'denied',
      data: null,
      failureCode: 'scope_mismatch',
    });
    expect(JSON.stringify(mismatch)).not.toContain('institution-other');
  });

  it('provider 缺少 scope 或 scope 形状非法时固定 scope_mismatch', () => {
    const missingScope = readyProvider() as Record<string, unknown>;
    delete missingScope.scope;
    expect(read(missingScope)).toMatchObject({
      readiness: 'denied',
      data: null,
      failureCode: 'scope_mismatch',
    });
    expect(read({ ...readyProvider(), scope: { tenantId: scope.tenantId } })).toMatchObject({
      readiness: 'denied',
      data: null,
      failureCode: 'scope_mismatch',
    });
  });

  it('任一 partition 报告 scope_mismatch 时整份数据 fail-closed', () => {
    const result = read({
      scope,
      partitions: [
        partition('page_customer_list'),
        partition('page_customer_treatments', {
          readiness: 'denied',
          freshness: null,
          failureCode: 'scope_mismatch',
        }),
      ],
      evaluations: [evaluation('page_customer_list')],
    });

    expect(result).toEqual({
      contractVersion: 'v1',
      scope,
      readiness: 'denied',
      freshness: null,
      partitions: [],
      data: null,
      failureCode: 'scope_mismatch',
    });
  });

  it('scope 有效但 provider 其余字段缺失时属于 invalid_payload', () => {
    expect(read({ scope, partitions: [] })).toMatchObject({
      readiness: 'unavailable',
      data: null,
      failureCode: 'invalid_payload',
    });
  });

  it.each([
    {
      name: '重复 partition key',
      provider: {
        scope,
        partitions: [partition('page_customer_list'), partition('page_customer_list')],
        evaluations: [evaluation('page_customer_list')],
      },
    },
    {
      name: '重复 evaluation key',
      provider: {
        scope,
        partitions: [partition('page_customer_list')],
        evaluations: [evaluation('page_customer_list'), evaluation('page_customer_list')],
      },
    },
    {
      name: 'partition 缺 key',
      provider: {
        scope,
        partitions: [{ readiness: 'ready', freshness, failureCode: null }],
        evaluations: [evaluation('page_customer_list')],
      },
    },
    {
      name: 'unknown registry key',
      provider: {
        scope,
        partitions: [partition('page_unknown')],
        evaluations: [evaluation('page_unknown')],
      },
    },
    {
      name: 'partition 与 evaluation key 不一致',
      provider: {
        scope,
        partitions: [partition('page_customer_list')],
        evaluations: [evaluation('page_customer_treatments')],
      },
    },
  ])('$name 时不返回部分或猜测数据', ({ provider }) => {
    expect(read(provider)).toEqual({
      contractVersion: 'v1',
      scope,
      readiness: 'unavailable',
      freshness: null,
      partitions: [],
      data: null,
      failureCode: 'invalid_payload',
    });
  });

  it.each([
    {
      name: '未知 partition readiness',
      partition: partition('page_customer_list', { readiness: 'partial' }),
    },
    {
      name: 'ready 带 failureCode',
      partition: partition('page_customer_list', {
        failureCode: 'upstream_unavailable',
      }),
    },
    {
      name: 'disabled 带 freshness',
      partition: partition('page_customer_list', {
        readiness: 'disabled',
        failureCode: 'not_released',
      }),
    },
    {
      name: '非 canonical 时间',
      partition: partition('page_customer_list', {
        freshness: {
          observedAt: '2026-07-17T02:00:00Z',
          freshUntil: freshness.freshUntil,
        },
      }),
    },
    {
      name: '时间窗口倒置',
      partition: partition('page_customer_list', {
        freshness: {
          observedAt: '2026-07-17T02:06:00.000Z',
          freshUntil: freshness.freshUntil,
        },
      }),
    },
  ])('$name 时 fail-closed invalid_payload', ({ partition: invalidPartition }) => {
    expect(
      read({
        scope,
        partitions: [invalidPartition],
        evaluations: [evaluation('page_customer_list')],
      }),
    ).toMatchObject({
      readiness: 'unavailable',
      data: null,
      failureCode: 'invalid_payload',
    });
  });

  it('拒绝客户端或 provider 提交的不一致 decision', () => {
    const result = read({
      scope,
      partitions: [partition('page_customer_list')],
      evaluations: [
        {
          ...evaluation('page_customer_list'),
          decision: 'hidden',
        },
      ],
    });

    expect(result).toMatchObject({
      readiness: 'unavailable',
      data: null,
      failureCode: 'invalid_payload',
    });
  });

  it('unsafe summary 或非法 diagnostic target 不进入输出且不回显原值', () => {
    const unsafeSummary = 'provider error at https://internal.example.com';
    const unsafe = read({
      scope,
      partitions: [partition('page_customer_list')],
      evaluations: [evaluation('page_customer_list', { safeSummary: unsafeSummary })],
    });
    expect(unsafe).toMatchObject({
      readiness: 'unavailable',
      data: null,
      failureCode: 'invalid_payload',
    });
    expect(JSON.stringify(unsafe)).not.toContain(unsafeSummary);

    const invalidTarget = read({
      scope,
      partitions: [partition('page_customer_list')],
      evaluations: [
        evaluation('page_customer_list', {
          diagnosticTargetKey: '/hospital/system/data',
        }),
      ],
    });
    expect(invalidTarget).toMatchObject({
      readiness: 'unavailable',
      data: null,
      failureCode: 'invalid_payload',
    });
  });

  it('只保留当前 AccessContext 可达的诊断目标', () => {
    const provider = {
      scope,
      partitions: [partition('page_customer_list')],
      evaluations: [
        evaluation('page_customer_list', {
          diagnosticTargetKey: 'page_system_data',
        }),
      ],
    };

    expect(read(provider).data?.capabilities[0]?.diagnosticTargetKey).toBe(
      'page_system_data',
    );
    expect(read(provider, scope, []).data?.capabilities[0]?.diagnosticTargetKey).toBeNull();
    expect(
      read(provider, scope, ['page_system_data', 'page_system_data']),
    ).toMatchObject({ readiness: 'unavailable', data: null, failureCode: 'invalid_payload' });
  });

  it('一次性快照并拒绝 accessor、Symbol、不可枚举字段和稀疏数组', () => {
    let keyReadCount = 0;
    const accessorPartition = {
      get key() {
        keyReadCount += 1;
        return keyReadCount === 1 ? 'page_customer_list' : 'page_unknown';
      },
      readiness: 'ready',
      freshness,
      failureCode: null,
    };
    expect(
      read({
        scope,
        partitions: [accessorPartition],
        evaluations: [evaluation('page_customer_list')],
      }),
    ).toMatchObject({ readiness: 'unavailable', data: null, failureCode: 'invalid_payload' });

    const providerWithSymbol = readyProvider();
    Object.defineProperty(providerWithSymbol, Symbol('extra'), { value: true });
    expect(read(providerWithSymbol)).toMatchObject({
      readiness: 'denied',
      data: null,
      failureCode: 'scope_mismatch',
    });

    const providerWithHiddenExtra = readyProvider();
    Object.defineProperty(providerWithHiddenExtra, 'extra', {
      value: true,
      enumerable: false,
    });
    expect(read(providerWithHiddenExtra)).toMatchObject({
      readiness: 'denied',
      data: null,
      failureCode: 'scope_mismatch',
    });

    const sparsePartitions = new Array(1);
    expect(
      read({ scope, partitions: sparsePartitions, evaluations: [] }),
    ).toMatchObject({ readiness: 'unavailable', data: null, failureCode: 'invalid_payload' });
  });

  it('不会从 section/page/action 关系派生额外授权或补齐父子 key', () => {
    const result = read({
      scope,
      partitions: [partition('action_customer_create')],
      evaluations: [evaluation('action_customer_create')],
    });

    expect(result.data?.capabilities.map((item) => item.key)).toEqual([
      'action_customer_create',
    ]);
    expect(result.partitions.map((item) => item.key)).toEqual(['action_customer_create']);
    expect(result.data?.capabilities[0]).not.toHaveProperty('allowed');
  });
});
