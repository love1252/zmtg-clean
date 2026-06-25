import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeDemoSession, DEMO_SESSION_COOKIE } from '@/modules/auth/server/demo-session';
import type { AuthAccountRepository } from '@/modules/auth/server/auth-account-service';

const routeMocks = vi.hoisted(() => {
  const account = {
    id: 'auth-user-zhengpu-admin',
    username: 'zhengpu_admin',
    displayName: '陈磊',
    phone: '13985162273',
    email: null,
    passwordHash: 'scrypt$16384$8$1$salt$hash',
    passwordUpdatedAt: new Date('2026-06-25T07:00:00.000Z'),
    passwordResetRequired: true,
    status: 'password_reset_required',
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdBy: 'demo-user-platform',
    updatedBy: 'demo-user-platform',
    createdAt: new Date('2026-06-25T07:00:00.000Z'),
    updatedAt: new Date('2026-06-25T07:00:00.000Z'),
  };
  const repository = {
    createAccount: vi.fn(),
    findAccountByUsername: vi.fn(),
    findPrimaryTenantMembershipByUserId: vi.fn(),
    recordLoginFailure: vi.fn(),
    recordLoginSuccess: vi.fn(),
    updateAccountStatus: vi.fn(),
    updatePassword: vi.fn(),
  };
  const service = {
    authenticatePasswordAccount: vi.fn(),
  };

  return {
    account,
    createAuthAccountRepository: vi.fn(() => repository),
    createAuthAccountService: vi.fn(() => service),
    database: { database: 'formal-auth-db' },
    getDatabase: vi.fn(),
    repository,
    service,
  };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return {
    ...actual,
    getDatabase: routeMocks.getDatabase,
  };
});

vi.mock('@/modules/auth/server/auth-account-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/auth/server/auth-account-repository')>();
  return {
    ...actual,
    createAuthAccountRepository: routeMocks.createAuthAccountRepository,
  };
});

vi.mock('@/modules/auth/server/auth-account-service', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/auth/server/auth-account-service')>();
  return {
    ...actual,
    createAuthAccountService: routeMocks.createAuthAccountService,
  };
});

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function readCookie(setCookie: string | null) {
  expect(setCookie).toBeTruthy();
  return setCookie?.split(';')[0] ?? '';
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.createAuthAccountRepository.mockClear();
  routeMocks.createAuthAccountService.mockClear();
  Object.values(routeMocks.repository).forEach((mock) => mock.mockReset());
  routeMocks.service.authenticatePasswordAccount.mockReset();
  routeMocks.repository.findAccountByUsername.mockResolvedValue(routeMocks.account);
  routeMocks.service.authenticatePasswordAccount.mockResolvedValue({
    status: 'authenticated',
    passwordResetRequired: true,
    user: {
      id: 'auth-user-zhengpu-admin',
      username: 'zhengpu_admin',
      name: '陈磊',
      role: 'tenant_admin',
      tenantId: 'tenant-zhengpu',
    },
  });
});

describe('正式账号登录路由', () => {
  it('机构端登录优先认证 auth_users，并沿用现有签名 session cookie', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    const response = await POST(
      jsonRequest({
        username: 'zhengpu_admin',
        password: 'Init#2026-Strong',
        scope: 'institution',
      }),
    );
    const payload = await response.json();
    const cookie = readCookie(response.headers.get('set-cookie'));
    const encodedSession = cookie.slice(`${DEMO_SESSION_COOKIE}=`.length);

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      code: 0,
      data: {
        user: {
          id: 'auth-user-zhengpu-admin',
          username: 'zhengpu_admin',
          name: '陈磊',
          role: 'tenant_admin',
          tenantId: 'tenant-zhengpu',
        },
        passwordResetRequired: true,
      },
    });
    expect(routeMocks.getDatabase).toHaveBeenCalledWith();
    expect(routeMocks.createAuthAccountRepository).toHaveBeenCalledWith(routeMocks.database);
    expect(routeMocks.repository.findAccountByUsername).toHaveBeenCalledWith('zhengpu_admin');
    expect(routeMocks.createAuthAccountService).toHaveBeenCalledWith({
      repository: routeMocks.repository as AuthAccountRepository,
    });
    expect(routeMocks.service.authenticatePasswordAccount).toHaveBeenCalledWith({
      username: 'zhengpu_admin',
      plaintextPassword: 'Init#2026-Strong',
      scope: 'institution',
    });
    expect(decodeDemoSession(encodedSession)?.user).toEqual({
      id: 'auth-user-zhengpu-admin',
      username: 'zhengpu_admin',
      name: '陈磊',
      role: 'tenant_admin',
      tenantId: 'tenant-zhengpu',
    });
    expect(JSON.stringify(payload)).not.toMatch(/Init#2026-Strong|passwordHash|scrypt\$/i);
  });

  it('正式账号存在但密码错误时不回退到同名演示账号', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    routeMocks.repository.findAccountByUsername.mockResolvedValue({
      ...routeMocks.account,
      username: 'admin',
    });
    routeMocks.service.authenticatePasswordAccount.mockResolvedValue({
      status: 'rejected',
      reason: 'invalid_credentials',
    });

    const response = await POST(
      jsonRequest({
        username: 'admin',
        password: 'admin123',
        scope: 'institution',
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: 401,
      message: '用户名或密码错误',
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
