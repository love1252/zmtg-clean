import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluateWeComOfficialSecretPrecheck,
  maskWeComOfficialSecretConfig,
  summarizeWeComOfficialSecretPrecheckConfig,
  weComOfficialSecretEnvKeys,
  weComOfficialSecretPrecheckStatuses,
  type WeComOfficialSecretPrecheckConfig,
  type WeComOfficialTokenPreflightClient,
} from '@/modules/institution/domain/wecom-official-secret-precheck';

const completeConfig: WeComOfficialSecretPrecheckConfig = {
  corpId: 'corp-local-test-001',
  agentId: '100001',
  agentSecret: 'agent-secret-local-test-001',
  networkEnabled: false,
  realSendEnabled: false,
};

function expectNoSensitiveOutput(payload: unknown) {
  const text = JSON.stringify(payload);
  expect(text).not.toContain('corp-local-test-001');
  expect(text).not.toContain('100001');
  expect(text).not.toContain('agent-secret-local-test-001');
  expect(text).not.toContain('access-token-local-test');
}

describe('wecom official secret precheck domain', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('定义允许读取的 env keys 和低敏 preflight 状态', () => {
    expect(weComOfficialSecretEnvKeys).toEqual([
      'ZMTG_WECOM_CORP_ID',
      'ZMTG_WECOM_AGENT_ID',
      'ZMTG_WECOM_AGENT_SECRET',
      'ZMTG_WECOM_REAL_NETWORK_ENABLED',
      'ZMTG_WECOM_REAL_SEND_ENABLED',
    ]);
    expect(weComOfficialSecretPrecheckStatuses).toEqual([
      'blocked_missing_config',
      'blocked_real_network_disabled',
      'blocked_real_send_disabled',
      'blocked_real_send_not_implemented',
      'token_preflight_not_requested',
      'token_preflight_ok',
      'token_preflight_auth_failed',
      'token_preflight_failed',
      'token_preflight_network_error',
    ]);
  });

  it('env 缺失时返回 missingKeys 和 masked config 状态', () => {
    const result = summarizeWeComOfficialSecretPrecheckConfig({
      corpId: null,
      agentId: null,
      agentSecret: null,
      networkEnabled: false,
      realSendEnabled: false,
    });

    expect(result).toMatchObject({
      configured: false,
      missingKeys: [
        'ZMTG_WECOM_CORP_ID',
        'ZMTG_WECOM_AGENT_ID',
        'ZMTG_WECOM_AGENT_SECRET',
      ],
      maskedConfig: {
        corpId: { configured: false, maskedValue: null },
        agentId: { configured: false, maskedValue: null },
        agentSecret: { configured: false, maskedValue: null },
      },
      networkEnabled: false,
      realSendEnabled: false,
      preflightStatus: 'blocked_missing_config',
      reason: 'missing_required_config',
    });
  });

  it('mask secret、corpId 和 agentId，不输出原文', () => {
    const masked = maskWeComOfficialSecretConfig(completeConfig);

    expect(masked).toEqual({
      corpId: { configured: true, maskedValue: '***configured***' },
      agentId: { configured: true, maskedValue: '***configured***' },
      agentSecret: { configured: true, maskedValue: '***configured***' },
    });
    expectNoSensitiveOutput(masked);
  });

  it('配置完整但 network disabled 时阻断且不调用 token client', async () => {
    const tokenClient: WeComOfficialTokenPreflightClient = {
      checkToken: vi.fn(),
    };

    const result = await evaluateWeComOfficialSecretPrecheck({
      config: completeConfig,
      tokenClient,
    });

    expect(result).toMatchObject({
      configured: true,
      preflightStatus: 'blocked_real_network_disabled',
      reason: 'blocked_real_network_disabled',
      networkEnabled: false,
    });
    expect(tokenClient.checkToken).not.toHaveBeenCalled();
    expectNoSensitiveOutput(result);
  });

  it('real send disabled 时任何 send 类动作都阻断', async () => {
    const result = await evaluateWeComOfficialSecretPrecheck({
      config: { ...completeConfig, networkEnabled: true, realSendEnabled: false },
      action: 'send',
      tokenClient: { checkToken: vi.fn() },
    });

    expect(result).toMatchObject({
      realSendEnabled: false,
      preflightStatus: 'blocked_real_send_disabled',
      reason: 'blocked_real_send_disabled',
    });
  });

  it('即使 real send enabled，也不允许真实发送', async () => {
    const result = await evaluateWeComOfficialSecretPrecheck({
      config: { ...completeConfig, networkEnabled: true, realSendEnabled: true },
      action: 'send',
      tokenClient: { checkToken: vi.fn() },
    });

    expect(result).toMatchObject({
      realSendEnabled: true,
      preflightStatus: 'blocked_real_send_not_implemented',
      reason: 'blocked_real_send_not_implemented',
    });
  });

  it('network enabled 时通过 injected client 执行 token 预检成功', async () => {
    const tokenClient: WeComOfficialTokenPreflightClient = {
      checkToken: vi.fn().mockResolvedValue({ ok: true }),
    };

    const result = await evaluateWeComOfficialSecretPrecheck({
      config: { ...completeConfig, networkEnabled: true },
      tokenClient,
    });

    expect(tokenClient.checkToken).toHaveBeenCalledWith({
      corpId: 'corp-local-test-001',
      agentSecret: 'agent-secret-local-test-001',
    });
    expect(result).toMatchObject({
      preflightStatus: 'token_preflight_ok',
      reason: 'token_preflight_ok',
    });
    expectNoSensitiveOutput(result);
  });

  it('token 预检失败只返回低敏错误码', async () => {
    const tokenClient: WeComOfficialTokenPreflightClient = {
      checkToken: vi.fn().mockResolvedValue({ ok: false, reason: 'auth_failed' }),
    };

    const result = await evaluateWeComOfficialSecretPrecheck({
      config: { ...completeConfig, networkEnabled: true },
      tokenClient,
    });

    expect(result).toMatchObject({
      preflightStatus: 'token_preflight_auth_failed',
      reason: 'token_preflight_auth_failed',
    });
    expectNoSensitiveOutput(result);
  });
});
