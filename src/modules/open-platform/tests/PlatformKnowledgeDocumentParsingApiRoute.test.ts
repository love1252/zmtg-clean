import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const institutionParseDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_file_parse_capability_disabled',
  error: '机构知识库文件解析暂未启用。',
});

const institutionChunksDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'capability_disabled',
  error: '机构知识库解析片段暂未启用。',
});

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
  const value = new Proxy({}, {
    get: () => trap('get'),
    set: () => trap('set'),
    has: () => trap('has'),
    ownKeys: () => trap('ownKeys'),
    getOwnPropertyDescriptor: () => trap('getOwnPropertyDescriptor'),
    getPrototypeOf: () => trap('getPrototypeOf'),
  }) as T;

  return { value, counts };
}

async function expectInstitutionParseDisabled(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(institutionParseDisabledPayload);
}

async function expectInstitutionChunksDisabled(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(institutionChunksDisabledPayload);
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
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
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
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
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
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
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
  ])('平台端 $label 时 parse/status/chunks 均拒绝且不初始化 repository/storage', async ({
    context,
    expectedStatus,
    expectedPayload,
  }) => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(context);

    const responses = [
      await platformParseRoute.POST(
        new Request(platformParseUrl('?tenantId=tenant-route-a'), { method: 'POST' }),
        { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
      ),
      await platformParseRoute.GET(
        new Request(platformParseUrl('?tenantId=tenant-route-a')),
        { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
      ),
      await platformChunksRoute.GET(
        new Request(platformChunksUrl('?tenantId=tenant-route-a')),
        { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
      ),
    ];

    for (const response of responses) {
      expect(response.status).toBe(expectedStatus);
      expect(await readJson(response)).toEqual(expectedPayload);
    }
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
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
    );
    expect(archived.status).toBe(400);
    expect(await readJson(archived)).toEqual({
      status: 'validation_failed',
      message: '归档文件不能解析',
    });

    repository.findKnowledgeFile.mockRejectedValueOnce(unsafeError);
    const failed = await platformParseRoute.GET(
      new Request(platformParseUrl('?tenantId=tenant-route-a')),
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
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
      { params: Promise.resolve({ knowledgeId: 'knowledge-route-a', fileId: 'file-route-a' }) },
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        status: 'failed',
        parse: expect.objectContaining({
          parseStatus: 'failed',
          failureReasonCode: 'parse_service_failed',
          safeFailureMessage: '知识库文件解析失败，请稍后重试',
          textLength: 0,
          chunkCount: 0,
        }),
      }),
    );
    expect(repository.saveKnowledgeFileParseResult).toHaveBeenCalledWith(
      expect.objectContaining({
        parseStatus: 'failed',
        failureReasonCode: 'parse_service_failed',
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

  it('机构端 parse GET/POST 对普通、非法和伪造输入固定返回无缓存 503 且零下游调用', async () => {
    vi.mocked(getDemoAccessContextFromRequest).mockReturnValue(tenantAccessContext);
    expect(Object.keys(institutionParseRoute).sort()).toEqual(['GET', 'POST']);

    const sensitiveMarker = 'private-patient-provider-token';
    const requests = [
      {
        handler: institutionParseRoute.GET,
        request: undefined,
        context: undefined,
      },
      {
        handler: institutionParseRoute.GET,
        request: new Request(institutionParseUrl(`?tenantId=${sensitiveMarker}&institutionId=${sensitiveMarker}`), {
          headers: { authorization: `Bearer ${sensitiveMarker}` },
        }),
        context: { params: sensitiveMarker },
      },
      {
        handler: institutionParseRoute.POST,
        request: new Request(institutionParseUrl(), {
          method: 'POST',
          body: JSON.stringify({ textContent: sensitiveMarker, provider: sensitiveMarker }),
        }),
        context: { params: Promise.resolve({ knowledgeId: sensitiveMarker, fileId: sensitiveMarker }) },
      },
    ] as const;

    for (const { handler, request, context } of requests) {
      const response = await (
        handler as unknown as (
          request?: Request,
          context?: unknown,
        ) => Response | Promise<Response>
      )(request, context);
      const replay = response.clone();
      await expectInstitutionParseDisabled(response);
      expect(JSON.stringify(await replay.json())).not.toContain(sensitiveMarker);
    }

    expect(getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(createLocalPlatformKnowledgeFileStorage).not.toHaveBeenCalled();
    expect(repository.findKnowledgeItem).not.toHaveBeenCalled();
    expect(repository.findKnowledgeFileParse).not.toHaveBeenCalled();
    expect(repository.saveKnowledgeFileParseResult).not.toHaveBeenCalled();
    expect(storage.read).not.toHaveBeenCalled();
  });

  it('机构端 parse GET/POST 不触碰 hostile Request 或 params 的任一 trap', async () => {
    for (const handler of [institutionParseRoute.GET, institutionParseRoute.POST]) {
      const request = hostileProxy<Request>();
      const context = hostileProxy<object>();
      const response = await (
        handler as unknown as (
          request?: Request,
          context?: unknown,
        ) => Response | Promise<Response>
      )(request.value, context.value);

      await expectInstitutionParseDisabled(response);
      expect(request.counts).toEqual({
        get: 0,
        set: 0,
        has: 0,
        ownKeys: 0,
        getOwnPropertyDescriptor: 0,
        getPrototypeOf: 0,
      });
      expect(context.counts).toEqual({
        get: 0,
        set: 0,
        has: 0,
        ownKeys: 0,
        getOwnPropertyDescriptor: 0,
        getPrototypeOf: 0,
      });
    }

    expect(getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(createLocalPlatformKnowledgeFileStorage).not.toHaveBeenCalled();
  });

  it('机构端 chunks 对普通、非法和伪造输入固定返回无缓存 503 且零下游调用', async () => {
    expect(Object.keys(institutionChunksRoute).sort()).toEqual(['GET']);
    const invokeChunks = institutionChunksRoute.GET as unknown as (
      request?: unknown,
      context?: unknown,
    ) => Response;
    const sensitiveMarkers = [
      'private-textPreview-content',
      'private-fileName.pdf',
      'private-institution-id',
      'embeddingStatus-ready',
    ];

    const responses = [
      institutionChunksRoute.GET(),
      invokeChunks(
        new Request(
          institutionChunksUrl(
            `?tenantId=${sensitiveMarkers[2]}&institutionId=${sensitiveMarkers[2]}&textPreview=${sensitiveMarkers[0]}&embeddingStatus=${sensitiveMarkers[3]}`,
          ),
          { headers: { authorization: `Bearer ${sensitiveMarkers[1]}` } },
        ),
        { params: Promise.resolve({ knowledgeId: sensitiveMarkers[0], fileId: sensitiveMarkers[1] }) },
      ),
      invokeChunks(null, { params: sensitiveMarkers }),
    ];

    for (const response of responses) {
      const replay = response.clone();
      await expectInstitutionChunksDisabled(response);
      const serialized = JSON.stringify(await replay.json());
      sensitiveMarkers.forEach((marker) => expect(serialized).not.toContain(marker));
      expectSafePayload(JSON.parse(serialized));
    }

    expect(getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(createLocalPlatformKnowledgeFileStorage).not.toHaveBeenCalled();
    expect(repository.findKnowledgeItem).not.toHaveBeenCalled();
    expect(repository.findKnowledgeFile).not.toHaveBeenCalled();
    expect(repository.listKnowledgeFileParseChunks).not.toHaveBeenCalled();
    expect(storage.read).not.toHaveBeenCalled();
  });

  it('机构端 chunks 不触碰 hostile Request 或 context 的任一 trap', async () => {
    const request = hostileProxy<Request>();
    const context = hostileProxy<object>();
    const invokeChunks = institutionChunksRoute.GET as unknown as (
      request?: unknown,
      context?: unknown,
    ) => Response;

    const response = invokeChunks(request.value, context.value);

    await expectInstitutionChunksDisabled(response);
    expect(request.counts).toEqual({
      get: 0,
      set: 0,
      has: 0,
      ownKeys: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
    });
    expect(context.counts).toEqual({
      get: 0,
      set: 0,
      has: 0,
      ownKeys: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
    });
    expect(getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(repository.listKnowledgeFileParseChunks).not.toHaveBeenCalled();
  });

  it('机构端 parse/chunks route 源码仅依赖 NextResponse，禁止旧数据链和输入读取', () => {
    for (const routePath of [
      'src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/route.ts',
      'src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks/route.ts',
    ]) {
      const source = readFileSync(resolve(process.cwd(), routePath), 'utf8');
      const imports = source.match(/^import .+;$/gmu) ?? [];

      expect(imports).toEqual(["import { NextResponse } from 'next/server';"]);
      expect(source).not.toMatch(
        /getDemoAccessContextFromRequest|getDatabase|repository|storage|provider|embeddingStatus|textPreview|listInstitutionKnowledgeDocumentFileChunksService|reparseInstitutionKnowledgeDocumentFileService|getInstitutionKnowledgeDocumentFileParseStatusService|\b_?request\s*(?:\.|\[)|\b_?context\s*(?:\.|\[)|fetch\(/u,
      );
    }
  });

  it('机构端 chunks route 动态加载时不初始化旧依赖或 fetch', async () => {
    vi.resetModules();
    const initialized: string[] = [];
    const forbiddenModules = [
      ['@/modules/security/server/access-context', 'auth'],
      ['@/server/db/client', 'db'],
      ['@/modules/open-platform/server/platform-knowledge-management-repository', 'repository'],
      ['@/modules/institution/server/institution-knowledge-file-parsing-service', 'service'],
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

    const route = await import(
      '@/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/parse/chunks/route'
    );
    const response = route.GET();

    expect(initialized).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    await expectInstitutionChunksDisabled(response);
    fetchSpy.mockRestore();
  });
});
