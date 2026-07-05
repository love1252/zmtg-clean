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
export const PLATFORM_KNOWLEDGE_ZIP_ENTRY_MAX_INFLATED_BYTES = 5 * 1024 * 1024;
export const PLATFORM_KNOWLEDGE_ZIP_TOTAL_MAX_INFLATED_BYTES = 12 * 1024 * 1024;
export const PLATFORM_KNOWLEDGE_PDF_FLATE_MAX_INFLATED_BYTES = 8 * 1024 * 1024;
export const PLATFORM_KNOWLEDGE_PARSER_VERSION = 'local-real-file-parser-v2';
export const PLATFORM_KNOWLEDGE_PARSE_MAX_PAGES = 200;
export const PLATFORM_KNOWLEDGE_PARSE_MAX_SHEETS = 20;
export const PLATFORM_KNOWLEDGE_PARSE_MAX_ROWS = 5000;

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

export type PlatformKnowledgeDocumentParserType = 'text' | 'markdown' | 'csv' | 'pdf' | 'docx' | 'xlsx';
export type PlatformKnowledgeDocumentParseFailureReasonCode =
  | 'unsupported_file_type'
  | 'parse_empty_text'
  | 'parse_file_too_large'
  | 'parse_page_limit_exceeded'
  | 'parse_sheet_limit_exceeded'
  | 'parse_malformed_document'
  | 'parse_scanned_pdf_unsupported'
  | 'parse_service_failed';
export type PlatformKnowledgeDocumentParseWarningCode =
  | 'parse_text_truncated'
  | 'parse_row_limit_exceeded';

export type PlatformKnowledgeDocumentParseResult = {
  status: 'succeeded';
  text: string;
  parserType: PlatformKnowledgeDocumentParserType;
  pageCount?: number;
  sheetCount?: number;
  rowCount?: number;
  warningCodes: PlatformKnowledgeDocumentParseWarningCode[];
} | {
  status: 'failed' | 'unsupported';
  text: '';
  parserType: PlatformKnowledgeDocumentParserType | null;
  pageCount?: number;
  sheetCount?: number;
  rowCount?: number;
  warningCodes: PlatformKnowledgeDocumentParseWarningCode[];
  failureReasonCode: PlatformKnowledgeDocumentParseFailureReasonCode;
  safeMessage: string;
};

export type PlatformKnowledgeDocumentParseInput = {
  fileName: string;
  mimeType: string;
  buffer: Uint8Array;
  tenantId: string;
  institutionId?: string | null;
  knowledgeId: string;
  fileId: string;
  maxChars?: number;
  maxRows?: number;
  maxSheets?: number;
  maxPages?: number;
};

const unsupportedSafeFailureMessage = '当前文件类型暂不支持解析';
const parseFailedSafeFailureMessage = '知识库文件解析失败，请稍后重试';
const malformedSafeFailureMessage = '文件结构无法解析，请确认文件未损坏后重试';
const emptyContentSafeFailureMessage = '文件未提取到可解析文本，扫描件或图片内容暂不支持';
const scannedPdfSafeFailureMessage = 'PDF 未提取到可复制文本，扫描件或图片文字暂不支持 OCR';
const oversizedFileSafeFailureMessage = '文件大小超过解析限制，请拆分后重新上传';
const pageLimitSafeFailureMessage = 'PDF 页数超过解析限制，请拆分后重新上传';
const sheetLimitSafeFailureMessage = 'Excel 工作表数量超过解析限制，请拆分后重新上传';

class ParseSafetyLimitError extends Error {}
class MalformedDocumentError extends Error {}
class PageLimitExceededError extends Error {
  constructor(readonly pageCount: number) { super('page_limit_exceeded'); }
}
class SheetLimitExceededError extends Error {
  constructor(readonly sheetCount: number) { super('sheet_limit_exceeded'); }
}

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

