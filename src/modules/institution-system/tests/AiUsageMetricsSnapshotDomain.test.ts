import { describe, expect, it } from 'vitest';

import type { AiUsageMetrics } from '@/modules/institution-system/domain/ai-usage-metrics';
import { createAiUsageMetricsSnapshot } from '@/modules/institution-system/domain/ai-usage-metrics-snapshot';
import type { AiUsageServiceKeyPolicy } from '@/modules/institution-system/domain/ai-usage-service-keys';

const serviceKeyPolicy = [
  'conversation_ai',
  'knowledge_qa',
  'analytics_report',
] as const satisfies AiUsageServiceKeyPolicy;

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? Array<DeepMutable<Item>>
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

function createValidMetrics(): DeepMutable<AiUsageMetrics> {
  return {
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
  };
}

function createSnapshot(metrics: unknown, policy: AiUsageServiceKeyPolicy = serviceKeyPolicy) {
  return createAiUsageMetricsSnapshot({
    metrics,
    serviceKeyPolicy: policy,
  });
}

function expectInvalidMetrics(metrics: unknown) {
  const result = createSnapshot(metrics);

  expect(result).toEqual({
    ok: false,
    code: 'invalid_metrics_snapshot',
  });
  expect('snapshot' in result).toBe(false);

  return result;
}

