import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as platformSearchRoute from '@/app/api/v1/open-platform/knowledge-management/search/route';
import * as institutionSearchRoute from '@/app/api/institution/knowledge-management/search/route';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

const database = { database: 'knowledge-search-route-test-db' };
const repository = {
  listKnowledgeItems: vi.fn(),
  searchKnowledgeFileParseChunks: vi.fn(),
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

const platformUrl = 'http://localhost/api/v1/open-platform/knowledge-management/search';
const institutionUrl = 'http://localhost/api/institution/knowledge-management/search';
const now = new Date('2026-06-13T08:00:00.000Z');
const unsafeError = new Error(
  'SQL select * from chunks at /Users/demo/path postgres://root:password@localhost token=secret stack',
);
const unsafeFragments = [
  'SQL',
  'select *',
  '/Users/',
  'postgres',
  'password',
  'token',
  'secret',
  'stack',
  'storageKey',
  'embedding',
  'trainingContent',
  'answer',
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

const hiddenKnowledge = {
  ...visibleKnowledge,
  knowledgeId: 'knowledge-hidden',
  institutionId: 'inst-other',
  title: '未授权知识',
};

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');
  return response.json() as Promise<Record<string, unknown>>;
}

function expectSafePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  unsafeFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('知识库关键词检索 API route', () => {
  beforeEach(() => {
    repository.listKnowledgeItems.mockReset();
    repository.searchKnowledgeFileParseChunks.mockReset();
    vi.mocked(getDatabase).mockClear();
    vi.mocked(createPlatformKnowledgeManagementRepository).mockClear();
    vi.mocked(getDemoAccessContextFromRequest).mockReset();
  });

  it('平台端 GET 要求 platform scope 并返回引用片段结构', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      userId: 'platform-user',
      role: 'platform_admin',
      scope: 'platform',
      tenantId: null,
      institutionId: null,
      source: 'demo_session',
    });
    repository.listKnowledgeItems.mockResolvedValue([visibleKnowledge]);
    repository.searchKnowledgeFileParseChunks.mockResolvedValue([
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

    const response = await platformSearchRoute.GET(
      new Request(`${platformUrl}?tenantId=tenant-route&keyword=${encodeURIComponent('冷敷')}`),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(repository.searchKnowledgeFileParseChunks).toHaveBeenCalledWith({
      tenantId: 'tenant-route',
      keyword: '冷敷',
      knowledgeId: undefined,
      fileId: undefined,
    });
    expect(payload.records).toEqual([
      {
        knowledgeId: 'knowledge-visible',
        knowledgeTitle: '机构可见知识',
        fileId: 'file-visible',
        fileName: '护理.txt',
        chunkId: 'chunk-visible-0',
        chunkIndex: 0,
        textPreview: '冷敷片段。',
        matchReason: '片段包含关键词“冷敷”',
        parseStatus: 'succeeded',
      },
    ]);
    expectSafePayload(payload);
  });

  it('平台端非 platform scope 不可检索且不初始化 repository', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      userId: 'tenant-user',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'tenant-route',
      institutionId: 'inst-current',
      source: 'demo_session',
    });

    const response = await platformSearchRoute.GET(
      new Request(`${platformUrl}?tenantId=tenant-route&keyword=${encodeURIComponent('冷敷')}`),
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ code: 'forbidden', error: '没有访问权限' });
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
  });

  it('平台端空关键词返回固定中文 validation_failed', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      userId: 'platform-user',
      role: 'platform_admin',
      scope: 'platform',
      tenantId: null,
      institutionId: null,
      source: 'demo_session',
    });

    const response = await platformSearchRoute.GET(new Request(`${platformUrl}?tenantId=tenant-route`));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({
      status: 'validation_failed',
      message: '请输入关键词后再检索知识片段',
    });
    expect(repository.searchKnowledgeFileParseChunks).not.toHaveBeenCalled();
  });

  it('机构端 GET 只使用 access context 的 tenant/institution，忽略 query 注入范围', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      userId: 'tenant-user',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'tenant-route',
      institutionId: 'inst-current',
      source: 'demo_session',
    });
    repository.listKnowledgeItems.mockResolvedValue([visibleKnowledge, hiddenKnowledge]);
    repository.searchKnowledgeFileParseChunks.mockResolvedValue([
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
      {
        tenantId: 'tenant-route',
        knowledgeId: 'knowledge-hidden',
        knowledgeTitle: '未授权知识',
        fileId: 'file-hidden',
        fileName: '隐藏.txt',
        fileStatus: 'active',
        parseStatus: 'succeeded',
        chunkId: 'chunk-hidden-0',
        chunkIndex: 0,
        textPreview: '隐藏冷敷片段。',
      },
    ]);

    const response = await institutionSearchRoute.GET(
      new Request(
        `${institutionUrl}?tenantId=tenant-other&institutionId=inst-other&keyword=${encodeURIComponent('冷敷')}`,
      ),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(repository.searchKnowledgeFileParseChunks).toHaveBeenCalledWith({
      tenantId: 'tenant-route',
      keyword: '冷敷',
      knowledgeId: undefined,
      fileId: undefined,
    });
    expect(payload.records).toEqual([
      expect.objectContaining({
        knowledgeId: 'knowledge-visible',
        chunkId: 'chunk-visible-0',
      }),
    ]);
    expect(JSON.stringify(payload)).not.toContain('chunk-hidden-0');
    expectSafePayload(payload);
  });

  it('机构端底层异常时返回固定中文安全错误', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      userId: 'tenant-user',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'tenant-route',
      institutionId: 'inst-current',
      source: 'demo_session',
    });
    repository.searchKnowledgeFileParseChunks.mockRejectedValue(unsafeError);

    const response = await institutionSearchRoute.GET(
      new Request(`${institutionUrl}?keyword=${encodeURIComponent('冷敷')}`),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      code: 'service_unavailable',
      error: '知识库片段检索暂时不可用',
    });
    expectSafePayload(payload);
  });
});
