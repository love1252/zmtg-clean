import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as aiCallUsageGet } from '@/app/api/institution/knowledge-management/ai-call/usage/route';
import { GET as platformAiUsageGet } from '@/app/api/v1/open-platform/ai-usage/route';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

const database = { database: 'ai-call-api-test-db' };

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => database),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/institution/server/institution-ai-call-service', () => ({
  listInstitutionAiCallUsageService: vi.fn(),
  listPlatformAiUsageSummaryService: vi.fn(),
}));

vi.mock('@/modules/institution/server/institution-ai-call-usage-repository', () => ({
  createAiCallUsageRepository: vi.fn(() => ({})),
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

  it('usage API 返回受控的历史 RAG 摘要', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    const { listInstitutionAiCallUsageService } = await import('@/modules/institution/server/institution-ai-call-service');
    vi.mocked(listInstitutionAiCallUsageService).mockResolvedValue({
      requestId: 'institution-ai-call-usage',
      readonly: true,
      dataSource: 'repository',
      records: [{
        id: 'rec-1', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001',
        actorUserId: 'u', serviceName: '平台 AI 服务', latencyMs: 100,
        status: 'succeeded', errorCode: null,
        metadata: {
          knowledgeContext: {
            used: true,
            sources: [{ knowledgeId: 'kb-1', knowledgeTitle: '指南', fileId: 'f-1', fileName: '指南.pdf', chunkId: 'c-1', chunkIndex: 0, textPreview: '冷敷需间隔观察。', matchReason: '包含“冷敷”' }],
          },
        },
        createdAt: new Date().toISOString(),
      }],
      emptyState: { title: '暂无 AI 调用记录', description: '当前机构还没有发起过 AI 调用。' },
    });

    const response = await aiCallUsageGet(new Request('http://localhost/api/institution/knowledge-management/ai-call/usage'));
    expect(response.status).toBe(200);
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toMatch(/storageKey|bucket|signedUrl|embedding|api_key|baseUrl|Authorization/i);
    expect(serialized).not.toMatch(/"provider"|"model"|deepseek|deepseek-v4-flash/i);
    expect(serialized).not.toMatch(/"query"|"searchKeyword"/i);
  });

  it('usage API 的旧记录不伪造 RAG metadata', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    const { listInstitutionAiCallUsageService } = await import('@/modules/institution/server/institution-ai-call-service');
    vi.mocked(listInstitutionAiCallUsageService).mockResolvedValue({
      requestId: 'institution-ai-call-usage', readonly: true, dataSource: 'repository',
      records: [{ id: 'old-1', tenantId: 'demo-tenant-001', institutionId: 'demo-inst-001', actorUserId: 'u', serviceName: '平台 AI 服务', latencyMs: 100, status: 'succeeded', errorCode: null, metadata: null, createdAt: new Date().toISOString() }],
      emptyState: { title: '暂无 AI 调用记录', description: '当前机构还没有发起过 AI 调用。' },
    });

    const response = await aiCallUsageGet(new Request('http://localhost/api/institution/knowledge-management/ai-call/usage'));
    expect(response.status).toBe(200);
    expect((await response.json()).records[0].metadata).toBeNull();
  });
});

describe('平台端 AI 用量聚合 API route', () => {
  it('机构账号访问平台端 AI 用量仍 403', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    const response = await platformAiUsageGet(new Request('http://localhost/api/v1/open-platform/ai-usage'));
    expect(response.status).toBe(403);
  });

  it('平台管理员可访问', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformContext);
    const { listPlatformAiUsageSummaryService } = await import('@/modules/institution/server/institution-ai-call-service');
    vi.mocked(listPlatformAiUsageSummaryService).mockResolvedValue({
      requestId: 'platform-ai-usage-summary', readonly: true, dataSource: 'repository',
      records: [{ tenantId: 't-001', callCount: 3, totalTokens: 300, succeededCount: 2, failedCount: 1, rejectedCount: 0, quotaExceededCount: 0 }],
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
