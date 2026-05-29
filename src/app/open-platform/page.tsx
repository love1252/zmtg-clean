import { DemoSessionGate } from '@/modules/auth/components/DemoSessionGate';
import { PlatformConsole } from '@/modules/workspace/components/PlatformConsole';

export default function OpenPlatformPage() {
  return (
    <DemoSessionGate allowedRole="platform_admin" loginHref="/platform-login" wrongRoleHref="/hospital">
      <PlatformConsole />
    </DemoSessionGate>
  );
}
