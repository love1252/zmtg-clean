import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as directoryRoute from '@/app/api/v1/open-platform/knowledge-management/directories/[directoryId]/route';
import * as directoriesRoute from '@/app/api/v1/open-platform/knowledge-management/directories/route';
import * as reorderRoute from '@/app/api/v1/open-platform/knowledge-management/directories/reorder/route';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';

const database = { database: 'platform-knowledge-directory-test-db' };
const repository = {
  listKnowledgeOverviewItems: vi.fn(),
  listKnowledgeOverviewFiles: vi.fn(),
  listKnowledgeOverviewQaAudits: vi.fn(),
  listKnowledgeDirectorySources: vi.fn(),
  renameKnowledgeDirectory: vi.fn(),
  createKnowledgeDirectory: vi.fn(),
  archiveKnowledgeDirectory: vi.fn(),
  reorderKnowledgeDirectories: vi.fn(),
};
const auditRepository = {
  recordAttributed: vi.fn(),
};
const now = new Date('2026-06-13T08:00:00.000Z');
const libraryDirectoryId = 'directory:library:%E6%BC%94%E7%A4%BA%E7%9F%A5%E8%AF%86';
const folderDirectoryId = 'directory:folder:%E6%BC%94%E7%A4%BA%E7%9F%A5%E8%AF%86:workspace-a';
const unsafeFragments = [
  'DATABASE_URL',
  'postgres://',
  'storageKey',
  'secret',
  'token',
  '/Users/',
  'stack',
];

