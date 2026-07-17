import { describe, expect, it } from 'vitest';

import {
  FOLLOW_UP_COMPLETION_CODES,
  FOLLOW_UP_MANUAL_FEEDBACK_MAX_LENGTH,
  cancelFollowUpTask,
  completeFollowUpTask,
  escalateFollowUpTask,
  parseFollowUpCompletionResult,
  parseFollowUpRiskEscalation,
  transitionFollowUpTask,
} from '@/modules/care/domain/follow-up-task';
import type { FollowUpTask } from '@/modules/care/domain/follow-up-task';

function task(overrides: Partial<FollowUpTask> = {}): FollowUpTask {
  return {
    taskId: 'followup-structured-001',
    institutionId: 'institution-a',
    state: 'in_progress',
    revision: 4,
    riskLevel: 'none',
    riskEscalation: null,
    completionResult: null,
    cancellationReason: null,
    ...overrides,
  };
}

function complete(input: FollowUpTask, result: unknown) {
  return completeFollowUpTask({
    task: input,
    institutionId: input.institutionId,
    expectedRevision: input.revision,
    result,
  });
}

function escalate(input: FollowUpTask, escalation: unknown) {
  return escalateFollowUpTask({
    task: input,
    institutionId: input.institutionId,
    expectedRevision: input.revision,
    escalation,
  });
}

describe('随访任务结构化结果与风险升级纯领域契约', () => {
  it('完成结果使用五个固定 code，人工反馈只作为受限附属字段', () => {
    expect(FOLLOW_UP_COMPLETION_CODES).toEqual([
      'contact_completed',
      'no_response_closed',
      'his_appointment_linked',
      'customer_declined',
      'invalid_or_duplicate',
    ]);
    expect(
      parseFollowUpCompletionResult({
        code: 'contact_completed',
        feedback: { kind: 'manual_low_sensitivity', summary: '已完成受控人工记录' },
      }),
    ).toEqual({
      code: 'contact_completed',
      feedback: { kind: 'manual_low_sensitivity', summary: '已完成受控人工记录' },
    });
    expect(parseFollowUpCompletionResult('已联系客户')).toBeNull();
    expect(
      parseFollowUpCompletionResult({
        code: 'contact_completed',
        feedback: { kind: 'manual_low_sensitivity', summary: 'free text does not decide completion' },
      }),
    ).not.toBeNull();
  });

  it('拒绝将自由文本、未知 code、超长或带控制字符的反馈当作结构化完成结果', () => {
    expect(complete(task(), '已联系客户')).toEqual({
      ok: false,
      code: 'invalid_completion_result',
    });
    expect(complete(task(), { code: 'unknown', feedback: null })).toEqual({
      ok: false,
      code: 'invalid_completion_result',
    });
    expect(
      complete(task(), {
        code: 'contact_completed',
        feedback: {
          kind: 'manual_low_sensitivity',
          summary: 'a'.repeat(FOLLOW_UP_MANUAL_FEEDBACK_MAX_LENGTH + 1),
        },
      }),
    ).toEqual({ ok: false, code: 'invalid_completion_result' });
    expect(
      complete(task(), {
        code: 'contact_completed',
        feedback: { kind: 'manual_low_sensitivity', summary: '含\n控制字符' },
      }),
    ).toEqual({ ok: false, code: 'invalid_completion_result' });
  });

  it('高风险任务不得普通完成或取消，且普通状态转换不能伪造升级', () => {
    const highRisk = task({ riskLevel: 'high' });
    expect(complete(highRisk, { code: 'contact_completed', feedback: null })).toEqual({
      ok: false,
      code: 'high_risk_escalation_required',
    });
    expect(
      cancelFollowUpTask({
        task: highRisk,
        institutionId: highRisk.institutionId,
        expectedRevision: highRisk.revision,
        reason: 'source_invalidated',
      }),
    ).toEqual({ ok: false, code: 'high_risk_escalation_required' });
    expect(
      transitionFollowUpTask({
        task: task(),
        institutionId: 'institution-a',
        expectedRevision: 4,
        targetState: 'escalated',
      }),
    ).toEqual({ ok: false, code: 'risk_escalation_required' });
  });

  it('只有受控高风险事件能升级；升级后不可普通完成，重复相同命令幂等', () => {
    const escalation = {
      level: 'high',
      kind: 'clinical',
      riskEventId: 'risk-event-001',
    };
    expect(parseFollowUpRiskEscalation(escalation)).toEqual(escalation);
    expect(parseFollowUpRiskEscalation({ ...escalation, kind: 'free_text' })).toBeNull();
    expect(parseFollowUpRiskEscalation({ ...escalation, riskEventId: ' risk ' })).toBeNull();

    const escalated = escalate(task(), escalation);
    expect(escalated).toEqual({
      ok: true,
      changed: true,
      task: {
        ...task(),
        state: 'escalated',
        revision: 5,
        riskLevel: 'high',
        riskEscalation: escalation,
      },
    });
    if (!escalated.ok) throw new Error('expected escalation');

    expect(complete(escalated.task, { code: 'contact_completed', feedback: null })).toEqual({
      ok: false,
      code: 'escalated_completion_forbidden',
    });
    expect(escalate(escalated.task, escalation)).toEqual({
      ok: true,
      changed: false,
      task: escalated.task,
    });
    expect(
      escalate(escalated.task, { ...escalation, riskEventId: 'risk-event-002' }),
    ).toEqual({ ok: false, code: 'escalation_conflict' });
  });

  it('失败不返回 task 数据且不修改输入', () => {
    const original = task({ riskLevel: 'high' });
    const before = structuredClone(original);
    const result = complete(original, { code: 'contact_completed', feedback: null });

    expect(result).toEqual({ ok: false, code: 'high_risk_escalation_required' });
    expect(original).toEqual(before);
    expect('task' in result).toBe(false);
  });
});
