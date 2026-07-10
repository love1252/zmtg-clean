export const weComCustomerContactPrecheckStatuses = [
  'blocked_customer_contact_capability_disabled',
  'blocked_permission_not_confirmed',
  'blocked_credential_placeholder_missing',
  'blocked_single_employee_not_selected',
  'blocked_real_network_must_remain_disabled',
  'blocked_customer_read_must_remain_disabled',
  'blocked_real_send_must_remain_disabled',
  'config_precheck_ready',
] as const;

export type WeComCustomerContactPrecheckStatus = (typeof weComCustomerContactPrecheckStatuses)[number];
export type WeComCustomerContactPrecheckReason = WeComCustomerContactPrecheckStatus;
export type WeComCustomerContactPrecheckAction = 'evaluate';

export type WeComCustomerContactPrecheckConfig = {
  capabilityEnabled: boolean;
  permissionConfirmed: boolean;
  credentialPlaceholderReady: boolean;
  singleEmployeeSelected: boolean;
  customerReadEnabled: boolean;
  networkEnabled: boolean;
  realSendEnabled: boolean;
};

export type WeComCustomerContactPrecheckSummary = WeComCustomerContactPrecheckConfig & {
  configured: boolean;
  precheckStatus: WeComCustomerContactPrecheckStatus;
  reason: WeComCustomerContactPrecheckReason;
  proofAuthorized: false;
  guards: {
    noSecretRead: true;
    noRealNetwork: true;
    noCustomerRead: true;
    noRealSend: true;
  };
};

function resolveStatus(config: WeComCustomerContactPrecheckConfig): WeComCustomerContactPrecheckStatus {
  if (config.networkEnabled) return 'blocked_real_network_must_remain_disabled';
  if (config.customerReadEnabled) return 'blocked_customer_read_must_remain_disabled';
  if (config.realSendEnabled) return 'blocked_real_send_must_remain_disabled';
  if (!config.capabilityEnabled) return 'blocked_customer_contact_capability_disabled';
  if (!config.permissionConfirmed) return 'blocked_permission_not_confirmed';
  if (!config.credentialPlaceholderReady) return 'blocked_credential_placeholder_missing';
  if (!config.singleEmployeeSelected) return 'blocked_single_employee_not_selected';
  return 'config_precheck_ready';
}

export function evaluateWeComCustomerContactPrecheck(
  config: WeComCustomerContactPrecheckConfig,
): WeComCustomerContactPrecheckSummary {
  const precheckStatus = resolveStatus(config);

  return {
    configured: config.capabilityEnabled &&
      config.permissionConfirmed &&
      config.credentialPlaceholderReady &&
      config.singleEmployeeSelected,
    ...config,
    precheckStatus,
    reason: precheckStatus,
    proofAuthorized: false,
    guards: {
      noSecretRead: true,
      noRealNetwork: true,
      noCustomerRead: true,
      noRealSend: true,
    },
  };
}
