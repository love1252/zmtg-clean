import {
  isInstitutionSourceFailureCodeV1,
  isInstitutionSourcePartitionReadinessV1,
  type InstitutionSourceFailureCodeV1,
  type InstitutionSourceFreshnessV1,
  type InstitutionSourcePartitionReadinessV1,
} from '@/modules/institution-contracts/v1/institution-source';
import type {
  CapabilityStatusItemV1,
  CapabilityStatusV1,
} from '@/modules/institution-contracts/v1/institution-capability';
import {
  INSTITUTION_CAPABILITY_REGISTRY_V1,
  isInstitutionCapabilityKeyV1,
  isInstitutionDiagnosticTargetCapabilityKeyV1,
  type InstitutionCapabilityKeyV1,
  type InstitutionDiagnosticTargetCapabilityKeyV1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import {
  deriveInstitutionCapabilityDecisionV1,
  evaluateInstitutionCapabilityStatusV1,
  type InstitutionCapabilityEvaluationInputV1,
} from '@/modules/institution/server/institution-capability-status-evaluator';
import {
  hasExactSnapshotKeys,
  snapshotExactDataRecord,
  snapshotStrictArray,
  snapshotStrictDataRecord,
  type StrictDataRecordSnapshot,
} from '@/modules/institution/server/strict-input-snapshot';

const SAFE_SCOPE_SENTINEL = 'scope_unavailable';
const SCOPE_KEYS = Object.freeze(['tenantId', 'institutionId'] as const);
const PROVIDER_INPUT_KEYS = Object.freeze(['scope', 'partitions', 'evaluations'] as const);
const PARTITION_INPUT_KEYS = Object.freeze([
  'key',
  'readiness',
  'freshness',
  'failureCode',
] as const);
const FRESHNESS_KEYS = Object.freeze(['observedAt', 'freshUntil'] as const);
const READ_INPUT_KEYS = Object.freeze([
  'expectedScope',
  'provider',
  'reachableDiagnosticTargetKeys',
] as const);
const capabilityDisplayOrder = new Map<InstitutionCapabilityKeyV1, number>(
  INSTITUTION_CAPABILITY_REGISTRY_V1.map((definition, index) => [definition.key, index]),
);

export type InstitutionCapabilityStatusScopeV1 = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

export type InstitutionCapabilityStatusProviderPartitionInputV1 = Readonly<{
  key: InstitutionCapabilityKeyV1;
  readiness: InstitutionSourcePartitionReadinessV1;
  freshness: InstitutionSourceFreshnessV1 | null;
  failureCode: InstitutionSourceFailureCodeV1 | null;
}>;

export type InstitutionCapabilityStatusProviderInputV1 = Readonly<{
  scope: InstitutionCapabilityStatusScopeV1;
  partitions: readonly InstitutionCapabilityStatusProviderPartitionInputV1[];
  evaluations: readonly InstitutionCapabilityEvaluationInputV1[];
}>;

export type InstitutionCapabilityStatusReadInputV1 = Readonly<{
  expectedScope: InstitutionCapabilityStatusScopeV1;
  provider: InstitutionCapabilityStatusProviderInputV1;
  /** Server-authorized diagnostic pages reachable by the current AccessContext. */
  reachableDiagnosticTargetKeys: readonly InstitutionDiagnosticTargetCapabilityKeyV1[];
}>;

type ParsedPartition = InstitutionCapabilityStatusProviderPartitionInputV1;

function isSafeScopeId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  );
}

function normalizeScopeId(value: unknown): { valid: boolean; value: string } {
  if (isSafeScopeId(value)) return { valid: true, value };
  return { valid: false, value: SAFE_SCOPE_SENTINEL };
}

function safeExpectedScope(value: unknown): {
  valid: boolean;
  scope: InstitutionCapabilityStatusScopeV1;
} {
  let tenantId: unknown;
  let institutionId: unknown;
  let exactShape = false;

  try {
    const snapshot = snapshotStrictDataRecord(value);
    if (snapshot) {
      exactShape = hasExactSnapshotKeys(snapshot, SCOPE_KEYS);
      tenantId = snapshot.tenantId;
      institutionId = snapshot.institutionId;
    }
  } catch {
    exactShape = false;
  }

  const safeTenantId = normalizeScopeId(tenantId);
  const safeInstitutionId = normalizeScopeId(institutionId);
  return {
    valid: exactShape && safeTenantId.valid && safeInstitutionId.valid,
    scope: Object.freeze({
      tenantId: safeTenantId.value,
      institutionId: safeInstitutionId.value,
    }),
  };
}

