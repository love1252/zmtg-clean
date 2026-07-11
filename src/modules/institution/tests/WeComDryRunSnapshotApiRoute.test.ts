import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  getDatabase: vi.fn(),
  createRepository: vi.fn(),
  runTransaction: vi.fn(),
  evaluateAndPersist: vi.fn(),
}));
vi.mock('@/modules/security/server/access-context', () => ({ getDemoAccessContextFromRequest: mocks.getContext }));
vi.mock('@/server/db/client', () => ({ getDatabase: mocks.getDatabase }));
vi.mock('@/modules/institution/server/trusted-reachout-safety-repository', () => ({ createTrustedReachOutSafetyRepository: mocks.createRepository }));
vi.mock('@/modules/institution/server/trusted-reachout-safety-transaction', () => ({ runTrustedReachOutSafetyTransaction: mocks.runTransaction }));
vi.mock('@/modules/institution/server/wecom-dry-run-snapshot-service', async (importOriginal) => ({
  ...(await importOriginal<object>()), evaluateAndPersistWeComDryRunSnapshot: mocks.evaluateAndPersist,
}));

import { GET, POST } from '@/app/api/institution/wecom-official-dry-run-snapshot/route';

const context = { source: 'demo_session', userId: 'admin-1', role: 'tenant_admin', scope: 'tenant', tenantId: 'tenant-1', institutionId: 'institution-1' };
const body = {
  officialRoute: 'official_wecom_self_built',
  proofInstitutionRef: 'institution-placeholder-1',
  callbackPlaceholderRef: 'callback-placeholder-example-test',
  hasTestWeComEnvironment: true,
  hasSecretKeeperConfirmed: true,
  confirmation: '我确认仅保存低敏 dry-run 评估快照且不启用真实发送',
};
const snapshot = {
  id: 'snapshot-1', tenantId: 'tenant-1', institutionId: 'institution-1', channelType: 'wechat_work',
  officialRoute: 'official_wecom_self_built', proofInstitutionRef: 'institution-placeholder-1',
  callbackPlaceholderRef: 'callback-placeholder-example-test', configStatus: 'dry_run_ready',
  preflightStatus: 'mock_ready', proofEligibleMock: true, evaluatedBy: 'admin-1',
  evaluatedAt: '2026-07-11T00:00:00.000Z', allowRealSend: false, externalChannelEnabled: false,
  realSendAllowed: false, dryRunOnly: true, version: 1,
};

function request(method: 'GET' | 'POST', value: unknown = body, headers?: HeadersInit) {
  return new Request('http://localhost/api/institution/wecom-official-dry-run-snapshot', {
    method, headers: { 'content-type': 'application/json', ...headers },
    body: method === 'POST' ? JSON.stringify(value) : undefined,
  });
}

