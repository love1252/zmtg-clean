import { describe, expect, it } from 'vitest';
import {
  FOLLOW_UP_COMPLETION_CODES,
  FOLLOW_UP_MANUAL_FEEDBACK_MAX_LENGTH,
  FOLLOW_UP_TASK_STATES,
  cancelFollowUpTask,
  completeFollowUpTask,
  escalateFollowUpTask,
  isFollowUpTaskState,
  parseFollowUpCompletionResult,
  transitionFollowUpTask,
} from '@/modules/care/domain/follow-up-task';
import type { FollowUpTask, FollowUpTaskState } from '@/modules/care/domain/follow-up-task';

function pendingTask(overrides: Partial<FollowUpTask> = {}): FollowUpTask {
  return {
    taskId: 'followup-001',
    institutionId: 'institution-a',
    state: 'pending',
    revision: 0,
    riskLevel: 'none',
    riskEscalation: null,
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
      completionResult: { code: 'contact_completed', feedback: null },
    });
  }
  if (state === 'cancelled') {
    return pendingTask({ state, revision: 5, cancellationReason: 'duplicate_task' });
  }
  if (state === 'escalated') {
    return pendingTask({
      state,
      revision: 5,
      riskLevel: 'high',
      riskEscalation: {
        level: 'high',
        kind: 'clinical',
        riskEventId: 'risk-event-existing',
      },
    });
  }
  return pendingTask({ state, revision: 5 });
}

function transition(task: FollowUpTask, targetState: unknown) {
  return transitionFollowUpTask({
    task,
    institutionId: task.institutionId,
    expectedRevision: task.revision,
    targetState,
  });
}

function complete(task: FollowUpTask, result: unknown) {
  return completeFollowUpTask({
    task,
    institutionId: task.institutionId,
    expectedRevision: task.revision,
    result,
  });
}