function parseCsvText(content: Uint8Array, maxRows = PLATFORM_KNOWLEDGE_PARSE_MAX_ROWS) {
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
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
        if (rows.length >= maxRows) break;
      }
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  if (inQuotes) throw new MalformedDocumentError('malformed_csv');
  row.push(cell.trim());
  if (row.some((value) => value.length > 0) && rows.length < maxRows) rows.push(row);

  return { text: rows.map((cells) => cells.join('\t')).join('\n'), rowCount: rows.length, truncatedRows: rows.length >= maxRows };
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

function assertInflatedByteLimit(input: {
  value: number;
  max: number;
}) {
  if (input.value > input.max) {
    throw new ParseSafetyLimitError('知识库文件解压内容超过安全限制');
  }
}

function decodeZipEntry(input: {
  content: Uint8Array;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  currentTotalInflatedBytes: number;
  dataOffset: number;
}) {
  if (input.uncompressedSize > 0) {
    assertInflatedByteLimit({
      value: input.uncompressedSize,
      max: PLATFORM_KNOWLEDGE_ZIP_ENTRY_MAX_INFLATED_BYTES,
    });
    assertInflatedByteLimit({
      value: input.currentTotalInflatedBytes + input.uncompressedSize,
      max: PLATFORM_KNOWLEDGE_ZIP_TOTAL_MAX_INFLATED_BYTES,
    });
  }

  const compressed = input.content.slice(input.dataOffset, input.dataOffset + input.compressedSize);
  const output =
    input.method === 0
      ? compressed
      : input.method === 8
        ? new Uint8Array(inflateRawSync(compressed, {
            maxOutputLength: PLATFORM_KNOWLEDGE_ZIP_ENTRY_MAX_INFLATED_BYTES,
          }))
        : null;
  if (!output) {
    throw new Error('unsupported zip compression');
  }

  assertInflatedByteLimit({
    value: output.byteLength,
    max: PLATFORM_KNOWLEDGE_ZIP_ENTRY_MAX_INFLATED_BYTES,
  });
  assertInflatedByteLimit({
    value: input.currentTotalInflatedBytes + output.byteLength,
    max: PLATFORM_KNOWLEDGE_ZIP_TOTAL_MAX_INFLATED_BYTES,
  });

  return output;
}

function readZipEntries(content: Uint8Array) {
  const entries = new Map<string, Uint8Array>();
  let totalInflatedBytes = 0;
  const eocdOffset = findZipEndOfCentralDirectory(content);
  if (eocdOffset >= 0) {
    const entryCount = readUint16(content, eocdOffset + 10);
    let centralOffset = readUint32(content, eocdOffset + 16);

    for (let index = 0; index < entryCount; index += 1) {
      if (readUint32(content, centralOffset) !== 0x02014b50) break;

      const method = readUint16(content, centralOffset + 10);
      const compressedSize = readUint32(content, centralOffset + 20);
      const centralUncompressedSize = readUint32(content, centralOffset + 24);
      const filenameLength = readUint16(content, centralOffset + 28);
      const extraLength = readUint16(content, centralOffset + 30);
      const commentLength = readUint16(content, centralOffset + 32);
      const localOffset = readUint32(content, centralOffset + 42);
      const filename = decodeUtf8(content.slice(centralOffset + 46, centralOffset + 46 + filenameLength));
      const localFilenameLength = readUint16(content, localOffset + 26);
      const localExtraLength = readUint16(content, localOffset + 28);
      const localUncompressedSize = readUint32(content, localOffset + 22);
      const uncompressedSize = centralUncompressedSize || localUncompressedSize;
      const dataOffset = localOffset + 30 + localFilenameLength + localExtraLength;

      const entry = decodeZipEntry({
        content,
        method,
        compressedSize,
        uncompressedSize,
        currentTotalInflatedBytes: totalInflatedBytes,
        dataOffset,
      });
      totalInflatedBytes += entry.byteLength;
      entries.set(filename, entry);
      centralOffset += 46 + filenameLength + extraLength + commentLength;
    }

    return entries;
  }

  let offset = 0;
  while (offset + 30 < content.byteLength && readUint32(content, offset) === 0x04034b50) {
    const method = readUint16(content, offset + 8);
    const compressedSize = readUint32(content, offset + 18);
    const uncompressedSize = readUint32(content, offset + 22);
    const filenameLength = readUint16(content, offset + 26);
    const extraLength = readUint16(content, offset + 28);
    const filename = decodeUtf8(content.slice(offset + 30, offset + 30 + filenameLength));
    const dataOffset = offset + 30 + filenameLength + extraLength;
    const entry = decodeZipEntry({
      content,
      method,
      compressedSize,
      uncompressedSize,
      currentTotalInflatedBytes: totalInflatedBytes,
      dataOffset,
    });
    totalInflatedBytes += entry.byteLength;
    entries.set(filename, entry);
    offset = dataOffset + compressedSize;
  }

  return entries;
}

