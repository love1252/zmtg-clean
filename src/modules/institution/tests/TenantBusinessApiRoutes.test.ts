import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GET as appointmentsGet,
  PATCH as appointmentsPatch,
  POST as appointmentsPost,
} from '@/app/api/institution/appointments/route';
import {
  GET as customersGet,
  PATCH as customersPatch,
  POST as customersPost,
} from '@/app/api/institution/customers/route';
import {
  GET as followupsGet,
  PATCH as followupsPatch,
  POST as followupsPost,
} from '@/app/api/institution/followups/route';
import type { AccessContext } from '@/modules/security/domain/access-control';
import {
  handleTenantBusinessListRequest,
  handleTenantBusinessMutationRequest,
} from '@/modules/institution/server/tenant-business-api';

const customersRouteSource = readFileSync(
  resolve(process.cwd(), 'src/app/api/institution/customers/route.ts'),
  'utf8',
);

const customerCapabilityDisabledPayload = Object.freeze({ code: 'capability_disabled' });

const routeMocks = vi.hoisted(() => {
  const repository = {
    listCustomersByTenant: vi.fn(),
    listAppointmentsByTenant: vi.fn(),
    listFollowUpTasksByTenant: vi.fn(),
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    customerExistsByTenant: vi.fn(),
    createAppointment: vi.fn(),
    updateAppointment: vi.fn(),
    transitionFollowUpTask: vi.fn(),
    createManualFollowUpTask: vi.fn(),
  };
  const auditRecord = vi.fn();
  const checkTenantQuotaForCreate = vi.fn();
  const transactionDatabase = { database: 'transaction-db' };
  const database = {
    database: 'test-db',
    transaction: vi.fn(async (operation: (tx: typeof transactionDatabase) => unknown) =>
      operation(transactionDatabase),
    ),
  };

  return {
    auditRecord,
    checkTenantQuotaForCreate,
    createAuditEventRepository: vi.fn(() => ({ record: auditRecord })),
    createTenantBusinessRepository: vi.fn(() => repository),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    repository,
    transactionDatabase,
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

vi.mock('@/modules/institution/server/tenant-business-repository', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/tenant-business-repository')
  >();
  return {
    ...actual,
    createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
  };
});

vi.mock('@/modules/audit/server/audit-event-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/audit/server/audit-event-repository')>();
  return {
    ...actual,
    createAuditEventRepository: routeMocks.createAuditEventRepository,
  };
});

vi.mock('@/modules/institution/server/tenant-quota-enforcement', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/tenant-quota-enforcement')
  >();
  return {
    ...actual,
    checkTenantQuotaForCreate: routeMocks.checkTenantQuotaForCreate,
  };
});

const tenantContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  institutionId: 'demo-inst-001',
  source: 'demo_session',
};

