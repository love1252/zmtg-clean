import { isProxy } from 'node:util/types';

import { cookies } from 'next/headers';

import { createAccessControlAuthoritativeMembershipFactReaderV1 } from '@/modules/access-control/application/authoritative-membership-reader';
import { createIdentityAuthoritativeFormalSessionIdentityFactReaderV1 } from '@/modules/auth/application/authoritative-formal-session-identity-reader';
import {
  consumeFormalServerSessionUserSnapshotV1,
  createFormalInstitutionSessionContextResolverV1,
  isFormalInstitutionSessionContextResolverV1,
} from '@/modules/auth/application/formal-institution-session-context';
import {
  consumeFormalServerSessionVerifiedClaimsV1,
  FORMAL_SERVER_SESSION_COOKIE_V1,
  verifyFormalServerSessionCookieClaimsV1,
  type FormalServerSessionKeyRingV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import {
  isInstitutionRoleV1,
  isRoleInInstitutionSectionAudienceV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import { isInstitutionScopeIdV1 } from '@/modules/security/domain/institution-access';
import {
  createInstitutionActionPolicyV1,
  isInstitutionActionPolicyAllowV1,
} from '@/modules/security/server/institution-action-policy';
import { resolveInstitutionGuardRuntimeConfigV1 } from '@/modules/security/server/institution-guard-runtime-config';
import { createTenancyAuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/application/authoritative-institution-scope-reader';

declare const institutionCustomerReadAuthorizationMarkerV1: unique symbol;

export type InstitutionCustomerReadAuthorizationHandleV1 = Readonly<{
  readonly [institutionCustomerReadAuthorizationMarkerV1]:
    'institution_customer_read_authorization_v1';
}>;

export type InstitutionCustomerReadAuthorizationConsumptionV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  observedAt: string;
}>;

export type InstitutionCustomerReadAuthorizationResolutionV1 =
  | Readonly<{
      kind: 'allowed';
      authorization: InstitutionCustomerReadAuthorizationHandleV1;
    }>
  | Readonly<{ kind: 'forbidden' }>
  | Readonly<{ kind: 'unavailable' }>;

const RUNTIME_CONFIG_KEYS = Object.freeze([
  'kind',
  'formalServerSessionKeyRing',
  'institutionGuardReferenceKeyRing',
] as const);
const VERIFIED_RESOLUTION_KEYS = Object.freeze(['kind', 'verifiedClaims'] as const);
const COOKIE_KEYS = Object.freeze(['name', 'value'] as const);
const CLAIMS_KEYS = Object.freeze(['accountId', 'tenantId', 'institutionId'] as const);
const CONTEXT_KEYS = Object.freeze(['kind', 'snapshot', 'membershipAudit'] as const);
const USER_KEYS = Object.freeze([
  'id',
  'username',
  'name',
  'role',
  'tenantId',
  'institutionId',
] as const);
const MEMBERSHIP_KEYS = Object.freeze(['id', 'tenantId', 'role'] as const);

const handles = new WeakSet<object>();
const consumptions = new WeakMap<
  object,
  InstitutionCustomerReadAuthorizationConsumptionV1
>();
const FORBIDDEN = Object.freeze({ kind: 'forbidden' } as const);
const UNAVAILABLE = Object.freeze({ kind: 'unavailable' } as const);

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
    ) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(descriptors, key))
    ) return null;
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

function readEpochMs(): number | null {
  try {
    const value = Date.now();
    if (!Number.isSafeInteger(value)) return null;
    new Date(value).toISOString();
    return value;
  } catch {
    return null;
  }
}

export function isInstitutionCustomerReadAuthorizationHandleV1(
  value: unknown,
): value is InstitutionCustomerReadAuthorizationHandleV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      handles.has(value)
    );
  } catch {
    return false;
  }
}

export function consumeInstitutionCustomerReadAuthorizationV1(
  value: unknown,
): InstitutionCustomerReadAuthorizationConsumptionV1 | null {
  if (!isInstitutionCustomerReadAuthorizationHandleV1(value)) return null;
  const consumption = consumptions.get(value);
  if (!consumption) return null;
  consumptions.delete(value);
  handles.delete(value);
  return consumption;
}

