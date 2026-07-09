import type { AuditReason } from '@/modules/audit/domain/audit-events';
import type { AiAutoStrategyDecision, AiAutoStrategyLevel } from '@/modules/institution/domain/ai-auto-strategy';
import type { AiConversationRiskTag } from '@/modules/institution/domain/ai-conversation-workbench';
import { canAccessResource, type AccessRole } from '@/modules/security/domain/access-control';
import {
  defaultSafetySwitchState,
  deriveSafetySwitchViewModel,
  type SafetySwitchState,
  type SafetySwitchViewModel,
} from '@/modules/security/domain/safety-switch';

export const realChannelRoutes = [
  'official_wecom_self_built',
  'official_wecom_third_party',
  'official_wecom_service_provider',
  'account_custody',
] as const;

export type RealChannelRoute = (typeof realChannelRoutes)[number];

export const realChannelRouteLabels = {
  official_wecom_self_built: '企业微信自建应用路线',
  official_wecom_third_party: '企业微信第三方应用路线',
  official_wecom_service_provider: '企业微信服务商路线',
  account_custody: '账号托管路线（仅风险展示）',
} as const satisfies Record<RealChannelRoute, string>;

export const realChannelPreflightStatuses = [
  'not_configured',
  'mock_ready',
  'blocked_missing_manual_confirmation',
  'blocked_safety_switch',
  'blocked_real_channel_disabled',
  'blocked_sensitive_config',
  'blocked_no_permission',
  'blocked_missing_consent',
  'blocked_opt_out',
  'blocked_frequency_cap',
  'blocked_high_risk',
  'blocked_strategy_not_allowed',
  'blocked_account_custody_route',
  'blocked_route_unverified',
] as const;

export type RealChannelPreflightStatus = (typeof realChannelPreflightStatuses)[number];

export const realChannelPreflightStatusLabels = {
  not_configured: '未配置机构级通道占位',
  mock_ready: '允许进入模拟 proof 前置检查',
  blocked_missing_manual_confirmation: '缺少人工确认，已阻断',
  blocked_safety_switch: '安全开关阻断',
  blocked_real_channel_disabled: '真实通道关闭，已阻断',
  blocked_sensitive_config: '敏感配置输入阻断',
  blocked_no_permission: '当前角色无通道前置检查权限',
  blocked_missing_consent: '缺少客户授权，已阻断',
  blocked_opt_out: '客户退订，已阻断',
  blocked_frequency_cap: '频率限制未通过，已阻断',
  blocked_high_risk: '高风险标签阻断',
  blocked_strategy_not_allowed: '4C 自动化策略不允许进入 proof',
  blocked_account_custody_route: '账号托管路线阻断',
  blocked_route_unverified: '通道路线未核验，已阻断',
} as const satisfies Record<RealChannelPreflightStatus, string>;

export const realChannelPreflightAuditReasons = [
  'real_channel_preflight_viewed',
  'real_channel_preflight_evaluated',
  'real_channel_preflight_blocked',
  'real_channel_proof_mock_eligible',
  'real_channel_sensitive_config_blocked',
  'account_custody_route_blocked',
] as const satisfies readonly AuditReason[];

export type RealChannelPreflightAuditReason = (typeof realChannelPreflightAuditReasons)[number];

export type RealChannelPreflightInput = {
  tenantId: string;
  institutionId: string | null;
  operatorRole: AccessRole;
  channelRoute: RealChannelRoute;
  hasManualConfirmation: boolean;
  hasConsent: boolean;
  hasOptOut: boolean;
  frequencyCapPassed: boolean;
  aiStrategyDecision: AiAutoStrategyDecision;
  aiStrategyLevel: AiAutoStrategyLevel;
  riskTags: readonly AiConversationRiskTag[];
  safetySwitchSummary?: Partial<SafetySwitchState> | SafetySwitchViewModel | null;
  allowRealSend: boolean;
  externalChannelEnabled: boolean;
  emergencyStopEnabled: boolean;
  hasSensitiveConfigInput: boolean;
  isAccountCustodyRoute: boolean;
};

