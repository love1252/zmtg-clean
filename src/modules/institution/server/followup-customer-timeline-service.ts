import type { AccessContext } from '@/modules/security/domain/access-control';
import { canAccessResource } from '@/modules/security/domain/access-control';
import type { FollowUpPathEnrollmentDto } from '@/modules/institution/domain/followup-path-enrollment';
import type { MessageDelivery } from '@/modules/institution/domain/followup-message-deliveries';
import { messageDeliveryToTimelineMetadata } from '@/modules/institution/domain/followup-message-deliveries';
import type { FollowUpMessageDraftDto } from '@/modules/institution/domain/followup-message-drafts';
import {
  containsUnsafeFollowUpTimelineText,
  mapFollowUpCustomerTimelineEventToDto,
  sanitizeFollowUpTimelineText,
  type FollowUpCustomerOverview,
  type FollowUpCustomerTimelineEvent,
  type FollowUpCustomerTimelineEventDto,
  type FollowUpCustomerTimelineEventType,
  type FollowUpCustomerTimelineSourceType,
} from '@/modules/institution/domain/followup-customer-timeline';
import type { FollowUpRiskLevel, TenantFollowUpTask } from '@/modules/institution/domain/followup-workflow';
import type { TenantBusinessRepository } from '@/modules/institution/server/tenant-business-repository';

export type FollowUpTimelineForbiddenReason =
  | 'missing_tenant'
  | 'cross_tenant_denied'
  | 'role_denied'
  | 'sensitive_detail_denied';

type TimelineRepository = Pick<
  TenantBusinessRepository,
  | 'getCustomerByTenant'
  | 'recordFollowUpCustomerTimelineEvent'
  | 'listCustomerFollowUpTimelineEvents'
  | 'getCustomerFollowUpOverview'
>;

export type RecordFollowUpTimelineEventInput = {
  context: AccessContext;
  tenantBusinessRepository: Pick<TimelineRepository, 'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'>;
  customerId: string;
  sourceType: FollowUpCustomerTimelineSourceType;
  sourceId: string;
  eventType: FollowUpCustomerTimelineEventType;
  eventTitle: string;
  safeSummary: string;
  riskLevel?: FollowUpRiskLevel | null;
  occurredAt: string;
  safeReasonCode: string;
  metadataJson?: Record<string, unknown>;
};

export type RecordFollowUpTimelineEventResult =
  | { kind: 'recorded'; event: FollowUpCustomerTimelineEventDto; deduped: boolean }
  | { kind: 'not_found' }
  | { kind: 'forbidden'; reason: FollowUpTimelineForbiddenReason };

export type ListCustomerFollowUpTimelineResult =
  | { kind: 'success'; events: FollowUpCustomerTimelineEventDto[] }
  | { kind: 'not_found' }
  | { kind: 'forbidden'; reason: FollowUpTimelineForbiddenReason };

export type GetCustomerFollowUpOverviewResult =
  | { kind: 'success'; overview: FollowUpCustomerOverview }
  | { kind: 'not_found' }
  | { kind: 'forbidden'; reason: FollowUpTimelineForbiddenReason };

function canUseFollowUpTimeline(context: AccessContext, action: 'read_own_tenant' | 'create') {
  return canAccessResource({
    context,
    resource: 'follow_up',
    action,
    targetTenantId: context.tenantId,
  });
}

function hasTenant(context: AccessContext): context is AccessContext & { tenantId: string } {
  return Boolean(context.tenantId);
}

function visibleEventSummary(summary: string) {
  return sanitizeFollowUpTimelineText(summary, '低敏随访执行记录。', 240);
}

function visibleEventTitle(title: string) {
  return sanitizeFollowUpTimelineText(title, '随访执行记录', 160);
}

function safeSourceId(sourceId: string) {
  return sanitizeFollowUpTimelineText(sourceId, 'manual', 96);
}

const unsafeMetadataKeyPattern =
  /provider|model|token|vendor|cost|prompt|raw|secret|api[_-]?key|base[_-]?url/iu;

function safeMetadata(input: Record<string, unknown> | undefined) {
  const entries = Object.entries(input ?? {}).flatMap(([key, value]) => {
    const safeKey = key.normalize('NFKC').replace(/\s+/gu, '').trim().slice(0, 64);
    if (!safeKey || unsafeMetadataKeyPattern.test(safeKey) || containsUnsafeFollowUpTimelineText(safeKey)) {
      return [];
    }

    if (typeof value === 'string') {
      const safeValue = sanitizeFollowUpTimelineText(value, '', 160);
      return safeValue ? [[safeKey, safeValue]] : [];
    }

    if (['number', 'boolean'].includes(typeof value) || value === null) {
      return [[safeKey, value]];
    }

    return [];
  });

  return Object.fromEntries(entries);
}

