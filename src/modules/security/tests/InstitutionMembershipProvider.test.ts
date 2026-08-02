import { describe, expect, expectTypeOf, it, vi } from 'vitest';

const readerProvenance = vi.hoisted(() => ({
  identity: new WeakSet<object>(),
  membership: new WeakSet<object>(),
}));

vi.mock(
  '@/modules/auth/application/authoritative-formal-session-identity-reader',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/modules/auth/application/authoritative-formal-session-identity-reader')
    >();
    return {
      ...actual,
      isAuthoritativeFormalSessionIdentityFactReaderV1(value: unknown) {
        return value !== null && typeof value === 'object' && readerProvenance.identity.has(value);
      },
    };
  },
);

vi.mock(
  '@/modules/access-control/application/authoritative-membership-reader',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/modules/access-control/application/authoritative-membership-reader')
    >();
    return {
      ...actual,
      isAuthoritativeMembershipFactReaderV1(value: unknown) {
        return (
          value !== null &&
          typeof value === 'object' &&
          readerProvenance.membership.has(value)
        );
      },
    };
  },
);

import type { AuthoritativeMembershipFactReaderV1 as AuthoritativeInstitutionMembershipFactReaderV1 } from '@/modules/access-control/ports/authoritative-membership-reader';
import type { AuthoritativeFormalSessionIdentityFactReaderV1 } from '@/modules/auth/ports/authoritative-formal-session-identity-reader';
import { MEMBERSHIP_MAX_REVISION } from '@/modules/access-control/domain/membership-lifecycle';
import {
  createAuthoritativeInstitutionMembershipFactReaderV1 as createUnbrandedMembershipFactReaderV1,
  type CurrentInstitutionMembershipFactRow,
  type InstitutionMembershipFactRepositoryV1,
} from '@/modules/access-control/server/authoritative-membership-reader';
import {
  createRequestBoundFreshActiveMembershipProviderV1,
  isFreshActiveMembershipProviderV1,
} from '@/modules/security/server/institution-membership-provider';
import {
  createInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceOwnerSubjectV1,
} from '@/modules/security/server/institution-guard-reference';
import {
  isGuardReferenceCandidateV1,
  type FormalRequestProvenanceEvidenceV1,
  type FreshActiveMembershipProviderV1,
} from '@/modules/security/server/institution-guard-evidence';

const NOW = new Date('2026-07-18T08:00:00.000Z');
const LEGACY_MEMBERSHIP_COMMAND_ID = `mcal1_${'a'.repeat(64)}`;
const RUNTIME_MEMBERSHIP_COMMAND_ID = `mcmd1_${'A'.repeat(43)}`;

function createAuthoritativeInstitutionMembershipFactReaderV1(
  input: Parameters<typeof createUnbrandedMembershipFactReaderV1>[0],
) {
  const reader = createUnbrandedMembershipFactReaderV1(input);
  readerProvenance.membership.add(reader);
  return reader;
}

