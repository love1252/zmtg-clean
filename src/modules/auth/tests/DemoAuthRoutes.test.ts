import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as logoutPost } from '@/app/api/auth/logout/route';
import { GET as sessionGet } from '@/app/api/auth/session/route';
import {
  decodeDemoSession,
  DEMO_SESSION_COOKIE,
  encodeDemoSession,
} from '@/modules/auth/server/demo-session';

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function requestWithCookie(cookie: string) {
  return new Request('http://localhost/api/auth/session', {
    headers: { cookie },
  });
}

function readCookie(setCookie: string | null) {
  expect(setCookie).toBeTruthy();
  return setCookie?.split(';')[0] ?? '';
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('演示认证路由', () => {
  it('把演示会话编码为可解码的签名令牌', () => {
    const session = {
      user: {
        id: 'demo-user-admin',
        username: 'admin',
        name: '系统管理员',
        role: 'tenant_admin' as const,
        tenantId: 'demo-tenant-001',
      },
      expiresAt: Date.now() + 60_000,
      source: 'demo_session' as const,
    };

    const encoded = encodeDemoSession(session);
    const unsigned = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');

    expect(encoded).not.toBe(unsigned);
    expect(encoded.split('.')).toHaveLength(2);
    expect(decodeDemoSession(encoded)).toEqual(session);
  });

  it('拒绝签名载荷被篡改的演示会话', () => {
    const session = {
      user: {
        id: 'demo-user-admin',
        username: 'admin',
        name: '系统管理员',
        role: 'tenant_admin' as const,
        tenantId: 'demo-tenant-001',
      },
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
        },
      }),
      'utf8',
    ).toString('base64url');

    expect(decodeDemoSession(`${tamperedPayload}.${signature}`)).toBeNull();
    expect(decodeDemoSession(payload)).toBeNull();
  });

  it('拒绝签名正确但来源枚举未知的会话', () => {
    const encoded = encodeDemoSession({
      user: {
        id: 'bad-source-user',
        username: 'bad-source',
        name: '未知来源用户',
        role: 'tenant_admin',
        tenantId: 'demo-tenant-001',
      },
      expiresAt: Date.now() + 60_000,
      source: 'trusted_gateway' as 'server_session',
    });

    expect(decodeDemoSession(encoded)).toBeNull();
  });

  it('兼容缺少来源的旧 cookie，不影响既有演示页面会话检查', async () => {
    const encoded = encodeDemoSession({
      user: {
        id: 'legacy-demo-user',
        username: 'legacy-demo',
        name: '旧演示用户',
        role: 'tenant_admin',
        tenantId: 'demo-tenant-001',
      },
      expiresAt: Date.now() + 60_000,
    });

    expect(decodeDemoSession(encoded)?.source).toBeUndefined();
    const response = await sessionGet(
      requestWithCookie(`${DEMO_SESSION_COOKIE}=${encoded}`),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      authenticated: true,
      user: { id: 'legacy-demo-user' },
    });
  });

  it('生产环境编码前必须配置演示会话密钥', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ZMTG_ENABLE_DEMO_AUTH', 'true');
    vi.stubEnv('ZMTG_DEMO_SESSION_SECRET', '');

    expect(() =>
      encodeDemoSession({
        user: {
          id: 'demo-user-admin',
          username: 'admin',
          name: '系统管理员',
          role: 'tenant_admin',
          tenantId: 'demo-tenant-001',
        },
        expiresAt: Date.now() + 60_000,
        source: 'demo_session',
      }),
    ).toThrow('ZMTG_DEMO_SESSION_SECRET');
  });

  it('生产环境演示认证无法签名会话时返回受控错误', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ZMTG_ENABLE_DEMO_AUTH', 'true');
    vi.stubEnv('ZMTG_DEMO_SESSION_SECRET', '');

    const response = await loginPost(jsonRequest({ username: 'admin', password: 'admin123' }));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      code: 503,
      message: '演示登录未配置',
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('生产关闭演示认证时拒绝 demo 与缺少来源的旧会话', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ZMTG_ENABLE_DEMO_AUTH', 'false');
    vi.stubEnv('ZMTG_DEMO_SESSION_SECRET', 'demo-session-gate-test-signing-key');
    const user = {
      id: 'demo-disabled-user',
      username: 'demo-disabled',
      name: '已关闭演示用户',
      role: 'tenant_admin' as const,
      tenantId: 'demo-tenant-001',
    };
    const expiresAt = Date.now() + 60_000;
    const demoSession = encodeDemoSession({ user, expiresAt, source: 'demo_session' });
    const legacySession = encodeDemoSession({ user, expiresAt });

    const demoResponse = await sessionGet(
      requestWithCookie(`${DEMO_SESSION_COOKIE}=${demoSession}`),
    );
    const legacyResponse = await sessionGet(
      requestWithCookie(`${DEMO_SESSION_COOKIE}=${legacySession}`),
    );

    expect(demoResponse.status).toBe(401);
    expect(legacyResponse.status).toBe(401);
  });

  it('登录机构演示用户并返回会话', async () => {
    const loginResponse = await loginPost(jsonRequest({ username: 'admin', password: 'admin123' }));
    const loginPayload = await loginResponse.json();
    const cookie = readCookie(loginResponse.headers.get('set-cookie'));

    expect(loginResponse.status).toBe(200);
    expect(cookie).toContain(`${DEMO_SESSION_COOKIE}=`);
    expect(loginPayload).toMatchObject({
      code: 0,
      data: {
        user: {
          username: 'admin',
          role: 'tenant_admin',
          tenantId: 'growth-tenant-chengxing',
        },
      },
    });
    const encodedSession = cookie.slice(`${DEMO_SESSION_COOKIE}=`.length);
    expect(decodeDemoSession(encodedSession)?.source).toBe('demo_session');

    const sessionResponse = await sessionGet(requestWithCookie(cookie));
    const sessionPayload = await sessionResponse.json();

    expect(sessionResponse.status).toBe(200);
    expect(sessionPayload).toMatchObject({
      authenticated: true,
      user: {
        username: 'admin',
        role: 'tenant_admin',
        tenantId: 'growth-tenant-chengxing',
      },
    });
  });

  it.each([
    ['yunlan_admin', 'trial-tenant-yunlan', '云澜轻美诊所管理员'],
    ['baiyue_admin', 'trial-tenant-baiyue', '柏悦皮肤管理中心管理员'],
    ['xinghe_admin', 'starter-tenant-xinghe', '星禾医美门诊管理员'],
    ['yubai_admin', 'starter-tenant-yubai', '予白皮肤管理管理员'],
    ['chengxing_admin', 'growth-tenant-chengxing', '澄星医疗美容管理员'],
    ['qingmang_admin', 'growth-tenant-qingmang', '青芒美学连锁管理员'],
  ])('%s 可登录机构端并绑定正确租户', async (username, tenantId, name) => {
    const loginResponse = await loginPost(jsonRequest({ username, password: 'admin123' }));
    const loginPayload = await loginResponse.json();
    const cookie = readCookie(loginResponse.headers.get('set-cookie'));

    expect(loginResponse.status).toBe(200);
    expect(loginPayload).toMatchObject({
      code: 0,
      data: {
        user: {
          username,
          name,
          role: 'tenant_admin',
          tenantId,
        },
      },
    });

    const sessionResponse = await sessionGet(requestWithCookie(cookie));
    const sessionPayload = await sessionResponse.json();

    expect(sessionResponse.status).toBe(200);
    expect(sessionPayload).toMatchObject({
      authenticated: true,
      user: {
        username,
        role: 'tenant_admin',
        tenantId,
      },
    });
  });

  it('只允许平台作用域登录平台演示用户', async () => {
    const wrongScopeResponse = await loginPost(jsonRequest({ username: 'platform', password: 'admin123' }));
    expect(wrongScopeResponse.status).toBe(401);

    const loginResponse = await loginPost(jsonRequest({ username: 'platform', password: 'admin123', scope: 'platform' }));
    const loginPayload = await loginResponse.json();

    expect(loginResponse.status).toBe(200);
    expect(loginPayload).toMatchObject({
      code: 0,
      data: {
        user: {
          username: 'platform',
          role: 'platform_admin',
          tenantId: null,
        },
      },
    });
  });

  it('拒绝错误凭据并在退出时清理会话', async () => {
    const rejectedResponse = await loginPost(jsonRequest({ username: 'admin', password: 'wrong-password' }));
    expect(rejectedResponse.status).toBe(401);
    await expect(rejectedResponse.json()).resolves.toMatchObject({
      code: 401,
      message: '用户名或密码错误',
    });

    const logoutResponse = await logoutPost();
    const clearCookie = logoutResponse.headers.get('set-cookie');

    expect(logoutResponse.status).toBe(200);
    expect(clearCookie).toContain(`${DEMO_SESSION_COOKIE}=`);
    expect(clearCookie).toContain('Max-Age=0');
  });
});
