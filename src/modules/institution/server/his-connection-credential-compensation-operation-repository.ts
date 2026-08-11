import type { TenantDatabase } from '@/server/db/client';
import type {
  HisConnectionCredentialCompensationOperationType,
  HisConnectionCredentialCompensationState,
  HisConnectionCredentialProviderFailureCategory,
} from '@/modules/institution/server/his-connection-credential-provider-failure';

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
  CredentialCompensationOperationLookupInput & {
    connectionId: string;
  };

export type ListCredentialCompensationOperationsInput = {
  tenantId: string;
};

export type ListStaleRunningCredentialCompensationOperationsInput =
  ListCredentialCompensationOperationsInput & {
    staleBefore: Date;
  };

export type CredentialCompensationOperationMutationResult =
  | { status: 'ok'; record: HisConnectionCredentialCompensationOperationReadModel }
  | { status: 'not_found' }
  | { status: 'conflict' }
  | { status: 'invalid_state_transition' }
  | { status: 'validation_failed' }
  | { status: 'repository_error' };

export type CredentialCompensationOperationListResult =
  | { status: 'ok'; records: HisConnectionCredentialCompensationOperationReadModel[] }
  | { status: 'validation_failed' }
  | { status: 'repository_error' };

export type HisConnectionCredentialCompensationOperationRepository = {
  createCredentialCompensationOperation(input: CreateCredentialCompensationOperationCommand): Promise<CredentialCompensationOperationMutationResult>;
  getCredentialCompensationOperationByOperationId(input: CredentialCompensationOperationLookupInput): Promise<CredentialCompensationOperationMutationResult>;
  getCredentialCompensationOperationByConnection(input: CredentialCompensationOperationConnectionLookupInput): Promise<CredentialCompensationOperationMutationResult>;
  markCredentialCompensationOperationRunning(input: CredentialCompensationOperationConnectionLookupInput): Promise<CredentialCompensationOperationMutationResult>;
  markCredentialCompensationOperationSucceeded(input: CredentialCompensationOperationConnectionLookupInput): Promise<CredentialCompensationOperationMutationResult>;
  markCredentialCompensationOperationFailed(input: CredentialCompensationOperationConnectionLookupInput): Promise<CredentialCompensationOperationMutationResult>;
  markCredentialCompensationOperationManualReviewRequired(input: CredentialCompensationOperationConnectionLookupInput): Promise<CredentialCompensationOperationMutationResult>;
  markFailedCredentialCompensationOperationManualReviewRequired(input: CredentialCompensationOperationConnectionLookupInput): Promise<CredentialCompensationOperationMutationResult>;
  incrementCredentialCompensationOperationRetryCount(input: CredentialCompensationOperationConnectionLookupInput): Promise<CredentialCompensationOperationMutationResult>;
  listPendingCredentialCompensationOperations(input: ListCredentialCompensationOperationsInput): Promise<CredentialCompensationOperationListResult>;
  listStaleRunningCredentialCompensationOperations(input: ListStaleRunningCredentialCompensationOperationsInput): Promise<CredentialCompensationOperationListResult>;
};

export function createHisConnectionCredentialCompensationOperationRepository(
  _database: TenantDatabase,
): HisConnectionCredentialCompensationOperationRepository {
  throw new Error('legacy_institution_credential_compensation_operation_repository_disabled');
}
