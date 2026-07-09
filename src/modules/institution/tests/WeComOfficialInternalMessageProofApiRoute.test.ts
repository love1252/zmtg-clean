import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/institution/wecom-official-internal-message-proof/route';
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
const agentValue = '100001';
const credentialValue = 'credential-local-proof-001';
const userIdValue = 'user-local-proof-001';
const tokenValue = 'token-local-proof-001';

function request(method: 'GET' | 'POST', body?: unknown) {
  return new Request('http://localhost/api/institution/wecom-official-internal-message-proof', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function rawRequest(method: 'POST', body: string) {
  return new Request('http://localhost/api/institution/wecom-official-internal-message-proof', {
    method,
    body,
  });
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function stubWeComEnv(input: {
  corpId?: string;
  agentId?: string;
  agentSecret?: string;
  internalTestUserId?: string;
  networkEnabled?: string;
  realSendEnabled?: string;
}) {
  vi.stubEnv('ZMTG_WECOM_CORP_ID', input.corpId);
  vi.stubEnv('ZMTG_WECOM_AGENT_ID', input.agentId);
  vi.stubEnv('ZMTG_WECOM_AGENT_SECRET', input.agentSecret);
  vi.stubEnv('ZMTG_WECOM_INTERNAL_TEST_USER_ID', input.internalTestUserId);
  vi.stubEnv('ZMTG_WECOM_REAL_NETWORK_ENABLED', input.networkEnabled);
  vi.stubEnv('ZMTG_WECOM_REAL_SEND_ENABLED', input.realSendEnabled);
}

function stubCompleteWeComEnv(input: {
  internalTestUserId?: string;
  networkEnabled?: string;
  realSendEnabled?: string;
} = {}) {
  stubWeComEnv({
    corpId: corpValue,
    agentId: agentValue,
    agentSecret: credentialValue,
    internalTestUserId: input.internalTestUserId ?? userIdValue,
    networkEnabled: input.networkEnabled ?? 'false',
    realSendEnabled: input.realSendEnabled ?? 'false',
  });
}

function expectNoSensitiveOutput(payload: unknown) {
  const text = JSON.stringify(payload);
  expect(text).not.toContain(corpValue);
  expect(text).not.toContain(agentValue);
  expect(text).not.toContain(credentialValue);
  expect(text).not.toContain(userIdValue);
  expect(text).not.toContain(tokenValue);
  expect(text).not.toContain('access_token');
  expect(text).not.toContain('errmsg');
  expect(text).not.toContain('qyapi.weixin.qq.com');
}

function expectNoDiagnostic(payload: { diagnostic?: unknown }) {
  expect(payload.diagnostic).toBeUndefined();
}

function validBody() {
  return {
    action: 'send_internal_test_message',
    confirmation: 'CONFIRM_SEND_INTERNAL_TEST_MESSAGE_ONCE',
  };
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

describe('wecom official internal message proof API route', () => {
  it('GET 在 env 缺失时返回缺失 keys 和低敏配置状态', async () => {
    stubWeComEnv({});

    const response = await GET(request('GET'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      configured: false,
      missingKeys: [
        'ZMTG_WECOM_CORP_ID',
        'ZMTG_WECOM_AGENT_ID',
        'ZMTG_WECOM_AGENT_SECRET',
        'ZMTG_WECOM_INTERNAL_TEST_USER_ID',
      ],
      maskedConfig: {
        corpId: { configured: false, maskedValue: null },
        agentId: { configured: false, maskedValue: null },
        agentSecret: { configured: false, maskedValue: null },
        internalTestUserId: { configured: false, maskedValue: null },
      },
      networkEnabled: false,
      realSendEnabled: false,
      messageProofStatus: 'blocked_missing_config',
      reason: 'missing_required_config',
    });
    expectNoSensitiveOutput(payload);
  });

  it('GET mask 已配置状态且不返回 UserID 或 secret 原文', async () => {
    stubCompleteWeComEnv({ networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await GET(request('GET'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      configured: true,
      missingKeys: [],
      maskedConfig: {
        corpId: { configured: true, maskedValue: '***configured***' },
        agentId: { configured: true, maskedValue: '***configured***' },
        agentSecret: { configured: true, maskedValue: '***configured***' },
        internalTestUserId: { configured: true, maskedValue: '***configured***' },
      },
      messageProofStatus: 'internal_message_proof_not_requested',
      reason: 'internal_message_proof_not_requested',
    });
    expectNoSensitiveOutput(payload);
  });

  it('UserID 缺失时阻断且不调用 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubWeComEnv({
      corpId: corpValue,
      agentId: agentValue,
      agentSecret: credentialValue,
      networkEnabled: 'true',
      realSendEnabled: 'true',
    });

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      messageProofStatus: 'blocked_missing_config',
      reason: 'missing_required_config',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoDiagnostic(payload);
    expectNoSensitiveOutput(payload);
  });

  it('UserID 为 @all 时阻断且不调用 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv({ internalTestUserId: '@all', networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      configured: true,
      messageProofStatus: 'blocked_invalid_recipient',
      reason: 'blocked_invalid_recipient',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoDiagnostic(payload);
    expectNoSensitiveOutput(payload);
  });

  it('UserID 包含多个接收人分隔符时阻断且不调用 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv({ internalTestUserId: 'user-a|user-b', networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      configured: true,
      messageProofStatus: 'blocked_invalid_recipient',
      reason: 'blocked_invalid_recipient',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoDiagnostic(payload);
    expectNoSensitiveOutput(payload);
  });

  it('network=false 时 POST 不 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv({ networkEnabled: 'false', realSendEnabled: 'true' });

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      networkEnabled: false,
      messageProofStatus: 'blocked_real_network_disabled',
      reason: 'blocked_real_network_disabled',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoDiagnostic(payload);
  });

  it('realSend=false 时 POST 不 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv({ networkEnabled: 'true', realSendEnabled: 'false' });

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      realSendEnabled: false,
      messageProofStatus: 'blocked_real_send_disabled',
      reason: 'blocked_real_send_disabled',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoDiagnostic(payload);
  });

  it.each([
    ['缺少 action', {}],
    ['非法 action', { action: 'unknown', confirmation: 'CONFIRM_SEND_INTERNAL_TEST_MESSAGE_ONCE' }],
    ['非字符串 action', { action: 123, confirmation: 'CONFIRM_SEND_INTERNAL_TEST_MESSAGE_ONCE' }],
    ['非对象 body', 'send_internal_test_message'],
  ])('POST %s 返回 400 且不 fetch', async (_caseName, body) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv({ networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await POST(request('POST', body));
    const payload = await json(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'invalid_action', reason: 'invalid_action' });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoDiagnostic(payload);
    expectNoSensitiveOutput(payload);
  });

  it.each([
    ['缺失 confirmation', { action: 'send_internal_test_message' }],
    ['错误 confirmation', { action: 'send_internal_test_message', confirmation: 'WRONG' }],
  ])('POST %s 返回 400 且不 fetch', async (_caseName, body) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv({ networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await POST(request('POST', body));
    const payload = await json(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'invalid_confirmation', reason: 'invalid_confirmation' });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoDiagnostic(payload);
    expectNoSensitiveOutput(payload);
  });

  it('POST 非法 JSON 返回 400 且不 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv({ networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await POST(rawRequest('POST', '{'));
    const payload = await json(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: '请求格式不正确' });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoDiagnostic(payload);
    expectNoSensitiveOutput(payload);
  });

  it('tenant_operator 无 POST 权限返回 403 且不 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantOperatorContext);
    stubCompleteWeComEnv({ networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: '没有访问权限' });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoDiagnostic(payload);
  });

  it('未登录返回 401 且不 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    stubCompleteWeComEnv({ networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: '请先登录' });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoDiagnostic(payload);
  });

  it('GET 继续使用 real_channel/read，tenant_operator 可读取低敏状态', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantOperatorContext);
    stubCompleteWeComEnv({ networkEnabled: 'false', realSendEnabled: 'false' });

    const response = await GET(request('GET'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      configured: true,
      messageProofStatus: 'blocked_real_network_disabled',
      reason: 'blocked_real_network_disabled',
    });
    expectNoSensitiveOutput(payload);
  });

  it('realSend=true + network=true + confirmation 正确时 mock fetch 执行 gettoken + message/send', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0, access_token: tokenValue }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0, errmsg: 'ok' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv({ networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      messageProofStatus: 'internal_message_proof_sent',
      reason: 'internal_message_proof_sent',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/cgi-bin/gettoken');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/cgi-bin/message/send');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('access_token=');
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.body))).toEqual({
      touser: userIdValue,
      msgtype: 'text',
      agentid: Number(agentValue),
      text: { content: '这是一条智美天工企业微信内部通道联调测试消息，无需回复。' },
      safe: 0,
      enable_id_trans: 0,
      enable_duplicate_check: 0,
    });
    expectNoDiagnostic(payload);
    expectNoSensitiveOutput(payload);
  });

  it('mock access_token、UserID、secret 不出现在响应中', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0, access_token: tokenValue }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0, userid: userIdValue, secret: credentialValue }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv({ networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expectNoSensitiveOutput(payload);
  });

  it('企业微信 gettoken 返回 errcode=40001 时返回低敏数字 errcode 诊断', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        errcode: 40001,
        errmsg: 'credential invalid',
        access_token: tokenValue,
        userid: userIdValue,
        secret: credentialValue,
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv({ networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      messageProofStatus: 'internal_message_proof_auth_failed',
      reason: 'internal_message_proof_auth_failed',
      diagnostic: { stage: 'gettoken', wecomErrcode: 40001 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expectNoSensitiveOutput(payload);
  });

  it('企业微信 message/send 返回 errcode=81013 时返回低敏数字 errcode 诊断', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0, access_token: tokenValue }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        errcode: 81013,
        errmsg: 'bad userid',
        userid: userIdValue,
        access_token: tokenValue,
        secret: credentialValue,
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv({ networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      messageProofStatus: 'internal_message_proof_send_failed',
      reason: 'internal_message_proof_send_failed',
      diagnostic: { stage: 'message_send', wecomErrcode: 81013 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expectNoSensitiveOutput(payload);
  });

  it('企业微信 message/send 返回 errcode=60020 时返回低敏数字 errcode 诊断', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ errcode: 0, access_token: tokenValue }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        errcode: 60020,
        errmsg: 'not allow ip',
        userid: userIdValue,
        access_token: tokenValue,
        secret: credentialValue,
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    stubCompleteWeComEnv({ networkEnabled: 'true', realSendEnabled: 'true' });

    const response = await POST(request('POST', validBody()));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      messageProofStatus: 'internal_message_proof_auth_failed',
      reason: 'internal_message_proof_auth_failed',
      diagnostic: { stage: 'message_send', wecomErrcode: 60020 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expectNoSensitiveOutput(payload);
  });
});
