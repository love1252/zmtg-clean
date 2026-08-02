import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  createTenancyAuthoritativeInstitutionScopeFactReaderV1,
  isAuthoritativeInstitutionScopeFactReaderV1,
} from '@/modules/tenancy/application/authoritative-institution-scope-reader';
import {
  createAuthoritativeInstitutionScopeFactReaderV1,
  createAuthoritativeInstitutionScopeFactRepositoryV1,
  type CurrentInstitutionScopeFactRowV1,
} from '@/modules/tenancy/server/authoritative-institution-scope-reader';
import type { TenantDatabase } from '@/server/db/client';
import { institutionScopes } from '@/server/db/schema';

const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({ conditions, operator: 'and' })),
);
const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({ column, operator: 'eq', value })),
);
const getDatabaseMock = vi.hoisted(() => vi.fn());

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: andMock, eq: eqMock };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return { ...actual, getDatabase: getDatabaseMock };
});

const query = Object.freeze({
  tenantId: 'tenant-a',
  institutionId: 'institution-a',
});
const row: CurrentInstitutionScopeFactRowV1 = Object.freeze({
  ...query,
  status: 'active',
  revision: 7,
});
const NOW = new Date('2026-08-02T01:00:00.000Z');

function databaseFor(rows: readonly CurrentInstitutionScopeFactRowV1[]) {
  const limit = vi.fn(async () => rows);
  const chain = { from: vi.fn(), where: vi.fn(), limit };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  const select = vi.fn(() => chain);
  return {
    database: { select } as unknown as TenantDatabase,
    select,
    chain,
  };
}

beforeEach(() => {
  andMock.mockClear();
  eqMock.mockClear();
  getDatabaseMock.mockReset();
});

