import { CareFollowUpControlledShell } from '@/modules/care/components/CareFollowUpControlledShell';
import {
  InstitutionCapabilityOffPage,
  resolveInstitutionCapabilityOffRouteV1,
} from '@/modules/institution/components/InstitutionCapabilityOffPage';
import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';
import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import { resolveInstitutionShellAuthorizationV1 } from '@/modules/institution-shell/server/institution-shell-authorization';
import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import { isInstitutionRequestAuthorizationV1 } from '@/modules/security/server/institution-request-authorization';
import {
  isInstitutionNavigationAuthorizationV1,
  type InstitutionNavigationAuthorizationV1,
} from '@/modules/security/server/institution-section-guard';
import { readCurrentInstitutionFormalFollowUpsV1 } from '@/server/orchestration/institution-formal-follow-up-runtime';

export const dynamic = 'force-dynamic';

const TARGET_SECTION_ID = 'care' as const;
const TARGET_CAPABILITY_KEY =
  'page_care_followups' as const;
const CAPABILITY_OFF_ROUTE =
  resolveInstitutionCapabilityOffRouteV1([
    'care',
    'followups',
  ]);

type PageCapabilityState =
  | 'released'
  | 'capability_off'
  | 'unavailable';

function resolveExactCapabilityState(
  status: CapabilityStatusV1 | null,
): PageCapabilityState {
  if (
    !status
    || status.contractVersion !== 'v1'
    || status.readiness !== 'ready'
    || status.failureCode !== null
    || !status.data
  ) {
    return 'unavailable';
  }

  const capabilities =
    status.data.capabilities.filter(
      (capability) =>
        capability.key
          === TARGET_CAPABILITY_KEY,
    );
  const partitions =
    status.partitions.filter(
      (partition) =>
        partition.key
          === TARGET_CAPABILITY_KEY,
    );

  if (
    capabilities.length !== 1
    || partitions.length !== 1
  ) {
    return 'capability_off';
  }

  const capability = capabilities[0];
  const partition = partitions[0];
  if (
    capability?.decision !== 'operational'
    || capability.dimensions.codeMaturity
      !== 'verified'
    || capability.dimensions
      .institutionAuthorization
      !== 'authorized'
    || capability.dimensions
      .connectionAvailability
      !== 'not_required'
    || capability.dimensions.dataReadiness
      !== 'ready'
    || capability.dimensions.productionRelease
      !== 'pilot_released'
    || capability.safeSummary
      !== '随访任务可用'
    || partition?.readiness !== 'ready'
    || partition.failureCode !== null
  ) {
    return 'capability_off';
  }

  return 'released';
}

export default async function HospitalCareFollowUpsPage() {
  let navigationAuthorization: unknown;

  try {
    const requestAuthorization =
      await resolveInstitutionServerAuthorizationV1();

    if (
      isInstitutionRequestAuthorizationV1(
        requestAuthorization,
      )
    ) {
      navigationAuthorization =
        await requestAuthorization
          .authorizeCurrentInstitutionNavigationV1({
            targetSectionId:
              TARGET_SECTION_ID,
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
      === TARGET_SECTION_ID
  ) {
    exactNavigationAuthorization =
      navigationAuthorization;
  }

  const genuineAllowed =
    exactNavigationAuthorization?.targetAccess
      === 'allowed';
  const genuineBlocked =
    exactNavigationAuthorization?.targetAccess
      === 'blocked';
  const {
    availableSectionIds,
    availableNavigationTargets,
    capabilityStatus,
    workspaceScopeKey,
  } = await resolveInstitutionShellAuthorizationV1(
    exactNavigationAuthorization,
  );

  let capabilityState:
    PageCapabilityState = 'unavailable';

  if (genuineAllowed) {
    capabilityState = resolveExactCapabilityState(capabilityStatus);
  }

  const result =
    genuineAllowed
    && capabilityState === 'released'
      ? await readCurrentInstitutionFormalFollowUpsV1()
          .catch(() => ({
            kind: 'unavailable' as const,
          }))
      : null;

  return (
    <InstitutionNavigationShell
      activeSectionId={TARGET_SECTION_ID}
      availableSectionIds={
        availableSectionIds
      }
      availableNavigationTargets={availableNavigationTargets}
      workspaceScopeKey={workspaceScopeKey}
    >
      {result?.kind === 'ready' ? (
        <CareFollowUpControlledShell
          records={result.records}
          canCreate={result.canCreate}
        />
      ) : genuineBlocked
        || result?.kind === 'forbidden' ? (
        <InstitutionPageState
          kind="forbidden"
          title="当前账号不可访问人工随访"
          description="当前机构、角色或正式 Care 权限不允许访问。"
        />
      ) : genuineAllowed
        && capabilityState
          === 'capability_off'
        && CAPABILITY_OFF_ROUTE ? (
        <InstitutionCapabilityOffPage
          pageLabel={
            CAPABILITY_OFF_ROUTE.pageLabel
          }
          section={
            CAPABILITY_OFF_ROUTE.section
          }
        />
      ) : (
        <InstitutionPageState
          kind="unavailable"
          title="人工随访暂时不可用"
          description="未获得可信的正式随访结果；真实发送和 HIS 操作保持关闭。"
        />
      )}
    </InstitutionNavigationShell>
  );
}
