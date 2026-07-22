import { isProxy } from 'node:util/types';

import { isInstitutionScopeIdV1 } from '@/modules/security/domain/institution-access';
import {
  isGuardReferenceCandidateV1,
  type ActiveInstitutionAnchorEvidenceV1,
  type ActiveInstitutionAnchorProviderV1,
  type AnchorReferenceV1,
  type AnchorRevisionReferenceV1,
} from '@/modules/security/server/institution-guard-evidence';
import type {
  CurrentInstitutionAnchorFactRowV1,
  InstitutionAnchorFactRepositoryV1 as RepositoryV1,
} from '@/modules/security/server/institution-anchor-repository';
import type {
  InstitutionGuardReferenceCodecV1,
  InstitutionGuardReferenceOwnerSubjectV1,
} from '@/modules/security/server/institution-guard-reference';

export type InstitutionAnchorFactRepositoryV1 = RepositoryV1;

export type InstitutionAnchorFactQueryV1 = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

/**
 * Current authoritative database fact only. This raw owner fact is not sealed guard evidence,
 * does not contain a safe reference, and grants no section, object, action, or capability access.
 */
export type AuthoritativeInstitutionAnchorFactV1 = Readonly<{
  kind: 'current_anchor_fact';
  tenantId: string;
  institutionId: string;
  revision: number;
  observedAt: string;
}>;

export type AuthoritativeInstitutionAnchorFactResolutionV1 =
  | AuthoritativeInstitutionAnchorFactV1
  | Readonly<{
      kind: 'denied';
      code: 'institution_anchor_denied';
    }>
  | Readonly<{
      kind: 'unavailable';
      code: 'institution_anchor_unavailable';
    }>;

export type AuthoritativeInstitutionAnchorFactReaderV1 = Readonly<{
  resolve: (
    input: InstitutionAnchorFactQueryV1,
  ) => Promise<AuthoritativeInstitutionAnchorFactResolutionV1>;
}>;

const QUERY_KEYS = Object.freeze(['tenantId', 'institutionId'] as const);
const ROW_KEYS = Object.freeze([
  'tenantId',
  'institutionId',
  'status',
  'revision',
] as const satisfies readonly (keyof CurrentInstitutionAnchorFactRowV1)[]);
const CURRENT_FACT_KEYS = Object.freeze([
  'kind',
  'tenantId',
  'institutionId',
  'revision',
  'observedAt',
] as const);
const REJECTION_KEYS = Object.freeze(['kind', 'code'] as const);
const ISSUED_REFERENCE_KEYS = Object.freeze(['kind', 'reference'] as const);
const ACTIVE_PROVIDER_INPUT_KEYS = Object.freeze([
  'factReader',
  'referenceCodec',
  'now',
] as const);
const FACT_READER_KEYS = Object.freeze(['resolve'] as const);
const REFERENCE_CODEC_KEYS = Object.freeze(['issue', 'verify'] as const);

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

function snapshotExactRows(value: unknown): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length > 2
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

    const rows: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      rows.push(descriptor.value);
    }
    return Object.freeze(rows);
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
  const currentFact = snapshotExactPlainRecord(input.value, CURRENT_FACT_KEYS);
  if (currentFact?.kind === 'current_anchor_fact') {
    const observedAt = parseCanonicalUtcInstant(currentFact.observedAt);
    if (
      !isInstitutionScopeIdV1(currentFact.tenantId) ||
      !isInstitutionScopeIdV1(currentFact.institutionId) ||
      currentFact.tenantId !== input.query.tenantId ||
      currentFact.institutionId !== input.query.institutionId ||
      !Number.isSafeInteger(currentFact.revision) ||
      (currentFact.revision as number) <= 0 ||
      !observedAt
    ) {
      return unavailable;
    }

    return Object.freeze({
      kind: 'current_anchor_fact',
      tenantId: currentFact.tenantId,
      institutionId: currentFact.institutionId,
      revision: currentFact.revision as number,
      observedAt: observedAt.raw,
    });
  }

  const rejection = snapshotExactPlainRecord(input.value, REJECTION_KEYS);
  if (
    rejection?.kind === 'denied' &&
    rejection.code === 'institution_anchor_denied'
  ) {
    return denied;
  }
  if (
    rejection?.kind === 'unavailable' &&
    rejection.code === 'institution_anchor_unavailable'
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

type ActiveProviderDependenciesV1 = Readonly<{
  resolveFact: AuthoritativeInstitutionAnchorFactReaderV1['resolve'];
  issueReference: InstitutionGuardReferenceCodecV1['issue'];
  now: () => Date;
}>;

function snapshotActiveProviderDependencies(
  value: unknown,
): ActiveProviderDependenciesV1 | null {
  const input = snapshotExactPlainRecord(value, ACTIVE_PROVIDER_INPUT_KEYS);
  if (!input || typeof input.now !== 'function' || isProxy(input.now)) {
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
      factReader.resolve as AuthoritativeInstitutionAnchorFactReaderV1['resolve'],
    issueReference:
      referenceCodec.issue as InstitutionGuardReferenceCodecV1['issue'],
    now: input.now as () => Date,
  });
}

