import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthAccountRecord } from '@/modules/auth/domain/auth-account';
import { createAuthAccountRepository } from '@/modules/auth/server/auth-account-repository';
import type { TenantDatabase } from '@/server/db/client';
import { authUsers } from '@/server/db/schema';

const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({
    conditions,
    operator: 'and',
  })),
);

const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'eq',
    value,
  })),
);

const isNullMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    operator: 'isNull',
  })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: andMock,
    eq: eqMock,
    isNull: isNullMock,
  };
});

const accountRow: AuthAccountRecord = {
  id: 'auth-user-chenlei',
  username: 'chenlei_admin',
  displayName: '陈磊',
  phone: '13985162273',
  email: 'chenlei@example.com',
  passwordHash: 'scrypt$16384$8$1$salt$hash',
  passwordUpdatedAt: new Date('2026-06-25T07:00:00.000Z'),
  passwordResetRequired: true,
  status: 'password_reset_required',
  lastLoginAt: null,
  failedLoginCount: 0,
  lockedUntil: null,
  createdBy: 'platform-admin',
  updatedBy: 'platform-admin',
  createdAt: new Date('2026-06-25T07:00:00.000Z'),
  updatedAt: new Date('2026-06-25T07:00:00.000Z'),
};

const loginTimestamp = new Date('2026-06-25T08:00:00.000Z');

function expectedLoginAccountState(
  overrides: Partial<Pick<
    AuthAccountRecord,
    | 'passwordHash'
    | 'passwordUpdatedAt'
    | 'passwordResetRequired'
    | 'status'
    | 'lastLoginAt'
    | 'failedLoginCount'
    | 'lockedUntil'
    | 'updatedAt'
  >> = {},
) {
  return {
    passwordHash: accountRow.passwordHash,
    passwordUpdatedAt: accountRow.passwordUpdatedAt,
    passwordResetRequired: accountRow.passwordResetRequired,
    status: accountRow.status,
    lastLoginAt: accountRow.lastLoginAt,
    failedLoginCount: accountRow.failedLoginCount,
    lockedUntil: accountRow.lockedUntil,
    updatedAt: accountRow.updatedAt,
    ...overrides,
  };
}

function createSelectChain(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    limit,
    where: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);

  return {
    chain,
    from: chain.from,
    innerJoin: chain.innerJoin,
    leftJoin: chain.leftJoin,
    limit,
    where: chain.where,
  };
}

function createInsertChain(rows: unknown[]) {
  const returning = vi.fn(async () => rows);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn((table: unknown) => ({ values }));

  return {
    insert,
    returning,
    values,
  };
}

