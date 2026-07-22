import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { isProxy } from 'node:util/types';

import { isInstitutionScopeIdV1 } from '@/modules/security/domain/institution-access';
import {
  createFormalRequestProvenanceResolverFromOwnerResolutionV1,
  isFormalProvenanceResolverV1,
  type FormalRequestProvenanceOwnerInputV1,
  type FormalRequestProvenanceOwnerResolutionV1,
} from '@/modules/security/server/formal-request-provenance-owner';
import {
  type FormalProvenanceResolverV1,
  type FreshActiveMembershipProviderV1,
} from '@/modules/security/server/institution-guard-evidence';
import type { InstitutionGuardReferenceCodecV1 } from '@/modules/security/server/institution-guard-reference';
import {
  createRequestBoundFreshActiveMembershipProviderV1,
  isFreshActiveMembershipProviderV1,
  type AuthoritativeInstitutionMembershipFactReaderV1,
} from '@/modules/security/server/institution-membership-provider';

export const FORMAL_SERVER_SESSION_COOKIE_V1 =
  'zmtg_server_session_v1' as const;

const DEMO_SESSION_COOKIE = 'zmtg_demo_session';
const PROTOCOL_DOMAIN_V1 = 'zmtg.formal-server-session-cookie.v1';
const HMAC_KEY_BYTES = 32;
const HMAC_TAG_BYTES = 32;
const HMAC_TAG_BASE64URL_LENGTH = 43;
const MAX_COOKIE_HEADER_LENGTH = 8_192;
const MAX_COOKIE_VALUE_LENGTH = 4_096;
const MAX_COOKIE_PARTS = 64;
const MAX_VERIFY_ONLY_KEYS = 16;
const MAX_SESSION_TTL_MS = 8 * 60 * 60 * 1_000;
const PROVENANCE_TTL_MS = 5 * 60 * 1_000;

const FACTORY_INPUT_KEYS = Object.freeze([
  'cookieHeader',
  'sessionKeyRing',
  'referenceCodec',
  'now',
] as const);
const REQUEST_OWNER_FACTORY_INPUT_KEYS = Object.freeze([
  'cookieHeader',
  'sessionKeyRing',
  'membershipFactReader',
  'referenceCodec',
  'now',
] as const);
const KEY_RING_KEYS = Object.freeze(['currentKey', 'verifyOnlyKeys'] as const);
const CURRENT_KEY_KEYS = Object.freeze(['keyVersion', 'keyMaterial'] as const);
const VERIFY_ONLY_KEY_KEYS = Object.freeze([
  'keyVersion',
  'keyMaterial',
  'verifyUntil',
] as const);
const PAYLOAD_KEYS = Object.freeze([
  'source',
  'sessionId',
  'accountId',
  'tenantId',
  'institutionId',
  'issuedAt',
  'expiresAt',
] as const);
const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const TOKEN_PROFILE =
  /^v1\.k([1-9][0-9]{0,2})\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;

export type FormalServerSessionCurrentKeyV1 = Readonly<{
  keyVersion: number;
  keyMaterial: Uint8Array | null;
}>;

export type FormalServerSessionVerifyOnlyKeyV1 = Readonly<{
  keyVersion: number;
  keyMaterial: Uint8Array | null;
  verifyUntil: string;
}>;

export type FormalServerSessionKeyRingV1 = Readonly<{
  currentKey: FormalServerSessionCurrentKeyV1;
  verifyOnlyKeys: readonly FormalServerSessionVerifyOnlyKeyV1[];
}>;

type SnapshotKeyV1 = Readonly<{
  keyVersion: number;
  keyMaterial: Uint8Array | null;
}>;

type SnapshotVerifyOnlyKeyV1 = SnapshotKeyV1 &
  Readonly<{
    verifyUntil: string;
    verifyUntilEpochMs: number;
  }>;