const platformContext: AccessContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.database.transaction.mockReset();
  routeMocks.database.transaction.mockImplementation(async (operation) =>
    operation(routeMocks.transactionDatabase),
  );
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.checkTenantQuotaForCreate.mockReset();
  routeMocks.checkTenantQuotaForCreate.mockImplementation(
    async ({ resource }: { resource: 'customers' | 'appointments' }) => ({
      allowed: true,
      current: resource === 'customers' ? 24 : 12,
      limit: resource === 'customers' ? 5000 : 2000,
      resource,
    }),
  );
  routeMocks.createTenantBusinessRepository.mockClear();
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.auditRecord.mockReset();
  routeMocks.auditRecord.mockResolvedValue(undefined);
  routeMocks.repository.listCustomersByTenant.mockReset();
  routeMocks.repository.listCustomersByTenant.mockResolvedValue([
    { id: 'cust_001', tenantId: 'demo-tenant-001' },
  ]);
  routeMocks.repository.listAppointmentsByTenant.mockReset();
  routeMocks.repository.listAppointmentsByTenant.mockResolvedValue([
    { id: 'appt_001', tenantId: 'demo-tenant-001' },
  ]);
  routeMocks.repository.listFollowUpTasksByTenant.mockReset();
  routeMocks.repository.listFollowUpTasksByTenant.mockResolvedValue([
    { id: 'fu_001', tenantId: 'demo-tenant-001' },
  ]);
  routeMocks.repository.createCustomer.mockReset();
  routeMocks.repository.createCustomer.mockResolvedValue({
    id: 'cust_created',
    tenantId: 'demo-tenant-001',
    displayName: '王女士',
  });
  routeMocks.repository.updateCustomer.mockReset();
  routeMocks.repository.updateCustomer.mockResolvedValue({
    id: 'cust_001',
    tenantId: 'demo-tenant-001',
    displayName: '王女士更新',
  });
  routeMocks.repository.customerExistsByTenant.mockReset();
  routeMocks.repository.customerExistsByTenant.mockResolvedValue(true);
  routeMocks.repository.createAppointment.mockReset();
  routeMocks.repository.createAppointment.mockResolvedValue({
    id: 'appt_created',
    tenantId: 'demo-tenant-001',
    customerId: 'cust_001',
    scheduledAt: '2026-06-01T02:30:00.000Z',
  });
  routeMocks.repository.updateAppointment.mockReset();
  routeMocks.repository.updateAppointment.mockResolvedValue({
    id: 'appt_001',
    tenantId: 'demo-tenant-001',
    status: 'confirmed',
    note: '已确认',
  });
  routeMocks.repository.transitionFollowUpTask.mockReset();
  routeMocks.repository.transitionFollowUpTask.mockResolvedValue({
    kind: 'updated',
    task: { id: 'fu_001', tenantId: 'demo-tenant-001', status: 'in_progress' },
  });
  routeMocks.repository.createManualFollowUpTask.mockReset();
  routeMocks.repository.createManualFollowUpTask.mockResolvedValue({
    kind: 'created',
    task: { id: 'fu_created', tenantId: 'demo-tenant-001', status: 'scheduled' },
  });
});

const validCreateCustomerPayload = {
  displayName: '王女士',
  lifecycle: 'consulting',
  priority: 'high',
  ownerUserId: 'consultant-lin',
  projectInterest: '皮肤管理',
  maskedPhone: '138****0000',
  maskedMedicalRecordNo: 'MR****001',
  lastTouchSummary: '初次咨询',
  nextAction: '预约到店',
  tags: ['新客'],
  gender: '未指定',
  birthDate: '未指定',
  referralSource: '未指定',
  notes: '未指定',
};

const validUpdateCustomerPayload = {
  id: 'cust_001',
  displayName: '王女士更新',
};

type CustomerRouteHandler = (request: Request) => Response | Promise<Response>;

function hostileCustomerRequest() {
  const traps = { get: 0, ownKeys: 0, descriptor: 0, has: 0 };
  const request = new Proxy(Object.create(null), {
    get() {
      traps.get += 1;
      throw new Error('request must not be read');
    },
    getOwnPropertyDescriptor() {
      traps.descriptor += 1;
      throw new Error('request must not be described');
    },
    has() {
      traps.has += 1;
      throw new Error('request must not be inspected');
    },
    ownKeys() {
      traps.ownKeys += 1;
      throw new Error('request must not be enumerated');
    },
  }) as Request;

  return { request, traps };
}

async function expectCustomerCapabilityDisabled(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(customerCapabilityDisabledPayload);
}

function expectNoCustomerRouteSideEffects() {
  expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
  expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
  expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
  expect(routeMocks.checkTenantQuotaForCreate).not.toHaveBeenCalled();
  expect(routeMocks.database.transaction).not.toHaveBeenCalled();
  expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  expect(routeMocks.repository.listCustomersByTenant).not.toHaveBeenCalled();
  expect(routeMocks.repository.createCustomer).not.toHaveBeenCalled();
  expect(routeMocks.repository.updateCustomer).not.toHaveBeenCalled();
}

const validCreateAppointmentPayload = {
  customerId: 'cust_001',
  customerDisplayName: '王女士',
  project: '皮肤管理',
  scheduledAt: '2026-06-01T10:30:00+08:00',
  consultantUserId: 'consultant-lin',
  status: 'pending_confirmation',
  note: '首次预约',
};

