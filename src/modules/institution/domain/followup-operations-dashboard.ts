import type { FollowUpCustomerTimelineEventType } from '@/modules/institution/domain/followup-customer-timeline';
import type { MessageDeliveryDto } from '@/modules/institution/domain/followup-message-deliveries';
import type { FollowUpMessageDraftStatus } from '@/modules/institution/domain/followup-message-drafts';
import type {
  FollowUpRiskLevel,
  FollowUpStatus,
} from '@/modules/institution/domain/followup-workflow';
import {
  treatmentPathTemplateKeys,
  type TreatmentPathHandlerRole,
  type TreatmentPathTemplateKey,
} from '@/modules/institution/domain/treatment-path-templates';

export type FollowUpOperationsTaskRecord = {
  taskId: string;
  status: FollowUpStatus;
  dueAt: string;
  riskLevel: FollowUpRiskLevel;
};

export type FollowUpOperationsEnrollmentRecord = {
  enrollmentId: string;
  templateKey: TreatmentPathTemplateKey;
  status: 'active' | 'completed' | 'cancelled';
};

export type FollowUpOperationsStageRecord = {
  stageId: string;
  enrollmentId: string;
  followUpTaskId: string | null;
  handlerRole: TreatmentPathHandlerRole;
  status: FollowUpStatus;
  dueAt: string;
  riskLevel: FollowUpRiskLevel;
};

export type FollowUpOperationsDraftRecord = {
  draftId: string;
  followUpTaskId: string;
  enrollmentId: string | null;
  stageId: string | null;
  status: FollowUpMessageDraftStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  markedSentAt: string | null;
};

export type FollowUpOperationsTimelineRecord = {
  eventId: string;
  eventType: FollowUpCustomerTimelineEventType;
  riskLevel: FollowUpRiskLevel | null;
  occurredAt: string;
};

export type FollowUpOperationsMessageDeliveryRecord = Pick<
  MessageDeliveryDto,
  | 'deliveryId'
  | 'customerId'
  | 'followUpTaskId'
  | 'messageDraftId'
  | 'channelType'
  | 'deliveryMode'
  | 'recipientRef'
  | 'contentSnapshot'
  | 'status'
  | 'failureReason'
  | 'createdAt'
  | 'sentAt'
  | 'updatedAt'
  | 'contactSafety'
>;

export type FollowUpOperationsSnapshot = {
  tasks: FollowUpOperationsTaskRecord[];
  enrollments: FollowUpOperationsEnrollmentRecord[];
  stages: FollowUpOperationsStageRecord[];
  drafts: FollowUpOperationsDraftRecord[];
  timelineEvents: FollowUpOperationsTimelineRecord[];
  messageDeliveries: FollowUpOperationsMessageDeliveryRecord[];
};

export type FollowUpOperationsOverview = {
  activeEnrollmentCount: number;
  todayDueTaskCount: number;
  overdueTaskCount: number;
  pendingTaskCount: number;
  completedTaskCount: number;
  escalatedTaskCount: number;
  highRiskTaskCount: number;
  draftCount: number;
  approvedDraftCount: number;
  markedSentCount: number;
  approvedButNotMarkedSentCount: number;
  messageDeliveryCount: number;
  mockSentCount: number;
  mockFailedCount: number;
  skippedCount: number;
  externalDisabledCount: number;
  contactSafetyAllowedCount: number;
  consentMissingBlockedCount: number;
  optOutBlockedCount: number;
  frequencyCapBlockedCount: number;
  channelDisabledCount: number;
  grayGuardBlockedCount: number;
  manualFeedbackCount: number;
};

export type FollowUpPathPerformanceItem = {
  templateKey: TreatmentPathTemplateKey;
  pathName: string;
  activeEnrollmentCount: number;
  generatedTaskCount: number;
  pendingTaskCount: number;
  completedTaskCount: number;
  overdueTaskCount: number;
  escalatedTaskCount: number;
  completionRate: number;
  nextDueAt: string | null;
};

export type FollowUpTaskWorkloadItem = {
  handlerRole: TreatmentPathHandlerRole | 'unassigned';
  assignedUserId: string | null;
  pendingTaskCount: number;
  overdueTaskCount: number;
  completedTaskCount: number;
  escalatedTaskCount: number;
};

export type FollowUpDraftOperationsSummary = {
  draftCount: number;
  approvedDraftCount: number;
  rejectedDraftCount: number;
  markedSentCount: number;
  approvedButNotMarkedSentCount: number;
};

export type FollowUpMessageDeliveryOperationsSummary = {
  messageDeliveryCount: number;
  mockSentCount: number;
  mockFailedCount: number;
  skippedCount: number;
  externalDisabledCount: number;
  recentDeliveries: FollowUpOperationsMessageDeliveryRecord[];
};

