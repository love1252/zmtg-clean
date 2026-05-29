import { DemoSessionGate } from '@/modules/auth/components/DemoSessionGate';
import { InstitutionWorkspace } from '@/modules/workspace/components/InstitutionWorkspace';

export default function HospitalPage() {
  return (
    <DemoSessionGate allowedRole="tenant_admin" loginHref="/login" wrongRoleHref="/open-platform">
      <InstitutionWorkspace />
    </DemoSessionGate>
  );
}
