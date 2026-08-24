import {
  AiUsageReadonlyShell,
} from '@/modules/institution-system/components/AiUsageReadonlyShell';
import {
  InstitutionCapabilityOffPage,
  resolveInstitutionCapabilityOffRouteV1,
} from '@/modules/institution/components/InstitutionCapabilityOffPage';
import {
  InstitutionNavigationShell,
} from '@/modules/institution/components/InstitutionNavigationShell';
import {
  InstitutionPageState,
} from '@/modules/institution/components/InstitutionPageState';
import type {
  CapabilityStatusV1,
} from '@/modules/institution-contracts/v1/institution-capability';
import { resolveInstitutionShellAuthorizationV1 } from '@/modules/institution-shell/server/institution-shell-authorization';
import {
  resolveInstitutionServerAuthorizationV1,
} from '@/modules/institution/server/institution-server-runtime';
import {
  isInstitutionRequestAuthorizationV1,
} from '@/modules/security/server/institution-request-authorization';
import {
  isInstitutionNavigationAuthorizationV1,
  type InstitutionNavigationAuthorizationV1,
} from '@/modules/security/server/institution-section-guard';
import {
  readCurrentInstitutionAiUsageMetricsV1,
} from '@/server/orchestration/institution-ai-usage-metrics-reader';

export const dynamic = 'force-dynamic';

const TARGET_SECTION_ID = 'system' as const;
const TARGET_CAPABILITY_KEY =
  'page_system_ai_usage' as const;

const CAPABILITY_OFF_ROUTE =
  resolveInstitutionCapabilityOffRouteV1([
    'system',
    'ai-usage',
  ]);

type PageCapabilityState =
  | 'released'
  | 'capability_off'
  | 'unavailable';

type SearchParamsInput =
  Readonly<
    Record<
      string,
      string | string[] | undefined
    >
  >;

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
    capability?.decision !== 'read_only'
    || capability.dimensions.codeMaturity
      !== 'verified'
    || capability.dimensions.institutionAuthorization
      !== 'authorized'
    || capability.dimensions.connectionAvailability
      !== 'not_required'
    || capability.dimensions.dataReadiness
      !== 'ready'
    || capability.dimensions.productionRelease
      !== 'pilot_released'
    || capability.safeSummary
      !== 'AI 使用统计仅供查看'
    || partition?.readiness !== 'ready'
    || partition.failureCode !== null
  ) {
    return 'capability_off';
  }

  return 'released';
}

function toUrlSearchParams(
  input: SearchParamsInput | undefined,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(
    input ?? {},
  )) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
    } else if (typeof value === 'string') {
      params.append(key, value);
    }
  }

  return params;
}

export default async function HospitalSystemAiUsagePage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<SearchParamsInput>;
}>) {
  let resolvedSearchParams:
    | URLSearchParams
    | null = null;

  try {
    resolvedSearchParams =
      toUrlSearchParams(
        await searchParams,
      );
  } catch {
    resolvedSearchParams = null;
  }

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
            targetSectionId: TARGET_SECTION_ID,
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
    && resolvedSearchParams
      ? await readCurrentInstitutionAiUsageMetricsV1(
          resolvedSearchParams,
        ).catch(() => ({
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
        <AiUsageReadonlyShell
          metrics={result.metrics}
          preset={result.preset}
        />
      ) : genuineBlocked
        || result?.kind === 'forbidden' ? (
        <InstitutionPageState
          kind="forbidden"
          title="当前账号不可访问 AI 使用概览"
          description="当前仅确认管理中心访问受限；未读取或展示任何 AI 使用数据。"
        />
      ) : genuineAllowed
        && capabilityState === 'capability_off'
        && CAPABILITY_OFF_ROUTE ? (
        <InstitutionCapabilityOffPage
          pageLabel={
            CAPABILITY_OFF_ROUTE.pageLabel
          }
          section={
            CAPABILITY_OFF_ROUTE.section
          }
        />
      ) : result?.kind === 'invalid_query' ? (
        <InstitutionPageState
          kind="error"
          title="AI 使用查询条件无效"
          description="仅支持今天、近 7 天、本月或上月四种固定时间范围。"
        />
      ) : (
        <InstitutionPageState
          kind="unavailable"
          title="AI 使用概览暂时不可用"
          description="当前未获得可信的只读 AI 使用统计结果；数据与操作入口保持隐藏。"
        />
      )}
    </InstitutionNavigationShell>
  );
}
