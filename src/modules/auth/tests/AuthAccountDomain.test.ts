import { describe, expect, it } from 'vitest';
import {
  AUTH_ACCOUNT_STATUSES,
  buildFailedPasswordLoginState,
  canStartPasswordCredentialLogin,
  isAuthAccountStatus,
  normalizeAuthUsername,
  toSafeAuthAccount,
  type AuthAccountRecord,
} from '@/modules/auth/domain/auth-account';

const now = new Date('2026-06-25T08:00:00.000Z');

function createAccount(overrides: Partial<AuthAccountRecord> = {}): AuthAccountRecord {
  return {
    id: 'auth-user-chenlei',
    username: 'chenlei_admin',
    displayName: '陈磊',
    phone: '13985162273',
    email: 'chenlei@example.com',
    passwordHash: 'scrypt$16384$8$1$salt$hash',
    passwordUpdatedAt: new Date('2026-06-25T07:00:00.000Z'),
    passwordResetRequired: false,
    status: 'active',
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdBy: 'platform-admin',
    updatedBy: 'platform-admin',
    createdAt: new Date('2026-06-25T07:00:00.000Z'),
    updatedAt: new Date('2026-06-25T07:00:00.000Z'),
    ...overrides,
  };
}

describe('正式认证账号领域', () => {
  it('限定正式账号状态并标准化登录账号', () => {
    expect(AUTH_ACCOUNT_STATUSES).toEqual([
      'active',
      'password_reset_required',
      'disabled',
      'locked',
    ]);
    expect(isAuthAccountStatus('password_reset_required')).toBe(true);
    expect(isAuthAccountStatus('trial')).toBe(false);
    expect(normalizeAuthUsername('  ChenLei_Admin  ')).toBe('chenlei_admin');
  });

  it('允许 active 和 password_reset_required 账号进入密码认证，但拒绝停用和锁定账号', () => {
    expect(canStartPasswordCredentialLogin(createAccount(), now)).toEqual({
      allowed: true,
      passwordResetRequired: false,
    });
    expect(
      canStartPasswordCredentialLogin(
        createAccount({ passwordResetRequired: true, status: 'password_reset_required' }),
        now,
      ),
    ).toEqual({
      allowed: true,
      passwordResetRequired: true,
    });
    expect(canStartPasswordCredentialLogin(createAccount({ status: 'disabled' }), now)).toEqual({
      allowed: false,
      reason: 'account_disabled',
    });
    expect(
      canStartPasswordCredentialLogin(
        createAccount({
          status: 'locked',
          lockedUntil: new Date('2026-06-25T08:14:00.000Z'),
        }),
        now,
      ),
    ).toEqual({
      allowed: false,
      reason: 'account_locked',
      lockedUntil: new Date('2026-06-25T08:14:00.000Z'),
    });
  });

  it('连续错误密码达到阈值时生成锁定状态和明确截止时间', () => {
    expect(
      buildFailedPasswordLoginState(createAccount({ failedLoginCount: 1 }), {
        now,
        maxFailedAttempts: 5,
        lockMinutes: 15,
      }),
    ).toEqual({
      failedLoginCount: 2,
      status: 'active',
      lockedUntil: null,
    });

    expect(
      buildFailedPasswordLoginState(createAccount({ failedLoginCount: 4 }), {
        now,
        maxFailedAttempts: 5,
        lockMinutes: 15,
      }),
    ).toEqual({
      failedLoginCount: 5,
      status: 'locked',
      lockedUntil: new Date('2026-06-25T08:15:00.000Z'),
    });
  });

  it('对外账号 DTO 不包含密码哈希', () => {
    const safeAccount = toSafeAuthAccount(createAccount());

    expect(safeAccount).toMatchObject({
      id: 'auth-user-chenlei',
      username: 'chenlei_admin',
      displayName: '陈磊',
      phone: '13985162273',
      email: 'chenlei@example.com',
    });
    expect(safeAccount).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(safeAccount)).not.toContain('scrypt$');
  });
});
