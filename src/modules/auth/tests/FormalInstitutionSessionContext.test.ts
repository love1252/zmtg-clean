import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

const readerProvenance = vi.hoisted(() => ({
  identity: new WeakSet<object>(),
  membership: new WeakSet<object>(),
  scope: new WeakSet<object>(),
}));

vi.mock(
  '@/modules/auth/application/authoritative-formal-session-identity-reader',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/auth/application/authoritative-formal-session-identity-reader')
      >();
    return {
      ...actual,
      isAuthoritativeFormalSessionIdentityFactReaderV1(value: unknown) {
        return (
          value !== null &&
          typeof value === 'object' &&
          readerProvenance.identity.has(value)
        );
      },
    };
  },
);

vi.mock(
  '@/modules/access-control/application/authoritative-membership-reader',
  async (importOriginal) => {
    const actual =
      await importOriginal<
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

vi.mock(
  '@/modules/tenancy/application/authoritative-institution-scope-reader',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/tenancy/application/authoritative-institution-scope-reader')
      >();
    return {
      ...actual,
      isAuthoritativeInstitutionScopeFactReaderV1(value: unknown) {
        return (
          value !== null &&
          typeof value === 'object' &&
          readerProvenance.scope.has(value)
        );
      },
    };
  },
);

import type { AuthoritativeMembershipFactReaderV1 } from '@/modules/access-control/ports/authoritative-membership-reader';
import {
  consumeFormalServerSessionUserSnapshotV1,
  createFormalInstitutionSessionContextResolverV1,
  isFormalInstitutionSessionContextResolverV1,
  isFormalServerSessionUserSnapshotV1,
} from '@/modules/auth/application/formal-institution-session-context';
import type { AuthoritativeFormalSessionIdentityFactReaderV1 } from '@/modules/auth/ports/authoritative-formal-session-identity-reader';
import type { AuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/ports/authoritative-institution-scope-reader';

const identity = Object.freeze({
  kind: 'current_identity_fact' as const,
  accountId: 'account-a',
  username: 'account_a',
  displayName: '账号操作员',
  status: 'active' as const,
  observedAt: '2026-08-02T00:59:59.000Z',
});

function membershipFact(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    kind: 'current_membership_fact' as const,
    accountId: 'account-a',
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    role: 'tenant_admin' as const,
    membershipDisplayName: '机构操作员',
    membershipId: 'membership-a',
    membershipRevision: 7,
    membershipLifecycleStatus: 'active' as const,
    bindingId: 'binding-a',
    bindingRevision: 3,
    bindingRevisionAt: '2026-08-01T01:00:00.000Z',
    bindingExpiresAt: null,
    observedAt: '2026-08-02T00:59:59.000Z',
    ...overrides,
  });
}

function scopeFact(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    kind: 'current_scope_fact' as const,
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    status: 'active' as const,
    revision: 11,
    observedAt: '2026-08-02T00:59:59.500Z',
    ...overrides,
  });
}

function genuineMembershipReader(input: Readonly<{
  resolve?: AuthoritativeMembershipFactReaderV1['resolve'];
  resolveSingleForAccount?: AuthoritativeMembershipFactReaderV1['resolveSingleForAccount'];
}> = {}) {
  const reader = Object.freeze({
    resolve:
      input.resolve ?? vi.fn(async () => membershipFact()),
    resolveSingleForAccount:
      input.resolveSingleForAccount ?? vi.fn(async () => membershipFact()),
  }) satisfies AuthoritativeMembershipFactReaderV1;
  readerProvenance.membership.add(reader);
  return reader;
}

function genuineScopeReader(
  resolve: AuthoritativeInstitutionScopeFactReaderV1['resolve'] = vi.fn(
    async () => scopeFact(),
  ),
) {
  const reader = Object.freeze({ resolve }) satisfies AuthoritativeInstitutionScopeFactReaderV1;
  readerProvenance.scope.add(reader);
  return reader;
}

function genuineIdentityReader(
  resolve: AuthoritativeFormalSessionIdentityFactReaderV1['resolve'] = vi.fn(
    async () => identity,
  ),
) {
  const reader = Object.freeze({ resolve }) satisfies AuthoritativeFormalSessionIdentityFactReaderV1;
  readerProvenance.identity.add(reader);
  return reader;
}

