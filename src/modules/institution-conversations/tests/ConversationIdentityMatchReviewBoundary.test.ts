import { describe, expect, it } from 'vitest';

import {
  parseIdentityMatchReviewCandidate,
  proposeIdentityMatchReviewTransition,
} from '@/modules/institution-conversations/domain/conversation-identity-match-reviews';

const token = (digit: string) => digit.repeat(64);
const refs = Object.freeze({
  reviewId: `review_${token('a')}`,
  conversationId: `conv_${token('b')}`,
  segmentId: `seg_${token('c')}`,
  connectionId: `conn_${token('d')}`,
  identity: `irid_${token('e')}`,
  candidateDigest: `candsum_${token('f')}`,
  alternateDigest: `candsum_${token('a')}`,
  submittedBy: `actor_${token('b')}`,
  customer: `cust_${token('d')}`,
  otherConversation: `conv_${token('e')}`,
});

function candidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: 'v1', reviewId: refs.reviewId, tenantId: 'tenant-safe', institutionId: 'institution-safe',
    conversationId: refs.conversationId, segmentId: refs.segmentId, connectionInstanceId: refs.connectionId,
    irreversibleIdentityReference: refs.identity, candidateSnapshotVersion: 1, candidateSetDigest: refs.candidateDigest,
    submittedBy: refs.submittedBy, assignedReviewer: null, lastDecision: null, lastDecisionReasonCode: null,
    lastDecisionActorReference: null, resolvedCustomerScope: null, resolvedCustomerReference: null, ...overrides,
  };
}

function proposal(fromState = 'pending_review', toState = 'awaiting_customer_creation', action = 'delegate_create_customer', overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: 'v1', reviewId: refs.reviewId, tenantId: 'tenant-safe', institutionId: 'institution-safe',
    conversationId: refs.conversationId, segmentId: refs.segmentId, connectionInstanceId: refs.connectionId,
    irreversibleIdentityReference: refs.identity, expectedRevision: 1, expectedCandidateSnapshotVersion: 1,
    expectedCandidateSetDigest: refs.candidateDigest, nextCandidateSnapshotVersion: 1,
    nextCandidateSetDigest: refs.candidateDigest, fromState, toState, action,
    proposedCustomerScope: null, proposedCustomerReference: null, ...overrides,
  };
}