export type FollowUpContactSafetyOperationsSummary = {
  allowedCount: number;
  consentMissingBlockedCount: number;
  optOutBlockedCount: number;
  frequencyCapBlockedCount: number;
  channelDisabledCount: number;
  tenantGrayBlockedCount: number;
  institutionGrayBlockedCount: number;
  grayGuardBlockedCount: number;
};

export type FollowUpRiskSummary = {
  escalatedTaskCount: number;
  highRiskTaskCount: number;
  highRiskPendingTaskCount: number;
  overdueHighRiskTaskCount: number;
  manualFeedbackCount: number;
};

export type FollowUpOperationsDashboard = {
  overview: FollowUpOperationsOverview;
  pathPerformance: FollowUpPathPerformanceItem[];
  workload: FollowUpTaskWorkloadItem[];
  draftOperations: FollowUpDraftOperationsSummary;
  messageDeliveries: FollowUpMessageDeliveryOperationsSummary;
  contactSafety: FollowUpContactSafetyOperationsSummary;
  riskSummary: FollowUpRiskSummary;
};

const pathNameByTemplateKey: Record<TreatmentPathTemplateKey, string> = {
  hydro_injection_care: '水光术后管理',
  photoelectric_care: '光电术后管理',
  post_surgery_repair: '术后修复',
  skin_management: '皮肤管理',
};

const pendingStatuses = new Set<FollowUpStatus>(['scheduled', 'due', 'in_progress']);
const actionableStatuses = new Set<FollowUpStatus>([
  'scheduled',
  'due',
  'in_progress',
  'escalated',
]);

