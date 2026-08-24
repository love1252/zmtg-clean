import { InstitutionAuditEventsShell } from '@/modules/institution/components/InstitutionAuditEventsShell';
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
import { resolveInstitutionAuditReadAuthorizationV1 } from '@/server/orchestration/institution-audit-read-authorization';

export const dynamic = 'force-dynamic';

const TARGET_SECTION_ID = 'system' as const;
const TARGET_CAPABILITY_KEY = 'page_system_audit' as const;
const AUDIT_CAPABILITY_OFF_ROUTE = resolveInstitutionCapabilityOffRouteV1([
  'system',
  'audit',
]);

type AuditAuthorizationState = 'allowed' | 'forbidden' | 'unavailable';
type AuditCapabilityState = 'released' | 'capability_off' | 'unavailable';

function resolveExactAuditCapabilityState(
  status: CapabilityStatusV1 | null,
): AuditCapabilityState {
  if (
    !status ||
    status.contractVersion !== 'v1' ||
    status.readiness !== 'ready' ||
    status.failureCode !== null ||
    !status.data
  ) {
    return 'unavailable';
  }

  const auditCapabilities = status.data.capabilities.filter(
    (capability) => capability.key === TARGET_CAPABILITY_KEY,
  );
  const auditPartitions = status.partitions.filter(
    (partition) => partition.key === TARGET_CAPABILITY_KEY,
  );
  if (auditCapabilities.length !== 1 || auditPartitions.length !== 1) {
    return 'capability_off';
  }

  const capability = auditCapabilities[0];
  const partition = auditPartitions[0];
  if (
    capability?.decision !== 'read_only' ||
    capability.dimensions.codeMaturity !== 'verified' ||
    capability.dimensions.institutionAuthorization !== 'authorized' ||
    capability.dimensions.connectionAvailability !== 'not_required' ||
    capability.dimensions.dataReadiness !== 'partial' ||
    capability.dimensions.productionRelease !== 'pilot_released' ||
    capability.safeSummary !== '审计与安全仅供查看' ||
    partition?.readiness !== 'ready' ||
    partition.failureCode !== null
  ) {
    return 'capability_off';
  }

  return 'released';
}

export default async function HospitalSystemAuditPage() {
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
  const {
    availableSectionIds,
    availableNavigationTargets,
    capabilityStatus,
    workspaceScopeKey,
  } = await resolveInstitutionShellAuthorizationV1(exactNavigationAuthorization);
  const genuineBlockedWithNavigation =
    exactNavigationAuthorization?.targetAccess === 'blocked' &&
    availableSectionIds.length > 0;

  let auditAuthorizationState: AuditAuthorizationState = 'unavailable';
  if (genuineAllowed) {
    try {
      const auditAuthorization =
        await resolveInstitutionAuditReadAuthorizationV1();
      auditAuthorizationState = auditAuthorization.kind;
    } catch {
      auditAuthorizationState = 'unavailable';
    }
  }

  const capabilityState: AuditCapabilityState = auditAuthorizationState === 'allowed'
    ? resolveExactAuditCapabilityState(capabilityStatus)
    : 'unavailable';

  const trustedForbidden =
    genuineBlockedWithNavigation ||
    (genuineAllowed && auditAuthorizationState === 'forbidden');

  return (
    <InstitutionNavigationShell
      activeSectionId={TARGET_SECTION_ID}
      availableSectionIds={availableSectionIds}
      availableNavigationTargets={availableNavigationTargets}
      workspaceScopeKey={workspaceScopeKey}
    >
      {genuineAllowed &&
      auditAuthorizationState === 'allowed' &&
      capabilityState === 'released' ? (
        <InstitutionAuditEventsShell />
      ) : trustedForbidden ? (
        <InstitutionPageState
          kind="forbidden"
          title="当前账号不可访问该栏目"
          description="当前仅确认栏目访问受限；未读取或展示任何业务数据。"
        />
      ) : genuineAllowed &&
        auditAuthorizationState === 'allowed' &&
        capabilityState === 'capability_off' &&
        AUDIT_CAPABILITY_OFF_ROUTE ? (
        <InstitutionCapabilityOffPage
          pageLabel={AUDIT_CAPABILITY_OFF_ROUTE.pageLabel}
          section={AUDIT_CAPABILITY_OFF_ROUTE.section}
        />
      ) : (
        <InstitutionPageState
          kind="unavailable"
          title="机构审计能力暂时不可用"
          description="当前未获得可信的审计能力放行结果；审计记录与操作入口保持隐藏。"
        />
      )}
    </InstitutionNavigationShell>
  );
}
