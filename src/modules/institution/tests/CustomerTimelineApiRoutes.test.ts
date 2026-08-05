import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  authorizations: new WeakSet<object>(),
  sectionAllows: new WeakSet<object>(),
  objectAllows: new WeakSet<object>(),
  createAuditEventRepository: vi.fn(),
  createTenantBusinessRepository: vi.fn(),
  createTreatmentSummaryRepository: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/institution/server/institution-server-runtime', () => ({
  resolveInstitutionServerAuthorizationV1: mocks.resolveAuthorization,
}));
vi.mock('@/modules/security/server/institution-request-authorization', () => ({
  isInstitutionRequestAuthorizationV1(value: unknown) {
    return value !== null && typeof value === 'object' &&
      mocks.authorizations.has(value);
  },
}));
vi.mock('@/modules/security/server/institution-section-guard', () => ({
  isInstitutionSectionAllowV1(value: unknown) {
    return value !== null && typeof value === 'object' &&
      mocks.sectionAllows.has(value);
  },
}));
vi.mock('@/modules/security/server/institution-object-guard', () => ({
  isInstitutionObjectActionAllowV1(value: unknown) {
    return value !== null && typeof value === 'object' &&
      mocks.objectAllows.has(value);
  },
}));
vi.mock('@/server/db/client', () => ({ getDatabase: mocks.getDatabase }));
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: mocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/modules/institution/server/tenant-business-repository', () => ({
  createTenantBusinessRepository: mocks.createTenantBusinessRepository,
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: mocks.createAuditEventRepository,
}));
vi.mock('@/modules/institution/server/treatment-summary-repository', () => ({
  createTreatmentSummaryRepository: mocks.createTreatmentSummaryRepository,
}));

import { GET as customerTimelineGet } from '@/app/api/institution/customers/[customerId]/timeline/route';
import { getCustomerTimeline } from '@/modules/institution/client/tenant-business-client';

const disabledPayload = {
  code: 'customer_timeline_capability_disabled',
  error: '客户完整时间线能力暂未启用',
};

function context(customerId = 'customer-safe-001') {
  return { params: Promise.resolve({ customerId }) };
}

function sectionAllow() {
  const value = Object.freeze({
    kind: 'institution_section_allow' as const,
    sectionId: 'customers' as const,
  });
  mocks.sectionAllows.add(value);
  return value;
}

function objectAllow() {
  const value = Object.freeze({
    kind: 'institution_object_action_allow' as const,
    objectType: 'customer' as const,
    action: 'read' as const,
    objectRevision: 1,
    decidedAt: '2026-08-06T00:00:00.000Z',
    validUntil: '2026-08-06T00:00:30.000Z',
  });
  mocks.objectAllows.add(value);
  return value;
}

function authorization(input: Readonly<{
  section?: (value: unknown) => Promise<unknown>;
  object?: (value: unknown) => Promise<unknown>;
}> = {}) {
  const value = Object.freeze({
    authorizeCurrentInstitutionSectionV1:
      input.section ?? vi.fn(async () => sectionAllow()),
    authorizeCurrentInstitutionObjectV1:
      input.object ?? vi.fn(async () => objectAllow()),
    authorizeCurrentInstitutionActionV1:
      vi.fn(async () => objectAllow()),
  });
  mocks.authorizations.add(value);
  return value;
}

