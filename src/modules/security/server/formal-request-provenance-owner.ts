import { isProxy } from 'node:util/types';

import {
  isInstitutionAccessContextSourceV1,
  isInstitutionScopeIdV1,
  type InstitutionAccessContextSourceV1,
} from '@/modules/security/domain/institution-access';
import {
  isGuardReferenceCandidateV1,
  type FormalProvenanceResolverV1,
  type FormalRequestProvenanceEvidenceV1,
  type InstitutionGuardReferencePrefixV1,
  type ProvenanceResolutionV1,
  type SafeGuardReferenceV1,
} from '@/modules/security/server/institution-guard-evidence';
import {
  isInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceOwnerSubjectV1,
} from '@/modules/security/server/institution-guard-reference';

const AUTH_ACCOUNT_OWNER_DOMAIN_V1 = 'zmtg.auth-account.v1';
const SOURCE_OWNER_DOMAINS_V1 = Object.freeze({
  server_session: 'zmtg.formal-provenance.server-session.v1',
  trusted_gateway: 'zmtg.formal-provenance.trusted-gateway.v1',
} as const satisfies Readonly<Record<InstitutionAccessContextSourceV1, string>>);
const MAX_PROVENANCE_TTL_MS = 5 * 60 * 1_000;

const COMPOSER_INPUT_KEYS = Object.freeze([
  'ownerInput',
  'referenceCodec',
  'now',
] as const);
const RESOLUTION_COMPOSER_INPUT_KEYS = Object.freeze([
  'ownerResolution',
  'referenceCodec',
  'now',
] as const);
const FAILURE_RESOLUTION_COMPOSER_INPUT_KEYS = Object.freeze([
  'ownerResolution',
] as const);
const VERIFIED_OWNER_RESOLUTION_KEYS = Object.freeze([
  'kind',
  'ownerInput',
] as const);
const FAILURE_OWNER_RESOLUTION_KEYS = Object.freeze(['kind', 'code'] as const);
const OWNER_INPUT_KEYS = Object.freeze([
  'source',
  'accountId',
  'tenantId',
  'institutionId',
  'requestIdentifier',
  'proofIdentifier',
  'issuedAt',
  'proofValidUntil',
] as const);
const CODEC_KEYS = Object.freeze(['issue', 'verify'] as const);
const ISSUED_KEYS = Object.freeze(['kind', 'reference'] as const);
const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const FULL_HMAC_TAG = /^[A-Za-z0-9_-]{43}$/u;
const authenticFormalProvenanceResolvers = new WeakSet<object>();

declare const formalRequestProvenanceOwnerInputMarkerV1: unique symbol;

/**
 * Authentication/gateway-owner private facts already verified and bound to this request. The
 * owner applies this nominal type only inside its private composition root; no raw promotion
 * helper is exported from this shared server module.
 */
export type FormalRequestProvenanceOwnerInputV1 = Readonly<{
  source: InstitutionAccessContextSourceV1;
  accountId: string;
  tenantId: string;
  institutionId: string;
  requestIdentifier: string;
  proofIdentifier: string;
  issuedAt: string;
  proofValidUntil: string;
  readonly [formalRequestProvenanceOwnerInputMarkerV1]: 'request_bound_owner_only';
}>;

export type FormalRequestProvenanceOwnerResolutionV1 =
  | Readonly<{
      kind: 'verified';
      ownerInput: FormalRequestProvenanceOwnerInputV1;
    }>
  | Readonly<{
      kind: 'rejected';
      code:
        | 'provenance_missing'
        | 'provenance_invalid'
        | 'provenance_expired'
        | 'provenance_source_denied';
    }>
  | Readonly<{
      kind: 'unavailable';
      code: 'provenance_unavailable';
    }>;

type OwnerInputSnapshotV1 = Readonly<Record<string, unknown>>;
type IssueReferenceV1 = InstitutionGuardReferenceCodecV1['issue'];

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