type SnapshotKeyRingV1 = Readonly<{
  currentKey: SnapshotKeyV1;
  verifyOnlyKeys: readonly SnapshotVerifyOnlyKeyV1[];
}>;

type ParsedPayloadV1 = Readonly<{
  sessionId: string;
  accountId: string;
  tenantId: string;
  institutionId: string;
  issuedAt: string;
  issuedAtEpochMs: number;
  expiresAt: string;
  expiresAtEpochMs: number;
}>;

type ParsedTokenV1 = Readonly<{
  keyVersion: number;
  payloadSegment: string;
  tagSegment: string;
}>;

type OwnerFailureResolutionV1 = Extract<
  FormalRequestProvenanceOwnerResolutionV1,
  { kind: 'rejected' | 'unavailable' }
>;

declare const formalServerSessionRequestOwnerMarkerV1: unique symbol;

export type FormalServerSessionRequestOwnerV1 = Readonly<{
  readonly [formalServerSessionRequestOwnerMarkerV1]: 'formal_server_session_request_owner_v1';
}>;

export type FormalServerSessionRequestOwnerConsumptionV1 = Readonly<{
  provenanceResolver: FormalProvenanceResolverV1;
  membershipProvider: FreshActiveMembershipProviderV1;
}>;

const formalServerSessionRequestOwnerHandlesV1 = new WeakSet<object>();
const formalServerSessionRequestOwnerConsumptionsV1 = new WeakMap<
  object,
  FormalServerSessionRequestOwnerConsumptionV1
>();

