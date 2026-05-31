import type { TenantManagementListItem } from '@/modules/open-platform/domain/tenant-management';

export type OpenPlatformTenantRecord = TenantManagementListItem;

export type OpenPlatformTenantClientErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'service_unavailable'
  | 'unknown';

export type OpenPlatformTenantClientError = {
  kind: OpenPlatformTenantClientErrorKind;
  message: string;
  status: number;
};

export type OpenPlatformTenantListResult =
  | { ok: true; records: OpenPlatformTenantRecord[] }
  | { ok: false; error: OpenPlatformTenantClientError };

type OpenPlatformTenantClientOptions = {
  fetcher?: typeof fetch;
};

function getFetcher(options?: OpenPlatformTenantClientOptions) {
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

function errorKindFromStatus(status: number): OpenPlatformTenantClientErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 503) return 'service_unavailable';
  return 'unknown';
}

function createClientError(input: {
  status: number;
  payload: unknown;
  fallbackMessage?: string;
}): OpenPlatformTenantClientError {
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

export async function listOpenPlatformTenants(
  options?: OpenPlatformTenantClientOptions,
): Promise<OpenPlatformTenantListResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher('/api/open-platform/tenants', { cache: 'no-store' });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: createClientError({ status: response.status, payload }),
      };
    }

    if (!isJsonObject(payload) || !Array.isArray(payload.records)) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '请求失败', status: response.status },
      };
    }

    return { ok: true, records: payload.records as OpenPlatformTenantRecord[] };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '请求失败', status: 0 },
    };
  }
}
