import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as smokeRoute from '@/app/api/v1/open-platform/ai-runtime/smoke/route';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { runPlatformAiRuntimeSmokeTest } from '@/modules/open-platform/server/platformAiRuntimeSmoke';
import {
  savePlatformAiProviderConfig,
  type PlatformAiProviderConfigRepository,
} from '@/modules/open-platform/server/platformAiProviderConfig';

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

const runtimeSmokeUrl = 'http://localhost/api/v1/open-platform/ai-runtime/smoke';
const forbiddenFragments = [
  'provider exploded',
  'runtime-auth-redacted-value-1234',
  'apiKey',
  'credential',
  'secret',
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
  vi.stubEnv('ZMTG_SECRET_ENCRYPTION_KEY', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
}

function createProviderConfigRepository(): PlatformAiProviderConfigRepository {
  let record: Awaited<ReturnType<PlatformAiProviderConfigRepository['findProviderConfig']>> = null;

  return {
    async findProviderConfig() {
      return record;
    },
    async upsertProviderConfig(input) {
      record = {
        id: 'platform-ai-provider-config-default',
        provider: input.provider,
        baseUrl: input.baseUrl,
        model: input.model,
        encryptedApiKey: input.encryptedApiKey,
        configured: input.configured,
        lastCheckStatus: 'not_checked',
        lastCheckedAt: null,
        createdAt: new Date('2026-06-14T12:00:00.000Z'),
        updatedAt: input.updatedAt,
      };
      return record;
    },
  };
}

function clearRuntimeEnv() {
  vi.unstubAllEnvs();
  vi.stubEnv('ZMTG_AI_RUNTIME_ENABLED', undefined);
  vi.stubEnv('ZMTG_AI_PROVIDER', undefined);
  vi.stubEnv('ZMTG_AI_BASE_URL', undefined);
  vi.stubEnv('ZMTG_AI_API_KEY', undefined);
  vi.stubEnv('ZMTG_AI_MODEL', undefined);
}

function stubConfiguredRuntimeEnv() {
  vi.stubEnv('ZMTG_AI_RUNTIME_ENABLED', 'true');
  vi.stubEnv('ZMTG_AI_PROVIDER', 'openai_compatible');
  vi.stubEnv('ZMTG_AI_BASE_URL', 'https://runtime.example.test/v1/');
  vi.stubEnv('ZMTG_AI_API_KEY', 'runtime-auth-redacted-value-1234');
  vi.stubEnv('ZMTG_AI_MODEL', 'gpt-runtime-smoke');
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
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-14T12:00:00.000Z'));
  vi.mocked(getDemoAccessContextFromRequest).mockReset();
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformAccessContext);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('平台端 AI runtime smoke route', () => {
  it('只导出 POST route，不暴露 GET 或其他 mutation 能力', () => {
    expect(Object.keys(smokeRoute).sort()).toEqual(['POST']);
  });

  it('未授权 smoke 不调用 fetch 并返回低敏错误码', async () => {
    stubConfiguredRuntimeEnv();
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const routeResponse = await smokeRoute.POST(new Request(runtimeSmokeUrl, { method: 'POST' }));
    const routePayload = await readJson(routeResponse);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(routeResponse.status).toBe(401);
    expect(routePayload).toMatchObject({
      ok: false,
      status: 'failed',
      latencyMs: 0,
      provider: null,
      model: null,
      checkedAt: '2026-06-14T12:00:00.000Z',
      errorCode: 'UNAUTHORIZED',
    });
    expectLowSensitivePayload(routePayload);
  });

  it('授权但 runtime disabled/config missing 时不调用 fetch 并返回低敏错误码', async () => {
    clearRuntimeEnv();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const serviceResult = await runPlatformAiRuntimeSmokeTest();
    const routeResponse = await smokeRoute.POST(new Request(runtimeSmokeUrl, {
      method: 'POST',
      body: JSON.stringify({ prompt: 'ignore user prompt' }),
    }));
    const routePayload = await readJson(routeResponse);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(serviceResult).toMatchObject({
      ok: false,
      status: 'skipped',
      errorCode: 'RUNTIME_NOT_CONFIGURED',
      provider: null,
      model: null,
    });
    expect(routeResponse.status).toBe(200);
    expect(routePayload).toMatchObject(serviceResult);
    expectLowSensitivePayload(routePayload);
  });

  it('runtime configured 时使用固定低敏 prompt 调用 OpenAI-compatible chat completions', async () => {
    stubConfiguredRuntimeEnv();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'OK' } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const routeResponse = await smokeRoute.POST(new Request(runtimeSmokeUrl, {
      method: 'POST',
      body: JSON.stringify({ prompt: 'This must not be forwarded' }),
    }));
    const routePayload = await readJson(routeResponse);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(init.body));

    expect(routeResponse.status).toBe(200);
    expect(routePayload).toMatchObject({
      ok: true,
      status: 'ok',
      provider: 'openai_compatible',
      model: 'gpt-runtime-smoke',
      errorCode: null,
      checkedAt: '2026-06-14T12:00:00.000Z',
    });
    expect(routePayload.latencyMs).toEqual(expect.any(Number));
    expect(url).toBe('https://runtime.example.test/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers).not.toEqual(expect.objectContaining({
      authorization: expect.stringContaining('runtime-auth-redacted-value-1234'),
    }));
    expect(requestBody).toMatchObject({
      model: 'gpt-runtime-smoke',
      messages: [{ role: 'user', content: 'Return OK only.' }],
      temperature: 0,
      max_tokens: 4,
    });
    expect(JSON.stringify(requestBody)).not.toContain('This must not be forwarded');
    expectLowSensitivePayload(routePayload);
  });

  it('优先使用已保存 provider config 调用固定 prompt，不依赖 env-only Key', async () => {
    clearRuntimeEnv();
    configureEncryptionKey();
    const providerConfigRepository = createProviderConfigRepository();
    await savePlatformAiProviderConfig({
      repository: providerConfigRepository,
      input: {
        provider: 'openai_compatible',
        baseUrl: 'https://saved-provider.example.test/v1/',
        model: 'gpt-saved-provider',
        apiKey: 'saved-provider-auth-redacted-value',
      },
      now: new Date('2026-06-14T12:00:00.000Z'),
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: 'OK' } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const serviceResult = await runPlatformAiRuntimeSmokeTest({ providerConfigRepository });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const requestBody = JSON.parse(String(init.body));

    expect(serviceResult).toMatchObject({
      ok: true,
      status: 'ok',
      provider: 'openai_compatible',
      model: 'gpt-saved-provider',
      errorCode: null,
    });
    expect(url).toBe('https://saved-provider.example.test/v1/chat/completions');
    expect(requestBody).toMatchObject({
      model: 'gpt-saved-provider',
      messages: [{ role: 'user', content: 'Return OK only.' }],
      temperature: 0,
      max_tokens: 4,
    });
    expect(JSON.stringify(requestBody)).not.toContain('saved-provider-auth-redacted-value');
    expectLowSensitivePayload(serviceResult);
  });

  it('provider 失败时返回安全错误码且不暴露 provider error 原文', async () => {
    stubConfiguredRuntimeEnv();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'provider exploded with runtime-auth-redacted-value-1234' },
    }), { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const routeResponse = await smokeRoute.POST(new Request(runtimeSmokeUrl, { method: 'POST' }));
    const routePayload = await readJson(routeResponse);

    expect(routeResponse.status).toBe(200);
    expect(routePayload).toMatchObject({
      ok: false,
      status: 'failed',
      provider: 'openai_compatible',
      model: 'gpt-runtime-smoke',
      errorCode: 'PROVIDER_REQUEST_FAILED',
    });
    expectLowSensitivePayload(routePayload);
  });
});
