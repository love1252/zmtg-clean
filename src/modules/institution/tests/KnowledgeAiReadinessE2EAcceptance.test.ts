import { describe, expect, it, vi } from 'vitest';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import type { KnowledgeChunkSearchRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-keyword-search-service';
import type { PlatformKnowledgeVectorSearchCandidateRecord } from '@/modules/open-platform/server/platform-knowledge-embedding-vector-search-service';
import {
  composeInstitutionKnowledgeQaService,
  composePlatformKnowledgeQaService,
  listInstitutionKnowledgeQaAuditsService,
  listPlatformKnowledgeQaAuditsService,
  type KnowledgeQaAuditRecord,
  type KnowledgeQaAuditListResponse,
  type KnowledgeQaResponse,
} from '@/modules/open-platform/server/platform-knowledge-qa-service';
import { getKnowledgeBaseProductionCapabilityStatus } from '@/modules/open-platform/server/platform-knowledge-production-governance-policy';

const now = new Date('2026-06-14T08:00:00.000Z');

const unsafeFragments = [
  'storageKey',
  '/Users/',
  'textContent',
  'rawContent',
  'parsedContent',
  'embeddingVectorJson',
  'SQL',
  'stack',
  'token',
  'secret',
  'DATABASE_URL',
  'prompt',
  'system prompt',
  '真实 AI 原始响应',
];

const e2eKnowledge: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-platform-care',
    tenantId: 'tenant-e2e',
    tenantName: '验收租户',
    institutionId: 'inst-owner',
    workspaceId: 'workspace-care',
    title: '平台授权护理知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '护理',
    descriptionPreview: '平台授权护理摘要。',
    chunkCount: 2,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-other-institution',
    tenantId: 'tenant-e2e',
    tenantName: '验收租户',
    institutionId: 'inst-other',
    workspaceId: 'workspace-other',
    title: '其他机构未授权知识库',
    version: 'v1',
    sourceKind: 'seed',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '其他',
    descriptionPreview: '不应可见。',
    chunkCount: 1,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-cross-tenant',
    tenantId: 'tenant-other',
    tenantName: '其他租户',
    institutionId: 'inst-current',
    workspaceId: 'workspace-cross',
    title: '跨租户知识库',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '跨租户',
    descriptionPreview: '不应跨租户可见。',
    chunkCount: 1,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
];

const e2eChunks: KnowledgeChunkSearchRepositoryRecord[] = [
  {
    tenantId: 'tenant-e2e',
    knowledgeId: 'knowledge-platform-care',
    knowledgeTitle: '平台授权护理知识库',
    fileId: 'file-care',
    fileName: '护理指南.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-care-0',
    chunkIndex: 0,
    textPreview: '术后护理需要冷敷，避免暴晒。',
  },
  {
    tenantId: 'tenant-e2e',
    knowledgeId: 'knowledge-platform-care',
    knowledgeTitle: '平台授权护理知识库',
    fileId: 'file-care',
    fileName: '护理指南.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-care-1',
    chunkIndex: 1,
    textPreview: '复诊前需要记录恢复状态。',
  },
  {
    tenantId: 'tenant-e2e',
    knowledgeId: 'knowledge-other-institution',
    knowledgeTitle: '其他机构未授权知识库',
    fileId: 'file-other',
    fileName: '其他机构.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-other-0',
    chunkIndex: 0,
    textPreview: '其他机构不可见。',
  },
  {
    tenantId: 'tenant-other',
    knowledgeId: 'knowledge-cross-tenant',
    knowledgeTitle: '跨租户知识库',
    fileId: 'file-cross',
    fileName: '跨租户.txt',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-cross-0',
    chunkIndex: 0,
    textPreview: '跨租户不应可见。',
  },
];

