import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  approveMessageDraft,
  createMessageDraftForFollowUpTask,
  listMessageDraftsForFollowUpTask,
  markMessageDraftAsSent,
  updateMessageDraftContent,
} from '@/modules/institution/server/followup-message-draft-service';
import type { FollowUpMessageDraft } from '@/modules/institution/domain/followup-message-drafts';
import type { AccessContext } from '@/modules/security/domain/access-control';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';

const context: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-a',
  institutionId: 'inst-a',
  source: 'demo_session',
};

const task = {
  id: 'task-1',
  tenantId: 'tenant-a',
  customerId: 'customer-1',
  customerDisplayName: '陈女士',
  journeyId: 'journey-1',
  stage: 'D1 水光补水观察',
  status: 'due' as const,
  dueAt: '2026-07-07T00:00:00.000Z',
  suggestedAction: '人工确认补水、防晒和泛红情况',
  riskLevel: 'normal' as const,
  updatedBy: null,
  updatedAt: null,
  source: 'treatment_summary' as const,
  sourceTreatmentSummaryId: 'summary-1',
  sourceSuggestionKey: 'hydro-d1',
  requiresHumanHandling: true as const,
  forbidAutoReachOut: true as const,
};

const customerSummary: CustomerRecordSummary = {
  id: 'customer-1',
  tenantId: 'tenant-a',
  institutionId: 'inst-a',
  displayName: '陈女士',
  lifecycle: 'post_care',
  priority: 'medium',
  ownerUserId: 'owner-1',
  projectInterest: '水光补水',
  maskedPhone: '138****0000',
  maskedMedicalRecordNo: 'MR***001',
  lastTouchSummary: '低敏随访记录',
  nextAction: '人工随访',
  tags: ['demo'],
  gender: 'female',
  birthDate: '1990-01-01',
  referralSource: 'demo',
  notes: '低敏备注',
};

const pathContext = {
  task,
  institutionId: 'inst-a',
  enrollmentId: 'enrollment-1',
  stageId: 'stage-1',
  templateKey: 'hydro_injection_care' as const,
  nodeKey: 'hydro_injection_d1_check',
  stageKey: 'D1',
};

function draft(overrides: Partial<FollowUpMessageDraft> = {}): FollowUpMessageDraft {
  return {
    id: 'draft-1',
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    followUpTaskId: 'task-1',
    enrollmentId: 'enrollment-1',
    stageId: 'stage-1',
    customerId: 'customer-1',
    customerDisplayName: '陈女士',
    templateId: null,
    channelType: 'manual',
    status: 'draft',
    draftContent: '陈女士，D1 水光补水观察，请人工确认护理情况。',
    editedContent: null,
    safePreview: '陈女士，D1 水光补水观察，请人工确认护理情况。',
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    markedSentBy: null,
    markedSentAt: null,
    safeReasonCode: 'fallback_generated',
    metadataJson: { requiresHumanApproval: true, forbidAutoSend: true },
    createdAt: '2026-07-06T08:00:00.000Z',
    updatedAt: '2026-07-06T08:00:00.000Z',
    ...overrides,
  };
}