const routeRecords = [
  {
    knowledgeId: 'knowledge-route-a',
    tenantId: 'tenant-route-a',
    tenantName: '路由租户 A',
    institutionId: 'inst-owner-a',
    workspaceId: 'workspace-a',
    title: '平台端真实列表记录',
    version: 'v1',
    sourceKind: 'demo' as const,
    status: 'ready' as const,
    readonlyStatus: 'readonly' as const,
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

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => database),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: vi.fn(() => auditRepository),
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

function routeContext(directoryId: string) {
  return { params: Promise.resolve({ directoryId }) };
}

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

describe('平台知识库目录管理 API route', () => {
  beforeEach(() => {
    vi.mocked(getDatabase).mockClear();
    vi.mocked(createPlatformKnowledgeManagementRepository).mockClear();
    vi.mocked(createAuditEventRepository).mockClear();
    repository.listKnowledgeOverviewItems.mockReset();
    repository.listKnowledgeOverviewFiles.mockReset();
    repository.listKnowledgeOverviewQaAudits.mockReset();
    repository.listKnowledgeDirectorySources.mockReset();
    repository.renameKnowledgeDirectory.mockReset();
    repository.createKnowledgeDirectory.mockReset();
    repository.archiveKnowledgeDirectory.mockReset();
    repository.reorderKnowledgeDirectories.mockReset();
    auditRepository.recordAttributed.mockReset();
    repository.listKnowledgeOverviewItems.mockResolvedValue(routeRecords);
    repository.listKnowledgeOverviewFiles.mockResolvedValue(routeFiles);
    repository.listKnowledgeOverviewQaAudits.mockResolvedValue([]);
    repository.listKnowledgeDirectorySources.mockResolvedValue([]);
    repository.renameKnowledgeDirectory.mockResolvedValue({
      status: 'renamed',
      affectedSources: 1,
      affectedDocuments: 1,
      affectedChunks: 1,
      affectedJobs: 0,
    });
    repository.createKnowledgeDirectory.mockResolvedValue({
      status: 'created',
      sourceId: 'directory-source-created',
    });
    repository.archiveKnowledgeDirectory.mockResolvedValue({
      status: 'archived',
      affectedSources: 1,
    });
    repository.reorderKnowledgeDirectories.mockResolvedValue({
      status: 'reordered',
      affectedSources: 2,
    });
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      userId: 'platform-user-a',
      role: 'platform_admin',
      scope: 'platform',
      tenantId: null,
      institutionId: null,
      source: 'demo_session',
    });
  });

  it('PATCH 可重命名已有一级知识库目录，返回低敏目录并写审计事件', async () => {
    const response = await directoryRoute.PATCH(
      new Request(`http://localhost/api/v1/open-platform/knowledge-management/directories/${libraryDirectoryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ tenantId: 'tenant-route-a', name: '自定义演示知识库' }),
        headers: { 'content-type': 'application/json' },
      }),
      routeContext(libraryDirectoryId),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(repository.renameKnowledgeDirectory).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      directoryId: libraryDirectoryId,
      nextName: '自定义演示知识库',
    });
    expect(payload).toEqual(expect.objectContaining({
      status: 'renamed',
      message: '目录名称已保存',
      directory: expect.objectContaining({
        name: '自定义演示知识库',
        kind: 'knowledge_library',
        canRename: true,
      }),
    }));
    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'platform-user-a',
      tenantId: 'tenant-route-a',
      institutionId: null,
      institutionAttribution: 'not_applicable',
      resource: 'knowledge_management',
      action: 'update',
      result: 'allowed',
      reason: 'allowed_by_policy',
    }));
    expectSafePayload(payload);
  });

  it('PATCH 可重命名已有子目录 workspace，保持中文失败和 loading 可区分状态的服务端 contract', async () => {
    const response = await directoryRoute.PATCH(
      new Request(`http://localhost/api/v1/open-platform/knowledge-management/directories/${folderDirectoryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ tenantId: 'tenant-route-a', name: '新工作区' }),
        headers: { 'content-type': 'application/json' },
      }),
      routeContext(folderDirectoryId),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(repository.renameKnowledgeDirectory).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      directoryId: folderDirectoryId,
      nextName: '新工作区',
    });
    expect(payload).toEqual(expect.objectContaining({
      status: 'renamed',
      message: '目录名称已保存',
      directory: expect.objectContaining({
        name: '新工作区',
        kind: 'folder',
      }),
    }));
    expectSafePayload(payload);
  });

  it('PATCH 校验重名、长度和非法字符，不触发 repository mutation', async () => {
    const response = await directoryRoute.PATCH(
      new Request(`http://localhost/api/v1/open-platform/knowledge-management/directories/${libraryDirectoryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ tenantId: 'tenant-route-a', name: '../secret' }),
        headers: { 'content-type': 'application/json' },
      }),
      routeContext(libraryDirectoryId),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual(expect.objectContaining({
      status: 'validation_failed',
      message: '目录名称不能包含路径或控制字符',
    }));
    expect(repository.renameKnowledgeDirectory).not.toHaveBeenCalled();
    expect(auditRepository.recordAttributed).not.toHaveBeenCalled();
    expectSafePayload(payload);
  });

  it('POST 可新增一级知识库目录，返回低敏目录并写审计事件', async () => {
    const response = await directoriesRoute.POST(
      new Request('http://localhost/api/v1/open-platform/knowledge-management/directories', {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-route-a', name: '新知识库', parentId: null }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(201);
    expect(repository.createKnowledgeDirectory).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      name: '新知识库',
      parentId: null,
      libraryName: '新知识库',
      folderName: null,
    });
    expect(payload).toEqual(expect.objectContaining({
      status: 'created',
      message: '目录已创建',
      directory: expect.objectContaining({
        name: '新知识库',
        kind: 'knowledge_library',
        knowledgeCount: 0,
        fileCount: 0,
      }),
    }));
    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'platform-user-a',
      tenantId: 'tenant-route-a',
      institutionId: null,
      institutionAttribution: 'not_applicable',
      resource: 'knowledge_management',
      action: 'create',
      result: 'allowed',
    }));
    expectSafePayload(payload);
  });

  it('POST 可在一级知识库下新增子目录，校验父目录存在并写 repository', async () => {
    const response = await directoriesRoute.POST(
      new Request('http://localhost/api/v1/open-platform/knowledge-management/directories', {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-route-a', name: '新工作区', parentId: libraryDirectoryId }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(201);
    expect(repository.createKnowledgeDirectory).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      name: '新工作区',
      parentId: libraryDirectoryId,
      libraryName: '演示知识',
      folderName: '新工作区',
    });
    expect(payload).toEqual(expect.objectContaining({
      status: 'created',
      directory: expect.objectContaining({
        name: '新工作区',
        kind: 'folder',
        parentId: libraryDirectoryId,
      }),
    }));
    expectSafePayload(payload);
  });

  it('DELETE 非空目录会阻断归档，并返回需要先迁移内容的原因', async () => {
    const response = await directoryRoute.DELETE(
      new Request(`http://localhost/api/v1/open-platform/knowledge-management/directories/${libraryDirectoryId}?tenantId=tenant-route-a`, {
        method: 'DELETE',
      }),
      routeContext(libraryDirectoryId),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(409);
    expect(payload).toEqual(expect.objectContaining({
      status: 'blocked',
      message: '目录下仍有知识条目或文件，请先迁移后再归档',
    }));
    expect(auditRepository.recordAttributed).not.toHaveBeenCalled();
    expectSafePayload(payload);
  });

  it('DELETE 空目录会软归档目录源并写审计事件', async () => {
    repository.listKnowledgeOverviewItems.mockResolvedValue([]);
    repository.listKnowledgeOverviewFiles.mockResolvedValue([]);
    repository.listKnowledgeDirectorySources.mockResolvedValue([
      {
        tenantId: 'tenant-route-a',
        sourceLabel: '演示知识',
        workspaceId: '__library__',
        status: 'empty',
      },
    ]);

    const response = await directoryRoute.DELETE(
      new Request(`http://localhost/api/v1/open-platform/knowledge-management/directories/${libraryDirectoryId}?tenantId=tenant-route-a`, {
        method: 'DELETE',
      }),
      routeContext(libraryDirectoryId),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(repository.archiveKnowledgeDirectory).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      directoryId: libraryDirectoryId,
    });
    expect(payload).toEqual(expect.objectContaining({
      status: 'archived',
      message: '目录已归档',
      directory: expect.objectContaining({
        name: '演示知识',
        status: 'archived',
      }),
    }));
    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'platform-user-a',
      tenantId: 'tenant-route-a',
      institutionId: null,
      institutionAttribution: 'not_applicable',
      resource: 'knowledge_management',
      action: 'update',
      result: 'allowed',
    }));
    expectSafePayload(payload);
  });

  it('PATCH 排序会持久化目录顺序并写审计事件', async () => {
    const response = await reorderRoute.PATCH(
      new Request('http://localhost/api/v1/open-platform/knowledge-management/directories/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ tenantId: 'tenant-route-a', directoryIds: [folderDirectoryId, libraryDirectoryId] }),
        headers: { 'content-type': 'application/json' },
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(repository.reorderKnowledgeDirectories).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      directoryIds: [folderDirectoryId, libraryDirectoryId],
    });
    expect(payload).toEqual(expect.objectContaining({
      status: 'reordered',
      message: '目录排序已保存',
      affected: expect.objectContaining({
        sources: 2,
      }),
    }));
    expect(auditRepository.recordAttributed).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'platform-user-a',
      tenantId: 'tenant-route-a',
      institutionId: null,
      institutionAttribution: 'not_applicable',
      resource: 'knowledge_management',
      action: 'update',
      result: 'allowed',
    }));
    expectSafePayload(payload);
  });
});
