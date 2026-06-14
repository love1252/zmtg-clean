import {
  PLATFORM_AI_MODEL_REGISTRY_DISABLED_CAPABILITIES,
  platformAiModelRegistryData,
} from '@/modules/open-platform/mock/platformAiModelRegistry';

export type PlatformAiProviderStatus = 'sample_enabled' | 'sample_disabled';
export type PlatformAiCapabilityId = 'reasoning' | 'text' | 'vision' | 'embedding';

export type PlatformAiModelSample = {
  modelId: string;
  displayName: string;
  capabilityIds: PlatformAiCapabilityId[];
  contextWindowLabel: string;
  recommendedScenarios: string[];
  status: PlatformAiProviderStatus;
  statusLabel: string;
};

export type PlatformAiProviderSample = {
  providerId: string;
  providerName: string;
  lowSensitiveConfigStatus: string;
  enabledStatusNote: string;
  models: PlatformAiModelSample[];
};

export type PlatformAiCapabilityGroupSample = {
  capabilityId: PlatformAiCapabilityId;
  label: string;
  description: string;
  modelIds: string[];
};

export type PlatformAiScenarioDefaultSample = {
  scenarioId: string;
  scenarioName: string;
  description: string;
  requiredCapability: PlatformAiCapabilityId;
  defaultModelId: string;
  defaultModelName: string;
};

export type PlatformAiAgentInheritanceSample = {
  agentName: string;
  agentDescription: string;
  inheritsScenarioName: string;
  inheritedModelName: string;
};

export type PlatformAiUsageSummarySample = {
  month: string;
  totalCalls: number;
  totalTokens: number;
  successRate: number;
  averageLatencyMs: number;
  estimatedCostCny: number;
};

export type PlatformAiProviderModelUsageSample = {
  providerName: string;
  modelName: string;
  calls: number;
  totalTokens: number;
  successRate: number;
  averageLatencyMs: number;
  estimatedCostCny: number;
};

export type PlatformAiScenarioUsageSample = {
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

export type PlatformAiAvailableMonthSample = {
  value: string;
  label: string;
  hasUsageData: boolean;
};

export type PlatformAiCapabilityCoverageSample = {
  capabilityId: PlatformAiCapabilityId;
  capabilityName: string;
  scenarioNames: string[];
  modelNames: string[];
  safetyNote: string;
};

export type PlatformAiReadonlySampleData = {
  providers: PlatformAiProviderSample[];
  capabilityGroups: PlatformAiCapabilityGroupSample[];
  scenarioDefaults: PlatformAiScenarioDefaultSample[];
  agentInheritance: PlatformAiAgentInheritanceSample[];
  usage: {
    summary: PlatformAiUsageSummarySample;
    providerModelRows: PlatformAiProviderModelUsageSample[];
    scenarioRows: PlatformAiScenarioUsageSample[];
    sampleInstitutionRanking: PlatformAiSampleInstitutionUsage[];
  };
};

export const PLATFORM_AI_READONLY_DEFAULT_MONTH = '2026-06';

export const PLATFORM_AI_READONLY_AVAILABLE_MONTHS: PlatformAiAvailableMonthSample[] = [
  { value: '2026-06', label: '2026年06月', hasUsageData: true },
  { value: '2026-05', label: '2026年05月', hasUsageData: false },
];

export const PLATFORM_AI_READONLY_DISABLED_CAPABILITIES = PLATFORM_AI_MODEL_REGISTRY_DISABLED_CAPABILITIES;

export const platformAiCapabilityCoverageRows: PlatformAiCapabilityCoverageSample[] = platformAiModelRegistryData.capabilityCoverageRows;

export const platformAiReadonlySampleData: PlatformAiReadonlySampleData = {
  providers: platformAiModelRegistryData.providers,
  capabilityGroups: platformAiModelRegistryData.capabilityGroups,
  scenarioDefaults: platformAiModelRegistryData.scenarioDefaults,
  agentInheritance: platformAiModelRegistryData.agentInheritance,
  usage: {
    summary: {
      month: PLATFORM_AI_READONLY_DEFAULT_MONTH,
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
  },
};
