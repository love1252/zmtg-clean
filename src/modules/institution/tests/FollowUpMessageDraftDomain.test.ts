import { describe, expect, it } from 'vitest';
import {
  approveFollowUpMessageDraft,
  containsUnsafeFollowUpMessageContent,
  createDefaultFollowUpMessageTemplate,
  createMessageDraftForFollowUpTask,
  mapFollowUpMessageDraftToDto,
  markFollowUpMessageDraftAsSent,
  rejectFollowUpMessageDraft,
  updateFollowUpMessageDraftContent,
  type FollowUpMessageDraft,
  type FollowUpTaskPathContext,
} from '@/modules/institution/domain/followup-message-drafts';
import type { TenantFollowUpTask } from '@/modules/institution/domain/followup-workflow';

const occurredAt = '2026-07-06T08:00:00.000Z';

function task(overrides: Partial<TenantFollowUpTask> = {}): TenantFollowUpTask {
  return {
    id: 'task-1',
    tenantId: 'tenant-a',
    customerId: 'customer-1',
    customerDisplayName: '张三',
    journeyId: 'journey-1',
    stage: 'D1 泛红观察',
    status: 'due',
    dueAt: '2026-07-07T00:00:00.000Z',
    suggestedAction: '人工确认补水、防晒和泛红情况',
    riskLevel: 'normal',
    updatedBy: null,
    updatedAt: null,
    source: 'treatment_summary',
    sourceTreatmentSummaryId: 'summary-1',
    sourceSuggestionKey: 'hydro-d1',
    requiresHumanHandling: true,
    forbidAutoReachOut: true,
    ...overrides,
  };
}

function pathContext(overrides: Partial<FollowUpTaskPathContext> = {}): FollowUpTaskPathContext {
  return {
    task: task(overrides.task),
    institutionId: 'inst-1',
    enrollmentId: 'enrollment-1',
    stageId: 'stage-1',
    templateKey: 'hydro_injection_care',
    nodeKey: 'hydro_injection_d1_check',
    stageKey: 'D1',
    ...overrides,
  };
}

function draft(overrides: Partial<FollowUpMessageDraft> = {}): FollowUpMessageDraft {
  const base = createMessageDraftForFollowUpTask({
    pathContext: pathContext(),
    template: null,
    occurredAt,
  });

  return {
    id: 'draft-1',
    ...base,
    customerDisplayName: '张三',
    ...overrides,
  };
}

