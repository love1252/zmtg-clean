import { createHash, randomUUID } from 'node:crypto';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { normalizePageParams } from '@/modules/open-platform/server/platformKnowledgeManagementApiContract';

export const PLATFORM_KNOWLEDGE_FILE_MAX_BYTES = 20 * 1024 * 1024;

export type PlatformKnowledgeFileStatus = 'active' | 'archived';

export type PlatformKnowledgeUploadFileLike = {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer | SharedArrayBuffer>;
};

export type PlatformKnowledgeFileRepositoryRecord = {
  fileId: string;
  tenantId: string;
  knowledgeId: string;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status: PlatformKnowledgeFileStatus;
  uploadedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type PlatformKnowledgeFileDto = Omit<PlatformKnowledgeFileRepositoryRecord, 'storageKey'> & {
  fileType: string;
  sizeLabel: string;
};

export type PlatformKnowledgeFileListResponse = {
  requestId: 'platform-knowledge-management-files';
  dataSource: 'repository';
  records: PlatformKnowledgeFileDto[];
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  emptyState: {
    title: string;
    description: string;
  };
};

export type PlatformKnowledgeFileRepository = {
  findKnowledgeItem(input: { tenantId: string; knowledgeId: string }): Promise<PlatformKnowledgeRepositoryRecord | null>;
  listKnowledgeFiles(input: {
    tenantId: string;
    knowledgeId: string;
  }): Promise<PlatformKnowledgeFileRepositoryRecord[]>;
  findKnowledgeFile(input: {
    tenantId: string;
    knowledgeId: string;
    fileId: string;
  }): Promise<PlatformKnowledgeFileRepositoryRecord | null>;
  createKnowledgeFile(
    input: PlatformKnowledgeFileRepositoryRecord,
  ): Promise<PlatformKnowledgeFileRepositoryRecord>;
  archiveKnowledgeFile(input: {
    tenantId: string;
    knowledgeId: string;
    fileId: string;
  }): Promise<PlatformKnowledgeFileRepositoryRecord | null>;
};

export type PlatformKnowledgeFileStorage = {
  save(input: {
    tenantId: string;
    knowledgeId: string;
    fileId: string;
    originalFilename: string;
    mimeType: string;
    content: Uint8Array;
  }): Promise<{
    storageKey: string;
    sha256: string;
    sizeBytes: number;
  }>;
  read(input: { storageKey: string }): Promise<Uint8Array>;
  delete(input: { storageKey: string }): Promise<void>;
};

export type PlatformKnowledgeFileServiceParams = {
  tenantId?: string | null;
  knowledgeId?: string | null;
  status?: string | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

type PlatformKnowledgeUploadInput = {
  repository: PlatformKnowledgeFileRepository;
  storage: PlatformKnowledgeFileStorage;
  input: {
    tenantId?: string | null;
    knowledgeId?: string | null;
    uploadedByUserId?: string | null;
    file: PlatformKnowledgeUploadFileLike | null;
  };
};

type PlatformKnowledgeFileCommandInput = {
  repository: Pick<PlatformKnowledgeFileRepository, 'archiveKnowledgeFile' | 'findKnowledgeItem' | 'findKnowledgeFile'>;
  input: {
    tenantId?: string | null;
    knowledgeId?: string | null;
    fileId?: string | null;
  };
};

type PlatformKnowledgeFileDownloadInput = {
  repository: Pick<PlatformKnowledgeFileRepository, 'findKnowledgeItem' | 'findKnowledgeFile'>;
  storage: PlatformKnowledgeFileStorage;
  input: {
    tenantId?: string | null;
    knowledgeId?: string | null;
    fileId?: string | null;
  };
};

const allowedFiles = new Map<string, readonly string[]>([
  ['.pdf', ['application/pdf']],
  ['.docx', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
  ['.txt', ['text/plain']],
  ['.md', ['text/markdown', 'text/plain']],
  ['.csv', ['text/csv', 'application/csv', 'application/vnd.ms-excel']],
  ['.xlsx', ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']],
]);

const emptyState = {
  title: '暂无知识库文件',
  description: '当前知识库暂未上传可管理文件。',
};

function normalizeRequired(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeDisplayFilename(name: string) {
  const normalizedSeparators = name.replace(/\\/g, '/');
  const basename = normalizedSeparators.split('/').filter(Boolean).at(-1) ?? 'knowledge-file';
  const sanitized = basename.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return sanitized || 'knowledge-file';
}

function extensionOf(filename: string) {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return filename.slice(dotIndex).toLowerCase();
}

function validateFile(file: PlatformKnowledgeUploadFileLike | null) {
  if (!file) return { ok: false as const, message: '请选择要上传的文件' };

  const originalFilename = sanitizeDisplayFilename(file.name);
  if (originalFilename.length > 255) {
    return { ok: false as const, message: '文件名过长' };
  }

  const extension = extensionOf(originalFilename);
  const allowedMimeTypes = allowedFiles.get(extension);
  if (!allowedMimeTypes) {
    return { ok: false as const, message: '文件类型暂不支持' };
  }

  const normalizedMimeType = file.type.trim().toLowerCase();
  if (normalizedMimeType && !allowedMimeTypes.includes(normalizedMimeType)) {
    return { ok: false as const, message: '文件类型暂不支持' };
  }

  if (file.size > PLATFORM_KNOWLEDGE_FILE_MAX_BYTES) {
    return { ok: false as const, message: '文件大小不能超过 20MB' };
  }
  if (file.size <= 0) {
    return { ok: false as const, message: '文件内容不能为空' };
  }

  return {
    ok: true as const,
    originalFilename,
    extension,
    mimeType: normalizedMimeType || allowedMimeTypes[0],
  };
}

function sizeLabel(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / 1024 / 1024).toFixed(sizeBytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }
  if (sizeBytes >= 1024) {
    return `${Math.ceil(sizeBytes / 1024)} KB`;
  }
  return `${sizeBytes} B`;
}

function mapFileRecordToDto(record: PlatformKnowledgeFileRepositoryRecord): PlatformKnowledgeFileDto {
  const { storageKey: _storageKey, ...safeRecord } = record;
  return {
    ...safeRecord,
    fileType: extensionOf(record.originalFilename).replace('.', '').toUpperCase(),
    sizeLabel: sizeLabel(record.sizeBytes),
  };
}

function buildListResponse(
  records: PlatformKnowledgeFileDto[],
  page: number,
  pageSize: number,
): PlatformKnowledgeFileListResponse {
  const total = records.length;
  const pageCount = Math.ceil(total / pageSize);
  const safePage = pageCount > 0 ? Math.min(page, pageCount) : page;
  const start = (safePage - 1) * pageSize;

  return {
    requestId: 'platform-knowledge-management-files',
    dataSource: 'repository',
    records: records.slice(start, start + pageSize),
    pageInfo: {
      page: safePage,
      pageSize,
      total,
      pageCount,
      hasPreviousPage: safePage > 1 && total > 0,
      hasNextPage: safePage < pageCount,
    },
    emptyState,
  };
}

function normalizeStatus(value: string | null | undefined) {
  const normalized = normalizeRequired(value);
  if (normalized === 'active' || normalized === 'archived') return normalized;
  return null;
}

async function ensureKnowledgeInTenant(
  repository: Pick<PlatformKnowledgeFileRepository, 'findKnowledgeItem'>,
  input: { tenantId: string; knowledgeId: string },
) {
  return repository.findKnowledgeItem(input);
}

export async function uploadPlatformKnowledgeFileService(input: PlatformKnowledgeUploadInput) {
  const tenantId = normalizeRequired(input.input.tenantId);
  const knowledgeId = normalizeRequired(input.input.knowledgeId);
  const uploadedByUserId = normalizeRequired(input.input.uploadedByUserId) ?? 'platform-system';
  if (!tenantId || !knowledgeId) {
    return { status: 'validation_failed' as const, message: '缺少知识库文件操作范围' };
  }

  const validated = validateFile(input.input.file);
  if (!validated.ok) {
    return { status: 'validation_failed' as const, message: validated.message };
  }
  const uploadFile = input.input.file;
  if (!uploadFile) {
    return { status: 'validation_failed' as const, message: '请选择要上传的文件' };
  }

  const knowledge = await ensureKnowledgeInTenant(input.repository, { tenantId, knowledgeId });
  if (!knowledge) return { status: 'not_found' as const };

  const buffer = new Uint8Array(await uploadFile.arrayBuffer());
  if (buffer.byteLength <= 0) {
    return { status: 'validation_failed' as const, message: '文件内容不能为空' };
  }
  if (buffer.byteLength > PLATFORM_KNOWLEDGE_FILE_MAX_BYTES) {
    return { status: 'validation_failed' as const, message: '文件大小不能超过 20MB' };
  }

  const fileId = `kb-file-${randomUUID()}`;
  const saved = await input.storage.save({
    tenantId,
    knowledgeId,
    fileId,
    originalFilename: validated.originalFilename,
    mimeType: validated.mimeType,
    content: buffer,
  });
  const now = new Date();
  let record: PlatformKnowledgeFileRepositoryRecord;
  try {
    record = await input.repository.createKnowledgeFile({
      fileId,
      tenantId,
      knowledgeId,
      originalFilename: validated.originalFilename,
      storageKey: saved.storageKey,
      mimeType: validated.mimeType,
      sizeBytes: saved.sizeBytes,
      sha256: saved.sha256,
      status: 'active',
      uploadedByUserId,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    });
  } catch (error) {
    await input.storage.delete({ storageKey: saved.storageKey }).catch(() => undefined);
    throw error;
  }

  return { status: 'uploaded' as const, file: mapFileRecordToDto(record) };
}

export async function listPlatformKnowledgeFilesService(input: {
  repository: Pick<PlatformKnowledgeFileRepository, 'findKnowledgeItem' | 'listKnowledgeFiles'>;
  params: PlatformKnowledgeFileServiceParams;
}) {
  const tenantId = normalizeRequired(input.params.tenantId);
  const knowledgeId = normalizeRequired(input.params.knowledgeId);
  if (!tenantId || !knowledgeId) {
    throw new Error('tenantId 和 knowledgeId 是知识库文件查询的必填范围');
  }
  const pageParams = normalizePageParams(input.params);
  if (!pageParams.ok) {
    throw new Error(pageParams.error.error.message);
  }

  const knowledge = await ensureKnowledgeInTenant(input.repository, { tenantId, knowledgeId });
  if (!knowledge) return { status: 'not_found' as const };

  const status = normalizeStatus(input.params.status);
  const records = (await input.repository.listKnowledgeFiles({ tenantId, knowledgeId }))
    .filter((record) => record.tenantId === tenantId && record.knowledgeId === knowledgeId)
    .filter((record) => !status || record.status === status)
    .map(mapFileRecordToDto);

  return buildListResponse(records, pageParams.page, pageParams.pageSize);
}

export async function archivePlatformKnowledgeFileService(input: PlatformKnowledgeFileCommandInput) {
  const tenantId = normalizeRequired(input.input.tenantId);
  const knowledgeId = normalizeRequired(input.input.knowledgeId);
  const fileId = normalizeRequired(input.input.fileId);
  if (!tenantId || !knowledgeId || !fileId) {
    return { status: 'validation_failed' as const, message: '缺少知识库文件操作范围' };
  }

  const knowledge = await ensureKnowledgeInTenant(input.repository, { tenantId, knowledgeId });
  if (!knowledge) return { status: 'not_found' as const };

  const existing = await input.repository.findKnowledgeFile({ tenantId, knowledgeId, fileId });
  if (!existing) return { status: 'not_found' as const };

  const archived = await input.repository.archiveKnowledgeFile({ tenantId, knowledgeId, fileId });
  if (!archived) return { status: 'not_found' as const };

  return { status: 'archived' as const, file: mapFileRecordToDto(archived) };
}

export async function downloadPlatformKnowledgeFileService(input: PlatformKnowledgeFileDownloadInput) {
  const tenantId = normalizeRequired(input.input.tenantId);
  const knowledgeId = normalizeRequired(input.input.knowledgeId);
  const fileId = normalizeRequired(input.input.fileId);
  if (!tenantId || !knowledgeId || !fileId) {
    return { status: 'validation_failed' as const, message: '缺少知识库文件操作范围' };
  }

  const knowledge = await ensureKnowledgeInTenant(input.repository, { tenantId, knowledgeId });
  if (!knowledge) return { status: 'not_found' as const };

  const file = await input.repository.findKnowledgeFile({ tenantId, knowledgeId, fileId });
  if (!file || file.status !== 'active') return { status: 'not_found' as const };

  return {
    status: 'ready' as const,
    fileName: file.originalFilename,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    sha256: file.sha256,
    content: await input.storage.read({ storageKey: file.storageKey }),
  };
}

export function calculateSha256(content: Uint8Array) {
  return createHash('sha256').update(content).digest('hex');
}

export function isKnowledgeVisibleToInstitution(
  knowledge: PlatformKnowledgeRepositoryRecord,
  institutionId: string,
) {
  return (
    knowledge.institutionId === institutionId ||
    knowledge.visibleInstitutionIds.includes(institutionId)
  );
}
