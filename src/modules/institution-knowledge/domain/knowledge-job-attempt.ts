import { isProxy } from 'node:util/types';

/**
 * This module deliberately produces non-authorizing command proposals only.
 * It has no owner-sealed snapshot, trusted clock, server-issued lease/attempt
 * reference, authorization result, repository revision, or idempotency store.
 */
export const knowledgeJobKinds = Object.freeze([
  'parse',
  'ocr',
  'index',
] as const);
export const knowledgeJobProposalKinds = Object.freeze([
  'create_job',
  'claim_attempt',
  'complete_attempt',
  'cancel_job',
] as const);
export const knowledgeJobRequestedOutcomes = Object.freeze([
  'succeeded',
  'failed',
] as const);
export const knowledgeJobProposalFailureCodes = Object.freeze([
  'actor_candidate_invalid',
  'command_idempotency_key_invalid',
  'input_invalid',
  'job_candidate_invalid',
  'requested_outcome_invalid',
  'target_candidate_invalid',
] as const);
export const knowledgeJobBlockedReasonCodes = Object.freeze([
  'actor_authorization_required',
  'cancellation_requires_unexecuted_job',
  'canonical_target_binding_required',
  'idempotency_result_store_required',
  'ocr_adapter_unavailable',
  'ocr_required',
  'owner_sealed_snapshot_required',
  'repository_revision_cas_required',
  'server_issued_attempt_reference_required',
  'server_issued_lease_reference_required',
  'trusted_server_clock_required',
] as const);
export const knowledgeJobTerminalReasonCodes = Object.freeze([
  'expired',
  'failed',
  'cancelled',
] as const);

export type KnowledgeJobKind = (typeof knowledgeJobKinds)[number];
export type KnowledgeJobProposalKind =
  (typeof knowledgeJobProposalKinds)[number];
export type KnowledgeJobRequestedOutcome =
  (typeof knowledgeJobRequestedOutcomes)[number];
export type KnowledgeJobProposalFailureCode =
  (typeof knowledgeJobProposalFailureCodes)[number];
export type KnowledgeJobBlockedReasonCode =
  (typeof knowledgeJobBlockedReasonCodes)[number];
export type KnowledgeJobTerminalReasonCode =
  (typeof knowledgeJobTerminalReasonCodes)[number];

export type KnowledgeJobProposal = Readonly<{
  authorization: 'non_authorizing';
  executionStatus: 'blocked';
  proposalKind: KnowledgeJobProposalKind;
  commandIdempotencyKey: string;
  jobCandidateRef: string | null;
  targetCandidateRef: string;
  actorCandidateRef: string;
  requestedOutcome: KnowledgeJobRequestedOutcome | null;
  blockedReasonCodes: readonly KnowledgeJobBlockedReasonCode[];
  executionPreconditions: readonly KnowledgeJobExecutionPrecondition[];
  attemptRules: KnowledgeJobAttemptRules;
}>;

export type KnowledgeJobExecutionPrecondition = Readonly<{
  code: KnowledgeJobBlockedReasonCode;
  description: string;
}>;

export type KnowledgeJobAttemptRules = Readonly<{
  leaseWindow: 'leaseUntil > claimedAt';
  attemptAndResultTime: 'strictly_monotonic';
  takeover: Readonly<{
    requiresTerminalReason: true;
    allowedTerminalReasonCodes: readonly KnowledgeJobTerminalReasonCode[];
  }>;
  failureRetry: Readonly<{
    permittedOnlyAfterAppendOnlyFailureResult: true;
    retryLimitCandidate: number;
  }>;
}>;

export type KnowledgeJobProposalDecision =
  | Readonly<{ ok: true; proposal: KnowledgeJobProposal }>
  | Readonly<{
      ok: false;
      reasonCodes: readonly KnowledgeJobProposalFailureCode[];
    }>;

const opaqueReferencePatterns = Object.freeze({
  actor: /^actor_[a-f0-9]{64}$/,
  command: /^cmd_[a-f0-9]{64}$/,
  job: /^job_[a-f0-9]{64}$/,
  target: /^(?:bodyrev|filerev|chunkrev)_[a-f0-9]{64}$/,
});
const retryLimitCandidate = 3;

