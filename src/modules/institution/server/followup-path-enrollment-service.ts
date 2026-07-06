import type { AccessContext } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';
import type { createTreatmentSummaryRepository } from '@/modules/institution/server/treatment-summary-repository';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import type { TreatmentPathTemplateKey } from '@/modules/institution/domain/treatment-path-templates';
import { treatmentPathTemplates } from '@/modules/institution/domain/treatment-path-templates';
import {
  createFollowUpPathStageDraft,
  createFollowUpPathTaskDraft,
  dueAtForTreatmentPathNode,
  mapFollowUpPathEnrollmentToDto,
  mapFollowUpPathTemplateToDto,
  matchFollowUpPathTemplateForTreatmentEvent,
  normalizeTreatmentEventFromTreatmentSummary,
  serializeFollowUpPathTemplate,
  type FollowUpPathEnrollmentDto,
} from '@/modules/institution/domain/followup-path-enrollment';
import type { TreatmentPathTemplateNode } from '@/modules/institution/domain/treatment-path-templates';

const templateVersion = 'v0.6-static';

type TreatmentSummaryRepository = ReturnType<typeof createTreatmentSummaryRepository>;

type ServiceRepository = Pick<
  TenantBusinessRepository,
  | 'getCustomerByTenant'
  | 'createFollowUpTaskFromTreatmentSummarySuggestion'
  | 'createFollowUpPathEnrollment'
  | 'createFollowUpPathStages'
  | 'listFollowUpPathEnrollmentsByTenant'
  | 'getFollowUpPathEnrollmentByTenant'
  | 'cancelFollowUpPathEnrollment'
>;

export type CreateFollowUpPathEnrollmentFromTreatmentSummaryInput = {
  context: AccessContext;
  sourceId: string;
  templateKey?: TreatmentPathTemplateKey | null;
  treatmentSummaryRepository: Pick<TreatmentSummaryRepository, 'getTreatmentSummaryByTenant'>;
  tenantBusinessRepository: ServiceRepository;
  occurredAt: string;
};

export type CreateFollowUpPathEnrollmentResult =
  | { kind: 'created'; enrollment: FollowUpPathEnrollmentDto }
  | { kind: 'not_found' }
  | { kind: 'voided' }
  | { kind: 'no_matching_template'; safeReasonCode: 'no_matching_template' }
  | { kind: 'conflict'; resourceId: string; reason: 'active_follow_up_path_enrollment_exists' }
  | { kind: 'forbidden'; reason: 'missing_tenant' | 'cross_tenant_denied' | 'role_denied' | 'sensitive_detail_denied' };

export type ListFollowUpPathEnrollmentsResult =
  | { kind: 'success'; enrollments: FollowUpPathEnrollmentDto[] }
  | { kind: 'forbidden'; reason: 'missing_tenant' | 'cross_tenant_denied' | 'role_denied' | 'sensitive_detail_denied' };

export type GetFollowUpPathEnrollmentResult =
  | { kind: 'success'; enrollment: FollowUpPathEnrollmentDto }
  | { kind: 'not_found' }
  | { kind: 'forbidden'; reason: 'missing_tenant' | 'cross_tenant_denied' | 'role_denied' | 'sensitive_detail_denied' };

export type CancelFollowUpPathEnrollmentServiceResult =
  | { kind: 'cancelled'; enrollment: FollowUpPathEnrollmentDto }
  | { kind: 'not_found' }
  | { kind: 'conflict'; resourceId: string; reason: 'follow_up_path_enrollment_not_active' }
  | { kind: 'forbidden'; reason: 'missing_tenant' | 'cross_tenant_denied' | 'role_denied' | 'sensitive_detail_denied' };

function canUseFollowUpPath(context: AccessContext, action: 'read_own_tenant' | 'create' | 'update') {
  return canAccessResource({
    context,
    resource: 'follow_up',
    action,
    targetTenantId: context.tenantId,
  });
}

