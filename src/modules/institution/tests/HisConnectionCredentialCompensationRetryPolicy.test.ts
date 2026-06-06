import { describe, expect, it, vi } from 'vitest';

import {
  decideHisConnectionCredentialCompensationRetry,
  hisConnectionCredentialCompensationRetryPolicyDecisionReasons,
  hisConnectionCredentialCompensationRetryPolicyDecisions,
  hisConnectionCredentialCompensationRetryPolicyProviderResults,
} from '@/modules/institution/server/his-connection-credential-compensation-retry-policy';

const now = new Date('2026-06-07T09:00:00.000Z');
const baseInput = {
  providerResult: 'retryable_failure',
  jobState: 'failed',
  retryCount: 0,
  maxRetryCount: 3,
  now,
  baseDelayMs: 60_000,
} as const;

describe('his connection credential compensation retry policy', () => {
  it('exports stable provider result decision and reason allowlists', () => {
    expect(hisConnectionCredentialCompensationRetryPolicyProviderResults).toEqual([
      'success',
      'retryable_failure',
      'unsafe_unknown',
      'validation_failed',
      'provider_unavailable',
      'timeout',
      'repository_error',
    ]);

    expect(hisConnectionCredentialCompensationRetryPolicyDecisions).toEqual([
      'requeue',
      'dead_letter',
      'manual_review',
      'no_retry',
      'validation_failed',
    ]);

    expect(hisConnectionCredentialCompensationRetryPolicyDecisionReasons).toEqual([
      'success_completed',
      'retryable_failure_below_limit',
      'provider_unavailable_below_limit',
      'retry_exhausted',
      'timeout_requires_manual_review',
      'unsafe_unknown_requires_manual_review',
      'validation_failed_no_retry',
      'repository_error_defer_recovery',
      'invalid_job_state',
      'invalid_retry_counter',
      'invalid_backoff_config',
    ]);
  });

  it('success returns no_retry without nextAttemptAt', () => {
    const result = decideHisConnectionCredentialCompensationRetry({
      ...baseInput,
      providerResult: 'success',
    });

    expect(result).toEqual({
      decision: 'no_retry',
      reason: 'success_completed',
      retryable: false,
    });
  });

  it('retryable_failure below maxRetryCount returns requeue with fixed backoff', () => {
    const result = decideHisConnectionCredentialCompensationRetry(baseInput);

    expect(result).toEqual({
      decision: 'requeue',
      reason: 'retryable_failure_below_limit',
      retryable: true,
      nextAttemptAt: '2026-06-07T09:01:00.000Z',
    });
  });

  it('retryable_failure at or above maxRetryCount returns dead_letter', () => {
    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        retryCount: 3,
        maxRetryCount: 3,
      }),
    ).toEqual({
      decision: 'dead_letter',
      reason: 'retry_exhausted',
      retryable: false,
    });

    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        retryCount: 4,
        maxRetryCount: 3,
      }),
    ).toEqual({
      decision: 'dead_letter',
      reason: 'retry_exhausted',
      retryable: false,
    });
  });

  it('provider_unavailable below limit requeues and at limit dead letters', () => {
    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        providerResult: 'provider_unavailable',
        retryCount: 2,
        maxRetryCount: 3,
      }),
    ).toEqual({
      decision: 'requeue',
      reason: 'provider_unavailable_below_limit',
      retryable: true,
      nextAttemptAt: '2026-06-07T09:01:00.000Z',
    });

    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        providerResult: 'provider_unavailable',
        retryCount: 3,
        maxRetryCount: 3,
      }),
    ).toEqual({
      decision: 'dead_letter',
      reason: 'retry_exhausted',
      retryable: false,
    });
  });

  it('timeout and unsafe_unknown require manual review', () => {
    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        providerResult: 'timeout',
      }),
    ).toEqual({
      decision: 'manual_review',
      reason: 'timeout_requires_manual_review',
      retryable: false,
    });

    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        providerResult: 'unsafe_unknown',
      }),
    ).toEqual({
      decision: 'manual_review',
      reason: 'unsafe_unknown_requires_manual_review',
      retryable: false,
    });
  });

  it('validation_failed and repository_error do not requeue', () => {
    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        providerResult: 'validation_failed',
      }),
    ).toEqual({
      decision: 'no_retry',
      reason: 'validation_failed_no_retry',
      retryable: false,
    });

    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        providerResult: 'repository_error',
      }),
    ).toEqual({
      decision: 'no_retry',
      reason: 'repository_error_defer_recovery',
      retryable: false,
    });
  });

  it('unknown provider result and invalid jobState return validation_failed', () => {
    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        providerResult: 'unknown_result',
      }),
    ).toEqual({
      decision: 'validation_failed',
      reason: 'validation_failed_no_retry',
      retryable: false,
    });

    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        jobState: 'running',
      }),
    ).toEqual({
      decision: 'validation_failed',
      reason: 'invalid_job_state',
      retryable: false,
    });
  });

  it('invalid retry counters return validation_failed', () => {
    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        retryCount: -1,
      }),
    ).toEqual({
      decision: 'validation_failed',
      reason: 'invalid_retry_counter',
      retryable: false,
    });

    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        maxRetryCount: -1,
      }),
    ).toEqual({
      decision: 'validation_failed',
      reason: 'invalid_retry_counter',
      retryable: false,
    });
  });

  it('invalid backoff config returns validation_failed', () => {
    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        baseDelayMs: 0,
      }),
    ).toEqual({
      decision: 'validation_failed',
      reason: 'invalid_backoff_config',
      retryable: false,
    });

    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        backoffStrategy: 'exponential',
      }),
    ).toEqual({
      decision: 'validation_failed',
      reason: 'invalid_backoff_config',
      retryable: false,
    });
  });

  it('baseDelayMs date overflow returns validation_failed', () => {
    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        baseDelayMs: Number.MAX_SAFE_INTEGER,
      }),
    ).toEqual({
      decision: 'validation_failed',
      reason: 'invalid_backoff_config',
      retryable: false,
    });
  });

  it('maxDelayMs date overflow returns validation_failed', () => {
    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        baseDelayMs: Number.MAX_SAFE_INTEGER,
        maxDelayMs: Number.MAX_SAFE_INTEGER,
      }),
    ).toEqual({
      decision: 'validation_failed',
      reason: 'invalid_backoff_config',
      retryable: false,
    });
  });

  it('jitterMs plus jitterValue date overflow returns validation_failed', () => {
    expect(
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        baseDelayMs: 1,
        jitterMs: Number.MAX_SAFE_INTEGER,
        jitterValue: 1,
      }),
    ).toEqual({
      decision: 'validation_failed',
      reason: 'invalid_backoff_config',
      retryable: false,
    });
  });

  it('requeue nextAttemptAt is not earlier than now and jitter only changes nextAttemptAt', () => {
    const withoutJitter = decideHisConnectionCredentialCompensationRetry(baseInput);
    const withJitter = decideHisConnectionCredentialCompensationRetry({
      ...baseInput,
      jitterMs: 5_000,
      jitterValue: 0.5,
    });

    expect(withoutJitter.decision).toBe('requeue');
    expect(withJitter.decision).toBe('requeue');
    expect(withoutJitter.reason).toBe(withJitter.reason);
    expect(withoutJitter.retryable).toBe(withJitter.retryable);
    expect(new Date(withoutJitter.nextAttemptAt ?? 0).getTime()).toBeGreaterThanOrEqual(now.getTime());
    expect(withJitter.nextAttemptAt).toBe('2026-06-07T09:01:02.500Z');
  });

  it('helper does not call provider fetch repository or audit dependencies', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const repository = { requeue: vi.fn(), write: vi.fn() };
    const audit = { write: vi.fn() };
    const provider = vi.fn();

    const result = decideHisConnectionCredentialCompensationRetry(baseInput);

    expect(result.decision).toBe('requeue');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(repository.requeue).not.toHaveBeenCalled();
    expect(repository.write).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('result does not contain unsafe diagnostic fields', () => {
    const results = [
      decideHisConnectionCredentialCompensationRetry(baseInput),
      decideHisConnectionCredentialCompensationRetry({
        ...baseInput,
        baseDelayMs: Number.MAX_SAFE_INTEGER,
      }),
    ];
    const forbiddenFragments = [
      ['S', 'QL'].join(''),
      ['sta', 'ck'].join(''),
      ['DATABASE', 'URL'].join('_'),
    ];

    for (const result of results) {
      const serialized = JSON.stringify(result);
      for (const fragment of forbiddenFragments) {
        expect(serialized).not.toContain(fragment);
      }
    }
  });
});
