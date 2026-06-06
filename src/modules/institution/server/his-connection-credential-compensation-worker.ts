import { randomUUID } from 'node:crypto';

import type {
  HisConnectionCredentialCompensationJobQueueRepository,
  HisConnectionCredentialCompensationJobReadModel,
} from '@/modules/institution/server/his-connection-credential-compensation-job-queue-repository';
import type {
  HisConnectionCredentialCompensationOperationReadModel,
  HisConnectionCredentialCompensationOperationRepository,
} from '@/modules/institution/server/his-connection-credential-compensation-operation-repository';

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

export type HisConnectionCredentialCompensationWorkerItemResult =
  HisConnectionCredentialCompensationWorkerScope & {
    status: HisConnectionCredentialCompensationWorkerResultStatus;
    claimId?: string;
    claimVersion?: number;
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

export type HisConnectionCredentialCompensationWorkerDependencies = {
  operationRepository: HisConnectionCredentialCompensationOperationRepository;
  jobQueueRepository: HisConnectionCredentialCompensationJobQueueRepository;
  nowProvider?: () => Date;
  claimIdFactory?: (input: HisConnectionCredentialCompensationWorkerScope & {
    now: Date;
    workerId: string;
  }) => string;
  workerId?: string;
  lockDurationMs?: number;
  maxBatchSize?: number;
};

type RepositoryMutationStatus = Exclude<
  HisConnectionCredentialCompensationWorkerResultStatus,
  'skipped' | 'manual_review_required'
>;

const fieldLimits = {
  tenantId: 64,
  connectionId: 64,
  operationId: 96,
  workerId: 96,
  claimId: 96,
} as const;

const defaultWorkerId = 'his-credential-compensation-worker';
const defaultLockDurationMs = 60_000;
const defaultMaxBatchSize = 10;

function createDefaultClaimId() {
  return `his_cred_comp_claim_${randomUUID()}`;
}

function normalizeTrustedText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) return null;

  return normalized;
}

function normalizeTenantId(value: unknown) {
  return normalizeTrustedText(value, fieldLimits.tenantId);
}

function normalizeWorkerId(value: unknown) {
  return normalizeTrustedText(value, fieldLimits.workerId);
}

function normalizeClaimId(value: unknown) {
  return normalizeTrustedText(value, fieldLimits.claimId);
}

function normalizeScope(value: {
  tenantId: unknown;
  connectionId: unknown;
  operationId: unknown;
}): HisConnectionCredentialCompensationWorkerScope | null {
  const tenantId = normalizeTrustedText(value.tenantId, fieldLimits.tenantId);
  const connectionId = normalizeTrustedText(value.connectionId, fieldLimits.connectionId);
  const operationId = normalizeTrustedText(value.operationId, fieldLimits.operationId);

  if (!tenantId || !connectionId || !operationId) return null;

  return { tenantId, connectionId, operationId };
}

function normalizeDate(value: unknown) {
  if (!(value instanceof Date)) return null;
  if (Number.isNaN(value.getTime())) return null;

  return value;
}

