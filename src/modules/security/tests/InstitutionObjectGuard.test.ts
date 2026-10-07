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
  timing: { decidedAt?: string; validUntil?: string } = {},
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
    decidedAt: timing.decidedAt ?? '2026-08-03T12:00:20.000Z',
    validUntil: timing.validUntil ?? '2026-08-03T12:01:00.000Z',
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


describe('异步对象授权使用最终决定时间', () => {
  function movingGuard(input: {
    scopeDelay?: number; objectDelay?: number; scopeTtl?: number;
    scopeFuture?: number; objectFuture?: number; rewind?: boolean; decisionDelay?: number;
    foreignInstitution?: boolean;
  } = {}) {
    let epochMs = NOW.getTime();
    let clockReads = 0;
    const scope = Object.freeze({ authorizeCurrentRequest: vi.fn(async () => {
      epochMs += input.scopeDelay ?? 10;
      return scopeAllow('tenant_admin', {
        decidedAt: new Date(epochMs + (input.scopeFuture ?? 0)).toISOString(),
        validUntil: new Date(epochMs + (input.scopeTtl ?? 30_000)).toISOString(),
      });
    }) }) as unknown as InstitutionScopeGuardV1;
    scopeProvenance.guards.add(scope as object);
    const resolve = vi.fn(async (query: { objectType: 'customer' | 'care_task' | 'conversation' | 'knowledge_item'; objectId: string; tenantId: string; institutionId: string }) => {
      const observedAt = new Date(epochMs + (input.objectFuture ?? 0)).toISOString();
      epochMs += input.objectDelay ?? 25;
      if (input.rewind) epochMs = NOW.getTime() - 1;
      return { kind: 'current_object_fact' as const, ...query, institutionId: input.foreignInstitution ? 'other' : query.institutionId, status: 'active' as const, revision: 7, observedAt };
    });
    const guard = createInstitutionObjectGuardV1({
      scopeGuard: scope, objectFactReader: createInstitutionObjectFactReaderV1({ resolve }),
      actionPolicy: createInstitutionActionPolicyV1({}), now: () => {
        clockReads++;
        if (clockReads === 4) epochMs += input.decisionDelay ?? 0;
        return new Date(epochMs);
      },
    });
    return { guard, resolve };
  }

  it('正常 scope 和对象异步读取产生的新 observedAt 不被误判为未来事实', async () => {
    const { guard } = movingGuard();
    const result = await guard.authorizeCurrentObjectAction(customerRead);
    expect(isInstitutionObjectActionAllowV1(result)).toBe(true);
    expect(result).toMatchObject({ decidedAt: '2026-08-03T12:00:30.035Z', validUntil: '2026-08-03T12:01:00.010Z' });
  });
  it('对象观察晚于授权开始但早于读取完成时仍合法', async () => {
    const { guard } = movingGuard({ scopeDelay: 0, objectFuture: 5 });
    const result = await guard.authorizeCurrentObjectAction(customerRead);
    expect(isInstitutionObjectActionAllowV1(result)).toBe(true);
    expect(result).toMatchObject({ decidedAt: '2026-08-03T12:00:30.025Z' });
  });
  it('签发前的最终时刻再次拒绝已经到期的作用域', async () => {
    const { guard } = movingGuard({ decisionDelay: 29_975 });
    expect(await guard.authorizeCurrentObjectAction(customerRead)).toEqual({ kind: 'rejected', code: 'scope_unavailable' });
  });
  it('签发前的最终时刻再次拒绝已经到期的对象事实', async () => {
    const { guard } = movingGuard({ scopeTtl: 120_000, decisionDelay: 59_975 });
    expect(await guard.authorizeCurrentObjectAction(customerRead)).toEqual({ kind: 'rejected', code: 'object_stale' });
  });
  it('对象读取期间 scope 到期时拒绝，不用旧起始时刻签发授权', async () => {
    const { guard } = movingGuard({ objectDelay: 30_000 });
    expect(await guard.authorizeCurrentObjectAction(customerRead)).toEqual({ kind: 'rejected', code: 'scope_unavailable' });
  });
  it('对象读取耗时越过事实 TTL 时拒绝，不延长对象新鲜度', async () => {
    const { guard } = movingGuard({ scopeTtl: 120_000, objectDelay: 60_000 });
    expect(await guard.authorizeCurrentObjectAction(customerRead)).toEqual({ kind: 'rejected', code: 'object_stale' });
  });
  it('作用域仍来自未来时拒绝且不查询对象', async () => {
    const { guard, resolve } = movingGuard({ scopeFuture: 1 });
    expect(await guard.authorizeCurrentObjectAction(customerRead)).toEqual({ kind: 'rejected', code: 'scope_unavailable' });
    expect(resolve).not.toHaveBeenCalled();
  });
  it('对象观察时间仍在最终时刻之后时拒绝', async () => {
    const { guard } = movingGuard({ objectFuture: 26 });
    expect(await guard.authorizeCurrentObjectAction(customerRead)).toEqual({ kind: 'rejected', code: 'object_invalid' });
  });
  it('读取期间时钟回退时拒绝', async () => {
    const { guard } = movingGuard({ rewind: true });
    expect(await guard.authorizeCurrentObjectAction(customerRead)).toEqual({ kind: 'rejected', code: 'scope_unavailable' });
  });
  it('递增时钟不改变跨机构对象拒绝', async () => {
    const { guard } = movingGuard({ foreignInstitution: true });
    expect(await guard.authorizeCurrentObjectAction(customerRead)).toEqual({ kind: 'rejected', code: 'object_invalid' });
  });
});