const preconditionDescriptions = Object.freeze({
  actor_authorization_required:
    '执行方必须以服务端授权结果绑定操作者候选引用。',
  cancellation_requires_unexecuted_job:
    '取消前必须由 owner-sealed snapshot 证明尚未存在已执行 attempt。',
  canonical_target_binding_required:
    '执行方必须将目标候选引用绑定到权威 revision。',
  idempotency_result_store_required:
    '执行方必须在持久化结果存储中核验稳定 command idempotency key。',
  ocr_adapter_unavailable:
    'OCR adapter 未获批准或不可用，不能生成 OCR 成功或完成结果。',
  ocr_required: 'OCR 任务在 adapter 验收前必须保持 ocr_required。',
  owner_sealed_snapshot_required:
    '执行方必须使用 owner-sealed current snapshot，而不是调用方提供的 state。',
  repository_revision_cas_required:
    '执行方必须在 repository revision 上执行 compare-and-swap。',
  server_issued_attempt_reference_required:
    'attempt 引用必须由服务端以高熵 opaque reference 新签发。',
  server_issued_lease_reference_required:
    'lease 引用必须由服务端以高熵 opaque reference 新签发。',
  trusted_server_clock_required:
    '时间、leaseUntil 与单调性必须由可信服务端时钟核验。',
} satisfies Record<KnowledgeJobBlockedReasonCode, string>);

function isProxySafe(value: unknown): boolean {
  try {
    return isProxy(value);
  } catch {
    return true;
  }
}

function snapshotExactRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
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

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.some((key) => typeof key !== 'string') ||
      ownKeys.length !== expectedKeys.length ||
      !expectedKeys.every((key) => ownKeys.includes(key))
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = {};
    for (const key of expectedKeys) {
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
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function isOpaqueReference(
  value: unknown,
  kind: keyof typeof opaqueReferencePatterns,
): value is string {
  return typeof value === 'string' && opaqueReferencePatterns[kind].test(value);
}

function isOneOf<T extends string>(
  value: unknown,
  choices: readonly T[],
): value is T {
  return typeof value === 'string' && choices.includes(value as T);
}

function immutableAttemptRules(): KnowledgeJobAttemptRules {
  return Object.freeze({
    leaseWindow: 'leaseUntil > claimedAt',
    attemptAndResultTime: 'strictly_monotonic',
    takeover: Object.freeze({
      requiresTerminalReason: true,
      allowedTerminalReasonCodes: Object.freeze([
        'expired',
        'failed',
        'cancelled',
      ] as const),
    }),
    failureRetry: Object.freeze({
      permittedOnlyAfterAppendOnlyFailureResult: true,
      retryLimitCandidate,
    }),
  });
}

function preconditionsFor(
  kind: KnowledgeJobProposalKind,
  jobKind: KnowledgeJobKind | null,
): readonly KnowledgeJobExecutionPrecondition[] {
  const codes: KnowledgeJobBlockedReasonCode[] = [
    'owner_sealed_snapshot_required',
    'trusted_server_clock_required',
    'canonical_target_binding_required',
    'actor_authorization_required',
    'repository_revision_cas_required',
    'idempotency_result_store_required',
  ];
  if (kind === 'claim_attempt' || kind === 'complete_attempt') {
    codes.push(
      'server_issued_attempt_reference_required',
      'server_issued_lease_reference_required',
    );
  }
  if (kind === 'cancel_job') {
    codes.push('cancellation_requires_unexecuted_job');
  }
  if (jobKind === 'ocr') {
    codes.push('ocr_required', 'ocr_adapter_unavailable');
  }
  return Object.freeze(
    codes.map((code) =>
      Object.freeze({ code, description: preconditionDescriptions[code] }),
    ),
  );
}

function proposalSuccess(
  proposalKind: KnowledgeJobProposalKind,
  commandIdempotencyKey: string,
  jobCandidateRef: string | null,
  targetCandidateRef: string,
  actorCandidateRef: string,
  requestedOutcome: KnowledgeJobRequestedOutcome | null,
  jobKind: KnowledgeJobKind | null,
): KnowledgeJobProposalDecision {
  const executionPreconditions = preconditionsFor(proposalKind, jobKind);
  return Object.freeze({
    ok: true,
    proposal: Object.freeze({
      authorization: 'non_authorizing',
      executionStatus: 'blocked',
      proposalKind,
      commandIdempotencyKey,
      jobCandidateRef,
      targetCandidateRef,
      actorCandidateRef,
      requestedOutcome,
      blockedReasonCodes: Object.freeze(
        executionPreconditions.map((precondition) => precondition.code),
      ),
      executionPreconditions,
      attemptRules: immutableAttemptRules(),
    }),
  });
}

function failure(
  reasonCode: KnowledgeJobProposalFailureCode,
): KnowledgeJobProposalDecision {
  return Object.freeze({
    ok: false,
    reasonCodes: Object.freeze([reasonCode]),
  });
}

export function proposeKnowledgeJobCreation(
  input: unknown,
): KnowledgeJobProposalDecision {
  const candidate = snapshotExactRecord(input, [
    'commandIdempotencyKey',
    'targetCandidateRef',
    'actorCandidateRef',
    'jobKind',
  ]);
  if (candidate === null) return failure('input_invalid');
  if (!isOpaqueReference(candidate.commandIdempotencyKey, 'command')) {
    return failure('command_idempotency_key_invalid');
  }
  if (!isOpaqueReference(candidate.targetCandidateRef, 'target')) {
    return failure('target_candidate_invalid');
  }
  if (!isOpaqueReference(candidate.actorCandidateRef, 'actor')) {
    return failure('actor_candidate_invalid');
  }
  if (!isOneOf(candidate.jobKind, knowledgeJobKinds)) {
    return failure('input_invalid');
  }
  return proposalSuccess(
    'create_job',
    candidate.commandIdempotencyKey,
    null,
    candidate.targetCandidateRef,
    candidate.actorCandidateRef,
    null,
    candidate.jobKind,
  );
}

export function proposeKnowledgeJobAttemptClaim(
  input: unknown,
): KnowledgeJobProposalDecision {
  const candidate = snapshotExactRecord(input, [
    'commandIdempotencyKey',
    'jobCandidateRef',
    'targetCandidateRef',
    'actorCandidateRef',
    'jobKind',
  ]);
  if (candidate === null) return failure('input_invalid');
  if (!isOpaqueReference(candidate.commandIdempotencyKey, 'command')) {
    return failure('command_idempotency_key_invalid');
  }
  if (!isOpaqueReference(candidate.targetCandidateRef, 'target')) {
    return failure('target_candidate_invalid');
  }
  if (!isOpaqueReference(candidate.actorCandidateRef, 'actor')) {
    return failure('actor_candidate_invalid');
  }
  if (!isOpaqueReference(candidate.jobCandidateRef, 'job')) {
    return failure('job_candidate_invalid');
  }
  if (!isOneOf(candidate.jobKind, knowledgeJobKinds)) {
    return failure('input_invalid');
  }
  return proposalSuccess(
    'claim_attempt',
    candidate.commandIdempotencyKey,
    candidate.jobCandidateRef,
    candidate.targetCandidateRef,
    candidate.actorCandidateRef,
    null,
    candidate.jobKind,
  );
}

export function proposeKnowledgeJobAttemptCompletion(
  input: unknown,
): KnowledgeJobProposalDecision {
  const candidate = snapshotExactRecord(input, [
    'commandIdempotencyKey',
    'jobCandidateRef',
    'targetCandidateRef',
    'actorCandidateRef',
    'jobKind',
    'requestedOutcome',
  ]);
  if (candidate === null) return failure('input_invalid');
  if (!isOpaqueReference(candidate.commandIdempotencyKey, 'command')) {
    return failure('command_idempotency_key_invalid');
  }
  if (!isOpaqueReference(candidate.targetCandidateRef, 'target')) {
    return failure('target_candidate_invalid');
  }
  if (!isOpaqueReference(candidate.actorCandidateRef, 'actor')) {
    return failure('actor_candidate_invalid');
  }
  if (!isOpaqueReference(candidate.jobCandidateRef, 'job')) {
    return failure('job_candidate_invalid');
  }
  if (!isOneOf(candidate.jobKind, knowledgeJobKinds)) {
    return failure('input_invalid');
  }
  if (!isOneOf(candidate.requestedOutcome, knowledgeJobRequestedOutcomes)) {
    return failure('requested_outcome_invalid');
  }
  const requestedOutcome =
    candidate.jobKind === 'ocr' && candidate.requestedOutcome === 'succeeded'
      ? null
      : candidate.requestedOutcome;
  return proposalSuccess(
    'complete_attempt',
    candidate.commandIdempotencyKey,
    candidate.jobCandidateRef,
    candidate.targetCandidateRef,
    candidate.actorCandidateRef,
    requestedOutcome,
    candidate.jobKind,
  );
}

export function proposeKnowledgeJobCancellation(
  input: unknown,
): KnowledgeJobProposalDecision {
  const candidate = snapshotExactRecord(input, [
    'commandIdempotencyKey',
    'jobCandidateRef',
    'targetCandidateRef',
    'actorCandidateRef',
    'jobKind',
  ]);
  if (candidate === null) return failure('input_invalid');
  if (!isOpaqueReference(candidate.commandIdempotencyKey, 'command')) {
    return failure('command_idempotency_key_invalid');
  }
  if (!isOpaqueReference(candidate.targetCandidateRef, 'target')) {
    return failure('target_candidate_invalid');
  }
  if (!isOpaqueReference(candidate.actorCandidateRef, 'actor')) {
    return failure('actor_candidate_invalid');
  }
  if (!isOpaqueReference(candidate.jobCandidateRef, 'job')) {
    return failure('job_candidate_invalid');
  }
  if (!isOneOf(candidate.jobKind, knowledgeJobKinds)) {
    return failure('input_invalid');
  }
  return proposalSuccess(
    'cancel_job',
    candidate.commandIdempotencyKey,
    candidate.jobCandidateRef,
    candidate.targetCandidateRef,
    candidate.actorCandidateRef,
    null,
    candidate.jobKind,
  );
}
