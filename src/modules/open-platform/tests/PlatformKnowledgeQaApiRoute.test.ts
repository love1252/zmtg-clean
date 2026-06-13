import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as platformQaRoute from '@/app/api/v1/open-platform/knowledge-management/qa/route';
import * as institutionQaRoute from '@/app/api/institution/knowledge-management/qa/route';
import * as platformEmbeddingRoute from '@/app/api/v1/open-platform/knowledge-management/embeddings/route';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

const database = { database: 'knowledge-qa-route-test-db' };
const repository = {
  listKnowledgeItems: vi.fn(),
  searchKnowledgeFileParseChunks: vi.fn(),
  listKnowledgeVectorSearchCandidates: vi.fn(),
  createKnowledgeQaAuditLog: vi.fn(),
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

const now = new Date('2026-06-14T08:00:00.000Z');
const platformQaUrl = 'http://localhost/api/v1/open-platform/knowledge-management/qa';
const institutionQaUrl = 'http://localhost/api/institution/knowledge-management/qa';
const platformEmbeddingUrl = 'http://localhost/api/v1/open-platform/knowledge-management/embeddings';
const unsafeFragments = [
  'storageKey',
  '/Users/',
  'embeddingVectorJson',
  'embedding_vector_json',
  'SQL',
  'stack',
  'token',
  'secret',
  'textContent',
  'fullText',
  'postgres://',
];

const visibleKnowledge = {
  knowledgeId: 'knowledge-visible',
  tenantId: 'tenant-route',
  tenantName: '路由租户',
  institutionId: 'inst-current',
  workspaceId: 'workspace-route',
  title: '授权护理知识库',
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

const hiddenKnowledge = {
  ...visibleKnowledge,
  knowledgeId: 'knowledge-hidden',
  institutionId: 'inst-hidden',
  title: '隐藏知识库',
};

const visibleChunk = {
  tenantId: 'tenant-route',
  knowledgeId: 'knowledge-visible',
  knowledgeTitle: '授权护理知识库',
  fileId: 'file-visible',
  fileName: '护理.txt',
  fileStatus: 'active' as const,
  parseStatus: 'succeeded' as const,
  chunkId: 'chunk-visible-0',
  chunkIndex: 0,
  textPreview: '冷敷护理建议片段。',
};

const hiddenChunk = {
  ...visibleChunk,
  knowledgeId: 'knowledge-hidden',
  knowledgeTitle: '隐藏知识库',
  fileId: 'file-hidden',
  fileName: '隐藏.txt',
  chunkId: 'chunk-hidden-0',
  textPreview: '机构 B 看不到机构 A 内容。',
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

describe('知识库 QA API route', () => {
  beforeEach(() => {
    Object.values(repository).forEach((mock) => mock.mockReset());
    repository.createKnowledgeQaAuditLog.mockImplementation(async (record) => ({
      auditId: record.auditId,
    }));
    vi.mocked(getDatabase).mockClear();
    vi.mocked(createPlatformKnowledgeManagementRepository).mockClear();
    vi.mocked(getDemoAccessContextFromRequest).mockReset();
  });

  it('平台端 POST QA 返回 answer、citations、auditId 且不泄露低层字段', async () => {
    platformContext();
    repository.listKnowledgeItems.mockResolvedValue([visibleKnowledge]);
    repository.searchKnowledgeFileParseChunks.mockResolvedValue([visibleChunk]);
    repository.listKnowledgeVectorSearchCandidates.mockResolvedValue([]);

    const response = await platformQaRoute.POST(
      new Request(platformQaUrl, {
        method: 'POST',
        body: JSON.stringify({
          tenantId: 'tenant-route',
          question: '冷敷后怎么护理？',
          retrievalMode: 'keyword',
        }),
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        answer: expect.stringContaining('基于已召回的知识片段'),
        retrievalMode: 'keyword',
        auditId: expect.stringMatching(/^kb-qa-audit-/),
        safeStatus: 'answered',
      }),
    );
    expect(payload.citations).toEqual([
      expect.objectContaining({
        knowledgeId: 'knowledge-visible',
        fileId: 'file-visible',
        chunkId: 'chunk-visible-0',
        score: expect.any(Number),
      }),
    ]);
    expect(repository.createKnowledgeQaAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-route',
        institutionId: null,
        actorScope: 'platform',
        actorUserId: 'platform-user',
        safeStatus: 'answered',
      }),
    );
    expectSafePayload(payload);
  });

  it('机构端 POST QA 只使用 access context 的 tenant 和 institution', async () => {
    institutionContext();
    repository.listKnowledgeItems.mockResolvedValue([visibleKnowledge, hiddenKnowledge]);
    repository.searchKnowledgeFileParseChunks.mockResolvedValue([visibleChunk, hiddenChunk]);
    repository.listKnowledgeVectorSearchCandidates.mockResolvedValue([]);

    const response = await institutionQaRoute.POST(
      new Request(institutionQaUrl, {
        method: 'POST',
        body: JSON.stringify({
          tenantId: 'tenant-other',
          institutionId: 'inst-other',
          question: '冷敷后怎么护理？',
          retrievalMode: 'keyword',
        }),
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(repository.searchKnowledgeFileParseChunks).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-route' }),
    );
    expect(payload.citations).toEqual([
      expect.objectContaining({
        knowledgeId: 'knowledge-visible',
        chunkId: 'chunk-visible-0',
      }),
    ]);
    expect(JSON.stringify(payload)).not.toContain('chunk-hidden-0');
    expect(repository.createKnowledgeQaAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-route',
        institutionId: 'inst-current',
        actorScope: 'institution',
      }),
    );
    expectSafePayload(payload);
  });

  it('空问题返回中文 validation_failed', async () => {
    platformContext();

    const response = await platformQaRoute.POST(
      new Request(platformQaUrl, {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-route', question: '   ' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({
      status: 'validation_failed',
      message: '请输入知识库问答问题',
    });
    expect(repository.createKnowledgeQaAuditLog).not.toHaveBeenCalled();
  });

  it('非 platform scope 不能调用平台 QA 且机构端不能发起 embedding 生成', async () => {
    institutionContext();

    const qaResponse = await platformQaRoute.POST(
      new Request(platformQaUrl, {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-route', question: '冷敷？' }),
      }),
    );
    const embeddingResponse = await platformEmbeddingRoute.POST(
      new Request(platformEmbeddingUrl, {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-route' }),
      }),
    );

    expect(qaResponse.status).toBe(403);
    expect(await readJson(qaResponse)).toEqual({ code: 'forbidden', error: '没有访问权限' });
    expect(embeddingResponse.status).toBe(403);
    expect(await readJson(embeddingResponse)).toEqual({ code: 'forbidden', error: '没有访问权限' });
  });

  it('service 抛错时返回固定中文安全错误文案', async () => {
    platformContext();
    repository.listKnowledgeItems.mockRejectedValueOnce(
      new Error('SQL stack /Users/demo postgres://root:password@localhost token secret'),
    );

    const response = await platformQaRoute.POST(
      new Request(platformQaUrl, {
        method: 'POST',
        body: JSON.stringify({
          tenantId: 'tenant-route',
          question: '冷敷后怎么护理？',
          retrievalMode: 'keyword',
        }),
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      code: 'service_unavailable',
      error: '知识库问答暂时无法处理',
    });
    expectSafePayload(payload);
  });
});
