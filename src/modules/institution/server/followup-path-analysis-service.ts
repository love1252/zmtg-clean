import {
  buildFollowUpPathAnalysis,
  type FollowUpPathAnalysisResult,
} from '@/modules/institution/domain/followup-path-analysis';
import {
  buildTreatmentFollowUpSuggestions,
  type TreatmentFollowUpSuggestion,
} from '@/modules/institution/domain/treatment-followup-suggestions';
import type { AuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import type { TreatmentSummaryRepository } from '@/modules/institution/server/treatment-summary-repository';

export type FollowUpPathAnalysisApiResponse = FollowUpPathAnalysisResult & {
  dataSourceNote: string;
  boundaryNote: string;
};

type FollowUpPathAnalysisReadRepositories = {
  auditRepository: Pick<AuditEventRepository, 'listFollowUpPathAnalysisAuditEventsByTenant'>;
  tenantBusinessRepository: Pick<TenantBusinessRepository, 'listFollowUpPathAnalysisSourceTasksByTenant'>;
  treatmentSummaryRepository: Pick<
    TreatmentSummaryRepository,
    'listFollowUpPathAnalysisTreatmentSummariesByTenant'
  >;
};

function mapSuggestions(summary: Awaited<
  ReturnType<TreatmentSummaryRepository['listFollowUpPathAnalysisTreatmentSummariesByTenant']>
>[number]) {
  return buildTreatmentFollowUpSuggestions({
    id: summary.summaryId,
    customerId: summary.customerId,
    appointmentId: summary.appointmentId,
    treatmentDate: summary.treatmentDate,
    treatmentProject: summary.treatmentProject,
    treatmentCategory: summary.treatmentCategory,
    treatmentStage: summary.treatmentStage,
    recoveryStage: summary.recoveryStage,
    riskLevel: summary.riskLevel,
    nextCareAction: summary.nextCareAction,
    tags: summary.tags,
  }).map((suggestion: TreatmentFollowUpSuggestion) => ({
    summaryId: summary.summaryId,
    sourceTreatmentSummaryId: suggestion.sourceTreatmentSummaryId,
    suggestionKey: suggestion.suggestionKey,
    ruleKey: suggestion.ruleKey,
  }));
}

export async function getFollowUpPathAnalysisForTenant(input: {
  tenantId: string;
  analysisAt: string;
} & FollowUpPathAnalysisReadRepositories): Promise<FollowUpPathAnalysisApiResponse> {
  const [treatmentSummaries, sourceTasks, auditEvents] = await Promise.all([
    input.treatmentSummaryRepository.listFollowUpPathAnalysisTreatmentSummariesByTenant(input.tenantId),
    input.tenantBusinessRepository.listFollowUpPathAnalysisSourceTasksByTenant(input.tenantId),
    input.auditRepository.listFollowUpPathAnalysisAuditEventsByTenant(input.tenantId),
  ]);
  const analysis = buildFollowUpPathAnalysis({
    analysisAt: input.analysisAt,
    treatmentSummaries: treatmentSummaries.map((summary) => ({
      summaryId: summary.summaryId,
      tenantId: summary.tenantId,
      status: summary.status,
      voidedAt: summary.voidedAt,
    })),
    suggestions: treatmentSummaries.flatMap(mapSuggestions),
    sourceTasks,
    auditEvents,
  });

  return {
    ...analysis,
    dataSourceNote: '基于当前租户治疗摘要、模板驱动建议、来源随访任务和审计事件只读聚合。',
    boundaryNote: '仅返回聚合指标，不返回客户明细、任务列表、治疗正文或 raw audit payload。',
  };
}
