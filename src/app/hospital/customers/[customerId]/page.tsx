
import { CustomerControlledDetailShell } from '@/modules/customer-center/components/CustomerControlledDetailShell';
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
import { readCurrentInstitutionCustomerControlledV1 } from '@/server/orchestration/institution-customer-controlled-write-runtime';

export const dynamic = 'force-dynamic';

const TARGET_SECTION_ID = 'customers' as const;
const CAPABILITY_OFF_ROUTE = resolveInstitutionCapabilityOffRouteV1(['customers']);

function operational(status: CapabilityStatusV1 | null): boolean {
  if (
    !status ||
    status.contractVersion !== 'v1' ||
    status.readiness !== 'ready' ||
    status.failureCode !== null ||
    !status.data
  ) {
    return false;
  }

  const capabilities = status.data.capabilities.filter(
    (item) => item.key === 'page_customer_list',
  );
  const partitions = status.partitions.filter(
    (item) => item.key === 'page_customer_list',
  );

  return (
    capabilities.length === 1 &&
    partitions.length === 1 &&
    capabilities[0]?.decision === 'operational' &&
    capabilities[0].dimensions.codeMaturity === 'verified' &&
    capabilities[0].dimensions.institutionAuthorization === 'authorized' &&
    capabilities[0].dimensions.connectionAvailability === 'not_required' &&
    capabilities[0].dimensions.dataReadiness === 'ready' &&
    capabilities[0].dimensions.productionRelease === 'pilot_released' &&
    capabilities[0].safeSummary === '客户列表可用' &&
    partitions[0]?.readiness === 'ready' &&
    partitions[0].failureCode === null
  );
}

export default async function HospitalCustomerDetailPage({
  params,
}: Readonly<{
  params: Promise<{ customerId: string }>;
}>) {
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
  ) {
    exactNavigationAuthorization = navigationAuthorization;
  }

  const genuineAllowed = exactNavigationAuthorization?.targetAccess === 'allowed';
  const genuineBlocked = exactNavigationAuthorization?.targetAccess === 'blocked';

  const {
    availableSectionIds,
    availableNavigationTargets,
    capabilityStatus,
    workspaceScopeKey,
  } = await resolveInstitutionShellAuthorizationV1(exactNavigationAuthorization);
  const capabilityOperational = operational(capabilityStatus);

  const { customerId } = await params;
  const result =
    genuineAllowed && capabilityOperational
      ? await readCurrentInstitutionCustomerControlledV1(customerId).catch(() => ({
          kind: 'unavailable' as const,
        }))
      : null;

  return (
    <InstitutionNavigationShell
      activeSectionId={TARGET_SECTION_ID}
      availableSectionIds={availableSectionIds}
      availableNavigationTargets={availableNavigationTargets}
      workspaceScopeKey={workspaceScopeKey}
    >
      {result?.kind === 'ready' ? (
        <CustomerControlledDetailShell record={result.record} />
      ) : genuineBlocked || result?.kind === 'forbidden' ? (
        <InstitutionPageState
          kind="forbidden"
          title="当前账号不可访问客户详情"
          description="未读取或展示任何客户详情。"
        />
      ) : result?.kind === 'not_found' ? (
        <InstitutionPageState
          kind="error"
          title="客户不存在或不可见"
          description="请返回客户列表刷新后重试。"
        />
      ) : genuineAllowed && !capabilityOperational && CAPABILITY_OFF_ROUTE ? (
        <InstitutionCapabilityOffPage
          pageLabel={CAPABILITY_OFF_ROUTE.pageLabel}
          section={CAPABILITY_OFF_ROUTE.section}
        />
      ) : (
        <InstitutionPageState
          kind="unavailable"
          title="客户详情暂时不可用"
          description="当前未获得可信的客户详情结果。"
        />
      )}
    </InstitutionNavigationShell>
  );
}
