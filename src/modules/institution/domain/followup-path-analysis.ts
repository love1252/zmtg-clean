import type { FollowUpStatus } from '@/modules/institution/domain/followup-workflow';
import type { TreatmentFollowUpSuggestionRuleKey } from '@/modules/institution/domain/treatment-followup-suggestions';
import type { TreatmentSummaryStatus } from '@/modules/institution/domain/treatment-summaries';

export type FollowUpPathAnalysisTreatmentSummary = {
  summaryId: string;
  tenantId?: string;
  status: TreatmentSummaryStatus;
  voidedAt?: string | null;
};

export type FollowUpPathAnalysisSuggestion = {
  summaryId?: string;
  sourceTreatmentSummaryId?: string | null;
  suggestionKey: string;
  ruleKey: TreatmentFollowUpSuggestionRuleKey | string;
};

export type FollowUpPathAnalysisSourceTask = {
  taskId?: string;
  tenantId?: string;
  source?: 'treatment_summary' | string | null;
  sourceTreatmentSummaryId?: string | null;
  sourceSuggestionKey?: string | null;
  taskStatus: FollowUpStatus;
  dueAt: string;
  updatedAt?: string | null;
};

export type FollowUpPathAnalysisAuditEvent = {
  auditResource?: string | null;
  auditResult?: 'allowed' | 'denied' | 'conflict' | string | null;
  auditReason?: string | null;
  resourceId?: string | null;
  sourceTreatmentSummaryId?: string | null;
  sourceSuggestionKey?: string | null;
};

export type FollowUpPathAnalysisInput = {
  analysisAt: string;
  treatmentSummaries: readonly FollowUpPathAnalysisTreatmentSummary[];
  suggestions: readonly FollowUpPathAnalysisSuggestion[];
  sourceTasks: readonly FollowUpPathAnalysisSourceTask[];
  auditEvents: readonly FollowUpPathAnalysisAuditEvent[];
};

export type FollowUpPathAnalysisResult = {
  scope: 'followup_path_operational_analysis_v1';
  analysisAt: string;
  templateSuggestionCount: number;
  confirmedSourceTaskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;
  voidedSummaryBlockedCount: number;
  duplicateSourceTaskConflictCount: number;
  notes: string[];
  warnings: string[];
};

const templatePathRuleKey = 'template_path_followup';
const actionableOverdueStatuses = new Set<FollowUpStatus>([
  'scheduled',
  'due',
  'in_progress',
  'escalated',
]);

function hasValue(input: string | null | undefined): input is string {
  return typeof input === 'string' && input.trim().length > 0;
}

function normalized(input: string | null | undefined) {
  return (input ?? '').normalize('NFKC').trim().toLowerCase();
}

function isActiveSummary(summary: FollowUpPathAnalysisTreatmentSummary) {
  return summary.status === 'active' && !summary.voidedAt;
}

function isVoidedSummary(summary: FollowUpPathAnalysisTreatmentSummary) {
  return summary.status === 'voided' || Boolean(summary.voidedAt);
}

function suggestionSummaryId(suggestion: FollowUpPathAnalysisSuggestion) {
  return hasValue(suggestion.summaryId)
    ? suggestion.summaryId
    : hasValue(suggestion.sourceTreatmentSummaryId)
      ? suggestion.sourceTreatmentSummaryId
      : null;
}

function isTemplatePathSuggestionKey(input: string | null | undefined) {
  return normalized(input).split(':').includes(templatePathRuleKey);
}

function isTemplatePathSourceTask(task: FollowUpPathAnalysisSourceTask) {
  return (
    task.source === 'treatment_summary' &&
    hasValue(task.sourceTreatmentSummaryId) &&
    hasValue(task.sourceSuggestionKey) &&
    isTemplatePathSuggestionKey(task.sourceSuggestionKey)
  );
}

function timestamp(input: string) {
  const parsed = Date.parse(input);

  return Number.isFinite(parsed) ? parsed : null;
}

function isOverdueTask(task: FollowUpPathAnalysisSourceTask, analysisTimestamp: number | null) {
  if (analysisTimestamp === null || !actionableOverdueStatuses.has(task.taskStatus)) {
    return false;
  }

  const dueTimestamp = timestamp(task.dueAt);

  return dueTimestamp !== null && dueTimestamp < analysisTimestamp;
}

function auditSummaryId(event: FollowUpPathAnalysisAuditEvent) {
  if (hasValue(event.sourceTreatmentSummaryId)) {
    return event.sourceTreatmentSummaryId;
  }

  return hasValue(event.resourceId) ? event.resourceId : null;
}

function sourceTaskById(tasks: readonly FollowUpPathAnalysisSourceTask[]) {
  const entries: [string, FollowUpPathAnalysisSourceTask][] = [];

  for (const task of tasks) {
    if (hasValue(task.taskId)) {
      entries.push([task.taskId, task]);
    }
  }

  return new Map(entries);
}

