import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as treatmentSummariesPost } from '@/app/api/institution/customers/[customerId]/treatment-summaries/route';
import { PATCH as treatmentSummaryPatch } from '@/app/api/institution/treatment-summaries/[summaryId]/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const tenantBusinessRepository = {
    getCustomerByTenant: vi.fn(),
  };
  const treatmentSummaryRepository = {
    checkAppointmentBelongsToTenantAndCustomer: vi.fn(),
    createTreatmentSummary: vi.fn(),
    getTreatmentSummaryByTenant: vi.fn(),
    updateTreatmentSummaryByTenant: vi.fn(),
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
    createTenantBusinessRepository: vi.fn(() => tenantBusinessRepository),
    createTreatmentSummaryRepository: vi.fn(() => treatmentSummaryRepository),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    tenantBusinessRepository,
    transactionDatabase,
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

const customerRecord = {
  id: 'cust_001',
  tenantId: 'demo-tenant-001',
  displayName: '王女士',
};

const validCreateTreatmentSummaryPayload = {
  treatmentDate: '2026-06-01T12:00:00+08:00',
  treatmentProject: '光电修复',
  treatmentCategory: 'laser_repair',
  treatmentStage: 'D7 复诊',
  recoveryStage: 'D7',
  riskLevel: 'watch',
  ownerUserId: 'doctor-lin',
  summary: '结构化摘要：红肿减轻，安排补水护理。',
  nextCareAction: 'D14 人工回访恢复阶段。',
  tags: ['结构化摘要', '术后关怀'],
  appointmentId: 'appt_001',
};

const createdTreatmentSummaryRecord = {
  id: 'trt_created_001',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_001',
  appointmentId: 'appt_001',
  treatmentDate: '2026-06-01T04:00:00.000Z',
  treatmentProject: '光电修复',
  treatmentCategory: 'laser_repair',
  treatmentStage: 'D7 复诊',
  recoveryStage: 'D7',
  riskLevel: 'watch',
  ownerUserId: 'doctor-lin',
  summary: '结构化摘要：红肿减轻，安排补水护理。',
  nextCareAction: 'D14 人工回访恢复阶段。',
  tags: ['结构化摘要', '术后关怀'],
  createdAt: '2026-06-01T04:01:00.000Z',
  updatedAt: '2026-06-01T04:01:00.000Z',
  phoneNumber: '13800000000',
  fullTreatmentRecord: '完整治疗记录正文',
  medicalRecordText: '完整病历正文',
  consultationTranscript: '咨询对话全文',
  requestBody: { tenantId: 'other-tenant' },
  stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_should_not_return',
};

const existingTreatmentSummaryRecord = {
  id: 'trt_edit_001',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_001',
  appointmentId: 'appt_001',
  treatmentDate: '2026-06-01T04:00:00.000Z',
  treatmentProject: '光电修复',
  treatmentCategory: 'laser_repair',
  treatmentStage: 'D7 复诊',
  recoveryStage: 'D7',
  riskLevel: 'watch',
  ownerUserId: 'doctor-lin',
  summary: '结构化摘要：红肿减轻，安排补水护理。',
  nextCareAction: 'D14 人工回访恢复阶段。',
  tags: ['结构化摘要', '术后关怀'],
  createdAt: '2026-06-01T04:01:00.000Z',
  updatedAt: '2026-06-01T04:01:00.000Z',
};

const updatedTreatmentSummaryRecord = {
  ...existingTreatmentSummaryRecord,
  appointmentId: 'appt_edit_002',
  treatmentDate: '2026-06-02T02:30:00.000Z',
  riskLevel: 'urgent',
  summary: '复诊后恢复稳定，提醒人工观察。',
  tags: ['复诊', '风险观察'],
  updatedAt: '2026-06-02T02:31:00.000Z',
  phoneNumber: '13800000000',
  fullTreatmentRecord: '完整治疗记录正文',
  medicalRecordText: '完整病历正文',
  consultationTranscript: '咨询对话全文',
  requestBody: { tenantId: 'other-tenant' },
  stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_should_not_return',
};

function routeContext(customerId = 'cust_001') {
  return { params: Promise.resolve({ customerId }) };
}

function postRequest(payload: unknown, init?: RequestInit) {
  return new Request(
    'http://localhost/api/institution/customers/cust_001/treatment-summaries?tenantId=other-tenant',
    {
      method: 'POST',
      headers: { 'x-tenant-id': 'other-tenant', ...(init?.headers ?? {}) },
      body: JSON.stringify(payload),
      ...init,
    },
  );
}

function patchRouteContext(summaryId = 'trt_edit_001') {
  return { params: Promise.resolve({ summaryId }) };
}

function patchRequest(payload: unknown, init?: RequestInit) {
  return new Request(
    'http://localhost/api/institution/treatment-summaries/trt_edit_001?tenantId=other-tenant',
    {
      method: 'PATCH',
      headers: { 'x-tenant-id': 'other-tenant', ...(init?.headers ?? {}) },
      body: JSON.stringify(payload),
      ...init,
    },
  );
}

function expectNoPrivateData(
  payload: unknown,
  options: { allowTenantBoundaryFields?: boolean; allowRejectedFieldNames?: boolean } = {},
) {
  const serialized = JSON.stringify(payload);

  if (!options.allowTenantBoundaryFields) {
    expect(serialized).not.toContain('tenantId');
    expect(serialized).not.toContain('customerId');
  }

  expect(serialized).not.toContain('13800000000');
  expect(serialized).not.toContain('110101199001010011');
  expect(serialized).not.toContain('MR-RAW-001');
  expect(serialized).not.toContain('完整治疗记录正文');
  expect(serialized).not.toContain('完整病历正文');
  expect(serialized).not.toContain('诊疗原文');
  expect(serialized).not.toContain('咨询对话全文');

  if (!options.allowRejectedFieldNames) {
    expect(serialized).not.toContain('imageUrl');
    expect(serialized).not.toContain('fileUrl');
    expect(serialized).not.toContain('aiGeneratedContent');
    expect(serialized).not.toContain('externalSystemPayload');
  }

  expect(serialized).not.toContain('requestBody');
  expect(serialized).not.toContain('DATABASE_URL');
  expect(serialized).not.toContain('postgres://');
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('token');
  expect(serialized).not.toContain('secret');
}

function expectAuditEventDoesNotContainPrivateBody(event: unknown) {
  expectNoPrivateData(event, {
    allowRejectedFieldNames: true,
    allowTenantBoundaryFields: true,
  });
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.database.transaction.mockReset();
  routeMocks.database.transaction.mockImplementation(async (operation) =>
    operation(routeMocks.transactionDatabase),
  );
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.createTenantBusinessRepository.mockClear();
  routeMocks.createTreatmentSummaryRepository.mockClear();
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.auditRecord.mockReset();
  routeMocks.auditRecord.mockResolvedValue(undefined);
  routeMocks.tenantBusinessRepository.getCustomerByTenant.mockReset();
  routeMocks.tenantBusinessRepository.getCustomerByTenant.mockResolvedValue(customerRecord);
  routeMocks.treatmentSummaryRepository.checkAppointmentBelongsToTenantAndCustomer.mockReset();
  routeMocks.treatmentSummaryRepository.checkAppointmentBelongsToTenantAndCustomer.mockResolvedValue({
    kind: 'matched',
  });
  routeMocks.treatmentSummaryRepository.createTreatmentSummary.mockReset();
  routeMocks.treatmentSummaryRepository.createTreatmentSummary.mockResolvedValue(
    createdTreatmentSummaryRecord,
  );
  routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant.mockReset();
  routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant.mockResolvedValue(
    existingTreatmentSummaryRecord,
  );
  routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant.mockReset();
  routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant.mockResolvedValue({
    kind: 'updated',
    record: updatedTreatmentSummaryRecord,
  });
});

