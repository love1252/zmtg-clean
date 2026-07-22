import { createHash } from 'node:crypto';

import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  INSTITUTION_NAVIGATION_SECTION_IDS_V1,
  INSTITUTION_ROLES_V1,
  type InstitutionNavigationSectionIdV1,
  type InstitutionRoleV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import {
  createActiveInstitutionAnchorProviderV1,
  type AuthoritativeInstitutionAnchorFactReaderV1,
} from '@/modules/security/server/institution-anchor-provider';
import {
  createFormalRequestProvenanceResolverV1,
  type FormalRequestProvenanceOwnerInputV1,
} from '@/modules/security/server/formal-request-provenance-owner';
import type {
  InstitutionGuardReferenceCodecV1,
  InstitutionGuardReferenceInputV1,
  InstitutionGuardReferenceOwnerSubjectV1,
} from '@/modules/security/server/institution-guard-reference';
import {
  createRequestBoundFreshActiveMembershipProviderV1,
  type AuthoritativeInstitutionMembershipFactReaderV1,
} from '@/modules/security/server/institution-membership-provider';
import {
  createInstitutionScopeGuardV1,
  type InstitutionScopeGuardV1,
} from '@/modules/security/server/institution-scope-guard';
import {
  createInstitutionSectionGuardV1,
  INSTITUTION_SECTION_GUARD_FAILURE_CODES_V1,
  isInstitutionSectionAllowV1,
  isInstitutionSectionGuardV1,
  type InstitutionSectionAllowV1,
  type InstitutionSectionGuardInputV1,
  type InstitutionSectionGuardV1,
} from '@/modules/security/server/institution-section-guard';

const SCOPE_NOW = new Date('2026-07-22T08:00:30.000Z');
const SECTION_NOW = new Date('2026-07-22T08:00:31.000Z');
const TOKEN = 'A'.repeat(43);

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

type ScopeTimingOptions = Readonly<{
  provenanceValidUntil?: string;
  membershipObservedAt?: string;
  anchorObservedAt?: string;
}>;

function genuineScopeGuard(
  role: InstitutionRoleV1 = 'tenant_admin',
  timing: ScopeTimingOptions = {},
) {
  const provenanceCodec = controlledCodec().codec;
  const membershipCodec = controlledCodec().codec;
  const anchorCodec = controlledCodec().codec;
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
    now: () => new Date('2026-07-22T07:59:01.000Z'),
  });
  const membershipProvider = createRequestBoundFreshActiveMembershipProviderV1({
    accountId: 'account-a',
    factReader: Object.freeze({
      resolve: vi.fn(async () =>
        Object.freeze({
          kind: 'current_membership_fact',
          accountId: 'account-a',
          tenantId: 'tenant-a',
          institutionId: 'institution-a',
          role,
          membershipId: 'membership-a',
          membershipRevisionAt: '2026-07-22T07:58:00.000Z',
          bindingId: 'binding-a',
          bindingRevision: 7,
          bindingRevisionAt: '2026-07-01T00:00:00.000Z',
          bindingExpiresAt: null,
          observedAt:
            timing.membershipObservedAt ?? '2026-07-22T08:00:00.000Z',
        }),
      ),
    }) as AuthoritativeInstitutionMembershipFactReaderV1,
    referenceCodec: membershipCodec,
    now: () => SCOPE_NOW,
  });
  const anchorProvider = createActiveInstitutionAnchorProviderV1({
    factReader: Object.freeze({
      resolve: vi.fn(async () =>
        Object.freeze({
          kind: 'current_anchor_fact',
          tenantId: 'tenant-a',
          institutionId: 'institution-a',
          revision: 7,
          observedAt: timing.anchorObservedAt ?? '2026-07-22T08:00:00.000Z',
        }),
      ),
    }) as AuthoritativeInstitutionAnchorFactReaderV1,
    referenceCodec: anchorCodec,
    now: () => SCOPE_NOW,
  });
  return createInstitutionScopeGuardV1({
    provenanceResolver,
    membershipProvider,
    anchorProvider,
    now: () => SCOPE_NOW,
  });
}

