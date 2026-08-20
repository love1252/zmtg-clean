import type {
  CapabilityStatusItemV1,
  CapabilityStatusV1,
} from '@/modules/institution-contracts/v1/institution-capability';
import {
  INSTITUTION_CAPABILITY_REGISTRY_V1,
  isInstitutionDiagnosticTargetCapabilityKeyV1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import {
  consumeInstitutionCapabilityAuthorityRuntimeContextV1,
  resolveInstitutionCapabilityAuthorityRuntimeContextV1,
} from '@/modules/institution/server/institution-server-runtime';

export const INSTITUTION_CAPABILITY_AUTHORITY_REVISION_V1 =
  'r11-workbench-controlled-write-final-acceptance-v1' as const;

const AUTHORITY_STATUS_FRESHNESS_WINDOW_MS = 5_000;
const WORKBENCH_OPERATIONAL_SUMMARY = '工作台可用' as const;
const CUSTOMER_LIST_OPERATIONAL_SUMMARY = '客户列表可用' as const;
const CONVERSATION_QUEUE_OPERATIONAL_SUMMARY = '会话队列可用' as const;
const CARE_APPOINTMENTS_OPERATIONAL_SUMMARY = '预约管理可用' as const;
const KNOWLEDGE_LIBRARY_READONLY_SUMMARY = '知识库资料仅供查看' as const;
const ANALYTICS_OVERVIEW_READONLY_SUMMARY = '经营总览仅供查看' as const;
const AI_USAGE_READONLY_SUMMARY = 'AI 使用统计仅供查看' as const;
const AUDIT_READONLY_SUMMARY = '审计与安全仅供查看' as const;
const CARE_FOLLOWUPS_OPERATIONAL_SUMMARY = '随访任务可用' as const;

function buildCapabilityStatus(
  context: NonNullable<
    ReturnType<typeof consumeInstitutionCapabilityAuthorityRuntimeContextV1>
  >,
): CapabilityStatusV1 | null {
  const observedAtEpochMs = Date.parse(context.observedAt);
  if (!Number.isFinite(observedAtEpochMs)) return null;

  const freshness = Object.freeze({
    observedAt: context.observedAt,
    freshUntil: new Date(
      observedAtEpochMs + AUTHORITY_STATUS_FRESHNESS_WINDOW_MS,
    ).toISOString(),
  });

  const availableSections = new Set(context.availableSectionIds);
  const systemAvailable = availableSections.has('system');

  const capabilities: CapabilityStatusItemV1[] =
    INSTITUTION_CAPABILITY_REGISTRY_V1.map((definition) => {
      const institutionAuthorized = availableSections.has(definition.sectionId);
      const workbenchOperationalPilot = definition.key === 'page_workbench';
      const customerListOperationalPilot = definition.key === 'page_customer_list';
      const customerCreateOperationalPilot =
        definition.key === 'action_customer_create';
      const conversationQueueOperationalPilot =
        definition.key === 'page_conversation_queue';
      const careAppointmentsOperationalPilot =
        definition.key === 'page_care_appointments';
      const careAppointmentCreateOperationalPilot =
        definition.key === 'action_care_appointment_create';
      const knowledgeLibraryReadonlyPilot =
        definition.key === 'page_knowledge_library';
      const analyticsOverviewReadonlyPilot =
        definition.key === 'page_analytics_overview';
      const aiUsageReadonlyPilot =
        definition.key === 'page_system_ai_usage';
      const auditReadonlyPilot = definition.key === 'page_system_audit';
      const careFollowupsOperationalPilot =
        definition.key === 'page_care_followups';
      const careFollowupCreateOperationalPilot =
        definition.key === 'action_care_followup_create';
      const readonlyPilot =
        knowledgeLibraryReadonlyPilot ||
        analyticsOverviewReadonlyPilot ||
        aiUsageReadonlyPilot ||
        auditReadonlyPilot;
      const operationalPilot =
        workbenchOperationalPilot
        || conversationQueueOperationalPilot
        || customerListOperationalPilot
        || customerCreateOperationalPilot
        || careAppointmentsOperationalPilot
        || careAppointmentCreateOperationalPilot
        || careFollowupsOperationalPilot
        || careFollowupCreateOperationalPilot;
      const releasedPilot = readonlyPilot || operationalPilot;

      return Object.freeze({
        key: definition.key,
        decision:
          operationalPilot && institutionAuthorized
            ? 'operational'
            : readonlyPilot && institutionAuthorized
              ? 'read_only'
              : 'hidden',
        dimensions: Object.freeze({
          codeMaturity: releasedPilot ? 'verified' : 'unverified',
          institutionAuthorization: institutionAuthorized
            ? 'authorized'
            : 'not_authorized',
          connectionAvailability: 'not_required',
          dataReadiness: auditReadonlyPilot
            ? 'partial'
            : conversationQueueOperationalPilot
                || knowledgeLibraryReadonlyPilot
                || analyticsOverviewReadonlyPilot
                || aiUsageReadonlyPilot
                || operationalPilot
              ? 'ready'
              : 'not_required',
          productionRelease: releasedPilot
            ? 'pilot_released'
            : 'not_released',
        }),
        safeSummary:
          workbenchOperationalPilot && institutionAuthorized
            ? WORKBENCH_OPERATIONAL_SUMMARY
            : customerListOperationalPilot && institutionAuthorized
              ? CUSTOMER_LIST_OPERATIONAL_SUMMARY
              : customerCreateOperationalPilot && institutionAuthorized
                ? null
                : careAppointmentsOperationalPilot && institutionAuthorized
                  ? CARE_APPOINTMENTS_OPERATIONAL_SUMMARY
                  : careAppointmentCreateOperationalPilot && institutionAuthorized
                    ? null
                    : careFollowupsOperationalPilot && institutionAuthorized
                      ? CARE_FOLLOWUPS_OPERATIONAL_SUMMARY
                      : careFollowupCreateOperationalPilot && institutionAuthorized
                        ? null
                        : conversationQueueOperationalPilot && institutionAuthorized
                          ? CONVERSATION_QUEUE_OPERATIONAL_SUMMARY
                          : auditReadonlyPilot && institutionAuthorized
                            ? AUDIT_READONLY_SUMMARY
                            : knowledgeLibraryReadonlyPilot && institutionAuthorized
                              ? KNOWLEDGE_LIBRARY_READONLY_SUMMARY
                              : analyticsOverviewReadonlyPilot && institutionAuthorized
                                ? ANALYTICS_OVERVIEW_READONLY_SUMMARY
                                : aiUsageReadonlyPilot && institutionAuthorized
                                  ? AI_USAGE_READONLY_SUMMARY
                                  : null,
        diagnosticTargetKey:
          systemAvailable &&
          isInstitutionDiagnosticTargetCapabilityKeyV1(definition.key)
            ? definition.key
            : null,
      } satisfies CapabilityStatusItemV1);
    });

  const partitions: CapabilityStatusV1['partitions'] =
    INSTITUTION_CAPABILITY_REGISTRY_V1.map((definition) =>
      Object.freeze({
        key: definition.key,
        readiness: 'ready',
        freshness,
        failureCode: null,
      }),
    );

  Object.freeze(capabilities);
  Object.freeze(partitions);

  return Object.freeze({
    contractVersion: 'v1',
    scope: Object.freeze({
      tenantId: context.tenantId,
      institutionId: context.institutionId,
    }),
    readiness: 'ready',
    freshness,
    partitions,
    data: Object.freeze({ capabilities }),
    failureCode: null,
  } satisfies CapabilityStatusV1);
}

export async function resolveInstitutionCapabilityAuthorityStatusV1(): Promise<CapabilityStatusV1 | null> {
  try {
    const handle = await resolveInstitutionCapabilityAuthorityRuntimeContextV1();
    if (!handle) return null;

    const context =
      consumeInstitutionCapabilityAuthorityRuntimeContextV1(handle);
    if (!context) return null;

    return buildCapabilityStatus(context);
  } catch {
    return null;
  }
}
