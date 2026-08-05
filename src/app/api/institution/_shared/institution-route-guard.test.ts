import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  authorizations: new WeakSet<object>(),
  sectionAllows: new WeakSet<object>(),
  objectAllows: new WeakSet<object>(),
}));

vi.mock('@/modules/institution/server/institution-server-runtime', () => ({
  resolveInstitutionServerAuthorizationV1: mocks.resolveAuthorization,
}));
vi.mock('@/modules/security/server/institution-request-authorization', () => ({
  isInstitutionRequestAuthorizationV1(value: unknown) {
    return value !== null && typeof value === 'object' &&
      mocks.authorizations.has(value);
  },
}));
vi.mock('@/modules/security/server/institution-section-guard', () => ({
  isInstitutionSectionAllowV1(value: unknown) {
    return value !== null && typeof value === 'object' &&
      mocks.sectionAllows.has(value);
  },
}));
vi.mock('@/modules/security/server/institution-object-guard', () => ({
  isInstitutionObjectActionAllowV1(value: unknown) {
    return value !== null && typeof value === 'object' &&
      mocks.objectAllows.has(value);
  },
}));

import {
  withInstitutionObjectRouteGuardV1,
  withInstitutionSectionRouteGuardV1,
} from '@/app/api/institution/_shared/institution-route-guard';

function sectionAllow(
  sectionId: 'knowledge' | 'system' | 'customers',
) {
  const value = Object.freeze({
    kind: 'institution_section_allow' as const,
    sectionId,
  });
  mocks.sectionAllows.add(value);
  return value;
}

function objectAllow(
  objectType: 'customer' | 'knowledge_item' = 'customer',
  action: 'read' | 'update' = 'read',
) {
  const value = Object.freeze({
    kind: 'institution_object_action_allow' as const,
    objectType,
    action,
    objectRevision: 1,
    decidedAt: '2026-08-06T00:00:00.000Z',
    validUntil: '2026-08-06T00:00:30.000Z',
  });
  mocks.objectAllows.add(value);
  return value;
}

function authorization(input: Readonly<{
  section?: (value: unknown) => Promise<unknown>;
  object?: (value: unknown) => Promise<unknown>;
  action?: (value: unknown) => Promise<unknown>;
}> = {}) {
  const value = Object.freeze({
    authorizeCurrentInstitutionSectionV1:
      input.section ?? vi.fn(async () => sectionAllow('knowledge')),
    authorizeCurrentInstitutionObjectV1:
      input.object ?? vi.fn(async () => objectAllow()),
    authorizeCurrentInstitutionActionV1:
      input.action ?? vi.fn(async () => objectAllow()),
  });
  mocks.authorizations.add(value);
  return value;
}

async function expectSectionForbidden(response: Response) {
  expect(response.status).toBe(403);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual({
    error: 'institution_route_forbidden',
    code: 'institution_section_forbidden',
  });
}

async function expectObjectForbidden(response: Response) {
  expect(response.status).toBe(403);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual({
    error: 'institution_route_forbidden',
    code: 'institution_object_forbidden',
  });
}

