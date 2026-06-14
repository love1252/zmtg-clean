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

function expectInvalidRegistry(
  mutate: (payload: PlatformAiModelRegistryResponse) => void,
  expectedError: string,
) {
  const payload = cloneRegistry(getPlatformAiModelRegistryResponse());

  mutate(payload);

  expect(validatePlatformAiModelRegistryContract(payload).errors).toContain(expectedError);
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
      inheritsScenarioId: expect.any(String),
      inheritsScenarioName: expect.any(String),
      inheritedModelId: expect.any(String),
      inheritedModelName: expect.any(String),
    });
    expect(payload.capabilityCoverageRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capabilityId: 'vision',
        scenarioRefs: expect.arrayContaining([
          expect.objectContaining({
            scenarioName: '图片资料理解占位',
            scenarioStatus: 'future_placeholder',
          }),
        ]),
      }),
      expect.objectContaining({
        capabilityId: 'embedding',
        scenarioRefs: expect.arrayContaining([
          expect.objectContaining({
            scenarioName: '知识库召回占位',
            scenarioStatus: 'future_placeholder',
          }),
        ]),
      }),
    ]));
    expectLowSensitivePayload(payload);
  });

  it('校验 registry 引用关系完整且占位场景显式标记', () => {
    const payload = getPlatformAiModelRegistryResponse();
    const validation = validatePlatformAiModelRegistryContract(payload);

    expect(validation).toEqual({ ok: true, errors: [] });

    const providerIds = payload.providers.map((provider) => provider.providerId);
    expect(new Set(providerIds).size).toBe(providerIds.length);

    const modelIds = payload.providers.flatMap((provider) => provider.models.map((model) => model.modelId));
    expect(new Set(modelIds).size).toBe(modelIds.length);

    const capabilityIds = payload.capabilityGroups.map((group) => group.capabilityId);
    expect(new Set(capabilityIds).size).toBe(capabilityIds.length);

    payload.capabilityGroups.forEach((group) => {
      group.modelIds.forEach((modelId) => {
        const model = payload.providers
          .flatMap((provider) => provider.models)
          .find((item) => item.modelId === modelId);

        expect(model).toBeDefined();
        expect(model?.capabilityIds).toContain(group.capabilityId);
      });
    });

    const scenarioIds = payload.scenarioDefaults.map((scenario) => scenario.scenarioId);
    expect(new Set(scenarioIds).size).toBe(scenarioIds.length);

    payload.scenarioDefaults.forEach((scenario) => {
      const defaultModel = payload.providers
        .flatMap((provider) => provider.models)
        .find((model) => model.modelId === scenario.defaultModelId);

      expect(defaultModel).toBeDefined();
      expect(defaultModel?.capabilityIds).toContain(scenario.requiredCapability);
    });

    const knownScenarioNames = new Set(payload.scenarioDefaults.map((scenario) => scenario.scenarioName));
    const knownScenarioById = new Map(payload.scenarioDefaults.map((scenario) => [scenario.scenarioId, scenario]));
    const knownModelNames = new Set(payload.providers.flatMap((provider) => provider.models.map((model) => model.displayName)));
    const knownModelById = new Map(payload.providers.flatMap((provider) => provider.models.map((model) => [model.modelId, model])));
    payload.agentInheritance.forEach((agent) => {
      expect(knownScenarioNames.has(agent.inheritsScenarioName)).toBe(true);
      expect(knownScenarioById.get(agent.inheritsScenarioId)?.scenarioName).toBe(agent.inheritsScenarioName);
      expect(knownModelNames.has(agent.inheritedModelName)).toBe(true);
      expect(knownModelById.get(agent.inheritedModelId)?.displayName).toBe(agent.inheritedModelName);
    });

    const knownCapabilityIds = new Set(payload.capabilityGroups.map((group) => group.capabilityId));
    payload.capabilityCoverageRows.forEach((row) => {
      expect(knownCapabilityIds.has(row.capabilityId)).toBe(true);
      row.modelNames.forEach((modelName) => {
        expect(knownModelNames.has(modelName)).toBe(true);
      });
      expect(new Set(row.scenarioRefs.map((scenario) => scenario.scenarioName))).toEqual(new Set(row.scenarioNames));
      row.scenarioRefs.forEach((scenario) => {
        if (knownScenarioNames.has(scenario.scenarioName)) {
          expect(scenario.scenarioStatus).toBe('active');
        } else {
          expect(['placeholder', 'future_placeholder']).toContain(scenario.scenarioStatus);
        }
      });
    });
  });

  it('能发现 registry contract 破坏性数据问题', () => {
    expectInvalidRegistry((payload) => {
      payload.providers[1].providerId = payload.providers[0].providerId;
    }, 'providerId 必须唯一');

    expectInvalidRegistry((payload) => {
      payload.providers[1].models[0].modelId = payload.providers[0].models[0].modelId;
    }, 'modelId 必须唯一');

    expectInvalidRegistry((payload) => {
      payload.providers[0].models[0].capabilityIds = ['unknown-capability' as never];
    }, 'capabilityId 必须属于受控能力集合');

    expectInvalidRegistry((payload) => {
      payload.capabilityGroups[1].capabilityId = payload.capabilityGroups[0].capabilityId;
    }, 'capabilityGroups.capabilityId 必须唯一');

    expectInvalidRegistry((payload) => {
      payload.capabilityGroups[0].modelIds = ['missing-model'];
    }, 'capabilityGroups.modelIds 必须存在');

    expectInvalidRegistry((payload) => {
      payload.capabilityGroups[3].modelIds = ['qwen-plus-sample'];
    }, 'capabilityGroups.modelIds 对应模型必须声明该 capability');

    expectInvalidRegistry((payload) => {
      payload.scenarioDefaults[1].scenarioId = payload.scenarioDefaults[0].scenarioId;
    }, 'scenarioId 必须唯一');

    expectInvalidRegistry((payload) => {
      payload.scenarioDefaults[0].defaultModelId = 'missing-model';
    }, 'defaultModelId 必须存在');

    expectInvalidRegistry((payload) => {
      payload.scenarioDefaults[0].requiredCapability = 'embedding';
    }, 'requiredCapability 必须被 default model 覆盖');

    expectInvalidRegistry((payload) => {
      payload.agentInheritance[0].inheritsScenarioName = '不存在的场景';
    }, 'agent 继承场景必须存在');

    expectInvalidRegistry((payload) => {
      payload.agentInheritance[0].inheritedModelName = '不存在的模型';
    }, 'agent 继承模型必须存在');

    expectInvalidRegistry((payload) => {
      payload.agentInheritance[0].inheritsScenarioId = 'missing-scenario';
    }, 'agent.inheritsScenarioId 必须存在于 scenarioDefaults.scenarioId');

    expectInvalidRegistry((payload) => {
      payload.agentInheritance[0].inheritedModelId = 'missing-model';
    }, 'agent.inheritedModelId 必须存在于 registry modelId');

    expectInvalidRegistry((payload) => {
      payload.agentInheritance[0].inheritsScenarioId = payload.scenarioDefaults[1].scenarioId;
    }, 'agent.inheritsScenarioId 与 inheritsScenarioName 必须指向同一场景');

    expectInvalidRegistry((payload) => {
      payload.agentInheritance[0].inheritedModelId = payload.providers[1].models[0].modelId;
    }, 'agent.inheritedModelId 与 inheritedModelName 必须指向同一模型');

    expectInvalidRegistry((payload) => {
      payload.capabilityCoverageRows[0].capabilityId = 'unknown-capability' as never;
    }, 'coverage.capabilityId 必须存在');

    expectInvalidRegistry((payload) => {
      payload.capabilityCoverageRows[0].modelNames = ['不存在的示例模型'];
    }, 'coverage.modelNames 必须存在');

    expectInvalidRegistry((payload) => {
      payload.capabilityCoverageRows[0].scenarioRefs = [
        { scenarioName: 'AI 客服默认模型', scenarioStatus: 'active' },
      ];
    }, 'coverage.scenarioRefs 的 scenarioName 集合必须与 coverage.scenarioNames 集合一致');

    expectInvalidRegistry((payload) => {
      payload.capabilityCoverageRows[0].scenarioRefs = [
        { scenarioName: 'AI 客服默认模型', scenarioStatus: 'active' },
        { scenarioName: '未登记 active 场景', scenarioStatus: 'active' },
      ];
      payload.capabilityCoverageRows[0].scenarioNames = ['AI 客服默认模型', '未登记 active 场景'];
    }, 'coverage active 场景必须存在于 scenarioDefaults.scenarioName');

    expectInvalidRegistry((payload) => {
      payload.capabilityCoverageRows[0].scenarioRefs = [
        { scenarioName: 'AI 客服默认模型', scenarioStatus: 'active' },
        { scenarioName: '未登记待定场景', scenarioStatus: 'active' },
      ];
      payload.capabilityCoverageRows[0].scenarioNames = ['AI 客服默认模型', '未登记待定场景'];
    }, '不存在于 scenarioDefaults 的 coverage 场景必须标记 placeholder 或 future_placeholder');

    expectInvalidRegistry((payload) => {
      payload.capabilityCoverageRows[2].scenarioRefs = [
        {
          scenarioName: '图片资料理解占位',
          scenarioStatus: 'active',
        } as never,
      ];
    }, '未来占位场景必须显式标记 placeholder / future_placeholder');
  });
});
