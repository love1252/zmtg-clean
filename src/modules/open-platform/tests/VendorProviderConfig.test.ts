import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import {
  listVendorProviderConfigs,
  getVendorProviderConfig,
  saveVendorProviderConfig,
  deleteVendorProviderConfig,
} from '@/modules/open-platform/server/vendorProviderConfig';
import { vendorProviderConfigId } from '@/modules/open-platform/server/vendorProviderConfigRepository';
import type {
  VendorProviderConfigRecord,
  VendorProviderConfigUpsertInput,
} from '@/modules/open-platform/server/vendorProviderConfigTypes';
import type { SupportedVendor } from '@/modules/open-platform/domain/vendor-catalog';

const envKey = 'ZMTG_SECRET_ENCRYPTION_KEY';
const sensitiveKey = 'vendor-test-key-never-return';
const forbiddenFragments = [
  sensitiveKey,
  'ciphertext',
  'authTag',
  'iv',
  'DATABASE_URL',
  '/Users/',
  'raw metadata',
];

const platformAccessContext = {
  userId: 'platform-admin',
  role: 'platform_admin' as const,
  scope: 'platform' as const,
  tenantId: null,
  institutionId: null,
  source: 'demo_session' as const,
};

function configureEncryptionKey() {
  vi.stubEnv(envKey, randomBytes(32).toString('base64'));
}

function expectLowSensitivePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  forbiddenFragments.forEach((f) => {
    expect(serialized).not.toContain(f);
  });
}

function makeRecord(overrides: Partial<VendorProviderConfigRecord> = {}): VendorProviderConfigRecord {
  return {
    id: vendorProviderConfigId('doubao'),
    vendor: 'doubao' as SupportedVendor,
    baseUrl: 'https://example.com/v1',
    model: 'm',
    encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'iv', authTag: 'tag', ciphertext: 'ct' },
    configured: true,
    lastCheckStatus: 'ok' as const,
    lastCheckedAt: null,
    createdAt: new Date('2026-06-17T00:00:00Z'),
    updatedAt: new Date('2026-06-17T00:00:00Z'),
    ...overrides,
  };
}

