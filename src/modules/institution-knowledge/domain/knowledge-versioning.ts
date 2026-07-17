export const knowledgeItemLifecycles = Object.freeze([
  'active',
  'retired',
] as const);
export const knowledgeVersionLifecycles = Object.freeze([
  'draft',
  'publishing',
  'published',
] as const);
export const knowledgeSafetyStatuses = Object.freeze([
  'pending',
  'allowed',
  'blocked',
  'expired',
] as const);
export const knowledgeAssetApprovalStatuses = Object.freeze([
  'not_approved',
  'approved',
  'withdrawn',
  'blocked',
] as const);

export const knowledgeRiskLevels = Object.freeze([
  'low',
  'medium',
  'high',
] as const);
export const knowledgeUseScopes = Object.freeze([
  'internal_only',
  'ai_customer_reply',
] as const);

export type KnowledgeItemLifecycle =
  (typeof knowledgeItemLifecycles)[number];
export type KnowledgeVersionLifecycle =
  (typeof knowledgeVersionLifecycles)[number];
export type KnowledgeSafetyStatus =
  (typeof knowledgeSafetyStatuses)[number];
export type KnowledgeAssetApprovalStatus =
  (typeof knowledgeAssetApprovalStatuses)[number];
export type KnowledgeRiskLevel = (typeof knowledgeRiskLevels)[number];
export type KnowledgeUseScope = (typeof knowledgeUseScopes)[number];

export type KnowledgeMetadataSnapshot = Readonly<{
  title: string;
  category: string;
  tags: readonly string[];
  lowSensitiveSummary: string;
  source: string;
  riskLevel: KnowledgeRiskLevel;
  effectiveAt: string | null;
  reviewAt: string | null;
  useScope: KnowledgeUseScope;
}>;

export type KnowledgeVersion = Readonly<{
  knowledgeId: string;
  versionId: string;
  versionNumber: number;
  lifecycle: KnowledgeVersionLifecycle;
  metadataSnapshot: KnowledgeMetadataSnapshot;
  bodyRevisionId: string;
  fileRevisionIds: readonly string[];
  manifestHash: string;
  createdAt: string;
}>;

export type CreateKnowledgeDraftVersionInput = Readonly<{
  knowledgeId: string;
  versionId: string;
  versionNumber: number;
  previousVersionNumber: number | null;
  metadataSnapshot: KnowledgeMetadataSnapshot;
  bodyRevisionId: string;
  fileRevisionIds: readonly string[];
  manifestHash: string;
  createdAt: string;
}>;

export type CreateNextDraftFromPublishedVersionInput = Readonly<{
  sourceVersion: KnowledgeVersion;
  versionId: string;
  metadataSnapshot: KnowledgeMetadataSnapshot;
  bodyRevisionId: string;
  fileRevisionIds: readonly string[];
  manifestHash: string;
  createdAt: string;
}>;

export type KnowledgeVersioningFailureCode =
  | 'duplicate_file_revision'
  | 'input_invalid'
  | 'manifest_hash_invalid'
  | 'source_version_not_published'
  | 'version_id_reused'
  | 'version_lifecycle_transition_invalid'
  | 'version_number_not_monotonic';

export type KnowledgeVersioningResult =
  | Readonly<{ ok: true; version: KnowledgeVersion }>
  | Readonly<{
      ok: false;
      reasonCode: KnowledgeVersioningFailureCode;
    }>;

const manifestHashPattern = /^sha256:[a-f0-9]{64}$/;
const referenceIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const isoTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Reflect.ownKeys(value);
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      (key) => typeof key === 'string' && expectedKeys.includes(key),
    )
  );
}

function isOneOf<T extends string>(
  value: unknown,
  values: readonly T[],
): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function isReferenceId(value: unknown): value is string {
  return typeof value === 'string' && referenceIdPattern.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && isoTimestampPattern.test(value);
}

