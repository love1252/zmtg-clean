import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GET,
  POST,
} from '@/app/api/institution/wecom-customer-mapping/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const customerRepository = {
    getCustomerByTenantAndInstitution: vi.fn(),
    listCustomersByTenantAndInstitution: vi.fn(),
  };
  const mappingRepository = {
    findByScope: vi.fn(),
    createIfAbsent: vi.fn(),
    updateWhenCurrentStatus: vi.fn(),
  };
  const auditRepository = { record: vi.fn() };
  const transactionDatabase = { name: 'transaction-db' };
  const database = {
    transaction: vi.fn(async (operation: (database: typeof transactionDatabase) => unknown) =>
      operation(transactionDatabase),
    ),
  };

  return {
    auditRepository,
    createAuditEventRepository: vi.fn(() => auditRepository),
    createTenantBusinessRepository: vi.fn(() => customerRepository),
    createWeComCustomerMappingRepository: vi.fn(() => mappingRepository),
    customerRepository,
    database,
    getDatabase: vi.fn(() => database),
    getDemoAccessContextFromRequest: vi.fn(),
    mappingRepository,
    transactionDatabase,
  };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return { ...actual, getDatabase: routeMocks.getDatabase };
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

vi.mock('@/modules/institution/server/wecom-customer-mapping-repository', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/wecom-customer-mapping-repository')
  >();
  return {
    ...actual,
    createWeComCustomerMappingRepository: routeMocks.createWeComCustomerMappingRepository,
  };
});

vi.mock('@/modules/audit/server/audit-event-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/audit/server/audit-event-repository')>();
  return {
    ...actual,
    createAuditEventRepository: routeMocks.createAuditEventRepository,
  };
});

const adminContext: AccessContext = {
  userId: 'admin-a',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-a',
  institutionId: 'inst-a',
  source: 'demo_session',
};

const operatorContext: AccessContext = {
  ...adminContext,
  userId: 'operator-a',
  role: 'tenant_operator',
};

function customer(id: string) {
  return {
    id,
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    displayName: `客户 ${id}`,
    lifecycle: 'consulting',
    priority: 'high',
    ownerUserId: 'owner-a',
    projectInterest: '项目',
    maskedPhone: '138****0000',
    maskedMedicalRecordNo: 'MR-***-01',
    lastTouchSummary: '低敏摘要',
    nextAction: '人工处理',
    tags: [],
    gender: '',
    birthDate: '',
    referralSource: '',
    notes: '',
  };
}

function state(status: 'confirmed' | 'rejected' | 'revoked' = 'confirmed', customerId = 'customer-a') {
  return {
    id: 'mapping-a',
    tenantId: 'tenant-a',
    institutionId: 'inst-a',
    proofContactId: 'live-contact-proof-01',
    proofEmployeeId: 'live-employee-proof-01',
    sourceMode: 'real_readonly_proof',
    customerId,
    status,
    decidedBy: 'admin-a',
    decidedAt: '2026-07-10T08:00:00.000Z',
    createdAt: '2026-07-10T08:00:00.000Z',
    updatedAt: '2026-07-10T08:00:00.000Z',
  };
}

function getRequest() {
  return new Request('http://localhost/api/institution/wecom-customer-mapping');
}

