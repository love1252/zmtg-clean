import {
  CAPABILITY_STATUS_SAFE_SUMMARY_MAX_LENGTH_V1,
  isCapabilityStatusCodeMaturityV1,
  isCapabilityStatusConnectionAvailabilityV1,
  isCapabilityStatusDataReadinessV1,
  isCapabilityStatusDecisionV1,
  isCapabilityStatusInstitutionAuthorizationV1,
  isCapabilityStatusProductionReleaseV1,
  type CapabilityStatusItemV1,
  type CapabilityStatusV1,
} from '@/modules/institution-contracts/v1/institution-capability';
import {
  INSTITUTION_CAPABILITY_REGISTRY_V1,
  isInstitutionCapabilityKeyV1,
  isInstitutionDiagnosticTargetCapabilityKeyV1,
  type InstitutionCapabilityDefinitionV1,
  type InstitutionCapabilityKeyV1,
  type InstitutionDiagnosticTargetCapabilityKeyV1,
} from '@/modules/institution-contracts/v1/institution-capability-registry';
import {
  isInstitutionSourceFailureCodeV1,
  isInstitutionSourcePartitionReadinessV1,
  isInstitutionSourceReadinessV1,
  type InstitutionSourceFreshnessV1,
} from '@/modules/institution-contracts/v1/institution-source';

import type {
  WorkbenchCapabilityDiagnosticTargetViewModel,
  WorkbenchCapabilityProjection,
  WorkbenchCapabilitySummaryViewModel,
  WorkbenchQuickCreateItemViewModel,
} from './workbench-capability-view-models';

export type BuildWorkbenchCapabilityProjectionInput = Readonly<{
  capabilities: CapabilityStatusV1;
  /** Trusted server clock input; a future caller must never copy it from a client request. */
  referenceTime: string;
}>;

type CapabilityPartition = CapabilityStatusV1['partitions'][number];

const BLOCKED_PROJECTION = deepFreeze({
  status: 'blocked',
  summaries: [],
  quickCreateMenu: null,
} as const satisfies WorkbenchCapabilityProjection);

const FORBIDDEN_SAFE_SUMMARY_PATTERNS = Object.freeze([
  /(?:https?|wss?|ftp):\/\//iu,
  /\b(?:adapter|provider|endpoint|credential|password|secret|access[\s_-]?token|api[\s_-]?key|stack[\s_-]?trace|exception|sqlstate|econnrefused|webhook|socket|dsn)\b/iu,
  /(?:适配器|服务商|端点|凭证|密钥|令牌|密码|异常堆栈|原始异常|技术错误|环境变量|连接地址)/u,
  /(?:localhost|(?:\d{1,3}\.){3}\d{1,3})(?::\d{1,5})?/iu,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu,
  /(?:姓名|患者|联系人|客户)\s*[：:]\s*[\p{Script=Han}A-Z]{2,}/iu,
  /(?:消息正文|最近消息|聊天内容|对话内容|客户说|客户回复|治疗正文|治疗内容|治疗方案|支付明细|原始订单|订单号|流水号|银行卡|身份证)/u,
  /\b(?:customer|patient|message|payment|treatment|order)[\s_-]?id\b/iu,
  /[￥¥]\s*\d|\d[\d,.]*(?:\.\d{1,2})?\s*元/u,
]);

const SAFE_SUMMARY_STATUS_PHRASES = Object.freeze([
  '可用',
  '部分可用',
  '暂不可用',
  '不可用',
  '仅供查看',
  '只读',
  '已过期',
  '已过期，仅供查看',
  '暂无数据',
  '无数据',
  '数据为空',
  '未开放',
  '未发布',
  '已暂停',
  '待恢复',
  '状态正常',
  '状态异常',
] as const);

const SAFE_SUMMARY_GENERIC_PREFIXES = Object.freeze([
  '业务',
  '当前业务',
  '业务数据',
  '当前业务数据',
  '能力',
  '当前能力',
  '数据',
  '当前数据',
  '当前',
] as const);

const SAFE_SUMMARY_EXACT_ALIASES = Object.freeze({
  page_knowledge_library: Object.freeze(['知识库资料仅供查看'] as const),
  page_system_ai_usage: Object.freeze(['AI 使用统计仅供查看'] as const),
} as const);

