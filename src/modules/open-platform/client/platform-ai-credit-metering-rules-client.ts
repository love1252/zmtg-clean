export type PlatformAiCreditMeteringRuleDto = {
  id: string;
  provider: string;
  model: string;
  meteringVersion: string;
  inputTokenWeight: number;
  outputTokenWeight: number;
  modelMultiplier: number;
  ragCreditSurcharge: number;
  creditsPerStandardTokenUnit: number;
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpenPlatformAiCreditMeteringRulesClientErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'validation_error'
  | 'conflict'
  | 'not_found'
  | 'service_unavailable'
  | 'unknown';

export type OpenPlatformAiCreditMeteringRulesClientError = {
  kind: OpenPlatformAiCreditMeteringRulesClientErrorKind;
  message: string;
  status: number;
  errors?: string[];
};

export type OpenPlatformAiCreditMeteringRulesClientOptions = {
  fetcher?: typeof fetch;
};

export type OpenPlatformAiCreditMeteringRulesListFilters = {
  provider?: string | null;
  model?: string | null;
  enabled?: boolean | null;
};

export type CreateOpenPlatformAiCreditMeteringRulePayload = {
  provider: string;
  model: string;
  meteringVersion: string;
  inputTokenWeight: number;
  outputTokenWeight: number;
  modelMultiplier: number;
  ragCreditSurcharge: number;
  creditsPerStandardTokenUnit: number;
  enabled: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type PatchOpenPlatformAiCreditMeteringRulePayload = {
  enabled?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};

export type OpenPlatformAiCreditMeteringRulesListResult =
  | { ok: true; records: PlatformAiCreditMeteringRuleDto[] }
  | { ok: false; error: OpenPlatformAiCreditMeteringRulesClientError };

export type OpenPlatformAiCreditMeteringRuleMutationResult =
  | { ok: true; record: PlatformAiCreditMeteringRuleDto }
  | { ok: false; error: OpenPlatformAiCreditMeteringRulesClientError };

function getFetcher(options?: OpenPlatformAiCreditMeteringRulesClientOptions) {
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

function errorKindFromStatus(status: number): OpenPlatformAiCreditMeteringRulesClientErrorKind {
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
}): OpenPlatformAiCreditMeteringRulesClientError {
  const errors =
    isJsonObject(input.payload) && Array.isArray(input.payload.errors)
      ? input.payload.errors.filter((error): error is string => typeof error === 'string')
      : undefined;
  const message =
    errors?.[0] ??
    (isJsonObject(input.payload) && typeof input.payload.errorCode === 'string'
      ? input.payload.errorCode
      : input.fallbackMessage ?? 'AI Credits 计量规则请求失败');

  return {
    kind: errorKindFromStatus(input.status),
    message,
    status: input.status,
    errors,
  };
}

function buildListPath(filters?: OpenPlatformAiCreditMeteringRulesListFilters) {
  const params = new URLSearchParams();
  if (filters?.provider?.trim()) params.set('provider', filters.provider.trim());
  if (filters?.model?.trim()) params.set('model', filters.model.trim());
  if (typeof filters?.enabled === 'boolean') params.set('enabled', String(filters.enabled));
  const query = params.toString();
  return `/api/open-platform/ai-credit-metering-rules${query ? `?${query}` : ''}`;
}

export async function listOpenPlatformAiCreditMeteringRules(
  filters?: OpenPlatformAiCreditMeteringRulesListFilters,
  options?: OpenPlatformAiCreditMeteringRulesClientOptions,
): Promise<OpenPlatformAiCreditMeteringRulesListResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: 'AI Credits 计量规则请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(buildListPath(filters), { cache: 'no-store' });
    const payload = await readJson(response);
    if (!response.ok) {
      return { ok: false, error: createClientError({ status: response.status, payload }) };
    }
    if (!isJsonObject(payload) || !Array.isArray(payload.records)) {
      return {
        ok: false,
        error: { kind: 'unknown', message: 'AI Credits 计量规则响应异常', status: response.status },
      };
    }

    return { ok: true, records: payload.records as PlatformAiCreditMeteringRuleDto[] };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: 'AI Credits 计量规则请求失败', status: 0 },
    };
  }
}

async function mutationRequest(
  path: string,
  init: RequestInit,
  options?: OpenPlatformAiCreditMeteringRulesClientOptions,
): Promise<OpenPlatformAiCreditMeteringRuleMutationResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: 'AI Credits 计量规则请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(path, init);
    const payload = await readJson(response);
    if (!response.ok) {
      return { ok: false, error: createClientError({ status: response.status, payload }) };
    }
    if (!isJsonObject(payload) || !payload.record) {
      return {
        ok: false,
        error: { kind: 'unknown', message: 'AI Credits 计量规则响应异常', status: response.status },
      };
    }

    return { ok: true, record: payload.record as PlatformAiCreditMeteringRuleDto };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: 'AI Credits 计量规则请求失败', status: 0 },
    };
  }
}

export function createOpenPlatformAiCreditMeteringRule(
  payload: CreateOpenPlatformAiCreditMeteringRulePayload,
  options?: OpenPlatformAiCreditMeteringRulesClientOptions,
) {
  return mutationRequest(
    '/api/open-platform/ai-credit-metering-rules',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    options,
  );
}

export function patchOpenPlatformAiCreditMeteringRule(
  id: string,
  payload: PatchOpenPlatformAiCreditMeteringRulePayload,
  options?: OpenPlatformAiCreditMeteringRulesClientOptions,
) {
  return mutationRequest(
    `/api/open-platform/ai-credit-metering-rules/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    },
    options,
  );
}
