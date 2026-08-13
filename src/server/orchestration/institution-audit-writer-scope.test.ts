import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';

const readerProvenance = vi.hoisted(() => ({
  identity: new WeakSet<object>(),
  membership: new WeakSet<object>(),
  scope: new WeakSet<object>(),
}));

const runtimeMocks = vi.hoisted(() => ({
  consumeClaims: vi.fn(),
  consumeSnapshot: vi.fn(),
  cookieGet: vi.fn(),
  cookies: vi.fn(),
  createIdentityReader: vi.fn(),
  createMembershipReader: vi.fn(),
  createScopeReader: vi.fn(),
  identityRead: vi.fn(),
  membershipRead: vi.fn(),
  resolveRuntimeConfig: vi.fn(),
  scopeRead: vi.fn(),
  singleMembershipRead: vi.fn(),
  verifyClaims: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: runtimeMocks.cookies }));

vi.mock(
  '@/modules/auth/server/formal-server-session-provenance-owner',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/auth/server/formal-server-session-provenance-owner')
      >();
    runtimeMocks.verifyClaims.mockImplementation(
      actual.verifyFormalServerSessionCookieClaimsV1,
    );
    runtimeMocks.consumeClaims.mockImplementation(
      actual.consumeFormalServerSessionVerifiedClaimsV1,
    );
    return {
      ...actual,
      consumeFormalServerSessionVerifiedClaimsV1: runtimeMocks.consumeClaims,
      verifyFormalServerSessionCookieClaimsV1: runtimeMocks.verifyClaims,
    };
  },
);

vi.mock(
  '@/modules/auth/application/formal-institution-session-context',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/auth/application/formal-institution-session-context')
      >();
    runtimeMocks.consumeSnapshot.mockImplementation(
      actual.consumeFormalServerSessionUserSnapshotV1,
    );
    return {
      ...actual,
      consumeFormalServerSessionUserSnapshotV1: runtimeMocks.consumeSnapshot,
    };
  },
);

