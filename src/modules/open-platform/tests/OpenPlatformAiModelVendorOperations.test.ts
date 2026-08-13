import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as syncRoute from '@/app/api/v1/open-platform/ai-model-config/sync/route';
import * as testRoute from '@/app/api/v1/open-platform/ai-model-config/test/route';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { encryptSecret } from '@/modules/security/server/secretEncryption';
import {
  createAiModelVendorAdapter,
  runAiModelVendorSync,
  runAiModelVendorTest,
} from '@/modules/open-platform/server/platformAiModelVendorOperations';
import { getSupportedVendorConfig, listSupportedVendors, type SupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';
import type { VendorProviderConfigRecord } from '@/modules/open-platform/server/vendorProviderConfigTypes';

type MockVendorFetcher = (input: string, init?: RequestInit) => Promise<Response>;

const envKey = 'ZMTG_SECRET_ENCRYPTION_KEY';
const externalCallEnvKey = 'AI_MODEL_VENDOR_EXTERNAL_CALL_ENABLED';
const rawKey = 'vendor-operation-key-never-return-123456';
const forbiddenFragments = [
  rawKey,
  'apiKey',
  'secret',
  'encryptedKey',
  'encryptedApiKey',
  'ciphertext',
  'authTag',
  'iv',
  'DATABASE_URL',
  '/Users/',
  'stack',
  'tenant_ai_config',
  'decryptApiKey',
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

function configureEncryptionKey() {
  vi.stubEnv(envKey, randomBytes(32).toString('base64'));
}

function expectLowSensitivePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function makeRecord(vendor: SupportedVendor = 'doubao', overrides: Partial<VendorProviderConfigRecord> = {}): VendorProviderConfigRecord {
  return {
    id: `provider-config-${vendor}`,
    vendor,
    baseUrl: 'https://provider.example.test/v1',
    model: 'test-model',
    encryptedApiKey: encryptSecret(rawKey),
    configured: true,
    lastCheckStatus: 'not_checked',
    lastCheckedAt: null,
    createdAt: new Date('2026-06-19T00:00:00.000Z'),
    updatedAt: new Date('2026-06-19T00:00:00.000Z'),
    ...overrides,
  };
}

function repositoryWithRecord(record: VendorProviderConfigRecord | null) {
  return {
    findByVendor: vi.fn(async () => record),
  };
}

function createAuditRepository() {
  return {
    events: [] as unknown[],
    async recordAttributed(event: unknown) {
      this.events.push(event);
    },
  };
}

function createRateLimiter(allowed: boolean) {
  return {
    check: vi.fn(() => ({ allowed, retryAfterMs: allowed ? 0 : 60_000 })),
  };
}

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => ({})),
  createDatabaseUrlErrorMessage: vi.fn(),
}));

const routeRepository = repositoryWithRecord(null);
const routeAuditRepository = createAuditRepository();
const routeConfigRepository = {
  saved: [] as unknown[],
  async findSnapshot() {
    return null;
  },
  async upsertSnapshot(input: unknown) {
    this.saved.push(input);
    return {
      ...(input as object),
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
    };
  },
};
const routeFetch = vi.fn<MockVendorFetcher>();

vi.mock('@/modules/open-platform/server/vendorProviderConfigRepository', () => ({
  createVendorProviderConfigRepository: vi.fn(() => routeRepository),
}));

vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: vi.fn(() => routeAuditRepository),
}));

vi.mock('@/modules/open-platform/server/platformAiModelConfigPersistenceRepository', () => ({
  createPlatformAiModelConfigSnapshotRepository: vi.fn(() => routeConfigRepository),
}));

vi.mock('@/modules/open-platform/server/platformAiModelVendorOperations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/open-platform/server/platformAiModelVendorOperations')>();

  return {
    ...actual,
    createDefaultAiModelVendorAdapter: vi.fn(() => actual.createAiModelVendorAdapter({ fetcher: routeFetch, timeoutMs: 25 })),
  };
});

beforeEach(() => {
  configureEncryptionKey();
  vi.stubEnv(externalCallEnvKey, 'false');
  routeRepository.findByVendor.mockReset();
  routeRepository.findByVendor.mockResolvedValue(null);
  routeAuditRepository.events.length = 0;
  routeConfigRepository.saved.length = 0;
  routeFetch.mockReset();
  vi.mocked(getDemoAccessContextFromRequest).mockReset();
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformAdminContext);
});