const missing = Object.freeze({
  kind: 'rejected',
  code: 'provenance_missing',
} as const);
const invalid = Object.freeze({
  kind: 'rejected',
  code: 'provenance_invalid',
} as const);
const expired = Object.freeze({
  kind: 'rejected',
  code: 'provenance_expired',
} as const);
const sourceDenied = Object.freeze({
  kind: 'rejected',
  code: 'provenance_source_denied',
} as const);
const unavailable = Object.freeze({
  kind: 'unavailable',
  code: 'provenance_unavailable',
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

function parseCanonicalUtcInstant(
  value: unknown,
): Readonly<{ raw: string; epochMs: number }> | null {
  if (typeof value !== 'string' || !CANONICAL_UTC_INSTANT.test(value)) {
    return null;
  }
  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== value) {
    return null;
  }
  return Object.freeze({ raw: value, epochMs });
}

function trustedDateEpochMs(value: unknown): number | null {
  try {
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

function snapshotKeyMaterial(value: unknown): Uint8Array | null | undefined {
  try {
    if (value === null) return null;
    if (
      typeof value !== 'object' ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Uint8Array.prototype
    ) {
      return undefined;
    }
    const bytes = value as Uint8Array;
    if (bytes.byteLength !== HMAC_KEY_BYTES) return undefined;
    return Uint8Array.from(bytes);
  } catch {
    return undefined;
  }
}

function isKeyVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 999;
}

function snapshotCurrentKey(value: unknown): SnapshotKeyV1 | null {
  const snapshot = snapshotExactPlainRecord(value, CURRENT_KEY_KEYS);
  if (!snapshot || !isKeyVersion(snapshot.keyVersion)) return null;
  const keyMaterial = snapshotKeyMaterial(snapshot.keyMaterial);
  if (keyMaterial === undefined) return null;
  return Object.freeze({
    keyVersion: snapshot.keyVersion,
    keyMaterial,
  });
}

function snapshotVerifyOnlyKey(value: unknown): SnapshotVerifyOnlyKeyV1 | null {
  const snapshot = snapshotExactPlainRecord(value, VERIFY_ONLY_KEY_KEYS);
  if (!snapshot || !isKeyVersion(snapshot.keyVersion)) return null;
  const keyMaterial = snapshotKeyMaterial(snapshot.keyMaterial);
  const verifyUntil = parseCanonicalUtcInstant(snapshot.verifyUntil);
  if (keyMaterial === undefined || !verifyUntil) return null;
  return Object.freeze({
    keyVersion: snapshot.keyVersion,
    keyMaterial,
    verifyUntil: verifyUntil.raw,
    verifyUntilEpochMs: verifyUntil.epochMs,
  });
}

function snapshotDenseArray(value: unknown): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > MAX_VERIFY_ONLY_KEYS
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.some((key) => typeof key !== 'string') ||
      ownKeys.length !== value.length + 1 ||
      !Object.prototype.hasOwnProperty.call(descriptors, 'length')
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

function snapshotKeyRing(value: unknown): SnapshotKeyRingV1 | null {
  const snapshot = snapshotExactPlainRecord(value, KEY_RING_KEYS);
  if (!snapshot) return null;
  const currentKey = snapshotCurrentKey(snapshot.currentKey);
  const verifyOnlyValues = snapshotDenseArray(snapshot.verifyOnlyKeys);
  if (!currentKey || !verifyOnlyValues) return null;
  const verifyOnlyKeys: SnapshotVerifyOnlyKeyV1[] = [];
  const versions = new Set([currentKey.keyVersion]);
  for (const candidate of verifyOnlyValues) {
    const key = snapshotVerifyOnlyKey(candidate);
    if (
      !key ||
      versions.has(key.keyVersion) ||
      key.keyVersion >= currentKey.keyVersion
    ) {
      return null;
    }
    versions.add(key.keyVersion);
    verifyOnlyKeys.push(key);
  }
  return Object.freeze({
    currentKey,
    verifyOnlyKeys: Object.freeze(verifyOnlyKeys),
  });
}

function findVerificationKey(
  keyRing: SnapshotKeyRingV1,
  keyVersion: number,
): SnapshotKeyV1 | SnapshotVerifyOnlyKeyV1 | null {
  if (keyRing.currentKey.keyVersion === keyVersion) return keyRing.currentKey;
  return keyRing.verifyOnlyKeys.find(
    (candidate) => candidate.keyVersion === keyVersion,
  ) ?? null;
}

function readFormalCookie(
  cookieHeader: string | null,
): OwnerFailureResolutionV1 | string {
  if (cookieHeader === null || cookieHeader.length === 0) return missing;
  if (cookieHeader.length > MAX_COOKIE_HEADER_LENGTH) return invalid;
  const parts = cookieHeader.split(';');
  if (parts.length > MAX_COOKIE_PARTS) return invalid;

  let demoPresent = false;
  const formalValues: string[] = [];
  for (const rawPart of parts) {
    const part = rawPart.trim();
    const separator = part.indexOf('=');
    const name = (separator < 0 ? part : part.slice(0, separator)).trim();
    if (name === DEMO_SESSION_COOKIE) {
      demoPresent = true;
      continue;
    }
    if (separator <= 0) continue;
    if (name === FORMAL_SERVER_SESSION_COOKIE_V1) {
      formalValues.push(part.slice(separator + 1));
    }
  }

  if (demoPresent) return sourceDenied;
  if (formalValues.length === 0) return missing;
  if (formalValues.length !== 1) return invalid;
  const formalValue = formalValues[0];
  if (!formalValue || formalValue.length > MAX_COOKIE_VALUE_LENGTH) return invalid;
  return formalValue;
}

function decodeCanonicalBase64Url(value: string): Uint8Array | null {
  try {
    if (!value || !BASE64URL.test(value)) return null;
    const decoded = Buffer.from(value, 'base64url');
    if (decoded.length === 0 || decoded.toString('base64url') !== value) return null;
    return Uint8Array.from(decoded);
  } catch {
    return null;
  }
}

function parsePayload(payloadSegment: string): ParsedPayloadV1 | null {
  const decoded = decodeCanonicalBase64Url(payloadSegment);
  if (!decoded) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(decoded).toString('utf8')) as unknown;
  } catch {
    return null;
  }
  const snapshot = snapshotExactPlainRecord(parsed, PAYLOAD_KEYS);
  if (!snapshot || snapshot.source !== 'server_session') return null;
  for (const key of [
    'sessionId',
    'accountId',
    'tenantId',
    'institutionId',
  ] as const) {
    if (!isInstitutionScopeIdV1(snapshot[key])) return null;
  }
  const issuedAt = parseCanonicalUtcInstant(snapshot.issuedAt);
  const expiresAt = parseCanonicalUtcInstant(snapshot.expiresAt);
  if (
    !issuedAt ||
    !expiresAt ||
    expiresAt.epochMs <= issuedAt.epochMs ||
    expiresAt.epochMs - issuedAt.epochMs > MAX_SESSION_TTL_MS
  ) {
    return null;
  }

  const canonical = JSON.stringify({
    source: 'server_session',
    sessionId: snapshot.sessionId,
    accountId: snapshot.accountId,
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
    issuedAt: issuedAt.raw,
    expiresAt: expiresAt.raw,
  });
  if (Buffer.from(canonical).toString('base64url') !== payloadSegment) return null;

  return Object.freeze({
    sessionId: snapshot.sessionId as string,
    accountId: snapshot.accountId as string,
    tenantId: snapshot.tenantId as string,
    institutionId: snapshot.institutionId as string,
    issuedAt: issuedAt.raw,
    issuedAtEpochMs: issuedAt.epochMs,
    expiresAt: expiresAt.raw,
    expiresAtEpochMs: expiresAt.epochMs,
  });
}

