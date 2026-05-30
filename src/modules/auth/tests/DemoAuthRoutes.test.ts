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
          tenantId: 'demo-tenant-001',
        },
      },
    });

    const sessionResponse = await sessionGet(requestWithCookie(cookie));
    const sessionPayload = await sessionResponse.json();

    expect(sessionResponse.status).toBe(200);
    expect(sessionPayload).toMatchObject({
      authenticated: true,
      user: {
        username: 'admin',
        role: 'tenant_admin',
        tenantId: 'demo-tenant-001',
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
