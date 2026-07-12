import {
  markManualReviewRequired,
  recordAwaitingMemberConfirmation,
  recordTargetFailed,
  recordTargetSentCandidate,
  recordTargetUnknown,
  recordTaskCreateAttempted,
  recordTaskCreateFailed,
  recordTaskCreated,
  recordTaskCreateUnknown,
  type WeComCustomerBroadcastTaskOutcomeFailureReason,
  type WeComCustomerBroadcastTaskOutcomeTransition,
  type WeComCustomerBroadcastTaskProviderAttempt,
} from '@/modules/institution/domain/wecom-customer-broadcast-task-outcome';
import type {
  CreateWeComCustomerBroadcastTaskProviderAttemptInput,
  WeComCustomerBroadcastTaskOutcomeRepository,
  WeComCustomerBroadcastTaskOutcomeScope,
} from '@/modules/institution/server/wecom-customer-broadcast-task-outcome-repository';

export type WeComCustomerBroadcastTaskOutcomePersistenceResult =
  | Readonly<{
      kind: 'recorded';
      outcome: WeComCustomerBroadcastTaskProviderAttempt;
      targetSentCandidate: boolean;
      completedCountDelta: 0;
      automaticRetryAllowed: false;
    }>
  | Readonly<{
      kind: 'blocked';
      reason:
        | WeComCustomerBroadcastTaskOutcomeFailureReason
        | 'outcome_missing';
    }>
  | Readonly<{
      kind: 'manual_review_required';
      reason: 'persistence_unknown';
      completedCountDelta: 0;
      automaticRetryAllowed: false;
    }>;

export type WeComCustomerBroadcastTaskOutcomeAction =
  | Readonly<{ action: 'record_task_create_attempted'; occurredAt: string }>
  | Readonly<{
      action: 'record_task_created';
      occurredAt: string;
      taskRefDigest: string;
    }>
  | Readonly<{ action: 'record_task_create_failed'; occurredAt: string }>
  | Readonly<{
      action: 'record_task_create_unknown';
      occurredAt: string;
      providerResultCategory: 'timeout' | 'transport_error' | 'indeterminate';
    }>
  | Readonly<{
      action: 'record_awaiting_member_confirmation';
      occurredAt: string;
    }>
  | Readonly<{ action: 'record_target_sent_candidate'; occurredAt: string }>
  | Readonly<{ action: 'record_target_failed'; occurredAt: string }>
  | Readonly<{ action: 'record_target_unknown'; occurredAt: string }>
  | Readonly<{ action: 'mark_manual_review_required'; occurredAt: string }>;

export function applyWeComCustomerBroadcastTaskOutcomeAction(
  current: WeComCustomerBroadcastTaskProviderAttempt,
  action: WeComCustomerBroadcastTaskOutcomeAction,
): WeComCustomerBroadcastTaskOutcomeTransition {
  switch (action.action) {
    case 'record_task_create_attempted':
      return recordTaskCreateAttempted(current, action.occurredAt);
    case 'record_task_created':
      return recordTaskCreated(current, action);
    case 'record_task_create_failed':
      return recordTaskCreateFailed(current, action.occurredAt);
    case 'record_task_create_unknown':
      return recordTaskCreateUnknown(current, action);
    case 'record_awaiting_member_confirmation':
      return recordAwaitingMemberConfirmation(current, action.occurredAt);
    case 'record_target_sent_candidate':
      return recordTargetSentCandidate(current, action.occurredAt);
    case 'record_target_failed':
      return recordTargetFailed(current, action.occurredAt);
    case 'record_target_unknown':
      return recordTargetUnknown(current, action.occurredAt);
    case 'mark_manual_review_required':
      return markManualReviewRequired(current, action.occurredAt);
    default:
      return { kind: 'blocked', reason: 'invalid_transition' };
  }
}

export async function createWeComCustomerBroadcastTaskOutcomeSidecar(input: {
  repository: WeComCustomerBroadcastTaskOutcomeRepository;
  attempt: CreateWeComCustomerBroadcastTaskProviderAttemptInput;
}): Promise<
  | Readonly<{
      kind: 'created' | 'existing';
      outcome: WeComCustomerBroadcastTaskProviderAttempt;
    }>
  | Readonly<{
      kind: 'manual_review_required';
      reason: 'persistence_unknown';
      automaticRetryAllowed: false;
    }>
> {
  try {
    const existing = await input.repository.findByScope(input.attempt);
    if (existing) return { kind: 'existing', outcome: existing };
    const created = await input.repository.createNotStarted(input.attempt);
    if (created) return { kind: 'created', outcome: created };
    return {
      kind: 'manual_review_required',
      reason: 'persistence_unknown',
      automaticRetryAllowed: false,
    };
  } catch {
    return {
      kind: 'manual_review_required',
      reason: 'persistence_unknown',
      automaticRetryAllowed: false,
    };
  }
}

/**
 * 只持久化 sidecar CAS。即使 transition 产生 target_sent 候选，本服务也不
 * 调用 proof finalizer 或 completedCount 写链路。
 */
export async function persistWeComCustomerBroadcastTaskOutcomeAction(input: {
  repository: WeComCustomerBroadcastTaskOutcomeRepository;
  scope: WeComCustomerBroadcastTaskOutcomeScope;
  action: WeComCustomerBroadcastTaskOutcomeAction;
}): Promise<WeComCustomerBroadcastTaskOutcomePersistenceResult> {
  let current: WeComCustomerBroadcastTaskProviderAttempt | null;
  try {
    current = await input.repository.findByScope(input.scope);
  } catch {
    return {
      kind: 'manual_review_required',
      reason: 'persistence_unknown',
      completedCountDelta: 0,
      automaticRetryAllowed: false,
    };
  }
  if (!current) return { kind: 'blocked', reason: 'outcome_missing' };

  const transition = applyWeComCustomerBroadcastTaskOutcomeAction(
    current,
    input.action,
  );
  if (transition.kind === 'blocked') return transition;

  try {
    const persisted = await input.repository.updateWhenVersionMatches({
      ...input.scope,
      expectedVersion: current.version,
      outcome: transition.outcome,
    });
    if (!persisted) {
      return {
        kind: 'manual_review_required',
        reason: 'persistence_unknown',
        completedCountDelta: 0,
        automaticRetryAllowed: false,
      };
    }
    return {
      kind: 'recorded',
      outcome: persisted,
      targetSentCandidate: transition.targetSentCandidate,
      completedCountDelta: 0,
      automaticRetryAllowed: false,
    };
  } catch {
    return {
      kind: 'manual_review_required',
      reason: 'persistence_unknown',
      completedCountDelta: 0,
      automaticRetryAllowed: false,
    };
  }
}
