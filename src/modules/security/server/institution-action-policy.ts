import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

import {
  isInstitutionRoleV1,
  type InstitutionRoleV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import {
  isInstitutionObjectActionV1,
  isInstitutionObjectTypeV1,
  type InstitutionObjectActionV1,
  type InstitutionObjectTypeV1,
} from '@/modules/security/ports/institution-object-fact';

const FACTORY_KEYS = Object.freeze([] as const);
const INPUT_KEYS = Object.freeze(['objectType', 'action', 'role'] as const);

const ALL_ROLES = Object.freeze([
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
] as const satisfies readonly InstitutionRoleV1[]);

const MANAGEMENT_ROLES = Object.freeze([
  'tenant_admin',
  'tenant_operator',
] as const satisfies readonly InstitutionRoleV1[]);

const CARE_APPROVAL_ROLES = Object.freeze([
  'tenant_admin',
  'tenant_operator',
  'consultant',
] as const satisfies readonly InstitutionRoleV1[]);

type Rule = Readonly<{
  objectType: InstitutionObjectTypeV1;
  action: InstitutionObjectActionV1;
  roles: readonly InstitutionRoleV1[];
}>;

const RULES = Object.freeze([
  { objectType: 'customer', action: 'read', roles: ALL_ROLES },
  { objectType: 'customer', action: 'update', roles: ALL_ROLES },
  { objectType: 'customer', action: 'delete', roles: MANAGEMENT_ROLES },
  { objectType: 'care_task', action: 'read', roles: ALL_ROLES },
  { objectType: 'care_task', action: 'update', roles: ALL_ROLES },
  { objectType: 'care_task', action: 'approve', roles: CARE_APPROVAL_ROLES },
  { objectType: 'care_task', action: 'delete', roles: MANAGEMENT_ROLES },
  { objectType: 'conversation', action: 'read', roles: ALL_ROLES },
  { objectType: 'conversation', action: 'update', roles: ALL_ROLES },
  { objectType: 'conversation', action: 'delete', roles: MANAGEMENT_ROLES },
  { objectType: 'knowledge_item', action: 'read', roles: MANAGEMENT_ROLES },
  { objectType: 'knowledge_item', action: 'update', roles: MANAGEMENT_ROLES },
  { objectType: 'knowledge_item', action: 'approve', roles: MANAGEMENT_ROLES },
  { objectType: 'knowledge_item', action: 'delete', roles: MANAGEMENT_ROLES },
] as const satisfies readonly Rule[]);

const POLICY_REVISION = `iap_v1_sha256_${createHash('sha256')
  .update(
    RULES.map(
      (rule) => `${rule.objectType}|${rule.action}|${rule.roles.join(',')}`,
    ).join('\n'),
    'utf8',
  )
  .digest('hex')}` as const;

export type InstitutionActionPolicyInputV1 = Readonly<{
  objectType: InstitutionObjectTypeV1;
  action: InstitutionObjectActionV1;
  role: InstitutionRoleV1;
}>;

export type InstitutionActionPolicyFailureCodeV1 =
  | 'action_unregistered'
  | 'action_role_denied'
  | 'policy_unavailable';

declare class PolicySeal {
  private readonly seal;
}

declare class PolicyAllowSeal {
  private readonly seal;
}

export type InstitutionActionPolicyAllowV1 = PolicyAllowSeal &
  Readonly<{
    kind: 'institution_action_policy_allow';
    objectType: InstitutionObjectTypeV1;
    action: InstitutionObjectActionV1;
    policyRevision: typeof POLICY_REVISION;
  }>;

export type InstitutionActionPolicyResolutionV1 =
  | InstitutionActionPolicyAllowV1
  | Readonly<{
      kind: 'rejected';
      code: InstitutionActionPolicyFailureCodeV1;
    }>;

export type InstitutionActionPolicyV1 = PolicySeal &
  Readonly<{
    authorize: (
      input: InstitutionActionPolicyInputV1,
    ) => InstitutionActionPolicyResolutionV1;
  }>;

const policies = new WeakSet<object>();
const allows = new WeakSet<object>();

const actionUnregistered = Object.freeze({
  kind: 'rejected',
  code: 'action_unregistered',
} as const);
const actionRoleDenied = Object.freeze({
  kind: 'rejected',
  code: 'action_role_denied',
} as const);
const policyUnavailable = Object.freeze({
  kind: 'rejected',
  code: 'policy_unavailable',
} as const);

function snapshot(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(descriptors, key))
    ) {
      return null;
    }
    const result: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      Object.defineProperty(result, key, {
        value: descriptor.value,
        enumerable: true,
      });
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function parseInput(value: unknown): InstitutionActionPolicyInputV1 | null {
  const input = snapshot(value, INPUT_KEYS);
  if (
    !input ||
    !isInstitutionObjectTypeV1(input.objectType) ||
    !isInstitutionObjectActionV1(input.action) ||
    !isInstitutionRoleV1(input.role)
  ) {
    return null;
  }
  return Object.freeze({
    objectType: input.objectType,
    action: input.action,
    role: input.role,
  });
}

function mintAllow(
  input: InstitutionActionPolicyInputV1,
): InstitutionActionPolicyAllowV1 {
  const allow = Object.freeze({
    kind: 'institution_action_policy_allow' as const,
    objectType: input.objectType,
    action: input.action,
    policyRevision: POLICY_REVISION,
  });
  allows.add(allow);
  return allow as InstitutionActionPolicyAllowV1;
}

function makePolicy(unavailable: boolean): InstitutionActionPolicyV1 {
  const policy = Object.freeze({
    authorize(
      value: InstitutionActionPolicyInputV1,
    ): InstitutionActionPolicyResolutionV1 {
      if (unavailable) return policyUnavailable;
      const input = parseInput(value);
      if (!input) return actionUnregistered;
      const rule = RULES.find(
        (item) =>
          item.objectType === input.objectType &&
          item.action === input.action,
      );
      if (!rule) return actionUnregistered;
      if (!rule.roles.some((role) => role === input.role)) {
        return actionRoleDenied;
      }
      return mintAllow(input);
    },
  });
  policies.add(policy);
  return policy as InstitutionActionPolicyV1;
}

export function createInstitutionActionPolicyV1(
  input: Readonly<Record<never, never>> = {},
): InstitutionActionPolicyV1 {
  return makePolicy(snapshot(input, FACTORY_KEYS) === null);
}

export function isInstitutionActionPolicyV1(
  value: unknown,
): value is InstitutionActionPolicyV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      policies.has(value)
    );
  } catch {
    return false;
  }
}

export function isInstitutionActionPolicyAllowV1(
  value: unknown,
): value is InstitutionActionPolicyAllowV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      allows.has(value)
    );
  } catch {
    return false;
  }
}
