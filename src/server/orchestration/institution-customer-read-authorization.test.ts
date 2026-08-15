import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

const resolverOwners = vi.hoisted(() => new WeakSet<object>());
const mocks = vi.hoisted(() => ({
  consumeClaims: vi.fn(),
  consumeSnapshot: vi.fn(),
  headerGet: vi.fn(),
  headers: vi.fn(),
  createIdentityReader: vi.fn(),
  createMembershipReader: vi.fn(),
  createResolver: vi.fn(),
  createScopeReader: vi.fn(),
  resolveForSession: vi.fn(),
  resolveRuntimeConfig: vi.fn(),
  verifyClaims: vi.fn(),
}));

vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@/modules/auth/server/formal-server-session-provenance-owner', () => ({
  FORMAL_SERVER_SESSION_COOKIE_V1: 'zmtg_formal_session_v1',
  consumeFormalServerSessionVerifiedClaimsV1: mocks.consumeClaims,
  verifyFormalServerSessionCookieClaimsV1: mocks.verifyClaims,
}));
vi.mock('@/modules/auth/application/formal-institution-session-context', () => ({
  consumeFormalServerSessionUserSnapshotV1: mocks.consumeSnapshot,
  createFormalInstitutionSessionContextResolverV1: mocks.createResolver,
  isFormalInstitutionSessionContextResolverV1(value: unknown) {
    return value !== null && typeof value === 'object' && resolverOwners.has(value);
  },
}));
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
vi.mock('@/modules/security/server/institution-guard-runtime-config', () => ({
  resolveInstitutionGuardRuntimeConfigV1: mocks.resolveRuntimeConfig,
}));

import {
  consumeInstitutionCustomerReadAuthorizationV1,
  isInstitutionCustomerReadAuthorizationHandleV1,
  resolveInstitutionCustomerReadAuthorizationV1,
  type InstitutionCustomerReadAuthorizationResolutionV1,
} from '@/server/orchestration/institution-customer-read-authorization';

const claims = Object.freeze({
  accountId: 'account-001',
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
});
const snapshot = Object.freeze({ opaque: 'snapshot' });
const resolver = Object.freeze({ resolveForSession: mocks.resolveForSession });

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
  return Object.freeze({ id: 'membership-001', tenantId: claims.tenantId, role });
}

function resolveRole(role: string) {
  mocks.consumeSnapshot.mockReturnValueOnce(user(role));
  mocks.resolveForSession.mockResolvedValueOnce(
    Object.freeze({ kind: 'resolved', snapshot, membershipAudit: membership(role) }),
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(Date, 'now').mockReturnValue(
    new Date('2026-08-15T08:00:00.000Z').getTime(),
  );
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.resolveRuntimeConfig.mockReturnValue(
    Object.freeze({
      kind: 'available',
      formalServerSessionKeyRing: Object.freeze({ key: 'test' }),
      institutionGuardReferenceKeyRing: Object.freeze({ key: 'test' }),
    }),
  );
  mocks.headerGet.mockReturnValue('zmtg_formal_session_v1=signed-cookie');
  mocks.headers.mockResolvedValue(Object.freeze({ get: mocks.headerGet }));
  mocks.verifyClaims.mockReturnValue(
    Object.freeze({ kind: 'verified', verifiedClaims: Object.freeze({}) }),
  );
  mocks.consumeClaims.mockReturnValue(claims);
  mocks.createIdentityReader.mockReturnValue(Object.freeze({ owner: 'identity' }));
  mocks.createMembershipReader.mockReturnValue(Object.freeze({ owner: 'membership' }));
  mocks.createScopeReader.mockReturnValue(Object.freeze({ owner: 'scope' }));
  resolverOwners.add(resolver);
  mocks.createResolver.mockReturnValue(resolver);
  resolveRole('tenant_admin');
});

