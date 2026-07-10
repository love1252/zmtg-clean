import { describe, expect, it, vi } from 'vitest';
import {
  evaluateWeComCustomerContactPrecheck,
  weComCustomerContactPrecheckStatuses,
  type WeComCustomerContactPrecheckConfig,
} from '@/modules/institution/domain/wecom-customer-contact-precheck';
import { readWeComCustomerContactPrecheckConfig } from '@/modules/institution/server/wecom-customer-contact-precheck-runtime';

const readyConfig: WeComCustomerContactPrecheckConfig = {
  capabilityEnabled: true,
  permissionConfirmed: true,
  credentialPlaceholderReady: true,
  singleEmployeeSelected: true,
  customerReadEnabled: false,
  networkEnabled: false,
  realSendEnabled: false,
};

describe('wecom customer contact precheck domain', () => {
  it('定义完整的低敏配置预检状态', () => {
    expect(weComCustomerContactPrecheckStatuses).toEqual([
      'blocked_customer_contact_capability_disabled',
      'blocked_permission_not_confirmed',
      'blocked_credential_placeholder_missing',
      'blocked_single_employee_not_selected',
      'blocked_real_network_must_remain_disabled',
      'blocked_customer_read_must_remain_disabled',
      'blocked_real_send_must_remain_disabled',
      'config_precheck_ready',
    ]);
  });

  it('四个配置占位均已声明且三个真实开关关闭时仅达到 config_precheck_ready', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = evaluateWeComCustomerContactPrecheck(readyConfig);

    expect(result).toEqual({
      configured: true,
      ...readyConfig,
      precheckStatus: 'config_precheck_ready',
      reason: 'config_precheck_ready',
      proofAuthorized: false,
      guards: {
        noSecretRead: true,
        noRealNetwork: true,
        noCustomerRead: true,
        noRealSend: true,
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it.each([
    ['capabilityEnabled', 'blocked_customer_contact_capability_disabled'],
    ['permissionConfirmed', 'blocked_permission_not_confirmed'],
    ['credentialPlaceholderReady', 'blocked_credential_placeholder_missing'],
    ['singleEmployeeSelected', 'blocked_single_employee_not_selected'],
  ] as const)('%s 未声明时返回对应阻断状态', (key, status) => {
    const result = evaluateWeComCustomerContactPrecheck({ ...readyConfig, [key]: false });

    expect(result).toMatchObject({
      configured: false,
      precheckStatus: status,
      reason: status,
      proofAuthorized: false,
    });
  });

  it.each([
    ['networkEnabled', 'blocked_real_network_must_remain_disabled'],
    ['customerReadEnabled', 'blocked_customer_read_must_remain_disabled'],
    ['realSendEnabled', 'blocked_real_send_must_remain_disabled'],
  ] as const)('%s 开启时安全阻断且 proofAuthorized 始终为 false', (key, status) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = evaluateWeComCustomerContactPrecheck({ ...readyConfig, [key]: true });

    expect(result).toMatchObject({
      configured: true,
      [key]: true,
      precheckStatus: status,
      reason: status,
      proofAuthorized: false,
      guards: {
        noSecretRead: true,
        noRealNetwork: true,
        noCustomerRead: true,
        noRealSend: true,
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('真实开关优先于配置占位阻断，并按 network、customer read、real send 排序', () => {
    expect(evaluateWeComCustomerContactPrecheck({
      ...readyConfig,
      capabilityEnabled: false,
      networkEnabled: true,
      customerReadEnabled: true,
      realSendEnabled: true,
    }).precheckStatus).toBe('blocked_real_network_must_remain_disabled');

    expect(evaluateWeComCustomerContactPrecheck({
      ...readyConfig,
      permissionConfirmed: false,
      customerReadEnabled: true,
      realSendEnabled: true,
    }).precheckStatus).toBe('blocked_customer_read_must_remain_disabled');

    expect(evaluateWeComCustomerContactPrecheck({
      ...readyConfig,
      credentialPlaceholderReady: false,
      realSendEnabled: true,
    }).precheckStatus).toBe('blocked_real_send_must_remain_disabled');
  });

  it('runtime 只读取七个允许的布尔状态，且仅精确字符串 true 视为开启', () => {
    const accessedKeys: string[] = [];
    const envValues: NodeJS.ProcessEnv = {
      NODE_ENV: 'test',
      ZMTG_WECOM_CUSTOMER_CONTACT_CAPABILITY_ENABLED: 'true',
      ZMTG_WECOM_CUSTOMER_CONTACT_PERMISSION_CONFIRMED: 'TRUE',
      ZMTG_WECOM_CUSTOMER_CONTACT_SECRET_PLACEHOLDER_READY: ' true',
      ZMTG_WECOM_CUSTOMER_CONTACT_SINGLE_EMPLOYEE_SELECTED: 'true',
      ZMTG_WECOM_CUSTOMER_CONTACT_READ_ENABLED: '1',
      ZMTG_WECOM_REAL_NETWORK_ENABLED: 'false',
      ZMTG_WECOM_REAL_SEND_ENABLED: 'true',
      ZMTG_WECOM_AGENT_SECRET: 'must-not-be-read',
      ZMTG_WECOM_CUSTOMER_CONTACT_EMPLOYEE_USER_ID: 'must-not-be-read',
      ZMTG_WECOM_CUSTOMER_CONTACT_EXTERNAL_USER_ID: 'must-not-be-read',
    };
    const env = new Proxy(envValues, {
      get(target, property, receiver) {
        if (typeof property === 'string') accessedKeys.push(property);
        return Reflect.get(target, property, receiver);
      },
    });

    expect(readWeComCustomerContactPrecheckConfig(env)).toEqual({
      capabilityEnabled: true,
      permissionConfirmed: false,
      credentialPlaceholderReady: false,
      singleEmployeeSelected: true,
      customerReadEnabled: false,
      networkEnabled: false,
      realSendEnabled: true,
    });
    expect(accessedKeys).toEqual([
      'ZMTG_WECOM_CUSTOMER_CONTACT_CAPABILITY_ENABLED',
      'ZMTG_WECOM_CUSTOMER_CONTACT_PERMISSION_CONFIRMED',
      'ZMTG_WECOM_CUSTOMER_CONTACT_SECRET_PLACEHOLDER_READY',
      'ZMTG_WECOM_CUSTOMER_CONTACT_SINGLE_EMPLOYEE_SELECTED',
      'ZMTG_WECOM_CUSTOMER_CONTACT_READ_ENABLED',
      'ZMTG_WECOM_REAL_NETWORK_ENABLED',
      'ZMTG_WECOM_REAL_SEND_ENABLED',
    ]);
  });
});
