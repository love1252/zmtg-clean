import { createHmac } from 'node:crypto';

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

const readerProvenance = vi.hoisted(() => ({
  identity: new WeakSet<object>(),
  membership: new WeakSet<object>(),
  scope: new WeakSet<object>(),
}));

vi.mock(
  '@/modules/auth/application/authoritative-formal-session-identity-reader',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/modules/auth/application/authoritative-formal-session-identity-reader')
    >();
    return {
      ...actual,
      isAuthoritativeFormalSessionIdentityFactReaderV1(value: unknown) {
        return value !== null && typeof value === 'object' && readerProvenance.identity.has(value);
      },
    };
  },
);

vi.mock(
  '@/modules/access-control/application/authoritative-membership-reader',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/modules/access-control/application/authoritative-membership-reader')
    >();
    return {
      ...actual,
      isAuthoritativeMembershipFactReaderV1(value: unknown) {
        return value !== null && typeof value === 'object' && readerProvenance.membership.has(value);
      },
    };
  },
);

vi.mock(
  '@/modules/tenancy/application/authoritative-institution-scope-reader',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/modules/tenancy/application/authoritative-institution-scope-reader')
    >();
    return {
      ...actual,
      isAuthoritativeInstitutionScopeFactReaderV1(value: unknown) {
        return value !== null && typeof value === 'object' && readerProvenance.scope.has(value);
      },
    };
  },
);

