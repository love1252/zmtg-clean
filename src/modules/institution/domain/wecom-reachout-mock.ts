import type { ContactSafetyDecision } from '@/modules/institution/domain/followup-contact-safety';
import type { FollowUpMessageDraft } from '@/modules/institution/domain/followup-message-drafts';
import type {
  MessageDeliveryChannelType,
  MessageDeliveryFailureReason,
  MessageDeliveryMode,
  MessageDeliveryStatus,
} from '@/modules/institution/domain/followup-message-deliveries';
import type { WeComAuthorizationRecord } from '@/modules/institution/domain/wecom-authorization';
import { evaluateWeComAuthorizationForDelivery, sanitizeWeComAuthorizationText } from '@/modules/institution/domain/wecom-authorization';
import type { WeComCustomerContactMockRecord } from '@/modules/institution/domain/wecom-customer-contact';

export type WeComMockReachOutStatus = Extract<MessageDeliveryStatus, 'mock_sent' | 'mock_failed' | 'skipped' | 'external_disabled'>;
export type WeComMockReachOutAuditReason =
  | 'wecom_mock_reachout_created'
  | 'wecom_mock_reachout_sent'
  | 'wecom_mock_reachout_failed'
  | 'wecom_mock_reachout_skipped'
  | 'wecom_mock_reachout_external_disabled';

export type WeComMockReachOutResult = {
  deliveryId: string;
  messageDraftId: string;
  followUpTaskId: string;
  customerId: string;
  mockExternalContactId: string | null;
  ownerEmployeeRef: string | null;
  channelType: Extract<MessageDeliveryChannelType, 'wechat_work'>;
  deliveryMode: MessageDeliveryMode;
  status: WeComMockReachOutStatus;
  failureReason: MessageDeliveryFailureReason | null;
  safeReasonLabel: string;
  occurredAt: string;
  updatedAt: string;
  noRealSend: true;
  noRealOutBound: true;
  noRealWeComApiCall: true;
  noWebhook: true;
  currentOnlyMock: true;
  externalChannelEnabled: false;
  allowRealSend: false;
  auditReason: WeComMockReachOutAuditReason;
};

export type WeComMockReachOutDashboardView = {
  title: '企业微信随访触达 mock';
  recordCount: number;
  mockSentCount: number;
  mockFailedCount: number;
  skippedCount: number;
  externalDisabledCount: number;
  reachableCustomerCount: number;
  unreachableCustomerCount: number;
  recentRecords: WeComMockReachOutResult[];
  currentOnlyMock: true;
  notConnectedToRealWeCom: true;
  noRealSend: true;
  noRealOutbound: true;
  noRealWeComApiCall: true;
  noWebhook: true;
  requiresHumanApproval: true;
  requiresMessageDelivery: true;
  requiresWeComAuthorization: true;
  requiresWeComCustomerContact: true;
  notWeComLogin: true;
  notPersonalWechatFriendSync: true;
  notChatHistorySync: true;
  safeSummary: string;
};

const reachableStatuses = new Set<WeComMockReachOutStatus>(['mock_sent', 'mock_failed']);

function safeText(input: string | null | undefined, fallback: string, limit = 120) {
  return sanitizeWeComAuthorizationText(input, fallback, limit);
}

function statusAuditReason(status: WeComMockReachOutStatus): WeComMockReachOutAuditReason {
  if (status === 'mock_sent') return 'wecom_mock_reachout_sent';
  if (status === 'mock_failed') return 'wecom_mock_reachout_failed';
  if (status === 'external_disabled') return 'wecom_mock_reachout_external_disabled';
  return 'wecom_mock_reachout_skipped';
}

function resultForDraft(input: {
  draft: FollowUpMessageDraft;
  deliveryId: string;
  status: WeComMockReachOutStatus;
  deliveryMode: MessageDeliveryMode;
  failureReason: MessageDeliveryFailureReason | null;
  safeReasonLabel: string;
  occurredAt: string;
  contact?: WeComCustomerContactMockRecord | null;
}): WeComMockReachOutResult {
  return {
    deliveryId: safeText(input.deliveryId, 'msg-delivery:low-sensitive', 96),
    messageDraftId: safeText(input.draft.id, 'draft:low-sensitive', 96),
    followUpTaskId: safeText(input.draft.followUpTaskId, 'followup-task:low-sensitive', 96),
    customerId: safeText(input.draft.customerId, 'customer:low-sensitive', 96),
    mockExternalContactId: input.contact?.mockExternalContactId ? safeText(input.contact.mockExternalContactId, 'mock-external-contact:low-sensitive', 96) : null,
    ownerEmployeeRef: input.contact?.ownerEmployeeRef ? safeText(input.contact.ownerEmployeeRef, 'mock-employee:low-sensitive', 96) : null,
    channelType: 'wechat_work',
    deliveryMode: input.deliveryMode,
    status: input.status,
    failureReason: input.failureReason,
    safeReasonLabel: safeText(input.safeReasonLabel, '企业微信 mock 触达低敏状态已记录。', 160),
    occurredAt: input.occurredAt,
    updatedAt: input.occurredAt,
    noRealSend: true,
    noRealOutBound: true,
    noRealWeComApiCall: true,
    noWebhook: true,
    currentOnlyMock: true,
    externalChannelEnabled: false,
    allowRealSend: false,
    auditReason: statusAuditReason(input.status),
  };
}

