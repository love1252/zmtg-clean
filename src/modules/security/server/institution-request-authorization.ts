import { isProxy } from 'node:util/types';

import {
  consumeFormalServerSessionRequestOwnerV1,
  isFormalServerSessionRequestOwnerV1,
  type FormalServerSessionRequestOwnerV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import {
  isInstitutionNavigationSectionIdV1,
  type InstitutionNavigationSectionIdV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import { isFormalProvenanceResolverV1 } from '@/modules/security/server/formal-request-provenance-owner';
import { isActiveInstitutionAnchorProviderV1 } from '@/modules/security/server/institution-anchor-provider';
import type { ActiveInstitutionAnchorProviderV1 } from '@/modules/security/server/institution-guard-evidence';
import {
  isInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
} from '@/modules/security/server/institution-guard-reference';
import { isFreshActiveMembershipProviderV1 } from '@/modules/security/server/institution-membership-provider';
import {
  createInstitutionScopeGuardV1,
  isInstitutionScopeGuardV1,
} from '@/modules/security/server/institution-scope-guard';
import {
  createInstitutionSectionGuardV1,
  isInstitutionSectionGuardV1,
  type InstitutionNavigationAuthorizationInputV1,
  type InstitutionNavigationAuthorizationV1,
  type InstitutionSectionGuardInputV1,
  type InstitutionSectionGuardResolutionV1,
  type InstitutionSectionGuardV1,
} from '@/modules/security/server/institution-section-guard';

const FACTORY_INPUT_KEYS = Object.freeze([
  'requestOwner',
  'anchorProvider',
  'referenceCodec',
  'now',
] as const);
const AUTHORIZE_INPUT_KEYS = Object.freeze(['sectionId'] as const);
const NAVIGATION_AUTHORIZE_INPUT_KEYS = Object.freeze([
  'targetSectionId',
] as const);

declare class InstitutionRequestAuthorizationSealV1 {
  private readonly ownerSeal;
}

export type InstitutionRequestAuthorizationV1 =
  InstitutionRequestAuthorizationSealV1 &
    Readonly<{
      authorizeCurrentInstitutionSectionV1: (
        input: InstitutionSectionGuardInputV1,
      ) => Promise<InstitutionSectionGuardResolutionV1>;
      authorizeCurrentInstitutionNavigationV1: (
        input: InstitutionNavigationAuthorizationInputV1,
      ) => Promise<InstitutionNavigationAuthorizationV1>;
    }>;

type PreflightFailureV1 = 'scope_unavailable' | 'policy_unavailable';

type AuthorizationDependenciesV1 = Readonly<{
  preflightFailure: PreflightFailureV1 | null;
  authorizeCurrentSection:
    | InstitutionSectionGuardV1['authorizeCurrentSection']
    | null;
  authorizeCurrentNavigation:
    | InstitutionSectionGuardV1['authorizeCurrentNavigation']
    | null;
}>;

const authenticAuthorizationsV1 = new WeakSet<object>();
const scopeUnavailable = Object.freeze({
  kind: 'rejected',
  code: 'scope_unavailable',
} as const);
const policyUnavailable = Object.freeze({
  kind: 'rejected',
  code: 'policy_unavailable',
} as const);
const actionUnregistered = Object.freeze({
  kind: 'rejected',
  code: 'action_unregistered',
} as const);
const blockedNavigationGuard = createInstitutionSectionGuardV1({} as never);

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

function isTrustedNow(value: unknown): value is () => Date {
  try {
    return typeof value === 'function' && !isProxy(value);
  } catch {
    return false;
  }
}

function preflightResolution(
  code: PreflightFailureV1,
): InstitutionSectionGuardResolutionV1 {
  return code === 'policy_unavailable'
    ? policyUnavailable
    : scopeUnavailable;
}

function parseAuthorizeInput(
  value: unknown,
): InstitutionSectionGuardInputV1 | null {
  const snapshot = snapshotExactPlainRecord(value, AUTHORIZE_INPUT_KEYS);
  if (!snapshot || !isInstitutionNavigationSectionIdV1(snapshot.sectionId)) {
    return null;
  }
  return Object.freeze({ sectionId: snapshot.sectionId });
}

function parseNavigationAuthorizeInput(
  value: unknown,
): InstitutionNavigationAuthorizationInputV1 | null {
  const snapshot = snapshotExactPlainRecord(
    value,
    NAVIGATION_AUTHORIZE_INPUT_KEYS,
  );
  if (
    !snapshot ||
    !isInstitutionNavigationSectionIdV1(snapshot.targetSectionId)
  ) {
    return null;
  }
  return Object.freeze({ targetSectionId: snapshot.targetSectionId });
}

function blockedNavigation(
  targetSectionId: InstitutionNavigationSectionIdV1 | null,
): Promise<InstitutionNavigationAuthorizationV1> {
  return blockedNavigationGuard.authorizeCurrentNavigation(
    targetSectionId === null ? ({} as never) : { targetSectionId },
  );
}

function createAuthorizationHandle(
  dependencies: AuthorizationDependenciesV1,
): InstitutionRequestAuthorizationV1 {
  const authorization = Object.freeze({
    async authorizeCurrentInstitutionSectionV1(
      input: InstitutionSectionGuardInputV1,
    ): Promise<InstitutionSectionGuardResolutionV1> {
      const authorizeInput = parseAuthorizeInput(input);
      if (!authorizeInput) return actionUnregistered;
      if (dependencies.preflightFailure) {
        return preflightResolution(dependencies.preflightFailure);
      }
      if (!dependencies.authorizeCurrentSection) return scopeUnavailable;
      try {
        return await dependencies.authorizeCurrentSection(authorizeInput);
      } catch {
        return scopeUnavailable;
      }
    },
    async authorizeCurrentInstitutionNavigationV1(
      input: InstitutionNavigationAuthorizationInputV1,
    ): Promise<InstitutionNavigationAuthorizationV1> {
      const authorizeInput = parseNavigationAuthorizeInput(input);
      if (!authorizeInput) return blockedNavigation(null);
      if (
        dependencies.preflightFailure ||
        !dependencies.authorizeCurrentNavigation
      ) {
        return blockedNavigation(authorizeInput.targetSectionId);
      }
      try {
        return await dependencies.authorizeCurrentNavigation(authorizeInput);
      } catch {
        return blockedNavigation(authorizeInput.targetSectionId);
      }
    },
  });
  authenticAuthorizationsV1.add(authorization);
  return authorization as unknown as InstitutionRequestAuthorizationV1;
}

function failClosed(
  preflightFailure: PreflightFailureV1,
): InstitutionRequestAuthorizationV1 {
  return createAuthorizationHandle(
    Object.freeze({
      preflightFailure,
      authorizeCurrentSection: null,
      authorizeCurrentNavigation: null,
    }),
  );
}

export function isInstitutionRequestAuthorizationV1(
  value: unknown,
): value is InstitutionRequestAuthorizationV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      authenticAuthorizationsV1.has(value)
    );
  } catch {
    return false;
  }
}