function normalizePositiveInteger(value: unknown) {
  if (typeof value !== 'number') return null;
  if (!Number.isInteger(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) return null;

  return value;
}

function resolveLimit(limit: unknown, maxBatchSize: number) {
  const normalizedMaxBatchSize = normalizePositiveInteger(maxBatchSize);
  const normalizedLimit = limit === undefined
    ? normalizedMaxBatchSize
    : normalizePositiveInteger(limit);

  if (!normalizedMaxBatchSize || !normalizedLimit) return null;

  return Math.min(normalizedLimit, normalizedMaxBatchSize);
}

function createBatchResult(
  status: HisConnectionCredentialCompensationWorkerBatchResult['status'],
  items: HisConnectionCredentialCompensationWorkerItemResult[] = [],
): HisConnectionCredentialCompensationWorkerBatchResult {
  return { status, items };
}

function createItemResult(
  scope: HisConnectionCredentialCompensationWorkerScope,
  status: HisConnectionCredentialCompensationWorkerResultStatus,
  claim?: { claimId: string | null; claimVersion: number },
): HisConnectionCredentialCompensationWorkerItemResult {
  return {
    ...scope,
    status,
    ...(claim?.claimId ? { claimId: claim.claimId, claimVersion: claim.claimVersion } : {}),
  };
}

function scopeFromJob(
  job: HisConnectionCredentialCompensationJobReadModel,
  trustedTenantId: string,
) {
  const scope = normalizeScope(job);
  if (!scope || scope.tenantId !== trustedTenantId) return null;

  return scope;
}

function scopeFromOperation(
  operation: HisConnectionCredentialCompensationOperationReadModel,
  trustedTenantId: string,
) {
  const scope = normalizeScope(operation);
  if (!scope || scope.tenantId !== trustedTenantId) return null;

  return scope;
}

function repositoryStatusToItemStatus(status: RepositoryMutationStatus) {
  return status;
}

async function safelyCallRepository<T extends { status: string }>(
  callback: () => Promise<T>,
): Promise<T | { status: 'repository_error' }> {
  try {
    return await callback();
  } catch {
    return { status: 'repository_error' };
  }
}

export function createHisConnectionCredentialCompensationWorker(
  dependencies: HisConnectionCredentialCompensationWorkerDependencies,
) {
  const nowProvider = dependencies.nowProvider ?? (() => new Date());
  const claimIdFactory = dependencies.claimIdFactory ?? createDefaultClaimId;
  const configuredWorkerId = normalizeWorkerId(dependencies.workerId) ?? defaultWorkerId;
  const configuredLockDurationMs =
    normalizePositiveInteger(dependencies.lockDurationMs) ?? defaultLockDurationMs;
  const configuredMaxBatchSize =
    normalizePositiveInteger(dependencies.maxBatchSize) ?? defaultMaxBatchSize;

  function resolveNow(value: unknown) {
    if (value !== undefined) return normalizeDate(value);

    return normalizeDate(nowProvider());
  }

  function resolveClaimId(scope: HisConnectionCredentialCompensationWorkerScope, now: Date, workerId: string) {
    try {
      return normalizeClaimId(claimIdFactory({ ...scope, now, workerId }));
    } catch {
      return null;
    }
  }

  async function markStaleOperationManualReview(
    scope: HisConnectionCredentialCompensationWorkerScope,
  ): Promise<HisConnectionCredentialCompensationWorkerItemResult> {
    const result = await safelyCallRepository(() =>
      dependencies.operationRepository.markCredentialCompensationOperationManualReviewRequired(scope),
    );

    if (result.status === 'ok') {
      return createItemResult(scope, 'manual_review_required');
    }
    if (result.status === 'repository_error') {
      return createItemResult(scope, 'repository_error');
    }

    return createItemResult(scope, repositoryStatusToItemStatus(result.status));
  }

  return {
    async claimDueCredentialCompensationJobs(
      input: ClaimDueCredentialCompensationJobsInput,
    ): Promise<HisConnectionCredentialCompensationWorkerBatchResult> {
      const tenantId = normalizeTenantId(input.tenantId);
      const now = resolveNow(input.now);
      const workerId = normalizeWorkerId(input.workerId) ?? configuredWorkerId;
      const durationMs = input.lockDurationMs === undefined
        ? configuredLockDurationMs
        : normalizePositiveInteger(input.lockDurationMs);
      const limit = resolveLimit(input.limit, configuredMaxBatchSize);

      if (!tenantId || !now || !workerId || !durationMs || !limit) {
        return createBatchResult('validation_failed');
      }

      const dueJobs = await safelyCallRepository(() =>
        dependencies.jobQueueRepository.listDueCredentialCompensationJobs({ tenantId, now }),
      );
      if (dueJobs.status !== 'ok') {
        return createBatchResult(dueJobs.status);
      }

      const items: HisConnectionCredentialCompensationWorkerItemResult[] = [];
      for (const job of dueJobs.records.slice(0, limit)) {
        const scope = scopeFromJob(job, tenantId);
        if (!scope) {
          items.push({
            tenantId,
            connectionId: '',
            operationId: '',
            status: 'validation_failed',
          });
          continue;
        }

        const claimId = resolveClaimId(scope, now, workerId);
        if (!claimId) {
          items.push(createItemResult(scope, 'validation_failed'));
          continue;
        }

        const claimResult = await safelyCallRepository(() =>
          dependencies.jobQueueRepository.claimDueCredentialCompensationJob({
            ...scope,
            claimId,
            claimedBy: workerId,
            lockedUntil: new Date(now.getTime() + durationMs),
            now,
          }),
        );
        if (claimResult.status !== 'ok') {
          items.push(createItemResult(scope, repositoryStatusToItemStatus(claimResult.status)));
          continue;
        }

        const claimedScope = scopeFromJob(claimResult.record, tenantId);
        const returnedClaimId = normalizeClaimId(claimResult.record.claimId);
        if (
          !claimedScope ||
          claimedScope.connectionId !== scope.connectionId ||
          claimedScope.operationId !== scope.operationId ||
          !returnedClaimId
        ) {
          items.push(createItemResult(scope, 'validation_failed'));
          continue;
        }

        const claim = {
          claimId: returnedClaimId,
          claimVersion: claimResult.record.claimVersion,
        };
        const runningJobResult = await safelyCallRepository(() =>
          dependencies.jobQueueRepository.markCredentialCompensationJobRunning({
            ...claimedScope,
            ...claim,
            now,
          }),
        );
        if (runningJobResult.status !== 'ok') {
          items.push(createItemResult(claimedScope, repositoryStatusToItemStatus(runningJobResult.status), claim));
          continue;
        }

        const runningScope = scopeFromJob(runningJobResult.record, tenantId);
        if (
          !runningScope ||
          runningScope.connectionId !== claimedScope.connectionId ||
          runningScope.operationId !== claimedScope.operationId
        ) {
          items.push(createItemResult(claimedScope, 'validation_failed', claim));
          continue;
        }

        const operationResult = await safelyCallRepository(() =>
          dependencies.operationRepository.markCredentialCompensationOperationRunning(runningScope),
        );
        if (operationResult.status !== 'ok') {
          items.push(createItemResult(runningScope, repositoryStatusToItemStatus(operationResult.status), claim));
          continue;
        }

        items.push(createItemResult(runningScope, 'ok', claim));
      }

      return createBatchResult('ok', items);
    },

    async recoverExpiredLockedCredentialCompensationJobs(
      input: RecoverExpiredLockedCredentialCompensationJobsInput,
    ): Promise<HisConnectionCredentialCompensationWorkerBatchResult> {
      const tenantId = normalizeTenantId(input.tenantId);
      const now = resolveNow(input.now);
      const limit = resolveLimit(input.limit, configuredMaxBatchSize);

      if (!tenantId || !now || !limit) return createBatchResult('validation_failed');

      const lockedJobs = await safelyCallRepository(() =>
        dependencies.jobQueueRepository.listExpiredLockedCredentialCompensationJobs({
          tenantId,
          now,
        }),
      );
      if (lockedJobs.status !== 'ok') {
        return createBatchResult(lockedJobs.status);
      }

      const items: HisConnectionCredentialCompensationWorkerItemResult[] = [];
      for (const job of lockedJobs.records.slice(0, limit)) {
        const scope = scopeFromJob(job, tenantId);
        if (!scope) {
          items.push({
            tenantId,
            connectionId: '',
            operationId: '',
            status: 'validation_failed',
          });
          continue;
        }

        if (job.jobState === 'claimed') {
          items.push(createItemResult(scope, 'skipped', {
            claimId: job.claimId,
            claimVersion: job.claimVersion,
          }));
          continue;
        }

        const runningClaimId = job.claimId;
        if (job.jobState !== 'running' || !runningClaimId) {
          items.push(createItemResult(scope, 'manual_review_required'));
          continue;
        }

        const manualReviewResult = await safelyCallRepository(() =>
          dependencies.jobQueueRepository.markCredentialCompensationJobManualReviewRequired({
            ...scope,
            claimId: runningClaimId,
            claimVersion: job.claimVersion,
            now,
          }),
        );
        if (manualReviewResult.status === 'ok') {
          const operationManualReviewResult = await safelyCallRepository(() =>
            dependencies.operationRepository.markCredentialCompensationOperationManualReviewRequired(scope),
          );
          if (operationManualReviewResult.status !== 'ok') {
            items.push(createItemResult(
              scope,
              repositoryStatusToItemStatus(operationManualReviewResult.status),
              {
                claimId: runningClaimId,
                claimVersion: job.claimVersion,
              },
            ));
            continue;
          }

          items.push(createItemResult(scope, 'manual_review_required', {
            claimId: runningClaimId,
            claimVersion: job.claimVersion,
          }));
          continue;
        }

        items.push(createItemResult(scope, repositoryStatusToItemStatus(manualReviewResult.status), {
          claimId: runningClaimId,
          claimVersion: job.claimVersion,
        }));
      }

      return createBatchResult('ok', items);
    },

    async recoverStaleRunningCredentialCompensationOperations(
      input: RecoverStaleRunningCredentialCompensationOperationsInput,
    ): Promise<HisConnectionCredentialCompensationWorkerBatchResult> {
      const tenantId = normalizeTenantId(input.tenantId);
      const staleBeforeDate = normalizeDate(input.staleBefore);
      const limit = resolveLimit(input.limit, configuredMaxBatchSize);

      if (!tenantId || !staleBeforeDate || !limit) {
        return createBatchResult('validation_failed');
      }

      const staleOperations = await safelyCallRepository(() =>
        dependencies.operationRepository.listStaleRunningCredentialCompensationOperations({
          tenantId,
          staleBefore: staleBeforeDate,
        }),
      );
      if (staleOperations.status !== 'ok') {
        return createBatchResult(staleOperations.status);
      }

      const items: HisConnectionCredentialCompensationWorkerItemResult[] = [];
      for (const operation of staleOperations.records.slice(0, limit)) {
        const scope = scopeFromOperation(operation, tenantId);
        if (!scope) {
          items.push({
            tenantId,
            connectionId: '',
            operationId: '',
            status: 'validation_failed',
          });
          continue;
        }

        const jobResult = await safelyCallRepository(() =>
          dependencies.jobQueueRepository.getCredentialCompensationJobByConnection(scope),
        );
        if (jobResult.status === 'repository_error') {
          items.push(createItemResult(scope, 'repository_error'));
          continue;
        }
        if (jobResult.status === 'not_found') {
          items.push(await markStaleOperationManualReview(scope));
          continue;
        }
        if (jobResult.status !== 'ok') {
          items.push(createItemResult(scope, repositoryStatusToItemStatus(jobResult.status)));
          continue;
        }

        const jobScope = scopeFromJob(jobResult.record, tenantId);
        if (
          !jobScope ||
          jobScope.connectionId !== scope.connectionId ||
          jobScope.operationId !== scope.operationId
        ) {
          items.push(createItemResult(scope, 'validation_failed'));
          continue;
        }

        if (jobResult.record.jobState === 'failed') {
          items.push(createItemResult(scope, 'skipped', {
            claimId: jobResult.record.claimId,
            claimVersion: jobResult.record.claimVersion,
          }));
          continue;
        }

        items.push(await markStaleOperationManualReview(scope));
      }

      return createBatchResult('ok', items);
    },
  };
}
