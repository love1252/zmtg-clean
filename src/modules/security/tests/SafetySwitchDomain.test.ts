import { describe, expect, it } from 'vitest';
import {
  defaultSafetySwitchState,
  deriveSafetySwitchViewModel,
  hasRealChannelEnableAttempt,
} from '@/modules/security/domain/safety-switch';

describe('安全开关领域', () => {
  it('默认关闭所有真实渠道并开启 emergency stop', () => {
    expect(defaultSafetySwitchState).toEqual({
      tenantRealChannelEnabled: false,
      institutionRealChannelEnabled: false,
      weComRealSendEnabled: false,
      smsRealSendEnabled: false,
      webhookEnabled: false,
      emergencyStopEnabled: true,
      allowRealSend: false,
      externalChannelEnabled: false,
    });

    const viewModel = deriveSafetySwitchViewModel();
    expect(viewModel.realChannelBlocked).toBe(true);
    expect(viewModel.allowRealSend).toBe(false);
    expect(viewModel.externalChannelEnabled).toBe(false);
    expect(viewModel.blockReasons).toEqual(
      expect.arrayContaining([
        'tenant_real_channel_disabled',
        'institution_real_channel_disabled',
        'wecom_real_send_disabled',
        'sms_real_send_disabled',
        'webhook_disabled',
        'emergency_stop_enabled',
        'allow_real_send_forced_false',
        'external_channel_forced_false',
      ]),
    );
  });

  it('即使请求打开所有真实渠道也强制 mock 和阻断真实发送', () => {
    const viewModel = deriveSafetySwitchViewModel({
      tenantRealChannelEnabled: true,
      institutionRealChannelEnabled: true,
      weComRealSendEnabled: true,
      smsRealSendEnabled: true,
      webhookEnabled: true,
      emergencyStopEnabled: false,
      allowRealSend: true,
      externalChannelEnabled: true,
    });

    expect(viewModel.realChannelBlocked).toBe(true);
    expect(viewModel.emergencyStopEnabled).toBe(true);
    expect(viewModel.allowRealSend).toBe(false);
    expect(viewModel.externalChannelEnabled).toBe(false);
    expect(viewModel.blockReasons).toEqual(
      expect.arrayContaining([
        'emergency_stop_enabled',
        'allow_real_send_forced_false',
        'external_channel_forced_false',
      ]),
    );
  });

  it('识别真实渠道开启尝试并提供页面低敏展示文案', () => {
    expect(hasRealChannelEnableAttempt({ weComRealSendEnabled: true })).toBe(true);
    expect(hasRealChannelEnableAttempt({ emergencyStopEnabled: true })).toBe(false);

    const viewModel = deriveSafetySwitchViewModel();
    expect(viewModel.boundaryLabels).toEqual(
      expect.arrayContaining([
        '当前权限 / 安全边界：机构内角色按最小权限访问',
        '真实渠道默认关闭',
        '企业微信真实发送关闭',
        '短信真实发送关闭',
        'webhook 关闭',
        'emergency stop 已开启',
        '当前仍为 mock',
        '不接真实 HIS / 企业微信 / 短信 / webhook',
        '不真实发送 / 不真实出网',
      ]),
    );
  });
});
