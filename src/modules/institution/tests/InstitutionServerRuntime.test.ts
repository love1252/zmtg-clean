import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { CurrentInstitutionMembershipFactRow } from '@/modules/auth/server/auth-account-repository';
import { FORMAL_SERVER_SESSION_COOKIE_V1 } from '@/modules/auth/server/formal-server-session-provenance-owner';
import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import type { CurrentInstitutionAnchorFactRowV1 } from '@/modules/security/server/institution-anchor-repository';
import * as requestAuthorization from '@/modules/security/server/institution-request-authorization';
import {
  isInstitutionRequestAuthorizationV1,
  type InstitutionRequestAuthorizationV1,
} from '@/modules/security/server/institution-request-authorization';
import { isInstitutionSectionAllowV1 } from '@/modules/security/server/institution-section-guard';

const runtimeMocks = vi.hoisted(() => ({
  anchorRead: vi.fn(),
  cookieGet: vi.fn(),
  cookies: vi.fn(),
  createAuthAccountRepository: vi.fn(),
  createInstitutionAnchorFactRepositoryV1: vi.fn(),
  getDatabase: vi.fn(),
  membershipRead: vi.fn(),
  resolveInstitutionGuardRuntimeConfigV1: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: runtimeMocks.cookies }));

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return { ...actual, getDatabase: runtimeMocks.getDatabase };
});

vi.mock('@/modules/auth/server/auth-account-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/auth/server/auth-account-repository')>();
  return {
    ...actual,
    createAuthAccountRepository: runtimeMocks.createAuthAccountRepository,
  };
});

vi.mock(
  '@/modules/security/server/institution-anchor-repository',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/security/server/institution-anchor-repository')
      >();
    return {
      ...actual,
      createInstitutionAnchorFactRepositoryV1:
        runtimeMocks.createInstitutionAnchorFactRepositoryV1,
    };
  },
);

vi.mock(
  '@/modules/security/server/institution-guard-runtime-config',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/security/server/institution-guard-runtime-config')
      >();
    return {
      ...actual,
      resolveInstitutionGuardRuntimeConfigV1:
        runtimeMocks.resolveInstitutionGuardRuntimeConfigV1,
    };
  },
);

const NOW = new Date('2026-07-22T08:02:00.000Z');
const SESSION_KEY = new Uint8Array(32).fill(0x73);
const SESSION_CURRENT_KEY = new Uint8Array(32).fill(0x74);
const SESSION_OLD_KEY = new Uint8Array(32).fill(0x75);
const REFERENCE_KEY = new Uint8Array(32).fill(0x72);
const REFERENCE_OLD_KEY = new Uint8Array(32).fill(0x71);
const SESSION_PROTOCOL = 'zmtg.formal-server-session-cookie.v1';
const FUTURE_VERIFY_UNTIL = '2026-07-22T08:12:00.000Z';
const database = Object.freeze({ kind: 'database' });
const payload = Object.freeze({
  source: 'server_session' as const,
  sessionId: 'session-server-runtime-001',
  accountId: 'account-server-runtime-001',
  tenantId: 'tenant-server-runtime-001',
  institutionId: 'institution-server-runtime-001',
  issuedAt: '2026-07-22T08:00:00.000Z',
  expiresAt: '2026-07-22T09:00:00.000Z',
});