function createRepository() {
  return {
    listFollowUpMessageTemplatesByTenant: vi.fn(async () => []),
    getFollowUpTaskPathContextByTenant: vi.fn(async (): Promise<typeof pathContext | null> => pathContext),
    createFollowUpMessageDraft: vi.fn(async (input) => ({
      kind: 'created' as const,
      draft: draft({
        id: input.id,
        draftContent: input.draftContent,
        safePreview: input.safePreview,
        safeReasonCode: input.safeReasonCode,
      }),
    })),
    listFollowUpMessageDraftsByTask: vi.fn(async () => [draft()]),
    getFollowUpMessageDraftByTenant: vi.fn(async () => draft()),
    updateFollowUpMessageDraftContent: vi.fn(async (input) => ({
      kind: 'updated' as const,
      draft: draft({
        editedContent: input.editedContent,
        safePreview: input.safePreview,
        safeReasonCode: input.safeReasonCode,
        updatedAt: input.occurredAt,
      }),
    })),
    approveFollowUpMessageDraft: vi.fn(async (input): Promise<
      | { kind: 'updated'; draft: FollowUpMessageDraft }
      | { kind: 'conflict'; resourceId: string; reason: 'follow_up_message_draft_not_draft' }
    > => ({
      kind: 'updated' as const,
      draft: draft({
        status: 'approved',
        approvedBy: input.actorId,
        approvedAt: input.occurredAt,
        safeReasonCode: 'draft_approved',
      }),
    })),
    rejectFollowUpMessageDraft: vi.fn(),
    markFollowUpMessageDraftAsSent: vi.fn(async (input) => ({
      kind: 'updated' as const,
      draft: draft({
        status: 'marked_sent',
        markedSentBy: input.actorId,
        markedSentAt: input.occurredAt,
        safeReasonCode: 'draft_marked_sent',
      }),
    })),
    getCustomerByTenant: vi.fn(async (): Promise<CustomerRecordSummary | null> => customerSummary),
    recordFollowUpCustomerTimelineEvent: vi.fn(async (input) => ({
      kind: 'created' as const,
      event: {
        id: input.id,
        tenantId: input.tenantId,
        institutionId: input.institutionId,
        customerId: input.customerId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        eventType: input.eventType,
        eventTitle: input.eventTitle,
        safeSummary: input.safeSummary,
        riskLevel: input.riskLevel,
        occurredAt: input.occurredAt,
        safeActorRole: input.safeActorRole,
        safeReasonCode: input.safeReasonCode,
        metadataJson: input.metadataJson,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt,
      },
    })),
  };
}

beforeEach(() => {
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('generated-draft-id');
});

