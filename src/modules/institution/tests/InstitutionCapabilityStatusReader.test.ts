import { describe, expect, it } from 'vitest';

import { INSTITUTION_CAPABILITY_REGISTRY_V1 } from '@/modules/institution-contracts/v1/institution-capability-registry';
import * as readerModule from '@/modules/institution/server/institution-capability-status-reader';
import { readInstitutionCapabilityStatusCandidateV1 } from '@/modules/institution/server/institution-capability-status-reader';
import {
  snapshotStrictArray,
  snapshotStrictDataRecord,
  STRICT_ARRAY_MAX_ITEMS,
} from '@/modules/institution/server/strict-input-snapshot';

const scopeIntent = {
  tenantIdIntent: 'tenant-safe-reference',
  institutionIdIntent: 'institution-safe-reference',
};

const scopeClaim = {
  tenantIdClaim: scopeIntent.tenantIdIntent,
  institutionIdClaim: scopeIntent.institutionIdIntent,
};

const freshnessClaim = {
  observedAtClaim: '2026-07-18T02:00:00.000Z',
  freshUntilClaim: '2026-07-18T02:05:00.000Z',
};

const dimensionClaims = {
  codeMaturityClaim: 'verified',
  institutionAuthorizationClaim: 'authorized',
  connectionAvailabilityClaim: 'available',
  dataReadinessClaim: 'ready',
  productionReleaseClaim: 'released',
};

function evaluationCandidate(
  candidateCapabilityKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    candidateCapabilityKey,
    dimensionClaims,
    summaryCandidate: '当前能力已核验',
    ...overrides,
  };
}

function partitionClaim(
  candidateCapabilityKey: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    candidateCapabilityKey,
    sourceReadinessClaim: 'ready',
    freshnessClaim,
    sourceFailureClaim: null,
    ...overrides,
  };
}

function readyProviderCandidate() {
  return {
    scopeClaim,
    sourcePartitionClaims: [partitionClaim('action_customer_create')],
    capabilityEvaluationCandidates: [
      evaluationCandidate('action_customer_create'),
    ],
  };
}

function read(
  providerCandidate: unknown,
  candidateScopeIntent: unknown = scopeIntent,
) {
  return readInstitutionCapabilityStatusCandidateV1({
    scopeIntent: candidateScopeIntent,
    providerCandidate,
  });
}