const currentRow: CurrentInstitutionMembershipFactRow = {
  accountId: 'auth-user-chenlei',
  membershipId: 'tenant-member-chenlei',
  membershipTenantId: 'tenant-zhengpu',
  membershipUserId: 'auth-user-chenlei',
  membershipRole: 'tenant_admin',
  membershipDisplayName: '陈蕾',
  membershipRevision: 1,
  membershipLifecycleStatus: 'active',
  membershipProvenanceSource: 'legacy_calibration',
  membershipProvenanceActorId: null,
  membershipProvenanceReasonCode: 'legacy_unknown',
  membershipProvenanceCommandId: LEGACY_MEMBERSHIP_COMMAND_ID,
  membershipProvenanceOccurredAt: null,
  membershipProvenanceRecordedAt: new Date('2026-07-18T07:58:00.000Z'),
  membershipRevokedAt: null,
  membershipDeletedAt: null,
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

function identityFact(
  accountId = currentRow.accountId,
  overrides: Partial<{
    username: string;
    displayName: string;
  }> = {},
) {
  return Object.freeze({
    kind: 'current_identity_fact' as const,
    accountId,
    username: overrides.username ?? 'membership_operator',
    displayName: overrides.displayName ?? '成员操作员',
    status: 'active' as const,
    observedAt: NOW.toISOString(),
  });
}

function genuineIdentityReader(
  resolve: AuthoritativeFormalSessionIdentityFactReaderV1['resolve'] = vi.fn(
    async (input) => identityFact(input.accountId),
  ),
): AuthoritativeFormalSessionIdentityFactReaderV1 {
  const reader = Object.freeze({ resolve });
  readerProvenance.identity.add(reader);
  return reader;
}

function createReader(input: {
  rows?: readonly CurrentInstitutionMembershipFactRow[];
  error?: Error;
  now?: () => Date;
} = {}) {
  const findCurrentInstitutionMembershipFacts = input.error
    ? vi.fn<InstitutionMembershipFactRepositoryV1['findCurrentInstitutionMembershipFacts']>(async () => {
        throw input.error;
      })
    : vi.fn<InstitutionMembershipFactRepositoryV1['findCurrentInstitutionMembershipFacts']>(
        async () => (input.rows ? [...input.rows] : [currentRow]),
      );
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
      institutionId: 'institution-zhengpu',
    });
    expect(result).toEqual({
      kind: 'current_membership_fact',
      accountId: 'auth-user-chenlei',
      tenantId: 'tenant-zhengpu',
      institutionId: 'institution-zhengpu',
      role: 'tenant_admin',
      membershipDisplayName: '陈蕾',
      membershipId: 'tenant-member-chenlei',
      membershipRevision: 1,
      membershipLifecycleStatus: 'active',
      bindingId: 'auth-binding-chenlei',
      bindingRevision: 7,
      bindingRevisionAt: '2026-07-01T00:00:00.000Z',
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
    ['租户成员不存在', []],
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
    [
      '成员已撤销',
      [{
        ...currentRow,
        membershipRevision: 2,
        membershipLifecycleStatus: 'revoked',
        membershipProvenanceSource: 'access_control_command',
        membershipProvenanceActorId: 'account-admin',
        membershipProvenanceReasonCode: 'membership_revoked',
        membershipProvenanceCommandId: RUNTIME_MEMBERSHIP_COMMAND_ID,
        membershipProvenanceOccurredAt: new Date('2026-07-18T07:59:00.000Z'),
        membershipProvenanceRecordedAt: new Date('2026-07-18T07:59:00.000Z'),
        membershipRevokedAt: new Date('2026-07-18T07:59:00.000Z'),
      }],
    ],
    [
      '成员已删除',
      [{
        ...currentRow,
        membershipRevision: 2,
        membershipLifecycleStatus: 'deleted',
        membershipProvenanceSource: 'access_control_command',
        membershipProvenanceActorId: 'account-admin',
        membershipProvenanceReasonCode: 'membership_deleted',
        membershipProvenanceCommandId: RUNTIME_MEMBERSHIP_COMMAND_ID,
        membershipProvenanceOccurredAt: new Date('2026-07-18T07:59:00.000Z'),
        membershipProvenanceRecordedAt: new Date('2026-07-18T07:59:00.000Z'),
        membershipDeletedAt: new Date('2026-07-18T07:59:00.000Z'),
      }],
    ],
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
    'platform_admin',
    'platform_operator',
    'security_auditor',
  ] as const)('平台角色 %s 不是机构 Membership 角色并按无效事实拒绝', async (membershipRole) => {
    const { reader } = createReader({
      rows: [{ ...currentRow, membershipRole }],
    });

    await expect(reader.resolve(requestedMembership)).resolves.toEqual({
      kind: 'rejected',
      code: 'membership_invalid',
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
    ['成员 revision 非正整数', [{ ...currentRow, membershipRevision: 0 }]],
    [
      '成员 revision 超过上限',
      [{ ...currentRow, membershipRevision: MEMBERSHIP_MAX_REVISION + 1 }],
    ],
    ['成员生命周期缺失', [{ ...currentRow, membershipLifecycleStatus: null }]],
    [
      'legacy command ID 不规范',
      [{ ...currentRow, membershipProvenanceCommandId: 'legacy-membership-a' }],
    ],
    [
      'runtime command ID 不规范',
      [{
        ...currentRow,
        membershipRevision: 2,
        membershipProvenanceSource: 'access_control_command',
        membershipProvenanceActorId: 'account-admin',
        membershipProvenanceReasonCode: 'membership_refreshed',
        membershipProvenanceCommandId: 'command-refresh-001',
        membershipProvenanceOccurredAt: new Date('2026-07-18T07:59:00.000Z'),
        membershipProvenanceRecordedAt: new Date('2026-07-18T07:59:00.000Z'),
      }],
    ],
    [
      'provenance reason code 不规范',
      [{ ...currentRow, membershipProvenanceReasonCode: 'Membership.Refresh' }],
    ],
    [
      'formal onboarding provenance 位于未来',
      [{
        ...currentRow,
        membershipProvenanceSource: 'formal_onboarding',
        membershipProvenanceActorId: 'account-admin',
        membershipProvenanceReasonCode: 'membership_created',
        membershipProvenanceCommandId: RUNTIME_MEMBERSHIP_COMMAND_ID,
        membershipProvenanceOccurredAt: new Date('2026-07-18T08:00:00.001Z'),
        membershipProvenanceRecordedAt: new Date('2026-07-18T08:00:00.001Z'),
      }],
    ],
    [
      'runtime provenance 位于未来',
      [{
        ...currentRow,
        membershipRevision: 2,
        membershipProvenanceSource: 'access_control_command',
        membershipProvenanceActorId: 'account-admin',
        membershipProvenanceReasonCode: 'membership_refreshed',
        membershipProvenanceCommandId: RUNTIME_MEMBERSHIP_COMMAND_ID,
        membershipProvenanceOccurredAt: new Date('2026-07-18T08:00:00.001Z'),
        membershipProvenanceRecordedAt: new Date('2026-07-18T08:00:00.001Z'),
      }],
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

  it('严格快照 factory 与依赖方法，恶意 getter 和 Proxy 不得执行', async () => {
    const findFacts = vi.fn(async () => [currentRow]);
    const validRepository = {
      findCurrentInstitutionMembershipFacts: findFacts,
    };
    let getterReads = 0;
    let applyTraps = 0;
    const accessorFactory = {} as Record<string, unknown>;
    Object.defineProperty(accessorFactory, 'repository', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('repository getter must not run');
      },
    });
    Object.defineProperty(accessorFactory, 'now', {
      enumerable: true,
      value: () => NOW,
    });
    const repositoryAccessor = {} as Record<string, unknown>;
    Object.defineProperty(repositoryAccessor, 'findCurrentInstitutionMembershipFacts', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('find getter must not run');
      },
    });
    const nowAccessorFactory = { repository: validRepository } as Record<
      string,
      unknown
    >;
    Object.defineProperty(nowAccessorFactory, 'now', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('now getter must not run');
      },
    });
    const proxiedMethod = new Proxy(findFacts, {
      apply() {
        applyTraps += 1;
        throw new Error('find apply trap must not run');
      },
    });
    const proxiedNow = new Proxy(() => NOW, {
      apply() {
        applyTraps += 1;
        throw new Error('now apply trap must not run');
      },
    });
    const baseFactory = { repository: validRepository, now: () => NOW };
    const factories: unknown[] = [
      new Proxy(baseFactory, {
        get() {
          getterReads += 1;
          throw new Error('factory getter must not run');
        },
      }),
      accessorFactory,
      { ...baseFactory, extra: 'forbidden' },
      Object.assign({ ...baseFactory }, { [Symbol('scope')]: 'forbidden' }),
      Object.assign(Object.create({ inherited: true }), baseFactory),
      Object.assign(Object.create(null), baseFactory),
      { repository: repositoryAccessor, now: () => NOW },
      {
        repository: { findCurrentInstitutionMembershipFacts: proxiedMethod },
        now: () => NOW,
      },
      { repository: validRepository, now: proxiedNow },
      nowAccessorFactory,
    ];

    for (const factory of factories) {
      const reader = createAuthoritativeInstitutionMembershipFactReaderV1(
        factory as never,
      );
      await expect(reader.resolve(requestedMembership)).resolves.toEqual({
        kind: 'rejected',
        code: 'membership_unavailable',
      });
    }
    expect(getterReads).toBe(0);
    expect(applyTraps).toBe(0);
    expect(findFacts).not.toHaveBeenCalled();
  });
});

