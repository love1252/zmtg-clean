import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  isGuardReferenceCandidateV1,
  isObjectReferenceCandidateV1,
  parseInstitutionAnchorResolutionCandidateV1,
  parseMembershipResolutionCandidateV1,
  parseProvenanceResolutionCandidateV1,
  parseRequestProvenanceEvidenceCandidateV1,
  type GuardReferenceCandidateV1,
  type ObjectReferenceCandidateV1,
  type SafeObjectReferenceV1,
  type UserReferenceV1,
} from '@/modules/security/server/institution-guard-evidence';

const token = 'B'.repeat(22);
const reference = (prefix: string) => `${prefix}_v1_k1_${token}`;

function provenanceEvidence(overrides: Record<string, unknown> = {}) {
  return {
    source: 'server_session',
    userReference: reference('usr'),
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    requestReference: reference('req'),
    proofReference: reference('prf'),
    issuedAt: '2026-07-18T06:00:00.000Z',
    verifiedAt: '2026-07-18T06:00:01.000Z',
    validUntil: '2026-07-18T06:05:00.000Z',
    ...overrides,
  };
}

function membership(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'membership_candidate',
    userReference: reference('usr'),
    role: 'tenant_admin',
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    membershipReference: reference('mbr'),
    membershipRevision: reference('mrv'),
    bindingReference: reference('bnd'),
    bindingRevision: reference('brv'),
    observedAt: '2026-07-18T06:00:00.000Z',
    freshUntil: '2026-07-18T06:01:00.000Z',
    ...overrides,
  };
}

function anchor(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'anchor_candidate',
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    anchorReference: reference('anc'),
    anchorRevision: reference('arv'),
    observedAt: '2026-07-18T06:00:00.000Z',
    freshUntil: '2026-07-18T06:01:00.000Z',
    ...overrides,
  };
}

