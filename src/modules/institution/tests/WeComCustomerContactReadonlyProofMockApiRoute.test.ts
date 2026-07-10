import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/institution/wecom-customer-contact-readonly-proof-mock/route';
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

const forbiddenKeys = [
  'customerDisplayName',
  'remarkSummary',
  'customerId',
  'weComCustomerRef',
  'ownerEmployeeDisplayName',
  'mappedSystemEmployeeRef',
  'userid',
  'UserID',
  'external_userid',
  'unionid',
  'openid',
  'secret',
  'token',
  'access_token',
];

const forbiddenValues = [
  'customer-contact-secret-local-test',
  'access-token-local-test',
  'employee-user-id-local-test',
  'external-user-id-local-test',
  'mock-sensitive-phone-13800138000',
  'mock-sensitive-wechat-account',
  'mock-sensitive-person-name',
  'mock-sensitive-address',
  'mock-sensitive-medical-record',
  'mock-sensitive-treatment-record',
  'https://qyapi.weixin.qq.com/cgi-bin/externalcontact/list?userid=employee-user-id-local-test',
  'raw-wecom-response-local-test',
  'mock-sensitive-chat-message',
];

const contactFields = [
  'proofContactId',
  'proofEmployeeId',
  'customerType',
  'addedAt',
  'relationshipStatus',
  'deletionStatus',
  'tagNames',
  'detailAvailable',
  'mode',
  'fieldWhitelistApplied',
  'proofAuthorized',
];

const fetchMock = vi.fn();

