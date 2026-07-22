import { isProxy } from 'node:util/types';

import type { FormalServerSessionKeyRingV1 } from '@/modules/auth/server/formal-server-session-provenance-owner';
import {
  INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1,
} from '@/modules/security/server/institution-guard-evidence';
import type { InstitutionGuardReferenceKeyRingV1 } from '@/modules/security/server/institution-guard-reference';

const ENVIRONMENT_KEYS = Object.freeze([
  'ZMTG_FORMAL_SESSION_HMAC_KEY_VERSION',
  'ZMTG_FORMAL_SESSION_HMAC_KEY_BASE64URL',
  'ZMTG_FORMAL_SESSION_HMAC_VERIFY_ONLY_JSON',
  'ZMTG_INSTITUTION_GUARD_HMAC_KEY_VERSION',
  'ZMTG_INSTITUTION_GUARD_HMAC_KEY_BASE64URL',
  'ZMTG_INSTITUTION_GUARD_HMAC_VERIFY_ONLY_JSON',
] as const);
const INPUT_KEYS = Object.freeze(['environment', 'now'] as const);
const VERIFY_ONLY_KEY_KEYS = Object.freeze([
  'keyVersion',
  'keyMaterialBase64Url',
  'verifyUntil',
] as const);
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const CANONICAL_KEY_VERSION = /^[1-9][0-9]{0,2}$/u;
const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const HMAC_KEY_BYTES = 32;
const MAX_VERIFY_ONLY_KEYS = 16;

type RuntimeEnvironmentKeyV1 = (typeof ENVIRONMENT_KEYS)[number];
type RuntimeEnvironmentV1 = Readonly<Record<RuntimeEnvironmentKeyV1, string | undefined>>;

export type InstitutionGuardRuntimeConfigResolutionV1 =
  | Readonly<{
      kind: 'available';
      formalServerSessionKeyRing: FormalServerSessionKeyRingV1;
      institutionGuardReferenceKeyRing: InstitutionGuardReferenceKeyRingV1;
    }>
  | Readonly<{ kind: 'unavailable' }>;

export type InstitutionGuardRuntimeConfigInputV1 = Readonly<{
  environment: RuntimeEnvironmentV1;
  now: () => Date;
}>;

type VerifyOnlyKeyV1 = Readonly<{
  keyVersion: number;
  keyMaterial: Uint8Array;
  verifyUntil: string;
}>;

const unavailable = Object.freeze({ kind: 'unavailable' } as const);

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
      expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(descriptors, key))
    ) {
      return null;
    }
    const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
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

function snapshotEnvironment(value: unknown): RuntimeEnvironmentV1 | null {
  const snapshot = snapshotExactPlainRecord(value, ENVIRONMENT_KEYS);
  if (!snapshot) return null;
  const environment: Record<RuntimeEnvironmentKeyV1, string | undefined> = Object.create(null) as Record<
    RuntimeEnvironmentKeyV1,
    string | undefined
  >;
  for (const key of ENVIRONMENT_KEYS) {
    const item = snapshot[key];
    if (item !== undefined && typeof item !== 'string') return null;
    environment[key] = item;
  }
  return Object.freeze(environment);
}

function readDefaultEnvironment(): RuntimeEnvironmentV1 | null {
  try {
    const environment: Record<RuntimeEnvironmentKeyV1, string | undefined> = Object.create(null) as Record<
      RuntimeEnvironmentKeyV1,
      string | undefined
    >;
    for (const key of ENVIRONMENT_KEYS) environment[key] = process.env[key];
    return Object.freeze(environment);
  } catch {
    return null;
  }
}

function readDefaultNowEpochMs(): number | null {
  try {
    const epochMs = Date.now();
    return Number.isFinite(epochMs) ? epochMs : null;
  } catch {
    return null;
  }
}

function parseKeyVersion(
  value: unknown,
  requireAcceptedVersion: boolean,
  fromEnvironment: boolean,
): number | null {
  if (fromEnvironment && (typeof value !== 'string' || !CANONICAL_KEY_VERSION.test(value))) {
    return null;
  }
  if (!fromEnvironment && typeof value !== 'number') return null;
  const keyVersion = Number(value);
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1 || keyVersion > 999) return null;
  if (
    requireAcceptedVersion &&
    !INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1.some((accepted) => accepted === keyVersion)
  ) {
    return null;
  }
  return keyVersion;
}

function decodeCanonicalBase64UrlKey(value: unknown): Uint8Array | null {
  try {
    if (typeof value !== 'string' || !BASE64URL.test(value)) return null;
    const bytes = Buffer.from(value, 'base64url');
    if (bytes.byteLength !== HMAC_KEY_BYTES || bytes.toString('base64url') !== value) return null;
    return Uint8Array.from(bytes);
  } catch {
    return null;
  }
}

