import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import * as overviewRoute from '@/app/api/v1/open-platform/knowledge-management/route';
import * as filesRoute from '@/app/api/v1/open-platform/knowledge-management/files/route';
import * as itemsRoute from '@/app/api/v1/open-platform/knowledge-management/items/route';
import * as visibilityRoute from '@/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/visibility/route';
import { getDatabase } from '@/server/db/client';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';

const database = { database: 'platform-knowledge-test-db' };
const repository = {
  listKnowledgeOverviewItems: vi.fn(),
  listKnowledgeOverviewFiles: vi.fn(),
  listKnowledgeOverviewQaAudits: vi.fn(),
  listKnowledgeDirectorySources: vi.fn(),
  listKnowledgeItems: vi.fn(),
  hasTenantInstitution: vi.fn(),
  bindInstitutionVisibility: vi.fn(),
  unbindInstitutionVisibility: vi.fn(),
};

vi.mock('@/server/db/client', () => ({
  createDatabaseUrlErrorMessage: vi.fn(() => 'DATABASE_URL is not configured'),
  getDatabase: vi.fn(() => database),
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

const apiUrl = 'http://localhost/api/v1/open-platform/knowledge-management/items';
const visibilityUrl =
  'http://localhost/api/v1/open-platform/knowledge-management/items/knowledge-route-a/visibility';
const now = new Date('2026-06-13T08:00:00.000Z');
const unsafeError = new Error(
  'SQL failed at /Users/demo/project with database postgres://root:password@localhost token=secret drizzle stack',
);
const unsafeFragments = [
  'SQL',
  'database',
  '/Users/',
  'drizzle',
  'postgres',
  'password',
  'token',
];
const forbiddenKnowledgeFields = [
  'content',
  'rawContent',
  'parsedContent',
  'embedding',
  'embeddingVectorJson',
  'trainingContent',
];

const routeRecords: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-route-a',
    tenantId: 'tenant-route-a',
    tenantName: '路由租户 A',
    institutionId: 'inst-owner-a',
    workspaceId: 'workspace-a',
    title: '平台端真实列表记录',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '演示知识',
    descriptionPreview: '只返回低敏摘要。',
    chunkCount: 1,
    visibleInstitutionIds: ['inst-visible-a'],
    createdAt: now,
    updatedAt: now,
  },
];

const routeFiles = [
  {
    fileId: 'file-route-a',
    taskId: 'file-route-a',
    tenantId: 'tenant-route-a',
    tenantName: '路由租户 A',
    knowledgeId: 'knowledge-route-a',
    fileName: '平台真实文件.pdf',
    mimeType: 'application/pdf',
    fileType: 'PDF',
    fileSizeKb: 24,
    category: '演示知识',
    folder: 'workspace-a',
    parseStatus: 'parsed' as const,
    taskStatus: 'completed' as const,
    parsedChars: 1200,
    safeErrorMessage: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  },
];

const routeAudits = [
  {
    auditId: 'audit-route-a',
    tenantId: 'tenant-route-a',
    institutionId: 'inst-visible-a',
    actorScope: 'platform' as const,
    actorUserId: 'platform-user-a',
    question: '术后怎么护理？',
    answerPreview: '低敏回答预览。',
    retrievalMode: 'hybrid' as const,
    citationCount: 2,
    safeStatus: 'answered',
    safeFailureMessage: null,
    createdAt: now.toISOString(),
  },
];

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');

  return response.json() as Promise<Record<string, unknown>>;
}

