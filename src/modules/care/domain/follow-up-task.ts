import { checkFollowUpCommandPreconditions } from './follow-up-command-preconditions';

export const FOLLOW_UP_TASK_STATES = [
  'pending',
  'in_progress',
  'waiting_customer',
  'escalated',
  'completed',
  'cancelled',
] as const;

export type FollowUpTaskState = (typeof FOLLOW_UP_TASK_STATES)[number];

export const FOLLOW_UP_COMPLETION_CODES = [
  'contact_completed',
  'no_response_closed',
  'his_appointment_linked',
  'customer_declined',
  'invalid_or_duplicate',
] as const;

export type FollowUpCompletionCode = (typeof FOLLOW_UP_COMPLETION_CODES)[number];

export type FollowUpCompletionResult = Readonly<{
  code: FollowUpCompletionCode;
}>;

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
  | 'cancellation_reason_required'
  | 'invalid_cancellation_reason'
  | 'escalated_completion_forbidden';

export type FollowUpTaskCommandResult =
  | Readonly<{ ok: true; changed: boolean; task: FollowUpTask }>
  | Readonly<{ ok: false; code: FollowUpTaskCommandError }>;

const ORDINARY_TRANSITIONS: Readonly<Record<FollowUpTaskState, readonly FollowUpTaskState[]>> = {
  pending: ['in_progress', 'escalated'],
  in_progress: ['waiting_customer', 'escalated'],
  waiting_customer: ['in_progress', 'escalated'],
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

export function isFollowUpTaskState(value: unknown): value is FollowUpTaskState {
  return includesValue(FOLLOW_UP_TASK_STATES, value);
}

export function isFollowUpCompletionCode(value: unknown): value is FollowUpCompletionCode {
  return includesValue(FOLLOW_UP_COMPLETION_CODES, value);
}

export function isFollowUpCancellationReason(value: unknown): value is FollowUpCancellationReason {
  return includesValue(FOLLOW_UP_CANCELLATION_REASONS, value);
}

function readCompletionResult(value: unknown): FollowUpCompletionResult | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const entries = Object.entries(value);
  if (entries.length !== 1 || entries[0]?.[0] !== 'code') return null;

  const code = entries[0][1];
  return isFollowUpCompletionCode(code) ? { code } : null;
}

function isValidTask(task: FollowUpTask) {
  if (!isNonEmptyText(task.taskId) || !isNonEmptyText(task.institutionId)) return false;
  if (!isFollowUpTaskState(task.state)) return false;
  if (!Number.isSafeInteger(task.revision) || task.revision < 0) return false;

  if (task.state === 'completed') {
    return readCompletionResult(task.completionResult) !== null && task.cancellationReason === null;
  }

  if (task.state === 'cancelled') {
    return (
      task.completionResult === null && isFollowUpCancellationReason(task.cancellationReason)
    );
  }

  return task.completionResult === null && task.cancellationReason === null;
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

function withState(task: FollowUpTask, state: FollowUpTaskState): FollowUpTask | null {
  const revision = nextRevision(task);
  if (revision === null) return null;

  return {
    ...task,
    state,
    revision,
    completionResult: null,
    cancellationReason: null,
  };
}

export function transitionFollowUpTask(input: Readonly<{
  task: FollowUpTask;
  institutionId: unknown;
  expectedRevision: unknown;
  targetState: unknown;
}>): FollowUpTaskCommandResult {
  const { task, targetState } = input;
  if (!isValidTask(task)) return failure('invalid_task');
  const preconditionFailure = checkCommandPreconditions(input);
  if (preconditionFailure) return preconditionFailure;
  if (!isFollowUpTaskState(targetState)) return failure('invalid_target_state');

  if (task.state === 'escalated' && targetState === 'completed') {
    return failure('escalated_completion_forbidden');
  }
  if (targetState === 'completed') return failure('completion_result_required');
  if (targetState === 'cancelled') return failure('cancellation_reason_required');
  if (task.state === 'completed' || task.state === 'cancelled') return failure('terminal_state');
  if (task.state === targetState) return success(task, false);
  if (!ORDINARY_TRANSITIONS[task.state].includes(targetState)) {
    return failure('invalid_transition');
  }

  const nextTask = withState(task, targetState);
  return nextTask ? success(nextTask, true) : failure('invalid_command_context');
}

export function completeFollowUpTask(input: Readonly<{
  task: FollowUpTask;
  institutionId: unknown;
  expectedRevision: unknown;
  result: unknown;
}>): FollowUpTaskCommandResult {
  const { task } = input;
  if (!isValidTask(task)) return failure('invalid_task');
  const preconditionFailure = checkCommandPreconditions(input);
  if (preconditionFailure) return preconditionFailure;
  if (task.state === 'escalated') return failure('escalated_completion_forbidden');
  if (input.result === null || input.result === undefined) {
    return failure('completion_result_required');
  }

  const result = readCompletionResult(input.result);
  if (!result) return failure('invalid_completion_result');

  if (task.state === 'completed') {
    return task.completionResult?.code === result.code
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
    {
      ...task,
      state: 'completed',
      revision,
      completionResult: result,
      cancellationReason: null,
    },
    true,
  );
}

export function cancelFollowUpTask(input: Readonly<{
  task: FollowUpTask;
  institutionId: unknown;
  expectedRevision: unknown;
  reason: unknown;
}>): FollowUpTaskCommandResult {
  const { task, reason } = input;
  if (!isValidTask(task)) return failure('invalid_task');
  const preconditionFailure = checkCommandPreconditions(input);
  if (preconditionFailure) return preconditionFailure;
  if (reason === null || reason === undefined || reason === '') {
    return failure('cancellation_reason_required');
  }
  if (!isFollowUpCancellationReason(reason)) return failure('invalid_cancellation_reason');

  if (task.state === 'cancelled') {
    return task.cancellationReason === reason
      ? success(task, false)
      : failure('terminal_conflict');
  }
  if (task.state === 'completed') return failure('terminal_state');
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
    {
      ...task,
      state: 'cancelled',
      revision,
      completionResult: null,
      cancellationReason: reason,
    },
    true,
  );
}
