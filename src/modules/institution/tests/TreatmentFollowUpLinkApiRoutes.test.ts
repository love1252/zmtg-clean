import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as suggestionsGet } from '@/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route';
import { POST as followUpTasksPost } from '@/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const treatmentSummaryRepository = {
    getTreatmentSummaryByTenant: vi.fn(),
  };
  const tenantBusinessRepository = {
    createFollowUpTaskFromTreatmentSummarySuggestion: vi.fn(),
    getCustomerByTenant: vi.fn(),
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

vi.mock('@/modules/institution/server/treatment-summary-repository', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/treatment-summary-repository')
  >();
  return {
    ...actual,
    createTreatmentSummaryRepository: routeMocks.createTreatmentSummaryRepository,
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

const treatmentSummaryRecord = {
  id: 'trt_phase15_confirm',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_phase15_confirm',
  appointmentId: 'appt_phase15_confirm',
  treatmentDate: '2026-06-02T08:30:00.000Z',
  treatmentProject: 'Phase15 光电修复',
  treatmentCategory: 'skin_repair',
  treatmentStage: '术后观察',
  recoveryStage: 'D1',
  riskLevel: 'urgent',
  ownerUserId: 'doctor-phase15',
  summary: '结构化安全摘要',
  nextCareAction: '人工确认恢复情况并记录异常',
  tags: ['Phase15', '护理随访'],
  createdAt: '2026-06-02T08:30:00.000Z',
  updatedAt: '2026-06-02T08:30:00.000Z',
  phoneNumber: '13800001252',
  idNumber: '110101199001010011',
  medicalRecordNo: 'MR-RAW-PHASE15',
  fullTreatmentRecord: '完整治疗记录正文不应返回',
  medicalRecordBody: '完整病历正文不应返回',
  diagnosisText: '诊疗原文不应返回',
  consultationTranscript: '咨询对话全文不应返回',
  imageFileOriginal: '图片文件原文不应返回',
  aiGeneratedContent: 'AI 生成内容不应返回',
  externalSyncPayload: '外部系统同步原文不应返回',
  sql: 'select * from follow_up_tasks',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase15_should_not_return',
  secret: 'phase15-secret',
};

const voidedTreatmentSummaryRecord = {
  ...treatmentSummaryRecord,
  status: 'voided',
  voidedAt: '2026-06-02T09:00:00.000Z',
  voidedBy: 'demo-user-admin',
  voidReasonCode: 'duplicate_summary',
  voidReason: '重复录入，保留较新的治疗摘要',
};

const templateSuggestionKey =
  'trt_phase15_confirm:template_path_followup:1d:post_surgery_repair:post_surgery_d1_urgent';

const customerRecord = {
  id: 'cust_phase15_confirm',
  tenantId: 'demo-tenant-001',
  displayName: '王女士',
  lifecycle: 'post_care',
  priority: 'high',
  ownerUserId: 'doctor-phase15',
  projectInterest: 'Phase15 光电修复',
  maskedPhone: '138****1252',
  maskedMedicalRecordNo: 'MR****1515',
  lastTouchSummary: '术后观察',
  nextAction: '人工随访',
  tags: ['护理随访'],
};

const createdFollowUpTask = {
  id: 'fu_phase15_confirm',
  tenantId: 'demo-tenant-001',
  customerId: 'cust_phase15_confirm',
  customerDisplayName: '王女士',
  journeyId: 'treatment_followup_urgent_risk_followup',
  stage: '高风险治疗后随访',
  status: 'scheduled',
  dueAt: '2026-06-03T08:30:00.000Z',
  suggestedAction: '请优先安排人工随访，确认风险反馈和护理执行情况。',
  riskLevel: 'urgent',
  updatedBy: null,
  updatedAt: null,
  sourceTreatmentSummaryId: 'trt_phase15_confirm',
  sourceSuggestionKey: 'trt_phase15_confirm:urgent_risk_followup:1d',
  phoneNumber: '13800001252',
  consultationTranscript: '咨询对话全文不应返回',
  sql: 'select * from follow_up_tasks',
  stack: 'DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
  token: 'sk_test_phase15_should_not_return',
  secret: 'phase15-secret',
};

const createdTemplateFollowUpTask = {
  ...createdFollowUpTask,
  id: 'fu_phase20_template_confirm',
  journeyId: 'treatment_followup_template_path_followup',
  stage: '术后修复 D1 高风险人工处理',
  dueAt: '2026-06-03T08:30:00.000Z',
  suggestedAction: '请人工确认“术后修复 D1 高风险人工处理”。建议处理角色：运营负责人。禁止自动触达。',
  sourceSuggestionKey: templateSuggestionKey,
};

function routeContext(summaryId = 'trt_phase15_confirm') {
  return { params: Promise.resolve({ summaryId }) };
}

function request(path: string, init?: RequestInit) {
  return new Request(path, {
    headers: { 'x-tenant-id': 'other-tenant', ...(init?.headers ?? {}) },
    ...init,
  });
}

function expectNoPrivateData(payload: unknown, options: { allowAuditTenant?: boolean } = {}) {
  const serialized = JSON.stringify(payload);

  if (!options.allowAuditTenant) {
    expect(serialized).not.toContain('tenantId');
  }

  expect(serialized).not.toContain('13800001252');
  expect(serialized).not.toContain('110101199001010011');
  expect(serialized).not.toContain('MR-RAW-PHASE15');
  expect(serialized).not.toContain('完整治疗记录正文不应返回');
  expect(serialized).not.toContain('完整病历正文不应返回');
  expect(serialized).not.toContain('诊疗原文不应返回');
  expect(serialized).not.toContain('咨询对话全文不应返回');
  expect(serialized).not.toContain('图片文件原文不应返回');
  expect(serialized).not.toContain('AI 生成内容不应返回');
  expect(serialized).not.toContain('外部系统同步原文不应返回');
  expect(serialized).not.toContain('select * from follow_up_tasks');
  expect(serialized).not.toContain('DATABASE_URL');
  expect(serialized).not.toContain('postgres://');
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('token');
  expect(serialized).not.toContain('secret');
  expect(serialized).not.toContain('sk_test_phase15_should_not_return');
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
  routeMocks.createTreatmentSummaryRepository.mockClear();
  routeMocks.createTenantBusinessRepository.mockClear();
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.auditRecord.mockReset();
  routeMocks.auditRecord.mockResolvedValue(undefined);
  routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant.mockReset();
  routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant.mockResolvedValue(
    treatmentSummaryRecord,
  );
  routeMocks.tenantBusinessRepository.getCustomerByTenant.mockReset();
  routeMocks.tenantBusinessRepository.getCustomerByTenant.mockResolvedValue(customerRecord);
  routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion.mockReset();
  routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion.mockResolvedValue({
    kind: 'created',
    task: createdFollowUpTask,
  });
});

describe('治疗摘要随访建议 GET API', () => {
  it('固定返回低敏 503，不读取已授权的 demo 上下文或治疗摘要', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await suggestionsGet(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-suggestions?tenantId=other-tenant'),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      code: 'treatment_followup_suggestions_capability_disabled',
      error: '治疗随访建议能力暂未启用',
    });
    expect(payload).not.toHaveProperty('suggestions');
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant).not.toHaveBeenCalled();
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
    expectNoPrivateData(payload);
  });

  it('未知 summaryId 也固定返回低敏 503', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant.mockResolvedValueOnce(null);

    const response = await suggestionsGet(
      request('http://localhost/api/institution/treatment-summaries/trt_other_tenant/follow-up-suggestions'),
      routeContext('trt_other_tenant'),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: 'treatment_followup_suggestions_capability_disabled',
      error: '治疗随访建议能力暂未启用',
    });
    expect(routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant).not.toHaveBeenCalled();
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('已作废 summary 也固定返回低敏 503', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant.mockResolvedValueOnce(
      voidedTreatmentSummaryRecord,
    );

    const response = await suggestionsGet(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-suggestions'),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      code: 'treatment_followup_suggestions_capability_disabled',
      error: '治疗随访建议能力暂未启用',
    });
    expect(payload).not.toHaveProperty('suggestions');
    expect(routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant).not.toHaveBeenCalled();
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
    expectNoPrivateData(payload);
  });

  it('未登录时仍固定返回低敏 503，且不读取认证或数据库', async () => {
    const response = await suggestionsGet(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-suggestions'),
      routeContext(),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: 'treatment_followup_suggestions_capability_disabled',
      error: '治疗随访建议能力暂未启用',
    });
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('无权限上下文也固定返回低敏 503，且不查询治疗摘要', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await suggestionsGet(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-suggestions'),
      routeContext(),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: 'treatment_followup_suggestions_capability_disabled',
      error: '治疗随访建议能力暂未启用',
    });
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant).not.toHaveBeenCalled();
  });

  it('服务异常预置也不泄露 SQL / stack / token / secret / DATABASE_URL', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await suggestionsGet(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-suggestions'),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      code: 'treatment_followup_suggestions_capability_disabled',
      error: '治疗随访建议能力暂未启用',
    });
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant).not.toHaveBeenCalled();
    expectNoPrivateData(payload);
  });
});

