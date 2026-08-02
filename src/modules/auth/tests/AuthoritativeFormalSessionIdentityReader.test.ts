import { describe, expect, it, vi } from 'vitest';

const identityOwnerMocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
}));

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return { ...actual, getDatabase: identityOwnerMocks.getDatabase };
});

import {
  createIdentityAuthoritativeFormalSessionIdentityFactReaderV1,
  isAuthoritativeFormalSessionIdentityFactReaderV1,
} from '@/modules/auth/application/authoritative-formal-session-identity-reader';
import {
  createAuthoritativeFormalSessionIdentityFactReaderV1,
  createAuthoritativeFormalSessionIdentityFactRepositoryV1,
  type CurrentFormalSessionIdentityFactRowV1,
  type FormalSessionIdentityFactRepositoryV1,
} from '@/modules/auth/server/authoritative-formal-session-identity-reader';
import type { TenantDatabase } from '@/server/db/client';
import { authUsers } from '@/server/db/schema';

const NOW = new Date('2026-08-02T01:00:00.000Z');
const currentRow: CurrentFormalSessionIdentityFactRowV1 = Object.freeze({
  accountId: 'account-a',
  username: 'account_a',
  displayName: '账号操作员',
  status: 'active',
  passwordResetRequired: false,
  lockedUntil: null,
});

function reader(input: {
  rows?: readonly CurrentFormalSessionIdentityFactRowV1[];
  error?: Error;
} = {}) {
  const read = input.error
    ? vi.fn(async () => {
        throw input.error;
      })
    : vi.fn(async () => [...(input.rows ?? [currentRow])]);
  return {
    read,
    reader: createAuthoritativeFormalSessionIdentityFactReaderV1({
      repository: Object.freeze({
        findCurrentFormalSessionIdentityFacts: read,
      }) as FormalSessionIdentityFactRepositoryV1,
      now: () => NOW,
    }),
  };
}

