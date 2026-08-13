import { isProxy } from 'node:util/types';

import { cookies } from 'next/headers';

import {
  mintAttemptedInstitutionDenialAttributionForOrchestrationV1,
  mintVerifiedInstitutionAuditAttributionForOrchestrationV1,
  type AttemptedInstitutionDenialAttributionHandleV1,
  type VerifiedInstitutionAuditAttributionHandleV1,
} from '@/modules/audit/domain/audit-events';

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
import { isInstitutionScopeIdV1 } from '@/modules/security/domain/institution-access';
import { resolveInstitutionGuardRuntimeConfigV1 } from '@/modules/security/server/institution-guard-runtime-config';
import { createTenancyAuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/application/authoritative-institution-scope-reader';

declare const institutionAuditWriterFormalScopeMarkerV1: unique symbol;

export type InstitutionAuditWriterFormalScopeHandleV1 = Readonly<{
  readonly [institutionAuditWriterFormalScopeMarkerV1]: 'institution_audit_writer_formal_scope_v1';
}>;

export type InstitutionAuditWriterFormalScopeConsumptionV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  observedAt: string;
}>;

export type InstitutionAuditWriterAttemptedDenialResolutionV1 = Readonly<{
  attribution: AttemptedInstitutionDenialAttributionHandleV1;
  attemptedPair: Readonly<{ tenantId: string; institutionId: string }>;
}>;

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

const formalScopeHandlesV1 = new WeakSet<object>();
const formalScopeConsumptionsV1 = new WeakMap<
  object,
  InstitutionAuditWriterFormalScopeConsumptionV1
>();

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

export function isInstitutionAuditWriterFormalScopeHandleV1(
  value: unknown,
): value is InstitutionAuditWriterFormalScopeHandleV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      formalScopeHandlesV1.has(value)
    );
  } catch {
    return false;
  }
}

export function consumeInstitutionAuditWriterFormalScopeV1(
  value: unknown,
): InstitutionAuditWriterFormalScopeConsumptionV1 | null {
  if (!isInstitutionAuditWriterFormalScopeHandleV1(value)) return null;

  const consumption = formalScopeConsumptionsV1.get(value);
  if (!consumption) return null;

  formalScopeConsumptionsV1.delete(value);
  formalScopeHandlesV1.delete(value);
  return consumption;
}

export async function resolveInstitutionAuditWriterFormalScopeV1(): Promise<InstitutionAuditWriterFormalScopeHandleV1 | null> {
  try {
    const runtimeConfig = snapshotExactPlainRecord(
      resolveInstitutionGuardRuntimeConfigV1(),
      AVAILABLE_RUNTIME_CONFIG_KEYS,
    );
    if (!runtimeConfig || runtimeConfig.kind !== 'available') return null;

    const verificationEpochMs = readTrustedServerEpochMs();
    if (verificationEpochMs === null) return null;

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
      return null;
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
      return null;
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
      return null;
    }

    const resolver = createFormalInstitutionSessionContextResolverV1({
      identityReader:
        createIdentityAuthoritativeFormalSessionIdentityFactReaderV1(),
      membershipReader:
        createAccessControlAuthoritativeMembershipFactReaderV1(),
      scopeReader: createTenancyAuthoritativeInstitutionScopeFactReaderV1(),
    });
    if (!isFormalInstitutionSessionContextResolverV1(resolver)) return null;

    const contextResolution = snapshotExactPlainRecord(
      await resolver.resolveForSession({
        accountId: verifiedClaims.accountId,
        tenantId: verifiedClaims.tenantId,
        institutionId: verifiedClaims.institutionId,
      }),
      RESOLVED_CONTEXT_KEYS,
    );
    if (!contextResolution || contextResolution.kind !== 'resolved') {
      return null;
    }

    const sessionUser = snapshotExactPlainRecord(
      consumeFormalServerSessionUserSnapshotV1(contextResolution.snapshot),
      SESSION_USER_KEYS,
    );
    if (
      !sessionUser ||
      sessionUser.id !== verifiedClaims.accountId ||
      sessionUser.tenantId !== verifiedClaims.tenantId ||
      sessionUser.institutionId !== verifiedClaims.institutionId ||
      !isInstitutionScopeIdV1(sessionUser.id) ||
      !isInstitutionScopeIdV1(sessionUser.tenantId) ||
      !isInstitutionScopeIdV1(sessionUser.institutionId)
    ) {
      return null;
    }

    const observedAtEpochMs = readTrustedServerEpochMs();
    if (
      observedAtEpochMs === null ||
      observedAtEpochMs < verificationEpochMs
    ) {
      return null;
    }

    const consumption = Object.freeze({
      tenantId: verifiedClaims.tenantId,
      institutionId: verifiedClaims.institutionId,
      observedAt: new Date(observedAtEpochMs).toISOString(),
    }) satisfies InstitutionAuditWriterFormalScopeConsumptionV1;
    const handle = Object.freeze(
      {},
    ) as InstitutionAuditWriterFormalScopeHandleV1;

    formalScopeHandlesV1.add(handle);
    formalScopeConsumptionsV1.set(handle, consumption);
    return handle;
  } catch {
    return null;
  }
}

export async function resolveInstitutionAuditWriterVerifiedAttributionV1(
  businessPair: Readonly<{ tenantId: string; institutionId: string }>,
): Promise<VerifiedInstitutionAuditAttributionHandleV1 | null> {
  try {
    const formalScope = await resolveInstitutionAuditWriterFormalScopeV1();
    if (!formalScope) return null;
    const formalPair = consumeInstitutionAuditWriterFormalScopeV1(formalScope);
    if (!formalPair) return null;
    return mintVerifiedInstitutionAuditAttributionForOrchestrationV1({
      formalPair,
      businessPair,
    });
  } catch {
    return null;
  }
}

export async function resolveInstitutionAuditWriterAttemptedDenialAttributionV1(): Promise<InstitutionAuditWriterAttemptedDenialResolutionV1 | null> {
  try {
    const runtimeConfig = snapshotExactPlainRecord(
      resolveInstitutionGuardRuntimeConfigV1(),
      AVAILABLE_RUNTIME_CONFIG_KEYS,
    );
    if (!runtimeConfig || runtimeConfig.kind !== 'available') return null;

    const verificationEpochMs = readTrustedServerEpochMs();
    if (verificationEpochMs === null) return null;

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
      return null;
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
    if (!verifiedResolution || verifiedResolution.kind !== 'verified') return null;

    const verifiedClaims = snapshotExactPlainRecord(
      consumeFormalServerSessionVerifiedClaimsV1(verifiedResolution.verifiedClaims),
      VERIFIED_CLAIMS_KEYS,
    );
    if (
      !verifiedClaims ||
      !isInstitutionScopeIdV1(verifiedClaims.accountId) ||
      !isInstitutionScopeIdV1(verifiedClaims.tenantId) ||
      !isInstitutionScopeIdV1(verifiedClaims.institutionId)
    ) {
      return null;
    }

    const attemptedPair = Object.freeze({
      tenantId: verifiedClaims.tenantId,
      institutionId: verifiedClaims.institutionId,
    });
    const attribution = mintAttemptedInstitutionDenialAttributionForOrchestrationV1({
      signedSessionPair: attemptedPair,
    });
    if (!attribution) return null;
    return Object.freeze({ attribution, attemptedPair });
  } catch {
    return null;
  }
}
