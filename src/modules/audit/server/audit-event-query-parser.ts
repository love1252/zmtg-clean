import {
  ACCESS_ACTIONS,
  ACCESS_RESOURCES,
  type ProtectedAction,
  type ProtectedResource,
} from '@/modules/security/domain/access-control';
import {
  AUDIT_EVENT_QUERY_PARAM_KEYS,
  AUDIT_REASON_VALUES,
  AUDIT_RESULT_VALUES,
  DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
  MAX_AUDIT_EVENT_QUERY_LIMIT,
  decodeAuditEventQueryCursor,
  type AuditEventQuery,
  type AuditEventQueryFilters,
  type ParseAuditEventQueryResult,
} from '@/modules/audit/domain/audit-event-query';
import type { AuditReason, AuditResult } from '@/modules/audit/domain/audit-events';

const idPattern = /^[A-Za-z0-9_:-]{1,96}$/u;

function isAllowedParamKey(key: string) {
  return (AUDIT_EVENT_QUERY_PARAM_KEYS as readonly string[]).includes(key);
}

function parseDateParam(name: 'from' | 'to', value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return { ok: false as const, error: `${name} 必须是有效时间` };
  }

  return { ok: true as const, value: new Date(timestamp).toISOString() };
}

function parseEnumParam<T extends string>(
  name: string,
  value: string,
  allowedValues: readonly T[],
) {
  if (!allowedValues.includes(value as T)) {
    return { ok: false as const, error: `${name} 不在允许范围内` };
  }

  return { ok: true as const, value: value as T };
}

function parseIdParam(name: 'resourceId' | 'actorId', value: string) {
  if (!idPattern.test(value)) {
    return { ok: false as const, error: `${name} 格式不正确` };
  }

  return { ok: true as const, value };
}

function parseLimit(value: string | null) {
  if (!value) {
    return { ok: true as const, value: DEFAULT_AUDIT_EVENT_QUERY_LIMIT };
  }

  if (!/^\d+$/u.test(value)) {
    return { ok: false as const, error: 'limit 必须是整数' };
  }

  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_AUDIT_EVENT_QUERY_LIMIT
  ) {
    return {
      ok: false as const,
      error: `limit 必须在 1 到 ${MAX_AUDIT_EVENT_QUERY_LIMIT} 之间`,
    };
  }

  return { ok: true as const, value: parsed };
}

function rejectUnknownOrDuplicateParams(params: URLSearchParams) {
  for (const key of params.keys()) {
    if (!isAllowedParamKey(key)) {
      return { ok: false as const, error: `不支持的筛选参数: ${key}` };
    }

    if (params.getAll(key).length > 1) {
      return { ok: false as const, error: `${key} 只能出现一次` };
    }
  }

  return { ok: true as const };
}

export function parseAuditEventQueryParams(
  params: URLSearchParams,
): ParseAuditEventQueryResult {
  const paramValidation = rejectUnknownOrDuplicateParams(params);
  if (!paramValidation.ok) return paramValidation;

  const filters: AuditEventQueryFilters = {};
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

  const resource = params.get('resource');
  if (resource) {
    const parsed = parseEnumParam<ProtectedResource>('resource', resource, ACCESS_RESOURCES);
    if (!parsed.ok) return parsed;
    filters.resource = parsed.value;
  }

  const resourceId = params.get('resourceId');
  if (resourceId) {
    const parsed = parseIdParam('resourceId', resourceId);
    if (!parsed.ok) return parsed;
    filters.resourceId = parsed.value;
  }

  const action = params.get('action');
  if (action) {
    const parsed = parseEnumParam<ProtectedAction>('action', action, ACCESS_ACTIONS);
    if (!parsed.ok) return parsed;
    filters.action = parsed.value;
  }

  const result = params.get('result');
  if (result) {
    const parsed = parseEnumParam<AuditResult>('result', result, AUDIT_RESULT_VALUES);
    if (!parsed.ok) return parsed;
    filters.result = parsed.value;
  }

  const reason = params.get('reason');
  if (reason) {
    const parsed = parseEnumParam<AuditReason>('reason', reason, AUDIT_REASON_VALUES);
    if (!parsed.ok) return parsed;
    filters.reason = parsed.value;
  }

  const actorId = params.get('actorId');
  if (actorId) {
    const parsed = parseIdParam('actorId', actorId);
    if (!parsed.ok) return parsed;
    filters.actorId = parsed.value;
  }

  const limit = parseLimit(params.get('limit'));
  if (!limit.ok) return limit;

  const cursorValue = params.get('cursor');
  const query: AuditEventQuery = {
    filters,
    limit: limit.value,
  };
  if (cursorValue) {
    const decoded = decodeAuditEventQueryCursor(cursorValue);
    if (!decoded.ok) {
      return { ok: false, error: decoded.error };
    }
    query.cursor = decoded.cursor;
  }

  return { ok: true, query };
}
