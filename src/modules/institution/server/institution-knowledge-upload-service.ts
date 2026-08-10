import { createHash, randomUUID } from 'node:crypto';
import { type PlatformKnowledgeFileDto, type PlatformKnowledgeFileRepository, type PlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import { type PlatformKnowledgeDocumentParsingRepository, type PlatformKnowledgeFileParseDto, type PlatformKnowledgeFileParseRecord } from '@/modules/open-platform/server/platform-knowledge-document-parsing-service';
import type { PlatformKnowledgeFileParseStatus } from '@/modules/open-platform/server/platform-knowledge-document-parsing-service';
import { checkTenantQuotaForUsage } from '@/modules/institution/server/tenant-quota-enforcement';
import { createKnowledgeQuotaWriter } from '@/server/orchestration/knowledge-quota-writer';
import type { TenantDatabase } from '@/server/db/client';
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
  status: 'created' | 'validation_failed' | 'quota_exceeded' | 'not_found' | 'service_unavailable';
  code?: string;
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
  database: TenantDatabase;
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
  ['.png', ['image/png']],
  ['.jpg', ['image/jpeg']],
  ['.jpeg', ['image/jpeg']],
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

function ocrStatusFromFailureReason(value: string | null | undefined): PlatformKnowledgeFileDto['ocrStatus'] {
  if (!value?.startsWith('ocr_')) return 'pending';
  if (value === 'ocr_required') return 'ocr_required';
  if (value === 'ocr_unsupported_file_type') return 'unsupported';
  return 'failed';
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
      message: '文件类型暂不支持，当前支持 TXT、MD、PDF、DOCX、XLSX、CSV、PNG、JPG 格式',
    };
  }

  const mimeType = file.type.trim().toLowerCase() || institutionAllowedFiles.get(ext)?.[0] || 'text/plain';
  if (!isAllowedFileType({ filename: originalFilename, mimeType })) {
    return {
      status: 'validation_failed',
      message: '文件类型暂不支持，当前支持 TXT、MD、PDF、DOCX、XLSX、CSV、PNG、JPG 格式',
    };
  }

  if (file.size <= 0) {
    return { status: 'validation_failed', message: '文件内容不能为空' };
  }

  const quotaWriter = createKnowledgeQuotaWriter(input.database);
  const quotaScope = {
    kind: 'institution' as const,
    tenantId,
    institutionId,
  };
  const fileSizeMb = Math.max(1, Math.ceil(file.size / 1024 / 1024));
  const uploadQuotaChecks = [
    {
      resourceKey: 'knowledge_items' as const,
      quantity: 1,
      message: '知识库条目数量已达到当前套餐上限，请联系平台管理员调整套餐',
    },
    {
      resourceKey: 'knowledge_files' as const,
      quantity: 1,
      message: '知识库文件数量已达到当前套餐上限，请联系平台管理员调整套餐',
    },
    {
      resourceKey: 'knowledge_single_file_size_mb' as const,
      quantity: fileSizeMb,
      message: '文件大小已超过当前套餐单文件上限，请联系平台管理员调整套餐',
    },
    {
      resourceKey: 'knowledge_total_storage_mb' as const,
      quantity: fileSizeMb,
      message: '知识库总容量已达到当前套餐上限，请联系平台管理员调整套餐',
    },
  ];

  for (const quotaCheck of uploadQuotaChecks) {
    const decision = await checkTenantQuotaForUsage({
      database: input.database,
      tenantId,
      resource: quotaCheck.resourceKey,
      quantity: quotaCheck.quantity,
    });
    await quotaWriter.recordDecision({
      scope: quotaScope,
actorUserId: uploadedByUserId,
      resourceKey: quotaCheck.resourceKey,
      action: 'upload_file',
      decision,
      quantity: quotaCheck.quantity,
    });
    if (!decision.allowed) {
      return { status: 'validation_failed', message: quotaCheck.message };
    }
  }

  // 3. 读取文件内容并上传到存储
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (buffer.byteLength <= 0) {
    return { status: 'validation_failed', message: '文件内容不能为空' };
  }
  const actualFileSizeMb = Math.max(1, Math.ceil(buffer.byteLength / 1024 / 1024));
  if (actualFileSizeMb > fileSizeMb) {
    for (const quotaCheck of [
      {
        resourceKey: 'knowledge_single_file_size_mb' as const,
        quantity: actualFileSizeMb,
        message: '文件大小已超过当前套餐单文件上限，请联系平台管理员调整套餐',
      },
      {
        resourceKey: 'knowledge_total_storage_mb' as const,
        quantity: actualFileSizeMb,
        message: '知识库总容量已达到当前套餐上限，请联系平台管理员调整套餐',
      },
    ]) {
      const decision = await checkTenantQuotaForUsage({
        database: input.database,
        tenantId,
        resource: quotaCheck.resourceKey,
        quantity: quotaCheck.quantity,
      });
      await quotaWriter.recordDecision({
      scope: quotaScope,
actorUserId: uploadedByUserId,
        resourceKey: quotaCheck.resourceKey,
        action: 'upload_file',
        decision,
        quantity: quotaCheck.quantity,
      });
      if (!decision.allowed) {
        return { status: 'quota_exceeded', code: decision.reason, message: quotaCheck.message };
      }
    }
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
      ocrStatus: 'pending',
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
    database: input.database,
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
  await quotaWriter.recordOutcome({
    scope: quotaScope,
actorUserId: uploadedByUserId,
    resourceKey: 'knowledge_files',
    action: 'upload_file',
    status: 'succeeded',
    quantity: 1,
  });
  await quotaWriter.recordOutcome({
    scope: quotaScope,
actorUserId: uploadedByUserId,
    resourceKey: 'knowledge_total_storage_mb',
    action: 'upload_file',
    status: 'succeeded',
    quantity: actualFileSizeMb,
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
        ocrStatus: ocrStatusFromFailureReason(parse.failureReasonCode),
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
        ocrStatus: ocrStatusFromFailureReason(parse.failureReasonCode),
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
    file: {
      ...fileRecord,
      parseStatus: parse?.parseStatus ?? 'pending',
      ocrStatus: ocrStatusFromFailureReason(parse?.failureReasonCode),
    },
    parse,
    parseStatus: parse?.parseStatus ?? 'pending',
    chunkCount: parse?.chunkCount ?? 0,
  };
}
