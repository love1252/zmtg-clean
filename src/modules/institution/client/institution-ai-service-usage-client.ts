export type InstitutionAiServiceUsagePreset = 'currentMonth' | 'last7days' | 'lastMonth';

export type InstitutionAiServiceUsageSummary = {
  totalUsageCount: number;
  succeededCount: number;
  failedCount: number;
  rejectedCount: number;
  successRate: number;
  aiServiceUnitsUsed: number;
};

export type InstitutionAiServiceUsageTrendPoint = {
  date: string;
  usageCount: number;
  aiServiceUnitsUsed: number;
};

export type InstitutionAiServiceUsageServiceProject = {
  serviceCategory: string;
  serviceName: string;
  usageCount: number;
  succeededCount: number;
  failedCount: number;
  rejectedCount: number;
  successRate: number;
  aiServiceUnitsUsed: number;
  sharePercent: number;
};

export type InstitutionAiServiceUsageResponse = {
  requestId: 'institution-ai-service-usage';
  readonly: true;
  period: {
    from: string;
    to: string;
    preset: string;
  };
  summary: InstitutionAiServiceUsageSummary;
  trend: InstitutionAiServiceUsageTrendPoint[];
  serviceProjects: InstitutionAiServiceUsageServiceProject[];
  quota: {
    isLinked: boolean;
  };
};

export type InstitutionAiServiceUsageClientError = {
  status: number;
  message: string;
};

export type InstitutionAiServiceUsageClientResult =
  | { ok: true; data: InstitutionAiServiceUsageResponse }
  | { ok: false; error: InstitutionAiServiceUsageClientError };

type Fetcher = typeof fetch;

const defaultSummary: InstitutionAiServiceUsageSummary = {
  totalUsageCount: 0,
  succeededCount: 0,
  failedCount: 0,
  rejectedCount: 0,
  successRate: 0,
  aiServiceUnitsUsed: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function safeString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function parseSummary(value: unknown): InstitutionAiServiceUsageSummary {
  if (!isRecord(value)) return defaultSummary;

  return {
    totalUsageCount: safeNumber(value.totalUsageCount),
    succeededCount: safeNumber(value.succeededCount),
    failedCount: safeNumber(value.failedCount),
    rejectedCount: safeNumber(value.rejectedCount),
    successRate: safeNumber(value.successRate),
    aiServiceUnitsUsed: safeNumber(value.aiServiceUnitsUsed),
  };
}

function parseTrend(value: unknown): InstitutionAiServiceUsageTrendPoint[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .map((item) => ({
      date: safeString(item.date, ''),
      usageCount: safeNumber(item.usageCount),
      aiServiceUnitsUsed: safeNumber(item.aiServiceUnitsUsed),
    }))
    .filter((item) => item.date.length > 0);
}

function parseServiceProjects(value: unknown): InstitutionAiServiceUsageServiceProject[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).map((item) => ({
    serviceCategory: safeString(item.serviceCategory, 'unknown'),
    serviceName: safeString(item.serviceName, '未归因服务'),
    usageCount: safeNumber(item.usageCount),
    succeededCount: safeNumber(item.succeededCount),
    failedCount: safeNumber(item.failedCount),
    rejectedCount: safeNumber(item.rejectedCount),
    successRate: safeNumber(item.successRate),
    aiServiceUnitsUsed: safeNumber(item.aiServiceUnitsUsed),
    sharePercent: safeNumber(item.sharePercent),
  }));
}

function parseResponse(payload: unknown): InstitutionAiServiceUsageResponse {
  const record = isRecord(payload) ? payload : {};
  const period = isRecord(record.period) ? record.period : {};
  const quota = isRecord(record.quota) ? record.quota : {};

  return {
    requestId: 'institution-ai-service-usage',
    readonly: true,
    period: {
      from: safeString(period.from, ''),
      to: safeString(period.to, ''),
      preset: safeString(period.preset, 'currentMonth'),
    },
    summary: parseSummary(record.summary),
    trend: parseTrend(record.trend),
    serviceProjects: parseServiceProjects(record.serviceProjects),
    quota: {
      isLinked: quota.isLinked === true,
    },
  };
}

export async function getInstitutionAiServiceUsage(options: {
  preset: InstitutionAiServiceUsagePreset;
  fetcher?: Fetcher;
}): Promise<InstitutionAiServiceUsageClientResult> {
  const fetcher = options.fetcher ?? fetch;
  const params = new URLSearchParams({ preset: options.preset });

  try {
    const response = await fetcher(`/api/institution/ai-service-usage?${params.toString()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        ok: false,
        error: {
          status: response.status,
          message: 'AI 服务使用数据暂时不可用',
        },
      };
    }

    return {
      ok: true,
      data: parseResponse(await response.json()),
    };
  } catch {
    return {
      ok: false,
      error: {
        status: 0,
        message: 'AI 服务使用数据暂时不可用',
      },
    };
  }
}