export type RealChannelPreflightResult = {
  tenantId: string;
  institutionId: string | null;
  channelRoute: RealChannelRoute;
  routeLabel: string;
  preflightStatus: RealChannelPreflightStatus;
  preflightStatusLabel: string;
  proofEligibleMock: boolean;
  realSendAllowed: false;
  blocked: boolean;
  blockReasons: string[];
  requiredHumanActions: string[];
  safetySummary: SafetySwitchViewModel;
  allowRealSend: false;
  externalChannelEnabled: false;
  emergencyStopEnabled: boolean;
  lowSensitiveExplanation: string;
  auditReason: RealChannelPreflightAuditReason;
  timelineSummary: string;
};

export type RealChannelPreflightStats = {
  preflightCheckCount: number;
  preflightMockEligibleCount: number;
  preflightRealSendBlockedCount: number;
  preflightSensitiveConfigBlockedCount: number;
  preflightAccountCustodyRouteBlockedCount: number;
  preflightMissingManualConfirmationBlockedCount: number;
  preflightSafetySwitchBlockedCount: number;
};

const officialRoutes = new Set<RealChannelRoute>([
  'official_wecom_self_built',
  'official_wecom_third_party',
  'official_wecom_service_provider',
]);

const highRiskTags = new Set<AiConversationRiskTag>([
  'medical_advice_risk',
  'efficacy_commitment_risk',
  'price_commitment_risk',
  'allergy_or_postoperative_abnormal_risk',
  'complaint_or_dissatisfaction_risk',
  'privacy_field_leakage_risk',
]);

const sensitiveKeyPattern = /(?:corp[_-]?id|secret|token|encoding[_-]?aes[_-]?key|callback|webhook[_-]?(?:secret|token|url|payload)|external[_-]?userid|userid|api[_-]?key|credential|private[_-]?key|database[_-]?url|his[_-]?payload|scan[_-]?(?:login|qr)|qr[_-]?login|wechat[_-]?login|wecom[_-]?login|machine[_-]?(?:id|number|code)|login[_-]?port|port[_-]?(?:id|number|config)|^port$|uip)/iu;
const sensitiveValuePattern = /(?:corp[_-]?id|client[_-]?secret|access[_-]?token|refresh[_-]?token|encoding[_-]?aes[_-]?key|callback[_-]?token|webhook[_-]?(?:secret|payload)|external[_-]?userid|真实\s*userid|api\s*key|database[_-]?url|postgres:\/\/|his\s*payload|uip\.exe|真实\s*扫码|真实\s*端口|机器\s*编号|sk_live|sk_test|zmtg_sk_|https?:\/\/[^\s]+\/webhook)/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasSensitiveConfigPayload(value: unknown): boolean {
  if (typeof value === 'string') return sensitiveValuePattern.test(value);
  if (Array.isArray(value)) return value.some((item) => hasSensitiveConfigPayload(item));
  if (isRecord(value)) {
    return Object.entries(value).some(
      ([key, item]) => sensitiveKeyPattern.test(key) || hasSensitiveConfigPayload(item),
    );
  }

  return false;
}

function safeText(value: string, fallback: string) {
  const normalized = value.normalize('NFKC').replace(/\s+/gu, ' ').trim().slice(0, 500);
  return normalized && !sensitiveValuePattern.test(normalized) ? normalized : fallback;
}

function buildSafetySummary(input: RealChannelPreflightInput) {
  const summary = deriveSafetySwitchViewModel({
    ...(input.safetySwitchSummary ?? defaultSafetySwitchState),
    emergencyStopEnabled: input.emergencyStopEnabled,
    allowRealSend: input.allowRealSend,
    externalChannelEnabled: input.externalChannelEnabled,
  });

  if (input.emergencyStopEnabled) return summary;

  return {
    ...summary,
    emergencyStopEnabled: false,
    blockReasons: summary.blockReasons.filter((reason) => reason !== 'emergency_stop_enabled'),
    boundaryLabels: summary.boundaryLabels.map((label) => label === 'emergency stop 已开启' ? 'emergency stop 可阻断真实渠道' : label),
  };
}

