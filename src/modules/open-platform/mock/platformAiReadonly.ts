import {
  PLATFORM_AI_MODEL_REGISTRY_DISABLED_CAPABILITIES,
  platformAiModelRegistryData,
} from '@/modules/open-platform/mock/platformAiModelRegistry';
import {
  PLATFORM_AI_USAGE_AVAILABLE_MONTHS,
  PLATFORM_AI_USAGE_DEFAULT_MONTH,
  platformAiUsageCostSampleData,
  type PlatformAiProviderModelUsage,
  type PlatformAiSampleInstitutionUsage as PlatformAiUsageSampleInstitutionUsage,
  type PlatformAiScenarioUsage,
  type PlatformAiUsageAvailableMonth,
  type PlatformAiUsageSummary,
} from '@/modules/open-platform/mock/platformAiUsageCost';

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

export type PlatformAiUsageSummarySample = PlatformAiUsageSummary;
export type PlatformAiProviderModelUsageSample = PlatformAiProviderModelUsage;
export type PlatformAiScenarioUsageSample = PlatformAiScenarioUsage;
export type PlatformAiSampleInstitutionUsage = PlatformAiUsageSampleInstitutionUsage;
export type PlatformAiAvailableMonthSample = PlatformAiUsageAvailableMonth;

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

export const PLATFORM_AI_READONLY_DEFAULT_MONTH = PLATFORM_AI_USAGE_DEFAULT_MONTH;

export const PLATFORM_AI_READONLY_AVAILABLE_MONTHS: PlatformAiAvailableMonthSample[] = PLATFORM_AI_USAGE_AVAILABLE_MONTHS;

export const PLATFORM_AI_READONLY_DISABLED_CAPABILITIES = PLATFORM_AI_MODEL_REGISTRY_DISABLED_CAPABILITIES;

export const platformAiCapabilityCoverageRows: PlatformAiCapabilityCoverageSample[] = platformAiModelRegistryData.capabilityCoverageRows;

export const platformAiReadonlySampleData: PlatformAiReadonlySampleData = {
  providers: platformAiModelRegistryData.providers,
  capabilityGroups: platformAiModelRegistryData.capabilityGroups,
  scenarioDefaults: platformAiModelRegistryData.scenarioDefaults,
  agentInheritance: platformAiModelRegistryData.agentInheritance,
  usage: platformAiUsageCostSampleData,
};