function createUpdateChain(rows: unknown[]) {
  const returning = vi.fn(async () => rows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn((_values: unknown) => ({ where }));
  const update = vi.fn((table: unknown) => ({ set }));

  return {
    returning,
    set,
    update,
    where,
  };
}

function createDatabase(input: {
  insertRows?: unknown[];
  selectRows?: unknown[][];
  updateRows?: unknown[];
} = {}) {
  const allSelectChains = (input.selectRows ?? []).map(createSelectChain);
  const selectChains = [...allSelectChains];
  const insertChain = createInsertChain(input.insertRows ?? []);
  const updateChain = createUpdateChain(
    input.updateRows ?? [{ accountId: accountRow.id }],
  );
  const select = vi.fn(() => {
    const next = selectChains.shift();
    if (!next) throw new Error('没有配置更多 select chain');
    return next.chain;
  });

  return {
    database: {
      insert: insertChain.insert,
      select,
      update: updateChain.update,
    } as unknown as TenantDatabase,
    insertChain,
    select,
    selectChains: allSelectChains,
    updateChain,
  };
}

beforeEach(() => {
  andMock.mockClear();
  eqMock.mockClear();
  isNullMock.mockClear();
});

describe('正式账号 repository', () => {
  it('按标准化账号查询 auth_users 并返回完整内部账号记录', async () => {
    const query = createDatabase({
      selectRows: [[accountRow]],
    });

    const result = await createAuthAccountRepository(query.database).findAccountByUsername(
      'chenlei_admin',
    );

    expect(query.selectChains[0].from).toHaveBeenCalledWith(authUsers);
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      column: authUsers.username,
      operator: 'eq',
      value: 'chenlei_admin',
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(accountRow);
  });

  it('创建账号时写入 auth_users 并通过 returning 取回落库记录', async () => {
    const query = createDatabase({
      insertRows: [accountRow],
    });

    const result = await createAuthAccountRepository(query.database).createAccount(accountRow);

    expect(query.insertChain.insert).toHaveBeenCalledWith(authUsers);
    expect(query.insertChain.values).toHaveBeenCalledWith(accountRow);
    expect(query.insertChain.returning).toHaveBeenCalledTimes(1);
    expect(result).toEqual(accountRow);
  });

  it('记录登录失败时以完整旧状态 CAS 且只更新失败计数、锁定状态和更新时间', async () => {
    const query = createDatabase();
    const failedAt = new Date('2026-06-25T08:00:00.000Z');
    const lockedUntil = new Date('2026-06-25T08:15:00.000Z');
    const expectedState = expectedLoginAccountState();

    const result = await createAuthAccountRepository(query.database).recordLoginFailure({
      accountId: 'auth-user-chenlei',
      expectedState,
      failedAt,
      updatedBy: 'auth-user-chenlei',
      failedLoginCount: 5,
      status: 'locked',
      lockedUntil,
    });

    expect(query.updateChain.update).toHaveBeenCalledWith(authUsers);
    expect(query.updateChain.set).toHaveBeenCalledWith({
      failedLoginCount: 5,
      lockedUntil,
      status: 'locked',
      updatedAt: failedAt,
      updatedBy: 'auth-user-chenlei',
    });
    expect(query.updateChain.where).toHaveBeenCalledWith({
      operator: 'and',
      conditions: [
        { column: authUsers.id, operator: 'eq', value: 'auth-user-chenlei' },
        { column: authUsers.passwordHash, operator: 'eq', value: expectedState.passwordHash },
        {
          column: authUsers.passwordUpdatedAt,
          operator: 'eq',
          value: expectedState.passwordUpdatedAt,
        },
        {
          column: authUsers.passwordResetRequired,
          operator: 'eq',
          value: expectedState.passwordResetRequired,
        },
        { column: authUsers.status, operator: 'eq', value: expectedState.status },
        { column: authUsers.lastLoginAt, operator: 'isNull' },
        {
          column: authUsers.failedLoginCount,
          operator: 'eq',
          value: expectedState.failedLoginCount,
        },
        { column: authUsers.lockedUntil, operator: 'isNull' },
        { column: authUsers.updatedAt, operator: 'eq', value: expectedState.updatedAt },
      ],
    });
    expect(query.updateChain.returning).toHaveBeenCalledWith({ accountId: authUsers.id });
    expect(result).toBe('recorded');
    const mutation = query.updateChain.set.mock.calls[0]?.[0];
    expect(mutation).not.toHaveProperty('passwordHash');
    expect(mutation).not.toHaveProperty('passwordUpdatedAt');
    expect(mutation).not.toHaveProperty('passwordResetRequired');
  });

  it('记录登录成功时以完整旧状态 CAS，清空锁定与失败计数并保留重置状态', async () => {
    const query = createDatabase();
    const loggedInAt = new Date('2026-06-25T08:00:00.000Z');
    const expectedState = expectedLoginAccountState();

    const result = await createAuthAccountRepository(query.database).recordLoginSuccess({
      accountId: 'auth-user-chenlei',
      expectedState,
      loggedInAt,
      updatedBy: 'auth-user-chenlei',
      status: 'password_reset_required',
    });

    expect(query.updateChain.set).toHaveBeenCalledWith({
      failedLoginCount: 0,
      lastLoginAt: loggedInAt,
      lockedUntil: null,
      status: 'password_reset_required',
      updatedAt: loggedInAt,
      updatedBy: 'auth-user-chenlei',
    });
    expect(query.updateChain.where).toHaveBeenCalledWith({
      operator: 'and',
      conditions: [
        { column: authUsers.id, operator: 'eq', value: 'auth-user-chenlei' },
        { column: authUsers.passwordHash, operator: 'eq', value: expectedState.passwordHash },
        {
          column: authUsers.passwordUpdatedAt,
          operator: 'eq',
          value: expectedState.passwordUpdatedAt,
        },
        {
          column: authUsers.passwordResetRequired,
          operator: 'eq',
          value: expectedState.passwordResetRequired,
        },
        { column: authUsers.status, operator: 'eq', value: expectedState.status },
        { column: authUsers.lastLoginAt, operator: 'isNull' },
        {
          column: authUsers.failedLoginCount,
          operator: 'eq',
          value: expectedState.failedLoginCount,
        },
        { column: authUsers.lockedUntil, operator: 'isNull' },
        { column: authUsers.updatedAt, operator: 'eq', value: expectedState.updatedAt },
      ],
    });
    expect(query.updateChain.returning).toHaveBeenCalledWith({ accountId: authUsers.id });
    expect(result).toBe('recorded');
  });

  it('非空可空字段使用等值 CAS 而不是 isNull', async () => {
    const lastLoginAt = new Date('2026-06-25T07:30:00.000Z');
    const lockedUntil = new Date('2026-06-25T08:15:00.000Z');
    const expectedState = expectedLoginAccountState({ lastLoginAt, lockedUntil });
    const query = createDatabase();

    await createAuthAccountRepository(query.database).recordLoginFailure({
      accountId: accountRow.id,
      expectedState,
      failedAt: loginTimestamp,
      updatedBy: accountRow.id,
      failedLoginCount: 5,
      status: 'locked',
      lockedUntil,
    });

    expect(eqMock).toHaveBeenCalledWith(authUsers.lastLoginAt, lastLoginAt);
    expect(eqMock).toHaveBeenCalledWith(authUsers.lockedUntil, lockedUntil);
    expect(isNullMock).not.toHaveBeenCalled();
  });

  it.each([
    ['零行', []],
    ['多行', [{ accountId: accountRow.id }, { accountId: accountRow.id }]],
    ['错误账号行', [{ accountId: 'auth-user-other' }]],
  ])('登录失败 CAS 返回%s时报告 state_changed', async (_label, updateRows) => {
    const query = createDatabase({ updateRows });

    const result = await createAuthAccountRepository(query.database).recordLoginFailure({
      accountId: accountRow.id,
      expectedState: expectedLoginAccountState(),
      failedAt: loginTimestamp,
      updatedBy: accountRow.id,
      failedLoginCount: 1,
      status: 'active',
      lockedUntil: null,
    });

    expect(result).toBe('state_changed');
  });

  it.each([
    ['零行', []],
    ['多行', [{ accountId: accountRow.id }, { accountId: accountRow.id }]],
    ['错误账号行', [{ accountId: 'auth-user-other' }]],
  ])('登录成功 CAS 返回%s时报告 state_changed', async (_label, updateRows) => {
    const query = createDatabase({ updateRows });

    const result = await createAuthAccountRepository(query.database).recordLoginSuccess({
      accountId: accountRow.id,
      expectedState: expectedLoginAccountState(),
      loggedInAt: loginTimestamp,
      updatedBy: accountRow.id,
      status: 'active',
    });

    expect(result).toBe('state_changed');
  });

  it('登录失败 CAS 的 returning 拒绝会原样向上传播', async () => {
    const databaseError = new Error('record login failure returning failed');
    const query = createDatabase();
    query.updateChain.returning.mockRejectedValueOnce(databaseError);

    const result = createAuthAccountRepository(query.database).recordLoginFailure({
      accountId: accountRow.id,
      expectedState: expectedLoginAccountState(),
      failedAt: loginTimestamp,
      updatedBy: accountRow.id,
      failedLoginCount: 1,
      status: 'active',
      lockedUntil: null,
    });

    await expect(result).rejects.toBe(databaseError);
  });

  it('登录成功 CAS 的 returning 拒绝会原样向上传播', async () => {
    const databaseError = new Error('record login success returning failed');
    const query = createDatabase();
    query.updateChain.returning.mockRejectedValueOnce(databaseError);

    const result = createAuthAccountRepository(query.database).recordLoginSuccess({
      accountId: accountRow.id,
      expectedState: expectedLoginAccountState(),
      loggedInAt: loginTimestamp,
      updatedBy: accountRow.id,
      status: 'active',
    });

    await expect(result).rejects.toBe(databaseError);
  });
});
