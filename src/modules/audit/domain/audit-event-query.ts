import type { AuditReason, AuditResult } from '@/modules/audit/domain/audit-events';
import type {
  AccessContext,
  AccessRole,
  ProtectedAction,
  ProtectedResource,
} from '@/modules/security/domain/access-control';

export const DEFAULT_AUDIT_EVENT_QUERY_LIMIT = 50;
export const MAX_AUDIT_EVENT_QUERY_LIMIT = 100;

export const AUDIT_EVENT_QUERY_PARAM_KEYS = [
  'from',
  'to',
  'resource',
  'resourceId',
  'action',
  'result',
  'reason',
  'actorId',
  'limit',
  'cursor',
] as const;

export const AUDIT_RESULT_VALUES = ['allowed', 'denied', 'transitioned'] as const satisfies readonly AuditResult[];

export const AUDIT_REASON_VALUES = [
  'allowed_by_policy',
  'missing_tenant',
  'cross_tenant_denied',
  'role_denied',
  'sensitive_detail_denied',
  'invalid_transition',
  'stale_transition',
  'not_found_or_not_owned',
  'invalid_treatment_summary_reference',
  'quota_exceeded_customers',
  'quota_exceeded_appointments',
  'missing_active_plan',
  'missing_quota_limit',
] as const satisfies readonly AuditReason[];

export type AuditEventQueryFilters = {
  from?: string;
  to?: string;
  resource?: ProtectedResource;
  resourceId?: string;
  action?: ProtectedAction;
  result?: AuditResult;
  reason?: AuditReason;
  actorId?: string;
};

export type AuditEventQueryCursor = {
  occurredAt: string;
  eventId: string;
};

export type AuditEventQuery = {
  filters: AuditEventQueryFilters;
  limit: number;
  cursor?: AuditEventQueryCursor;
};

export type AuditEventQueryScope =
  | { kind: 'institution'; tenantId: string }
  | { kind: 'platform'; tenantId?: string | null };

export type AuditEventListItem = {
  id: string;
  tenantId: string | null;
  resource: ProtectedResource;
  resourceId: string | null;
  action: ProtectedAction;
  result: AuditResult;
  reason: AuditReason;
  actorId: string;
  actorRole: AccessRole;
  occurredAt: string;
};

export type AuditEventQueryResult = {
  records: AuditEventListItem[];
  pageInfo: {
    hasMore: boolean;
    limit: number;
    nextCursor: string | null;
  };
};

export type ParseAuditEventQueryResult =
  | { ok: true; query: AuditEventQuery }
  | { ok: false; error: string };

export type DecodeAuditEventQueryCursorResult =
  | { ok: true; cursor: AuditEventQueryCursor }
  | { ok: false; error: string };

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function encodeBase64Url(value: string) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function decodeBase64Url(value: string) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64url').toString('utf8');
  }

  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

export function encodeAuditEventQueryCursor(cursor: AuditEventQueryCursor) {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeAuditEventQueryCursor(
  value: string,
): DecodeAuditEventQueryCursorResult {
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(value));
    if (
      !isJsonObject(parsed) ||
      typeof parsed.occurredAt !== 'string' ||
      typeof parsed.eventId !== 'string' ||
      !Number.isFinite(Date.parse(parsed.occurredAt)) ||
      parsed.eventId.trim().length === 0
    ) {
      return { ok: false, error: 'cursor 格式不正确' };
    }

    return {
      ok: true,
      cursor: {
        occurredAt: new Date(parsed.occurredAt).toISOString(),
        eventId: parsed.eventId,
      },
    };
  } catch {
    return { ok: false, error: 'cursor 格式不正确' };
  }
}

export function createAuditEventQueryCursor(input: { id: string; occurredAt: string }) {
  return encodeAuditEventQueryCursor({
    eventId: input.id,
    occurredAt: input.occurredAt,
  });
}
