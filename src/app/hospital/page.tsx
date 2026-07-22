import { DemoSessionGate } from '@/modules/auth/components/DemoSessionGate';
import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import { InstitutionWorkbenchCapabilityOff } from '@/modules/institution-workbench/components/InstitutionWorkbenchCapabilityOff';

const AVAILABLE_SECTION_IDS = ['workbench'] as const;
const WORKBENCH_ALLOWED_ROLES = [
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
] as const;

export default function HospitalPage() {
  return (
    <DemoSessionGate
      allowedRole="tenant_admin"
      allowedRoles={WORKBENCH_ALLOWED_ROLES}
      loginHref="/login"
      wrongRoleHref="/open-platform"
    >
      <InstitutionNavigationShell
        activeSectionId="workbench"
        availableSectionIds={AVAILABLE_SECTION_IDS}
      >
        <InstitutionWorkbenchCapabilityOff />
      </InstitutionNavigationShell>
    </DemoSessionGate>
  );
}
