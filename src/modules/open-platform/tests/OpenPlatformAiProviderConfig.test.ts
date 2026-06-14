import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as providerConfigRoute from '@/app/api/v1/open-platform/ai-runtime/provider-config/route';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import {
  savePlatformAiProviderConfig,
  getPlatformAiProviderConfigStatus,
  type PlatformAiProviderConfigRepository,
} from '@/modules/open-platform/server/platformAiProviderConfig';

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

const providerConfigUrl = 'http://localhost/api/v1/open-platform/ai-runtime/provider-config';
const envKey = 'ZMTG_SECRET_ENCRYPTION_KEY';
const sensitiveKey = 'provider-test-key-never-return';
const forbiddenFragments = [
  sensitiveKey,
  'apiKey',
  'ciphertext',
  'authTag',
  'iv',
  'runtime-auth-redacted-value',
  'DATABASE_URL',
  'stack',
  '/Users/',
  'error_message',
  'tenant_id',
  'raw metadata',
];

const platformAccessContext = {
  userId: 'platform-admin',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  institutionId: null,
  source: 'demo_session',
} as const;

function configureEncryptionKey() {
  vi.stubEnv(envKey, randomBytes(32).toString('base64'));
}

function createRepository(): PlatformAiProviderConfigRepository & {
  saved: unknown[];
} {
  const saved: unknown[] = [];
  let record: Awaited<ReturnType<PlatformAiProviderConfigRepository['findProviderConfig']>> = null;

  return {
    saved,
    async findProviderConfig() {
      return record;
    },
    async upsertProviderConfig(input) {
      saved.push(input);
      record = {
        id: 'platform-ai-provider-config-default',
        provider: input.provider,
        baseUrl: input.baseUrl,
        model: input.model,
        encryptedApiKey: input.encryptedApiKey,
        configured: input.configured,
        lastCheckStatus: 'not_checked',
        lastCheckedAt: null,
        createdAt: new Date('2026-06-15T00:00:00.000Z'),
        updatedAt: input.updatedAt,
      };
      return record;
    },
  };
}

function expectLowSensitivePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  forbiddenFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');

  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(getDemoAccessContextFromRequest).mockReset();
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformAccessContext);
});

describe('平台端 AI provider config 安全保存', () => {
  it('GET 未配置时只返回低敏状态，不泄露 Key 或密文字段', async () => {
    const repository = createRepository();

    const status = await getPlatformAiProviderConfigStatus({ repository });

    expect(status).toEqual({
      configured: false,
      provider: null,
      model: null,
      baseUrlConfigured: false,
      lastCheckStatus: 'not_checked',
      lastCheckedAt: null,
      updatedAt: null,
    });
    expectLowSensitivePayload(status);
  });

  it('POST 保存时加密后入库，response 不泄露 Key、密文、后四位、长度或 hash', async () => {
    configureEncryptionKey();
    const repository = createRepository();

    const result = await savePlatformAiProviderConfig({
      repository,
      input: {
        provider: 'openai_compatible',
        baseUrl: 'https://provider.example.test/v1',
        model: 'gpt-provider-config',
        apiKey: sensitiveKey,
      },
      now: new Date('2026-06-15T00:00:00.000Z'),
    });

    expect(result.status).toBe('saved');
    expect(result.payload).toMatchObject({
      configured: true,
      provider: 'openai_compatible',
      model: 'gpt-provider-config',
      baseUrlConfigured: true,
      lastCheckStatus: 'not_checked',
      updatedAt: '2026-06-15T00:00:00.000Z',
    });
    expectLowSensitivePayload(result.payload);
    expect(JSON.stringify(repository.saved)).not.toContain(sensitiveKey);
    expect(JSON.stringify(repository.saved)).toContain('AES-256-GCM');
  });

  it('POST 缺少加密主密钥时返回低敏失败且不保存', async () => {
    vi.stubEnv(envKey, undefined);
    const repository = createRepository();

    const result = await savePlatformAiProviderConfig({
      repository,
      input: {
        provider: 'openai_compatible',
        baseUrl: 'https://provider.example.test/v1',
        model: 'gpt-provider-config',
        apiKey: sensitiveKey,
      },
      now: new Date('2026-06-15T00:00:00.000Z'),
    });

    expect(result).toEqual({
      status: 'encryption_unavailable',
      payload: {
        ok: false,
        errorCode: 'ENCRYPTION_NOT_CONFIGURED',
      },
    });
    expect(repository.saved).toEqual([]);
    expectLowSensitivePayload(result);
  });
});

describe('平台端 AI provider config route', () => {
  it('只导出 GET/POST', () => {
    expect(Object.keys(providerConfigRoute).sort()).toEqual(['GET', 'POST']);
  });

  it('POST 未授权不能保存', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);

    const response = await providerConfigRoute.POST(new Request(providerConfigUrl, {
      method: 'POST',
      body: JSON.stringify({
        provider: 'openai_compatible',
        baseUrl: 'https://provider.example.test/v1',
        model: 'gpt-provider-config',
        apiKey: sensitiveKey,
      }),
    }));
    const payload = await readJson(response);

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      ok: false,
      errorCode: 'UNAUTHORIZED',
    });
    expectLowSensitivePayload(payload);
  });
});
