import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  createAccessControlAuthoritativeMembershipFactReaderV1,
  isAuthoritativeMembershipFactReaderV1,
} from '@/modules/access-control/application/authoritative-membership-reader';

import {
  createAuthoritativeInstitutionMembershipFactReaderV1,
  createAuthoritativeInstitutionMembershipFactRepositoryV1,
  type CurrentInstitutionMembershipFactRow,
} from '@/modules/access-control/server/authoritative-membership-reader';
import type { TenantDatabase } from '@/server/db/client';
import {
  authAccountInstitutionBindings,
  tenantMembers,
} from '@/server/db/schema';

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

const row: CurrentInstitutionMembershipFactRow = {
  accountId: 'account-a',
  membershipId: 'membership-a',
  membershipTenantId: 'tenant-a',
  membershipUserId: 'account-a',
  membershipRole: 'tenant_admin',
  membershipDisplayName: '机构管理员',
  membershipRevision: 2,
  membershipLifecycleStatus: 'active',
  membershipProvenanceSource: 'access_control_command',
  membershipProvenanceActorId: 'account-admin',
  membershipProvenanceReasonCode: 'membership_refreshed',
  membershipProvenanceCommandId: `mcmd1_${'A'.repeat(43)}`,
  membershipProvenanceOccurredAt: new Date('2026-08-02T01:00:00.000Z'),
  membershipProvenanceRecordedAt: new Date('2026-08-02T01:00:00.000Z'),
  membershipRevokedAt: null,
  membershipDeletedAt: null,
  bindingId: 'binding-a',
  bindingAccountId: 'account-a',
  bindingTenantId: 'tenant-a',
  bindingInstitutionId: 'institution-a',
  bindingStatus: 'active',
  bindingSource: 'manual_admin',
  bindingAssignedAt: new Date('2026-08-01T01:00:00.000Z'),
  bindingExpiresAt: null,
  bindingRevokedAt: null,
  bindingVersion: 3,
};