import {
  createAuthoritativeInstitutionMembershipFactReaderV1 as createUnbrandedMembershipFactReaderV1,
  type CurrentInstitutionMembershipFactRow,
} from '@/modules/access-control/server/authoritative-membership-reader';
import {
  createFormalServerSessionRequestOwnerV1,
  FORMAL_SERVER_SESSION_COOKIE_V1,
  type FormalServerSessionKeyRingV1,
  type FormalServerSessionRequestOwnerV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import type { AuthoritativeFormalSessionIdentityFactReaderV1 } from '@/modules/auth/ports/authoritative-formal-session-identity-reader';
import type { InstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import {
  createActiveInstitutionAnchorProviderV1,
} from '@/modules/security/server/institution-anchor-provider';
import {
  createAuthoritativeInstitutionScopeFactReaderV1 as createUnbrandedScopeFactReaderV1,
  type CurrentInstitutionScopeFactRowV1,
} from '@/modules/tenancy/server/authoritative-institution-scope-reader';

function createAuthoritativeInstitutionMembershipFactReaderV1(
  input: Parameters<typeof createUnbrandedMembershipFactReaderV1>[0],
) {
  const reader = createUnbrandedMembershipFactReaderV1(input);
  readerProvenance.membership.add(reader);
  return reader;
}

function createAuthoritativeInstitutionScopeFactReaderV1(
  input: Parameters<typeof createUnbrandedScopeFactReaderV1>[0],
) {
  const reader = createUnbrandedScopeFactReaderV1(input);
  readerProvenance.scope.add(reader);
  return reader;
}

function genuineIdentityReader(): AuthoritativeFormalSessionIdentityFactReaderV1 {
  const reader = Object.freeze({
    resolve: vi.fn(async () => ({
      kind: 'current_identity_fact' as const,
      accountId: payload.accountId,
      username: 'request_operator',
      displayName: '请求操作员',
      status: 'active' as const,
      observedAt: NOW.toISOString(),
    })),
  });
  readerProvenance.identity.add(reader);
  return reader;
}
import type { ActiveInstitutionAnchorProviderV1 } from '@/modules/security/server/institution-guard-evidence';
import {
  createInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
} from '@/modules/security/server/institution-guard-reference';
import {
  createInstitutionRequestAuthorizationV1,
  isInstitutionRequestAuthorizationV1,
  type InstitutionRequestAuthorizationV1,
} from '@/modules/security/server/institution-request-authorization';
import {
  isInstitutionNavigationAuthorizationV1,
  isInstitutionSectionAllowV1,
  type InstitutionNavigationAuthorizationInputV1,
  type InstitutionSectionGuardInputV1,
} from '@/modules/security/server/institution-section-guard';

const NOW = new Date('2026-07-22T08:02:00.000Z');
const SESSION_KEY = new Uint8Array(32).fill(0x73);
const REFERENCE_KEY = new Uint8Array(32).fill(0x72);
const SESSION_PROTOCOL = 'zmtg.formal-server-session-cookie.v1';
const payload = Object.freeze({
  source: 'server_session' as const,
  sessionId: 'session-compose-001',
  accountId: 'account-compose-001',
  tenantId: 'tenant-compose-001',
  institutionId: 'institution-compose-001',
  issuedAt: '2026-07-22T08:00:00.000Z',
  expiresAt: '2026-07-22T09:00:00.000Z',
});

function signToken(value: Record<string, unknown> = payload) {
  const payloadSegment = Buffer.from(JSON.stringify(value)).toString('base64url');
  const signingInput = `${SESSION_PROTOCOL}\n2\n${payloadSegment}`;
  const tag = createHmac('sha256', SESSION_KEY)
    .update(signingInput)
    .digest('base64url');
  return `v1.k2.${payloadSegment}.${tag}`;
}

function tamperToken(token: string) {
  const parts = token.split('.');
  const tag = parts.at(-1);
  if (!tag) throw new Error('expected token tag');
  parts[parts.length - 1] = `${tag[0] === 'A' ? 'B' : 'A'}${tag.slice(1)}`;
  return parts.join('.');
}

function sessionKeyRing(
  keyMaterial: Uint8Array | null = SESSION_KEY,
): FormalServerSessionKeyRingV1 {
  return {
    currentKey: { keyVersion: 2, keyMaterial },
    verifyOnlyKeys: [],
  };
}

function referenceCodec(keyMaterial: Uint8Array | null = REFERENCE_KEY) {
  return createInstitutionGuardReferenceCodecV1({
    keyRing: {
      currentIssueKey: { keyVersion: 1, keyMaterial },
      verifyOnlyKeys: [],
    },
    now: () => NOW,
  });
}

const membershipRow: CurrentInstitutionMembershipFactRow = {
  accountId: payload.accountId,
  membershipId: 'membership-compose-001',
  membershipTenantId: payload.tenantId,
  membershipUserId: payload.accountId,
  membershipRole: 'tenant_admin',
  membershipDisplayName: '机构管理员',
  membershipRevision: 1,
  membershipLifecycleStatus: 'active',
  membershipProvenanceSource: 'legacy_calibration',
  membershipProvenanceActorId: null,
  membershipProvenanceReasonCode: 'legacy_unknown',
  membershipProvenanceCommandId: `mcal1_${'d'.repeat(64)}`,
  membershipProvenanceOccurredAt: null,
  membershipProvenanceRecordedAt: new Date('2026-07-22T08:01:00.000Z'),
  membershipRevokedAt: null,
  membershipDeletedAt: null,
  bindingId: 'binding-compose-001',
  bindingAccountId: payload.accountId,
  bindingTenantId: payload.tenantId,
  bindingInstitutionId: payload.institutionId,
  bindingStatus: 'active',
  bindingSource: 'manual_admin',
  bindingAssignedAt: new Date('2026-07-22T08:00:00.000Z'),
  bindingExpiresAt: null,
  bindingRevokedAt: null,
  bindingVersion: 1,
};

const anchorRow: CurrentInstitutionScopeFactRowV1 = {
  tenantId: payload.tenantId,
  institutionId: payload.institutionId,
  status: 'active',
  revision: 1,
};

type FixtureOptions = Readonly<{
  cookieHeader?: string | null;
  sessionKeyRing?: FormalServerSessionKeyRingV1;
  compositionNow?: () => Date;
  membershipRole?: InstitutionRoleV1;
}>;

function fixture(options: FixtureOptions = {}) {
  const codec = referenceCodec();
  const membershipRead = vi.fn(async () => [
    {
      ...membershipRow,
      membershipRole: options.membershipRole ?? membershipRow.membershipRole,
    },
  ]);
  const membershipFactReader =
    createAuthoritativeInstitutionMembershipFactReaderV1({
      repository: { findCurrentInstitutionMembershipFacts: membershipRead },
      now: () => NOW,
    });
  const owner = createFormalServerSessionRequestOwnerV1({
    cookieHeader:
      options.cookieHeader === undefined
        ? `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`
        : options.cookieHeader,
    sessionKeyRing: options.sessionKeyRing ?? sessionKeyRing(),
    identityFactReader: genuineIdentityReader(),
    membershipFactReader,
    referenceCodec: codec,
    now: () => NOW,
  });
  const anchorRead = vi.fn(async () => [anchorRow]);
  const anchorFactReader = createAuthoritativeInstitutionScopeFactReaderV1({
    repository: { findCurrentInstitutionScopeFacts: anchorRead },
    now: () => NOW,
  });
  const anchorProvider = createActiveInstitutionAnchorProviderV1({
    factReader: anchorFactReader,
    referenceCodec: codec,
    now: () => NOW,
  });
  const compositionNow =
    options.compositionNow ?? vi.fn(() => new Date(NOW.getTime()));

  return {
    owner,
    codec,
    anchorProvider,
    membershipRead,
    anchorRead,
    compositionNow,
  };
}

function compose(
  created: ReturnType<typeof fixture>,
  overrides: Partial<{
    requestOwner: FormalServerSessionRequestOwnerV1;
    anchorProvider: ActiveInstitutionAnchorProviderV1;
    referenceCodec: InstitutionGuardReferenceCodecV1;
    now: () => Date;
  }> = {},
) {
  return createInstitutionRequestAuthorizationV1({
    requestOwner: overrides.requestOwner ?? created.owner,
    anchorProvider: overrides.anchorProvider ?? created.anchorProvider,
    referenceCodec: overrides.referenceCodec ?? created.codec,
    now: overrides.now ?? created.compositionNow,
  });
}

const workbenchInput = Object.freeze({ sectionId: 'workbench' as const });

describe('AUTH-COMPOSE-01C institution request authorization', () => {
  it('seals the exact factory and public method inputs', () => {
    type FactoryInput = Parameters<
      typeof createInstitutionRequestAuthorizationV1
    >[0];
    type PublicInput = Parameters<
      InstitutionRequestAuthorizationV1['authorizeCurrentInstitutionSectionV1']
    >[0];

    expectTypeOf<keyof FactoryInput>().toEqualTypeOf<
      'requestOwner' | 'anchorProvider' | 'referenceCodec' | 'now'
    >();
    expectTypeOf<PublicInput>().toEqualTypeOf<InstitutionSectionGuardInputV1>();
    expectTypeOf<keyof PublicInput>().toEqualTypeOf<'sectionId'>();
    expectTypeOf<{
      authorizeCurrentInstitutionSectionV1: InstitutionRequestAuthorizationV1['authorizeCurrentInstitutionSectionV1'];
    }>().not.toMatchTypeOf<InstitutionRequestAuthorizationV1>();
  });

  it('returns one genuine frozen low-sensitive workbench allow without extending validUntil', async () => {
    const created = fixture();
    const authorization = compose(created);

    expect(Object.isFrozen(authorization)).toBe(true);
    expect(isInstitutionRequestAuthorizationV1(authorization)).toBe(true);
    const result = await authorization.authorizeCurrentInstitutionSectionV1(
      workbenchInput,
    );

    expect(isInstitutionSectionAllowV1(result)).toBe(true);
    expect(result).toEqual({
      kind: 'institution_section_allow',
      sectionId: 'workbench',
      action: 'section_enter',
      policyRevision: expect.stringMatching(/^prv_v1_k1_[A-Za-z0-9_-]{43}$/u),
      decidedAt: NOW.toISOString(),
      validUntil: '2026-07-22T08:03:00.000Z',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(created.membershipRead).toHaveBeenCalledTimes(4);
    expect(created.anchorRead).toHaveBeenCalledTimes(2);
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      payload.accountId,
      payload.sessionId,
      payload.tenantId,
      payload.institutionId,
      membershipRow.membershipId,
    ]) {
      expect(serialized).not.toContain(String(forbidden));
    }
    for (const forbiddenField of [
      'accountId',
      'tenantId',
      'institutionId',
      'role',
      'evidence',
      'provider',
      'scopeAllow',
      'anchorRevision',
    ]) {
      expect(serialized).not.toContain(`"${forbiddenField}"`);
    }

    await expect(
      authorization.authorizeCurrentInstitutionSectionV1(workbenchInput),
    ).resolves.toEqual({ kind: 'rejected', code: 'scope_unavailable' });
    expect(created.membershipRead).toHaveBeenCalledTimes(4);
    expect(created.anchorRead).toHaveBeenCalledTimes(2);
  });

  it('recognizes only the exact factory-issued authorization without property access', () => {
    const authorization = compose(fixture());
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'authorizeCurrentInstitutionSectionV1', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('authorization getter must not run');
      },
    });
    const traps: ProxyHandler<object> = {
      get() {
        proxyTraps += 1;
        throw new Error('authorization get trap must not run');
      },
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('authorization prototype trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('authorization ownKeys trap must not run');
      },
    };
    const proxy = new Proxy(authorization, traps);
    const revoked = Proxy.revocable(authorization, traps);
    revoked.revoke();

    for (const value of [
      {},
      { ...authorization },
      Object.create(authorization) as object,
      accessor,
      proxy,
      revoked.proxy,
    ]) {
      expect(isInstitutionRequestAuthorizationV1(value)).toBe(false);
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('validates every dependency before consuming the genuine owner', async () => {
    const created = fixture();
    const fakeAnchorResolve = vi.fn();
    const fakeIssue = vi.fn();
    const fakeVerify = vi.fn();
    let dependencyGetterReads = 0;
    let dependencyProxyTraps = 0;
    let nowApplyTraps = 0;
    const fakeAnchorAccessor: Record<string, unknown> = {};
    Object.defineProperty(fakeAnchorAccessor, 'resolve', {
      enumerable: true,
      get() {
        dependencyGetterReads += 1;
        throw new Error('anchor getter must not run');
      },
    });
    const fakeCodecAccessor: Record<string, unknown> = {
      verify: fakeVerify,
    };
    Object.defineProperty(fakeCodecAccessor, 'issue', {
      enumerable: true,
      get() {
        dependencyGetterReads += 1;
        throw new Error('codec getter must not run');
      },
    });
    const dependencyTraps: ProxyHandler<object> = {
      get() {
        dependencyProxyTraps += 1;
        throw new Error('dependency get trap must not run');
      },
      getPrototypeOf() {
        dependencyProxyTraps += 1;
        throw new Error('dependency prototype trap must not run');
      },
      ownKeys() {
        dependencyProxyTraps += 1;
        throw new Error('dependency ownKeys trap must not run');
      },
    };
    const anchorProxy = new Proxy(created.anchorProvider, dependencyTraps);
    const revokedAnchor = Proxy.revocable(
      created.anchorProvider,
      dependencyTraps,
    );
    revokedAnchor.revoke();
    const codecProxy = new Proxy(created.codec, dependencyTraps);
    const revokedCodec = Proxy.revocable(created.codec, dependencyTraps);
    revokedCodec.revoke();
    const proxyNow = new Proxy(created.compositionNow, {
      apply() {
        nowApplyTraps += 1;
        throw new Error('composition clock must not run');
      },
    });

    for (const authorization of [
      compose(created, {
        anchorProvider: { resolve: fakeAnchorResolve } as unknown as ActiveInstitutionAnchorProviderV1,
      }),
      compose(created, {
        referenceCodec: {
          issue: fakeIssue,
          verify: fakeVerify,
        } as unknown as InstitutionGuardReferenceCodecV1,
      }),
      compose(created, {
        anchorProvider:
          fakeAnchorAccessor as unknown as ActiveInstitutionAnchorProviderV1,
      }),
      compose(created, {
        anchorProvider: {
          ...created.anchorProvider,
        } as ActiveInstitutionAnchorProviderV1,
      }),
      compose(created, {
        anchorProvider: Object.create(
          created.anchorProvider,
        ) as ActiveInstitutionAnchorProviderV1,
      }),
      compose(created, {
        anchorProvider:
          anchorProxy as unknown as ActiveInstitutionAnchorProviderV1,
      }),
      compose(created, {
        anchorProvider:
          revokedAnchor.proxy as unknown as ActiveInstitutionAnchorProviderV1,
      }),
      compose(created, {
        referenceCodec:
          fakeCodecAccessor as unknown as InstitutionGuardReferenceCodecV1,
      }),
      compose(created, {
        referenceCodec: {
          ...created.codec,
        } as InstitutionGuardReferenceCodecV1,
      }),
      compose(created, {
        referenceCodec: Object.create(
          created.codec,
        ) as InstitutionGuardReferenceCodecV1,
      }),
      compose(created, {
        referenceCodec:
          codecProxy as unknown as InstitutionGuardReferenceCodecV1,
      }),
      compose(created, {
        referenceCodec:
          revokedCodec.proxy as unknown as InstitutionGuardReferenceCodecV1,
      }),
      compose(created, { now: proxyNow }),
    ]) {
      expect(isInstitutionRequestAuthorizationV1(authorization)).toBe(true);
      await expect(
        authorization.authorizeCurrentInstitutionSectionV1(workbenchInput),
      ).resolves.toMatchObject({ kind: 'rejected' });
    }
    expect(fakeAnchorResolve).not.toHaveBeenCalled();
    expect(fakeIssue).not.toHaveBeenCalled();
    expect(fakeVerify).not.toHaveBeenCalled();
    expect(dependencyGetterReads).toBe(0);
    expect(dependencyProxyTraps).toBe(0);
    expect(nowApplyTraps).toBe(0);
    expect(created.membershipRead).not.toHaveBeenCalled();
    expect(created.anchorRead).not.toHaveBeenCalled();

    await expect(
      compose(created).authorizeCurrentInstitutionSectionV1(workbenchInput),
    ).resolves.toMatchObject({ kind: 'institution_section_allow' });
  });

  it('rejects spent owner composition without clock, membership or anchor access', async () => {
    const created = fixture();
    compose(created);
    const spent = compose(created);

    await expect(
      spent.authorizeCurrentInstitutionSectionV1(workbenchInput),
    ).resolves.toEqual({ kind: 'rejected', code: 'scope_unavailable' });
    expect(created.compositionNow).not.toHaveBeenCalled();
    expect(created.membershipRead).not.toHaveBeenCalled();
    expect(created.anchorRead).not.toHaveBeenCalled();
  });

  it('rejects hostile factory and owner shapes without getters, traps or owner consumption', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const created = fixture();
    const base = {
      requestOwner: created.owner,
      anchorProvider: created.anchorProvider,
      referenceCodec: created.codec,
      now: created.compositionNow,
    };
    const accessor = { ...base };
    Object.defineProperty(accessor, 'requestOwner', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('owner getter must not run');
      },
    });
    const hostileFactory = new Proxy(base, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('factory prototype trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('factory ownKeys trap must not run');
      },
    });
    const ownerProxy = new Proxy(created.owner, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('owner prototype trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('owner ownKeys trap must not run');
      },
    });
    const revokedFactory = Proxy.revocable(base, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('revoked factory prototype trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('revoked factory ownKeys trap must not run');
      },
    });
    revokedFactory.revoke();
    const revokedOwner = Proxy.revocable(created.owner, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('revoked owner prototype trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('revoked owner ownKeys trap must not run');
      },
    });
    revokedOwner.revoke();
    const {
      requestOwner,
      anchorProvider,
      referenceCodec: codec,
      now,
    } = base;
    const hostileInputs = [
      { anchorProvider, referenceCodec: codec, now },
      { requestOwner, referenceCodec: codec, now },
      { requestOwner, anchorProvider, now },
      { requestOwner, anchorProvider, referenceCodec: codec },
      { ...base, extra: true },
      Object.assign({ ...base }, { [Symbol('raw')]: true }),
      accessor,
      Object.assign(Object.create({ inherited: true }), base),
      hostileFactory,
      revokedFactory.proxy,
      { ...base, requestOwner: { ...created.owner } },
      { ...base, requestOwner: Object.create(created.owner) },
      { ...base, requestOwner: ownerProxy },
      { ...base, requestOwner: revokedOwner.proxy },
    ];

    for (const input of hostileInputs) {
      const authorization = createInstitutionRequestAuthorizationV1(
        input as never,
      );
      expect(isInstitutionRequestAuthorizationV1(authorization)).toBe(true);
      await expect(
        authorization.authorizeCurrentInstitutionSectionV1(workbenchInput),
      ).resolves.toEqual({ kind: 'rejected', code: 'scope_unavailable' });
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
    expect(created.compositionNow).not.toHaveBeenCalled();
    expect(created.membershipRead).not.toHaveBeenCalled();
    expect(created.anchorRead).not.toHaveBeenCalled();

    await expect(
      compose(created).authorizeCurrentInstitutionSectionV1(workbenchInput),
    ).resolves.toMatchObject({ kind: 'institution_section_allow' });
  });

  it.each([
    ['missing', null, sessionKeyRing()],
    ['demo', 'zmtg_demo_session=present', sessionKeyRing()],
    [
      'tampered',
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${tamperToken(signToken())}`,
      sessionKeyRing(),
    ],
    [
      'expired',
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken({
        ...payload,
        expiresAt: NOW.toISOString(),
      })}`,
      sessionKeyRing(),
    ],
    [
      'unavailable',
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
      sessionKeyRing(null),
    ],
  ] as const)(
    'keeps authentic %s owner failure low-sensitive and skips membership plus anchor',
    async (_label, cookieHeader, keyRing) => {
      const created = fixture({ cookieHeader, sessionKeyRing: keyRing });
      const authorization = compose(created);

      expect(isInstitutionRequestAuthorizationV1(authorization)).toBe(true);
      await expect(
        authorization.authorizeCurrentInstitutionSectionV1(workbenchInput),
      ).resolves.toEqual({ kind: 'rejected', code: 'scope_unavailable' });
      expect(created.membershipRead).not.toHaveBeenCalled();
      expect(created.anchorRead).not.toHaveBeenCalled();
      expect(created.compositionNow).not.toHaveBeenCalled();
    },
  );

  it('maps a genuine unavailable policy codec without leaking its failure', async () => {
    const created = fixture();
    const unavailableCodec = referenceCodec(null);

    await expect(
      compose(created, {
        referenceCodec: unavailableCodec,
      }).authorizeCurrentInstitutionSectionV1(workbenchInput),
    ).resolves.toEqual({ kind: 'rejected', code: 'policy_unavailable' });
    expect(created.membershipRead).toHaveBeenCalledTimes(4);
    expect(created.anchorRead).toHaveBeenCalledTimes(2);
  });

  it('rejects hostile section inputs before spending the request or touching downstream owners', async () => {
    const created = fixture();
    const authorization = compose(created);
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'sectionId', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('section getter must not run');
      },
    });
    const hostileSection = new Proxy(workbenchInput, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('section prototype trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('section ownKeys trap must not run');
      },
    });
    const revokedSection = Proxy.revocable(workbenchInput, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('revoked section prototype trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('revoked section ownKeys trap must not run');
      },
    });
    revokedSection.revoke();
    const invalidInputs = [
      {},
      { ...workbenchInput, extra: true },
      Object.assign({ ...workbenchInput }, { [Symbol('section')]: true }),
      accessor,
      Object.assign(Object.create({ inherited: true }), workbenchInput),
      hostileSection,
      revokedSection.proxy,
      { sectionId: 'unknown' },
    ];

    for (const input of invalidInputs) {
      await expect(
        authorization.authorizeCurrentInstitutionSectionV1(
          input as InstitutionSectionGuardInputV1,
        ),
      ).resolves.toEqual({ kind: 'rejected', code: 'action_unregistered' });
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
    expect(created.compositionNow).not.toHaveBeenCalled();
    expect(created.membershipRead).not.toHaveBeenCalled();
    expect(created.anchorRead).not.toHaveBeenCalled();

    await expect(
      authorization.authorizeCurrentInstitutionSectionV1(workbenchInput),
    ).resolves.toMatchObject({ kind: 'institution_section_allow' });
    expect(created.membershipRead).toHaveBeenCalledTimes(4);
    expect(created.anchorRead).toHaveBeenCalledTimes(2);
  });
});

