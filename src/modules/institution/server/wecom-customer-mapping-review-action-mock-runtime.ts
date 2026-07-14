import { types as nodeTypes } from 'node:util';

import {
  executeWeComCustomerMappingReviewAction,
  weComCustomerMappingReviewActions,
  weComCustomerMappingReviewStates,
  type WeComCustomerMappingReviewActionCommand,
  type WeComCustomerMappingReviewFailure,
  type WeComCustomerMappingReviewAuditEvent,
  type WeComCustomerMappingReviewIdempotencyRecord,
  type WeComCustomerMappingReviewMapping,
  type WeComCustomerMappingReviewMutationResult,
  type WeComCustomerMappingReviewState,
  type WeComCustomerMappingReviewSuccess,
} from '@/modules/institution/domain/wecom-customer-mapping-review-actions';
import type { AccessContext } from '@/modules/security/domain/access-control';

export const WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS = Object.freeze({
  maxMappings: 64,
  maxIdempotencyRecordsPerMapping: 32,
  maxAuditRecordsPerScope: 256,
  idempotencyRecordTtlMs: 15 * 60 * 1000,
  auditRecordTtlMs: 15 * 60 * 1000,
});

export type WeComCustomerMappingReviewMockFixture = Readonly<{
  mappingId: string;
  tenantId: string;
  institutionId: string;
  state: WeComCustomerMappingReviewState;
  version: number;
}>;

export type WeComCustomerMappingReviewMockRuntimeFault =
  | 'audit'
  | 'idempotency_record'
  | 'output'
  | 'transaction';

type TimedIdempotencyRecord = Readonly<{
  record: WeComCustomerMappingReviewIdempotencyRecord;
  createdAt: number;
}>;

type TimedAuditRecord = Readonly<{
  event: WeComCustomerMappingReviewAuditEvent;
  createdAt: number;
}>;

type RuntimeState = Readonly<{
  mappings: ReadonlyMap<string, WeComCustomerMappingReviewMapping>;
  idempotencyRecords: ReadonlyMap<string, ReadonlyMap<string, TimedIdempotencyRecord>>;
  auditRecords: ReadonlyMap<string, readonly TimedAuditRecord[]>;
}>;

type RuntimeCapacityFailure = Readonly<{
  ok: false;
  reasonCode: 'mock_runtime_capacity_exceeded';
  auditEvents: readonly WeComCustomerMappingReviewAuditEvent[];
}>;

export type WeComCustomerMappingReviewMockResponsePayload = Readonly<{
  ok: true;
  mappingId: string;
  action: WeComCustomerMappingReviewMutationResult['action'];
  previousStatus: WeComCustomerMappingReviewMutationResult['previousState'];
  nextStatus: WeComCustomerMappingReviewMutationResult['nextState'];
  previousVersion: number;
  nextVersion: number;
  reasonCode: WeComCustomerMappingReviewMutationResult['reasonCode'];
  idempotentReplay: boolean;
  auditSummary: Readonly<{
    eventCount: number;
    acceptedMutationCount: 0 | 1;
    replayCount: 0 | 1;
  }>;
  mockDemo: true;
  persistenceMode: 'volatile_process_memory';
  autoMergePerformed: false;
  realCustomerRelationshipWritten: false;
}>;

type RuntimeSuccess = WeComCustomerMappingReviewSuccess & Readonly<{
  responsePayload: WeComCustomerMappingReviewMockResponsePayload;
}>;

export type WeComCustomerMappingReviewMockRuntimeResult =
  | RuntimeSuccess
  | WeComCustomerMappingReviewFailure
  | RuntimeCapacityFailure;

export type WeComCustomerMappingReviewActionMockRuntime = Readonly<{
  resolveMappingOwnership(input: {
    tenantId: string;
    institutionId: string;
    mappingId: string;
  }): 'owned' | 'mapping_unavailable' | 'mock_runtime_capacity_exceeded' | 'transaction_failed';
  execute(input: {
    context: AccessContext & { tenantId: string; institutionId: string };
    command: WeComCustomerMappingReviewActionCommand;
  }): WeComCustomerMappingReviewMockRuntimeResult;
}>;

