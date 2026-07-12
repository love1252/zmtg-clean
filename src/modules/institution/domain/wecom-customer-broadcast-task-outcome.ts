export const weComCustomerBroadcastTaskDispatchStates = [
  'not_started',
  'task_create_attempted',
  'task_created',
  'task_create_failed',
  'task_create_unknown',
] as const;

export const weComCustomerBroadcastTaskSendResultStatuses = [
  'not_checked',
  'awaiting_member_confirmation',
  'target_sent',
  'target_failed',
  'target_unknown',
] as const;

export const weComCustomerBroadcastTaskFinalizeStates = [
  'not_finalized',
  'success_recorded',
  'failure_recorded',
  'unknown_recorded',
] as const;

export const weComCustomerBroadcastTaskReconciliationStates = [
  'none',
  'manual_review_required',
  'reconciled',
] as const;

export type WeComCustomerBroadcastTaskDispatchState =
  (typeof weComCustomerBroadcastTaskDispatchStates)[number];
export type WeComCustomerBroadcastTaskSendResultStatus =
  (typeof weComCustomerBroadcastTaskSendResultStatuses)[number];
export type WeComCustomerBroadcastTaskFinalizeState =
  (typeof weComCustomerBroadcastTaskFinalizeStates)[number];
export type WeComCustomerBroadcastTaskReconciliationState =
  (typeof weComCustomerBroadcastTaskReconciliationStates)[number];
export type WeComCustomerBroadcastTaskProviderResultCategory =
  | 'accepted'
  | 'rejected'
  | 'timeout'
  | 'transport_error'
  | 'indeterminate';