function parseToken(token: string): ParsedTokenV1 | null {
  const match = TOKEN_PROFILE.exec(token);
  if (!match) return null;
  const keyVersion = Number(match[1]);
  const payloadSegment = match[2];
  const tagSegment = match[3];
  if (
    !isKeyVersion(keyVersion) ||
    !payloadSegment ||
    !tagSegment ||
    tagSegment.length !== HMAC_TAG_BASE64URL_LENGTH
  ) {
    return null;
  }
  return Object.freeze({ keyVersion, payloadSegment, tagSegment });
}

function verifyToken(
  token: ParsedTokenV1,
  key: SnapshotKeyV1 | SnapshotVerifyOnlyKeyV1,
  nowEpochMs: number,
):
  | Readonly<{ kind: 'verified'; payload: ParsedPayloadV1 }>
  | OwnerFailureResolutionV1 {
  if (
    'verifyUntilEpochMs' in key &&
    nowEpochMs >= key.verifyUntilEpochMs
  ) {
    return invalid;
  }
  if (!key.keyMaterial) return unavailable;

  const suppliedTag = decodeCanonicalBase64Url(token.tagSegment);
  if (!suppliedTag || suppliedTag.byteLength !== HMAC_TAG_BYTES) return invalid;
  let expectedTag: Uint8Array;
  try {
    expectedTag = createHmac('sha256', key.keyMaterial)
      .update(
        `${PROTOCOL_DOMAIN_V1}\n${token.keyVersion}\n${token.payloadSegment}`,
      )
      .digest();
    if (!timingSafeEqual(expectedTag, suppliedTag)) return invalid;
  } catch {
    return unavailable;
  }

  const parsedPayload = parsePayload(token.payloadSegment);
  return parsedPayload
    ? Object.freeze({ kind: 'verified', payload: parsedPayload })
    : invalid;
}