describe('企业微信 dry-run 快照 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getContext.mockReturnValue(context);
    mocks.getDatabase.mockReturnValue({});
    mocks.createRepository.mockReturnValue({ findDryRunSnapshot: vi.fn().mockResolvedValue(snapshot) });
    mocks.runTransaction.mockImplementation(async (_db, operation) => operation({ transaction: true }));
    mocks.evaluateAndPersist.mockResolvedValue({ config: { configStatus: 'dry_run_ready' }, snapshot });
  });

  it('401/403 在读取 body 前阻断，operator 只能 GET', async () => {
    mocks.getContext.mockReturnValueOnce(null);
    expect((await GET(request('GET'))).status).toBe(401);
    mocks.getContext.mockReturnValue({ ...context, role: 'tenant_operator' });
    expect((await GET(request('GET'))).status).toBe(200);
    const denied = request('POST');
    const text = vi.spyOn(denied, 'text');
    expect((await POST(denied)).status).toBe(403);
    expect(text).not.toHaveBeenCalled();
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it('拒绝客户端伪造 ready、preflight、安全状态、上下文和发送字段', async () => {
    for (const extra of [
      { configStatus: 'dry_run_ready' }, { dryRunReady: true }, { usable: true },
      { preflightStatus: 'mock_ready' }, { proofEligibleMock: true }, { hasManualConfirmation: true },
      { hasCallbackDomainPlaceholder: true }, { allowRealSend: true }, { externalChannelEnabled: true },
      { realSendAllowed: true }, { dryRunOnly: false }, { operatorRole: 'tenant_admin' },
      { institutionId: 'institution-1' }, { tenantId: 'tenant-1' }, { safetySwitchSummary: 'ready' },
      { consent: true }, { optOut: false }, { frequencyCapPassed: true },
      { corpId: 'corp-real' }, { token: 'token-real' }, { UserID: 'user-real' }, { agentId: 'agent-real' },
    ]) {
      expect((await POST(request('POST', { ...body, ...extra }))).status).toBe(400);
    }
    expect(mocks.evaluateAndPersist).not.toHaveBeenCalled();
  });

  it('只将低敏输入交给服务端 evaluator 并强制返回关闭发送边界', async () => {
    const response = await POST(request('POST'));
    expect(response.status).toBe(200);
    expect(mocks.evaluateAndPersist).toHaveBeenCalledWith(expect.objectContaining({
      officialRoute: 'official_wecom_self_built', hasTestWeComEnvironment: true,
      hasSecretKeeperConfirmed: true,
      repositories: { transaction: true },
    }));
    const payload = await response.json();
    expect(payload.boundary).toEqual(expect.objectContaining({
      dryRunOnly: true, allowRealSend: false, externalChannelEnabled: false, realSendAllowed: false,
    }));
    expect(JSON.stringify(payload.snapshot)).not.toMatch(/token|corpId|UserID|agentId|rawPayload|tenantId|institutionId|evaluatedBy|version/i);
  });

  it('合法请求不向服务传递客户端可控 preflight 或 ready 状态', async () => {
    await POST(request('POST'));
    const input = mocks.evaluateAndPersist.mock.calls[0][0];
    expect(input).not.toHaveProperty('preflightStatus');
    expect(input).not.toHaveProperty('proofEligibleMock');
    expect(input).not.toHaveProperty('configStatus');
    expect(input).not.toHaveProperty('dryRunReady');
  });

  it('stale ready 请求的响应和 usable 基于数据库最终保留的 blocked 快照', async () => {
    mocks.evaluateAndPersist.mockResolvedValue({
      config: { configStatus: 'dry_run_ready' },
      snapshot: {
        ...snapshot,
        configStatus: 'blocked_missing_callback_url',
        preflightStatus: 'blocked_route_unverified',
        proofEligibleMock: false,
        evaluatedAt: '2026-07-11T02:00:00.000Z',
        version: 2,
      },
    });
    const response = await POST(request('POST'));
    const payload = await response.json();
    expect(payload.usable).toBe(false);
    expect(payload.snapshot).toEqual(expect.objectContaining({
      configStatus: 'blocked_missing_callback_url',
      preflightStatus: 'blocked_route_unverified',
      proofEligibleMock: false,
    }));
  });

  it.each([
    'official_wecom_third_party',
    'official_wecom_service_provider',
    'account_custody',
  ])('V0.8 请求白名单拒绝非 self-built 路线：%s', async (officialRoute) => {
    const response = await POST(request('POST', { ...body, officialRoute }));
    expect(response.status).toBe(400);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it('audit/事务失败不返回成功', async () => {
    mocks.runTransaction.mockRejectedValue(new Error('audit unavailable'));
    expect((await POST(request('POST'))).status).toBe(503);
  });

  it('执行 UTF-8 字节限制且服务端 fetch=0', async () => {
    expect((await POST(request('POST', body, { 'content-length': '1025' }))).status).toBe(413);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await GET(request('GET'));
    await POST(request('POST'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
