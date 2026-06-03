import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as followUpPathAnalysisGet } from '@/app/api/institution/follow-up-path-analysis/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const treatmentSummaryRepository = {
    listFollowUpPathAnalysisTreatmentSummariesByTenant: vi.fn(),
  };
  const tenantBusinessRepository = {
    listFollowUpPathAnalysisSourceTasksByTenant: vi.fn(),
    createFollowUpTaskFromTreatmentSummarySuggestion: vi.fn(),
  };
  const auditRepository = {
    listFollowUpPathAnalysisAuditEventsByTenant: vi.fn(),
  };
  const database = {
    database: 'test-db',
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  return {
    auditRepository,
    createAuditEventRepository: vi.fn(() => auditRepository),
    createTenantBusinessRepository: vi.fn(() => tenantBusinessRepository),
    createTreatmentSummaryRepository: vi.fn(() => treatmentSummaryRepository),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    tenantBusinessRepository,
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

const forbiddenSamples = {
  tenantId: 'other-tenant',
  customerId: 'cust_sensitive',
  customerDisplayName: '王女士真实姓名',
  phone: ['138', '0000', '0000'].join(''),
  idNumber: ['110101', '199001', '010011'].join(''),
  medicalRecord: ['MR', 'RAW', '001'].join('-'),
  treatmentBody: ['完整治疗', '正文'].join(''),
  treatmentRecordBody: ['完整治疗记录', '正文'].join(''),
  medicalBody: ['完整病历', '正文'].join(''),
  consultationBody: ['咨询', '全文'].join(''),
  imageBody: ['图片', '原文'].join(''),
  fileBody: ['文件', '原文'].join(''),
  rawAuditPayload: 'requestBody',
  databaseName: ['DATABASE', 'URL'].join('_'),
  connectionText: ['postgres', '://tenant.invalid'].join(''),
  queryText: ['select', '* from audit_events'].join(' '),
  errorTraceWord: ['st', 'ack'].join(''),
  credentialWord: ['to', 'ken'].join(''),
  privateWord: ['sec', 'ret'].join(''),
  apiKeyLike: ['sk', 'test', 'should_not_return'].join('_'),
} as const;

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

const forbiddenPattern = new RegExp(
  Object.values(forbiddenSamples).map(escapeRegExp).join('|'),
  'i',
);

function analysisRequest(path = 'http://localhost/api/institution/follow-up-path-analysis', init?: RequestInit) {
  return new Request(path, init);
}

function expectNoPrivateData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(forbiddenPattern);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-03T08:00:00.000Z'));

  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.database.insert.mockReset();
  routeMocks.database.update.mockReset();
  routeMocks.database.delete.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.createTreatmentSummaryRepository.mockClear();
  routeMocks.createTenantBusinessRepository.mockClear();
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion.mockReset();
  routeMocks.treatmentSummaryRepository.listFollowUpPathAnalysisTreatmentSummariesByTenant.mockReset();
  routeMocks.treatmentSummaryRepository.listFollowUpPathAnalysisTreatmentSummariesByTenant.mockResolvedValue([
    {
      summaryId: 'trt_api_template',
      tenantId: 'demo-tenant-001',
      status: 'active',
      voidedAt: null,
      customerId: forbiddenSamples.customerId,
      appointmentId: 'appt_api_template',
      treatmentDate: '2026-06-01T12:00:00.000Z',
      treatmentProject: '光电治疗',
      treatmentCategory: 'laser_repair',
      treatmentStage: 'D1 术后观察',
      recoveryStage: 'D1',
      riskLevel: 'watch',
      nextCareAction: 'D3 人工确认泛红和补水护理执行情况。',
      tags: ['光子'],
      summary: forbiddenSamples.treatmentBody,
      treatmentRecordBody: forbiddenSamples.treatmentRecordBody,
      medicalRecordBody: forbiddenSamples.medicalBody,
      consultationTranscript: forbiddenSamples.consultationBody,
      imageUrl: forbiddenSamples.imageBody,
      fileUrl: forbiddenSamples.fileBody,
    },
    {
      summaryId: 'trt_api_voided',
      tenantId: 'demo-tenant-001',
      status: 'voided',
      voidedAt: '2026-06-02T09:00:00.000Z',
      customerId: 'cust_voided',
      appointmentId: null,
      treatmentDate: '2026-06-01T12:00:00.000Z',
      treatmentProject: '光电治疗',
      treatmentCategory: 'laser_repair',
      treatmentStage: 'D1 术后观察',
      recoveryStage: 'D1',
      riskLevel: 'watch',
      nextCareAction: 'D3 人工确认。',
      tags: ['光子'],
    },
  ]);
  routeMocks.tenantBusinessRepository.listFollowUpPathAnalysisSourceTasksByTenant.mockReset();
  routeMocks.tenantBusinessRepository.listFollowUpPathAnalysisSourceTasksByTenant.mockResolvedValue([
    {
      taskId: 'fu_api_confirmed',
      tenantId: 'demo-tenant-001',
      source: 'treatment_summary',
      sourceTreatmentSummaryId: 'trt_api_template',
      sourceSuggestionKey:
        'trt_api_template:template_path_followup:1d:photoelectric_care:photoelectric_d1_watch',
      taskStatus: 'completed',
      dueAt: '2026-06-02T08:00:00.000Z',
      updatedAt: '2026-06-02T10:00:00.000Z',
      customerDisplayName: forbiddenSamples.customerDisplayName,
      suggestedAction: forbiddenSamples.consultationBody,
    },
    {
      taskId: 'fu_api_overdue',
      tenantId: 'demo-tenant-001',
      source: 'treatment_summary',
      sourceTreatmentSummaryId: 'trt_api_template',
      sourceSuggestionKey:
        'trt_api_template:template_path_followup:1d:photoelectric_care:photoelectric_d1_watch',
      taskStatus: 'due',
      dueAt: '2026-06-02T08:00:00.000Z',
      updatedAt: null,
    },
    {
      taskId: 'fu_api_cancelled',
      tenantId: 'demo-tenant-001',
      source: 'treatment_summary',
      sourceTreatmentSummaryId: 'trt_api_template',
      sourceSuggestionKey:
        'trt_api_template:template_path_followup:1d:photoelectric_care:photoelectric_d1_watch',
      taskStatus: 'cancelled',
      dueAt: '2026-06-01T08:00:00.000Z',
      updatedAt: null,
    },
  ]);
  routeMocks.auditRepository.listFollowUpPathAnalysisAuditEventsByTenant.mockReset();
  routeMocks.auditRepository.listFollowUpPathAnalysisAuditEventsByTenant.mockResolvedValue([
    {
      auditResource: 'follow_up',
      auditResult: 'denied',
      auditReason: 'voided_treatment_summary_follow_up_blocked',
      resourceId: 'trt_api_voided',
      requestBody: forbiddenSamples.rawAuditPayload,
    },
    {
      auditResource: 'follow_up',
      auditResult: 'denied',
      auditReason: 'active_source_follow_up_exists',
      resourceId: 'fu_api_confirmed',
    },
  ]);
});