function parseSourceScope(value: unknown): InstitutionCapabilityStatusScopeV1 | null {
  const snapshot = snapshotExactDataRecord(value, SCOPE_KEYS);
  if (!snapshot) return null;
  if (!isSafeScopeId(snapshot.tenantId) || !isSafeScopeId(snapshot.institutionId)) {
    return null;
  }
  return Object.freeze({
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
  });
}

function parseCanonicalInstant(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString() === value ? value : null;
}

function parseFreshness(value: unknown): InstitutionSourceFreshnessV1 | null {
  const snapshot = snapshotExactDataRecord(value, FRESHNESS_KEYS);
  if (!snapshot) return null;
  const observedAt = parseCanonicalInstant(snapshot.observedAt);
  const freshUntil = parseCanonicalInstant(snapshot.freshUntil);
  if (!observedAt || !freshUntil || Date.parse(observedAt) > Date.parse(freshUntil)) {
    return null;
  }
  return Object.freeze({ observedAt, freshUntil });
}

function isValidPartitionCrossFields(partition: ParsedPartition) {
  if (
    partition.readiness === 'ready' ||
    partition.readiness === 'empty'
  ) {
    return partition.freshness !== null && partition.failureCode === null;
  }
  if (partition.readiness === 'stale') {
    return partition.freshness !== null && partition.failureCode === 'data_incomplete';
  }
  if (partition.readiness === 'denied') {
    return (
      partition.freshness === null &&
      (partition.failureCode === 'permission_denied' ||
        partition.failureCode === 'scope_mismatch')
    );
  }
  if (partition.readiness === 'disabled') {
    return partition.freshness === null && partition.failureCode === 'not_released';
  }
  return (
    partition.freshness === null &&
    (partition.failureCode === 'upstream_unavailable' ||
      partition.failureCode === 'timeout' ||
      partition.failureCode === 'invalid_payload' ||
      partition.failureCode === 'data_incomplete')
  );
}

function parsePartition(value: unknown): ParsedPartition | null {
  const snapshot = snapshotExactDataRecord(value, PARTITION_INPUT_KEYS);
  if (!snapshot) return null;
  if (!isInstitutionCapabilityKeyV1(snapshot.key)) return null;
  if (!isInstitutionSourcePartitionReadinessV1(snapshot.readiness)) return null;
  if (
    snapshot.failureCode !== null &&
    !isInstitutionSourceFailureCodeV1(snapshot.failureCode)
  ) {
    return null;
  }

  const freshness =
    snapshot.freshness === null ? null : parseFreshness(snapshot.freshness);
  if (snapshot.freshness !== null && freshness === null) return null;

  const partition = Object.freeze({
    key: snapshot.key,
    readiness: snapshot.readiness,
    freshness,
    failureCode: snapshot.failureCode,
  }) satisfies ParsedPartition;
  return isValidPartitionCrossFields(partition) ? partition : null;
}

function isDataBearingPartition(readiness: InstitutionSourcePartitionReadinessV1) {
  return readiness === 'ready' || readiness === 'empty' || readiness === 'stale';
}

function deriveTopLevelReadiness(partitions: readonly ParsedPartition[]) {
  const readinessValues = new Set(partitions.map((partition) => partition.readiness));
  const dataBearingCount = partitions.filter((partition) =>
    isDataBearingPartition(partition.readiness),
  ).length;

  if (dataBearingCount > 0 && dataBearingCount < partitions.length) return 'partial' as const;
  if (dataBearingCount === partitions.length) {
    if (readinessValues.size === 1 && readinessValues.has('empty')) return 'empty' as const;
    if (readinessValues.size === 1 && readinessValues.has('stale')) return 'stale' as const;
    if (readinessValues.has('stale')) return 'partial' as const;
    return 'ready' as const;
  }
  if (readinessValues.has('denied')) return 'denied' as const;
  if (readinessValues.has('unavailable')) return 'unavailable' as const;
  return 'disabled' as const;
}

const failurePriority = Object.freeze([
  'scope_mismatch',
  'permission_denied',
  'invalid_payload',
  'upstream_unavailable',
  'timeout',
  'not_released',
  'data_incomplete',
] as const satisfies readonly InstitutionSourceFailureCodeV1[]);

function deriveTopLevelFailureCode(
  readiness: CapabilityStatusV1['readiness'],
  partitions: readonly ParsedPartition[],
): InstitutionSourceFailureCodeV1 | null {
  if (readiness === 'ready' || readiness === 'empty') return null;
  if (readiness === 'stale') return 'data_incomplete';

  for (const failureCode of failurePriority) {
    if (partitions.some((partition) => partition.failureCode === failureCode)) {
      return failureCode;
    }
  }
  return 'invalid_payload';
}