function request(method: 'GET' | 'POST', body?: unknown) {
  return new Request('http://localhost/api/institution/wecom-customer-contact-readonly-proof-mock', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function rawRequest(body: string) {
  return new Request('http://localhost/api/institution/wecom-customer-contact-readonly-proof-mock', {
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
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_URL', forbiddenValues[10]);
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_RAW_RESPONSE', forbiddenValues[11]);
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
  for (const key of forbiddenKeys) expect(text).not.toContain(`"${key}"`);
  for (const value of forbiddenValues) expect(text).not.toContain(value);
  expect(text).not.toContain('qyapi.weixin.qq.com');
  expect(text).not.toContain('cgi-bin');
  expect(text).not.toContain('?userid=');
}

function expectContactWhitelist(contact: object) {
  expect(Object.keys(contact).sort()).toEqual([...contactFields].sort());
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

describe('企业微信客户联系只读 proof mock API route', () => {
  it('GET 使用 real_channel/read，在 D1 ready 时只返回单员工和单联系人', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantOperatorContext);
    stubReadyEnv();

    const response = await GET(request('GET'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      precheckStatus: 'config_precheck_ready',
      mockProofStatus: 'mock_list_ready',
      reason: 'mock_list_ready',
      proofAuthorized: false,
    });
    const employee = payload.employee as object;
    const contacts = payload.contacts as object[];
    expect(employee).toEqual({
      proofEmployeeId: 'mock-employee-proof-01',
      mode: 'mock_only',
      proofAuthorized: false,
    });
    expect(contacts).toHaveLength(1);
    expectContactWhitelist(contacts[0]);
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it('POST 合法单对象请求返回 mock_detail_ready 和严格白名单详情', async () => {
    stubReadyEnv();

    const response = await POST(request('POST', {
      action: 'detail',
      proofContactId: 'mock-contact-proof-01',
    }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      precheckStatus: 'config_precheck_ready',
      mockProofStatus: 'mock_detail_ready',
      reason: 'mock_detail_ready',
      proofAuthorized: false,
    });
    const contact = payload.contact as Record<string, unknown>;
    expectContactWhitelist(contact);
    expect(contact).toMatchObject({
      proofContactId: 'mock-contact-proof-01',
      proofEmployeeId: 'mock-employee-proof-01',
      customerType: 'external_contact',
      relationshipStatus: 'visible',
      deletionStatus: 'active',
      tagNames: ['mock_low_sensitive', 'readonly_proof'],
      detailAvailable: true,
      mode: 'mock_only',
      fieldWhitelistApplied: true,
      proofAuthorized: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it('D1 未 ready 时 GET 返回阻断状态和空列表，POST 不返回详情', async () => {
    stubReadyEnv({ capabilityEnabled: 'false' });

    const getResponse = await GET(request('GET'));
    const getPayload = await json(getResponse);
    const postResponse = await POST(request('POST', {
      action: 'detail',
      proofContactId: 'mock-contact-proof-01',
    }));
    const postPayload = await json(postResponse);

    expect(getResponse.status).toBe(200);
    expect(getPayload).toEqual({
      precheckStatus: 'blocked_customer_contact_capability_disabled',
      mockProofStatus: 'blocked_config_precheck_not_ready',
      reason: 'blocked_config_precheck_not_ready',
      proofAuthorized: false,
      employee: null,
      contacts: [],
    });
    expect(postResponse.status).toBe(200);
    expect(postPayload).toEqual({
      precheckStatus: 'blocked_customer_contact_capability_disabled',
      mockProofStatus: 'blocked_config_precheck_not_ready',
      reason: 'blocked_config_precheck_not_ready',
      proofAuthorized: false,
    });
    expect(postPayload).not.toHaveProperty('contact');
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput([getPayload, postPayload]);
  });

  it.each([
    ['networkEnabled', 'blocked_real_network_must_remain_disabled'],
    ['customerReadEnabled', 'blocked_customer_read_must_remain_disabled'],
    ['realSendEnabled', 'blocked_real_send_must_remain_disabled'],
  ] as const)('%s 开启时 GET 和 POST 均保持对应阻断且不调用 fetch', async (key, status) => {
    stubReadyEnv({ [key]: 'true' });

    const getResponse = await GET(request('GET'));
    const getPayload = await json(getResponse);
    const postResponse = await POST(request('POST', {
      action: 'detail',
      proofContactId: 'mock-contact-proof-01',
    }));
    const postPayload = await json(postResponse);

    expect(getResponse.status).toBe(200);
    expect(getPayload).toMatchObject({
      mockProofStatus: status,
      reason: status,
      proofAuthorized: false,
      employee: null,
      contacts: [],
    });
    expect(postResponse.status).toBe(200);
    expect(postPayload).toMatchObject({
      mockProofStatus: status,
      reason: status,
      proofAuthorized: false,
    });
    expect(postPayload).not.toHaveProperty('contact');
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput([getPayload, postPayload]);
  });

  it.each([
    ['缺少 action', { proofContactId: 'mock-contact-proof-01' }],
    ['非法 action', { action: 'list', proofContactId: 'mock-contact-proof-01' }],
    ['缺少 ID', { action: 'detail' }],
    ['非字符串 ID', { action: 'detail', proofContactId: 1 }],
    ['空 ID', { action: 'detail', proofContactId: '' }],
    ['仅空白 ID', { action: 'detail', proofContactId: '   ' }],
    ['ID 前后有空白', { action: 'detail', proofContactId: ' mock-contact-proof-01 ' }],
    ['额外字段', { action: 'detail', proofContactId: 'mock-contact-proof-01', extra: true }],
    ['非对象 body', 'detail'],
  ])('POST %s 返回 400', async (_caseName, body) => {
    stubReadyEnv();

    const response = await POST(request('POST', body));
    const payload = await json(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'invalid_detail_request', reason: 'invalid_detail_request' });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it('POST 非法 JSON 返回 400', async () => {
    stubReadyEnv();

    const response = await POST(rawRequest('{'));
    const payload = await json(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: '请求格式不正确' });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it('POST 未知 proofContactId 返回 404 且不回显输入', async () => {
    const unknownId = 'unknown-sensitive-proof-contact-id';
    stubReadyEnv();

    const response = await POST(request('POST', {
      action: 'detail',
      proofContactId: unknownId,
    }));
    const payload = await json(response);

    expect(response.status).toBe(404);
    expect(payload).toEqual({
      precheckStatus: 'config_precheck_ready',
      mockProofStatus: 'mock_contact_not_found',
      reason: 'mock_contact_not_found',
      proofAuthorized: false,
    });
    expect(JSON.stringify(payload)).not.toContain(unknownId);
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it('tenant_operator POST 返回 403，且鉴权前不读取 body', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantOperatorContext);
    const jsonSpy = vi.fn().mockRejectedValue(new Error('body must not be read'));
    const forbiddenRequest = Object.assign(request('POST'), { json: jsonSpy });
    stubReadyEnv();

    const response = await POST(forbiddenRequest);
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
  ] as const)('%s 未登录返回 401', async (method, handler) => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    stubReadyEnv();

    const response = await handler(request(method, method === 'POST' ? {
      action: 'detail',
      proofContactId: 'mock-contact-proof-01',
    } : undefined));
    const payload = await json(response);

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: '请先登录' });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });
});
