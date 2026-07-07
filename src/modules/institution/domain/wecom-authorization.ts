export const weComAuthorizationStatuses = [
  'not_configured',
  'mock_authorized',
  'revoked',
  'expired',
  'disabled',
  'external_channel_disabled',
] as const;

export const weComAuthorizationCapabilityScopes = [
  'customer_contact',
  'external_contact_sync',
  'customer_owner_sync',
  'wecom_reach_out',
  'session_archive',
] as const;

export type WeComAuthorizationStatus = (typeof weComAuthorizationStatuses)[number];
export type WeComAuthorizationCapabilityScope = (typeof weComAuthorizationCapabilityScopes)[number];

export type WeComAuthorizationRecord = {
  id: string;
  tenantId: string;
  institutionId: string | null;
  authorizedCorpDisplayName: string;
  authorizedCorpRef: string;
  status: WeComAuthorizationStatus;
  capabilityScope: WeComAuthorizationCapabilityScope[];
  customerContactAuthorized: boolean;
  externalContactSyncAuthorized: boolean;
  customerOwnerSyncAuthorized: boolean;
  weComReachOutAuthorized: boolean;
  sessionArchiveAuthorized: boolean;
  employeeScopeSummary: string;
  lastSyncedAt: string | null;
  lastErrorReason: string | null;
  inGray: boolean;
  allowRealSend: false;
  defaultClosed: true;
  externalChannelEnabled: false;
  createdAt: string;
  updatedAt: string;
};

export type WeComAuthorizationDashboardView = {
  accessTitle: '企业微信客户运营接入';
  notLoginTitle: '不是企业微信登录';
  authorizationRecordId: string;
  authorizedCorpDisplayName: string;
  authorizedCorpRef: string;
  status: WeComAuthorizationStatus;
  statusLabel: string;
  isMockAuthorized: boolean;
  capabilityScope: WeComAuthorizationCapabilityScope[];
  customerContactAuthorized: boolean;
  externalContactSyncAuthorized: boolean;
  customerOwnerSyncAuthorized: boolean;
  weComReachOutAuthorized: boolean;
  sessionArchiveAuthorized: boolean;
  sessionArchivePostponed: true;
  employeeScopeSummary: string;
  lastSyncedAt: string | null;
  lastErrorReason: string | null;
  inGray: boolean;
  allowRealSend: false;
  defaultClosed: true;
  externalChannelEnabled: false;
  notConnectedToRealWeCom: true;
  notWeComServiceApplied: true;
  requiresHumanApprovalAndMessageDelivery: true;
  safeSummary: string;
  deliveryRelation: {
    authorizationState: 'wecom_authorization_state';
    contactSafetyGuard: 'contact_safety_guard';
    messageDelivery: 'message_delivery';
    futureTimelineAuditDashboard: 'timeline_audit_dashboard';
    description: string;
  };
};

export type WeComAuthorizationGateReason =
  | 'wecom_mock_authorization_read'
  | 'wecom_mock_authorization_unavailable'
  | 'wecom_channel_default_closed'
  | 'wecom_reach_out_unauthorized';

export type WeComAuthorizationDeliveryGate = {
  availableForMock: boolean;
  allowRealSend: false;
  externalChannelEnabled: false;
  defaultClosed: true;
  reason: WeComAuthorizationGateReason;
  safeReasonLabel: string;
  messageDeliveryFailureReason:
    | null
    | 'wecom_authorization_missing'
    | 'wecom_authorization_revoked'
    | 'wecom_authorization_expired'
    | 'wecom_authorization_disabled'
    | 'wecom_reach_out_unauthorized'
    | 'wecom_external_channel_disabled';
};

const statusLabels: Record<WeComAuthorizationStatus, string> = {
  not_configured: '未配置',
  mock_authorized: '模拟已授权',
  revoked: '已撤销',
  expired: '已过期',
  disabled: '已禁用',
  external_channel_disabled: '外部通道未启用',
};

const unsafeWeComAuthorizationPatterns = [
  /\bww[0-9a-f]{6,}\b/iu,
  /1[3-9]\d{9}/u,
  /\d{6}(?:19|20)\d{2}\d{2}\d{2}\d{3}[\dXx]/u,
  /\bMR[-_A-Z0-9]{3,}\b/iu,
  /\b(?:secret|access[_-]?token|refresh[_-]?token|encodingAESKey|callback[_-]?token|api[_-]?key|private[_-]?key)\b/iu,
  /\bHIS\b|his payload|完整聊天|聊天记录|consultationTranscript/iu,
  /\b(?:provider|model|token|vendor|cost|prompt|raw response|raw payload)\b/iu,
];

function normalizeText(input: string | null | undefined, limit: number) {
  return (input ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, limit);
}

export function containsUnsafeWeComAuthorizationText(input: string) {
  return unsafeWeComAuthorizationPatterns.some((pattern) => pattern.test(input));
}

export function sanitizeWeComAuthorizationText(input: string | null | undefined, fallback: string, limit = 120) {
  const normalized = normalizeText(input, limit);
  if (!normalized || containsUnsafeWeComAuthorizationText(normalized)) return fallback;
  return normalized;
}