function aggregateFreshness(
  partitions: readonly ParsedPartition[],
): InstitutionSourceFreshnessV1 | null | false {
  const relevant = partitions.filter((partition) =>
    isDataBearingPartition(partition.readiness),
  );
  if (relevant.length === 0) return null;
  if (relevant.some((partition) => partition.freshness === null)) return false;

  const freshnessValues = relevant.map(
    (partition) => partition.freshness as InstitutionSourceFreshnessV1,
  );
  const observedAt = freshnessValues.reduce((latest, current) =>
    Date.parse(current.observedAt) > Date.parse(latest) ? current.observedAt : latest,
  freshnessValues[0].observedAt);
  const freshUntil = freshnessValues.reduce((earliest, current) =>
    Date.parse(current.freshUntil) < Date.parse(earliest) ? current.freshUntil : earliest,
  freshnessValues[0].freshUntil);

  if (Date.parse(observedAt) > Date.parse(freshUntil)) return false;
  return Object.freeze({ observedAt, freshUntil });
}

function failClosedEnvelope(
  scope: InstitutionCapabilityStatusScopeV1,
  failureCode: 'scope_mismatch' | 'invalid_payload',
): CapabilityStatusV1 {
  const partitions: CapabilityStatusV1['partitions'] = [];
  Object.freeze(partitions);
  const envelope: CapabilityStatusV1 = {
    contractVersion: 'v1',
    scope,
    readiness: failureCode === 'scope_mismatch' ? 'denied' : 'unavailable',
    freshness: null,
    partitions,
    data: null,
    failureCode,
  };
  return Object.freeze(envelope);
}

function boundItemForSourceReadiness(
  item: Readonly<CapabilityStatusItemV1>,
  readiness: CapabilityStatusV1['readiness'],
  reachableDiagnosticTargetKeys: ReadonlySet<InstitutionDiagnosticTargetCapabilityKeyV1>,
): Readonly<CapabilityStatusItemV1> {
  const decision =
    (readiness === 'partial' || readiness === 'stale') &&
    item.decision === 'operational'
      ? 'read_only'
      : item.decision;
  const diagnosticTargetKey =
    item.diagnosticTargetKey !== null &&
    reachableDiagnosticTargetKeys.has(item.diagnosticTargetKey)
      ? item.diagnosticTargetKey
      : null;

  if (
    decision !== item.decision ||
    diagnosticTargetKey !== item.diagnosticTargetKey
  ) {
    return Object.freeze({ ...item, decision, diagnosticTargetKey });
  }
  return item;
}

function parseReachableDiagnosticTargetKeys(
  value: unknown,
): ReadonlySet<InstitutionDiagnosticTargetCapabilityKeyV1> | null {
  const keys = snapshotStrictArray(
    value,
    INSTITUTION_CAPABILITY_REGISTRY_V1.length,
  );
  if (!keys) return null;

  const parsed = new Set<InstitutionDiagnosticTargetCapabilityKeyV1>();
  for (const key of keys) {
    if (!isInstitutionDiagnosticTargetCapabilityKeyV1(key) || parsed.has(key)) {
      return null;
    }
    parsed.add(key);
  }
  return parsed;
}

function itemsAreSelfConsistent(
  items: readonly Readonly<CapabilityStatusItemV1>[],
  readiness: CapabilityStatusV1['readiness'],
) {
  for (const item of items) {
    const derived = deriveInstitutionCapabilityDecisionV1(item.dimensions);
    const expected =
      (readiness === 'partial' || readiness === 'stale') && derived === 'operational'
        ? 'read_only'
        : derived;
    if (item.decision !== expected) return false;
  }
  return true;
}

