import type { TenantFollowUpTask } from '@/modules/institution/domain/followup-workflow';
import type { TreatmentSummaryRecord } from '@/modules/institution/domain/treatment-summaries';
import {
  matchTreatmentPathTemplate,
  type TreatmentPathHandlerRole,
  type TreatmentPathTemplate,
  type TreatmentPathTemplateKey,
  type TreatmentPathTemplateMatch,
  type TreatmentPathTemplateNode,
} from '@/modules/institution/domain/treatment-path-templates';

export type FollowUpPathEnrollmentSourceType = 'treatment_summary' | 'manual_treatment_event';
export type FollowUpPathEnrollmentStatus = 'active' | 'completed' | 'cancelled';

export type NormalizedTreatmentEvent = {
  tenantId: string;
  customerId: string;
  treatmentSummaryId: string | null;
  sourceType: FollowUpPathEnrollmentSourceType;
  sourceId: string;
  treatmentDate: string;
  treatmentProject: string;
  treatmentCategory: string;
  treatmentStage: string;
  recoveryStage: string | null;
  riskLevel: TenantFollowUpTask['riskLevel'];
  nextCareAction: string;
  tags: string[];
  safeReasonCode: 'treatment_summary_normalized' | 'manual_treatment_event_normalized';
};

export type FollowUpPathStageInstance = {
  id: string;
  tenantId: string;
  institutionId: string | null;
  enrollmentId: string;
  nodeKey: string;
  stageKey: string;
  dueAt: string;
  status: TenantFollowUpTask['status'];
  followUpTaskId: string | null;
  handlerRole: TreatmentPathHandlerRole;
  riskLevel: TenantFollowUpTask['riskLevel'];
  safeMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type FollowUpPathEnrollment = {
  id: string;
  tenantId: string;
  institutionId: string | null;
  customerId: string;
  customerDisplayName: string;
  treatmentSummaryId: string | null;
  sourceType: FollowUpPathEnrollmentSourceType;
  sourceId: string;
  templateKey: TreatmentPathTemplateKey;
  templateVersion: string;
  status: FollowUpPathEnrollmentStatus;
  startedAt: string;
  completedAt: string | null;
  safeReasonCode: string;
  metadataJson: Record<string, unknown>;
  stageCount: number;
  taskCount: number;
  dueAt: string | null;
  safeMessage: string;
  taskIds: string[];
  stages: FollowUpPathStageInstance[];
  createdAt: string;
  updatedAt: string;
};

export type FollowUpPathStageDto = Pick<
  FollowUpPathStageInstance,
  | 'nodeKey'
  | 'stageKey'
  | 'dueAt'
  | 'status'
  | 'followUpTaskId'
  | 'handlerRole'
  | 'riskLevel'
  | 'safeMessage'
>;

export type FollowUpPathEnrollmentDto = {
  enrollmentId: string;
  customerId: string;
  customerDisplayName: string;
  templateKey: TreatmentPathTemplateKey;
  status: FollowUpPathEnrollmentStatus;
  stageCount: number;
  taskCount: number;
  dueAt: string | null;
  safeMessage: string;
  stages: FollowUpPathStageDto[];
  taskIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type FollowUpPathTemplateDto = {
  templateKey: TreatmentPathTemplateKey;
  stageCount: number;
  nodeKeys: string[];
  safeMessage: string;
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const templateVersion = 'v0.6-static';
const safeMessage = '路径任务需人工处理，不会主动向客户发送消息。';

function normalizeShortText(input: string | null | undefined, fallback = '') {
  return (input ?? '').normalize('NFKC').trim().slice(0, 160) || fallback;
}

function normalizeTags(input: readonly string[] | null | undefined) {
  return [...new Set((input ?? []).map((tag) => normalizeShortText(tag)).filter(Boolean))].slice(0, 12);
}

export function normalizeTreatmentEventFromTreatmentSummary(
  summary: TreatmentSummaryRecord,
): NormalizedTreatmentEvent {
  return {
    tenantId: summary.tenantId,
    customerId: summary.customerId,
    treatmentSummaryId: summary.id,
    sourceType: 'treatment_summary',
    sourceId: summary.id,
    treatmentDate: summary.treatmentDate,
    treatmentProject: normalizeShortText(summary.treatmentProject, '治疗项目'),
    treatmentCategory: normalizeShortText(summary.treatmentCategory),
    treatmentStage: normalizeShortText(summary.treatmentStage),
    recoveryStage: normalizeShortText(summary.recoveryStage) || null,
    riskLevel: summary.riskLevel,
    nextCareAction: normalizeShortText(summary.nextCareAction, '请人工确认治疗后护理情况。'),
    tags: normalizeTags(summary.tags),
    safeReasonCode: 'treatment_summary_normalized',
  };
}

export type FollowUpPathTemplateMatchResult =
  | { kind: 'matched'; event: NormalizedTreatmentEvent; match: TreatmentPathTemplateMatch }
  | { kind: 'no_matching_template'; safeReasonCode: 'no_matching_template' };

export function matchFollowUpPathTemplateForTreatmentEvent(
  event: NormalizedTreatmentEvent,
  preferredTemplateKey?: TreatmentPathTemplateKey | null,
): FollowUpPathTemplateMatchResult {
  const match = matchTreatmentPathTemplate({
    treatmentCategory: event.treatmentCategory,
    treatmentProject: event.treatmentProject,
    treatmentStage: event.treatmentStage,
    recoveryStage: event.recoveryStage,
    riskLevel: event.riskLevel,
    nextCareAction: event.nextCareAction,
    tags: event.tags,
  });

  if (!match) {
    return { kind: 'no_matching_template', safeReasonCode: 'no_matching_template' };
  }

  if (preferredTemplateKey && match.template.templateKey !== preferredTemplateKey) {
    return { kind: 'no_matching_template', safeReasonCode: 'no_matching_template' };
  }

  const nodes = match.template.nodes
    .filter((node) => node.riskLevels.includes(event.riskLevel))
    .sort((left, right) => left.offsetDays - right.offsetDays);

  return {
    kind: 'matched',
    event,
    match: {
      ...match,
      nodes,
    },
  };
}

export function serializeFollowUpPathTemplate(template: TreatmentPathTemplate) {
  return {
    templateKey: template.templateKey,
    templateVersion,
    nodes: template.nodes.map((node) => ({
      nodeKey: node.nodeKey,
      offsetDays: node.offsetDays,
      recoveryStage: node.recoveryStage,
      handlerRole: node.handlerRole,
      riskLevelCount: node.riskLevels.length,
      requiresHumanConfirmation: node.requiresHumanConfirmation,
      forbidAutoReachOut: node.forbidAutoReachOut,
    })),
  } satisfies Record<string, unknown>;
}

export function dueAtForTreatmentPathNode(treatmentDate: string, node: Pick<TreatmentPathTemplateNode, 'offsetDays'>) {
  const parsed = Date.parse(treatmentDate);
  const baseTimestamp = Number.isFinite(parsed) ? parsed : Date.parse('1970-01-01T00:00:00.000Z');

  return new Date(baseTimestamp + node.offsetDays * millisecondsPerDay).toISOString();
}

export function createFollowUpPathTaskDraft(input: {
  event: NormalizedTreatmentEvent;
  templateKey: TreatmentPathTemplateKey;
  node: TreatmentPathTemplateNode;
  customerDisplayName: string;
}) {
  const dueAt = dueAtForTreatmentPathNode(input.event.treatmentDate, input.node);
  const sourceSuggestionKey = `${input.event.sourceId}:path:${input.templateKey}:${input.node.nodeKey}`;

  return {
    tenantId: input.event.tenantId,
    customerId: input.event.customerId,
    customerDisplayName: input.customerDisplayName,
    journeyId: `followup_path_${input.templateKey}`.slice(0, 96),
    stage: input.node.taskTitle,
    status: 'scheduled' as const,
    dueAt,
    suggestedAction: `${input.node.taskTitle}。需人工处理，禁止自动触达客户。`,
    riskLevel: input.event.riskLevel,
    sourceTreatmentSummaryId:
      input.event.sourceType === 'treatment_summary' ? input.event.sourceId : '',
    sourceSuggestionKey,
  };
}

export function createFollowUpPathStageDraft(input: {
  id: string;
  tenantId: string;
  institutionId: string | null;
  enrollmentId: string;
  node: TreatmentPathTemplateNode;
  dueAt: string;
  followUpTaskId: string | null;
  riskLevel: TenantFollowUpTask['riskLevel'];
  occurredAt: string;
}) {
  return {
    id: input.id,
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    enrollmentId: input.enrollmentId,
    nodeKey: input.node.nodeKey,
    stageKey: input.node.recoveryStage,
    dueAt: input.dueAt,
    status: 'scheduled' as const,
    followUpTaskId: input.followUpTaskId,
    handlerRole: input.node.handlerRole,
    riskLevel: input.riskLevel,
    safeMessage,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
}

export function mapFollowUpPathEnrollmentToDto(
  enrollment: FollowUpPathEnrollment,
): FollowUpPathEnrollmentDto {
  return {
    enrollmentId: enrollment.id,
    customerId: enrollment.customerId,
    customerDisplayName: enrollment.customerDisplayName,
    templateKey: enrollment.templateKey,
    status: enrollment.status,
    stageCount: enrollment.stageCount,
    taskCount: enrollment.taskCount,
    dueAt: enrollment.dueAt,
    safeMessage: enrollment.safeMessage,
    stages: enrollment.stages.map((stage) => ({
      nodeKey: stage.nodeKey,
      stageKey: stage.stageKey,
      dueAt: stage.dueAt,
      status: stage.status,
      followUpTaskId: stage.followUpTaskId,
      handlerRole: stage.handlerRole,
      riskLevel: stage.riskLevel,
      safeMessage: stage.safeMessage,
    })),
    taskIds: enrollment.taskIds,
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
  };
}

export function mapFollowUpPathTemplateToDto(template: TreatmentPathTemplate): FollowUpPathTemplateDto {
  return {
    templateKey: template.templateKey,
    stageCount: template.nodes.length,
    nodeKeys: template.nodes.map((node) => node.nodeKey),
    safeMessage,
  };
}
