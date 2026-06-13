import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PlatformKnowledgeFileRepositoryRecord,
  PlatformKnowledgeFileStorage,
} from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import * as platformFilesRoute from '@/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/route';
import * as platformFileRoute from '@/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/[fileId]/route';
import * as platformDownloadRoute from '@/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/[fileId]/download/route';
import * as institutionFilesRoute from '@/app/api/institution/knowledge-management/items/[knowledgeId]/files/route';
import * as institutionDownloadRoute from '@/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/download/route';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { createLocalPlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-storage';

const database = { database: 'knowledge-file-route-db' };
const now = new Date('2026-06-13T08:00:00.000Z');
const content = new TextEncoder().encode('file bytes');

const knowledgeRecord: PlatformKnowledgeRepositoryRecord = {
  knowledgeId: 'knowledge-route-a',
  tenantId: 'tenant-route-a',
  tenantName: '租户 A',
  institutionId: 'inst-owner-a',
  workspaceId: 'workspace-a',
  title: '路由知识库',
  version: 'v1',
  sourceKind: 'demo',
  status: 'ready',
  readonlyStatus: 'readonly',
  category: '术后护理',
  descriptionPreview: '低敏摘要。',
  chunkCount: 0,
  visibleInstitutionIds: ['inst-visible-a'],
  createdAt: now,
  updatedAt: now,
};

const fileRecord: PlatformKnowledgeFileRepositoryRecord = {
  fileId: 'file-route-a',
  tenantId: 'tenant-route-a',
  knowledgeId: 'knowledge-route-a',
  originalFilename: '术后护理.pdf',
  storageKey: 'tenant-route-a/knowledge-route-a/file-route-a.bin',
  mimeType: 'application/pdf',
  sizeBytes: content.byteLength,
  sha256: 'b'.repeat(64),
  status: 'active',
  uploadedByUserId: 'platform-user-a',
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

const repository = {
  findKnowledgeItem: vi.fn(),
  listKnowledgeFiles: vi.fn(),
  findKnowledgeFile: vi.fn(),
  createKnowledgeFile: vi.fn(),
  archiveKnowledgeFile: vi.fn(),
};

const storage: PlatformKnowledgeFileStorage = {
  save: vi.fn(),
  read: vi.fn(),
};

const unsafeError = new Error(
  'DATABASE_URL postgres://root:password@localhost token=secret /Users/demo/path SQL stack',
);
const unsafeFragments = [
  'DATABASE_URL',
  'postgres',
  'password',
  'token',
  'secret',
  '/Users/',
  'SQL',
  'stack',
  'storageKey',
];

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

vi.mock('@/modules/open-platform/server/platform-knowledge-file-storage', () => ({
  createLocalPlatformKnowledgeFileStorage: vi.fn(() => storage),
}));

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');
  return response.json() as Promise<Record<string, unknown>>;
}

function platformFilesUrl(search = '') {
  return `http://localhost/api/v1/open-platform/knowledge-management/items/knowledge-route-a/files${search}`;
}

function platformFileUrl(search = '') {
  return `http://localhost/api/v1/open-platform/knowledge-management/items/knowledge-route-a/files/file-route-a${search}`;
}

function platformDownloadUrl(search = '') {
  return `http://localhost/api/v1/open-platform/knowledge-management/items/knowledge-route-a/files/file-route-a/download${search}`;
}

function buildMultipartUploadRequest() {
  return new Request(platformFilesUrl(), {
    method: 'POST',
    body: JSON.stringify({
      tenantId: 'tenant-route-a',
      uploadedByUserId: 'platform-user-a',
      fileName: '../术后护理.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from(content).toString('base64'),
    }),
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('知识库文件管理 API route', () => {
  beforeEach(() => {
    repository.findKnowledgeItem.mockReset();
    repository.listKnowledgeFiles.mockReset();
    repository.findKnowledgeFile.mockReset();
    repository.createKnowledgeFile.mockReset();
    repository.archiveKnowledgeFile.mockReset();
    storage.save = vi.fn(async () => ({
      storageKey: fileRecord.storageKey,
      sha256: fileRecord.sha256,
      sizeBytes: fileRecord.sizeBytes,
    }));
    storage.read = vi.fn(async () => content);
    repository.findKnowledgeItem.mockResolvedValue(knowledgeRecord);
    repository.listKnowledgeFiles.mockResolvedValue([fileRecord]);
    repository.findKnowledgeFile.mockResolvedValue(fileRecord);
    repository.createKnowledgeFile.mockImplementation(async (record) => record);
    repository.archiveKnowledgeFile.mockResolvedValue({ ...fileRecord, status: 'archived' });
    vi.mocked(getDatabase).mockClear();
    vi.mocked(createPlatformKnowledgeManagementRepository).mockClear();
    vi.mocked(createLocalPlatformKnowledgeFileStorage).mockClear();
    vi.mocked(getDemoAccessContextFromRequest).mockReset();
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      userId: 'demo-user-a',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'tenant-route-a',
      institutionId: 'inst-visible-a',
      source: 'demo_session',
    });
  });

  it('平台端 POST 上传、GET 列表、GET 下载和 DELETE 归档文件', async () => {
    const uploadResponse = await platformFilesRoute.POST(
      buildMultipartUploadRequest(),
      { params: { knowledgeId: 'knowledge-route-a' } },
    );
    const uploadPayload = await readJson(uploadResponse);

    expect(uploadResponse.status).toBe(201);
    expect(uploadPayload.status).toBe('uploaded');
    expect(JSON.stringify(uploadPayload)).not.toContain('storageKey');
    expect(storage.save).toHaveBeenCalled();
    expect(repository.createKnowledgeFile).toHaveBeenCalled();

    const listResponse = await platformFilesRoute.GET(
      new Request(platformFilesUrl('?tenantId=tenant-route-a&page=1&pageSize=10')),
      { params: { knowledgeId: 'knowledge-route-a' } },
    );
    const listPayload = await readJson(listResponse);
    expect(listResponse.status).toBe(200);
    expect(listPayload.records).toEqual([
      expect.objectContaining({
        fileId: 'file-route-a',
        originalFilename: '术后护理.pdf',
        status: 'active',
      }),
    ]);
    expect(JSON.stringify(listPayload)).not.toContain('storageKey');

    const downloadResponse = await platformDownloadRoute.GET(
      new Request(platformDownloadUrl('?tenantId=tenant-route-a')),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get('content-disposition')).toContain(
      encodeURIComponent('术后护理.pdf'),
    );
    expect(downloadResponse.headers.get('x-storage-path')).toBeNull();
    expect(await downloadResponse.text()).toBe('file bytes');

    const deleteResponse = await platformFileRoute.DELETE(
      new Request(platformFileUrl('?tenantId=tenant-route-a'), { method: 'DELETE' }),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    expect(deleteResponse.status).toBe(200);
    expect(await readJson(deleteResponse)).toEqual(
      expect.objectContaining({
        status: 'archived',
        file: expect.objectContaining({ fileId: 'file-route-a', status: 'archived' }),
      }),
    );
  });

  it('平台端底层异常返回固定中文安全错误文案', async () => {
    repository.listKnowledgeFiles.mockRejectedValue(unsafeError);

    const response = await platformFilesRoute.GET(
      new Request(platformFilesUrl('?tenantId=tenant-route-a')),
      { params: { knowledgeId: 'knowledge-route-a' } },
    );
    const payload = await readJson(response);
    const serialized = JSON.stringify(payload);

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: 'readonly_contract_error',
        message: '知识库文件暂时无法处理',
      },
    });
    unsafeFragments.forEach((fragment) => {
      expect(serialized).not.toContain(fragment);
    });
  });

  it('机构端只暴露 GET 列表和 GET 下载，不暴露上传删除归档', async () => {
    expect(Object.keys(institutionFilesRoute).sort()).toEqual(['GET']);
    expect(Object.keys(institutionDownloadRoute).sort()).toEqual(['GET']);

    const listResponse = await institutionFilesRoute.GET(
      new Request('http://localhost/api/institution/knowledge-management/items/knowledge-route-a/files'),
      { params: { knowledgeId: 'knowledge-route-a' } },
    );
    const listPayload = await readJson(listResponse);
    expect(listResponse.status).toBe(200);
    expect(listPayload.records).toEqual([
      expect.objectContaining({
        fileId: 'file-route-a',
        originalFilename: '术后护理.pdf',
        status: 'active',
      }),
    ]);
    expect(JSON.stringify(listPayload)).not.toContain('storageKey');

    const downloadResponse = await institutionDownloadRoute.GET(
      new Request(
        'http://localhost/api/institution/knowledge-management/items/knowledge-route-a/files/file-route-a/download',
      ),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    expect(downloadResponse.status).toBe(200);
    expect(await downloadResponse.text()).toBe('file bytes');
  });

  it('机构端未授权、跨 institution 或底层异常时安全返回', async () => {
    repository.findKnowledgeItem.mockResolvedValueOnce({
      ...knowledgeRecord,
      visibleInstitutionIds: [],
      institutionId: 'inst-owner-other',
    });

    const forbidden = await institutionFilesRoute.GET(
      new Request('http://localhost/api/institution/knowledge-management/items/knowledge-route-a/files'),
      { params: { knowledgeId: 'knowledge-route-a' } },
    );
    expect(forbidden.status).toBe(403);
    expect(await readJson(forbidden)).toEqual({ code: 'forbidden', error: '没有访问权限' });

    repository.findKnowledgeItem.mockRejectedValueOnce(unsafeError);
    const failed = await institutionFilesRoute.GET(
      new Request('http://localhost/api/institution/knowledge-management/items/knowledge-route-a/files'),
      { params: { knowledgeId: 'knowledge-route-a' } },
    );
    const payload = await readJson(failed);
    const serialized = JSON.stringify(payload);

    expect(failed.status).toBe(503);
    expect(payload).toEqual({
      code: 'service_unavailable',
      error: '知识库文件暂时不可用',
    });
    unsafeFragments.forEach((fragment) => {
      expect(serialized).not.toContain(fragment);
    });
  });
});
