import { and, asc, eq, gte, lte } from 'drizzle-orm';

import type { TenantDatabase } from '@/server/db/client';
import { aiCallUsageRecords } from '@/server/db/schema';
import type { AiCallUsageStatus } from '@/modules/institution/server/institution-ai-call-service';

export type InstitutionAiServiceUsagePreset =
  | 'today'
  | 'last7days'
  | 'currentMonth'
  | 'lastMonth'
  | 'custom';

export type InstitutionAiServiceUsagePeriod = {
  from: string;
  to: string;
  preset: InstitutionAiServiceUsagePreset;
};

export type InstitutionAiServiceUsageSummaryDto = {
  totalUsageCount: number;
  succeededCount: number;
  failedCount: number;
  rejectedCount: number;
  successRate: number;
  aiServiceUnitsUsed: number;
};

export type InstitutionAiServiceUsageTrendDto = {
  date: string;
  usageCount: number;
  aiServiceUnitsUsed: number;
};

export type InstitutionAiServiceUsageServiceProjectDto = {
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
  period: InstitutionAiServiceUsagePeriod;
  summary: InstitutionAiServiceUsageSummaryDto;
  trend: InstitutionAiServiceUsageTrendDto[];
  serviceProjects: InstitutionAiServiceUsageServiceProjectDto[];
  quota: {
    isLinked: false;
  };
  notes: string[];
};

export type InstitutionAiServiceUsageRow = {
  createdAt: Date;
  status: AiCallUsageStatus;
  aiCreditsConsumed: number | null;
  serviceCategory: string | null;
  serviceName: string | null;
};

type ResolvePeriodResult =
  | { ok: true; period: InstitutionAiServiceUsagePeriod; dateFrom: Date; dateTo: Date }
  | { ok: false; code: 'invalid_date_range'; error: '时间范围无效' };

