import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { AuthAccountRecord } from '@/modules/auth/domain/auth-account';
import {
  consumeFormalServerSessionUserSnapshotV1,
  createAuthAccountRepository,
  isFormalServerSessionUserSnapshotV1,
  type FormalServerSessionUserResolutionV1,
} from '@/modules/auth/server/auth-account-repository';
import type { TenantDatabase } from '@/server/db/client';
import {
  authAccountInstitutionBindings,
  authUsers,
  tenantMembers,
} from '@/server/db/schema';

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

const membershipRow = {
  id: 'tenant-member-chenlei',
  tenantId: 'tenant-zhengpu',
  userId: 'auth-user-chenlei',
  role: 'tenant_admin',
  displayName: '陈磊',
  createdAt: new Date('2026-06-25T07:00:00.000Z'),
  updatedAt: new Date('2026-06-25T07:00:00.000Z'),
};

const institutionBindingRow = {
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
};

const institutionMembershipFactRow = {
  accountId: 'auth-user-chenlei',
  accountStatus: 'active',
  accountPasswordResetRequired: false,
  accountLockedUntil: null,
  membershipId: 'tenant-member-chenlei',
  membershipTenantId: 'tenant-zhengpu',
  membershipUserId: 'auth-user-chenlei',
  membershipRole: 'tenant_admin',
  membershipUpdatedAt: new Date('2026-06-25T07:00:00.000Z'),
  bindingId: 'auth-binding-chenlei',
  bindingAccountId: 'auth-user-chenlei',
  bindingTenantId: 'tenant-zhengpu',
  bindingInstitutionId: 'institution-zhengpu',
  bindingStatus: 'active',
  bindingSource: 'manual_admin',
  bindingAssignedAt: new Date('2026-06-25T07:00:00.000Z'),
  bindingExpiresAt: null,
  bindingRevokedAt: null,
  bindingVersion: 1,
};

