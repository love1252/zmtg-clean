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

describe('demo auth routes', () => {
  it('encodes demo sessions as signed tokens that can be decoded', () => {
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

  it('rejects demo sessions when the signed payload is tampered', () => {
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

  it('requires a configured demo session secret before encoding in production', () => {
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

  it('logs in an institution demo user and exposes the session', async () => {
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

  it('logs in a platform demo user only with platform scope', async () => {
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

  it('rejects bad credentials and clears sessions on logout', async () => {
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
