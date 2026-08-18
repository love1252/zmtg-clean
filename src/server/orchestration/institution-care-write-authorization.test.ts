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
  authorizeAction: vi.fn(),
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
  isPolicyAllow: vi.fn(),
  resolveForSession: vi.fn(),
  resolveRuntimeConfig: vi.fn(),
  verifyClaims: vi.fn(),
}));

vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock(
  '@/modules/auth/server/formal-server-session-provenance-owner',
  () => ({
    FORMAL_SERVER_SESSION_COOKIE_V1: 'zmtg_formal_session_v1',
    consumeFormalServerSessionVerifiedClaimsV1:
      mocks.consumeClaims,
    verifyFormalServerSessionCookieClaimsV1:
      mocks.verifyClaims,
  }),
);
vi.mock(
  '@/modules/auth/application/formal-institution-session-context',
  () => ({
    consumeFormalServerSessionUserSnapshotV1:
      mocks.consumeSnapshot,
    createFormalInstitutionSessionContextResolverV1:
      mocks.createResolver,
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
vi.mock(
  '@/modules/security/server/institution-action-policy',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import(
        '@/modules/security/server/institution-action-policy'
      )
    >()),
    createInstitutionActionPolicyV1: () =>
      Object.freeze({
        authorize: mocks.authorizeAction,
      }),
    isInstitutionActionPolicyAllowV1:
      mocks.isPolicyAllow,
  }),
);

import {
  consumeInstitutionCareWriteAuthorizationV1,
  isInstitutionCareWriteAuthorizationHandleV1,
  resolveInstitutionCareWriteAuthorizationV1,
  type InstitutionCareWriteAuthorizationResolutionV1,
} from '@/server/orchestration/institution-care-write-authorization';

const claims = Object.freeze({
  accountId: 'account-001',
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});
const formalSnapshot = Object.freeze({
  opaque: 'snapshot',
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
  vi.spyOn(Date, 'now').mockReturnValue(
    new Date('2026-08-17T15:30:00.000Z').getTime(),
  );
  Object.values(mocks).forEach((mock) => mock.mockReset());

  mocks.resolveRuntimeConfig.mockReturnValue(
    Object.freeze({
      kind: 'available',
      formalServerSessionKeyRing:
        Object.freeze({ key: 'test' }),
      institutionGuardReferenceKeyRing:
        Object.freeze({ key: 'test' }),
    }),
  );
  mocks.headerGet.mockReturnValue(
    'zmtg_formal_session_v1=signed-cookie',
  );
  mocks.headers.mockResolvedValue(
    Object.freeze({ get: mocks.headerGet }),
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
  mocks.authorizeAction.mockReturnValue(
    Object.freeze({
      kind: 'allowed',
      objectType: 'care_task',
      action: 'update',
    }),
  );
  mocks.isPolicyAllow.mockReturnValue(true);
  resolveRole('tenant_admin');
});

describe('Care formal write authorization', () => {
  it('has no caller input and resolves only from formal provenance chain', async () => {
    expectTypeOf<
      Parameters<typeof resolveInstitutionCareWriteAuthorizationV1>
    >().toEqualTypeOf<[]>();
    expectTypeOf<
      ReturnType<typeof resolveInstitutionCareWriteAuthorizationV1>
    >().toEqualTypeOf<
      Promise<InstitutionCareWriteAuthorizationResolutionV1>
    >();

    await expect(
      resolveInstitutionCareWriteAuthorizationV1(),
    ).resolves.toMatchObject({ kind: 'allowed' });

    expect(mocks.verifyClaims).toHaveBeenCalledWith(
      expect.objectContaining({
        cookieHeader:
          'zmtg_formal_session_v1=signed-cookie',
      }),
    );
    expect(mocks.resolveForSession).toHaveBeenCalledWith(
      claims,
    );
  });

  it.each(institutionRoles)(
    '%s requires care section plus care_task/update policy',
    async (role) => {
      mocks.consumeSnapshot.mockReset();
      mocks.resolveForSession.mockReset();
      resolveRole(role);

      const result =
        await resolveInstitutionCareWriteAuthorizationV1();
      expect(result.kind).toBe('allowed');
      expect(mocks.isAudienceAllowed).toHaveBeenCalledWith(
        role,
        'care',
      );
      expect(mocks.authorizeAction).toHaveBeenCalledWith({
        objectType: 'care_task',
        action: 'update',
        role,
      });
    },
  );

  it('mints an opaque frozen exactly-once actor/pair handle', async () => {
    const result =
      await resolveInstitutionCareWriteAuthorizationV1();
    if (result.kind !== 'allowed') {
      throw new Error('expected allowed');
    }

    expect(Object.isFrozen(result.authorization)).toBe(true);
    expect(Reflect.ownKeys(result.authorization)).toEqual([]);
    expect(
      isInstitutionCareWriteAuthorizationHandleV1(
        result.authorization,
      ),
    ).toBe(true);

    expect(
      consumeInstitutionCareWriteAuthorizationV1(
        result.authorization,
      ),
    ).toEqual({
      accountId: 'account-001',
      displayName: '当前用户',
      role: 'tenant_admin',
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      observedAt: '2026-08-17T15:30:00.000Z',
    });
    expect(
      consumeInstitutionCareWriteAuthorizationV1(
        result.authorization,
      ),
    ).toBeNull();
  });

  it('wrong audience or action policy denial is forbidden', async () => {
    mocks.isAudienceAllowed.mockReturnValueOnce(false);
    await expect(
      resolveInstitutionCareWriteAuthorizationV1(),
    ).resolves.toEqual({ kind: 'forbidden' });
    expect(mocks.authorizeAction).not.toHaveBeenCalled();

    mocks.consumeSnapshot.mockReset();
    mocks.resolveForSession.mockReset();
    resolveRole('tenant_admin');
    mocks.isPolicyAllow.mockReturnValueOnce(false);

    await expect(
      resolveInstitutionCareWriteAuthorizationV1(),
    ).resolves.toEqual({ kind: 'forbidden' });
  });

  it('pair or membership-role mismatch fails closed', async () => {
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
      resolveInstitutionCareWriteAuthorizationV1(),
    ).resolves.toEqual({ kind: 'unavailable' });
  });

  it('plain, clone, and Proxy cannot forge the handle', () => {
    for (const value of [
      {},
      Object.freeze({}),
      new Proxy({}, {}),
    ]) {
      expect(
        isInstitutionCareWriteAuthorizationHandleV1(value),
      ).toBe(false);
      expect(
        consumeInstitutionCareWriteAuthorizationV1(value),
      ).toBeNull();
    }
  });
});
