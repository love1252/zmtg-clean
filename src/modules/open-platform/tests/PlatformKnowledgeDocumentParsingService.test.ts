import { describe, expect, it, vi } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import {
  parsePlatformKnowledgeDocumentFileService,
  getPlatformKnowledgeDocumentFileParseStatusService,
  listPlatformKnowledgeDocumentFileChunksService,
  PLATFORM_KNOWLEDGE_PARSE_CHUNK_MAX_CHARS,
  type PlatformKnowledgeFileParseChunkRecord,
  type PlatformKnowledgeFileParseRecord,
} from '@/modules/open-platform/server/platform-knowledge-document-parsing-service';
import type {
  PlatformKnowledgeFileRepositoryRecord,
  PlatformKnowledgeFileStorage,
} from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import {
  listInstitutionKnowledgeDocumentFileChunksService,
  getInstitutionKnowledgeDocumentFileParseStatusService,
} from '@/modules/institution/server/institution-knowledge-file-parsing-service';

const now = new Date('2026-06-13T08:00:00.000Z');

const unsafeFragments = [
  'storageKey',
  'textContent',
  'fullText',
  'rawContent',
  'tenant-a/knowledge-a/file-a.bin',
  '/Users/',
  'SQL',
  'stack',
  'token',
  'secret',
  'embedding',
  'trainingContent',
  'answer',
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
    chunkCount: 0,
    visibleInstitutionIds: ['inst-visible-a'],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-b',
    tenantId: 'tenant-b',
    tenantName: '租户 B',
    institutionId: 'inst-owner-b',
    workspaceId: 'workspace-b',
    title: '跨租户知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '跨租户',
    descriptionPreview: 'tenant A 不可见。',
    chunkCount: 0,
    visibleInstitutionIds: ['inst-visible-b'],
    createdAt: now,
    updatedAt: now,
  },
];

function fileRecord(input: Partial<PlatformKnowledgeFileRepositoryRecord> = {}): PlatformKnowledgeFileRepositoryRecord {
  return {
    fileId: 'file-a',
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-a',
    originalFilename: '护理说明.txt',
    storageKey: 'tenant-a/knowledge-a/file-a.bin',
    mimeType: 'text/plain',
    sizeBytes: 10,
    sha256: 'a'.repeat(64),
    status: 'active',
    uploadedByUserId: 'platform-user',
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    ...input,
  };
}

function expectSafePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  unsafeFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function createFixture(input: {
  files?: PlatformKnowledgeFileRepositoryRecord[];
  storage?: Record<string, string>;
} = {}) {
  const files = input.files ?? [
    fileRecord(),
    fileRecord({
      fileId: 'file-md',
      originalFilename: '术后护理.md',
      storageKey: 'tenant-a/knowledge-a/file-md.bin',
      mimeType: 'text/markdown',
    }),
    fileRecord({
      fileId: 'file-csv',
      originalFilename: '回访.csv',
      storageKey: 'tenant-a/knowledge-a/file-csv.bin',
      mimeType: 'text/csv',
    }),
    fileRecord({
      fileId: 'file-pdf',
      originalFilename: '说明.pdf',
      storageKey: 'tenant-a/knowledge-a/file-pdf.bin',
      mimeType: 'application/pdf',
    }),
    fileRecord({
      fileId: 'file-archived',
      originalFilename: '归档.txt',
      storageKey: 'tenant-a/knowledge-a/file-archived.bin',
      status: 'archived',
      archivedAt: new Date('2026-06-13T09:00:00.000Z'),
    }),
    fileRecord({
      fileId: 'file-b',
      tenantId: 'tenant-b',
      knowledgeId: 'knowledge-b',
      originalFilename: '跨租户.txt',
      storageKey: 'tenant-b/knowledge-b/file-b.bin',
    }),
  ];
  const parseRecords = new Map<string, PlatformKnowledgeFileParseRecord>();
  const chunks = new Map<string, PlatformKnowledgeFileParseChunkRecord[]>();
  const storageText = new Map(Object.entries({
    'tenant-a/knowledge-a/file-a.bin': '第一段护理说明。'.repeat(20),
    'tenant-a/knowledge-a/file-md.bin': '# 标题\n\n术后护理 Markdown 内容',
    'tenant-a/knowledge-a/file-csv.bin': 'name,value\n注意事项,避免暴晒',
    'tenant-a/knowledge-a/file-pdf.bin': '%PDF bytes',
    'tenant-a/knowledge-a/file-archived.bin': '归档内容',
    'tenant-b/knowledge-b/file-b.bin': '跨租户内容',
    ...input.storage,
  }));

  const repository = {
    findKnowledgeItem: vi.fn(async (query: { tenantId: string; knowledgeId: string }) =>
      knowledgeRecords.find(
        (record) => record.tenantId === query.tenantId && record.knowledgeId === query.knowledgeId,
      ) ?? null,
    ),
    findKnowledgeFile: vi.fn(async (query: {
      tenantId: string;
      knowledgeId: string;
      fileId: string;
    }) =>
      files.find(
        (file) =>
          file.tenantId === query.tenantId &&
          file.knowledgeId === query.knowledgeId &&
          file.fileId === query.fileId,
      ) ?? null,
    ),
    findKnowledgeFileParse: vi.fn(async (query: { tenantId: string; fileId: string }) =>
      parseRecords.get(`${query.tenantId}:${query.fileId}`) ?? null,
    ),
    saveKnowledgeFileParseResult: vi.fn(async (record: PlatformKnowledgeFileParseRecord) => {
      parseRecords.set(`${record.tenantId}:${record.fileId}`, record);
      return record;
    }),
    replaceKnowledgeFileParseChunks: vi.fn(async (input: {
      tenantId: string;
      fileId: string;
      chunks: PlatformKnowledgeFileParseChunkRecord[];
    }) => {
      chunks.set(`${input.tenantId}:${input.fileId}`, input.chunks);
      return input.chunks;
    }),
    listKnowledgeFileParseChunks: vi.fn(async (query: { tenantId: string; fileId: string }) =>
      chunks.get(`${query.tenantId}:${query.fileId}`) ?? [],
    ),
  };

  const storage: PlatformKnowledgeFileStorage = {
    save: vi.fn(),
    read: vi.fn(async ({ storageKey }) => new TextEncoder().encode(storageText.get(storageKey) ?? '')),
    delete: vi.fn(),
  };

  return { files, repository, storage, chunks, parseRecords };
}

