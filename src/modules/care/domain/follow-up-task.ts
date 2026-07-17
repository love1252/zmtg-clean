import { checkFollowUpCommandPreconditions } from './follow-up-command-preconditions';
import {
  FOLLOW_UP_COMPLETION_CODES,
  isFollowUpCompletionCode,
  parseFollowUpCompletionResult,
  parseFollowUpCompletionResultForWrite,
  type FollowUpCompletionCode,
  type FollowUpCompletionResult,
} from './follow-up-completion-result';
import {
  isFollowUpRiskLevel,
  parseFollowUpRiskEscalation,
  type FollowUpRiskEscalation,
  type FollowUpRiskLevel,
} from './follow-up-risk-escalation';

export {
  FOLLOW_UP_COMPLETION_CODES,
  FOLLOW_UP_MANUAL_FEEDBACK_KIND,
  FOLLOW_UP_MANUAL_FEEDBACK_MAX_LENGTH,
  isFollowUpCompletionCode,
  parseFollowUpCompletionResult,
  parseFollowUpCompletionResultForWrite,
} from './follow-up-completion-result';
export type {
  FollowUpCompletionCode,
  FollowUpCompletionResult,
  FollowUpManualFeedback,
} from './follow-up-completion-result';
export {
  FOLLOW_UP_RISK_ESCALATION_KINDS,
  FOLLOW_UP_RISK_LEVELS,
  isFollowUpRiskEscalationKind,
  isFollowUpRiskLevel,
  parseFollowUpRiskEscalation,
} from './follow-up-risk-escalation';
export type {
  FollowUpRiskEscalation,
  FollowUpRiskEscalationKind,
  FollowUpRiskLevel,
} from './follow-up-risk-escalation';

export const FOLLOW_UP_TASK_STATES = [
  'pending',
  'in_progress',
  'waiting_customer',
  'escalated',
  'completed',
  'cancelled',
] as const;

export type FollowUpTaskState = (typeof FOLLOW_UP_TASK_STATES)[number];

export const FOLLOW_UP_CANCELLATION_REASONS = [
  'created_in_error',
  'duplicate_task',
  'source_invalidated',
  'superseded',
  'customer_requested_stop',
] as const;

export type FollowUpCancellationReason = (typeof FOLLOW_UP_CANCELLATION_REASONS)[number];

export type FollowUpTask = Readonly<{
  taskId: string;
  institutionId: string;
  state: FollowUpTaskState;
  revision: number;
  riskLevel: FollowUpRiskLevel;
  riskEscalation: FollowUpRiskEscalation | null;
  completionResult: FollowUpCompletionResult | null;
  cancellationReason: FollowUpCancellationReason | null;
}>;

export type FollowUpTaskCommandError =
  | 'invalid_task'
  | 'invalid_command_context'
  | 'scope_mismatch'
  | 'revision_conflict'
  | 'invalid_target_state'
  | 'invalid_transition'
  | 'terminal_state'
  | 'terminal_conflict'
  | 'completion_result_required'
  | 'invalid_completion_result'
  | 'high_risk_escalation_required'
  | 'risk_escalation_required'
  | 'invalid_risk_escalation'
  | 'escalation_conflict'
  | 'cancellation_reason_required'
  | 'invalid_cancellation_reason'
  | 'escalated_completion_forbidden';

export type FollowUpTaskCommandResult =
  | Readonly<{ ok: true; changed: boolean; task: FollowUpTask }>
  | Readonly<{ ok: false; code: FollowUpTaskCommandError }>;

const ORDINARY_TRANSITIONS: Readonly<Record<FollowUpTaskState, readonly FollowUpTaskState[]>> = {
  pending: ['in_progress'],
  in_progress: ['waiting_customer'],
  waiting_customer: ['in_progress'],
  escalated: [],
  completed: [],
  cancelled: [],
};

