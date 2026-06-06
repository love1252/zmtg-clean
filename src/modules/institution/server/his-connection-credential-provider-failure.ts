import { randomUUID } from 'node:crypto';

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

export type HisConnectionCredentialProviderFailureOperation =
  | 'store'
  | 'rotate'
  | 'clear'
  | 'revoke'
  | 'describe'
  | 'health'
  | 'repository'
  | 'audit';

export type HisConnectionCredentialProviderFailure = {
  kind: 'his_connection_credential_provider_failure';
  category: HisConnectionCredentialProviderFailureCategory;
  operation: HisConnectionCredentialProviderFailureOperation;
  tenantId: string;
  connectionId: string;
  provider?: string;
  retryable: boolean;
  failClosed: true;
  retryCount?: number;
};

export type HisConnectionCredentialCompensationSummary = {
  kind: 'his_connection_credential_compensation_summary';
  state: HisConnectionCredentialCompensationState;
  tenantId: string;
  connectionId: string;
  operation: HisConnectionCredentialProviderFailureOperation;
  failureCategory: HisConnectionCredentialProviderFailureCategory;
  provider?: string;
  retryCount?: number;
};

export type HisConnectionCredentialCompensationOperationMetadata = {
  kind: 'his_connection_credential_compensation_operation_metadata';
  operationId: string;
  operationType: HisConnectionCredentialCompensationOperationType;
  tenantId: string;
  connectionId: string;
  state: HisConnectionCredentialCompensationState;
  failureCategory: HisConnectionCredentialProviderFailureCategory;
  retryCount: number;
  manualReviewRequired: boolean;
};

export type HisConnectionCredentialProviderFailureServiceStatus =
  | 'validation_failed'
  | 'not_found'
  | 'invalid_state_transition'
  | 'service_unavailable';

const retryableFailureCategories: ReadonlySet<HisConnectionCredentialProviderFailureCategory> =
  new Set([
    'provider_unavailable',
    'timeout',
    'provider_revoke_failed',
    'provider_describe_failed',
    'provider_health_failed',
  ]);

const forbiddenSafeSummaryPattern =
  /cred_ref_|credentialRef|credential_ref|idempotencyKey|synthetic_placeholder|providerPath|secretPath|\/vault|kms|sk_live|sk_test|token|secret|api[_-]?key|connection[_-]?string|password|private[_-]?key|raw[_-]?credential|raw[_-]?payload|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack/i;

function isProviderFailureCategory(
  value: unknown,
): value is HisConnectionCredentialProviderFailureCategory {
  return (
    typeof value === 'string' &&
    (hisConnectionCredentialProviderFailureCategories as readonly string[]).includes(value)
  );
}

function isCompensationState(value: unknown): value is HisConnectionCredentialCompensationState {
  return (
    typeof value === 'string' &&
    (hisConnectionCredentialCompensationStates as readonly string[]).includes(value)
  );
}

function normalizeSafeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) return null;
  if (forbiddenSafeSummaryPattern.test(normalized)) return null;

  return normalized;
}

function normalizeRequiredTrustedText(value: unknown, fallback: string): string {
  return normalizeSafeText(value, 96) ?? fallback;
}

function normalizeOptionalProvider(value: unknown): string | undefined {
  return normalizeSafeText(value, 64) ?? undefined;
}

function normalizeRetryCount(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isInteger(value) || value < 0 || value > 99) return undefined;

  return value;
}

const compensationOperationIdPrefix = 'his_cred_comp_op_';
const compensationOperationIdPattern = /^his_cred_comp_op_[a-z0-9]{32}$/;

function normalizeOperationIdEntropy(value: string): string | null {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.length < 32) return null;
  if (forbiddenSafeSummaryPattern.test(normalized)) return null;

  return normalized.slice(0, 32);
}

function createSecureOperationIdEntropy() {
  try {
    return randomUUID();
  } catch {
    throw new Error('his_connection_credential_compensation_operation_id_entropy_unavailable');
  }
}

export function isSafeHisConnectionCredentialCompensationOperationId(
  value: unknown,
): value is string {
  if (typeof value !== 'string') return false;
  if (!compensationOperationIdPattern.test(value)) return false;
  if (forbiddenSafeSummaryPattern.test(value)) return false;

  return true;
}

export function createHisConnectionCredentialCompensationOperationId(
  operationIdFactory: () => string = createSecureOperationIdEntropy,
): string {
  const generated = normalizeOperationIdEntropy(operationIdFactory());

  if (!generated) {
    throw new Error('his_connection_credential_compensation_operation_id_invalid_entropy');
  }

  const operationId = `${compensationOperationIdPrefix}${generated}`;
  if (!isSafeHisConnectionCredentialCompensationOperationId(operationId)) {
    throw new Error('his_connection_credential_compensation_operation_id_invalid_entropy');
  }

  return operationId;
}

