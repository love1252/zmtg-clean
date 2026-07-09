import { describe, expect, it } from 'vitest';
import {
  assertWeComOfficialDryRunLowSensitivePayload,
  buildWeComOfficialDryRunConfigStats,
  createDefaultWeComOfficialDryRunConfigInput,
  createWeComOfficialDryRunTimelineMetadata,
  detectWeComOfficialDryRunPayloadGuards,
  evaluateWeComOfficialDryRunConfig,
  officialWeComDryRunRoutes,
  weComOfficialDryRunAuditReasons,
  weComOfficialDryRunConfigStatuses,
} from '@/modules/institution/domain/wecom-official-dry-run-config';

function readyInput(overrides: Parameters<typeof createDefaultWeComOfficialDryRunConfigInput>[0] = {}) {
  return createDefaultWeComOfficialDryRunConfigInput({
    hasSecretKeeperConfirmed: true,
    hasManualConfirmation: true,
    preflightStatus: 'mock_ready',
    proofEligibleMock: true,
    ...overrides,
  });
}

function evaluate(overrides: Parameters<typeof createDefaultWeComOfficialDryRunConfigInput>[0] = {}) {
  return evaluateWeComOfficialDryRunConfig(readyInput(overrides));
}

describe('官方企业微信 dry-run 配置 domain', () => {
  it('定义官方路线、dry-run 配置状态和 audit reason', () => {
    expect(officialWeComDryRunRoutes).toEqual([
      'official_wecom_self_built',
      'official_wecom_third_party',
      'official_wecom_service_provider',
    ]);
    expect(weComOfficialDryRunConfigStatuses).toEqual([
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
    ]);
    expect(weComOfficialDryRunAuditReasons).toEqual([
      'wecom_dry_run_config_viewed',
      'wecom_dry_run_config_evaluated',
      'wecom_dry_run_ready',
      'wecom_dry_run_blocked',
      'wecom_dry_run_sensitive_value_blocked',
      'wecom_dry_run_secret_read_blocked',
    ]);
  });

  it('默认不配置真实 secret、不读取 secret、不真实出网、不真实发送', () => {
    const result = evaluateWeComOfficialDryRunConfig(createDefaultWeComOfficialDryRunConfigInput());

    expect(result.configStatus).toBe('not_configured');
    expect(result.noSecretStored).toBe(true);
    expect(result.noSecretRead).toBe(true);
    expect(result.noRealNetwork).toBe(true);
    expect(result.noRealSend).toBe(true);
    expect(result.allowRealSend).toBe(false);
    expect(result.externalChannelEnabled).toBe(false);
    expect(result.realSendAllowed).toBe(false);
    expect(result.dryRunOnly).toBe(true);
  });

  it('满足低敏条件和 4E mock_ready 时 dry_run_ready，但仍不允许真实发送', () => {
    const result = evaluate({ officialRoute: 'official_wecom_third_party' });

    expect(result.configStatus).toBe('dry_run_ready');
    expect(result.configStatusLabel).not.toContain('real_ready');
    expect(result.dryRunReady).toBe(true);
    expect(result.routeLabel).toContain('官方企业微信第三方应用路线');
    expect(result.auditReason).toBe('wecom_dry_run_ready');
    expect(result.allowRealSend).toBe(false);
    expect(result.externalChannelEnabled).toBe(false);
    expect(result.realSendAllowed).toBe(false);
    expect(JSON.stringify(result)).not.toContain('real_ready');
  });

  it('account_custody、非官方路线和缺少机构低敏引用会阻断', () => {
    expect(evaluate({ officialRoute: 'account_custody' }).configStatus).toBe('blocked_account_custody_route');
    expect(evaluate({ officialRoute: null }).configStatus).toBe('blocked_missing_route');
    expect(evaluate({ institutionId: null }).configStatus).toBe('blocked_missing_institution');
    expect(evaluate({ proofInstitutionRef: null }).configStatus).toBe('blocked_missing_institution');
  });

  it('缺少 callback URL 占位、secret 保管确认或人工确认会阻断', () => {
    expect(evaluate({ callbackUrlPlaceholder: null }).configStatus).toBe('blocked_missing_callback_url');
    expect(evaluate({ hasCallbackDomainPlaceholder: false }).configStatus).toBe('blocked_missing_callback_url');
    expect(evaluate({ callbackUrlPlaceholder: 'https://prod.zmtg.cn/wecom/callback' }).configStatus).toBe('blocked_missing_callback_url');

    const noKeeper = evaluateWeComOfficialDryRunConfig(readyInput({ hasSecretKeeperConfirmed: false }));
    expect(noKeeper.configStatus).toBe('not_configured');
    expect(noKeeper.blockReasons.join(' ')).toContain('secret 保管方式尚未确认');

    const noManual = evaluateWeComOfficialDryRunConfig(readyInput({ hasManualConfirmation: false }));
    expect(noManual.configStatus).toBe('blocked_missing_manual_confirmation');
  });

  it('preflight 未 mock_ready 或 proofEligibleMock=false 会阻断', () => {
    expect(evaluate({ preflightStatus: 'blocked_missing_manual_confirmation' }).configStatus).toBe('blocked_preflight_not_ready');
    expect(evaluate({ proofEligibleMock: false }).configStatus).toBe('blocked_preflight_not_ready');
  });

  it('allowRealSend、externalChannelEnabled、realSendAllowed 和 dryRunOnly=false 会强制 false 并阻断', () => {
    for (const overrides of [
      { allowRealSend: true },
      { externalChannelEnabled: true },
      { realSendAllowed: true },
      { dryRunOnly: false },
    ]) {
      const result = evaluate(overrides);
      expect(result.configStatus).toBe('blocked_real_send_forbidden');
      expect(result.allowRealSend).toBe(false);
      expect(result.externalChannelEnabled).toBe(false);
      expect(result.realSendAllowed).toBe(false);
      expect(result.noRealSend).toBe(true);
    }
  });

  it('corpId、secret、token、encodingAESKey、webhook、external_userid、userid 等输入阻断且不回显', () => {
    const payload = {
      corpId: 'corp-real',
      secret: 'secret-real',
      token: 'access_token_real',
      encodingAESKey: 'encoding-key-real',
      webhook_secret: 'webhook-secret-real',
      external_userid: 'external_userid_real',
      userid: 'userid_real',
      agentId: '100001',
      appId: 'wx-real-app',
      DATABASE_URL: 'postgres://real-db',
      hisPayload: 'HIS payload raw body',
    };
    const guards = detectWeComOfficialDryRunPayloadGuards(payload);
    expect(guards.hasSensitiveValueInput).toBe(true);
    expect(assertWeComOfficialDryRunLowSensitivePayload(payload)).toBe(false);

    const result = evaluate({ hasSensitiveValueInput: true });
    expect(result.configStatus).toBe('blocked_sensitive_value_detected');
    expect(result.auditReason).toBe('wecom_dry_run_sensitive_value_blocked');
    const text = JSON.stringify(result);
    expect(text).not.toContain('corp-real');
    expect(text).not.toContain('access_token_real');
    expect(text).not.toContain('webhook-secret-real');
  });

  it('secret 读取企图和真实网络调用企图会阻断', () => {
    expect(detectWeComOfficialDryRunPayloadGuards({ readSecret: true }).hasSecretReadAttempt).toBe(true);
    expect(detectWeComOfficialDryRunPayloadGuards({ note: 'process.env.WECOM_SECRET' }).hasSecretReadAttempt).toBe(true);
    expect(detectWeComOfficialDryRunPayloadGuards({ endpoint: 'https://qyapi.weixin.qq.com/cgi-bin/gettoken' }).hasRealNetworkAttempt).toBe(true);

    const secretRead = evaluate({ hasSecretReadAttempt: true });
    expect(secretRead.configStatus).toBe('blocked_secret_read_attempt');
    expect(secretRead.auditReason).toBe('wecom_dry_run_secret_read_blocked');

    const realNetwork = evaluate({ hasRealNetworkAttempt: true });
    expect(realNetwork.configStatus).toBe('blocked_real_network_forbidden');
    expect(realNetwork.noRealNetwork).toBe(true);
  });

  it('生成低敏时间线 metadata 和看板统计', () => {
    const ready = evaluate();
    const sensitive = evaluate({ hasSensitiveValueInput: true });
    const network = evaluate({ hasRealNetworkAttempt: true });
    const send = evaluate({ allowRealSend: true });
    const missingCallback = evaluate({ callbackUrlPlaceholder: null });
    const missingManual = evaluateWeComOfficialDryRunConfig(readyInput({ hasManualConfirmation: false }));
    const stats = buildWeComOfficialDryRunConfigStats([ready, sensitive, network, send, missingCallback, missingManual]);

    expect(createWeComOfficialDryRunTimelineMetadata(ready)).toMatchObject({
      weComDryRunConfigStatus: 'dry_run_ready',
      weComDryRunReady: 'true',
      weComDryRunNoSecretRead: 'true',
      allowRealSend: 'false',
    });
    expect(ready.timelineSummary).toContain('官方企业微信 dry-run 配置');
    expect(stats).toEqual({
      dryRunConfigCheckCount: 6,
      dryRunReadyCount: 1,
      dryRunSecretInputBlockedCount: 1,
      dryRunRealNetworkBlockedCount: 1,
      dryRunRealSendBlockedCount: 6,
      dryRunCallbackPlaceholderMissingCount: 1,
      dryRunManualConfirmationMissingCount: 1,
    });
  });
});