describe('治疗摘要人工确认创建随访任务 POST API', () => {
  it('人工确认后创建随访任务成功、返回安全 DTO 并写 allowed audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await followUpTasksPost(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-tasks?tenantId=other-tenant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          suggestionKey: 'trt_phase15_confirm:urgent_risk_followup:1d',
        }),
      }),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      record: {
        id: 'fu_phase15_confirm',
        customerId: 'cust_phase15_confirm',
        customerDisplayName: '王女士',
        journeyId: 'treatment_followup_urgent_risk_followup',
        stage: '高风险治疗后随访',
        status: 'scheduled',
        dueAt: '2026-06-03T08:30:00.000Z',
        suggestedAction: '请优先安排人工随访，确认风险反馈和护理执行情况。',
        riskLevel: 'urgent',
        updatedBy: null,
        updatedAt: null,
        sourceTreatmentSummaryId: 'trt_phase15_confirm',
        sourceSuggestionKey: 'trt_phase15_confirm:urgent_risk_followup:1d',
      },
    });
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        tenantId: 'demo-tenant-001',
        customerId: 'cust_phase15_confirm',
        customerDisplayName: '王女士',
        journeyId: 'treatment_followup_urgent_risk_followup',
        stage: '高风险治疗后随访',
        dueAt: '2026-06-03T08:30:00.000Z',
        suggestedAction: '请优先安排人工随访，确认风险反馈和护理执行情况。',
        riskLevel: 'urgent',
        sourceTreatmentSummaryId: 'trt_phase15_confirm',
        sourceSuggestionKey: 'trt_phase15_confirm:urgent_risk_followup:1d',
      }),
    );
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'other-tenant' }),
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'follow_up',
      resourceId: 'fu_phase15_confirm',
      result: 'allowed',
      reason: 'allowed_by_policy',
      tenantId: 'demo-tenant-001',
    }));
    expectNoPrivateData(payload);
    expectNoPrivateData(routeMocks.auditRecord.mock.lastCall?.[0], { allowAuditTenant: true });
  });

  it('人工确认后可使用模板建议 key 创建来源任务', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion.mockResolvedValueOnce({
      kind: 'created',
      task: createdTemplateFollowUpTask,
    });

    const response = await followUpTasksPost(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          suggestionKey: templateSuggestionKey,
        }),
      }),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({
      record: {
        id: 'fu_phase20_template_confirm',
        customerId: 'cust_phase15_confirm',
        customerDisplayName: '王女士',
        journeyId: 'treatment_followup_template_path_followup',
        stage: '术后修复 D1 高风险人工处理',
        status: 'scheduled',
        dueAt: '2026-06-03T08:30:00.000Z',
        suggestedAction:
          '请人工确认“术后修复 D1 高风险人工处理”。建议处理角色：运营负责人。禁止自动触达。',
        riskLevel: 'urgent',
        updatedBy: null,
        updatedAt: null,
        sourceTreatmentSummaryId: 'trt_phase15_confirm',
        sourceSuggestionKey: templateSuggestionKey,
      },
    });
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        journeyId: 'treatment_followup_template_path_followup',
        stage: '术后修复 D1 高风险人工处理',
        dueAt: '2026-06-03T08:30:00.000Z',
        suggestedAction:
          '请人工确认“术后修复 D1 高风险人工处理”。建议处理角色：运营负责人。禁止自动触达。',
        sourceTreatmentSummaryId: 'trt_phase15_confirm',
        sourceSuggestionKey: templateSuggestionKey,
      }),
    );
    expectNoPrivateData(payload);
  });

  it('重复确认返回稳定冲突提示并写 duplicate audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion.mockResolvedValueOnce({
      kind: 'conflict',
      resourceId: 'fu_phase15_confirm',
      reason: 'active_source_follow_up_exists',
    });

    const response = await followUpTasksPost(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-tasks', {
        method: 'POST',
        body: JSON.stringify({ suggestionKey: 'trt_phase15_confirm:urgent_risk_followup:1d' }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '该护理随访任务已存在，请勿重复创建',
    });
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'follow_up',
      resourceId: 'fu_phase15_confirm',
      result: 'denied',
      reason: 'active_source_follow_up_exists',
      tenantId: 'demo-tenant-001',
    }));
  });

  it('模板建议重复确认仍走来源任务去重治理', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion.mockResolvedValueOnce({
      kind: 'conflict',
      resourceId: 'fu_phase20_template_confirm',
      reason: 'active_source_follow_up_exists',
    });

    const response = await followUpTasksPost(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-tasks', {
        method: 'POST',
        body: JSON.stringify({ suggestionKey: templateSuggestionKey }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '该护理随访任务已存在，请勿重复创建',
    });
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTreatmentSummaryId: 'trt_phase15_confirm',
        sourceSuggestionKey: templateSuggestionKey,
      }),
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'follow_up',
      resourceId: 'fu_phase20_template_confirm',
      result: 'denied',
      reason: 'active_source_follow_up_exists',
      tenantId: 'demo-tenant-001',
    }));
  });

  it('suggestionKey 不属于服务端确定性建议时返回 409 并写稳定 audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await followUpTasksPost(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-tasks', {
        method: 'POST',
        body: JSON.stringify({ suggestionKey: 'trt_phase15_confirm:unknown_rule:1d' }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '随访建议已失效，请重新生成后再确认',
    });
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'follow_up',
      result: 'denied',
      reason: 'invalid_follow_up_suggestion',
    }));
    expect(routeMocks.auditRecord).not.toHaveBeenCalledWith(expect.objectContaining({
      reason: 'voided_treatment_summary_follow_up_blocked',
    }));
  });

  it('summary 不存在或跨租户时返回 404 并写 not_found audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant.mockResolvedValueOnce(null);

    const response = await followUpTasksPost(
      request('http://localhost/api/institution/treatment-summaries/trt_other_tenant/follow-up-tasks', {
        method: 'POST',
        body: JSON.stringify({ suggestionKey: 'trt_other_tenant:urgent_risk_followup:1d' }),
      }),
      routeContext('trt_other_tenant'),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: '记录不存在' });
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'follow_up',
      result: 'denied',
      reason: 'not_found_or_not_owned',
    }));
    expect(routeMocks.auditRecord).not.toHaveBeenCalledWith(expect.objectContaining({
      reason: 'voided_treatment_summary_follow_up_blocked',
    }));
  });

  it('已作废 summary 不允许创建来源随访任务，返回 409 并写稳定 denied audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant.mockResolvedValueOnce(
      voidedTreatmentSummaryRecord,
    );

    const response = await followUpTasksPost(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-tasks', {
        method: 'POST',
        body: JSON.stringify({ suggestionKey: 'trt_phase15_confirm:urgent_risk_followup:1d' }),
      }),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ error: '治疗摘要已作废，不能继续创建来源随访任务' });
    expect(routeMocks.tenantBusinessRepository.getCustomerByTenant).not.toHaveBeenCalled();
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'follow_up',
      resourceId: 'trt_phase15_confirm',
      result: 'denied',
      reason: 'voided_treatment_summary_follow_up_blocked',
      tenantId: 'demo-tenant-001',
    }));
    expectNoPrivateData(payload);
    expectNoPrivateData(routeMocks.auditRecord.mock.lastCall?.[0], { allowAuditTenant: true });
  });

  it('未登录返回 401，且不初始化数据库', async () => {
    const response = await followUpTasksPost(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-tasks', {
        method: 'POST',
        body: JSON.stringify({ suggestionKey: 'trt_phase15_confirm:urgent_risk_followup:1d' }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('无权限返回 403，写 denied audit，且不创建随访任务', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await followUpTasksPost(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-tasks', {
        method: 'POST',
        body: JSON.stringify({ suggestionKey: 'trt_phase15_confirm:urgent_risk_followup:1d' }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'follow_up',
      result: 'denied',
      reason: 'role_denied',
    }));
    expect(routeMocks.auditRecord).not.toHaveBeenCalledWith(expect.objectContaining({
      reason: 'voided_treatment_summary_follow_up_blocked',
    }));
  });

  it('请求体包含 tenantId 或完整建议内容时返回 400 且不创建任务', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await followUpTasksPost(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-tasks', {
        method: 'POST',
        body: JSON.stringify({
          suggestionKey: 'trt_phase15_confirm:urgent_risk_followup:1d',
          tenantId: 'other-tenant',
          customerId: 'cust_phase15_confirm',
          riskLevel: 'urgent',
        }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '请求包含不允许的字段: tenantId',
    });
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(expect.objectContaining({
      resource: 'follow_up',
      result: 'denied',
      reason: 'invalid_follow_up_suggestion',
    }));
  });

  it('错误不泄露 SQL / stack / token / secret / DATABASE_URL', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion.mockRejectedValueOnce(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg token stack'),
    );

    const response = await followUpTasksPost(
      request('http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-tasks', {
        method: 'POST',
        body: JSON.stringify({ suggestionKey: 'trt_phase15_confirm:urgent_risk_followup:1d' }),
      }),
      routeContext(),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expectNoPrivateData(payload);
  });

  it('route 源码不调用 AI / RAG / Agent / 外部触达能力', () => {
    const source = [
      readFileSync(
        join(
          process.cwd(),
          'src/app/api/institution/treatment-summaries/[summaryId]/follow-up-suggestions/route.ts',
        ),
        'utf8',
      ),
      readFileSync(
        join(
          process.cwd(),
          'src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts',
        ),
        'utf8',
      ),
    ].join('\n');

    expect(source).not.toMatch(
      /openai|rag|\bagent\b|wecom|wechat|sms|phone_call|external_system|fetch\(|axios|webhook|oauth/i,
    );
  });
});
