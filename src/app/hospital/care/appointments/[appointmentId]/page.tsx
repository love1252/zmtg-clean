
import { AppointmentControlledDetailShell } from '@/modules/care/components/AppointmentControlledDetailShell';
import {
  InstitutionCapabilityOffPage,
  resolveInstitutionCapabilityOffRouteV1,
} from '@/modules/institution/components/InstitutionCapabilityOffPage';
import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import { InstitutionPageState } from '@/modules/institution/components/InstitutionPageState';
import type { CapabilityStatusV1 } from '@/modules/institution-contracts/v1/institution-capability';
import type { InstitutionNavigationSectionIdV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import { isInstitutionRequestAuthorizationV1 } from '@/modules/security/server/institution-request-authorization';
import {
  isInstitutionNavigationAuthorizationV1,
  type InstitutionNavigationAuthorizationV1,
} from '@/modules/security/server/institution-section-guard';
import { readCurrentInstitutionAppointmentControlledV1 } from '@/server/orchestration/institution-appointment-controlled-write-runtime';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';

export const dynamic = 'force-dynamic';

const TARGET_SECTION_ID = 'care' as const;
const EMPTY_SECTION_IDS = Object.freeze([]) as readonly InstitutionNavigationSectionIdV1[];
const CAPABILITY_OFF_ROUTE = resolveInstitutionCapabilityOffRouteV1([
  'care',
  'appointments',
]);

function operational(
  status: CapabilityStatusV1 | null,
): boolean {
  if (
    !status
    || status.contractVersion !== 'v1'
    || status.readiness !== 'ready'
    || status.failureCode !== null
    || !status.data
  ) {
    return false;
  }

  const capabilities = status.data.capabilities.filter(
    (item) => item.key === 'page_care_appointments',
  );
  const partitions = status.partitions.filter(
    (item) => item.key === 'page_care_appointments',
  );

  return (
    capabilities.length === 1
    && partitions.length === 1
    && capabilities[0]?.decision === 'operational'
    && capabilities[0].dimensions.codeMaturity === 'verified'
    && capabilities[0].dimensions.institutionAuthorization === 'authorized'
    && capabilities[0].dimensions.connectionAvailability === 'not_required'
    && capabilities[0].dimensions.dataReadiness === 'ready'
    && capabilities[0].dimensions.productionRelease === 'pilot_released'
    && capabilities[0].safeSummary === '预约管理可用'
    && partitions[0]?.readiness === 'ready'
    && partitions[0].failureCode === null
  );
}

export default async function HospitalCareAppointmentDetailPage({
  params,
}: Readonly<{
  params: Promise<{ appointmentId: string }>;
}>) {
  let navigationAuthorization: unknown;
  try {
    const requestAuthorization =
      await resolveInstitutionServerAuthorizationV1();
    if (isInstitutionRequestAuthorizationV1(requestAuthorization)) {
      navigationAuthorization =
        await requestAuthorization.authorizeCurrentInstitutionNavigationV1({
          targetSectionId: TARGET_SECTION_ID,
        });
    }
  } catch {
    navigationAuthorization = undefined;
  }

  let exactNavigationAuthorization: InstitutionNavigationAuthorizationV1 | null = null;
  if (
    isInstitutionNavigationAuthorizationV1(navigationAuthorization)
    && navigationAuthorization.targetSectionId === TARGET_SECTION_ID
  ) {
    exactNavigationAuthorization = navigationAuthorization;
  }

  const availableSectionIds = exactNavigationAuthorization
    ? exactNavigationAuthorization.availableSectionIds
    : EMPTY_SECTION_IDS;
  const genuineAllowed =
    exactNavigationAuthorization?.targetAccess === 'allowed';
  const genuineBlocked =
    exactNavigationAuthorization?.targetAccess === 'blocked';

  let capabilityOperational = false;
  if (genuineAllowed) {
    capabilityOperational = await resolveInstitutionCapabilityAuthorityStatusV1()
      .then(operational)
      .catch(() => false);
  }

  const { appointmentId } = await params;
  const result =
    genuineAllowed && capabilityOperational
      ? await readCurrentInstitutionAppointmentControlledV1(
          appointmentId,
        ).catch(() => ({
          kind: 'unavailable' as const,
        }))
      : null;

  return (
    <InstitutionNavigationShell
      activeSectionId={TARGET_SECTION_ID}
      availableSectionIds={availableSectionIds}
    >
      {result?.kind === 'ready' ? (
        <AppointmentControlledDetailShell
          record={result.record}
        />
      ) : genuineBlocked || result?.kind === 'forbidden' ? (
        <InstitutionPageState
          kind="forbidden"
          title="当前账号不可访问预约详情"
          description="未读取或展示任何预约详情。"
        />
      ) : result?.kind === 'not_found' ? (
        <InstitutionPageState
          kind="error"
          title="预约不存在或不可见"
          description="请返回预约列表刷新后重试。"
        />
      ) : genuineAllowed && !capabilityOperational && CAPABILITY_OFF_ROUTE ? (
        <InstitutionCapabilityOffPage
          pageLabel={CAPABILITY_OFF_ROUTE.pageLabel}
          section={CAPABILITY_OFF_ROUTE.section}
        />
      ) : (
        <InstitutionPageState
          kind="unavailable"
          title="预约详情暂时不可用"
          description="当前未获得可信的预约详情结果。"
        />
      )}
    </InstitutionNavigationShell>
  );
}
