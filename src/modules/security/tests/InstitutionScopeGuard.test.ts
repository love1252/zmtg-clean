import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type {
  ActiveInstitutionAnchorEvidenceV1,
  FormalRequestProvenanceEvidenceV1,
  FreshActiveMembershipEvidenceV1,
} from '@/modules/security/server/institution-guard-evidence';
import {
  createInstitutionScopeGuardV1,
  INSTITUTION_SCOPE_GUARD_FAILURE_CODES_V1,
  type InstitutionScopeAllowV1,
  type InstitutionScopeGuardV1,
} from '@/modules/security/server/institution-scope-guard';

const NOW = new Date('2026-07-22T08:00:30.000Z');
const TOKEN = 'A'.repeat(43);

type Unbranded<T> = {
  [Key in keyof T as Key extends symbol ? never : Key]: T[Key];
};

function reference(prefix: string, token = TOKEN) {
  return `${prefix}_v1_k1_${token}`;
}

function provenance(
  overrides: Record<string, unknown> = {},
): FormalRequestProvenanceEvidenceV1 {
  return {
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
  } as unknown as FormalRequestProvenanceEvidenceV1;
}

function membership(
  overrides: Record<string, unknown> = {},
): FreshActiveMembershipEvidenceV1 {
  return {
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
  } as unknown as FreshActiveMembershipEvidenceV1;
}

function anchor(
  overrides: Record<string, unknown> = {},
): ActiveInstitutionAnchorEvidenceV1 {
  return {
    kind: 'active',
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    anchorReference: reference('anc'),
    anchorRevision: reference('arv'),
    observedAt: '2026-07-22T08:00:00.000Z',
    freshUntil: '2026-07-22T08:01:00.000Z',
    ...overrides,
  } as unknown as ActiveInstitutionAnchorEvidenceV1;
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    provenance: provenance(),
    membership: membership(),
    anchor: anchor(),
    ...overrides,
  };
}

function guard(now: () => Date = () => NOW) {
  return createInstitutionScopeGuardV1({ now });
}