describe('知识库文档解析与文本抽取 service', () => {
  it.each([
    ['file-a', 'txt'],
    ['file-md', 'md'],
    ['file-csv', 'csv'],
  ])('平台端可以同步解析 %s / .%s 文件并稳定切分 chunk', async (fileId) => {
    const { repository, storage } = createFixture();

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId },
    });

    expect(result.status).toBe('succeeded');
    const parse = 'parse' in result ? result.parse : null;
    if (!parse) throw new Error('expected parse result');
    expect(parse).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        fileId,
        parseStatus: 'succeeded',
      }),
    );
    expect(parse.chunkCount).toBeGreaterThan(0);
    expect(parse.textLength).toBeGreaterThan(0);
    expect(repository.replaceKnowledgeFileParseChunks).toHaveBeenCalledWith(
      expect.objectContaining({
        chunks: expect.arrayContaining([
          expect.objectContaining({
            chunkIndex: 0,
            textPreview: expect.any(String),
            charCount: expect.any(Number),
          }),
        ]),
      }),
    );
    const savedChunks = await repository.listKnowledgeFileParseChunks({ tenantId: 'tenant-a', fileId });
    expect(savedChunks.map((chunk) => chunk.chunkIndex)).toEqual(
      savedChunks.map((_, index) => index),
    );
    expect(savedChunks.every((chunk) => chunk.textPreview.length <= PLATFORM_KNOWLEDGE_PARSE_CHUNK_MAX_CHARS)).toBe(true);
    expect(storage.read).toHaveBeenCalled();
    expectSafePayload(result);
  });

  it.each([
    ['file-pdf', 'pdf'],
    [fileRecord({ fileId: 'file-docx', originalFilename: '说明.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'docx'],
    [fileRecord({ fileId: 'file-xlsx', originalFilename: '说明.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'xlsx'],
  ])('不支持的 %s / .%s 文件返回安全失败状态', async (fileOrId, _extension) => {
    const files = typeof fileOrId === 'string' ? undefined : [fileOrId];
    const fileId = typeof fileOrId === 'string' ? fileOrId : fileOrId.fileId;
    const { repository, storage } = createFixture({ files });

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId },
    });

    expect(result.status).toBe('failed');
    if (!('parse' in result)) throw new Error('expected failed parse result');
    expect(result.parse).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        failureReasonCode: 'unsupported_file_type',
        safeFailureMessage: '当前文件类型暂未接入解析器',
        chunkCount: 0,
      }),
    );
    expect(storage.read).not.toHaveBeenCalled();
    expectSafePayload(result);
  });

  it('空文本解析成功但不生成 chunk', async () => {
    const { repository, storage } = createFixture({
      storage: { 'tenant-a/knowledge-a/file-a.bin': ' \n\t ' },
    });

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-a' },
    });

    expect(result.status).toBe('succeeded');
    expect(result.parse).toEqual(expect.objectContaining({ textLength: 0, chunkCount: 0 }));
    expect(repository.replaceKnowledgeFileParseChunks).toHaveBeenCalledWith(
      expect.objectContaining({ chunks: [] }),
    );
    expectSafePayload(result);
  });

  it('平台端只能解析当前 tenant 的 active 文件，archived 文件不能解析', async () => {
    const { repository, storage } = createFixture();

    const tenantMismatch = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-b', fileId: 'file-b' },
    });
    const archived = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-archived' },
    });

    expect(tenantMismatch).toEqual({ status: 'not_found' });
    expect(archived).toEqual({ status: 'validation_failed', message: '归档文件不能解析' });
    expect(storage.read).not.toHaveBeenCalled();
  });

  it('平台端和机构端只返回状态与 chunk 低敏摘要，不返回解析全文', async () => {
    const { repository, storage } = createFixture();
    await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-a' },
    });

    const status = await getPlatformKnowledgeDocumentFileParseStatusService({
      repository,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-a' },
    });
    const chunks = await listPlatformKnowledgeDocumentFileChunksService({
      repository,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-a' },
    });
    const institutionStatus = await getInstitutionKnowledgeDocumentFileParseStatusService({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-visible-a',
        knowledgeId: 'knowledge-a',
        fileId: 'file-a',
      },
    });
    const institutionChunks = await listInstitutionKnowledgeDocumentFileChunksService({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-visible-a',
        knowledgeId: 'knowledge-a',
        fileId: 'file-a',
      },
    });

    expect(status.status).toBe('succeeded');
    if ('status' in chunks) throw new Error('expected platform chunks');
    expect(chunks.records.length).toBeGreaterThan(0);
    expect(institutionStatus.status).toBe('succeeded');
    if ('status' in institutionChunks) throw new Error('expected institution chunks');
    expect(institutionChunks.records.length).toBeGreaterThan(0);
    expectSafePayload(status);
    expectSafePayload(chunks);
    expectSafePayload(institutionStatus);
    expectSafePayload(institutionChunks);
  });

  it('机构 B 看不到机构 A 授权文件解析状态和 chunk', async () => {
    const { repository, storage } = createFixture();
    await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-a' },
    });

    const status = await getInstitutionKnowledgeDocumentFileParseStatusService({
      repository,
      input: {
        tenantId: 'tenant-a',
        institutionId: 'inst-b',
        knowledgeId: 'knowledge-a',
        fileId: 'file-a',
      },
    });

    expect(status).toEqual({ status: 'forbidden' });
  });
});
