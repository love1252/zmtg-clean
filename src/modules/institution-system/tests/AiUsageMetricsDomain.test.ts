import { describe, expect, it } from 'vitest';
import {
  aggregateAiUsageMetrics,
  type AiUsageMetricRecord,
} from '@/modules/institution-system/domain/ai-usage-metrics';
import type { AiUsageTerminalStatusPolicy } from '@/modules/institution-system/domain/ai-usage-outcomes';
import type { AiUsageServiceKeyPolicy } from '@/modules/institution-system/domain/ai-usage-service-keys';

const scope = {
  tenantId: 'tenant-1',
  institutionId: 'institution-1',
} as const;

const timeWindow = {
  startInclusiveEpochMs: 1_000,
  endExclusiveEpochMs: 2_000,
} as const;

const recordBase = {
  ...scope,
  occurredAtEpochMs: 1_500,
} as const;

const terminalStatusPolicy = {
  succeeded: 'success',
  failed: 'failure',
  provider_unavailable: 'failure',
  rate_limited: 'failure',
  rejected: 'rejection',
  sensitive_input_rejected: 'rejection',
} satisfies AiUsageTerminalStatusPolicy;

const serviceKeyPolicy = [
  'conversation_ai',
  'knowledge_qa',
  'analytics_report',
] as const satisfies AiUsageServiceKeyPolicy;

const validRecord = {
  ...recordBase,
  status: 'succeeded',
  serviceKey: 'conversation_ai',
  serviceUnits: 1,
} as const satisfies AiUsageMetricRecord;

