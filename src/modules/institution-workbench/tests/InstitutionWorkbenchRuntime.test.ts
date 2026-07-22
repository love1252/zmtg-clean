import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CurrentInstitutionMembershipFactRow } from '@/modules/auth/server/auth-account-repository';
import { FORMAL_SERVER_SESSION_COOKIE_V1 } from '@/modules/auth/server/formal-server-session-provenance-owner';
import { resolveInstitutionWorkbenchRuntimeV1 } from '@/modules/institution-workbench/server/institution-workbench-runtime';
import * as workbenchEntry from '@/modules/institution-workbench/server/institution-workbench-entry';
import type { InstitutionWorkbenchEntryDecisionV1 } from '@/modules/institution-workbench/server/institution-workbench-entry';
import type { CurrentInstitutionAnchorFactRowV1 } from '@/modules/security/server/institution-anchor-repository';

const runtimeMocks = vi.hoisted(() => ({
  anchorRead: vi.fn(),
  cookieGet: vi.fn(),
  cookies: vi.fn(),
  createAuthAccountRepository: vi.fn(),
  createInstitutionAnchorFactRepositoryV1: vi.fn(),
  getDatabase: vi.fn(),
  headers: vi.fn(),
  membershipRead: vi.fn(),
  resolveInstitutionGuardRuntimeConfigV1: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: runtimeMocks.cookies,
  headers: runtimeMocks.headers,
}));

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return { ...actual, getDatabase: runtimeMocks.getDatabase };
});

vi.mock('@/modules/auth/server/auth-account-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/auth/server/auth-account-repository')>();
  return {
    ...actual,
    createAuthAccountRepository: runtimeMocks.createAuthAccountRepository,
  };
});

vi.mock(
  '@/modules/security/server/institution-anchor-repository',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/modules/security/server/institution-anchor-repository')
      >();
    return {
      ...actual,
      createInstitutionAnchorFactRepositoryV1:
        runtimeMocks.createInstitutionAnchorFactRepositoryV1,
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
        runtimeMocks.resolveInstitutionGuardRuntimeConfigV1,
    };
  },
);

const NOW = new Date('2026-07-22T08:02:00.000Z');
const SESSION_KEY = new Uint8Array(32).fill(0x73);
const SESSION_CURRENT_KEY = new Uint8Array(32).fill(0x74);
const SESSION_OLD_KEY = new Uint8Array(32).fill(0x75);
const REFERENCE_KEY = new Uint8Array(32).fill(0x72);
const REFERENCE_OLD_KEY = new Uint8Array(32).fill(0x71);
const SESSION_PROTOCOL = 'zmtg.formal-server-session-cookie.v1';
const FUTURE_VERIFY_UNTIL = '2026-07-22T08:12:00.000Z';
const database = Object.freeze({ kind: 'database' });
const payload = Object.freeze({
  source: 'server_session' as const,
  sessionId: 'session-workbench-runtime-001',
  accountId: 'account-workbench-runtime-001',
  tenantId: 'tenant-workbench-runtime-001',
  institutionId: 'institution-workbench-runtime-001',
  issuedAt: '2026-07-22T08:00:00.000Z',
  expiresAt: '2026-07-22T09:00:00.000Z',
});

const membershipRow: CurrentInstitutionMembershipFactRow = {
  accountId: payload.accountId,
  accountStatus: 'active',
  accountPasswordResetRequired: false,
  accountLockedUntil: null,
  membershipId: 'membership-workbench-runtime-001',
  membershipTenantId: payload.tenantId,
  membershipUserId: payload.accountId,
  membershipRole: 'tenant_admin',
  membershipUpdatedAt: new Date('2026-07-22T08:01:00.000Z'),
  bindingId: 'binding-workbench-runtime-001',
  bindingAccountId: payload.accountId,
  bindingTenantId: payload.tenantId,
  bindingInstitutionId: payload.institutionId,
  bindingStatus: 'active',
  bindingSource: 'manual_admin',
  bindingAssignedAt: new Date('2026-07-22T08:00:00.000Z'),
  bindingExpiresAt: null,
  bindingRevokedAt: null,
  bindingVersion: 1,
};