describe('follow-up message draft domain', () => {
  it('根据 follow-up task 创建绑定 task/enrollment/stage 的低敏草稿', () => {
    const result = createMessageDraftForFollowUpTask({
      pathContext: pathContext(),
      template: null,
      occurredAt,
    });

    expect(result).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-1',
        followUpTaskId: 'task-1',
        enrollmentId: 'enrollment-1',
        stageId: 'stage-1',
        customerId: 'customer-1',
        channelType: 'manual',
        status: 'draft',
        safeReasonCode: 'fallback_generated',
      }),
    );
    expect(result.metadataJson).toEqual(
      expect.objectContaining({
        requiresHumanApproval: true,
        forbidAutoSend: true,
        source: 'follow_up_task',
      }),
    );
    expect(result.draftContent).toContain('张三');
    expect(result.draftContent).toContain('D1 泛红观察');
    expect(result.draftContent).not.toContain('summary-1');
    expect(result.draftContent).not.toContain('hydro-d1');
  });

  it('无模板时生成 fallback，水光/光电/术后修复生成路径差异话术', () => {
    const fallback = createMessageDraftForFollowUpTask({
      pathContext: pathContext({ templateKey: null, nodeKey: null }),
      template: null,
      occurredAt,
    });
    const hydro = createMessageDraftForFollowUpTask({
      pathContext: pathContext({ templateKey: 'hydro_injection_care' }),
      template: createDefaultFollowUpMessageTemplate({ templateKey: 'hydro_injection_care' }),
      occurredAt,
    });
    const photoelectric = createMessageDraftForFollowUpTask({
      pathContext: pathContext({ templateKey: 'photoelectric_care' }),
      template: createDefaultFollowUpMessageTemplate({ templateKey: 'photoelectric_care' }),
      occurredAt,
    });
    const surgery = createMessageDraftForFollowUpTask({
      pathContext: pathContext({ templateKey: 'post_surgery_repair' }),
      template: createDefaultFollowUpMessageTemplate({ templateKey: 'post_surgery_repair' }),
      occurredAt,
    });

    expect(fallback.draftContent).toContain('本次随访提醒');
    expect(hydro.draftContent).toContain('水光术后护理提醒');
    expect(photoelectric.draftContent).toContain('光电治疗后的护理提醒');
    expect(surgery.draftContent).toContain('术后恢复人工关怀');
  });

  it('拒绝手机号、身份证、病历号、HIS 和 provider/prompt 等敏感内容', () => {
    expect(containsUnsafeFollowUpMessageContent('请联系 13812345678')).toBe(true);
    expect(containsUnsafeFollowUpMessageContent('身份证 110101199001011234')).toBe(true);
    expect(containsUnsafeFollowUpMessageContent('病历 MR-ABC123')).toBe(true);
    expect(containsUnsafeFollowUpMessageContent('HIS payload')).toBe(true);
    expect(containsUnsafeFollowUpMessageContent('provider model token prompt')).toBe(true);

    const result = updateFollowUpMessageDraftContent({
      draft: draft(),
      content: '客户手机号 13812345678',
      occurredAt: '2026-07-06T09:00:00.000Z',
    });

    expect(result).toEqual({ kind: 'unsafe_content' });
  });

  it('支持 draft -> approved -> marked_sent，rejected 不能 marked_sent，marked_sent 不能编辑', () => {
    const current = draft();
    const approved = approveFollowUpMessageDraft({
      draft: current,
      actorId: 'user-1',
      occurredAt: '2026-07-06T09:00:00.000Z',
    });
    expect(approved).toEqual(expect.objectContaining({ kind: 'approved' }));
    if (approved.kind !== 'approved') return;

    const markedSent = markFollowUpMessageDraftAsSent({
      draft: approved.draft,
      actorId: 'user-1',
      occurredAt: '2026-07-06T10:00:00.000Z',
    });
    expect(markedSent).toEqual(expect.objectContaining({ kind: 'marked_sent' }));
    if (markedSent.kind !== 'marked_sent') return;
    expect(markedSent.draft.markedSentBy).toBe('user-1');

    expect(
      updateFollowUpMessageDraftContent({
        draft: markedSent.draft,
        content: '人工修改内容',
        occurredAt: '2026-07-06T11:00:00.000Z',
      }),
    ).toEqual({ kind: 'invalid_status', status: 'marked_sent' });

    const rejected = rejectFollowUpMessageDraft({
      draft: current,
      actorId: 'user-1',
      occurredAt: '2026-07-06T09:30:00.000Z',
    });
    expect(rejected).toEqual(expect.objectContaining({ kind: 'rejected' }));
    if (rejected.kind !== 'rejected') return;

    expect(
      markFollowUpMessageDraftAsSent({
        draft: rejected.draft,
        actorId: 'user-1',
        occurredAt: '2026-07-06T10:00:00.000Z',
      }),
    ).toEqual({ kind: 'invalid_status', status: 'rejected' });
  });

  it('DTO 只返回 API 白名单字段，不返回租户、机构、模板、审批人和 metadata', () => {
    const dto = mapFollowUpMessageDraftToDto(draft({
      editedContent: '人工编辑后的低敏内容',
      approvedBy: 'user-1',
      metadataJson: { provider: 'forbidden' },
    }));

    expect(Object.keys(dto).sort()).toEqual(
      [
        'approvedAt',
        'channelType',
        'createdAt',
        'customerDisplayName',
        'customerId',
        'draftContent',
        'draftId',
        'editedContent',
        'followUpTaskId',
        'markedSentAt',
        'safePreview',
        'safeReasonCode',
        'status',
        'updatedAt',
      ].sort(),
    );
    expect(JSON.stringify(dto)).not.toContain('tenant-a');
    expect(JSON.stringify(dto)).not.toContain('inst-1');
    expect(JSON.stringify(dto)).not.toContain('provider');
    expect(JSON.stringify(dto)).not.toContain('user-1');
  });
});