describe('Customers CUS-01 formal read authorization', () => {
  it('无 caller 输入，只使用 formal session provenance 与 authoritative context', async () => {
    expectTypeOf<Parameters<typeof resolveInstitutionCustomerReadAuthorizationV1>>()
      .toEqualTypeOf<[]>();
    expectTypeOf<ReturnType<typeof resolveInstitutionCustomerReadAuthorizationV1>>()
      .toEqualTypeOf<Promise<InstitutionCustomerReadAuthorizationResolutionV1>>();

    await expect(resolveInstitutionCustomerReadAuthorizationV1()).resolves.toMatchObject({
      kind: 'allowed',
    });
    expect(mocks.headerGet).toHaveBeenCalledWith('cookie');
    expect(mocks.verifyClaims).toHaveBeenCalledWith(
      expect.objectContaining({
        cookieHeader: 'zmtg_formal_session_v1=signed-cookie',
      }),
    );
    expect(mocks.resolveForSession).toHaveBeenCalledOnce();
    expect(mocks.resolveForSession).toHaveBeenCalledWith(claims);
  });

  it.each([
    'tenant_admin',
    'tenant_operator',
    'consultant',
    'customer_service',
  ] as const)('%s 通过 customers section + customer/read policy', async (role) => {
    mocks.consumeSnapshot.mockReset();
    mocks.resolveForSession.mockReset();
    resolveRole(role);

    const result = await resolveInstitutionCustomerReadAuthorizationV1();
    expect(result.kind).toBe('allowed');
    if (result.kind !== 'allowed') throw new Error('expected allowed');
    expect(isInstitutionCustomerReadAuthorizationHandleV1(result.authorization)).toBe(true);
  });

  it('签发冻结、opaque、genuine 且 exactly-once 的 pair handle', async () => {
    const result = await resolveInstitutionCustomerReadAuthorizationV1();
    if (result.kind !== 'allowed') throw new Error('expected allowed');
    expect(Object.isFrozen(result.authorization)).toBe(true);
    expect(Reflect.ownKeys(result.authorization)).toEqual([]);
    expect(consumeInstitutionCustomerReadAuthorizationV1(result.authorization)).toEqual({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      observedAt: '2026-08-15T08:00:00.000Z',
    });
    expect(consumeInstitutionCustomerReadAuthorizationV1(result.authorization)).toBeNull();
    expect(isInstitutionCustomerReadAuthorizationHandleV1(result.authorization)).toBe(false);
  });

  it.each(['platform_admin', 'unknown_role'])('%s 不能进入 Customers', async (role) => {
    mocks.consumeSnapshot.mockReset();
    mocks.resolveForSession.mockReset();
    resolveRole(role);
    await expect(resolveInstitutionCustomerReadAuthorizationV1()).resolves.toEqual({
      kind: 'forbidden',
    });
  });

  it.each(['denied', 'invalid', 'unavailable', 'stale'])
    ('inactive/invalid formal context %s fail-closed', async (kind) => {
      mocks.resolveForSession.mockReset();
      mocks.resolveForSession.mockResolvedValueOnce(Object.freeze({ kind }));
      await expect(resolveInstitutionCustomerReadAuthorizationV1()).resolves.toEqual({
        kind: 'unavailable',
      });
      expect(mocks.consumeSnapshot).not.toHaveBeenCalled();
    });

  it('session、membership 与 institution anchor mismatch fail-closed', async () => {
    mocks.consumeSnapshot.mockReset();
    mocks.resolveForSession.mockReset();
    mocks.consumeSnapshot.mockReturnValueOnce({ ...user('tenant_admin'), institutionId: 'other' });
    mocks.resolveForSession.mockResolvedValueOnce(
      Object.freeze({
        kind: 'resolved',
        snapshot,
        membershipAudit: membership('tenant_admin'),
      }),
    );
    await expect(resolveInstitutionCustomerReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('原样传递 mixed/duplicate Cookie header，由 provenance owner 统一 fail-closed', async () => {
    const mixed =
      'zmtg_demo_session=demo; zmtg_formal_session_v1=formal-a; zmtg_formal_session_v1=formal-b';
    mocks.headerGet.mockReturnValueOnce(mixed);
    mocks.verifyClaims.mockReturnValueOnce(Object.freeze({ kind: 'source_denied' }));

    await expect(resolveInstitutionCustomerReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });
    expect(mocks.verifyClaims).toHaveBeenCalledWith(
      expect.objectContaining({ cookieHeader: mixed }),
    );
    expect(mocks.resolveForSession).not.toHaveBeenCalled();
  });

  it('缺失 cookie header、runtime unavailable 与非 genuine resolver 不进入授权', async () => {
    mocks.headerGet.mockReturnValueOnce(null);
    await expect(resolveInstitutionCustomerReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });

    mocks.resolveRuntimeConfig.mockReturnValueOnce(Object.freeze({ kind: 'unavailable' }));
    await expect(resolveInstitutionCustomerReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });

    mocks.createResolver.mockReturnValueOnce(Object.freeze({
      resolveForSession: mocks.resolveForSession,
    }));
    await expect(resolveInstitutionCustomerReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('plain/clone/Proxy 不能伪造 handle，异常保持低敏 unavailable', async () => {
    for (const value of [{}, Object.freeze({}), new Proxy({}, {})]) {
      expect(isInstitutionCustomerReadAuthorizationHandleV1(value)).toBe(false);
      expect(consumeInstitutionCustomerReadAuthorizationV1(value)).toBeNull();
    }
    mocks.resolveForSession.mockReset();
    mocks.resolveForSession.mockRejectedValueOnce(new Error('database secret'));
    await expect(resolveInstitutionCustomerReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });
  });
});
