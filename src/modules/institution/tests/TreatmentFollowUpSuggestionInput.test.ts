import { describe, expect, it } from 'vitest';
import {
  mapTreatmentSummaryListItemToFollowUpSuggestionInput,
  parseTreatmentFollowUpSuggestionSelection,
} from '@/modules/institution/server/treatment-followup-suggestions';
import type { InstitutionTreatmentSummaryListItem } from '@/modules/institution/domain/treatment-summaries';

const treatmentSummaryListItem = {
  id: 'trt_phase15_map',
  customerId: 'cust_phase15',
  appointmentId: 'appt_phase15',
  treatmentDate: '2026-06-01T04:00:00.000Z',
  treatmentProject: '光电修复',
  treatmentCategory: 'laser_repair',
  treatmentStage: 'D1 术后观察',
  recoveryStage: 'D1',
  riskLevel: 'watch',
  ownerUserId: 'doctor-lin',
  summary: '结构化摘要：红肿减轻，安排补水护理。',
  nextCareAction: 'D3 人工确认红肿和补水护理执行情况。',
  tags: ['结构化摘要', '术后关怀'],
  status: 'active',
  voidedAt: null,
  voidedBy: null,
  voidReasonCode: null,
  voidReason: null,
  createdAt: '2026-06-01T04:01:00.000Z',
  updatedAt: '2026-06-01T04:01:00.000Z',
} satisfies InstitutionTreatmentSummaryListItem;

const blockedSamples = {
  tenantField: ['tenant', 'Id'].join(''),
  ownerField: ['owner', 'UserId'].join(''),
  createdField: ['created', 'At'].join(''),
  updatedField: ['updated', 'At'].join(''),
  summaryField: ['sum', 'mary'].join(''),
  phone: ['138', '0000', '0000'].join(''),
  idNumber: ['110101', '199001', '010011'].join(''),
  medicalRecord: ['MR', 'RAW', '001'].join('-'),
  treatmentBody: ['完整治疗', '记录正文'].join(''),
  medicalBody: ['完整病历', '正文'].join(''),
  consultationBody: ['咨询对话', '全文'].join(''),
  databaseName: ['DATABASE', 'URL'].join('_'),
  connectionText: ['postgres', '://tenant.invalid'].join(''),
  errorTraceWord: ['st', 'ack'].join(''),
  credentialWord: ['to', 'ken'].join(''),
  privateWord: ['sec', 'ret'].join(''),
  apiKeyLike: ['sk', 'test', 'should_not_return'].join('_'),
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

describe('治疗后护理 / 随访建议输入 mapper 和 parser', () => {
  it('从治疗摘要安全列表 DTO 映射建议输入，并忽略正文、租户和敏感扩展字段', () => {
    const input = mapTreatmentSummaryListItemToFollowUpSuggestionInput({
      ...treatmentSummaryListItem,
      [blockedSamples.tenantField]: 'other-tenant',
      phoneNumber: blockedSamples.phone,
      idNumber: blockedSamples.idNumber,
      medicalRecordNo: blockedSamples.medicalRecord,
      treatmentRecordBody: blockedSamples.treatmentBody,
      medicalRecordBody: blockedSamples.medicalBody,
      consultationTranscript: blockedSamples.consultationBody,
      [blockedSamples.errorTraceWord]: [
        `${blockedSamples.databaseName}=${blockedSamples.connectionText}`,
        blockedSamples.credentialWord,
      ].join(' '),
    });

    expect(input).toEqual({
      id: 'trt_phase15_map',
      customerId: 'cust_phase15',
      appointmentId: 'appt_phase15',
      treatmentDate: '2026-06-01T04:00:00.000Z',
      treatmentProject: '光电修复',
      treatmentCategory: 'laser_repair',
      treatmentStage: 'D1 术后观察',
      recoveryStage: 'D1',
      riskLevel: 'watch',
      nextCareAction: 'D3 人工确认红肿和补水护理执行情况。',
      tags: ['结构化摘要', '术后关怀'],
    });
    expectNoPrivateData(input);
  });

  it('parser 只接受 suggestionKey', () => {
    expect(
      parseTreatmentFollowUpSuggestionSelection({
        suggestionKey: 'trt_phase15_map:urgent_risk_followup:1d',
      }),
    ).toEqual({
      ok: true,
      value: {
        suggestionKey: 'trt_phase15_map:urgent_risk_followup:1d',
      },
    });
    expect(
      parseTreatmentFollowUpSuggestionSelection({
        suggestionKey:
          'trt_phase15_map:template_path_followup:1d:photoelectric_care:photoelectric_d1_watch',
      }),
    ).toEqual({
      ok: true,
      value: {
        suggestionKey:
          'trt_phase15_map:template_path_followup:1d:photoelectric_care:photoelectric_d1_watch',
      },
    });
  });

  it('parser 拒绝 tenantId、customerId、dueAt、riskLevel、suggestedAction 和未知字段', () => {
    for (const field of [
      'tenantId',
      'customerId',
      'dueAt',
      'riskLevel',
      'suggestedAction',
      'tags',
      'unexpectedField',
    ]) {
      const result = parseTreatmentFollowUpSuggestionSelection({
        suggestionKey: 'trt_phase15_map:urgent_risk_followup:1d',
        [field]: 'blocked',
      });

      expect(result).toEqual({
        ok: false,
        error: `请求包含不允许的字段: ${field}`,
      });
    }
  });

  it('parser 拒绝非法或敏感 suggestionKey，且错误不回显敏感内容', () => {
    const invalidInputs = [
      null,
      'trt_phase15_map:urgent_risk_followup:1d',
      {},
      { suggestionKey: '' },
      { suggestionKey: 'trt phase15 map' },
      { suggestionKey: `${blockedSamples.databaseName}=${blockedSamples.connectionText}` },
      {
        suggestionKey: [
          blockedSamples.credentialWord,
          blockedSamples.privateWord,
          blockedSamples.apiKeyLike,
        ].join(' '),
      },
      { suggestionKey: 'x'.repeat(181) },
    ];

    for (const invalidInput of invalidInputs) {
      const result = parseTreatmentFollowUpSuggestionSelection(invalidInput);

      expect(result.ok).toBe(false);
      expectNoPrivateData(result);
    }
  });

  it('mapper 会克隆 tags，避免外部修改影响建议输入', () => {
    const record = {
      ...treatmentSummaryListItem,
      tags: ['结构化摘要'],
    };
    const input = mapTreatmentSummaryListItemToFollowUpSuggestionInput(record);

    record.tags.push('不应影响建议输入');

    expect(input.tags).toEqual(['结构化摘要']);
  });
});
