export type V1KnowledgeBaseRuntimeFoundationSourceKind =
  | 'mock'
  | 'seed'
  | 'demo'
  | 'institution_upload';
export type V1KnowledgeBaseRuntimeFoundationStatus =
  | 'disabled'
  | 'denied'
  | 'empty'
  | 'pending'
  | 'ready'
  | 'failed';
export type V1KnowledgeBaseRuntimeFoundationReadonlyStatus = 'readonly' | 'blocked';

export type V1KnowledgeBaseRuntimeFoundationSourceSummary = {
  sourceId: string;
  sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  label: string;
  readonly: true;
};

export type V1KnowledgeBaseRuntimeFoundationDocumentSummary = {
  documentId: string;
  sourceId: string;
  sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  title: string;
  version: string;
  readonly: true;
};

export type V1KnowledgeBaseRuntimeFoundationChunkSummary = {
  chunkId: string;
  documentId: string;
  sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  label: string;
  chunkIndex: number;
  readonly: true;
};

export type V1KnowledgeBaseRuntimeFoundationIndexJobSummary = {
  jobId: string;
  documentId: string;
  sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  jobKind: string;
  readonly: true;
};

export type V1KnowledgeBaseRuntimeFoundationReadonlySummary = {
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonly: true;
  tenantId: string;
  institutionId: string;
  workspaceId: string;
  sourceCount: number;
  documentCount: number;
  chunkCount: number;
  indexJobCount: number;
  sourceSummaries: V1KnowledgeBaseRuntimeFoundationSourceSummary[];
  documentSummaries: V1KnowledgeBaseRuntimeFoundationDocumentSummary[];
  chunkSummaries: V1KnowledgeBaseRuntimeFoundationChunkSummary[];
  indexJobSummaries: V1KnowledgeBaseRuntimeFoundationIndexJobSummary[];
  riskFlags: readonly string[];
  recommendedReadonlyActions: readonly string[];
};

export type V1KnowledgeBaseRuntimeFoundationApiMapperInput = {
  requestId?: string;
  summary: V1KnowledgeBaseRuntimeFoundationReadonlySummary;
};

export type V1KnowledgeBaseRuntimeFoundationApiSource = {
  sourceId: string;
  sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  label: string;
  readonly: true;
};

export type V1KnowledgeBaseRuntimeFoundationApiDocument = {
  documentId: string;
  sourceId: string;
  sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  title: string;
  version: string;
  readonly: true;
};

export type V1KnowledgeBaseRuntimeFoundationApiChunk = {
  chunkId: string;
  documentId: string;
  sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  label: string;
  chunkIndex: number;
  readonly: true;
};

export type V1KnowledgeBaseRuntimeFoundationApiIndexJob = {
  jobId: string;
  documentId: string;
  sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  readonlyStatus: V1KnowledgeBaseRuntimeFoundationReadonlyStatus;
  jobKind: string;
  readonly: true;
};

export type V1KnowledgeBaseRuntimeFoundationApiResponse = {
  requestId: string;
  tenantId: string;
  institutionId: string;
  workspaceId: string;
  status: V1KnowledgeBaseRuntimeFoundationStatus;
  summary: {
    title: '知识库 runtime foundation 只读契约';
    statusText: string;
    sourceCount: number;
    documentCount: number;
    chunkCount: number;
    indexJobCount: number;
  };
  sources: V1KnowledgeBaseRuntimeFoundationApiSource[];
  documents: V1KnowledgeBaseRuntimeFoundationApiDocument[];
  chunks: V1KnowledgeBaseRuntimeFoundationApiChunk[];
  indexJobs: V1KnowledgeBaseRuntimeFoundationApiIndexJob[];
  riskFlags: readonly string[];
  recommendedReadonlyActions: readonly string[];
  readonly: true;
};

export const v1KnowledgeBaseRuntimeFoundationApiResponseFields = [
  'requestId',
  'tenantId',
  'institutionId',
  'workspaceId',
  'status',
  'summary',
  'title',
  'statusText',
  'sourceCount',
  'documentCount',
  'chunkCount',
  'indexJobCount',
  'sources',
  'sourceId',
  'sourceKind',
  'readonlyStatus',
  'label',
  'readonly',
  'documents',
  'documentId',
  'title',
  'version',
  'chunks',
  'chunkId',
  'chunkIndex',
  'indexJobs',
  'jobId',
  'jobKind',
  'riskFlags',
  'recommendedReadonlyActions',
] as const;

const defaultRequestId = 'knowledge-base-runtime-foundation-readonly-request';

function statusText(status: V1KnowledgeBaseRuntimeFoundationStatus): string {
  if (status === 'disabled') return 'disabled / skipped';
  if (status === 'denied') return 'denied / blocked';
  if (status === 'empty') return 'empty / readonly';
  if (status === 'pending') return 'pending / readonly';
  if (status === 'failed') return 'failed / readonly';

  return 'ready / readonly';
}

export function buildV1KnowledgeBaseRuntimeFoundationApiResponse(
  input: V1KnowledgeBaseRuntimeFoundationApiMapperInput,
): V1KnowledgeBaseRuntimeFoundationApiResponse {
  const { summary } = input;

  return {
    requestId: input.requestId ?? defaultRequestId,
    tenantId: summary.tenantId,
    institutionId: summary.institutionId,
    workspaceId: summary.workspaceId,
    status: summary.status,
    summary: {
      title: '知识库 runtime foundation 只读契约',
      statusText: statusText(summary.status),
      sourceCount: summary.sourceCount,
      documentCount: summary.documentCount,
      chunkCount: summary.chunkCount,
      indexJobCount: summary.indexJobCount,
    },
    sources: summary.sourceSummaries.map((source) => ({ ...source })),
    documents: summary.documentSummaries.map((document) => ({ ...document })),
    chunks: summary.chunkSummaries.map((chunk) => ({ ...chunk })),
    indexJobs: summary.indexJobSummaries.map((job) => ({ ...job })),
    riskFlags: [...summary.riskFlags],
    recommendedReadonlyActions: [...summary.recommendedReadonlyActions],
    readonly: true,
  };
}