function isValidMetadataSnapshot(
  value: unknown,
): value is KnowledgeMetadataSnapshot {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'title',
      'category',
      'tags',
      'lowSensitiveSummary',
      'source',
      'riskLevel',
      'effectiveAt',
      'reviewAt',
      'useScope',
    ]) &&
    typeof value.title === 'string' &&
    typeof value.category === 'string' &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === 'string') &&
    typeof value.lowSensitiveSummary === 'string' &&
    typeof value.source === 'string' &&
    isOneOf(value.riskLevel, knowledgeRiskLevels) &&
    (value.effectiveAt === null || isIsoTimestamp(value.effectiveAt)) &&
    (value.reviewAt === null || isIsoTimestamp(value.reviewAt)) &&
    isOneOf(value.useScope, knowledgeUseScopes)
  );
}

export function isValidKnowledgeVersion(
  value: unknown,
): value is KnowledgeVersion {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'knowledgeId',
      'versionId',
      'versionNumber',
      'lifecycle',
      'metadataSnapshot',
      'bodyRevisionId',
      'fileRevisionIds',
      'manifestHash',
      'createdAt',
    ]) &&
    isReferenceId(value.knowledgeId) &&
    isReferenceId(value.versionId) &&
    Number.isSafeInteger(value.versionNumber) &&
    (value.versionNumber as number) > 0 &&
    isOneOf(value.lifecycle, knowledgeVersionLifecycles) &&
    isValidMetadataSnapshot(value.metadataSnapshot) &&
    isReferenceId(value.bodyRevisionId) &&
    Array.isArray(value.fileRevisionIds) &&
    value.fileRevisionIds.every(isReferenceId) &&
    new Set(value.fileRevisionIds).size === value.fileRevisionIds.length &&
    typeof value.manifestHash === 'string' &&
    manifestHashPattern.test(value.manifestHash) &&
    isIsoTimestamp(value.createdAt)
  );
}

function isValidCreateDraftInput(
  value: unknown,
): value is CreateKnowledgeDraftVersionInput {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      'knowledgeId',
      'versionId',
      'versionNumber',
      'previousVersionNumber',
      'metadataSnapshot',
      'bodyRevisionId',
      'fileRevisionIds',
      'manifestHash',
      'createdAt',
    ]) &&
    isReferenceId(value.knowledgeId) &&
    isReferenceId(value.versionId) &&
    Number.isSafeInteger(value.versionNumber) &&
    (value.previousVersionNumber === null ||
      (Number.isSafeInteger(value.previousVersionNumber) &&
        (value.previousVersionNumber as number) > 0)) &&
    isValidMetadataSnapshot(value.metadataSnapshot) &&
    isReferenceId(value.bodyRevisionId) &&
    Array.isArray(value.fileRevisionIds) &&
    value.fileRevisionIds.every(isReferenceId) &&
    typeof value.manifestHash === 'string' &&
    isIsoTimestamp(value.createdAt)
  );
}

const allowedLifecycleTransitions: Readonly<
  Record<KnowledgeVersionLifecycle, readonly KnowledgeVersionLifecycle[]>
> = {
  draft: ['publishing'],
  publishing: ['draft', 'published'],
  published: [],
};

function failure(
  reasonCode: KnowledgeVersioningFailureCode,
): KnowledgeVersioningResult {
  return Object.freeze({ ok: false, reasonCode });
}

function freezeMetadataSnapshot(
  metadataSnapshot: KnowledgeMetadataSnapshot,
): KnowledgeMetadataSnapshot {
  const tags = Object.freeze([...metadataSnapshot.tags]);

  return Object.freeze({
    title: metadataSnapshot.title,
    category: metadataSnapshot.category,
    tags,
    lowSensitiveSummary: metadataSnapshot.lowSensitiveSummary,
    source: metadataSnapshot.source,
    riskLevel: metadataSnapshot.riskLevel,
    effectiveAt: metadataSnapshot.effectiveAt,
    reviewAt: metadataSnapshot.reviewAt,
    useScope: metadataSnapshot.useScope,
  });
}

function freezeVersion(version: KnowledgeVersion): KnowledgeVersion {
  return Object.freeze({
    knowledgeId: version.knowledgeId,
    versionId: version.versionId,
    versionNumber: version.versionNumber,
    lifecycle: version.lifecycle,
    metadataSnapshot: freezeMetadataSnapshot(version.metadataSnapshot),
    bodyRevisionId: version.bodyRevisionId,
    fileRevisionIds: Object.freeze([...version.fileRevisionIds]),
    manifestHash: version.manifestHash,
    createdAt: version.createdAt,
  });
}

