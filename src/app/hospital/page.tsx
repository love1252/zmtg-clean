import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import { INSTITUTION_NAVIGATION_SECTION_IDS_V1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { InstitutionWorkbenchCapabilityOff } from '@/modules/institution-workbench/components/InstitutionWorkbenchCapabilityOff';
import { isInstitutionWorkbenchEntryDecisionV1 } from '@/modules/institution-workbench/server/institution-workbench-entry';
import { resolveInstitutionWorkbenchRuntimeV1 } from '@/modules/institution-workbench/server/institution-workbench-runtime';

export default async function HospitalPage() {
  let decision: unknown;
  try {
    decision = await resolveInstitutionWorkbenchRuntimeV1();
  } catch {
    decision = undefined;
  }
  const genuineAllowed =
    isInstitutionWorkbenchEntryDecisionV1(decision) &&
    decision.kind === 'allowed' &&
    decision.view === 'capability_off';

  return (
    <InstitutionNavigationShell
      activeSectionId="workbench"
      availableSectionIds={INSTITUTION_NAVIGATION_SECTION_IDS_V1}
    >
      <InstitutionWorkbenchCapabilityOff genuineAllowed={genuineAllowed} />
    </InstitutionNavigationShell>
  );
}
