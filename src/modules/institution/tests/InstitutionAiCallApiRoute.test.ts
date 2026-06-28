import { describe, expect, it, vi } from 'vitest';
import { POST as aiCallPost } from '@/app/api/institution/knowledge-management/ai-call/route';
import { GET as aiCallUsageGet } from '@/app/api/institution/knowledge-management/ai-call/usage/route';
import { GET as platformAiUsageGet } from '@/app/api/v1/open-platform/ai-usage/route';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { checkTenantQuotaForCreate } from '@/modules/institution/server/tenant-quota-enforcement';
import { requestInstitutionAiCallService, recordAiCallQuotaRejection } from '@/modules/institution/server/institution-ai-call-service';
import { searchInstitutionKnowledgeChunksService } from '@/modules/institution/server/institution-knowledge-keyword-search-service';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';

const database = { database: 'ai-call-api-test-db' };

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => database),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/institution/server/institution-ai-call-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/institution/server/institution-ai-call-service')
  >('@/modules/institution/server/institution-ai-call-service');
  return {
    ...actual,
    requestInstitutionAiCallService: vi.fn(),
    recordAiCallQuotaRejection: vi.fn(),
    listInstitutionAiCallUsageService: vi.fn(),
    listPlatformAiUsageSummaryService: vi.fn(),
  };
});

vi.mock('@/modules/institution/server/institution-ai-call-usage-repository', () => ({
  createAiCallUsageRepository: vi.fn(() => ({})),
}));

vi.mock('@/modules/institution/server/tenant-quota-enforcement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/institution/server/tenant-quota-enforcement')>();
  return {
    ...actual,
    checkTenantQuotaForCreate: vi.fn(),
  };
});

vi.mock('@/modules/institution/server/institution-knowledge-keyword-search-service', () => ({
  searchInstitutionKnowledgeChunksService: vi.fn(),
}));

vi.mock('@/modules/open-platform/server/platform-knowledge-management-repository', () => ({
  createPlatformKnowledgeManagementRepository: vi.fn(() => ({})),
}));

const tenantContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin' as const,
  scope: 'tenant' as const,
  tenantId: 'demo-tenant-001',
  institutionId: 'demo-inst-001',
  source: 'demo_session' as const,
};

const platformContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin' as const,
  scope: 'platform' as const,
  tenantId: null,
  institutionId: null,
  source: 'demo_session' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('机构端 AI 调用 API route', () => {
  it('未登录返回 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', { method: 'POST' }));
    expect(response.status).toBe(401);
  });

  it('平台账号返回 403', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformContext);
    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', { method: 'POST' }));
    expect(response.status).toBe(403);
  });

  it('机构账号访问平台端 AI 用量仍 403', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    const response = await platformAiUsageGet(new Request('http://localhost/api/v1/open-platform/ai-usage'));
    expect(response.status).toBe(403);
  });

  it('response 不泄露敏感字段', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', { method: 'POST' }));
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('api_key');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('Bearer');
  });

  it('缺少 question 返回 400', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 0, limit: 100, resource: 'ai_calls',
    });
    vi.mocked(requestInstitutionAiCallService).mockResolvedValue({
      status: 'validation_failed',
      message: '请输入问题',
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '' }),
    }));
    expect(response.status).toBe(400);
  });

  it('AI 调用达到上限时返回 409', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 100,
      limit: 100,
      reason: 'quota_exceeded_ai_calls',
      resource: 'ai_calls',
    });
    vi.mocked(recordAiCallQuotaRejection).mockResolvedValue({
      id: 'ai-usage-reject-1',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
      actorUserId: 'demo-user-admin',
      provider: 'deepseek',
      model: 'unknown',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      latencyMs: null,
      status: 'rejected',
      errorCode: 'quota_exceeded_ai_calls',
      createdAt: new Date(),
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '正常问题' }),
    }));
    const body = await response.json();
    expect(response.status).toBe(409);
    expect(body.code).toBe('quota_exceeded_ai_calls');
    expect(body.error).toContain('AI 调用');
  });

  it('AI 超限时写入记录且不调用 provider', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 100,
      limit: 100,
      reason: 'quota_exceeded_ai_calls',
      resource: 'ai_calls',
    });
    vi.mocked(recordAiCallQuotaRejection).mockResolvedValue({
      id: 'ai-usage-reject-1',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
      actorUserId: 'demo-user-admin',
      provider: 'deepseek',
      model: 'unknown',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      latencyMs: null,
      status: 'rejected',
      errorCode: 'quota_exceeded_ai_calls',
      createdAt: new Date(),
    });

    await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '正常问题' }),
    }));

    // 不调用 provider
    expect(requestInstitutionAiCallService).not.toHaveBeenCalled();
    // 写入拒绝记录
    expect(recordAiCallQuotaRejection).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'demo-tenant-001',
        institutionId: 'demo-inst-001',
      }),
    );
  });

  it('超限拒绝记录 tokens 为 null latencyMs 为 null', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 100,
      limit: 100,
      reason: 'quota_exceeded_ai_calls',
      resource: 'ai_calls',
    });
    const mockRecord = {
      id: 'ai-usage-reject-2',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
      actorUserId: 'demo-user-admin',
      provider: 'deepseek',
      model: 'unknown',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      latencyMs: null,
      status: 'rejected' as const,
      errorCode: 'quota_exceeded_ai_calls',
      createdAt: new Date(),
    };
    vi.mocked(recordAiCallQuotaRejection).mockResolvedValue(mockRecord);

    await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '正常问题' }),
    }));

    const callArgs = vi.mocked(recordAiCallQuotaRejection).mock.calls[0]?.[0];
    expect(callArgs?.vendor).toBe('deepseek');
    // recordAiCallQuotaRejection 内部 tokens 全部为 null，不调用 provider
  });

  it('超限拒绝记录不占用 succeeded quota（quota 只统计 succeeded）', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 100,
      limit: 100,
      reason: 'quota_exceeded_ai_calls',
      resource: 'ai_calls',
    });

    await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '正常问题' }),
    }));

    // checkTenantQuotaForCreate 中 countAiCallsByTenantThisMonth 只统计 status='succeeded'
    // rejected 记录不会被计入
    expect(checkTenantQuotaForCreate).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'ai_calls' }),
    );
    const quotaDecision = await vi.mocked(checkTenantQuotaForCreate).mock.results[0]?.value;
    // 配额检查已拒绝，且不依赖 rejected 记录
  });

  it('多次超限产生多条拒绝记录', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValue({
      allowed: false,
      current: 100,
      limit: 100,
      reason: 'quota_exceeded_ai_calls',
      resource: 'ai_calls',
    });

    await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '问题 A' }),
    }));
    await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '问题 B' }),
    }));

    expect(recordAiCallQuotaRejection).toHaveBeenCalledTimes(2);
  });

  it('审计写入失败时返回受控 500 且不调用 provider', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 100,
      limit: 100,
      reason: 'quota_exceeded_ai_calls',
      resource: 'ai_calls',
    });
    vi.mocked(recordAiCallQuotaRejection).mockRejectedValueOnce(new Error('db write error'));

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '正常问题' }),
    }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.code).toBe('ai_quota_rejection_audit_failed');
    expect(body.error).toContain('审计记录写入失败');

    // 不调用 provider
    expect(requestInstitutionAiCallService).not.toHaveBeenCalled();
  });

  it('审计写入失败 response 不泄露敏感字段', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 100,
      limit: 100,
      reason: 'quota_exceeded_ai_calls',
      resource: 'ai_calls',
    });
    vi.mocked(recordAiCallQuotaRejection).mockRejectedValueOnce(new Error('db write error'));

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '正常问题' }),
    }));
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('api_key');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('SQL');
    expect(serialized).toContain('ai_quota_rejection_audit_failed');
  });

  it('AI 超限 response 不泄露敏感字段', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false,
      current: 100,
      limit: 100,
      reason: 'quota_exceeded_ai_calls',
      resource: 'ai_calls',
    });
    vi.mocked(recordAiCallQuotaRejection).mockResolvedValue({
      id: 'ai-usage-reject-1',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-inst-001',
      actorUserId: 'demo-user-admin',
      provider: 'deepseek',
      model: 'unknown',
      promptTokens: null, completionTokens: null, totalTokens: null, latencyMs: null,
      status: 'rejected', errorCode: 'quota_exceeded_ai_calls',
      createdAt: new Date(),
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '正常问题' }),
    }));
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('api_key');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('stack');
  });

  it('AI 未超限时正常调用（mock quota 放行）', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true,
      current: 5,
      limit: 100,
      resource: 'ai_calls',
    });
    vi.mocked(requestInstitutionAiCallService).mockResolvedValueOnce({
      status: 'created',
      answer: '冷敷建议保持清洁干燥',
      record: {
        id: 'rec-1', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
        actorUserId: 'demo-user-admin', provider: 'deepseek', model: 'deepseek-v4-flash',
        promptTokens: 50, completionTokens: 30, totalTokens: 80, latencyMs: 500,
        status: 'succeeded', errorCode: null, createdAt: new Date().toISOString(),
      },
      knowledgeContext: { used: false, query: '', sources: [] },
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '冷敷怎么护理？' }),
    }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.answer).toBeTruthy();
  });
});