function cancel(task: FollowUpTask, reason: unknown) {
  return cancelFollowUpTask({
    task,
    institutionId: task.institutionId,
    expectedRevision: task.revision,
    reason,
  });
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

    const started = transition(original, 'in_progress');

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
      transition(started.task, 'in_progress'),
    ).toEqual({ ok: true, changed: false, task: started.task });
    expect(
      transition(started.task, 'waiting_customer'),
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
      'in_progress->waiting_customer',
      'waiting_customer->in_progress',
    ]);

    for (const sourceState of FOLLOW_UP_TASK_STATES) {
      for (const targetState of ordinaryTargets) {
        const task = taskInState(sourceState);
        const result = transition(task, targetState);
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
        } else if (targetState === 'escalated') {
          expect(result, transitionKey).toEqual({
            ok: false,
            code: 'risk_escalation_required',
          });
        } else {
          expect(result, transitionKey).toEqual({ ok: false, code: 'invalid_transition' });
        }
      }
    }

    expect(
      transition(taskInState('in_progress'), 'completed'),
    ).toEqual({ ok: false, code: 'completion_result_required' });
    expect(
      transition(taskInState('pending'), 'cancelled'),
    ).toEqual({ ok: false, code: 'cancellation_reason_required' });
    expect(transition(pendingTask(), 'due_today')).toEqual({
      ok: false,
      code: 'invalid_target_state',
    });
    expect(
      transition(
        pendingTask({ state: 'overdue' as FollowUpTask['state'] }),
        'in_progress',
      ),
    ).toEqual({ ok: false, code: 'invalid_task' });
  });

  it('完成必须提交唯一受控 code 的结构化结果', () => {
    const task = pendingTask({ state: 'in_progress', revision: 3 });

    expect(complete(task, undefined)).toEqual({
      ok: false,
      code: 'completion_result_required',
    });
    expect(complete(task, 'contact_completed')).toEqual({
      ok: false,
      code: 'invalid_completion_result',
    });
    expect(
      complete(task, { code: 'contact_completed', freeText: 'not allowed' }),
    ).toEqual({ ok: false, code: 'invalid_completion_result' });

    const completed = complete(task, { code: 'contact_completed', feedback: null });
    expect(completed).toEqual({
      ok: true,
      changed: true,
      task: {
        ...task,
        state: 'completed',
        revision: 4,
        completionResult: { code: 'contact_completed', feedback: null },
      },
    });
    if (!completed.ok) throw new Error('expected completion success');

    expect(
      complete(completed.task, { code: 'contact_completed', feedback: null }),
    ).toEqual({ ok: true, changed: false, task: completed.task });
    expect(
      complete(completed.task, { code: 'customer_declined', feedback: null }),
    ).toEqual({ ok: false, code: 'terminal_conflict' });
    expect(
      complete(taskInState('waiting_customer'), { code: 'no_response_closed', feedback: null }),
    ).toMatchObject({
      ok: true,
      changed: true,
      task: {
        state: 'completed',
        revision: 6,
        completionResult: { code: 'no_response_closed', feedback: null },
      },
    });
    expect(
      complete(taskInState('pending'), { code: 'contact_completed', feedback: null }),
    ).toEqual({ ok: false, code: 'invalid_transition' });
    expect(
      complete(taskInState('cancelled'), { code: 'contact_completed', feedback: null }),
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
    const escalated = pendingTask({
      state: 'escalated',
      revision: 2,
      riskLevel: 'high',
      riskEscalation: {
        level: 'high',
        kind: 'clinical',
        riskEventId: 'risk-event-escalated',
      },
    });

    expect(
      complete(escalated, { code: 'contact_completed', feedback: null }),
    ).toEqual({ ok: false, code: 'escalated_completion_forbidden' });
    expect(
      transition(escalated, 'in_progress'),
    ).toEqual({ ok: false, code: 'invalid_transition' });
  });

  it('取消必须使用受控 reason，终态保持不可改写且同一命令幂等', () => {
    const task = pendingTask();

    expect(cancel(task, '')).toEqual({
      ok: false,
      code: 'cancellation_reason_required',
    });
    expect(cancel(task, 'free_text_reason')).toEqual({
      ok: false,
      code: 'invalid_cancellation_reason',
    });

    const cancelled = cancel(task, 'duplicate_task');
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

    expect(cancel(cancelled.task, 'duplicate_task')).toEqual({
      ok: true,
      changed: false,
      task: cancelled.task,
    });
    expect(cancel(cancelled.task, 'superseded')).toEqual({
      ok: false,
      code: 'terminal_conflict',
    });
    expect(
      transition(cancelled.task, 'in_progress'),
    ).toEqual({ ok: false, code: 'terminal_state' });

    for (const state of ['in_progress', 'waiting_customer'] as const) {
      expect(
        cancel(taskInState(state), 'source_invalidated'),
        state,
      ).toMatchObject({
        ok: true,
        changed: true,
        task: { state: 'cancelled', revision: 6, cancellationReason: 'source_invalidated' },
      });
    }
    expect(
      cancel(taskInState('escalated'), 'source_invalidated'),
    ).toEqual({ ok: false, code: 'invalid_transition' });
    expect(
      cancel(taskInState('completed'), 'source_invalidated'),
    ).toEqual({ ok: false, code: 'terminal_state' });
  });

  it('新完成命令拒绝旧 code-only 形状，历史快照只在读取时兼容', () => {
    const active = pendingTask({ state: 'in_progress' });
    const historical = pendingTask({
      state: 'completed',
      completionResult: { code: 'contact_completed' } as never,
    });

    expect(parseFollowUpCompletionResult({ code: 'contact_completed' })).toEqual({
      code: 'contact_completed',
      feedback: null,
    });
    expect(complete(active, { code: 'contact_completed' })).toEqual({
      ok: false,
      code: 'invalid_completion_result',
    });
    expect(complete(historical, { code: 'contact_completed' })).toEqual({
      ok: false,
      code: 'invalid_completion_result',
    });
    expect(complete(historical, { code: 'contact_completed', feedback: null })).toEqual({
      ok: true,
      changed: false,
      task: {
        ...historical,
        completionResult: { code: 'contact_completed', feedback: null },
      },
    });
  });

  it('低敏人工反馈拒绝控制字符、手机号、身份证和病历语句', () => {
    const task = pendingTask({ state: 'in_progress' });
    const invalidSummaries = [
      'a'.repeat(FOLLOW_UP_MANUAL_FEEDBACK_MAX_LENGTH + 1),
      '含\nC0 控制字符',
      `含${String.fromCharCode(0x85)}C1 控制字符`,
      '联系电话 13800138000',
      '联系电话 138 0013 8000',
      '身份证 11010519491231002X',
      '病历提示需继续联系',
    ];

    for (const summary of invalidSummaries) {
      expect(
        complete(task, {
          code: 'contact_completed',
          feedback: { kind: 'manual_low_sensitivity', summary },
        }),
        summary,
      ).toEqual({ ok: false, code: 'invalid_completion_result' });
    }
  });

  it('高风险活跃任务不能通过普通转换，已取消高风险快照也不得伪装幂等成功', () => {
    const activeHighRisk = pendingTask({ state: 'in_progress', riskLevel: 'high' });
    const cancelledHighRisk = pendingTask({
      state: 'cancelled',
      riskLevel: 'high',
      revision: 3,
      cancellationReason: 'duplicate_task',
    });

    expect(transition(activeHighRisk, 'in_progress')).toEqual({
      ok: false,
      code: 'high_risk_escalation_required',
    });
    expect(transition(activeHighRisk, 'waiting_customer')).toEqual({
      ok: false,
      code: 'high_risk_escalation_required',
    });
    expect(cancel(activeHighRisk, 'source_invalidated')).toEqual({
      ok: false,
      code: 'high_risk_escalation_required',
    });
    expect(cancel(cancelledHighRisk, 'duplicate_task')).toEqual({
      ok: false,
      code: 'high_risk_escalation_required',
    });
  });

  it('将任务与嵌套风险对象做稳定安全快照，拒绝 hostile Proxy 和未知字段', () => {
    const hostileTask = new Proxy(pendingTask(), {
      getOwnPropertyDescriptor: (_target, key) => {
        if (key === 'taskId') throw new Error('hostile task descriptor');
        return undefined;
      },
    });
    const nestedEscalation = new Proxy(
      { level: 'high', kind: 'clinical', riskEventId: 'risk-event-001' },
      {
        getOwnPropertyDescriptor: () => {
          throw new Error('hostile escalation descriptor');
        },
      },
    );
    const hostileNested = pendingTask({
      state: 'escalated',
      riskLevel: 'high',
      riskEscalation: nestedEscalation as never,
    });
    const withUnknownField = { ...pendingTask(), unexpected: true };

    expect(() => transition(hostileTask, 'in_progress')).not.toThrow();
    expect(transition(hostileTask, 'in_progress')).toEqual({ ok: false, code: 'invalid_task' });
    expect(() => complete(hostileNested, { code: 'contact_completed', feedback: null })).not.toThrow();
    expect(complete(hostileNested, { code: 'contact_completed', feedback: null })).toEqual({
      ok: false,
      code: 'invalid_task',
    });
    expect(transition(withUnknownField as FollowUpTask, 'in_progress')).toEqual({
      ok: false,
      code: 'invalid_task',
    });

    const result = transition(new Proxy(pendingTask(), {}), 'in_progress');
    expect(result).toMatchObject({ ok: true, changed: true });
    if (!result.ok) throw new Error('expected transition success');
    expect(Reflect.ownKeys(result.task).sort()).toEqual([
      'cancellationReason',
      'completionResult',
      'institutionId',
      'revision',
      'riskEscalation',
      'riskLevel',
      'state',
      'taskId',
    ]);
  });

  it('仅受控风险事件能升级，升级命令幂等且普通完成仍被阻断', () => {
    const task = pendingTask({ state: 'in_progress', revision: 4 });
    const escalation = {
      level: 'high',
      kind: 'clinical',
      riskEventId: 'risk-event-001',
    } as const;
    const escalated = escalateFollowUpTask({
      task,
      institutionId: task.institutionId,
      expectedRevision: task.revision,
      escalation,
    });

    expect(escalated).toMatchObject({
      ok: true,
      changed: true,
      task: { state: 'escalated', revision: 5, riskLevel: 'high', riskEscalation: escalation },
    });
    if (!escalated.ok) throw new Error('expected escalation');
    expect(complete(escalated.task, { code: 'contact_completed', feedback: null })).toEqual({
      ok: false,
      code: 'escalated_completion_forbidden',
    });
    expect(
      escalateFollowUpTask({
        task: escalated.task,
        institutionId: escalated.task.institutionId,
        expectedRevision: escalated.task.revision,
        escalation,
      }),
    ).toEqual({ ok: true, changed: false, task: escalated.task });
  });
});
