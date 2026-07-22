import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  createActiveInstitutionAnchorProviderV1,
  type AuthoritativeInstitutionAnchorFactReaderV1,
} from '@/modules/security/server/institution-anchor-provider';
import {
  createFormalRequestProvenanceResolverV1,
  type FormalRequestProvenanceOwnerInputV1,
} from '@/modules/security/server/formal-request-provenance-owner';
import type {
  ActiveInstitutionAnchorEvidenceV1,
  ActiveInstitutionAnchorProviderV1,
  FormalProvenanceResolverV1,
  FormalRequestProvenanceEvidenceV1,
  FreshActiveMembershipEvidenceV1,
  FreshActiveMembershipProviderV1,
} from '@/modules/security/server/institution-guard-evidence';
import {
  createInstitutionGuardReferenceCodecV1,
  isInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
} from '@/modules/security/server/institution-guard-reference';
import {
  createRequestBoundFreshActiveMembershipProviderV1,
  type AuthoritativeInstitutionMembershipFactReaderV1,
} from '@/modules/security/server/institution-membership-provider';
import {
  createInstitutionScopeGuardV1,
  INSTITUTION_SCOPE_GUARD_FAILURE_CODES_V1,
  isInstitutionScopeAllowV1,
  isInstitutionScopeGuardV1,
  type InstitutionScopeAllowV1,
  type InstitutionScopeGuardV1,
} from '@/modules/security/server/institution-scope-guard';

const NOW = new Date('2026-07-22T08:00:30.000Z');
const TOKEN = 'A'.repeat(43);
const TEST_REFERENCE_KEY = new Uint8Array(32).fill(0x31);

type Unbranded<T> = {
  [Key in keyof T as Key extends symbol ? never : Key]: T[Key];
};

function reference(prefix: string, token = TOKEN, keyVersion = 1) {
  return `${prefix}_v1_k${keyVersion}_${token}`;
}

function genuineReference(prefix: string) {
  return expect.stringMatching(
    new RegExp(`^${prefix}_v1_k1_[A-Za-z0-9_-]{43}$`, 'u'),
  );
}

function provenance(
  overrides: Record<string, unknown> = {},
): FormalRequestProvenanceEvidenceV1 {
  return Object.freeze({
    source: 'server_session',
    userReference: reference('usr'),
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    requestReference: reference('req'),
    proofReference: reference('prf'),
    issuedAt: '2026-07-22T07:59:00.000Z',
    verifiedAt: '2026-07-22T07:59:01.000Z',
    validUntil: '2026-07-22T08:04:00.000Z',
    ...overrides,
  }) as unknown as FormalRequestProvenanceEvidenceV1;
}

function membership(
  overrides: Record<string, unknown> = {},
): FreshActiveMembershipEvidenceV1 {
  return Object.freeze({
    kind: 'fresh_active',
    userReference: reference('usr'),
    role: 'tenant_admin',
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    membershipReference: reference('mbr'),
    membershipRevision: reference('mrv'),
    bindingReference: reference('bnd'),
    bindingRevision: reference('brv'),
    observedAt: '2026-07-22T08:00:00.000Z',
    freshUntil: '2026-07-22T08:01:00.000Z',
    ...overrides,
  }) as unknown as FreshActiveMembershipEvidenceV1;
}

function anchor(
  overrides: Record<string, unknown> = {},
): ActiveInstitutionAnchorEvidenceV1 {
  return Object.freeze({
    kind: 'active',
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    anchorReference: reference('anc'),
    anchorRevision: reference('arv'),
    observedAt: '2026-07-22T08:00:00.000Z',
    freshUntil: '2026-07-22T08:01:00.000Z',
    ...overrides,
  }) as unknown as ActiveInstitutionAnchorEvidenceV1;
}

function verified(evidence: unknown = provenance()) {
  return Object.freeze({ kind: 'verified', evidence });
}

type HarnessOptions = Readonly<{
  provenanceResolution?: unknown;
  membershipResolution?: unknown;
  anchorResolution?: unknown;
  provenanceError?: unknown;
  membershipError?: unknown;
  anchorError?: unknown;
  now?: () => Date;
  membershipNow?: () => Date;
  anchorNow?: () => Date;
  order?: string[];
  membershipAccountId?: string;
  controlledReferenceCodecStage?: 'provenance' | 'membership' | 'anchor';
}>;

function ownRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function evidenceFromResolution(value: unknown) {
  const resolution = ownRecord(value);
  return resolution?.kind === 'verified'
    ? ownRecord(resolution.evidence)
    : null;
}

function controlledCodec(
  references: Readonly<Record<string, unknown>> = {},
): InstitutionGuardReferenceCodecV1 {
  return Object.freeze({
    issue: vi.fn((input: { prefix: string }) =>
      Object.freeze({
        kind: 'issued',
        reference:
          typeof references[input.prefix] === 'string'
            ? references[input.prefix]
            : reference(input.prefix),
      }),
    ),
    verify: vi.fn((input: { reference: unknown }) =>
      Object.freeze({
        kind: 'verified',
        reference: input.reference,
      }),
    ),
  }) as unknown as InstitutionGuardReferenceCodecV1;
}

function genuineCodec(): InstitutionGuardReferenceCodecV1 {
  return createInstitutionGuardReferenceCodecV1({
    keyRing: {
      currentIssueKey: {
        keyVersion: 1,
        keyMaterial: TEST_REFERENCE_KEY,
      },
      verifyOnlyKeys: [],
    },
    now: () => NOW,
  });
}