/**
 * Consumes one genuine formal-session request owner and composes its two private child handles
 * through the central scope and section guards. Callers can request only a registered target;
 * raw account, scope, role, evidence, providers, policy material and key material never leave
 * this root.
 */
export function createInstitutionRequestAuthorizationV1(input: Readonly<{
  requestOwner: FormalServerSessionRequestOwnerV1;
  anchorProvider: ActiveInstitutionAnchorProviderV1;
  referenceCodec: InstitutionGuardReferenceCodecV1;
  now: () => Date;
}>): InstitutionRequestAuthorizationV1 {
  const snapshot = snapshotExactPlainRecord(input, FACTORY_INPUT_KEYS);
  if (!snapshot) return failClosed('scope_unavailable');

  const requestOwner = snapshot.requestOwner;
  const anchorProvider = snapshot.anchorProvider;
  const referenceCodec = snapshot.referenceCodec;
  const now = snapshot.now;

  const genuineRequestOwner = isFormalServerSessionRequestOwnerV1(requestOwner);
  const genuineAnchorProvider = isActiveInstitutionAnchorProviderV1(anchorProvider);
  const genuineReferenceCodec =
    isInstitutionGuardReferenceCodecV1(referenceCodec);
  const trustedNow = isTrustedNow(now);

  if (!genuineRequestOwner || !genuineAnchorProvider || !trustedNow) {
    return failClosed('scope_unavailable');
  }
  if (!genuineReferenceCodec) return failClosed('policy_unavailable');

  let consumption: ReturnType<
    typeof consumeFormalServerSessionRequestOwnerV1
  > = null;
  try {
    consumption = consumeFormalServerSessionRequestOwnerV1(requestOwner);
  } catch {
    consumption = null;
  }
  if (
    !consumption ||
    !isFormalProvenanceResolverV1(consumption.provenanceResolver) ||
    !isFreshActiveMembershipProviderV1(consumption.membershipProvider)
  ) {
    return failClosed('scope_unavailable');
  }

  const scopeGuard = createInstitutionScopeGuardV1({
    provenanceResolver: consumption.provenanceResolver,
    membershipProvider: consumption.membershipProvider,
    anchorProvider,
    now,
  });
  if (!isInstitutionScopeGuardV1(scopeGuard)) {
    return failClosed('scope_unavailable');
  }
  const sectionGuard = createInstitutionSectionGuardV1({
    scopeGuard,
    referenceCodec,
    now,
  });
  if (!isInstitutionSectionGuardV1(sectionGuard)) {
    return failClosed('scope_unavailable');
  }

  return createAuthorizationHandle(
    Object.freeze({
      preflightFailure: null,
      authorizeCurrentSection: sectionGuard.authorizeCurrentSection,
      authorizeCurrentNavigation: sectionGuard.authorizeCurrentNavigation,
    }),
  );
}
