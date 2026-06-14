import { afterEach, describe, expect, it, vi } from 'vitest';
import * as statusRoute from '@/app/api/v1/open-platform/ai-runtime/status/route';
import {
  getPlatformAiRuntimeStatus,
  readPlatformAiRuntimeConfig,
} from '@/modules/open-platform/server/platformAiRuntimeConfig';

const runtimeStatusUrl = 'http://localhost/api/v1/open-platform/ai-runtime/status';
const forbiddenFragments = [
  'runtime-auth-redacted-value-1234',
  'sk_test',
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

function clearRuntimeEnv() {
  vi.unstubAllEnvs();
  vi.stubEnv('ZMTG_AI_RUNTIME_ENABLED', undefined);
  vi.stubEnv('ZMTG_AI_PROVIDER', undefined);
  vi.stubEnv('ZMTG_AI_BASE_URL', undefined);
  vi.stubEnv('ZMTG_AI_API_KEY', undefined);
  vi.stubEnv('ZMTG_AI_MODEL', undefined);
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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('平台端 AI runtime env-only config/status', () => {
  it('status route 只导出 GET', () => {
    expect(Object.keys(statusRoute).sort()).toEqual(['GET']);
  });

  it('env 缺失时返回 disabled/unconfigured 且不泄露 Key', async () => {
    clearRuntimeEnv();

    const config = readPlatformAiRuntimeConfig();
    const status = getPlatformAiRuntimeStatus();
    const routeResponse = await statusRoute.GET(new Request(runtimeStatusUrl));
    const routePayload = await readJson(routeResponse);

    expect(config).toMatchObject({
      enabled: false,
      configured: false,
      provider: null,
      model: null,
      baseUrlConfigured: false,
      missingKeys: [
        'ZMTG_AI_RUNTIME_ENABLED',
        'ZMTG_AI_PROVIDER',
        'ZMTG_AI_BASE_URL',
        'ZMTG_AI_API_KEY',
        'ZMTG_AI_MODEL',
      ],
    });
    expect(config).not.toHaveProperty('apiKey');
    expect(status).toEqual(routePayload);
    expect(routePayload).toMatchObject({
      readonly: true,
      dataSource: 'env_only',
      enabled: false,
      configured: false,
      provider: null,
      model: null,
      baseUrlConfigured: false,
      safety: expect.objectContaining({
        keyPolicy: 'API Key 仅从服务端环境变量读取，不在页面输入、不回显、不保存。',
        smokePolicy: '真实调用仅用于固定 smoke test，不接收用户 prompt。',
      }),
    });
    expectLowSensitivePayload(routePayload);
  });

  it('env 完整时返回 configured=true 但不泄露 Key 明文、后四位、长度或 hash', async () => {
    vi.stubEnv('ZMTG_AI_RUNTIME_ENABLED', 'true');
    vi.stubEnv('ZMTG_AI_PROVIDER', 'openai_compatible');
    vi.stubEnv('ZMTG_AI_BASE_URL', 'https://runtime.example.test/v1');
    vi.stubEnv('ZMTG_AI_API_KEY', 'runtime-auth-redacted-value-1234');
    vi.stubEnv('ZMTG_AI_MODEL', 'gpt-runtime-smoke');

    const config = readPlatformAiRuntimeConfig();
    const routeResponse = await statusRoute.GET(new Request(runtimeStatusUrl));
    const routePayload = await readJson(routeResponse);

    expect(config).toMatchObject({
      enabled: true,
      configured: true,
      provider: 'openai_compatible',
      model: 'gpt-runtime-smoke',
      baseUrlConfigured: true,
      missingKeys: [],
    });
    expect(config).not.toHaveProperty('apiKey');
    expect(routePayload).toMatchObject({
      readonly: true,
      dataSource: 'env_only',
      enabled: true,
      configured: true,
      provider: 'openai_compatible',
      model: 'gpt-runtime-smoke',
      baseUrlConfigured: true,
      missingKeys: [],
    });
    expect(JSON.stringify(routePayload)).not.toContain('1234');
    expect(JSON.stringify(routePayload)).not.toContain('runtime-auth-redacted-value-1234');
    expectLowSensitivePayload(routePayload);
  });
});
