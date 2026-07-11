import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getContext: vi.fn(),
  getDatabase: vi.fn(),
  createCustomerRepository: vi.fn(),
  createSafetyRepository: vi.fn(),
  readSafety: vi.fn(),
  runTransaction: vi.fn(),
  recordConsent: vi.fn(),
}));

vi.mock('@/modules/security/server/access-context', () => ({ getDemoAccessContextFromRequest: mocks.getContext }));
vi.mock('@/server/db/client', () => ({ getDatabase: mocks.getDatabase }));
vi.mock('@/modules/institution/server/tenant-business-repository', () => ({ createTenantBusinessRepository: mocks.createCustomerRepository }));
vi.mock('@/modules/institution/server/trusted-reachout-safety-repository', () => ({ createTrustedReachOutSafetyRepository: mocks.createSafetyRepository }));
vi.mock('@/modules/institution/server/trusted-reachout-safety-service', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readWeComReachOutSafety: mocks.readSafety,
  recordWeComReachOutConsent: mocks.recordConsent,
}));
vi.mock('@/modules/institution/server/trusted-reachout-safety-transaction', () => ({ runTrustedReachOutSafetyTransaction: mocks.runTransaction }));

import { GET, POST } from '@/app/api/institution/customers/[customerId]/wecom-reachout-safety/route';

const context = { userId: 'admin-1', role: 'tenant_admin', scope: 'tenant', tenantId: 'tenant-1', institutionId: 'institution-1' };
const params = { params: Promise.resolve({ customerId: 'customer-1' }) };
const body = {
  action: 'record_consent',
  sourceType: 'customer_explicit_written',
  confirmation: '我确认客户已明确同意通过企业微信联系',
};

function request(method: 'GET' | 'POST', value: unknown = body, headers?: HeadersInit) {
  return new Request('http://localhost/api/institution/customers/customer-1/wecom-reachout-safety', {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: method === 'POST' ? JSON.stringify(value) : undefined,
  });
}

describe('客户企业微信触达安全 API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getContext.mockReturnValue(context);
    mocks.getDatabase.mockReturnValue({});
    mocks.createCustomerRepository.mockReturnValue({});
    mocks.createSafetyRepository.mockReturnValue({});
    mocks.runTransaction.mockImplementation(async (_db, operation) => operation({ transaction: true }));
    mocks.readSafety.mockResolvedValue({ kind: 'found', safety: { consent: { status: 'unknown', sourceType: null, recordedAt: null }, frequency: { preparedCount: 0 } } });
    mocks.recordConsent.mockResolvedValue({ kind: 'updated', consent: { status: 'consented', sourceType: 'customer_explicit_written', recordedAt: '2026-07-11T00:00:00.000Z' } });
  });

  it('未登录返回 401，operator POST 返回 403 且不读 body', async () => {
    mocks.getContext.mockReturnValueOnce(null);
    expect((await GET(request('GET'), params)).status).toBe(401);

    mocks.getContext.mockReturnValue({ ...context, role: 'tenant_operator' });
    const denied = request('POST');
    const text = vi.spyOn(denied, 'text');
    expect((await POST(denied, params)).status).toBe(403);
    expect(text).not.toHaveBeenCalled();
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it('GET 返回无记录等同 unknown，并跨机构统一 not_found', async () => {
    const response = await GET(request('GET'), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.objectContaining({
      channelType: 'wechat_work',
      safety: expect.objectContaining({ consent: expect.objectContaining({ status: 'unknown' }) }),
    }));

    mocks.readSafety.mockResolvedValue({ kind: 'customer_not_found' });
    const missing = await GET(request('GET'), params);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ code: 'customer_not_found', error: '客户不存在或不属于当前机构' });
  });

  it('严格拒绝额外字段、status/evidenceRef 和 UTF-8 超限', async () => {
    for (const extra of [
      { status: 'consented' }, { status: 'unknown' }, { evidenceRef: 'manual' },
      { optOut: false }, { clearOptOut: true }, { tenantId: 'other' },
    ]) {
      expect((await POST(request('POST', { ...body, ...extra }), params)).status).toBe(400);
    }
    expect((await POST(request('POST', body, { 'content-length': '513' }), params)).status).toBe(413);
    expect((await POST(request('POST', { ...body, confirmation: '同意'.repeat(300) }), params)).status).toBe(413);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it('action 与 sourceType 不匹配时在事务前拒绝', async () => {
    const response = await POST(request('POST', {
      ...body,
      sourceType: 'customer_opt_out_request',
    }), params);
    expect(response.status).toBe(400);
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it('audit/事务失败不返回成功', async () => {
    mocks.runTransaction.mockRejectedValue(new Error('audit unavailable'));
    expect((await POST(request('POST'), params)).status).toBe(503);
  });

  it('精确动作进入同一事务且 API 不接受 evidenceRef', async () => {
    const response = await POST(request('POST'), params);
    expect(response.status).toBe(200);
    expect(mocks.runTransaction).toHaveBeenCalledTimes(1);
    expect(mocks.recordConsent).toHaveBeenCalledWith(expect.objectContaining({
      action: 'record_consent', sourceType: 'customer_explicit_written', repositories: { transaction: true },
    }));
    expect(JSON.stringify(await response.json())).not.toMatch(/evidenceRef|tenantId|institutionId/i);
  });

  it('不调用服务端 fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await GET(request('GET'), params);
    await POST(request('POST'), params);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