function hasTenant(context: AccessContext): context is AccessContext & { tenantId: string } {
  return Boolean(context.tenantId);
}

export function listFollowUpPathTemplates() {
  return treatmentPathTemplates.map(mapFollowUpPathTemplateToDto);
}

export async function createFollowUpTasksForEnrollment(input: {
  tenantBusinessRepository: Pick<ServiceRepository, 'createFollowUpTaskFromTreatmentSummarySuggestion'>;
  event: ReturnType<typeof normalizeTreatmentEventFromTreatmentSummary>;
  templateKey: TreatmentPathTemplateKey;
  nodes: readonly TreatmentPathTemplateNode[];
  customerDisplayName: string;
}) {
  const tasks = [];

  for (const node of input.nodes) {
    const draft = createFollowUpPathTaskDraft({
      event: input.event,
      templateKey: input.templateKey,
      node,
      customerDisplayName: input.customerDisplayName,
    });
    const result = await input.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion({
      id: globalThis.crypto.randomUUID(),
      ...draft,
      skipActiveSourceConflict: true,
    });

    if (result.kind === 'created') {
      tasks.push(result.task);
    }
  }

  return tasks;
}

export async function createEnrollmentFromTreatmentSummary(
  input: CreateFollowUpPathEnrollmentFromTreatmentSummaryInput,
): Promise<CreateFollowUpPathEnrollmentResult> {
  const decision = canUseFollowUpPath(input.context, 'create');
  if (!decision.allowed) {
    return { kind: 'forbidden', reason: decision.reason };
  }

  if (!hasTenant(input.context)) {
    return { kind: 'forbidden', reason: 'missing_tenant' };
  }

  const tenantId = input.context.tenantId;
  const summary = await input.treatmentSummaryRepository.getTreatmentSummaryByTenant({
    tenantId,
    id: input.sourceId,
  });

  if (!summary) {
    return { kind: 'not_found' };
  }

  if (summary.status === 'voided') {
    return { kind: 'voided' };
  }

  const event = normalizeTreatmentEventFromTreatmentSummary(summary);
  const matchResult = matchFollowUpPathTemplateForTreatmentEvent(event, input.templateKey);

  if (matchResult.kind === 'no_matching_template') {
    return matchResult;
  }

  const customer = await input.tenantBusinessRepository.getCustomerByTenant({
    tenantId: input.context.tenantId,
    id: event.customerId,
  });

  if (!customer) {
    return { kind: 'not_found' };
  }

  const enrollmentResult = await input.tenantBusinessRepository.createFollowUpPathEnrollment({
    id: globalThis.crypto.randomUUID(),
    tenantId,
    institutionId: input.context.institutionId ?? null,
    customerId: event.customerId,
    treatmentSummaryId: event.treatmentSummaryId,
    sourceType: event.sourceType,
    sourceId: event.sourceId,
    templateKey: matchResult.match.template.templateKey,
    templateVersion,
    templateSnapshotJson: serializeFollowUpPathTemplate(matchResult.match.template),
    status: 'active',
    startedAt: new Date(input.occurredAt),
    completedAt: null,
    safeReasonCode: 'treatment_summary_path_enrolled',
    metadataJson: {
      matchedBy: matchResult.match.matchedBy,
      normalizedRecoveryStage: matchResult.match.normalizedRecoveryStage,
      riskLevel: matchResult.match.riskLevel,
    },
  });

  if (enrollmentResult.kind === 'conflict') {
    return {
      kind: 'conflict',
      resourceId: enrollmentResult.resourceId,
      reason: enrollmentResult.reason,
    };
  }

  if (enrollmentResult.kind !== 'created') {
    return { kind: 'not_found' };
  }

  const tasks = await createFollowUpTasksForEnrollment({
    tenantBusinessRepository: input.tenantBusinessRepository,
    event,
    templateKey: matchResult.match.template.templateKey,
    nodes: matchResult.match.nodes,
    customerDisplayName: customer.displayName,
  });

  const stages = await input.tenantBusinessRepository.createFollowUpPathStages(
    matchResult.match.nodes.map((node) => {
      const task = tasks.find((candidate) =>
        candidate.sourceSuggestionKey?.endsWith(`:${node.nodeKey}`),
      );

      return createFollowUpPathStageDraft({
        id: globalThis.crypto.randomUUID(),
        tenantId,
        institutionId: input.context.institutionId ?? null,
        enrollmentId: enrollmentResult.enrollment.id,
        node,
        dueAt: dueAtForTreatmentPathNode(event.treatmentDate, node),
        followUpTaskId: task?.id ?? null,
        riskLevel: event.riskLevel,
        occurredAt: input.occurredAt,
      });
    }),
  );
  const completedEnrollment = {
    ...enrollmentResult.enrollment,
    stageCount: stages.length,
    taskCount: tasks.length,
    dueAt: stages.sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt))[0]?.dueAt ?? null,
    taskIds: tasks.map((task) => task.id),
    stages,
  };

  return {
    kind: 'created',
    enrollment: mapFollowUpPathEnrollmentToDto(completedEnrollment),
  };
}

