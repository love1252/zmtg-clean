import {
  platformAiModelRegistryData,
  type PlatformAiCapabilityId,
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

const controlledCapabilityIds = new Set<PlatformAiCapabilityId>(['reasoning', 'text', 'vision', 'embedding']);

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
  const providerIds = payload.providers.map((provider) => provider.providerId);
  const models = payload.providers.flatMap((provider) => provider.models);
  const modelIds = models.map((model) => model.modelId);
  const modelNames = new Set(models.map((model) => model.displayName));
  const modelById = new Map(models.map((model) => [model.modelId, model]));
  const capabilityGroupIds = payload.capabilityGroups.map((group) => group.capabilityId);
  const capabilityGroupsById = new Map(payload.capabilityGroups.map((group) => [group.capabilityId, group]));
  const scenarioIds = payload.scenarioDefaults.map((scenario) => scenario.scenarioId);
  const scenarioNames = new Set(payload.scenarioDefaults.map((scenario) => scenario.scenarioName));

  if (new Set(providerIds).size !== providerIds.length) {
    errors.add('providerId 必须唯一');
  }

  if (new Set(modelIds).size !== modelIds.length) {
    errors.add('modelId 必须唯一');
  }

  models.forEach((model) => {
    model.capabilityIds.forEach((capabilityId) => {
      if (!controlledCapabilityIds.has(capabilityId)) {
        errors.add('capabilityId 必须属于受控能力集合');
      }
    });
  });

  if (new Set(capabilityGroupIds).size !== capabilityGroupIds.length) {
    errors.add('capabilityGroups.capabilityId 必须唯一');
  }

  payload.capabilityGroups.forEach((group) => {
    if (!controlledCapabilityIds.has(group.capabilityId)) {
      errors.add('capabilityId 必须属于受控能力集合');
    }

    group.modelIds.forEach((modelId) => {
      const model = modelById.get(modelId);

      if (!model) {
        errors.add('capabilityGroups.modelIds 必须存在');
        return;
      }

      if (!model.capabilityIds.includes(group.capabilityId)) {
        errors.add('capabilityGroups.modelIds 对应模型必须声明该 capability');
      }
    });
  });

  if (new Set(scenarioIds).size !== scenarioIds.length) {
    errors.add('scenarioId 必须唯一');
  }

  payload.scenarioDefaults.forEach((scenario) => {
    if (!controlledCapabilityIds.has(scenario.requiredCapability)) {
      errors.add('capabilityId 必须属于受控能力集合');
    }

    const defaultModel = modelById.get(scenario.defaultModelId);

    if (!defaultModel) {
      errors.add('defaultModelId 必须存在');
      return;
    }

    if (!defaultModel.capabilityIds.includes(scenario.requiredCapability)) {
      errors.add('requiredCapability 必须被 default model 覆盖');
    }
  });

  payload.agentInheritance.forEach((agent) => {
    if (!scenarioNames.has(agent.inheritsScenarioName)) {
      errors.add('agent 继承场景必须存在');
    }

    if (!modelNames.has(agent.inheritedModelName)) {
      errors.add('agent 继承模型必须存在');
    }
  });

  payload.capabilityCoverageRows.forEach((row) => {
    if (!capabilityGroupsById.has(row.capabilityId)) {
      errors.add('coverage.capabilityId 必须存在');
    }

    row.modelNames.forEach((modelName) => {
      if (!modelNames.has(modelName)) {
        errors.add('coverage.modelNames 必须存在');
      }
    });

    row.scenarioRefs.forEach((scenario) => {
      if (scenario.scenarioName.includes('占位') && !['placeholder', 'future_placeholder'].includes(scenario.scenarioStatus)) {
        errors.add('未来占位场景必须显式标记 placeholder / future_placeholder');
      }
    });
  });

  return {
    ok: errors.size === 0,
    errors: Array.from(errors),
  };
}
