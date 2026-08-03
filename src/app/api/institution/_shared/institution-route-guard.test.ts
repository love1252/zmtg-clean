import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardMocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  genuineAuthorizations: new WeakSet<object>(),
  genuineAllows: new WeakSet<object>(),
}));

vi.mock(
  '@/modules/institution/server/institution-server-runtime',
  () => ({
    resolveInstitutionServerAuthorizationV1:
      guardMocks.resolveAuthorization,
  }),
);

vi.mock(
  '@/modules/security/server/institution-request-authorization',
  () => ({
    isInstitutionRequestAuthorizationV1(value: unknown) {
      return (
        value !== null &&
        typeof value === 'object' &&
        guardMocks.genuineAuthorizations.has(value)
      );
    },
  }),
);

vi.mock(
  '@/modules/security/server/institution-section-guard',
  () => ({
    isInstitutionSectionAllowV1(value: unknown) {
      return (
        value !== null &&
        typeof value === 'object' &&
        guardMocks.genuineAllows.has(value)
      );
    },
  }),
);

import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';

function genuineAllow(sectionId: 'knowledge' | 'system') {
  const allow = Object.freeze({
    kind: 'institution_section_allow' as const,
    sectionId,
  });
  guardMocks.genuineAllows.add(allow);
  return allow;
}

function genuineAuthorization(
  authorize: () => Promise<unknown> = vi.fn(async () =>
    genuineAllow('knowledge'),
  ),
) {
  const authorization = Object.freeze({
    authorizeCurrentInstitutionSectionV1: authorize,
  });
  guardMocks.genuineAuthorizations.add(authorization);
  return authorization;
}

async function expectForbidden(response: Response) {
  expect(response.status).toBe(403);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual({
    error: 'institution_route_forbidden',
    code: 'institution_section_forbidden',
  });
}

describe('BASE-B4 institution Route Guard', () => {
  beforeEach(() => {
    guardMocks.resolveAuthorization.mockReset();
    guardMocks.genuineAuthorizations = new WeakSet<object>();
    guardMocks.genuineAllows = new WeakSet<object>();
  });

  it('fails closed before the handler for malformed factory input', async () => {
    const handler = vi.fn(async () => new Response('should-not-run'));
    const guarded = withInstitutionSectionRouteGuardV1({
      sectionId: 'unknown',
      handler,
    } as never);

    await expectForbidden(await guarded());
    expect(handler).not.toHaveBeenCalled();
    expect(guardMocks.resolveAuthorization).not.toHaveBeenCalled();
  });

  it('fails closed for missing or structural fake authorization', async () => {
    const handler = vi.fn(async () => new Response('should-not-run'));
    const guarded = withInstitutionSectionRouteGuardV1({
      sectionId: 'knowledge',
      handler,
    });

    for (const authorization of [
      null,
      Object.freeze({
        authorizeCurrentInstitutionSectionV1: vi.fn(),
      }),
    ]) {
      guardMocks.resolveAuthorization.mockResolvedValueOnce(authorization);
      await expectForbidden(await guarded());
    }

    expect(handler).not.toHaveBeenCalled();
  });

  it('fails closed when resolver or Section Guard throws', async () => {
    const handler = vi.fn(async () => new Response('should-not-run'));
    const guarded = withInstitutionSectionRouteGuardV1({
      sectionId: 'knowledge',
      handler,
    });

    guardMocks.resolveAuthorization.mockRejectedValueOnce(
      new Error('authorization unavailable'),
    );
    await expectForbidden(await guarded());

    const authorize = vi.fn(async () => {
      throw new Error('section unavailable');
    });
    guardMocks.resolveAuthorization.mockResolvedValueOnce(
      genuineAuthorization(authorize),
    );
    await expectForbidden(await guarded());

    expect(handler).not.toHaveBeenCalled();
  });

  it('fails closed for rejection and wrong-section allow', async () => {
    const handler = vi.fn(async () => new Response('should-not-run'));
    const guarded = withInstitutionSectionRouteGuardV1({
      sectionId: 'knowledge',
      handler,
    });

    guardMocks.resolveAuthorization.mockResolvedValueOnce(
      genuineAuthorization(
        vi.fn(async () => ({
          kind: 'rejected',
          code: 'scope_unavailable',
        })),
      ),
    );
    await expectForbidden(await guarded());

    guardMocks.resolveAuthorization.mockResolvedValueOnce(
      genuineAuthorization(
        vi.fn(async () => genuineAllow('system')),
      ),
    );
    await expectForbidden(await guarded());

    expect(handler).not.toHaveBeenCalled();
  });

  it('calls the existing handler once and preserves its response', async () => {
    const response = new Response('existing-success', {
      status: 207,
      headers: { 'x-existing-contract': 'preserved' },
    });
    const handler = vi.fn(async (_request: Request) => response);
    const authorize = vi.fn(async () => genuineAllow('knowledge'));

    guardMocks.resolveAuthorization.mockResolvedValueOnce(
      genuineAuthorization(authorize),
    );

    const guarded = withInstitutionSectionRouteGuardV1({
      sectionId: 'knowledge',
      handler,
    });
    const request = new Request('http://localhost/api/institution/example');
    const result = await guarded(request);

    expect(result).toBe(response);
    expect(result.status).toBe(207);
    expect(result.headers.get('x-existing-contract')).toBe('preserved');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(request);
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(authorize).toHaveBeenCalledWith({ sectionId: 'knowledge' });
  });
});