function postRequest(body: unknown, headers?: HeadersInit) {
  return new Request('http://localhost/api/institution/wecom-customer-mapping', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function validBody(action: 'confirm' | 'reject' | 'revoke' = 'confirm') {
  return {
    action,
    proofContactId: 'live-contact-proof-01',
    customerId: 'customer-a',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(adminContext);
  routeMocks.customerRepository.listCustomersByTenantAndInstitution.mockResolvedValue([
    customer('customer-a'),
  ]);
  routeMocks.customerRepository.getCustomerByTenantAndInstitution.mockImplementation(
    async ({ id }: { id: string }) => customer(id),
  );
  routeMocks.mappingRepository.findByScope.mockResolvedValue(null);
  routeMocks.mappingRepository.createIfAbsent.mockImplementation(async (input) =>
    state(input.status, input.customerId),
  );
  routeMocks.mappingRepository.updateWhenCurrentStatus.mockImplementation(async (input) =>
    state(input.status, input.customerId),
  );
  routeMocks.auditRepository.record.mockResolvedValue(undefined);
  routeMocks.database.transaction.mockImplementation(async (operation) =>
    operation(routeMocks.transactionDatabase),
  );
});

describe('WeCom customer mapping API route', () => {
  it('GET 未登录返回 401，customer/read 无权限返回 403', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(null).mockReturnValueOnce({
      ...adminContext,
      role: 'platform_admin',
      scope: 'platform',
      tenantId: null,
      institutionId: null,
    });

    const unauthenticated = await GET(getRequest());
    const forbidden = await GET(getRequest());

    expect(unauthenticated.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('tenant_operator 可读，返回 canWrite=false、固定 proof 和最多 20 条机构候选', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(operatorContext);

    const response = await GET(getRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.canWrite).toBe(false);
    expect(payload.mapping).toEqual({
      proofContactId: 'live-contact-proof-01',
      proofEmployeeId: 'live-employee-proof-01',
      sourceMode: 'real_readonly_proof',
      status: 'unreviewed',
      customerId: null,
    });
    expect(routeMocks.customerRepository.listCustomersByTenantAndInstitution).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      limit: 20,
    });
  });

  it('GET 当前映射客户不在候选中时单独返回低敏摘要', async () => {
    routeMocks.mappingRepository.findByScope.mockResolvedValue(state('confirmed', 'customer-z'));

    const response = await GET(getRequest());
    const payload = await response.json();

    expect(payload.currentCustomer.customerId).toBe('customer-z');
    expect(routeMocks.customerRepository.getCustomerByTenantAndInstitution).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      institutionId: 'inst-a',
      id: 'customer-z',
    });
  });

  it('tenant_operator POST 返回 403 且不读 body、不进入事务', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(operatorContext);
    const response = await POST(postRequest(validBody()));

    expect(response.status).toBe(403);
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
    expect(routeMocks.auditRepository.record).not.toHaveBeenCalled();
  });

  it('未登录 POST 返回 401 且不读 body、不进入事务', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    const request = postRequest(validBody());
    const textSpy = vi.spyOn(request, 'text');

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(textSpy).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
    expect(routeMocks.auditRepository.record).not.toHaveBeenCalled();
  });

  it('POST 拒绝超过 512 bytes 和额外字段', async () => {
    const oversized = await POST(postRequest(validBody(), { 'content-length': '513' }));
    const extraField = await POST(postRequest({ ...validBody(), tenantId: 'other-tenant' }));

    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toMatchObject({ code: 'body_too_large' });
    expect(extraField.status).toBe(400);
    await expect(extraField.json()).resolves.toMatchObject({ code: 'invalid_request' });
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
  });

  it('POST 请求体按 UTF-8 字节限制，多字节中文超过 512 bytes 时阻断', async () => {
    const body = { ...validBody(), customerId: '客'.repeat(150) };
    expect(new TextEncoder().encode(JSON.stringify(body)).byteLength).toBeGreaterThan(512);

    const response = await POST(postRequest(body));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'body_too_large' });
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
  });

  it('POST 严格校验固定 proofContactId', async () => {
    const response = await POST(
      postRequest({ ...validBody(), proofContactId: 'live-contact-proof-02' }),
    );

    expect(response.status).toBe(400);
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['confirm', 'confirmed'],
    ['reject', 'rejected'],
  ] as const)('POST %s 在事务内写状态和成功 audit', async (action, expectedStatus) => {
    const response = await POST(postRequest(validBody(action)));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.outcome).toBe('updated');
    expect(payload.mapping.status).toBe(expectedStatus);
    expect(routeMocks.database.transaction).toHaveBeenCalledOnce();
    expect(routeMocks.createWeComCustomerMappingRepository).toHaveBeenCalledWith(
      routeMocks.transactionDatabase,
    );
    expect(routeMocks.createAuditEventRepository).toHaveBeenCalledWith(
      routeMocks.transactionDatabase,
    );
    expect(routeMocks.auditRepository.record).toHaveBeenCalledOnce();
  });

  it('POST 同客户操作返回 idempotent', async () => {
    routeMocks.mappingRepository.findByScope.mockResolvedValue(state('confirmed'));

    const response = await POST(postRequest(validBody('confirm')));
    const payload = await response.json();

    expect(payload.outcome).toBe('idempotent');
    expect(routeMocks.mappingRepository.createIfAbsent).not.toHaveBeenCalled();
    expect(routeMocks.mappingRepository.updateWhenCurrentStatus).not.toHaveBeenCalled();
  });

  it('POST stale update 返回 409 conflict 并在同事务记录 blocked audit', async () => {
    routeMocks.mappingRepository.findByScope.mockResolvedValue(state('revoked'));
    routeMocks.mappingRepository.updateWhenCurrentStatus.mockResolvedValue(null);

    const response = await POST(postRequest(validBody('confirm')));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.code).toBe('conflict');
    expect(routeMocks.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'wecom_customer_mapping_conflict_blocked' }),
    );
  });

  it('不存在或跨机构 customerId 对外统一 customer_not_found，不泄露存在性', async () => {
    routeMocks.customerRepository.getCustomerByTenantAndInstitution.mockResolvedValue(null);

    const response = await POST(
      postRequest({ ...validBody(), customerId: 'other-institution-customer' }),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({
      code: 'customer_not_found',
      error: '客户不存在或不属于当前机构',
    });
    expect(routeMocks.auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'customer',
        reason: 'wecom_customer_mapping_customer_not_found',
      }),
    );
    const [audit] = routeMocks.auditRepository.record.mock.calls[0];
    expect(audit).not.toHaveProperty('resourceId');
  });

  it('响应和 audit 不含企业微信原始标识或 secret，服务端不调用 fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await POST(postRequest(validBody()));
    const serialized = JSON.stringify(await response.json());
    const auditSerialized = JSON.stringify(routeMocks.auditRepository.record.mock.calls);

    expect(`${serialized}${auditSerialized}`).not.toMatch(
      /external_userid|UserID|corpId|Secret|token|rawResponse/i,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('audit 失败使事务拒绝，API 不返回成功状态', async () => {
    routeMocks.auditRepository.record.mockRejectedValue(new Error('audit unavailable'));

    const response = await POST(postRequest(validBody()));

    expect(response.status).toBe(503);
    expect(routeMocks.database.transaction).toHaveBeenCalledOnce();
  });
});
