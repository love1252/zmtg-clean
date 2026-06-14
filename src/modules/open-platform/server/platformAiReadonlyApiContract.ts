import {
  PLATFORM_AI_READONLY_AVAILABLE_MONTHS,
  PLATFORM_AI_READONLY_DEFAULT_MONTH,
  PLATFORM_AI_READONLY_DISABLED_CAPABILITIES,
  platformAiReadonlySampleData,
  type PlatformAiAgentInheritanceSample,
  type PlatformAiAvailableMonthSample,
  type PlatformAiCapabilityCoverageSample,
  type PlatformAiCapabilityGroupSample,
  type PlatformAiProviderSample,
  type PlatformAiProviderModelUsageSample,
  type PlatformAiSampleInstitutionUsage,
  type PlatformAiScenarioDefaultSample,
  type PlatformAiScenarioUsageSample,
} from '@/modules/open-platform/mock/platformAiReadonly';
import { getPlatformAiModelRegistryResponse } from '@/modules/open-platform/server/platformAiModelRegistryContract';

export type PlatformAiReadonlyResponse = {
  requestId: string;
  readonly: true;
  dataSource: 'controlled_demo';
  registryVersion: string;
  registryStatus: 'controlled_readonly_demo';
  registryStatusNote: string;
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
      totalTokens: number;
      successRate: number;
      averageLatencyMs: number;
      estimatedCostCny: number;
      billingStatusLabel: '估算费用 / 运营参考，不是正式账单';
    };
    providerModelRows: PlatformAiProviderModelUsageSample[];
    scenarioRows: PlatformAiScenarioUsageSample[];
    sampleInstitutionRanking: PlatformAiSampleInstitutionUsage[];
  };
};

const controlledMonths = new Set(PLATFORM_AI_READONLY_AVAILABLE_MONTHS.map((month) => month.value));

export function normalizeAiReadonlyMonth(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return controlledMonths.has(normalized) ? normalized : PLATFORM_AI_READONLY_DEFAULT_MONTH;
}

export function getPlatformAiReadonlyResponse(params: { month?: string | null } = {}): PlatformAiReadonlyResponse {
  const month = normalizeAiReadonlyMonth(params.month);
  const registry = getPlatformAiModelRegistryResponse();
  const monthMeta = PLATFORM_AI_READONLY_AVAILABLE_MONTHS.find((item) => item.value === month);
  const hasUsageData = Boolean(monthMeta?.hasUsageData);
  const usageSummary = hasUsageData
    ? platformAiReadonlySampleData.usage.summary
    : {
      month,
      totalCalls: 0,
      totalTokens: 0,
      successRate: 0,
      averageLatencyMs: 0,
      estimatedCostCny: 0,
    };

  return {
    requestId: 'open-platform-ai-readonly',
    readonly: true,
    dataSource: 'controlled_demo',
    registryVersion: registry.registryVersion,
    registryStatus: registry.registryStatus,
    registryStatusNote: registry.registryStatusNote,
    month,
    selectedMonth: month,
    availableMonths: PLATFORM_AI_READONLY_AVAILABLE_MONTHS,
    hasUsageData,
    emptyState: hasUsageData ? null : {
      title: '暂无受控示例用量',
      description: `${monthMeta?.label ?? month}为受控示例月份，未读取真实 AI 日志；估算费用不是正式账单。`,
    },
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
        ...usageSummary,
        month,
        billingStatusLabel: '估算费用 / 运营参考，不是正式账单',
      },
      providerModelRows: hasUsageData ? platformAiReadonlySampleData.usage.providerModelRows : [],
      scenarioRows: hasUsageData ? platformAiReadonlySampleData.usage.scenarioRows : [],
      sampleInstitutionRanking: hasUsageData ? platformAiReadonlySampleData.usage.sampleInstitutionRanking : [],
    },
  };
}
