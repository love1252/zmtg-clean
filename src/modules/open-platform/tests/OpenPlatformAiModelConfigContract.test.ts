import { describe, expect, it } from 'vitest';
import {
  getPlatformAiModelConfigResponse,
  validatePlatformAiModelConfigContract,
  type PlatformAiModelConfigResponse,
} from '@/modules/open-platform/server/platformAiModelConfigContract';

const forbiddenDatabaseUrlScheme = ['postgres', '://'].join('');
const forbiddenFragments = [
  'apiKey',
  'API Key 原文',
  'credential',
  'secret',
  'encryptedKey',
  'encryptedApiKey',
  'ciphertext',
  'authTag',
  'iv',
  'DATABASE_URL',
  'sk-',
  'tenant_ai_config',
  'decryptApiKey',
  'fetch(',
  '/Users/',
  forbiddenDatabaseUrlScheme,
];

function expectLowSensitivePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function cloneConfig(payload: PlatformAiModelConfigResponse): PlatformAiModelConfigResponse {
  return structuredClone(payload) as PlatformAiModelConfigResponse;
}

function expectInvalidConfig(
  mutate: (payload: PlatformAiModelConfigResponse) => void,
  expectedError: string,
) {
  const payload = cloneConfig(getPlatformAiModelConfigResponse());

  mutate(payload);

  expect(validatePlatformAiModelConfigContract(payload).errors).toContain(expectedError);
}

describe('平台端 AI 模型配置持久化 dry-run contract', () => {
  it('返回旧系统 1:1 信息结构所需的持久化低敏 dry-run 数据', () => {
    const payload = getPlatformAiModelConfigResponse();

    expect(payload).toMatchObject({
      readonly: false,
      userActionsEnabled: true,
      dataSource: 'persisted_boundary',
      operationMode: 'persisted_dry_run',
      persistenceMode: 'database',
      externalCallMode: 'blocked',
      dataExposureMode: 'masked_only',
      configVersion: 'old-ai-model-config-parity-v1',
      title: 'AI模型',
      subtitle: '配置平台AI模型提供商，支持豆包、DeepSeek、千问、Kimi',
      summary: {
        enabledModelCount: 10,
        configuredProviderCount: 5,
        defaultScenarioCount: 8,
      },
      capabilityOrder: ['reasoning', 'text', 'vision', 'embedding'],
      providers: expect.any(Array),
      scenarioDefaults: expect.any(Array),
      agentInheritance: expect.any(Array),
    });

    expect(payload.providers.map((provider) => provider.providerName)).toEqual([
      '豆包',
      'DeepSeek',
      '通义千问',
      '智谱GLM',
      'Kimi',
    ]);
    expect(payload.scenarioDefaults).toHaveLength(8);
    expect(payload.agentInheritance).toHaveLength(3);
    expect(payload.providers.flatMap((provider) => provider.models).length).toBeGreaterThanOrEqual(20);
    expect(payload.providers.every((provider) => provider.keyStatus.kind === 'masked_configured')).toBe(true);
    expect(payload.providers.every((provider) => provider.keyStatus.maskedLabel.startsWith('Key 已配置 ****'))).toBe(true);
    expect(payload.providers.every((provider) => provider.syncStatus === 'dry_run')).toBe(true);
    expect(payload.providers.flatMap((provider) => provider.models).every((model) => model.testStatus === 'dry_run')).toBe(true);
    expectLowSensitivePayload(payload);
  });

  it('校验 provider、model、capability、scenario 和 Agent 继承引用关系', () => {
    const payload = getPlatformAiModelConfigResponse();
    const validation = validatePlatformAiModelConfigContract(payload);

    expect(validation).toEqual({ ok: true, errors: [] });

    const providerIds = payload.providers.map((provider) => provider.providerId);
    expect(new Set(providerIds).size).toBe(providerIds.length);

    const models = payload.providers.flatMap((provider) => provider.models.map((model) => ({
      ...model,
      providerId: provider.providerId,
      providerName: provider.providerName,
    })));
    const modelIds = models.map((model) => model.modelId);
    expect(new Set(modelIds).size).toBe(modelIds.length);

    payload.capabilityOrder.forEach((capabilityId) => {
      expect(payload.capabilityLabels[capabilityId]).toBeTruthy();
      expect(models.some((model) => model.capabilityIds.includes(capabilityId))).toBe(true);
    });

    payload.scenarioDefaults.forEach((scenario) => {
      const model = models.find((item) => item.modelId === scenario.defaultModelId);

      expect(model).toBeDefined();
      expect(model?.capabilityIds).toContain(scenario.requiredCapability);
      expect(scenario.defaultModelName).toBe(model?.displayName);
    });

    payload.agentInheritance.forEach((agent) => {
      const scenario = payload.scenarioDefaults.find((item) => item.scenarioId === agent.inheritsScenarioId);
      const model = models.find((item) => item.modelId === agent.inheritedModelId);

      expect(scenario?.scenarioName).toBe(agent.inheritsScenarioName);
      expect(model?.displayName).toBe(agent.inheritedModelName);
    });
  });

  it('能发现破坏 contract 的数据问题', () => {
    expectInvalidConfig((payload) => {
      payload.providers[1].providerId = payload.providers[0].providerId;
    }, 'providerId 必须唯一');

    expectInvalidConfig((payload) => {
      payload.providers[1].models[0].modelId = payload.providers[0].models[0].modelId;
    }, 'modelId 必须唯一');

    expectInvalidConfig((payload) => {
      payload.providers[0].models[0].capabilityIds = ['unknown-capability' as never];
    }, 'capabilityId 必须属于受控能力集合');

    expectInvalidConfig((payload) => {
      payload.providers[0].models[0].displayName = '';
    }, 'model displayName 不能为空');

    expectInvalidConfig((payload) => {
      payload.providers[0].keyStatus.maskedLabel = 'Key 已配置 sk-real-value';
    }, 'keyStatus.maskedLabel 必须是低敏掩码');

    expectInvalidConfig((payload) => {
      payload.providers[0].keyStatus.kind = 'raw_key_available' as never;
    }, 'keyStatus.kind 必须是受控低敏状态');

    expectInvalidConfig((payload) => {
      payload.providers[0].syncStatus = 'real_sync_available' as never;
    }, 'syncStatus 必须是受控 dry-run 状态');

    expectInvalidConfig((payload) => {
      payload.providers[0].models[0].testStatus = 'real_test_available' as never;
    }, 'testStatus 必须是受控 dry-run 状态');

    expectInvalidConfig((payload) => {
      payload.scenarioDefaults[0].scenarioId = payload.scenarioDefaults[1].scenarioId;
    }, 'scenarioId 必须唯一');

    expectInvalidConfig((payload) => {
      payload.scenarioDefaults[0].defaultModelId = 'missing-model';
    }, 'defaultModelId 必须存在');

    expectInvalidConfig((payload) => {
      payload.scenarioDefaults[0].requiredCapability = 'embedding';
    }, 'requiredCapability 必须被 default model 覆盖');

    expectInvalidConfig((payload) => {
      payload.agentInheritance[0].inheritsScenarioId = 'missing-scenario';
    }, 'agent.inheritsScenarioId 必须存在于 scenarioDefaults.scenarioId');

    expectInvalidConfig((payload) => {
      payload.agentInheritance[0].inheritedModelId = 'missing-model';
    }, 'agent.inheritedModelId 必须存在于 modelId');
  });
});