export function createWeComMockReachOutResult(input: {
  draft: FollowUpMessageDraft;
  deliveryId: string;
  contactSafetyDecision: ContactSafetyDecision;
  authorization: WeComAuthorizationRecord | null | undefined;
  contacts?: WeComCustomerContactMockRecord[] | null;
  occurredAt: string;
  mockOutcome?: Extract<WeComMockReachOutStatus, 'mock_sent' | 'mock_failed'>;
}): WeComMockReachOutResult {
  const contact = input.contacts?.find((item) => item.customerId === input.draft.customerId) ?? null;

  if (input.draft.status !== 'approved') {
    return resultForDraft({
      draft: input.draft,
      deliveryId: input.deliveryId,
      status: 'skipped',
      deliveryMode: 'mock',
      failureReason: 'draft_not_approved',
      safeReasonLabel: '消息草稿未经人工确认，已阻断企业微信 mock 触达。',
      occurredAt: input.occurredAt,
      contact,
    });
  }

  if (!input.contactSafetyDecision.allowed) {
    return resultForDraft({
      draft: input.draft,
      deliveryId: input.deliveryId,
      status: input.contactSafetyDecision.status === 'external_disabled' ? 'external_disabled' : 'skipped',
      deliveryMode: input.contactSafetyDecision.deliveryMode,
      failureReason: input.contactSafetyDecision.failureReason,
      safeReasonLabel: input.contactSafetyDecision.safeReasonLabel,
      occurredAt: input.occurredAt,
      contact,
    });
  }

  const authorizationGate = evaluateWeComAuthorizationForDelivery(input.authorization);
  if (!authorizationGate.availableForMock) {
    const status = authorizationGate.reason === 'wecom_channel_default_closed' ? 'external_disabled' : 'skipped';
    return resultForDraft({
      draft: input.draft,
      deliveryId: input.deliveryId,
      status,
      deliveryMode: status === 'external_disabled' ? 'external_disabled' : 'mock',
      failureReason: authorizationGate.messageDeliveryFailureReason ?? 'wecom_authorization_missing',
      safeReasonLabel: authorizationGate.safeReasonLabel,
      occurredAt: input.occurredAt,
      contact,
    });
  }

  if (authorizationGate.reason === 'wecom_channel_default_closed') {
    return resultForDraft({
      draft: input.draft,
      deliveryId: input.deliveryId,
      status: 'external_disabled',
      deliveryMode: 'external_disabled',
      failureReason: authorizationGate.messageDeliveryFailureReason ?? 'wecom_external_channel_disabled',
      safeReasonLabel: authorizationGate.safeReasonLabel,
      occurredAt: input.occurredAt,
      contact,
    });
  }

  if (!contact || contact.syncStatus === 'not_synced' || contact.syncStatus === 'authorization_unavailable') {
    return resultForDraft({
      draft: input.draft,
      deliveryId: input.deliveryId,
      status: 'skipped',
      deliveryMode: 'mock',
      failureReason: 'wecom_customer_contact_not_synced',
      safeReasonLabel: '企业微信客户联系关系未同步，已跳过企业微信 mock 触达。',
      occurredAt: input.occurredAt,
      contact,
    });
  }

  if (!contact.linkedToSystemCustomer || contact.customerId !== input.draft.customerId) {
    return resultForDraft({
      draft: input.draft,
      deliveryId: input.deliveryId,
      status: 'skipped',
      deliveryMode: 'mock',
      failureReason: 'wecom_external_contact_unlinked',
      safeReasonLabel: '企业微信外部联系人未关联系统客户，已跳过企业微信 mock 触达。',
      occurredAt: input.occurredAt,
      contact,
    });
  }

  if (!contact.ownerEmployeeMapped) {
    return resultForDraft({
      draft: input.draft,
      deliveryId: input.deliveryId,
      status: 'skipped',
      deliveryMode: 'mock',
      failureReason: 'wecom_owner_employee_unmapped',
      safeReasonLabel: '客户归属企业微信员工未映射到系统员工，已跳过企业微信 mock 触达。',
      occurredAt: input.occurredAt,
      contact,
    });
  }

  if (!contact.availableForFollowUp) {
    return resultForDraft({
      draft: input.draft,
      deliveryId: input.deliveryId,
      status: 'skipped',
      deliveryMode: 'mock',
      failureReason: 'wecom_customer_unavailable',
      safeReasonLabel: '企业微信客户联系关系当前不可用于随访，已跳过企业微信 mock 触达。',
      occurredAt: input.occurredAt,
      contact,
    });
  }

  if (input.mockOutcome === 'mock_failed') {
    return resultForDraft({
      draft: input.draft,
      deliveryId: input.deliveryId,
      status: 'mock_failed',
      deliveryMode: 'mock',
      failureReason: 'mock_failure',
      safeReasonLabel: '企业微信 mock 触达失败，失败原因仅使用低敏状态码记录；未真实发送。',
      occurredAt: input.occurredAt,
      contact,
    });
  }

  return resultForDraft({
    draft: input.draft,
    deliveryId: input.deliveryId,
    status: 'mock_sent',
    deliveryMode: 'mock',
    failureReason: null,
    safeReasonLabel: '企业微信 mock 触达成功：当前仅本地状态回写，未真实发送、未真实出网、未调用企业微信 API。',
    occurredAt: input.occurredAt,
    contact,
  });
}

