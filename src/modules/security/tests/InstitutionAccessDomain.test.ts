import { describe, expect, expectTypeOf, it } from 'vitest';

import type { InstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import {
  ALL_INSTITUTION_ACCESS_ROLES_V1,
  INSTITUTION_ACCESS_CONTEXT_FAILURE_REASONS_V1,
  INSTITUTION_SCOPE_DENIAL_REASONS_V1,
  authorizeInstitutionScopeV1,
  isInstitutionAccessContextFailureReasonV1,
  isInstitutionAccessContextV1,
  isInstitutionScopeIdV1,
  isInstitutionScopeDenialReasonV1,
  type InstitutionAccessContextV1,
  type InstitutionScopeDecisionV1,
} from '@/modules/security/domain/institution-access';

function context(role: InstitutionRoleV1 = 'tenant_admin'): InstitutionAccessContextV1 {
  return Object.freeze({
    userId: 'user-safe-reference',
    role,
    tenantId: 'tenant-safe-reference',
    institutionId: 'institution-safe-reference',
    source: 'server_session',
  });
}

describe('InstitutionAccessDomainV1', () => {
  it('freezes the four stable roles and controlled failure vocabularies', () => {
    expect(ALL_INSTITUTION_ACCESS_ROLES_V1).toEqual([
      'tenant_admin',
      'tenant_operator',
      'consultant',
      'customer_service',
    ]);
    expect(Object.isFrozen(ALL_INSTITUTION_ACCESS_ROLES_V1)).toBe(true);
    expect(Object.isFrozen(INSTITUTION_ACCESS_CONTEXT_FAILURE_REASONS_V1)).toBe(true);
    expect(Object.isFrozen(INSTITUTION_SCOPE_DENIAL_REASONS_V1)).toBe(true);
    expect(isInstitutionAccessContextFailureReasonV1('missing_institution')).toBe(true);
    expect(isInstitutionAccessContextFailureReasonV1('institution-safe-reference')).toBe(false);
    expect(isInstitutionScopeDenialReasonV1('cross_institution_denied')).toBe(true);
    expect(isInstitutionScopeDenialReasonV1({ reason: 'role_denied' })).toBe(false);
  });

  it.each(ALL_INSTITUTION_ACCESS_ROLES_V1)(
    'allows %s only for the same institution when the role policy includes it',
    (role) => {
      expect(
        authorizeInstitutionScopeV1({
          context: context(role),
          targetTenantId: 'tenant-safe-reference',
          targetInstitutionId: 'institution-safe-reference',
          allowedRoles: [role],
        }),
      ).toEqual({ allowed: true, reason: 'allowed_same_institution' });
    },
  );

  it.each([
    ['other-tenant', 'institution-safe-reference', 'cross_tenant_denied'],
    ['tenant-safe-reference', 'other-institution', 'cross_institution_denied'],
  ] as const)('fails closed across a tenant or institution boundary', (tenantId, institutionId, reason) => {
    const decision = authorizeInstitutionScopeV1({
      context: context(),
      targetTenantId: tenantId,
      targetInstitutionId: institutionId,
      allowedRoles: ALL_INSTITUTION_ACCESS_ROLES_V1,
    });

    expect(decision).toEqual({ allowed: false, reason });
    expect(JSON.stringify(decision)).not.toContain(tenantId);
    expect(JSON.stringify(decision)).not.toContain(institutionId);
  });

  it('fails closed for a denied role, invalid target, invalid policy, or malformed context', () => {
    expect(
      authorizeInstitutionScopeV1({
        context: context('consultant'),
        targetTenantId: 'tenant-safe-reference',
        targetInstitutionId: 'institution-safe-reference',
        allowedRoles: ['tenant_admin', 'tenant_operator'],
      }),
    ).toEqual({ allowed: false, reason: 'role_denied' });

    expect(
      authorizeInstitutionScopeV1({
        context: context(),
        targetTenantId: ' tenant-safe-reference ',
        targetInstitutionId: 'institution-safe-reference',
        allowedRoles: ALL_INSTITUTION_ACCESS_ROLES_V1,
      }),
    ).toEqual({ allowed: false, reason: 'invalid_target_scope' });

    expect(
      authorizeInstitutionScopeV1({
        context: context(),
        targetTenantId: 'tenant-safe-reference',
        targetInstitutionId: 'institution-safe-reference',
        allowedRoles: [] as InstitutionRoleV1[],
      }),
    ).toEqual({ allowed: false, reason: 'invalid_role_policy' });

    expect(
      authorizeInstitutionScopeV1({
        context: { ...context(), institutionId: '' },
        targetTenantId: 'tenant-safe-reference',
        targetInstitutionId: 'institution-safe-reference',
        allowedRoles: ALL_INSTITUTION_ACCESS_ROLES_V1,
      }),
    ).toEqual({ allowed: false, reason: 'invalid_context' });
  });

  it('validates the exact strict context shape and returns immutable decisions', () => {
    expect(isInstitutionAccessContextV1(context())).toBe(true);
    expect(isInstitutionAccessContextV1({ ...context(), clientInstitutionId: 'other' })).toBe(
      false,
    );
    expect(isInstitutionAccessContextV1({ ...context(), role: 'platform_admin' })).toBe(false);

    const decision = authorizeInstitutionScopeV1({
      context: context(),
      targetTenantId: 'tenant-safe-reference',
      targetInstitutionId: 'institution-safe-reference',
      allowedRoles: ALL_INSTITUTION_ACCESS_ROLES_V1,
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expectTypeOf(decision).toEqualTypeOf<InstitutionScopeDecisionV1>();
  });

  it('rejects inherited, accessor, non-enumerable, symbol, and unrelated own fields', () => {
    const inherited = Object.assign(Object.create(context()), {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
    });
    expect(isInstitutionAccessContextV1(inherited)).toBe(false);

    const accessor = { ...context() };
    Object.defineProperty(accessor, 'institutionId', {
      enumerable: true,
      get: () => 'institution-safe-reference',
    });
    expect(isInstitutionAccessContextV1(accessor)).toBe(false);

    const nonEnumerableExtra = { ...context() };
    Object.defineProperty(nonEnumerableExtra, 'clientInstitutionId', {
      value: 'other-institution',
      enumerable: false,
    });
    expect(isInstitutionAccessContextV1(nonEnumerableExtra)).toBe(false);

    const symbolExtra = { ...context(), [Symbol('client-scope')]: 'other-institution' };
    expect(isInstitutionAccessContextV1(symbolExtra)).toBe(false);
  });

  it('rejects sparse, subclassed, duplicated, and accessor role policies', () => {
    const sparse = new Array<InstitutionRoleV1>(1);
    const subclassed = new (class extends Array<InstitutionRoleV1> {})('tenant_admin');
    const accessor = ['tenant_admin'] as InstitutionRoleV1[];
    Object.defineProperty(accessor, '0', {
      enumerable: true,
      get: () => 'tenant_admin',
    });

    for (const allowedRoles of [
      sparse,
      subclassed,
      ['tenant_admin', 'tenant_admin'] as InstitutionRoleV1[],
      accessor,
    ]) {
      expect(
        authorizeInstitutionScopeV1({
          context: context(),
          targetTenantId: 'tenant-safe-reference',
          targetInstitutionId: 'institution-safe-reference',
          allowedRoles,
        }),
      ).toEqual({ allowed: false, reason: 'invalid_role_policy' });
    }
  });

  it('snapshots authorization input, context, targets, and roles exactly once', () => {
    let propertyReads = 0;
    const statefulContext = new Proxy(context(), {
      get(target, property, receiver) {
        propertyReads += 1;
        if (property === 'role') return 'platform_admin';
        if (property === 'institutionId') return 'other-institution';
        return Reflect.get(target, property, receiver);
      },
    });

    expect(
      authorizeInstitutionScopeV1({
        context: statefulContext,
        targetTenantId: 'tenant-safe-reference',
        targetInstitutionId: 'institution-safe-reference',
        allowedRoles: ['tenant_admin'],
      }),
    ).toEqual({ allowed: true, reason: 'allowed_same_institution' });
    expect(propertyReads).toBe(0);

    const accessorInput = {
      context: context(),
      targetTenantId: 'tenant-safe-reference',
      get targetInstitutionId() {
        return 'institution-safe-reference';
      },
      allowedRoles: ['tenant_admin'] as InstitutionRoleV1[],
    };
    expect(authorizeInstitutionScopeV1(accessorInput)).toEqual({
      allowed: false,
      reason: 'invalid_context',
    });
  });

  it('rejects unsafe scope IDs consistently for both target fields', () => {
    for (const scopeId of [
      '',
      'tenant with spaces',
      'tenant\ncontrol',
      'tenant/other',
      `tenant-${'x'.repeat(129)}`,
    ]) {
      expect(isInstitutionScopeIdV1(scopeId)).toBe(false);
      for (const [targetTenantId, targetInstitutionId] of [
        [scopeId, 'institution-safe-reference'],
        ['tenant-safe-reference', scopeId],
      ]) {
        expect(
          authorizeInstitutionScopeV1({
            context: context(),
            targetTenantId,
            targetInstitutionId,
            allowedRoles: ['tenant_admin'],
          }),
        ).toEqual({ allowed: false, reason: 'invalid_target_scope' });
      }
    }

    expect(isInstitutionScopeIdV1(`scope-${'x'.repeat(122)}`)).toBe(true);
    expect(isInstitutionScopeIdV1('.scope_reference:1')).toBe(true);
  });
});
