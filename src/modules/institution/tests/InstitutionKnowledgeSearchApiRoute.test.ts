import { describe, expect, it, vi } from 'vitest';
import { GET as searchGet } from '@/app/api/institution/knowledge-management/search/route';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { searchInstitutionKnowledgeChunksService } from '@/modules/institution/server/institution-knowledge-keyword-search-service';

const database = { database: 'knowledge-search-api-test-db' };

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => database),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/open-platform/server/platform-knowledge-management-repository', () => ({
  createPlatformKnowledgeManagementRepository: vi.fn(() => ({})),
}));

vi.mock('@/modules/institution/server/institution-knowledge-keyword-search-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/institution/server/institution-knowledge-keyword-search-service')
  >('@/modules/institution/server/institution-knowledge-keyword-search-service');
  return {
    ...actual,
    searchInstitutionKnowledgeChunksService: vi.fn(),
  };
});

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

const searchResultRecords = [
  {
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理指南',
    fileId: 'file-a',
    fileName: '护理手册.txt',
    chunkId: 'chunk-a-0',
    chunkIndex: 0,
    textPreview: '术后冷敷应每次15-20分钟。',
    matchReason: '片段包含关键词"冷敷"',
  },
];

const searchResponse = {
  requestId: 'institution-knowledge-keyword-search' as const,
  readonly: true as const,
  dataSource: 'repository' as const,
  records: searchResultRecords,
  pageInfo: {
    page: 1,
    pageSize: 10,
    total: 1,
    pageCount: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  },
  emptyState: {
    title: '暂无匹配片段',
    description: '当前范围没有命中关键词的已解析知识片段。',
  },
};

const emptySearchResponse = {
  requestId: 'institution-knowledge-keyword-search' as const,
  readonly: true as const,
  dataSource: 'repository' as const,
  records: [],
  pageInfo: {
    page: 1,
    pageSize: 10,
    total: 0,
    pageCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  },
  emptyState: {
    title: '暂无匹配片段',
    description: '当前范围没有命中关键词的已解析知识片段。',
  },
};

const sensitiveFragments = [
  'api_key',
  'DATABASE_URL',
  'postgres://',
  'secret',
  'token',
  'password',
  'Bearer',
  '/Users/',
  'stack',
  'SQL',
  'Authorization',
  'baseUrl',
  'bucket',
  'signedUrl',
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('机构端知识库关键词检索 API route', () => {
  it('未登录返回 401', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(null);
    const response = await searchGet(new Request('http://localhost/api/institution/knowledge-management/search?keyword=冷敷'));
    expect(response.status).toBe(401);
  });

  it('平台账号返回 403', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformContext);
    const response = await searchGet(new Request('http://localhost/api/institution/knowledge-management/search?keyword=冷敷'));
    expect(response.status).toBe(403);
  });

  it('scope 为 tenant 但缺少 institutionId 返回 403', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      ...tenantContext,
      institutionId: null,
    });
    const response = await searchGet(new Request('http://localhost/api/institution/knowledge-management/search?keyword=冷敷'));
    expect(response.status).toBe(403);
  });

  it('机构账号成功搜索自己知识库 chunks', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(searchInstitutionKnowledgeChunksService).mockResolvedValue(searchResponse);

    const response = await searchGet(new Request('http://localhost/api/institution/knowledge-management/search?keyword=%E5%86%B7%E6%95%B7'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.records).toEqual(searchResultRecords);
    expect(body.pageInfo.total).toBe(1);
  });

  it('使用 accessContext 的 tenantId/institutionId，不接受客户端覆盖', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(searchInstitutionKnowledgeChunksService).mockResolvedValue(searchResponse);

    // Client tries to pass different tenantId/institutionId via query params
    await searchGet(new Request(
      'http://localhost/api/institution/knowledge-management/search?keyword=冷敷&tenantId=evil-tenant&institutionId=evil-inst',
    ));

    expect(searchInstitutionKnowledgeChunksService).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          tenantId: 'demo-tenant-001',
          institutionId: 'demo-inst-001',
        }),
      }),
    );
  });

  it('跨租户隔离：只搜索 accessContext 对应的 tenant/institution', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(searchInstitutionKnowledgeChunksService).mockResolvedValue(emptySearchResponse);

    const response = await searchGet(new Request('http://localhost/api/institution/knowledge-management/search?keyword=其他租户内容'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.records).toEqual([]);
  });

  it('空关键词返回受控错误', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(searchInstitutionKnowledgeChunksService).mockResolvedValue({
      status: 'validation_failed',
      message: '请输入关键词后再检索知识片段',
    });

    const response = await searchGet(new Request('http://localhost/api/institution/knowledge-management/search?keyword='));
    expect(response.status).toBe(400);
  });

  it('超长关键词返回受控错误', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(searchInstitutionKnowledgeChunksService).mockResolvedValue({
      status: 'validation_failed',
      message: '关键词过长，最多支持 80 个字符',
    });

    const longKeyword = '测试'.repeat(41);
    const response = await searchGet(new Request(`http://localhost/api/institution/knowledge-management/search?keyword=${encodeURIComponent(longKeyword)}`));
    expect(response.status).toBe(400);
  });

  it('response 不泄露敏感字段', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(searchInstitutionKnowledgeChunksService).mockResolvedValue(searchResponse);

    const response = await searchGet(new Request('http://localhost/api/institution/knowledge-management/search?keyword=冷敷'));
    const body = await response.json();
    const serialized = JSON.stringify(body);
    sensitiveFragments.forEach((fragment) => {
      expect(serialized).not.toContain(fragment);
    });
  });

  it('service 异常时返回 503 且不泄露内部信息', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(searchInstitutionKnowledgeChunksService).mockRejectedValue(
      new Error('DATABASE_URL postgres://root:password@localhost secret=key /Users/demo/path SQL stack'),
    );

    const response = await searchGet(new Request('http://localhost/api/institution/knowledge-management/search?keyword=冷敷'));
    expect(response.status).toBe(503);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(body.code).toBe('service_unavailable');
    expect(body.error).toBe('知识库片段检索暂时不可用');
    sensitiveFragments.forEach((fragment) => {
      expect(serialized).not.toContain(fragment);
    });
  });

  it('空结果时返回空 records 和 emptyState', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantContext);
    vi.mocked(searchInstitutionKnowledgeChunksService).mockResolvedValue(emptySearchResponse);

    const response = await searchGet(new Request('http://localhost/api/institution/knowledge-management/search?keyword=不存在的词'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.records).toEqual([]);
    expect(body.emptyState).toBeDefined();
  });
});
