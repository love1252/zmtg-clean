import type {
  V1KnowledgeBaseRuntimeFoundationReadonlySummary,
  V1KnowledgeBaseRuntimeFoundationStatus,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';
import type {
  V1KnowledgeBaseRuntimeFoundationCreateChunkInput,
  V1KnowledgeBaseRuntimeFoundationCreateDocumentInput,
  V1KnowledgeBaseRuntimeFoundationCreateIndexJobInput,
  V1KnowledgeBaseRuntimeFoundationCreateSourceInput,
  V1KnowledgeBaseRuntimeFoundationRepository,
} from '@/modules/knowledge-base/server/v1-knowledge-base-runtime-foundation-repository';

export type V1KnowledgeBaseRuntimeFoundationPolicy = {
  featureEnabled: boolean;
  canReadKnowledgeBaseRuntimeFoundation: boolean;
  tenantScopeMatched: boolean;
  institutionScopeMatched: boolean;
  workspaceScopeMatched: boolean;
  tenantId?: string;
  institutionId?: string;
  workspaceId?: string;
};

type V1KnowledgeBaseRuntimeFoundationReadonlyServiceInput = {
  policy: V1KnowledgeBaseRuntimeFoundationPolicy;
  repository: Pick<V1KnowledgeBaseRuntimeFoundationRepository, 'listReadonlySummaries'>;
};

export type V1KnowledgeBaseRuntimeFoundationDemoRecordsInput = {
  source?: V1KnowledgeBaseRuntimeFoundationCreateSourceInput;
  document?: V1KnowledgeBaseRuntimeFoundationCreateDocumentInput;
  chunk?: V1KnowledgeBaseRuntimeFoundationCreateChunkInput;
  indexJob?: V1KnowledgeBaseRuntimeFoundationCreateIndexJobInput;
};

type V1KnowledgeBaseRuntimeFoundationDemoRecordsServiceInput = {
  repository: Pick<
    V1KnowledgeBaseRuntimeFoundationRepository,
    'createDemoSource' | 'createDemoDocument' | 'createDemoChunk' | 'createDemoIndexJob'
  >;
  input: V1KnowledgeBaseRuntimeFoundationDemoRecordsInput;
};

type V1KnowledgeBaseRuntimeFoundationDemoRecordsServiceResult =
  | {
      status: 'created';
      source?: Awaited<ReturnType<V1KnowledgeBaseRuntimeFoundationRepository['createDemoSource']>>;
      document?: Awaited<
        ReturnType<V1KnowledgeBaseRuntimeFoundationRepository['createDemoDocument']>
      >;
      chunk?: Awaited<ReturnType<V1KnowledgeBaseRuntimeFoundationRepository['createDemoChunk']>>;
      indexJob?: Awaited<
        ReturnType<V1KnowledgeBaseRuntimeFoundationRepository['createDemoIndexJob']>
      >;
    }
  | { status: 'rejected_non_demo_input' }
  | { status: 'validation_failed' };

const notAvailable = 'not_available';

function baseSummary(
  policy: V1KnowledgeBaseRuntimeFoundationPolicy,
  status: V1KnowledgeBaseRuntimeFoundationStatus,
): V1KnowledgeBaseRuntimeFoundationReadonlySummary {
  return {
    status,
    readonly: true,
    tenantId: policy.tenantId ?? notAvailable,
    institutionId: policy.institutionId ?? notAvailable,
    workspaceId: policy.workspaceId ?? notAvailable,
    sourceCount: 0,
    documentCount: 0,
    chunkCount: 0,
    indexJobCount: 0,
    sourceSummaries: [],
    documentSummaries: [],
    chunkSummaries: [],
    indexJobSummaries: [],
    riskFlags:
      status === 'empty' ? ['knowledge_base_foundation_empty'] : [],
    recommendedReadonlyActions:
      status === 'empty' ? ['review_knowledge_base_foundation_readonly'] : [],
  };
}

function hasPolicyScope(policy: V1KnowledgeBaseRuntimeFoundationPolicy): policy is
  V1KnowledgeBaseRuntimeFoundationPolicy & {
    tenantId: string;
    institutionId: string;
    workspaceId: string;
  } {
  return (
    typeof policy.tenantId === 'string' &&
    policy.tenantId.trim().length > 0 &&
    typeof policy.institutionId === 'string' &&
    policy.institutionId.trim().length > 0 &&
    typeof policy.workspaceId === 'string' &&
    policy.workspaceId.trim().length > 0
  );
}

function isDemoSourceKind(sourceKind: unknown): boolean {
  return sourceKind === 'mock' || sourceKind === 'seed' || sourceKind === 'demo';
}

function allProvidedInputsAreDemo(input: V1KnowledgeBaseRuntimeFoundationDemoRecordsInput): boolean {
  return [input.source, input.document, input.chunk, input.indexJob]
    .filter((record) => record !== undefined)
    .every((record) => isDemoSourceKind(record.sourceKind));
}

function anyProvidedInput(input: V1KnowledgeBaseRuntimeFoundationDemoRecordsInput): boolean {
  return [input.source, input.document, input.chunk, input.indexJob].some(
    (record) => record !== undefined,
  );
}

export async function getV1KnowledgeBaseRuntimeFoundationReadonlyService(
  input: V1KnowledgeBaseRuntimeFoundationReadonlyServiceInput,
): Promise<V1KnowledgeBaseRuntimeFoundationReadonlySummary> {
  const { policy } = input;

  if (!policy.featureEnabled) {
    return baseSummary(policy, 'disabled');
  }

  if (
    !policy.canReadKnowledgeBaseRuntimeFoundation ||
    !policy.tenantScopeMatched ||
    !policy.institutionScopeMatched ||
    !policy.workspaceScopeMatched ||
    !hasPolicyScope(policy)
  ) {
    return baseSummary(policy, 'denied');
  }

  return input.repository.listReadonlySummaries({
    tenantId: policy.tenantId,
    institutionId: policy.institutionId,
    workspaceId: policy.workspaceId,
  });
}

export async function createV1KnowledgeBaseRuntimeFoundationDemoRecordsService(
  input: V1KnowledgeBaseRuntimeFoundationDemoRecordsServiceInput,
): Promise<V1KnowledgeBaseRuntimeFoundationDemoRecordsServiceResult> {
  if (!anyProvidedInput(input.input)) {
    return { status: 'validation_failed' };
  }

  if (!allProvidedInputsAreDemo(input.input)) {
    return { status: 'rejected_non_demo_input' };
  }

  const result: Extract<
    V1KnowledgeBaseRuntimeFoundationDemoRecordsServiceResult,
    { status: 'created' }
  > = { status: 'created' };

  if (input.input.source !== undefined) {
    const source = await input.repository.createDemoSource(input.input.source);
    if (source.status !== 'created') return { status: source.status };
    result.source = source;
  }

  if (input.input.document !== undefined) {
    const document = await input.repository.createDemoDocument(input.input.document);
    if (document.status !== 'created') return { status: document.status };
    result.document = document;
  }

  if (input.input.chunk !== undefined) {
    const chunk = await input.repository.createDemoChunk(input.input.chunk);
    if (chunk.status !== 'created') return { status: chunk.status };
    result.chunk = chunk;
  }

  if (input.input.indexJob !== undefined) {
    const indexJob = await input.repository.createDemoIndexJob(input.input.indexJob);
    if (indexJob.status !== 'created') return { status: indexJob.status };
    result.indexJob = indexJob;
  }

  return result;
}