export async function listFollowUpPathEnrollments(input: {
  context: AccessContext;
  tenantBusinessRepository: Pick<ServiceRepository, 'listFollowUpPathEnrollmentsByTenant'>;
}): Promise<ListFollowUpPathEnrollmentsResult> {
  const decision = canUseFollowUpPath(input.context, 'read_own_tenant');
  if (!decision.allowed) {
    return { kind: 'forbidden', reason: decision.reason };
  }

  if (!hasTenant(input.context)) {
    return { kind: 'forbidden', reason: 'missing_tenant' };
  }

  const enrollments = await input.tenantBusinessRepository.listFollowUpPathEnrollmentsByTenant({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
  });

  return { kind: 'success', enrollments: enrollments.map(mapFollowUpPathEnrollmentToDto) };
}

export async function getFollowUpPathEnrollment(input: {
  context: AccessContext;
  enrollmentId: string;
  tenantBusinessRepository: Pick<ServiceRepository, 'getFollowUpPathEnrollmentByTenant'>;
}): Promise<GetFollowUpPathEnrollmentResult> {
  const decision = canUseFollowUpPath(input.context, 'read_own_tenant');
  if (!decision.allowed) {
    return { kind: 'forbidden', reason: decision.reason };
  }

  if (!hasTenant(input.context)) {
    return { kind: 'forbidden', reason: 'missing_tenant' };
  }

  const enrollment = await input.tenantBusinessRepository.getFollowUpPathEnrollmentByTenant({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
    enrollmentId: input.enrollmentId,
  });

  return enrollment
    ? { kind: 'success', enrollment: mapFollowUpPathEnrollmentToDto(enrollment) }
    : { kind: 'not_found' };
}

export async function cancelFollowUpPathEnrollment(input: {
  context: AccessContext;
  enrollmentId: string;
  tenantBusinessRepository: Pick<ServiceRepository, 'cancelFollowUpPathEnrollment'>;
}): Promise<CancelFollowUpPathEnrollmentServiceResult> {
  const decision = canUseFollowUpPath(input.context, 'update');
  if (!decision.allowed) {
    return { kind: 'forbidden', reason: decision.reason };
  }

  if (!hasTenant(input.context)) {
    return { kind: 'forbidden', reason: 'missing_tenant' };
  }

  const result = await input.tenantBusinessRepository.cancelFollowUpPathEnrollment({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
    enrollmentId: input.enrollmentId,
  });

  if (result.kind === 'cancelled') {
    return { kind: 'cancelled', enrollment: mapFollowUpPathEnrollmentToDto(result.enrollment) };
  }

  return result;
}
