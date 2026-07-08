import type {
  MessageDeliveryChannelType,
  MessageDeliveryFailureReason,
  MessageDeliveryMode,
  MessageDeliveryStatus,
} from '@/modules/institution/domain/followup-message-deliveries';

export const contactSafetyDecisionCodes = [
  'allowed',
  'blocked_consent_missing',
  'blocked_opt_out',
  'blocked_frequency_cap',
  'blocked_channel_disabled',
  'blocked_tenant_not_allowlisted',
  'blocked_institution_not_allowlisted',
  'blocked_external_channel_disabled',
] as const;

export type ContactSafetyDecisionCode = (typeof contactSafetyDecisionCodes)[number];

export type ContactSafetyPolicy = {
  consent: 'allowed' | 'missing';
  optOut: boolean;
  frequencyCap: 'allowed' | 'reached';
  channelEnabled: boolean;
  tenantAllowlist: readonly string[];
  institutionAllowlist: readonly string[];
  channelTypeAllowlist: readonly MessageDeliveryChannelType[];
  sandboxMockOnly: boolean;
  externalChannelEnabled: boolean;
  noRealSend: true;
};

export type ContactSafetyDecision = {
  code: ContactSafetyDecisionCode;
  allowed: boolean;
  status: MessageDeliveryStatus;
  deliveryMode: MessageDeliveryMode;
  failureReason: MessageDeliveryFailureReason | null;
  safeReasonLabel: string;
  auditReason:
    | 'contact_safety_allowed'
    | 'contact_safety_consent_missing'
    | 'contact_safety_opt_out'
    | 'contact_safety_frequency_cap_reached'
    | 'channel_gray_tenant_blocked'
    | 'channel_gray_institution_blocked'
    | 'channel_gray_external_disabled'
    | 'wecom_mock_authorization_read'
    | 'wecom_mock_authorization_unavailable'
    | 'wecom_channel_default_closed'
    | 'wecom_reach_out_unauthorized'
    | 'wecom_mock_customer_contact_unavailable';
  boundaryLabel: '触达安全治理 / 默认关闭 / 灰度前置 / 人工确认 / 模拟发送 / 不自动发送';
};

const externalChannelTypes = new Set<MessageDeliveryChannelType>(['wechat_work', 'sms']);
const mockOnlyChannelTypes = new Set<MessageDeliveryChannelType>(['manual', 'mock']);

export const defaultContactSafetyPolicy: ContactSafetyPolicy = {
  consent: 'missing',
  optOut: false,
  frequencyCap: 'allowed',
  channelEnabled: false,
  tenantAllowlist: [],
  institutionAllowlist: [],
  channelTypeAllowlist: ['manual', 'mock'],
  sandboxMockOnly: true,
  externalChannelEnabled: false,
  noRealSend: true,
};

export function createAllowedSandboxContactSafetyPolicy(input: {
  tenantId: string;
  institutionId: string | null;
  channelTypes?: MessageDeliveryChannelType[];
}): ContactSafetyPolicy {
  return {
    ...defaultContactSafetyPolicy,
    consent: 'allowed',
    channelEnabled: true,
    tenantAllowlist: [input.tenantId],
    institutionAllowlist: input.institutionId ? [input.institutionId] : [],
    channelTypeAllowlist: input.channelTypes ?? ['manual', 'mock'],
    sandboxMockOnly: true,
    externalChannelEnabled: false,
    noRealSend: true,
  };
}

function stringArray(input: unknown): string[] {
  return Array.isArray(input)
    ? input.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];
}

