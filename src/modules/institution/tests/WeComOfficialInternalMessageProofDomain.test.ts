import { describe, expect, it, vi } from 'vitest';
import {
  evaluateWeComOfficialInternalMessageProof,
  maskWeComOfficialInternalMessageProofConfig,
  summarizeWeComOfficialInternalMessageProofConfig,
  weComOfficialInternalMessageProofStatuses,
  weComOfficialInternalTestMessageContent,
  type WeComOfficialInternalMessageProofClient,
  type WeComOfficialInternalMessageProofConfig,
} from '@/modules/institution/domain/wecom-official-internal-message-proof';

const baseConfig: WeComOfficialInternalMessageProofConfig = {
  corpId: 'corp-local-proof-001',
  agentId: '100001',
  agentSecret: 'secret-local-proof-001',
  internalTestUserId: 'user-local-proof-001',
  networkEnabled: false,
  realSendEnabled: false,
};

function expectNoSensitiveOutput(payload: unknown) {
  const text = JSON.stringify(payload);
  expect(text).not.toContain(baseConfig.corpId);
  expect(text).not.toContain(baseConfig.agentId);
  expect(text).not.toContain(baseConfig.agentSecret);
  expect(text).not.toContain(baseConfig.internalTestUserId);
  expect(text).not.toContain('access_token');
  expect(text).not.toContain('errmsg');
}

function expectNoDiagnostic(payload: { diagnostic?: unknown }) {
  expect(payload.diagnostic).toBeUndefined();
}

