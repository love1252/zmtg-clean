import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccessContext } from '@/modules/security/domain/access-control';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import type {
  PlatformKnowledgeFileRepositoryRecord,
  PlatformKnowledgeFileStorage,
} from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import type {
  PlatformKnowledgeFileParseChunkRecord,
  PlatformKnowledgeFileParseRecord,
} from '@/modules/open-platform/server/platform-knowledge-document-parsing-service';
import * as platformParseRoute from '@/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/route';
import * as platformChunksRoute from '@/app/api/v1/open-platform/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks/route';
import * as institutionParseRoute from '@/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/route';
import * as institutionChunksRoute from '@/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks/route';
import { getDatabase } from '@/server/db/client';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { createLocalPlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-storage';

const database = { database: 'knowledge-parsing-route-db' };
const now = new Date('2026-06-13T08:00:00.000Z');
const textContent = new TextEncoder().encode('术后护理文本。'.repeat(20));

const platformAccessContext: AccessContext = {
  userId: 'platform-session-user',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  institutionId: null,
  source: 'demo_session',
};

const tenantAccessContext: AccessContext = {
  userId: 'tenant-session-user',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-route-a',
  institutionId: 'inst-visible-a',
  source: 'demo_session',
};

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
  originalFilename: '术后护理.txt',
  storageKey: 'tenant-route-a/knowledge-route-a/file-route-a.bin',
  mimeType: 'text/plain',
  sizeBytes: textContent.byteLength,
  sha256: 'b'.repeat(64),
  status: 'active',
  uploadedByUserId: 'platform-user-a',
  createdAt: now,
  updatedAt: now,
  archivedAt: null,
};

const parseRecord: PlatformKnowledgeFileParseRecord = {
  parseId: 'parse-route-a',
  tenantId: 'tenant-route-a',
  knowledgeId: 'knowledge-route-a',
  fileId: 'file-route-a',
  parseStatus: 'succeeded',
  failureReasonCode: null,
  safeFailureMessage: null,
  textContent: '术后护理文本。',
  textLength: 7,
  chunkCount: 1,
  parserVersion: 'local-text-parser-v1',
  createdAt: now,
  updatedAt: now,
};

const chunkRecord: PlatformKnowledgeFileParseChunkRecord = {
  chunkId: 'chunk-route-a',
  tenantId: 'tenant-route-a',
  knowledgeId: 'knowledge-route-a',
  fileId: 'file-route-a',
  chunkIndex: 0,
  textPreview: '术后护理文本。',
  charCount: 7,
  createdAt: now,
  updatedAt: now,
};

const repository = {
  findKnowledgeItem: vi.fn(),
  findKnowledgeFile: vi.fn(),
  findKnowledgeFileParse: vi.fn(),
  saveKnowledgeFileParseResult: vi.fn(),
  replaceKnowledgeFileParseChunks: vi.fn(),
  listKnowledgeFileParseChunks: vi.fn(),
};

const storage: PlatformKnowledgeFileStorage = {
  save: vi.fn(),
  read: vi.fn(),
  delete: vi.fn(),
};

