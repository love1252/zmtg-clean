import { CareFollowUpControlledShell } from '@/modules/care/components/CareFollowUpControlledShell';
import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';
import type { InstitutionNavigationSectionIdV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import { isInstitutionRequestAuthorizationV1 } from '@/modules/security/server/institution-request-authorization';
import {
  isInstitutionNavigationAuthorizationV1,
  type InstitutionNavigationAuthorizationV1,
} from '@/modules/security/server/institution-section-guard';
import { readCurrentInstitutionFormalFollowUpV1 } from '@/server/orchestration/institution-formal-follow-up-runtime';

export const dynamic = 'force-dynamic';

const EMPTY_SECTION_IDS =
  Object.freeze(
    [],
  ) as readonly InstitutionNavigationSectionIdV1[];

export default async function HospitalCareFollowUpDetailPage({
  params,
}: Readonly<{
  params: Promise<{ taskId: string }>;
}>) {
  const { taskId } = await params;
  let navigationAuthorization: unknown;

  try {
    const authorization =
      await resolveInstitutionServerAuthorizationV1();

    if (
      isInstitutionRequestAuthorizationV1(
        authorization,
      )
    ) {
      navigationAuthorization =
        await authorization
          .authorizeCurrentInstitutionNavigationV1({
            targetSectionId: 'care',
          });
    }
  } catch {
    navigationAuthorization = undefined;
  }

  let exactNavigationAuthorization:
    | InstitutionNavigationAuthorizationV1
    | null = null;

  if (
    isInstitutionNavigationAuthorizationV1(
      navigationAuthorization,
    )
    && navigationAuthorization.targetSectionId
      === 'care'
  ) {
    exactNavigationAuthorization =
      navigationAuthorization;
  }

  const availableSectionIds =
    exactNavigationAuthorization
      ? exactNavigationAuthorization
          .availableSectionIds
      : EMPTY_SECTION_IDS;
  const genuineAllowed =
    exactNavigationAuthorization?.targetAccess
      === 'allowed';

  const result =
    genuineAllowed
      ? await readCurrentInstitutionFormalFollowUpV1(
          taskId,
        ).catch(() => ({
          kind: 'unavailable' as const,
        }))
      : {
          kind: 'forbidden' as const,
        };

  return (
    <InstitutionNavigationShell
      activeSectionId="care"
      availableSectionIds={
        availableSectionIds
      }
    >
      {result.kind === 'ready' ? (
        <CareFollowUpControlledShell
          records={[result.record]}
          canCreate={result.canCreate}
          selectedTaskId={
            result.record.taskId
          }
        />
      ) : result.kind === 'forbidden' ? (
        <InstitutionPageState
          kind="forbidden"
          title="当前账号不可访问该随访任务"
          description="当前机构、角色或任务分配范围不允许访问。"
        />
      ) : result.kind === 'not_found' ? (
        <InstitutionPageState
          kind="unavailable"
          title="未找到随访任务"
          description="任务不存在，或不属于当前机构和当前人员的数据范围。"
        />
      ) : (
        <InstitutionPageState
          kind="unavailable"
          title="随访任务暂时不可用"
          description="未获得可信任务事实；真实发送和 HIS 操作保持关闭。"
        />
      )}
    </InstitutionNavigationShell>
  );
}