const validUpdateAppointmentPayload = {
  id: 'appt_001',
  status: 'confirmed',
  note: '已确认',
};

const validFollowUpTransitionPayload = {
  id: 'fu_001',
  nextStatus: 'in_progress',
};

const validCreateFollowUpPayload = {
  customerId: 'cust_001',
  customerDisplayName: '王女士',
  stage: '术后回访',
  dueAt: '2026-06-15T10:00:00+08:00',
  suggestedAction: '联系客户确认恢复情况',
  riskLevel: 'normal',
  status: 'scheduled',
};

function expectAuditEventDoesNotContainPrivateBody(event: unknown) {
  const serialized = JSON.stringify(event);

  expect(event).not.toHaveProperty('metadata');
  expect(event).not.toHaveProperty('requestBody');
  expect(serialized).not.toContain('13800000000');
  expect(serialized).not.toContain('110101199001010011');
  expect(serialized).not.toContain('MR-RAW-001');
  expect(serialized).not.toContain('完整治疗记录正文');
  expect(serialized).not.toContain('咨询对话全文');
  expect(serialized).not.toContain('DATABASE_URL');
  expect(serialized).not.toContain('postgres://');
}

describe('租户业务只读 API 流程', () => {
  it('使用访问上下文租户读取客户', async () => {
    const repository = {
      listCustomersByTenant: vi.fn(async () => [{ id: 'cust_001', tenantId: 'demo-tenant-001' }]),
      listAppointmentsByTenant: vi.fn(),
      listFollowUpTasksByTenant: vi.fn(),
    };
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessListRequest({
      context: tenantContext,
      resource: 'customer',
      list: repository.listCustomersByTenant,
      auditRepository,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      records: [{ id: 'cust_001', tenantId: 'demo-tenant-001' }],
    });
    expect(repository.listCustomersByTenant).toHaveBeenCalledWith('demo-tenant-001');
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'allowed',
      tenantId: 'demo-tenant-001',
      resource: 'customer',
    }));
  });

  it('没有访问上下文时返回 401 且不写审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessListRequest({
      context: null,
      resource: 'customer',
      list: vi.fn(),
      auditRepository,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(auditRepository.record).not.toHaveBeenCalled();
  });

  it('权限拒绝时返回 403 并写入审计事件', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessListRequest({
      context: platformContext,
      resource: 'customer',
      list: vi.fn(),
      auditRepository,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'role_denied',
    }));
  });

  it('租户作用域缺少 tenantId 时返回 403 并写入 missing_tenant 审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };
    const list = vi.fn();

    const response = await handleTenantBusinessListRequest({
      context: { ...tenantContext, tenantId: null },
      resource: 'appointment',
      list,
      auditRepository,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(list).not.toHaveBeenCalled();
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'appointment',
      result: 'denied',
      reason: 'missing_tenant',
    }));
  });
});