const INSTITUTION_AI_SERVICE_USAGE_NOTES = [
  '只展示机构端低敏服务使用统计，不展示内部模型、供应商、成本或原始内容。',
  '服务额度仅作只读运营分析；套餐扣减、费用结算和导出能力不在本接口中提供。',
];

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function firstDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function lastDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function parseDateOnly(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function resolvePresetPeriod(preset: InstitutionAiServiceUsagePreset, now: Date) {
  const today = startOfDay(now);
  if (preset === 'today') {
    return { fromDate: today, toDate: today };
  }
  if (preset === 'last7days') {
    return { fromDate: addDays(today, -6), toDate: today };
  }
  if (preset === 'lastMonth') {
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return {
      fromDate: firstDayOfMonth(previousMonth),
      toDate: lastDayOfMonth(previousMonth),
    };
  }
  return {
    fromDate: firstDayOfMonth(today),
    toDate: lastDayOfMonth(today),
  };
}

export function resolveInstitutionAiServiceUsagePeriod(
  searchParams: URLSearchParams,
  now = new Date(),
): ResolvePeriodResult {
  const rawFrom = searchParams.get('from');
  const rawTo = searchParams.get('to');
  if (rawFrom || rawTo) {
    const fromDate = parseDateOnly(rawFrom);
    const toDate = parseDateOnly(rawTo);
    if (!fromDate || !toDate || fromDate.getTime() > toDate.getTime()) {
      return { ok: false, code: 'invalid_date_range', error: '时间范围无效' };
    }
    return {
      ok: true,
      period: {
        from: formatDateKey(fromDate),
        to: formatDateKey(toDate),
        preset: 'custom',
      },
      dateFrom: startOfDay(fromDate),
      dateTo: endOfDay(toDate),
    };
  }

  const preset = (searchParams.get('preset') ?? 'currentMonth') as InstitutionAiServiceUsagePreset;
  if (!['today', 'last7days', 'currentMonth', 'lastMonth'].includes(preset)) {
    return { ok: false, code: 'invalid_date_range', error: '时间范围无效' };
  }

  const { fromDate, toDate } = resolvePresetPeriod(preset, now);
  return {
    ok: true,
    period: {
      from: formatDateKey(fromDate),
      to: formatDateKey(toDate),
      preset,
    },
    dateFrom: startOfDay(fromDate),
    dateTo: endOfDay(toDate),
  };
}

function normalizeServiceCategory(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || 'unknown';
}

function normalizeServiceName(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || '未归因服务';
}

function normalizeUnits(value: number | null | undefined) {
  return value ?? 0;
}

function roundPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function isRejectedStatus(status: AiCallUsageStatus) {
  return status === 'rejected' || status === 'sensitive_input_rejected';
}

function createEmptySummary(): InstitutionAiServiceUsageSummaryDto {
  return {
    totalUsageCount: 0,
    succeededCount: 0,
    failedCount: 0,
    rejectedCount: 0,
    successRate: 0,
    aiServiceUnitsUsed: 0,
  };
}

function incrementCounters(
  target: Pick<InstitutionAiServiceUsageSummaryDto, 'succeededCount' | 'failedCount' | 'rejectedCount'>,
  status: AiCallUsageStatus,
) {
  if (status === 'succeeded') {
    target.succeededCount += 1;
    return;
  }
  if (isRejectedStatus(status)) {
    target.rejectedCount += 1;
    return;
  }
  target.failedCount += 1;
}

export function buildInstitutionAiServiceUsageResponse(input: {
  period: InstitutionAiServiceUsagePeriod;
  rows: InstitutionAiServiceUsageRow[];
}): InstitutionAiServiceUsageResponse {
  const summary = createEmptySummary();
  const trendMap = new Map<string, InstitutionAiServiceUsageTrendDto>();
  const serviceProjectMap = new Map<string, InstitutionAiServiceUsageServiceProjectDto>();

  for (const row of input.rows) {
    const aiServiceUnitsUsed = normalizeUnits(row.aiCreditsConsumed);
    const date = formatDateKey(row.createdAt);
    summary.totalUsageCount += 1;
    summary.aiServiceUnitsUsed += aiServiceUnitsUsed;
    incrementCounters(summary, row.status);

    const trend = trendMap.get(date) ?? {
      date,
      usageCount: 0,
      aiServiceUnitsUsed: 0,
    };
    trend.usageCount += 1;
    trend.aiServiceUnitsUsed += aiServiceUnitsUsed;
    trendMap.set(date, trend);

    const serviceCategory = normalizeServiceCategory(row.serviceCategory);
    const serviceName = normalizeServiceName(row.serviceName);
    const serviceProjectKey = `${serviceCategory}\u0000${serviceName}`;
    const serviceProject = serviceProjectMap.get(serviceProjectKey) ?? {
      serviceCategory,
      serviceName,
      usageCount: 0,
      succeededCount: 0,
      failedCount: 0,
      rejectedCount: 0,
      successRate: 0,
      aiServiceUnitsUsed: 0,
      sharePercent: 0,
    };
    serviceProject.usageCount += 1;
    serviceProject.aiServiceUnitsUsed += aiServiceUnitsUsed;
    incrementCounters(serviceProject, row.status);
    serviceProjectMap.set(serviceProjectKey, serviceProject);
  }

  summary.successRate = roundPercent(
    summary.totalUsageCount > 0
      ? (summary.succeededCount / summary.totalUsageCount) * 100
      : 0,
  );

  const serviceProjects = Array.from(serviceProjectMap.values())
    .map((serviceProject) => ({
      ...serviceProject,
      successRate: roundPercent(
        serviceProject.usageCount > 0
          ? (serviceProject.succeededCount / serviceProject.usageCount) * 100
          : 0,
      ),
      sharePercent: roundPercent(
        summary.aiServiceUnitsUsed > 0
          ? (serviceProject.aiServiceUnitsUsed / summary.aiServiceUnitsUsed) * 100
          : summary.totalUsageCount > 0
            ? (serviceProject.usageCount / summary.totalUsageCount) * 100
            : 0,
      ),
    }))
    .sort((left, right) =>
      right.aiServiceUnitsUsed - left.aiServiceUnitsUsed
      || right.usageCount - left.usageCount,
    );

  return {
    requestId: 'institution-ai-service-usage',
    readonly: true,
    period: input.period,
    summary,
    trend: Array.from(trendMap.values()).sort((left, right) => left.date.localeCompare(right.date)),
    serviceProjects,
    quota: {
      isLinked: false,
    },
    notes: INSTITUTION_AI_SERVICE_USAGE_NOTES,
  };
}

export async function listInstitutionAiServiceUsageRows(input: {
  database: TenantDatabase;
  tenantId: string;
  institutionId: string;
  dateFrom: Date;
  dateTo: Date;
}): Promise<InstitutionAiServiceUsageRow[]> {
  const rows = await input.database
    .select({
      createdAt: aiCallUsageRecords.createdAt,
      status: aiCallUsageRecords.status,
      aiCreditsConsumed: aiCallUsageRecords.aiCreditsConsumed,
      serviceCategory: aiCallUsageRecords.serviceCategory,
      serviceName: aiCallUsageRecords.serviceName,
    })
    .from(aiCallUsageRecords)
    .where(and(
      eq(aiCallUsageRecords.tenantId, input.tenantId),
      eq(aiCallUsageRecords.institutionId, input.institutionId),
      gte(aiCallUsageRecords.createdAt, input.dateFrom),
      lte(aiCallUsageRecords.createdAt, input.dateTo),
    ))
    .orderBy(asc(aiCallUsageRecords.createdAt));

  return rows.map((row) => ({
    createdAt: row.createdAt,
    status: row.status as AiCallUsageStatus,
    aiCreditsConsumed: row.aiCreditsConsumed,
    serviceCategory: row.serviceCategory,
    serviceName: row.serviceName,
  }));
}

export async function getInstitutionAiServiceUsage(input: {
  database: TenantDatabase;
  tenantId: string;
  institutionId: string;
  period: InstitutionAiServiceUsagePeriod;
  dateFrom: Date;
  dateTo: Date;
}): Promise<InstitutionAiServiceUsageResponse> {
  const rows = await listInstitutionAiServiceUsageRows({
    database: input.database,
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  return buildInstitutionAiServiceUsageResponse({
    period: input.period,
    rows,
  });
}
