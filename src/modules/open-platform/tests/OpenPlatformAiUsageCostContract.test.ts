import { describe, expect, it } from 'vitest';
import {
  getPlatformAiUsageCostResponse,
  normalizePlatformAiUsageMonth,
  validatePlatformAiUsageCostContract,
} from '@/modules/open-platform/server/platformAiUsageCostContract';

const forbiddenFragments = [
  'tenant_id',
  '真实机构 ID',
  'apiKey',
  'credential',
  'secret',
  'DATABASE_URL',
  'stack',
  '/Users/',
  'error_message',
  'raw metadata',
  '账单金额',
  '应收',
  '发票',
  '扣费',
];

function expectLowSensitivePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('平台端 AI 用量费用只读 contract', () => {
  it('返回受控只读 usage/cost 状态、月份白名单和未来日志字段说明', () => {
    const payload = getPlatformAiUsageCostResponse({ month: '2026-06' });

    expect(payload).toMatchObject({
      readonly: true,
      dataSource: 'controlled_demo',
      usageVersion: 'ai-usage-cost-v1-controlled-demo',
      usageStatus: 'controlled_readonly_demo',
      selectedMonth: '2026-06',
      hasUsageData: true,
      emptyState: null,
      costDisclaimer: expect.stringContaining('估算费用不是正式账单'),
      availableMonths: [
        { value: '2026-06', label: '2026年06月', hasUsageData: true },
        { value: '2026-05', label: '2026年05月', hasUsageData: false },
      ],
      futureLogFieldSpec: expect.arrayContaining([
        expect.objectContaining({ field: 'tenantScope' }),
        expect.objectContaining({ field: 'provider' }),
        expect.objectContaining({ field: 'modelId' }),
        expect.objectContaining({ field: 'scenario' }),
        expect.objectContaining({ field: 'source' }),
        expect.objectContaining({ field: 'status' }),
        expect.objectContaining({ field: 'latencyMs' }),
        expect.objectContaining({ field: 'inputTokens' }),
        expect.objectContaining({ field: 'outputTokens' }),
        expect.objectContaining({ field: 'totalTokens' }),
        expect.objectContaining({ field: 'estimatedCostCny' }),
        expect.objectContaining({ field: 'pricingVersion' }),
        expect.objectContaining({ field: 'billable' }),
        expect.objectContaining({ field: 'createdAt' }),
        expect.objectContaining({ field: 'sensitiveFieldPolicy' }),
      ]),
    });
    expect(JSON.stringify(payload.futureLogFieldSpec)).toContain('敏感字段不展示原文');
    expectLowSensitivePayload(payload);
  });

  it('月份参数只允许受控白名单，异常月份安全回落默认月份', () => {
    expect(normalizePlatformAiUsageMonth('2026-06')).toBe('2026-06');
    expect(normalizePlatformAiUsageMonth('2026-05')).toBe('2026-05');
    expect(normalizePlatformAiUsageMonth('bad-month')).toBe('2026-06');
    expect(normalizePlatformAiUsageMonth('2026-13')).toBe('2026-06');
    expect(normalizePlatformAiUsageMonth('../../secret')).toBe('2026-06');
    expect(normalizePlatformAiUsageMonth('2026-04')).toBe('2026-06');

    expect(getPlatformAiUsageCostResponse({ month: '../../secret' }).selectedMonth).toBe('2026-06');
  });

  it('有数据月份汇总与厂商模型明细一致且数值合法', () => {
    const payload = getPlatformAiUsageCostResponse({ month: '2026-06' });
    const providerTotals = payload.providerModelRows.reduce((totals, row) => ({
      calls: totals.calls + row.calls,
      tokens: totals.tokens + row.totalTokens,
      cost: totals.cost + row.estimatedCostCny,
    }), { calls: 0, tokens: 0, cost: 0 });

    expect(validatePlatformAiUsageCostContract(payload)).toEqual({ ok: true, errors: [] });
    expect(payload.summary.totalCalls).toBe(providerTotals.calls);
    expect(payload.summary.totalTokens).toBe(providerTotals.tokens);
    expect(payload.summary.estimatedCostCny).toBeCloseTo(providerTotals.cost, 2);
    expect(payload.summary.successRate).toBeGreaterThanOrEqual(0);
    expect(payload.summary.successRate).toBeLessThanOrEqual(1);
    expect(payload.summary.averageLatencyMs).toBeGreaterThanOrEqual(0);
    payload.providerModelRows.forEach((row) => {
      expect(row.successRate).toBeGreaterThanOrEqual(0);
      expect(row.successRate).toBeLessThanOrEqual(1);
      expect(row.averageLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  it('空状态月份 summary 归零且明细为空', () => {
    const payload = getPlatformAiUsageCostResponse({ month: '2026-05' });

    expect(validatePlatformAiUsageCostContract(payload)).toEqual({ ok: true, errors: [] });
    expect(payload).toMatchObject({
      selectedMonth: '2026-05',
      hasUsageData: false,
      emptyState: {
        title: '暂无受控示例用量',
        description: '2026年05月为受控示例月份，未读取真实 AI 日志；估算费用不是正式账单。',
      },
      summary: {
        month: '2026-05',
        totalCalls: 0,
        totalTokens: 0,
        successRate: 0,
        averageLatencyMs: 0,
        estimatedCostCny: 0,
      },
      providerModelRows: [],
      scenarioRows: [],
      sampleInstitutionRanking: [],
    });
    expectLowSensitivePayload(payload);
  });

  it('能发现 usage/cost contract 破坏性数据问题', () => {
    const invalidMonth = structuredClone(getPlatformAiUsageCostResponse({ month: '2026-06' }));
    invalidMonth.selectedMonth = '2026-04';
    expect(validatePlatformAiUsageCostContract(invalidMonth).errors).toContain('selectedMonth 必须来自 availableMonths');

    const invalidEmpty = structuredClone(getPlatformAiUsageCostResponse({ month: '2026-05' }));
    invalidEmpty.summary.totalCalls = 1;
    expect(validatePlatformAiUsageCostContract(invalidEmpty).errors).toContain('无数据月份 summary 必须归零且明细为空');

    const invalidAggregation = structuredClone(getPlatformAiUsageCostResponse({ month: '2026-06' }));
    invalidAggregation.summary.totalCalls += 1;
    expect(validatePlatformAiUsageCostContract(invalidAggregation).errors).toContain('有数据月份 summary 必须与 providerModelRows 汇总一致');

    const invalidRate = structuredClone(getPlatformAiUsageCostResponse({ month: '2026-06' }));
    invalidRate.summary.successRate = 1.2;
    expect(validatePlatformAiUsageCostContract(invalidRate).errors).toContain('successRate 必须在 0 到 1');

    const invalidLatency = structuredClone(getPlatformAiUsageCostResponse({ month: '2026-06' }));
    invalidLatency.summary.averageLatencyMs = -1;
    expect(validatePlatformAiUsageCostContract(invalidLatency).errors).toContain('averageLatencyMs 不得为负数');

    const invalidDisclaimer = structuredClone(getPlatformAiUsageCostResponse({ month: '2026-06' }));
    invalidDisclaimer.costDisclaimer = '运营参考';
    expect(validatePlatformAiUsageCostContract(invalidDisclaimer).errors).toContain('costDisclaimer 必须包含“估算费用不是正式账单”');

    const invalidFutureSpec = structuredClone(getPlatformAiUsageCostResponse({ month: '2026-06' }));
    invalidFutureSpec.futureLogFieldSpec = invalidFutureSpec.futureLogFieldSpec.filter((field) => field.field !== 'sensitiveFieldPolicy');
    expect(validatePlatformAiUsageCostContract(invalidFutureSpec).errors).toContain('futureLogFieldSpec 必须说明敏感字段不展示原文');
  });
});
