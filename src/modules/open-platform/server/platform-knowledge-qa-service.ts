import { createHash } from 'node:crypto';

import { isKnowledgeVisibleToInstitution } from '@/modules/open-platform/server/platform-knowledge-file-management-service';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import type { KnowledgeChunkSearchRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-keyword-search-service';
import {
  createDeterministicMockKnowledgeEmbedding,
  type PlatformKnowledgeVectorSearchCandidateRecord,
} from '@/modules/open-platform/server/platform-knowledge-embedding-vector-search-service';
import { KNOWLEDGE_BASE_QA_QUOTA_POLICY } from '@/modules/open-platform/server/platform-knowledge-production-governance-policy';

export type KnowledgeQaRetrievalMode = 'keyword' | 'vector' | 'hybrid';
export type KnowledgeQaActorScope = 'platform' | 'institution';
export type KnowledgeQaSafeStatus = 'answered' | 'no_citation';
export const KNOWLEDGE_QA_USAGE_LIMIT_MESSAGE = KNOWLEDGE_BASE_QA_QUOTA_POLICY.usageLimitedMessage;

export type KnowledgeQaCitationDto = {
  knowledgeId: string;
  knowledgeTitle: string;
  fileId: string;
  fileName: string;
  chunkId: string;
  chunkIndex: number;
  textPreview: string;
  score: number;
  matchReason: string;
};

export type KnowledgeQaResponse = {
  answer: string;
  citations: KnowledgeQaCitationDto[];
  retrievalMode: KnowledgeQaRetrievalMode;
  auditId: string;
  safeStatus: KnowledgeQaSafeStatus;
};

export type KnowledgeQaAuditRecord = {
  auditId: string;
  tenantId: string;
  institutionId: string | null;
  actorScope: KnowledgeQaActorScope;
  actorUserId: string;
  question: string;
  answerPreview: string;
  retrievalMode: KnowledgeQaRetrievalMode;
  citationCount: number;
  safeStatus: KnowledgeQaSafeStatus;
  safeFailureMessage: string | null;
  createdAt: Date;
};

export type KnowledgeQaAuditLogDto = {
  auditId: string;
  tenantId: string;
  institutionId: string | null;
  actorScope: KnowledgeQaActorScope;
  actorUserId: string;
  question: string;
  answerPreview: string;
  retrievalMode: KnowledgeQaRetrievalMode;
  citationCount: number;
  safeStatus: string;
  safeFailureMessage: string | null;
  createdAt: string;
};

export type KnowledgeQaAuditListResponse = {
  requestId: 'platform-knowledge-qa-audits' | 'institution-knowledge-qa-audits';
  readonly: true;
  dataSource: 'repository';
  records: KnowledgeQaAuditLogDto[];
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

type KnowledgeQaRepository = {
  listKnowledgeItems(input: { tenantId: string }): Promise<PlatformKnowledgeRepositoryRecord[]>;
  countKnowledgeQaAuditLogsForDay(input: {
    tenantId: string;
    institutionId: string | null;
    since: Date;
  }): Promise<number>;
  listKnowledgeQaAuditLogs(input: {
    tenantId: string;
    institutionId?: string;
    page: number;
    pageSize: number;
  }): Promise<{
    records: KnowledgeQaAuditLogDto[];
    pageInfo: KnowledgeQaAuditListResponse['pageInfo'];
  }>;
  searchKnowledgeFileParseChunks(input: {
    tenantId: string;
    keyword: string;
    knowledgeId?: string;
    fileId?: string;
  }): Promise<KnowledgeChunkSearchRepositoryRecord[]>;
  listKnowledgeVectorSearchCandidates(input: {
    tenantId: string;
    knowledgeId?: string;
    fileId?: string;
  }): Promise<PlatformKnowledgeVectorSearchCandidateRecord[]>;
  createKnowledgeQaAuditLog(record: KnowledgeQaAuditRecord): Promise<{ auditId: string }>;
};

type KnowledgeQaParams = {
  tenantId?: string | number | null;
  institutionId?: string | number | null;
  question?: string | number | null;
  knowledgeId?: string | number | null;
  fileId?: string | number | null;
  retrievalMode?: string | number | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

type KnowledgeQaServiceInput = {
  repository: KnowledgeQaRepository;
  actorUserId: string;
  params: KnowledgeQaParams;
};

const MAX_CITATIONS = 5;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const NO_CITATION_ANSWER = '当前授权范围内没有召回可引用的知识片段，暂不能给出知识库回答。';
const auditEmptyState = {
  title: '暂无问答审计',
  description: '当前范围还没有知识库问答审计记录。',
};

function normalizeOptionalString(value: string | number | null | undefined) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : undefined;
}

function normalizeScope(value: string | number | null | undefined, label: string) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return {
      ok: false as const,
      error: {
        status: 'validation_failed' as const,
        message: `${label} 是知识库问答的必填范围`,
      },
    };
  }

  return { ok: true as const, value: normalized };
}

