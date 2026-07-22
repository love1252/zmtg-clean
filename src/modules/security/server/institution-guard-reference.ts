import { createHmac, timingSafeEqual } from 'node:crypto';
import { isProxy } from 'node:util/types';

import { isInstitutionScopeIdV1 } from '@/modules/security/domain/institution-access';
import {
  INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1,
  INSTITUTION_GUARD_REFERENCE_PREFIXES_V1,
  type InstitutionGuardReferencePrefixV1,
  type SafeGuardReferenceV1,
} from '@/modules/security/server/institution-guard-evidence';

const PROTOCOL_DOMAIN_V1 = 'zmtg.guard-reference.v1';
const HMAC_KEY_BYTES = 32;
const HMAC_TAG_BYTES = 32;
const HMAC_TAG_BASE64URL_LENGTH = 43;
const MAX_VERIFY_ONLY_KEYS = 16;

const CODEC_INPUT_KEYS = Object.freeze(['keyRing', 'now'] as const);
const KEY_RING_KEYS = Object.freeze([
  'currentIssueKey',
  'verifyOnlyKeys',
] as const);
const CURRENT_KEY_KEYS = Object.freeze(['keyVersion', 'keyMaterial'] as const);
const VERIFY_ONLY_KEY_KEYS = Object.freeze([
  'keyVersion',
  'keyMaterial',
  'verifyUntil',
] as const);
const REFERENCE_INPUT_KEYS = Object.freeze([
  'prefix',
  'ownerDomain',
  'tenantId',
  'institutionId',
  'ownerSubject',
] as const);
const VERIFY_INPUT_KEYS = Object.freeze([
  ...REFERENCE_INPUT_KEYS,
  'reference',
] as const);

const OWNER_DOMAIN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u;
const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const REFERENCE_PROFILE =
  /^(usr|mbr|bnd|anc|prf|req|cor|objd|mrv|brv|arv|prv|srv|crv)_v1_k([1-9][0-9]{0,2})_([A-Za-z0-9_-]{43})$/u;

declare const ownerSubjectMarkerV1: unique symbol;
declare class InstitutionGuardReferenceCodecSealV1 {
  private readonly ownerSeal;
}

/**
 * Owner-private raw subject. This module deliberately exports no runtime constructor; an
 * authoritative owner must validate its own non-PII identifier before locally applying this
 * nominal type and must never project that raw value outside its composition root.
 */
export type InstitutionGuardReferenceOwnerSubjectV1 = string & {
  readonly [ownerSubjectMarkerV1]: 'owner_local_non_pii';
};

export type InstitutionGuardReferenceCurrentKeyV1 = Readonly<{
  keyVersion: number;
  keyMaterial: Uint8Array | null;
}>;

export type InstitutionGuardReferenceVerifyOnlyKeyV1 = Readonly<{
  keyVersion: number;
  keyMaterial: Uint8Array | null;
  verifyUntil: string;
}>;

export type InstitutionGuardReferenceKeyRingV1 = Readonly<{
  currentIssueKey: InstitutionGuardReferenceCurrentKeyV1;
  verifyOnlyKeys: readonly InstitutionGuardReferenceVerifyOnlyKeyV1[];
}>;

export type InstitutionGuardReferenceInputV1<
  Prefix extends InstitutionGuardReferencePrefixV1,
> = Readonly<{
  prefix: Prefix;
  ownerDomain: string;
  tenantId: string | null;
  institutionId: string | null;
  ownerSubject: InstitutionGuardReferenceOwnerSubjectV1;
}>;

export type InstitutionGuardReferenceIssueResolutionV1<
  Prefix extends InstitutionGuardReferencePrefixV1,
> =
  | Readonly<{
      kind: 'issued';
      reference: SafeGuardReferenceV1<Prefix>;
    }>
  | Readonly<{
      kind: 'unavailable';
      code: 'guard_reference_unavailable';
    }>;

export type InstitutionGuardReferenceVerificationResolutionV1<
  Prefix extends InstitutionGuardReferencePrefixV1,
> =
  | Readonly<{
      kind: 'verified';
      reference: SafeGuardReferenceV1<Prefix>;
    }>
  | Readonly<{
      kind: 'rejected';
      code: 'guard_reference_invalid';
    }>
  | Readonly<{
      kind: 'unavailable';
      code: 'guard_reference_unavailable';
    }>;

