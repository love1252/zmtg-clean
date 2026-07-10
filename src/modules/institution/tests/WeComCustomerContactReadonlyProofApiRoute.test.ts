import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GET,
  POST,
} from '@/app/api/institution/wecom-customer-contact-readonly-proof/route';
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

const corpValue = 'corp-local-proof-001';
const credentialValue = 'credential-local-proof-001';
const employeeUserIdValue = 'employee-local-proof-001';
const externalUserIdValue = 'external-user-local-proof-001';
const secondExternalUserIdValue = 'external-user-local-proof-002';
const tokenValue = 'token-local-proof-001';

function request(method: 'GET' | 'POST', body?: unknown) {
  return new Request(
    'http://localhost/api/institution/wecom-customer-contact-readonly-proof',
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
}

function rawPostRequest(body: string) {
  return new Request(
    'http://localhost/api/institution/wecom-customer-contact-readonly-proof',
    { method: 'POST', body },
  );
}

function validBody() {
  return {
    action: 'read_single_external_contact_once',
    confirmation: 'CONFIRM_READ_SINGLE_EXTERNAL_CONTACT_ONCE',
  };
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function stubWeComEnv(input: Partial<{
  corpId: string;
  customerContactSecret: string;
  testEmployeeUserId: string;
  capabilityEnabled: string;
  permissionConfirmed: string;
  credentialPlaceholderReady: string;
  singleEmployeeSelected: string;
  networkEnabled: string;
  customerReadEnabled: string;
  realSendEnabled: string;
}>) {
  vi.stubEnv('ZMTG_WECOM_CORP_ID', input.corpId);
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_SECRET', input.customerContactSecret);
  vi.stubEnv(
    'ZMTG_WECOM_CUSTOMER_CONTACT_TEST_EMPLOYEE_USER_ID',
    input.testEmployeeUserId,
  );
  vi.stubEnv(
    'ZMTG_WECOM_CUSTOMER_CONTACT_CAPABILITY_ENABLED',
    input.capabilityEnabled,
  );
  vi.stubEnv(
    'ZMTG_WECOM_CUSTOMER_CONTACT_PERMISSION_CONFIRMED',
    input.permissionConfirmed,
  );
  vi.stubEnv(
    'ZMTG_WECOM_CUSTOMER_CONTACT_SECRET_PLACEHOLDER_READY',
    input.credentialPlaceholderReady,
  );
  vi.stubEnv(
    'ZMTG_WECOM_CUSTOMER_CONTACT_SINGLE_EMPLOYEE_SELECTED',
    input.singleEmployeeSelected,
  );
  vi.stubEnv('ZMTG_WECOM_REAL_NETWORK_ENABLED', input.networkEnabled);
  vi.stubEnv('ZMTG_WECOM_CUSTOMER_CONTACT_READ_ENABLED', input.customerReadEnabled);
  vi.stubEnv('ZMTG_WECOM_REAL_SEND_ENABLED', input.realSendEnabled);
}

function stubCompleteWeComEnv(input: Partial<{
  corpId: string;
  customerContactSecret: string;
  testEmployeeUserId: string;
  capabilityEnabled: string;
  permissionConfirmed: string;
  credentialPlaceholderReady: string;
  singleEmployeeSelected: string;
  networkEnabled: string;
  customerReadEnabled: string;
  realSendEnabled: string;
}> = {}) {
  stubWeComEnv({
    corpId: input.corpId ?? corpValue,
    customerContactSecret: input.customerContactSecret ?? credentialValue,
    testEmployeeUserId: input.testEmployeeUserId ?? employeeUserIdValue,
    capabilityEnabled: input.capabilityEnabled ?? 'true',
    permissionConfirmed: input.permissionConfirmed ?? 'true',
    credentialPlaceholderReady: input.credentialPlaceholderReady ?? 'true',
    singleEmployeeSelected: input.singleEmployeeSelected ?? 'true',
    networkEnabled: input.networkEnabled ?? 'true',
    customerReadEnabled: input.customerReadEnabled ?? 'true',
    realSendEnabled: input.realSendEnabled ?? 'false',
  });
}

function tokenResponse(payload: unknown = { errcode: 0, access_token: tokenValue }) {
  return new Response(JSON.stringify(payload), { status: 200 });
}

function listResponse(externalUserIds: unknown) {
  return new Response(JSON.stringify({
    errcode: 0,
    errmsg: 'ok',
    external_userid: externalUserIds,
  }), { status: 200 });
}

function detailResponse(payload: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({
    errcode: 0,
    errmsg: 'ok',
    external_contact: {
      external_userid: externalUserIdValue,
      name: '禁止返回的姓名',
      avatar: 'https://example.invalid/avatar.png',
      gender: 1,
      unionid: 'union-local-proof-001',
      ...payload.external_contact as object,
    },
    follow_user: [{
      userid: employeeUserIdValue,
      remark: '禁止返回的备注',
      description: '禁止返回的描述',
      createtime: 1_752_134_400,
      tags: [{ group_name: '禁止返回的标签', tag_id: 'tag-local-proof-001' }],
    }],
    ...payload,
  }), { status: 200 });
}

function expectNoSensitiveOutput(payload: unknown) {
  const text = JSON.stringify(payload);
  expect(text).not.toContain(corpValue);
  expect(text).not.toContain(credentialValue);
  expect(text).not.toContain(employeeUserIdValue);
  expect(text).not.toContain(externalUserIdValue);
  expect(text).not.toContain(secondExternalUserIdValue);
  expect(text).not.toContain(tokenValue);
  expect(text).not.toContain('禁止返回的姓名');
  expect(text).not.toContain('禁止返回的备注');
  expect(text).not.toContain('禁止返回的描述');
  expect(text).not.toContain('禁止返回的标签');
  expect(text).not.toContain('access_token');
  expect(text).not.toContain('external_userid');
  expect(text).not.toContain('errmsg');
  expect(text).not.toContain('qyapi.weixin.qq.com');
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantAdminContext);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('wecom customer contact readonly proof API route', () => {
  it('GET 只返回低敏配置、门禁和状态且永不 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await GET(request('GET'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      configured: true,
      staticPrecheckReady: true,
      maskedConfig: {
        corpId: { configured: true, maskedValue: '***configured***' },
        customerContactSecret: { configured: true, maskedValue: '***configured***' },
        testEmployeeUserId: { configured: true, maskedValue: '***configured***' },
      },
      capabilityEnabled: true,
      permissionConfirmed: true,
      credentialPlaceholderReady: true,
      singleEmployeeSelected: true,
      networkEnabled: true,
      customerReadEnabled: true,
      realSendEnabled: false,
      readonlyProofStatus: 'readonly_proof_not_requested',
      proofAuthorized: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it('tenant_operator 可通过 real_channel/read 读取 GET 低敏状态', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantOperatorContext);
    stubCompleteWeComEnv({ networkEnabled: 'false' });

    const response = await GET(request('GET'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.readonlyProofStatus).toBe('blocked_real_network_disabled');
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it.each([
    ['capability', { capabilityEnabled: 'false' }, 'blocked_static_precheck_not_ready'],
    ['permission', { permissionConfirmed: 'false' }, 'blocked_static_precheck_not_ready'],
    ['secret placeholder', { credentialPlaceholderReady: 'false' }, 'blocked_static_precheck_not_ready'],
    ['single employee', { singleEmployeeSelected: 'false' }, 'blocked_static_precheck_not_ready'],
    ['CorpID', { corpId: '' }, 'blocked_missing_config'],
    ['Secret', { customerContactSecret: '' }, 'blocked_missing_config'],
    ['UserID', { testEmployeeUserId: '' }, 'blocked_missing_config'],
    ['network', { networkEnabled: 'false' }, 'blocked_real_network_disabled'],
    ['customer read', { customerReadEnabled: 'false' }, 'blocked_customer_read_disabled'],
    ['real send', { realSendEnabled: 'true' }, 'blocked_real_send_must_remain_disabled'],
  ] as const)('%s 门禁失败时 POST 阻断且不 fetch', async (_name, envOverride, expectedStatus) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv(envOverride);

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.readonlyProofStatus).toBe(expectedStatus);
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it.each([
    ['缺失字段', {}],
    ['缺失 action', { confirmation: 'CONFIRM_READ_SINGLE_EXTERNAL_CONTACT_ONCE' }],
    ['非法 action', { ...validBody(), action: 'unknown' }],
    ['缺失 confirmation', { action: 'read_single_external_contact_once' }],
    ['非法 confirmation', { ...validBody(), confirmation: 'WRONG' }],
    ['额外字段', { ...validBody(), extra: true }],
    ['数组', [validBody()]],
    ['字符串', 'read_single_external_contact_once'],
  ])('POST %s 返回 400 且不 fetch', async (_name, body) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await POST(request('POST', body));
    const payload = await json(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: 'invalid_readonly_proof_request',
      reason: 'invalid_readonly_proof_request',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it('POST 非法 JSON 返回 400 且不 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await POST(rawPostRequest('{'));
    const payload = await json(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: '请求格式不正确' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('超大 POST body 返回 400 且不 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await POST(request('POST', {
      ...validBody(),
      confirmation: 'X'.repeat(1_000),
    }));

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({ error: '请求格式不正确' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('tenant_operator POST 返回 403，鉴权失败前不读取 body 且不 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantOperatorContext);
    stubCompleteWeComEnv();
    const postRequest = request('POST', validBody());
    const textSpy = vi.spyOn(postRequest, 'text');

    const response = await POST(postRequest);

    expect(response.status).toBe(403);
    expect(await json(response)).toEqual({ error: '没有访问权限' });
    expect(textSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('未登录 POST 返回 401，鉴权失败前不读取 body 且不 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    stubCompleteWeComEnv();
    const postRequest = request('POST', validBody());
    const textSpy = vi.spyOn(postRequest, 'text');

    const response = await POST(postRequest);

    expect(response.status).toBe(401);
    expect(await json(response)).toEqual({ error: '请先登录' });
    expect(textSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('缺失 institutionId 的 tenant_admin POST 返回 403 且不 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      ...tenantAdminContext,
      institutionId: null,
    });
    stubCompleteWeComEnv();
    const postRequest = request('POST', validBody());
    const textSpy = vi.spyOn(postRequest, 'text');

    const response = await POST(postRequest);

    expect(response.status).toBe(403);
    expect(await json(response)).toEqual({ error: '没有访问权限' });
    expect(textSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gettoken 失败只返回阶段和数字 errcode', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(tokenResponse({
      errcode: 40001,
      errmsg: 'credential invalid',
      access_token: tokenValue,
      secret: credentialValue,
    }));
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      readonlyProofStatus: 'readonly_proof_auth_failed',
      diagnostic: { stage: 'gettoken', wecomErrcode: 40001 },
      proofAuthorized: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectNoSensitiveOutput(payload);
  });

  it('列表为 0 个时阻断且不调用详情接口', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(listResponse([]));
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(payload.readonlyProofStatus).toBe('blocked_no_external_contact');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expectNoSensitiveOutput(payload);
  });

  it('列表多于 1 个时阻断、不得任选且不调用详情接口', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(listResponse([
        externalUserIdValue,
        secondExternalUserIdValue,
      ]));
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(payload.readonlyProofStatus).toBe('blocked_external_contact_scope_not_single');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expectNoSensitiveOutput(payload);
  });

  it('列表恰好 1 个时调用该单对象详情并只返回字段白名单', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(listResponse([externalUserIdValue]))
      .mockResolvedValueOnce(detailResponse());
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      readonlyProofStatus: 'readonly_proof_completed',
      reason: 'readonly_proof_completed',
      proofAuthorized: false,
      contact: {
        proofContactId: 'live-contact-proof-01',
        proofEmployeeId: 'live-employee-proof-01',
        customerType: 'external_contact',
        addedAt: '2025-07-10T08:00:00.000Z',
        relationshipStatus: 'visible',
        deletionStatus: 'active',
        mode: 'real_readonly_proof',
        fieldWhitelistApplied: true,
        singleReadExecuted: true,
        proofAuthorized: false,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/cgi-bin/gettoken');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/cgi-bin/externalcontact/list');
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('/cgi-bin/externalcontact/get');
    expectNoSensitiveOutput(payload);
  });

  it('详情员工关系或对象标识不匹配时阻断完成状态', async () => {
    const mismatchedExternalUserId = 'external-user-mismatch-local-proof';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(listResponse([externalUserIdValue]))
      .mockResolvedValueOnce(detailResponse({
        external_contact: {
          external_userid: mismatchedExternalUserId,
        },
        follow_user: [{
          userid: 'other-employee-local-proof',
          createtime: 1_752_134_400,
        }],
      }));
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(payload.readonlyProofStatus).toBe('readonly_proof_failed');
    expect(payload.contact).toBeUndefined();
    expectNoSensitiveOutput(payload);
    expect(JSON.stringify(payload)).not.toContain(mismatchedExternalUserId);
  });

  it('详情接口权限失败只返回低敏数字诊断', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(listResponse([externalUserIdValue]))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        errcode: 48002,
        errmsg: 'api forbidden',
        external_userid: externalUserIdValue,
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(payload).toMatchObject({
      readonlyProofStatus: 'readonly_proof_permission_failed',
      diagnostic: { stage: 'externalcontact_get', wecomErrcode: 48002 },
    });
    expectNoSensitiveOutput(payload);
  });

  it('fetch 异常返回网络错误且不泄漏异常文本', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(
      new Error(`${credentialValue}:${employeeUserIdValue}:${externalUserIdValue}`),
    );
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(payload.readonlyProofStatus).toBe('readonly_proof_network_error');
    expect(payload.diagnostic).toBeUndefined();
    expectNoSensitiveOutput(payload);
  });

  it.each([
    ['非 2xx 响应', () => new Response(`${credentialValue}:${tokenValue}`, { status: 502 })],
    ['非法 JSON 响应', () => new Response(`{"errcode":0,"access_token":"${tokenValue}"`, { status: 200 })],
  ])('%s 只返回低敏网络错误', async (_name, responseFactory) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(responseFactory());
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(payload.readonlyProofStatus).toBe('readonly_proof_network_error');
    expect(payload.diagnostic).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectNoSensitiveOutput(payload);
  });

  it('超限响应在解析前取消流并返回低敏网络错误', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(body, {
      status: 200,
      headers: { 'content-length': '1000001' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv();

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(payload.readonlyProofStatus).toBe('readonly_proof_network_error');
    expect(cancel).toHaveBeenCalledTimes(1);
    expectNoSensitiveOutput(payload);
  });
});