function resolveSessionOwner(
  token: ParsedTokenV1,
  key: SnapshotKeyV1 | SnapshotVerifyOnlyKeyV1,
  nowEpochMs: number,
): FormalRequestProvenanceOwnerResolutionV1 {
  const verification = verifyToken(token, key, nowEpochMs);
  if (verification.kind !== 'verified') return verification;
  const session = verification.payload;
  if (session.issuedAtEpochMs > nowEpochMs) return invalid;
  if (nowEpochMs >= session.expiresAtEpochMs) return expired;

  const proofValidUntilEpochMs = Math.min(
    session.expiresAtEpochMs,
    nowEpochMs + PROVENANCE_TTL_MS,
  );
  if (!Number.isFinite(proofValidUntilEpochMs)) return unavailable;
  let requestIdentifier: string;
  try {
    requestIdentifier = randomUUID();
  } catch {
    return unavailable;
  }
  if (!isInstitutionScopeIdV1(requestIdentifier)) return unavailable;

  const ownerInput = Object.freeze({
    source: 'server_session',
    accountId: session.accountId,
    tenantId: session.tenantId,
    institutionId: session.institutionId,
    requestIdentifier,
    proofIdentifier: session.sessionId,
    issuedAt: new Date(nowEpochMs).toISOString(),
    proofValidUntil: new Date(proofValidUntilEpochMs).toISOString(),
  }) as unknown as FormalRequestProvenanceOwnerInputV1;
  return Object.freeze({ kind: 'verified', ownerInput });
}

type SessionOwnerCompositionV1 = Readonly<{
  ownerResolution: FormalRequestProvenanceOwnerResolutionV1;
  referenceCodec: InstitutionGuardReferenceCodecV1 | null;
  now: (() => Date) | null;
  nowEpochMs: number | null;
}>;

function composeSessionOwnerResolutionV1(
  input: unknown,
  expectedKeys: readonly string[],
): SessionOwnerCompositionV1 {
  const composition = snapshotExactPlainRecord(input, expectedKeys);
  const cookieHeader = composition?.cookieHeader;
  if (
    !composition ||
    (typeof cookieHeader !== 'string' && cookieHeader !== null)
  ) {
    return Object.freeze({
      ownerResolution: unavailable,
      referenceCodec: null,
      now: null,
      nowEpochMs: null,
    });
  }
  const cookie = readFormalCookie(cookieHeader);
  if (typeof cookie !== 'string') {
    return Object.freeze({
      ownerResolution: cookie,
      referenceCodec: composition.referenceCodec as InstitutionGuardReferenceCodecV1,
      now: null,
      nowEpochMs: null,
    });
  }

  const keyRing = snapshotKeyRing(composition.sessionKeyRing);
  if (!keyRing) {
    return Object.freeze({
      ownerResolution: unavailable,
      referenceCodec: composition.referenceCodec as InstitutionGuardReferenceCodecV1,
      now: null,
      nowEpochMs: null,
    });
  }
  const parsedToken = parseToken(cookie);
  if (!parsedToken) {
    return Object.freeze({
      ownerResolution: invalid,
      referenceCodec: composition.referenceCodec as InstitutionGuardReferenceCodecV1,
      now: null,
      nowEpochMs: null,
    });
  }
  const verificationKey = findVerificationKey(
    keyRing,
    parsedToken.keyVersion,
  );
  if (!verificationKey) {
    return Object.freeze({
      ownerResolution: invalid,
      referenceCodec: composition.referenceCodec as InstitutionGuardReferenceCodecV1,
      now: null,
      nowEpochMs: null,
    });
  }

  const now = composition.now;
  let nowEpochMs: number | null = null;
  if (typeof now === 'function' && !isProxy(now)) {
    try {
      nowEpochMs = trustedDateEpochMs(now());
    } catch {
      nowEpochMs = null;
    }
  }

  const ownerResolution =
    nowEpochMs !== null
      ? resolveSessionOwner(parsedToken, verificationKey, nowEpochMs)
      : unavailable;
  return Object.freeze({
    ownerResolution,
    referenceCodec: composition.referenceCodec as InstitutionGuardReferenceCodecV1,
    now: typeof now === 'function' && !isProxy(now) ? (now as () => Date) : null,
    nowEpochMs,
  });
}