export type InstitutionGuardReferenceCodecV1 =
  InstitutionGuardReferenceCodecSealV1 &
    Readonly<{
      issue: <Prefix extends InstitutionGuardReferencePrefixV1>(
        input: InstitutionGuardReferenceInputV1<Prefix>,
      ) => InstitutionGuardReferenceIssueResolutionV1<Prefix>;
      verify: <Prefix extends InstitutionGuardReferencePrefixV1>(
        input: InstitutionGuardReferenceInputV1<Prefix> &
          Readonly<{ reference: string }>,
      ) => InstitutionGuardReferenceVerificationResolutionV1<Prefix>;
    }>;

type ParsedReferenceInputV1 = Readonly<{
  prefix: InstitutionGuardReferencePrefixV1;
  ownerDomain: string;
  tenantId: string | null;
  institutionId: string | null;
  ownerSubject: InstitutionGuardReferenceOwnerSubjectV1;
}>;

type SnapshottedKeyV1 = Readonly<{
  keyVersion: number;
  keyMaterial: Uint8Array | null;
}>;

type SnapshottedVerifyOnlyKeyV1 = SnapshottedKeyV1 &
  Readonly<{
    verifyUntil: string;
    verifyUntilEpochMs: number;
  }>;

type SnapshottedKeyRingV1 = Readonly<{
  currentIssueKey: SnapshottedKeyV1;
  verifyOnlyKeys: readonly SnapshottedVerifyOnlyKeyV1[];
}>;

const unavailable = Object.freeze({
  kind: 'unavailable',
  code: 'guard_reference_unavailable',
} as const);
const rejected = Object.freeze({
  kind: 'rejected',
  code: 'guard_reference_invalid',
} as const);

function snapshotExactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== 'string') ||
      expectedKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(descriptors, key),
      )
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotExactArray(
  value: unknown,
  maximumLength: number,
): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > maximumLength
    ) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const expectedKeys = [
      ...Array.from({ length: value.length }, (_, index) => String(index)),
      'length',
    ];
    if (
      Reflect.ownKeys(descriptors).length !== expectedKeys.length ||
      expectedKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(descriptors, key),
      )
    ) {
      return null;
    }

    const snapshot: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function isKeyVersion(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 999;
}

function isAcceptedKeyVersion(value: unknown): value is number {
  return (
    isKeyVersion(value) &&
    INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1.some(
      (accepted) => accepted === value,
    )
  );
}

function snapshotKeyMaterial(value: unknown): Uint8Array | null | undefined {
  if (value === null) return null;
  try {
    if (isProxy(value) || !(value instanceof Uint8Array)) return undefined;
    if (value.byteLength !== HMAC_KEY_BYTES) return undefined;
    return new Uint8Array(value);
  } catch {
    return undefined;
  }
}

function parseCanonicalUtcInstant(value: unknown): number | null {
  if (typeof value !== 'string' || !CANONICAL_UTC_INSTANT.test(value)) return null;
  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== value) {
    return null;
  }
  return epochMs;
}

function snapshotCurrentKey(value: unknown): SnapshottedKeyV1 | null {
  const snapshot = snapshotExactPlainRecord(value, CURRENT_KEY_KEYS);
  if (!snapshot || !isAcceptedKeyVersion(snapshot.keyVersion)) return null;
  const keyMaterial = snapshotKeyMaterial(snapshot.keyMaterial);
  if (keyMaterial === undefined) return null;
  return Object.freeze({ keyVersion: snapshot.keyVersion, keyMaterial });
}

function snapshotVerifyOnlyKey(
  value: unknown,
): SnapshottedVerifyOnlyKeyV1 | null {
  const snapshot = snapshotExactPlainRecord(value, VERIFY_ONLY_KEY_KEYS);
  if (!snapshot || !isAcceptedKeyVersion(snapshot.keyVersion)) return null;
  const keyMaterial = snapshotKeyMaterial(snapshot.keyMaterial);
  const verifyUntilEpochMs = parseCanonicalUtcInstant(snapshot.verifyUntil);
  if (
    keyMaterial === undefined ||
    verifyUntilEpochMs === null ||
    typeof snapshot.verifyUntil !== 'string'
  ) {
    return null;
  }
  return Object.freeze({
    keyVersion: snapshot.keyVersion,
    keyMaterial,
    verifyUntil: snapshot.verifyUntil,
    verifyUntilEpochMs,
  });
}