function snapshotCodecIssue(value: unknown): IssueReferenceV1 | null {
  if (!isInstitutionGuardReferenceCodecV1(value)) return null;
  const snapshot = snapshotExactPlainRecord(value, CODEC_KEYS);
  if (
    !snapshot ||
    typeof snapshot.issue !== 'function' ||
    isProxy(snapshot.issue) ||
    typeof snapshot.verify !== 'function' ||
    isProxy(snapshot.verify)
  ) {
    return null;
  }
  return snapshot.issue as IssueReferenceV1;
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

function ownerSubject(value: string): InstitutionGuardReferenceOwnerSubjectV1 {
  return value as InstitutionGuardReferenceOwnerSubjectV1;
}

function issueReference<Prefix extends InstitutionGuardReferencePrefixV1>(
  issue: IssueReferenceV1,
  input: Readonly<{
    prefix: Prefix;
    ownerDomain: string;
    tenantId: string | null;
    institutionId: string | null;
    ownerSubject: string;
  }>,
): SafeGuardReferenceV1<Prefix> | null {
  let value: unknown;
  try {
    value = issue({
      prefix: input.prefix,
      ownerDomain: input.ownerDomain,
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      ownerSubject: ownerSubject(input.ownerSubject),
    });
  } catch {
    return null;
  }

  const snapshot = snapshotExactPlainRecord(value, ISSUED_KEYS);
  if (
    !snapshot ||
    snapshot.kind !== 'issued' ||
    !isGuardReferenceCandidateV1(snapshot.reference, input.prefix) ||
    typeof snapshot.reference !== 'string'
  ) {
    return null;
  }
  const tag = snapshot.reference.slice(-43);
  if (
    snapshot.reference.at(-44) !== '_' ||
    !FULL_HMAC_TAG.test(tag)
  ) {
    return null;
  }
  return snapshot.reference as unknown as SafeGuardReferenceV1<Prefix>;
}

function resolveOwnerInput(
  ownerInput: OwnerInputSnapshotV1,
  issue: IssueReferenceV1,
  now: () => Date,
): ProvenanceResolutionV1 {
  if (!isInstitutionAccessContextSourceV1(ownerInput.source)) {
    return sourceDenied;
  }
  if (
    !isInstitutionScopeIdV1(ownerInput.accountId) ||
    !isInstitutionScopeIdV1(ownerInput.tenantId) ||
    !isInstitutionScopeIdV1(ownerInput.institutionId) ||
    !isInstitutionScopeIdV1(ownerInput.requestIdentifier) ||
    !isInstitutionScopeIdV1(ownerInput.proofIdentifier)
  ) {
    return invalid;
  }

  const issuedAt = parseCanonicalUtcInstant(ownerInput.issuedAt);
  const proofValidUntil = parseCanonicalUtcInstant(ownerInput.proofValidUntil);
  if (
    !issuedAt ||
    !proofValidUntil ||
    proofValidUntil.epochMs <= issuedAt.epochMs
  ) {
    return invalid;
  }

  let nowValue: unknown;
  try {
    nowValue = now();
  } catch {
    return unavailable;
  }
  const verifiedAtEpochMs = trustedDateEpochMs(nowValue);
  if (verifiedAtEpochMs === null) return unavailable;
  if (issuedAt.epochMs > verifiedAtEpochMs) return invalid;

  const maximumValidUntilEpochMs = issuedAt.epochMs + MAX_PROVENANCE_TTL_MS;
  if (!Number.isFinite(maximumValidUntilEpochMs)) return invalid;
  const validUntilEpochMs = Math.min(
    proofValidUntil.epochMs,
    maximumValidUntilEpochMs,
  );
  if (verifiedAtEpochMs >= validUntilEpochMs) return expired;

  const userReference = issueReference(issue, {
    prefix: 'usr',
    ownerDomain: AUTH_ACCOUNT_OWNER_DOMAIN_V1,
    tenantId: null,
    institutionId: null,
    ownerSubject: ownerInput.accountId,
  });
  if (!userReference) return unavailable;

  const sourceOwnerDomain = SOURCE_OWNER_DOMAINS_V1[ownerInput.source];
  const requestReference = issueReference(issue, {
    prefix: 'req',
    ownerDomain: sourceOwnerDomain,
    tenantId: ownerInput.tenantId,
    institutionId: ownerInput.institutionId,
    ownerSubject: ownerInput.requestIdentifier,
  });
  if (!requestReference) return unavailable;

  const proofReference = issueReference(issue, {
    prefix: 'prf',
    ownerDomain: sourceOwnerDomain,
    tenantId: ownerInput.tenantId,
    institutionId: ownerInput.institutionId,
    ownerSubject: ownerInput.proofIdentifier,
  });
  if (!proofReference) return unavailable;

  const evidence = Object.freeze({
    source: ownerInput.source,
    userReference,
    tenantId: ownerInput.tenantId,
    institutionId: ownerInput.institutionId,
    requestReference,
    proofReference,
    issuedAt: issuedAt.raw,
    verifiedAt: new Date(verifiedAtEpochMs).toISOString(),
    validUntil: new Date(validUntilEpochMs).toISOString(),
  }) as unknown as FormalRequestProvenanceEvidenceV1;

  return Object.freeze({ kind: 'verified', evidence });
}

export function isFormalProvenanceResolverV1(
  value: unknown,
): value is FormalProvenanceResolverV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      authenticFormalProvenanceResolvers.has(value)
    );
  } catch {
    return false;
  }
}

function createRegisteredResolver(
  resolveOnce: () => ProvenanceResolutionV1,
): FormalProvenanceResolverV1 {
  let consumed = false;
  const resolver = Object.freeze({
    async resolveCurrentRequest(): Promise<ProvenanceResolutionV1> {
      if (consumed) return sourceDenied;
      consumed = true;
      return resolveOnce();
    },
  });
  authenticFormalProvenanceResolvers.add(resolver);
  return resolver as unknown as FormalProvenanceResolverV1;
}

