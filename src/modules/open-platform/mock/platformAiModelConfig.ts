export type PlatformAiModelConfigCapabilityId = 'reasoning' | 'text' | 'vision' | 'embedding';

export type PlatformAiModelConfigDryRunStatus = 'dry_run' | 'disabled' | 'not_available';

export type PlatformAiModelConfigModel = {
  modelId: string;
  displayName: string;
  description: string;
  pricingLabel: string;
  contextWindowLabel: string;
  capabilityIds: PlatformAiModelConfigCapabilityId[];
  enabled: boolean;
  testStatus: PlatformAiModelConfigDryRunStatus;
};

export type PlatformAiModelConfigKeyStatus = {
  kind: 'masked_configured' | 'not_configured' | 'disabled';
  maskedLabel: string;
};

export type PlatformAiModelConfigProvider = {
  providerId: string;
  providerName: string;
  logoText: string;
  logoClassName: string;
  keyStatus: PlatformAiModelConfigKeyStatus;
  syncStatus: PlatformAiModelConfigDryRunStatus;
  models: PlatformAiModelConfigModel[];
};

export type PlatformAiModelConfigScenarioDefault = {
  scenarioId: string;
  scenarioName: string;
  description: string;
  requiredCapability: PlatformAiModelConfigCapabilityId;
  defaultModelId: string;
  defaultModelName: string;
};

export type PlatformAiModelConfigAgentInheritance = {
  agentId: string;
  agentName: string;
  agentDescription: string;
  inheritsScenarioId: string;
  inheritsScenarioName: string;
  inheritedModelId: string;
  inheritedModelName: string;
};

export type PlatformAiModelConfigData = {
  configVersion: string;
  title: string;
  subtitle: string;
  readonlyNote: string;
  summary: {
    enabledModelCount: number;
    configuredProviderCount: number;
    defaultScenarioCount: number;
  };
  capabilityOrder: PlatformAiModelConfigCapabilityId[];
  capabilityLabels: Record<PlatformAiModelConfigCapabilityId, string>;
  providers: PlatformAiModelConfigProvider[];
  scenarioDefaults: PlatformAiModelConfigScenarioDefault[];
  agentInheritance: PlatformAiModelConfigAgentInheritance[];
};

function withDryRunModelStatus(
  models: Array<Omit<PlatformAiModelConfigModel, 'testStatus'>>,
): PlatformAiModelConfigModel[] {
  return models.map((model) => ({ ...model, testStatus: 'dry_run' }));
}