export function weComAuthorizationStatusLabel(status: WeComAuthorizationStatus) {
  return statusLabels[status];
}

function idForAuthorization(input: { tenantId: string; institutionId: string | null }) {
  return sanitizeWeComAuthorizationText(
    `wecom-auth:mock:${input.tenantId}:${input.institutionId ?? 'tenant'}`,
    'wecom-auth:mock-low-sensitive',
    96,
  );
}

function defaultCapabilityScope(input: {
  customerContactAuthorized: boolean;
  externalContactSyncAuthorized: boolean;
  customerOwnerSyncAuthorized: boolean;
  weComReachOutAuthorized: boolean;
  sessionArchiveAuthorized: boolean;
}): WeComAuthorizationCapabilityScope[] {
  return [
    input.customerContactAuthorized ? 'customer_contact' : null,
    input.externalContactSyncAuthorized ? 'external_contact_sync' : null,
    input.customerOwnerSyncAuthorized ? 'customer_owner_sync' : null,
    input.weComReachOutAuthorized ? 'wecom_reach_out' : null,
    input.sessionArchiveAuthorized ? 'session_archive' : null,
  ].filter((item): item is WeComAuthorizationCapabilityScope => item !== null);
}

export function createWeComAuthorizationRecord(input: {
  tenantId: string;
  institutionId: string | null;
  status?: WeComAuthorizationStatus;
  authorizedCorpDisplayName?: string | null;
  authorizedCorpRef?: string | null;
  customerContactAuthorized?: boolean;
  externalContactSyncAuthorized?: boolean;
  customerOwnerSyncAuthorized?: boolean;
  weComReachOutAuthorized?: boolean;
  sessionArchiveAuthorized?: boolean;
  employeeScopeSummary?: string | null;
  lastSyncedAt?: string | null;
  lastErrorReason?: string | null;
  inGray?: boolean;
  occurredAt: string;
}): WeComAuthorizationRecord {
  const status = input.status ?? 'not_configured';
  const isMockAuthorized = status === 'mock_authorized';
  const grantsMockCapabilities = status === 'mock_authorized' || status === 'external_channel_disabled';
  const customerContactAuthorized = input.customerContactAuthorized ?? grantsMockCapabilities;
  const externalContactSyncAuthorized = input.externalContactSyncAuthorized ?? grantsMockCapabilities;
  const customerOwnerSyncAuthorized = input.customerOwnerSyncAuthorized ?? grantsMockCapabilities;
  const weComReachOutAuthorized = input.weComReachOutAuthorized ?? grantsMockCapabilities;
  const sessionArchiveAuthorized = input.sessionArchiveAuthorized ?? false;

  return {
    id: idForAuthorization(input),
    tenantId: sanitizeWeComAuthorizationText(input.tenantId, 'tenant:low-sensitive', 64),
    institutionId: input.institutionId ? sanitizeWeComAuthorizationText(input.institutionId, 'institution:low-sensitive', 64) : null,
    authorizedCorpDisplayName: sanitizeWeComAuthorizationText(
      input.authorizedCorpDisplayName,
      isMockAuthorized ? '模拟机构企业微信主体' : '未配置企业微信主体',
      80,
    ),
    authorizedCorpRef: sanitizeWeComAuthorizationText(
      input.authorizedCorpRef,
      isMockAuthorized ? 'corp:mock-low-sensitive' : 'corp:not-configured',
      96,
    ),
    status,
    capabilityScope: defaultCapabilityScope({
      customerContactAuthorized,
      externalContactSyncAuthorized,
      customerOwnerSyncAuthorized,
      weComReachOutAuthorized,
      sessionArchiveAuthorized,
    }),
    customerContactAuthorized,
    externalContactSyncAuthorized,
    customerOwnerSyncAuthorized,
    weComReachOutAuthorized,
    sessionArchiveAuthorized,
    employeeScopeSummary: sanitizeWeComAuthorizationText(input.employeeScopeSummary, '授权员工范围未配置，仅展示低敏摘要。', 120),
    lastSyncedAt: input.lastSyncedAt ?? null,
    lastErrorReason: input.lastErrorReason
      ? sanitizeWeComAuthorizationText(input.lastErrorReason, '低敏授权状态异常。', 120)
      : null,
    inGray: input.inGray ?? false,
    allowRealSend: false,
    defaultClosed: true,
    externalChannelEnabled: false,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
}

export function createDefaultWeComAuthorizationRecord(input: {
  tenantId: string;
  institutionId: string | null;
  occurredAt: string;
}) {
  return createWeComAuthorizationRecord({
    ...input,
    status: 'not_configured',
    customerContactAuthorized: false,
    externalContactSyncAuthorized: false,
    customerOwnerSyncAuthorized: false,
    weComReachOutAuthorized: false,
    sessionArchiveAuthorized: false,
    inGray: false,
  });
}

export function evaluateWeComAuthorizationForDelivery(
  authorization: WeComAuthorizationRecord | null | undefined,
): WeComAuthorizationDeliveryGate {
  if (!authorization || authorization.status === 'not_configured') {
    return {
      availableForMock: false,
      allowRealSend: false,
      externalChannelEnabled: false,
      defaultClosed: true,
      reason: 'wecom_mock_authorization_unavailable',
      safeReasonLabel: '企业微信授权未配置，已阻断企业微信触达。',
      messageDeliveryFailureReason: 'wecom_authorization_missing',
    };
  }

  if (authorization.status === 'revoked') {
    return {
      availableForMock: false,
      allowRealSend: false,
      externalChannelEnabled: false,
      defaultClosed: true,
      reason: 'wecom_mock_authorization_unavailable',
      safeReasonLabel: '企业微信模拟授权已撤销，已阻断企业微信触达。',
      messageDeliveryFailureReason: 'wecom_authorization_revoked',
    };
  }

  if (authorization.status === 'expired') {
    return {
      availableForMock: false,
      allowRealSend: false,
      externalChannelEnabled: false,
      defaultClosed: true,
      reason: 'wecom_mock_authorization_unavailable',
      safeReasonLabel: '企业微信模拟授权已过期，已阻断企业微信触达。',
      messageDeliveryFailureReason: 'wecom_authorization_expired',
    };
  }

  if (authorization.status === 'disabled') {
    return {
      availableForMock: false,
      allowRealSend: false,
      externalChannelEnabled: false,
      defaultClosed: true,
      reason: 'wecom_mock_authorization_unavailable',
      safeReasonLabel: '企业微信模拟授权已禁用，已阻断企业微信触达。',
      messageDeliveryFailureReason: 'wecom_authorization_disabled',
    };
  }

  if (!authorization.weComReachOutAuthorized) {
    return {
      availableForMock: false,
      allowRealSend: false,
      externalChannelEnabled: false,
      defaultClosed: true,
      reason: 'wecom_reach_out_unauthorized',
      safeReasonLabel: '企业微信触达能力未授权，已阻断当前发送。',
      messageDeliveryFailureReason: 'wecom_reach_out_unauthorized',
    };
  }

  return {
    availableForMock: authorization.status === 'mock_authorized' || authorization.status === 'external_channel_disabled',
    allowRealSend: false,
    externalChannelEnabled: false,
    defaultClosed: true,
    reason: authorization.status === 'external_channel_disabled' ? 'wecom_channel_default_closed' : 'wecom_mock_authorization_read',
    safeReasonLabel: authorization.status === 'external_channel_disabled'
      ? '企业微信外部通道未启用，mock 授权也不能真实发送。'
      : '企业微信模拟授权可读，仅允许进入 mock / manual 链路，不允许真实发送。',
    messageDeliveryFailureReason: 'wecom_external_channel_disabled',
  };
}

export function mapWeComAuthorizationToDashboardView(record: WeComAuthorizationRecord): WeComAuthorizationDashboardView {
  const gate = evaluateWeComAuthorizationForDelivery(record);
  const isMockAuthorized = record.status === 'mock_authorized';

  return {
    accessTitle: '企业微信客户运营接入',
    notLoginTitle: '不是企业微信登录',
    authorizationRecordId: record.id,
    authorizedCorpDisplayName: record.authorizedCorpDisplayName,
    authorizedCorpRef: record.authorizedCorpRef,
    status: record.status,
    statusLabel: weComAuthorizationStatusLabel(record.status),
    isMockAuthorized,
    capabilityScope: record.capabilityScope,
    customerContactAuthorized: record.customerContactAuthorized,
    externalContactSyncAuthorized: record.externalContactSyncAuthorized,
    customerOwnerSyncAuthorized: record.customerOwnerSyncAuthorized,
    weComReachOutAuthorized: record.weComReachOutAuthorized,
    sessionArchiveAuthorized: false,
    sessionArchivePostponed: true,
    employeeScopeSummary: record.employeeScopeSummary,
    lastSyncedAt: record.lastSyncedAt,
    lastErrorReason: record.lastErrorReason ?? gate.safeReasonLabel,
    inGray: record.inGray,
    allowRealSend: false,
    defaultClosed: true,
    externalChannelEnabled: false,
    notConnectedToRealWeCom: true,
    notWeComServiceApplied: true,
    requiresHumanApprovalAndMessageDelivery: true,
    safeSummary: '机构授权其自有企业微信主体后，平台只保存低敏授权状态；当前仅 mock，不接真实企业微信，不真实发送。',
    deliveryRelation: {
      authorizationState: 'wecom_authorization_state',
      contactSafetyGuard: 'contact_safety_guard',
      messageDelivery: 'message_delivery',
      futureTimelineAuditDashboard: 'timeline_audit_dashboard',
      description: '企业微信授权状态 → 触达安全治理 → MessageDelivery → 后续真实触达状态回写 → timeline / audit / dashboard。',
    },
  };
}

export function getDefaultWeComAuthorizationDashboardView(): WeComAuthorizationDashboardView {
  return mapWeComAuthorizationToDashboardView(createDefaultWeComAuthorizationRecord({
    tenantId: 'tenant:low-sensitive',
    institutionId: null,
    occurredAt: '2026-07-07T00:00:00.000Z',
  }));
}
