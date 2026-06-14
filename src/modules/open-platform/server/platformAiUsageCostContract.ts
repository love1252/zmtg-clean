import {
  PLATFORM_AI_USAGE_AVAILABLE_MONTHS,
  PLATFORM_AI_USAGE_COST_DISCLAIMER,
  PLATFORM_AI_USAGE_DEFAULT_MONTH,
  platformAiFutureLogFieldSpec,
  platformAiUsageCostSampleData,
  type PlatformAiFutureLogFieldSpec,
  type PlatformAiProviderModelUsage,
  type PlatformAiSampleInstitutionUsage,
  type PlatformAiScenarioUsage,
  type PlatformAiUsageAvailableMonth,
  type PlatformAiUsageSummary,
} from '@/modules/open-platform/mock/platformAiUsageCost';

export type PlatformAiUsageCostResponse = {
  readonly: true;
  dataSource: 'controlled_demo';
  usageVersion: 'ai-usage-cost-v1-controlled-demo';
  usageStatus: 'controlled_readonly_demo';
  availableMonths: PlatformAiUsageAvailableMonth[];
  selectedMonth: string;
  hasUsageData: boolean;
  emptyState: {
    title: string;
    description: string;
  } | null;
  summary: PlatformAiUsageSummary;
  providerModelRows: PlatformAiProviderModelUsage[];
  scenarioRows: PlatformAiScenarioUsage[];
  sampleInstitutionRanking: PlatformAiSampleInstitutionUsage[];
  costDisclaimer: string;
  futureLogFieldSpec: PlatformAiFutureLogFieldSpec[];
};

export type PlatformAiUsageCostValidationResult = {
  ok: boolean;
  errors: string[];
};

const controlledMonths = new Set(PLATFORM_AI_USAGE_AVAILABLE_MONTHS.map((month) => month.value));

function emptySummary(month: string): PlatformAiUsageSummary {
  return {
    month,
    totalCalls: 0,
    totalTokens: 0,
    successRate: 0,
    averageLatencyMs: 0,
    estimatedCostCny: 0,
  };
}

function isRate(value: number) {
  return value >= 0 && value <= 1;
}

function isZeroSummary(summary: PlatformAiUsageSummary) {
  return summary.totalCalls === 0
    && summary.totalTokens === 0
    && summary.successRate === 0
    && summary.averageLatencyMs === 0
    && summary.estimatedCostCny === 0;
}

function hasValidRatesAndLatency(payload: PlatformAiUsageCostResponse) {
  const rows = [
    { successRate: payload.summary.successRate, averageLatencyMs: payload.summary.averageLatencyMs },
    ...payload.providerModelRows.map((row) => ({
      successRate: row.successRate,
      averageLatencyMs: row.averageLatencyMs,
    })),
    ...payload.scenarioRows.map((row) => ({
      successRate: row.successRate,
      averageLatencyMs: 0,
    })),
  ];

  return rows.every((row) => isRate(row.successRate) && row.averageLatencyMs >= 0);
}

function hasProviderAggregationMatch(payload: PlatformAiUsageCostResponse) {
  const totals = payload.providerModelRows.reduce((result, row) => ({
    calls: result.calls + row.calls,
    tokens: result.tokens + row.totalTokens,
    cost: result.cost + row.estimatedCostCny,
  }), { calls: 0, tokens: 0, cost: 0 });

  return payload.summary.totalCalls === totals.calls
    && payload.summary.totalTokens === totals.tokens
    && Math.abs(payload.summary.estimatedCostCny - totals.cost) <= 0.005;
}

export function normalizePlatformAiUsageMonth(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return controlledMonths.has(normalized) ? normalized : PLATFORM_AI_USAGE_DEFAULT_MONTH;
}

export function getPlatformAiUsageCostResponse(params: { month?: string | null } = {}): PlatformAiUsageCostResponse {
  const selectedMonth = normalizePlatformAiUsageMonth(params.month);
  const monthMeta = PLATFORM_AI_USAGE_AVAILABLE_MONTHS.find((month) => month.value === selectedMonth);
  const hasUsageData = Boolean(monthMeta?.hasUsageData);

  return {
    readonly: true,
    dataSource: 'controlled_demo',
    usageVersion: 'ai-usage-cost-v1-controlled-demo',
    usageStatus: 'controlled_readonly_demo',
    availableMonths: PLATFORM_AI_USAGE_AVAILABLE_MONTHS,
    selectedMonth,
    hasUsageData,
    emptyState: hasUsageData ? null : {
      title: '暂无受控示例用量',
      description: `${monthMeta?.label ?? selectedMonth}为受控示例月份，未读取真实 AI 日志；估算费用不是正式账单。`,
    },
    summary: hasUsageData
      ? { ...platformAiUsageCostSampleData.summary, month: selectedMonth }
      : emptySummary(selectedMonth),
    providerModelRows: hasUsageData ? platformAiUsageCostSampleData.providerModelRows : [],
    scenarioRows: hasUsageData ? platformAiUsageCostSampleData.scenarioRows : [],
    sampleInstitutionRanking: hasUsageData ? platformAiUsageCostSampleData.sampleInstitutionRanking : [],
    costDisclaimer: PLATFORM_AI_USAGE_COST_DISCLAIMER,
    futureLogFieldSpec: platformAiFutureLogFieldSpec,
  };
}

export function validatePlatformAiUsageCostContract(
  payload: PlatformAiUsageCostResponse,
): PlatformAiUsageCostValidationResult {
  const errors: string[] = [];
  const selectedMonthMeta = payload.availableMonths.find((month) => month.value === payload.selectedMonth);

  if (!selectedMonthMeta) {
    errors.push('selectedMonth 必须来自 availableMonths');
  }

  if (!hasValidRatesAndLatency(payload)) {
    if (!isRate(payload.summary.successRate)
      || payload.providerModelRows.some((row) => !isRate(row.successRate))
      || payload.scenarioRows.some((row) => !isRate(row.successRate))) {
      errors.push('successRate 必须在 0 到 1');
    }

    if (payload.summary.averageLatencyMs < 0
      || payload.providerModelRows.some((row) => row.averageLatencyMs < 0)) {
      errors.push('averageLatencyMs 不得为负数');
    }
  }

  if (payload.hasUsageData) {
    if (!hasProviderAggregationMatch(payload)) {
      errors.push('有数据月份 summary 必须与 providerModelRows 汇总一致');
    }
  } else if (
    !isZeroSummary(payload.summary)
    || payload.providerModelRows.length > 0
    || payload.scenarioRows.length > 0
    || payload.sampleInstitutionRanking.length > 0
  ) {
    errors.push('无数据月份 summary 必须归零且明细为空');
  }

  if (!payload.costDisclaimer.includes('估算费用不是正式账单')) {
    errors.push('costDisclaimer 必须包含“估算费用不是正式账单”');
  }

  const futureSpecText = JSON.stringify(payload.futureLogFieldSpec);
  const hasSensitiveFieldPolicy = payload.futureLogFieldSpec.some((field) => field.field === 'sensitiveFieldPolicy');
  if (!hasSensitiveFieldPolicy || !futureSpecText.includes('敏感字段不展示原文')) {
    errors.push('futureLogFieldSpec 必须说明敏感字段不展示原文');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
