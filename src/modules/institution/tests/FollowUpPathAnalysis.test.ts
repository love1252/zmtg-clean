import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  buildFollowUpPathAnalysis,
  type FollowUpPathAnalysisAuditEvent,
  type FollowUpPathAnalysisInput,
  type FollowUpPathAnalysisSourceTask,
  type FollowUpPathAnalysisSuggestion,
  type FollowUpPathAnalysisTreatmentSummary,
} from '@/modules/institution/domain/followup-path-analysis';

const analysisAt = '2026-06-03T08:00:00.000Z';

const activeSummary = {
  summaryId: 'trt_active_template',
  tenantId: 'demo-tenant-001',
  status: 'active',
  voidedAt: null,
} satisfies FollowUpPathAnalysisTreatmentSummary;

const voidedSummary = {
  summaryId: 'trt_voided_template',
  tenantId: 'demo-tenant-001',
  status: 'voided',
  voidedAt: '2026-06-02T09:00:00.000Z',
} satisfies FollowUpPathAnalysisTreatmentSummary;

const templateSuggestion = {
  summaryId: activeSummary.summaryId,
  suggestionKey:
    'trt_active_template:template_path_followup:1d:photoelectric_care:photoelectric_d1_watch',
  ruleKey: 'template_path_followup',
} satisfies FollowUpPathAnalysisSuggestion;

const voidedTemplateSuggestion = {
  summaryId: voidedSummary.summaryId,
  suggestionKey:
    'trt_voided_template:template_path_followup:1d:photoelectric_care:photoelectric_d1_watch',
  ruleKey: 'template_path_followup',
} satisfies FollowUpPathAnalysisSuggestion;

const nonTemplateSuggestion = {
  summaryId: activeSummary.summaryId,
  suggestionKey: 'trt_active_template:watch_risk_followup:3d',
  ruleKey: 'watch_risk_followup',
} satisfies FollowUpPathAnalysisSuggestion;

function templateTask(
  patch: Partial<FollowUpPathAnalysisSourceTask> = {},
): FollowUpPathAnalysisSourceTask {
  return {
    taskId: `task_${patch.taskStatus ?? 'due'}_${patch.dueAt ?? 'base'}`,
    source: 'treatment_summary',
    sourceTreatmentSummaryId: activeSummary.summaryId,
    sourceSuggestionKey: templateSuggestion.suggestionKey,
    taskStatus: 'due',
    dueAt: '2026-06-02T08:00:00.000Z',
    updatedAt: null,
    ...patch,
  };
}

function auditEvent(
  patch: Partial<FollowUpPathAnalysisAuditEvent> = {},
): FollowUpPathAnalysisAuditEvent {
  return {
    auditResource: 'follow_up',
    auditResult: 'denied',
    auditReason: 'voided_treatment_summary_follow_up_blocked',
    resourceId: voidedSummary.summaryId,
    sourceTreatmentSummaryId: null,
    sourceSuggestionKey: null,
    ...patch,
  };
}

function buildAnalysis(
  patch: Partial<FollowUpPathAnalysisInput> = {},
) {
  return buildFollowUpPathAnalysis({
    analysisAt,
    treatmentSummaries: [activeSummary, voidedSummary],
    suggestions: [templateSuggestion, voidedTemplateSuggestion, nonTemplateSuggestion],
    sourceTasks: [],
    auditEvents: [],
    ...patch,
  });
}

const forbiddenSamples = {
  phone: ['138', '0000', '0000'].join(''),
  idNumber: ['110101', '199001', '010011'].join(''),
  medicalRecord: ['MR', 'RAW', '001'].join('-'),
  treatmentBody: ['完整治疗', '正文'].join(''),
  treatmentRecordBody: ['完整治疗记录', '正文'].join(''),
  medicalBody: ['完整病历', '正文'].join(''),
  consultationBody: ['咨询', '全文'].join(''),
  imageBody: ['图片', '原文'].join(''),
  fileBody: ['文件', '原文'].join(''),
  databaseName: ['DATABASE', 'URL'].join('_'),
  connectionText: ['postgres', '://tenant.invalid'].join(''),
  queryText: ['select', '* from follow_up_tasks'].join(' '),
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

function expectNoPrivateData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(forbiddenPattern);
}

