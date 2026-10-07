import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ authorization: vi.fn(), read: vi.fn(), section: vi.fn(), object: vi.fn(), genuine: new WeakSet<object>() }));
vi.mock('@/modules/institution/server/institution-server-runtime', () => ({ resolveInstitutionServerAuthorizationV1: mocks.authorization }));
vi.mock('@/modules/security/server/institution-request-authorization', () => ({ isInstitutionRequestAuthorizationV1: (value: object) => mocks.genuine.has(value) }));
vi.mock('@/modules/security/server/institution-section-guard', () => ({ isInstitutionSectionAllowV1: (value: object) => mocks.genuine.has(value) }));
vi.mock('@/modules/security/server/institution-object-guard', () => ({ isInstitutionObjectActionAllowV1: (value: object) => mocks.genuine.has(value) }));
vi.mock('@/server/orchestration/institution-formal-follow-up-runtime', () => ({ readCurrentInstitutionCustomerFormalFollowUpsV1: mocks.read }));
import * as route from '@/app/api/v1/institution/customers/[customerId]/followups/route';
const trusted = <T extends object>(value: T): T => { mocks.genuine.add(value); return value; };
const context = { params: Promise.resolve({ customerId: 'customer-a' }) };
const request = () => new Request('https://test.local/api/v1/institution/customers/customer-a/followups?page=6&pageSize=20');
beforeEach(() => {
  vi.clearAllMocks();
  mocks.genuine = new WeakSet();
  mocks.section.mockResolvedValue(trusted({ sectionId: 'customers' }));
  mocks.object.mockResolvedValue(trusted({ objectType: 'customer', action: 'read' }));
  mocks.authorization.mockResolvedValue(trusted({ authorizeCurrentInstitutionSectionV1: mocks.section, authorizeCurrentInstitutionObjectV1: mocks.object }));
  mocks.read.mockResolvedValue({ kind: 'ready', customerId: 'customer-a', records: [] });
});
describe('客户正式随访 GET 对象授权', () => {
  it('先检查 customers/customer/read，再转发路径客户及分页参数', async () => {
    const response = await route.GET(request(), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.object).toHaveBeenCalledWith({ objectType: 'customer', objectId: 'customer-a', action: 'read' });
    expect(mocks.read).toHaveBeenCalledWith('customer-a', new URLSearchParams('page=6&pageSize=20'));
    expect(Object.keys(route)).toEqual(['GET']);
  });
  it.each(['session', 'section', 'object'])('拒绝 %s 时不读业务数据', async boundary => {
    if (boundary === 'session') mocks.authorization.mockResolvedValue(null);
    if (boundary === 'section') mocks.section.mockResolvedValue({ sectionId: 'customers' });
    if (boundary === 'object') mocks.object.mockResolvedValue({ objectType: 'customer', action: 'read' });
    expect((await route.GET(request(), context)).status).toBe(403);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each([['forbidden', 403], ['not_found', 404], ['unavailable', 503], ['invalid_query', 400]] as const)('安全映射 %s', async (kind, status) => {
    mocks.read.mockResolvedValue({ kind });
    const response = await route.GET(request(), context);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ code: `customer_followups_${kind}` });
  });
});
