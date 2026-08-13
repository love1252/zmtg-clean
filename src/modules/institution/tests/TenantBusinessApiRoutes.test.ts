import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mintAttemptedInstitutionDenialAttributionForOrchestrationV1,
  mintVerifiedInstitutionAuditAttributionForOrchestrationV1,
} from '@/modules/audit/domain/audit-events';
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
    createAuditEventRepository: vi.fn(() => ({ recordAttributed: auditRecord })),
    createTenantBusinessRepository: vi.fn(() => repository),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    recordFollowUpTaskStatusTimelineEvent: vi.fn(),
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

vi.mock('@/modules/institution/server/followup-customer-timeline-service', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/followup-customer-timeline-service')
  >();
  return {
    ...actual,
    recordFollowUpTaskStatusTimelineEvent: routeMocks.recordFollowUpTaskStatusTimelineEvent,
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

function createVerifiedAuditAttribution() {
  const attribution = mintVerifiedInstitutionAuditAttributionForOrchestrationV1({
    formalPair: {
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
      observedAt: '2026-08-13T08:00:00.000Z',
    },
    businessPair: {
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
    },
  });
  if (!attribution) throw new Error('expected verified test attribution');
  return { kind: 'verified' as const, attribution };
}

function createAttemptedDenialAuditAttribution() {
  const attemptedPair = Object.freeze({
    tenantId: 'demo-tenant-001',
    institutionId: 'demo-inst-001',
  });
  const attribution = mintAttemptedInstitutionDenialAttributionForOrchestrationV1({
    signedSessionPair: attemptedPair,
  });
  if (!attribution) throw new Error('expected attempted-denial test attribution');
  return { kind: 'attempted_denial' as const, attribution, attemptedPair };
}

function createHandlerAuditRepository() {
  return {
    recordAttributed: vi.fn(async (_event: unknown) => undefined),
    recordAttemptedInstitutionDenial: vi.fn(async (_event: unknown) => undefined),
  };
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
  routeMocks.recordFollowUpTaskStatusTimelineEvent.mockReset();
  routeMocks.recordFollowUpTaskStatusTimelineEvent.mockResolvedValue(undefined);
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
    const auditRepository = createHandlerAuditRepository();

    const response = await handleTenantBusinessListRequest({
      context: tenantContext,
      resource: 'customer',
      list: repository.listCustomersByTenant,
      auditRepository,
      auditAttribution: createVerifiedAuditAttribution(),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      records: [{ id: 'cust_001', tenantId: 'demo-tenant-001' }],
    });
    expect(repository.listCustomersByTenant).toHaveBeenCalledWith('demo-tenant-001');
    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(expect.objectContaining({
      result: 'allowed',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
      institutionAttribution: 'verified',
      resource: 'customer',
    }));
  });

  it('没有访问上下文时返回 401 且不写审计', async () => {
    const auditRepository = createHandlerAuditRepository();

    const response = await handleTenantBusinessListRequest({
      context: null,
      resource: 'customer',
      list: vi.fn(),
      auditRepository,
      auditAttribution: createVerifiedAuditAttribution(),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(auditRepository.recordAttributed).not.toHaveBeenCalled();
  });

  it('权限拒绝时返回 403 并写入审计事件', async () => {
    const auditRepository = createHandlerAuditRepository();

    const response = await handleTenantBusinessListRequest({
      context: platformContext,
      resource: 'customer',
      list: vi.fn(),
      auditRepository,
      auditAttribution: createAttemptedDenialAuditAttribution(),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(auditRepository.recordAttemptedInstitutionDenial).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'role_denied',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
      institutionAttribution: null,
    }));
  });

  it('租户作用域缺少 tenantId 时返回 403 并写入 missing_tenant 审计', async () => {
    const auditRepository = createHandlerAuditRepository();
    const list = vi.fn();

    const response = await handleTenantBusinessListRequest({
      context: { ...tenantContext, tenantId: null },
      resource: 'appointment',
      list,
      auditRepository,
      auditAttribution: createAttemptedDenialAuditAttribution(),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(list).not.toHaveBeenCalled();
    expect(auditRepository.recordAttemptedInstitutionDenial).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'appointment',
      result: 'denied',
      reason: 'missing_tenant',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
      institutionAttribution: null,
    }));
  });
});