describe('随访路径运营分析 domain 口径', () => {
  it('只统计 active 治疗摘要对应的模板建议数', () => {
    const analysis = buildAnalysis();

    expect(analysis.templateSuggestionCount).toBe(1);
    expect(analysis.notes).toContain('只统计 template_path_followup 模板建议。');
  });

  it('voided 摘要不计入模板建议数', () => {
    const analysis = buildAnalysis({
      treatmentSummaries: [voidedSummary],
      suggestions: [voidedTemplateSuggestion],
    });

    expect(analysis.templateSuggestionCount).toBe(0);
  });

  it('只统计模板路径治疗摘要来源的人工确认任务数', () => {
    const analysis = buildAnalysis({
      sourceTasks: [
        templateTask(),
        templateTask({ sourceSuggestionKey: 'trt_active_template:watch_risk_followup:3d' }),
        templateTask({ source: null }),
        templateTask({ sourceTreatmentSummaryId: null }),
        templateTask({ sourceSuggestionKey: null }),
      ],
    });

    expect(analysis.confirmedSourceTaskCount).toBe(1);
  });

  it('统计模板路径来源任务中 completed 的数量', () => {
    const analysis = buildAnalysis({
      sourceTasks: [
        templateTask({ taskStatus: 'completed' }),
        templateTask({ taskStatus: 'cancelled' }),
        templateTask({ taskStatus: 'in_progress' }),
      ],
    });

    expect(analysis.completedTaskCount).toBe(1);
  });

  it('使用固定 analysisAt 统计 overdue 任务', () => {
    const analysis = buildAnalysis({
      analysisAt: '2026-06-03T08:00:00.000Z',
      sourceTasks: [
        templateTask({ taskStatus: 'scheduled', dueAt: '2026-06-03T07:59:59.000Z' }),
        templateTask({ taskStatus: 'due', dueAt: '2026-06-01T08:00:00.000Z' }),
        templateTask({ taskStatus: 'in_progress', dueAt: '2026-06-02T08:00:00.000Z' }),
        templateTask({ taskStatus: 'escalated', dueAt: '2026-06-02T08:00:00.000Z' }),
        templateTask({ taskStatus: 'due', dueAt: '2026-06-03T08:00:00.000Z' }),
        templateTask({ taskStatus: 'due', dueAt: '2026-06-04T08:00:00.000Z' }),
      ],
    });

    expect(analysis.overdueTaskCount).toBe(4);
  });

  it('completed / cancelled 不计入 overdue', () => {
    const analysis = buildAnalysis({
      sourceTasks: [
        templateTask({ taskStatus: 'completed', dueAt: '2026-06-01T08:00:00.000Z' }),
        templateTask({ taskStatus: 'cancelled', dueAt: '2026-06-01T08:00:00.000Z' }),
      ],
    });

    expect(analysis.overdueTaskCount).toBe(0);
  });

  it('从 resourceId 可关联治疗摘要的审计事件统计作废摘要阻断数', () => {
    const analysis = buildAnalysis({
      auditEvents: [
        auditEvent(),
        auditEvent({ auditReason: 'voided_summary_follow_up_denied' }),
        auditEvent({ auditReason: 'voided_summary_follow_up_conflict' }),
        auditEvent({ resourceId: activeSummary.summaryId, sourceTreatmentSummaryId: activeSummary.summaryId }),
        auditEvent({ auditReason: 'role_denied' }),
        auditEvent({ auditReason: 'not_found_or_not_owned' }),
        auditEvent({ auditReason: 'invalid_follow_up_suggestion' }),
      ],
    });

    expect(analysis.voidedSummaryBlockedCount).toBe(3);
  });

  it('从审计事件统计重复来源任务冲突数', () => {
    const analysis = buildAnalysis({
      auditEvents: [
        auditEvent({
          auditReason: 'active_source_follow_up_exists',
          auditResult: 'conflict',
          resourceId: activeSummary.summaryId,
          sourceTreatmentSummaryId: activeSummary.summaryId,
          sourceSuggestionKey: templateSuggestion.suggestionKey,
        }),
        auditEvent({
          auditReason: 'duplicate_source_follow_up_conflict',
          auditResult: 'conflict',
          resourceId: activeSummary.summaryId,
          sourceTreatmentSummaryId: activeSummary.summaryId,
          sourceSuggestionKey: templateSuggestion.suggestionKey,
        }),
        auditEvent({
          auditReason: 'active_source_follow_up_exists',
          auditResult: 'conflict',
          resourceId: null,
          sourceTreatmentSummaryId: null,
          sourceSuggestionKey: templateSuggestion.suggestionKey,
        }),
        auditEvent({
          auditReason: 'voided_treatment_summary_follow_up_blocked',
          auditResult: 'denied',
          resourceId: voidedSummary.summaryId,
          sourceTreatmentSummaryId: voidedSummary.summaryId,
        }),
      ],
    });

    expect(analysis.duplicateSourceTaskConflictCount).toBe(2);
  });

  it('审计不足时不猜测阻断次数或重复冲突次数', () => {
    const analysis = buildAnalysis({
      treatmentSummaries: [voidedSummary],
      sourceTasks: [
        templateTask(),
        templateTask(),
      ],
      auditEvents: [],
    });

    expect(analysis.voidedSummaryBlockedCount).toBe(0);
    expect(analysis.duplicateSourceTaskConflictCount).toBe(0);
    expect(analysis.warnings).toContain('审计事件为空，作废阻断数和重复来源任务冲突数不会被猜测。');
  });

  it('输出不包含手机号、身份证号、病历号、正文、文件原文或连接串类敏感内容', () => {
    const analysis = buildAnalysis({
      treatmentSummaries: [
        {
          ...activeSummary,
          customerPhone: forbiddenSamples.phone,
          idNumber: forbiddenSamples.idNumber,
          medicalRecordNo: forbiddenSamples.medicalRecord,
          treatmentRecordBody: forbiddenSamples.treatmentRecordBody,
          medicalRecordBody: forbiddenSamples.medicalBody,
          consultationTranscript: forbiddenSamples.consultationBody,
        } as FollowUpPathAnalysisTreatmentSummary & Record<string, unknown>,
      ],
      suggestions: [
        {
          ...templateSuggestion,
          title: forbiddenSamples.treatmentBody,
          imageUrl: forbiddenSamples.imageBody,
          fileUrl: forbiddenSamples.fileBody,
        } as FollowUpPathAnalysisSuggestion & Record<string, unknown>,
      ],
      sourceTasks: [
        {
          ...templateTask(),
          rawPayload: [
            forbiddenSamples.databaseName,
            forbiddenSamples.connectionText,
            forbiddenSamples.queryText,
          ].join(' '),
        } as FollowUpPathAnalysisSourceTask & Record<string, unknown>,
      ],
      auditEvents: [
        {
          ...auditEvent(),
          requestBody: [
            forbiddenSamples.errorTraceWord,
            forbiddenSamples.credentialWord,
            forbiddenSamples.privateWord,
            forbiddenSamples.apiKeyLike,
          ].join(' '),
        } as FollowUpPathAnalysisAuditEvent & Record<string, unknown>,
      ],
    });

    expectNoPrivateData(analysis);
    expect(Object.keys(analysis).sort()).toEqual([
      'analysisAt',
      'completedTaskCount',
      'confirmedSourceTaskCount',
      'duplicateSourceTaskConflictCount',
      'notes',
      'overdueTaskCount',
      'scope',
      'templateSuggestionCount',
      'voidedSummaryBlockedCount',
      'warnings',
    ]);
  });

  it('不调用 AI / RAG / Agent / 外部系统，不写数据库也不创建任务', () => {
    const sourcePath = join(
      process.cwd(),
      'src/modules/institution/domain/followup-path-analysis.ts',
    );
    const source = readFileSync(sourcePath, 'utf8');
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
      ['createFollow', 'Up'].join(''),
    ];

    for (const term of blockedSourceTerms) {
      expect(source.toLowerCase()).not.toContain(term.toLowerCase());
    }
    expect(source).not.toMatch(/\b(insert|update|delete)\s*\(/iu);
  });
});