function createInMemoryRepo() {
  let savedRecords: VendorProviderConfigRecord[] = [];

  return {
    _records: savedRecords,
    findAll: vi.fn(async () => savedRecords),
    findByVendor: vi.fn(async (vendor: SupportedVendor) =>
      savedRecords.find((r) => r.vendor === vendor) ?? null,
    ),
    upsertVendorConfig: vi.fn(async (input: VendorProviderConfigUpsertInput): Promise<VendorProviderConfigRecord> => {
      const record = makeRecord({
        id: input.id,
        vendor: input.vendor,
        baseUrl: input.baseUrl,
        model: input.model,
        encryptedApiKey: input.encryptedApiKey,
        configured: input.configured,
        lastCheckStatus: 'not_checked',
        updatedAt: input.updatedAt,
      });

      const existingIdx = savedRecords.findIndex((r) => r.id === input.id);
      if (existingIdx >= 0) {
        savedRecords[existingIdx] = record;
      } else {
        savedRecords.push(record);
      }

      return record;
    }),
    deleteByVendor: vi.fn(async (vendor: SupportedVendor) => {
      savedRecords = savedRecords.filter((r) => r.vendor !== vendor);
    }),
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

// ---- Service tests ---------------------------------------------------------

describe('vendor provider config service', () => {
  it('lists empty configs when no vendor configs exist', async () => {
    const repo = createInMemoryRepo();
    const result = await listVendorProviderConfigs({ repository: repo });
    expect(result.configs).toEqual([]);
    expectLowSensitivePayload(result);
  });

  it('saves encrypted config for doubao', async () => {
    configureEncryptionKey();
    const repo = createInMemoryRepo();

    const result = await saveVendorProviderConfig({
      repository: repo,
      input: {
        vendor: 'doubao',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        model: 'doubao-seed-1-8-251228',
        apiKey: sensitiveKey,
      },
      now: new Date('2026-06-17T00:00:00Z'),
    });

    expect(result.status).toBe('saved');
    if (result.status !== 'saved') return;

    expect(result.payload.vendor).toBe('doubao');
    expect(result.payload.displayName).toBe('豆包 (Volcengine)');
    expect(result.payload.provider).toBe('openai_compatible');
    expect(result.payload.configured).toBe(true);
    expectLowSensitivePayload(result.payload);

    const stored = repo.upsertVendorConfig.mock.calls[0]?.[0];
    expect(stored).toBeDefined();
    const serialized = JSON.stringify(stored);
    expect(serialized).toContain('AES-256-GCM');
    expect(serialized).not.toContain(sensitiveKey);
  });

  it('saves encrypted config for all 5 vendors', async () => {
    configureEncryptionKey();
    const vendors: SupportedVendor[] = ['doubao', 'deepseek', 'qwen', 'chatglm', 'kimi'];

    for (const vendor of vendors) {
      const repo = createInMemoryRepo();
      const result = await saveVendorProviderConfig({
        repository: repo,
        input: { vendor, baseUrl: 'https://example.com/v1', model: 'test-model', apiKey: 'test-key' },
      });

      expect(result.status).toBe('saved');
      if (result.status !== 'saved') return;
      expect(result.payload.vendor).toBe(vendor);
    }
  });

  it('rejects non-SupportedVendor values', async () => {
    configureEncryptionKey();
    const repo = createInMemoryRepo();

    const invalidVendors = ['openai_compatible', 'openai', '', null, 123, 'unknown_vendor'];
    for (const v of invalidVendors) {
      const result = await saveVendorProviderConfig({
        repository: repo,
        input: { vendor: v, baseUrl: 'https://example.com/v1', model: 'm', apiKey: 'k' },
      });
      expect(result.status).toBe('validation_failed');
    }

    expect(repo.upsertVendorConfig).not.toHaveBeenCalled();
  });

  it.each([
    ['http://example.com/v1'],
    ['https://localhost/v1'],
    ['https://127.0.0.1/v1'],
    ['https://0.0.0.0/v1'],
    ['https://[::1]/v1'],
    ['https://10.0.0.1/v1'],
    ['https://172.16.0.1/v1'],
    ['https://192.168.1.1/v1'],
    ['https://169.254.1.1/v1'],
  ])('rejects insecure baseUrl: %s', async (url) => {
    configureEncryptionKey();
    const repo = createInMemoryRepo();

    const result = await saveVendorProviderConfig({
      repository: repo,
      input: { vendor: 'doubao', baseUrl: url, model: 'm', apiKey: 'k' },
    });

    expect(result.status).toBe('validation_failed');
  });

  it('handles missing encryption key', async () => {
    vi.unstubAllEnvs();
    const repo = createInMemoryRepo();

    const result = await saveVendorProviderConfig({
      repository: repo,
      input: {
        vendor: 'doubao',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        model: 'doubao-seed-1-8-251228',
        apiKey: 'test-key',
      },
    });

    expect(result.status).toBe('encryption_unavailable');
  });

  it('strips trailing slash from baseUrl', async () => {
    configureEncryptionKey();
    const repo = createInMemoryRepo();

    await saveVendorProviderConfig({
      repository: repo,
      input: {
        vendor: 'doubao',
        baseUrl: 'https://example.com/v1/',
        model: 'm',
        apiKey: 'k',
      },
    });

    const stored = repo.upsertVendorConfig.mock.calls[0]?.[0];
    expect(stored.baseUrl).toBe('https://example.com/v1');
  });

  it('getVendorProviderConfig returns null for non-existent vendor', async () => {
    const repo = createInMemoryRepo();
    const result = await getVendorProviderConfig({ repository: repo, vendor: 'doubao' });
    expect(result).toBeNull();
  });

  it('getVendorProviderConfig returns safe view for saved vendor', async () => {
    const repo = createInMemoryRepo();
    repo.findByVendor.mockResolvedValue(makeRecord());

    const result = await getVendorProviderConfig({ repository: repo, vendor: 'doubao' });
    expect(result).not.toBeNull();
    expect(result!.vendor).toBe('doubao');
    expect(result!.displayName).toBe('豆包 (Volcengine)');
    expectLowSensitivePayload(result);
  });

  it('deleteVendorProviderConfig returns not_found for non-existent', async () => {
    const repo = createInMemoryRepo();

    const result = await deleteVendorProviderConfig({ repository: repo, vendor: 'doubao' });
    expect(result.status).toBe('not_found');
    expect(repo.deleteByVendor).not.toHaveBeenCalled();
  });

  it('deleteVendorProviderConfig deletes and returns success', async () => {
    const repo = createInMemoryRepo();
    repo.findByVendor.mockResolvedValue(makeRecord());

    const result = await deleteVendorProviderConfig({ repository: repo, vendor: 'doubao' });
    expect(result.status).toBe('deleted');
    expect(repo.deleteByVendor).toHaveBeenCalledWith('doubao');
  });

  it('findAll filters out singleton row', async () => {
    const repo = createInMemoryRepo();
    repo.findAll.mockResolvedValue([
      makeRecord({ id: vendorProviderConfigId('doubao'), vendor: 'doubao' }),
    ]);

    const result = await listVendorProviderConfigs({ repository: repo });
    expect(result.configs).toHaveLength(1);
    expect(result.configs[0].vendor).toBe('doubao');
  });
});

// ---- Route tests -----------------------------------------------------------

const providerConfigsUrl = 'http://localhost/api/v1/open-platform/provider-configs';
const routeInMemoryRepo = createInMemoryRepo();

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => ({})),
  createDatabaseUrlErrorMessage: vi.fn(),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/open-platform/server/vendorProviderConfigRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/open-platform/server/vendorProviderConfigRepository')>();
  return {
    ...actual,
    createVendorProviderConfigRepository: vi.fn(() => routeInMemoryRepo),
  };
});

