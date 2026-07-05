import { createHash, randomUUID } from 'node:crypto';
import { uploadPlatformKnowledgeFileService, type PlatformKnowledgeFileDto, type PlatformKnowledgeFileRepository, type PlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import { type PlatformKnowledgeDocumentParsingRepository, type PlatformKnowledgeFileParseDto, type PlatformKnowledgeFileParseRecord } from '@/modules/open-platform/server/platform-knowledge-document-parsing-service';
import type { PlatformKnowledgeFileParseStatus } from '@/modules/open-platform/server/platform-knowledge-document-parsing-service';
import {
  createAndRunParseFileJob,
  type KnowledgeIndexingJobRepository,
} from '@/modules/open-platform/server/platform-knowledge-indexing-job-service';

export const INSTITUTION_KNOWLEDGE_FILE_MAX_BYTES = 2 * 1024 * 1024;
export type InstitutionKnowledgeUploadFileLike = {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer | SharedArrayBuffer>;
};

type InstitutionKnowledgeUploadFileDto = Omit<PlatformKnowledgeFileDto, 'createdAt' | 'updatedAt' | 'sha256'> & {
  createdAt: string;
  updatedAt: string;
};

export type InstitutionKnowledgeUploadResponse = {
  status: 'created' | 'validation_failed' | 'not_found' | 'service_unavailable';
  message?: string;
  knowledgeId?: string;
  sourceId?: string;
  file?: InstitutionKnowledgeUploadFileDto;
  parse?: PlatformKnowledgeFileParseDto | null;
  parseStatus?: PlatformKnowledgeFileParseStatus;
  chunkCount?: number;
};

export type InstitutionKnowledgeUploadRepository = Pick<
  PlatformKnowledgeFileRepository,
  'findKnowledgeItem' | 'createKnowledgeFile'
> &
  PlatformKnowledgeDocumentParsingRepository &
  KnowledgeIndexingJobRepository & {
    createInstitutionKnowledgeSource(input: {
      tenantId: string;
      institutionId: string;
      sourceLabel: string;
    }): Promise<{ sourceId: string }>;
    createInstitutionKnowledgeDocument(input: {
      tenantId: string;
      institutionId: string;
      sourceId: string;
      title: string;
    }): Promise<{ documentId: string }>;
  };

type UploadServiceInput = {
  repository: InstitutionKnowledgeUploadRepository;
  storage: PlatformKnowledgeFileStorage;
  input: {
    tenantId?: string | null;
    institutionId?: string | null;
    uploadedByUserId?: string | null;
    file: InstitutionKnowledgeUploadFileLike | null;
  };
};

const institutionAllowedFiles = new Map<string, readonly string[]>([
  ['.txt', ['text/plain']],
  ['.md', ['text/markdown', 'text/plain']],
  ['.pdf', ['application/pdf']],
  ['.docx', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
  ['.xlsx', ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']],
  ['.csv', ['text/csv', 'application/csv', 'application/vnd.ms-excel']],
]);

function normalizeRequired(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function extensionOf(filename: string) {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return filename.slice(dotIndex).toLowerCase();
}

function sanitizeDisplayName(name: string) {
  const normalizedSeparators = name.replace(/\\/g, '/');
  const basename = normalizedSeparators.split('/').filter(Boolean).at(-1) ?? 'knowledge-file';
  const sanitized = basename.replace(/[\x00-\x1f\x7f]/g, '').trim();
  return sanitized || 'knowledge-file';
}

function isAllowedFileType(input: { filename: string; mimeType: string }) {
  const ext = extensionOf(input.filename);
  const allowedMimeTypes = institutionAllowedFiles.get(ext);
  if (!allowedMimeTypes) return false;
  const normalizedMime = input.mimeType.trim().toLowerCase();
  return !normalizedMime || allowedMimeTypes.includes(normalizedMime);
}

function toParseDto(record: PlatformKnowledgeFileParseRecord): PlatformKnowledgeFileParseDto {
  return {
    parseId: record.parseId,
    tenantId: record.tenantId,
    knowledgeId: record.knowledgeId,
    fileId: record.fileId,
    parseStatus: record.parseStatus,
    failureReasonCode: record.failureReasonCode,
    safeFailureMessage: record.safeFailureMessage,
    textLength: record.textLength,
    chunkCount: record.chunkCount,
    parserVersion: record.parserVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function uploadAndParseInstitutionKnowledgeFileService(
  input: UploadServiceInput,
): Promise<InstitutionKnowledgeUploadResponse> {
  const tenantId = normalizeRequired(input.input.tenantId);
  const institutionId = normalizeRequired(input.input.institutionId);
  const uploadedByUserId = normalizeRequired(input.input.uploadedByUserId) ?? 'institution-user';

  if (!tenantId || !institutionId) {
    return { status: 'validation_failed', message: '缺少机构身份信息' };
  }

  const file = input.input.file;
  if (!file) {
    return { status: 'validation_failed', message: '请选择要上传的文件' };
  }

  const originalFilename = sanitizeDisplayName(file.name);
  if (originalFilename.length > 255) {
    return { status: 'validation_failed', message: '文件名过长' };
  }

  const ext = extensionOf(originalFilename);
  if (!ext || !institutionAllowedFiles.has(ext)) {
    return {
      status: 'validation_failed',
      message: '文件类型暂不支持，当前支持 TXT、MD、PDF、DOCX、XLSX、CSV 格式',
    };
  }

  const mimeType = file.type.trim().toLowerCase() || institutionAllowedFiles.get(ext)?.[0] || 'text/plain';
  if (!isAllowedFileType({ filename: originalFilename, mimeType })) {
    return {
      status: 'validation_failed',
      message: '文件类型暂不支持，当前支持 TXT、MD、PDF、DOCX、XLSX、CSV 格式',
    };
  }

  if (file.size > INSTITUTION_KNOWLEDGE_FILE_MAX_BYTES) {
    return { status: 'validation_failed', message: '文件大小不能超过 2MB' };
  }
  if (file.size <= 0) {
    return { status: 'validation_failed', message: '文件内容不能为空' };
  }

  // 1. 创建知识库来源
  const { sourceId } = await input.repository.createInstitutionKnowledgeSource({
    tenantId,
    institutionId,
    sourceLabel: originalFilename,
  });

  // 2. 创建知识库文档并自动绑定机构可见性
  const { documentId: knowledgeId } = await input.repository.createInstitutionKnowledgeDocument({
    tenantId,
    institutionId,
    sourceId,
    title: originalFilename,
  });

  // 3. 读取文件内容并上传到存储
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.byteLength <= 0) {
    return { status: 'validation_failed', message: '文件内容不能为空' };
  }
  if (buffer.byteLength > INSTITUTION_KNOWLEDGE_FILE_MAX_BYTES) {
    return { status: 'validation_failed', message: '文件大小不能超过 2MB' };
  }

  const fileId = `kb-file-${randomUUID()}`;
  const saved = await input.storage.save({
    tenantId,
    knowledgeId,
    fileId,
    originalFilename,
    mimeType,
    content: buffer,
  });

  const now = new Date();
  let fileRecord: InstitutionKnowledgeUploadFileDto;
  try {
    const repoRecord = await input.repository.createKnowledgeFile({
      fileId,
      tenantId,
      knowledgeId,
      originalFilename,
      storageKey: saved.storageKey,
      mimeType,
      sizeBytes: saved.sizeBytes,
      sha256: saved.sha256,
      status: 'active',
      uploadedByUserId,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
    // 将 repository record 转为 DTO
    fileRecord = {
      fileId: repoRecord.fileId,
      tenantId: repoRecord.tenantId,
      knowledgeId: repoRecord.knowledgeId,
      originalFilename: repoRecord.originalFilename,
      mimeType: repoRecord.mimeType,
      sizeBytes: repoRecord.sizeBytes,
      status: repoRecord.status,
      fileType: extensionOf(repoRecord.originalFilename).replace('.', '').toUpperCase(),
      sizeLabel:
        saved.sizeBytes >= 1024 * 1024
          ? `${(saved.sizeBytes / 1024 / 1024).toFixed(1)} MB`
          : `${Math.ceil(saved.sizeBytes / 1024)} KB`,
      parseStatus: 'pending' as PlatformKnowledgeFileParseStatus,
      failureReasonCode: null,
      safeFailureMessage: null,
      textLength: 0,
      chunkCount: 0,
      parserVersion: null,
      uploadedByUserId: repoRecord.uploadedByUserId,
      createdAt: new Date(repoRecord.createdAt as unknown as string).toISOString(),
      updatedAt: new Date(repoRecord.updatedAt as unknown as string).toISOString(),
      archivedAt: null,
    };
  } catch (error) {
    await input.storage.delete({ storageKey: saved.storageKey }).catch(() => undefined);
    throw error;
  }

  // 4. 自动创建并执行文件解析任务，同时保留同步上传响应
  const jobResult = await createAndRunParseFileJob({
    repository: input.repository,
    storage: input.storage,
    input: {
      tenantId,
      institutionId,
      actorUserId: uploadedByUserId,
      knowledgeId,
      fileId,
    },
  });
  const parseRecord = await input.repository.findKnowledgeFileParse({ tenantId, knowledgeId, fileId });
  const parse = parseRecord ? toParseDto(parseRecord) : null;

  if (jobResult.status === 'succeeded' && parse) {
    return {
      status: 'created',
      knowledgeId,
      sourceId,
      file: {
        ...fileRecord,
        parseStatus: 'succeeded',
        failureReasonCode: parse.failureReasonCode,
        safeFailureMessage: parse.safeFailureMessage,
        textLength: parse.textLength,
        chunkCount: parse.chunkCount,
        parserVersion: parse.parserVersion,
      },
      parse,
      parseStatus: 'succeeded',
      chunkCount: parse.chunkCount,
    };
  }

  if (parse?.parseStatus === 'failed') {
    return {
      status: 'created',
      knowledgeId,
      sourceId,
      file: {
        ...fileRecord,
        parseStatus: 'failed',
        failureReasonCode: parse.failureReasonCode,
        safeFailureMessage: parse.safeFailureMessage,
      },
      parse,
      parseStatus: 'failed',
      chunkCount: 0,
    };
  }

  return {
    status: 'created',
    knowledgeId,
    sourceId,
    file: { ...fileRecord, parseStatus: parse?.parseStatus ?? 'pending' },
    parse,
    parseStatus: parse?.parseStatus ?? 'pending',
    chunkCount: parse?.chunkCount ?? 0,
  };
}
