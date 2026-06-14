import { createHash } from 'node:crypto';
import { inflateRawSync, inflateSync } from 'node:zlib';
import {
  chunkV1KnowledgeBaseRuntimeDocument,
  v1KnowledgeBaseUploadParseChunkRuntimeMaxChars,
} from '@/modules/knowledge-base/server/v1-knowledge-base-upload-parse-chunk-runtime';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import {
  isKnowledgeVisibleToInstitution,
  PLATFORM_KNOWLEDGE_FILE_MAX_BYTES,
  type PlatformKnowledgeFileRepositoryRecord,
  type PlatformKnowledgeFileStorage,
} from '@/modules/open-platform/server/platform-knowledge-file-management-service';

export const PLATFORM_KNOWLEDGE_PARSE_CHUNK_MAX_CHARS = 120;
export const PLATFORM_KNOWLEDGE_PARSE_TEXT_MAX_CHARS = v1KnowledgeBaseUploadParseChunkRuntimeMaxChars;
export const PLATFORM_KNOWLEDGE_PARSER_VERSION = 'local-real-file-parser-v1';

export type PlatformKnowledgeFileParseStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed';

export type PlatformKnowledgeFileParseRecord = {
  parseId: string;
  tenantId: string;
  knowledgeId: string;
  fileId: string;
  parseStatus: PlatformKnowledgeFileParseStatus;
  failureReasonCode: string | null;
  safeFailureMessage: string | null;
  textContent: string;
  textLength: number;
  chunkCount: number;
  parserVersion: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PlatformKnowledgeFileParseChunkRecord = {
  chunkId: string;
  tenantId: string;
  knowledgeId: string;
  fileId: string;
  chunkIndex: number;
  textPreview: string;
  charCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PlatformKnowledgeFileParseDto = Omit<PlatformKnowledgeFileParseRecord, 'textContent'>;

export type PlatformKnowledgeFileParseChunkDto = PlatformKnowledgeFileParseChunkRecord;

export type PlatformKnowledgeDocumentParsingRepository = {
  findKnowledgeItem(input: {
    tenantId: string;
    knowledgeId: string;
  }): Promise<PlatformKnowledgeRepositoryRecord | null>;
  findKnowledgeFile(input: {
    tenantId: string;
    knowledgeId: string;
    fileId: string;
  }): Promise<PlatformKnowledgeFileRepositoryRecord | null>;
  findKnowledgeFileParse(input: {
    tenantId: string;
    knowledgeId: string;
    fileId: string;
  }): Promise<PlatformKnowledgeFileParseRecord | null>;
  saveKnowledgeFileParseResult(
    input: PlatformKnowledgeFileParseRecord,
  ): Promise<PlatformKnowledgeFileParseRecord>;
  replaceKnowledgeFileParseChunks(input: {
    tenantId: string;
    knowledgeId: string;
    fileId: string;
    chunks: PlatformKnowledgeFileParseChunkRecord[];
  }): Promise<PlatformKnowledgeFileParseChunkRecord[]>;
  listKnowledgeFileParseChunks(input: {
    tenantId: string;
    knowledgeId: string;
    fileId: string;
  }): Promise<PlatformKnowledgeFileParseChunkRecord[]>;
};

type ParseServiceInput = {
  repository: PlatformKnowledgeDocumentParsingRepository;
  storage: Pick<PlatformKnowledgeFileStorage, 'read'>;
  input: {
    tenantId?: string | null;
    knowledgeId?: string | null;
    fileId?: string | null;
  };
};

type ParseReadServiceInput = {
  repository: Pick<
    PlatformKnowledgeDocumentParsingRepository,
    'findKnowledgeItem' | 'findKnowledgeFile' | 'findKnowledgeFileParse' | 'listKnowledgeFileParseChunks'
  >;
  input: {
    tenantId?: string | null;
    knowledgeId?: string | null;
    fileId?: string | null;
  };
};

type InstitutionParseReadServiceInput = ParseReadServiceInput & {
  input: ParseReadServiceInput['input'] & {
    institutionId?: string | null;
  };
};

const supportedFileTypes = new Map<string, readonly string[]>([
  ['.txt', ['text/plain']],
  ['.md', ['text/markdown', 'text/plain']],
  ['.csv', ['text/csv', 'application/csv', 'application/vnd.ms-excel']],
  ['.pdf', ['application/pdf']],
  ['.docx', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
  ['.xlsx', ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']],
]);
const unsupportedSafeFailureMessage = '当前文件类型暂不支持解析';
const parseFailedSafeFailureMessage = '知识库文件解析失败，请稍后重试';
const emptyContentSafeFailureMessage = '文件未提取到可解析文本，扫描件或图片内容暂不支持';
const oversizedFileSafeFailureMessage = '文件大小超过解析限制，请拆分后重新上传';
const contentTruncatedSafeFailureMessage = '解析文本超过长度限制，已截断为低敏预览';

function normalizeRequired(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function extensionOf(filename: string) {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return filename.slice(dotIndex).toLowerCase();
}

function normalizeMimeType(mimeType: string | null | undefined) {
  return mimeType?.trim().toLowerCase() ?? '';
}

function isSupportedFile(input: { filename: string; mimeType: string }) {
  const extension = extensionOf(input.filename);
  const allowedMimeTypes = supportedFileTypes.get(extension);
  if (!allowedMimeTypes) return false;

  const mimeType = normalizeMimeType(input.mimeType);
  return !mimeType || allowedMimeTypes.includes(mimeType);
}

function parseId(input: { tenantId: string; knowledgeId: string; fileId: string }) {
  return `kb-parse-${createHash('sha256')
    .update(`${input.tenantId}:${input.knowledgeId}:${input.fileId}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function chunkId(input: {
  tenantId: string;
  knowledgeId: string;
  fileId: string;
  chunkIndex: number;
}) {
  return `kb-chunk-${createHash('sha256')
    .update(`${input.tenantId}:${input.knowledgeId}:${input.fileId}:${input.chunkIndex}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

function decodeUtf8(content: Uint8Array) {
  return new TextDecoder('utf-8', { fatal: false }).decode(content);
}

function decodeLatin1(content: Uint8Array) {
  return new TextDecoder('latin1', { fatal: false }).decode(content);
}

function xmlText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripXmlTags(value: string) {
  return xmlText(value.replace(/<[^>]+>/g, ' '));
}

function parseCsvText(content: Uint8Array) {
  const text = decodeUtf8(content).replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);

  return rows.map((cells) => cells.join('\t')).join('\n');
}

function readUint16(content: Uint8Array, offset: number) {
  return new DataView(content.buffer, content.byteOffset + offset, 2).getUint16(0, true);
}

function readUint32(content: Uint8Array, offset: number) {
  return new DataView(content.buffer, content.byteOffset + offset, 4).getUint32(0, true);
}

function findZipEndOfCentralDirectory(content: Uint8Array) {
  for (let offset = content.byteLength - 22; offset >= 0; offset -= 1) {
    if (readUint32(content, offset) === 0x06054b50) return offset;
  }

  return -1;
}

function decodeZipEntry(input: {
  content: Uint8Array;
  method: number;
  compressedSize: number;
  dataOffset: number;
}) {
  const compressed = input.content.slice(input.dataOffset, input.dataOffset + input.compressedSize);
  if (input.method === 0) return compressed;
  if (input.method === 8) return new Uint8Array(inflateRawSync(compressed));
  throw new Error('unsupported zip compression');
}

function readZipEntries(content: Uint8Array) {
  const entries = new Map<string, Uint8Array>();
  const eocdOffset = findZipEndOfCentralDirectory(content);
  if (eocdOffset >= 0) {
    const entryCount = readUint16(content, eocdOffset + 10);
    let centralOffset = readUint32(content, eocdOffset + 16);

    for (let index = 0; index < entryCount; index += 1) {
      if (readUint32(content, centralOffset) !== 0x02014b50) break;

      const method = readUint16(content, centralOffset + 10);
      const compressedSize = readUint32(content, centralOffset + 20);
      const filenameLength = readUint16(content, centralOffset + 28);
      const extraLength = readUint16(content, centralOffset + 30);
      const commentLength = readUint16(content, centralOffset + 32);
      const localOffset = readUint32(content, centralOffset + 42);
      const filename = decodeUtf8(content.slice(centralOffset + 46, centralOffset + 46 + filenameLength));
      const localFilenameLength = readUint16(content, localOffset + 26);
      const localExtraLength = readUint16(content, localOffset + 28);
      const dataOffset = localOffset + 30 + localFilenameLength + localExtraLength;

      entries.set(filename, decodeZipEntry({ content, method, compressedSize, dataOffset }));
      centralOffset += 46 + filenameLength + extraLength + commentLength;
    }

    return entries;
  }

  let offset = 0;
  while (offset + 30 < content.byteLength && readUint32(content, offset) === 0x04034b50) {
    const method = readUint16(content, offset + 8);
    const compressedSize = readUint32(content, offset + 18);
    const filenameLength = readUint16(content, offset + 26);
    const extraLength = readUint16(content, offset + 28);
    const filename = decodeUtf8(content.slice(offset + 30, offset + 30 + filenameLength));
    const dataOffset = offset + 30 + filenameLength + extraLength;
    entries.set(filename, decodeZipEntry({ content, method, compressedSize, dataOffset }));
    offset = dataOffset + compressedSize;
  }

  return entries;
}

function extractDocxText(content: Uint8Array) {
  const entries = readZipEntries(content);
  const documentEntries = [...entries.entries()]
    .filter(([name]) =>
      name === 'word/document.xml' ||
      /^word\/(header|footer)\d+\.xml$/.test(name),
    )
    .sort(([left], [right]) => left.localeCompare(right));
  const paragraphs: string[] = [];

  documentEntries.forEach(([, bytes]) => {
    const xml = decodeUtf8(bytes)
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:br\b[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n');
    const texts = [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((match) => xmlText(match[1]))
      .join('');
    paragraphs.push(texts);
  });

  return paragraphs.join('\n');
}

function extractSharedStrings(xml: string) {
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => {
    const textNodes = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => xmlText(textMatch[1]))
      .join('');
    return textNodes || stripXmlTags(match[1]).trim();
  });
}

function extractXlsxText(content: Uint8Array) {
  const entries = readZipEntries(content);
  const sharedStrings = entries.has('xl/sharedStrings.xml')
    ? extractSharedStrings(decodeUtf8(entries.get('xl/sharedStrings.xml') ?? new Uint8Array()))
    : [];
  const rows: string[] = [];

  [...entries.entries()]
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([, bytes]) => {
      const sheetXml = decodeUtf8(bytes);
      [...sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].forEach((rowMatch) => {
        const cells = [...rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)]
          .map((cellMatch) => {
            const attrs = cellMatch[1];
            const body = cellMatch[2];
            const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
            if (type === 's') {
              const index = Number.parseInt(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '', 10);
              return Number.isFinite(index) ? sharedStrings[index] ?? '' : '';
            }
            if (type === 'inlineStr') {
              return [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
                .map((match) => xmlText(match[1]))
                .join('');
            }

            return xmlText(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '').trim();
          })
          .filter((value) => value.length > 0);
        if (cells.length > 0) rows.push(cells.join('\t'));
      });
    });

  return rows.join('\n');
}

function unescapePdfString(value: string) {
  return value.replace(/\\([nrtbf()\\])/g, (_match, escaped: string) => {
    const map: Record<string, string> = {
      n: '\n',
      r: '\r',
      t: '\t',
      b: '',
      f: '',
      '(': '(',
      ')': ')',
      '\\': '\\',
    };
    return map[escaped] ?? escaped;
  });
}

function decodePdfHexString(value: string) {
  const normalized = value.replace(/\s+/g, '');
  const bytes: number[] = [];
  for (let index = 0; index < normalized.length; index += 2) {
    const byte = Number.parseInt(normalized.slice(index, index + 2).padEnd(2, '0'), 16);
    if (Number.isFinite(byte)) bytes.push(byte);
  }

  return decodeUtf8(new Uint8Array(bytes));
}

function extractPdfTextOperators(content: string) {
  const texts: string[] = [];

  for (const match of content.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) {
    texts.push(unescapePdfString(match[0].replace(/\)\s*Tj$/, '').slice(1)));
  }
  for (const match of content.matchAll(/<([0-9a-fA-F\s]+)>\s*Tj/g)) {
    texts.push(decodePdfHexString(match[1]));
  }
  for (const match of content.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) {
    const arrayBody = match[1];
    for (const textMatch of arrayBody.matchAll(/\((?:\\.|[^\\)])*\)|<([0-9a-fA-F\s]+)>/g)) {
      const raw = textMatch[0];
      if (raw.startsWith('(')) {
        texts.push(unescapePdfString(raw.slice(1, -1)));
      } else {
        texts.push(decodePdfHexString(raw.slice(1, -1)));
      }
    }
  }

  return texts.join('\n');
}

function extractPdfText(content: Uint8Array) {
  const raw = decodeLatin1(content);
  const streams = [...raw.matchAll(/<<(?:[\s\S](?!endobj))*?>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g)];
  const texts: string[] = [];

  streams.forEach((match) => {
    const objectStart = Math.max(0, raw.lastIndexOf('obj', match.index ?? 0));
    const dictionary = raw.slice(objectStart, match.index);
    const streamText = match[1];
    if (/\/Subtype\s*\/Image/.test(dictionary)) return;

    if (/\/FlateDecode/.test(dictionary)) {
      const streamOffset = raw.indexOf(match[1], match.index);
      const streamBytes = content.slice(streamOffset, streamOffset + streamText.length);
      try {
        texts.push(extractPdfTextOperators(decodeLatin1(new Uint8Array(inflateSync(streamBytes)))));
      } catch {
        texts.push(extractPdfTextOperators(streamText));
      }
      return;
    }

    texts.push(extractPdfTextOperators(streamText));
  });

  if (texts.length === 0) {
    texts.push(extractPdfTextOperators(raw));
  }

  return texts.join('\n');
}

function extractTextFromFile(input: {
  filename: string;
  content: Uint8Array;
}) {
  const extension = extensionOf(input.filename);
  if (extension === '.csv') return normalizeExtractedText(parseCsvText(input.content));
  if (extension === '.pdf') return normalizeExtractedText(extractPdfText(input.content));
  if (extension === '.docx') return normalizeExtractedText(extractDocxText(input.content));
  if (extension === '.xlsx') return normalizeExtractedText(extractXlsxText(input.content));

  return normalizeExtractedText(decodeUtf8(input.content));
}

function mapParseRecord(record: PlatformKnowledgeFileParseRecord): PlatformKnowledgeFileParseDto {
  const { textContent: _textContent, ...safeRecord } = record;
  return safeRecord;
}

function pendingParseDto(input: { tenantId: string; knowledgeId: string; fileId: string }) {
  const now = new Date(0);
  return {
    parseId: parseId(input),
    tenantId: input.tenantId,
    knowledgeId: input.knowledgeId,
    fileId: input.fileId,
    parseStatus: 'pending' as const,
    failureReasonCode: null,
    safeFailureMessage: null,
    textLength: 0,
    chunkCount: 0,
    parserVersion: PLATFORM_KNOWLEDGE_PARSER_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}

function splitTextIntoChunks(input: {
  tenantId: string;
  knowledgeId: string;
  fileId: string;
  text: string;
  now: Date;
}) {
  if (!input.text) return [];

  return chunkV1KnowledgeBaseRuntimeDocument({
    text: input.text,
    maxChars: PLATFORM_KNOWLEDGE_PARSE_CHUNK_MAX_CHARS,
  }).map((chunk) => ({
      chunkId: chunkId({ ...input, chunkIndex: chunk.chunkIndex }),
      tenantId: input.tenantId,
      knowledgeId: input.knowledgeId,
      fileId: input.fileId,
      chunkIndex: chunk.chunkIndex,
      textPreview: chunk.chunkText,
      charCount: chunk.charLength,
      createdAt: input.now,
      updatedAt: input.now,
    }));
}

async function persistFailedParse(input: {
  repository: Pick<
    PlatformKnowledgeDocumentParsingRepository,
    'saveKnowledgeFileParseResult' | 'replaceKnowledgeFileParseChunks'
  >;
  baseRecord: {
    parseId: string;
    tenantId: string;
    knowledgeId: string;
    fileId: string;
    parserVersion: string;
    createdAt: Date;
    updatedAt: Date;
  };
  failureReasonCode?: string;
  safeFailureMessage?: string;
}) {
  const parse = await input.repository.saveKnowledgeFileParseResult({
    ...input.baseRecord,
    parseStatus: 'failed',
    failureReasonCode: input.failureReasonCode ?? 'parse_failed',
    safeFailureMessage: input.safeFailureMessage ?? parseFailedSafeFailureMessage,
    textContent: '',
    textLength: 0,
    chunkCount: 0,
  });
  await input.repository.replaceKnowledgeFileParseChunks({
    tenantId: input.baseRecord.tenantId,
    knowledgeId: input.baseRecord.knowledgeId,
    fileId: input.baseRecord.fileId,
    chunks: [],
  });

  return { status: 'failed' as const, parse: mapParseRecord(parse) };
}

async function ensureKnowledgeAndFile(input: {
  repository: Pick<
    PlatformKnowledgeDocumentParsingRepository,
    'findKnowledgeItem' | 'findKnowledgeFile'
  >;
  tenantId: string;
  knowledgeId: string;
  fileId: string;
}) {
  const knowledge = await input.repository.findKnowledgeItem({
    tenantId: input.tenantId,
    knowledgeId: input.knowledgeId,
  });
  if (!knowledge) return { status: 'not_found' as const };

  const file = await input.repository.findKnowledgeFile({
    tenantId: input.tenantId,
    knowledgeId: input.knowledgeId,
    fileId: input.fileId,
  });
  if (!file) return { status: 'not_found' as const };

  return { status: 'found' as const, knowledge, file };
}

export async function parsePlatformKnowledgeDocumentFileService(input: ParseServiceInput) {
  const tenantId = normalizeRequired(input.input.tenantId);
  const knowledgeId = normalizeRequired(input.input.knowledgeId);
  const fileId = normalizeRequired(input.input.fileId);
  if (!tenantId || !knowledgeId || !fileId) {
    return { status: 'validation_failed' as const, message: '缺少知识库解析范围' };
  }

  const found = await ensureKnowledgeAndFile({
    repository: input.repository,
    tenantId,
    knowledgeId,
    fileId,
  });
  if (found.status !== 'found') return { status: found.status };
  if (found.file.status !== 'active') {
    return { status: 'validation_failed' as const, message: '归档文件不能解析' };
  }

  const now = new Date();
  const baseRecord = {
    parseId: parseId({ tenantId, knowledgeId, fileId }),
    tenantId,
    knowledgeId,
    fileId,
    parserVersion: PLATFORM_KNOWLEDGE_PARSER_VERSION,
    createdAt: now,
    updatedAt: now,
  };

  if (!isSupportedFile({ filename: found.file.originalFilename, mimeType: found.file.mimeType })) {
    return persistFailedParse({
      repository: input.repository,
      baseRecord,
      failureReasonCode: 'unsupported_file_type',
      safeFailureMessage: unsupportedSafeFailureMessage,
    });
  }

  if (found.file.sizeBytes > PLATFORM_KNOWLEDGE_FILE_MAX_BYTES) {
    return persistFailedParse({
      repository: input.repository,
      baseRecord,
      failureReasonCode: 'file_too_large',
      safeFailureMessage: oversizedFileSafeFailureMessage,
    });
  }

  try {
    const extractedText = extractTextFromFile({
      filename: found.file.originalFilename,
      content: await input.storage.read({ storageKey: found.file.storageKey }),
    });
    if (!extractedText) {
      return persistFailedParse({
        repository: input.repository,
        baseRecord,
        failureReasonCode: 'empty_content',
        safeFailureMessage: emptyContentSafeFailureMessage,
      });
    }

    const isTruncated = extractedText.length > PLATFORM_KNOWLEDGE_PARSE_TEXT_MAX_CHARS;
    const textContent = isTruncated
      ? extractedText.slice(0, PLATFORM_KNOWLEDGE_PARSE_TEXT_MAX_CHARS)
      : extractedText;
    const chunks = splitTextIntoChunks({ tenantId, knowledgeId, fileId, text: textContent, now });
    const parse = await input.repository.saveKnowledgeFileParseResult({
      ...baseRecord,
      parseStatus: 'succeeded',
      failureReasonCode: isTruncated ? 'content_truncated' : null,
      safeFailureMessage: isTruncated ? contentTruncatedSafeFailureMessage : null,
      textContent,
      textLength: textContent.length,
      chunkCount: chunks.length,
    });
    await input.repository.replaceKnowledgeFileParseChunks({
      tenantId,
      knowledgeId,
      fileId,
      chunks,
    });

    return { status: 'succeeded' as const, parse: mapParseRecord(parse) };
  } catch {
    return persistFailedParse({
      repository: input.repository,
      baseRecord,
    });
  }
}

export async function getPlatformKnowledgeDocumentFileParseStatusService(input: ParseReadServiceInput) {
  const tenantId = normalizeRequired(input.input.tenantId);
  const knowledgeId = normalizeRequired(input.input.knowledgeId);
  const fileId = normalizeRequired(input.input.fileId);
  if (!tenantId || !knowledgeId || !fileId) {
    return { status: 'validation_failed' as const, message: '缺少知识库解析范围' };
  }

  const found = await ensureKnowledgeAndFile({
    repository: input.repository,
    tenantId,
    knowledgeId,
    fileId,
  });
  if (found.status !== 'found') return { status: found.status };

  const parse = await input.repository.findKnowledgeFileParse({ tenantId, knowledgeId, fileId });
  return {
    status: parse?.parseStatus ?? 'pending',
    parse: parse ? mapParseRecord(parse) : pendingParseDto({ tenantId, knowledgeId, fileId }),
  };
}

export async function listPlatformKnowledgeDocumentFileChunksService(input: ParseReadServiceInput) {
  const tenantId = normalizeRequired(input.input.tenantId);
  const knowledgeId = normalizeRequired(input.input.knowledgeId);
  const fileId = normalizeRequired(input.input.fileId);
  if (!tenantId || !knowledgeId || !fileId) {
    return { status: 'validation_failed' as const, message: '缺少知识库解析范围' };
  }

  const found = await ensureKnowledgeAndFile({
    repository: input.repository,
    tenantId,
    knowledgeId,
    fileId,
  });
  if (found.status !== 'found') return { status: found.status };

  const records = await input.repository.listKnowledgeFileParseChunks({ tenantId, knowledgeId, fileId });
  return {
    requestId: 'platform-knowledge-document-file-parse-chunks' as const,
    dataSource: 'repository' as const,
    records: records
      .filter((chunk) => chunk.tenantId === tenantId && chunk.knowledgeId === knowledgeId && chunk.fileId === fileId)
      .sort((left, right) => left.chunkIndex - right.chunkIndex),
  };
}

export async function ensureInstitutionCanReadParsedFile(input: InstitutionParseReadServiceInput) {
  const tenantId = normalizeRequired(input.input.tenantId);
  const institutionId = normalizeRequired(input.input.institutionId);
  const knowledgeId = normalizeRequired(input.input.knowledgeId);
  const fileId = normalizeRequired(input.input.fileId);
  if (!tenantId || !institutionId || !knowledgeId || !fileId) {
    return { status: 'validation_failed' as const };
  }

  const found = await ensureKnowledgeAndFile({
    repository: input.repository,
    tenantId,
    knowledgeId,
    fileId,
  });
  if (found.status !== 'found') return { status: found.status };
  if (!isKnowledgeVisibleToInstitution(found.knowledge, institutionId)) {
    return { status: 'forbidden' as const };
  }

  return { status: 'visible' as const, tenantId, knowledgeId, fileId };
}
