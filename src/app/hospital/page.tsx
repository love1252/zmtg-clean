import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import { INSTITUTION_NAVIGATION_SECTION_IDS_V1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { InstitutionWorkbenchCapabilityOff } from '@/modules/institution-workbench/components/InstitutionWorkbenchCapabilityOff';
import { createDisabledInstitutionWorkbenchEntryV1 } from '@/modules/institution-workbench/server/institution-workbench-entry';

export default function HospitalPage() {
  const entry = createDisabledInstitutionWorkbenchEntryV1({});

  if (entry.view !== 'capability_off') return null;

  return (
    <InstitutionNavigationShell
      activeSectionId="workbench"
      availableSectionIds={INSTITUTION_NAVIGATION_SECTION_IDS_V1}
    >
      <InstitutionWorkbenchCapabilityOff />
    </InstitutionNavigationShell>
  );
}