function normalizeQuestion(value: string | number | null | undefined) {
  const question = normalizeOptionalString(value);
  if (!question) {
    return {
      ok: false as const,
      error: {
        status: 'validation_failed' as const,
        message: '请输入知识库问答问题',
      },
    };
  }

  return { ok: true as const, question: question.slice(0, 512) };
}

function normalizeRetrievalMode(value: string | number | null | undefined): KnowledgeQaRetrievalMode {
  if (value === 'keyword' || value === 'vector' || value === 'hybrid') return value;
  return 'hybrid';
}

function parsePositiveInteger(value: string | number | null | undefined, fallback: number) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizePageParams(params: KnowledgeQaParams) {
  const page = parsePositiveInteger(params.page, DEFAULT_PAGE);
  const parsedPageSize = parsePositiveInteger(params.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = parsedPageSize > MAX_PAGE_SIZE ? DEFAULT_PAGE_SIZE : parsedPageSize;

  return { page, pageSize };
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function deriveKeyword(question: string) {
  const compact = question
    .normalize('NFKC')
    .replace(/[？?。！!，,、：:；;\s]/g, '')
    .trim();
  if (!compact) return question;
  return compact.slice(0, Math.min(2, compact.length));
}

function isSearchableChunk(record: {
  tenantId: string;
  fileStatus: 'active' | 'archived';
  parseStatus: 'pending' | 'processing' | 'succeeded' | 'failed';
}) {
  return record.tenantId && record.fileStatus === 'active' && record.parseStatus === 'succeeded';
}

function knowledgeById(records: PlatformKnowledgeRepositoryRecord[]) {
  return new Map(records.map((record) => [record.knowledgeId, record]));
}

function vectorMagnitude(vector: number[]) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  if (length === 0) return 0;
  const denominator = vectorMagnitude(left) * vectorMagnitude(right);
  if (denominator === 0) return 0;
  let dot = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
  }

  return dot / denominator;
}

function mapKeywordCitation(record: KnowledgeChunkSearchRepositoryRecord, keyword: string) {
  return {
    knowledgeId: record.knowledgeId,
    knowledgeTitle: record.knowledgeTitle,
    fileId: record.fileId,
    fileName: record.fileName,
    chunkId: record.chunkId,
    chunkIndex: record.chunkIndex,
    textPreview: record.textPreview,
    score: 1,
    matchReason: `片段包含关键词“${keyword}”`,
  } satisfies KnowledgeQaCitationDto;
}

function mapVectorCitation(record: PlatformKnowledgeVectorSearchCandidateRecord, score: number) {
  return {
    knowledgeId: record.knowledgeId,
    knowledgeTitle: record.knowledgeTitle,
    fileId: record.fileId,
    fileName: record.fileName,
    chunkId: record.chunkId,
    chunkIndex: record.chunkIndex,
    textPreview: record.textPreview,
    score,
    matchReason: `mock embedding 相似度 ${score.toFixed(3)}`,
  } satisfies KnowledgeQaCitationDto;
}

function sortCitations(left: KnowledgeQaCitationDto, right: KnowledgeQaCitationDto) {
  return (
    right.score - left.score ||
    left.knowledgeId.localeCompare(right.knowledgeId) ||
    left.fileId.localeCompare(right.fileId) ||
    left.chunkIndex - right.chunkIndex ||
    left.chunkId.localeCompare(right.chunkId)
  );
}

function mergeCitations(citations: KnowledgeQaCitationDto[]) {
  const byChunkId = new Map<string, KnowledgeQaCitationDto>();
  citations.forEach((citation) => {
    const existing = byChunkId.get(citation.chunkId);
    if (!existing || citation.score > existing.score) {
      byChunkId.set(citation.chunkId, citation);
    }
  });

  return Array.from(byChunkId.values()).sort(sortCitations).slice(0, MAX_CITATIONS);
}

function composeAnswer(citations: KnowledgeQaCitationDto[]) {
  if (citations.length === 0) return NO_CITATION_ANSWER;

  const summary = citations
    .slice(0, 3)
    .map((citation, index) => `${index + 1}. ${citation.textPreview}`)
    .join(' ');

  return `基于已召回的知识片段：${summary}`;
}

