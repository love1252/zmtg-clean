import {
  createAiUsageOutcomeClassifier,
  type AiUsageOutcome,
  type AiUsageTerminalStatusPolicy,
} from '@/modules/institution-system/domain/ai-usage-outcomes';
import {
  createAiUsageServiceKeyPolicySnapshot,
  type AiUsageServiceKeyPolicy,
} from '@/modules/institution-system/domain/ai-usage-service-keys';
import {
  createAiUsageTimeWindowSnapshot,
  type AiUsageTimeWindow,
} from '@/modules/institution-system/domain/ai-usage-time-window';

export type InstitutionAiUsageScope = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

export type AiUsageMetricRecord = Readonly<{
  tenantId: string;
  institutionId: string | null;
  status: string | null;
  serviceKey: string | null;
  occurredAtEpochMs: number | null;
  serviceUnits?: number | null;
}>;

export type AiUsageSuccessRate = Readonly<{
  numerator: number;
  denominator: number;
  value: number | null;
}>;

export type AiUsageLowSensitivitySummary = Readonly<{
  totalCallCount: number;
  serviceUnits: number | null;
  failureCount: number;
  rejectionCount: number;
  incompleteCount: number;
  successRate: AiUsageSuccessRate;
}>;

export type AiUsageServiceKeySummary = AiUsageLowSensitivitySummary & Readonly<{
  serviceKey: string;
}>;

export type AiUsageMetrics = AiUsageLowSensitivitySummary & Readonly<{
  byServiceKey: readonly AiUsageServiceKeySummary[];
}>;

export type AiUsageMetricsAggregationResult =
  | Readonly<{
      ok: true;
      metrics: AiUsageMetrics;
    }>
  | Readonly<{
      ok: false;
      code:
        | 'invalid_scope'
        | 'invalid_terminal_status_policy'
        | 'invalid_service_key_policy'
        | 'invalid_time_window';
    }>
  | Readonly<{
      ok: false;
      code:
        | 'scope_mismatch'
        | 'invalid_service_key'
        | 'invalid_occurred_at'
        | 'record_outside_time_window';
      recordIndex: number;
    }>;

type MutableSummary = {
  totalCallCount: number;
  serviceUnits: number;
  serviceUnitsAvailable: boolean;
  successCount: number;
  failureCount: number;
  rejectionCount: number;
  incompleteCount: number;
};

function createMutableSummary(): MutableSummary {
  return {
    totalCallCount: 0,
    serviceUnits: 0,
    serviceUnitsAvailable: true,
    successCount: 0,
    failureCount: 0,
    rejectionCount: 0,
    incompleteCount: 0,
  };
}

