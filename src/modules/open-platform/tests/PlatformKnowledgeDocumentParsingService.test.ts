import { describe, expect, it, vi } from 'vitest';
import { deflateRawSync, deflateSync } from 'node:zlib';
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
import { PLATFORM_KNOWLEDGE_FILE_MAX_BYTES } from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import {
  listInstitutionKnowledgeDocumentFileChunksService,
  getInstitutionKnowledgeDocumentFileParseStatusService,
} from '@/modules/institution/server/institution-knowledge-file-parsing-service';
import { v1KnowledgeBaseUploadParseChunkRuntimeMaxChars } from '@/modules/knowledge-base/server/v1-knowledge-base-upload-parse-chunk-runtime';

const now = new Date('2026-06-13T08:00:00.000Z');
const encoder = new TextEncoder();
const zipEntryDeclaredOverLimitBytes = 6 * 1024 * 1024;
const zipTotalInflatedOverLimitBytes = 13 * 1024 * 1024;
const pdfFlateInflatedOverLimitBytes = 9 * 1024 * 1024;

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
  'word/document.xml',
  'xl/sharedStrings.xml',
  'xl/worksheets/sheet1.xml',
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

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.byteLength;
  });

  return output;
}

function createZip(
  entries: Record<string, string>,
  options: {
    declaredUncompressedSizes?: Record<string, number>;
  } = {},
) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  Object.entries(entries).forEach(([name, text]) => {
    const filename = encoder.encode(name);
    const raw = encoder.encode(text);
    const compressed = new Uint8Array(deflateRawSync(raw));
    const checksum = crc32(raw);
    const declaredUncompressedSize = options.declaredUncompressedSizes?.[name] ?? raw.byteLength;
    const localHeader = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(8),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(compressed.byteLength),
      uint32(declaredUncompressedSize),
      uint16(filename.byteLength),
      uint16(0),
      filename,
    ]);
    const centralHeader = concatBytes([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(8),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(compressed.byteLength),
      uint32(declaredUncompressedSize),
      uint16(filename.byteLength),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      filename,
    ]);

    localParts.push(localHeader, compressed);
    centralParts.push(centralHeader);
    offset += localHeader.byteLength + compressed.byteLength;
  });

  const centralDirectory = concatBytes(centralParts);
  const endRecord = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(Object.keys(entries).length),
    uint16(Object.keys(entries).length),
    uint32(centralDirectory.byteLength),
    uint32(offset),
    uint16(0),
  ]);

  return concatBytes([...localParts, centralDirectory, endRecord]);
}

function createDocxBytes(
  text: string,
  options: {
    extraEntries?: Record<string, string>;
    declaredUncompressedSizes?: Record<string, number>;
  } = {},
) {
  return createZip(
    {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
      'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
      ...options.extraEntries,
    },
    { declaredUncompressedSizes: options.declaredUncompressedSizes },
  );
}

