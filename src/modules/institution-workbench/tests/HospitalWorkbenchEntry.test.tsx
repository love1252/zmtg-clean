import { createHmac } from 'node:crypto';

import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import HospitalPage from '@/app/hospital/page';
import type { CurrentInstitutionMembershipFactRow } from '@/modules/auth/server/auth-account-repository';
import {
  createFormalServerSessionRequestOwnerV1,
  FORMAL_SERVER_SESSION_COOKIE_V1,
  type FormalServerSessionKeyRingV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
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
  createAuthoritativeInstitutionAnchorFactReaderV1,
} from '@/modules/security/server/institution-anchor-provider';
import type { CurrentInstitutionAnchorFactRowV1 } from '@/modules/security/server/institution-anchor-repository';
import {
  createInstitutionGuardReferenceCodecV1,
} from '@/modules/security/server/institution-guard-reference';
import {
  createAuthoritativeInstitutionMembershipFactReaderV1,
} from '@/modules/security/server/institution-membership-provider';
import {
  createInstitutionRequestAuthorizationV1,
  type InstitutionRequestAuthorizationV1,
} from '@/modules/security/server/institution-request-authorization';

const NOW = new Date('2026-07-22T08:02:00.000Z');
const SESSION_KEY = new Uint8Array(32).fill(0x73);
const REFERENCE_KEY = new Uint8Array(32).fill(0x72);
const SESSION_PROTOCOL = 'zmtg.formal-server-session-cookie.v1';
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
  accountStatus: 'active',
  accountPasswordResetRequired: false,
  accountLockedUntil: null,
  membershipId: 'membership-workbench-entry-001',
  membershipTenantId: payload.tenantId,
  membershipUserId: payload.accountId,
  membershipRole: 'tenant_admin',
  membershipUpdatedAt: new Date('2026-07-22T08:01:00.000Z'),
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

function sessionKeyRing(): FormalServerSessionKeyRingV1 {
  return {
    currentKey: { keyVersion: 2, keyMaterial: SESSION_KEY },
    verifyOnlyKeys: [],
  };
}

function authorizationFixture() {
  const codec = createInstitutionGuardReferenceCodecV1({
    keyRing: {
      currentIssueKey: { keyVersion: 1, keyMaterial: REFERENCE_KEY },
      verifyOnlyKeys: [],
    },
    now: () => NOW,
  });
  const membershipRead = vi.fn(async () => [membershipRow]);
  const membershipFactReader = createAuthoritativeInstitutionMembershipFactReaderV1({
    repository: { findCurrentInstitutionMembershipFacts: membershipRead },
    now: () => NOW,
  });
  const owner = createFormalServerSessionRequestOwnerV1({
    cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${signToken()}`,
    sessionKeyRing: sessionKeyRing(),
    membershipFactReader,
    referenceCodec: codec,
    now: () => NOW,
  });
  const anchorRead = vi.fn(async () => [anchorRow]);
  const anchorFactReader = createAuthoritativeInstitutionAnchorFactReaderV1({
    repository: { findCurrentInstitutionAnchorFacts: anchorRead },
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
    expect(created.membershipRead).toHaveBeenCalledTimes(1);
    expect(created.anchorRead).toHaveBeenCalledTimes(1);
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

describe('WB-ENTRY-02A /hospital capability-off 页面', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('不再读取浏览器 demo session，直接渲染唯一 capability-off 工作台', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<HospitalPage />);

    expect(screen.getByRole('heading', { name: '工作台', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('正在检查登录状态...')).not.toBeInTheDocument();

    const desktopNavigation = screen.getByRole('navigation', { name: '机构端桌面导航' });
    expect(within(desktopNavigation).getAllByRole('link')).toHaveLength(1);
    expect(within(desktopNavigation).getByRole('link', { name: '工作台' })).toHaveAttribute(
      'href',
      '/hospital',
    );
    const mobileNavigation = screen.getByRole('navigation', { name: '机构端移动导航' });
    expect(within(mobileNavigation).getAllByRole('link')).toHaveLength(1);
    expect(within(mobileNavigation).getByRole('link', { name: '工作台' })).toHaveAttribute(
      'href',
      '/hospital',
    );
  });

  it('保持低敏阻断外观，不渲染授权细节、假事实、业务入口或零值', () => {
    render(<HospitalPage />);

    expect(
      screen.getByRole('heading', { name: '数据服务/能力尚未安全开放', level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('当前仅展示安全阻断状态；业务数据和业务入口保持隐藏。'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '工作台行动数据暂未开放', level: 3 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '行动队列' })).not.toBeInTheDocument();
    expect(screen.queryByText('Care 行动概览')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '客户旅程' })).not.toBeInTheDocument();
    expect(screen.queryByText('机构能力')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText(/nextAction/u)).not.toBeInTheDocument();
    expect(screen.queryAllByRole('link', { name: /查看|新建/u })).toHaveLength(0);
    for (const forbidden of [
      /tenant_admin/u,
      /customer_service/u,
      /scope_unavailable/u,
      /action_role_denied/u,
      /policyRevision/u,
      /validUntil/u,
      /accountId/u,
      /tenantId/u,
      /institutionId/u,
      /登录失败/u,
      /授权失败/u,
    ]) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
    }
  });
});