describe('AI 模型厂商 adapter', () => {
  it('只有 DeepSeek 与 Kimi 使用官方模型列表接口', async () => {
    const cases: Array<[SupportedVendor, string]> = [
      ['deepseek', 'https://api.deepseek.com/models'],
      ['kimi', 'https://api.moonshot.ai/v1/models'],
    ];

    for (const [vendor, expectedEndpoint] of cases) {
      const fetcher = vi.fn<MockVendorFetcher>(async () => new Response(JSON.stringify({ data: [{ id: `${vendor}-model` }] }), { status: 200 }));
      const adapter = createAiModelVendorAdapter({ fetcher, timeoutMs: 25 });
      const vendorConfig = getSupportedVendorConfig(vendor);

      await adapter.syncModels({
        vendor,
        baseUrl: vendorConfig.defaultBaseUrl,
        apiKey: rawKey,
      });

      expect(String(fetcher.mock.calls[0][0])).toBe(expectedEndpoint);
    }
  });

  it('豆包、通义千问、智谱GLM 同步模型使用受控静态目录，不假设支持 /models', async () => {
    const cases: Array<[SupportedVendor, string]> = [
      ['doubao', 'doubao-seed-2-0-pro-260215'],
      ['qwen', 'qwen-plus-latest'],
      ['chatglm', 'glm-5.1'],
    ];

    for (const [vendor, expectedModelId] of cases) {
      const fetcher = vi.fn<MockVendorFetcher>();
      const adapter = createAiModelVendorAdapter({ fetcher, timeoutMs: 25 });
      const vendorConfig = getSupportedVendorConfig(vendor);

      const result = await adapter.syncModels({
        vendor,
        baseUrl: vendorConfig.defaultBaseUrl,
        apiKey: rawKey,
      });

      expect(fetcher).not.toHaveBeenCalled();
      expect(result.status).toBe('success');
      expect(result.syncedModels.map((model) => model.modelId)).toContain(expectedModelId);
      expectLowSensitivePayload(result);
    }
  });

  it('官方模型列表响应会解析多种结构，并只保留业务可用模型与能力归类', async () => {
    const fetcher = vi.fn<MockVendorFetcher>(async () => new Response(JSON.stringify({
      models: [
        { id: 'deepseek-v4-pro' },
        { model: 'deepseek-v4-flash' },
        { modelId: 'deepseek-r1-260101' },
        { name: 'deepseek-v3-2-251201' },
        { id: 'deepseek-embedding' },
        { id: 'OpenRouter/deepseek-r1' },
        { id: 'deepseek-free-chat' },
      ],
    }), { status: 200 }));
    const adapter = createAiModelVendorAdapter({ fetcher, timeoutMs: 25 });

    const result = await adapter.syncModels({
      vendor: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: rawKey,
    });

    expect(result.status).toBe('success');
    expect(result.syncedModels.map((model) => model.modelId)).toEqual([
      'deepseek-r1-260101',
      'deepseek-v4-pro',
      'deepseek-v4-flash',
      'deepseek-v3-2-251201',
      'deepseek-embedding',
    ]);
    expect(result.syncedModels.find((model) => model.modelId === 'deepseek-v4-pro')).toMatchObject({
      category: 'reasoning',
      capabilityIds: ['reasoning', 'text'],
    });
    expect(result.syncedModels.find((model) => model.modelId === 'deepseek-embedding')).toMatchObject({
      category: 'embedding',
      capabilityIds: ['embedding'],
    });
    expect(result.syncedModels.map((model) => model.modelId)).not.toContain('OpenRouter/deepseek-r1');
    expect(result.syncedModels.map((model) => model.modelId)).not.toContain('deepseek-free-chat');
    expect(result.syncedModels.filter((model) => model.category === 'reasoning')).toHaveLength(2);
    expect(result.syncedModels.filter((model) => model.category === 'text')).toHaveLength(2);
    expect(result.syncedModels.filter((model) => model.category === 'embedding')).toHaveLength(1);
    expectLowSensitivePayload(result);
  });

  it('官方模型列表响应兼容 data.models 嵌套结构，作为厂商响应差异的防御性解析', async () => {
    const fetcher = vi.fn<MockVendorFetcher>(async () => new Response(JSON.stringify({
      data: {
        models: [
          { id: 'deepseek-v4-flash' },
          { id: 'deepseek-embedding' },
        ],
      },
    }), { status: 200 }));
    const adapter = createAiModelVendorAdapter({ fetcher, timeoutMs: 25 });

    const result = await adapter.syncModels({
      vendor: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: rawKey,
    });

    expect(result.status).toBe('success');
    expect(result.syncedModels.map((model) => model.modelId)).toEqual([
      'deepseek-v4-flash',
      'deepseek-embedding',
    ]);
    expectLowSensitivePayload(result);
  });

  it('DeepSeek 同步模型使用 mock fetch 调用官方 /models，并返回低敏模型列表', async () => {
    const fetcher = vi.fn<MockVendorFetcher>(async () => new Response(JSON.stringify({
      data: [
        { id: 'deepseek-v4-flash' },
        { id: 'deepseek-v4-pro' },
      ],
    }), { status: 200 }));
    const adapter = createAiModelVendorAdapter({ fetcher, timeoutMs: 25 });

    const result = await adapter.syncModels({
      vendor: 'deepseek',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: rawKey,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe('https://api.deepseek.com/models');
    expect(fetcher.mock.calls[0][1]).toEqual(expect.objectContaining({
      method: 'GET',
      signal: expect.any(AbortSignal),
    }));
    expect(result).toMatchObject({
      ok: true,
      status: 'success',
      vendor: 'deepseek',
      syncedModels: [
        { modelId: 'deepseek-v4-pro', displayName: 'deepseek-v4-pro' },
        { modelId: 'deepseek-v4-flash', displayName: 'deepseek-v4-flash' },
      ],
      errorCode: null,
    });
    expectLowSensitivePayload(result);
  });

  it('模型测试按官方 OpenAI 兼容 chat/completions 端点构造请求', async () => {
    const cases: Array<[SupportedVendor, string]> = [
      ['doubao', 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'],
      ['deepseek', 'https://api.deepseek.com/v1/chat/completions'],
      ['qwen', 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'],
      ['chatglm', 'https://open.bigmodel.cn/api/paas/v4/chat/completions'],
      ['kimi', 'https://api.moonshot.ai/v1/chat/completions'],
    ];

    for (const [vendor, expectedEndpoint] of cases) {
      const fetcher = vi.fn<MockVendorFetcher>(async () => new Response(JSON.stringify({ id: 'ok' }), { status: 200 }));
      const adapter = createAiModelVendorAdapter({ fetcher, timeoutMs: 25 });
      const vendorConfig = getSupportedVendorConfig(vendor);

      const result = await adapter.testModel({
        vendor,
        baseUrl: vendorConfig.defaultBaseUrl,
        apiKey: rawKey,
        modelId: vendorConfig.defaultModel,
      });

      expect(result.status).toBe('success');
      expect(String(fetcher.mock.calls[0][0])).toBe(expectedEndpoint);
      expectLowSensitivePayload(result);
    }
  });

  it('模型测试使用 mock fetch 调用 chat/completions，并返回低敏成功状态', async () => {
    const fetcher = vi.fn<MockVendorFetcher>(async () => new Response(JSON.stringify({ id: 'completion-ok' }), { status: 200 }));
    const adapter = createAiModelVendorAdapter({ fetcher, timeoutMs: 25 });

    const result = await adapter.testModel({
      vendor: 'deepseek',
      baseUrl: 'https://provider.example.test/v1',
      apiKey: rawKey,
      modelId: 'deepseek-v4-flash',
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toBe('https://provider.example.test/v1/chat/completions');
    expect(String(fetcher.mock.calls[0][1]?.body)).toContain('deepseek-v4-flash');
    expect(result).toMatchObject({
      ok: true,
      status: 'success',
      vendor: 'deepseek',
      modelId: 'deepseek-v4-flash',
      errorCode: null,
    });
    expectLowSensitivePayload(result);
  });

  it('厂商失败和超时都返回脱敏错误，不暴露响应正文', async () => {
    const failedAdapter = createAiModelVendorAdapter({
      fetcher: vi.fn(async () => new Response(JSON.stringify({ error: rawKey }), { status: 500 })),
      timeoutMs: 25,
    });
    const timeoutAdapter = createAiModelVendorAdapter({
      fetcher: vi.fn<MockVendorFetcher>(async () => {
        throw new DOMException('aborted', 'AbortError');
      }),
      timeoutMs: 25,
    });

    const failed = await failedAdapter.syncModels({
      vendor: 'deepseek',
      baseUrl: 'https://provider.example.test/v1',
      apiKey: rawKey,
    });
    const timedOut = await timeoutAdapter.testModel({
      vendor: 'kimi',
      baseUrl: 'https://provider.example.test/v1',
      apiKey: rawKey,
      modelId: 'kimi-k2-5-260127',
    });

    expect(failed).toMatchObject({ ok: false, status: 'failed', errorCode: 'PROVIDER_UNAVAILABLE' });
    expect(timedOut).toMatchObject({ ok: false, status: 'timeout', errorCode: 'PROVIDER_TIMEOUT' });
    expectLowSensitivePayload(failed);
    expectLowSensitivePayload(timedOut);
  });
});

describe('AI 模型厂商同步与测试 service', () => {
  it('同步 5 家厂商时解密服务端 Key 并通过注入 adapter 外呼', async () => {
    const adapter = {
      syncModels: vi.fn(async (input) => ({
        ok: true,
        status: 'success' as const,
        vendor: input.vendor,
        syncedModels: [{ modelId: `${input.vendor}-model`, displayName: `${input.vendor}-model` }],
        latencyMs: 8,
        checkedAt: '2026-06-19T00:00:00.000Z',
        errorCode: null,
      })),
      testModel: vi.fn(),
    };
    const vendors: SupportedVendor[] = ['doubao', 'deepseek', 'qwen', 'chatglm', 'kimi'];

    for (const vendor of vendors) {
      const result = await runAiModelVendorSync({
        repository: repositoryWithRecord(makeRecord(vendor)),
        adapter,
        rateLimiter: createRateLimiter(true),
        vendor,
      });

      expect(result.status).toBe('completed');
      expect(result.payload.vendor).toBe(vendor);
      expectLowSensitivePayload(result);
    }

    expect(adapter.syncModels).toHaveBeenCalledTimes(5);
  });

  it('覆盖未配置 Key、限流和厂商不可用状态', async () => {
    const adapter = {
      syncModels: vi.fn(async () => ({
        ok: false,
        status: 'failed' as const,
        vendor: 'doubao' as const,
        syncedModels: [],
        latencyMs: 3,
        checkedAt: '2026-06-19T00:00:00.000Z',
        errorCode: 'PROVIDER_UNAVAILABLE' as const,
      })),
      testModel: vi.fn(),
    };

    const notConfigured = await runAiModelVendorSync({
      repository: repositoryWithRecord(null),
      adapter,
      rateLimiter: createRateLimiter(true),
      vendor: 'doubao',
    });
    const rateLimited = await runAiModelVendorTest({
      repository: repositoryWithRecord(makeRecord('doubao')),
      adapter,
      rateLimiter: createRateLimiter(false),
      vendor: 'doubao',
      modelId: 'doubao-seed-2-0-pro-260215',
    });
    const unavailable = await runAiModelVendorSync({
      repository: repositoryWithRecord(makeRecord('doubao')),
      adapter,
      rateLimiter: createRateLimiter(true),
      vendor: 'doubao',
    });

    expect(notConfigured.payload.status).toBe('not_configured');
    expect(rateLimited.payload.status).toBe('rate_limited');
    expect(unavailable.payload.errorCode).toBe('PROVIDER_UNAVAILABLE');
    expect(adapter.syncModels).toHaveBeenCalledTimes(1);
    expectLowSensitivePayload([notConfigured, rateLimited, unavailable]);
  });
});

describe('AI 模型厂商同步与测试 route', () => {
  it('同步 route 默认使用受控 dry-run adapter，不发起厂商外呼，并拒绝无权限访问', async () => {
    routeRepository.findByVendor.mockResolvedValue(makeRecord('doubao'));
    routeFetch.mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'doubao-real-model' }] }), { status: 200 }));

    const response = await syncRoute.POST(new Request('http://localhost/api/v1/open-platform/ai-model-config/sync', {
      method: 'POST',
      body: JSON.stringify({ vendor: 'doubao' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('success');
    expect(routeFetch).not.toHaveBeenCalled();
    expect(payload.syncedModels).toEqual([]);
    expect(routeAuditRepository.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resource: 'ai_model_config',
        action: 'update',
        result: 'allowed',
      }),
    ]));
    expectLowSensitivePayload(payload);
    expectLowSensitivePayload(routeAuditRepository.events);

    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformOperatorContext);
    const forbidden = await syncRoute.POST(new Request('http://localhost/api/v1/open-platform/ai-model-config/sync', {
      method: 'POST',
      body: JSON.stringify({ vendor: 'doubao' }),
    }));
    expect(forbidden.status).toBe(403);
    expectLowSensitivePayload(await forbidden.json());
    expect(routeAuditRepository.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resource: 'ai_model_config',
        action: 'update',
        result: 'denied',
      }),
    ]));

    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    const tenantForbidden = await testRoute.POST(new Request('http://localhost/api/v1/open-platform/ai-model-config/test', {
      method: 'POST',
      body: JSON.stringify({ vendor: 'doubao', modelId: 'doubao-seed-2-0-pro-260215' }),
    }));
    expect(tenantForbidden.status).toBe(403);
    expectLowSensitivePayload(await tenantForbidden.json());
    expect(routeAuditRepository.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        resource: 'ai_model_config',
        action: 'test_connection',
        result: 'denied',
      }),
    ]));
  });

  it('显式开启外呼时，测试 route 才通过注入 adapter 覆盖成功和厂商不可用状态', async () => {
    vi.stubEnv(externalCallEnvKey, 'true');
    routeRepository.findByVendor.mockResolvedValue(makeRecord('kimi'));
    routeFetch.mockResolvedValue(new Response(JSON.stringify({ id: 'ok' }), { status: 200 }));
    const success = await testRoute.POST(new Request('http://localhost/api/v1/open-platform/ai-model-config/test', {
      method: 'POST',
      body: JSON.stringify({ vendor: 'kimi', modelId: 'kimi-k2-5-260127' }),
    }));
    const successPayload = await success.json();

    expect(success.status).toBe(200);
    expect(successPayload.status).toBe('success');
    expect(routeFetch).toHaveBeenCalledTimes(1);
    expect(String(routeFetch.mock.calls[0][0])).toBe('https://provider.example.test/v1/chat/completions');

    routeRepository.findByVendor.mockResolvedValue(null);
    const notConfigured = await testRoute.POST(new Request('http://localhost/api/v1/open-platform/ai-model-config/test', {
      method: 'POST',
      body: JSON.stringify({ vendor: 'kimi', modelId: 'kimi-k2-5-260127' }),
    }));
    const notConfiguredPayload = await notConfigured.json();
    expect(notConfiguredPayload.status).toBe('not_configured');

    routeRepository.findByVendor.mockResolvedValue(makeRecord('kimi'));
    routeFetch.mockResolvedValue(new Response(JSON.stringify({ error: rawKey }), { status: 503 }));
    const unavailable = await testRoute.POST(new Request('http://localhost/api/v1/open-platform/ai-model-config/test', {
      method: 'POST',
      body: JSON.stringify({ vendor: 'kimi', modelId: 'kimi-k2-5-260127' }),
    }));
    const unavailablePayload = await unavailable.json();
    expect(unavailablePayload.errorCode).toBe('PROVIDER_UNAVAILABLE');

    expect(JSON.stringify(routeFetch.mock.calls)).not.toContain('ark.cn-beijing');
    expect(JSON.stringify(routeFetch.mock.calls)).not.toContain('api.deepseek.com');
    expect(JSON.stringify(routeFetch.mock.calls)).not.toContain('dashscope');
    expect(JSON.stringify(routeFetch.mock.calls)).not.toContain('moonshot');
    expectLowSensitivePayload([successPayload, notConfiguredPayload, unavailablePayload]);
  });

  it('显式开启外呼同步成功后，将 DeepSeek 官方模型列表写入 AI 模型配置快照', async () => {
    vi.stubEnv(externalCallEnvKey, 'true');
    routeRepository.findByVendor.mockResolvedValue(makeRecord('deepseek', {
      baseUrl: 'https://api.deepseek.com/v1',
    }));
    routeFetch.mockResolvedValue(new Response(JSON.stringify({
      data: [
        { id: 'deepseek-v4-flash' },
        { id: 'deepseek-v4-pro' },
        { id: 'deepseek-free-chat' },
      ],
    }), { status: 200 }));

    const response = await syncRoute.POST(new Request('http://localhost/api/v1/open-platform/ai-model-config/sync', {
      method: 'POST',
      body: JSON.stringify({ vendor: 'deepseek' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('success');
    expect(String(routeFetch.mock.calls[0][0])).toBe('https://api.deepseek.com/models');
    expect(payload.syncedModels.map((model: { modelId: string }) => model.modelId)).toEqual([
      'deepseek-v4-pro',
      'deepseek-v4-flash',
    ]);
    expect(routeConfigRepository.saved).toHaveLength(1);
    expect(JSON.stringify(routeConfigRepository.saved[0])).toContain('deepseek-v4-flash');
    expect(JSON.stringify(routeConfigRepository.saved[0])).not.toContain('deepseek-free-chat');
    expectLowSensitivePayload(payload);
    expectLowSensitivePayload(routeConfigRepository.saved);
  });

  it('显式开启外呼测试成功后，将模型测试结果写入 AI 模型配置快照', async () => {
    vi.stubEnv(externalCallEnvKey, 'true');
    routeRepository.findByVendor.mockResolvedValue(makeRecord('qwen', {
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    }));
    routeFetch.mockResolvedValue(new Response(JSON.stringify({ id: 'ok' }), { status: 200 }));

    const response = await testRoute.POST(new Request('http://localhost/api/v1/open-platform/ai-model-config/test', {
      method: 'POST',
      body: JSON.stringify({ vendor: 'qwen', modelId: 'qwen-plus-latest' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('success');
    expect(payload.modelId).toBe('qwen-plus-latest');
    expect(routeConfigRepository.saved).toHaveLength(1);
    expect(routeConfigRepository.saved[0]).toMatchObject({
      dryRunResults: [
        {
          targetType: 'model_test',
          targetId: 'qwen:qwen-plus-latest',
          status: 'dry_run',
          message: '测试已完成：qwen-plus-latest',
        },
      ],
    });
    expectLowSensitivePayload(payload);
    expectLowSensitivePayload(routeConfigRepository.saved);
  });

  it('测试 route 默认使用受控 dry-run adapter，不访问真实或注入厂商域名', async () => {
    routeRepository.findByVendor.mockResolvedValue(makeRecord('kimi'));
    routeFetch.mockResolvedValue(new Response(JSON.stringify({ id: 'ok' }), { status: 200 }));

    const response = await testRoute.POST(new Request('http://localhost/api/v1/open-platform/ai-model-config/test', {
      method: 'POST',
      body: JSON.stringify({ vendor: 'kimi', modelId: 'kimi-k2-5-260127' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe('success');
    expect(payload.modelId).toBe('kimi-k2-5-260127');
    expect(routeFetch).not.toHaveBeenCalled();
    expect(JSON.stringify(routeFetch.mock.calls)).not.toContain('ark.cn-beijing');
    expect(JSON.stringify(routeFetch.mock.calls)).not.toContain('api.deepseek.com');
    expect(JSON.stringify(routeFetch.mock.calls)).not.toContain('dashscope');
    expect(JSON.stringify(routeFetch.mock.calls)).not.toContain('moonshot');
    expectLowSensitivePayload(payload);
  });

  it('测试 route 默认 dry-run 时五家厂商不依赖已保存 Key 记录', async () => {
    const cases = listSupportedVendors().map((vendor) => ({
      vendor,
      modelId: getSupportedVendorConfig(vendor).defaultModel,
    }));

    for (const testCase of cases) {
      const response = await testRoute.POST(new Request('http://localhost/api/v1/open-platform/ai-model-config/test', {
        method: 'POST',
        body: JSON.stringify(testCase),
      }));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload).toMatchObject({
        vendor: testCase.vendor,
        modelId: testCase.modelId,
        status: 'success',
      });
      expectLowSensitivePayload(payload);
    }

    expect(routeRepository.findByVendor).not.toHaveBeenCalled();
    expect(routeFetch).not.toHaveBeenCalled();
  });
});
