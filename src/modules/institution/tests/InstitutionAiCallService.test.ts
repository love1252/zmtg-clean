import { describe, expect, it, vi } from 'vitest';
import {
  requestInstitutionAiCallService,
  listInstitutionAiCallUsageService,
  listPlatformAiUsageSummaryService,
} from '@/modules/institution/server/institution-ai-call-service';
import type { AiCallUsageRecord } from '@/modules/institution/server/institution-ai-call-service';

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
        contextChunks: ['冷敷是医美术后常见护理环节', '应避免过热和剧烈刺激'],
      },
    });

    expect(result.status).toBe('created');
    expect(result.answer).toBeTruthy();
    expect(result.record).toBeTruthy();
    expect(result.record!.tenantId).toBe('t-001');
    expect(result.record!.institutionId).toBe('inst-001');
    expect(result.record!.provider).toBe('deepseek');
    expect(result.record!.totalTokens).toBe(120);
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
});