export type WeComCustomerBroadcastTaskProviderAttempt = Readonly<{
  id: string;
  operationId: string;
  operationRef: string;
  tenantId: string;
  institutionId: string;
  customerId: string;
  capabilityKind: 'customer_broadcast_task';
  providerKind: 'wecom_official_customer_broadcast';
  dispatchState: WeComCustomerBroadcastTaskDispatchState;
  dispatchCount: 0 | 1;
  dispatchStartedAt: string | null;
  dispatchTerminalAt: string | null;
  taskRefDigest: string | null;
  memberConfirmationRequired: true;
  providerResultCategory: WeComCustomerBroadcastTaskProviderResultCategory | null;
  sendResultStatus: WeComCustomerBroadcastTaskSendResultStatus;
  sendResultCheckedAt: string | null;
  finalizeState: WeComCustomerBroadcastTaskFinalizeState;
  reconciliationState: WeComCustomerBroadcastTaskReconciliationState;
  manualReviewRequired: boolean;
  automaticRetryAllowed: false;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type WeComCustomerBroadcastTaskOutcomeFailureReason =
  | 'invalid_transition'
  | 'invalid_time'
  | 'invalid_task_ref_digest';

export type WeComCustomerBroadcastTaskOutcomeTransition =
  | Readonly<{
      kind: 'transitioned';
      outcome: WeComCustomerBroadcastTaskProviderAttempt;
      targetSentCandidate: boolean;
      completedCountDelta: 0;
      automaticRetryAllowed: false;
    }>
  | Readonly<{
      kind: 'blocked';
      reason: WeComCustomerBroadcastTaskOutcomeFailureReason;
    }>;

type TransitionOptions = Readonly<{
  targetSentCandidate?: boolean;
}>;

function isValidOccurredAt(occurredAt: string) {
  return Number.isFinite(Date.parse(occurredAt));
}

function transition(
  current: WeComCustomerBroadcastTaskProviderAttempt,
  occurredAt: string,
  changes: Partial<WeComCustomerBroadcastTaskProviderAttempt>,
  options: TransitionOptions = {},
): WeComCustomerBroadcastTaskOutcomeTransition {
  if (
    !isValidOccurredAt(occurredAt) ||
    !isValidOccurredAt(current.updatedAt) ||
    Date.parse(occurredAt) < Date.parse(current.updatedAt)
  ) {
    return { kind: 'blocked', reason: 'invalid_time' };
  }
  return {
    kind: 'transitioned',
    outcome: {
      ...current,
      ...changes,
      version: current.version + 1,
      updatedAt: occurredAt,
    },
    targetSentCandidate: options.targetSentCandidate === true,
    completedCountDelta: 0,
    automaticRetryAllowed: false,
  };
}

function invalidTransition(): WeComCustomerBroadcastTaskOutcomeTransition {
  return { kind: 'blocked', reason: 'invalid_transition' };
}

export function recordTaskCreateAttempted(
  current: WeComCustomerBroadcastTaskProviderAttempt,
  occurredAt: string,
): WeComCustomerBroadcastTaskOutcomeTransition {
  if (current.dispatchState !== 'not_started' || current.dispatchCount !== 0) {
    return invalidTransition();
  }
  return transition(current, occurredAt, {
    dispatchState: 'task_create_attempted',
    dispatchCount: 1,
    dispatchStartedAt: occurredAt,
  });
}

export function recordTaskCreated(
  current: WeComCustomerBroadcastTaskProviderAttempt,
  input: Readonly<{ occurredAt: string; taskRefDigest: string }>,
): WeComCustomerBroadcastTaskOutcomeTransition {
  if (current.dispatchState !== 'task_create_attempted' || current.dispatchCount !== 1) {
    return invalidTransition();
  }
  if (!/^[0-9a-f]{64}$/u.test(input.taskRefDigest)) {
    return { kind: 'blocked', reason: 'invalid_task_ref_digest' };
  }
  return transition(current, input.occurredAt, {
    dispatchState: 'task_created',
    dispatchTerminalAt: input.occurredAt,
    taskRefDigest: input.taskRefDigest,
    providerResultCategory: 'accepted',
  });
}

export function recordTaskCreateFailed(
  current: WeComCustomerBroadcastTaskProviderAttempt,
  occurredAt: string,
): WeComCustomerBroadcastTaskOutcomeTransition {
  if (current.dispatchState !== 'task_create_attempted' || current.dispatchCount !== 1) {
    return invalidTransition();
  }
  return transition(current, occurredAt, {
    dispatchState: 'task_create_failed',
    dispatchTerminalAt: occurredAt,
    providerResultCategory: 'rejected',
  });
}

export function recordTaskCreateUnknown(
  current: WeComCustomerBroadcastTaskProviderAttempt,
  input: Readonly<{
    occurredAt: string;
    providerResultCategory: 'timeout' | 'transport_error' | 'indeterminate';
  }>,
): WeComCustomerBroadcastTaskOutcomeTransition {
  if (current.dispatchState !== 'task_create_attempted' || current.dispatchCount !== 1) {
    return invalidTransition();
  }
  return transition(current, input.occurredAt, {
    dispatchState: 'task_create_unknown',
    dispatchTerminalAt: input.occurredAt,
    providerResultCategory: input.providerResultCategory,
    reconciliationState: 'manual_review_required',
    manualReviewRequired: true,
  });
}

export function recordAwaitingMemberConfirmation(
  current: WeComCustomerBroadcastTaskProviderAttempt,
  occurredAt: string,
): WeComCustomerBroadcastTaskOutcomeTransition {
  if (
    current.dispatchState !== 'task_created' ||
    current.sendResultStatus !== 'not_checked'
  ) {
    return invalidTransition();
  }
  return transition(current, occurredAt, {
    sendResultStatus: 'awaiting_member_confirmation',
  });
}

export function recordTargetSentCandidate(
  current: WeComCustomerBroadcastTaskProviderAttempt,
  occurredAt: string,
): WeComCustomerBroadcastTaskOutcomeTransition {
  if (
    current.dispatchState !== 'task_created' ||
    current.sendResultStatus !== 'awaiting_member_confirmation'
  ) {
    return invalidTransition();
  }
  return transition(
    current,
    occurredAt,
    {
      sendResultStatus: 'target_sent',
      sendResultCheckedAt: occurredAt,
    },
    { targetSentCandidate: true },
  );
}

export function recordTargetFailed(
  current: WeComCustomerBroadcastTaskProviderAttempt,
  occurredAt: string,
): WeComCustomerBroadcastTaskOutcomeTransition {
  if (
    current.dispatchState !== 'task_created' ||
    current.sendResultStatus !== 'awaiting_member_confirmation'
  ) {
    return invalidTransition();
  }
  return transition(current, occurredAt, {
    sendResultStatus: 'target_failed',
    sendResultCheckedAt: occurredAt,
  });
}

export function recordTargetUnknown(
  current: WeComCustomerBroadcastTaskProviderAttempt,
  occurredAt: string,
): WeComCustomerBroadcastTaskOutcomeTransition {
  if (
    current.dispatchState !== 'task_created' ||
    current.sendResultStatus !== 'awaiting_member_confirmation'
  ) {
    return invalidTransition();
  }
  return transition(current, occurredAt, {
    sendResultStatus: 'target_unknown',
    sendResultCheckedAt: occurredAt,
    reconciliationState: 'manual_review_required',
    manualReviewRequired: true,
  });
}

export function markManualReviewRequired(
  current: WeComCustomerBroadcastTaskProviderAttempt,
  occurredAt: string,
): WeComCustomerBroadcastTaskOutcomeTransition {
  if (current.reconciliationState === 'reconciled') return invalidTransition();
  return transition(current, occurredAt, {
    reconciliationState: 'manual_review_required',
    manualReviewRequired: true,
  });
}
