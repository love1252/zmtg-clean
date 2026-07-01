import { describe, expect, it, vi } from 'vitest';

import {
  listInstitutionAiCallUsageService,
  recordAiCallQuotaRejection,
  requestInstitutionAiCallService,
  type AiCallUsageRecord,
  type AiCallUsageStatus,
} from '@/modules/institution/server/institution-ai-call-service';
import { TENANT_QUOTA_RESOURCES } from '@/modules/institution/domain/quota-enforcement';
import type { AiCreditMeteringRulesRepository } from '@/modules/institution/server/ai-credit-metering-rules-repository';

vi.mock('@/modules/security/server/secretEncryption', () => ({
  decryptSecret: vi.fn(() => 'mock-plain-key'),
}));

type CreateUsageRecordInput = Parameters<AiCallUsageRepositoryMock['createUsageRecord']>[0];

type AiCallUsageRepositoryMock = {
  findVendorConfig: ReturnType<typeof vi.fn>;
  createUsageRecord: ReturnType<typeof vi.fn>;
  listInstitutionUsageRecords: ReturnType<typeof vi.fn>;
  listPlatformUsageSummary: ReturnType<typeof vi.fn>;
};

const baseRule = {
  enabled: true,
  meteringVersion: 'ai-credits-v0.6-test',
  inputTokenWeight: 1,
  outputTokenWeight: 3,
  modelMultiplier: 2,
  creditsPerStandardTokenUnit: 100,
  ragCreditSurcharge: 1,
};

function createMockUsageRecord(overrides: Partial<AiCallUsageRecord> = {}): AiCallUsageRecord {
  return {
    id: 'ai-usage-test-001',
    tenantId: 't-001',
    institutionId: 'inst-001',
    actorUserId: 'user-001',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    promptTokens: 80,
    completionTokens: 40,
    totalTokens: 120,
    latencyMs: 500,
    status: 'succeeded',
    errorCode: null,
    aiCreditsConsumed: null,
    meteringStatus: null,
    meteringVersion: null,
    meteringDetails: null,
    serviceCategory: null,
    serviceName: null,
    serviceSource: null,
    serviceAction: null,
    serviceVersion: null,
    metadata: null,
    createdAt: new Date('2026-06-29T10:00:00.000Z'),
    ...overrides,
  };
}

function createRepository() {
  const repository = {
    findVendorConfig: vi.fn().mockResolvedValue({
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
      encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
      configured: true,
    }),
    createUsageRecord: vi.fn(async (input: CreateUsageRecordInput) => createMockUsageRecord({
      id: input.id,
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      actorUserId: input.actorUserId,
      provider: input.provider,
      model: input.model,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      latencyMs: input.latencyMs,
      status: input.status,
      errorCode: input.errorCode,
      aiCreditsConsumed: input.aiCreditsConsumed,
      meteringStatus: input.meteringStatus,
      meteringVersion: input.meteringVersion,
      meteringDetails: input.meteringDetails,
      metadata: input.metadata ?? null,
    })),
    listInstitutionUsageRecords: vi.fn(),
    listPlatformUsageSummary: vi.fn(),
  };

  return repository;
}

function createRulesRepository(result: Awaited<ReturnType<AiCreditMeteringRulesRepository['findCurrentRuleForProviderModel']>>) {
  return {
    findCurrentRuleForProviderModel: vi.fn().mockResolvedValue(result),
  } satisfies AiCreditMeteringRulesRepository;
}

function mockFetchSuccess() {
  (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '冷敷后建议避免剧烈热刺激。' } }],
      usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
    }),
  });
}

async function requestAiCall(input: {
  repository: ReturnType<typeof createRepository>;
  rulesRepository?: AiCreditMeteringRulesRepository;
  question?: string;
}) {
  return requestInstitutionAiCallService({
    repository: input.repository,
    rulesRepository: input.rulesRepository,
    vendor: 'deepseek',
    input: {
      tenantId: 't-001',
      institutionId: 'inst-001',
      userId: 'user-001',
      question: input.question ?? '冷敷后怎么护理？',
    },
  });
}

