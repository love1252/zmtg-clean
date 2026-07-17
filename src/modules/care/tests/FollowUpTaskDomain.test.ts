import { describe, expect, it } from 'vitest';
import {
  FOLLOW_UP_COMPLETION_CODES,
  FOLLOW_UP_TASK_STATES,
  cancelFollowUpTask,
  completeFollowUpTask,
  isFollowUpTaskState,
  transitionFollowUpTask,
} from '@/modules/care/domain/follow-up-task';
import type { FollowUpTask, FollowUpTaskState } from '@/modules/care/domain/follow-up-task';

function pendingTask(overrides: Partial<FollowUpTask> = {}): FollowUpTask {
  return {
    taskId: 'followup-001',
    institutionId: 'institution-a',
    state: 'pending',
    revision: 0,
    completionResult: null,
    cancellationReason: null,
    ...overrides,
  };
}

function taskInState(state: FollowUpTaskState): FollowUpTask {
  if (state === 'completed') {
    return pendingTask({
      state,
      revision: 5,
      completionResult: { code: 'contact_completed' },
    });
  }
  if (state === 'cancelled') {
    return pendingTask({ state, revision: 5, cancellationReason: 'duplicate_task' });
  }
  return pendingTask({ state, revision: 5 });
}

describe('随访任务纯领域契约', () => {
  it('只允许六个持久化主状态，不把到期桶持久化为状态', () => {
    expect(FOLLOW_UP_TASK_STATES).toEqual([
      'pending',
      'in_progress',
      'waiting_customer',
      'escalated',
      'completed',
      'cancelled',
    ]);
    expect(isFollowUpTaskState('due_today')).toBe(false);
    expect(isFollowUpTaskState('overdue')).toBe(false);
  });

  it('执行合法普通转换且不修改输入，重复目标转换保持幂等', () => {
    const original = pendingTask();
    const before = structuredClone(original);

    const started = transitionFollowUpTask({ task: original, targetState: 'in_progress' });

    expect(original).toEqual(before);
    expect(started).toEqual({
      ok: true,
      changed: true,
      task: {
        ...original,
        state: 'in_progress',
        revision: 1,
      },
    });
    if (!started.ok) throw new Error('expected transition success');

    expect(
      transitionFollowUpTask({ task: started.task, targetState: 'in_progress' }),
    ).toEqual({ ok: true, changed: false, task: started.task });
    expect(
      transitionFollowUpTask({ task: started.task, targetState: 'waiting_customer' }),
    ).toMatchObject({ ok: true, changed: true, task: { state: 'waiting_customer', revision: 2 } });
  });

  it('对非法转换和未知状态 fail-closed', () => {
    const ordinaryTargets = [
      'pending',
      'in_progress',
      'waiting_customer',
      'escalated',
    ] as const;
    const legalTransitions = new Set([
      'pending->in_progress',
      'pending->escalated',
      'in_progress->waiting_customer',
      'in_progress->escalated',
      'waiting_customer->in_progress',
      'waiting_customer->escalated',
    ]);

    for (const sourceState of FOLLOW_UP_TASK_STATES) {
      for (const targetState of ordinaryTargets) {
        const task = taskInState(sourceState);
        const result = transitionFollowUpTask({ task, targetState });
        const transitionKey = `${sourceState}->${targetState}`;

        if (sourceState === 'completed' || sourceState === 'cancelled') {
          expect(result, transitionKey).toEqual({ ok: false, code: 'terminal_state' });
        } else if (sourceState === targetState) {
          expect(result, transitionKey).toEqual({ ok: true, changed: false, task });
        } else if (legalTransitions.has(transitionKey)) {
          expect(result, transitionKey).toMatchObject({
            ok: true,
            changed: true,
            task: { state: targetState, revision: 6 },
          });
        } else {
          expect(result, transitionKey).toEqual({ ok: false, code: 'invalid_transition' });
        }
      }
    }

    expect(
      transitionFollowUpTask({ task: taskInState('in_progress'), targetState: 'completed' }),
    ).toEqual({ ok: false, code: 'completion_result_required' });
    expect(
      transitionFollowUpTask({ task: taskInState('pending'), targetState: 'cancelled' }),
    ).toEqual({ ok: false, code: 'cancellation_reason_required' });
    expect(transitionFollowUpTask({ task: pendingTask(), targetState: 'due_today' })).toEqual({
      ok: false,
      code: 'invalid_target_state',
    });
    expect(
      transitionFollowUpTask({
        task: pendingTask({ state: 'overdue' as FollowUpTask['state'] }),
        targetState: 'in_progress',
      }),
    ).toEqual({ ok: false, code: 'invalid_task' });
  });

  it('完成必须提交唯一受控 code 的结构化结果', () => {
    const task = pendingTask({ state: 'in_progress', revision: 3 });

    expect(completeFollowUpTask({ task, result: undefined })).toEqual({
      ok: false,
      code: 'completion_result_required',
    });
    expect(completeFollowUpTask({ task, result: 'contact_completed' })).toEqual({
      ok: false,
      code: 'invalid_completion_result',
    });
    expect(
      completeFollowUpTask({
        task,
        result: { code: 'contact_completed', freeText: 'not allowed' },
      }),
    ).toEqual({ ok: false, code: 'invalid_completion_result' });

    const completed = completeFollowUpTask({ task, result: { code: 'contact_completed' } });
    expect(completed).toEqual({
      ok: true,
      changed: true,
      task: {
        ...task,
        state: 'completed',
        revision: 4,
        completionResult: { code: 'contact_completed' },
      },
    });
    if (!completed.ok) throw new Error('expected completion success');

    expect(
      completeFollowUpTask({ task: completed.task, result: { code: 'contact_completed' } }),
    ).toEqual({ ok: true, changed: false, task: completed.task });
    expect(
      completeFollowUpTask({ task: completed.task, result: { code: 'customer_declined' } }),
    ).toEqual({ ok: false, code: 'terminal_conflict' });
    expect(
      completeFollowUpTask({
        task: taskInState('waiting_customer'),
        result: { code: 'no_response_closed' },
      }),
    ).toMatchObject({
      ok: true,
      changed: true,
      task: { state: 'completed', revision: 6, completionResult: { code: 'no_response_closed' } },
    });
    expect(
      completeFollowUpTask({ task: taskInState('pending'), result: { code: 'contact_completed' } }),
    ).toEqual({ ok: false, code: 'invalid_transition' });
    expect(
      completeFollowUpTask({
        task: taskInState('cancelled'),
        result: { code: 'contact_completed' },
      }),
    ).toEqual({ ok: false, code: 'terminal_state' });
    expect(FOLLOW_UP_COMPLETION_CODES).toEqual([
      'contact_completed',
      'no_response_closed',
      'his_appointment_linked',
      'customer_declined',
      'invalid_or_duplicate',
    ]);
  });

  it('禁止 escalated 普通完成或绕过受控风险关闭恢复', () => {
    const escalated = pendingTask({ state: 'escalated', revision: 2 });

    expect(
      completeFollowUpTask({ task: escalated, result: { code: 'contact_completed' } }),
    ).toEqual({ ok: false, code: 'escalated_completion_forbidden' });
    expect(
      transitionFollowUpTask({ task: escalated, targetState: 'in_progress' }),
    ).toEqual({ ok: false, code: 'invalid_transition' });
  });

  it('取消必须使用受控 reason，终态保持不可改写且同一命令幂等', () => {
    const task = pendingTask();

    expect(cancelFollowUpTask({ task, reason: '' })).toEqual({
      ok: false,
      code: 'cancellation_reason_required',
    });
    expect(cancelFollowUpTask({ task, reason: 'free_text_reason' })).toEqual({
      ok: false,
      code: 'invalid_cancellation_reason',
    });

    const cancelled = cancelFollowUpTask({ task, reason: 'duplicate_task' });
    expect(cancelled).toEqual({
      ok: true,
      changed: true,
      task: {
        ...task,
        state: 'cancelled',
        revision: 1,
        cancellationReason: 'duplicate_task',
      },
    });
    if (!cancelled.ok) throw new Error('expected cancellation success');

    expect(cancelFollowUpTask({ task: cancelled.task, reason: 'duplicate_task' })).toEqual({
      ok: true,
      changed: false,
      task: cancelled.task,
    });
    expect(cancelFollowUpTask({ task: cancelled.task, reason: 'superseded' })).toEqual({
      ok: false,
      code: 'terminal_conflict',
    });
    expect(
      transitionFollowUpTask({ task: cancelled.task, targetState: 'in_progress' }),
    ).toEqual({ ok: false, code: 'terminal_state' });

    for (const state of ['in_progress', 'waiting_customer'] as const) {
      expect(
        cancelFollowUpTask({ task: taskInState(state), reason: 'source_invalidated' }),
        state,
      ).toMatchObject({
        ok: true,
        changed: true,
        task: { state: 'cancelled', revision: 6, cancellationReason: 'source_invalidated' },
      });
    }
    expect(
      cancelFollowUpTask({ task: taskInState('escalated'), reason: 'source_invalidated' }),
    ).toEqual({ ok: false, code: 'invalid_transition' });
    expect(
      cancelFollowUpTask({ task: taskInState('completed'), reason: 'source_invalidated' }),
    ).toEqual({ ok: false, code: 'terminal_state' });
  });
});
