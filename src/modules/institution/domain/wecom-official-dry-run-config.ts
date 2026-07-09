import type { AuditReason } from '@/modules/audit/domain/audit-events';
import type { RealChannelPreflightStatus } from '@/modules/institution/domain/real-channel-preflight';
import type { AccessRole } from '@/modules/security/domain/access-control';

export const officialWeComDryRunRoutes = [
  'official_wecom_self_built',
  'official_wecom_third_party',
  'official_wecom_service_provider',
] as const;

export type OfficialWeComDryRunRoute = (typeof officialWeComDryRunRoutes)[number];
export type WeComDryRunRouteInput = OfficialWeComDryRunRoute | 'account_custody' | null;

export const officialWeComDryRunRouteLabels = {
  official_wecom_self_built: '官方企业微信自建应用路线',
  official_wecom_third_party: '官方企业微信第三方应用路线',
  official_wecom_service_provider: '官方企业微信服务商路线',
  account_custody: '账号托管路线（本 dry-run 不允许）',
  not_selected: '未选择官方企业微信路线',
} as const satisfies Record<OfficialWeComDryRunRoute | 'account_custody' | 'not_selected', string>;

export const weComOfficialDryRunConfigStatuses = [
  'not_configured',
  'placeholder_ready',
  'dry_run_ready',
  'blocked_missing_institution',
  'blocked_missing_route',
  'blocked_account_custody_route',
  'blocked_missing_callback_url',
  'blocked_missing_manual_confirmation',
  'blocked_sensitive_value_detected',
  'blocked_secret_read_attempt',
  'blocked_real_network_forbidden',
  'blocked_real_send_forbidden',
  'blocked_preflight_not_ready',
] as const;

export type WeComOfficialDryRunConfigStatus = (typeof weComOfficialDryRunConfigStatuses)[number];

export const weComOfficialDryRunConfigStatusLabels = {
  not_configured: '未配置官方企业微信 dry-run 占位',
  placeholder_ready: '低敏占位已准备，等待 dry-run 条件',
  dry_run_ready: '允许进入官方企业微信 dry-run 模拟评估',
  blocked_missing_institution: '缺少测试机构低敏引用，已阻断',
  blocked_missing_route: '缺少官方路线选择，已阻断',
  blocked_account_custody_route: '账号托管路线不允许进入本 dry-run',
  blocked_missing_callback_url: '缺少 callback URL 占位，已阻断',
  blocked_missing_manual_confirmation: '缺少人工确认，已阻断',
  blocked_sensitive_value_detected: '检测到敏感值或真实通道标识，已阻断',
  blocked_secret_read_attempt: '检测到 secret 读取企图，已阻断',
  blocked_real_network_forbidden: '检测到真实出网企图，已阻断',
  blocked_real_send_forbidden: '检测到真实发送启用企图，已阻断',
  blocked_preflight_not_ready: '4E preflight 尚未 mock_ready，已阻断',
} as const satisfies Record<WeComOfficialDryRunConfigStatus, string>;

export const weComOfficialDryRunAuditReasons = [
  'wecom_dry_run_config_viewed',
  'wecom_dry_run_config_evaluated',
  'wecom_dry_run_ready',
  'wecom_dry_run_blocked',
  'wecom_dry_run_sensitive_value_blocked',
  'wecom_dry_run_secret_read_blocked',
] as const satisfies readonly AuditReason[];

export type WeComOfficialDryRunAuditReason = (typeof weComOfficialDryRunAuditReasons)[number];

export type WeComOfficialDryRunConfigInput = {
  tenantId: string;
  institutionId: string | null;
  operatorRole: AccessRole;
  officialRoute: WeComDryRunRouteInput;
  proofInstitutionRef: string | null;
  callbackUrlPlaceholder: string | null;
  hasTestWeComEnvironment: boolean;
  hasCallbackDomainPlaceholder: boolean;
  hasSecretKeeperConfirmed: boolean;
  hasManualConfirmation: boolean;
  preflightStatus: RealChannelPreflightStatus | 'not_configured' | null;
  proofEligibleMock: boolean;
  allowRealSend: boolean;
  externalChannelEnabled: boolean;
  realSendAllowed: boolean;
  dryRunOnly: boolean;
  hasRealNetworkAttempt?: boolean;
  hasRealSendAttempt?: boolean;
  hasSensitiveValueInput?: boolean;
  hasSecretReadAttempt?: boolean;
};

