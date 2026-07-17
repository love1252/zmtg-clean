import {
  INSTITUTION_ROLES_V1,
  isInstitutionRoleV1,
  type InstitutionRoleV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import type { AccessContext } from '@/modules/security/domain/access-control';

export const INSTITUTION_ACCESS_CONTEXT_FAILURE_REASONS_V1 = Object.freeze([
  'unauthenticated',
  'non_tenant_scope',
  'unsupported_role',
  'invalid_user',
  'missing_tenant',
  'missing_institution',
  'invalid_source',
  'invalid_context_shape',
] as const);

export type InstitutionAccessContextFailureReasonV1 =
  (typeof INSTITUTION_ACCESS_CONTEXT_FAILURE_REASONS_V1)[number];

export const INSTITUTION_SCOPE_DENIAL_REASONS_V1 = Object.freeze([
  'invalid_context',
  'invalid_target_scope',
  'invalid_role_policy',
  'cross_tenant_denied',
  'cross_institution_denied',
  'role_denied',
] as const);

export type InstitutionScopeDenialReasonV1 =
  (typeof INSTITUTION_SCOPE_DENIAL_REASONS_V1)[number];

export type InstitutionAccessContextSourceV1 = Exclude<
  AccessContext['source'],
  'demo_session'
>;

/**
 * A structurally narrowed tenant/institution scope. It is not evidence that the member is
 * currently active in that institution and it grants no resource, action, or capability access.
 */
export type InstitutionAccessContextV1 = Readonly<{
  userId: string;
  role: InstitutionRoleV1;
  tenantId: string;
  institutionId: string;
  source: InstitutionAccessContextSourceV1;
}>;

export type InstitutionScopeDecisionV1 =
  | Readonly<{ allowed: true; reason: 'allowed_same_institution' }>
  | Readonly<{ allowed: false; reason: InstitutionScopeDenialReasonV1 }>;

const ACCESS_CONTEXT_SOURCES = Object.freeze([
  'server_session',
  'trusted_gateway',
] as const satisfies readonly InstitutionAccessContextSourceV1[]);

const INSTITUTION_ACCESS_CONTEXT_KEYS = Object.freeze([
  'userId',
  'role',
  'tenantId',
  'institutionId',
  'source',
] as const);

const INSTITUTION_SCOPE_AUTHORIZATION_INPUT_KEYS = Object.freeze([
  'context',
  'targetTenantId',
  'targetInstitutionId',
  'allowedRoles',
] as const);

function snapshotExactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== 'string') ||
      expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(descriptors, key))
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/**
 * Shared lexical guard for tenant and institution IDs. It is format-only and never proves
 * membership, authorization, or capability reachability.
 */
export function isInstitutionScopeIdV1(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)
  );
}

export function isInstitutionAccessContextSourceV1(
  value: unknown,
): value is InstitutionAccessContextSourceV1 {
  return ACCESS_CONTEXT_SOURCES.some((candidate) => candidate === value);
}

export function isInstitutionAccessContextFailureReasonV1(
  value: unknown,
): value is InstitutionAccessContextFailureReasonV1 {
  return INSTITUTION_ACCESS_CONTEXT_FAILURE_REASONS_V1.some(
    (candidate) => candidate === value,
  );
}

export function isInstitutionScopeDenialReasonV1(
  value: unknown,
): value is InstitutionScopeDenialReasonV1 {
  return INSTITUTION_SCOPE_DENIAL_REASONS_V1.some((candidate) => candidate === value);
}

export function isInstitutionAccessContextV1(
  value: unknown,
): value is InstitutionAccessContextV1 {
  return parseInstitutionAccessContextV1(value) !== null;
}

