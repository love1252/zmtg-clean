import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as treatmentSummariesGet } from '@/app/api/institution/treatment-summaries/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const treatmentSummaryRepository = {
    listTreatmentSummariesByTenant: vi.fn(),
  };
  const auditRecord = vi.fn();
  const database = { database: 'test-db' };

  return {
    auditRecord,
    createAuditEventRepository: vi.fn(() => ({ record: auditRecord })),
    createTreatmentSummaryRepository: vi.fn(() => treatmentSummaryRepository),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    treatmentSummaryRepository,
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

vi.mock('@/modules/institution/server/treatment-summary-repository', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/treatment-summary-repository')
  >();
  return {
    ...actual,
    createTreatmentSummaryRepository: routeMocks.createTreatmentSummaryRepository,
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

const treatmentSummaryListItem = {
  id: 'trt_001',
  customerId: 'cust_qin_review',
  appointmentId: 'appt_qin_arrived',
  treatmentDate: '2026-05-30T03:45:00.000Z',
  treatmentProject: '玻尿酸复诊',
  treatmentCategory: 'injection_review',
  treatmentStage: 'D7 复诊',
  recoveryStage: 'D7',
  riskLevel: 'watch',
  ownerUserId: 'doctor-lin',
  summary: '结构化摘要：恢复进展稳定，安排补水护理观察。',
  nextCareAction: 'D14 人工回访恢复阶段。',
  tags: ['结构化摘要', '复诊'],
  createdAt: '2026-05-30T03:45:00.000Z',
  updatedAt: '2026-05-30T03:45:00.000Z',
  tenantId: 'demo-tenant-001',
  phoneNumber: '13800000000',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR-RAW-001',
  treatmentRecord: '完整治疗记录正文',
  medicalRecordBody: '完整病历正文',
  diagnosisText: '诊疗原文',
  consultationTranscript: '咨询对话全文',
  requestBody: { token: 'sk_test_should_not_return' },
  sql: 'select * from treatment_summaries',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
};

function getRequest(path = 'http://localhost/api/institution/treatment-summaries', init?: RequestInit) {
  return new Request(path, {
    method: 'GET',
    headers: { 'x-tenant-id': 'other-tenant', ...(init?.headers ?? {}) },
    ...init,
  });
}

function expectNoPrivateData(payload: unknown, options: { allowAuditTenant?: boolean } = {}) {
  const serialized = JSON.stringify(payload);

  if (!options.allowAuditTenant) {
    expect(serialized).not.toContain('tenantId');
  }

  expect(serialized).not.toContain('13800000000');
  expect(serialized).not.toContain('110101199001010011');
  expect(serialized).not.toContain('MR-RAW-001');
  expect(serialized).not.toContain('完整治疗记录正文');
  expect(serialized).not.toContain('完整病历正文');
  expect(serialized).not.toContain('诊疗原文');
  expect(serialized).not.toContain('咨询对话全文');
  expect(serialized).not.toContain('requestBody');
  expect(serialized).not.toContain('select * from treatment_summaries');
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
  routeMocks.createTreatmentSummaryRepository.mockClear();
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.auditRecord.mockReset();
  routeMocks.auditRecord.mockResolvedValue(undefined);
  routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenant.mockReset();
  routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenant.mockResolvedValue({
    records: [treatmentSummaryListItem],
    pageInfo: {
      hasMore: false,
      limit: 50,
      nextCursor: null,
    },
  });
});

describe('机构端治疗摘要列表 API route', () => {
  it('成功返回当前租户治疗摘要列表、安全 DTO 和 allowed audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await treatmentSummariesGet(
      getRequest(
        'http://localhost/api/institution/treatment-summaries?customerId=cust_qin_review&treatmentProject=%E7%8E%BB%E5%B0%BF%E9%85%B8%E5%A4%8D%E8%AF%8A&riskLevel=watch&from=2026-05-30T08%3A00%3A00%2B08%3A00&to=2026-06-01T18%3A00%3A00%2B08%3A00&limit=25',
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      records: [
        {
          id: 'trt_001',
          customerId: 'cust_qin_review',
          appointmentId: 'appt_qin_arrived',
          treatmentDate: '2026-05-30T03:45:00.000Z',
          treatmentProject: '玻尿酸复诊',
          treatmentCategory: 'injection_review',
          treatmentStage: 'D7 复诊',
          recoveryStage: 'D7',
          riskLevel: 'watch',
          ownerUserId: 'doctor-lin',
          summary: '结构化摘要：恢复进展稳定，安排补水护理观察。',
          nextCareAction: 'D14 人工回访恢复阶段。',
          tags: ['结构化摘要', '复诊'],
          createdAt: '2026-05-30T03:45:00.000Z',
          updatedAt: '2026-05-30T03:45:00.000Z',
        },
      ],
      pageInfo: {
        hasMore: false,
        limit: 50,
        nextCursor: null,
      },
    });
    expectNoPrivateData(payload);
    expect(routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      query: {
        filters: {
          customerId: 'cust_qin_review',
          treatmentProject: '玻尿酸复诊',
          riskLevel: 'watch',
          from: '2026-05-30T00:00:00.000Z',
          to: '2026-06-01T10:00:00.000Z',
        },
        limit: 25,
      },
    });
    expect(routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenant).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'other-tenant' }),
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'read_own_tenant',
      reason: 'allowed_by_policy',
      resource: 'treatment_summary',
      result: 'allowed',
      tenantId: 'demo-tenant-001',
    }));
    expectNoPrivateData(routeMocks.auditRecord.mock.lastCall?.[0], { allowAuditTenant: true });
  });

  it('未登录返回 401，且不初始化数据库', async () => {
    const response = await treatmentSummariesGet(getRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenant).not.toHaveBeenCalled();
  });

  it('无权限返回 403，写 denied audit，且不查询治疗摘要', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await treatmentSummariesGet(getRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenant).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'read_own_tenant',
      reason: 'role_denied',
      resource: 'treatment_summary',
      result: 'denied',
    }));
    expectNoPrivateData(routeMocks.auditRecord.mock.lastCall?.[0], { allowAuditTenant: true });
  });

  it('前端传入 tenantId 返回 400，且不会用 query 或 header 切换租户', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await treatmentSummariesGet(
      getRequest('http://localhost/api/institution/treatment-summaries?tenantId=other-tenant'),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: '不支持的筛选参数: tenantId' });
    expect(routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenant).not.toHaveBeenCalled();
    expectNoPrivateData(payload, { allowAuditTenant: true });
  });

  it('默认 limit、最大 limit 和空结果返回稳定 pageInfo', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenant.mockResolvedValueOnce({
      records: [],
      pageInfo: {
        hasMore: false,
        limit: 100,
        nextCursor: null,
      },
    });

    const response = await treatmentSummariesGet(
      getRequest('http://localhost/api/institution/treatment-summaries?limit=100'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      records: [],
      pageInfo: {
        hasMore: false,
        limit: 100,
        nextCursor: null,
      },
    });
    expect(routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      query: {
        filters: {},
        limit: 100,
      },
    });
  });

  it('非法筛选参数返回 400，错误响应不泄露敏感信息', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await treatmentSummariesGet(
      getRequest('http://localhost/api/institution/treatment-summaries?treatmentProject=DATABASE_URL%3Dpostgres%3A%2F%2Fexample'),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: 'treatmentProject 不允许包含敏感信息' });
    expect(routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenant).not.toHaveBeenCalled();
    expectNoPrivateData(payload, { allowAuditTenant: true });
  });

  it('数据服务异常返回稳定 503，错误响应不泄露 SQL、stack、token、secret 或连接串', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenant.mockRejectedValueOnce(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg token stack'),
    );

    const response = await treatmentSummariesGet(getRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expectNoPrivateData(payload);
  });
});