function channelTypeArray(input: unknown): MessageDeliveryChannelType[] {
  const allowed = new Set<MessageDeliveryChannelType>(['manual', 'mock', 'wechat_work', 'sms']);
  return stringArray(input).filter((item): item is MessageDeliveryChannelType => allowed.has(item as MessageDeliveryChannelType));
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

export function readContactSafetyPolicyFromMetadata(
  metadataJson: Record<string, unknown>,
): ContactSafetyPolicy | null {
  const raw = metadataJson.contactSafetyPolicy ?? metadataJson.contactSafety;
  if (!isRecord(raw)) return null;

  return {
    ...defaultContactSafetyPolicy,
    consent: raw.consent === 'allowed' ? 'allowed' : 'missing',
    optOut: raw.optOut === true,
    frequencyCap: raw.frequencyCap === 'reached' || raw.frequencyCapReached === true ? 'reached' : 'allowed',
    channelEnabled: raw.channelEnabled === true,
    tenantAllowlist: stringArray(raw.tenantAllowlist),
    institutionAllowlist: stringArray(raw.institutionAllowlist),
    channelTypeAllowlist: channelTypeArray(raw.channelTypeAllowlist),
    sandboxMockOnly: raw.sandboxMockOnly !== false,
    externalChannelEnabled: raw.externalChannelEnabled === true,
    noRealSend: true,
  };
}

export function contactSafetyDecisionLabel(code: ContactSafetyDecisionCode) {
  const labels: Record<ContactSafetyDecisionCode, string> = {
    allowed: '触达安全校验通过，仅允许模拟发送 / 人工记录。',
    blocked_consent_missing: '未授权触达，已跳过。',
    blocked_opt_out: '客户退订，已跳过。',
    blocked_frequency_cap: '达到频率限制，已跳过。',
    blocked_channel_disabled: '渠道未启用，已阻断。',
    blocked_tenant_not_allowlisted: '租户未进入灰度，已阻断。',
    blocked_institution_not_allowlisted: '机构未进入灰度，已阻断。',
    blocked_external_channel_disabled: '外部渠道默认关闭，已阻断。',
  };

  return labels[code];
}

function blockedDecision(input: {
  code: Exclude<ContactSafetyDecisionCode, 'allowed'>;
  status: MessageDeliveryStatus;
  deliveryMode: MessageDeliveryMode;
  failureReason: MessageDeliveryFailureReason;
  auditReason: Exclude<ContactSafetyDecision['auditReason'], 'contact_safety_allowed'>;
}): ContactSafetyDecision {
  return {
    code: input.code,
    allowed: false,
    status: input.status,
    deliveryMode: input.deliveryMode,
    failureReason: input.failureReason,
    safeReasonLabel: contactSafetyDecisionLabel(input.code),
    auditReason: input.auditReason,
    boundaryLabel: '触达安全治理 / 默认关闭 / 灰度前置 / 人工确认 / 模拟发送 / 不自动发送',
  };
}

export function evaluateContactSafetyGuard(input: {
  tenantId: string;
  institutionId: string | null;
  channelType: MessageDeliveryChannelType;
  policy?: ContactSafetyPolicy | null;
}): ContactSafetyDecision {
  const policy = input.policy ?? defaultContactSafetyPolicy;

  if (policy.optOut) {
    return blockedDecision({
      code: 'blocked_opt_out',
      status: 'skipped',
      deliveryMode: 'mock',
      failureReason: 'opt_out',
      auditReason: 'contact_safety_opt_out',
    });
  }

  if (policy.consent !== 'allowed') {
    return blockedDecision({
      code: 'blocked_consent_missing',
      status: 'skipped',
      deliveryMode: 'mock',
      failureReason: 'consent_missing',
      auditReason: 'contact_safety_consent_missing',
    });
  }

  if (policy.frequencyCap === 'reached') {
    return blockedDecision({
      code: 'blocked_frequency_cap',
      status: 'skipped',
      deliveryMode: 'mock',
      failureReason: 'frequency_cap_reached',
      auditReason: 'contact_safety_frequency_cap_reached',
    });
  }

  if (!policy.channelEnabled || !policy.channelTypeAllowlist.includes(input.channelType)) {
    return blockedDecision({
      code: 'blocked_channel_disabled',
      status: 'external_disabled',
      deliveryMode: 'external_disabled',
      failureReason: 'channel_disabled',
      auditReason: 'channel_gray_external_disabled',
    });
  }

  if (!policy.tenantAllowlist.includes(input.tenantId)) {
    return blockedDecision({
      code: 'blocked_tenant_not_allowlisted',
      status: 'external_disabled',
      deliveryMode: 'external_disabled',
      failureReason: 'tenant_not_allowlisted',
      auditReason: 'channel_gray_tenant_blocked',
    });
  }

  if (input.institutionId && !policy.institutionAllowlist.includes(input.institutionId)) {
    return blockedDecision({
      code: 'blocked_institution_not_allowlisted',
      status: 'external_disabled',
      deliveryMode: 'external_disabled',
      failureReason: 'institution_not_allowlisted',
      auditReason: 'channel_gray_institution_blocked',
    });
  }

  if (
    externalChannelTypes.has(input.channelType) ||
    !policy.sandboxMockOnly ||
    !policy.noRealSend ||
    !mockOnlyChannelTypes.has(input.channelType)
  ) {
    return blockedDecision({
      code: 'blocked_external_channel_disabled',
      status: 'external_disabled',
      deliveryMode: 'external_disabled',
      failureReason: 'external_channel_disabled',
      auditReason: 'channel_gray_external_disabled',
    });
  }

  return {
    code: 'allowed',
    allowed: true,
    status: 'mock_sent',
    deliveryMode: input.channelType === 'manual' ? 'manual' : 'mock',
    failureReason: null,
    safeReasonLabel: contactSafetyDecisionLabel('allowed'),
    auditReason: 'contact_safety_allowed',
    boundaryLabel: '触达安全治理 / 默认关闭 / 灰度前置 / 人工确认 / 模拟发送 / 不自动发送',
  };
}
