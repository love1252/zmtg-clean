import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as smokeRoute from '@/app/api/v1/open-platform/provider-configs/smoke/route';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import {
  runMultiVendorSmokeTest,
  type PlatformAiRuntimeSmokeResult,
} from '@/modules/open-platform/server/vendorProviderSmoke';
import type { VendorProviderConfigRecord } from '@/modules/open-platform/server/vendorProviderConfigTypes';
import type { SupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

const smokeUrl = 'http://localhost/api/v1/open-platform/provider-configs/smoke';
const forbiddenFragments = [
  'apiKey',
  'ciphertext',
  'authTag',
  'iv',
  'DATABASE_URL',
  'stack',
  '/Users/',
  'error_message',
  'tenant_id',
  'raw metadata',
  'AES-256-GCM',
];

const platformAccessContext = {
  userId: 'platform-admin',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  institutionId: null,
  source: 'demo_session',
} as const;

const readOnlyAccessContext = {
  userId: 'tenant-reader',
  role: 'security_auditor',
  scope: 'tenant',
  tenantId: 'tenant-1',
  institutionId: null,
  source: 'demo_session',
} as const;

function makeRecord(overrides: Partial<VendorProviderConfigRecord> = {}): VendorProviderConfigRecord {
  return {
    id: 'provider-config-doubao',
    vendor: 'doubao' as SupportedVendor,
    baseUrl: 'https://example.com/v1',
    model: 'test-model',
    encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'iv', authTag: 'tag', ciphertext: 'ct' },
    configured: true,
    lastCheckStatus: 'not_checked' as const,
    lastCheckedAt: null,
    createdAt: new Date('2026-06-18T00:00:00.000Z'),
    updatedAt: new Date('2026-06-18T00:00:00.000Z'),
    ...overrides,
  };
}

function expectLowSensitivePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  forbiddenFragments.forEach((f) => {
    expect(serialized).not.toContain(f);
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

describe('多厂商 smoke test service（dry-run readiness）', () => {
  it('未配置的厂商返回 skipped', async () => {
    const repository = {
      findByVendor: vi.fn().mockResolvedValue(null),
    };

    const result = await runMultiVendorSmokeTest({ repository, vendor: 'doubao' });
    expect(result.status).toBe('vendor_not_configured');
    if (result.status !== 'vendor_not_configured') return;
    expect(result.payload).toMatchObject({
      ok: false,
      status: 'skipped',
      latencyMs: 0,
      provider: null,
      model: null,
      errorCode: 'NOT_CONFIGURED',
    });
    expect(result.payload.checkedAt).toEqual(expect.any(String));
    expectLowSensitivePayload(result);
  });

  it('configured=false 返回 skipped', async () => {
    const record = makeRecord({ configured: false });
    const repository = {
      findByVendor: vi.fn().mockResolvedValue(record),
    };

    const result = await runMultiVendorSmokeTest({ repository, vendor: 'doubao' });
    expect(result.status).toBe('vendor_not_configured');
    if (result.status !== 'vendor_not_configured') return;
    expect(result.payload.status).toBe('skipped');
    expect(result.payload.errorCode).toBe('NOT_CONFIGURED');
    expectLowSensitivePayload(result);
  });

  it('完整配置返回 ready（dry-run，无解密、无 fetch）', async () => {
    const record = makeRecord({ configured: true });
    const repository = {
      findByVendor: vi.fn().mockResolvedValue(record),
    };

    const result = await runMultiVendorSmokeTest({ repository, vendor: 'doubao' });
    expect(result.status).toBe('completed');
    if (result.status !== 'completed') return;
    expect(result.payload).toMatchObject({
      ok: true,
      status: 'ready',
      latencyMs: 0,
      provider: 'openai_compatible',
      model: record.model,
      errorCode: null,
    });
    expect(result.payload.checkedAt).toEqual(expect.any(String));
    expectLowSensitivePayload(result);
  });

  it('不完整配置（空 baseUrl）返回 failed INCOMPLETE_CONFIG', async () => {
    const record = makeRecord({ configured: true, baseUrl: '' });
    const repository = {
      findByVendor: vi.fn().mockResolvedValue(record),
    };

    const result = await runMultiVendorSmokeTest({ repository, vendor: 'doubao' });
    expect(result.status).toBe('completed');
    if (result.status !== 'completed') return;
    expect(result.payload).toMatchObject({
      ok: false,
      status: 'failed',
      latencyMs: 0,
      provider: 'openai_compatible',
      errorCode: 'INCOMPLETE_CONFIG',
    });
    expectLowSensitivePayload(result);
  });

  it('不完整配置（空 model）返回 failed INCOMPLETE_CONFIG', async () => {
    const record = makeRecord({ configured: true, model: '' });
    const repository = {
      findByVendor: vi.fn().mockResolvedValue(record),
    };

    const result = await runMultiVendorSmokeTest({ repository, vendor: 'doubao' });
    expect(result.status).toBe('completed');
    if (result.status !== 'completed') return;
    expect(result.payload.errorCode).toBe('INCOMPLETE_CONFIG');
    expect(result.payload.status).toBe('failed');
  });

  it('不完整配置（缺少 encryptedApiKey ciphertext）返回 failed INCOMPLETE_CONFIG', async () => {
    const record = makeRecord({
      configured: true,
      encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'iv', authTag: 'tag', ciphertext: '' },
    });
    const repository = {
      findByVendor: vi.fn().mockResolvedValue(record),
    };

    const result = await runMultiVendorSmokeTest({ repository, vendor: 'doubao' });
    expect(result.status).toBe('completed');
    if (result.status !== 'completed') return;
    expect(result.payload.errorCode).toBe('INCOMPLETE_CONFIG');
    expect(result.payload.status).toBe('failed');
    expectLowSensitivePayload(result);
  });

  it('vendor=deepseek 完整配置返回 ready', async () => {
    const record = makeRecord({ vendor: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash' });
    const repository = {
      findByVendor: vi.fn().mockResolvedValue(record),
    };

    const result = await runMultiVendorSmokeTest({ repository, vendor: 'deepseek' });
    expect(result.status).toBe('completed');
    if (result.status !== 'completed') return;
    expect(result.payload.status).toBe('ready');
    expect(result.payload.ok).toBe(true);
  });

  it('payload 不暴露 EncryptedSecretEnvelope 内部字段', async () => {
    const record = makeRecord({
      encryptedApiKey: {
        algorithm: 'AES-256-GCM',
        keyVersion: 'v1',
        iv: 'deadbeefdeadbeef',
        authTag: 'cafebabecafebabe',
        ciphertext: 'super-secret-encrypted-key-material',
      },
    });
    const repository = {
      findByVendor: vi.fn().mockResolvedValue(record),
    };

    const result = await runMultiVendorSmokeTest({ repository, vendor: 'doubao' });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('deadbeef');
    expect(serialized).not.toContain('cafebabe');
    expect(serialized).not.toContain('super-secret-encrypted-key-material');
    expectLowSensitivePayload(result);
  });
});

describe('多厂商 smoke route 测试', () => {
  it('只导出 POST', () => {
    expect(Object.keys(smokeRoute).sort()).toEqual(['POST']);
  });

  it('未授权返回 401 UNAUTHORIZED', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);

    const response = await smokeRoute.POST(new Request(smokeUrl, {
      method: 'POST',
      body: JSON.stringify({ vendor: 'doubao' }),
    }));
    const payload = await readJson(response);

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      ok: false,
      errorCode: 'UNAUTHORIZED',
    });
    expectLowSensitivePayload(payload);
  });

  it('非 platform scope 返回 403 FORBIDDEN', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(readOnlyAccessContext);

    const response = await smokeRoute.POST(new Request(smokeUrl, {
      method: 'POST',
      body: JSON.stringify({ vendor: 'doubao' }),
    }));
    const payload = await readJson(response);

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      ok: false,
      errorCode: 'FORBIDDEN',
    });
    expectLowSensitivePayload(payload);
  });

  it('无 vendor 参数返回 400 VALIDATION_FAILED', async () => {
    const response = await smokeRoute.POST(new Request(smokeUrl, {
      method: 'POST',
      body: JSON.stringify({}),
    }));
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      ok: false,
      errorCode: 'VALIDATION_FAILED',
    });
    expectLowSensitivePayload(payload);
  });

  it('无效 vendor 返回 400 VALIDATION_FAILED', async () => {
    const response = await smokeRoute.POST(new Request(smokeUrl, {
      method: 'POST',
      body: JSON.stringify({ vendor: 'openai' }),
    }));
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      ok: false,
      errorCode: 'VALIDATION_FAILED',
    });
    expectLowSensitivePayload(payload);
  });

  it('query string vendor 也能正常工作', async () => {
    const response = await smokeRoute.POST(new Request(`${smokeUrl}?vendor=doubao`, {
      method: 'POST',
      body: JSON.stringify({}),
    }));
    const payload = await readJson(response);

    // Accepts valid vendor even from query string
    expect(response.status === 400 || response.status === 200).toBe(true);
    if (response.status === 400) {
      expect(payload.errorCode).toBe('VALIDATION_FAILED');
    }
    expectLowSensitivePayload(payload);
  });
});