describe('租户业务写入 API 处理器', () => {
  it('写入处理器使用访问上下文租户并记录允许审计', async () => {
    const auditRepository = createHandlerAuditRepository();
    const mutate = vi.fn(async ({ successAuditEvent }) => {
      await auditRepository.recordAttributed(successAuditEvent);
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
      auditAttribution: createVerifiedAuditAttribution(),
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
        institutionId: 'demo-inst-001',
        institutionAttribution: 'verified',
      }),
    }));
    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      resource: 'customer',
      result: 'allowed',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
      institutionAttribution: 'verified',
    }));
  });

  it('写入处理器对非法随访流转返回 409 并写拒绝审计', async () => {
    const auditRepository = createHandlerAuditRepository();

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
      auditAttribution: createVerifiedAuditAttribution(),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: '随访状态不允许这样流转' });
    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'invalid_transition',
      resource: 'follow_up',
      resourceId: 'fu_001',
      action: 'update',
    }));
  });

  it('写入处理器对随访状态冲突返回 409 并写拒绝审计', async () => {
    const auditRepository = createHandlerAuditRepository();

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
      auditAttribution: createVerifiedAuditAttribution(),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: '随访状态已变化，请刷新后重试' });
    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'stale_transition',
      resource: 'follow_up',
      resourceId: 'fu_001',
      action: 'update',
    }));
  });

  it('没有访问上下文时返回 401 且不调用写入或审计', async () => {
    const auditRepository = createHandlerAuditRepository();
    const mutate = vi.fn();

    const response = await handleTenantBusinessMutationRequest({
      context: null,
      resource: 'customer',
      action: 'create',
      mutate,
      auditRepository,
      auditAttribution: createVerifiedAuditAttribution(),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(mutate).not.toHaveBeenCalled();
    expect(auditRepository.recordAttributed).not.toHaveBeenCalled();
  });

  it('平台上下文创建客户时返回 403 拒绝审计且不调用写入', async () => {
    const auditRepository = createHandlerAuditRepository();
    const mutate = vi.fn();

    const response = await handleTenantBusinessMutationRequest({
      context: platformContext,
      resource: 'customer',
      action: 'create',
      mutate,
      auditRepository,
      auditAttribution: createAttemptedDenialAuditAttribution(),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(mutate).not.toHaveBeenCalled();
    expect(auditRepository.recordAttemptedInstitutionDenial).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'role_denied',
      resource: 'customer',
      action: 'create',
    }));
  });

  it('租户上下文缺少 tenantId 时返回 403 缺少租户审计且不调用写入', async () => {
    const auditRepository = createHandlerAuditRepository();
    const mutate = vi.fn();

    const response = await handleTenantBusinessMutationRequest({
      context: { ...tenantContext, tenantId: null },
      resource: 'appointment',
      action: 'update',
      mutate,
      auditRepository,
      auditAttribution: createAttemptedDenialAuditAttribution(),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(mutate).not.toHaveBeenCalled();
    expect(auditRepository.recordAttemptedInstitutionDenial).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'missing_tenant',
      resource: 'appointment',
      action: 'update',
    }));
  });

  it('写入目标不存在时返回 404 并记录拒绝审计', async () => {
    const auditRepository = createHandlerAuditRepository();

    const response = await handleTenantBusinessMutationRequest({
      context: tenantContext,
      resource: 'customer',
      action: 'update',
      mutate: vi.fn(async () => ({ kind: 'not_found' as const })),
      auditRepository,
      auditAttribution: createVerifiedAuditAttribution(),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(expect.objectContaining({
      result: 'denied',
      reason: 'not_found_or_not_owned',
      resource: 'customer',
      action: 'update',
    }));
  });

  it('写入处理器对配额拒绝返回 409 并写入稳定拒绝审计', async () => {
    const auditRepository = createHandlerAuditRepository();

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
      auditAttribution: createVerifiedAuditAttribution(),
      successStatus: 201,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: 'quota_exceeded_customers', error: '客户数量已达到当前套餐上限，请联系平台管理员调整套餐',
    });
    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(expect.objectContaining({
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

type CareRouteHandler = (
  request: Request,
  context?: unknown,
) => Response | Promise<Response>;

type CareDisabledPayload = {
  code: 'capability_disabled';
  error: string;
};

type CareRequestCase = {
  name: string;
  handler: CareRouteHandler;
  request: Request;
  expected: CareDisabledPayload;
};

const appointmentCapabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled' as const,
  error: '预约能力暂未启用',
});

const followUpCapabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled' as const,
  error: '随访能力暂未启用',
});

const careRouteSources = [
  {
    name: 'appointments',
    source: readFileSync(
      resolve(process.cwd(), 'src/app/api/institution/appointments/route.ts'),
      'utf8',
    ),
  },
  {
    name: 'followups',
    source: readFileSync(
      resolve(process.cwd(), 'src/app/api/institution/followups/route.ts'),
      'utf8',
    ),
  },
] as const;

function createCareRequestCases(input: {
  path: 'appointments' | 'followups';
  handlers: {
    GET: CareRouteHandler;
    POST: CareRouteHandler;
    PATCH: CareRouteHandler;
  };
  expected: CareDisabledPayload;
  createPayload: Record<string, unknown>;
  updatePayload: Record<string, unknown>;
}): CareRequestCase[] {
  const url = `http://localhost/api/institution/${input.path}`;
  return [
    {
      name: `${input.path} GET 普通及伪造 query/header 请求`,
      handler: input.handlers.GET,
      request: new Request(
        `${url}?tenantId=MOCK-input-tenant&raw=%7Bbad-json&customerId=DEMO-input-customer`,
        {
          headers: {
            cookie: 'demo_session=DEMO-care-input',
            'x-institution-id': 'MOCK-input-institution',
          },
        },
      ),
      expected: input.expected,
    },
    {
      name: `${input.path} POST 普通 JSON 请求`,
      handler: input.handlers.POST,
      request: new Request(url, {
        method: 'POST',
        headers: {
          cookie: 'demo_session=DEMO-care-input',
          'content-type': 'application/json',
          'x-tenant-id': 'MOCK-input-tenant',
        },
        body: JSON.stringify({ ...input.createPayload, rawInput: 'DEMO-care-input' }),
      }),
      expected: input.expected,
    },
    {
      name: `${input.path} POST 非法 JSON 请求`,
      handler: input.handlers.POST,
      request: new Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad-json-DEMO-care-input',
      }),
      expected: input.expected,
    },
    {
      name: `${input.path} PATCH 普通 JSON 请求`,
      handler: input.handlers.PATCH,
      request: new Request(url, {
        method: 'PATCH',
        headers: {
          cookie: 'demo_session=DEMO-care-input',
          'content-type': 'application/json',
          'x-institution-id': 'MOCK-input-institution',
        },
        body: JSON.stringify({ ...input.updatePayload, rawInput: 'MOCK-care-input' }),
      }),
      expected: input.expected,
    },
    {
      name: `${input.path} PATCH 非法 JSON 请求`,
      handler: input.handlers.PATCH,
      request: new Request(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{bad-json-MOCK-care-input',
      }),
      expected: input.expected,
    },
  ];
}

