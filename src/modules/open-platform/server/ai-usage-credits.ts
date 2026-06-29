import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';

import type { TenantDatabase } from '@/server/db/client';
import { aiCallUsageRecords, tenants } from '@/server/db/schema';

export type PlatformAiUsageCreditsSummaryDto = {
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  meteredCalls: number;
  pendingCalls: number;
  notBillableCalls: number;
  totalAiCreditsConsumed: number;
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

export type PlatformAiUsageCreditsFilters = {
  tenantId?: string | null;
  status?: string | null;
  meteringStatus?: string | null;
  provider?: string | null;
  model?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number | string | null;
};

export type NormalizedPlatformAiUsageCreditsFilters = {
  tenantId?: string;
  status?: string;
  meteringStatus?: string;
  provider?: string;
  model?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit: number;
};

export type PlatformAiUsageCreditsResponse = {
  requestId: 'platform-ai-usage-credits';
  readonly: true;
  dataSource: 'repository';
  summary: PlatformAiUsageCreditsSummaryDto;
  records: PlatformAiUsageCreditDetailDto[];
  filters: NormalizedPlatformAiUsageCreditsFilters;
  emptyState: {
    title: string;
    description: string;
  };
};

type AiUsageCreditRow = {
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
  metadata: unknown;
  createdAt: Date;
};

type AiUsageCreditSummaryRow = {
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  meteredCalls: number;
  pendingCalls: number;
  notBillableCalls: number;
  totalAiCreditsConsumed: number | null;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const textLimits = {
  tenantId: 64,
  status: 32,
  meteringStatus: 32,
  provider: 64,
  model: 128,
} as const;

function zeroSummary(): PlatformAiUsageCreditsSummaryDto {
  return {
    totalCalls: 0,
    succeededCalls: 0,
    failedCalls: 0,
    meteredCalls: 0,
    pendingCalls: 0,
    notBillableCalls: 0,
    totalAiCreditsConsumed: 0,
  };
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > maxLength) return null;
  return normalized;
}

function normalizeDate(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLimit(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return DEFAULT_LIMIT;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return Math.min(numeric, MAX_LIMIT);
}

export function normalizePlatformAiUsageCreditsFilters(
  filters: PlatformAiUsageCreditsFilters = {},
): { ok: true; filters: NormalizedPlatformAiUsageCreditsFilters } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const tenantId = normalizeOptionalText(filters.tenantId, textLimits.tenantId);
  const status = normalizeOptionalText(filters.status, textLimits.status);
  const meteringStatus = normalizeOptionalText(filters.meteringStatus, textLimits.meteringStatus);
  const provider = normalizeOptionalText(filters.provider, textLimits.provider);
  const model = normalizeOptionalText(filters.model, textLimits.model);
  const dateFrom = normalizeDate(filters.dateFrom);
  const dateTo = normalizeDate(filters.dateTo);
  const limit = normalizeLimit(filters.limit);

  if (tenantId === null) errors.push('tenant_id_invalid');
  if (status === null) errors.push('status_invalid');
  if (meteringStatus === null) errors.push('metering_status_invalid');
  if (provider === null) errors.push('provider_invalid');
  if (model === null) errors.push('model_invalid');
  if (dateFrom === null) errors.push('date_from_invalid');
  if (dateTo === null) errors.push('date_to_invalid');
  if (limit === null) errors.push('limit_invalid');
  if (dateFrom instanceof Date && dateTo instanceof Date && dateTo.getTime() < dateFrom.getTime()) {
    errors.push('date_to_must_be_after_date_from');
  }

  if (errors.length > 0 || limit === null) return { ok: false, errors };

  return {
    ok: true,
    filters: {
      ...(tenantId ? { tenantId } : {}),
      ...(status ? { status } : {}),
      ...(meteringStatus ? { meteringStatus } : {}),
      ...(provider ? { provider } : {}),
      ...(model ? { model } : {}),
      ...(dateFrom instanceof Date ? { dateFrom } : {}),
      ...(dateTo instanceof Date ? { dateTo } : {}),
      limit,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function mapKnowledgeContext(metadata: unknown) {
  const knowledgeContext = isRecord(metadata) && isRecord(metadata.knowledgeContext)
    ? metadata.knowledgeContext
    : null;
  const sources = Array.isArray(knowledgeContext?.sources) ? knowledgeContext.sources : [];
  return {
    knowledgeContextUsed: Boolean(knowledgeContext?.used),
    sourceCount: sources.length,
  };
}

export function mapPlatformAiUsageCreditRowToDto(row: AiUsageCreditRow): PlatformAiUsageCreditDetailDto {
  const knowledgeContext = mapKnowledgeContext(row.metadata);
  return {
    id: row.id,
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    status: row.status,
    errorCode: row.errorCode,
    provider: row.provider,
    model: row.model,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    aiCreditsConsumed: row.aiCreditsConsumed,
    meteringStatus: row.meteringStatus,
    meteringVersion: row.meteringVersion,
    createdAt: row.createdAt.toISOString(),
    knowledgeContextUsed: knowledgeContext.knowledgeContextUsed,
    sourceCount: knowledgeContext.sourceCount,
  };
}

function mapSummaryRow(row: AiUsageCreditSummaryRow | undefined): PlatformAiUsageCreditsSummaryDto {
  if (!row) return zeroSummary();
  return {
    totalCalls: row.totalCalls ?? 0,
    succeededCalls: row.succeededCalls ?? 0,
    failedCalls: row.failedCalls ?? 0,
    meteredCalls: row.meteredCalls ?? 0,
    pendingCalls: row.pendingCalls ?? 0,
    notBillableCalls: row.notBillableCalls ?? 0,
    totalAiCreditsConsumed: row.totalAiCreditsConsumed ?? 0,
  };
}

function buildConditions(filters: NormalizedPlatformAiUsageCreditsFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.tenantId) conditions.push(eq(aiCallUsageRecords.tenantId, filters.tenantId));
  if (filters.status) conditions.push(eq(aiCallUsageRecords.status, filters.status));
  if (filters.meteringStatus) conditions.push(eq(aiCallUsageRecords.meteringStatus, filters.meteringStatus));
  if (filters.provider) conditions.push(eq(aiCallUsageRecords.provider, filters.provider));
  if (filters.model) conditions.push(eq(aiCallUsageRecords.model, filters.model));
  if (filters.dateFrom) conditions.push(gte(aiCallUsageRecords.createdAt, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(aiCallUsageRecords.createdAt, filters.dateTo));
  return conditions;
}

function withConditions<T extends { where: (condition: SQL) => T }>(query: T, conditions: SQL[]) {
  if (conditions.length === 0) return query;
  const condition = and(...conditions);
  if (!condition) return query;
  return query.where(condition);
}

export function createPlatformAiUsageCreditsRepository(database: TenantDatabase) {
  return {
    async listUsageCredits(filters: NormalizedPlatformAiUsageCreditsFilters) {
      const conditions = buildConditions(filters);
      const baseRowsQuery = database
        .select({
          id: aiCallUsageRecords.id,
          tenantId: aiCallUsageRecords.tenantId,
          tenantName: tenants.name,
          status: aiCallUsageRecords.status,
          errorCode: aiCallUsageRecords.errorCode,
          provider: aiCallUsageRecords.provider,
          model: aiCallUsageRecords.model,
          promptTokens: aiCallUsageRecords.promptTokens,
          completionTokens: aiCallUsageRecords.completionTokens,
          totalTokens: aiCallUsageRecords.totalTokens,
          aiCreditsConsumed: aiCallUsageRecords.aiCreditsConsumed,
          meteringStatus: aiCallUsageRecords.meteringStatus,
          meteringVersion: aiCallUsageRecords.meteringVersion,
          metadata: aiCallUsageRecords.metadata,
          createdAt: aiCallUsageRecords.createdAt,
        })
        .from(aiCallUsageRecords)
        .leftJoin(tenants, eq(aiCallUsageRecords.tenantId, tenants.id))
        .$dynamic();

      const rows = await withConditions(baseRowsQuery, conditions)
        .orderBy(desc(aiCallUsageRecords.createdAt))
        .limit(filters.limit);

      return (rows as AiUsageCreditRow[]).map(mapPlatformAiUsageCreditRowToDto);
    },

    async summarizeUsageCredits(filters: NormalizedPlatformAiUsageCreditsFilters) {
      const conditions = buildConditions(filters);
      const baseSummaryQuery = database
        .select({
          totalCalls: sql<number>`count(*)::int`,
          succeededCalls: sql<number>`count(case when ${aiCallUsageRecords.status} = 'succeeded' then 1 end)::int`,
          failedCalls: sql<number>`count(case when ${aiCallUsageRecords.status} != 'succeeded' then 1 end)::int`,
          meteredCalls: sql<number>`count(case when ${aiCallUsageRecords.meteringStatus} = 'metered' then 1 end)::int`,
          pendingCalls: sql<number>`count(case when ${aiCallUsageRecords.meteringStatus} = 'pending' then 1 end)::int`,
          notBillableCalls: sql<number>`count(case when ${aiCallUsageRecords.meteringStatus} = 'not_billable' then 1 end)::int`,
          totalAiCreditsConsumed: sql<number | null>`coalesce(sum(${aiCallUsageRecords.aiCreditsConsumed}), 0)::int`,
        })
        .from(aiCallUsageRecords)
        .$dynamic();

      const rows = await withConditions(baseSummaryQuery, conditions);
      return mapSummaryRow(rows[0] as AiUsageCreditSummaryRow | undefined);
    },
  };
}

export type PlatformAiUsageCreditsRepository = ReturnType<typeof createPlatformAiUsageCreditsRepository>;

export async function listPlatformAiUsageCredits(input: {
  repository: PlatformAiUsageCreditsRepository;
  filters?: PlatformAiUsageCreditsFilters;
}): Promise<
  | { status: 'ok'; response: PlatformAiUsageCreditsResponse }
  | { status: 'validation_failed'; errors: string[] }
> {
  const normalized = normalizePlatformAiUsageCreditsFilters(input.filters ?? {});
  if (!normalized.ok) return { status: 'validation_failed', errors: normalized.errors };

  const [summary, records] = await Promise.all([
    input.repository.summarizeUsageCredits(normalized.filters),
    input.repository.listUsageCredits(normalized.filters),
  ]);

  return {
    status: 'ok',
    response: {
      requestId: 'platform-ai-usage-credits',
      readonly: true,
      dataSource: 'repository',
      summary,
      records,
      filters: normalized.filters,
      emptyState: {
        title: '暂无 AI 用量明细',
        description: '当前过滤条件下没有 AI 调用记录。',
      },
    },
  };
}
