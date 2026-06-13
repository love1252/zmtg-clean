import {
  ensureInstitutionCanReadParsedFile,
  getPlatformKnowledgeDocumentFileParseStatusService,
  listPlatformKnowledgeDocumentFileChunksService,
  type PlatformKnowledgeDocumentParsingRepository,
} from '@/modules/open-platform/server/platform-knowledge-document-parsing-service';

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