export type WeComOfficialDryRunConfigResult = {
  tenantId: string;
  institutionId: string | null;
  operatorRole: AccessRole;
  officialRoute: WeComDryRunRouteInput;
  configStatus: WeComOfficialDryRunConfigStatus;
  configStatusLabel: string;
  dryRunReady: boolean;
  routeLabel: string;
  proofInstitutionRef: string | null;
  callbackUrlPlaceholder: string | null;
  requiredHumanActions: string[];
  blockReasons: string[];
  lowSensitiveExplanation: string;
  noSecretStored: true;
  noSecretRead: true;
  noRealNetwork: true;
  noRealSend: true;
  allowRealSend: false;
  externalChannelEnabled: false;
  realSendAllowed: false;
  dryRunOnly: true;
  auditReason: WeComOfficialDryRunAuditReason;
  timelineSummary: string;
};

export type WeComOfficialDryRunConfigStats = {
  dryRunConfigCheckCount: number;
  dryRunReadyCount: number;
  dryRunSecretInputBlockedCount: number;
  dryRunRealNetworkBlockedCount: number;
  dryRunRealSendBlockedCount: number;
  dryRunCallbackPlaceholderMissingCount: number;
  dryRunManualConfirmationMissingCount: number;
};

const officialRoutes = new Set<WeComDryRunRouteInput>(officialWeComDryRunRoutes);
const placeholderPattern = /(?:placeholder|mock|dry[-_ ]?run|example|test|低敏|占位|待配置)/iu;
const forbiddenKeyPattern = /^(?:corpId|corp_id|secret|clientSecret|client_secret|appSecret|app_secret|token|access_token|refresh_token|callbackToken|callback_token|encodingAESKey|encoding_aes_key|webhook|webhookSecret|webhook_secret|webhookToken|webhook_token|webhookPayload|webhook_payload|external_userid|externalUserid|userid|user_id|agentId|agent_id|appId|app_id|DATABASE_URL|databaseUrl|database_url|hisPayload|his_payload)$/u;
const secretReadKeyPattern = /(?:readSecret|secretRead|secret_read|processEnv|process_env|envLocal|env_local|dotenv)/u;
const secretReadValuePattern = /(?:process\.env|\.env\.local|读取\s*secret|读取\s*token|读取\s*密钥|read\s+secret|read\s+token)/iu;
const realNetworkKeyPattern = /(?:realNetworkAttempt|networkAttempt|fetchWeCom|wecomApiCall|apiCallAttempt|httpRequestAttempt|outboundRequest)/u;
const realNetworkValuePattern = /(?:qyapi\.weixin\.qq\.com|api\.weixin\.qq\.com|真实\s*出网|真实\s*网络|调用\s*企业微信|fetch\s*wecom|call\s*wecom)/iu;
const sensitiveValuePattern = /(?:corp[_-]?id|client[_-]?secret|app[_-]?secret|access[_-]?token|refresh[_-]?token|callback[_-]?token|encoding[_-]?aes[_-]?key|webhook[_-]?(?:secret|token|payload)|external[_-]?userid|\buserid\b|agent[_-]?id|app[_-]?id|database[_-]?url|postgres:\/\/|his\s*payload|真实\s*(?:corp|secret|token|userid|webhook)|sk_live|sk_test|zmtg_sk_)/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function visitPayload(value: unknown, predicate: (key: string | null, value: unknown) => boolean, key: string | null = null): boolean {
  if (predicate(key, value)) return true;
  if (Array.isArray(value)) return value.some((item) => visitPayload(item, predicate));
  if (isRecord(value)) {
    return Object.entries(value).some(([entryKey, item]) => visitPayload(item, predicate, entryKey));
  }

  return false;
}

function hasSecretReadPayload(value: unknown) {
  return visitPayload(value, (key, item) => {
    if (key && secretReadKeyPattern.test(key)) return true;
    return typeof item === 'string' && secretReadValuePattern.test(item);
  });
}

function hasSensitiveValuePayload(value: unknown) {
  return visitPayload(value, (key, item) => {
    if (key && forbiddenKeyPattern.test(key)) return true;
    return typeof item === 'string' && sensitiveValuePattern.test(item);
  });
}

