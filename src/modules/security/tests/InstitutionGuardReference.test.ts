import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  createInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceKeyRingV1,
  type InstitutionGuardReferenceOwnerSubjectV1,
} from '@/modules/security/server/institution-guard-reference';
import {
  INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1,
  isGuardReferenceCandidateV1,
  type SafeGuardReferenceV1,
} from '@/modules/security/server/institution-guard-evidence';

const NOW = new Date('2026-07-22T08:00:00.000Z');
const KEY_1 = new Uint8Array(32).fill(0x11);
const KEY_2 = new Uint8Array(32).fill(0x22);
type Unbranded<T> = {
  [Key in keyof T as Key extends symbol ? never : Key]: T[Key];
};

function ownerSubject(value: string) {
  return value as InstitutionGuardReferenceOwnerSubjectV1;
}

function keyRing(input: {
  currentVersion?: number;
  currentMaterial?: Uint8Array | null;
  verifyOnlyKeys?: InstitutionGuardReferenceKeyRingV1['verifyOnlyKeys'];
} = {}): InstitutionGuardReferenceKeyRingV1 {
  return {
    currentIssueKey: {
      keyVersion: input.currentVersion ?? 1,
      keyMaterial:
        input.currentMaterial === undefined ? KEY_1 : input.currentMaterial,
    },
    verifyOnlyKeys: input.verifyOnlyKeys ?? [],
  };
}

type ReferenceInput<Prefix extends 'arv' | 'mrv'> = Readonly<{
  prefix: Prefix;
  ownerDomain: string;
  tenantId: string | null;
  institutionId: string | null;
  ownerSubject: InstitutionGuardReferenceOwnerSubjectV1;
}>;

function referenceInput<Prefix extends 'arv' | 'mrv' = 'arv'>(
  overrides: Partial<{
    ownerDomain: string;
    tenantId: string | null;
    institutionId: string | null;
    ownerSubject: InstitutionGuardReferenceOwnerSubjectV1;
  }> & { prefix?: Prefix } = {},
): ReferenceInput<Prefix> {
  return {
    prefix: (overrides.prefix ?? 'arv') as Prefix,
    ownerDomain: 'security.institution-anchor',
    tenantId: 'tenant-zhengpu',
    institutionId: 'institution-zhengpu',
    ownerSubject: ownerSubject('revision-7'),
    ...overrides,
  };
}

function createCodec(
  ring: InstitutionGuardReferenceKeyRingV1 = keyRing(),
  now: () => Date = () => NOW,
) {
  return createInstitutionGuardReferenceCodecV1({ keyRing: ring, now });
}

function issuedReference(
  codec = createCodec(),
  input: ReferenceInput<'arv' | 'mrv'> = referenceInput(),
): string {
  const result = codec.issue(input);
  expect(result.kind).toBe('issued');
  if (result.kind !== 'issued') throw new Error('expected issued fixture');
  return result.reference;
}

