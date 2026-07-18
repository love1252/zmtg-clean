import { types as nodeTypes } from 'node:util';

import {
  aggregateAiUsageMetrics,
  type AiUsageMetrics,
  type InstitutionAiUsageScope,
} from '@/modules/institution-system/domain/ai-usage-metrics';
import {
  createAiUsageOutcomeClassifier,
  type AiUsageTerminalStatusPolicy,
} from '@/modules/institution-system/domain/ai-usage-outcomes';
import { createAiUsageMetricsSnapshot } from '@/modules/institution-system/domain/ai-usage-metrics-snapshot';
import {
  createAiUsageServiceKeyPolicySnapshot,
  type AiUsageServiceKeyPolicy,
} from '@/modules/institution-system/domain/ai-usage-service-keys';
import {
  createAiUsageTimeWindowSnapshot,
  type AiUsageTimeWindow,
} from '@/modules/institution-system/domain/ai-usage-time-window';

export const INSTITUTION_AI_USAGE_METRICS_MAX_RECORDS = 10_000;

export type InstitutionAiUsageMetricsRecordSource = Readonly<{
  listInstitutionUsageMetricRecords(input: Readonly<{
    tenantId: string;
    institutionId: string;
    startInclusiveEpochMs: number;
    endExclusiveEpochMs: number;
  }>): Promise<readonly Readonly<{
    tenantId: string;
    institutionId: string | null;
    status: string | null;
    serviceCategory: string | null;
    serviceAction: string | null;
    createdAt: Date;
  }>[]>;
}>;

export type InstitutionAiUsageServiceKeyMapping = Readonly<{
  serviceCategory: string;
  serviceAction: string;
  serviceKey: string;
}>;

type InstitutionAiUsageMetricsReadFailureCode =
  | 'source_unavailable'
  | 'too_many_records'
  | 'invalid_input'
  | 'invalid_service_key'
  | 'invalid_scope'
  | 'invalid_terminal_status_policy'
  | 'invalid_service_key_policy'
  | 'invalid_metrics_snapshot'
  | 'invalid_time_window'
  | 'scope_mismatch'
  | 'invalid_occurred_at'
  | 'record_outside_time_window';

export type InstitutionAiUsageMetricsReadResult =
  | Readonly<{ ok: true; metrics: AiUsageMetrics }>
  | Readonly<{ ok: false; code: InstitutionAiUsageMetricsReadFailureCode }>;

type ExactPlainSnapshot = Readonly<Record<string, unknown>>;

type ReaderInputSnapshot = Readonly<{
  scope: InstitutionAiUsageScope;
  terminalStatusPolicy: AiUsageTerminalStatusPolicy;
  serviceKeyMappings: readonly InstitutionAiUsageServiceKeyMapping[];
  timeWindow: AiUsageTimeWindow;
}>;

type UsageRecordSnapshot = Readonly<{
  tenantId: string;
  institutionId: string | null;
  status: string | null;
  serviceCategory: string | null;
  serviceAction: string | null;
  occurredAtEpochMs: number;
}>;

