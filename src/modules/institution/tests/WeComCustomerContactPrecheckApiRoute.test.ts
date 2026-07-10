import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/institution/wecom-customer-contact-precheck/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/server/access-context')>();
  return {
    ...actual,
    getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
  };
});

const tenantAdminContext: AccessContext = {
  userId: 'tenant-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-a',
  institutionId: 'inst-a',
  source: 'demo_session',
};

const tenantOperatorContext: AccessContext = {
  ...tenantAdminContext,
  userId: 'tenant-operator',
  role: 'tenant_operator',
};

const forbiddenValues = [
  'customer-contact-secret-local-test',
  'access-token-local-test',
  'employee-user-id-local-test',
  'external-user-id-local-test',
  'https://qyapi.weixin.qq.com/cgi-bin/externalcontact/list?userid=employee-user-id-local-test',
  'raw-wecom-response-local-test',
];

const fetchMock = vi.fn();

function request(method: 'GET' | 'POST', body?: unknown) {
  return new Request('http://localhost/api/institution/wecom-customer-contact-precheck', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function rawRequest(body: string) {
  return new Request('http://localhost/api/institution/wecom-customer-contact-precheck', {
    method: 'POST',
    body,
  });
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function stubPrecheckEnv(input: Partial<{
  capabilityEnabled: string;
  permissionConfirmed: string;
  credentialPlaceholderReady: string;
  singleEmployeeSelected: string;
  customerReadEnabled: string;
  networkEnabled: string;
  realSendEnabled: string;
}> = {}) {
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_CAPABILITY_ENABLED', input.capabilityEnabled);
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_PERMISSION_CONFIRMED', input.permissionConfirmed);
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_SECRET_PLACEHOLDER_READY', input.credentialPlaceholderReady);
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_SINGLE_EMPLOYEE_SELECTED', input.singleEmployeeSelected);
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_READ_ENABLED', input.customerReadEnabled);
  vi.stubEnv('ZMTG_WECOM_REAL_NETWORK_ENABLED', input.networkEnabled);
  vi.stubEnv('ZMTG_WECOM_REAL_SEND_ENABLED', input.realSendEnabled);

  vi.stubEnv('ZMTG_WECOM_AGENT_SECRET', forbiddenValues[0]);
  vi.stubEnv('ZMTG_WECOM_ACCESS_TOKEN', forbiddenValues[1]);
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_EMPLOYEE_USER_ID', forbiddenValues[2]);
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_EXTERNAL_USER_ID', forbiddenValues[3]);
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_URL', forbiddenValues[4]);
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_RAW_RESPONSE', forbiddenValues[5]);
}

function stubReadyEnv(overrides: Parameters<typeof stubPrecheckEnv>[0] = {}) {
  stubPrecheckEnv({
    capabilityEnabled: 'true',
    permissionConfirmed: 'true',
    credentialPlaceholderReady: 'true',
    singleEmployeeSelected: 'true',
    customerReadEnabled: 'false',
    networkEnabled: 'false',
    realSendEnabled: 'false',
    ...overrides,
  });
}

function expectNoSensitiveOutput(payload: unknown) {
  const text = JSON.stringify(payload);
  for (const value of forbiddenValues) expect(text).not.toContain(value);
  expect(text).not.toContain('access_token');
  expect(text).not.toContain('external_userid');
  expect(text).not.toContain('qyapi.weixin.qq.com');
  expect(text).not.toContain('cgi-bin');
  expect(text).not.toContain('?userid=');
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantAdminContext);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('wecom customer contact precheck API route', () => {
  it('GET 使用 real_channel/read 返回低敏配置状态', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantOperatorContext);
    stubReadyEnv();

    const response = await GET(request('GET'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      configured: true,
      capabilityEnabled: true,
      permissionConfirmed: true,
      credentialPlaceholderReady: true,
      singleEmployeeSelected: true,
      customerReadEnabled: false,
      networkEnabled: false,
      realSendEnabled: false,
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
    expectNoSensitiveOutput(payload);
  });

  it('POST evaluate 在四个占位声明完成且真实开关关闭时只返回 config_precheck_ready', async () => {
    stubReadyEnv();

    const response = await POST(request('POST', { action: 'evaluate' }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      configured: true,
      capabilityEnabled: true,
      permissionConfirmed: true,
      credentialPlaceholderReady: true,
      singleEmployeeSelected: true,
      networkEnabled: false,
      customerReadEnabled: false,
      realSendEnabled: false,
      precheckStatus: 'config_precheck_ready',
      reason: 'config_precheck_ready',
      proofAuthorized: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it.each([
    ['capabilityEnabled', 'blocked_customer_contact_capability_disabled'],
    ['permissionConfirmed', 'blocked_permission_not_confirmed'],
    ['credentialPlaceholderReady', 'blocked_credential_placeholder_missing'],
    ['singleEmployeeSelected', 'blocked_single_employee_not_selected'],
  ] as const)('POST %s 未声明时返回对应阻断状态', async (key, status) => {
    stubReadyEnv({ [key]: 'false' });

    const response = await POST(request('POST', { action: 'evaluate' }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      configured: false,
      [key]: false,
      precheckStatus: status,
      reason: status,
      proofAuthorized: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it.each([
    ['networkEnabled', 'blocked_real_network_must_remain_disabled'],
    ['customerReadEnabled', 'blocked_customer_read_must_remain_disabled'],
    ['realSendEnabled', 'blocked_real_send_must_remain_disabled'],
  ] as const)('POST %s=true 时安全阻断且不调用 fetch', async (key, status) => {
    stubReadyEnv({ [key]: 'true' });

    const response = await POST(request('POST', { action: 'evaluate' }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
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
    expectNoSensitiveOutput(payload);
  });

  it.each([
    ['缺少 action', {}],
    ['未知 action', { action: 'preflight' }],
    ['非字符串 action', { action: 1 }],
    ['非对象 body', 'evaluate'],
  ])('POST %s 返回 400 且不调用 fetch', async (_caseName, body) => {
    stubReadyEnv();

    const response = await POST(request('POST', body));
    const payload = await json(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'invalid_action', reason: 'invalid_action' });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it('POST 非法 JSON 返回 400 且不调用 fetch', async () => {
    stubReadyEnv();

    const response = await POST(rawRequest('{'));
    const payload = await json(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: '请求格式不正确' });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it('POST 忽略 action 之外字段，不触发 URL、标识或外部行为', async () => {
    stubReadyEnv();

    const response = await POST(request('POST', {
      action: 'evaluate',
      secret: forbiddenValues[0],
      access_token: forbiddenValues[1],
      UserID: forbiddenValues[2],
      external_userid: forbiddenValues[3],
      url: forbiddenValues[4],
      rawResponse: forbiddenValues[5],
    }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      precheckStatus: 'config_precheck_ready',
      proofAuthorized: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it('tenant_operator POST 返回 403，且鉴权前不读取 body、不调用 fetch', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantOperatorContext);
    const jsonSpy = vi.fn().mockRejectedValue(new Error('body must not be read'));
    const unauthorizedRequest = Object.assign(request('POST'), { json: jsonSpy });
    stubReadyEnv();

    const response = await POST(unauthorizedRequest);
    const payload = await json(response);

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: '没有访问权限' });
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)('%s 未登录返回 401 且不调用 fetch', async (method, handler) => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    stubReadyEnv();

    const response = await handler(request(method, method === 'POST' ? { action: 'evaluate' } : undefined));
    const payload = await json(response);

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: '请先登录' });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });
});
