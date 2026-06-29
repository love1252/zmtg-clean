import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/open-platform/ai-usage-credits/route';
import {
  createPlatformAiUsageCreditsRepository,
  listPlatformAiUsageCredits,
} from '@/modules/open-platform/server/ai-usage-credits';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => ({ database: 'test-db' })),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/open-platform/server/ai-usage-credits', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/open-platform/server/ai-usage-credits')>();
  return {
    ...actual,
    createPlatformAiUsageCreditsRepository: vi.fn(() => ({ repository: 'usage-credits' })),
    listPlatformAiUsageCredits: vi.fn(),
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

const responsePayload = {
  requestId: 'platform-ai-usage-credits',
  readonly: true,
  dataSource: 'repository',
  summary: {
    totalCalls: 2,
    succeededCalls: 1,
    failedCalls: 1,
    meteredCalls: 1,
    pendingCalls: 0,
    notBillableCalls: 1,
    totalAiCreditsConsumed: 2,
  },
  records: [
    {
      id: 'usage-001',
      tenantId: 'tenant-001',
      tenantName: '星澜医美',
      status: 'succeeded',
      errorCode: null,
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      promptTokens: 120,
      completionTokens: 80,
      totalTokens: 200,
      aiCreditsConsumed: 2,
      meteringStatus: 'metered',
      meteringVersion: 'v06-ui-verify-test',
      createdAt: '2026-06-30T08:00:00.000Z',
      knowledgeContextUsed: true,
      sourceCount: 1,
      prompt: 'prompt 不应返回',
      answer: 'answer 不应返回',
      rawResponse: { unsafe: true },
      apiKey: 'sk_test_should_not_return',
      baseUrl: 'https://provider.example.test',
      Authorization: 'Bearer should-not-return',
    },
  ],
  emptyState: {
    title: '暂无 AI 用量明细',
    description: '当前过滤条件下没有 AI 调用记录。',
  },
};

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');
  return response.json() as Promise<Record<string, unknown>>;
}

function expectLowSensitivePayload(input: unknown) {
  expect(JSON.stringify(input)).not.toMatch(
    /apiKey|encryptedApiKey|baseUrl|Authorization|Cookie|rawPrompt|rawQuestion|rawAnswer|rawResponse|signedUrl|storageKey|客户姓名|手机号|身份证|病历详情|RAG source 原文/i,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformContext);
  vi.mocked(listPlatformAiUsageCredits).mockResolvedValue({
    status: 'ok',
    response: {
      ...responsePayload,
      records: responsePayload.records.map(({ prompt, answer, rawResponse, apiKey, baseUrl, Authorization, ...record }) => record),
    },
  });
});

describe('平台端 AI usage credits API', () => {
  it('平台端可获取汇总和明细，并传递过滤条件', async () => {
    const response = await GET(new Request(
      'http://localhost/api/open-platform/ai-usage-credits?tenantId=tenant-001&status=succeeded&meteringStatus=metered&provider=deepseek&model=deepseek-v4-flash&dateFrom=2026-06-30T00%3A00%3A00.000Z&dateTo=2026-06-30T23%3A59%3A59.000Z&limit=25',
    ));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(createPlatformAiUsageCreditsRepository).toHaveBeenCalled();
    expect(listPlatformAiUsageCredits).toHaveBeenCalledWith({
      repository: { repository: 'usage-credits' },
      filters: {
        tenantId: 'tenant-001',
        status: 'succeeded',
        meteringStatus: 'metered',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        dateFrom: '2026-06-30T00:00:00.000Z',
        dateTo: '2026-06-30T23:59:59.000Z',
        limit: '25',
      },
    });
    expect(body.summary).toMatchObject({ totalCalls: 2, meteredCalls: 1, totalAiCreditsConsumed: 2 });
    expect(body.records).toEqual([
      expect.objectContaining({
        id: 'usage-001',
        tenantId: 'tenant-001',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        promptTokens: 120,
        aiCreditsConsumed: 2,
        meteringStatus: 'metered',
      }),
    ]);
    expectLowSensitivePayload(body);
  });

  it('未登录访问被拒绝', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);

    const response = await GET(new Request('http://localhost/api/open-platform/ai-usage-credits'));
    const body = await readJson(response);

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, errorCode: 'UNAUTHORIZED' });
    expect(listPlatformAiUsageCredits).not.toHaveBeenCalled();
  });

  it('非平台端访问被拒绝', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);

    const response = await GET(new Request('http://localhost/api/open-platform/ai-usage-credits'));
    const body = await readJson(response);

    expect(response.status).toBe(403);
    expect(body).toEqual({ ok: false, errorCode: 'FORBIDDEN' });
    expect(listPlatformAiUsageCredits).not.toHaveBeenCalled();
  });

  it('validation 失败返回 400', async () => {
    vi.mocked(listPlatformAiUsageCredits).mockResolvedValueOnce({
      status: 'validation_failed',
      errors: ['date_from_invalid'],
    });

    const response = await GET(new Request('http://localhost/api/open-platform/ai-usage-credits?dateFrom=bad'));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, errorCode: 'VALIDATION_FAILED', errors: ['date_from_invalid'] });
  });
});
