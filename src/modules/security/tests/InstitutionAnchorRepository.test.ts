import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createInstitutionAnchorFactRepositoryV1,
  type CurrentInstitutionAnchorFactRowV1,
} from '@/modules/security/server/institution-anchor-repository';
import type { TenantDatabase } from '@/server/db/client';
import { institutionScopes } from '@/server/db/schema';

const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({ conditions, operator: 'and' })),
);
const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({ column, operator: 'eq', value })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: andMock, eq: eqMock };
});

const currentAnchorRow: CurrentInstitutionAnchorFactRowV1 = {
  tenantId: 'tenant-zhengpu',
  institutionId: 'institution-zhengpu',
  status: 'active',
  revision: 7,
};

function createDatabase(rows: readonly unknown[]) {
  const limit = vi.fn(async () => rows);
  const chain = {
    from: vi.fn(),
    limit,
    where: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  const select = vi.fn(() => chain);

  return {
    database: { select } as unknown as TenantDatabase,
    chain,
    limit,
    select,
  };
}

beforeEach(() => {
  andMock.mockClear();
  eqMock.mockClear();
});

describe('机构锚点事实 repository', () => {
  it('只按 tenant 与 institution 双键读取至多两个低敏锚点事实字段', async () => {
    const query = createDatabase([currentAnchorRow]);

    const result = await createInstitutionAnchorFactRepositoryV1(
      query.database,
    ).findCurrentInstitutionAnchorFacts({
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
    });

    expect(query.select).toHaveBeenCalledWith({
      tenantId: institutionScopes.tenantId,
      institutionId: institutionScopes.institutionId,
      status: institutionScopes.status,
      revision: institutionScopes.revision,
    });
    expect(query.chain.from).toHaveBeenCalledWith(institutionScopes);
    expect(query.chain.where).toHaveBeenCalledWith({
      operator: 'and',
      conditions: [
        {
          column: institutionScopes.tenantId,
          operator: 'eq',
          value: 'tenant-zhengpu',
        },
        {
          column: institutionScopes.institutionId,
          operator: 'eq',
          value: 'institution-zhengpu',
        },
      ],
    });
    expect(query.limit).toHaveBeenCalledWith(2);
    expect(result).toEqual([currentAnchorRow]);
    expect(Object.keys(result[0] ?? {})).toEqual([
      'tenantId',
      'institutionId',
      'status',
      'revision',
    ]);
  });

  it('保留空结果与重复结果，由上层读取器统一做拒绝和异常分类', async () => {
    const emptyQuery = createDatabase([]);
    const duplicateQuery = createDatabase([currentAnchorRow, currentAnchorRow]);

    await expect(
      createInstitutionAnchorFactRepositoryV1(
        emptyQuery.database,
      ).findCurrentInstitutionAnchorFacts({
        tenantId: 'tenant-zhengpu',
        institutionId: 'institution-zhengpu',
      }),
    ).resolves.toEqual([]);
    await expect(
      createInstitutionAnchorFactRepositoryV1(
        duplicateQuery.database,
      ).findCurrentInstitutionAnchorFacts({
        tenantId: 'tenant-zhengpu',
        institutionId: 'institution-zhengpu',
      }),
    ).resolves.toHaveLength(2);
  });
});
