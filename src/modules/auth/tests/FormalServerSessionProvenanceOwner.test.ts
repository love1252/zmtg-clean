import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

const cryptoMocks = vi.hoisted(() => ({
  randomUUID: vi.fn<typeof import('node:crypto').randomUUID>(),
}));

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  cryptoMocks.randomUUID.mockImplementation(actual.randomUUID);
  return {
    ...actual,
    randomUUID: cryptoMocks.randomUUID,
  };
});

import {
  consumeFormalServerSessionUserSnapshotV1,
  createAuthAccountRepository,
  isFormalServerSessionUserSnapshotV1,
  type CurrentInstitutionMembershipFactRow,
  type FormalServerSessionUserSnapshotV1,
} from '@/modules/auth/server/auth-account-repository';
import {
  consumeFormalServerSessionVerifiedClaimsV1,
  consumeFormalServerSessionRequestOwnerV1,
  createFormalServerSessionRequestOwnerV1,
  createFormalServerSessionProvenanceResolverV1,
  FORMAL_SERVER_SESSION_COOKIE_V1,
  isFormalServerSessionVerifiedClaimsV1,
  isFormalServerSessionRequestOwnerV1,
  issueFormalServerSessionCookieV1,
  verifyFormalServerSessionCookieClaimsV1,
  type FormalServerSessionVerifiedClaimsV1,
  type FormalServerSessionRequestOwnerV1,
  type FormalServerSessionKeyRingV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import {
  isFormalProvenanceResolverV1,
} from '@/modules/security/server/formal-request-provenance-owner';
import type { FormalProvenanceResolverV1 } from '@/modules/security/server/institution-guard-evidence';
import {
  createAuthoritativeInstitutionMembershipFactReaderV1,
  isFreshActiveMembershipProviderV1,
  type AuthoritativeInstitutionMembershipFactReaderV1,
} from '@/modules/security/server/institution-membership-provider';
import { createInstitutionGuardReferenceCodecV1 } from '@/modules/security/server/institution-guard-reference';
import type { TenantDatabase } from '@/server/db/client';

const SESSION_KEY = new Uint8Array(32).fill(0x73);
const OLD_SESSION_KEY = new Uint8Array(32).fill(0x6f);
const REFERENCE_KEY = new Uint8Array(32).fill(0x72);
const VERIFIED_AT = new Date('2026-07-22T08:02:00.000Z');
const PROTOCOL_DOMAIN = 'zmtg.formal-server-session-cookie.v1';

const payload = Object.freeze({
  source: 'server_session' as const,
  sessionId: 'session-001',
  accountId: 'account-001',
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  issuedAt: '2026-07-22T08:00:00.000Z',
  expiresAt: '2026-07-22T09:00:00.000Z',
});

function signToken(
  value: Record<string, unknown> = payload,
  input: Readonly<{
    keyVersion?: number;
    keyMaterial?: Uint8Array;
    rawPayload?: string;
  }> = {},
) {
  const keyVersion = input.keyVersion ?? 2;
  const payloadSegment =
    input.rawPayload ?? Buffer.from(JSON.stringify(value)).toString('base64url');
  const signingInput = `${PROTOCOL_DOMAIN}\n${keyVersion}\n${payloadSegment}`;
  const tag = createHmac('sha256', input.keyMaterial ?? SESSION_KEY)
    .update(signingInput)
    .digest('base64url');
  return `v1.k${keyVersion}.${payloadSegment}.${tag}`;
}

function keyRing(
  overrides: Partial<FormalServerSessionKeyRingV1> = {},
): FormalServerSessionKeyRingV1 {
  return {
    currentKey: { keyVersion: 2, keyMaterial: SESSION_KEY },
    verifyOnlyKeys: [
      {
        keyVersion: 1,
        keyMaterial: OLD_SESSION_KEY,
        verifyUntil: '2026-07-22T08:30:00.000Z',
      },
    ],
    ...overrides,
  };
}

function referenceCodec() {
  return createInstitutionGuardReferenceCodecV1({
    keyRing: {
      currentIssueKey: { keyVersion: 1, keyMaterial: REFERENCE_KEY },
      verifyOnlyKeys: [],
    },
    now: () => VERIFIED_AT,
  });
}

function resolver(input: Readonly<{
  cookieHeader?: string | null;
  sessionKeyRing?: FormalServerSessionKeyRingV1;
  now?: () => Date;
}> = {}): FormalProvenanceResolverV1 {
  const token = signToken();
  return createFormalServerSessionProvenanceResolverV1({
    cookieHeader:
      input.cookieHeader === undefined
        ? `${FORMAL_SERVER_SESSION_COOKIE_V1}=${token}`
        : input.cookieHeader,
    sessionKeyRing: input.sessionKeyRing ?? keyRing(),
    referenceCodec: referenceCodec(),
    now: input.now ?? (() => VERIFIED_AT),
  });
}

const membershipRow: CurrentInstitutionMembershipFactRow = {
  accountId: payload.accountId,
  accountStatus: 'active',
  accountPasswordResetRequired: false,
  accountLockedUntil: null,
  membershipId: 'membership-001',
  membershipTenantId: payload.tenantId,
  membershipUserId: payload.accountId,
  membershipRole: 'tenant_admin',
  membershipUpdatedAt: new Date('2026-07-22T08:01:00.000Z'),
  bindingId: 'binding-001',
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

function requestOwner(input: Readonly<{
  cookieHeader?: string | null;
  sessionKeyRing?: FormalServerSessionKeyRingV1;
  membershipFactReader?: AuthoritativeInstitutionMembershipFactReaderV1;
  referenceCodec?: ReturnType<typeof referenceCodec>;
  now?: () => Date;
}> = {}) {
  const findCurrentInstitutionMembershipFacts = vi.fn(async () => [membershipRow]);
  const membershipFactReader =
    input.membershipFactReader ??
    createAuthoritativeInstitutionMembershipFactReaderV1({
      repository: { findCurrentInstitutionMembershipFacts },
      now: input.now ?? (() => VERIFIED_AT),
    });
  return {
    findCurrentInstitutionMembershipFacts,
    owner: createFormalServerSessionRequestOwnerV1({
      cookieHeader:
        input.cookieHeader === undefined
          ? `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`
          : input.cookieHeader,
      sessionKeyRing: input.sessionKeyRing ?? keyRing(),
      membershipFactReader,
      referenceCodec: input.referenceCodec ?? referenceCodec(),
      now: input.now ?? (() => VERIFIED_AT),
    }),
  };
}

const formalSessionUserRow = Object.freeze({
  accountId: payload.accountId,
  accountUsername: 'account_operator',
  accountDisplayName: '账号操作员',
  accountStatus: 'active',
  accountPasswordResetRequired: false,
  accountLockedUntil: null,
  membershipTenantId: payload.tenantId,
  membershipUserId: payload.accountId,
  membershipRole: 'tenant_operator',
  membershipDisplayName: '机构操作员',
  bindingId: 'binding-001',
  bindingAccountId: payload.accountId,
  bindingTenantId: payload.tenantId,
  bindingInstitutionId: payload.institutionId,
  bindingStatus: 'active',
  bindingSource: 'manual_admin',
  bindingAssignedAt: new Date('2026-07-22T08:00:00.000Z'),
  bindingExpiresAt: null,
  bindingRevokedAt: null,
  bindingVersion: 1,
});

async function repositorySessionUserSnapshot(): Promise<FormalServerSessionUserSnapshotV1> {
  const limit = vi.fn(async () => [formalSessionUserRow]);
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    limit,
    where: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  const database = {
    select: vi.fn(() => chain),
  } as unknown as TenantDatabase;
  const snapshot = await createAuthAccountRepository(
    database,
  ).findCurrentFormalSessionUser({
    accountId: payload.accountId,
    tenantId: payload.tenantId,
    institutionId: payload.institutionId,
  });
  if (!snapshot) throw new Error('expected formal session user snapshot');
  return snapshot;
}

describe('AUTH-FORMAL-COOKIE-02A formal cookie infrastructure', () => {
  it('issues one canonical current-key V1 cookie only from a genuine repository snapshot', async () => {
    const sessionUserSnapshot = await repositorySessionUserSnapshot();
    const now = vi.fn(() => VERIFIED_AT);
    cryptoMocks.randomUUID.mockClear();
    const result = issueFormalServerSessionCookieV1({
      sessionUserSnapshot,
      sessionKeyRing: keyRing(),
      now,
    });

    expect(result).toMatchObject({
      kind: 'issued',
      expiresAt: '2026-07-22T16:02:00.000Z',
      maxAgeSeconds: 28_800,
    });
    expect(now).toHaveBeenCalledTimes(1);
    expect(cryptoMocks.randomUUID).toHaveBeenCalledTimes(1);
    expect(isFormalServerSessionUserSnapshotV1(sessionUserSnapshot)).toBe(false);
    if (result.kind !== 'issued') throw new Error('expected issued cookie');
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.sessionUser).toEqual({
      id: payload.accountId,
      username: 'account_operator',
      name: '机构操作员',
      role: 'tenant_operator',
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
    });
    expect(Object.isFrozen(result.sessionUser)).toBe(true);
    const [version, keyVersion, payloadSegment, tagSegment] = result.cookieValue.split('.');
    expect([version, keyVersion]).toEqual(['v1', 'k2']);
    expect(tagSegment).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    const decoded = JSON.parse(
      Buffer.from(payloadSegment ?? '', 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    expect(Object.keys(decoded)).toEqual([
      'source',
      'sessionId',
      'accountId',
      'tenantId',
      'institutionId',
      'issuedAt',
      'expiresAt',
    ]);
    expect(decoded).toMatchObject({
      source: 'server_session',
      accountId: payload.accountId,
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
      issuedAt: VERIFIED_AT.toISOString(),
      expiresAt: '2026-07-22T16:02:00.000Z',
    });
    expect(decoded.sessionId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(Buffer.from(JSON.stringify(decoded)).toString('base64url')).toBe(payloadSegment);
  });

  it('round-trips issued cookies through an authentic opaque single-use verified-claims handle', async () => {
    const sessionUserSnapshot = await repositorySessionUserSnapshot();
    const issued = issueFormalServerSessionCookieV1({
      sessionUserSnapshot,
      sessionKeyRing: keyRing(),
      now: () => VERIFIED_AT,
    });
    if (issued.kind !== 'issued') throw new Error('expected issued cookie');

    const resolution = verifyFormalServerSessionCookieClaimsV1({
      cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${issued.cookieValue}`,
      sessionKeyRing: keyRing(),
      now: () => VERIFIED_AT,
    });
    expect(resolution.kind).toBe('verified');
    if (resolution.kind !== 'verified') throw new Error('expected verified claims');
    expectTypeOf(resolution.verifiedClaims).toEqualTypeOf<FormalServerSessionVerifiedClaimsV1>();
    expect(Object.isFrozen(resolution)).toBe(true);
    expect(Object.isFrozen(resolution.verifiedClaims)).toBe(true);
    expect(Object.keys(resolution.verifiedClaims)).toEqual([]);
    expect(isFormalServerSessionVerifiedClaimsV1(resolution.verifiedClaims)).toBe(true);
    expect(JSON.stringify(resolution.verifiedClaims)).toBe('{}');

    expect(consumeFormalServerSessionVerifiedClaimsV1(resolution.verifiedClaims)).toEqual({
      accountId: payload.accountId,
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
    });
    expect(consumeFormalServerSessionVerifiedClaimsV1(resolution.verifiedClaims)).toBeNull();
    expect(isFormalServerSessionVerifiedClaimsV1(resolution.verifiedClaims)).toBe(false);
  });

  it('prevents callers from injecting claims and rejects handle lookalikes without property access', () => {
    type IssueInput = Parameters<typeof issueFormalServerSessionCookieV1>[0];
    type VerifyInput = Parameters<typeof verifyFormalServerSessionCookieClaimsV1>[0];
    type ConsumeInput = Parameters<typeof consumeFormalServerSessionVerifiedClaimsV1>[0];
    expectTypeOf<keyof IssueInput>().toEqualTypeOf<
      'sessionUserSnapshot' | 'sessionKeyRing' | 'now'
    >();
    expectTypeOf<keyof VerifyInput>().toEqualTypeOf<
      'cookieHeader' | 'sessionKeyRing' | 'now'
    >();
    expectTypeOf<ConsumeInput>().toEqualTypeOf<unknown>();

    let getterReads = 0;
    let proxyTraps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'accountId', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('claims getter must not run');
      },
    });
    const proxy = new Proxy({}, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('claims proxy trap must not run');
      },
    });
    for (const value of [{}, accessor, proxy]) {
      expect(isFormalServerSessionVerifiedClaimsV1(value)).toBe(false);
      expect(consumeFormalServerSessionVerifiedClaimsV1(value)).toBeNull();
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('never falls back to verify-only signing material and consumes the snapshot on failure', async () => {
    const sessionUserSnapshot = await repositorySessionUserSnapshot();
    const sessionKeyRing = keyRing({
      currentKey: { keyVersion: 2, keyMaterial: null },
      verifyOnlyKeys: [
        {
          keyVersion: 1,
          keyMaterial: OLD_SESSION_KEY,
          verifyUntil: '2026-07-22T08:30:00.000Z',
        },
      ],
    });
    cryptoMocks.randomUUID.mockClear();
    const result = issueFormalServerSessionCookieV1({
      sessionUserSnapshot,
      sessionKeyRing,
      now: () => VERIFIED_AT,
    });

    expect(result).toEqual({
      kind: 'unavailable',
      code: 'formal_session_unavailable',
    });
    expect(isFormalServerSessionUserSnapshotV1(sessionUserSnapshot)).toBe(false);
    expect(cryptoMocks.randomUUID).not.toHaveBeenCalled();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(Buffer.from(SESSION_KEY).toString('hex'));
    expect(serialized).not.toContain(Buffer.from(OLD_SESSION_KEY).toString('hex'));
    expect(serialized).not.toContain(payload.accountId);
  });

  it('rejects forged or revoked snapshots before key, clock, or random access', async () => {
    const revoked = await repositorySessionUserSnapshot();
    expect(consumeFormalServerSessionUserSnapshotV1(revoked)).not.toBeNull();
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'user', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('snapshot getter must not run');
      },
    });
    const proxy = new Proxy({}, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('snapshot proxy trap must not run');
      },
    });
    const nullPrototype = Object.create(null) as object;
    const hostileKeyRing: Record<string, unknown> = {};
    Object.defineProperty(hostileKeyRing, 'currentKey', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('key getter must not run');
      },
    });
    const now = vi.fn(() => {
      throw new Error('clock must not run');
    });
    cryptoMocks.randomUUID.mockClear();

    for (const sessionUserSnapshot of [
      {},
      { user: formalSessionUserRow },
      nullPrototype,
      accessor,
      proxy,
      revoked,
    ]) {
      expect(issueFormalServerSessionCookieV1({
        sessionUserSnapshot: sessionUserSnapshot as FormalServerSessionUserSnapshotV1,
        sessionKeyRing: hostileKeyRing as never,
        now,
      })).toEqual({
        kind: 'unavailable',
        code: 'formal_session_unavailable',
      });
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
    expect(now).not.toHaveBeenCalled();
    expect(cryptoMocks.randomUUID).not.toHaveBeenCalled();
  });

  it('atomically consumes once so dependency failure cannot be retried', async () => {
    const sessionUserSnapshot = await repositorySessionUserSnapshot();
    const now = vi.fn(() => VERIFIED_AT);
    cryptoMocks.randomUUID.mockClear();
    expect(issueFormalServerSessionCookieV1({
      sessionUserSnapshot,
      sessionKeyRing: keyRing({
        currentKey: { keyVersion: 2, keyMaterial: null },
      }),
      now,
    })).toEqual({
      kind: 'unavailable',
      code: 'formal_session_unavailable',
    });
    expect(now).not.toHaveBeenCalled();
    expect(cryptoMocks.randomUUID).not.toHaveBeenCalled();

    let keyReads = 0;
    const hostileKeyRing: Record<string, unknown> = {};
    Object.defineProperty(hostileKeyRing, 'currentKey', {
      enumerable: true,
      get() {
        keyReads += 1;
        throw new Error('consumed snapshot must reject before key access');
      },
    });
    const retryNow = vi.fn(() => VERIFIED_AT);
    expect(issueFormalServerSessionCookieV1({
      sessionUserSnapshot,
      sessionKeyRing: hostileKeyRing as never,
      now: retryNow,
    })).toEqual({
      kind: 'unavailable',
      code: 'formal_session_unavailable',
    });
    expect(keyReads).toBe(0);
    expect(retryNow).not.toHaveBeenCalled();
    expect(cryptoMocks.randomUUID).not.toHaveBeenCalled();
  });

  it('copies current key before clock-side mutation and never signs with verify-only keys', async () => {
    const sessionUserSnapshot = await repositorySessionUserSnapshot();
    const mutableCurrentKey = Uint8Array.from(SESSION_KEY);
    const issued = issueFormalServerSessionCookieV1({
      sessionUserSnapshot,
      sessionKeyRing: keyRing({
        currentKey: { keyVersion: 2, keyMaterial: mutableCurrentKey },
      }),
      now: () => {
        mutableCurrentKey.fill(0);
        return VERIFIED_AT;
      },
    });
    expect(issued.kind).toBe('issued');
    if (issued.kind !== 'issued') throw new Error('expected issued cookie');
    expect(issued.cookieValue.startsWith('v1.k2.')).toBe(true);
    expect(verifyFormalServerSessionCookieClaimsV1({
      cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${issued.cookieValue}`,
      sessionKeyRing: keyRing(),
      now: () => VERIFIED_AT,
    }).kind).toBe('verified');
  });

  it.each([
    [null, keyRing(), 'provenance_missing'],
    ['zmtg_demo_session=present', keyRing(), 'provenance_source_denied'],
    [
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken().slice(0, -1)}A`,
      keyRing(),
      'provenance_invalid',
    ],
    [
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken({
        ...payload,
        expiresAt: VERIFIED_AT.toISOString(),
      })}`,
      keyRing(),
      'provenance_expired',
    ],
    [
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
      keyRing({ currentKey: { keyVersion: 2, keyMaterial: null } }),
      'provenance_unavailable',
    ],
  ] as const)(
    'fails cookie claims verification closed without exposing claims or keys',
    (cookieHeader, sessionKeyRing, expectedCode) => {
      const result = verifyFormalServerSessionCookieClaimsV1({
        cookieHeader,
        sessionKeyRing,
        now: () => VERIFIED_AT,
      });
      expect(result).toEqual(expect.objectContaining({ code: expectedCode }));
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(payload.accountId);
      expect(serialized).not.toContain(Buffer.from(SESSION_KEY).toString('hex'));
      expect(serialized).not.toContain(Buffer.from(OLD_SESSION_KEY).toString('hex'));
    },
  );
});

describe('AUTH-SESSION-01A formal server session provenance owner', () => {
  it('issues an opaque authentic request owner with atomic single-use consumption', () => {
    const { owner } = requestOwner();

    expectTypeOf(owner).toEqualTypeOf<FormalServerSessionRequestOwnerV1>();
    expect(Object.isFrozen(owner)).toBe(true);
    expect(Object.keys(owner)).toEqual([]);
    expect(isFormalServerSessionRequestOwnerV1(owner)).toBe(true);
    const consumption = consumeFormalServerSessionRequestOwnerV1(owner);
    expect(consumption).not.toBeNull();
    expect(Object.isFrozen(consumption)).toBe(true);
    expect(isFormalProvenanceResolverV1(consumption?.provenanceResolver)).toBe(true);
    expect(isFreshActiveMembershipProviderV1(consumption?.membershipProvider)).toBe(true);
    expect(consumeFormalServerSessionRequestOwnerV1(owner)).toBeNull();
  });

  it('seals the factory and consumer APIs against raw caller account or scope input', () => {
    type FactoryInput = Parameters<typeof createFormalServerSessionRequestOwnerV1>[0];
    type ConsumptionInput = Parameters<typeof consumeFormalServerSessionRequestOwnerV1>[0];
    expectTypeOf<keyof FactoryInput>().toEqualTypeOf<
      | 'cookieHeader'
      | 'sessionKeyRing'
      | 'membershipFactReader'
      | 'referenceCodec'
      | 'now'
    >();
    expectTypeOf<ConsumptionInput>().toEqualTypeOf<unknown>();
  });

  it('privately binds the verified session account to both genuine child handles', async () => {
    const { owner, findCurrentInstitutionMembershipFacts } = requestOwner();
    const consumption = consumeFormalServerSessionRequestOwnerV1(owner);
    if (!consumption) throw new Error('expected one owner consumption');
    const provenance = await consumption.provenanceResolver.resolveCurrentRequest();
    if (provenance.kind !== 'verified') throw new Error('expected verified provenance');

    await expect(
      consumption.membershipProvider.resolve({
        provenance: provenance.evidence,
        requestedScope: {
          tenantId: payload.tenantId,
          institutionId: payload.institutionId,
        },
      }),
    ).resolves.toMatchObject({
      kind: 'fresh_active',
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
    });
    expect(findCurrentInstitutionMembershipFacts).toHaveBeenCalledWith({
      accountId: payload.accountId,
      tenantId: payload.tenantId,
    });
    const serialized = JSON.stringify(consumption);
    expect(serialized).not.toContain(payload.accountId);
    expect(serialized).not.toContain(payload.sessionId);
    expect(serialized).not.toContain(payload.tenantId);
    expect(serialized).not.toContain(payload.institutionId);
  });

  it('rejects owner lookalikes, clones and hostile proxies without property access', () => {
    const { owner } = requestOwner();
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'consume', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('owner getter must not run');
      },
    });
    const traps: ProxyHandler<object> = {
      get() {
        proxyTraps += 1;
        throw new Error('owner proxy get must not run');
      },
      getOwnPropertyDescriptor() {
        proxyTraps += 1;
        throw new Error('owner descriptor trap must not run');
      },
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('owner prototype trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('owner ownKeys trap must not run');
      },
    };
    const proxy = new Proxy(owner, traps);
    const revocable = Proxy.revocable(owner, traps);
    revocable.revoke();
    for (const value of [
      {},
      { ...owner },
      Object.assign({}, owner),
      Object.create(owner) as object,
      accessor,
      proxy,
      revocable.proxy,
    ]) {
      expect(isFormalServerSessionRequestOwnerV1(value)).toBe(false);
      expect(consumeFormalServerSessionRequestOwnerV1(value)).toBeNull();
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it.each([
    ['missing', null, keyRing(), 'provenance_missing'],
    ['demo', 'zmtg_demo_session=present', keyRing(), 'provenance_source_denied'],
    [
      'tampered',
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken().slice(0, -1)}A`,
      keyRing(),
      'provenance_invalid',
    ],
    [
      'expired',
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken({
        ...payload,
        expiresAt: VERIFIED_AT.toISOString(),
      })}`,
      keyRing(),
      'provenance_expired',
    ],
    [
      'unavailable',
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
      keyRing({ currentKey: { keyVersion: 2, keyMaterial: null } }),
      'provenance_unavailable',
    ],
  ] as const)(
    'keeps an authentic fail-closed owner for %s session input',
    async (_label, cookieHeader, sessionKeyRing, expectedCode) => {
      const validProvenance = await resolver().resolveCurrentRequest();
      if (validProvenance.kind !== 'verified') {
        throw new Error('expected valid comparison provenance');
      }
      const { owner, findCurrentInstitutionMembershipFacts } = requestOwner({
        cookieHeader,
        sessionKeyRing,
      });
      expect(isFormalServerSessionRequestOwnerV1(owner)).toBe(true);
      const consumption = consumeFormalServerSessionRequestOwnerV1(owner);
      if (!consumption) throw new Error('expected one owner consumption');
      expect(isFormalProvenanceResolverV1(consumption.provenanceResolver)).toBe(true);
      expect(isFreshActiveMembershipProviderV1(consumption.membershipProvider)).toBe(true);
      await expect(
        consumption.provenanceResolver.resolveCurrentRequest(),
      ).resolves.toMatchObject({ code: expectedCode });
      await expect(
        consumption.membershipProvider.resolve({
          provenance: validProvenance.evidence,
          requestedScope: {
            tenantId: payload.tenantId,
            institutionId: payload.institutionId,
          },
        }),
      ).resolves.toEqual({ kind: 'rejected', code: 'membership_unavailable' });
      expect(findCurrentInstitutionMembershipFacts).not.toHaveBeenCalled();
    },
  );

  it('fails fake reader and codec dependencies closed without getters, traps or facts', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const fakeReader: Record<string, unknown> = {};
    Object.defineProperty(fakeReader, 'resolve', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('reader getter must not run');
      },
    });
    const realCodec = referenceCodec();
    const fakeCodec = new Proxy(realCodec, {
      get() {
        proxyTraps += 1;
        throw new Error('codec get trap must not run');
      },
      getOwnPropertyDescriptor() {
        proxyTraps += 1;
        throw new Error('codec descriptor trap must not run');
      },
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('codec prototype trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('codec ownKeys trap must not run');
      },
    });
    const validProvenance = await resolver().resolveCurrentRequest();
    if (validProvenance.kind !== 'verified') throw new Error('expected provenance');

    for (const created of [
      requestOwner({
        membershipFactReader: fakeReader as AuthoritativeInstitutionMembershipFactReaderV1,
      }),
      requestOwner({ referenceCodec: fakeCodec }),
    ]) {
      expect(isFormalServerSessionRequestOwnerV1(created.owner)).toBe(true);
      const consumption = consumeFormalServerSessionRequestOwnerV1(created.owner);
      if (!consumption) throw new Error('expected one owner consumption');
      await expect(
        consumption.membershipProvider.resolve({
          provenance: validProvenance.evidence,
          requestedScope: {
            tenantId: payload.tenantId,
            institutionId: payload.institutionId,
          },
        }),
      ).resolves.toEqual({ kind: 'rejected', code: 'membership_unavailable' });
      expect(created.findCurrentInstitutionMembershipFacts).not.toHaveBeenCalled();
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('returns an authentic centrally registered, single-use resolver', async () => {
    const owner = resolver();

    expectTypeOf(owner).toEqualTypeOf<FormalProvenanceResolverV1>();
    expect(Object.isFrozen(owner)).toBe(true);
    expect(isFormalProvenanceResolverV1(owner)).toBe(true);
    expect((await owner.resolveCurrentRequest()).kind).toBe('verified');
    await expect(owner.resolveCurrentRequest()).resolves.toEqual({
      kind: 'rejected',
      code: 'provenance_source_denied',
    });
  });

  it('binds proof to session and generates a fresh internal request identifier', async () => {
    const first = await resolver().resolveCurrentRequest();
    const second = await resolver().resolveCurrentRequest();
    expect(first.kind).toBe('verified');
    expect(second.kind).toBe('verified');
    if (first.kind !== 'verified' || second.kind !== 'verified') return;

    expect(first.evidence.proofReference).toBe(second.evidence.proofReference);
    expect(first.evidence.requestReference).not.toBe(second.evidence.requestReference);
    expect(first.evidence.issuedAt).toBe('2026-07-22T08:02:00.000Z');
    expect(first.evidence.verifiedAt).toBe('2026-07-22T08:02:00.000Z');
    expect(first.evidence.validUntil).toBe('2026-07-22T08:07:00.000Z');
  });

  it('caps proof validity at the earlier session expiry or five-minute boundary', async () => {
    const shortToken = signToken({
      ...payload,
      expiresAt: '2026-07-22T08:03:00.000Z',
    });
    const result = await resolver({
      cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${shortToken}`,
    }).resolveCurrentRequest();
    expect(result.kind).toBe('verified');
    if (result.kind === 'verified') {
      expect(result.evidence.validUntil).toBe('2026-07-22T08:03:00.000Z');
    }
  });

  it('supports current and active verify-only keys while rejecting unknown or retired keys', async () => {
    const oldToken = signToken(payload, {
      keyVersion: 1,
      keyMaterial: OLD_SESSION_KEY,
    });
    expect(
      (
        await resolver({
          cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${oldToken}`,
        }).resolveCurrentRequest()
      ).kind,
    ).toBe('verified');

    for (const token of [
      signToken(payload, { keyVersion: 9 }),
      oldToken,
    ]) {
      const now = token === oldToken
        ? new Date('2026-07-22T08:30:00.000Z')
        : VERIFIED_AT;
      await expect(
        resolver({
          cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${token}`,
          now: () => now,
        }).resolveCurrentRequest(),
      ).resolves.toEqual({ kind: 'rejected', code: 'provenance_invalid' });
    }
  });

  it('fails the whole key ring closed unless every verify-only version is unique and older', async () => {
    for (const sessionKeyRing of [
      keyRing({
        currentKey: { keyVersion: 1, keyMaterial: SESSION_KEY },
        verifyOnlyKeys: [
          {
            keyVersion: 2,
            keyMaterial: OLD_SESSION_KEY,
            verifyUntil: '2026-07-22T08:30:00.000Z',
          },
        ],
      }),
      keyRing({
        verifyOnlyKeys: [
          {
            keyVersion: 1,
            keyMaterial: OLD_SESSION_KEY,
            verifyUntil: '2026-07-22T08:30:00.000Z',
          },
          {
            keyVersion: 1,
            keyMaterial: OLD_SESSION_KEY,
            verifyUntil: '2026-07-22T08:40:00.000Z',
          },
        ],
      }),
    ]) {
      await expect(resolver({ sessionKeyRing }).resolveCurrentRequest()).resolves.toEqual({
        kind: 'unavailable',
        code: 'provenance_unavailable',
      });
    }
  });

  it('maps missing and any demo/formal coexistence without decoding demo data', async () => {
    await expect(resolver({ cookieHeader: null }).resolveCurrentRequest()).resolves.toEqual({
      kind: 'rejected',
      code: 'provenance_missing',
    });
    await expect(
      resolver({ cookieHeader: 'zmtg_demo_session=hostile.demo.value' }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'provenance_source_denied' });
    await expect(
      resolver({
        cookieHeader: `zmtg_demo_session=hostile.demo.value; ${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'provenance_source_denied' });
  });

  it('treats every exact demo cookie-name trace as source denied without prefix guesses', async () => {
    const validFormal = `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`;
    for (const cookieHeader of [
      'zmtg_demo_session',
      '  zmtg_demo_session  ',
      'zmtg_demo_session=',
      `zmtg_demo_session; ${validFormal}`,
      `malformed; zmtg_demo_session ; ${FORMAL_SERVER_SESSION_COOKIE_V1}=invalid`,
      `zmtg_demo_session=; broken; ${validFormal}`,
      `broken; zmtg_demo_session; zmtg_demo_session=invalid; ${validFormal}`,
    ]) {
      await expect(resolver({ cookieHeader }).resolveCurrentRequest()).resolves.toEqual({
        kind: 'rejected',
        code: 'provenance_source_denied',
      });
    }

    for (const nearName of [
      'zmtg_demo_session_backup',
      'prefix_zmtg_demo_session',
      'zmtg_demo_sessionx',
    ]) {
      await expect(resolver({ cookieHeader: nearName }).resolveCurrentRequest()).resolves.toEqual({
        kind: 'rejected',
        code: 'provenance_missing',
      });
      expect(
        (
          await resolver({
            cookieHeader: `${nearName}; ${validFormal}`,
          }).resolveCurrentRequest()
        ).kind,
      ).toBe('verified');
    }
  });

  it('classifies missing and demo presence before key-ring, clock or codec validation', async () => {
    let keyGetterReads = 0;
    let codecTraps = 0;
    const hostileRing = {};
    Object.defineProperty(hostileRing, 'currentKey', {
      enumerable: true,
      get() {
        keyGetterReads += 1;
        throw new Error('key-ring secret');
      },
    });
    const hostileCodec = new Proxy(referenceCodec(), {
      getPrototypeOf() {
        codecTraps += 1;
        throw new Error('codec trap');
      },
      ownKeys() {
        codecTraps += 1;
        throw new Error('codec trap');
      },
    });
    const now = vi.fn(() => {
      throw new Error('clock secret');
    });

    for (const [cookieHeader, expected] of [
      [null, { kind: 'rejected', code: 'provenance_missing' }],
      [
        'zmtg_demo_session=not-even-a-token',
        { kind: 'rejected', code: 'provenance_source_denied' },
      ],
      [
        '  zmtg_demo_session  ',
        { kind: 'rejected', code: 'provenance_source_denied' },
      ],
      [
        `zmtg_demo_session=not-even-a-token; ${FORMAL_SERVER_SESSION_COOKIE_V1}=invalid`,
        { kind: 'rejected', code: 'provenance_source_denied' },
      ],
      [
        `broken; zmtg_demo_session ; ${FORMAL_SERVER_SESSION_COOKIE_V1}=invalid`,
        { kind: 'rejected', code: 'provenance_source_denied' },
      ],
    ] as const) {
      const result = await createFormalServerSessionProvenanceResolverV1({
        cookieHeader,
        sessionKeyRing: hostileRing as never,
        referenceCodec: hostileCodec,
        now,
      }).resolveCurrentRequest();
      expect(result).toEqual(expected);
    }
    expect(keyGetterReads).toBe(0);
    expect(codecTraps).toBe(0);
    expect(now).not.toHaveBeenCalled();
  });

  it('rejects forged, tampered, noncanonical, duplicate and oversized cookies', async () => {
    const canonicalPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const noncanonical = signToken(payload, {
      rawPayload: Buffer.from(` ${JSON.stringify(payload)}`).toString('base64url'),
    });
    const valid = signToken();
    const cases = [
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken(payload, { keyMaterial: OLD_SESSION_KEY })}`,
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${valid.slice(0, -1)}A`,
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${noncanonical}`,
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=v1.k2.${canonicalPayload}=.${'A'.repeat(43)}`,
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${valid}; ${FORMAL_SERVER_SESSION_COOKIE_V1}=${valid}`,
      `${FORMAL_SERVER_SESSION_COOKIE_V1}=${'x'.repeat(4097)}`,
    ];
    for (const cookieHeader of cases) {
      await expect(resolver({ cookieHeader }).resolveCurrentRequest()).resolves.toEqual({
        kind: 'rejected',
        code: 'provenance_invalid',
      });
    }
  });

  it('rejects extra, missing, wrong-source, unsafe-id and invalid-time payloads', async () => {
    const cases: Record<string, unknown>[] = [
      { ...payload, role: 'tenant_admin' },
      Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'accountId')),
      { ...payload, source: 'demo_session' },
      { ...payload, sessionId: 'alice@example.com' },
      { ...payload, tenantId: 'tenant/unsafe' },
      { ...payload, issuedAt: '2026-07-22T08:00:00Z' },
      { ...payload, issuedAt: '2026-07-22T08:03:00.000Z' },
      { ...payload, expiresAt: '2026-07-22T08:00:00.000Z' },
      { ...payload, expiresAt: '2026-07-23T08:00:00.001Z' },
    ];
    for (const value of cases) {
      await expect(
        resolver({
          cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken(value)}`,
        }).resolveCurrentRequest(),
      ).resolves.toEqual({ kind: 'rejected', code: 'provenance_invalid' });
    }
  });

  it('distinguishes expiry at the exact boundary', async () => {
    const expiredToken = signToken({
      ...payload,
      expiresAt: '2026-07-22T08:02:00.000Z',
    });
    await expect(
      resolver({
        cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${expiredToken}`,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'provenance_expired' });
  });

  it('maps known missing material, invalid key-ring, clock and codec failures to unavailable', async () => {
    const missingMaterial = keyRing({
      currentKey: { keyVersion: 2, keyMaterial: null },
    });
    const duplicateVersion = keyRing({
      verifyOnlyKeys: [
        {
          keyVersion: 2,
          keyMaterial: OLD_SESSION_KEY,
          verifyUntil: '2026-07-22T08:30:00.000Z',
        },
      ],
    });
    for (const sessionKeyRing of [missingMaterial, duplicateVersion]) {
      await expect(resolver({ sessionKeyRing }).resolveCurrentRequest()).resolves.toEqual({
        kind: 'unavailable',
        code: 'provenance_unavailable',
      });
    }
    await expect(
      resolver({
        now: () => {
          throw new Error('clock secret');
        },
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
  });

  it('rejects unknown keys before clock use but treats a known missing key as unavailable', async () => {
    const now = vi.fn(() => {
      throw new Error('clock must not run');
    });
    const unknown = signToken(payload, { keyVersion: 9 });
    await expect(
      resolver({
        cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${unknown}`,
        now,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'provenance_invalid' });
    expect(now).not.toHaveBeenCalled();

    const knownWithoutMaterial = keyRing({
      currentKey: { keyVersion: 2, keyMaterial: null },
    });
    await expect(
      resolver({
        sessionKeyRing: knownWithoutMaterial,
        now,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
    expect(now).toHaveBeenCalledTimes(1);
  });

  it('rejects a retired verify-only key before checking its missing material', async () => {
    const oldToken = signToken(payload, {
      keyVersion: 1,
      keyMaterial: OLD_SESSION_KEY,
    });
    const ringWithMissingOldMaterial = keyRing({
      verifyOnlyKeys: [
        {
          keyVersion: 1,
          keyMaterial: null,
          verifyUntil: '2026-07-22T08:30:00.000Z',
        },
      ],
    });
    await expect(
      resolver({
        cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${oldToken}`,
        sessionKeyRing: ringWithMissingOldMaterial,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
    await expect(
      resolver({
        cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${oldToken}`,
        sessionKeyRing: ringWithMissingOldMaterial,
        now: () => new Date('2026-07-22T08:30:00.000Z'),
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'rejected', code: 'provenance_invalid' });
  });

  it('rejects hostile key rings and codecs without invoking getters or Proxy traps', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const accessorRing = keyRing() as Record<string, unknown>;
    Object.defineProperty(accessorRing, 'currentKey', {
      enumerable: true,
      get() {
        getterReads += 1;
        return { keyVersion: 2, keyMaterial: SESSION_KEY };
      },
    });
    const proxyRing = new Proxy(keyRing(), {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('key-ring trap');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('key-ring trap');
      },
    });
    const proxyCodec = new Proxy(referenceCodec(), {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('codec trap');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('codec trap');
      },
    });

    for (const sessionKeyRing of [accessorRing, proxyRing]) {
      await expect(
        createFormalServerSessionProvenanceResolverV1({
          cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
          sessionKeyRing: sessionKeyRing as never,
          referenceCodec: referenceCodec(),
          now: () => VERIFIED_AT,
        }).resolveCurrentRequest(),
      ).resolves.toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
    }
    await expect(
      createFormalServerSessionProvenanceResolverV1({
        cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
        sessionKeyRing: keyRing(),
        referenceCodec: proxyCodec,
        now: () => VERIFIED_AT,
      }).resolveCurrentRequest(),
    ).resolves.toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('copies key material before caller mutation', async () => {
    const mutableKey = Uint8Array.from(SESSION_KEY);
    const owner = resolver({
      sessionKeyRing: keyRing({
        currentKey: { keyVersion: 2, keyMaterial: mutableKey },
      }),
    });
    mutableKey.fill(0);
    expect((await owner.resolveCurrentRequest()).kind).toBe('verified');
  });

  it('snapshots exact inputs without invoking accessors or Proxy traps', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor = {
      cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
      sessionKeyRing: keyRing(),
      referenceCodec: referenceCodec(),
      now: () => VERIFIED_AT,
    };
    Object.defineProperty(accessor, 'cookieHeader', {
      enumerable: true,
      get() {
        getterReads += 1;
        return null;
      },
    });
    const proxy = new Proxy({
      cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
      sessionKeyRing: keyRing(),
      referenceCodec: referenceCodec(),
      now: () => VERIFIED_AT,
    }, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('hostile input');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('hostile input');
      },
    });
    for (const input of [accessor, proxy]) {
      const result = await createFormalServerSessionProvenanceResolverV1(
        input as never,
      ).resolveCurrentRequest();
      expect(result).toEqual({ kind: 'unavailable', code: 'provenance_unavailable' });
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('returns frozen low-sensitive decisions and never exposes raw session facts or keys', async () => {
    const result = await resolver().resolveCurrentRequest();
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === 'verified') expect(Object.isFrozen(result.evidence)).toBe(true);
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      payload.sessionId,
      payload.accountId,
      Buffer.from(SESSION_KEY).toString('hex'),
      'tenant_admin',
      'email',
      'phone',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('has no demo decoder, environment, route, database or external surface', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'src/modules/auth/server/formal-server-session-provenance-owner.ts'),
      'utf8',
    );
    for (const forbidden of [
      'process.env',
      'ZMTG_DEMO_SESSION_SECRET',
      'decodeDemoSession',
      'inertReferenceCodec',
      "from 'next/",
      'fetch(',
      'drizzle',
      'DATABASE_URL',
      'role:',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
