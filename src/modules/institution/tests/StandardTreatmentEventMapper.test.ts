import { describe, expect, it } from 'vitest';
import {
  STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS,
  STANDARD_TREATMENT_EVENT_FORBIDDEN_FIELDS,
  STANDARD_TREATMENT_EVENT_SOURCE_SYSTEMS,
} from '@/modules/institution/domain/standard-treatment-event';
import { normalizeStandardTreatmentEvent } from '@/modules/institution/server/standard-treatment-event-mapper';

const context = {
  tenantId: 'demo-tenant-001',
  eventId: 'std_evt_001',
  receivedAt: '2026-06-02T08:30:00.000Z',
};

const validInput = {
  sourceSystem: 'his',
  sourceEventId: 'his_evt_7788',
  sourceCustomerId: 'his_cust_123',
  customerMatchKey: 'phone_sha256:4b227777d4dd1fc61c6f884f48641d02',
  customerName: '秦女士',
  maskedPhone: '138****8888',
  treatmentDate: '2026-06-02T15:20:00+08:00',
  treatmentProject: '玻尿酸复诊',
  treatmentCategory: 'injection_review',
  treatmentStage: 'D7 复诊',
  treatmentStatus: 'performed',
  appointmentRef: 'appt_qin_arrived',
  doctorRef: 'doctor-lin',
  operatorRef: 'consultant-chen',
  departmentRef: 'dept-skin',
  amount: '1280.50',
  currency: 'cny',
  riskLevel: 'watch',
  summary: '标准化事件短摘要：恢复稳定，局部泛红已缓解。',
  nextCareAction: 'D14 人工复诊提醒。',
  tags: [' 结构化事件 ', '术后护理', '结构化事件'],
  occurredAt: '2026-06-02T15:25:00+08:00',
};

function expectInvalid(input: unknown, error: string) {
  expect(normalizeStandardTreatmentEvent(input, context)).toEqual({ ok: false, error });
}

