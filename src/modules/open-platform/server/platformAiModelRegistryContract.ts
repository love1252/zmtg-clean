import {
  platformAiModelRegistryData,
  type PlatformAiModelRegistryData,
  type PlatformAiRegistryAgentInheritance,
  type PlatformAiRegistryCapabilityCoverage,
  type PlatformAiRegistryCapabilityGroup,
  type PlatformAiRegistryProvider,
  type PlatformAiRegistryScenarioDefault,
} from '@/modules/open-platform/mock/platformAiModelRegistry';

export type PlatformAiModelRegistryResponse = {
  readonly: true;
  dataSource: 'controlled_demo';
  registryVersion: string;
  registryStatus: PlatformAiModelRegistryData['registryStatus'];
  registryStatusNote: string;
  providers: PlatformAiRegistryProvider[];
  capabilityGroups: PlatformAiRegistryCapabilityGroup[];
  scenarioDefaults: PlatformAiRegistryScenarioDefault[];
  agentInheritance: PlatformAiRegistryAgentInheritance[];
  capabilityCoverageRows: PlatformAiRegistryCapabilityCoverage[];
};

export type PlatformAiModelRegistryValidationResult = {
  ok: boolean;
  errors: string[];
};

export function getPlatformAiModelRegistryResponse(): PlatformAiModelRegistryResponse {
  return {
    readonly: true,
    dataSource: 'controlled_demo',
    registryVersion: platformAiModelRegistryData.registryVersion,
    registryStatus: platformAiModelRegistryData.registryStatus,
    registryStatusNote: platformAiModelRegistryData.registryStatusNote,
    providers: platformAiModelRegistryData.providers,
    capabilityGroups: platformAiModelRegistryData.capabilityGroups,
    scenarioDefaults: platformAiModelRegistryData.scenarioDefaults,
    agentInheritance: platformAiModelRegistryData.agentInheritance,
    capabilityCoverageRows: platformAiModelRegistryData.capabilityCoverageRows,
  };
}

export function validatePlatformAiModelRegistryContract(
  payload: PlatformAiModelRegistryResponse,
): PlatformAiModelRegistryValidationResult {
  const errors = new Set<string>();
  const models = payload.providers.flatMap((provider) => provider.models);
  const modelIds = models.map((model) => model.modelId);
  const modelNames = new Set(models.map((model) => model.displayName));
  const modelById = new Map(models.map((model) => [model.modelId, model]));

  if (new Set(modelIds).size !== modelIds.length) {
    errors.add('modelId 必须唯一');
  }

  payload.scenarioDefaults.forEach((scenario) => {
    const defaultModel = modelById.get(scenario.defaultModelId);

    if (!defaultModel) {
      errors.add('defaultModelId 必须存在');
      return;
    }

    if (!defaultModel.capabilityIds.includes(scenario.requiredCapability)) {
      errors.add('requiredCapability 必须被 default model 覆盖');
    }
  });

  payload.capabilityCoverageRows.forEach((row) => {
    row.modelNames.forEach((modelName) => {
      if (!modelNames.has(modelName)) {
        errors.add('capability coverage 不得引用不存在模型');
      }
    });
  });

  return {
    ok: errors.size === 0,
    errors: Array.from(errors),
  };
}
