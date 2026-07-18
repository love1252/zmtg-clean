import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import type { KnowledgeIndexingJobRecord } from '@/modules/open-platform/server/platform-knowledge-indexing-job-service';
import * as itemsRoute from '@/app/api/institution/knowledge-management/items/route';
import * as embeddingsRoute from '@/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/embeddings/route';
import { getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';

const database = { database: 'institution-knowledge-test-db' };
let createdIndexingJob: KnowledgeIndexingJobRecord | null = null;
const repository = {
  listKnowledgeItems: vi.fn(),
  findKnowledgeItem: vi.fn(),
  findKnowledgeFile: vi.fn(),
  listKnowledgeEmbeddingCandidates: vi.fn(),
  listKnowledgeVectorSearchCandidates: vi.fn(),
  saveKnowledgeChunkEmbeddings: vi.fn(),
  createKnowledgeIndexingJob: vi.fn(async (record: KnowledgeIndexingJobRecord) => {
    createdIndexingJob = record;
    return record;
  }),
  updateKnowledgeIndexingJob: vi.fn(async (input: {
    tenantId: string;
    jobId: string;
    patch: Partial<KnowledgeIndexingJobRecord>;
  }) => {
    if (!createdIndexingJob) return null;
    createdIndexingJob = { ...createdIndexingJob, ...input.patch };
    return createdIndexingJob;
  }),
  findKnowledgeIndexingJob: vi.fn(),
  listKnowledgeIndexingJobs: vi.fn(),
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

const apiUrl = 'http://localhost/api/institution/knowledge-management/items';
const now = new Date('2026-06-13T08:00:00.000Z');
const routeRecords: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-visible-route',
    tenantId: 'tenant-route',
    tenantName: '路由租户',
    institutionId: 'inst-owner',
    workspaceId: 'workspace-route',
    title: '机构端授权可见知识',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '机构端只读低敏摘要。',
    chunkCount: 2,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-hidden-route',
    tenantId: 'tenant-route',
    tenantName: '路由租户',
    institutionId: 'inst-other',
    workspaceId: 'workspace-hidden',
    title: '未授权知识',
    version: 'v1',
    sourceKind: 'seed',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '不可见',
    descriptionPreview: '不应可见。',
    chunkCount: 1,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
];

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');
  return response.json() as Promise<Record<string, unknown>>;
}

