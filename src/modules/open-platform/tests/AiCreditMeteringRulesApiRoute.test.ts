import { execFileSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GET,
  POST,
} from '@/app/api/open-platform/ai-credit-metering-rules/route';
import { PATCH } from '@/app/api/open-platform/ai-credit-metering-rules/[id]/route';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import {
  createPlatformAiCreditMeteringRule,
  createPlatformAiCreditMeteringRulesRepository,
  listPlatformAiCreditMeteringRules,
  patchPlatformAiCreditMeteringRule,
} from '@/modules/open-platform/server/ai-credit-metering-rules-management';

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => ({ database: 'test-db' })),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/open-platform/server/ai-credit-metering-rules-management', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/open-platform/server/ai-credit-metering-rules-management')>();
  return {
    ...actual,
    createPlatformAiCreditMeteringRulesRepository: vi.fn(() => ({ repository: 'rules' })),
    listPlatformAiCreditMeteringRules: vi.fn(),
    createPlatformAiCreditMeteringRule: vi.fn(),
    patchPlatformAiCreditMeteringRule: vi.fn(),
  };
});

const platformContext = {
  userId: 'platform-admin',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  institutionId: null,
  source: 'demo_session',
} as const;

const tenantContext = {
  userId: 'tenant-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-001',
  institutionId: 'inst-001',
  source: 'demo_session',
} as const;

const ruleDto = {
  id: 'rule-001',
  provider: 'deepseek',
  model: 'deepseek-chat',
  meteringVersion: 'ai-credits-v0.6-test',
  inputTokenWeight: 1,
  outputTokenWeight: 3,
  modelMultiplier: 2,
  ragCreditSurcharge: 1,
  creditsPerStandardTokenUnit: 100,
  enabled: true,
  effectiveFrom: '2026-06-01T00:00:00.000Z',
  effectiveTo: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

function jsonRequest(url: string, method: string, payload: unknown) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformContext);
  vi.mocked(listPlatformAiCreditMeteringRules).mockResolvedValue({
    requestId: 'platform-ai-credit-metering-rules',
    records: [ruleDto],
  });
  vi.mocked(createPlatformAiCreditMeteringRule).mockResolvedValue({
    status: 'created',
    record: ruleDto,
  });
  vi.mocked(patchPlatformAiCreditMeteringRule).mockResolvedValue({
    status: 'updated',
    record: { ...ruleDto, enabled: false },
  });
});

describe('平台端 AI credits metering rules API', () => {
  it('平台端可 list rules', async () => {
    const response = await GET(
      new Request('http://localhost/api/open-platform/ai-credit-metering-rules?provider=deepseek&model=deepseek-chat&enabled=true'),
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(createPlatformAiCreditMeteringRulesRepository).toHaveBeenCalled();
    expect(listPlatformAiCreditMeteringRules).toHaveBeenCalledWith({
      repository: { repository: 'rules' },
      filters: { provider: 'deepseek', model: 'deepseek-chat', enabled: true },
    });
    expect(body.records).toEqual([ruleDto]);
  });

  it('平台端可 create rule', async () => {
    const payload = {
      provider: 'deepseek',
      model: 'deepseek-chat',
      meteringVersion: 'ai-credits-v0.6-test',
      inputTokenWeight: 1,
      outputTokenWeight: 3,
      modelMultiplier: 2,
      ragCreditSurcharge: 1,
      creditsPerStandardTokenUnit: 100,
      enabled: true,
      effectiveFrom: '2026-06-01T00:00:00.000Z',
      effectiveTo: null,
    };

    const response = await POST(jsonRequest('http://localhost/api/open-platform/ai-credit-metering-rules', 'POST', payload));
    const body = await readJson(response);

    expect(response.status).toBe(201);
    expect(createPlatformAiCreditMeteringRule).toHaveBeenCalledWith({
      repository: { repository: 'rules' },
      payload,
    });
    expect(body.record).toEqual(ruleDto);
  });

  it('平台端可 patch enabled 和 effectiveFrom / effectiveTo', async () => {
    const payload = {
      enabled: false,
      effectiveFrom: '2026-07-01T00:00:00.000Z',
      effectiveTo: '2026-08-01T00:00:00.000Z',
    };

    const response = await PATCH(
      jsonRequest('http://localhost/api/open-platform/ai-credit-metering-rules/rule-001', 'PATCH', payload),
      { params: Promise.resolve({ id: 'rule-001' }) },
    );
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(patchPlatformAiCreditMeteringRule).toHaveBeenCalledWith({
      repository: { repository: 'rules' },
      id: 'rule-001',
      payload,
    });
    expect(body.record).toMatchObject({ enabled: false });
  });

  it('未登录访问被拒绝', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);

    const response = await GET(new Request('http://localhost/api/open-platform/ai-credit-metering-rules'));
    const body = await readJson(response);

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, errorCode: 'UNAUTHORIZED' });
    expect(listPlatformAiCreditMeteringRules).not.toHaveBeenCalled();
  });

  it('非平台端身份访问被拒绝', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);

    const response = await POST(jsonRequest('http://localhost/api/open-platform/ai-credit-metering-rules', 'POST', {}));
    const body = await readJson(response);

    expect(response.status).toBe(403);
    expect(body).toEqual({ ok: false, errorCode: 'FORBIDDEN' });
    expect(createPlatformAiCreditMeteringRule).not.toHaveBeenCalled();
  });

  it('validation 失败返回 400', async () => {
    vi.mocked(createPlatformAiCreditMeteringRule).mockResolvedValueOnce({
      status: 'validation_failed',
      errors: ['provider_required'],
    });

    const response = await POST(jsonRequest('http://localhost/api/open-platform/ai-credit-metering-rules', 'POST', {}));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, errorCode: 'VALIDATION_FAILED', errors: ['provider_required'] });
  });

  it('唯一冲突返回受控错误', async () => {
    vi.mocked(createPlatformAiCreditMeteringRule).mockResolvedValueOnce({
      status: 'conflict',
      errorCode: 'METERING_RULE_VERSION_CONFLICT',
    });

    const response = await POST(jsonRequest('http://localhost/api/open-platform/ai-credit-metering-rules', 'POST', {
      provider: 'deepseek',
    }));
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body).toEqual({ ok: false, errorCode: 'METERING_RULE_VERSION_CONFLICT' });
  });

  it('返回字段不含敏感字段', async () => {
    const response = await GET(new Request('http://localhost/api/open-platform/ai-credit-metering-rules'));
    const body = await readJson(response);
    const serialized = JSON.stringify(body);

    expect(serialized).not.toMatch(
      /apiKey|encryptedApiKey|baseUrl|Authorization|prompt|question|answer|rawResponse|signedUrl|storageKey/i,
    );
  });

  it('不修改 schema、migration，也不触发 provider', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const changedFiles = execFileSync('git', ['status', '--short', '--untracked-files=all'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3));

    expect(changedFiles).not.toContain('src/server/db/schema.ts');
    expect(changedFiles.some((file) => file.includes('/migrations/') || file.includes('drizzle/'))).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
