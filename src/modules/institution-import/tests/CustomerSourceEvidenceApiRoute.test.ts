import { beforeEach, describe, expect, it, vi } from 'vitest';

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/server/orchestration/institution-excel-import-runtime', () => ({ readCurrentInstitutionCustomerSourceEvidenceV1: read }));
import { GET } from '@/app/api/v1/institution/customers/[customerId]/source-evidence/route';

const context = { params: Promise.resolve({ customerId: 'customer-1' }) };
const request = (query = '') => new Request('http://localhost/api/v1/institution/customers/customer-1/source-evidence' + query);
beforeEach(() => read.mockReset());

describe('客户来源只读路由', () => {
  it('GET委派真实客户标识并禁止缓存', async () => {
    const result = { kind: 'ready', customerId: 'customer-1', evidence: { status: 'not_recorded', importRecord: null } };
    read.mockResolvedValue(result);
    const response = await GET(request(), context);
    expect(response.status).toBe(200); expect(await response.json()).toEqual(result);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(read).toHaveBeenCalledWith('customer-1');
  });
  it.each(['?tenantId=other', '?page=1', '?x=', '?x=1&x=2'])('拒绝查询参数%s', async query => {
    const response = await GET(request(query), context);
    expect(response.status).toBe(400); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(read).not.toHaveBeenCalled();
  });
  it.each([['forbidden', 403], ['not_found', 404], ['unavailable', 503]] as const)('映射%s且丢弃异常载荷', async (kind, status) => {
    read.mockResolvedValue({ kind, code: 'customer_source_' + kind, message: 'private-error', protectedPayload: 'private' });
    const response = await GET(request(), context);
    expect(response.status).toBe(status); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ code: 'customer_source_' + kind });
  });
});