function hasRealNetworkPayload(value: unknown) {
  return visitPayload(value, (key, item) => {
    if (key && realNetworkKeyPattern.test(key)) return true;
    return typeof item === 'string' && realNetworkValuePattern.test(item);
  });
}

function safeText(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, 500);
  return normalized && !sensitiveValuePattern.test(normalized) && !secretReadValuePattern.test(normalized)
    ? normalized
    : fallback;
}

function isOfficialRoute(route: WeComDryRunRouteInput): route is OfficialWeComDryRunRoute {
  return officialRoutes.has(route);
}

function hasCallbackPlaceholder(value: string | null) {
  if (!value) return false;
  return placeholderPattern.test(value) && !sensitiveValuePattern.test(value);
}

function statusFromFlags(input: {
  raw: WeComOfficialDryRunConfigInput;
  hasSensitiveValue: boolean;
  hasSecretRead: boolean;
  hasRealNetworkAttempt: boolean;
  hasRealSendAttempt: boolean;
}): WeComOfficialDryRunConfigStatus {
  if (input.hasSecretRead) return 'blocked_secret_read_attempt';
  if (input.hasSensitiveValue) return 'blocked_sensitive_value_detected';
  if (input.hasRealNetworkAttempt) return 'blocked_real_network_forbidden';
  if (input.hasRealSendAttempt) return 'blocked_real_send_forbidden';
  if (!input.raw.institutionId || !input.raw.proofInstitutionRef) return 'blocked_missing_institution';
  if (!input.raw.officialRoute) return 'blocked_missing_route';
  if (input.raw.officialRoute === 'account_custody') return 'blocked_account_custody_route';
  if (!isOfficialRoute(input.raw.officialRoute)) return 'blocked_missing_route';
  if (!input.raw.hasTestWeComEnvironment) return 'not_configured';
  if (!input.raw.hasCallbackDomainPlaceholder || !hasCallbackPlaceholder(input.raw.callbackUrlPlaceholder)) return 'blocked_missing_callback_url';
  if (!input.raw.hasSecretKeeperConfirmed) return 'not_configured';
  if (!input.raw.hasManualConfirmation) return 'blocked_missing_manual_confirmation';
  if (input.raw.preflightStatus !== 'mock_ready' || !input.raw.proofEligibleMock) return 'blocked_preflight_not_ready';
  if (!input.raw.dryRunOnly) return 'blocked_real_send_forbidden';
  return 'dry_run_ready';
}

function auditReasonFor(input: {
  status: WeComOfficialDryRunConfigStatus;
  dryRunReady: boolean;
}): WeComOfficialDryRunAuditReason {
  if (input.status === 'blocked_secret_read_attempt') return 'wecom_dry_run_secret_read_blocked';
  if (input.status === 'blocked_sensitive_value_detected') return 'wecom_dry_run_sensitive_value_blocked';
  if (input.dryRunReady) return 'wecom_dry_run_ready';
  if (input.status.startsWith('blocked_')) return 'wecom_dry_run_blocked';
  return 'wecom_dry_run_config_evaluated';
}

