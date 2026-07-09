export const weComOfficialInternalMessageProofEnvKeys = [
  'ZMTG_WECOM_CORP_ID',
  'ZMTG_WECOM_AGENT_ID',
  'ZMTG_WECOM_AGENT_SECRET',
  'ZMTG_WECOM_INTERNAL_TEST_USER_ID',
  'ZMTG_WECOM_REAL_NETWORK_ENABLED',
  'ZMTG_WECOM_REAL_SEND_ENABLED',
] as const;

export const requiredWeComOfficialInternalMessageProofEnvKeys = [
  'ZMTG_WECOM_CORP_ID',
  'ZMTG_WECOM_AGENT_ID',
  'ZMTG_WECOM_AGENT_SECRET',
  'ZMTG_WECOM_INTERNAL_TEST_USER_ID',
] as const;

export const weComOfficialInternalMessageProofStatuses = [
  'internal_message_proof_not_requested',
  'blocked_missing_config',
  'blocked_real_network_disabled',
  'blocked_real_send_disabled',
  'blocked_missing_confirmation',
  'blocked_invalid_recipient',
  'internal_message_proof_sent',
  'internal_message_proof_auth_failed',
  'internal_message_proof_send_failed',
  'internal_message_proof_network_error',
] as const;

export const weComOfficialInternalTestMessageContent = '这是一条智美天工企业微信内部通道联调测试消息，无需回复。';
export const weComOfficialInternalMessageProofConfirmation = 'CONFIRM_SEND_INTERNAL_TEST_MESSAGE_ONCE';
export const weComOfficialInternalMessageProofAction = 'send_internal_test_message';

export type WeComOfficialInternalMessageProofEnvKey = (typeof weComOfficialInternalMessageProofEnvKeys)[number];
export type RequiredWeComOfficialInternalMessageProofEnvKey = (typeof requiredWeComOfficialInternalMessageProofEnvKeys)[number];
export type WeComOfficialInternalMessageProofStatus = (typeof weComOfficialInternalMessageProofStatuses)[number];

export type WeComOfficialInternalMessageProofReason =
  | 'internal_message_proof_not_requested'
  | 'missing_required_config'
  | 'blocked_real_network_disabled'
  | 'blocked_real_send_disabled'
  | 'blocked_missing_confirmation'
  | 'blocked_invalid_recipient'
  | 'internal_message_proof_sent'
  | 'internal_message_proof_auth_failed'
  | 'internal_message_proof_send_failed'
  | 'internal_message_proof_network_error';

export type WeComOfficialInternalMessageProofConfig = {
  corpId: string | null;
  agentId: string | null;
  agentSecret: string | null;
  internalTestUserId: string | null;
  networkEnabled: boolean;
  realSendEnabled: boolean;
};

export type MaskedWeComOfficialInternalMessageProofConfigField = {
  configured: boolean;
  maskedValue: string | null;
};

export type MaskedWeComOfficialInternalMessageProofConfig = {
  corpId: MaskedWeComOfficialInternalMessageProofConfigField;
  agentId: MaskedWeComOfficialInternalMessageProofConfigField;
  agentSecret: MaskedWeComOfficialInternalMessageProofConfigField;
  internalTestUserId: MaskedWeComOfficialInternalMessageProofConfigField;
};

export type WeComOfficialInternalMessageProofSummary = {
  configured: boolean;
  missingKeys: RequiredWeComOfficialInternalMessageProofEnvKey[];
  maskedConfig: MaskedWeComOfficialInternalMessageProofConfig;
  networkEnabled: boolean;
  realSendEnabled: boolean;
  messageProofStatus: WeComOfficialInternalMessageProofStatus;
  reason: WeComOfficialInternalMessageProofReason;
};

export type WeComOfficialInternalMessageProofSendInput = {
  corpId: string;
  agentId: string;
  agentSecret: string;
  internalTestUserId: string;
};

export type WeComOfficialInternalMessageProofSendOutcome =
  | { ok: true }
  | { ok: false; reason: 'auth_failed' | 'send_failed' | 'network_error' };

export type WeComOfficialInternalMessageProofClient = {
  sendInternalTestMessage(
    input: WeComOfficialInternalMessageProofSendInput,
  ): Promise<WeComOfficialInternalMessageProofSendOutcome>;
};

export type EvaluateWeComOfficialInternalMessageProofInput = {
  config: WeComOfficialInternalMessageProofConfig;
  confirmed: boolean;
  client?: WeComOfficialInternalMessageProofClient;
};

function normalizeConfigValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function maskConfigured(value: string | null | undefined): MaskedWeComOfficialInternalMessageProofConfigField {
  return normalizeConfigValue(value)
    ? { configured: true, maskedValue: '***configured***' }
    : { configured: false, maskedValue: null };
}

export function getWeComOfficialInternalMessageProofMissingKeys(
  config: WeComOfficialInternalMessageProofConfig,
): RequiredWeComOfficialInternalMessageProofEnvKey[] {
  const missingKeys: RequiredWeComOfficialInternalMessageProofEnvKey[] = [];

  if (!normalizeConfigValue(config.corpId)) missingKeys.push('ZMTG_WECOM_CORP_ID');
  if (!normalizeConfigValue(config.agentId)) missingKeys.push('ZMTG_WECOM_AGENT_ID');
  if (!normalizeConfigValue(config.agentSecret)) missingKeys.push('ZMTG_WECOM_AGENT_SECRET');
  if (!normalizeConfigValue(config.internalTestUserId)) missingKeys.push('ZMTG_WECOM_INTERNAL_TEST_USER_ID');

  return missingKeys;
}