function expectNoBusinessReads() {
  expect(mocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
  expect(mocks.getDatabase).not.toHaveBeenCalled();
  expect(mocks.createTenantBusinessRepository).not.toHaveBeenCalled();
  expect(mocks.createAuditEventRepository).not.toHaveBeenCalled();
  expect(mocks.createTreatmentSummaryRepository).not.toHaveBeenCalled();
}

async function expectForbidden(response: Response) {
  expect(response.status).toBe(403);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual({
    error: 'institution_route_forbidden',
    code: 'institution_object_forbidden',
  });
}

beforeEach(() => {
  mocks.resolveAuthorization.mockReset();
  mocks.createAuditEventRepository.mockReset();
  mocks.createTenantBusinessRepository.mockReset();
  mocks.createTreatmentSummaryRepository.mockReset();
  mocks.getDatabase.mockReset();
  mocks.getDemoAccessContextFromRequest.mockReset();
  mocks.authorizations = new WeakSet<object>();
  mocks.sectionAllows = new WeakSet<object>();
  mocks.objectAllows = new WeakSet<object>();
});

describe('客户完整 timeline Object Guard 最小接线', () => {
  it('Section 拒绝时不读取 Request 或 context', async () => {
    const requestTraps = { get: 0 };
    const contextTraps = { get: 0 };
    const request = new Proxy({}, {
      get() {
        requestTraps.get += 1;
        throw new Error('request must not be read');
      },
    }) as Request;
    const routeContext = new Proxy({}, {
      get() {
        contextTraps.get += 1;
        throw new Error('context must not be read');
      },
    });
    const section = vi.fn(async () => ({
      kind: 'rejected',
      code: 'scope_unavailable',
    }));
    mocks.resolveAuthorization.mockResolvedValueOnce(
      authorization({ section }),
    );

    await expectForbidden(
      await customerTimelineGet(request, routeContext as never),
    );
    expect(requestTraps.get).toBe(0);
    expect(contextTraps.get).toBe(0);
    expect(mocks.resolveAuthorization).toHaveBeenCalledTimes(1);
    expectNoBusinessReads();
  });

  it('非法 customerId 在第二次授权前失败', async () => {
    const section = vi.fn(async () => sectionAllow());
    mocks.resolveAuthorization.mockResolvedValueOnce(
      authorization({ section }),
    );
    await expectForbidden(
      await customerTimelineGet(
        new Request('http://localhost/example'),
        context('customer id with spaces'),
      ),
    );
    expect(mocks.resolveAuthorization).toHaveBeenCalledTimes(1);
    expectNoBusinessReads();
  });

  it('Object 拒绝统一映射为低敏 403', async () => {
    const section = vi.fn(async () => sectionAllow());
    const object = vi.fn(async () => ({
      kind: 'rejected',
      code: 'object_denied',
    }));
    mocks.resolveAuthorization
      .mockResolvedValueOnce(authorization({ section }))
      .mockResolvedValueOnce(authorization({ object }));

    await expectForbidden(
      await customerTimelineGet(
        new Request('http://localhost/example'),
        context(),
      ),
    );
    expect(object).toHaveBeenCalledWith({
      objectType: 'customer',
      objectId: 'customer-safe-001',
      action: 'read',
    });
    expect(mocks.resolveAuthorization).toHaveBeenCalledTimes(2);
    expectNoBusinessReads();
  });

  it('授权通过后仍保留原 no-store 503 Handler', async () => {
    const section = vi.fn(async () => sectionAllow());
    const object = vi.fn(async () => objectAllow());
    mocks.resolveAuthorization
      .mockResolvedValueOnce(authorization({ section }))
      .mockResolvedValueOnce(authorization({ object }));

    const response = await customerTimelineGet(
      new Request(
        'http://localhost/api/institution/customers/customer-safe-001/timeline?tenantId=other',
        { headers: { cookie: 'session=secret-cookie' } },
      ),
      context(),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(payload).toEqual(disabledPayload);
    expect(JSON.stringify(payload)).not.toMatch(
      /customer-safe-001|other|secret-cookie/i,
    );
    expect(section).toHaveBeenCalledWith({ sectionId: 'customers' });
    expect(object).toHaveBeenCalledWith({
      objectType: 'customer',
      objectId: 'customer-safe-001',
      action: 'read',
    });
    expect(mocks.resolveAuthorization).toHaveBeenCalledTimes(2);
    expectNoBusinessReads();
  });

  it('消费者仍保持 503 不可用错误', async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify(disabledPayload), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await expect(
      getCustomerTimeline('customer_safe_001', { fetcher }),
    ).resolves.toEqual({
      ok: false,
      error: {
        kind: 'service_unavailable',
        message: '客户完整时间线能力暂未启用',
        status: 503,
      },
    });
  });
});
