import { isProxy } from 'node:util/types';

import {
  knowledgeRiskLevels,
  knowledgeSafetyStatuses,
  knowledgeUseScopes,
  validateKnowledgeContentManifest,
  type KnowledgeContentManifest,
  type KnowledgeMetadataSnapshot,
  type KnowledgeRiskLevel,
  type KnowledgeSafetyStatus,
  type KnowledgeUseScope,
} from './knowledge-content-manifest';

export {
  knowledgeRiskLevels,
  knowledgeSafetyStatuses,
  knowledgeUseScopes,
} from './knowledge-content-manifest';
export type {
  KnowledgeMetadataSnapshot,
  KnowledgeRiskLevel,
  KnowledgeSafetyStatus,
  KnowledgeUseScope,
} from './knowledge-content-manifest';

export const knowledgeItemLifecycles = Object.freeze([
  'active',
  'retired',
] as const);
export const knowledgeVersionLifecycles = Object.freeze([
  'draft',
  'publishing',
  'published',
] as const);
export const knowledgeAssetApprovalStatuses = Object.freeze([
  'not_approved',
  'approved',
  'withdrawn',
  'blocked',
] as const);

export type KnowledgeItemLifecycle =
  (typeof knowledgeItemLifecycles)[number];
export type KnowledgeVersionLifecycle =
  (typeof knowledgeVersionLifecycles)[number];
export type KnowledgeAssetApprovalStatus =
  (typeof knowledgeAssetApprovalStatuses)[number];

export type KnowledgeVersion = Readonly<{
  knowledgeId: string;
  versionId: string;
  versionNumber: number;
  lifecycle: KnowledgeVersionLifecycle;
  metadataSnapshot: KnowledgeMetadataSnapshot;
  bodyRevisionId: string;
  fileRevisionIds: readonly string[];
  manifestHash: string;
  contentManifest: KnowledgeContentManifest;
  createdByActorId: string;
  createdAt: string;
}>;

export type CreateKnowledgeDraftVersionInput = Readonly<{
  versionId: string;
  versionNumber: number;
  previousVersionNumber: number | null;
  contentManifest: KnowledgeContentManifest;
  createdByActorId: string;
  createdAt: string;
}>;

export type CreateNextDraftFromPublishedVersionInput = Readonly<{
  sourceVersion: KnowledgeVersion;
  versionId: string;
  contentManifest: KnowledgeContentManifest;
  createdByActorId: string;
  createdAt: string;
}>;

export type KnowledgeVersioningFailureCode =
  | 'duplicate_file_revision'
  | 'input_invalid'
  | 'manifest_binding_mismatch'
  | 'manifest_hash_mismatch'
  | 'platform_read_only'
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
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !isProxy(value) &&
    !Array.isArray(value)
  );
}

function hasExactOwnDataKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.length !== expectedKeys.length ||
    !expectedKeys.every((key) => keys.includes(key))
  ) {
    return false;
  }

  return expectedKeys.every((key) => {
    const descriptor = descriptors[key];
    return (
      descriptor !== undefined &&
      descriptor.enumerable === true &&
      'value' in descriptor
    );
  });
}

function isDenseDataArray(value: unknown): value is readonly unknown[] {
  if (
    isProxy(value) ||
    !Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Array.prototype
  ) {
    return false;
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === 'symbol')) return false;
  if (keys.length !== value.length + 1 || !keys.includes('length')) return false;

  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !('value' in descriptor)
    ) {
      return false;
    }
  }
  return true;
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
  if (typeof value !== 'string') return false;
  const match = isoTimestampPattern.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === undefined ? 0 : Number(match[8]);
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    daysInMonth !== undefined &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}

function isAtOrAfterTimestamp(value: string, reference: string): boolean {
  return Date.parse(value) >= Date.parse(reference);
}