function includesValue(values: readonly string[], value: unknown): value is string {
  return typeof value === 'string' && values.includes(value);
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function snapshotTaskRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  const requiredKeys = [
    'taskId',
    'institutionId',
    'state',
    'revision',
    'completionResult',
    'cancellationReason',
  ];
  const allowedKeys = new Set([...requiredKeys, 'riskLevel', 'riskEscalation']);

  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.some((key) => typeof key !== 'string' || !allowedKeys.has(key)) ||
      requiredKeys.some((key) => !Object.prototype.hasOwnProperty.call(descriptors, key))
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of ownKeys) {
      if (typeof key !== 'string') return null;
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

export function isFollowUpTaskState(value: unknown): value is FollowUpTaskState {
  return includesValue(FOLLOW_UP_TASK_STATES, value);
}

export function isFollowUpCancellationReason(value: unknown): value is FollowUpCancellationReason {
  return includesValue(FOLLOW_UP_CANCELLATION_REASONS, value);
}

function parseFollowUpTask(value: unknown): FollowUpTask | null {
  const snapshot = snapshotTaskRecord(value);
  if (!snapshot) return null;
  if (!isNonEmptyText(snapshot.taskId) || !isNonEmptyText(snapshot.institutionId)) return null;
  if (!isFollowUpTaskState(snapshot.state)) return null;
  if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) return null;

  const riskLevel = snapshot.riskLevel === undefined ? 'none' : snapshot.riskLevel;
  if (!isFollowUpRiskLevel(riskLevel)) return null;
  const riskEscalation =
    snapshot.riskEscalation === undefined || snapshot.riskEscalation === null
      ? null
      : parseFollowUpRiskEscalation(snapshot.riskEscalation);
  if (snapshot.riskEscalation !== undefined && snapshot.riskEscalation !== null && !riskEscalation) {
    return null;
  }

  const completionResult =
    snapshot.completionResult === null
      ? null
      : parseFollowUpCompletionResult(snapshot.completionResult);
  if (snapshot.completionResult !== null && !completionResult) return null;

  const cancellationReason = snapshot.cancellationReason;
  if (snapshot.state === 'completed') {
    if (
      riskLevel !== 'none' ||
      riskEscalation !== null ||
      completionResult === null ||
      cancellationReason !== null
    ) {
      return null;
    }
  } else if (snapshot.state === 'cancelled') {
    if (
      riskEscalation !== null ||
      completionResult !== null ||
      !isFollowUpCancellationReason(cancellationReason)
    ) {
      return null;
    }
  } else if (snapshot.state === 'escalated') {
    if (
      riskLevel !== 'high' ||
      riskEscalation === null ||
      completionResult !== null ||
      cancellationReason !== null
    ) {
      return null;
    }
  } else if (riskEscalation !== null || completionResult !== null || cancellationReason !== null) {
    return null;
  }

  return Object.freeze({
    taskId: snapshot.taskId,
    institutionId: snapshot.institutionId,
    state: snapshot.state,
    revision: snapshot.revision,
    riskLevel,
    riskEscalation,
    completionResult,
    cancellationReason: cancellationReason as FollowUpCancellationReason | null,
  });
}

function success(task: FollowUpTask, changed: boolean): FollowUpTaskCommandResult {
  return { ok: true, changed, task };
}

function failure(code: FollowUpTaskCommandError): FollowUpTaskCommandResult {
  return { ok: false, code };
}

function checkCommandPreconditions(input: Readonly<{
  task: FollowUpTask;
  institutionId: unknown;
  expectedRevision: unknown;
}>): FollowUpTaskCommandResult | null {
  const result = checkFollowUpCommandPreconditions({
    taskInstitutionId: input.task.institutionId,
    currentRevision: input.task.revision,
    institutionId: input.institutionId,
    expectedRevision: input.expectedRevision,
  });

  return result.ok ? null : failure(result.code);
}