export function createHisConnectionCredentialProviderFailure(input: {
  category: HisConnectionCredentialProviderFailureCategory;
  operation: HisConnectionCredentialProviderFailureOperation;
  tenantId: string;
  connectionId: string;
  provider?: string;
  retryCount?: number;
  unsafeMessage?: string;
}): HisConnectionCredentialProviderFailure {
  const category = isProviderFailureCategory(input.category)
    ? input.category
    : 'provider_write_failed';
  const provider = normalizeOptionalProvider(input.provider);
  const retryCount = normalizeRetryCount(input.retryCount);

  return {
    kind: 'his_connection_credential_provider_failure',
    category,
    operation: input.operation,
    tenantId: normalizeRequiredTrustedText(input.tenantId, 'unknown_tenant'),
    connectionId: normalizeRequiredTrustedText(input.connectionId, 'unknown_connection'),
    ...(provider === undefined ? {} : { provider }),
    retryable: retryableFailureCategories.has(category),
    failClosed: true,
    ...(retryCount === undefined ? {} : { retryCount }),
  };
}

export function isHisConnectionCredentialProviderFailure(
  value: unknown,
): value is HisConnectionCredentialProviderFailure {
  if (typeof value !== 'object' || value === null) return false;

  const candidate = value as Partial<HisConnectionCredentialProviderFailure>;
  return (
    candidate.kind === 'his_connection_credential_provider_failure' &&
    isProviderFailureCategory(candidate.category) &&
    typeof candidate.operation === 'string' &&
    typeof candidate.tenantId === 'string' &&
    typeof candidate.connectionId === 'string' &&
    candidate.failClosed === true
  );
}

export function mapUnknownHisConnectionCredentialProviderFailure(
  error: unknown,
  input: {
    operation: HisConnectionCredentialProviderFailureOperation;
    tenantId: string;
    connectionId: string;
    category?: HisConnectionCredentialProviderFailureCategory;
    provider?: string;
  },
): HisConnectionCredentialProviderFailure {
  if (isHisConnectionCredentialProviderFailure(error)) {
    return error;
  }

  return createHisConnectionCredentialProviderFailure({
    category: input.category ?? 'provider_write_failed',
    operation: input.operation,
    tenantId: input.tenantId,
    connectionId: input.connectionId,
    provider: input.provider,
  });
}

export function createHisConnectionCredentialCompensationSummary(input: {
  state: HisConnectionCredentialCompensationState;
  tenantId: string;
  connectionId: string;
  operation: HisConnectionCredentialProviderFailureOperation;
  failureCategory: HisConnectionCredentialProviderFailureCategory;
  provider?: string;
  retryCount?: number;
  manualReviewNote?: string;
}): HisConnectionCredentialCompensationSummary {
  const state = isCompensationState(input.state) ? input.state : 'manual_review_required';
  const failureCategory = isProviderFailureCategory(input.failureCategory)
    ? input.failureCategory
    : 'provider_write_failed';
  const provider = normalizeOptionalProvider(input.provider);
  const retryCount = normalizeRetryCount(input.retryCount);

  return {
    kind: 'his_connection_credential_compensation_summary',
    state,
    tenantId: normalizeRequiredTrustedText(input.tenantId, 'unknown_tenant'),
    connectionId: normalizeRequiredTrustedText(input.connectionId, 'unknown_connection'),
    operation: input.operation,
    failureCategory,
    ...(provider === undefined ? {} : { provider }),
    ...(retryCount === undefined ? {} : { retryCount }),
  };
}

export function createHisConnectionCredentialCompensationOperationMetadata(input: {
  tenantId: string;
  connectionId: string;
  state: HisConnectionCredentialCompensationState;
  failureCategory: HisConnectionCredentialProviderFailureCategory;
  retryCount?: number;
  manualReviewRequired?: boolean;
  operationIdFactory?: () => string;
}): HisConnectionCredentialCompensationOperationMetadata {
  const operationId = createHisConnectionCredentialCompensationOperationId(
    input.operationIdFactory,
  );
  const state = isCompensationState(input.state) ? input.state : 'manual_review_required';
  const failureCategory = isProviderFailureCategory(input.failureCategory)
    ? input.failureCategory
    : 'provider_write_failed';

  return {
    kind: 'his_connection_credential_compensation_operation_metadata',
    operationId,
    operationType: 'credential_compensation',
    tenantId: normalizeRequiredTrustedText(input.tenantId, 'unknown_tenant'),
    connectionId: normalizeRequiredTrustedText(input.connectionId, 'unknown_connection'),
    state,
    failureCategory,
    retryCount: normalizeRetryCount(input.retryCount) ?? 0,
    manualReviewRequired: input.manualReviewRequired === true,
  };
}

export function mapHisConnectionCredentialProviderFailureToServiceStatus(
  failure: HisConnectionCredentialProviderFailure,
): HisConnectionCredentialProviderFailureServiceStatus {
  if (failure.category === 'validation_failed') {
    return 'validation_failed';
  }

  if (failure.category === 'invalid_state') {
    return 'invalid_state_transition';
  }

  return 'service_unavailable';
}