describe('租户业务写入 API 处理器', () => {
  it('写入处理器使用访问上下文租户并记录允许审计', async () => {
    const auditRepository = { record: vi.fn(async (_event: unknown) => undefined) };
    const mutate = vi.fn(async ({ successAuditEvent }) => {
      await auditRepository.record(successAuditEvent);
      return {
        kind: 'success' as const,
        record: { id: 'cust_created', tenantId: 'demo-tenant-001' },
      };
    });

    const response = await handleTenantBusinessMutationRequest({
      context: tenantContext,
      resource: 'customer',
      action: 'create',
      mutate,
      auditRepository,
      successStatus: 201,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      record: { id: 'cust_created', tenantId: 'demo-tenant-001' },
    });
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'demo-tenant-001',
      successAuditEvent: expect.objectContaining({
        action: 'create',
        resource: 'customer',
        result: 'allowed',
        tenantId: 'demo-tenant-001',
      }),
    }));
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resource: 'customer',
      result: 'allowed',
      tenantId: 'demo-tenant-001',
    }));
  });

  it('写入处理器对非法随访流转返回 409 并写拒绝审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessMutationRequest({
      context: tenantContext,
      resource: 'follow_up',
      action: 'update',
      mutate: vi.fn(async () => ({
        kind: 'invalid_transition' as const,
        resourceId: 'fu_001',
        from: 'completed',
        to: 'in_progress',
      })),
      auditRepository,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: '随访状态不允许这样流转' });
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'invalid_transition',
      resource: 'follow_up',
      resourceId: 'fu_001',
      action: 'update',
    }));
  });

  it('写入处理器对随访状态冲突返回 409 并写拒绝审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessMutationRequest({
      context: tenantContext,
      resource: 'follow_up',
      action: 'update',
      mutate: vi.fn(async () => ({
        kind: 'conflict' as const,
        resourceId: 'fu_001',
        reason: 'stale_transition' as const,
      })),
      auditRepository,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: '随访状态已变化，请刷新后重试' });
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'stale_transition',
      resource: 'follow_up',
      resourceId: 'fu_001',
      action: 'update',
    }));
  });

  it('没有访问上下文时返回 401 且不调用写入或审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };
    const mutate = vi.fn();

    const response = await handleTenantBusinessMutationRequest({
      context: null,
      resource: 'customer',
      action: 'create',
      mutate,
      auditRepository,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(mutate).not.toHaveBeenCalled();
    expect(auditRepository.record).not.toHaveBeenCalled();
  });

  it('平台上下文创建客户时返回 403 拒绝审计且不调用写入', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };
    const mutate = vi.fn();

    const response = await handleTenantBusinessMutationRequest({
      context: platformContext,
      resource: 'customer',
      action: 'create',
      mutate,
      auditRepository,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(mutate).not.toHaveBeenCalled();
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'role_denied',
      resource: 'customer',
      action: 'create',
    }));
  });

  it('租户上下文缺少 tenantId 时返回 403 缺少租户审计且不调用写入', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };
    const mutate = vi.fn();

    const response = await handleTenantBusinessMutationRequest({
      context: { ...tenantContext, tenantId: null },
      resource: 'appointment',
      action: 'update',
      mutate,
      auditRepository,
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(mutate).not.toHaveBeenCalled();
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'missing_tenant',
      resource: 'appointment',
      action: 'update',
    }));
  });

  it('写入目标不存在时返回 404 并记录拒绝审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessMutationRequest({
      context: tenantContext,
      resource: 'customer',
      action: 'update',
      mutate: vi.fn(async () => ({ kind: 'not_found' as const })),
      auditRepository,
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'not_found_or_not_owned',
      resource: 'customer',
      action: 'update',
    }));
  });

  it('写入处理器对配额拒绝返回 409 并写入稳定拒绝审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessMutationRequest({
      context: tenantContext,
      resource: 'customer',
      action: 'create',
      mutate: vi.fn(async () => ({
        kind: 'quota_denied' as const,
        decision: {
          allowed: false as const,
          current: 1000,
          limit: 1000,
          reason: 'quota_exceeded_customers' as const,
          resource: 'customers' as const,
        },
      })),
      auditRepository,
      successStatus: 201,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: 'quota_exceeded_customers', error: '客户数量已达到当前套餐上限，请联系平台管理员调整套餐',
    });
    expect(auditRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      reason: 'quota_exceeded_customers',
      resource: 'customer',
      result: 'denied',
      tenantId: 'demo-tenant-001',
    }));
  });
});

