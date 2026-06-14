export type PlatformAiProviderStatus = 'sample_enabled' | 'sample_disabled';
export type PlatformAiCapabilityId = 'reasoning' | 'text' | 'vision' | 'embedding';

export type PlatformAiRegistryModel = {
  modelId: string;
  displayName: string;
  capabilityIds: PlatformAiCapabilityId[];
  contextWindowLabel: string;
  recommendedScenarios: string[];
  status: PlatformAiProviderStatus;
  statusLabel: string;
};

export type PlatformAiRegistryProvider = {
  providerId: string;
  providerName: string;
  lowSensitiveConfigStatus: string;
  enabledStatusNote: string;
  models: PlatformAiRegistryModel[];
};

export type PlatformAiRegistryCapabilityGroup = {
  capabilityId: PlatformAiCapabilityId;
  label: string;
  description: string;
  modelIds: string[];
};

export type PlatformAiRegistryScenarioDefault = {
  scenarioId: string;
  scenarioName: string;
  description: string;
  requiredCapability: PlatformAiCapabilityId;
  defaultModelId: string;
  defaultModelName: string;
};

export type PlatformAiRegistryAgentInheritance = {
  agentName: string;
  agentDescription: string;
  inheritsScenarioId: string;
  inheritsScenarioName: string;
  inheritedModelId: string;
  inheritedModelName: string;
};

export type PlatformAiRegistryCoverageScenarioRef = {
  scenarioName: string;
  scenarioStatus: 'active' | 'placeholder' | 'future_placeholder';
};

export type PlatformAiRegistryCapabilityCoverage = {
  capabilityId: PlatformAiCapabilityId;
  capabilityName: string;
  scenarioNames: string[];
  scenarioRefs: PlatformAiRegistryCoverageScenarioRef[];
  modelNames: string[];
  safetyNote: string;
};

export type PlatformAiModelRegistryData = {
  registryVersion: string;
  registryStatus: 'controlled_readonly_demo';
  registryStatusNote: string;
  providers: PlatformAiRegistryProvider[];
  capabilityGroups: PlatformAiRegistryCapabilityGroup[];
  scenarioDefaults: PlatformAiRegistryScenarioDefault[];
  agentInheritance: PlatformAiRegistryAgentInheritance[];
  capabilityCoverageRows: PlatformAiRegistryCapabilityCoverage[];
};

export const PLATFORM_AI_MODEL_REGISTRY_DISABLED_CAPABILITIES = [
  '真实 AI',
  'API Key 管理',
  '厂商模型同步',
  'OCR',
  '真实向量库',
  '自动扣费',
  '正式账单',
] as const;