describe('Conversation identity match review candidate boundary', () => {
  it.each([
    ['rejected resurrection', 'rejected', 'pending_review', 'return_to_pending'],
    ['withdrawn resurrection', 'withdrawn', 'pending_review', 'return_to_pending'],
    ['expired match', 'expired', 'matched', 'confirm_existing'],
    ['expired create', 'expired', 'awaiting_customer_creation', 'delegate_create_customer'],
    ['revoked resurrection', 'revoked', 'pending_review', 'return_to_pending'],
  ] as const)('rejects %s', (_name, fromState, toState, action) => {
    expect(proposeIdentityMatchReviewTransition(proposal(fromState, toState, action))).toEqual({ kind: 'blocked', code: 'state_conflict' });
  });

  it('does not create a revision branch: equal raw commands remain proposals requiring owner CAS', () => {
    const first = proposeIdentityMatchReviewTransition(proposal());
    const second = proposeIdentityMatchReviewTransition(proposal());
    expect(first.kind).toBe('transition_proposal');
    expect(second.kind).toBe('transition_proposal');
    if (first.kind !== 'transition_proposal' || second.kind !== 'transition_proposal') return;
    expect(first.proposal.expectedRevision).toBe(1);
    expect(second.proposal.expectedRevision).toBe(1);
    expect(first.proposal.ownerRequirements).toContain('revision_cas');
    expect(first.proposal).not.toHaveProperty('nextRevision');
  });

  it('treats a raw customer reference only as a proposal requiring an owner-verified composite result', () => {
    const result = proposeIdentityMatchReviewTransition(proposal('awaiting_customer_creation', 'matched', 'complete_customer_creation', {
      proposedCustomerScope: { tenantId: 'tenant-safe', institutionId: 'institution-safe' }, proposedCustomerReference: refs.customer,
    }));
    expect(result.kind).toBe('transition_proposal');
    if (result.kind !== 'transition_proposal') return;
    expect(result.proposal.customerResolutionRequirement).toBe('customer_center_owner_verified_result');
    expect(result.proposal.ownerRequirements).toContain('customer_center_same_institution_result');
    expect(result).not.toHaveProperty('matched');
  });

  it('rejects cross-scope customer claims and candidate changes outside conflict refresh', () => {
    expect(proposeIdentityMatchReviewTransition(proposal('pending_review', 'matched', 'confirm_existing', {
      proposedCustomerScope: { tenantId: 'tenant-other', institutionId: 'institution-safe' }, proposedCustomerReference: refs.customer,
    }))).toEqual({ kind: 'blocked', code: 'customer_scope_mismatch' });
    expect(proposeIdentityMatchReviewTransition(proposal('pending_review', 'awaiting_customer_creation', 'delegate_create_customer', {
      nextCandidateSnapshotVersion: 2, nextCandidateSetDigest: refs.alternateDigest,
    }))).toEqual({ kind: 'blocked', code: 'candidate_snapshot_mismatch' });
  });

  it('rejects missing candidate refresh proof', () => {
    expect(proposeIdentityMatchReviewTransition(proposal('conflict', 'pending_review', 'refresh_candidates'))).toEqual({ kind: 'blocked', code: 'candidate_refresh_required' });
  });

  it('treats arbitrary newer candidate versions and digests only as owner-gated proposals', () => {
    const result = proposeIdentityMatchReviewTransition(proposal('conflict', 'pending_review', 'refresh_candidates', {
      nextCandidateSnapshotVersion: 999,
      nextCandidateSetDigest: refs.alternateDigest,
    }));
    expect(result.kind).toBe('transition_proposal');
    if (result.kind !== 'transition_proposal') return;
    expect(result.proposal.ownerRequirements).toContain('owner_verified_candidate_refresh');
    expect(result).not.toHaveProperty('applied');
    expect(result).not.toHaveProperty('current');
  });

  it('rejects Proxy, accessor, hidden prototype, symbol, and extra-key candidate wrappers', () => {
    const accessor = candidate() as Record<string, unknown>;
    Object.defineProperty(accessor, 'submittedBy', { enumerable: true, get: () => refs.submittedBy });
    expect(parseIdentityMatchReviewCandidate(accessor)).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(parseIdentityMatchReviewCandidate(new Proxy(candidate(), {}))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(parseIdentityMatchReviewCandidate(Object.assign(Object.create({ inherited: 'hidden' }), candidate()))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    const symbolic = candidate() as Record<PropertyKey, unknown>;
    symbolic[Symbol('hidden')] = 'nope';
    expect(parseIdentityMatchReviewCandidate(symbolic)).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(parseIdentityMatchReviewCandidate({ ...candidate(), extra: 'nope' })).toEqual({ kind: 'blocked', code: 'input_invalid' });
  });

  it('rejects Proxy, accessor, symbol, and extra-key transition wrappers', () => {
    const accessor = proposal() as Record<string, unknown>;
    Object.defineProperty(accessor, 'reviewId', { enumerable: true, get: () => refs.reviewId });
    expect(proposeIdentityMatchReviewTransition(accessor)).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(proposeIdentityMatchReviewTransition(new Proxy(proposal(), {}))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(proposeIdentityMatchReviewTransition(Object.assign(Object.create({ inherited: 'hidden' }), proposal()))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    const symbolic = proposal() as Record<PropertyKey, unknown>;
    symbolic[Symbol('hidden')] = 'nope';
    expect(proposeIdentityMatchReviewTransition(symbolic)).toEqual({ kind: 'blocked', code: 'input_invalid' });
    expect(proposeIdentityMatchReviewTransition({ ...proposal(), extra: 'nope' })).toEqual({ kind: 'blocked', code: 'input_invalid' });
  });

  it('rejects low-sensitivity violations and hidden authoritative state expansion', () => {
    for (const unsafeValue of ['张三', '上海市静安区南京西路', '完整聊天正文', 'wxid_abc123', '138-0013-8000', '110105-19491231-002X', '病历诊断：高血压']) {
      expect(parseIdentityMatchReviewCandidate(candidate({ reviewId: unsafeValue }))).toEqual({ kind: 'blocked', code: 'input_invalid' });
    }
    expect(parseIdentityMatchReviewCandidate({ ...candidate(), state: 'rejected' })).toEqual({ kind: 'blocked', code: 'input_invalid' });
  });
});
