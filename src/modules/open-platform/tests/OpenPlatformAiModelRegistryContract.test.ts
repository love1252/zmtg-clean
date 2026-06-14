import { describe, expect, it } from 'vitest';
import {
  getPlatformAiModelRegistryResponse,
  validatePlatformAiModelRegistryContract,
  type PlatformAiModelRegistryResponse,
} from '@/modules/open-platform/server/platformAiModelRegistryContract';

const forbiddenFragments = [
  'apiKey',
  'credential',
  'secret',
  'DATABASE_URL',
  'stack',
  '/Users/',
  'error_message',
  'tenant_id',
  'raw metadata',
  '账单金额',
  '应收',
  '发票',
  '扣费',
];

function expectLowSensitivePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function cloneRegistry(payload: PlatformAiModelRegistryResponse): PlatformAiModelRegistryResponse {
  return structuredClone(payload) as PlatformAiModelRegistryResponse;
}

describe('平台端 AI 模型 Registry 只读 contract', () => {
  it('返回受控只读 registry 状态和低敏结构', () => {
    const payload = getPlatformAiModelRegistryResponse();

    expect(payload).toMatchObject({
      readonly: true,
      dataSource: 'controlled_demo',
      registryVersion: 'ai-registry-v1-controlled-demo',
      registryStatus: 'controlled_readonly_demo',
      registryStatusNote: '当前为受控只读示例，不代表生产启用。',
      providers: expect.any(Array),
      capabilityGroups: expect.any(Array),
      scenarioDefaults: expect.any(Array),
      agentInheritance: expect.any(Array),
      capabilityCoverageRows: expect.any(Array),
    });
    expect(payload.providers.length).toBeGreaterThan(0);
    expect(payload.providers[0]).toMatchObject({
      providerId: expect.any(String),
      providerName: expect.any(String),
      models: expect.arrayContaining([
        expect.objectContaining({
          modelId: expect.any(String),
          displayName: expect.any(String),
          capabilityIds: expect.any(Array),
          contextWindowLabel: expect.any(String),
          status: expect.any(String),
          statusLabel: expect.any(String),
          recommendedScenarios: expect.any(Array),
        }),
      ]),
    });
    expect(payload.scenarioDefaults[0]).toMatchObject({
      scenarioId: expect.any(String),
      scenarioName: expect.any(String),
      requiredCapability: expect.any(String),
      defaultModelId: expect.any(String),
    });
    expect(payload.agentInheritance[0]).toMatchObject({
      agentName: expect.any(String),
      inheritsScenarioName: expect.any(String),
      inheritedModelName: expect.any(String),
    });
    expectLowSensitivePayload(payload);
  });

  it('校验 modelId 唯一、默认模型存在、能力匹配和 coverage 引用完整', () => {
    const payload = getPlatformAiModelRegistryResponse();
    const validation = validatePlatformAiModelRegistryContract(payload);

    expect(validation).toEqual({ ok: true, errors: [] });

    const modelIds = payload.providers.flatMap((provider) => provider.models.map((model) => model.modelId));
    expect(new Set(modelIds).size).toBe(modelIds.length);

    payload.scenarioDefaults.forEach((scenario) => {
      const defaultModel = payload.providers
        .flatMap((provider) => provider.models)
        .find((model) => model.modelId === scenario.defaultModelId);

      expect(defaultModel).toBeDefined();
      expect(defaultModel?.capabilityIds).toContain(scenario.requiredCapability);
    });

    const knownModelNames = new Set(payload.providers.flatMap((provider) => provider.models.map((model) => model.displayName)));
    payload.capabilityCoverageRows.forEach((row) => {
      row.modelNames.forEach((modelName) => {
        expect(knownModelNames.has(modelName)).toBe(true);
      });
    });
  });

  it('能发现 registry contract 破坏性数据问题', () => {
    const duplicateModelPayload = cloneRegistry(getPlatformAiModelRegistryResponse());
    duplicateModelPayload.providers[1].models[0].modelId = duplicateModelPayload.providers[0].models[0].modelId;
    expect(validatePlatformAiModelRegistryContract(duplicateModelPayload).errors).toContain('modelId 必须唯一');

    const missingDefaultPayload = cloneRegistry(getPlatformAiModelRegistryResponse());
    missingDefaultPayload.scenarioDefaults[0].defaultModelId = 'missing-model';
    expect(validatePlatformAiModelRegistryContract(missingDefaultPayload).errors).toContain('defaultModelId 必须存在');

    const capabilityMismatchPayload = cloneRegistry(getPlatformAiModelRegistryResponse());
    capabilityMismatchPayload.scenarioDefaults[0].requiredCapability = 'embedding';
    expect(validatePlatformAiModelRegistryContract(capabilityMismatchPayload).errors).toContain('requiredCapability 必须被 default model 覆盖');

    const missingCoveragePayload = cloneRegistry(getPlatformAiModelRegistryResponse());
    missingCoveragePayload.capabilityCoverageRows[0].modelNames = ['不存在的示例模型'];
    expect(validatePlatformAiModelRegistryContract(missingCoveragePayload).errors).toContain('capability coverage 不得引用不存在模型');
  });
});
