import { createHmac } from 'node:crypto';
import { isProxy } from 'node:util/types';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';

import {
  createAuthoritativeInstitutionMembershipFactReaderV1,
  type CurrentInstitutionMembershipFactRow,
} from '@/modules/access-control/server/authoritative-membership-reader';
import { FORMAL_SERVER_SESSION_COOKIE_V1 } from '@/modules/auth/server/formal-server-session-provenance-owner';
import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import {
  consumeInstitutionCapabilityAuthorityRuntimeContextV1,
  isInstitutionCapabilityAuthorityRuntimeContextV1,
  resolveInstitutionCapabilityAuthorityRuntimeContextV1,
} from '@/modules/institution/server/institution-server-runtime';
import {
  INSTITUTION_CAPABILITY_AUTHORITY_REVISION_V1,
  resolveInstitutionCapabilityAuthorityStatusV1,
} from '@/server/orchestration/institution-capability-authority';
import {
  createAuthoritativeInstitutionScopeFactReaderV1,
  type CurrentInstitutionScopeFactRowV1,
} from '@/modules/tenancy/server/authoritative-institution-scope-reader';

const readerProvenance = vi.hoisted(() => ({
  identity: new WeakSet<object>(),
  membership: new WeakSet<object>(),
  scope: new WeakSet<object>(),
}));

const runtimeMocks = vi.hoisted(() => ({
  anchorRead: vi.fn(),
  cookieGet: vi.fn(),
  cookies: vi.fn(),
  createAccessControlAuthoritativeMembershipFactReaderV1: vi.fn(),
  createIdentityAuthoritativeFormalSessionIdentityFactReaderV1: vi.fn(),
  createTenancyAuthoritativeInstitutionScopeFactReaderV1: vi.fn(),
  createTenantBusinessRepository: vi.fn(),
  customerObjectFactSourceRead: vi.fn(),
  getDatabase: vi.fn(),
  identityRead: vi.fn(),
  membershipRead: vi.fn(),
  resolveInstitutionGuardRuntimeConfigV1: vi.fn(),
}));

vi.mock('next/headers', () => ({ cookies: runtimeMocks.cookies }));

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return { ...actual, getDatabase: runtimeMocks.getDatabase };
});

vi.mock(
  '@/modules/institution/server/tenant-business-repository',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import(
          '@/modules/institution/server/tenant-business-repository'
        )
      >();
    return {
      ...actual,
      createTenantBusinessRepository:
        runtimeMocks.createTenantBusinessRepository,
    };
  },
);