export function evaluateWeComOfficialDryRunConfig(input: WeComOfficialDryRunConfigInput): WeComOfficialDryRunConfigResult {
  const hasSecretRead = Boolean(input.hasSecretReadAttempt);
  const hasSensitiveValue = Boolean(input.hasSensitiveValueInput);
  const hasRealNetworkAttempt = Boolean(input.hasRealNetworkAttempt);
  const hasRealSendAttempt = Boolean(
    input.hasRealSendAttempt || input.allowRealSend || input.externalChannelEnabled || input.realSendAllowed,
  );
  const status = statusFromFlags({
    raw: input,
    hasSensitiveValue,
    hasSecretRead,
    hasRealNetworkAttempt,
    hasRealSendAttempt,
  });
  const dryRunReady = status === 'dry_run_ready';
  const blockReasons: string[] = [];
  const requiredHumanActions: string[] = [];

  if (hasSecretRead) {
    blockReasons.push('检测到读取 secret、token 或本地环境文件的企图，已阻断。');
    requiredHumanActions.push('不要读取 .env.local 或 process.env 中的真实密钥；仅使用低敏占位。');
  }

  if (hasSensitiveValue) {
    blockReasons.push('输入包含 corpId、secret、token、encodingAESKey、webhook、userid 或其他真实标识，已阻断。');
    requiredHumanActions.push('移除真实密钥、真实企业微信标识和 webhook payload，只保留低敏占位。');
  }

  if (hasRealNetworkAttempt) {
    blockReasons.push('检测到真实企业微信 / 微信 API 出网企图，已阻断。');
    requiredHumanActions.push('保持本地 dry-run，不调用企业微信、微信、短信、HIS 或 webhook。');
  }

  if (hasRealSendAttempt || !input.dryRunOnly) {
    blockReasons.push('检测到真实发送或外部通道启用企图，已强制关闭并阻断。');
    requiredHumanActions.push('保持 allowRealSend=false、externalChannelEnabled=false、realSendAllowed=false。');
  }

  if (!input.institutionId || !input.proofInstitutionRef) {
    blockReasons.push('缺少测试机构低敏引用，不能进入单机构 dry-run。');
    requiredHumanActions.push('补充测试机构低敏引用，不写真实机构敏感材料。');
  }

  if (!input.officialRoute) {
    blockReasons.push('缺少官方企业微信路线选择。');
    requiredHumanActions.push('选择官方自建应用、第三方应用或服务商路线。');
  }

  if (input.officialRoute === 'account_custody') {
    blockReasons.push('账号托管路线不允许进入官方企业微信 dry-run。');
    requiredHumanActions.push('确认排除扫码、端口、机器编号、uip 和第三方账号托管路线。');
  }

  if (!input.hasTestWeComEnvironment) {
    blockReasons.push('测试企业微信环境尚未用低敏占位确认。');
    requiredHumanActions.push('线下准备测试企业微信环境，本任务只记录低敏确认状态。');
  }

  if (!input.hasCallbackDomainPlaceholder || !hasCallbackPlaceholder(input.callbackUrlPlaceholder)) {
    blockReasons.push('缺少 callback URL 占位，不能写真实 callback 或 webhook。');
    requiredHumanActions.push('补充 callback URL 占位，例如 example / placeholder / dry-run 低敏地址。');
  }

  if (!input.hasSecretKeeperConfirmed) {
    blockReasons.push('secret 保管方式尚未确认；本任务不读取、不保存 secret。');
    requiredHumanActions.push('线下确认 secret 保管人和方式，只在系统记录“已确认 / 未确认”。');
  }

  if (!input.hasManualConfirmation) {
    blockReasons.push('缺少人工确认，不能进入 dry-run。');
    requiredHumanActions.push('由负责人完成人工确认后再评估 dry-run。');
  }

  if (input.preflightStatus !== 'mock_ready' || !input.proofEligibleMock) {
    blockReasons.push('4E real-channel preflight 尚未 mock_ready，不能进入官方路线 dry-run。');
    requiredHumanActions.push('先完成 4E preflight，并确认 proofEligibleMock=true。');
  }

  const routeLabel = input.officialRoute
    ? officialWeComDryRunRouteLabels[input.officialRoute] ?? officialWeComDryRunRouteLabels.not_selected
    : officialWeComDryRunRouteLabels.not_selected;
  const auditReason = auditReasonFor({ status, dryRunReady });
  const lowSensitiveExplanation = dryRunReady
    ? '官方企业微信路线 dry-run 低敏占位已满足；仍不读取 secret、不真实出网、不真实发送。'
    : '当前仅评估官方企业微信 dry-run 配置骨架，真实接入和真实发送继续关闭。';

  return {
    tenantId: safeText(input.tenantId, 'tenant-low-sensitive'),
    institutionId: input.institutionId ? safeText(input.institutionId, 'institution-low-sensitive') : null,
    operatorRole: input.operatorRole,
    officialRoute: input.officialRoute,
    configStatus: status,
    configStatusLabel: weComOfficialDryRunConfigStatusLabels[status],
    dryRunReady,
    routeLabel,
    proofInstitutionRef: input.proofInstitutionRef ? safeText(input.proofInstitutionRef, '机构低敏引用') : null,
    callbackUrlPlaceholder: input.callbackUrlPlaceholder ? safeText(input.callbackUrlPlaceholder, 'callback-url-placeholder') : null,
    requiredHumanActions: [...new Set(requiredHumanActions.map((action) => safeText(action, '低敏人工动作已隐藏。')))],
    blockReasons: [...new Set(blockReasons.map((reason) => safeText(reason, '低敏阻断原因已隐藏。')))],
    lowSensitiveExplanation: safeText(lowSensitiveExplanation, '低敏 dry-run 配置说明已隐藏。'),
    noSecretStored: true,
    noSecretRead: true,
    noRealNetwork: true,
    noRealSend: true,
    allowRealSend: false,
    externalChannelEnabled: false,
    realSendAllowed: false,
    dryRunOnly: true,
    auditReason,
    timelineSummary: safeText(
      `官方企业微信 dry-run 配置：${weComOfficialDryRunConfigStatusLabels[status]}；${routeLabel}；noSecretRead=true；noRealNetwork=true；noRealSend=true。`,
      '官方企业微信 dry-run 配置已记录低敏时间线。',
    ),
  };
}