function hasPreflightPermission(input: RealChannelPreflightInput) {
  return canAccessResource({
    context: {
      userId: 'operator-low-sensitive',
      role: input.operatorRole,
      scope: 'tenant',
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      source: 'demo_session',
    },
    resource: 'real_channel',
    action: 'read',
    targetTenantId: input.tenantId,
  }).allowed;
}

function isStrategyBlocked(input: RealChannelPreflightInput) {
  return input.aiStrategyLevel === 'L4' || input.aiStrategyDecision.startsWith('blocked_');
}

function hasHighRisk(input: RealChannelPreflightInput) {
  return input.riskTags.some((tag) => highRiskTags.has(tag));
}

function effectiveSafetyBlockReasons(safetySummary: SafetySwitchViewModel) {
  return safetySummary.blockReasons.filter(
    (reason) => reason !== 'allow_real_send_forced_false' && reason !== 'external_channel_forced_false',
  );
}

function canEnterMockProof(input: RealChannelPreflightInput) {
  return (
    officialRoutes.has(input.channelRoute) &&
    !input.isAccountCustodyRoute &&
    !input.hasSensitiveConfigInput &&
    hasPreflightPermission(input) &&
    input.hasManualConfirmation &&
    input.hasConsent &&
    !input.hasOptOut &&
    input.frequencyCapPassed &&
    !hasHighRisk(input) &&
    !isStrategyBlocked(input)
  );
}

function statusFromReasons(input: {
  input: RealChannelPreflightInput;
  safetySummary: SafetySwitchViewModel;
  hasPermission: boolean;
  hasSensitiveConfig: boolean;
  blockReasons: string[];
}): RealChannelPreflightStatus {
  if (!input.input.channelRoute) return 'not_configured';
  if (input.hasSensitiveConfig) return 'blocked_sensitive_config';
  if (input.input.isAccountCustodyRoute || input.input.channelRoute === 'account_custody') return 'blocked_account_custody_route';
  if (!officialRoutes.has(input.input.channelRoute)) return 'blocked_route_unverified';
  if (!input.hasPermission) return 'blocked_no_permission';
  if (input.input.emergencyStopEnabled || input.safetySummary.blockReasons.includes('emergency_stop_enabled')) return 'blocked_safety_switch';
  if (!input.input.hasManualConfirmation) return 'blocked_missing_manual_confirmation';
  if (!input.input.hasConsent) return 'blocked_missing_consent';
  if (input.input.hasOptOut) return 'blocked_opt_out';
  if (!input.input.frequencyCapPassed) return 'blocked_frequency_cap';
  if (hasHighRisk(input.input)) return 'blocked_high_risk';
  if (isStrategyBlocked(input.input)) return 'blocked_strategy_not_allowed';
  if (effectiveSafetyBlockReasons(input.safetySummary).length > 0) return 'blocked_real_channel_disabled';
  if (input.blockReasons.length > 0) return 'blocked_real_channel_disabled';
  return 'mock_ready';
}

function auditReasonFor(input: {
  status: RealChannelPreflightStatus;
  proofEligibleMock: boolean;
}): RealChannelPreflightAuditReason {
  if (input.status === 'blocked_sensitive_config') return 'real_channel_sensitive_config_blocked';
  if (input.status === 'blocked_account_custody_route') return 'account_custody_route_blocked';
  if (input.proofEligibleMock) return 'real_channel_proof_mock_eligible';
  if (input.status.startsWith('blocked_')) return 'real_channel_preflight_blocked';
  return 'real_channel_preflight_evaluated';
}

