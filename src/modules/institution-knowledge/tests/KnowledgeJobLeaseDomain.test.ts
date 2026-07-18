import { describe, expect, it } from 'vitest';

import {
  proposeKnowledgeJobAttemptClaim,
  proposeKnowledgeJobAttemptCompletion,
  proposeKnowledgeJobCancellation,
} from '../domain/knowledge-job-attempt';

const opaque = (prefix: string, fill: string): string =>
  `${prefix}_${fill.repeat(64)}`;

function attemptInput(overrides: Record<string, unknown> = {}) {
  return {
    commandIdempotencyKey: opaque('cmd', '1'),
    jobCandidateRef: opaque('job', '2'),
    targetCandidateRef: opaque('chunkrev', '3'),
    actorCandidateRef: opaque('actor', '4'),
    jobKind: 'index',
    ...overrides,
  };
}

describe('knowledge job attempt proposal domain', () => {
  it('freezes lease fencing and monotonicity rules instead of accepting a raw lease', () => {
    const decision = proposeKnowledgeJobAttemptClaim(attemptInput());

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.proposal.executionStatus).toBe('blocked');
    expect(decision.proposal.attemptRules.leaseWindow).toBe(
      'leaseUntil > claimedAt',
    );
    expect(decision.proposal.attemptRules.attemptAndResultTime).toBe(
      'strictly_monotonic',
    );
    expect(decision.proposal.attemptRules.takeover).toEqual({
      requiresTerminalReason: true,
      allowedTerminalReasonCodes: ['expired', 'failed', 'cancelled'],
    });
    expect(decision.proposal.blockedReasonCodes).toEqual(
      expect.arrayContaining([
        'server_issued_attempt_reference_required',
        'server_issued_lease_reference_required',
        'trusted_server_clock_required',
      ]),
    );
  });

  it('makes cancellation a blocked proposal whose executor must prove no attempt executed', () => {
    const decision = proposeKnowledgeJobCancellation(attemptInput());

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.proposal.proposalKind).toBe('cancel_job');
    expect(decision.proposal.executionStatus).toBe('blocked');
    expect(decision.proposal.executionPreconditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'owner_sealed_snapshot_required' }),
        expect.objectContaining({ code: 'repository_revision_cas_required' }),
        expect.objectContaining({
          code: 'cancellation_requires_unexecuted_job',
        }),
      ]),
    );
    expect(decision.proposal).not.toHaveProperty('cancelled');
  });

  it('exposes a closed retry candidate: only append-only failed results may retry', () => {
    const decision = proposeKnowledgeJobAttemptCompletion({
      ...attemptInput({ commandIdempotencyKey: opaque('cmd', '5') }),
      requestedOutcome: 'failed',
    });

    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.proposal.attemptRules.failureRetry).toEqual({
      permittedOnlyAfterAppendOnlyFailureResult: true,
      retryLimitCandidate: 3,
    });
    expect(Object.isFrozen(decision.proposal.attemptRules)).toBe(true);
    expect(Object.isFrozen(decision.proposal.attemptRules.failureRetry)).toBe(
      true,
    );
  });

  it('fails closed for proxy, revoked proxy, accessor, hidden, custom/null prototype, sparse array, and invalid references', () => {
    const revoked = Proxy.revocable(attemptInput(), {});
    revoked.revoke();
    const accessor = attemptInput();
    Object.defineProperty(accessor, 'jobCandidateRef', {
      enumerable: true,
      get() {
        throw new Error('must not run');
      },
    });
    const hidden = Object.defineProperty(attemptInput(), 'hidden', {
      enumerable: false,
      value: 'hidden',
    });
    const sparse: unknown[] = [];
    sparse[1] = 'unexpected';
    const customPrototype = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      attemptInput(),
    );
    const nullPrototype = Object.assign(
      Object.create(null) as Record<string, unknown>,
      attemptInput(),
    );
    const cases: unknown[] = [
      new Proxy(attemptInput(), {
        ownKeys() {
          throw new Error('must not run');
        },
      }),
      revoked.proxy,
      accessor,
      hidden,
      customPrototype,
      nullPrototype,
      { ...attemptInput(), rawArray: sparse },
      { ...attemptInput(), jobCandidateRef: 'job_short' },
    ];

    for (const input of cases) {
      expect(() => proposeKnowledgeJobAttemptClaim(input)).not.toThrow();
      const decision = proposeKnowledgeJobAttemptClaim(input);
      expect(decision.ok).toBe(false);
      if (decision.ok) continue;
      expect(JSON.stringify(decision)).not.toMatch(/hidden|unexpected|job_short/);
    }
  });
});
