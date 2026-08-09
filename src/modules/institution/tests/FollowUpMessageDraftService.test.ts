import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveMessageDraft,
  createMessageDraftForFollowUpTask,
  listMessageDraftsForFollowUpTask,
  updateMessageDraftContent,
} from '@/modules/institution/server/followup-message-draft-service';
import type { FollowUpMessageDraft } from '@/modules/institution/domain/followup-message-drafts';
import type { AccessContext } from '@/modules/security/domain/access-control';

const context: AccessContext = {
  userId: 'admin-a', role: 'tenant_admin', scope: 'tenant', tenantId: 'tenant-a', institutionId: 'inst-a', source: 'demo_session',
};
const task = {
  id: 'task-a', tenantId: 'tenant-a', customerId: 'customer-a', customerDisplayName: '低敏客户', journeyId: 'journey-a', stage: 'D1',
  status: 'due' as const, dueAt: '2026-08-11T00:00:00.000Z', suggestedAction: '人工确认', riskLevel: 'normal' as const,
  updatedBy: null, updatedAt: null, source: 'treatment_summary' as const, sourceTreatmentSummaryId: 'summary-a',
  sourceSuggestionKey: 'suggestion-a', requiresHumanHandling: true as const, forbidAutoReachOut: true as const,
};
const pathContext = { task, institutionId: 'inst-a', enrollmentId: null, stageId: null, templateKey: null, nodeKey: null, stageKey: null };

function draft(overrides: Partial<FollowUpMessageDraft> = {}): FollowUpMessageDraft {
  return {
    id: 'draft-a', tenantId: 'tenant-a', institutionId: 'inst-a', followUpTaskId: 'task-a', enrollmentId: null, stageId: null,
    customerId: 'customer-a', customerDisplayName: '低敏客户', templateId: null, channelType: 'manual', status: 'draft',
    draftContent: '您好，低敏客户，这里是本次随访提醒。关于「D1」，请按工作人员提示完成护理观察；如有不适，请联系门店人工处理。',
    editedContent: null, safePreview: '低敏随访草稿', approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null,
    markedSentBy: null, markedSentAt: null, safeReasonCode: 'fallback_generated', metadataJson: { forbidAutoSend: true },
    createdAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-08-10T00:00:00.000Z', ...overrides,
  };
}

function dependencies() {
  const commandService = {
    recordTimelineEvidence: vi.fn(async ({ attribution, event }) => ({
      kind: 'created' as const, event: { ...attribution, ...event, createdAt: event.occurredAt, updatedAt: event.occurredAt },
    })),
  };
  const messageDraftCommandService = {
    createDraftWithTimeline: vi.fn(async ({ attribution, draft: inputDraft }) => ({
      kind: 'created' as const,
      draft: { ...draft(), ...inputDraft, ...attribution, customerDisplayName: '低敏客户' },
    })),
    updateDraftContentWithTimeline: vi.fn(async ({ attribution, editedContent, safePreview, occurredAt }) => ({
      kind: 'updated' as const, draft: { ...draft(), ...attribution, editedContent, safePreview, safeReasonCode: 'draft_content_updated' as const, updatedAt: occurredAt },
    })),
    approveDraftWithTimeline: vi.fn(async ({ attribution, actorId, occurredAt }) => ({
      kind: 'updated' as const, draft: { ...draft(), ...attribution, status: 'approved' as const, approvedBy: actorId, approvedAt: occurredAt, safeReasonCode: 'draft_approved' as const, updatedAt: occurredAt },
    })),
    rejectDraftWithTimeline: vi.fn(), markDraftSentWithTimeline: vi.fn(), updateControlledReachOutMetadata: vi.fn(),
  };
  const auditRepository = { record: vi.fn(async () => undefined) };
  const runCareFollowUpTransaction = vi.fn(async (operation) => operation({ commandService, messageDraftCommandService, auditRepository }));
  const repository = {
    listFollowUpMessageTemplatesByTenant: vi.fn(async () => []),
    getFollowUpTaskPathContextByTenant: vi.fn(async () => pathContext),
    listFollowUpMessageDraftsByTask: vi.fn(async () => [draft()]),
    getFollowUpMessageDraftByTenant: vi.fn(async () => draft()),
    getCustomerByTenant: vi.fn(async () => ({ id: 'customer-a' })),
    recordFollowUpCustomerTimelineEvent: vi.fn(async () => { throw new Error('legacy timeline writer must not be used'); }),
    runCareFollowUpTransaction,
  };
  return { repository, commandService, messageDraftCommandService, auditRepository, runCareFollowUpTransaction };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.restoreAllMocks());

