import type {
  HisConnectionCredentialCompensationDeadLetterReason,
  HisConnectionCredentialCompensationJobState,
  HisConnectionCredentialCompensationOperationType,
  HisConnectionCredentialCompensationState,
  HisConnectionCredentialProviderFailureCategory,
} from '@/modules/institution-system/domain/his-connection-credential-compensation';

export type HisConnectionCredentialCompensationOperationReadModel = {
  operationId: string;
  tenantId: string;
  connectionId: string;
  operationType: HisConnectionCredentialCompensationOperationType;
  state: HisConnectionCredentialCompensationState;
  failureCategory: HisConnectionCredentialProviderFailureCategory;
  retryCount: number;
  manualReviewRequired: boolean;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt: string | null;
  completedAt: string | null;
};

export type CreateCredentialCompensationOperationCommand = {
  tenantId: string;
  connectionId: string;
  operationId: string;
  failureCategory: HisConnectionCredentialProviderFailureCategory;
};

export type CredentialCompensationOperationLookupInput = {
  tenantId: string;
  operationId: string;
};

export type CredentialCompensationOperationConnectionLookupInput =
  CredentialCompensationOperationLookupInput & { connectionId: string };

export type ListCredentialCompensationOperationsInput = { tenantId: string };

export type ListStaleRunningCredentialCompensationOperationsInput =
  ListCredentialCompensationOperationsInput & { staleBefore: Date };

export type CredentialCompensationOperationMutationResult =
  | { status: 'ok'; record: HisConnectionCredentialCompensationOperationReadModel }
  | { status: 'not_found' | 'conflict' | 'invalid_state_transition' | 'validation_failed' | 'repository_error' };

export type CredentialCompensationOperationListResult =
  | { status: 'ok'; records: HisConnectionCredentialCompensationOperationReadModel[] }
  | { status: 'validation_failed' | 'repository_error' };

export type HisConnectionCredentialCompensationOperationRepository = {
  createCredentialCompensationOperation(
    input: CreateCredentialCompensationOperationCommand,
  ): Promise<CredentialCompensationOperationMutationResult>;
  getCredentialCompensationOperationByOperationId(
    input: CredentialCompensationOperationLookupInput,
  ): Promise<CredentialCompensationOperationMutationResult>;
  getCredentialCompensationOperationByConnection(
    input: CredentialCompensationOperationConnectionLookupInput,
  ): Promise<CredentialCompensationOperationMutationResult>;
  markCredentialCompensationOperationRunning(
    input: CredentialCompensationOperationConnectionLookupInput,
  ): Promise<CredentialCompensationOperationMutationResult>;
  markCredentialCompensationOperationSucceeded(
    input: CredentialCompensationOperationConnectionLookupInput,
  ): Promise<CredentialCompensationOperationMutationResult>;
  markCredentialCompensationOperationFailed(
    input: CredentialCompensationOperationConnectionLookupInput,
  ): Promise<CredentialCompensationOperationMutationResult>;
  markCredentialCompensationOperationManualReviewRequired(
    input: CredentialCompensationOperationConnectionLookupInput,
  ): Promise<CredentialCompensationOperationMutationResult>;
  markFailedCredentialCompensationOperationManualReviewRequired(
    input: CredentialCompensationOperationConnectionLookupInput,
  ): Promise<CredentialCompensationOperationMutationResult>;
  incrementCredentialCompensationOperationRetryCount(
    input: CredentialCompensationOperationConnectionLookupInput,
  ): Promise<CredentialCompensationOperationMutationResult>;
  listPendingCredentialCompensationOperations(
    input: ListCredentialCompensationOperationsInput,
  ): Promise<CredentialCompensationOperationListResult>;
  listStaleRunningCredentialCompensationOperations(
    input: ListStaleRunningCredentialCompensationOperationsInput,
  ): Promise<CredentialCompensationOperationListResult>;
};

