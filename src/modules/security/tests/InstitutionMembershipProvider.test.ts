import { describe, expect, it, vi } from 'vitest';

import type {
  CurrentInstitutionMembershipFactRow,
} from '@/modules/auth/server/auth-account-repository';
import {
  createAuthoritativeInstitutionMembershipFactReaderV1,
  type InstitutionMembershipFactRepositoryV1,
} from '@/modules/security/server/institution-membership-provider';

const NOW = new Date('2026-07-18T08:00:00.000Z');

const currentRow: CurrentInstitutionMembershipFactRow = {
  accountId: 'auth-user-chenlei',
  accountStatus: 'active',
  accountPasswordResetRequired: false,
  accountLockedUntil: null,
  membershipId: 'tenant-member-chenlei',
  membershipTenantId: 'tenant-zhengpu',
  membershipUserId: 'auth-user-chenlei',
  membershipRole: 'tenant_admin',
  membershipUpdatedAt: new Date('2026-07-18T07:58:00.000Z'),
  bindingId: 'auth-binding-chenlei',
  bindingAccountId: 'auth-user-chenlei',
  bindingTenantId: 'tenant-zhengpu',
  bindingInstitutionId: 'institution-zhengpu',
  bindingStatus: 'active',
  bindingSource: 'manual_admin',
  bindingAssignedAt: new Date('2026-07-01T00:00:00.000Z'),
  bindingExpiresAt: null,
  bindingRevokedAt: null,
  bindingVersion: 7,
};

const requestedMembership = Object.freeze({
  accountId: 'auth-user-chenlei',
  tenantId: 'tenant-zhengpu',
  institutionId: 'institution-zhengpu',
});

function createReader(input: {
  rows?: readonly CurrentInstitutionMembershipFactRow[];
  error?: Error;
  now?: () => Date;
} = {}) {
  const findCurrentInstitutionMembershipFacts = input.error
    ? vi.fn(async () => {
        throw input.error;
      })
    : vi.fn(async () => input.rows ?? [currentRow]);
  const repository: InstitutionMembershipFactRepositoryV1 = {
    findCurrentInstitutionMembershipFacts,
  };

  return {
    findCurrentInstitutionMembershipFacts,
    reader: createAuthoritativeInstitutionMembershipFactReaderV1({
      repository,
      now: input.now ?? (() => NOW),
    }),
  };
}

function bindingMissingRow(): CurrentInstitutionMembershipFactRow {
  return {
    ...currentRow,
    bindingId: null,
    bindingAccountId: null,
    bindingTenantId: null,
    bindingInstitutionId: null,
    bindingStatus: null,
    bindingSource: null,
    bindingAssignedAt: null,
    bindingExpiresAt: null,
    bindingRevokedAt: null,
    bindingVersion: null,
  };
}

