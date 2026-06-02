import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as customerTimelineGet } from '@/app/api/institution/customers/[customerId]/timeline/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const repository = {
    getCustomerByTenant: vi.fn(),
    listAppointmentsByTenantAndCustomer: vi.fn(),
    listFollowUpTasksByTenantAndCustomer: vi.fn(),
  };
  const auditRepository = {
    listCustomerAuditEventsByResourceId: vi.fn(),
  };
  const treatmentSummaryRepository = {
    listTreatmentSummariesByTenantAndCustomer: vi.fn(),
  };
  const database = { database: 'test-db' };

  return {
    auditRepository,
    createAuditEventRepository: vi.fn(() => auditRepository),
    createTenantBusinessRepository: vi.fn(() => repository),
    createTreatmentSummaryRepository: vi.fn(() => treatmentSummaryRepository),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    repository,
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

vi.mock('@/modules/institution/server/treatment-summary-repository', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/treatment-summary-repository')
  >();
  return {
    ...actual,
    createTreatmentSummaryRepository: routeMocks.createTreatmentSummaryRepository,
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

const customerRecord = {
  id: 'cust_001',
  tenantId: 'demo-tenant-001',
  displayName: '王女士',
  lifecycle: 'repurchase_window',
  priority: 'high',
  ownerUserId: 'consultant-lin',
  projectInterest: '热玛吉修复组合',
  maskedPhone: '138****1208',
  maskedMedicalRecordNo: 'MR****001',
  lastTouchSummary: '术后第 28 天',
  nextAction: '人工回访',
  tags: ['高价值'],
  phoneNumber: '13800000000',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR-RAW-001',
  treatmentRecord: '完整治疗记录正文',
  consultationTranscript: '咨询对话全文',
};

const appointmentRecord = {
  id: 'appt_001',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_001',
  customerDisplayName: '王女士',
  project: '水光补水',
  scheduledAt: '2026-06-02T02:30:00.000Z',
  consultantUserId: 'consultant-xu',
  status: 'confirmed',
  note: '已确认到院',
  requestBody: { tenantId: 'other-tenant' },
};

const followUpRecord = {
  id: 'fu_001',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_001',
  customerDisplayName: '王女士',
  journeyId: 'journey_repurchase',
  stage: 'D28 复购建议',
  status: 'due',
  dueAt: '2026-06-01T10:00:00.000Z',
  suggestedAction: '人工回访',
  riskLevel: 'urgent',
  updatedBy: null,
  updatedAt: null,
  sql: 'select * from customers',
};

const auditEventSummary = {
  id: 'audit_evt_001',
  action: 'update',
  result: 'allowed',
  reason: 'allowed_by_policy',
  actor: { id: 'demo-user-admin', role: 'tenant_admin' },
  occurredAt: '2026-06-03T09:00:00.000Z',
  resource: 'customer',
  resourceId: 'cust_001',
  metadata: { requestBody: { phoneNumber: '13800000000' } },
  stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
};

const treatmentSummaryRecord = {
  id: 'trt_001',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_001',
  appointmentId: 'appt_001',
  treatmentDate: '2026-06-01T12:00:00.000Z',
  treatmentProject: '光电修复',
  treatmentCategory: 'laser_repair',
  treatmentStage: 'D7 复诊',
  recoveryStage: 'D7',
  riskLevel: 'watch',
  ownerUserId: 'doctor-lin',
  summary: '结构化摘要：红肿减轻，安排补水护理。',
  nextCareAction: 'D14 人工回访恢复阶段。',
  tags: ['结构化摘要', '术后关怀'],
  status: 'active',
  voidedAt: null,
  voidedBy: null,
  voidReasonCode: null,
  voidReason: null,
  createdAt: '2026-06-01T12:00:00.000Z',
  updatedAt: '2026-06-01T12:00:00.000Z',
  treatmentRecord: '完整治疗记录正文',
  medicalRecordBody: '完整病历正文',
  consultationTranscript: '咨询对话全文',
  sql: 'select * from treatment_summaries',
  stack: 'blocked-stack-value',
};

const voidedTreatmentSummaryRecord = {
  ...treatmentSummaryRecord,
  id: 'trt_voided_001',
  treatmentProject: '光电修复作废记录',
  treatmentStage: 'D7 复核',
  summary: '结构化摘要：误录入，保留历史追溯。',
  status: 'voided',
  voidedAt: '2026-06-02T13:00:00.000Z',
  voidedBy: 'demo-user-admin',
  voidReasonCode: 'duplicate_summary',
  voidReason: '重复录入，保留较新的治疗摘要',
  updatedAt: '2026-06-02T13:00:00.000Z',
};

function routeContext(customerId = 'cust_001') {
  return { params: Promise.resolve({ customerId }) };
}

function timelineRequest(
  path = 'http://localhost/api/institution/customers/cust_001/timeline',
  init?: RequestInit,
) {
  return new Request(path, init);
}

function expectNoPrivateData(payload: unknown) {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain('tenantId');
  expect(serialized).not.toContain('customerId');
  expect(serialized).not.toContain('13800000000');
  expect(serialized).not.toContain('110101199001010011');
  expect(serialized).not.toContain('MR-RAW-001');
  expect(serialized).not.toContain('完整治疗记录正文');
  expect(serialized).not.toContain('完整病历正文');
  expect(serialized).not.toContain('咨询对话全文');
  expect(serialized).not.toContain('requestBody');
  expect(serialized).not.toContain('metadata');
  expect(serialized).not.toContain('select * from customers');
  expect(serialized).not.toContain('select * from treatment_summaries');
  expect(serialized).not.toContain('DATABASE_URL');
  expect(serialized).not.toContain('postgres://');
  expect(serialized).not.toContain('blocked-stack-value');
  expect(serialized).not.toContain('sk_test');
  expect(serialized).not.toContain('access_token');
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.createTenantBusinessRepository.mockClear();
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.createTreatmentSummaryRepository.mockClear();
  routeMocks.repository.getCustomerByTenant.mockReset();
  routeMocks.repository.getCustomerByTenant.mockResolvedValue(customerRecord);
  routeMocks.repository.listAppointmentsByTenantAndCustomer.mockReset();
  routeMocks.repository.listAppointmentsByTenantAndCustomer.mockResolvedValue([appointmentRecord]);
  routeMocks.repository.listFollowUpTasksByTenantAndCustomer.mockReset();
  routeMocks.repository.listFollowUpTasksByTenantAndCustomer.mockResolvedValue([followUpRecord]);
  routeMocks.auditRepository.listCustomerAuditEventsByResourceId.mockReset();
  routeMocks.auditRepository.listCustomerAuditEventsByResourceId.mockResolvedValue([
    auditEventSummary,
  ]);
  routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenantAndCustomer.mockReset();
  routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenantAndCustomer.mockResolvedValue(
    [treatmentSummaryRecord],
  );
});

describe('客户详情 timeline API', () => {
  it('成功返回客户、预约、随访、治疗摘要、审计和结构化 timeline 摘要', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await customerTimelineGet(timelineRequest(), routeContext());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(routeMocks.repository.getCustomerByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'cust_001',
    });
    expect(routeMocks.repository.listAppointmentsByTenantAndCustomer).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
    });
    expect(routeMocks.repository.listFollowUpTasksByTenantAndCustomer).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
    });
    expect(routeMocks.auditRepository.listCustomerAuditEventsByResourceId).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
    });
    expect(
      routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenantAndCustomer,
    ).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
    });
    expect(payload.customer).toEqual({
      id: 'cust_001',
      displayName: '王女士',
      lifecycle: 'repurchase_window',
      priority: 'high',
      projectInterest: '热玛吉修复组合',
      maskedPhone: '138****1208',
      maskedMedicalRecordNo: 'MR****001',
      ownerUserId: 'consultant-lin',
      tags: ['高价值'],
      lastTouchSummary: '术后第 28 天',
      nextAction: '人工回访',
    });
    expect(payload.appointments).toHaveLength(1);
    expect(payload.followups).toHaveLength(1);
    expect(payload.auditEvents).toEqual([
      {
        id: 'audit_evt_001',
        action: 'update',
        result: 'allowed',
        reason: 'allowed_by_policy',
        actor: { id: 'demo-user-admin', role: 'tenant_admin' },
        occurredAt: '2026-06-03T09:00:00.000Z',
        resource: 'customer',
        resourceId: 'cust_001',
      },
    ]);
    expect(payload.treatmentSummaries).toEqual([
      {
        id: 'trt_001',
        appointmentId: 'appt_001',
        treatmentDate: '2026-06-01T12:00:00.000Z',
        treatmentProject: '光电修复',
        treatmentCategory: 'laser_repair',
        treatmentStage: 'D7 复诊',
        recoveryStage: 'D7',
        riskLevel: 'watch',
        ownerUserId: 'doctor-lin',
        summary: '结构化摘要：红肿减轻，安排补水护理。',
        nextCareAction: 'D14 人工回访恢复阶段。',
        tags: ['结构化摘要', '术后关怀'],
        status: 'active',
        voidedAt: null,
        voidedBy: null,
        voidReasonCode: null,
        voidReason: null,
        createdAt: '2026-06-01T12:00:00.000Z',
        updatedAt: '2026-06-01T12:00:00.000Z',
      },
    ]);
    expect(payload.timeline.map((event: { id: string }) => event.id)).toEqual([
      'audit:audit_evt_001',
      'appointment:appt_001',
      'treatment_summary:trt_001',
      'follow_up:fu_001',
      'customer:cust_001',
    ]);
    expect(payload.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'treatment_summary:trt_001',
          type: 'treatment_summary',
          occurredAt: '2026-06-01T12:00:00.000Z',
          title: '光电修复 · D7 复诊',
          summary: '结构化摘要：红肿减轻，安排补水护理。',
          status: 'watch',
          source: 'treatment_summary',
          relatedRecordId: 'trt_001',
          riskLevel: 'watch',
          tags: ['结构化摘要', '术后关怀'],
        }),
      ]),
    );
    expectNoPrivateData(payload);
  });

  it('作废治疗摘要在 timeline 中返回作废状态且不泄露敏感正文', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenantAndCustomer.mockResolvedValueOnce([
      voidedTreatmentSummaryRecord,
    ]);

    const response = await customerTimelineGet(timelineRequest(), routeContext());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.treatmentSummaries).toEqual([
      expect.objectContaining({
        id: 'trt_voided_001',
        status: 'voided',
        voidedAt: '2026-06-02T13:00:00.000Z',
        voidedBy: 'demo-user-admin',
        voidReasonCode: 'duplicate_summary',
        voidReason: '重复录入，保留较新的治疗摘要',
      }),
    ]);
    expect(payload.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'treatment_summary:trt_voided_001',
          type: 'treatment_summary',
          title: '光电修复作废记录 · D7 复核',
          status: 'voided',
          tags: ['已作废', '结构化摘要', '术后关怀'],
        }),
      ]),
    );
    expectNoPrivateData(payload);
  });

  it('审计事件为空时仍返回稳定空数组和非审计 timeline', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.auditRepository.listCustomerAuditEventsByResourceId.mockResolvedValueOnce([]);

    const response = await customerTimelineGet(timelineRequest(), routeContext());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.auditEvents).toEqual([]);
    expect(payload.timeline.map((event: { type: string }) => event.type)).toEqual([
      'appointment',
      'treatment_summary',
      'follow_up',
      'customer_summary',
    ]);
  });

  it('URL、query、header 和 body 中的 tenantId 不影响服务端租户判断', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await customerTimelineGet(
      timelineRequest('http://localhost/api/institution/customers/cust_001/timeline?tenantId=other-tenant', {
        method: 'POST',
        headers: { 'x-tenant-id': 'other-tenant' },
        body: JSON.stringify({ tenantId: 'other-tenant' }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.repository.getCustomerByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'cust_001',
    });
    expect(routeMocks.repository.getCustomerByTenant).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'other-tenant' }),
    );
  });

  it('其他租户客户或不存在客户返回稳定 404 且不继续查询关联数据', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.repository.getCustomerByTenant.mockResolvedValueOnce(null);

    const response = await customerTimelineGet(timelineRequest(), routeContext('cust_other_tenant'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(routeMocks.repository.getCustomerByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'cust_other_tenant',
    });
    expect(routeMocks.repository.listAppointmentsByTenantAndCustomer).not.toHaveBeenCalled();
    expect(routeMocks.repository.listFollowUpTasksByTenantAndCustomer).not.toHaveBeenCalled();
    expect(
      routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenantAndCustomer,
    ).not.toHaveBeenCalled();
    expect(routeMocks.auditRepository.listCustomerAuditEventsByResourceId).not.toHaveBeenCalled();

    routeMocks.repository.getCustomerByTenant.mockResolvedValueOnce(null);
    const missingResponse = await customerTimelineGet(
      timelineRequest(),
      routeContext('missing_customer'),
    );

    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({ error: '记录不存在' });
  });

  it('未登录返回 401 且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const response = await customerTimelineGet(timelineRequest(), routeContext());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('无权限角色返回 403 且不读取客户详情', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await customerTimelineGet(timelineRequest(), routeContext());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.repository.getCustomerByTenant).not.toHaveBeenCalled();
  });

  it('数据库不可用时返回稳定 503 且不泄露错误详情', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const response = await customerTimelineGet(timelineRequest(), routeContext());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expectNoPrivateData(payload);
  });

  it('治疗摘要查询异常时返回稳定 503 且不泄露错误详情', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.listTreatmentSummariesByTenantAndCustomer.mockRejectedValueOnce(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg'),
    );

    const response = await customerTimelineGet(timelineRequest(), routeContext());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expectNoPrivateData(payload);
  });
});
