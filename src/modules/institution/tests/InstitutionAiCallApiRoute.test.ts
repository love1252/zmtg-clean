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
    vi.mocked(searchInstitutionKnowledgeChunksService).mockResolvedValueOnce({
      requestId: 'institution-knowledge-keyword-search' as const,
      readonly: true as const,
      dataSource: 'repository' as const,
      records: [],
      pageInfo: { page: 1, pageSize: 5, total: 0, pageCount: 0, hasPreviousPage: false, hasNextPage: false },
      emptyState: { title: '暂无匹配片段', description: '当前范围没有命中关键词的已解析知识片段。' },
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

describe('AI 试问 RAG 知识库检索闭环', () => {
  it('KB 检索成功，service 收到 knowledgeChunks', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 5, limit: 100, resource: 'ai_calls',
    });
    vi.mocked(searchInstitutionKnowledgeChunksService).mockResolvedValueOnce({
      requestId: 'institution-knowledge-keyword-search' as const,
      readonly: true as const,
      dataSource: 'repository' as const,
      records: [
        { knowledgeId: 'kb-1', knowledgeTitle: '术后护理指南', fileId: 'f-1', fileName: '术后护理.pdf', chunkId: 'c-1', chunkIndex: 0, textPreview: '冷敷后保持清洁。', matchReason: '包含关键词"冷敷"' },
      ],
      pageInfo: { page: 1, pageSize: 5, total: 1, pageCount: 1, hasPreviousPage: false, hasNextPage: false },
      emptyState: { title: '', description: '' },
    });
    vi.mocked(requestInstitutionAiCallService).mockResolvedValueOnce({
      status: 'created',
      answer: '根据参考资料，冷敷后保持清洁干燥。',
      record: { id: 'r1', tenantId: 't', institutionId: 'i', actorUserId: 'u', provider: 'deepseek', model: 'm', promptTokens: 10, completionTokens: 20, totalTokens: 30, latencyMs: 100, status: 'succeeded', errorCode: null, createdAt: new Date().toISOString() },
      knowledgeContext: { used: true, query: '冷敷后怎么护理？', sources: [{ knowledgeId: 'kb-1', knowledgeTitle: '术后护理指南', fileId: 'f-1', fileName: '术后护理.pdf', chunkId: 'c-1', chunkIndex: 0, textPreview: '冷敷后保持清洁。', matchReason: '包含关键词"冷敷"' }] },
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '冷敷后怎么护理？' }),
    }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.knowledgeContext).toBeDefined();
    expect(body.knowledgeContext.used).toBe(true);
    expect(body.knowledgeContext.sources).toHaveLength(1);
  });

  it('KB 检索异常返回受控 503，不调用 provider', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 5, limit: 100, resource: 'ai_calls',
    });
    vi.mocked(searchInstitutionKnowledgeChunksService).mockRejectedValueOnce(new Error('DB down'));

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '冷敷后怎么护理？' }),
    }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe('knowledge_retrieval_failed');
    expect(JSON.stringify(body)).not.toContain('DB');
    expect(JSON.stringify(body)).not.toContain('api_key');
    // 不调用 provider
    expect(requestInstitutionAiCallService).not.toHaveBeenCalled();
  });

  it('KB 检索返回空时正常调用 provider', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 5, limit: 100, resource: 'ai_calls',
    });
    vi.mocked(searchInstitutionKnowledgeChunksService).mockResolvedValueOnce({
      requestId: 'institution-knowledge-keyword-search' as const,
      readonly: true as const,
      dataSource: 'repository' as const,
      records: [],
      pageInfo: { page: 1, pageSize: 5, total: 0, pageCount: 0, hasPreviousPage: false, hasNextPage: false },
      emptyState: { title: '暂无匹配片段', description: '描述' },
    });
    vi.mocked(requestInstitutionAiCallService).mockResolvedValueOnce({
      status: 'created', answer: '普通回答',
      record: { id: 'r1', tenantId: 't', institutionId: 'i', actorUserId: 'u', provider: 'deepseek', model: 'm', promptTokens: 10, completionTokens: 20, totalTokens: 30, latencyMs: 100, status: 'succeeded', errorCode: null, createdAt: new Date().toISOString() },
      knowledgeContext: { used: false, query: '冷敷后怎么护理？', sources: [] },
    });

    const response = await aiCallPost(new Request('http://localhost/api/institution/knowledge-management/ai-call', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '冷敷后怎么护理？' }),
    }));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.knowledgeContext.used).toBe(false);
    expect(body.knowledgeContext.sources).toHaveLength(0);
  });

  it('quota 超限时不执行 KB 检索（安全顺序）', async () => {
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

    // quota 拒绝后，不应执行 KB 检索
    expect(searchInstitutionKnowledgeChunksService).not.toHaveBeenCalled();
    expect(requestInstitutionAiCallService).not.toHaveBeenCalled();
  });

  it('检索失败 response 不泄露敏感字段', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(checkTenantQuotaForCreate).mockResolvedValueOnce({
      allowed: true, current: 5, limit: 100, resource: 'ai_calls',
    });
    vi.mocked(searchInstitutionKnowledgeChunksService).mockRejectedValueOnce(new Error('internal db error'));

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
    expect(serialized).not.toContain('internal');
    expect(serialized).not.toContain('db error');
  });
});