describe('Identity 权威正式 Session 账号事实读取器', () => {
  it('只返回当前 active 账号的低敏 immutable fact', async () => {
    const created = reader();

    await expect(
      created.reader.resolve({ accountId: 'account-a' }),
    ).resolves.toEqual({
      kind: 'current_identity_fact',
      accountId: 'account-a',
      username: 'account_a',
      displayName: '账号操作员',
      status: 'active',
      observedAt: '2026-08-02T01:00:00.000Z',
    });
    expect(created.read).toHaveBeenCalledWith({ accountId: 'account-a' });
  });

  it.each([
    ['不存在', []],
    ['disabled', [{ ...currentRow, status: 'disabled' }]],
    [
      'password reset',
      [{ ...currentRow, status: 'password_reset_required', passwordResetRequired: true }],
    ],
    ['locked', [{ ...currentRow, status: 'locked' }]],
    [
      'active 但锁定窗口尚未结束',
      [{ ...currentRow, lockedUntil: new Date('2026-08-02T01:00:00.001Z') }],
    ],
  ] as const)('%s 时返回 identity_denied', async (_label, rows) => {
    const created = reader({
      rows: rows as readonly CurrentFormalSessionIdentityFactRowV1[],
    });
    await expect(
      created.reader.resolve({ accountId: 'account-a' }),
    ).resolves.toEqual({ kind: 'rejected', code: 'identity_denied' });
  });

  it.each([
    ['重复账号', [currentRow, currentRow]],
    ['账号 ID 漂移', [{ ...currentRow, accountId: 'account-b' }]],
    ['未知状态', [{ ...currentRow, status: 'unknown' }]],
    ['非法锁定时间', [{ ...currentRow, lockedUntil: new Date(Number.NaN) }]],
    ['夹带高敏字段', [{ ...currentRow, passwordHash: 'must-not-flow' }]],
  ] as const)('%s 时返回 identity_invalid', async (_label, rows) => {
    const created = reader({
      rows: rows as unknown as readonly CurrentFormalSessionIdentityFactRowV1[],
    });
    await expect(
      created.reader.resolve({ accountId: 'account-a' }),
    ).resolves.toEqual({ kind: 'rejected', code: 'identity_invalid' });
  });

  it('Repository 异常时只返回 identity_unavailable', async () => {
    const created = reader({ error: new Error('database unavailable') });
    await expect(
      created.reader.resolve({ accountId: 'account-a' }),
    ).resolves.toEqual({ kind: 'rejected', code: 'identity_unavailable' });
  });

  it.each([
    ['null', null],
    ['额外字段', { repository: {}, extra: true }],
    [
      '访问器',
      (() => {
        const value: Record<string, unknown> = {};
        Object.defineProperty(value, 'repository', {
          enumerable: true,
          get() {
            throw new Error('getter must not run');
          },
        });
        return value;
      })(),
    ],
    [
      '恶意 Proxy',
      new Proxy(Object.create(null) as object, {
        getPrototypeOf() {
          throw new Error('proxy must not escape');
        },
      }),
    ],
  ])('工厂输入为%s时不抛异常并返回 identity_unavailable', async (_label, input) => {
    expect(() => {
      createAuthoritativeFormalSessionIdentityFactReaderV1(input as never);
    }).not.toThrow();
    const created = createAuthoritativeFormalSessionIdentityFactReaderV1(
      input as never,
    );
    await expect(
      created.resolve({ accountId: 'account-a' }),
    ).resolves.toEqual({ kind: 'rejected', code: 'identity_unavailable' });
  });

  it('数据库 Repository 只投影 Identity active gate 所需字段并限制两行', async () => {
    const limit = vi.fn(async () => [currentRow]);
    const chain = {
      from: vi.fn(),
      where: vi.fn(),
      limit,
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    const select = vi.fn(() => chain);
    const database = { select } as unknown as TenantDatabase;

    await createAuthoritativeFormalSessionIdentityFactRepositoryV1(database)
      .findCurrentFormalSessionIdentityFacts({ accountId: 'account-a' });

    expect(select).toHaveBeenCalledWith({
      accountId: authUsers.id,
      username: authUsers.username,
      displayName: authUsers.displayName,
      status: authUsers.status,
      passwordResetRequired: authUsers.passwordResetRequired,
      lockedUntil: authUsers.lockedUntil,
    });
    expect(chain.from).toHaveBeenCalledWith(authUsers);
    expect(limit).toHaveBeenCalledWith(2);
  });
});

describe('Identity Owner 正式 Session Reader capability', () => {
  function databaseFixture(rows: readonly CurrentFormalSessionIdentityFactRowV1[]) {
    const limit = vi.fn(async () => [...rows]);
    const chain = {
      from: vi.fn(),
      where: vi.fn(),
      limit,
    };
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    return {
      database: { select: vi.fn(() => chain) } as unknown as TenantDatabase,
      limit,
    };
  }

  it('只有无参 Identity Owner factory 能创建 genuine handle，结构复制不可伪造', () => {
    identityOwnerMocks.getDatabase.mockReset();
    const created = createIdentityAuthoritativeFormalSessionIdentityFactReaderV1();

    expect(isAuthoritativeFormalSessionIdentityFactReaderV1(created)).toBe(true);
    expect(isAuthoritativeFormalSessionIdentityFactReaderV1({ resolve: created.resolve })).toBe(false);
    expect(isAuthoritativeFormalSessionIdentityFactReaderV1({ ...created })).toBe(false);
    expect(identityOwnerMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('数据库由 Owner 延迟获取且同一 handle 只获取一次', async () => {
    const fixture = databaseFixture([currentRow]);
    identityOwnerMocks.getDatabase.mockReset();
    identityOwnerMocks.getDatabase.mockReturnValue(fixture.database);
    const created = createIdentityAuthoritativeFormalSessionIdentityFactReaderV1();

    await expect(created.resolve({ accountId: 'account-a' })).resolves.toMatchObject({
      kind: 'current_identity_fact',
      accountId: 'account-a',
    });
    await expect(created.resolve({ accountId: 'account-a' })).resolves.toMatchObject({
      kind: 'current_identity_fact',
      accountId: 'account-a',
    });
    expect(identityOwnerMocks.getDatabase).toHaveBeenCalledTimes(1);
    expect(fixture.limit).toHaveBeenCalledTimes(2);
  });

  it('首次数据库获取失败后保持 sticky fail-closed，不在同一 handle 重试', async () => {
    identityOwnerMocks.getDatabase.mockReset();
    identityOwnerMocks.getDatabase.mockImplementationOnce(() => {
      throw new Error('database unavailable');
    });
    const created = createIdentityAuthoritativeFormalSessionIdentityFactReaderV1();

    await expect(created.resolve({ accountId: 'account-a' })).resolves.toEqual({
      kind: 'rejected',
      code: 'identity_unavailable',
    });
    await expect(created.resolve({ accountId: 'account-a' })).resolves.toEqual({
      kind: 'rejected',
      code: 'identity_unavailable',
    });
    expect(identityOwnerMocks.getDatabase).toHaveBeenCalledTimes(1);
  });
});
