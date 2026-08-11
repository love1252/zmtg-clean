import type { TenantDatabase } from '@/server/db/client';
import type {
  HisConnectionCredentialCompensationOperationType,
  HisConnectionCredentialProviderFailureCategory,
} from '@/modules/institution/server/his-connection-credential-provider-failure';

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
  ClaimedCredentialCompensationJobCommand & {
    nextAttemptAt: Date;
  };

export type DeadLetterCredentialCompensationJobCommand =
  ClaimedCredentialCompensationJobCommand & {
    deadLetterReason: HisConnectionCredentialCompensationDeadLetterReason;
  };

export type CredentialCompensationJobMutationResult =
  | { status: 'ok'; record: HisConnectionCredentialCompensationJobReadModel }
  | { status: 'not_found' }
  | { status: 'conflict' }
  | { status: 'invalid_state_transition' }
  | { status: 'validation_failed' }
  | { status: 'repository_error' };

export type CredentialCompensationJobListResult =
  | { status: 'ok'; records: HisConnectionCredentialCompensationJobReadModel[] }
  | { status: 'validation_failed' }
  | { status: 'repository_error' };

export type HisConnectionCredentialCompensationJobQueueRepository = {
  createCredentialCompensationJob(input: CreateCredentialCompensationJobCommand): Promise<CredentialCompensationJobMutationResult>;
  getCredentialCompensationJobByOperation(input: CredentialCompensationJobScopeInput): Promise<CredentialCompensationJobMutationResult>;
  getCredentialCompensationJobByConnection(input: CredentialCompensationJobScopeInput): Promise<CredentialCompensationJobMutationResult>;
  listDueCredentialCompensationJobs(input: ListCredentialCompensationJobsInput): Promise<CredentialCompensationJobListResult>;
  claimDueCredentialCompensationJob(input: ClaimDueCredentialCompensationJobCommand): Promise<CredentialCompensationJobMutationResult>;
  markCredentialCompensationJobRunning(input: ClaimedCredentialCompensationJobCommand): Promise<CredentialCompensationJobMutationResult>;
  markCredentialCompensationJobSucceeded(input: ClaimedCredentialCompensationJobCommand): Promise<CredentialCompensationJobMutationResult>;
  markCredentialCompensationJobFailed(input: ClaimedCredentialCompensationJobCommand): Promise<CredentialCompensationJobMutationResult>;
  requeueCredentialCompensationJob(input: RequeueCredentialCompensationJobCommand): Promise<CredentialCompensationJobMutationResult>;
  markCredentialCompensationJobDeadLettered(input: DeadLetterCredentialCompensationJobCommand): Promise<CredentialCompensationJobMutationResult>;
  markCredentialCompensationJobManualReviewRequired(input: ClaimedCredentialCompensationJobCommand): Promise<CredentialCompensationJobMutationResult>;
  listExpiredLockedCredentialCompensationJobs(input: ListCredentialCompensationJobsInput): Promise<CredentialCompensationJobListResult>;
};

export function createHisConnectionCredentialCompensationJobQueueRepository(
  _database: TenantDatabase,
): HisConnectionCredentialCompensationJobQueueRepository {
  throw new Error('legacy_institution_credential_compensation_job_repository_disabled');
}