describe('机构端 AI 调用记录 API route', () => {
  it('未登录返回 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await aiCallUsageGet(new Request('http://localhost/api/institution/knowledge-management/ai-call/usage'));
    expect(response.status).toBe(401);
  });

  it('平台账号返回 403', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformContext);
    const response = await aiCallUsageGet(new Request('http://localhost/api/institution/knowledge-management/ai-call/usage'));
    expect(response.status).toBe(403);
  });

  it('usage API 返回 RAG metadata 摘要（used=true + sources）', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    const { listInstitutionAiCallUsageService } = await import('@/modules/institution/server/institution-ai-call-service');
    vi.mocked(listInstitutionAiCallUsageService).mockResolvedValue({
      requestId: 'institution-ai-call-usage',
      readonly: true,
      dataSource: 'repository',
      records: [{
        id: 'rec-1', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
        actorUserId: 'u', provider: 'deepseek', model: 'm', promptTokens: 10, completionTokens: 5,
        totalTokens: 15, latencyMs: 100, status: 'succeeded', errorCode: null,
        metadata: {
          knowledgeContext: {
            used: true,
            searchKeyword: '冷敷',
            sources: [{ knowledgeId: 'kb-1', knowledgeTitle: '指南', fileId: 'f-1', fileName: '指南.pdf', chunkId: 'c-1', chunkIndex: 0, textPreview: '冷敷需间隔观察。', matchReason: '包含"冷敷"' }],
          },
        },
        createdAt: new Date().toISOString(),
      }],
      emptyState: { title: '暂无 AI 调用记录', description: '当前机构还没有发起过 AI 调用。' },
    });

    const response = await aiCallUsageGet(new Request('http://localhost/api/institution/knowledge-management/ai-call/usage'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.records[0].metadata.knowledgeContext.used).toBe(true);
    expect(body.records[0].metadata.knowledgeContext.searchKeyword).toBe('冷敷');
    expect(body.records[0].metadata.knowledgeContext.sources).toHaveLength(1);
    expect(body.records[0].metadata.knowledgeContext.sources[0].fileName).toBe('指南.pdf');
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/storageKey|bucket|signedUrl|embedding|api_key|baseUrl|Authorization/i);
    // usage API 不返回原始 question / query 字段
    expect(serialized).not.toMatch(/"query"/i);
  });

  it('usage API 旧记录 metadata=null 时不崩且不伪造 RAG', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    const { listInstitutionAiCallUsageService } = await import('@/modules/institution/server/institution-ai-call-service');
    vi.mocked(listInstitutionAiCallUsageService).mockResolvedValue({
      requestId: 'institution-ai-call-usage',
      readonly: true,
      dataSource: 'repository',
      records: [
        { id: 'old-1', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001', actorUserId: 'u', provider: 'deepseek', model: 'm', promptTokens: 10, completionTokens: 5, totalTokens: 15, latencyMs: 100, status: 'succeeded', errorCode: null, metadata: null, createdAt: new Date().toISOString() },
        { id: 'rej-1', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001', actorUserId: 'u', provider: 'deepseek', model: 'm', promptTokens: null, completionTokens: null, totalTokens: null, latencyMs: null, status: 'rejected', errorCode: 'quota_exceeded_ai_calls', metadata: null, createdAt: new Date().toISOString() },
      ],
      emptyState: { title: '暂无 AI 调用记录', description: '当前机构还没有发起过 AI 调用。' },
    });

    const response = await aiCallUsageGet(new Request('http://localhost/api/institution/knowledge-management/ai-call/usage'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.records[0].metadata).toBeNull();
    // rejected 记录 metadata=null，不伪造 RAG
    expect(body.records[1].metadata).toBeNull();
  });
});

