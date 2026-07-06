import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as templatesGet } from '@/app/api/institution/followup-paths/templates/route';
import {
  GET as enrollmentsGet,
  POST as enrollmentsPost,
} from '@/app/api/institution/followup-paths/enrollments/route';
import { GET as enrollmentGet } from '@/app/api/institution/followup-paths/enrollments/[enrollmentId]/route';
import { POST as enrollmentCancelPost } from '@/app/api/institution/followup-paths/enrollments/[enrollmentId]/cancel/route';
import type { FollowUpPathEnrollmentDto } from '@/modules/institution/domain/followup-path-enrollment';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
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
    cancelFollowUpPathEnrollment: vi.fn(),
    createAuditEventRepository: vi.fn(() => ({ record: auditRecord })),
    createEnrollmentFromTreatmentSummary: vi.fn(),
    createTenantBusinessRepository: vi.fn(() => ({ repository: 'tenant-business' })),
    createTreatmentSummaryRepository: vi.fn(() => ({ repository: 'treatment-summary' })),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    getFollowUpPathEnrollment: vi.fn(),
    listFollowUpPathEnrollments: vi.fn(),
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

vi.mock('@/modules/audit/server/audit-event-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/audit/server/audit-event-repository')>();
  return {
    ...actual,
    createAuditEventRepository: routeMocks.createAuditEventRepository,
  };
});

vi.mock('@/modules/institution/server/tenant-business-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/institution/server/tenant-business-repository')>();
  return {
    ...actual,
    createTenantBusinessRepository: routeMocks.createTenantBusinessRepository,
  };
});

vi.mock('@/modules/institution/server/treatment-summary-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/institution/server/treatment-summary-repository')>();
  return {
    ...actual,
    createTreatmentSummaryRepository: routeMocks.createTreatmentSummaryRepository,
  };
});

vi.mock('@/modules/institution/server/followup-path-enrollment-service', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/followup-path-enrollment-service')
  >();
  return {
    ...actual,
    cancelFollowUpPathEnrollment: routeMocks.cancelFollowUpPathEnrollment,
    createEnrollmentFromTreatmentSummary: routeMocks.createEnrollmentFromTreatmentSummary,
    getFollowUpPathEnrollment: routeMocks.getFollowUpPathEnrollment,
    listFollowUpPathEnrollments: routeMocks.listFollowUpPathEnrollments,
  };
});

const tenantContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  institutionId: 'inst-001',
  source: 'demo_session',
};

const enrollmentRecord: FollowUpPathEnrollmentDto = {
  enrollmentId: 'enrollment_001',
  customerId: 'cust_001',
  customerDisplayName: '陈女士',
  templateKey: 'hydro_injection_care',
  status: 'active',
  stageCount: 3,
  taskCount: 3,
  dueAt: '2026-07-02T00:00:00.000Z',
  safeMessage: '路径任务需人工处理，不会主动向客户发送消息。',
  stages: [
    {
      nodeKey: 'hydro_injection_d1_check',
      stageKey: 'D1',
      dueAt: '2026-07-02T00:00:00.000Z',
      status: 'scheduled',
      followUpTaskId: 'task_001',
      handlerRole: 'medical_assistant',
      riskLevel: 'normal',
      safeMessage: '路径任务需人工处理，不会主动向客户发送消息。',
    },
  ],
  taskIds: ['task_001'],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  routeMocks.auditRecord.mockReset();
  routeMocks.auditRecord.mockResolvedValue(undefined);
  routeMocks.cancelFollowUpPathEnrollment.mockReset();
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.createEnrollmentFromTreatmentSummary.mockReset();
  routeMocks.createTenantBusinessRepository.mockClear();
  routeMocks.createTreatmentSummaryRepository.mockClear();
  routeMocks.database.transaction.mockReset();
  routeMocks.database.transaction.mockImplementation(async (operation) =>
    operation(routeMocks.transactionDatabase),
  );
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
  routeMocks.getFollowUpPathEnrollment.mockReset();
  routeMocks.listFollowUpPathEnrollments.mockReset();
});