const BUSINESS_PAYLOAD_FORBIDDEN_FAILURE_CODES = Object.freeze([
  'scope_mismatch',
  'permission_denied',
  'not_released',
] as const);

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const nestedValue of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nestedValue);
  }

  return Object.freeze(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const SNAPSHOT_FAILED = Symbol('workbench-capability-snapshot-failed');
type SnapshotFailed = typeof SNAPSHOT_FAILED;

function captureRequiredDataFields<const K extends string>(
  value: unknown,
  requiredKeys: readonly K[],
): Readonly<Record<K, unknown>> | SnapshotFailed {
  if (!isRecord(value)) {
    return SNAPSHOT_FAILED;
  }

  const descriptors = Object.getOwnPropertyDescriptors(value) as unknown as Record<
    PropertyKey,
    PropertyDescriptor
  >;
  if (Reflect.ownKeys(descriptors).some((key) => typeof key === 'symbol')) {
    return SNAPSHOT_FAILED;
  }

  const captured = {} as Record<K, unknown>;
  for (const key of requiredKeys) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      return SNAPSHOT_FAILED;
    }
    captured[key] = descriptor.value;
  }

  return captured;
}

function captureDenseArray<T>(
  value: unknown,
  captureItem: (item: unknown) => T | SnapshotFailed,
  maxLength: number,
): readonly T[] | SnapshotFailed {
  if (!Array.isArray(value)) {
    return SNAPSHOT_FAILED;
  }

  const descriptors = Object.getOwnPropertyDescriptors(value) as unknown as Record<
    PropertyKey,
    PropertyDescriptor
  >;
  const ownKeys = Reflect.ownKeys(descriptors);
  if (ownKeys.some((key) => typeof key === 'symbol')) {
    return SNAPSHOT_FAILED;
  }

  const lengthDescriptor = descriptors['length'];
  if (
    lengthDescriptor === undefined ||
    !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value') ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value > maxLength
  ) {
    return SNAPSHOT_FAILED;
  }

  const length = lengthDescriptor.value;
  if (ownKeys.length !== length + 1) {
    return SNAPSHOT_FAILED;
  }

  const captured: T[] = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    ) {
      return SNAPSHOT_FAILED;
    }

    const item = captureItem(descriptor.value);
    if (item === SNAPSHOT_FAILED) {
      return SNAPSHOT_FAILED;
    }
    captured.push(item);
  }

  return captured;
}

function captureFreshness(value: unknown): InstitutionSourceFreshnessV1 | null | SnapshotFailed {
  if (value === null) {
    return null;
  }

  const fields = captureRequiredDataFields(value, ['observedAt', 'freshUntil'] as const);
  if (fields === SNAPSHOT_FAILED) {
    return SNAPSHOT_FAILED;
  }

  return {
    observedAt: fields.observedAt as string,
    freshUntil: fields.freshUntil as string,
  };
}

function captureDimensions(
  value: unknown,
): CapabilityStatusItemV1['dimensions'] | SnapshotFailed {
  const fields = captureRequiredDataFields(
    value,
    [
      'codeMaturity',
      'institutionAuthorization',
      'connectionAvailability',
      'dataReadiness',
      'productionRelease',
    ] as const,
  );
  if (fields === SNAPSHOT_FAILED) {
    return SNAPSHOT_FAILED;
  }

  return {
    codeMaturity: fields.codeMaturity as CapabilityStatusItemV1['dimensions']['codeMaturity'],
    institutionAuthorization:
      fields.institutionAuthorization as CapabilityStatusItemV1['dimensions']['institutionAuthorization'],
    connectionAvailability:
      fields.connectionAvailability as CapabilityStatusItemV1['dimensions']['connectionAvailability'],
    dataReadiness:
      fields.dataReadiness as CapabilityStatusItemV1['dimensions']['dataReadiness'],
    productionRelease:
      fields.productionRelease as CapabilityStatusItemV1['dimensions']['productionRelease'],
  };
}

function captureCapabilityItem(value: unknown): CapabilityStatusItemV1 | SnapshotFailed {
  const fields = captureRequiredDataFields(
    value,
    ['key', 'decision', 'dimensions', 'safeSummary', 'diagnosticTargetKey'] as const,
  );
  if (fields === SNAPSHOT_FAILED) {
    return SNAPSHOT_FAILED;
  }

  const dimensions = captureDimensions(fields.dimensions);
  if (dimensions === SNAPSHOT_FAILED) {
    return SNAPSHOT_FAILED;
  }

  return {
    key: fields.key as CapabilityStatusItemV1['key'],
    decision: fields.decision as CapabilityStatusItemV1['decision'],
    dimensions,
    safeSummary: fields.safeSummary as CapabilityStatusItemV1['safeSummary'],
    diagnosticTargetKey:
      fields.diagnosticTargetKey as CapabilityStatusItemV1['diagnosticTargetKey'],
  };
}

