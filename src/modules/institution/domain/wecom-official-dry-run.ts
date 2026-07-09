import type { AuditReason } from '@/modules/audit/domain/audit-events';
import type { RealChannelPreflightStatus } from '@/modules/institution/domain/real-channel-preflight';
import {
  officialWeComDryRunRouteLabels,
  officialWeComDryRunRoutes,
  type WeComDryRunRouteInput,
  type WeComOfficialDryRunConfigStatus,
} from '@/modules/institution/domain/wecom-official-dry-run-config';
import type { AccessRole } from '@/modules/security/domain/access-control';

export const weComOfficialDryRunStatuses = [
  'not_ready',
  'plan_ready',
  'mock_dry_run_completed',
  'blocked_config_not_ready',
  'blocked_preflight_not_ready',
  'blocked_missing_manual_confirmation',
  'blocked_no_secret_placeholder',
  'blocked_secret_read_attempt',
  'blocked_real_network_disabled',
  'blocked_real_send_forbidden',
  'blocked_sensitive_payload',
  'blocked_account_custody_route',
  'blocked_route_not_official',
] as const;

export type WeComOfficialDryRunStatus = (typeof weComOfficialDryRunStatuses)[number];

export const weComOfficialDryRunStatusLabels = {
  not_ready: '官方路线 dry-run 尚未就绪',
  plan_ready: '官方路线 dry-run 执行计划已生成',
  mock_dry_run_completed: '官方路线 mock dry-run 已完成',
  blocked_config_not_ready: '官方企业微信 dry-run 配置未 ready，已阻断',
  blocked_preflight_not_ready: '4E preflight 未 mock_ready，已阻断',
  blocked_missing_manual_confirmation: '缺少人工确认，已阻断',
  blocked_no_secret_placeholder: '缺少 secret 低敏占位确认，已阻断',
  blocked_secret_read_attempt: '检测到 secret 读取企图，已阻断',
  blocked_real_network_disabled: '真实网络默认禁用，已阻断',
  blocked_real_send_forbidden: '真实发送禁止，已阻断',
  blocked_sensitive_payload: '检测到敏感 payload，已阻断',
  blocked_account_custody_route: '账号托管路线不允许进入官方 dry-run，已阻断',
  blocked_route_not_official: '非官方企业微信路线，已阻断',
} as const satisfies Record<WeComOfficialDryRunStatus, string>;

export const weComOfficialDryRunNetworkModes = [
  'disabled',
  'mock',
  'live_dry_run_requested',
] as const;

export type WeComOfficialDryRunNetworkMode = (typeof weComOfficialDryRunNetworkModes)[number];

export const weComOfficialDryRunAuditReasons = [
  'wecom_official_dry_run_viewed',
  'wecom_official_dry_run_evaluated',
  'wecom_official_dry_run_plan_ready',
  'wecom_official_dry_run_mock_completed',
  'wecom_official_dry_run_blocked',
  'wecom_official_dry_run_sensitive_payload_blocked',
  'wecom_official_dry_run_real_network_blocked',
  'wecom_official_dry_run_real_send_blocked',
] as const satisfies readonly AuditReason[];

export type WeComOfficialDryRunAuditReason = (typeof weComOfficialDryRunAuditReasons)[number];

export type WeComOfficialDryRunInput = {
  tenantId: string;
  institutionId: string;
  operatorRole: AccessRole;
  officialRoute: WeComDryRunRouteInput;
  dryRunConfigStatus: WeComOfficialDryRunConfigStatus;
  preflightStatus: RealChannelPreflightStatus | 'not_configured' | null;
  proofEligibleMock: boolean;
  hasManualConfirmation: boolean;
  hasSecretPlaceholder: boolean;
  hasCallbackUrlPlaceholder: boolean;
  networkMode: WeComOfficialDryRunNetworkMode;
  allowRealSend: boolean;
  externalChannelEnabled: boolean;
  realSendAllowed: boolean;
  noSecretRead: boolean;
  noRealSend: boolean;
  dryRunOnly: boolean;
  hasSensitivePayload?: boolean;
  hasSecretReadAttempt?: boolean;
  hasRealNetworkAttempt?: boolean;
  hasRealSendAttempt?: boolean;
};

