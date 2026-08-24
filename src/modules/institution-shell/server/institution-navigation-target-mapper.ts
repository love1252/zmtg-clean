import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import {
  INSTITUTION_CAPABILITY_REGISTRY_V1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import {
  isInstitutionNavigationSectionIdV1,
  type InstitutionNavigationSectionIdV1,
} from '@/modules/institution-contracts/v1/institution-navigation';

export type InstitutionAvailableNavigationTargetV1 = Readonly<{
  pathname: string;
  label: string;
  sectionId: InstitutionNavigationSectionIdV1;
}>;

const emptyTargets = Object.freeze([]) as readonly InstitutionAvailableNavigationTargetV1[];

/**
 * Maps an authoritative server capability snapshot to canonical page targets. This mapper never
 * grants access: every target page and dynamic object route must still reauthorize on the server.
 */
export function mapInstitutionAvailableNavigationTargetsV1(
  status: CapabilityStatusV1 | null,
  availableSectionIds: readonly InstitutionNavigationSectionIdV1[],
): readonly InstitutionAvailableNavigationTargetV1[] {
  const sectionIds = new Set<InstitutionNavigationSectionIdV1>();
  for (const sectionId of availableSectionIds) {
    if (!isInstitutionNavigationSectionIdV1(sectionId) || sectionIds.has(sectionId)) {
      return emptyTargets;
    }
    sectionIds.add(sectionId);
  }

  if (
    sectionIds.size === 0
    || !status
    || status.contractVersion !== 'v1'
    || status.readiness !== 'ready'
    || status.failureCode !== null
    || !status.data
  ) {
    return emptyTargets;
  }

  const targets: InstitutionAvailableNavigationTargetV1[] = [];
  for (const definition of INSTITUTION_CAPABILITY_REGISTRY_V1) {
    if (definition.kind !== 'page' || !sectionIds.has(definition.sectionId)) continue;

    const capabilities = status.data.capabilities.filter(
      (capability) => capability.key === definition.key,
    );
    const partitions = status.partitions.filter(
      (partition) => partition.key === definition.key,
    );
    if (capabilities.length !== 1 || partitions.length !== 1) continue;

    const capability = capabilities[0];
    const partition = partitions[0];
    if (
      !capability
      || !partition
      || capability.decision === 'hidden'
      || capability.dimensions.institutionAuthorization !== 'authorized'
      || (
        capability.dimensions.productionRelease !== 'pilot_released'
        && capability.dimensions.productionRelease !== 'released'
      )
      || partition.readiness !== 'ready'
      || partition.failureCode !== null
    ) {
      continue;
    }

    targets.push(Object.freeze({
      pathname: definition.href,
      label: definition.label,
      sectionId: definition.sectionId,
    }));
  }

  return targets.length > 0 ? Object.freeze(targets) : emptyTargets;
}
