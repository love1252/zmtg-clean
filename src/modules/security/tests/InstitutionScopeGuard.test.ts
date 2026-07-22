import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type {
  ActiveInstitutionAnchorEvidenceV1,
  ActiveInstitutionAnchorProviderV1,
  FormalProvenanceResolverV1,
  FormalRequestProvenanceEvidenceV1,
  FreshActiveMembershipEvidenceV1,
  FreshActiveMembershipProviderV1,
} from '@/modules/security/server/institution-guard-evidence';
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

type Unbranded<T> = {
  [Key in keyof T as Key extends symbol ? never : Key]: T[Key];
};

function reference(prefix: string, token = TOKEN, keyVersion = 1) {
  return `${prefix}_v1_k${keyVersion}_${token}`;
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
}>;

function ownerHarness(options: HarnessOptions = {}) {
  const resolveCurrentRequest = vi.fn(async () => {
    if (options.provenanceError !== undefined) {
      throw options.provenanceError;
    }
    return options.provenanceResolution ?? verified();
  });
  const resolveMembership = vi.fn(async () => {
    if (options.membershipError !== undefined) throw options.membershipError;
    return options.membershipResolution ?? membership();
  });
  const resolveAnchor = vi.fn(async () => {
    if (options.anchorError !== undefined) throw options.anchorError;
    return options.anchorResolution ?? anchor();
  });
  const factoryInput = {
    provenanceResolver: Object.freeze({
      resolveCurrentRequest,
    }) as unknown as FormalProvenanceResolverV1,
    membershipProvider: Object.freeze({
      resolve: resolveMembership,
    }) as unknown as FreshActiveMembershipProviderV1,
    anchorProvider: Object.freeze({
      resolve: resolveAnchor,
    }) as unknown as ActiveInstitutionAnchorProviderV1,
    now: options.now ?? (() => NOW),
  };
  return {
    factoryInput,
    resolveCurrentRequest,
    resolveMembership,
    resolveAnchor,
    guard: createInstitutionScopeGuardV1(factoryInput),
  };
}