describe('机构端知识库管理 V1 只读 API route', () => {
  beforeEach(() => {
    createdIndexingJob = null;
    (repository.listKnowledgeItems as Mock).mockReset();
    (repository.findKnowledgeItem as Mock).mockReset();
    (repository.findKnowledgeFile as Mock).mockReset();
    (repository.listKnowledgeEmbeddingCandidates as Mock).mockReset();
    (repository.listKnowledgeVectorSearchCandidates as Mock).mockReset();
    (repository.saveKnowledgeChunkEmbeddings as Mock).mockReset();
    (repository.createKnowledgeIndexingJob as Mock).mockClear();
    (repository.updateKnowledgeIndexingJob as Mock).mockClear();
    (repository.findKnowledgeIndexingJob as Mock).mockReset();
    (repository.findKnowledgeIndexingJob as Mock).mockImplementation(async (input: { tenantId: string; jobId: string }) => (
      createdIndexingJob?.tenantId === input.tenantId && createdIndexingJob.jobId === input.jobId
        ? createdIndexingJob
        : null
    ));
    (repository.listKnowledgeIndexingJobs as Mock).mockReset();
    vi.mocked(getDatabase).mockClear();
    vi.mocked(createPlatformKnowledgeManagementRepository).mockClear();
    vi.mocked(getDemoAccessContextFromRequest).mockReset();
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      userId: 'demo-user-admin',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'tenant-route',
      institutionId: 'inst-current',
      source: 'demo_session',
    });
  });

  it('GET 固定返回资料库 capability disabled，且不初始化旧 repository', async () => {
    const response = await itemsRoute.GET(new Request(`${apiUrl}?keyword=${encodeURIComponent('授权')}&page=1&pageSize=10`));
    const payload = await readJson(response);

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      status: 'capability_disabled',
      code: 'knowledge_items_capability_disabled',
      message: '机构知识库资料库暂未启用。',
    });
    expect(getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
  });

  it('POST embeddings 把 institutionId 传入 service 并只允许当前机构可见 knowledge/file', async () => {
    repository.listKnowledgeItems.mockResolvedValue(routeRecords);
    repository.findKnowledgeItem.mockResolvedValue(routeRecords[0]);
    repository.findKnowledgeFile.mockResolvedValue({
      fileId: 'file-visible-route',
      tenantId: 'tenant-route',
      knowledgeId: 'knowledge-visible-route',
      originalFilename: '授权文件.txt',
      storageKey: 'safe-storage-key',
      mimeType: 'text/plain',
      sizeBytes: 32,
      sha256: 'hash',
      status: 'active',
      uploadedByUserId: 'demo-user-admin',
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      fileType: 'TXT',
      sizeLabel: '1 KB',
      parseStatus: 'succeeded',
      failureReasonCode: null,
      safeFailureMessage: null,
      textLength: 32,
      chunkCount: 1,
      parserVersion: 'test-parser',
    });
    repository.listKnowledgeEmbeddingCandidates.mockResolvedValue([
      {
        tenantId: 'tenant-route',
        knowledgeId: 'knowledge-visible-route',
        knowledgeTitle: '机构端授权可见知识',
        fileId: 'file-visible-route',
        fileName: '授权文件.txt',
        fileStatus: 'active',
        parseStatus: 'succeeded',
        chunkId: 'chunk-visible-route-0',
        chunkIndex: 0,
        textPreview: '授权机构可生成向量索引的片段。',
      },
    ]);
    repository.listKnowledgeVectorSearchCandidates.mockResolvedValue([]);
    repository.saveKnowledgeChunkEmbeddings.mockResolvedValue([
      {
        embeddingId: 'embedding-visible-route-0',
        tenantId: 'tenant-route',
        knowledgeId: 'knowledge-visible-route',
        fileId: 'file-visible-route',
        chunkId: 'chunk-visible-route-0',
        embeddingDimensions: 8,
        status: 'ready',
        failureReasonCode: null,
      },
    ]);

    const response = await embeddingsRoute.POST(
      new Request(`${apiUrl}/knowledge-visible-route/files/file-visible-route/embeddings`, {
        method: 'POST',
        body: JSON.stringify({ rebuild: true }),
      }),
      { params: Promise.resolve({ knowledgeId: 'knowledge-visible-route', fileId: 'file-visible-route' }) },
    );
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(repository.findKnowledgeItem).toHaveBeenCalledWith({
      tenantId: 'tenant-route',
      knowledgeId: 'knowledge-visible-route',
    });
    expect(repository.listKnowledgeEmbeddingCandidates).toHaveBeenCalledWith({
      tenantId: 'tenant-route',
      knowledgeId: 'knowledge-visible-route',
      fileId: 'file-visible-route',
    });
    expect(repository.createKnowledgeIndexingJob).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-route',
      institutionId: 'inst-current',
      knowledgeId: 'knowledge-visible-route',
      fileId: 'file-visible-route',
      jobType: 'rebuild_embeddings',
      status: 'pending',
    }));
    expect(payload).toEqual(expect.objectContaining({
      jobType: 'rebuild_embeddings',
      status: 'succeeded',
      totalCount: 1,
      processedCount: 1,
      failedCount: 0,
    }));
    expect(serialized).not.toContain('embeddingVectorJson');
    expect(serialized).not.toMatch(/provider|model|token|cost|vendor/i);
  });

  it('POST embeddings 阻断同 tenant 其他机构不可见 knowledge/file', async () => {
    repository.listKnowledgeItems.mockResolvedValue(routeRecords);
    repository.findKnowledgeItem.mockResolvedValue(routeRecords[1]);

    const response = await embeddingsRoute.POST(
      new Request(`${apiUrl}/knowledge-hidden-route/files/file-hidden-route/embeddings`, {
        method: 'POST',
        body: JSON.stringify({ rebuild: true }),
      }),
      { params: Promise.resolve({ knowledgeId: 'knowledge-hidden-route', fileId: 'file-hidden-route' }) },
    );
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(403);
    expect(payload).toEqual({ status: 'forbidden' });
    expect(repository.createKnowledgeIndexingJob).not.toHaveBeenCalled();
    expect(repository.listKnowledgeEmbeddingCandidates).not.toHaveBeenCalled();
    expect(repository.saveKnowledgeChunkEmbeddings).not.toHaveBeenCalled();
    expect(serialized).not.toContain('embeddingVectorJson');
    expect(serialized).not.toMatch(/provider|model|token|cost|vendor/i);
  });

});