const membershipRow: CurrentInstitutionMembershipFactRow = {
  accountId: payload.accountId,
  accountStatus: 'active',
  accountPasswordResetRequired: false,
  accountLockedUntil: null,
  membershipId: 'membership-server-runtime-001',
  membershipTenantId: payload.tenantId,
  membershipUserId: payload.accountId,
  membershipRole: 'tenant_admin',
  membershipUpdatedAt: new Date('2026-07-22T08:01:00.000Z'),
  bindingId: 'binding-server-runtime-001',
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

const anchorRow: CurrentInstitutionAnchorFactRowV1 = {
  tenantId: payload.tenantId,
  institutionId: payload.institutionId,
  status: 'active',
  revision: 1,
};

function signToken() {
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${SESSION_PROTOCOL}\n2\n${payloadSegment}`;
  const tag = createHmac('sha256', SESSION_KEY)
    .update(signingInput)
    .digest('base64url');
  return `v1.k2.${payloadSegment}.${tag}`;
}

type VerifyOnlyKeyFixture = Readonly<{
  keyVersion: number;
  keyMaterial: Uint8Array;
  verifyUntil: string;
}>;

type RuntimeConfigFixtureOptions = Readonly<{
  formalCurrentKey?: Readonly<{
    keyVersion: number;
    keyMaterial: Uint8Array;
  }>;
  formalVerifyOnlyKeys?: readonly VerifyOnlyKeyFixture[];
  guardCurrentKey?: Readonly<{
    keyVersion: number;
    keyMaterial: Uint8Array;
  }>;
  guardVerifyOnlyKeys?: readonly VerifyOnlyKeyFixture[];
}>;

function frozenVerifyOnlyKeys(
  entries: readonly VerifyOnlyKeyFixture[] = [],
) {
  return Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
}

function availableRuntimeConfig(options: RuntimeConfigFixtureOptions = {}) {
  return Object.freeze({
    kind: 'available' as const,
    formalServerSessionKeyRing: Object.freeze({
      currentKey: Object.freeze(
        options.formalCurrentKey ?? {
          keyVersion: 2,
          keyMaterial: SESSION_KEY,
        },
      ),
      verifyOnlyKeys: frozenVerifyOnlyKeys(options.formalVerifyOnlyKeys),
    }),
    institutionGuardReferenceKeyRing: Object.freeze({
      currentIssueKey: Object.freeze(
        options.guardCurrentKey ?? {
          keyVersion: 1,
          keyMaterial: REFERENCE_KEY,
        },
      ),
      verifyOnlyKeys: frozenVerifyOnlyKeys(options.guardVerifyOnlyKeys),
    }),
  });
}

function expectNoCookieOrPersistence() {
  expect(runtimeMocks.cookies).not.toHaveBeenCalled();
  expect(runtimeMocks.cookieGet).not.toHaveBeenCalled();
  expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
  expect(runtimeMocks.createAuthAccountRepository).not.toHaveBeenCalled();
  expect(runtimeMocks.createInstitutionAnchorFactRepositoryV1).not.toHaveBeenCalled();
  expect(runtimeMocks.membershipRead).not.toHaveBeenCalled();
  expect(runtimeMocks.anchorRead).not.toHaveBeenCalled();
}

async function authorizeWorkbench(
  authorization: InstitutionRequestAuthorizationV1,
) {
  return authorization.authorizeCurrentInstitutionSectionV1({
    sectionId: 'workbench',
  });
}

describe('BASE-RUNTIME-01 institution server authorization root', () => {
  beforeEach(() => {
    for (const mock of Object.values(runtimeMocks)) mock.mockClear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
    runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValue(
      availableRuntimeConfig(),
    );
    runtimeMocks.cookies.mockResolvedValue({ get: runtimeMocks.cookieGet });
    runtimeMocks.cookieGet.mockReturnValue({
      name: FORMAL_SERVER_SESSION_COOKIE_V1,
      value: signToken(),
    });
    runtimeMocks.getDatabase.mockReturnValue(database);
    runtimeMocks.membershipRead.mockResolvedValue([membershipRow]);
    runtimeMocks.anchorRead.mockResolvedValue([anchorRow]);
    runtimeMocks.createAuthAccountRepository.mockReturnValue({
      findCurrentInstitutionMembershipFacts: runtimeMocks.membershipRead,
    });
    runtimeMocks.createInstitutionAnchorFactRepositoryV1.mockReturnValue({
      findCurrentInstitutionAnchorFacts: runtimeMocks.anchorRead,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes one no-input resolver and returns only a genuine opaque authorization', async () => {
    expectTypeOf<
      Parameters<typeof resolveInstitutionServerAuthorizationV1>
    >().toEqualTypeOf<[]>();
    expectTypeOf<
      ReturnType<typeof resolveInstitutionServerAuthorizationV1>
    >().toEqualTypeOf<Promise<InstitutionRequestAuthorizationV1 | null>>();

    const authorization = await resolveInstitutionServerAuthorizationV1();

    expect(isInstitutionRequestAuthorizationV1(authorization)).toBe(true);
    expect(Object.isFrozen(authorization)).toBe(true);
    expect(Reflect.ownKeys(authorization as object)).toEqual([
      'authorizeCurrentInstitutionSectionV1',
      'authorizeCurrentInstitutionNavigationV1',
    ]);
    expect(JSON.stringify(authorization)).toBe('{}');
    expect(runtimeMocks.resolveInstitutionGuardRuntimeConfigV1).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.cookies).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.cookieGet).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.cookieGet).toHaveBeenCalledWith(
      FORMAL_SERVER_SESSION_COOKIE_V1,
    );
    expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();

    if (!authorization) throw new Error('expected genuine authorization');
    const result = await authorizeWorkbench(authorization);
    expect(isInstitutionSectionAllowV1(result)).toBe(true);
    expect(runtimeMocks.getDatabase).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createAuthAccountRepository).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.membershipRead).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createInstitutionAnchorFactRepositoryV1).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.anchorRead).toHaveBeenCalledTimes(1);
  });

  it('keeps exact accepted key rotation config compatible', async () => {
    runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValueOnce(
      availableRuntimeConfig({
        formalCurrentKey: {
          keyVersion: 3,
          keyMaterial: SESSION_CURRENT_KEY,
        },
        formalVerifyOnlyKeys: [
          {
            keyVersion: 2,
            keyMaterial: SESSION_KEY,
            verifyUntil: FUTURE_VERIFY_UNTIL,
          },
          {
            keyVersion: 1,
            keyMaterial: SESSION_OLD_KEY,
            verifyUntil: FUTURE_VERIFY_UNTIL,
          },
        ],
      }),
    );
    const authorization = await resolveInstitutionServerAuthorizationV1();
    expect(isInstitutionRequestAuthorizationV1(authorization)).toBe(true);
    if (!authorization) throw new Error('expected rotated authorization');
    await expect(authorizeWorkbench(authorization)).resolves.toMatchObject({
      kind: 'institution_section_allow',
    });
  });

  it.each(['unavailable', 'throw'] as const)(
    'rejects %s config before cookies and persistence',
    async (runtimeCase) => {
      if (runtimeCase === 'throw') {
        runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockImplementationOnce(
          () => {
            throw new Error('runtime config unavailable');
          },
        );
      } else {
        runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValueOnce({
          kind: 'unavailable',
        });
      }

      await expect(resolveInstitutionServerAuthorizationV1()).resolves.toBeNull();
      expectNoCookieOrPersistence();
    },
  );

  it.each([
    ['proxy', () => new Proxy(availableRuntimeConfig(), {})],
    [
      'nested clone',
      () => {
        const config = availableRuntimeConfig();
        return Object.freeze({
          ...config,
          formalServerSessionKeyRing: {
            ...config.formalServerSessionKeyRing,
          },
        });
      },
    ],
    [
      'extra',
      () => Object.freeze({ ...availableRuntimeConfig(), extra: true }),
    ],
    [
      'symbol',
      () => Object.freeze(
        Object.assign(
          { ...availableRuntimeConfig() },
          { [Symbol('config')]: true },
        ),
      ),
    ],
    [
      'nonplain',
      () => Object.freeze(
        Object.assign(Object.create({ inherited: true }), availableRuntimeConfig()),
      ),
    ],
  ] as const)(
    'rejects deep-exact config %s before cookies',
    async (_label, createConfig) => {
      runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValueOnce(
        createConfig() as never,
      );
      await expect(resolveInstitutionServerAuthorizationV1()).resolves.toBeNull();
      expectNoCookieOrPersistence();
    },
  );

  it('rejects config accessors and revoked proxies without getter or trap access', async () => {
    let getterReads = 0;
    let traps = 0;
    const config = availableRuntimeConfig();
    const accessor = Object.freeze(
      Object.defineProperties({}, {
        kind: {
          enumerable: true,
          get() {
            getterReads += 1;
            throw new Error('config getter');
          },
        },
        formalServerSessionKeyRing: {
          enumerable: true,
          value: config.formalServerSessionKeyRing,
        },
        institutionGuardReferenceKeyRing: {
          enumerable: true,
          value: config.institutionGuardReferenceKeyRing,
        },
      }),
    );
    const revoked = Proxy.revocable(config, {
      getPrototypeOf() {
        traps += 1;
        throw new Error('config proxy trap');
      },
    });
    revoked.revoke();

    for (const value of [accessor, revoked.proxy]) {
      runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValueOnce(
        value as never,
      );
      await expect(resolveInstitutionServerAuthorizationV1()).resolves.toBeNull();
    }
    expect(getterReads).toBe(0);
    expect(traps).toBe(0);
    expectNoCookieOrPersistence();
  });

  it.each([
    [
      'unsupported guard current version',
      () => availableRuntimeConfig({
        guardCurrentKey: { keyVersion: 999, keyMaterial: REFERENCE_KEY },
      }),
    ],
    [
      'non-accepted guard verify version',
      () => availableRuntimeConfig({
        guardVerifyOnlyKeys: [{
          keyVersion: 999,
          keyMaterial: REFERENCE_OLD_KEY,
          verifyUntil: FUTURE_VERIFY_UNTIL,
        }],
      }),
    ],
    [
      'formal verify version not older',
      () => availableRuntimeConfig({
        formalVerifyOnlyKeys: [{
          keyVersion: 3,
          keyMaterial: SESSION_OLD_KEY,
          verifyUntil: FUTURE_VERIFY_UNTIL,
        }],
      }),
    ],
    [
      'duplicate version',
      () => availableRuntimeConfig({
        guardVerifyOnlyKeys: [{
          keyVersion: 1,
          keyMaterial: REFERENCE_OLD_KEY,
          verifyUntil: FUTURE_VERIFY_UNTIL,
        }],
      }),
    ],
    [
      'expired verify instant',
      () => availableRuntimeConfig({
        formalVerifyOnlyKeys: [{
          keyVersion: 1,
          keyMaterial: SESSION_OLD_KEY,
          verifyUntil: '2026-07-22T08:01:59.999Z',
        }],
      }),
    ],
    [
      'invalid canonical date',
      () => availableRuntimeConfig({
        formalVerifyOnlyKeys: [{
          keyVersion: 1,
          keyMaterial: SESSION_OLD_KEY,
          verifyUntil: '2026-02-30T08:12:00.000Z',
        }],
      }),
    ],
  ] as const)(
    'rejects semantically invalid config: %s',
    async (_label, createConfig) => {
      runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValueOnce(
        createConfig(),
      );
      await expect(resolveInstitutionServerAuthorizationV1()).resolves.toBeNull();
      expectNoCookieOrPersistence();
    },
  );

  it.each(['Date.now', 'Date.parse'] as const)(
    'rejects config when %s throws before cookies',
    async (clockCase) => {
      runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValueOnce(
        availableRuntimeConfig({
          formalVerifyOnlyKeys: [{
            keyVersion: 1,
            keyMaterial: SESSION_OLD_KEY,
            verifyUntil: FUTURE_VERIFY_UNTIL,
          }],
        }),
      );
      if (clockCase === 'Date.now') {
        vi.mocked(Date.now).mockImplementationOnce(() => {
          throw new Error('clock unavailable');
        });
      } else {
        vi.spyOn(Date, 'parse').mockImplementationOnce(() => {
          throw new Error('parser unavailable');
        });
      }
      await expect(resolveInstitutionServerAuthorizationV1()).resolves.toBeNull();
      expectNoCookieOrPersistence();
    },
  );

  it.each(['missing', 'invalid'] as const)(
    'returns a genuine fail-closed authorization for %s cookie without persistence',
    async (cookieCase) => {
      runtimeMocks.cookieGet.mockReturnValueOnce(
        cookieCase === 'missing'
          ? undefined
          : {
              name: FORMAL_SERVER_SESSION_COOKIE_V1,
              value: 'invalid-cookie',
            },
      );
      const authorization = await resolveInstitutionServerAuthorizationV1();
      expect(isInstitutionRequestAuthorizationV1(authorization)).toBe(true);
      expect(runtimeMocks.cookies).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.cookieGet).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.cookieGet).toHaveBeenCalledWith(
        FORMAL_SERVER_SESSION_COOKIE_V1,
      );
      if (!authorization) throw new Error('expected fail-closed authorization');
      await expect(authorizeWorkbench(authorization)).resolves.toEqual({
        kind: 'rejected',
        code: 'scope_unavailable',
      });
      expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
      expect(runtimeMocks.membershipRead).not.toHaveBeenCalled();
      expect(runtimeMocks.anchorRead).not.toHaveBeenCalled();
    },
  );

  it.each(['cookies reject', 'get throw', 'value accessor'] as const)(
    'returns null when cookie boundary fails: %s',
    async (cookieCase) => {
      if (cookieCase === 'cookies reject') {
        runtimeMocks.cookies.mockRejectedValueOnce(new Error('cookies unavailable'));
      } else if (cookieCase === 'get throw') {
        runtimeMocks.cookieGet.mockImplementationOnce(() => {
          throw new Error('cookie get unavailable');
        });
      } else {
        runtimeMocks.cookieGet.mockReturnValueOnce(
          Object.defineProperty({}, 'value', {
            enumerable: true,
            get() {
              throw new Error('cookie value unavailable');
            },
          }),
        );
      }
      await expect(resolveInstitutionServerAuthorizationV1()).resolves.toBeNull();
      expect(runtimeMocks.cookies).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.cookieGet).toHaveBeenCalledTimes(
        cookieCase === 'cookies reject' ? 0 : 1,
      );
      expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
    },
  );

  it.each(['null', 'undefined', 'proxy', 'throw'] as const)(
    'keeps lazy database %s failure sticky and low-sensitive',
    async (databaseCase) => {
      if (databaseCase === 'throw') {
        runtimeMocks.getDatabase.mockImplementationOnce(() => {
          throw new Error('database unavailable');
        });
      } else if (databaseCase === 'proxy') {
        runtimeMocks.getDatabase.mockReturnValueOnce(new Proxy({}, {}) as never);
      } else {
        runtimeMocks.getDatabase.mockReturnValueOnce(
          (databaseCase === 'null' ? null : undefined) as never,
        );
      }
      const authorization = await resolveInstitutionServerAuthorizationV1();
      expect(isInstitutionRequestAuthorizationV1(authorization)).toBe(true);
      expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
      if (!authorization) throw new Error('expected lazy authorization');
      await expect(authorizeWorkbench(authorization)).resolves.toEqual({
        kind: 'rejected',
        code: 'scope_unavailable',
      });
      await expect(
        authorization.authorizeCurrentInstitutionNavigationV1({
          targetSectionId: 'system',
        }),
      ).resolves.toMatchObject({
        targetAccess: 'blocked',
        availableSectionIds: [],
      });
      expect(runtimeMocks.getDatabase).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.createAuthAccountRepository).not.toHaveBeenCalled();
      expect(runtimeMocks.createInstitutionAnchorFactRepositoryV1).not.toHaveBeenCalled();
    },
  );

  it.each(['denied', 'invalid', 'repository throw', 'factory throw'] as const)(
    'stops after membership %s and never reads anchor',
    async (membershipCase) => {
      if (membershipCase === 'denied') {
        runtimeMocks.membershipRead.mockResolvedValueOnce([]);
      } else if (membershipCase === 'invalid') {
        runtimeMocks.membershipRead.mockResolvedValueOnce([
          { ...membershipRow, membershipTenantId: 'tenant-other' },
        ]);
      } else if (membershipCase === 'repository throw') {
        runtimeMocks.membershipRead.mockRejectedValueOnce(
          new Error('membership unavailable'),
        );
      } else {
        runtimeMocks.createAuthAccountRepository.mockImplementationOnce(() => {
          throw new Error('membership repository factory unavailable');
        });
      }
      const authorization = await resolveInstitutionServerAuthorizationV1();
      if (!authorization) throw new Error('expected genuine authorization');
      await expect(authorizeWorkbench(authorization)).resolves.toEqual({
        kind: 'rejected',
        code: 'scope_unavailable',
      });
      expect(runtimeMocks.getDatabase).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.createAuthAccountRepository).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.membershipRead).toHaveBeenCalledTimes(
        membershipCase === 'factory throw' ? 0 : 1,
      );
      expect(runtimeMocks.createInstitutionAnchorFactRepositoryV1).not.toHaveBeenCalled();
      expect(runtimeMocks.anchorRead).not.toHaveBeenCalled();
    },
  );

  it.each(['denied', 'invalid', 'throw'] as const)(
    'reads membership then anchor once and fails closed for anchor %s',
    async (anchorCase) => {
      if (anchorCase === 'denied') {
        runtimeMocks.anchorRead.mockResolvedValueOnce([
          { ...anchorRow, status: 'suspended' },
        ]);
      } else if (anchorCase === 'invalid') {
        runtimeMocks.anchorRead.mockResolvedValueOnce([
          { ...anchorRow, tenantId: 'tenant-other' },
        ]);
      } else {
        runtimeMocks.anchorRead.mockRejectedValueOnce(
          new Error('anchor unavailable'),
        );
      }
      const authorization = await resolveInstitutionServerAuthorizationV1();
      if (!authorization) throw new Error('expected genuine authorization');
      await expect(authorizeWorkbench(authorization)).resolves.toEqual({
        kind: 'rejected',
        code: 'scope_unavailable',
      });
      expect(runtimeMocks.getDatabase).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.membershipRead).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.createInstitutionAnchorFactRepositoryV1).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.anchorRead).toHaveBeenCalledTimes(1);
    },
  );

  it('returns null for fake authorization shapes without getters or proxy traps', async () => {
    const genuine = requestAuthorization.createInstitutionRequestAuthorizationV1(
      {} as never,
    );
    let getterReads = 0;
    let traps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'authorizeCurrentInstitutionSectionV1', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('authorization getter');
      },
    });
    const proxy = new Proxy(genuine, {
      getPrototypeOf() {
        traps += 1;
        throw new Error('authorization proxy trap');
      },
    });
    const revoked = Proxy.revocable(genuine, {});
    revoked.revoke();

    for (const value of [
      {},
      { ...genuine },
      Object.create(genuine) as object,
      accessor,
      proxy,
      revoked.proxy,
    ]) {
      vi.spyOn(
        requestAuthorization,
        'createInstitutionRequestAuthorizationV1',
      ).mockReturnValueOnce(value as InstitutionRequestAuthorizationV1);
      await expect(resolveInstitutionServerAuthorizationV1()).resolves.toBeNull();
      vi.restoreAllMocks();
      vi.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
    }
    expect(getterReads).toBe(0);
    expect(traps).toBe(0);
  });

  it('returns null when authorization composition throws', async () => {
    vi.spyOn(
      requestAuthorization,
      'createInstitutionRequestAuthorizationV1',
    ).mockImplementationOnce(() => {
      throw new Error('authorization composition unavailable');
    });
    await expect(resolveInstitutionServerAuthorizationV1()).resolves.toBeNull();
  });
});
