import type {
  V1KnowledgeBaseRuntimeFoundationChunkSummary,
  V1KnowledgeBaseRuntimeFoundationDocumentSummary,
  V1KnowledgeBaseRuntimeFoundationSourceKind,
  V1KnowledgeBaseRuntimeFoundationSourceSummary,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';
import type {
  V1KnowledgeBaseRuntimeFoundationCreateChunkInput,
  V1KnowledgeBaseRuntimeFoundationCreateDocumentInput,
  V1KnowledgeBaseRuntimeFoundationCreateSourceInput,
  V1KnowledgeBaseRuntimeFoundationRepository,
} from '@/modules/knowledge-base/server/v1-knowledge-base-runtime-foundation-repository';

export const v1KnowledgeBaseUploadParseChunkRuntimeMaxChars = 32_000;
const defaultMaxChunkChars = 800;
const defaultVersion = 'v1-demo-upload';
const notStartedIndexJobKind = 'demo_index_not_started';

export type V1KnowledgeBaseUploadParseChunkRuntimeScope = {
  tenantId: string;
  institutionId: string;
  workspaceId: string;
};

export type V1KnowledgeBaseUploadParseChunkRuntimeInput =
  V1KnowledgeBaseUploadParseChunkRuntimeScope & {
    sourceKind: V1KnowledgeBaseRuntimeFoundationSourceKind;
    fileName: string;
    mimeType: string;
    content: string;
  };

export type V1KnowledgeBaseRuntimeParsedDocument =
  | { status: 'parsed'; text: string; charLength: number }
  | { status: 'unsupported_file_type' }
  | { status: 'oversized_file' }
  | { status: 'empty_content' }
  | { status: 'parse_failed' };

export type V1KnowledgeBaseRuntimeChunk = {
  chunkIndex: number;
  chunkText: string;
  charLength: number;
};

export type V1KnowledgeBaseUploadParseChunkRuntimeRepository = Pick<
  V1KnowledgeBaseRuntimeFoundationRepository,
  'createDemoSource' | 'createDemoDocument' | 'createDemoChunk' | 'listReadonlySummaries'
>;

export type V1KnowledgeBaseUploadParseChunkRuntimeCreatedResponse =
  V1KnowledgeBaseUploadParseChunkRuntimeScope & {
    status: 'created';
    readonly: true;
    source: V1KnowledgeBaseRuntimeFoundationSourceSummary;
    document: V1KnowledgeBaseRuntimeFoundationDocumentSummary;
    chunks: Array<
      V1KnowledgeBaseRuntimeFoundationChunkSummary & {
        charLength: number;
      }
    >;
    indexJob: {
      status: 'not_started';
      jobKind: typeof notStartedIndexJobKind;
      readonly: true;
    };
  };

export type V1KnowledgeBaseUploadParseChunkRuntimeFailureResponse = {
  status:
    | 'unsupported_file_type'
    | 'oversized_file'
    | 'empty_content'
    | 'parse_failed'
    | 'validation_failed'
    | 'rejected_non_demo_input';
  readonly: true;
};

export type V1KnowledgeBaseUploadParseChunkRuntimeResponse =
  | V1KnowledgeBaseUploadParseChunkRuntimeCreatedResponse
  | V1KnowledgeBaseUploadParseChunkRuntimeFailureResponse;

export const v1KnowledgeBaseUploadParseChunkRuntimeResponseFields = [
  'status',
  'readonly',
  'tenantId',
  'institutionId',
  'workspaceId',
  'source',
  'sourceId',
  'sourceKind',
  'readonlyStatus',
  'label',
  'document',
  'documentId',
  'title',
  'version',
  'chunks',
  'chunkId',
  'chunkIndex',
  'charLength',
  'indexJob',
  'jobKind',
] as const;

function isAllowedMimeType(mimeType: string): boolean {
  return (
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    mimeType === 'application/json'
  );
}

function isAllowedSourceKind(value: unknown): value is V1KnowledgeBaseRuntimeFoundationSourceKind {
  return value === 'mock' || value === 'seed' || value === 'demo';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeTextContent(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36).padStart(6, '0');
}

function safeIdPart(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'document'
  );
}

function uploadIdPrefix(input: V1KnowledgeBaseUploadParseChunkRuntimeInput): string {
  const stablePart = stableHash(
    [
      input.tenantId,
      input.institutionId,
      input.workspaceId,
      input.sourceKind,
      input.fileName,
      input.content,
    ].join('|'),
  );

  return `${safeIdPart(input.fileName)}-${stablePart}`;
}

function validateUploadInput(
  input: V1KnowledgeBaseUploadParseChunkRuntimeInput,
): V1KnowledgeBaseUploadParseChunkRuntimeFailureResponse | null {
  if (
    !isNonEmptyString(input.tenantId) ||
    !isNonEmptyString(input.institutionId) ||
    !isNonEmptyString(input.workspaceId) ||
    !isNonEmptyString(input.fileName) ||
    !isNonEmptyString(input.mimeType) ||
    typeof input.content !== 'string'
  ) {
    return { status: 'validation_failed', readonly: true };
  }

  if (!isAllowedSourceKind(input.sourceKind)) {
    return { status: 'rejected_non_demo_input', readonly: true };
  }

  return null;
}