function isValidScopeValue(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isUsableServiceUnits(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function addServiceUnits(summary: MutableSummary, serviceUnits: unknown): void {
  if (!summary.serviceUnitsAvailable) {
    return;
  }

  if (!isUsableServiceUnits(serviceUnits)) {
    summary.serviceUnitsAvailable = false;
    return;
  }

  const nextServiceUnits = summary.serviceUnits + serviceUnits;
  if (!Number.isFinite(nextServiceUnits)) {
    summary.serviceUnitsAvailable = false;
    return;
  }

  summary.serviceUnits = nextServiceUnits;
}

function addOutcome(summary: MutableSummary, outcome: AiUsageOutcome): void {
  summary.totalCallCount += 1;

  switch (outcome) {
    case 'success':
      summary.successCount += 1;
      break;
    case 'failure':
      summary.failureCount += 1;
      break;
    case 'rejection':
      summary.rejectionCount += 1;
      break;
    case 'incomplete':
      summary.incompleteCount += 1;
      break;
  }
}

function toLowSensitivitySummary(summary: MutableSummary): AiUsageLowSensitivitySummary {
  const denominator = summary.successCount + summary.failureCount + summary.rejectionCount;

  return {
    totalCallCount: summary.totalCallCount,
    serviceUnits: summary.serviceUnitsAvailable ? summary.serviceUnits : null,
    failureCount: summary.failureCount,
    rejectionCount: summary.rejectionCount,
    incompleteCount: summary.incompleteCount,
    successRate: {
      numerator: summary.successCount,
      denominator,
      value: denominator === 0 ? null : summary.successCount / denominator,
    },
  };
}

function compareServiceKeys(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

export function aggregateAiUsageMetrics(input: Readonly<{
  scope: InstitutionAiUsageScope;
  records: readonly AiUsageMetricRecord[];
  terminalStatusPolicy: AiUsageTerminalStatusPolicy;
  serviceKeyPolicy: AiUsageServiceKeyPolicy;
  timeWindow: AiUsageTimeWindow;
}>): AiUsageMetricsAggregationResult {
  if (
    !isValidScopeValue(input.scope.tenantId)
    || !isValidScopeValue(input.scope.institutionId)
  ) {
    return { ok: false, code: 'invalid_scope' };
  }

  const classifierResult = createAiUsageOutcomeClassifier(input.terminalStatusPolicy);
  if (!classifierResult.ok) {
    return { ok: false, code: classifierResult.code };
  }

  const serviceKeyPolicyResult = createAiUsageServiceKeyPolicySnapshot(input.serviceKeyPolicy);
  if (!serviceKeyPolicyResult.ok) {
    return { ok: false, code: serviceKeyPolicyResult.code };
  }

  const timeWindowResult = createAiUsageTimeWindowSnapshot(input.timeWindow);
  if (!timeWindowResult.ok) {
    return { ok: false, code: timeWindowResult.code };
  }

  for (const [recordIndex, record] of input.records.entries()) {
    if (
      record.tenantId !== input.scope.tenantId
      || record.institutionId !== input.scope.institutionId
    ) {
      return { ok: false, code: 'scope_mismatch', recordIndex };
    }
  }

  const validatedRecords: Array<Readonly<{
    record: AiUsageMetricRecord;
    serviceKey: string;
  }>> = [];

  for (const [recordIndex, record] of input.records.entries()) {
    const serviceKey = record.serviceKey;
    if (!serviceKeyPolicyResult.isAllowed(serviceKey)) {
      return { ok: false, code: 'invalid_service_key', recordIndex };
    }

    validatedRecords.push({ record, serviceKey });
  }

  const timeWindowPositions = validatedRecords.map(({ record }) => (
    timeWindowResult.classify(record.occurredAtEpochMs)
  ));
  const invalidOccurredAtIndex = timeWindowPositions.indexOf('invalid');
  if (invalidOccurredAtIndex >= 0) {
    return {
      ok: false,
      code: 'invalid_occurred_at',
      recordIndex: invalidOccurredAtIndex,
    };
  }

  const outsideTimeWindowIndex = timeWindowPositions.indexOf('outside');
  if (outsideTimeWindowIndex >= 0) {
    return {
      ok: false,
      code: 'record_outside_time_window',
      recordIndex: outsideTimeWindowIndex,
    };
  }

  const total = createMutableSummary();
  const summariesByServiceKey = new Map<string, MutableSummary>();

  for (const { record, serviceKey } of validatedRecords) {
    const outcome = classifierResult.classify(record.status);
    const serviceSummary = summariesByServiceKey.get(serviceKey)
      ?? createMutableSummary();

    addOutcome(total, outcome);
    addServiceUnits(total, record.serviceUnits);
    addOutcome(serviceSummary, outcome);
    addServiceUnits(serviceSummary, record.serviceUnits);
    summariesByServiceKey.set(serviceKey, serviceSummary);
  }

  const byServiceKey = [...summariesByServiceKey.entries()]
    .sort(([leftServiceKey], [rightServiceKey]) => (
      compareServiceKeys(leftServiceKey, rightServiceKey)
    ))
    .map(([serviceKey, summary]): AiUsageServiceKeySummary => ({
      serviceKey,
      ...toLowSensitivitySummary(summary),
    }));

  return {
    ok: true,
    metrics: {
      ...toLowSensitivitySummary(total),
      byServiceKey,
    },
  };
}
