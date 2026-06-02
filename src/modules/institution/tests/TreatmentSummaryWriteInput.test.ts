import { describe, expect, it } from 'vitest';
import {
  parseCreateTreatmentSummaryPayload,
  parseUpdateTreatmentSummaryPayload,
} from '@/modules/institution/server/treatment-summary-write-input';

const validPayload = {
  treatmentDate: '2026-05-31T09:30:00+08:00',
  treatmentProject: '水光补水复诊',
  treatmentCategory: 'injection_review',
  treatmentStage: 'D7 复诊',
  recoveryStage: 'D7',
  riskLevel: 'watch',
  ownerUserId: 'doctor-lin',
  summary: '恢复稳定，局部泛红已缓解。',
  nextCareAction: 'D14 人工复诊提醒。',
  tags: [' 结构化摘要 ', '术后关怀', '结构化摘要'],
  appointmentId: ' appt_001 ',
};

describe('治疗结构化摘要写入 payload parser', () => {
  it('接受白名单结构化字段并标准化日期、标签和 appointmentId', () => {
    expect(parseCreateTreatmentSummaryPayload(validPayload)).toEqual({
      ok: true,
      value: {
        treatmentDate: '2026-05-31T01:30:00.000Z',
        treatmentProject: '水光补水复诊',
        treatmentCategory: 'injection_review',
        treatmentStage: 'D7 复诊',
        recoveryStage: 'D7',
        riskLevel: 'watch',
        ownerUserId: 'doctor-lin',
        summary: '恢复稳定，局部泛红已缓解。',
        nextCareAction: 'D14 人工复诊提醒。',
        tags: ['结构化摘要', '术后关怀'],
        appointmentId: 'appt_001',
      },
    });
  });

  it('允许不传 appointmentId，并把空白 appointmentId 视为未关联预约', () => {
    const { appointmentId: _appointmentId, ...payloadWithoutAppointment } = validPayload;

    expect(parseCreateTreatmentSummaryPayload(payloadWithoutAppointment)).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({ appointmentId: null }),
      }),
    );
    expect(
      parseCreateTreatmentSummaryPayload({
        ...validPayload,
        appointmentId: ' ',
      }),
    ).toEqual(expect.objectContaining({
      ok: true,
      value: expect.objectContaining({ appointmentId: null }),
    }));
  });

  it('拒绝未知字段和 tenantId 注入', () => {
    expect(parseCreateTreatmentSummaryPayload({ ...validPayload, extraField: 'x' })).toEqual({
      ok: false,
      error: '请求包含不允许的字段: extraField',
    });
    expect(parseCreateTreatmentSummaryPayload({ ...validPayload, tenantId: 'other-tenant' })).toEqual({
      ok: false,
      error: '请求包含不允许的字段: tenantId',
    });
  });

  it('拒绝完整治疗记录、病历正文、咨询全文、PII、文件原文和内部敏感字段', () => {
    for (const field of [
      'fullTreatmentRecord',
      'medicalRecordText',
      'diagnosisText',
      'consultationTranscript',
      'phoneNumber',
      'idNumber',
      'rawMedicalRecordNo',
      'imageUrl',
      'fileUrl',
      'aiGeneratedContent',
      'externalSystemPayload',
      'requestBody',
      'sql',
      'stack',
      'token',
      'secret',
      'DATABASE_URL',
    ]) {
      expect(parseCreateTreatmentSummaryPayload({ ...validPayload, [field]: 'raw-value' })).toEqual({
        ok: false,
        error: `请求包含不允许的字段: ${field}`,
      });
    }
  });

  it('拒绝结构化字段中夹带完整正文、PII、AI、外部系统原文或内部敏感信息', () => {
    const blockedValues = [
      { field: 'summary', value: '完整治疗记录正文：术中原文...' },
      { field: 'summary', value: '完整病历正文：既往史原文...' },
      { field: 'summary', value: '咨询对话全文：客户逐字反馈...' },
      { field: 'summary', value: '客户手机号 13800000000' },
      { field: 'nextCareAction', value: '核对身份证号 110101199001010011' },
      { field: 'treatmentProject', value: 'DATABASE_URL=postgres://example' },
      { field: 'ownerUserId', value: 'token-sk_test_123' },
    ] as const;

    for (const blocked of blockedValues) {
      expect(
        parseCreateTreatmentSummaryPayload({
          ...validPayload,
          [blocked.field]: blocked.value,
        }),
      ).toEqual({
        ok: false,
        error: `字段 ${blocked.field} 不允许包含敏感信息`,
      });
    }

    expect(parseCreateTreatmentSummaryPayload({ ...validPayload, tags: ['MR-RAW-001'] })).toEqual({
      ok: false,
      error: '字段 tags 不允许包含敏感信息',
    });
  });

  it('稳定校验必填字段、日期、枚举、长度和标签格式', () => {
    expect(parseCreateTreatmentSummaryPayload({ ...validPayload, treatmentProject: ' ' })).toEqual({
      ok: false,
      error: '字段 treatmentProject 必须是非空字符串',
    });
    expect(parseCreateTreatmentSummaryPayload({ ...validPayload, treatmentDate: '2026-02-31' })).toEqual({
      ok: false,
      error: '字段 treatmentDate 必须是有效时间字符串',
    });
    expect(parseCreateTreatmentSummaryPayload({ ...validPayload, riskLevel: 'critical' })).toEqual({
      ok: false,
      error: '字段 riskLevel 值不在允许范围内',
    });
    expect(parseCreateTreatmentSummaryPayload({ ...validPayload, summary: 'x'.repeat(281) })).toEqual({
      ok: false,
      error: '字段 summary 长度不能超过 280',
    });
    expect(parseCreateTreatmentSummaryPayload({ ...validPayload, tags: [' '] })).toEqual({
      ok: false,
      error: '字段 tags 必须是非空字符串数组',
    });
  });

  it('编辑 parser 接受部分白名单结构化字段并标准化日期、标签和 appointmentId', () => {
    expect(
      parseUpdateTreatmentSummaryPayload({
        treatmentDate: '2026-06-02T10:30:00+08:00',
        riskLevel: 'urgent',
        summary: '复诊后恢复稳定，提醒人工观察。',
        tags: [' 复诊 ', '风险观察', '复诊'],
        appointmentId: ' appt_review_002 ',
      }),
    ).toEqual({
      ok: true,
      value: {
        treatmentDate: '2026-06-02T02:30:00.000Z',
        riskLevel: 'urgent',
        summary: '复诊后恢复稳定，提醒人工观察。',
        tags: ['复诊', '风险观察'],
        appointmentId: 'appt_review_002',
      },
    });

    expect(parseUpdateTreatmentSummaryPayload({ appointmentId: ' ' })).toEqual({
      ok: true,
      value: { appointmentId: null },
    });
  });

  it('编辑 parser 拒绝未知字段、租户客户标识和不可编辑系统字段', () => {
    for (const [field, value] of [
      ['extraField', 'x'],
      ['tenantId', 'other-tenant'],
      ['customerId', 'cust_other'],
      ['id', 'trt_other'],
      ['createdAt', '2026-06-02T00:00:00.000Z'],
      ['updatedAt', '2026-06-02T00:00:00.000Z'],
    ] as const) {
      expect(parseUpdateTreatmentSummaryPayload({ [field]: value })).toEqual({
        ok: false,
        error: `请求包含不允许的字段: ${field}`,
      });
    }
  });

  it('编辑 parser 明确拒绝完整正文、PII、图片文件、AI、外部系统原文和内部敏感字段', () => {
    for (const field of [
      'fullTreatmentRecord',
      'medicalRecordText',
      'diagnosisText',
      'consultationTranscript',
      'phoneNumber',
      'idNumber',
      'rawMedicalRecordNo',
      'imageUrl',
      'fileUrl',
      'aiGeneratedContent',
      'externalSystemPayload',
      'requestBody',
      'sql',
      'stack',
      'token',
      'secret',
      'DATABASE_URL',
    ]) {
      expect(parseUpdateTreatmentSummaryPayload({ [field]: 'raw-value' })).toEqual({
        ok: false,
        error: `请求包含不允许的字段: ${field}`,
      });
    }
  });

  it('编辑 parser 拒绝结构化字段中夹带等价中文正文、PII、AI、外部系统原文或内部敏感信息', () => {
    const blockedValues = [
      { field: 'summary', value: '完整治疗记录正文：逐字诊疗过程' },
      { field: 'summary', value: '完整病历正文：主诉和病史原文' },
      { field: 'summary', value: '诊疗原文：医生原始记录' },
      { field: 'nextCareAction', value: '咨询对话全文：客户逐字回复' },
      { field: 'nextCareAction', value: '手机号原文 13800000000' },
      { field: 'ownerUserId', value: '身份证号 110101199001010011' },
      { field: 'treatmentProject', value: '病历号原文 MR-RAW-001' },
      { field: 'treatmentCategory', value: '图片 / 文件原文 imageUrl=https://example.test/a.png' },
      { field: 'treatmentStage', value: 'AI 生成内容 aiGeneratedContent' },
      { field: 'recoveryStage', value: '外部系统 payload externalSystemPayload' },
      { field: 'summary', value: 'SQL select * from users stack token secret DATABASE_URL' },
    ] as const;

    for (const blocked of blockedValues) {
      expect(
        parseUpdateTreatmentSummaryPayload({
          [blocked.field]: blocked.value,
        }),
      ).toEqual({
        ok: false,
        error: `字段 ${blocked.field} 不允许包含敏感信息`,
      });
    }
  });

  it('编辑 parser 至少要求一个可更新字段，并稳定校验日期、枚举、长度和 tags', () => {
    expect(parseUpdateTreatmentSummaryPayload({})).toEqual({
      ok: false,
      error: '至少需要提供一个可更新字段',
    });
    expect(parseUpdateTreatmentSummaryPayload({ treatmentDate: '2026-02-31' })).toEqual({
      ok: false,
      error: '字段 treatmentDate 必须是有效时间字符串',
    });
    expect(parseUpdateTreatmentSummaryPayload({ riskLevel: 'critical' })).toEqual({
      ok: false,
      error: '字段 riskLevel 值不在允许范围内',
    });
    expect(parseUpdateTreatmentSummaryPayload({ summary: 'x'.repeat(281) })).toEqual({
      ok: false,
      error: '字段 summary 长度不能超过 280',
    });
    expect(parseUpdateTreatmentSummaryPayload({ tags: [' '] })).toEqual({
      ok: false,
      error: '字段 tags 必须是非空字符串数组',
    });
  });
});
