import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import { INSTITUTION_NAVIGATION_SECTION_IDS_V1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { InstitutionWorkbenchCapabilityOff } from '@/modules/institution-workbench/components/InstitutionWorkbenchCapabilityOff';
import { resolveInstitutionWorkbenchRuntimeV1 } from '@/modules/institution-workbench/server/institution-workbench-runtime';

export default async function HospitalPage() {
  await resolveInstitutionWorkbenchRuntimeV1().catch(() => undefined);

  return (
    <InstitutionNavigationShell
      activeSectionId="workbench"
      availableSectionIds={INSTITUTION_NAVIGATION_SECTION_IDS_V1}
    >
      <InstitutionWorkbenchCapabilityOff />
    </InstitutionNavigationShell>
  );
}