const REFERENCE_KEY = new Uint8Array(32).fill(0x31);

function ownerSubject(value: string) {
  return value as InstitutionGuardReferenceOwnerSubjectV1;
}

function createReferenceCodec() {
  return createInstitutionGuardReferenceCodecV1({
    keyRing: {
      currentIssueKey: { keyVersion: 1, keyMaterial: REFERENCE_KEY },
      verifyOnlyKeys: [],
    },
    now: () => NOW,
  });
}

function issueUserReference(
  codec: InstitutionGuardReferenceCodecV1,
  accountId = currentRow.accountId,
) {
  const result = codec.issue({
    prefix: 'usr',
    ownerDomain: 'zmtg.auth-account.v1',
    tenantId: null,
    institutionId: null,
    ownerSubject: ownerSubject(accountId),
  });
  if (result.kind !== 'issued') throw new Error('expected usr fixture');
  return result.reference;
}

function provenance(
  codec: InstitutionGuardReferenceCodecV1,
  accountId = currentRow.accountId,
) {
  return Object.freeze({
    source: 'server_session',
    userReference: issueUserReference(codec, accountId),
    tenantId: currentRow.membershipTenantId,
    institutionId: currentRow.bindingInstitutionId,
    requestReference: `req_v1_k1_${'A'.repeat(43)}`,
    proofReference: `prf_v1_k1_${'B'.repeat(43)}`,
    issuedAt: '2026-07-18T07:59:00.000Z',
    verifiedAt: '2026-07-18T07:59:01.000Z',
    validUntil: '2026-07-18T08:04:00.000Z',
  }) as unknown as FormalRequestProvenanceEvidenceV1;
}