describe('follow-up message draft service P2C rewire', () => {
  it('create uses Care transaction canonical writer and does not call external provider', async () => {
    const deps = dependencies();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await createMessageDraftForFollowUpTask({
      context, followUpTaskId: 'task-a', tenantBusinessRepository: deps.repository as never, occurredAt: '2026-08-10T00:00:00.000Z',
    });
    expect(result.kind).toBe('created');
    expect(deps.messageDraftCommandService.createDraftWithTimeline).toHaveBeenCalledWith(expect.objectContaining({
      attribution: { tenantId: 'tenant-a', institutionId: 'inst-a' }, actorRole: 'tenant_admin',
    }));
    expect(deps.repository.recordFollowUpCustomerTimelineEvent).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('read compatibility still scopes draft listing by task path context', async () => {
    const deps = dependencies();
    const result = await listMessageDraftsForFollowUpTask({ context, followUpTaskId: 'task-a', tenantBusinessRepository: deps.repository });
    expect(result).toEqual(expect.objectContaining({ kind: 'success' }));
    expect(deps.repository.getFollowUpTaskPathContextByTenant).toHaveBeenCalledWith({ tenantId: 'tenant-a', institutionId: 'inst-a', followUpTaskId: 'task-a' });
  });

  it('content edit keeps safety validation and passes observed updatedAt CAS to Care', async () => {
    const deps = dependencies();
    const result = await updateMessageDraftContent({
      context, draftId: 'draft-a', content: '低敏人工随访内容', tenantBusinessRepository: deps.repository as never,
      occurredAt: '2026-08-10T00:05:00.000Z',
    });
    expect(result.kind).toBe('updated');
    expect(deps.messageDraftCommandService.updateDraftContentWithTimeline).toHaveBeenCalledWith(expect.objectContaining({
      attribution: { tenantId: 'tenant-a', institutionId: 'inst-a' }, expectedUpdatedAt: '2026-08-10T00:00:00.000Z',
    }));
    const unsafe = await updateMessageDraftContent({
      context, draftId: 'draft-a', content: '客户手机号 13812345678', tenantBusinessRepository: deps.repository as never,
      occurredAt: '2026-08-10T00:05:00.000Z',
    });
    expect(unsafe).toEqual({ kind: 'conflict', resourceId: 'draft-a', reason: 'unsafe_follow_up_message_content' });
  });

  it('approve + delivery timeline + Audit share one Care transaction and no real send occurs', async () => {
    const deps = dependencies();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await approveMessageDraft({
      context, draftId: 'draft-a', tenantBusinessRepository: deps.repository as never,
      occurredAt: '2026-08-10T00:10:00.000Z',
    });
    expect(result).toEqual(expect.objectContaining({ kind: 'updated_with_delivery', deduped: false }));
    expect(deps.messageDraftCommandService.approveDraftWithTimeline).toHaveBeenCalledWith(expect.objectContaining({
      expectedUpdatedAt: '2026-08-10T00:00:00.000Z',
    }));
    expect(deps.commandService.recordTimelineEvidence).toHaveBeenCalled();
    expect(deps.auditRepository.record).toHaveBeenCalled();
    expect(deps.runCareFollowUpTransaction).toHaveBeenCalledTimes(1);
    expect(deps.repository.recordFollowUpCustomerTimelineEvent).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Audit failure escapes the transaction callback so approval bundle can roll back', async () => {
    const deps = dependencies();
    deps.auditRepository.record.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(approveMessageDraft({
      context, draftId: 'draft-a', tenantBusinessRepository: deps.repository as never,
      occurredAt: '2026-08-10T00:10:00.000Z',
    })).rejects.toThrow('audit unavailable');
  });
});
