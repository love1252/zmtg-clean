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
  '受控示例',
  '示例用量',
  '智美天工医美智能运营系统',
];

function expectLowSensitivePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  forbiddenFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('平台端 AI 用量费用只读 contract', () => {
  it('未接入真实 AI 日志时只返回空态、字段说明和归零汇总', () => {
    const payload = getPlatformAiUsageCostResponse({ month: '2026-06' });

    expect(payload).toMatchObject({
      readonly: true,
      dataSource: 'unconnected',
      usageVersion: 'ai-usage-cost-v1-unconnected',
      usageStatus: 'not_connected',
      selectedMonth: '2026-06',
      usageDate: null,
      hasUsageData: false,
      emptyState: {
        title: '暂无真实 AI 用量记录',
        description: '当前未接入真实 AI 调用日志；不会展示预置用量、机构排行或估算账单。',
      },
      summary: {
        month: '2026-06',
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        successRate: 0,
        averageLatencyMs: 0,
        estimatedCostCny: 0,
        peakDayCostCny: 0,
      },
      providerModelRows: [],
      dailyRows: [],
      providerUsageGroups: [],
      scenarioRows: [],
      sampleInstitutionRanking: [],
      costDisclaimer: expect.stringContaining('估算费用不是正式账单'),
      futureLogFieldSpec: expect.arrayContaining([
        expect.objectContaining({ field: 'tenantScope' }),
        expect.objectContaining({ field: 'provider' }),
        expect.objectContaining({ field: 'modelId' }),
        expect.objectContaining({ field: 'scenario' }),
        expect.objectContaining({ field: 'sensitiveFieldPolicy' }),
      ]),
    });
    expect(validatePlatformAiUsageCostContract(payload)).toEqual({ ok: true, errors: [] });
    expectLowSensitivePayload(payload);
  });

  it('月份参数只允许安全月份格式，异常月份回落到当前测试服务器默认月份', () => {
    expect(normalizePlatformAiUsageMonth('2026-05')).toBe('2026-05');
    expect(normalizePlatformAiUsageMonth('2026-06')).toBe('2026-06');
    expect(normalizePlatformAiUsageMonth('bad-month')).toBe('2026-06');
    expect(normalizePlatformAiUsageMonth('2026-13')).toBe('2026-06');
    expect(normalizePlatformAiUsageMonth('../../secret')).toBe('2026-06');

    expect(getPlatformAiUsageCostResponse({ month: '../../secret' }).selectedMonth).toBe('2026-06');
  });

  it('按日期查询也不能映射示例消耗，只保留空态和所选日期', () => {
    const payload = getPlatformAiUsageCostResponse({ month: '2026-06', usageDate: '2026-06-22' });

    expect(payload).toMatchObject({
      selectedMonth: '2026-06',
      usageDate: '2026-06-22',
      hasUsageData: false,
      emptyState: {
        title: '暂无真实 AI 用量记录',
      },
      providerModelRows: [],
      dailyRows: [],
      providerUsageGroups: [],
      scenarioRows: [],
      sampleInstitutionRanking: [],
    });
    expect(payload.summary.totalCalls).toBe(0);
    expect(payload.summary.totalTokens).toBe(0);
    expect(payload.summary.estimatedCostCny).toBe(0);
    expect(validatePlatformAiUsageCostContract(payload)).toEqual({ ok: true, errors: [] });
    expectLowSensitivePayload(payload);
  });

  it('能发现 usage/cost contract 破坏性数据问题', () => {
    const invalidMonth = structuredClone(getPlatformAiUsageCostResponse({ month: '2026-06' }));
    invalidMonth.selectedMonth = '2026-13';
    expect(validatePlatformAiUsageCostContract(invalidMonth).errors).toContain('selectedMonth 必须是 YYYY-MM 安全月份');

    const invalidEmpty = structuredClone(getPlatformAiUsageCostResponse({ month: '2026-06' }));
    invalidEmpty.summary.totalCalls = 1;
    expect(validatePlatformAiUsageCostContract(invalidEmpty).errors).toContain('未接入状态 summary 必须归零且明细为空');

    const invalidRows = structuredClone(getPlatformAiUsageCostResponse({ month: '2026-06' }));
    invalidRows.providerModelRows = [{
      providerId: 'qwen',
      providerName: '通义千问',
      modelId: 'qwen-plus',
      modelName: 'Qwen Plus',
      calls: 1,
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      successRate: 1,
      averageLatencyMs: 100,
      estimatedCostCny: 0.01,
      costShare: 100,
      callShare: 100,
    }];
    expect(validatePlatformAiUsageCostContract(invalidRows).errors).toContain('未接入状态 summary 必须归零且明细为空');

    const invalidDisclaimer = structuredClone(getPlatformAiUsageCostResponse({ month: '2026-06' }));
    invalidDisclaimer.costDisclaimer = '运营参考';
    expect(validatePlatformAiUsageCostContract(invalidDisclaimer).errors).toContain('costDisclaimer 必须包含“估算费用不是正式账单”');

    const invalidFutureSpec = structuredClone(getPlatformAiUsageCostResponse({ month: '2026-06' }));
    invalidFutureSpec.futureLogFieldSpec = invalidFutureSpec.futureLogFieldSpec.filter((field) => field.field !== 'sensitiveFieldPolicy');
    expect(validatePlatformAiUsageCostContract(invalidFutureSpec).errors).toContain('futureLogFieldSpec 必须说明敏感字段不展示原文');
  });
});
