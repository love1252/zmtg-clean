import type { TreatmentFollowUpSuggestionInput } from '@/modules/institution/domain/treatment-followup-suggestions';
import { containsDisallowedTreatmentFollowUpSuggestionContent } from '@/modules/institution/domain/treatment-followup-suggestions';
import type { FollowUpRiskLevel } from '@/modules/institution/domain/followup-workflow';
import type { InstitutionTreatmentSummaryListItem } from '@/modules/institution/domain/treatment-summaries';

export type TreatmentFollowUpSuggestionSelection = {
  suggestionKey: string;
};

export type ParseTreatmentFollowUpSuggestionSelectionResult =
  | { ok: true; value: TreatmentFollowUpSuggestionSelection }
  | { ok: false; error: string };

type TreatmentSummarySuggestionSource = Pick<
  InstitutionTreatmentSummaryListItem,
  | 'id'
  | 'customerId'
  | 'appointmentId'
  | 'treatmentDate'
  | 'treatmentProject'
  | 'treatmentCategory'
  | 'treatmentStage'
  | 'recoveryStage'
  | 'riskLevel'
  | 'nextCareAction'
  | 'tags'
> &
  Record<string, unknown>;

const allowedSelectionKeys = new Set(['suggestionKey']);
const suggestionKeyPattern = /^[A-Za-z0-9:_-]{1,180}$/u;
const riskLevels = new Set<string>(['normal', 'watch', 'urgent']);

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function normalizeString(input: unknown) {
  return typeof input === 'string' ? input.trim() : '';
}

function normalizeRiskLevel(input: unknown): FollowUpRiskLevel {
  const value = normalizeString(input);
  return riskLevels.has(value) ? (value as FollowUpRiskLevel) : 'normal';
}

export function mapTreatmentSummaryListItemToFollowUpSuggestionInput(
  record: TreatmentSummarySuggestionSource,
): TreatmentFollowUpSuggestionInput {
  return {
    id: normalizeString(record.id),
    customerId: normalizeString(record.customerId),
    appointmentId: record.appointmentId == null ? null : normalizeString(record.appointmentId),
    treatmentDate: normalizeString(record.treatmentDate),
    treatmentProject: normalizeString(record.treatmentProject),
    treatmentCategory: normalizeString(record.treatmentCategory),
    treatmentStage: normalizeString(record.treatmentStage),
    recoveryStage: normalizeString(record.recoveryStage),
    riskLevel: normalizeRiskLevel(record.riskLevel),
    nextCareAction: normalizeString(record.nextCareAction),
    tags: Array.isArray(record.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim())
      : [],
  };
}

export function parseTreatmentFollowUpSuggestionSelection(
  input: unknown,
): ParseTreatmentFollowUpSuggestionSelectionResult {
  if (!isPlainObject(input)) {
    return { ok: false, error: '请求体必须是 JSON object' };
  }

  for (const key of Object.keys(input)) {
    if (!allowedSelectionKeys.has(key)) {
      return { ok: false, error: `请求包含不允许的字段: ${key}` };
    }
  }

  const suggestionKey = normalizeString(input.suggestionKey);
  if (!suggestionKey) {
    return { ok: false, error: '字段 suggestionKey 必须是非空字符串' };
  }

  if (
    !suggestionKeyPattern.test(suggestionKey) ||
    containsDisallowedTreatmentFollowUpSuggestionContent(suggestionKey)
  ) {
    return { ok: false, error: '字段 suggestionKey 格式不正确' };
  }

  return {
    ok: true,
    value: {
      suggestionKey,
    },
  };
}
