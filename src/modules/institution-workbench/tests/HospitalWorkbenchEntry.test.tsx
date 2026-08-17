import { createHmac } from 'node:crypto';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

const serverRuntimeMocks = vi.hoisted(() => ({
  resolveInstitutionServerAuthorizationV1: vi.fn(),
}));
const capabilityAuthorityMocks = vi.hoisted(() => ({
  resolveInstitutionCapabilityAuthorityStatusV1: vi.fn(),
}));
const readerProvenance = vi.hoisted(() => ({
  identity: new WeakSet<object>(),
  membership: new WeakSet<object>(),
  scope: new WeakSet<object>(),
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
  '@/modules/institution/server/institution-server-runtime',
  () => ({
    resolveInstitutionServerAuthorizationV1:
      serverRuntimeMocks.resolveInstitutionServerAuthorizationV1,
  }),
);

vi.mock(
  '@/server/orchestration/institution-capability-authority',
  () => ({
    resolveInstitutionCapabilityAuthorityStatusV1:
      capabilityAuthorityMocks.resolveInstitutionCapabilityAuthorityStatusV1,
  }),
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
        return value !== null && typeof value === 'object' && readerProvenance.membership.has(value);
      },
    };
  },
);

vi.mock(
  '@/modules/tenancy/application/authoritative-institution-scope-reader',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/modules/tenancy/application/authoritative-institution-scope-reader')
    >();
    return {
      ...actual,
      isAuthoritativeInstitutionScopeFactReaderV1(value: unknown) {
        return value !== null && typeof value === 'object' && readerProvenance.scope.has(value);
      },
    };
  },
);

