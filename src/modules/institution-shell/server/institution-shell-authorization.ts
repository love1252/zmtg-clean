import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import type { InstitutionNavigationSectionIdV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import {
  isInstitutionNavigationAuthorizationV1,
  matchesInstitutionNavigationAuthorizationScopeV1,
  readInstitutionNavigationWorkspaceScopeKeyV1,
  type InstitutionNavigationAuthorizationV1,
} from '@/modules/security/institution-navigation-authorization';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';

import {
  mapInstitutionAvailableNavigationTargetsV1,
  type InstitutionAvailableNavigationTargetV1,
} from './institution-navigation-target-mapper';

const emptySectionIds = Object.freeze(
  [] as InstitutionNavigationSectionIdV1[],
);
const emptyNavigationTargets = Object.freeze(
  [] as InstitutionAvailableNavigationTargetV1[],
);

export type InstitutionShellAuthorizationV1 = Readonly<{
  availableSectionIds: readonly InstitutionNavigationSectionIdV1[];
  availableNavigationTargets: readonly InstitutionAvailableNavigationTargetV1[];
  capabilityStatus: CapabilityStatusV1 | null;
  workspaceScopeKey: string | null;
}>;

const unavailableShellAuthorization = Object.freeze({
  availableSectionIds: emptySectionIds,
  availableNavigationTargets: emptyNavigationTargets,
  capabilityStatus: null,
  workspaceScopeKey: null,
}) satisfies InstitutionShellAuthorizationV1;

function capabilityUnavailableShellAuthorization(
  availableSectionIds: readonly InstitutionNavigationSectionIdV1[],
): InstitutionShellAuthorizationV1 {
  return Object.freeze({
    availableSectionIds,
    availableNavigationTargets: emptyNavigationTargets,
    capabilityStatus: null,
    workspaceScopeKey: null,
  });
}

function isUsableCapabilityStatusV1(
  status: CapabilityStatusV1 | null,
): status is CapabilityStatusV1 {
  try {
    return Boolean(
      status
      && status.contractVersion === 'v1'
      && status.readiness === 'ready'
      && status.failureCode === null
      && status.data
      && Array.isArray(status.data.capabilities)
      && Array.isArray(status.partitions),
    );
  } catch {
    return false;
  }
}

/**
 * Resolves page-level navigation independently from the current target page decision. A genuine
 * request-scoped navigation decision proves the trusted actor and institution context; the
 * capability snapshot then filters the canonical page targets. Current-page content must still
 * enforce its own targetAccess, page capability, permission, and object guard.
 */
export async function resolveInstitutionShellAuthorizationV1(
  navigationAuthorization: InstitutionNavigationAuthorizationV1 | null,
): Promise<InstitutionShellAuthorizationV1> {
  if (
    !isInstitutionNavigationAuthorizationV1(navigationAuthorization)
    || navigationAuthorization.availableSectionIds.length === 0
  ) {
    return unavailableShellAuthorization;
  }

  const availableSectionIds = navigationAuthorization.availableSectionIds;
  const capabilityStatus =
    await resolveInstitutionCapabilityAuthorityStatusV1().catch(() => null);

  if (!isUsableCapabilityStatusV1(capabilityStatus)) {
    return capabilityUnavailableShellAuthorization(availableSectionIds);
  }

  try {
    if (
      typeof capabilityStatus.scope?.tenantId !== 'string'
      || typeof capabilityStatus.scope?.institutionId !== 'string'
      || !matchesInstitutionNavigationAuthorizationScopeV1(
        navigationAuthorization,
        capabilityStatus.scope.tenantId,
        capabilityStatus.scope.institutionId,
      )
    ) {
      return capabilityUnavailableShellAuthorization(availableSectionIds);
    }
  } catch {
    return capabilityUnavailableShellAuthorization(availableSectionIds);
  }

  let availableNavigationTargets: readonly InstitutionAvailableNavigationTargetV1[];
  try {
    availableNavigationTargets = mapInstitutionAvailableNavigationTargetsV1(
      capabilityStatus,
      availableSectionIds,
    );
  } catch {
    return capabilityUnavailableShellAuthorization(availableSectionIds);
  }
  const workspaceScopeKey =
    readInstitutionNavigationWorkspaceScopeKeyV1(navigationAuthorization);

  return Object.freeze({
    availableSectionIds,
    availableNavigationTargets,
    capabilityStatus,
    workspaceScopeKey,
  });
}
