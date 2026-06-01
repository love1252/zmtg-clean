import type { FollowUpRiskLevel } from '@/modules/institution/domain/followup-workflow';
import type {
  TreatmentSummaryListCursor,
  TreatmentSummaryListFilters,
  TreatmentSummaryListQuery,
} from '@/modules/institution/domain/treatment-summaries';

export const DEFAULT_TREATMENT_SUMMARY_QUERY_LIMIT = 50;
export const MAX_TREATMENT_SUMMARY_QUERY_LIMIT = 100;

const TREATMENT_SUMMARY_QUERY_PARAM_KEYS = [
  'customerId',
  'treatmentProject',
  'riskLevel',
  'from',
  'to',
  'limit',
  'cursor',
] as const;

const treatmentSummaryRiskLevels = [
  'normal',
  'watch',
  'urgent',
] as const satisfies readonly FollowUpRiskLevel[];

const allowedParamKeys = new Set<string>(TREATMENT_SUMMARY_QUERY_PARAM_KEYS);
const idPattern = /^[A-Za-z0-9_:-]{1,96}$/u;

export type ParseTreatmentSummaryQueryResult =
  | { ok: true; query: TreatmentSummaryListQuery }
  | { ok: false; error: string };

export type DecodeTreatmentSummaryCursorResult =
  | { ok: true; cursor: TreatmentSummaryListCursor }
  | { ok: false; error: string };

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function encodeBase64Url(value: string) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  return btoa(value).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

function decodeBase64Url(value: string) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64url').toString('utf8');
  }

  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  return atob(padded.replace(/-/gu, '+').replace(/_/gu, '/'));
}

function containsDisallowedTreatmentSummaryQueryContent(input: string) {
  return (
    /完整治疗记录正文|完整病历正文|诊疗原文|咨询对话全文/u.test(input) ||
    /DATABASE_URL|database_url|postgres:\/\/|mysql:\/\/|mongodb:\/\/|redis:\/\//iu.test(input) ||
    /\b(?:sql|stack|token|secret)\b/iu.test(input) ||
    /sk_(?:live|test|proj)_|zmtg_sk_/iu.test(input)
  );
}

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

function parseDateParam(name: 'from' | 'to', value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return { ok: false as const, error: `${name} 必须是有效时间` };
  }

  return { ok: true as const, value: new Date(timestamp).toISOString() };
}

function parseLimit(value: string | null) {
  if (!value) {
    return { ok: true as const, value: DEFAULT_TREATMENT_SUMMARY_QUERY_LIMIT };
  }

  if (!/^\d+$/u.test(value)) {
    return { ok: false as const, error: 'limit 必须是整数' };
  }

  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_TREATMENT_SUMMARY_QUERY_LIMIT
  ) {
    return {
      ok: false as const,
      error: `limit 必须在 1 到 ${MAX_TREATMENT_SUMMARY_QUERY_LIMIT} 之间`,
    };
  }

  return { ok: true as const, value: parsed };
}

function parseCustomerId(value: string) {
  const normalized = value.trim();
  if (!idPattern.test(normalized)) {
    return { ok: false as const, error: 'customerId 格式不正确' };
  }

  return { ok: true as const, value: normalized };
}

function parseTreatmentProject(value: string) {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 160) {
    return { ok: false as const, error: 'treatmentProject 长度必须在 1 到 160 之间' };
  }

  if (containsDisallowedTreatmentSummaryQueryContent(normalized)) {
    return { ok: false as const, error: 'treatmentProject 不允许包含敏感信息' };
  }

  return { ok: true as const, value: normalized };
}

function parseRiskLevel(value: string) {
  if (!treatmentSummaryRiskLevels.includes(value as FollowUpRiskLevel)) {
    return { ok: false as const, error: 'riskLevel 不在允许范围内' };
  }

  return { ok: true as const, value: value as FollowUpRiskLevel };
}

export function encodeTreatmentSummaryCursor(cursor: TreatmentSummaryListCursor) {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeTreatmentSummaryCursor(
  value: string,
): DecodeTreatmentSummaryCursorResult {
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(value));
    if (
      !isJsonObject(parsed) ||
      typeof parsed.treatmentDate !== 'string' ||
      typeof parsed.id !== 'string' ||
      !Number.isFinite(Date.parse(parsed.treatmentDate)) ||
      parsed.id.trim().length === 0
    ) {
      return { ok: false, error: 'cursor 格式不正确' };
    }

    return {
      ok: true,
      cursor: {
        treatmentDate: new Date(parsed.treatmentDate).toISOString(),
        id: parsed.id,
      },
    };
  } catch {
    return { ok: false, error: 'cursor 格式不正确' };
  }
}

export function createTreatmentSummaryCursor(input: { id: string; treatmentDate: string }) {
  return encodeTreatmentSummaryCursor({
    id: input.id,
    treatmentDate: input.treatmentDate,
  });
}

export function parseTreatmentSummaryQueryParams(
  params: URLSearchParams,
): ParseTreatmentSummaryQueryResult {
  const paramValidation = rejectUnknownOrDuplicateParams(params);
  if (!paramValidation.ok) return paramValidation;

  const filters: TreatmentSummaryListFilters = {};
  const customerId = params.get('customerId');
  if (customerId) {
    const parsed = parseCustomerId(customerId);
    if (!parsed.ok) return parsed;
    filters.customerId = parsed.value;
  }

  const treatmentProject = params.get('treatmentProject');
  if (treatmentProject) {
    const parsed = parseTreatmentProject(treatmentProject);
    if (!parsed.ok) return parsed;
    filters.treatmentProject = parsed.value;
  }

  const riskLevel = params.get('riskLevel');
  if (riskLevel) {
    const parsed = parseRiskLevel(riskLevel);
    if (!parsed.ok) return parsed;
    filters.riskLevel = parsed.value;
  }

  const from = params.get('from');
  if (from) {
    const parsed = parseDateParam('from', from);
    if (!parsed.ok) return parsed;
    filters.from = parsed.value;
  }

  const to = params.get('to');
  if (to) {
    const parsed = parseDateParam('to', to);
    if (!parsed.ok) return parsed;
    filters.to = parsed.value;
  }

  if (filters.from && filters.to && Date.parse(filters.from) > Date.parse(filters.to)) {
    return { ok: false, error: 'from 不能晚于 to' };
  }

  const limit = parseLimit(params.get('limit'));
  if (!limit.ok) return limit;

  const query: TreatmentSummaryListQuery = {
    filters,
    limit: limit.value,
  };
  const cursorValue = params.get('cursor');
  if (cursorValue) {
    const decoded = decodeTreatmentSummaryCursor(cursorValue);
    if (!decoded.ok) return { ok: false, error: decoded.error };
    query.cursor = decoded.cursor;
  }

  return { ok: true, query };
}