describe('AI usage metrics domain', () => {
  it('聚合总量与三个稳定业务 serviceKey，并保留精确成功率分子分母', () => {
    const records = [
      {
        ...recordBase,
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
        ...recordBase,
        status: 'failed',
        serviceKey: 'conversation_ai',
        serviceUnits: 1,
        model: 'sensitive-model-b',
        provider: 'sensitive-provider-b',
        serviceName: 'sensitive service name b',
      },
      {
        ...recordBase,
        status: 'sensitive_input_rejected',
        serviceKey: 'knowledge_qa',
        serviceUnits: 0,
      },
      {
        ...recordBase,
        status: 'queued',
        serviceKey: 'knowledge_qa',
        serviceUnits: 0,
      },
      {
        ...recordBase,
        status: 'succeeded',
        serviceKey: 'analytics_report',
        serviceUnits: 3,
      },
      {
        ...recordBase,
        status: 'rejected',
        serviceKey: 'analytics_report',
        serviceUnits: 1,
      },
    ];
    const before = structuredClone(records);
    const timeWindowBefore = structuredClone(timeWindow);

    const result = aggregateAiUsageMetrics({
      scope,
      records,
      terminalStatusPolicy,
      serviceKeyPolicy,
      timeWindow,
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
    expect(timeWindow).toEqual(timeWindowBefore);

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
      'occurredAtEpochMs',
      'startInclusiveEpochMs',
      'endExclusiveEpochMs',
    ]) {
      expect(serialized).not.toContain(forbiddenValue);
    }
  });

  it('任一服务单位来源缺失或不可解释时只将对应总计标为 null，不以 0 补齐', () => {
    const result = aggregateAiUsageMetrics({
      scope,
      terminalStatusPolicy,
      serviceKeyPolicy,
      timeWindow,
      records: [
        {
          ...recordBase,
          status: 'succeeded',
          serviceKey: 'conversation_ai',
          serviceUnits: null,
        },
        {
          ...recordBase,
          status: 'succeeded',
          serviceKey: 'knowledge_qa',
          serviceUnits: 2,
        },
        {
          ...recordBase,
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
        serviceKeyPolicy,
        timeWindow,
        records: [
          {
            ...recordBase,
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
      serviceKeyPolicy,
      timeWindow,
      records: [
        {
          ...recordBase,
          status: 'queued',
          serviceKey: 'conversation_ai',
          serviceUnits: 0,
        },
        {
          ...recordBase,
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
        ...recordBase,
        status: 'succeeded',
        serviceKey: 'conversation_ai',
        serviceUnits: 1,
      },
      {
        ...recordBase,
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
      serviceKeyPolicy,
      timeWindow,
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
        ...recordBase,
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
      serviceKeyPolicy,
      timeWindow,
      records,
    });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_service_key',
      recordIndex: 0,
    });
  });

  it('格式合法但未获准的 serviceKey 使整批失败且不返回部分指标', () => {
    const records = [
      {
        ...recordBase,
        status: 'succeeded',
        serviceKey: 'conversation_ai',
        serviceUnits: 1,
      },
      {
        ...recordBase,
        status: 'succeeded',
        serviceKey: 'future_unapproved_ai',
        serviceUnits: 1,
        model: 'future_unapproved_ai',
        provider: 'future_unapproved_ai',
        serviceName: 'future_unapproved_ai',
        errorMessage: 'sensitive full error text',
      },
    ];
    const before = structuredClone(records);

    const result = aggregateAiUsageMetrics({
      scope,
      records,
      terminalStatusPolicy,
      serviceKeyPolicy,
      timeWindow,
    });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_service_key',
      recordIndex: 1,
    });
    expect('metrics' in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain('future_unapproved_ai');
    expect(JSON.stringify(result)).not.toContain('sensitive full error text');
    expect(records).toEqual(before);
  });

  it('即使记录为空也拒绝非法时间窗，且不返回指标或窗口值', () => {
    const result = aggregateAiUsageMetrics({
      scope,
      records: [],
      terminalStatusPolicy,
      serviceKeyPolicy,
      timeWindow: {
        startInclusiveEpochMs: 1_000,
        endExclusiveEpochMs: 1_000,
      },
    });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_time_window',
    });
    expect('metrics' in result).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/startInclusiveEpochMs|endExclusiveEpochMs|1000/u);
  });

  it('只接受半开窗起点和终点前一毫秒，边界外记录整批拒绝', () => {
    const insideResult = aggregateAiUsageMetrics({
      scope,
      terminalStatusPolicy,
      serviceKeyPolicy,
      timeWindow,
      records: [
        { ...validRecord, occurredAtEpochMs: timeWindow.startInclusiveEpochMs },
        { ...validRecord, occurredAtEpochMs: timeWindow.endExclusiveEpochMs - 1 },
      ],
    });

    expect(insideResult.ok).toBe(true);
    if (!insideResult.ok) {
      throw new Error(insideResult.code);
    }
    expect(insideResult.metrics.totalCallCount).toBe(2);

    for (const occurredAtEpochMs of [
      timeWindow.startInclusiveEpochMs - 1,
      timeWindow.endExclusiveEpochMs,
    ]) {
      const outsideResult = aggregateAiUsageMetrics({
        scope,
        terminalStatusPolicy,
        serviceKeyPolicy,
        timeWindow,
        records: [{ ...validRecord, occurredAtEpochMs }],
      });

      expect(outsideResult).toEqual({
        ok: false,
        code: 'record_outside_time_window',
        recordIndex: 0,
      });
      expect('metrics' in outsideResult).toBe(false);
    }
  });

  it.each([
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
    { name: '字符串', value: '1500' },
    { name: 'NaN', value: Number.NaN },
    { name: '正无穷', value: Number.POSITIVE_INFINITY },
    { name: '负无穷', value: Number.NEGATIVE_INFINITY },
    { name: '小数', value: 1_500.5 },
    { name: '超过最大安全整数', value: Number.MAX_SAFE_INTEGER + 1 },
    { name: '小于最小安全整数', value: Number.MIN_SAFE_INTEGER - 1 },
  ])('记录时间为$name时整批失败且不返回原值或部分指标', ({ value }) => {
    const records = [
      validRecord,
      {
        ...validRecord,
        occurredAtEpochMs: value as number | null,
        prompt: 'sensitive prompt in invalid record',
        errorMessage: 'sensitive error in invalid record',
      },
    ];
    const before = structuredClone(records);

    const result = aggregateAiUsageMetrics({
      scope,
      records,
      terminalStatusPolicy,
      serviceKeyPolicy,
      timeWindow,
    });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_occurred_at',
      recordIndex: 1,
    });
    expect('metrics' in result).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/occurredAtEpochMs|sensitive|1500/u);
    expect(records).toEqual(before);
  });

  it('跨整批严格执行 scope、serviceKey、时间合法性和落窗优先级', () => {
    const scopeFirst = aggregateAiUsageMetrics({
      scope,
      terminalStatusPolicy,
      serviceKeyPolicy,
      timeWindow,
      records: [
        {
          ...validRecord,
          serviceKey: 'future_unapproved_ai',
          occurredAtEpochMs: timeWindow.endExclusiveEpochMs,
        },
        {
          ...validRecord,
          tenantId: 'tenant-2',
        },
      ],
    });
    const serviceKeyFirst = aggregateAiUsageMetrics({
      scope,
      terminalStatusPolicy,
      serviceKeyPolicy,
      timeWindow,
      records: [
        { ...validRecord, occurredAtEpochMs: Number.NaN },
        { ...validRecord, serviceKey: 'future_unapproved_ai' },
      ],
    });
    const invalidTimeFirst = aggregateAiUsageMetrics({
      scope,
      terminalStatusPolicy,
      serviceKeyPolicy,
      timeWindow,
      records: [
        { ...validRecord, occurredAtEpochMs: timeWindow.endExclusiveEpochMs },
        { ...validRecord, occurredAtEpochMs: null },
      ],
    });

    expect(scopeFirst).toEqual({
      ok: false,
      code: 'scope_mismatch',
      recordIndex: 1,
    });
    expect(serviceKeyFirst).toEqual({
      ok: false,
      code: 'invalid_service_key',
      recordIndex: 1,
    });
    expect(invalidTimeFirst).toEqual({
      ok: false,
      code: 'invalid_occurred_at',
      recordIndex: 1,
    });
  });

  it('后续窗外记录不泄露部分指标、原时间或夹带字段，并保持输入不变', () => {
    const mutableTimeWindow = {
      startInclusiveEpochMs: 1_000,
      endExclusiveEpochMs: 2_000,
    };
    const records = [
      validRecord,
      {
        ...validRecord,
        occurredAtEpochMs: 2_001,
        prompt: 'sensitive prompt in outside record',
        provider: 'sensitive provider in outside record',
        cost: 999,
      },
    ];
    const recordsBefore = structuredClone(records);
    const timeWindowBefore = structuredClone(mutableTimeWindow);

    const result = aggregateAiUsageMetrics({
      scope,
      records,
      terminalStatusPolicy,
      serviceKeyPolicy,
      timeWindow: mutableTimeWindow,
    });

    expect(result).toEqual({
      ok: false,
      code: 'record_outside_time_window',
      recordIndex: 1,
    });
    expect(Object.keys(result).sort()).toEqual(['code', 'ok', 'recordIndex']);
    expect(JSON.stringify(result)).not.toMatch(/2001|sensitive|provider|cost|metrics/u);
    expect(records).toEqual(recordsBefore);
    expect(mutableTimeWindow).toEqual(timeWindowBefore);
  });

  it('拒绝非法 serviceKey 策略，即使记录为空也不返回指标', () => {
    const result = aggregateAiUsageMetrics({
      scope,
      records: [],
      terminalStatusPolicy,
      serviceKeyPolicy: [],
      timeWindow,
    });

    expect(result).toEqual({
      ok: false,
      code: 'invalid_service_key_policy',
    });
    expect('metrics' in result).toBe(false);
  });

  it('拒绝非法终态策略，不返回任何指标', () => {
    const result = aggregateAiUsageMetrics({
      scope,
      records: [],
      serviceKeyPolicy,
      timeWindow,
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
      serviceKeyPolicy,
      timeWindow,
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
    expect(result).not.toHaveProperty('readiness');
    expect(result).not.toHaveProperty('freshness');
    expect(result).not.toHaveProperty('envelope');
    expect(result).not.toHaveProperty('empty');
  });
});
