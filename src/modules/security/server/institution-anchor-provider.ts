import { isProxy } from 'node:util/types';

import { isInstitutionScopeIdV1 } from '@/modules/security/domain/institution-access';
import { isAuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/application/authoritative-institution-scope-reader';
import type { AuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/ports/authoritative-institution-scope-reader';
import {
  isGuardReferenceCandidateV1,
  type ActiveInstitutionAnchorEvidenceV1,
  type ActiveInstitutionAnchorProviderV1,
  type AnchorReferenceV1,
  type AnchorRevisionReferenceV1,
} from '@/modules/security/server/institution-guard-evidence';
import {
  isInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceOwnerSubjectV1,
} from '@/modules/security/server/institution-guard-reference';

export type InstitutionAnchorFactQueryV1 = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

/**
 * Security 内部对 Tenancy 权威 Scope 事实的规范化投影。它不是第二套事实源，
 * 也不是 sealed guard evidence，不授予 section、object、action 或 capability 权限。
 */
type NormalizedInstitutionAnchorFactV1 = Readonly<{
  kind: 'current_anchor_fact';
  tenantId: string;
  institutionId: string;
  revision: number;
  observedAt: string;
}>;

type AuthoritativeInstitutionAnchorFactResolutionV1 =
  | NormalizedInstitutionAnchorFactV1
  | Readonly<{
      kind: 'denied';
      code: 'institution_anchor_denied';
    }>
  | Readonly<{
      kind: 'unavailable';
      code: 'institution_anchor_unavailable';
    }>;

const QUERY_KEYS = Object.freeze(['tenantId', 'institutionId'] as const);
const CURRENT_SCOPE_FACT_KEYS = Object.freeze([
  'kind',
  'tenantId',
  'institutionId',
  'status',
  'revision',
  'observedAt',
] as const);
const REJECTION_KEYS = Object.freeze(['kind', 'code'] as const);
const ISSUED_REFERENCE_KEYS = Object.freeze(['kind', 'reference'] as const);
const VERIFIED_REFERENCE_KEYS = Object.freeze(['kind', 'reference'] as const);
const ACTIVE_PROVIDER_INPUT_KEYS = Object.freeze([
  'factReader',
  'referenceCodec',
  'now',
] as const);
const FACT_READER_KEYS = Object.freeze(['resolve'] as const);
const REFERENCE_CODEC_KEYS = Object.freeze(['issue', 'verify'] as const);
const activeInstitutionAnchorProviderHandlesV1 = new WeakSet<object>();

const ACTIVE_ANCHOR_FRESHNESS_TTL_MS = 60_000;
const ANCHOR_REFERENCE_OWNER_DOMAIN = 'security.institution-anchor';
const ANCHOR_REFERENCE_OWNER_SUBJECT =
  'institution-anchor' as InstitutionGuardReferenceOwnerSubjectV1;
const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const denied = Object.freeze({
  kind: 'denied',
  code: 'institution_anchor_denied',
} as const);
const unavailable = Object.freeze({
  kind: 'unavailable',
  code: 'institution_anchor_unavailable',
} as const);

/**
 * Checks factory-issued handle identity only. It reads no properties and does not parse,
 * rehydrate, register, or promote arbitrary values into an active provider.
 */
export function isActiveInstitutionAnchorProviderV1(
  value: unknown,
): value is ActiveInstitutionAnchorProviderV1 {
  return (
    value !== null &&
    typeof value === 'object' &&
    activeInstitutionAnchorProviderHandlesV1.has(value)
  );
}

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

function dateEpochMs(value: unknown): number | null {
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

function parseQuery(value: unknown): InstitutionAnchorFactQueryV1 | null {
  const snapshot = snapshotExactPlainRecord(value, QUERY_KEYS);
  if (
    !snapshot ||
    !isInstitutionScopeIdV1(snapshot.tenantId) ||
    !isInstitutionScopeIdV1(snapshot.institutionId)
  ) {
    return null;
  }
  return Object.freeze({
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
  });
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

function parseCurrentFactResolution(input: {
  value: unknown;
  query: InstitutionAnchorFactQueryV1;
}): AuthoritativeInstitutionAnchorFactResolutionV1 {
  const currentScopeFact = snapshotExactPlainRecord(
    input.value,
    CURRENT_SCOPE_FACT_KEYS,
  );
  if (currentScopeFact?.kind === 'current_scope_fact') {
    const observedAt = parseCanonicalUtcInstant(currentScopeFact.observedAt);
    if (
      currentScopeFact.status !== 'active' ||
      !isInstitutionScopeIdV1(currentScopeFact.tenantId) ||
      !isInstitutionScopeIdV1(currentScopeFact.institutionId) ||
      currentScopeFact.tenantId !== input.query.tenantId ||
      currentScopeFact.institutionId !== input.query.institutionId ||
      !Number.isSafeInteger(currentScopeFact.revision) ||
      (currentScopeFact.revision as number) <= 0 ||
      !observedAt
    ) {
      return unavailable;
    }
    return Object.freeze({
      kind: 'current_anchor_fact',
      tenantId: currentScopeFact.tenantId,
      institutionId: currentScopeFact.institutionId,
      revision: currentScopeFact.revision as number,
      observedAt: observedAt.raw,
    });
  }

  const rejection = snapshotExactPlainRecord(input.value, REJECTION_KEYS);
  if (
    rejection?.kind === 'rejected' &&
    rejection.code === 'scope_denied'
  ) {
    return denied;
  }
  if (
    rejection?.kind === 'rejected' &&
    (rejection.code === 'scope_invalid' ||
      rejection.code === 'scope_unavailable')
  ) {
    return unavailable;
  }
  return unavailable;
}

function readTrustedNowEpochMs(now: () => Date): number | null {
  try {
    return dateEpochMs(now());
  } catch {
    return null;
  }
}

function parseIssuedReference<Prefix extends 'anc' | 'arv'>(
  value: unknown,
  prefix: Prefix,
): AnchorReferenceV1 | AnchorRevisionReferenceV1 | null {
  const issued = snapshotExactPlainRecord(value, ISSUED_REFERENCE_KEYS);
  if (
    issued?.kind !== 'issued' ||
    !isGuardReferenceCandidateV1(issued.reference, prefix)
  ) {
    return null;
  }
  const fullLengthMatch =
    /^(anc|arv)_v1_k([1-9][0-9]{0,2})_([A-Za-z0-9_-]{43})$/u.exec(
      issued.reference,
    );
  if (!fullLengthMatch || fullLengthMatch[1] !== prefix) {
    return null;
  }
  return issued.reference as unknown as
    | AnchorReferenceV1
    | AnchorRevisionReferenceV1;
}

function issueOwnedReference<Prefix extends 'anc' | 'arv'>(
  dependencies: Pick<
    ActiveProviderDependenciesV1,
    'issueReference' | 'verifyReference'
  >,
  input: Readonly<{
    prefix: Prefix;
    ownerDomain: string;
    tenantId: string;
    institutionId: string;
    ownerSubject: InstitutionGuardReferenceOwnerSubjectV1;
  }>,
): AnchorReferenceV1 | AnchorRevisionReferenceV1 | null {
  const canonicalInput = Object.freeze({ ...input });
  let issuedValue: unknown;
  try {
    issuedValue = dependencies.issueReference(canonicalInput);
  } catch {
    return null;
  }
  const reference = parseIssuedReference(issuedValue, input.prefix);
  if (!reference) return null;

  let verifiedValue: unknown;
  try {
    verifiedValue = dependencies.verifyReference(
      Object.freeze({ ...canonicalInput, reference }),
    );
  } catch {
    return null;
  }
  const verified = snapshotExactPlainRecord(
    verifiedValue,
    VERIFIED_REFERENCE_KEYS,
  );
  if (
    verified?.kind !== 'verified' ||
    verified.reference !== reference ||
    !isGuardReferenceCandidateV1(verified.reference, input.prefix)
  ) {
    return null;
  }
  return reference;
}

function sameCurrentScopeFact(
  first: NormalizedInstitutionAnchorFactV1,
  second: NormalizedInstitutionAnchorFactV1,
): boolean {
  return (
    first.tenantId === second.tenantId &&
    first.institutionId === second.institutionId &&
    first.revision === second.revision
  );
}

type ActiveProviderDependenciesV1 = Readonly<{
  resolveFact: AuthoritativeInstitutionScopeFactReaderV1['resolve'];
  issueReference: InstitutionGuardReferenceCodecV1['issue'];
  verifyReference: InstitutionGuardReferenceCodecV1['verify'];
  now: () => Date;
}>;

function snapshotActiveProviderDependencies(
  value: unknown,
): ActiveProviderDependenciesV1 | null {
  const input = snapshotExactPlainRecord(value, ACTIVE_PROVIDER_INPUT_KEYS);
  if (!input || typeof input.now !== 'function' || isProxy(input.now)) {
    return null;
  }

  if (!isInstitutionGuardReferenceCodecV1(input.referenceCodec)) {
    return null;
  }

  if (!isAuthoritativeInstitutionScopeFactReaderV1(input.factReader)) {
    return null;
  }

  const factReader = snapshotExactPlainRecord(
    input.factReader,
    FACT_READER_KEYS,
  );
  const referenceCodec = snapshotExactPlainRecord(
    input.referenceCodec,
    REFERENCE_CODEC_KEYS,
  );
  if (
    !factReader ||
    typeof factReader.resolve !== 'function' ||
    isProxy(factReader.resolve) ||
    !referenceCodec ||
    typeof referenceCodec.issue !== 'function' ||
    isProxy(referenceCodec.issue) ||
    typeof referenceCodec.verify !== 'function' ||
    isProxy(referenceCodec.verify)
  ) {
    return null;
  }

  return Object.freeze({
    resolveFact:
      factReader.resolve as AuthoritativeInstitutionScopeFactReaderV1['resolve'],
    issueReference:
      referenceCodec.issue as InstitutionGuardReferenceCodecV1['issue'],
    verifyReference:
      referenceCodec.verify as InstitutionGuardReferenceCodecV1['verify'],
    now: input.now as () => Date,
  });
}

/**
 * Owner composition boundary that rereads the authoritative fact on every resolve and only
 * publishes atomic, short-lived evidence after both opaque references are issued successfully.
 */
export function createActiveInstitutionAnchorProviderV1(input: {
  factReader: AuthoritativeInstitutionScopeFactReaderV1;
  referenceCodec: InstitutionGuardReferenceCodecV1;
  now: () => Date;
}): ActiveInstitutionAnchorProviderV1 {
  const dependencies = snapshotActiveProviderDependencies(input);

  const provider = Object.freeze({
    async resolve(queryValue: InstitutionAnchorFactQueryV1) {
      if (!dependencies) return unavailable;
      const query = parseQuery(queryValue);
      if (!query) return unavailable;

      let rawResolution: unknown;
      try {
        rawResolution = await dependencies.resolveFact(query);
      } catch {
        return unavailable;
      }

      const factResolution = parseCurrentFactResolution({
        value: rawResolution,
        query,
      });
      if (factResolution.kind === 'denied') return denied;
      if (factResolution.kind !== 'current_anchor_fact') return unavailable;

      const observedAt = parseCanonicalUtcInstant(factResolution.observedAt);
      if (!observedAt) return unavailable;
      const freshUntilEpochMs =
        observedAt.epochMs + ACTIVE_ANCHOR_FRESHNESS_TTL_MS;
      if (!Number.isSafeInteger(freshUntilEpochMs)) return unavailable;

      const beforeIssueEpochMs = readTrustedNowEpochMs(dependencies.now);
      if (
        beforeIssueEpochMs === null ||
        observedAt.epochMs > beforeIssueEpochMs ||
        beforeIssueEpochMs >= freshUntilEpochMs
      ) {
        return unavailable;
      }

      const anchorReference = issueOwnedReference(
        dependencies,
        {
          prefix: 'anc',
          ownerDomain: ANCHOR_REFERENCE_OWNER_DOMAIN,
          tenantId: factResolution.tenantId,
          institutionId: factResolution.institutionId,
          ownerSubject: ANCHOR_REFERENCE_OWNER_SUBJECT,
        },
      ) as AnchorReferenceV1 | null;
      if (!anchorReference) return unavailable;

      const anchorRevision = issueOwnedReference(
        dependencies,
        {
          prefix: 'arv',
          ownerDomain: ANCHOR_REFERENCE_OWNER_DOMAIN,
          tenantId: factResolution.tenantId,
          institutionId: factResolution.institutionId,
          ownerSubject: `revision-${factResolution.revision}` as InstitutionGuardReferenceOwnerSubjectV1,
        },
      ) as AnchorRevisionReferenceV1 | null;
      if (!anchorRevision) return unavailable;

      let secondRawResolution: unknown;
      try {
        secondRawResolution = await dependencies.resolveFact(query);
      } catch {
        return unavailable;
      }
      const secondFactResolution = parseCurrentFactResolution({
        value: secondRawResolution,
        query,
      });
      if (secondFactResolution.kind === 'denied') return denied;
      if (
        secondFactResolution.kind !== 'current_anchor_fact' ||
        !sameCurrentScopeFact(factResolution, secondFactResolution)
      ) {
        return unavailable;
      }

      const afterIssueEpochMs = readTrustedNowEpochMs(dependencies.now);
      if (
        afterIssueEpochMs === null ||
        afterIssueEpochMs < beforeIssueEpochMs ||
        afterIssueEpochMs >= freshUntilEpochMs
      ) {
        return unavailable;
      }

      return Object.freeze({
        kind: 'active',
        tenantId: factResolution.tenantId,
        institutionId: factResolution.institutionId,
        anchorReference,
        anchorRevision,
        observedAt: observedAt.raw,
        freshUntil: new Date(freshUntilEpochMs).toISOString(),
      }) as ActiveInstitutionAnchorEvidenceV1;
    },
  }) as unknown as ActiveInstitutionAnchorProviderV1;

  activeInstitutionAnchorProviderHandlesV1.add(provider);
  return provider;
}
