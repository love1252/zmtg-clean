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

export type HisConnectionCredentialCompensationWorkerResultStatus =
  | 'ok'
  | 'skipped'
  | 'not_found'
  | 'conflict'
  | 'invalid_state_transition'
  | 'manual_review_required'
  | 'repository_error'
  | 'validation_failed';

export type HisConnectionCredentialCompensationWorkerScope = {
  tenantId: string;
  connectionId: string;
  operationId: string;
};

export type HisConnectionCredentialCompensationProviderExecutorInput =
  HisConnectionCredentialCompensationWorkerScope & {
    claimId: string;
    claimVersion: number;
    workerId: string;
    now: Date;
  };

export type HisConnectionCredentialCompensationProviderExecutionResult = {
  status: HisConnectionCredentialCompensationProviderExecutionResultStatus;
};

export type HisConnectionCredentialCompensationProviderExecutor = (
  input: HisConnectionCredentialCompensationProviderExecutorInput,
) =>
  | Promise<HisConnectionCredentialCompensationProviderExecutionResult>
  | HisConnectionCredentialCompensationProviderExecutionResult;

export type HisConnectionCredentialCompensationWorkerItemResult =
  HisConnectionCredentialCompensationWorkerScope & {
    status: HisConnectionCredentialCompensationWorkerResultStatus;
    claimId?: string;
    claimVersion?: number;
    providerResult?: HisConnectionCredentialCompensationProviderExecutionResultStatus;
  };

export type HisConnectionCredentialCompensationWorkerBatchResult = {
  status: Extract<
    HisConnectionCredentialCompensationWorkerResultStatus,
    'ok' | 'repository_error' | 'validation_failed'
  >;
  items: HisConnectionCredentialCompensationWorkerItemResult[];
};

export type ClaimDueCredentialCompensationJobsInput = {
  tenantId: string;
  workerId?: string;
  now?: Date;
  lockDurationMs?: number;
  limit?: number;
};

export type RecoverExpiredLockedCredentialCompensationJobsInput = {
  tenantId: string;
  now?: Date;
  limit?: number;
};

export type RecoverStaleRunningCredentialCompensationOperationsInput = {
  tenantId: string;
  staleBefore: Date;
  now?: Date;
  limit?: number;
};

export type ExecuteClaimedCredentialCompensationJobInput =
  HisConnectionCredentialCompensationWorkerScope & {
    claimId: string;
    claimVersion: number;
    workerId?: string;
    now?: Date;
  };

export type HisConnectionCredentialCompensationWorkerDependencies = {
  operationRepository: unknown;
  jobQueueRepository: unknown;
  providerExecutor?: HisConnectionCredentialCompensationProviderExecutor;
  nowProvider?: () => Date;
  claimIdFactory?: (input: HisConnectionCredentialCompensationWorkerScope & {
    now: Date;
    workerId: string;
  }) => string;
  workerId?: string;
  lockDurationMs?: number;
  maxBatchSize?: number;
};

export function createHisConnectionCredentialCompensationWorker(
  _dependencies: HisConnectionCredentialCompensationWorkerDependencies,
): never {
  throw new Error('legacy_institution_credential_compensation_worker_disabled');
}
