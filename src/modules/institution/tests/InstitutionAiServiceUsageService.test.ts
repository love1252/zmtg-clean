import { describe, expect, it } from 'vitest';

import {
  buildInstitutionAiServiceUsageResponse,
  createInstitutionAiServiceUsageQuotaFromFixture,
  resolveInstitutionAiServiceUsagePeriod,
  type InstitutionAiServiceUsageRow,
} from '@/modules/institution/server/institution-ai-service-usage';

const period = {
  from: '2026-06-01',
  to: '2026-06-30',
  preset: 'currentMonth' as const,
};

function createRow(overrides: Partial<InstitutionAiServiceUsageRow> = {}): InstitutionAiServiceUsageRow {
  return {
    createdAt: new Date('2026-06-29T10:00:00.000Z'),
    status: 'succeeded',
    aiCreditsConsumed: 2,
    serviceCategory: 'ai_qa',
    serviceName: 'AI 问答',
    ...overrides,
  };
}

describe('机构端 AI 服务使用只读 facade', () => {
  it('无数据时返回低敏空视图', () => {
    const response = buildInstitutionAiServiceUsageResponse({
      period,
      rows: [],
    });

    expect(response).toEqual({
      requestId: 'institution-ai-service-usage',
      readonly: true,
      period,
      summary: {
        totalUsageCount: 0,
        succeededCount: 0,
        failedCount: 0,
        rejectedCount: 0,
        successRate: 0,
        aiServiceUnitsUsed: 0,
      },
      trend: [],
      serviceProjects: [],
      quota: {
        isLinked: true,
        status: 'active',
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
        totalAllowance: 1000,
        used: 420,
        remaining: 580,
        usageRate: 42,
        warningLevel: 'low',
        displayUnit: 'AI 服务额度',
        notes: [],
      },
      notes: expect.arrayContaining([
        expect.stringContaining('只展示机构端低敏服务使用统计'),
        expect.stringContaining('当前为只读额度视图'),
      ]),
    });
  });

  it('保留 quota.isLinked=false 兼容输出', () => {
    const response = buildInstitutionAiServiceUsageResponse({
      period,
      rows: [],
      quotaLinked: false,
    });

    expect(response.quota).toEqual({ isLinked: false });
  });

  it('从 mock fixture 返回 active / warning / overLimit / expired linked readonly quota', () => {
    expect(createInstitutionAiServiceUsageQuotaFromFixture('active')).toMatchObject({
      isLinked: true,
      status: 'active',
      totalAllowance: 1000,
      used: 420,
      remaining: 580,
      usageRate: 42,
      warningLevel: 'low',
    });
    expect(createInstitutionAiServiceUsageQuotaFromFixture('warning')).toMatchObject({
      isLinked: true,
      status: 'warning',
      totalAllowance: 1000,
      used: 880,
      remaining: 120,
      usageRate: 88,
      warningLevel: 'medium',
    });
    expect(createInstitutionAiServiceUsageQuotaFromFixture('overLimit')).toMatchObject({
      isLinked: true,
      status: 'overLimit',
      totalAllowance: 100,
      used: 126,
      remaining: 0,
      usageRate: 126,
      warningLevel: 'exceeded',
    });
    expect(JSON.stringify(createInstitutionAiServiceUsageQuotaFromFixture('overLimit'))).not.toMatch(
      /shouldBlock|isBlocked|hardBlock|deduct|charge|alert/i,
    );
    expect(createInstitutionAiServiceUsageQuotaFromFixture('expired')).toMatchObject({
      isLinked: true,
      status: 'expired',
      totalAllowance: 5000,
      used: 900,
      remaining: 4100,
      usageRate: 18,
      warningLevel: 'high',
    });
  });

  it('按日期和服务项目聚合，并隐藏模型、Token、内部积分字段', () => {
    const response = buildInstitutionAiServiceUsageResponse({
      period,
      rows: [
        createRow({
          createdAt: new Date('2026-06-29T10:00:00.000Z'),
          aiCreditsConsumed: 2,
        }),
        createRow({
          createdAt: new Date('2026-06-29T11:00:00.000Z'),
          status: 'failed',
          aiCreditsConsumed: 0,
        }),
        createRow({
          createdAt: new Date('2026-06-30T09:00:00.000Z'),
          status: 'rejected',
          aiCreditsConsumed: 0,
          serviceCategory: 'knowledge_base_qa',
          serviceName: '知识库问答',
        }),
        createRow({
          createdAt: new Date('2026-06-30T10:00:00.000Z'),
          status: 'sensitive_input_rejected',
          aiCreditsConsumed: 0,
          serviceCategory: '',
          serviceName: '',
        }),
      ],
    });

    expect(response.summary).toEqual({
      totalUsageCount: 4,
      succeededCount: 1,
      failedCount: 1,
      rejectedCount: 2,
      successRate: 25,
      aiServiceUnitsUsed: 2,
    });
    expect(response.trend).toEqual([
      { date: '2026-06-29', usageCount: 2, aiServiceUnitsUsed: 2 },
      { date: '2026-06-30', usageCount: 2, aiServiceUnitsUsed: 0 },
    ]);
    expect(response.serviceProjects).toEqual([
      {
        serviceCategory: 'ai_qa',
        serviceName: 'AI 问答',
        usageCount: 2,
        succeededCount: 1,
        failedCount: 1,
        rejectedCount: 0,
        successRate: 50,
        aiServiceUnitsUsed: 2,
        sharePercent: 100,
        used: 180,
        remaining: 270,
        usageRate: 40,
      },
      {
        serviceCategory: 'knowledge_base_qa',
        serviceName: '知识库问答',
        usageCount: 1,
        succeededCount: 0,
        failedCount: 0,
        rejectedCount: 1,
        successRate: 0,
        aiServiceUnitsUsed: 0,
        sharePercent: 0,
        used: 160,
        remaining: 190,
        usageRate: 45.7,
      },
      {
        serviceCategory: 'unknown',
        serviceName: '未归因服务',
        usageCount: 1,
        succeededCount: 0,
        failedCount: 0,
        rejectedCount: 1,
        successRate: 0,
        aiServiceUnitsUsed: 0,
        sharePercent: 0,
        used: 20,
        remaining: 30,
        usageRate: 40,
      },
    ]);

    const serialized = JSON.stringify(response);
    expect(serialized).not.toMatch(/provider|model|modelCode|totalTokens|Token|aiCreditsConsumed|prompt|question|answer|rawResponse|metadata|meteringDetails|apiKey|encryptedApiKey|baseUrl|Authorization|Cookie|RMB|¥/i);
  });

  it('支持预设和自定义时间范围，非法日期返回受控错误', () => {
    const now = new Date('2026-06-29T12:00:00.000Z');

    expect(resolveInstitutionAiServiceUsagePeriod(new URLSearchParams(), now)).toMatchObject({
      ok: true,
      period: {
        from: '2026-06-01',
        to: '2026-06-30',
        preset: 'currentMonth',
      },
    });
    expect(resolveInstitutionAiServiceUsagePeriod(new URLSearchParams('preset=today'), now)).toMatchObject({
      ok: true,
      period: {
        from: '2026-06-29',
        to: '2026-06-29',
        preset: 'today',
      },
    });
    expect(resolveInstitutionAiServiceUsagePeriod(new URLSearchParams('preset=last7days'), now)).toMatchObject({
      ok: true,
      period: {
        from: '2026-06-23',
        to: '2026-06-29',
        preset: 'last7days',
      },
    });
    expect(resolveInstitutionAiServiceUsagePeriod(new URLSearchParams('preset=lastMonth'), now)).toMatchObject({
      ok: true,
      period: {
        from: '2026-05-01',
        to: '2026-05-31',
        preset: 'lastMonth',
      },
    });
    expect(resolveInstitutionAiServiceUsagePeriod(new URLSearchParams('from=2026-05-01&to=2026-05-31'), now)).toMatchObject({
      ok: true,
      period: {
        from: '2026-05-01',
        to: '2026-05-31',
        preset: 'custom',
      },
    });
    expect(resolveInstitutionAiServiceUsagePeriod(new URLSearchParams('from=2026-06-31&to=2026-06-01'), now)).toEqual({
      ok: false,
      code: 'invalid_date_range',
      error: '时间范围无效',
    });
  });
});