const formalSessionUserRow = {
  accountId: 'auth-user-chenlei',
  accountUsername: 'chenlei_admin',
  accountDisplayName: '账号陈磊',
  accountStatus: 'active',
  accountPasswordResetRequired: false,
  accountLockedUntil: null,
  membershipTenantId: 'tenant-zhengpu',
  membershipUserId: 'auth-user-chenlei',
  membershipRole: 'tenant_operator',
  membershipDisplayName: '机构陈磊',
  bindingId: 'auth-binding-chenlei',
  bindingAccountId: 'auth-user-chenlei',
  bindingTenantId: 'tenant-zhengpu',
  bindingInstitutionId: 'institution-zhengpu',
  bindingStatus: 'active',
  bindingSource: 'manual_admin',
  bindingAssignedAt: new Date('2026-06-25T07:00:00.000Z'),
  bindingExpiresAt: null,
  bindingRevokedAt: null,
  bindingVersion: 1,
};

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

  it('查询账号的租户成员关系用于生成登录会话', async () => {
    const query = createDatabase({
      selectRows: [[membershipRow]],
    });

    const result = await createAuthAccountRepository(query.database).findPrimaryTenantMembershipByUserId(
      'auth-user-chenlei',
    );

    expect(query.selectChains[0].from).toHaveBeenCalledWith(tenantMembers);
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      column: tenantMembers.userId,
      operator: 'eq',
      value: 'auth-user-chenlei',
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(membershipRow);
  });

  it('仅按账号、租户和 active 状态读取至多两个权威机构绑定', async () => {
    const query = createDatabase({
      selectRows: [[institutionBindingRow]],
    });

    const result = await createAuthAccountRepository(
      query.database,
    ).listActiveInstitutionBindingsByAccountAndTenant({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
    });

    expect(query.selectChains[0].from).toHaveBeenCalledWith(
      authAccountInstitutionBindings,
    );
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      operator: 'and',
      conditions: [
        {
          column: authAccountInstitutionBindings.accountId,
          operator: 'eq',
          value: 'auth-user-chenlei',
        },
        {
          column: authAccountInstitutionBindings.tenantId,
          operator: 'eq',
          value: 'tenant-zhengpu',
        },
        {
          column: authAccountInstitutionBindings.status,
          operator: 'eq',
          value: 'active',
        },
      ],
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(2);
    expect(result).toEqual([institutionBindingRow]);
  });

  it('用一次低敏 JOIN 查询读取账号、租户成员和 active 机构绑定事实', async () => {
    const query = createDatabase({
      selectRows: [[institutionMembershipFactRow]],
    });

    const result = await createAuthAccountRepository(
      query.database,
    ).findCurrentInstitutionMembershipFacts({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
    });

    expect(query.select).toHaveBeenCalledTimes(1);
    expect(query.select).toHaveBeenCalledWith({
      accountId: authUsers.id,
      accountStatus: authUsers.status,
      accountPasswordResetRequired: authUsers.passwordResetRequired,
      accountLockedUntil: authUsers.lockedUntil,
      membershipId: tenantMembers.id,
      membershipTenantId: tenantMembers.tenantId,
      membershipUserId: tenantMembers.userId,
      membershipRole: tenantMembers.role,
      membershipUpdatedAt: tenantMembers.updatedAt,
      bindingId: authAccountInstitutionBindings.id,
      bindingAccountId: authAccountInstitutionBindings.accountId,
      bindingTenantId: authAccountInstitutionBindings.tenantId,
      bindingInstitutionId: authAccountInstitutionBindings.institutionId,
      bindingStatus: authAccountInstitutionBindings.status,
      bindingSource: authAccountInstitutionBindings.source,
      bindingAssignedAt: authAccountInstitutionBindings.assignedAt,
      bindingExpiresAt: authAccountInstitutionBindings.expiresAt,
      bindingRevokedAt: authAccountInstitutionBindings.revokedAt,
      bindingVersion: authAccountInstitutionBindings.version,
    });
    expect(query.selectChains[0].from).toHaveBeenCalledWith(authUsers);
    expect(query.selectChains[0].innerJoin).toHaveBeenCalledWith(
      tenantMembers,
      {
        operator: 'and',
        conditions: [
          {
            column: tenantMembers.userId,
            operator: 'eq',
            value: authUsers.id,
          },
          {
            column: tenantMembers.tenantId,
            operator: 'eq',
            value: 'tenant-zhengpu',
          },
        ],
      },
    );
    expect(query.selectChains[0].leftJoin).toHaveBeenCalledWith(
      authAccountInstitutionBindings,
      {
        operator: 'and',
        conditions: [
          {
            column: authAccountInstitutionBindings.accountId,
            operator: 'eq',
            value: authUsers.id,
          },
          {
            column: authAccountInstitutionBindings.tenantId,
            operator: 'eq',
            value: tenantMembers.tenantId,
          },
          {
            column: authAccountInstitutionBindings.status,
            operator: 'eq',
            value: 'active',
          },
        ],
      },
    );
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      column: authUsers.id,
      operator: 'eq',
      value: 'auth-user-chenlei',
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(2);
    expect(result).toEqual([institutionMembershipFactRow]);
  });

  it('按三元组和 active 状态 JOIN，使 revoked 历史不与当前 active 绑定形成多行', async () => {
    type LookupInput = Parameters<
      ReturnType<typeof createAuthAccountRepository>['findCurrentFormalSessionUser']
    >[0];
    expectTypeOf<keyof LookupInput>().toEqualTypeOf<
      'accountId' | 'tenantId' | 'institutionId'
    >();
    const query = createDatabase({
      selectRows: [[formalSessionUserRow]],
    });

    const resolution = await createAuthAccountRepository(
      query.database,
    ).findCurrentFormalSessionUser({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });

    expect(query.select).toHaveBeenCalledTimes(1);
    expect(query.select).toHaveBeenCalledWith({
      accountId: authUsers.id,
      accountUsername: authUsers.username,
      accountDisplayName: authUsers.displayName,
      accountStatus: authUsers.status,
      accountPasswordResetRequired: authUsers.passwordResetRequired,
      accountLockedUntil: authUsers.lockedUntil,
      membershipTenantId: tenantMembers.tenantId,
      membershipUserId: tenantMembers.userId,
      membershipRole: tenantMembers.role,
      membershipDisplayName: tenantMembers.displayName,
      bindingId: authAccountInstitutionBindings.id,
      bindingAccountId: authAccountInstitutionBindings.accountId,
      bindingTenantId: authAccountInstitutionBindings.tenantId,
      bindingInstitutionId: authAccountInstitutionBindings.institutionId,
      bindingStatus: authAccountInstitutionBindings.status,
      bindingSource: authAccountInstitutionBindings.source,
      bindingAssignedAt: authAccountInstitutionBindings.assignedAt,
      bindingExpiresAt: authAccountInstitutionBindings.expiresAt,
      bindingRevokedAt: authAccountInstitutionBindings.revokedAt,
      bindingVersion: authAccountInstitutionBindings.version,
    });
    expect(query.selectChains[0].from).toHaveBeenCalledWith(authUsers);
    expect(query.selectChains[0].innerJoin).toHaveBeenNthCalledWith(
      1,
      tenantMembers,
      {
        operator: 'and',
        conditions: [
          {
            column: tenantMembers.userId,
            operator: 'eq',
            value: authUsers.id,
          },
          {
            column: tenantMembers.tenantId,
            operator: 'eq',
            value: 'tenant-zhengpu',
          },
        ],
      },
    );
    expect(query.selectChains[0].innerJoin).toHaveBeenNthCalledWith(
      2,
      authAccountInstitutionBindings,
      {
        operator: 'and',
        conditions: [
          {
            column: authAccountInstitutionBindings.accountId,
            operator: 'eq',
            value: authUsers.id,
          },
          {
            column: authAccountInstitutionBindings.tenantId,
            operator: 'eq',
            value: tenantMembers.tenantId,
          },
          {
            column: authAccountInstitutionBindings.institutionId,
            operator: 'eq',
            value: 'institution-zhengpu',
          },
          {
            column: authAccountInstitutionBindings.status,
            operator: 'eq',
            value: 'active',
          },
        ],
      },
    );
    expect(query.selectChains[0].where).toHaveBeenCalledWith({
      column: authUsers.id,
      operator: 'eq',
      value: 'auth-user-chenlei',
    });
    expect(query.selectChains[0].limit).toHaveBeenCalledWith(2);
    expectTypeOf(resolution).toEqualTypeOf<FormalServerSessionUserResolutionV1>();
    expect(resolution.kind).toBe('resolved');
    if (resolution.kind !== 'resolved') {
      throw new Error('expected formal session user snapshot');
    }
    expect(Object.isFrozen(resolution)).toBe(true);
    expect(Object.isFrozen(resolution.snapshot)).toBe(true);
    expect(Object.keys(resolution.snapshot)).toEqual([]);
    expect(isFormalServerSessionUserSnapshotV1(resolution.snapshot)).toBe(true);
    expect(consumeFormalServerSessionUserSnapshotV1(resolution.snapshot)).toEqual({
      id: 'auth-user-chenlei',
      username: 'chenlei_admin',
      name: '机构陈磊',
      role: 'tenant_operator',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });
    expect(consumeFormalServerSessionUserSnapshotV1(resolution.snapshot)).toBeNull();
    expect(isFormalServerSessionUserSnapshotV1(resolution.snapshot)).toBe(false);
  });

  it('把账号和绑定业务状态统一分类为低敏 denied', async () => {
    const cases: unknown[][] = [
      [],
      [{ ...formalSessionUserRow, accountPasswordResetRequired: true }],
      [{ ...formalSessionUserRow, accountStatus: 'locked' }],
      [{ ...formalSessionUserRow, accountLockedUntil: new Date('2099-01-01T00:00:00.000Z') }],
      [{ ...formalSessionUserRow, membershipRole: 'platform_admin' }],
      [{ ...formalSessionUserRow, bindingStatus: 'revoked', bindingRevokedAt: new Date() }],
      [{ ...formalSessionUserRow, bindingSource: 'migration_placeholder' }],
      [{ ...formalSessionUserRow, bindingAssignedAt: new Date('2099-01-01T00:00:00.000Z') }],
      [{ ...formalSessionUserRow, bindingExpiresAt: new Date('2000-01-01T00:00:00.000Z') }],
      [{ ...formalSessionUserRow, bindingRevokedAt: new Date('2026-06-25T07:00:00.000Z') }],
    ];

    for (const rows of cases) {
      const query = createDatabase({ selectRows: [rows] });
      await expect(
        createAuthAccountRepository(query.database).findCurrentFormalSessionUser({
          accountId: 'auth-user-chenlei',
          tenantId: 'tenant-zhengpu',
          institutionId: 'institution-zhengpu',
        }),
      ).resolves.toEqual({ kind: 'denied' });
      expect(query.select).toHaveBeenCalledTimes(1);
    }
  });

  it('把结构、类型、多行和作用域完整性错误统一分类为低敏 invalid', async () => {
    const cases: unknown[][] = [
      [{ ...formalSessionUserRow, accountStatus: 'unknown_status' }],
      [{ ...formalSessionUserRow, accountPasswordResetRequired: 'false' }],
      [{ ...formalSessionUserRow, membershipRole: 'unknown_role' }],
      [{ ...formalSessionUserRow, bindingStatus: 'unknown_status' }],
      [{ ...formalSessionUserRow, bindingSource: 'unknown_source' }],
      [{ ...formalSessionUserRow, accountLockedUntil: new Date(Number.NaN) }],
      [{ ...formalSessionUserRow, bindingAssignedAt: new Date(Number.NaN) }],
      [{ ...formalSessionUserRow, bindingExpiresAt: new Date(Number.NaN) }],
      [{ ...formalSessionUserRow, bindingRevokedAt: new Date(Number.NaN) }],
      [{ ...formalSessionUserRow, bindingVersion: 0 }],
      [{ ...formalSessionUserRow, bindingVersion: 1.5 }],
      [formalSessionUserRow, { ...formalSessionUserRow }],
      [{ ...formalSessionUserRow, membershipTenantId: 'tenant-other' }],
      [{ ...formalSessionUserRow, bindingInstitutionId: 'institution-other' }],
      [{ ...formalSessionUserRow, bindingId: 'unsafe/binding' }],
      [{ ...formalSessionUserRow, extra: 'not-an-exact-row' }],
    ];

    for (const rows of cases) {
      const query = createDatabase({ selectRows: [rows] });
      await expect(
        createAuthAccountRepository(query.database).findCurrentFormalSessionUser({
          accountId: 'auth-user-chenlei',
          tenantId: 'tenant-zhengpu',
          institutionId: 'institution-zhengpu',
        }),
      ).resolves.toEqual({ kind: 'invalid' });
      expect(query.select).toHaveBeenCalledTimes(1);
    }
  });

  it('先安全快照和校验查询三元组，非法输入不读取数据库或 accessor/proxy', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor = {
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    };
    Object.defineProperty(accessor, 'accountId', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('query getter must not run');
      },
    });
    const proxy = new Proxy({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    }, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('query proxy trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('query proxy trap must not run');
      },
    });
    const nullPrototype = Object.assign(Object.create(null) as object, {
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });
    for (const input of [
      { accountId: 'unsafe/id', tenantId: 'tenant-zhengpu', institutionId: 'institution-zhengpu' },
      { accountId: 'auth-user-chenlei', tenantId: 'tenant-zhengpu', institutionId: 'institution-zhengpu', extra: true },
      accessor,
      proxy,
      nullPrototype,
    ]) {
      const query = createDatabase();
      await expect(
        createAuthAccountRepository(query.database).findCurrentFormalSessionUser(
          input as never,
        ),
      ).resolves.toEqual({ kind: 'invalid' });
      expect(query.select).not.toHaveBeenCalled();
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('拒绝 accessor、Proxy、null-prototype 和非精确数据库行且不发布 handle', async () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor = { ...formalSessionUserRow };
    Object.defineProperty(accessor, 'accountId', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('row getter must not run');
      },
    });
    const proxy = new Proxy({ ...formalSessionUserRow }, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('row proxy trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('row proxy trap must not run');
      },
    });
    const nullPrototype = Object.assign(
      Object.create(null) as object,
      formalSessionUserRow,
    );
    for (const row of [accessor, proxy, nullPrototype]) {
      const query = createDatabase({ selectRows: [[row]] });
      const result = await createAuthAccountRepository(
        query.database,
      ).findCurrentFormalSessionUser({
        accountId: 'auth-user-chenlei',
        tenantId: 'tenant-zhengpu',
        institutionId: 'institution-zhengpu',
      });
      expect(result).toEqual({ kind: 'invalid' });
      expect(isFormalServerSessionUserSnapshotV1(result)).toBe(false);
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('把数据库与系统时钟故障统一分类为低敏 unavailable', async () => {
    const databaseFailure = {
      select: vi.fn(() => {
        throw new Error('database unavailable');
      }),
    } as unknown as TenantDatabase;
    const databaseResolution = await createAuthAccountRepository(
      databaseFailure,
    ).findCurrentFormalSessionUser({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });
    expect(databaseResolution).toEqual({ kind: 'unavailable' });
    expect(Object.isFrozen(databaseResolution)).toBe(true);

    for (const clockFailure of [
      () => {
        throw new Error('clock unavailable');
      },
      () => Number.NaN,
    ]) {
      const query = createDatabase({ selectRows: [[formalSessionUserRow]] });
      const nowSpy = vi.spyOn(Date, 'now').mockImplementation(clockFailure);
      try {
        const resolution = await createAuthAccountRepository(
          query.database,
        ).findCurrentFormalSessionUser({
          accountId: 'auth-user-chenlei',
          tenantId: 'tenant-zhengpu',
          institutionId: 'institution-zhengpu',
        });
        expect(resolution).toEqual({ kind: 'unavailable' });
        expect(Object.isFrozen(resolution)).toBe(true);
        expect(JSON.stringify(resolution)).not.toContain('auth-user-chenlei');
      } finally {
        nowSpy.mockRestore();
      }
    }
  });

  it('只认可 genuine handle，普通、clone、null-prototype、accessor、proxy 和 revoked 均零读取拒绝', async () => {
    const query = createDatabase({ selectRows: [[formalSessionUserRow], [formalSessionUserRow]] });
    const repository = createAuthAccountRepository(query.database);
    const genuineResolution = await repository.findCurrentFormalSessionUser({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });
    const revokedResolution = await repository.findCurrentFormalSessionUser({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });
    if (
      genuineResolution.kind !== 'resolved' ||
      revokedResolution.kind !== 'resolved'
    ) {
      throw new Error('expected genuine snapshots');
    }
    const genuine = genuineResolution.snapshot;
    const revoked = revokedResolution.snapshot;
    expect(consumeFormalServerSessionUserSnapshotV1(revoked)).not.toBeNull();
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'user', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('handle getter must not run');
      },
    });
    const proxy = new Proxy(genuine, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('handle proxy trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('handle proxy trap must not run');
      },
    });
    for (const value of [
      {},
      { ...genuine },
      Object.create(null) as object,
      Object.create(genuine) as object,
      accessor,
      proxy,
      revoked,
    ]) {
      expect(isFormalServerSessionUserSnapshotV1(value)).toBe(false);
      expect(consumeFormalServerSessionUserSnapshotV1(value)).toBeNull();
    }
    expect(isFormalServerSessionUserSnapshotV1(genuine)).toBe(true);
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('并发双消费只有一次得到冻结 session user', async () => {
    const query = createDatabase({ selectRows: [[formalSessionUserRow]] });
    const resolution = await createAuthAccountRepository(
      query.database,
    ).findCurrentFormalSessionUser({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });
    if (resolution.kind !== 'resolved') {
      throw new Error('expected formal session user snapshot');
    }
    const snapshot = resolution.snapshot;
    const results = await Promise.all([
      Promise.resolve().then(() => consumeFormalServerSessionUserSnapshotV1(snapshot)),
      Promise.resolve().then(() => consumeFormalServerSessionUserSnapshotV1(snapshot)),
    ]);
    const users = results.filter((value) => value !== null);
    expect(users).toHaveLength(1);
    expect(Object.isFrozen(users[0])).toBe(true);
    expect(results.filter((value) => value === null)).toHaveLength(1);
    expect(isFormalServerSessionUserSnapshotV1(snapshot)).toBe(false);
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
