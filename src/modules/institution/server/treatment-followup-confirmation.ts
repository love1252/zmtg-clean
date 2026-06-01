import type { TreatmentFollowUpSuggestion } from '@/modules/institution/domain/treatment-followup-suggestions';
import { buildTreatmentFollowUpSuggestions } from '@/modules/institution/domain/treatment-followup-suggestions';
import type { TenantFollowUpTaskFromTreatmentSummarySuggestion } from '@/modules/institution/domain/followup-workflow';
import type { TreatmentSummaryRecord } from '@/modules/institution/domain/treatment-summaries';
import { mapTreatmentSummaryRecordToListItem } from '@/modules/institution/domain/treatment-summaries';
import {
  mapTreatmentSummaryListItemToFollowUpSuggestionInput,
  type TreatmentFollowUpSuggestionSelection,
} from '@/modules/institution/server/treatment-followup-suggestions';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';
import type { createTreatmentSummaryRepository } from '@/modules/institution/server/treatment-summary-repository';

type TreatmentSummaryRepository = ReturnType<typeof createTreatmentSummaryRepository>;

export type TreatmentFollowUpTaskConfirmationDto = Omit<
  TenantFollowUpTaskFromTreatmentSummarySuggestion,
  'tenantId'
>;

export type TreatmentFollowUpSuggestionsForSummaryResult =
  | { kind: 'success'; summary: TreatmentSummaryRecord; suggestions: TreatmentFollowUpSuggestion[] }
  | { kind: 'not_found' };

export type ConfirmTreatmentFollowUpTaskResult =
  | { kind: 'created'; task: TreatmentFollowUpTaskConfirmationDto }
  | { kind: 'not_found' }
  | { kind: 'invalid_suggestion' }
  | { kind: 'conflict'; resourceId: string; reason: 'active_source_follow_up_exists' };

export function mapFollowUpTaskConfirmationToDto(
  task: TenantFollowUpTaskFromTreatmentSummarySuggestion,
): TreatmentFollowUpTaskConfirmationDto {
  return {
    id: task.id,
    customerId: task.customerId,
    customerDisplayName: task.customerDisplayName,
    journeyId: task.journeyId,
    stage: task.stage,
    status: task.status,
    dueAt: task.dueAt,
    suggestedAction: task.suggestedAction,
    riskLevel: task.riskLevel,
    updatedBy: task.updatedBy,
    updatedAt: task.updatedAt,
    sourceTreatmentSummaryId: task.sourceTreatmentSummaryId,
    sourceSuggestionKey: task.sourceSuggestionKey,
  };
}

function buildSuggestionsForTreatmentSummary(summary: TreatmentSummaryRecord) {
  return buildTreatmentFollowUpSuggestions(
    mapTreatmentSummaryListItemToFollowUpSuggestionInput(
      mapTreatmentSummaryRecordToListItem(summary),
    ),
  );
}

function createFollowUpJourneyId(suggestion: TreatmentFollowUpSuggestion) {
  return `treatment_followup_${suggestion.ruleKey}`.slice(0, 96);
}

export async function getTreatmentFollowUpSuggestionsForSummary(input: {
  tenantId: string;
  summaryId: string;
  treatmentSummaryRepository: Pick<TreatmentSummaryRepository, 'getTreatmentSummaryByTenant'>;
}): Promise<TreatmentFollowUpSuggestionsForSummaryResult> {
  const summary = await input.treatmentSummaryRepository.getTreatmentSummaryByTenant({
    tenantId: input.tenantId,
    id: input.summaryId,
  });

  if (!summary) {
    return { kind: 'not_found' };
  }

  return {
    kind: 'success',
    summary,
    suggestions: buildSuggestionsForTreatmentSummary(summary),
  };
}

export async function confirmTreatmentFollowUpTask(input: {
  tenantId: string;
  summaryId: string;
  selection: TreatmentFollowUpSuggestionSelection;
  treatmentSummaryRepository: Pick<TreatmentSummaryRepository, 'getTreatmentSummaryByTenant'>;
  tenantBusinessRepository: Pick<
    TenantBusinessRepository,
    'createFollowUpTaskFromTreatmentSummarySuggestion' | 'getCustomerByTenant'
  >;
}): Promise<ConfirmTreatmentFollowUpTaskResult> {
  const suggestionResult = await getTreatmentFollowUpSuggestionsForSummary({
    tenantId: input.tenantId,
    summaryId: input.summaryId,
    treatmentSummaryRepository: input.treatmentSummaryRepository,
  });

  if (suggestionResult.kind === 'not_found') {
    return { kind: 'not_found' };
  }

  const suggestion = suggestionResult.suggestions.find(
    (candidate) => candidate.suggestionKey === input.selection.suggestionKey,
  );

  if (!suggestion) {
    return { kind: 'invalid_suggestion' };
  }

  const customer = await input.tenantBusinessRepository.getCustomerByTenant({
    tenantId: input.tenantId,
    id: suggestionResult.summary.customerId,
  });

  if (!customer) {
    return { kind: 'not_found' };
  }

  const result =
    await input.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion({
      id: globalThis.crypto.randomUUID(),
      tenantId: input.tenantId,
      customerId: suggestionResult.summary.customerId,
      customerDisplayName: customer.displayName,
      journeyId: createFollowUpJourneyId(suggestion),
      stage: suggestion.title,
      status: 'scheduled',
      dueAt: suggestion.recommendedDueAt,
      suggestedAction: suggestion.description,
      riskLevel: suggestion.riskLevel,
      sourceTreatmentSummaryId: suggestion.sourceTreatmentSummaryId,
      sourceSuggestionKey: suggestion.suggestionKey,
    });

  if (result.kind === 'invalid_source') {
    return { kind: 'not_found' };
  }

  if (result.kind === 'conflict') {
    return {
      kind: 'conflict',
      resourceId: result.resourceId,
      reason: result.reason,
    };
  }

  return { kind: 'created', task: mapFollowUpTaskConfirmationToDto(result.task) };
}