function provenanceResolverFromCompositionV1(
  composition: SessionOwnerCompositionV1,
): FormalProvenanceResolverV1 {
  const ownerResolution = composition.ownerResolution;
  if (ownerResolution.kind !== 'verified') {
    return createFormalRequestProvenanceResolverFromOwnerResolutionV1({
      ownerResolution,
    });
  }
  if (composition.nowEpochMs === null) {
    return createFormalRequestProvenanceResolverFromOwnerResolutionV1({
      ownerResolution: unavailable,
    });
  }
  return createFormalRequestProvenanceResolverFromOwnerResolutionV1({
    ownerResolution,
    referenceCodec: composition.referenceCodec as InstitutionGuardReferenceCodecV1,
    now: () => new Date(composition.nowEpochMs as number),
  });
}

/**
 * Verifies one formal server-session cookie snapshot and returns a genuine central provenance
 * resolver. No caller supplies scope, subject, source, proof, request identifier, or timestamps.
 */
export function createFormalServerSessionProvenanceResolverV1(
  input: Readonly<{
    cookieHeader: string | null;
    sessionKeyRing: FormalServerSessionKeyRingV1;
    referenceCodec: InstitutionGuardReferenceCodecV1;
    now: () => Date;
  }>,
): FormalProvenanceResolverV1 {
  return provenanceResolverFromCompositionV1(
    composeSessionOwnerResolutionV1(input, FACTORY_INPUT_KEYS),
  );
}

/**
 * Auth-owner composition root. The returned handle is opaque and single-use; raw session and
 * account facts never leave this module. Invalid dependencies still yield an authentic handle
 * whose two genuine child handles fail closed.
 */
export function createFormalServerSessionRequestOwnerV1(input: Readonly<{
  cookieHeader: string | null;
  sessionKeyRing: FormalServerSessionKeyRingV1;
  membershipFactReader: AuthoritativeInstitutionMembershipFactReaderV1;
  referenceCodec: InstitutionGuardReferenceCodecV1;
  now: () => Date;
}>): FormalServerSessionRequestOwnerV1 {
  const inputSnapshot = snapshotExactPlainRecord(
    input,
    REQUEST_OWNER_FACTORY_INPUT_KEYS,
  );
  const composition = composeSessionOwnerResolutionV1(
    input,
    REQUEST_OWNER_FACTORY_INPUT_KEYS,
  );
  const provenanceResolver = provenanceResolverFromCompositionV1(composition);
  const accountId =
    composition.ownerResolution.kind === 'verified'
      ? composition.ownerResolution.ownerInput.accountId
      : '';
  const membershipProvider = createRequestBoundFreshActiveMembershipProviderV1({
    accountId,
    factReader: inputSnapshot?.membershipFactReader as AuthoritativeInstitutionMembershipFactReaderV1,
    referenceCodec: composition.referenceCodec as InstitutionGuardReferenceCodecV1,
    now: composition.now as () => Date,
  });
  const consumption = Object.freeze({
    provenanceResolver,
    membershipProvider,
  });
  const owner = Object.freeze({}) as FormalServerSessionRequestOwnerV1;
  if (
    !isFormalProvenanceResolverV1(provenanceResolver) ||
    !isFreshActiveMembershipProviderV1(membershipProvider)
  ) {
    return owner;
  }
  formalServerSessionRequestOwnerHandlesV1.add(owner);
  formalServerSessionRequestOwnerConsumptionsV1.set(owner, consumption);
  return owner;
}

export function isFormalServerSessionRequestOwnerV1(
  value: unknown,
): value is FormalServerSessionRequestOwnerV1 {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !isProxy(value) &&
      formalServerSessionRequestOwnerHandlesV1.has(value)
    );
  } catch {
    return false;
  }
}

export function consumeFormalServerSessionRequestOwnerV1(
  value: unknown,
): FormalServerSessionRequestOwnerConsumptionV1 | null {
  if (!isFormalServerSessionRequestOwnerV1(value)) return null;
  const consumption = formalServerSessionRequestOwnerConsumptionsV1.get(value);
  if (!consumption) return null;
  formalServerSessionRequestOwnerConsumptionsV1.delete(value);
  return consumption;
}