export function createDefaultWeComOfficialDryRunConfigInput(
  overrides: Partial<WeComOfficialDryRunConfigInput> = {},
): WeComOfficialDryRunConfigInput {
  return {
    tenantId: 'tenant-low-sensitive-001',
    institutionId: 'institution-low-sensitive-001',
    operatorRole: 'tenant_admin',
    officialRoute: 'official_wecom_self_built',
    proofInstitutionRef: '机构 ZM****001',
    callbackUrlPlaceholder: 'https://callback-placeholder.example.test/wecom/dry-run',
    hasTestWeComEnvironment: true,
    hasCallbackDomainPlaceholder: true,
    hasSecretKeeperConfirmed: false,
    hasManualConfirmation: false,
    preflightStatus: 'not_configured',
    proofEligibleMock: false,
    allowRealSend: false,
    externalChannelEnabled: false,
    realSendAllowed: false,
    dryRunOnly: true,
    hasRealNetworkAttempt: false,
    hasRealSendAttempt: false,
    hasSensitiveValueInput: false,
    hasSecretReadAttempt: false,
    ...overrides,
  };
}

export function assertWeComOfficialDryRunLowSensitivePayload(input: unknown) {
  return !hasSensitiveValuePayload(input) && !hasSecretReadPayload(input) && !hasRealNetworkPayload(input);
}

export function detectWeComOfficialDryRunPayloadGuards(input: unknown) {
  return {
    hasSensitiveValueInput: hasSensitiveValuePayload(input),
    hasSecretReadAttempt: hasSecretReadPayload(input),
    hasRealNetworkAttempt: hasRealNetworkPayload(input),
  };
}

export function buildWeComOfficialDryRunConfigStats(
  results: readonly WeComOfficialDryRunConfigResult[],
): WeComOfficialDryRunConfigStats {
  return {
    dryRunConfigCheckCount: results.length,
    dryRunReadyCount: results.filter((result) => result.dryRunReady).length,
    dryRunSecretInputBlockedCount: results.filter((result) =>
      result.configStatus === 'blocked_sensitive_value_detected' || result.configStatus === 'blocked_secret_read_attempt',
    ).length,
    dryRunRealNetworkBlockedCount: results.filter((result) => result.configStatus === 'blocked_real_network_forbidden').length,
    dryRunRealSendBlockedCount: results.filter((result) => result.configStatus === 'blocked_real_send_forbidden' || !result.realSendAllowed).length,
    dryRunCallbackPlaceholderMissingCount: results.filter((result) => result.configStatus === 'blocked_missing_callback_url').length,
    dryRunManualConfirmationMissingCount: results.filter((result) =>
      result.configStatus === 'blocked_missing_manual_confirmation' || result.blockReasons.some((reason) => reason.includes('缺少人工确认')),
    ).length,
  };
}

export function createWeComOfficialDryRunTimelineMetadata(
  result: WeComOfficialDryRunConfigResult,
): Record<string, string | null> {
  return {
    weComDryRunOfficialRoute: result.officialRoute,
    weComDryRunRouteLabel: result.routeLabel,
    weComDryRunConfigStatus: result.configStatus,
    weComDryRunConfigStatusLabel: result.configStatusLabel,
    weComDryRunReady: String(result.dryRunReady),
    weComDryRunNoSecretStored: String(result.noSecretStored),
    weComDryRunNoSecretRead: String(result.noSecretRead),
    weComDryRunNoRealNetwork: String(result.noRealNetwork),
    weComDryRunNoRealSend: String(result.noRealSend),
    allowRealSend: String(result.allowRealSend),
    externalChannelEnabled: String(result.externalChannelEnabled),
    realSendAllowed: String(result.realSendAllowed),
    weComDryRunAuditReason: result.auditReason,
  };
}
