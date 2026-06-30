export type PlatformAiUsageCreditsSummaryDto = {
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  meteredCalls: number;
  pendingCalls: number;
  notBillableCalls: number;
  totalAiCreditsConsumed: number;
};

export type PlatformAiUsageCreditsByModelDto = {
  provider: string;
  model: string;
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  meteredCalls: number;
  totalTokens: number;
  totalAiCreditsConsumed: number;
};

export type PlatformAiUsageCreditsByTenantDto = {
  tenantId: string;
  tenantName: string | null;
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  meteredCalls: number;
  pendingCalls: number;
  notBillableCalls: number;
  totalTokens: number;
  totalAiCreditsConsumed: number;
};

export type PlatformAiUsageCreditsByMeteringStatusDto = {
  meteringStatus: string;
  calls: number;
  totalAiCreditsConsumed: number;
};

export type PlatformAiUsageCreditsByDateDto = {
  date: string;
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  totalAiCreditsConsumed: number;
};

export type PlatformAiUsageCreditsByDateProviderDto = {
  date: string;
  provider: string;
  providerDisplayName: string | null;
  totalCalls: number;
  totalTokens: number;
  totalAiCreditsConsumed: number;
};

export type PlatformAiUsageCreditsAggregationsDto = {
  byModel: PlatformAiUsageCreditsByModelDto[];
  byTenant: PlatformAiUsageCreditsByTenantDto[];
  byMeteringStatus: PlatformAiUsageCreditsByMeteringStatusDto[];
  byDate: PlatformAiUsageCreditsByDateDto[];
  byDateProvider: PlatformAiUsageCreditsByDateProviderDto[];
};

export type PlatformAiUsageCreditDetailDto = {
  id: string;
  tenantId: string;
  tenantName: string | null;
  status: string;
  errorCode: string | null;
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  aiCreditsConsumed: number | null;
  meteringStatus: string | null;
  meteringVersion: string | null;
  createdAt: string;
  knowledgeContextUsed: boolean;
  sourceCount: number;
};

export type OpenPlatformAiUsageCreditsFilters = {
  tenantId?: string | null;
  status?: string | null;
  meteringStatus?: string | null;
  provider?: string | null;
  model?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number | string | null;
};

export type PlatformAiUsageCreditsFilterProviderOptionDto = {
  provider: string;
  displayName: string | null;
  logoUrl: string | null;
  logoText: string | null;
  logoClassName: string | null;
  source: 'configured' | 'system' | 'history';
};

export type PlatformAiUsageCreditsFilterModelOptionDto = {
  provider: string;
  model: string;
  displayName: string | null;
  providerDisplayName: string | null;
  logoUrl: string | null;
  logoText: string | null;
  logoClassName: string | null;
  source: 'configured' | 'system' | 'history';
};

export type PlatformAiUsageCreditsFilterTenantOptionDto = {
  tenantId: string;
  tenantName: string | null;
};

export type PlatformAiUsageCreditsFilterOptionsDto = {
  providers: PlatformAiUsageCreditsFilterProviderOptionDto[];
  models: PlatformAiUsageCreditsFilterModelOptionDto[];
  tenants: PlatformAiUsageCreditsFilterTenantOptionDto[];
  statuses: string[];
  meteringStatuses: string[];
};

export type OpenPlatformAiUsageCreditsResponse = {
  requestId: 'platform-ai-usage-credits';
  readonly: true;
  dataSource: 'repository';
  summary: PlatformAiUsageCreditsSummaryDto;
  aggregations: PlatformAiUsageCreditsAggregationsDto;
  filterOptions: PlatformAiUsageCreditsFilterOptionsDto;
  records: PlatformAiUsageCreditDetailDto[];
  emptyState: {
    title: string;
    description: string;
  };
};

export type OpenPlatformAiUsageCreditsClientErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'validation_error'
  | 'service_unavailable'
  | 'unknown';

export type OpenPlatformAiUsageCreditsClientError = {
  kind: OpenPlatformAiUsageCreditsClientErrorKind;
  message: string;
  status: number;
  errors?: string[];
};