describe('平台知识库管理 V1 真实数据 API route', () => {
  beforeEach(() => {
    repository.listKnowledgeOverviewItems.mockReset();
    repository.listKnowledgeOverviewFiles.mockReset();
    repository.listKnowledgeOverviewQaAudits.mockReset();
    repository.listKnowledgeDirectorySources.mockReset();
    repository.listKnowledgeItems.mockReset();
    repository.hasTenantInstitution.mockReset();
    repository.bindInstitutionVisibility.mockReset();
    repository.unbindInstitutionVisibility.mockReset();
    repository.listKnowledgeOverviewItems.mockResolvedValue(routeRecords);
    repository.listKnowledgeOverviewFiles.mockResolvedValue(routeFiles);
    repository.listKnowledgeOverviewQaAudits.mockResolvedValue(routeAudits);
    repository.listKnowledgeDirectorySources.mockResolvedValue([]);
    repository.hasTenantInstitution.mockResolvedValue(true);
    vi.mocked(getDatabase).mockClear();
    vi.mocked(createPlatformKnowledgeManagementRepository).mockClear();
  });

  it('overview GET 默认接入 repository 汇总核心概览，不再返回 mock 数据源', async () => {
    const response = await overviewRoute.GET(
      new Request('http://localhost/api/v1/open-platform/knowledge-management'),
    );
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(repository.listKnowledgeOverviewItems).toHaveBeenCalledWith({ tenantId: null });
    expect(repository.listKnowledgeOverviewFiles).toHaveBeenCalledWith({ tenantId: null });
    expect(repository.listKnowledgeOverviewQaAudits).toHaveBeenCalledWith({ tenantId: null });
    expect(payload.dataSource).toBe('repository');
    expect(payload.totals).toEqual(expect.objectContaining({
      knowledgeCount: 1,
      sourceFileCount: 1,
      parsedFileCount: 1,
    }));
    expect(payload.categoryStats).toEqual([
      expect.objectContaining({ categoryName: '演示知识', knowledgeCount: 1 }),
    ]);
    expect(payload.directories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'virtual_root',
          name: '全部知识库',
          knowledgeCount: 1,
          fileCount: 1,
        }),
        expect.objectContaining({
          kind: 'knowledge_library',
          name: '演示知识',
          knowledgeCount: 1,
          fileCount: 1,
        }),
        expect.objectContaining({
          kind: 'folder',
          name: 'workspace-a',
          knowledgeCount: 1,
          fileCount: 1,
        }),
      ]),
    );
    expect(payload.topQuestions).toEqual([
      expect.objectContaining({ questionTitle: '术后怎么护理？', hitCount: 1 }),
    ]);
    expect(serialized).not.toContain('storageKey');
    expect(serialized).not.toContain('embeddingVectorJson');
  });

  it('files GET 默认接入 repository 文件低敏列表，不再返回 mock 数据源', async () => {
    const response = await filesRoute.GET(
      new Request('http://localhost/api/v1/open-platform/knowledge-management/files?keyword=平台真实文件'),
    );
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(repository.listKnowledgeOverviewFiles).toHaveBeenCalledWith({ tenantId: null });
    expect(payload.dataSource).toBe('repository');
    expect(payload.records).toEqual([
      expect.objectContaining({
        fileId: 'file-route-a',
        fileName: '平台真实文件.pdf',
        tenantName: '路由租户 A',
      }),
    ]);
    expect(serialized).not.toContain('storageKey');
    expect(serialized).not.toContain('DATABASE_URL');
  });

  it('items GET 默认接入 repository 知识条目低敏列表，不再 fallback mock', async () => {
    const response = await itemsRoute.GET(
      new Request(`${apiUrl}?keyword=${encodeURIComponent('平台端真实列表')}`),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(repository.listKnowledgeOverviewItems).toHaveBeenCalledWith({ tenantId: null });
    expect(payload.dataSource).toBe('repository');
    expect(payload.records).toEqual([
      expect.objectContaining({
        knowledgeId: 'knowledge-route-a',
        title: '平台端真实列表记录',
      }),
    ]);
  });

  it('visibility route 只暴露平台端 POST/DELETE 绑定接口', () => {
    expect(Object.keys(visibilityRoute).sort()).toEqual(['DELETE', 'POST']);
  });

  it('items GET 带 tenantId 时接入真实 repository/service 并保持低敏 payload', async () => {
    repository.listKnowledgeItems.mockResolvedValue(routeRecords);

    const response = await itemsRoute.GET(
      new Request(`${apiUrl}?tenantId=tenant-route-a&keyword=${encodeURIComponent('真实列表')}`),
    );
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(repository.listKnowledgeItems).toHaveBeenCalledWith({ tenantId: 'tenant-route-a' });
    expect(payload.dataSource).toBe('repository');
    expect(payload.records).toEqual([
      expect.objectContaining({
        knowledgeId: 'knowledge-route-a',
        tenantId: 'tenant-route-a',
        visibleInstitutionIds: ['inst-visible-a'],
      }),
    ]);
    forbiddenKnowledgeFields.forEach((field) => {
      expect(serialized).not.toContain(`"${field}"`);
    });
  });

  it('items GET 数据库未配置且无 tenantId 时返回未接入空态，且不暴露配置细节', async () => {
    vi.mocked(getDatabase).mockImplementationOnce(() => {
      throw new Error('DATABASE_URL is not configured');
    });

    const response = await itemsRoute.GET(
      new Request(`${apiUrl}?keyword=${encodeURIComponent('恢复期')}`),
    );
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload.dataSource).toBe('unconnected');
    expect(payload.records).toEqual([]);
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(repository.listKnowledgeItems).not.toHaveBeenCalled();
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('星澜医美中心');
  });

  it('items GET 仅在数据库未配置时返回未接入空态，不暴露 DATABASE_URL 细节', async () => {
    vi.mocked(getDatabase).mockImplementationOnce(() => {
      throw new Error('DATABASE_URL is not configured');
    });

    const response = await itemsRoute.GET(
      new Request(`${apiUrl}?tenantId=tenant-low-hit&keyword=${encodeURIComponent('恢复期')}`),
    );
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(payload.dataSource).toBe('unconnected');
    expect(payload.records).toEqual([]);
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres');
    expect(serialized).not.toContain('星澜医美中心');
  });

  it('items GET 底层异常时返回安全中文文案且不暴露数据库细节', async () => {
    repository.listKnowledgeItems.mockRejectedValue(unsafeError);

    const response = await itemsRoute.GET(
      new Request(`${apiUrl}?tenantId=tenant-route-a`),
    );
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: 'readonly_contract_error',
        message: '知识库条目暂时无法查询',
      },
    });
    unsafeFragments.forEach((fragment) => {
      expect(serialized).not.toContain(fragment);
    });
  });

  it('visibility POST/DELETE 接入绑定和解绑 service', async () => {
    repository.bindInstitutionVisibility.mockResolvedValue({
      status: 'bound',
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      visibleInstitutionIds: ['inst-visible-a'],
    });
    repository.unbindInstitutionVisibility.mockResolvedValue({
      status: 'unbound',
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      visibleInstitutionIds: [],
    });

    const postResponse = await visibilityRoute.POST(
      new Request(visibilityUrl, {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-route-a', institutionId: 'inst-visible-a' }),
      }),
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a' }) },
    );
    expect(postResponse.status).toBe(200);
    expect(await readJson(postResponse)).toEqual({
      status: 'bound',
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      visibleInstitutionIds: ['inst-visible-a'],
    });
    expect(repository.bindInstitutionVisibility).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      institutionId: 'inst-visible-a',
    });

    const deleteResponse = await visibilityRoute.DELETE(
      new Request(visibilityUrl, {
        method: 'DELETE',
        body: JSON.stringify({ tenantId: 'tenant-route-a', institutionId: 'inst-visible-a' }),
      }),
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a' }) },
    );
    expect(deleteResponse.status).toBe(200);
    expect(await readJson(deleteResponse)).toEqual({
      status: 'unbound',
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      visibleInstitutionIds: [],
    });
    expect(repository.unbindInstitutionVisibility).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      institutionId: 'inst-visible-a',
    });
  });

  it.each([
    {
      method: 'POST',
      handler: visibilityRoute.POST,
      body: { institutionId: 'inst-visible-a' },
      label: 'POST 缺 tenantId',
    },
    {
      method: 'POST',
      handler: visibilityRoute.POST,
      body: { tenantId: 'tenant-route-a' },
      label: 'POST 缺 institutionId',
    },
    {
      method: 'DELETE',
      handler: visibilityRoute.DELETE,
      body: { institutionId: 'inst-visible-a' },
      label: 'DELETE 缺 tenantId',
    },
    {
      method: 'DELETE',
      handler: visibilityRoute.DELETE,
      body: { tenantId: 'tenant-route-a' },
      label: 'DELETE 缺 institutionId',
    },
  ])('$label 返回 400 且不初始化数据库', async ({ method, handler, body }) => {
    const response = await handler(
      new Request(visibilityUrl, {
        method,
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a' }) },
    );

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ status: 'validation_failed' });
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(repository.bindInstitutionVisibility).not.toHaveBeenCalled();
    expect(repository.unbindInstitutionVisibility).not.toHaveBeenCalled();
  });

  it.each([
    {
      method: 'POST',
      handler: visibilityRoute.POST,
      repositoryMethod: repository.bindInstitutionVisibility,
      label: 'POST 目标知识库不存在或跨 tenant',
    },
    {
      method: 'DELETE',
      handler: visibilityRoute.DELETE,
      repositoryMethod: repository.unbindInstitutionVisibility,
      label: 'DELETE 目标知识库不存在或跨 tenant',
    },
  ])('$label 返回 404', async ({ method, handler, repositoryMethod }) => {
    repositoryMethod.mockResolvedValue({ status: 'not_found' });

    const response = await handler(
      new Request(visibilityUrl, {
        method,
        body: JSON.stringify({
          tenantId: 'tenant-route-a',
          institutionId: 'inst-visible-a',
        }),
      }),
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a' }) },
    );

    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ status: 'not_found' });
    expect(repositoryMethod).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
      institutionId: 'inst-visible-a',
    });
  });

  it.each([
    {
      method: 'POST',
      handler: visibilityRoute.POST,
      repositoryMethod: repository.bindInstitutionVisibility,
      label: 'POST',
    },
    {
      method: 'DELETE',
      handler: visibilityRoute.DELETE,
      repositoryMethod: repository.unbindInstitutionVisibility,
      label: 'DELETE',
    },
  ])('$label institutionId 不属于当前 tenant 时返回安全失败且不写入可见范围', async ({
    method,
    handler,
    repositoryMethod,
  }) => {
    repository.hasTenantInstitution.mockResolvedValueOnce(false);

    const response = await handler(
      new Request(visibilityUrl, {
        method,
        body: JSON.stringify({
          tenantId: 'tenant-route-a',
          institutionId: 'inst-other-tenant',
        }),
      }),
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a' }) },
    );

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ status: 'validation_failed' });
    expect(repository.hasTenantInstitution).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      institutionId: 'inst-other-tenant',
    });
    expect(repositoryMethod).not.toHaveBeenCalled();
  });

  it.each([
    {
      method: 'POST',
      handler: visibilityRoute.POST,
      repositoryMethod: repository.bindInstitutionVisibility,
      label: 'POST',
    },
    {
      method: 'DELETE',
      handler: visibilityRoute.DELETE,
      repositoryMethod: repository.unbindInstitutionVisibility,
      label: 'DELETE',
    },
  ])('$label 底层异常时返回安全中文文案且不暴露数据库细节', async ({
    method,
    handler,
    repositoryMethod,
  }) => {
    repositoryMethod.mockRejectedValue(unsafeError);

    const response = await handler(
      new Request(visibilityUrl, {
        method,
        body: JSON.stringify({
          tenantId: 'tenant-route-a',
          institutionId: 'inst-visible-a',
        }),
      }),
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a' }) },
    );
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: 'readonly_contract_error',
        message: '知识库可见范围暂时无法更新',
      },
    });
    unsafeFragments.forEach((fragment) => {
      expect(serialized).not.toContain(fragment);
    });
  });
});
