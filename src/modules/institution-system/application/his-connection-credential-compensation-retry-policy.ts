export const hisConnectionCredentialCompensationRetryPolicyProviderResults = [
  'success',
  'retryable_failure',
  'unsafe_unknown',
  'validation_failed',
  'provider_unavailable',
  'timeout',
  'repository_error',
] as const;

export type HisConnectionCredentialCompensationRetryPolicyProviderResult =
  (typeof hisConnectionCredentialCompensationRetryPolicyProviderResults)[number];

export const hisConnectionCredentialCompensationRetryPolicyDecisions = [
  'requeue',
  'dead_letter',
  'manual_review',
  'no_retry',
  'validation_failed',
] as const;

export type HisConnectionCredentialCompensationRetryPolicyDecision =
  (typeof hisConnectionCredentialCompensationRetryPolicyDecisions)[number];

export const hisConnectionCredentialCompensationRetryPolicyDecisionReasons = [
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
] as const;

export type HisConnectionCredentialCompensationRetryPolicyDecisionReason =
  (typeof hisConnectionCredentialCompensationRetryPolicyDecisionReasons)[number];

export type HisConnectionCredentialCompensationRetryPolicyBackoffStrategy =
  | 'fixed'
  | 'exponential';

export type DecideHisConnectionCredentialCompensationRetryInput = {
  providerResult: unknown;
  jobState: unknown;
  retryCount: unknown;
  maxRetryCount: unknown;
  now: unknown;
  baseDelayMs: unknown;
  maxDelayMs?: unknown;
  backoffStrategy?: unknown;
  jitterMs?: unknown;
  jitterValue?: unknown;
};

export type HisConnectionCredentialCompensationRetryPolicyResult = {
  decision: HisConnectionCredentialCompensationRetryPolicyDecision;
  reason: HisConnectionCredentialCompensationRetryPolicyDecisionReason;
  retryable: boolean;
  nextAttemptAt?: string;
};

function isProviderResult(
  value: unknown,
): value is HisConnectionCredentialCompensationRetryPolicyProviderResult {
  return (
    typeof value === 'string' &&
    (hisConnectionCredentialCompensationRetryPolicyProviderResults as readonly string[])
      .includes(value)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function createResult(
  decision: HisConnectionCredentialCompensationRetryPolicyDecision,
  reason: HisConnectionCredentialCompensationRetryPolicyDecisionReason,
  retryable: boolean,
  nextAttemptAt?: string,
): HisConnectionCredentialCompensationRetryPolicyResult {
  return {
    decision,
    reason,
    retryable,
    ...(nextAttemptAt ? { nextAttemptAt } : {}),
  };
}

function createValidationFailedResult(
  reason: Extract<
    HisConnectionCredentialCompensationRetryPolicyDecisionReason,
    'validation_failed_no_retry' | 'invalid_job_state' | 'invalid_retry_counter' | 'invalid_backoff_config'
  >,
) {
  return createResult('validation_failed', reason, false);
}

function resolveBackoffDelayMs(input: DecideHisConnectionCredentialCompensationRetryInput) {
  const strategy = input.backoffStrategy ?? 'fixed';
  if (strategy !== 'fixed') return null;
  if (!isPositiveInteger(input.baseDelayMs)) return null;
  if (input.maxDelayMs !== undefined && !isPositiveInteger(input.maxDelayMs)) return null;
  if (input.jitterMs !== undefined && !isNonNegativeInteger(input.jitterMs)) return null;
  if (
    input.jitterValue !== undefined &&
    (
      typeof input.jitterValue !== 'number' ||
      Number.isNaN(input.jitterValue) ||
      input.jitterValue < 0 ||
      input.jitterValue > 1
    )
  ) {
    return null;
  }

  const baseDelayMs = input.baseDelayMs;
  const maxDelayMs = input.maxDelayMs;
  const jitterMs = input.jitterMs ?? 0;
  const jitterValue = input.jitterValue ?? 0;
  const rawDelayMs = baseDelayMs + jitterMs * jitterValue;
  const boundedDelayMs = maxDelayMs === undefined
    ? rawDelayMs
    : Math.min(rawDelayMs, maxDelayMs);

  if (!Number.isFinite(boundedDelayMs) || boundedDelayMs <= 0) return null;

  return boundedDelayMs;
}

function resolveNextAttemptAt(now: Date, delayMs: number) {
  const targetTime = now.getTime() + delayMs;
  if (!Number.isFinite(targetTime)) return null;

  const nextAttemptAt = new Date(targetTime);
  if (!isValidDate(nextAttemptAt)) return null;

  try {
    return nextAttemptAt.toISOString();
  } catch {
    return null;
  }
}

function createRequeueResult(
  now: Date,
  delayMs: number,
  reason: Extract<
    HisConnectionCredentialCompensationRetryPolicyDecisionReason,
    'retryable_failure_below_limit' | 'provider_unavailable_below_limit'
  >,
) {
  const nextAttemptAt = resolveNextAttemptAt(now, delayMs);
  if (!nextAttemptAt) {
    return createValidationFailedResult('invalid_backoff_config');
  }

  return createResult(
    'requeue',
    reason,
    true,
    nextAttemptAt,
  );
}

export function decideHisConnectionCredentialCompensationRetry(
  input: DecideHisConnectionCredentialCompensationRetryInput,
): HisConnectionCredentialCompensationRetryPolicyResult {
  if (!isProviderResult(input.providerResult)) {
    return createValidationFailedResult('validation_failed_no_retry');
  }
  if (input.jobState !== 'failed') {
    return createValidationFailedResult('invalid_job_state');
  }
  if (
    !isNonNegativeInteger(input.retryCount) ||
    !isNonNegativeInteger(input.maxRetryCount)
  ) {
    return createValidationFailedResult('invalid_retry_counter');
  }

  if (input.providerResult === 'success') {
    return createResult('no_retry', 'success_completed', false);
  }
  if (input.providerResult === 'timeout') {
    return createResult('manual_review', 'timeout_requires_manual_review', false);
  }
  if (input.providerResult === 'unsafe_unknown') {
    return createResult('manual_review', 'unsafe_unknown_requires_manual_review', false);
  }
  if (input.providerResult === 'validation_failed') {
    return createResult('no_retry', 'validation_failed_no_retry', false);
  }
  if (input.providerResult === 'repository_error') {
    return createResult('no_retry', 'repository_error_defer_recovery', false);
  }
  const retryCount = input.retryCount;
  const maxRetryCount = input.maxRetryCount;
  if (retryCount >= maxRetryCount) {
    return createResult('dead_letter', 'retry_exhausted', false);
  }

  const now = isValidDate(input.now) ? input.now : null;
  const delayMs = resolveBackoffDelayMs(input);
  if (!now || !delayMs) {
    return createValidationFailedResult('invalid_backoff_config');
  }

  if (input.providerResult === 'provider_unavailable') {
    return createRequeueResult(now, delayMs, 'provider_unavailable_below_limit');
  }

  return createRequeueResult(now, delayMs, 'retryable_failure_below_limit');
}
