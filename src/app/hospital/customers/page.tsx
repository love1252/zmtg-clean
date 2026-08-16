import { CustomerListReadonlyShell } from '@/modules/customer-center/components/CustomerListReadonlyShell';
import type {
  CustomerListLifecycleV1,
  CustomerListPriorityV1,
} from '@/modules/customer-center/ports/customer-list-source';
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
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';
import { readCurrentInstitutionCustomersV1 } from '@/server/orchestration/institution-customer-list-reader';

export const dynamic = 'force-dynamic';

const TARGET_SECTION_ID = 'customers' as const;
const TARGET_CAPABILITY_KEY = 'page_customer_list' as const;
const EMPTY_SECTION_IDS = Object.freeze([]) as readonly InstitutionNavigationSectionIdV1[];
const CAPABILITY_OFF_ROUTE = resolveInstitutionCapabilityOffRouteV1(['customers']);

type PageCapabilityState = 'released' | 'capability_off' | 'unavailable';
type SearchParamsInput = Readonly<Record<string, string | string[] | undefined>>;

function resolveExactCapabilityState(status: CapabilityStatusV1 | null): PageCapabilityState {
  if (
    !status ||
    status.contractVersion !== 'v1' ||
    status.readiness !== 'ready' ||
    status.failureCode !== null ||
    !status.data
  ) return 'unavailable';

  const capabilities = status.data.capabilities.filter(
    (capability) => capability.key === TARGET_CAPABILITY_KEY,
  );
  const partitions = status.partitions.filter(
    (partition) => partition.key === TARGET_CAPABILITY_KEY,
  );
  if (capabilities.length !== 1 || partitions.length !== 1) {
    return 'capability_off';
  }

  const capability = capabilities[0];
  const partition = partitions[0];
  if (
    capability?.decision !== 'read_only' ||
    capability.dimensions.codeMaturity !== 'verified' ||
    capability.dimensions.institutionAuthorization !== 'authorized' ||
    capability.dimensions.connectionAvailability !== 'not_required' ||
    capability.dimensions.dataReadiness !== 'ready' ||
    capability.dimensions.productionRelease !== 'pilot_released' ||
    capability.safeSummary !== '客户列表仅供查看' ||
    partition?.readiness !== 'ready' ||
    partition.failureCode !== null
  ) return 'capability_off';

  return 'released';
}

function toUrlSearchParams(input: SearchParamsInput | undefined): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === 'string') {
      params.append(key, value);
    }
  }
  return params;
}

export default async function HospitalCustomersPage({
  searchParams,
}: Readonly<{ searchParams?: Promise<SearchParamsInput> }>) {
  let resolvedSearchParams: URLSearchParams | null = null;
  try {
    resolvedSearchParams = toUrlSearchParams(await searchParams);
  } catch {
    resolvedSearchParams = null;
  }

  let navigationAuthorization: unknown;
  try {
    const requestAuthorization = await resolveInstitutionServerAuthorizationV1();
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
    isInstitutionNavigationAuthorizationV1(navigationAuthorization) &&
    navigationAuthorization.targetSectionId === TARGET_SECTION_ID
  ) exactNavigationAuthorization = navigationAuthorization;

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

  const result =
    genuineAllowed && capabilityState === 'released' && resolvedSearchParams
      ? await readCurrentInstitutionCustomersV1(resolvedSearchParams).catch(() => ({
          kind: 'unavailable' as const,
        }))
      : null;
  const lifecycle =
    result?.kind === 'ready'
      ? (resolvedSearchParams?.get('lifecycle') as CustomerListLifecycleV1 | null)
      : null;
  const priority =
    result?.kind === 'ready'
      ? (resolvedSearchParams?.get('priority') as CustomerListPriorityV1 | null)
      : null;

  return (
    <InstitutionNavigationShell
      activeSectionId={TARGET_SECTION_ID}
      availableSectionIds={availableSectionIds}
    >
      {result?.kind === 'ready' ? (
        <CustomerListReadonlyShell
          lifecycle={lifecycle}
          priority={priority}
          result={result}
        />
      ) : genuineBlocked || result?.kind === 'forbidden' ? (
        <InstitutionPageState
          kind="forbidden"
          title="当前账号不可访问客户列表"
          description="当前仅确认客户栏目访问受限；未读取或展示任何客户数据。"
        />
      ) : genuineAllowed && capabilityState === 'capability_off' && CAPABILITY_OFF_ROUTE ? (
        <InstitutionCapabilityOffPage
          pageLabel={CAPABILITY_OFF_ROUTE.pageLabel}
          section={CAPABILITY_OFF_ROUTE.section}
        />
      ) : result?.kind === 'invalid_query' ? (
        <InstitutionPageState
          kind="error"
          title="客户查询条件无效"
          description="请检查分页或筛选条件后重试。"
        />
      ) : (
        <InstitutionPageState
          kind="unavailable"
          title="客户列表暂时不可用"
          description="当前未获得可信的只读客户列表结果；客户数据和操作入口保持隐藏。"
        />
      )}
    </InstitutionNavigationShell>
  );
}
