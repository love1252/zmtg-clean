export type BroadcastOutcomeDispatchState =
  | 'not_started'
  | 'task_create_attempted'
  | 'task_created'
  | 'task_create_failed'
  | 'task_create_unknown';

export type BroadcastOutcomeProviderResultCategory =
  | 'accepted'
  | 'rejected'
  | 'timeout'
  | 'transport_error'
  | 'indeterminate';

export type BroadcastOutcomeSendResultStatus =
  | 'not_checked'
  | 'awaiting_member_confirmation'
  | 'target_sent'
  | 'target_failed'
  | 'target_unknown';

export type BroadcastOutcomeFinalizeState =
  | 'not_finalized'
  | 'success_recorded'
  | 'failure_recorded'
  | 'unknown_recorded';

export type BroadcastOutcomeReconciliationState =
  | 'none'
  | 'manual_review_required'
  | 'reconciled';

export type BroadcastOutcomeScope = Readonly<{
  tenantId: string;
  institutionId: string;
  customerId: string;
  operationId: string;
  operationRef: string;
}>;

export type BroadcastOutcomeState = Readonly<
  BroadcastOutcomeScope & {
    id: string;
    capabilityKind: 'customer_broadcast_task';
    providerKind: 'wecom_official_customer_broadcast';
    dispatchState: BroadcastOutcomeDispatchState;
    dispatchCount: 0 | 1;
    dispatchStartedAt: string | null;
    dispatchTerminalAt: string | null;
    taskRefDigest: string | null;
    memberConfirmationRequired: true;
    providerResultCategory: BroadcastOutcomeProviderResultCategory | null;
    sendResultStatus: BroadcastOutcomeSendResultStatus;
    sendResultCheckedAt: string | null;
    finalizeState: BroadcastOutcomeFinalizeState;
    reconciliationState: BroadcastOutcomeReconciliationState;
    manualReviewRequired: boolean;
    automaticRetryAllowed: false;
    version: number;
    createdAt: string;
    updatedAt: string;
  }
>;

export type CreateBroadcastOutcomeCommand = Readonly<{
  scope: BroadcastOutcomeScope;
  id: string;
  occurredAt: string;
}>;

export type UpdateBroadcastOutcomeCommand = Readonly<{
  scope: BroadcastOutcomeScope;
  expectedVersion: number;
  outcome: BroadcastOutcomeState;
}>;

export type BroadcastOutcomeRepositoryCreateInput =
  BroadcastOutcomeScope &
  Readonly<{
    id: string;
    occurredAt: string;
  }>;

export type BroadcastOutcomeRepositoryUpdateInput =
  BroadcastOutcomeScope &
  Readonly<{
    expectedVersion: number;
    outcome: BroadcastOutcomeState;
  }>;

export interface BroadcastOutcomeCommandRepository {
  createNotStarted(
    input: BroadcastOutcomeRepositoryCreateInput,
  ): Promise<BroadcastOutcomeState | null>;
  updateWhenVersionMatches(
    input: BroadcastOutcomeRepositoryUpdateInput,
  ): Promise<BroadcastOutcomeState | null>;
}

export class BroadcastOutcomeCommandInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BroadcastOutcomeCommandInputError';
  }
}

function requireExactIdentifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new BroadcastOutcomeCommandInputError(`invalid_${field}`);
  }
  return value;
}

function requireTimestamp(value: unknown, field: string): string {
  const normalized = requireExactIdentifier(value, field);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new BroadcastOutcomeCommandInputError(`invalid_${field}`);
  }
  return normalized;
}

function requireExpectedVersion(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new BroadcastOutcomeCommandInputError('invalid_expected_version');
  }
  return Number(value);
}

function normalizeScope(scope: BroadcastOutcomeScope): BroadcastOutcomeScope {
  return {
    tenantId: requireExactIdentifier(scope?.tenantId, 'tenant_id'),
    institutionId: requireExactIdentifier(scope?.institutionId, 'institution_id'),
    customerId: requireExactIdentifier(scope?.customerId, 'customer_id'),
    operationId: requireExactIdentifier(scope?.operationId, 'operation_id'),
    operationRef: requireExactIdentifier(scope?.operationRef, 'operation_ref'),
  };
}

function assertOutcomeMatchesCommand(input: {
  scope: BroadcastOutcomeScope;
  expectedVersion: number;
  outcome: BroadcastOutcomeState;
}) {
  const { scope, expectedVersion, outcome } = input;

  if (
    outcome.tenantId !== scope.tenantId ||
    outcome.institutionId !== scope.institutionId ||
    outcome.customerId !== scope.customerId ||
    outcome.operationId !== scope.operationId ||
    outcome.operationRef !== scope.operationRef
  ) {
    throw new BroadcastOutcomeCommandInputError('broadcast_outcome_scope_mismatch');
  }

  if (outcome.version !== expectedVersion + 1) {
    throw new BroadcastOutcomeCommandInputError('broadcast_outcome_version_mismatch');
  }

  if (
    outcome.capabilityKind !== 'customer_broadcast_task' ||
    outcome.providerKind !== 'wecom_official_customer_broadcast' ||
    outcome.memberConfirmationRequired !== true ||
    outcome.automaticRetryAllowed !== false
  ) {
    throw new BroadcastOutcomeCommandInputError('broadcast_outcome_fixed_contract_mismatch');
  }

  if (outcome.finalizeState !== 'not_finalized') {
    throw new BroadcastOutcomeCommandInputError('broadcast_outcome_already_finalized');
  }

  requireExactIdentifier(outcome.id, 'outcome_id');
  requireTimestamp(outcome.createdAt, 'created_at');
  requireTimestamp(outcome.updatedAt, 'updated_at');
}

export function createBroadcastOutcomeCommandService(
  repository: BroadcastOutcomeCommandRepository,
) {
  return Object.freeze({
    async createNotStarted(
      command: CreateBroadcastOutcomeCommand,
    ): Promise<BroadcastOutcomeState | null> {
      const scope = normalizeScope(command.scope);

      return repository.createNotStarted({
        ...scope,
        id: requireExactIdentifier(command.id, 'outcome_id'),
        occurredAt: requireTimestamp(command.occurredAt, 'occurred_at'),
      });
    },

    async updateWhenVersionMatches(
      command: UpdateBroadcastOutcomeCommand,
    ): Promise<BroadcastOutcomeState | null> {
      const scope = normalizeScope(command.scope);
      const expectedVersion = requireExpectedVersion(command.expectedVersion);

      assertOutcomeMatchesCommand({
        scope,
        expectedVersion,
        outcome: command.outcome,
      });

      return repository.updateWhenVersionMatches({
        ...scope,
        expectedVersion,
        outcome: command.outcome,
      });
    },
  });
}
