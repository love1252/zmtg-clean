import { isProxy } from 'node:util/types';

import { cookies } from 'next/headers';

import {
  createCustomerObjectFactReaderV1,
  createCustomerObjectFactSourceV1,
} from '@/modules/customers/application/customer-object-fact-reader';
import {
  createAccessControlAuthoritativeMembershipFactReaderV1,
} from '@/modules/access-control/application/authoritative-membership-reader';
import { createIdentityAuthoritativeFormalSessionIdentityFactReaderV1 } from '@/modules/auth/application/authoritative-formal-session-identity-reader';
import {
  consumeFormalServerSessionVerifiedClaimsV1,
  createFormalServerSessionRequestOwnerV1,
  FORMAL_SERVER_SESSION_COOKIE_V1,
  verifyFormalServerSessionCookieClaimsV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import {
  isInstitutionNavigationSectionIdV1,
  type InstitutionNavigationSectionIdV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import {
  createActiveInstitutionAnchorProviderV1,
} from '@/modules/security/server/institution-anchor-provider';
import { INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1 } from '@/modules/security/server/institution-guard-evidence';
import { createInstitutionGuardReferenceCodecV1 } from '@/modules/security/server/institution-guard-reference';
import { resolveInstitutionGuardRuntimeConfigV1 } from '@/modules/security/server/institution-guard-runtime-config';
import {
  createInstitutionRequestAuthorizationV1,
  isInstitutionRequestAuthorizationV1,
  type InstitutionRequestAuthorizationV1,
} from '@/modules/security/server/institution-request-authorization';
import { createTenancyAuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/application/authoritative-institution-scope-reader';
import {
  createTenantBusinessRepository,
} from '@/modules/institution/server/tenant-business-repository';
import { getDatabase } from '@/server/db/client';

const RUNTIME_CONFIG_KEYS = Object.freeze([
  'kind',
  'formalServerSessionKeyRing',
  'institutionGuardReferenceKeyRing',
] as const);
const FORMAL_KEY_RING_KEYS = Object.freeze([
  'currentKey',
  'verifyOnlyKeys',
] as const);
const GUARD_KEY_RING_KEYS = Object.freeze([
  'currentIssueKey',
  'verifyOnlyKeys',
] as const);
const CURRENT_KEY_KEYS = Object.freeze(['keyVersion', 'keyMaterial'] as const);
const VERIFY_ONLY_KEY_KEYS = Object.freeze([
  'keyVersion',
  'keyMaterial',
  'verifyUntil',
] as const);
const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAX_VERIFY_ONLY_KEYS = 16;
const HMAC_KEY_BYTES = 32;

type AvailableRuntimeConfigV1 = Extract<
  ReturnType<typeof resolveInstitutionGuardRuntimeConfigV1>,
  Readonly<{ kind: 'available' }>
>;

function snapshotFrozenExactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      isProxy(value) ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      !Object.isFrozen(value)
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(
      value,
    ) as unknown as Record<PropertyKey, PropertyDescriptor>;
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== 'string') ||
      expectedKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(descriptors, key),
      )
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !descriptor.enumerable ||
        descriptor.configurable ||
        !('value' in descriptor) ||
        descriptor.writable
      ) {
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

function snapshotFrozenDenseArray(value: unknown): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      !Object.isFrozen(value)
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(
      value,
    ) as unknown as Record<PropertyKey, PropertyDescriptor>;
    const lengthDescriptor = descriptors.length;
    if (
      !lengthDescriptor ||
      lengthDescriptor.enumerable ||
      lengthDescriptor.configurable ||
      !('value' in lengthDescriptor) ||
      lengthDescriptor.writable ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0 ||
      lengthDescriptor.value > MAX_VERIFY_ONLY_KEYS ||
      Reflect.ownKeys(descriptors).length !== lengthDescriptor.value + 1
    ) {
      return null;
    }

    const snapshot: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = descriptors[String(index)];
      if (
        !descriptor ||
        !descriptor.enumerable ||
        descriptor.configurable ||
        !('value' in descriptor) ||
        descriptor.writable
      ) {
        return null;
      }
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function isExactHmacKeyMaterial(value: unknown): value is Uint8Array {
  try {
    const keyMaterial = value as Uint8Array;
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      Object.getPrototypeOf(value) === Uint8Array.prototype &&
      keyMaterial.byteLength === HMAC_KEY_BYTES &&
      keyMaterial.length === HMAC_KEY_BYTES
    );
  } catch {
    return false;
  }
}

function isCanonicalKeyVersion(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= 999
  );
}

function isAcceptedInstitutionGuardKeyVersion(
  value: unknown,
): value is number {
  return (
    isCanonicalKeyVersion(value) &&
    INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1.some(
      (accepted) => accepted === value,
    )
  );
}