describe('机构成员资格权威事实读取器', () => {
  it('只依据一次数据库重验返回低敏、不可变且不授予权限的当前事实', async () => {
    const { reader, findCurrentInstitutionMembershipFacts } = createReader();

    const result = await reader.resolve(requestedMembership);

    expect(findCurrentInstitutionMembershipFacts).toHaveBeenCalledTimes(1);
    expect(findCurrentInstitutionMembershipFacts).toHaveBeenCalledWith({
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
    });
    expect(result).toEqual({
      kind: 'current_membership_fact',
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
      role: 'tenant_admin',
      membershipId: 'tenant-member-chenlei',
      membershipRevisionAt: '2026-07-18T07:58:00.000Z',
      bindingId: 'auth-binding-chenlei',
      bindingRevision: 7,
      bindingExpiresAt: null,
      observedAt: '2026-07-18T08:00:00.000Z',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result)).not.toEqual(
      expect.arrayContaining(['username', 'displayName', 'phone', 'email', 'passwordHash']),
    );
  });

  it.each([
    ['tenant_admin', 'tenant_admin'],
    ['tenant_operator', 'tenant_operator'],
    ['consultant', 'consultant'],
    ['customer_service', 'customer_service'],
  ] as const)('接受四个机构角色 %s', async (_label, membershipRole) => {
    const { reader } = createReader({ rows: [{ ...currentRow, membershipRole }] });

    await expect(reader.resolve(requestedMembership)).resolves.toMatchObject({
      kind: 'current_membership_fact',
      role: membershipRole,
    });
  });

  it.each([
    ['账号不存在或租户成员不存在', []],
    ['账号 disabled', [{ ...currentRow, accountStatus: 'disabled' }]],
    ['账号 locked', [{ ...currentRow, accountStatus: 'locked' }]],
    [
      '账号 password_reset_required',
      [{ ...currentRow, accountStatus: 'password_reset_required' }],
    ],
    ['账号仍要求重置密码', [{ ...currentRow, accountPasswordResetRequired: true }]],
    [
      '账号仍在锁定窗口',
      [{ ...currentRow, accountLockedUntil: new Date('2026-07-18T08:01:00.000Z') }],
    ],
    ['没有 active 绑定', [bindingMissingRow()]],
    [
      '绑定属于其他机构',
      [{ ...currentRow, bindingInstitutionId: 'institution-other' }],
    ],
    [
      '绑定来源不具备正式权限',
      [{ ...currentRow, bindingSource: 'migration_placeholder' }],
    ],
    [
      '绑定尚未生效',
      [{ ...currentRow, bindingAssignedAt: new Date('2026-07-18T08:00:00.001Z') }],
    ],
    [
      '绑定已经到期',
      [{ ...currentRow, bindingExpiresAt: new Date('2026-07-18T08:00:00.000Z') }],
    ],
    [
      '绑定已撤销',
      [{ ...currentRow, bindingRevokedAt: new Date('2026-07-18T07:59:00.000Z') }],
    ],
    ['绑定状态已撤销', [{ ...currentRow, bindingStatus: 'revoked' }]],
    ['平台管理员不是机构角色', [{ ...currentRow, membershipRole: 'platform_admin' }]],
    ['平台运营不是机构角色', [{ ...currentRow, membershipRole: 'platform_operator' }]],
    ['安全审计员不是机构角色', [{ ...currentRow, membershipRole: 'security_auditor' }]],
  ] as const)('%s 时统一拒绝且不泄露细节', async (_label, rows) => {
    const { reader } = createReader({
      rows: rows as readonly CurrentInstitutionMembershipFactRow[],
    });

    await expect(reader.resolve(requestedMembership)).resolves.toEqual({
      kind: 'rejected',
      code: 'membership_denied',
    });
  });

  it.each([
    ['出现重复结果', [currentRow, { ...currentRow }]],
    ['账号 ID 与请求不一致', [{ ...currentRow, accountId: 'auth-user-other' }]],
    [
      '成员 userId 与账号不一致',
      [{ ...currentRow, membershipUserId: 'auth-user-other' }],
    ],
    [
      '成员 tenantId 与请求不一致',
      [{ ...currentRow, membershipTenantId: 'tenant-other' }],
    ],
    [
      '绑定 accountId 与账号不一致',
      [{ ...currentRow, bindingAccountId: 'auth-user-other' }],
    ],
    [
      '绑定 tenantId 与成员不一致',
      [{ ...currentRow, bindingTenantId: 'tenant-other' }],
    ],
    ['租户成员包含未知角色', [{ ...currentRow, membershipRole: 'unknown_role' }]],
    ['绑定版本非正整数', [{ ...currentRow, bindingVersion: 0 }]],
    [
      '成员更新时间晚于权威读取时间',
      [{ ...currentRow, membershipUpdatedAt: new Date('2026-07-18T08:00:00.001Z') }],
    ],
    [
      '绑定字段部分缺失',
      [{ ...currentRow, bindingId: null }],
    ],
    [
      '缺失绑定却残留可选字段',
      [{ ...bindingMissingRow(), bindingRevokedAt: new Date('2026-07-18T07:59:00.000Z') }],
    ],
    [
      '绑定来源是未知枚举值',
      [{ ...currentRow, bindingSource: 'unknown_source' }],
    ],
    [
      '数据库返回额外高敏字段',
      [{ ...currentRow, passwordHash: 'must-not-flow' }],
    ],
  ] as const)('%s 时返回 membership_invalid', async (_label, rows) => {
    const { reader } = createReader({
      rows: rows as unknown as readonly CurrentInstitutionMembershipFactRow[],
    });

    await expect(reader.resolve(requestedMembership)).resolves.toEqual({
      kind: 'rejected',
      code: 'membership_invalid',
    });
  });

  it('拒绝旧 session 角色或 scope 字段，不把调用方声明当成数据库事实', async () => {
    const { reader, findCurrentInstitutionMembershipFacts } = createReader();

    const result = await reader.resolve({
      ...requestedMembership,
      role: 'tenant_admin',
      scope: 'tenant',
    } as never);

    expect(result).toEqual({ kind: 'rejected', code: 'membership_invalid' });
    expect(findCurrentInstitutionMembershipFacts).not.toHaveBeenCalled();
  });

  it('拒绝恶意查询对象且不访问数据库', async () => {
    const accessor = { ...requestedMembership };
    Object.defineProperty(accessor, 'tenantId', {
      enumerable: true,
      get: () => 'tenant-zhengpu',
    });
    const hidden = { ...requestedMembership };
    Object.defineProperty(hidden, 'secret', { value: 'hidden', enumerable: false });
    const symbol = Object.assign({ ...requestedMembership }, {
      [Symbol('scope')]: 'other',
    });
    const customPrototype = Object.assign(
      Object.create({ inherited: true }),
      requestedMembership,
    );
    const nullPrototype = Object.assign(Object.create(null), requestedMembership);
    const throwingProxy = new Proxy(
      { ...requestedMembership },
      {
        getOwnPropertyDescriptor() {
          throw new Error('sensitive query trap');
        },
      },
    );
    const { reader, findCurrentInstitutionMembershipFacts } = createReader();

    for (const query of [
      new Proxy({ ...requestedMembership }, {}),
      accessor,
      hidden,
      symbol,
      customPrototype,
      nullPrototype,
      throwingProxy,
    ]) {
      await expect(reader.resolve(query as never)).resolves.toEqual({
        kind: 'rejected',
        code: 'membership_invalid',
      });
    }
    expect(findCurrentInstitutionMembershipFacts).not.toHaveBeenCalled();
  });

  it('拒绝恶意结果数组和结果行并保持失败关闭', async () => {
    const sparseRows: unknown[] = [];
    sparseRows.length = 1;
    const extraRows = [currentRow] as unknown[] & { secret?: string };
    extraRows.secret = 'hidden';
    const accessorRow = { ...currentRow };
    Object.defineProperty(accessorRow, 'membershipTenantId', {
      enumerable: true,
      get: () => 'tenant-zhengpu',
    });
    const hiddenRow = { ...currentRow };
    Object.defineProperty(hiddenRow, 'secret', { value: 'hidden', enumerable: false });
    const symbolRow = Object.assign({ ...currentRow }, {
      [Symbol('scope')]: 'other',
    });
    const customPrototypeRow = Object.assign(
      Object.create({ inherited: true }),
      currentRow,
    );
    const nullPrototypeRow = Object.assign(Object.create(null), currentRow);
    const throwingRow = new Proxy(
      { ...currentRow },
      {
        ownKeys() {
          throw new Error('sensitive row trap');
        },
      },
    );

    for (const rowsValue of [
      new Proxy([currentRow], {}),
      sparseRows,
      extraRows,
      [new Proxy({ ...currentRow }, {})],
      [accessorRow],
      [hiddenRow],
      [symbolRow],
      [customPrototypeRow],
      [nullPrototypeRow],
      [throwingRow],
    ]) {
      const repository: InstitutionMembershipFactRepositoryV1 = {
        async findCurrentInstitutionMembershipFacts() {
          return rowsValue as CurrentInstitutionMembershipFactRow[];
        },
      };
      const reader = createAuthoritativeInstitutionMembershipFactReaderV1({
        repository,
        now: () => NOW,
      });

      await expect(reader.resolve(requestedMembership)).resolves.toEqual({
        kind: 'rejected',
        code: 'membership_invalid',
      });
    }
  });

  it('输入标识非法时不访问数据库并返回 membership_invalid', async () => {
    const invalidInput = createReader();
    await expect(
      invalidInput.reader.resolve({ ...requestedMembership, tenantId: '../other' }),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_invalid' });
    expect(invalidInput.findCurrentInstitutionMembershipFacts).not.toHaveBeenCalled();
  });

  it('数据库读取完成后的可信时钟非法时返回 membership_invalid', async () => {
    const invalidClock = createReader({ now: () => new Date(Number.NaN) });
    await expect(invalidClock.reader.resolve(requestedMembership)).resolves.toEqual({
      kind: 'rejected',
      code: 'membership_invalid',
    });
    expect(invalidClock.findCurrentInstitutionMembershipFacts).toHaveBeenCalledTimes(1);
  });

  it('以数据库返回后的服务器时间判断到期并输出可收窄的绑定期限', async () => {
    let clock = new Date('2026-07-18T08:00:00.000Z');
    const repository: InstitutionMembershipFactRepositoryV1 = {
      async findCurrentInstitutionMembershipFacts() {
        clock = new Date('2026-07-18T08:00:01.000Z');
        return [
          {
            ...currentRow,
            bindingExpiresAt: new Date('2026-07-18T08:00:00.500Z'),
          },
        ];
      },
    };
    const reader = createAuthoritativeInstitutionMembershipFactReaderV1({
      repository,
      now: () => clock,
    });

    await expect(reader.resolve(requestedMembership)).resolves.toEqual({
      kind: 'rejected',
      code: 'membership_denied',
    });

    const futureExpiry = '2026-07-18T08:05:00.000Z';
    const futureReader = createReader({
      rows: [
        { ...currentRow, bindingExpiresAt: new Date(futureExpiry) },
      ],
    }).reader;
    await expect(futureReader.resolve(requestedMembership)).resolves.toMatchObject({
      kind: 'current_membership_fact',
      bindingExpiresAt: futureExpiry,
    });
  });

  it('数据库失败时统一返回 membership_unavailable 且不回传底层错误', async () => {
    const { reader } = createReader({ error: new Error('secret database endpoint') });

    await expect(reader.resolve(requestedMembership)).resolves.toEqual({
      kind: 'rejected',
      code: 'membership_unavailable',
    });
  });

  it('数据库读取后的可信时钟抛错时统一返回 membership_unavailable', async () => {
    const { reader, findCurrentInstitutionMembershipFacts } = createReader({
      now: () => {
        throw new Error('secret clock details');
      },
    });

    await expect(reader.resolve(requestedMembership)).resolves.toEqual({
      kind: 'rejected',
      code: 'membership_unavailable',
    });
    expect(findCurrentInstitutionMembershipFacts).toHaveBeenCalledTimes(1);
  });
});
