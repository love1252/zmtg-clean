import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => ({})),
  createDatabaseUrlErrorMessage: vi.fn(),
}));

vi.mock('@/modules/open-platform/server/vendorProviderConfigRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/open-platform/server/vendorProviderConfigRepository')>();
  return {
    ...actual,
    createVendorProviderConfigRepository: vi.fn(() => ({
      findAll: vi.fn().mockResolvedValue([]),
      findByVendor: vi.fn().mockResolvedValue(null),
      upsertVendorConfig: vi.fn(),
      deleteByVendor: vi.fn(),
    })),
  };
});

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

const tenantContext = {
  userId: 'tenant-user',
  role: 'tenant_admin' as const,
  scope: 'tenant' as const,
  tenantId: 'tenant-1',
  institutionId: 'inst-1',
  source: 'demo_session' as const,
};

const aiModelsUrl = 'http://localhost/api/v1/institution/ai-models';
const forbiddenFragments = [
  'encryptedApiKey',
  'ciphertext',
  'authTag',
  'iv',
  'apiKey',
];

function expectLowSensitivePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  forbiddenFragments.forEach((f) => {
    expect(serialized).not.toContain(f);
  });
}

beforeEach(() => {
  vi.mocked(getDemoAccessContextFromRequest).mockReset();
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
});

describe('机构端 AI 模型列表 API', () => {
  it('returns 401 without auth', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const { GET } = await import('@/app/api/v1/institution/ai-models/route');
    const response = await GET(new Request(aiModelsUrl));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe('unauthorized');
    expectLowSensitivePayload(body);
  });

  it('returns 403 when scope is platform', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      ...tenantContext,
      scope: 'platform' as const,
      tenantId: null,
    });
    const { GET } = await import('@/app/api/v1/institution/ai-models/route');
    const response = await GET(new Request(aiModelsUrl));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('forbidden');
    expectLowSensitivePayload(body);
  });

  it('returns 403 when tenantId is missing', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      ...tenantContext,
      tenantId: null,
    });
    const { GET } = await import('@/app/api/v1/institution/ai-models/route');
    const response = await GET(new Request(aiModelsUrl));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('forbidden');
  });

  it('returns governance forbidden for valid tenant and does not expose models', async () => {
    const { GET } = await import('@/app/api/v1/institution/ai-models/route');
    const response = await GET(new Request(aiModelsUrl));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('INSTITUTION_AI_MODEL_GOVERNANCE_FORBIDDEN');
    expect(JSON.stringify(body)).not.toContain('models');
    expectLowSensitivePayload(body);
  });

  it('response does not include raw provider/model or secret fields', async () => {
    const { GET } = await import('@/app/api/v1/institution/ai-models/route');
    const response = await GET(new Request(aiModelsUrl));
    expect(response.status).toBe(403);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/deepseek|doubao|qwen|provider|DeepSeek|Kimi|Claude/i);
    expectLowSensitivePayload(body);
  });
});
