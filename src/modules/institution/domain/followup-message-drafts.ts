import type { TenantFollowUpTask } from '@/modules/institution/domain/followup-workflow';
import type { TreatmentPathTemplateKey } from '@/modules/institution/domain/treatment-path-templates';

export const followUpMessageTemplateTypes = [
  'post_care',
  'revisit',
  'risk_check',
  'manual',
] as const;

export const followUpMessageDraftStatuses = [
  'draft',
  'approved',
  'rejected',
  'marked_sent',
  'cancelled',
] as const;

export type FollowUpMessageTemplateType = (typeof followUpMessageTemplateTypes)[number];
export type FollowUpMessageDraftStatus = (typeof followUpMessageDraftStatuses)[number];
export type FollowUpMessageChannelType = 'manual';
export type FollowUpMessageSafeReasonCode =
  | 'template_generated'
  | 'fallback_generated'
  | 'draft_content_updated'
  | 'draft_approved'
  | 'draft_rejected'
  | 'draft_marked_sent'
  | 'draft_cancelled';

export type FollowUpMessageTemplate = {
  id: string;
  tenantId: string | null;
  institutionId: string | null;
  templateKey: string;
  templateName: string;
  templateType: FollowUpMessageTemplateType;
  applicableTemplateKey: TreatmentPathTemplateKey | null;
  applicableNodeKey: string | null;
  channelType: FollowUpMessageChannelType;
  contentTemplate: string;
  variablesJson: Record<string, unknown>;
  status: 'active' | 'archived';
  requiresHumanApproval: true;
  forbidAutoSend: true;
  createdAt: string;
  updatedAt: string;
};