describe('BASE-02B-R1 hostile evidence boundaries', () => {
  it.each([
    '',
    `usr_v1_k0_${token}`,
    `usr_v1_k01_${token}`,
    `usr_v1_k1000_${token}`,
    `usr_v1_k1_${'A'.repeat(21)}`,
    `usr_v1_k1_${'A'.repeat(44)}`,
    `usr_v1_k1_${'A'.repeat(21)}+`,
    `usr_v1_k1_user@example.com_${'A'.repeat(5)}`,
  ])('rejects malformed guard candidate %s', (value) => {
    expect(isGuardReferenceCandidateV1(value, 'usr')).toBe(false);
  });

  it.each([
    `oref_v1_k0_${token}`,
    `oref_v1_k01_${token}`,
    `oref_v1_k1_${'A'.repeat(21)}`,
    `oref_v1_k1_${'A'.repeat(44)}`,
    `objd_v1_k1_${token}`,
  ])('rejects malformed object candidate %s', (value) => {
    expect(isObjectReferenceCandidateV1(value)).toBe(false);
  });

  it('keeps reversible base64url PII syntax-only and exposes no Safe promotion API', async () => {
    const reversibleEmail = 'YWxpY2VAZXhhbXBsZS5jb20';
    const guardCandidate = `usr_v1_k1_${reversibleEmail}`;
    const objectCandidate = `oref_v1_k1_${reversibleEmail}`;
    const moduleExports = await import(
      '@/modules/security/server/institution-guard-evidence'
    );

    expect(isGuardReferenceCandidateV1(guardCandidate, 'usr')).toBe(true);
    expect(isObjectReferenceCandidateV1(objectCandidate)).toBe(true);
    expect(moduleExports).not.toHaveProperty('isSafeGuardReferenceV1');
    expect(moduleExports).not.toHaveProperty('isSafeObjectReferenceV1');
    expect(moduleExports).not.toHaveProperty(
      'parseFormalRequestProvenanceEvidenceV1',
    );
    expectTypeOf<GuardReferenceCandidateV1<'usr'>>().not.toEqualTypeOf<
      UserReferenceV1
    >();
    expectTypeOf<ObjectReferenceCandidateV1>().not.toEqualTypeOf<
      SafeObjectReferenceV1
    >();
  });

  it('rejects extra, non-enumerable, accessor, inherited, symbol, null-prototype, and Proxy evidence', () => {
    const extra = { ...provenanceEvidence(), clientInstitutionId: 'institution-b' };
    const nonEnumerable = provenanceEvidence();
    Object.defineProperty(nonEnumerable, 'clientInstitutionId', {
      value: 'institution-b',
      enumerable: false,
    });
    const accessor = provenanceEvidence();
    Object.defineProperty(accessor, 'tenantId', {
      enumerable: true,
      configurable: true,
      get: () => 'tenant-a',
    });
    const inherited = Object.create(provenanceEvidence());
    const symbol = Object.assign(provenanceEvidence(), {
      [Symbol('scope')]: 'institution-b',
    });
    const nullPrototype = Object.assign(Object.create(null), provenanceEvidence());
    const proxy = new Proxy(provenanceEvidence(), {});

    for (const input of [
      extra,
      nonEnumerable,
      accessor,
      inherited,
      symbol,
      nullPrototype,
      proxy,
    ]) {
      expect(parseRequestProvenanceEvidenceCandidateV1(input)).toBeNull();
    }
  });

  it('rejects non-canonical, reversed, zero-length, and overlong candidate windows', () => {
    for (const input of [
      provenanceEvidence({ issuedAt: '2026-07-18T06:00:00Z' }),
      provenanceEvidence({
        issuedAt: '2026-07-18T06:00:02.000Z',
        verifiedAt: '2026-07-18T06:00:01.000Z',
      }),
      provenanceEvidence({ validUntil: '2026-07-18T06:00:01.000Z' }),
      provenanceEvidence({ validUntil: '2026-07-18T06:05:00.001Z' }),
    ]) {
      expect(parseRequestProvenanceEvidenceCandidateV1(input)).toBeNull();
    }
  });

  it('does not accept caller time or claim freshness for a historical candidate', () => {
    const historical = provenanceEvidence({
      issuedAt: '2020-01-01T00:00:00.000Z',
      verifiedAt: '2020-01-01T00:00:01.000Z',
      validUntil: '2020-01-01T00:05:00.000Z',
    });

    expect(parseRequestProvenanceEvidenceCandidateV1.length).toBe(1);
    expect(parseProvenanceResolutionCandidateV1.length).toBe(1);
    expect(parseMembershipResolutionCandidateV1.length).toBe(1);
    expect(parseInstitutionAnchorResolutionCandidateV1.length).toBe(1);
    expect(parseRequestProvenanceEvidenceCandidateV1(historical)).toEqual(
      historical,
    );
  });

  it.each([
    ['userReference', reference('mbr')],
    ['membershipReference', reference('usr')],
    ['membershipRevision', reference('brv')],
    ['bindingReference', reference('mbr')],
    ['bindingRevision', reference('mrv')],
    ['role', 'platform_admin'],
    ['tenantId', 'tenant other'],
    ['institutionId', 'institution/other'],
    ['freshUntil', '2026-07-18T06:00:00.000Z'],
    ['freshUntil', '2026-07-18T06:01:00.001Z'],
  ])('rejects invalid membership candidate field %s', (field, value) => {
    expect(
      parseMembershipResolutionCandidateV1(membership({ [field]: value })),
    ).toBeNull();
  });

  it.each([
    ['anchorReference', reference('mbr')],
    ['anchorRevision', reference('mrv')],
    ['tenantId', 'tenant other'],
    ['institutionId', 'institution/other'],
    ['freshUntil', '2026-07-18T06:00:00.000Z'],
    ['freshUntil', '2026-07-18T06:01:00.001Z'],
  ])('rejects invalid anchor candidate field %s', (field, value) => {
    expect(
      parseInstitutionAnchorResolutionCandidateV1(anchor({ [field]: value })),
    ).toBeNull();
  });

  it('rejects unknown or mismatched variants and nested Proxy evidence', () => {
    expect(
      parseProvenanceResolutionCandidateV1({
        kind: 'rejected',
        code: 'membership_denied',
      }),
    ).toBeNull();
    expect(
      parseMembershipResolutionCandidateV1({
        kind: 'rejected',
        code: 'provenance_expired',
      }),
    ).toBeNull();
    expect(
      parseInstitutionAnchorResolutionCandidateV1({
        kind: 'denied',
        code: 'institution_anchor_unavailable',
      }),
    ).toBeNull();
    expect(
      parseProvenanceResolutionCandidateV1({
        kind: 'provenance_candidate',
        evidence: new Proxy(provenanceEvidence(), {}),
      }),
    ).toBeNull();
  });
});