export type WeComOfficialDryRunStep = {
  id: string;
  label: string;
  status: 'ready' | 'completed' | 'blocked' | 'skipped';
};

export type WeComOfficialDryRunResult = {
  tenantId: string;
  institutionId: string;
  operatorRole: AccessRole;
  officialRoute: WeComDryRunRouteInput;
  dryRunStatus: WeComOfficialDryRunStatus;
  dryRunStatusLabel: string;
  dryRunPlanReady: boolean;
  mockDryRunCompleted: boolean;
  routeLabel: string;
  networkMode: WeComOfficialDryRunNetworkMode;
  blockReasons: string[];
  requiredHumanActions: string[];
  dryRunSteps: WeComOfficialDryRunStep[];
  lowSensitiveExplanation: string;
  noRealSend: true;
  noRealNetwork: true;
  noSecretRead: true;
  noSecretOutput: true;
  allowRealSend: false;
  externalChannelEnabled: false;
  realSendAllowed: false;
  auditReason: WeComOfficialDryRunAuditReason;
  timelineSummary: string;
};

export type WeComOfficialDryRunStats = {
  officialDryRunCheckCount: number;
  officialDryRunPlanReadyCount: number;
  officialDryRunMockCompletedCount: number;
  officialDryRunRealNetworkBlockedCount: number;
  officialDryRunRealSendBlockedCount: number;
  officialDryRunSensitivePayloadBlockedCount: number;
  officialDryRunMissingManualConfirmationBlockedCount: number;
};

const officialRouteSet = new Set<WeComDryRunRouteInput>(officialWeComDryRunRoutes);
const forbiddenKeyPattern = /^(?:corpId|corp_id|secret|clientSecret|client_secret|appSecret|app_secret|token|access_token|refresh_token|callbackToken|callback_token|encodingAESKey|encoding_aes_key|webhook|webhookSecret|webhook_secret|webhookToken|webhook_token|webhookPayload|webhook_payload|external_userid|externalUserid|userid|user_id|agentId|agent_id|appId|app_id|DATABASE_URL|databaseUrl|database_url|hisPayload|his_payload|chatRecord|chat_record|rawMessage|raw_message)$/u;
const secretReadKeyPattern = /(?:readSecret|secretRead|secret_read|processEnv|process_env|envLocal|env_local|dotenv)/u;
const realNetworkKeyPattern = /(?:realNetworkAttempt|networkAttempt|fetchWeCom|wecomApiCall|apiCallAttempt|httpRequestAttempt|outboundRequest|endpoint|url)/u;
const realSendKeyPattern = /(?:realSendAttempt|sendAttempt|sendMessage|messageSend|externalSend|pushToWeCom|deliverToWeCom)/u;
const sensitiveValuePattern = /(?:corp[_-]?id|client[_-]?secret|app[_-]?secret|access[_-]?token|refresh[_-]?token|callback[_-]?token|encoding[_-]?aes[_-]?key|webhook[_-]?(?:secret|token|payload)|external[_-]?userid|\buserid\b|agent[_-]?id|app[_-]?id|database[_-]?url|postgres:\/\/|his\s*payload|原始聊天|聊天原文|真实\s*(?:corp|secret|token|userid|webhook)|sk_live|sk_test|zmtg_sk_)/iu;
const secretReadValuePattern = /(?:process\.env|\.env\.local|读取\s*secret|读取\s*token|读取\s*密钥|read\s+secret|read\s+token)/iu;
const realNetworkValuePattern = /(?:qyapi\.weixin\.qq\.com|api\.weixin\.qq\.com|真实\s*出网|真实\s*网络|调用\s*企业微信|fetch\s*wecom|call\s*wecom)/iu;
const realSendValuePattern = /(?:真实\s*发送|真实\s*触达|发送\s*企业微信|send\s+wecom|deliver\s+message|push\s+message)/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function visitPayload(value: unknown, predicate: (key: string | null, value: unknown) => boolean, key: string | null = null): boolean {
  if (predicate(key, value)) return true;
  if (Array.isArray(value)) return value.some((item) => visitPayload(item, predicate));
  if (isRecord(value)) return Object.entries(value).some(([entryKey, item]) => visitPayload(item, predicate, entryKey));
  return false;
}