describe('InstitutionCapabilityStatusReader candidate boundary', () => {
  it('只返回冻结的 non-authorizing candidate，不返回 CapabilityStatusV1 字段', () => {
    const result = read(readyProviderCandidate());

    expect(result).toMatchObject({
      kind: 'non_authorizing_candidate',
      tenantIntentCandidate: scopeIntent.tenantIdIntent,
      institutionIntentCandidate: scopeIntent.institutionIdIntent,
      sourcePartitionCandidates: [
        {
          candidateCapabilityKey: 'action_customer_create',
          sourceReadinessClaim: 'ready',
        },
      ],
      capabilityCandidates: [
        {
          kind: 'non_authorizing_candidate',
          candidateCapabilityKey: 'action_customer_create',
        },
      ],
      ownerRequirements: [
        'formal_provenance',
        'fresh_active_membership',
        'active_institution_anchor',
        'owner_capability_facts',
        'trusted_server_clock',
        'diagnostic_route_guard',
        'capability_revision',
      ],
    });
    expect(result).not.toHaveProperty('contractVersion');
    expect(result).not.toHaveProperty('scope');
    expect(result).not.toHaveProperty('readiness');
    expect(result).not.toHaveProperty('freshness');
    expect(result).not.toHaveProperty('partitions');
    expect(result).not.toHaveProperty('data');
    expect(result).not.toHaveProperty('failureCode');
    expect(JSON.stringify(result)).not.toContain('operational');
    expect(JSON.stringify(result)).not.toContain('read_only');
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === 'blocked') throw new Error('expected candidate');
    expect(Object.isFrozen(result.sourcePartitionCandidates)).toBe(true);
    expect(Object.isFrozen(result.capabilityCandidates)).toBe(true);
  });

  it('不存在 raw CapabilityStatusV1 reader 或 owner seal constructor 导出', () => {
    expect(readerModule).not.toHaveProperty('readInstitutionCapabilityStatusV1');
    expect(readerModule).not.toHaveProperty('InstitutionCapabilityOwnerEvidenceSealV1');
  });

  it('旧 raw expectedScope/provider/diagnostic 形状固定 blocked', () => {
    const result = readInstitutionCapabilityStatusCandidateV1({
      expectedScope: {
        tenantId: scopeIntent.tenantIdIntent,
        institutionId: scopeIntent.institutionIdIntent,
      },
      provider: {
        scope: {
          tenantId: scopeIntent.tenantIdIntent,
          institutionId: scopeIntent.institutionIdIntent,
        },
        partitions: [],
        evaluations: [],
      },
      reachableDiagnosticTargetKeys: ['page_system_data'],
    });

    expect(result).toMatchObject({ kind: 'blocked', blockReason: 'invalid_input' });
    expect(result).not.toHaveProperty('diagnosticTargetKey');
  });

  it('任何 raw 诊断目标字段都不能进入 candidate reader', () => {
    expect(
      readInstitutionCapabilityStatusCandidateV1({
        scopeIntent,
        providerCandidate: readyProviderCandidate(),
        reachableDiagnosticTargetKeys: ['page_system_data'],
      }),
    ).toMatchObject({ kind: 'blocked', blockReason: 'invalid_input' });

    expect(
      read({
        ...readyProviderCandidate(),
        reachableDiagnosticTargetKeys: ['page_system_data'],
      }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_provider_candidate',
    });

    const provider = readyProviderCandidate();
    provider.capabilityEvaluationCandidates = [
      evaluationCandidate('action_customer_create', {
        diagnosticTargetKey: 'page_system_data',
      }),
    ];
    expect(read(provider)).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_evaluation_candidate',
    });
  });

  it('scope intent mismatch 与非法 provider shape 明确分离且都不伪造 denied envelope', () => {
    const mismatch = read({
      ...readyProviderCandidate(),
      scopeClaim: {
        ...scopeClaim,
        institutionIdClaim: 'institution-other',
      },
    });
    expect(mismatch).toEqual({
      kind: 'blocked',
      blockReason: 'scope_intent_mismatch',
      ownerRequirements: expect.any(Array),
    });
    expect(JSON.stringify(mismatch)).not.toContain('institution-other');
    expect(mismatch).not.toHaveProperty('readiness');

    const invalidProvider = readyProviderCandidate();
    Object.defineProperty(invalidProvider, 'extra', {
      value: true,
      enumerable: false,
    });
    expect(read(invalidProvider)).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_provider_candidate',
    });
  });

  it('future instant 只能保留为 freshness claim，不能生成 current/ready 顶层状态', () => {
    const futureClaim = {
      observedAtClaim: '2099-01-01T00:00:00.000Z',
      freshUntilClaim: '2099-01-01T01:00:00.000Z',
    };
    const result = read({
      ...readyProviderCandidate(),
      sourcePartitionClaims: [
        partitionClaim('action_customer_create', { freshnessClaim: futureClaim }),
      ],
    });

    expect(result).toMatchObject({
      kind: 'non_authorizing_candidate',
      sourcePartitionCandidates: [{ freshnessClaim: futureClaim }],
      ownerRequirements: expect.arrayContaining(['trusted_server_clock']),
    });
    expect(result).not.toHaveProperty('readiness');
    expect(result).not.toHaveProperty('freshness');
    expect(result).not.toHaveProperty('decision');
  });

  it.each([
    {
      name: '非 canonical instant',
      value: {
        observedAtClaim: '2026-07-18T02:00:00Z',
        freshUntilClaim: freshnessClaim.freshUntilClaim,
      },
    },
    {
      name: '倒置 interval',
      value: {
        observedAtClaim: '2026-07-18T02:06:00.000Z',
        freshUntilClaim: freshnessClaim.freshUntilClaim,
      },
    },
  ])('$name 作为候选形状仍被阻断', ({ value }) => {
    expect(
      read({
        ...readyProviderCandidate(),
        sourcePartitionClaims: [
          partitionClaim('action_customer_create', { freshnessClaim: value }),
        ],
      }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_partition_candidate',
    });
  });

  it('公共 registry 只用于确定 candidate 顺序，不派生父子或授权', () => {
    const result = read({
      scopeClaim,
      sourcePartitionClaims: [
        partitionClaim('action_customer_create'),
        partitionClaim('section_customers'),
      ],
      capabilityEvaluationCandidates: [
        evaluationCandidate('action_customer_create'),
        evaluationCandidate('section_customers'),
      ],
    });

    if (result.kind === 'blocked') throw new Error('expected candidate');
    expect(
      result.sourcePartitionCandidates.map((candidate) =>
        candidate.candidateCapabilityKey,
      ),
    ).toEqual(['section_customers', 'action_customer_create']);
    expect(result.capabilityCandidates.map((candidate) => candidate.candidateCapabilityKey)).toEqual([
      'section_customers',
      'action_customer_create',
    ]);
  });

  it('重复 key 或 data-bearing claim/evaluation key 不一致时 blocked', () => {
    expect(
      read({
        scopeClaim,
        sourcePartitionClaims: [
          partitionClaim('action_customer_create'),
          partitionClaim('action_customer_create'),
        ],
        capabilityEvaluationCandidates: [
          evaluationCandidate('action_customer_create'),
        ],
      }),
    ).toMatchObject({ kind: 'blocked', blockReason: 'duplicate_candidate' });

    expect(
      read({
        scopeClaim,
        sourcePartitionClaims: [partitionClaim('action_customer_create')],
        capabilityEvaluationCandidates: [evaluationCandidate('page_customer_list')],
      }),
    ).toMatchObject({ kind: 'blocked', blockReason: 'candidate_key_mismatch' });
  });

  it('非 data-bearing source claim 可以保留为候选但不产生顶层 denied/unavailable', () => {
    const result = read({
      scopeClaim,
      sourcePartitionClaims: [
        partitionClaim('page_customer_list', {
          sourceReadinessClaim: 'denied',
          freshnessClaim: null,
          sourceFailureClaim: 'permission_denied',
        }),
      ],
      capabilityEvaluationCandidates: [],
    });

    expect(result).toMatchObject({
      kind: 'non_authorizing_candidate',
      sourcePartitionCandidates: [{ sourceReadinessClaim: 'denied' }],
    });
    expect(result).not.toHaveProperty('readiness');
    expect(result).not.toHaveProperty('failureCode');
  });

  it.each([
    partitionClaim('page_customer_list', { sourceReadinessClaim: 'partial' }),
    partitionClaim('page_customer_list', {
      sourceReadinessClaim: 'ready',
      sourceFailureClaim: 'upstream_unavailable',
    }),
    partitionClaim('page_customer_list', {
      sourceReadinessClaim: 'disabled',
      freshnessClaim,
      sourceFailureClaim: 'not_released',
    }),
  ])('非法 partition cross-field claim 被阻断', (invalidClaim) => {
    expect(
      read({
        scopeClaim,
        sourcePartitionClaims: [invalidClaim],
        capabilityEvaluationCandidates: [evaluationCandidate('page_customer_list')],
      }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_partition_candidate',
    });
  });

  it('拒绝 record/array Proxy 和 null-prototype，且 Proxy trap 不执行', () => {
    let trapCalled = false;
    const providerProxy = new Proxy(readyProviderCandidate(), {
      ownKeys() {
        trapCalled = true;
        throw new Error('must not run');
      },
    });
    expect(read(providerProxy)).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_provider_candidate',
    });
    expect(trapCalled).toBe(false);

    const nullPrototype = Object.assign(
      Object.create(null),
      readyProviderCandidate(),
    );
    expect(read(nullPrototype)).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_provider_candidate',
    });

    const arrayProxy = new Proxy(
      readyProviderCandidate().sourcePartitionClaims,
      {},
    );
    expect(
      read({ ...readyProviderCandidate(), sourcePartitionClaims: arrayProxy }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_provider_candidate',
    });
  });

  it('嵌套 scope/freshness records 同样拒绝 Proxy 和 null-prototype', () => {
    expect(read(readyProviderCandidate(), new Proxy(scopeIntent, {}))).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_scope_intent',
    });

    expect(
      read({
        ...readyProviderCandidate(),
        scopeClaim: Object.assign(Object.create(null), scopeClaim),
      }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_provider_candidate',
    });

    expect(
      read({
        ...readyProviderCandidate(),
        sourcePartitionClaims: [
          partitionClaim('action_customer_create', {
            freshnessClaim: new Proxy(freshnessClaim, {}),
          }),
        ],
      }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_partition_candidate',
    });
  });

  it('拒绝 accessor、Symbol、hidden extra 和 sparse array，且不触发 getter', () => {
    let getterRead = 0;
    const accessorClaim = partitionClaim('action_customer_create');
    Object.defineProperty(accessorClaim, 'candidateCapabilityKey', {
      enumerable: true,
      get() {
        getterRead += 1;
        return 'action_customer_create';
      },
    });
    expect(
      read({
        ...readyProviderCandidate(),
        sourcePartitionClaims: [accessorClaim],
      }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_partition_candidate',
    });
    expect(getterRead).toBe(0);

    const symbolProvider = readyProviderCandidate();
    Object.defineProperty(symbolProvider, Symbol('extra'), { value: true });
    expect(read(symbolProvider)).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_provider_candidate',
    });

    const hiddenClaim = partitionClaim('action_customer_create');
    Object.defineProperty(hiddenClaim, 'extra', { value: true, enumerable: false });
    expect(
      read({
        ...readyProviderCandidate(),
        sourcePartitionClaims: [hiddenClaim],
      }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_partition_candidate',
    });

    const sparseClaims = new Array(1);
    expect(
      read({ ...readyProviderCandidate(), sourcePartitionClaims: sparseClaims }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_provider_candidate',
    });

    const arrayWithHiddenExtra = [partitionClaim('action_customer_create')];
    Object.defineProperty(arrayWithHiddenExtra, 'extra', {
      value: true,
      enumerable: false,
    });
    expect(
      read({
        ...readyProviderCandidate(),
        sourcePartitionClaims: arrayWithHiddenExtra,
      }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_provider_candidate',
    });

    const arrayWithSymbol = [partitionClaim('action_customer_create')];
    Object.defineProperty(arrayWithSymbol, Symbol('extra'), { value: true });
    expect(
      read({
        ...readyProviderCandidate(),
        sourcePartitionClaims: arrayWithSymbol,
      }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_provider_candidate',
    });

    let arrayGetterRead = 0;
    const accessorArray = [partitionClaim('action_customer_create')];
    Object.defineProperty(accessorArray, '0', {
      enumerable: true,
      configurable: true,
      get() {
        arrayGetterRead += 1;
        return partitionClaim('action_customer_create');
      },
    });
    expect(
      read({ ...readyProviderCandidate(), sourcePartitionClaims: accessorArray }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_provider_candidate',
    });
    expect(arrayGetterRead).toBe(0);
  });

  it('巨大 array 在 descriptors 前按固定上限阻断且不截断', () => {
    const overRegistryLimit = Array.from(
      { length: INSTITUTION_CAPABILITY_REGISTRY_V1.length + 1 },
      () => partitionClaim('action_customer_create'),
    );
    expect(
      read({
        ...readyProviderCandidate(),
        sourcePartitionClaims: overRegistryLimit,
      }),
    ).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_provider_candidate',
    });

    const globalOverflow = Array.from(
      { length: STRICT_ARRAY_MAX_ITEMS + 1 },
      (_, index) => index,
    );
    expect(snapshotStrictArray(globalOverflow, STRICT_ARRAY_MAX_ITEMS)).toBeNull();
  });

  it('strict snapshot helpers 直接拒绝 Proxy 和 null-prototype', () => {
    expect(snapshotStrictDataRecord(new Proxy({ safe: true }, {}))).toBeNull();
    expect(
      snapshotStrictDataRecord(Object.assign(Object.create(null), { safe: true })),
    ).toBeNull();
    expect(snapshotStrictArray(new Proxy([1], {}), 1)).toBeNull();
  });

  it('blocked 结果低敏且不回显 hostile 值', () => {
    const hostileInstitution = 'institution-hostile-private-reference';
    const result = read({
      ...readyProviderCandidate(),
      scopeClaim: { ...scopeClaim, institutionIdClaim: hostileInstitution },
    });

    expect(result).toMatchObject({
      kind: 'blocked',
      blockReason: 'scope_intent_mismatch',
    });
    expect(JSON.stringify(result)).not.toContain(hostileInstitution);
  });
});
