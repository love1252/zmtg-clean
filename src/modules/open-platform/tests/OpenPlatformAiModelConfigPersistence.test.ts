import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as routeModule from '@/app/api/v1/open-platform/ai-model-config/route';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import {
  getPlatformAiModelConfigPersistedView,
  savePlatformAiModelConfigPersistedView,
} from '@/modules/open-platform/server/platformAiModelConfigPersistence';
import type {
  PlatformAiModelConfigAuditRepository,
  PlatformAiModelConfigSnapshotRecord,
  PlatformAiModelConfigSnapshotRepository,
} from '@/modules/open-platform/server/platformAiModelConfigPersistenceTypes';

const rawKey = 'provider-key-value-raw-never-return-9876';
const forbiddenFragments = [
  rawKey,
  'apiKey',
  'encryptedKey',
  'encryptedApiKey',
  'ciphertext',
  'authTag',
  'DATABASE_URL',
  'sk-',
  '/Users/',
  'tenant_ai_config',
  'decryptApiKey',
  'fetch(',
];

const platformAdminContext = {
  userId: 'platform-admin',
  role: 'platform_admin' as const,
  scope: 'platform' as const,
  tenantId: null,
  institutionId: null,
  source: 'demo_session' as const,
};

const platformOperatorContext = {
  userId: 'platform-operator',
  role: 'platform_operator' as const,
  scope: 'platform' as const,
  tenantId: null,
  institutionId: null,
  source: 'demo_session' as const,
};

const tenantContext = {
  userId: 'tenant-user',
  role: 'tenant_admin' as const,
  scope: 'tenant' as const,
  tenantId: 'tenant-1',
  institutionId: null,
  source: 'demo_session' as const,
};

function expectSafePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function createRepository(initialRecord: PlatformAiModelConfigSnapshotRecord | null = null) {
  let record = initialRecord;

  return {
    saved: [] as PlatformAiModelConfigSnapshotRecord[],
    async findSnapshot() {
      return record;
    },
    async upsertSnapshot(input) {
      record = {
        id: input.id,
        scenarioDefaults: input.scenarioDefaults,
        agentInheritance: input.agentInheritance,
        modelStates: input.modelStates,
        providerStates: input.providerStates,
        dryRunResults: input.dryRunResults,
        updatedBy: input.updatedBy,
        createdAt: new Date('2026-06-19T00:00:00.000Z'),
        updatedAt: input.updatedAt,
      };
      this.saved.push(record);
      return record;
    },
  } satisfies PlatformAiModelConfigSnapshotRepository & {
    saved: PlatformAiModelConfigSnapshotRecord[];
  };
}

function createAuditRepository() {
  return {
    events: [] as unknown[],
    async recordAttributed(event) {
      this.events.push(event);
    },
  } satisfies PlatformAiModelConfigAuditRepository & {
    events: unknown[];
  };
}

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => ({})),
  createDatabaseUrlErrorMessage: vi.fn(),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

const routeRepository = createRepository();
const routeAuditRepository = createAuditRepository();

vi.mock('@/modules/open-platform/server/platformAiModelConfigPersistenceRepository', () => ({
  createPlatformAiModelConfigSnapshotRepository: vi.fn(() => routeRepository),
}));

vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: vi.fn(() => routeAuditRepository),
}));

beforeEach(() => {
  routeRepository.saved.length = 0;
  routeAuditRepository.events.length = 0;
  vi.mocked(getDemoAccessContextFromRequest).mockReset();
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformAdminContext);
});

