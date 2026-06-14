export type PlatformAiUsageAvailableMonth = {
  value: string;
  label: string;
  hasUsageData: boolean;
};

export type PlatformAiUsageSummary = {
  month: string;
  totalCalls: number;
  totalTokens: number;
  successRate: number;
  averageLatencyMs: number;
  estimatedCostCny: number;
};

export type PlatformAiProviderModelUsage = {
  providerName: string;
  modelName: string;
  calls: number;
  totalTokens: number;
  successRate: number;
  averageLatencyMs: number;
  estimatedCostCny: number;
};

export type PlatformAiScenarioUsage = {
  scenarioName: string;
  calls: number;
  totalTokens: number;
  successRate: number;
  estimatedCostCny: number;
};

export type PlatformAiSampleInstitutionUsage = {
  institutionName: string;
  calls: number;
  totalTokens: number;
  estimatedCostCny: number;
};

export type PlatformAiFutureLogFieldSpec = {
  field: string;
  description: string;
  sensitiveFieldPolicy: string;
};

export type PlatformAiUsageCostSampleData = {
  summary: PlatformAiUsageSummary;
  providerModelRows: PlatformAiProviderModelUsage[];
  scenarioRows: PlatformAiScenarioUsage[];
  sampleInstitutionRanking: PlatformAiSampleInstitutionUsage[];
};

export const PLATFORM_AI_USAGE_DEFAULT_MONTH = '2026-06';

export const PLATFORM_AI_USAGE_AVAILABLE_MONTHS: PlatformAiUsageAvailableMonth[] = [
  { value: '2026-06', label: '2026年06月', hasUsageData: true },
  { value: '2026-05', label: '2026年05月', hasUsageData: false },
];

export const PLATFORM_AI_USAGE_COST_DISCLAIMER = '当前为受控示例用量，估算费用不是正式账单，仅供运营参考。';

export const platformAiUsageCostSampleData: PlatformAiUsageCostSampleData = {
  summary: {
    month: PLATFORM_AI_USAGE_DEFAULT_MONTH,
    totalCalls: 186,
    totalTokens: 58240,
    successRate: 0.973,
    averageLatencyMs: 842,
    estimatedCostCny: 1.86,
  },
  providerModelRows: [
    {
      providerName: '通义千问',
      modelName: 'Qwen Plus 示例',
      calls: 118,
      totalTokens: 36520,
      successRate: 0.983,
      averageLatencyMs: 780,
      estimatedCostCny: 1.08,
    },
    {
      providerName: 'DeepSeek',
      modelName: 'DeepSeek Reasoner 示例',
      calls: 42,
      totalTokens: 16220,
      successRate: 0.952,
      averageLatencyMs: 1060,
      estimatedCostCny: 0.62,
    },
    {
      providerName: '豆包',
      modelName: '豆包视觉理解示例',
      calls: 26,
      totalTokens: 5500,
      successRate: 0.962,
      averageLatencyMs: 690,
      estimatedCostCny: 0.16,
    },
  ],
  scenarioRows: [
    {
      scenarioName: '客户互动与客服回复',
      calls: 86,
      totalTokens: 24180,
      successRate: 0.988,
      estimatedCostCny: 0.74,
    },
    {
      scenarioName: '知识库问答',
      calls: 54,
      totalTokens: 17860,
      successRate: 0.963,
      estimatedCostCny: 0.52,
    },
    {
      scenarioName: '工作流判断',
      calls: 46,
      totalTokens: 16200,
      successRate: 0.956,
      estimatedCostCny: 0.6,
    },
  ],
  sampleInstitutionRanking: [
    {
      institutionName: '示例机构 A',
      calls: 72,
      totalTokens: 22100,
      estimatedCostCny: 0.71,
    },
    {
      institutionName: '示例机构 B',
      calls: 61,
      totalTokens: 18420,
      estimatedCostCny: 0.58,
    },
    {
      institutionName: '示例机构 C',
      calls: 53,
      totalTokens: 17720,
      estimatedCostCny: 0.57,
    },
  ],
};

export const platformAiFutureLogFieldSpec: PlatformAiFutureLogFieldSpec[] = [
  { field: 'tenantScope', description: '未来日志的租户范围标签，仅保留低敏范围类型。', sensitiveFieldPolicy: '敏感字段不展示原文。' },
  { field: 'provider', description: '模型厂商标识。', sensitiveFieldPolicy: '仅展示低敏枚举。' },
  { field: 'modelId', description: 'registry 中的模型标识。', sensitiveFieldPolicy: '不包含凭据。' },
  { field: 'scenario', description: '业务场景标识。', sensitiveFieldPolicy: '不展示业务输入原文。' },
  { field: 'source', description: '调用来源类型。', sensitiveFieldPolicy: '仅展示低敏来源枚举。' },
  { field: 'status', description: '调用状态。', sensitiveFieldPolicy: '不展示 provider error 原文。' },
  { field: 'latencyMs', description: '调用耗时毫秒数。', sensitiveFieldPolicy: '数值型指标。' },
  { field: 'inputTokens', description: '输入 token 数。', sensitiveFieldPolicy: '数值型指标。' },
  { field: 'outputTokens', description: '输出 token 数。', sensitiveFieldPolicy: '数值型指标。' },
  { field: 'totalTokens', description: '总 token 数。', sensitiveFieldPolicy: '数值型指标。' },
  { field: 'estimatedCostCny', description: '按示例定价版本计算的估算费用。', sensitiveFieldPolicy: '估算费用不是正式账单。' },
  { field: 'pricingVersion', description: '估算费用使用的定价版本。', sensitiveFieldPolicy: '不代表结算版本。' },
  { field: 'billable', description: '未来是否进入计费口径的布尔占位。', sensitiveFieldPolicy: 'AI-3 不启用正式计费。' },
  { field: 'createdAt', description: '未来日志创建时间。', sensitiveFieldPolicy: '时间戳不携带请求内容。' },
  { field: 'sensitiveFieldPolicy', description: '统一说明敏感字段不展示原文。', sensitiveFieldPolicy: '敏感字段不展示原文。' },
];