describe('follow-up message draft service', () => {
  it('创建草稿时带 tenant/institution 隔离，并不调用外部 provider', async () => {
    const repository = createRepository();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await createMessageDraftForFollowUpTask({
      context,
      followUpTaskId: 'task-1',
      tenantBusinessRepository: repository,
      occurredAt: '2026-07-06T08:00:00.000Z',
    });

    expect(result).toEqual(expect.objectContaining({ kind: 'created' }));
    expect(repository.getFollowUpTaskPathContextByTenant).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      followUpTaskId: 'task-1',
    });
    expect(repository.createFollowUpMessageDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'generated-draft-id',
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        followUpTaskId: 'task-1',
        channelType: 'manual',
        status: 'draft',
      }),
    );
    expect(repository.recordFollowUpCustomerTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        customerId: 'customer-1',
        sourceType: 'message_draft',
        sourceId: 'generated-draft-id:message_draft_created',
        eventType: 'message_draft_created',
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('列表读取先校验 task path context，跨机构不可读取', async () => {
    const repository = createRepository();
    repository.getFollowUpTaskPathContextByTenant.mockResolvedValueOnce(null);

    const result = await listMessageDraftsForFollowUpTask({
      context,
      followUpTaskId: 'task-other-inst',
      tenantBusinessRepository: repository,
    });

    expect(result).toEqual({ kind: 'not_found' });
    expect(repository.listFollowUpMessageDraftsByTask).not.toHaveBeenCalled();
  });

  it('编辑草稿只传低敏内容和 safe reason，敏感内容返回 conflict', async () => {
    const repository = createRepository();

    const updated = await updateMessageDraftContent({
      context,
      draftId: 'draft-1',
      content: '陈女士，D1 水光补水观察，请人工确认护理情况。',
      tenantBusinessRepository: repository,
      occurredAt: '2026-07-06T09:00:00.000Z',
    });

    expect(updated).toEqual(expect.objectContaining({ kind: 'updated' }));
    expect(repository.updateFollowUpMessageDraftContent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        draftId: 'draft-1',
        safeReasonCode: 'draft_content_updated',
      }),
    );

    const unsafe = await updateMessageDraftContent({
      context,
      draftId: 'draft-1',
      content: '客户手机号 13812345678',
      tenantBusinessRepository: repository,
      occurredAt: '2026-07-06T09:00:00.000Z',
    });

    expect(unsafe).toEqual({
      kind: 'conflict',
      resourceId: 'draft-1',
      reason: 'unsafe_follow_up_message_content',
    });
  });

  it('人工确认后生成受控发送记录、timeline 和 audit，且不真实发送', async () => {
    const repository = createRepository();
    const auditRepository = { record: vi.fn(async (_event: TenantAuditEvent) => undefined) };
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const approved = await approveMessageDraft({
      context,
      draftId: 'draft-1',
      tenantBusinessRepository: repository,
      auditRepository,
      occurredAt: '2026-07-06T10:00:00.000Z',
    });
    const markedSent = await markMessageDraftAsSent({
      context,
      draftId: 'draft-1',
      tenantBusinessRepository: repository,
      occurredAt: '2026-07-06T11:00:00.000Z',
    });

    expect(approved).toEqual(expect.objectContaining({
      kind: 'updated_with_delivery',
      deduped: false,
      delivery: expect.objectContaining({
        deliveryId: 'msg-delivery:draft-1',
        customerId: 'customer-1',
        followUpTaskId: 'task-1',
        messageDraftId: 'draft-1',
        channelType: 'mock',
        deliveryMode: 'mock',
        recipientRef: 'customer:customer-1',
        contentSnapshot: '陈女士,D1 水光补水观察,请人工确认护理情况。',
        status: 'mock_sent',
        failureReason: null,
        boundaryLabel: '触达安全治理 / 默认关闭 / 灰度前置 / 人工确认 / 模拟发送 / 不自动发送 / 未接真实企业微信 / 短信',
        contactSafety: expect.objectContaining({
          code: 'allowed',
          allowed: true,
          auditReason: 'contact_safety_allowed',
        }),
      }),
    }));
    if (approved.kind !== 'updated_with_delivery') return;
    expect(JSON.stringify(approved.delivery)).not.toMatch(
      /tenantId|institutionId|phoneNumber|idNumber|medicalRecordNo|HIS|provider|model|token|cost|vendor|prompt|raw|DATABASE_URL|secret/i,
    );
    expect(markedSent).toEqual(expect.objectContaining({ kind: 'updated' }));
    expect(repository.approveFollowUpMessageDraft).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', institutionId: 'inst-a', actorId: 'demo-user-admin' }),
    );
    expect(repository.markFollowUpMessageDraftAsSent).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', institutionId: 'inst-a', actorId: 'demo-user-admin' }),
    );
    expect(repository.recordFollowUpCustomerTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        customerId: 'customer-1',
        sourceType: 'message_draft',
        eventType: 'message_draft_approved',
      }),
    );
    expect(repository.recordFollowUpCustomerTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        customerId: 'customer-1',
        sourceType: 'message_draft',
        sourceId: 'msg-delivery:draft-1:created',
        eventType: 'message_draft_marked_sent',
        eventTitle: '受控发送记录已生成',
        safeReasonCode: 'message_delivery_created',
        metadataJson: expect.objectContaining({
          messageDeliveryId: 'msg-delivery:draft-1',
          messageDeliveryStatus: 'mock_sent',
          contactSafetyDecisionCode: 'allowed',
          contactSafetyAuditReason: 'contact_safety_allowed',
          requiresHumanApproval: 'true',
          forbidAutoSend: 'true',
          externalChannelEnabled: 'false',
        }),
      }),
    );
    expect(repository.recordFollowUpCustomerTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        customerId: 'customer-1',
        sourceType: 'message_draft',
        sourceId: 'msg-delivery:draft-1:mock_sent',
        eventType: 'message_draft_marked_sent',
        eventTitle: '触达安全校验通过',
        safeSummary: expect.stringContaining('不代表真实企业微信或短信触达'),
        safeReasonCode: 'message_delivery_mock_sent',
      }),
    );
    expect(repository.recordFollowUpCustomerTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-a',
        customerId: 'customer-1',
        sourceType: 'message_draft',
        eventType: 'message_draft_marked_sent',
        safeSummary: expect.stringContaining('不代表系统自动发送'),
      }),
    );
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'follow_up',
      action: 'create',
      result: 'allowed',
      reason: 'message_delivery_created',
      resourceId: 'msg-delivery:draft-1',
    }));
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'follow_up',
      action: 'create',
      result: 'allowed',
      reason: 'contact_safety_allowed',
      resourceId: 'msg-delivery:draft-1',
    }));
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'follow_up',
      action: 'create',
      result: 'allowed',
      reason: 'message_delivery_mock_sent',
      resourceId: 'msg-delivery:draft-1',
    }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('支持 mock_failed、skipped、external_disabled 低敏状态', async () => {
    const cases = [
      { status: 'mock_failed' as const, reason: 'mock_failure', sourceId: 'msg-delivery:draft-1:mock_failed', title: '模拟发送失败' },
      { status: 'skipped' as const, reason: 'consent_missing', sourceId: 'msg-delivery:draft-1:skipped', title: '未授权触达' },
      { status: 'external_disabled' as const, reason: 'external_channel_disabled', sourceId: 'msg-delivery:draft-1:external_disabled', title: '渠道未启用', channelType: 'sms' as const, deliveryMode: 'external_disabled' as const },
    ];

    for (const item of cases) {
      const repository = createRepository();
      const result = await approveMessageDraft({
        context,
        draftId: 'draft-1',
        tenantBusinessRepository: repository,
        occurredAt: '2026-07-06T10:00:00.000Z',
        deliveryOptions: {
          status: item.status,
          channelType: item.channelType,
          deliveryMode: item.deliveryMode,
        },
      });

      expect(result).toEqual(expect.objectContaining({
        kind: 'updated_with_delivery',
        delivery: expect.objectContaining({
          status: item.status,
          failureReason: item.reason,
          channelType: item.channelType ?? 'mock',
          deliveryMode: item.deliveryMode ?? 'mock',
          contactSafety: expect.objectContaining({
            auditReason: expect.stringMatching(/contact_safety|channel_gray/),
          }),
        }),
      }));
      expect(repository.recordFollowUpCustomerTimelineEvent).toHaveBeenCalledWith(expect.objectContaining({
        sourceId: item.sourceId,
        eventTitle: expect.stringContaining(item.title),
        safeReasonCode: item.reason,
      }));
    }
  });

  it('重复确认不会重复生成受控发送记录', async () => {
    const repository = createRepository();
    repository.approveFollowUpMessageDraft.mockResolvedValueOnce({
      kind: 'conflict' as const,
      resourceId: 'draft-1',
      reason: 'follow_up_message_draft_not_draft' as const,
    });

    const result = await approveMessageDraft({
      context,
      draftId: 'draft-1',
      tenantBusinessRepository: repository,
      occurredAt: '2026-07-06T10:00:00.000Z',
    });

    expect(result).toEqual({
      kind: 'conflict',
      resourceId: 'draft-1',
      reason: 'follow_up_message_draft_not_draft',
    });
    expect(repository.recordFollowUpCustomerTimelineEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ safeReasonCode: 'message_delivery_created' }),
    );
  });

  it('无 tenant 或无权限时禁止访问', async () => {
    const repository = createRepository();
    const missingTenant = await createMessageDraftForFollowUpTask({
      context: { ...context, tenantId: null },
      followUpTaskId: 'task-1',
      tenantBusinessRepository: repository,
      occurredAt: '2026-07-06T08:00:00.000Z',
    });

    const roleDenied = await createMessageDraftForFollowUpTask({
      context: { ...context, role: 'security_auditor' },
      followUpTaskId: 'task-1',
      tenantBusinessRepository: repository,
      occurredAt: '2026-07-06T08:00:00.000Z',
    });

    expect(missingTenant).toEqual({ kind: 'forbidden', reason: 'missing_tenant' });
    expect(roleDenied).toEqual({ kind: 'forbidden', reason: 'role_denied' });
  });
});