async function getVisibleCustomer(input: {
  context: AccessContext & { tenantId: string };
  tenantBusinessRepository: Pick<TimelineRepository, 'getCustomerByTenant'>;
  customerId: string;
}) {
  return input.tenantBusinessRepository.getCustomerByTenant({
    tenantId: input.context.tenantId,
    id: input.customerId,
  });
}

export async function recordFollowUpTimelineEvent(
  input: RecordFollowUpTimelineEventInput,
): Promise<RecordFollowUpTimelineEventResult> {
  const decision = canUseFollowUpTimeline(input.context, 'create');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };

  const customer = await getVisibleCustomer({
    context: input.context,
    tenantBusinessRepository: input.tenantBusinessRepository,
    customerId: input.customerId,
  });
  if (!customer) return { kind: 'not_found' };

  const result = await input.tenantBusinessRepository.recordFollowUpCustomerTimelineEvent({
    id: globalThis.crypto.randomUUID(),
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
    customerId: input.customerId,
    sourceType: input.sourceType,
    sourceId: safeSourceId(input.sourceId),
    eventType: input.eventType,
    eventTitle: visibleEventTitle(input.eventTitle),
    safeSummary: visibleEventSummary(input.safeSummary),
    riskLevel: input.riskLevel ?? null,
    occurredAt: input.occurredAt,
    safeActorRole: input.context.role,
    safeReasonCode: sanitizeFollowUpTimelineText(input.safeReasonCode, 'follow_up_timeline_event', 96),
    metadataJson: safeMetadata(input.metadataJson),
  });

  if (result.kind === 'customer_not_found') return { kind: 'not_found' };

  return {
    kind: 'recorded',
    event: mapFollowUpCustomerTimelineEventToDto(result.event),
    deduped: result.kind === 'exists',
  };
}

async function safelyRecordFollowUpTimelineEvent(input: RecordFollowUpTimelineEventInput) {
  try {
    await recordFollowUpTimelineEvent(input);
  } catch {
    // Timeline 是低敏复盘记录，写入失败不阻断主业务状态流转。
  }
}

export function recordPathEnrollmentTimelineEvent(input: {
  context: AccessContext;
  tenantBusinessRepository: Pick<TimelineRepository, 'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'>;
  enrollment: FollowUpPathEnrollmentDto;
  eventType: 'followup_path_enrolled' | 'followup_path_cancelled';
  occurredAt: string;
}) {
  return safelyRecordFollowUpTimelineEvent({
    context: input.context,
    tenantBusinessRepository: input.tenantBusinessRepository,
    customerId: input.enrollment.customerId,
    sourceType: 'path_enrollment',
    sourceId: input.enrollment.enrollmentId,
    eventType: input.eventType,
    eventTitle: input.eventType === 'followup_path_enrolled' ? '纳入随访路径' : '取消随访路径',
    safeSummary: `${input.enrollment.customerDisplayName} ${input.eventType === 'followup_path_enrolled' ? '已纳入' : '已取消'} ${input.enrollment.templateKey}，阶段 ${input.enrollment.stageCount} 个，任务 ${input.enrollment.taskCount} 个。`,
    riskLevel: null,
    occurredAt: input.occurredAt,
    safeReasonCode: input.eventType,
    metadataJson: {
      templateKey: input.enrollment.templateKey,
      status: input.enrollment.status,
      stageCount: input.enrollment.stageCount,
      taskCount: input.enrollment.taskCount,
      forbidAutoReachOut: true,
    },
  });
}

export function recordFollowUpTasksGeneratedTimelineEvent(input: {
  context: AccessContext;
  tenantBusinessRepository: Pick<TimelineRepository, 'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'>;
  enrollment: FollowUpPathEnrollmentDto;
  occurredAt: string;
}) {
  return safelyRecordFollowUpTimelineEvent({
    context: input.context,
    tenantBusinessRepository: input.tenantBusinessRepository,
    customerId: input.enrollment.customerId,
    sourceType: 'path_enrollment',
    sourceId: `${input.enrollment.enrollmentId}:tasks_generated`,
    eventType: 'followup_tasks_generated',
    eventTitle: '生成阶段随访任务',
    safeSummary: `已按 ${input.enrollment.templateKey} 生成 ${input.enrollment.taskCount} 个人工随访任务，不会自动联系客户。`,
    riskLevel: null,
    occurredAt: input.occurredAt,
    safeReasonCode: 'followup_tasks_generated',
    metadataJson: {
      templateKey: input.enrollment.templateKey,
      stageCount: input.enrollment.stageCount,
      taskCount: input.enrollment.taskCount,
      forbidAutoReachOut: true,
    },
  });
}