function hasSensitivePayload(value: unknown) {
  return visitPayload(value, (key, item) => {
    if (key && forbiddenKeyPattern.test(key)) return true;
    return typeof item === 'string' && sensitiveValuePattern.test(item);
  });
}

function hasSecretReadPayload(value: unknown) {
  return visitPayload(value, (key, item) => {
    if (key && secretReadKeyPattern.test(key)) return true;
    return typeof item === 'string' && secretReadValuePattern.test(item);
  });
}

function hasRealNetworkPayload(value: unknown) {
  return visitPayload(value, (key, item) => {
    if (key && realNetworkKeyPattern.test(key) && typeof item === 'string' && realNetworkValuePattern.test(item)) return true;
    return typeof item === 'string' && realNetworkValuePattern.test(item);
  });
}

function hasRealSendPayload(value: unknown) {
  return visitPayload(value, (key, item) => {
    if (key && realSendKeyPattern.test(key)) return true;
    return typeof item === 'string' && realSendValuePattern.test(item);
  });
}

function safeText(value: string | null | undefined, fallback: string) {
  const normalized = String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, 500);
  return normalized &&
    !sensitiveValuePattern.test(normalized) &&
    !secretReadValuePattern.test(normalized) &&
    !realNetworkValuePattern.test(normalized) &&
    !realSendValuePattern.test(normalized)
    ? normalized
    : fallback;
}

function isOfficialRoute(route: WeComDryRunRouteInput): boolean {
  return officialRouteSet.has(route);
}

function statusFromInput(input: WeComOfficialDryRunInput): WeComOfficialDryRunStatus {
  if (!input.tenantId || !input.institutionId) return 'not_ready';
  if (input.hasSecretReadAttempt || !input.noSecretRead) return 'blocked_secret_read_attempt';
  if (input.hasSensitivePayload) return 'blocked_sensitive_payload';
  if (input.hasRealSendAttempt || input.allowRealSend || input.externalChannelEnabled || input.realSendAllowed || !input.noRealSend || !input.dryRunOnly) {
    return 'blocked_real_send_forbidden';
  }
  if (input.hasRealNetworkAttempt || input.networkMode === 'live_dry_run_requested') return 'blocked_real_network_disabled';
  if (input.officialRoute === 'account_custody') return 'blocked_account_custody_route';
  if (!isOfficialRoute(input.officialRoute)) return 'blocked_route_not_official';
  if (input.dryRunConfigStatus !== 'dry_run_ready' || !input.hasCallbackUrlPlaceholder) return 'blocked_config_not_ready';
  if (input.preflightStatus !== 'mock_ready' || !input.proofEligibleMock) return 'blocked_preflight_not_ready';
  if (!input.hasManualConfirmation) return 'blocked_missing_manual_confirmation';
  if (!input.hasSecretPlaceholder) return 'blocked_no_secret_placeholder';
  if (input.networkMode === 'disabled') return 'plan_ready';
  return 'mock_dry_run_completed';
}

