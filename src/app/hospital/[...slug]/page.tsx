import { notFound } from 'next/navigation';
import { DemoSessionGate } from '@/modules/auth/components/DemoSessionGate';
import {
  InstitutionCapabilityOffPage,
  resolveInstitutionCapabilityOffRouteV1,
} from '@/modules/institution/components/InstitutionCapabilityOffPage';
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
  const route = resolveInstitutionCapabilityOffRouteV1(slug);

  if (!route) notFound();

  return (
    <DemoSessionGate allowedRole="tenant_admin" loginHref="/login" wrongRoleHref="/open-platform">
      <InstitutionNavigationShell
        activeSectionId={route.section.id}
        availableSectionIds={SAFE_AVAILABLE_SECTION_IDS}
      >
        <InstitutionCapabilityOffPage pageLabel={route.pageLabel} section={route.section} />
      </InstitutionNavigationShell>
    </DemoSessionGate>
  );
}