describe('机构端随访路径运营分析只读 API', () => {
  it('返回 Phase 21 最小聚合指标且只暴露安全聚合响应', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await followUpPathAnalysisGet(analysisRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      scope: 'followup_path_operational_analysis_v1',
      analysisAt: '2026-06-03T08:00:00.000Z',
      templateSuggestionCount: 1,
      confirmedSourceTaskCount: 3,
      completedTaskCount: 1,
      overdueTaskCount: 1,
      voidedSummaryBlockedCount: 1,
      duplicateSourceTaskConflictCount: 1,
      notes: [
        '只统计 template_path_followup 模板建议。',
        '任务超时数使用传入的固定 analysisAt，不读取本地时间。',
        '作废阻断和重复来源冲突仅来自可识别审计事件。',
      ],
      warnings: [],
      dataSourceNote: '基于当前租户治疗摘要、模板驱动建议、来源随访任务和审计事件只读聚合。',
      boundaryNote: '仅返回聚合指标，不返回客户明细、任务列表、治疗正文或 raw audit payload。',
    });
    expectNoPrivateData(payload);
    expect(Object.keys(payload).sort()).toEqual([
      'analysisAt',
      'boundaryNote',
      'completedTaskCount',
      'confirmedSourceTaskCount',
      'dataSourceNote',
      'duplicateSourceTaskConflictCount',
      'notes',
      'overdueTaskCount',
      'scope',
      'templateSuggestionCount',
      'voidedSummaryBlockedCount',
      'warnings',
    ]);
  });

  it('只从 access context 使用 tenantId，客户端传入 tenantId 不生效', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await followUpPathAnalysisGet(
      analysisRequest('http://localhost/api/institution/follow-up-path-analysis?tenantId=other-tenant', {
        headers: { 'x-tenant-id': 'other-tenant' },
      }),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.treatmentSummaryRepository.listFollowUpPathAnalysisTreatmentSummariesByTenant)
      .toHaveBeenCalledWith('demo-tenant-001');
    expect(routeMocks.tenantBusinessRepository.listFollowUpPathAnalysisSourceTasksByTenant)
      .toHaveBeenCalledWith('demo-tenant-001');
    expect(routeMocks.auditRepository.listFollowUpPathAnalysisAuditEventsByTenant)
      .toHaveBeenCalledWith('demo-tenant-001');
    expect(routeMocks.treatmentSummaryRepository.listFollowUpPathAnalysisTreatmentSummariesByTenant)
      .not.toHaveBeenCalledWith('other-tenant');
  });

  it('未登录或非机构租户管理员时返回现有风格错误且不初始化数据库', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    const missingSessionResponse = await followUpPathAnalysisGet(analysisRequest());

    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);
    const forbiddenResponse = await followUpPathAnalysisGet(analysisRequest());

    expect(missingSessionResponse.status).toBe(401);
    await expect(missingSessionResponse.json()).resolves.toEqual({ error: '请先登录' });
    expect(forbiddenResponse.status).toBe(403);
    await expect(forbiddenResponse.json()).resolves.toEqual({ error: '没有访问权限' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
  });

  it('不写数据库、不创建任务、不自动触达，也不调用 AI / RAG / Agent / 外部系统', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await followUpPathAnalysisGet(analysisRequest());
    const payload = await response.json();
    const routeSource = readFileSync(
      join(process.cwd(), 'src/app/api/institution/follow-up-path-analysis/route.ts'),
      'utf8',
    );
    const serviceSource = readFileSync(
      join(process.cwd(), 'src/modules/institution/server/followup-path-analysis-service.ts'),
      'utf8',
    );
    const blockedSourceTerms = [
      ['open', 'ai'].join(''),
      ['r', 'ag'].join(''),
      ['a', 'gent'].join(''),
      ['fetch', '('].join(''),
      ['XMLHttpRequest'].join(''),
      ['DATABASE', 'URL'].join('_'),
      ['we', 'chat'].join(''),
      ['we', 'com'].join(''),
      ['sms'].join(''),
      ['web', 'hook'].join(''),
      ['axios'].join(''),
    ];

    expect(response.status).toBe(200);
    expectNoPrivateData(payload);
    expect(routeMocks.database.insert).not.toHaveBeenCalled();
    expect(routeMocks.database.update).not.toHaveBeenCalled();
    expect(routeMocks.database.delete).not.toHaveBeenCalled();
    expect(routeMocks.tenantBusinessRepository.createFollowUpTaskFromTreatmentSummarySuggestion)
      .not.toHaveBeenCalled();
    for (const term of blockedSourceTerms) {
      expect(`${routeSource}\n${serviceSource}`.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it('数据服务不可用返回稳定 503 且不泄露错误详情', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg');
    });

    const response = await followUpPathAnalysisGet(analysisRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: '数据服务暂时不可用' });
    expectNoPrivateData(payload);
  });
});