export const platformAiModelConfigData: PlatformAiModelConfigData = {
  configVersion: 'old-ai-model-config-parity-v1',
  title: 'AI模型',
  subtitle: '配置平台AI模型提供商，支持豆包、DeepSeek、千问、Kimi',
  readonlyNote: '当前为受控配置界面：Key 不在前端展示；同步和测试由服务端受控执行，并返回低敏状态。',
  summary: {
    enabledModelCount: 10,
    configuredProviderCount: 5,
    defaultScenarioCount: 8,
  },
  capabilityOrder: ['reasoning', 'text', 'vision', 'embedding'],
  capabilityLabels: {
    reasoning: '深度思考',
    text: '文本生成',
    vision: '视觉理解',
    embedding: '向量模型',
  },
  providers: [
    {
      providerId: 'doubao',
      providerName: '豆包',
      logoText: '豆',
      logoClassName: 'bg-orange-500',
      keyStatus: { kind: 'masked_configured', maskedLabel: 'Key 已配置 ****9821' },
      syncStatus: 'dry_run',
      models: withDryRunModelStatus([
        { modelId: 'doubao-seed-2-0-pro-260215', displayName: 'Seed Pro 2.0', description: '旗舰级全能通用模型', pricingLabel: '按量计费', contextWindowLabel: '256K', capabilityIds: ['text', 'reasoning', 'vision'], enabled: true },
        { modelId: 'doubao-seed-2-0-lite-260215', displayName: 'Seed Lite 2.0', description: '均衡型模型，适合高频客服与随访', pricingLabel: '按量计费', contextWindowLabel: '128K', capabilityIds: ['text', 'reasoning'], enabled: true },
        { modelId: 'doubao-seed-2-0-mini-260215', displayName: 'Seed Mini 2.0', description: '轻量级高并发', pricingLabel: '按量计费', contextWindowLabel: '32K', capabilityIds: ['text'], enabled: false },
        { modelId: 'doubao-seed-1-8-251228', displayName: 'Seed 1.8', description: '多模态 Agent 优化', pricingLabel: '按量计费', contextWindowLabel: '128K', capabilityIds: ['text', 'vision'], enabled: false },
        { modelId: 'doubao-seed-1-6-lite-251015', displayName: 'Seed Lite 1.6', description: '高性价比文本模型', pricingLabel: '按量计费', contextWindowLabel: '32K', capabilityIds: ['text'], enabled: false },
        { modelId: 'doubao-embedding-v2', displayName: 'Doubao Embedding V2', description: '知识库向量化模型', pricingLabel: '按量计费', contextWindowLabel: '8K', capabilityIds: ['embedding'], enabled: true },
      ]),
    },
    {
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      logoText: 'D',
      logoClassName: 'bg-emerald-600',
      keyStatus: { kind: 'masked_configured', maskedLabel: 'Key 已配置 ****6630' },
      syncStatus: 'dry_run',
      models: withDryRunModelStatus([
        { modelId: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', description: '官方快速模型，适合客服、随访和运营助手', pricingLabel: '按量计费', contextWindowLabel: '64K', capabilityIds: ['text'], enabled: true },
        { modelId: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro', description: '官方高质量模型，适合复杂咨询和运营分析', pricingLabel: '按量计费', contextWindowLabel: '128K', capabilityIds: ['reasoning', 'text'], enabled: true },
        { modelId: 'deepseek-v4-260101', displayName: 'DeepSeek V4', description: '旗舰模型，深度推理能力增强', pricingLabel: '按量计费', contextWindowLabel: '256K', capabilityIds: ['reasoning', 'text', 'vision'], enabled: false },
        { modelId: 'deepseek-v3-2-251201', displayName: 'DeepSeek V3.2', description: '平衡推理与输出', pricingLabel: '按量计费', contextWindowLabel: '64K', capabilityIds: ['reasoning', 'text'], enabled: false },
        { modelId: 'deepseek-r1-250528', displayName: 'DeepSeek R1', description: '推理增强模型', pricingLabel: '按量计费', contextWindowLabel: '128K', capabilityIds: ['reasoning'], enabled: false },
        { modelId: 'deepseek-embedding', displayName: 'DeepSeek Embedding', description: '知识库向量化模型', pricingLabel: '按量计费', contextWindowLabel: '4K', capabilityIds: ['embedding'], enabled: false },
      ]),
    },
    {
      providerId: 'qwen',
      providerName: '通义千问',
      logoText: '通',
      logoClassName: 'bg-amber-500',
      keyStatus: { kind: 'masked_configured', maskedLabel: 'Key 已配置 ****4765' },
      syncStatus: 'dry_run',
      models: withDryRunModelStatus([
        { modelId: 'qwen-plus-latest', displayName: 'Qwen Plus', description: '稳定文本对话，适合知识库问答和客服回复', pricingLabel: '按量计费', contextWindowLabel: '128K', capabilityIds: ['text'], enabled: true },
        { modelId: 'qwen3.6-plus', displayName: 'Qwen3.6 Plus', description: '旗舰视觉理解，适合图片和文档图片理解', pricingLabel: '按量计费', contextWindowLabel: '256K', capabilityIds: ['vision', 'text'], enabled: false },
        { modelId: 'qwen3.6-flash', displayName: 'Qwen3.6 Flash', description: '高性价比视觉理解，适合批量图片预处理', pricingLabel: '按量计费', contextWindowLabel: '256K', capabilityIds: ['vision', 'text'], enabled: false },
        { modelId: 'qwen3-vl-plus', displayName: 'Qwen3-VL Plus', description: '通用视觉语言模型，适合图文问答', pricingLabel: '按量计费', contextWindowLabel: '256K', capabilityIds: ['vision', 'text'], enabled: true },
        { modelId: 'qwen3-vl-flash', displayName: 'Qwen3-VL Flash', description: '轻量视觉语言模型，适合批量预处理', pricingLabel: '按量计费', contextWindowLabel: '256K', capabilityIds: ['vision', 'text'], enabled: false },
        { modelId: 'qwen-vl-ocr-latest', displayName: 'Qwen VL OCR', description: 'OCR 专用，适合扫描件和文档图片文字提取', pricingLabel: '按量计费', contextWindowLabel: '38K', capabilityIds: ['vision'], enabled: false },
        { modelId: 'text-embedding-v4', displayName: 'Text Embedding V4', description: '知识库向量化模型', pricingLabel: '按量计费', contextWindowLabel: '8K', capabilityIds: ['embedding'], enabled: true },
      ]),
    },
    {
      providerId: 'chatglm',
      providerName: '智谱GLM',
      logoText: '智',
      logoClassName: 'bg-green-500',
      keyStatus: { kind: 'masked_configured', maskedLabel: 'Key 已配置 ****1048' },
      syncStatus: 'dry_run',
      models: withDryRunModelStatus([
        { modelId: 'glm-5.1', displayName: 'GLM-5.1', description: '旗舰文本与推理模型，适合复杂咨询和运营分析', pricingLabel: '按量计费', contextWindowLabel: '128K', capabilityIds: ['reasoning', 'text'], enabled: true },
        { modelId: 'glm-4.7', displayName: 'GLM-4.7', description: '编程和多步骤推理增强，适合工作流判断', pricingLabel: '按量计费', contextWindowLabel: '128K', capabilityIds: ['text', 'reasoning'], enabled: false },
        { modelId: 'glm-4.7-flash', displayName: 'GLM-4.7 Flash', description: '轻量低延迟，适合客服和批量运营任务', pricingLabel: '按量计费', contextWindowLabel: '128K', capabilityIds: ['text'], enabled: false },
        { modelId: 'embedding-3', displayName: 'Embedding-3', description: '知识库向量化模型', pricingLabel: '按量计费', contextWindowLabel: '8K', capabilityIds: ['embedding'], enabled: false },
      ]),
    },
    {
      providerId: 'kimi',
      providerName: 'Kimi',
      logoText: 'K',
      logoClassName: 'bg-blue-500',
      keyStatus: { kind: 'masked_configured', maskedLabel: 'Key 已配置 ****2390' },
      syncStatus: 'dry_run',
      models: withDryRunModelStatus([
        { modelId: 'kimi-k2-5-260127', displayName: 'Kimi K2.5', description: 'Agent 代码和长上下文任务', pricingLabel: '按量计费', contextWindowLabel: '256K', capabilityIds: ['text', 'vision', 'reasoning'], enabled: true },
        { modelId: 'kimi-embedding-v2', displayName: 'Kimi Embedding V2', description: '知识库向量化模型', pricingLabel: '按量计费', contextWindowLabel: '153K', capabilityIds: ['embedding'], enabled: false },
      ]),
    },
  ],
  scenarioDefaults: [
    { scenarioId: 'ai-customer-service', scenarioName: 'AI 客服', description: '客户咨询、项目推荐、在线回复', requiredCapability: 'text', defaultModelId: 'qwen-plus-latest', defaultModelName: 'Qwen Plus' },
    { scenarioId: 'ai-followup', scenarioName: '智能随访', description: '术后提醒、恢复指导、风险提示', requiredCapability: 'text', defaultModelId: 'doubao-seed-2-0-pro-260215', defaultModelName: 'Seed Pro 2.0' },
    { scenarioId: 'ai-appointment', scenarioName: '预约助手', description: '预约确认、排程协调、到院提醒', requiredCapability: 'text', defaultModelId: 'deepseek-v4-flash', defaultModelName: 'DeepSeek V4 Flash' },
    { scenarioId: 'knowledge-qa', scenarioName: '知识库问答', description: '基于低敏知识片段的问答', requiredCapability: 'text', defaultModelId: 'qwen-plus-latest', defaultModelName: 'Qwen Plus' },
    { scenarioId: 'knowledge-embedding', scenarioName: '知识库训练', description: '文档切片后的向量化召回', requiredCapability: 'embedding', defaultModelId: 'text-embedding-v4', defaultModelName: 'Text Embedding V4' },
    { scenarioId: 'vision-ocr', scenarioName: '视觉/OCR', description: '图片资料理解和扫描件识别占位', requiredCapability: 'vision', defaultModelId: 'qwen3-vl-plus', defaultModelName: 'Qwen3-VL Plus' },
    { scenarioId: 'workflow-decision', scenarioName: '工作流决策', description: '旅程节点条件判断和下一步建议', requiredCapability: 'reasoning', defaultModelId: 'deepseek-v4-pro', defaultModelName: 'DeepSeek V4 Pro' },
    { scenarioId: 'analytics-insight', scenarioName: '数据分析', description: '运营趋势总结和异常解释', requiredCapability: 'reasoning', defaultModelId: 'glm-5.1', defaultModelName: 'GLM-5.1' },
  ],
  agentInheritance: [
    { agentId: 'nursing-agent', agentName: '护理Agent', agentDescription: '术后护理提醒、恢复指导', inheritsScenarioId: 'ai-followup', inheritsScenarioName: '智能随访', inheritedModelId: 'doubao-seed-2-0-pro-260215', inheritedModelName: 'Seed Pro 2.0' },
    { agentId: 'consult-agent', agentName: '客服Agent', agentDescription: '初步咨询、项目推荐', inheritsScenarioId: 'ai-customer-service', inheritsScenarioName: 'AI 客服', inheritedModelId: 'qwen-plus-latest', inheritedModelName: 'Qwen Plus' },
    { agentId: 'booking-agent', agentName: '预约Agent', agentDescription: '预约确认、排程协调', inheritsScenarioId: 'ai-appointment', inheritsScenarioName: '预约助手', inheritedModelId: 'deepseek-v4-flash', inheritedModelName: 'DeepSeek V4 Flash' },
  ],
};
