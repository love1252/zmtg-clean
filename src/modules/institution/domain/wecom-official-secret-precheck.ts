export const weComOfficialSecretEnvKeys = [
  'ZMTG_WECOM_CORP_ID',
  'ZMTG_WECOM_AGENT_ID',
  'ZMTG_WECOM_AGENT_SECRET',
  'ZMTG_WECOM_REAL_NETWORK_ENABLED',
  'ZMTG_WECOM_REAL_SEND_ENABLED',
] as const;

export const requiredWeComOfficialSecretEnvKeys = [
  'ZMTG_WECOM_CORP_ID',
  'ZMTG_WECOM_AGENT_ID',
  'ZMTG_WECOM_AGENT_SECRET',
] as const;

export type WeComOfficialSecretEnvKey = (typeof weComOfficialSecretEnvKeys)[number];
export type RequiredWeComOfficialSecretEnvKey = (typeof requiredWeComOfficialSecretEnvKeys)[number];

export const weComOfficialSecretPrecheckStatuses = [
  'blocked_missing_config',
  'blocked_real_network_disabled',
  'blocked_real_send_disabled',
  'blocked_real_send_not_implemented',
  'token_preflight_not_requested',
  'token_preflight_ok',
  'token_preflight_auth_failed',
  'token_preflight_failed',
  'token_preflight_network_error',
] as const;

export type WeComOfficialSecretPrecheckStatus = (typeof weComOfficialSecretPrecheckStatuses)[number];

export type WeComOfficialSecretPrecheckReason =
  | 'missing_required_config'
  | 'blocked_real_network_disabled'
  | 'blocked_real_send_disabled'
  | 'blocked_real_send_not_implemented'
  | 'token_preflight_not_requested'
  | 'token_preflight_ok'
  | 'token_preflight_auth_failed'
  | 'token_preflight_failed'
  | 'token_preflight_network_error';

export type WeComOfficialSecretPrecheckAction = 'preflight' | 'send';

export type WeComOfficialSecretPrecheckConfig = {
  corpId: string | null;
  agentId: string | null;
  agentSecret: string | null;
  networkEnabled: boolean;
  realSendEnabled: boolean;
};

export type MaskedWeComOfficialSecretConfigField = {
  configured: boolean;
  maskedValue: string | null;
};

export type MaskedWeComOfficialSecretConfig = {
  corpId: MaskedWeComOfficialSecretConfigField;
  agentId: MaskedWeComOfficialSecretConfigField;
  agentSecret: MaskedWeComOfficialSecretConfigField;
};

export type WeComOfficialSecretPrecheckSummary = {
  configured: boolean;
  missingKeys: RequiredWeComOfficialSecretEnvKey[];
  maskedConfig: MaskedWeComOfficialSecretConfig;
  networkEnabled: boolean;
  realSendEnabled: boolean;
  preflightStatus: WeComOfficialSecretPrecheckStatus;
  reason: WeComOfficialSecretPrecheckReason;
};

export type WeComOfficialTokenPreflightInput = {
  corpId: string;
  agentSecret: string;
};

export type WeComOfficialTokenPreflightOutcome =
  | { ok: true }
  | { ok: false; reason: 'auth_failed' | 'failed' | 'network_error' };

export type WeComOfficialTokenPreflightClient = {
  checkToken(input: WeComOfficialTokenPreflightInput): Promise<WeComOfficialTokenPreflightOutcome>;
};

export type EvaluateWeComOfficialSecretPrecheckInput = {
  config: WeComOfficialSecretPrecheckConfig;
  action?: WeComOfficialSecretPrecheckAction;
  tokenClient?: WeComOfficialTokenPreflightClient;
};

function normalizeConfigValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function maskConfigured(value: string | null | undefined): MaskedWeComOfficialSecretConfigField {
  return normalizeConfigValue(value)
    ? { configured: true, maskedValue: '***configured***' }
    : { configured: false, maskedValue: null };
}

