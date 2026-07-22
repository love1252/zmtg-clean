import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';

import {
  isInstitutionNavigationSectionIdV1,
  type InstitutionNavigationSectionIdV1,
  type InstitutionRoleV1,
} from '@/modules/institution-contracts/v1/institution-navigation';
import {
  INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1,
  type PolicyRevisionReferenceV1,
} from '@/modules/security/server/institution-guard-evidence';
import {
  isInstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceCodecV1,
  type InstitutionGuardReferenceInputV1,
  type InstitutionGuardReferenceOwnerSubjectV1,
} from '@/modules/security/server/institution-guard-reference';
import {
  isInstitutionScopeAllowV1,
  isInstitutionScopeGuardV1,
  type InstitutionScopeAllowV1,
  type InstitutionScopeGuardV1,
} from '@/modules/security/server/institution-scope-guard';

const FACTORY_INPUT_KEYS = Object.freeze(['scopeGuard', 'referenceCodec', 'now'] as const);
const REFERENCE_CODEC_KEYS = Object.freeze(['issue', 'verify'] as const);
const AUTHORIZE_INPUT_KEYS = Object.freeze(['sectionId'] as const);
const ISSUE_RESULT_KEYS = Object.freeze(['kind', 'reference'] as const);
const VERIFY_RESULT_KEYS = Object.freeze(['kind', 'reference'] as const);
const POLICY_OWNER_DOMAIN = 'security.institution-section-policy';
const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const POLICY_REVISION_PROFILE = /^prv_v1_k([1-9][0-9]{0,2})_([A-Za-z0-9_-]{43})$/u;

const ALL_ROLES = Object.freeze([
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
] as const satisfies readonly InstitutionRoleV1[]);
const MANAGEMENT_ROLES = Object.freeze([
  'tenant_admin',
  'tenant_operator',
] as const satisfies readonly InstitutionRoleV1[]);

const SECTION_ROLE_MANIFEST = Object.freeze({
  workbench: ALL_ROLES,
  customers: ALL_ROLES,
  conversations: ALL_ROLES,
  care: ALL_ROLES,
  knowledge: MANAGEMENT_ROLES,
  analytics: MANAGEMENT_ROLES,
  system: MANAGEMENT_ROLES,
} as const satisfies Readonly<
  Record<InstitutionNavigationSectionIdV1, readonly InstitutionRoleV1[]>
>);

const POLICY_MANIFEST_FIELDS = Object.freeze([
  'zmtg.institution-section-policy.v1',
  'resource=institution_section',
  'action=section_enter',
  ...(
    [
      'workbench',
      'customers',
      'conversations',
      'care',
      'knowledge',
      'analytics',
      'system',
    ] as const
  ).flatMap((sectionId) =>
    ALL_ROLES.map(
      (role) =>
        `${sectionId}|${role}|${SECTION_ROLE_MANIFEST[sectionId].some((allowed) => allowed === role) ? 'allow' : 'deny'}`,
    ),
  ),
] as const);

function encodeLengthPrefixedTuple(fields: readonly string[]): Buffer {
  const encodedFields = fields.map((field) => Buffer.from(field, 'utf8'));
  const output = Buffer.allocUnsafe(
    encodedFields.reduce((total, field) => total + 4 + field.byteLength, 0),
  );
  let offset = 0;
  for (const field of encodedFields) {
    output.writeUInt32BE(field.byteLength, offset);
    offset += 4;
    field.copy(output, offset);
    offset += field.byteLength;
  }
  return output;
}

const POLICY_MANIFEST_OWNER_SUBJECT =
  `manifest-sha256:${createHash('sha256')
    .update(encodeLengthPrefixedTuple(POLICY_MANIFEST_FIELDS))
    .digest('base64url')}` as InstitutionGuardReferenceOwnerSubjectV1;

declare class InstitutionSectionGuardSealV1 {
  private readonly ownerSeal;
}
declare class InstitutionSectionAllowSealV1 {
  private readonly ownerSeal;
}

export const INSTITUTION_SECTION_GUARD_FAILURE_CODES_V1 = Object.freeze([
  'scope_unavailable',
  'action_unregistered',
  'action_role_denied',
  'policy_unavailable',
] as const);

export type InstitutionSectionGuardFailureCodeV1 =
  (typeof INSTITUTION_SECTION_GUARD_FAILURE_CODES_V1)[number];

export type InstitutionSectionGuardInputV1 = Readonly<{
  sectionId: InstitutionNavigationSectionIdV1;
}>;

export type InstitutionSectionAllowV1 = InstitutionSectionAllowSealV1 &
  Readonly<{
    kind: 'institution_section_allow';
    sectionId: InstitutionNavigationSectionIdV1;
    action: 'section_enter';
    policyRevision: PolicyRevisionReferenceV1;
    decidedAt: string;
    validUntil: string;
  }>;

export type InstitutionSectionGuardResolutionV1 =
  | InstitutionSectionAllowV1
  | Readonly<{
      kind: 'rejected';
      code: InstitutionSectionGuardFailureCodeV1;
    }>;