import HospitalPage from '@/app/hospital/page';
import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import {
  createAuthoritativeInstitutionMembershipFactReaderV1 as createUnbrandedMembershipFactReaderV1,
  type CurrentInstitutionMembershipFactRow,
} from '@/modules/access-control/server/authoritative-membership-reader';
import {
  createFormalServerSessionRequestOwnerV1,
  FORMAL_SERVER_SESSION_COOKIE_V1,
  type FormalServerSessionKeyRingV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import type { AuthoritativeFormalSessionIdentityFactReaderV1 } from '@/modules/auth/ports/authoritative-formal-session-identity-reader';
import {
  createControlledInstitutionWorkbenchEntryV1,
  createDisabledInstitutionWorkbenchEntryV1,
  isInstitutionWorkbenchEntryDecisionV1,
  type InstitutionWorkbenchControlledEntryInputV1,
  type InstitutionWorkbenchDisabledEntryInputV1,
  type InstitutionWorkbenchEntryDecisionV1,
} from '@/modules/institution-workbench/server/institution-workbench-entry';
import { INSTITUTION_NAVIGATION_SECTION_IDS_V1 } from '@/modules/institution-contracts/v1/institution-navigation';
import {
  createActiveInstitutionAnchorProviderV1,
} from '@/modules/security/server/institution-anchor-provider';
import {
  createAuthoritativeInstitutionScopeFactReaderV1 as createUnbrandedScopeFactReaderV1,
  type CurrentInstitutionScopeFactRowV1,
} from '@/modules/tenancy/server/authoritative-institution-scope-reader';
import {
  createInstitutionGuardReferenceCodecV1,
} from '@/modules/security/server/institution-guard-reference';
import {
  createInstitutionRequestAuthorizationV1,
  type InstitutionRequestAuthorizationV1,
} from '@/modules/security/server/institution-request-authorization';

function createAuthoritativeInstitutionMembershipFactReaderV1(
  input: Parameters<typeof createUnbrandedMembershipFactReaderV1>[0],
) {
  const reader = createUnbrandedMembershipFactReaderV1(input);
  readerProvenance.membership.add(reader);
  return reader;
}

function createAuthoritativeInstitutionScopeFactReaderV1(
  input: Parameters<typeof createUnbrandedScopeFactReaderV1>[0],
) {
  const reader = createUnbrandedScopeFactReaderV1(input);
  readerProvenance.scope.add(reader);
  return reader;
}

function genuineIdentityReader(): AuthoritativeFormalSessionIdentityFactReaderV1 {
  const reader = Object.freeze({
    resolve: vi.fn(async () => ({
      kind: 'current_identity_fact' as const,
      accountId: payload.accountId,
      username: 'workbench_operator',
      displayName: '工作台操作员',
      status: 'active' as const,
      observedAt: NOW.toISOString(),
    })),
  });
  readerProvenance.identity.add(reader);
  return reader;
}

const NOW = new Date('2026-07-22T08:02:00.000Z');
const SESSION_KEY = new Uint8Array(32).fill(0x73);
const REFERENCE_KEY = new Uint8Array(32).fill(0x72);
const SESSION_PROTOCOL = 'zmtg.formal-server-session-cookie.v1';
const DESKTOP_NAVIGATION = [
  ['工作台', '/hospital'],
  ['客户中心', '/hospital/customers'],
  ['会话工作台', '/hospital/conversations'],
  ['预约与随访', '/hospital/care'],
  ['知识库', '/hospital/knowledge'],
  ['经营分析', '/hospital/analytics'],
  ['管理中心', '/hospital/system'],
] as const;
const MOBILE_NAVIGATION_LABELS = ['工作台', '客户', '会话', '待办', '更多'] as const;
const MOBILE_MORE_NAVIGATION = [
  ['知识库', '/hospital/knowledge'],
  ['经营分析', '/hospital/analytics'],
  ['管理中心', '/hospital/system'],
] as const;
const payload = Object.freeze({
  source: 'server_session' as const,
  sessionId: 'session-workbench-entry-001',
  accountId: 'account-workbench-entry-001',
  tenantId: 'tenant-workbench-entry-001',
  institutionId: 'institution-workbench-entry-001',
  issuedAt: '2026-07-22T08:00:00.000Z',
  expiresAt: '2026-07-22T09:00:00.000Z',
});
const membershipRow: CurrentInstitutionMembershipFactRow = {
  accountId: payload.accountId,
  membershipId: 'membership-workbench-entry-001',
  membershipTenantId: payload.tenantId,
  membershipUserId: payload.accountId,
  membershipRole: 'tenant_admin',
  membershipDisplayName: '机构管理员',
  membershipRevision: 1,
  membershipLifecycleStatus: 'active',
  membershipProvenanceSource: 'legacy_calibration',
  membershipProvenanceActorId: null,
  membershipProvenanceReasonCode: 'legacy_unknown',
  membershipProvenanceCommandId: `mcal1_${'b'.repeat(64)}`,
  membershipProvenanceOccurredAt: null,
  membershipProvenanceRecordedAt: new Date('2026-07-22T08:01:00.000Z'),
  membershipRevokedAt: null,
  membershipDeletedAt: null,
  bindingId: 'binding-workbench-entry-001',
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

const anchorRow: CurrentInstitutionScopeFactRowV1 = {
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

function sessionKeyRing(): FormalServerSessionKeyRingV1 {
  return {
    currentKey: { keyVersion: 2, keyMaterial: SESSION_KEY },
    verifyOnlyKeys: [],
  };
}

function authorizationFixture(
  role: CurrentInstitutionMembershipFactRow['membershipRole'] = 'tenant_admin',
) {
  const codec = createInstitutionGuardReferenceCodecV1({
    keyRing: {
      currentIssueKey: { keyVersion: 1, keyMaterial: REFERENCE_KEY },
      verifyOnlyKeys: [],
    },
    now: () => NOW,
  });
  const membershipRead = vi.fn(async () => [
    { ...membershipRow, membershipRole: role },
  ]);
  const membershipFactReader = createAuthoritativeInstitutionMembershipFactReaderV1({
    repository: { findCurrentInstitutionMembershipFacts: membershipRead },
    now: () => NOW,
  });
  const owner = createFormalServerSessionRequestOwnerV1({
    cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
    sessionKeyRing: sessionKeyRing(),
    identityFactReader: genuineIdentityReader(),
    membershipFactReader,
    referenceCodec: codec,
    now: () => NOW,
  });
  const anchorRead = vi.fn(async () => [anchorRow]);
  const anchorFactReader = createAuthoritativeInstitutionScopeFactReaderV1({
    repository: { findCurrentInstitutionScopeFacts: anchorRead },
    now: () => NOW,
  });
  const anchorProvider = createActiveInstitutionAnchorProviderV1({
    factReader: anchorFactReader,
    referenceCodec: codec,
    now: () => NOW,
  });
  const authorization = createInstitutionRequestAuthorizationV1({
    requestOwner: owner,
    anchorProvider,
    referenceCodec: codec,
    now: () => new Date(NOW.getTime()),
  });

  return { authorization, owner, anchorProvider, codec, membershipRead, anchorRead };
}

type WorkbenchFixtureCapabilityKey =
  | 'page_workbench'
  | 'page_system_audit'
  | 'page_system_overview';

function capabilityLabel(key: WorkbenchFixtureCapabilityKey): string {
  if (key === 'page_system_audit') return '审计与安全';
  if (key === 'page_system_overview') return '系统概览';
  return '工作台';
}

function readonlyWorkbenchCapabilityStatus(
  entries: readonly Readonly<{
    key: WorkbenchFixtureCapabilityKey;
    decision?: 'hidden' | 'read_only';
  }>[] = [{ key: 'page_workbench' }],
): CapabilityStatusV1 {
  const freshness = {
    observedAt: NOW.toISOString(),
    freshUntil: new Date(NOW.getTime() + 5_000).toISOString(),
  };

  return {
    contractVersion: 'v1',
    scope: {
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
    },
    readiness: 'ready',
    freshness,
    partitions: entries.map(({ key }) => ({
        key,
        readiness: 'ready',
        freshness,
        failureCode: null,
      })),
    data: {
      capabilities: entries.map(({ key, decision = 'read_only' }) => ({
          key,
          decision,
          dimensions: {
            codeMaturity: 'verified',
            institutionAuthorization: 'authorized',
            connectionAvailability: 'not_required',
            dataReadiness:
              key === 'page_system_audit' ? 'partial' : 'not_required',
            productionRelease:
              key === 'page_workbench' || key === 'page_system_audit'
                ? 'pilot_released'
                : 'not_released',
          },
          safeSummary:
            decision === 'hidden' ? null : `${capabilityLabel(key)}仅供查看`,
          diagnosticTargetKey: null,
        })),
    },
    failureCode: null,
  };
}

describe('WB-ENTRY-02A server-owned 工作台入口', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('密封最小输入与低敏 decision API surface', () => {
    expectTypeOf<keyof InstitutionWorkbenchDisabledEntryInputV1>().toEqualTypeOf<never>();
    expectTypeOf<keyof InstitutionWorkbenchControlledEntryInputV1>().toEqualTypeOf<'authorization'>();
    expectTypeOf<keyof InstitutionWorkbenchEntryDecisionV1>().toEqualTypeOf<'kind' | 'view'>();
    expectTypeOf<{ kind: 'blocked'; view: 'capability_off' }>().not.toMatchTypeOf<InstitutionWorkbenchEntryDecisionV1>();
  });

  it('disabled 对任意 hostile 输入直接关闭且零 getter/trap/fetch', () => {
    let getterReads = 0;
    let proxyTraps = 0;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'authorization', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('disabled input getter must not run');
      },
    });
    const hostileProxy = new Proxy({}, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('disabled input prototype trap must not run');
      },
      ownKeys() {
        proxyTraps += 1;
        throw new Error('disabled input ownKeys trap must not run');
      },
    });
    const revoked = Proxy.revocable({}, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('revoked disabled input trap must not run');
      },
    });
    revoked.revoke();

    const decisions = [
      {},
      { request: new Request('https://hostile.invalid') },
      Object.assign({}, { [Symbol('context')]: true }),
      accessor,
      Object.create({ session: 'demo' }) as object,
      hostileProxy,
      revoked.proxy,
    ].map((input) => createDisabledInstitutionWorkbenchEntryV1(input as never));

    for (const decision of decisions) {
      expect(isInstitutionWorkbenchEntryDecisionV1(decision)).toBe(true);
      expect(Object.isFrozen(decision)).toBe(true);
      expect(decision).toEqual({ kind: 'blocked', view: 'capability_off' });
    }

    expect(new Set(decisions).size).toBe(decisions.length);
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('只识别 factory-issued decision，clone/accessor/Proxy 均零属性读取', () => {
    const decision = createDisabledInstitutionWorkbenchEntryV1({});
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'kind', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('decision getter must not run');
      },
    });
    const hostileProxy = new Proxy(decision, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('decision proxy trap must not run');
      },
    });
    const revoked = Proxy.revocable(decision, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('revoked decision trap must not run');
      },
    });
    revoked.revoke();

    for (const value of [
      {},
      { ...decision },
      Object.create(decision) as object,
      accessor,
      hostileProxy,
      revoked.proxy,
    ]) {
      expect(isInstitutionWorkbenchEntryDecisionV1(value)).toBe(false);
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('controlled 对 fake/clone/inherited/accessor/Proxy/revoked authorization 统一 blocked 且零 auth', async () => {
    const authorize = vi.fn();
    const fakeAuthorization = {
      authorizeCurrentInstitutionSectionV1: authorize,
    } as unknown as InstitutionRequestAuthorizationV1;
    const fakeAuthorizationAccessor: Record<string, unknown> = {};
    const genuine = createInstitutionRequestAuthorizationV1({} as never);
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'authorization', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('controlled input getter must not run');
      },
    });
    Object.defineProperty(
      fakeAuthorizationAccessor,
      'authorizeCurrentInstitutionSectionV1',
      {
        enumerable: true,
        get() {
          getterReads += 1;
          throw new Error('authorization method getter must not run');
        },
      },
    );
    const proxy = new Proxy(genuine, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('authorization proxy trap must not run');
      },
    });
    const revoked = Proxy.revocable(genuine, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('revoked authorization trap must not run');
      },
    });
    revoked.revoke();
    const controlledInput = { authorization: genuine };
    const inputProxy = new Proxy(controlledInput, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('controlled input proxy trap must not run');
      },
    });
    const revokedInput = Proxy.revocable(controlledInput, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('revoked controlled input trap must not run');
      },
    });
    revokedInput.revoke();

    for (const input of [
      { authorization: fakeAuthorization },
      { authorization: fakeAuthorizationAccessor },
      { authorization: { ...genuine } },
      { authorization: Object.create(genuine) },
      accessor,
      { authorization: proxy },
      { authorization: revoked.proxy },
      { authorization: genuine, extra: true },
      Object.assign({ authorization: genuine }, { [Symbol('raw')]: true }),
      Object.assign(Object.create({ inherited: true }), controlledInput),
      inputProxy,
      revokedInput.proxy,
    ]) {
      await expect(
        createControlledInstitutionWorkbenchEntryV1(input as never),
      ).resolves.toEqual({ kind: 'blocked', view: 'capability_off' });
    }
    expect(authorize).not.toHaveBeenCalled();
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
  });

  it('controlled 将 genuine authorization 的异常统一映射为 blocked', async () => {
    const created = authorizationFixture();
    const originalSome = Array.prototype.some;
    const navigationSome = vi
      .spyOn(Array.prototype, 'some')
      .mockImplementation(function (
        this: unknown[],
        callback: (value: unknown, index: number, array: unknown[]) => unknown,
        thisArg?: unknown,
      ) {
        if ((this as unknown) === INSTITUTION_NAVIGATION_SECTION_IDS_V1) {
          throw new Error('genuine authorization failure');
        }
        return originalSome.call(this, callback, thisArg);
      } as typeof Array.prototype.some);

    await expect(
      createControlledInstitutionWorkbenchEntryV1({
        authorization: created.authorization,
      }),
    ).resolves.toEqual({ kind: 'blocked', view: 'capability_off' });
    expect(created.membershipRead).not.toHaveBeenCalled();
    expect(created.anchorRead).not.toHaveBeenCalled();
    navigationSome.mockRestore();
  });

  it('controlled 将 genuine reject 与 spent owner 统一映射为低敏 blocked', async () => {
    const rejected = createInstitutionRequestAuthorizationV1({} as never);
    await expect(
      createControlledInstitutionWorkbenchEntryV1({ authorization: rejected }),
    ).resolves.toEqual({ kind: 'blocked', view: 'capability_off' });

    const created = authorizationFixture();
    createInstitutionRequestAuthorizationV1({
      requestOwner: created.owner,
      anchorProvider: created.anchorProvider,
      referenceCodec: created.codec,
      now: () => new Date(NOW.getTime()),
    });
    const spent = createInstitutionRequestAuthorizationV1({
      requestOwner: created.owner,
      anchorProvider: created.anchorProvider,
      referenceCodec: created.codec,
      now: () => new Date(NOW.getTime()),
    });
    await expect(
      createControlledInstitutionWorkbenchEntryV1({ authorization: spent }),
    ).resolves.toEqual({ kind: 'blocked', view: 'capability_off' });
    expect(created.membershipRead).not.toHaveBeenCalled();
    expect(created.anchorRead).not.toHaveBeenCalled();
  });

  it('controlled 最多授权 workbench 一次，仅保留 server-local allow 并丢弃 resolution', async () => {
    const created = authorizationFixture();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const decision = await createControlledInstitutionWorkbenchEntryV1({
      authorization: created.authorization,
    });

    expect(decision).toEqual({ kind: 'allowed', view: 'capability_off' });
    expect(isInstitutionWorkbenchEntryDecisionV1(decision)).toBe(true);
    expect(Object.isFrozen(decision)).toBe(true);
    expect(created.membershipRead).toHaveBeenCalledTimes(4);
    expect(created.anchorRead).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(decision)).toBe('{"kind":"allowed","view":"capability_off"}');
    for (const forbidden of [
      'resolution',
      'code',
      'role',
      'scope',
      'accountId',
      'tenantId',
      'institutionId',
      'policyRevision',
      'decidedAt',
      'validUntil',
      'session',
    ]) {
      expect(JSON.stringify(decision)).not.toContain(forbidden);
    }
  });
});

