import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  InstitutionObjectActionV1,
  InstitutionObjectTypeV1,
} from '@/modules/security/ports/institution-object-fact';
import {
  createInstitutionActionPolicyV1,
  isInstitutionActionPolicyAllowV1,
  isInstitutionActionPolicyV1,
  type InstitutionActionPolicyInputV1,
} from '@/modules/security/server/institution-action-policy';

describe('BASE-B4 institution action policy', () => {
  it('freezes the exact registered input and genuine policy', () => {
    const policy = createInstitutionActionPolicyV1({});
    expect(isInstitutionActionPolicyV1(policy)).toBe(true);
    expect(Object.isFrozen(policy)).toBe(true);
    expectTypeOf<keyof InstitutionActionPolicyInputV1>().toEqualTypeOf<
      'objectType' | 'action' | 'role'
    >();
    expectTypeOf<InstitutionActionPolicyInputV1['objectType']>()
      .toEqualTypeOf<InstitutionObjectTypeV1>();
    expectTypeOf<InstitutionActionPolicyInputV1['action']>()
      .toEqualTypeOf<InstitutionObjectActionV1>();
  });

  it('allows a registered pair and returns only low-sensitive policy data', () => {
    const result = createInstitutionActionPolicyV1({}).authorize({
      objectType: 'customer',
      action: 'read',
      role: 'customer_service',
    });
    expect(isInstitutionActionPolicyAllowV1(result)).toBe(true);
    expect(result).toEqual({
      kind: 'institution_action_policy_allow',
      objectType: 'customer',
      action: 'read',
      policyRevision: expect.stringMatching(
        /^iap_v1_sha256_[0-9a-f]{64}$/u,
      ),
    });
  });

  it('denies role mismatches and unregistered pairs', () => {
    const policy = createInstitutionActionPolicyV1({});
    expect(
      policy.authorize({
        objectType: 'knowledge_item',
        action: 'update',
        role: 'customer_service',
      }),
    ).toEqual({ kind: 'rejected', code: 'action_role_denied' });
    expect(
      policy.authorize({
        objectType: 'customer',
        action: 'approve',
        role: 'tenant_admin',
      }),
    ).toEqual({ kind: 'rejected', code: 'action_unregistered' });
  });

  it('fails closed for malformed factories and structural copies', () => {
    const unavailable = createInstitutionActionPolicyV1({
      unexpected: true,
    } as never);
    expect(
      unavailable.authorize({
        objectType: 'customer',
        action: 'read',
        role: 'tenant_admin',
      }),
    ).toEqual({ kind: 'rejected', code: 'policy_unavailable' });

    const policy = createInstitutionActionPolicyV1({});
    expect(isInstitutionActionPolicyV1({ ...policy })).toBe(false);
    expect(
      isInstitutionActionPolicyAllowV1({
        kind: 'institution_action_policy_allow',
      }),
    ).toBe(false);
  });
});