function extractDocxText(content: Uint8Array) {
  const entries = readZipEntries(content);
  const documentBytes = entries.get('word/document.xml');
  if (!documentBytes) throw new MalformedDocumentError('missing_docx_document');
  const paragraphs: string[] = [];

  [documentBytes].forEach((bytes) => {
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

function extractWorkbookRelationships(xml: string) {
  const relationships = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attrs = match[1];
    const id = /\bId="([^"]+)"/.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(attrs)?.[1];
    if (id && target) relationships.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\.\//, '')}`);
  }
  return relationships;
}

function extractXlsxSheets(entries: Map<string, Uint8Array>) {
  const workbook = entries.get('xl/workbook.xml');
  const rels = entries.get('xl/_rels/workbook.xml.rels');
  const relationships = rels ? extractWorkbookRelationships(decodeUtf8(rels)) : new Map<string, string>();
  if (workbook) {
    const workbookXml = decodeUtf8(workbook);
    const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?>(?:<\/sheet>)?/g)].flatMap((match, index) => {
      const attrs = match[1];
      const name = xmlText(/\bname="([^"]*)"/.exec(attrs)?.[1] ?? `Sheet${index + 1}`);
      const relId = /\br:id="([^"]+)"/.exec(attrs)?.[1];
      const fallbackPath = `xl/worksheets/sheet${index + 1}.xml`;
      const path = relId ? relationships.get(relId) ?? fallbackPath : fallbackPath;
      return entries.has(path) ? [{ name, path, bytes: entries.get(path) ?? new Uint8Array() }] : [];
    });
    if (sheets.length > 0) return sheets;
  }

  return [...entries.entries()]
    .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, bytes], index) => ({ name: `Sheet${index + 1}`, path, bytes }));
}

