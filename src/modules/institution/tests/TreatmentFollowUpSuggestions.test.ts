import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import {
  buildTreatmentFollowUpSuggestions,
  type TreatmentFollowUpSuggestionInput,
} from '@/modules/institution/domain/treatment-followup-suggestions';

const baseTreatmentSummary = {
  id: 'trt_phase15_base',
  customerId: 'cust_phase15',
  appointmentId: 'appt_phase15',
  treatmentDate: '2026-06-01T12:00:00+08:00',
  treatmentProject: '光电修复',
  treatmentCategory: 'laser_repair',
  treatmentStage: 'D1 术后观察',
  recoveryStage: 'D1',
  riskLevel: 'watch',
  nextCareAction: 'D3 人工确认红肿和补水护理执行情况。',
  tags: ['结构化摘要', '术后关怀'],
} satisfies TreatmentFollowUpSuggestionInput;

const blockedSamples = {
  phone: ['138', '0000', '0000'].join(''),
  idNumber: ['110101', '199001', '010011'].join(''),
  medicalRecord: ['MR', 'RAW', '001'].join('-'),
  treatmentBody: ['完整治疗', '记录正文'].join(''),
  medicalBody: ['完整病历', '正文'].join(''),
  diagnosisBody: ['诊疗', '原文'].join(''),
  consultationBody: ['咨询对话', '全文'].join(''),
  imageBody: ['图片', '原文'].join(''),
  fileBody: ['文件', '原文'].join(''),
  databaseName: ['DATABASE', 'URL'].join('_'),
  connectionText: ['postgres', '://tenant.invalid'].join(''),
  queryText: ['select', '* from treatment_summaries'].join(' '),
  errorTraceWord: ['st', 'ack'].join(''),
  credentialWord: ['to', 'ken'].join(''),
  privateWord: ['sec', 'ret'].join(''),
  apiKeyLike: ['sk', 'test', 'should_not_return'].join('_'),
  externalPayload: ['external', 'System', 'Payload'].join(''),
  generatedContent: ['ai', 'Generated', 'Content'].join(''),
} as const;

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

const forbiddenPattern = new RegExp(
  Object.values(blockedSamples).map(escapeRegExp).join('|'),
  'i',
);

function expectNoPrivateData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(forbiddenPattern);
}

function suggestionsFor(input: Partial<TreatmentFollowUpSuggestionInput> = {}) {
  return buildTreatmentFollowUpSuggestions({
    ...baseTreatmentSummary,
    ...input,
  });
}

function templateSuggestionsFor(input: Partial<TreatmentFollowUpSuggestionInput> = {}) {
  return suggestionsFor(input).filter(
    (suggestion) => suggestion.ruleKey === 'template_path_followup',
  );
}

