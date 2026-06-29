import { describe, expect, it, vi } from 'vitest';

import {
  createOpenPlatformAiCreditMeteringRule,
  listOpenPlatformAiCreditMeteringRules,
  patchOpenPlatformAiCreditMeteringRule,
} from '@/modules/open-platform/client/platform-ai-credit-metering-rules-client';

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

const ruleRecord = {
  id: 'rule-001',
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
  meteringVersion: 'v06-stage-verify-test',
  inputTokenWeight: 1,
  outputTokenWeight: 1,
  modelMultiplier: 1,
  ragCreditSurcharge: 0,
  creditsPerStandardTokenUnit: 1000,
  enabled: true,
  effectiveFrom: '2026-06-29T00:00:00.000Z',
  effectiveTo: '2026-06-30T00:00:00.000Z',
  createdAt: '2026-06-29T00:00:00.000Z',
  updatedAt: '2026-06-29T00:00:00.000Z',
};

function expectNoSensitivePayload(input: unknown) {
  expect(JSON.stringify(input)).not.toMatch(
    /apiKey|encryptedApiKey|baseUrl|Authorization|prompt|question|answer|rawResponse|signedUrl|storageKey/i,
  );
}

describe('platform AI credit metering rules client', () => {
  it('读取规则列表且无过滤时不拼接 query', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ records: [ruleRecord] }));

    const result = await listOpenPlatformAiCreditMeteringRules(undefined, { fetcher });

    expect(result).toEqual({ ok: true, records: [ruleRecord] });
    expect(fetcher).toHaveBeenCalledWith('/api/open-platform/ai-credit-metering-rules', { cache: 'no-store' });
  });

  it('读取规则列表时拼接 provider / model / enabled 过滤条件', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ records: [] }));

    await listOpenPlatformAiCreditMeteringRules({
      provider: ' deepseek ',
      model: 'deepseek-v4-flash',
      enabled: true,
    }, { fetcher });
    await listOpenPlatformAiCreditMeteringRules({ enabled: false }, { fetcher });

    expect(fetchPath(fetcher.mock.calls[0][0])).toBe(
      '/api/open-platform/ai-credit-metering-rules?provider=deepseek&model=deepseek-v4-flash&enabled=true',
    );
    expect(fetchPath(fetcher.mock.calls[1][0])).toBe('/api/open-platform/ai-credit-metering-rules?enabled=false');
  });

  it('创建规则只提交低敏规则字段', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ record: ruleRecord }, { status: 201 }));
    const payload = {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      meteringVersion: 'v06-stage-verify-test',
      inputTokenWeight: 1,
      outputTokenWeight: 1,
      modelMultiplier: 1,
      ragCreditSurcharge: 0,
      creditsPerStandardTokenUnit: 1000,
      enabled: true,
      effectiveFrom: '2026-06-29T00:00:00.000Z',
      effectiveTo: '2026-06-30T00:00:00.000Z',
    };

    const result = await createOpenPlatformAiCreditMeteringRule(payload, { fetcher });

    expect(result).toEqual({ ok: true, record: ruleRecord });
    expect(fetcher).toHaveBeenCalledWith('/api/open-platform/ai-credit-metering-rules', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    }));
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body).toEqual(payload);
    expectNoSensitivePayload(body);
  });

  it('patch 规则只提交 enabled / effectiveFrom / effectiveTo', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ record: { ...ruleRecord, enabled: false } }));
    const payload = {
      enabled: false,
      effectiveFrom: '2026-06-29T00:00:00.000Z',
      effectiveTo: null,
    };

    const result = await patchOpenPlatformAiCreditMeteringRule('rule-001', payload, { fetcher });

    expect(result).toEqual({ ok: true, record: { ...ruleRecord, enabled: false } });
    expect(fetcher).toHaveBeenCalledWith('/api/open-platform/ai-credit-metering-rules/rule-001', expect.objectContaining({
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
    }));
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(body).toEqual(payload);
    expect(Object.keys(body).sort()).toEqual(['effectiveFrom', 'effectiveTo', 'enabled'].sort());
    expectNoSensitivePayload(body);
  });

  it.each([
    [400, 'validation_error'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [503, 'service_unavailable'],
    [418, 'unknown'],
  ])('映射 %s 错误为 %s', async (status, kind) => {
    const fetcher = vi.fn(async () => jsonResponse({ errorCode: 'CONTROLLED_ERROR', errors: ['provider_required'] }, { status }));

    const result = await listOpenPlatformAiCreditMeteringRules(undefined, { fetcher });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(kind);
      expect(result.error.message).toBe('provider_required');
      expectNoSensitivePayload(result.error);
    }
  });

  it('处理异常响应和 fetch 异常', async () => {
    const malformedFetcher = vi.fn(async () => jsonResponse({ unexpected: true }));
    const throwingFetcher = vi.fn(async () => {
      throw new Error('network failed');
    });

    const malformed = await listOpenPlatformAiCreditMeteringRules(undefined, { fetcher: malformedFetcher });
    const thrown = await listOpenPlatformAiCreditMeteringRules(undefined, { fetcher: throwingFetcher });

    expect(malformed.ok).toBe(false);
    expect(thrown.ok).toBe(false);
    if (!malformed.ok) expect(malformed.error.kind).toBe('unknown');
    if (!thrown.ok) expect(thrown.error.status).toBe(0);
  });
});