vi.mock(
  '@/modules/access-control/application/authoritative-membership-reader',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import(
          '@/modules/access-control/application/authoritative-membership-reader'
        )
      >();
    return {
      ...actual,
      createAccessControlAuthoritativeMembershipFactReaderV1:
        runtimeMocks.createAccessControlAuthoritativeMembershipFactReaderV1,
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
  '@/modules/auth/application/authoritative-formal-session-identity-reader',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import(
          '@/modules/auth/application/authoritative-formal-session-identity-reader'
        )
      >();
    return {
      ...actual,
      createIdentityAuthoritativeFormalSessionIdentityFactReaderV1:
        runtimeMocks.createIdentityAuthoritativeFormalSessionIdentityFactReaderV1,
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
  '@/modules/tenancy/application/authoritative-institution-scope-reader',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import(
          '@/modules/tenancy/application/authoritative-institution-scope-reader'
        )
      >();
    return {
      ...actual,
      createTenancyAuthoritativeInstitutionScopeFactReaderV1:
        runtimeMocks.createTenancyAuthoritativeInstitutionScopeFactReaderV1,
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
        typeof import(
          '@/modules/security/server/institution-guard-runtime-config'
        )
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
const REFERENCE_KEY = new Uint8Array(32).fill(0x72);
const SESSION_PROTOCOL = 'zmtg.formal-server-session-cookie.v1';
const database = Object.freeze({ kind: 'database' });

const payload = Object.freeze({
  source: 'server_session' as const,
  sessionId: 'session-r1a-orchestration-001',
  accountId: 'account-r1a-orchestration-001',
  tenantId: 'tenant-r1a-orchestration-001',
  institutionId: 'institution-r1a-orchestration-001',
  issuedAt: '2026-07-22T08:00:00.000Z',
  expiresAt: '2026-07-22T09:00:00.000Z',
});

const membershipRow: CurrentInstitutionMembershipFactRow = {
  accountId: payload.accountId,
  membershipId: 'membership-r1a-orchestration-001',
  membershipTenantId: payload.tenantId,
  membershipUserId: payload.accountId,
  membershipRole: 'tenant_admin',
  membershipDisplayName: '机构管理员',
  membershipRevision: 1,
  membershipLifecycleStatus: 'active',
  membershipProvenanceSource: 'legacy_calibration',
  membershipProvenanceActorId: null,
  membershipProvenanceReasonCode: 'legacy_unknown',
  membershipProvenanceCommandId: `mcal1_${'d'.repeat(64)}`,
  membershipProvenanceOccurredAt: null,
  membershipProvenanceRecordedAt: new Date('2026-07-22T08:01:00.000Z'),
  membershipRevokedAt: null,
  membershipDeletedAt: null,
  bindingId: 'binding-r1a-orchestration-001',
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
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );
  const signingInput = `${SESSION_PROTOCOL}\n2\n${payloadSegment}`;
  const tag = createHmac('sha256', SESSION_KEY)
    .update(signingInput)
    .digest('base64url');
  return `v1.k2.${payloadSegment}.${tag}`;
}

function availableRuntimeConfig() {
  return Object.freeze({
    kind: 'available' as const,
    formalServerSessionKeyRing: Object.freeze({
      currentKey: Object.freeze({
        keyVersion: 2,
        keyMaterial: SESSION_KEY,
      }),
      verifyOnlyKeys: Object.freeze([]),
    }),
    institutionGuardReferenceKeyRing: Object.freeze({
      currentIssueKey: Object.freeze({
        keyVersion: 1,
        keyMaterial: REFERENCE_KEY,
      }),
      verifyOnlyKeys: Object.freeze([]),
    }),
  });
}

describe('POST-V2-R1C page_system_audit readonly release authority', () => {
  beforeEach(() => {
    for (const mock of Object.values(runtimeMocks)) mock.mockClear();

    vi.spyOn(Date, 'now').mockReturnValue(NOW.getTime());

    runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValue(
      availableRuntimeConfig(),
    );
    runtimeMocks.cookies.mockResolvedValue({
      get: runtimeMocks.cookieGet,
    });
    runtimeMocks.cookieGet.mockReturnValue({
      name: FORMAL_SERVER_SESSION_COOKIE_V1,
      value: signToken(),
    });
    runtimeMocks.getDatabase.mockReturnValue(database);

    runtimeMocks.customerObjectFactSourceRead.mockResolvedValue({
      customerId: 'customer-r1a-orchestration-001',
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
      updatedAt: '2026-07-22T08:01:30.000Z',
    });
    runtimeMocks.createTenantBusinessRepository.mockReturnValue({
      getCustomerObjectFactSourceByScope:
        runtimeMocks.customerObjectFactSourceRead,
    });

    runtimeMocks.identityRead.mockImplementation(async (input) => ({
      kind: 'current_identity_fact' as const,
      accountId: input.accountId,
      username: 'r1a_operator',
      displayName: 'R1A 操作员',
      status: 'active' as const,
      observedAt: NOW.toISOString(),
    }));
    runtimeMocks.membershipRead.mockResolvedValue([membershipRow]);
    runtimeMocks.anchorRead.mockResolvedValue([anchorRow]);

    runtimeMocks.createIdentityAuthoritativeFormalSessionIdentityFactReaderV1.mockImplementation(
      () => {
        let databaseReady = false;
        const reader = Object.freeze({
          async resolve(input: Readonly<{ accountId: string }>) {
            if (!databaseReady) {
              const candidate: unknown = runtimeMocks.getDatabase();
              if (
                candidate === null ||
                (typeof candidate !== 'object' &&
                  typeof candidate !== 'function') ||
                isProxy(candidate)
              ) {
                return Object.freeze({
                  kind: 'rejected' as const,
                  code: 'identity_unavailable' as const,
                });
              }
              databaseReady = true;
            }
            return runtimeMocks.identityRead(input);
          },
        });
        readerProvenance.identity.add(reader);
        return reader;
      },
    );

    runtimeMocks.createAccessControlAuthoritativeMembershipFactReaderV1.mockImplementation(
      () => {
        let databaseReady = false;
        const reader = createAuthoritativeInstitutionMembershipFactReaderV1({
          repository: {
            async findCurrentInstitutionMembershipFacts(input) {
              if (!databaseReady) {
                const candidate: unknown = runtimeMocks.getDatabase();
                if (
                  candidate === null ||
                  (typeof candidate !== 'object' &&
                    typeof candidate !== 'function') ||
                  isProxy(candidate)
                ) {
                  throw new Error('membership database unavailable');
                }
                databaseReady = true;
              }
              return runtimeMocks.membershipRead(input);
            },
          },
          now: () => new Date(Date.now()),
        });
        readerProvenance.membership.add(reader);
        return reader;
      },
    );

    runtimeMocks.createTenancyAuthoritativeInstitutionScopeFactReaderV1.mockImplementation(
      () => {
        let databaseReady = false;
        const reader = createAuthoritativeInstitutionScopeFactReaderV1({
          repository: {
            async findCurrentInstitutionScopeFacts(input) {
              if (!databaseReady) {
                const candidate: unknown = runtimeMocks.getDatabase();
                if (
                  candidate === null ||
                  (typeof candidate !== 'object' &&
                    typeof candidate !== 'function') ||
                  isProxy(candidate)
                ) {
                  throw new Error('scope database unavailable');
                }
                databaseReady = true;
              }
              return runtimeMocks.anchorRead(input);
            },
          },
          now: () => new Date(Date.now()),
        });
        readerProvenance.scope.add(reader);
        return reader;
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes no-input readonly-pilot authority resolver and frozen S14 revision', () => {
    expectTypeOf<
      Parameters<typeof resolveInstitutionCapabilityAuthorityStatusV1>
    >().toEqualTypeOf<[]>();
    expectTypeOf<
      ReturnType<typeof resolveInstitutionCapabilityAuthorityStatusV1>
    >().toEqualTypeOf<Promise<CapabilityStatusV1 | null>>();
    expect(INSTITUTION_CAPABILITY_AUTHORITY_REVISION_V1).toBe(
      'r1c-page-system-audit-readonly-pilot-v1',
    );
  });

  it('tenant_admin returns exactly two governed read_only pilots and keeps the other 34 hidden', async () => {
    const status = await resolveInstitutionCapabilityAuthorityStatusV1();

    expect(status).toMatchObject({
      contractVersion: 'v1',
      scope: {
        tenantId: payload.tenantId,
        institutionId: payload.institutionId,
      },
      readiness: 'ready',
      failureCode: null,
    });
    expect(status?.partitions).toHaveLength(36);
    expect(status?.data?.capabilities).toHaveLength(36);
    expect(status?.freshness).toEqual({
      observedAt: NOW.toISOString(),
      freshUntil: new Date(NOW.getTime() + 5_000).toISOString(),
    });

    const capabilities = status?.data?.capabilities ?? [];
    const workbench = capabilities.find((item) => item.key === 'page_workbench');
    const audit = capabilities.find((item) => item.key === 'page_system_audit');

    expect(workbench).toEqual({
      key: 'page_workbench',
      decision: 'read_only',
      dimensions: {
        codeMaturity: 'verified',
        institutionAuthorization: 'authorized',
        connectionAvailability: 'not_required',
        dataReadiness: 'not_required',
        productionRelease: 'pilot_released',
      },
      safeSummary: '工作台仅供查看',
      diagnosticTargetKey: null,
    });

    expect(audit).toEqual({
      key: 'page_system_audit',
      decision: 'read_only',
      dimensions: {
        codeMaturity: 'verified',
        institutionAuthorization: 'authorized',
        connectionAvailability: 'not_required',
        dataReadiness: 'partial',
        productionRelease: 'pilot_released',
      },
      safeSummary: '审计与安全仅供查看',
      diagnosticTargetKey: 'page_system_audit',
    });

    const releasedGovernedPageKeys = capabilities
      .filter(
        (item) =>
          item.key.startsWith('page_') &&
          item.dimensions.productionRelease === 'pilot_released',
      )
      .map((item) => item.key);
    expect(releasedGovernedPageKeys).toEqual([
      'page_workbench',
      'page_system_audit',
    ]);

    const remaining = capabilities.filter(
      (item) =>
        item.key !== 'page_workbench' && item.key !== 'page_system_audit',
    );
    expect(remaining).toHaveLength(34);
    for (const item of remaining) {
      expect(item.decision).toBe('hidden');
      expect(item.dimensions.productionRelease).toBe('not_released');
      expect(item.safeSummary).toBeNull();
    }

    const diagnosticKeys = capabilities
      .map((item) => item.diagnosticTargetKey)
      .filter((value) => value !== null);

    expect(diagnosticKeys).toEqual([
      'page_system_overview',
      'page_system_channels',
      'page_system_data',
      'page_system_ai_usage',
      'page_system_privacy',
      'page_system_audit',
    ]);

    expect(runtimeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(runtimeMocks.customerObjectFactSourceRead).not.toHaveBeenCalled();
  });

  it('consultant receives the readonly workbench pilot while customer/system dimensions remain authoritative', async () => {
    runtimeMocks.membershipRead.mockResolvedValue([
      {
        ...membershipRow,
        membershipRole: 'consultant',
      },
    ]);

    const status = await resolveInstitutionCapabilityAuthorityStatusV1();
    const capabilities = status?.data?.capabilities ?? [];

    expect(
      capabilities.find((item) => item.key === 'page_workbench'),
    ).toMatchObject({
      decision: 'read_only',
      dimensions: {
        institutionAuthorization: 'authorized',
        productionRelease: 'pilot_released',
      },
      safeSummary: '工作台仅供查看',
    });

    expect(
      capabilities.find((item) => item.key === 'page_customer_list'),
    ).toMatchObject({
      decision: 'hidden',
      dimensions: {
        institutionAuthorization: 'authorized',
        productionRelease: 'not_released',
      },
    });

    expect(
      capabilities.find((item) => item.key === 'page_system_overview'),
    ).toMatchObject({
      decision: 'hidden',
      dimensions: {
        institutionAuthorization: 'not_authorized',
        productionRelease: 'not_released',
      },
      diagnosticTargetKey: null,
    });

    expect(
      capabilities.find((item) => item.key === 'page_system_audit'),
    ).toMatchObject({
      decision: 'hidden',
      dimensions: {
        codeMaturity: 'verified',
        institutionAuthorization: 'not_authorized',
        connectionAvailability: 'not_required',
        dataReadiness: 'partial',
        productionRelease: 'pilot_released',
      },
      safeSummary: null,
      diagnosticTargetKey: null,
    });

    expect(
      capabilities.every((item) => item.diagnosticTargetKey === null),
    ).toBe(true);
  });

  it('tenant_operator receives the exact page_system_audit readonly partial pilot shape', async () => {
    runtimeMocks.membershipRead.mockResolvedValue([
      {
        ...membershipRow,
        membershipRole: 'tenant_operator',
      },
    ]);

    const status = await resolveInstitutionCapabilityAuthorityStatusV1();

    expect(
      status?.data?.capabilities.find(
        (item) => item.key === 'page_system_audit',
      ),
    ).toEqual({
      key: 'page_system_audit',
      decision: 'read_only',
      dimensions: {
        codeMaturity: 'verified',
        institutionAuthorization: 'authorized',
        connectionAvailability: 'not_required',
        dataReadiness: 'partial',
        productionRelease: 'pilot_released',
      },
      safeSummary: '审计与安全仅供查看',
      diagnosticTargetKey: 'page_system_audit',
    });
  });

  it('keeps all three controlled-create actions hidden and not released', async () => {
    const status = await resolveInstitutionCapabilityAuthorityStatusV1();
    const byKey = new Map(
      (status?.data?.capabilities ?? []).map((item) => [item.key, item]),
    );

    for (const key of [
      'action_customer_create',
      'action_care_appointment_create',
      'action_care_followup_create',
    ] as const) {
      expect(byKey.get(key)).toMatchObject({
        decision: 'hidden',
        dimensions: {
          productionRelease: 'not_released',
        },
        safeSummary: null,
      });
    }
  });

  it('invalid formal cookie fails before identity, membership, anchor, or business-object persistence', async () => {
    runtimeMocks.cookieGet.mockReturnValue({
      name: FORMAL_SERVER_SESSION_COOKIE_V1,
      value: 'invalid-formal-session',
    });

    await expect(
      resolveInstitutionCapabilityAuthorityStatusV1(),
    ).resolves.toBeNull();

    expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
    expect(runtimeMocks.identityRead).not.toHaveBeenCalled();
    expect(runtimeMocks.membershipRead).not.toHaveBeenCalled();
    expect(runtimeMocks.anchorRead).not.toHaveBeenCalled();
    expect(runtimeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
  });

  it('missing formal cookie remains fail-closed without persistence', async () => {
    runtimeMocks.cookieGet.mockReturnValue(undefined);

    await expect(
      resolveInstitutionCapabilityAuthorityStatusV1(),
    ).resolves.toBeNull();

    expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
    expect(runtimeMocks.membershipRead).not.toHaveBeenCalled();
    expect(runtimeMocks.anchorRead).not.toHaveBeenCalled();
  });

  it('unavailable runtime config fails before cookies and persistence', async () => {
    runtimeMocks.resolveInstitutionGuardRuntimeConfigV1.mockReturnValue({
      kind: 'unavailable',
    });

    await expect(
      resolveInstitutionCapabilityAuthorityStatusV1(),
    ).resolves.toBeNull();

    expect(runtimeMocks.cookies).not.toHaveBeenCalled();
    expect(runtimeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('runtime authority context is opaque and one-shot', async () => {
    const context =
      await resolveInstitutionCapabilityAuthorityRuntimeContextV1();

    expect(isInstitutionCapabilityAuthorityRuntimeContextV1(context)).toBe(
      true,
    );
    expect(Object.isFrozen(context)).toBe(true);

    const first =
      consumeInstitutionCapabilityAuthorityRuntimeContextV1(context);
    expect(first).toMatchObject({
      tenantId: payload.tenantId,
      institutionId: payload.institutionId,
      observedAt: NOW.toISOString(),
    });
    expect(first?.availableSectionIds).toEqual([
      'workbench',
      'customers',
      'conversations',
      'care',
      'knowledge',
      'analytics',
      'system',
    ]);

    expect(
      consumeInstitutionCapabilityAuthorityRuntimeContextV1(context),
    ).toBeNull();
    expect(isInstitutionCapabilityAuthorityRuntimeContextV1(context)).toBe(
      false,
    );
  });
});
