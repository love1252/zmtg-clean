import { describe, expect, it } from 'vitest';
import { TENANT_QUOTA_RESOURCES } from '@/modules/institution/domain/quota-enforcement';
import {
  calculateAiCreditMetering,
  type AiCreditMeteringRuleInput,
  type AiCreditMeteringUsageInput,
} from '@/modules/institution/domain/ai-credits-metering';

const baseRule = {
  enabled: true,
  meteringVersion: 'v0.6-test-20260629',
  inputTokenWeight: 1,
  outputTokenWeight: 3,
  modelMultiplier: 2,
  creditsPerStandardTokenUnit: 1000,
  ragCreditSurcharge: 2,
  formulaVersion: 'unit-test-formula',
} satisfies AiCreditMeteringRuleInput;

const succeededUsage = {
  status: 'succeeded',
  inputTokens: 1000,
  outputTokens: 100,
  totalTokens: 1100,
} satisfies AiCreditMeteringUsageInput;

describe('AI credits metering domain service', () => {
  it('succeeded 且存在 enabled rule 与 token usage 时折算 AI credits', () => {
    const result = calculateAiCreditMetering({
      rule: baseRule,
      usage: succeededUsage,
    });

    expect(result).toMatchObject({
      aiCreditsConsumed: 5,
      meteringStatus: 'metered',
      meteringVersion: 'v0.6-test-20260629',
    });
    expect(result.meteringDetails).toMatchObject({
      inputTokens: 1000,
      outputTokens: 100,
      totalTokens: 1100,
      inputTokenWeight: 1,
      outputTokenWeight: 3,
      modelMultiplier: 2,
      creditsPerStandardTokenUnit: 1000,
      ragCreditSurcharge: 2,
      weightedStandardTokens: 2600,
      formulaVersion: 'unit-test-formula',
      billable: true,
      reason: 'succeeded_metered',
    });
  });

  it('分别按 input/output token 权重计算 weightedStandardTokens', () => {
    const result = calculateAiCreditMetering({
      rule: {
        ...baseRule,
        inputTokenWeight: 0.5,
        outputTokenWeight: 4,
        modelMultiplier: 1,
        creditsPerStandardTokenUnit: 1000,
        ragCreditSurcharge: 0,
      },
      usage: {
        status: 'succeeded',
        inputTokens: 200,
        outputTokens: 50,
        totalTokens: 250,
      },
    });

    expect(result.meteringDetails.weightedStandardTokens).toBe(300);
    expect(result.aiCreditsConsumed).toBe(1);
  });

  it('正确应用 modelMultiplier', () => {
    const result = calculateAiCreditMetering({
      rule: {
        ...baseRule,
        inputTokenWeight: 1,
        outputTokenWeight: 1,
        modelMultiplier: 1.5,
        creditsPerStandardTokenUnit: 1000,
        ragCreditSurcharge: 0,
      },
      usage: {
        status: 'succeeded',
        inputTokens: 400,
        outputTokens: 200,
        totalTokens: 600,
      },
    });

    expect(result.meteringDetails.weightedStandardTokens).toBe(900);
    expect(result.aiCreditsConsumed).toBe(1);
  });

  it('正确追加 RAG surcharge', () => {
    const withoutSurcharge = calculateAiCreditMetering({
      rule: { ...baseRule, modelMultiplier: 1, ragCreditSurcharge: 0 },
      usage: succeededUsage,
    });
    const withSurcharge = calculateAiCreditMetering({
      rule: { ...baseRule, modelMultiplier: 1, ragCreditSurcharge: 7 },
      usage: succeededUsage,
    });

    expect(withoutSurcharge.aiCreditsConsumed).toBe(2);
    expect(withSurcharge.aiCreditsConsumed).toBe(9);
  });

  it('AI credits 按 weightedStandardTokens / creditsPerStandardTokenUnit 向上取整', () => {
    const result = calculateAiCreditMetering({
      rule: {
        ...baseRule,
        inputTokenWeight: 1,
        outputTokenWeight: 1,
        modelMultiplier: 1,
        creditsPerStandardTokenUnit: 1000,
        ragCreditSurcharge: 0,
      },
      usage: {
        status: 'succeeded',
        inputTokens: 1001,
        outputTokens: 0,
        totalTokens: 1001,
      },
    });

    expect(result.meteringDetails.weightedStandardTokens).toBe(1001);
    expect(result.aiCreditsConsumed).toBe(2);
  });

  it.each([
    ['failed', null, 'non_succeeded_not_billable'],
    ['provider_unavailable', 'HTTP_500', 'non_succeeded_not_billable'],
    ['rate_limited', 'RATE_LIMITED', 'non_succeeded_not_billable'],
    ['rejected', 'OTHER_REJECTION', 'non_succeeded_not_billable'],
  ] as const)('非 succeeded 状态 %s 返回 not_billable / 0 credits', (status, errorCode, reason) => {
    const result = calculateAiCreditMetering({
      rule: baseRule,
      usage: {
        status,
        errorCode,
        inputTokens: 99999,
        outputTokens: 99999,
        totalTokens: 199998,
      },
    });

    expect(result.aiCreditsConsumed).toBe(0);
    expect(result.meteringStatus).toBe('not_billable');
    expect(result.meteringDetails.billable).toBe(false);
    expect(result.meteringDetails.reason).toBe(reason);
    expect(result.meteringDetails.weightedStandardTokens).toBeNull();
  });

  it.each([
    ['sensitive_input_rejected', 'SENSITIVE_INPUT_REJECTED', 'sensitive_input_rejected_not_billable'],
    ['rejected', 'quota_exceeded_ai_calls', 'quota_exceeded_ai_calls_not_billable'],
  ] as const)('%s 不计费且不计入成功消耗', (status, errorCode, reason) => {
    const result = calculateAiCreditMetering({
      rule: baseRule,
      usage: { status, errorCode },
    });

    expect(result).toMatchObject({
      aiCreditsConsumed: 0,
      meteringStatus: 'not_billable',
    });
    expect(result.meteringDetails).toMatchObject({
      billable: false,
      reason,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
    });
  });

  it('rule 缺失时返回 pending / null credits', () => {
    const result = calculateAiCreditMetering({
      rule: null,
      usage: succeededUsage,
    });

    expect(result).toMatchObject({
      aiCreditsConsumed: null,
      meteringStatus: 'pending',
      meteringVersion: null,
    });
    expect(result.meteringDetails.reason).toBe('missing_metering_rule');
  });

  it('rule disabled 时返回 pending / null credits', () => {
    const result = calculateAiCreditMetering({
      rule: { ...baseRule, enabled: false },
      usage: succeededUsage,
    });

    expect(result).toMatchObject({
      aiCreditsConsumed: null,
      meteringStatus: 'pending',
      meteringVersion: baseRule.meteringVersion,
    });
    expect(result.meteringDetails.reason).toBe('disabled_metering_rule');
  });

  it('succeeded 但 token 不足时返回 pending / null credits', () => {
    const result = calculateAiCreditMetering({
      rule: baseRule,
      usage: {
        status: 'succeeded',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
    });

    expect(result).toMatchObject({
      aiCreditsConsumed: null,
      meteringStatus: 'pending',
      meteringVersion: baseRule.meteringVersion,
    });
    expect(result.meteringDetails.reason).toBe('insufficient_token_usage');
  });

  it('meteringDetails 只包含低敏字段，不包含 prompt / answer / rawResponse / apiKey / baseUrl / Authorization', () => {
    const poisonedRule = {
      ...baseRule,
      apiKey: 'sk-test-should-not-leak',
      baseUrl: 'https://provider.example.test',
      Authorization: 'Bearer secret-token',
    } as unknown as AiCreditMeteringRuleInput;
    const poisonedUsage = {
      ...succeededUsage,
      prompt: '用户原始问题',
      answer: 'AI 原始回答',
      rawResponse: { choices: [{ message: { content: 'raw answer' } }] },
    } as unknown as AiCreditMeteringUsageInput;

    const result = calculateAiCreditMetering({
      rule: poisonedRule,
      usage: poisonedUsage,
    });
    const serialized = JSON.stringify(result.meteringDetails);

    expect(serialized).not.toContain('prompt');
    expect(serialized).not.toContain('用户原始问题');
    expect(serialized).not.toContain('answer');
    expect(serialized).not.toContain('AI 原始回答');
    expect(serialized).not.toContain('rawResponse');
    expect(serialized).not.toContain('apiKey');
    expect(serialized).not.toContain('sk-test-should-not-leak');
    expect(serialized).not.toContain('baseUrl');
    expect(serialized).not.toContain('provider.example.test');
    expect(serialized).not.toContain('Authorization');
    expect(serialized).not.toContain('secret-token');
  });

  it('不修改现有 AI quota resource 行为：ai_calls 仍保留且不新增 ai_credits', () => {
    expect(TENANT_QUOTA_RESOURCES).toEqual([
      'customers',
      'appointments',
      'knowledge_items',
      'knowledge_files',
      'knowledge_total_storage_mb',
      'knowledge_single_file_size_mb',
      'knowledge_parse_jobs_monthly',
      'knowledge_embedding_jobs_monthly',
      'knowledge_ocr_jobs_monthly',
      'knowledge_rag_answers_monthly',
      'knowledge_index_rebuild_jobs_monthly',
      'staff_seats',
      'ai_calls',
    ]);
    expect(TENANT_QUOTA_RESOURCES).toContain('ai_calls');
    expect(TENANT_QUOTA_RESOURCES).not.toContain('ai_credits');
  });

  it('纯函数结果稳定、可重复', () => {
    const first = calculateAiCreditMetering({ rule: baseRule, usage: succeededUsage });
    const second = calculateAiCreditMetering({ rule: baseRule, usage: succeededUsage });

    expect(second).toEqual(first);
  });

  it('历史旧记录保留 legacy 状态设计但不回填 credits', () => {
    const result = calculateAiCreditMetering({
      rule: baseRule,
      usage: {
        ...succeededUsage,
        legacyMetering: true,
      },
    });

    expect(result).toMatchObject({
      aiCreditsConsumed: null,
      meteringStatus: 'legacy',
      meteringVersion: baseRule.meteringVersion,
    });
    expect(result.meteringDetails.reason).toBe('legacy_record');
  });
});
