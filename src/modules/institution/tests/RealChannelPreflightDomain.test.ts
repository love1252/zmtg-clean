import { describe, expect, it } from 'vitest';
import {
  assertRealChannelPreflightLowSensitivePayload,
  buildRealChannelPreflightStats,
  createDefaultRealChannelPreflightInput,
  createRealChannelPreflightTimelineMetadata,
  evaluateRealChannelPreflight,
  realChannelPreflightAuditReasons,
  realChannelPreflightStatuses,
  realChannelRoutes,
} from '@/modules/institution/domain/real-channel-preflight';

function evaluate(overrides: Parameters<typeof createDefaultRealChannelPreflightInput>[0] = {}) {
  return evaluateRealChannelPreflight(createDefaultRealChannelPreflightInput(overrides));
}

describe('真实通道 preflight domain', () => {
  it('定义官方路线、账号托管路线和 proof 准入状态', () => {
    expect(realChannelRoutes).toEqual([
      'official_wecom_self_built',
      'official_wecom_third_party',
      'official_wecom_service_provider',
      'account_custody',
    ]);
    expect(realChannelPreflightStatuses).toEqual([
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
    ]);
    expect(realChannelPreflightAuditReasons).toEqual([
      'real_channel_preflight_viewed',
      'real_channel_preflight_evaluated',
      'real_channel_preflight_blocked',
      'real_channel_proof_mock_eligible',
      'real_channel_sensitive_config_blocked',
      'account_custody_route_blocked',
    ]);
  });

  it('默认强制 allowRealSend=false、externalChannelEnabled=false 且不允许真实发送', () => {
    const result = evaluate();

    expect(result.allowRealSend).toBe(false);
    expect(result.externalChannelEnabled).toBe(false);
    expect(result.realSendAllowed).toBe(false);
    expect(result.proofEligibleMock).toBe(false);
    expect(result.preflightStatus).toBe('blocked_missing_manual_confirmation');
  });

  it('emergency stop 和安全开关会阻断真实渠道', () => {
    const emergency = evaluate({
      hasManualConfirmation: true,
      emergencyStopEnabled: true,
      safetySwitchSummary: { emergencyStopEnabled: true },
    });
    expect(emergency.preflightStatus).toBe('blocked_safety_switch');
    expect(emergency.blockReasons.join(' ')).toContain('emergency stop');

    const disabled = evaluate({
      hasManualConfirmation: true,
      emergencyStopEnabled: false,
      safetySwitchSummary: { emergencyStopEnabled: false },
    });
    expect(disabled.preflightStatus).toBe('blocked_real_channel_disabled');
    expect(disabled.blockReasons.join(' ')).toContain('安全开关');
  });

  it('未人工确认、无授权、退订和频率限制未通过会阻断', () => {
    expect(evaluate({ hasManualConfirmation: false }).preflightStatus).toBe('blocked_missing_manual_confirmation');
    expect(evaluate({ hasManualConfirmation: true, emergencyStopEnabled: false, safetySwitchSummary: { emergencyStopEnabled: false }, hasConsent: false }).preflightStatus).toBe('blocked_missing_consent');

    const missingConsent = evaluate({
      hasManualConfirmation: true,
      hasConsent: false,
      emergencyStopEnabled: false,
      safetySwitchSummary: {
        tenantRealChannelEnabled: true,
        institutionRealChannelEnabled: true,
        weComRealSendEnabled: true,
        smsRealSendEnabled: true,
        webhookEnabled: true,
        emergencyStopEnabled: false,
      },
    });
    expect(missingConsent.preflightStatus).toBe('blocked_missing_consent');

    const optOut = evaluate({
      hasManualConfirmation: true,
      hasOptOut: true,
      emergencyStopEnabled: false,
      safetySwitchSummary: {
        tenantRealChannelEnabled: true,
        institutionRealChannelEnabled: true,
        weComRealSendEnabled: true,
        smsRealSendEnabled: true,
        webhookEnabled: true,
        emergencyStopEnabled: false,
      },
    });
    expect(optOut.preflightStatus).toBe('blocked_opt_out');

    const frequency = evaluate({
      hasManualConfirmation: true,
      frequencyCapPassed: false,
      emergencyStopEnabled: false,
      safetySwitchSummary: {
        tenantRealChannelEnabled: true,
        institutionRealChannelEnabled: true,
        weComRealSendEnabled: true,
        smsRealSendEnabled: true,
        webhookEnabled: true,
        emergencyStopEnabled: false,
      },
    });
    expect(frequency.preflightStatus).toBe('blocked_frequency_cap');
  });

  it('高风险、4C L4 和 blocked_* 策略会阻断', () => {
    const highRisk = evaluate({
      hasManualConfirmation: true,
      riskTags: ['medical_advice_risk'],
      emergencyStopEnabled: false,
      safetySwitchSummary: {
        tenantRealChannelEnabled: true,
        institutionRealChannelEnabled: true,
        weComRealSendEnabled: true,
        smsRealSendEnabled: true,
        webhookEnabled: true,
        emergencyStopEnabled: false,
      },
    });
    expect(highRisk.preflightStatus).toBe('blocked_high_risk');

    const l4 = evaluate({
      hasManualConfirmation: true,
      aiStrategyLevel: 'L4',
      aiStrategyDecision: 'blocked_marketing_automation',
      emergencyStopEnabled: false,
      safetySwitchSummary: {
        tenantRealChannelEnabled: true,
        institutionRealChannelEnabled: true,
        weComRealSendEnabled: true,
        smsRealSendEnabled: true,
        webhookEnabled: true,
        emergencyStopEnabled: false,
      },
    });
    expect(l4.preflightStatus).toBe('blocked_strategy_not_allowed');
  });

  it('账号托管路线阻断，不进入 proof', () => {
    const result = evaluate({
      channelRoute: 'account_custody',
      isAccountCustodyRoute: true,
      hasManualConfirmation: true,
    });

    expect(result.preflightStatus).toBe('blocked_account_custody_route');
    expect(result.auditReason).toBe('account_custody_route_blocked');
    expect(result.proofEligibleMock).toBe(false);
    expect(JSON.stringify(result)).not.toContain('扫码托管');
    expect(JSON.stringify(result)).not.toContain('机器编号');
    expect(JSON.stringify(result)).not.toContain('uip');
  });

  it('secret/token/corpId/webhook 等敏感配置输入阻断且输出低敏', () => {
    expect(assertRealChannelPreflightLowSensitivePayload({ corpId: 'corp-real' })).toBe(false);
    expect(assertRealChannelPreflightLowSensitivePayload({ nested: { webhook_secret: 'x' } })).toBe(false);
    expect(assertRealChannelPreflightLowSensitivePayload({ token: 'access_token_x' })).toBe(false);
    expect(assertRealChannelPreflightLowSensitivePayload({ DATABASE_URL: 'postgres://real-db' })).toBe(false);
    expect(assertRealChannelPreflightLowSensitivePayload({ details: 'HIS payload raw body' })).toBe(false);
    expect(assertRealChannelPreflightLowSensitivePayload({ webhook_payload: { raw: 'body' } })).toBe(false);
    expect(assertRealChannelPreflightLowSensitivePayload({ machineNumber: 'MACHINE-REAL-001' })).toBe(false);
    expect(assertRealChannelPreflightLowSensitivePayload({ loginPort: '18888' })).toBe(false);
    expect(assertRealChannelPreflightLowSensitivePayload({ uipPath: 'uip.exe' })).toBe(false);
    expect(assertRealChannelPreflightLowSensitivePayload({ scanLogin: true })).toBe(false);

    const result = evaluate({
      hasSensitiveConfigInput: true,
      hasManualConfirmation: true,
    });
    expect(result.preflightStatus).toBe('blocked_sensitive_config');
    expect(result.auditReason).toBe('real_channel_sensitive_config_blocked');
    expect(JSON.stringify(result)).not.toContain('corp-real');
  });

  it('官方企业微信路线只产生 mock proof eligibility，不允许真实发送', () => {
    const result = evaluate({
      channelRoute: 'official_wecom_third_party',
      hasManualConfirmation: true,
      aiStrategyDecision: 'draft_requires_human',
      aiStrategyLevel: 'L1',
      emergencyStopEnabled: false,
      safetySwitchSummary: {
        tenantRealChannelEnabled: true,
        institutionRealChannelEnabled: true,
        weComRealSendEnabled: true,
        smsRealSendEnabled: true,
        webhookEnabled: true,
        emergencyStopEnabled: false,
      },
    });

    expect(result.preflightStatus).toBe('mock_ready');
    expect(result.proofEligibleMock).toBe(true);
    expect(result.realSendAllowed).toBe(false);
    expect(result.allowRealSend).toBe(false);
    expect(result.externalChannelEnabled).toBe(false);
    expect(result.auditReason).toBe('real_channel_proof_mock_eligible');
  });

  it('生成 audit metadata、时间线摘要和看板统计', () => {
    const blocked = evaluate({ hasManualConfirmation: false });
    const sensitive = evaluate({ hasSensitiveConfigInput: true });
    const accountCustody = evaluate({ channelRoute: 'account_custody', isAccountCustodyRoute: true });
    const stats = buildRealChannelPreflightStats([blocked, sensitive, accountCustody]);

    expect(createRealChannelPreflightTimelineMetadata(blocked)).toMatchObject({
      realChannelPreflightStatus: 'blocked_missing_manual_confirmation',
      allowRealSend: 'false',
      externalChannelEnabled: 'false',
    });
    expect(blocked.timelineSummary).toContain('真实通道前置检查');
    expect(stats).toMatchObject({
      preflightCheckCount: 3,
      preflightMockEligibleCount: 0,
      preflightRealSendBlockedCount: 3,
      preflightSensitiveConfigBlockedCount: 1,
      preflightAccountCustodyRouteBlockedCount: 1,
      preflightMissingManualConfirmationBlockedCount: 3,
    });
  });
});
