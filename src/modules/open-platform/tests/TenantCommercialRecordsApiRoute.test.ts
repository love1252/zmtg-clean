import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as commercialRecordsRoute from '@/app/api/v1/open-platform/tenants/[tenantId]/commercial-records/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const repository = {
    listTenantCommercialRecords: vi.fn(),
  };
  const database = { database: 'tenant-commercial-records-db' };

  return {
    createTenantCommercialRecordsRepository: vi.fn(() => repository),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    repository,
  };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return {
    ...actual,
    getDatabase: routeMocks.getDatabase,
  };
});

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/server/access-context')>();
  return {
    ...actual,
    getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
  };
});

vi.mock('@/modules/open-platform/server/tenant-commercial-records-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/open-platform/server/tenant-commercial-records-repository')>();
  return {
    ...actual,
    createTenantCommercialRecordsRepository: routeMocks.createTenantCommercialRecordsRepository,
  };
});

const platformAdminContext: AccessContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const tenantAdminContext: AccessContext = {
  userId: 'demo-user-tenant',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const commercialRecordDto = {
  recordId: 'commercial-record-order-001',
  tenantId: 'demo-tenant-001',
  recordType: 'order',
  recordTypeLabel: '订单',
  status: 'pending',
  statusLabel: '待人工确认',
  displayCode: 'ORD-2026-0001',
  displayAmount: '¥2999/月',
  periodLabel: '2026-06',
  relatedPlanChangeId: 'tenant-plan-change-demo-001',
  occurredAt: '2026-06-23T06:00:00.000Z',
  createdAt: '2026-06-23T06:00:00.000Z',
  updatedAt: '2026-06-23T06:10:00.000Z',
  note: 'payment_token=payment_token_should_not_return',
  webhook_secret: 'webhook_secret_should_not_return',
  contract_body: '完整合同正文',
};

function request() {
  return new Request(
    'http://localhost/api/v1/open-platform/tenants/demo-tenant-001/commercial-records',
    { method: 'GET' },
  );
}

function routeContext(tenantId = 'demo-tenant-001') {
  return { params: Promise.resolve({ tenantId }) };
}

function expectNoSensitivePayload(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /payment_token|webhook_secret|client_secret|api_key|contract_body|完整合同正文|DATABASE_URL|postgres:\/\//i,
  );
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.createTenantCommercialRecordsRepository.mockClear();
  routeMocks.repository.listTenantCommercialRecords.mockReset();
  routeMocks.repository.listTenantCommercialRecords.mockResolvedValue([commercialRecordDto]);
});

describe('租户商业化预留记录 API', () => {
  it('platform_admin 可读取订单、合同、发票、支付只读预留记录', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const response = await commercialRecordsRoute.GET(request(), routeContext());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.createTenantCommercialRecordsRepository).toHaveBeenCalledWith(
      routeMocks.database,
    );
    expect(routeMocks.repository.listTenantCommercialRecords).toHaveBeenCalledWith(
      'demo-tenant-001',
    );
    expect(payload).toEqual({
      ok: true,
      records: [
        {
          recordId: 'commercial-record-order-001',
          tenantId: 'demo-tenant-001',
          recordType: 'order',
          recordTypeLabel: '订单',
          status: 'pending',
          statusLabel: '待人工确认',
          displayCode: 'ORD-2026-0001',
          displayAmount: '¥2999/月',
          periodLabel: '2026-06',
          relatedPlanChangeId: 'tenant-plan-change-demo-001',
          occurredAt: '2026-06-23T06:00:00.000Z',
          createdAt: '2026-06-23T06:00:00.000Z',
          updatedAt: '2026-06-23T06:10:00.000Z',
        },
      ],
    });
    expectNoSensitivePayload(payload);
  });

  it('无登录态或非平台范围返回低敏错误且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const unauthorized = await commercialRecordsRoute.GET(request(), routeContext());
    expect(unauthorized.status).toBe(401);

    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantAdminContext);
    const forbidden = await commercialRecordsRoute.GET(request(), routeContext());
    expect(forbidden.status).toBe(403);

    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('repository 失败时返回低敏不可用错误', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    routeMocks.repository.listTenantCommercialRecords.mockRejectedValue(new Error('DATABASE_URL'));

    const response = await commercialRecordsRoute.GET(request(), routeContext());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ ok: false, errorCode: 'TENANT_COMMERCIAL_RECORDS_UNAVAILABLE' });
    expectNoSensitivePayload(payload);
  });
});
