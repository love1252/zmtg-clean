import {
  downloadPlatformKnowledgeFileService,
  isKnowledgeVisibleToInstitution,
  listPlatformKnowledgeFilesService,
  type PlatformKnowledgeFileRepository,
  type PlatformKnowledgeFileServiceParams,
  type PlatformKnowledgeFileStorage,
} from '@/modules/open-platform/server/platform-knowledge-file-management-service';

export type InstitutionKnowledgeFileServiceParams = PlatformKnowledgeFileServiceParams & {
  institutionId?: string | null;
};

function normalizeRequired(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function findVisibleKnowledge(input: {
  repository: Pick<PlatformKnowledgeFileRepository, 'findKnowledgeItem'>;
  tenantId: string;
  institutionId: string;
  knowledgeId: string;
}) {
  const knowledge = await input.repository.findKnowledgeItem({
    tenantId: input.tenantId,
    knowledgeId: input.knowledgeId,
  });
  if (!knowledge) return { status: 'not_found' as const };
  if (!isKnowledgeVisibleToInstitution(knowledge, input.institutionId)) {
    return { status: 'forbidden' as const };
  }

  return { status: 'visible' as const, knowledge };
}

export async function listInstitutionKnowledgeFilesService(input: {
  repository: Pick<PlatformKnowledgeFileRepository, 'findKnowledgeItem' | 'listKnowledgeFiles'>;
  params: InstitutionKnowledgeFileServiceParams;
}) {
  const tenantId = normalizeRequired(input.params.tenantId);
  const institutionId = normalizeRequired(input.params.institutionId);
  const knowledgeId = normalizeRequired(input.params.knowledgeId);
  if (!tenantId || !institutionId || !knowledgeId) {
    return { status: 'validation_failed' as const };
  }

  const visible = await findVisibleKnowledge({
    repository: input.repository,
    tenantId,
    institutionId,
    knowledgeId,
  });
  if (visible.status !== 'visible') return { status: visible.status };

  const response = await listPlatformKnowledgeFilesService({
    repository: input.repository,
    params: {
      ...input.params,
      tenantId,
      knowledgeId,
      status: 'active',
    },
  });
  if ('status' in response) return response;

  return {
    ...response,
    requestId: 'institution-knowledge-management-files' as const,
    readonly: true as const,
  };
}

export async function downloadInstitutionKnowledgeFileService(input: {
  repository: Pick<PlatformKnowledgeFileRepository, 'findKnowledgeItem' | 'findKnowledgeFile'>;
  storage: PlatformKnowledgeFileStorage;
  input: {
    tenantId?: string | null;
    institutionId?: string | null;
    knowledgeId?: string | null;
    fileId?: string | null;
  };
}) {
  const tenantId = normalizeRequired(input.input.tenantId);
  const institutionId = normalizeRequired(input.input.institutionId);
  const knowledgeId = normalizeRequired(input.input.knowledgeId);
  const fileId = normalizeRequired(input.input.fileId);
  if (!tenantId || !institutionId || !knowledgeId || !fileId) {
    return { status: 'validation_failed' as const };
  }

  const visible = await findVisibleKnowledge({
    repository: input.repository,
    tenantId,
    institutionId,
    knowledgeId,
  });
  if (visible.status !== 'visible') return { status: visible.status };

  return downloadPlatformKnowledgeFileService({
    repository: input.repository,
    storage: input.storage,
    input: { tenantId, knowledgeId, fileId },
  });
}