function parseCanonicalFutureInstant(value: unknown, nowEpochMs: number): string | null {
  if (typeof value !== 'string' || !CANONICAL_UTC_INSTANT.test(value)) return null;
  const epochMs = Date.parse(value);
  if (
    !Number.isFinite(epochMs) ||
    new Date(epochMs).toISOString() !== value ||
    epochMs <= nowEpochMs
  ) {
    return null;
  }
  return value;
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
    if (
      Reflect.ownKeys(descriptors).length !== value.length + 1 ||
      !Object.prototype.hasOwnProperty.call(descriptors, 'length')
    ) {
      return null;
    }
    const snapshot: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function parseVerifyOnlyKeys(
  value: unknown,
  nowEpochMs: number,
  requireAcceptedVersion: boolean,
  currentKeyVersion: number,
  requireOlderVersion: boolean,
): readonly VerifyOnlyKeyV1[] | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return null;
  }
  const entries = snapshotDenseArray(parsed);
  if (!entries) return null;
  const versions = new Set<number>([currentKeyVersion]);
  const keys: VerifyOnlyKeyV1[] = [];
  for (const entry of entries) {
    const snapshot = snapshotExactPlainRecord(entry, VERIFY_ONLY_KEY_KEYS);
    if (!snapshot) return null;
    const keyVersion = parseKeyVersion(snapshot.keyVersion, requireAcceptedVersion, false);
    const keyMaterial = decodeCanonicalBase64UrlKey(snapshot.keyMaterialBase64Url);
    const verifyUntil = parseCanonicalFutureInstant(snapshot.verifyUntil, nowEpochMs);
    if (
      keyVersion === null ||
      keyMaterial === null ||
      verifyUntil === null ||
      versions.has(keyVersion) ||
      (requireOlderVersion && keyVersion >= currentKeyVersion)
    ) {
      return null;
    }
    versions.add(keyVersion);
    keys.push(Object.freeze({ keyVersion, keyMaterial, verifyUntil }));
  }
  return Object.freeze(keys);
}

function trustedNowEpochMs(now: unknown): number | null {
  if (typeof now !== 'function' || isProxy(now)) return null;
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

function resolveRuntimeConfig(
  environment: RuntimeEnvironmentV1,
  nowEpochMs: number,
): InstitutionGuardRuntimeConfigResolutionV1 {
  const formalCurrentVersion = parseKeyVersion(
    environment.ZMTG_FORMAL_SESSION_HMAC_KEY_VERSION,
    false,
    true,
  );
  const formalCurrentMaterial = decodeCanonicalBase64UrlKey(
    environment.ZMTG_FORMAL_SESSION_HMAC_KEY_BASE64URL,
  );
  const guardCurrentVersion = parseKeyVersion(
    environment.ZMTG_INSTITUTION_GUARD_HMAC_KEY_VERSION,
    true,
    true,
  );
  const guardCurrentMaterial = decodeCanonicalBase64UrlKey(
    environment.ZMTG_INSTITUTION_GUARD_HMAC_KEY_BASE64URL,
  );
  if (
    formalCurrentVersion === null ||
    formalCurrentMaterial === null ||
    guardCurrentVersion === null ||
    guardCurrentMaterial === null
  ) {
    return unavailable;
  }
  const formalVerifyOnlyKeys = parseVerifyOnlyKeys(
    environment.ZMTG_FORMAL_SESSION_HMAC_VERIFY_ONLY_JSON,
    nowEpochMs,
    false,
    formalCurrentVersion,
    true,
  );
  const guardVerifyOnlyKeys = parseVerifyOnlyKeys(
    environment.ZMTG_INSTITUTION_GUARD_HMAC_VERIFY_ONLY_JSON,
    nowEpochMs,
    true,
    guardCurrentVersion,
    false,
  );
  if (!formalVerifyOnlyKeys || !guardVerifyOnlyKeys) return unavailable;

  return Object.freeze({
    kind: 'available' as const,
    formalServerSessionKeyRing: Object.freeze({
      currentKey: Object.freeze({ keyVersion: formalCurrentVersion, keyMaterial: formalCurrentMaterial }),
      verifyOnlyKeys: Object.freeze(
        formalVerifyOnlyKeys.map((key) =>
          Object.freeze({
            keyVersion: key.keyVersion,
            keyMaterial: key.keyMaterial,
            verifyUntil: key.verifyUntil,
          }),
        ),
      ),
    }),
    institutionGuardReferenceKeyRing: Object.freeze({
      currentIssueKey: Object.freeze({ keyVersion: guardCurrentVersion, keyMaterial: guardCurrentMaterial }),
      verifyOnlyKeys: Object.freeze(
        guardVerifyOnlyKeys.map((key) =>
          Object.freeze({
            keyVersion: key.keyVersion,
            keyMaterial: key.keyMaterial,
            verifyUntil: key.verifyUntil,
          }),
        ),
      ),
    }),
  });
}

/**
 * Resolves only the two opaque server key rings. Invalid configuration is deliberately
 * indistinguishable and never falls back to demo-session material or a default secret.
 */
export function resolveInstitutionGuardRuntimeConfigV1(
  input?: InstitutionGuardRuntimeConfigInputV1,
): InstitutionGuardRuntimeConfigResolutionV1 {
  if (input === undefined) {
    const environment = readDefaultEnvironment();
    const nowEpochMs = readDefaultNowEpochMs();
    if (!environment || nowEpochMs === null) return unavailable;
    return resolveRuntimeConfig(environment, nowEpochMs);
  }
  const snapshot = snapshotExactPlainRecord(input, INPUT_KEYS);
  const environment = snapshotEnvironment(snapshot?.environment);
  const nowEpochMs = trustedNowEpochMs(snapshot?.now);
  if (!environment || nowEpochMs === null) return unavailable;
  return resolveRuntimeConfig(environment, nowEpochMs);
}