describe('Tenancy authoritative Scope Reader', () => {
  it('只有 Tenancy 无参数 Owner factory 创建的冻结 Reader 才是 genuine', () => {
    expectTypeOf<
      Parameters<typeof createTenancyAuthoritativeInstitutionScopeFactReaderV1>
    >().toEqualTypeOf<[]>();
    const database = databaseFor([row]);
    getDatabaseMock.mockReturnValue(database.database);
    const ownerReader = createTenancyAuthoritativeInstitutionScopeFactReaderV1();
    const serverReader = createAuthoritativeInstitutionScopeFactReaderV1({
      repository: {
        findCurrentInstitutionScopeFacts: vi.fn(async () => [row]),
      },
      now: () => NOW,
    });

    expect(isAuthoritativeInstitutionScopeFactReaderV1(ownerReader)).toBe(true);
    expect(Object.isFrozen(ownerReader)).toBe(true);
    for (const candidate of [
      serverReader,
      Object.freeze({ resolve: ownerReader.resolve }),
      { ...ownerReader },
      new Proxy(ownerReader, {}),
      Object.freeze({ resolve: vi.fn() }),
      null,
    ]) {
      expect(isAuthoritativeInstitutionScopeFactReaderV1(candidate)).toBe(false);
    }
  });

  it('Owner 惰性固定唯一数据库，首次失败后不重试', async () => {
    const database = databaseFor([row]);
    getDatabaseMock.mockReturnValue(database.database);
    const reader = createTenancyAuthoritativeInstitutionScopeFactReaderV1();
    expect(getDatabaseMock).not.toHaveBeenCalled();
    await expect(reader.resolve(query)).resolves.toMatchObject({
      kind: 'current_scope_fact',
    });
    await expect(reader.resolve(query)).resolves.toMatchObject({
      kind: 'current_scope_fact',
    });
    expect(getDatabaseMock).toHaveBeenCalledTimes(1);

    getDatabaseMock.mockReset();
    getDatabaseMock.mockImplementation(() => {
      throw new Error('sensitive database failure');
    });
    const unavailable = createTenancyAuthoritativeInstitutionScopeFactReaderV1();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(unavailable.resolve(query)).resolves.toEqual({
        kind: 'rejected',
        code: 'scope_unavailable',
      });
    }
    expect(getDatabaseMock).toHaveBeenCalledTimes(1);
  });

  it('Repository 只读取 Tenancy Scope 低敏 current 列和精确双键', async () => {
    const database = databaseFor([row]);
    const repository = createAuthoritativeInstitutionScopeFactRepositoryV1(
      database.database,
    );

    await expect(repository.findCurrentInstitutionScopeFacts(query)).resolves.toEqual([
      row,
    ]);
    expect(database.select).toHaveBeenCalledWith({
      tenantId: institutionScopes.tenantId,
      institutionId: institutionScopes.institutionId,
      status: institutionScopes.status,
      revision: institutionScopes.revision,
    });
    expect(database.chain.from).toHaveBeenCalledWith(institutionScopes);
    expect(database.chain.where).toHaveBeenCalledWith({
      operator: 'and',
      conditions: [
        { column: institutionScopes.tenantId, operator: 'eq', value: 'tenant-a' },
        {
          column: institutionScopes.institutionId,
          operator: 'eq',
          value: 'institution-a',
        },
      ],
    });
    expect(database.chain.limit).toHaveBeenCalledWith(2);
  });

  it('active 每次重读并以后置时钟形成 observedAt', async () => {
    const order: string[] = [];
    const repository = {
      findCurrentInstitutionScopeFacts: vi.fn(async () => {
        order.push('repository');
        return [row];
      }),
    };
    const now = vi.fn(() => {
      order.push('clock');
      return NOW;
    });
    const reader = createAuthoritativeInstitutionScopeFactReaderV1({
      repository,
      now,
    });

    await expect(reader.resolve(query)).resolves.toEqual({
      kind: 'current_scope_fact',
      ...query,
      status: 'active',
      revision: 7,
      observedAt: NOW.toISOString(),
    });
    await expect(reader.resolve(query)).resolves.toMatchObject({
      kind: 'current_scope_fact',
    });
    expect(order).toEqual(['repository', 'clock', 'repository', 'clock']);
  });

  it.each([
    ['missing', []],
    ['suspended', [{ ...row, status: 'suspended' }]],
  ] as const)('%s Scope fail-closed 为 denied', async (_label, rows) => {
    const reader = createAuthoritativeInstitutionScopeFactReaderV1({
      repository: {
        findCurrentInstitutionScopeFacts: vi.fn(async () => rows as never),
      },
      now: () => NOW,
    });
    await expect(reader.resolve(query)).resolves.toEqual({
      kind: 'rejected',
      code: 'scope_denied',
    });
  });

  it.each([
    ['duplicate', [row, row]],
    ['cross tenant', [{ ...row, tenantId: 'tenant-b' }]],
    ['unknown status', [{ ...row, status: 'unknown' }]],
    ['zero revision', [{ ...row, revision: 0 }]],
    ['unsafe revision', [{ ...row, revision: Number.MAX_SAFE_INTEGER + 1 }]],
    ['extra field', [{ ...row, extra: true }]],
    ['row proxy', [new Proxy({ ...row }, {})]],
  ] as const)('%s Shape fail-closed 为 invalid', async (_label, rows) => {
    const reader = createAuthoritativeInstitutionScopeFactReaderV1({
      repository: {
        findCurrentInstitutionScopeFacts: vi.fn(async () => rows as never),
      },
      now: () => NOW,
    });
    await expect(reader.resolve(query)).resolves.toEqual({
      kind: 'rejected',
      code: 'scope_invalid',
    });
  });

  it('非法输入、Repository 或时钟异常均低敏失败关闭', async () => {
    const read = vi.fn(async () => [row]);
    const reader = createAuthoritativeInstitutionScopeFactReaderV1({
      repository: { findCurrentInstitutionScopeFacts: read },
      now: () => NOW,
    });
    await expect(
      reader.resolve({ ...query, extra: true } as never),
    ).resolves.toEqual({ kind: 'rejected', code: 'scope_invalid' });
    expect(read).not.toHaveBeenCalled();

    const repositoryFailure = createAuthoritativeInstitutionScopeFactReaderV1({
      repository: {
        findCurrentInstitutionScopeFacts: vi.fn(async () => {
          throw new Error('sensitive repository failure');
        }),
      },
      now: () => NOW,
    });
    await expect(repositoryFailure.resolve(query)).resolves.toEqual({
      kind: 'rejected',
      code: 'scope_unavailable',
    });

    const clockFailure = createAuthoritativeInstitutionScopeFactReaderV1({
      repository: { findCurrentInstitutionScopeFacts: vi.fn(async () => [row]) },
      now: () => {
        throw new Error('clock failure');
      },
    });
    await expect(clockFailure.resolve(query)).resolves.toEqual({
      kind: 'rejected',
      code: 'scope_unavailable',
    });
  });
});
