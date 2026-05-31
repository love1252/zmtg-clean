import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as tenantRoute from '@/app/api/open-platform/tenants/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const tenantManagementRepository = {
    listTenantManagementRecords: vi.fn(),
  };
  const database = { database: 'test-db' };

  return {
    createTenantManagementRepository: vi.fn(() => tenantManagementRepository),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    tenantManagementRepository,
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

vi.mock('@/modules/open-platform/server/tenant-management-repository', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/modules/open-platform/server/tenant-management-repository')>();
  return {
    ...actual,
    createTenantManagementRepository: routeMocks.createTenantManagementRepository,
  };
});

const platformAdminContext: AccessContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const platformOperatorContext: AccessContext = {
  userId: 'demo-user-platform-operator',
  role: 'platform_operator',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const tenantAdminContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const tenantManagementRecord = {
  tenantId: 'demo-tenant-001',
  tenantName: '智美天工演示机构',
  tenantStatus: 'active',
  createdAt: '2026-05-30T00:00:00.000Z',
  updatedAt: '2026-05-31T00:00:00.000Z',
  planName: '成长版',
  planCode: 'growth-care',
  planStatus: 'active',
  assignmentStatus: 'active',
  startedAt: '2026-05-31T00:00:00.000Z',
  expiresAt: null,
  maxCustomers: 5000,
  maxAppointments: 2000,
  maxFollowUps: 10000,
  maxAiCalls: 50000,
  currentCustomers: 24,
  currentAppointments: 12,
  currentFollowUps: 36,
  currentAiCalls: 0,
  snapshotAt: '2026-05-31T08:00:00.000Z',
  customers: [{ phoneNumber: '13800000000' }],
  appointments: [{ customerId: 'cust_001' }],
  followUpTasks: [{ customerId: 'cust_001' }],
  treatmentRecord: '完整治疗记录正文',
  consultationTranscript: '咨询对话全文',
  medicalRecordNo: 'MR-RAW-001',
  idNumber: '110101199001010011',
  sql: 'select * from customers',
  stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_should_not_return',
  secret: 'raw-secret',
};

function tenantRequest(init?: RequestInit) {
  return new Request('http://localhost/api/open-platform/tenants', init);
}

function expectNoSensitiveTenantPayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain('customers');
  expect(serialized).not.toContain('appointments');
  expect(serialized).not.toContain('followUpTasks');
  expect(serialized).not.toContain('phoneNumber');
  expect(serialized).not.toContain('13800000000');
  expect(serialized).not.toContain('idNumber');
  expect(serialized).not.toContain('110101199001010011');
  expect(serialized).not.toContain('medicalRecordNo');
  expect(serialized).not.toContain('MR-RAW-001');
  expect(serialized).not.toContain('treatmentRecord');
  expect(serialized).not.toContain('完整治疗记录正文');
  expect(serialized).not.toContain('consultationTranscript');
  expect(serialized).not.toContain('咨询对话全文');
  expect(serialized).not.toContain('select * from customers');
  expect(serialized).not.toContain('DATABASE_URL');
  expect(serialized).not.toContain('postgres://');
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('token');
  expect(serialized).not.toContain('secret');
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.createTenantManagementRepository.mockClear();
  routeMocks.tenantManagementRepository.listTenantManagementRecords.mockReset();
  routeMocks.tenantManagementRepository.listTenantManagementRecords.mockResolvedValue([
    tenantManagementRecord,
  ]);
});

describe('平台端租户管理只读 API', () => {
  it('platform_admin 可读取租户基础信息、套餐和配额快照安全 DTO', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);

    const response = await tenantRoute.GET(tenantRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.createTenantManagementRepository).toHaveBeenCalledWith(routeMocks.database);
    expect(routeMocks.tenantManagementRepository.listTenantManagementRecords).toHaveBeenCalledWith();
    expect(payload).toEqual({
      records: [
        {
          tenantId: 'demo-tenant-001',
          tenantName: '智美天工演示机构',
          tenantStatus: 'active',
          createdAt: '2026-05-30T00:00:00.000Z',
          updatedAt: '2026-05-31T00:00:00.000Z',
          planName: '成长版',
          planCode: 'growth-care',
          planStatus: 'active',
          assignmentStatus: 'active',
          startedAt: '2026-05-31T00:00:00.000Z',
          expiresAt: null,
          maxCustomers: 5000,
          maxAppointments: 2000,
          maxFollowUps: 10000,
          maxAiCalls: 50000,
          currentCustomers: 24,
          currentAppointments: 12,
          currentFollowUps: 36,
          currentAiCalls: 0,
          snapshotAt: '2026-05-31T08:00:00.000Z',
        },
      ],
    });
    expectNoSensitiveTenantPayload(payload);
  });

  it('无套餐和无配额快照租户能稳定返回 null 字段', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    routeMocks.tenantManagementRepository.listTenantManagementRecords.mockResolvedValue([
      {
        tenantId: 'demo-tenant-003',
        tenantName: '未分配套餐机构',
        tenantStatus: 'suspended',
        createdAt: '2026-05-30T00:00:00.000Z',
        updatedAt: '2026-05-31T00:00:00.000Z',
        planName: null,
        planCode: null,
        planStatus: null,
        assignmentStatus: null,
        startedAt: null,
        expiresAt: null,
        maxCustomers: null,
        maxAppointments: null,
        maxFollowUps: null,
        maxAiCalls: null,
        currentCustomers: null,
        currentAppointments: null,
        currentFollowUps: null,
        currentAiCalls: null,
        snapshotAt: null,
      },
    ]);

    const response = await tenantRoute.GET(tenantRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.records).toEqual([
      {
        tenantId: 'demo-tenant-003',
        tenantName: '未分配套餐机构',
        tenantStatus: 'suspended',
        createdAt: '2026-05-30T00:00:00.000Z',
        updatedAt: '2026-05-31T00:00:00.000Z',
        planName: null,
        planCode: null,
        planStatus: null,
        assignmentStatus: null,
        startedAt: null,
        expiresAt: null,
        maxCustomers: null,
        maxAppointments: null,
        maxFollowUps: null,
        maxAiCalls: null,
        currentCustomers: null,
        currentAppointments: null,
        currentFollowUps: null,
        currentAiCalls: null,
        snapshotAt: null,
      },
    ]);
  });

  it('未登录返回 401 且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const response = await tenantRoute.GET(tenantRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it.each([
    ['platform_operator', platformOperatorContext],
    ['tenant_admin', tenantAdminContext],
  ])('%s 访问平台租户 API 返回 403 且不初始化数据库', async (_role, context) => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(context);

    const response = await tenantRoute.GET(tenantRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('数据服务不可用返回稳定 503 且不泄露错误详情', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const response = await tenantRoute.GET(tenantRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expectNoSensitiveTenantPayload(payload);
  });

  it('只暴露 GET，不提供写入、冻结恢复或套餐 enforcement 入口', () => {
    expect('GET' in tenantRoute).toBe(true);
    expect('POST' in tenantRoute).toBe(false);
    expect('PUT' in tenantRoute).toBe(false);
    expect('PATCH' in tenantRoute).toBe(false);
    expect('DELETE' in tenantRoute).toBe(false);
    expect(Object.keys(tenantRoute)).not.toEqual(
      expect.arrayContaining([
        'createTenant',
        'updateTenant',
        'deleteTenant',
        'freezeTenant',
        'restoreTenant',
        'enforceTenantPlan',
        'enforceTenantQuota',
      ]),
    );
  });
});