function createRequestBoundProvider(input: {
  fact?: Record<string, unknown>;
  factResolution?: unknown;
  factError?: Error;
  codec?: InstitutionGuardReferenceCodecV1;
  now?: () => Date;
  accountId?: string;
  identityResolve?: AuthoritativeFormalSessionIdentityFactReaderV1['resolve'];
} = {}) {
  const fact = input.fact ?? {};
  const membershipRevision =
    typeof fact.membershipRevision === 'number'
      ? fact.membershipRevision
      : currentRow.membershipRevision;
  const revisionChanged = membershipRevision !== 1;
  const row: CurrentInstitutionMembershipFactRow = {
    ...currentRow,
    membershipTenantId:
      typeof fact.tenantId === 'string' ? fact.tenantId : currentRow.membershipTenantId,
    membershipRole:
      (fact.role as CurrentInstitutionMembershipFactRow['membershipRole']) ??
      currentRow.membershipRole,
    membershipId:
      typeof fact.membershipId === 'string' ? fact.membershipId : currentRow.membershipId,
    membershipRevision,
    membershipLifecycleStatus:
      typeof fact.membershipLifecycleStatus === 'string'
        ? fact.membershipLifecycleStatus
        : currentRow.membershipLifecycleStatus,
    membershipProvenanceSource: revisionChanged
      ? 'access_control_command'
      : currentRow.membershipProvenanceSource,
    membershipProvenanceActorId: revisionChanged
      ? 'account-admin'
      : currentRow.membershipProvenanceActorId,
    membershipProvenanceReasonCode: revisionChanged
      ? 'membership_refreshed'
      : currentRow.membershipProvenanceReasonCode,
    membershipProvenanceCommandId: revisionChanged
      ? RUNTIME_MEMBERSHIP_COMMAND_ID
      : currentRow.membershipProvenanceCommandId,
    membershipProvenanceOccurredAt: revisionChanged
      ? new Date('2026-07-18T07:59:00.000Z')
      : currentRow.membershipProvenanceOccurredAt,
    membershipProvenanceRecordedAt: revisionChanged
      ? new Date('2026-07-18T07:59:00.000Z')
      : currentRow.membershipProvenanceRecordedAt,
    bindingTenantId:
      typeof fact.tenantId === 'string' ? fact.tenantId : currentRow.bindingTenantId,
    bindingInstitutionId:
      typeof fact.institutionId === 'string'
        ? fact.institutionId
        : currentRow.bindingInstitutionId,
    bindingId:
      typeof fact.bindingId === 'string' ? fact.bindingId : currentRow.bindingId,
    bindingVersion:
      typeof fact.bindingRevision === 'number'
        ? fact.bindingRevision
        : currentRow.bindingVersion,
    bindingAssignedAt:
      typeof fact.bindingRevisionAt === 'string'
        ? new Date(fact.bindingRevisionAt)
        : currentRow.bindingAssignedAt,
    bindingExpiresAt:
      fact.bindingExpiresAt === null
        ? null
        : typeof fact.bindingExpiresAt === 'string'
          ? new Date(fact.bindingExpiresAt)
          : currentRow.bindingExpiresAt,
  };
  const rejection = input.factResolution as
    | { kind?: unknown; code?: unknown }
    | undefined;
  const readerInput =
    input.factError || rejection?.code === 'membership_unavailable'
      ? { error: input.factError ?? new Error('controlled unavailable'), now: input.now }
      : rejection?.code === 'membership_denied'
        ? { rows: [] as readonly CurrentInstitutionMembershipFactRow[], now: input.now }
        : rejection?.code === 'membership_invalid'
          ? {
              rows: [{ ...row, membershipUserId: 'account-mismatch' }],
              now: input.now,
            }
          : { rows: [row], now: input.now };
  const { reader: factReader, findCurrentInstitutionMembershipFacts } =
    createReader(readerInput);
  const codec = input.codec ?? createReferenceCodec();
  const identityFactReader = genuineIdentityReader(input.identityResolve);
  return {
    codec,
    factReader,
    identityFactReader,
    resolveIdentity: identityFactReader.resolve,
    resolveFact: findCurrentInstitutionMembershipFacts,
    provider: createRequestBoundFreshActiveMembershipProviderV1({
      accountId: input.accountId ?? currentRow.accountId,
      identityFactReader,
      factReader,
      referenceCodec: codec,
      now: input.now ?? (() => NOW),
    }),
  };
}

function requestBoundInput(codec: InstitutionGuardReferenceCodecV1) {
  return {
    provenance: provenance(codec),
    requestedScope: {
      tenantId: currentRow.membershipTenantId,
      institutionId: currentRow.bindingInstitutionId as string,
    },
  };
}

