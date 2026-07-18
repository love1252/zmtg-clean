import { describe, expect, it } from 'vitest';

import {
  identityMatchReviewLegalTransitions,
  isIdentityMatchReviewTerminalState,
  isLegalIdentityMatchReviewTransition,
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
  nextCandidateDigest: `candsum_${token('a')}`,
  submittedBy: `actor_${token('b')}`,
  decisionActor: `actor_${token('c')}`,
  customer: `cust_${token('d')}`,
});

function candidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: 'v1', reviewId: refs.reviewId, tenantId: 'tenant-1', institutionId: 'institution-1',
    conversationId: refs.conversationId, segmentId: refs.segmentId, connectionInstanceId: refs.connectionId,
    irreversibleIdentityReference: refs.identity, candidateSnapshotVersion: 1, candidateSetDigest: refs.candidateDigest,
    submittedBy: refs.submittedBy, assignedReviewer: null, lastDecision: null, lastDecisionReasonCode: null,
    lastDecisionActorReference: null, resolvedCustomerScope: null, resolvedCustomerReference: null, ...overrides,
  };
}

function proposal(fromState: string, toState: string, action: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: 'v1', reviewId: refs.reviewId, tenantId: 'tenant-1', institutionId: 'institution-1',
    conversationId: refs.conversationId, segmentId: refs.segmentId, connectionInstanceId: refs.connectionId,
    irreversibleIdentityReference: refs.identity, expectedRevision: 1, expectedCandidateSnapshotVersion: 1,
    expectedCandidateSetDigest: refs.candidateDigest, nextCandidateSnapshotVersion: 1,
    nextCandidateSetDigest: refs.candidateDigest, fromState, toState, action,
    proposedCustomerScope: null, proposedCustomerReference: null, ...overrides,
  };
}

describe('Conversation identity match review candidate domain', () => {
  it('parses only an immutable, untrusted low-sensitivity candidate', () => {
    const raw = candidate();
    const before = structuredClone(raw);
    const result = parseIdentityMatchReviewCandidate(raw);

    expect(result.kind).toBe('untrusted_candidate');
    if (result.kind !== 'untrusted_candidate') return;
    expect(Object.isFrozen(result.candidate)).toBe(true);
    expect(result.candidate).not.toHaveProperty('state');
    expect(result.candidate).not.toHaveProperty('candidateReference');
    expect(raw).toEqual(before);
  });

  it('lists the exact eight-state legal relation matrix without applying any state', () => {
    expect(identityMatchReviewLegalTransitions).toHaveLength(13);
    expect(isLegalIdentityMatchReviewTransition('pending_review', 'matched', 'confirm_existing')).toBe(true);
    expect(isLegalIdentityMatchReviewTransition('conflict', 'pending_review', 'refresh_candidates')).toBe(true);
    expect(isLegalIdentityMatchReviewTransition('rejected', 'pending_review', 'return_to_pending')).toBe(false);
    expect(isIdentityMatchReviewTerminalState('rejected')).toBe(true);
    expect(isIdentityMatchReviewTerminalState('matched')).toBe(false);
  });

  it('deep-freezes legal transition entries against hostile mutation', () => {
    const hostileEntry = identityMatchReviewLegalTransitions[0] as unknown as { to: string };
    expect(() => { hostileEntry.to = 'pending_review'; }).toThrow(TypeError);
    expect(isLegalIdentityMatchReviewTransition('rejected', 'pending_review', 'return_to_pending')).toBe(false);
  });

  it.each([
    ['pending_review', 'matched', 'confirm_existing', { proposedCustomerScope: { tenantId: 'tenant-1', institutionId: 'institution-1' }, proposedCustomerReference: refs.customer }, 'owner_verified_existing_customer_reference'],
    ['pending_review', 'awaiting_customer_creation', 'delegate_create_customer', {}, 'none'],
    ['pending_review', 'rejected', 'reject', {}, 'none'],
    ['pending_review', 'conflict', 'mark_conflict', {}, 'none'],
    ['pending_review', 'withdrawn', 'withdraw', {}, 'none'],
    ['pending_review', 'expired', 'expire', {}, 'none'],
    ['awaiting_customer_creation', 'matched', 'complete_customer_creation', { proposedCustomerScope: { tenantId: 'tenant-1', institutionId: 'institution-1' }, proposedCustomerReference: refs.customer }, 'customer_center_owner_verified_result'],
    ['awaiting_customer_creation', 'pending_review', 'return_to_pending', {}, 'none'],
    ['awaiting_customer_creation', 'conflict', 'mark_conflict', {}, 'none'],
    ['awaiting_customer_creation', 'withdrawn', 'withdraw', {}, 'none'],
    ['awaiting_customer_creation', 'expired', 'expire', {}, 'none'],
    ['conflict', 'pending_review', 'refresh_candidates', { nextCandidateSnapshotVersion: 2, nextCandidateSetDigest: refs.nextCandidateDigest }, 'none'],
    ['matched', 'revoked', 'revoke', {}, 'none'],
  ] as const)('returns a non-authorizing proposal for %s → %s', (fromState, toState, action, overrides, customerResolutionRequirement) => {
    const result = proposeIdentityMatchReviewTransition(proposal(fromState, toState, action, overrides));

    expect(result.kind).toBe('transition_proposal');
    if (result.kind !== 'transition_proposal') return;
    expect(result.proposal).toMatchObject({ fromState, toState, action, customerResolutionRequirement });
    expect(result.proposal.ownerRequirements).toEqual(expect.arrayContaining(['owner_current_snapshot', 'revision_cas', 'trusted_server_clock', 'action_authorization']));
    if (action === 'refresh_candidates') expect(result.proposal.ownerRequirements).toContain('owner_verified_candidate_refresh');
    expect(result).not.toHaveProperty('current');
    expect(result).not.toHaveProperty('applied');
  });
});
