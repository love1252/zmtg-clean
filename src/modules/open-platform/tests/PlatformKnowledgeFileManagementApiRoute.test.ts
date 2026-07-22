import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PlatformKnowledgeFileRepositoryRecord,
  PlatformKnowledgeFileStorage,
} from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import * as platformFilesRoute from '@/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/route';
import * as platformFileRoute from '@/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/[fileId]/route';
import * as platformDownloadRoute from '@/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/[fileId]/download/route';
import * as institutionDownloadRoute from '@/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/download/route';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import type { AccessContext } from '@/modules/security/domain/access-control';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { createLocalPlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-storage';

type InstitutionFilesRoute = typeof import('@/app/api/institution/knowledge-management/items/[knowledgeId]/files/route');

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
  delete: vi.fn(),
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

const institutionFilesDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_files_capability_disabled',
  error: '机构知识库文件列表暂未启用。',
});

const deniedPlatformContexts: Array<{
  label: string;
  context: AccessContext | null;
  expectedStatus: number;
  expectedPayload: { code: string; error: string };
}> = [
  {
    label: '未登录',
    context: null,
    expectedStatus: 401,
    expectedPayload: { code: 'unauthorized', error: '请先登录' },
  },
  {
    label: '非 platform scope',
    context: {
      userId: 'tenant-user',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'tenant-route-a',
      institutionId: 'inst-visible-a',
      source: 'demo_session',
    },
    expectedStatus: 403,
    expectedPayload: { code: 'forbidden', error: '没有访问权限' },
  },
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

function platformFilesContext() {
  return { params: Promise.resolve({ knowledgeId: 'knowledge-route-a' }) };
}

function buildMultipartUploadRequest() {
  return new Request(platformFilesUrl(), {
    method: 'POST',
    body: JSON.stringify({
      tenantId: 'tenant-route-a',
      uploadedByUserId: 'fake-user',
      fileName: '../术后护理.pdf',
      mimeType: 'application/pdf',
      contentBase64: Buffer.from(content).toString('base64'),
    }),
    headers: {
      'content-type': 'application/json',
    },
  });
}

async function expectInstitutionFilesDisabled(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(institutionFilesDisabledPayload);
}

function hostileProxy<T extends object>() {
  const counts = {
    get: 0,
    set: 0,
    has: 0,
    ownKeys: 0,
    getOwnPropertyDescriptor: 0,
    getPrototypeOf: 0,
  };
  const trap = <K extends keyof typeof counts>(name: K): never => {
    counts[name] += 1;
    throw new Error(`${name} must not run`);
  };

  return {
    value: new Proxy({}, {
      get: () => trap('get'),
      set: () => trap('set'),
      has: () => trap('has'),
      ownKeys: () => trap('ownKeys'),
      getOwnPropertyDescriptor: () => trap('getOwnPropertyDescriptor'),
      getPrototypeOf: () => trap('getPrototypeOf'),
    }) as T,
    counts,
  };
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
    storage.delete = vi.fn(async () => undefined);
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
      userId: 'platform-session-user',
      role: 'platform_admin',
      scope: 'platform',
      tenantId: null,
      institutionId: null,
      source: 'demo_session',
    });
  });

  it('平台端 POST 上传、GET 列表、GET 下载和 DELETE 归档文件', async () => {
    const uploadResponse = await platformFilesRoute.POST(
      buildMultipartUploadRequest(),
      platformFilesContext(),
    );
    const uploadPayload = await readJson(uploadResponse);

    expect(uploadResponse.status).toBe(201);
    expect(uploadPayload.status).toBe('uploaded');
    expect(JSON.stringify(uploadPayload)).not.toContain('storageKey');
    expect(storage.save).toHaveBeenCalled();
    expect(repository.createKnowledgeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedByUserId: 'platform-session-user',
      }),
    );
    expect(repository.createKnowledgeFile).not.toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedByUserId: 'fake-user',
      }),
    );

    const listResponse = await platformFilesRoute.GET(
      new Request(platformFilesUrl('?tenantId=tenant-route-a&page=1&pageSize=10')),
      platformFilesContext(),
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
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
    );
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get('content-disposition')).toContain(
      encodeURIComponent('术后护理.pdf'),
    );
    expect(downloadResponse.headers.get('x-storage-path')).toBeNull();
    expect(await downloadResponse.text()).toBe('file bytes');

    const deleteResponse = await platformFileRoute.DELETE(
      new Request(platformFileUrl('?tenantId=tenant-route-a'), { method: 'DELETE' }),
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
    );
    expect(deleteResponse.status).toBe(200);
    expect(await readJson(deleteResponse)).toEqual(
      expect.objectContaining({
        status: 'archived',
        file: expect.objectContaining({ fileId: 'file-route-a', status: 'archived' }),
      }),
    );
  });

  it.each(deniedPlatformContexts)('平台端 $label 时拒绝文件 route 且不初始化 repository/storage', async ({
    context,
    expectedStatus,
    expectedPayload,
  }) => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValueOnce(context);

    const response = await platformFilesRoute.POST(
      buildMultipartUploadRequest(),
      platformFilesContext(),
    );

    expect(response.status).toBe(expectedStatus);
    expect(await readJson(response)).toEqual(expectedPayload);
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(createLocalPlatformKnowledgeFileStorage).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();
    expect(storage.read).not.toHaveBeenCalled();
    expect(repository.createKnowledgeFile).not.toHaveBeenCalled();
    expect(repository.archiveKnowledgeFile).not.toHaveBeenCalled();
  });

  it('平台端非 platform scope 时列表、下载和归档都不初始化 repository/storage', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
      userId: 'tenant-user',
      role: 'tenant_admin',
      scope: 'tenant',
      tenantId: 'tenant-route-a',
      institutionId: 'inst-visible-a',
      source: 'demo_session',
    });

    const listResponse = await platformFilesRoute.GET(
      new Request(platformFilesUrl('?tenantId=tenant-route-a')),
      platformFilesContext(),
    );
    const downloadResponse = await platformDownloadRoute.GET(
      new Request(platformDownloadUrl('?tenantId=tenant-route-a')),
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
    );
    const archiveResponse = await platformFileRoute.DELETE(
      new Request(platformFileUrl('?tenantId=tenant-route-a'), { method: 'DELETE' }),
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
    );

    expect(listResponse.status).toBe(403);
    expect(downloadResponse.status).toBe(403);
    expect(archiveResponse.status).toBe(403);
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(createLocalPlatformKnowledgeFileStorage).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();
    expect(storage.read).not.toHaveBeenCalled();
    expect(repository.createKnowledgeFile).not.toHaveBeenCalled();
    expect(repository.archiveKnowledgeFile).not.toHaveBeenCalled();
  });

  it('平台端底层异常返回固定中文安全错误文案', async () => {
    repository.listKnowledgeFiles.mockRejectedValue(unsafeError);

    const response = await platformFilesRoute.GET(
      new Request(platformFilesUrl('?tenantId=tenant-route-a')),
      platformFilesContext(),
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

  it('机构端 files-root 对普通、伪造和非法输入固定 capability disabled 且不回显输入', async () => {
    const institutionFilesRoute = await import(
      '@/app/api/institution/knowledge-management/items/[knowledgeId]/files/route'
    );
    const invokeGet = institutionFilesRoute.GET as unknown as (
      request?: unknown,
      context?: unknown,
    ) => Response | Promise<Response>;
    const sensitiveMarkers = [
      'private-knowledge-id',
      'private-file-name.pdf',
      'private-provider-token',
    ];

    expect(Object.keys(institutionFilesRoute).sort()).toEqual(['GET']);
    expect(Object.keys(institutionDownloadRoute).sort()).toEqual(['GET']);

    const responses = [
      invokeGet(),
      invokeGet(
        new Request(
          `http://localhost/api/institution/knowledge-management/items/${sensitiveMarkers[0]}/files?fileName=${sensitiveMarkers[1]}`,
          { headers: { authorization: `Bearer ${sensitiveMarkers[2]}` } },
        ),
        { params: Promise.resolve({ knowledgeId: sensitiveMarkers[0] }) },
      ),
      invokeGet(null, { params: null }),
    ];

    for (const pendingResponse of responses) {
      const response = await pendingResponse;
      const replay = response.clone();
      await expectInstitutionFilesDisabled(response);
      const serialized = JSON.stringify(await replay.json());
      sensitiveMarkers.forEach((marker) => expect(serialized).not.toContain(marker));
      expect(serialized).not.toContain('originalFilename');
      expect(serialized).not.toContain('ocrStatus');
      expect(serialized).not.toContain('parseStatus');
      expect(serialized).not.toContain('failureReasonCode');
    }

    expect(getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(createLocalPlatformKnowledgeFileStorage).not.toHaveBeenCalled();
    expect(repository.findKnowledgeItem).not.toHaveBeenCalled();
    expect(repository.listKnowledgeFiles).not.toHaveBeenCalled();
    expect(storage.read).not.toHaveBeenCalled();

    const downloadResponse = await institutionDownloadRoute.GET(
      new Request(
        'http://localhost/api/institution/knowledge-management/items/knowledge-route-a/files/file-route-a/download',
      ),
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
    );
    expect(downloadResponse.status).toBe(503);
    expect(downloadResponse.headers.get('cache-control')).toBe('no-store');
    expect(await readJson(downloadResponse)).toEqual({
      status: 'capability_disabled',
      code: 'capability_disabled',
      error: '机构知识库文件下载暂未启用。',
    });
  });

  it('机构端 files-root 不触碰 hostile Request/context/params 的任一 trap', async () => {
    const institutionFilesRoute = await import(
      '@/app/api/institution/knowledge-management/items/[knowledgeId]/files/route'
    );
    const invokeGet = institutionFilesRoute.GET as unknown as (
      request?: unknown,
      context?: unknown,
    ) => Response | Promise<Response>;
    const request = hostileProxy<Request>();
    const params = hostileProxy<Record<string, string>>();
    const context = hostileProxy<{ params: unknown }>();

    const responses = [
      await invokeGet(request.value, { params: params.value }),
      await invokeGet({}, context.value),
    ];

    for (const response of responses) {
      await expectInstitutionFilesDisabled(response);
    }
    [request.counts, context.counts, params.counts].forEach((counts) => {
      expect(counts).toEqual({
        get: 0,
        set: 0,
        has: 0,
        ownKeys: 0,
        getOwnPropertyDescriptor: 0,
        getPrototypeOf: 0,
      });
    });
    expect(getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(repository.findKnowledgeItem).not.toHaveBeenCalled();
    expect(repository.listKnowledgeFiles).not.toHaveBeenCalled();
  });

  it('机构端 files-root 源码仅依赖 NextResponse 且不含旧数据链或输入读取', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/api/institution/knowledge-management/items/[knowledgeId]/files/route.ts',
      ),
      'utf8',
    );
    const imports = source.match(/^import .+;$/gmu) ?? [];

    expect(imports).toEqual(["import { NextResponse } from 'next/server';"]);
    expect(source).not.toMatch(
      /getDemoAccessContextFromRequest|getDatabase|repository|storage|provider|listInstitutionKnowledgeFilesService|\b_?(?:request|context|params)\s*(?:\.|\[)|fetch\(/u,
    );
  });

  it('机构端 files-root 动态加载与调用均不初始化旧依赖或 fetch', async () => {
    vi.resetModules();
    const initialized: string[] = [];
    const forbiddenModules = [
      ['@/modules/security/server/access-context', 'auth'],
      ['@/server/db/client', 'db'],
      ['@/modules/open-platform/server/platform-knowledge-management-repository', 'repository'],
      ['@/modules/institution/server/institution-knowledge-file-management-service', 'file-service'],
      ['@/modules/open-platform/server/platform-knowledge-file-storage', 'storage'],
    ] as const;
    forbiddenModules.forEach(([modulePath, label]) => {
      vi.doMock(modulePath, () => {
        initialized.push(label);
        throw new Error(`${label} must not initialize`);
      });
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('fetch must not run');
    });

    try {
      const route = await import(
        '@/app/api/institution/knowledge-management/items/[knowledgeId]/files/route'
      ) as InstitutionFilesRoute;
      const response = route.GET();

      expect(initialized).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
      await expectInstitutionFilesDisabled(response);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
