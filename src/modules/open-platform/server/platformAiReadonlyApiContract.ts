import {
  PLATFORM_AI_READONLY_DISABLED_CAPABILITIES,
  type PlatformAiAgentInheritanceSample,
  type PlatformAiAvailableMonthSample,
  type PlatformAiCapabilityCoverageSample,
  type PlatformAiCapabilityGroupSample,
  type PlatformAiDailyUsageSample,
  type PlatformAiProviderSample,
  type PlatformAiProviderModelUsageSample,
  type PlatformAiProviderUsageGroupSample,
  type PlatformAiSampleInstitutionUsage,
  type PlatformAiScenarioDefaultSample,
  type PlatformAiScenarioUsageSample,
} from '@/modules/open-platform/mock/platformAiReadonly';
import { getPlatformAiModelRegistryResponse } from '@/modules/open-platform/server/platformAiModelRegistryContract';
import {
  getPlatformAiUsageCostResponse,
  normalizePlatformAiUsageMonth,
  type PlatformAiUsageCostResponse,
} from '@/modules/open-platform/server/platformAiUsageCostContract';

export type PlatformAiReadonlyResponse = {
  requestId: string;
  readonly: true;
  dataSource: 'controlled_demo';
  registryVersion: string;
  registryStatus: 'controlled_readonly_demo';
  registryStatusNote: string;
  usageVersion: PlatformAiUsageCostResponse['usageVersion'];
  usageStatus: PlatformAiUsageCostResponse['usageStatus'];
  costDisclaimer: string;
  month: string;
  selectedMonth: string;
  availableMonths: PlatformAiAvailableMonthSample[];
  hasUsageData: boolean;
  emptyState: {
    title: string;
    description: string;
  } | null;
  disabledCapabilities: string[];
  capabilityCoverageRows: PlatformAiCapabilityCoverageSample[];
  safetyBanner: {
    title: string;
    description: string;
    disabledCapabilities: string[];
  };
  modelCatalog: {
    providers: PlatformAiProviderSample[];
    capabilityGroups: PlatformAiCapabilityGroupSample[];
    scenarioDefaults: PlatformAiScenarioDefaultSample[];
    agentInheritance: PlatformAiAgentInheritanceSample[];
    modelStatusNote: string;
  };
  usage: {
    summary: {
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
      billingStatusLabel: '估算费用 / 运营参考，不是正式账单';
    };
    providerModelRows: PlatformAiProviderModelUsageSample[];
    dailyRows: PlatformAiDailyUsageSample[];
    providerUsageGroups: PlatformAiProviderUsageGroupSample[];
    scenarioRows: PlatformAiScenarioUsageSample[];
    sampleInstitutionRanking: PlatformAiSampleInstitutionUsage[];
  };
};

export function normalizeAiReadonlyMonth(value: string | null | undefined) {
  return normalizePlatformAiUsageMonth(value);
}

export function getPlatformAiReadonlyResponse(params: { month?: string | null } = {}): PlatformAiReadonlyResponse {
  const registry = getPlatformAiModelRegistryResponse();
  const usageCost = getPlatformAiUsageCostResponse({ month: params.month });
  const month = usageCost.selectedMonth;

  return {
    requestId: 'open-platform-ai-readonly',
    readonly: true,
    dataSource: 'controlled_demo',
    registryVersion: registry.registryVersion,
    registryStatus: registry.registryStatus,
    registryStatusNote: registry.registryStatusNote,
    usageVersion: usageCost.usageVersion,
    usageStatus: usageCost.usageStatus,
    costDisclaimer: usageCost.costDisclaimer,
    month,
    selectedMonth: month,
    availableMonths: usageCost.availableMonths,
    hasUsageData: usageCost.hasUsageData,
    emptyState: usageCost.emptyState,
    disabledCapabilities: [...PLATFORM_AI_READONLY_DISABLED_CAPABILITIES],
    capabilityCoverageRows: registry.capabilityCoverageRows,
    safetyBanner: {
      title: '当前为受控示例数据',
      description: '估算费用不是正式账单；真实 AI 未启用，API Key 管理、模型同步和自动扣费均未启用。',
      disabledCapabilities: [...PLATFORM_AI_READONLY_DISABLED_CAPABILITIES],
    },
    modelCatalog: {
      providers: registry.providers,
      capabilityGroups: registry.capabilityGroups,
      scenarioDefaults: registry.scenarioDefaults,
      agentInheritance: registry.agentInheritance,
      modelStatusNote: `模型启用状态说明：${registry.registryStatusNote}`,
    },
    usage: {
      summary: {
        ...usageCost.summary,
        month,
        billingStatusLabel: '估算费用 / 运营参考，不是正式账单',
      },
      providerModelRows: usageCost.providerModelRows,
      dailyRows: usageCost.dailyRows,
      providerUsageGroups: usageCost.providerUsageGroups,
      scenarioRows: usageCost.scenarioRows,
      sampleInstitutionRanking: usageCost.sampleInstitutionRanking,
    },
  };
}