describe('正式机构 Session Context', () => {
  it('生产授权链不再保留 Membership 时间戳 revision fallback', () => {
    const productionAuthorizationPaths = [
      'src/app/api/auth/login/route.ts',
      'src/app/api/auth/session/route.ts',
      'src/modules/access-control/application/authoritative-membership-reader.ts',
      'src/modules/access-control/server/authoritative-membership-reader.ts',
      'src/modules/auth/application/formal-institution-session-context.ts',
      'src/modules/auth/server/auth-account-repository.ts',
      'src/modules/auth/server/formal-server-session-provenance-owner.ts',
      'src/modules/institution/server/institution-server-runtime.ts',
      'src/modules/security/server/institution-membership-provider.ts',
    ] as const;
    const forbiddenFallbacks = [
      'membershipUpdatedAt',
      'membershipRevisionAt',
      'tenantMembers.updatedAt',
    ] as const;

    for (const path of productionAuthorizationPaths) {
      const source = readFileSync(`${process.cwd()}/${path}`, 'utf8');
      for (const forbidden of forbiddenFallbacks) {
        expect(source, `${path} 不得包含 ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('登录严格执行 Identity→single M1→Scope S1→M2→Scope S2，并只允许 snapshot 消费一次', async () => {
    const order: string[] = [];
    const resolveIdentity = vi.fn(async () => {
      order.push('identity');
      return identity;
    });
    const resolveSingle = vi.fn(async () => {
      order.push('membership-m1');
      return membershipFact();
    });
    const resolve = vi.fn(async () => {
      order.push('membership-m2');
      return membershipFact({ observedAt: '2026-08-02T01:00:00.000Z' });
    });
    const resolveScope = vi.fn(async () => {
      order.push('scope');
      return scopeFact();
    });
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: genuineIdentityReader(resolveIdentity),
      membershipReader: genuineMembershipReader({
        resolve,
        resolveSingleForAccount: resolveSingle,
      }),
      scopeReader: genuineScopeReader(resolveScope),
    });

    const result = await resolver.resolveForLogin({ accountId: 'account-a' });

    expect(isFormalInstitutionSessionContextResolverV1(resolver)).toBe(true);
    expect(order).toEqual([
      'identity',
      'membership-m1',
      'scope',
      'membership-m2',
      'scope',
      'identity',
    ]);
    expect(resolveSingle).toHaveBeenCalledWith({ accountId: 'account-a' });
    expect(resolveScope).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
    });
    expect(resolve).toHaveBeenCalledWith({
      accountId: 'account-a',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
    });
    expect(result.kind).toBe('resolved');
    if (result.kind !== 'resolved') throw new Error('expected resolved context');
    expect(isFormalServerSessionUserSnapshotV1(result.snapshot)).toBe(true);
    expect(consumeFormalServerSessionUserSnapshotV1(result.snapshot)).toEqual({
      id: 'account-a',
      username: 'account_a',
      name: '机构操作员',
      role: 'tenant_admin',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
    });
    expect(consumeFormalServerSessionUserSnapshotV1(result.snapshot)).toBeNull();
    expect(JSON.stringify(result.membershipAudit)).not.toContain('Revision');
  });

  it('Session 恢复只使用 selector，并逐请求执行 M1→Scope S1→M2→Scope S2', async () => {
    const resolve = vi
      .fn()
      .mockResolvedValueOnce(membershipFact())
      .mockResolvedValueOnce(
        membershipFact({ observedAt: '2026-08-02T01:00:00.000Z' }),
      );
    const resolveSingle = vi.fn(async () => membershipFact());
    const scope = vi.fn(async () => scopeFact());
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: genuineIdentityReader(),
      membershipReader: genuineMembershipReader({
        resolve,
        resolveSingleForAccount: resolveSingle,
      }),
      scopeReader: genuineScopeReader(scope),
    });

    await expect(
      resolver.resolveForSession({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toMatchObject({ kind: 'resolved' });
    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolveSingle).not.toHaveBeenCalled();
    expect(scope).toHaveBeenCalledTimes(2);
  });

  it('Session selector 与首轮 Membership 事实不一致时立即失败关闭', async () => {
    const resolve = vi.fn(async () =>
      membershipFact({ institutionId: 'institution-b' }),
    );
    const scope = vi.fn(async () => scopeFact());
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: genuineIdentityReader(),
      membershipReader: genuineMembershipReader({ resolve }),
      scopeReader: genuineScopeReader(scope),
    });

    await expect(
      resolver.resolveForSession({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toEqual({ kind: 'invalid' });
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(scope).not.toHaveBeenCalled();
  });

  it('Scope revision 在 S1/S2 之间漂移时返回 stale', async () => {
    const scope = vi
      .fn()
      .mockResolvedValueOnce(scopeFact({ revision: 11 }))
      .mockResolvedValueOnce(scopeFact({ revision: 12 }));
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: genuineIdentityReader(),
      membershipReader: genuineMembershipReader(),
      scopeReader: genuineScopeReader(scope),
    });

    await expect(
      resolver.resolveForSession({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toEqual({ kind: 'stale' });
    expect(scope).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['membership revision', { membershipRevision: 8 }],
    ['membership identity', { membershipId: 'membership-b' }],
    ['role', { role: 'consultant' }],
    ['binding revision', { bindingRevision: 4 }],
    ['binding identity', { bindingId: 'binding-b' }],
    ['binding expiry', { bindingExpiresAt: '2026-08-02T02:00:00.000Z' }],
    ['tenant', { tenantId: 'tenant-b' }],
    ['institution', { institutionId: 'institution-b' }],
  ])('M1/M2 的%s漂移时返回 stale', async (_label, secondOverrides) => {
    const resolve = vi
      .fn()
      .mockResolvedValueOnce(membershipFact())
      .mockResolvedValueOnce(membershipFact(secondOverrides));
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: genuineIdentityReader(),
      membershipReader: genuineMembershipReader({ resolve }),
      scopeReader: genuineScopeReader(),
    });

    await expect(
      resolver.resolveForSession({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toEqual({ kind: 'stale' });
  });

  it.each([
    ['membership denied', { kind: 'rejected', code: 'membership_denied' }, 'denied'],
    [
      'membership unavailable',
      { kind: 'rejected', code: 'membership_unavailable' },
      'unavailable',
    ],
  ] as const)('M2 %s 时失败关闭', async (_label, second, expectedKind) => {
    const resolve = vi
      .fn()
      .mockResolvedValueOnce(membershipFact())
      .mockResolvedValueOnce(second);
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: genuineIdentityReader(),
      membershipReader: genuineMembershipReader({ resolve }),
      scopeReader: genuineScopeReader(),
    });
    await expect(
      resolver.resolveForSession({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toEqual({ kind: expectedKind });
  });

  it.each([
    ['scope denied', { kind: 'rejected', code: 'scope_denied' }, 'denied'],
    [
      'scope unavailable',
      { kind: 'rejected', code: 'scope_unavailable' },
      'unavailable',
    ],
    ['scope invalid', { ...scopeFact(), revision: 0 }, 'invalid'],
  ] as const)('%s 时不执行 M2', async (_label, scopeResolution, expectedKind) => {
    const resolve = vi.fn(async () => membershipFact());
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: genuineIdentityReader(),
      membershipReader: genuineMembershipReader({ resolve }),
      scopeReader: genuineScopeReader(vi.fn(async () => scopeResolution as never)),
    });
    await expect(
      resolver.resolveForSession({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toEqual({ kind: expectedKind });
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['disabled Identity'],
    ['password reset Identity'],
    ['locked Identity'],
  ] as const)('%s 不读取 Membership 或 Scope', async (_label) => {
    const membership = genuineMembershipReader();
    const scope = genuineScopeReader();
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: genuineIdentityReader(
        vi.fn(async () => ({
          kind: 'rejected' as const,
          code: 'identity_denied' as const,
        })),
      ),
      membershipReader: membership,
      scopeReader: scope,
    });
    await expect(
      resolver.resolveForLogin({ accountId: 'account-a' }),
    ).resolves.toEqual({ kind: 'denied' });
    expect(membership.resolveSingleForAccount).not.toHaveBeenCalled();
    expect(scope.resolve).not.toHaveBeenCalled();
  });

  it('非 genuine Reader 使 resolver 在零读取下 unavailable', async () => {
    const identityResolve = vi.fn(async () => identity);
    const membershipResolve = vi.fn(async () => membershipFact());
    const scopeResolve = vi.fn(async () => scopeFact());
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: Object.freeze({ resolve: identityResolve }),
      membershipReader: Object.freeze({
        resolve: membershipResolve,
        resolveSingleForAccount: membershipResolve,
      }),
      scopeReader: Object.freeze({ resolve: scopeResolve }),
    });

    await expect(
      resolver.resolveForLogin({ accountId: 'account-a' }),
    ).resolves.toEqual({ kind: 'unavailable' });
    expect(identityResolve).not.toHaveBeenCalled();
    expect(membershipResolve).not.toHaveBeenCalled();
    expect(scopeResolve).not.toHaveBeenCalled();
  });

  it('Identity 在 I1/I2 之间漂移时返回 stale 且不发布 snapshot', async () => {
    const identityResolve = vi
      .fn()
      .mockResolvedValueOnce(identity)
      .mockResolvedValueOnce({ ...identity, displayName: '已变更账号名' });
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: genuineIdentityReader(identityResolve),
      membershipReader: genuineMembershipReader(),
      scopeReader: genuineScopeReader(),
    });

    await expect(
      resolver.resolveForSession({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toEqual({ kind: 'stale' });
    expect(identityResolve).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['denied', { kind: 'rejected', code: 'identity_denied' }, 'denied'],
    [
      'unavailable',
      { kind: 'rejected', code: 'identity_unavailable' },
      'unavailable',
    ],
    ['invalid', { ...identity, status: 'unknown' }, 'invalid'],
  ] as const)('I2 %s 时在完成 M／S 重读后失败关闭', async (_label, secondIdentity, expectedKind) => {
    const identityResolve = vi
      .fn()
      .mockResolvedValueOnce(identity)
      .mockResolvedValueOnce(secondIdentity);
    const membershipResolve = vi.fn(async () => membershipFact());
    const scopeResolve = vi.fn(async () => scopeFact());
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: genuineIdentityReader(identityResolve),
      membershipReader: genuineMembershipReader({ resolve: membershipResolve }),
      scopeReader: genuineScopeReader(scopeResolve),
    });

    await expect(
      resolver.resolveForSession({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toEqual({ kind: expectedKind });
    expect(identityResolve).toHaveBeenCalledTimes(2);
    expect(membershipResolve).toHaveBeenCalledTimes(2);
    expect(scopeResolve).toHaveBeenCalledTimes(2);
  });

  it('Binding revision 时间在 M1/M2 之间漂移时返回 stale', async () => {
    const resolve = vi
      .fn()
      .mockResolvedValueOnce(membershipFact())
      .mockResolvedValueOnce(
        membershipFact({ bindingRevisionAt: '2026-08-01T01:00:01.000Z' }),
      );
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: genuineIdentityReader(),
      membershipReader: genuineMembershipReader({ resolve }),
      scopeReader: genuineScopeReader(),
    });

    await expect(
      resolver.resolveForSession({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toEqual({ kind: 'stale' });
  });

  it.each([
    ['denied', { kind: 'rejected', code: 'scope_denied' }, 'denied'],
    [
      'unavailable',
      { kind: 'rejected', code: 'scope_unavailable' },
      'unavailable',
    ],
    ['invalid', { ...scopeFact(), revision: 0 }, 'invalid'],
  ] as const)('S2 %s 时失败关闭', async (_label, secondScope, expectedKind) => {
    const scope = vi
      .fn()
      .mockResolvedValueOnce(scopeFact())
      .mockResolvedValueOnce(secondScope);
    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: genuineIdentityReader(),
      membershipReader: genuineMembershipReader(),
      scopeReader: genuineScopeReader(scope),
    });

    await expect(
      resolver.resolveForSession({
        accountId: 'account-a',
        tenantId: 'tenant-a',
        institutionId: 'institution-a',
      }),
    ).resolves.toEqual({ kind: expectedKind });
    expect(scope).toHaveBeenCalledTimes(2);
  });
});
