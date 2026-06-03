import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS,
  STANDARD_TREATMENT_EVENT_FORBIDDEN_FIELDS,
  STANDARD_TREATMENT_EVENT_MAPPING_WARNING_CODES,
  STANDARD_TREATMENT_EVENT_RAW_SOURCE_TYPES,
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
  recoveryStage: ' D7 ',
  treatmentStatus: 'performed',
  rawSourceType: 'treatment_record',
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
  mappingWarnings: [
    'manual_review_required',
    'missing_recovery_stage',
    'manual_review_required',
  ],
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
        recoveryStage: 'D7',
        treatmentStatus: 'performed',
        rawSourceType: 'treatment_record',
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
        mappingWarnings: ['manual_review_required', 'missing_recovery_stage'],
        occurredAt: '2026-06-02T07:25:00.000Z',
        receivedAt: '2026-06-02T08:30:00.000Z',
      },
    });
  });

  it('smoke 锁定 Phase 22 mapper domain-only 最小闭环', () => {
    const trustedContext = {
      tenantId: 'trusted-tenant-smoke',
      eventId: 'trusted-event-smoke',
      receivedAt: '2026-06-03T09:00:00.000Z',
    };
    const result = normalizeStandardTreatmentEvent(validInput, trustedContext);

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.value).toEqual(
      expect.objectContaining({
        tenantId: 'trusted-tenant-smoke',
        eventId: 'trusted-event-smoke',
        receivedAt: '2026-06-03T09:00:00.000Z',
        sourceSystem: 'his',
        sourceEventId: 'his_evt_7788',
        sourceCustomerId: 'his_cust_123',
        appointmentRef: 'appt_qin_arrived',
        recoveryStage: 'D7',
        rawSourceType: 'treatment_record',
        mappingWarnings: ['manual_review_required', 'missing_recovery_stage'],
      }),
    );
    expect(result.value).not.toHaveProperty('externalEventId');
    expect(result.value).not.toHaveProperty('externalSource');
    expect(result.value).not.toHaveProperty('customerExternalId');
    expect(result.value).not.toHaveProperty('appointmentExternalId');
    expect(result.value.mappingWarnings.every((warningCode) =>
      STANDARD_TREATMENT_EVENT_MAPPING_WARNING_CODES.includes(warningCode),
    )).toBe(true);
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
    expect(STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS).not.toContain('externalEventId');
    expect(STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS).not.toContain('externalSource');
    expect(STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS).not.toContain('customerExternalId');
    expect(STANDARD_TREATMENT_EVENT_ALLOWED_INPUT_KEYS).not.toContain('appointmentExternalId');

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
    expectInvalid(
      { ...validInput, externalEventId: 'his_evt_external' },
      '请求包含不允许的字段: externalEventId',
    );
    expectInvalid(
      { ...validInput, externalSource: 'his' },
      '请求包含不允许的字段: externalSource',
    );
    expectInvalid(
      { ...validInput, customerExternalId: 'his_cust_external' },
      '请求包含不允许的字段: customerExternalId',
    );
    expectInvalid(
      { ...validInput, appointmentExternalId: 'his_appt_external' },
      '请求包含不允许的字段: appointmentExternalId',
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

  it('允许缺省 recoveryStage、rawSourceType 和 mappingWarnings，并输出安全默认值', () => {
    const inputWithoutNewFields: Record<string, unknown> = { ...validInput };
    delete inputWithoutNewFields.recoveryStage;
    delete inputWithoutNewFields.rawSourceType;
    delete inputWithoutNewFields.mappingWarnings;

    expect(normalizeStandardTreatmentEvent(inputWithoutNewFields, context)).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          recoveryStage: null,
          rawSourceType: null,
          mappingWarnings: [],
        }),
      }),
    );
  });

  it('允许 recoveryStage 空字符串按缺省值安全处理', () => {
    expect(normalizeStandardTreatmentEvent({ ...validInput, recoveryStage: '   ' }, context)).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          recoveryStage: null,
        }),
      }),
    );
  });

  it('拒绝 recoveryStage 中的超长文本、敏感内容或 raw payload 线索', () => {
    expectInvalid(
      { ...validInput, recoveryStage: 'D'.repeat(81) },
      '字段 recoveryStage 长度不能超过 80',
    );
    expectInvalid(
      { ...validInput, recoveryStage: 'raw payload: hisRawPayload' },
      '字段 recoveryStage 不允许包含敏感信息',
    );
    expectInvalid(
      { ...validInput, recoveryStage: '客户手机号 13800008888' },
      '字段 recoveryStage 不允许包含敏感信息',
    );

    const sensitiveRecoveryStages = [
      '身份证号 110101199001010011',
      '病历号 MR123456',
      '完整治疗记录正文：逐字记录...',
      '完整病历正文：既往史原文...',
      '咨询对话全文：客户逐字反馈...',
      'imageUrl=https://his.example/files/before.jpg',
      'select * from treatment_summaries',
      'stack trace',
      'token sk_test_123',
      'secret zmtg_sk_123',
      'DATABASE_URL=postgres://tenant:secret@localhost/db',
    ];

    for (const recoveryStage of sensitiveRecoveryStages) {
      expectInvalid(
        { ...validInput, recoveryStage },
        '字段 recoveryStage 不允许包含敏感信息',
      );
    }
  });

  it('只允许 rawSourceType 使用安全粗粒度来源类型', () => {
    expect(STANDARD_TREATMENT_EVENT_RAW_SOURCE_TYPES).toEqual([
      'treatment_record',
      'appointment',
      'order',
      'course_progress',
      'manual_review',
      'other',
    ]);

    for (const rawSourceType of STANDARD_TREATMENT_EVENT_RAW_SOURCE_TYPES) {
      expect(normalizeStandardTreatmentEvent({ ...validInput, rawSourceType }, context)).toEqual(
        expect.objectContaining({
          ok: true,
          value: expect.objectContaining({
            rawSourceType,
          }),
        }),
      );
    }

    expect(normalizeStandardTreatmentEvent({ ...validInput, rawSourceType: '   ' }, context)).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          rawSourceType: null,
        }),
      }),
    );

    expectInvalid(
      { ...validInput, rawSourceType: 'his_treatment_records_2026' },
      '字段 rawSourceType 值不在允许范围内',
    );
    expectInvalid(
      { ...validInput, rawSourceType: '/api/his/treatments/raw-response' },
      '字段 rawSourceType 值不在允许范围内',
    );
    expectInvalid(
      { ...validInput, rawSourceType: { table: 'his_treatment_records' } },
      '字段 rawSourceType 必须是字符串',
    );

    const unsafeRawSourceTypes = [
      'his_treatment_records',
      'POST /his/treatments',
      'requestBody',
      'hisRawResponse',
      'field:fullTreatmentRecord',
      'raw payload',
    ];

    for (const rawSourceType of unsafeRawSourceTypes) {
      expectInvalid(
        { ...validInput, rawSourceType },
        '字段 rawSourceType 值不在允许范围内',
      );
    }
  });

  it('只允许 mappingWarnings 输出安全 code，并去重、限制数量和长度', () => {
    expect(STANDARD_TREATMENT_EVENT_MAPPING_WARNING_CODES).toEqual([
      'unknown_treatment_category',
      'missing_recovery_stage',
      'external_event_id_missing',
      'appointment_external_id_missing',
      'customer_external_id_missing',
      'manual_review_required',
      'category_mapped_by_alias',
      'external_status_mapped_to_default',
    ]);

    expect(
      normalizeStandardTreatmentEvent(
        {
          ...validInput,
          mappingWarnings: STANDARD_TREATMENT_EVENT_MAPPING_WARNING_CODES,
        },
        context,
      ),
    ).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          mappingWarnings: [...STANDARD_TREATMENT_EVENT_MAPPING_WARNING_CODES],
        }),
      }),
    );

    expect(
      normalizeStandardTreatmentEvent(
        {
          ...validInput,
          mappingWarnings: [
            'unknown_treatment_category',
            'category_mapped_by_alias',
            'unknown_treatment_category',
          ],
        },
        context,
      ),
    ).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          mappingWarnings: ['unknown_treatment_category', 'category_mapped_by_alias'],
        }),
      }),
    );

    expectInvalid(
      {
        ...validInput,
        mappingWarnings: Array.from({ length: 13 }, (_, index) => `safe_warning_${index}`),
      },
      '字段 mappingWarnings 数量不能超过 12',
    );
    expectInvalid(
      { ...validInput, mappingWarnings: [`${'a'.repeat(81)}`] },
      '字段 mappingWarnings 单个 code 长度不能超过 80',
    );
    expectInvalid(
      { ...validInput, mappingWarnings: ['manual_review_required', 42] },
      '字段 mappingWarnings 必须是字符串数组',
    );
    expectInvalid(
      { ...validInput, mappingWarnings: ['manual_review_required', '   '] },
      '字段 mappingWarnings 只能包含安全 warning code',
    );
    expectInvalid(
      { ...validInput, mappingWarnings: ['safe_but_unknown_warning'] },
      '字段 mappingWarnings 只能包含安全 warning code',
    );
    expectInvalid(
      { ...validInput, mappingWarnings: ['需要人工复核'] },
      '字段 mappingWarnings 只能包含安全 warning code',
    );
  });

  it('拒绝 mappingWarnings 中的 raw payload、PII、完整正文、SQL、stack、token、secret、DATABASE_URL 或连接串', () => {
    const blockedWarnings = [
      'raw_payload',
      'phone_13800008888',
      'id_110101199001010011',
      'full_treatment_record',
      'select_from_treatment_summaries',
      'stack_trace',
      'token_leaked',
      'secret_leaked',
      'DATABASE_URL',
      'postgres://tenant:secret@localhost/db',
    ];

    for (const warning of blockedWarnings) {
      expectInvalid(
        { ...validInput, mappingWarnings: [warning] },
        '字段 mappingWarnings 只能包含安全 warning code',
      );
    }
  });

  it('拒绝 HIS raw payload、完整正文、PII、文件原文、AI 内容和内部敏感字段', () => {
    for (const field of STANDARD_TREATMENT_EVENT_FORBIDDEN_FIELDS) {
      expectInvalid(
        { ...validInput, [field]: 'raw-value' },
        `请求包含不允许的字段: ${field}`,
      );
    }
  });

  it('mapper 保持纯解析：不调用外部系统、不写数据库、不创建摘要或随访任务', () => {
    const mapperSource = readFileSync(
      join(process.cwd(), 'src/modules/institution/server/standard-treatment-event-mapper.ts'),
      'utf8',
    );
    const domainSource = readFileSync(
      join(process.cwd(), 'src/modules/institution/domain/standard-treatment-event.ts'),
      'utf8',
    );
    const source = `${mapperSource}\n${domainSource}`;
    const blockedSourceTerms = [
      ['fetch', '('].join(''),
      ['XMLHttpRequest'].join(''),
      ['axios'].join(''),
      ['open', 'ai'].join(''),
      ['r', 'ag'].join(''),
      ['a', 'gent'].join(''),
      ['we', 'com'].join(''),
      ['we', 'chat'].join(''),
      ['createTreatment', 'Summary'].join(''),
      ['createFollow', 'Up'].join(''),
      ['insert', '('].join(''),
      ['update', '('].join(''),
      ['delete', '('].join(''),
      ['drizzle'].join(''),
    ];

    for (const term of blockedSourceTerms) {
      expect(source.toLowerCase()).not.toContain(term.toLowerCase());
    }
    expect(source).not.toMatch(/\bdb\s*\./u);
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
