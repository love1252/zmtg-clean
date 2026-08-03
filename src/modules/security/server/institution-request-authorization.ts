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
import type { InstitutionObjectFactReaderV1 } from '@/modules/security/ports/institution-object-fact';
import {
  createInstitutionActionPolicyV1,
  isInstitutionActionPolicyV1,
} from '@/modules/security/server/institution-action-policy';
import { isFormalProvenanceResolverV1 } from '@/modules/security/server/formal-request-provenance-owner';
import { isActiveInstitutionAnchorProviderV1 } from '@/modules/security/server/institution-anchor-provider';
import type { ActiveInstitutionAnchorProviderV1 } from '@/modules/security/server/institution-guard-evidence';
import {
  isInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
} from '@/modules/security/server/institution-guard-reference';
import { isFreshActiveMembershipProviderV1 } from '@/modules/security/server/institution-membership-provider';
import {
  createInstitutionObjectGuardV1,
  isInstitutionObjectFactReaderV1,
  isInstitutionObjectGuardV1,
  type InstitutionObjectAuthorizationInputV1,
  type InstitutionObjectGuardResolutionV1,
  type InstitutionObjectGuardV1,
} from '@/modules/security/server/institution-object-guard';
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

const FACTORY_KEYS = Object.freeze([
  'requestOwner',
  'anchorProvider',
  'referenceCodec',
  'now',
] as const);

const FACTORY_WITH_OBJECT_KEYS = Object.freeze([
  ...FACTORY_KEYS,
  'objectFactReader',
] as const);

const SECTION_INPUT_KEYS = Object.freeze(['sectionId'] as const);
const NAV_INPUT_KEYS = Object.freeze(['targetSectionId'] as const);

declare class AuthorizationSeal {
  private readonly seal;
}

export type InstitutionRequestAuthorizationV1 = AuthorizationSeal &
  Readonly<{
    authorizeCurrentInstitutionSectionV1: (
      input: InstitutionSectionGuardInputV1,
    ) => Promise<InstitutionSectionGuardResolutionV1>;
    authorizeCurrentInstitutionNavigationV1: (
      input: InstitutionNavigationAuthorizationInputV1,
    ) => Promise<InstitutionNavigationAuthorizationV1>;
    authorizeCurrentInstitutionActionV1: (
      input: InstitutionObjectAuthorizationInputV1,
    ) => Promise<InstitutionObjectGuardResolutionV1>;
    authorizeCurrentInstitutionObjectV1: (
      input: InstitutionObjectAuthorizationInputV1,
    ) => Promise<InstitutionObjectGuardResolutionV1>;
  }>;

type Failure = 'scope_unavailable' | 'policy_unavailable';

type Dependencies = Readonly<{
  failure: Failure | null;
  authorizeSection:
    | InstitutionSectionGuardV1['authorizeCurrentSection']
    | null;
  authorizeNavigation:
    | InstitutionSectionGuardV1['authorizeCurrentNavigation']
    | null;
  authorizeObject:
    | InstitutionObjectGuardV1['authorizeCurrentObjectAction']
    | null;
}>;

const authorizations = new WeakSet<object>();

const scopeUnavailable = Object.freeze({
  kind: 'rejected',
  code: 'scope_unavailable',
} as const);

const policyUnavailable = Object.freeze({
  kind: 'rejected',
  code: 'policy_unavailable',
} as const);

const objectUnavailable = Object.freeze({
  kind: 'rejected',
  code: 'object_unavailable',
} as const);

const actionUnregistered = Object.freeze({
  kind: 'rejected',
  code: 'action_unregistered',
} as const);

const blockedNavigationGuard = createInstitutionSectionGuardV1({} as never);

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

function isTrustedNow(value: unknown): value is () => Date {
  try {
    return typeof value === 'function' && !isProxy(value);
  } catch {
    return false;
  }
}

function parseSection(
  value: unknown,
): InstitutionSectionGuardInputV1 | null {
  const input = snapshot(value, SECTION_INPUT_KEYS);
  if (!input || !isInstitutionNavigationSectionIdV1(input.sectionId)) {
    return null;
  }
  return Object.freeze({ sectionId: input.sectionId });
}

function parseNavigation(
  value: unknown,
): InstitutionNavigationAuthorizationInputV1 | null {
  const input = snapshot(value, NAV_INPUT_KEYS);
  if (
    !input ||
    !isInstitutionNavigationSectionIdV1(input.targetSectionId)
  ) {
    return null;
  }
  return Object.freeze({ targetSectionId: input.targetSectionId });
}

