import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FORMAL_SERVER_SESSION_COOKIE_V1,
  FORMAL_SERVER_SESSION_COOKIE_MAX_AGE_SECONDS_V1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import { DEMO_SESSION_COOKIE } from '@/modules/auth/server/demo-session';

const routeMocks = vi.hoisted(() => {
  const user = Object.freeze({
    id: 'auth-user-formal-001',
    username: 'formal_user',
    name: '正式账号',
    role: 'tenant_admin' as const,
    tenantId: 'tenant-formal-001',
    institutionId: 'institution-formal-001',
  });
  const account = Object.freeze({
    id: user.id,
    username: user.username,
    displayName: user.name,
    phone: null,
    email: null,
    passwordHash: 'scrypt$not-a-real-secret',
    passwordUpdatedAt: new Date('2026-07-22T00:00:00.000Z'),
    passwordResetRequired: false,
    status: 'active' as const,
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdBy: 'platform',
    updatedBy: 'platform',
    createdAt: new Date('2026-07-22T00:00:00.000Z'),
    updatedAt: new Date('2026-07-22T00:00:00.000Z'),
  });
  const membership = Object.freeze({
    id: 'membership-formal-001',
    tenantId: user.tenantId,
    userId: user.id,
    role: 'tenant_admin' as const,
    displayName: user.name,
    createdAt: new Date('2026-07-22T00:00:00.000Z'),
    updatedAt: new Date('2026-07-22T00:00:00.000Z'),
  });
  const sessionSnapshot = Object.freeze({ snapshot: 'formal-user' });
  const verifiedClaims = Object.freeze({ claims: 'formal' });

  return {
    account,
    authenticateDemoUser: vi.fn(),
    auditRepository: { record: vi.fn() },
    consumeClaims: vi.fn(),
    consumeSnapshot: vi.fn(),
    createAuditEventRepository: vi.fn(),
    createAuthAccountRepository: vi.fn(),
    createAuthAccountService: vi.fn(),
    createDemoSession: vi.fn(),
    database: Object.freeze({ database: 'formal-auth-db' }),
    decodeDemoSession: vi.fn(),
    encodeDemoSession: vi.fn(),
    getDatabase: vi.fn(),
    isDemoAuthEnabled: vi.fn(),
    issueFormalCookie: vi.fn(),
    membership,
    repository: {
      createAccount: vi.fn(),
      findAccountByUsername: vi.fn(),
      findCurrentFormalSessionUser: vi.fn(),
      findPrimaryTenantMembershipByUserId: vi.fn(),
      listActiveInstitutionBindingsByAccountAndTenant: vi.fn(),
      recordLoginFailure: vi.fn(),
      recordLoginSuccess: vi.fn(),
      updateAccountStatus: vi.fn(),
      updatePassword: vi.fn(),
    },
    resolveRuntimeConfig: vi.fn(),
    service: { authenticatePasswordAccount: vi.fn() },
    sessionSnapshot,
    user,
    verifiedClaims,
    verifyFormalCookie: vi.fn(),
  };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return { ...actual, getDatabase: routeMocks.getDatabase };
});

vi.mock('@/modules/auth/server/auth-account-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/auth/server/auth-account-repository')>();
  return {
    ...actual,
    consumeFormalServerSessionUserSnapshotV1: routeMocks.consumeSnapshot,
    createAuthAccountRepository: routeMocks.createAuthAccountRepository,
  };
});

vi.mock('@/modules/auth/server/auth-account-service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/auth/server/auth-account-service')>();
  return { ...actual, createAuthAccountService: routeMocks.createAuthAccountService };
});

vi.mock('@/modules/audit/server/audit-event-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/audit/server/audit-event-repository')>();
  return { ...actual, createAuditEventRepository: routeMocks.createAuditEventRepository };
});