function auditReasonFor(status: WeComOfficialDryRunStatus): WeComOfficialDryRunAuditReason {
  if (status === 'plan_ready') return 'wecom_official_dry_run_plan_ready';
  if (status === 'mock_dry_run_completed') return 'wecom_official_dry_run_mock_completed';
  if (status === 'blocked_sensitive_payload' || status === 'blocked_secret_read_attempt') {
    return 'wecom_official_dry_run_sensitive_payload_blocked';
  }
  if (status === 'blocked_real_network_disabled') return 'wecom_official_dry_run_real_network_blocked';
  if (status === 'blocked_real_send_forbidden') return 'wecom_official_dry_run_real_send_blocked';
  if (status.startsWith('blocked_') || status === 'not_ready') return 'wecom_official_dry_run_blocked';
  return 'wecom_official_dry_run_evaluated';
}

function createSteps(status: WeComOfficialDryRunStatus): WeComOfficialDryRunStep[] {
  const blocked = status.startsWith('blocked_') || status === 'not_ready';
  const planReady = status === 'plan_ready' || status === 'mock_dry_run_completed';
  return [
    {
      id: 'validate-official-route',
      label: '校验官方企业微信路线，排除账号托管和非官方路线。',
      status: blocked ? 'blocked' : 'completed',
    },
    {
      id: 'validate-config-and-preflight',
      label: '复用 dry-run config 与 4E preflight，确认 dry_run_ready / mock_ready。',
      status: blocked ? 'blocked' : 'completed',
    },
    {
      id: 'build-local-plan',
      label: '生成本地 dry-run 执行计划，不读取 secret，不真实出网。',
      status: planReady ? 'completed' : 'skipped',
    },
    {
      id: 'mock-execute',
      label: '仅在 networkMode=mock 时执行本地模拟，不触发真实发送。',
      status: status === 'mock_dry_run_completed' ? 'completed' : status === 'plan_ready' ? 'ready' : 'skipped',
    },
  ];
}