describe('BASE-WIRE-01 /hospital server navigation authorization', () => {
  beforeEach(() => {
    serverRuntimeMocks.resolveInstitutionServerAuthorizationV1.mockReset();
    serverRuntimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValue(
      createInstitutionRequestAuthorizationV1({} as never),
    );
    capabilityAuthorityMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockReset();
    capabilityAuthorityMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockResolvedValue(
      null,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses one genuine admin navigation authorization for seven sections and the authorized boundary', async () => {
    const created = authorizationFixture('tenant_admin');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    serverRuntimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
      created.authorization,
    );

    render(await HospitalPage());

    expect(serverRuntimeMocks.resolveInstitutionServerAuthorizationV1).toHaveBeenCalledTimes(1);
    expect(serverRuntimeMocks.resolveInstitutionServerAuthorizationV1).toHaveBeenCalledWith();
    expect(created.membershipRead).toHaveBeenCalledTimes(4);
    expect(created.anchorRead).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('main')
        .querySelector('[data-capability-state="authorized-boundary"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '工作台访问已核验', level: 2 }),
    ).toBeInTheDocument();

    const desktopNavigation = screen.getByRole('navigation', {
      name: '机构端桌面导航',
    });
    expect(
      within(desktopNavigation)
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual(DESKTOP_NAVIGATION.map(([label]) => label));
    expect(
      within(desktopNavigation).getByRole('link', { name: '工作台' }),
    ).toHaveAttribute('aria-current', 'page');

    const mobileNavigation = screen.getByRole('navigation', {
      name: '机构端移动导航',
    });
    expect(
      Array.from(mobileNavigation.querySelectorAll('a, button')).map((entry) =>
        entry.textContent?.trim(),
      ),
    ).toEqual(MOBILE_NAVIGATION_LABELS);
    fireEvent.click(
      within(mobileNavigation).getByRole('button', { name: '更多' }),
    );
    expect(
      within(screen.getByRole('dialog', { name: '更多栏目' }))
        .getAllByRole('link')
        .map((link) => link.textContent?.trim()),
    ).toEqual(MOBILE_MORE_NAVIGATION.map(([label]) => label));

    await expect(
      created.authorization.authorizeCurrentInstitutionSectionV1({
        sectionId: 'workbench',
      }),
    ).resolves.toEqual({ kind: 'rejected', code: 'scope_unavailable' });
    expect(
      capabilityAuthorityMocks.resolveInstitutionCapabilityAuthorityStatusV1,
    ).toHaveBeenCalledTimes(1);
  });

  it('renders exactly one readonly page_workbench pilot when navigation and authority status both succeed', async () => {
    const created = authorizationFixture('tenant_admin');
    vi.spyOn(Date, 'now').mockReturnValue(NOW.getTime());

    serverRuntimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
      created.authorization,
    );
    capabilityAuthorityMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockResolvedValueOnce(
      readonlyWorkbenchCapabilityStatus(),
    );

    render(await HospitalPage());

    const main = screen.getByRole('main');
    expect(
      main.querySelector('[data-capability-state="readonly-pilot"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '工作台', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('工作台仅供查看')).toBeInTheDocument();
    expect(screen.getByText('只读')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        name: '工作台访问已核验',
        level: 2,
      }),
    ).not.toBeInTheDocument();
    expect(within(main).queryAllByRole('button')).toHaveLength(0);
    expect(within(main).queryAllByRole('link')).toHaveLength(0);
    expect(
      capabilityAuthorityMocks.resolveInstitutionCapabilityAuthorityStatusV1,
    ).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: 'page_workbench 后出现已发布的审计 summary',
      entries: [
        { key: 'page_workbench' },
        { key: 'page_system_audit' },
      ],
      visibleSummary: '审计与安全仅供查看',
    },
    {
      name: '已发布的审计 summary 位于 page_workbench 之前',
      entries: [
        { key: 'page_system_audit' },
        { key: 'page_workbench' },
      ],
      visibleSummary: '审计与安全仅供查看',
    },
    {
      name: '未纳入 Phase 1 的系统概览继续被过滤',
      entries: [
        { key: 'page_workbench' },
        { key: 'page_system_overview' },
      ],
      visibleSummary: null,
    },
    {
      name: 'hidden capability 不进入重聚合',
      entries: [
        { key: 'page_workbench' },
        { key: 'page_system_audit', decision: 'hidden' },
      ],
      visibleSummary: null,
    },
  ] satisfies readonly {
    name: string;
    entries: readonly Readonly<{
      key: WorkbenchFixtureCapabilityKey;
      decision?: 'hidden' | 'read_only';
    }>[];
    visibleSummary: string | null;
  }[])('按 Phase 1 governed readonly key 重聚合：$name', async ({ entries, visibleSummary }) => {
    const created = authorizationFixture('tenant_admin');
    vi.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
    serverRuntimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
      created.authorization,
    );
    capabilityAuthorityMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockResolvedValueOnce(
      readonlyWorkbenchCapabilityStatus(entries),
    );

    render(await HospitalPage());

    const main = screen.getByRole('main');
    expect(main.querySelector('[data-capability-state="readonly-pilot"]')).toBeInTheDocument();
    expect(screen.getByText('工作台仅供查看')).toBeInTheDocument();
    if (visibleSummary) expect(screen.getByText(visibleSummary)).toBeInTheDocument();
    else expect(screen.queryByText('审计与安全仅供查看')).not.toBeInTheDocument();
    expect(screen.queryByText('系统概览仅供查看')).not.toBeInTheDocument();
    expect(within(main).queryAllByRole('button')).toHaveLength(0);
    expect(within(main).queryAllByRole('link')).toHaveLength(0);
  });

  it.each([
    {
      name: 'duplicate page_workbench',
      entries: [
        { key: 'page_workbench' },
        { key: 'page_workbench' },
      ],
    },
    {
      name: 'missing page_workbench',
      entries: [{ key: 'page_system_audit' }],
    },
  ] satisfies readonly {
    name: string;
    entries: readonly Readonly<{
      key: WorkbenchFixtureCapabilityKey;
      decision?: 'hidden' | 'read_only';
    }>[];
  }[])('异常 multi-capability 输入 fail closed：$name', async ({ entries }) => {
    const created = authorizationFixture('tenant_admin');
    vi.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
    serverRuntimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
      created.authorization,
    );
    capabilityAuthorityMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockResolvedValueOnce(
      readonlyWorkbenchCapabilityStatus(entries),
    );

    render(await HospitalPage());

    const main = screen.getByRole('main');
    expect(
      main.querySelector('[data-capability-state="readonly-pilot"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '工作台访问已核验', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('审计与安全仅供查看')).not.toBeInTheDocument();
  });

  it('keeps the genuine navigation boundary when capability authority resolution throws', async () => {
    const created = authorizationFixture('tenant_admin');
    serverRuntimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
      created.authorization,
    );
    capabilityAuthorityMocks.resolveInstitutionCapabilityAuthorityStatusV1.mockRejectedValueOnce(
      new Error('capability authority unavailable'),
    );

    render(await HospitalPage());

    expect(
      screen
        .getByRole('main')
        .querySelector('[data-capability-state="readonly-pilot"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: '工作台访问已核验',
        level: 2,
      }),
    ).toBeInTheDocument();
    expect(
      capabilityAuthorityMocks.resolveInstitutionCapabilityAuthorityStatusV1,
    ).toHaveBeenCalledTimes(1);
  });

  it.each(['consultant', 'customer_service'] as const)(
    'uses the genuine %s snapshot for the canonical first four sections',
    async (role) => {
      const created = authorizationFixture(role);
      serverRuntimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
        created.authorization,
      );

      render(await HospitalPage());

      expect(
        screen
          .getByRole('main')
          .querySelector('[data-capability-state="authorized-boundary"]'),
      ).toBeInTheDocument();
      const desktopNavigation = screen.getByRole('navigation', {
        name: '机构端桌面导航',
      });
      expect(
        within(desktopNavigation)
          .getAllByRole('link')
          .map((link) => link.getAttribute('aria-label')),
      ).toEqual(DESKTOP_NAVIGATION.slice(0, 4).map(([label]) => label));
      const mobileNavigation = screen.getByRole('navigation', {
        name: '机构端移动导航',
      });
      expect(
        within(mobileNavigation)
          .getAllByRole('link')
          .map((link) => link.textContent?.trim()),
      ).toEqual(['工作台', '客户', '会话', '待办']);
      expect(
        within(mobileNavigation).queryByRole('button', { name: '更多' }),
      ).not.toBeInTheDocument();
      expect(created.membershipRead).toHaveBeenCalledTimes(4);
      expect(created.anchorRead).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['null', 'reject', 'sync throw'] as const)(
    'fails closed with empty navigation when the shared root is %s',
    async (runtimeCase) => {
      if (runtimeCase === 'null') {
        serverRuntimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
          null,
        );
      } else if (runtimeCase === 'reject') {
        serverRuntimeMocks.resolveInstitutionServerAuthorizationV1.mockRejectedValueOnce(
          new Error('shared authorization unavailable'),
        );
      } else {
        serverRuntimeMocks.resolveInstitutionServerAuthorizationV1.mockImplementationOnce(
          () => {
            throw new Error('shared authorization unavailable');
          },
        );
      }

      render(await HospitalPage());

      expect(serverRuntimeMocks.resolveInstitutionServerAuthorizationV1).toHaveBeenCalledTimes(1);
      const desktopNavigation = screen.getByRole('navigation', {
        name: '机构端桌面导航',
      });
      const mobileNavigation = screen.getByRole('navigation', {
        name: '机构端移动导航',
      });
      expect(within(desktopNavigation).queryAllByRole('link')).toHaveLength(0);
      expect(within(mobileNavigation).queryAllByRole('link')).toHaveLength(0);
      expect(
        within(mobileNavigation).queryByRole('button', { name: '更多' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          name: '数据服务/能力尚未安全开放',
          level: 2,
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: '工作台访问已核验', level: 2 }),
      ).not.toBeInTheDocument();
      expect(
        capabilityAuthorityMocks.resolveInstitutionCapabilityAuthorityStatusV1,
      ).not.toHaveBeenCalled();
    },
  );

  it('rejects fake, clone, accessor, Proxy and revoked authorizations without method access', async () => {
    const genuine = createInstitutionRequestAuthorizationV1({} as never);
    let getterReads = 0;
    let proxyTraps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(
      accessor,
      'authorizeCurrentInstitutionNavigationV1',
      {
        enumerable: true,
        get() {
          getterReads += 1;
          throw new Error('authorization method getter must not run');
        },
      },
    );
    const proxy = new Proxy(genuine, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('authorization proxy trap must not run');
      },
    });
    const revoked = Proxy.revocable(genuine, {
      getPrototypeOf() {
        proxyTraps += 1;
        throw new Error('revoked authorization trap must not run');
      },
    });
    revoked.revoke();

    for (const value of [
      {},
      { ...genuine },
      Object.create(genuine) as object,
      accessor,
      proxy,
      revoked.proxy,
    ]) {
      serverRuntimeMocks.resolveInstitutionServerAuthorizationV1.mockResolvedValueOnce(
        value,
      );
      const { unmount } = render(await HospitalPage());

      const desktopNavigation = screen.getByRole('navigation', {
        name: '机构端桌面导航',
      });
      expect(within(desktopNavigation).queryAllByRole('link')).toHaveLength(0);
      expect(
        screen
          .getByRole('main')
          .querySelector('[data-capability-state="blocked"]'),
      ).toBeInTheDocument();
      unmount();
    }
    expect(getterReads).toBe(0);
    expect(proxyTraps).toBe(0);
    expect(
      capabilityAuthorityMocks.resolveInstitutionCapabilityAuthorityStatusV1,
    ).not.toHaveBeenCalled();
  });

  it('does not render authorization details, numbers, buttons or business entry points', async () => {
    render(await HospitalPage());

    const main = screen.getByRole('main');
    expect(within(main).queryByText('0')).not.toBeInTheDocument();
    expect(within(main).queryAllByRole('button')).toHaveLength(0);
    expect(within(main).queryAllByRole('link')).toHaveLength(0);
    expect(
      within(main).queryByText(
        /role|accountId|tenantId|institutionId|scope|policy|key|provider/iu,
      ),
    ).not.toBeInTheDocument();
    expect(
      within(main).queryByText(/Care 行动概览|机构能力|查看|新建/u),
    ).not.toBeInTheDocument();
  });
});
