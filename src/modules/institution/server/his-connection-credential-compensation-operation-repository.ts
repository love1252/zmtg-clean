import { randomUUID } from 'node:crypto';
import { and, asc, eq, lte } from 'drizzle-orm';
import type { TenantDatabase } from '@/server/db/client';
import { hisConnectionCredentialCompensationOperations } from '@/server/db/schema';
import {
  hisConnectionCredentialCompensationStates,
  hisConnectionCredentialProviderFailureCategories,
  isSafeHisConnectionCredentialCompensationOperationId,
  type HisConnectionCredentialCompensationOperationType,
  type HisConnectionCredentialCompensationState,
  type HisConnectionCredentialProviderFailureCategory,
} from '@/modules/institution/server/his-connection-credential-provider-failure';

type CompensationOperationRow =
  typeof hisConnectionCredentialCompensationOperations.$inferSelect;
type CompensationOperationInsert =
  typeof hisConnectionCredentialCompensationOperations.$inferInsert;

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

const fieldLimits = {
  tenantId: 64,
  connectionId: 64,
  operationId: 96,
} as const;

const forbiddenOperationRepositoryPattern =
  /cred_ref_|credentialRef|credential_ref|idempotencyKey|synthetic_placeholder|providerPath|secretPath|\/vault|kms|sk_live|sk_test|token|secret|api[_-]?key|connection[_-]?string|password|private[_-]?key|raw[_-]?credential|raw[_-]?payload|DATABASE_URL|postgres:\/\/|mysql:\/\/|select \* from|SQL|stack/i;

function createCompensationOperationRowId() {
  return `his_cred_comp_op_row_${randomUUID()}`;
}

function normalizeTrustedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) return null;
  if (forbiddenOperationRepositoryPattern.test(normalized)) return null;

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

function normalizeLookupInput(
  input: CredentialCompensationOperationLookupInput,
): CredentialCompensationOperationLookupInput | null {
  const tenantId = normalizeTenantId(input.tenantId);
  const operationId = normalizeOperationId(input.operationId);

  if (!tenantId || !operationId) return null;

  return { tenantId, operationId };
}

function normalizeConnectionLookupInput(
  input: CredentialCompensationOperationConnectionLookupInput,
): CredentialCompensationOperationConnectionLookupInput | null {
  const tenantId = normalizeTenantId(input.tenantId);
  const connectionId = normalizeConnectionId(input.connectionId);
  const operationId = normalizeOperationId(input.operationId);

  if (!tenantId || !connectionId || !operationId) return null;

  return { tenantId, connectionId, operationId };
}