function parseInstitutionAccessContextV1(
  value: unknown,
): InstitutionAccessContextV1 | null {
  const snapshot = snapshotExactDataRecord(value, INSTITUTION_ACCESS_CONTEXT_KEYS);
  if (!snapshot) return null;

  if (
    !isInstitutionScopeIdV1(snapshot.userId) ||
    !isInstitutionRoleV1(snapshot.role) ||
    !isInstitutionScopeIdV1(snapshot.tenantId) ||
    !isInstitutionScopeIdV1(snapshot.institutionId) ||
    !isInstitutionAccessContextSourceV1(snapshot.source)
  ) {
    return null;
  }

  return Object.freeze({
    userId: snapshot.userId,
    role: snapshot.role,
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
    source: snapshot.source,
  });
}

function parseValidRolePolicyV1(
  value: unknown,
): readonly InstitutionRoleV1[] | null {
  if (!Array.isArray(value)) return null;

  try {
    if (Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const descriptorMap = descriptors as unknown as Record<
      PropertyKey,
      PropertyDescriptor
    >;
    const lengthDescriptor = descriptorMap.length;
    if (!lengthDescriptor || !('value' in lengthDescriptor)) return null;
    const length = lengthDescriptor.value;
    if (
      typeof length !== 'number' ||
      !Number.isSafeInteger(length) ||
      length < 1 ||
      length > INSTITUTION_ROLES_V1.length
    ) {
      return null;
    }

    const ownKeys = Reflect.ownKeys(descriptors);
    const expectedKeys = [
      ...Array.from({ length }, (_, index) => String(index)),
      'length',
    ];
    if (
      ownKeys.length !== expectedKeys.length ||
      expectedKeys.some((key) => !ownKeys.includes(key))
    ) {
      return null;
    }

    const roles: InstitutionRoleV1[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptorMap[String(index)];
      if (!descriptor || !('value' in descriptor) || !isInstitutionRoleV1(descriptor.value)) {
        return null;
      }
      roles.push(descriptor.value);
    }

    return new Set(roles).size === roles.length ? Object.freeze(roles) : null;
  } catch {
    return null;
  }
}

export type InstitutionScopeAuthorizationInputV1 = Readonly<{
  context: InstitutionAccessContextV1;
  targetTenantId: unknown;
  targetInstitutionId: unknown;
  allowedRoles: readonly InstitutionRoleV1[];
}>;

/**
 * Checks only the current institution partition and the caller-supplied role ceiling. It never
 * authorizes a page, object, or mutation; the target resource/action authorizer must run again.
 */
export function authorizeInstitutionScopeV1(input: {
  context: InstitutionAccessContextV1;
  targetTenantId: unknown;
  targetInstitutionId: unknown;
  allowedRoles: readonly InstitutionRoleV1[];
}): InstitutionScopeDecisionV1 {
  const snapshot = snapshotExactDataRecord(
    input,
    INSTITUTION_SCOPE_AUTHORIZATION_INPUT_KEYS,
  );
  if (!snapshot) return Object.freeze({ allowed: false, reason: 'invalid_context' });

  const context = parseInstitutionAccessContextV1(snapshot.context);
  if (!context) {
    return Object.freeze({ allowed: false, reason: 'invalid_context' });
  }

  if (
    !isInstitutionScopeIdV1(snapshot.targetTenantId) ||
    !isInstitutionScopeIdV1(snapshot.targetInstitutionId)
  ) {
    return Object.freeze({ allowed: false, reason: 'invalid_target_scope' });
  }

  const allowedRoles = parseValidRolePolicyV1(snapshot.allowedRoles);
  if (!allowedRoles) {
    return Object.freeze({ allowed: false, reason: 'invalid_role_policy' });
  }

  if (context.tenantId !== snapshot.targetTenantId) {
    return Object.freeze({ allowed: false, reason: 'cross_tenant_denied' });
  }

  if (context.institutionId !== snapshot.targetInstitutionId) {
    return Object.freeze({ allowed: false, reason: 'cross_institution_denied' });
  }

  if (!allowedRoles.includes(context.role)) {
    return Object.freeze({ allowed: false, reason: 'role_denied' });
  }

  return Object.freeze({ allowed: true, reason: 'allowed_same_institution' });
}

export const ALL_INSTITUTION_ACCESS_ROLES_V1 = INSTITUTION_ROLES_V1;
