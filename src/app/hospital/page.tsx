import { DemoSessionGate } from '@/modules/auth/components/DemoSessionGate';
import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import { InstitutionWorkbenchCapabilityOff } from '@/modules/institution-workbench/components/InstitutionWorkbenchCapabilityOff';

const AVAILABLE_SECTION_IDS = ['workbench'] as const;

export default function HospitalPage() {
  return (
    <DemoSessionGate allowedRole="tenant_admin" loginHref="/login" wrongRoleHref="/open-platform">
      <InstitutionNavigationShell
        activeSectionId="workbench"
        availableSectionIds={AVAILABLE_SECTION_IDS}
      >
        <InstitutionWorkbenchCapabilityOff />
      </InstitutionNavigationShell>
    </DemoSessionGate>
  );
}
