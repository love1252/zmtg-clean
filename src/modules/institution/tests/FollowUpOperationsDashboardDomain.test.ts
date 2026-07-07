import { describe, expect, it } from 'vitest';
import {
  buildFollowUpOperationsDashboard,
  getFollowUpDraftOperationsSummary,
  getFollowUpOperationsOverview,
  getFollowUpPathPerformance,
  getFollowUpRiskSummary,
  getFollowUpTaskWorkload,
  type FollowUpOperationsSnapshot,
} from '@/modules/institution/domain/followup-operations-dashboard';

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
      snapshot: { tasks: [], enrollments: [], stages: [], drafts: [], timelineEvents: [] },
      now,
    });
    const serialized = JSON.stringify(dashboard);

    expect(dashboard.overview.todayDueTaskCount).toBe(0);
    expect(dashboard.pathPerformance).toHaveLength(4);
    expect(dashboard.workload).toEqual([]);
    expect(dashboard.draftOperations.approvedButNotMarkedSentCount).toBe(0);
    expect(serialized).not.toMatch(
      /tenantId|institutionId|phoneNumber|idNumber|medicalRecordNo|HIS|provider|model|token|cost|vendor|prompt|raw|DATABASE_URL|secret/i,
    );
  });
});