function extractXlsxText(content: Uint8Array, options: { maxSheets: number; maxRows: number }) {
  const entries = readZipEntries(content);
  const sharedStrings = entries.has('xl/sharedStrings.xml')
    ? extractSharedStrings(decodeUtf8(entries.get('xl/sharedStrings.xml') ?? new Uint8Array()))
    : [];
  const sheets = extractXlsxSheets(entries);
  if (sheets.length === 0) throw new MalformedDocumentError('missing_xlsx_sheets');
  if (sheets.length > options.maxSheets) throw new SheetLimitExceededError(sheets.length);

  const rows: string[] = [];
  let rowCount = 0;
  let truncatedRows = false;

  sheets.forEach((sheet) => {
    rows.push(`[Sheet] ${sheet.name}`);
    const sheetXml = decodeUtf8(sheet.bytes);
    for (const rowMatch of sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      if (rowCount >= options.maxRows) {
        truncatedRows = true;
        break;
      }
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
      if (cells.length > 0) {
        rows.push(cells.join('\t'));
        rowCount += 1;
      }
    }
  });

  return { text: rows.join('\n'), sheetCount: sheets.length, rowCount, truncatedRows };
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

function inflatePdfFlateStream(content: Uint8Array) {
  const inflated = new Uint8Array(inflateSync(content, {
    maxOutputLength: PLATFORM_KNOWLEDGE_PDF_FLATE_MAX_INFLATED_BYTES,
  }));
  assertInflatedByteLimit({
    value: inflated.byteLength,
    max: PLATFORM_KNOWLEDGE_PDF_FLATE_MAX_INFLATED_BYTES,
  });

  return inflated;
}

function countPdfPages(raw: string) {
  const count = [...raw.matchAll(/\/Type\s*\/Page\b/g)].length;
  return count || undefined;
}

function extractPdfText(content: Uint8Array, maxPages = PLATFORM_KNOWLEDGE_PARSE_MAX_PAGES) {
  const raw = decodeLatin1(content);
  if (!raw.startsWith('%PDF-')) throw new MalformedDocumentError('malformed_pdf');
  const pageCount = countPdfPages(raw);
  if (pageCount && pageCount > maxPages) throw new PageLimitExceededError(pageCount);
  const streams = [...raw.matchAll(/<<(?:[\s\S](?!endobj))*?>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g)];
  const texts: string[] = [];

  streams.forEach((match) => {
    const dictionary = match[0].slice(0, match[0].indexOf('stream'));
    const streamText = match[1];
    if (/\/Subtype\s*\/Image/.test(dictionary)) return;

    if (/\/FlateDecode/.test(dictionary)) {
      const streamOffset = raw.indexOf(match[1], match.index);
      const streamBytes = content.slice(streamOffset, streamOffset + streamText.length);
      try {
        texts.push(extractPdfTextOperators(decodeLatin1(inflatePdfFlateStream(streamBytes))));
      } catch (error) {
        if (error instanceof ParseSafetyLimitError) throw error;
        throw new Error('pdf_flate_decode_failed');
      }
      return;
    }

    texts.push(extractPdfTextOperators(streamText));
  });

  if (texts.length === 0) {
    texts.push(extractPdfTextOperators(raw));
  }

  return { text: texts.join('\n'), pageCount };
}

function parserTypeForExtension(extension: string): PlatformKnowledgeDocumentParserType | null {
  if (extension === '.txt') return 'text';
  if (extension === '.md') return 'markdown';
  if (extension === '.csv') return 'csv';
  if (extension === '.pdf') return 'pdf';
  if (extension === '.docx') return 'docx';
  if (extension === '.xlsx') return 'xlsx';
  return null;
}

function failureResult(input: {
  status?: 'failed' | 'unsupported';
  parserType: PlatformKnowledgeDocumentParserType | null;
  failureReasonCode: PlatformKnowledgeDocumentParseFailureReasonCode;
  safeMessage: string;
  pageCount?: number;
  sheetCount?: number;
  rowCount?: number;
}): PlatformKnowledgeDocumentParseResult {
  return {
    status: input.status ?? 'failed',
    text: '',
    parserType: input.parserType,
    failureReasonCode: input.failureReasonCode,
    safeMessage: input.safeMessage,
    pageCount: input.pageCount,
    sheetCount: input.sheetCount,
    rowCount: input.rowCount,
    warningCodes: [],
  };
}

export function parseKnowledgeDocumentFile(input: PlatformKnowledgeDocumentParseInput): PlatformKnowledgeDocumentParseResult {
  const extension = extensionOf(input.fileName);
  const parserType = parserTypeForExtension(extension);
  if (!parserType || !isSupportedFile({ filename: input.fileName, mimeType: input.mimeType })) {
    return failureResult({
      status: 'unsupported',
      parserType,
      failureReasonCode: 'unsupported_file_type',
      safeMessage: unsupportedSafeFailureMessage,
    });
  }

  const maxChars = input.maxChars ?? PLATFORM_KNOWLEDGE_PARSE_TEXT_MAX_CHARS;
  const maxRows = input.maxRows ?? PLATFORM_KNOWLEDGE_PARSE_MAX_ROWS;
  const maxSheets = input.maxSheets ?? PLATFORM_KNOWLEDGE_PARSE_MAX_SHEETS;
  const maxPages = input.maxPages ?? PLATFORM_KNOWLEDGE_PARSE_MAX_PAGES;
  const warningCodes: PlatformKnowledgeDocumentParseWarningCode[] = [];

  try {
    let extractedText = '';
    let pageCount: number | undefined;
    let sheetCount: number | undefined;
    let rowCount: number | undefined;

    if (extension === '.csv') {
      const parsed = parseCsvText(input.buffer, maxRows);
      extractedText = parsed.text;
      rowCount = parsed.rowCount;
      if (parsed.truncatedRows) warningCodes.push('parse_row_limit_exceeded');
    } else if (extension === '.pdf') {
      const parsed = extractPdfText(input.buffer, maxPages);
      extractedText = parsed.text;
      pageCount = parsed.pageCount;
    } else if (extension === '.docx') {
      extractedText = extractDocxText(input.buffer);
    } else if (extension === '.xlsx') {
      const parsed = extractXlsxText(input.buffer, { maxSheets, maxRows });
      extractedText = parsed.text;
      sheetCount = parsed.sheetCount;
      rowCount = parsed.rowCount;
      if (parsed.truncatedRows) warningCodes.push('parse_row_limit_exceeded');
    } else {
      extractedText = decodeUtf8(input.buffer);
    }

    let text = normalizeExtractedText(extractedText);
    if (!text) {
      return failureResult({
        parserType,
        failureReasonCode: parserType === 'pdf' ? 'parse_scanned_pdf_unsupported' : 'parse_empty_text',
        safeMessage: parserType === 'pdf' ? scannedPdfSafeFailureMessage : emptyContentSafeFailureMessage,
        pageCount,
        sheetCount,
        rowCount,
      });
    }
    if (text.length > maxChars) {
      text = text.slice(0, maxChars);
      warningCodes.push('parse_text_truncated');
    }

    return { status: 'succeeded', text, parserType, pageCount, sheetCount, rowCount, warningCodes };
  } catch (error) {
    if (error instanceof PageLimitExceededError) {
      return failureResult({ parserType, failureReasonCode: 'parse_page_limit_exceeded', safeMessage: pageLimitSafeFailureMessage, pageCount: error.pageCount });
    }
    if (error instanceof SheetLimitExceededError) {
      return failureResult({ parserType, failureReasonCode: 'parse_sheet_limit_exceeded', safeMessage: sheetLimitSafeFailureMessage, sheetCount: error.sheetCount });
    }
    if (error instanceof MalformedDocumentError) {
      return failureResult({ parserType, failureReasonCode: 'parse_malformed_document', safeMessage: malformedSafeFailureMessage });
    }
    return failureResult({ parserType, failureReasonCode: 'parse_service_failed', safeMessage: parseFailedSafeFailureMessage });
  }
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
    failureReasonCode: input.failureReasonCode ?? 'parse_service_failed',
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
      failureReasonCode: 'parse_file_too_large',
      safeFailureMessage: oversizedFileSafeFailureMessage,
    });
  }

  try {
    const documentParse = parseKnowledgeDocumentFile({
      fileName: found.file.originalFilename,
      mimeType: found.file.mimeType,
      buffer: await input.storage.read({ storageKey: found.file.storageKey }),
      tenantId,
      knowledgeId,
      fileId,
    });
    if (documentParse.status !== 'succeeded') {
      return persistFailedParse({
        repository: input.repository,
        baseRecord,
        failureReasonCode: documentParse.failureReasonCode,
        safeFailureMessage: documentParse.safeMessage,
      });
    }

    const chunks = splitTextIntoChunks({ tenantId, knowledgeId, fileId, text: documentParse.text, now });
    const parse = await input.repository.saveKnowledgeFileParseResult({
      ...baseRecord,
      parseStatus: 'succeeded',
      failureReasonCode: null,
      safeFailureMessage: null,
      textContent: documentParse.text,
      textLength: documentParse.text.length,
      chunkCount: chunks.length,
    });
    await input.repository.replaceKnowledgeFileParseChunks({
      tenantId,
      knowledgeId,
      fileId,
      chunks,
    });

    return {
      status: 'succeeded' as const,
      parse: mapParseRecord(parse),
      parserType: documentParse.parserType,
      warningCodes: documentParse.warningCodes,
    };
  } catch {
    return persistFailedParse({
      repository: input.repository,
      baseRecord,
      failureReasonCode: 'parse_service_failed',
      safeFailureMessage: parseFailedSafeFailureMessage,
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