export function weComMockReachOutToTimelineMetadata(result: WeComMockReachOutResult): Record<string, string | null> {
  return {
    weComMockReachOutDeliveryId: result.deliveryId,
    weComMockReachOutMessageDraftId: result.messageDraftId,
    weComMockReachOutFollowUpTaskId: result.followUpTaskId,
    weComMockReachOutCustomerId: result.customerId,
    weComMockReachOutExternalContactId: result.mockExternalContactId,
    weComMockReachOutOwnerEmployeeRef: result.ownerEmployeeRef,
    weComMockReachOutChannelType: result.channelType,
    weComMockReachOutDeliveryMode: result.deliveryMode,
    weComMockReachOutStatus: result.status,
    weComMockReachOutFailureReason: result.failureReason,
    weComMockReachOutSafeReasonLabel: result.safeReasonLabel,
    weComMockReachOutOccurredAt: result.occurredAt,
    weComMockReachOutUpdatedAt: result.updatedAt,
    weComMockReachOutAuditReason: result.auditReason,
    weComMockReachOutNoRealSend: 'true',
    weComMockReachOutNoRealOutBound: 'true',
    weComMockReachOutNoRealWeComApiCall: 'true',
    weComMockReachOutNoWebhook: 'true',
    weComMockReachOutCurrentOnlyMock: 'true',
    weComMockReachOutExternalChannelEnabled: 'false',
    weComMockReachOutAllowRealSend: 'false',
  };
}

function isWeComMockReachOutStatus(input: unknown): input is WeComMockReachOutStatus {
  return input === 'mock_sent' || input === 'mock_failed' || input === 'skipped' || input === 'external_disabled';
}

function isWeComMockReachOutAuditReason(input: unknown): input is WeComMockReachOutAuditReason {
  return input === 'wecom_mock_reachout_created' ||
    input === 'wecom_mock_reachout_sent' ||
    input === 'wecom_mock_reachout_failed' ||
    input === 'wecom_mock_reachout_skipped' ||
    input === 'wecom_mock_reachout_external_disabled';
}

function isMessageDeliveryFailureReason(input: unknown): input is MessageDeliveryFailureReason {
  return typeof input === 'string' && [
    'channel_disabled',
    'consent_missing',
    'opt_out',
    'frequency_cap_reached',
    'draft_not_approved',
    'recipient_unavailable',
    'mock_failure',
    'tenant_not_allowlisted',
    'institution_not_allowlisted',
    'external_channel_disabled',
    'wecom_authorization_missing',
    'wecom_authorization_revoked',
    'wecom_authorization_expired',
    'wecom_authorization_disabled',
    'wecom_reach_out_unauthorized',
    'wecom_external_channel_disabled',
    'wecom_customer_contact_not_synced',
    'wecom_external_contact_unlinked',
    'wecom_owner_employee_unmapped',
    'wecom_customer_unavailable',
  ].includes(input);
}

