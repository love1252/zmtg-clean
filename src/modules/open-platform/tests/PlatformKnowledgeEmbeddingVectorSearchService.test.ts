import { describe, expect, it, vi } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import {
  createDeterministicMockKnowledgeEmbedding,
  generatePlatformKnowledgeChunkEmbeddingsService,
  searchInstitutionKnowledgeVectorChunksService,
  searchPlatformKnowledgeVectorChunksService,
  type PlatformKnowledgeEmbeddingCandidateRecord,
  type PlatformKnowledgeVectorSearchCandidateRecord,
  type PlatformKnowledgeVectorSearchResponse,
} from '@/modules/open-platform/server/platform-knowledge-embedding-vector-search-service';

const now = new Date('2026-06-13T08:00:00.000Z');

const unsafeFragments = [
  'embeddingVectorJson',
  'storageKey',
  '/Users/',
  'SQL',
  'stack',
  'token',
  'secret',
  'textContent',
  'fullText',
  'parsedContent',
  'trainingContent',
  'AI answer',
];

const knowledgeRecords: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-a',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-owner-a',
    workspaceId: 'workspace-a',
    title: '术后护理知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '低敏摘要。',
    chunkCount: 2,
    visibleInstitutionIds: ['inst-visible-a'],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-owned',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-current',
    workspaceId: 'workspace-owned',
    title: '本机构知识库',
    version: 'v1',
    sourceKind: 'seed',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '机构知识',
    descriptionPreview: '本机构摘要。',
    chunkCount: 1,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-hidden',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-hidden',
    workspaceId: 'workspace-hidden',
    title: '未授权知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '不可见',
    descriptionPreview: '不应可见。',
    chunkCount: 1,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-b',
    tenantId: 'tenant-b',
    tenantName: '租户 B',
    institutionId: 'inst-current',
    workspaceId: 'workspace-b',
    title: '跨租户知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '跨租户',
    descriptionPreview: 'tenant A 不可见。',
    chunkCount: 1,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
];

const embeddingCandidates: PlatformKnowledgeEmbeddingCandidateRecord[] = [
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理知识库',
    fileId: 'file-a',
    fileName: '护理说明.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-a-0',
    chunkIndex: 0,
    textPreview: '术后护理需要冷敷，避免暴晒。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理知识库',
    fileId: 'file-a',
    fileName: '护理说明.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-a-1',
    chunkIndex: 1,
    textPreview: '第二段包含复诊提醒。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理知识库',
    fileId: 'file-pending',
    fileName: '待解析.txt',
    fileStatus: 'active',
    parseStatus: 'pending',
    chunkId: 'chunk-pending',
    chunkIndex: 0,
    textPreview: 'pending 不应生成 embedding。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理知识库',
    fileId: 'file-failed',
    fileName: '失败.txt',
    fileStatus: 'active',
    parseStatus: 'failed',
    chunkId: 'chunk-failed',
    chunkIndex: 0,
    textPreview: 'failed 不应生成 embedding。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理知识库',
    fileId: 'file-archived',
    fileName: '归档.txt',
    fileStatus: 'archived',
    parseStatus: 'succeeded',
    chunkId: 'chunk-archived',
    chunkIndex: 0,
    textPreview: 'archived 不应生成 embedding。',
  },
  {
    tenantId: 'tenant-b',
    knowledgeId: 'knowledge-b',
    knowledgeTitle: '跨租户知识库',
    fileId: 'file-b',
    fileName: '跨租户.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-b-0',
    chunkIndex: 0,
    textPreview: 'tenant B 不可见。',
  },
];

function createRepository() {
  const embeddings = new Map<string, PlatformKnowledgeVectorSearchCandidateRecord>();
  return {
    listKnowledgeItems: vi.fn(async (input: { tenantId: string }) =>
      knowledgeRecords.filter((record) => record.tenantId === input.tenantId),
    ),
    listKnowledgeEmbeddingCandidates: vi.fn(async (input: {
      tenantId: string;
      knowledgeId?: string;
      fileId?: string;
    }) =>
      embeddingCandidates
        .filter((candidate) => candidate.tenantId === input.tenantId)
        .filter((candidate) => !input.knowledgeId || candidate.knowledgeId === input.knowledgeId)
        .filter((candidate) => !input.fileId || candidate.fileId === input.fileId),
    ),
    saveKnowledgeChunkEmbeddings: vi.fn(async (records: Array<{
      tenantId: string;
      knowledgeId: string;
      fileId: string;
      chunkId: string;
      embeddingProvider: string;
      embeddingModel: string;
      embeddingDimensions: number;
      embeddingVectorJson: number[];
      status: 'ready';
    }>) => {
      records.forEach((record) => {
        const candidate = embeddingCandidates.find((item) =>
          item.tenantId === record.tenantId && item.chunkId === record.chunkId
        );
        if (!candidate) return;
        embeddings.set(`${record.tenantId}:${record.chunkId}`, {
          ...candidate,
          embeddingId: `embedding-${record.chunkId}`,
          embeddingProvider: record.embeddingProvider,
          embeddingModel: record.embeddingModel,
          embeddingDimensions: record.embeddingDimensions,
          embeddingVectorJson: record.embeddingVectorJson,
          embeddingStatus: record.status,
        });
      });
      return records.map((record) => ({
        embeddingId: `embedding-${record.chunkId}`,
        tenantId: record.tenantId,
        knowledgeId: record.knowledgeId,
        fileId: record.fileId,
        chunkId: record.chunkId,
        embeddingProvider: record.embeddingProvider,
        embeddingModel: record.embeddingModel,
        embeddingDimensions: record.embeddingDimensions,
        status: record.status,
      }));
    }),
    listKnowledgeVectorSearchCandidates: vi.fn(async (input: {
      tenantId: string;
      knowledgeId?: string;
      fileId?: string;
    }) =>
      Array.from(embeddings.values())
        .filter((candidate) => candidate.tenantId === input.tenantId)
        .filter((candidate) => !input.knowledgeId || candidate.knowledgeId === input.knowledgeId)
        .filter((candidate) => !input.fileId || candidate.fileId === input.fileId),
    ),
  };
}

function expectSafePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  unsafeFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function expectVectorResponse(
  response: Awaited<ReturnType<typeof searchPlatformKnowledgeVectorChunksService>>,
): PlatformKnowledgeVectorSearchResponse {
  if ('status' in response) {
    throw new Error(`expected vector response, got ${response.status}`);
  }
  return response;
}

describe('知识库 embedding 与向量检索 service', () => {
  it('同一 chunk 文本生成稳定 mock embedding，且不调用外部 AI / 网络服务', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const first = createDeterministicMockKnowledgeEmbedding('术后护理需要冷敷，避免暴晒。');
    const second = createDeterministicMockKnowledgeEmbedding('术后护理需要冷敷，避免暴晒。');
    const different = createDeterministicMockKnowledgeEmbedding('复诊提醒');

    expect(first).toEqual(second);
    expect(first.vector).toHaveLength(8);
    expect(first.vector).not.toEqual(different.vector);
    expect(first).toEqual(expect.objectContaining({
      provider: 'mock_local_embedding',
      model: 'mock-local-embedding-v1',
      dimensions: 8,
    }));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('平台端只给 succeeded 且 active 的 chunk 生成 embedding 并持久化低敏摘要', async () => {
    const repository = createRepository();

    const response = await generatePlatformKnowledgeChunkEmbeddingsService({
      repository,
      params: {
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
      },
    });

    expect(response).toEqual(expect.objectContaining({
      status: 'succeeded',
      embeddingCount: 2,
    }));
    expect(repository.saveKnowledgeChunkEmbeddings).toHaveBeenCalledWith([
      expect.objectContaining({ chunkId: 'chunk-a-0', embeddingDimensions: 8 }),
      expect.objectContaining({ chunkId: 'chunk-a-1', embeddingDimensions: 8 }),
    ]);
    const serialized = JSON.stringify(repository.saveKnowledgeChunkEmbeddings.mock.calls[0][0]);
    expect(serialized).not.toContain('chunk-pending');
    expect(serialized).not.toContain('chunk-failed');
    expect(serialized).not.toContain('chunk-archived');
    expect(serialized).not.toContain('chunk-b-0');
    expectSafePayload(response);
  });

  it('平台端向量检索返回相似引用片段且不泄露 embeddingVectorJson', async () => {
    const repository = createRepository();
    await generatePlatformKnowledgeChunkEmbeddingsService({
      repository,
      params: { tenantId: 'tenant-a' },
    });

    const response = expectVectorResponse(await searchPlatformKnowledgeVectorChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        query: '冷敷护理',
        page: 1,
        pageSize: 5,
      },
    }));

    expect(response.records[0]).toEqual(expect.objectContaining({
      knowledgeId: 'knowledge-a',
      knowledgeTitle: '术后护理知识库',
      fileId: 'file-a',
      fileName: '护理说明.txt',
      chunkId: expect.any(String),
      chunkIndex: expect.any(Number),
      textPreview: expect.any(String),
      score: expect.any(Number),
      matchReason: expect.stringContaining('mock embedding 相似度'),
    }));
    expect(response.records[0].score).toBeGreaterThanOrEqual(response.records.at(-1)?.score ?? 0);
    expectSafePayload(response);
  });

  it('机构端只能检索授权范围，机构 B 和 tenant B 不可见', async () => {
    const repository = createRepository();
    await generatePlatformKnowledgeChunkEmbeddingsService({
      repository,
      params: { tenantId: 'tenant-a' },
    });

    const response = expectVectorResponse(await searchInstitutionKnowledgeVectorChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-visible-a',
        query: '冷敷护理',
        page: 1,
        pageSize: 10,
      },
    }));

    expect(response.records.map((record) => record.knowledgeId)).toEqual(['knowledge-a', 'knowledge-a']);
    expect(JSON.stringify(response)).not.toContain('knowledge-hidden');
    expect(JSON.stringify(response)).not.toContain('knowledge-b');
    expectSafePayload(response);
  });

  it('空 query 返回 validation_failed 且不访问 repository', async () => {
    const repository = createRepository();

    const response = await searchPlatformKnowledgeVectorChunksService({
      repository,
      params: {
        tenantId: 'tenant-a',
        query: '   ',
      },
    });

    expect(response).toEqual({
      status: 'validation_failed',
      message: '请输入语义检索内容',
    });
    expect(repository.listKnowledgeVectorSearchCandidates).not.toHaveBeenCalled();
  });
});