function normalizeCreateInput(
  input: CreateCredentialCompensationOperationCommand,
): CreateCredentialCompensationOperationCommand | null {
  const tenantId = normalizeTenantId(input.tenantId);
  const connectionId = normalizeConnectionId(input.connectionId);
  const operationId = normalizeOperationId(input.operationId);

  if (!tenantId || !connectionId || !operationId) return null;
  if (!isProviderFailureCategory(input.failureCategory)) return null;

  return {
    tenantId,
    connectionId,
    operationId,
    failureCategory: input.failureCategory,
  };
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function rowMatchesLookup(row: CompensationOperationRow, input: CredentialCompensationOperationLookupInput) {
  return row.tenantId === input.tenantId && row.operationId === input.operationId;
}

function rowMatchesConnectionLookup(
  row: CompensationOperationRow,
  input: CredentialCompensationOperationConnectionLookupInput,
) {
  return (
    row.tenantId === input.tenantId &&
    row.connectionId === input.connectionId &&
    row.operationId === input.operationId
  );
}

function rowHasSafeStateAndCategory(row: CompensationOperationRow) {
  return isCompensationState(row.state) && isProviderFailureCategory(row.failureCategory);
}

export function mapHisConnectionCredentialCompensationOperationRowToReadModel(
  row: CompensationOperationRow,
): HisConnectionCredentialCompensationOperationReadModel {
  return {
    operationId: row.operationId,
    tenantId: row.tenantId,
    connectionId: row.connectionId,
    operationType: row.operationType,
    state: row.state,
    failureCategory: row.failureCategory,
    retryCount: row.retryCount,
    manualReviewRequired: row.manualReviewRequired,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

async function findCompensationOperationByConnection(
  database: TenantDatabase,
  input: CredentialCompensationOperationConnectionLookupInput,
): Promise<CompensationOperationRow | null> {
  const rows = await database
    .select()
    .from(hisConnectionCredentialCompensationOperations)
    .where(
      and(
        eq(hisConnectionCredentialCompensationOperations.tenantId, input.tenantId),
        eq(hisConnectionCredentialCompensationOperations.connectionId, input.connectionId),
        eq(hisConnectionCredentialCompensationOperations.operationId, input.operationId),
      ),
    );

  return rows.find((candidate) => rowMatchesConnectionLookup(candidate, input)) ?? null;
}

function canTransitionToRunning(state: HisConnectionCredentialCompensationState) {
  return (
    state === 'compensation_pending' ||
    state === 'compensation_failed' ||
    state === 'manual_review_required'
  );
}

function canCompleteRunningOperation(state: HisConnectionCredentialCompensationState) {
  return state === 'compensation_running';
}

function canIncrementRetryCount(state: HisConnectionCredentialCompensationState) {
  return state === 'compensation_failed' || state === 'manual_review_required';
}

async function updateCompensationOperation(
  database: TenantDatabase,
  input: CredentialCompensationOperationConnectionLookupInput,
  currentState: HisConnectionCredentialCompensationState,
  values: Partial<CompensationOperationInsert>,
): Promise<CredentialCompensationOperationMutationResult> {
  try {
    const [row] = await database
      .update(hisConnectionCredentialCompensationOperations)
      .set(values)
      .where(
        and(
          eq(hisConnectionCredentialCompensationOperations.tenantId, input.tenantId),
          eq(hisConnectionCredentialCompensationOperations.connectionId, input.connectionId),
          eq(hisConnectionCredentialCompensationOperations.operationId, input.operationId),
          eq(hisConnectionCredentialCompensationOperations.state, currentState),
        ),
      )
      .returning();

    if (!row) return { status: 'conflict' };
    if (!rowMatchesConnectionLookup(row, input) || !rowHasSafeStateAndCategory(row)) {
      return { status: 'not_found' };
    }

    return {
      status: 'ok',
      record: mapHisConnectionCredentialCompensationOperationRowToReadModel(row),
    };
  } catch {
    return { status: 'repository_error' };
  }
}

async function transitionCompensationOperation(
  database: TenantDatabase,
  input: CredentialCompensationOperationConnectionLookupInput,
  decideValues: (
    current: CompensationOperationRow,
  ) => { status: 'ok'; values: Partial<CompensationOperationInsert> } | {
    status: 'invalid_state_transition';
  },
): Promise<CredentialCompensationOperationMutationResult> {
  const command = normalizeConnectionLookupInput(input);
  if (!command) return { status: 'validation_failed' };

  let currentRow: CompensationOperationRow | null;
  try {
    currentRow = await findCompensationOperationByConnection(database, command);
  } catch {
    return { status: 'repository_error' };
  }

  if (!currentRow || !rowHasSafeStateAndCategory(currentRow)) {
    return { status: 'not_found' };
  }

  const decision = decideValues(currentRow);
  if (decision.status !== 'ok') {
    return { status: decision.status };
  }

  return updateCompensationOperation(database, command, currentRow.state, decision.values);
}

export function createHisConnectionCredentialCompensationOperationRepository(
  database: TenantDatabase,
) {
  return {
    async createCredentialCompensationOperation(
      input: CreateCredentialCompensationOperationCommand,
    ): Promise<CredentialCompensationOperationMutationResult> {
      const command = normalizeCreateInput(input);
      if (!command) return { status: 'validation_failed' };

      const now = new Date();
      try {
        const [row] = await database
          .insert(hisConnectionCredentialCompensationOperations)
          .values({
            id: createCompensationOperationRowId(),
            tenantId: command.tenantId,
            connectionId: command.connectionId,
            operationId: command.operationId,
            operationType: 'credential_compensation',
            state: 'compensation_pending',
            failureCategory: command.failureCategory,
            retryCount: 0,
            manualReviewRequired: false,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        if (!row || !rowMatchesConnectionLookup(row, command) || !rowHasSafeStateAndCategory(row)) {
          return { status: 'not_found' };
        }

        return {
          status: 'ok',
          record: mapHisConnectionCredentialCompensationOperationRowToReadModel(row),
        };
      } catch (error) {
        if (isUniqueViolation(error)) {
          return { status: 'conflict' };
        }

        return { status: 'repository_error' };
      }
    },

    async getCredentialCompensationOperationByOperationId(
      input: CredentialCompensationOperationLookupInput,
    ): Promise<CredentialCompensationOperationMutationResult> {
      const command = normalizeLookupInput(input);
      if (!command) return { status: 'validation_failed' };

      try {
        const rows = await database
          .select()
          .from(hisConnectionCredentialCompensationOperations)
          .where(
            and(
              eq(hisConnectionCredentialCompensationOperations.tenantId, command.tenantId),
              eq(hisConnectionCredentialCompensationOperations.operationId, command.operationId),
            ),
          );
        const row = rows.find((candidate) => rowMatchesLookup(candidate, command));

        if (!row || !rowHasSafeStateAndCategory(row)) {
          return { status: 'not_found' };
        }

        return {
          status: 'ok',
          record: mapHisConnectionCredentialCompensationOperationRowToReadModel(row),
        };
      } catch {
        return { status: 'repository_error' };
      }
    },

    async getCredentialCompensationOperationByConnection(
      input: CredentialCompensationOperationConnectionLookupInput,
    ): Promise<CredentialCompensationOperationMutationResult> {
      const command = normalizeConnectionLookupInput(input);
      if (!command) return { status: 'validation_failed' };

      try {
        const row = await findCompensationOperationByConnection(database, command);

        if (!row || !rowHasSafeStateAndCategory(row)) {
          return { status: 'not_found' };
        }

        return {
          status: 'ok',
          record: mapHisConnectionCredentialCompensationOperationRowToReadModel(row),
        };
      } catch {
        return { status: 'repository_error' };
      }
    },

    async markCredentialCompensationOperationRunning(
      input: CredentialCompensationOperationConnectionLookupInput,
    ): Promise<CredentialCompensationOperationMutationResult> {
      return transitionCompensationOperation(database, input, (current) => {
        if (!canTransitionToRunning(current.state)) {
          return { status: 'invalid_state_transition' };
        }

        const now = new Date();
        return {
          status: 'ok',
          values: {
            state: 'compensation_running',
            updatedAt: now,
            lastAttemptAt: now,
            completedAt: null,
          },
        };
      });
    },

    async markCredentialCompensationOperationSucceeded(
      input: CredentialCompensationOperationConnectionLookupInput,
    ): Promise<CredentialCompensationOperationMutationResult> {
      return transitionCompensationOperation(database, input, (current) => {
        if (!canCompleteRunningOperation(current.state)) {
          return { status: 'invalid_state_transition' };
        }

        const now = new Date();
        return {
          status: 'ok',
          values: {
            state: 'compensation_succeeded',
            updatedAt: now,
            completedAt: now,
            manualReviewRequired: false,
          },
        };
      });
    },

    async markCredentialCompensationOperationFailed(
      input: CredentialCompensationOperationConnectionLookupInput,
    ): Promise<CredentialCompensationOperationMutationResult> {
      return transitionCompensationOperation(database, input, (current) => {
        if (!canCompleteRunningOperation(current.state)) {
          return { status: 'invalid_state_transition' };
        }

        const now = new Date();
        return {
          status: 'ok',
          values: {
            state: 'compensation_failed',
            updatedAt: now,
            completedAt: now,
            manualReviewRequired: false,
          },
        };
      });
    },

    async markCredentialCompensationOperationManualReviewRequired(
      input: CredentialCompensationOperationConnectionLookupInput,
    ): Promise<CredentialCompensationOperationMutationResult> {
      return transitionCompensationOperation(database, input, (current) => {
        if (!canCompleteRunningOperation(current.state)) {
          return { status: 'invalid_state_transition' };
        }

        const now = new Date();
        return {
          status: 'ok',
          values: {
            state: 'manual_review_required',
            manualReviewRequired: true,
            updatedAt: now,
            completedAt: now,
          },
        };
      });
    },

    async incrementCredentialCompensationOperationRetryCount(
      input: CredentialCompensationOperationConnectionLookupInput,
    ): Promise<CredentialCompensationOperationMutationResult> {
      return transitionCompensationOperation(database, input, (current) => {
        if (!canIncrementRetryCount(current.state) || current.retryCount < 0) {
          return { status: 'invalid_state_transition' };
        }

        const now = new Date();
        return {
          status: 'ok',
          values: {
            retryCount: current.retryCount + 1,
            updatedAt: now,
            lastAttemptAt: now,
          },
        };
      });
    },

    async listPendingCredentialCompensationOperations(
      input: ListCredentialCompensationOperationsInput,
    ): Promise<CredentialCompensationOperationListResult> {
      const tenantId = normalizeTenantId(input.tenantId);
      if (!tenantId) return { status: 'validation_failed' };

      try {
        const rows = await database
          .select()
          .from(hisConnectionCredentialCompensationOperations)
          .where(
            and(
              eq(hisConnectionCredentialCompensationOperations.tenantId, tenantId),
              eq(hisConnectionCredentialCompensationOperations.state, 'compensation_pending'),
            ),
          )
          .orderBy(
            asc(hisConnectionCredentialCompensationOperations.updatedAt),
            asc(hisConnectionCredentialCompensationOperations.operationId),
          );

        return {
          status: 'ok',
          records: rows
            .filter(
              (row) =>
                row.tenantId === tenantId &&
                row.state === 'compensation_pending' &&
                rowHasSafeStateAndCategory(row),
            )
            .map(mapHisConnectionCredentialCompensationOperationRowToReadModel),
        };
      } catch {
        return { status: 'repository_error' };
      }
    },

    async listStaleRunningCredentialCompensationOperations(
      input: ListStaleRunningCredentialCompensationOperationsInput,
    ): Promise<CredentialCompensationOperationListResult> {
      const tenantId = normalizeTenantId(input.tenantId);
      if (!tenantId || !(input.staleBefore instanceof Date)) {
        return { status: 'validation_failed' };
      }

      try {
        const rows = await database
          .select()
          .from(hisConnectionCredentialCompensationOperations)
          .where(
            and(
              eq(hisConnectionCredentialCompensationOperations.tenantId, tenantId),
              eq(hisConnectionCredentialCompensationOperations.state, 'compensation_running'),
              lte(
                hisConnectionCredentialCompensationOperations.lastAttemptAt,
                input.staleBefore,
              ),
            ),
          )
          .orderBy(
            asc(hisConnectionCredentialCompensationOperations.lastAttemptAt),
            asc(hisConnectionCredentialCompensationOperations.operationId),
          );

        return {
          status: 'ok',
          records: rows
            .filter(
              (row) =>
                row.tenantId === tenantId &&
                row.state === 'compensation_running' &&
                row.lastAttemptAt !== null &&
                row.lastAttemptAt <= input.staleBefore &&
                rowHasSafeStateAndCategory(row),
            )
            .map(mapHisConnectionCredentialCompensationOperationRowToReadModel),
        };
      } catch {
        return { status: 'repository_error' };
      }
    },
  };
}

export type HisConnectionCredentialCompensationOperationRepository = ReturnType<
  typeof createHisConnectionCredentialCompensationOperationRepository
>;