function isVoidedFollowUpBlockReason(input: string | null | undefined) {
  const reason = normalized(input);

  if (!reason) {
    return false;
  }

  if ([
    'voided_treatment_summary_follow_up_blocked',
    'voided_summary_follow_up_blocked',
    'voided_summary_follow_up_denied',
    'voided_summary_follow_up_conflict',
  ].includes(reason)) {
    return true;
  }

  return (
    reason.includes('voided') &&
    reason.includes('summary') &&
    (reason.includes('follow_up') || reason.includes('follow-up') || reason.includes('followup')) &&
    (reason.includes('blocked') || reason.includes('denied') || reason.includes('conflict'))
  );
}

function isDuplicateSourceTaskConflictReason(input: string | null | undefined) {
  const reason = normalized(input);

  if (!reason) {
    return false;
  }

  if ([
    'active_source_follow_up_exists',
    'duplicate_source_follow_up_conflict',
    'duplicate_source_follow_up_exists',
  ].includes(reason)) {
    return true;
  }

  return (
    (reason.includes('active_source') || reason.includes('duplicate')) &&
    (reason.includes('follow_up') || reason.includes('follow-up') || reason.includes('followup')) &&
    (reason.includes('exists') || reason.includes('conflict'))
  );
}

function isLinkedTemplatePathDuplicateConflict(input: {
  event: FollowUpPathAnalysisAuditEvent;
  tasksById: ReadonlyMap<string, FollowUpPathAnalysisSourceTask>;
}) {
  if (!isDuplicateSourceTaskConflictReason(input.event.auditReason) || !hasValue(input.event.resourceId)) {
    return false;
  }

  const task = input.tasksById.get(input.event.resourceId);

  return task ? isTemplatePathSourceTask(task) : false;
}

function analysisWarnings(input: {
  analysis: FollowUpPathAnalysisInput;
  analysisTimestamp: number | null;
  duplicateConflictAuditCount: number;
  linkedDuplicateConflictCount: number;
}) {
  const warnings: string[] = [];

  if (input.analysis.auditEvents.length === 0) {
    warnings.push('审计事件为空，作废阻断数和重复来源任务冲突数不会被猜测。');
  }

  if (input.analysisTimestamp === null) {
    warnings.push('analysisAt 无法解析，任务超时数按 0 处理。');
  }

  if (input.duplicateConflictAuditCount > input.linkedDuplicateConflictCount) {
    warnings.push('部分重复来源任务冲突审计未能通过 resourceId 关联到模板路径来源任务，未计入正式数量。');
  }

  return warnings;
}

export function buildFollowUpPathAnalysis(
  input: FollowUpPathAnalysisInput,
): FollowUpPathAnalysisResult {
  const activeSummaryIds = new Set(
    input.treatmentSummaries.filter(isActiveSummary).map((summary) => summary.summaryId),
  );
  const voidedSummaryIds = new Set(
    input.treatmentSummaries.filter(isVoidedSummary).map((summary) => summary.summaryId),
  );
  const templatePathTasks = input.sourceTasks.filter(isTemplatePathSourceTask);
  const tasksById = sourceTaskById(input.sourceTasks);
  const analysisTimestamp = timestamp(input.analysisAt);
  const duplicateConflictAuditEvents = input.auditEvents.filter((event) =>
    isDuplicateSourceTaskConflictReason(event.auditReason),
  );
  const linkedDuplicateConflictEvents = duplicateConflictAuditEvents.filter((event) =>
    isLinkedTemplatePathDuplicateConflict({ event, tasksById }),
  );

  return {
    scope: 'followup_path_operational_analysis_v1',
    analysisAt: input.analysisAt,
    templateSuggestionCount: input.suggestions.filter((suggestion) => (
      suggestion.ruleKey === templatePathRuleKey &&
      activeSummaryIds.has(suggestionSummaryId(suggestion) ?? '')
    )).length,
    confirmedSourceTaskCount: templatePathTasks.length,
    completedTaskCount: templatePathTasks.filter((task) => task.taskStatus === 'completed').length,
    overdueTaskCount: templatePathTasks.filter((task) => isOverdueTask(task, analysisTimestamp)).length,
    voidedSummaryBlockedCount: input.auditEvents.filter((event) => {
      const summaryId = auditSummaryId(event);

      return (
        hasValue(summaryId) &&
        voidedSummaryIds.has(summaryId) &&
        isVoidedFollowUpBlockReason(event.auditReason)
      );
    }).length,
    duplicateSourceTaskConflictCount: linkedDuplicateConflictEvents.length,
    notes: [
      '只统计 template_path_followup 模板建议。',
      '任务超时数使用传入的固定 analysisAt，不读取本地时间。',
      '作废阻断和重复来源冲突仅来自可识别审计事件。',
    ],
    warnings: analysisWarnings({
      analysis: input,
      analysisTimestamp,
      duplicateConflictAuditCount: duplicateConflictAuditEvents.length,
      linkedDuplicateConflictCount: linkedDuplicateConflictEvents.length,
    }),
  };
}