function captureCapabilityPartition(value: unknown): CapabilityPartition | SnapshotFailed {
  const fields = captureRequiredDataFields(
    value,
    ['key', 'readiness', 'freshness', 'failureCode'] as const,
  );
  if (fields === SNAPSHOT_FAILED) {
    return SNAPSHOT_FAILED;
  }

  const freshness = captureFreshness(fields.freshness);
  if (freshness === SNAPSHOT_FAILED) {
    return SNAPSHOT_FAILED;
  }

  return {
    key: fields.key as CapabilityPartition['key'],
    readiness: fields.readiness as CapabilityPartition['readiness'],
    freshness,
    failureCode: fields.failureCode as CapabilityPartition['failureCode'],
  };
}

function captureCapabilityStatus(value: unknown): CapabilityStatusV1 | SnapshotFailed {
  const fields = captureRequiredDataFields(
    value,
    [
      'contractVersion',
      'scope',
      'readiness',
      'freshness',
      'partitions',
      'data',
      'failureCode',
    ] as const,
  );
  if (fields === SNAPSHOT_FAILED) {
    return SNAPSHOT_FAILED;
  }

  const scopeFields = captureRequiredDataFields(
    fields.scope,
    ['tenantId', 'institutionId'] as const,
  );
  const freshness = captureFreshness(fields.freshness);
  const partitions = captureDenseArray(
    fields.partitions,
    captureCapabilityPartition,
    INSTITUTION_CAPABILITY_REGISTRY_V1.length,
  );
  if (
    scopeFields === SNAPSHOT_FAILED ||
    freshness === SNAPSHOT_FAILED ||
    partitions === SNAPSHOT_FAILED
  ) {
    return SNAPSHOT_FAILED;
  }

  let data: CapabilityStatusV1['data'];
  if (fields.data === null) {
    data = null;
  } else {
    const dataFields = captureRequiredDataFields(fields.data, ['capabilities'] as const);
    if (dataFields === SNAPSHOT_FAILED) {
      return SNAPSHOT_FAILED;
    }
    const capabilities = captureDenseArray(
      dataFields.capabilities,
      captureCapabilityItem,
      INSTITUTION_CAPABILITY_REGISTRY_V1.length,
    );
    if (capabilities === SNAPSHOT_FAILED) {
      return SNAPSHOT_FAILED;
    }
    data = { capabilities: [...capabilities] };
  }

  return {
    contractVersion: fields.contractVersion as CapabilityStatusV1['contractVersion'],
    scope: {
      tenantId: scopeFields.tenantId as string,
      institutionId: scopeFields.institutionId as string,
    },
    readiness: fields.readiness as CapabilityStatusV1['readiness'],
    freshness,
    partitions: [...partitions],
    data,
    failureCode: fields.failureCode as CapabilityStatusV1['failureCode'],
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toTimestamp(value: unknown): number | null {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
    ? timestamp
    : null;
}

function isValidFreshness(value: unknown): value is InstitutionSourceFreshnessV1 {
  if (!isRecord(value)) {
    return false;
  }

  const observedAt = toTimestamp(value.observedAt);
  const freshUntil = toTimestamp(value.freshUntil);
  return observedAt !== null && freshUntil !== null && observedAt <= freshUntil;
}

function isCurrentFreshness(value: unknown, referenceTimestamp: number): boolean {
  if (!isValidFreshness(value)) {
    return false;
  }

  const observedAt = toTimestamp(value.observedAt);
  const freshUntil = toTimestamp(value.freshUntil);
  return (
    observedAt !== null &&
    freshUntil !== null &&
    observedAt <= referenceTimestamp &&
    referenceTimestamp <= freshUntil
  );
}

function isObservedByReferenceTime(
  value: unknown,
  referenceTimestamp: number,
): value is InstitutionSourceFreshnessV1 {
  if (!isValidFreshness(value)) {
    return false;
  }

  const observedAt = toTimestamp(value.observedAt);
  return observedAt !== null && observedAt <= referenceTimestamp;
}

function isFailureCodeOrNull(value: unknown): boolean {
  return value === null || isInstitutionSourceFailureCodeV1(value);
}

function isBusinessPayloadForbiddenFailureCode(value: unknown): boolean {
  return BUSINESS_PAYLOAD_FORBIDDEN_FAILURE_CODES.some(
    (failureCode) => failureCode === value,
  );
}

function isSafeBusinessSummary(
  value: unknown,
  definition: InstitutionCapabilityDefinitionV1,
): value is string | null {
  if (value === null) {
    return true;
  }

  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.trim() ||
    [...value].length > CAPABILITY_STATUS_SAFE_SUMMARY_MAX_LENGTH_V1 ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return false;
  }

  const compactValue = value.replace(/[\s()\-]/gu, '');
  if (
    /1[3-9]\d{9}/u.test(compactValue) ||
    /\d{16,19}/u.test(compactValue) ||
    /\d{17}[\dX]/iu.test(compactValue)
  ) {
    return false;
  }

  if (FORBIDDEN_SAFE_SUMMARY_PATTERNS.some((pattern) => pattern.test(value))) {
    return false;
  }

  const exactAliases =
    definition.key === 'page_knowledge_library'
      ? SAFE_SUMMARY_EXACT_ALIASES.page_knowledge_library
      : definition.key === 'page_system_ai_usage'
        ? SAFE_SUMMARY_EXACT_ALIASES.page_system_ai_usage
        : Object.freeze([] as const);
  if (exactAliases.some((alias) => value === alias)) {
    return true;
  }

  const allowedPrefixes = [
    definition.label,
    `${definition.label}业务`,
    `${definition.label}能力`,
    `${definition.label}业务数据`,
    ...SAFE_SUMMARY_GENERIC_PREFIXES,
  ];

  return allowedPrefixes.some((prefix) =>
    SAFE_SUMMARY_STATUS_PHRASES.some((status) => value === `${prefix}${status}`),
  );
}

function isValidDimensions(value: unknown): value is CapabilityStatusItemV1['dimensions'] {
  return (
    isRecord(value) &&
    isCapabilityStatusCodeMaturityV1(value.codeMaturity) &&
    isCapabilityStatusInstitutionAuthorizationV1(value.institutionAuthorization) &&
    isCapabilityStatusConnectionAvailabilityV1(value.connectionAvailability) &&
    isCapabilityStatusDataReadinessV1(value.dataReadiness) &&
    isCapabilityStatusProductionReleaseV1(value.productionRelease)
  );
}

function isValidCapabilityItem(value: unknown): value is CapabilityStatusItemV1 {
  const definition =
    isRecord(value) && isInstitutionCapabilityKeyV1(value.key)
      ? findCapabilityDefinition(value.key)
      : null;

  return (
    isRecord(value) &&
    definition !== null &&
    isCapabilityStatusDecisionV1(value.decision) &&
    isValidDimensions(value.dimensions) &&
    isSafeBusinessSummary(value.safeSummary, definition) &&
    (value.diagnosticTargetKey === null ||
      isInstitutionDiagnosticTargetCapabilityKeyV1(value.diagnosticTargetKey))
  );
}

function isValidCapabilityPartition(value: unknown): value is CapabilityPartition {
  return (
    isRecord(value) &&
    isInstitutionCapabilityKeyV1(value.key) &&
    isInstitutionSourcePartitionReadinessV1(value.readiness) &&
    (value.freshness === null || isValidFreshness(value.freshness)) &&
    isFailureCodeOrNull(value.failureCode)
  );
}

function hasUniqueKeys<K extends string>(values: readonly K[]): boolean {
  return new Set(values).size === values.length;
}

function hasScopeMismatch(source: CapabilityStatusV1): boolean {
  return (
    source.failureCode === 'scope_mismatch' ||
    source.partitions.some((partition) => partition.failureCode === 'scope_mismatch')
  );
}

function sourceHasValidShape(source: unknown): source is CapabilityStatusV1 {
  if (!isRecord(source)) {
    return false;
  }

  if (
    source.contractVersion !== 'v1' ||
    !isRecord(source.scope) ||
    !isNonEmptyString(source.scope.tenantId) ||
    !isNonEmptyString(source.scope.institutionId) ||
    !isInstitutionSourceReadinessV1(source.readiness) ||
    (source.freshness !== null && !isValidFreshness(source.freshness)) ||
    !Array.isArray(source.partitions) ||
    !source.partitions.every(isValidCapabilityPartition) ||
    !isFailureCodeOrNull(source.failureCode)
  ) {
    return false;
  }

  if (
    (source.readiness === 'ready' || source.readiness === 'empty') &&
    source.failureCode !== null
  ) {
    return false;
  }

  const partitionKeys = source.partitions.map((partition) => partition.key);
  if (!hasUniqueKeys(partitionKeys)) {
    return false;
  }

  if (source.data === null) {
    return (
      source.readiness === 'empty' ||
      source.readiness === 'stale' ||
      source.readiness === 'unavailable' ||
      source.readiness === 'denied' ||
      source.readiness === 'disabled'
    );
  }

  if (
    !isRecord(source.data) ||
    !Array.isArray(source.data.capabilities) ||
    !source.data.capabilities.every(isValidCapabilityItem)
  ) {
    return false;
  }

  const itemKeys = source.data.capabilities.map((item) => item.key);
  if (!hasUniqueKeys(itemKeys) || itemKeys.some((key) => !partitionKeys.includes(key))) {
    return false;
  }

  const itemKeySet = new Set<InstitutionCapabilityKeyV1>(itemKeys);
  const hasForbiddenBusinessPayload = source.partitions.some(
    (partition) =>
      (partition.readiness === 'empty' ||
        partition.readiness === 'unavailable' ||
        partition.readiness === 'denied' ||
        partition.readiness === 'disabled') &&
      itemKeySet.has(partition.key),
  );

  if (
    hasForbiddenBusinessPayload ||
    source.readiness === 'unavailable' ||
    source.readiness === 'denied' ||
    source.readiness === 'disabled'
  ) {
    return false;
  }

  const partitionsByKey = new Map(
    source.partitions.map((partition) => [partition.key, partition] as const),
  );

  if (
    source.readiness === 'stale' &&
    isBusinessPayloadForbiddenFailureCode(source.failureCode)
  ) {
    return false;
  }

  return source.data.capabilities.every((item) => {
    const partition = partitionsByKey.get(item.key);
    if (!partition) {
      return false;
    }

    if (
      isBusinessPayloadForbiddenFailureCode(partition.failureCode)
    ) {
      return false;
    }

    const snapshotIsStale = source.readiness === 'stale' || partition.readiness === 'stale';
    return !snapshotIsStale || item.decision !== 'operational';
  });
}

function findCapabilityDefinition(
  key: InstitutionCapabilityKeyV1,
): InstitutionCapabilityDefinitionV1 {
  const definition = INSTITUTION_CAPABILITY_REGISTRY_V1.find(
    (candidate) => candidate.key === key,
  );

  if (!definition) {
    throw new Error('Public capability registry invariant violated.');
  }

  return definition;
}

function projectDiagnosticTarget(
  key: InstitutionDiagnosticTargetCapabilityKeyV1 | null,
): WorkbenchCapabilityDiagnosticTargetViewModel | null {
  if (key === null) {
    return null;
  }

  const definition = findCapabilityDefinition(key);
  if (definition.kind !== 'page' || definition.sectionId !== 'system') {
    throw new Error('Public diagnostic target registry invariant violated.');
  }

  return {
    key,
    label: definition.label,
    href: definition.href,
  } as WorkbenchCapabilityDiagnosticTargetViewModel;
}

function projectSummary(
  source: CapabilityStatusV1,
  definition: InstitutionCapabilityDefinitionV1,
  item: CapabilityStatusItemV1,
  partition: CapabilityPartition,
  referenceTimestamp: number,
): WorkbenchCapabilitySummaryViewModel | null {
  if (item.decision === 'hidden' || item.safeSummary === null) {
    return null;
  }

  const diagnosticTarget = projectDiagnosticTarget(item.diagnosticTargetKey);
  const snapshotIsStale = source.readiness === 'stale' || partition.readiness === 'stale';

  if (snapshotIsStale) {
    if (
      (partition.readiness !== 'ready' && partition.readiness !== 'stale') ||
      item.decision !== 'read_only' ||
      !isObservedByReferenceTime(partition.freshness, referenceTimestamp)
    ) {
      return null;
    }

    return {
      key: definition.key,
      kind: definition.kind,
      label: definition.label,
      decision: 'read_only',
      safeSummary: item.safeSummary,
      dataStatus: 'stale',
      observedAt: partition.freshness.observedAt,
      diagnosticTarget,
    };
  }

  if (
    (source.readiness !== 'ready' && source.readiness !== 'partial') ||
    partition.readiness !== 'ready' ||
    partition.failureCode !== null ||
    !isCurrentFreshness(partition.freshness, referenceTimestamp)
  ) {
    return null;
  }

  return {
    key: definition.key,
    kind: definition.kind,
    label: definition.label,
    decision: item.decision,
    safeSummary: item.safeSummary,
    dataStatus: 'current',
    observedAt: null,
    diagnosticTarget,
  };
}

function projectQuickCreateItem(
  source: CapabilityStatusV1,
  definition: InstitutionCapabilityDefinitionV1,
  item: CapabilityStatusItemV1,
  partition: CapabilityPartition,
  referenceTimestamp: number,
): WorkbenchQuickCreateItemViewModel | null {
  if (
    definition.kind !== 'action' ||
    item.decision !== 'operational' ||
    (source.readiness !== 'ready' && source.readiness !== 'partial') ||
    partition.readiness !== 'ready' ||
    partition.failureCode !== null ||
    !isCurrentFreshness(partition.freshness, referenceTimestamp)
  ) {
    return null;
  }

  return {
    key: definition.key,
    label: definition.label,
    href: definition.href,
  };
}

function projectValidatedSource(
  source: CapabilityStatusV1,
  referenceTimestamp: number,
): WorkbenchCapabilityProjection {
  if (
    hasScopeMismatch(source) ||
    source.readiness === 'denied' ||
    source.readiness === 'disabled'
  ) {
    return BLOCKED_PROJECTION;
  }

  const itemsByKey = new Map(
    (source.data?.capabilities ?? []).map((item) => [item.key, item] as const),
  );
  const partitionsByKey = new Map(
    source.partitions.map((partition) => [partition.key, partition] as const),
  );
  const summaries: WorkbenchCapabilitySummaryViewModel[] = [];
  const quickCreateItems: WorkbenchQuickCreateItemViewModel[] = [];

  for (const definition of INSTITUTION_CAPABILITY_REGISTRY_V1) {
    const item = itemsByKey.get(definition.key);
    const partition = partitionsByKey.get(definition.key);
    if (!item || !partition) {
      continue;
    }

    const summary = projectSummary(
      source,
      definition,
      item,
      partition,
      referenceTimestamp,
    );
    if (summary) {
      summaries.push(summary);
    }

    const quickCreateItem = projectQuickCreateItem(
      source,
      definition,
      item,
      partition,
      referenceTimestamp,
    );
    if (quickCreateItem) {
      quickCreateItems.push(quickCreateItem);
    }
  }

  return deepFreeze({
    status: 'projected',
    sourceReadiness: source.readiness,
    summaries,
    quickCreateMenu:
      quickCreateItems.length === 0
        ? null
        : {
            label: '新建',
            items: quickCreateItems,
          },
  } as const satisfies WorkbenchCapabilityProjection);
}

/**
 * Pure low-sensitivity projection over a typed CapabilityStatusV1 snapshot. The authoritative
 * server decision is consumed as-is and never recalculated from its dimensions. `operational`
 * only controls whether a registered create link may be shown; every target must independently
 * reauthorize the current scope, role, capability, object, and business prerequisites.
 */
export function buildWorkbenchCapabilityProjection(
  input: BuildWorkbenchCapabilityProjectionInput,
): WorkbenchCapabilityProjection {
  try {
    const inputFields = captureRequiredDataFields(
      input,
      ['capabilities', 'referenceTime'] as const,
    );
    if (inputFields === SNAPSHOT_FAILED) {
      return BLOCKED_PROJECTION;
    }

    const capabilities = captureCapabilityStatus(inputFields.capabilities);
    if (capabilities === SNAPSHOT_FAILED) {
      return BLOCKED_PROJECTION;
    }

    const referenceTime = inputFields.referenceTime;
    const referenceTimestamp = toTimestamp(referenceTime);
    if (
      referenceTimestamp === null ||
      !sourceHasValidShape(capabilities) ||
      (capabilities.freshness !== null &&
        !isObservedByReferenceTime(capabilities.freshness, referenceTimestamp)) ||
      (capabilities.readiness === 'ready' &&
        !isCurrentFreshness(capabilities.freshness, referenceTimestamp))
    ) {
      return BLOCKED_PROJECTION;
    }

    return projectValidatedSource(deepFreeze(capabilities), referenceTimestamp);
  } catch {
    return BLOCKED_PROJECTION;
  }
}
