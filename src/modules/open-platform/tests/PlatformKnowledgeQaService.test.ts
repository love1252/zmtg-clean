import { describe, expect, it, vi } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import {
  KNOWLEDGE_QA_USAGE_LIMIT_MESSAGE,
  composeInstitutionKnowledgeQaService,
  composePlatformKnowledgeQaService,
  type KnowledgeQaAuditRecord,
  type KnowledgeQaCitationDto,
  type KnowledgeQaResponse,
} from '@/modules/open-platform/server/platform-knowledge-qa-service';
import type { KnowledgeChunkSearchRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-keyword-search-service';
import type { PlatformKnowledgeVectorSearchCandidateRecord } from '@/modules/open-platform/server/platform-knowledge-embedding-vector-search-service';
import { KNOWLEDGE_BASE_QA_QUOTA_POLICY } from '@/modules/open-platform/server/platform-knowledge-production-governance-policy';

const now = new Date('2026-06-14T08:00:00.000Z');

const unsafeFragments = [
  'storageKey',
  '/Users/',
  'embeddingVectorJson',
  'embedding_vector_json',
  'SQL',
  'stack',
  'token',
  'secret',
  'textContent',
  'fullText',
  'trainingContent',
  '真实 AI 原始响应',
];

const knowledgeRecords: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-a',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-owner-a',
    workspaceId: 'workspace-a',
    title: '术后护理知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '低敏摘要。',
    chunkCount: 2,
    visibleInstitutionIds: ['inst-visible-a'],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-owned',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-current',
    workspaceId: 'workspace-owned',
    title: '本机构护理知识库',
    version: 'v1',
    sourceKind: 'seed',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '机构知识',
    descriptionPreview: '本机构摘要。',
    chunkCount: 1,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-hidden',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-hidden',
    workspaceId: 'workspace-hidden',
    title: '未授权知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '不可见',
    descriptionPreview: '不应可见。',
    chunkCount: 1,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-b',
    tenantId: 'tenant-b',
    tenantName: '租户 B',
    institutionId: 'inst-owner-b',
    workspaceId: 'workspace-b',
    title: '跨租户知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '跨租户',
    descriptionPreview: 'tenant A 不可见。',
    chunkCount: 1,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
];

const chunkRecords: KnowledgeChunkSearchRepositoryRecord[] = [
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-a',
    knowledgeTitle: '术后护理知识库',
    fileId: 'file-a',
    fileName: '护理说明.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-a-0',
    chunkIndex: 0,
    textPreview: '术后护理需要冷敷，避免暴晒。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-owned',
    knowledgeTitle: '本机构护理知识库',
    fileId: 'file-owned',
    fileName: '机构护理.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-owned-0',
    chunkIndex: 0,
    textPreview: '本机构建议复诊前记录恢复状态。',
  },
  {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-hidden',
    knowledgeTitle: '未授权知识库',
    fileId: 'file-hidden',
    fileName: '隐藏.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-hidden-0',
    chunkIndex: 0,
    textPreview: '机构 B 不应看到机构 A 内容。',
  },
  {
    tenantId: 'tenant-b',
    knowledgeId: 'knowledge-b',
    knowledgeTitle: '跨租户知识库',
    fileId: 'file-b',
    fileName: '跨租户.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-b-0',
    chunkIndex: 0,
    textPreview: 'tenant B 不应被 tenant A 召回。',
  },
];