function ownerInputFromResolution(
  value: unknown,
): FormalRequestProvenanceOwnerInputV1 | null {
  const resolution = ownRecord(value);
  if (resolution?.kind === 'rejected') {
    switch (resolution.code) {
      case 'provenance_missing':
        return null;
      case 'provenance_source_denied':
        return {
          source: 'demo_session',
          accountId: 'account-a',
          tenantId: 'tenant-a',
          institutionId: 'institution-a',
          requestIdentifier: 'request-a',
          proofIdentifier: 'proof-a',
          issuedAt: '2026-07-22T07:59:00.000Z',
          proofValidUntil: '2026-07-22T08:04:00.000Z',
        } as unknown as FormalRequestProvenanceOwnerInputV1;
      case 'provenance_invalid':
        return {
          source: 'server_session',
          accountId: 'invalid/account',
          tenantId: 'tenant-a',
          institutionId: 'institution-a',
          requestIdentifier: 'request-a',
          proofIdentifier: 'proof-a',
          issuedAt: '2026-07-22T07:59:00.000Z',
          proofValidUntil: '2026-07-22T08:04:00.000Z',
        } as unknown as FormalRequestProvenanceOwnerInputV1;
      default:
        break;
    }
  }
  const evidence = evidenceFromResolution(value) ?? ownRecord(provenance());
  if (!evidence) throw new Error('expected provenance fixture');
  return {
    source: evidence.source,
    accountId: 'account-a',
    tenantId: evidence.tenantId,
    institutionId: evidence.institutionId,
    requestIdentifier: 'request-a',
    proofIdentifier: 'proof-a',
    issuedAt: evidence.issuedAt,
    proofValidUntil: evidence.validUntil,
  } as unknown as FormalRequestProvenanceOwnerInputV1;
}

function ownerHarness(options: HarnessOptions = {}) {
  const provenanceEvidence =
    evidenceFromResolution(options.provenanceResolution) ??
    ownRecord(provenance());
  if (!provenanceEvidence) throw new Error('expected provenance fixture');
  const membershipEvidence =
    ownRecord(options.membershipResolution)?.kind === 'fresh_active'
      ? ownRecord(options.membershipResolution)
      : ownRecord(membership());
  const anchorEvidence =
    ownRecord(options.anchorResolution)?.kind === 'active'
      ? ownRecord(options.anchorResolution)
      : ownRecord(anchor());
  if (!membershipEvidence || !anchorEvidence) {
    throw new Error('expected owner evidence fixtures');
  }

  const provenanceCodec =
    options.controlledReferenceCodecStage === 'provenance'
      ? controlledCodec({
          usr: provenanceEvidence.userReference,
          req: provenanceEvidence.requestReference,
          prf: provenanceEvidence.proofReference,
        })
      : genuineCodec();
  const membershipCodec =
    options.controlledReferenceCodecStage === 'membership'
      ? controlledCodec({
          usr: membershipEvidence.userReference,
          mbr: membershipEvidence.membershipReference,
          mrv: membershipEvidence.membershipRevision,
          bnd: membershipEvidence.bindingReference,
          brv: membershipEvidence.bindingRevision,
        })
      : genuineCodec();
  const anchorCodec = options.controlledReferenceCodecStage === 'anchor'
    ? controlledCodec({
        anc: anchorEvidence.anchorReference,
        arv: anchorEvidence.anchorRevision,
      })
    : genuineCodec();

  const requestedProvenanceResolution = ownRecord(options.provenanceResolution);
  const provenanceNowValue =
    requestedProvenanceResolution?.kind === 'rejected' &&
    requestedProvenanceResolution.code === 'provenance_expired'
      ? new Date('2026-07-22T08:04:00.000Z')
      : typeof provenanceEvidence.verifiedAt === 'string'
        ? new Date(provenanceEvidence.verifiedAt)
        : NOW;
  const provenanceNow = vi.fn(() => {
    options.order?.push('provenance');
    if (options.provenanceError !== undefined) throw options.provenanceError;
    if (
      requestedProvenanceResolution?.kind === 'unavailable' ||
      requestedProvenanceResolution?.kind === 'unknown'
    ) {
      throw new Error('controlled provenance unavailable');
    }
    return provenanceNowValue;
  });
  const provenanceResolver = createFormalRequestProvenanceResolverV1({
    ownerInput: ownerInputFromResolution(
      options.provenanceResolution ?? verified(provenanceEvidence),
    ),
    referenceCodec:
      ownRecord(options.provenanceResolution)?.kind === 'unavailable'
        ? ({ issue: null, verify: null } as never)
        : provenanceCodec,
    now: provenanceNow,
  });

  const membershipResolution = ownRecord(options.membershipResolution);
  const membershipObservedAt =
    typeof membershipEvidence.observedAt === 'string'
      ? membershipEvidence.observedAt
      : '2026-07-22T08:00:00.000Z';
  const membershipFreshUntil =
    typeof membershipEvidence.freshUntil === 'string'
      ? Date.parse(membershipEvidence.freshUntil)
      : Number.NaN;
  const membershipObservedEpochMs = Date.parse(membershipObservedAt);
  const membershipTtlIsInvalid =
    Number.isFinite(membershipFreshUntil) &&
    Number.isFinite(membershipObservedEpochMs) &&
    membershipFreshUntil - membershipObservedEpochMs > 60_000;
  const resolveMembershipFact = vi.fn(async () => {
    options.order?.push('membership');
    if (options.membershipError !== undefined) throw options.membershipError;
    if (membershipTtlIsInvalid) return Object.freeze({ kind: 'invalid' }) as never;
    if (
      membershipResolution?.kind === 'rejected' &&
      membershipResolution.code !== 'membership_stale'
    ) {
      return options.membershipResolution as never;
    }
    if (membershipResolution?.kind === 'unknown') {
      return options.membershipResolution as never;
    }
    const observedAt =
      membershipResolution?.kind === 'rejected' &&
      membershipResolution.code === 'membership_stale'
        ? '2026-07-22T07:59:00.000Z'
        : typeof membershipEvidence.freshUntil === 'string' &&
            membershipEvidence.freshUntil !== '2026-07-22T08:01:00.000Z' &&
            !membershipTtlIsInvalid
          ? new Date(
              Date.parse(membershipEvidence.freshUntil) - 60_000,
            ).toISOString()
          : membershipObservedAt;
    return Object.freeze({
      kind: 'current_membership_fact',
      accountId: options.membershipAccountId ?? 'account-a',
      tenantId: membershipEvidence.tenantId,
      institutionId: membershipEvidence.institutionId,
      role: membershipEvidence.role,
      membershipId: 'membership-a',
      membershipRevisionAt: '2026-07-22T07:58:00.000Z',
      bindingId: 'binding-a',
      bindingRevision: 7,
      bindingRevisionAt: '2026-07-01T00:00:00.000Z',
      bindingExpiresAt: null,
      observedAt,
    }) as never;
  });
  const membershipProvider =
    createRequestBoundFreshActiveMembershipProviderV1({
      accountId: options.membershipAccountId ?? 'account-a',
      factReader: Object.freeze({
        resolve: resolveMembershipFact,
      }) as AuthoritativeInstitutionMembershipFactReaderV1,
      referenceCodec: membershipCodec,
      now: options.membershipNow ?? (() => NOW),
    });

  const anchorResolution = ownRecord(options.anchorResolution);
  const anchorObservedAt =
    typeof anchorEvidence.observedAt === 'string'
      ? anchorEvidence.observedAt
      : '2026-07-22T08:00:00.000Z';
  const anchorFreshUntil =
    typeof anchorEvidence.freshUntil === 'string'
      ? Date.parse(anchorEvidence.freshUntil)
      : Number.NaN;
  const anchorObservedEpochMs = Date.parse(anchorObservedAt);
  const anchorTtlIsInvalid =
    Number.isFinite(anchorFreshUntil) &&
    Number.isFinite(anchorObservedEpochMs) &&
    anchorFreshUntil - anchorObservedEpochMs > 60_000;
  const resolveAnchorFact = vi.fn(async () => {
    options.order?.push('anchor');
    if (options.anchorError !== undefined) throw options.anchorError;
    if (anchorTtlIsInvalid) return Object.freeze({ kind: 'invalid' }) as never;
    if (
      anchorResolution?.kind === 'denied' ||
      anchorResolution?.kind === 'unavailable' ||
      anchorResolution?.kind === 'unknown'
    ) {
      return options.anchorResolution as never;
    }
    const observedAt =
      typeof anchorEvidence.freshUntil === 'string' &&
      anchorEvidence.freshUntil !== '2026-07-22T08:01:00.000Z' &&
      !anchorTtlIsInvalid
        ? new Date(Date.parse(anchorEvidence.freshUntil) - 60_000).toISOString()
        : anchorObservedAt;
    return Object.freeze({
      kind: 'current_anchor_fact',
      tenantId: anchorEvidence.tenantId,
      institutionId: anchorEvidence.institutionId,
      revision: 7,
      observedAt,
    }) as never;
  });
  const anchorProvider = createActiveInstitutionAnchorProviderV1({
    factReader: Object.freeze({
      resolve: resolveAnchorFact,
    }) as AuthoritativeInstitutionAnchorFactReaderV1,
    referenceCodec: anchorCodec,
    now: options.anchorNow ?? (() => NOW),
  });

  const factoryInput = {
    provenanceResolver,
    membershipProvider,
    anchorProvider,
    now: options.now ?? (() => NOW),
  };
  return {
    factoryInput,
    provenanceResolver,
    membershipProvider,
    anchorProvider,
    referenceCodecs: Object.freeze([
      provenanceCodec,
      membershipCodec,
      anchorCodec,
    ]),
    provenanceNow,
    resolveMembershipFact,
    resolveAnchorFact,
    resolveCurrentRequest: provenanceNow,
    resolveMembership: resolveMembershipFact,
    resolveAnchor: resolveAnchorFact,
    guard: createInstitutionScopeGuardV1(factoryInput),
  };
}

