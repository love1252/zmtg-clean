import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  genuineAuthorizations: new WeakSet<object>(),
  genuineSectionAllows: new WeakSet<object>(),
  genuineObjectAllows: new WeakSet<object>(),
  auditRecord: vi.fn(),
  canAccessResource: vi.fn(),
  createAuditEventRepository: vi.fn(),
  createTenantBusinessRepository: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  listCustomerFollowUpTimelineEvents: vi.fn(),
}));

vi.mock('@/modules/institution/server/institution-server-runtime', () => ({
  resolveInstitutionServerAuthorizationV1: routeMocks.resolveAuthorization,
}));
vi.mock('@/modules/security/server/institution-request-authorization', () => ({
  isInstitutionRequestAuthorizationV1(value: unknown) {
    return value !== null && typeof value === 'object' && routeMocks.genuineAuthorizations.has(value);
  },
}));
vi.mock('@/modules/security/server/institution-section-guard', () => ({
  isInstitutionSectionAllowV1(value: unknown) {
    return value !== null && typeof value === 'object' && routeMocks.genuineSectionAllows.has(value);
  },
}));
vi.mock('@/modules/security/server/institution-object-guard', () => ({
  isInstitutionObjectActionAllowV1(value: unknown) {
    return value !== null && typeof value === 'object' && routeMocks.genuineObjectAllows.has(value);
  },
}));
vi.mock('@/server/db/client', () => ({ getDatabase: routeMocks.getDatabase }));
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/modules/security/domain/access-control', () => ({
  canAccessResource: routeMocks.canAccessResource,
}));
vi.mock('@/modules/institution/server/tenant-business-repository', () => ({
  createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
}));
vi.mock('@/modules/institution/server/followup-customer-timeline-service', () => ({
  listCustomerFollowUpTimelineEvents: routeMocks.listCustomerFollowUpTimelineEvents,
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));

import { GET as customerFollowUpTimelineGet } from '@/app/api/institution/customers/[customerId]/followup-timeline/route';
import { listCustomerFollowUpTimelineEvents } from '@/modules/institution/client/tenant-business-client';

const disabledPayload = {
  code: 'customer_followup_timeline_capability_disabled',
  error: '客户随访时间线能力暂未启用',
};
function routeContext(customerId = 'customer_safe_001') {
  return { params: Promise.resolve({ customerId }) };
}
function genuineSectionAllow() {
  const allow = Object.freeze({ kind: 'institution_section_allow' as const, sectionId: 'customers' as const });
  routeMocks.genuineSectionAllows.add(allow);
  return allow;
}
function genuineObjectAllow() {
  const allow = Object.freeze({
    kind: 'institution_object_action_allow' as const,
    objectType: 'customer' as const,
    action: 'read' as const,
    objectRevision: 1,
    decidedAt: '2026-08-06T00:00:00.000Z',
    validUntil: '2026-08-06T00:00:30.000Z',
  });
  routeMocks.genuineObjectAllows.add(allow);
  return allow;
}
function genuineAuthorization(input: Readonly<{
  section?: (value: unknown) => Promise<unknown>;
  object?: (value: unknown) => Promise<unknown>;
}> = {}) {
  const authorization = Object.freeze({
    authorizeCurrentInstitutionSectionV1: input.section ?? vi.fn(async () => genuineSectionAllow()),
    authorizeCurrentInstitutionObjectV1: input.object ?? vi.fn(async () => genuineObjectAllow()),
    authorizeCurrentInstitutionActionV1: vi.fn(async () => genuineObjectAllow()),
  });
  routeMocks.genuineAuthorizations.add(authorization);
  return authorization;
}
function expectNoBusinessSideEffects() {
  expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
  expect(routeMocks.canAccessResource).not.toHaveBeenCalled();
  expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
  expect(routeMocks.listCustomerFollowUpTimelineEvents).not.toHaveBeenCalled();
  expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
  expect(routeMocks.auditRecord).not.toHaveBeenCalled();
}
async function expectObjectForbidden(response: Response) {
  expect(response.status).toBe(403);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual({
    error: 'institution_route_forbidden',
    code: 'institution_object_forbidden',
  });
}

beforeEach(() => {
  for (const value of Object.values(routeMocks)) {
    if (typeof value === 'function' && 'mockReset' in value) value.mockReset();
  }
  routeMocks.genuineAuthorizations = new WeakSet<object>();
  routeMocks.genuineSectionAllows = new WeakSet<object>();
  routeMocks.genuineObjectAllows = new WeakSet<object>();
});

describe('客户随访时间线 Object Guard 最小接线', () => {
  it('Section 拒绝前不读取 Request 或 context', async () => {
    const requestTraps = { get: 0, ownKeys: 0, descriptor: 0 };
    const contextTraps = { get: 0, ownKeys: 0, descriptor: 0 };
    const hostileRequest = new Proxy({}, {
      get() { requestTraps.get += 1; throw new Error('request must not be read'); },
      ownKeys() { requestTraps.ownKeys += 1; throw new Error('request must not be enumerated'); },
      getOwnPropertyDescriptor() { requestTraps.descriptor += 1; throw new Error('request must not be described'); },
    }) as Request;
    const hostileContext = new Proxy({}, {
      get() { contextTraps.get += 1; throw new Error('context must not be read'); },
      ownKeys() { contextTraps.ownKeys += 1; throw new Error('context must not be enumerated'); },
      getOwnPropertyDescriptor() { contextTraps.descriptor += 1; throw new Error('context must not be described'); },
    });
    const section = vi.fn(async () => ({ kind: 'rejected', code: 'scope_unavailable' }));
    routeMocks.resolveAuthorization.mockResolvedValueOnce(genuineAuthorization({ section }));
    await expectObjectForbidden(await customerFollowUpTimelineGet(hostileRequest, hostileContext as never));
    expect(section).toHaveBeenCalledWith({ sectionId: 'customers' });
    expect(requestTraps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
    expect(contextTraps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
    expect(routeMocks.resolveAuthorization).toHaveBeenCalledTimes(1);
    expectNoBusinessSideEffects();
  });

  it('非法 customerId 在第二次授权前失败关闭', async () => {
    routeMocks.resolveAuthorization.mockResolvedValueOnce(genuineAuthorization());
    await expectObjectForbidden(await customerFollowUpTimelineGet(
      new Request('http://localhost/example'), routeContext('customer id with spaces'),
    ));
    expect(routeMocks.resolveAuthorization).toHaveBeenCalledTimes(1);
    expectNoBusinessSideEffects();
  });

  it('Object 拒绝统一映射为低敏 no-store 403', async () => {
    const object = vi.fn(async () => ({ kind: 'rejected', code: 'object_denied' }));
    routeMocks.resolveAuthorization
      .mockResolvedValueOnce(genuineAuthorization())
      .mockResolvedValueOnce(genuineAuthorization({ object }));
    await expectObjectForbidden(await customerFollowUpTimelineGet(
      new Request('http://localhost/example'), routeContext(),
    ));
    expect(object).toHaveBeenCalledWith({
      objectType: 'customer', objectId: 'customer_safe_001', action: 'read',
    });
    expect(routeMocks.resolveAuthorization).toHaveBeenCalledTimes(2);
    expectNoBusinessSideEffects();
  });

  it('授权通过后仍保留原 capability-disabled 503 Handler', async () => {
    const object = vi.fn(async () => genuineObjectAllow());
    routeMocks.resolveAuthorization
      .mockResolvedValueOnce(genuineAuthorization())
      .mockResolvedValueOnce(genuineAuthorization({ object }));
    const request = new Request(
      'http://localhost/api/institution/customers/customer_safe_001/followup-timeline?tenantId=other-tenant&include=private',
      { headers: { cookie: 'session=secret-cookie' } },
    );
    const response = await customerFollowUpTimelineGet(request, routeContext());
    const payload = await response.json();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(payload).toEqual(disabledPayload);
    expect(JSON.stringify(payload)).not.toMatch(/other-tenant|private|secret-cookie|customer_safe_001/i);
    expect(object).toHaveBeenCalledWith({
      objectType: 'customer', objectId: 'customer_safe_001', action: 'read',
    });
    expect(routeMocks.resolveAuthorization).toHaveBeenCalledTimes(2);
    expectNoBusinessSideEffects();
  });

  it('Section 允许后 context 读取异常仍失败关闭', async () => {
    const hostileContext = new Proxy({}, { get() { throw new Error('context unavailable'); } });
    routeMocks.resolveAuthorization.mockResolvedValueOnce(genuineAuthorization());
    await expectObjectForbidden(await customerFollowUpTimelineGet(
      new Request('http://localhost/example'), hostileContext as never,
    ));
    expect(routeMocks.resolveAuthorization).toHaveBeenCalledTimes(1);
    expectNoBusinessSideEffects();
  });

  it('消费者仍将 503 保持为稳定不可用错误态', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(disabledPayload), {
      status: 503, headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
    await expect(listCustomerFollowUpTimelineEvents('customer_safe_001', { fetcher })).resolves.toEqual({
      ok: false,
      error: { kind: 'service_unavailable', message: '客户随访时间线能力暂未启用', status: 503 },
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/institution/customers/customer_safe_001/followup-timeline', { cache: 'no-store' },
    );
  });
});