describe('治疗摘要创建 API route', () => {
  it('合法 payload 创建成功，返回安全 DTO，并写 allowed audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await treatmentSummariesPost(
      postRequest(validCreateTreatmentSummaryPayload),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      record: {
        id: 'trt_created_001',
        appointmentId: 'appt_001',
        treatmentDate: '2026-06-01T04:00:00.000Z',
        treatmentProject: '光电修复',
        treatmentCategory: 'laser_repair',
        treatmentStage: 'D7 复诊',
        recoveryStage: 'D7',
        riskLevel: 'watch',
        ownerUserId: 'doctor-lin',
        summary: '结构化摘要：红肿减轻，安排补水护理。',
        nextCareAction: 'D14 人工回访恢复阶段。',
        tags: ['结构化摘要', '术后关怀'],
        createdAt: '2026-06-01T04:01:00.000Z',
        updatedAt: '2026-06-01T04:01:00.000Z',
      },
    });
    expectNoPrivateData(payload);
    expect(routeMocks.tenantBusinessRepository.getCustomerByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'cust_001',
    });
    expect(
      routeMocks.treatmentSummaryRepository.checkAppointmentBelongsToTenantAndCustomer,
    ).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
      appointmentId: 'appt_001',
    });
    expect(routeMocks.treatmentSummaryRepository.createTreatmentSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        tenantId: 'demo-tenant-001',
        customerId: 'cust_001',
        appointmentId: 'appt_001',
        treatmentDate: new Date('2026-06-01T04:00:00.000Z'),
        treatmentProject: '光电修复',
      }),
    );
    expect(routeMocks.treatmentSummaryRepository.createTreatmentSummary).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'other-tenant' }),
    );
    expect(routeMocks.database.transaction).toHaveBeenCalledTimes(1);
    expect(routeMocks.createTenantBusinessRepository).toHaveBeenCalledWith(
      routeMocks.transactionDatabase,
    );
    expect(routeMocks.createTreatmentSummaryRepository).toHaveBeenCalledWith(
      routeMocks.transactionDatabase,
    );
    expect(routeMocks.createAuditEventRepository).toHaveBeenCalledWith(
      routeMocks.transactionDatabase,
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      reason: 'allowed_by_policy',
      resource: 'treatment_summary',
      resourceId: 'trt_created_001',
      result: 'allowed',
      tenantId: 'demo-tenant-001',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it('未登录返回 401，且不初始化数据库', async () => {
    const response = await treatmentSummariesPost(
      postRequest(validCreateTreatmentSummaryPayload),
      routeContext(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.treatmentSummaryRepository.createTreatmentSummary).not.toHaveBeenCalled();
  });

  it('无权限返回 403，写 denied audit，且不创建治疗摘要', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await treatmentSummariesPost(
      postRequest(validCreateTreatmentSummaryPayload),
      routeContext(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.treatmentSummaryRepository.createTreatmentSummary).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      reason: 'role_denied',
      resource: 'treatment_summary',
      result: 'denied',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it('customer 不存在时返回 404，并写 not_found audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.tenantBusinessRepository.getCustomerByTenant.mockResolvedValueOnce(null);

    const response = await treatmentSummariesPost(
      postRequest(validCreateTreatmentSummaryPayload),
      routeContext('cust_missing'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(routeMocks.tenantBusinessRepository.getCustomerByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'cust_missing',
    });
    expect(routeMocks.treatmentSummaryRepository.createTreatmentSummary).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      reason: 'not_found_or_not_owned',
      resource: 'treatment_summary',
      result: 'denied',
      tenantId: 'demo-tenant-001',
    }));
  });

  it('跨租户 customer 返回 404，并写 not_found audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.tenantBusinessRepository.getCustomerByTenant.mockResolvedValueOnce(null);

    const response = await treatmentSummariesPost(
      postRequest(validCreateTreatmentSummaryPayload),
      routeContext('cust_other_tenant'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(routeMocks.tenantBusinessRepository.getCustomerByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'cust_other_tenant',
    });
    expect(routeMocks.treatmentSummaryRepository.createTreatmentSummary).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      reason: 'not_found_or_not_owned',
      resource: 'treatment_summary',
      result: 'denied',
      tenantId: 'demo-tenant-001',
    }));
  });

  it('appointmentId 不存在时返回 404，并写 not_found audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.checkAppointmentBelongsToTenantAndCustomer.mockResolvedValueOnce({
      kind: 'not_found_or_not_owned',
    });

    const response = await treatmentSummariesPost(
      postRequest({
        ...validCreateTreatmentSummaryPayload,
        appointmentId: 'appt_missing',
      }),
      routeContext(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(
      routeMocks.treatmentSummaryRepository.checkAppointmentBelongsToTenantAndCustomer,
    ).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
      appointmentId: 'appt_missing',
    });
    expect(routeMocks.treatmentSummaryRepository.createTreatmentSummary).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'not_found_or_not_owned',
      result: 'denied',
    }));
  });

  it('appointmentId 跨租户时返回 404，并写 not_found audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.checkAppointmentBelongsToTenantAndCustomer.mockResolvedValueOnce({
      kind: 'not_found_or_not_owned',
    });

    const response = await treatmentSummariesPost(
      postRequest({
        ...validCreateTreatmentSummaryPayload,
        appointmentId: 'appt_other_tenant',
      }),
      routeContext(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(
      routeMocks.treatmentSummaryRepository.checkAppointmentBelongsToTenantAndCustomer,
    ).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
      appointmentId: 'appt_other_tenant',
    });
    expect(routeMocks.treatmentSummaryRepository.createTreatmentSummary).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'not_found_or_not_owned',
      result: 'denied',
    }));
  });

  it('appointmentId 不属于当前 customer 时返回 409，并写稳定 invalid reference audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.checkAppointmentBelongsToTenantAndCustomer.mockResolvedValueOnce({
      kind: 'customer_mismatch',
    });

    const response = await treatmentSummariesPost(
      postRequest({
        ...validCreateTreatmentSummaryPayload,
        appointmentId: 'appt_other_customer',
      }),
      routeContext(),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: '预约不属于当前客户' });
    expect(routeMocks.treatmentSummaryRepository.createTreatmentSummary).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      reason: 'invalid_treatment_summary_reference',
      resource: 'treatment_summary',
      result: 'denied',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it.each([
    ['tenantId 注入', { tenantId: 'other-tenant' }],
    ['未知字段', { unexpectedField: 'x' }],
    ['完整治疗正文', { fullTreatmentRecord: '完整治疗记录正文' }],
    ['完整病历正文', { medicalRecordText: '完整病历正文' }],
    ['咨询全文', { consultationTranscript: '咨询对话全文' }],
    ['手机号原文', { summary: '客户手机号 13800000000' }],
    ['身份证号', { summary: '身份证号 110101199001010011' }],
    ['病历号原文', { summary: '病历号 MR-RAW-001' }],
    ['图片原文', { imageUrl: 'https://example.com/raw.png' }],
    ['文件原文', { fileUrl: 'https://example.com/raw.pdf' }],
    ['AI 生成内容', { aiGeneratedContent: 'AI 生成治疗建议' }],
    ['外部系统原文', { externalSystemPayload: { raw: true } }],
  ])('payload 含 %s 时返回 400，并写 invalid payload audit', async (_label, patch) => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await treatmentSummariesPost(
      postRequest({
        ...validCreateTreatmentSummaryPayload,
        ...patch,
      }),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toHaveProperty('error');
    expectNoPrivateData(payload, {
      allowRejectedFieldNames: true,
      allowTenantBoundaryFields: true,
    });
    expect(routeMocks.tenantBusinessRepository.getCustomerByTenant).not.toHaveBeenCalled();
    expect(routeMocks.treatmentSummaryRepository.createTreatmentSummary).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'create',
      reason: 'invalid_treatment_summary_payload',
      resource: 'treatment_summary',
      result: 'denied',
      tenantId: 'demo-tenant-001',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it('非法 JSON 返回 400，并写 invalid payload audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await treatmentSummariesPost(
      new Request('http://localhost/api/institution/customers/cust_001/treatment-summaries', {
        method: 'POST',
        body: '{not-json',
      }),
      routeContext(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: '请求格式不正确' });
    expect(routeMocks.treatmentSummaryRepository.createTreatmentSummary).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'invalid_treatment_summary_payload',
      result: 'denied',
    }));
  });

  it('数据异常返回 503，错误响应不泄露 SQL、stack、DATABASE_URL、token 或 secret', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.createTreatmentSummary.mockRejectedValueOnce(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg token stack'),
    );

    const response = await treatmentSummariesPost(
      postRequest(validCreateTreatmentSummaryPayload),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expectNoPrivateData(payload);
  });
});

