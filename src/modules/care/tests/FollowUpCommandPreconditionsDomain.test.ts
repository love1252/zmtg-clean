import { describe, expect, it } from 'vitest';

import {
  FOLLOW_UP_COMMAND_PRECONDITION_ERROR_CODES,
  checkFollowUpCommandPreconditions,
} from '@/modules/care/domain/follow-up-command-preconditions';
import {
  cancelFollowUpTask,
  completeFollowUpTask,
  transitionFollowUpTask,
} from '@/modules/care/domain/follow-up-task';
import type { FollowUpTask } from '@/modules/care/domain/follow-up-task';

function task(overrides: Partial<FollowUpTask> = {}): FollowUpTask {
  return {
    taskId: 'followup-001',
    institutionId: 'institution-a',
    state: 'pending',
    revision: 2,
    riskLevel: 'none',
    riskEscalation: null,
    completionResult: null,
    cancellationReason: null,
    ...overrides,
  };
}

describe('随访任务命令前置守卫', () => {
  it('固定三种失败码并返回已验证的当前 revision', () => {
    expect(FOLLOW_UP_COMMAND_PRECONDITION_ERROR_CODES).toEqual([
      'invalid_command_context',
      'scope_mismatch',
      'revision_conflict',
    ]);
    const input = Object.freeze({
      taskInstitutionId: 'institution-a',
      currentRevision: 4,
      institutionId: 'institution-a',
      expectedRevision: 4,
    });
    const before = structuredClone(input);
    const first = checkFollowUpCommandPreconditions(input);
    expect(first).toEqual({ ok: true, currentRevision: 4 });
    expect(checkFollowUpCommandPreconditions(input)).toEqual(first);
    expect(input).toEqual(before);
  });

  it('对缺失、空白或非法类型的命令上下文 fail-closed', () => {
    const valid = {
      taskInstitutionId: 'institution-a',
      currentRevision: 4,
      institutionId: 'institution-a',
      expectedRevision: 4,
    };
    const invalidContexts = [
      { taskInstitutionId: null },
      { taskInstitutionId: ' ' },
      { currentRevision: -1 },
      { currentRevision: 1.5 },
      { currentRevision: Number.MAX_SAFE_INTEGER + 1 },
      { institutionId: null },
      { institutionId: '' },
      { institutionId: ' ' },
      { expectedRevision: null },
      { expectedRevision: '4' },
      { expectedRevision: -1 },
      { expectedRevision: 1.5 },
      { expectedRevision: Number.NaN },
      { expectedRevision: Number.POSITIVE_INFINITY },
      { expectedRevision: Number.MAX_SAFE_INTEGER + 1 },
    ];

    for (const overrides of invalidContexts) {
      expect(
        checkFollowUpCommandPreconditions({ ...valid, ...overrides }),
        JSON.stringify(overrides),
      ).toEqual({ ok: false, code: 'invalid_command_context' });
    }
  });

  it('区分机构不匹配与 stale/future revision，失败结果不返回 task', () => {
    const scopeMismatch = checkFollowUpCommandPreconditions({
      taskInstitutionId: 'institution-a',
      currentRevision: 4,
      institutionId: 'institution-b',
      expectedRevision: 4,
    });
    expect(scopeMismatch).toEqual({ ok: false, code: 'scope_mismatch' });
    expect('task' in scopeMismatch).toBe(false);

    for (const expectedRevision of [3, 5]) {
      const conflict = checkFollowUpCommandPreconditions({
        taskInstitutionId: 'institution-a',
        currentRevision: 4,
        institutionId: 'institution-a',
        expectedRevision,
      });
      expect(conflict, String(expectedRevision)).toEqual({
        ok: false,
        code: 'revision_conflict',
      });
      expect('task' in conflict).toBe(false);
    }
  });

  it('按任务合法、上下文、机构、revision、既有业务规则的顺序拒绝', () => {
    expect(
      transitionFollowUpTask({
        task: task({ revision: -1 }),
        institutionId: null,
        expectedRevision: null,
        targetState: 'unknown',
      }),
    ).toEqual({ ok: false, code: 'invalid_task' });
    expect(
      transitionFollowUpTask({
        task: task(),
        institutionId: 'institution-b',
        expectedRevision: null,
        targetState: 'unknown',
      }),
    ).toEqual({ ok: false, code: 'invalid_command_context' });
    expect(
      transitionFollowUpTask({
        task: task(),
        institutionId: 'institution-b',
        expectedRevision: 1,
        targetState: 'unknown',
      }),
    ).toEqual({ ok: false, code: 'scope_mismatch' });
    expect(
      transitionFollowUpTask({
        task: task(),
        institutionId: ' institution-a ',
        expectedRevision: 2,
        targetState: 'in_progress',
      }),
    ).toEqual({ ok: false, code: 'scope_mismatch' });
    expect(
      transitionFollowUpTask({
        task: task(),
        institutionId: 'institution-a',
        expectedRevision: 1,
        targetState: 'unknown',
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
    expect(
      transitionFollowUpTask({
        task: task(),
        institutionId: 'institution-a',
        expectedRevision: 2,
        targetState: 'unknown',
      }),
    ).toEqual({ ok: false, code: 'invalid_target_state' });
    expect(
      completeFollowUpTask({
        task: task({ state: 'in_progress' }),
        institutionId: 'institution-a',
        expectedRevision: 1,
        result: 'invalid-result',
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
    expect(
      cancelFollowUpTask({
        task: task(),
        institutionId: 'institution-a',
        expectedRevision: 1,
        reason: 'invalid-reason',
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
  });

  it('transition 只接受当前 revision，成功仅加一且当前事实可幂等', () => {
    const original = Object.freeze(task());
    const before = structuredClone(original);
    const input = Object.freeze({
      task: original,
      institutionId: 'institution-a',
      expectedRevision: 2,
      targetState: 'in_progress',
    });

    const first = transitionFollowUpTask(input);
    expect(transitionFollowUpTask(input)).toEqual(first);
    expect(original).toEqual(before);
    expect(first).toMatchObject({
      ok: true,
      changed: true,
      task: { state: 'in_progress', revision: 3 },
    });
    if (!first.ok) throw new Error('expected transition success');

    expect(
      transitionFollowUpTask({
        task: first.task,
        institutionId: 'institution-a',
        expectedRevision: 3,
        targetState: 'in_progress',
      }),
    ).toEqual({ ok: true, changed: false, task: first.task });
    expect(
      transitionFollowUpTask({
        task: first.task,
        institutionId: 'institution-a',
        expectedRevision: 2,
        targetState: 'in_progress',
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
  });

  it('revision 上界保持安全，最终安全值只允许当前事实幂等', () => {
    const lastCommandableRevision = Number.MAX_SAFE_INTEGER - 1;
    const result = transitionFollowUpTask({
      task: task({ revision: lastCommandableRevision }),
      institutionId: 'institution-a',
      expectedRevision: lastCommandableRevision,
      targetState: 'in_progress',
    });
    expect(result).toMatchObject({
      ok: true,
      changed: true,
      task: { state: 'in_progress', revision: Number.MAX_SAFE_INTEGER },
    });
    if (!result.ok) throw new Error('expected upper-bound transition success');

    expect(
      transitionFollowUpTask({
        task: result.task,
        institutionId: 'institution-a',
        expectedRevision: Number.MAX_SAFE_INTEGER,
        targetState: 'in_progress',
      }),
    ).toEqual({ ok: true, changed: false, task: result.task });
    expect(
      transitionFollowUpTask({
        task: result.task,
        institutionId: 'institution-a',
        expectedRevision: Number.MAX_SAFE_INTEGER,
        targetState: 'waiting_customer',
      }),
    ).toEqual({ ok: false, code: 'invalid_command_context' });

    const completedAtLimit = task({
      state: 'completed',
      revision: Number.MAX_SAFE_INTEGER,
      completionResult: { code: 'contact_completed' } as never,
    });
    expect(
      completeFollowUpTask({
        task: completedAtLimit,
        institutionId: 'institution-a',
        expectedRevision: Number.MAX_SAFE_INTEGER,
        result: { code: 'contact_completed', feedback: null },
      }),
    ).toEqual({
      ok: true,
      changed: false,
      task: {
        ...completedAtLimit,
        completionResult: { code: 'contact_completed', feedback: null },
      },
    });
    expect(
      completeFollowUpTask({
        task: task({ state: 'in_progress', revision: Number.MAX_SAFE_INTEGER }),
        institutionId: 'institution-a',
        expectedRevision: Number.MAX_SAFE_INTEGER,
        result: { code: 'contact_completed', feedback: null },
      }),
    ).toEqual({ ok: false, code: 'invalid_command_context' });

    const cancelledAtLimit = task({
      state: 'cancelled',
      revision: Number.MAX_SAFE_INTEGER,
      cancellationReason: 'duplicate_task',
    });
    expect(
      cancelFollowUpTask({
        task: cancelledAtLimit,
        institutionId: 'institution-a',
        expectedRevision: Number.MAX_SAFE_INTEGER,
        reason: 'duplicate_task',
      }),
    ).toEqual({ ok: true, changed: false, task: cancelledAtLimit });
    expect(
      cancelFollowUpTask({
        task: task({ revision: Number.MAX_SAFE_INTEGER }),
        institutionId: 'institution-a',
        expectedRevision: Number.MAX_SAFE_INTEGER,
        reason: 'duplicate_task',
      }),
    ).toEqual({ ok: false, code: 'invalid_command_context' });

    expect(
      transitionFollowUpTask({
        task: task({ revision: Number.MAX_SAFE_INTEGER + 1 }),
        institutionId: 'institution-a',
        expectedRevision: Number.MAX_SAFE_INTEGER + 1,
        targetState: 'in_progress',
      }),
    ).toEqual({ ok: false, code: 'invalid_task' });
  });

  it('complete 的旧 revision 即使结构化结果相同也必须冲突', () => {
    const original = Object.freeze(task({ state: 'in_progress', revision: 4 }));
    const before = structuredClone(original);
    const input = Object.freeze({
      task: original,
      institutionId: 'institution-a',
      expectedRevision: 4,
      result: Object.freeze({ code: 'contact_completed' as const, feedback: null }),
    });
    const inputBefore = structuredClone(input);
    const completed = completeFollowUpTask(input);
    expect(original).toEqual(before);
    expect(input).toEqual(inputBefore);
    expect(completed).toMatchObject({
      ok: true,
      changed: true,
      task: {
        state: 'completed',
        revision: 5,
        completionResult: { code: 'contact_completed', feedback: null },
      },
    });
    if (!completed.ok) throw new Error('expected completion success');

    expect(
      completeFollowUpTask({
        task: completed.task,
        institutionId: 'institution-a',
        expectedRevision: 5,
        result: { code: 'contact_completed', feedback: null },
      }),
    ).toEqual({ ok: true, changed: false, task: completed.task });
    expect(
      completeFollowUpTask({
        task: completed.task,
        institutionId: 'institution-a',
        expectedRevision: 4,
        result: { code: 'contact_completed', feedback: null },
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
  });

  it('cancel 的旧 revision 即使受控原因相同也必须冲突', () => {
    const original = Object.freeze(task({ state: 'waiting_customer', revision: 7 }));
    const before = structuredClone(original);
    const cancelled = cancelFollowUpTask({
      task: original,
      institutionId: 'institution-a',
      expectedRevision: 7,
      reason: 'customer_requested_stop',
    });
    expect(original).toEqual(before);
    expect(cancelled).toMatchObject({
      ok: true,
      changed: true,
      task: {
        state: 'cancelled',
        revision: 8,
        cancellationReason: 'customer_requested_stop',
      },
    });
    if (!cancelled.ok) throw new Error('expected cancellation success');

    expect(
      cancelFollowUpTask({
        task: cancelled.task,
        institutionId: 'institution-a',
        expectedRevision: 8,
        reason: 'customer_requested_stop',
      }),
    ).toEqual({ ok: true, changed: false, task: cancelled.task });
    expect(
      cancelFollowUpTask({
        task: cancelled.task,
        institutionId: 'institution-a',
        expectedRevision: 7,
        reason: 'customer_requested_stop',
      }),
    ).toEqual({ ok: false, code: 'revision_conflict' });
  });

  it('三类命令的 scope/revision 失败均不修改冻结输入', () => {
    const original = Object.freeze(task({ state: 'in_progress', revision: 6 }));
    const before = structuredClone(original);
    const runFailures = () => [
      transitionFollowUpTask({
        task: original,
        institutionId: 'institution-b',
        expectedRevision: 6,
        targetState: 'waiting_customer',
      }),
      completeFollowUpTask({
        task: original,
        institutionId: 'institution-a',
        expectedRevision: 5,
        result: { code: 'contact_completed', feedback: null },
      }),
      cancelFollowUpTask({
        task: original,
        institutionId: 'institution-a',
        expectedRevision: 7,
        reason: 'duplicate_task',
      }),
    ];
    const results = runFailures();

    expect(results).toEqual([
      { ok: false, code: 'scope_mismatch' },
      { ok: false, code: 'revision_conflict' },
      { ok: false, code: 'revision_conflict' },
    ]);
    expect(runFailures()).toEqual(results);
    for (const result of results) expect('task' in result).toBe(false);
    expect(original).toEqual(before);
  });
});
