import { describe, expect, it, vi } from 'vitest';
import {
  assertWeComOfficialDryRunLowSensitivePayload,
  buildWeComOfficialDryRunStats,
  createDefaultWeComOfficialDryRunInput,
  createWeComOfficialDryRunTimelineMetadata,
  detectWeComOfficialDryRunPayloadGuards,
  evaluateWeComOfficialDryRun,
  weComOfficialDryRunAuditReasons,
  weComOfficialDryRunNetworkModes,
  weComOfficialDryRunStatuses,
} from '@/modules/institution/domain/wecom-official-dry-run';

function evaluate(overrides: Parameters<typeof createDefaultWeComOfficialDryRunInput>[0] = {}) {
  return evaluateWeComOfficialDryRun(createDefaultWeComOfficialDryRunInput(overrides));
}

describe('官方路线 dry-run domain', () => {
  it('定义 dry-run 状态、networkMode 和 audit reason', () => {
    expect(weComOfficialDryRunStatuses).toEqual([
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
    ]);
    expect(weComOfficialDryRunNetworkModes).toEqual(['disabled', 'mock', 'live_dry_run_requested']);
    expect(weComOfficialDryRunAuditReasons).toEqual([
      'wecom_official_dry_run_viewed',
      'wecom_official_dry_run_evaluated',
      'wecom_official_dry_run_plan_ready',
      'wecom_official_dry_run_mock_completed',
      'wecom_official_dry_run_blocked',
      'wecom_official_dry_run_sensitive_payload_blocked',
      'wecom_official_dry_run_real_network_blocked',
      'wecom_official_dry_run_real_send_blocked',
    ]);
  });

  it('networkMode=disabled 只生成 plan_ready，不执行 mock', () => {
    const result = evaluate({ networkMode: 'disabled' });

    expect(result.dryRunStatus).toBe('plan_ready');
    expect(result.dryRunPlanReady).toBe(true);
    expect(result.mockDryRunCompleted).toBe(false);
    expect(result.auditReason).toBe('wecom_official_dry_run_plan_ready');
    expect(result.dryRunSteps.find((step) => step.id === 'mock-execute')?.status).toBe('ready');
    expect(result.noRealSend).toBe(true);
    expect(result.noRealNetwork).toBe(true);
    expect(result.noSecretRead).toBe(true);
    expect(result.noSecretOutput).toBe(true);
  });

  it('networkMode=mock 时完成本地模拟 dry-run 且不真实发送不真实出网', () => {
    const result = evaluate({ networkMode: 'mock' });

    expect(result.dryRunStatus).toBe('mock_dry_run_completed');
    expect(result.dryRunPlanReady).toBe(true);
    expect(result.mockDryRunCompleted).toBe(true);
    expect(result.auditReason).toBe('wecom_official_dry_run_mock_completed');
    expect(result.allowRealSend).toBe(false);
    expect(result.externalChannelEnabled).toBe(false);
    expect(result.realSendAllowed).toBe(false);
    expect(result.noRealSend).toBe(true);
    expect(result.noRealNetwork).toBe(true);
    expect(result.noSecretRead).toBe(true);
    expect(result.noSecretOutput).toBe(true);
  });

  it('live_dry_run_requested 必须被真实网络默认禁用守卫阻断且不调用 fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = evaluate({ networkMode: 'live_dry_run_requested' });

    expect(result.dryRunStatus).toBe('blocked_real_network_disabled');
    expect(result.auditReason).toBe('wecom_official_dry_run_real_network_blocked');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('非官方路线和 account_custody 路线阻断', () => {
    expect(evaluate({ officialRoute: null }).dryRunStatus).toBe('blocked_route_not_official');
    expect(evaluate({ officialRoute: 'account_custody' }).dryRunStatus).toBe('blocked_account_custody_route');
  });

  it('依赖 dry-run config、preflight mock_ready、proofEligibleMock 和人工确认', () => {
    expect(evaluate({ dryRunConfigStatus: 'not_configured' }).dryRunStatus).toBe('blocked_config_not_ready');
    expect(evaluate({ hasCallbackUrlPlaceholder: false }).dryRunStatus).toBe('blocked_config_not_ready');
    expect(evaluate({ preflightStatus: 'blocked_missing_manual_confirmation' }).dryRunStatus).toBe('blocked_preflight_not_ready');
    expect(evaluate({ proofEligibleMock: false }).dryRunStatus).toBe('blocked_preflight_not_ready');
    expect(evaluate({ hasManualConfirmation: false }).dryRunStatus).toBe('blocked_missing_manual_confirmation');
    expect(evaluate({ hasSecretPlaceholder: false }).dryRunStatus).toBe('blocked_no_secret_placeholder');
  });

  it('allowRealSend、externalChannelEnabled、realSendAllowed 和真实发送企图会强制 false 并阻断', () => {
    for (const overrides of [
      { allowRealSend: true },
      { externalChannelEnabled: true },
      { realSendAllowed: true },
      { dryRunOnly: false },
      { noRealSend: false },
      { hasRealSendAttempt: true },
    ]) {
      const result = evaluate(overrides);
      expect(result.dryRunStatus).toBe('blocked_real_send_forbidden');
      expect(result.allowRealSend).toBe(false);
      expect(result.externalChannelEnabled).toBe(false);
      expect(result.realSendAllowed).toBe(false);
      expect(result.noRealSend).toBe(true);
    }
  });

  it('corpId / secret / token / encodingAESKey / webhook / external_userid / userid 等敏感 payload 阻断且不回显', () => {
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
    expect(detectWeComOfficialDryRunPayloadGuards(payload).hasSensitivePayload).toBe(true);
    expect(assertWeComOfficialDryRunLowSensitivePayload(payload)).toBe(false);

    const result = evaluate({ hasSensitivePayload: true });
    expect(result.dryRunStatus).toBe('blocked_sensitive_payload');
    expect(result.auditReason).toBe('wecom_official_dry_run_sensitive_payload_blocked');
    const text = JSON.stringify(result);
    expect(text).not.toContain('corp-real');
    expect(text).not.toContain('access_token_real');
    expect(text).not.toContain('webhook-secret-real');
  });

  it('不读取 .env.local、不读取真实 process.env secret，并阻断 secret 读取企图', () => {
    const result = evaluate({ hasSecretReadAttempt: true });
    const payloadGuard = detectWeComOfficialDryRunPayloadGuards({ note: '请读取 process.env.WECOM_SECRET 或 .env.local' });

    expect(payloadGuard.hasSecretReadAttempt).toBe(true);
    expect(result.dryRunStatus).toBe('blocked_secret_read_attempt');
    expect(result.auditReason).toBe('wecom_official_dry_run_sensitive_payload_blocked');
    expect(result.noSecretRead).toBe(true);
    expect(result.noSecretOutput).toBe(true);
  });

  it('真实出网企图阻断且不调用 fetch', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const guards = detectWeComOfficialDryRunPayloadGuards({ endpoint: 'https://qyapi.weixin.qq.com/cgi-bin/gettoken' });
    const result = evaluate({ hasRealNetworkAttempt: true });

    expect(guards.hasRealNetworkAttempt).toBe(true);
    expect(result.dryRunStatus).toBe('blocked_real_network_disabled');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('生成 audit reason、时间线事件 metadata 和看板统计', () => {
    const plan = evaluate({ networkMode: 'disabled' });
    const mock = evaluate({ networkMode: 'mock' });
    const network = evaluate({ networkMode: 'live_dry_run_requested' });
    const send = evaluate({ allowRealSend: true });
    const sensitive = evaluate({ hasSensitivePayload: true });
    const noManual = evaluate({ hasManualConfirmation: false });
    const stats = buildWeComOfficialDryRunStats([plan, mock, network, send, sensitive, noManual]);

    expect(createWeComOfficialDryRunTimelineMetadata(mock)).toMatchObject({
      weComOfficialDryRunStatus: 'mock_dry_run_completed',
      weComOfficialDryRunPlanReady: 'true',
      weComOfficialDryRunMockCompleted: 'true',
      weComOfficialDryRunNoSecretOutput: 'true',
    });
    expect(mock.timelineSummary).toContain('官方路线 dry-run');
    expect(stats).toEqual({
      officialDryRunCheckCount: 6,
      officialDryRunPlanReadyCount: 2,
      officialDryRunMockCompletedCount: 1,
      officialDryRunRealNetworkBlockedCount: 1,
      officialDryRunRealSendBlockedCount: 1,
      officialDryRunSensitivePayloadBlockedCount: 1,
      officialDryRunMissingManualConfirmationBlockedCount: 1,
    });
  });
});