function timestamp(input: string) {
  const parsed = Date.parse(input);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPendingStatus(status: FollowUpStatus) {
  return pendingStatuses.has(status);
}

function isActionableStatus(status: FollowUpStatus) {
  return actionableStatuses.has(status);
}

function startOfUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function isTodayDue(input: { status: FollowUpStatus; dueAt: string; now: Date }) {
  if (!isActionableStatus(input.status)) return false;
  const dueTimestamp = timestamp(input.dueAt);
  if (dueTimestamp === null) return false;
  const dayStart = startOfUtcDay(input.now);
  const nextDayStart = dayStart + 24 * 60 * 60 * 1000;

  return dueTimestamp >= dayStart && dueTimestamp < nextDayStart;
}

function isOverdue(input: { status: FollowUpStatus; dueAt: string; now: Date }) {
  if (!isActionableStatus(input.status)) return false;
  const dueTimestamp = timestamp(input.dueAt);
  return dueTimestamp !== null && dueTimestamp < input.now.getTime();
}

function roundRate(input: number) {
  return Math.round(input * 10000) / 100;
}

function taskById(tasks: readonly FollowUpOperationsTaskRecord[]) {
  return new Map(tasks.map((task) => [task.taskId, task]));
}

function effectiveStageTask(input: {
  stage: FollowUpOperationsStageRecord;
  tasksById: ReadonlyMap<string, FollowUpOperationsTaskRecord>;
}): FollowUpOperationsTaskRecord {
  const task = input.stage.followUpTaskId
    ? input.tasksById.get(input.stage.followUpTaskId)
    : null;

  return task ?? {
    taskId: input.stage.followUpTaskId ?? input.stage.stageId,
    status: input.stage.status,
    dueAt: input.stage.dueAt,
    riskLevel: input.stage.riskLevel,
  };
}

function contactSafetySummaryFromDeliveries(
  deliveries: readonly FollowUpOperationsMessageDeliveryRecord[],
): FollowUpContactSafetyOperationsSummary {
  const consentMissingBlockedCount = deliveries.filter((delivery) => delivery.failureReason === 'consent_missing').length;
  const optOutBlockedCount = deliveries.filter((delivery) => delivery.failureReason === 'opt_out').length;
  const frequencyCapBlockedCount = deliveries.filter((delivery) => delivery.failureReason === 'frequency_cap_reached').length;
  const tenantGrayBlockedCount = deliveries.filter((delivery) => delivery.failureReason === 'tenant_not_allowlisted').length;
  const institutionGrayBlockedCount = deliveries.filter((delivery) => delivery.failureReason === 'institution_not_allowlisted').length;
  const channelDisabledCount = deliveries.filter((delivery) => (
    delivery.status === 'external_disabled' &&
    (delivery.failureReason === 'channel_disabled' || delivery.failureReason === 'external_channel_disabled')
  )).length;

  return {
    allowedCount: deliveries.filter((delivery) => delivery.contactSafety.allowed).length,
    consentMissingBlockedCount,
    optOutBlockedCount,
    frequencyCapBlockedCount,
    channelDisabledCount,
    tenantGrayBlockedCount,
    institutionGrayBlockedCount,
    grayGuardBlockedCount: tenantGrayBlockedCount + institutionGrayBlockedCount,
  };
}

export function getFollowUpOperationsOverview(input: {
  snapshot: FollowUpOperationsSnapshot;
  now: Date;
}): FollowUpOperationsOverview {
  const { snapshot, now } = input;
  const contactSafety = contactSafetySummaryFromDeliveries(snapshot.messageDeliveries);

  return {
    activeEnrollmentCount: snapshot.enrollments.filter((item) => item.status === 'active').length,
    todayDueTaskCount: snapshot.tasks.filter((task) => isTodayDue({ ...task, now })).length,
    overdueTaskCount: snapshot.tasks.filter((task) => isOverdue({ ...task, now })).length,
    pendingTaskCount: snapshot.tasks.filter((task) => isPendingStatus(task.status)).length,
    completedTaskCount: snapshot.tasks.filter((task) => task.status === 'completed').length,
    escalatedTaskCount: snapshot.tasks.filter((task) => task.status === 'escalated').length,
    highRiskTaskCount: snapshot.tasks.filter((task) => task.riskLevel === 'urgent').length,
    draftCount: snapshot.drafts.length,
    approvedDraftCount: snapshot.drafts.filter((draft) => draft.status === 'approved').length,
    markedSentCount: snapshot.drafts.filter((draft) => draft.status === 'marked_sent').length,
    approvedButNotMarkedSentCount: snapshot.drafts.filter((draft) => draft.status === 'approved').length,
    messageDeliveryCount: snapshot.messageDeliveries.length,
    mockSentCount: snapshot.messageDeliveries.filter((delivery) => delivery.status === 'mock_sent').length,
    mockFailedCount: snapshot.messageDeliveries.filter((delivery) => delivery.status === 'mock_failed').length,
    skippedCount: snapshot.messageDeliveries.filter((delivery) => delivery.status === 'skipped').length,
    externalDisabledCount: snapshot.messageDeliveries.filter((delivery) => delivery.status === 'external_disabled').length,
    contactSafetyAllowedCount: contactSafety.allowedCount,
    consentMissingBlockedCount: contactSafety.consentMissingBlockedCount,
    optOutBlockedCount: contactSafety.optOutBlockedCount,
    frequencyCapBlockedCount: contactSafety.frequencyCapBlockedCount,
    channelDisabledCount: contactSafety.channelDisabledCount,
    grayGuardBlockedCount: contactSafety.grayGuardBlockedCount,
    manualFeedbackCount: snapshot.timelineEvents.filter(
      (event) => event.eventType === 'manual_feedback_recorded',
    ).length,
  };
}

export function getFollowUpPathPerformance(input: {
  snapshot: FollowUpOperationsSnapshot;
  now: Date;
}): FollowUpPathPerformanceItem[] {
  const { snapshot, now } = input;
  const tasksById = taskById(snapshot.tasks);
  const templateKeys = treatmentPathTemplateKeys;

  return templateKeys
    .map((templateKey) => {
      const enrollments = snapshot.enrollments.filter((item) => item.templateKey === templateKey);
      const enrollmentIds = new Set(enrollments.map((item) => item.enrollmentId));
      const stages = snapshot.stages.filter((stage) => enrollmentIds.has(stage.enrollmentId));
      const effectiveTasks = stages.map((stage) => effectiveStageTask({ stage, tasksById }));
      const generatedTaskCount = effectiveTasks.length;
      const completedTaskCount = effectiveTasks.filter((task) => task.status === 'completed').length;
      const dueCandidates = effectiveTasks
        .filter((task) => isActionableStatus(task.status))
        .sort((left, right) => (timestamp(left.dueAt) ?? 0) - (timestamp(right.dueAt) ?? 0));

      return {
        templateKey,
        pathName: pathNameByTemplateKey[templateKey],
        activeEnrollmentCount: enrollments.filter((item) => item.status === 'active').length,
        generatedTaskCount,
        pendingTaskCount: effectiveTasks.filter((task) => isPendingStatus(task.status)).length,
        completedTaskCount,
        overdueTaskCount: effectiveTasks.filter((task) => isOverdue({ ...task, now })).length,
        escalatedTaskCount: effectiveTasks.filter((task) => task.status === 'escalated').length,
        completionRate: generatedTaskCount > 0 ? roundRate(completedTaskCount / generatedTaskCount) : 0,
        nextDueAt: dueCandidates[0]?.dueAt ?? null,
      } satisfies FollowUpPathPerformanceItem;
    })
    .sort((left, right) => left.pathName.localeCompare(right.pathName, 'zh-Hans-CN'));
}

export function getFollowUpTaskWorkload(input: {
  snapshot: FollowUpOperationsSnapshot;
  now: Date;
}): FollowUpTaskWorkloadItem[] {
  const tasksById = taskById(input.snapshot.tasks);
  const grouped = new Map<FollowUpTaskWorkloadItem['handlerRole'], FollowUpTaskWorkloadItem>();

  for (const stage of input.snapshot.stages) {
    const task = effectiveStageTask({ stage, tasksById });
    const current = grouped.get(stage.handlerRole) ?? {
      handlerRole: stage.handlerRole,
      assignedUserId: null,
      pendingTaskCount: 0,
      overdueTaskCount: 0,
      completedTaskCount: 0,
      escalatedTaskCount: 0,
    };

    if (isPendingStatus(task.status)) current.pendingTaskCount += 1;
    if (isOverdue({ ...task, now: input.now })) current.overdueTaskCount += 1;
    if (task.status === 'completed') current.completedTaskCount += 1;
    if (task.status === 'escalated') current.escalatedTaskCount += 1;
    grouped.set(stage.handlerRole, current);
  }

  return [...grouped.values()].sort((left, right) => left.handlerRole.localeCompare(right.handlerRole));
}

export function getFollowUpDraftOperationsSummary(
  snapshot: FollowUpOperationsSnapshot,
): FollowUpDraftOperationsSummary {
  return {
    draftCount: snapshot.drafts.length,
    approvedDraftCount: snapshot.drafts.filter((draft) => draft.status === 'approved').length,
    rejectedDraftCount: snapshot.drafts.filter((draft) => draft.status === 'rejected').length,
    markedSentCount: snapshot.drafts.filter((draft) => draft.status === 'marked_sent').length,
    approvedButNotMarkedSentCount: snapshot.drafts.filter((draft) => draft.status === 'approved').length,
  };
}

export function getFollowUpMessageDeliveryOperationsSummary(
  snapshot: FollowUpOperationsSnapshot,
): FollowUpMessageDeliveryOperationsSummary {
  return {
    messageDeliveryCount: snapshot.messageDeliveries.length,
    mockSentCount: snapshot.messageDeliveries.filter((delivery) => delivery.status === 'mock_sent').length,
    mockFailedCount: snapshot.messageDeliveries.filter((delivery) => delivery.status === 'mock_failed').length,
    skippedCount: snapshot.messageDeliveries.filter((delivery) => delivery.status === 'skipped').length,
    externalDisabledCount: snapshot.messageDeliveries.filter((delivery) => delivery.status === 'external_disabled').length,
    recentDeliveries: [...snapshot.messageDeliveries]
      .sort((left, right) => (timestamp(right.updatedAt) ?? 0) - (timestamp(left.updatedAt) ?? 0))
      .slice(0, 6),
  };
}

export function getFollowUpContactSafetyOperationsSummary(
  snapshot: FollowUpOperationsSnapshot,
): FollowUpContactSafetyOperationsSummary {
  return contactSafetySummaryFromDeliveries(snapshot.messageDeliveries);
}

export function getFollowUpRiskSummary(input: {
  snapshot: FollowUpOperationsSnapshot;
  now: Date;
}): FollowUpRiskSummary {
  const { snapshot, now } = input;

  return {
    escalatedTaskCount: snapshot.tasks.filter((task) => task.status === 'escalated').length,
    highRiskTaskCount: snapshot.tasks.filter((task) => task.riskLevel === 'urgent').length,
    highRiskPendingTaskCount: snapshot.tasks.filter(
      (task) => task.riskLevel === 'urgent' && isPendingStatus(task.status),
    ).length,
    overdueHighRiskTaskCount: snapshot.tasks.filter(
      (task) => task.riskLevel === 'urgent' && isOverdue({ ...task, now }),
    ).length,
    manualFeedbackCount: snapshot.timelineEvents.filter(
      (event) => event.eventType === 'manual_feedback_recorded',
    ).length,
  };
}

export function buildFollowUpOperationsDashboard(input: {
  snapshot: FollowUpOperationsSnapshot;
  now: Date;
}): FollowUpOperationsDashboard {
  return {
    overview: getFollowUpOperationsOverview(input),
    pathPerformance: getFollowUpPathPerformance(input),
    workload: getFollowUpTaskWorkload(input),
    draftOperations: getFollowUpDraftOperationsSummary(input.snapshot),
    messageDeliveries: getFollowUpMessageDeliveryOperationsSummary(input.snapshot),
    contactSafety: getFollowUpContactSafetyOperationsSummary(input.snapshot),
    riskSummary: getFollowUpRiskSummary(input),
  };
}