describe('wecom official internal message proof domain', () => {
  it('公开固定测试消息和低敏状态集合', () => {
    expect(weComOfficialInternalTestMessageContent).toBe('这是一条智美天工企业微信内部通道联调测试消息，无需回复。');
    expect(weComOfficialInternalMessageProofStatuses).toContain('internal_message_proof_not_requested');
    expect(weComOfficialInternalMessageProofStatuses).toContain('blocked_invalid_recipient');
    expect(weComOfficialInternalMessageProofStatuses).toContain('internal_message_proof_sent');
  });

  it('env 缺失时返回 missingKeys', () => {
    const summary = summarizeWeComOfficialInternalMessageProofConfig({
      corpId: null,
      agentId: null,
      agentSecret: null,
      internalTestUserId: null,
      networkEnabled: false,
      realSendEnabled: false,
    });

    expect(summary).toMatchObject({
      configured: false,
      missingKeys: [
        'ZMTG_WECOM_CORP_ID',
        'ZMTG_WECOM_AGENT_ID',
        'ZMTG_WECOM_AGENT_SECRET',
        'ZMTG_WECOM_INTERNAL_TEST_USER_ID',
      ],
      messageProofStatus: 'blocked_missing_config',
      reason: 'missing_required_config',
    });
    expectNoSensitiveOutput(summary);
  });

  it('配置 mask 不返回 UserID、secret 或 token 字段原文', () => {
    const masked = maskWeComOfficialInternalMessageProofConfig(baseConfig);

    expect(masked).toEqual({
      corpId: { configured: true, maskedValue: '***configured***' },
      agentId: { configured: true, maskedValue: '***configured***' },
      agentSecret: { configured: true, maskedValue: '***configured***' },
      internalTestUserId: { configured: true, maskedValue: '***configured***' },
    });
    expectNoSensitiveOutput(masked);
  });

  it('UserID 缺失时阻断', async () => {
    const client: WeComOfficialInternalMessageProofClient = {
      sendInternalTestMessage: vi.fn(),
    };

    const summary = await evaluateWeComOfficialInternalMessageProof({
      config: { ...baseConfig, internalTestUserId: null, networkEnabled: true, realSendEnabled: true },
      confirmed: true,
      client,
    });

    expect(summary).toMatchObject({
      messageProofStatus: 'blocked_missing_config',
      reason: 'missing_required_config',
    });
    expect(client.sendInternalTestMessage).not.toHaveBeenCalled();
    expectNoDiagnostic(summary);
    expectNoSensitiveOutput(summary);
  });

  it('UserID 为 @all 时阻断', async () => {
    const client: WeComOfficialInternalMessageProofClient = {
      sendInternalTestMessage: vi.fn(),
    };

    const summary = await evaluateWeComOfficialInternalMessageProof({
      config: { ...baseConfig, internalTestUserId: '@all', networkEnabled: true, realSendEnabled: true },
      confirmed: true,
      client,
    });

    expect(summary).toMatchObject({
      configured: true,
      messageProofStatus: 'blocked_invalid_recipient',
      reason: 'blocked_invalid_recipient',
    });
    expect(client.sendInternalTestMessage).not.toHaveBeenCalled();
    expectNoDiagnostic(summary);
    expectNoSensitiveOutput(summary);
  });

  it('UserID 包含多个接收人分隔符时阻断', async () => {
    const client: WeComOfficialInternalMessageProofClient = {
      sendInternalTestMessage: vi.fn(),
    };

    const summary = await evaluateWeComOfficialInternalMessageProof({
      config: { ...baseConfig, internalTestUserId: 'user-a|user-b', networkEnabled: true, realSendEnabled: true },
      confirmed: true,
      client,
    });

    expect(summary).toMatchObject({
      configured: true,
      messageProofStatus: 'blocked_invalid_recipient',
      reason: 'blocked_invalid_recipient',
    });
    expect(client.sendInternalTestMessage).not.toHaveBeenCalled();
    expectNoDiagnostic(summary);
    expectNoSensitiveOutput(summary);
  });

  it('network=false 时阻断且不调用发送 client', async () => {
    const client: WeComOfficialInternalMessageProofClient = {
      sendInternalTestMessage: vi.fn(),
    };

    const summary = await evaluateWeComOfficialInternalMessageProof({
      config: { ...baseConfig, networkEnabled: false, realSendEnabled: true },
      confirmed: true,
      client,
    });

    expect(summary).toMatchObject({
      messageProofStatus: 'blocked_real_network_disabled',
      reason: 'blocked_real_network_disabled',
    });
    expect(client.sendInternalTestMessage).not.toHaveBeenCalled();
  });

  it('realSend=false 时阻断且不调用发送 client', async () => {
    const client: WeComOfficialInternalMessageProofClient = {
      sendInternalTestMessage: vi.fn(),
    };

    const summary = await evaluateWeComOfficialInternalMessageProof({
      config: { ...baseConfig, networkEnabled: true, realSendEnabled: false },
      confirmed: true,
      client,
    });

    expect(summary).toMatchObject({
      messageProofStatus: 'blocked_real_send_disabled',
      reason: 'blocked_real_send_disabled',
    });
    expect(client.sendInternalTestMessage).not.toHaveBeenCalled();
  });

  it('confirmation 缺失时阻断且不调用发送 client', async () => {
    const client: WeComOfficialInternalMessageProofClient = {
      sendInternalTestMessage: vi.fn(),
    };

    const summary = await evaluateWeComOfficialInternalMessageProof({
      config: { ...baseConfig, networkEnabled: true, realSendEnabled: true },
      confirmed: false,
      client,
    });

    expect(summary).toMatchObject({
      messageProofStatus: 'blocked_missing_confirmation',
      reason: 'blocked_missing_confirmation',
    });
    expect(client.sendInternalTestMessage).not.toHaveBeenCalled();
  });

  it('门禁满足时调用发送 client 并只返回低敏成功状态', async () => {
    const client: WeComOfficialInternalMessageProofClient = {
      sendInternalTestMessage: vi.fn().mockResolvedValue({ ok: true }),
    };

    const summary = await evaluateWeComOfficialInternalMessageProof({
      config: { ...baseConfig, networkEnabled: true, realSendEnabled: true },
      confirmed: true,
      client,
    });

    expect(summary).toMatchObject({
      messageProofStatus: 'internal_message_proof_sent',
      reason: 'internal_message_proof_sent',
    });
    expect(client.sendInternalTestMessage).toHaveBeenCalledWith({
      corpId: baseConfig.corpId,
      agentId: baseConfig.agentId,
      agentSecret: baseConfig.agentSecret,
      internalTestUserId: baseConfig.internalTestUserId,
    });
    expectNoSensitiveOutput(summary);
  });

  it('auth failed 和 send failed 可返回低敏数字 errcode 诊断', async () => {
    const authFailedClient: WeComOfficialInternalMessageProofClient = {
      sendInternalTestMessage: vi.fn().mockResolvedValue({
        ok: false,
        reason: 'auth_failed',
        diagnostic: { stage: 'gettoken', wecomErrcode: 40001 },
      }),
    };
    const sendFailedClient: WeComOfficialInternalMessageProofClient = {
      sendInternalTestMessage: vi.fn().mockResolvedValue({
        ok: false,
        reason: 'send_failed',
        diagnostic: { stage: 'message_send', wecomErrcode: 81013 },
      }),
    };

    const authFailedSummary = await evaluateWeComOfficialInternalMessageProof({
      config: { ...baseConfig, networkEnabled: true, realSendEnabled: true },
      confirmed: true,
      client: authFailedClient,
    });
    expect(authFailedSummary).toMatchObject({
      messageProofStatus: 'internal_message_proof_auth_failed',
      reason: 'internal_message_proof_auth_failed',
      diagnostic: { stage: 'gettoken', wecomErrcode: 40001 },
    });
    expectNoSensitiveOutput(authFailedSummary);

    const sendFailedSummary = await evaluateWeComOfficialInternalMessageProof({
      config: { ...baseConfig, networkEnabled: true, realSendEnabled: true },
      confirmed: true,
      client: sendFailedClient,
    });
    expect(sendFailedSummary).toMatchObject({
      messageProofStatus: 'internal_message_proof_send_failed',
      reason: 'internal_message_proof_send_failed',
      diagnostic: { stage: 'message_send', wecomErrcode: 81013 },
    });
    expectNoSensitiveOutput(sendFailedSummary);
  });
});
