export type FollowUpTaskSourceFilter = 'treatment_summary';

export type FollowUpTaskListFilters = {
  source: FollowUpTaskSourceFilter | null;
  sourceTreatmentSummaryId: string | null;
};

export type ParseFollowUpTaskListQueryResult =
  | { ok: true; filters: FollowUpTaskListFilters }
  | { ok: false; error: string };

const FOLLOW_UP_TASK_QUERY_PARAM_KEYS = ['source', 'sourceTreatmentSummaryId'] as const;
const allowedParamKeys = new Set<string>(FOLLOW_UP_TASK_QUERY_PARAM_KEYS);
const idPattern = /^[A-Za-z0-9_:-]{1,96}$/u;

function rejectUnknownOrDuplicateParams(params: URLSearchParams) {
  for (const key of params.keys()) {
    if (!allowedParamKeys.has(key)) {
      return { ok: false as const, error: `不支持的筛选参数: ${key}` };
    }

    if (params.getAll(key).length > 1) {
      return { ok: false as const, error: `${key} 只能出现一次` };
    }
  }

  return { ok: true as const };
}

function parseSource(value: string | null) {
  if (value === null) {
    return { ok: true as const, value: null };
  }

  const normalized = value.trim();
  if (normalized !== 'treatment_summary') {
    return { ok: false as const, error: 'source 只能是 treatment_summary' };
  }

  return { ok: true as const, value: 'treatment_summary' as const };
}

function parseSourceTreatmentSummaryId(value: string | null) {
  if (value === null) {
    return { ok: true as const, value: null };
  }

  const normalized = value.trim();
  if (!idPattern.test(normalized)) {
    return { ok: false as const, error: 'sourceTreatmentSummaryId 格式不正确' };
  }

  return { ok: true as const, value: normalized };
}

export function parseFollowUpTaskListQuery(
  params: URLSearchParams,
): ParseFollowUpTaskListQueryResult {
  const unknownOrDuplicate = rejectUnknownOrDuplicateParams(params);
  if (!unknownOrDuplicate.ok) {
    return unknownOrDuplicate;
  }

  const source = parseSource(params.get('source'));
  if (!source.ok) {
    return source;
  }

  const sourceTreatmentSummaryId = parseSourceTreatmentSummaryId(
    params.get('sourceTreatmentSummaryId'),
  );
  if (!sourceTreatmentSummaryId.ok) {
    return sourceTreatmentSummaryId;
  }

  return {
    ok: true,
    filters: {
      source: source.value,
      sourceTreatmentSummaryId: sourceTreatmentSummaryId.value,
    },
  };
}