export function parseV1KnowledgeBaseRuntimeDocument(input: {
  fileName: string;
  mimeType: string;
  content: string;
}): V1KnowledgeBaseRuntimeParsedDocument {
  if (!isAllowedMimeType(input.mimeType)) {
    return { status: 'unsupported_file_type' };
  }

  if (input.content.length > v1KnowledgeBaseUploadParseChunkRuntimeMaxChars) {
    return { status: 'oversized_file' };
  }

  const content = normalizeTextContent(input.content);
  if (content.length === 0) {
    return { status: 'empty_content' };
  }

  if (input.mimeType === 'application/json') {
    try {
      const parsed = JSON.parse(content) as unknown;
      const text = normalizeTextContent(JSON.stringify(parsed, null, 2));
      return { status: 'parsed', text, charLength: text.length };
    } catch {
      return { status: 'parse_failed' };
    }
  }

  return { status: 'parsed', text: content, charLength: content.length };
}

export function chunkV1KnowledgeBaseRuntimeDocument(input: {
  text: string;
  maxChars?: number;
}): V1KnowledgeBaseRuntimeChunk[] {
  const maxChars = input.maxChars ?? defaultMaxChunkChars;
  const paragraphs = input.text
    .split(/\n{2,}/)
    .map((paragraph) => normalizeTextContent(paragraph))
    .filter((paragraph) => paragraph.length > 0);
  const chunks: string[] = [];

  paragraphs.forEach((paragraph) => {
    if (paragraph.length <= maxChars) {
      chunks.push(paragraph);
      return;
    }

    for (let start = 0; start < paragraph.length; start += maxChars) {
      chunks.push(paragraph.slice(start, start + maxChars));
    }
  });

  return chunks.map((chunkText, chunkIndex) => ({
    chunkIndex,
    chunkText,
    charLength: chunkText.length,
  }));
}

async function createChunkRecords(input: {
  repository: V1KnowledgeBaseUploadParseChunkRuntimeRepository;
  upload: V1KnowledgeBaseUploadParseChunkRuntimeInput;
  documentId: string;
  prefix: string;
  chunks: V1KnowledgeBaseRuntimeChunk[];
}) {
  const records: V1KnowledgeBaseUploadParseChunkRuntimeCreatedResponse['chunks'] = [];

  for (const chunk of input.chunks) {
    const created = await input.repository.createDemoChunk({
      id: `kb-chunk-${input.prefix}-${chunk.chunkIndex}`,
      tenantId: input.upload.tenantId,
      institutionId: input.upload.institutionId,
      workspaceId: input.upload.workspaceId,
      documentId: input.documentId,
      sourceKind: input.upload.sourceKind,
      chunkLabel: `chunk:${chunk.chunkIndex} / chars:${chunk.charLength}`,
      chunkIndex: chunk.chunkIndex,
    } satisfies V1KnowledgeBaseRuntimeFoundationCreateChunkInput);

    if (created.status !== 'created') {
      return { ok: false as const, status: created.status };
    }

    records.push({
      ...created.record,
      charLength: chunk.charLength,
    });
  }

  return { ok: true as const, records };
}

export async function uploadV1KnowledgeBaseRuntimeDocumentService(input: {
  repository: V1KnowledgeBaseUploadParseChunkRuntimeRepository;
  input: V1KnowledgeBaseUploadParseChunkRuntimeInput;
}): Promise<V1KnowledgeBaseUploadParseChunkRuntimeResponse> {
  const invalid = validateUploadInput(input.input);
  if (invalid) return invalid;

  const parsed = parseV1KnowledgeBaseRuntimeDocument(input.input);
  if (parsed.status !== 'parsed') {
    return { status: parsed.status, readonly: true };
  }

  const chunks = chunkV1KnowledgeBaseRuntimeDocument({ text: parsed.text });
  if (chunks.length === 0) {
    return { status: 'empty_content', readonly: true };
  }

  const prefix = uploadIdPrefix(input.input);
  const sourceId = `kb-source-${prefix}`;
  const documentId = `kb-document-${prefix}`;
  const source = await input.repository.createDemoSource({
    id: sourceId,
    tenantId: input.input.tenantId,
    institutionId: input.input.institutionId,
    workspaceId: input.input.workspaceId,
    sourceKind: input.input.sourceKind,
    sourceLabel: input.input.fileName,
  } satisfies V1KnowledgeBaseRuntimeFoundationCreateSourceInput);
  if (source.status !== 'created') {
    return { status: source.status, readonly: true };
  }

  const document = await input.repository.createDemoDocument({
    id: documentId,
    tenantId: input.input.tenantId,
    institutionId: input.input.institutionId,
    workspaceId: input.input.workspaceId,
    sourceId,
    sourceKind: input.input.sourceKind,
    title: input.input.fileName,
    version: defaultVersion,
  } satisfies V1KnowledgeBaseRuntimeFoundationCreateDocumentInput);
  if (document.status !== 'created') {
    return { status: document.status, readonly: true };
  }

  const chunkRecords = await createChunkRecords({
    repository: input.repository,
    upload: input.input,
    documentId,
    prefix,
    chunks,
  });
  if (!chunkRecords.ok) {
    return { status: chunkRecords.status, readonly: true };
  }

  return {
    status: 'created',
    readonly: true,
    tenantId: input.input.tenantId,
    institutionId: input.input.institutionId,
    workspaceId: input.input.workspaceId,
    source: source.record,
    document: document.record,
    chunks: chunkRecords.records,
    indexJob: {
      status: 'not_started',
      jobKind: notStartedIndexJobKind,
      readonly: true,
    },
  };
}
