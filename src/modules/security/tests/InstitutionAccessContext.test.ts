import { describe, expect, expectTypeOf, it } from 'vitest';

import type { AccessContext } from '@/modules/security/domain/access-control';
import type { InstitutionAccessContextV1 } from '@/modules/security/domain/institution-access';
import {
  resolveInstitutionAccessContextV1,
  type InstitutionAccessContextResolutionV1,
} from '@/modules/security/server/institution-access-context';

function accessContext(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    userId: 'user-safe-reference',
    role: 'tenant_admin',
    scope: 'tenant',
    tenantId: 'tenant-safe-reference',
    institutionId: 'institution-safe-reference',
    source: 'server_session',
    ...overrides,
  };
}

describe('InstitutionAccessContextResolutionV1', () => {
  it.each(['tenant_admin', 'tenant_operator', 'consultant', 'customer_service'] as const)(
    'resolves %s from the server access context to an immutable strict institution context',
    (role) => {
      const source = accessContext({ role });
      const result = resolveInstitutionAccessContextV1(source);

      expect(result).toEqual({
        ok: true,
        context: {
          userId: 'user-safe-reference',
          role,
          tenantId: 'tenant-safe-reference',
          institutionId: 'institution-safe-reference',
          source: 'server_session',
        },
      });
      expect(Object.isFrozen(result)).toBe(true);
      if (result.ok) {
        expect(Object.isFrozen(result.context)).toBe(true);
        expectTypeOf(result.context).toEqualTypeOf<InstitutionAccessContextV1>();
        expect(Object.keys(result.context)).toEqual([
          'userId',
          'role',
          'tenantId',
          'institutionId',
          'source',
        ]);
        expect('reachableCapabilityKeys' in result.context).toBe(false);
      }

      source.institutionId = 'mutated-after-resolution';
      if (result.ok) expect(result.context.institutionId).toBe('institution-safe-reference');
    },
  );

  it.each([
    [null, 'unauthenticated'],
    [accessContext({ role: 'platform_admin', scope: 'platform', tenantId: null }), 'non_tenant_scope'],
    [accessContext({ role: 'platform_admin' }), 'unsupported_role'],
    [accessContext({ userId: '' }), 'invalid_user'],
    [accessContext({ tenantId: null }), 'missing_tenant'],
    [accessContext({ institutionId: null }), 'missing_institution'],
  ] as const)('fails closed with a stable low-sensitivity reason', (input, reason) => {
    const result = resolveInstitutionAccessContextV1(input);

    expect(result).toEqual({ ok: false, reason });
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toContain('tenant-safe-reference');
    expect(JSON.stringify(result)).not.toContain('institution-safe-reference');
  });

  it('rejects whitespace references and unknown runtime source values', () => {
    expect(resolveInstitutionAccessContextV1(accessContext({ institutionId: ' invalid ' }))).toEqual(
      { ok: false, reason: 'missing_institution' },
    );
    expect(
      resolveInstitutionAccessContextV1(
        accessContext({ source: 'browser_payload' as AccessContext['source'] }),
      ),
    ).toEqual({ ok: false, reason: 'invalid_source' });
    expect(
      resolveInstitutionAccessContextV1(accessContext({ source: 'demo_session' })),
    ).toEqual({ ok: false, reason: 'invalid_source' });
    expect(
      resolveInstitutionAccessContextV1(
        accessContext({ tenantId: 'tenant safe reference' }),
      ),
    ).toEqual({ ok: false, reason: 'missing_tenant' });
    expect(
      resolveInstitutionAccessContextV1(
        accessContext({ institutionId: `institution-${'x'.repeat(129)}` }),
      ),
    ).toEqual({ ok: false, reason: 'missing_institution' });
  });

  it.each([
    ['userId', '---', 'invalid_user'],
    ['userId', '.user-safe-reference', 'invalid_user'],
    ['tenantId', 'tenant with spaces', 'missing_tenant'],
    ['tenantId', 'tenant\ncontrol', 'missing_tenant'],
    ['tenantId', 'tenant/other', 'missing_tenant'],
    ['tenantId', '...', 'missing_tenant'],
    ['tenantId', '-tenant-safe-reference', 'missing_tenant'],
    ['tenantId', `tenant-${'x'.repeat(129)}`, 'missing_tenant'],
    ['institutionId', 'institution with spaces', 'missing_institution'],
    ['institutionId', 'institution\ncontrol', 'missing_institution'],
    ['institutionId', 'institution/other', 'missing_institution'],
    ['institutionId', ':::', 'missing_institution'],
    ['institutionId', '_institution-safe-reference', 'missing_institution'],
    ['institutionId', `institution-${'x'.repeat(129)}`, 'missing_institution'],
  ] as const)('fails closed for malformed %s scope IDs', (field, value, reason) => {
    expect(resolveInstitutionAccessContextV1(accessContext({ [field]: value }))).toEqual({
      ok: false,
      reason,
    });
  });

  it('rejects and does not expose a client institution override', () => {
    const input = {
      ...accessContext(),
      clientInstitutionId: 'other-institution',
    } as AccessContext;
    const result = resolveInstitutionAccessContextV1(input);

    expect(result).toEqual({ ok: false, reason: 'invalid_context_shape' });
    expect(JSON.stringify(result)).not.toContain('other-institution');
    expectTypeOf(result).toEqualTypeOf<InstitutionAccessContextResolutionV1>();
  });

  it('rejects inherited, accessor, non-enumerable, and symbol-bearing access contexts', () => {
    const inherited = Object.create(accessContext()) as AccessContext;
    const accessor = accessContext();
    Object.defineProperty(accessor, 'institutionId', {
      enumerable: true,
      get: () => 'institution-safe-reference',
    });
    const nonEnumerableExtra = accessContext();
    Object.defineProperty(nonEnumerableExtra, 'clientInstitutionId', {
      value: 'other-institution',
      enumerable: false,
    });
    const symbolExtra = Object.assign(accessContext(), {
      [Symbol('client-scope')]: 'other-institution',
    });

    for (const input of [inherited, accessor, nonEnumerableExtra, symbolExtra]) {
      expect(resolveInstitutionAccessContextV1(input)).toEqual({
        ok: false,
        reason: 'invalid_context_shape',
      });
    }
  });

  it('uses one descriptor snapshot and never re-reads a stateful Proxy identity', () => {
    let propertyReads = 0;
    const source = accessContext();
    const stateful = new Proxy(source, {
      get(target, property, receiver) {
        propertyReads += 1;
        if (property === 'role') return 'platform_admin';
        if (property === 'tenantId') return ' invalid tenant ';
        return Reflect.get(target, property, receiver);
      },
    });

    expect(resolveInstitutionAccessContextV1(stateful)).toEqual({
      ok: true,
      context: {
        userId: 'user-safe-reference',
        role: 'tenant_admin',
        tenantId: 'tenant-safe-reference',
        institutionId: 'institution-safe-reference',
        source: 'server_session',
      },
    });
    expect(propertyReads).toBe(0);
  });
});