const unsafeError = new Error(
  'DATABASE_URL postgres://root:password@localhost token=secret /Users/demo/path SQL stack storageKey',
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
  'textContent',
  'fullText',
  'rawContent',
  'embedding',
  'trainingContent',
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

function platformParseUrl(search = '') {
  return `http://localhost/api/v1/open-platform/knowledge-management/items/knowledge-route-a/files/file-route-a/parse${search}`;
}

function platformChunksUrl(search = '') {
  return `http://localhost/api/v1/open-platform/knowledge-management/items/knowledge-route-a/files/file-route-a/parse/chunks${search}`;
}

function institutionParseUrl(search = '') {
  return `http://localhost/api/institution/knowledge-management/items/knowledge-route-a/files/file-route-a/parse${search}`;
}

function institutionChunksUrl(search = '') {
  return `http://localhost/api/institution/knowledge-management/items/knowledge-route-a/files/file-route-a/parse/chunks${search}`;
}

function expectSafePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  unsafeFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

describe('知识库文档解析 API route', () => {
  beforeEach(() => {
    repository.findKnowledgeItem.mockReset();
    repository.findKnowledgeFile.mockReset();
    repository.findKnowledgeFileParse.mockReset();
    repository.saveKnowledgeFileParseResult.mockReset();
    repository.replaceKnowledgeFileParseChunks.mockReset();
    repository.listKnowledgeFileParseChunks.mockReset();
    storage.read = vi.fn(async () => textContent);
    storage.save = vi.fn();
    storage.delete = vi.fn();
    repository.findKnowledgeItem.mockResolvedValue(knowledgeRecord);
    repository.findKnowledgeFile.mockResolvedValue(fileRecord);
    repository.findKnowledgeFileParse.mockResolvedValue(parseRecord);
    repository.saveKnowledgeFileParseResult.mockImplementation(async (record) => record);
    repository.replaceKnowledgeFileParseChunks.mockImplementation(async ({ chunks }) => chunks);
    repository.listKnowledgeFileParseChunks.mockResolvedValue([chunkRecord]);
    vi.mocked(getDatabase).mockClear();
    vi.mocked(createPlatformKnowledgeManagementRepository).mockClear();
    vi.mocked(createLocalPlatformKnowledgeFileStorage).mockClear();
    vi.mocked(getDemoAccessContextFromRequest).mockReset();
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(platformAccessContext);
  });

  it('平台端 POST 发起解析、GET 查看状态和 GET 查看 chunk 列表', async () => {
    const parseResponse = await platformParseRoute.POST(
      new Request(platformParseUrl('?tenantId=tenant-route-a'), { method: 'POST' }),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    const parsePayload = await readJson(parseResponse);

    expect(parseResponse.status).toBe(200);
    expect(parsePayload).toEqual(
      expect.objectContaining({
        status: 'succeeded',
        parse: expect.objectContaining({
          parseStatus: 'succeeded',
          chunkCount: expect.any(Number),
        }),
      }),
    );
    expect(storage.read).toHaveBeenCalledWith({ storageKey: fileRecord.storageKey });
    expectSafePayload(parsePayload);

    const statusResponse = await platformParseRoute.GET(
      new Request(platformParseUrl('?tenantId=tenant-route-a')),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    const statusPayload = await readJson(statusResponse);
    expect(statusResponse.status).toBe(200);
    expect(statusPayload.parse).toEqual(
      expect.objectContaining({
        parseStatus: 'succeeded',
        textLength: 7,
        chunkCount: 1,
      }),
    );
    expectSafePayload(statusPayload);

    const chunksResponse = await platformChunksRoute.GET(
      new Request(platformChunksUrl('?tenantId=tenant-route-a')),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    const chunksPayload = await readJson(chunksResponse);
    expect(chunksResponse.status).toBe(200);
    expect(chunksPayload.records).toEqual([
      expect.objectContaining({
        chunkIndex: 0,
        textPreview: '术后护理文本。',
        charCount: 7,
      }),
    ]);
    expectSafePayload(chunksPayload);
  });

  it.each([
    {
      label: '未登录',
      context: null,
      expectedStatus: 401,
      expectedPayload: { code: 'unauthorized', error: '请先登录' },
    },
    {
      label: '非 platform scope',
      context: tenantAccessContext,
      expectedStatus: 403,
      expectedPayload: { code: 'forbidden', error: '没有访问权限' },
    },
  ])('平台端 $label 不能发起解析且不初始化 repository/storage', async ({
    context,
    expectedStatus,
    expectedPayload,
  }) => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValueOnce(context);

    const response = await platformParseRoute.POST(
      new Request(platformParseUrl('?tenantId=tenant-route-a'), { method: 'POST' }),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );

    expect(response.status).toBe(expectedStatus);
    expect(await readJson(response)).toEqual(expectedPayload);
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(createLocalPlatformKnowledgeFileStorage).not.toHaveBeenCalled();
    expect(storage.read).not.toHaveBeenCalled();
    expect(repository.saveKnowledgeFileParseResult).not.toHaveBeenCalled();
  });

  it('平台端归档文件不能解析，底层异常返回固定中文安全文案', async () => {
    repository.findKnowledgeFile.mockResolvedValueOnce({ ...fileRecord, status: 'archived' });

    const archived = await platformParseRoute.POST(
      new Request(platformParseUrl('?tenantId=tenant-route-a'), { method: 'POST' }),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    expect(archived.status).toBe(400);
    expect(await readJson(archived)).toEqual({
      status: 'validation_failed',
      message: '归档文件不能解析',
    });

    repository.findKnowledgeFile.mockRejectedValueOnce(unsafeError);
    const failed = await platformParseRoute.GET(
      new Request(platformParseUrl('?tenantId=tenant-route-a')),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    const payload = await readJson(failed);
    expect(failed.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: 'readonly_contract_error',
        message: '知识库文件解析暂时无法处理',
      },
    });
    expectSafePayload(payload);
  });

  it('平台端解析过程失败时返回安全 failed 状态并持久化失败记录', async () => {
    storage.read = vi.fn(async () => {
      throw unsafeError;
    });

    const response = await platformParseRoute.POST(
      new Request(platformParseUrl('?tenantId=tenant-route-a'), { method: 'POST' }),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        status: 'failed',
        parse: expect.objectContaining({
          parseStatus: 'failed',
          failureReasonCode: 'parse_failed',
          safeFailureMessage: '知识库文件解析失败，请稍后重试',
          textLength: 0,
          chunkCount: 0,
        }),
      }),
    );
    expect(repository.saveKnowledgeFileParseResult).toHaveBeenCalledWith(
      expect.objectContaining({
        parseStatus: 'failed',
        failureReasonCode: 'parse_failed',
        safeFailureMessage: '知识库文件解析失败，请稍后重试',
        textContent: '',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expect(repository.replaceKnowledgeFileParseChunks).toHaveBeenCalledWith(
      expect.objectContaining({ chunks: [] }),
    );
    expectSafePayload(payload);
  });

  it('机构端只读查看解析状态和 chunk，且 tenant/institution 来自 access context', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantAccessContext);

    expect(Object.keys(institutionParseRoute).sort()).toEqual(['GET']);
    expect(Object.keys(institutionChunksRoute).sort()).toEqual(['GET']);

    const statusResponse = await institutionParseRoute.GET(
      new Request(institutionParseUrl('?tenantId=tenant-b&institutionId=inst-b')),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    expect(statusResponse.status).toBe(200);
    expect(await readJson(statusResponse)).toEqual(
      expect.objectContaining({
        status: 'succeeded',
        parse: expect.objectContaining({ parseStatus: 'succeeded' }),
      }),
    );
    expect(repository.findKnowledgeItem).toHaveBeenCalledWith({
      tenantId: 'tenant-route-a',
      knowledgeId: 'knowledge-route-a',
    });

    const chunksResponse = await institutionChunksRoute.GET(
      new Request(institutionChunksUrl('?tenantId=tenant-b&institutionId=inst-b')),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    expect(chunksResponse.status).toBe(200);
    expect(await readJson(chunksResponse)).toEqual(
      expect.objectContaining({
        readonly: true,
        records: [expect.objectContaining({ textPreview: '术后护理文本。' })],
      }),
    );
  });

  it('机构端未授权文件返回 403 且不泄露底层异常', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantAccessContext);
    repository.findKnowledgeItem.mockResolvedValueOnce({
      ...knowledgeRecord,
      visibleInstitutionIds: [],
      institutionId: 'inst-other',
    });

    const forbidden = await institutionParseRoute.GET(
      new Request(institutionParseUrl()),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    expect(forbidden.status).toBe(403);
    expect(await readJson(forbidden)).toEqual({ code: 'forbidden', error: '没有访问权限' });

    repository.findKnowledgeItem.mockRejectedValueOnce(unsafeError);
    const failed = await institutionChunksRoute.GET(
      new Request(institutionChunksUrl()),
      { params: { knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' } },
    );
    const payload = await readJson(failed);
    expect(failed.status).toBe(503);
    expect(payload).toEqual({
      code: 'service_unavailable',
      error: '知识库文件解析暂时不可用',
    });
    expectSafePayload(payload);
  });
});