const readerInputKeys = [
  'scope',
  'terminalStatusPolicy',
  'serviceKeyMappings',
  'timeWindow',
] as const;
const scopeKeys = ['tenantId', 'institutionId'] as const;
const timeWindowKeys = ['startInclusiveEpochMs', 'endExclusiveEpochMs'] as const;
const serviceKeyMappingKeys = ['serviceCategory', 'serviceAction', 'serviceKey'] as const;
const usageRecordKeys = [
  'tenantId',
  'institutionId',
  'status',
  'serviceCategory',
  'serviceAction',
  'createdAt',
] as const;
const tooManySourceRows = Symbol('too_many_source_rows');

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & Readonly<{ value: unknown }> {
  return isDataDescriptor(descriptor)
    && descriptor.enumerable === true;
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & Readonly<{ value: unknown }> {
  return descriptor !== undefined
    && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    && !Object.prototype.hasOwnProperty.call(descriptor, 'get')
    && !Object.prototype.hasOwnProperty.call(descriptor, 'set');
}

function snapshotExactPlainObject(
  value: unknown,
  expectedKeys?: readonly string[],
): ExactPlainSnapshot | null {
  try {
    if (
      value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || nodeTypes.isProxy(value)
      || Object.getPrototypeOf(value) !== Object.prototype
    ) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const ownKeys = Reflect.ownKeys(descriptors);
    if (ownKeys.some(key => typeof key !== 'string')) return null;
    if (
      expectedKeys !== undefined
      && (ownKeys.length !== expectedKeys.length
        || expectedKeys.some(key => !Object.prototype.hasOwnProperty.call(descriptors, key)))
    ) return null;

    const snapshot: Record<string, unknown> = {};
    for (const key of ownKeys) {
      const descriptor = descriptors[key as string];
      if (!isEnumerableDataDescriptor(descriptor)) return null;
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

function snapshotExactDenseArray(
  value: unknown,
  maximumLength?: number,
): readonly unknown[] | typeof tooManySourceRows | null {
  try {
    if (
      !Array.isArray(value)
      || nodeTypes.isProxy(value)
      || Object.getPrototypeOf(value) !== Array.prototype
    ) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const lengthDescriptor = descriptors.length;
    if (
      !isDataDescriptor(lengthDescriptor)
      || typeof lengthDescriptor?.value !== 'number'
      || !Number.isSafeInteger(lengthDescriptor.value)
      || lengthDescriptor.value < 0
    ) return null;

    const length = lengthDescriptor.value;
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.some(key => typeof key !== 'string')
      || ownKeys.length !== length + 1
      || !Object.prototype.hasOwnProperty.call(descriptors, 'length')
    ) return null;
    if (maximumLength !== undefined && length > maximumLength) return tooManySourceRows;

    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!isEnumerableDataDescriptor(descriptor)) return null;
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function isNonEmptyUnpaddedString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function snapshotScope(value: unknown): InstitutionAiUsageScope | null {
  const raw = snapshotExactPlainObject(value, scopeKeys);
  if (
    !raw
    || !isNonEmptyUnpaddedString(raw.tenantId)
    || !isNonEmptyUnpaddedString(raw.institutionId)
  ) return null;
  return Object.freeze({ tenantId: raw.tenantId, institutionId: raw.institutionId });
}

function snapshotTerminalStatusPolicy(value: unknown): AiUsageTerminalStatusPolicy | null {
  const raw = snapshotExactPlainObject(value);
  if (!raw || Reflect.ownKeys(raw).some(key => typeof key !== 'string')) return null;

  const snapshot: Record<string, string> = {};
  for (const [status, outcome] of Object.entries(raw)) {
    if (typeof outcome !== 'string') return null;
    Object.defineProperty(snapshot, status, {
      configurable: false,
      enumerable: true,
      value: outcome,
      writable: false,
    });
  }
  return Object.freeze(snapshot) as AiUsageTerminalStatusPolicy;
}

function snapshotTimeWindow(value: unknown): AiUsageTimeWindow | null {
  const raw = snapshotExactPlainObject(value, timeWindowKeys);
  if (
    !raw
    || typeof raw.startInclusiveEpochMs !== 'number'
    || typeof raw.endExclusiveEpochMs !== 'number'
    || !Number.isSafeInteger(raw.startInclusiveEpochMs)
    || !Number.isSafeInteger(raw.endExclusiveEpochMs)
  ) return null;
  return Object.freeze({
    startInclusiveEpochMs: raw.startInclusiveEpochMs,
    endExclusiveEpochMs: raw.endExclusiveEpochMs,
  });
}

function snapshotServiceKeyMappings(
  value: unknown,
): readonly InstitutionAiUsageServiceKeyMapping[] | null {
  const raw = snapshotExactDenseArray(value);
  if (!raw || raw === tooManySourceRows) return null;

  const snapshot: InstitutionAiUsageServiceKeyMapping[] = [];
  for (const item of raw) {
    const mapping = snapshotExactPlainObject(item, serviceKeyMappingKeys);
    if (
      !mapping
      || typeof mapping.serviceCategory !== 'string'
      || mapping.serviceCategory.length === 0
      || typeof mapping.serviceAction !== 'string'
      || mapping.serviceAction.length === 0
      || typeof mapping.serviceKey !== 'string'
      || mapping.serviceKey.length === 0
    ) return null;
    snapshot.push(Object.freeze({
      serviceCategory: mapping.serviceCategory,
      serviceAction: mapping.serviceAction,
      serviceKey: mapping.serviceKey,
    }));
  }
  return Object.freeze(snapshot);
}

function snapshotReaderInput(value: unknown): ReaderInputSnapshot | null {
  const raw = snapshotExactPlainObject(value, readerInputKeys);
  if (!raw) return null;

  const scope = snapshotScope(raw.scope);
  const terminalStatusPolicy = snapshotTerminalStatusPolicy(raw.terminalStatusPolicy);
  const serviceKeyMappings = snapshotServiceKeyMappings(raw.serviceKeyMappings);
  const timeWindow = snapshotTimeWindow(raw.timeWindow);
  if (!scope || !terminalStatusPolicy || !serviceKeyMappings || !timeWindow) return null;

  return Object.freeze({ scope, terminalStatusPolicy, serviceKeyMappings, timeWindow });
}

function snapshotOccurredAtEpochMs(value: unknown): number | null {
  try {
    if (
      value === null
      || typeof value !== 'object'
      || nodeTypes.isProxy(value)
      || Object.getPrototypeOf(value) !== Date.prototype
    ) return null;
    const epochMs = Date.prototype.getTime.call(value);
    return Number.isSafeInteger(epochMs) ? epochMs : null;
  } catch {
    return null;
  }
}

function snapshotSourceRows(
  value: unknown,
): readonly UsageRecordSnapshot[] | typeof tooManySourceRows | null {
  const rawRows = snapshotExactDenseArray(
    value,
    INSTITUTION_AI_USAGE_METRICS_MAX_RECORDS + 1,
  );
  if (rawRows === tooManySourceRows) return tooManySourceRows;
  if (!rawRows) return null;

  const snapshot: UsageRecordSnapshot[] = [];
  for (const item of rawRows) {
    const row = snapshotExactPlainObject(item, usageRecordKeys);
    if (
      !row
      || typeof row.tenantId !== 'string'
      || (row.institutionId !== null && typeof row.institutionId !== 'string')
      || (row.status !== null && typeof row.status !== 'string')
      || (row.serviceCategory !== null && typeof row.serviceCategory !== 'string')
      || (row.serviceAction !== null && typeof row.serviceAction !== 'string')
    ) return null;
    const occurredAtEpochMs = snapshotOccurredAtEpochMs(row.createdAt);
    if (occurredAtEpochMs === null) return null;
    snapshot.push(Object.freeze({
      tenantId: row.tenantId,
      institutionId: row.institutionId,
      status: row.status,
      serviceCategory: row.serviceCategory,
      serviceAction: row.serviceAction,
      occurredAtEpochMs,
    }));
  }
  return snapshot.length > INSTITUTION_AI_USAGE_METRICS_MAX_RECORDS
    ? tooManySourceRows
    : Object.freeze(snapshot);
}

function createServiceKeyResolver(mappings: readonly InstitutionAiUsageServiceKeyMapping[]): Readonly<{
  resolve: (serviceCategory: string | null, serviceAction: string | null) => string | null;
  serviceKeyPolicy: readonly string[];
}> | null {
  const mapping = new Map<string, string>();
  const serviceKeyPolicy: string[] = [];
  for (const item of mappings) {
    const key = `${item.serviceCategory}\u0000${item.serviceAction}`;
    if (mapping.has(key)) return null;
    mapping.set(key, item.serviceKey);
    serviceKeyPolicy.push(item.serviceKey);
  }
  return Object.freeze({
    resolve: (serviceCategory, serviceAction) => (
      typeof serviceCategory === 'string' && typeof serviceAction === 'string'
        ? mapping.get(`${serviceCategory}\u0000${serviceAction}`) ?? null
        : null
    ),
    serviceKeyPolicy: Object.freeze(serviceKeyPolicy),
  });
}

function failure(code: InstitutionAiUsageMetricsReadFailureCode): InstitutionAiUsageMetricsReadResult {
  return Object.freeze({ ok: false, code });
}

function success(metrics: AiUsageMetrics): InstitutionAiUsageMetricsReadResult {
  return Object.freeze({ ok: true, metrics });
}

export function createInstitutionAiUsageMetricsReader(
  source: InstitutionAiUsageMetricsRecordSource,
) {
  return Object.freeze({
    async read(input: Readonly<{
      scope: InstitutionAiUsageScope;
      terminalStatusPolicy: AiUsageTerminalStatusPolicy;
      serviceKeyMappings: readonly InstitutionAiUsageServiceKeyMapping[];
      timeWindow: AiUsageTimeWindow;
    }>): Promise<InstitutionAiUsageMetricsReadResult> {
      try {
        const inputSnapshot = snapshotReaderInput(input);
        if (!inputSnapshot) return failure('invalid_input');

        const terminalStatus = createAiUsageOutcomeClassifier(inputSnapshot.terminalStatusPolicy);
        if (!terminalStatus.ok) return failure(terminalStatus.code);
        const timeWindow = createAiUsageTimeWindowSnapshot(inputSnapshot.timeWindow);
        if (!timeWindow.ok) return failure(timeWindow.code);
        const serviceKeyResolver = createServiceKeyResolver(inputSnapshot.serviceKeyMappings);
        if (!serviceKeyResolver) return failure('invalid_service_key');
        const serviceKeyPolicy = createAiUsageServiceKeyPolicySnapshot(
          serviceKeyResolver.serviceKeyPolicy,
        );
        if (!serviceKeyPolicy.ok) return failure(serviceKeyPolicy.code);

        let sourceRows: unknown;
        try {
          sourceRows = await source.listInstitutionUsageMetricRecords(Object.freeze({
            tenantId: inputSnapshot.scope.tenantId,
            institutionId: inputSnapshot.scope.institutionId,
            startInclusiveEpochMs: inputSnapshot.timeWindow.startInclusiveEpochMs,
            endExclusiveEpochMs: inputSnapshot.timeWindow.endExclusiveEpochMs,
          }));
        } catch {
          return failure('source_unavailable');
        }
        const rows = snapshotSourceRows(sourceRows);
        if (rows === tooManySourceRows) return failure('too_many_records');
        if (!rows) return failure('source_unavailable');

        const records = [] as Array<{
          tenantId: string;
          institutionId: string | null;
          status: string | null;
          serviceKey: string | null;
          occurredAtEpochMs: number | null;
        }>;
        for (const row of rows) {
          const serviceKey = serviceKeyResolver.resolve(row.serviceCategory, row.serviceAction);
          if (!serviceKey) return failure('invalid_service_key');
          records.push(Object.freeze({
            tenantId: row.tenantId,
            institutionId: row.institutionId,
            status: row.status,
            serviceKey,
            occurredAtEpochMs: row.occurredAtEpochMs,
          }));
        }

        const result = aggregateAiUsageMetrics({
          scope: inputSnapshot.scope,
          records: Object.freeze(records),
          terminalStatusPolicy: inputSnapshot.terminalStatusPolicy,
          serviceKeyPolicy: serviceKeyResolver.serviceKeyPolicy as AiUsageServiceKeyPolicy,
          timeWindow: inputSnapshot.timeWindow,
        });
        if (!result.ok) return failure(result.code);

        const metricsSnapshot = createAiUsageMetricsSnapshot({
          metrics: result.metrics,
          serviceKeyPolicy: serviceKeyResolver.serviceKeyPolicy as AiUsageServiceKeyPolicy,
        });
        return metricsSnapshot.ok
          ? success(metricsSnapshot.snapshot)
          : failure(metricsSnapshot.code);
      } catch {
        return failure('source_unavailable');
      }
    },
  });
}
