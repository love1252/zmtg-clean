export type SafetySwitchState = {
  tenantRealChannelEnabled: boolean;
  institutionRealChannelEnabled: boolean;
  weComRealSendEnabled: boolean;
  smsRealSendEnabled: boolean;
  webhookEnabled: boolean;
  emergencyStopEnabled: boolean;
  allowRealSend: boolean;
  externalChannelEnabled: boolean;
};

export type SafetySwitchBlockReason =
  | 'tenant_real_channel_disabled'
  | 'institution_real_channel_disabled'
  | 'wecom_real_send_disabled'
  | 'sms_real_send_disabled'
  | 'webhook_disabled'
  | 'emergency_stop_enabled'
  | 'allow_real_send_forced_false'
  | 'external_channel_forced_false';

export type SafetySwitchViewModel = SafetySwitchState & {
  status: 'mock_only';
  realChannelBlocked: boolean;
  blockReasons: SafetySwitchBlockReason[];
  boundaryLabels: string[];
};

export const defaultSafetySwitchState: SafetySwitchState = {
  tenantRealChannelEnabled: false,
  institutionRealChannelEnabled: false,
  weComRealSendEnabled: false,
  smsRealSendEnabled: false,
  webhookEnabled: false,
  emergencyStopEnabled: true,
  allowRealSend: false,
  externalChannelEnabled: false,
};

function uniqueReasons(reasons: SafetySwitchBlockReason[]) {
  return [...new Set(reasons)];
}

export function deriveSafetySwitchViewModel(
  input: Partial<SafetySwitchState> = {},
): SafetySwitchViewModel {
  const requested = { ...defaultSafetySwitchState, ...input };
  const state: SafetySwitchState = {
    ...requested,
    emergencyStopEnabled: true,
    allowRealSend: false,
    externalChannelEnabled: false,
  };
  const blockReasons: SafetySwitchBlockReason[] = [];

  if (!state.tenantRealChannelEnabled) blockReasons.push('tenant_real_channel_disabled');
  if (!state.institutionRealChannelEnabled) blockReasons.push('institution_real_channel_disabled');
  if (!state.weComRealSendEnabled) blockReasons.push('wecom_real_send_disabled');
  if (!state.smsRealSendEnabled) blockReasons.push('sms_real_send_disabled');
  if (!state.webhookEnabled) blockReasons.push('webhook_disabled');
  if (state.emergencyStopEnabled) blockReasons.push('emergency_stop_enabled');
  blockReasons.push('allow_real_send_forced_false', 'external_channel_forced_false');

  return {
    ...state,
    status: 'mock_only',
    realChannelBlocked: true,
    blockReasons: uniqueReasons(blockReasons),
    boundaryLabels: [
      '当前权限 / 安全边界：机构内角色按最小权限访问',
      '真实渠道默认关闭',
      '企业微信真实发送关闭',
      '短信真实发送关闭',
      'webhook 关闭',
      state.emergencyStopEnabled ? 'emergency stop 已开启' : 'emergency stop 可阻断真实渠道',
      '当前仍为 mock',
      '不接真实 HIS / 企业微信 / 短信 / webhook',
      '不真实发送 / 不真实出网',
    ],
  };
}

export function hasRealChannelEnableAttempt(input: Partial<SafetySwitchState>) {
  return Boolean(
    input.tenantRealChannelEnabled ||
      input.institutionRealChannelEnabled ||
      input.weComRealSendEnabled ||
      input.smsRealSendEnabled ||
      input.webhookEnabled ||
      input.allowRealSend ||
      input.externalChannelEnabled,
  );
}
