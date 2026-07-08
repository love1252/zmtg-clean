import { describe, expect, it } from 'vitest';
import {
  buildFollowUpOperationsDashboard,
  getFollowUpDraftOperationsSummary,
  getFollowUpMessageDeliveryOperationsSummary,
  getFollowUpOperationsOverview,
  getFollowUpPathPerformance,
  getFollowUpRiskSummary,
  getFollowUpTaskWorkload,
  type FollowUpOperationsSnapshot,
} from '@/modules/institution/domain/followup-operations-dashboard';
import {
  createWeComCustomerContactSyncDashboardView,
  getDefaultWeComCustomerContactSyncDashboardView,
} from '@/modules/institution/domain/wecom-customer-contact';
import {
  createWeComAuthorizationRecord,
  getDefaultWeComAuthorizationDashboardView,
  mapWeComAuthorizationToDashboardView,
} from '@/modules/institution/domain/wecom-authorization';

const now = new Date('2026-07-07T12:00:00.000Z');

const snapshot: FollowUpOperationsSnapshot = {
  tasks: [
    {
      taskId: 'task_today_due',
      status: 'due',
      dueAt: '2026-07-07T16:00:00.000Z',
      riskLevel: 'watch',
    },
    {
      taskId: 'task_overdue_urgent',
      status: 'in_progress',
      dueAt: '2026-07-06T08:00:00.000Z',
      riskLevel: 'urgent',
    },
    {
      taskId: 'task_escalated',
      status: 'escalated',
      dueAt: '2026-07-07T09:00:00.000Z',
      riskLevel: 'urgent',
    },
    {
      taskId: 'task_completed',
      status: 'completed',
      dueAt: '2026-07-05T08:00:00.000Z',
      riskLevel: 'normal',
    },
  ],
  enrollments: [
    {
      enrollmentId: 'enrollment_hydro',
      templateKey: 'hydro_injection_care',
      status: 'active',
    },
    {
      enrollmentId: 'enrollment_photo',
      templateKey: 'photoelectric_care',
      status: 'completed',
    },
  ],
  stages: [
    {
      stageId: 'stage_today_due',
      enrollmentId: 'enrollment_hydro',
      followUpTaskId: 'task_today_due',
      handlerRole: 'customer_service',
      status: 'due',
      dueAt: '2026-07-07T16:00:00.000Z',
      riskLevel: 'watch',
    },
    {
      stageId: 'stage_overdue_urgent',
      enrollmentId: 'enrollment_hydro',
      followUpTaskId: 'task_overdue_urgent',
      handlerRole: 'medical_assistant',
      status: 'in_progress',
      dueAt: '2026-07-06T08:00:00.000Z',
      riskLevel: 'urgent',
    },
    {
      stageId: 'stage_completed',
      enrollmentId: 'enrollment_photo',
      followUpTaskId: 'task_completed',
      handlerRole: 'customer_service',
      status: 'completed',
      dueAt: '2026-07-05T08:00:00.000Z',
      riskLevel: 'normal',
    },
  ],
  drafts: [
    {
      draftId: 'draft_pending_send',
      followUpTaskId: 'task_today_due',
      enrollmentId: 'enrollment_hydro',
      stageId: 'stage_today_due',
      status: 'approved',
      createdAt: '2026-07-07T09:00:00.000Z',
      updatedAt: '2026-07-07T10:00:00.000Z',
      approvedAt: '2026-07-07T10:00:00.000Z',
      markedSentAt: null,
    },
    {
      draftId: 'draft_marked_sent',
      followUpTaskId: 'task_completed',
      enrollmentId: 'enrollment_photo',
      stageId: 'stage_completed',
      status: 'marked_sent',
      createdAt: '2026-07-05T09:00:00.000Z',
      updatedAt: '2026-07-05T10:00:00.000Z',
      approvedAt: '2026-07-05T09:30:00.000Z',
      markedSentAt: '2026-07-05T10:00:00.000Z',
    },
    {
      draftId: 'draft_rejected',
      followUpTaskId: 'task_overdue_urgent',
      enrollmentId: 'enrollment_hydro',
      stageId: 'stage_overdue_urgent',
      status: 'rejected',
      createdAt: '2026-07-06T09:00:00.000Z',
      updatedAt: '2026-07-06T10:00:00.000Z',
      approvedAt: null,
      markedSentAt: null,
    },
  ],
  timelineEvents: [
    {
      eventId: 'timeline_feedback',
      eventType: 'manual_feedback_recorded',
      riskLevel: 'urgent',
      occurredAt: '2026-07-07T11:00:00.000Z',
    },
    {
      eventId: 'timeline_draft_created',
      eventType: 'message_draft_created',
      riskLevel: 'normal',
      occurredAt: '2026-07-07T09:00:00.000Z',
    },
  ],
  messageDeliveries: [
    {
      deliveryId: 'delivery_sent',
      customerId: 'customer_demo',
      followUpTaskId: 'task_today_due',
      messageDraftId: 'draft_pending_send',
      channelType: 'mock',
      deliveryMode: 'mock',
      recipientRef: 'customer:customer_demo',
      contentSnapshot: '低敏人工确认内容快照',
      status: 'mock_sent',
      failureReason: null,
      createdAt: '2026-07-07T10:00:00.000Z',
      sentAt: '2026-07-07T10:00:00.000Z',
      updatedAt: '2026-07-07T10:00:00.000Z',
      weComMockReachOut: null,
      contactSafety: {
        code: 'allowed',
        allowed: true,
        safeReasonLabel: '触达安全校验通过，仅允许模拟发送 / 人工记录。',
        auditReason: 'contact_safety_allowed',
        boundaryLabel: '触达安全治理 / 默认关闭 / 灰度前置 / 人工确认 / 模拟发送 / 不自动发送',
      },
    },
    {
      deliveryId: 'delivery_failed',
      customerId: 'customer_demo',
      followUpTaskId: 'task_overdue_urgent',
      messageDraftId: 'draft_rejected',
      channelType: 'mock',
      deliveryMode: 'mock',
      recipientRef: 'customer:customer_demo',
      contentSnapshot: '低敏失败内容快照',
      status: 'mock_failed',
      failureReason: 'mock_failure',
      createdAt: '2026-07-07T10:05:00.000Z',
      sentAt: '2026-07-07T10:05:00.000Z',
      updatedAt: '2026-07-07T10:05:00.000Z',
      weComMockReachOut: null,
      contactSafety: {
        code: 'allowed',
        allowed: true,
        safeReasonLabel: '触达安全校验通过，仅允许模拟发送 / 人工记录。',
        auditReason: 'contact_safety_allowed',
        boundaryLabel: '触达安全治理 / 默认关闭 / 灰度前置 / 人工确认 / 模拟发送 / 不自动发送',
      },
    },
    {
      deliveryId: 'delivery_skipped',
      customerId: 'customer_demo',
      followUpTaskId: 'task_escalated',
      messageDraftId: 'draft_pending_send',
      channelType: 'manual',
      deliveryMode: 'manual',
      recipientRef: 'customer:customer_demo',
      contentSnapshot: '低敏跳过内容快照',
      status: 'skipped',
      failureReason: 'consent_missing',
      createdAt: '2026-07-07T10:10:00.000Z',
      sentAt: '2026-07-07T10:10:00.000Z',
      updatedAt: '2026-07-07T10:10:00.000Z',
      weComMockReachOut: null,
      contactSafety: {
        code: 'blocked_consent_missing',
        allowed: false,
        safeReasonLabel: '未授权触达，已跳过。',
        auditReason: 'contact_safety_consent_missing',
        boundaryLabel: '触达安全治理 / 默认关闭 / 灰度前置 / 人工确认 / 模拟发送 / 不自动发送',
      },
    },
    {
      deliveryId: 'delivery_external_disabled',
      customerId: 'customer_demo',
      followUpTaskId: 'task_completed',
      messageDraftId: 'draft_marked_sent',
      channelType: 'sms',
      deliveryMode: 'external_disabled',
      recipientRef: 'customer:customer_demo',
      contentSnapshot: '低敏外部禁用内容快照',
      status: 'external_disabled',
      failureReason: 'external_channel_disabled',
      createdAt: '2026-07-07T10:15:00.000Z',
      sentAt: '2026-07-07T10:15:00.000Z',
      updatedAt: '2026-07-07T10:15:00.000Z',
      weComMockReachOut: null,
      contactSafety: {
        code: 'blocked_external_channel_disabled',
        allowed: false,
        safeReasonLabel: '外部渠道默认关闭，已阻断。',
        auditReason: 'channel_gray_external_disabled',
        boundaryLabel: '触达安全治理 / 默认关闭 / 灰度前置 / 人工确认 / 模拟发送 / 不自动发送',
      },
    },
  ],
  weComAuthorization: mapWeComAuthorizationToDashboardView(createWeComAuthorizationRecord({
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    status: 'mock_authorized',
    occurredAt: '2026-07-07T00:00:00.000Z',
  })),
  weComCustomerContactSync: createWeComCustomerContactSyncDashboardView({
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    authorization: createWeComAuthorizationRecord({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      status: 'mock_authorized',
      occurredAt: '2026-07-07T00:00:00.000Z',
    }),
    customerSeeds: [
      {
        customerId: 'customer-a',
        customerDisplayName: '低敏客户A',
        tags: ['术后关怀', '低敏标签'],
        remarkSummary: '客户联系 mock 低敏摘要，可作为后续人工随访候选。',
        source: '术后随访低敏线索',
      },
      {
        customerId: null,
        customerDisplayName: '低敏客户B',
        mappedSystemEmployeeRef: null,
        linkedToSystemCustomer: false,
        availableForFollowUp: false,
        tags: ['未关联', '到院咨询'],
        remarkSummary: '外部联系人尚未关联系统客户。',
        source: '到院咨询低敏线索',
      },
    ],
    occurredAt: '2026-07-07T00:00:00.000Z',
  }),
};