function nextRevision(task: FollowUpTask): number | null {
  return task.revision < Number.MAX_SAFE_INTEGER ? task.revision + 1 : null;
}

function taskSnapshot(input: Readonly<{
  task: FollowUpTask;
  state: FollowUpTaskState;
  revision: number;
  riskLevel?: FollowUpRiskLevel;
  riskEscalation?: FollowUpRiskEscalation | null;
  completionResult?: FollowUpCompletionResult | null;
  cancellationReason?: FollowUpCancellationReason | null;
}>): FollowUpTask {
  return Object.freeze({
    taskId: input.task.taskId,
    institutionId: input.task.institutionId,
    state: input.state,
    revision: input.revision,
    riskLevel: input.riskLevel === undefined ? input.task.riskLevel : input.riskLevel,
    riskEscalation:
      input.riskEscalation === undefined ? input.task.riskEscalation : input.riskEscalation,
    completionResult:
      input.completionResult === undefined ? input.task.completionResult : input.completionResult,
    cancellationReason:
      input.cancellationReason === undefined
        ? input.task.cancellationReason
        : input.cancellationReason,
  });
}

function withState(task: FollowUpTask, state: FollowUpTaskState): FollowUpTask | null {
  const revision = nextRevision(task);
  if (revision === null) return null;

  return taskSnapshot({
    task,
    state,
    revision,
    riskEscalation: null,
    completionResult: null,
    cancellationReason: null,
  });
}

export function transitionFollowUpTask(input: Readonly<{
  task: FollowUpTask;
  institutionId: unknown;
  expectedRevision: unknown;
  targetState: unknown;
}>): FollowUpTaskCommandResult {
  const task = parseFollowUpTask(input.task);
  if (!task) return failure('invalid_task');
  const preconditionFailure = checkCommandPreconditions({
    task,
    institutionId: input.institutionId,
    expectedRevision: input.expectedRevision,
  });
  if (preconditionFailure) return preconditionFailure;
  if (!isFollowUpTaskState(input.targetState)) return failure('invalid_target_state');

  if (task.state === 'completed' || task.state === 'cancelled') return failure('terminal_state');
  if (task.state !== 'escalated' && task.riskLevel === 'high') {
    return failure('high_risk_escalation_required');
  }
  if (task.state === input.targetState) return success(task, false);
  if (input.targetState === 'escalated') return failure('risk_escalation_required');
  if (task.state === 'escalated' && input.targetState === 'completed') {
    return failure('escalated_completion_forbidden');
  }
  if (input.targetState === 'completed') return failure('completion_result_required');
  if (input.targetState === 'cancelled') return failure('cancellation_reason_required');
  if (!ORDINARY_TRANSITIONS[task.state].includes(input.targetState)) {
    return failure('invalid_transition');
  }

  const nextTask = withState(task, input.targetState);
  return nextTask ? success(nextTask, true) : failure('invalid_command_context');
}

export function completeFollowUpTask(input: Readonly<{
  task: FollowUpTask;
  institutionId: unknown;
  expectedRevision: unknown;
  result: unknown;
}>): FollowUpTaskCommandResult {
  const task = parseFollowUpTask(input.task);
  if (!task) return failure('invalid_task');
  const preconditionFailure = checkCommandPreconditions({
    task,
    institutionId: input.institutionId,
    expectedRevision: input.expectedRevision,
  });
  if (preconditionFailure) return preconditionFailure;
  if (task.state === 'escalated') return failure('escalated_completion_forbidden');
  if (task.riskLevel === 'high') return failure('high_risk_escalation_required');
  if (input.result === null || input.result === undefined) {
    return failure('completion_result_required');
  }

  const result = parseFollowUpCompletionResultForWrite(input.result);
  if (!result) return failure('invalid_completion_result');

  if (task.state === 'completed') {
    const currentResult = parseFollowUpCompletionResult(task.completionResult);
    return (
      currentResult !== null &&
      currentResult.code === result.code &&
      currentResult.feedback?.kind === result.feedback?.kind &&
      currentResult.feedback?.summary === result.feedback?.summary
    )
      ? success(task, false)
      : failure('terminal_conflict');
  }
  if (task.state === 'cancelled') return failure('terminal_state');
  if (task.state !== 'in_progress' && task.state !== 'waiting_customer') {
    return failure('invalid_transition');
  }

  const revision = nextRevision(task);
  if (revision === null) return failure('invalid_command_context');

  return success(
    taskSnapshot({
      task,
      state: 'completed',
      revision,
      riskEscalation: null,
      completionResult: result,
      cancellationReason: null,
    }),
    true,
  );
}

