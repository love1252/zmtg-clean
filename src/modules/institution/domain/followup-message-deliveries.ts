import type { FollowUpMessageDraft } from '@/modules/institution/domain/followup-message-drafts';

export const messageDeliveryChannelTypes = [
  'manual',
  'mock',
  'wechat_work',
  'sms',
] as const;

export const messageDeliveryModes = [
  'manual',
  'mock',
  'external_disabled',
] as const;

export const messageDeliveryStatuses = [
  'pending',
  'mock_sent',
  'mock_failed',
  'skipped',
  'external_disabled',
] as const;

export const messageDeliveryFailureReasons = [
  'channel_disabled',
  'consent_missing',
  'opt_out',
  'frequency_cap_reached',
  'draft_not_approved',
  'recipient_unavailable',
  'mock_failure',
] as const;

export type MessageDeliveryChannelType = (typeof messageDeliveryChannelTypes)[number];
export type MessageDeliveryMode = (typeof messageDeliveryModes)[number];
export type MessageDeliveryStatus = (typeof messageDeliveryStatuses)[number];
export type MessageDeliveryFailureReason = (typeof messageDeliveryFailureReasons)[number];

export type MessageDelivery = {
  id: string;
  tenantId: string;
  institutionId: string | null;
  customerId: string;
  followUpTaskId: string;
  messageDraftId: string;
  channelType: MessageDeliveryChannelType;
  deliveryMode: MessageDeliveryMode;
  recipientRef: string;
  contentSnapshot: string;
  status: MessageDeliveryStatus;
  failureReason: MessageDeliveryFailureReason | null;
  createdBy: string;
  confirmedBy: string;
  createdAt: string;
  sentAt: string | null;
  updatedAt: string;
};

export type MessageDeliveryDto = Pick<
  MessageDelivery,
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
> & {
  deliveryId: string;
  boundaryLabel: '人工确认 / 模拟发送 / 不自动发送 / 未接真实企业微信 / 短信';
};

export type CreateMessageDeliveryOptions = {
  channelType?: MessageDeliveryChannelType;
  deliveryMode?: MessageDeliveryMode;
  status?: MessageDeliveryStatus;
  failureReason?: MessageDeliveryFailureReason | null;
};

const forbiddenDeliveryContentPatterns = [
  /1[3-9]\d{9}/u,
  /\d{6}(?:19|20)\d{2}\d{2}\d{2}\d{3}[\dXx]/u,
  /\bMR[-_A-Z0-9]{3,}\b/iu,
  /完整治疗|完整病历|咨询全文|病历号|身份证|手机号原文/u,
  /\bHIS\b|his payload|externalSystemPayload/iu,
  /\b(?:provider|model|token|vendor|cost|prompt|raw ai response|secret|api key|baseUrl)\b/iu,
  /\b(?:postgres|mysql|mongodb|redis):\/\//iu,
  /\bselect\s+.+\s+from\b/iu,
];

const deliveryStatusSet = new Set<MessageDeliveryStatus>(messageDeliveryStatuses);
const deliveryChannelTypeSet = new Set<MessageDeliveryChannelType>(messageDeliveryChannelTypes);
const deliveryModeSet = new Set<MessageDeliveryMode>(messageDeliveryModes);
const deliveryFailureReasonSet = new Set<MessageDeliveryFailureReason>(messageDeliveryFailureReasons);