export function getWeComOfficialSecretMissingKeys(
  config: WeComOfficialSecretPrecheckConfig,
): RequiredWeComOfficialSecretEnvKey[] {
  const missingKeys: RequiredWeComOfficialSecretEnvKey[] = [];

  if (!normalizeConfigValue(config.corpId)) missingKeys.push('ZMTG_WECOM_CORP_ID');
  if (!normalizeConfigValue(config.agentId)) missingKeys.push('ZMTG_WECOM_AGENT_ID');
  if (!normalizeConfigValue(config.agentSecret)) missingKeys.push('ZMTG_WECOM_AGENT_SECRET');

  return missingKeys;
}

export function maskWeComOfficialSecretConfig(
  config: WeComOfficialSecretPrecheckConfig,
): MaskedWeComOfficialSecretConfig {
  return {
    corpId: maskConfigured(config.corpId),
    agentId: maskConfigured(config.agentId),
    agentSecret: maskConfigured(config.agentSecret),
  };
}

function createSummary(input: {
  config: WeComOfficialSecretPrecheckConfig;
  status: WeComOfficialSecretPrecheckStatus;
  reason: WeComOfficialSecretPrecheckReason;
}): WeComOfficialSecretPrecheckSummary {
  const missingKeys = getWeComOfficialSecretMissingKeys(input.config);

  return {
    configured: missingKeys.length === 0,
    missingKeys,
    maskedConfig: maskWeComOfficialSecretConfig(input.config),
    networkEnabled: input.config.networkEnabled,
    realSendEnabled: input.config.realSendEnabled,
    preflightStatus: input.status,
    reason: input.reason,
  };
}

export function summarizeWeComOfficialSecretPrecheckConfig(
  config: WeComOfficialSecretPrecheckConfig,
): WeComOfficialSecretPrecheckSummary {
  const missingKeys = getWeComOfficialSecretMissingKeys(config);

  if (missingKeys.length > 0) {
    return createSummary({
      config,
      status: 'blocked_missing_config',
      reason: 'missing_required_config',
    });
  }

  if (!config.networkEnabled) {
    return createSummary({
      config,
      status: 'blocked_real_network_disabled',
      reason: 'blocked_real_network_disabled',
    });
  }

  return createSummary({
    config,
    status: 'token_preflight_not_requested',
    reason: 'token_preflight_not_requested',
  });
}

export async function evaluateWeComOfficialSecretPrecheck(
  input: EvaluateWeComOfficialSecretPrecheckInput,
): Promise<WeComOfficialSecretPrecheckSummary> {
  const action = input.action ?? 'preflight';
  const missingKeys = getWeComOfficialSecretMissingKeys(input.config);

  if (action === 'send') {
    return createSummary({
      config: input.config,
      status: input.config.realSendEnabled ? 'blocked_real_send_not_implemented' : 'blocked_real_send_disabled',
      reason: input.config.realSendEnabled ? 'blocked_real_send_not_implemented' : 'blocked_real_send_disabled',
    });
  }

  if (missingKeys.length > 0) {
    return createSummary({
      config: input.config,
      status: 'blocked_missing_config',
      reason: 'missing_required_config',
    });
  }

  if (!input.config.networkEnabled) {
    return createSummary({
      config: input.config,
      status: 'blocked_real_network_disabled',
      reason: 'blocked_real_network_disabled',
    });
  }

  if (!input.tokenClient) {
    return createSummary({
      config: input.config,
      status: 'token_preflight_failed',
      reason: 'token_preflight_failed',
    });
  }

  const outcome = await input.tokenClient.checkToken({
    corpId: input.config.corpId ?? '',
    agentSecret: input.config.agentSecret ?? '',
  });

  if (outcome.ok) {
    return createSummary({
      config: input.config,
      status: 'token_preflight_ok',
      reason: 'token_preflight_ok',
    });
  }

  if (outcome.reason === 'auth_failed') {
    return createSummary({
      config: input.config,
      status: 'token_preflight_auth_failed',
      reason: 'token_preflight_auth_failed',
    });
  }

  if (outcome.reason === 'network_error') {
    return createSummary({
      config: input.config,
      status: 'token_preflight_network_error',
      reason: 'token_preflight_network_error',
    });
  }

  return createSummary({
    config: input.config,
    status: 'token_preflight_failed',
    reason: 'token_preflight_failed',
  });
}
