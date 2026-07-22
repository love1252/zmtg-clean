import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import { InstitutionWorkbenchCapabilityOff } from '@/modules/institution-workbench/components/InstitutionWorkbenchCapabilityOff';
import { createDisabledInstitutionWorkbenchEntryV1 } from '@/modules/institution-workbench/server/institution-workbench-entry';

const AVAILABLE_SECTION_IDS = ['workbench'] as const;

export default function HospitalPage() {
  const entry = createDisabledInstitutionWorkbenchEntryV1({});

  if (entry.view !== 'capability_off') return null;

  return (
    <InstitutionNavigationShell
      activeSectionId="workbench"
      availableSectionIds={AVAILABLE_SECTION_IDS}
    >
      <InstitutionWorkbenchCapabilityOff />
    </InstitutionNavigationShell>
  );
}