describe('BASE-B4 institution Route Guard', () => {
  beforeEach(() => {
    mocks.resolveAuthorization.mockReset();
    mocks.authorizations = new WeakSet<object>();
    mocks.sectionAllows = new WeakSet<object>();
    mocks.objectAllows = new WeakSet<object>();
  });

  it('preserves the existing Section wrapper contract', async () => {
    const response = new Response('existing', { status: 207 });
    const handler = vi.fn(async () => response);
    const section = vi.fn(async () => sectionAllow('knowledge'));
    mocks.resolveAuthorization.mockResolvedValueOnce(
      authorization({ section }),
    );

    const guarded = withInstitutionSectionRouteGuardV1({
      sectionId: 'knowledge',
      handler,
    });
    expect(await guarded()).toBe(response);
    expect(section).toHaveBeenCalledWith({ sectionId: 'knowledge' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed Object factories before authorization', async () => {
    const resolver = vi.fn(async () => 'customer-001');
    const handler = vi.fn(async () => new Response('bad'));
    const guarded = withInstitutionObjectRouteGuardV1({
      sectionId: 'customers',
      objectType: 'unknown',
      action: 'read',
      resolveObjectId: resolver,
      handler,
    } as never);
    await expectObjectForbidden(await guarded());
    expect(mocks.resolveAuthorization).not.toHaveBeenCalled();
    expect(resolver).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it('checks Section before context access', async () => {
    const traps = { get: 0 };
    const context = new Proxy({}, {
      get() {
        traps.get += 1;
        throw new Error('context must not be read');
      },
    });
    const section = vi.fn(async () => ({
      kind: 'rejected',
      code: 'scope_unavailable',
    }));
    const resolver = vi.fn(
      async (_request: Request, value: { customerId: string }) =>
        value.customerId,
    );
    const handler = vi.fn(async () => new Response('bad'));
    mocks.resolveAuthorization.mockResolvedValueOnce(
      authorization({ section }),
    );

    const guarded = withInstitutionObjectRouteGuardV1({
      sectionId: 'customers',
      objectType: 'customer',
      action: 'read',
      resolveObjectId: resolver,
      handler,
    });
    await expectObjectForbidden(
      await guarded(new Request('http://localhost'), context as never),
    );
    expect(traps.get).toBe(0);
    expect(resolver).not.toHaveBeenCalled();
    expect(mocks.resolveAuthorization).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid ids before the second authorization', async () => {
    const section = vi.fn(async () => sectionAllow('customers'));
    mocks.resolveAuthorization.mockResolvedValueOnce(
      authorization({ section }),
    );
    const guarded = withInstitutionObjectRouteGuardV1({
      sectionId: 'customers',
      objectType: 'customer',
      action: 'read',
      resolveObjectId: vi.fn(async () => 'customer id with spaces'),
      handler: vi.fn(async () => new Response('bad')),
    });
    await expectObjectForbidden(await guarded());
    expect(mocks.resolveAuthorization).toHaveBeenCalledTimes(1);
  });

  it('maps Object rejection and wrong allows to one 403 contract', async () => {
    for (const objectResult of [
      { kind: 'rejected', code: 'object_denied' },
      objectAllow('knowledge_item', 'read'),
    ]) {
      const section = vi.fn(async () => sectionAllow('customers'));
      const object = vi.fn(async () => objectResult);
      mocks.resolveAuthorization
        .mockResolvedValueOnce(authorization({ section }))
        .mockResolvedValueOnce(authorization({ object }));
      const guarded = withInstitutionObjectRouteGuardV1({
        sectionId: 'customers',
        objectType: 'customer',
        action: 'read',
        resolveObjectId: vi.fn(async () => 'customer-001'),
        handler: vi.fn(async () => new Response('bad')),
      });
      await expectObjectForbidden(await guarded());
      expect(object).toHaveBeenCalledWith({
        objectType: 'customer',
        objectId: 'customer-001',
        action: 'read',
      });
    }
  });

  it('uses two fresh authorizations and invokes the handler once', async () => {
    const section = vi.fn(async () => sectionAllow('customers'));
    const object = vi.fn(async () => objectAllow());
    const actionAlias = vi.fn(async () => objectAllow());
    mocks.resolveAuthorization
      .mockResolvedValueOnce(authorization({ section }))
      .mockResolvedValueOnce(
        authorization({ object, action: actionAlias }),
      );

    const response = new Response('existing', { status: 207 });
    const handler = vi.fn(async () => response);
    const resolver = vi.fn(async () => 'customer-001');
    const guarded = withInstitutionObjectRouteGuardV1({
      sectionId: 'customers',
      objectType: 'customer',
      action: 'read',
      resolveObjectId: resolver,
      handler,
    });

    expect(await guarded()).toBe(response);
    expect(mocks.resolveAuthorization).toHaveBeenCalledTimes(2);
    expect(section).toHaveBeenCalledWith({ sectionId: 'customers' });
    expect(object).toHaveBeenCalledWith({
      objectType: 'customer',
      objectId: 'customer-001',
      action: 'read',
    });
    expect(actionAlias).not.toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