const OWNER_LOOKALIKE_KINDS = Object.freeze([
  'plain',
  'spread',
  'cast',
  'custom_proto',
  'accessor',
  'proxy',
  'revoked_proxy',
] as const);

type OwnerLookalikeKind = (typeof OWNER_LOOKALIKE_KINDS)[number];

function ownerLookalike(
  kind: OwnerLookalikeKind,
  authenticHandle: object,
  methodName: 'resolveCurrentRequest' | 'resolve',
) {
  const fakeMethod = vi.fn(async () => {
    throw new Error('lookalike method must not run');
  });
  let getterReads = 0;
  let proxyTraps = 0;
  const plain = { [methodName]: fakeMethod };
  let value: object;

  switch (kind) {
    case 'plain':
      value = Object.freeze(plain);
      break;
    case 'spread':
      value = Object.freeze({ ...authenticHandle });
      break;
    case 'cast':
      value = Object.freeze({ [methodName]: fakeMethod });
      break;
    case 'custom_proto':
      value = Object.freeze(
        Object.assign(Object.create({ owner: 'lookalike' }), plain),
      );
      break;
    case 'accessor': {
      const accessor = {};
      Object.defineProperty(accessor, methodName, {
        enumerable: true,
        get() {
          getterReads += 1;
          return fakeMethod;
        },
      });
      value = Object.freeze(accessor);
      break;
    }
    case 'proxy':
      value = new Proxy(Object.freeze(plain), {
        get() {
          proxyTraps += 1;
          throw new Error('lookalike get trap');
        },
        getOwnPropertyDescriptor() {
          proxyTraps += 1;
          throw new Error('lookalike descriptor trap');
        },
        getPrototypeOf() {
          proxyTraps += 1;
          throw new Error('lookalike prototype trap');
        },
        has() {
          proxyTraps += 1;
          throw new Error('lookalike has trap');
        },
        ownKeys() {
          proxyTraps += 1;
          throw new Error('lookalike ownKeys trap');
        },
      });
      break;
    case 'revoked_proxy': {
      const revocable = Proxy.revocable(Object.freeze(plain), {});
      revocable.revoke();
      value = revocable.proxy;
      break;
    }
  }

  return Object.freeze({
    value,
    fakeMethod,
    getterReads: () => getterReads,
    proxyTraps: () => proxyTraps,
  });
}