describe('治疗后护理 / 随访建议确定性规则', () => {
  it('高风险治疗摘要生成高优先级随访建议', () => {
    const suggestions = suggestionsFor({ riskLevel: 'urgent' });

    expect(suggestions).toContainEqual(
      expect.objectContaining({
        ruleKey: 'urgent_risk_followup',
        suggestionKey: 'trt_phase15_base:urgent_risk_followup:1d',
        title: '高风险治疗后随访',
        priority: 'high',
        riskLevel: 'urgent',
        recommendedDueAt: '2026-06-02T04:00:00.000Z',
        sourceTreatmentSummaryId: 'trt_phase15_base',
        sourceCustomerId: 'cust_phase15',
        sourceAppointmentId: 'appt_phase15',
      }),
    );
  });

  it('恢复早期生成护理确认建议', () => {
    const suggestions = suggestionsFor({ recoveryStage: 'D2', treatmentStage: '术后早期' });

    expect(suggestions).toContainEqual(
      expect.objectContaining({
        ruleKey: 'early_recovery_care_check',
        suggestionKey: 'trt_phase15_base:early_recovery_care_check:2d',
        title: '恢复早期护理确认',
        recommendedDueAt: '2026-06-03T04:00:00.000Z',
        priority: 'medium',
        reason: 'recoveryStage 表示仍处于恢复早期，需要人工确认护理执行情况',
      }),
    );
  });

  it('nextCareAction 能转化为内部任务建议', () => {
    const suggestions = suggestionsFor({
      nextCareAction: 'D14 人工回访恢复阶段，并确认补水护理完成。',
    });

    expect(suggestions).toContainEqual(
      expect.objectContaining({
        ruleKey: 'next_care_action_followup',
        suggestionKey: 'trt_phase15_base:next_care_action_followup:3d',
        title: '下一步护理动作确认',
        description: 'D14 人工回访恢复阶段，并确认补水护理完成。',
        recommendedDueAt: '2026-06-04T04:00:00.000Z',
      }),
    );
  });

  it('不同 treatmentCategory 生成稳定且不同的类别护理建议', () => {
    const skinRepairSuggestions = suggestionsFor({ treatmentCategory: 'skin_repair' });
    const injectionSuggestions = suggestionsFor({ treatmentCategory: 'injection_review' });

    const skinRepair = skinRepairSuggestions.find(
      (suggestion) => suggestion.ruleKey === 'category_skin_repair_care',
    );
    const injection = injectionSuggestions.find(
      (suggestion) => suggestion.ruleKey === 'category_injection_review_care',
    );

    expect(skinRepair).toMatchObject({
      suggestionKey: 'trt_phase15_base:category_skin_repair_care:3d:skin_repair',
      title: '修复类治疗护理提醒',
    });
    expect(injection).toMatchObject({
      suggestionKey: 'trt_phase15_base:category_injection_review_care:3d:injection_review',
      title: '注射类治疗复诊提醒',
    });
    expect(skinRepair?.suggestionKey).not.toBe(injection?.suggestionKey);
  });

  it('光子 / 光电治疗能生成模板驱动内部建议', () => {
    const [templateSuggestion] = templateSuggestionsFor({
      treatmentCategory: 'laser_repair',
      treatmentProject: '光电治疗',
      recoveryStage: 'D1',
      riskLevel: 'watch',
      tags: ['光子'],
    });

    expect(templateSuggestion).toMatchObject({
      suggestionKey:
        'trt_phase15_base:template_path_followup:1d:photoelectric_care:photoelectric_d1_watch',
      ruleKey: 'template_path_followup',
      title: '光电治疗 D1 反应人工确认',
      description: '请人工确认“光电治疗 D1 反应人工确认”。建议处理角色：医助。禁止自动触达。',
      recommendedDueAt: '2026-06-02T04:00:00.000Z',
      priority: 'medium',
      riskLevel: 'watch',
      sourceFields: expect.arrayContaining([
        'treatmentCategory',
        'recoveryStage',
        'riskLevel',
        'treatmentDate',
      ]),
    });
    expect(templateSuggestion?.reason).toContain('photoelectric_care');
    expect(templateSuggestion?.reason).toContain('photoelectric_d1_watch');
  });

  it('水光 / 注射护理能生成模板驱动内部建议', () => {
    const [templateSuggestion] = templateSuggestionsFor({
      treatmentCategory: 'injection_review',
      treatmentProject: '水光注射护理',
      recoveryStage: 'D3',
      riskLevel: 'watch',
      tags: ['注射复诊'],
    });

    expect(templateSuggestion).toMatchObject({
      suggestionKey:
        'trt_phase15_base:template_path_followup:3d:hydro_injection_care:hydro_injection_d3_care',
      title: '水光注射 D3 护理完成确认',
      recommendedDueAt: '2026-06-04T04:00:00.000Z',
      priority: 'medium',
    });
    expect(templateSuggestion?.description).toContain('禁止自动触达');
  });

  it('术后修复能生成模板驱动内部建议', () => {
    const [templateSuggestion] = templateSuggestionsFor({
      treatmentCategory: 'skin_repair',
      treatmentProject: '术后修复',
      recoveryStage: 'D7',
      riskLevel: 'watch',
      tags: ['修复护理'],
    });

    expect(templateSuggestion).toMatchObject({
      suggestionKey:
        'trt_phase15_base:template_path_followup:7d:post_surgery_repair:post_surgery_d7_repair',
      title: '术后修复 D7 护理路径复核',
      recommendedDueAt: '2026-06-08T04:00:00.000Z',
      priority: 'medium',
    });
  });

  it('皮肤管理能生成模板驱动内部建议', () => {
    const [templateSuggestion] = templateSuggestionsFor({
      treatmentCategory: 'skin_check',
      treatmentProject: '皮肤管理',
      treatmentStage: '稳定期护理',
      recoveryStage: '稳定期',
      riskLevel: 'normal',
      tags: ['皮肤检测'],
    });

    expect(templateSuggestion).toMatchObject({
      suggestionKey:
        'trt_phase15_base:template_path_followup:14d:skin_management:skin_management_stable',
      title: '皮肤管理稳定期复购前人工确认',
      recommendedDueAt: '2026-06-15T04:00:00.000Z',
      priority: 'low',
    });
  });

  it('urgent 风险能生成高优先级模板人工处理建议', () => {
    const [templateSuggestion] = templateSuggestionsFor({
      treatmentCategory: 'skin_repair',
      treatmentProject: '术后修复',
      recoveryStage: 'D1',
      riskLevel: 'urgent',
      tags: ['术后重点观察'],
    });

    expect(templateSuggestion).toMatchObject({
      suggestionKey:
        'trt_phase15_base:template_path_followup:1d:post_surgery_repair:post_surgery_d1_urgent',
      title: '术后修复 D1 高风险人工处理',
      priority: 'high',
      riskLevel: 'urgent',
      recommendedDueAt: '2026-06-02T04:00:00.000Z',
    });
    expect(templateSuggestion?.description).toContain('运营负责人');
    expect(templateSuggestion?.description).toContain('禁止自动触达');
  });

  it('ambiguous 输入不猜测项目，仍走安全 fallback', () => {
    const suggestions = buildTreatmentFollowUpSuggestions({
      ...baseTreatmentSummary,
      treatmentCategory: '',
      treatmentProject: '光子水光联合护理',
      treatmentStage: '',
      recoveryStage: '',
      riskLevel: 'normal',
      nextCareAction: '',
      tags: ['光电', '注射'],
    });

    expect(suggestions).toEqual([
      expect.objectContaining({
        ruleKey: 'lightweight_post_care_check',
        suggestionKey: 'trt_phase15_base:lightweight_post_care_check:7d',
      }),
    ]);
  });

  it('模板建议 key 稳定且保留旧规则 key 并存', () => {
    const suggestionKeys = suggestionsFor().map((suggestion) => suggestion.suggestionKey);

    expect(suggestionKeys).toEqual(
      expect.arrayContaining([
        'trt_phase15_base:template_path_followup:1d:photoelectric_care:photoelectric_d1_watch',
        'trt_phase15_base:watch_risk_followup:3d',
        'trt_phase15_base:early_recovery_care_check:2d',
        'trt_phase15_base:next_care_action_followup:3d',
        'trt_phase15_base:category_laser_repair_care:3d:laser_repair',
      ]),
    );
    expect(new Set(suggestionKeys).size).toBe(suggestionKeys.length);
  });

  it('信息不足时返回稳定轻量建议', () => {
    const suggestions = buildTreatmentFollowUpSuggestions({
      ...baseTreatmentSummary,
      appointmentId: null,
      treatmentProject: '',
      treatmentCategory: '',
      treatmentStage: '',
      recoveryStage: '',
      riskLevel: 'normal',
      nextCareAction: '',
      tags: [],
    });

    expect(suggestions).toEqual([
      expect.objectContaining({
        ruleKey: 'lightweight_post_care_check',
        suggestionKey: 'trt_phase15_base:lightweight_post_care_check:7d',
        title: '治疗后轻量随访提醒',
        priority: 'low',
        recommendedDueAt: '2026-06-08T04:00:00.000Z',
      }),
    ]);
  });

  it('相同输入生成相同 suggestionKey', () => {
    const first = suggestionsFor().map((suggestion) => suggestion.suggestionKey);
    const second = suggestionsFor().map((suggestion) => suggestion.suggestionKey);

    expect(first).toEqual(second);
  });

  it('不同规则生成不同 suggestionKey', () => {
    const suggestionKeys = suggestionsFor({ riskLevel: 'urgent', recoveryStage: 'D1' }).map(
      (suggestion) => suggestion.suggestionKey,
    );

    expect(new Set(suggestionKeys).size).toBe(suggestionKeys.length);
  });

  it('建议 DTO 不包含隐私正文或敏感错误信息', () => {
    const suggestions = buildTreatmentFollowUpSuggestions({
      ...baseTreatmentSummary,
      treatmentProject: `${blockedSamples.treatmentBody} ${blockedSamples.databaseName}=${blockedSamples.connectionText}`,
      treatmentCategory: blockedSamples.externalPayload,
      treatmentStage: [
        blockedSamples.errorTraceWord,
        blockedSamples.credentialWord,
        blockedSamples.privateWord,
      ].join(' '),
      recoveryStage: blockedSamples.consultationBody,
      nextCareAction: [
        blockedSamples.queryText,
        blockedSamples.credentialWord,
        blockedSamples.privateWord,
      ].join(' '),
      tags: [
        blockedSamples.phone,
        blockedSamples.medicalRecord,
        blockedSamples.generatedContent,
      ],
      phoneNumber: blockedSamples.phone,
      idNumber: blockedSamples.idNumber,
      medicalRecordNo: blockedSamples.medicalRecord,
      treatmentRecordBody: blockedSamples.treatmentBody,
      medicalRecordBody: blockedSamples.medicalBody,
      consultationTranscript: blockedSamples.consultationBody,
      imageUrl: blockedSamples.imageBody,
      fileUrl: blockedSamples.fileBody,
      [blockedSamples.errorTraceWord]: `${blockedSamples.databaseName}=${blockedSamples.connectionText}`,
      [blockedSamples.credentialWord]: blockedSamples.apiKeyLike,
    } as TreatmentFollowUpSuggestionInput & Record<string, unknown>);

    expectNoPrivateData(suggestions);
    for (const suggestion of suggestions) {
      expect(Object.keys(suggestion)).toEqual([
        'suggestionKey',
        'ruleKey',
        'title',
        'description',
        'recommendedDueAt',
        'priority',
        'riskLevel',
        'sourceTreatmentSummaryId',
        'sourceCustomerId',
        'sourceAppointmentId',
        'tags',
        'reason',
        'sourceFields',
      ]);
    }
  });

  it('模板建议 DTO 不包含隐私正文、图片文件原文或连接串类内容', () => {
    const suggestions = buildTreatmentFollowUpSuggestions({
      ...baseTreatmentSummary,
      treatmentCategory: 'laser_repair',
      treatmentProject: [
        blockedSamples.phone,
        blockedSamples.idNumber,
        blockedSamples.medicalRecord,
        blockedSamples.treatmentBody,
      ].join(' '),
      treatmentStage: [
        blockedSamples.medicalBody,
        blockedSamples.consultationBody,
        blockedSamples.errorTraceWord,
      ].join(' '),
      recoveryStage: 'D1',
      riskLevel: 'urgent',
      nextCareAction: [
        blockedSamples.imageBody,
        blockedSamples.fileBody,
        blockedSamples.databaseName,
        blockedSamples.connectionText,
      ].join(' '),
      tags: [
        blockedSamples.queryText,
        blockedSamples.credentialWord,
        blockedSamples.privateWord,
        blockedSamples.apiKeyLike,
      ],
    });
    const templateSuggestions = suggestions.filter(
      (suggestion) => suggestion.ruleKey === 'template_path_followup',
    );

    expect(templateSuggestions.length).toBeGreaterThan(0);
    expectNoPrivateData(suggestions);
  });

  it('建议规则不调用 AI、RAG、Agent，不写数据库，也不创建随访任务', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/modules/institution/domain/treatment-followup-suggestions.ts'),
      'utf8',
    );
    const externalTerms = [
      ['open', 'ai'].join(''),
      ['anth', 'ropic'].join(''),
      ['pro', 'mpt'].join(''),
      ['r', 'ag'].join(''),
      ['a', 'gent'].join(''),
      ['fet', 'ch\\('].join(''),
      ['http', ':'].join(''),
      ['https', ':'].join(''),
    ];
    const writeTerms = [
      ['server', '\\/db'].join(''),
      ['follow', '_up_tasks'].join(''),
      ['follow', 'UpTasks'].join(''),
      ['insert', '\\('].join(''),
      ['update', '\\('].join(''),
      ['delete', '\\('].join(''),
    ];
    const integrationTerms = [
      ['create', 'FollowUpTask'].join(''),
      ['au', 'dit'].join(''),
      ['web', 'hook'].join(''),
      ['s', 'ms'].join(''),
      ['we', 'chat'].join(''),
      ['企', '微'].join(''),
      ['短', '信'].join(''),
      ['电话', '外呼'].join(''),
    ];

    expect(source).not.toMatch(new RegExp(externalTerms.join('|'), 'iu'));
    expect(source).not.toMatch(new RegExp(writeTerms.join('|'), 'u'));
    expect(source).not.toMatch(new RegExp(integrationTerms.join('|'), 'u'));
  });
});
