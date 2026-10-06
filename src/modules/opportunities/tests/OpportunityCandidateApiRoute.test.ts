import { beforeEach, describe, expect, it, vi } from 'vitest';
const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/server/orchestration/institution-opportunity-reader', () => ({ readCurrentInstitutionOpportunitiesV1: read }));
import { GET } from '@/app/api/v1/institution/opportunities/route';
beforeEach(() => read.mockReset());
describe('机会只读接口', () => {
  it('GET委派筛选，返回服务端分页且禁止缓存', async () => {
    const result = { kind: 'ready', records: [], pageInfo: { total: 0 } };
    read.mockResolvedValue(result);
    const response = await GET(new Request('http://localhost/api/v1/institution/opportunities?type=revisit&page=2'));
    expect(response.status).toBe(200); expect(await response.json()).toEqual(result);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(read.mock.calls[0][0].toString()).toBe('type=revisit&page=2');
  });
  it.each([['invalid_query', 400], ['forbidden', 403], ['unavailable', 503]] as const)('%s映射为%s且不带异常信息', async (kind, status) => {
    read.mockResolvedValue({ kind, secret: 'private-error' });
    const response = await GET(new Request('http://localhost/api/v1/institution/opportunities'));
    expect(response.status).toBe(status); expect(await response.json()).toEqual({ code: 'institution_opportunities_' + kind });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