function blockedNavigation(
  target: InstitutionNavigationSectionIdV1 | null,
): Promise<InstitutionNavigationAuthorizationV1> {
  return blockedNavigationGuard.authorizeCurrentNavigation(
    target === null ? ({} as never) : { targetSectionId: target },
  );
}

function makeAuthorization(deps: Dependencies): InstitutionRequestAuthorizationV1 {
  async function authorizeObject(
    input: InstitutionObjectAuthorizationInputV1,
  ): Promise<InstitutionObjectGuardResolutionV1> {
    if (deps.failure === 'scope_unavailable') return scopeUnavailable;
    if (deps.failure === 'policy_unavailable') return policyUnavailable;
    if (!deps.authorizeObject) return objectUnavailable;
    try {
      return await deps.authorizeObject(input);
    } catch {
      return objectUnavailable;
    }
  }

  const authorization = Object.freeze({
    async authorizeCurrentInstitutionSectionV1(
      value: InstitutionSectionGuardInputV1,
    ): Promise<InstitutionSectionGuardResolutionV1> {
      const input = parseSection(value);
      if (!input) return actionUnregistered;
      if (deps.failure === 'scope_unavailable') return scopeUnavailable;
      if (deps.failure === 'policy_unavailable') return policyUnavailable;
      if (!deps.authorizeSection) return scopeUnavailable;
      try {
        return await deps.authorizeSection(input);
      } catch {
        return scopeUnavailable;
      }
    },
    async authorizeCurrentInstitutionNavigationV1(
      value: InstitutionNavigationAuthorizationInputV1,
    ): Promise<InstitutionNavigationAuthorizationV1> {
      const input = parseNavigation(value);
      if (!input) return blockedNavigation(null);
      if (deps.failure || !deps.authorizeNavigation) {
        return blockedNavigation(input.targetSectionId);
      }
      try {
        return await deps.authorizeNavigation(input);
      } catch {
        return blockedNavigation(input.targetSectionId);
      }
    },
    authorizeCurrentInstitutionActionV1(
      input: InstitutionObjectAuthorizationInputV1,
    ): Promise<InstitutionObjectGuardResolutionV1> {
      return authorizeObject(input);
    },
    authorizeCurrentInstitutionObjectV1(
      input: InstitutionObjectAuthorizationInputV1,
    ): Promise<InstitutionObjectGuardResolutionV1> {
      return authorizeObject(input);
    },
  });

  authorizations.add(authorization);
  return authorization as unknown as InstitutionRequestAuthorizationV1;
}

function failClosed(failure: Failure): InstitutionRequestAuthorizationV1 {
  return makeAuthorization(
    Object.freeze({
      failure,
      authorizeSection: null,
      authorizeNavigation: null,
      authorizeObject: null,
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
      authorizations.has(value)
    );
  } catch {
    return false;
  }
}

export function createInstitutionRequestAuthorizationV1(input: Readonly<{
  requestOwner: FormalServerSessionRequestOwnerV1;
  anchorProvider: ActiveInstitutionAnchorProviderV1;
  referenceCodec: InstitutionGuardReferenceCodecV1;
  now: () => Date;
  objectFactReader?: InstitutionObjectFactReaderV1 | null;
}>): InstitutionRequestAuthorizationV1 {
  const record =
    snapshot(input, FACTORY_WITH_OBJECT_KEYS) ??
    snapshot(input, FACTORY_KEYS);

  if (!record) return failClosed('scope_unavailable');

  const requestOwner = record.requestOwner;
  const anchorProvider = record.anchorProvider;
  const referenceCodec = record.referenceCodec;
  const now = record.now;

  if (
    !isFormalServerSessionRequestOwnerV1(requestOwner) ||
    !isActiveInstitutionAnchorProviderV1(anchorProvider) ||
    !isTrustedNow(now)
  ) {
    return failClosed('scope_unavailable');
  }

  if (!isInstitutionGuardReferenceCodecV1(referenceCodec)) {
    return failClosed('policy_unavailable');
  }

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

  const actionPolicy = createInstitutionActionPolicyV1({});
  const objectFactReader = isInstitutionObjectFactReaderV1(
    record.objectFactReader,
  )
    ? record.objectFactReader
    : null;

  const objectGuard = createInstitutionObjectGuardV1({
    scopeGuard,
    objectFactReader,
    actionPolicy,
    now,
  });

  return makeAuthorization(
    Object.freeze({
      failure: null,
      authorizeSection: sectionGuard.authorizeCurrentSection,
      authorizeNavigation: sectionGuard.authorizeCurrentNavigation,
      authorizeObject:
        isInstitutionActionPolicyV1(actionPolicy) &&
        isInstitutionObjectGuardV1(objectGuard)
          ? objectGuard.authorizeCurrentObjectAction
          : null,
    }),
  );
}