describe('AI usage metrics snapshot domain', () => {
  it('将现有低敏指标深复制并深冻结，不保留输入别名', () => {
    const metrics = createValidMetrics();
    const before = structuredClone(metrics);
    const mutablePolicy: string[] = [...serviceKeyPolicy];

    const result = createSnapshot(metrics, mutablePolicy);

    expect(result).toEqual({ ok: true, snapshot: before });
    if (!result.ok) {
      throw new Error(result.code);
    }

    expect(result.snapshot).not.toBe(metrics);
    expect(result.snapshot.successRate).not.toBe(metrics.successRate);
    expect(result.snapshot.byServiceKey).not.toBe(metrics.byServiceKey);
    for (const [index, summary] of result.snapshot.byServiceKey.entries()) {
      expect(summary).not.toBe(metrics.byServiceKey[index]);
      expect(summary.successRate).not.toBe(metrics.byServiceKey[index]?.successRate);
      expect(Object.isFrozen(summary)).toBe(true);
      expect(Object.isFrozen(summary.successRate)).toBe(true);
    }
    expect(Object.isFrozen(result.snapshot)).toBe(true);
    expect(Object.isFrozen(result.snapshot.successRate)).toBe(true);
    expect(Object.isFrozen(result.snapshot.byServiceKey)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(metrics).toEqual(before);
    expect(mutablePolicy).toEqual(serviceKeyPolicy);
    expect(Object.isFrozen(metrics)).toBe(false);
    expect(Object.isFrozen(metrics.successRate)).toBe(false);
    expect(Object.isFrozen(metrics.byServiceKey)).toBe(false);

    metrics.successRate.value = 0;
    metrics.byServiceKey[0]!.serviceUnits = 999;
    mutablePolicy.splice(0, mutablePolicy.length, 'future_unapproved_ai');

    expect(result.snapshot).toEqual(before);
    expect(metrics).not.toEqual(before);
  });

  it('接受调用者已深冻结的指标且不尝试写入', () => {
    const metrics = createValidMetrics();
    Object.freeze(metrics.successRate);
    for (const summary of metrics.byServiceKey) {
      Object.freeze(summary.successRate);
      Object.freeze(summary);
    }
    Object.freeze(metrics.byServiceKey);
    Object.freeze(metrics);

    const result = createSnapshot(metrics, Object.freeze([...serviceKeyPolicy]));

    expect(result).toEqual({ ok: true, snapshot: metrics });
    expect(Object.isFrozen(metrics)).toBe(true);
  });

  it('只返回既有指标白名单，不声明来源完整性、权威空值或 capability', () => {
    const emptyMetrics: AiUsageMetrics = {
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
    };

    const result = createSnapshot(emptyMetrics);

    expect(result).toEqual({ ok: true, snapshot: emptyMetrics });
    if (!result.ok) {
      throw new Error(result.code);
    }
    expect(Object.keys(result.snapshot).sort()).toEqual([
      'byServiceKey',
      'failureCount',
      'incompleteCount',
      'rejectionCount',
      'serviceUnits',
      'successRate',
      'totalCallCount',
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /authoritative|capability|empty|envelope|failureCode|freshness|observedAt|partial|readiness|stale/u,
    );
  });

  it('接受普通对象和 null prototype 指标，但拒绝类实例', () => {
    const nullPrototypeMetrics = Object.assign(Object.create(null), createValidMetrics());

    expect(createSnapshot(nullPrototypeMetrics).ok).toBe(true);

    class MetricsContainer {
      totalCallCount = 6;
      serviceUnits = 7;
      failureCount = 1;
      rejectionCount = 2;
      incompleteCount = 1;
      successRate = { numerator: 2, denominator: 5, value: 0.4 };
      byServiceKey = createValidMetrics().byServiceKey;
    }

    expectInvalidMetrics(new MetricsContainer());
  });

  it.each([
    { name: 'null', metrics: null },
    { name: '数组', metrics: [] },
    { name: '日期实例', metrics: new Date(0) },
    { name: 'Map', metrics: new Map() },
    { name: '空对象', metrics: {} },
    { name: '嵌套成功率缺失', metrics: { ...createValidMetrics(), successRate: null } },
    { name: '分服务数组类型错误', metrics: { ...createValidMetrics(), byServiceKey: {} } },
  ])('拒绝不完整或非普通对象输入：$name', ({ metrics }) => {
    expectInvalidMetrics(metrics);
  });

  it.each([
    { name: '空策略', policy: [] },
    { name: '重复策略', policy: ['conversation_ai', 'conversation_ai'] },
    { name: '非法格式策略', policy: ['Conversation AI'] },
  ])('调用者提供$name时先整包拒绝', ({ policy }) => {
    const result = createSnapshot(
      createValidMetrics(),
      policy as AiUsageServiceKeyPolicy,
    );

    expect(result).toEqual({
      ok: false,
      code: 'invalid_service_key_policy',
    });
    expect('snapshot' in result).toBe(false);
  });

  it('策略与指标同时非法时保持策略错误优先且不检查指标内容', () => {
    const result = createSnapshot(
      { provider: 'sensitive-provider' },
      [],
    );

    expect(result).toEqual({
      ok: false,
      code: 'invalid_service_key_policy',
    });
  });

  it('serviceKey 必须获准、唯一且保持 A1 的确定性顺序', () => {
    const unapproved = createValidMetrics();
    unapproved.byServiceKey[0]!.serviceKey = 'future_unapproved_ai';
    expectInvalidMetrics(unapproved);

    const duplicate = createValidMetrics();
    duplicate.byServiceKey[1]!.serviceKey = 'analytics_report';
    expectInvalidMetrics(duplicate);

    const unsorted = createValidMetrics();
    unsorted.byServiceKey = [
      unsorted.byServiceKey[1]!,
      unsorted.byServiceKey[0]!,
      unsorted.byServiceKey[2]!,
    ];
    expectInvalidMetrics(unsorted);
  });

  it.each([
    { name: '负数', value: -1 },
    { name: '负零', value: -0 },
    { name: '小数', value: 1.5 },
    { name: 'NaN', value: Number.NaN },
    { name: '正无穷', value: Number.POSITIVE_INFINITY },
    { name: '超过安全整数', value: Number.MAX_SAFE_INTEGER + 1 },
  ])('计数为$name时整包拒绝', ({ value }) => {
    expectInvalidMetrics({
      ...createValidMetrics(),
      totalCallCount: value,
    });
  });

  it.each([
    { name: '负数', value: -1 },
    { name: '负零', value: -0 },
    { name: '小数', value: 1.5 },
    { name: 'NaN', value: Number.NaN },
    { name: '负无穷', value: Number.NEGATIVE_INFINITY },
    { name: '超过安全整数', value: Number.MAX_SAFE_INTEGER + 1 },
  ])('分服务计数为$name时同样拒绝', ({ value }) => {
    const metrics = createValidMetrics();
    metrics.byServiceKey[0]!.failureCount = value;
    expectInvalidMetrics(metrics);
  });

  it('逐级验证成功率分母、总调用和 value 的精确算术关系', () => {
    const denominatorConflict = createValidMetrics();
    denominatorConflict.successRate.denominator = 6;
    expectInvalidMetrics(denominatorConflict);

    const totalConflict = createValidMetrics();
    totalConflict.totalCallCount = 7;
    expectInvalidMetrics(totalConflict);

    const valueConflict = createValidMetrics();
    valueConflict.successRate.value = 0.5;
    expectInvalidMetrics(valueConflict);

    const zeroDenominatorConflict = createValidMetrics();
    zeroDenominatorConflict.byServiceKey[2]!.rejectionCount = 0;
    zeroDenominatorConflict.byServiceKey[2]!.successRate.denominator = 0;
    zeroDenominatorConflict.byServiceKey[2]!.successRate.value = 0;
    expectInvalidMetrics(zeroDenominatorConflict);

    const negativeZeroRate = createValidMetrics();
    negativeZeroRate.byServiceKey[2]!.successRate.value = -0;
    expectInvalidMetrics(negativeZeroRate);
  });

  it.each([
    {
      name: 'total/incomplete',
      adjust(metrics: DeepMutable<AiUsageMetrics>) {
        const summary = metrics.byServiceKey[0]!;
        summary.incompleteCount += 1;
        summary.totalCallCount += 1;
      },
    },
    {
      name: 'failure',
      adjust(metrics: DeepMutable<AiUsageMetrics>) {
        const summary = metrics.byServiceKey[0]!;
        summary.failureCount += 1;
        summary.successRate.denominator += 1;
        summary.successRate.value = summary.successRate.numerator / summary.successRate.denominator;
        summary.totalCallCount += 1;
      },
    },
    {
      name: 'rejection',
      adjust(metrics: DeepMutable<AiUsageMetrics>) {
        const summary = metrics.byServiceKey[0]!;
        summary.rejectionCount += 1;
        summary.successRate.denominator += 1;
        summary.successRate.value = summary.successRate.numerator / summary.successRate.denominator;
        summary.totalCallCount += 1;
      },
    },
    {
      name: 'numerator',
      adjust(metrics: DeepMutable<AiUsageMetrics>) {
        const summary = metrics.byServiceKey[0]!;
        summary.successRate.numerator += 1;
        summary.successRate.denominator += 1;
        summary.successRate.value = summary.successRate.numerator / summary.successRate.denominator;
        summary.totalCallCount += 1;
      },
    },
  ])('分服务 $name 整数计数必须精确汇总到顶层', ({ adjust }) => {
    const metrics = createValidMetrics();
    adjust(metrics);
    expectInvalidMetrics(metrics);
  });

  it('分服务安全整数累加溢出时整包拒绝', () => {
    const largestSummary = {
      serviceKey: 'analytics_report',
      totalCallCount: Number.MAX_SAFE_INTEGER,
      serviceUnits: 0,
      failureCount: 0,
      rejectionCount: 0,
      incompleteCount: 0,
      successRate: {
        numerator: Number.MAX_SAFE_INTEGER,
        denominator: Number.MAX_SAFE_INTEGER,
        value: 1,
      },
    };
    const overflowMetrics = {
      totalCallCount: Number.MAX_SAFE_INTEGER,
      serviceUnits: 0,
      failureCount: 0,
      rejectionCount: 0,
      incompleteCount: 0,
      successRate: {
        numerator: Number.MAX_SAFE_INTEGER,
        denominator: Number.MAX_SAFE_INTEGER,
        value: 1,
      },
      byServiceKey: [
        largestSummary,
        {
          serviceKey: 'conversation_ai',
          totalCallCount: 1,
          serviceUnits: 0,
          failureCount: 0,
          rejectionCount: 0,
          incompleteCount: 0,
          successRate: {
            numerator: 1,
            denominator: 1,
            value: 1,
          },
        },
      ],
    };

    expectInvalidMetrics(overflowMetrics);
  });

  it.each([
    { name: '负数', value: -1 },
    { name: '负零', value: -0 },
    { name: 'NaN', value: Number.NaN },
    { name: '正无穷', value: Number.POSITIVE_INFINITY },
  ])('服务单位为$name时拒绝，不补成 0', ({ value }) => {
    expectInvalidMetrics({
      ...createValidMetrics(),
      serviceUnits: value,
    });
  });

  it.each([
    { name: '负数', value: -1 },
    { name: '负零', value: -0 },
    { name: 'NaN', value: Number.NaN },
    { name: '负无穷', value: Number.NEGATIVE_INFINITY },
  ])('分服务单位为$name时同样拒绝', ({ value }) => {
    const metrics = createValidMetrics();
    metrics.byServiceKey[0]!.serviceUnits = value;
    expectInvalidMetrics(metrics);
  });

  it('保留 serviceUnits 的有限小数与 null 未知语义，不补 0 或重算来源完整性', () => {
    const fractional = createValidMetrics();
    fractional.serviceUnits = 0.6;
    fractional.byServiceKey[0]!.serviceUnits = 0.1;
    fractional.byServiceKey[1]!.serviceUnits = 0.2;
    fractional.byServiceKey[2]!.serviceUnits = 0.3;
    expect(createSnapshot(fractional).ok).toBe(true);

    const unknown = createValidMetrics();
    unknown.serviceUnits = null;
    unknown.byServiceKey[1]!.serviceUnits = null;
    const unknownResult = createSnapshot(unknown);
    expect(unknownResult.ok).toBe(true);
    if (!unknownResult.ok) {
      throw new Error(unknownResult.code);
    }
    expect(unknownResult.snapshot.serviceUnits).toBeNull();
    expect(unknownResult.snapshot.byServiceKey[1]?.serviceUnits).toBeNull();

    const numericTotalWithUnknownItem = createValidMetrics();
    numericTotalWithUnknownItem.byServiceKey[1]!.serviceUnits = null;
    expectInvalidMetrics(numericTotalWithUnknownItem);

    const unknownTotalWithKnownItems = createValidMetrics();
    unknownTotalWithKnownItems.serviceUnits = null;
    expect(createSnapshot(unknownTotalWithKnownItems).ok).toBe(true);

    const overflowedTotal = createValidMetrics();
    overflowedTotal.serviceUnits = null;
    overflowedTotal.byServiceKey[0]!.serviceUnits = Number.MAX_VALUE;
    overflowedTotal.byServiceKey[1]!.serviceUnits = Number.MAX_VALUE;
    overflowedTotal.byServiceKey[2]!.serviceUnits = 0;
    expect(createSnapshot(overflowedTotal).ok).toBe(true);
  });

  it('空分项的内部零摘要只接受 serviceUnits=0', () => {
    const emptyMetrics: DeepMutable<AiUsageMetrics> = {
      totalCallCount: 0,
      serviceUnits: 1,
      failureCount: 0,
      rejectionCount: 0,
      incompleteCount: 0,
      successRate: {
        numerator: 0,
        denominator: 0,
        value: null,
      },
      byServiceKey: [],
    };

    expectInvalidMetrics(emptyMetrics);
  });

  it.each([
    'prompt',
    'answer',
    'completion',
    'model',
    'token',
    'inputTokens',
    'outputTokens',
    'provider',
    'serviceName',
    'price',
    'cost',
    'errorMessage',
    'trend',
    'quota',
    'remaining',
    'successCount',
    'readiness',
    'extra',
  ])('顶层夹带敏感或越界字段 %s 时整包拒绝且不回显', (field) => {
    const sensitiveValue = `sensitive-${field}-value`;
    const metrics = {
      ...createValidMetrics(),
      [field]: sensitiveValue,
    };

    const result = expectInvalidMetrics(metrics);
    expect(JSON.stringify(result)).not.toContain(field);
    expect(JSON.stringify(result)).not.toContain(sensitiveValue);
  });

  it('嵌套对象、分服务项和数组夹带额外字段时同样拒绝', () => {
    const nested = createValidMetrics();
    Object.assign(nested.successRate, { provider: 'sensitive-provider' });
    expectInvalidMetrics(nested);

    const serviceItem = createValidMetrics();
    Object.assign(serviceItem.byServiceKey[0]!, { prompt: 'sensitive-prompt' });
    expectInvalidMetrics(serviceItem);

    const arrayExtra = createValidMetrics();
    Object.defineProperty(arrayExtra.byServiceKey, 'model', {
      value: 'sensitive-model',
      enumerable: false,
    });
    expectInvalidMetrics(arrayExtra);
  });

  it('拒绝 symbol、非枚举额外字段、稀疏数组和 accessor，不执行不受控 getter', () => {
    const symbolExtra = createValidMetrics() as AiUsageMetrics & Record<symbol, unknown>;
    symbolExtra[Symbol('provider')] = 'sensitive-provider';
    expectInvalidMetrics(symbolExtra);

    const hiddenExtra = createValidMetrics();
    Object.defineProperty(hiddenExtra, 'prompt', {
      value: 'sensitive-prompt',
      enumerable: false,
    });
    expectInvalidMetrics(hiddenExtra);

    const sparse = createValidMetrics();
    const sparseItems = new Array<AiUsageMetrics['byServiceKey'][number]>(3);
    sparseItems[0] = sparse.byServiceKey[0]!;
    sparseItems[2] = sparse.byServiceKey[2]!;
    sparse.byServiceKey = sparseItems;
    expectInvalidMetrics(sparse);

    const accessor = createValidMetrics();
    let getterCalls = 0;
    Object.defineProperty(accessor, 'totalCallCount', {
      enumerable: true,
      get() {
        getterCalls += 1;
        throw new Error('sensitive getter error');
      },
    });
    expect(() => createSnapshot(accessor)).not.toThrow();
    expectInvalidMetrics(accessor);
    expect(getterCalls).toBe(0);
  });

  it('递归拒绝嵌套自定义原型、数组子类和 accessor 数组元素', () => {
    const nestedPrototype = createValidMetrics();
    Object.setPrototypeOf(nestedPrototype.successRate, { custom: true });
    expectInvalidMetrics(nestedPrototype);

    const itemPrototype = createValidMetrics();
    Object.setPrototypeOf(itemPrototype.byServiceKey[0]!, { custom: true });
    expectInvalidMetrics(itemPrototype);

    class ServiceSummaryArray extends Array<AiUsageMetrics['byServiceKey'][number]> {}
    const arraySubclass = createValidMetrics();
    arraySubclass.byServiceKey = new ServiceSummaryArray(...arraySubclass.byServiceKey);
    expectInvalidMetrics(arraySubclass);

    const accessorItem = createValidMetrics();
    const firstItem = accessorItem.byServiceKey[0]!;
    let arrayGetterCalls = 0;
    Object.defineProperty(accessorItem.byServiceKey, '0', {
      enumerable: true,
      get() {
        arrayGetterCalls += 1;
        return firstItem;
      },
    });
    expectInvalidMetrics(accessorItem);
    expect(arrayGetterCalls).toBe(0);
  });

  it('异常代理输入和策略也只返回受控错误，不传播原始异常', () => {
    const hostileMetrics = new Proxy(createValidMetrics(), {
      ownKeys() {
        throw new Error('sensitive metrics proxy error');
      },
    });
    const metricsResult = createSnapshot(hostileMetrics);
    expect(metricsResult).toEqual({
      ok: false,
      code: 'invalid_metrics_snapshot',
    });
    expect(JSON.stringify(metricsResult)).not.toContain('sensitive');

    const hostilePolicy = new Proxy([...serviceKeyPolicy], {
      get(target, property, receiver) {
        if (property === Symbol.iterator) {
          throw new Error('sensitive policy proxy error');
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const policyResult = createSnapshot(createValidMetrics(), hostilePolicy);
    expect(policyResult).toEqual({
      ok: false,
      code: 'invalid_service_key_policy',
    });
    expect(JSON.stringify(policyResult)).not.toContain('sensitive');
  });
});
