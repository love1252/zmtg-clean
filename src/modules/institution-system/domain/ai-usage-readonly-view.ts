import { isProxy } from 'node:util/types';

import {
  createAiUsageMetricsSnapshot,
} from '@/modules/institution-system/domain/ai-usage-metrics-snapshot';
import type { AiUsageMetrics } from '@/modules/institution-system/domain/ai-usage-metrics';

type ExactRecord = Readonly<Record<string, unknown>>;

const viewReadyKeys = ['kind', 'metrics'] as const;
const viewStatusKeys = ['kind'] as const;
const metricsKeys = [
  'totalCallCount',
  'serviceUnits',
  'failureCount',
  'rejectionCount',
  'incompleteCount',
  'successRate',
  'byServiceKey',
] as const;
const serviceSummaryKeys = [
  'serviceKey',
  'totalCallCount',
  'serviceUnits',
  'failureCount',
  'rejectionCount',
  'incompleteCount',
  'successRate',
] as const;

export type InstitutionAiUsageReadonlyViewModel =
  | Readonly<{
      kind: 'ready';
      summary: Readonly<{
        totalCallCount: string;
        successRate: string;
        failureCount: string;
        rejectionCount: string;
        incompleteCount: string;
      }>;
      byServiceKey: readonly Readonly<{
        serviceKey: string;
        totalCallCount: string;
        successRate: string;
        failureCount: string;
        rejectionCount: string;
        incompleteCount: string;
      }>[];
    }>
  | Readonly<{ kind: 'no_data' | 'partial' | 'too_many' | 'unavailable' }>;

function snapshotExactRecord(value: unknown, expectedKeys: readonly string[]): ExactRecord | null {
  try {
    if (
      value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || isProxy(value)
      || Object.getPrototypeOf(value) !== Object.prototype
    ) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.length !== expectedKeys.length
      || ownKeys.some(key => typeof key !== 'string')
      || expectedKeys.some(key => !Object.prototype.hasOwnProperty.call(descriptors, key))
    ) return null;

    const snapshot: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (
        !descriptor
        || !descriptor.enumerable
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
        || Object.prototype.hasOwnProperty.call(descriptor, 'get')
        || Object.prototype.hasOwnProperty.call(descriptor, 'set')
      ) return null;
      Object.defineProperty(snapshot, key, {
        configurable: false,
        enumerable: true,
        value: descriptor.value,
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotDenseArray(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const lengthDescriptor = descriptors.length;
    if (
      !lengthDescriptor
      || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')
      || typeof lengthDescriptor.value !== 'number'
      || !Number.isSafeInteger(lengthDescriptor.value)
      || lengthDescriptor.value < 0
    ) return null;

    const expectedKeys = [
      ...Array.from({ length: lengthDescriptor.value }, (_, index) => String(index)),
      'length',
    ];
    if (
      Reflect.ownKeys(descriptors).length !== expectedKeys.length
      || expectedKeys.some(key => !Object.prototype.hasOwnProperty.call(descriptors, key))
    ) return null;

    const snapshot: unknown[] = [];
    for (let index = 0; index < lengthDescriptor.value; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        return null;
      }
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function captureServiceKeyPolicy(metricsValue: unknown): readonly string[] | null {
  const metrics = snapshotExactRecord(metricsValue, metricsKeys);
  if (!metrics) return null;
  const summaries = snapshotDenseArray(metrics.byServiceKey);
  if (!summaries || summaries.length === 0) return null;

  const serviceKeys: string[] = [];
  for (const summaryValue of summaries) {
    const summary = snapshotExactRecord(summaryValue, serviceSummaryKeys);
    if (!summary || typeof summary.serviceKey !== 'string') return null;
    serviceKeys.push(summary.serviceKey);
  }
  return Object.freeze(serviceKeys);
}

function formatInteger(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0, useGrouping: true });
}

function formatSuccessRate(value: Readonly<{
  denominator: number;
  value: number | null;
}>): string {
  if (value.denominator === 0 || value.value === null) return '不可计算';
  return `${(value.value * 100).toFixed(1)}%`;
}

function readyModel(metrics: AiUsageMetrics): InstitutionAiUsageReadonlyViewModel {
  const byServiceKey = metrics.byServiceKey.map((summary) => Object.freeze({
    serviceKey: summary.serviceKey,
    totalCallCount: formatInteger(summary.totalCallCount),
    successRate: formatSuccessRate(summary.successRate),
    failureCount: formatInteger(summary.failureCount),
    rejectionCount: formatInteger(summary.rejectionCount),
    incompleteCount: formatInteger(summary.incompleteCount),
  }));

  return Object.freeze({
    kind: 'ready',
    summary: Object.freeze({
      totalCallCount: formatInteger(metrics.totalCallCount),
      successRate: formatSuccessRate(metrics.successRate),
      failureCount: formatInteger(metrics.failureCount),
      rejectionCount: formatInteger(metrics.rejectionCount),
      incompleteCount: formatInteger(metrics.incompleteCount),
    }),
    byServiceKey: Object.freeze(byServiceKey),
  });
}

function statusModel(kind: 'no_data' | 'partial' | 'too_many' | 'unavailable') {
  return Object.freeze({ kind });
}

/**
 * Presentation-only boundary. A future guard-protected server composition must provide one of
 * these five states; this mapper neither reads scope nor turns absent/partial data into zeros.
 */
export function createInstitutionAiUsageReadonlyViewModel(
  value: unknown,
): InstitutionAiUsageReadonlyViewModel {
  try {
    const ready = snapshotExactRecord(value, viewReadyKeys);
    if (ready && ready.kind === 'ready') {
      const serviceKeyPolicy = captureServiceKeyPolicy(ready.metrics);
      if (!serviceKeyPolicy) return statusModel('unavailable');
      const snapshot = createAiUsageMetricsSnapshot({
        metrics: ready.metrics as AiUsageMetrics,
        serviceKeyPolicy,
      });
      return snapshot.ok ? readyModel(snapshot.snapshot) : statusModel('unavailable');
    }

    const status = snapshotExactRecord(value, viewStatusKeys);
    if (
      status
      && (status.kind === 'no_data'
        || status.kind === 'partial'
        || status.kind === 'too_many'
        || status.kind === 'unavailable')
    ) return statusModel(status.kind);
  } catch {
    // Fall through to the only safe presentation state.
  }
  return statusModel('unavailable');
}