function normalizeText(input: string | null | undefined, limit: number) {
  return (input ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

export function containsUnsafeMessageDeliveryText(input: string) {
  return forbiddenDeliveryContentPatterns.some((pattern) => pattern.test(input));
}

export function sanitizeMessageDeliveryText(input: string | null | undefined, fallback: string, limit = 500) {
  const normalized = normalizeText(input, limit);
  if (!normalized || containsUnsafeMessageDeliveryText(normalized)) {
    return fallback;
  }

  return normalized;
}

function deliveryIdForDraft(draftId: string) {
  return `msg-delivery:${draftId}`.slice(0, 96);
}

function recipientRefForDraft(draft: FollowUpMessageDraft) {
  return sanitizeMessageDeliveryText(`customer:${draft.customerId}`, 'customer:low-sensitive', 96);
}

function contentSnapshotForDraft(draft: FollowUpMessageDraft) {
  return sanitizeMessageDeliveryText(
    draft.editedContent || draft.draftContent || draft.safePreview,
    '低敏人工确认内容快照，未包含联系方式或外部渠道 payload。',
    500,
  );
}

function normalizeDeliveryMode(input: {
  channelType: MessageDeliveryChannelType;
  deliveryMode?: MessageDeliveryMode;
  status?: MessageDeliveryStatus;
}) {
  if (input.channelType === 'wechat_work' || input.channelType === 'sms') return 'external_disabled' as const;
  if (input.deliveryMode) return input.deliveryMode;
  if (input.status === 'pending') return 'manual' as const;
  return 'mock' as const;
}

function normalizeDeliveryStatus(input: {
  channelType: MessageDeliveryChannelType;
  deliveryMode: MessageDeliveryMode;
  status?: MessageDeliveryStatus;
}) {
  if (input.channelType === 'wechat_work' || input.channelType === 'sms') return 'external_disabled' as const;
  if (input.deliveryMode === 'external_disabled') return 'external_disabled' as const;
  return input.status ?? 'mock_sent';
}

function normalizeFailureReason(input: {
  status: MessageDeliveryStatus;
  failureReason?: MessageDeliveryFailureReason | null;
}) {
  if (input.status === 'mock_failed') return input.failureReason ?? 'mock_failure';
  if (input.status === 'skipped') return input.failureReason ?? 'consent_missing';
  if (input.status === 'external_disabled') return input.failureReason ?? 'channel_disabled';
  return null;
}

export function createMessageDeliveryFromApprovedDraft(input: {
  draft: FollowUpMessageDraft;
  actorId: string;
  occurredAt: string;
  options?: CreateMessageDeliveryOptions;
}):
  | { kind: 'created'; delivery: MessageDelivery }
  | { kind: 'invalid_status'; status: FollowUpMessageDraft['status'] } {
  if (input.draft.status !== 'approved') {
    return { kind: 'invalid_status', status: input.draft.status };
  }

  const channelType = input.options?.channelType ?? 'mock';
  const deliveryMode = normalizeDeliveryMode({
    channelType,
    deliveryMode: input.options?.deliveryMode,
    status: input.options?.status,
  });
  const status = normalizeDeliveryStatus({
    channelType,
    deliveryMode,
    status: input.options?.status,
  });
  const failureReason = normalizeFailureReason({ status, failureReason: input.options?.failureReason });
  const sentAt = status === 'pending' ? null : input.occurredAt;

  return {
    kind: 'created',
    delivery: {
      id: deliveryIdForDraft(input.draft.id),
      tenantId: input.draft.tenantId,
      institutionId: input.draft.institutionId,
      customerId: input.draft.customerId,
      followUpTaskId: input.draft.followUpTaskId,
      messageDraftId: input.draft.id,
      channelType,
      deliveryMode,
      recipientRef: recipientRefForDraft(input.draft),
      contentSnapshot: contentSnapshotForDraft(input.draft),
      status,
      failureReason,
      createdBy: input.actorId,
      confirmedBy: input.draft.approvedBy ?? input.actorId,
      createdAt: input.occurredAt,
      sentAt,
      updatedAt: input.occurredAt,
    },
  };
}

function isMessageDeliveryChannelType(input: unknown): input is MessageDeliveryChannelType {
  return typeof input === 'string' && deliveryChannelTypeSet.has(input as MessageDeliveryChannelType);
}

function isMessageDeliveryMode(input: unknown): input is MessageDeliveryMode {
  return typeof input === 'string' && deliveryModeSet.has(input as MessageDeliveryMode);
}

function isMessageDeliveryStatus(input: unknown): input is MessageDeliveryStatus {
  return typeof input === 'string' && deliveryStatusSet.has(input as MessageDeliveryStatus);
}

function isMessageDeliveryFailureReason(input: unknown): input is MessageDeliveryFailureReason {
  return typeof input === 'string' && deliveryFailureReasonSet.has(input as MessageDeliveryFailureReason);
}

function isJsonRecord(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

function stringOrNull(input: unknown, limit: number) {
  if (input === null || input === undefined) return null;
  return typeof input === 'string' ? sanitizeMessageDeliveryText(input, '', limit) || null : null;
}

function getRawDeliveryField(input: {
  metadata: Record<string, unknown>;
  objectRecord: Record<string, unknown> | null;
  objectKey: string;
  flatKey: string;
}) {
  if (input.objectRecord && Object.prototype.hasOwnProperty.call(input.objectRecord, input.objectKey)) {
    return input.objectRecord[input.objectKey];
  }

  return input.metadata[input.flatKey];
}

export function messageDeliveryToTimelineMetadata(delivery: MessageDelivery): Record<string, string | null> {
  return {
    messageDeliveryId: delivery.id,
    messageDeliveryTenantId: delivery.tenantId,
    messageDeliveryInstitutionId: delivery.institutionId,
    messageDeliveryCustomerId: delivery.customerId,
    messageDeliveryFollowUpTaskId: delivery.followUpTaskId,
    messageDeliveryDraftId: delivery.messageDraftId,
    messageDeliveryChannelType: delivery.channelType,
    messageDeliveryMode: delivery.deliveryMode,
    messageDeliveryRecipientRef: delivery.recipientRef,
    messageDeliveryContentSnapshot: delivery.contentSnapshot,
    messageDeliveryStatus: delivery.status,
    messageDeliveryFailureReason: delivery.failureReason,
    messageDeliveryCreatedBy: delivery.createdBy,
    messageDeliveryConfirmedBy: delivery.confirmedBy,
    messageDeliveryCreatedAt: delivery.createdAt,
    messageDeliverySentAt: delivery.sentAt,
    messageDeliveryUpdatedAt: delivery.updatedAt,
    requiresHumanApproval: 'true',
    forbidAutoSend: 'true',
    externalChannelEnabled: 'false',
  };
}

export function readMessageDeliveryFromMetadata(metadata: Record<string, unknown>): MessageDelivery | null {
  const objectRecord = isJsonRecord(metadata.messageDelivery) ? metadata.messageDelivery : null;
  const field = (objectKey: string, flatKey: string) => getRawDeliveryField({ metadata, objectRecord, objectKey, flatKey });

  const id = typeof field('id', 'messageDeliveryId') === 'string' ? sanitizeMessageDeliveryText(field('id', 'messageDeliveryId') as string, '', 96) : '';
  const tenantId = typeof field('tenantId', 'messageDeliveryTenantId') === 'string' ? sanitizeMessageDeliveryText(field('tenantId', 'messageDeliveryTenantId') as string, '', 64) : '';
  const customerId = typeof field('customerId', 'messageDeliveryCustomerId') === 'string' ? sanitizeMessageDeliveryText(field('customerId', 'messageDeliveryCustomerId') as string, '', 64) : '';
  const followUpTaskId = typeof field('followUpTaskId', 'messageDeliveryFollowUpTaskId') === 'string' ? sanitizeMessageDeliveryText(field('followUpTaskId', 'messageDeliveryFollowUpTaskId') as string, '', 64) : '';
  const messageDraftId = typeof field('messageDraftId', 'messageDeliveryDraftId') === 'string' ? sanitizeMessageDeliveryText(field('messageDraftId', 'messageDeliveryDraftId') as string, '', 64) : '';
  const recipientRef = typeof field('recipientRef', 'messageDeliveryRecipientRef') === 'string' ? sanitizeMessageDeliveryText(field('recipientRef', 'messageDeliveryRecipientRef') as string, '', 96) : '';
  const contentSnapshot = typeof field('contentSnapshot', 'messageDeliveryContentSnapshot') === 'string'
    ? sanitizeMessageDeliveryText(field('contentSnapshot', 'messageDeliveryContentSnapshot') as string, '', 500)
    : '';
  const createdBy = typeof field('createdBy', 'messageDeliveryCreatedBy') === 'string' ? sanitizeMessageDeliveryText(field('createdBy', 'messageDeliveryCreatedBy') as string, '', 96) : '';
  const confirmedBy = typeof field('confirmedBy', 'messageDeliveryConfirmedBy') === 'string' ? sanitizeMessageDeliveryText(field('confirmedBy', 'messageDeliveryConfirmedBy') as string, '', 96) : '';
  const createdAt = typeof field('createdAt', 'messageDeliveryCreatedAt') === 'string' ? field('createdAt', 'messageDeliveryCreatedAt') as string : '';
  const updatedAt = typeof field('updatedAt', 'messageDeliveryUpdatedAt') === 'string' ? field('updatedAt', 'messageDeliveryUpdatedAt') as string : '';
  const channelType = field('channelType', 'messageDeliveryChannelType');
  const deliveryMode = field('deliveryMode', 'messageDeliveryMode');
  const status = field('status', 'messageDeliveryStatus');

  if (
    !id ||
    !tenantId ||
    !customerId ||
    !followUpTaskId ||
    !messageDraftId ||
    !recipientRef ||
    !contentSnapshot ||
    !createdBy ||
    !confirmedBy ||
    !createdAt ||
    !updatedAt ||
    !isMessageDeliveryChannelType(channelType) ||
    !isMessageDeliveryMode(deliveryMode) ||
    !isMessageDeliveryStatus(status)
  ) {
    return null;
  }

  const rawFailureReason = field('failureReason', 'messageDeliveryFailureReason');
  const failureReason = rawFailureReason === null
    ? null
    : isMessageDeliveryFailureReason(rawFailureReason)
      ? rawFailureReason
      : null;

  return {
    id,
    tenantId,
    institutionId: stringOrNull(field('institutionId', 'messageDeliveryInstitutionId'), 64),
    customerId,
    followUpTaskId,
    messageDraftId,
    channelType,
    deliveryMode,
    recipientRef,
    contentSnapshot,
    status,
    failureReason,
    createdBy,
    confirmedBy,
    createdAt,
    sentAt: stringOrNull(field('sentAt', 'messageDeliverySentAt'), 64),
    updatedAt,
  };
}

export function mapMessageDeliveryToDto(delivery: MessageDelivery): MessageDeliveryDto {
  return {
    deliveryId: delivery.id,
    customerId: delivery.customerId,
    followUpTaskId: delivery.followUpTaskId,
    messageDraftId: delivery.messageDraftId,
    channelType: delivery.channelType,
    deliveryMode: delivery.deliveryMode,
    recipientRef: delivery.recipientRef,
    contentSnapshot: delivery.contentSnapshot,
    status: delivery.status,
    failureReason: delivery.failureReason,
    createdAt: delivery.createdAt,
    sentAt: delivery.sentAt,
    updatedAt: delivery.updatedAt,
    boundaryLabel: '人工确认 / 模拟发送 / 不自动发送 / 未接真实企业微信 / 短信',
  };
}

export function messageDeliveryStatusAuditReason(status: MessageDeliveryStatus) {
  if (status === 'mock_sent') return 'message_delivery_mock_sent' as const;
  if (status === 'mock_failed') return 'message_delivery_mock_failed' as const;
  if (status === 'skipped') return 'message_delivery_skipped' as const;
  if (status === 'external_disabled') return 'message_delivery_external_disabled' as const;
  return 'message_delivery_created' as const;
}
