import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  POST as customerImportPreviewPost,
  PUT as customerImportExecutePut,
} from '@/app/api/institution/customers/import/route';
import type { CustomerRecordSummary } from '@/modules/institution/domain/customer-records';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const repository = {
    listCustomersByTenant: vi.fn(),
    createCustomer: vi.fn(),
  };
  const auditRecord = vi.fn();
  const checkTenantQuotaForUsage = vi.fn();
  const transactionDatabase = { database: 'transaction-db' };
  const database = {
    database: 'test-db',
    transaction: vi.fn(async (operation: (tx: typeof transactionDatabase) => unknown) =>
      operation(transactionDatabase),
    ),
  };

  return {
    auditRecord,
    checkTenantQuotaForUsage,
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
    checkTenantQuotaForUsage: routeMocks.checkTenantQuotaForUsage,
  };
});

const tenantContext: AccessContext = {
  userId: 'tenant-operator-a',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-a',
  institutionId: 'inst-a',
  source: 'demo_session',
};

const platformContext: AccessContext = {
  userId: 'platform-admin',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const validLowSensitiveRow = {
  customerDisplayName: '低敏客户A',
  ageRange: '30-39',
  customerStage: 'consulting',
  treatmentProject: '皮肤管理',
  lastVisitDate: '2026-07-01',
  nextFollowUpDate: '2026-07-15',
  ownerEmployeeRef: 'employee-ref-a',
  sourceChannel: '线下咨询低敏来源',
  noteSummary: '仅导入低敏摘要',
  importedCustomerRef: 'import-ref-a',
};

function createRequest(body: unknown) {
  return new Request('http://localhost/api/institution/customers/import?tenantId=evil-tenant', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': 'evil-tenant',
    },
    body: JSON.stringify(body),
  });
}

function createExistingCustomer(overrides: Partial<CustomerRecordSummary> = {}): CustomerRecordSummary {
  return {
    id: 'cust_existing',
    tenantId: 'tenant-a',
    displayName: '低敏客户A',
    lifecycle: 'consulting',
    priority: 'observe',
    ownerUserId: 'employee-ref-a',
    projectInterest: '皮肤管理',
    maskedPhone: 'masked-import-only',
    maskedMedicalRecordNo: 'masked-import-record',
    lastTouchSummary: '最近到访:2026-07-01',
    nextAction: '下次随访:2026-07-15',
    tags: ['低敏导入', 'institution_ref:inst-a', 'imported_ref:import-ref-a'],
    gender: '未指定',
    birthDate: '低敏年龄:30-39',
    referralSource: '线下咨询低敏来源',
    notes: 'importBatch:batch-a；importedCustomerRef:import-ref-a',
    ...overrides,
  };
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.database.transaction.mockReset();
  routeMocks.database.transaction.mockImplementation(async (operation) =>
    operation(routeMocks.transactionDatabase),
  );
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
  routeMocks.createTenantBusinessRepository.mockClear();
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.auditRecord.mockReset();
  routeMocks.auditRecord.mockResolvedValue(undefined);
  routeMocks.checkTenantQuotaForUsage.mockReset();
  routeMocks.checkTenantQuotaForUsage.mockResolvedValue({
    allowed: true,
    current: 1,
    limit: 5000,
    resource: 'customers',
  });
  routeMocks.repository.listCustomersByTenant.mockReset();
  routeMocks.repository.listCustomersByTenant.mockResolvedValue([]);
  routeMocks.repository.createCustomer.mockReset();
  routeMocks.repository.createCustomer.mockImplementation(async (draft: { id: string }) => ({
    ...draft,
    id: draft.id,
  }));
});