function vectorRecord(chunk: KnowledgeChunkSearchRepositoryRecord, seed: number) {
  return {
    ...chunk,
    embeddingId: `embedding-${chunk.chunkId}`,
    embeddingProvider: 'mock_local_embedding',
    embeddingModel: 'mock-local-embedding-v1',
    embeddingDimensions: 8,
    embeddingVectorJson: [seed, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    embeddingStatus: 'ready',
  } satisfies PlatformKnowledgeVectorSearchCandidateRecord;
}

function createE2eRepository() {
  const audits: KnowledgeQaAuditRecord[] = [];

  return {
    audits,
    countKnowledgeQaAuditLogsForDay: vi.fn(async () => 0),
    listKnowledgeItems: vi.fn(async (input: { tenantId: string }) =>
      e2eKnowledge.filter((record) => record.tenantId === input.tenantId),
    ),
    searchKnowledgeFileParseChunks: vi.fn(async (input: {
      tenantId: string;
      keyword: string;
      knowledgeId?: string;
      fileId?: string;
    }) =>
      e2eChunks
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
      e2eChunks
        .filter((chunk) => chunk.tenantId === input.tenantId)
        .filter((chunk) => !input.knowledgeId || chunk.knowledgeId === input.knowledgeId)
        .filter((chunk) => !input.fileId || chunk.fileId === input.fileId)
        .map((chunk, index) => vectorRecord(chunk, 0.1 + index / 10)),
    ),
    createKnowledgeQaAuditLog: vi.fn(async (record: KnowledgeQaAuditRecord) => {
      audits.push(record);
      return { auditId: record.auditId };
    }),
    listKnowledgeQaAuditLogs: vi.fn(async (input: {
      tenantId: string;
      institutionId?: string;
      page: number;
      pageSize: number;
    }) => {
      const records = audits
        .filter((audit) => audit.tenantId === input.tenantId)
        .filter((audit) => !input.institutionId || audit.institutionId === input.institutionId)
        .map((audit) => ({
          ...audit,
          createdAt: audit.createdAt.toISOString(),
        }));

      return {
        records,
        pageInfo: {
          page: input.page,
          pageSize: input.pageSize,
          total: records.length,
          pageCount: records.length > 0 ? 1 : 0,
          hasPreviousPage: false,
          hasNextPage: false,
        },
      };
    }),
  };
}

function expectSafePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  unsafeFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function expectQaResponse(result: unknown): KnowledgeQaResponse {
  const isQaResponse = Boolean(result && typeof result === 'object' && 'citations' in result);
  expect(isQaResponse).toBe(true);
  if (!isQaResponse) {
    throw new Error('expected QA response');
  }

  return result as KnowledgeQaResponse;
}

function expectAuditListResponse(result: unknown): KnowledgeQaAuditListResponse {
  const isAuditListResponse = Boolean(result && typeof result === 'object' && 'records' in result);
  expect(isAuditListResponse).toBe(true);
  if (!isAuditListResponse) {
    throw new Error('expected audit list response');
  }

  return result as KnowledgeQaAuditListResponse;
}

describe('知识库真实 AI 上线前准 E2E 验收', () => {
  it('覆盖平台 QA、机构授权 QA、citations、审计和真实 AI disabled capability', async () => {
    const repository = createE2eRepository();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const platformQa = expectQaResponse(await composePlatformKnowledgeQaService({
      repository,
      actorUserId: 'platform-user',
      params: {
        tenantId: 'tenant-e2e',
        question: '冷敷后怎么护理？',
        retrievalMode: 'hybrid',
      },
    }));
    expect(platformQa).toEqual(
      expect.objectContaining({
        answer: expect.stringContaining('冷敷'),
        safeStatus: 'answered',
      }),
    );
    expect(platformQa.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          knowledgeId: 'knowledge-platform-care',
          chunkId: 'chunk-care-0',
        }),
      ]),
    );

    const institutionQa = expectQaResponse(await composeInstitutionKnowledgeQaService({
      repository,
      actorUserId: 'tenant-user',
      params: {
        tenantId: 'tenant-e2e',
        institutionId: 'inst-current',
        question: '冷敷后怎么护理？',
        retrievalMode: 'hybrid',
      },
    }));
    expect(institutionQa).toEqual(
      expect.objectContaining({
        answer: expect.stringContaining('冷敷'),
        safeStatus: 'answered',
      }),
    );
    const institutionCitationIds = institutionQa.citations.map((citation) => citation.knowledgeId);
    expect(institutionCitationIds).toContain('knowledge-platform-care');
    expect(institutionCitationIds).not.toContain('knowledge-other-institution');
    expect(institutionCitationIds).not.toContain('knowledge-cross-tenant');

    const institutionAudits = expectAuditListResponse(await listInstitutionKnowledgeQaAuditsService({
      repository,
      params: {
        tenantId: 'tenant-e2e',
        institutionId: 'inst-current',
      },
    }));
    expect(institutionAudits.records).toEqual([
      expect.objectContaining({
        tenantId: 'tenant-e2e',
        institutionId: 'inst-current',
        safeStatus: 'answered',
        citationCount: expect.any(Number),
      }),
    ]);

    const platformAudits = expectAuditListResponse(await listPlatformKnowledgeQaAuditsService({
      repository,
      params: {
        tenantId: 'tenant-e2e',
      },
    }));
    expect(platformAudits.records.length).toBe(2);

    const realAiCapability = getKnowledgeBaseProductionCapabilityStatus().capabilities.find(
      (capability) => capability.id === 'realAiProvider',
    );
    expect(realAiCapability).toEqual(
      expect.objectContaining({ enabled: false, status: 'disabled' }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expectSafePayload({ platformQa, institutionQa, institutionAudits, platformAudits, realAiCapability });
  });
});