export function createKnowledgeDraftVersion(
  input: CreateKnowledgeDraftVersionInput,
): KnowledgeVersioningResult {
  if (!isValidCreateDraftInput(input)) {
    return failure('input_invalid');
  }

  const expectedVersionNumber = (input.previousVersionNumber ?? 0) + 1;
  const hasValidMonotonicNumber =
    Number.isSafeInteger(input.versionNumber) &&
    input.versionNumber > 0 &&
    (input.previousVersionNumber === null ||
      (Number.isSafeInteger(input.previousVersionNumber) &&
        input.previousVersionNumber > 0)) &&
    input.versionNumber === expectedVersionNumber;

  if (!hasValidMonotonicNumber) {
    return failure('version_number_not_monotonic');
  }

  if (new Set(input.fileRevisionIds).size !== input.fileRevisionIds.length) {
    return failure('duplicate_file_revision');
  }

  if (!manifestHashPattern.test(input.manifestHash)) {
    return failure('manifest_hash_invalid');
  }

  const version = freezeVersion({
    knowledgeId: input.knowledgeId,
    versionId: input.versionId,
    versionNumber: input.versionNumber,
    lifecycle: 'draft',
    metadataSnapshot: input.metadataSnapshot,
    bodyRevisionId: input.bodyRevisionId,
    fileRevisionIds: input.fileRevisionIds,
    manifestHash: input.manifestHash,
    createdAt: input.createdAt,
  });

  return Object.freeze({ ok: true, version });
}

export function transitionKnowledgeVersionLifecycle(input: Readonly<{
  version: KnowledgeVersion;
  to: KnowledgeVersionLifecycle;
}>): KnowledgeVersioningResult {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, ['version', 'to']) ||
    !isValidKnowledgeVersion(input.version) ||
    !isOneOf(input.to, knowledgeVersionLifecycles)
  ) {
    return failure('input_invalid');
  }

  const allowedTargets = allowedLifecycleTransitions[input.version.lifecycle];
  if (allowedTargets === undefined || !allowedTargets.includes(input.to)) {
    return failure('version_lifecycle_transition_invalid');
  }

  const version = freezeVersion({
    ...input.version,
    lifecycle: input.to,
  });

  return Object.freeze({ ok: true, version });
}

export function createNextDraftFromPublishedVersion(
  input: CreateNextDraftFromPublishedVersionInput,
): KnowledgeVersioningResult {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      'sourceVersion',
      'versionId',
      'metadataSnapshot',
      'bodyRevisionId',
      'fileRevisionIds',
      'manifestHash',
      'createdAt',
    ]) ||
    !isValidKnowledgeVersion(input.sourceVersion) ||
    !isReferenceId(input.versionId) ||
    !isValidMetadataSnapshot(input.metadataSnapshot) ||
    !isReferenceId(input.bodyRevisionId) ||
    !Array.isArray(input.fileRevisionIds) ||
    !input.fileRevisionIds.every(isReferenceId) ||
    typeof input.manifestHash !== 'string' ||
    !isIsoTimestamp(input.createdAt)
  ) {
    return failure('input_invalid');
  }

  if (input.sourceVersion.lifecycle !== 'published') {
    return failure('source_version_not_published');
  }
  if (input.versionId === input.sourceVersion.versionId) {
    return failure('version_id_reused');
  }
  if (input.sourceVersion.versionNumber === Number.MAX_SAFE_INTEGER) {
    return failure('version_number_not_monotonic');
  }

  return createKnowledgeDraftVersion({
    knowledgeId: input.sourceVersion.knowledgeId,
    versionId: input.versionId,
    versionNumber: input.sourceVersion.versionNumber + 1,
    previousVersionNumber: input.sourceVersion.versionNumber,
    metadataSnapshot: input.metadataSnapshot,
    bodyRevisionId: input.bodyRevisionId,
    fileRevisionIds: input.fileRevisionIds,
    manifestHash: input.manifestHash,
    createdAt: input.createdAt,
  });
}
