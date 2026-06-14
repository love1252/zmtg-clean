import {
  PLATFORM_AI_READONLY_DEFAULT_MONTH,
  platformAiReadonlySampleData,
  type PlatformAiAgentInheritanceSample,
  type PlatformAiCapabilityGroupSample,
  type PlatformAiProviderSample,
  type PlatformAiProviderModelUsageSample,
  type PlatformAiSampleInstitutionUsage,
  type PlatformAiScenarioDefaultSample,
  type PlatformAiScenarioUsageSample,
} from '@/modules/open-platform/mock/platformAiReadonly';

export type PlatformAiReadonlyResponse = {
  requestId: string;
  readonly: true;
  dataSource: 'controlled_demo';
  month: string;
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

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export function normalizeAiReadonlyMonth(value: string | null | undefined) {
  const normalized = String(value ?? '').trim();
  return monthPattern.test(normalized) ? normalized : PLATFORM_AI_READONLY_DEFAULT_MONTH;
}

export function getPlatformAiReadonlyResponse(params: { month?: string | null } = {}): PlatformAiReadonlyResponse {
  const month = normalizeAiReadonlyMonth(params.month);

  return {
    requestId: 'open-platform-ai-readonly',
    readonly: true,
    dataSource: 'controlled_demo',
    month,
    safetyBanner: {
      title: '当前为受控示例数据',
      description: '估算费用不是正式账单；真实 AI 未启用，API Key 管理、模型同步和自动扣费均未启用。',
      disabledCapabilities: [
        '真实 AI',
        'API Key 管理',
        '厂商模型同步',
        'OCR',
        '真实向量库',
        '正式计费',
        '自动扣费',
      ],
    },
    modelCatalog: {
      providers: platformAiReadonlySampleData.providers,
      capabilityGroups: platformAiReadonlySampleData.capabilityGroups,
      scenarioDefaults: platformAiReadonlySampleData.scenarioDefaults,
      agentInheritance: platformAiReadonlySampleData.agentInheritance,
      modelStatusNote: '模型启用状态说明：本页仅展示示例状态，不代表生产模型可调用。',
    },
    usage: {
      summary: {
        ...platformAiReadonlySampleData.usage.summary,
        month,
        billingStatusLabel: '估算费用 / 运营参考，不是正式账单',
      },
      providerModelRows: platformAiReadonlySampleData.usage.providerModelRows,
      scenarioRows: platformAiReadonlySampleData.usage.scenarioRows,
      sampleInstitutionRanking: platformAiReadonlySampleData.usage.sampleInstitutionRanking,
    },
  };
}