describe('平台端 AI 模型配置持久化边界', () => {
  it('GET 在无持久化记录时返回 mock 基线的低敏持久化 DTO', async () => {
    const repository = createRepository();

    const view = await getPlatformAiModelConfigPersistedView({ repository });

    expect(view).toMatchObject({
      dataSource: 'persisted_boundary',
      persistenceMode: 'database',
      externalCallMode: 'blocked',
      dataExposureMode: 'masked_only',
      title: 'AI模型',
    });
    expect(view.providers).toHaveLength(5);
    expect(view.scenarioDefaults).toHaveLength(8);
    expect(view.agentInheritance).toHaveLength(3);
    expect(view.dryRunResults).toEqual([]);
    expect(view.providers.every((provider) => provider.keyStatus.maskedLabel.startsWith('Key 已配置 ****'))).toBe(true);
    expectSafePayload(view);
  });

  it('保存并读取应用默认配置、模型启用、厂商低敏状态、Logo 引用和 dry-run 结果', async () => {
    const repository = createRepository();

    const saveResult = await savePlatformAiModelConfigPersistedView({
      repository,
      accessContext: platformAdminContext,
      input: {
        scenarioDefaults: [
          { scenarioId: 'ai-customer-service', defaultModelId: 'deepseek-v4-flash' },
        ],
        modelStates: [
          { modelId: 'doubao-seed-2-0-mini-260215', enabled: true },
        ],
        providerStates: [
          {
            providerId: 'doubao',
            logoRef: 'data:image/png;base64,bG9nbw==',
            keyStatus: { kind: 'masked_configured', maskedLabel: 'Key 已配置 ****9876' },
            syncStatus: 'dry_run',
          },
        ],
        dryRunResults: [
          {
            targetType: 'provider_sync',
            targetId: 'doubao',
            status: 'dry_run',
            message: '同步 dry-run 已完成：豆包',
          },
        ],
      },
      now: new Date('2026-06-19T01:00:00.000Z'),
    });

    expect(saveResult.status).toBe('saved');
    if (saveResult.status !== 'saved') return;
    expect(saveResult.payload.scenarioDefaults.find((item) => item.scenarioId === 'ai-customer-service')?.defaultModelId).toBe('deepseek-v4-flash');
    expect(saveResult.payload.providers.find((item) => item.providerId === 'doubao')?.logoRef).toBe('data:image/png;base64,bG9nbw==');
    expect(saveResult.payload.providers.find((item) => item.providerId === 'doubao')?.keyStatus.maskedLabel).toBe('Key 已配置 ****9876');
    expect(saveResult.payload.providers.flatMap((provider) => provider.models).find((model) => model.modelId === 'doubao-seed-2-0-mini-260215')?.enabled).toBe(true);
    expect(saveResult.payload.dryRunResults).toHaveLength(1);
    expect(repository.saved).toHaveLength(1);
    expectSafePayload(saveResult);
  });

  it('保存同步模型后读取视图会合并到对应厂商模型列表', async () => {
    const repository = createRepository();

    const saveResult = await savePlatformAiModelConfigPersistedView({
      repository,
      accessContext: platformAdminContext,
      input: {
        providerStates: [
          {
            providerId: 'qwen',
            syncStatus: 'dry_run',
            syncedModels: [
              {
                modelId: 'qwen-max-latest',
                displayName: 'Qwen Max Latest',
                description: '通义千问官方模型列表实时拉取模型',
                pricingLabel: '按量计费',
                contextWindowLabel: '-',
                capabilityIds: ['text'],
                enabled: false,
                testStatus: 'dry_run',
              },
            ],
          },
        ] as never,
        dryRunResults: [
          {
            targetType: 'provider_sync',
            targetId: 'qwen',
            status: 'dry_run',
            message: '同步已完成：通义千问，模型数 1',
          },
        ],
      },
      now: new Date('2026-06-20T01:00:00.000Z'),
    });

    expect(saveResult.status).toBe('saved');
    if (saveResult.status !== 'saved') return;

    const qwenProvider = saveResult.payload.providers.find((provider) => provider.providerId === 'qwen');
    expect(qwenProvider?.models.map((model) => model.modelId)).toContain('qwen-max-latest');
    expect(qwenProvider?.models.find((model) => model.modelId === 'qwen-max-latest')).toMatchObject({
      displayName: 'Qwen Max Latest',
      capabilityIds: ['text'],
      enabled: false,
      testStatus: 'dry_run',
    });
    expect(saveResult.payload.dryRunResults[0].message).toBe('同步已完成：通义千问，模型数 1');
    expectSafePayload(saveResult);
  });

  it('允许客户端 150KB 限制内图片转换后的 Logo data URL', async () => {
    const repository = createRepository();
    const clientAllowedLogoDataUrl = `data:image/png;base64,${'A'.repeat(204800)}`;

    const saveResult = await savePlatformAiModelConfigPersistedView({
      repository,
      accessContext: platformAdminContext,
      input: {
        providerStates: [
          {
            providerId: 'doubao',
            logoRef: clientAllowedLogoDataUrl,
          },
        ],
      },
      now: new Date('2026-06-19T01:00:00.000Z'),
    });

    expect(saveResult.status).toBe('saved');
    if (saveResult.status !== 'saved') return;
    expect(saveResult.payload.providers.find((item) => item.providerId === 'doubao')?.logoRef).toBe(clientAllowedLogoDataUrl);
    expect(repository.saved).toHaveLength(1);
    expectSafePayload(saveResult);
  });

  it('为客户端 150KB Logo 转 data URL 保留服务端校验余量，并继续拒绝超限数据', async () => {
    const repository = createRepository();
    const logoWithinServerMargin = `data:image/png;base64,${'A'.repeat(235000)}`;
    const oversizedLogo = `data:image/png;base64,${'A'.repeat(260001)}`;

    const accepted = await savePlatformAiModelConfigPersistedView({
      repository,
      accessContext: platformAdminContext,
      input: {
        providerStates: [
          {
            providerId: 'doubao',
            logoRef: logoWithinServerMargin,
          },
        ],
      },
      now: new Date('2026-06-20T01:00:00.000Z'),
    });

    expect(accepted.status).toBe('saved');
    if (accepted.status !== 'saved') return;
    expect(accepted.payload.providers.find((item) => item.providerId === 'doubao')?.logoRef).toBe(logoWithinServerMargin);

    const rejected = await savePlatformAiModelConfigPersistedView({
      repository,
      accessContext: platformAdminContext,
      input: {
        providerStates: [
          {
            providerId: 'doubao',
            logoRef: oversizedLogo,
          },
        ],
      },
      now: new Date('2026-06-20T01:00:00.000Z'),
    });

    expect(rejected.status).toBe('validation_failed');
  });

  it('允许非凭证格式的短 sk- 业务文本，但仍拒绝真实 Key 形态文本', async () => {
    const repository = createRepository();
    const fakeCredentialShape = `sk-${'1'.repeat(36)}`;

    const accepted = await savePlatformAiModelConfigPersistedView({
      repository,
      accessContext: platformAdminContext,
      input: {
        dryRunResults: [
          {
            targetType: 'all_config',
            targetId: 'workflow-sk-note',
            status: 'dry_run',
            message: '保存 workflow-sk-note 配置',
          },
        ],
      },
      now: new Date('2026-06-20T01:00:00.000Z'),
    });

    expect(accepted.status).toBe('saved');

    const rejected = await savePlatformAiModelConfigPersistedView({
      repository,
      accessContext: platformAdminContext,
      input: {
        dryRunResults: [
          {
            targetType: 'all_config',
            targetId: 'provider',
            status: 'dry_run',
            message: `保存失败 ${fakeCredentialShape}`,
          },
        ],
      },
      now: new Date('2026-06-20T01:00:00.000Z'),
    });

    expect(rejected.status).toBe('validation_failed');
  });

  it('拒绝未知场景、模型、厂商和非低敏 Key 状态', async () => {
    const repository = createRepository();

    const result = await savePlatformAiModelConfigPersistedView({
      repository,
      accessContext: platformAdminContext,
      input: {
        scenarioDefaults: [{ scenarioId: 'missing-scenario', defaultModelId: 'deepseek-v4-flash' }],
        modelStates: [{ modelId: 'missing-model', enabled: true }],
        providerStates: [
          {
            providerId: 'missing-provider',
            keyStatus: { kind: 'masked_configured', maskedLabel: `Key 已配置 ${rawKey}` },
          },
        ],
      },
    });

    expect(result).toEqual({
      status: 'validation_failed',
      payload: { ok: false, errorCode: 'VALIDATION_FAILED' },
    });
    expect(repository.saved).toEqual([]);
    expectSafePayload(result);
  });

  it('API GET/PUT 使用平台权限和审计记录，响应不返回敏感字段', async () => {
    const getResponse = await routeModule.GET(
      new Request('http://localhost/api/v1/open-platform/ai-model-config'),
    );
    expect(getResponse.status).toBe(200);
    expectSafePayload(await getResponse.json());
    expect(routeAuditRepository.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource: 'ai_model_config',
          action: 'read_detail',
          result: 'allowed',
        }),
      ]),
    );

    const putResponse = await routeModule.PUT(
      new Request('http://localhost/api/v1/open-platform/ai-model-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerStates: [
            {
              providerId: 'doubao',
              keyStatus: { kind: 'masked_configured', maskedLabel: 'Key 已配置 ****9876' },
            },
          ],
        }),
      }),
    );

    expect(putResponse.status).toBe(200);
    expectSafePayload(await putResponse.json());
    expect(routeAuditRepository.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource: 'ai_model_config',
          action: 'update',
          result: 'allowed',
        }),
      ]),
    );
  });

  it('API 对未登录、租户端和无写权限平台角色返回低敏拒绝并记录拒绝审计', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const unauthorized = await routeModule.GET(new Request('http://localhost/api/v1/open-platform/ai-model-config'));
    expect(unauthorized.status).toBe(401);
    expectSafePayload(await unauthorized.json());

    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    const forbiddenTenant = await routeModule.GET(new Request('http://localhost/api/v1/open-platform/ai-model-config'));
    expect(forbiddenTenant.status).toBe(403);
    expectSafePayload(await forbiddenTenant.json());

    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformOperatorContext);
    const forbiddenWrite = await routeModule.PUT(
      new Request('http://localhost/api/v1/open-platform/ai-model-config', {
        method: 'PUT',
        body: JSON.stringify({ scenarioDefaults: [] }),
      }),
    );
    expect(forbiddenWrite.status).toBe(403);
    expectSafePayload(await forbiddenWrite.json());
    expect(routeAuditRepository.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resource: 'ai_model_config',
          action: 'read_detail',
          result: 'denied',
        }),
        expect.objectContaining({
          resource: 'ai_model_config',
          action: 'update',
          result: 'denied',
        }),
      ]),
    );
  });
});