export type FollowUpMessageDraft = {
  id: string;
  tenantId: string;
  institutionId: string | null;
  followUpTaskId: string;
  enrollmentId: string | null;
  stageId: string | null;
  customerId: string;
  customerDisplayName: string;
  templateId: string | null;
  channelType: FollowUpMessageChannelType;
  status: FollowUpMessageDraftStatus;
  draftContent: string;
  editedContent: string | null;
  safePreview: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  markedSentBy: string | null;
  markedSentAt: string | null;
  safeReasonCode: FollowUpMessageSafeReasonCode;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type FollowUpMessageTemplateDto = Pick<
  FollowUpMessageTemplate,
  | 'id'
  | 'templateKey'
  | 'templateName'
  | 'templateType'
  | 'applicableTemplateKey'
  | 'applicableNodeKey'
  | 'channelType'
  | 'status'
  | 'requiresHumanApproval'
  | 'forbidAutoSend'
  | 'createdAt'
  | 'updatedAt'
> & {
  safePreview: string;
};

export type FollowUpMessageDraftDto = Pick<
  FollowUpMessageDraft,
  | 'customerId'
  | 'customerDisplayName'
  | 'channelType'
  | 'status'
  | 'safePreview'
  | 'draftContent'
  | 'editedContent'
  | 'approvedAt'
  | 'markedSentAt'
  | 'safeReasonCode'
  | 'createdAt'
  | 'updatedAt'
> & {
  draftId: string;
  followUpTaskId: string;
};

export type FollowUpTaskPathContext = {
  task: TenantFollowUpTask;
  institutionId: string | null;
  enrollmentId: string | null;
  stageId: string | null;
  templateKey: TreatmentPathTemplateKey | null;
  nodeKey: string | null;
  stageKey: string | null;
};

export const builtInFollowUpMessageTemplates: readonly FollowUpMessageTemplate[] = [
  {
    id: 'builtin-hydro-injection-post-care',
    tenantId: null,
    institutionId: null,
    templateKey: 'hydro_injection_post_care_manual',
    templateName: '水光术后人工随访问候',
    templateType: 'post_care',
    applicableTemplateKey: 'hydro_injection_care',
    applicableNodeKey: null,
    channelType: 'manual',
    contentTemplate:
      '您好，{customerDisplayName}，这里是水光术后护理提醒。今天关注「{stage}」，请留意补水、清洁和防晒情况；如有明显不适，请及时联系门店人工处理。',
    variablesJson: { allowed: ['customerDisplayName', 'stage', 'dueAt'] },
    status: 'active',
    requiresHumanApproval: true,
    forbidAutoSend: true,
    createdAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
  },
  {
    id: 'builtin-photoelectric-post-care',
    tenantId: null,
    institutionId: null,
    templateKey: 'photoelectric_post_care_manual',
    templateName: '光电术后人工随访问候',
    templateType: 'post_care',
    applicableTemplateKey: 'photoelectric_care',
    applicableNodeKey: null,
    channelType: 'manual',
    contentTemplate:
      '您好，{customerDisplayName}，这里是光电治疗后的护理提醒。关于「{stage}」，请重点观察红热、敏感和防晒执行情况；如有异常，请联系门店人工处理。',
    variablesJson: { allowed: ['customerDisplayName', 'stage', 'dueAt'] },
    status: 'active',
    requiresHumanApproval: true,
    forbidAutoSend: true,
    createdAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
  },
  {
    id: 'builtin-post-surgery-risk-check',
    tenantId: null,
    institutionId: null,
    templateKey: 'post_surgery_risk_check_manual',
    templateName: '术后修复人工风险确认',
    templateType: 'risk_check',
    applicableTemplateKey: 'post_surgery_repair',
    applicableNodeKey: null,
    channelType: 'manual',
    contentTemplate:
      '您好，{customerDisplayName}，这里是术后恢复人工关怀。今天需要确认「{stage}」，请按医护提醒观察恢复情况；如出现明显不适，请优先联系门店人工处理。',
    variablesJson: { allowed: ['customerDisplayName', 'stage', 'dueAt'] },
    status: 'active',
    requiresHumanApproval: true,
    forbidAutoSend: true,
    createdAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
  },
  {
    id: 'builtin-skin-management-revisit',
    tenantId: null,
    institutionId: null,
    templateKey: 'skin_management_revisit_manual',
    templateName: '皮肤管理人工复核提醒',
    templateType: 'revisit',
    applicableTemplateKey: 'skin_management',
    applicableNodeKey: null,
    channelType: 'manual',
    contentTemplate:
      '您好，{customerDisplayName}，这里是皮肤管理后的人工复核提醒。关于「{stage}」，请结合门店工作人员建议观察护理执行情况，如需帮助请联系门店人工处理。',
    variablesJson: { allowed: ['customerDisplayName', 'stage', 'dueAt'] },
    status: 'active',
    requiresHumanApproval: true,
    forbidAutoSend: true,
    createdAt: '2026-07-06T00:00:00.000Z',
    updatedAt: '2026-07-06T00:00:00.000Z',
  },
];

const fallbackTemplate: FollowUpMessageTemplate = {
  id: 'builtin-manual-fallback',
  tenantId: null,
  institutionId: null,
  templateKey: 'manual_fallback_followup',
  templateName: '通用人工随访草稿',
  templateType: 'manual',
  applicableTemplateKey: null,
  applicableNodeKey: null,
  channelType: 'manual',
  contentTemplate:
    '您好，{customerDisplayName}，这里是本次随访提醒。关于「{stage}」，请按工作人员提示完成护理观察；如有不适，请联系门店人工处理。',
  variablesJson: { allowed: ['customerDisplayName', 'stage', 'dueAt'] },
  status: 'active',
  requiresHumanApproval: true,
  forbidAutoSend: true,
  createdAt: '2026-07-06T00:00:00.000Z',
  updatedAt: '2026-07-06T00:00:00.000Z',
};

const disallowedContentPatterns = [
  /1[3-9]\d{9}/u,
  /\d{6}(?:19|20)\d{2}\d{2}\d{2}\d{3}[\dXx]/u,
  /\bMR[-_A-Z0-9]{3,}\b/iu,
  /\bHIS\b/iu,
  /完整治疗|完整病历|咨询全文|病历号|身份证/u,
  /\b(?:postgres|mysql|mongodb|redis):\/\//iu,
  /\b(?:provider|model|token|vendor|prompt|raw ai response|secret|api key|baseUrl)\b/iu,
  /\bselect\s+.+\s+from\b/iu,
];

function normalizeText(input: string | null | undefined, limit = 320) {
  return (input ?? '').normalize('NFKC').trim().slice(0, limit);
}

function renderTemplate(input: { template: string; values: Record<string, string> }) {
  return input.template.replace(/\{([a-zA-Z0-9_]+)\}/gu, (_match, key: string) => input.values[key] ?? '');
}

function createSafePreview(content: string) {
  const normalized = normalizeText(content.replace(/\s+/gu, ' '), 120);
  return normalized || '低敏随访草稿，需人工确认后才可使用。';
}

export function containsUnsafeFollowUpMessageContent(input: string) {
  return disallowedContentPatterns.some((pattern) => pattern.test(input));
}

export function sanitizeFollowUpMessageContent(input: string) {
  const normalized = normalizeText(input, 1000);
  if (!normalized || containsUnsafeFollowUpMessageContent(normalized)) {
    return null;
  }

  return normalized;
}

export function createDefaultFollowUpMessageTemplate(input: {
  templateKey?: TreatmentPathTemplateKey | null;
  nodeKey?: string | null;
}) {
  const exact = builtInFollowUpMessageTemplates.find(
    (template) =>
      template.applicableTemplateKey === input.templateKey &&
      template.applicableNodeKey &&
      template.applicableNodeKey === input.nodeKey,
  );
  const pathLevel = builtInFollowUpMessageTemplates.find(
    (template) => template.applicableTemplateKey === input.templateKey && !template.applicableNodeKey,
  );

  return exact ?? pathLevel ?? fallbackTemplate;
}

export function selectFollowUpMessageTemplate(input: {
  templates: readonly FollowUpMessageTemplate[];
  templateId?: string | null;
  templateKey?: TreatmentPathTemplateKey | null;
  nodeKey?: string | null;
}) {
  if (input.templateId) {
    return input.templates.find((template) => template.id === input.templateId) ?? null;
  }

  return (
    input.templates.find(
      (template) =>
        template.status === 'active' &&
        template.applicableTemplateKey === input.templateKey &&
        template.applicableNodeKey === input.nodeKey,
    ) ??
    input.templates.find(
      (template) =>
        template.status === 'active' &&
        template.applicableTemplateKey === input.templateKey &&
        !template.applicableNodeKey,
    ) ??
    null
  );
}

export function createMessageDraftForFollowUpTask(input: {
  pathContext: FollowUpTaskPathContext;
  template: FollowUpMessageTemplate | null;
  occurredAt: string;
}) {
  const template = input.template ?? createDefaultFollowUpMessageTemplate({
    templateKey: input.pathContext.templateKey,
    nodeKey: input.pathContext.nodeKey,
  });
  const task = input.pathContext.task;
  const content = renderTemplate({
    template: template.contentTemplate,
    values: {
      customerDisplayName: normalizeText(task.customerDisplayName, 40) || '客户',
      stage: normalizeText(task.stage, 80) || '随访任务',
      suggestedAction: normalizeText(task.suggestedAction, 120),
      dueAt: task.dueAt,
      templateKey: input.pathContext.templateKey ?? '',
      nodeKey: input.pathContext.nodeKey ?? '',
    },
  });
  const safeContent = sanitizeFollowUpMessageContent(content) ?? fallbackTemplate.contentTemplate.replace(
    '{customerDisplayName}',
    normalizeText(task.customerDisplayName, 40) || '客户',
  ).replace('{stage}', normalizeText(task.stage, 80) || '随访任务');

  return {
    tenantId: task.tenantId,
    institutionId: input.pathContext.institutionId,
    followUpTaskId: task.id,
    enrollmentId: input.pathContext.enrollmentId,
    stageId: input.pathContext.stageId,
    customerId: task.customerId,
    templateId: template.id.startsWith('builtin-') ? null : template.id,
    channelType: 'manual' as const,
    status: 'draft' as const,
    draftContent: safeContent,
    editedContent: null,
    safePreview: createSafePreview(safeContent),
    approvedBy: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    markedSentBy: null,
    markedSentAt: null,
    safeReasonCode: input.template ? 'template_generated' as const : 'fallback_generated' as const,
    metadataJson: {
      templateKey: input.pathContext.templateKey,
      nodeKey: input.pathContext.nodeKey,
      stageKey: input.pathContext.stageKey,
      dueAt: task.dueAt,
      source: 'follow_up_task',
      requiresHumanApproval: true,
      forbidAutoSend: true,
    },
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
}

export function updateFollowUpMessageDraftContent(input: {
  draft: FollowUpMessageDraft;
  content: string;
  occurredAt: string;
}):
  | { kind: 'updated'; draft: FollowUpMessageDraft }
  | { kind: 'unsafe_content' }
  | { kind: 'invalid_status'; status: FollowUpMessageDraftStatus } {
  if (input.draft.status !== 'draft') {
    return { kind: 'invalid_status', status: input.draft.status };
  }

  const content = sanitizeFollowUpMessageContent(input.content);
  if (!content) {
    return { kind: 'unsafe_content' };
  }

  return {
    kind: 'updated',
    draft: {
      ...input.draft,
      editedContent: content,
      safePreview: createSafePreview(content),
      safeReasonCode: 'draft_content_updated',
      updatedAt: input.occurredAt,
    },
  };
}

export function approveFollowUpMessageDraft(input: {
  draft: FollowUpMessageDraft;
  actorId: string;
  occurredAt: string;
}): { kind: 'approved'; draft: FollowUpMessageDraft } | { kind: 'invalid_status'; status: FollowUpMessageDraftStatus } {
  if (input.draft.status !== 'draft') {
    return { kind: 'invalid_status', status: input.draft.status };
  }

  return {
    kind: 'approved',
    draft: {
      ...input.draft,
      status: 'approved',
      approvedBy: input.actorId,
      approvedAt: input.occurredAt,
      safeReasonCode: 'draft_approved',
      updatedAt: input.occurredAt,
    },
  };
}

export function rejectFollowUpMessageDraft(input: {
  draft: FollowUpMessageDraft;
  actorId: string;
  occurredAt: string;
}): { kind: 'rejected'; draft: FollowUpMessageDraft } | { kind: 'invalid_status'; status: FollowUpMessageDraftStatus } {
  if (input.draft.status !== 'draft') {
    return { kind: 'invalid_status', status: input.draft.status };
  }

  return {
    kind: 'rejected',
    draft: {
      ...input.draft,
      status: 'rejected',
      rejectedBy: input.actorId,
      rejectedAt: input.occurredAt,
      safeReasonCode: 'draft_rejected',
      updatedAt: input.occurredAt,
    },
  };
}

export function markFollowUpMessageDraftAsSent(input: {
  draft: FollowUpMessageDraft;
  actorId: string;
  occurredAt: string;
}): { kind: 'marked_sent'; draft: FollowUpMessageDraft } | { kind: 'invalid_status'; status: FollowUpMessageDraftStatus } {
  if (input.draft.status !== 'approved') {
    return { kind: 'invalid_status', status: input.draft.status };
  }

  return {
    kind: 'marked_sent',
    draft: {
      ...input.draft,
      status: 'marked_sent',
      markedSentBy: input.actorId,
      markedSentAt: input.occurredAt,
      safeReasonCode: 'draft_marked_sent',
      updatedAt: input.occurredAt,
    },
  };
}

export function cancelFollowUpMessageDraft(input: {
  draft: FollowUpMessageDraft;
  actorId: string;
  occurredAt: string;
}): { kind: 'cancelled'; draft: FollowUpMessageDraft } | { kind: 'invalid_status'; status: FollowUpMessageDraftStatus } {
  if (input.draft.status !== 'draft') {
    return { kind: 'invalid_status', status: input.draft.status };
  }

  return {
    kind: 'cancelled',
    draft: {
      ...input.draft,
      status: 'cancelled',
      safeReasonCode: 'draft_cancelled',
      metadataJson: {
        ...input.draft.metadataJson,
        cancelledBy: input.actorId,
      },
      updatedAt: input.occurredAt,
    },
  };
}

export function mapFollowUpMessageTemplateToDto(
  template: FollowUpMessageTemplate,
): FollowUpMessageTemplateDto {
  return {
    id: template.id,
    templateKey: template.templateKey,
    templateName: template.templateName,
    templateType: template.templateType,
    applicableTemplateKey: template.applicableTemplateKey,
    applicableNodeKey: template.applicableNodeKey,
    channelType: template.channelType,
    status: template.status,
    requiresHumanApproval: template.requiresHumanApproval,
    forbidAutoSend: template.forbidAutoSend,
    safePreview: createSafePreview(template.contentTemplate),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

export function mapFollowUpMessageDraftToDto(draft: FollowUpMessageDraft): FollowUpMessageDraftDto {
  return {
    draftId: draft.id,
    followUpTaskId: draft.followUpTaskId,
    customerId: draft.customerId,
    customerDisplayName: draft.customerDisplayName,
    channelType: draft.channelType,
    status: draft.status,
    safePreview: draft.safePreview,
    draftContent: draft.draftContent,
    editedContent: draft.editedContent,
    approvedAt: draft.approvedAt,
    markedSentAt: draft.markedSentAt,
    safeReasonCode: draft.safeReasonCode,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}
