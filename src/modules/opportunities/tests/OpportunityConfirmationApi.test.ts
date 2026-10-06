import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), confirm: vi.fn() }));
vi.mock('@/server/orchestration/institution-opportunity-confirmation-runtime', () => ({ readCurrentInstitutionOpportunityConfirmations: mocks.read, confirmCurrentInstitutionOpportunity: mocks.confirm }));
import { GET, POST } from '@/app/api/v1/institution/opportunities/confirmations/route';
beforeEach(() => { vi.resetAllMocks(); mocks.confirm.mockResolvedValue({ kind: 'invalid' }); });
describe('机会确认API', () => {
  it.each([['ready', 200], ['invalid', 400], ['forbidden', 403], ['not_found', 404], ['conflict', 409], ['unavailable', 503]])('%s状态和禁止缓存', async (kind, status) => {
    mocks.read.mockResolvedValue({ kind }); const response = await GET(new Request('http://localhost?customerId=c'));
    expect(response.status).toBe(status); expect(response.headers.get('cache-control')).toBe('no-store'); expect(mocks.read.mock.calls[0][0].get('customerId')).toBe('c');
  });
  it('写入使用受限请求体，损坏JSON及附加查询不透传', async () => {
    for (const request of [new Request('http://localhost', { method: 'POST', body: '{' }), new Request('http://localhost?tenantId=forged', { method: 'POST', body: '{}' }), new Request('http://localhost', { method: 'POST', body: 'x'.repeat(4097) })]) { expect((await POST(request)).status).toBe(400); expect(mocks.confirm).toHaveBeenLastCalledWith(null); }
    await POST(new Request('http://localhost', { method: 'POST', body: '{"customerId":"c"}' })); expect(mocks.confirm).toHaveBeenLastCalledWith({ customerId: 'c' });
  });
});