describe('BASE-02B institution scope guard', () => {
  it.each(['server_session', 'trusted_gateway'] as const)(
    'allows all four institution roles for formal %s evidence only',
    (source) => {
      for (const role of [
        'tenant_admin',
        'tenant_operator',
        'consultant',
        'customer_service',
      ] as const) {
        const result = guard().evaluate(
          input({
            provenance: provenance({ source }),
            membership: membership({ role }),
          }),
        );

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
      }
    },
  );

  it('keeps the guard and positive allow nominally sealed', () => {
    expectTypeOf<Unbranded<InstitutionScopeGuardV1>>().not.toMatchTypeOf<
      InstitutionScopeGuardV1
    >();
    expectTypeOf<Unbranded<InstitutionScopeAllowV1>>().not.toMatchTypeOf<
      InstitutionScopeAllowV1
    >();
  });

  it.each([
    [
      'provenance',
      provenance({ validUntil: '2026-07-22T08:00:40.000Z' }),
      membership(),
      anchor(),
      '2026-07-22T08:00:40.000Z',
    ],
    [
      'membership',
      provenance(),
      membership({ freshUntil: '2026-07-22T08:00:41.000Z' }),
      anchor(),
      '2026-07-22T08:00:41.000Z',
    ],
    [
      'anchor',
      provenance(),
      membership(),
      anchor({ freshUntil: '2026-07-22T08:00:42.000Z' }),
      '2026-07-22T08:00:42.000Z',
    ],
  ] as const)(
    'uses the %s boundary when it is the earliest validity deadline',
    (_name, provenanceValue, membershipValue, anchorValue, validUntil) => {
      const result = guard().evaluate({
        provenance: provenanceValue,
        membership: membershipValue,
        anchor: anchorValue,
      });
      expect(result.kind).toBe('institution_scope_allow');
      if (result.kind === 'institution_scope_allow') {
        expect(result.validUntil).toBe(validUntil);
      }
    },
  );

  it('uses the same exact minimum when all three deadlines are equal', () => {
    const deadline = '2026-07-22T08:00:45.000Z';
    const result = guard().evaluate({
      provenance: provenance({ validUntil: deadline }),
      membership: membership({ freshUntil: deadline }),
      anchor: anchor({ freshUntil: deadline }),
    });

    expect(result.kind).toBe('institution_scope_allow');
    if (result.kind === 'institution_scope_allow') {
      expect(result.validUntil).toBe(deadline);
    }
  });

  it.each([
    ['tenant', provenance({ tenantId: 'tenant-b' }), membership(), anchor()],
    [
      'institution',
      provenance({ institutionId: 'institution-b' }),
      membership(),
      anchor(),
    ],
    [
      'user',
      provenance(),
      membership({ userReference: reference('usr', 'B'.repeat(43)) }),
      anchor(),
    ],
  ] as const)(
    'rejects provenance and membership %s mismatch without an allow',
    (_name, provenanceValue, membershipValue, anchorValue) => {
      expect(
        guard().evaluate({
          provenance: provenanceValue,
          membership: membershipValue,
          anchor: anchorValue,
        }),
      ).toEqual({ kind: 'rejected', code: 'membership_invalid' });
    },
  );

  it.each([
    ['tenant', anchor({ tenantId: 'tenant-b' })],
    ['institution', anchor({ institutionId: 'institution-b' })],
  ] as const)(
    'rejects provenance and anchor %s mismatch without an allow',
    (_name, anchorValue) => {
      expect(
        guard().evaluate({
          provenance: provenance(),
          membership: membership(),
          anchor: anchorValue,
        }),
      ).toEqual({
        kind: 'rejected',
        code: 'institution_anchor_unavailable',
      });
    },
  );

  it.each(['demo_session', 'browser_payload', '', ' SERVER_SESSION '] as const)(
    'rejects nonformal provenance source %s before consulting the clock',
    (source) => {
      const now = vi.fn(() => NOW);
      expect(
        guard(now).evaluate(
          input({ provenance: provenance({ source }) }),
        ),
      ).toEqual({ kind: 'rejected', code: 'provenance_source_denied' });
      expect(now).not.toHaveBeenCalled();
    },
  );

  it.each(['platform_admin', 'owner', '', 'TENANT_ADMIN'] as const)(
    'rejects unknown membership role %s as invalid evidence',
    (role) => {
      expect(
        guard().evaluate(input({ membership: membership({ role }) })),
      ).toEqual({ kind: 'rejected', code: 'membership_invalid' });
    },
  );

  it.each([
    [
      'provenance',
      '2026-07-22T08:00:30.000Z',
      provenance({ validUntil: '2026-07-22T08:00:30.000Z' }),
      membership(),
      anchor(),
      'provenance_expired',
    ],
    [
      'membership',
      '2026-07-22T08:01:00.000Z',
      provenance(),
      membership(),
      anchor(),
      'membership_stale',
    ],
    [
      'anchor',
      '2026-07-22T08:01:00.000Z',
      provenance(),
      membership({
        observedAt: '2026-07-22T08:00:01.000Z',
        freshUntil: '2026-07-22T08:01:01.000Z',
      }),
      anchor(),
      'institution_anchor_unavailable',
    ],
  ] as const)(
    'treats equality at the %s deadline as expired',
    (_name, nowValue, provenanceValue, membershipValue, anchorValue, code) => {
      expect(
        guard(() => new Date(nowValue)).evaluate({
          provenance: provenanceValue,
          membership: membershipValue,
          anchor: anchorValue,
        }),
      ).toEqual({ kind: 'rejected', code });
    },
  );

  it.each([
    [
      'future provenance issue',
      input({
        provenance: provenance({
          issuedAt: '2026-07-22T08:00:31.000Z',
          verifiedAt: '2026-07-22T08:00:31.000Z',
        }),
      }),
      'invalid_context_shape',
    ],
    [
      'future membership observation',
      input({
        membership: membership({ observedAt: '2026-07-22T08:00:31.000Z' }),
      }),
      'membership_invalid',
    ],
    [
      'future anchor observation',
      input({ anchor: anchor({ observedAt: '2026-07-22T08:00:31.000Z' }) }),
      'institution_anchor_unavailable',
    ],
    [
      'provenance TTL over five minutes',
      input({
        provenance: provenance({
          issuedAt: '2026-07-22T07:59:00.000Z',
          verifiedAt: '2026-07-22T07:59:01.000Z',
          validUntil: '2026-07-22T08:04:00.001Z',
        }),
      }),
      'invalid_context_shape',
    ],
    [
      'membership TTL over sixty seconds',
      input({
        membership: membership({ freshUntil: '2026-07-22T08:01:00.001Z' }),
      }),
      'membership_invalid',
    ],
    [
      'anchor TTL over sixty seconds',
      input({ anchor: anchor({ freshUntil: '2026-07-22T08:01:00.001Z' }) }),
      'institution_anchor_unavailable',
    ],
  ] as const)('fails closed for %s', (_name, value, code) => {
    expect(guard().evaluate(value as never)).toEqual({ kind: 'rejected', code });
  });

  it('preserves provenance then membership then anchor failure precedence without reading downstream evidence', () => {
    let downstreamGetterReads = 0;
    let downstreamProxyTraps = 0;
    const hostileMembership = membership();
    Object.defineProperty(hostileMembership, 'role', {
      enumerable: true,
      get() {
        downstreamGetterReads += 1;
        return 'tenant_admin';
      },
    });
    const hostileAnchor = new Proxy(anchor(), {
      ownKeys() {
        downstreamProxyTraps += 1;
        throw new Error('downstream anchor trap');
      },
    });

    expect(
      guard(() => new Date('2026-07-22T08:04:00.000Z')).evaluate({
        provenance: provenance(),
        membership: hostileMembership,
        anchor: hostileAnchor,
      }),
    ).toEqual({ kind: 'rejected', code: 'provenance_expired' });
    expect(downstreamGetterReads).toBe(0);
    expect(downstreamProxyTraps).toBe(0);

    expect(
      guard(() => new Date('2026-07-22T08:01:00.000Z')).evaluate({
        provenance: provenance(),
        membership: membership(),
        anchor: hostileAnchor,
      }),
    ).toEqual({ kind: 'rejected', code: 'membership_stale' });
    expect(downstreamProxyTraps).toBe(0);

    expect(
      guard().evaluate({
        provenance: provenance(),
        membership: membership({ tenantId: 'tenant-b' }),
        anchor: hostileAnchor,
      }),
    ).toEqual({ kind: 'rejected', code: 'membership_invalid' });
    expect(downstreamProxyTraps).toBe(0);
  });

  it('does not inspect membership or anchor when the trusted clock is unavailable', () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const hostileMembership = membership();
    Object.defineProperty(hostileMembership, 'role', {
      enumerable: true,
      get() {
        getterReads += 1;
        return 'tenant_admin';
      },
    });
    const hostileAnchor = new Proxy(anchor(), {
      ownKeys() {
        proxyTraps += 1;
        throw new Error('anchor trap');
      },
    });

    expect(
      guard(() => {
        throw new Error('clock unavailable');
      }).evaluate({
        provenance: provenance(),
        membership: hostileMembership,
        anchor: hostileAnchor,
      }),
    ).toEqual({ kind: 'rejected', code: 'provenance_unavailable' });
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it.each([
    ['provenance usr prefix', input({ provenance: provenance({ userReference: reference('mbr') }) }), 'invalid_context_shape'],
    ['membership mrv prefix', input({ membership: membership({ membershipRevision: reference('brv') }) }), 'membership_invalid'],
    ['anchor arv prefix', input({ anchor: anchor({ anchorRevision: reference('mrv') }) }), 'institution_anchor_unavailable'],
    ['short opaque', input({ provenance: provenance({ requestReference: `req_v1_k1_${'A'.repeat(22)}` }) }), 'invalid_context_shape'],
    ['unknown key', input({ membership: membership({ bindingRevision: `brv_v1_k2_${TOKEN}` }) }), 'membership_invalid'],
  ] as const)('rejects unsafe reference shape for %s', (_name, value, code) => {
    expect(guard().evaluate(value as never)).toEqual({ kind: 'rejected', code });
  });

  it('uses one trusted clock snapshot per successful decision', () => {
    const now = vi.fn(() => NOW);
    expect(guard(now).evaluate(input()).kind).toBe('institution_scope_allow');
    expect(now).toHaveBeenCalledTimes(1);
  });

  it.each([
    () => {
      throw new Error('sensitive clock failure');
    },
    () => new Date(Number.NaN),
    () => new Proxy(NOW, {}),
  ])('maps a broken trusted clock to low-sensitive unavailability', (now) => {
    const result = guard(now).evaluate(input());
    expect(result).toEqual({
      kind: 'rejected',
      code: 'provenance_unavailable',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('tenant-a');
    expect(JSON.stringify(result)).not.toContain(reference('usr'));
  });

  it('does not read accessor or Proxy factory input', () => {
    let getterReads = 0;
    let clockApplyTraps = 0;
    const accessor = {};
    Object.defineProperty(accessor, 'now', {
      enumerable: true,
      get() {
        getterReads += 1;
        return () => NOW;
      },
    });
    const proxyTraps = vi.fn();
    const hostile = new Proxy(
      { now: () => NOW },
      {
        ownKeys() {
          proxyTraps();
          throw new Error('hostile factory');
        },
      },
    );
    const hostileClock = new Proxy(() => NOW, {
      apply() {
        clockApplyTraps += 1;
        throw new Error('hostile clock apply');
      },
    });

    for (const factoryInput of [
      accessor,
      hostile,
      { now: () => NOW, fallbackNow: () => NOW },
      { now: hostileClock },
    ]) {
      const result = createInstitutionScopeGuardV1(
        factoryInput as never,
      ).evaluate(input());
      expect(result).toEqual({
        kind: 'rejected',
        code: 'provenance_unavailable',
      });
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).not.toHaveBeenCalled();
    expect(clockApplyTraps).toBe(0);
  });

  it('rejects extra, inherited, null-prototype, accessor, symbol and Proxy input without reads', () => {
    let getterReads = 0;
    const accessor = input();
    Object.defineProperty(accessor, 'membership', {
      enumerable: true,
      get() {
        getterReads += 1;
        return membership();
      },
    });
    const proxyTraps = vi.fn();
    const hostile = new Proxy(input(), {
      ownKeys() {
        proxyTraps();
        throw new Error('hostile input');
      },
    });

    for (const value of [
      { ...input(), targetInstitutionId: 'institution-b' },
      Object.assign(Object.create({ inherited: true }), input()),
      Object.assign(Object.create(null), input()),
      Object.assign(input(), { [Symbol('scope')]: 'institution-b' }),
      accessor,
      new Proxy(input(), {}),
      hostile,
      [],
    ]) {
      expect(guard().evaluate(value as never)).toEqual({
        kind: 'rejected',
        code: 'invalid_context_shape',
      });
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).not.toHaveBeenCalled();
  });

  it('rejects hostile nested evidence without getter or Proxy trap reads', () => {
    let getterReads = 0;
    const accessorMembership = membership();
    Object.defineProperty(accessorMembership, 'role', {
      enumerable: true,
      get() {
        getterReads += 1;
        return 'tenant_admin';
      },
    });
    const proxyTraps = vi.fn();
    const proxyAnchor = new Proxy(anchor(), {
      getOwnPropertyDescriptor() {
        proxyTraps();
        throw new Error('hostile anchor');
      },
    });

    expect(
      guard().evaluate(input({ membership: accessorMembership })),
    ).toEqual({ kind: 'rejected', code: 'membership_invalid' });
    expect(guard().evaluate(input({ anchor: proxyAnchor }))).toEqual({
      kind: 'rejected',
      code: 'institution_anchor_unavailable',
    });
    expect(getterReads).toBe(0);
    expect(proxyTraps).not.toHaveBeenCalled();
  });

  it('returns only the frozen minimum scope allow and excludes owner facts', () => {
    const result = guard().evaluate(input());
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
      'revision',
      'capability',
      'section',
      'object',
    ]) {
      expect(result).not.toHaveProperty(forbidden);
    }
  });

  it('exposes no allow parser, promotion, cache or transport surface', async () => {
    const moduleExports = await import(
      '@/modules/security/server/institution-scope-guard'
    );
    for (const forbidden of [
      'parseInstitutionScopeAllowV1',
      'promoteInstitutionScopeAllowV1',
      'rehydrateInstitutionScopeAllowV1',
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
      'from \'react\'',
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

  it('keeps the low-sensitive failure vocabulary closed and stable', () => {
    expect(INSTITUTION_SCOPE_GUARD_FAILURE_CODES_V1).toEqual([
      'invalid_context_shape',
      'provenance_source_denied',
      'provenance_expired',
      'provenance_unavailable',
      'membership_invalid',
      'membership_stale',
      'institution_anchor_unavailable',
    ]);
  });
});