export const platformAiModelRegistryData: PlatformAiModelRegistryData = {
  registryVersion: 'ai-registry-v1-controlled-demo',
  registryStatus: 'controlled_readonly_demo',
  registryStatusNote: '当前为受控只读示例，不代表生产启用。',
  providers: [
    {
      providerId: 'sample-qwen',
      providerName: '通义千问',
      lowSensitiveConfigStatus: '真实凭据未接入',
      enabledStatusNote: '示例状态：仅展示模型目录，不代表生产启用。',
      models: [
        {
          modelId: 'qwen-plus-sample',
          displayName: 'Qwen Plus 示例',
          capabilityIds: ['text', 'reasoning'],
          contextWindowLabel: '128K',
          recommendedScenarios: ['AI 客服', '知识库问答', '智能随访'],
          status: 'sample_enabled',
          statusLabel: '示例启用',
        },
        {
          modelId: 'qwen-embedding-sample',
          displayName: 'Text Embedding 示例',
          capabilityIds: ['embedding'],
          contextWindowLabel: '8K',
          recommendedScenarios: ['知识库召回', '相似问答'],
          status: 'sample_disabled',
          statusLabel: '真实向量库未启用',
        },
      ],
    },
    {
      providerId: 'sample-deepseek',
      providerName: 'DeepSeek',
      lowSensitiveConfigStatus: 'Key 管理未启用',
      enabledStatusNote: '示例状态：不调用厂商接口，模型目录不做外部更新。',
      models: [
        {
          modelId: 'deepseek-reasoner-sample',
          displayName: 'DeepSeek Reasoner 示例',
          capabilityIds: ['reasoning', 'text'],
          contextWindowLabel: '64K',
          recommendedScenarios: ['工作流判断', '数据分析'],
          status: 'sample_enabled',
          statusLabel: '示例启用',
        },
      ],
    },
    {
      providerId: 'sample-doubao',
      providerName: '豆包',
      lowSensitiveConfigStatus: '真实凭据未接入',
      enabledStatusNote: '示例状态：仅用于信息架构验证。',
      models: [
        {
          modelId: 'doubao-vision-sample',
          displayName: '豆包视觉理解示例',
          capabilityIds: ['vision', 'text'],
          contextWindowLabel: '32K',
          recommendedScenarios: ['图片资料理解', '文件低敏摘要'],
          status: 'sample_disabled',
          statusLabel: 'OCR 未启用',
        },
      ],
    },
  ],
  capabilityGroups: [
    {
      capabilityId: 'text',
      label: '文本生成',
      description: '用于客服回复、随访文案、知识库回答等文本类场景。',
      modelIds: ['qwen-plus-sample', 'deepseek-reasoner-sample', 'doubao-vision-sample'],
    },
    {
      capabilityId: 'reasoning',
      label: '推理判断',
      description: '用于工作流判断、运营分析和复杂条件解释。',
      modelIds: ['qwen-plus-sample', 'deepseek-reasoner-sample'],
    },
    {
      capabilityId: 'vision',
      label: '视觉理解',
      description: '仅作为后续能力占位；AI-2 不启用 OCR 或图片文字识别。',
      modelIds: ['doubao-vision-sample'],
    },
    {
      capabilityId: 'embedding',
      label: '向量模型',
      description: '仅作为知识库召回能力占位；AI-2 不接入真实向量库。',
      modelIds: ['qwen-embedding-sample'],
    },
  ],
  scenarioDefaults: [
    {
      scenarioId: 'sample-customer-service',
      scenarioName: 'AI 客服默认模型',
      description: '客户咨询、在线回复和人工辅助建议。',
      requiredCapability: 'text',
      defaultModelId: 'qwen-plus-sample',
      defaultModelName: 'Qwen Plus 示例',
    },
    {
      scenarioId: 'sample-knowledge-qa',
      scenarioName: '知识库问答模型',
      description: '基于低敏引用片段的问答展示占位。',
      requiredCapability: 'text',
      defaultModelId: 'qwen-plus-sample',
      defaultModelName: 'Qwen Plus 示例',
    },
    {
      scenarioId: 'sample-workflow-decision',
      scenarioName: '工作流判断模型',
      description: '旅程节点条件判断和下一步动作建议。',
      requiredCapability: 'reasoning',
      defaultModelId: 'deepseek-reasoner-sample',
      defaultModelName: 'DeepSeek Reasoner 示例',
    },
  ],
  agentInheritance: [
    {
      agentName: '客服 Agent',
      agentDescription: '初步咨询和项目推荐。',
      inheritsScenarioId: 'sample-customer-service',
      inheritsScenarioName: 'AI 客服默认模型',
      inheritedModelId: 'qwen-plus-sample',
      inheritedModelName: 'Qwen Plus 示例',
    },
    {
      agentName: '护理 Agent',
      agentDescription: '术后提醒和恢复指导。',
      inheritsScenarioId: 'sample-knowledge-qa',
      inheritsScenarioName: '知识库问答模型',
      inheritedModelId: 'qwen-plus-sample',
      inheritedModelName: 'Qwen Plus 示例',
    },
    {
      agentName: '运营分析 Agent',
      agentDescription: '趋势总结和异常解释。',
      inheritsScenarioId: 'sample-workflow-decision',
      inheritsScenarioName: '工作流判断模型',
      inheritedModelId: 'deepseek-reasoner-sample',
      inheritedModelName: 'DeepSeek Reasoner 示例',
    },
  ],
  capabilityCoverageRows: [
    {
      capabilityId: 'text',
      capabilityName: '文本生成',
      scenarioNames: ['AI 客服默认模型', '知识库问答模型'],
      scenarioRefs: [
        { scenarioName: 'AI 客服默认模型', scenarioStatus: 'active' },
        { scenarioName: '知识库问答模型', scenarioStatus: 'active' },
      ],
      modelNames: ['Qwen Plus 示例', 'DeepSeek Reasoner 示例', '豆包视觉理解示例'],
      safetyNote: '只读示例，不触发真实 AI。',
    },
    {
      capabilityId: 'reasoning',
      capabilityName: '推理判断',
      scenarioNames: ['工作流判断模型'],
      scenarioRefs: [
        { scenarioName: '工作流判断模型', scenarioStatus: 'active' },
      ],
      modelNames: ['Qwen Plus 示例', 'DeepSeek Reasoner 示例'],
      safetyNote: '仅展示场景关系，不运行工作流判断。',
    },
    {
      capabilityId: 'vision',
      capabilityName: '视觉理解',
      scenarioNames: ['图片资料理解占位'],
      scenarioRefs: [
        { scenarioName: '图片资料理解占位', scenarioStatus: 'future_placeholder' },
      ],
      modelNames: ['豆包视觉理解示例'],
      safetyNote: 'OCR 未启用',
    },
    {
      capabilityId: 'embedding',
      capabilityName: '向量模型',
      scenarioNames: ['知识库召回占位'],
      scenarioRefs: [
        { scenarioName: '知识库召回占位', scenarioStatus: 'future_placeholder' },
      ],
      modelNames: ['Text Embedding 示例'],
      safetyNote: '真实向量库未启用',
    },
  ],
};
