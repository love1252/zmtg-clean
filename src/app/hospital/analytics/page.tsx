import {
  AnalyticsOverviewReadonlyShell,
} from '@/modules/institution-analytics/components/AnalyticsOverviewReadonlyShell';
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
import { readCurrentInstitutionAnalyticsOverviewV1 } from '@/server/orchestration/institution-analytics-overview-reader';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';

export const dynamic = 'force-dynamic';

const TARGET_SECTION_ID = 'analytics' as const;
const TARGET_CAPABILITY_KEY = 'page_analytics_overview' as const;
const EMPTY_SECTION_IDS = Object.freeze([]) as readonly InstitutionNavigationSectionIdV1[];
const CAPABILITY_OFF_ROUTE = resolveInstitutionCapabilityOffRouteV1(['analytics']);

type PageCapabilityState = 'released' | 'capability_off' | 'unavailable';

function resolveExactCapabilityState(status: CapabilityStatusV1 | null): PageCapabilityState {
  if (
    !status
    || status.contractVersion !== 'v1'
    || status.readiness !== 'ready'
    || status.failureCode !== null
    || !status.data
  ) return 'unavailable';

  const capabilities = status.data.capabilities.filter(
    (capability) => capability.key === TARGET_CAPABILITY_KEY,
  );
  const partitions = status.partitions.filter(
    (partition) => partition.key === TARGET_CAPABILITY_KEY,
  );
  if (capabilities.length !== 1 || partitions.length !== 1) return 'capability_off';

  const capability = capabilities[0];
  const partition = partitions[0];
  if (
    capability?.decision !== 'read_only'
    || capability.dimensions.codeMaturity !== 'verified'
    || capability.dimensions.institutionAuthorization !== 'authorized'
    || capability.dimensions.connectionAvailability !== 'not_required'
    || capability.dimensions.dataReadiness !== 'ready'
    || capability.dimensions.productionRelease !== 'pilot_released'
    || capability.safeSummary !== '经营总览仅供查看'
    || partition?.readiness !== 'ready'
    || partition.failureCode !== null
  ) return 'capability_off';

  return 'released';
}

export default async function HospitalAnalyticsOverviewPage() {
  let navigationAuthorization: unknown;
  try {
    const requestAuthorization = await resolveInstitutionServerAuthorizationV1();
    if (isInstitutionRequestAuthorizationV1(requestAuthorization)) {
      navigationAuthorization = await requestAuthorization.authorizeCurrentInstitutionNavigationV1({
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
  const genuineAllowed = exactNavigationAuthorization?.targetAccess === 'allowed';
  const genuineBlocked = exactNavigationAuthorization?.targetAccess === 'blocked';

  let capabilityState: PageCapabilityState = 'unavailable';
  if (genuineAllowed) {
    try {
      capabilityState = resolveExactCapabilityState(
        await resolveInstitutionCapabilityAuthorityStatusV1(),
      );
    } catch {
      capabilityState = 'unavailable';
    }
  }

  const result = genuineAllowed && capabilityState === 'released'
    ? await readCurrentInstitutionAnalyticsOverviewV1().catch(() => ({
        kind: 'unavailable' as const,
      }))
    : null;

  return (
    <InstitutionNavigationShell
      activeSectionId={TARGET_SECTION_ID}
      availableSectionIds={availableSectionIds}
    >
      {result?.kind === 'ready' ? (
        <AnalyticsOverviewReadonlyShell overview={result.overview} />
      ) : genuineBlocked || result?.kind === 'forbidden' ? (
        <InstitutionPageState
          kind="forbidden"
          title="当前账号不可访问经营分析"
          description="当前仅确认经营分析访问受限；未读取或展示任何经营数据。"
        />
      ) : genuineAllowed
        && capabilityState === 'capability_off'
        && CAPABILITY_OFF_ROUTE ? (
        <InstitutionCapabilityOffPage
          pageLabel={CAPABILITY_OFF_ROUTE.pageLabel}
          section={CAPABILITY_OFF_ROUTE.section}
        />
      ) : (
        <InstitutionPageState
          kind="unavailable"
          title="经营总览暂时不可用"
          description="当前未获得可信的正式经营事实聚合结果；数据与操作入口保持隐藏。"
        />
      )}
    </InstitutionNavigationShell>
  );
}
