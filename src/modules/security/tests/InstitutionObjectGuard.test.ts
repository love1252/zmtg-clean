import { describe, expect, expectTypeOf, it, vi } from 'vitest';

const scopeProvenance = vi.hoisted(() => ({
  guards: new WeakSet<object>(),
  allows: new WeakSet<object>(),
}));

vi.mock(
  '@/modules/security/server/institution-scope-guard',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/modules/security/server/institution-scope-guard')
    >();
    return {
      ...actual,
      isInstitutionScopeGuardV1(value: unknown) {
        return (
          value !== null &&
          typeof value === 'object' &&
          scopeProvenance.guards.has(value)
        );
      },
      isInstitutionScopeAllowV1(value: unknown) {
        return (
          value !== null &&
          typeof value === 'object' &&
          scopeProvenance.allows.has(value)
        );
      },
    };
  },
);

import type { InstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { createInstitutionActionPolicyV1 } from '@/modules/security/server/institution-action-policy';
import {
  createInstitutionObjectFactReaderV1,
  createInstitutionObjectGuardV1,
  isInstitutionObjectActionAllowV1,
  isInstitutionObjectFactReaderV1,
  isInstitutionObjectGuardV1,
  type InstitutionObjectAuthorizationInputV1,
} from '@/modules/security/server/institution-object-guard';
import type {
  InstitutionScopeAllowV1,
  InstitutionScopeGuardV1,
} from '@/modules/security/server/institution-scope-guard';

const NOW = new Date('2026-08-03T12:00:30.000Z');

function scopeAllow(
  role: InstitutionRoleV1 = 'tenant_admin',
): InstitutionScopeAllowV1 {
  const value = Object.freeze({
    kind: 'institution_scope_allow',
    requestReference: 'request-ref',
    userReference: 'user-ref',
    role,
    source: 'server_session',
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    membershipRevision: 'membership-revision',
    bindingRevision: 'binding-revision',
    anchorRevision: 'anchor-revision',
    provenanceValidUntil: '2026-08-03T12:04:00.000Z',
    membershipFreshUntil: '2026-08-03T12:01:00.000Z',
    anchorFreshUntil: '2026-08-03T12:01:00.000Z',
    decidedAt: '2026-08-03T12:00:20.000Z',
    validUntil: '2026-08-03T12:01:00.000Z',
  }) as unknown as InstitutionScopeAllowV1;
  scopeProvenance.allows.add(value as object);
  return value;
}

function scopeGuard(
  role: InstitutionRoleV1 = 'tenant_admin',
): InstitutionScopeGuardV1 {
  const value = Object.freeze({
    authorizeCurrentRequest: vi.fn(async () => scopeAllow(role)),
  }) as unknown as InstitutionScopeGuardV1;
  scopeProvenance.guards.add(value as object);
  return value;
}

function reader(
  overrides: Partial<{
    tenantId: string;
    institutionId: string;
    status: 'active' | 'inactive';
    revision: number;
    observedAt: string;
  }> = {},
) {
  return createInstitutionObjectFactReaderV1({
    resolve: vi.fn(async (query) => ({
      kind: 'current_object_fact' as const,
      objectType: query.objectType,
      objectId: query.objectId,
      tenantId: overrides.tenantId ?? query.tenantId,
      institutionId: overrides.institutionId ?? query.institutionId,
      status: overrides.status ?? 'active',
      revision: overrides.revision ?? 7,
      observedAt:
        overrides.observedAt ?? '2026-08-03T12:00:00.000Z',
    })),
  });
}

function guard(input: Readonly<{
  role?: InstitutionRoleV1;
  objectReader?: ReturnType<typeof reader> | null;
}> = {}) {
  return createInstitutionObjectGuardV1({
    scopeGuard: scopeGuard(input.role),
    objectFactReader:
      input.objectReader === undefined ? reader() : input.objectReader,
    actionPolicy: createInstitutionActionPolicyV1({}),
    now: () => new Date(NOW.getTime()),
  });
}

const customerRead = Object.freeze({
  objectType: 'customer' as const,
  objectId: 'customer-a',
  action: 'read' as const,
});

describe('BASE-B4 institution object guard', () => {
  it('seals exact inputs and emits a low-sensitive genuine allow', async () => {
    expectTypeOf<keyof InstitutionObjectAuthorizationInputV1>()
      .toEqualTypeOf<'objectType' | 'objectId' | 'action'>();

    const objectReader = reader();
    expect(isInstitutionObjectFactReaderV1(objectReader)).toBe(true);

    const objectGuard = guard({ objectReader });
    expect(isInstitutionObjectGuardV1(objectGuard)).toBe(true);

    const result =
      await objectGuard.authorizeCurrentObjectAction(customerRead);
    expect(isInstitutionObjectActionAllowV1(result)).toBe(true);
    expect(result).toEqual({
      kind: 'institution_object_action_allow',
      objectType: 'customer',
      action: 'read',
      objectRevision: 7,
      decidedAt: NOW.toISOString(),
      validUntil: '2026-08-03T12:01:00.000Z',
    });
    expect(JSON.stringify(result)).not.toContain('customer-a');
    expect(JSON.stringify(result)).not.toContain('tenant-a');
  });

  it('keeps capability off without a genuine business Owner reader', async () => {
    await expect(
      guard({ objectReader: null }).authorizeCurrentObjectAction(
        customerRead,
      ),
    ).resolves.toEqual({
      kind: 'rejected',
      code: 'object_unavailable',
    });
  });

  it.each([
    [
      'inactive',
      reader({ status: 'inactive' }),
      'tenant_admin',
      customerRead,
      'object_denied',
    ],
    [
      'cross tenant',
      reader({ tenantId: 'tenant-other' }),
      'tenant_admin',
      customerRead,
      'object_invalid',
    ],
    [
      'stale',
      reader({ observedAt: '2026-08-03T11:59:00.000Z' }),
      'tenant_admin',
      customerRead,
      'object_stale',
    ],
    [
      'role denied',
      reader(),
      'customer_service',
      {
        objectType: 'knowledge_item',
        objectId: 'knowledge-a',
        action: 'update',
      },
      'action_role_denied',
    ],
    [
      'unregistered',
      reader(),
      'tenant_admin',
      {
        objectType: 'customer',
        objectId: 'customer-a',
        action: 'approve',
      },
      'action_unregistered',
    ],
  ] as const)(
    'fails closed for %s',
    async (_label, objectReader, role, input, code) => {
      await expect(
        guard({ objectReader, role }).authorizeCurrentObjectAction(input),
      ).resolves.toEqual({ kind: 'rejected', code });
    },
  );

  it('rejects malformed public inputs and structural reader copies', async () => {
    const genuineReader = reader();
    const objectGuard = guard({ objectReader: genuineReader });

    await expect(
      objectGuard.authorizeCurrentObjectAction({
        ...customerRead,
        unexpected: true,
      } as never),
    ).resolves.toEqual({
      kind: 'rejected',
      code: 'action_unregistered',
    });

    const fakeReader = { ...genuineReader };
    expect(isInstitutionObjectFactReaderV1(fakeReader)).toBe(false);
    await expect(
      guard({
        objectReader: fakeReader as never,
      }).authorizeCurrentObjectAction(customerRead),
    ).resolves.toEqual({
      kind: 'rejected',
      code: 'object_unavailable',
    });
  });
});