function sectionHarness(
  role: InstitutionRoleV1 = 'tenant_admin',
  options: Readonly<{
    scopeGuard?: InstitutionScopeGuardV1;
    referenceCodec?: InstitutionGuardReferenceCodecV1;
    now?: () => Date;
  }> = {},
) {
  const policy = controlledCodec();
  const guard = createInstitutionSectionGuardV1({
    scopeGuard: options.scopeGuard ?? genuineScopeGuard(role),
    referenceCodec: options.referenceCodec ?? policy.codec,
    now: options.now ?? (() => SECTION_NOW),
  });
  return { guard, policy };
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

describe('WB-BASE-SECTION-GUARD-04A', () => {
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
      const { codec, issue, verify } = controlledCodec();
      const guard = createInstitutionSectionGuardV1({
        scopeGuard: lookalike.value as InstitutionScopeGuardV1,
        referenceCodec: codec,
        now: () => SECTION_NOW,
      });
      await expect(guard.authorizeCurrentSection({ sectionId: 'workbench' })).resolves.toEqual({
        kind: 'rejected',
        code: 'scope_unavailable',
      });
      expect(lookalike.fakeMethod).not.toHaveBeenCalled();
      expect(lookalike.getterReads()).toBe(0);
      expect(lookalike.traps()).toBe(0);
      expect(issue).not.toHaveBeenCalled();
      expect(verify).not.toHaveBeenCalled();
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
      const { guard, policy } = sectionHarness();
      await expect(guard.authorizeCurrentSection(value as never)).resolves.toEqual({
        kind: 'rejected',
        code: 'action_unregistered',
      });
      expect(reads).toBe(0);
      expect(traps).toBe(0);
      expect(policy.issue).not.toHaveBeenCalled();
      expect(policy.verify).not.toHaveBeenCalled();
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
    const { guard, policy } = sectionHarness();
    await expect(
      guard.authorizeCurrentSection({ sectionId: 'workbench', [key]: 'caller-value' } as never),
    ).resolves.toEqual({ kind: 'rejected', code: 'action_unregistered' });
    expect(policy.issue).not.toHaveBeenCalled();
    expect(policy.verify).not.toHaveBeenCalled();
  });

  it('calls scope first and does not inspect caller input or policy after scope rejection', async () => {
    const scopeGuard = createInstitutionScopeGuardV1({} as never);
    const { codec, issue, verify } = controlledCodec();
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
      referenceCodec: codec,
      now: secondNow,
    });
    await expect(guard.authorizeCurrentSection(input as never)).resolves.toEqual({
      kind: 'rejected',
      code: 'scope_unavailable',
    });
    expect(getterReads).toBe(0);
    expect(secondNow).not.toHaveBeenCalled();
    expect(issue).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it('issues and verifies one prv with the exact same private manifest input', async () => {
    const { guard, policy } = sectionHarness();
    const result = await guard.authorizeCurrentSection({ sectionId: 'workbench' });
    expect(result).toMatchObject({ kind: 'institution_section_allow', policyRevision: reference('prv') });
    expect(policy.issue).toHaveBeenCalledTimes(1);
    expect(policy.verify).toHaveBeenCalledTimes(1);
    const issuedInput = policy.issue.mock.calls[0]?.[0] as InstitutionGuardReferenceInputV1<'prv'>;
    const verifiedInput = policy.verify.mock.calls[0]?.[0] as InstitutionGuardReferenceInputV1<'prv'> & {
      reference: string;
    };
    expect(issuedInput).toMatchObject({
      prefix: 'prv',
      ownerDomain: 'security.institution-section-policy',
      tenantId: null,
      institutionId: null,
    });
    expect(issuedInput.ownerSubject).toBe(expectedPolicyOwnerSubject());
    expect(verifiedInput).toEqual({ ...issuedInput, reference: reference('prv') });
  });

  it.each([
    ['issue unavailable', () => Object.freeze({ kind: 'unavailable', code: 'guard_reference_unavailable' }), undefined],
    ['issue throws', () => { throw new Error('issue'); }, undefined],
    ['verify unavailable', undefined, () => Object.freeze({ kind: 'unavailable', code: 'guard_reference_unavailable' })],
    ['verify throws', undefined, () => { throw new Error('verify'); }],
    ['verify mismatch', undefined, () => Object.freeze({ kind: 'verified', reference: reference('prv').replace(/A$/u, 'B') })],
  ] as const)('fails atomically when policy %s', async (_label, issueOverride, verifyOverride) => {
    const normal = controlledCodec();
    const codec = Object.freeze({
      issue: vi.fn(issueOverride ?? normal.issue),
      verify: vi.fn(verifyOverride ?? normal.verify),
    }) as unknown as InstitutionGuardReferenceCodecV1;
    const { guard } = sectionHarness('tenant_admin', { referenceCodec: codec });
    await expect(guard.authorizeCurrentSection({ sectionId: 'workbench' })).resolves.toEqual({
      kind: 'rejected',
      code: 'policy_unavailable',
    });
  });

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