describe('customer import API route', () => {
  it('未登录时 POST / PUT 返回 401 受控错误且不访问数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const previewResponse = await customerImportPreviewPost(createRequest({ rows: [validLowSensitiveRow] }));
    const executeResponse = await customerImportExecutePut(createRequest({ rows: [validLowSensitiveRow] }));

    await expect(readJson(previewResponse)).resolves.toMatchObject({ error: '请先登录' });
    await expect(readJson(executeResponse)).resolves.toMatchObject({ error: '请先登录' });
    expect(previewResponse.status).toBe(401);
    expect(executeResponse.status).toBe(401);
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.repository.createCustomer).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('POST 预检返回低敏统计、白名单和审计，不写入客户', async () => {
    const response = await customerImportPreviewPost(createRequest({ rows: [validLowSensitiveRow] }));
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.successCount).toBe(1);
    expect(payload.canExecute).toBe(true);
    expect(routeMocks.repository.listCustomersByTenant).toHaveBeenCalledWith('tenant-a');
    expect(routeMocks.repository.createCustomer).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'tenant-operator-a',
        tenantId: 'tenant-a',
        resource: 'customer',
        action: 'import',
        result: 'allowed',
        reason: 'customer_import_permission_checked',
      }),
    );
    expect(JSON.stringify(payload)).not.toContain('evil-tenant');
  });

  it('拒绝 body 中提交 tenantId / institutionId / operatorRef', async () => {
    const response = await customerImportPreviewPost(
      createRequest({ tenantId: 'evil-tenant', rows: [validLowSensitiveRow] }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload.error).toContain('不允许提交 tenantId');
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('POST 预检阻断高敏字段并写入高敏阻断审计 reason', async () => {
    const response = await customerImportPreviewPost(
      createRequest({
        rows: [
          {
            ...validLowSensitiveRow,
            phoneNumber: '13800000000',
            chatRecord: '聊天记录',
            accessToken: 'zmtg_sk_secret_token',
          },
        ],
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.successCount).toBe(0);
    expect(payload.skippedCount).toBe(1);
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'denied',
        reason: 'customer_import_sensitive_field_blocked',
      }),
    );
    expect(JSON.stringify(payload)).not.toContain('phoneNumber');
    expect(JSON.stringify(payload)).not.toContain('chatRecord');
    expect(JSON.stringify(payload)).not.toContain('accessToken');
    expect(JSON.stringify(payload)).not.toContain('13800000000');
    expect(JSON.stringify(payload)).not.toContain('zmtg_sk_secret_token');
    expect(JSON.stringify(payload)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(payload)).not.toContain('postgres://');
  });

  it('PUT 执行仅写入合法行，非法行跳过并记录部分完成审计', async () => {
    const response = await customerImportExecutePut(
      createRequest({
        rows: [
          validLowSensitiveRow,
          { ...validLowSensitiveRow, customerDisplayName: '', importedCustomerRef: 'bad-row' },
        ],
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.successCount).toBe(1);
    expect(payload.skippedCount).toBe(1);
    expect(Array.isArray(payload.importedCustomerIds)).toBe(true);
    expect(routeMocks.checkTenantQuotaForUsage).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', resource: 'customers', quantity: 1 }),
    );
    expect(routeMocks.repository.createCustomer).toHaveBeenCalledTimes(1);
    expect(routeMocks.repository.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        displayName: '低敏客户A',
        maskedPhone: 'masked-import-only',
        maskedMedicalRecordNo: 'masked-import-record',
        tags: expect.arrayContaining(['低敏导入', 'institution_ref:inst-a']),
      }),
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'customer_import_partially_completed' }),
    );
  });

  it('同机构重复客户候选执行返回受控错误且不写入客户', async () => {
    routeMocks.repository.listCustomersByTenant.mockResolvedValue([createExistingCustomer()]);

    const response = await customerImportExecutePut(createRequest({ rows: [validLowSensitiveRow] }));
    const payload = await readJson(response);

    expect(response.status).toBe(409);
    expect(payload.successCount).toBe(0);
    expect(routeMocks.repository.createCustomer).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'denied', reason: 'customer_import_rejected' }),
    );
  });

  it('普通员工不能导入或导出客户', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue({
      ...tenantContext,
      userId: 'staff-user',
      role: 'customer_service',
    });

    const response = await customerImportPreviewPost(createRequest({ rows: [validLowSensitiveRow] }));
    const payload = await readJson(response);

    expect(response.status).toBe(403);
    expect(payload.error).toBe('没有访问权限');
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('非租户上下文不能访问导入 API', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await customerImportPreviewPost(createRequest({ rows: [validLowSensitiveRow] }));
    const payload = await readJson(response);

    expect(response.status).toBe(403);
    expect(payload.error).toBe('没有访问权限');
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });
});
