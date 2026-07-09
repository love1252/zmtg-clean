import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/institution/wecom-official-secret-precheck/route';
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

const corpValue = 'corp-local-precheck-001';
const agentValue = '100001';
const credentialValue = 'credential-local-precheck-001';
const tokenValue = 'token-local-precheck-001';

function request(method: 'GET' | 'POST', body?: unknown) {
  return new Request('http://localhost/api/institution/wecom-official-secret-precheck', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function stubWeComEnv(input: {
  corpId?: string;
  agentId?: string;
  agentSecret?: string;
  networkEnabled?: string;
  realSendEnabled?: string;
}) {
  vi.stubEnv('ZMTG_WECOM_CORP_ID', input.corpId);
  vi.stubEnv('ZMTG_WECOM_AGENT_ID', input.agentId);
  vi.stubEnv('ZMTG_WECOM_AGENT_SECRET', input.agentSecret);
  vi.stubEnv('ZMTG_WECOM_REAL_NETWORK_ENABLED', input.networkEnabled);
  vi.stubEnv('ZMTG_WECOM_REAL_SEND_ENABLED', input.realSendEnabled);
}

function expectNoSensitiveOutput(payload: unknown) {
  const text = JSON.stringify(payload);
  expect(text).not.toContain(corpValue);
  expect(text).not.toContain(agentValue);
  expect(text).not.toContain(credentialValue);
  expect(text).not.toContain(tokenValue);
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

describe('wecom official secret precheck API route', () => {
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
      ],
      maskedConfig: {
        corpId: { configured: false, maskedValue: null },
        agentId: { configured: false, maskedValue: null },
        agentSecret: { configured: false, maskedValue: null },
      },
      networkEnabled: false,
      realSendEnabled: false,
      preflightStatus: 'blocked_missing_config',
      reason: 'missing_required_config',
    });
    expectNoSensitiveOutput(payload);
  });

  it('GET mask 已配置状态且不返回 env 原文', async () => {
    stubWeComEnv({
      corpId: corpValue,
      agentId: agentValue,
      agentSecret: credentialValue,
      networkEnabled: 'false',
      realSendEnabled: 'false',
    });

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
      },
      preflightStatus: 'blocked_real_network_disabled',
      reason: 'blocked_real_network_disabled',
    });
    expectNoSensitiveOutput(payload);
  });

  it('POST 配置完整但 network disabled 时不出网', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubWeComEnv({
      corpId: corpValue,
      agentId: agentValue,
      agentSecret: credentialValue,
      networkEnabled: 'false',
      realSendEnabled: 'false',
    });

    const response = await POST(request('POST', { action: 'preflight' }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      configured: true,
      networkEnabled: false,
      preflightStatus: 'blocked_real_network_disabled',
      reason: 'blocked_real_network_disabled',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expectNoSensitiveOutput(payload);
  });

  it('POST real send disabled 时阻断 send 类动作且不调用 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubWeComEnv({
      corpId: corpValue,
      agentId: agentValue,
      agentSecret: credentialValue,
      networkEnabled: 'true',
      realSendEnabled: 'false',
    });

    const response = await POST(request('POST', { action: 'send' }));
    const payload = await json(response);

    expect(payload).toMatchObject({
      realSendEnabled: false,
      preflightStatus: 'blocked_real_send_disabled',
      reason: 'blocked_real_send_disabled',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST real send enabled 仍不允许 send 类动作', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    stubWeComEnv({
      corpId: corpValue,
      agentId: agentValue,
      agentSecret: credentialValue,
      networkEnabled: 'true',
      realSendEnabled: 'true',
    });

    const response = await POST(request('POST', { action: 'send' }));
    const payload = await json(response);

    expect(payload).toMatchObject({
      realSendEnabled: true,
      preflightStatus: 'blocked_real_send_not_implemented',
      reason: 'blocked_real_send_not_implemented',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST network enabled 时只执行 token/auth 预检成功', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errcode: 0, access_token: tokenValue }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    stubWeComEnv({
      corpId: corpValue,
      agentId: agentValue,
      agentSecret: credentialValue,
      networkEnabled: 'true',
      realSendEnabled: 'false',
    });

    const response = await POST(request('POST', { action: 'preflight' }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      preflightStatus: 'token_preflight_ok',
      reason: 'token_preflight_ok',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/cgi-bin/gettoken');
    expectNoSensitiveOutput(payload);
  });

  it('POST token 预检失败时只返回低敏 reason code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errcode: 40001, errmsg: 'credential invalid' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    stubWeComEnv({
      corpId: corpValue,
      agentId: agentValue,
      agentSecret: credentialValue,
      networkEnabled: 'true',
      realSendEnabled: 'false',
    });

    const response = await POST(request('POST', { action: 'preflight' }));
    const payload = await json(response);

    expect(payload).toMatchObject({
      preflightStatus: 'token_preflight_auth_failed',
      reason: 'token_preflight_auth_failed',
    });
    expectNoSensitiveOutput(payload);
  });
});