export type CreateWeComCustomerMappingReviewActionMockRuntimeOptions = Readonly<{
  fixtures: readonly WeComCustomerMappingReviewMockFixture[];
  now?: () => number;
  seedIdempotencyRecords?: readonly Readonly<{
    idempotencyKey: string;
    record: WeComCustomerMappingReviewIdempotencyRecord;
  }>[];
  occupationRecord?: (input: {
    context: AccessContext & { tenantId: string; institutionId: string };
    command: WeComCustomerMappingReviewActionCommand;
  }) => WeComCustomerMappingReviewIdempotencyRecord | null;
  faultAt?: () => WeComCustomerMappingReviewMockRuntimeFault | null;
}>;

const capacityFailure: RuntimeCapacityFailure = Object.freeze({
  ok: false,
  reasonCode: 'mock_runtime_capacity_exceeded',
  auditEvents: Object.freeze([]),
});

const defaultFixtures: readonly WeComCustomerMappingReviewMockFixture[] = Object.freeze([
  Object.freeze({
    mappingId: 'mock-wecom-mapping-pending-001',
    tenantId: 'growth-tenant-chengxing',
    institutionId: 'growth-inst-chengxing',
    state: 'pending_review',
    version: 0,
  }),
  Object.freeze({
    mappingId: 'mock-wecom-mapping-conflict-001',
    tenantId: 'growth-tenant-chengxing',
    institutionId: 'growth-inst-chengxing',
    state: 'conflict',
    version: 1,
  }),
  Object.freeze({
    mappingId: 'mock-wecom-mapping-disabled-001',
    tenantId: 'growth-tenant-chengxing',
    institutionId: 'growth-inst-chengxing',
    state: 'disabled',
    version: 1,
  }),
]);

const idempotencyRecordKeys = [
  'tenantId',
  'institutionId',
  'mappingId',
  'action',
  'keyDigest',
  'requestFingerprint',
  'status',
  'completedResult',
  'completedResultDigest',
] as const;
const mutationResultKeys = [
  'mappingId',
  'action',
  'reasonCode',
  'previousState',
  'nextState',
  'previousVersion',
  'nextVersion',
  'acceptedAuditReference',
  'autoMergePerformed',
  'realCustomerRelationshipWritten',
] as const;
const actionSet = new Set<string>(weComCustomerMappingReviewActions);
const stateSet = new Set<string>(weComCustomerMappingReviewStates);
const safeIdentifierPattern = /^[A-Za-z0-9_-]{1,256}$/;
const idempotencyKeyPattern = /^[A-Za-z0-9_-]{16,128}$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const auditReferencePattern = /^audit:[0-9a-f]{32}$/;
const capturedIsProxy = nodeTypes.isProxy;
const capturedGetPrototypeOf = Object.getPrototypeOf;
const capturedOwnKeys = Reflect.ownKeys;
const capturedGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

function captureExactDataObject(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  if (value === null || typeof value !== 'object' || capturedIsProxy(value) || Array.isArray(value)) {
    return null;
  }
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  try {
    prototype = capturedGetPrototypeOf(value);
    keys = capturedOwnKeys(value);
  } catch {
    return null;
  }
  if (
    prototype !== Object.prototype
    || keys.length !== expectedKeys.length
    || keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    || expectedKeys.some((key) => !keys.includes(key))
  ) {
    return null;
  }
  const captured: Record<string, unknown> = Object.create(null);
  for (const key of expectedKeys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = capturedGetOwnPropertyDescriptor(value, key);
    } catch {
      return null;
    }
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor) || descriptor.get || descriptor.set) {
      return null;
    }
    captured[key] = descriptor.value;
  }
  return captured;
}

