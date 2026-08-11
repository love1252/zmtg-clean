import { randomUUID } from 'node:crypto';
import { and, asc, eq, lte } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import type { HisConnectionCredentialCompensationJobQueueRepository as HisConnectionCredentialCompensationJobQueueRepositoryPort } from '@/modules/institution-system/application/his-connection-credential-compensation-ports';
import { hisConnectionCredentialCompensationJobs } from '@/server/db/schema';
import {
  hisConnectionCredentialCompensationDeadLetterReasons,
  hisConnectionCredentialCompensationJobStates,
  hisConnectionCredentialCompensationOperationTypes,
  hisConnectionCredentialProviderFailureCategories,
  isSafeHisConnectionCredentialCompensationOperationId,
  type HisConnectionCredentialCompensationDeadLetterReason,
  type HisConnectionCredentialCompensationJobState,
  type HisConnectionCredentialCompensationOperationType,
  type HisConnectionCredentialProviderFailureCategory,
} from '@/modules/institution-system/domain/his-connection-credential-compensation';
export {
  hisConnectionCredentialCompensationDeadLetterReasons,
  hisConnectionCredentialCompensationJobStates,
} from '@/modules/institution-system/domain/his-connection-credential-compensation';
export type {
  HisConnectionCredentialCompensationDeadLetterReason,
  HisConnectionCredentialCompensationJobState,
} from '@/modules/institution-system/domain/his-connection-credential-compensation';

type CompensationJobRow = typeof hisConnectionCredentialCompensationJobs.$inferSelect;
type CompensationJobInsert = typeof hisConnectionCredentialCompensationJobs.$inferInsert;


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

const fieldLimits = {
  tenantId: 64,
  connectionId: 64,
  operationId: 96,
  claimId: 96,
  claimedBy: 96,
} as const;

const forbiddenJobRepositoryPattern =
  /cred_ref_|credentialRef|credential_ref|idempotencyKey|synthetic_placeholder|providerPath|secretPath|\/vault|kms|sk_live|sk_test|token|secret|api[_-]?key|connection[_-]?string|password|private[_-]?key|raw[_-]?credential|raw[_-]?payload|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack/i;

function createCompensationJobRowId() {
  return `his_cred_comp_job_${randomUUID()}`;
}

function normalizeTrustedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) return null;
  if (forbiddenJobRepositoryPattern.test(normalized)) return null;

  return normalized;
}

function normalizeTenantId(value: unknown) {
  return normalizeTrustedText(value, fieldLimits.tenantId);
}

function normalizeConnectionId(value: unknown) {
  return normalizeTrustedText(value, fieldLimits.connectionId);
}

function normalizeOperationId(value: unknown) {
  const operationId = normalizeTrustedText(value, fieldLimits.operationId);
  if (!isSafeHisConnectionCredentialCompensationOperationId(operationId)) return null;

  return operationId;
}

function normalizeClaimId(value: unknown) {
  return normalizeTrustedText(value, fieldLimits.claimId);
}

function normalizeClaimedBy(value: unknown) {
  return normalizeTrustedText(value, fieldLimits.claimedBy);
}

function normalizeDate(value: unknown): Date | null {
  if (!(value instanceof Date)) return null;
  if (Number.isNaN(value.getTime())) return null;

  return value;
}

function normalizeClaimVersion(value: unknown) {
  if (typeof value !== 'number') return null;
  if (!Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    return null;
  }

  return value;
}

function normalizeMaxRetryCount(value: unknown) {
  if (value === undefined) return 3;
  if (typeof value !== 'number') return null;
  if (!Number.isInteger(value) || value < 1 || value > 99) return null;

  return value;
}

function isOperationType(
  value: unknown,
): value is HisConnectionCredentialCompensationOperationType {
  return (
    typeof value === 'string' &&
    (hisConnectionCredentialCompensationOperationTypes as readonly string[]).includes(value)
  );
}

