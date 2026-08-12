import { InstitutionAuditEventsShell } from '@/modules/institution/components/InstitutionAuditEventsShell';
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

const TARGET_SECTION_ID = 'system' as const;
const TARGET_CAPABILITY_KEY = 'page_system_audit' as const;
const TARGET_SAFE_SUMMARY = '审计与安全仅供查看' as const;
const EMPTY_SECTION_IDS = Object.freeze([]) as readonly InstitutionNavigationSectionIdV1[];
const TARGET_CAPABILITY_OFF_ROUTE = resolveInstitutionCapabilityOffRouteV1([
  'system',
  'audit',
]);

function hasExactReadonlyAuditAuthority(status: CapabilityStatusV1): boolean {
  if (status.readiness !== 'ready' || status.failureCode !== null) {
    return false;
  }

  const audit = status.data?.capabilities.find(
    (item) => item.key === TARGET_CAPABILITY_KEY,
  );

  return (
    audit?.decision === 'read_only' &&
    audit.dimensions.codeMaturity === 'verified' &&
    audit.dimensions.institutionAuthorization === 'authorized' &&
    audit.dimensions.connectionAvailability === 'not_required' &&
    audit.dimensions.dataReadiness === 'not_required' &&
    audit.dimensions.productionRelease === 'pilot_released' &&
    audit.safeSummary === TARGET_SAFE_SUMMARY
  );
}

function renderAuditCapabilityOff() {
  if (!TARGET_CAPABILITY_OFF_ROUTE) {
    return (
      <InstitutionPageState
        kind="unavailable"
        title="审计能力状态暂时不可用"
        description="当前无法确认审计页面的冻结路由定义；业务数据和业务入口保持隐藏。"
      />
    );
  }

  return (
    <InstitutionCapabilityOffPage
      pageLabel={TARGET_CAPABILITY_OFF_ROUTE.pageLabel}
      section={TARGET_CAPABILITY_OFF_ROUTE.section}
    />
  );
}

export default async function SystemAuditPage() {
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

  const availableSectionIds = exactNavigationAuthorization
    ? exactNavigationAuthorization.availableSectionIds
    : EMPTY_SECTION_IDS;
  const genuineAllowed =
    exactNavigationAuthorization?.targetAccess === 'allowed';
  const genuineBlockedWithNavigation =
    exactNavigationAuthorization?.targetAccess === 'blocked' &&
    availableSectionIds.length > 0;

  let auditReleased = false;
  if (genuineAllowed) {
    try {
      const capabilityStatus =
        await resolveInstitutionCapabilityAuthorityStatusV1();
      auditReleased =
        capabilityStatus !== null &&
        hasExactReadonlyAuditAuthority(capabilityStatus);
    } catch {
      auditReleased = false;
    }
  }

  return (
    <InstitutionNavigationShell
      activeSectionId={TARGET_SECTION_ID}
      availableSectionIds={availableSectionIds}
    >
      {genuineAllowed ? (
        auditReleased ? (
          <div data-capability-state="readonly-pilot">
            <InstitutionAuditEventsShell />
          </div>
        ) : (
          renderAuditCapabilityOff()
        )
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