const routeModule = await import('@/app/api/v1/open-platform/provider-configs/route');

beforeEach(() => {
  routeInMemoryRepo._records.length = 0;
  vi.mocked(getDemoAccessContextFromRequest).mockReset();
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformAccessContext);
});

describe('vendor provider configs route', () => {
  it('exports only GET, POST, PUT, DELETE', () => {
    expect(Object.keys(routeModule).filter((k) => k === 'GET' || k === 'POST' || k === 'PUT' || k === 'DELETE').sort())
      .toEqual(['DELETE', 'GET', 'POST', 'PUT']);
  });

  it('GET without auth returns 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await routeModule.GET(new Request(providerConfigsUrl));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('GET with invalid vendor returns 400', async () => {
    const response = await routeModule.GET(new Request(`${providerConfigsUrl}?vendor=unknown`));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errorCode).toBe('VALIDATION_FAILED');
  });

  it('GET without vendor param returns list', async () => {
    const response = await routeModule.GET(new Request(providerConfigsUrl));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('configs');
    expect(Array.isArray(body.configs)).toBe(true);
    expectLowSensitivePayload(body);
  });

  it('POST without auth returns 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await routeModule.POST(
      new Request(providerConfigsUrl, {
        method: 'POST',
        body: JSON.stringify({ vendor: 'doubao' }),
      }),
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('POST saves successfully with valid input', async () => {
    configureEncryptionKey();
    const response = await routeModule.POST(
      new Request(providerConfigsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: 'doubao',
          baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
          model: 'doubao-seed-1-8-251228',
          apiKey: 'test-key',
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.vendor).toBe('doubao');
    expect(body.displayName).toBe('豆包 (Volcengine)');
    expectLowSensitivePayload(body);
  });

  it('PUT saves successfully with valid input', async () => {
    configureEncryptionKey();
    const response = await routeModule.PUT(
      new Request(providerConfigsUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: 'doubao',
          baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
          model: 'doubao-seed-1-8-251228',
          apiKey: 'test-key',
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.vendor).toBe('doubao');
    expectLowSensitivePayload(body);
  });

  it('DELETE without auth returns 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await routeModule.DELETE(new Request(`${providerConfigsUrl}?vendor=doubao`));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.errorCode).toBe('UNAUTHORIZED');
  });

  it('DELETE without vendor param returns 400', async () => {
    const response = await routeModule.DELETE(new Request(providerConfigsUrl));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errorCode).toBe('VALIDATION_FAILED');
  });

  it('DELETE with unknown vendor returns 400', async () => {
    const response = await routeModule.DELETE(new Request(`${providerConfigsUrl}?vendor=unknown`));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errorCode).toBe('VALIDATION_FAILED');
  });

  it('DELETE non-existent vendor returns 404', async () => {
    const response = await routeModule.DELETE(new Request(`${providerConfigsUrl}?vendor=doubao`));
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.errorCode).toBe('NOT_FOUND');
  });

  it('DELETE existing vendor returns 200', async () => {
    configureEncryptionKey();
    // Save first
    await routeModule.POST(
      new Request(providerConfigsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: 'doubao',
          baseUrl: 'https://example.com/v1',
          model: 'm',
          apiKey: 'k',
        }),
      }),
    );

    const response = await routeModule.DELETE(new Request(`${providerConfigsUrl}?vendor=doubao`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it('each method returns low-sensitive payload on error', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);

    const methods = [
      routeModule.GET(new Request(providerConfigsUrl)),
      routeModule.POST(new Request(providerConfigsUrl, { method: 'POST', body: '{}' })),
      routeModule.PUT(new Request(providerConfigsUrl, { method: 'PUT', body: '{}' })),
      routeModule.DELETE(new Request(`${providerConfigsUrl}?vendor=doubao`)),
    ];

    for (const promise of methods) {
      const response = await promise;
      const body = await response.json();
      expectLowSensitivePayload(body);
    }
  });
});
