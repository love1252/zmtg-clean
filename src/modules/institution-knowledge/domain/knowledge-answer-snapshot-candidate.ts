import { isProxy } from 'node:util/types';

/**
 * This module only describes an untrusted, non-authorizing candidate. It has
 * no owner-sealed publication/citation snapshot, BASE guard result, retention
 * decision, capability release, or MIG-03 atomic persistence boundary.
 */
export const knowledgeAnswerNoAnswerReasons = Object.freeze([
  'no_authoritative_reference',
  'publication_unavailable',
  'relevance_insufficient',
  'safety_not_allowed',
  'scope_unavailable',
  'capability_disabled',
] as const);

export const knowledgeAnswerSecurityResultCandidates = Object.freeze([
  'allowed',
  'blocked',
  'unknown',
] as const);

export const knowledgeAnswerCandidateFailureCodes = Object.freeze([
  'input_invalid',
] as const);

export const knowledgeAnswerCandidateOwnerRequirementCodes = Object.freeze([
  'owner_sealed_current_publication_citations_required',
  'base_fresh_institution_action_object_guard_required',
  'authoritative_single_scope_required',
  'result_safety_validation_required',
  'mig03_atomic_snapshot_audit_required',
  'retention_required',
  'capability_release_required',
] as const);

export type KnowledgeAnswerNoAnswerReason =
  (typeof knowledgeAnswerNoAnswerReasons)[number];
export type KnowledgeAnswerSecurityResultCandidate =
  (typeof knowledgeAnswerSecurityResultCandidates)[number];
export type KnowledgeAnswerCandidateFailureCode =
  (typeof knowledgeAnswerCandidateFailureCodes)[number];
export type KnowledgeAnswerCandidateOwnerRequirementCode =
  (typeof knowledgeAnswerCandidateOwnerRequirementCodes)[number];

export type KnowledgeAnswerCandidateOwnerRequirement = Readonly<{
  code: KnowledgeAnswerCandidateOwnerRequirementCode;
  description: string;
}>;

export type KnowledgeAnswerSnapshotCandidate = Readonly<{
  authorization: 'non_authorizing';
  kind: 'non_authorizing_candidate';
  status: 'blocked';
  candidateReference: string;
  noAnswerReason: KnowledgeAnswerNoAnswerReason;
  securityResultCandidate: KnowledgeAnswerSecurityResultCandidate;
  ownerRequirements: readonly KnowledgeAnswerCandidateOwnerRequirement[];
}>;

export type KnowledgeAnswerSnapshotCandidateDecision =
  | Readonly<{ ok: true; candidate: KnowledgeAnswerSnapshotCandidate }>
  | Readonly<{
      ok: false;
      reasonCodes: readonly KnowledgeAnswerCandidateFailureCode[];
    }>;

type CandidateInput = Readonly<{
  candidateReference: string;
  scopeKind: 'institution' | 'customer';
  scopeReferenceHash: string;
  questionHash: string;
  questionLength: number;
  contentHash: string;
  contentLength: number;
  citationReferenceHashes: readonly string[];
  securityResultCandidate: KnowledgeAnswerSecurityResultCandidate;
  noAnswerReason: KnowledgeAnswerNoAnswerReason;
}>;

const expectedInputKeys = Object.freeze([
  'candidateReference',
  'scopeKind',
  'scopeReferenceHash',
  'questionHash',
  'questionLength',
  'contentHash',
  'contentLength',
  'citationReferenceHashes',
  'securityResultCandidate',
  'noAnswerReason',
] as const);

const opaquePatterns = Object.freeze({
  candidateReference: /^anscand_[a-f0-9]{64}$/,
  scopeReferenceHash: /^scope_[a-f0-9]{64}$/,
  hash: /^sha256:[a-f0-9]{64}$/,
  citationReferenceHash: /^cite_[a-f0-9]{64}$/,
});
const opaqueLengths = Object.freeze({
  candidateReference: 72,
  scopeReferenceHash: 70,
  hash: 71,
  citationReferenceHash: 69,
});
const maximumQuestionLength = 4096;
const maximumContentLength = 1_000_000;
const maximumCitationReferences = 16;

const ownerRequirementDescriptions = Object.freeze({
  owner_sealed_current_publication_citations_required:
    '必须由 owner-sealed current publication 与版本化引用确认候选输入。',
  base_fresh_institution_action_object_guard_required:
    '必须由 BASE 新鲜 institution、action 与 object guard 授权。',
  authoritative_single_scope_required:
    '必须由权威 reader 确认恰好一个 institution 或 customer scope。',
  result_safety_validation_required: '必须通过结果安全校验后才可执行。',
  mig03_atomic_snapshot_audit_required:
    '必须在 MIG-03 原子 snapshot 与 audit 边界中持久化。',
  retention_required: '必须由 retention 决定预览与历史引用的保留边界。',
  capability_release_required: '必须经 capability 与 release 门禁批准。',
} satisfies Record<KnowledgeAnswerCandidateOwnerRequirementCode, string>);

function isProxySafe(value: unknown): boolean {
  try {
    return isProxy(value);
  } catch {
    return true;
  }
}

