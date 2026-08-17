import {
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';

const resolverOwners = vi.hoisted(() => new WeakSet<object>());
const mocks = vi.hoisted(() => ({
  consumeClaims: vi.fn(),
  consumeSnapshot: vi.fn(),
  createIdentityReader: vi.fn(),
  createMembershipReader: vi.fn(),
  createResolver: vi.fn(),
  createScopeReader: vi.fn(),
  headerGet: vi.fn(),
  headers: vi.fn(),
  isAudienceAllowed: vi.fn(),
  isInstitutionRole: vi.fn(),
  resolveForSession: vi.fn(),
  resolveRuntimeConfig: vi.fn(),
  verifyClaims: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock(
  '@/modules/auth/server/formal-server-session-provenance-owner',
  () => ({
    FORMAL_SERVER_SESSION_COOKIE_V1: 'zmtg_formal_session_v1',
    consumeFormalServerSessionVerifiedClaimsV1: mocks.consumeClaims,
    verifyFormalServerSessionCookieClaimsV1: mocks.verifyClaims,
  }),
);

vi.mock(
  '@/modules/auth/application/formal-institution-session-context',
  () => ({
    consumeFormalServerSessionUserSnapshotV1: mocks.consumeSnapshot,
    createFormalInstitutionSessionContextResolverV1: mocks.createResolver,
    isFormalInstitutionSessionContextResolverV1(value: unknown) {
      return (
        value !== null
        && typeof value === 'object'
        && resolverOwners.has(value)
      );
    },
  }),
);

vi.mock(
  '@/modules/auth/application/authoritative-formal-session-identity-reader',
  () => ({
    createIdentityAuthoritativeFormalSessionIdentityFactReaderV1:
      mocks.createIdentityReader,
  }),
);

vi.mock(
  '@/modules/access-control/application/authoritative-membership-reader',
  () => ({
    createAccessControlAuthoritativeMembershipFactReaderV1:
      mocks.createMembershipReader,
  }),
);

vi.mock(
  '@/modules/tenancy/application/authoritative-institution-scope-reader',
  () => ({
    createTenancyAuthoritativeInstitutionScopeFactReaderV1:
      mocks.createScopeReader,
  }),
);

vi.mock(
  '@/modules/security/server/institution-guard-runtime-config',
  () => ({
    resolveInstitutionGuardRuntimeConfigV1:
      mocks.resolveRuntimeConfig,
  }),
);

vi.mock(
  '@/modules/institution-contracts/v1/institution-navigation',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import(
        '@/modules/institution-contracts/v1/institution-navigation'
      )
    >()),
    isInstitutionRoleV1: mocks.isInstitutionRole,
    isRoleInInstitutionSectionAudienceV1:
      mocks.isAudienceAllowed,
  }),
);

import {
  consumeInstitutionAnalyticsReadAuthorizationV1,
  isInstitutionAnalyticsReadAuthorizationHandleV1,
  resolveInstitutionAnalyticsReadAuthorizationV1,
  type InstitutionAnalyticsReadAuthorizationResolutionV1,
} from '@/server/orchestration/institution-analytics-read-authorization';

const claims = Object.freeze({
  accountId: 'account-001',
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});

const formalSnapshot = Object.freeze({
  opaque: 'formal-session-snapshot',
});

const resolver = Object.freeze({
  resolveForSession: mocks.resolveForSession,
});

const institutionRoles = [
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
] as const;

function user(role: string) {
  return Object.freeze({
    id: claims.accountId,
    username: 'current_user',
    name: '当前用户',
    role,
    tenantId: claims.tenantId,
    institutionId: claims.institutionId,
  });
}

function membership(role: string) {
  return Object.freeze({
    id: 'membership-001',
    tenantId: claims.tenantId,
    role,
  });
}

function resolveRole(role: string) {
  mocks.consumeSnapshot.mockReturnValueOnce(user(role));
  mocks.resolveForSession.mockResolvedValueOnce(
    Object.freeze({
      kind: 'resolved',
      snapshot: formalSnapshot,
      membershipAudit: membership(role),
    }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  Object.values(mocks).forEach((mock) => mock.mockReset());

  vi.spyOn(Date, 'now').mockReturnValue(
    new Date('2026-08-16T08:00:00.000Z').getTime(),
  );

  mocks.resolveRuntimeConfig.mockReturnValue(
    Object.freeze({
      kind: 'available',
      formalServerSessionKeyRing: Object.freeze({
        key: 'test',
      }),
      institutionGuardReferenceKeyRing: Object.freeze({
        key: 'test',
      }),
    }),
  );

  mocks.headerGet.mockReturnValue(
    'zmtg_formal_session_v1=signed-cookie',
  );
  mocks.headers.mockResolvedValue(
    Object.freeze({
      get: mocks.headerGet,
    }),
  );

  mocks.verifyClaims.mockReturnValue(
    Object.freeze({
      kind: 'verified',
      verifiedClaims: Object.freeze({}),
    }),
  );
  mocks.consumeClaims.mockReturnValue(claims);

  mocks.createIdentityReader.mockReturnValue(
    Object.freeze({ owner: 'identity' }),
  );
  mocks.createMembershipReader.mockReturnValue(
    Object.freeze({ owner: 'membership' }),
  );
  mocks.createScopeReader.mockReturnValue(
    Object.freeze({ owner: 'scope' }),
  );

  resolverOwners.add(resolver);
  mocks.createResolver.mockReturnValue(resolver);

  mocks.isInstitutionRole.mockImplementation((role) =>
    institutionRoles.some((candidate) => candidate === role),
  );
  mocks.isAudienceAllowed.mockReturnValue(true);

  resolveRole('tenant_admin');
});

describe('Analytics overview formal read authorization', () => {
  it('无 caller scope 输入，并使用 formal identity/membership/binding/scope chain', async () => {
    expectTypeOf<
      Parameters<typeof resolveInstitutionAnalyticsReadAuthorizationV1>
    >().toEqualTypeOf<[]>();

    expectTypeOf<
      ReturnType<typeof resolveInstitutionAnalyticsReadAuthorizationV1>
    >().toEqualTypeOf<
      Promise<InstitutionAnalyticsReadAuthorizationResolutionV1>
    >();

    await expect(
      resolveInstitutionAnalyticsReadAuthorizationV1(),
    ).resolves.toMatchObject({
      kind: 'allowed',
    });

    expect(mocks.verifyClaims).toHaveBeenCalledWith(
      expect.objectContaining({
        cookieHeader: 'zmtg_formal_session_v1=signed-cookie',
      }),
    );
    expect(mocks.resolveForSession).toHaveBeenCalledWith(claims);
  });

  it.each(['tenant_admin', 'tenant_operator'] as const)(
    '%s 可以获得 dedicated Analytics overview readonly authorization',
    async (role) => {
      mocks.consumeSnapshot.mockReset();
      mocks.resolveForSession.mockReset();
      resolveRole(role);

      const result =
        await resolveInstitutionAnalyticsReadAuthorizationV1();

      expect(result.kind).toBe('allowed');
      expect(mocks.isAudienceAllowed).toHaveBeenCalledWith(
        role,
        'analytics',
      );
    },
  );

  it.each(['consultant', 'customer_service'] as const)(
    '%s 即使被伪造为 analytics section audience 也不能读取 Analytics overview',
    async (role) => {
      mocks.consumeSnapshot.mockReset();
      mocks.resolveForSession.mockReset();
      resolveRole(role);

      await expect(
        resolveInstitutionAnalyticsReadAuthorizationV1(),
      ).resolves.toEqual({
        kind: 'forbidden',
      });
    },
  );

  it('analytics section audience denial 直接 forbidden', async () => {
    mocks.isAudienceAllowed.mockReturnValueOnce(false);

    await expect(
      resolveInstitutionAnalyticsReadAuthorizationV1(),
    ).resolves.toEqual({
      kind: 'forbidden',
    });
  });

  it('签发 opaque、frozen、genuine、one-shot exact pair handle', async () => {
    const result =
      await resolveInstitutionAnalyticsReadAuthorizationV1();

    if (result.kind !== 'allowed') {
      throw new Error('expected allowed');
    }

    expect(Object.isFrozen(result.authorization)).toBe(true);
    expect(Reflect.ownKeys(result.authorization)).toEqual([]);
    expect(
      isInstitutionAnalyticsReadAuthorizationHandleV1(
        result.authorization,
      ),
    ).toBe(true);

    expect(
      consumeInstitutionAnalyticsReadAuthorizationV1(
        result.authorization,
      ),
    ).toEqual({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      observedAt: '2026-08-16T08:00:00.000Z',
    });

    expect(
      consumeInstitutionAnalyticsReadAuthorizationV1(
        result.authorization,
      ),
    ).toBeNull();
  });

  it.each(['denied', 'invalid', 'unavailable', 'stale'])(
    'formal context %s 不可信时 unavailable',
    async (kind) => {
      mocks.resolveForSession.mockReset();
      mocks.resolveForSession.mockResolvedValueOnce(
        Object.freeze({ kind }),
      );

      await expect(
        resolveInstitutionAnalyticsReadAuthorizationV1(),
      ).resolves.toEqual({
        kind: 'unavailable',
      });

      expect(mocks.consumeSnapshot).not.toHaveBeenCalled();
    },
  );

  it('session/binding/scope pair 或 membership role mismatch fail-closed', async () => {
    mocks.consumeSnapshot.mockReset();
    mocks.resolveForSession.mockReset();

    mocks.consumeSnapshot.mockReturnValueOnce({
      ...user('tenant_admin'),
      institutionId: 'institution-other',
    });

    mocks.resolveForSession.mockResolvedValueOnce(
      Object.freeze({
        kind: 'resolved',
        snapshot: formalSnapshot,
        membershipAudit: membership('tenant_operator'),
      }),
    );

    await expect(
      resolveInstitutionAnalyticsReadAuthorizationV1(),
    ).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('invalid formal session 与异常统一为低敏 unavailable', async () => {
    mocks.verifyClaims.mockReturnValueOnce(
      Object.freeze({
        kind: 'source_denied',
      }),
    );

    await expect(
      resolveInstitutionAnalyticsReadAuthorizationV1(),
    ).resolves.toEqual({
      kind: 'unavailable',
    });

    expect(mocks.resolveForSession).not.toHaveBeenCalled();

    mocks.verifyClaims.mockReturnValue(
      Object.freeze({
        kind: 'verified',
        verifiedClaims: Object.freeze({}),
      }),
    );

    mocks.resolveForSession.mockReset();
    mocks.resolveForSession.mockRejectedValueOnce(
      new Error('database secret'),
    );

    await expect(
      resolveInstitutionAnalyticsReadAuthorizationV1(),
    ).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('plain、clone 与 Proxy 都不能伪造 authorization handle', () => {
    for (const value of [
      {},
      Object.freeze({}),
      new Proxy({}, {}),
    ]) {
      expect(
        isInstitutionAnalyticsReadAuthorizationHandleV1(value),
      ).toBe(false);
      expect(
        consumeInstitutionAnalyticsReadAuthorizationV1(value),
      ).toBeNull();
    }
  });
});