function resolveCurrentRow(input: {
  rowValue: unknown;
  query: InstitutionAnchorFactQueryV1;
  observedAt: string;
}): AuthoritativeInstitutionAnchorFactResolutionV1 {
  const row = snapshotExactPlainRecord(input.rowValue, ROW_KEYS);
  if (!row) return unavailable;

  if (
    !isInstitutionScopeIdV1(row.tenantId) ||
    !isInstitutionScopeIdV1(row.institutionId) ||
    row.tenantId !== input.query.tenantId ||
    row.institutionId !== input.query.institutionId
  ) {
    return unavailable;
  }

  if (row.status === 'suspended') return denied;
  if (row.status !== 'active') return unavailable;
  if (!Number.isSafeInteger(row.revision) || (row.revision as number) <= 0) {
    return unavailable;
  }

  return Object.freeze({
    kind: 'current_anchor_fact',
    tenantId: row.tenantId,
    institutionId: row.institutionId,
    revision: row.revision as number,
    observedAt: input.observedAt,
  });
}

export function createAuthoritativeInstitutionAnchorFactReaderV1(input: {
  repository: InstitutionAnchorFactRepositoryV1;
  now?: () => Date;
}): AuthoritativeInstitutionAnchorFactReaderV1 {
  const now = input.now ?? (() => new Date());

  return Object.freeze({
    async resolve(queryValue) {
      const query = parseQuery(queryValue);
      if (!query) return unavailable;

      let rowsValue: unknown;
      try {
        rowsValue = await input.repository.findCurrentInstitutionAnchorFacts(query);
      } catch {
        return unavailable;
      }

      const rows = snapshotExactRows(rowsValue);
      if (!rows) return unavailable;
      if (rows.length === 0) return denied;
      if (rows.length !== 1) return unavailable;

      let nowValue: Date;
      try {
        nowValue = now();
      } catch {
        return unavailable;
      }
      const nowEpochMs = dateEpochMs(nowValue);
      if (nowEpochMs === null) return unavailable;

      return resolveCurrentRow({
        rowValue: rows[0],
        query,
        observedAt: new Date(nowEpochMs).toISOString(),
      });
    },
  });
}

/**
 * Owner composition boundary that rereads the authoritative fact on every resolve and only
 * publishes atomic, short-lived evidence after both opaque references are issued successfully.
 */
export function createActiveInstitutionAnchorProviderV1(input: {
  factReader: AuthoritativeInstitutionAnchorFactReaderV1;
  referenceCodec: InstitutionGuardReferenceCodecV1;
  now: () => Date;
}): ActiveInstitutionAnchorProviderV1 {
  const dependencies = snapshotActiveProviderDependencies(input);

  return Object.freeze({
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

      let anchorReferenceValue: unknown;
      try {
        anchorReferenceValue = dependencies.issueReference({
          prefix: 'anc',
          ownerDomain: ANCHOR_REFERENCE_OWNER_DOMAIN,
          tenantId: factResolution.tenantId,
          institutionId: factResolution.institutionId,
          ownerSubject: ANCHOR_REFERENCE_OWNER_SUBJECT,
        });
      } catch {
        return unavailable;
      }
      const anchorReference = parseIssuedReference(
        anchorReferenceValue,
        'anc',
      ) as AnchorReferenceV1 | null;
      if (!anchorReference) return unavailable;

      let anchorRevisionValue: unknown;
      try {
        anchorRevisionValue = dependencies.issueReference({
          prefix: 'arv',
          ownerDomain: ANCHOR_REFERENCE_OWNER_DOMAIN,
          tenantId: factResolution.tenantId,
          institutionId: factResolution.institutionId,
          ownerSubject: `revision-${factResolution.revision}` as InstitutionGuardReferenceOwnerSubjectV1,
        });
      } catch {
        return unavailable;
      }
      const anchorRevision = parseIssuedReference(
        anchorRevisionValue,
        'arv',
      ) as AnchorRevisionReferenceV1 | null;
      if (!anchorRevision) return unavailable;

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
}