function snapshotExactRecord(value: unknown): CandidateInput | null {
  try {
    if (
      typeof value !== 'object' ||
      value === null ||
      isProxySafe(value) ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<
      string,
      PropertyDescriptor
    >;
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.some((key) => typeof key !== 'string') ||
      ownKeys.length !== expectedInputKeys.length ||
      !expectedInputKeys.every((key) => ownKeys.includes(key))
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = {};
    for (const key of expectedInputKeys) {
      const descriptor = descriptors[key];
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !('value' in descriptor)
      ) {
        return null;
      }
      snapshot[key] = descriptor.value;
    }

    return Object.freeze(snapshot) as CandidateInput;
  } catch {
    return null;
  }
}

function snapshotOpaqueReferenceList(value: unknown): readonly string[] | null {
  try {
    if (
      !Array.isArray(value) ||
      isProxySafe(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      value.length < 1 ||
      value.length > maximumCitationReferences
    ) {
      return null;
    }

    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<
      string,
      PropertyDescriptor
    >;
    const expectedKeys = [
      ...Array.from({ length: value.length }, (_, index) => String(index)),
      'length',
    ];
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.some((key) => typeof key !== 'string') ||
      ownKeys.length !== expectedKeys.length ||
      !expectedKeys.every((key) => ownKeys.includes(key))
    ) {
      return null;
    }

    const lengthDescriptor = descriptors['length'];
    if (
      lengthDescriptor === undefined ||
      lengthDescriptor.enumerable ||
      !('value' in lengthDescriptor) ||
      lengthDescriptor.value !== value.length
    ) {
      return null;
    }

    const snapshot: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (
        descriptor === undefined ||
        descriptor.enumerable !== true ||
        !('value' in descriptor) ||
        typeof descriptor.value !== 'string' ||
        !matchesOpaque(
          descriptor.value,
          opaquePatterns.citationReferenceHash,
          opaqueLengths.citationReferenceHash,
        )
      ) {
        return null;
      }
      snapshot.push(descriptor.value);
    }

    return new Set(snapshot).size === snapshot.length
      ? Object.freeze(snapshot)
      : null;
  } catch {
    return null;
  }
}

function isOneOf<T extends string>(
  value: unknown,
  choices: readonly T[],
): value is T {
  return typeof value === 'string' && choices.includes(value as T);
}

function matchesOpaque(
  value: unknown,
  pattern: RegExp,
  expectedLength: number,
): value is string {
  return (
    typeof value === 'string' &&
    value.length === expectedLength &&
    pattern.test(value)
  );
}

function isBoundedSafeInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isValidInput(input: CandidateInput): boolean {
  const citations = snapshotOpaqueReferenceList(input.citationReferenceHashes);
  return (
    matchesOpaque(
      input.candidateReference,
      opaquePatterns.candidateReference,
      opaqueLengths.candidateReference,
    ) &&
    isOneOf(input.scopeKind, ['institution', 'customer']) &&
    matchesOpaque(
      input.scopeReferenceHash,
      opaquePatterns.scopeReferenceHash,
      opaqueLengths.scopeReferenceHash,
    ) &&
    matchesOpaque(input.questionHash, opaquePatterns.hash, opaqueLengths.hash) &&
    isBoundedSafeInteger(input.questionLength, 1, maximumQuestionLength) &&
    matchesOpaque(input.contentHash, opaquePatterns.hash, opaqueLengths.hash) &&
    isBoundedSafeInteger(input.contentLength, 0, maximumContentLength) &&
    citations !== null &&
    isOneOf(
      input.securityResultCandidate,
      knowledgeAnswerSecurityResultCandidates,
    ) &&
    isOneOf(input.noAnswerReason, knowledgeAnswerNoAnswerReasons)
  );
}

function ownerRequirements(): readonly KnowledgeAnswerCandidateOwnerRequirement[] {
  return Object.freeze(
    knowledgeAnswerCandidateOwnerRequirementCodes.map((code) =>
      Object.freeze({ code, description: ownerRequirementDescriptions[code] }),
    ),
  );
}

function blockedInput(): KnowledgeAnswerSnapshotCandidateDecision {
  return Object.freeze({
    ok: false,
    reasonCodes: Object.freeze(['input_invalid'] as const),
  });
}

/**
 * Validates only bounded, opaque candidate metadata. A successful return is
 * deliberately still blocked and cannot authorize an answer, reference use,
 * persistence, or any release action.
 */
export function proposeKnowledgeAnswerSnapshotCandidate(
  rawInput: unknown,
): KnowledgeAnswerSnapshotCandidateDecision {
  const input = snapshotExactRecord(rawInput);
  if (input === null || !isValidInput(input)) {
    return blockedInput();
  }

  return Object.freeze({
    ok: true,
    candidate: Object.freeze({
      authorization: 'non_authorizing',
      kind: 'non_authorizing_candidate',
      status: 'blocked',
      candidateReference: input.candidateReference,
      noAnswerReason: input.noAnswerReason,
      securityResultCandidate: input.securityResultCandidate,
      ownerRequirements: ownerRequirements(),
    }),
  });
}