const careRequestCases = [
  ...createCareRequestCases({
    path: 'appointments',
    handlers: {
      GET: appointmentsGet,
      POST: appointmentsPost,
      PATCH: appointmentsPatch,
    },
    expected: appointmentCapabilityDisabledPayload,
    createPayload: validCreateAppointmentPayload,
    updatePayload: validUpdateAppointmentPayload,
  }),
  ...createCareRequestCases({
    path: 'followups',
    handlers: {
      GET: followupsGet,
      POST: followupsPost,
      PATCH: followupsPatch,
    },
    expected: followUpCapabilityDisabledPayload,
    createPayload: validCreateFollowUpPayload,
    updatePayload: validFollowUpTransitionPayload,
  }),
];

function hostileCareValue(message: string) {
  const traps = { get: 0, ownKeys: 0, descriptor: 0, has: 0 };
  const value = new Proxy(Object.create(null), {
    get() {
      traps.get += 1;
      throw new Error(`${message} must not be read`);
    },
    getOwnPropertyDescriptor() {
      traps.descriptor += 1;
      throw new Error(`${message} must not be described`);
    },
    has() {
      traps.has += 1;
      throw new Error(`${message} must not be inspected`);
    },
    ownKeys() {
      traps.ownKeys += 1;
      throw new Error(`${message} must not be enumerated`);
    },
  });

  return { value, traps };
}

