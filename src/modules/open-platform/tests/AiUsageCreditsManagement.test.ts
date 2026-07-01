import { describe, expect, it } from 'vitest';

import {
  buildPlatformAiUsageCreditsFilterOptions,
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
  serviceCategory: 'knowledge_base_qa',
  serviceName: '知识库问答',
  serviceSource: 'institution_knowledge_qa',
  serviceAction: 'rag_answer',
  serviceVersion: 'v06-service-metering-1',
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


function filterOptionsForTest() {
  return {
    providers: [{
      provider: 'deepseek',
      displayName: 'DeepSeek',
      logoUrl: '/ai-vendor-logos/deepseek.svg',
      logoText: 'D',
      logoClassName: 'bg-emerald-600',
      source: 'system' as const,
    }],
    models: [{
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      displayName: 'DeepSeek V4 Flash',
      providerDisplayName: 'DeepSeek',
      logoUrl: '/ai-vendor-logos/deepseek.svg',
      logoText: 'D',
      logoClassName: 'bg-emerald-600',
      source: 'system' as const,
    }],
    tenants: [{ tenantId: 'tenant-001', tenantName: '星澜医美' }],
    statuses: ['succeeded', 'failed'],
    meteringStatuses: ['metered', 'pending', 'not_billable', 'legacy', 'empty'],
  };
}

function zeroSummaryForTest() {
  return {
    totalCalls: 0,
    succeededCalls: 0,
    failedCalls: 0,
    meteredCalls: 0,
    pendingCalls: 0,
    notBillableCalls: 0,
    totalAiCreditsConsumed: 0,
  };
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
      aggregateUsageCredits: async (filters) => ({
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
          pendingCalls: 1,
          notBillableCalls: 0,
          totalTokens: 200,
          totalAiCreditsConsumed: 2,
        }],
        byMeteringStatus: [
          { meteringStatus: 'metered', calls: 1, totalAiCreditsConsumed: 2 },
          { meteringStatus: 'empty', calls: 1, totalAiCreditsConsumed: 0 },
        ],
        byDate: [{
          date: '2026-06-30',
          totalCalls: 2,
          succeededCalls: 1,
          failedCalls: 1,
          totalAiCreditsConsumed: 2,
        }],
        byDateProvider: [{
          date: '2026-06-30',
          provider: 'deepseek',
          providerDisplayName: 'DeepSeek',
          totalCalls: 2,
          totalTokens: 200,
          totalAiCreditsConsumed: 2,
        }],
        byDateProviderModel: [{
          date: '2026-06-30',
          provider: 'deepseek',
          providerDisplayName: 'DeepSeek',
          model: 'deepseek-v4-flash',
          modelDisplayName: 'DeepSeek V4 Flash',
          totalCalls: 2,
          succeededCalls: 1,
          failedCalls: 1,
          totalTokens: 200,
          totalAiCreditsConsumed: 2,
        }],
        byServiceProject: [{
          serviceCategory: 'knowledge_base_qa',
          serviceName: '知识库问答',
          serviceSource: 'institution_ai_call',
          serviceAction: 'rag_answer',
          serviceVersion: 'v06-service-metering-1',
          totalCalls: 2,
          succeededCalls: 1,
          failedCalls: 1,
          meteredCalls: 1,
          pendingCalls: 1,
          notBillableCalls: 0,
          totalTokens: 200,
          totalAiCreditsConsumed: 2,
        }, {
          serviceCategory: 'unknown',
          serviceName: '未归因服务',
          serviceSource: null,
          serviceAction: null,
          serviceVersion: null,
          totalCalls: 1,
          succeededCalls: 0,
          failedCalls: 1,
          meteredCalls: 0,
          pendingCalls: 0,
          notBillableCalls: 1,
          totalTokens: 0,
          totalAiCreditsConsumed: 0,
        }],
        filters,
      } as never),
      listFilterOptions: async () => filterOptionsForTest(),
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
      expect(result.response.aggregations.byModel).toEqual([expect.objectContaining({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        totalCalls: 2,
        totalTokens: 200,
        totalAiCreditsConsumed: 2,
      })]);
      expect(result.response.aggregations.byTenant).toEqual([expect.objectContaining({
        tenantId: 'tenant-001',
        tenantName: '星澜医美',
        pendingCalls: 1,
        totalTokens: 200,
        totalAiCreditsConsumed: 2,
      })]);
      expect(result.response.aggregations.byMeteringStatus).toEqual([
        expect.objectContaining({ meteringStatus: 'metered', calls: 1, totalAiCreditsConsumed: 2 }),
        expect.objectContaining({ meteringStatus: 'empty', calls: 1, totalAiCreditsConsumed: 0 }),
      ]);
      expect(result.response.aggregations.byDate).toEqual([expect.objectContaining({
        date: '2026-06-30',
        totalCalls: 2,
        totalAiCreditsConsumed: 2,
      })]);
      expect(result.response.aggregations.byDateProvider).toEqual([expect.objectContaining({
        date: '2026-06-30',
        provider: 'deepseek',
        providerDisplayName: 'DeepSeek',
        totalCalls: 2,
        totalTokens: 200,
        totalAiCreditsConsumed: 2,
      })]);
      expect(result.response.aggregations.byDateProviderModel).toEqual([expect.objectContaining({
        date: '2026-06-30',
        provider: 'deepseek',
        providerDisplayName: 'DeepSeek',
        model: 'deepseek-v4-flash',
        modelDisplayName: 'DeepSeek V4 Flash',
        totalCalls: 2,
        succeededCalls: 1,
        failedCalls: 1,
        totalTokens: 200,
        totalAiCreditsConsumed: 2,
      })]);
      expect(result.response.aggregations.byServiceProject).toEqual([
        expect.objectContaining({
          serviceCategory: 'knowledge_base_qa',
          serviceName: '知识库问答',
          serviceSource: 'institution_ai_call',
          serviceAction: 'rag_answer',
          serviceVersion: 'v06-service-metering-1',
          totalCalls: 2,
          succeededCalls: 1,
          failedCalls: 1,
          meteredCalls: 1,
          pendingCalls: 1,
          notBillableCalls: 0,
          totalTokens: 200,
          totalAiCreditsConsumed: 2,
        }),
        expect.objectContaining({
          serviceCategory: 'unknown',
          serviceName: '未归因服务',
          serviceSource: null,
          serviceAction: null,
          serviceVersion: null,
          totalCalls: 1,
          notBillableCalls: 1,
          totalTokens: 0,
          totalAiCreditsConsumed: 0,
        }),
      ]);
      expect(result.response.filterOptions).toMatchObject({
        providers: [{ provider: 'deepseek', displayName: 'DeepSeek', logoText: 'D', source: 'system' }],
        models: [{ provider: 'deepseek', model: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', providerDisplayName: 'DeepSeek', source: 'system' }],
        tenants: [{ tenantId: 'tenant-001', tenantName: '星澜医美' }],
      });
      expect(result.response.records).toHaveLength(1);
      expectLowSensitivePayload(result.response);
    }
  });


  it('构建低敏筛选候选项并合并去重历史值', () => {
    const filterOptions = buildPlatformAiUsageCreditsFilterOptions({
      modelRows: [
        { provider: 'deepseek', model: 'deepseek-v4-flash' },
        { provider: 'deepseek', model: 'deepseek-v4-flash' },
        { provider: 'unknown', model: 'pre_call_safety_check' },
        { provider: '', model: null },
      ],
      tenantRows: [
        { tenantId: 'tenant-001', tenantName: '星澜医美' },
        { tenantId: 'tenant-001', tenantName: '重复租户不应重复展示' },
        { tenantId: 'tenant-history', tenantName: null },
      ],
      statusRows: [{ status: 'succeeded' }, { status: 'legacy_status' }],
      meteringStatusRows: [{ meteringStatus: 'metered' }, { meteringStatus: null }, { meteringStatus: 'unexpected_metering' }],
    });

    expect(filterOptions.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'deepseek', displayName: 'DeepSeek', logoText: 'D', source: 'system' }),
      expect.objectContaining({ provider: 'unknown', displayName: null, source: 'history' }),
    ]));
    expect(filterOptions.models).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'deepseek', model: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash', providerDisplayName: 'DeepSeek', source: 'system' }),
      expect.objectContaining({ provider: 'unknown', model: 'pre_call_safety_check', displayName: null, source: 'history' }),
      expect.objectContaining({ provider: 'unknown', model: 'unknown', displayName: null, source: 'history' }),
    ]));
    expect(filterOptions.tenants).toEqual(expect.arrayContaining([
      { tenantId: 'tenant-001', tenantName: '星澜医美' },
      { tenantId: 'tenant-history', tenantName: null },
    ]));
    expect(filterOptions.tenants.filter((tenant) => tenant.tenantId === 'tenant-001')).toHaveLength(1);
    expect(filterOptions.statuses).toEqual(expect.arrayContaining(['succeeded', 'failed', 'legacy_status']));
    expect(filterOptions.meteringStatuses).toEqual(expect.arrayContaining(['metered', 'empty', 'legacy']));
    expectLowSensitivePayload(filterOptions);
  });

  it('把过滤条件传递给聚合查询', async () => {
    const seenFilters: unknown[] = [];
    const repository: PlatformAiUsageCreditsRepository = {
      summarizeUsageCredits: async () => zeroSummaryForTest(),
      aggregateUsageCredits: async (filters) => {
        seenFilters.push(filters);
        return {
          byModel: [],
          byTenant: [],
          byMeteringStatus: [],
          byDate: [],
          byDateProvider: [],
          byDateProviderModel: [],
          byServiceProject: [],
        };
      },
      listFilterOptions: async () => filterOptionsForTest(),
      listUsageCredits: async () => [],
    };

    const result = await listPlatformAiUsageCredits({
      repository,
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

    expect(result.status).toBe('ok');
    expect(seenFilters).toHaveLength(1);
    expect(seenFilters[0]).toMatchObject({
      tenantId: 'tenant-001',
      status: 'succeeded',
      meteringStatus: 'metered',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      limit: 25,
    });
  });
});
