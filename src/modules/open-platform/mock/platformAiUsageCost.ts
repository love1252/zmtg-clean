export type PlatformAiUsageAvailableMonth = {
  value: string;
  label: string;
  hasUsageData: boolean;
};

export type PlatformAiUsageSummary = {
  month: string;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  successRate: number;
  averageLatencyMs: number;
  estimatedCostCny: number;
  peakDayCostCny: number;
};

export type PlatformAiProviderModelUsage = {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  successRate: number;
  averageLatencyMs: number;
  estimatedCostCny: number;
  costShare: number;
  callShare: number;
};

export type PlatformAiScenarioUsage = {
  scenarioId: string;
  scenarioName: string;
  description: string;
  sourceScenarios: string[];
  calls: number;
  totalTokens: number;
  successRate: number;
  estimatedCostCny: number;
};

export type PlatformAiDailyModelCost = {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  calls: number;
  totalTokens: number;
  estimatedCostCny: number;
};

export type PlatformAiDailyUsage = {
  date: string;
  label: string;
  calls: number;
  totalTokens: number;
  estimatedCostCny: number;
  modelCosts: PlatformAiDailyModelCost[];
};

export type PlatformAiProviderUsageGroup = {
  providerId: string;
  providerName: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  successRate: number;
  averageLatencyMs: number;
  estimatedCostCny: number;
  costShare: number;
  models: PlatformAiProviderModelUsage[];
};

export type PlatformAiTenantScenarioUsage = {
  scenarioName: string;
  calls: number;
  totalTokens: number;
  estimatedCostCny: number;
};

export type PlatformAiSampleInstitutionUsage = {
  institutionName: string;
  calls: number;
  totalTokens: number;
  estimatedCostCny: number;
  scenarios: PlatformAiTenantScenarioUsage[];
};

export type PlatformAiFutureLogFieldSpec = {
  field: string;
  description: string;
  sensitiveFieldPolicy: string;
};

export type PlatformAiUsageCostSampleData = {
  summary: PlatformAiUsageSummary;
  providerModelRows: PlatformAiProviderModelUsage[];
  dailyRows: PlatformAiDailyUsage[];
  providerUsageGroups: PlatformAiProviderUsageGroup[];
  scenarioRows: PlatformAiScenarioUsage[];
  sampleInstitutionRanking: PlatformAiSampleInstitutionUsage[];
};

export const PLATFORM_AI_USAGE_DEFAULT_MONTH = '2026-05';

export const PLATFORM_AI_USAGE_AVAILABLE_MONTHS: PlatformAiUsageAvailableMonth[] = [
  { value: '2026-05', label: '2026年05月', hasUsageData: true },
  { value: '2026-06', label: '2026年06月', hasUsageData: false },
];

export const PLATFORM_AI_USAGE_COST_DISCLAIMER = '当前为受控示例用量，估算费用不是正式账单，仅供运营参考。';