function auditId(input: {
  tenantId: string;
  institutionId: string | null;
  actorScope: KnowledgeQaActorScope;
  actorUserId: string;
  question: string;
  retrievalMode: KnowledgeQaRetrievalMode;
}) {
  return `kb-qa-audit-${createHash('sha256')
    .update([
      input.tenantId,
      input.institutionId ?? 'platform',
      input.actorScope,
      input.actorUserId,
      input.question,
      input.retrievalMode,
      new Date().toISOString(),
    ].join(':'))
    .digest('hex')
    .slice(0, 40)}`;
}

function buildAudit(input: {
  tenantId: string;
  institutionId: string | null;
  actorScope: KnowledgeQaActorScope;
  actorUserId: string;
  question: string;
  answer: string;
  retrievalMode: KnowledgeQaRetrievalMode;
  citations: KnowledgeQaCitationDto[];
  safeStatus: KnowledgeQaSafeStatus;
}) {
  const safeFailureMessage =
    input.safeStatus === 'no_citation' ? NO_CITATION_ANSWER : null;

  return {
    auditId: auditId(input),
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    actorScope: input.actorScope,
    actorUserId: input.actorUserId,
    question: input.question,
    answerPreview: input.answer.slice(0, 1024),
    retrievalMode: input.retrievalMode,
    citationCount: input.citations.length,
    safeStatus: input.safeStatus,
    safeFailureMessage,
    createdAt: new Date(),
  } satisfies KnowledgeQaAuditRecord;
}

async function loadVisibleKnowledge(input: {
  repository: KnowledgeQaRepository;
  tenantId: string;
  institutionId?: string;
}) {
  const records = await input.repository.listKnowledgeItems({ tenantId: input.tenantId });
  const tenantRecords = records.filter((record) => record.tenantId === input.tenantId);
  if (!input.institutionId) return knowledgeById(tenantRecords);

  return knowledgeById(
    tenantRecords.filter((record) =>
      isKnowledgeVisibleToInstitution(record, input.institutionId ?? ''),
    ),
  );
}

async function recallKeywordCitations(input: {
  repository: KnowledgeQaRepository;
  tenantId: string;
  question: string;
  knowledgeId?: string;
  fileId?: string;
  visibleKnowledge: Map<string, PlatformKnowledgeRepositoryRecord>;
}) {
  const keyword = deriveKeyword(input.question);
  const chunks = await input.repository.searchKnowledgeFileParseChunks({
    tenantId: input.tenantId,
    keyword,
    knowledgeId: input.knowledgeId,
    fileId: input.fileId,
  });

  return chunks
    .filter((chunk) => chunk.tenantId === input.tenantId)
    .filter(isSearchableChunk)
    .filter((chunk) => input.visibleKnowledge.has(chunk.knowledgeId))
    .map((chunk) => mapKeywordCitation(chunk, keyword));
}

async function recallVectorCitations(input: {
  repository: KnowledgeQaRepository;
  tenantId: string;
  question: string;
  knowledgeId?: string;
  fileId?: string;
  visibleKnowledge: Map<string, PlatformKnowledgeRepositoryRecord>;
}) {
  const questionEmbedding = createDeterministicMockKnowledgeEmbedding(input.question);
  const candidates = await input.repository.listKnowledgeVectorSearchCandidates({
    tenantId: input.tenantId,
    knowledgeId: input.knowledgeId,
    fileId: input.fileId,
  });

  return candidates
    .filter((candidate) => candidate.tenantId === input.tenantId)
    .filter(isSearchableChunk)
    .filter((candidate) => candidate.embeddingStatus === 'ready')
    .filter((candidate) => input.visibleKnowledge.has(candidate.knowledgeId))
    .map((candidate) => mapVectorCitation(
      candidate,
      Number(cosineSimilarity(questionEmbedding.vector, candidate.embeddingVectorJson).toFixed(6)),
    ));
}