describe('BASE-NAV-01 request navigation composition', () => {
  it('exposes one exact target-only method and returns a low-sensitive sealed snapshot', async () => {
    type NavigationInput = Parameters<
      InstitutionRequestAuthorizationV1['authorizeCurrentInstitutionNavigationV1']
    >[0];
    expectTypeOf<NavigationInput>().toEqualTypeOf<InstitutionNavigationAuthorizationInputV1>();
    expectTypeOf<keyof NavigationInput>().toEqualTypeOf<'targetSectionId'>();

    const created = fixture();
    const authorization = compose(created);
    const result = await authorization.authorizeCurrentInstitutionNavigationV1({
      targetSectionId: 'system',
    });

    expect(result).toEqual({
      kind: 'institution_navigation_authorization',
      targetSectionId: 'system',
      targetAccess: 'allowed',
      availableSectionIds: [
        'workbench',
        'customers',
        'conversations',
        'care',
        'knowledge',
        'analytics',
        'system',
      ],
    });
    expect(isInstitutionNavigationAuthorizationV1(result)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.availableSectionIds)).toBe(true);
    expect(created.membershipRead).toHaveBeenCalledTimes(4);
    expect(created.anchorRead).toHaveBeenCalledTimes(2);
    expect(Object.keys(result)).toEqual([
      'kind',
      'targetSectionId',
      'targetAccess',
      'availableSectionIds',
    ]);
  });

  it('rejects hostile navigation inputs before spending the owner or reading dependencies', async () => {
    const created = fixture();
    const authorization = compose(created);
    let getterReads = 0;
    let traps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'targetSectionId', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('target getter must not run');
      },
    });
    const proxy = new Proxy(
      { targetSectionId: 'workbench' },
      {
        getPrototypeOf() {
          traps += 1;
          throw new Error('target prototype trap must not run');
        },
        ownKeys() {
          traps += 1;
          throw new Error('target keys trap must not run');
        },
      },
    );
    const revoked = Proxy.revocable({ targetSectionId: 'workbench' }, {});
    revoked.revoke();

    for (const input of [
      {},
      { targetSectionId: 'unknown' },
      { targetSectionId: 'workbench', role: 'tenant_admin' },
      Object.assign({ targetSectionId: 'workbench' }, { [Symbol('raw')]: true }),
      Object.assign(Object.create({ role: 'tenant_admin' }), {
        targetSectionId: 'workbench',
      }),
      accessor,
      proxy,
      revoked.proxy,
    ]) {
      const result = await authorization.authorizeCurrentInstitutionNavigationV1(
        input as InstitutionNavigationAuthorizationInputV1,
      );
      expect(result).toEqual({
        kind: 'institution_navigation_authorization',
        targetSectionId: null,
        targetAccess: 'blocked',
        availableSectionIds: [],
      });
      expect(isInstitutionNavigationAuthorizationV1(result)).toBe(true);
    }
    expect(getterReads).toBe(0);
    expect(traps).toBe(0);
    expect(created.compositionNow).not.toHaveBeenCalled();
    expect(created.membershipRead).not.toHaveBeenCalled();
    expect(created.anchorRead).not.toHaveBeenCalled();

    await expect(
      authorization.authorizeCurrentInstitutionNavigationV1({
        targetSectionId: 'workbench',
      }),
    ).resolves.toMatchObject({ targetAccess: 'allowed' });
  });

  it('shares the single owner consumption across old and new authorization methods', async () => {
    const created = fixture();
    const authorization = compose(created);

    await expect(
      authorization.authorizeCurrentInstitutionNavigationV1({
        targetSectionId: 'workbench',
      }),
    ).resolves.toMatchObject({ targetAccess: 'allowed' });
    await expect(
      authorization.authorizeCurrentInstitutionSectionV1(workbenchInput),
    ).resolves.toEqual({ kind: 'rejected', code: 'scope_unavailable' });
    await expect(
      authorization.authorizeCurrentInstitutionNavigationV1({
        targetSectionId: 'system',
      }),
    ).resolves.toEqual({
      kind: 'institution_navigation_authorization',
      targetSectionId: 'system',
      targetAccess: 'blocked',
      availableSectionIds: [],
    });
    expect(created.membershipRead).toHaveBeenCalledTimes(4);
    expect(created.anchorRead).toHaveBeenCalledTimes(2);

    const reverse = fixture();
    const reverseAuthorization = compose(reverse);
    await expect(
      reverseAuthorization.authorizeCurrentInstitutionSectionV1(workbenchInput),
    ).resolves.toMatchObject({ kind: 'institution_section_allow' });
    await expect(
      reverseAuthorization.authorizeCurrentInstitutionNavigationV1({
        targetSectionId: 'system',
      }),
    ).resolves.toEqual({
      kind: 'institution_navigation_authorization',
      targetSectionId: 'system',
      targetAccess: 'blocked',
      availableSectionIds: [],
    });
    expect(reverse.membershipRead).toHaveBeenCalledTimes(4);
    expect(reverse.anchorRead).toHaveBeenCalledTimes(2);
  });

  it('allows at most one concurrent result across duplicate and cross-method calls', async () => {
    const duplicateFixture = fixture();
    const duplicateAuthorization = compose(duplicateFixture);
    const duplicateResults = await Promise.all([
      duplicateAuthorization.authorizeCurrentInstitutionNavigationV1({
        targetSectionId: 'workbench',
      }),
      duplicateAuthorization.authorizeCurrentInstitutionNavigationV1({
        targetSectionId: 'system',
      }),
    ]);
    expect(
      duplicateResults.filter((result) => result.targetAccess === 'allowed'),
    ).toHaveLength(1);
    expect(duplicateFixture.membershipRead).toHaveBeenCalledTimes(4);
    expect(duplicateFixture.anchorRead).toHaveBeenCalledTimes(2);

    const crossFixture = fixture();
    const crossAuthorization = compose(crossFixture);
    const [sectionResult, navigationResult] = await Promise.all([
      crossAuthorization.authorizeCurrentInstitutionSectionV1(workbenchInput),
      crossAuthorization.authorizeCurrentInstitutionNavigationV1({
        targetSectionId: 'system',
      }),
    ]);
    const successes =
      Number(sectionResult.kind === 'institution_section_allow') +
      Number(navigationResult.targetAccess === 'allowed');
    expect(successes).toBe(1);
    expect(crossFixture.membershipRead).toHaveBeenCalledTimes(4);
    expect(crossFixture.anchorRead).toHaveBeenCalledTimes(2);
  });

  it('derives the target and navigation from the same low-privilege scope role', async () => {
    const created = fixture({ membershipRole: 'consultant' });
    const result = await compose(
      created,
    ).authorizeCurrentInstitutionNavigationV1({
      targetSectionId: 'analytics',
    });

    expect(result).toEqual({
      kind: 'institution_navigation_authorization',
      targetSectionId: 'analytics',
      targetAccess: 'blocked',
      availableSectionIds: [
        'workbench',
        'customers',
        'conversations',
        'care',
      ],
    });
    expect(created.membershipRead).toHaveBeenCalledTimes(4);
    expect(created.anchorRead).toHaveBeenCalledTimes(2);
  });

  it('maps unavailable scope and policy to sealed blocked empty navigation', async () => {
    const invalidScope = fixture({ cookieHeader: null });
    const unavailablePolicy = fixture();

    for (const authorization of [
      compose(invalidScope),
      compose(unavailablePolicy, { referenceCodec: referenceCodec(null) }),
    ]) {
      const result = await authorization.authorizeCurrentInstitutionNavigationV1({
        targetSectionId: 'workbench',
      });
      expect(result).toEqual({
        kind: 'institution_navigation_authorization',
        targetSectionId: 'workbench',
        targetAccess: 'blocked',
        availableSectionIds: [],
      });
      expect(isInstitutionNavigationAuthorizationV1(result)).toBe(true);
    }
  });
});