function snapshotExactCurrentKeyVersion(
  value: unknown,
  isValidKeyVersion: (candidate: unknown) => candidate is number,
): number | null {
  const snapshot = snapshotFrozenExactPlainRecord(value, CURRENT_KEY_KEYS);
  if (
    !snapshot ||
    !isValidKeyVersion(snapshot.keyVersion) ||
    !isExactHmacKeyMaterial(snapshot.keyMaterial)
  ) {
    return null;
  }
  return snapshot.keyVersion;
}

function isCanonicalFutureInstant(
  value: unknown,
  nowEpochMs: number,
): value is string {
  try {
    if (typeof value !== 'string' || !CANONICAL_UTC_INSTANT.test(value)) {
      return false;
    }
    const epochMs = Date.parse(value);
    return (
      Number.isFinite(epochMs) &&
      new Date(epochMs).toISOString() === value &&
      epochMs > nowEpochMs
    );
  } catch {
    return false;
  }
}

function readCurrentEpochMs(): number | null {
  try {
    const epochMs = Date.now();
    return Number.isFinite(epochMs) ? epochMs : null;
  } catch {
    return null;
  }
}

function hasExactVerifyOnlyKeys(
  value: unknown,
  currentKeyVersion: number,
  nowEpochMs: number,
  isValidKeyVersion: (candidate: unknown) => candidate is number,
  requireOlderVersion: boolean,
): boolean {
  const entries = snapshotFrozenDenseArray(value);
  if (!entries) return false;
  const versions = new Set<number>([currentKeyVersion]);
  for (const entry of entries) {
    const snapshot = snapshotFrozenExactPlainRecord(
      entry,
      VERIFY_ONLY_KEY_KEYS,
    );
    if (
      !snapshot ||
      !isValidKeyVersion(snapshot.keyVersion) ||
      versions.has(snapshot.keyVersion) ||
      (requireOlderVersion && snapshot.keyVersion >= currentKeyVersion) ||
      !isExactHmacKeyMaterial(snapshot.keyMaterial) ||
      !isCanonicalFutureInstant(snapshot.verifyUntil, nowEpochMs)
    ) {
      return false;
    }
    versions.add(snapshot.keyVersion);
  }
  return true;
}

function snapshotAvailableRuntimeConfig(
  value: unknown,
): AvailableRuntimeConfigV1 | null {
  const snapshot = snapshotFrozenExactPlainRecord(value, RUNTIME_CONFIG_KEYS);
  if (!snapshot || snapshot.kind !== 'available') return null;

  const formalKeyRing = snapshotFrozenExactPlainRecord(
    snapshot.formalServerSessionKeyRing,
    FORMAL_KEY_RING_KEYS,
  );
  const guardKeyRing = snapshotFrozenExactPlainRecord(
    snapshot.institutionGuardReferenceKeyRing,
    GUARD_KEY_RING_KEYS,
  );
  if (!formalKeyRing || !guardKeyRing) return null;

  const nowEpochMs = readCurrentEpochMs();
  const formalCurrentVersion = snapshotExactCurrentKeyVersion(
    formalKeyRing.currentKey,
    isCanonicalKeyVersion,
  );
  const guardCurrentVersion = snapshotExactCurrentKeyVersion(
    guardKeyRing.currentIssueKey,
    isAcceptedInstitutionGuardKeyVersion,
  );
  if (
    nowEpochMs === null ||
    formalCurrentVersion === null ||
    guardCurrentVersion === null ||
    !hasExactVerifyOnlyKeys(
      formalKeyRing.verifyOnlyKeys,
      formalCurrentVersion,
      nowEpochMs,
      isCanonicalKeyVersion,
      true,
    ) ||
    !hasExactVerifyOnlyKeys(
      guardKeyRing.verifyOnlyKeys,
      guardCurrentVersion,
      nowEpochMs,
      isAcceptedInstitutionGuardKeyVersion,
      false,
    )
  ) {
    return null;
  }

  return value as AvailableRuntimeConfigV1;
}

/**
 * Server-only institution authorization root. Configuration is validated before cookies, and
 * persistence remains lazy until a genuine authorization performs its first scope resolution.
 */
