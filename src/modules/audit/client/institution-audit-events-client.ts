import {
  AUDIT_REASON_VALUES,
  AUDIT_RESULT_VALUES,
  isInstitutionAuditCoverage,
  MAX_AUDIT_EVENT_QUERY_LIMIT,
  type AuditEventListItem,
  type InstitutionAuditCoverage,
} from '@/modules/audit/domain/audit-event-query';
import {
  ACCESS_ACTIONS,
  ACCESS_RESOURCES,
  ACCESS_ROLES,
} from '@/modules/security/domain/access-control';

export type InstitutionAuditEventRecord = Omit<AuditEventListItem, 'tenantId'>;

export type InstitutionAuditEventsPageInfo = {
  hasMore: boolean;
  limit: number;
  nextCursor: string | null;
};

export type InstitutionAuditEventsClientResult =
  | {
      ok: true;
      records: InstitutionAuditEventRecord[];
      pageInfo: InstitutionAuditEventsPageInfo;
      coverage: InstitutionAuditCoverage;
    }
  | { ok: false; error: InstitutionAuditEventsClientError };

export type InstitutionAuditEventsClientErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'validation_error'
  | 'service_unavailable'
  | 'unknown';

export type InstitutionAuditEventsClientError = {
  kind: InstitutionAuditEventsClientErrorKind;
  message: string;
  status: number;
};

export type InstitutionAuditEventsQuery = {
  from?: string;
  to?: string;
  resource?: string;
  resourceId?: string;
  action?: string;
  result?: string;
  reason?: string;
  actorId?: string;
  limit?: string | number;
  cursor?: string;
};

type InstitutionAuditEventsClientOptions = {
  fetcher?: typeof fetch;
};

const auditQueryKeys = [
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
] as const satisfies readonly (keyof InstitutionAuditEventsQuery)[];

const institutionAuditEventRecordKeys = Object.freeze([
  'id',
  'resource',
  'resourceId',
  'action',
  'result',
  'reason',
  'actorId',
  'actorRole',
  'occurredAt',
] as const);

const institutionAuditEventsPageInfoKeys = Object.freeze([
  'hasMore',
  'limit',
  'nextCursor',
] as const);

const institutionAuditEventsPayloadKeys = Object.freeze([
  'records',
  'pageInfo',
  'coverage',
] as const);

function getFetcher(options?: InstitutionAuditEventsClientOptions) {
  return options?.fetcher ?? globalThis.fetch;
}

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function hasExactOwnKeys(
  input: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const ownKeys = Reflect.ownKeys(input);
  return (
    ownKeys.length === expectedKeys.length &&
    ownKeys.every((key) =>
      typeof key === 'string' && expectedKeys.includes(key),
    )
  );
}

function isOneOf<const T extends readonly string[]>(
  values: T,
  input: unknown,
): input is T[number] {
  return typeof input === 'string' && values.some((value) => value === input);
}

function isBoundedIdentifier(input: unknown, maxLength: number): input is string {
  return typeof input === 'string' && input.length > 0 && input.length <= maxLength;
}

function isCanonicalInstant(input: unknown): input is string {
  if (typeof input !== 'string' || input.length !== 24) return false;
  const timestamp = Date.parse(input);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === input;
}

function parseInstitutionAuditEventRecord(
  input: unknown,
): InstitutionAuditEventRecord | null {
  if (
    !isJsonObject(input) ||
    !hasExactOwnKeys(input, institutionAuditEventRecordKeys) ||
    !isBoundedIdentifier(input.id, 96) ||
    !isOneOf(ACCESS_RESOURCES, input.resource) ||
    !(
      input.resourceId === null ||
      isBoundedIdentifier(input.resourceId, 96)
    ) ||
    !isOneOf(ACCESS_ACTIONS, input.action) ||
    !isOneOf(AUDIT_RESULT_VALUES, input.result) ||
    !isOneOf(AUDIT_REASON_VALUES, input.reason) ||
    !isBoundedIdentifier(input.actorId, 96) ||
    !isOneOf(ACCESS_ROLES, input.actorRole) ||
    !isCanonicalInstant(input.occurredAt)
  ) {
    return null;
  }

  return {
    id: input.id,
    resource: input.resource,
    resourceId: input.resourceId,
    action: input.action,
    result: input.result,
    reason: input.reason,
    actorId: input.actorId,
    actorRole: input.actorRole,
    occurredAt: input.occurredAt,
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorKindFromStatus(status: number): InstitutionAuditEventsClientErrorKind {
  if (status === 400) return 'validation_error';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 503) return 'service_unavailable';
  return 'unknown';
}

function createClientError(input: {
  status: number;
  payload: unknown;
  fallbackMessage?: string;
}): InstitutionAuditEventsClientError {
  const message =
    isJsonObject(input.payload) && typeof input.payload.error === 'string'
      ? input.payload.error
      : input.fallbackMessage ?? '请求失败';

  return {
    kind: errorKindFromStatus(input.status),
    message,
    status: input.status,
  };
}

function buildAuditEventsPath(query: InstitutionAuditEventsQuery) {
  const params = new URLSearchParams();

  for (const key of auditQueryKeys) {
    const value = query[key];
    if (value === undefined || value === null || String(value).trim().length === 0) {
      continue;
    }
    params.set(key, String(value).trim());
  }

  const queryString = params.toString();
  return queryString
    ? `/api/institution/audit-events?${queryString}`
    : '/api/institution/audit-events';
}

function parsePageInfo(input: unknown): InstitutionAuditEventsPageInfo | null {
  if (
    !isJsonObject(input) ||
    !hasExactOwnKeys(input, institutionAuditEventsPageInfoKeys) ||
    typeof input.hasMore !== 'boolean' ||
    typeof input.limit !== 'number' ||
    !Number.isSafeInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > MAX_AUDIT_EVENT_QUERY_LIMIT
  ) {
    return null;
  }

  const nextCursor = input.nextCursor;
  let parsedNextCursor: string | null;
  if (input.hasMore) {
    if (!isBoundedIdentifier(nextCursor, 512)) return null;
    parsedNextCursor = nextCursor;
  } else {
    if (nextCursor !== null) return null;
    parsedNextCursor = null;
  }

  return {
    hasMore: input.hasMore,
    limit: input.limit,
    nextCursor: parsedNextCursor,
  };
}

export async function listInstitutionAuditEvents(
  query: InstitutionAuditEventsQuery = {},
  options?: InstitutionAuditEventsClientOptions,
): Promise<InstitutionAuditEventsClientResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(buildAuditEventsPath(query), { cache: 'no-store' });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: createClientError({ status: response.status, payload }),
      };
    }

    if (!isJsonObject(payload) || !hasExactOwnKeys(payload, institutionAuditEventsPayloadKeys)) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    if (!Array.isArray(payload.records) || !isInstitutionAuditCoverage(payload.coverage)) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    const records: InstitutionAuditEventRecord[] = [];
    for (const candidate of payload.records) {
      const record = parseInstitutionAuditEventRecord(candidate);
      if (!record) {
        return {
          ok: false,
          error: { kind: 'unknown', message: '请求失败', status: response.status },
        };
      }
      records.push(record);
    }

    const pageInfo = parsePageInfo(payload.pageInfo);
    if (!pageInfo) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return {
      ok: true,
      records,
      pageInfo,
      coverage: payload.coverage,
    };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}