vi.mock('@/modules/auth/server/demo-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/auth/server/demo-session')>();
  return {
    ...actual,
    authenticateDemoUser: routeMocks.authenticateDemoUser,
    createDemoSession: routeMocks.createDemoSession,
    decodeDemoSession: routeMocks.decodeDemoSession,
    encodeDemoSession: routeMocks.encodeDemoSession,
    isDemoAuthEnabled: routeMocks.isDemoAuthEnabled,
  };
});

vi.mock('@/modules/auth/server/formal-server-session-provenance-owner', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/auth/server/formal-server-session-provenance-owner')>();
  return {
    ...actual,
    consumeFormalServerSessionVerifiedClaimsV1: routeMocks.consumeClaims,
    issueFormalServerSessionCookieV1: routeMocks.issueFormalCookie,
    verifyFormalServerSessionCookieClaimsV1: routeMocks.verifyFormalCookie,
  };
});

vi.mock('@/modules/security/server/institution-guard-runtime-config', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/security/server/institution-guard-runtime-config')>();
  return { ...actual, resolveInstitutionGuardRuntimeConfigV1: routeMocks.resolveRuntimeConfig };
});

function loginRequest(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function hostileLoginRequest(body: unknown) {
  return { json: vi.fn().mockResolvedValue(body) } as unknown as Request;
}

function hostileProxy() {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('hostile property access');
      },
      getPrototypeOf() {
        throw new Error('hostile prototype access');
      },
    },
  );
}

function sessionRequest(cookie?: string) {
  return new Request('http://localhost/api/auth/session', {
    headers: cookie ? { cookie } : undefined,
  });
}

function hostileSessionRequest(getCookie: () => unknown) {
  return { headers: { get: getCookie } } as unknown as Request;
}

function expectNoStore(response: Response) {
  expect(response.headers.get('cache-control')).toBe('no-store');
}

function expectCookieCleared(response: Response, name: string) {
  expect(response.headers.get('set-cookie')).toContain(`${name}=;`);
}

const availableConfig = Object.freeze({
  kind: 'available' as const,
  formalServerSessionKeyRing: Object.freeze({
    currentKey: Object.freeze({ keyVersion: 1, keyMaterial: new Uint8Array(32).fill(1) }),
    verifyOnlyKeys: Object.freeze([]),
  }),
  institutionGuardReferenceKeyRing: Object.freeze({
    currentIssueKey: Object.freeze({ keyVersion: 1, keyMaterial: new Uint8Array(32).fill(2) }),
    verifyOnlyKeys: Object.freeze([]),
  }),
});