export function evaluateWeComOfficialDryRun(input: WeComOfficialDryRunInput): WeComOfficialDryRunResult {
  const status = statusFromInput(input);
  const blockReasons: string[] = [];
  const requiredHumanActions: string[] = [];

  if (!input.tenantId || !input.institutionId) {
    blockReasons.push('缺少租户或机构低敏引用，不能生成单机构官方路线 dry-run。');
    requiredHumanActions.push('补充租户和机构低敏引用，不写真实机构敏感材料。');
  }
  if (input.hasSecretReadAttempt || !input.noSecretRead) {
    blockReasons.push('检测到读取 secret、token、process.env 或 .env.local 的企图，已阻断。');
    requiredHumanActions.push('不要读取 .env.local 或 process.env 中的真实密钥；仅使用低敏占位状态。');
  }
  if (input.hasSensitivePayload) {
    blockReasons.push('输入包含 corpId、secret、token、encodingAESKey、webhook、external_userid、userid 或真实 payload，已阻断。');
    requiredHumanActions.push('移除真实密钥、真实企业微信标识、客户标识、HIS payload 和 webhook payload。');
  }
  if (input.hasRealSendAttempt || input.allowRealSend || input.externalChannelEnabled || input.realSendAllowed || !input.noRealSend || !input.dryRunOnly) {
    blockReasons.push('检测到真实发送或外部通道启用企图，已强制关闭并阻断。');
    requiredHumanActions.push('保持 allowRealSend=false、externalChannelEnabled=false、realSendAllowed=false、dryRunOnly=true。');
  }
  if (input.hasRealNetworkAttempt || input.networkMode === 'live_dry_run_requested') {
    blockReasons.push('真实企业微信 / 微信网络调用默认禁用，live_dry_run_requested 只能受控阻断。');
    requiredHumanActions.push('保持本地 dry-run；真实出网需后续独立授权任务。');
  }
  if (input.officialRoute === 'account_custody') {
    blockReasons.push('账号托管路线不允许进入官方路线 dry-run。');
    requiredHumanActions.push('确认排除扫码、端口、机器编号、uip 和第三方账号托管路线。');
  } else if (!isOfficialRoute(input.officialRoute)) {
    blockReasons.push('当前路线不是官方企业微信路线，已阻断。');
    requiredHumanActions.push('选择官方自建应用、第三方应用或服务商路线。');
  }
  if (input.dryRunConfigStatus !== 'dry_run_ready') {
    blockReasons.push('官方企业微信 dry-run config 尚未 dry_run_ready。');
    requiredHumanActions.push('先完成 4F-A 低敏占位配置评估。');
  }
  if (!input.hasCallbackUrlPlaceholder) {
    blockReasons.push('缺少 callback URL 低敏占位，不能写真实 callback 或 webhook。');
    requiredHumanActions.push('补充 callback URL 占位状态，不配置真实 webhook。');
  }
  if (input.preflightStatus !== 'mock_ready' || !input.proofEligibleMock) {
    blockReasons.push('4E real-channel preflight 尚未 mock_ready，或 proofEligibleMock=false。');
    requiredHumanActions.push('先完成 4E preflight，并确认只进入模拟 proof eligibility。');
  }
  if (!input.hasManualConfirmation) {
    blockReasons.push('缺少人工确认，不能执行官方路线 dry-run。');
    requiredHumanActions.push('由负责人完成人工确认后再评估 dry-run。');
  }
  if (!input.hasSecretPlaceholder) {
    blockReasons.push('缺少 secret 低敏占位确认；本任务仍不读取、不保存 secret。');
    requiredHumanActions.push('只确认 secret placeholder / 保管状态，不输入真实 secret。');
  }

  const routeLabel = input.officialRoute
    ? officialWeComDryRunRouteLabels[input.officialRoute] ?? officialWeComDryRunRouteLabels.not_selected
    : officialWeComDryRunRouteLabels.not_selected;
  const dryRunPlanReady = status === 'plan_ready' || status === 'mock_dry_run_completed';
  const mockDryRunCompleted = status === 'mock_dry_run_completed';
  const auditReason = auditReasonFor(status);
  const explanation = mockDryRunCompleted
    ? '官方路线 dry-run 已完成本地模拟；仍不读取 secret、不真实出网、不真实发送。'
    : dryRunPlanReady
      ? '官方路线 dry-run 执行计划已生成；networkMode=disabled 时不执行模拟和真实网络。'
      : '官方路线 dry-run 已按安全门禁阻断；真实接入、真实出网和真实发送继续关闭。';

  return {
    tenantId: safeText(input.tenantId, 'tenant-low-sensitive'),
    institutionId: safeText(input.institutionId, 'institution-low-sensitive'),
    operatorRole: input.operatorRole,
    officialRoute: input.officialRoute,
    dryRunStatus: status,
    dryRunStatusLabel: weComOfficialDryRunStatusLabels[status],
    dryRunPlanReady,
    mockDryRunCompleted,
    routeLabel,
    networkMode: input.networkMode,
    blockReasons: [...new Set(blockReasons.map((reason) => safeText(reason, '低敏阻断原因已隐藏。')))],
    requiredHumanActions: [...new Set(requiredHumanActions.map((action) => safeText(action, '低敏人工动作已隐藏。')))],
    dryRunSteps: createSteps(status),
    lowSensitiveExplanation: safeText(explanation, '低敏 dry-run 说明已隐藏。'),
    noRealSend: true,
    noRealNetwork: true,
    noSecretRead: true,
    noSecretOutput: true,
    allowRealSend: false,
    externalChannelEnabled: false,
    realSendAllowed: false,
    auditReason,
    timelineSummary: safeText(
      `官方路线 dry-run：${weComOfficialDryRunStatusLabels[status]}；${routeLabel}；networkMode=${input.networkMode}；noSecretRead=true；noSecretOutput=true；noRealNetwork=true；noRealSend=true。`,
      '官方路线 dry-run 已记录低敏时间线。',
    ),
  };
}

