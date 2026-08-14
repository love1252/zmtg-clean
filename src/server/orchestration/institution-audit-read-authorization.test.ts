import { createHmac } from 'node:crypto';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';

const resolverProvenance = vi.hoisted(() => new WeakSet<object>());
const runtimeMocks = vi.hoisted(() => ({
  consumeClaims: vi.fn(),
  consumeSnapshot: vi.fn(),
  cookieGet: vi.fn(),
  cookies: vi.fn(),
  createIdentityReader: vi.fn(),
  createMembershipReader: vi.fn(),
  createResolver: vi.fn(),
  createScopeReader: vi.fn(),
  resolveForSession: vi.fn(),
  resolveRuntimeConfig: vi.fn(),
  verifyClaims: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: runtimeMocks.cookies }));

vi.mock(
  '@/modules/auth/server/formal-server-session-provenance-owner',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/auth/server/formal-server-session-provenance-owner')
      >();
    runtimeMocks.verifyClaims.mockImplementation(
      actual.verifyFormalServerSessionCookieClaimsV1,
    );
    runtimeMocks.consumeClaims.mockImplementation(
      actual.consumeFormalServerSessionVerifiedClaimsV1,
    );
    return {
      ...actual,
      consumeFormalServerSessionVerifiedClaimsV1: runtimeMocks.consumeClaims,
      verifyFormalServerSessionCookieClaimsV1: runtimeMocks.verifyClaims,
    };
  },
);

vi.mock(
  '@/modules/auth/application/formal-institution-session-context',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/auth/application/formal-institution-session-context')
      >();
    return {
      ...actual,
      consumeFormalServerSessionUserSnapshotV1: runtimeMocks.consumeSnapshot,
      createFormalInstitutionSessionContextResolverV1:
        runtimeMocks.createResolver,
      isFormalInstitutionSessionContextResolverV1(value: unknown) {
        return (
          value !== null &&
          typeof value === 'object' &&
          resolverProvenance.has(value)
        );
      },
    };
  },
);

vi.mock(
  '@/modules/auth/application/authoritative-formal-session-identity-reader',
  () => ({
    createIdentityAuthoritativeFormalSessionIdentityFactReaderV1:
      runtimeMocks.createIdentityReader,
  }),
);

vi.mock(
  '@/modules/access-control/application/authoritative-membership-reader',
  () => ({
    createAccessControlAuthoritativeMembershipFactReaderV1:
      runtimeMocks.createMembershipReader,
  }),
);

vi.mock(
  '@/modules/tenancy/application/authoritative-institution-scope-reader',
  () => ({
    createTenancyAuthoritativeInstitutionScopeFactReaderV1:
      runtimeMocks.createScopeReader,
  }),
);

vi.mock(
  '@/modules/security/server/institution-guard-runtime-config',
  () => ({
    resolveInstitutionGuardRuntimeConfigV1: runtimeMocks.resolveRuntimeConfig,
  }),
);

