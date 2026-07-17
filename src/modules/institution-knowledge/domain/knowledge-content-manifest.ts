import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

export const knowledgeContentManifestFormatVersion = 1 as const;
export const knowledgeOwnershipSources = Object.freeze([
  'institution',
  'platform',
] as const);
export const knowledgeSafetyStatuses = Object.freeze([
  'pending',
  'allowed',
  'blocked',
  'expired',
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

export type KnowledgeOwnershipSource =
  (typeof knowledgeOwnershipSources)[number];
export type KnowledgeSafetyStatus =
  (typeof knowledgeSafetyStatuses)[number];
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

export type KnowledgeBodyRevisionDescriptor = Readonly<{
  bodyRevisionId: string;
  contentHash: string;
  schemaVersion: string;
  templateVersion: string;
}>;

export type KnowledgeAttachmentRevisionDescriptor = Readonly<{
  fileRevisionId: string;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
  safetyStatus: KnowledgeSafetyStatus;
  displayName: string;
}>;

export type CreateKnowledgeContentManifestInput = Readonly<{
  manifestFormatVersion: typeof knowledgeContentManifestFormatVersion;
  knowledgeId: string;
  tenantId: string;
  institutionId: string;
  ownershipSource: KnowledgeOwnershipSource;
  metadataSnapshot: KnowledgeMetadataSnapshot;
  body: KnowledgeBodyRevisionDescriptor;
  attachments: readonly KnowledgeAttachmentRevisionDescriptor[];
}>;

export type KnowledgeContentManifest = CreateKnowledgeContentManifestInput &
  Readonly<{ manifestHash: string }>;

export type KnowledgeContentManifestFailureCode =
  | 'duplicate_file_revision'
  | 'input_invalid'
  | 'manifest_hash_mismatch';

export type KnowledgeContentManifestResult =
  | Readonly<{ ok: true; manifest: KnowledgeContentManifest }>
  | Readonly<{
      ok: false;
      reasonCode: KnowledgeContentManifestFailureCode;
    }>;

const referenceIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const contentHashPattern = /^sha256:[a-f0-9]{64}$/;
const mimeTypePattern =
  /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$/;
const isoTimestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/;
const unsafeDisplayNamePattern = /[\u0000-\u001f\u007f/\\]/;

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
  allowed: readonly T[],
): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function hasWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (!(nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function isWellFormedString(value: unknown): value is string {
  return typeof value === 'string' && hasWellFormedUnicode(value);
}

function isReferenceId(value: unknown): value is string {
  return isWellFormedString(value) && referenceIdPattern.test(value);
}

function isContentHash(value: unknown): value is string {
  return isWellFormedString(value) && contentHashPattern.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  if (!isWellFormedString(value)) return false;
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

function isOptionalIsoTimestamp(value: unknown): value is string | null {
  return value === null || isIsoTimestamp(value);
}

function isMetadataSnapshot(
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
    isWellFormedString(value.title) &&
    isWellFormedString(value.category) &&
    isDenseDataArray(value.tags) &&
    value.tags.every(isWellFormedString) &&
    isWellFormedString(value.lowSensitiveSummary) &&
    isWellFormedString(value.source) &&
    isOneOf(value.riskLevel, knowledgeRiskLevels) &&
    isOptionalIsoTimestamp(value.effectiveAt) &&
    isOptionalIsoTimestamp(value.reviewAt) &&
    isOneOf(value.useScope, knowledgeUseScopes)
  );
}

function isBodyDescriptor(
  value: unknown,
): value is KnowledgeBodyRevisionDescriptor {
  return (
    isRecord(value) &&
    hasExactOwnDataKeys(value, [
      'bodyRevisionId',
      'contentHash',
      'schemaVersion',
      'templateVersion',
    ]) &&
    isReferenceId(value.bodyRevisionId) &&
    isContentHash(value.contentHash) &&
    isReferenceId(value.schemaVersion) &&
    isReferenceId(value.templateVersion)
  );
}

function isControlledDisplayName(value: unknown): value is string {
  return (
    isWellFormedString(value) &&
    value.length > 0 &&
    value.length <= 255 &&
    !unsafeDisplayNamePattern.test(value)
  );
}

function isAttachmentDescriptor(
  value: unknown,
): value is KnowledgeAttachmentRevisionDescriptor {
  return (
    isRecord(value) &&
    hasExactOwnDataKeys(value, [
      'fileRevisionId',
      'contentHash',
      'mimeType',
      'sizeBytes',
      'safetyStatus',
      'displayName',
    ]) &&
    isReferenceId(value.fileRevisionId) &&
    isContentHash(value.contentHash) &&
    isWellFormedString(value.mimeType) &&
    mimeTypePattern.test(value.mimeType) &&
    Number.isSafeInteger(value.sizeBytes) &&
    (value.sizeBytes as number) >= 0 &&
    !Object.is(value.sizeBytes, -0) &&
    isOneOf(value.safetyStatus, knowledgeSafetyStatuses) &&
    isControlledDisplayName(value.displayName)
  );
}

type DescriptorValidation =
  | Readonly<{
      ok: true;
      descriptor: CreateKnowledgeContentManifestInput;
    }>
  | Readonly<{
      ok: false;
      reasonCode: Exclude<
        KnowledgeContentManifestFailureCode,
        'manifest_hash_mismatch'
      >;
    }>;

function validateDescriptor(value: unknown): DescriptorValidation {
  if (
    !isRecord(value) ||
    !hasExactOwnDataKeys(value, [
      'manifestFormatVersion',
      'knowledgeId',
      'tenantId',
      'institutionId',
      'ownershipSource',
      'metadataSnapshot',
      'body',
      'attachments',
    ]) ||
    value.manifestFormatVersion !== knowledgeContentManifestFormatVersion ||
    !isReferenceId(value.knowledgeId) ||
    !isReferenceId(value.tenantId) ||
    !isReferenceId(value.institutionId) ||
    !isOneOf(value.ownershipSource, knowledgeOwnershipSources) ||
    !isMetadataSnapshot(value.metadataSnapshot) ||
    !isBodyDescriptor(value.body) ||
    !isDenseDataArray(value.attachments) ||
    !value.attachments.every(isAttachmentDescriptor)
  ) {
    return Object.freeze({ ok: false, reasonCode: 'input_invalid' });
  }

  const fileRevisionIds = value.attachments.map(
    (attachment) => attachment.fileRevisionId,
  );
  if (new Set(fileRevisionIds).size !== fileRevisionIds.length) {
    return Object.freeze({
      ok: false,
      reasonCode: 'duplicate_file_revision',
    });
  }

  return Object.freeze({
    ok: true,
    descriptor: value as CreateKnowledgeContentManifestInput,
  });
}

function freezeMetadataSnapshot(
  metadataSnapshot: KnowledgeMetadataSnapshot,
): KnowledgeMetadataSnapshot {
  return Object.freeze({
    title: metadataSnapshot.title,
    category: metadataSnapshot.category,
    tags: Object.freeze([...metadataSnapshot.tags]),
    lowSensitiveSummary: metadataSnapshot.lowSensitiveSummary,
    source: metadataSnapshot.source,
    riskLevel: metadataSnapshot.riskLevel,
    effectiveAt: metadataSnapshot.effectiveAt,
    reviewAt: metadataSnapshot.reviewAt,
    useScope: metadataSnapshot.useScope,
  });
}

function freezeBodyDescriptor(
  body: KnowledgeBodyRevisionDescriptor,
): KnowledgeBodyRevisionDescriptor {
  return Object.freeze({
    bodyRevisionId: body.bodyRevisionId,
    contentHash: body.contentHash,
    schemaVersion: body.schemaVersion,
    templateVersion: body.templateVersion,
  });
}

function freezeAttachmentDescriptor(
  attachment: KnowledgeAttachmentRevisionDescriptor,
): KnowledgeAttachmentRevisionDescriptor {
  return Object.freeze({
    fileRevisionId: attachment.fileRevisionId,
    contentHash: attachment.contentHash,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    safetyStatus: attachment.safetyStatus,
    displayName: attachment.displayName,
  });
}

function freezeDescriptor(
  descriptor: CreateKnowledgeContentManifestInput,
): CreateKnowledgeContentManifestInput {
  return Object.freeze({
    manifestFormatVersion: knowledgeContentManifestFormatVersion,
    knowledgeId: descriptor.knowledgeId,
    tenantId: descriptor.tenantId,
    institutionId: descriptor.institutionId,
    ownershipSource: descriptor.ownershipSource,
    metadataSnapshot: freezeMetadataSnapshot(descriptor.metadataSnapshot),
    body: freezeBodyDescriptor(descriptor.body),
    attachments: Object.freeze(
      descriptor.attachments.map(freezeAttachmentDescriptor),
    ),
  });
}

type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJsonValue[];

function quoteCanonicalJsonString(value: string): string {
  let encoded = '"';
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    switch (codeUnit) {
      case 0x08:
        encoded += '\\b';
        break;
      case 0x09:
        encoded += '\\t';
        break;
      case 0x0a:
        encoded += '\\n';
        break;
      case 0x0c:
        encoded += '\\f';
        break;
      case 0x0d:
        encoded += '\\r';
        break;
      case 0x22:
        encoded += '\\"';
        break;
      case 0x5c:
        encoded += '\\\\';
        break;
      default:
        encoded +=
          codeUnit <= 0x1f
            ? `\\u${codeUnit.toString(16).padStart(4, '0')}`
            : value[index];
    }
  }
  return `${encoded}"`;
}

function encodeCanonicalJson(value: CanonicalJsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return quoteCanonicalJsonString(value);
  if (typeof value === 'number') return Object.is(value, -0) ? '0' : `${value}`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  let encoded = '[';
  for (let index = 0; index < value.length; index += 1) {
    if (index > 0) encoded += ',';
    encoded += encodeCanonicalJson(value[index] as CanonicalJsonValue);
  }
  return `${encoded}]`;
}

function canonicalDescriptor(
  descriptor: CreateKnowledgeContentManifestInput,
): string {
  return encodeCanonicalJson([
    'zmtg.institution-knowledge.content-manifest',
    knowledgeContentManifestFormatVersion,
    [
      descriptor.knowledgeId,
      descriptor.tenantId,
      descriptor.institutionId,
      descriptor.ownershipSource,
    ],
    [
      descriptor.metadataSnapshot.title,
      descriptor.metadataSnapshot.category,
      [...descriptor.metadataSnapshot.tags],
      descriptor.metadataSnapshot.lowSensitiveSummary,
      descriptor.metadataSnapshot.source,
      descriptor.metadataSnapshot.riskLevel,
      descriptor.metadataSnapshot.effectiveAt,
      descriptor.metadataSnapshot.reviewAt,
      descriptor.metadataSnapshot.useScope,
    ],
    [
      descriptor.body.bodyRevisionId,
      descriptor.body.contentHash,
      descriptor.body.schemaVersion,
      descriptor.body.templateVersion,
    ],
    descriptor.attachments.map((attachment) => [
      attachment.fileRevisionId,
      attachment.contentHash,
      attachment.mimeType,
      attachment.sizeBytes,
      attachment.safetyStatus,
      attachment.displayName,
    ]),
  ]);
}

function deriveManifestHash(
  descriptor: CreateKnowledgeContentManifestInput,
): string {
  const digest = createHash('sha256')
    .update(canonicalDescriptor(descriptor), 'utf8')
    .digest('hex');
  return `sha256:${digest}`;
}

function failure(
  reasonCode: KnowledgeContentManifestFailureCode,
): KnowledgeContentManifestResult {
  return Object.freeze({ ok: false, reasonCode });
}

function success(
  descriptor: CreateKnowledgeContentManifestInput,
  manifestHash: string,
): KnowledgeContentManifestResult {
  const frozenDescriptor = freezeDescriptor(descriptor);
  const manifest = Object.freeze({
    ...frozenDescriptor,
    manifestHash,
  });
  return Object.freeze({ ok: true, manifest });
}

export function createKnowledgeContentManifest(
  input: CreateKnowledgeContentManifestInput,
): KnowledgeContentManifestResult {
  try {
    const validation = validateDescriptor(input);
    if (!validation.ok) return failure(validation.reasonCode);
    const descriptor = freezeDescriptor(validation.descriptor);
    return success(descriptor, deriveManifestHash(descriptor));
  } catch {
    return failure('input_invalid');
  }
}

export function validateKnowledgeContentManifest(
  value: unknown,
): KnowledgeContentManifestResult {
  try {
    if (
      !isRecord(value) ||
      !hasExactOwnDataKeys(value, [
        'manifestFormatVersion',
        'knowledgeId',
        'tenantId',
        'institutionId',
        'ownershipSource',
        'metadataSnapshot',
        'body',
        'attachments',
        'manifestHash',
      ]) ||
      !isContentHash(value.manifestHash)
    ) {
      return failure('input_invalid');
    }

    const descriptorValidation = validateDescriptor({
      manifestFormatVersion: value.manifestFormatVersion,
      knowledgeId: value.knowledgeId,
      tenantId: value.tenantId,
      institutionId: value.institutionId,
      ownershipSource: value.ownershipSource,
      metadataSnapshot: value.metadataSnapshot,
      body: value.body,
      attachments: value.attachments,
    });
    if (!descriptorValidation.ok) {
      return failure(descriptorValidation.reasonCode);
    }

    const descriptor = freezeDescriptor(descriptorValidation.descriptor);
    const expectedHash = deriveManifestHash(descriptor);
    if (value.manifestHash !== expectedHash) {
      return failure('manifest_hash_mismatch');
    }
    return success(descriptor, expectedHash);
  } catch {
    return failure('input_invalid');
  }
}

export function knowledgeContentManifestsEqual(
  left: unknown,
  right: unknown,
): boolean {
  try {
    const leftValidation = validateKnowledgeContentManifest(left);
    const rightValidation = validateKnowledgeContentManifest(right);
    return (
      leftValidation.ok &&
      rightValidation.ok &&
      leftValidation.manifest.manifestHash ===
        rightValidation.manifest.manifestHash &&
      canonicalDescriptor(leftValidation.manifest) ===
        canonicalDescriptor(rightValidation.manifest)
    );
  } catch {
    return false;
  }
}