describe('BASE-02B institution scope guard composition', () => {
  it('uses only genuine reference codecs in the positive owner harness', () => {
    const harness = ownerHarness();
    expect(
      harness.referenceCodecs.every((codec) =>
        isInstitutionGuardReferenceCodecV1(codec),
      ),
    ).toBe(true);
  });

  it.each(['provenance', 'membership', 'anchor'] as const)(
    'uses a controlled codec only for the %s stage',
    (stage) => {
      const harness = ownerHarness({ controlledReferenceCodecStage: stage });
      expect(
        harness.referenceCodecs.map((codec) =>
          isInstitutionGuardReferenceCodecV1(codec),
        ),
      ).toEqual([
        stage !== 'provenance',
        stage !== 'membership',
        stage !== 'anchor',
      ]);
    },
  );

  it.each(OWNER_LOOKALIKE_KINDS)(
    'rejects a %s provenance resolver lookalike before invoking any owner method',
    async (kind) => {
      const harness = ownerHarness();
      const lookalike = ownerLookalike(
        kind,
        harness.provenanceResolver,
        'resolveCurrentRequest',
      );
      const guard = createInstitutionScopeGuardV1({
        ...harness.factoryInput,
        provenanceResolver: lookalike.value as FormalProvenanceResolverV1,
      });

      await expect(guard.authorizeCurrentRequest()).resolves.toEqual({
        kind: 'rejected',
        code: 'provenance_unavailable',
      });
      expect(lookalike.fakeMethod).not.toHaveBeenCalled();
      expect(lookalike.getterReads()).toBe(0);
      expect(lookalike.proxyTraps()).toBe(0);
      expect(harness.resolveCurrentRequest).not.toHaveBeenCalled();
      expect(harness.resolveMembership).not.toHaveBeenCalled();
      expect(harness.resolveAnchor).not.toHaveBeenCalled();
    },
  );

  it.each(OWNER_LOOKALIKE_KINDS)(
    'rejects a %s membership provider lookalike after genuine provenance',
    async (kind) => {
      const harness = ownerHarness();
      const lookalike = ownerLookalike(
        kind,
        harness.membershipProvider,
        'resolve',
      );
      const guard = createInstitutionScopeGuardV1({
        ...harness.factoryInput,
        membershipProvider: lookalike.value as FreshActiveMembershipProviderV1,
      });

      await expect(guard.authorizeCurrentRequest()).resolves.toEqual({
        kind: 'rejected',
        code: 'membership_unavailable',
      });
      expect(harness.resolveCurrentRequest).toHaveBeenCalledTimes(1);
      expect(lookalike.fakeMethod).not.toHaveBeenCalled();
      expect(lookalike.getterReads()).toBe(0);
      expect(lookalike.proxyTraps()).toBe(0);
      expect(harness.resolveMembership).not.toHaveBeenCalled();
      expect(harness.resolveAnchor).not.toHaveBeenCalled();
    },
  );

  it.each(OWNER_LOOKALIKE_KINDS)(
    'rejects a %s anchor provider lookalike after genuine provenance and membership',
    async (kind) => {
      const harness = ownerHarness();
      const lookalike = ownerLookalike(
        kind,
        harness.anchorProvider,
        'resolve',
      );
      const guard = createInstitutionScopeGuardV1({
        ...harness.factoryInput,
        anchorProvider: lookalike.value as ActiveInstitutionAnchorProviderV1,
      });

      await expect(guard.authorizeCurrentRequest()).resolves.toEqual({
        kind: 'rejected',
        code: 'institution_anchor_unavailable',
      });
      expect(harness.resolveCurrentRequest).toHaveBeenCalledTimes(1);
      expect(harness.resolveMembership).toHaveBeenCalledTimes(1);
      expect(lookalike.fakeMethod).not.toHaveBeenCalled();
      expect(lookalike.getterReads()).toBe(0);
      expect(lookalike.proxyTraps()).toBe(0);
      expect(harness.resolveAnchor).not.toHaveBeenCalled();
    },
  );

  it.each(['server_session', 'trusted_gateway'] as const)(
    'allows all four institution roles from owner-held %s evidence',
    async (source) => {
      for (const role of [
        'tenant_admin',
        'tenant_operator',
        'consultant',
        'customer_service',
      ] as const) {
        const evidence = provenance({ source });
        const harness = ownerHarness({
          provenanceResolution: verified(evidence),
          membershipResolution: membership({ role }),
        });
        const result = await harness.guard.authorizeCurrentRequest();

        expect(result).toEqual({
          kind: 'institution_scope_allow',
          requestReference: genuineReference('req'),
          userReference: genuineReference('usr'),
          role,
          source,
          tenantId: 'tenant-a',
          institutionId: 'institution-a',
          membershipRevision: genuineReference('mrv'),
          bindingRevision: genuineReference('brv'),
          anchorRevision: genuineReference('arv'),
          provenanceValidUntil: '2026-07-22T08:04:00.000Z',
          membershipFreshUntil: '2026-07-22T08:01:00.000Z',
          anchorFreshUntil: '2026-07-22T08:01:00.000Z',
          decidedAt: '2026-07-22T08:00:30.000Z',
          validUntil: '2026-07-22T08:01:00.000Z',
        });
        expect(Object.isFrozen(result)).toBe(true);
        expect(isInstitutionScopeAllowV1(result)).toBe(true);
      }
    },
  );

  it('keeps guard and allow nominally sealed and runtime-authentic', async () => {
    expectTypeOf<Unbranded<InstitutionScopeGuardV1>>().not.toMatchTypeOf<
      InstitutionScopeGuardV1
    >();
    expectTypeOf<Unbranded<InstitutionScopeAllowV1>>().not.toMatchTypeOf<
      InstitutionScopeAllowV1
    >();

    const { guard } = ownerHarness();
    const allow = await guard.authorizeCurrentRequest();
    const guardLookalike = Object.freeze({
      authorizeCurrentRequest: guard.authorizeCurrentRequest,
    });
    const allowLookalike = Object.freeze({ ...allow });

    expect(isInstitutionScopeGuardV1(guard)).toBe(true);
    expect(isInstitutionScopeGuardV1(guardLookalike)).toBe(false);
    expect(isInstitutionScopeGuardV1(new Proxy(guard, {}))).toBe(false);
    expect(isInstitutionScopeAllowV1(allow)).toBe(true);
    expect(isInstitutionScopeAllowV1(allowLookalike)).toBe(false);
    expect(isInstitutionScopeAllowV1(new Proxy(allow, {}))).toBe(false);
    expect(isInstitutionScopeAllowV1({ kind: 'institution_scope_allow' })).toBe(
      false,
    );
  });

  it('exposes only a no-argument authorization method and ignores hostile caller arguments', async () => {
    const { guard } = ownerHarness();
    let traps = 0;
    const hostile = new Proxy(
      {},
      {
        get() {
          traps += 1;
          throw new Error('caller scope trap');
        },
        ownKeys() {
          traps += 1;
          throw new Error('caller evidence trap');
        },
      },
    );

    expect(Object.keys(guard)).toEqual(['authorizeCurrentRequest']);
    expect(guard).not.toHaveProperty('evaluate');
    expect(guard.authorizeCurrentRequest).toHaveLength(0);
    const result = await (
      guard.authorizeCurrentRequest as (...args: unknown[]) => Promise<unknown>
    )(hostile);
    expect(result).toMatchObject({ kind: 'institution_scope_allow' });
    expect(traps).toBe(0);
  });

  it('calls owners in order with provenance-derived scope only', async () => {
    const calls: string[] = [];
    const harness = ownerHarness({
      order: calls,
      provenanceResolution: verified(
        provenance({
          tenantId: 'tenant-owner',
          institutionId: 'institution-owner',
        }),
      ),
      membershipResolution: membership({
        tenantId: 'tenant-owner',
        institutionId: 'institution-owner',
      }),
      anchorResolution: anchor({
        tenantId: 'tenant-owner',
        institutionId: 'institution-owner',
      }),
    });

    await expect(harness.guard.authorizeCurrentRequest()).resolves.toMatchObject({
      kind: 'institution_scope_allow',
      tenantId: 'tenant-owner',
      institutionId: 'institution-owner',
    });
    expect(calls).toEqual(['provenance', 'membership', 'anchor']);
    expect(harness.resolveMembership).toHaveBeenCalledWith({
      accountId: 'account-a',
      tenantId: 'tenant-owner',
      institutionId: 'institution-owner',
    });
    expect(harness.resolveAnchor).toHaveBeenCalledWith({
      tenantId: 'tenant-owner',
      institutionId: 'institution-owner',
    });
  });

  it.each([
    ['provenance_missing', 'provenance_missing'],
    ['provenance_invalid', 'provenance_invalid'],
    ['provenance_expired', 'provenance_expired'],
    ['provenance_source_denied', 'provenance_source_denied'],
  ] as const)(
    'maps owner provenance rejection %s and stops downstream',
    async (ownerCode, expectedCode) => {
      const harness = ownerHarness({
        provenanceResolution: Object.freeze({
          kind: 'rejected',
          code: ownerCode,
        }),
      });
      await expect(harness.guard.authorizeCurrentRequest()).resolves.toEqual({
        kind: 'rejected',
        code: expectedCode,
      });
      expect(harness.resolveMembership).not.toHaveBeenCalled();
      expect(harness.resolveAnchor).not.toHaveBeenCalled();
    },
  );

  it.each([
    [Object.freeze({ kind: 'unavailable', code: 'provenance_unavailable' }), undefined],
    [Object.freeze({ kind: 'unknown' }), undefined],
    [undefined, new Error('sensitive resolver failure')],
  ] as const)(
    'maps unavailable, malformed, and thrown provenance resolution to low-sensitive unavailability',
    async (provenanceResolution, provenanceError) => {
      const harness = ownerHarness({
        provenanceResolution,
        provenanceError,
      });
      const result = await harness.guard.authorizeCurrentRequest();
      expect(result).toEqual({
        kind: 'rejected',
        code: 'provenance_unavailable',
      });
      expect(JSON.stringify(result)).not.toContain('sensitive');
      expect(harness.resolveMembership).not.toHaveBeenCalled();
      expect(harness.resolveAnchor).not.toHaveBeenCalled();
    },
  );

  it.each([
    'membership_denied',
    'membership_invalid',
    'membership_unavailable',
    'membership_stale',
  ] as const)(
    'maps owner membership rejection %s and stops anchor resolution',
    async (code) => {
      const harness = ownerHarness({
        membershipResolution: Object.freeze({ kind: 'rejected', code }),
      });
      await expect(harness.guard.authorizeCurrentRequest()).resolves.toEqual({
        kind: 'rejected',
        code,
      });
      expect(harness.resolveAnchor).not.toHaveBeenCalled();
    },
  );

  it('maps thrown and malformed membership results without calling anchor', async () => {
    for (const options of [
      { membershipError: new Error('private membership failure') },
      { membershipResolution: Object.freeze({ kind: 'unknown' }) },
    ]) {
      const harness = ownerHarness(options);
      const result = await harness.guard.authorizeCurrentRequest();
      expect(['membership_invalid', 'membership_unavailable']).toContain(
        (result as { code: string }).code,
      );
      expect(JSON.stringify(result)).not.toContain('private');
      expect(harness.resolveAnchor).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['denied', 'institution_anchor_denied'],
    ['unavailable', 'institution_anchor_unavailable'],
  ] as const)('maps owner anchor %s distinctly', async (kind, code) => {
    const harness = ownerHarness({
      anchorResolution: Object.freeze({ kind, code }),
    });
    await expect(harness.guard.authorizeCurrentRequest()).resolves.toEqual({
      kind: 'rejected',
      code,
    });
  });

  it('maps thrown and malformed anchor results to low-sensitive unavailability', async () => {
    for (const options of [
      { anchorError: new Error('private anchor failure') },
      { anchorResolution: Object.freeze({ kind: 'unknown' }) },
    ]) {
      const result = await ownerHarness(options).guard.authorizeCurrentRequest();
      expect(result).toEqual({
        kind: 'rejected',
        code: 'institution_anchor_unavailable',
      });
      expect(JSON.stringify(result)).not.toContain('private');
    }
  });

  it('consumes request provenance once per authorization and never retries it', async () => {
    const harness = ownerHarness();

    await expect(harness.guard.authorizeCurrentRequest()).resolves.toMatchObject({
      kind: 'institution_scope_allow',
    });
    await expect(harness.guard.authorizeCurrentRequest()).resolves.toEqual({
      kind: 'rejected',
      code: 'provenance_source_denied',
    });
    expect(harness.resolveCurrentRequest).toHaveBeenCalledTimes(1);
    expect(harness.resolveMembership).toHaveBeenCalledTimes(1);
    expect(harness.resolveAnchor).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'provenance',
      { provenanceResolution: verified(provenance({ validUntil: '2026-07-22T08:00:40.000Z' })) },
      '2026-07-22T08:00:40.000Z',
    ],
    [
      'membership',
      { membershipResolution: membership({ freshUntil: '2026-07-22T08:00:41.000Z' }) },
      '2026-07-22T08:00:41.000Z',
    ],
    [
      'anchor',
      { anchorResolution: anchor({ freshUntil: '2026-07-22T08:00:42.000Z' }) },
      '2026-07-22T08:00:42.000Z',
    ],
  ] as const)(
    'uses the %s freshness boundary as the exact validUntil minimum',
    async (_name, options, validUntil) => {
      const result = await ownerHarness(options).guard.authorizeCurrentRequest();
      expect(result).toMatchObject({
        kind: 'institution_scope_allow',
        validUntil,
      });
    },
  );

  it('uses the same exact minimum when all deadlines match', async () => {
    const deadline = '2026-07-22T08:00:45.000Z';
    const result = await ownerHarness({
      provenanceResolution: verified(provenance({ validUntil: deadline })),
      membershipResolution: membership({ freshUntil: deadline }),
      anchorResolution: anchor({ freshUntil: deadline }),
    }).guard.authorizeCurrentRequest();
    expect(result).toMatchObject({ kind: 'institution_scope_allow', validUntil: deadline });
  });

  it.each([
    [
      'provenance deadline',
      { now: () => new Date('2026-07-22T08:04:00.000Z') },
      'provenance_expired',
    ],
    [
      'membership deadline',
      { now: () => new Date('2026-07-22T08:01:00.000Z') },
      'membership_stale',
    ],
    [
      'anchor deadline',
      {
        now: () => new Date('2026-07-22T08:01:00.000Z'),
        membershipResolution: membership({
          observedAt: '2026-07-22T08:00:01.000Z',
          freshUntil: '2026-07-22T08:01:01.000Z',
        }),
      },
      'institution_anchor_unavailable',
    ],
  ] as const)('treats equality at %s as expired', async (_name, options, code) => {
    await expect(
      ownerHarness(options).guard.authorizeCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code });
  });

  it.each([
    [
      'membership TTL over sixty seconds',
      { membershipResolution: membership({ freshUntil: '2026-07-22T08:01:00.001Z' }) },
      'membership_invalid',
    ],
    [
      'anchor TTL over sixty seconds',
      { anchorResolution: anchor({ freshUntil: '2026-07-22T08:01:00.001Z' }) },
      'institution_anchor_unavailable',
    ],
    [
      'future provenance observation',
      {
        provenanceResolution: verified(
          provenance({
            issuedAt: '2026-07-22T08:00:31.000Z',
            verifiedAt: '2026-07-22T08:00:31.000Z',
          }),
        ),
      },
      'invalid_context_shape',
    ],
    [
      'future membership observation',
      { membershipResolution: membership({ observedAt: '2026-07-22T08:00:31.000Z' }) },
      'membership_invalid',
    ],
    [
      'future anchor observation',
      { anchorResolution: anchor({ observedAt: '2026-07-22T08:00:31.000Z' }) },
      'institution_anchor_unavailable',
    ],
  ] as const)('fails closed for %s', async (_name, options, code) => {
    await expect(
      ownerHarness(options).guard.authorizeCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code });
  });

  it('uses the owner-capped five-minute provenance deadline', async () => {
    await expect(
      ownerHarness({
        provenanceResolution: verified(
          provenance({ validUntil: '2026-07-22T08:04:00.001Z' }),
        ),
      }).guard.authorizeCurrentRequest(),
    ).resolves.toMatchObject({
      kind: 'institution_scope_allow',
      provenanceValidUntil: '2026-07-22T08:04:00.000Z',
    });
  });

  it.each([
    [
      'provenance and membership tenant',
      { membershipResolution: membership({ tenantId: 'tenant-b' }) },
      'membership_invalid',
    ],
    [
      'provenance and membership user',
      {
        membershipResolution: membership({
          userReference: reference('usr', 'Q'.repeat(43)),
        }),
        controlledReferenceCodecStage: 'membership',
      },
      'membership_invalid',
    ],
    [
      'provenance and anchor institution',
      { anchorResolution: anchor({ institutionId: 'institution-b' }) },
      'institution_anchor_unavailable',
    ],
  ] as const)('rejects %s mismatch', async (_name, options, code) => {
    await expect(
      ownerHarness(options).guard.authorizeCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code });
  });

  it.each([
    [
      'controlled provenance codec before a noncanonical request reference',
      {
        provenanceResolution: verified(
          provenance({
            requestReference: reference('req', `${'A'.repeat(42)}B`),
          }),
        ),
        controlledReferenceCodecStage: 'provenance',
      },
      'provenance_unavailable',
    ],
    [
      'noncanonical membership revision',
      {
        membershipResolution: membership({
          membershipRevision: reference('mrv', `${'A'.repeat(42)}B`),
        }),
        controlledReferenceCodecStage: 'membership',
      },
      'membership_invalid',
    ],
    [
      'noncanonical anchor revision',
      {
        anchorResolution: anchor({
          anchorRevision: reference('arv', `${'A'.repeat(42)}B`),
        }),
        controlledReferenceCodecStage: 'anchor',
      },
      'institution_anchor_unavailable',
    ],
  ] as const)(
    'rejects %s',
    async (_name, options, code) => {
      await expect(
        ownerHarness(options).guard.authorizeCurrentRequest(),
      ).resolves.toEqual({ kind: 'rejected', code });
    },
  );

  it.each([
    [
      'controlled provenance codec before a wrong-prefix request reference',
      {
        provenanceResolution: verified(
          provenance({ requestReference: reference('prf') }),
        ),
        controlledReferenceCodecStage: 'provenance',
      },
      'provenance_unavailable',
    ],
    [
      'unknown membership key version',
      {
        membershipResolution: membership({
          bindingRevision: reference('brv', TOKEN, 2),
        }),
        controlledReferenceCodecStage: 'membership',
      },
      'membership_invalid',
    ],
    [
      'short anchor tag',
      {
        anchorResolution: anchor({
          anchorRevision: reference('arv', 'A'.repeat(22)),
        }),
        controlledReferenceCodecStage: 'anchor',
      },
      'institution_anchor_unavailable',
    ],
  ] as const)('rejects %s', async (_name, options, code) => {
    await expect(
      ownerHarness(options).guard.authorizeCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code });
  });

  it('uses one trusted clock snapshot per authorization', async () => {
    const now = vi.fn(() => NOW);
    await expect(
      ownerHarness({ now }).guard.authorizeCurrentRequest(),
    ).resolves.toMatchObject({ kind: 'institution_scope_allow' });
    expect(now).toHaveBeenCalledTimes(1);
  });

  it.each([
    () => {
      throw new Error('sensitive clock failure');
    },
    () => new Date(Number.NaN),
    () => new Proxy(NOW, {}),
  ])('maps a broken trusted clock without calling downstream owners', async (now) => {
    const harness = ownerHarness({ now });
    const result = await harness.guard.authorizeCurrentRequest();
    expect(result).toEqual({ kind: 'rejected', code: 'provenance_unavailable' });
    expect(harness.resolveMembership).not.toHaveBeenCalled();
    expect(harness.resolveAnchor).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('sensitive');
  });

  it('snapshots exact factory dependencies and ignores later caller mutation', async () => {
    const harness = ownerHarness();
    const guard = createInstitutionScopeGuardV1(harness.factoryInput);
    Object.assign(harness.factoryInput, {
      provenanceResolver: Object.freeze({
        resolveCurrentRequest: () => {
          throw new Error('mutated');
        },
      }),
      now: () => {
        throw new Error('mutated');
      },
    });

    await expect(guard.authorizeCurrentRequest()).resolves.toMatchObject({
      kind: 'institution_scope_allow',
    });
    expect(harness.resolveCurrentRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects non-exact factory objects without accessors, Proxy traps, or method apply', async () => {
    const base = ownerHarness().factoryInput;
    let getterReads = 0;
    let ownKeyTraps = 0;
    let methodApplyTraps = 0;
    const accessor = {
      provenanceResolver: base.provenanceResolver,
      membershipProvider: base.membershipProvider,
      anchorProvider: base.anchorProvider,
    };
    Object.defineProperty(accessor, 'now', {
      enumerable: true,
      get() {
        getterReads += 1;
        return () => NOW;
      },
    });
    const proxy = new Proxy(base, {
      ownKeys() {
        ownKeyTraps += 1;
        throw new Error('factory trap');
      },
    });
    const methodProxy = new Proxy(() => Promise.resolve(verified()), {
      apply() {
        methodApplyTraps += 1;
        throw new Error('method trap');
      },
    });

    for (const value of [
      accessor,
      proxy,
      { ...base, extra: true },
      Object.assign(Object.create({ inherited: true }), base),
      Object.assign(Object.create(null), base),
      Object.assign({ ...base }, { [Symbol('factory')]: true }),
      {
        ...base,
        provenanceResolver: Object.freeze({
          resolveCurrentRequest: methodProxy,
        }),
      },
    ]) {
      const result = await createInstitutionScopeGuardV1(
        value as never,
      ).authorizeCurrentRequest();
      expect(result).toEqual({
        kind: 'rejected',
        code: 'provenance_unavailable',
      });
    }
    expect(getterReads).toBe(0);
    expect(ownKeyTraps).toBe(0);
    expect(methodApplyTraps).toBe(0);
  });

  it('rejects accessor and Proxy dependency objects without reading or applying them', async () => {
    const base = ownerHarness().factoryInput;
    let getterReads = 0;
    let ownKeyTraps = 0;
    const accessorResolver = {};
    Object.defineProperty(accessorResolver, 'resolveCurrentRequest', {
      enumerable: true,
      get() {
        getterReads += 1;
        return () => Promise.resolve(verified());
      },
    });
    const proxyMembership = new Proxy(
      { resolve: () => Promise.resolve(membership()) },
      {
        ownKeys() {
          ownKeyTraps += 1;
          throw new Error('provider trap');
        },
      },
    );

    await expect(
      createInstitutionScopeGuardV1({
        ...base,
        provenanceResolver: accessorResolver as never,
      }).authorizeCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'provenance_unavailable' });
    await expect(
      createInstitutionScopeGuardV1({
        ...base,
        membershipProvider: proxyMembership as never,
      }).authorizeCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_unavailable' });
    expect(getterReads).toBe(0);
    expect(ownKeyTraps).toBe(0);
  });

  it('rejects hostile owner output shapes without accessor or Proxy enumeration', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const harness = ownerHarness();
    const accessorOwnerInput = {
      accountId: 'account-a',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      requestIdentifier: 'request-a',
      proofIdentifier: 'proof-a',
      issuedAt: '2026-07-22T07:59:00.000Z',
      proofValidUntil: '2026-07-22T08:04:00.000Z',
    };
    Object.defineProperty(accessorOwnerInput, 'source', {
      enumerable: true,
      get() {
        getterReads += 1;
        return 'server_session';
      },
    });
    const provenanceResolver = createFormalRequestProvenanceResolverV1({
      ownerInput:
        accessorOwnerInput as unknown as FormalRequestProvenanceOwnerInputV1,
      referenceCodec: controlledCodec(),
      now: () => NOW,
    });
    const provenanceGuard = createInstitutionScopeGuardV1({
      ...harness.factoryInput,
      provenanceResolver,
    });

    await expect(
      provenanceGuard.authorizeCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'provenance_invalid' });

    const hostileFact = new Proxy(
      Object.freeze({
        kind: 'current_membership_fact',
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
        role: 'tenant_admin',
        membershipId: 'membership-a',
        membershipRevisionAt: '2026-07-22T07:58:00.000Z',
        bindingId: 'binding-a',
        bindingRevision: 7,
        bindingRevisionAt: '2026-07-01T00:00:00.000Z',
        bindingExpiresAt: null,
        observedAt: '2026-07-22T08:00:00.000Z',
      }),
      {
        ownKeys() {
          proxyTraps += 1;
          throw new Error('membership ownKeys trap');
        },
      },
    );
    const membershipProvider =
      createRequestBoundFreshActiveMembershipProviderV1({
        accountId: 'account-a',
        factReader: Object.freeze({
          resolve: vi.fn(async () => hostileFact),
        }) as AuthoritativeInstitutionMembershipFactReaderV1,
        referenceCodec: controlledCodec(),
        now: () => NOW,
      });
    const membershipHarness = ownerHarness();
    const membershipGuard = createInstitutionScopeGuardV1({
      ...membershipHarness.factoryInput,
      membershipProvider,
    });
    await expect(
      membershipGuard.authorizeCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_invalid' });
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('returns only the frozen low-sensitive allow projection', async () => {
    const result = await ownerHarness().guard.authorizeCurrentRequest();
    expect(result.kind).toBe('institution_scope_allow');
    if (result.kind !== 'institution_scope_allow') return;

    expect(Object.keys(result)).toEqual([
      'kind',
      'requestReference',
      'userReference',
      'role',
      'source',
      'tenantId',
      'institutionId',
      'membershipRevision',
      'bindingRevision',
      'anchorRevision',
      'provenanceValidUntil',
      'membershipFreshUntil',
      'anchorFreshUntil',
      'decidedAt',
      'validUntil',
    ]);
    for (const forbidden of [
      'proofReference',
      'membershipReference',
      'bindingReference',
      'anchorReference',
      'accountId',
      'membershipId',
      'bindingId',
      'capability',
      'section',
      'object',
    ]) {
      expect(result).not.toHaveProperty(forbidden);
    }
  });

  it('exports no raw evaluator, evidence input, parser, promotion, cache, or transport', async () => {
    const moduleExports = await import(
      '@/modules/security/server/institution-scope-guard'
    );
    for (const forbidden of [
      'evaluate',
      'InstitutionScopeGuardInputV1',
      'parseInstitutionScopeAllowV1',
      'promoteInstitutionScopeAllowV1',
      'rehydrateInstitutionScopeAllowV1',
      'registerInstitutionScopeAllowV1',
      'cacheInstitutionScopeAllowV1',
    ]) {
      expect(moduleExports).not.toHaveProperty(forbidden);
    }

    const source = await readFile(
      resolve(
        process.cwd(),
        'src/modules/security/server/institution-scope-guard.ts',
      ),
      'utf8',
    );
    for (const forbidden of [
      'process.env',
      'fetch(',
      "from 'react'",
      '@/server/db',
      'institution-capability',
      'NextRequest',
      'NextResponse',
      'cookies(',
      'headers(',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('keeps the low-sensitive owner failure vocabulary closed and stable', () => {
    expect(INSTITUTION_SCOPE_GUARD_FAILURE_CODES_V1).toEqual([
      'invalid_context_shape',
      'provenance_missing',
      'provenance_invalid',
      'provenance_source_denied',
      'provenance_expired',
      'provenance_unavailable',
      'membership_denied',
      'membership_invalid',
      'membership_unavailable',
      'membership_stale',
      'institution_anchor_denied',
      'institution_anchor_unavailable',
    ]);
  });
});