function snapshotOwnerResolution(
  value: unknown,
):
  | Readonly<{
      kind: 'verified';
      ownerInput: OwnerInputSnapshotV1;
    }>
  | Exclude<ProvenanceResolutionV1, { kind: 'verified' }>
  | null {
  const verified = snapshotExactPlainRecord(
    value,
    VERIFIED_OWNER_RESOLUTION_KEYS,
  );
  if (verified?.kind === 'verified') {
    const ownerInputSnapshot = snapshotExactPlainRecord(
      verified.ownerInput,
      OWNER_INPUT_KEYS,
    );
    return ownerInputSnapshot
      ? Object.freeze({ kind: 'verified', ownerInput: ownerInputSnapshot })
      : null;
  }

  const failure = snapshotExactPlainRecord(
    value,
    FAILURE_OWNER_RESOLUTION_KEYS,
  );
  if (failure?.kind === 'rejected') {
    if (failure.code === 'provenance_missing') return missing;
    if (failure.code === 'provenance_invalid') return invalid;
    if (failure.code === 'provenance_expired') return expired;
    if (failure.code === 'provenance_source_denied') return sourceDenied;
    return null;
  }
  if (
    failure?.kind === 'unavailable' &&
    failure.code === 'provenance_unavailable'
  ) {
    return unavailable;
  }
  return null;
}

/**
 * Composes a genuine single-consumption resolver from one explicit low-sensitive owner result.
 * Authentication owners use this boundary to preserve their failure class without manufacturing
 * malformed request facts. It does not parse cookies, sessions, or caller-selected scope.
 */
export function createFormalRequestProvenanceResolverFromOwnerResolutionV1(
  input:
    | Readonly<{
        ownerResolution: Extract<
          FormalRequestProvenanceOwnerResolutionV1,
          { kind: 'rejected' | 'unavailable' }
        >;
      }>
    | Readonly<{
        ownerResolution: Extract<
          FormalRequestProvenanceOwnerResolutionV1,
          { kind: 'verified' }
        >;
        referenceCodec: InstitutionGuardReferenceCodecV1;
        now: () => Date;
      }>,
): FormalProvenanceResolverV1 {
  const failureComposition = snapshotExactPlainRecord(
    input,
    FAILURE_RESOLUTION_COMPOSER_INPUT_KEYS,
  );
  const failureResolution = failureComposition
    ? snapshotOwnerResolution(failureComposition.ownerResolution)
    : null;
  if (failureResolution && failureResolution.kind !== 'verified') {
    return createRegisteredResolver(() => failureResolution);
  }

  const composition = snapshotExactPlainRecord(
    input,
    RESOLUTION_COMPOSER_INPUT_KEYS,
  );
  const ownerResolution = composition
    ? snapshotOwnerResolution(composition.ownerResolution)
    : null;
  if (!composition || ownerResolution?.kind !== 'verified') {
    return createRegisteredResolver(() => unavailable);
  }
  const issue = snapshotCodecIssue(composition.referenceCodec);
  const now =
    typeof composition.now === 'function' &&
    !isProxy(composition.now)
      ? (composition.now as () => Date)
      : null;

  return createRegisteredResolver(() => {
    if (!issue || !now) return unavailable;
    return resolveOwnerInput(ownerResolution.ownerInput, issue, now);
  });
}

/**
 * Composes a single-consumption resolver around one owner-verified request snapshot. It neither
 * reads authentication state nor accepts caller-selected scope, domains, or timestamps.
 */
export function createFormalRequestProvenanceResolverV1(input: Readonly<{
  ownerInput: FormalRequestProvenanceOwnerInputV1 | null;
  referenceCodec: InstitutionGuardReferenceCodecV1;
  now: () => Date;
}>): FormalProvenanceResolverV1 {
  const composition = snapshotExactPlainRecord(input, COMPOSER_INPUT_KEYS);
  const ownerInputMissing = composition?.ownerInput === null;
  const ownerInputSnapshot =
    composition && !ownerInputMissing
      ? snapshotExactPlainRecord(composition.ownerInput, OWNER_INPUT_KEYS)
      : null;
  const issue = composition
    ? snapshotCodecIssue(composition.referenceCodec)
    : null;
  const now =
    composition &&
    typeof composition.now === 'function' &&
    !isProxy(composition.now)
      ? (composition.now as () => Date)
      : null;
  return createRegisteredResolver(() => {
    if (!composition) return unavailable;
    if (ownerInputMissing) return missing;
    if (!ownerInputSnapshot) return invalid;
    if (!issue || !now) return unavailable;
    return resolveOwnerInput(ownerInputSnapshot, issue, now);
  });
}
