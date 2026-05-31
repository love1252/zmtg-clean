import type { AuditEventListItem } from '@/modules/audit/domain/audit-event-query';

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

function getFetcher(options?: InstitutionAuditEventsClientOptions) {
  return options?.fetcher ?? globalThis.fetch;
}

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
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

function isValidPageInfo(input: unknown): input is InstitutionAuditEventsPageInfo {
  return (
    isJsonObject(input) &&
    typeof input.hasMore === 'boolean' &&
    typeof input.limit === 'number' &&
    (input.nextCursor === null || typeof input.nextCursor === 'string')
  );
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

    if (
      !isJsonObject(payload) ||
      !Array.isArray(payload.records) ||
      !isValidPageInfo(payload.pageInfo)
    ) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return {
      ok: true,
      records: payload.records as InstitutionAuditEventRecord[],
      pageInfo: payload.pageInfo,
    };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}
