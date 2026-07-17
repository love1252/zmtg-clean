import { notFound } from 'next/navigation';
import { DemoSessionGate } from '@/modules/auth/components/DemoSessionGate';
import { InstitutionCapabilityOffPage, resolveInstitutionRouteSectionV1 } from '@/modules/institution/components/InstitutionCapabilityOffPage';
import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';

type HospitalCapabilityOffRouteProps = {
  params: Promise<{
    slug: string[];
  }>;
};

const SAFE_AVAILABLE_SECTION_IDS = ['workbench'] as const;

export default async function HospitalCapabilityOffRoute({
  params,
}: HospitalCapabilityOffRouteProps) {
  const { slug } = await params;
  const section = resolveInstitutionRouteSectionV1(slug);

  if (!section) notFound();

  return (
    <DemoSessionGate allowedRole="tenant_admin" loginHref="/login" wrongRoleHref="/open-platform">
      <InstitutionNavigationShell
        activeSectionId={section.id}
        availableSectionIds={SAFE_AVAILABLE_SECTION_IDS}
      >
        <InstitutionCapabilityOffPage section={section} />
      </InstitutionNavigationShell>
    </DemoSessionGate>
  );
}
