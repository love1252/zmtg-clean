import { describe, expect, it } from 'vitest';
import {
  containsUnsafeWeComAuthorizationText,
  createDefaultWeComAuthorizationRecord,
  createWeComAuthorizationRecord,
  evaluateWeComAuthorizationForDelivery,
  mapWeComAuthorizationToDashboardView,
} from '@/modules/institution/domain/wecom-authorization';

const occurredAt = '2026-07-07T00:00:00.000Z';

function record(status: Parameters<typeof createWeComAuthorizationRecord>[0]['status']) {
  return createWeComAuthorizationRecord({
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    status,
    occurredAt,
  });
}

describe('wecom authorization mock model domain', () => {
  it('默认未配置且安全关闭，不允许真实发送', () => {
    const authorization = createDefaultWeComAuthorizationRecord({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      occurredAt,
    });
    const gate = evaluateWeComAuthorizationForDelivery(authorization);
    const view = mapWeComAuthorizationToDashboardView(authorization);

    expect(authorization).toEqual(expect.objectContaining({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      status: 'not_configured',
      authorizedCorpDisplayName: '未配置企业微信主体',
      authorizedCorpRef: 'corp:not-configured',
      capabilityScope: [],
      customerContactAuthorized: false,
      externalContactSyncAuthorized: false,
      customerOwnerSyncAuthorized: false,
      weComReachOutAuthorized: false,
      sessionArchiveAuthorized: false,
      inGray: false,
      allowRealSend: false,
      defaultClosed: true,
      externalChannelEnabled: false,
    }));
    expect(gate).toEqual(expect.objectContaining({
      availableForMock: false,
      allowRealSend: false,
      externalChannelEnabled: false,
      defaultClosed: true,
      reason: 'wecom_mock_authorization_unavailable',
      messageDeliveryFailureReason: 'wecom_authorization_missing',
    }));
    expect(view).toEqual(expect.objectContaining({
      accessTitle: '企业微信客户运营接入',
      notLoginTitle: '不是企业微信登录',
      statusLabel: '未配置',
      isMockAuthorized: false,
      notConnectedToRealWeCom: true,
      notWeComServiceApplied: true,
      requiresHumanApprovalAndMessageDelivery: true,
      sessionArchivePostponed: true,
      allowRealSend: false,
    }));
  });

  it('模拟已授权仅允许 mock / manual 链路，仍不允许真实发送', () => {
    const authorization = record('mock_authorized');
    const gate = evaluateWeComAuthorizationForDelivery(authorization);
    const view = mapWeComAuthorizationToDashboardView(authorization);

    expect(authorization).toEqual(expect.objectContaining({
      status: 'mock_authorized',
      authorizedCorpDisplayName: '模拟机构企业微信主体',
      authorizedCorpRef: 'corp:mock-low-sensitive',
      customerContactAuthorized: true,
      externalContactSyncAuthorized: true,
      customerOwnerSyncAuthorized: true,
      weComReachOutAuthorized: true,
      sessionArchiveAuthorized: false,
      capabilityScope: ['customer_contact', 'external_contact_sync', 'customer_owner_sync', 'wecom_reach_out'],
      allowRealSend: false,
      externalChannelEnabled: false,
      defaultClosed: true,
    }));
    expect(gate).toEqual(expect.objectContaining({
      availableForMock: true,
      allowRealSend: false,
      reason: 'wecom_mock_authorization_read',
      messageDeliveryFailureReason: 'wecom_external_channel_disabled',
    }));
    expect(view).toEqual(expect.objectContaining({
      statusLabel: '模拟已授权',
      isMockAuthorized: true,
      sessionArchiveAuthorized: false,
      sessionArchivePostponed: true,
      defaultClosed: true,
      allowRealSend: false,
      externalChannelEnabled: false,
    }));
  });

  it('撤销、过期、禁用均阻断企业微信触达', () => {
    const cases = [
      ['revoked', 'wecom_authorization_revoked'],
      ['expired', 'wecom_authorization_expired'],
      ['disabled', 'wecom_authorization_disabled'],
    ] as const;

    for (const [status, reason] of cases) {
      expect(evaluateWeComAuthorizationForDelivery(record(status))).toEqual(expect.objectContaining({
        availableForMock: false,
        allowRealSend: false,
        externalChannelEnabled: false,
        reason: 'wecom_mock_authorization_unavailable',
        messageDeliveryFailureReason: reason,
      }));
    }
  });

  it('外部通道未启用时即使有 mock 授权也不能真实发送', () => {
    const authorization = record('external_channel_disabled');

    expect(evaluateWeComAuthorizationForDelivery(authorization)).toEqual(expect.objectContaining({
      availableForMock: true,
      allowRealSend: false,
      externalChannelEnabled: false,
      defaultClosed: true,
      reason: 'wecom_channel_default_closed',
      messageDeliveryFailureReason: 'wecom_external_channel_disabled',
    }));
  });

  it('企业微信触达未授权时阻断，但会话内容存档不进入当前发送链路', () => {
    const authorization = createWeComAuthorizationRecord({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      status: 'mock_authorized',
      weComReachOutAuthorized: false,
      sessionArchiveAuthorized: true,
      occurredAt,
    });
    const view = mapWeComAuthorizationToDashboardView(authorization);

    expect(evaluateWeComAuthorizationForDelivery(authorization)).toEqual(expect.objectContaining({
      availableForMock: false,
      allowRealSend: false,
      reason: 'wecom_reach_out_unauthorized',
      messageDeliveryFailureReason: 'wecom_reach_out_unauthorized',
    }));
    expect(view.sessionArchiveAuthorized).toBe(false);
    expect(view.sessionArchivePostponed).toBe(true);
    expect(view.deliveryRelation.description).toContain('MessageDelivery');
    expect(view.deliveryRelation.description).toContain('timeline / audit / dashboard');
  });

  it('view model 仅输出低敏白名单字段并清洗敏感输入', () => {
    expect(containsUnsafeWeComAuthorizationText('ww1234567890abcdef')).toBe(true);
    expect(containsUnsafeWeComAuthorizationText('secret access_token encodingAESKey callback token 13800000000')).toBe(true);

    const authorization = createWeComAuthorizationRecord({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      status: 'mock_authorized',
      authorizedCorpDisplayName: 'secret access_token 13800000000',
      authorizedCorpRef: 'ww1234567890abcdef',
      employeeScopeSummary: 'encodingAESKey callback token',
      lastErrorReason: 'HIS payload 完整聊天记录 provider model token cost vendor',
      occurredAt,
    });
    const view = mapWeComAuthorizationToDashboardView(authorization);
    const serialized = JSON.stringify(view);

    expect(view.authorizedCorpDisplayName).toBe('模拟机构企业微信主体');
    expect(view.authorizedCorpRef).toBe('corp:mock-low-sensitive');
    expect(view.employeeScopeSummary).toBe('授权员工范围未配置，仅展示低敏摘要。');
    expect(view.lastErrorReason).toBe('低敏授权状态异常。');
    expect(serialized).not.toMatch(
      /ww1234567890abcdef|secret|access_token|refresh_token|encodingAESKey|callback|13800000000|110101199001011234|MR-RAW|完整聊天|HIS payload/i,
    );
  });
});