export async function resolveInstitutionCustomerReadAuthorizationV1(): Promise<InstitutionCustomerReadAuthorizationResolutionV1> {
  try {
    const runtimeConfig = snapshot(
      resolveInstitutionGuardRuntimeConfigV1(),
      RUNTIME_CONFIG_KEYS,
    );
    if (!runtimeConfig || runtimeConfig.kind !== 'available') return UNAVAILABLE;

    const verificationEpochMs = readEpochMs();
    if (verificationEpochMs === null) return UNAVAILABLE;

    const cookieStore = await cookies();
    const cookie = snapshot(
      cookieStore.get(FORMAL_SERVER_SESSION_COOKIE_V1),
      COOKIE_KEYS,
    );
    if (
      !cookie ||
      cookie.name !== FORMAL_SERVER_SESSION_COOKIE_V1 ||
      typeof cookie.value !== 'string' ||
      cookie.value.length === 0
    ) return UNAVAILABLE;

    const verified = snapshot(
      verifyFormalServerSessionCookieClaimsV1({
        cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${cookie.value}`,
        sessionKeyRing:
          runtimeConfig.formalServerSessionKeyRing as FormalServerSessionKeyRingV1,
        now: () => new Date(verificationEpochMs),
      }),
      VERIFIED_RESOLUTION_KEYS,
    );
    if (!verified || verified.kind !== 'verified') return UNAVAILABLE;

    const claims = snapshot(
      consumeFormalServerSessionVerifiedClaimsV1(verified.verifiedClaims),
      CLAIMS_KEYS,
    );
    if (
      !claims ||
      !isInstitutionScopeIdV1(claims.accountId) ||
      !isInstitutionScopeIdV1(claims.tenantId) ||
      !isInstitutionScopeIdV1(claims.institutionId)
    ) return UNAVAILABLE;

    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader: createIdentityAuthoritativeFormalSessionIdentityFactReaderV1(),
      membershipReader: createAccessControlAuthoritativeMembershipFactReaderV1(),
      scopeReader: createTenancyAuthoritativeInstitutionScopeFactReaderV1(),
    });
    if (!isFormalInstitutionSessionContextResolverV1(resolver)) return UNAVAILABLE;

    const context = snapshot(
      await resolver.resolveForSession({
        accountId: claims.accountId,
        tenantId: claims.tenantId,
        institutionId: claims.institutionId,
      }),
      CONTEXT_KEYS,
    );
    if (!context || context.kind !== 'resolved') return UNAVAILABLE;

    const user = snapshot(
      consumeFormalServerSessionUserSnapshotV1(context.snapshot),
      USER_KEYS,
    );
    const membership = snapshot(context.membershipAudit, MEMBERSHIP_KEYS);
    if (
      !user ||
      !membership ||
      user.id !== claims.accountId ||
      user.tenantId !== claims.tenantId ||
      user.institutionId !== claims.institutionId ||
      membership.tenantId !== claims.tenantId ||
      membership.role !== user.role ||
      !isInstitutionScopeIdV1(user.id) ||
      !isInstitutionScopeIdV1(user.tenantId) ||
      !isInstitutionScopeIdV1(user.institutionId) ||
      !isInstitutionScopeIdV1(membership.id) ||
      typeof user.username !== 'string' ||
      user.username.length === 0 ||
      typeof user.name !== 'string'
    ) return UNAVAILABLE;

    if (
      !isInstitutionRoleV1(user.role) ||
      !isInstitutionRoleV1(membership.role)
    ) return FORBIDDEN;
    if (!isRoleInInstitutionSectionAudienceV1(user.role, 'customers')) {
      return FORBIDDEN;
    }

    const policy = createInstitutionActionPolicyV1({});
    const action = policy.authorize({
      objectType: 'customer',
      action: 'read',
      role: user.role,
    });
    if (
      !isInstitutionActionPolicyAllowV1(action) ||
      action.objectType !== 'customer' ||
      action.action !== 'read'
    ) return FORBIDDEN;

    const observedAtEpochMs = readEpochMs();
    if (
      observedAtEpochMs === null ||
      observedAtEpochMs < verificationEpochMs
    ) return UNAVAILABLE;

    const consumption = Object.freeze({
      tenantId: claims.tenantId,
      institutionId: claims.institutionId,
      observedAt: new Date(observedAtEpochMs).toISOString(),
    }) satisfies InstitutionCustomerReadAuthorizationConsumptionV1;
    const authorization = Object.freeze(
      {},
    ) as InstitutionCustomerReadAuthorizationHandleV1;
    handles.add(authorization);
    consumptions.set(authorization, consumption);
    return Object.freeze({ kind: 'allowed' as const, authorization });
  } catch {
    return UNAVAILABLE;
  }
}
