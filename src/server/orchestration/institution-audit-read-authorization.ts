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
import { isInstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { isInstitutionScopeIdV1 } from '@/modules/security/domain/institution-access';
import { resolveInstitutionGuardRuntimeConfigV1 } from '@/modules/security/server/institution-guard-runtime-config';
import { createTenancyAuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/application/authoritative-institution-scope-reader';

declare const institutionAuditReadAuthorizationMarkerV1: unique symbol;

export type InstitutionAuditReadAuthorizationHandleV1 = Readonly<{
  readonly [institutionAuditReadAuthorizationMarkerV1]: 'institution_audit_read_authorization_v1';
}>;

export type InstitutionAuditReadAuthorizationConsumptionV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  observedAt: string;
}>;

export type InstitutionAuditReadAuthorizationResolutionV1 =
  | Readonly<{
      kind: 'allowed';
      authorization: InstitutionAuditReadAuthorizationHandleV1;
    }>
  | Readonly<{ kind: 'forbidden' }>
  | Readonly<{ kind: 'unavailable' }>;

const AVAILABLE_RUNTIME_CONFIG_KEYS = Object.freeze([
  'kind',
  'formalServerSessionKeyRing',
  'institutionGuardReferenceKeyRing',
] as const);
const VERIFIED_CLAIMS_RESOLUTION_KEYS = Object.freeze([
  'kind',
  'verifiedClaims',
] as const);
const SESSION_COOKIE_KEYS = Object.freeze(['name', 'value'] as const);
const VERIFIED_CLAIMS_KEYS = Object.freeze([
  'accountId',
  'tenantId',
  'institutionId',
] as const);
const RESOLVED_CONTEXT_KEYS = Object.freeze([
  'kind',
  'snapshot',
  'membershipAudit',
] as const);
const SESSION_USER_KEYS = Object.freeze([
  'id',
  'username',
  'name',
  'role',
  'tenantId',
  'institutionId',
] as const);
const MEMBERSHIP_AUDIT_KEYS = Object.freeze([
  'id',
  'tenantId',
  'role',
] as const);

const authorizationHandlesV1 = new WeakSet<object>();
const authorizationConsumptionsV1 = new WeakMap<
  object,
  InstitutionAuditReadAuthorizationConsumptionV1
>();

const INSTITUTION_AUDIT_READ_FORBIDDEN = Object.freeze({
  kind: 'forbidden',
} as const);
const INSTITUTION_AUDIT_READ_UNAVAILABLE = Object.freeze({
  kind: 'unavailable',
} as const);

function snapshotExactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
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
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== 'string') ||
      expectedKeys.some((key) => !Object.hasOwn(descriptors, key))
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
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

function readTrustedServerEpochMs(): number | null {
  try {
    const epochMs = Date.now();
    if (!Number.isSafeInteger(epochMs)) return null;
    const instant = new Date(epochMs);
    if (Date.prototype.getTime.call(instant) !== epochMs) return null;
    instant.toISOString();
    return epochMs;
  } catch {
    return null;
  }
}

export function isInstitutionAuditReadAuthorizationHandleV1(
  value: unknown,
): value is InstitutionAuditReadAuthorizationHandleV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      authorizationHandlesV1.has(value)
    );
  } catch {
    return false;
  }
}

export function consumeInstitutionAuditReadAuthorizationV1(
  value: unknown,
): InstitutionAuditReadAuthorizationConsumptionV1 | null {
  if (!isInstitutionAuditReadAuthorizationHandleV1(value)) return null;

  const consumption = authorizationConsumptionsV1.get(value);
  if (!consumption) return null;

  authorizationConsumptionsV1.delete(value);
  authorizationHandlesV1.delete(value);
  return consumption;
}

