import { describe, expect, it } from 'vitest';

import * as evaluatorModule from '@/modules/institution/server/institution-capability-status-evaluator';
import {
  evaluateInstitutionCapabilityCandidateV1,
  INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1,
  isInstitutionCapabilitySummaryCandidateV1,
} from '@/modules/institution/server/institution-capability-status-evaluator';
import { STRICT_DATA_RECORD_MAX_KEYS } from '@/modules/institution/server/strict-input-snapshot';

const dimensionClaims = {
  codeMaturityClaim: 'verified',
  institutionAuthorizationClaim: 'authorized',
  connectionAvailabilityClaim: 'available',
  dataReadinessClaim: 'ready',
  productionReleaseClaim: 'released',
};

function evaluation(overrides: Record<string, unknown> = {}) {
  return {
    candidateCapabilityKey: 'action_customer_create',
    dimensionClaims,
    summaryCandidate: '当前能力已核验',
    ...overrides,
  };
}

describe('InstitutionCapabilityStatusEvaluator candidate boundary', () => {
  it('只返回冻结的 non-authorizing candidate 和完整 owner 前置', () => {
    const result = evaluateInstitutionCapabilityCandidateV1(evaluation());

    expect(result).toEqual({
      kind: 'non_authorizing_candidate',
      candidateCapabilityKey: 'action_customer_create',
      untrustedDimensionClaims: dimensionClaims,
      untrustedSummaryClaim: '当前能力已核验',
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
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(INSTITUTION_CAPABILITY_OWNER_REQUIREMENTS_V1)).toBe(true);
    if (result.kind === 'blocked') throw new Error('expected candidate');
    expect(Object.isFrozen(result.untrustedDimensionClaims)).toBe(true);
  });

  it('不存在 raw status evaluator 或 decision helper 导出', () => {
    expect(evaluatorModule).not.toHaveProperty('evaluateInstitutionCapabilityStatusV1');
    expect(evaluatorModule).not.toHaveProperty('deriveInstitutionCapabilityDecisionV1');
  });

  it('即使 raw claims 全部自报为已授权和已发布也不产生权威字段', () => {
    const result = evaluateInstitutionCapabilityCandidateV1(evaluation());

    expect(result.kind).toBe('non_authorizing_candidate');
    expect(result).not.toHaveProperty('decision');
    expect(result).not.toHaveProperty('readiness');
    expect(result).not.toHaveProperty('data');
    expect(result).not.toHaveProperty('diagnosticTargetKey');
    expect(JSON.stringify(result)).not.toContain('operational');
    expect(JSON.stringify(result)).not.toContain('read_only');
  });

  it('拒绝旧 authority-bearing raw 形状', () => {
    expect(
      evaluateInstitutionCapabilityCandidateV1({
        key: 'action_customer_create',
        dimensions: {
          codeMaturity: 'verified',
          institutionAuthorization: 'authorized',
          connectionAvailability: 'available',
          dataReadiness: 'ready',
          productionRelease: 'released',
        },
        safeSummary: '当前能力已核验',
        diagnosticTargetKey: 'page_system_data',
      }),
    ).toMatchObject({ kind: 'blocked', blockReason: 'invalid_input' });
  });

  it('不接受任何 raw 诊断目标自报字段', () => {
    const result = evaluateInstitutionCapabilityCandidateV1(
      evaluation({ diagnosticTargetKey: 'page_system_data' }),
    );

    expect(result).toMatchObject({ kind: 'blocked', blockReason: 'invalid_input' });
    expect(result).not.toHaveProperty('diagnosticTargetKey');
  });

  it('拒绝 unknown capability、缺字段和额外字段', () => {
    expect(
      evaluateInstitutionCapabilityCandidateV1(
        evaluation({ candidateCapabilityKey: 'page_unknown' }),
      ),
    ).toMatchObject({ kind: 'blocked', blockReason: 'unknown_capability' });

    const missing = evaluation();
    delete (missing as { summaryCandidate?: unknown }).summaryCandidate;
    expect(evaluateInstitutionCapabilityCandidateV1(missing)).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_input',
    });
    expect(
      evaluateInstitutionCapabilityCandidateV1(evaluation({ extra: true })),
    ).toMatchObject({ kind: 'blocked', blockReason: 'invalid_input' });
  });

  it.each([
    ['codeMaturityClaim', 'ready'],
    ['institutionAuthorizationClaim', true],
    ['connectionAvailabilityClaim', 'connected'],
    ['dataReadinessClaim', 'denied'],
    ['productionReleaseClaim', 'enabled'],
  ])('拒绝未知 dimension claim %s=%s', (field, value) => {
    expect(
      evaluateInstitutionCapabilityCandidateV1(
        evaluation({ dimensionClaims: { ...dimensionClaims, [field]: value } }),
      ),
    ).toMatchObject({ kind: 'blocked', blockReason: 'invalid_dimension_claims' });
  });

  it('dimension claims 必须字段完整且无额外字段', () => {
    const missing = { ...dimensionClaims } as Record<string, unknown>;
    delete missing.dataReadinessClaim;
    expect(
      evaluateInstitutionCapabilityCandidateV1(evaluation({ dimensionClaims: missing })),
    ).toMatchObject({ kind: 'blocked', blockReason: 'invalid_dimension_claims' });
    expect(
      evaluateInstitutionCapabilityCandidateV1(
        evaluation({ dimensionClaims: { ...dimensionClaims, released: true } }),
      ),
    ).toMatchObject({ kind: 'blocked', blockReason: 'invalid_dimension_claims' });
  });

  it('summary candidate 只接受固定低敏文案或 null', () => {
    expect(isInstitutionCapabilitySummaryCandidateV1('当前能力已核验')).toBe(true);
    expect(isInstitutionCapabilitySummaryCandidateV1(null)).toBe(true);
    expect(isInstitutionCapabilitySummaryCandidateV1('')).toBe(false);
    expect(isInstitutionCapabilitySummaryCandidateV1('任意说明')).toBe(false);
  });

  it('巨大 summary 在 Array.from 前被阻断且不回显', () => {
    const hugeSummary = '🙂'.repeat(10_000);
    const result = evaluateInstitutionCapabilityCandidateV1(
      evaluation({ summaryCandidate: hugeSummary }),
    );

    expect(result).toMatchObject({
      kind: 'blocked',
      blockReason: 'unsafe_summary_candidate',
    });
    expect(JSON.stringify(result)).not.toContain(hugeSummary);
  });

  it.each([
    'https://internal.example.com',
    'provider ECONNRESET',
    'access_token=secret',
    '手机号 13800000000',
    '/Users/example/private.ts:12',
  ])('拒绝敏感或内部 summary：%s', (summaryCandidate) => {
    const result = evaluateInstitutionCapabilityCandidateV1(
      evaluation({ summaryCandidate }),
    );
    expect(result).toMatchObject({
      kind: 'blocked',
      blockReason: 'unsafe_summary_candidate',
    });
    expect(JSON.stringify(result)).not.toContain(summaryCandidate);
  });

  it('拒绝 record Proxy、throwing Proxy 和 null-prototype', () => {
    expect(
      evaluateInstitutionCapabilityCandidateV1(new Proxy(evaluation(), {})),
    ).toMatchObject({ kind: 'blocked', blockReason: 'invalid_input' });

    let trapCalled = false;
    const throwingProxy = new Proxy(evaluation(), {
      ownKeys() {
        trapCalled = true;
        throw new Error('must not run');
      },
    });
    expect(evaluateInstitutionCapabilityCandidateV1(throwingProxy)).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_input',
    });
    expect(trapCalled).toBe(false);

    const nullPrototype = Object.assign(Object.create(null), evaluation());
    expect(evaluateInstitutionCapabilityCandidateV1(nullPrototype)).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_input',
    });
  });

  it('嵌套 dimension claims 同样拒绝 Proxy 和 null-prototype', () => {
    expect(
      evaluateInstitutionCapabilityCandidateV1(
        evaluation({ dimensionClaims: new Proxy(dimensionClaims, {}) }),
      ),
    ).toMatchObject({ kind: 'blocked', blockReason: 'invalid_dimension_claims' });

    expect(
      evaluateInstitutionCapabilityCandidateV1(
        evaluation({
          dimensionClaims: Object.assign(Object.create(null), dimensionClaims),
        }),
      ),
    ).toMatchObject({ kind: 'blocked', blockReason: 'invalid_dimension_claims' });
  });

  it('拒绝 accessor、Symbol 和 hidden extra', () => {
    let readCount = 0;
    const accessorInput = evaluation();
    Object.defineProperty(accessorInput, 'candidateCapabilityKey', {
      enumerable: true,
      get() {
        readCount += 1;
        return 'action_customer_create';
      },
    });
    expect(evaluateInstitutionCapabilityCandidateV1(accessorInput)).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_input',
    });
    expect(readCount).toBe(0);

    const symbolExtra = evaluation();
    Object.defineProperty(symbolExtra, Symbol('extra'), { value: true });
    expect(evaluateInstitutionCapabilityCandidateV1(symbolExtra)).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_input',
    });

    const hiddenExtra = evaluation();
    Object.defineProperty(hiddenExtra, 'extra', { value: true, enumerable: false });
    expect(evaluateInstitutionCapabilityCandidateV1(hiddenExtra)).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_input',
    });
  });

  it('拒绝超过固定 key 上限的巨大 record', () => {
    const hugeRecord = Object.fromEntries(
      Array.from({ length: STRICT_DATA_RECORD_MAX_KEYS + 1 }, (_, index) => [
        `key${index}`,
        index,
      ]),
    );

    expect(evaluateInstitutionCapabilityCandidateV1(hugeRecord)).toMatchObject({
      kind: 'blocked',
      blockReason: 'invalid_input',
    });
  });
});