export type InstitutionSectionGuardV1 = InstitutionSectionGuardSealV1 &
  Readonly<{
    authorizeCurrentSection: (
      input: InstitutionSectionGuardInputV1,
    ) => Promise<InstitutionSectionGuardResolutionV1>;
  }>;

type DependenciesV1 = Readonly<{
  preflightFailure: 'scope_unavailable' | 'policy_unavailable' | null;
  authorizeCurrentRequest: (() => ReturnType<InstitutionScopeGuardV1['authorizeCurrentRequest']>) | null;
  issue: InstitutionGuardReferenceCodecV1['issue'] | null;
  verify: InstitutionGuardReferenceCodecV1['verify'] | null;
  now: (() => Date) | null;
}>;

type CanonicalInstantV1 = Readonly<{ raw: string; epochMs: number }>;

const authenticGuards = new WeakSet<object>();
const authenticAllows = new WeakSet<object>();
const failures = Object.freeze(
  Object.fromEntries(
    INSTITUTION_SECTION_GUARD_FAILURE_CODES_V1.map((code) => [
      code,
      Object.freeze({ kind: 'rejected', code }),
    ]),
  ) as Record<
    InstitutionSectionGuardFailureCodeV1,
    Readonly<{ kind: 'rejected'; code: InstitutionSectionGuardFailureCodeV1 }>
  >,
);

function reject(
  code: InstitutionSectionGuardFailureCodeV1,
): InstitutionSectionGuardResolutionV1 {
  return failures[code];
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
      expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(descriptors, key))
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
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotDependencies(value: unknown): DependenciesV1 {
  const input = snapshotExactPlainRecord(value, FACTORY_INPUT_KEYS);
  const referenceCodecCandidate = input?.referenceCodec;
  const genuineReferenceCodec = isInstitutionGuardReferenceCodecV1(
    referenceCodecCandidate,
  );
  if (!input) {
    return Object.freeze({
      preflightFailure: 'scope_unavailable',
      authorizeCurrentRequest: null,
      issue: null,
      verify: null,
      now: null,
    });
  }
  if (!genuineReferenceCodec) {
    return Object.freeze({
      preflightFailure: 'policy_unavailable',
      authorizeCurrentRequest: null,
      issue: null,
      verify: null,
      now: null,
    });
  }
  const scopeGuardCandidate = input.scopeGuard;
  const genuineScopeGuard = isInstitutionScopeGuardV1(scopeGuardCandidate);
  const codec = snapshotExactPlainRecord(
    referenceCodecCandidate,
    REFERENCE_CODEC_KEYS,
  );
  const now = input.now;
  return Object.freeze({
    preflightFailure: null,
    authorizeCurrentRequest:
      genuineScopeGuard &&
      typeof scopeGuardCandidate.authorizeCurrentRequest === 'function' &&
      !isProxy(scopeGuardCandidate.authorizeCurrentRequest)
        ? scopeGuardCandidate.authorizeCurrentRequest
        : null,
    issue:
      codec && typeof codec.issue === 'function' && !isProxy(codec.issue)
        ? (codec.issue as InstitutionGuardReferenceCodecV1['issue'])
        : null,
    verify:
      codec && typeof codec.verify === 'function' && !isProxy(codec.verify)
        ? (codec.verify as InstitutionGuardReferenceCodecV1['verify'])
        : null,
    now: typeof now === 'function' && !isProxy(now) ? (now as () => Date) : null,
  });
}

function trustedNow(now: (() => Date) | null): CanonicalInstantV1 | null {
  if (!now) return null;
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
    if (!Number.isFinite(epochMs)) return null;
    return Object.freeze({ raw: new Date(epochMs).toISOString(), epochMs });
  } catch {
    return null;
  }
}

function parseCanonicalInstant(value: string): CanonicalInstantV1 | null {
  if (!CANONICAL_UTC_INSTANT.test(value)) return null;
  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== value) return null;
  return Object.freeze({ raw: value, epochMs });
}

function scopeIsCurrent(
  scopeAllow: InstitutionScopeAllowV1,
  decisionTime: CanonicalInstantV1,
): boolean {
  const decidedAt = parseCanonicalInstant(scopeAllow.decidedAt);
  const provenanceValidUntil = parseCanonicalInstant(scopeAllow.provenanceValidUntil);
  const membershipFreshUntil = parseCanonicalInstant(scopeAllow.membershipFreshUntil);
  const anchorFreshUntil = parseCanonicalInstant(scopeAllow.anchorFreshUntil);
  const validUntil = parseCanonicalInstant(scopeAllow.validUntil);
  if (!decidedAt || !provenanceValidUntil || !membershipFreshUntil || !anchorFreshUntil || !validUntil) {
    return false;
  }
  const earliestDeadline = Math.min(
    provenanceValidUntil.epochMs,
    membershipFreshUntil.epochMs,
    anchorFreshUntil.epochMs,
  );
  return (
    validUntil.epochMs === earliestDeadline &&
    decisionTime.epochMs >= decidedAt.epochMs &&
    decisionTime.epochMs < provenanceValidUntil.epochMs &&
    decisionTime.epochMs < membershipFreshUntil.epochMs &&
    decisionTime.epochMs < anchorFreshUntil.epochMs &&
    decisionTime.epochMs < validUntil.epochMs
  );
}