export function evaluateRealChannelPreflight(input: RealChannelPreflightInput): RealChannelPreflightResult {
  const hasSensitiveConfig = input.hasSensitiveConfigInput || !assertRealChannelPreflightLowSensitivePayload(input);
  const safetySummary = buildSafetySummary(input);
  const hasPermission = hasPreflightPermission(input);
  const blockReasons: string[] = [];
  const requiredHumanActions: string[] = [];

  if (hasSensitiveConfig) {
    blockReasons.push('输入包含敏感配置字段或真实外部通道标识，已阻断。');
    requiredHumanActions.push('移除敏感配置字段，只保留低敏通道路线和状态。');
  }

  if (input.isAccountCustodyRoute || input.channelRoute === 'account_custody') {
    blockReasons.push('账号托管路线仅用于风险展示，不允许进入 proof。');
    requiredHumanActions.push('人工确认不使用账号托管或第三方托管路线。');
  }

  if (!officialRoutes.has(input.channelRoute)) {
    blockReasons.push('当前通道路线未通过官方路线核验，已阻断。');
    requiredHumanActions.push('选择企业微信官方自建应用、第三方应用或服务商路线。');
  }

  if (!hasPermission) {
    blockReasons.push('当前角色缺少真实通道前置检查读取权限。');
    requiredHumanActions.push('由机构管理员或具备权限的运营角色复核。');
  }

  if (input.emergencyStopEnabled || safetySummary.blockReasons.includes('emergency_stop_enabled')) {
    blockReasons.push('emergency stop 已开启，真实渠道和 proof 动作均保持阻断。');
    requiredHumanActions.push('保留 emergency stop，并在后续真实 proof 前单独授权回滚方案。');
  }

  if (effectiveSafetyBlockReasons(safetySummary).length > 0) {
    blockReasons.push('安全开关显示真实通道关闭，当前只允许低敏前置检查。');
    requiredHumanActions.push('确认 allowRealSend=false 和 externalChannelEnabled=false。');
  }

  if (input.allowRealSend || input.externalChannelEnabled) {
    blockReasons.push('检测到真实发送或外部通道启用尝试，已强制关闭。');
    requiredHumanActions.push('移除真实发送启用尝试，重新提交低敏评估。');
  }

  if (!input.hasManualConfirmation) {
    blockReasons.push('缺少人工确认，不能进入 proof。');
    requiredHumanActions.push('由客服或管理员完成发送前人工确认。');
  }

  if (!input.hasConsent) {
    blockReasons.push('缺少客户授权，不能触达。');
    requiredHumanActions.push('补齐客户授权状态，只记录低敏结果。');
  }

  if (input.hasOptOut) {
    blockReasons.push('客户已退订，不能触达。');
    requiredHumanActions.push('尊重退订状态，不再进入发送链路。');
  }

  if (!input.frequencyCapPassed) {
    blockReasons.push('频率限制未通过，不能触达。');
    requiredHumanActions.push('等待频率限制窗口恢复或人工复核。');
  }

  if (hasHighRisk(input)) {
    blockReasons.push('存在医疗、投诉、价格、术后异常或隐私风险标签，不能进入 proof。');
    requiredHumanActions.push('转人工复核风险标签并保留低敏审计。');
  }

  if (isStrategyBlocked(input)) {
    blockReasons.push('4C 自动化策略结果不允许进入 proof。');
    requiredHumanActions.push('改为人工确认草稿或低敏推荐，不进入自动触达。');
  }

  const proofEligibleMock = canEnterMockProof({ ...input, hasSensitiveConfigInput: hasSensitiveConfig });
  const uniqueBlockReasons = [...new Set(blockReasons.map((reason) => safeText(reason, '低敏阻断原因已隐藏。')))];
  const uniqueHumanActions = [...new Set(requiredHumanActions.map((action) => safeText(action, '低敏人工动作已隐藏。')))];
  const status = statusFromReasons({
    input,
    safetySummary,
    hasPermission,
    hasSensitiveConfig,
    blockReasons: uniqueBlockReasons,
  });
  const blocked = uniqueBlockReasons.length > 0 || status.startsWith('blocked_');
  const auditReason = auditReasonFor({ status, proofEligibleMock });
  const routeLabel = realChannelRouteLabels[input.channelRoute];
  const lowSensitiveExplanation = proofEligibleMock
    ? '官方企业微信路线已满足低敏模拟 proof 前置条件；真实发送仍保持关闭。'
    : '当前仅完成真实通道前置检查，未产生真实发送许可。';

  return {
    tenantId: safeText(input.tenantId, 'tenant-low-sensitive'),
    institutionId: input.institutionId ? safeText(input.institutionId, 'institution-low-sensitive') : null,
    channelRoute: input.channelRoute,
    routeLabel,
    preflightStatus: status,
    preflightStatusLabel: realChannelPreflightStatusLabels[status],
    proofEligibleMock,
    realSendAllowed: false,
    blocked,
    blockReasons: uniqueBlockReasons,
    requiredHumanActions: uniqueHumanActions,
    safetySummary,
    allowRealSend: false,
    externalChannelEnabled: false,
    emergencyStopEnabled: safetySummary.emergencyStopEnabled,
    lowSensitiveExplanation: safeText(lowSensitiveExplanation, '低敏前置检查说明已隐藏。'),
    auditReason,
    timelineSummary: safeText(
      `真实通道前置检查：${realChannelPreflightStatusLabels[status]}；${routeLabel}；allowRealSend=false；externalChannelEnabled=false；不真实发送。`,
      '真实通道前置检查已记录低敏时间线。',
    ),
  };
}