describe('BASE-02B guard reference HMAC codec', () => {
  it('issues a deterministic full-length domain-separated HMAC reference', () => {
    const codec = createCodec();
    const first = codec.issue(referenceInput());
    const second = codec.issue(referenceInput());

    expect(first).toEqual(second);
    expect(first).toEqual({
      kind: 'issued',
      reference:
        'arv_v1_k1_lX9qk4r7ZpF1JL6ZlijUDIEgNJQcq_zUB22-uleOzzE',
    });
    expect(Object.isFrozen(first)).toBe(true);
    if (first.kind === 'issued') {
      expect(first.reference).toMatch(/^arv_v1_k1_[A-Za-z0-9_-]{43}$/u);
      expect(isGuardReferenceCandidateV1(first.reference, 'arv')).toBe(true);
      expectTypeOf(first.reference).toEqualTypeOf<SafeGuardReferenceV1<'arv'>>();
    }
  });

  it('keeps the codec handle nominally sealed against structural substitution', () => {
    expectTypeOf<Unbranded<InstitutionGuardReferenceCodecV1>>().not.toMatchTypeOf<
      InstitutionGuardReferenceCodecV1
    >();
  });

  it('separates prefix, owner domain, scope and owner-local subject', () => {
    const codec = createCodec();
    const baseline = issuedReference(codec);
    const variants = [
      issuedReference(codec, referenceInput({ prefix: 'mrv' })),
      issuedReference(
        codec,
        referenceInput({ ownerDomain: 'security.institution-membership' }),
      ),
      issuedReference(codec, referenceInput({ tenantId: 'tenant-other' })),
      issuedReference(
        codec,
        referenceInput({ institutionId: 'institution-other' }),
      ),
      issuedReference(
        codec,
        referenceInput({ ownerSubject: ownerSubject('revision-8') }),
      ),
      issuedReference(
        codec,
        referenceInput({ institutionId: null }),
      ),
      issuedReference(
        codec,
        referenceInput({ tenantId: null, institutionId: null }),
      ),
    ];

    expect(new Set([baseline, ...variants]).size).toBe(variants.length + 1);
  });

  it('verifies only the exact owner context and promotes only a valid tag', () => {
    const codec = createCodec();
    const input = referenceInput();
    const reference = issuedReference(codec, input);

    const verified = codec.verify({ ...input, reference });
    expect(verified).toEqual({ kind: 'verified', reference });
    expect(Object.isFrozen(verified)).toBe(true);
    if (verified.kind === 'verified') {
      expectTypeOf(verified.reference).toEqualTypeOf<
        SafeGuardReferenceV1<'arv'>
      >();
    }

    for (const mismatched of [
      referenceInput({ prefix: 'mrv' }),
      referenceInput({ ownerDomain: 'security.institution-membership' }),
      referenceInput({ tenantId: 'tenant-other' }),
      referenceInput({ institutionId: 'institution-other' }),
      referenceInput({ ownerSubject: ownerSubject('revision-8') }),
    ]) {
      expect(codec.verify({ ...mismatched, reference })).toEqual({
        kind: 'rejected',
        code: 'guard_reference_invalid',
      });
    }
  });

  it('uses the shared accepted-key policy and keeps unsupported rotation closed', () => {
    expect(INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1).toEqual([1]);
    const currentReference = issuedReference(createCodec(), referenceInput());
    const unsupportedIssueCodec = createCodec(
      keyRing({ currentVersion: 2, currentMaterial: KEY_2 }),
    );
    expect(unsupportedIssueCodec.issue(referenceInput())).toEqual({
      kind: 'unavailable',
      code: 'guard_reference_unavailable',
    });

    const unsupportedReference = currentReference.replace('_k1_', '_k2_');
    expect(
      createCodec().verify({
        ...referenceInput(),
        reference: unsupportedReference,
      }),
    ).toEqual({ kind: 'rejected', code: 'guard_reference_invalid' });

    const unsupportedVerifyOnlyCodec = createCodec(
      keyRing({
        verifyOnlyKeys: [
          {
            keyVersion: 2,
            keyMaterial: KEY_2,
            verifyUntil: '2026-07-22T08:05:00.000Z',
          },
        ],
      }),
    );
    expect(unsupportedVerifyOnlyCodec.issue(referenceInput())).toEqual({
      kind: 'unavailable',
      code: 'guard_reference_unavailable',
    });
  });

  it('does not use a missing current key or an unknown key version', () => {
    const goodReference = issuedReference(createCodec(), referenceInput());
    const missingCurrent = createCodec(keyRing({ currentMaterial: null }));
    expect(missingCurrent.issue(referenceInput())).toEqual({
      kind: 'unavailable',
      code: 'guard_reference_unavailable',
    });
    expect(
      missingCurrent.verify({ ...referenceInput(), reference: goodReference }),
    ).toEqual({ kind: 'unavailable', code: 'guard_reference_unavailable' });

    const unknownVersion = goodReference.replace('_k1_', '_k999_');
    expect(
      createCodec().verify({
        ...referenceInput(),
        reference: unknownVersion,
      }),
    ).toEqual({ kind: 'rejected', code: 'guard_reference_invalid' });

  });

  it('does not apply evidence TTL to a current-key reference', () => {
    const codec = createCodec(keyRing(), () => {
      throw new Error('current-key reference does not consult a clock');
    });
    const reference = issuedReference(codec, referenceInput());

    expect(codec.verify({ ...referenceInput(), reference })).toEqual({
      kind: 'verified',
      reference,
    });
  });

  it('snapshots key material so caller mutation cannot alter issued references', () => {
    const mutableKey = new Uint8Array(32).fill(0x33);
    const ring = keyRing({ currentMaterial: mutableKey });
    const codec = createCodec(ring);
    const before = issuedReference(codec, referenceInput());

    mutableKey.fill(0x44);
    ring.currentIssueKey.keyMaterial?.fill(0x55);

    expect(issuedReference(codec, referenceInput())).toBe(before);
  });
});
