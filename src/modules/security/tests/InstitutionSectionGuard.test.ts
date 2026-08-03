import { createHash } from 'node:crypto';

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

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

import {
  createAuthoritativeInstitutionMembershipFactReaderV1 as createUnbrandedMembershipFactReaderV1,
  type CurrentInstitutionMembershipFactRow,
} from '@/modules/access-control/server/authoritative-membership-reader';
import type { AuthoritativeFormalSessionIdentityFactReaderV1 } from '@/modules/auth/ports/authoritative-formal-session-identity-reader';
import {
  INSTITUTION_NAVIGATION_SECTION_IDS_V1,
  INSTITUTION_ROLES_V1,
  type InstitutionNavigationSectionIdV1,
  type InstitutionRoleV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import { createActiveInstitutionAnchorProviderV1 } from '@/modules/security/server/institution-anchor-provider';
import type { AuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/ports/authoritative-institution-scope-reader';
import {
  createFormalRequestProvenanceResolverV1,
  type FormalRequestProvenanceOwnerInputV1,
} from '@/modules/security/server/formal-request-provenance-owner';
import {
  createInstitutionGuardReferenceCodecV1,
  isInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceInputV1,
  type InstitutionGuardReferenceOwnerSubjectV1,
} from '@/modules/security/server/institution-guard-reference';
import {
  createRequestBoundFreshActiveMembershipProviderV1,
} from '@/modules/security/server/institution-membership-provider';
import {
  createInstitutionScopeGuardV1,
  type InstitutionScopeGuardV1,
} from '@/modules/security/server/institution-scope-guard';
import {
  createInstitutionSectionGuardV1,
  INSTITUTION_SECTION_GUARD_FAILURE_CODES_V1,
  isInstitutionNavigationAuthorizationV1,
  isInstitutionSectionAllowV1,
  isInstitutionSectionGuardV1,
  type InstitutionNavigationAuthorizationInputV1,
  type InstitutionNavigationAuthorizationV1,
  type InstitutionSectionAllowV1,
  type InstitutionSectionGuardInputV1,
  type InstitutionSectionGuardV1,
} from '@/modules/security/server/institution-section-guard';

function createAuthoritativeInstitutionMembershipFactReaderV1(
  input: Parameters<typeof createUnbrandedMembershipFactReaderV1>[0],
) {
  const reader = createUnbrandedMembershipFactReaderV1(input);
  readerProvenance.membership.add(reader);
  return reader;
}

function genuineScopeFactReaderForTest<T extends object>(reader: T): T {
  readerProvenance.scope.add(reader);
  return reader;
}

function genuineIdentityFactReaderForTest(
  accountId: string,
): AuthoritativeFormalSessionIdentityFactReaderV1 {
  const reader = Object.freeze({
    resolve: vi.fn(async () => ({
      kind: 'current_identity_fact' as const,
      accountId,
      username: 'section_operator',
      displayName: '栏目操作员',
      status: 'active' as const,
      observedAt: SCOPE_NOW.toISOString(),
    })),
  });
  readerProvenance.identity.add(reader);
  return reader;
}

const SCOPE_NOW = new Date('2026-07-22T08:00:30.000Z');
const SECTION_NOW = new Date('2026-07-22T08:00:31.000Z');
const TOKEN = 'A'.repeat(43);
const TEST_REFERENCE_KEY = new Uint8Array(32).fill(0x32);

function reference(prefix: string): string {
  return `${prefix}_v1_k1_${TOKEN}`;
}

function controlledCodec() {
  const issue = vi.fn((input: { prefix: string }) =>
    Object.freeze({ kind: 'issued', reference: reference(input.prefix) }),
  );
  const verify = vi.fn((input: { reference: string }) =>
    Object.freeze({ kind: 'verified', reference: input.reference }),
  );
  return {
    codec: Object.freeze({ issue, verify }) as unknown as InstitutionGuardReferenceCodecV1,
    issue,
    verify,
  };
}

function genuineCodec(): InstitutionGuardReferenceCodecV1 {
  return createInstitutionGuardReferenceCodecV1({
    keyRing: {
      currentIssueKey: {
        keyVersion: 1,
        keyMaterial: TEST_REFERENCE_KEY,
      },
      verifyOnlyKeys: [],
    },
    now: () => SECTION_NOW,
  });
}

function genuineUnavailableCodec(): InstitutionGuardReferenceCodecV1 {
  return createInstitutionGuardReferenceCodecV1({
    keyRing: {
      currentIssueKey: {
        keyVersion: 1,
        keyMaterial: null,
      },
      verifyOnlyKeys: [],
    },
    now: () => SECTION_NOW,
  });
}

type ScopeTimingOptions = Readonly<{
  provenanceValidUntil?: string;
  membershipObservedAt?: string;
  anchorObservedAt?: string;
}>;

function genuineScopeComposition(
  role: InstitutionRoleV1 = 'tenant_admin',
  timing: ScopeTimingOptions = {},
) {
  const provenanceCodec = genuineCodec();
  const membershipCodec = genuineCodec();
  const anchorCodec = genuineCodec();
  const provenanceNow = vi.fn(() =>
    new Date('2026-07-22T07:59:01.000Z'),
  );
  const provenanceResolver = createFormalRequestProvenanceResolverV1({
    ownerInput: {
      source: 'server_session',
      accountId: 'account-a',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      requestIdentifier: 'request-a',
      proofIdentifier: 'proof-a',
      issuedAt: '2026-07-22T07:59:00.000Z',
      proofValidUntil:
        timing.provenanceValidUntil ?? '2026-07-22T08:04:00.000Z',
    } as unknown as FormalRequestProvenanceOwnerInputV1,
    referenceCodec: provenanceCodec,
    now: provenanceNow,
  });
  const membershipObservedAt =
    timing.membershipObservedAt ?? '2026-07-22T08:00:00.000Z';
  const membershipRow: CurrentInstitutionMembershipFactRow = {
    accountId: 'account-a',
    membershipId: 'membership-a',
    membershipTenantId: 'tenant-a',
    membershipUserId: 'account-a',
    membershipRole: role,
    membershipDisplayName: '机构成员',
    membershipRevision: 1,
    membershipLifecycleStatus: 'active',
    membershipProvenanceSource: 'legacy_calibration',
    membershipProvenanceActorId: null,
    membershipProvenanceReasonCode: 'legacy_unknown',
    membershipProvenanceCommandId: `mcal1_${'f'.repeat(64)}`,
    membershipProvenanceOccurredAt: null,
    membershipProvenanceRecordedAt: new Date('2026-07-22T07:58:00.000Z'),
    membershipRevokedAt: null,
    membershipDeletedAt: null,
    bindingId: 'binding-a',
    bindingAccountId: 'account-a',
    bindingTenantId: 'tenant-a',
    bindingInstitutionId: 'institution-a',
    bindingStatus: 'active',
    bindingSource: 'manual_admin',
    bindingAssignedAt: new Date('2026-07-01T00:00:00.000Z'),
    bindingExpiresAt: null,
    bindingRevokedAt: null,
    bindingVersion: 7,
  };
  const resolveMembershipFact = vi.fn(async () => [membershipRow]);
  const membershipFactReader =
    createAuthoritativeInstitutionMembershipFactReaderV1({
      repository: {
        findCurrentInstitutionMembershipFacts: resolveMembershipFact,
      },
      now: () => new Date(membershipObservedAt),
    });
  const membershipProvider = createRequestBoundFreshActiveMembershipProviderV1({
    accountId: 'account-a',
    identityFactReader: genuineIdentityFactReaderForTest('account-a'),
    factReader: membershipFactReader,
    referenceCodec: membershipCodec,
    now: () => SCOPE_NOW,
  });
  const resolveAnchorFact = vi.fn(async () =>
    Object.freeze({
      kind: 'current_scope_fact',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      status: 'active',
      revision: 7,
      observedAt:
        timing.anchorObservedAt ?? '2026-07-22T08:00:00.000Z',
    }),
  );
  const anchorProvider = createActiveInstitutionAnchorProviderV1({
    factReader: genuineScopeFactReaderForTest(
      Object.freeze({
        resolve: resolveAnchorFact,
      }) as AuthoritativeInstitutionScopeFactReaderV1,
    ),
    referenceCodec: anchorCodec,
    now: () => SCOPE_NOW,
  });
  return {
    guard: createInstitutionScopeGuardV1({
      provenanceResolver,
      membershipProvider,
      anchorProvider,
      now: () => SCOPE_NOW,
    }),
    referenceCodecs: Object.freeze([
      provenanceCodec,
      membershipCodec,
      anchorCodec,
    ]),
    downstream: Object.freeze({
      provenanceNow,
      resolveMembershipFact,
      resolveAnchorFact,
    }),
  };
}

function genuineScopeGuard(
  role: InstitutionRoleV1 = 'tenant_admin',
  timing: ScopeTimingOptions = {},
) {
  return genuineScopeComposition(role, timing).guard;
}

function sectionHarness(
  role: InstitutionRoleV1 = 'tenant_admin',
  options: Readonly<{
    scopeGuard?: InstitutionScopeGuardV1;
    referenceCodec?: InstitutionGuardReferenceCodecV1;
    now?: () => Date;
  }> = {},
) {
  const referenceCodec = options.referenceCodec ?? genuineCodec();
  const guard = createInstitutionSectionGuardV1({
    scopeGuard: options.scopeGuard ?? genuineScopeGuard(role),
    referenceCodec,
    now: options.now ?? (() => SECTION_NOW),
  });
  return { guard, referenceCodec };
}

const ROLE_MATRIX = INSTITUTION_NAVIGATION_SECTION_IDS_V1.flatMap((sectionId) =>
  INSTITUTION_ROLES_V1.map((role) => ({
    sectionId,
    role,
    allowed:
      sectionId === 'workbench' ||
      sectionId === 'customers' ||
      sectionId === 'conversations' ||
      sectionId === 'care' ||
      role === 'tenant_admin' ||
      role === 'tenant_operator',
  })),
);

const LOOKALIKE_KINDS = Object.freeze([
  'plain',
  'spread',
  'cast',
  'custom_proto',
  'accessor',
  'proxy',
  'revoked_proxy',
] as const);

type LookalikeKind = (typeof LOOKALIKE_KINDS)[number];

function codecLookalike(
  kind: LookalikeKind,
  authentic: InstitutionGuardReferenceCodecV1,
) {
  const issue = vi.fn(() => {
    throw new Error('fake codec issue must not run');
  });
  const verify = vi.fn(() => {
    throw new Error('fake codec verify must not run');
  });
  let getterReads = 0;
  let traps = 0;
  const plain = { issue, verify };
  let value: object;
  switch (kind) {
    case 'plain':
      value = Object.freeze(plain);
      break;
    case 'spread':
      value = Object.freeze({ ...authentic, issue, verify });
      break;
    case 'cast':
      value = Object.freeze({ issue, verify });
      break;
    case 'custom_proto':
      value = Object.freeze(
        Object.assign(Object.create({ owner: 'fake' }), plain),
      );
      break;
    case 'accessor': {
      value = {};
      Object.defineProperties(value, {
        issue: {
          enumerable: true,
          get() {
            getterReads += 1;
            return issue;
          },
        },
        verify: {
          enumerable: true,
          get() {
            getterReads += 1;
            return verify;
          },
        },
      });
      Object.freeze(value);
      break;
    }
    case 'proxy':
      value = new Proxy(Object.freeze(plain), {
        get() {
          traps += 1;
          throw new Error('codec get trap');
        },
        getPrototypeOf() {
          traps += 1;
          throw new Error('codec prototype trap');
        },
        getOwnPropertyDescriptor() {
          traps += 1;
          throw new Error('codec descriptor trap');
        },
        ownKeys() {
          traps += 1;
          throw new Error('codec ownKeys trap');
        },
      });
      break;
    case 'revoked_proxy': {
      const revocable = Proxy.revocable(Object.freeze(plain), {});
      revocable.revoke();
      value = revocable.proxy;
      break;
    }
  }
  return {
    value: value as InstitutionGuardReferenceCodecV1,
    issue,
    verify,
    getterReads: () => getterReads,
    traps: () => traps,
  };
}

function scopeLookalike(kind: (typeof LOOKALIKE_KINDS)[number], authentic: object) {
  const fakeMethod = vi.fn(async () => {
    throw new Error('lookalike scope method must not run');
  });
  let getterReads = 0;
  let traps = 0;
  const plain = { authorizeCurrentRequest: fakeMethod };
  let value: object;
  switch (kind) {
    case 'plain':
      value = Object.freeze(plain);
      break;
    case 'spread':
      value = Object.freeze({ ...authentic });
      break;
    case 'cast':
      value = Object.freeze({ authorizeCurrentRequest: fakeMethod });
      break;
    case 'custom_proto':
      value = Object.freeze(Object.assign(Object.create({ owner: 'fake' }), plain));
      break;
    case 'accessor': {
      const accessor = {};
      Object.defineProperty(accessor, 'authorizeCurrentRequest', {
        enumerable: true,
        get() {
          getterReads += 1;
          return fakeMethod;
        },
      });
      value = Object.freeze(accessor);
      break;
    }
    case 'proxy':
      value = new Proxy(Object.freeze(plain), {
        get() { traps += 1; throw new Error('get trap'); },
        getPrototypeOf() { traps += 1; throw new Error('prototype trap'); },
        getOwnPropertyDescriptor() { traps += 1; throw new Error('descriptor trap'); },
        ownKeys() { traps += 1; throw new Error('ownKeys trap'); },
      });
      break;
    case 'revoked_proxy': {
      const revocable = Proxy.revocable(Object.freeze(plain), {});
      revocable.revoke();
      value = revocable.proxy;
      break;
    }
  }
  return { value, fakeMethod, getterReads: () => getterReads, traps: () => traps };
}

function expectedPolicyOwnerSubject(): InstitutionGuardReferenceOwnerSubjectV1 {
  const fields = [
    'zmtg.institution-section-policy.v1',
    'resource=institution_section',
    'action=section_enter',
    ...ROLE_MATRIX.map(
      ({ sectionId, role, allowed }) => `${sectionId}|${role}|${allowed ? 'allow' : 'deny'}`,
    ),
  ];
  const encoded = fields.map((field) => Buffer.from(field, 'utf8'));
  const output = Buffer.allocUnsafe(
    encoded.reduce((total, field) => total + 4 + field.byteLength, 0),
  );
  let offset = 0;
  for (const field of encoded) {
    output.writeUInt32BE(field.byteLength, offset);
    offset += 4;
    field.copy(output, offset);
    offset += field.byteLength;
  }
  return `manifest-sha256:${createHash('sha256').update(output).digest('base64url')}` as InstitutionGuardReferenceOwnerSubjectV1;
}

const CODEC_BOUNDARY_CASES = LOOKALIKE_KINDS.flatMap((kind) =>
  (['accessor_input', 'proxy_input'] as const).map((inputKind) => ({
    kind,
    inputKind,
  })),
);

describe('WB-BASE-SECTION-GUARD-04A', () => {
  it('uses only genuine reference codecs in positive scope and section fixtures', () => {
    const scope = genuineScopeComposition();
    const section = sectionHarness();
    expect(
      [...scope.referenceCodecs, section.referenceCodec].every((codec) =>
        isInstitutionGuardReferenceCodecV1(codec),
      ),
    ).toBe(true);
  });

  it.each(CODEC_BOUNDARY_CASES)(
    'rejects $kind codec before reading $inputKind or invoking downstream',
    async ({ kind, inputKind }) => {
      const scope = genuineScopeComposition();
      const lookalike = codecLookalike(kind, genuineCodec());
      const secondNow = vi.fn(() => SECTION_NOW);
      let inputReads = 0;
      let inputTraps = 0;
      let input: object;
      if (inputKind === 'accessor_input') {
        input = {};
        Object.defineProperty(input, 'sectionId', {
          enumerable: true,
          get() {
            inputReads += 1;
            return 'workbench';
          },
        });
      } else {
        input = new Proxy(
          { sectionId: 'workbench' },
          {
            get() {
              inputTraps += 1;
              throw new Error('input get trap');
            },
            getPrototypeOf() {
              inputTraps += 1;
              throw new Error('input prototype trap');
            },
            getOwnPropertyDescriptor() {
              inputTraps += 1;
              throw new Error('input descriptor trap');
            },
            ownKeys() {
              inputTraps += 1;
              throw new Error('input ownKeys trap');
            },
          },
        );
      }

      const guard = createInstitutionSectionGuardV1({
        scopeGuard: scope.guard,
        referenceCodec: lookalike.value,
        now: secondNow,
      });

      expect(isInstitutionSectionGuardV1(guard)).toBe(true);
      await expect(
        guard.authorizeCurrentSection(input as InstitutionSectionGuardInputV1),
      ).resolves.toEqual({ kind: 'rejected', code: 'policy_unavailable' });
      expect(lookalike.getterReads()).toBe(0);
      expect(lookalike.traps()).toBe(0);
      expect(lookalike.issue).not.toHaveBeenCalled();
      expect(lookalike.verify).not.toHaveBeenCalled();
      expect(scope.downstream.provenanceNow).not.toHaveBeenCalled();
      expect(scope.downstream.resolveMembershipFact).not.toHaveBeenCalled();
      expect(scope.downstream.resolveAnchorFact).not.toHaveBeenCalled();
      expect(secondNow).not.toHaveBeenCalled();
      expect(inputReads).toBe(0);
      expect(inputTraps).toBe(0);
    },
  );

  it('accepts a genuine-but-unavailable codec and returns low-sensitive policy unavailability', async () => {
    const scope = genuineScopeComposition();
    const codec = genuineUnavailableCodec();
    const secondNow = vi.fn(() => SECTION_NOW);
    expect(isInstitutionGuardReferenceCodecV1(codec)).toBe(true);

    const result = await createInstitutionSectionGuardV1({
      scopeGuard: scope.guard,
      referenceCodec: codec,
      now: secondNow,
    }).authorizeCurrentSection({ sectionId: 'workbench' });

    expect(result).toEqual({ kind: 'rejected', code: 'policy_unavailable' });
    expect(scope.downstream.provenanceNow).toHaveBeenCalledTimes(1);
    expect(scope.downstream.resolveMembershipFact).toHaveBeenCalledTimes(4);
    expect(scope.downstream.resolveAnchorFact).toHaveBeenCalledTimes(2);
    expect(secondNow).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty('scopeAllow');
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('institutionId');
  });

  it.each(ROLE_MATRIX)(
    'enforces the private 7x4 matrix: $sectionId / $role',
    async ({ sectionId, role, allowed }) => {
      const { guard } = sectionHarness(role);
      const result = await guard.authorizeCurrentSection({ sectionId });
      if (allowed) {
        expect(result).toMatchObject({
          kind: 'institution_section_allow',
          sectionId,
          action: 'section_enter',
          decidedAt: SECTION_NOW.toISOString(),
          validUntil: '2026-07-22T08:01:00.000Z',
        });
        expect(isInstitutionSectionAllowV1(result)).toBe(true);
      } else {
        expect(result).toEqual({ kind: 'rejected', code: 'action_role_denied' });
      }
    },
  );

  it('exposes only the section id as caller input and rejects unknown or extra input', async () => {
    expectTypeOf<InstitutionSectionGuardInputV1>().toEqualTypeOf<
      Readonly<{ sectionId: InstitutionNavigationSectionIdV1 }>
    >();
    const { guard } = sectionHarness();
    await expect(guard.authorizeCurrentSection({ sectionId: 'unknown' } as never)).resolves.toEqual({
      kind: 'rejected',
      code: 'action_unregistered',
    });
    const { guard: extraGuard } = sectionHarness();
    await expect(
      extraGuard.authorizeCurrentSection({ sectionId: 'workbench', role: 'tenant_admin' } as never),
    ).resolves.toEqual({ kind: 'rejected', code: 'action_unregistered' });
  });

  it('keeps the guard and allow nominally sealed and exposes no raw authorization input keys', () => {
    type PlainGuard = Readonly<{
      authorizeCurrentSection: InstitutionSectionGuardV1['authorizeCurrentSection'];
    }>;
    type PlainAllow = Readonly<{
      kind: 'institution_section_allow';
      sectionId: InstitutionNavigationSectionIdV1;
      action: 'section_enter';
      policyRevision: string;
      decidedAt: string;
      validUntil: string;
    }>;
    type CallerInput = Parameters<
      InstitutionSectionGuardV1['authorizeCurrentSection']
    >[0];
    type ForbiddenCallerKeys = Extract<
      keyof CallerInput,
      | 'provenance'
      | 'membership'
      | 'anchor'
      | 'scopeAllow'
      | 'role'
      | 'policyRevision'
      | 'tenantId'
      | 'institutionId'
    >;
    type PlainGuardCanPromote = PlainGuard extends InstitutionSectionGuardV1
      ? true
      : false;
    type PlainAllowCanPromote = PlainAllow extends InstitutionSectionAllowV1
      ? true
      : false;

    expectTypeOf<CallerInput>().toEqualTypeOf<InstitutionSectionGuardInputV1>();
    expectTypeOf<ForbiddenCallerKeys>().toEqualTypeOf<never>();
    expectTypeOf<PlainGuardCanPromote>().toEqualTypeOf<false>();
    expectTypeOf<PlainAllowCanPromote>().toEqualTypeOf<false>();
  });

  it.each(LOOKALIKE_KINDS)(
    'rejects a %s scope guard lookalike without property access or invocation',
    async (kind) => {
      const authentic = genuineScopeGuard();
      const lookalike = scopeLookalike(kind, authentic);
      const guard = createInstitutionSectionGuardV1({
        scopeGuard: lookalike.value as InstitutionScopeGuardV1,
        referenceCodec: genuineUnavailableCodec(),
        now: () => SECTION_NOW,
      });
      await expect(guard.authorizeCurrentSection({ sectionId: 'workbench' })).resolves.toEqual({
        kind: 'rejected',
        code: 'scope_unavailable',
      });
      expect(lookalike.fakeMethod).not.toHaveBeenCalled();
      expect(lookalike.getterReads()).toBe(0);
      expect(lookalike.traps()).toBe(0);
    },
  );

  it.each(['extra', 'accessor', 'proxy', 'revoked_proxy'] as const)(
    'rejects a %s factory input before reading or invoking dependencies',
    async (kind) => {
      const scopeGuard = genuineScopeGuard();
      const { codec, issue, verify } = controlledCodec();
      const now = vi.fn(() => SECTION_NOW);
      let getterReads = 0;
      let traps = 0;
      let value: object;
      if (kind === 'extra') {
        value = { scopeGuard, referenceCodec: codec, now, policyRevision: reference('prv') };
      } else if (kind === 'accessor') {
        value = { referenceCodec: codec, now };
        Object.defineProperty(value, 'scopeGuard', {
          enumerable: true,
          get() { getterReads += 1; return scopeGuard; },
        });
      } else if (kind === 'proxy') {
        value = new Proxy({ scopeGuard, referenceCodec: codec, now }, {
          get() { traps += 1; throw new Error('trap'); },
          getPrototypeOf() { traps += 1; throw new Error('trap'); },
          getOwnPropertyDescriptor() { traps += 1; throw new Error('trap'); },
          ownKeys() { traps += 1; throw new Error('trap'); },
        });
      } else {
        const revocable = Proxy.revocable({ scopeGuard, referenceCodec: codec, now }, {});
        revocable.revoke();
        value = revocable.proxy;
      }
      const guard = createInstitutionSectionGuardV1(value as never);
      expect(isInstitutionSectionGuardV1(guard)).toBe(true);
      await expect(guard.authorizeCurrentSection({ sectionId: 'workbench' })).resolves.toEqual({
        kind: 'rejected',
        code: 'scope_unavailable',
      });
      expect(getterReads).toBe(0);
      expect(traps).toBe(0);
      expect(now).not.toHaveBeenCalled();
      expect(issue).not.toHaveBeenCalled();
      expect(verify).not.toHaveBeenCalled();
    },
  );

  it.each(['extra', 'symbol', 'custom_proto', 'accessor', 'proxy', 'revoked_proxy'] as const)(
    'rejects %s authorize input without promoting caller fields',
    async (kind) => {
      let reads = 0;
      let traps = 0;
      let value: object;
      if (kind === 'extra') value = { sectionId: 'workbench', tenantId: 'tenant-a' };
      else if (kind === 'symbol') value = { sectionId: 'workbench', [Symbol('raw')]: true };
      else if (kind === 'custom_proto') {
        value = Object.assign(Object.create({ role: 'tenant_admin' }), { sectionId: 'workbench' });
      } else if (kind === 'accessor') {
        value = {};
        Object.defineProperty(value, 'sectionId', {
          enumerable: true,
          get() { reads += 1; return 'workbench'; },
        });
      } else if (kind === 'proxy') {
        value = new Proxy({ sectionId: 'workbench' }, {
          get() { traps += 1; throw new Error('trap'); },
          getPrototypeOf() { traps += 1; throw new Error('trap'); },
          getOwnPropertyDescriptor() { traps += 1; throw new Error('trap'); },
          ownKeys() { traps += 1; throw new Error('trap'); },
        });
      } else {
        const revocable = Proxy.revocable({ sectionId: 'workbench' }, {});
        revocable.revoke();
        value = revocable.proxy;
      }
      const { guard } = sectionHarness('tenant_admin', {
        referenceCodec: genuineUnavailableCodec(),
      });
      await expect(guard.authorizeCurrentSection(value as never)).resolves.toEqual({
        kind: 'rejected',
        code: 'action_unregistered',
      });
      expect(reads).toBe(0);
      expect(traps).toBe(0);
    },
  );

  it.each([
    'provenance',
    'membership',
    'anchor',
    'scopeAllow',
    'role',
    'policyRevision',
    'tenantId',
    'institutionId',
  ] as const)('rejects caller-controlled %s without a policy call', async (key) => {
    const { guard } = sectionHarness('tenant_admin', {
      referenceCodec: genuineUnavailableCodec(),
    });
    await expect(
      guard.authorizeCurrentSection({ sectionId: 'workbench', [key]: 'caller-value' } as never),
    ).resolves.toEqual({ kind: 'rejected', code: 'action_unregistered' });
  });

  it('calls scope first and does not inspect caller input or policy after scope rejection', async () => {
    const scopeGuard = createInstitutionScopeGuardV1({} as never);
    let getterReads = 0;
    const input = {};
    Object.defineProperty(input, 'sectionId', {
      enumerable: true,
      get() {
        getterReads += 1;
        return 'workbench';
      },
    });
    const secondNow = vi.fn(() => SECTION_NOW);
    const { guard } = sectionHarness('tenant_admin', {
      scopeGuard,
      referenceCodec: genuineUnavailableCodec(),
      now: secondNow,
    });
    await expect(guard.authorizeCurrentSection(input as never)).resolves.toEqual({
      kind: 'rejected',
      code: 'scope_unavailable',
    });
    expect(getterReads).toBe(0);
    expect(secondNow).not.toHaveBeenCalled();
  });

  it('issues a prv that verifies only with the exact private manifest input', async () => {
    const { guard, referenceCodec } = sectionHarness();
    const result = await guard.authorizeCurrentSection({ sectionId: 'workbench' });
    expect(result).toMatchObject({
      kind: 'institution_section_allow',
      policyRevision: expect.stringMatching(/^prv_v1_k1_[A-Za-z0-9_-]{43}$/u),
    });
    if (result.kind !== 'institution_section_allow') {
      throw new Error('expected section allow fixture');
    }
    const exactInput: InstitutionGuardReferenceInputV1<'prv'> = {
      prefix: 'prv',
      ownerDomain: 'security.institution-section-policy',
      tenantId: null,
      institutionId: null,
      ownerSubject: expectedPolicyOwnerSubject(),
    };
    expect(
      referenceCodec.verify({
        ...exactInput,
        reference: result.policyRevision,
      }),
    ).toEqual({
      kind: 'verified',
      reference: result.policyRevision,
    });
    expect(
      referenceCodec.verify({
        ...exactInput,
        ownerDomain: 'security.institution-section-policy.other',
        reference: result.policyRevision,
      }),
    ).toEqual({ kind: 'rejected', code: 'guard_reference_invalid' });
  });

  it.each([
    ['issue unavailable', () => Object.freeze({ kind: 'unavailable', code: 'guard_reference_unavailable' }), undefined],
    ['issue throws', () => { throw new Error('issue'); }, undefined],
    ['verify unavailable', undefined, () => Object.freeze({ kind: 'unavailable', code: 'guard_reference_unavailable' })],
    ['verify throws', undefined, () => { throw new Error('verify'); }],
    ['verify mismatch', undefined, () => Object.freeze({ kind: 'verified', reference: reference('prv').replace(/A$/u, 'B') })],
  ] as const)(
    'rejects an unauthentic codec before simulated policy %s',
    async (_label, issueOverride, verifyOverride) => {
      const normal = controlledCodec();
      const issue = vi.fn(issueOverride ?? normal.issue);
      const verify = vi.fn(verifyOverride ?? normal.verify);
      const codec = Object.freeze({
        issue,
        verify,
      }) as unknown as InstitutionGuardReferenceCodecV1;
      const scope = genuineScopeComposition();
      const secondNow = vi.fn(() => SECTION_NOW);
      const guard = createInstitutionSectionGuardV1({
        scopeGuard: scope.guard,
        referenceCodec: codec,
        now: secondNow,
      });
      await expect(
        guard.authorizeCurrentSection({ sectionId: 'workbench' }),
      ).resolves.toEqual({
        kind: 'rejected',
        code: 'policy_unavailable',
      });
      expect(issue).not.toHaveBeenCalled();
      expect(verify).not.toHaveBeenCalled();
      expect(scope.downstream.provenanceNow).not.toHaveBeenCalled();
      expect(scope.downstream.resolveMembershipFact).not.toHaveBeenCalled();
      expect(scope.downstream.resolveAnchorFact).not.toHaveBeenCalled();
      expect(secondNow).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['expired', () => new Date('2026-07-22T08:01:00.000Z')],
    ['clock rollback', () => new Date('2026-07-22T08:00:29.999Z')],
    ['clock throws', () => { throw new Error('clock'); }],
  ] as const)('fails closed when the second trusted clock is %s', async (_label, now) => {
    const { guard } = sectionHarness('tenant_admin', { now });
    await expect(guard.authorizeCurrentSection({ sectionId: 'workbench' })).resolves.toEqual({
      kind: 'rejected',
      code: 'scope_unavailable',
    });
  });

  it.each([
    {
      deadlineName: 'provenanceValidUntil',
      deadline: '2026-07-22T08:00:45.000Z',
      timing: {
        provenanceValidUntil: '2026-07-22T08:00:45.000Z',
        membershipObservedAt: '2026-07-22T08:00:30.000Z',
        anchorObservedAt: '2026-07-22T08:00:30.000Z',
      },
    },
    {
      deadlineName: 'membershipFreshUntil',
      deadline: '2026-07-22T08:01:00.000Z',
      timing: {
        membershipObservedAt: '2026-07-22T08:00:00.000Z',
        anchorObservedAt: '2026-07-22T08:00:30.000Z',
      },
    },
    {
      deadlineName: 'anchorFreshUntil',
      deadline: '2026-07-22T08:01:00.000Z',
      timing: {
        membershipObservedAt: '2026-07-22T08:00:30.000Z',
        anchorObservedAt: '2026-07-22T08:00:00.000Z',
      },
    },
  ] as const)(
    'rejects equality and allows just-before for $deadlineName without extending scope TTL',
    async ({ deadline, timing }) => {
      const equalityGuard = sectionHarness('tenant_admin', {
        scopeGuard: genuineScopeGuard('tenant_admin', timing),
        now: () => new Date(deadline),
      }).guard;
      await expect(
        equalityGuard.authorizeCurrentSection({ sectionId: 'workbench' }),
      ).resolves.toEqual({ kind: 'rejected', code: 'scope_unavailable' });

      const justBefore = new Date(Date.parse(deadline) - 1);
      const justBeforeGuard = sectionHarness('tenant_admin', {
        scopeGuard: genuineScopeGuard('tenant_admin', timing),
        now: () => justBefore,
      }).guard;
      const result = await justBeforeGuard.authorizeCurrentSection({
        sectionId: 'workbench',
      });
      expect(result).toMatchObject({
        kind: 'institution_section_allow',
        decidedAt: justBefore.toISOString(),
        validUntil: deadline,
      });
      expect(Date.parse((result as InstitutionSectionAllowV1).validUntil)).toBe(
        Date.parse(deadline),
      );
    },
  );

  it('brands only factory guards and returned allows without property reads', async () => {
    const { guard } = sectionHarness();
    expect(isInstitutionSectionGuardV1(guard)).toBe(true);
    expect(isInstitutionSectionGuardV1({ ...guard })).toBe(false);
    const result = await guard.authorizeCurrentSection({ sectionId: 'workbench' });
    expect(isInstitutionSectionAllowV1(result)).toBe(true);
    expect(isInstitutionSectionAllowV1({ ...(result as InstitutionSectionAllowV1) })).toBe(false);
    expect(result).not.toHaveProperty('scopeAllow');
    expect(result).not.toHaveProperty('tenantId');
    expect(result).not.toHaveProperty('institutionId');
    expect(result).not.toHaveProperty('role');

    let traps = 0;
    const proxy = new Proxy({}, { get() { traps += 1; throw new Error('trap'); } });
    expect(isInstitutionSectionGuardV1(proxy)).toBe(false);
    expect(isInstitutionSectionAllowV1(proxy)).toBe(false);
    expect(traps).toBe(0);
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(isInstitutionSectionGuardV1(revoked.proxy)).toBe(false);
    expect(isInstitutionSectionAllowV1(revoked.proxy)).toBe(false);
  });

  it('keeps the runtime surface free of register, parser, rehydrate, promotion, and raw bypasses', async () => {
    const runtime = await import('@/modules/security/server/institution-section-guard');
    expect(Object.keys(runtime).sort()).toEqual([
      'INSTITUTION_SECTION_GUARD_FAILURE_CODES_V1',
      'createInstitutionSectionGuardV1',
      'isInstitutionNavigationAuthorizationV1',
      'isInstitutionSectionAllowV1',
      'isInstitutionSectionGuardV1',
    ]);
  });

  it('publishes only controlled low-sensitivity failure codes', () => {
    expect(INSTITUTION_SECTION_GUARD_FAILURE_CODES_V1).toEqual([
      'scope_unavailable',
      'action_unregistered',
      'action_role_denied',
      'policy_unavailable',
    ]);
  });
});

describe('BASE-NAV-01 canonical visible navigation authorization', () => {
  const managementSections = INSTITUTION_NAVIGATION_SECTION_IDS_V1;
  const frontlineSections = Object.freeze([
    'workbench',
    'customers',
    'conversations',
    'care',
  ] as const satisfies readonly InstitutionNavigationSectionIdV1[]);

  it.each([
    ['tenant_admin', 'system', 'allowed', managementSections],
    ['tenant_operator', 'knowledge', 'allowed', managementSections],
    ['consultant', 'care', 'allowed', frontlineSections],
    ['customer_service', 'analytics', 'blocked', frontlineSections],
  ] as const)(
    'returns one frozen canonical decision for %s targeting %s',
    async (role, targetSectionId, targetAccess, availableSectionIds) => {
      const scope = genuineScopeComposition(role);
      const guard = sectionHarness(role, { scopeGuard: scope.guard }).guard;

      const decision = await guard.authorizeCurrentNavigation({
        targetSectionId,
      });

      expect(decision).toEqual({
        kind: 'institution_navigation_authorization',
        targetSectionId,
        targetAccess,
        availableSectionIds,
      });
      expect(isInstitutionNavigationAuthorizationV1(decision)).toBe(true);
      expect(Object.isFrozen(decision)).toBe(true);
      expect(Object.isFrozen(decision.availableSectionIds)).toBe(true);
      expect(new Set(decision.availableSectionIds).size).toBe(
        decision.availableSectionIds.length,
      );
      expect(scope.downstream.resolveMembershipFact).toHaveBeenCalledTimes(4);
      expect(scope.downstream.resolveAnchorFact).toHaveBeenCalledTimes(2);
      expect(Object.keys(decision)).toEqual([
        'kind',
        'targetSectionId',
        'targetAccess',
        'availableSectionIds',
      ]);
    },
  );

  it('accepts only exact targetSectionId input and keeps the old method compatible', async () => {
    expectTypeOf<InstitutionNavigationAuthorizationInputV1>().toEqualTypeOf<
      Readonly<{ targetSectionId: InstitutionNavigationSectionIdV1 }>
    >();
    type NavigationInput = Parameters<
      InstitutionSectionGuardV1['authorizeCurrentNavigation']
    >[0];
    expectTypeOf<keyof NavigationInput>().toEqualTypeOf<'targetSectionId'>();

    const invalidGuard = sectionHarness().guard;
    await expect(
      invalidGuard.authorizeCurrentNavigation({
        targetSectionId: 'system',
        role: 'tenant_admin',
      } as never),
    ).resolves.toEqual({
      kind: 'institution_navigation_authorization',
      targetSectionId: null,
      targetAccess: 'blocked',
      availableSectionIds: [],
    });

    const oldGuard = sectionHarness().guard;
    await expect(
      oldGuard.authorizeCurrentSection({ sectionId: 'workbench' }),
    ).resolves.toMatchObject({
      kind: 'institution_section_allow',
      sectionId: 'workbench',
    });
  });

  it.each([
    [
      'scope rejection',
      createInstitutionScopeGuardV1({} as never),
      genuineCodec(),
      () => SECTION_NOW,
    ],
    [
      'expired scope',
      genuineScopeGuard(),
      genuineCodec(),
      () => new Date('2026-07-22T08:01:00.000Z'),
    ],
    [
      'trusted clock exception',
      genuineScopeGuard(),
      genuineCodec(),
      () => {
        throw new Error('navigation clock');
      },
    ],
    ['policy', genuineScopeGuard(), genuineUnavailableCodec(), () => SECTION_NOW],
  ] as const)(
    'fails closed with empty navigation when %s is unavailable',
    async (_label, scopeGuard, referenceCodec, now) => {
      const guard = sectionHarness('tenant_admin', {
        scopeGuard,
        referenceCodec,
        now,
      }).guard;
      const decision = await guard.authorizeCurrentNavigation({
        targetSectionId: 'workbench',
      });

      expect(decision).toEqual({
        kind: 'institution_navigation_authorization',
        targetSectionId: 'workbench',
        targetAccess: 'blocked',
        availableSectionIds: [],
      });
      expect(isInstitutionNavigationAuthorizationV1(decision)).toBe(true);
    },
  );

  it('spends one guard once across both methods and cannot concatenate navigation grants', async () => {
    const scope = genuineScopeComposition('tenant_admin');
    const guard = sectionHarness('tenant_admin', { scopeGuard: scope.guard }).guard;

    await expect(
      guard.authorizeCurrentNavigation({ targetSectionId: 'workbench' }),
    ).resolves.toMatchObject({ targetAccess: 'allowed' });
    await expect(
      guard.authorizeCurrentNavigation({ targetSectionId: 'system' }),
    ).resolves.toEqual({
      kind: 'institution_navigation_authorization',
      targetSectionId: 'system',
      targetAccess: 'blocked',
      availableSectionIds: [],
    });
    await expect(
      guard.authorizeCurrentSection({ sectionId: 'workbench' }),
    ).resolves.toEqual({ kind: 'rejected', code: 'scope_unavailable' });
    expect(scope.downstream.resolveMembershipFact).toHaveBeenCalledTimes(4);
    expect(scope.downstream.resolveAnchorFact).toHaveBeenCalledTimes(2);
  });

  it('recognizes only genuine decisions without reading hostile values', async () => {
    const genuine = await sectionHarness().guard.authorizeCurrentNavigation({
      targetSectionId: 'workbench',
    });
    let getterReads = 0;
    let traps = 0;
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, 'targetAccess', {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error('decision getter must not run');
      },
    });
    const handler: ProxyHandler<object> = {
      get() {
        traps += 1;
        throw new Error('decision get trap must not run');
      },
      getPrototypeOf() {
        traps += 1;
        throw new Error('decision prototype trap must not run');
      },
    };
    const proxy = new Proxy(genuine, handler);
    const revoked = Proxy.revocable(genuine, handler);
    revoked.revoke();

    for (const value of [
      {},
      Object.freeze({
        kind: 'institution_navigation_authorization',
        targetSectionId: 'system',
        targetAccess: 'allowed',
        availableSectionIds: Object.freeze(['system']),
      }),
      { ...genuine },
      Object.create(genuine) as object,
      accessor,
      proxy,
      revoked.proxy,
    ]) {
      expect(isInstitutionNavigationAuthorizationV1(value)).toBe(false);
    }
    expect(getterReads).toBe(0);
    expect(traps).toBe(0);
    expectTypeOf<{
      kind: 'institution_navigation_authorization';
      targetSectionId: InstitutionNavigationSectionIdV1 | null;
      targetAccess: 'allowed' | 'blocked';
      availableSectionIds: readonly InstitutionNavigationSectionIdV1[];
    }>().not.toMatchTypeOf<InstitutionNavigationAuthorizationV1>();
  });
});

describe('BASE-B4 section/object responsibility boundary', () => {
  it('keeps Object Guard and Action Policy outside Section Guard', async () => {
    const sectionGuardModule =
      await import('@/modules/security/server/institution-section-guard');

    expect(
      'createInstitutionObjectGuardV1' in sectionGuardModule,
    ).toBe(false);
    expect(
      'createInstitutionActionPolicyV1' in sectionGuardModule,
    ).toBe(false);
    expect(
      'authorizeCurrentInstitutionObjectV1' in sectionGuardModule,
    ).toBe(false);
  });
});