describe('客户 API capability-off 路由', () => {
  it.each([
    [
      'GET 普通及伪造 query/header 请求',
      customersGet,
      new Request(
        'http://localhost/api/institution/customers?customerId=MOCK-customer-input&raw=%7Bbad-json',
        {
          headers: {
            cookie: 'demo_session=DEMO-customer-input',
            'x-tenant-id': 'input-tenant',
            'x-institution-id': 'input-institution',
          },
        },
      ),
    ],
    [
      'POST 普通 JSON 请求',
      customersPost,
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        headers: {
          cookie: 'demo_session=DEMO-customer-input',
          'content-type': 'application/json',
          'x-tenant-id': 'input-tenant',
        },
        body: JSON.stringify({ ...validCreateCustomerPayload, rawInput: 'MOCK-customer-input' }),
      }),
    ],
    [
      'POST 非法 JSON 请求',
      customersPost,
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad-json-DEMO-customer-input',
      }),
    ],
    [
      'PATCH 普通 JSON 请求',
      customersPatch,
      new Request('http://localhost/api/institution/customers', {
        method: 'PATCH',
        headers: {
          cookie: 'demo_session=DEMO-customer-input',
          'content-type': 'application/json',
          'x-institution-id': 'input-institution',
        },
        body: JSON.stringify({ ...validUpdateCustomerPayload, rawInput: 'MOCK-customer-input' }),
      }),
    ],
    [
      'PATCH 非法 JSON 请求',
      customersPatch,
      new Request('http://localhost/api/institution/customers', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{bad-json-MOCK-customer-input',
      }),
    ],
  ] as const)('%s 固定返回无缓存 503，且不读取或回显输入', async (_name, handler, request) => {
    const response = await (handler as CustomerRouteHandler)(request);
    const responseCopy = response.clone();

    await expectCustomerCapabilityDisabled(response);
    const serialized = JSON.stringify(await responseCopy.json());

    expect(request.bodyUsed).toBe(false);
    expect(serialized).not.toMatch(/mock|demo|customer|tenant|institution|bad-json/iu);
    expectNoCustomerRouteSideEffects();
  });

  it.each([
    ['GET', customersGet],
    ['POST', customersPost],
    ['PATCH', customersPatch],
  ] as const)('%s 对 hostile Proxy 零读取、零副作用', async (_method, handler) => {
    const hostile = hostileCustomerRequest();

    await expectCustomerCapabilityDisabled(
      await (handler as CustomerRouteHandler)(hostile.request),
    );

    expect(hostile.traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0, has: 0 });
    expectNoCustomerRouteSideEffects();
  });

  it('route 只加载响应工具，不装配 session、数据库、repository、quota 或 audit', () => {
    expect(customersRouteSource.split('\n').filter((line) => line.startsWith('import '))).toEqual([
      "import { NextResponse } from 'next/server';",
    ]);
    for (const method of ['GET', 'POST', 'PATCH']) {
      expect(customersRouteSource).toContain(`export function ${method}(_request: Request)`);
    }
    expect(customersRouteSource).not.toMatch(/\b_request\s*(?:\.|\[)/u);

    for (const forbiddenSource of [
      'request.json',
      'access-context',
      'getDemoAccessContextFromRequest',
      'getDatabase',
      'tenant-business',
      'repository',
      'quota',
      'audit',
      'globalThis',
      'crypto',
      'new URL',
      'searchParams',
      'fetch',
    ]) {
      expect(customersRouteSource).not.toContain(forbiddenSource);
    }
  });
});

