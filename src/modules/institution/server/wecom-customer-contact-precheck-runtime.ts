import type { WeComCustomerContactPrecheckConfig } from '@/modules/institution/domain/wecom-customer-contact-precheck';

const allowedEnvKeys = {
  capabilityEnabled: 'ZMTG_WECOM_CUSTOMER_CONTACT_CAPABILITY_ENABLED',
  permissionConfirmed: 'ZMTG_WECOM_CUSTOMER_CONTACT_PERMISSION_CONFIRMED',
  credentialPlaceholderReady: 'ZMTG_WECOM_CUSTOMER_CONTACT_SECRET_PLACEHOLDER_READY',
  singleEmployeeSelected: 'ZMTG_WECOM_CUSTOMER_CONTACT_SINGLE_EMPLOYEE_SELECTED',
  customerReadEnabled: 'ZMTG_WECOM_CUSTOMER_CONTACT_READ_ENABLED',
  networkEnabled: 'ZMTG_WECOM_REAL_NETWORK_ENABLED',
  realSendEnabled: 'ZMTG_WECOM_REAL_SEND_ENABLED',
} as const;

function readBooleanEnv(env: NodeJS.ProcessEnv, key: keyof typeof allowedEnvKeys) {
  return env[allowedEnvKeys[key]] === 'true';
}

export function readWeComCustomerContactPrecheckConfig(
  env: NodeJS.ProcessEnv = process.env,
): WeComCustomerContactPrecheckConfig {
  return {
    capabilityEnabled: readBooleanEnv(env, 'capabilityEnabled'),
    permissionConfirmed: readBooleanEnv(env, 'permissionConfirmed'),
    credentialPlaceholderReady: readBooleanEnv(env, 'credentialPlaceholderReady'),
    singleEmployeeSelected: readBooleanEnv(env, 'singleEmployeeSelected'),
    customerReadEnabled: readBooleanEnv(env, 'customerReadEnabled'),
    networkEnabled: readBooleanEnv(env, 'networkEnabled'),
    realSendEnabled: readBooleanEnv(env, 'realSendEnabled'),
  };
}