export function maskWeComOfficialInternalMessageProofConfig(
  config: WeComOfficialInternalMessageProofConfig,
): MaskedWeComOfficialInternalMessageProofConfig {
  return {
    corpId: maskConfigured(config.corpId),
    agentId: maskConfigured(config.agentId),
    agentSecret: maskConfigured(config.agentSecret),
    internalTestUserId: maskConfigured(config.internalTestUserId),
  };
}

export function isValidWeComOfficialInternalMessageProofRecipient(value: string | null | undefined) {
  const normalized = normalizeConfigValue(value);
  if (!normalized) return false;
  if (normalized === '@all') return false;
  if (normalized.includes('|')) return false;
  return true;
}

function createSummary(input: {
  config: WeComOfficialInternalMessageProofConfig;
  status: WeComOfficialInternalMessageProofStatus;
  reason: WeComOfficialInternalMessageProofReason;
}): WeComOfficialInternalMessageProofSummary {
  const missingKeys = getWeComOfficialInternalMessageProofMissingKeys(input.config);

  return {
    configured: missingKeys.length === 0,
    missingKeys,
    maskedConfig: maskWeComOfficialInternalMessageProofConfig(input.config),
    networkEnabled: input.config.networkEnabled,
    realSendEnabled: input.config.realSendEnabled,
    messageProofStatus: input.status,
    reason: input.reason,
  };
}

export function summarizeWeComOfficialInternalMessageProofConfig(
  config: WeComOfficialInternalMessageProofConfig,
): WeComOfficialInternalMessageProofSummary {
  const missingKeys = getWeComOfficialInternalMessageProofMissingKeys(config);

  if (missingKeys.length > 0) {
    return createSummary({
      config,
      status: 'blocked_missing_config',
      reason: 'missing_required_config',
    });
  }

  if (!isValidWeComOfficialInternalMessageProofRecipient(config.internalTestUserId)) {
    return createSummary({
      config,
      status: 'blocked_invalid_recipient',
      reason: 'blocked_invalid_recipient',
    });
  }

  if (!config.networkEnabled) {
    return createSummary({
      config,
      status: 'blocked_real_network_disabled',
      reason: 'blocked_real_network_disabled',
    });
  }

  if (!config.realSendEnabled) {
    return createSummary({
      config,
      status: 'blocked_real_send_disabled',
      reason: 'blocked_real_send_disabled',
    });
  }

  return createSummary({
    config,
    status: 'internal_message_proof_not_requested',
    reason: 'internal_message_proof_not_requested',
  });
}

export async function evaluateWeComOfficialInternalMessageProof(
  input: EvaluateWeComOfficialInternalMessageProofInput,
): Promise<WeComOfficialInternalMessageProofSummary> {
  const missingKeys = getWeComOfficialInternalMessageProofMissingKeys(input.config);

  if (missingKeys.length > 0) {
    return createSummary({
      config: input.config,
      status: 'blocked_missing_config',
      reason: 'missing_required_config',
    });
  }

  if (!isValidWeComOfficialInternalMessageProofRecipient(input.config.internalTestUserId)) {
    return createSummary({
      config: input.config,
      status: 'blocked_invalid_recipient',
      reason: 'blocked_invalid_recipient',
    });
  }

  if (!input.config.networkEnabled) {
    return createSummary({
      config: input.config,
      status: 'blocked_real_network_disabled',
      reason: 'blocked_real_network_disabled',
    });
  }

  if (!input.config.realSendEnabled) {
    return createSummary({
      config: input.config,
      status: 'blocked_real_send_disabled',
      reason: 'blocked_real_send_disabled',
    });
  }

  if (!input.confirmed) {
    return createSummary({
      config: input.config,
      status: 'blocked_missing_confirmation',
      reason: 'blocked_missing_confirmation',
    });
  }

  if (!input.client) {
    return createSummary({
      config: input.config,
      status: 'internal_message_proof_network_error',
      reason: 'internal_message_proof_network_error',
    });
  }

  const outcome = await input.client.sendInternalTestMessage({
    corpId: input.config.corpId ?? '',
    agentId: input.config.agentId ?? '',
    agentSecret: input.config.agentSecret ?? '',
    internalTestUserId: input.config.internalTestUserId ?? '',
  });

  if (outcome.ok) {
    return createSummary({
      config: input.config,
      status: 'internal_message_proof_sent',
      reason: 'internal_message_proof_sent',
    });
  }

  if (outcome.reason === 'auth_failed') {
    return createSummary({
      config: input.config,
      status: 'internal_message_proof_auth_failed',
      reason: 'internal_message_proof_auth_failed',
    });
  }

  if (outcome.reason === 'network_error') {
    return createSummary({
      config: input.config,
      status: 'internal_message_proof_network_error',
      reason: 'internal_message_proof_network_error',
    });
  }

  return createSummary({
    config: input.config,
    status: 'internal_message_proof_send_failed',
    reason: 'internal_message_proof_send_failed',
  });
}