export const platformAiUsageCostSampleData: PlatformAiUsageCostSampleData = {
  summary: {
    month: PLATFORM_AI_USAGE_DEFAULT_MONTH,
    totalCalls: 49,
    successCalls: 39,
    failedCalls: 10,
    inputTokens: 11055,
    outputTokens: 3904,
    totalTokens: 14959,
    successRate: 0.796,
    averageLatencyMs: 2936,
    estimatedCostCny: 0.0499,
    peakDayCostCny: 0.0405,
  },
  providerModelRows: [
    {
      providerId: 'qwen',
      providerName: '通义千问',
      modelId: 'qwen-plus-latest',
      modelName: 'Qwen Plus',
      calls: 19,
      inputTokens: 8475,
      outputTokens: 2321,
      totalTokens: 10796,
      successRate: 1,
      averageLatencyMs: 3485,
      estimatedCostCny: 0.0266,
      costShare: 65.8,
      callShare: 38.8,
    },
    {
      providerId: 'qwen',
      providerName: '通义千问',
      modelId: 'qwen3.6-plus',
      modelName: 'Qwen3.6 Plus',
      calls: 2,
      inputTokens: 36,
      outputTokens: 610,
      totalTokens: 646,
      successRate: 1,
      averageLatencyMs: 6368,
      estimatedCostCny: 0.0112,
      costShare: 27.6,
      callShare: 4.1,
    },
    {
      providerId: 'qwen',
      providerName: '通义千问',
      modelId: 'qwen-vl-ocr-latest',
      modelName: 'Qwen VL OCR',
      calls: 2,
      inputTokens: 602,
      outputTokens: 29,
      totalTokens: 631,
      successRate: 1,
      averageLatencyMs: 731,
      estimatedCostCny: 0.0013,
      costShare: 3.3,
      callShare: 4.1,
    },
    {
      providerId: 'qwen',
      providerName: '通义千问',
      modelId: 'qwen3.6-flash',
      modelName: 'Qwen3.6 Flash',
      calls: 1,
      inputTokens: 17,
      outputTokens: 215,
      totalTokens: 232,
      successRate: 1,
      averageLatencyMs: 2052,
      estimatedCostCny: 0.0013,
      costShare: 3.2,
      callShare: 2,
    },
    {
      providerId: 'qwen',
      providerName: '通义千问',
      modelId: 'qwen3-vl-flash',
      modelName: 'Qwen3-VL Flash',
      calls: 1,
      inputTokens: 15,
      outputTokens: 4,
      totalTokens: 19,
      successRate: 1,
      averageLatencyMs: 362,
      estimatedCostCny: 0.0001,
      costShare: 0.1,
      callShare: 2,
    },
    {
      providerId: 'qwen',
      providerName: '通义千问',
      modelId: 'qwen-max-standby',
      modelName: 'Qwen Max',
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      successRate: 0,
      averageLatencyMs: 0,
      estimatedCostCny: 0,
      costShare: 0,
      callShare: 0,
    },
    {
      providerId: 'qwen',
      providerName: '通义千问',
      modelId: 'qwen-turbo-standby',
      modelName: 'Qwen Turbo',
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      successRate: 0,
      averageLatencyMs: 0,
      estimatedCostCny: 0,
      costShare: 0,
      callShare: 0,
    },
    {
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      modelId: 'deepseek-v4-flash',
      modelName: 'DeepSeek V4 Flash',
      calls: 11,
      inputTokens: 1110,
      outputTokens: 773,
      totalTokens: 1883,
      successRate: 0.818,
      averageLatencyMs: 1240,
      estimatedCostCny: 0.0036,
      costShare: 7.2,
      callShare: 22.4,
    },
    {
      providerId: 'doubao',
      providerName: '豆包',
      modelId: 'doubao-seed-1-8',
      modelName: 'Seed 1.8',
      calls: 4,
      inputTokens: 201,
      outputTokens: 81,
      totalTokens: 282,
      successRate: 0.75,
      averageLatencyMs: 980,
      estimatedCostCny: 0.0031,
      costShare: 6.1,
      callShare: 8.2,
    },
    {
      providerId: 'chatglm',
      providerName: '智谱GLM',
      modelId: 'glm-4-plus-250120',
      modelName: 'glm-4-plus-250120',
      calls: 7,
      inputTokens: 470,
      outputTokens: 0,
      totalTokens: 470,
      successRate: 0.286,
      averageLatencyMs: 1460,
      estimatedCostCny: 0.0027,
      costShare: 5.5,
      callShare: 14.3,
    },
    {
      providerId: 'kimi',
      providerName: 'Kimi',
      modelId: 'kimi-k2.5',
      modelName: 'Kimi K2.5',
      calls: 2,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      successRate: 0,
      averageLatencyMs: 0,
      estimatedCostCny: 0,
      costShare: 0,
      callShare: 4.1,
    },
  ],
  dailyRows: [
    {
      date: '2026-05-18',
      label: '18',
      calls: 2,
      totalTokens: 317,
      estimatedCostCny: 0.0005,
      modelCosts: [
        { providerId: 'deepseek', providerName: 'DeepSeek', modelId: 'deepseek-v4-flash', modelName: 'DeepSeek V4 Flash', calls: 2, totalTokens: 317, estimatedCostCny: 0.0005 },
      ],
    },
    {
      date: '2026-05-19',
      label: '19',
      calls: 49,
      totalTokens: 14959,
      estimatedCostCny: 0.0405,
      modelCosts: [
        { providerId: 'qwen', providerName: '通义千问', modelId: 'qwen-plus-latest', modelName: 'Qwen Plus', calls: 16, totalTokens: 10597, estimatedCostCny: 0.0261 },
        { providerId: 'qwen', providerName: '通义千问', modelId: 'qwen3.6-plus', modelName: 'Qwen3.6 Plus', calls: 2, totalTokens: 646, estimatedCostCny: 0.0112 },
        { providerId: 'qwen', providerName: '通义千问', modelId: 'qwen-vl-ocr-latest', modelName: 'Qwen VL OCR', calls: 2, totalTokens: 631, estimatedCostCny: 0.0013 },
        { providerId: 'qwen', providerName: '通义千问', modelId: 'qwen3.6-flash', modelName: 'Qwen3.6 Flash', calls: 1, totalTokens: 232, estimatedCostCny: 0.0013 },
        { providerId: 'deepseek', providerName: 'DeepSeek', modelId: 'deepseek-v4-flash', modelName: 'DeepSeek V4 Flash', calls: 2, totalTokens: 317, estimatedCostCny: 0.0005 },
        { providerId: 'qwen', providerName: '通义千问', modelId: 'qwen3-vl-flash', modelName: 'Qwen3-VL Flash', calls: 1, totalTokens: 19, estimatedCostCny: 0 },
        { providerId: 'kimi', providerName: 'Kimi', modelId: 'kimi-k2.5', modelName: 'Kimi K2.5', calls: 1, totalTokens: 0, estimatedCostCny: 0 },
        { providerId: 'chatglm', providerName: '智谱GLM', modelId: 'glm-4-plus-250120', modelName: 'glm-4-plus-250120', calls: 1, totalTokens: 0, estimatedCostCny: 0 },
        { providerId: 'doubao', providerName: '豆包', modelId: 'doubao-seed-1-8', modelName: 'Seed 1.8', calls: 1, totalTokens: 0, estimatedCostCny: 0 },
      ],
    },
    {
      date: '2026-05-20',
      label: '20',
      calls: 2,
      totalTokens: 631,
      estimatedCostCny: 0.0013,
      modelCosts: [
        { providerId: 'qwen', providerName: '通义千问', modelId: 'qwen-vl-ocr-latest', modelName: 'Qwen VL OCR', calls: 2, totalTokens: 631, estimatedCostCny: 0.0013 },
      ],
    },
    {
      date: '2026-05-21',
      label: '21',
      calls: 8,
      totalTokens: 1883,
      estimatedCostCny: 0.0076,
      modelCosts: [
        { providerId: 'doubao', providerName: '豆包', modelId: 'doubao-seed-1-8', modelName: 'Seed 1.8', calls: 4, totalTokens: 282, estimatedCostCny: 0.0031 },
        { providerId: 'chatglm', providerName: '智谱GLM', modelId: 'glm-4-plus-250120', modelName: 'glm-4-plus-250120', calls: 4, totalTokens: 470, estimatedCostCny: 0.0027 },
        { providerId: 'qwen', providerName: '通义千问', modelId: 'qwen3.6-flash', modelName: 'Qwen3.6 Flash', calls: 1, totalTokens: 232, estimatedCostCny: 0.0013 },
        { providerId: 'deepseek', providerName: 'DeepSeek', modelId: 'deepseek-v4-flash', modelName: 'DeepSeek V4 Flash', calls: 1, totalTokens: 317, estimatedCostCny: 0.0005 },
      ],
    },
  ],
  providerUsageGroups: [
    {
      providerId: 'qwen',
      providerName: '通义千问',
      calls: 25,
      inputTokens: 9145,
      outputTokens: 3179,
      totalTokens: 12324,
      successRate: 1,
      averageLatencyMs: 3313,
      estimatedCostCny: 0.0405,
      costShare: 81.2,
      models: [],
    },
    {
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      calls: 11,
      inputTokens: 1110,
      outputTokens: 773,
      totalTokens: 1883,
      successRate: 0.818,
      averageLatencyMs: 1240,
      estimatedCostCny: 0.0036,
      costShare: 7.2,
      models: [],
    },
    {
      providerId: 'doubao',
      providerName: '豆包',
      calls: 4,
      inputTokens: 201,
      outputTokens: 81,
      totalTokens: 282,
      successRate: 0.75,
      averageLatencyMs: 980,
      estimatedCostCny: 0.0031,
      costShare: 6.1,
      models: [],
    },
    {
      providerId: 'chatglm',
      providerName: '智谱GLM',
      calls: 7,
      inputTokens: 470,
      outputTokens: 0,
      totalTokens: 470,
      successRate: 0.286,
      averageLatencyMs: 1460,
      estimatedCostCny: 0.0027,
      costShare: 5.5,
      models: [],
    },
    {
      providerId: 'kimi',
      providerName: 'Kimi',
      calls: 2,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      successRate: 0,
      averageLatencyMs: 0,
      estimatedCostCny: 0,
      costShare: 0,
      models: [],
    },
  ],
  scenarioRows: [
    {
      scenarioId: 'customer_interaction',
      scenarioName: '客户互动与客服回复',
      description: '统计客户咨询、客服辅助回复、流式对话输出和企微自动回复等客户沟通类 AI 消耗。',
      sourceScenarios: ['AI对话 18次', '企微自动回复 1次'],
      calls: 19,
      totalTokens: 3397,
      successRate: 0.842,
      estimatedCostCny: 0.0211,
    },
    {
      scenarioId: 'knowledge_qa',
      scenarioName: '知识库问答',
      description: '统计基于知识库检索后的问答、测试问答和智能体引用知识库回答产生的 AI 消耗。',
      sourceScenarios: ['知识库测试问答 6次', '知识库问答 1次'],
      calls: 7,
      totalTokens: 9475,
      successRate: 1,
      estimatedCostCny: 0.0194,
    },
    {
      scenarioId: 'system_health_test',
      scenarioName: '系统测试与健康检查',
      description: '统计平台连通性测试、模型健康检查和冒烟测试等非业务生产调用。',
      sourceScenarios: ['AI连通性测试 14次', 'P5冒烟测试 1次'],
      calls: 15,
      totalTokens: 920,
      successRate: 0.6,
      estimatedCostCny: 0.0045,
    },
    {
      scenarioId: 'general_chat',
      scenarioName: 'general chat',
      description: '未归类到固定业务口径的动态 AI 调用场景。',
      sourceScenarios: [],
      calls: 4,
      totalTokens: 219,
      successRate: 0.75,
      estimatedCostCny: 0.0031,
    },
    {
      scenarioId: 'knowledge_visual_ocr',
      scenarioName: '知识库视觉识别',
      description: '统计图片、扫描件和图文资料页等视觉识别与 OCR 提取产生的 AI 消耗。',
      sourceScenarios: [],
      calls: 2,
      totalTokens: 631,
      successRate: 1,
      estimatedCostCny: 0.0013,
    },
    {
      scenarioId: 'journey_automation',
      scenarioName: '旅程自动化',
      description: '统计旅程节点中的 AI 文案、条件判断、分支决策和自动化执行分析消耗。',
      sourceScenarios: [],
      calls: 2,
      totalTokens: 317,
      successRate: 1,
      estimatedCostCny: 0.0005,
    },
    {
      scenarioId: 'customer_analysis_prediction',
      scenarioName: '客户分析与预警',
      description: '统计客户画像、标签建议、流失预警和运营洞察分析等客户增长类 AI 消耗。',
      sourceScenarios: [],
      calls: 0,
      totalTokens: 0,
      successRate: 0,
      estimatedCostCny: 0,
    },
    {
      scenarioId: 'marketing_copy_generation',
      scenarioName: '营销文案生成',
      description: '统计活动文案、营销话术、推送内容和增长运营素材生成类 AI 消耗。',
      sourceScenarios: [],
      calls: 0,
      totalTokens: 0,
      successRate: 0,
      estimatedCostCny: 0,
    },
    {
      scenarioId: 'knowledge_training',
      scenarioName: '知识库训练',
      description: '统计知识库结构化、标注辅助和训练前检查等离线准备类 AI 消耗。',
      sourceScenarios: [],
      calls: 0,
      totalTokens: 0,
      successRate: 0,
      estimatedCostCny: 0,
    },
    {
      scenarioId: 'ai_appointment_assistant',
      scenarioName: 'AI预约助手',
      description: '统计预约意向识别、预约时间建议和到院提醒辅助相关 AI 消耗。',
      sourceScenarios: [],
      calls: 0,
      totalTokens: 0,
      successRate: 0,
      estimatedCostCny: 0,
    },
    {
      scenarioId: 'operation_summary',
      scenarioName: '运营摘要',
      description: '统计运营复盘、日报摘要和管理看板文字生成等总结类 AI 消耗。',
      sourceScenarios: [],
      calls: 0,
      totalTokens: 0,
      successRate: 0,
      estimatedCostCny: 0,
    },
  ],
  sampleInstitutionRanking: [
    {
      institutionName: '智美天工医美智能运营系统',
      calls: 49,
      totalTokens: 14959,
      estimatedCostCny: 0.0499,
      scenarios: [
        { scenarioName: '客户互动与客服回复', calls: 19, totalTokens: 3397, estimatedCostCny: 0.0211 },
        { scenarioName: '知识库问答', calls: 7, totalTokens: 9475, estimatedCostCny: 0.0194 },
        { scenarioName: '系统测试与健康检查', calls: 15, totalTokens: 920, estimatedCostCny: 0.0045 },
        { scenarioName: 'general chat', calls: 4, totalTokens: 219, estimatedCostCny: 0.0031 },
        { scenarioName: '知识库视觉识别', calls: 2, totalTokens: 631, estimatedCostCny: 0.0013 },
        { scenarioName: '旅程自动化', calls: 2, totalTokens: 317, estimatedCostCny: 0.0005 },
      ],
    },
  ],
};

platformAiUsageCostSampleData.providerUsageGroups = platformAiUsageCostSampleData.providerUsageGroups.map((provider) => ({
  ...provider,
  models: platformAiUsageCostSampleData.providerModelRows.filter((row) => row.providerId === provider.providerId),
}));

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