function captureSeedMutationResult(value: unknown): WeComCustomerMappingReviewMutationResult | null {
  const captured = captureExactDataObject(value, mutationResultKeys);
  if (
    !captured
    || typeof captured.mappingId !== 'string'
    || !safeIdentifierPattern.test(captured.mappingId)
    || typeof captured.action !== 'string'
    || !actionSet.has(captured.action)
    || typeof captured.reasonCode !== 'string'
    || !safeIdentifierPattern.test(captured.reasonCode)
    || typeof captured.previousState !== 'string'
    || !stateSet.has(captured.previousState)
    || typeof captured.nextState !== 'string'
    || !stateSet.has(captured.nextState)
    || !Number.isSafeInteger(captured.previousVersion)
    || !Number.isSafeInteger(captured.nextVersion)
    || (captured.previousVersion as number) < 0
    || captured.nextVersion !== (captured.previousVersion as number) + 1
    || typeof captured.acceptedAuditReference !== 'string'
    || !auditReferencePattern.test(captured.acceptedAuditReference)
    || captured.autoMergePerformed !== false
    || captured.realCustomerRelationshipWritten !== false
  ) {
    return null;
  }
  return Object.freeze({
    mappingId: captured.mappingId,
    action: captured.action as WeComCustomerMappingReviewMutationResult['action'],
    reasonCode: captured.reasonCode as WeComCustomerMappingReviewMutationResult['reasonCode'],
    previousState: captured.previousState as WeComCustomerMappingReviewMutationResult['previousState'],
    nextState: captured.nextState as WeComCustomerMappingReviewMutationResult['nextState'],
    previousVersion: captured.previousVersion as number,
    nextVersion: captured.nextVersion as number,
    acceptedAuditReference: captured.acceptedAuditReference,
    autoMergePerformed: false,
    realCustomerRelationshipWritten: false,
  });
}

function captureSeedIdempotencyRecord(value: unknown): WeComCustomerMappingReviewIdempotencyRecord | null {
  const captured = captureExactDataObject(value, idempotencyRecordKeys);
  if (
    !captured
    || typeof captured.tenantId !== 'string'
    || !safeIdentifierPattern.test(captured.tenantId)
    || typeof captured.institutionId !== 'string'
    || !safeIdentifierPattern.test(captured.institutionId)
    || typeof captured.mappingId !== 'string'
    || !safeIdentifierPattern.test(captured.mappingId)
    || typeof captured.action !== 'string'
    || !actionSet.has(captured.action)
    || typeof captured.keyDigest !== 'string'
    || !digestPattern.test(captured.keyDigest)
    || typeof captured.requestFingerprint !== 'string'
    || !digestPattern.test(captured.requestFingerprint)
    || (captured.status !== 'in_progress' && captured.status !== 'completed')
  ) {
    return null;
  }
  const completedResult = captured.completedResult === null
    ? null
    : captureSeedMutationResult(captured.completedResult);
  if (
    (captured.status === 'in_progress'
      && (captured.completedResult !== null || captured.completedResultDigest !== null))
    || (captured.status === 'completed'
      && (
        !completedResult
        || typeof captured.completedResultDigest !== 'string'
        || !digestPattern.test(captured.completedResultDigest)
        || completedResult.mappingId !== captured.mappingId
        || completedResult.action !== captured.action
      ))
  ) {
    return null;
  }
  return Object.freeze({
    tenantId: captured.tenantId,
    institutionId: captured.institutionId,
    mappingId: captured.mappingId,
    action: captured.action as WeComCustomerMappingReviewIdempotencyRecord['action'],
    keyDigest: captured.keyDigest,
    requestFingerprint: captured.requestFingerprint,
    status: captured.status,
    completedResult,
    completedResultDigest: captured.completedResultDigest as string | null,
  });
}

function scopeKey(tenantId: string, institutionId: string) {
  return `${tenantId.length}:${tenantId}${institutionId.length}:${institutionId}`;
}

function mappingKey(tenantId: string, institutionId: string, mappingId: string) {
  return `${scopeKey(tenantId, institutionId)}${mappingId.length}:${mappingId}`;
}

function idempotencyLookupKey(action: string, idempotencyKey: string) {
  return `${action.length}:${action}${idempotencyKey.length}:${idempotencyKey}`;
}

function isExpired(createdAt: number, ttlMs: number, now: number) {
  return now - createdAt > ttlMs;
}

