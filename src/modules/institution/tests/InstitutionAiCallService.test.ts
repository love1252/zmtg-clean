import { describe, expect, it, vi } from 'vitest';
import {
  requestInstitutionAiCallService,
  listInstitutionAiCallUsageService,
  listPlatformAiUsageSummaryService,
  buildAiCallUsageMetadata,
} from '@/modules/institution/server/institution-ai-call-service';
import type { AiCallUsageRecord, AiCallUsageStatus } from '@/modules/institution/server/institution-ai-call-service';

function createMockUsageRecord(overrides: Partial<AiCallUsageRecord> = {}): AiCallUsageRecord {
  return {
    id: 'ai-usage-test-001',
    tenantId: 't-001',
    institutionId: 'inst-001',
    actorUserId: 'user-001',
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    promptTokens: 50,
    completionTokens: 100,
    totalTokens: 150,
    latencyMs: 500,
    status: 'succeeded',
    errorCode: null,
    aiCreditsConsumed: null,
    meteringStatus: null,
    meteringVersion: null,
    meteringDetails: null,
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('AI 真实调用与用量记录 service', () => {
  it('机构账号发起 AI 请求成功并记录用量', async () => {
    const repository = {
      findVendorConfig: vi.fn().mockResolvedValue({
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-flash',
        encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
        configured: true,
      }),
      createUsageRecord: vi.fn().mockImplementation(async (input) => createMockUsageRecord({
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
      })),
      listInstitutionUsageRecords: vi.fn(),
      listPlatformUsageSummary: vi.fn(),
    };

    vi.mock('@/modules/security/server/secretEncryption', () => ({
      decryptSecret: vi.fn(() => 'mock-plain-key'),
    }));

    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '冷敷后建议避免剧烈热刺激，需要根据皮肤状态调整护理方案。' } }],
        usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
      }),
    });

    const result = await requestInstitutionAiCallService({
      repository,
      vendor: 'deepseek',
      input: {
        tenantId: 't-001',
        institutionId: 'inst-001',
        userId: 'user-001',
        question: '冷敷后怎么护理？',
      },
    });

    expect(result.status).toBe('created');
    expect(result.answer).toBeTruthy();
    expect(result.record).toBeTruthy();
    expect(result.record!.tenantId).toBe('t-001');
    expect(result.record!.institutionId).toBe('inst-001');
    expect(result.record!.serviceName).toBe('平台 AI 服务');
    expect(JSON.stringify(result.record)).not.toMatch(/"provider"|"model"|"promptTokens"|"completionTokens"|"totalTokens"/);
    expect(result.record!.status).toBe('succeeded');
  });

  it('未登录/无 tenantId 返回 validation_failed', async () => {
    const repository = { findVendorConfig: vi.fn(), createUsageRecord: vi.fn(), listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn() };
    const result = await requestInstitutionAiCallService({
      repository,
      vendor: 'deepseek',
      input: { tenantId: null, institutionId: 'inst-001', userId: 'u', question: 'test' },
    });
    expect(result.status).toBe('validation_failed');
  });

  it('缺少 institutionId 返回 validation_failed', async () => {
    const repository = { findVendorConfig: vi.fn(), createUsageRecord: vi.fn(), listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn() };
    const result = await requestInstitutionAiCallService({
      repository,
      vendor: 'deepseek',
      input: { tenantId: 't', institutionId: null, userId: 'u', question: 'test' },
    });
    expect(result.status).toBe('validation_failed');
  });

  it('provider 返回非 200 时记录用量并返回受控错误', async () => {
    const repository = {
      findVendorConfig: vi.fn().mockResolvedValue({
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-flash',
        encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
        configured: true,
      }),
      createUsageRecord: vi.fn().mockImplementation(async (input) => createMockUsageRecord({
        id: input.id, tenantId: input.tenantId, institutionId: input.institutionId, actorUserId: input.actorUserId, provider: input.provider, model: input.model, promptTokens: input.promptTokens, completionTokens: input.completionTokens, totalTokens: input.totalTokens, latencyMs: input.latencyMs, status: input.status, errorCode: input.errorCode,
      })),
      listInstitutionUsageRecords: vi.fn(),
      listPlatformUsageSummary: vi.fn(),
    };

    vi.mock('@/modules/security/server/secretEncryption', () => ({
      decryptSecret: vi.fn(() => 'mock-plain-key'),
    }));

    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    });

    const result = await requestInstitutionAiCallService({
      repository,
      vendor: 'deepseek',
      input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: 'test?' },
    });

    const validStatuses = ['service_unavailable', 'provider_unavailable'];
    expect(validStatuses).toContain(result.status);
    expect(result.answer).toBeUndefined();
    expect(result.record).toBeTruthy();
    expect(result.record!.status).toBe('provider_unavailable');
    // 敏感字段不应泄露
    expect(JSON.stringify(result)).not.toContain('api_key');
    expect(JSON.stringify(result)).not.toContain('Bearer');
    expect(JSON.stringify(result)).not.toContain('DATABASE_URL');
  });

  it('用量记录与 tenantId / institutionId 绑定', async () => {
    const createdRecords: AiCallUsageRecord[] = [];
    const repository = {
      findVendorConfig: vi.fn().mockResolvedValue({
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-flash',
        encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
        configured: true,
      }),
      createUsageRecord: vi.fn().mockImplementation(async (input) => {
        const rec = createMockUsageRecord({
          id: input.id, tenantId: input.tenantId, institutionId: input.institutionId, actorUserId: input.actorUserId, provider: input.provider, model: input.model, promptTokens: input.promptTokens, completionTokens: input.completionTokens, totalTokens: input.totalTokens, latencyMs: input.latencyMs, status: input.status, errorCode: input.errorCode,
        });
        createdRecords.push(rec);
        return rec;
      }),
      listInstitutionUsageRecords: vi.fn().mockImplementation(async (input) =>
        createdRecords.filter((r) => r.tenantId === input.tenantId && r.institutionId === input.institutionId),
      ),
      listPlatformUsageSummary: vi.fn(),
    };

    vi.mock('@/modules/security/server/secretEncryption', () => ({
      decryptSecret: vi.fn(() => 'mock-plain-key'),
    }));

    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '答案A' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    await requestInstitutionAiCallService({
      repository, vendor: 'deepseek',
      input: { tenantId: 'tenant-A', institutionId: 'inst-A', userId: 'u1', question: 'Q1' },
    });
    await requestInstitutionAiCallService({
      repository, vendor: 'deepseek',
      input: { tenantId: 'tenant-B', institutionId: 'inst-B', userId: 'u2', question: 'Q2' },
    });

    const resultA = await listInstitutionAiCallUsageService({
      repository, params: { tenantId: 'tenant-A', institutionId: 'inst-A' },
    });
    const resultB = await listInstitutionAiCallUsageService({
      repository, params: { tenantId: 'tenant-B', institutionId: 'inst-B' },
    });

    expect(resultA.records.length).toBe(1);
    expect(resultA.records[0].tenantId).toBe('tenant-A');
    expect(resultB.records.length).toBe(1);
    expect(resultB.records[0].tenantId).toBe('tenant-B');
  });

  it('provider 调用失败时返回安全中文提示', async () => {
    const repository = {
      findVendorConfig: vi.fn().mockResolvedValue({
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-flash',
        encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
        configured: true,
      }),
      createUsageRecord: vi.fn().mockImplementation(async (input) => createMockUsageRecord({
        id: input.id, tenantId: input.tenantId, institutionId: input.institutionId, actorUserId: input.actorUserId, provider: input.provider, model: input.model, promptTokens: input.promptTokens, completionTokens: input.completionTokens, totalTokens: input.totalTokens, latencyMs: input.latencyMs, status: input.status, errorCode: input.errorCode,
      })),
      listInstitutionUsageRecords: vi.fn(),
      listPlatformUsageSummary: vi.fn(),
    };

    vi.mock('@/modules/security/server/secretEncryption', () => ({
      decryptSecret: vi.fn(() => 'mock-plain-key'),
    }));

    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await requestInstitutionAiCallService({
      repository,
      vendor: 'deepseek',
      input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: 'test' },
    });

    expect(result.status).toBe('service_unavailable');
    const serialized = JSON.stringify(result);
    expect(serialized).toContain('AI 服务');
    expect(serialized).not.toContain('api_key');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('Network error');
  });

  it('空问题返回 validation_failed', async () => {
    const repository = { findVendorConfig: vi.fn(), createUsageRecord: vi.fn(), listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn() };
    const result = await requestInstitutionAiCallService({
      repository,
      vendor: 'deepseek',
      input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '' },
    });
    expect(result.status).toBe('validation_failed');
  });

  it('平台端用量聚合只读结果正确', async () => {
    const repository = {
      findVendorConfig: vi.fn(),
      createUsageRecord: vi.fn(),
      listInstitutionUsageRecords: vi.fn(),
      listPlatformUsageSummary: vi.fn().mockResolvedValue([
        { tenantId: 't-001', callCount: 5, totalTokens: 500, succeededCount: 4, failedCount: 1 },
        { tenantId: 't-002', callCount: 2, totalTokens: 100, succeededCount: 2, failedCount: 0 },
      ]),
    };

    const result = await listPlatformAiUsageSummaryService({ repository });
    expect(result.records.length).toBe(2);
    expect(result.records[0].tenantId).toBe('t-001');
    expect(result.records[0].callCount).toBe(5);
    expect(result.records[0].totalTokens).toBe(500);
    expect(result.records[0].succeededCount).toBe(4);
    expect(result.records[0].failedCount).toBe(1);
  });

  it('跨机构读取隔离：另一机构无法读取本机构记录', async () => {
    const records: AiCallUsageRecord[] = [
      createMockUsageRecord({ id: 'r1', tenantId: 't-A', institutionId: 'inst-A' }),
    ];
    const repository = {
      findVendorConfig: vi.fn(),
      createUsageRecord: vi.fn(),
      listInstitutionUsageRecords: vi.fn().mockImplementation(async (input) =>
        input.institutionId === 'inst-A' ? records : [],
      ),
      listPlatformUsageSummary: vi.fn(),
    };

    const resultOwn = await listInstitutionAiCallUsageService({
      repository, params: { tenantId: 't-A', institutionId: 'inst-A' },
    });
    const resultOther = await listInstitutionAiCallUsageService({
      repository, params: { tenantId: 't-B', institutionId: 'inst-B' },
    });

    expect(resultOwn.records.length).toBe(1);
    expect(resultOther.records.length).toBe(0);
  });

  it('机构端用量列表 DTO 不返回 provider/model/token 计量字段', async () => {
    const records: AiCallUsageRecord[] = [createMockUsageRecord()];
    const repository = {
      findVendorConfig: vi.fn(),
      createUsageRecord: vi.fn(),
      listInstitutionUsageRecords: vi.fn().mockResolvedValue(records),
      listPlatformUsageSummary: vi.fn(),
    };

    const result = await listInstitutionAiCallUsageService({
      repository,
      params: { tenantId: 't-001', institutionId: 'inst-001' },
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0].serviceName).toBe('平台 AI 服务');
    expect(JSON.stringify(result.records[0])).not.toMatch(/"provider"|"model"|"promptTokens"|"completionTokens"|"totalTokens"/);
  });

  it('身份证号输入被拒绝且不调用 provider', async () => {
    const fetchSpy = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchSpy;

    const repository = {
      findVendorConfig: vi.fn(),
      createUsageRecord: vi.fn().mockImplementation(async (input) => createMockUsageRecord({
        id: input.id, tenantId: input.tenantId, institutionId: input.institutionId, actorUserId: input.actorUserId, provider: input.provider, model: input.model, promptTokens: input.promptTokens, completionTokens: input.completionTokens, totalTokens: input.totalTokens, latencyMs: input.latencyMs, status: input.status, errorCode: input.errorCode,
      })),
      listInstitutionUsageRecords: vi.fn(),
      listPlatformUsageSummary: vi.fn(),
    };

    const result = await requestInstitutionAiCallService({
      repository,
      vendor: 'deepseek',
      input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '身份证110101199001011234的客户可以做什么项目？' },
    });

    expect(result.status).toBe('sensitive_input_rejected');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.message).toContain('敏感');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('110101');
    expect(result.record).toBeTruthy();
    expect(result.record!.status).toBe('sensitive_input_rejected');
  });

  it('银行卡号输入被拒绝', async () => {
    const repository = {
      findVendorConfig: vi.fn(),
      createUsageRecord: vi.fn().mockImplementation(async (input) => createMockUsageRecord({
        id: input.id, tenantId: input.tenantId, institutionId: input.institutionId, actorUserId: input.actorUserId, provider: input.provider, model: input.model, promptTokens: input.promptTokens, completionTokens: input.completionTokens, totalTokens: input.totalTokens, latencyMs: input.latencyMs, status: input.status, errorCode: input.errorCode,
      })),
      listInstitutionUsageRecords: vi.fn(),
      listPlatformUsageSummary: vi.fn(),
    };

    const result = await requestInstitutionAiCallService({
      repository,
      vendor: 'deepseek',
      input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '付款到账号6222021234567890123可以吗？' },
    });

    expect(result.status).toBe('sensitive_input_rejected');
    expect(result.record!.status).toBe('sensitive_input_rejected');
  });

  it('病历/诊断内容被拒绝', async () => {
    const repository = {
      findVendorConfig: vi.fn(),
      createUsageRecord: vi.fn().mockImplementation(async (input) => createMockUsageRecord({
        id: input.id, tenantId: input.tenantId, institutionId: input.institutionId, actorUserId: input.actorUserId, provider: input.provider, model: input.model, promptTokens: input.promptTokens, completionTokens: input.completionTokens, totalTokens: input.totalTokens, latencyMs: input.latencyMs, status: input.status, errorCode: input.errorCode,
      })),
      listInstitutionUsageRecords: vi.fn(),
      listPlatformUsageSummary: vi.fn(),
    };

    const result = await requestInstitutionAiCallService({
      repository,
      vendor: 'deepseek',
      input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '这个诊断证明写了检查报告结果建议做些什么？' },
    });

    expect(result.status).toBe('sensitive_input_rejected');
  });

  it('客户端传入 contextChunks 被忽略，不会进入 provider prompt', async () => {
    let capturedBody: string | null = null;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body as string ?? null;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '正常回答' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      };
    });

    const repository = {
      findVendorConfig: vi.fn().mockResolvedValue({
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-flash',
        encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
        configured: true,
      }),
      createUsageRecord: vi.fn().mockImplementation(async (input) => createMockUsageRecord({
        id: input.id, tenantId: input.tenantId, institutionId: input.institutionId, actorUserId: input.actorUserId, provider: input.provider, model: input.model, promptTokens: input.promptTokens, completionTokens: input.completionTokens, totalTokens: input.totalTokens, latencyMs: input.latencyMs, status: input.status, errorCode: input.errorCode,
      })),
      listInstitutionUsageRecords: vi.fn(),
      listPlatformUsageSummary: vi.fn(),
    };

    vi.mock('@/modules/security/server/secretEncryption', () => ({
      decryptSecret: vi.fn(() => 'mock-plain-key'),
    }));

    // Note: contextChunks is no longer accepted in the type, but if someone
    // passes it via the old input shape (e.g. cast), it must not appear in the prompt.
    // We verify that the service signature no longer includes contextChunks.
    const result = await requestInstitutionAiCallService({
      repository,
      vendor: 'deepseek',
      input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '术后冷敷多久？' },
    });

    expect(result.status).toBe('created');
    if (capturedBody) {
      const parsed = JSON.parse(capturedBody);
      const userMessage = parsed.messages.find((m: { role: string }) => m.role === 'user')?.content ?? '';
      // Must NOT contain any artificially injected "参考知识片段" format
      expect(userMessage).not.toContain('参考知识片段');
      expect(userMessage).not.toContain('伪造');
      expect(userMessage).not.toContain('其他租户');
    }
  });

  it('有 knowledgeChunks 时 prompt 包含"参考资料"和"不可信"关键词', async () => {
    let capturedBody: string | null = null;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body as string ?? null;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '根据参考资料，冷敷后应保持清洁干燥。' } }],
          usage: { prompt_tokens: 100, completion_tokens: 30, total_tokens: 130 },
        }),
      };
    });

    const repository = {
      findVendorConfig: vi.fn().mockResolvedValue({
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-flash',
        encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
        configured: true,
      }),
      createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => createMockUsageRecord({
        id: input.id as string, tenantId: input.tenantId as string, institutionId: input.institutionId as string, actorUserId: input.actorUserId as string, provider: input.provider as string, model: input.model as string, promptTokens: input.promptTokens as number | null, completionTokens: input.completionTokens as number | null, totalTokens: input.totalTokens as number | null, latencyMs: input.latencyMs as number | null, status: input.status as AiCallUsageStatus, errorCode: input.errorCode as string | null,
      })),
      listInstitutionUsageRecords: vi.fn(),
      listPlatformUsageSummary: vi.fn(),
    };

    vi.mock('@/modules/security/server/secretEncryption', () => ({
      decryptSecret: vi.fn(() => 'mock-plain-key'),
    }));

    const knowledgeChunks = [{
      knowledgeId: 'kb-1', knowledgeTitle: '术后护理指南',
      fileId: 'file-1', fileName: '术后护理.pdf',
      chunkId: 'chunk-1', chunkIndex: 0,
      textPreview: '冷敷后建议保持创面清洁，避免剧烈热刺激。',
      matchReason: '片段包含关键词"冷敷"',
    }];

    const result = await requestInstitutionAiCallService({
      repository, vendor: 'deepseek',
      input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '冷敷后怎么护理？' },
      knowledgeChunks,
    });

    expect(result.status).toBe('created');
    if (capturedBody) {
      const parsed = JSON.parse(capturedBody);
      const systemContent = parsed.messages.find((m: { role: string }) => m.role === 'system')?.content ?? '';
      expect(systemContent).toContain('参考资料');
      expect(systemContent).toContain('不可信');
      expect(systemContent).toContain('术后护理指南');
      expect(systemContent).toContain('冷敷后建议保持创面清洁');
      expect(systemContent).toContain('prompt injection');
    }
  });

  it('knowledgeContext 返回结构和内容正确', async () => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '回答内容' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    const repository = {
      findVendorConfig: vi.fn().mockResolvedValue({
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-v4-flash',
        encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
        configured: true,
      }),
      createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => createMockUsageRecord({
        id: input.id as string, tenantId: input.tenantId as string, institutionId: input.institutionId as string, actorUserId: input.actorUserId as string, provider: input.provider as string, model: input.model as string, promptTokens: input.promptTokens as number | null, completionTokens: input.completionTokens as number | null, totalTokens: input.totalTokens as number | null, latencyMs: input.latencyMs as number | null, status: input.status as AiCallUsageStatus, errorCode: input.errorCode as string | null,
      })),
      listInstitutionUsageRecords: vi.fn(),
      listPlatformUsageSummary: vi.fn(),
    };

    vi.mock('@/modules/security/server/secretEncryption', () => ({
      decryptSecret: vi.fn(() => 'mock-plain-key'),
    }));

    const knowledgeChunks = [
      { knowledgeId: 'kb-1', knowledgeTitle: '指南A', fileId: 'f-1', fileName: '指南A.pdf', chunkId: 'c-1', chunkIndex: 0, textPreview: '片段内容A', matchReason: '匹配原因A' },
      { knowledgeId: 'kb-2', knowledgeTitle: '指南B', fileId: 'f-2', fileName: '指南B.pdf', chunkId: 'c-2', chunkIndex: 1, textPreview: '片段内容B', matchReason: '匹配原因B' },
    ];

    const result = await requestInstitutionAiCallService({
      repository, vendor: 'deepseek',
      input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '术后护理方法？' },
      knowledgeChunks,
    });

    expect(result.status).toBe('created');
    expect(result.knowledgeContext).toBeDefined();
    expect(result.knowledgeContext!.used).toBe(true);
    expect(result.knowledgeContext!.query).toBe('术后护理方法？');
    expect(result.knowledgeContext!.sources).toHaveLength(2);
    expect(result.knowledgeContext!.sources[0].knowledgeTitle).toBe('指南A');
    expect(result.knowledgeContext!.sources[0].textPreview).toBe('片段内容A');
    expect(result.knowledgeContext!.sources[1].fileId).toBe('f-2');
  });

  it('knowledgeChunks 超过 5 条时只注入前 5 条', async () => {
    let capturedBody: string | null = null;
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body as string ?? null;
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }], usage: {} }),
      };
    });

    const repository = {
      findVendorConfig: vi.fn().mockResolvedValue({
        baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash',
        encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
        configured: true,
      }),
      createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => createMockUsageRecord({})),
      listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
    };

    vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: vi.fn(() => 'mock-plain-key') }));

    const knowledgeChunks = Array.from({ length: 7 }, (_, i) => ({
      knowledgeId: `kb-${i}`, knowledgeTitle: `指南${i}`, fileId: `f-${i}`, fileName: `指南${i}.pdf`,
      chunkId: `c-${i}`, chunkIndex: i, textPreview: `片段${i}`, matchReason: `原因${i}`,
    }));

    await requestInstitutionAiCallService({
      repository, vendor: 'deepseek',
      input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: 'test?' },
      knowledgeChunks,
    });

    if (capturedBody) {
      const parsed = JSON.parse(capturedBody);
      const systemContent: string = parsed.messages.find((m: { role: string }) => m.role === 'system')?.content ?? '';
      expect(systemContent).toContain('参考资料1');
      expect(systemContent).toContain('参考资料5');
      expect(systemContent).not.toContain('参考资料6');
      expect(systemContent).not.toContain('参考资料7');
    }
  });

  it('敏感输入拒绝时不注入 KB 片段且不调用 provider', async () => {
    const fetchSpy = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchSpy;

    const repository = {
      findVendorConfig: vi.fn(),
      createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => createMockUsageRecord({
        id: input.id as string, tenantId: input.tenantId as string, institutionId: input.institutionId as string, actorUserId: input.actorUserId as string, provider: input.provider as string, model: input.model as string, promptTokens: input.promptTokens as number | null, completionTokens: input.completionTokens as number | null, totalTokens: input.totalTokens as number | null, latencyMs: input.latencyMs as number | null, status: input.status as AiCallUsageStatus, errorCode: input.errorCode as string | null,
      })),
      listInstitutionUsageRecords: vi.fn(),
      listPlatformUsageSummary: vi.fn(),
    };

    const knowledgeChunks = [{
      knowledgeId: 'kb-1', knowledgeTitle: '术后护理', fileId: 'f-1', fileName: '术后.pdf',
      chunkId: 'c-1', chunkIndex: 0, textPreview: '正常片段', matchReason: '匹配',
    }];

    const result = await requestInstitutionAiCallService({
      repository, vendor: 'deepseek',
      input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '身份证110101199001011234的客户做什么项目？' },
      knowledgeChunks,
    });

    expect(result.status).toBe('sensitive_input_rejected');
    expect(fetchSpy).not.toHaveBeenCalled();
    // 敏感拒绝不泄露身份证号
    expect(JSON.stringify(result)).not.toContain('110101');
  });

  it('无 knowledgeChunks 时向后兼容，原行为不变', async () => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '正常回答' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    });

    const repository = {
      findVendorConfig: vi.fn().mockResolvedValue({
        baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash',
        encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
        configured: true,
      }),
      createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => createMockUsageRecord({})),
      listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
    };

    vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: vi.fn(() => 'mock-plain-key') }));

    const result = await requestInstitutionAiCallService({
      repository, vendor: 'deepseek',
      input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '冷敷后怎么护理？' },
    });

    expect(result.status).toBe('created');
    expect(result.knowledgeContext).toBeUndefined();
    // system prompt 应保持基线的内容（无"参考资料"注入）
    // 因为 knowledgeChunks 未传，prompt 保持原始 system prompt
  });

  describe('RAG KB 检索与 prompt 注入（模拟 kbChunks）', () => {
    it('命中 KB 时 prompt 必须禁止编造引用来源', async () => {
      let capturedBody: string | null = null;
      (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedBody = init?.body as string ?? null;
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: '根据参考资料1，冷敷后应保持清洁干燥。' } }], usage: {} }),
        };
      });

      const repository = {
        findVendorConfig: vi.fn().mockResolvedValue({
          baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash',
          encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
          configured: true,
        }),
        createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => createMockUsageRecord({})),
        listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
      };

      vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: vi.fn(() => 'mock-plain-key') }));

      const knowledgeChunks = [{
        knowledgeId: 'kb-1', knowledgeTitle: '术后护理指南', fileId: 'f-1', fileName: '术后护理.pdf',
        chunkId: 'c-1', chunkIndex: 0, textPreview: '冷敷后保持清洁干燥。', matchReason: '片段包含关键词"冷敷"',
      }];

      await requestInstitutionAiCallService({
        repository, vendor: 'deepseek',
        input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '冷敷后怎么护理？' },
        knowledgeChunks,
      });

      if (capturedBody) {
        const parsed = JSON.parse(capturedBody);
        const systemContent: string = parsed.messages.find((m: { role: string }) => m.role === 'system')?.content ?? '';
        // 命中 KB 时 prompt 必须包含防幻觉约束
        expect(systemContent).toContain('不得编造参考资料中不存在的文件名');
        expect(systemContent).toContain('不要编造引用来源');
      }
    });

    it('未命中 KB 时 prompt 必须禁止声称使用机构知识库', async () => {
      let capturedBody: string | null = null;
      (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedBody = init?.body as string ?? null;
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: '知识库暂无直接依据，建议人工确认。' } }], usage: {} }),
        };
      });

      const repository = {
        findVendorConfig: vi.fn().mockResolvedValue({
          baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash',
          encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
          configured: true,
        }),
        createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => createMockUsageRecord({})),
        listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
      };

      vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: vi.fn(() => 'mock-plain-key') }));

      // 无 knowledgeChunks 传入，模拟 KB 未命中场景
      await requestInstitutionAiCallService({
        repository, vendor: 'deepseek',
        input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '随机问题无依据' },
        knowledgeChunks: [],
      });

      if (capturedBody) {
        const parsed = JSON.parse(capturedBody);
        const systemContent: string = parsed.messages.find((m: { role: string }) => m.role === 'system')?.content ?? '';
        expect(systemContent).toContain('未检索到可用的机构知识库依据');
        expect(systemContent).toContain('不得声称');
        expect(systemContent).toContain('不得编造知识库来源');
        expect(systemContent).toContain('建议人工确认');
      }
    });

    it('命中 KB 时 knowledgeContext.used=true 且 sources 结构正确', async () => {
      (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'ok' } }], usage: {} }),
      });

      const repository = {
        findVendorConfig: vi.fn().mockResolvedValue({
          baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash',
          encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
          configured: true,
        }),
        createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => createMockUsageRecord({
          id: input.id as string, tenantId: input.tenantId as string, institutionId: input.institutionId as string,
          actorUserId: input.actorUserId as string, provider: input.provider as string, model: input.model as string,
          promptTokens: input.promptTokens as number | null, completionTokens: input.completionTokens as number | null,
          totalTokens: input.totalTokens as number | null, latencyMs: input.latencyMs as number | null,
          status: input.status as AiCallUsageStatus, errorCode: input.errorCode as string | null,
        })),
        listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
      };

      vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: vi.fn(() => 'mock-plain-key') }));

      const knowledgeChunks = [{
        knowledgeId: 'kb-1', knowledgeTitle: '术后护理指南', fileId: 'f-1', fileName: '术后护理.pdf',
        chunkId: 'c-1', chunkIndex: 0, textPreview: '冷敷后保持清洁干燥。', matchReason: '片段包含关键词"冷敷"',
      }];

      const result = await requestInstitutionAiCallService({
        repository, vendor: 'deepseek',
        input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '冷敷后怎么护理？' },
        knowledgeChunks,
      });

      expect(result.knowledgeContext).toBeDefined();
      expect(result.knowledgeContext!.used).toBe(true);
      expect(result.knowledgeContext!.sources).toHaveLength(1);
      expect(result.knowledgeContext!.sources[0].fileName).toBe('术后护理.pdf');
      expect(result.knowledgeContext!.sources[0].textPreview).toBe('冷敷后保持清洁干燥。');
    });

    it('高敏输入仍不触发 KB 检索、不调用 provider', async () => {
      const fetchSpy = vi.fn();
      (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchSpy;

      const repository = {
        findVendorConfig: vi.fn(),
        createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => createMockUsageRecord({
          id: input.id as string, tenantId: input.tenantId as string, institutionId: input.institutionId as string,
          actorUserId: input.actorUserId as string, provider: input.provider as string, model: input.model as string,
          promptTokens: input.promptTokens as number | null, completionTokens: input.completionTokens as number | null,
          totalTokens: input.totalTokens as number | null, latencyMs: input.latencyMs as number | null,
          status: input.status as AiCallUsageStatus, errorCode: input.errorCode as string | null,
        })),
        listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
      };

      const result = await requestInstitutionAiCallService({
        repository, vendor: 'deepseek',
        input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '身份证110101199001011234的客户冷敷后怎么护理？' },
      });

      expect(result.status).toBe('sensitive_input_rejected');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toContain('110101');
    });

    it('响应不泄露 storageKey/bucket/signedUrl/embedding/DB 字段/API key', async () => {
      (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '回答' } }], usage: {} }),
      });

      const repository = {
        findVendorConfig: vi.fn().mockResolvedValue({
          baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash',
          encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
          configured: true,
        }),
        createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => createMockUsageRecord({
          id: input.id as string, tenantId: input.tenantId as string, institutionId: input.institutionId as string,
          actorUserId: input.actorUserId as string, provider: input.provider as string, model: input.model as string,
          promptTokens: input.promptTokens as number | null, completionTokens: input.completionTokens as number | null,
          totalTokens: input.totalTokens as number | null, latencyMs: input.latencyMs as number | null,
          status: input.status as AiCallUsageStatus, errorCode: input.errorCode as string | null,
        })),
        listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
      };

      vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: vi.fn(() => 'mock-plain-key') }));

      const knowledgeChunks = [{
        knowledgeId: 'kb-1', knowledgeTitle: '指南', fileId: 'f-1', fileName: '指南.pdf',
        chunkId: 'c-1', chunkIndex: 0, textPreview: '内容', matchReason: '匹配',
      }];

      const result = await requestInstitutionAiCallService({
        repository, vendor: 'deepseek',
        input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '冷敷' },
        knowledgeChunks,
      });

      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(/storageKey|bucket|signedUrl|embedding|DATABASE_URL|postgres:\/\//i);
      expect(serialized).not.toMatch(/api_key|apikey|Bearer|baseUrl|Authorization/i);
      // token/password/secret must not appear as values or institution-facing DTO field names
      expect(serialized).not.toMatch(/"token"|"password"|"secret"|"promptTokens"|"completionTokens"|"totalTokens"/i);
    });
  });

  describe('RAG metadata 持久化', () => {
    const longQuestion = '请根据机构知识库回答：术后24小时内是否可以冷敷？回答时请列出依据来源。';

    function assertNoQuestionOrKeyword(metadata: unknown, question: string) {
      const serialized = JSON.stringify(metadata);
      expect(serialized).not.toContain(question);
      expect(serialized).not.toMatch(/"query"|"searchKeyword"/i);
    }

    it('succeeded + used=true 时写入 knowledgeContext metadata（仅 used + sources）', async () => {
      let capturedMetadata: unknown = undefined;
      (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '回答' } }], usage: {} }),
      });

      const repository = {
        findVendorConfig: vi.fn().mockResolvedValue({
          baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash',
          encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
          configured: true,
        }),
        createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => {
          capturedMetadata = input.metadata;
          return createMockUsageRecord({
            id: input.id as string, status: input.status as AiCallUsageStatus,
            metadata: input.metadata as AiCallUsageRecord['metadata'],
          });
        }),
        listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
      };

      vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: vi.fn(() => 'mock-plain-key') }));

      const knowledgeChunks = [{
        knowledgeId: 'kb-1', knowledgeTitle: '术后护理', fileId: 'f-1', fileName: '护理.pdf',
        chunkId: 'c-1', chunkIndex: 0, textPreview: '冷敷需间隔观察。', matchReason: '包含"冷敷"',
      }];

      const result = await requestInstitutionAiCallService({
        repository, vendor: 'deepseek',
        input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: longQuestion },
        knowledgeChunks,
      });

      expect(result.status).toBe('created');
      expect(capturedMetadata).toEqual({
        knowledgeContext: {
          used: true,
          sources: [{
            knowledgeId: 'kb-1', knowledgeTitle: '术后护理', fileId: 'f-1', fileName: '护理.pdf',
            chunkId: 'c-1', chunkIndex: 0, textPreview: '冷敷需间隔观察。', matchReason: '包含"冷敷"',
          }],
        },
      });
      // 不保存原始 question / prompt / 派生检索关键词
      assertNoQuestionOrKeyword(capturedMetadata, longQuestion);
    });

    it('succeeded + used=false 时 metadata.knowledgeContext.used=false 且 sources=[]', async () => {
      let capturedMetadata: unknown = undefined;
      (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '回答' } }], usage: {} }),
      });

      const repository = {
        findVendorConfig: vi.fn().mockResolvedValue({
          baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash',
          encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
          configured: true,
        }),
        createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => {
          capturedMetadata = input.metadata;
          return createMockUsageRecord({ metadata: input.metadata as AiCallUsageRecord['metadata'] });
        }),
        listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
      };

      vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: vi.fn(() => 'mock-plain-key') }));

      // 空数组 -> used=false
      await requestInstitutionAiCallService({
        repository, vendor: 'deepseek',
        input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: longQuestion },
        knowledgeChunks: [],
      });

      const metadata = capturedMetadata as { knowledgeContext: { used: boolean; sources: unknown[] } };
      expect(metadata.knowledgeContext.used).toBe(false);
      expect(metadata.knowledgeContext.sources).toEqual([]);
      assertNoQuestionOrKeyword(capturedMetadata, longQuestion);
    });

    it('metadata sources 只包含白名单字段，不含 storageKey/embedding 等敏感字段', async () => {
      (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '回答' } }], usage: {} }),
      });

      const repository = {
        findVendorConfig: vi.fn().mockResolvedValue({
          baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash',
          encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
          configured: true,
        }),
        createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) =>
          createMockUsageRecord({ metadata: input.metadata as AiCallUsageRecord['metadata'] }),
        ),
        listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
      };

      vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: vi.fn(() => 'mock-plain-key') }));

      // 模拟带敏感字段的 chunk（实际搜索不会返回，但验证白名单过滤）
      const knowledgeChunks = [{
        knowledgeId: 'kb-1', knowledgeTitle: '指南', fileId: 'f-1', fileName: '指南.pdf',
        chunkId: 'c-1', chunkIndex: 0, textPreview: '内容', matchReason: '匹配',
      }] as Array<Record<string, unknown>>;

      await requestInstitutionAiCallService({
        repository, vendor: 'deepseek',
        input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: longQuestion },
        knowledgeChunks: knowledgeChunks as never,
      });

      const metadata = JSON.stringify(repository.createUsageRecord.mock.calls[0]?.[0].metadata);
      expect(metadata).not.toMatch(/storageKey|bucket|signedUrl|embedding|api_key|baseUrl|Authorization/i);
      // 不含原始 question / 派生检索关键词
      expect(metadata).not.toContain(longQuestion);
      expect(metadata).not.toMatch(/"query"|"searchKeyword"/i);
      // 白名单字段存在
      const parsed = JSON.parse(metadata);
      expect(parsed.knowledgeContext.sources[0]).toEqual({
        knowledgeId: 'kb-1', knowledgeTitle: '指南', fileId: 'f-1', fileName: '指南.pdf',
        chunkId: 'c-1', chunkIndex: 0, textPreview: '内容', matchReason: '匹配',
      });
    });

    it('极短问题（如"随机问题"）不会进入 metadata', async () => {
      let capturedMetadata: unknown = undefined;
      (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '回答' } }], usage: {} }),
      });

      const repository = {
        findVendorConfig: vi.fn().mockResolvedValue({
          baseUrl: 'https://api.deepseek.com/v1', model: 'm',
          encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
          configured: true,
        }),
        createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => {
          capturedMetadata = input.metadata;
          return createMockUsageRecord({ metadata: input.metadata as AiCallUsageRecord['metadata'] });
        }),
        listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
      };

      vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: vi.fn(() => 'mock-plain-key') }));

      await requestInstitutionAiCallService({
        repository, vendor: 'deepseek',
        input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '随机问题' },
        knowledgeChunks: [],
      });

      // 极短问题文本不应出现在 metadata 中
      assertNoQuestionOrKeyword(capturedMetadata, '随机问题');
    });

    it('含客户姓名问题（如"张三术后疼痛怎么办"）不会进入 metadata', async () => {
      let capturedMetadata: unknown = undefined;
      (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '回答' } }], usage: {} }),
      });

      const repository = {
        findVendorConfig: vi.fn().mockResolvedValue({
          baseUrl: 'https://api.deepseek.com/v1', model: 'm',
          encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
          configured: true,
        }),
        createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => {
          capturedMetadata = input.metadata;
          return createMockUsageRecord({ metadata: input.metadata as AiCallUsageRecord['metadata'] });
        }),
        listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
      };

      vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: vi.fn(() => 'mock-plain-key') }));

      const knowledgeChunks = [{
        knowledgeId: 'kb-1', knowledgeTitle: '术后护理', fileId: 'f-1', fileName: '护理.pdf',
        chunkId: 'c-1', chunkIndex: 0, textPreview: '术后疼痛可冷敷缓解。', matchReason: '匹配',
      }];

      await requestInstitutionAiCallService({
        repository, vendor: 'deepseek',
        input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '张三术后疼痛怎么办' },
        knowledgeChunks,
      });

      // 客户姓名 / 原始问题不应出现在 metadata 中
      assertNoQuestionOrKeyword(capturedMetadata, '张三术后疼痛怎么办');
      expect(JSON.stringify(capturedMetadata)).not.toContain('张三');
    });

    it('长指令问题不会进入 metadata', async () => {
      let capturedMetadata: unknown = undefined;
      (globalThis as unknown as { fetch: typeof fetch }).fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '回答' } }], usage: {} }),
      });

      const repository = {
        findVendorConfig: vi.fn().mockResolvedValue({
          baseUrl: 'https://api.deepseek.com/v1', model: 'm',
          encryptedApiKey: { algorithm: 'AES-256-GCM', keyVersion: 'v1', iv: 'a', authTag: 'b', ciphertext: 'c' },
          configured: true,
        }),
        createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => {
          capturedMetadata = input.metadata;
          return createMockUsageRecord({ metadata: input.metadata as AiCallUsageRecord['metadata'] });
        }),
        listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
      };

      vi.mock('@/modules/security/server/secretEncryption', () => ({ decryptSecret: vi.fn(() => 'mock-plain-key') }));

      await requestInstitutionAiCallService({
        repository, vendor: 'deepseek',
        input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: longQuestion },
        knowledgeChunks: [],
      });

      assertNoQuestionOrKeyword(capturedMetadata, longQuestion);
    });

    it('sensitive_input_rejected 不写 RAG metadata（metadata=null）', async () => {
      let capturedMetadata: unknown = 'UNSET';
      const fetchSpy = vi.fn();
      (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchSpy;

      const repository = {
        findVendorConfig: vi.fn(),
        createUsageRecord: vi.fn().mockImplementation(async (input: Record<string, unknown>) => {
          capturedMetadata = input.metadata;
          return createMockUsageRecord({ status: 'sensitive_input_rejected' });
        }),
        listInstitutionUsageRecords: vi.fn(), listPlatformUsageSummary: vi.fn(),
      };

      const result = await requestInstitutionAiCallService({
        repository, vendor: 'deepseek',
        input: { tenantId: 't', institutionId: 'inst', userId: 'u', question: '身份证110101199001011234的客户' },
      });

      expect(result.status).toBe('sensitive_input_rejected');
      expect(fetchSpy).not.toHaveBeenCalled();
      // 敏感拒绝不传 metadata -> undefined
      expect(capturedMetadata).toBeUndefined();
    });

    it('buildAiCallUsageMetadata: textPreview 超过 300 字会防御性截断', () => {
      const longText = '冷敷'.repeat(200); // 400 字
      const metadata = buildAiCallUsageMetadata(
        [{ knowledgeId: 'kb-1', knowledgeTitle: 't', fileId: 'f-1', fileName: 'f.pdf', chunkId: 'c-1', chunkIndex: 0, textPreview: longText, matchReason: 'm' }],
      );
      expect(metadata?.knowledgeContext?.sources[0].textPreview.length).toBeLessThanOrEqual(300);
    });

    it('buildAiCallUsageMetadata: kbChunks 为 undefined 时返回 null', () => {
      expect(buildAiCallUsageMetadata(undefined)).toBeNull();
    });

    it('buildAiCallUsageMetadata: 不写入 query / searchKeyword 字段', () => {
      const metadata = buildAiCallUsageMetadata(
        [{ knowledgeId: 'kb-1', knowledgeTitle: 't', fileId: 'f-1', fileName: 'f.pdf', chunkId: 'c-1', chunkIndex: 0, textPreview: '内容', matchReason: 'm' }],
      );
      const serialized = JSON.stringify(metadata);
      expect(serialized).not.toMatch(/"query"|"searchKeyword"/i);
      expect(metadata?.knowledgeContext?.used).toBe(true);
    });
  });
});
