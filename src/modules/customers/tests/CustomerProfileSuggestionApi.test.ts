import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), generate: vi.fn(), decide: vi.fn() }));
vi.mock('@/server/orchestration/institution-customer-profile-runtime', () => ({ readCurrentInstitutionCustomerProfile: mocks.read, generateCurrentInstitutionCustomerProfile: mocks.generate, decideCurrentInstitutionCustomerProfile: mocks.decide }));
import { GET, POST, PATCH } from '@/app/api/v1/institution/customers/[customerId]/profile-suggestions/route';
import { readHumanDecisionBody } from '@/server/http/institution-human-decision-route';
const context = { params: Promise.resolve({ customerId: 'customer-a' }) };
beforeEach(() => { vi.resetAllMocks(); mocks.read.mockResolvedValue({ kind: 'ready', records: [] }); mocks.generate.mockResolvedValue({ kind: 'ready' }); mocks.decide.mockResolvedValue({ kind: 'ready' }); });
describe('画像建议 API', () => {
  it.each([['ready', 200], ['invalid', 400], ['forbidden', 403], ['not_found', 404], ['conflict', 409], ['unavailable', 503]])('%s 使用正确状态并禁止缓存', async (kind, status) => {
    mocks.read.mockResolvedValue({ kind }); const response = await GET(new Request('http://localhost/api?sourcePage=2'), context);
    expect(response.status).toBe(status); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.read.mock.calls[0][1].get('sourcePage')).toBe('2');
  });
  it('生成与决定分别传入可信路径客户及限定请求体', async () => {
    await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ appointmentId: 'a' }) }), context);
    expect(mocks.generate).toHaveBeenCalledWith('customer-a', { appointmentId: 'a' });
    await PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ suggestionId: 's', command: 'reject', expectedRevision: 1 }) }), context);
    expect(mocks.decide).toHaveBeenCalledWith('customer-a', 's', { command: 'reject', expectedRevision: 1 });
  });
  it('损坏、超长及附加查询的写请求失败关闭', async () => {
    for (const request of [new Request('http://localhost', { method: 'POST', body: '{' }), new Request('http://localhost', { method: 'POST', body: 'x'.repeat(4097) }), new Request('http://localhost?tenantId=forged', { method: 'POST', body: '{}' })]) expect(await readHumanDecisionBody(request)).toBeNull();
    const response = await PATCH(new Request('http://localhost', { method: 'PATCH', body: '{}' }), context); expect(response.status).toBe(400); expect(mocks.decide).not.toHaveBeenCalled();
  });
});
