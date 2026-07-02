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
  used: number;
  remaining: number | null;
  usageRate: number | null;
};

export type InstitutionAiServiceUsageQuota =
  | { isLinked: false }
  | {
      isLinked: true;
      status: string;
      periodStart: string | null;
      periodEnd: string | null;
      totalAllowance: number | null;
      used: number;
      remaining: number | null;
      usageRate: number | null;
      warningLevel: string;
      displayUnit: 'AI 服务额度';
      notes: string[];
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
  quota: InstitutionAiServiceUsageQuota;
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

function safeNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function safeNullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function safeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
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
    used: safeNumber(item.used),
    remaining: safeNullableNumber(item.remaining),
    usageRate: safeNullableNumber(item.usageRate),
  }));
}

function parseQuota(value: unknown): InstitutionAiServiceUsageQuota {
  if (!isRecord(value) || value.isLinked !== true) return { isLinked: false };

  return {
    isLinked: true,
    status: safeString(value.status, 'active'),
    periodStart: safeNullableString(value.periodStart),
    periodEnd: safeNullableString(value.periodEnd),
    totalAllowance: safeNullableNumber(value.totalAllowance),
    used: safeNumber(value.used),
    remaining: safeNullableNumber(value.remaining),
    usageRate: safeNullableNumber(value.usageRate),
    warningLevel: safeString(value.warningLevel, 'none'),
    displayUnit: 'AI 服务额度',
    notes: safeStringArray(value.notes),
  };
}

function parseResponse(payload: unknown): InstitutionAiServiceUsageResponse {
  const record = isRecord(payload) ? payload : {};
  const period = isRecord(record.period) ? record.period : {};

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
    quota: parseQuota(record.quota),
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