async function expectCareCapabilityDisabled(
  response: Response,
  expected: CareDisabledPayload,
) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(expected);
}

function expectNoCareRouteSideEffects() {
  expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
  expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
  expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
  expect(routeMocks.checkTenantQuotaForCreate).not.toHaveBeenCalled();
  expect(routeMocks.database.transaction).not.toHaveBeenCalled();
  expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  expect(routeMocks.recordFollowUpTaskStatusTimelineEvent).not.toHaveBeenCalled();
  expect(routeMocks.repository.listAppointmentsByTenant).not.toHaveBeenCalled();
  expect(routeMocks.repository.listFollowUpTasksByTenant).not.toHaveBeenCalled();
  expect(routeMocks.repository.customerExistsByTenant).not.toHaveBeenCalled();
  expect(routeMocks.repository.createAppointment).not.toHaveBeenCalled();
  expect(routeMocks.repository.updateAppointment).not.toHaveBeenCalled();
  expect(routeMocks.repository.transitionFollowUpTask).not.toHaveBeenCalled();
  expect(routeMocks.repository.createManualFollowUpTask).not.toHaveBeenCalled();
}

describe('预约与随访 API capability-off 路由', () => {
  it.each(careRequestCases)(
    '$name 固定返回无缓存 503，且不读取或回显输入',
    async ({ handler, request, expected }) => {
      const response = await handler(request);
      const responseCopy = response.clone();

      await expectCareCapabilityDisabled(response, expected);
      const serialized = JSON.stringify(await responseCopy.json());

      expect(request.bodyUsed).toBe(false);
      expect(serialized).not.toMatch(
        /mock|demo|input|tenant|institution|customer|appointment|followup|bad-json/iu,
      );
      expectNoCareRouteSideEffects();
    },
  );

  it.each([
    ['appointments GET', appointmentsGet, appointmentCapabilityDisabledPayload],
    ['appointments POST', appointmentsPost, appointmentCapabilityDisabledPayload],
    ['appointments PATCH', appointmentsPatch, appointmentCapabilityDisabledPayload],
    ['followups GET', followupsGet, followUpCapabilityDisabledPayload],
    ['followups POST', followupsPost, followUpCapabilityDisabledPayload],
    ['followups PATCH', followupsPatch, followUpCapabilityDisabledPayload],
  ] as const)('%s 对 hostile Request 和 params 零读取、零副作用', async (
    _name,
    handler,
    expected,
  ) => {
    const hostileRequest = hostileCareValue('request');
    const hostileContext = hostileCareValue('route context');

    await expectCareCapabilityDisabled(
      await (handler as CareRouteHandler)(
        hostileRequest.value as Request,
        hostileContext.value,
      ),
      expected,
    );

    expect(hostileRequest.traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0, has: 0 });
    expect(hostileContext.traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0, has: 0 });
    expectNoCareRouteSideEffects();
  });

  it('routes 只加载响应工具，不装配 session、数据库、repository、quota、audit 或 timeline', () => {
    for (const route of careRouteSources) {
      expect(route.source.split('\n').filter((line) => line.startsWith('import '))).toEqual([
        "import { NextResponse } from 'next/server';",
      ]);
      for (const method of ['GET', 'POST', 'PATCH']) {
        expect(route.source).toContain(`export function ${method}(_request: Request)`);
      }
      expect(route.source).not.toMatch(/\b_request\s*(?:\.|\[)/u);

      for (const forbiddenSource of [
        'request.json',
        'params',
        'access-context',
        'getDemoAccessContextFromRequest',
        'getDatabase',
        'tenant-business',
        'repository',
        'quota',
        'audit',
        'timeline',
        'parse',
        'globalThis',
        'crypto',
        'new URL',
        'searchParams',
        'fetch',
      ]) {
        expect(route.source).not.toContain(forbiddenSource);
      }
    }
  });
});