export async function resolveInstitutionServerAuthorizationV1(): Promise<InstitutionRequestAuthorizationV1 | null> {
  let runtimeConfig: AvailableRuntimeConfigV1 | null = null;
  try {
    runtimeConfig = snapshotAvailableRuntimeConfig(
      resolveInstitutionGuardRuntimeConfigV1(),
    );
  } catch {
    return null;
  }
  if (!runtimeConfig) return null;

  let cookieHeader: string | null;
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(FORMAL_SERVER_SESSION_COOKIE_V1);
    cookieHeader =
      typeof sessionCookie?.value === 'string'
        ? `${FORMAL_SERVER_SESSION_COOKIE_V1}=${sessionCookie.value}`
        : null;
  } catch {
    return null;
  }

  try {
    const now = () => new Date(Date.now());
    const customerObjectFactSource =
      createCustomerObjectFactSourceV1({
        async resolve(input) {
          const repository = createTenantBusinessRepository(
            getDatabase(),
          );
          return repository.getCustomerObjectFactSourceByScope(input);
        },
      });
    const objectFactReader = createCustomerObjectFactReaderV1({
      source: customerObjectFactSource,
      now,
    });
    const referenceCodec = createInstitutionGuardReferenceCodecV1({
      keyRing: runtimeConfig.institutionGuardReferenceKeyRing,
      now,
    });
    const membershipFactReader =
      createAccessControlAuthoritativeMembershipFactReaderV1();
    const identityFactReader =
      createIdentityAuthoritativeFormalSessionIdentityFactReaderV1();
    const requestOwner = createFormalServerSessionRequestOwnerV1({
      cookieHeader,
      sessionKeyRing: runtimeConfig.formalServerSessionKeyRing,
      identityFactReader,
      membershipFactReader,
      referenceCodec,
      now,
    });
    const anchorFactReader =
      createTenancyAuthoritativeInstitutionScopeFactReaderV1();
    const anchorProvider = createActiveInstitutionAnchorProviderV1({
      factReader: anchorFactReader,
      referenceCodec,
      now,
    });
    const authorization = createInstitutionRequestAuthorizationV1({
      requestOwner,
      anchorProvider,
      referenceCodec,
      now,
      objectFactReader,
    });

    return isInstitutionRequestAuthorizationV1(authorization)
      ? authorization
      : null;
  } catch {
    return null;
  }
}

declare class InstitutionCapabilityAuthorityRuntimeContextSealV1 {
  private readonly authorityContextSeal;
}

export type InstitutionCapabilityAuthorityRuntimeContextV1 =
  InstitutionCapabilityAuthorityRuntimeContextSealV1 &
    Readonly<{
      kind: 'institution_capability_authority_runtime_context';
    }>;

export type InstitutionCapabilityAuthorityRuntimeContextConsumptionV1 =
  Readonly<{
    tenantId: string;
    institutionId: string;
    availableSectionIds: readonly InstitutionNavigationSectionIdV1[];
    observedAt: string;
  }>;

const institutionCapabilityAuthorityRuntimeContextHandlesV1 =
  new WeakSet<object>();
const institutionCapabilityAuthorityRuntimeContextConsumptionsV1 =
  new WeakMap<
    object,
    InstitutionCapabilityAuthorityRuntimeContextConsumptionV1
  >();

export function isInstitutionCapabilityAuthorityRuntimeContextV1(
  value: unknown,
): value is InstitutionCapabilityAuthorityRuntimeContextV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      institutionCapabilityAuthorityRuntimeContextHandlesV1.has(value)
    );
  } catch {
    return false;
  }
}

export function consumeInstitutionCapabilityAuthorityRuntimeContextV1(
  value: unknown,
): InstitutionCapabilityAuthorityRuntimeContextConsumptionV1 | null {
  if (!isInstitutionCapabilityAuthorityRuntimeContextV1(value)) return null;

  const consumption =
    institutionCapabilityAuthorityRuntimeContextConsumptionsV1.get(value);
  if (!consumption) return null;

  institutionCapabilityAuthorityRuntimeContextConsumptionsV1.delete(value);
  institutionCapabilityAuthorityRuntimeContextHandlesV1.delete(value);
  return consumption;
}

function snapshotCanonicalNavigationSectionsV1(
  value: unknown,
): readonly InstitutionNavigationSectionIdV1[] | null {
  const snapshot = snapshotFrozenDenseArray(value);
  if (
    !snapshot ||
    snapshot.length === 0 ||
    snapshot.some((sectionId) => !isInstitutionNavigationSectionIdV1(sectionId))
  ) {
    return null;
  }

  const sections = snapshot as readonly InstitutionNavigationSectionIdV1[];
  if (
    new Set(sections).size !== sections.length ||
    !sections.some((sectionId) => sectionId === 'workbench')
  ) {
    return null;
  }

  return Object.freeze([...sections]);
}

/**
 * Server-only current authority context for POST-V2-R1A orchestration.
 *
 * It resolves the same genuine request-bound Security authorization root, verifies the formal
 * session scope independently, consumes one canonical Navigation Authorization, and mints a
 * one-shot opaque context. No raw scope, role, release flag, capability dimension, or Route input
 * is accepted.
 */