describe('BASE-02B institution scope guard composition', () => {
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
          requestReference: reference('req'),
          userReference: reference('usr'),
          role,
          source,
          tenantId: 'tenant-a',
          institutionId: 'institution-a',
          membershipRevision: reference('mrv'),
          bindingRevision: reference('brv'),
          anchorRevision: reference('arv'),
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
    const evidence = provenance({
      tenantId: 'tenant-owner',
      institutionId: 'institution-owner',
    });
    const resolveCurrentRequest = vi.fn(async () => {
      calls.push('provenance');
      return verified(evidence);
    });
    const resolveMembership = vi.fn(async (input: unknown) => {
      calls.push('membership');
      expect(input).toEqual({
        provenance: evidence,
        requestedScope: {
          tenantId: 'tenant-owner',
          institutionId: 'institution-owner',
        },
      });
      expect(Object.isFrozen(input)).toBe(true);
      expect(Object.isFrozen((input as { requestedScope: object }).requestedScope)).toBe(
        true,
      );
      return membership({
        tenantId: 'tenant-owner',
        institutionId: 'institution-owner',
      });
    });
    const resolveAnchor = vi.fn(async (input: unknown) => {
      calls.push('anchor');
      expect(input).toEqual({
        tenantId: 'tenant-owner',
        institutionId: 'institution-owner',
      });
      expect(Object.isFrozen(input)).toBe(true);
      return anchor({
        tenantId: 'tenant-owner',
        institutionId: 'institution-owner',
      });
    });
    const guard = createInstitutionScopeGuardV1({
      provenanceResolver: Object.freeze({
        resolveCurrentRequest,
      }) as unknown as FormalProvenanceResolverV1,
      membershipProvider: Object.freeze({
        resolve: resolveMembership,
      }) as unknown as FreshActiveMembershipProviderV1,
      anchorProvider: Object.freeze({
        resolve: resolveAnchor,
      }) as unknown as ActiveInstitutionAnchorProviderV1,
      now: () => NOW,
    });

    await expect(guard.authorizeCurrentRequest()).resolves.toMatchObject({
      kind: 'institution_scope_allow',
      tenantId: 'tenant-owner',
      institutionId: 'institution-owner',
    });
    expect(calls).toEqual(['provenance', 'membership', 'anchor']);
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
    const resolveCurrentRequest = vi
      .fn()
      .mockResolvedValueOnce(verified())
      .mockResolvedValueOnce(
        Object.freeze({
          kind: 'rejected',
          code: 'provenance_source_denied',
        }),
      );
    const harness = ownerHarness();
    const guard = createInstitutionScopeGuardV1({
      ...harness.factoryInput,
      provenanceResolver: Object.freeze({
        resolveCurrentRequest,
      }) as unknown as FormalProvenanceResolverV1,
    });

    await expect(guard.authorizeCurrentRequest()).resolves.toMatchObject({
      kind: 'institution_scope_allow',
    });
    await expect(guard.authorizeCurrentRequest()).resolves.toEqual({
      kind: 'rejected',
      code: 'provenance_source_denied',
    });
    expect(resolveCurrentRequest).toHaveBeenCalledTimes(2);
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
      'provenance TTL over five minutes',
      { provenanceResolution: verified(provenance({ validUntil: '2026-07-22T08:04:00.001Z' })) },
      'invalid_context_shape',
    ],
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

  it.each([
    [
      'provenance and membership tenant',
      { membershipResolution: membership({ tenantId: 'tenant-b' }) },
      'membership_invalid',
    ],
    [
      'provenance and membership user',
      { membershipResolution: membership({ userReference: reference('usr', 'Q'.repeat(43)) }) },
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
      'provenance request reference',
      { provenanceResolution: verified(provenance({ requestReference: reference('req', `${'A'.repeat(42)}B`) })) },
      'invalid_context_shape',
    ],
    [
      'membership revision',
      { membershipResolution: membership({ membershipRevision: reference('mrv', `${'A'.repeat(42)}B`) }) },
      'membership_invalid',
    ],
    [
      'anchor revision',
      { anchorResolution: anchor({ anchorRevision: reference('arv', `${'A'.repeat(42)}B`) }) },
      'institution_anchor_unavailable',
    ],
  ] as const)(
    'rejects noncanonical full43 encoding for %s',
    async (_name, options, code) => {
      await expect(
        ownerHarness(options).guard.authorizeCurrentRequest(),
      ).resolves.toEqual({ kind: 'rejected', code });
    },
  );

  it.each([
    [
      'wrong prefix',
      { provenanceResolution: verified(provenance({ requestReference: reference('prf') })) },
      'invalid_context_shape',
    ],
    [
      'unknown key version',
      { membershipResolution: membership({ bindingRevision: reference('brv', TOKEN, 2) }) },
      'membership_invalid',
    ],
    [
      'short tag',
      { anchorResolution: anchor({ anchorRevision: reference('arv', 'A'.repeat(22)) }) },
      'institution_anchor_unavailable',
    ],
  ] as const)('rejects %s reference shape', async (_name, options, code) => {
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
    const accessorEvidence = {};
    Object.defineProperty(accessorEvidence, 'source', {
      enumerable: true,
      get() {
        getterReads += 1;
        return 'server_session';
      },
    });
    const proxyMembership = new Proxy(membership(), {
      ownKeys() {
        proxyTraps += 1;
        throw new Error('membership trap');
      },
    });

    await expect(
      ownerHarness({
        provenanceResolution: verified(accessorEvidence),
      }).guard.authorizeCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'invalid_context_shape' });
    await expect(
      ownerHarness({
        membershipResolution: proxyMembership,
      }).guard.authorizeCurrentRequest(),
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