describe('follow-up operations dashboard domain', () => {
  it('聚合今日待随访、逾期、高风险、升级、草稿和人工反馈', () => {
    expect(getFollowUpOperationsOverview({ snapshot, now })).toEqual({
      activeEnrollmentCount: 1,
      todayDueTaskCount: 2,
      overdueTaskCount: 2,
      pendingTaskCount: 2,
      completedTaskCount: 1,
      escalatedTaskCount: 1,
      highRiskTaskCount: 2,
      draftCount: 3,
      approvedDraftCount: 1,
      markedSentCount: 1,
      approvedButNotMarkedSentCount: 1,
      messageDeliveryCount: 4,
      mockSentCount: 1,
      mockFailedCount: 1,
      skippedCount: 1,
      externalDisabledCount: 1,
      contactSafetyAllowedCount: 2,
      consentMissingBlockedCount: 1,
      optOutBlockedCount: 0,
      frequencyCapBlockedCount: 0,
      channelDisabledCount: 1,
      grayGuardBlockedCount: 0,
      manualFeedbackCount: 1,
    });
  });

  it('按路径模板返回固定低敏聚合并计算完成率', () => {
    const pathPerformance = getFollowUpPathPerformance({ snapshot, now });
    const hydro = pathPerformance.find((item) => item.templateKey === 'hydro_injection_care');
    const photo = pathPerformance.find((item) => item.templateKey === 'photoelectric_care');
    const skin = pathPerformance.find((item) => item.templateKey === 'skin_management');

    expect(pathPerformance).toHaveLength(4);
    expect(hydro).toEqual(expect.objectContaining({
      pathName: '水光术后管理',
      activeEnrollmentCount: 1,
      generatedTaskCount: 2,
      pendingTaskCount: 2,
      completedTaskCount: 0,
      overdueTaskCount: 1,
      completionRate: 0,
      nextDueAt: '2026-07-06T08:00:00.000Z',
    }));
    expect(photo).toEqual(expect.objectContaining({
      pathName: '光电术后管理',
      generatedTaskCount: 1,
      completedTaskCount: 1,
      completionRate: 100,
    }));
    expect(skin).toEqual(expect.objectContaining({
      pathName: '皮肤管理',
      activeEnrollmentCount: 0,
      generatedTaskCount: 0,
      completionRate: 0,
      nextDueAt: null,
    }));
  });

  it('按 handlerRole 聚合角色工作量且不引入个人负责人字段', () => {
    expect(getFollowUpTaskWorkload({ snapshot, now })).toEqual(expect.arrayContaining([
      {
        handlerRole: 'customer_service',
        assignedUserId: null,
        pendingTaskCount: 1,
        overdueTaskCount: 0,
        completedTaskCount: 1,
        escalatedTaskCount: 0,
      },
      {
        handlerRole: 'medical_assistant',
        assignedUserId: null,
        pendingTaskCount: 1,
        overdueTaskCount: 1,
        completedTaskCount: 0,
        escalatedTaskCount: 0,
      },
    ]));
  });

  it('聚合草稿状态和风险状态', () => {
    expect(getFollowUpDraftOperationsSummary(snapshot)).toEqual({
      draftCount: 3,
      approvedDraftCount: 1,
      rejectedDraftCount: 1,
      markedSentCount: 1,
      approvedButNotMarkedSentCount: 1,
    });
    expect(getFollowUpMessageDeliveryOperationsSummary(snapshot)).toEqual(expect.objectContaining({
      messageDeliveryCount: 4,
      mockSentCount: 1,
      mockFailedCount: 1,
      skippedCount: 1,
      externalDisabledCount: 1,
    }));
    expect(buildFollowUpOperationsDashboard({ snapshot, now }).contactSafety).toEqual({
      allowedCount: 2,
      consentMissingBlockedCount: 1,
      optOutBlockedCount: 0,
      frequencyCapBlockedCount: 0,
      channelDisabledCount: 1,
      tenantGrayBlockedCount: 0,
      institutionGrayBlockedCount: 0,
      grayGuardBlockedCount: 0,
    });
    expect(buildFollowUpOperationsDashboard({ snapshot, now }).weComAuthorization).toEqual(expect.objectContaining({
      accessTitle: '企业微信客户运营接入',
      notLoginTitle: '不是企业微信登录',
      status: 'mock_authorized',
      statusLabel: '模拟已授权',
      isMockAuthorized: true,
      customerContactAuthorized: true,
      externalContactSyncAuthorized: true,
      weComReachOutAuthorized: true,
      sessionArchivePostponed: true,
      defaultClosed: true,
      allowRealSend: false,
      notConnectedToRealWeCom: true,
      notWeComServiceApplied: true,
      requiresHumanApprovalAndMessageDelivery: true,
    }));
    expect(buildFollowUpOperationsDashboard({ snapshot, now }).weComCustomerContactSync).toEqual(expect.objectContaining({
      title: '企业微信客户联系 mock 同步',
      status: 'mock_synced',
      statusLabel: '模拟已同步',
      externalContactCount: 2,
      linkedSystemCustomerCount: 1,
      unlinkedCustomerCount: 1,
      availableForFollowUpCount: 1,
      mappedOwnerEmployeeCount: 1,
      unmappedOwnerEmployeeCount: 1,
      notWeComLogin: true,
      notPersonalWechatFriendSync: true,
      notChatHistorySync: true,
      notConnectedToRealWeCom: true,
      noRealOutbound: true,
      noRealCustomerSync: true,
    }));
    expect(buildFollowUpOperationsDashboard({ snapshot, now }).weComCustomerContactSync.contacts[0]).toEqual(expect.objectContaining({
      notPersonalWechatFriend: true,
      noChatHistorySynced: true,
      linkedToSystemCustomer: true,
      availableForFollowUp: true,
    }));
    expect(getFollowUpRiskSummary({ snapshot, now })).toEqual({
      escalatedTaskCount: 1,
      highRiskTaskCount: 2,
      highRiskPendingTaskCount: 1,
      overdueHighRiskTaskCount: 2,
      manualFeedbackCount: 1,
    });
  });

  it('空数据返回 0 值结构且不暴露敏感字段', () => {
    const dashboard = buildFollowUpOperationsDashboard({
      snapshot: { tasks: [], enrollments: [], stages: [], drafts: [], timelineEvents: [], messageDeliveries: [] },
      now,
    });
    const serialized = JSON.stringify(dashboard);

    expect(dashboard.overview.todayDueTaskCount).toBe(0);
    expect(dashboard.pathPerformance).toHaveLength(4);
    expect(dashboard.workload).toEqual([]);
    expect(dashboard.draftOperations.approvedButNotMarkedSentCount).toBe(0);
    expect(dashboard.messageDeliveries.messageDeliveryCount).toBe(0);
    expect(dashboard.contactSafety.allowedCount).toBe(0);
    expect(dashboard.weComAuthorization).toEqual(expect.objectContaining({
      accessTitle: '企业微信客户运营接入',
      status: 'not_configured',
      statusLabel: '未配置',
      isMockAuthorized: false,
      defaultClosed: true,
      allowRealSend: false,
    }));
    expect(dashboard.weComAuthorization).toEqual(expect.objectContaining(getDefaultWeComAuthorizationDashboardView()));
    expect(dashboard.weComCustomerContactSync).toEqual(expect.objectContaining(getDefaultWeComCustomerContactSyncDashboardView()));
    expect(dashboard.weComCustomerContactSync).toEqual(expect.objectContaining({
      status: 'authorization_unavailable',
      externalContactCount: 0,
      notWeComLogin: true,
      notPersonalWechatFriendSync: true,
      notChatHistorySync: true,
      notConnectedToRealWeCom: true,
      noRealOutbound: true,
      noRealCustomerSync: true,
    }));
    expect(serialized).not.toMatch(
      /phoneNumber|idNumber|medicalRecordNo|\bHIS\b|provider|model|token|cost|vendor|prompt|raw|DATABASE_URL|secret/i,
    );
  });
});
