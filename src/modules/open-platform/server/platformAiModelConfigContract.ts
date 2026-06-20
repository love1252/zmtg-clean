import {
  platformAiModelConfigData,
  type PlatformAiModelConfigAgentInheritance,
  type PlatformAiModelConfigCapabilityId,
  type PlatformAiModelConfigData,
  type PlatformAiModelConfigProvider,
  type PlatformAiModelConfigScenarioDefault,
} from '@/modules/open-platform/mock/platformAiModelConfig';

export type PlatformAiModelConfigResponse = {
  readonly: false;
  userActionsEnabled: true;
  dataSource: 'persisted_boundary';
  operationMode: 'persisted_dry_run';
  persistenceMode: 'database';
  externalCallMode: 'blocked';
  dataExposureMode: 'masked_only';
  configVersion: string;
  title: string;
  subtitle: string;
  readonlyNote: string;
  summary: PlatformAiModelConfigData['summary'];
  capabilityOrder: PlatformAiModelConfigCapabilityId[];
  capabilityLabels: PlatformAiModelConfigData['capabilityLabels'];
  providers: PlatformAiModelConfigProvider[];
  scenarioDefaults: PlatformAiModelConfigScenarioDefault[];
  agentInheritance: PlatformAiModelConfigAgentInheritance[];
};

export type PlatformAiModelConfigValidationResult = {
  ok: boolean;
  errors: string[];
};

const controlledCapabilityIds = new Set<PlatformAiModelConfigCapabilityId>([
  'reasoning',
  'text',
  'vision',
  'embedding',
]);

const controlledDryRunStatuses = new Set(['dry_run', 'disabled', 'not_available']);

const keyMaskPattern = /^Key 已配置 \*{4}[A-Za-z0-9]{4}$/;

export function getPlatformAiModelConfigResponse(): PlatformAiModelConfigResponse {
  return {
    readonly: false,
    userActionsEnabled: true,
    dataSource: 'persisted_boundary',
    operationMode: 'persisted_dry_run',
    persistenceMode: 'database',
    externalCallMode: 'blocked',
    dataExposureMode: 'masked_only',
    configVersion: platformAiModelConfigData.configVersion,
    title: platformAiModelConfigData.title,
    subtitle: platformAiModelConfigData.subtitle,
    readonlyNote: platformAiModelConfigData.readonlyNote,
    summary: platformAiModelConfigData.summary,
    capabilityOrder: platformAiModelConfigData.capabilityOrder,
    capabilityLabels: platformAiModelConfigData.capabilityLabels,
    providers: platformAiModelConfigData.providers,
    scenarioDefaults: platformAiModelConfigData.scenarioDefaults,
    agentInheritance: platformAiModelConfigData.agentInheritance,
  };
}

export function validatePlatformAiModelConfigContract(
  payload: PlatformAiModelConfigResponse,
): PlatformAiModelConfigValidationResult {
  const errors = new Set<string>();
  const providerIds = payload.providers.map((provider) => provider.providerId);
  const models = payload.providers.flatMap((provider) => provider.models);
  const modelIds = models.map((model) => model.modelId);
  const modelById = new Map(models.map((model) => [model.modelId, model]));
  const scenarioIds = payload.scenarioDefaults.map((scenario) => scenario.scenarioId);
  const scenarioById = new Map(payload.scenarioDefaults.map((scenario) => [scenario.scenarioId, scenario]));

  if (new Set(providerIds).size !== providerIds.length) {
    errors.add('providerId 必须唯一');
  }

  if (new Set(modelIds).size !== modelIds.length) {
    errors.add('modelId 必须唯一');
  }

  payload.capabilityOrder.forEach((capabilityId) => {
    if (!controlledCapabilityIds.has(capabilityId)) {
      errors.add('capabilityId 必须属于受控能力集合');
    }

    if (!payload.capabilityLabels[capabilityId]) {
      errors.add('capabilityLabels 必须覆盖 capabilityOrder');
    }
  });

  payload.providers.forEach((provider) => {
    if (!provider.providerId || !provider.providerName) {
      errors.add('providerId/providerName 不能为空');
    }

    if (!['masked_configured', 'not_configured', 'disabled'].includes(provider.keyStatus.kind)) {
      errors.add('keyStatus.kind 必须是受控低敏状态');
    }

    if (provider.keyStatus.kind === 'masked_configured' && !keyMaskPattern.test(provider.keyStatus.maskedLabel)) {
      errors.add('keyStatus.maskedLabel 必须是低敏掩码');
    }

    if (!controlledDryRunStatuses.has(provider.syncStatus)) {
      errors.add('syncStatus 必须是受控 dry-run 状态');
    }

    provider.models.forEach((model) => {
      if (!model.displayName) {
        errors.add('model displayName 不能为空');
      }

      if (!controlledDryRunStatuses.has(model.testStatus)) {
        errors.add('testStatus 必须是受控 dry-run 状态');
      }

      model.capabilityIds.forEach((capabilityId) => {
        if (!controlledCapabilityIds.has(capabilityId)) {
          errors.add('capabilityId 必须属于受控能力集合');
        }
      });
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

    if (defaultModel.displayName !== scenario.defaultModelName) {
      errors.add('defaultModelId 与 defaultModelName 必须指向同一模型');
    }
  });

  payload.agentInheritance.forEach((agent) => {
    const scenario = scenarioById.get(agent.inheritsScenarioId);
    const model = modelById.get(agent.inheritedModelId);

    if (!scenario) {
      errors.add('agent.inheritsScenarioId 必须存在于 scenarioDefaults.scenarioId');
    } else if (scenario.scenarioName !== agent.inheritsScenarioName) {
      errors.add('agent.inheritsScenarioId 与 inheritsScenarioName 必须指向同一场景');
    }

    if (!model) {
      errors.add('agent.inheritedModelId 必须存在于 modelId');
    } else if (model.displayName !== agent.inheritedModelName) {
      errors.add('agent.inheritedModelId 与 inheritedModelName 必须指向同一模型');
    }
  });

  return {
    ok: errors.size === 0,
    errors: Array.from(errors),
  };
}