function vectorRecord(chunk: KnowledgeChunkSearchRepositoryRecord, scoreSeed: number) {
  return {
    ...chunk,
    embeddingId: `embedding-${chunk.chunkId}`,
    embeddingProvider: 'mock_local_embedding',
    embeddingModel: 'mock-local-embedding-v1',
    embeddingDimensions: 8,
    embeddingVectorJson: [scoreSeed, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    embeddingStatus: 'ready',
  } satisfies PlatformKnowledgeVectorSearchCandidateRecord;
}

function createRepository() {
  const audits: KnowledgeQaAuditRecord[] = [];
  return {
    audits,
    countKnowledgeQaAuditLogsForDay: vi.fn(async () => 0),
    listKnowledgeQaAuditLogs: vi.fn(async () => ({
      records: [],
      pageInfo: {
        page: 1,
        pageSize: 10,
        total: 0,
        pageCount: 0,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    })),
    listKnowledgeItems: vi.fn(async (input: { tenantId: string }) =>
      knowledgeRecords.filter((record) => record.tenantId === input.tenantId),
    ),
    searchKnowledgeFileParseChunks: vi.fn(async (input: {
      tenantId: string;
      keyword: string;
      knowledgeId?: string;
      fileId?: string;
    }) =>
      chunkRecords
        .filter((chunk) => chunk.tenantId === input.tenantId)
        .filter((chunk) => !input.knowledgeId || chunk.knowledgeId === input.knowledgeId)
        .filter((chunk) => !input.fileId || chunk.fileId === input.fileId)
        .filter((chunk) => chunk.textPreview.includes(input.keyword)),
    ),
    listKnowledgeVectorSearchCandidates: vi.fn(async (input: {
      tenantId: string;
      knowledgeId?: string;
      fileId?: string;
    }) =>
      chunkRecords
        .filter((chunk) => chunk.tenantId === input.tenantId)
        .filter((chunk) => !input.knowledgeId || chunk.knowledgeId === input.knowledgeId)
        .filter((chunk) => !input.fileId || chunk.fileId === input.fileId)
        .map((chunk, index) => vectorRecord(chunk, 0.1 + index / 10)),
    ),
    createKnowledgeQaAuditLog: vi.fn(async (record: KnowledgeQaAuditRecord) => {
      audits.push(record);
      return { auditId: record.auditId };
    }),
  };
}

function expectSafePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  unsafeFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function expectCitationShape(citation: KnowledgeQaCitationDto) {
  expect(citation).toEqual(
    expect.objectContaining({
      knowledgeId: expect.any(String),
      knowledgeTitle: expect.any(String),
      fileId: expect.any(String),
      fileName: expect.any(String),
      chunkId: expect.any(String),
      chunkIndex: expect.any(Number),
      textPreview: expect.any(String),
      score: expect.any(Number),
      matchReason: expect.any(String),
    }),
  );
}

function expectQaResponse(result: unknown): KnowledgeQaResponse {
  const isQaResponse = Boolean(result && typeof result === 'object' && 'answer' in result);
  expect(isQaResponse).toBe(true);
  if (!isQaResponse) {
    throw new Error('expected QA response');
  }

  return result as KnowledgeQaResponse;
}

describe('知识库 mock/local QA service', () => {
  it('平台端 hybrid QA 先召回片段并返回 answer、citations 与审计记录', async () => {
    const repository = createRepository();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = expectQaResponse(await composePlatformKnowledgeQaService({
      repository,
      actorUserId: 'platform-user',
      params: {
        tenantId: 'tenant-a',
        question: '冷敷后怎么护理？',
        retrievalMode: 'hybrid',
      },
    }));

    expect(result.safeStatus).toBe('answered');
    expect(result.retrievalMode).toBe('hybrid');
    expect(result.answer).toContain('基于已召回的知识片段');
    expect(result.answer).toContain('术后护理需要冷敷');
    expect(result.citations.length).toBeGreaterThan(0);
    expectCitationShape(result.citations[0]);
    expect(result.auditId).toMatch(/^kb-qa-audit-/);
    expect(repository.createKnowledgeQaAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: null,
        actorScope: 'platform',
        actorUserId: 'platform-user',
        question: '冷敷后怎么护理？',
        retrievalMode: 'hybrid',
        citationCount: result.citations.length,
        safeStatus: 'answered',
      }),
    );
    expectSafePayload(result);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('机构端 QA 只返回本机构归属或平台授权范围内引用片段', async () => {
    const repository = createRepository();

    const result = expectQaResponse(await composeInstitutionKnowledgeQaService({
      repository,
      actorUserId: 'tenant-user',
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        question: '复诊前怎么准备？',
        retrievalMode: 'hybrid',
      },
    }));

    expect(result.safeStatus).toBe('answered');
    expect(result.citations.map((citation) => citation.knowledgeId)).toContain('knowledge-owned');
    expect(result.citations.map((citation) => citation.knowledgeId)).not.toContain('knowledge-hidden');
    expect(result.citations.map((citation) => citation.knowledgeId)).not.toContain('knowledge-b');
    expect(repository.createKnowledgeQaAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        actorScope: 'institution',
        safeStatus: 'answered',
      }),
    );
    expectSafePayload(result);
  });

  it('空问题返回中文 validation_failed 且不写入审计', async () => {
    const repository = createRepository();

    const result = await composePlatformKnowledgeQaService({
      repository,
      actorUserId: 'platform-user',
      params: {
        tenantId: 'tenant-a',
        question: '   ',
        retrievalMode: 'keyword',
      },
    });

    expect(result).toEqual({
      status: 'validation_failed',
      message: '请输入知识库问答问题',
    });
    expect(repository.createKnowledgeQaAuditLog).not.toHaveBeenCalled();
  });

  it('无召回片段返回安全空答案并写入 no_citation 审计', async () => {
    const repository = createRepository();

    const result = expectQaResponse(await composePlatformKnowledgeQaService({
      repository,
      actorUserId: 'platform-user',
      params: {
        tenantId: 'tenant-a',
        question: '完全不存在的问题',
        retrievalMode: 'keyword',
      },
    }));

    expect(result.safeStatus).toBe('no_citation');
    expect(result.answer).toBe('当前授权范围内没有召回可引用的知识片段，暂不能给出知识库回答。');
    expect(result.citations).toEqual([]);
    expect(repository.createKnowledgeQaAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        safeStatus: 'no_citation',
        citationCount: 0,
        safeFailureMessage: '当前授权范围内没有召回可引用的知识片段，暂不能给出知识库回答。',
      }),
    );
    expectSafePayload(result);
  });

  it('tenant 每日未超限时正常回答并执行召回', async () => {
    const repository = createRepository();
    repository.countKnowledgeQaAuditLogsForDay.mockResolvedValueOnce(
      KNOWLEDGE_BASE_QA_QUOTA_POLICY.tenantDailyLimit - 1,
    );

    const result = expectQaResponse(await composePlatformKnowledgeQaService({
      repository,
      actorUserId: 'platform-user',
      params: {
        tenantId: 'tenant-a',
        question: '冷敷后怎么护理？',
        retrievalMode: 'keyword',
      },
    }));

    expect(result.safeStatus).toBe('answered');
    expect(repository.countKnowledgeQaAuditLogsForDay).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: null,
      }),
    );
    expect(repository.searchKnowledgeFileParseChunks).toHaveBeenCalled();
  });

  it('tenant 每日超限时返回中文安全文案且不执行召回', async () => {
    const repository = createRepository();
    repository.countKnowledgeQaAuditLogsForDay.mockResolvedValueOnce(
      KNOWLEDGE_BASE_QA_QUOTA_POLICY.tenantDailyLimit,
    );

    const result = await composePlatformKnowledgeQaService({
      repository,
      actorUserId: 'platform-user',
      params: {
        tenantId: 'tenant-a',
        question: '冷敷后怎么护理？',
        retrievalMode: 'hybrid',
      },
    });

    expect(result).toEqual({
      status: 'usage_limited',
      message: KNOWLEDGE_BASE_QA_QUOTA_POLICY.usageLimitedMessage,
    });
    expect(KNOWLEDGE_QA_USAGE_LIMIT_MESSAGE).toBe(
      KNOWLEDGE_BASE_QA_QUOTA_POLICY.usageLimitedMessage,
    );
    expect(repository.searchKnowledgeFileParseChunks).not.toHaveBeenCalled();
    expect(repository.listKnowledgeVectorSearchCandidates).not.toHaveBeenCalled();
    expect(repository.createKnowledgeQaAuditLog).not.toHaveBeenCalled();
  });

  it('institution 每日超限时返回中文安全文案且不执行召回', async () => {
    const repository = createRepository();
    repository.countKnowledgeQaAuditLogsForDay.mockResolvedValueOnce(
      KNOWLEDGE_BASE_QA_QUOTA_POLICY.institutionDailyLimit,
    );

    const result = await composeInstitutionKnowledgeQaService({
      repository,
      actorUserId: 'tenant-user',
      params: {
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
        question: '复诊前怎么准备？',
        retrievalMode: 'hybrid',
      },
    });

    expect(result).toEqual({
      status: 'usage_limited',
      message: KNOWLEDGE_BASE_QA_QUOTA_POLICY.usageLimitedMessage,
    });
    expect(repository.countKnowledgeQaAuditLogsForDay).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        institutionId: 'inst-current',
      }),
    );
    expect(repository.searchKnowledgeFileParseChunks).not.toHaveBeenCalled();
    expect(repository.listKnowledgeVectorSearchCandidates).not.toHaveBeenCalled();
    expect(repository.createKnowledgeQaAuditLog).not.toHaveBeenCalled();
  });
});