function createDatabase(rows: readonly CurrentInstitutionMembershipFactRow[]) {
  const limit = vi.fn(async () => rows);
  const chain = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    limit,
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
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

describe('Access Control Membership 权威 Reader Adapter', () => {
  it('由 Owner 无参数组合入口惰性固定唯一数据库且失败不重试', async () => {
    expectTypeOf<
      Parameters<typeof createAccessControlAuthoritativeMembershipFactReaderV1>
    >().toEqualTypeOf<[]>();
    const query = createDatabase([row]);
    getDatabaseMock.mockReturnValue(query.database);
    const reader = createAccessControlAuthoritativeMembershipFactReaderV1();

    expect(isAuthoritativeMembershipFactReaderV1(reader)).toBe(true);
    expect(getDatabaseMock).not.toHaveBeenCalled();
    await expect(
      reader.resolve({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toMatchObject({ kind: 'current_membership_fact' });
    await expect(
      reader.resolve({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toMatchObject({ kind: 'current_membership_fact' });
    expect(getDatabaseMock).toHaveBeenCalledTimes(1);

    getDatabaseMock.mockReset();
    getDatabaseMock.mockImplementation(() => {
      throw new Error('sensitive database failure');
    });
    const unavailableReader =
      createAccessControlAuthoritativeMembershipFactReaderV1();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        unavailableReader.resolve({
          accountId: 'account-a',
          tenantId: 'tenant-a',
          institutionId: 'institution-a',
        }),
      ).resolves.toEqual({
        kind: 'rejected',
        code: 'membership_unavailable',
      });
    }
    expect(getDatabaseMock).toHaveBeenCalledTimes(1);
  });

  it('不把结构相同的调用方对象升级为 genuine Reader', () => {
    const serverReader = createAuthoritativeInstitutionMembershipFactReaderV1({
      repository: {
        findCurrentInstitutionMembershipFacts: vi.fn(async () => [row]),
        findSingleInstitutionMembershipFacts: vi.fn(async () => [row]),
      },
      now: () => new Date('2026-08-02T01:00:01.000Z'),
    });
    expect(isAuthoritativeMembershipFactReaderV1(serverReader)).toBe(false);
    expect(
      isAuthoritativeMembershipFactReaderV1(
        Object.freeze({
          resolve: vi.fn(async () => ({ kind: 'rejected' })),
          resolveSingleForAccount: vi.fn(async () => ({ kind: 'rejected' })),
        }),
      ),
    ).toBe(false);
  });

  it('无 tenant selector 时只允许唯一完整 Membership + Binding', async () => {
    const readSingle = vi.fn(async () => [row]);
    const reader = createAuthoritativeInstitutionMembershipFactReaderV1({
      repository: {
        findCurrentInstitutionMembershipFacts: vi.fn(async () => [row]),
        findSingleInstitutionMembershipFacts: readSingle,
      },
      now: () => new Date('2026-08-02T01:00:01.000Z'),
    });

    await expect(
      reader.resolveSingleForAccount({ accountId: 'account-a' }),
    ).resolves.toMatchObject({
      kind: 'current_membership_fact',
      membershipRevision: 2,
      membershipLifecycleStatus: 'active',
      bindingRevision: 3,
    });
    expect(readSingle).toHaveBeenCalledWith({ accountId: 'account-a' });

    readSingle.mockResolvedValueOnce([]);
    await expect(
      reader.resolveSingleForAccount({ accountId: 'account-a' }),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_denied' });
    readSingle.mockResolvedValueOnce([row, { ...row, membershipId: 'membership-b' }]);
    await expect(
      reader.resolveSingleForAccount({ accountId: 'account-a' }),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_invalid' });
  });

  it.each(['revoked', 'deleted'] as const)(
    '%s lifecycle 永不形成授权事实',
    async (lifecycleStatus) => {
      const occurredAt = new Date('2026-08-02T01:00:00.000Z');
      const lifecycleRow: CurrentInstitutionMembershipFactRow = {
        ...row,
        membershipRevision: 3,
        membershipLifecycleStatus: lifecycleStatus,
        membershipProvenanceReasonCode:
          lifecycleStatus === 'revoked'
            ? 'membership_revoked'
            : 'membership_deleted',
        membershipProvenanceOccurredAt: occurredAt,
        membershipProvenanceRecordedAt: occurredAt,
        membershipRevokedAt:
          lifecycleStatus === 'revoked' ? occurredAt : null,
        membershipDeletedAt:
          lifecycleStatus === 'deleted' ? occurredAt : null,
      };
      const reader = createAuthoritativeInstitutionMembershipFactReaderV1({
        repository: {
          findCurrentInstitutionMembershipFacts: vi.fn(async () => [lifecycleRow]),
        },
        now: () => new Date('2026-08-02T01:00:01.000Z'),
      });
      await expect(
        reader.resolve({
          accountId: 'account-a',
          tenantId: 'tenant-a',
          institutionId: 'institution-a',
        }),
      ).resolves.toEqual({ kind: 'rejected', code: 'membership_denied' });
    },
  );

  it.each([
    ['binding 缺失', { ...row, bindingId: null }],
    ['binding 已撤销', { ...row, bindingStatus: 'revoked' }],
    [
      'binding 来源只为 placeholder',
      { ...row, bindingSource: 'migration_placeholder' },
    ],
    [
      'binding 已到期',
      { ...row, bindingExpiresAt: new Date('2026-08-02T01:00:01.000Z') },
    ],
  ] as const)('%s 时失败关闭', async (_label, candidate) => {
    const reader = createAuthoritativeInstitutionMembershipFactReaderV1({
      repository: {
        findCurrentInstitutionMembershipFacts: vi.fn(async () => [candidate as never]),
      },
      now: () => new Date('2026-08-02T01:00:01.000Z'),
    });
    const result = await reader.resolve({
      accountId: 'account-a',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
    });
    expect(result.kind).toBe('rejected');
  });

  it('Repository 返回后再读取时钟，在 expiry 边界拒绝且不使用旧时间', async () => {
    let clock = new Date('2026-08-02T01:00:00.000Z');
    const expiring = {
      ...row,
      bindingExpiresAt: new Date('2026-08-02T01:00:01.000Z'),
    };
    const reader = createAuthoritativeInstitutionMembershipFactReaderV1({
      repository: {
        findCurrentInstitutionMembershipFacts: vi.fn(async () => {
          clock = new Date('2026-08-02T01:00:01.000Z');
          return [expiring];
        }),
      },
      now: () => clock,
    });

    await expect(
      reader.resolve({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_denied' });
  });

  it('只从显式 revision、lifecycle 与 provenance 列读取当前事实', async () => {
    const query = createDatabase([row]);
    const repository = createAuthoritativeInstitutionMembershipFactRepositoryV1(
      query.database,
    );

    await expect(
      repository.findCurrentInstitutionMembershipFacts({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toEqual([row]);

    expect(query.select).toHaveBeenCalledWith({
      accountId: tenantMembers.userId,
      membershipId: tenantMembers.id,
      membershipTenantId: tenantMembers.tenantId,
      membershipUserId: tenantMembers.userId,
      membershipRole: tenantMembers.role,
      membershipDisplayName: tenantMembers.displayName,
      membershipRevision: tenantMembers.revision,
      membershipLifecycleStatus: tenantMembers.lifecycleStatus,
      membershipProvenanceSource: tenantMembers.currentProvenanceSource,
      membershipProvenanceActorId: tenantMembers.currentProvenanceActorId,
      membershipProvenanceReasonCode: tenantMembers.currentProvenanceReasonCode,
      membershipProvenanceCommandId: tenantMembers.currentProvenanceCommandId,
      membershipProvenanceOccurredAt: tenantMembers.currentProvenanceOccurredAt,
      membershipProvenanceRecordedAt: tenantMembers.currentProvenanceRecordedAt,
      membershipRevokedAt: tenantMembers.revokedAt,
      membershipDeletedAt: tenantMembers.deletedAt,
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
    expect(query.chain.from).toHaveBeenCalledWith(tenantMembers);
    expect(query.chain.innerJoin).not.toHaveBeenCalled();
    expect(query.chain.leftJoin).toHaveBeenCalledWith(
      authAccountInstitutionBindings,
      {
        conditions: [
          {
            column: authAccountInstitutionBindings.accountId,
            operator: 'eq',
            value: 'account-a',
          },
          {
            column: authAccountInstitutionBindings.tenantId,
            operator: 'eq',
            value: tenantMembers.tenantId,
          },
          {
            column: authAccountInstitutionBindings.institutionId,
            operator: 'eq',
            value: 'institution-a',
          },
          {
            column: authAccountInstitutionBindings.status,
            operator: 'eq',
            value: 'active',
          },
        ],
        operator: 'and',
      },
    );
    expect(query.chain.where).toHaveBeenCalledWith({
      conditions: [
        { column: tenantMembers.userId, operator: 'eq', value: 'account-a' },
        { column: tenantMembers.tenantId, operator: 'eq', value: 'tenant-a' },
      ],
      operator: 'and',
    });
    expect(query.chain.limit).toHaveBeenCalledWith(2);
  });
});
