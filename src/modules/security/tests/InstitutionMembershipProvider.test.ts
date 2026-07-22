import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import type {
  CurrentInstitutionMembershipFactRow,
} from '@/modules/auth/server/auth-account-repository';
import {
  createAuthoritativeInstitutionMembershipFactReaderV1,
  createRequestBoundFreshActiveMembershipProviderV1,
  type AuthoritativeInstitutionMembershipFactReaderV1,
  type InstitutionMembershipFactRepositoryV1,
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

const requestBoundFact = Object.freeze({
  kind: 'current_membership_fact' as const,
  accountId: currentRow.accountId,
  tenantId: currentRow.membershipTenantId,
  institutionId: currentRow.bindingInstitutionId as string,
  role: 'tenant_admin' as const,
  membershipId: currentRow.membershipId,
  membershipRevisionAt: '2026-07-18T07:58:00.000Z',
  bindingId: currentRow.bindingId as string,
  bindingRevision: currentRow.bindingVersion as number,
  bindingExpiresAt: null,
  observedAt: NOW.toISOString(),
});

function createRequestBoundProvider(input: {
  fact?: Record<string, unknown>;
  factResolution?: unknown;
  factError?: Error;
  codec?: InstitutionGuardReferenceCodecV1;
  now?: () => Date;
  accountId?: string;
} = {}) {
  const resolve = vi.fn<AuthoritativeInstitutionMembershipFactReaderV1['resolve']>(
    async () => {
      if (input.factError) throw input.factError;
      return (input.factResolution ?? {
        ...requestBoundFact,
        ...input.fact,
      }) as never;
    },
  );
  const factReader = { resolve } as AuthoritativeInstitutionMembershipFactReaderV1;
  const codec = input.codec ?? createReferenceCodec();
  return {
    codec,
    factReader,
    resolveFact: resolve,
    provider: createRequestBoundFreshActiveMembershipProviderV1({
      accountId: input.accountId ?? currentRow.accountId,
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
  it('composes directly from the existing authoritative fact reader', async () => {
    const codec = createReferenceCodec();
    const { reader, findCurrentInstitutionMembershipFacts } = createReader();
    const provider = createRequestBoundFreshActiveMembershipProviderV1({
      accountId: currentRow.accountId,
      factReader: reader,
      referenceCodec: codec,
      now: () => NOW,
    });

    await expect(provider.resolve(requestBoundInput(codec))).resolves.toMatchObject({
      kind: 'fresh_active',
      userReference: provenance(codec).userReference,
      membershipRevision: expect.stringMatching(/^mrv_v1_k1_[A-Za-z0-9_-]{43}$/u),
    });
    expect(findCurrentInstitutionMembershipFacts).toHaveBeenCalledTimes(1);
  });

  it('returns a nominal fresh-active result from one current reread and five all-or-none references', async () => {
    const { codec, provider, resolveFact } = createRequestBoundProvider();
    expectTypeOf(provider).toMatchTypeOf<FreshActiveMembershipProviderV1>();

    const result = await provider.resolve(requestBoundInput(codec));

    expect(resolveFact).toHaveBeenCalledTimes(1);
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
    expect(serialized).not.toContain(requestBoundFact.membershipRevisionAt);
    expect(serialized).not.toContain('"bindingRevision":7');
  });

  it('uses the frozen owner profiles and scopes for all five references', async () => {
    const realCodec = createReferenceCodec();
    const issue = vi.fn((value: Parameters<InstitutionGuardReferenceCodecV1['issue']>[0]) =>
      realCodec.issue(value),
    );
    const codec = {
      issue,
      verify: realCodec.verify,
    } as unknown as InstitutionGuardReferenceCodecV1;
    const { provider } = createRequestBoundProvider({ codec });

    await expect(provider.resolve(requestBoundInput(realCodec))).resolves.toMatchObject({
      kind: 'fresh_active',
    });
    expect(issue.mock.calls.map(([value]) => value)).toEqual([
      {
        prefix: 'usr',
        ownerDomain: 'zmtg.auth-account.v1',
        tenantId: null,
        institutionId: null,
        ownerSubject: currentRow.accountId,
      },
      {
        prefix: 'mbr',
        ownerDomain: 'security.institution-membership',
        tenantId: currentRow.membershipTenantId,
        institutionId: null,
        ownerSubject: currentRow.membershipId,
      },
      {
        prefix: 'mrv',
        ownerDomain: 'security.institution-membership',
        tenantId: currentRow.membershipTenantId,
        institutionId: null,
        ownerSubject:
          'mrv-v1-YQBnrVDFgpH0DQfZM2PvEz1i4W4bJcMc19uqm2wP9KM',
      },
      {
        prefix: 'bnd',
        ownerDomain: 'security.institution-membership',
        tenantId: currentRow.membershipTenantId,
        institutionId: currentRow.bindingInstitutionId,
        ownerSubject: currentRow.bindingId,
      },
      {
        prefix: 'brv',
        ownerDomain: 'security.institution-membership',
        tenantId: currentRow.membershipTenantId,
        institutionId: currentRow.bindingInstitutionId,
        ownerSubject:
          'brv-v1-juD46e6dviNpqZyYrY1SmfLcRFKWepzyGnIY1bKqCVc',
      },
    ]);
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
    const membershipRevisionChanged = await resolveVariant({
      membershipRevisionAt: '2026-07-18T07:59:00.000Z',
    });
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
    const bindingExpiryChanged = await resolveVariant({
      bindingExpiresAt: '2026-07-18T08:00:30.000Z',
    });
    expect(
      new Set([
        baseline.bindingRevision,
        bindingIdChanged.bindingRevision,
        bindingRevisionChanged.bindingRevision,
        bindingExpiryChanged.bindingRevision,
      ]).size,
    ).toBe(4);
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

  it('maps expired facts and a fact expiring during signing to membership_stale', async () => {
    const expired = createRequestBoundProvider({
      fact: { bindingExpiresAt: NOW.toISOString() },
    });
    await expect(
      expired.provider.resolve(requestBoundInput(expired.codec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_stale' });

    let tick = 0;
    const during = createRequestBoundProvider({
      fact: { bindingExpiresAt: '2026-07-18T08:00:00.002Z' },
      now: () => new Date(NOW.getTime() + tick++ * 2),
    });
    await expect(
      during.provider.resolve(requestBoundInput(during.codec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_stale' });
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
    ['membership revision malformed', { membershipRevisionAt: 'not-an-instant' }],
    ['binding revision fractional', { bindingRevision: 1.5 }],
    ['future observation', { observedAt: '2026-07-18T08:00:00.001Z' }],
  ] as const)('maps malformed current fact %s to membership_invalid', async (_label, fact) => {
    const created = createRequestBoundProvider({ fact });
    await expect(
      created.provider.resolve(requestBoundInput(created.codec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_invalid' });
  });

  it('fails all-or-none when the codec is unavailable and rejects malformed codec output', async () => {
    const realCodec = createReferenceCodec();
    let calls = 0;
    const unavailableCodec = {
      issue: vi.fn((value: Parameters<InstitutionGuardReferenceCodecV1['issue']>[0]) => {
        calls += 1;
        return calls === 3
          ? { kind: 'unavailable', code: 'guard_reference_unavailable' as const }
          : realCodec.issue(value);
      }),
      verify: realCodec.verify,
    } as unknown as InstitutionGuardReferenceCodecV1;
    const unavailable = createRequestBoundProvider({ codec: unavailableCodec });
    await expect(
      unavailable.provider.resolve(requestBoundInput(realCodec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_unavailable' });

    const malformedCodec = {
      issue: vi.fn(() => ({
        kind: 'issued',
        reference: `usr_v1_k1_${'A'.repeat(22)}`,
      })),
      verify: realCodec.verify,
    } as unknown as InstitutionGuardReferenceCodecV1;
    const malformed = createRequestBoundProvider({ codec: malformedCodec });
    await expect(
      malformed.provider.resolve(requestBoundInput(realCodec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_invalid' });

    const unsupportedKeyCodec = {
      issue: vi.fn(() => ({
        kind: 'issued',
        reference: `usr_v1_k2_${'A'.repeat(43)}`,
      })),
      verify: realCodec.verify,
    } as unknown as InstitutionGuardReferenceCodecV1;
    const unsupported = createRequestBoundProvider({ codec: unsupportedKeyCodec });
    await expect(
      unsupported.provider.resolve(requestBoundInput(realCodec)),
    ).resolves.toEqual({ kind: 'rejected', code: 'membership_invalid' });
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
      .mockResolvedValueOnce({
        ...requestBoundFact,
        membershipRevisionAt: '2026-07-18T07:58:00.000Z',
      })
      .mockResolvedValueOnce({
        ...requestBoundFact,
        membershipRevisionAt: '2026-07-18T07:59:00.000Z',
      });
    const first = await created.provider.resolve(input);
    const second = await created.provider.resolve(input);
    expect(created.resolveFact).toHaveBeenCalledTimes(2);
    expect(first).toMatchObject({ kind: 'fresh_active' });
    expect(second).toMatchObject({ kind: 'fresh_active' });
    if (first.kind !== 'fresh_active' || second.kind !== 'fresh_active') {
      throw new Error('expected active evidence');
    }
    expect(first.membershipRevision).not.toBe(second.membershipRevision);
  });
});