function snapshotKeyRing(value: unknown): SnapshottedKeyRingV1 | null {
  const snapshot = snapshotExactPlainRecord(value, KEY_RING_KEYS);
  if (!snapshot) return null;
  const currentIssueKey = snapshotCurrentKey(snapshot.currentIssueKey);
  const verifyOnlyValues = snapshotExactArray(
    snapshot.verifyOnlyKeys,
    MAX_VERIFY_ONLY_KEYS,
  );
  if (!currentIssueKey || !verifyOnlyValues) return null;

  const verifyOnlyKeys: SnapshottedVerifyOnlyKeyV1[] = [];
  const versions = new Set<number>([currentIssueKey.keyVersion]);
  for (const valueEntry of verifyOnlyValues) {
    const entry = snapshotVerifyOnlyKey(valueEntry);
    if (!entry || versions.has(entry.keyVersion)) return null;
    versions.add(entry.keyVersion);
    verifyOnlyKeys.push(entry);
  }

  return Object.freeze({
    currentIssueKey,
    verifyOnlyKeys: Object.freeze(verifyOnlyKeys),
  });
}

function isReferencePrefix(
  value: unknown,
): value is InstitutionGuardReferencePrefixV1 {
  return INSTITUTION_GUARD_REFERENCE_PREFIXES_V1.some(
    (candidate) => candidate === value,
  );
}

function parseReferenceInput(
  value: unknown,
  expectedKeys: readonly string[],
): ParsedReferenceInputV1 | null {
  const snapshot = snapshotExactPlainRecord(value, expectedKeys);
  if (!snapshot) return null;
  const tenantId = snapshot.tenantId;
  const institutionId = snapshot.institutionId;
  const globalScope = tenantId === null && institutionId === null;
  const tenantScope = isInstitutionScopeIdV1(tenantId) && institutionId === null;
  const institutionScope =
    isInstitutionScopeIdV1(tenantId) &&
    isInstitutionScopeIdV1(institutionId);

  if (
    !isReferencePrefix(snapshot.prefix) ||
    typeof snapshot.ownerDomain !== 'string' ||
    snapshot.ownerDomain.length > 128 ||
    !OWNER_DOMAIN.test(snapshot.ownerDomain) ||
    (!globalScope && !tenantScope && !institutionScope) ||
    !isInstitutionScopeIdV1(snapshot.ownerSubject)
  ) {
    return null;
  }

  return Object.freeze({
    prefix: snapshot.prefix,
    ownerDomain: snapshot.ownerDomain,
    tenantId: tenantId as string | null,
    institutionId: institutionId as string | null,
    ownerSubject:
      snapshot.ownerSubject as InstitutionGuardReferenceOwnerSubjectV1,
  });
}

function encodeLengthPrefixedTuple(fields: readonly string[]): Buffer {
  const encodedFields = fields.map((field) => Buffer.from(field, 'utf8'));
  const totalLength = encodedFields.reduce(
    (total, field) => total + 4 + field.byteLength,
    0,
  );
  const message = Buffer.allocUnsafe(totalLength);
  let offset = 0;
  for (const field of encodedFields) {
    message.writeUInt32BE(field.byteLength, offset);
    offset += 4;
    field.copy(message, offset);
    offset += field.byteLength;
  }
  return message;
}

function canonicalMessage(
  input: ParsedReferenceInputV1,
  keyVersion: number,
): Buffer {
  const scopeKind =
    input.tenantId === null
      ? 'global_scope'
      : input.institutionId === null
        ? 'tenant_scope'
        : 'institution_scope';
  return encodeLengthPrefixedTuple([
    PROTOCOL_DOMAIN_V1,
    input.prefix,
    String(keyVersion),
    input.ownerDomain,
    scopeKind,
    input.tenantId ?? '',
    input.institutionId ?? '',
    input.ownerSubject,
  ]);
}

function computeTag(
  key: Uint8Array,
  input: ParsedReferenceInputV1,
  keyVersion: number,
): Buffer | null {
  try {
    const digest = createHmac('sha256', Buffer.from(key))
      .update(canonicalMessage(input, keyVersion))
      .digest();
    return digest.byteLength === HMAC_TAG_BYTES ? digest : null;
  } catch {
    return null;
  }
}

function trustedNowEpochMs(now: () => Date): number | null {
  try {
    const value = now();
    if (
      value === null ||
      typeof value !== 'object' ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Date.prototype
    ) {
      return null;
    }
    const epochMs = Date.prototype.getTime.call(value);
    return Number.isFinite(epochMs) ? epochMs : null;
  } catch {
    return null;
  }
}

