export const hisConnectionCredentialProviderFailureCategories = [
  'provider_unavailable',
  'timeout',
  'retry_exhausted',
  'circuit_open',
  'validation_failed',
  'tenant_connection_mismatch',
  'idempotency_conflict',
  'invalid_state',
  'provider_write_failed',
  'provider_revoke_failed',
  'provider_describe_failed',
  'provider_health_failed',
  'repository_after_provider_failed',
  'audit_after_provider_failed',
] as const;

export type HisConnectionCredentialProviderFailureCategory =
  (typeof hisConnectionCredentialProviderFailureCategories)[number];

export const hisConnectionCredentialCompensationStates = [
  'compensation_pending',
  'compensation_running',
  'compensation_succeeded',
  'compensation_failed',
  'manual_review_required',
] as const;

export type HisConnectionCredentialCompensationState =
  (typeof hisConnectionCredentialCompensationStates)[number];

export const hisConnectionCredentialCompensationOperationTypes = [
  'credential_compensation',
] as const;

export type HisConnectionCredentialCompensationOperationType =
  (typeof hisConnectionCredentialCompensationOperationTypes)[number];

export const hisConnectionCredentialCompensationJobStates = [
  'queued',
  'claimed',
  'running',
  'succeeded',
  'failed',
  'dead_lettered',
  'manual_review_required',
  'cancelled',
] as const;

export type HisConnectionCredentialCompensationJobState =
  (typeof hisConnectionCredentialCompensationJobStates)[number];

export const hisConnectionCredentialCompensationDeadLetterReasons = [
  'retry_exhausted',
  'claim_conflict',
  'stale_recovery_conflict',
  'provider_result_unknown',
  'audit_write_unavailable',
  'operation_state_conflict',
  'unsafe_payload_summary',
] as const;

export type HisConnectionCredentialCompensationDeadLetterReason =
  (typeof hisConnectionCredentialCompensationDeadLetterReasons)[number];

export const hisConnectionCredentialCompensationProviderExecutionResultStatuses = [
  'success',
  'retryable_failure',
  'unsafe_unknown',
  'validation_failed',
  'provider_unavailable',
  'timeout',
  'repository_error',
] as const;

export type HisConnectionCredentialCompensationProviderExecutionResultStatus =
  (typeof hisConnectionCredentialCompensationProviderExecutionResultStatuses)[number];

const compensationOperationIdPattern = /^his_cred_comp_op_[a-z0-9]{32}$/;
const forbiddenSafeOperationIdPattern =
  /cred_ref_|credentialRef|credential_ref|idempotencyKey|synthetic_placeholder|providerPath|secretPath|\/vault|kms|sk_live|sk_test|token|secret|api[_-]?key|connection[_-]?string|password|private[_-]?key|raw[_-]?credential|raw[_-]?payload|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack/i;

export function isSafeHisConnectionCredentialCompensationOperationId(
  value: unknown,
): value is string {
  return (
    typeof value === 'string' &&
    compensationOperationIdPattern.test(value) &&
    !forbiddenSafeOperationIdPattern.test(value)
  );
}