const anchorRow: CurrentInstitutionAnchorFactRowV1 = {
  tenantId: payload.tenantId,
  institutionId: payload.institutionId,
  status: 'active',
  revision: 1,
};

function signToken() {
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${SESSION_PROTOCOL}\n2\n${payloadSegment}`;
  const tag = createHmac('sha256', SESSION_KEY)
    .update(signingInput)
    .digest('base64url');
  return `v1.k2.${payloadSegment}.${tag}`;
}

type VerifyOnlyKeyFixture = Readonly<{
  keyVersion: number;
  keyMaterial: Uint8Array;
  verifyUntil: string;
}>;

type RuntimeConfigFixtureOptions = Readonly<{
  formalCurrentKey?: Readonly<{
    keyVersion: number;
    keyMaterial: Uint8Array;
  }>;
  formalVerifyOnlyKeys?: readonly VerifyOnlyKeyFixture[];
  guardCurrentKey?: Readonly<{
    keyVersion: number;
    keyMaterial: Uint8Array;
  }>;
  guardVerifyOnlyKeys?: readonly VerifyOnlyKeyFixture[];
}>;

function frozenVerifyOnlyKeys(
  entries: readonly VerifyOnlyKeyFixture[] = [],
) {
  return Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
}

function availableRuntimeConfig(options: RuntimeConfigFixtureOptions = {}) {
  return Object.freeze({
    kind: 'available' as const,
    formalServerSessionKeyRing: Object.freeze({
      currentKey: Object.freeze(
        options.formalCurrentKey ?? {
          keyVersion: 2,
          keyMaterial: SESSION_KEY,
        },
      ),
      verifyOnlyKeys: frozenVerifyOnlyKeys(options.formalVerifyOnlyKeys),
    }),
    institutionGuardReferenceKeyRing: Object.freeze({
      currentIssueKey: Object.freeze(
        options.guardCurrentKey ?? {
          keyVersion: 1,
          keyMaterial: REFERENCE_KEY,
        },
      ),
      verifyOnlyKeys: frozenVerifyOnlyKeys(options.guardVerifyOnlyKeys),
    }),
  });
}

function expectExactDecision(
  value: InstitutionWorkbenchEntryDecisionV1,
  kind: 'allowed' | 'blocked',
) {
  expect(Object.isFrozen(value)).toBe(true);
  expect(Reflect.ownKeys(value)).toEqual(['kind', 'view']);
  expect(value).toEqual({ kind, view: 'capability_off' });
  expect(JSON.stringify(value)).toBe(
    `{"kind":"${kind}","view":"capability_off"}`,
  );
  expect(JSON.stringify(value)).not.toMatch(
    /account|tenant|institution|scope|role|policy|reference|key|resolution/iu,
  );
}

function expectNoRuntimeComposition() {
  expect(runtimeMocks.cookies).not.toHaveBeenCalled();
  expect(runtimeMocks.cookieGet).not.toHaveBeenCalled();
  expect(runtimeMocks.headers).not.toHaveBeenCalled();
  expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
  expect(runtimeMocks.createAuthAccountRepository).not.toHaveBeenCalled();
  expect(runtimeMocks.createInstitutionAnchorFactRepositoryV1).not.toHaveBeenCalled();
  expect(runtimeMocks.membershipRead).not.toHaveBeenCalled();
  expect(runtimeMocks.anchorRead).not.toHaveBeenCalled();
}

describe('WB-ENTRY-02B institution workbench runtime', () => {
  beforeEach(() => {
    for (const mock of Object.values(runtimeMocks)) mock.mockClear();
    vi.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
    runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValue(
      availableRuntimeConfig(),
    );
    runtimeMocks.cookies.mockResolvedValue({ get: runtimeMocks.cookieGet });
    runtimeMocks.cookieGet.mockReturnValue({
      name: FORMAL_SERVER_SESSION_COOKIE_V1,
      value: signToken(),
    });
    runtimeMocks.getDatabase.mockReturnValue(database);
    runtimeMocks.membershipRead.mockResolvedValue([membershipRow]);
    runtimeMocks.anchorRead.mockResolvedValue([anchorRow]);
    runtimeMocks.createAuthAccountRepository.mockReturnValue({
      findCurrentInstitutionMembershipFacts: runtimeMocks.membershipRead,
    });
    runtimeMocks.createInstitutionAnchorFactRepositoryV1.mockReturnValue({
      findCurrentInstitutionAnchorFacts: runtimeMocks.anchorRead,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['unavailable', 'throw'] as const)(
    'keyring %s 时立即 blocked 且零 headers/DB/repository/owner/auth',
    async (runtimeCase) => {
      if (runtimeCase === 'throw') {
        runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockImplementationOnce(
          () => {
            throw new Error('runtime config unavailable');
          },
        );
      } else {
        runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValueOnce({
          kind: 'unavailable',
        });
      }

      const result = await resolveInstitutionWorkbenchRuntimeV1();

      expectExactDecision(result, 'blocked');
      expect(
        runtimeMocks.resolveInstitutionGuardRuntimeConfigV1,
      ).toHaveBeenCalledTimes(1);
      expectNoRuntimeComposition();
    },
  );

  it.each([
    [
      'forwarding Proxy',
      () => new Proxy(availableRuntimeConfig(), {}),
    ],
    [
      'fake available',
      () => {
        const config = availableRuntimeConfig();
        return Object.freeze({
          ...config,
          formalServerSessionKeyRing: {
            ...config.formalServerSessionKeyRing,
          },
        });
      },
    ],
    ['unknown', () => Object.freeze({ kind: 'unknown' })],
    [
      'symbol',
      () => Object.freeze(Object.assign(
        { ...availableRuntimeConfig() },
        { [Symbol('runtime-config')]: 'hidden' },
      )),
    ],
    [
      'extra',
      () => Object.freeze({ ...availableRuntimeConfig(), extra: 'hidden' }),
    ],
    [
      'nonplain',
      () => Object.freeze(Object.assign(
        Object.create({ inherited: true }),
        availableRuntimeConfig(),
      )),
    ],
  ] as const)(
    'runtime config %s 时在 cookies 前 exact blocked',
    async (_label, createConfig) => {
      runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValueOnce(
        createConfig() as never,
      );

      const result = await resolveInstitutionWorkbenchRuntimeV1();

      expectExactDecision(result, 'blocked');
      expectNoRuntimeComposition();
    },
  );

  it('runtime config accessor 不执行 getter 且在 cookies 前 blocked', async () => {
    let getterReads = 0;
    const config = availableRuntimeConfig();
    const accessor = Object.defineProperties({}, {
      kind: {
        enumerable: true,
        get() {
          getterReads += 1;
          return 'available';
        },
      },
      formalServerSessionKeyRing: {
        enumerable: true,
        value: config.formalServerSessionKeyRing,
      },
      institutionGuardReferenceKeyRing: {
        enumerable: true,
        value: config.institutionGuardReferenceKeyRing,
      },
    });
    runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValueOnce(
      Object.freeze(accessor) as never,
    );

    const result = await resolveInstitutionWorkbenchRuntimeV1();

    expectExactDecision(result, 'blocked');
    expect(getterReads).toBe(0);
    expectNoRuntimeComposition();
  });

  it.each([
    [
      'guard current=999',
      () => availableRuntimeConfig({
        guardCurrentKey: { keyVersion: 999, keyMaterial: REFERENCE_KEY },
      }),
    ],
    [
      'guard verify-only 非 accepted version',
      () => availableRuntimeConfig({
        guardVerifyOnlyKeys: [{
          keyVersion: 999,
          keyMaterial: REFERENCE_OLD_KEY,
          verifyUntil: FUTURE_VERIFY_UNTIL,
        }],
      }),
    ],
    [
      'formal verify-only 不旧于 current',
      () => availableRuntimeConfig({
        formalVerifyOnlyKeys: [{
          keyVersion: 3,
          keyMaterial: SESSION_OLD_KEY,
          verifyUntil: FUTURE_VERIFY_UNTIL,
        }],
      }),
    ],
    [
      'current 与 verify-only version 重复',
      () => availableRuntimeConfig({
        guardVerifyOnlyKeys: [{
          keyVersion: 1,
          keyMaterial: REFERENCE_OLD_KEY,
          verifyUntil: FUTURE_VERIFY_UNTIL,
        }],
      }),
    ],
    [
      'verifyUntil 已过期',
      () => availableRuntimeConfig({
        formalVerifyOnlyKeys: [{
          keyVersion: 1,
          keyMaterial: SESSION_OLD_KEY,
          verifyUntil: '2026-07-22T08:01:59.999Z',
        }],
      }),
    ],
    [
      'verifyUntil canonical 形状但日期无效',
      () => availableRuntimeConfig({
        formalVerifyOnlyKeys: [{
          keyVersion: 1,
          keyMaterial: SESSION_OLD_KEY,
          verifyUntil: '2026-02-30T08:12:00.000Z',
        }],
      }),
    ],
  ] as const)(
    'runtime config %s 时在 cookies 前 blocked 且零 DB/repository',
    async (_label, createConfig) => {
      runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValueOnce(
        createConfig() as never,
      );

      const result = await resolveInstitutionWorkbenchRuntimeV1();

      expectExactDecision(result, 'blocked');
      expectNoRuntimeComposition();
    },
  );

  it.each(['Date.now throw', 'Date.parse throw'] as const)(
    'runtime config %s 时在 cookies 前 blocked 且零 DB/repository',
    async (clockCase) => {
      runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValueOnce(
        availableRuntimeConfig({
          formalVerifyOnlyKeys: [{
            keyVersion: 1,
            keyMaterial: SESSION_OLD_KEY,
            verifyUntil: FUTURE_VERIFY_UNTIL,
          }],
        }),
      );
      if (clockCase === 'Date.now throw') {
        vi.mocked(Date.now).mockImplementationOnce(() => {
          throw new Error('clock unavailable');
        });
      } else {
        vi.spyOn(Date, 'parse').mockImplementationOnce(() => {
          throw new Error('instant parser unavailable');
        });
      }

      const result = await resolveInstitutionWorkbenchRuntimeV1();

      expectExactDecision(result, 'blocked');
      expectNoRuntimeComposition();
    },
  );

  it('exact、冻结且语义合法的完整 config 仍进入 allowed', async () => {
    runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValueOnce(
      availableRuntimeConfig({
        formalCurrentKey: {
          keyVersion: 3,
          keyMaterial: SESSION_CURRENT_KEY,
        },
        formalVerifyOnlyKeys: [
          {
            keyVersion: 2,
            keyMaterial: SESSION_KEY,
            verifyUntil: FUTURE_VERIFY_UNTIL,
          },
          {
            keyVersion: 1,
            keyMaterial: SESSION_OLD_KEY,
            verifyUntil: FUTURE_VERIFY_UNTIL,
          },
        ],
      }),
    );

    const result = await resolveInstitutionWorkbenchRuntimeV1();

    expectExactDecision(result, 'allowed');
    expect(runtimeMocks.cookies).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.getDatabase).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.membershipRead).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.anchorRead).toHaveBeenCalledTimes(1);
  });

  it.each(['missing', 'invalid'] as const)(
    '%s formal cookie 只读指定 cookie 一次且零 DB',
    async (cookieCase) => {
      runtimeMocks.cookieGet.mockReturnValueOnce(
        cookieCase === 'missing'
          ? undefined
          : {
              name: FORMAL_SERVER_SESSION_COOKIE_V1,
              value: 'invalid-cookie',
            },
      );

      const result = await resolveInstitutionWorkbenchRuntimeV1();

      expectExactDecision(result, 'blocked');
      expect(runtimeMocks.cookies).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.cookieGet).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.cookieGet).toHaveBeenCalledWith(
        FORMAL_SERVER_SESSION_COOKIE_V1,
      );
      expect(runtimeMocks.headers).not.toHaveBeenCalled();
      expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
      expect(runtimeMocks.createAuthAccountRepository).not.toHaveBeenCalled();
      expect(
        runtimeMocks.createInstitutionAnchorFactRepositoryV1,
      ).not.toHaveBeenCalled();
      expect(runtimeMocks.membershipRead).not.toHaveBeenCalled();
      expect(runtimeMocks.anchorRead).not.toHaveBeenCalled();
    },
  );

  it.each(['cookies_reject', 'get_throw'] as const)(
    '%s 时低敏 blocked 且不进入 DB 与授权组装',
    async (runtimeCase) => {
      if (runtimeCase === 'cookies_reject') {
        runtimeMocks.cookies.mockRejectedValueOnce(new Error('cookies unavailable'));
      } else {
        runtimeMocks.cookieGet.mockImplementationOnce(() => {
          throw new Error('cookie read failed');
        });
      }

      const result = await resolveInstitutionWorkbenchRuntimeV1();

      expectExactDecision(result, 'blocked');
      expect(runtimeMocks.cookies).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.cookieGet).toHaveBeenCalledTimes(
        runtimeCase === 'get_throw' ? 1 : 0,
      );
      expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
      expect(runtimeMocks.createAuthAccountRepository).not.toHaveBeenCalled();
    },
  );

  it('有效 formal session 仅读 membership/anchor 各一次且 DB 最多一次', async () => {
    const result = await resolveInstitutionWorkbenchRuntimeV1();

    expectExactDecision(result, 'allowed');
    expect(runtimeMocks.cookies).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.cookieGet).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.headers).not.toHaveBeenCalled();
    expect(runtimeMocks.getDatabase).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createAuthAccountRepository).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.membershipRead).toHaveBeenCalledTimes(1);
    expect(
      runtimeMocks.createInstitutionAnchorFactRepositoryV1,
    ).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.anchorRead).toHaveBeenCalledTimes(1);
  });

  it.each(['null', 'undefined', 'hostile', 'throw'] as const)(
    'database %s 时底层最多调用一次且 exact blocked',
    async (databaseCase) => {
      if (databaseCase === 'throw') {
        runtimeMocks.getDatabase.mockImplementationOnce(() => {
          throw new Error('database unavailable');
        });
      } else if (databaseCase === 'hostile') {
        runtimeMocks.getDatabase.mockReturnValueOnce(new Proxy({}, {}) as never);
      } else {
        runtimeMocks.getDatabase.mockReturnValueOnce(
          (databaseCase === 'null' ? null : undefined) as never,
        );
      }

      const result = await resolveInstitutionWorkbenchRuntimeV1();

      expectExactDecision(result, 'blocked');
      expect(runtimeMocks.getDatabase).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.createAuthAccountRepository).not.toHaveBeenCalled();
      expect(
        runtimeMocks.createInstitutionAnchorFactRepositoryV1,
      ).not.toHaveBeenCalled();
      expect(runtimeMocks.membershipRead).not.toHaveBeenCalled();
      expect(runtimeMocks.anchorRead).not.toHaveBeenCalled();
    },
  );

  it('membership denied 时 blocked 且 anchor repository/query 均为零', async () => {
    runtimeMocks.membershipRead.mockResolvedValueOnce([]);

    const result = await resolveInstitutionWorkbenchRuntimeV1();

    expectExactDecision(result, 'blocked');
    expect(runtimeMocks.getDatabase).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.createAuthAccountRepository).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.membershipRead).toHaveBeenCalledTimes(1);
    expect(
      runtimeMocks.createInstitutionAnchorFactRepositoryV1,
    ).not.toHaveBeenCalled();
    expect(runtimeMocks.anchorRead).not.toHaveBeenCalled();
  });

  it.each(['invalid', 'unavailable', 'throw'] as const)(
    'membership %s 时低敏 blocked 且 anchor 保持零读取',
    async (membershipCase) => {
      if (membershipCase === 'invalid') {
        runtimeMocks.membershipRead.mockResolvedValueOnce([
          { ...membershipRow, membershipTenantId: 'tenant-other' },
        ]);
      } else if (membershipCase === 'unavailable') {
        runtimeMocks.membershipRead.mockRejectedValueOnce(
          new Error('membership repository unavailable'),
        );
      } else {
        runtimeMocks.createAuthAccountRepository.mockImplementationOnce(() => {
          throw new Error('membership repository factory failed');
        });
      }

      const result = await resolveInstitutionWorkbenchRuntimeV1();

      expectExactDecision(result, 'blocked');
      expect(runtimeMocks.getDatabase).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.createAuthAccountRepository).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.membershipRead).toHaveBeenCalledTimes(
        membershipCase === 'throw' ? 0 : 1,
      );
      expect(
        runtimeMocks.createInstitutionAnchorFactRepositoryV1,
      ).not.toHaveBeenCalled();
      expect(runtimeMocks.anchorRead).not.toHaveBeenCalled();
    },
  );

  it('anchor denied 时 membership/anchor 各读一次并 blocked', async () => {
    runtimeMocks.anchorRead.mockResolvedValueOnce([
      { ...anchorRow, status: 'suspended' },
    ]);

    const result = await resolveInstitutionWorkbenchRuntimeV1();

    expectExactDecision(result, 'blocked');
    expect(runtimeMocks.membershipRead).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.anchorRead).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.getDatabase).toHaveBeenCalledTimes(1);
  });

  it.each(['unavailable', 'throw'] as const)(
    'anchor %s 时 membership/anchor 各读一次并低敏 blocked',
    async (anchorCase) => {
      if (anchorCase === 'unavailable') {
        runtimeMocks.anchorRead.mockResolvedValueOnce([
          { ...anchorRow, tenantId: 'tenant-other' },
        ]);
      } else {
        runtimeMocks.anchorRead.mockRejectedValueOnce(
          new Error('anchor repository unavailable'),
        );
      }

      const result = await resolveInstitutionWorkbenchRuntimeV1();

      expectExactDecision(result, 'blocked');
      expect(runtimeMocks.membershipRead).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.createInstitutionAnchorFactRepositoryV1).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.anchorRead).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.getDatabase).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['fake', Object.freeze({ kind: 'allowed', view: 'capability_off' })],
    [
      'hostile',
      new Proxy(
        {},
        {
          getPrototypeOf() {
            throw new Error('controlled decision prototype trap');
          },
        },
      ),
    ],
  ] as const)(
    '%s controlled decision 被 genuine seal 拒绝并降级 exact blocked',
    async (_label, controlledDecision) => {
      const controlledEntry = vi
        .spyOn(workbenchEntry, 'createControlledInstitutionWorkbenchEntryV1')
        .mockResolvedValueOnce(controlledDecision as never);

      const result = await resolveInstitutionWorkbenchRuntimeV1();

      expectExactDecision(result, 'blocked');
      expect(controlledEntry).toHaveBeenCalledTimes(1);
      expect(runtimeMocks.membershipRead).not.toHaveBeenCalled();
      expect(runtimeMocks.anchorRead).not.toHaveBeenCalled();
      expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
    },
  );

  it('cookie value accessor 异常时零 DB 并返回 exact blocked', async () => {
    const cookie = Object.defineProperty({}, 'value', {
      enumerable: true,
      get() {
        throw new Error('cookie value unavailable');
      },
    });
    runtimeMocks.cookieGet.mockReturnValueOnce(cookie);

    const result = await resolveInstitutionWorkbenchRuntimeV1();

    expectExactDecision(result, 'blocked');
    expect(runtimeMocks.cookieGet).toHaveBeenCalledTimes(1);
    expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
    expect(runtimeMocks.createAuthAccountRepository).not.toHaveBeenCalled();
  });
});