async function composeKnowledgeQa(input: KnowledgeQaServiceInput & {
  actorScope: KnowledgeQaActorScope;
  tenantId: string;
  institutionId: string | null;
}) {
  const question = normalizeQuestion(input.params.question);
  if (!question.ok) return question.error;

  const retrievalMode = normalizeRetrievalMode(input.params.retrievalMode);
  const usageCount = await input.repository.countKnowledgeQaAuditLogsForDay({
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    since: startOfToday(),
  });
  const usageLimit = input.institutionId
    ? KNOWLEDGE_BASE_QA_QUOTA_POLICY.institutionDailyLimit
    : KNOWLEDGE_BASE_QA_QUOTA_POLICY.tenantDailyLimit;
  if (usageCount >= usageLimit) {
    return {
      status: 'usage_limited' as const,
      message: KNOWLEDGE_QA_USAGE_LIMIT_MESSAGE,
    };
  }

  const knowledgeId = normalizeOptionalString(input.params.knowledgeId);
  const fileId = normalizeOptionalString(input.params.fileId);
  const visibleKnowledge = await loadVisibleKnowledge({
    repository: input.repository,
    tenantId: input.tenantId,
    institutionId: input.institutionId ?? undefined,
  });

  const citationBatches: KnowledgeQaCitationDto[][] = [];
  if (retrievalMode === 'keyword' || retrievalMode === 'hybrid') {
    citationBatches.push(await recallKeywordCitations({
      repository: input.repository,
      tenantId: input.tenantId,
      question: question.question,
      knowledgeId,
      fileId,
      visibleKnowledge,
    }));
  }
  if (retrievalMode === 'vector' || retrievalMode === 'hybrid') {
    citationBatches.push(await recallVectorCitations({
      repository: input.repository,
      tenantId: input.tenantId,
      question: question.question,
      knowledgeId,
      fileId,
      visibleKnowledge,
    }));
  }

  const citations = mergeCitations(citationBatches.flat());
  const answer = composeAnswer(citations);
  const safeStatus: KnowledgeQaSafeStatus = citations.length > 0 ? 'answered' : 'no_citation';
  const audit = buildAudit({
    tenantId: input.tenantId,
    institutionId: input.institutionId,
    actorScope: input.actorScope,
    actorUserId: input.actorUserId,
    question: question.question,
    answer,
    retrievalMode,
    citations,
    safeStatus,
  });
  const saved = await input.repository.createKnowledgeQaAuditLog(audit);

  return {
    answer,
    citations,
    retrievalMode,
    auditId: saved.auditId,
    safeStatus,
  } satisfies KnowledgeQaResponse;
}

export async function composePlatformKnowledgeQaService(input: KnowledgeQaServiceInput) {
  const tenant = normalizeScope(input.params.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;

  return composeKnowledgeQa({
    ...input,
    actorScope: 'platform',
    tenantId: tenant.value,
    institutionId: null,
  });
}

export async function listPlatformKnowledgeQaAuditsService(input: {
  repository: KnowledgeQaRepository;
  params: KnowledgeQaParams;
}) {
  const tenant = normalizeScope(input.params.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;

  const institutionId = normalizeOptionalString(input.params.institutionId);
  const pageParams = normalizePageParams(input.params);
  const result = await input.repository.listKnowledgeQaAuditLogs({
    tenantId: tenant.value,
    institutionId,
    ...pageParams,
  });

  return {
    requestId: 'platform-knowledge-qa-audits',
    readonly: true,
    dataSource: 'repository',
    records: result.records,
    pageInfo: result.pageInfo,
    emptyState: auditEmptyState,
  } satisfies KnowledgeQaAuditListResponse;
}

export async function composeInstitutionKnowledgeQaService(input: KnowledgeQaServiceInput) {
  const tenant = normalizeScope(input.params.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;

  const institution = normalizeScope(input.params.institutionId, 'institutionId');
  if (!institution.ok) return institution.error;

  return composeKnowledgeQa({
    ...input,
    actorScope: 'institution',
    tenantId: tenant.value,
    institutionId: institution.value,
  });
}

export async function listInstitutionKnowledgeQaAuditsService(input: {
  repository: KnowledgeQaRepository;
  params: KnowledgeQaParams;
}) {
  const tenant = normalizeScope(input.params.tenantId, 'tenantId');
  if (!tenant.ok) return tenant.error;

  const institution = normalizeScope(input.params.institutionId, 'institutionId');
  if (!institution.ok) return institution.error;

  const pageParams = normalizePageParams(input.params);
  const result = await input.repository.listKnowledgeQaAuditLogs({
    tenantId: tenant.value,
    institutionId: institution.value,
    ...pageParams,
  });

  return {
    requestId: 'institution-knowledge-qa-audits',
    readonly: true,
    dataSource: 'repository',
    records: result.records,
    pageInfo: result.pageInfo,
    emptyState: auditEmptyState,
  } satisfies KnowledgeQaAuditListResponse;
}
