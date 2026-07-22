import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  isGuardReferenceCandidateV1,
  isObjectReferenceCandidateV1,
  parseInstitutionAnchorResolutionCandidateV1,
  parseMembershipResolutionCandidateV1,
  parseProvenanceResolutionCandidateV1,
  parseRequestProvenanceEvidenceCandidateV1,
  type ActiveInstitutionAnchorEvidenceV1,
  type ActiveInstitutionAnchorProviderV1,
  type ActiveInstitutionAnchorResolutionV1,
  type AnchorRevisionReferenceV1,
  type BindingRevisionReferenceV1,
  type FormalProvenanceResolverV1,
  type FormalRequestProvenanceEvidenceV1,
  type FreshActiveMembershipEvidenceV1,
  type FreshActiveMembershipProviderV1,
  type FreshActiveMembershipResolutionV1,
  type MembershipRevisionReferenceV1,
  type PolicyRevisionReferenceV1,
  type ProvenanceResolutionV1,
  type UserReferenceV1,
} from '@/modules/security/server/institution-guard-evidence';

const token = 'A'.repeat(22);
const reference = (prefix: string) => `${prefix}_v1_k1_${token}`;
type Unbranded<T> = {
  [Key in keyof T as Key extends symbol ? never : Key]: T[Key];
};

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

describe('BASE-02B-R1 guard evidence contracts', () => {
  it('accepts only current field-specific candidate syntax and key version', () => {
    expect(isGuardReferenceCandidateV1(reference('usr'), 'usr')).toBe(true);
    expect(isGuardReferenceCandidateV1(reference('usr'), 'mbr')).toBe(false);
    expect(isGuardReferenceCandidateV1(`usr_v1_k2_${token}`, 'usr')).toBe(false);
    expect(isObjectReferenceCandidateV1(`oref_v1_k1_${token}`)).toBe(true);
    expect(isObjectReferenceCandidateV1(`oref_v1_k2_${token}`)).toBe(false);
  });

  it('keeps every formal safe reference prefix nominally distinct', () => {
    expectTypeOf<UserReferenceV1>().not.toEqualTypeOf<
      MembershipRevisionReferenceV1
    >();
    expectTypeOf<MembershipRevisionReferenceV1>().not.toEqualTypeOf<
      BindingRevisionReferenceV1
    >();
    expectTypeOf<BindingRevisionReferenceV1>().not.toEqualTypeOf<
      AnchorRevisionReferenceV1
    >();
    expectTypeOf<AnchorRevisionReferenceV1>().not.toEqualTypeOf<
      PolicyRevisionReferenceV1
    >();
  });

  it('keeps formal positive evidence and owner handles nominally sealed', () => {
    expectTypeOf<Unbranded<FormalRequestProvenanceEvidenceV1>>().not.toMatchTypeOf<
      FormalRequestProvenanceEvidenceV1
    >();
    expectTypeOf<Unbranded<FreshActiveMembershipEvidenceV1>>().not.toMatchTypeOf<
      FreshActiveMembershipEvidenceV1
    >();
    expectTypeOf<Unbranded<ActiveInstitutionAnchorEvidenceV1>>().not.toMatchTypeOf<
      ActiveInstitutionAnchorEvidenceV1
    >();
    expectTypeOf<Unbranded<FormalProvenanceResolverV1>>().not.toMatchTypeOf<
      FormalProvenanceResolverV1
    >();
  });

  it.each(['server_session', 'trusted_gateway'] as const)(
    'parses immutable, ordered %s candidate evidence without claiming verification',
    (source) => {
      const input = provenanceEvidence({ source });
      const result = parseRequestProvenanceEvidenceCandidateV1(input);

      expect(result).toEqual(input);
      expect(Object.isFrozen(result)).toBe(true);
      input.tenantId = 'mutated';
      expect(result?.tenantId).toBe('tenant-a');
    },
  );

  it('accepts frozen candidate input and still returns an independent snapshot', () => {
    const input = Object.freeze(provenanceEvidence());
    const result = parseRequestProvenanceEvidenceCandidateV1(input);

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('parses candidate and rejected provenance as a closed non-authorizing union', () => {
    const candidate = parseProvenanceResolutionCandidateV1({
      kind: 'provenance_candidate',
      evidence: provenanceEvidence(),
    });
    const rejected = parseProvenanceResolutionCandidateV1({
      kind: 'rejected',
      code: 'provenance_expired',
    });

    expect(candidate?.kind).toBe('provenance_candidate');
    expect(rejected).toEqual({ kind: 'rejected', code: 'provenance_expired' });
    expect(Object.isFrozen(candidate)).toBe(true);
    expect(Object.isFrozen(rejected)).toBe(true);
  });

  it.each([
    'tenant_admin',
    'tenant_operator',
    'consultant',
    'customer_service',
  ] as const)('parses a %s membership candidate with exact prefixes', (role) => {
    const result = parseMembershipResolutionCandidateV1(membership({ role }));
    expect(result).toEqual(membership({ role }));
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([
    'membership_denied',
    'membership_invalid',
    'membership_unavailable',
    'membership_stale',
  ] as const)('preserves low-sensitivity membership rejection %s', (code) => {
    expect(
      parseMembershipResolutionCandidateV1({ kind: 'rejected', code }),
    ).toEqual({ kind: 'rejected', code });
  });

  it('parses candidate, denied, and unavailable anchor outcomes', () => {
    expect(parseInstitutionAnchorResolutionCandidateV1(anchor())).toEqual(anchor());
    expect(
      parseInstitutionAnchorResolutionCandidateV1({
        kind: 'denied',
        code: 'institution_anchor_denied',
      }),
    ).toEqual({ kind: 'denied', code: 'institution_anchor_denied' });
    expect(
      parseInstitutionAnchorResolutionCandidateV1({
        kind: 'unavailable',
        code: 'institution_anchor_unavailable',
      }),
    ).toEqual({ kind: 'unavailable', code: 'institution_anchor_unavailable' });
  });

  it('requires asynchronous, request-bound owner providers with exact results', () => {
    expectTypeOf<FormalProvenanceResolverV1['resolveCurrentRequest']>()
      .returns.toEqualTypeOf<Promise<ProvenanceResolutionV1>>();
    expectTypeOf<FreshActiveMembershipProviderV1['resolve']>()
      .returns.toEqualTypeOf<Promise<FreshActiveMembershipResolutionV1>>();
    expectTypeOf<ActiveInstitutionAnchorProviderV1['resolve']>()
      .returns.toEqualTypeOf<Promise<ActiveInstitutionAnchorResolutionV1>>();
  });

  it('keeps provenance dependency failure distinct from authentication rejection', () => {
    const unavailable = {
      kind: 'unavailable',
      code: 'provenance_unavailable',
    } as const satisfies ProvenanceResolutionV1;

    expect(unavailable).toEqual({
      kind: 'unavailable',
      code: 'provenance_unavailable',
    });
  });
});