export function readWeComMockReachOutFromMetadata(metadata: Record<string, unknown>): WeComMockReachOutResult | null {
  const deliveryId = typeof metadata.weComMockReachOutDeliveryId === 'string' ? safeText(metadata.weComMockReachOutDeliveryId, '', 96) : '';
  const messageDraftId = typeof metadata.weComMockReachOutMessageDraftId === 'string' ? safeText(metadata.weComMockReachOutMessageDraftId, '', 96) : '';
  const followUpTaskId = typeof metadata.weComMockReachOutFollowUpTaskId === 'string' ? safeText(metadata.weComMockReachOutFollowUpTaskId, '', 96) : '';
  const customerId = typeof metadata.weComMockReachOutCustomerId === 'string' ? safeText(metadata.weComMockReachOutCustomerId, '', 96) : '';
  const status = metadata.weComMockReachOutStatus;
  const deliveryMode = metadata.weComMockReachOutDeliveryMode;
  const occurredAt = typeof metadata.weComMockReachOutOccurredAt === 'string' ? metadata.weComMockReachOutOccurredAt : '';
  const updatedAt = typeof metadata.weComMockReachOutUpdatedAt === 'string' ? metadata.weComMockReachOutUpdatedAt : '';
  const auditReason = metadata.weComMockReachOutAuditReason;

  if (
    !deliveryId ||
    !messageDraftId ||
    !followUpTaskId ||
    !customerId ||
    !isWeComMockReachOutStatus(status) ||
    (deliveryMode !== 'mock' && deliveryMode !== 'external_disabled') ||
    !occurredAt ||
    !updatedAt ||
    !isWeComMockReachOutAuditReason(auditReason)
  ) {
    return null;
  }

  const failureReason = isMessageDeliveryFailureReason(metadata.weComMockReachOutFailureReason)
    ? metadata.weComMockReachOutFailureReason
    : null;

  return {
    deliveryId,
    messageDraftId,
    followUpTaskId,
    customerId,
    mockExternalContactId: typeof metadata.weComMockReachOutExternalContactId === 'string'
      ? safeText(metadata.weComMockReachOutExternalContactId, 'mock-external-contact:low-sensitive', 96)
      : null,
    ownerEmployeeRef: typeof metadata.weComMockReachOutOwnerEmployeeRef === 'string'
      ? safeText(metadata.weComMockReachOutOwnerEmployeeRef, 'mock-employee:low-sensitive', 96)
      : null,
    channelType: 'wechat_work',
    deliveryMode,
    status,
    failureReason,
    safeReasonLabel: typeof metadata.weComMockReachOutSafeReasonLabel === 'string'
      ? safeText(metadata.weComMockReachOutSafeReasonLabel, '企业微信 mock 触达低敏状态已记录。', 160)
      : '企业微信 mock 触达低敏状态已记录。',
    occurredAt,
    updatedAt,
    noRealSend: true,
    noRealOutBound: true,
    noRealWeComApiCall: true,
    noWebhook: true,
    currentOnlyMock: true,
    externalChannelEnabled: false,
    allowRealSend: false,
    auditReason,
  };
}

export function createWeComMockReachOutDashboardView(records: WeComMockReachOutResult[]): WeComMockReachOutDashboardView {
  const sortedRecords = [...records].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  const reachableCustomers = new Set(records.filter((record) => reachableStatuses.has(record.status)).map((record) => record.customerId));
  const unreachableCustomers = new Set(records.filter((record) => !reachableStatuses.has(record.status)).map((record) => record.customerId));

  return {
    title: '企业微信随访触达 mock',
    recordCount: records.length,
    mockSentCount: records.filter((record) => record.status === 'mock_sent').length,
    mockFailedCount: records.filter((record) => record.status === 'mock_failed').length,
    skippedCount: records.filter((record) => record.status === 'skipped').length,
    externalDisabledCount: records.filter((record) => record.status === 'external_disabled').length,
    reachableCustomerCount: reachableCustomers.size,
    unreachableCustomerCount: unreachableCustomers.size,
    recentRecords: sortedRecords.slice(0, 6),
    currentOnlyMock: true,
    notConnectedToRealWeCom: true,
    noRealSend: true,
    noRealOutbound: true,
    noRealWeComApiCall: true,
    noWebhook: true,
    requiresHumanApproval: true,
    requiresMessageDelivery: true,
    requiresWeComAuthorization: true,
    requiresWeComCustomerContact: true,
    notWeComLogin: true,
    notPersonalWechatFriendSync: true,
    notChatHistorySync: true,
    safeSummary: '企业微信随访触达当前仅 mock：不接真实企业微信，不真实发送，不真实出网，不调用真实企业微信 API，不使用真实 webhook，不同步聊天记录，不做客户自动回复。',
  };
}

export function getDefaultWeComMockReachOutDashboardView() {
  return createWeComMockReachOutDashboardView([]);
}
