import {
  ensureInstitutionCanReadParsedFile,
  getPlatformKnowledgeDocumentFileParseStatusService,
  listPlatformKnowledgeDocumentFileChunksService,
  parsePlatformKnowledgeDocumentFileService,
  type PlatformKnowledgeDocumentParsingRepository,
} from '@/modules/open-platform/server/platform-knowledge-document-parsing-service';
import type { PlatformKnowledgeFileStorage } from '@/modules/open-platform/server/platform-knowledge-file-management-service';

type InstitutionParsingRepository = Pick<
  PlatformKnowledgeDocumentParsingRepository,
  'findKnowledgeItem' | 'findKnowledgeFile' | 'findKnowledgeFileParse' | 'listKnowledgeFileParseChunks'
>;

type InstitutionParseInput = {
  repository: InstitutionParsingRepository;
  input: {
    tenantId?: string | null;
    institutionId?: string | null;
    knowledgeId?: string | null;
    fileId?: string | null;
  };
};

type InstitutionReparseInput = {
  repository: PlatformKnowledgeDocumentParsingRepository;
  storage: Pick<PlatformKnowledgeFileStorage, 'read'>;
  input: InstitutionParseInput['input'];
};

function canReparseInstitutionFile(filename: string) {
  const normalized = filename.trim().toLowerCase();
  return normalized.endsWith('.txt') || normalized.endsWith('.md');
}

export async function getInstitutionKnowledgeDocumentFileParseStatusService(
  input: InstitutionParseInput,
) {
  const visible = await ensureInstitutionCanReadParsedFile(input);
  if (visible.status !== 'visible') return { status: visible.status };

  return getPlatformKnowledgeDocumentFileParseStatusService({
    repository: input.repository,
    input: {
      tenantId: visible.tenantId,
      knowledgeId: visible.knowledgeId,
      fileId: visible.fileId,
    },
  });
}

export async function listInstitutionKnowledgeDocumentFileChunksService(
  input: InstitutionParseInput,
) {
  const visible = await ensureInstitutionCanReadParsedFile(input);
  if (visible.status !== 'visible') return { status: visible.status };

  const response = await listPlatformKnowledgeDocumentFileChunksService({
    repository: input.repository,
    input: {
      tenantId: visible.tenantId,
      knowledgeId: visible.knowledgeId,
      fileId: visible.fileId,
    },
  });
  if ('status' in response) return response;

  return {
    ...response,
    requestId: 'institution-knowledge-document-file-parse-chunks' as const,
    readonly: true as const,
  };
}

export async function reparseInstitutionKnowledgeDocumentFileService(
  input: InstitutionReparseInput,
) {
  const visible = await ensureInstitutionCanReadParsedFile(input);
  if (visible.status !== 'visible') return { status: visible.status };

  const file = await input.repository.findKnowledgeFile({
    tenantId: visible.tenantId,
    knowledgeId: visible.knowledgeId,
    fileId: visible.fileId,
  });
  if (!file) return { status: 'not_found' as const };
  if (!canReparseInstitutionFile(file.originalFilename)) {
    return {
      status: 'validation_failed' as const,
      message: '当前仅支持 .txt / .md 文件重新解析；PDF / Word / Excel 仍不做深度解析',
    };
  }

  return parsePlatformKnowledgeDocumentFileService({
    repository: input.repository,
    storage: input.storage,
    input: {
      tenantId: visible.tenantId,
      knowledgeId: visible.knowledgeId,
      fileId: visible.fileId,
    },
  });
}
