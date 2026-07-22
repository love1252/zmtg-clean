import { describe, expect, it, vi } from 'vitest';
import type {
  AuthAccountInstitutionBindingRecord,
  AuthAccountRecord,
  AuthTenantMembershipRecord,
} from '@/modules/auth/domain/auth-account';
import { canAccessResource } from '@/modules/security/domain/access-control';
import {
  createAuthAccountService,
  type AuthAccountRepository,
} from '@/modules/auth/server/auth-account-service';

const now = new Date('2026-06-25T08:00:00.000Z');

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

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

function expectedLoginAccountState(account: AuthAccountRecord) {
  return {
    passwordHash: account.passwordHash,
    passwordUpdatedAt: new Date(account.passwordUpdatedAt.getTime()),
    passwordResetRequired: account.passwordResetRequired,
    status: account.status,
    lastLoginAt: account.lastLoginAt ? new Date(account.lastLoginAt.getTime()) : null,
    failedLoginCount: account.failedLoginCount,
    lockedUntil: account.lockedUntil ? new Date(account.lockedUntil.getTime()) : null,
    updatedAt: new Date(account.updatedAt.getTime()),
  };
}

function mutateLiveAccountAfterRead(account: AuthAccountRecord) {
  account.id = 'auth-user-mutated';
  account.username = 'mutated_username';
  account.displayName = '变更后姓名';
  account.passwordHash = 'scrypt$mutated';
  account.passwordUpdatedAt.setTime(0);
  account.passwordResetRequired = false;
  account.status = 'disabled';
  account.lastLoginAt?.setTime(0);
  account.failedLoginCount = 99;
  account.lockedUntil?.setTime(0);
  account.updatedAt.setTime(0);
}

const tenantAdminMembership: AuthTenantMembershipRecord = {
  id: 'tenant-member-chenlei',
  tenantId: 'tenant-zhengpu',
  userId: 'auth-user-chenlei',
  role: 'tenant_admin',
  displayName: '陈磊',
  createdAt: new Date('2026-06-25T07:00:00.000Z'),
  updatedAt: new Date('2026-06-25T07:00:00.000Z'),
};

function institutionBinding(
  overrides: Partial<AuthAccountInstitutionBindingRecord> = {},
): AuthAccountInstitutionBindingRecord {
  return {
    id: 'auth-binding-chenlei',
    accountId: 'auth-user-chenlei',
    tenantId: 'tenant-zhengpu',
    institutionId: 'institution-zhengpu',
    status: 'active',
    source: 'manual_admin',
    assignedBy: 'platform-admin',
    assignedAt: new Date('2026-06-25T07:00:00.000Z'),
    expiresAt: null,
    revokedAt: null,
    version: 1,
    createdAt: new Date('2026-06-25T07:00:00.000Z'),
    updatedAt: new Date('2026-06-25T07:00:00.000Z'),
    ...overrides,
  };
}