export async function resolveInstitutionAuditReadAuthorizationV1(): Promise<InstitutionAuditReadAuthorizationResolutionV1> {
  try {
    const runtimeConfig = snapshotExactPlainRecord(
      resolveInstitutionGuardRuntimeConfigV1(),
      AVAILABLE_RUNTIME_CONFIG_KEYS,
    );
    if (!runtimeConfig || runtimeConfig.kind !== 'available') {
      return INSTITUTION_AUDIT_READ_UNAVAILABLE;
    }

    const verificationEpochMs = readTrustedServerEpochMs();
    if (verificationEpochMs === null) {
      return INSTITUTION_AUDIT_READ_UNAVAILABLE;
    }

    const cookieStore = await cookies();
    const sessionCookie = snapshotExactPlainRecord(
      cookieStore.get(FORMAL_SERVER_SESSION_COOKIE_V1),
      SESSION_COOKIE_KEYS,
    );
    if (
      !sessionCookie ||
      sessionCookie.name !== FORMAL_SERVER_SESSION_COOKIE_V1 ||
      typeof sessionCookie.value !== 'string' ||
      sessionCookie.value.length === 0
    ) {
      return INSTITUTION_AUDIT_READ_UNAVAILABLE;
    }

    const verifiedResolution = snapshotExactPlainRecord(
      verifyFormalServerSessionCookieClaimsV1({
        cookieHeader: `${FORMAL_SERVER_SESSION_COOKIE_V1}=${sessionCookie.value}`,
        sessionKeyRing:
          runtimeConfig.formalServerSessionKeyRing as FormalServerSessionKeyRingV1,
        now: () => new Date(verificationEpochMs),
      }),
      VERIFIED_CLAIMS_RESOLUTION_KEYS,
    );
    if (!verifiedResolution || verifiedResolution.kind !== 'verified') {
      return INSTITUTION_AUDIT_READ_UNAVAILABLE;
    }

    const verifiedClaims = snapshotExactPlainRecord(
      consumeFormalServerSessionVerifiedClaimsV1(
        verifiedResolution.verifiedClaims,
      ),
      VERIFIED_CLAIMS_KEYS,
    );
    if (
      !verifiedClaims ||
      !isInstitutionScopeIdV1(verifiedClaims.accountId) ||
      !isInstitutionScopeIdV1(verifiedClaims.tenantId) ||
      !isInstitutionScopeIdV1(verifiedClaims.institutionId)
    ) {
      return INSTITUTION_AUDIT_READ_UNAVAILABLE;
    }

    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader:
        createIdentityAuthoritativeFormalSessionIdentityFactReaderV1(),
      membershipReader:
        createAccessControlAuthoritativeMembershipFactReaderV1(),
      scopeReader: createTenancyAuthoritativeInstitutionScopeFactReaderV1(),
    });
    if (!isFormalInstitutionSessionContextResolverV1(resolver)) {
      return INSTITUTION_AUDIT_READ_UNAVAILABLE;
    }

    const contextResolution = snapshotExactPlainRecord(
      await resolver.resolveForSession({
        accountId: verifiedClaims.accountId,
        tenantId: verifiedClaims.tenantId,
        institutionId: verifiedClaims.institutionId,
      }),
      RESOLVED_CONTEXT_KEYS,
    );
    if (!contextResolution || contextResolution.kind !== 'resolved') {
      return INSTITUTION_AUDIT_READ_UNAVAILABLE;
    }

    const sessionUser = snapshotExactPlainRecord(
      consumeFormalServerSessionUserSnapshotV1(contextResolution.snapshot),
      SESSION_USER_KEYS,
    );
    const membershipAudit = snapshotExactPlainRecord(
      contextResolution.membershipAudit,
      MEMBERSHIP_AUDIT_KEYS,
    );
    if (
      !sessionUser ||
      !membershipAudit ||
      sessionUser.id !== verifiedClaims.accountId ||
      sessionUser.tenantId !== verifiedClaims.tenantId ||
      sessionUser.institutionId !== verifiedClaims.institutionId ||
      membershipAudit.tenantId !== verifiedClaims.tenantId ||
      membershipAudit.role !== sessionUser.role ||
      !isInstitutionScopeIdV1(sessionUser.id) ||
      !isInstitutionScopeIdV1(sessionUser.tenantId) ||
      !isInstitutionScopeIdV1(sessionUser.institutionId) ||
      !isInstitutionScopeIdV1(membershipAudit.id) ||
      typeof sessionUser.username !== 'string' ||
      sessionUser.username.length === 0 ||
      typeof sessionUser.name !== 'string' ||
      !isInstitutionRoleV1(sessionUser.role) ||
      !isInstitutionRoleV1(membershipAudit.role)
    ) {
      return INSTITUTION_AUDIT_READ_UNAVAILABLE;
    }

    if (sessionUser.role !== 'tenant_admin') {
      return INSTITUTION_AUDIT_READ_FORBIDDEN;
    }

    const observedAtEpochMs = readTrustedServerEpochMs();
    if (
      observedAtEpochMs === null ||
      observedAtEpochMs < verificationEpochMs
    ) {
      return INSTITUTION_AUDIT_READ_UNAVAILABLE;
    }

    const consumption = Object.freeze({
      tenantId: verifiedClaims.tenantId,
      institutionId: verifiedClaims.institutionId,
      observedAt: new Date(observedAtEpochMs).toISOString(),
    }) satisfies InstitutionAuditReadAuthorizationConsumptionV1;
    const authorization = Object.freeze(
      {},
    ) as InstitutionAuditReadAuthorizationHandleV1;

    authorizationHandlesV1.add(authorization);
    authorizationConsumptionsV1.set(authorization, consumption);
    return Object.freeze({ kind: 'allowed', authorization });
  } catch {
    return INSTITUTION_AUDIT_READ_UNAVAILABLE;
  }
}