import {
  FORMAL_SERVER_SESSION_COOKIE_V1,
  type FormalServerSessionKeyRingV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import {
  consumeInstitutionAuditReadAuthorizationV1,
  isInstitutionAuditReadAuthorizationHandleV1,
  resolveInstitutionAuditReadAuthorizationV1,
  type InstitutionAuditReadAuthorizationConsumptionV1,
  type InstitutionAuditReadAuthorizationHandleV1,
  type InstitutionAuditReadAuthorizationResolutionV1,
} from '@/server/orchestration/institution-audit-read-authorization';

const NOW = new Date('2026-08-14T08:02:00.000Z');
const SESSION_KEY = new Uint8Array(32).fill(0x73);
const SESSION_PROTOCOL = 'zmtg.formal-server-session-cookie.v1';

const payload = Object.freeze({
  source: 'server_session' as const,
  sessionId: '7b5d6a95-b91d-44be-bc36-bc66eef22000',
  accountId: 'account-audit-read-001',
  tenantId: 'tenant-audit-read-001',
  institutionId: 'institution-audit-read-001',
  issuedAt: '2026-08-14T08:00:00.000Z',
  expiresAt: '2026-08-14T09:00:00.000Z',
});

const sessionUser = Object.freeze({
  id: payload.accountId,
  username: 'audit_admin',
  name: '审计管理员',
  role: 'tenant_admin' as const,
  tenantId: payload.tenantId,
  institutionId: payload.institutionId,
});
const sessionSnapshot = Object.freeze({ opaque: 'session' });
const membershipAudit = Object.freeze({
  id: 'membership-audit-read-001',
  tenantId: payload.tenantId,
  role: 'tenant_admin' as const,
});
const identityReader = Object.freeze({ owner: 'identity' });
const membershipReader = Object.freeze({ owner: 'membership' });
const scopeReader = Object.freeze({ owner: 'scope' });
const resolver = Object.freeze({
  resolveForSession: runtimeMocks.resolveForSession,
});

const sessionKeyRing = Object.freeze({
  currentKey: Object.freeze({
    keyVersion: 2,
    keyMaterial: SESSION_KEY,
  }),
  verifyOnlyKeys: Object.freeze([]),
}) satisfies FormalServerSessionKeyRingV1;

function availableRuntimeConfig() {
  return Object.freeze({
    kind: 'available' as const,
    formalServerSessionKeyRing: sessionKeyRing,
    institutionGuardReferenceKeyRing: Object.freeze({
      currentIssueKey: Object.freeze({
        keyVersion: 1,
        keyMaterial: new Uint8Array(32).fill(0x72),
      }),
      verifyOnlyKeys: Object.freeze([]),
    }),
  });
}

function signToken(
  value: Record<string, unknown> = payload,
  input: Readonly<{
    keyVersion?: number;
    keyMaterial?: Uint8Array;
  }> = {},
) {
  const keyVersion = input.keyVersion ?? 2;
  const payloadSegment = Buffer.from(JSON.stringify(value)).toString(
    'base64url',
  );
  const signingInput = `${SESSION_PROTOCOL}\n${keyVersion}\n${payloadSegment}`;
  const tag = createHmac('sha256', input.keyMaterial ?? SESSION_KEY)
    .update(signingInput)
    .digest('base64url');
  return `v1.k${keyVersion}.${payloadSegment}.${tag}`;
}

function resolvedForRole(
  role:
    | 'tenant_admin'
    | 'tenant_operator'
    | 'consultant'
    | 'customer_service',
) {
  runtimeMocks.resolveForSession.mockResolvedValueOnce(
    Object.freeze({
      kind: 'resolved' as const,
      snapshot: sessionSnapshot,
      membershipAudit: Object.freeze({ ...membershipAudit, role }),
    }),
  );
  runtimeMocks.consumeSnapshot.mockReturnValueOnce(
    Object.freeze({ ...sessionUser, role }),
  );
}

beforeEach(() => {
  for (const mock of [
    runtimeMocks.consumeSnapshot,
    runtimeMocks.cookieGet,
    runtimeMocks.cookies,
    runtimeMocks.createIdentityReader,
    runtimeMocks.createMembershipReader,
    runtimeMocks.createResolver,
    runtimeMocks.createScopeReader,
    runtimeMocks.resolveForSession,
    runtimeMocks.resolveRuntimeConfig,
  ]) {
    mock.mockReset();
  }
  runtimeMocks.consumeClaims.mockClear();
  runtimeMocks.verifyClaims.mockClear();

  vi.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
  runtimeMocks.resolveRuntimeConfig.mockReturnValue(availableRuntimeConfig());
  runtimeMocks.cookieGet.mockReturnValue(
    Object.freeze({
      name: FORMAL_SERVER_SESSION_COOKIE_V1,
      value: signToken(),
    }),
  );
  runtimeMocks.cookies.mockResolvedValue(
    Object.freeze({ get: runtimeMocks.cookieGet }),
  );
  runtimeMocks.createIdentityReader.mockReturnValue(identityReader);
  runtimeMocks.createMembershipReader.mockReturnValue(membershipReader);
  runtimeMocks.createScopeReader.mockReturnValue(scopeReader);
  resolverProvenance.add(resolver);
  runtimeMocks.createResolver.mockReturnValue(resolver);
  runtimeMocks.resolveForSession.mockResolvedValue(
    Object.freeze({
      kind: 'resolved' as const,
      snapshot: sessionSnapshot,
      membershipAudit,
    }),
  );
  runtimeMocks.consumeSnapshot.mockReturnValue(sessionUser);
});

afterEach(() => {
  vi.mocked(Date.now).mockRestore();
});

describe('机构 Audit trusted role-aware 读取授权 owner', () => {
  it('无 caller 输入并复用 formal session authoritative composition', async () => {
    expectTypeOf<
      Parameters<typeof resolveInstitutionAuditReadAuthorizationV1>
    >().toEqualTypeOf<[]>();
    expectTypeOf<
      ReturnType<typeof resolveInstitutionAuditReadAuthorizationV1>
    >().toEqualTypeOf<Promise<InstitutionAuditReadAuthorizationResolutionV1>>();
    expect(resolveInstitutionAuditReadAuthorizationV1.length).toBe(0);

    const result = await resolveInstitutionAuditReadAuthorizationV1();

    expect(result.kind).toBe('allowed');
    expect(runtimeMocks.cookieGet).toHaveBeenCalledWith(
      FORMAL_SERVER_SESSION_COOKIE_V1,
    );
    expect(runtimeMocks.verifyClaims).toHaveBeenCalledOnce();
    expect(runtimeMocks.createResolver).toHaveBeenCalledWith({
      identityReader,
      membershipReader,
      scopeReader,
    });
    expect(runtimeMocks.resolveForSession).toHaveBeenCalledWith({
      accountId: payload.accountId,
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
    });
  });

  it('tenant_admin 获得 genuine、冻结、opaque、one-shot 的最小 handle', async () => {
    const resolution = await resolveInstitutionAuditReadAuthorizationV1();
    expect(resolution.kind).toBe('allowed');
    if (resolution.kind !== 'allowed') throw new Error('expected allowed');

    const { authorization } = resolution;
    expect(Object.isFrozen(authorization)).toBe(true);
    expect(Reflect.ownKeys(authorization)).toEqual([]);
    expect(JSON.stringify(authorization)).toBe('{}');
    expect(isInstitutionAuditReadAuthorizationHandleV1(authorization)).toBe(
      true,
    );

    const consumption = consumeInstitutionAuditReadAuthorizationV1(
      authorization,
    );
    expectTypeOf(consumption).toEqualTypeOf<
      InstitutionAuditReadAuthorizationConsumptionV1 | null
    >();
    expect(consumption).toEqual({
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
      observedAt: NOW.toISOString(),
    });
    expect(Object.isFrozen(consumption)).toBe(true);
    expect(Reflect.ownKeys(consumption as object)).toEqual([
      'tenantId',
      'institutionId',
      'observedAt',
    ]);
    expect(JSON.stringify(consumption)).not.toContain('role');
    expect(JSON.stringify(consumption)).not.toContain('cookie');
    expect(JSON.stringify(consumption)).not.toContain('membership');
    expect(consumeInstitutionAuditReadAuthorizationV1(authorization)).toBeNull();
  });

  it('拒绝 plain、clone、spread、JSON、Proxy 与 shape-only 伪造', async () => {
    const resolution = await resolveInstitutionAuditReadAuthorizationV1();
    expect(resolution.kind).toBe('allowed');
    if (resolution.kind !== 'allowed') throw new Error('expected allowed');
    const handle = resolution.authorization;

    const lookalikes: unknown[] = [
      {},
      Object.freeze({}),
      { ...handle },
      Object.assign({}, handle),
      JSON.parse(JSON.stringify(handle)) as unknown,
      new Proxy(handle, {}),
      Object.create(Object.getPrototypeOf(handle)),
      Object.freeze({
        tenantId: payload.tenantId,
        institutionId: payload.institutionId,
        observedAt: NOW.toISOString(),
      }),
      [],
      null,
    ];

    for (const value of lookalikes) {
      expect(isInstitutionAuditReadAuthorizationHandleV1(value)).toBe(false);
      expect(consumeInstitutionAuditReadAuthorizationV1(value)).toBeNull();
    }
    expect(isInstitutionAuditReadAuthorizationHandleV1(handle)).toBe(true);
  });

  it.each([
    'tenant_operator',
    'consultant',
    'customer_service',
  ] as const)('可信 current role %s 明确 forbidden', async (role) => {
    resolvedForRole(role);

    await expect(resolveInstitutionAuditReadAuthorizationV1()).resolves.toEqual({
      kind: 'forbidden',
    });
  });

  it.each([
    ['forged platform role', { ...sessionUser, role: 'platform_admin' }],
    [
      'missing role',
      {
        id: sessionUser.id,
        username: sessionUser.username,
        name: sessionUser.name,
        tenantId: sessionUser.tenantId,
        institutionId: sessionUser.institutionId,
      },
    ],
    ['extra role evidence', { ...sessionUser, callerRole: 'tenant_admin' }],
    ['proxy snapshot', new Proxy(sessionUser, {})],
  ] as const)('session user %s 时 unavailable', async (_label, value) => {
    runtimeMocks.consumeSnapshot.mockReturnValueOnce(value);

    await expect(resolveInstitutionAuditReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it.each([
    ['account', { ...sessionUser, id: 'account-other' }],
    ['tenant', { ...sessionUser, tenantId: 'tenant-other' }],
    ['institution', { ...sessionUser, institutionId: 'institution-other' }],
  ] as const)('authoritative %s mismatch 时 unavailable', async (_label, value) => {
    runtimeMocks.consumeSnapshot.mockReturnValueOnce(value);

    await expect(resolveInstitutionAuditReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it.each([
    ['tenant mismatch', { ...membershipAudit, tenantId: 'tenant-other' }],
    ['role mismatch', { ...membershipAudit, role: 'tenant_operator' }],
    ['invalid id', { ...membershipAudit, id: '' }],
    ['extra key', { ...membershipAudit, institutionId: payload.institutionId }],
    ['proxy', new Proxy(membershipAudit, {})],
  ] as const)('membership audit %s 时 unavailable', async (_label, value) => {
    runtimeMocks.resolveForSession.mockResolvedValueOnce(
      Object.freeze({
        kind: 'resolved',
        snapshot: sessionSnapshot,
        membershipAudit: value,
      }),
    );

    await expect(resolveInstitutionAuditReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it.each(['denied', 'invalid', 'unavailable', 'stale'] as const)(
    'formal context %s 时 unavailable',
    async (kind) => {
      runtimeMocks.resolveForSession.mockResolvedValueOnce(
        Object.freeze({ kind }),
      );

      await expect(
        resolveInstitutionAuditReadAuthorizationV1(),
      ).resolves.toEqual({ kind: 'unavailable' });
      expect(runtimeMocks.consumeSnapshot).not.toHaveBeenCalled();
    },
  );

  it.each(['missing', 'empty', 'proxy', 'accessor'] as const)(
    'cookie %s 时 unavailable 且不进入 authoritative composition',
    async (failure) => {
      if (failure === 'missing') {
        runtimeMocks.cookieGet.mockReturnValueOnce(undefined);
      } else if (failure === 'empty') {
        runtimeMocks.cookieGet.mockReturnValueOnce(
          Object.freeze({ name: FORMAL_SERVER_SESSION_COOKIE_V1, value: '' }),
        );
      } else if (failure === 'proxy') {
        runtimeMocks.cookieGet.mockReturnValueOnce(
          new Proxy(
            { name: FORMAL_SERVER_SESSION_COOKIE_V1, value: signToken() },
            {},
          ),
        );
      } else {
        runtimeMocks.cookieGet.mockReturnValueOnce(
          Object.defineProperty(
            { name: FORMAL_SERVER_SESSION_COOKIE_V1 },
            'value',
            {
              enumerable: true,
              get() {
                throw new Error('cookie secret');
              },
            },
          ),
        );
      }

      await expect(
        resolveInstitutionAuditReadAuthorizationV1(),
      ).resolves.toEqual({ kind: 'unavailable' });
      expect(runtimeMocks.createResolver).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['malformed', 'not-a-session'],
    ['invalid signature', `${signToken()}-tampered`],
    [
      'future issued',
      signToken({ ...payload, issuedAt: '2026-08-14T08:03:00.000Z' }),
    ],
    [
      'expired',
      signToken({ ...payload, expiresAt: '2026-08-14T08:01:59.999Z' }),
    ],
  ] as const)('signed session %s 时 unavailable', async (_label, value) => {
    runtimeMocks.cookieGet.mockReturnValueOnce(
      Object.freeze({ name: FORMAL_SERVER_SESSION_COOKIE_V1, value }),
    );

    await expect(resolveInstitutionAuditReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });
    expect(runtimeMocks.createResolver).not.toHaveBeenCalled();
  });

  it.each([
    ['unavailable', Object.freeze({ kind: 'unavailable' })],
    ['missing keys', Object.freeze({ kind: 'available' })],
    [
      'extra key',
      Object.freeze({ ...availableRuntimeConfig(), callerRole: 'tenant_admin' }),
    ],
    ['proxy', new Proxy(availableRuntimeConfig(), {})],
  ] as const)('runtime config %s 时 unavailable', async (_label, value) => {
    runtimeMocks.resolveRuntimeConfig.mockReturnValueOnce(value);

    await expect(resolveInstitutionAuditReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });
    expect(runtimeMocks.cookies).not.toHaveBeenCalled();
  });

  it.each(['identity', 'membership', 'scope'] as const)(
    '%s authoritative reader factory 异常时 unavailable',
    async (owner) => {
      const factory =
        owner === 'identity'
          ? runtimeMocks.createIdentityReader
          : owner === 'membership'
            ? runtimeMocks.createMembershipReader
            : runtimeMocks.createScopeReader;
      factory.mockImplementationOnce(() => {
        throw new Error(`${owner} repository secret`);
      });

      await expect(
        resolveInstitutionAuditReadAuthorizationV1(),
      ).resolves.toEqual({ kind: 'unavailable' });
    },
  );

  it('拒绝非 genuine formal resolver', async () => {
    runtimeMocks.createResolver.mockReturnValueOnce(
      Object.freeze({ resolveForSession: runtimeMocks.resolveForSession }),
    );

    await expect(resolveInstitutionAuditReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });
    expect(runtimeMocks.resolveForSession).not.toHaveBeenCalled();
  });

  it('snapshot consumption 异常时低敏 unavailable', async () => {
    runtimeMocks.consumeSnapshot.mockImplementationOnce(() => {
      throw new Error('role and membership secret');
    });

    const result = await resolveInstitutionAuditReadAuthorizationV1();
    expect(result).toEqual({ kind: 'unavailable' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('忽略 JavaScript 额外实参，caller 无法注入 scope、role 或 capability', async () => {
    const resolution = await Reflect.apply(
      resolveInstitutionAuditReadAuthorizationV1,
      null,
      [
        {
          tenantId: 'tenant-attacker',
          institutionId: 'institution-attacker',
          role: 'tenant_admin',
          capability: 'released',
        },
      ],
    );

    expect(resolution.kind).toBe('allowed');
    if (resolution.kind !== 'allowed') throw new Error('expected allowed');
    expect(
      consumeInstitutionAuditReadAuthorizationV1(resolution.authorization),
    ).toEqual({
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
      observedAt: NOW.toISOString(),
    });
  });

  it('resolver 与 trusted clock 异常时 fail-closed', async () => {
    runtimeMocks.resolveForSession.mockRejectedValueOnce(
      new Error('membership SQL and secret'),
    );

    await expect(resolveInstitutionAuditReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });

    vi.mocked(Date.now).mockReturnValueOnce(Number.NaN);
    await expect(resolveInstitutionAuditReadAuthorizationV1()).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('handle type 不能由普通 object 满足', () => {
    expectTypeOf<
      InstitutionAuditReadAuthorizationHandleV1
    >().not.toEqualTypeOf<Readonly<Record<string, never>>>();
  });
});