export function readInstitutionCapabilityStatusV1(input: unknown): CapabilityStatusV1 {
  const inputSnapshot = snapshotStrictDataRecord(input);
  let expectedScopeResult: ReturnType<typeof safeExpectedScope>;
  try {
    const expectedScopeValue = inputSnapshot?.expectedScope ?? null;
    expectedScopeResult = safeExpectedScope(expectedScopeValue);
  } catch {
    expectedScopeResult = safeExpectedScope(null);
  }

  const expectedScope = expectedScopeResult.scope;
  if (!expectedScopeResult.valid) {
    return failClosedEnvelope(expectedScope, 'scope_mismatch');
  }

  try {
    if (!inputSnapshot || !hasExactSnapshotKeys(inputSnapshot, READ_INPUT_KEYS)) {
      return failClosedEnvelope(expectedScope, 'invalid_payload');
    }
    const providerSnapshot = snapshotStrictDataRecord(inputSnapshot.provider);
    if (!providerSnapshot) {
      return failClosedEnvelope(expectedScope, 'scope_mismatch');
    }

    const sourceScope = parseSourceScope(providerSnapshot.scope);
    if (
      !sourceScope ||
      sourceScope.tenantId !== expectedScope.tenantId ||
      sourceScope.institutionId !== expectedScope.institutionId
    ) {
      return failClosedEnvelope(expectedScope, 'scope_mismatch');
    }
    if (!hasExactSnapshotKeys(providerSnapshot, PROVIDER_INPUT_KEYS)) {
      return failClosedEnvelope(expectedScope, 'invalid_payload');
    }
    const rawPartitions = snapshotStrictArray(
      providerSnapshot.partitions,
      INSTITUTION_CAPABILITY_REGISTRY_V1.length,
    );
    const rawEvaluations = snapshotStrictArray(
      providerSnapshot.evaluations,
      INSTITUTION_CAPABILITY_REGISTRY_V1.length,
    );
    const reachableDiagnosticTargetKeys = parseReachableDiagnosticTargetKeys(
      inputSnapshot.reachableDiagnosticTargetKeys,
    );
    if (!rawPartitions || rawPartitions.length === 0) {
      return failClosedEnvelope(expectedScope, 'invalid_payload');
    }
    if (!rawEvaluations || !reachableDiagnosticTargetKeys) {
      return failClosedEnvelope(expectedScope, 'invalid_payload');
    }

    const partitions: ParsedPartition[] = [];
    const partitionKeys = new Set<InstitutionCapabilityKeyV1>();
    for (const rawPartition of rawPartitions) {
      const partition = parsePartition(rawPartition);
      if (!partition || partitionKeys.has(partition.key)) {
        return failClosedEnvelope(expectedScope, 'invalid_payload');
      }
      partitionKeys.add(partition.key);
      partitions.push(partition);
    }
    if (partitions.some((partition) => partition.failureCode === 'scope_mismatch')) {
      return failClosedEnvelope(expectedScope, 'scope_mismatch');
    }

    const evaluatedItems: Readonly<CapabilityStatusItemV1>[] = [];
    const itemKeys = new Set<InstitutionCapabilityKeyV1>();
    for (const evaluation of rawEvaluations) {
      const result = evaluateInstitutionCapabilityStatusV1(evaluation);
      if (!result.ok || itemKeys.has(result.item.key)) {
        return failClosedEnvelope(expectedScope, 'invalid_payload');
      }
      itemKeys.add(result.item.key);
      evaluatedItems.push(result.item);
    }
    partitions.sort(
      (left, right) =>
        (capabilityDisplayOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
        (capabilityDisplayOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER),
    );
    evaluatedItems.sort(
      (left, right) =>
        (capabilityDisplayOrder.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
        (capabilityDisplayOrder.get(right.key) ?? Number.MAX_SAFE_INTEGER),
    );

    const dataBearingPartitionKeys = new Set(
      partitions
        .filter((partition) => isDataBearingPartition(partition.readiness))
        .map((partition) => partition.key),
    );
    if (
      dataBearingPartitionKeys.size !== itemKeys.size ||
      [...dataBearingPartitionKeys].some((key) => !itemKeys.has(key))
    ) {
      return failClosedEnvelope(expectedScope, 'invalid_payload');
    }

    const readiness = deriveTopLevelReadiness(partitions);
    const freshness = aggregateFreshness(partitions);
    if (freshness === false) {
      return failClosedEnvelope(expectedScope, 'invalid_payload');
    }
    const items: CapabilityStatusItemV1[] = evaluatedItems.map((item) =>
      boundItemForSourceReadiness(item, readiness, reachableDiagnosticTargetKeys),
    );
    if (!itemsAreSelfConsistent(items, readiness)) {
      return failClosedEnvelope(expectedScope, 'invalid_payload');
    }

    Object.freeze(partitions);
    Object.freeze(items);
    const data: CapabilityStatusV1['data'] =
      readiness === 'denied' ||
      readiness === 'disabled' ||
      readiness === 'unavailable'
        ? null
        : Object.freeze({ capabilities: items });

    const envelope: CapabilityStatusV1 = {
      contractVersion: 'v1',
      scope: expectedScope,
      readiness,
      freshness,
      partitions,
      data,
      failureCode: deriveTopLevelFailureCode(readiness, partitions),
    };
    return Object.freeze(envelope);
  } catch {
    return failClosedEnvelope(expectedScope, 'invalid_payload');
  }
}
