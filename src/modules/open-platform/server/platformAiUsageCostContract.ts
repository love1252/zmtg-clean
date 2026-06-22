import {
  platformAiFutureLogFieldSpec,
  type PlatformAiFutureLogFieldSpec,
  type PlatformAiDailyUsage,
  type PlatformAiProviderModelUsage,
  type PlatformAiProviderUsageGroup,
  type PlatformAiSampleInstitutionUsage,
  type PlatformAiScenarioUsage,
  type PlatformAiUsageAvailableMonth,
  type PlatformAiUsageSummary,
} from '@/modules/open-platform/mock/platformAiUsageCost';

export type PlatformAiUsageCostResponse = {
  readonly: true;
  dataSource: 'unconnected';
  usageVersion: 'ai-usage-cost-v1-unconnected';
  usageStatus: 'not_connected';
  availableMonths: PlatformAiUsageAvailableMonth[];
  selectedMonth: string;
  usageDate: string | null;
  hasUsageData: boolean;
  emptyState: {
    title: string;
    description: string;
  };
  summary: PlatformAiUsageSummary;
  providerModelRows: PlatformAiProviderModelUsage[];
  dailyRows: PlatformAiDailyUsage[];
  providerUsageGroups: PlatformAiProviderUsageGroup[];
  scenarioRows: PlatformAiScenarioUsage[];
  sampleInstitutionRanking: PlatformAiSampleInstitutionUsage[];
  costDisclaimer: string;
  futureLogFieldSpec: PlatformAiFutureLogFieldSpec[];
};

export type PlatformAiUsageCostValidationResult = {
  ok: boolean;
  errors: string[];
};

const defaultUsageMonth = '2026-06';
const safeMonthPattern = /^(\d{4})-(\d{2})$/;
const usageDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const emptyState = {
  title: '暂无真实 AI 用量记录',
  description: '当前未接入真实 AI 调用日志；不会展示预置用量、机构排行或估算账单。',
};
const costDisclaimer = '当前未接入真实 AI 调用日志；估算费用不是正式账单，仅供后续运营口径占位。';

function emptySummary(month: string): PlatformAiUsageSummary {
  return {
    month,
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    successRate: 0,
    averageLatencyMs: 0,
    estimatedCostCny: 0,
    peakDayCostCny: 0,
  };
}

function isSafeMonth(value: string) {
  const match = safeMonthPattern.exec(value);
  if (!match) return false;

  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

function isRate(value: number) {
  return value >= 0 && value <= 1;
}

function isZeroSummary(summary: PlatformAiUsageSummary) {
  return summary.totalCalls === 0
    && summary.successCalls === 0
    && summary.failedCalls === 0
    && summary.inputTokens === 0
    && summary.outputTokens === 0
    && summary.totalTokens === 0
    && summary.successRate === 0
    && summary.averageLatencyMs === 0
    && summary.estimatedCostCny === 0
    && summary.peakDayCostCny === 0;
}

function hasNoUsageRows(payload: PlatformAiUsageCostResponse) {
  return payload.providerModelRows.length === 0
    && payload.dailyRows.length === 0
    && payload.providerUsageGroups.length === 0
    && payload.scenarioRows.length === 0
    && payload.sampleInstitutionRanking.length === 0;
}

export function normalizePlatformAiUsageMonth(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return isSafeMonth(normalized) ? normalized : defaultUsageMonth;
}

export function normalizePlatformAiUsageDate(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  const match = usageDatePattern.exec(normalized);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (
    date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() + 1 !== Number(month)
    || date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return normalized;
}

function formatUsageMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-');
  return `${year}年${monthNumber}月`;
}

export function getPlatformAiUsageCostResponse(params: { month?: string | null; usageDate?: string | null } = {}): PlatformAiUsageCostResponse {
  const usageDate = normalizePlatformAiUsageDate(params.usageDate);
  const selectedMonth = usageDate ? usageDate.slice(0, 7) : normalizePlatformAiUsageMonth(params.month);

  return {
    readonly: true,
    dataSource: 'unconnected',
    usageVersion: 'ai-usage-cost-v1-unconnected',
    usageStatus: 'not_connected',
    availableMonths: [
      { value: selectedMonth, label: formatUsageMonthLabel(selectedMonth), hasUsageData: false },
    ],
    selectedMonth,
    usageDate,
    hasUsageData: false,
    emptyState,
    summary: emptySummary(selectedMonth),
    providerModelRows: [],
    dailyRows: [],
    providerUsageGroups: [],
    scenarioRows: [],
    sampleInstitutionRanking: [],
    costDisclaimer,
    futureLogFieldSpec: platformAiFutureLogFieldSpec,
  };
}

export function validatePlatformAiUsageCostContract(
  payload: PlatformAiUsageCostResponse,
): PlatformAiUsageCostValidationResult {
  const errors: string[] = [];

  if (!isSafeMonth(payload.selectedMonth)) {
    errors.push('selectedMonth 必须是 YYYY-MM 安全月份');
  }

  if (payload.dataSource !== 'unconnected' || payload.usageStatus !== 'not_connected') {
    errors.push('未接入状态必须标记为 not_connected');
  }

  if (!isRate(payload.summary.successRate) || payload.summary.averageLatencyMs < 0) {
    errors.push('successRate 必须在 0 到 1');
  }

  if (!isZeroSummary(payload.summary) || !hasNoUsageRows(payload) || payload.hasUsageData) {
    errors.push('未接入状态 summary 必须归零且明细为空');
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
