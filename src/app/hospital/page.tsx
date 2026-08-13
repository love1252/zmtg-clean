import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import type { InstitutionNavigationSectionIdV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import { InstitutionWorkbenchCapabilityOff } from '@/modules/institution-workbench/components/InstitutionWorkbenchCapabilityOff';
import { buildWorkbenchCapabilityProjection } from '@/modules/institution-workbench/domain/workbench-capability-projection';
import type { WorkbenchCapabilityProjection } from '@/modules/institution-workbench/domain/workbench-capability-view-models';
import { isInstitutionRequestAuthorizationV1 } from '@/modules/security/server/institution-request-authorization';
import {
  isInstitutionNavigationAuthorizationV1,
  type InstitutionNavigationAuthorizationV1,
} from '@/modules/security/server/institution-section-guard';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';

const TARGET_SECTION_ID = 'workbench' as const;
const TARGET_CAPABILITY_KEY = 'page_workbench' as const;
const EMPTY_SECTION_IDS = Object.freeze([]) as readonly InstitutionNavigationSectionIdV1[];

function selectExactReadonlyWorkbenchProjection(
  projection: WorkbenchCapabilityProjection,
): WorkbenchCapabilityProjection | null {
  if (
    projection.status !== 'projected' ||
    projection.quickCreateMenu !== null
  ) {
    return null;
  }

  const workbenchSummaries = projection.summaries.filter(
    (summary) => summary.key === TARGET_CAPABILITY_KEY,
  );
  if (workbenchSummaries.length !== 1) return null;

  const summary = workbenchSummaries[0];
  if (!(
    summary?.key === TARGET_CAPABILITY_KEY &&
    summary.kind === 'page' &&
    summary.decision === 'read_only' &&
    summary.safeSummary === '工作台仅供查看'
  )) {
    return null;
  }

  return Object.freeze({
    status: 'projected',
    sourceReadiness: projection.sourceReadiness,
    summaries: Object.freeze([summary]),
    quickCreateMenu: null,
  });
}

export default async function HospitalPage() {
  let navigationAuthorization: unknown;
  try {
    const requestAuthorization = await resolveInstitutionServerAuthorizationV1();
    if (isInstitutionRequestAuthorizationV1(requestAuthorization)) {
      navigationAuthorization =
        await requestAuthorization.authorizeCurrentInstitutionNavigationV1({
          targetSectionId: TARGET_SECTION_ID,
        });
    }
  } catch {
    navigationAuthorization = undefined;
  }

  let exactNavigationAuthorization: InstitutionNavigationAuthorizationV1 | null = null;
  if (
    isInstitutionNavigationAuthorizationV1(navigationAuthorization) &&
    navigationAuthorization.targetSectionId === TARGET_SECTION_ID
  ) {
    exactNavigationAuthorization = navigationAuthorization;
  }

  const availableSectionIds = exactNavigationAuthorization
    ? exactNavigationAuthorization.availableSectionIds
    : EMPTY_SECTION_IDS;
  const genuineAllowed =
    exactNavigationAuthorization?.targetAccess === 'allowed';

  let capabilityProjection: WorkbenchCapabilityProjection | null = null;
  if (genuineAllowed) {
    try {
      const capabilityStatus =
        await resolveInstitutionCapabilityAuthorityStatusV1();
      if (capabilityStatus) {
        const projection = buildWorkbenchCapabilityProjection({
          capabilities: capabilityStatus,
          referenceTime: capabilityStatus.freshness?.observedAt ?? '',
        });
        const workbenchProjection =
          selectExactReadonlyWorkbenchProjection(projection);
        if (workbenchProjection) {
          capabilityProjection = workbenchProjection;
        }
      }
    } catch {
      capabilityProjection = null;
    }
  }

  return (
    <InstitutionNavigationShell
      activeSectionId={TARGET_SECTION_ID}
      availableSectionIds={availableSectionIds}
    >
      <InstitutionWorkbenchCapabilityOff
        genuineAllowed={genuineAllowed}
        capabilityProjection={capabilityProjection}
      />
    </InstitutionNavigationShell>
  );
}