function parseReference(
  value: unknown,
  expectedPrefix: InstitutionGuardReferencePrefixV1,
): Readonly<{
  keyVersion: number;
  reference: string;
  tag: Buffer;
}> | null {
  if (typeof value !== 'string') return null;
  const match = REFERENCE_PROFILE.exec(value);
  if (!match || match[1] !== expectedPrefix) return null;
  const keyVersion = Number(match[2]);
  const encodedTag = match[3];
  if (!isKeyVersion(keyVersion) || !encodedTag) return null;

  try {
    const tag = Buffer.from(encodedTag, 'base64url');
    if (
      tag.byteLength !== HMAC_TAG_BYTES ||
      tag.toString('base64url') !== encodedTag
    ) {
      return null;
    }
    return Object.freeze({ keyVersion, reference: value, tag });
  } catch {
    return null;
  }
}

function issueReference<Prefix extends InstitutionGuardReferencePrefixV1>(
  ring: SnapshottedKeyRingV1 | null,
  value: InstitutionGuardReferenceInputV1<Prefix>,
): InstitutionGuardReferenceIssueResolutionV1<Prefix> {
  const input = parseReferenceInput(value, REFERENCE_INPUT_KEYS);
  if (!ring || !input || !ring.currentIssueKey.keyMaterial) return unavailable;

  const tag = computeTag(
    ring.currentIssueKey.keyMaterial,
    input,
    ring.currentIssueKey.keyVersion,
  );
  if (!tag) return unavailable;
  const encodedTag = tag.toString('base64url');
  if (encodedTag.length !== HMAC_TAG_BASE64URL_LENGTH) return unavailable;

  return Object.freeze({
    kind: 'issued',
    reference:
      `${input.prefix}_v1_k${ring.currentIssueKey.keyVersion}_${encodedTag}` as SafeGuardReferenceV1<Prefix>,
  });
}

function verifyReference<Prefix extends InstitutionGuardReferencePrefixV1>(
  ring: SnapshottedKeyRingV1 | null,
  now: (() => Date) | null,
  value: InstitutionGuardReferenceInputV1<Prefix> &
    Readonly<{ reference: string }>,
): InstitutionGuardReferenceVerificationResolutionV1<Prefix> {
  const input = parseReferenceInput(value, VERIFY_INPUT_KEYS);
  if (!input || !ring || !now) return unavailable;

  const referenceSnapshot = snapshotExactPlainRecord(value, VERIFY_INPUT_KEYS);
  const parsedReference = parseReference(
    referenceSnapshot?.reference,
    input.prefix,
  );
  if (!parsedReference) return rejected;

  let key: SnapshottedKeyV1 | null = null;
  if (parsedReference.keyVersion === ring.currentIssueKey.keyVersion) {
    key = ring.currentIssueKey;
  } else {
    const oldKey = ring.verifyOnlyKeys.find(
      (candidate) => candidate.keyVersion === parsedReference.keyVersion,
    );
    if (!oldKey) return rejected;
    const nowEpochMs = trustedNowEpochMs(now);
    if (nowEpochMs === null) return unavailable;
    if (nowEpochMs >= oldKey.verifyUntilEpochMs) return rejected;
    key = oldKey;
  }

  if (!key.keyMaterial) return unavailable;
  const expectedTag = computeTag(key.keyMaterial, input, key.keyVersion);
  if (!expectedTag) return unavailable;

  try {
    if (!timingSafeEqual(parsedReference.tag, expectedTag)) return rejected;
  } catch {
    return unavailable;
  }

  return Object.freeze({
    kind: 'verified',
    reference: parsedReference.reference as SafeGuardReferenceV1<Prefix>,
  });
}

/**
 * Creates a server-runtime codec from an already resolved in-memory key ring. This boundary does
 * not load configuration and deliberately has no default key or fallback source.
 */
export function createInstitutionGuardReferenceCodecV1(input: Readonly<{
  keyRing: InstitutionGuardReferenceKeyRingV1;
  now: () => Date;
}>): InstitutionGuardReferenceCodecV1 {
  const snapshot = snapshotExactPlainRecord(input, CODEC_INPUT_KEYS);
  const ring = snapshot ? snapshotKeyRing(snapshot.keyRing) : null;
  const now =
    snapshot && typeof snapshot.now === 'function'
      ? (snapshot.now as () => Date)
      : null;

  return Object.freeze({
    issue: <Prefix extends InstitutionGuardReferencePrefixV1>(
      value: InstitutionGuardReferenceInputV1<Prefix>,
    ) => issueReference(ring, value),
    verify: <Prefix extends InstitutionGuardReferencePrefixV1>(
      value: InstitutionGuardReferenceInputV1<Prefix> &
        Readonly<{ reference: string }>,
    ) => verifyReference(ring, now, value),
  }) as unknown as InstitutionGuardReferenceCodecV1;
}