function createRepository(overrides: Partial<AuthAccountRepository> = {}): AuthAccountRepository {
  return {
    createAccount: vi.fn(async (record) => record),
    findAccountByUsername: vi.fn(async () => null),
    findPrimaryTenantMembershipByUserId: vi.fn(async () => null),
    listActiveInstitutionBindingsByAccountAndTenant: vi.fn(async () => []),
    recordLoginFailure: vi.fn(async () => 'recorded' as const),
    recordLoginSuccess: vi.fn(async () => 'recorded' as const),
    updateAccountStatus: vi.fn(async () => undefined),
    updatePassword: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('正式账号服务', () => {
  it('创建账号时只保存密码哈希，返回结果不泄露明文或哈希字段', async () => {
    const repository = createRepository();
    const passwordHasher = {
      hash: vi.fn(async () => 'scrypt$16384$8$1$salt$hash'),
      verify: vi.fn(),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.createPasswordAccount({
      id: 'auth-user-chenlei',
      username: '  ChenLei_Admin ',
      displayName: '陈磊',
      phone: '13985162273',
      email: 'chenlei@example.com',
      plaintextPassword: 'Init#2026-Strong',
      actorId: 'platform-admin',
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith('Init#2026-Strong');
    expect(repository.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'auth-user-chenlei',
        username: 'chenlei_admin',
        displayName: '陈磊',
        phone: '13985162273',
        email: 'chenlei@example.com',
        passwordHash: 'scrypt$16384$8$1$salt$hash',
        passwordUpdatedAt: now,
        passwordResetRequired: true,
        status: 'password_reset_required',
        createdBy: 'platform-admin',
        updatedBy: 'platform-admin',
        createdAt: now,
        updatedAt: now,
      }),
    );
    expect(result.status).toBe('created');
    expect(JSON.stringify(result)).not.toContain('Init#2026-Strong');
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('scrypt$');
  });

  it('创建账号时拒绝空白密码且不写入 repository', async () => {
    const repository = createRepository();
    const passwordHasher = {
      hash: vi.fn(async () => 'scrypt$16384$8$1$salt$hash'),
      verify: vi.fn(),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.createPasswordAccount({
      id: 'auth-user-chenlei',
      username: 'chenlei_admin',
      displayName: '陈磊',
      phone: '13985162273',
      email: 'chenlei@example.com',
      plaintextPassword: '   ',
      actorId: 'platform-admin',
    });

    expect(result).toEqual({
      status: 'rejected',
      reason: 'password_required',
    });
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(repository.createAccount).not.toHaveBeenCalled();
  });

  it('唯一 active 权威绑定会生成带机构的正式会话用户，并重置失败计数', async () => {
    const account = createAccount({
      passwordResetRequired: true,
      status: 'password_reset_required',
    });
    const repository = createRepository({
      findAccountByUsername: vi.fn(async () => account),
      findPrimaryTenantMembershipByUserId: vi.fn(async () => tenantAdminMembership),
      listActiveInstitutionBindingsByAccountAndTenant: vi.fn(async () => [
        institutionBinding(),
      ]),
    });
    const passwordHasher = {
      hash: vi.fn(),
      verify: vi.fn(async () => true),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.authenticatePasswordAccount({
      username: ' ChenLei_Admin ',
      plaintextPassword: 'Init#2026-Strong',
      scope: 'institution',
    });

    expect(repository.findAccountByUsername).toHaveBeenCalledWith('chenlei_admin');
    expect(passwordHasher.verify).toHaveBeenCalledWith('Init#2026-Strong', account.passwordHash);
    expect(repository.listActiveInstitutionBindingsByAccountAndTenant).toHaveBeenCalledWith({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
    });
    expect(
      vi.mocked(repository.listActiveInstitutionBindingsByAccountAndTenant).mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(repository.recordLoginSuccess).mock.invocationCallOrder[0] ?? 0,
    );
    expect(repository.recordLoginSuccess).toHaveBeenCalledWith({
      accountId: 'auth-user-chenlei',
      expectedState: expectedLoginAccountState(account),
      loggedInAt: now,
      updatedBy: 'auth-user-chenlei',
      status: 'password_reset_required',
    });
    expect(result).toEqual({
      status: 'authenticated',
      passwordResetRequired: true,
      user: {
        id: 'auth-user-chenlei',
        username: 'chenlei_admin',
        name: '陈磊',
        role: 'tenant_admin',
        tenantId: 'tenant-zhengpu',
        institutionId: 'institution-zhengpu',
      },
    });
    expect(canAccessResource({
      context: {
        userId: result.status === 'authenticated' ? result.user.id : '',
        role: 'tenant_admin',
        scope: 'tenant',
        tenantId: 'tenant-zhengpu',
        institutionId: result.status === 'authenticated' ? result.user.institutionId ?? null : null,
        source: 'server_session',
      },
      resource: 'real_channel',
      action: 'execute_once',
      targetTenantId: 'tenant-zhengpu',
    })).toEqual({ allowed: true, reason: 'allowed_by_policy' });
  });

  it.each([
    ['无绑定', []],
    ['多个 active 绑定', [
      institutionBinding({ id: 'binding-a', institutionId: 'institution-a' }),
      institutionBinding({ id: 'binding-b', institutionId: 'institution-b' }),
    ]],
    ['revoked 绑定', [institutionBinding({
      status: 'revoked',
      revokedAt: new Date('2026-06-25T07:30:00.000Z'),
    })]],
    ['过期绑定', [institutionBinding({
      expiresAt: now,
    })]],
    ['未来生效绑定', [institutionBinding({
      assignedAt: new Date('2026-06-25T08:01:00.000Z'),
    })]],
    ['migration placeholder 绑定', [institutionBinding({
      source: 'migration_placeholder',
    })]],
    ['非法版本绑定', [institutionBinding({ version: 0 })]],
  ] as const)('%s 时 institutionId=null 且 execute_once 失败关闭', async (_label, bindings) => {
    const repository = createRepository({
      findAccountByUsername: vi.fn(async () => createAccount()),
      findPrimaryTenantMembershipByUserId: vi.fn(async () => tenantAdminMembership),
      listActiveInstitutionBindingsByAccountAndTenant: vi.fn(async () => [...bindings]),
    });
    const service = createAuthAccountService({
      repository,
      passwordHasher: {
        hash: vi.fn(),
        verify: vi.fn(async () => true),
      },
      now: () => now,
    });

    const result = await service.authenticatePasswordAccount({
      username: 'chenlei_admin',
      plaintextPassword: 'Init#2026-Strong',
      scope: 'institution',
    });

    expect(result).toMatchObject({
      status: 'authenticated',
      user: { institutionId: null },
    });
    expect(canAccessResource({
      context: {
        userId: 'auth-user-chenlei',
        role: 'tenant_admin',
        scope: 'tenant',
        tenantId: 'tenant-zhengpu',
        institutionId: null,
        source: 'server_session',
      },
      resource: 'real_channel',
      action: 'execute_once',
      targetTenantId: 'tenant-zhengpu',
    })).toEqual({ allowed: false, reason: 'role_denied' });
  });

  it('错误密码会累计失败次数，达到阈值时锁定账号但不暴露具体敏感信息', async () => {
    const account = createAccount({ failedLoginCount: 4 });
    const repository = createRepository({
      findAccountByUsername: vi.fn(async () => account),
    });
    const passwordHasher = {
      hash: vi.fn(),
      verify: vi.fn(async () => false),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.authenticatePasswordAccount({
      username: 'chenlei_admin',
      plaintextPassword: 'wrong-password',
      scope: 'institution',
    });

    expect(repository.recordLoginFailure).toHaveBeenCalledWith({
      accountId: 'auth-user-chenlei',
      expectedState: expectedLoginAccountState(account),
      failedAt: now,
      updatedBy: 'auth-user-chenlei',
      failedLoginCount: 5,
      status: 'locked',
      lockedUntil: new Date('2026-06-25T08:15:00.000Z'),
    });
    expect(result).toEqual({
      status: 'rejected',
      reason: 'invalid_credentials',
    });
    expect(JSON.stringify(result)).not.toContain('wrong-password');
    expect(JSON.stringify(result)).not.toContain('scrypt$');
  });

  it('登录成功 CAS 发现账号状态变化时低敏拒绝且不发放用户', async () => {
    const account = createAccount();
    const repository = createRepository({
      findAccountByUsername: vi.fn(async () => account),
      findPrimaryTenantMembershipByUserId: vi.fn(async () => tenantAdminMembership),
      listActiveInstitutionBindingsByAccountAndTenant: vi.fn(async () => [
        institutionBinding(),
      ]),
      recordLoginSuccess: vi.fn(async () => 'state_changed' as const),
    });
    const service = createAuthAccountService({
      repository,
      passwordHasher: {
        hash: vi.fn(),
        verify: vi.fn(async () => true),
      },
      now: () => now,
    });

    const result = await service.authenticatePasswordAccount({
      username: account.username,
      plaintextPassword: 'Init#2026-Strong',
      scope: 'institution',
    });

    expect(result).toEqual({ status: 'rejected', reason: 'state_changed' });
    expect(JSON.stringify(result)).not.toContain(account.id);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('scrypt$');
  });

  it('登录失败 CAS 发现账号状态变化时低敏拒绝且不继续读取成员关系', async () => {
    const account = createAccount();
    const repository = createRepository({
      findAccountByUsername: vi.fn(async () => account),
      recordLoginFailure: vi.fn(async () => 'state_changed' as const),
    });
    const service = createAuthAccountService({
      repository,
      passwordHasher: {
        hash: vi.fn(),
        verify: vi.fn(async () => false),
      },
      now: () => now,
    });

    const result = await service.authenticatePasswordAccount({
      username: account.username,
      plaintextPassword: 'wrong-password',
      scope: 'institution',
    });

    expect(result).toEqual({ status: 'rejected', reason: 'state_changed' });
    expect(repository.findPrimaryTenantMembershipByUserId).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(account.id);
    expect(JSON.stringify(result)).not.toContain('scrypt$');
  });

  it.each(['recorded', 'state_changed'] as const)(
    '登录失败 deferred 期间 live account 变更时仍只用冻结快照并返回 %s 对应结果',
    async (writeResult) => {
      const account = createAccount({
        failedLoginCount: 4,
        lastLoginAt: new Date('2026-06-25T06:30:00.000Z'),
        lockedUntil: new Date('2026-06-25T07:30:00.000Z'),
      });
      const accountId = account.id;
      const username = account.username;
      const expectedState = expectedLoginAccountState(account);
      const verification = createDeferred<boolean>();
      const verify = vi.fn(() => verification.promise);
      const repository = createRepository({
        findAccountByUsername: vi.fn(async () => account),
        recordLoginFailure: vi.fn(async () => writeResult),
      });
      const service = createAuthAccountService({
        repository,
        passwordHasher: {
          hash: vi.fn(),
          verify,
        },
        now: () => now,
      });

      const resultPromise = service.authenticatePasswordAccount({
        username,
        plaintextPassword: 'wrong-password',
        scope: 'institution',
      });
      await vi.waitFor(() => expect(verify).toHaveBeenCalledOnce());
      mutateLiveAccountAfterRead(account);
      verification.resolve(false);
      const result = await resultPromise;

      expect(repository.recordLoginFailure).toHaveBeenCalledWith({
        accountId,
        expectedState,
        failedAt: now,
        updatedBy: accountId,
        failedLoginCount: 5,
        status: 'locked',
        lockedUntil: new Date('2026-06-25T08:15:00.000Z'),
      });
      const write = vi.mocked(repository.recordLoginFailure).mock.calls[0]?.[0];
      expect(Object.isFrozen(write?.expectedState)).toBe(true);
      expect(Object.isFrozen(write?.expectedState.passwordUpdatedAt)).toBe(true);
      expect(Object.isFrozen(write?.expectedState.lastLoginAt)).toBe(true);
      expect(Object.isFrozen(write?.expectedState.lockedUntil)).toBe(true);
      expect(Object.isFrozen(write?.expectedState.updatedAt)).toBe(true);
      expect(result).toEqual(
        writeResult === 'recorded'
          ? { status: 'rejected', reason: 'invalid_credentials' }
          : { status: 'rejected', reason: 'state_changed' },
      );
    },
  );

  it.each(['recorded', 'state_changed'] as const)(
    '登录成功 deferred 期间 live account 变更时后续状态、CAS 与会话只用快照并返回 %s 对应结果',
    async (writeResult) => {
      const account = createAccount({
        passwordResetRequired: true,
        status: 'password_reset_required',
        lastLoginAt: new Date('2026-06-25T06:30:00.000Z'),
        lockedUntil: new Date('2026-06-25T07:30:00.000Z'),
      });
      const accountId = account.id;
      const username = account.username;
      const expectedState = expectedLoginAccountState(account);
      const verification = createDeferred<boolean>();
      const verify = vi.fn(() => verification.promise);
      const repository = createRepository({
        findAccountByUsername: vi.fn(async () => account),
        findPrimaryTenantMembershipByUserId: vi.fn(async () => tenantAdminMembership),
        listActiveInstitutionBindingsByAccountAndTenant: vi.fn(async () => [
          institutionBinding(),
        ]),
        recordLoginSuccess: vi.fn(async () => writeResult),
      });
      const service = createAuthAccountService({
        repository,
        passwordHasher: { hash: vi.fn(), verify },
        now: () => now,
      });

      const resultPromise = service.authenticatePasswordAccount({
        username,
        plaintextPassword: 'Init#2026-Strong',
        scope: 'institution',
      });
      await vi.waitFor(() => expect(verify).toHaveBeenCalledOnce());
      mutateLiveAccountAfterRead(account);
      verification.resolve(true);
      const result = await resultPromise;

      expect(repository.findPrimaryTenantMembershipByUserId).toHaveBeenCalledWith(accountId);
      expect(repository.recordLoginSuccess).toHaveBeenCalledWith({
        accountId,
        expectedState,
        loggedInAt: now,
        updatedBy: accountId,
        status: 'password_reset_required',
      });
      const write = vi.mocked(repository.recordLoginSuccess).mock.calls[0]?.[0];
      expect(Object.isFrozen(write?.expectedState)).toBe(true);
      expect(Object.isFrozen(write?.expectedState.passwordUpdatedAt)).toBe(true);
      expect(Object.isFrozen(write?.expectedState.lastLoginAt)).toBe(true);
      expect(Object.isFrozen(write?.expectedState.lockedUntil)).toBe(true);
      expect(Object.isFrozen(write?.expectedState.updatedAt)).toBe(true);
      expect(result).toEqual(
        writeResult === 'recorded'
          ? {
              status: 'authenticated',
              passwordResetRequired: true,
              user: {
                id: accountId,
                username,
                name: '陈磊',
                role: 'tenant_admin',
                tenantId: 'tenant-zhengpu',
                institutionId: 'institution-zhengpu',
              },
            }
          : { status: 'rejected', reason: 'state_changed' },
      );
    },
  );

  it('停用账号不会进入密码校验，也不会写入登录成功', async () => {
    const repository = createRepository({
      findAccountByUsername: vi.fn(async () => createAccount({ status: 'disabled' })),
    });
    const passwordHasher = {
      hash: vi.fn(),
      verify: vi.fn(async () => true),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.authenticatePasswordAccount({
      username: 'chenlei_admin',
      plaintextPassword: 'Init#2026-Strong',
      scope: 'institution',
    });

    expect(passwordHasher.verify).not.toHaveBeenCalled();
    expect(repository.recordLoginSuccess).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: 'rejected',
      reason: 'account_disabled',
    });
  });

  it('重置密码只写入新哈希和重置状态，不返回明文', async () => {
    const repository = createRepository();
    const passwordHasher = {
      hash: vi.fn(async () => 'scrypt$16384$8$1$newSalt$newHash'),
      verify: vi.fn(),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.resetPassword({
      accountId: 'auth-user-chenlei',
      plaintextPassword: 'New#2026-Strong',
      actorId: 'platform-admin',
    });

    expect(repository.updatePassword).toHaveBeenCalledWith({
      accountId: 'auth-user-chenlei',
      passwordHash: 'scrypt$16384$8$1$newSalt$newHash',
      passwordUpdatedAt: now,
      passwordResetRequired: true,
      status: 'password_reset_required',
      updatedAt: now,
      updatedBy: 'platform-admin',
    });
    expect(result).toEqual({ status: 'password_reset_required' });
    expect(JSON.stringify(result)).not.toContain('New#2026-Strong');
  });

  it('重置密码拒绝空白密码且不写入 repository', async () => {
    const repository = createRepository();
    const passwordHasher = {
      hash: vi.fn(async () => 'scrypt$16384$8$1$newSalt$newHash'),
      verify: vi.fn(),
    };
    const service = createAuthAccountService({
      repository,
      passwordHasher,
      now: () => now,
    });

    const result = await service.resetPassword({
      accountId: 'auth-user-chenlei',
      plaintextPassword: '  ',
      actorId: 'platform-admin',
    });

    expect(result).toEqual({
      status: 'rejected',
      reason: 'password_required',
    });
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(repository.updatePassword).not.toHaveBeenCalled();
  });
});