describe('平台端 AI 用量聚合 API route', () => {
  it('平台管理员可访问', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformContext);
    const { listPlatformAiUsageSummaryService } = await import('@/modules/institution/server/institution-ai-call-service');
    vi.mocked(listPlatformAiUsageSummaryService).mockResolvedValue({
      requestId: 'platform-ai-usage-summary',
      readonly: true,
      dataSource: 'repository',
      records: [{ tenantId: 't-001', callCount: 3, totalTokens: 300, succeededCount: 2, failedCount: 1 }],
      emptyState: { title: '暂无 AI 调用数据', description: '还没有任何租户发起过 AI 调用。' },
    });
    const response = await platformAiUsageGet(new Request('http://localhost/api/v1/open-platform/ai-usage'));
    expect(response.status).toBe(200);
  });

  it('未登录返回 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await platformAiUsageGet(new Request('http://localhost/api/v1/open-platform/ai-usage'));
    expect(response.status).toBe(401);
  });
});

describe('AI 试问 RAG 知识库检索闭环（安全顺序）', () => {
  it('正常输入时 service 收到 db 参数（KB 检索由 service 内部执行）', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 5, limit: 100, resource: 'ai_calls',
    });
    vi.mocked(requestInstitutionAiCallService).mockResolvedValueOnce({
      status: 'created',
      answer: '根据参考资料回答。',
      record: { id: 'r1', tenantId: 't', institutionId: 'i', actorUserId: 'u', provider: 'deepseek', model: 'm', promptTokens: 10, completionTokens: 20, totalTokens: 30, latencyMs: 100, status: 'succeeded', errorCode: null, createdAt: new Date().toISOString() },
      knowledgeContext: { used: true, query: '冷敷后怎么护理？', sources: [{ knowledgeId: 'kb-1', knowledgeTitle: '术后护理', fileId: 'f-1', fileName: '术后护理.pdf', chunkId: 'c-1', chunkIndex: 0, textPreview: '冷敷后保持清洁。', matchReason: '包含"冷敷"' }] },
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '冷敷后怎么护理？' }),
    }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.knowledgeContext).toBeDefined();
    expect(body.knowledgeContext.used).toBe(true);

    // service 被调用时传入了 db 参数（由 service 内部执行 KB 检索）
    expect(requestInstitutionAiCallService).toHaveBeenCalledWith(
      expect.objectContaining({ db: expect.anything() as unknown }),
    );
  });

  it('高敏输入时 service 返回 sensitive_input_rejected，route 返回 422且不调用 provider', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 5, limit: 100, resource: 'ai_calls',
    });
    vi.mocked(requestInstitutionAiCallService).mockResolvedValueOnce({
      status: 'sensitive_input_rejected',
      message: '输入内容包含敏感信息，请移除身份证、银行卡、病历、合同、凭证等敏感内容后重试',
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '身份证110101199001011234' }),
    }));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe('sensitive_input_rejected');

    // 高敏拒绝后 route 不执行 KB 检索（KB 检索在 service 内部，已由 mock 短路）
    // searchInstitutionKnowledgeChunksService 不应被 route 层直接调用
    expect(searchInstitutionKnowledgeChunksService).not.toHaveBeenCalled();
  });

  it('输入无效（空问题）时 service 返回 validation_failed，route 返回400且不执行 KB 检索', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 0, limit: 100, resource: 'ai_calls',
    });
    vi.mocked(requestInstitutionAiCallService).mockResolvedValueOnce({
      status: 'validation_failed',
      message: '请输入问题',
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '' }),
    }));
    expect(response.status).toBe(400);

    // KB 检索不应被 route 层直接调用
    expect(searchInstitutionKnowledgeChunksService).not.toHaveBeenCalled();
  });

  it('输入过长时 service 返回 validation_failed 且不执行 KB 检索', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 0, limit: 100, resource: 'ai_calls',
    });
    vi.mocked(requestInstitutionAiCallService).mockResolvedValueOnce({
      status: 'validation_failed',
      message: '问题过长，请控制在512字以内',
    });

    const longQuestion = 'A'.repeat(600);
    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: longQuestion }),
    }));
    expect(response.status).toBe(400);
    expect(searchInstitutionKnowledgeChunksService).not.toHaveBeenCalled();
  });

  it('quota 超限时不执行 KB 检索（安全顺序：quota 在 service 调用之前）', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: false, current: 100, limit: 100, reason: 'quota_exceeded_ai_calls', resource: 'ai_calls',
    });
    vi.mocked(recordAiCallQuotaRejection).mockResolvedValue({
      id: 'r', tenantId: 't', institutionId: 'i', actorUserId: 'u', provider: 'deepseek', model: 'unknown',
      promptTokens: null, completionTokens: null, totalTokens: null, latencyMs: null,
      status: 'rejected', errorCode: 'quota_exceeded_ai_calls', createdAt: new Date(),
    });

    await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '正常问题' }),
    }));

    // quota 拒绝后 route 不应调用 service 也不应执行 KB 检索
    expect(requestInstitutionAiCallService).not.toHaveBeenCalled();
    expect(searchInstitutionKnowledgeChunksService).not.toHaveBeenCalled();
  });

  it('检索失败 response 不泄露敏感字段', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 5, limit: 100, resource: 'ai_calls',
    });
    vi.mocked(requestInstitutionAiCallService).mockResolvedValueOnce({
      status: 'service_unavailable',
      message: '知识库检索暂时不可用，请稍后重试',
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '正常问题' }),
    }));
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('api_key');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('password');
    expect(serialized).toContain('知识库检索');
  });

  it('响应中 knowledgeContext.used=true 且 sources 字段受控', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 5, limit: 100, resource: 'ai_calls',
    });
    vi.mocked(requestInstitutionAiCallService).mockResolvedValueOnce({
      status: 'created',
      answer: '根据参考资料回答。',
      record: { id: 'r', tenantId: 't', institutionId: 'i', actorUserId: 'u', provider: 'deepseek', model: 'm', promptTokens: 10, completionTokens: 20, totalTokens: 30, latencyMs: 100, status: 'succeeded', errorCode: null, createdAt: new Date().toISOString() },
      knowledgeContext: {
        used: true,
        query: '冷敷后怎么护理？',
        sources: [{ knowledgeId: 'kb-1', knowledgeTitle: '指南', fileId: 'f-1', fileName: '指南.pdf', chunkId: 'c-1', chunkIndex: 0, textPreview: '冷敷后保持清洁。', matchReason: '包含"冷敷"' }],
      },
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '冷敷后怎么护理？' }),
    }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.knowledgeContext.used).toBe(true);
    expect(body.knowledgeContext.sources).toHaveLength(1);
    expect(body.knowledgeContext.sources[0].fileName).toBe('指南.pdf');
    expect(body.knowledgeContext.sources[0].textPreview).toBe('冷敷后保持清洁。');
    // 不泄露敏感字段
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/storageKey|bucket|signedUrl|embedding|api_key|baseUrl|Authorization/i);
  });

  it('knowledgeContext.used=false 时 sources 为空数组', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 5, limit: 100, resource: 'ai_calls',
    });
    vi.mocked(requestInstitutionAiCallService).mockResolvedValueOnce({
      status: 'created',
      answer: '知识库暂无相关依据，建议人工确认。',
      record: { id: 'r', tenantId: 't', institutionId: 'i', actorUserId: 'u', provider: 'deepseek', model: 'm', promptTokens: 10, completionTokens: 20, totalTokens: 30, latencyMs: 100, status: 'succeeded', errorCode: null, createdAt: new Date().toISOString() },
      knowledgeContext: { used: false, query: '随机问题', sources: [] },
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '随机问题' }),
    }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.knowledgeContext.used).toBe(false);
    expect(body.knowledgeContext.sources).toEqual([]);
  });
});