vi.mock(
  '@/modules/auth/application/authoritative-formal-session-identity-reader',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/auth/application/authoritative-formal-session-identity-reader')
      >();
    return {
      ...actual,
      createIdentityAuthoritativeFormalSessionIdentityFactReaderV1:
        runtimeMocks.createIdentityReader,
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
      createAccessControlAuthoritativeMembershipFactReaderV1:
        runtimeMocks.createMembershipReader,
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
      createTenancyAuthoritativeInstitutionScopeFactReaderV1:
        runtimeMocks.createScopeReader,
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

vi.mock(
  '@/modules/security/server/institution-guard-runtime-config',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/security/server/institution-guard-runtime-config')
      >();
    return {
      ...actual,
      resolveInstitutionGuardRuntimeConfigV1:
        runtimeMocks.resolveRuntimeConfig,
    };
  },
);

import type { AuthoritativeMembershipFactReaderV1 } from '@/modules/access-control/ports/authoritative-membership-reader';
import type { AuthoritativeFormalSessionIdentityFactReaderV1 } from '@/modules/auth/ports/authoritative-formal-session-identity-reader';
import {
  FORMAL_SERVER_SESSION_COOKIE_V1,
  type FormalServerSessionKeyRingV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import type { AuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/ports/authoritative-institution-scope-reader';
import {
  consumeInstitutionAuditWriterFormalScopeV1,
  isInstitutionAuditWriterFormalScopeHandleV1,
  resolveInstitutionAuditWriterFormalScopeV1,
  type InstitutionAuditWriterFormalScopeConsumptionV1,
  type InstitutionAuditWriterFormalScopeHandleV1,
} from '@/server/orchestration/institution-audit-writer-scope';

const NOW = new Date('2026-08-13T08:02:00.000Z');
const SESSION_KEY = new Uint8Array(32).fill(0x73);
const SESSION_PROTOCOL = 'zmtg.formal-server-session-cookie.v1';

const payload = Object.freeze({
  source: 'server_session' as const,
  sessionId: '4e607d33-f4e7-4f5e-a785-1b3527768d88',
  accountId: 'account-audit-writer-scope-001',
  tenantId: 'tenant-audit-writer-scope-001',
  institutionId: 'institution-audit-writer-scope-001',
  issuedAt: '2026-08-13T08:00:00.000Z',
  expiresAt: '2026-08-13T09:00:00.000Z',
});

const identityFact = Object.freeze({
  kind: 'current_identity_fact' as const,
  accountId: payload.accountId,
  username: 'audit_writer_operator',
  displayName: '审计写入操作员',
  status: 'active' as const,
  observedAt: NOW.toISOString(),
});

const membershipFact = Object.freeze({
  kind: 'current_membership_fact' as const,
  accountId: payload.accountId,
  tenantId: payload.tenantId,
  institutionId: payload.institutionId,
  role: 'tenant_operator' as const,
  membershipDisplayName: '审计写入操作员',
  membershipId: 'membership-audit-writer-scope-001',
  membershipRevision: 1,
  membershipLifecycleStatus: 'active' as const,
  bindingId: 'binding-audit-writer-scope-001',
  bindingRevision: 1,
  bindingRevisionAt: '2026-08-13T08:01:00.000Z',
  bindingExpiresAt: null,
  observedAt: NOW.toISOString(),
});

const scopeFact = Object.freeze({
  kind: 'current_scope_fact' as const,
  tenantId: payload.tenantId,
  institutionId: payload.institutionId,
  status: 'active' as const,
  revision: 1,
  observedAt: NOW.toISOString(),
});

const sessionKeyRing = Object.freeze({
  currentKey: Object.freeze({
    keyVersion: 2,
    keyMaterial: SESSION_KEY,
  }),
  verifyOnlyKeys: Object.freeze([]),
}) satisfies FormalServerSessionKeyRingV1;

function availableRuntimeConfig() {
  return Object.freeze({
    kind: 'available' as const,
    formalServerSessionKeyRing: sessionKeyRing,
    institutionGuardReferenceKeyRing: Object.freeze({
      currentIssueKey: Object.freeze({
        keyVersion: 1,
        keyMaterial: new Uint8Array(32).fill(0x72),
      }),
      verifyOnlyKeys: Object.freeze([]),
    }),
  });
}

function signToken(
  value: Record<string, unknown> = payload,
  input: Readonly<{
    keyVersion?: number;
    keyMaterial?: Uint8Array;
    rawPayload?: string;
  }> = {},
) {
  const keyVersion = input.keyVersion ?? 2;
  const payloadSegment =
    input.rawPayload ?? Buffer.from(JSON.stringify(value)).toString('base64url');
  const signingInput = `${SESSION_PROTOCOL}\n${keyVersion}\n${payloadSegment}`;
  const tag = createHmac('sha256', input.keyMaterial ?? SESSION_KEY)
    .update(signingInput)
    .digest('base64url');
  return `v1.k${keyVersion}.${payloadSegment}.${tag}`;
}

function createIdentityReader(): AuthoritativeFormalSessionIdentityFactReaderV1 {
  const reader = Object.freeze({
    resolve: runtimeMocks.identityRead,
  });
  readerProvenance.identity.add(reader);
  return reader;
}

function createMembershipReader(): AuthoritativeMembershipFactReaderV1 {
  const reader = Object.freeze({
    resolve: runtimeMocks.membershipRead,
    resolveSingleForAccount: runtimeMocks.singleMembershipRead,
  });
  readerProvenance.membership.add(reader);
  return reader;
}

function createScopeReader(): AuthoritativeInstitutionScopeFactReaderV1 {
  const reader = Object.freeze({
    resolve: runtimeMocks.scopeRead,
  });
  readerProvenance.scope.add(reader);
  return reader;
}

function expectNoAuthoritativeReads() {
  expect(runtimeMocks.identityRead).not.toHaveBeenCalled();
  expect(runtimeMocks.membershipRead).not.toHaveBeenCalled();
  expect(runtimeMocks.scopeRead).not.toHaveBeenCalled();
}

beforeEach(() => {
  for (const mock of [
    runtimeMocks.cookieGet,
    runtimeMocks.cookies,
    runtimeMocks.createIdentityReader,
    runtimeMocks.createMembershipReader,
    runtimeMocks.createScopeReader,
    runtimeMocks.identityRead,
    runtimeMocks.membershipRead,
    runtimeMocks.resolveRuntimeConfig,
    runtimeMocks.scopeRead,
    runtimeMocks.singleMembershipRead,
  ]) {
    mock.mockReset();
  }
  runtimeMocks.consumeClaims.mockClear();
  runtimeMocks.consumeSnapshot.mockClear();
  runtimeMocks.verifyClaims.mockClear();

  vi.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
  runtimeMocks.resolveRuntimeConfig.mockReturnValue(availableRuntimeConfig());
  runtimeMocks.cookieGet.mockReturnValue(
    Object.freeze({
      name: FORMAL_SERVER_SESSION_COOKIE_V1,
      value: signToken(),
    }),
  );
  runtimeMocks.cookies.mockResolvedValue(
    Object.freeze({ get: runtimeMocks.cookieGet }),
  );
  runtimeMocks.identityRead.mockResolvedValue(identityFact);
  runtimeMocks.membershipRead.mockResolvedValue(membershipFact);
  runtimeMocks.scopeRead.mockResolvedValue(scopeFact);
  runtimeMocks.createIdentityReader.mockImplementation(createIdentityReader);
  runtimeMocks.createMembershipReader.mockImplementation(createMembershipReader);
  runtimeMocks.createScopeReader.mockImplementation(createScopeReader);
});

afterEach(() => {
  vi.mocked(Date.now).mockRestore();
});

describe('Audit Writer 正式机构范围端口', () => {
  it('以无输入 resolver 交叉确认 formal claims 与 authoritative pair', async () => {
    expectTypeOf<
      Parameters<typeof resolveInstitutionAuditWriterFormalScopeV1>
    >().toEqualTypeOf<[]>();
    expectTypeOf<
      ReturnType<typeof resolveInstitutionAuditWriterFormalScopeV1>
    >().toEqualTypeOf<
      Promise<InstitutionAuditWriterFormalScopeHandleV1 | null>
    >();
    expect(resolveInstitutionAuditWriterFormalScopeV1.length).toBe(0);

    const handle = await resolveInstitutionAuditWriterFormalScopeV1();

    expect(isInstitutionAuditWriterFormalScopeHandleV1(handle)).toBe(true);
    expect(runtimeMocks.cookieGet).toHaveBeenCalledWith(
      FORMAL_SERVER_SESSION_COOKIE_V1,
    );
    expect(runtimeMocks.verifyClaims).toHaveBeenCalledOnce();
    expect(runtimeMocks.identityRead).toHaveBeenCalledTimes(2);
    expect(runtimeMocks.membershipRead).toHaveBeenCalledTimes(2);
    expect(runtimeMocks.scopeRead).toHaveBeenCalledTimes(2);
    expect(runtimeMocks.membershipRead).toHaveBeenCalledWith({
      accountId: payload.accountId,
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
    });
    expect(runtimeMocks.scopeRead).toHaveBeenCalledWith({
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
    });

    expect(handle).not.toBeNull();
    if (!handle) throw new Error('expected formal scope handle');
    const consumption = consumeInstitutionAuditWriterFormalScopeV1(handle);
    expectTypeOf(consumption).toEqualTypeOf<
      InstitutionAuditWriterFormalScopeConsumptionV1 | null
    >();
    expect(consumption).toEqual({
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
      observedAt: NOW.toISOString(),
    });
    expect(Object.isFrozen(consumption)).toBe(true);
    expect(Reflect.ownKeys(consumption as object)).toEqual([
      'tenantId',
      'institutionId',
      'observedAt',
    ]);
  });

  it('忽略 JavaScript 额外实参且不能由 caller scope 覆盖 formal pair', async () => {
    const handle = await Reflect.apply(
      resolveInstitutionAuditWriterFormalScopeV1,
      null,
      [
        {
          tenantId: 'tenant-attacker',
          institutionId: 'institution-attacker',
          role: 'platform_admin',
          capability: 'released',
        },
      ],
    );
    expect(handle).not.toBeNull();
    if (!handle) throw new Error('expected formal scope handle');

    expect(consumeInstitutionAuditWriterFormalScopeV1(handle)).toEqual({
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
      observedAt: NOW.toISOString(),
    });
  });

  it('mint genuine、冻结、opaque 且 one-shot 的不可重放 handle', async () => {
    const handle = await resolveInstitutionAuditWriterFormalScopeV1();
    expect(handle).not.toBeNull();
    if (!handle) throw new Error('expected formal scope handle');

    expect(Object.isFrozen(handle)).toBe(true);
    expect(Reflect.ownKeys(handle)).toEqual([]);
    expect(JSON.stringify(handle)).toBe('{}');
    expect(isInstitutionAuditWriterFormalScopeHandleV1(handle)).toBe(true);

    const first = consumeInstitutionAuditWriterFormalScopeV1(handle);
    expect(first).not.toBeNull();
    expect(consumeInstitutionAuditWriterFormalScopeV1(handle)).toBeNull();
    expect(isInstitutionAuditWriterFormalScopeHandleV1(handle)).toBe(false);
  });

  it('拒绝 plain、clone、spread、JSON、Proxy、prototype 与 shape-only 伪造', async () => {
    const handle = await resolveInstitutionAuditWriterFormalScopeV1();
    expect(handle).not.toBeNull();
    if (!handle) throw new Error('expected formal scope handle');

    const lookalikes: unknown[] = [
      {},
      Object.freeze({}),
      { ...handle },
      Object.assign({}, handle),
      JSON.parse(JSON.stringify(handle)) as unknown,
      new Proxy(handle, {}),
      Object.create(Object.getPrototypeOf(handle)),
      Object.freeze({
        tenantId: payload.tenantId,
        institutionId: payload.institutionId,
        observedAt: NOW.toISOString(),
      }),
      [],
      null,
    ];

    for (const value of lookalikes) {
      expect(isInstitutionAuditWriterFormalScopeHandleV1(value)).toBe(false);
      expect(consumeInstitutionAuditWriterFormalScopeV1(value)).toBeNull();
    }
    expect(isInstitutionAuditWriterFormalScopeHandleV1(handle)).toBe(true);
  });

  it.each([
    ['unavailable', Object.freeze({ kind: 'unavailable' })],
    ['missing keys', Object.freeze({ kind: 'available' })],
    [
      'extra key',
      Object.freeze({ ...availableRuntimeConfig(), extra: true }),
    ],
    [
      'nested malformed',
      Object.freeze({
        ...availableRuntimeConfig(),
        formalServerSessionKeyRing: Object.freeze({}),
      }),
    ],
    ['proxy', new Proxy(availableRuntimeConfig(), {})],
  ] as const)('配置 %s 时 fail-closed', async (_label, value) => {
    runtimeMocks.resolveRuntimeConfig.mockReturnValueOnce(value as never);

    await expect(
      resolveInstitutionAuditWriterFormalScopeV1(),
    ).resolves.toBeNull();
    if (_label !== 'nested malformed') {
      expect(runtimeMocks.cookies).not.toHaveBeenCalled();
    }
    expectNoAuthoritativeReads();
  });

  it('配置解析异常时低敏 fail-closed', async () => {
    runtimeMocks.resolveRuntimeConfig.mockImplementationOnce(() => {
      throw new Error('ZMTG_FORMAL_SESSION_HMAC_KEY_BASE64URL=secret');
    });

    const result = await resolveInstitutionAuditWriterFormalScopeV1();
    expect(result).toBeNull();
    expectNoAuthoritativeReads();
  });

  it.each([
    'cookies throw',
    'get throw',
    'missing',
    'empty',
    'proxy',
    'accessor',
  ] as const)('cookie boundary %s 时 fail-closed', async (failure) => {
    if (failure === 'cookies throw') {
      runtimeMocks.cookies.mockRejectedValueOnce(
        new Error('cookie store unavailable'),
      );
    } else if (failure === 'get throw') {
      runtimeMocks.cookieGet.mockImplementationOnce(() => {
        throw new Error('cookie get unavailable');
      });
    } else if (failure === 'missing') {
      runtimeMocks.cookieGet.mockReturnValueOnce(undefined);
    } else if (failure === 'empty') {
      runtimeMocks.cookieGet.mockReturnValueOnce({ value: '' });
    } else if (failure === 'proxy') {
      runtimeMocks.cookieGet.mockReturnValueOnce(
        new Proxy({ value: signToken() }, {}),
      );
    } else {
      runtimeMocks.cookieGet.mockReturnValueOnce(
        Object.defineProperty({}, 'value', {
          enumerable: true,
          get() {
            throw new Error('cookie accessor unavailable');
          },
        }),
      );
    }

    await expect(
      resolveInstitutionAuditWriterFormalScopeV1(),
    ).resolves.toBeNull();
    expectNoAuthoritativeReads();
  });

  it.each([
    ['malformed', 'not-a-session'],
    [
      'invalid signature',
      signToken(payload, { keyMaterial: new Uint8Array(32).fill(0x6f) }),
    ],
    [
      'future issued',
      signToken({
        ...payload,
        issuedAt: '2026-08-13T08:03:00.000Z',
      }),
    ],
    [
      'expired',
      signToken({
        ...payload,
        expiresAt: '2026-08-13T08:01:59.999Z',
      }),
    ],
    ['unknown key version', signToken(payload, { keyVersion: 999 })],
  ] as const)('session %s 时 fail-closed', async (_label, value) => {
    runtimeMocks.cookieGet.mockReturnValueOnce({
      name: FORMAL_SERVER_SESSION_COOKIE_V1,
      value,
    });

    await expect(
      resolveInstitutionAuditWriterFormalScopeV1(),
    ).resolves.toBeNull();
    expectNoAuthoritativeReads();
  });

  it.each(['fake claims', 'already consumed', 'malformed consumption'] as const)(
    '%s 时不得进入 authoritative chain',
    async (failure) => {
      if (failure === 'fake claims') {
        runtimeMocks.verifyClaims.mockReturnValueOnce(
          Object.freeze({
            kind: 'verified',
            verifiedClaims: Object.freeze({}),
          }),
        );
      } else if (failure === 'already consumed') {
        runtimeMocks.consumeClaims.mockReturnValueOnce(null);
      } else {
        runtimeMocks.consumeClaims.mockReturnValueOnce({
          accountId: payload.accountId,
          tenantId: payload.tenantId,
        });
      }

      await expect(
        resolveInstitutionAuditWriterFormalScopeV1(),
      ).resolves.toBeNull();
      expectNoAuthoritativeReads();
    },
  );

  it('verifier dependency 异常时不泄漏内部错误', async () => {
    runtimeMocks.verifyClaims.mockImplementationOnce(() => {
      throw new Error('cookie=secret; keyMaterial=secret');
    });

    await expect(
      resolveInstitutionAuditWriterFormalScopeV1(),
    ).resolves.toBeNull();
    expectNoAuthoritativeReads();
  });

  it.each(['identity', 'membership', 'scope'] as const)(
    '%s reader factory 异常时 fail-closed',
    async (owner) => {
      const factory =
        owner === 'identity'
          ? runtimeMocks.createIdentityReader
          : owner === 'membership'
            ? runtimeMocks.createMembershipReader
            : runtimeMocks.createScopeReader;
      factory.mockImplementationOnce(() => {
        throw new Error(`${owner} factory unavailable`);
      });

      await expect(
        resolveInstitutionAuditWriterFormalScopeV1(),
      ).resolves.toBeNull();
    },
  );

  it.each([
    [
      'Identity unavailable',
      runtimeMocks.identityRead,
      Object.freeze({ kind: 'rejected', code: 'identity_unavailable' }),
    ],
    [
      'Identity inactive',
      runtimeMocks.identityRead,
      Object.freeze({ ...identityFact, status: 'inactive' }),
    ],
    [
      'Identity mismatch',
      runtimeMocks.identityRead,
      Object.freeze({ ...identityFact, accountId: 'account-other' }),
    ],
    [
      'Membership unavailable',
      runtimeMocks.membershipRead,
      Object.freeze({ kind: 'rejected', code: 'membership_unavailable' }),
    ],
    [
      'Membership inactive',
      runtimeMocks.membershipRead,
      Object.freeze({ kind: 'rejected', code: 'membership_denied' }),
    ],
    [
      'Binding inactive',
      runtimeMocks.membershipRead,
      Object.freeze({ kind: 'rejected', code: 'membership_denied' }),
    ],
    [
      'Binding expired',
      runtimeMocks.membershipRead,
      Object.freeze({ kind: 'rejected', code: 'membership_denied' }),
    ],
    [
      'tenant mismatch',
      runtimeMocks.membershipRead,
      Object.freeze({ ...membershipFact, tenantId: 'tenant-other' }),
    ],
    [
      'institution mismatch',
      runtimeMocks.membershipRead,
      Object.freeze({
        ...membershipFact,
        institutionId: 'institution-other',
      }),
    ],
    [
      'Scope unavailable',
      runtimeMocks.scopeRead,
      Object.freeze({ kind: 'rejected', code: 'scope_unavailable' }),
    ],
    [
      'Scope inactive',
      runtimeMocks.scopeRead,
      Object.freeze({ ...scopeFact, status: 'inactive' }),
    ],
    [
      'Scope mismatch',
      runtimeMocks.scopeRead,
      Object.freeze({ ...scopeFact, institutionId: 'institution-other' }),
    ],
  ] as const)('%s 时 fail-closed', async (_label, reader, value) => {
    reader.mockResolvedValueOnce(value);

    await expect(
      resolveInstitutionAuditWriterFormalScopeV1(),
    ).resolves.toBeNull();
  });

  it.each(['identity', 'membership', 'scope'] as const)(
    '%s authoritative read 异常时 fail-closed',
    async (owner) => {
      const reader =
        owner === 'identity'
          ? runtimeMocks.identityRead
          : owner === 'membership'
            ? runtimeMocks.membershipRead
            : runtimeMocks.scopeRead;
      reader.mockRejectedValueOnce(
        new Error(`${owner} repository SQL and secret`),
      );

      await expect(
        resolveInstitutionAuditWriterFormalScopeV1(),
      ).resolves.toBeNull();
    },
  );

  it.each(['identity', 'membership', 'scope'] as const)(
    '%s facts 在两次读取间变化时 stale fail-closed',
    async (owner) => {
      if (owner === 'identity') {
        runtimeMocks.identityRead
          .mockResolvedValueOnce(identityFact)
          .mockResolvedValueOnce(
            Object.freeze({ ...identityFact, username: 'changed' }),
          );
      } else if (owner === 'membership') {
        runtimeMocks.membershipRead
          .mockResolvedValueOnce(membershipFact)
          .mockResolvedValueOnce(
            Object.freeze({ ...membershipFact, membershipRevision: 2 }),
          );
      } else {
        runtimeMocks.scopeRead
          .mockResolvedValueOnce(scopeFact)
          .mockResolvedValueOnce(
            Object.freeze({ ...scopeFact, revision: 2 }),
          );
      }

      await expect(
        resolveInstitutionAuditWriterFormalScopeV1(),
      ).resolves.toBeNull();
    },
  );

  it.each([
    [
      'fake or consumed snapshot',
      null,
    ],
    [
      'account mismatch',
      Object.freeze({
        id: 'account-other',
        username: 'operator',
        name: '操作员',
        role: 'tenant_operator',
        tenantId: payload.tenantId,
        institutionId: payload.institutionId,
      }),
    ],
    [
      'tenant mismatch',
      Object.freeze({
        id: payload.accountId,
        username: 'operator',
        name: '操作员',
        role: 'tenant_operator',
        tenantId: 'tenant-other',
        institutionId: payload.institutionId,
      }),
    ],
    [
      'institution mismatch',
      Object.freeze({
        id: payload.accountId,
        username: 'operator',
        name: '操作员',
        role: 'tenant_operator',
        tenantId: payload.tenantId,
        institutionId: 'institution-other',
      }),
    ],
    [
      'unexpected shape',
      Object.freeze({
        id: payload.accountId,
        tenantId: payload.tenantId,
        institutionId: payload.institutionId,
      }),
    ],
  ] as const)('authoritative snapshot %s 时 fail-closed', async (_label, value) => {
    runtimeMocks.consumeSnapshot.mockReturnValueOnce(value);

    await expect(
      resolveInstitutionAuditWriterFormalScopeV1(),
    ).resolves.toBeNull();
  });

  it('snapshot consumption dependency 异常时 fail-closed', async () => {
    runtimeMocks.consumeSnapshot.mockImplementationOnce(() => {
      throw new Error('formal snapshot contains secret');
    });

    await expect(
      resolveInstitutionAuditWriterFormalScopeV1(),
    ).resolves.toBeNull();
  });

  it.each(['throw', 'NaN', 'rollback'] as const)(
    'server clock %s 时 fail-closed 且不 mint handle',
    async (failure) => {
      if (failure === 'throw') {
        vi.mocked(Date.now).mockImplementationOnce(() => {
          throw new Error('clock unavailable');
        });
      } else if (failure === 'NaN') {
        vi.mocked(Date.now).mockReturnValueOnce(Number.NaN);
      } else {
        vi.mocked(Date.now)
          .mockReturnValueOnce(NOW.getTime())
          .mockReturnValueOnce(NOW.getTime() - 1);
      }

      await expect(
        resolveInstitutionAuditWriterFormalScopeV1(),
      ).resolves.toBeNull();
    },
  );

  it('成功输出不泄漏 account、role、session、membership 或 capability', async () => {
    const handle = await resolveInstitutionAuditWriterFormalScopeV1();
    expect(handle).not.toBeNull();
    if (!handle) throw new Error('expected formal scope handle');

    const consumption = consumeInstitutionAuditWriterFormalScopeV1(handle);
    expect(consumption).not.toBeNull();
    const serialized = JSON.stringify(consumption);
    for (const forbidden of [
      'accountId',
      'role',
      'membership',
      'binding',
      'session',
      'navigation',
      'availableSectionIds',
      'capability',
      'release',
      'cookie',
      'keyMaterial',
      'credential',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('源码静态锁定零 Capability、navigation、Audit Repository 与数据库耦合', async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        'src/server/orchestration/institution-audit-writer-scope.ts',
      ),
      'utf8',
    );

    for (const forbidden of [
      'InstitutionCapabilityAuthorityRuntimeContextV1',
      'institution-capability-authority',
      'authorizeCurrentInstitutionNavigationV1',
      'availableSectionIds',
      'page_workbench',
      'page_system_audit',
      'createAuditEventRepository',
      'AuditEventRepository',
      'getDatabase',
      '@/server/db/',
      '@/modules/audit/',
      '@/modules/institution/',
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/\.(?:insert|update)\s*\(/u);
    expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\b/u);
  });
});