export function createDefaultWeComOfficialDryRunInput(
  overrides: Partial<WeComOfficialDryRunInput> = {},
): WeComOfficialDryRunInput {
  return {
    tenantId: 'tenant-low-sensitive-001',
    institutionId: 'institution-low-sensitive-001',
    operatorRole: 'tenant_admin',
    officialRoute: 'official_wecom_self_built',
    dryRunConfigStatus: 'dry_run_ready',
    preflightStatus: 'mock_ready',
    proofEligibleMock: true,
    hasManualConfirmation: true,
    hasSecretPlaceholder: true,
    hasCallbackUrlPlaceholder: true,
    networkMode: 'disabled',
    allowRealSend: false,
    externalChannelEnabled: false,
    realSendAllowed: false,
    noSecretRead: true,
    noRealSend: true,
    dryRunOnly: true,
    hasSensitivePayload: false,
    hasSecretReadAttempt: false,
    hasRealNetworkAttempt: false,
    hasRealSendAttempt: false,
    ...overrides,
  };
}

export function detectWeComOfficialDryRunPayloadGuards(input: unknown) {
  return {
    hasSensitivePayload: hasSensitivePayload(input),
    hasSecretReadAttempt: hasSecretReadPayload(input),
    hasRealNetworkAttempt: hasRealNetworkPayload(input),
    hasRealSendAttempt: hasRealSendPayload(input),
  };
}

export function assertWeComOfficialDryRunLowSensitivePayload(input: unknown) {
  const guards = detectWeComOfficialDryRunPayloadGuards(input);
  return !guards.hasSensitivePayload && !guards.hasSecretReadAttempt && !guards.hasRealNetworkAttempt && !guards.hasRealSendAttempt;
}

export function buildWeComOfficialDryRunStats(results: readonly WeComOfficialDryRunResult[]): WeComOfficialDryRunStats {
  return {
    officialDryRunCheckCount: results.length,
    officialDryRunPlanReadyCount: results.filter((result) => result.dryRunPlanReady).length,
    officialDryRunMockCompletedCount: results.filter((result) => result.mockDryRunCompleted).length,
    officialDryRunRealNetworkBlockedCount: results.filter((result) => result.dryRunStatus === 'blocked_real_network_disabled').length,
    officialDryRunRealSendBlockedCount: results.filter((result) => result.dryRunStatus === 'blocked_real_send_forbidden').length,
    officialDryRunSensitivePayloadBlockedCount: results.filter((result) =>
      result.dryRunStatus === 'blocked_sensitive_payload' || result.dryRunStatus === 'blocked_secret_read_attempt',
    ).length,
    officialDryRunMissingManualConfirmationBlockedCount: results.filter((result) =>
      result.dryRunStatus === 'blocked_missing_manual_confirmation' ||
      result.blockReasons.some((reason) => reason.includes('缺少人工确认')),
    ).length,
  };
}

export function createWeComOfficialDryRunTimelineMetadata(result: WeComOfficialDryRunResult): Record<string, string | null> {
  return {
    weComOfficialDryRunRoute: result.officialRoute,
    weComOfficialDryRunRouteLabel: result.routeLabel,
    weComOfficialDryRunStatus: result.dryRunStatus,
    weComOfficialDryRunStatusLabel: result.dryRunStatusLabel,
    weComOfficialDryRunPlanReady: String(result.dryRunPlanReady),
    weComOfficialDryRunMockCompleted: String(result.mockDryRunCompleted),
    weComOfficialDryRunNetworkMode: result.networkMode,
    weComOfficialDryRunNoRealSend: String(result.noRealSend),
    weComOfficialDryRunNoRealNetwork: String(result.noRealNetwork),
    weComOfficialDryRunNoSecretRead: String(result.noSecretRead),
    weComOfficialDryRunNoSecretOutput: String(result.noSecretOutput),
    allowRealSend: String(result.allowRealSend),
    externalChannelEnabled: String(result.externalChannelEnabled),
    realSendAllowed: String(result.realSendAllowed),
    weComOfficialDryRunAuditReason: result.auditReason,
  };
}
