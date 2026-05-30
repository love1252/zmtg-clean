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
} from '@/app/api/institution/followups/route';
import { DEMO_SESSION_COOKIE } from '@/modules/auth/server/demo-session';
import type { AccessContext } from '@/modules/security/domain/access-control';
import {
  handleTenantBusinessListRequest,
  handleTenantBusinessMutationRequest,
} from '@/modules/institution/server/tenant-business-api';

const routeMocks = vi.hoisted(() => {
  const repository = {
    listCustomersByTenant: vi.fn(),
    listAppointmentsByTenant: vi.fn(),
    listFollowUpTasksByTenant: vi.fn(),
    createCustomer: vi.fn(),
    updateCustomer: vi.fn(),
    createAppointment: vi.fn(),
    updateAppointment: vi.fn(),
    transitionFollowUpTask: vi.fn(),
  };
  const auditRecord = vi.fn();
  const transactionDatabase = { database: 'transaction-db' };
  const database = {
    database: 'test-db',
    transaction: vi.fn(async (operation: (tx: typeof transactionDatabase) => unknown) =>
      operation(transactionDatabase),
    ),
  };

  return {
    auditRecord,
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

const tenantContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const platformContext: AccessContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

function unsignedSession(session: unknown) {
  return Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.database.transaction.mockReset();
  routeMocks.database.transaction.mockImplementation(async (operation) =>
    operation(routeMocks.transactionDatabase),
  );
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
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
};

const validUpdateCustomerPayload = {
  id: 'cust_001',
  displayName: '王女士更新',
};

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

describe('租户业务写入 API handler', () => {
  it('写入 handler 使用访问上下文租户并记录允许审计', async () => {
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

  it('写入 handler 对非法随访流转返回 409 并写 denied 审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessMutationRequest({
      context: tenantContext,
      resource: 'follow_up',
      action: 'update',
      mutate: vi.fn(async () => ({
        kind: 'invalid_transition' as const,
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
      action: 'update',
    }));
  });

  it('写入 handler 对随访状态冲突返回 409 并写 denied 审计', async () => {
    const auditRepository = { record: vi.fn(async () => undefined) };

    const response = await handleTenantBusinessMutationRequest({
      context: tenantContext,
      resource: 'follow_up',
      action: 'update',
      mutate: vi.fn(async () => ({
        kind: 'conflict' as const,
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

  it('平台上下文创建客户时返回 403 denied 审计且不调用写入', async () => {
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

  it('租户上下文缺少 tenantId 时返回 403 missing_tenant 审计且不调用写入', async () => {
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

  it('写入目标不存在时返回 404 并记录 denied 审计', async () => {
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
});

describe('租户业务只读 API route', () => {
  it('未登录时优先返回 401 且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const routeHandlers = [customersGet, appointmentsGet, followupsGet];

    for (const routeHandler of routeHandlers) {
      const response = await routeHandler(new Request('http://localhost/api/institution/customers'));

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    }
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('伪造未签名 cookie 请求客户 route 时返回 401 且不初始化数据库', async () => {
    const actualAccessContext = await vi.importActual<typeof import('@/modules/security/server/access-context')>(
      '@/modules/security/server/access-context',
    );
    routeMocks.getDemoAccessContextFromRequest.mockImplementation((request: Request) =>
      actualAccessContext.getDemoAccessContextFromRequest(request),
    );
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const forged = unsignedSession({
      user: {
        id: 'forged-user-admin',
        username: 'forged',
        name: '伪造机构管理员',
        role: 'tenant_admin',
        tenantId: 'demo-tenant-001',
      },
      expiresAt: Date.now() + 60_000,
    });

    const response = await customersGet(
      new Request('http://localhost/api/institution/customers', {
        headers: { cookie: `${DEMO_SESSION_COOKIE}=${forged}` },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('带恶意 URL 和 header tenant 时仍使用访问上下文 tenant', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await customersGet(
      new Request('http://localhost/api/institution/customers?tenantId=other-tenant', {
        headers: { 'x-tenant-id': 'other-tenant' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      records: [{ id: 'cust_001', tenantId: 'demo-tenant-001' }],
    });
    expect(routeMocks.repository.listCustomersByTenant).toHaveBeenCalledWith('demo-tenant-001');
    expect(routeMocks.repository.listCustomersByTenant).not.toHaveBeenCalledWith('other-tenant');
  });

  it('权限拒绝时返回 403 且不被 route catch 成 503', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await customersGet(new Request('http://localhost/api/institution/customers'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.repository.listCustomersByTenant).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'role_denied',
      resource: 'customer',
      result: 'denied',
    }));
  });

  it('三个 route 绑定各自的列表方法和审计资源', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const routeCases = [
      {
        handler: customersGet,
        path: '/api/institution/customers',
        list: routeMocks.repository.listCustomersByTenant,
        resource: 'customer',
      },
      {
        handler: appointmentsGet,
        path: '/api/institution/appointments',
        list: routeMocks.repository.listAppointmentsByTenant,
        resource: 'appointment',
      },
      {
        handler: followupsGet,
        path: '/api/institution/followups',
        list: routeMocks.repository.listFollowUpTasksByTenant,
        resource: 'follow_up',
      },
    ] as const;

    for (const routeCase of routeCases) {
      routeMocks.auditRecord.mockClear();
      const response = await routeCase.handler(new Request(`http://localhost${routeCase.path}`));

      expect(response.status).toBe(200);
      expect(routeCase.list).toHaveBeenCalledWith('demo-tenant-001');
      expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
        action: 'read_own_tenant',
        resource: routeCase.resource,
        result: 'allowed',
        tenantId: 'demo-tenant-001',
      }));
    }
  });

  it('数据库异常返回 503 且不泄露连接信息', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const routeHandlers = [customersGet, appointmentsGet, followupsGet];

    for (const routeHandler of routeHandlers) {
      const response = await routeHandler(new Request('http://localhost/api/institution/customers'));
      const payload = await response.json();
      const serializedPayload = JSON.stringify(payload);

      expect(response.status).toBe(503);
      expect(payload).toEqual({ error: '数据服务暂时不可用' });
      expect(serializedPayload).not.toContain('DATABASE_URL');
      expect(serializedPayload).not.toContain('postgres://');
      expect(serializedPayload).not.toContain('secret');
    }
  });

  it('审计写入失败时 fail-closed 返回 503 且不泄露错误详情', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.auditRecord.mockRejectedValue(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg'),
    );

    const response = await customersGet(new Request('http://localhost/api/institution/customers'));
    const payload = await response.json();
    const serializedPayload = JSON.stringify(payload);

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expect(serializedPayload).not.toContain('DATABASE_URL');
    expect(serializedPayload).not.toContain('postgres://');
    expect(serializedPayload).not.toContain('secret');
  });
});

describe('租户业务写入 API route', () => {
  it('未登录创建客户时返回 401 且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const response = await customersPost(
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        body: JSON.stringify(validCreateCustomerPayload),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.repository.createCustomer).not.toHaveBeenCalled();
  });

  it('创建客户请求体含 tenantId 时返回解析错误且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await customersPost(
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        body: JSON.stringify({
          ...validCreateCustomerPayload,
          tenantId: 'other-tenant',
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: '请求包含不允许的字段: tenantId' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.repository.createCustomer).not.toHaveBeenCalled();
  });

  it('非法 JSON 返回 400 且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await customersPost(
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        body: '{bad-json',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: '请求格式不正确' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.repository.createCustomer).not.toHaveBeenCalled();
  });

  it('创建客户请求体含原始手机号时返回解析错误且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await customersPost(
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        body: JSON.stringify({
          ...validCreateCustomerPayload,
          maskedPhone: '13800000000',
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '字段 maskedPhone 必须是脱敏展示值',
    });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.repository.createCustomer).not.toHaveBeenCalled();
  });

  it('创建客户使用访问上下文 tenantId 并记录允许审计', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await customersPost(
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        headers: { 'x-tenant-id': 'other-tenant' },
        body: JSON.stringify(validCreateCustomerPayload),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      record: { id: 'cust_created', tenantId: 'demo-tenant-001', displayName: '王女士' },
    });
    expect(routeMocks.repository.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        tenantId: 'demo-tenant-001',
        displayName: '王女士',
      }),
    );
    expect(routeMocks.repository.createCustomer).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'other-tenant' }),
    );
    expect(routeMocks.database.transaction).toHaveBeenCalledTimes(1);
    expect(routeMocks.createTenantBusinessRepository).toHaveBeenCalledWith(
      routeMocks.transactionDatabase,
    );
    expect(routeMocks.createAuditEventRepository).toHaveBeenCalledWith(
      routeMocks.transactionDatabase,
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resource: 'customer',
      result: 'allowed',
      tenantId: 'demo-tenant-001',
    }));
  });

  it('更新客户目标不存在时返回 404 并记录 denied 审计', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.repository.updateCustomer.mockResolvedValueOnce(null);

    const response = await customersPatch(
      new Request('http://localhost/api/institution/customers', {
        method: 'PATCH',
        body: JSON.stringify(validUpdateCustomerPayload),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(routeMocks.repository.updateCustomer).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      ...validUpdateCustomerPayload,
    });
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'not_found_or_not_owned',
      resource: 'customer',
    }));
  });

  it('创建客户和允许审计在同一事务中执行，审计失败时返回 503', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.auditRecord.mockRejectedValueOnce(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg'),
    );

    const response = await customersPost(
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        body: JSON.stringify(validCreateCustomerPayload),
      }),
    );
    const payload = await response.json();
    const serializedPayload = JSON.stringify(payload);

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expect(serializedPayload).not.toContain('DATABASE_URL');
    expect(serializedPayload).not.toContain('postgres://');
    expect(serializedPayload).not.toContain('secret');
    expect(routeMocks.database.transaction).toHaveBeenCalledTimes(1);
    expect(routeMocks.repository.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'demo-tenant-001' }),
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resource: 'customer',
      result: 'allowed',
    }));
  });

  it('平台上下文写入返回 403 且不调用客户写入方法', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await customersPost(
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        body: JSON.stringify(validCreateCustomerPayload),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.getDatabase).toHaveBeenCalled();
    expect(routeMocks.repository.createCustomer).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resource: 'customer',
      result: 'denied',
      reason: 'role_denied',
    }));
  });

  it('预约创建和更新绑定对应 repository 方法并使用上下文 tenantId', async () => {
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
  });

  it('随访状态流转绑定 repository 方法、操作者和上下文 tenantId', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

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
  });

  it('随访非法流转返回 409 并记录 denied 审计', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.repository.transitionFollowUpTask.mockResolvedValueOnce({
      kind: 'invalid_transition',
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
      result: 'denied',
      reason: 'invalid_transition',
    }));
  });

  it('随访状态冲突返回 409 并记录 denied 审计', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.repository.transitionFollowUpTask.mockResolvedValueOnce({
      kind: 'conflict',
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
      result: 'denied',
      reason: 'stale_transition',
    }));
  });

  it('写入链路异常返回 503 且不泄露数据库或密钥信息', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.repository.createCustomer.mockRejectedValueOnce(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg'),
    );

    const response = await customersPost(
      new Request('http://localhost/api/institution/customers', {
        method: 'POST',
        body: JSON.stringify(validCreateCustomerPayload),
      }),
    );
    const payload = await response.json();
    const serializedPayload = JSON.stringify(payload);

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expect(serializedPayload).not.toContain('DATABASE_URL');
    expect(serializedPayload).not.toContain('postgres://');
    expect(serializedPayload).not.toContain('secret');
  });
});