describe('AI call usage metering 写入', () => {
  it('succeeded + 命中规则时写入 metered / credits / version / details', async () => {
    mockFetchSuccess();
    const repository = createRepository();
    const rulesRepository = createRulesRepository({
      status: 'found',
      rule: baseRule,
      selectedRule: {
        id: 'rule-001',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        meteringVersion: 'ai-credits-v0.6-test',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        effectiveTo: null,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    });

    const result = await requestAiCall({ repository, rulesRepository });
    const recordInput = repository.createUsageRecord.mock.calls[0][0] as CreateUsageRecordInput;

    expect(result.status).toBe('created');
    expect(rulesRepository.findCurrentRuleForProviderModel).toHaveBeenCalledWith({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    });
    expect(recordInput).toMatchObject({
      status: 'succeeded',
      aiCreditsConsumed: 5,
      meteringStatus: 'metered',
      meteringVersion: 'ai-credits-v0.6-test',
    });
    expect(recordInput.meteringDetails).toMatchObject({
      meteringVersion: 'ai-credits-v0.6-test',
      inputTokens: 80,
      outputTokens: 40,
      totalTokens: 120,
      weightedStandardTokens: 400,
      billable: true,
      reason: 'succeeded_metered',
      usageStatus: 'succeeded',
    });
  });

  it('succeeded + 无规则时写入 pending / null credits', async () => {
    mockFetchSuccess();
    const repository = createRepository();
    const rulesRepository = createRulesRepository({
      status: 'no_rule',
      reason: 'missing_metering_rule',
      rule: null,
    });

    await requestAiCall({ repository, rulesRepository });
    const recordInput = repository.createUsageRecord.mock.calls[0][0] as CreateUsageRecordInput;

    expect(recordInput.aiCreditsConsumed).toBeNull();
    expect(recordInput.meteringStatus).toBe('pending');
    expect(recordInput.meteringVersion).toBeNull();
    expect(recordInput.meteringDetails?.reason).toBe('missing_metering_rule');
  });

  it.each(['disabled', 'expired', 'future'] as const)(
    'succeeded + %s 规则不可用时写入 pending / null credits',
    async () => {
      mockFetchSuccess();
      const repository = createRepository();
      const rulesRepository = createRulesRepository({
        status: 'no_rule',
        reason: 'missing_metering_rule',
        rule: null,
      });

      await requestAiCall({ repository, rulesRepository });
      const recordInput = repository.createUsageRecord.mock.calls[0][0] as CreateUsageRecordInput;

      expect(recordInput.aiCreditsConsumed).toBeNull();
      expect(recordInput.meteringStatus).toBe('pending');
      expect(recordInput.meteringDetails?.reason).toBe('missing_metering_rule');
    },
  );

  it.each([
    ['failed', () => Promise.reject(new Error('network')), 'failed', 'NETWORK_ERROR'],
    ['provider_unavailable', () => Promise.resolve({ ok: false, status: 503, text: async () => 'Service Unavailable' }), 'provider_unavailable', 'HTTP_503'],
    ['rate_limited', () => Promise.resolve({ ok: false, status: 429, text: async () => 'Too Many Requests' }), 'rate_limited', 'RATE_LIMITED'],
  ] as const)('%s 写入 not_billable / 0', async (_caseName, fetchResult, status, errorCode) => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockImplementation(fetchResult);
    const repository = createRepository();
    const rulesRepository = createRulesRepository({
      status: 'found',
      rule: baseRule,
      selectedRule: {
        id: 'rule-001',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        meteringVersion: 'ai-credits-v0.6-test',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        effectiveTo: null,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    });

    await requestAiCall({ repository, rulesRepository });
    const recordInput = repository.createUsageRecord.mock.calls[0][0] as CreateUsageRecordInput;

    expect(recordInput.status).toBe(status);
    expect(recordInput.errorCode).toBe(errorCode);
    expect(recordInput.aiCreditsConsumed).toBe(0);
    expect(recordInput.meteringStatus).toBe('not_billable');
    expect(recordInput.meteringDetails?.billable).toBe(false);
    expect(recordInput.meteringDetails?.reason).toBe('non_succeeded_not_billable');
    expect(rulesRepository.findCurrentRuleForProviderModel).not.toHaveBeenCalled();
  });

  it('sensitive_input_rejected 写入 not_billable / 0，且不调用 provider', async () => {
    const fetchSpy = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchSpy;
    const repository = createRepository();
    const rulesRepository = createRulesRepository({
      status: 'found',
      rule: baseRule,
      selectedRule: {
        id: 'rule-001',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        meteringVersion: 'ai-credits-v0.6-test',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        effectiveTo: null,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    });

    const result = await requestAiCall({
      repository,
      rulesRepository,
      question: '身份证110101199001011234的客户可以做什么项目？',
    });
    const recordInput = repository.createUsageRecord.mock.calls[0][0] as CreateUsageRecordInput;

    expect(result.status).toBe('sensitive_input_rejected');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(repository.findVendorConfig).not.toHaveBeenCalled();
    expect(rulesRepository.findCurrentRuleForProviderModel).not.toHaveBeenCalled();
    expect(recordInput.aiCreditsConsumed).toBe(0);
    expect(recordInput.meteringStatus).toBe('not_billable');
    expect(recordInput.meteringDetails?.reason).toBe('sensitive_input_rejected_not_billable');
  });

  it('quota_exceeded_ai_calls 写入 not_billable / 0', async () => {
    const repository = createRepository();

    await recordAiCallQuotaRejection({
      repository,
      tenantId: 't-001',
      institutionId: 'inst-001',
      actorUserId: 'user-001',
      vendor: 'deepseek',
      model: 'deepseek-v4-flash',
    });
    const recordInput = repository.createUsageRecord.mock.calls[0][0] as CreateUsageRecordInput;

    expect(recordInput.status).toBe('rejected');
    expect(recordInput.errorCode).toBe('quota_exceeded_ai_calls');
    expect(recordInput.aiCreditsConsumed).toBe(0);
    expect(recordInput.meteringStatus).toBe('not_billable');
    expect(recordInput.meteringDetails?.reason).toBe('quota_exceeded_ai_calls_not_billable');
    expect(recordInput.serviceCategory).toBe('ai_qa');
    expect(recordInput.serviceName).toBe('AI 问答');
    expect(recordInput.serviceSource).toBe('institution_ai_call');
    expect(recordInput.serviceAction).toBe('quota_rejected');
    expect(recordInput.serviceVersion).toBe('v06-service-metering-1');
  });

  it('meteringDetails 不包含 prompt / question / answer / rawResponse / apiKey / baseUrl / Authorization', async () => {
    mockFetchSuccess();
    const repository = createRepository();
    const rulesRepository = createRulesRepository({
      status: 'found',
      rule: baseRule,
      selectedRule: {
        id: 'rule-001',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        meteringVersion: 'ai-credits-v0.6-test',
        effectiveFrom: '2026-06-01T00:00:00.000Z',
        effectiveTo: null,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    });

    await requestAiCall({ repository, rulesRepository, question: '冷敷后怎么护理？' });
    const recordInput = repository.createUsageRecord.mock.calls[0][0] as CreateUsageRecordInput;
    const serialized = JSON.stringify(recordInput.meteringDetails);

    expect(serialized).not.toMatch(/prompt|question|answer|rawResponse|apiKey|baseUrl|Authorization|Bearer/i);
    expect(serialized).not.toContain('冷敷后怎么护理？');
    expect(serialized).not.toContain('冷敷后建议避免剧烈热刺激。');
  });

  it('机构端 usage DTO 仍不返回 credits / token / raw provider / model', async () => {
    const records = [createMockUsageRecord({
      aiCreditsConsumed: 5,
      meteringStatus: 'metered',
      meteringVersion: 'ai-credits-v0.6-test',
      meteringDetails: {
        meteringVersion: 'ai-credits-v0.6-test',
        inputTokens: 80,
        outputTokens: 40,
        totalTokens: 120,
        inputTokenWeight: 1,
        outputTokenWeight: 3,
        modelMultiplier: 2,
        creditsPerStandardTokenUnit: 100,
        ragCreditSurcharge: 1,
        weightedStandardTokens: 400,
        formulaVersion: 'ai-credits-v0.6-domain-03',
        billable: true,
        reason: 'succeeded_metered',
        usageStatus: 'succeeded',
      },
    })];
    const repository = createRepository();
    repository.listInstitutionUsageRecords.mockResolvedValue(records);

    const result = await listInstitutionAiCallUsageService({
      repository,
      params: { tenantId: 't-001', institutionId: 'inst-001' },
    });
    const serialized = JSON.stringify(result.records[0]);

    expect(serialized).not.toMatch(
      /aiCreditsConsumed|meteringStatus|meteringVersion|meteringDetails|promptTokens|completionTokens|totalTokens|provider|model/,
    );
    expect(result.records[0].serviceName).toBe('平台 AI 服务');
  });

  it('不改变现有 ai_calls quota resource 统计边界', () => {
    expect(TENANT_QUOTA_RESOURCES).toEqual([
      'customers',
      'appointments',
      'knowledge_files',
      'staff_seats',
      'ai_calls',
    ]);
    expect(TENANT_QUOTA_RESOURCES).not.toContain('ai_credits');
  });
});
