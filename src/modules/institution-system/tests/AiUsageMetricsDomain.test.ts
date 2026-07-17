import { describe, expect, it } from 'vitest';
import {
  aggregateAiUsageMetrics,
  type AiUsageMetricRecord,
} from '@/modules/institution-system/domain/ai-usage-metrics';
import type { AiUsageTerminalStatusPolicy } from '@/modules/institution-system/domain/ai-usage-outcomes';

const scope = {
  tenantId: 'tenant-1',
  institutionId: 'institution-1',
} as const;

const terminalStatusPolicy = {
  succeeded: 'success',
  failed: 'failure',
  provider_unavailable: 'failure',
  rate_limited: 'failure',
  rejected: 'rejection',
  sensitive_input_rejected: 'rejection',
} satisfies AiUsageTerminalStatusPolicy;

describe('AI usage metrics domain', () => {
  it('聚合总量与三个稳定业务 serviceKey，并保留精确成功率分子分母', () => {
    const records = [
      {
        ...scope,
        status: 'succeeded',
        serviceKey: 'conversation_ai',
        serviceUnits: 2,
        prompt: 'sensitive prompt value',
        answer: 'sensitive answer value',
        model: 'sensitive-model-a',
        provider: 'sensitive-provider-a',
        serviceName: 'sensitive service name a',
        inputTokens: 101,
        outputTokens: 202,
        price: 9.99,
        cost: 8.88,
        errorMessage: 'sensitive full error text',
      },
      {
        ...scope,
        status: 'failed',
        serviceKey: 'conversation_ai',
        serviceUnits: 1,
        model: 'sensitive-model-b',
        provider: 'sensitive-provider-b',
        serviceName: 'sensitive service name b',
      },
      {
        ...scope,
        status: 'sensitive_input_rejected',
        serviceKey: 'knowledge_qa',
        serviceUnits: 0,
      },
      {
        ...scope,
        status: 'queued',
        serviceKey: 'knowledge_qa',
        serviceUnits: 0,
      },
      {
        ...scope,
        status: 'succeeded',
        serviceKey: 'analytics_report',
        serviceUnits: 3,
      },
      {
        ...scope,
        status: 'rejected',
        serviceKey: 'analytics_report',
        serviceUnits: 1,
      },
    ];
    const before = structuredClone(records);

    const result = aggregateAiUsageMetrics({
      scope,
      records,
      terminalStatusPolicy,
    });

    expect(result).toEqual({
      ok: true,
      metrics: {
        totalCallCount: 6,
        serviceUnits: 7,
        failureCount: 1,
        rejectionCount: 2,
        incompleteCount: 1,
        successRate: {
          numerator: 2,
          denominator: 5,
          value: 0.4,
        },
        byServiceKey: [
          {
            serviceKey: 'analytics_report',
            totalCallCount: 2,
            serviceUnits: 4,
            failureCount: 0,
            rejectionCount: 1,
            incompleteCount: 0,
            successRate: {
              numerator: 1,
              denominator: 2,
              value: 0.5,
            },
          },
          {
            serviceKey: 'conversation_ai',
            totalCallCount: 2,
            serviceUnits: 3,
            failureCount: 1,
            rejectionCount: 0,
            incompleteCount: 0,
            successRate: {
              numerator: 1,
              denominator: 2,
              value: 0.5,
            },
          },
          {
            serviceKey: 'knowledge_qa',
            totalCallCount: 2,
            serviceUnits: 0,
            failureCount: 0,
            rejectionCount: 1,
            incompleteCount: 1,
            successRate: {
              numerator: 0,
              denominator: 1,
              value: 0,
            },
          },
        ],
      },
    });
    expect(records).toEqual(before);

    const serialized = JSON.stringify(result);
    for (const forbiddenValue of [
      'prompt',
      'sensitive prompt value',
      'answer',
      'sensitive answer value',
      'model',
      'sensitive-model-a',
      'provider',
      'sensitive-provider-a',
      'serviceName',
      'sensitive service name a',
      'inputTokens',
      'outputTokens',
      'price',
      'cost',
      'errorMessage',
      'sensitive full error text',
    ]) {
      expect(serialized).not.toContain(forbiddenValue);
    }
  });

  it('任一服务单位来源缺失或不可解释时只将对应总计标为 null，不以 0 补齐', () => {
    const result = aggregateAiUsageMetrics({
      scope,
      terminalStatusPolicy,
      records: [
        {
          ...scope,
          status: 'succeeded',
          serviceKey: 'conversation_ai',
          serviceUnits: null,
        },
        {
          ...scope,
          status: 'succeeded',
          serviceKey: 'knowledge_qa',
          serviceUnits: 2,
        },
        {
          ...scope,
          status: 'failed',
          serviceKey: 'analytics_report',
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.code);
    }

    expect(result.metrics.serviceUnits).toBeNull();
    expect(result.metrics.byServiceKey).toEqual([
      expect.objectContaining({
        serviceKey: 'analytics_report',
        serviceUnits: null,
      }),
      expect.objectContaining({
        serviceKey: 'conversation_ai',
        serviceUnits: null,
      }),
      expect.objectContaining({
        serviceKey: 'knowledge_qa',
        serviceUnits: 2,
      }),
    ]);

    for (const invalidServiceUnits of [
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      const invalidUnitsResult = aggregateAiUsageMetrics({
        scope,
        terminalStatusPolicy,
        records: [
          {
            ...scope,
            status: 'succeeded',
            serviceKey: 'conversation_ai',
            serviceUnits: invalidServiceUnits,
          },
        ],
      });

      expect(invalidUnitsResult.ok).toBe(true);
      if (!invalidUnitsResult.ok) {
        throw new Error(invalidUnitsResult.code);
      }
      expect(invalidUnitsResult.metrics.serviceUnits).toBeNull();
      expect(invalidUnitsResult.metrics.byServiceKey[0]?.serviceUnits).toBeNull();
    }
  });

  it('incomplete 不进入成功率分母，分母为 0 时返回不可计算语义', () => {
    const result = aggregateAiUsageMetrics({
      scope,
      terminalStatusPolicy,
      records: [
        {
          ...scope,
          status: 'queued',
          serviceKey: 'conversation_ai',
          serviceUnits: 0,
        },
        {
          ...scope,
          status: 'future_status',
          serviceKey: 'conversation_ai',
          serviceUnits: 0,
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.code);
    }

    expect(result.metrics).toMatchObject({
      totalCallCount: 2,
      failureCount: 0,
      rejectionCount: 0,
      incompleteCount: 2,
      successRate: {
        numerator: 0,
        denominator: 0,
        value: null,
      },
    });
  });

  it.each([
    { tenantId: 'tenant-2', institutionId: scope.institutionId },
    { tenantId: scope.tenantId, institutionId: 'institution-2' },
    { tenantId: scope.tenantId, institutionId: null },
  ])('跨机构记录整批 fail-closed，不返回部分指标：$tenantId/$institutionId', (mixedScope) => {
    const records: readonly AiUsageMetricRecord[] = [
      {
        ...scope,
        status: 'succeeded',
        serviceKey: 'conversation_ai',
        serviceUnits: 1,
      },
      {
        ...mixedScope,
        status: 'succeeded',
        serviceKey: 'knowledge_qa',
        serviceUnits: 1,
      },
    ];

    const result = aggregateAiUsageMetrics({
      scope,
      records,
      terminalStatusPolicy,
    });

    expect(result).toEqual({
      ok: false,
      code: 'scope_mismatch',
      recordIndex: 1,
    });
    expect('metrics' in result).toBe(false);
  });

  it('拒绝缺失的显式 serviceKey，不从 model/provider/serviceName 回退推断', () => {
    const records = [
      {
        ...scope,
        status: 'succeeded',
        serviceKey: '',
        serviceUnits: 1,
        model: 'conversation_ai',
        provider: 'conversation_ai',
        serviceName: 'conversation_ai',
      },
    ];
    const result = aggregateAiUsageMetrics({
      scope,
      terminalStatusPolicy,
      records,
    });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_service_key',
      recordIndex: 0,
    });
  });

  it('拒绝非法终态策略，不返回任何指标', () => {
    const result = aggregateAiUsageMetrics({
      scope,
      records: [],
      terminalStatusPolicy: {
        succeeded: 'incomplete',
      } as unknown as AiUsageTerminalStatusPolicy,
    });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_terminal_status_policy',
    });
    expect('metrics' in result).toBe(false);
  });

  it('空记录返回 0 调用与 0 服务单位，但成功率仍不可计算', () => {
    const result = aggregateAiUsageMetrics({
      scope,
      records: [],
      terminalStatusPolicy,
    });

    expect(result).toEqual({
      ok: true,
      metrics: {
        totalCallCount: 0,
        serviceUnits: 0,
        failureCount: 0,
        rejectionCount: 0,
        incompleteCount: 0,
        successRate: {
          numerator: 0,
          denominator: 0,
          value: null,
        },
        byServiceKey: [],
      },
    });
  });
});