export function cancelFollowUpTask(input: Readonly<{
  task: FollowUpTask;
  institutionId: unknown;
  expectedRevision: unknown;
  reason: unknown;
}>): FollowUpTaskCommandResult {
  const task = parseFollowUpTask(input.task);
  const reason = input.reason;
  if (!task) return failure('invalid_task');
  const preconditionFailure = checkCommandPreconditions({
    task,
    institutionId: input.institutionId,
    expectedRevision: input.expectedRevision,
  });
  if (preconditionFailure) return preconditionFailure;
  if (reason === null || reason === undefined || reason === '') {
    return failure('cancellation_reason_required');
  }
  if (!isFollowUpCancellationReason(reason)) return failure('invalid_cancellation_reason');

  if (task.state === 'completed') return failure('terminal_state');
  if (task.state === 'escalated') return failure('invalid_transition');
  if (task.riskLevel === 'high') return failure('high_risk_escalation_required');
  if (task.state === 'cancelled') {
    return task.cancellationReason === reason
      ? success(task, false)
      : failure('terminal_conflict');
  }
  if (
    task.state !== 'pending' &&
    task.state !== 'in_progress' &&
    task.state !== 'waiting_customer'
  ) {
    return failure('invalid_transition');
  }

  const revision = nextRevision(task);
  if (revision === null) return failure('invalid_command_context');

  return success(
    taskSnapshot({
      task,
      state: 'cancelled',
      revision,
      riskEscalation: null,
      completionResult: null,
      cancellationReason: reason,
    }),
    true,
  );
}

function sameEscalation(
  left: FollowUpRiskEscalation,
  right: FollowUpRiskEscalation,
): boolean {
  return (
    left.level === right.level &&
    left.kind === right.kind &&
    left.riskEventId === right.riskEventId
  );
}

/**
 * Escalation records a controlled high-risk event only. It does not close the event, send a
 * message, contact an external system, or restore an escalated task.
 */
export function escalateFollowUpTask(input: Readonly<{
  task: FollowUpTask;
  institutionId: unknown;
  expectedRevision: unknown;
  escalation: unknown;
}>): FollowUpTaskCommandResult {
  const task = parseFollowUpTask(input.task);
  if (!task) return failure('invalid_task');
  const preconditionFailure = checkCommandPreconditions({
    task,
    institutionId: input.institutionId,
    expectedRevision: input.expectedRevision,
  });
  if (preconditionFailure) return preconditionFailure;

  const escalation = parseFollowUpRiskEscalation(input.escalation);
  if (!escalation) return failure('invalid_risk_escalation');

  if (task.state === 'escalated') {
    const existingEscalation = task.riskEscalation ?? null;
    return existingEscalation !== null && sameEscalation(existingEscalation, escalation)
      ? success(task, false)
      : failure('escalation_conflict');
  }
  if (task.state === 'completed' || task.state === 'cancelled') {
    return failure('terminal_state');
  }

  const revision = nextRevision(task);
  if (revision === null) return failure('invalid_command_context');

  return success(
    taskSnapshot({
      task,
      state: 'escalated',
      revision,
      riskLevel: 'high',
      riskEscalation: escalation,
      completionResult: null,
      cancellationReason: null,
    }),
    true,
  );
}