export function createDefaultRealChannelPreflightInput(
  overrides: Partial<RealChannelPreflightInput> = {},
): RealChannelPreflightInput {
  return {
    tenantId: 'tenant-low-sensitive-001',
    institutionId: 'institution-low-sensitive-001',
    operatorRole: 'tenant_admin',
    channelRoute: 'official_wecom_self_built',
    hasManualConfirmation: false,
    hasConsent: true,
    hasOptOut: false,
    frequencyCapPassed: true,
    aiStrategyDecision: 'draft_requires_human',
    aiStrategyLevel: 'L1',
    riskTags: [],
    safetySwitchSummary: defaultSafetySwitchState,
    allowRealSend: false,
    externalChannelEnabled: false,
    emergencyStopEnabled: false,
    hasSensitiveConfigInput: false,
    isAccountCustodyRoute: false,
    ...overrides,
  };
}

export function buildRealChannelPreflightStats(
  results: readonly RealChannelPreflightResult[],
): RealChannelPreflightStats {
  return {
    preflightCheckCount: results.length,
    preflightMockEligibleCount: results.filter((result) => result.proofEligibleMock).length,
    preflightRealSendBlockedCount: results.filter((result) => !result.realSendAllowed).length,
    preflightSensitiveConfigBlockedCount: results.filter((result) => result.preflightStatus === 'blocked_sensitive_config').length,
    preflightAccountCustodyRouteBlockedCount: results.filter((result) => result.preflightStatus === 'blocked_account_custody_route').length,
    preflightMissingManualConfirmationBlockedCount: results.filter((result) => result.preflightStatus === 'blocked_missing_manual_confirmation' || result.blockReasons.some((reason) => reason.includes('缺少人工确认'))).length,
    preflightSafetySwitchBlockedCount: results.filter((result) => result.preflightStatus === 'blocked_safety_switch' || result.blockReasons.some((reason) => reason.includes('安全开关') || reason.includes('emergency stop'))).length,
  };
}

export function createRealChannelPreflightTimelineMetadata(
  result: RealChannelPreflightResult,
): Record<string, string | null> {
  return {
    realChannelRoute: result.channelRoute,
    realChannelRouteLabel: result.routeLabel,
    realChannelPreflightStatus: result.preflightStatus,
    realChannelPreflightStatusLabel: result.preflightStatusLabel,
    realChannelProofEligibleMock: String(result.proofEligibleMock),
    realSendAllowed: String(result.realSendAllowed),
    allowRealSend: String(result.allowRealSend),
    externalChannelEnabled: String(result.externalChannelEnabled),
    emergencyStopEnabled: String(result.emergencyStopEnabled),
    realChannelAuditReason: result.auditReason,
  };
}

export function assertRealChannelPreflightLowSensitivePayload(input: unknown) {
  return !hasSensitiveConfigPayload(input);
}
