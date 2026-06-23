import type {
  PlanCatalogDto,
  PlanCatalogVersionDto,
  PlanVersionDraftPayload,
} from '@/modules/open-platform/domain/plan-catalog';

export type OpenPlatformPlanCatalogClientErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'validation_error'
  | 'conflict'
  | 'not_found'
  | 'service_unavailable'
  | 'unknown';

export type OpenPlatformPlanCatalogClientError = {
  kind: OpenPlatformPlanCatalogClientErrorKind;
  message: string;
  status: number;
  errors?: string[];
};

export type OpenPlatformPlanCatalogResult =
  | { ok: true; catalog: PlanCatalogDto }
  | { ok: false; error: OpenPlatformPlanCatalogClientError };

export type OpenPlatformPlanCatalogMutationResult =
  | {
      ok: true;
      status: OpenPlatformPlanCatalogMutationStatus;
      version: PlanCatalogVersionDto;
    }
  | { ok: false; error: OpenPlatformPlanCatalogClientError };

export type OpenPlatformPlanCatalogMutationStatus =
  | 'draft_created'
  | 'draft_saved'
  | 'published'
  | 'retired';

export type OpenPlatformPlanCatalogClientOptions = {
  fetcher?: typeof fetch;
};

const controlledMutationStatuses = new Set<OpenPlatformPlanCatalogMutationStatus>([
  'draft_created',
  'draft_saved',
  'published',
  'retired',
]);

function getFetcher(options?: OpenPlatformPlanCatalogClientOptions) {
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

function errorKindFromStatus(status: number): OpenPlatformPlanCatalogClientErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 400) return 'validation_error';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 503) return 'service_unavailable';
  return 'unknown';
}

function createClientError(input: {
  status: number;
  payload: unknown;
  fallbackMessage?: string;
}): OpenPlatformPlanCatalogClientError {
  const errors =
    isJsonObject(input.payload) && Array.isArray(input.payload.errors)
      ? input.payload.errors.filter((error): error is string => typeof error === 'string')
      : undefined;
  const message =
    errors?.[0] ??
    (isJsonObject(input.payload) && typeof input.payload.errorCode === 'string'
      ? input.payload.errorCode
      : input.fallbackMessage ?? '套餐目录请求失败');

  return {
    kind: errorKindFromStatus(input.status),
    message,
    status: input.status,
    errors,
  };
}

async function mutationRequest(
  path: string,
  init: RequestInit,
  options?: OpenPlatformPlanCatalogClientOptions,
): Promise<OpenPlatformPlanCatalogMutationResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '套餐目录请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(path, init);
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: createClientError({ status: response.status, payload }),
      };
    }
    if (
      !isJsonObject(payload) ||
      typeof payload.status !== 'string' ||
      !controlledMutationStatuses.has(payload.status as OpenPlatformPlanCatalogMutationStatus) ||
      !payload.version
    ) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '套餐目录响应异常', status: response.status },
      };
    }

    return {
      ok: true,
      status: payload.status as OpenPlatformPlanCatalogMutationStatus,
      version: payload.version as PlanCatalogVersionDto,
    };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '套餐目录请求失败', status: 0 },
    };
  }
}

export async function loadOpenPlatformPlanCatalog(
  options?: OpenPlatformPlanCatalogClientOptions,
): Promise<OpenPlatformPlanCatalogResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: '套餐目录请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher('/api/v1/open-platform/plan-catalog', { cache: 'no-store' });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        error: createClientError({ status: response.status, payload }),
      };
    }
    if (!isJsonObject(payload) || !Array.isArray(payload.plans) || !isJsonObject(payload.summary)) {
      return {
        ok: false,
        error: { kind: 'unknown', message: '套餐目录响应异常', status: response.status },
      };
    }

    return { ok: true, catalog: payload as PlanCatalogDto };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: '套餐目录请求失败', status: 0 },
    };
  }
}

export function createOpenPlatformPlanVersionDraft(
  planId: string,
  input: { sourceVersionId?: string | null },
  options?: OpenPlatformPlanCatalogClientOptions,
) {
  return mutationRequest(
    `/api/v1/open-platform/plan-catalog/${planId}/versions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sourceVersionId: input.sourceVersionId ?? undefined }),
    },
    options,
  );
}

export function saveOpenPlatformPlanVersionDraft(
  versionId: string,
  payload: PlanVersionDraftPayload,
  options?: OpenPlatformPlanCatalogClientOptions,
) {
  return mutationRequest(
    `/api/v1/open-platform/plan-catalog/versions/${versionId}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    options,
  );
}

export function publishOpenPlatformPlanVersion(
  versionId: string,
  options?: OpenPlatformPlanCatalogClientOptions,
) {
  return mutationRequest(
    `/api/v1/open-platform/plan-catalog/versions/${versionId}/publish`,
    { method: 'POST' },
    options,
  );
}

export function retireOpenPlatformPlanVersion(
  versionId: string,
  options?: OpenPlatformPlanCatalogClientOptions,
) {
  return mutationRequest(
    `/api/v1/open-platform/plan-catalog/versions/${versionId}/retire`,
    { method: 'POST' },
    options,
  );
}