function createXlsxBytes(
  rows: string[][],
  options: {
    declaredUncompressedSizes?: Record<string, number>;
  } = {},
) {
  const sharedStrings = rows.flat();
  const sharedStringXml = sharedStrings
    .map((value) => `<si><t>${value}</t></si>`)
    .join('');
  const sheetXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((_, columnIndex) => {
          const cellRef = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`;
          const stringIndex = rowIndex * row.length + columnIndex;
          return `<c r="${cellRef}" t="s"><v>${stringIndex}</v></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  return createZip(
    {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
      'xl/sharedStrings.xml': `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sharedStringXml}</sst>`,
      'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetXml}</sheetData></worksheet>`,
    },
    { declaredUncompressedSizes: options.declaredUncompressedSizes },
  );
}

function createTextPdfBytes(text: string) {
  return encoder.encode(`%PDF-1.4
1 0 obj
<< /Type /Page /Contents 2 0 R >>
endobj
2 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 72 720 Td (${text}) Tj ET
endstream
endobj
%%EOF`);
}

function createFlatePdfBytes(text: string) {
  const compressed = new Uint8Array(deflateSync(encoder.encode(`BT (${text}) Tj ET`)));
  return concatBytes([
    encoder.encode(`%PDF-1.4
1 0 obj
<< /Type /Page /Contents 2 0 R >>
endobj
2 0 obj
<< /Length ${compressed.byteLength} /Filter /FlateDecode >>
stream
`),
    compressed,
    encoder.encode(`
endstream
endobj
%%EOF`),
  ]);
}

function expectSafePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);

  unsafeFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function createFixture(input: {
  files?: PlatformKnowledgeFileRepositoryRecord[];
  storage?: Record<string, string | Uint8Array>;
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
      fileId: 'file-docx',
      originalFilename: '说明.docx',
      storageKey: 'tenant-a/knowledge-a/file-docx.bin',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    fileRecord({
      fileId: 'file-xlsx',
      originalFilename: '回访.xlsx',
      storageKey: 'tenant-a/knowledge-a/file-xlsx.bin',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
  const storageBytes = new Map<string, string | Uint8Array>(Object.entries({
    'tenant-a/knowledge-a/file-a.bin': '第一段护理说明。'.repeat(20),
    'tenant-a/knowledge-a/file-md.bin': '# 标题\n\n术后护理 Markdown 内容',
    'tenant-a/knowledge-a/file-csv.bin': 'name,value\n注意事项,避免暴晒',
    'tenant-a/knowledge-a/file-pdf.bin': createTextPdfBytes('PDF real text care guide'),
    'tenant-a/knowledge-a/file-docx.bin': createDocxBytes('DOCX 术后护理文本'),
    'tenant-a/knowledge-a/file-xlsx.bin': createXlsxBytes([
      ['项目', '注意事项'],
      ['水光针', '避免暴晒'],
    ]),
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
    read: vi.fn(async ({ storageKey }) => {
      const value = storageBytes.get(storageKey) ?? '';
      return typeof value === 'string' ? encoder.encode(value) : value;
    }),
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
    ['file-pdf', 'PDF real text care guide'],
    ['file-docx', 'DOCX 术后护理文本'],
    ['file-xlsx', '水光针'],
  ])('平台端可以解析真实上传文本类文件 %s', async (fileId, expectedPreview) => {
    const { repository, storage } = createFixture();

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId },
    });

    expect(result.status).toBe('succeeded');
    if (!('parse' in result)) throw new Error('expected parse result');
    expect(result.parse).toEqual(
      expect.objectContaining({
        parseStatus: 'succeeded',
        failureReasonCode: null,
        safeFailureMessage: null,
        textLength: expect.any(Number),
        chunkCount: expect.any(Number),
      }),
    );
    const savedChunks = await repository.listKnowledgeFileParseChunks({ tenantId: 'tenant-a', fileId });
    expect(savedChunks.map((chunk) => chunk.textPreview).join('\n')).toContain(expectedPreview);
    expect(storage.read).toHaveBeenCalled();
    expectSafePayload(result);
  });

  it('不支持的文件类型被白名单拦截且不读取 storage', async () => {
    const unsupported = fileRecord({
      fileId: 'file-png',
      originalFilename: '照片.png',
      mimeType: 'image/png',
      storageKey: 'tenant-a/knowledge-a/file-png.bin',
    });
    const { repository, storage } = createFixture({ files: [unsupported] });

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-png' },
    });

    expect(result.status).toBe('failed');
    if (!('parse' in result)) throw new Error('expected failed parse result');
    expect(result.parse).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        failureReasonCode: 'unsupported_file_type',
        safeFailureMessage: '当前文件类型暂不支持解析',
        chunkCount: 0,
      }),
    );
    expect(storage.read).not.toHaveBeenCalled();
    expectSafePayload(result);
  });

  it('扫描 PDF 或无法抽取文本的 PDF 安全失败且不做 OCR', async () => {
    const { repository, storage } = createFixture({
      storage: {
        'tenant-a/knowledge-a/file-pdf.bin': encoder.encode('%PDF-1.4\n/image-only scan bytes\n%%EOF'),
      },
    });

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-pdf' },
    });

    expect(result.status).toBe('failed');
    if (!('parse' in result)) throw new Error('expected failed parse result');
    expect(result.parse).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        failureReasonCode: 'empty_content',
        safeFailureMessage: '文件未提取到可解析文本，扫描件或图片内容暂不支持',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expect(repository.replaceKnowledgeFileParseChunks).toHaveBeenCalledWith(
      expect.objectContaining({ chunks: [] }),
    );
    expectSafePayload(result);
  });

  it('空文本文件安全失败且不生成 chunk', async () => {
    const { repository, storage } = createFixture({
      storage: { 'tenant-a/knowledge-a/file-a.bin': ' \n\t ' },
    });

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-a' },
    });

    expect(result.status).toBe('failed');
    expect(result.parse).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        failureReasonCode: 'empty_content',
        safeFailureMessage: '文件未提取到可解析文本，扫描件或图片内容暂不支持',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expect(repository.replaceKnowledgeFileParseChunks).toHaveBeenCalledWith(
      expect.objectContaining({ chunks: [] }),
    );
    expectSafePayload(result);
  });

  it('解析时文件大小超限会安全失败且不读取正文', async () => {
    const oversized = fileRecord({
      fileId: 'file-oversized',
      originalFilename: '超大说明.txt',
      storageKey: 'tenant-a/knowledge-a/file-oversized.bin',
      sizeBytes: PLATFORM_KNOWLEDGE_FILE_MAX_BYTES + 1,
    });
    const { repository, storage } = createFixture({ files: [oversized] });

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-oversized' },
    });

    expect(result.status).toBe('failed');
    if (!('parse' in result)) throw new Error('expected failed parse result');
    expect(result.parse).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        failureReasonCode: 'file_too_large',
        safeFailureMessage: '文件大小超过解析限制，请拆分后重新上传',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expect(storage.read).not.toHaveBeenCalled();
    expectSafePayload(result);
  });

  it('解析后文本长度超限时截断、低敏标记并复用 chunk 切分机制', async () => {
    const oversizedText = '护理说明。'.repeat(v1KnowledgeBaseUploadParseChunkRuntimeMaxChars);
    const { repository, storage, parseRecords } = createFixture({
      storage: { 'tenant-a/knowledge-a/file-a.bin': oversizedText },
    });

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-a' },
    });

    expect(result.status).toBe('succeeded');
    if (!('parse' in result)) throw new Error('expected parse result');
    expect(result.parse).toEqual(
      expect.objectContaining({
        parseStatus: 'succeeded',
        failureReasonCode: 'content_truncated',
        safeFailureMessage: '解析文本超过长度限制，已截断为低敏预览',
        textLength: v1KnowledgeBaseUploadParseChunkRuntimeMaxChars,
      }),
    );
    expect(parseRecords.get('tenant-a:file-a')?.textContent.length).toBe(
      v1KnowledgeBaseUploadParseChunkRuntimeMaxChars,
    );
    const chunks = await repository.listKnowledgeFileParseChunks({ tenantId: 'tenant-a', fileId: 'file-a' });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.textPreview.length <= PLATFORM_KNOWLEDGE_PARSE_CHUNK_MAX_CHARS)).toBe(true);
    expectSafePayload(result);
  });

  it.each([
    [
      'file-docx',
      createDocxBytes('DOCX safe text', {
        declaredUncompressedSizes: {
          'word/document.xml': zipEntryDeclaredOverLimitBytes,
        },
      }),
    ],
    [
      'file-xlsx',
      createXlsxBytes([['项目', '注意事项']], {
        declaredUncompressedSizes: {
          'xl/sharedStrings.xml': zipEntryDeclaredOverLimitBytes,
        },
      }),
    ],
  ])('ZIP entry 声明 uncompressed size 超限时安全失败并清空旧 chunk：%s', async (fileId, bytes) => {
    const storageKey = `tenant-a/knowledge-a/${fileId}.bin`;
    const { repository, storage, chunks, parseRecords } = createFixture({
      storage: { [storageKey]: bytes },
    });
    chunks.set(`tenant-a:${fileId}`, [
      {
        chunkId: 'old-chunk',
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        fileId,
        chunkIndex: 0,
        textPreview: '旧片段不应残留',
        charCount: 7,
        createdAt: now,
        updatedAt: now,
      },
    ]);

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
        failureReasonCode: 'parse_failed',
        safeFailureMessage: '知识库文件解析失败，请稍后重试',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expect(chunks.get(`tenant-a:${fileId}`)).toEqual([]);
    expect(parseRecords.get(`tenant-a:${fileId}`)).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        textContent: '',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expectSafePayload(result);
  });

  it('ZIP total extracted bytes 超限时安全失败并清空旧 chunk', async () => {
    const { repository, storage, chunks, parseRecords } = createFixture({
      storage: {
        'tenant-a/knowledge-a/file-docx.bin': createDocxBytes('DOCX safe text', {
          extraEntries: {
            'word/large-unused.xml': 'A'.repeat(zipTotalInflatedOverLimitBytes),
          },
        }),
      },
    });
    chunks.set('tenant-a:file-docx', [
      {
        chunkId: 'old-chunk',
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        fileId: 'file-docx',
        chunkIndex: 0,
        textPreview: '旧片段不应残留',
        charCount: 7,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-docx' },
    });

    expect(result.status).toBe('failed');
    if (!('parse' in result)) throw new Error('expected failed parse result');
    expect(result.parse).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        failureReasonCode: 'parse_failed',
        safeFailureMessage: '知识库文件解析失败，请稍后重试',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expect(chunks.get('tenant-a:file-docx')).toEqual([]);
    expect(parseRecords.get('tenant-a:file-docx')).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        textContent: '',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expectSafePayload(result);
  });

  it('PDF FlateDecode 解压内容超限时安全失败并清空旧 chunk', async () => {
    const { repository, storage, chunks, parseRecords } = createFixture({
      storage: {
        'tenant-a/knowledge-a/file-pdf.bin': createFlatePdfBytes('A'.repeat(pdfFlateInflatedOverLimitBytes)),
      },
    });
    chunks.set('tenant-a:file-pdf', [
      {
        chunkId: 'old-chunk',
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        fileId: 'file-pdf',
        chunkIndex: 0,
        textPreview: '旧片段不应残留',
        charCount: 7,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-pdf' },
    });

    expect(result.status).toBe('failed');
    if (!('parse' in result)) throw new Error('expected failed parse result');
    expect(result.parse).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        failureReasonCode: 'parse_failed',
        safeFailureMessage: '知识库文件解析失败，请稍后重试',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expect(chunks.get('tenant-a:file-pdf')).toEqual([]);
    expect(parseRecords.get('tenant-a:file-pdf')).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        textContent: '',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expectSafePayload(result);
  });

  it('storage.read 抛出底层异常时持久化 failed 状态并清空旧 chunks', async () => {
    const { repository, storage, chunks, parseRecords } = createFixture();
    chunks.set('tenant-a:file-a', [
      {
        chunkId: 'old-chunk',
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        fileId: 'file-a',
        chunkIndex: 0,
        textPreview: '旧片段不应残留',
        charCount: 7,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    storage.read = vi.fn(async () => {
      throw new Error('SQL storage read failed /Users/demo/path token secret stack');
    });

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-a' },
    });

    expect(result.status).toBe('failed');
    if (!('parse' in result)) throw new Error('expected failed parse result');
    expect(result.parse).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        failureReasonCode: 'parse_failed',
        safeFailureMessage: '知识库文件解析失败，请稍后重试',
        textLength: 0,
        chunkCount: 0,
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
    expect(chunks.get('tenant-a:file-a')).toEqual([]);
    expect(parseRecords.get('tenant-a:file-a')).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        textContent: '',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expectSafePayload(result);
  });

  it('chunk 写入失败时不留下 succeeded 状态并持久化 failed 状态', async () => {
    const { repository, storage, chunks, parseRecords } = createFixture();
    chunks.set('tenant-a:file-a', [
      {
        chunkId: 'old-chunk',
        tenantId: 'tenant-a',
        knowledgeId: 'knowledge-a',
        fileId: 'file-a',
        chunkIndex: 0,
        textPreview: '旧片段不应残留',
        charCount: 7,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    repository.replaceKnowledgeFileParseChunks.mockRejectedValueOnce(
      new Error('SQL chunk insert failed /Users/demo/path token secret stack'),
    );

    const result = await parsePlatformKnowledgeDocumentFileService({
      repository,
      storage,
      input: { tenantId: 'tenant-a', knowledgeId: 'knowledge-a', fileId: 'file-a' },
    });

    expect(result.status).toBe('failed');
    if (!('parse' in result)) throw new Error('expected failed parse result');
    expect(result.parse).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        failureReasonCode: 'parse_failed',
        safeFailureMessage: '知识库文件解析失败，请稍后重试',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expect(repository.saveKnowledgeFileParseResult).toHaveBeenLastCalledWith(
      expect.objectContaining({
        parseStatus: 'failed',
        textContent: '',
        textLength: 0,
        chunkCount: 0,
      }),
    );
    expect(repository.replaceKnowledgeFileParseChunks).toHaveBeenLastCalledWith(
      expect.objectContaining({ chunks: [] }),
    );
    expect(chunks.get('tenant-a:file-a')).toEqual([]);
    expect(parseRecords.get('tenant-a:file-a')).toEqual(
      expect.objectContaining({
        parseStatus: 'failed',
        textContent: '',
        chunkCount: 0,
      }),
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