function isMetadataSnapshotShape(
  value: unknown,
): value is KnowledgeMetadataSnapshot {
  return (
    isRecord(value) &&
    hasExactOwnDataKeys(value, [
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
    isDenseDataArray(value.tags) &&
    value.tags.every((tag) => typeof tag === 'string') &&
    typeof value.lowSensitiveSummary === 'string' &&
    typeof value.source === 'string' &&
    isOneOf(value.riskLevel, knowledgeRiskLevels) &&
    (value.effectiveAt === null || isIsoTimestamp(value.effectiveAt)) &&
    (value.reviewAt === null || isIsoTimestamp(value.reviewAt)) &&
    isOneOf(value.useScope, knowledgeUseScopes)
  );
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function metadataSnapshotsEqual(
  left: KnowledgeMetadataSnapshot,
  right: KnowledgeMetadataSnapshot,
): boolean {
  return (
    left.title === right.title &&
    left.category === right.category &&
    arraysEqual(left.tags, right.tags) &&
    left.lowSensitiveSummary === right.lowSensitiveSummary &&
    left.source === right.source &&
    left.riskLevel === right.riskLevel &&
    left.effectiveAt === right.effectiveAt &&
    left.reviewAt === right.reviewAt &&
    left.useScope === right.useScope
  );
}

function failure(
  reasonCode: KnowledgeVersioningFailureCode,
): KnowledgeVersioningResult {
  return Object.freeze({ ok: false, reasonCode });
}

function mapManifestFailure(
  reasonCode:
    | 'duplicate_file_revision'
    | 'input_invalid'
    | 'manifest_hash_mismatch',
): KnowledgeVersioningFailureCode {
  return reasonCode;
}

type KnowledgeVersionValidation =
  | Readonly<{
      ok: true;
      version: KnowledgeVersion;
      contentManifest: KnowledgeContentManifest;
    }>
  | Readonly<{
      ok: false;
      reasonCode: KnowledgeVersioningFailureCode;
    }>;

function validateKnowledgeVersion(value: unknown): KnowledgeVersionValidation {
  try {
    if (
      !isRecord(value) ||
      !hasExactOwnDataKeys(value, [
        'knowledgeId',
        'versionId',
        'versionNumber',
        'lifecycle',
        'metadataSnapshot',
        'bodyRevisionId',
        'fileRevisionIds',
        'manifestHash',
        'contentManifest',
        'createdByActorId',
        'createdAt',
      ]) ||
      !isReferenceId(value.knowledgeId) ||
      !isReferenceId(value.versionId) ||
      !Number.isSafeInteger(value.versionNumber) ||
      (value.versionNumber as number) <= 0 ||
      !isOneOf(value.lifecycle, knowledgeVersionLifecycles) ||
      !isMetadataSnapshotShape(value.metadataSnapshot) ||
      !isReferenceId(value.bodyRevisionId) ||
      !isDenseDataArray(value.fileRevisionIds) ||
      !value.fileRevisionIds.every(isReferenceId) ||
      typeof value.manifestHash !== 'string' ||
      !manifestHashPattern.test(value.manifestHash) ||
      !isReferenceId(value.createdByActorId) ||
      !isIsoTimestamp(value.createdAt)
    ) {
      return Object.freeze({ ok: false, reasonCode: 'input_invalid' });
    }

    if (
      new Set(value.fileRevisionIds).size !== value.fileRevisionIds.length
    ) {
      return Object.freeze({
        ok: false,
        reasonCode: 'duplicate_file_revision',
      });
    }

    const manifestValidation = validateKnowledgeContentManifest(
      value.contentManifest,
    );
    if (!manifestValidation.ok) {
      return Object.freeze({
        ok: false,
        reasonCode: mapManifestFailure(manifestValidation.reasonCode),
      });
    }

    const manifest = manifestValidation.manifest;
    const manifestFileRevisionIds = manifest.attachments.map(
      (attachment) => attachment.fileRevisionId,
    );
    if (
      value.knowledgeId !== manifest.knowledgeId ||
      !metadataSnapshotsEqual(value.metadataSnapshot, manifest.metadataSnapshot) ||
      value.bodyRevisionId !== manifest.body.bodyRevisionId ||
      !arraysEqual(value.fileRevisionIds, manifestFileRevisionIds) ||
      value.manifestHash !== manifest.manifestHash
    ) {
      return Object.freeze({
        ok: false,
        reasonCode: 'manifest_binding_mismatch',
      });
    }

    return Object.freeze({
      ok: true,
      version: value as KnowledgeVersion,
      contentManifest: manifest,
    });
  } catch {
    return Object.freeze({ ok: false, reasonCode: 'input_invalid' });
  }
}

export function isValidKnowledgeVersion(
  value: unknown,
): value is KnowledgeVersion {
  return validateKnowledgeVersion(value).ok;
}

function freezeVersion(input: Readonly<{
  versionId: string;
  versionNumber: number;
  lifecycle: KnowledgeVersionLifecycle;
  contentManifest: KnowledgeContentManifest;
  createdByActorId: string;
  createdAt: string;
}>): KnowledgeVersion {
  const manifest = input.contentManifest;
  return Object.freeze({
    knowledgeId: manifest.knowledgeId,
    versionId: input.versionId,
    versionNumber: input.versionNumber,
    lifecycle: input.lifecycle,
    metadataSnapshot: manifest.metadataSnapshot,
    bodyRevisionId: manifest.body.bodyRevisionId,
    fileRevisionIds: Object.freeze(
      manifest.attachments.map((attachment) => attachment.fileRevisionId),
    ),
    manifestHash: manifest.manifestHash,
    contentManifest: manifest,
    createdByActorId: input.createdByActorId,
    createdAt: input.createdAt,
  });
}

const allowedLifecycleTransitions: Readonly<
  Record<KnowledgeVersionLifecycle, readonly KnowledgeVersionLifecycle[]>
> = {
  draft: ['publishing'],
  publishing: ['draft', 'published'],
  published: [],
};

export function createKnowledgeDraftVersion(
  input: CreateKnowledgeDraftVersionInput,
): KnowledgeVersioningResult {
  try {
    if (
      !isRecord(input) ||
      !hasExactOwnDataKeys(input, [
        'versionId',
        'versionNumber',
        'previousVersionNumber',
        'contentManifest',
        'createdByActorId',
        'createdAt',
      ]) ||
      !isReferenceId(input.versionId) ||
      !Number.isSafeInteger(input.versionNumber) ||
      !(
        input.previousVersionNumber === null ||
        (Number.isSafeInteger(input.previousVersionNumber) &&
          input.previousVersionNumber > 0)
      ) ||
      !isReferenceId(input.createdByActorId) ||
      !isIsoTimestamp(input.createdAt)
    ) {
      return failure('input_invalid');
    }

    const manifestValidation = validateKnowledgeContentManifest(
      input.contentManifest,
    );
    if (!manifestValidation.ok) {
      return failure(mapManifestFailure(manifestValidation.reasonCode));
    }

    if (manifestValidation.manifest.ownershipSource === 'platform') {
      return failure('platform_read_only');
    }

    if (
      input.previousVersionNumber === Number.MAX_SAFE_INTEGER ||
      input.versionNumber <= 0 ||
      input.versionNumber !== (input.previousVersionNumber ?? 0) + 1
    ) {
      return failure('version_number_not_monotonic');
    }

    return Object.freeze({
      ok: true,
      version: freezeVersion({
        versionId: input.versionId,
        versionNumber: input.versionNumber,
        lifecycle: 'draft',
        contentManifest: manifestValidation.manifest,
        createdByActorId: input.createdByActorId,
        createdAt: input.createdAt,
      }),
    });
  } catch {
    return failure('input_invalid');
  }
}

export function transitionKnowledgeVersionLifecycle(input: Readonly<{
  version: KnowledgeVersion;
  to: KnowledgeVersionLifecycle;
}>): KnowledgeVersioningResult {
  try {
    if (
      !isRecord(input) ||
      !hasExactOwnDataKeys(input, ['version', 'to']) ||
      !isOneOf(input.to, knowledgeVersionLifecycles)
    ) {
      return failure('input_invalid');
    }

    const validation = validateKnowledgeVersion(input.version);
    if (!validation.ok) return failure(validation.reasonCode);

    if (validation.contentManifest.ownershipSource === 'platform') {
      return failure('platform_read_only');
    }

    const allowedTargets =
      allowedLifecycleTransitions[validation.version.lifecycle];
    if (!allowedTargets.includes(input.to)) {
      return failure('version_lifecycle_transition_invalid');
    }

    return Object.freeze({
      ok: true,
      version: freezeVersion({
        versionId: validation.version.versionId,
        versionNumber: validation.version.versionNumber,
        lifecycle: input.to,
        contentManifest: validation.contentManifest,
        createdByActorId: validation.version.createdByActorId,
        createdAt: validation.version.createdAt,
      }),
    });
  } catch {
    return failure('input_invalid');
  }
}

export function createNextDraftFromPublishedVersion(
  input: CreateNextDraftFromPublishedVersionInput,
): KnowledgeVersioningResult {
  try {
    if (
      !isRecord(input) ||
      !hasExactOwnDataKeys(input, [
        'sourceVersion',
        'versionId',
        'contentManifest',
        'createdByActorId',
        'createdAt',
      ]) ||
      !isReferenceId(input.versionId) ||
      !isReferenceId(input.createdByActorId) ||
      !isIsoTimestamp(input.createdAt)
    ) {
      return failure('input_invalid');
    }

    const sourceValidation = validateKnowledgeVersion(input.sourceVersion);
    if (!sourceValidation.ok) return failure(sourceValidation.reasonCode);

    const manifestValidation = validateKnowledgeContentManifest(
      input.contentManifest,
    );
    if (!manifestValidation.ok) {
      return failure(mapManifestFailure(manifestValidation.reasonCode));
    }

    if (sourceValidation.contentManifest.ownershipSource === 'platform') {
      return failure('platform_read_only');
    }

    if (sourceValidation.version.lifecycle !== 'published') {
      return failure('source_version_not_published');
    }
    if (input.versionId === sourceValidation.version.versionId) {
      return failure('version_id_reused');
    }
    if (sourceValidation.version.versionNumber === Number.MAX_SAFE_INTEGER) {
      return failure('version_number_not_monotonic');
    }
    if (
      !isAtOrAfterTimestamp(
        input.createdAt,
        sourceValidation.version.createdAt,
      )
    ) {
      return failure('input_invalid');
    }
    const sourceManifest = sourceValidation.version.contentManifest;
    const nextManifest = manifestValidation.manifest;
    if (
      nextManifest.knowledgeId !== sourceManifest.knowledgeId ||
      nextManifest.tenantId !== sourceManifest.tenantId ||
      nextManifest.institutionId !== sourceManifest.institutionId ||
      nextManifest.ownershipSource !== sourceManifest.ownershipSource
    ) {
      return failure('manifest_binding_mismatch');
    }

    return createKnowledgeDraftVersion({
      versionId: input.versionId,
      versionNumber: sourceValidation.version.versionNumber + 1,
      previousVersionNumber: sourceValidation.version.versionNumber,
      contentManifest: manifestValidation.manifest,
      createdByActorId: input.createdByActorId,
      createdAt: input.createdAt,
    });
  } catch {
    return failure('input_invalid');
  }
}
