import { InstitutionNavigationShell } from '@/modules/institution/components/InstitutionNavigationShell';
import type { ConversationActionSourceV1 } from '@/modules/institution-contracts/v1/conversation-action';
import type { InstitutionNavigationSectionIdV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { resolveInstitutionServerAuthorizationV1 } from '@/modules/institution/server/institution-server-runtime';
import { InstitutionWorkbenchCapabilityOff } from '@/modules/institution-workbench/components/InstitutionWorkbenchCapabilityOff';
import { buildWorkbenchActionProjection } from '@/modules/institution-workbench/domain/workbench-action-aggregation';
import type { WorkbenchActionProjection } from '@/modules/institution-workbench/domain/workbench-action-view-models';
import { buildWorkbenchCapabilityProjection } from '@/modules/institution-workbench/domain/workbench-capability-projection';
import type { WorkbenchCapabilityProjection } from '@/modules/institution-workbench/domain/workbench-capability-view-models';
import { isInstitutionRequestAuthorizationV1 } from '@/modules/security/server/institution-request-authorization';
import {
  isInstitutionNavigationAuthorizationV1,
  type InstitutionNavigationAuthorizationV1,
} from '@/modules/security/server/institution-section-guard';
import { resolveInstitutionCapabilityAuthorityStatusV1 } from '@/server/orchestration/institution-capability-authority';
import { readCurrentInstitutionCareActionSourceV1 } from '@/server/orchestration/institution-care-action-source';
import { canCurrentInstitutionCreateFormalFollowUpV1 } from '@/server/orchestration/institution-care-create-availability';

const TARGET_SECTION_ID = 'workbench' as const;
const TARGET_CAPABILITY_KEY = 'page_workbench' as const;
const EMPTY_SECTION_IDS = Object.freeze([]) as readonly InstitutionNavigationSectionIdV1[];
const GOVERNED_WORKBENCH_PAGE_KEYS = Object.freeze([
  'page_workbench',
  'page_customer_list',
  'page_conversation_queue',
  'page_care_appointments',
  'page_care_followups',
  'page_knowledge_library',
  'page_analytics_overview',
  'page_system_ai_usage',
  'page_system_audit',
] as const);

function selectGovernedWorkbenchProjection(
  projection: WorkbenchCapabilityProjection,
  allowCareCreate: boolean,
): WorkbenchCapabilityProjection | null {
  if (projection.status !== 'projected') {
    return null;
  }

  const quickCreate = projection.quickCreateMenu;
  if (
    quickCreate !== null
    && (
      quickCreate.label !== '新建'
      || quickCreate.items.length !== 1
      || quickCreate.items[0]?.key !== 'action_care_followup_create'
      || quickCreate.items[0]?.href !== '/hospital/care/followups?create=1'
    )
  ) {
    return null;
  }

  const summaries = projection.summaries.filter((summary) =>
    GOVERNED_WORKBENCH_PAGE_KEYS.some((key) => key === summary.key),
  );
  const workbenchSummaries = summaries.filter(
    (summary) => summary.key === TARGET_CAPABILITY_KEY,
  );
  if (workbenchSummaries.length !== 1) return null;

  const workbenchSummary = workbenchSummaries[0];
  if (
    !workbenchSummary ||
    workbenchSummary.kind !== 'page' ||
    workbenchSummary.decision !== 'read_only' ||
    workbenchSummary.safeSummary !== '工作台仅供查看' ||
    summaries.some((summary) => {
      if (summary.kind !== 'page') return true;
      if (summary.key === 'page_care_followups') {
        return (
          summary.decision !== 'operational'
          || summary.safeSummary !== '随访任务可用'
        );
      }
      return summary.decision !== 'read_only';
    })
  ) return null;

  const careFollowupSummaries = summaries.filter(
    (summary) => summary.key === 'page_care_followups',
  );
  if (careFollowupSummaries.length > 1) return null;
  if (quickCreate !== null && careFollowupSummaries.length !== 1) return null;

  return Object.freeze({
    status: 'projected',
    sourceReadiness: projection.sourceReadiness,
    summaries: Object.freeze(summaries),
    quickCreateMenu:
      allowCareCreate ? quickCreate : null,
  });
}

function disabledConversationActionSource(
  tenantId: string,
  institutionId: string,
): ConversationActionSourceV1 {
  return {
    contractVersion: 'v1',
    scope: { tenantId, institutionId },
    readiness: 'disabled',
    freshness: null,
    partitions: [
      {
        key: 'waiting_human',
        readiness: 'disabled',
        freshness: null,
        failureCode: 'not_released',
      },
      {
        key: 'unresolved_risk',
        readiness: 'disabled',
        freshness: null,
        failureCode: 'not_released',
      },
    ],
    data: null,
    failureCode: 'not_released',
  };
}

export default async function HospitalPage() {
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

  let capabilityProjection: WorkbenchCapabilityProjection | null = null;
  let actionProjection: WorkbenchActionProjection | null = null;
  if (genuineAllowed) {
    try {
      const capabilityStatus =
        await resolveInstitutionCapabilityAuthorityStatusV1();
      if (capabilityStatus) {
        const projection = buildWorkbenchCapabilityProjection({
          capabilities: capabilityStatus,
          referenceTime: capabilityStatus.freshness?.observedAt ?? '',
        });
        const allowCareCreate =
          projection.status === 'projected'
          && projection.quickCreateMenu !== null
            ? await canCurrentInstitutionCreateFormalFollowUpV1()
            : false;
        const workbenchProjection =
          selectGovernedWorkbenchProjection(
            projection,
            allowCareCreate,
          );
        if (workbenchProjection) {
          capabilityProjection = workbenchProjection;
        }
      }
    } catch {
      capabilityProjection = null;
    }
  }

  const followupsOperational =
    capabilityProjection?.status === 'projected'
    && capabilityProjection.summaries.some(
      (summary) =>
        summary.key === 'page_care_followups'
        && summary.decision === 'operational'
        && summary.safeSummary === '随访任务可用',
    );

  if (genuineAllowed && followupsOperational) {
    try {
      const care = await readCurrentInstitutionCareActionSourceV1();
      if (care) {
        actionProjection = buildWorkbenchActionProjection({
          care,
          conversation: disabledConversationActionSource(
            care.scope.tenantId,
            care.scope.institutionId,
          ),
          filter: 'all',
        });
      }
    } catch {
      actionProjection = null;
    }
  }

  return (
    <InstitutionNavigationShell
      activeSectionId={TARGET_SECTION_ID}
      availableSectionIds={availableSectionIds}
    >
      <InstitutionWorkbenchCapabilityOff
        genuineAllowed={genuineAllowed}
        capabilityProjection={capabilityProjection}
        actionProjection={actionProjection}
      />
    </InstitutionNavigationShell>
  );
}