export type HisConnectionCredentialCompensationJobReadModel = {
  id: string;
  tenantId: string;
  connectionId: string;
  operationId: string;
  operationType: HisConnectionCredentialCompensationOperationType;
  jobState: HisConnectionCredentialCompensationJobState;
  failureCategory: HisConnectionCredentialProviderFailureCategory;
  retryCount: number;
  maxRetryCount: number;
  nextAttemptAt: string;
  lockedUntil: string | null;
  claimId: string | null;
  claimVersion: number;
  claimedBy: string | null;
  claimedAt: string | null;
  lastHeartbeatAt: string | null;
  deadLetterReason: HisConnectionCredentialCompensationDeadLetterReason | null;
  manualReviewRequired: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type CredentialCompensationJobScopeInput = {
  tenantId: string;
  connectionId: string;
  operationId: string;
};

export type CreateCredentialCompensationJobCommand =
  CredentialCompensationJobScopeInput & {
    failureCategory: HisConnectionCredentialProviderFailureCategory;
    maxRetryCount?: number;
    nextAttemptAt?: Date;
  };

export type ListCredentialCompensationJobsInput = {
  tenantId: string;
  now: Date;
};

export type ClaimDueCredentialCompensationJobCommand =
  CredentialCompensationJobScopeInput & {
    claimId: string;
    claimedBy: string;
    lockedUntil: Date;
    now: Date;
  };

export type ClaimedCredentialCompensationJobCommand =
  CredentialCompensationJobScopeInput & {
    claimId: string;
    claimVersion: number;
    now: Date;
  };

export type RequeueCredentialCompensationJobCommand =
  ClaimedCredentialCompensationJobCommand & { nextAttemptAt: Date };

export type DeadLetterCredentialCompensationJobCommand =
  ClaimedCredentialCompensationJobCommand & {
    deadLetterReason: HisConnectionCredentialCompensationDeadLetterReason;
  };

export type CredentialCompensationJobMutationResult =
  | { status: 'ok'; record: HisConnectionCredentialCompensationJobReadModel }
  | { status: 'not_found' | 'conflict' | 'invalid_state_transition' | 'validation_failed' | 'repository_error' };

export type CredentialCompensationJobListResult =
  | { status: 'ok'; records: HisConnectionCredentialCompensationJobReadModel[] }
  | { status: 'validation_failed' | 'repository_error' };

export type HisConnectionCredentialCompensationJobQueueRepository = {
  createCredentialCompensationJob(
    input: CreateCredentialCompensationJobCommand,
  ): Promise<CredentialCompensationJobMutationResult>;
  getCredentialCompensationJobByOperation(
    input: CredentialCompensationJobScopeInput,
  ): Promise<CredentialCompensationJobMutationResult>;
  getCredentialCompensationJobByConnection(
    input: CredentialCompensationJobScopeInput,
  ): Promise<CredentialCompensationJobMutationResult>;
  listDueCredentialCompensationJobs(
    input: ListCredentialCompensationJobsInput,
  ): Promise<CredentialCompensationJobListResult>;
  claimDueCredentialCompensationJob(
    input: ClaimDueCredentialCompensationJobCommand,
  ): Promise<CredentialCompensationJobMutationResult>;
  markCredentialCompensationJobRunning(
    input: ClaimedCredentialCompensationJobCommand,
  ): Promise<CredentialCompensationJobMutationResult>;
  markCredentialCompensationJobSucceeded(
    input: ClaimedCredentialCompensationJobCommand,
  ): Promise<CredentialCompensationJobMutationResult>;
  markCredentialCompensationJobFailed(
    input: ClaimedCredentialCompensationJobCommand,
  ): Promise<CredentialCompensationJobMutationResult>;
  requeueCredentialCompensationJob(
    input: RequeueCredentialCompensationJobCommand,
  ): Promise<CredentialCompensationJobMutationResult>;
  markCredentialCompensationJobDeadLettered(
    input: DeadLetterCredentialCompensationJobCommand,
  ): Promise<CredentialCompensationJobMutationResult>;
  markCredentialCompensationJobManualReviewRequired(
    input: ClaimedCredentialCompensationJobCommand,
  ): Promise<CredentialCompensationJobMutationResult>;
  listExpiredLockedCredentialCompensationJobs(
    input: ListCredentialCompensationJobsInput,
  ): Promise<CredentialCompensationJobListResult>;
};
