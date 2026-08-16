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
  'r4-knowledge-document-metadata-readonly-v1' as const;

const AUTHORITY_STATUS_FRESHNESS_WINDOW_MS = 5_000;
const WORKBENCH_READONLY_SUMMARY = '工作台仅供查看' as const;
const CUSTOMER_LIST_READONLY_SUMMARY = '客户列表仅供查看' as const;
const CARE_APPOINTMENTS_READONLY_SUMMARY = '预约管理仅供查看' as const;
const KNOWLEDGE_LIBRARY_READONLY_SUMMARY = '知识库资料仅供查看' as const;
const AI_USAGE_READONLY_SUMMARY = 'AI 使用统计仅供查看' as const;
const AUDIT_READONLY_SUMMARY = '审计与安全仅供查看' as const;

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
      const workbenchReadonlyPilot = definition.key === 'page_workbench';
      const customerListReadonlyPilot = definition.key === 'page_customer_list';
      const careAppointmentsReadonlyPilot =
        definition.key === 'page_care_appointments';
      const knowledgeLibraryReadonlyPilot =
        definition.key === 'page_knowledge_library';
      const aiUsageReadonlyPilot =
        definition.key === 'page_system_ai_usage';
      const auditReadonlyPilot = definition.key === 'page_system_audit';
      const readonlyPilot =
        workbenchReadonlyPilot ||
        customerListReadonlyPilot ||
        careAppointmentsReadonlyPilot ||
        knowledgeLibraryReadonlyPilot ||
        aiUsageReadonlyPilot ||
        auditReadonlyPilot;

      return Object.freeze({
        key: definition.key,
        decision:
          readonlyPilot && institutionAuthorized
            ? 'read_only'
            : 'hidden',
        dimensions: Object.freeze({
          codeMaturity: readonlyPilot ? 'verified' : 'unverified',
          institutionAuthorization: institutionAuthorized
            ? 'authorized'
            : 'not_authorized',
          connectionAvailability: 'not_required',
          dataReadiness: auditReadonlyPilot
            ? 'partial'
            : customerListReadonlyPilot
                || careAppointmentsReadonlyPilot
                || knowledgeLibraryReadonlyPilot
                || aiUsageReadonlyPilot
              ? 'ready'
              : 'not_required',
          productionRelease: readonlyPilot
            ? 'pilot_released'
            : 'not_released',
        }),
        safeSummary:
          readonlyPilot && institutionAuthorized
            ? auditReadonlyPilot
              ? AUDIT_READONLY_SUMMARY
              : customerListReadonlyPilot
                ? CUSTOMER_LIST_READONLY_SUMMARY
                : careAppointmentsReadonlyPilot
                  ? CARE_APPOINTMENTS_READONLY_SUMMARY
                  : knowledgeLibraryReadonlyPilot
                    ? KNOWLEDGE_LIBRARY_READONLY_SUMMARY
                    : aiUsageReadonlyPilot
                      ? AI_USAGE_READONLY_SUMMARY
                    : WORKBENCH_READONLY_SUMMARY
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
