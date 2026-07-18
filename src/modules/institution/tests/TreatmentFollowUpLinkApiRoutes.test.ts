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
  const expectedDisabledPayload = {
    code: 'capability_disabled',
    error: '治疗摘要创建随访任务能力暂未启用',
  };

  function expectNoPostSideEffects() {
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
    expect(routeMocks.createTreatmentSummaryRepository).not.toHaveBeenCalled();
    expect(routeMocks.createTenantBusinessRepository).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.treatmentSummaryRepository.getTreatmentSummaryByTenant).not.toHaveBeenCalled();
    expect(routeMocks.tenantBusinessRepository.getCustomerByTenant).not.toHaveBeenCalled();
    expect(
      routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion,
    ).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  }

  it('对普通、查询和非法输入固定返回低敏 503、no-store 且不回显输入', async () => {
    const responses = await Promise.all([
      followUpTasksPost(
        request(
          'http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-tasks',
          { method: 'POST' },
        ),
        routeContext(),
      ),
      followUpTasksPost(
        request(
          'http://localhost/api/institution/treatment-summaries/summary_secret/follow-up-tasks?tenantId=other-tenant',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              suggestionKey: 'suggestion_secret',
              sourceTreatmentSummaryId: 'source_secret',
              customerId: 'customer_secret',
            }),
          },
        ),
        routeContext('summary_secret'),
      ),
      followUpTasksPost(
        request(
          'http://localhost/api/institution/treatment-summaries/trt_phase15_confirm/follow-up-tasks',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: '{invalid-json',
          },
        ),
        routeContext(),
      ),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const payload = await response.json();
      expect(payload).toEqual(expectedDisabledPayload);
      const serialized = JSON.stringify(payload);
      expect(serialized).not.toContain('record');
      expect(serialized).not.toContain('source');
      expect(serialized).not.toContain('summary_secret');
      expect(serialized).not.toContain('suggestion_secret');
      expect(serialized).not.toContain('customer_secret');
      expect(serialized).not.toContain('task');
      expect(serialized).not.toContain('audit');
      expectNoPrivateData(payload);
    }

    expectNoPostSideEffects();
  });

  it('对 hostile Request 和 context 不触发 trap、外部请求或下游调用', async () => {
    let requestTraps = 0;
    let contextTraps = 0;
    const hostileRequest = new Proxy(
      {},
      {
        get() {
          requestTraps += 1;
          throw new Error('request must not be read');
        },
        has() {
          requestTraps += 1;
          throw new Error('request must not be checked');
        },
        ownKeys() {
          requestTraps += 1;
          throw new Error('request must not be enumerated');
        },
      },
    ) as unknown as Request;
    const hostileContext = new Proxy(
      {},
      {
        get() {
          contextTraps += 1;
          throw new Error('context must not be read');
        },
        has() {
          contextTraps += 1;
          throw new Error('context must not be checked');
        },
        ownKeys() {
          contextTraps += 1;
          throw new Error('context must not be enumerated');
        },
      },
    ) as unknown as ReturnType<typeof routeContext>;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    try {
      const response = await followUpTasksPost(hostileRequest, hostileContext);

      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      await expect(response.json()).resolves.toEqual(expectedDisabledPayload);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }

    expect(requestTraps).toBe(0);
    expect(contextTraps).toBe(0);
    expectNoPostSideEffects();
  });

  it('route 源码不包含已关闭写路径、外部触达或成功事实', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/app/api/institution/treatment-summaries/[summaryId]/follow-up-tasks/route.ts',
      ),
      'utf8',
    );

    expect(source).not.toMatch(
      /getDemoAccessContextFromRequest|getDatabase|createAuditEventRepository|createTenantBusinessRepository|createTreatmentSummaryRepository|confirmTreatmentFollowUpTask|parseTreatmentFollowUpSuggestionSelection/,
    );
    expect(source).not.toMatch(
      /openai|rag|\bagent\b|wecom|wechat|sms|phone_call|external_system|fetch\(|axios|webhook|oauth/i,
    );
    expect(source).not.toContain('已创建内部随访任务');
  });
});