function isValidClockValue(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

function runtimeFailure(
  reasonCode: 'audit_unavailable' | 'transaction_failed' | 'response_contract_invalid',
): WeComCustomerMappingReviewFailure {
  return { ok: false, reasonCode, auditEvents: [] };
}

function createResponsePayload(
  result: WeComCustomerMappingReviewSuccess,
): WeComCustomerMappingReviewMockResponsePayload | null {
  const mutation = result.mutationResult;
  if (
    typeof mutation.mappingId !== 'string'
    || typeof mutation.action !== 'string'
    || typeof mutation.previousState !== 'string'
    || typeof mutation.nextState !== 'string'
    || typeof mutation.reasonCode !== 'string'
    || !Number.isSafeInteger(mutation.previousVersion)
    || !Number.isSafeInteger(mutation.nextVersion)
    || mutation.previousVersion < 0
    || mutation.nextVersion !== mutation.previousVersion + 1
    || mutation.autoMergePerformed !== false
    || mutation.realCustomerRelationshipWritten !== false
    || !Array.isArray(result.auditEvents)
  ) {
    return null;
  }
  const auditSummary = Object.freeze({
    eventCount: result.auditEvents.length,
    acceptedMutationCount: (result.idempotentReplay ? 0 : 1) as 0 | 1,
    replayCount: (result.idempotentReplay ? 1 : 0) as 0 | 1,
  });
  return Object.freeze({
    ok: true,
    mappingId: mutation.mappingId,
    action: mutation.action,
    previousStatus: mutation.previousState,
    nextStatus: mutation.nextState,
    previousVersion: mutation.previousVersion,
    nextVersion: mutation.nextVersion,
    reasonCode: mutation.reasonCode,
    idempotentReplay: result.idempotentReplay,
    auditSummary,
    mockDemo: true,
    persistenceMode: 'volatile_process_memory',
    autoMergePerformed: false,
    realCustomerRelationshipWritten: false,
  });
}

export function createWeComCustomerMappingReviewActionMockRuntime(
  options: CreateWeComCustomerMappingReviewActionMockRuntimeOptions,
): WeComCustomerMappingReviewActionMockRuntime {
  const now = options.now ?? Date.now;
  let initializationFailure: 'mock_runtime_capacity_exceeded' | 'transaction_failed' | null =
    options.fixtures.length > WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS.maxMappings
      ? 'mock_runtime_capacity_exceeded'
      : null;
  let lastObservedTime: number | null = null;

  const readClock = (): number | null => {
    let value: number;
    try {
      value = now();
    } catch {
      return null;
    }
    if (
      !isValidClockValue(value)
      || (lastObservedTime !== null && value < lastObservedTime)
    ) {
      return null;
    }
    lastObservedTime = value;
    return value;
  };

  const initialMappings = new Map<string, WeComCustomerMappingReviewMapping>();
  if (initializationFailure === null) {
    for (const fixture of options.fixtures) {
      const key = mappingKey(fixture.tenantId, fixture.institutionId, fixture.mappingId);
      if (initialMappings.has(key)) {
        initializationFailure = 'transaction_failed';
        break;
      }
      initialMappings.set(key, Object.freeze({ ...fixture }));
    }
  }

  const initialIdempotencyRecords = new Map<string, ReadonlyMap<string, TimedIdempotencyRecord>>();
  const seeds = options.seedIdempotencyRecords ?? [];
  if (initializationFailure === null && seeds.length > 0) {
    const seedTime = readClock();
    if (seedTime === null) {
      initializationFailure = 'transaction_failed';
    } else {
      for (const seed of seeds) {
        const capturedRecord = captureSeedIdempotencyRecord(seed.record);
        if (!idempotencyKeyPattern.test(seed.idempotencyKey) || !capturedRecord) {
          initializationFailure = 'transaction_failed';
          break;
        }
        const key = mappingKey(
          capturedRecord.tenantId,
          capturedRecord.institutionId,
          capturedRecord.mappingId,
        );
        if (!initialMappings.has(key)) {
          initializationFailure = 'transaction_failed';
          break;
        }
        const records = new Map(initialIdempotencyRecords.get(key) ?? []);
        const lookupKey = idempotencyLookupKey(capturedRecord.action, seed.idempotencyKey);
        if (records.has(lookupKey)) {
          initializationFailure = 'transaction_failed';
          break;
        }
        if (
          records.size
          >= WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS.maxIdempotencyRecordsPerMapping
        ) {
          initializationFailure = 'mock_runtime_capacity_exceeded';
          break;
        }
        records.set(lookupKey, Object.freeze({ record: capturedRecord, createdAt: seedTime }));
        initialIdempotencyRecords.set(key, records);
      }
    }
  }

  let state: RuntimeState = Object.freeze({
    mappings: initialMappings,
    idempotencyRecords: initialIdempotencyRecords,
    auditRecords: new Map<string, readonly TimedAuditRecord[]>(),
  });
  let executing = false;

  const activeRecordsFor = (
    snapshot: RuntimeState,
    key: string,
    currentTime: number,
  ) => {
    const active = new Map<string, TimedIdempotencyRecord>();
    for (const [lookupKey, timed] of snapshot.idempotencyRecords.get(key) ?? []) {
      if (!isExpired(
        timed.createdAt,
        WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS.idempotencyRecordTtlMs,
        currentTime,
      )) {
        active.set(lookupKey, timed);
      }
    }
    return active;
  };

  const activeAuditsFor = (
    snapshot: RuntimeState,
    key: string,
    currentTime: number,
  ) => (snapshot.auditRecords.get(key) ?? []).filter((timed) => !isExpired(
    timed.createdAt,
    WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS.auditRecordTtlMs,
    currentTime,
  ));

  const executeOnce = (
    input: Parameters<WeComCustomerMappingReviewActionMockRuntime['execute']>[0],
  ): WeComCustomerMappingReviewMockRuntimeResult => {
    if (initializationFailure === 'mock_runtime_capacity_exceeded') return capacityFailure;
    if (initializationFailure === 'transaction_failed') return runtimeFailure('transaction_failed');

    const currentTime = readClock();
    if (currentTime === null) return runtimeFailure('transaction_failed');
    const startingState = state;
    const key = mappingKey(
      input.context.tenantId,
      input.context.institutionId,
      input.command.mappingId,
    );
    const mapping = startingState.mappings.get(key);
    if (!mapping) {
      return { ok: false, reasonCode: 'mapping_unavailable', auditEvents: [] };
    }

    const auditKey = scopeKey(input.context.tenantId, input.context.institutionId);
    const activeRecords = activeRecordsFor(startingState, key, currentTime);
    const activeAudits = activeAuditsFor(startingState, auditKey, currentTime);
    const lookupKey = idempotencyLookupKey(input.command.action, input.command.idempotencyKey);
    const existingTimedRecord = activeRecords.get(lookupKey) ?? null;

    let fault: WeComCustomerMappingReviewMockRuntimeFault | null;
    let occupiedRecord: WeComCustomerMappingReviewIdempotencyRecord | null = null;
    try {
      fault = options.faultAt?.() ?? null;
      if (existingTimedRecord === null) {
        occupiedRecord = options.occupationRecord?.(input) ?? null;
      }
    } catch {
      return runtimeFailure('transaction_failed');
    }

    const result = executeWeComCustomerMappingReviewAction(
      input.command,
      {
        authenticated: true,
        tenantId: input.context.tenantId,
        institutionId: input.context.institutionId,
        scope: input.context.scope,
        capabilities: ['customer:read', 'customer:mapping_review'],
      },
      mapping,
      existingTimedRecord?.record ?? null,
      {
        occupationResult: occupiedRecord
          ? { kind: 'existing', record: occupiedRecord }
          : 'acquired',
        acceptedAuditReady: fault !== 'audit',
        responseContractReady: true,
        transactionReady: fault !== 'transaction',
      },
    );

    if (!result.ok) return result;
    if (fault === 'audit') return runtimeFailure('audit_unavailable');
    if (fault === 'transaction') return runtimeFailure('transaction_failed');
    const replayFromOccupation = result.idempotentReplay
      && existingTimedRecord === null
      && occupiedRecord !== null;
    let committedAuditEvents: readonly WeComCustomerMappingReviewAuditEvent[] = result.auditEvents;
    if (replayFromOccupation) {
      const winnerResult = executeWeComCustomerMappingReviewAction(
        input.command,
        {
          authenticated: true,
          tenantId: input.context.tenantId,
          institutionId: input.context.institutionId,
          scope: input.context.scope,
          capabilities: ['customer:read', 'customer:mapping_review'],
        },
        mapping,
        null,
        {
          occupationResult: 'acquired',
          acceptedAuditReady: true,
          responseContractReady: true,
          transactionReady: true,
        },
      );
      if (
        !winnerResult.ok
        || winnerResult.idempotentReplay
        || winnerResult.idempotencyRecord.requestFingerprint
          !== result.idempotencyRecord.requestFingerprint
        || winnerResult.idempotencyRecord.completedResultDigest
          !== result.idempotencyRecord.completedResultDigest
      ) {
        return { ok: false, reasonCode: 'idempotency_record_invalid', auditEvents: [] };
      }
      committedAuditEvents = Object.freeze([
        ...winnerResult.auditEvents,
        ...result.auditEvents,
      ]);
    } else if (
      result.idempotentReplay
      && (
        result.mutationResult.nextVersion > mapping.version
        || (
          result.mutationResult.nextVersion === mapping.version
          && result.mutationResult.nextState !== mapping.state
        )
      )
    ) {
      return { ok: false, reasonCode: 'idempotency_record_invalid', auditEvents: [] };
    }
    if (fault === 'idempotency_record') return runtimeFailure('transaction_failed');
    if (fault === 'output') return runtimeFailure('response_contract_invalid');

    const responsePayload = createResponsePayload(result);
    if (!responsePayload) return runtimeFailure('response_contract_invalid');

    const nextRecords = new Map(activeRecords);
    if (!result.idempotentReplay || existingTimedRecord === null) {
      if (
        !nextRecords.has(lookupKey)
        && nextRecords.size
          >= WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS.maxIdempotencyRecordsPerMapping
      ) {
        return capacityFailure;
      }
      nextRecords.set(lookupKey, Object.freeze({
        record: result.idempotencyRecord,
        createdAt: currentTime,
      }));
    }

    if (
      activeAudits.length + committedAuditEvents.length
      > WE_COM_CUSTOMER_MAPPING_REVIEW_MOCK_RUNTIME_LIMITS.maxAuditRecordsPerScope
    ) {
      return capacityFailure;
    }
    const nextAudits = Object.freeze([
      ...activeAudits,
      ...committedAuditEvents.map((event) => Object.freeze({ event, createdAt: currentTime })),
    ]);

    const nextMappings = new Map(startingState.mappings);
    if (!result.idempotentReplay || replayFromOccupation) {
      nextMappings.set(key, Object.freeze({
        ...mapping,
        state: result.mutationResult.nextState,
        version: result.mutationResult.nextVersion,
      }));
    }
    const nextIdempotencyRecords = new Map(startingState.idempotencyRecords);
    nextIdempotencyRecords.set(key, nextRecords);
    const nextAuditRecords = new Map(startingState.auditRecords);
    nextAuditRecords.set(auditKey, nextAudits);
    if (state !== startingState) return runtimeFailure('transaction_failed');

    const nextState: RuntimeState = Object.freeze({
      mappings: nextMappings,
      idempotencyRecords: nextIdempotencyRecords,
      auditRecords: nextAuditRecords,
    });
    const runtimeResult: RuntimeSuccess = Object.freeze({ ...result, responsePayload });
    state = nextState;
    return runtimeResult;
  };

  return Object.freeze({
    resolveMappingOwnership(input) {
      if (initializationFailure === 'mock_runtime_capacity_exceeded') {
        return 'mock_runtime_capacity_exceeded';
      }
      if (initializationFailure === 'transaction_failed') return 'transaction_failed';
      return state.mappings.has(mappingKey(input.tenantId, input.institutionId, input.mappingId))
        ? 'owned'
        : 'mapping_unavailable';
    },

    execute(input) {
      if (executing) return runtimeFailure('transaction_failed');
      executing = true;
      try {
        return executeOnce(input);
      } catch {
        return runtimeFailure('transaction_failed');
      } finally {
        executing = false;
      }
    },
  });
}

export const weComCustomerMappingReviewActionMockRuntime =
  createWeComCustomerMappingReviewActionMockRuntime({ fixtures: defaultFixtures });
