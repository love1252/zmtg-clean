import { createHash } from 'node:crypto';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import {
  isKnowledgeVisibleToInstitution,
  type PlatformKnowledgeFileRepositoryRecord,
  type PlatformKnowledgeFileStorage,
} from '@/modules/open-platform/server/platform-knowledge-file-management-service';

export const PLATFORM_KNOWLEDGE_PARSE_CHUNK_MAX_CHARS = 120;
export const PLATFORM_KNOWLEDGE_PARSER_VERSION = 'local-text-parser-v1';

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

const supportedTextExtensions = new Set(['.txt', '.md', '.csv']);
const unsupportedSafeFailureMessage = '当前文件类型暂未接入解析器';

function normalizeRequired(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function extensionOf(filename: string) {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return filename.slice(dotIndex).toLowerCase();
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

function normalizeExtractedText(content: Uint8Array) {
  return new TextDecoder('utf-8').decode(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
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

  const chunks: PlatformKnowledgeFileParseChunkRecord[] = [];
  for (let start = 0; start < input.text.length; start += PLATFORM_KNOWLEDGE_PARSE_CHUNK_MAX_CHARS) {
    const textPreview = input.text.slice(start, start + PLATFORM_KNOWLEDGE_PARSE_CHUNK_MAX_CHARS);
    const chunkIndex = chunks.length;
    chunks.push({
      chunkId: chunkId({ ...input, chunkIndex }),
      tenantId: input.tenantId,
      knowledgeId: input.knowledgeId,
      fileId: input.fileId,
      chunkIndex,
      textPreview,
      charCount: textPreview.length,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  return chunks;
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

  if (!supportedTextExtensions.has(extensionOf(found.file.originalFilename))) {
    const parse = await input.repository.saveKnowledgeFileParseResult({
      ...baseRecord,
      parseStatus: 'failed',
      failureReasonCode: 'unsupported_file_type',
      safeFailureMessage: unsupportedSafeFailureMessage,
      textContent: '',
      textLength: 0,
      chunkCount: 0,
    });
    await input.repository.replaceKnowledgeFileParseChunks({
      tenantId,
      knowledgeId,
      fileId,
      chunks: [],
    });

    return { status: 'failed' as const, parse: mapParseRecord(parse) };
  }

  const textContent = normalizeExtractedText(await input.storage.read({ storageKey: found.file.storageKey }));
  const chunks = splitTextIntoChunks({ tenantId, knowledgeId, fileId, text: textContent, now });
  const parse = await input.repository.saveKnowledgeFileParseResult({
    ...baseRecord,
    parseStatus: 'succeeded',
    failureReasonCode: null,
    safeFailureMessage: null,
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