describe('租户业务只读 API 路由', () => {
  it('appointments / followups 列表固定 capability-disabled，不读取普通、查询或 hostile 请求', async () => {
    const routeCases = [
      {
        handler: appointmentsGet,
        requests: [
          new Request('http://localhost/api/institution/appointments'),
          new Request('http://localhost/api/institution/appointments?tenantId=other-tenant'),
        ],
        disabled: {
          code: 'appointment_list_capability_disabled',
          error: '预约列表能力暂未启用',
        },
      },
      {
        handler: followupsGet,
        requests: [
          new Request('http://localhost/api/institution/followups'),
          new Request('http://localhost/api/institution/followups?source=ai&tenantId=other-tenant'),
        ],
        disabled: {
          code: 'follow_up_list_capability_disabled',
          error: '随访列表能力暂未启用',
        },
      },
    ] as const;

    for (const routeCase of routeCases) {
      for (const request of routeCase.requests) {
        const response = await routeCase.handler(request);
        const payload = await response.json();

        expect(response.status).toBe(503);
        expect(payload).toEqual(routeCase.disabled);
        expect(payload).not.toHaveProperty('records');
      }

      const traps = { get: 0, ownKeys: 0, descriptor: 0 };
      const hostileRequest = new Proxy({}, {
        get() { traps.get += 1; throw new Error('request must not be read'); },
        ownKeys() { traps.ownKeys += 1; throw new Error('request must not be enumerated'); },
        getOwnPropertyDescriptor() { traps.descriptor += 1; throw new Error('request must not be described'); },
      }) as Request;
      const hostileResponse = await routeCase.handler(hostileRequest);

      expect(hostileResponse.status).toBe(503);
      await expect(hostileResponse.json()).resolves.toEqual(routeCase.disabled);
      expect(traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
    }

    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
    expect(routeMocks.repository.listAppointmentsByTenant).not.toHaveBeenCalled();
    expect(routeMocks.repository.listFollowUpTasksByTenant).not.toHaveBeenCalled();
  });
});

describe('租户业务写入 API 路由', () => {
  it('无 quota limit 时拒绝创建预约并 fail closed', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.checkTenantQuotaForCreate.mockResolvedValueOnce({
      allowed: false,
      current: null,
      limit: null,
      reason: 'missing_quota_limit',
      resource: 'appointments',
    });

    const response = await appointmentsPost(
      new Request('http://localhost/api/institution/appointments', {
        method: 'POST',
        body: JSON.stringify(validCreateAppointmentPayload),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: 'missing_quota_limit', error: '当前租户套餐配额未配置，暂时无法新增记录',
    });
    expect(routeMocks.repository.createAppointment).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'missing_quota_limit',
      result: 'denied',
    }));
  });

  it('预约创建和更新绑定对应仓储方法并使用上下文 tenantId', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const createResponse = await appointmentsPost(
      new Request('http://localhost/api/institution/appointments?tenantId=other-tenant', {
        method: 'POST',
        body: JSON.stringify(validCreateAppointmentPayload),
      }),
    );
    const patchResponse = await appointmentsPatch(
      new Request('http://localhost/api/institution/appointments', {
        method: 'PATCH',
        headers: { 'x-tenant-id': 'other-tenant' },
        body: JSON.stringify(validUpdateAppointmentPayload),
      }),
    );

    expect(createResponse.status).toBe(201);
    expect(patchResponse.status).toBe(200);
    expect(routeMocks.repository.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        tenantId: 'demo-tenant-001',
        customerId: 'cust_001',
        scheduledAt: new Date('2026-06-01T10:30:00+08:00'),
      }),
    );
    expect(routeMocks.repository.updateAppointment).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      ...validUpdateAppointmentPayload,
    });
    expect(routeMocks.checkTenantQuotaForCreate).toHaveBeenCalledTimes(1);
    expect(routeMocks.checkTenantQuotaForCreate).toHaveBeenCalledWith({
      database: routeMocks.database,
      resource: 'appointments',
      tenantId: 'demo-tenant-001',
    });
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resource: 'appointment',
      resourceId: 'appt_created',
      result: 'allowed',
      tenantId: 'demo-tenant-001',
    }));
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      resource: 'appointment',
      resourceId: 'appt_001',
      result: 'allowed',
      tenantId: 'demo-tenant-001',
    }));
    expect(routeMocks.auditRecord.mock.calls).toHaveLength(2);
    routeMocks.auditRecord.mock.calls.forEach(([event]) =>
      expectAuditEventDoesNotContainPrivateBody(event),
    );
  });

  it('无 quota snapshot 但 helper 按 active plan limit 和 live count 放行时继续创建预约', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.checkTenantQuotaForCreate.mockResolvedValueOnce({
      allowed: true,
      current: 399,
      limit: 400,
      resource: 'appointments',
    });

    const response = await appointmentsPost(
      new Request('http://localhost/api/institution/appointments', {
        method: 'POST',
        body: JSON.stringify(validCreateAppointmentPayload),
      }),
    );

    expect(response.status).toBe(201);
    expect(routeMocks.repository.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'demo-tenant-001' }),
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resource: 'appointment',
      result: 'allowed',
    }));
  });

  it('预约已达配额时拒绝创建、不写业务表并记录拒绝审计', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.checkTenantQuotaForCreate.mockResolvedValueOnce({
      allowed: false,
      current: 2000,
      limit: 2000,
      reason: 'quota_exceeded_appointments',
      resource: 'appointments',
    });

    const response = await appointmentsPost(
      new Request('http://localhost/api/institution/appointments?tenantId=other-tenant', {
        method: 'POST',
        headers: { 'x-tenant-id': 'other-tenant' },
        body: JSON.stringify(validCreateAppointmentPayload),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: 'quota_exceeded_appointments', error: '预约配额已达上限，请联系平台管理员调整套餐',
    });
    expect(routeMocks.checkTenantQuotaForCreate).toHaveBeenCalledWith({
      database: routeMocks.database,
      resource: 'appointments',
      tenantId: 'demo-tenant-001',
    });
    expect(routeMocks.repository.customerExistsByTenant).not.toHaveBeenCalled();
    expect(routeMocks.repository.createAppointment).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      reason: 'quota_exceeded_appointments',
      resource: 'appointment',
      result: 'denied',
      tenantId: 'demo-tenant-001',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it('更新预约不受数量配额阻断', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.checkTenantQuotaForCreate.mockResolvedValue({
      allowed: false,
      current: 2000,
      limit: 2000,
      reason: 'quota_exceeded_appointments',
      resource: 'appointments',
    });

    const response = await appointmentsPatch(
      new Request('http://localhost/api/institution/appointments', {
        method: 'PATCH',
        body: JSON.stringify(validUpdateAppointmentPayload),
      }),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.repository.updateAppointment).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      ...validUpdateAppointmentPayload,
    });
    expect(routeMocks.checkTenantQuotaForCreate).not.toHaveBeenCalled();
  });

  it('预约创建客户不属于当前租户时返回 404 并记录拒绝审计', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.repository.customerExistsByTenant.mockResolvedValueOnce(false);

    const response = await appointmentsPost(
      new Request('http://localhost/api/institution/appointments', {
        method: 'POST',
        body: JSON.stringify(validCreateAppointmentPayload),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(routeMocks.repository.customerExistsByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'cust_001',
    });
    expect(routeMocks.repository.createAppointment).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resource: 'appointment',
      result: 'denied',
      reason: 'not_found_or_not_owned',
    }));
    expect(routeMocks.auditRecord.mock.lastCall?.[0]).not.toHaveProperty('resourceId');
  });

  it('预约创建遇到客户外键竞态时返回 404 并记录拒绝审计', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.repository.createAppointment.mockRejectedValueOnce(
      Object.assign(new Error('insert violates appointment customer foreign key'), {
        code: '23503',
        constraint_name: 'appointments_tenant_customer_fk',
      }),
    );

    const response = await appointmentsPost(
      new Request('http://localhost/api/institution/appointments', {
        method: 'POST',
        body: JSON.stringify(validCreateAppointmentPayload),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resource: 'appointment',
      result: 'denied',
      reason: 'not_found_or_not_owned',
    }));
    expect(routeMocks.auditRecord.mock.lastCall?.[0]).not.toHaveProperty('resourceId');
  });

  it('随访状态流转绑定仓储方法、操作者和上下文 tenantId', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.checkTenantQuotaForCreate.mockResolvedValue({
      allowed: false,
      current: 2000,
      limit: 2000,
      reason: 'quota_exceeded_appointments',
      resource: 'appointments',
    });

    const response = await followupsPatch(
      new Request('http://localhost/api/institution/followups?tenantId=other-tenant', {
        method: 'PATCH',
        body: JSON.stringify(validFollowUpTransitionPayload),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      record: { id: 'fu_001', tenantId: 'demo-tenant-001', status: 'in_progress' },
    });
    expect(routeMocks.repository.transitionFollowUpTask).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'fu_001',
      nextStatus: 'in_progress',
      actorId: 'demo-user-admin',
      occurredAt: expect.any(String),
    });
    expect(routeMocks.checkTenantQuotaForCreate).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      resource: 'follow_up',
      resourceId: 'fu_001',
      result: 'allowed',
      tenantId: 'demo-tenant-001',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it('随访非法流转返回 409 并记录拒绝审计', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.repository.transitionFollowUpTask.mockResolvedValueOnce({
      kind: 'invalid_transition',
      resourceId: 'fu_001',
      from: 'completed',
      to: 'in_progress',
    });

    const response = await followupsPatch(
      new Request('http://localhost/api/institution/followups', {
        method: 'PATCH',
        body: JSON.stringify(validFollowUpTransitionPayload),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: '随访状态不允许这样流转' });
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      resource: 'follow_up',
      resourceId: 'fu_001',
      result: 'denied',
      reason: 'invalid_transition',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it('随访状态冲突返回 409 并记录拒绝审计', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.repository.transitionFollowUpTask.mockResolvedValueOnce({
      kind: 'conflict',
      resourceId: 'fu_001',
      reason: 'stale_transition',
    });

    const response = await followupsPatch(
      new Request('http://localhost/api/institution/followups', {
        method: 'PATCH',
        body: JSON.stringify(validFollowUpTransitionPayload),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: '随访状态已变化，请刷新后重试' });
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      resource: 'follow_up',
      resourceId: 'fu_001',
      result: 'denied',
      reason: 'stale_transition',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it('机构账号手动创建随访成功 201', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await followupsPost(
      new Request('http://localhost/api/institution/followups', {
        method: 'POST',
        body: JSON.stringify(validCreateFollowUpPayload),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      record: { id: 'fu_created', tenantId: 'demo-tenant-001' },
    });
    expect(routeMocks.repository.createManualFollowUpTask).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'demo-tenant-001',
        customerId: 'cust_001',
        stage: '术后回访',
        status: 'scheduled',
        riskLevel: 'normal',
      }),
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resource: 'follow_up',
      resourceId: 'fu_created',
      result: 'allowed',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it('未登录创建随访返回 401', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const response = await followupsPost(
      new Request('http://localhost/api/institution/followups', {
        method: 'POST',
        body: JSON.stringify(validCreateFollowUpPayload),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('平台上下文创建随访返回 403 且不调用写入', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await followupsPost(
      new Request('http://localhost/api/institution/followups', {
        method: 'POST',
        body: JSON.stringify(validCreateFollowUpPayload),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.repository.createManualFollowUpTask).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'role_denied',
    }));
  });

  it('跨租户客户写入随访被隔离拒绝', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      ...tenantContext,
      tenantId: 'other-tenant-002',
    });
    routeMocks.repository.createManualFollowUpTask.mockResolvedValueOnce({
      kind: 'customer_not_found',
    });

    const response = await followupsPost(
      new Request('http://localhost/api/institution/followups', {
        method: 'POST',
        body: JSON.stringify(validCreateFollowUpPayload),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
  });

  it('无效 customerId 创建随访返回 404', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.repository.createManualFollowUpTask.mockResolvedValueOnce({
      kind: 'customer_not_found',
    });

    const response = await followupsPost(
      new Request('http://localhost/api/institution/followups', {
        method: 'POST',
        body: JSON.stringify(validCreateFollowUpPayload),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
  });

  it('体验版套餐机构创建预约成功（trial-care quota 已配置）', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      ...tenantContext,
      tenantId: 'trial-tenant-test',
    });
    routeMocks.checkTenantQuotaForCreate.mockResolvedValueOnce({
      allowed: true,
      current: 5,
      limit: 120,
      resource: 'appointments',
    });

    const response = await appointmentsPost(
      new Request('http://localhost/api/institution/appointments', {
        method: 'POST',
        body: JSON.stringify(validCreateAppointmentPayload),
      }),
    );

    expect(response.status).toBe(201);
    expect(routeMocks.checkTenantQuotaForCreate).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'appointments' }),
    );
    expect(routeMocks.repository.createAppointment).toHaveBeenCalled();
  });
});
