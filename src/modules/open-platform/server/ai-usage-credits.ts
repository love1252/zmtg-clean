import { and, asc, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';

import type { TenantDatabase } from '@/server/db/client';
import { aiCallUsageRecords, platformAiCreditMeteringRules, platformAiProviderConfigs, tenants } from '@/server/db/schema';
import { platformAiModelConfigData } from '@/modules/open-platform/mock/platformAiModelConfig';

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

export type PlatformAiUsageCreditsByDateProviderModelDto = {
  date: string;
  provider: string;
  providerDisplayName: string | null;
  model: string;
  modelDisplayName: string | null;
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  totalTokens: number;
  totalAiCreditsConsumed: number;
};

export type PlatformAiUsageCreditsAggregationsDto = {
  byModel: PlatformAiUsageCreditsByModelDto[];
  byTenant: PlatformAiUsageCreditsByTenantDto[];
  byMeteringStatus: PlatformAiUsageCreditsByMeteringStatusDto[];
  byDate: PlatformAiUsageCreditsByDateDto[];
  byDateProvider: PlatformAiUsageCreditsByDateProviderDto[];
  byDateProviderModel: PlatformAiUsageCreditsByDateProviderModelDto[];
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

export type PlatformAiUsageCreditsResponse = {
  requestId: 'platform-ai-usage-credits';
  readonly: true;
  dataSource: 'repository';
  summary: PlatformAiUsageCreditsSummaryDto;
  aggregations: PlatformAiUsageCreditsAggregationsDto;
  filterOptions: PlatformAiUsageCreditsFilterOptionsDto;
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

type AiUsageCreditByModelRow = {
  provider: string;
  model: string;
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  meteredCalls: number;
  totalTokens: number | null;
  totalAiCreditsConsumed: number | null;
};

type AiUsageCreditByTenantRow = {
  tenantId: string;
  tenantName: string | null;
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  meteredCalls: number;
  pendingCalls: number;
  notBillableCalls: number;
  totalTokens: number | null;
  totalAiCreditsConsumed: number | null;
};

type AiUsageCreditByMeteringStatusRow = {
  meteringStatus: string | null;
  calls: number;
  totalAiCreditsConsumed: number | null;
};

type AiUsageCreditByDateRow = {
  date: string;
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  totalAiCreditsConsumed: number | null;
};

type AiUsageCreditByDateProviderRow = {
  date: string;
  provider: string;
  totalCalls: number;
  totalTokens: number | null;
  totalAiCreditsConsumed: number | null;
};

type AiUsageCreditByDateProviderModelRow = {
  date: string;
  provider: string;
  model: string;
  totalCalls: number;
  succeededCalls: number;
  failedCalls: number;
  totalTokens: number | null;
  totalAiCreditsConsumed: number | null;
};

type AiUsageCreditFilterModelSourceRow = {
  provider: string | null;
  model: string | null;
  source?: FilterOptionSourceKind;
};

type AiUsageCreditFilterTenantRow = {
  tenantId: string | null;
  tenantName: string | null;
};

type AiUsageCreditFilterStatusRow = {
  status: string | null;
};

type AiUsageCreditFilterMeteringStatusRow = {
  meteringStatus: string | null;
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
const DEFAULT_FILTER_STATUSES = ['succeeded', 'failed', 'rejected', 'sensitive_input_rejected', 'rate_limited', 'provider_unavailable'];
const DEFAULT_FILTER_METERING_STATUSES = ['metered', 'pending', 'not_billable', 'legacy', 'empty'];
type FilterOptionSourceKind = 'configured' | 'system' | 'history';

type ProviderPresentation = {
  displayName: string | null;
  logoUrl: string | null;
  logoText: string | null;
  logoClassName: string | null;
  source: FilterOptionSourceKind;
};

const DEFAULT_PROVIDER_LOGO_URLS: Record<string, string> = {
  doubao: '/ai-vendor-logos/doubao.svg',
  deepseek: '/ai-vendor-logos/deepseek.svg',
  qwen: '/ai-vendor-logos/qwen.svg',
  chatglm: '/ai-vendor-logos/chatglm.svg',
  kimi: '/ai-vendor-logos/kimi.svg',
};

const SYSTEM_PROVIDER_PRESENTATION = new Map<string, ProviderPresentation>(
  platformAiModelConfigData.providers.map((provider) => [provider.providerId, {
    displayName: provider.providerName,
    logoUrl: DEFAULT_PROVIDER_LOGO_URLS[provider.providerId] ?? null,
    logoText: provider.logoText,
    logoClassName: provider.logoClassName,
    source: 'system' as const,
  }]),
);

const SYSTEM_MODEL_PRESENTATION = new Map<string, { displayName: string; provider: string }>(
  platformAiModelConfigData.providers.flatMap((provider) => (
    provider.models.map((model) => [`${provider.providerId}::${model.modelId}`, {
      displayName: model.displayName,
      provider: provider.providerId,
    }] as const)
  )),
);

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

function normalizeMeteringStatus(value: string | null) {
  if (!value) return 'empty';
  if (value === 'metered' || value === 'pending' || value === 'not_billable' || value === 'legacy') return value;
  return 'legacy';
}

function mapModelAggregationRow(row: AiUsageCreditByModelRow): PlatformAiUsageCreditsByModelDto {
  return {
    provider: row.provider,
    model: row.model,
    totalCalls: row.totalCalls ?? 0,
    succeededCalls: row.succeededCalls ?? 0,
    failedCalls: row.failedCalls ?? 0,
    meteredCalls: row.meteredCalls ?? 0,
    totalTokens: row.totalTokens ?? 0,
    totalAiCreditsConsumed: row.totalAiCreditsConsumed ?? 0,
  };
}

function mapTenantAggregationRow(row: AiUsageCreditByTenantRow): PlatformAiUsageCreditsByTenantDto {
  return {
    tenantId: row.tenantId,
    tenantName: row.tenantName,
    totalCalls: row.totalCalls ?? 0,
    succeededCalls: row.succeededCalls ?? 0,
    failedCalls: row.failedCalls ?? 0,
    meteredCalls: row.meteredCalls ?? 0,
    pendingCalls: row.pendingCalls ?? 0,
    notBillableCalls: row.notBillableCalls ?? 0,
    totalTokens: row.totalTokens ?? 0,
    totalAiCreditsConsumed: row.totalAiCreditsConsumed ?? 0,
  };
}

function mapMeteringStatusAggregationRow(row: AiUsageCreditByMeteringStatusRow): PlatformAiUsageCreditsByMeteringStatusDto {
  return {
    meteringStatus: normalizeMeteringStatus(row.meteringStatus),
    calls: row.calls ?? 0,
    totalAiCreditsConsumed: row.totalAiCreditsConsumed ?? 0,
  };
}

function mapDateAggregationRow(row: AiUsageCreditByDateRow): PlatformAiUsageCreditsByDateDto {
  return {
    date: row.date,
    totalCalls: row.totalCalls ?? 0,
    succeededCalls: row.succeededCalls ?? 0,
    failedCalls: row.failedCalls ?? 0,
    totalAiCreditsConsumed: row.totalAiCreditsConsumed ?? 0,
  };
}

function mapDateProviderAggregationRow(row: AiUsageCreditByDateProviderRow): PlatformAiUsageCreditsByDateProviderDto {
  const presentation = getProviderPresentation(row.provider, 'history');
  return {
    date: row.date,
    provider: row.provider,
    providerDisplayName: presentation.displayName,
    totalCalls: row.totalCalls ?? 0,
    totalTokens: row.totalTokens ?? 0,
    totalAiCreditsConsumed: row.totalAiCreditsConsumed ?? 0,
  };
}

function mapDateProviderModelAggregationRow(row: AiUsageCreditByDateProviderModelRow): PlatformAiUsageCreditsByDateProviderModelDto {
  const providerPresentation = getProviderPresentation(row.provider, 'history');
  const modelPresentation = SYSTEM_MODEL_PRESENTATION.get(`${row.provider}::${row.model}`);
  return {
    date: row.date,
    provider: row.provider,
    providerDisplayName: providerPresentation.displayName,
    model: row.model,
    modelDisplayName: modelPresentation?.displayName ?? null,
    totalCalls: row.totalCalls ?? 0,
    succeededCalls: row.succeededCalls ?? 0,
    failedCalls: row.failedCalls ?? 0,
    totalTokens: row.totalTokens ?? 0,
    totalAiCreditsConsumed: row.totalAiCreditsConsumed ?? 0,
  };
}

function normalizeFilterOptionValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || 'unknown';
}

function addUniqueValue(target: Set<string>, value: string | null | undefined) {
  target.add(normalizeFilterOptionValue(value));
}

function sourceRank(source: FilterOptionSourceKind) {
  if (source === 'configured') return 3;
  if (source === 'system') return 2;
  return 1;
}

function getProviderPresentation(provider: string, source: FilterOptionSourceKind): ProviderPresentation {
  const system = SYSTEM_PROVIDER_PRESENTATION.get(provider);
  return {
    displayName: system?.displayName ?? null,
    logoUrl: system?.logoUrl ?? null,
    logoText: system?.logoText ?? provider.slice(0, 1).toUpperCase(),
    logoClassName: system?.logoClassName ?? 'bg-slate-500',
    source: sourceRank(source) >= sourceRank(system?.source ?? 'history') ? source : system?.source ?? source,
  };
}

function chooseFilterOptionSource(provider: string, model: string, rowSource: FilterOptionSourceKind): FilterOptionSourceKind {
  if (rowSource === 'configured') return 'configured';
  if (SYSTEM_MODEL_PRESENTATION.has(`${provider}::${model}`) || SYSTEM_PROVIDER_PRESENTATION.has(provider)) return 'system';
  return rowSource;
}

function addUniqueProviderOption(
  target: Map<string, PlatformAiUsageCreditsFilterProviderOptionDto>,
  value: string | null | undefined,
  source: FilterOptionSourceKind,
) {
  const provider = normalizeFilterOptionValue(value);
  const current = target.get(provider);
  if (current && sourceRank(current.source) > sourceRank(source)) return;
  const presentation = getProviderPresentation(provider, source);
  target.set(provider, {
    provider,
    displayName: presentation.displayName,
    logoUrl: presentation.logoUrl,
    logoText: presentation.logoText,
    logoClassName: presentation.logoClassName,
    source: presentation.source,
  });
}

function addUniqueModelOption(
  target: Map<string, PlatformAiUsageCreditsFilterModelOptionDto>,
  row: AiUsageCreditFilterModelSourceRow,
) {
  const provider = normalizeFilterOptionValue(row.provider);
  const model = normalizeFilterOptionValue(row.model);
  const current = target.get(`${provider}::${model}`);
  const source = chooseFilterOptionSource(provider, model, row.source ?? 'history');
  if (current && sourceRank(current.source) > sourceRank(source)) return;

  const providerPresentation = getProviderPresentation(provider, source);
  const modelPresentation = SYSTEM_MODEL_PRESENTATION.get(`${provider}::${model}`);
  target.set(`${provider}::${model}`, {
    provider,
    model,
    displayName: modelPresentation?.displayName ?? null,
    providerDisplayName: providerPresentation.displayName,
    logoUrl: providerPresentation.logoUrl,
    logoText: providerPresentation.logoText,
    logoClassName: providerPresentation.logoClassName,
    source,
  });
}

export function buildPlatformAiUsageCreditsFilterOptions(input: {
  modelRows: AiUsageCreditFilterModelSourceRow[];
  tenantRows: AiUsageCreditFilterTenantRow[];
  statusRows: AiUsageCreditFilterStatusRow[];
  meteringStatusRows: AiUsageCreditFilterMeteringStatusRow[];
}): PlatformAiUsageCreditsFilterOptionsDto {
  const providers = new Map<string, PlatformAiUsageCreditsFilterProviderOptionDto>();
  const models = new Map<string, PlatformAiUsageCreditsFilterModelOptionDto>();
  const tenantsById = new Map<string, PlatformAiUsageCreditsFilterTenantOptionDto>();
  const statuses = new Set(DEFAULT_FILTER_STATUSES);
  const meteringStatuses = new Set(DEFAULT_FILTER_METERING_STATUSES);

  input.modelRows.forEach((row) => {
    const provider = normalizeFilterOptionValue(row.provider);
    const model = normalizeFilterOptionValue(row.model);
    const source = chooseFilterOptionSource(provider, model, row.source ?? 'history');
    addUniqueProviderOption(providers, provider, source);
    addUniqueModelOption(models, { provider, model, source });
  });
  input.tenantRows.forEach((row) => {
    const tenantId = row.tenantId?.trim();
    if (!tenantId || tenantsById.has(tenantId)) return;
    tenantsById.set(tenantId, { tenantId, tenantName: row.tenantName });
  });
  input.statusRows.forEach((row) => addUniqueValue(statuses, row.status));
  input.meteringStatusRows.forEach((row) => meteringStatuses.add(normalizeMeteringStatus(row.meteringStatus)));

  return {
    providers: Array.from(providers.values()).sort((left, right) => {
      const leftLabel = left.displayName ?? left.provider;
      const rightLabel = right.displayName ?? right.provider;
      return leftLabel.localeCompare(rightLabel, 'zh-CN');
    }),
    models: Array.from(models.values()).sort((left, right) => {
      const byProvider = left.provider.localeCompare(right.provider, 'zh-CN');
      return byProvider || left.model.localeCompare(right.model, 'zh-CN');
    }),
    tenants: Array.from(tenantsById.values()).sort((left, right) => {
      const leftLabel = left.tenantName ?? left.tenantId;
      const rightLabel = right.tenantName ?? right.tenantId;
      return leftLabel.localeCompare(rightLabel, 'zh-CN');
    }),
    statuses: Array.from(statuses),
    meteringStatuses: Array.from(meteringStatuses),
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

    async listFilterOptions(): Promise<PlatformAiUsageCreditsFilterOptionsDto> {
      const usageModelRowsQuery = database
        .select({
          provider: aiCallUsageRecords.provider,
          model: aiCallUsageRecords.model,
        })
        .from(aiCallUsageRecords)
        .groupBy(aiCallUsageRecords.provider, aiCallUsageRecords.model)
        .orderBy(asc(aiCallUsageRecords.provider), asc(aiCallUsageRecords.model))
        .limit(200);

      const providerConfigModelRowsQuery = database
        .select({
          provider: platformAiProviderConfigs.provider,
          model: platformAiProviderConfigs.model,
        })
        .from(platformAiProviderConfigs)
        .groupBy(platformAiProviderConfigs.provider, platformAiProviderConfigs.model)
        .orderBy(asc(platformAiProviderConfigs.provider), asc(platformAiProviderConfigs.model))
        .limit(200);

      const meteringRuleModelRowsQuery = database
        .select({
          provider: platformAiCreditMeteringRules.provider,
          model: platformAiCreditMeteringRules.model,
        })
        .from(platformAiCreditMeteringRules)
        .groupBy(platformAiCreditMeteringRules.provider, platformAiCreditMeteringRules.model)
        .orderBy(asc(platformAiCreditMeteringRules.provider), asc(platformAiCreditMeteringRules.model))
        .limit(200);

      const tenantRowsQuery = database
        .select({
          tenantId: aiCallUsageRecords.tenantId,
          tenantName: tenants.name,
        })
        .from(aiCallUsageRecords)
        .leftJoin(tenants, eq(aiCallUsageRecords.tenantId, tenants.id))
        .groupBy(aiCallUsageRecords.tenantId, tenants.name)
        .orderBy(asc(tenants.name), asc(aiCallUsageRecords.tenantId))
        .limit(200);

      const statusRowsQuery = database
        .select({ status: aiCallUsageRecords.status })
        .from(aiCallUsageRecords)
        .groupBy(aiCallUsageRecords.status)
        .orderBy(asc(aiCallUsageRecords.status));

      const meteringStatusRowsQuery = database
        .select({ meteringStatus: aiCallUsageRecords.meteringStatus })
        .from(aiCallUsageRecords)
        .groupBy(aiCallUsageRecords.meteringStatus)
        .orderBy(asc(aiCallUsageRecords.meteringStatus));

      const [usageModelRows, providerConfigModelRows, meteringRuleModelRows, tenantRows, statusRows, meteringStatusRows] = await Promise.all([
        usageModelRowsQuery,
        providerConfigModelRowsQuery,
        meteringRuleModelRowsQuery,
        tenantRowsQuery,
        statusRowsQuery,
        meteringStatusRowsQuery,
      ]);

      return buildPlatformAiUsageCreditsFilterOptions({
        modelRows: [
          ...(usageModelRows as AiUsageCreditFilterModelSourceRow[]).map((row) => ({ ...row, source: 'history' as const })),
          ...(providerConfigModelRows as AiUsageCreditFilterModelSourceRow[]).map((row) => ({ ...row, source: 'configured' as const })),
          ...(meteringRuleModelRows as AiUsageCreditFilterModelSourceRow[]).map((row) => ({ ...row, source: 'system' as const })),
        ],
        tenantRows: tenantRows as AiUsageCreditFilterTenantRow[],
        statusRows: statusRows as AiUsageCreditFilterStatusRow[],
        meteringStatusRows: meteringStatusRows as AiUsageCreditFilterMeteringStatusRow[],
      });
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

    async aggregateUsageCredits(filters: NormalizedPlatformAiUsageCreditsFilters): Promise<PlatformAiUsageCreditsAggregationsDto> {
      const conditions = buildConditions(filters);
      const dateExpression = sql<string>`to_char(${aiCallUsageRecords.createdAt}, 'YYYY-MM-DD')`;

      const byModelQuery = database
        .select({
          provider: aiCallUsageRecords.provider,
          model: aiCallUsageRecords.model,
          totalCalls: sql<number>`count(*)::int`,
          succeededCalls: sql<number>`count(case when ${aiCallUsageRecords.status} = 'succeeded' then 1 end)::int`,
          failedCalls: sql<number>`count(case when ${aiCallUsageRecords.status} != 'succeeded' then 1 end)::int`,
          meteredCalls: sql<number>`count(case when ${aiCallUsageRecords.meteringStatus} = 'metered' then 1 end)::int`,
          totalTokens: sql<number | null>`coalesce(sum(${aiCallUsageRecords.totalTokens}), 0)::int`,
          totalAiCreditsConsumed: sql<number | null>`coalesce(sum(${aiCallUsageRecords.aiCreditsConsumed}), 0)::int`,
        })
        .from(aiCallUsageRecords)
        .$dynamic();

      const byTenantQuery = database
        .select({
          tenantId: aiCallUsageRecords.tenantId,
          tenantName: tenants.name,
          totalCalls: sql<number>`count(*)::int`,
          succeededCalls: sql<number>`count(case when ${aiCallUsageRecords.status} = 'succeeded' then 1 end)::int`,
          failedCalls: sql<number>`count(case when ${aiCallUsageRecords.status} != 'succeeded' then 1 end)::int`,
          meteredCalls: sql<number>`count(case when ${aiCallUsageRecords.meteringStatus} = 'metered' then 1 end)::int`,
          pendingCalls: sql<number>`count(case when ${aiCallUsageRecords.meteringStatus} = 'pending' then 1 end)::int`,
          notBillableCalls: sql<number>`count(case when ${aiCallUsageRecords.meteringStatus} = 'not_billable' then 1 end)::int`,
          totalTokens: sql<number | null>`coalesce(sum(${aiCallUsageRecords.totalTokens}), 0)::int`,
          totalAiCreditsConsumed: sql<number | null>`coalesce(sum(${aiCallUsageRecords.aiCreditsConsumed}), 0)::int`,
        })
        .from(aiCallUsageRecords)
        .leftJoin(tenants, eq(aiCallUsageRecords.tenantId, tenants.id))
        .$dynamic();

      const byMeteringStatusQuery = database
        .select({
          meteringStatus: aiCallUsageRecords.meteringStatus,
          calls: sql<number>`count(*)::int`,
          totalAiCreditsConsumed: sql<number | null>`coalesce(sum(${aiCallUsageRecords.aiCreditsConsumed}), 0)::int`,
        })
        .from(aiCallUsageRecords)
        .$dynamic();

      const byDateQuery = database
        .select({
          date: dateExpression,
          totalCalls: sql<number>`count(*)::int`,
          succeededCalls: sql<number>`count(case when ${aiCallUsageRecords.status} = 'succeeded' then 1 end)::int`,
          failedCalls: sql<number>`count(case when ${aiCallUsageRecords.status} != 'succeeded' then 1 end)::int`,
          totalAiCreditsConsumed: sql<number | null>`coalesce(sum(${aiCallUsageRecords.aiCreditsConsumed}), 0)::int`,
        })
        .from(aiCallUsageRecords)
        .$dynamic();

      const byDateProviderQuery = database
        .select({
          date: dateExpression,
          provider: aiCallUsageRecords.provider,
          totalCalls: sql<number>`count(*)::int`,
          totalTokens: sql<number | null>`coalesce(sum(${aiCallUsageRecords.totalTokens}), 0)::int`,
          totalAiCreditsConsumed: sql<number | null>`coalesce(sum(${aiCallUsageRecords.aiCreditsConsumed}), 0)::int`,
        })
        .from(aiCallUsageRecords)
        .$dynamic();

      const byDateProviderModelQuery = database
        .select({
          date: dateExpression,
          provider: aiCallUsageRecords.provider,
          model: aiCallUsageRecords.model,
          totalCalls: sql<number>`count(*)::int`,
          succeededCalls: sql<number>`count(case when ${aiCallUsageRecords.status} = 'succeeded' then 1 end)::int`,
          failedCalls: sql<number>`count(case when ${aiCallUsageRecords.status} != 'succeeded' then 1 end)::int`,
          totalTokens: sql<number | null>`coalesce(sum(${aiCallUsageRecords.totalTokens}), 0)::int`,
          totalAiCreditsConsumed: sql<number | null>`coalesce(sum(${aiCallUsageRecords.aiCreditsConsumed}), 0)::int`,
        })
        .from(aiCallUsageRecords)
        .$dynamic();

      const [byModelRows, byTenantRows, byMeteringStatusRows, byDateRows, byDateProviderRows, byDateProviderModelRows] = await Promise.all([
        withConditions(byModelQuery, conditions)
          .groupBy(aiCallUsageRecords.provider, aiCallUsageRecords.model)
          .orderBy(desc(sql`coalesce(sum(${aiCallUsageRecords.aiCreditsConsumed}), 0)`), desc(sql`count(*)`))
          .limit(20),
        withConditions(byTenantQuery, conditions)
          .groupBy(aiCallUsageRecords.tenantId, tenants.name)
          .orderBy(desc(sql`coalesce(sum(${aiCallUsageRecords.aiCreditsConsumed}), 0)`), desc(sql`count(*)`))
          .limit(20),
        withConditions(byMeteringStatusQuery, conditions)
          .groupBy(aiCallUsageRecords.meteringStatus)
          .orderBy(desc(sql`count(*)`)),
        withConditions(byDateQuery, conditions)
          .groupBy(dateExpression)
          .orderBy(asc(dateExpression))
          .limit(31),
        withConditions(byDateProviderQuery, conditions)
          .groupBy(dateExpression, aiCallUsageRecords.provider)
          .orderBy(asc(dateExpression), desc(sql`coalesce(sum(${aiCallUsageRecords.aiCreditsConsumed}), 0)`)),
        withConditions(byDateProviderModelQuery, conditions)
          .groupBy(dateExpression, aiCallUsageRecords.provider, aiCallUsageRecords.model)
          .orderBy(asc(dateExpression), desc(sql`coalesce(sum(${aiCallUsageRecords.aiCreditsConsumed}), 0)`), desc(sql`count(*)`)),
      ]);

      const byMeteringStatus = new Map<string, PlatformAiUsageCreditsByMeteringStatusDto>();
      (byMeteringStatusRows as AiUsageCreditByMeteringStatusRow[])
        .map(mapMeteringStatusAggregationRow)
        .forEach((row) => {
          const current = byMeteringStatus.get(row.meteringStatus);
          byMeteringStatus.set(row.meteringStatus, {
            meteringStatus: row.meteringStatus,
            calls: (current?.calls ?? 0) + row.calls,
            totalAiCreditsConsumed: (current?.totalAiCreditsConsumed ?? 0) + row.totalAiCreditsConsumed,
          });
        });

      return {
        byModel: (byModelRows as AiUsageCreditByModelRow[]).map(mapModelAggregationRow),
        byTenant: (byTenantRows as AiUsageCreditByTenantRow[]).map(mapTenantAggregationRow),
        byMeteringStatus: Array.from(byMeteringStatus.values()),
        byDate: (byDateRows as AiUsageCreditByDateRow[]).map(mapDateAggregationRow),
        byDateProvider: (byDateProviderRows as AiUsageCreditByDateProviderRow[]).map(mapDateProviderAggregationRow),
        byDateProviderModel: (byDateProviderModelRows as AiUsageCreditByDateProviderModelRow[]).map(mapDateProviderModelAggregationRow),
      };
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

  const [summary, aggregations, filterOptions, records] = await Promise.all([
    input.repository.summarizeUsageCredits(normalized.filters),
    input.repository.aggregateUsageCredits(normalized.filters),
    input.repository.listFilterOptions(),
    input.repository.listUsageCredits(normalized.filters),
  ]);

  return {
    status: 'ok',
    response: {
      requestId: 'platform-ai-usage-credits',
      readonly: true,
      dataSource: 'repository',
      summary,
      aggregations,
      filterOptions,
      records,
      filters: normalized.filters,
      emptyState: {
        title: '暂无 AI 用量明细',
        description: '当前过滤条件下没有 AI 调用记录。',
      },
    },
  };
}