export async function resolveInstitutionCapabilityAuthorityRuntimeContextV1(): Promise<InstitutionCapabilityAuthorityRuntimeContextV1 | null> {
  let runtimeConfig: AvailableRuntimeConfigV1 | null = null;
  try {
    runtimeConfig = snapshotAvailableRuntimeConfig(
      resolveInstitutionGuardRuntimeConfigV1(),
    );
  } catch {
    return null;
  }
  if (!runtimeConfig) return null;

  let cookieHeader: string | null;
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(FORMAL_SERVER_SESSION_COOKIE_V1);
    cookieHeader =
      typeof sessionCookie?.value === 'string'
        ? `${FORMAL_SERVER_SESSION_COOKIE_V1}=${sessionCookie.value}`
        : null;
  } catch {
    return null;
  }

  try {
    const now = () => new Date(Date.now());

    const verifiedClaimsResolution =
      verifyFormalServerSessionCookieClaimsV1({
        cookieHeader,
        sessionKeyRing: runtimeConfig.formalServerSessionKeyRing,
        now,
      });
    if (verifiedClaimsResolution.kind !== 'verified') return null;

    const customerObjectFactSource =
      createCustomerObjectFactSourceV1({
        async resolve(input) {
          const repository = createTenantBusinessRepository(getDatabase());
          return repository.getCustomerObjectFactSourceByScope(input);
        },
      });
    const objectFactReader = createCustomerObjectFactReaderV1({
      source: customerObjectFactSource,
      now,
    });
    const referenceCodec = createInstitutionGuardReferenceCodecV1({
      keyRing: runtimeConfig.institutionGuardReferenceKeyRing,
      now,
    });
    const membershipFactReader =
      createAccessControlAuthoritativeMembershipFactReaderV1();
    const identityFactReader =
      createIdentityAuthoritativeFormalSessionIdentityFactReaderV1();
    const requestOwner = createFormalServerSessionRequestOwnerV1({
      cookieHeader,
      sessionKeyRing: runtimeConfig.formalServerSessionKeyRing,
      identityFactReader,
      membershipFactReader,
      referenceCodec,
      now,
    });
    const anchorFactReader =
      createTenancyAuthoritativeInstitutionScopeFactReaderV1();
    const anchorProvider = createActiveInstitutionAnchorProviderV1({
      factReader: anchorFactReader,
      referenceCodec,
      now,
    });
    const authorization = createInstitutionRequestAuthorizationV1({
      requestOwner,
      anchorProvider,
      referenceCodec,
      now,
      objectFactReader,
    });
    if (!isInstitutionRequestAuthorizationV1(authorization)) return null;

    const navigation =
      await authorization.authorizeCurrentInstitutionNavigationV1({
        targetSectionId: 'workbench',
      });

    const navigationSnapshot = snapshotFrozenExactPlainRecord(
      navigation,
      [
        'kind',
        'targetSectionId',
        'targetAccess',
        'availableSectionIds',
      ],
    );
    if (
      !navigationSnapshot ||
      navigationSnapshot.kind !== 'institution_navigation_authorization' ||
      navigationSnapshot.targetSectionId !== 'workbench' ||
      navigationSnapshot.targetAccess !== 'allowed'
    ) {
      return null;
    }

    const availableSectionIds = snapshotCanonicalNavigationSectionsV1(
      navigationSnapshot.availableSectionIds,
    );
    if (!availableSectionIds) return null;

    const scope = consumeFormalServerSessionVerifiedClaimsV1(
      verifiedClaimsResolution.verifiedClaims,
    );
    if (
      !scope ||
      typeof scope.tenantId !== 'string' ||
      scope.tenantId.length === 0 ||
      typeof scope.institutionId !== 'string' ||
      scope.institutionId.length === 0
    ) {
      return null;
    }

    const observedAtEpochMs = readCurrentEpochMs();
    if (observedAtEpochMs === null) return null;
    const observedAt = new Date(observedAtEpochMs).toISOString();

    const consumption = Object.freeze({
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      availableSectionIds,
      observedAt,
    } satisfies InstitutionCapabilityAuthorityRuntimeContextConsumptionV1);

    const context = Object.freeze({
      kind: 'institution_capability_authority_runtime_context',
    }) as unknown as InstitutionCapabilityAuthorityRuntimeContextV1;

    institutionCapabilityAuthorityRuntimeContextHandlesV1.add(context);
    institutionCapabilityAuthorityRuntimeContextConsumptionsV1.set(
      context,
      consumption,
    );

    return context;
  } catch {
    return null;
  }
}