function isProviderFailureCategory(
  value: unknown,
): value is HisConnectionCredentialProviderFailureCategory {
  return (
    typeof value === 'string' &&
    (hisConnectionCredentialProviderFailureCategories as readonly string[]).includes(value)
  );
}

function isJobState(value: unknown): value is HisConnectionCredentialCompensationJobState {
  return (
    typeof value === 'string' &&
    (hisConnectionCredentialCompensationJobStates as readonly string[]).includes(value)
  );
}

function isDeadLetterReason(
  value: unknown,
): value is HisConnectionCredentialCompensationDeadLetterReason {
  return (
    typeof value === 'string' &&
    (hisConnectionCredentialCompensationDeadLetterReasons as readonly string[]).includes(value)
  );
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function normalizeScopeInput(
  input: CredentialCompensationJobScopeInput,
): CredentialCompensationJobScopeInput | null {
  const tenantId = normalizeTenantId(input.tenantId);
  const connectionId = normalizeConnectionId(input.connectionId);
  const operationId = normalizeOperationId(input.operationId);

  if (!tenantId || !connectionId || !operationId) return null;

  return { tenantId, connectionId, operationId };
}

function normalizeCreateInput(
  input: CreateCredentialCompensationJobCommand,
): (CredentialCompensationJobScopeInput & {
  failureCategory: HisConnectionCredentialProviderFailureCategory;
  maxRetryCount: number;
  nextAttemptAt: Date;
}) | null {
  const scope = normalizeScopeInput(input);
  const maxRetryCount = normalizeMaxRetryCount(input.maxRetryCount);
  const nextAttemptAt = input.nextAttemptAt === undefined
    ? new Date()
    : normalizeDate(input.nextAttemptAt);

  if (!scope || !maxRetryCount || !nextAttemptAt) return null;
  if (!isProviderFailureCategory(input.failureCategory)) return null;

  return {
    ...scope,
    failureCategory: input.failureCategory,
    maxRetryCount,
    nextAttemptAt,
  };
}

function normalizeListInput(input: ListCredentialCompensationJobsInput) {
  const tenantId = normalizeTenantId(input.tenantId);
  const now = normalizeDate(input.now);

  if (!tenantId || !now) return null;

  return { tenantId, now };
}

function normalizeClaimDueInput(
  input: ClaimDueCredentialCompensationJobCommand,
): ClaimDueCredentialCompensationJobCommand | null {
  const scope = normalizeScopeInput(input);
  const claimId = normalizeClaimId(input.claimId);
  const claimedBy = normalizeClaimedBy(input.claimedBy);
  const lockedUntil = normalizeDate(input.lockedUntil);
  const now = normalizeDate(input.now);

  if (!scope || !claimId || !claimedBy || !lockedUntil || !now) return null;
  if (lockedUntil <= now) return null;

  return { ...scope, claimId, claimedBy, lockedUntil, now };
}

function normalizeClaimedInput(
  input: ClaimedCredentialCompensationJobCommand,
): ClaimedCredentialCompensationJobCommand | null {
  const scope = normalizeScopeInput(input);
  const claimId = normalizeClaimId(input.claimId);
  const claimVersion = normalizeClaimVersion(input.claimVersion);
  const now = normalizeDate(input.now);

  if (!scope || !claimId || claimVersion === null || !now) return null;

  return { ...scope, claimId, claimVersion, now };
}

function normalizeRequeueInput(
  input: RequeueCredentialCompensationJobCommand,
): RequeueCredentialCompensationJobCommand | null {
  const command = normalizeClaimedInput(input);
  const nextAttemptAt = normalizeDate(input.nextAttemptAt);

  if (!command || !nextAttemptAt) return null;

  return { ...command, nextAttemptAt };
}

function normalizeDeadLetterInput(
  input: DeadLetterCredentialCompensationJobCommand,
): DeadLetterCredentialCompensationJobCommand | null {
  const command = normalizeClaimedInput(input);

  if (!command || !isDeadLetterReason(input.deadLetterReason)) return null;

  return { ...command, deadLetterReason: input.deadLetterReason };
}

function rowMatchesScope(row: CompensationJobRow, input: CredentialCompensationJobScopeInput) {
  return (
    row.tenantId === input.tenantId &&
    row.connectionId === input.connectionId &&
    row.operationId === input.operationId
  );
}

function rowHasSafeEnums(row: CompensationJobRow) {
  return (
    isOperationType(row.operationType) &&
    isJobState(row.jobState) &&
    isProviderFailureCategory(row.failureCategory) &&
    (row.deadLetterReason === null || isDeadLetterReason(row.deadLetterReason))
  );
}

function hasActiveLock(row: CompensationJobRow, now: Date) {
  return row.lockedUntil !== null && row.lockedUntil > now;
}

function claimMatches(
  row: CompensationJobRow,
  input: ClaimedCredentialCompensationJobCommand,
) {
  return row.claimId === input.claimId && row.claimVersion === input.claimVersion;
}

function canClaim(row: CompensationJobRow, now: Date) {
  if (row.nextAttemptAt > now) return false;
  if (row.jobState === 'queued') return !hasActiveLock(row, now);
  if (row.jobState === 'claimed' || row.jobState === 'running') {
    return row.lockedUntil !== null && row.lockedUntil <= now;
  }

  return false;
}

function canDeadLetterOrManualReview(row: CompensationJobRow) {
  return row.jobState === 'claimed' || row.jobState === 'running' || row.jobState === 'failed';
}

export function mapHisConnectionCredentialCompensationJobRowToReadModel(
  row: CompensationJobRow,
): HisConnectionCredentialCompensationJobReadModel {
  return {
    id: row.id,
    tenantId: row.tenantId,
    connectionId: row.connectionId,
    operationId: row.operationId,
    operationType: row.operationType,
    jobState: row.jobState,
    failureCategory: row.failureCategory,
    retryCount: row.retryCount,
    maxRetryCount: row.maxRetryCount,
    nextAttemptAt: row.nextAttemptAt.toISOString(),
    lockedUntil: row.lockedUntil?.toISOString() ?? null,
    claimId: row.claimId,
    claimVersion: row.claimVersion,
    claimedBy: row.claimedBy,
    claimedAt: row.claimedAt?.toISOString() ?? null,
    lastHeartbeatAt: row.lastHeartbeatAt?.toISOString() ?? null,
    deadLetterReason: row.deadLetterReason,
    manualReviewRequired: row.manualReviewRequired,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

async function findJobByScope(
  database: TenantDatabase,
  input: CredentialCompensationJobScopeInput,
): Promise<CompensationJobRow | null> {
  const rows = await database
    .select()
    .from(hisConnectionCredentialCompensationJobs)
    .where(
      and(
        eq(hisConnectionCredentialCompensationJobs.tenantId, input.tenantId),
        eq(hisConnectionCredentialCompensationJobs.connectionId, input.connectionId),
        eq(hisConnectionCredentialCompensationJobs.operationId, input.operationId),
      ),
    );

  return rows.find((candidate) => rowMatchesScope(candidate, input)) ?? null;
}

async function updateJobByScope(
  database: TenantDatabase,
  input: CredentialCompensationJobScopeInput,
  current: CompensationJobRow,
  values: Partial<CompensationJobInsert>,
): Promise<CredentialCompensationJobMutationResult> {
  try {
    const [row] = await database
      .update(hisConnectionCredentialCompensationJobs)
      .set(values)
      .where(
        and(
          eq(hisConnectionCredentialCompensationJobs.tenantId, input.tenantId),
          eq(hisConnectionCredentialCompensationJobs.connectionId, input.connectionId),
          eq(hisConnectionCredentialCompensationJobs.operationId, input.operationId),
          eq(hisConnectionCredentialCompensationJobs.jobState, current.jobState),
          eq(hisConnectionCredentialCompensationJobs.claimVersion, current.claimVersion),
        ),
      )
      .returning();

    if (!row) return { status: 'conflict' };
    if (!rowMatchesScope(row, input) || !rowHasSafeEnums(row)) {
      return { status: 'not_found' };
    }

    return {
      status: 'ok',
      record: mapHisConnectionCredentialCompensationJobRowToReadModel(row),
    };
  } catch {
    return { status: 'repository_error' };
  }
}

async function withCurrentJob(
  database: TenantDatabase,
  input: CredentialCompensationJobScopeInput,
  decideValues: (
    current: CompensationJobRow,
  ) => { status: 'ok'; values: Partial<CompensationJobInsert> } | {
    status: 'conflict' | 'invalid_state_transition';
  },
): Promise<CredentialCompensationJobMutationResult> {
  let currentRow: CompensationJobRow | null;
  try {
    currentRow = await findJobByScope(database, input);
  } catch {
    return { status: 'repository_error' };
  }

  if (!currentRow || !rowHasSafeEnums(currentRow)) {
    return { status: 'not_found' };
  }

  const decision = decideValues(currentRow);
  if (decision.status !== 'ok') {
    return { status: decision.status };
  }

  return updateJobByScope(database, input, currentRow, decision.values);
}

function transitionClaimedJob(
  database: TenantDatabase,
  input: ClaimedCredentialCompensationJobCommand,
  allowedStates: ReadonlySet<HisConnectionCredentialCompensationJobState>,
  decideValues: (current: CompensationJobRow) => Partial<CompensationJobInsert>,
): Promise<CredentialCompensationJobMutationResult> {
  return withCurrentJob(database, input, (current) => {
    if (!allowedStates.has(current.jobState)) {
      return { status: 'invalid_state_transition' };
    }
    if (!claimMatches(current, input)) {
      return { status: 'conflict' };
    }

    return {
      status: 'ok',
      values: decideValues(current),
    };
  });
}

const runningOnlyStates = new Set<HisConnectionCredentialCompensationJobState>([
  'running',
]);
const claimedOnlyStates = new Set<HisConnectionCredentialCompensationJobState>([
  'claimed',
]);
const failedOnlyStates = new Set<HisConnectionCredentialCompensationJobState>([
  'failed',
]);
const deadLetterOrManualReviewStates = new Set<HisConnectionCredentialCompensationJobState>([
  'claimed',
  'running',
  'failed',
]);

export function createHisConnectionCredentialCompensationJobQueueRepository(
  database: TenantDatabase,
): HisConnectionCredentialCompensationJobQueueRepositoryPort {
  return {
    async createCredentialCompensationJob(
      input: CreateCredentialCompensationJobCommand,
    ): Promise<CredentialCompensationJobMutationResult> {
      const command = normalizeCreateInput(input);
      if (!command) return { status: 'validation_failed' };

      const now = new Date();
      try {
        const [row] = await database
          .insert(hisConnectionCredentialCompensationJobs)
          .values({
            id: createCompensationJobRowId(),
            tenantId: command.tenantId,
            connectionId: command.connectionId,
            operationId: command.operationId,
            operationType: 'credential_compensation',
            jobState: 'queued',
            failureCategory: command.failureCategory,
            retryCount: 0,
            maxRetryCount: command.maxRetryCount,
            nextAttemptAt: command.nextAttemptAt,
            claimVersion: 0,
            manualReviewRequired: false,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        if (!row || !rowMatchesScope(row, command) || !rowHasSafeEnums(row)) {
          return { status: 'not_found' };
        }

        return {
          status: 'ok',
          record: mapHisConnectionCredentialCompensationJobRowToReadModel(row),
        };
      } catch (error) {
        if (isUniqueViolation(error)) {
          return { status: 'conflict' };
        }

        return { status: 'repository_error' };
      }
    },

    async getCredentialCompensationJobByOperation(
      input: CredentialCompensationJobScopeInput,
    ): Promise<CredentialCompensationJobMutationResult> {
      const command = normalizeScopeInput(input);
      if (!command) return { status: 'validation_failed' };

      try {
        const row = await findJobByScope(database, command);

        if (!row || !rowHasSafeEnums(row)) {
          return { status: 'not_found' };
        }

        return {
          status: 'ok',
          record: mapHisConnectionCredentialCompensationJobRowToReadModel(row),
        };
      } catch {
        return { status: 'repository_error' };
      }
    },

    async getCredentialCompensationJobByConnection(
      input: CredentialCompensationJobScopeInput,
    ): Promise<CredentialCompensationJobMutationResult> {
      const command = normalizeScopeInput(input);
      if (!command) return { status: 'validation_failed' };

      try {
        const row = await findJobByScope(database, command);

        if (!row || !rowHasSafeEnums(row)) {
          return { status: 'not_found' };
        }

        return {
          status: 'ok',
          record: mapHisConnectionCredentialCompensationJobRowToReadModel(row),
        };
      } catch {
        return { status: 'repository_error' };
      }
    },

    async listDueCredentialCompensationJobs(
      input: ListCredentialCompensationJobsInput,
    ): Promise<CredentialCompensationJobListResult> {
      const command = normalizeListInput(input);
      if (!command) return { status: 'validation_failed' };

      try {
        const rows = await database
          .select()
          .from(hisConnectionCredentialCompensationJobs)
          .where(
            and(
              eq(hisConnectionCredentialCompensationJobs.tenantId, command.tenantId),
              eq(hisConnectionCredentialCompensationJobs.jobState, 'queued'),
              lte(hisConnectionCredentialCompensationJobs.nextAttemptAt, command.now),
            ),
          )
          .orderBy(
            asc(hisConnectionCredentialCompensationJobs.nextAttemptAt),
            asc(hisConnectionCredentialCompensationJobs.operationId),
          );

        return {
          status: 'ok',
          records: rows
            .filter(
              (row) =>
                row.tenantId === command.tenantId &&
                row.jobState === 'queued' &&
                row.nextAttemptAt <= command.now &&
                rowHasSafeEnums(row),
            )
            .map(mapHisConnectionCredentialCompensationJobRowToReadModel),
        };
      } catch {
        return { status: 'repository_error' };
      }
    },

    async claimDueCredentialCompensationJob(
      input: ClaimDueCredentialCompensationJobCommand,
    ): Promise<CredentialCompensationJobMutationResult> {
      const command = normalizeClaimDueInput(input);
      if (!command) return { status: 'validation_failed' };

      return withCurrentJob(database, command, (current) => {
        if (hasActiveLock(current, command.now)) {
          return { status: 'conflict' };
        }
        if (!canClaim(current, command.now)) {
          return { status: 'invalid_state_transition' };
        }

        return {
          status: 'ok',
          values: {
            jobState: 'claimed',
            claimId: command.claimId,
            claimVersion: current.claimVersion + 1,
            claimedBy: command.claimedBy,
            claimedAt: command.now,
            lockedUntil: command.lockedUntil,
            updatedAt: command.now,
          },
        };
      });
    },

    async markCredentialCompensationJobRunning(
      input: ClaimedCredentialCompensationJobCommand,
    ): Promise<CredentialCompensationJobMutationResult> {
      const command = normalizeClaimedInput(input);
      if (!command) return { status: 'validation_failed' };

      return transitionClaimedJob(database, command, claimedOnlyStates, () => ({
        jobState: 'running',
        lastHeartbeatAt: command.now,
        updatedAt: command.now,
      }));
    },

    async markCredentialCompensationJobSucceeded(
      input: ClaimedCredentialCompensationJobCommand,
    ): Promise<CredentialCompensationJobMutationResult> {
      const command = normalizeClaimedInput(input);
      if (!command) return { status: 'validation_failed' };

      return transitionClaimedJob(database, command, runningOnlyStates, () => ({
        jobState: 'succeeded',
        lockedUntil: null,
        updatedAt: command.now,
        completedAt: command.now,
      }));
    },

    async markCredentialCompensationJobFailed(
      input: ClaimedCredentialCompensationJobCommand,
    ): Promise<CredentialCompensationJobMutationResult> {
      const command = normalizeClaimedInput(input);
      if (!command) return { status: 'validation_failed' };

      return transitionClaimedJob(database, command, runningOnlyStates, () => ({
        jobState: 'failed',
        lockedUntil: null,
        updatedAt: command.now,
        completedAt: command.now,
      }));
    },

    async requeueCredentialCompensationJob(
      input: RequeueCredentialCompensationJobCommand,
    ): Promise<CredentialCompensationJobMutationResult> {
      const command = normalizeRequeueInput(input);
      if (!command) return { status: 'validation_failed' };

      return withCurrentJob(database, command, (current) => {
        if (!failedOnlyStates.has(current.jobState)) {
          return { status: 'invalid_state_transition' };
        }
        if (!claimMatches(current, command)) {
          return { status: 'conflict' };
        }
        if (current.retryCount >= current.maxRetryCount) {
          return { status: 'invalid_state_transition' };
        }

        return {
          status: 'ok',
          values: {
            jobState: 'queued',
            retryCount: current.retryCount + 1,
            nextAttemptAt: command.nextAttemptAt,
            claimId: null,
            claimedBy: null,
            claimedAt: null,
            lastHeartbeatAt: null,
            lockedUntil: null,
            deadLetterReason: null,
            manualReviewRequired: false,
            updatedAt: command.now,
            completedAt: null,
          },
        };
      });
    },

    async markCredentialCompensationJobDeadLettered(
      input: DeadLetterCredentialCompensationJobCommand,
    ): Promise<CredentialCompensationJobMutationResult> {
      const command = normalizeDeadLetterInput(input);
      if (!command) return { status: 'validation_failed' };

      return transitionClaimedJob(
        database,
        command,
        deadLetterOrManualReviewStates,
        () => ({
          jobState: 'dead_lettered',
          deadLetterReason: command.deadLetterReason,
          lockedUntil: null,
          updatedAt: command.now,
          completedAt: command.now,
        }),
      );
    },

    async markCredentialCompensationJobManualReviewRequired(
      input: ClaimedCredentialCompensationJobCommand,
    ): Promise<CredentialCompensationJobMutationResult> {
      const command = normalizeClaimedInput(input);
      if (!command) return { status: 'validation_failed' };

      return withCurrentJob(database, command, (current) => {
        if (!canDeadLetterOrManualReview(current)) {
          return { status: 'invalid_state_transition' };
        }
        if (!claimMatches(current, command)) {
          return { status: 'conflict' };
        }

        return {
          status: 'ok',
          values: {
            jobState: 'manual_review_required',
            manualReviewRequired: true,
            lockedUntil: null,
            updatedAt: command.now,
            completedAt: command.now,
          },
        };
      });
    },

    async listExpiredLockedCredentialCompensationJobs(
      input: ListCredentialCompensationJobsInput,
    ): Promise<CredentialCompensationJobListResult> {
      const command = normalizeListInput(input);
      if (!command) return { status: 'validation_failed' };

      try {
        const rows = await database
          .select()
          .from(hisConnectionCredentialCompensationJobs)
          .where(
            and(
              eq(hisConnectionCredentialCompensationJobs.tenantId, command.tenantId),
              lte(hisConnectionCredentialCompensationJobs.lockedUntil, command.now),
            ),
          )
          .orderBy(
            asc(hisConnectionCredentialCompensationJobs.lockedUntil),
            asc(hisConnectionCredentialCompensationJobs.operationId),
          );

        return {
          status: 'ok',
          records: rows
            .filter(
              (row) =>
                row.tenantId === command.tenantId &&
                row.lockedUntil !== null &&
                row.lockedUntil <= command.now &&
                (row.jobState === 'claimed' || row.jobState === 'running') &&
                rowHasSafeEnums(row),
            )
            .map(mapHisConnectionCredentialCompensationJobRowToReadModel),
        };
      } catch {
        return { status: 'repository_error' };
      }
    },
  };
}

export type HisConnectionCredentialCompensationJobQueueRepository = ReturnType<
  typeof createHisConnectionCredentialCompensationJobQueueRepository
>;
