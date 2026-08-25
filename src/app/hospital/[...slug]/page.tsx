import { notFound } from 'next/navigation';
import {
  InstitutionCapabilityOffPage,
  resolveInstitutionCapabilityOffRouteV1,
} from '@/modules/institution/components/InstitutionCapabilityOffPage';
import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';
import { resolveInstitutionShellAuthorizationV1 } from '@/modules/institution-shell/server/institution-shell-authorization';
import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import { isInstitutionRequestAuthorizationV1 } from '@/modules/security/server/institution-request-authorization';
import {
  isInstitutionNavigationAuthorizationV1,
  type InstitutionNavigationAuthorizationV1,
} from '@/modules/security/server/institution-section-guard';


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

  const targetSectionId = route.section.id;
  let navigationAuthorization: unknown;
  try {
    const requestAuthorization = await resolveInstitutionServerAuthorizationV1();
    if (isInstitutionRequestAuthorizationV1(requestAuthorization)) {
      navigationAuthorization =
        await requestAuthorization.authorizeCurrentInstitutionNavigationV1({
          targetSectionId,
        });
    }
  } catch {
    navigationAuthorization = undefined;
  }

  let exactNavigationAuthorization: InstitutionNavigationAuthorizationV1 | null = null;
  if (
    isInstitutionNavigationAuthorizationV1(navigationAuthorization) &&
    navigationAuthorization.targetSectionId === targetSectionId
  ) {
    exactNavigationAuthorization = navigationAuthorization;
  }
  const genuineAllowed =
    exactNavigationAuthorization?.targetAccess === 'allowed';
  const {
    availableSectionIds,
    availableNavigationTargets,
    workspaceScopeKey,
  } = await resolveInstitutionShellAuthorizationV1(exactNavigationAuthorization);
  const genuineBlockedWithNavigation =
    exactNavigationAuthorization?.targetAccess === 'blocked' &&
    availableSectionIds.length > 0;

  return (
    <InstitutionNavigationShell
      activeSectionId={targetSectionId}
      availableSectionIds={availableSectionIds}
      availableNavigationTargets={availableNavigationTargets}
      workspaceScopeKey={workspaceScopeKey}
    >
      {genuineAllowed ? (
        <InstitutionCapabilityOffPage
          pageLabel={route.pageLabel}
          routeId={route.routeId}
          section={route.section}
        />
      ) : genuineBlockedWithNavigation ? (
        <InstitutionPageState
          kind="forbidden"
          title="当前账号不可访问该栏目"
          description="当前仅确认栏目访问受限；未读取或展示任何业务数据。"
        />
      ) : (
        <InstitutionPageState
          kind="unavailable"
          title="机构访问状态暂时不可用"
          description="当前未获得可信的栏目访问结果；业务数据和业务入口保持隐藏。"
        />
      )}
    </InstitutionNavigationShell>
  );
}
