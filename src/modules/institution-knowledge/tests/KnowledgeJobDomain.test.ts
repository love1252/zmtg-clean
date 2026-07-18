import { describe, expect, it } from 'vitest';

import {
  proposeKnowledgeJobAttemptCompletion,
  proposeKnowledgeJobCreation,
} from '../domain/knowledge-job-attempt';

const opaque = (prefix: string, fill: string): string =>
  `${prefix}_${fill.repeat(64)}`;

function creationInput(overrides: Record<string, unknown> = {}) {
  return {
    commandIdempotencyKey: opaque('cmd', 'a'),
    targetCandidateRef: opaque('filerev', 'b'),
    actorCandidateRef: opaque('actor', 'c'),
    jobKind: 'ocr',
    ...overrides,
  };
}

function completionInput(overrides: Record<string, unknown> = {}) {
  return {
    commandIdempotencyKey: opaque('cmd', 'd'),
    jobCandidateRef: opaque('job', 'e'),
    targetCandidateRef: opaque('filerev', 'f'),
    actorCandidateRef: opaque('actor', '0'),
    jobKind: 'ocr',
    requestedOutcome: 'succeeded',
    ...overrides,
  };
}

describe('knowledge job proposal domain', () => {
  it('returns a frozen blocked non-authorizing creation proposal, never a job state', () => {
    const input = creationInput();
    const before = structuredClone(input);
    const decision = proposeKnowledgeJobCreation(input);

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(input).toEqual(before);
    expect(decision.proposal.authorization).toBe('non_authorizing');
    expect(decision.proposal.executionStatus).toBe('blocked');
    expect(decision.proposal.proposalKind).toBe('create_job');
    expect(decision.proposal).not.toHaveProperty('nextState');
    expect(decision.proposal).not.toHaveProperty('applied');
    expect(Object.isFrozen(decision.proposal)).toBe(true);
    expect(Object.isFrozen(decision.proposal.blockedReasonCodes)).toBe(true);
    expect(Object.isFrozen(decision.proposal.executionPreconditions)).toBe(true);
    expect(decision.proposal.blockedReasonCodes).toContain(
      'owner_sealed_snapshot_required',
    );
    expect(decision.proposal.blockedReasonCodes).toContain(
      'repository_revision_cas_required',
    );
    expect(decision.proposal.blockedReasonCodes).toContain(
      'idempotency_result_store_required',
    );
  });

  it('retains command idempotency only as proposal data and does not claim a replay result', () => {
    const first = proposeKnowledgeJobCreation(creationInput());
    const second = proposeKnowledgeJobCreation(creationInput());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.proposal.commandIdempotencyKey).toBe(
      opaque('cmd', 'a'),
    );
    expect(second.proposal).toEqual(first.proposal);
    expect(first.proposal).not.toHaveProperty('idempotentReplay');
    expect(first.proposal.blockedReasonCodes).toContain(
      'idempotency_result_store_required',
    );
  });

  it('keeps unintegrated OCR blocked and required even when completion requests success', () => {
    const decision = proposeKnowledgeJobAttemptCompletion(completionInput());

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.proposal.executionStatus).toBe('blocked');
    expect(decision.proposal.requestedOutcome).toBeNull();
    expect(decision.proposal).not.toHaveProperty('completed');
    expect(decision.proposal).not.toHaveProperty('succeeded');
    expect(JSON.stringify(decision.proposal)).not.toContain('succeeded');
    expect(decision.proposal.blockedReasonCodes).toEqual(
      expect.arrayContaining(['ocr_required', 'ocr_adapter_unavailable']),
    );
  });

  it('rejects raw state, expected revision, and extra execution fields without echoing them', () => {
    const decision = proposeKnowledgeJobCreation({
      ...creationInput(),
      state: { status: 'queued' },
      expectedRevision: 7,
      leaseToken: 'SECRET_LEASE_TOKEN',
      now: '2026-07-18T00:00:00.000Z',
    });

    expect(decision.ok).toBe(false);
    if (decision.ok) return;
    expect(decision.reasonCodes).toEqual(['input_invalid']);
    expect(JSON.stringify(decision)).not.toContain('SECRET_LEASE_TOKEN');
  });
});
