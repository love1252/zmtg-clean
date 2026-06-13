import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as platformEmbeddingRoute from '@/app/api/v1/open-platform/knowledge-management/embeddings/route';
import * as platformVectorSearchRoute from '@/app/api/v1/open-platform/knowledge-management/vector-search/route';
import * as institutionVectorSearchRoute from '@/app/api/institution/knowledge-management/vector-search/route';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

const database = { database: 'knowledge-vector-route-test-db' };
const repository = {
  listKnowledgeItems: vi.fn(),
  listKnowledgeEmbeddingCandidates: vi.fn(),
  saveKnowledgeChunkEmbeddings: vi.fn(),
  listKnowledgeVectorSearchCandidates: vi.fn(),
};

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => database),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/open-platform/server/platform-knowledge-management-repository', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/open-platform/server/platform-knowledge-management-repository')
  >('@/modules/open-platform/server/platform-knowledge-management-repository');

  return {
    ...actual,
    createPlatformKnowledgeManagementRepository: vi.fn(() => repository),
  };
});

const now = new Date('2026-06-13T08:00:00.000Z');
const platformEmbeddingUrl = 'http://localhost/api/v1/open-platform/knowledge-management/embeddings';
const platformVectorUrl = 'http://localhost/api/v1/open-platform/knowledge-management/vector-search';
const institutionVectorUrl = 'http://localhost/api/institution/knowledge-management/vector-search';
const unsafeError = new Error(
  'SQL select embedding_vector_json from /Users/demo/path postgres://root:password@localhost token=secret stack',
);
const unsafeFragments = [
  'embedding_vector_json',
  'embeddingVectorJson',
  '/Users/',
  'postgres',
  'password',
  'token',
  'secret',
  'stack',
  'SQL',
];

const visibleKnowledge = {
  knowledgeId: 'knowledge-visible',
  tenantId: 'tenant-route',
  tenantName: '路由租户',
  institutionId: 'inst-current',
  workspaceId: 'workspace-route',
  title: '机构可见知识',
  version: 'v1',
  sourceKind: 'demo' as const,
  status: 'ready' as const,
  readonlyStatus: 'readonly' as const,
  category: '术后护理',
  descriptionPreview: '低敏摘要。',
  chunkCount: 1,
  visibleInstitutionIds: [],
  createdAt: now,
  updatedAt: now,
};

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');
  return response.json() as Promise<Record<string, unknown>>;
}

function platformContext() {
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
    userId: 'platform-user',
    role: 'platform_admin',
    scope: 'platform',
    tenantId: null,
    institutionId: null,
    source: 'demo_session',
  });
}

function institutionContext() {
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
    userId: 'tenant-user',
    role: 'tenant_admin',
    scope: 'tenant',
    tenantId: 'tenant-route',
    institutionId: 'inst-current',
    source: 'demo_session',
  });
}

function expectSafePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  unsafeFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('知识库 embedding 与向量检索 API route', () => {
  beforeEach(() => {
    repository.listKnowledgeItems.mockReset();
    repository.listKnowledgeEmbeddingCandidates.mockReset();
    repository.saveKnowledgeChunkEmbeddings.mockReset();
    repository.listKnowledgeVectorSearchCandidates.mockReset();
    vi.mocked(getDatabase).mockClear();
    vi.mocked(createPlatformKnowledgeManagementRepository).mockClear();
    vi.mocked(getDemoAccessContextFromRequest).mockReset();
  });

  it('平台端 POST 可生成 embedding，响应不返回向量原文', async () => {
    platformContext();
    repository.listKnowledgeEmbeddingCandidates.mockResolvedValue([
      {
        tenantId: 'tenant-route',
        knowledgeId: 'knowledge-visible',
        knowledgeTitle: '机构可见知识',
        fileId: 'file-visible',
        fileName: '护理.txt',
        fileStatus: 'active',
        parseStatus: 'succeeded',
        chunkId: 'chunk-visible-0',
        chunkIndex: 0,
        textPreview: '冷敷片段。',
      },
    ]);
    repository.saveKnowledgeChunkEmbeddings.mockResolvedValue([
      {
        embeddingId: 'embedding-visible-0',
        tenantId: 'tenant-route',
        knowledgeId: 'knowledge-visible',
        fileId: 'file-visible',
        chunkId: 'chunk-visible-0',
        embeddingProvider: 'mock_local_embedding',
        embeddingModel: 'mock-local-embedding-v1',
        embeddingDimensions: 8,
        status: 'ready',
      },
    ]);

    const response = await platformEmbeddingRoute.POST(
      new Request(platformEmbeddingUrl, {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-route', knowledgeId: 'knowledge-visible' }),
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(repository.listKnowledgeEmbeddingCandidates).toHaveBeenCalledWith({
      tenantId: 'tenant-route',
      knowledgeId: 'knowledge-visible',
      fileId: undefined,
    });
    expect(payload).toEqual(expect.objectContaining({
      status: 'succeeded',
      embeddingCount: 1,
    }));
    expectSafePayload(payload);
  });

  it('非 platform scope 不能生成 embedding 且不初始化 repository', async () => {
    institutionContext();

    const response = await platformEmbeddingRoute.POST(
      new Request(platformEmbeddingUrl, {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-route' }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ code: 'forbidden', error: '没有访问权限' });
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
  });

  it('平台端 GET 可做向量相似检索且不返回 embeddingVectorJson', async () => {
    platformContext();
    repository.listKnowledgeItems.mockResolvedValue([visibleKnowledge]);
    repository.listKnowledgeVectorSearchCandidates.mockResolvedValue([
      {
        tenantId: 'tenant-route',
        knowledgeId: 'knowledge-visible',
        knowledgeTitle: '机构可见知识',
        fileId: 'file-visible',
        fileName: '护理.txt',
        fileStatus: 'active',
        parseStatus: 'succeeded',
        chunkId: 'chunk-visible-0',
        chunkIndex: 0,
        textPreview: '冷敷片段。',
        embeddingId: 'embedding-visible-0',
        embeddingProvider: 'mock_local_embedding',
        embeddingModel: 'mock-local-embedding-v1',
        embeddingDimensions: 8,
        embeddingVectorJson: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        embeddingStatus: 'ready',
      },
    ]);

    const response = await platformVectorSearchRoute.GET(
      new Request(`${platformVectorUrl}?tenantId=tenant-route&query=${encodeURIComponent('冷敷护理')}`),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload.records).toEqual([
      expect.objectContaining({
        knowledgeId: 'knowledge-visible',
        fileId: 'file-visible',
        chunkId: 'chunk-visible-0',
        score: expect.any(Number),
        matchReason: expect.stringContaining('mock embedding 相似度'),
      }),
    ]);
    expectSafePayload(payload);
  });

  it('机构端只能用 access context 做只读向量检索，忽略 query tenant/institution 注入', async () => {
    institutionContext();
    repository.listKnowledgeItems.mockResolvedValue([visibleKnowledge]);
    repository.listKnowledgeVectorSearchCandidates.mockResolvedValue([
      {
        tenantId: 'tenant-route',
        knowledgeId: 'knowledge-visible',
        knowledgeTitle: '机构可见知识',
        fileId: 'file-visible',
        fileName: '护理.txt',
        fileStatus: 'active',
        parseStatus: 'succeeded',
        chunkId: 'chunk-visible-0',
        chunkIndex: 0,
        textPreview: '冷敷片段。',
        embeddingId: 'embedding-visible-0',
        embeddingProvider: 'mock_local_embedding',
        embeddingModel: 'mock-local-embedding-v1',
        embeddingDimensions: 8,
        embeddingVectorJson: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        embeddingStatus: 'ready',
      },
    ]);

    const response = await institutionVectorSearchRoute.GET(
      new Request(
        `${institutionVectorUrl}?tenantId=tenant-other&institutionId=inst-other&query=${encodeURIComponent('冷敷')}`,
      ),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(repository.listKnowledgeVectorSearchCandidates).toHaveBeenCalledWith({
      tenantId: 'tenant-route',
      knowledgeId: undefined,
      fileId: undefined,
    });
    expect(payload.records).toEqual([
      expect.objectContaining({ knowledgeId: 'knowledge-visible', chunkId: 'chunk-visible-0' }),
    ]);
    expectSafePayload(payload);
  });

  it('机构端不暴露 embedding 生成接口，只保留 GET 只读检索', () => {
    expect(Object.keys(institutionVectorSearchRoute).sort()).toEqual(['GET']);
  });

  it('底层异常时返回固定中文安全错误', async () => {
    platformContext();
    repository.listKnowledgeVectorSearchCandidates.mockRejectedValue(unsafeError);

    const response = await platformVectorSearchRoute.GET(
      new Request(`${platformVectorUrl}?tenantId=tenant-route&query=${encodeURIComponent('冷敷')}`),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: 'readonly_contract_error',
        message: '知识库向量检索暂时无法处理',
      },
    });
    expectSafePayload(payload);
  });
});
