import { notFound } from 'next/navigation';
import {
  InstitutionCapabilityOffPage,
  resolveInstitutionCapabilityOffRouteV1,
} from '@/modules/institution/components/InstitutionCapabilityOffPage';
import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import { INSTITUTION_NAVIGATION_SECTION_IDS_V1 } from '@/modules/institution-contracts/v1/institution-navigation';

type HospitalCapabilityOffRouteProps = {
  params: Promise<{
    slug: string[];
  }>;
};

export default async function HospitalCapabilityOffRoute({
  params,
}: HospitalCapabilityOffRouteProps) {
  const { slug } = await params;
  const route = resolveInstitutionCapabilityOffRouteV1(slug);

  if (!route) notFound();

  return (
    <InstitutionNavigationShell
      activeSectionId={route.section.id}
      availableSectionIds={INSTITUTION_NAVIGATION_SECTION_IDS_V1}
    >
      <InstitutionCapabilityOffPage pageLabel={route.pageLabel} section={route.section} />
    </InstitutionNavigationShell>
  );
}
