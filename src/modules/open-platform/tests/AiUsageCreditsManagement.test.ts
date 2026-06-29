import { describe, expect, it } from 'vitest';

import {
  listPlatformAiUsageCredits,
  mapPlatformAiUsageCreditRowToDto,
  normalizePlatformAiUsageCreditsFilters,
  type PlatformAiUsageCreditsRepository,
} from '@/modules/open-platform/server/ai-usage-credits';

const usageRow = {
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
  metadata: {
    knowledgeContext: {
      used: true,
      sources: [
        {
          knowledgeTitle: '不应展示的 RAG source 原文片段',
          textPreview: '完整 source 原文不应展示',
          signedUrl: 'https://signed.example.test',
          storageKey: 'storage/raw/key',
        },
      ],
    },
    prompt: '用户 prompt 不应展示',
    answer: 'answer 不应展示',
    rawResponse: { unsafe: true },
  },
  createdAt: new Date('2026-06-30T08:00:00.000Z'),
};

function expectLowSensitivePayload(input: unknown) {
  expect(JSON.stringify(input)).not.toMatch(
    /apiKey|encryptedApiKey|baseUrl|Authorization|Cookie|rawPrompt|rawQuestion|rawAnswer|rawResponse|signedUrl|storageKey|完整 source 原文|用户 prompt|客户姓名|手机号|身份证|病历详情/i,
  );
}

describe('platform AI usage credits server', () => {
  it('规范化过滤条件并限制 limit 上限', () => {
    const result = normalizePlatformAiUsageCreditsFilters({
      tenantId: ' tenant-001 ',
      status: 'succeeded',
      meteringStatus: 'metered',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      dateFrom: '2026-06-30T00:00:00.000Z',
      dateTo: '2026-06-30T23:59:59.000Z',
      limit: '200',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filters).toMatchObject({
        tenantId: 'tenant-001',
        status: 'succeeded',
        meteringStatus: 'metered',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        limit: 100,
      });
      expect(result.filters.dateFrom?.toISOString()).toBe('2026-06-30T00:00:00.000Z');
      expect(result.filters.dateTo?.toISOString()).toBe('2026-06-30T23:59:59.000Z');
    }
  });

  it('拒绝非法日期和 limit', () => {
    const result = normalizePlatformAiUsageCreditsFilters({ dateFrom: 'invalid-date', limit: '0' });

    expect(result).toEqual({ ok: false, errors: ['date_from_invalid', 'limit_invalid'] });
  });

  it('只把 metadata 映射为 knowledgeContextUsed 和 sourceCount', () => {
    const dto = mapPlatformAiUsageCreditRowToDto(usageRow);

    expect(dto).toMatchObject({
      id: 'usage-001',
      tenantId: 'tenant-001',
      tenantName: '星澜医美',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      promptTokens: 120,
      completionTokens: 80,
      totalTokens: 200,
      aiCreditsConsumed: 2,
      meteringStatus: 'metered',
      meteringVersion: 'v06-ui-verify-test',
      knowledgeContextUsed: true,
      sourceCount: 1,
      createdAt: '2026-06-30T08:00:00.000Z',
    });
    expectLowSensitivePayload(dto);
  });

  it('返回汇总和明细列表且保持低敏字段', async () => {
    const repository: PlatformAiUsageCreditsRepository = {
      summarizeUsageCredits: async (filters) => ({
        totalCalls: 2,
        succeededCalls: 1,
        failedCalls: 1,
        meteredCalls: 1,
        pendingCalls: 1,
        notBillableCalls: 0,
        totalAiCreditsConsumed: 2,
        filters,
      } as never),
      listUsageCredits: async () => [mapPlatformAiUsageCreditRowToDto(usageRow)],
    };

    const result = await listPlatformAiUsageCredits({
      repository,
      filters: { status: 'succeeded', meteringStatus: 'metered', provider: 'deepseek' },
    });

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.response.summary).toMatchObject({
        totalCalls: 2,
        succeededCalls: 1,
        failedCalls: 1,
        meteredCalls: 1,
        pendingCalls: 1,
        totalAiCreditsConsumed: 2,
      });
      expect(result.response.records).toHaveLength(1);
      expectLowSensitivePayload(result.response);
    }
  });
});