describe('BASE-02B-MEMBERSHIP-02A request-bound owner composer', () => {
  it('recognizes only the exact frozen provider handle created by the factory', () => {
    const { provider } = createRequestBoundProvider();
    const plain = { resolve: provider.resolve };
    const spread = { ...provider };
    const castOnly = { resolve: provider.resolve } as FreshActiveMembershipProviderV1;
    const customPrototype = Object.create({ resolve: provider.resolve }) as object;

    expect(Object.isFrozen(provider)).toBe(true);
    expect(isFreshActiveMembershipProviderV1(provider)).toBe(true);
    expect(isFreshActiveMembershipProviderV1(plain)).toBe(false);
    expect(isFreshActiveMembershipProviderV1(spread)).toBe(false);
    expect(isFreshActiveMembershipProviderV1(castOnly)).toBe(false);
    expect(isFreshActiveMembershipProviderV1(customPrototype)).toBe(false);
    expect(isFreshActiveMembershipProviderV1(null)).toBe(false);
    expect(isFreshActiveMembershipProviderV1(() => undefined)).toBe(false);
  });

  it('checks authenticity without reading getters or invoking Proxy traps', () => {
    const { provider } = createRequestBoundProvider();
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'resolve', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('authenticity check must not read resolve');
      },
    });
    const traps: ProxyHandler<object> = {
      get() {
        proxyTraps += 1;
        throw new Error('get trap must not run');
      },
      getOwnPropertyDescriptor() {
        proxyTraps += 1;
        throw new Error('descriptor trap must not run');
      },
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('prototype trap must not run');
      },
      has() {
        proxyTraps += 1;
        throw new Error('has trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('ownKeys trap must not run');
      },
    };
    const proxy = new Proxy(provider, traps);
    const revocable = Proxy.revocable(provider, traps);
    revocable.revoke();

    expect(isFreshActiveMembershipProviderV1(accessor)).toBe(false);
    expect(isFreshActiveMembershipProviderV1(proxy)).toBe(false);
    expect(isFreshActiveMembershipProviderV1(revocable.proxy)).toBe(false);
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('keeps a factory-created handle authentic when invalid dependencies resolve unavailable', async () => {
    const codec = createReferenceCodec();
    const provider = createRequestBoundFreshActiveMembershipProviderV1({
      accountId: currentRow.accountId,
      identityFactReader: genuineIdentityReader(),
      factReader: { resolve: 1 } as never,
      referenceCodec: codec,
      now: () => NOW,
    });

    expect(isFreshActiveMembershipProviderV1(provider)).toBe(true);
    await expect(provider.resolve(requestBoundInput(codec))).resolves.toEqual({
      kind: 'rejected',
      code: 'membership_unavailable',
    });
  });

  it('never promotes a query or membership fact lookalike into a genuine reader', async () => {
    const codec = createReferenceCodec();
    const now = vi.fn(() => NOW);
    for (const factReader of [
      requestedMembership,
      Object.freeze({
        kind: 'current_membership_fact',
        accountId: currentRow.accountId,
        tenantId: currentRow.membershipTenantId,
        institutionId: currentRow.bindingInstitutionId,
      }),
    ]) {
      const provider = createRequestBoundFreshActiveMembershipProviderV1({
        accountId: currentRow.accountId,
        identityFactReader: genuineIdentityReader(),
        factReader: factReader as unknown as AuthoritativeInstitutionMembershipFactReaderV1,
        referenceCodec: codec,
        now,
      });
      await expect(provider.resolve(requestBoundInput(codec))).resolves.toEqual({
        kind: 'rejected',
        code: 'membership_unavailable',
      });
    }
    expect(now).not.toHaveBeenCalled();
  });

  it('composes directly from the existing authoritative fact reader', async () => {
    const codec = createReferenceCodec();
    const { reader, findCurrentInstitutionMembershipFacts } = createReader();
    const provider = createRequestBoundFreshActiveMembershipProviderV1({
      accountId: currentRow.accountId,
      identityFactReader: genuineIdentityReader(),
      factReader: reader,
      referenceCodec: codec,
      now: () => NOW,
    });

    await expect(provider.resolve(requestBoundInput(codec))).resolves.toMatchObject({
      kind: 'fresh_active',
      userReference: provenance(codec).userReference,
      membershipRevision: expect.stringMatching(/^mrv_v1_k1_[A-Za-z0-9_-]{43}$/u),
    });
    expect(findCurrentInstitutionMembershipFacts).toHaveBeenCalledTimes(2);
  });

  it('returns a nominal fresh-active result from two stable current snapshots and five all-or-none references', async () => {
    const { codec, provider, resolveFact, resolveIdentity } = createRequestBoundProvider();
    expectTypeOf(provider).toMatchTypeOf<FreshActiveMembershipProviderV1>();

    const result = await provider.resolve(requestBoundInput(codec));

    expect(resolveFact).toHaveBeenCalledTimes(2);
    expect(resolveIdentity).toHaveBeenCalledTimes(2);
    expect(resolveFact).toHaveBeenCalledWith({
      accountId: currentRow.accountId,
      tenantId: currentRow.membershipTenantId,
      institutionId: currentRow.bindingInstitutionId,
    });
    expect(result).toMatchObject({
      kind: 'fresh_active',
      userReference: provenance(codec).userReference,
      role: 'tenant_admin',
      tenantId: currentRow.membershipTenantId,
      institutionId: currentRow.bindingInstitutionId,
      observedAt: NOW.toISOString(),
      freshUntil: '2026-07-18T08:01:00.000Z',
    });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind !== 'fresh_active') throw new Error('expected active evidence');
    for (const [field, prefix] of [
      ['userReference', 'usr'],
      ['membershipReference', 'mbr'],
      ['membershipRevision', 'mrv'],
      ['bindingReference', 'bnd'],
      ['bindingRevision', 'brv'],
    ] as const) {
      expect(isGuardReferenceCandidateV1(result[field], prefix)).toBe(true);
    }
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(currentRow.accountId);
    expect(serialized).not.toContain(currentRow.membershipId);
    expect(serialized).not.toContain(currentRow.bindingId as string);
    expect(serialized).not.toContain('2026-07-18T07:58:00.000Z');
    expect(serialized).not.toContain('"bindingRevision":7');
  });

  it.each([
    ['identity_denied', 'membership_denied'],
    ['identity_invalid', 'membership_invalid'],
    ['identity_unavailable', 'membership_unavailable'],
  ] as const)(
    'I1 %s 时映射为 %s 且零 Membership 读取',
    async (identityCode, membershipCode) => {
      const resolveIdentity = vi.fn<
        AuthoritativeFormalSessionIdentityFactReaderV1['resolve']
      >(async () => ({ kind: 'rejected', code: identityCode }));
      const created = createRequestBoundProvider({ identityResolve: resolveIdentity });

      await expect(
        created.provider.resolve(requestBoundInput(created.codec)),
      ).resolves.toEqual({ kind: 'rejected', code: membershipCode });
      expect(resolveIdentity).toHaveBeenCalledTimes(1);
      expect(created.resolveFact).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['identity_denied', 'membership_denied'],
    ['identity_invalid', 'membership_invalid'],
    ['identity_unavailable', 'membership_unavailable'],
  ] as const)(
    'I2 %s 时映射为 %s 且不发布事实',
    async (identityCode, membershipCode) => {
      const resolveIdentity = vi.fn<
        AuthoritativeFormalSessionIdentityFactReaderV1['resolve']
      >();
      resolveIdentity
        .mockResolvedValueOnce(identityFact())
        .mockResolvedValueOnce({ kind: 'rejected', code: identityCode });
      const created = createRequestBoundProvider({ identityResolve: resolveIdentity });

      await expect(
        created.provider.resolve(requestBoundInput(created.codec)),
      ).resolves.toEqual({ kind: 'rejected', code: membershipCode });
      expect(resolveIdentity).toHaveBeenCalledTimes(2);
      expect(created.resolveFact).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    ['username', identityFact(currentRow.accountId, { username: 'other_operator' })],
    ['displayName', identityFact(currentRow.accountId, { displayName: '另一操作员' })],
  ] as const)('I1／I2 %s 漂移时返回 membership_stale', async (_field, secondFact) => {
    const resolveIdentity = vi.fn<
      AuthoritativeFormalSessionIdentityFactReaderV1['resolve']
    >();
    resolveIdentity
      .mockResolvedValueOnce(identityFact())
      .mockResolvedValueOnce(secondFact);
    const created = createRequestBoundProvider({ identityResolve: resolveIdentity });

    await expect(
      created.provider.resolve(requestBoundInput(created.codec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_stale' });
    expect(resolveIdentity).toHaveBeenCalledTimes(2);
    expect(created.resolveFact).toHaveBeenCalledTimes(2);
  });

  it('rejects a structural codec lookalike before method or fact access', async () => {
    const realCodec = createReferenceCodec();
    const issue = vi.fn(realCodec.issue);
    const verify = vi.fn(realCodec.verify);
    const codec = { issue, verify } as unknown as InstitutionGuardReferenceCodecV1;
    const created = createRequestBoundProvider({ codec });

    await expect(
      created.provider.resolve(requestBoundInput(realCodec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_unavailable' });
    expect(issue).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(created.resolveFact).not.toHaveBeenCalled();
  });

  it('rejects fake reader and codec handle matrices before methods, facts or clock', async () => {
    const realCodec = createReferenceCodec();
    const { reader: realReader, findCurrentInstitutionMembershipFacts } =
      createReader();
    const now = vi.fn(() => NOW);
    let getterReads = 0;
    let proxyTraps = 0;
    const traps: ProxyHandler<object> = {
      get() {
        proxyTraps += 1;
        throw new Error('dependency get trap must not run');
      },
      getOwnPropertyDescriptor() {
        proxyTraps += 1;
        throw new Error('dependency descriptor trap must not run');
      },
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('dependency prototype trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('dependency ownKeys trap must not run');
      },
    };
    const readerAccessor: Record<string, unknown> = {};
    Object.defineProperty(readerAccessor, 'resolve', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('reader getter must not run');
      },
    });
    const codecAccessor: Record<string, unknown> = { verify: realCodec.verify };
    Object.defineProperty(codecAccessor, 'issue', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('codec getter must not run');
      },
    });
    const readerProxy = new Proxy(realReader, traps);
    const revokedReader = Proxy.revocable(realReader, traps);
    revokedReader.revoke();
    const codecProxy = new Proxy(realCodec, traps);
    const revokedCodec = Proxy.revocable(realCodec, traps);
    revokedCodec.revoke();
    const fakeReaders: unknown[] = [
      { resolve: realReader.resolve },
      { ...realReader },
      Object.assign({}, realReader),
      Object.create(realReader),
      readerAccessor,
      readerProxy,
      revokedReader.proxy,
    ];
    const fakeCodecs: unknown[] = [
      { issue: realCodec.issue, verify: realCodec.verify },
      { ...realCodec },
      Object.assign({}, realCodec),
      Object.create(realCodec),
      codecAccessor,
      codecProxy,
      revokedCodec.proxy,
    ];

    for (const factReader of fakeReaders) {
      const provider = createRequestBoundFreshActiveMembershipProviderV1({
        accountId: currentRow.accountId,
        identityFactReader: genuineIdentityReader(),
        factReader: factReader as AuthoritativeInstitutionMembershipFactReaderV1,
        referenceCodec: realCodec,
        now,
      });
      await expect(provider.resolve(requestBoundInput(realCodec))).resolves.toEqual({
        kind: 'rejected',
        code: 'membership_unavailable',
      });
    }
    for (const referenceCodec of fakeCodecs) {
      const provider = createRequestBoundFreshActiveMembershipProviderV1({
        accountId: currentRow.accountId,
        identityFactReader: genuineIdentityReader(),
        factReader: realReader,
        referenceCodec: referenceCodec as InstitutionGuardReferenceCodecV1,
        now,
      });
      await expect(provider.resolve(requestBoundInput(realCodec))).resolves.toEqual({
        kind: 'rejected',
        code: 'membership_unavailable',
      });
    }
    expect(findCurrentInstitutionMembershipFacts).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('domain-separates revision references across every owner semantic field', async () => {
    const codec = createReferenceCodec();
    const resolveVariant = async (fact: Record<string, unknown>) => {
      const created = createRequestBoundProvider({ codec, fact });
      const result = await created.provider.resolve(requestBoundInput(codec));
      if (result.kind !== 'fresh_active') throw new Error('expected active evidence');
      return result;
    };
    const baseline = await resolveVariant({});
    const membershipIdChanged = await resolveVariant({
      membershipId: 'tenant-member-other',
    });
    const membershipRevisionChanged = await resolveVariant({ membershipRevision: 2 });
    const roleChanged = await resolveVariant({ role: 'consultant' });
    expect(
      new Set([
        baseline.membershipRevision,
        membershipIdChanged.membershipRevision,
        membershipRevisionChanged.membershipRevision,
        roleChanged.membershipRevision,
      ]).size,
    ).toBe(4);

    const bindingIdChanged = await resolveVariant({
      bindingId: 'auth-binding-other',
    });
    const bindingRevisionChanged = await resolveVariant({ bindingRevision: 8 });
    const bindingRevisionAtChanged = await resolveVariant({
      bindingRevisionAt: '2026-07-02T00:00:00.000Z',
    });
    const bindingExpiryChanged = await resolveVariant({
      bindingExpiresAt: '2026-07-18T08:00:30.000Z',
    });
    expect(
      new Set([
        baseline.bindingRevision,
        bindingIdChanged.bindingRevision,
        bindingRevisionChanged.bindingRevision,
        bindingRevisionAtChanged.bindingRevision,
        bindingExpiryChanged.bindingRevision,
      ]).size,
    ).toBe(5);
  });

  it('reissues usr from the captured account and requires exact provenance equality', async () => {
    const { codec, provider } = createRequestBoundProvider();
    await expect(
      provider.resolve({
        ...requestBoundInput(codec),
        provenance: provenance(codec, 'auth-user-other'),
      }),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_invalid' });
  });

  it.each([
    'membership_denied',
    'membership_invalid',
    'membership_unavailable',
  ] as const)('preserves low-sensitive raw rejection %s', async (code) => {
    const { codec, provider } = createRequestBoundProvider({
      factResolution: { kind: 'rejected', code },
    });
    await expect(provider.resolve(requestBoundInput(codec))).resolves.toEqual({
      kind: 'rejected',
      code,
    });
  });

  it('preserves the authoritative reader denial for an already expired binding', async () => {
    const expired = createRequestBoundProvider({
      fact: { bindingExpiresAt: NOW.toISOString() },
    });
    await expect(
      expired.provider.resolve(requestBoundInput(expired.codec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_denied' });
  });

  it('narrows the 60-second TTL to an earlier binding expiry', async () => {
    const { codec, provider } = createRequestBoundProvider({
      fact: { bindingExpiresAt: '2026-07-18T08:00:30.000Z' },
    });
    await expect(provider.resolve(requestBoundInput(codec))).resolves.toMatchObject({
      kind: 'fresh_active',
      observedAt: NOW.toISOString(),
      freshUntil: '2026-07-18T08:00:30.000Z',
    });
  });

  it.each([
    ['scope mismatch', { tenantId: 'tenant-other' }],
    ['unknown role', { role: 'unknown-role' }],
    ['membership revision malformed', { membershipRevision: 1.5 }],
    ['binding revision fractional', { bindingRevision: 1.5 }],
    ['binding revision time malformed', { bindingRevisionAt: 'not-an-instant' }],
  ] as const)('maps malformed current fact %s to membership_invalid', async (_label, fact) => {
    const created = createRequestBoundProvider({ fact });
    await expect(
      created.provider.resolve(requestBoundInput(created.codec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_invalid' });
  });

  it('fails atomically with a genuine factory-issued unavailable codec', async () => {
    const realCodec = createReferenceCodec();
    const unavailableCodec = createInstitutionGuardReferenceCodecV1({
      keyRing: {
        currentIssueKey: { keyVersion: 1, keyMaterial: null },
        verifyOnlyKeys: [],
      },
      now: () => NOW,
    });
    const created = createRequestBoundProvider({ codec: unavailableCodec });

    await expect(
      created.provider.resolve(requestBoundInput(realCodec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_unavailable' });
    expect(created.resolveFact).toHaveBeenCalledTimes(1);
  });

  it('maps reader and clock failures to membership_unavailable without leaking details', async () => {
    const readerFailure = createRequestBoundProvider({
      factError: new Error('secret database endpoint'),
    });
    await expect(
      readerFailure.provider.resolve(requestBoundInput(readerFailure.codec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_unavailable' });

    const clockFailure = createRequestBoundProvider({
      now: () => {
        throw new Error('secret clock endpoint');
      },
    });
    await expect(
      clockFailure.provider.resolve(requestBoundInput(clockFailure.codec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_unavailable' });
  });

  it('rejects accessor, scalar and Proxy factory methods without reading or invoking them', async () => {
    const codec = createReferenceCodec();
    const factResolve = vi.fn(async () => ({}));
    const identityResolve = vi.fn(async () => ({}));
    let getterReads = 0;
    let applyTraps = 0;
    const accessorMethod = (name: 'resolve' | 'issue' | 'verify') => {
      const value: Record<string, unknown> = {};
      Object.defineProperty(value, name, {
        enumerable: true,
        get() {
          getterReads += 1;
          throw new Error(`${name} getter must not run`);
        },
      });
      return value;
    };
    const accessorCodec = (name: 'issue' | 'verify') => {
      const value: Record<string, unknown> =
        name === 'issue' ? { verify: codec.verify } : { issue: codec.issue };
      Object.defineProperty(value, name, {
        enumerable: true,
        get() {
          getterReads += 1;
          throw new Error(`${name} getter must not run`);
        },
      });
      return value;
    };
    const proxyMethod = <T extends (...args: never[]) => unknown>(method: T) =>
      new Proxy(method, {
        apply() {
          applyTraps += 1;
          throw new Error('proxy apply must not run');
        },
      });
    const validReader = createReader().reader;
    const validIdentityReader = genuineIdentityReader();
    const validCodec = codec;
    const factories: unknown[] = [
      {
        accountId: currentRow.accountId,
        identityFactReader: accessorMethod('resolve'),
        factReader: validReader,
        referenceCodec: validCodec,
        now: () => NOW,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: { resolve: 1 },
        factReader: validReader,
        referenceCodec: validCodec,
        now: () => NOW,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: { resolve: proxyMethod(identityResolve as never) },
        factReader: validReader,
        referenceCodec: validCodec,
        now: () => NOW,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: validIdentityReader,
        factReader: accessorMethod('resolve'),
        referenceCodec: validCodec,
        now: () => NOW,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: validIdentityReader,
        factReader: { resolve: 1 },
        referenceCodec: validCodec,
        now: () => NOW,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: validIdentityReader,
        factReader: { resolve: proxyMethod(factResolve as never) },
        referenceCodec: validCodec,
        now: () => NOW,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: validIdentityReader,
        factReader: validReader,
        referenceCodec: accessorCodec('issue'),
        now: () => NOW,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: validIdentityReader,
        factReader: validReader,
        referenceCodec: { issue: 1, verify: codec.verify },
        now: () => NOW,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: validIdentityReader,
        factReader: validReader,
        referenceCodec: {
          issue: proxyMethod(codec.issue as never),
          verify: codec.verify,
        },
        now: () => NOW,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: validIdentityReader,
        factReader: validReader,
        referenceCodec: accessorCodec('verify'),
        now: () => NOW,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: validIdentityReader,
        factReader: validReader,
        referenceCodec: { issue: codec.issue, verify: 1 },
        now: () => NOW,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: validIdentityReader,
        factReader: validReader,
        referenceCodec: {
          issue: codec.issue,
          verify: proxyMethod(codec.verify as never),
        },
        now: () => NOW,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: validIdentityReader,
        factReader: validReader,
        referenceCodec: validCodec,
        now: 1,
      },
      {
        accountId: currentRow.accountId,
        identityFactReader: validIdentityReader,
        factReader: validReader,
        referenceCodec: validCodec,
        now: proxyMethod((() => NOW) as never),
      },
    ];
    const nowAccessorFactory = {
      accountId: currentRow.accountId,
      identityFactReader: validIdentityReader,
      factReader: validReader,
      referenceCodec: validCodec,
    };
    Object.defineProperty(nowAccessorFactory, 'now', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('now getter must not run');
      },
    });
    factories.push(nowAccessorFactory);

    const validResolveInput = requestBoundInput(codec);
    for (const factory of factories) {
      const provider = createRequestBoundFreshActiveMembershipProviderV1(
        factory as never,
      );
      await expect(provider.resolve(validResolveInput)).resolves.toEqual({
        kind: 'rejected',
        code: 'membership_unavailable',
      });
    }
    expect(getterReads).toBe(0);
    expect(applyTraps).toBe(0);
    expect(factResolve).not.toHaveBeenCalled();
    expect(identityResolve).not.toHaveBeenCalled();
  });

  it('rejects caller account injection and hostile resolve inputs before reading facts', async () => {
    const created = createRequestBoundProvider();
    const normal = requestBoundInput(created.codec);
    const getter = { ...normal };
    Object.defineProperty(getter, 'requestedScope', {
      enumerable: true,
      get() {
        throw new Error('scope getter must not run');
      },
    });
    for (const value of [
      { ...normal, accountId: 'auth-user-other' },
      getter,
      new Proxy(normal, {}),
    ]) {
      await expect(created.provider.resolve(value as never)).resolves.toEqual({
        kind: 'rejected',
        code: 'membership_invalid',
      });
    }
    expect(created.resolveFact).not.toHaveBeenCalled();
  });

  it('rereads authoritative facts on every resolve', async () => {
    const created = createRequestBoundProvider();
    const input = requestBoundInput(created.codec);
    created.resolveFact
      .mockResolvedValueOnce([
        {
          ...currentRow,
          membershipRevision: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          ...currentRow,
          membershipRevision: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          ...currentRow,
          membershipRevision: 2,
          membershipProvenanceSource: 'access_control_command',
          membershipProvenanceActorId: 'account-admin',
          membershipProvenanceReasonCode: 'membership_refreshed',
          membershipProvenanceCommandId: RUNTIME_MEMBERSHIP_COMMAND_ID,
          membershipProvenanceOccurredAt: new Date('2026-07-18T07:59:00.000Z'),
          membershipProvenanceRecordedAt: new Date('2026-07-18T07:59:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          ...currentRow,
          membershipRevision: 2,
          membershipProvenanceSource: 'access_control_command',
          membershipProvenanceActorId: 'account-admin',
          membershipProvenanceReasonCode: 'membership_refreshed',
          membershipProvenanceCommandId: RUNTIME_MEMBERSHIP_COMMAND_ID,
          membershipProvenanceOccurredAt: new Date('2026-07-18T07:59:00.000Z'),
          membershipProvenanceRecordedAt: new Date('2026-07-18T07:59:00.000Z'),
        },
      ]);
    const first = await created.provider.resolve(input);
    const second = await created.provider.resolve(input);
    expect(created.resolveFact).toHaveBeenCalledTimes(4);
    expect(first).toMatchObject({ kind: 'fresh_active' });
    expect(second).toMatchObject({ kind: 'fresh_active' });
    if (first.kind !== 'fresh_active' || second.kind !== 'fresh_active') {
      throw new Error('expected active evidence');
    }
    expect(first.membershipRevision).not.toBe(second.membershipRevision);
  });
});