beforeEach(() => {
  vi.resetModules();
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.createAuthAccountRepository.mockReset();
  routeMocks.createAuthAccountRepository.mockReturnValue(routeMocks.repository);
  routeMocks.createAuthAccountService.mockReset();
  routeMocks.createAuthAccountService.mockReturnValue(routeMocks.service);
  routeMocks.createAuditEventRepository.mockReset();
  routeMocks.createAuditEventRepository.mockReturnValue(routeMocks.auditRepository);
  routeMocks.resolveRuntimeConfig.mockReset();
  routeMocks.resolveRuntimeConfig.mockReturnValue(availableConfig);
  routeMocks.issueFormalCookie.mockReset();
  routeMocks.issueFormalCookie.mockReturnValue({
    kind: 'issued',
    cookieValue: 'v1.k1.formal-payload.formal-tag',
    expiresAt: '2026-07-22T08:00:00.000Z',
    maxAgeSeconds: FORMAL_SERVER_SESSION_COOKIE_MAX_AGE_SECONDS_V1,
    sessionUser: routeMocks.user,
  });
  routeMocks.verifyFormalCookie.mockReset();
  routeMocks.consumeClaims.mockReset();
  routeMocks.consumeSnapshot.mockReset();
  routeMocks.consumeClaims.mockReturnValue({
    accountId: routeMocks.user.id,
    tenantId: routeMocks.user.tenantId,
    institutionId: routeMocks.user.institutionId,
  });
  routeMocks.consumeSnapshot.mockReturnValue(routeMocks.user);
  routeMocks.authenticateDemoUser.mockReset();
  routeMocks.createDemoSession.mockReset();
  routeMocks.encodeDemoSession.mockReset();
  routeMocks.decodeDemoSession.mockReset();
  routeMocks.isDemoAuthEnabled.mockReset();
  routeMocks.isDemoAuthEnabled.mockReturnValue(true);
  Object.values(routeMocks.repository).forEach((mock) => mock.mockReset());
  routeMocks.repository.findAccountByUsername.mockResolvedValue(routeMocks.account);
  routeMocks.repository.findPrimaryTenantMembershipByUserId.mockResolvedValue(routeMocks.membership);
  routeMocks.repository.findCurrentFormalSessionUser.mockResolvedValue({
    kind: 'resolved',
    snapshot: routeMocks.sessionSnapshot,
  });
  routeMocks.service.authenticatePasswordAccount.mockReset();
  routeMocks.service.authenticatePasswordAccount.mockResolvedValue({
    status: 'authenticated',
    passwordResetRequired: false,
    user: routeMocks.user,
  });
  routeMocks.auditRepository.record.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('AUTH-FORMAL-COOKIE-02B', () => {
  it.each([
    ['null', null],
    ['string', 'not-a-record'],
    ['null-prototype', Object.assign(Object.create(null), { username: 'formal_user', password: 'not-a-secret', scope: 'institution' })],
    ['extra key', { username: 'formal_user', password: 'not-a-secret', scope: 'institution', extra: true }],
    ['proxy', hostileProxy()],
    ['accessor', (() => {
      const value: Record<string, unknown> = { password: 'not-a-secret', scope: 'institution' };
      Object.defineProperty(value, 'username', { enumerable: true, get: () => { throw new Error('getter'); } });
      return value;
    })()],
  ])('login hostile body %s 返回 400 且零下游', async (_label, body) => {
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(hostileLoginRequest(body));

    expect(response.status).toBe(400);
    expectNoStore(response);
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.authenticateDemoUser).not.toHaveBeenCalled();
  });

  it('formal 登录经 snapshot issuer 写 formal cookie、清 demo 且 no-store', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    const response = await POST(
      loginRequest({ username: 'formal_user', password: 'not-a-secret', scope: 'institution' }),
    );

    expect(response.status).toBe(200);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual({ code: 0, data: { user: routeMocks.user } });
    expect(routeMocks.resolveRuntimeConfig).toHaveBeenCalledTimes(1);
    expect(routeMocks.repository.findCurrentFormalSessionUser).toHaveBeenCalledWith({
      accountId: routeMocks.user.id,
      tenantId: routeMocks.user.tenantId,
      institutionId: routeMocks.user.institutionId,
    });
    expect(routeMocks.issueFormalCookie).toHaveBeenCalledTimes(1);
    expect(response.headers.get('set-cookie')).toContain(`${FORMAL_SERVER_SESSION_COOKIE_V1}=v1.k1.formal-payload.formal-tag`);
    expectCookieCleared(response, DEMO_SESSION_COOKIE);
    expect(routeMocks.authenticateDemoUser).not.toHaveBeenCalled();
    expect(routeMocks.auditRepository.record).toHaveBeenCalledTimes(1);
  });

  it('scope 缺失 fail-closed 且零 DB、零 keyring、零 demo', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(loginRequest({ username: 'formal_user', password: 'not-a-secret' }));

    expect(response.status).toBe(400);
    expectNoStore(response);
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.authenticateDemoUser).not.toHaveBeenCalled();
  });

  it('platform scope 仅走 Demo 分支且零 DB、零 formal runtime', async () => {
    const platformUser = Object.freeze({
      id: 'demo-user-platform',
      username: 'platform',
      name: '超级管理员',
      role: 'platform_admin' as const,
      tenantId: null,
      institutionId: null,
    });
    routeMocks.authenticateDemoUser.mockReturnValue(platformUser);
    routeMocks.createDemoSession.mockReturnValue({
      user: platformUser,
      expiresAt: Date.now() + 60_000,
      source: 'demo_session',
    });
    routeMocks.encodeDemoSession.mockReturnValue(
      'platform-demo-session',
    );

    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(
      loginRequest({
        username: 'platform',
        password: 'demo-password',
        scope: 'platform',
      }),
    );

    expect(response.status).toBe(200);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual({
      code: 0,
      data: { user: platformUser },
    });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(
      routeMocks.createAuthAccountRepository,
    ).not.toHaveBeenCalled();
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.authenticateDemoUser).toHaveBeenCalledWith({
      username: 'platform',
      password: 'demo-password',
      scope: 'platform',
    });
    expect(response.headers.get('set-cookie')).toContain(
      `${DEMO_SESSION_COOKIE}=platform-demo-session`,
    );
    expectCookieCleared(
      response,
      FORMAL_SERVER_SESSION_COOKIE_V1,
    );
  });

  it('platform scope 在 Demo 关闭时 fail-closed 且零 DB', async () => {
    routeMocks.isDemoAuthEnabled.mockReturnValue(false);

    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(
      loginRequest({
        username: 'platform',
        password: 'demo-password',
        scope: 'platform',
      }),
    );

    expect(response.status).toBe(401);
    expectNoStore(response);
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(
      routeMocks.createAuthAccountRepository,
    ).not.toHaveBeenCalled();
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.authenticateDemoUser).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('DB 可用但 formal account 不存在时才允许 demo 登录，并清 formal cookie', async () => {
    routeMocks.repository.findAccountByUsername.mockResolvedValue(null);
    routeMocks.authenticateDemoUser.mockReturnValue(routeMocks.user);
    routeMocks.createDemoSession.mockReturnValue({ source: 'demo_session' });
    routeMocks.encodeDemoSession.mockReturnValue('demo-session');
    const { POST } = await import('@/app/api/auth/login/route');

    const response = await POST(
      loginRequest({ username: 'demo-user', password: 'demo-password', scope: 'institution' }),
    );

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.authenticateDemoUser).toHaveBeenCalledTimes(1);
    expect(response.headers.get('set-cookie')).toContain(`${DEMO_SESSION_COOKIE}=demo-session`);
    expectCookieCleared(response, FORMAL_SERVER_SESSION_COOKIE_V1);
  });

  it('formal DB unavailable 返回 503 而不降级 demo', async () => {
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('database unavailable');
    });
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(
      loginRequest({ username: 'formal_user', password: 'not-a-secret', scope: 'institution' }),
    );

    expect(response.status).toBe(503);
    expectNoStore(response);
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.authenticateDemoUser).not.toHaveBeenCalled();
  });

  it('existing-but-rejected 返回 401 而不降级 demo', async () => {
    routeMocks.service.authenticatePasswordAccount.mockResolvedValue({
      status: 'rejected',
      reason: 'state_changed',
    });
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(
      loginRequest({ username: 'formal_user', password: 'not-a-secret', scope: 'institution' }),
    );

    expect(response.status).toBe(401);
    expectNoStore(response);
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.repository.findCurrentFormalSessionUser).not.toHaveBeenCalled();
    expect(routeMocks.issueFormalCookie).not.toHaveBeenCalled();
    expect(routeMocks.authenticateDemoUser).not.toHaveBeenCalled();
  });

  it('password reset required 返回低敏 403，零 snapshot/cookie/demo', async () => {
    routeMocks.service.authenticatePasswordAccount.mockResolvedValue({
      status: 'authenticated',
      passwordResetRequired: true,
      user: routeMocks.user,
    });
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(
      loginRequest({ username: 'formal_user', password: 'not-a-secret', scope: 'institution' }),
    );

    expect(response.status).toBe(403);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual({
      code: 'PASSWORD_RESET_REQUIRED',
      message: '需要先完成密码重置',
    });
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.repository.findCurrentFormalSessionUser).not.toHaveBeenCalled();
    expect(routeMocks.issueFormalCookie).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(routeMocks.authenticateDemoUser).not.toHaveBeenCalled();
  });

  it.each([
    ['keyring unavailable', () => routeMocks.resolveRuntimeConfig.mockReturnValue({ kind: 'unavailable' }), 503],
    ['snapshot denied', () => routeMocks.repository.findCurrentFormalSessionUser.mockResolvedValue({ kind: 'denied' }), 401],
    ['snapshot invalid', () => routeMocks.repository.findCurrentFormalSessionUser.mockResolvedValue({ kind: 'invalid' }), 503],
    ['snapshot unavailable', () => routeMocks.repository.findCurrentFormalSessionUser.mockResolvedValue({ kind: 'unavailable' }), 503],
    ['snapshot throws', () => routeMocks.repository.findCurrentFormalSessionUser.mockRejectedValue(new Error('database unavailable')), 503],
    ['issuer unavailable', () => routeMocks.issueFormalCookie.mockReturnValue({ kind: 'unavailable', code: 'formal_session_unavailable' }), 503],
  ])('%s fail-closes without demo fallback', async (label, arrange, status) => {
    arrange();
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(
      loginRequest({ username: 'formal_user', password: 'not-a-secret', scope: 'institution' }),
    );

    expect(response.status).toBe(status);
    expectNoStore(response);
    if (label !== 'issuer unavailable') {
      expect(routeMocks.issueFormalCookie).not.toHaveBeenCalled();
    }
    expect(routeMocks.authenticateDemoUser).not.toHaveBeenCalled();
    expect(routeMocks.auditRepository.record).not.toHaveBeenCalled();
  });

  it.each([
    ['runtime throws', () => routeMocks.resolveRuntimeConfig.mockImplementation(() => { throw new Error('unavailable'); })],
    ['runtime undefined', () => routeMocks.resolveRuntimeConfig.mockReturnValue(undefined)],
    ['runtime null', () => routeMocks.resolveRuntimeConfig.mockReturnValue(null)],
    ['runtime string', () => routeMocks.resolveRuntimeConfig.mockReturnValue('available')],
    ['runtime object', () => routeMocks.resolveRuntimeConfig.mockReturnValue({ kind: 'available' })],
    ['runtime proxy', () => routeMocks.resolveRuntimeConfig.mockReturnValue(hostileProxy())],
    ['runtime unknown', () => routeMocks.resolveRuntimeConfig.mockReturnValue({ kind: 'unknown', formalServerSessionKeyRing: null, institutionGuardReferenceKeyRing: null })],
    ['snapshot undefined', () => routeMocks.repository.findCurrentFormalSessionUser.mockResolvedValue(undefined)],
    ['snapshot null', () => routeMocks.repository.findCurrentFormalSessionUser.mockResolvedValue(null)],
    ['snapshot string', () => routeMocks.repository.findCurrentFormalSessionUser.mockResolvedValue('resolved')],
    ['snapshot object', () => routeMocks.repository.findCurrentFormalSessionUser.mockResolvedValue({ kind: 'resolved' })],
    ['snapshot unknown', () => routeMocks.repository.findCurrentFormalSessionUser.mockResolvedValue({ kind: 'unknown' })],
    ['snapshot proxy', () => routeMocks.repository.findCurrentFormalSessionUser.mockResolvedValue(hostileProxy())],
    ['issuer throws', () => routeMocks.issueFormalCookie.mockImplementation(() => { throw new Error('unavailable'); })],
    ['issuer undefined', () => routeMocks.issueFormalCookie.mockReturnValue(undefined)],
    ['issuer null', () => routeMocks.issueFormalCookie.mockReturnValue(null)],
    ['issuer string', () => routeMocks.issueFormalCookie.mockReturnValue('issued')],
    ['issuer object', () => routeMocks.issueFormalCookie.mockReturnValue({ kind: 'unavailable' })],
    ['issuer proxy', () => routeMocks.issueFormalCookie.mockReturnValue(hostileProxy())],
    ['issuer unknown', () => routeMocks.issueFormalCookie.mockReturnValue({ kind: 'unknown' })],
    ['issuer malformed issued', () => routeMocks.issueFormalCookie.mockReturnValue({ kind: 'issued', cookieValue: 'value' })],
  ])('formal 后半段 hostile %s 低敏 503 且不记成功审计', async (_label, arrange) => {
    arrange();
    const { POST } = await import('@/app/api/auth/login/route');
    const response = await POST(loginRequest({ username: 'formal_user', password: 'not-a-secret', scope: 'institution' }));

    expect(response.status).toBe(503);
    expectNoStore(response);
    expect(routeMocks.auditRepository.record).not.toHaveBeenCalled();
    expect(routeMocks.authenticateDemoUser).not.toHaveBeenCalled();
  });

  it('mixed cookie 清两者且不验证、不读 DB、不走 demo', async () => {
    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET(
      sessionRequest(`${FORMAL_SERVER_SESSION_COOKIE_V1}=broken; ${DEMO_SESSION_COOKIE}=demo`),
    );

    expect(response.status).toBe(401);
    expectNoStore(response);
    expectCookieCleared(response, FORMAL_SERVER_SESSION_COOKIE_V1);
    expectCookieCleared(response, DEMO_SESSION_COOKIE);
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.verifyFormalCookie).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.decodeDemoSession).not.toHaveBeenCalled();
  });

  it.each([
    ['header getter throws', () => { throw new Error('hostile header'); }],
    ['header type unknown', () => ({ cookie: 'not-a-string' })],
  ])('session %s 返回 401 且零下游', async (_label, getCookie) => {
    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET(hostileSessionRequest(getCookie));

    expect(response.status).toBe(401);
    expectNoStore(response);
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.verifyFormalCookie).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.decodeDemoSession).not.toHaveBeenCalled();
  });

  it.each([
    ['duplicate formal', `${FORMAL_SERVER_SESSION_COOKIE_V1}=one; ${FORMAL_SERVER_SESSION_COOKIE_V1}=two`, [FORMAL_SERVER_SESSION_COOKIE_V1]],
    ['bare formal', FORMAL_SERVER_SESSION_COOKIE_V1, [FORMAL_SERVER_SESSION_COOKIE_V1]],
    ['duplicate demo', `${DEMO_SESSION_COOKIE}=one; ${DEMO_SESSION_COOKIE}=two`, [DEMO_SESSION_COOKIE]],
    ['bare demo', DEMO_SESSION_COOKIE, [DEMO_SESSION_COOKIE]],
    ['oversized formal', `${FORMAL_SERVER_SESSION_COOKIE_V1}=${'x'.repeat(8_193)}`, [FORMAL_SERVER_SESSION_COOKIE_V1, DEMO_SESSION_COOKIE]],
  ])('session %s fail-closed、清理冲突 Cookie 且零下游', async (_label, cookie, cleared) => {
    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET(sessionRequest(cookie));

    expect(response.status).toBe(401);
    expectNoStore(response);
    cleared.forEach((name) => expectCookieCleared(response, name));
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.verifyFormalCookie).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.decodeDemoSession).not.toHaveBeenCalled();
  });

  it('formal session keyring unavailable 返回 503 且零 DB/demo', async () => {
    routeMocks.resolveRuntimeConfig.mockReturnValue({ kind: 'unavailable' });
    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET(sessionRequest(`${FORMAL_SERVER_SESSION_COOKIE_V1}=formal`));

    expect(response.status).toBe(503);
    expectNoStore(response);
    expect(routeMocks.verifyFormalCookie).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.decodeDemoSession).not.toHaveBeenCalled();
  });

  it('formal session verifier、consumer 与 repository snapshot 成功时返回低敏 user', async () => {
    routeMocks.verifyFormalCookie.mockReturnValue({
      kind: 'verified',
      verifiedClaims: routeMocks.verifiedClaims,
    });
    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET(sessionRequest(`${FORMAL_SERVER_SESSION_COOKIE_V1}=formal`));

    expect(response.status).toBe(200);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual({ authenticated: true, user: routeMocks.user });
    expect(routeMocks.consumeClaims).toHaveBeenCalledWith(routeMocks.verifiedClaims);
    expect(routeMocks.repository.findCurrentFormalSessionUser).toHaveBeenCalledWith({
      accountId: routeMocks.user.id,
      tenantId: routeMocks.user.tenantId,
      institutionId: routeMocks.user.institutionId,
    });
    expect(routeMocks.consumeSnapshot).toHaveBeenCalledWith(routeMocks.sessionSnapshot);
    expect(routeMocks.decodeDemoSession).not.toHaveBeenCalled();
  });

  it.each([
    ['verifier rejected', () => routeMocks.verifyFormalCookie.mockReturnValue({ kind: 'rejected', code: 'provenance_invalid' }), 401],
    ['verifier unavailable', () => routeMocks.verifyFormalCookie.mockReturnValue({ kind: 'unavailable', code: 'provenance_unavailable' }), 503],
    ['snapshot denied', () => routeMocks.verifyFormalCookie.mockReturnValue({ kind: 'verified', verifiedClaims: routeMocks.verifiedClaims }), 401],
    ['snapshot invalid', () => routeMocks.verifyFormalCookie.mockReturnValue({ kind: 'verified', verifiedClaims: routeMocks.verifiedClaims }), 503],
    ['snapshot unavailable', () => routeMocks.verifyFormalCookie.mockReturnValue({ kind: 'verified', verifiedClaims: routeMocks.verifiedClaims }), 503],
  ])('formal session %s maps fail-closed without demo fallback', async (label, arrange, status) => {
    arrange();
    if (label.startsWith('snapshot ')) {
      routeMocks.repository.findCurrentFormalSessionUser.mockResolvedValue({
        kind: label.slice('snapshot '.length),
      });
    }
    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET(sessionRequest(`${FORMAL_SERVER_SESSION_COOKIE_V1}=formal`));

    expect(response.status).toBe(status);
    expectNoStore(response);
    expect(routeMocks.decodeDemoSession).not.toHaveBeenCalled();
  });

  it.each([
    ['runtime throws', () => routeMocks.resolveRuntimeConfig.mockImplementation(() => { throw new Error('unavailable'); })],
    ['runtime proxy', () => routeMocks.resolveRuntimeConfig.mockReturnValue(hostileProxy())],
    ['verifier throws', () => routeMocks.verifyFormalCookie.mockImplementation(() => { throw new Error('unavailable'); })],
    ['verifier unknown', () => routeMocks.verifyFormalCookie.mockReturnValue({ kind: 'unknown' })],
    ['claims consumer throws', () => {
      routeMocks.verifyFormalCookie.mockReturnValue({ kind: 'verified', verifiedClaims: routeMocks.verifiedClaims });
      routeMocks.consumeClaims.mockImplementation(() => { throw new Error('unavailable'); });
    }],
    ['claims consumer proxy', () => {
      routeMocks.verifyFormalCookie.mockReturnValue({ kind: 'verified', verifiedClaims: routeMocks.verifiedClaims });
      routeMocks.consumeClaims.mockReturnValue(hostileProxy());
    }],
    ['snapshot proxy', () => {
      routeMocks.verifyFormalCookie.mockReturnValue({ kind: 'verified', verifiedClaims: routeMocks.verifiedClaims });
      routeMocks.repository.findCurrentFormalSessionUser.mockResolvedValue(hostileProxy());
    }],
    ['snapshot consumer throws', () => {
      routeMocks.verifyFormalCookie.mockReturnValue({ kind: 'verified', verifiedClaims: routeMocks.verifiedClaims });
      routeMocks.consumeSnapshot.mockImplementation(() => { throw new Error('unavailable'); });
    }],
    ['snapshot consumer unknown user', () => {
      routeMocks.verifyFormalCookie.mockReturnValue({ kind: 'verified', verifiedClaims: routeMocks.verifiedClaims });
      routeMocks.consumeSnapshot.mockReturnValue({ id: 'truthy-only' });
    }],
  ])('formal session hostile %s 返回低敏 503，绝不发布 truthy user', async (_label, arrange) => {
    arrange();
    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET(sessionRequest(`${FORMAL_SERVER_SESSION_COOKIE_V1}=formal`));

    expect(response.status).toBe(503);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual({ authenticated: false, user: null });
    expect(routeMocks.decodeDemoSession).not.toHaveBeenCalled();
  });

  it('formal session DB throw 返回 503 而不混成 401', async () => {
    routeMocks.verifyFormalCookie.mockReturnValue({
      kind: 'verified',
      verifiedClaims: routeMocks.verifiedClaims,
    });
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('database unavailable');
    });
    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET(sessionRequest(`${FORMAL_SERVER_SESSION_COOKIE_V1}=formal`));

    expect(response.status).toBe(503);
    expectNoStore(response);
    expect(routeMocks.decodeDemoSession).not.toHaveBeenCalled();
  });

  it('demo only 接受真实 user/expiresAt/source 结构，且不读取 runtime config/DB', async () => {
    routeMocks.decodeDemoSession.mockReturnValue({
      user: routeMocks.user,
      expiresAt: Date.now() + 60_000,
      source: 'demo_session',
    });
    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET(sessionRequest(`${DEMO_SESSION_COOKIE}=demo`));

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it.each([
    ['enable throws', () => routeMocks.isDemoAuthEnabled.mockImplementation(() => { throw new Error('disabled'); })],
    ['enable unknown', () => routeMocks.isDemoAuthEnabled.mockReturnValue({ enabled: true })],
    ['decoder throws', () => routeMocks.decodeDemoSession.mockImplementation(() => { throw new Error('invalid'); })],
    ['decoder unknown', () => routeMocks.decodeDemoSession.mockReturnValue({
      user: { id: 'truthy-only' },
      expiresAt: Date.now() + 60_000,
      source: 'demo_session',
    })],
    ['decoder expired', () => routeMocks.decodeDemoSession.mockReturnValue({
      user: routeMocks.user,
      expiresAt: Date.now() - 1,
      source: 'demo_session',
    })],
    ['decoder proxy', () => routeMocks.decodeDemoSession.mockReturnValue(hostileProxy())],
  ])('demo session hostile %s 返回 401 且不发布 truthy user', async (_label, arrange) => {
    arrange();
    const { GET } = await import('@/app/api/auth/session/route');
    const response = await GET(sessionRequest(`${DEMO_SESSION_COOKIE}=demo`));

    expect(response.status).toBe(401);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual({ authenticated: false, user: null });
    expectCookieCleared(response, DEMO_SESSION_COOKIE);
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('logout 零 config/DB 并清除两种 cookie', async () => {
    const { POST } = await import('@/app/api/auth/logout/route');
    const response = await POST();

    expect(response.status).toBe(200);
    expectNoStore(response);
    expectCookieCleared(response, FORMAL_SERVER_SESSION_COOKIE_V1);
    expectCookieCleared(response, DEMO_SESSION_COOKIE);
    expect(routeMocks.resolveRuntimeConfig).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(response.headers.get('set-cookie')).not.toContain('Secure');
  });
});