describe('follow-up path enrollment API routes', () => {
  it('GET templates 返回模板目录且不暴露敏感字段', async () => {
    const response = await templatesGet(request('/api/institution/followup-paths/templates'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ templateKey: 'hydro_injection_care' }),
        expect.objectContaining({ templateKey: 'photoelectric_care' }),
        expect.objectContaining({ templateKey: 'post_surgery_repair' }),
      ]),
    );
    expect(JSON.stringify(payload)).not.toContain('tenantId');
    expect(JSON.stringify(payload)).not.toContain('DATABASE_URL');
  });

  it('GET enrollments 按租户和机构上下文列出低敏路径实例', async () => {
    routeMocks.listFollowUpPathEnrollments.mockResolvedValue({
      kind: 'success',
      enrollments: [enrollmentRecord],
    });

    const response = await enrollmentsGet(request('/api/institution/followup-paths/enrollments'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.records).toEqual([enrollmentRecord]);
    expect(routeMocks.listFollowUpPathEnrollments).toHaveBeenCalledWith(
      expect.objectContaining({ context: tenantContext }),
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'allowed', resource: 'follow_up' }),
    );
    expect(JSON.stringify(payload)).not.toContain('institutionId');
    expect(JSON.stringify(payload)).not.toContain('完整治疗记录正文');
  });

  it('POST enrollments 支持治疗摘要纳入并只接收白名单字段', async () => {
    routeMocks.createEnrollmentFromTreatmentSummary.mockResolvedValue({
      kind: 'created',
      enrollment: enrollmentRecord,
    });

    const response = await enrollmentsPost(
      request('/api/institution/followup-paths/enrollments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'treatment_summary',
          sourceId: 'summary_001',
          templateKey: 'hydro_injection_care',
        }),
      }),
    );
    const payload = await json(response);

    expect(response.status).toBe(201);
    expect(payload.record).toEqual(enrollmentRecord);
    expect(routeMocks.createEnrollmentFromTreatmentSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        context: tenantContext,
        sourceId: 'summary_001',
        templateKey: 'hydro_injection_care',
      }),
    );
  });

  it('POST enrollments 对重复纳入返回低敏 conflict 且不创建重复任务', async () => {
    routeMocks.createEnrollmentFromTreatmentSummary.mockResolvedValue({
      kind: 'conflict',
      resourceId: 'enrollment_001',
      reason: 'active_follow_up_path_enrollment_exists',
    });

    const response = await enrollmentsPost(
      request('/api/institution/followup-paths/enrollments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceType: 'treatment_summary', sourceId: 'summary_001' }),
      }),
    );
    const payload = await json(response);

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      code: 'active_follow_up_path_enrollment_exists',
      error: '该治疗摘要已纳入当前路径，请刷新后查看',
    });
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'denied',
        reason: 'active_follow_up_path_enrollment_exists',
      }),
    );
  });

  it('GET enrollment detail 和 cancel 都按 enrollmentId 返回低敏 DTO', async () => {
    routeMocks.getFollowUpPathEnrollment.mockResolvedValue({
      kind: 'success',
      enrollment: enrollmentRecord,
    });
    routeMocks.cancelFollowUpPathEnrollment.mockResolvedValue({
      kind: 'cancelled',
      enrollment: { ...enrollmentRecord, status: 'cancelled' },
    });

    const detailResponse = await enrollmentGet(
      request('/api/institution/followup-paths/enrollments/enrollment_001'),
      { params: Promise.resolve({ enrollmentId: 'enrollment_001' }) },
    );
    const cancelResponse = await enrollmentCancelPost(
      request('/api/institution/followup-paths/enrollments/enrollment_001/cancel', {
        method: 'POST',
      }),
      { params: Promise.resolve({ enrollmentId: 'enrollment_001' }) },
    );

    expect(detailResponse.status).toBe(200);
    expect(await json(detailResponse)).toEqual({ record: enrollmentRecord });
    expect(cancelResponse.status).toBe(200);
    expect(await json(cancelResponse)).toEqual({
      record: { ...enrollmentRecord, status: 'cancelled' },
    });
    expect(routeMocks.getFollowUpPathEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({ enrollmentId: 'enrollment_001' }),
    );
    expect(routeMocks.cancelFollowUpPathEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({ enrollmentId: 'enrollment_001' }),
    );
  });
});
