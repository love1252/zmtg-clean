import { describe, expect, it, vi } from 'vitest';

import { listOpenPlatformAiUsageCredits } from '@/modules/open-platform/client/platform-ai-usage-credits-client';

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

function fetchPath(input: Parameters<typeof fetch>[0]) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

const usageResponse = {
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
  aggregations: {
    byModel: [{
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      totalCalls: 2,
      succeededCalls: 1,
      failedCalls: 1,
      meteredCalls: 1,
      totalTokens: 200,
      totalAiCreditsConsumed: 2,
    }],
    byTenant: [{
      tenantId: 'tenant-001',
      tenantName: '星澜医美',
      totalCalls: 2,
      succeededCalls: 1,
      failedCalls: 1,
      meteredCalls: 1,
      pendingCalls: 0,
      notBillableCalls: 1,
      totalAiCreditsConsumed: 2,
    }],
    byMeteringStatus: [
      { meteringStatus: 'metered', calls: 1, totalAiCreditsConsumed: 2 },
      { meteringStatus: 'not_billable', calls: 1, totalAiCreditsConsumed: 0 },
    ],
    byDate: [{
      date: '2026-06-30',
      totalCalls: 2,
      succeededCalls: 1,
      failedCalls: 1,
      totalAiCreditsConsumed: 2,
    }],
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
    },
  ],
  emptyState: {
    title: '暂无 AI 用量明细',
    description: '当前过滤条件下没有 AI 调用记录。',
  },
};

function expectLowSensitivePayload(input: unknown) {
  expect(JSON.stringify(input)).not.toMatch(
    /apiKey|encryptedApiKey|baseUrl|Authorization|Cookie|prompt|question|answer|rawResponse|signedUrl|storageKey/i,
  );
}

describe('platform AI usage credits client', () => {
  it('读取汇总和明细且无过滤时不拼接 query', async () => {
    const fetcher = vi.fn(async () => jsonResponse(usageResponse));

    const result = await listOpenPlatformAiUsageCredits(undefined, { fetcher });

    expect(result).toEqual({ ok: true, data: usageResponse });
    if (result.ok) {
      expect(result.data.aggregations.byModel).toEqual([expect.objectContaining({ provider: 'deepseek', model: 'deepseek-v4-flash' })]);
      expect(result.data.aggregations.byTenant).toEqual([expect.objectContaining({ tenantId: 'tenant-001', tenantName: '星澜医美' })]);
      expect(result.data.aggregations.byMeteringStatus).toEqual(expect.arrayContaining([expect.objectContaining({ meteringStatus: 'metered' })]));
      expect(result.data.aggregations.byDate).toEqual([expect.objectContaining({ date: '2026-06-30' })]);
    }
    expect(fetcher).toHaveBeenCalledWith('/api/open-platform/ai-usage-credits', { cache: 'no-store' });
  });

  it('拼接 status / meteringStatus / provider / model / date / limit 过滤条件', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ ...usageResponse, records: [] }));

    await listOpenPlatformAiUsageCredits({
      tenantId: ' tenant-001 ',
      status: 'succeeded',
      meteringStatus: 'metered',
      provider: ' deepseek ',
      model: 'deepseek-v4-flash',
      dateFrom: '2026-06-30T00:00:00.000Z',
      dateTo: '2026-06-30T23:59:59.000Z',
      limit: 25,
    }, { fetcher });

    const firstCall = fetcher.mock.calls[0] as unknown as [Parameters<typeof fetch>[0], RequestInit?] | undefined;
    expect(fetchPath(firstCall?.[0] ?? '')).toBe(
      '/api/open-platform/ai-usage-credits?tenantId=tenant-001&status=succeeded&meteringStatus=metered&provider=deepseek&model=deepseek-v4-flash&dateFrom=2026-06-30T00%3A00%3A00.000Z&dateTo=2026-06-30T23%3A59%3A59.000Z&limit=25',
    );
  });

  it.each([
    [400, 'validation_error'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [503, 'service_unavailable'],
    [418, 'unknown'],
  ])('映射 %s 错误为 %s', async (status, kind) => {
    const fetcher = vi.fn(async () => jsonResponse({ errorCode: 'CONTROLLED_ERROR', errors: ['date_from_invalid'] }, { status }));

    const result = await listOpenPlatformAiUsageCredits(undefined, { fetcher });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(kind);
      expect(result.error.message).toBe('date_from_invalid');
      expectLowSensitivePayload(result.error);
    }
  });

  it('处理异常响应和 fetch 异常', async () => {
    const malformedFetcher = vi.fn(async () => jsonResponse({ unexpected: true }));
    const throwingFetcher = vi.fn(async () => {
      throw new Error('network failed');
    });

    const malformed = await listOpenPlatformAiUsageCredits(undefined, { fetcher: malformedFetcher });
    const thrown = await listOpenPlatformAiUsageCredits(undefined, { fetcher: throwingFetcher });

    expect(malformed.ok).toBe(false);
    expect(thrown.ok).toBe(false);
    if (!malformed.ok) expect(malformed.error.kind).toBe('unknown');
    if (!thrown.ok) expect(thrown.error.status).toBe(0);
  });
});