describe('治疗摘要编辑 API route', () => {
  it('合法 payload 编辑成功，返回安全 DTO，并写 allowed audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await treatmentSummaryPatch(
      patchRequest({
        treatmentDate: '2026-06-02T10:30:00+08:00',
        riskLevel: 'urgent',
        summary: '复诊后恢复稳定，提醒人工观察。',
        tags: [' 复诊 ', '风险观察', '复诊'],
        appointmentId: ' appt_edit_002 ',
      }),
      patchRouteContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      record: {
        id: 'trt_edit_001',
        appointmentId: 'appt_edit_002',
        treatmentDate: '2026-06-02T02:30:00.000Z',
        treatmentProject: '光电修复',
        treatmentCategory: 'laser_repair',
        treatmentStage: 'D7 复诊',
        recoveryStage: 'D7',
        riskLevel: 'urgent',
        ownerUserId: 'doctor-lin',
        summary: '复诊后恢复稳定，提醒人工观察。',
        nextCareAction: 'D14 人工回访恢复阶段。',
        tags: ['复诊', '风险观察'],
        createdAt: '2026-06-01T04:01:00.000Z',
        updatedAt: '2026-06-02T02:31:00.000Z',
      },
    });
    expectNoPrivateData(payload);
    expect(routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'trt_edit_001',
    });
    expect(routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      summaryId: 'trt_edit_001',
      values: {
        treatmentDate: new Date('2026-06-02T02:30:00.000Z'),
        riskLevel: 'urgent',
        summary: '复诊后恢复稳定，提醒人工观察。',
        tags: ['复诊', '风险观察'],
        appointmentId: 'appt_edit_002',
      },
    });
    expect(routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant).not.toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          tenantId: 'other-tenant',
          customerId: 'cust_other',
        }),
      }),
    );
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).toHaveBeenCalledTimes(1);
    expect(routeMocks.createTreatmentSummaryRepository).toHaveBeenCalledWith(
      routeMocks.transactionDatabase,
    );
    expect(routeMocks.createAuditEventRepository).toHaveBeenCalledWith(
      routeMocks.transactionDatabase,
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      reason: 'allowed_by_policy',
      resource: 'treatment_summary',
      resourceId: 'trt_edit_001',
      result: 'allowed',
      tenantId: 'demo-tenant-001',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it('未登录返回 401，且不初始化数据库', async () => {
    const response = await treatmentSummaryPatch(
      patchRequest({ summary: '复诊后恢复稳定。' }),
      patchRouteContext(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant).not.toHaveBeenCalled();
  });

  it('无权限返回 403，写 denied audit，且不更新治疗摘要', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await treatmentSummaryPatch(
      patchRequest({ summary: '复诊后恢复稳定。' }),
      patchRouteContext(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      reason: 'role_denied',
      resource: 'treatment_summary',
      result: 'denied',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it('summary 不存在或跨租户时返回 404，并写 not_found audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant.mockResolvedValueOnce(null);

    const response = await treatmentSummaryPatch(
      patchRequest({ summary: '复诊后恢复稳定。' }),
      patchRouteContext('trt_other_tenant'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'trt_other_tenant',
    });
    expect(routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      reason: 'not_found_or_not_owned',
      resource: 'treatment_summary',
      result: 'denied',
    }));
  });

  it.each([
    ['tenantId 注入', { tenantId: 'other-tenant' }],
    ['customerId 注入', { customerId: 'cust_other' }],
    ['id 注入', { id: 'trt_other' }],
    ['createdAt 注入', { createdAt: '2026-06-02T00:00:00.000Z' }],
    ['updatedAt 注入', { updatedAt: '2026-06-02T00:00:00.000Z' }],
    ['未知字段', { unexpectedField: 'x' }],
    ['空 payload', {}],
    ['完整治疗正文', { fullTreatmentRecord: '完整治疗记录正文' }],
    ['完整病历正文', { medicalRecordText: '完整病历正文' }],
    ['诊疗原文', { summary: '诊疗原文：医生原始记录' }],
    ['咨询全文', { consultationTranscript: '咨询对话全文' }],
    ['手机号原文', { summary: '客户手机号 13800000000' }],
    ['身份证号', { summary: '身份证号 110101199001010011' }],
    ['病历号原文', { summary: '病历号原文 MR-RAW-001' }],
    ['图片原文', { imageUrl: 'https://example.com/raw.png' }],
    ['文件原文', { fileUrl: 'https://example.com/raw.pdf' }],
    ['AI 生成内容', { aiGeneratedContent: 'AI 生成治疗建议' }],
    ['外部系统原文', { externalSystemPayload: { raw: true } }],
  ])('payload 含 %s 时返回 400，并写 invalid payload audit', async (_label, payloadPatch) => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await treatmentSummaryPatch(
      patchRequest(payloadPatch),
      patchRouteContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toHaveProperty('error');
    expectNoPrivateData(payload, {
      allowRejectedFieldNames: true,
      allowTenantBoundaryFields: true,
    });
    expect(routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'trt_edit_001',
    });
    expect(routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      reason: 'invalid_treatment_summary_payload',
      resource: 'treatment_summary',
      result: 'denied',
      tenantId: 'demo-tenant-001',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it('非法 JSON 返回 400，并写 invalid payload audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await treatmentSummaryPatch(
      new Request('http://localhost/api/institution/treatment-summaries/trt_edit_001', {
        method: 'PATCH',
        body: '{not-json',
      }),
      patchRouteContext(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: '请求格式不正确' });
    expect(routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      id: 'trt_edit_001',
    });
    expect(routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'invalid_treatment_summary_payload',
      result: 'denied',
    }));
  });

  it('appointmentId 不存在或跨租户时返回 404，并写 not_found audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant.mockResolvedValueOnce({
      kind: 'invalid_reference',
      reason: 'not_found_or_not_owned',
    });

    const response = await treatmentSummaryPatch(
      patchRequest({ appointmentId: 'appt_other_tenant' }),
      patchRouteContext(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      summaryId: 'trt_edit_001',
      values: { appointmentId: 'appt_other_tenant' },
    });
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      reason: 'not_found_or_not_owned',
      resource: 'treatment_summary',
      result: 'denied',
    }));
  });

  it('appointmentId 不属于当前 customer 时返回 409，并写 invalid reference audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant.mockResolvedValueOnce({
      kind: 'invalid_reference',
      reason: 'customer_mismatch',
    });

    const response = await treatmentSummaryPatch(
      patchRequest({ appointmentId: 'appt_other_customer' }),
      patchRouteContext(),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: '预约不属于当前客户' });
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      reason: 'invalid_treatment_summary_reference',
      resource: 'treatment_summary',
      result: 'denied',
    }));
    expectAuditEventDoesNotContainPrivateBody(routeMocks.auditRecord.mock.lastCall?.[0]);
  });

  it('repository update 竞争态查不到时返回 404，并写 not_found audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant.mockResolvedValueOnce({
      kind: 'not_found_or_not_owned',
    });

    const response = await treatmentSummaryPatch(
      patchRequest({ summary: '复诊后恢复稳定。' }),
      patchRouteContext(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      action: 'update',
      reason: 'not_found_or_not_owned',
      resource: 'treatment_summary',
      result: 'denied',
    }));
  });

  it('数据异常返回 503，错误响应不泄露 SQL、stack、DATABASE_URL、token 或 secret', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.updateTreatmentSummaryByTenant.mockRejectedValueOnce(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg token stack'),
    );

    const response = await treatmentSummaryPatch(
      patchRequest({ summary: '复诊后恢复稳定。' }),
      patchRouteContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expectNoPrivateData(payload);
  });
});