export function recordFollowUpTaskStatusTimelineEvent(input: {
  context: AccessContext;
  tenantBusinessRepository: Pick<TimelineRepository, 'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'>;
  task: TenantFollowUpTask;
  occurredAt: string;
}) {
  const isEscalated = input.task.status === 'escalated';
  return safelyRecordFollowUpTimelineEvent({
    context: input.context,
    tenantBusinessRepository: input.tenantBusinessRepository,
    customerId: input.task.customerId,
    sourceType: 'followup_task',
    sourceId: `${input.task.id}:${input.task.status}`,
    eventType: isEscalated ? 'followup_task_escalated' : 'followup_task_status_changed',
    eventTitle: isEscalated ? '随访任务风险升级' : '随访任务状态变化',
    safeSummary: `${input.task.stage} 已流转为 ${input.task.status}，仍需人工处理。`,
    riskLevel: isEscalated ? input.task.riskLevel : null,
    occurredAt: input.occurredAt,
    safeReasonCode: isEscalated ? 'followup_task_escalated' : 'followup_task_status_changed',
    metadataJson: {
      status: input.task.status,
      riskLevel: input.task.riskLevel,
      requiresHumanHandling: true,
      forbidAutoReachOut: true,
    },
  });
}

export function recordMessageDraftTimelineEvent(input: {
  context: AccessContext;
  tenantBusinessRepository: Pick<TimelineRepository, 'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'>;
  draft: FollowUpMessageDraftDto;
  eventType:
    | 'message_draft_created'
    | 'message_draft_updated'
    | 'message_draft_approved'
    | 'message_draft_rejected'
    | 'message_draft_marked_sent';
  occurredAt: string;
}) {
  const titleByEvent: Record<typeof input.eventType, string> = {
    message_draft_created: '消息草稿已生成',
    message_draft_updated: '消息草稿已编辑',
    message_draft_approved: '消息草稿已人工确认',
    message_draft_rejected: '消息草稿已拒绝',
    message_draft_marked_sent: '消息草稿标记已人工发送',
  };

  return safelyRecordFollowUpTimelineEvent({
    context: input.context,
    tenantBusinessRepository: input.tenantBusinessRepository,
    customerId: input.draft.customerId,
    sourceType: 'message_draft',
    sourceId: `${input.draft.draftId}:${input.eventType}`,
    eventType: input.eventType,
    eventTitle: titleByEvent[input.eventType],
    safeSummary: `${titleByEvent[input.eventType]}：${input.draft.safePreview}。标记已发送仅代表人工记录，不代表系统自动发送。`,
    riskLevel: null,
    occurredAt: input.occurredAt,
    safeReasonCode: input.eventType,
    metadataJson: {
      status: input.draft.status,
      channelType: input.draft.channelType,
      followUpTaskId: input.draft.followUpTaskId,
      forbidAutoSend: true,
    },
  });
}

export async function recordMessageDeliveryTimelineEvents(input: {
  context: AccessContext;
  tenantBusinessRepository: Pick<TimelineRepository, 'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'>;
  delivery: MessageDelivery;
  occurredAt: string;
}) {
  const statusTitle: Record<MessageDelivery['status'], string> = {
    pending: '受控发送记录已生成',
    mock_sent: input.delivery.contactSafetyDecision.allowed ? '触达安全校验通过' : '模拟发送成功',
    mock_failed: '模拟发送失败',
    skipped: input.delivery.failureReason === 'opt_out'
      ? '客户退订，已跳过'
      : input.delivery.failureReason === 'frequency_cap_reached'
        ? '达到频率限制，已跳过'
        : '未授权触达，已跳过',
    external_disabled: input.delivery.failureReason === 'tenant_not_allowlisted'
      ? '租户未进入灰度，已阻断'
      : input.delivery.failureReason === 'institution_not_allowlisted'
        ? '机构未进入灰度，已阻断'
        : '渠道未启用，已阻断',
  };
  const statusSummary: Record<MessageDelivery['status'], string> = {
    pending: '已在人工确认后生成受控发送记录，当前不自动发送。',
    mock_sent: '触达安全治理校验通过，但仅完成模拟发送状态记录，不代表真实企业微信或短信触达。',
    mock_failed: '模拟发送失败，失败原因使用低敏白名单记录。',
    skipped: input.delivery.contactSafetyDecision.safeReasonLabel,
    external_disabled: input.delivery.contactSafetyDecision.safeReasonLabel,
  };
  const metadataJson = messageDeliveryToTimelineMetadata(input.delivery);
  const baseSummary = `发送记录 ${input.delivery.id}：${statusSummary[input.delivery.status]} 内容快照：${input.delivery.contentSnapshot}`;

  await recordFollowUpTimelineEvent({
    context: input.context,
    tenantBusinessRepository: input.tenantBusinessRepository,
    customerId: input.delivery.customerId,
    sourceType: 'message_draft',
    sourceId: `${input.delivery.id}:created`,
    eventType: 'message_draft_marked_sent',
    eventTitle: '受控发送记录已生成',
    safeSummary: `人工确认后生成受控发送记录 ${input.delivery.id}，先做触达安全治理校验；默认关闭、灰度前置、仅模拟发送 / 人工记录，不自动发送。`,
    riskLevel: null,
    occurredAt: input.occurredAt,
    safeReasonCode: 'message_delivery_created',
    metadataJson,
  });

  if (input.delivery.status === 'pending') return;

  await recordFollowUpTimelineEvent({
    context: input.context,
    tenantBusinessRepository: input.tenantBusinessRepository,
    customerId: input.delivery.customerId,
    sourceType: 'message_draft',
    sourceId: `${input.delivery.id}:${input.delivery.status}`,
    eventType: 'message_draft_marked_sent',
    eventTitle: statusTitle[input.delivery.status],
    safeSummary: baseSummary,
    riskLevel: null,
    occurredAt: input.occurredAt,
    safeReasonCode: input.delivery.failureReason ?? `message_delivery_${input.delivery.status}`,
    metadataJson,
  });
}