describe('标准治疗事件 domain-only mapper', () => {
  it('把已清洗输入标准化为内部标准治疗事件，不生成或修改 treatment_summaries', () => {
    expect(normalizeStandardTreatmentEvent(validInput, context)).toEqual({
      ok: true,
      value: {
        tenantId: 'demo-tenant-001',
        eventId: 'std_evt_001',
        sourceSystem: 'his',
        sourceEventId: 'his_evt_7788',
        sourceCustomerId: 'his_cust_123',
        customerMatchKey: 'phone_sha256:4b227777d4dd1fc61c6f884f48641d02',
        customerName: '秦女士',
        maskedPhone: '138****8888',
        treatmentDate: '2026-06-02T07:20:00.000Z',
        treatmentProject: '玻尿酸复诊',
        treatmentCategory: 'injection_review',
        treatmentStage: 'D7 复诊',
        treatmentStatus: 'performed',
        appointmentRef: 'appt_qin_arrived',
        doctorRef: 'doctor-lin',
        operatorRef: 'consultant-chen',
        departmentRef: 'dept-skin',
        amount: '1280.50',
        currency: 'CNY',
        riskLevel: 'watch',
        summary: '标准化事件短摘要：恢复稳定，局部泛红已缓解。',
        nextCareAction: 'D14 人工复诊提醒。',
        tags: ['结构化事件', '术后护理'],
        occurredAt: '2026-06-02T07:25:00.000Z',
        receivedAt: '2026-06-02T08:30:00.000Z',
      },
    });
  });

  it('只允许稳定 sourceSystem 集合，并保留 sourceEventId 用于外部事件追踪', () => {
    expect(STANDARD_TREATMENT_EVENT_SOURCE_SYSTEMS).toEqual([
      'his',
      'manual',
      'import',
      'other',
    ]);
    expect(normalizeStandardTreatmentEvent({ ...validInput, sourceSystem: 'manual' }, context)).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          sourceSystem: 'manual',
          sourceEventId: 'his_evt_7788',
        }),
      }),
    );

    expectInvalid(
      { ...validInput, sourceSystem: 'crm' },
      '字段 sourceSystem 值不在允许范围内',
    );
  });

  it('不信任外部 tenantId、eventId 或 receivedAt，并拒绝其他未知字段', () => {
    expect(STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS).not.toContain('tenantId');
    expect(STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS).not.toContain('eventId');
    expect(STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS).not.toContain('receivedAt');

    expectInvalid(
      { ...validInput, tenantId: 'other-tenant' },
      '请求包含不允许的字段: tenantId',
    );
    expectInvalid(
      { ...validInput, eventId: 'external-event-id' },
      '请求包含不允许的字段: eventId',
    );
    expectInvalid(
      { ...validInput, extraField: 'x' },
      '请求包含不允许的字段: extraField',
    );
  });

  it('要求 customerMatchKey 不包含手机号原文，maskedPhone 只能是脱敏展示值', () => {
    expectInvalid(
      { ...validInput, customerMatchKey: 'phone:13800008888' },
      '字段 customerMatchKey 不允许包含敏感信息',
    );
    expectInvalid(
      { ...validInput, maskedPhone: '13800008888' },
      '字段 maskedPhone 必须是脱敏展示值',
    );
    expectInvalid(
      { ...validInput, maskedPhone: '138-0000-8888' },
      '字段 maskedPhone 必须是脱敏展示值',
    );

    expect(normalizeStandardTreatmentEvent({ ...validInput, maskedPhone: null }, context)).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({ maskedPhone: null }),
      }),
    );
  });

  it('稳定保留治疗项目、分类、阶段、金额、币种和标准化标签', () => {
    expect(
      normalizeStandardTreatmentEvent(
        {
          ...validInput,
          treatmentProject: ' 热玛吉修复组合 ',
          treatmentCategory: 'skin_repair',
          treatmentStage: ' 疗程第 2 次 ',
          amount: 9800,
          currency: ' usd ',
          tags: ['复诊', ' 复购窗口 ', '复诊'],
        },
        context,
      ),
    ).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          treatmentProject: '热玛吉修复组合',
          treatmentCategory: 'skin_repair',
          treatmentStage: '疗程第 2 次',
          amount: '9800',
          currency: 'USD',
          tags: ['复诊', '复购窗口'],
        }),
      }),
    );
  });

  it('拒绝 HIS raw payload、完整正文、PII、文件原文、AI 内容和内部敏感字段', () => {
    for (const field of STANDARD_TREATMENT_EVENT_FORBIDDEN_FIELDS) {
      expectInvalid(
        { ...validInput, [field]: 'raw-value' },
        `请求包含不允许的字段: ${field}`,
      );
    }
  });

  it('拒绝结构化字段中夹带完整病历、治疗正文、诊疗原文、咨询全文、手机号、身份证、token、secret、SQL、stack 或数据库连接串', () => {
    const blockedValues = [
      { field: 'summary', value: '完整病历正文：既往史原文...' },
      { field: 'summary', value: '完整治疗记录正文：术中逐字记录...' },
      { field: 'summary', value: '诊疗原文：医生原始记录...' },
      { field: 'summary', value: '咨询对话全文：客户逐字反馈...' },
      { field: 'nextCareAction', value: '客户手机号 13800008888' },
      { field: 'customerMatchKey', value: 'id:110101199001010011' },
      { field: 'treatmentProject', value: 'DATABASE_URL=postgres://tenant:secret@localhost/db' },
      { field: 'doctorRef', value: 'token sk_test_123' },
      { field: 'operatorRef', value: 'secret zmtg_sk_123' },
      { field: 'departmentRef', value: 'select * from treatment_summaries' },
      { field: 'tags', value: ['stack trace'] },
    ] as const;

    for (const blocked of blockedValues) {
      expectInvalid(
        {
          ...validInput,
          [blocked.field]: blocked.value,
        },
        `字段 ${blocked.field} 不允许包含敏感信息`,
      );
    }
  });
});
