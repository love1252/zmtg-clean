import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  authenticateDemoUser,
  decodeDemoSession,
  DEMO_SESSION_COOKIE,
  encodeDemoSession,
} from '@/modules/auth/server/demo-session';

const routeMocks = vi.hoisted(() => {
  const repository = {
    findAccountByUsername: vi.fn(),
  };

  return {
    createAuthAccountRepository: vi.fn(),
    database: Object.freeze({ database: 'demo-auth-route-mock' }),
    getDatabase: vi.fn(),
    repository,
  };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return {
    ...actual,
    getDatabase: routeMocks.getDatabase,
  };
});

vi.mock(
  '@/modules/auth/server/auth-account-repository',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/auth/server/auth-account-repository')
      >();

    return {
      ...actual,
      createAuthAccountRepository:
        routeMocks.createAuthAccountRepository,
    };
  },
);

function loginRequest(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function sessionRequest(cookie: string) {
  return new Request('http://localhost/api/auth/session', {
    headers: { cookie },
  });
}

function readNamedCookie(setCookie: string | null, name: string) {
  expect(setCookie).toBeTruthy();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = setCookie?.match(
    new RegExp(`${escaped}=([^;,]*)`, 'u'),
  );
  expect(match).toBeTruthy();
  return `${name}=${match?.[1] ?? ''}`;
}

function expectNoStore(response: Response) {
  expect(response.headers.get('cache-control')).toBe('no-store');
}

function expectDemoCookieCleared(response: Response) {
  const setCookie = response.headers.get('set-cookie');
  expect(setCookie).toContain(`${DEMO_SESSION_COOKIE}=`);
  expect(setCookie).toContain('Max-Age=0');
}

const demoAdmin = Object.freeze({
  id: 'demo-user-admin',
  username: 'admin',
  name: '系统管理员',
  role: 'tenant_admin' as const,
  tenantId: 'growth-tenant-chengxing',
  institutionId: 'growth-inst-chengxing',
});

beforeEach(() => {
  vi.resetModules();

  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);

  routeMocks.createAuthAccountRepository.mockReset();
  routeMocks.createAuthAccountRepository.mockReturnValue(
    routeMocks.repository,
  );

  routeMocks.repository.findAccountByUsername.mockReset();
  routeMocks.repository.findAccountByUsername.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('演示认证契约治理', () => {
  it('把演示会话编码为可解码的签名令牌', () => {
    const session = {
      user: demoAdmin,
      expiresAt: Date.now() + 60_000,
      source: 'demo_session' as const,
    };

    const encoded = encodeDemoSession(session);
    const unsigned = Buffer.from(
      JSON.stringify(session),
      'utf8',
    ).toString('base64url');

    expect(encoded).not.toBe(unsigned);
    expect(encoded.split('.')).toHaveLength(2);
    expect(decodeDemoSession(encoded)).toEqual(session);
  });

  it('拒绝签名载荷被篡改的演示会话', () => {
    const session = {
      user: demoAdmin,
      expiresAt: Date.now() + 60_000,
      source: 'demo_session' as const,
    };

    const encoded = encodeDemoSession(session);
    const [payload, signature] = encoded.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        ...session,
        user: {
          ...session.user,
          role: 'platform_admin',
          tenantId: null,
          institutionId: null,
        },
      }),
      'utf8',
    ).toString('base64url');

    expect(
      decodeDemoSession(`${tamperedPayload}.${signature}`),
    ).toBeNull();
    expect(decodeDemoSession(payload)).toBeNull();
  });

  it('拒绝签名正确但来源枚举未知的会话', () => {
    const encoded = encodeDemoSession({
      user: demoAdmin,
      expiresAt: Date.now() + 60_000,
      source: 'trusted_gateway' as 'server_session',
    });

    expect(decodeDemoSession(encoded)).toBeNull();
  });

  it('保留 legacy cookie 解码单元契约，但当前路由 fail-closed', async () => {
    const encoded = encodeDemoSession({
      user: demoAdmin,
      expiresAt: Date.now() + 60_000,
    });

    expect(decodeDemoSession(encoded)?.source).toBeUndefined();

    const { GET } = await import(
      '@/app/api/auth/session/route'
    );
    const response = await GET(
      sessionRequest(`${DEMO_SESSION_COOKIE}=${encoded}`),
    );

    expect(response.status).toBe(401);
    expectNoStore(response);
    expectDemoCookieCleared(response);
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('生产环境编码前必须配置演示会话密钥', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ZMTG_ENABLE_DEMO_AUTH', 'true');
    vi.stubEnv('ZMTG_DEMO_SESSION_SECRET', '');

    expect(() =>
      encodeDemoSession({
        user: demoAdmin,
        expiresAt: Date.now() + 60_000,
        source: 'demo_session',
      }),
    ).toThrow('ZMTG_DEMO_SESSION_SECRET');
  });

  it('生产环境缺少 Demo Session 密钥时路由返回受控 503', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ZMTG_ENABLE_DEMO_AUTH', 'true');
    vi.stubEnv('ZMTG_DEMO_SESSION_SECRET', '');

    const { POST } = await import(
      '@/app/api/auth/login/route'
    );
    const response = await POST(
      loginRequest({
        username: 'admin',
        password: 'admin123',
        scope: 'institution',
      }),
    );

    expect(response.status).toBe(503);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual({
      code: 503,
      message: '登录暂不可用',
    });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(routeMocks.getDatabase).toHaveBeenCalledTimes(1);
    expect(
      routeMocks.repository.findAccountByUsername,
    ).toHaveBeenCalledWith('admin');
  });

  it('生产关闭演示认证时拒绝 demo 与 legacy 会话', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ZMTG_ENABLE_DEMO_AUTH', 'false');
    vi.stubEnv(
      'ZMTG_DEMO_SESSION_SECRET',
      'demo-session-gate-test-signing-key',
    );

    const expiresAt = Date.now() + 60_000;
    const demoSession = encodeDemoSession({
      user: demoAdmin,
      expiresAt,
      source: 'demo_session',
    });
    const legacySession = encodeDemoSession({
      user: demoAdmin,
      expiresAt,
    });

    const { GET } = await import(
      '@/app/api/auth/session/route'
    );
    const demoResponse = await GET(
      sessionRequest(
        `${DEMO_SESSION_COOKIE}=${demoSession}`,
      ),
    );
    const legacyResponse = await GET(
      sessionRequest(
        `${DEMO_SESSION_COOKIE}=${legacySession}`,
      ),
    );

    expect(demoResponse.status).toBe(401);
    expect(legacyResponse.status).toBe(401);
    expectDemoCookieCleared(demoResponse);
    expectDemoCookieCleared(legacyResponse);
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('正式账号不存在时以显式机构 scope 登录真实 Demo fallback', async () => {
    const { POST } = await import(
      '@/app/api/auth/login/route'
    );
    const loginResponse = await POST(
      loginRequest({
        username: 'admin',
        password: 'admin123',
        scope: 'institution',
      }),
    );
    const loginPayload = await loginResponse.json();
    const cookie = readNamedCookie(
      loginResponse.headers.get('set-cookie'),
      DEMO_SESSION_COOKIE,
    );

    expect(loginResponse.status).toBe(200);
    expectNoStore(loginResponse);
    expect(loginPayload).toMatchObject({
      code: 0,
      data: {
        user: {
          username: 'admin',
          role: 'tenant_admin',
          tenantId: 'growth-tenant-chengxing',
          institutionId: 'growth-inst-chengxing',
        },
      },
    });

    const encodedSession = cookie.slice(
      `${DEMO_SESSION_COOKIE}=`.length,
    );
    expect(
      decodeDemoSession(encodedSession)?.source,
    ).toBe('demo_session');

    const { GET } = await import(
      '@/app/api/auth/session/route'
    );
    const sessionResponse = await GET(
      sessionRequest(cookie),
    );

    expect(sessionResponse.status).toBe(200);
    expectNoStore(sessionResponse);
    await expect(sessionResponse.json()).resolves.toMatchObject({
      authenticated: true,
      user: {
        username: 'admin',
        tenantId: 'growth-tenant-chengxing',
        institutionId: 'growth-inst-chengxing',
      },
    });

    expect(routeMocks.getDatabase).toHaveBeenCalledTimes(1);
    expect(
      routeMocks.createAuthAccountRepository,
    ).toHaveBeenCalledWith(routeMocks.database);
  });

  it.each([
    [
      'yunlan_admin',
      'trial-tenant-yunlan',
      'trial-inst-yunlan',
      '云澜轻美诊所管理员',
    ],
    [
      'baiyue_admin',
      'trial-tenant-baiyue',
      'trial-inst-baiyue',
      '柏悦皮肤管理中心管理员',
    ],
    [
      'xinghe_admin',
      'starter-tenant-xinghe',
      'starter-inst-xinghe',
      '星禾医美门诊管理员',
    ],
    [
      'yubai_admin',
      'starter-tenant-yubai',
      'starter-inst-yubai',
      '予白皮肤管理管理员',
    ],
    [
      'chengxing_admin',
      'growth-tenant-chengxing',
      'growth-inst-chengxing',
      '澄星医疗美容管理员',
    ],
    [
      'qingmang_admin',
      'growth-tenant-qingmang',
      'growth-inst-qingmang',
      '青芒美学连锁管理员',
    ],
  ])(
    '%s 保留机构 Demo 用户映射契约',
    (username, tenantId, institutionId, name) => {
      expect(
        authenticateDemoUser({
          username,
          password: 'admin123',
          scope: 'institution',
        }),
      ).toMatchObject({
        username,
        name,
        role: 'tenant_admin',
        tenantId,
        institutionId,
      });
    },
  );

  it('平台 Demo 用户只匹配 platform scope，并完成登录到会话回归', async () => {
    expect(
      authenticateDemoUser({
        username: 'platform',
        password: 'admin123',
        scope: 'institution',
      }),
    ).toBeNull();

    expect(
      authenticateDemoUser({
        username: 'platform',
        password: 'admin123',
        scope: 'platform',
      }),
    ).toMatchObject({
      username: 'platform',
      role: 'platform_admin',
      tenantId: null,
      institutionId: null,
    });

    const { POST } = await import(
      '@/app/api/auth/login/route'
    );
    const loginResponse = await POST(
      loginRequest({
        username: 'platform',
        password: 'admin123',
        scope: 'platform',
      }),
    );
    const loginPayload = await loginResponse.json();
    const cookie = readNamedCookie(
      loginResponse.headers.get('set-cookie'),
      DEMO_SESSION_COOKIE,
    );

    expect(loginResponse.status).toBe(200);
    expectNoStore(loginResponse);
    expect(loginPayload).toMatchObject({
      code: 0,
      data: {
        user: {
          username: 'platform',
          role: 'platform_admin',
          tenantId: null,
          institutionId: null,
        },
      },
    });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(
      routeMocks.createAuthAccountRepository,
    ).not.toHaveBeenCalled();

    const { GET } = await import(
      '@/app/api/auth/session/route'
    );
    const sessionResponse = await GET(
      sessionRequest(cookie),
    );

    expect(sessionResponse.status).toBe(200);
    expectNoStore(sessionResponse);
    await expect(sessionResponse.json()).resolves.toMatchObject({
      authenticated: true,
      user: {
        username: 'platform',
        role: 'platform_admin',
        tenantId: null,
        institutionId: null,
      },
    });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('生产关闭 Demo 认证时平台 scope 返回 401 且零数据库访问', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ZMTG_ENABLE_DEMO_AUTH', 'false');

    const { POST } = await import(
      '@/app/api/auth/login/route'
    );
    const response = await POST(
      loginRequest({
        username: 'platform',
        password: 'admin123',
        scope: 'platform',
      }),
    );

    expect(response.status).toBe(401);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual({
      code: 401,
      message: '用户名或密码错误',
    });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(
      routeMocks.createAuthAccountRepository,
    ).not.toHaveBeenCalled();
  });

  it('Demo 用户映射拒绝错误凭据', () => {
    expect(
      authenticateDemoUser({
        username: 'admin',
        password: 'wrong-password',
        scope: 'institution',
      }),
    ).toBeNull();
  });

  it('logout 保留 Demo cookie 清理契约', async () => {
    const { POST } = await import(
      '@/app/api/auth/logout/route'
    );
    const response = await POST();

    expect(response.status).toBe(200);
    expectNoStore(response);
    expectDemoCookieCleared(response);
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });
});