export async function listCustomerFollowUpTimelineEvents(input: {
  context: AccessContext;
  customerId: string;
  tenantBusinessRepository: Pick<
    TimelineRepository,
    'getCustomerByTenant' | 'listCustomerFollowUpTimelineEvents'
  >;
}): Promise<ListCustomerFollowUpTimelineResult> {
  const decision = canUseFollowUpTimeline(input.context, 'read_own_tenant');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };

  const customer = await getVisibleCustomer({
    context: input.context,
    tenantBusinessRepository: input.tenantBusinessRepository,
    customerId: input.customerId,
  });
  if (!customer) return { kind: 'not_found' };

  const events = await input.tenantBusinessRepository.listCustomerFollowUpTimelineEvents({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
    customerId: input.customerId,
  });

  return { kind: 'success', events: events.map(mapFollowUpCustomerTimelineEventToDto) };
}

export async function getCustomerFollowUpOverview(input: {
  context: AccessContext;
  customerId: string;
  tenantBusinessRepository: Pick<TimelineRepository, 'getCustomerByTenant' | 'getCustomerFollowUpOverview'>;
}): Promise<GetCustomerFollowUpOverviewResult> {
  const decision = canUseFollowUpTimeline(input.context, 'read_own_tenant');
  if (!decision.allowed) return { kind: 'forbidden', reason: decision.reason };
  if (!hasTenant(input.context)) return { kind: 'forbidden', reason: 'missing_tenant' };

  const customer = await getVisibleCustomer({
    context: input.context,
    tenantBusinessRepository: input.tenantBusinessRepository,
    customerId: input.customerId,
  });
  if (!customer) return { kind: 'not_found' };

  const overview = await input.tenantBusinessRepository.getCustomerFollowUpOverview({
    tenantId: input.context.tenantId,
    institutionId: input.context.institutionId ?? null,
    customerId: input.customerId,
  });

  return { kind: 'success', overview };
}

export async function recordManualFollowUpFeedback(input: {
  context: AccessContext;
  customerId: string;
  safeSummary: string;
  riskLevel: FollowUpRiskLevel;
  relatedTaskId?: string | null;
  tenantBusinessRepository: Pick<TimelineRepository, 'getCustomerByTenant' | 'recordFollowUpCustomerTimelineEvent'>;
  occurredAt: string;
}): Promise<RecordFollowUpTimelineEventResult> {
  return recordFollowUpTimelineEvent({
    context: input.context,
    tenantBusinessRepository: input.tenantBusinessRepository,
    customerId: input.customerId,
    sourceType: 'manual_note',
    sourceId: `manual:${input.customerId}:${input.occurredAt}`,
    eventType: 'manual_feedback_recorded',
    eventTitle: '人工反馈 / 备注',
    safeSummary: input.safeSummary,
    riskLevel: input.riskLevel,
    occurredAt: input.occurredAt,
    safeReasonCode: 'manual_feedback_recorded',
    metadataJson: {
      relatedTaskId: input.relatedTaskId ?? null,
      requiresHumanHandling: true,
    },
  });
}