export type OpenPlatformAiUsageCreditsClientOptions = {
  fetcher?: typeof fetch;
};

export type OpenPlatformAiUsageCreditsResult =
  | { ok: true; data: OpenPlatformAiUsageCreditsResponse }
  | { ok: false; error: OpenPlatformAiUsageCreditsClientError };

function getFetcher(options?: OpenPlatformAiUsageCreditsClientOptions) {
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

function errorKindFromStatus(status: number): OpenPlatformAiUsageCreditsClientErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 400) return 'validation_error';
  if (status === 503) return 'service_unavailable';
  return 'unknown';
}

function createClientError(input: {
  status: number;
  payload: unknown;
  fallbackMessage?: string;
}): OpenPlatformAiUsageCreditsClientError {
  const errors =
    isJsonObject(input.payload) && Array.isArray(input.payload.errors)
      ? input.payload.errors.filter((error): error is string => typeof error === 'string')
      : undefined;
  const message =
    errors?.[0] ??
    (isJsonObject(input.payload) && typeof input.payload.errorCode === 'string'
      ? input.payload.errorCode
      : input.fallbackMessage ?? 'AI 用量与积分明细请求失败');

  return {
    kind: errorKindFromStatus(input.status),
    message,
    status: input.status,
    errors,
  };
}

function buildListPath(filters?: OpenPlatformAiUsageCreditsFilters) {
  const params = new URLSearchParams();
  if (filters?.tenantId?.trim()) params.set('tenantId', filters.tenantId.trim());
  if (filters?.status?.trim()) params.set('status', filters.status.trim());
  if (filters?.meteringStatus?.trim()) params.set('meteringStatus', filters.meteringStatus.trim());
  if (filters?.provider?.trim()) params.set('provider', filters.provider.trim());
  if (filters?.model?.trim()) params.set('model', filters.model.trim());
  if (filters?.dateFrom?.trim()) params.set('dateFrom', filters.dateFrom.trim());
  if (filters?.dateTo?.trim()) params.set('dateTo', filters.dateTo.trim());
  if (filters?.limit !== undefined && filters.limit !== null && String(filters.limit).trim()) {
    params.set('limit', String(filters.limit).trim());
  }
  const query = params.toString();
  return `/api/open-platform/ai-usage-credits${query ? `?${query}` : ''}`;
}

export async function listOpenPlatformAiUsageCredits(
  filters?: OpenPlatformAiUsageCreditsFilters,
  options?: OpenPlatformAiUsageCreditsClientOptions,
): Promise<OpenPlatformAiUsageCreditsResult> {
  const fetcher = getFetcher(options);
  if (!fetcher) {
    return {
      ok: false,
      error: { kind: 'unknown', message: 'AI 用量与积分明细请求失败', status: 0 },
    };
  }

  try {
    const response = await fetcher(buildListPath(filters), { cache: 'no-store' });
    const payload = await readJson(response);
    if (!response.ok) {
      return { ok: false, error: createClientError({ status: response.status, payload }) };
    }
    if (
      !isJsonObject(payload) ||
      payload.requestId !== 'platform-ai-usage-credits' ||
      !isJsonObject(payload.summary) ||
      !isJsonObject(payload.aggregations) ||
      !isJsonObject(payload.filterOptions) ||
      !Array.isArray(payload.filterOptions.providers) ||
      !Array.isArray(payload.filterOptions.models) ||
      !Array.isArray(payload.filterOptions.tenants) ||
      !Array.isArray(payload.filterOptions.statuses) ||
      !Array.isArray(payload.filterOptions.meteringStatuses) ||
      !Array.isArray(payload.records)
    ) {
      return {
        ok: false,
        error: { kind: 'unknown', message: 'AI 用量与积分明细响应异常', status: response.status },
      };
    }

    return { ok: true, data: payload as OpenPlatformAiUsageCreditsResponse };
  } catch {
    return {
      ok: false,
      error: { kind: 'unknown', message: 'AI 用量与积分明细请求失败', status: 0 },
    };
  }
}