function isPolicyRevisionReference(value: unknown): value is PolicyRevisionReferenceV1 {
  if (typeof value !== 'string') return false;
  const match = POLICY_REVISION_PROFILE.exec(value);
  if (!match) return false;
  const keyVersion = Number(match[1]);
  return INSTITUTION_GUARD_ACCEPTED_KEY_VERSIONS_V1.some(
    (accepted) => accepted === keyVersion,
  );
}

function issuePolicyRevision(dependencies: DependenciesV1): PolicyRevisionReferenceV1 | null {
  if (!dependencies.issue || !dependencies.verify) return null;
  const input = Object.freeze({
    prefix: 'prv',
    ownerDomain: POLICY_OWNER_DOMAIN,
    tenantId: null,
    institutionId: null,
    ownerSubject: POLICY_MANIFEST_OWNER_SUBJECT,
  }) satisfies InstitutionGuardReferenceInputV1<'prv'>;
  try {
    const rawIssued = dependencies.issue(input);
    const issued = snapshotExactPlainRecord(rawIssued, ISSUE_RESULT_KEYS);
    if (
      !issued ||
      !Object.isFrozen(rawIssued) ||
      issued.kind !== 'issued' ||
      !isPolicyRevisionReference(issued.reference)
    ) {
      return null;
    }
    const rawVerified = dependencies.verify({ ...input, reference: issued.reference });
    const verified = snapshotExactPlainRecord(rawVerified, VERIFY_RESULT_KEYS);
    if (
      !verified ||
      !Object.isFrozen(rawVerified) ||
      verified.kind !== 'verified' ||
      verified.reference !== issued.reference ||
      !isPolicyRevisionReference(verified.reference)
    ) {
      return null;
    }
    return verified.reference;
  } catch {
    return null;
  }
}

async function authorizeCurrentSection(
  dependencies: DependenciesV1,
  value: InstitutionSectionGuardInputV1,
): Promise<InstitutionSectionGuardResolutionV1> {
  if (dependencies.preflightFailure) {
    return reject(dependencies.preflightFailure);
  }
  if (!dependencies.authorizeCurrentRequest) return reject('scope_unavailable');
  let rawScopeResolution: unknown;
  try {
    rawScopeResolution = await dependencies.authorizeCurrentRequest();
  } catch {
    return reject('scope_unavailable');
  }
  if (!isInstitutionScopeAllowV1(rawScopeResolution)) {
    return reject('scope_unavailable');
  }
  const decisionTime = trustedNow(dependencies.now);
  if (!decisionTime || !scopeIsCurrent(rawScopeResolution, decisionTime)) {
    return reject('scope_unavailable');
  }
  const input = snapshotExactPlainRecord(value, AUTHORIZE_INPUT_KEYS);
  if (!input || !isInstitutionNavigationSectionIdV1(input.sectionId)) {
    return reject('action_unregistered');
  }
  const sectionId = input.sectionId;
  if (!SECTION_ROLE_MANIFEST[sectionId].some((role) => role === rawScopeResolution.role)) {
    return reject('action_role_denied');
  }
  const policyRevision = issuePolicyRevision(dependencies);
  if (!policyRevision) return reject('policy_unavailable');

  const allow = Object.freeze({
    kind: 'institution_section_allow',
    sectionId,
    action: 'section_enter',
    policyRevision,
    decidedAt: decisionTime.raw,
    validUntil: rawScopeResolution.validUntil,
  });
  authenticAllows.add(allow);
  return allow as unknown as InstitutionSectionAllowV1;
}

export function isInstitutionSectionGuardV1(
  value: unknown,
): value is InstitutionSectionGuardV1 {
  return value !== null && typeof value === 'object' && !isProxy(value) && authenticGuards.has(value);
}

export function isInstitutionSectionAllowV1(
  value: unknown,
): value is InstitutionSectionAllowV1 {
  return value !== null && typeof value === 'object' && !isProxy(value) && authenticAllows.has(value);
}

/**
 * Composes a genuine request scope guard into section-entry authorization. It accepts no caller
 * scope, role, evidence, policy revision, or business permission and exposes no parser or handle
 * registration surface.
 */
export function createInstitutionSectionGuardV1(input: Readonly<{
  scopeGuard: InstitutionScopeGuardV1;
  referenceCodec: InstitutionGuardReferenceCodecV1;
  now: () => Date;
}>): InstitutionSectionGuardV1 {
  const dependencies = snapshotDependencies(input);
  const guard = Object.freeze({
    authorizeCurrentSection: (value: InstitutionSectionGuardInputV1) =>
      authorizeCurrentSection(dependencies, value),
  });
  authenticGuards.add(guard);
  return guard as unknown as InstitutionSectionGuardV1;
}
