import { describe, expect, it, vi } from 'vitest';
import {
  answerInstitutionKnowledgeRagQuestion,
  type InstitutionKnowledgeRagAnswerRepository,
} from '@/modules/institution/server/institution-knowledge-rag-answer-service';
import type { AiChatProvider } from '@/modules/institution/server/institution-rag-answer-provider';
import type { KnowledgeChunkSearchRepositoryRecord } from '@/modules/institution/server/institution-knowledge-keyword-search-service';
import type { PlatformKnowledgeRepositoryRecord } from '@/modules/open-platform/server/platform-knowledge-management-repository';

const now = new Date('2026-07-05T08:00:00.000Z');
const humanConfirmationText = '仅供内部运营参考，需人工确认';

const sensitiveFragments = [
  'api_key',
  'DATABASE_URL',
  'postgres://',
  'secret',
  'password',
  'Bearer',
  'Authorization',
  'baseUrl',
  'provider config',
  'vendor',
  'cost',
  'usage',
  'latencyMs',
  'errorCode',
];

const knowledgeItems: PlatformKnowledgeRepositoryRecord[] = [
  {
    knowledgeId: 'knowledge-owned',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-current',
    workspaceId: 'workspace-current',
    title: '本机构术后护理知识',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '本机构自有护理知识。',
    chunkCount: 8,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-authorized',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-owner',
    workspaceId: 'workspace-owner',
    title: '授权术后护理指南',
    version: 'v1',
    sourceKind: 'seed',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '术后护理',
    descriptionPreview: '授权给当前机构的护理知识。',
    chunkCount: 1,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-other-inst',
    tenantId: 'tenant-a',
    tenantName: '租户 A',
    institutionId: 'inst-other',
    workspaceId: 'workspace-other',
    title: '其他机构知识',
    version: 'v1',
    sourceKind: 'mock',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '不可见',
    descriptionPreview: '不应被当前机构使用。',
    chunkCount: 1,
    visibleInstitutionIds: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    knowledgeId: 'knowledge-cross-tenant',
    tenantId: 'tenant-b',
    tenantName: '租户 B',
    institutionId: 'inst-current',
    workspaceId: 'workspace-b',
    title: '跨租户知识',
    version: 'v1',
    sourceKind: 'demo',
    status: 'ready',
    readonlyStatus: 'readonly',
    category: '跨租户',
    descriptionPreview: '不应跨租户使用。',
    chunkCount: 1,
    visibleInstitutionIds: ['inst-current'],
    createdAt: now,
    updatedAt: now,
  },
];

function createChunk(overrides: Partial<KnowledgeChunkSearchRepositoryRecord>): KnowledgeChunkSearchRepositoryRecord {
  return {
    tenantId: 'tenant-a',
    knowledgeId: 'knowledge-owned',
    knowledgeTitle: '本机构术后护理知识',
    fileId: 'file-aftercare',
    fileName: '术后护理.md',
    fileStatus: 'active',
    parseStatus: 'succeeded',
    chunkId: 'chunk-owned-0',
    chunkIndex: 0,
    textPreview: '术后冷敷每次15-20分钟，间隔至少2小时，避免冻伤皮肤。',
    ...overrides,
  };
}

const baseChunks: KnowledgeChunkSearchRepositoryRecord[] = [
  createChunk({ chunkId: 'chunk-owned-0', chunkIndex: 0 }),
  createChunk({ chunkId: 'chunk-owned-1', chunkIndex: 1, textPreview: '术后24小时内冷敷可减轻肿胀，保持伤口干燥清洁。' }),
  createChunk({ chunkId: 'chunk-owned-2', chunkIndex: 2, textPreview: '复诊前如出现红肿热痛，应及时联系医生。' }),
  createChunk({ chunkId: 'chunk-owned-3', chunkIndex: 3, textPreview: '冷敷时使用干净毛巾包裹冰袋，不直接接触皮肤。' }),
  createChunk({ chunkId: 'chunk-owned-4', chunkIndex: 4, textPreview: '术后避免剧烈运动和高温环境。' }),
  createChunk({ chunkId: 'chunk-owned-5', chunkIndex: 5, textPreview: '保持创口清洁，按机构复诊计划回访。' }),
  createChunk({
    knowledgeId: 'knowledge-authorized',
    knowledgeTitle: '授权术后护理指南',
    fileId: 'file-authorized',
    fileName: '授权护理.txt',
    chunkId: 'chunk-authorized-0',
    chunkIndex: 0,
    textPreview: '授权指南：术后护理需要人工确认风险分级。',
  }),
  createChunk({
    knowledgeId: 'knowledge-other-inst',
    knowledgeTitle: '其他机构知识',
    fileId: 'file-other',
    fileName: '其他机构.txt',
    chunkId: 'chunk-other-inst',
    chunkIndex: 0,
    textPreview: '其他机构专属内容，当前机构不可见。',
  }),
  createChunk({
    tenantId: 'tenant-b',
    knowledgeId: 'knowledge-cross-tenant',
    knowledgeTitle: '跨租户知识',
    fileId: 'file-cross-tenant',
    fileName: '跨租户.txt',
    chunkId: 'chunk-cross-tenant',
    chunkIndex: 0,
    textPreview: '跨租户内容，不应被使用。',
  }),
  createChunk({ chunkId: 'chunk-archived', fileStatus: 'archived', chunkIndex: 99, textPreview: '已归档内容不应被使用。' }),
  createChunk({ chunkId: 'chunk-failed', parseStatus: 'failed', chunkIndex: 100, textPreview: '解析失败内容不应被使用。' }),
];

function createRepository(chunks: KnowledgeChunkSearchRepositoryRecord[] = baseChunks): InstitutionKnowledgeRagAnswerRepository {
  return {
    listKnowledgeItems: vi.fn(async (input: { tenantId: string }) => knowledgeItems.filter((item) => item.tenantId === input.tenantId)),
    searchKnowledgeFileParseChunks: vi.fn(async (input: { tenantId: string; keyword: string }) => {
      expect(input.keyword.length).toBeGreaterThan(0);
      return chunks;
    }),
  };
}

function createProvider(answerText = '基于召回片段，术后冷敷应控制时长并观察异常。'): AiChatProvider {
  return {
    chat: vi.fn(async () => ({
      status: 'success',
      answerText,
      usage: { inputTokens: 999, outputTokens: 99 },
      latencyMs: 22,
      errorCode: 'should-not-leak',
    })),
  };
}

function expectNoSensitiveFields(payload: unknown) {
  const serialized = JSON.stringify(payload);
  sensitiveFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
  expect(serialized).not.toContain('问题：');
  expect(serialized).not.toContain('召回片段：');
  expect(serialized).not.toContain('Token');
}

describe('机构端知识库 RAG answer service', () => {
  it('question 为空返回 validation_failed 且不调用 provider', async () => {
    const provider = createProvider();
    const result = await answerInstitutionKnowledgeRagQuestion({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      question: '   ',
      repository: createRepository(),
      provider,
    });

    expect(result.status).toBe('validation_failed');
    expect(result.answer).toContain(humanConfirmationText);
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it('question 超长返回 validation_failed', async () => {
    const provider = createProvider();
    const result = await answerInstitutionKnowledgeRagQuestion({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      question: '问'.repeat(501),
      repository: createRepository(),
      provider,
    });

    expect(result.status).toBe('validation_failed');
    expect('message' in result ? result.message : '').toContain('最多支持 500 个字符');
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it('topK 默认 5，并只返回当前 tenant/institution 可见的 sources', async () => {
    const provider = createProvider();
    const result = await answerInstitutionKnowledgeRagQuestion({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      question: '术后冷敷注意事项是什么？',
      repository: createRepository(),
      provider,
    });

    expect(result.status).toBe('answered');
    expect(result.sources).toHaveLength(5);
    expect(result.sources.map((source) => source.knowledgeId)).not.toContain('knowledge-other-inst');
    expect(result.sources.map((source) => source.knowledgeId)).not.toContain('knowledge-cross-tenant');
    expect(result.sources.map((source) => source.knowledgeId)).not.toContain('chunk-archived');
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });

  it('topK 只允许 3 / 5 / 10', async () => {
    const provider = createProvider();
    const accepted = await answerInstitutionKnowledgeRagQuestion({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      question: '术后护理怎么做？',
      topK: '3',
      repository: createRepository(),
      provider,
    });
    expect(accepted.status).toBe('answered');
    expect(accepted.sources).toHaveLength(3);

    const rejected = await answerInstitutionKnowledgeRagQuestion({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      question: '术后护理怎么做？',
      topK: 4,
      repository: createRepository(),
      provider,
    });
    expect(rejected.status).toBe('validation_failed');
    expect('message' in rejected ? rejected.message : '').toContain('topK 只允许 3 / 5 / 10');
  });

  it('无 chunk 命中时返回 no_answer 且不调用 provider', async () => {
    const provider = createProvider();
    const result = await answerInstitutionKnowledgeRagQuestion({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      question: '不存在的知识问题',
      repository: createRepository([]),
      provider,
    });

    expect(result).toEqual({
      status: 'no_answer',
      answer: `未在当前知识库中找到足够依据。${humanConfirmationText}`,
      sources: [],
      noAnswerReason: 'no_retrieval_hit',
    });
    expect(provider.chat).not.toHaveBeenCalled();
  });

  it('有 chunk 命中时调用 provider，并返回 answer + 完整 sources 字段', async () => {
    const provider = createProvider('请按来源核对冷敷时长。');
    const result = await answerInstitutionKnowledgeRagQuestion({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      question: '术后冷敷注意事项是什么？',
      topK: 10,
      repository: createRepository(),
      provider,
    });

    expect(provider.chat).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('answered');
    expect(result.answer).toContain('请按来源核对冷敷时长。');
    expect(result.answer).toContain(humanConfirmationText);
    expect(result.sources.length).toBeGreaterThan(0);
    result.sources.forEach((source) => {
      expect(source).toEqual(expect.objectContaining({
        knowledgeId: expect.any(String),
        knowledgeTitle: expect.any(String),
        fileId: expect.any(String),
        fileName: expect.any(String),
        chunkIndex: expect.any(Number),
        textPreview: expect.any(String),
      }));
    });
    expectNoSensitiveFields(result);
  });

  it('provider failure 返回低敏错误，不返回 prompt、模型、token、成本或厂商', async () => {
    const provider: AiChatProvider = {
      chat: vi.fn(async () => ({
        status: 'provider_unavailable',
        errorCode: 'DATABASE_URL postgres://root:password@localhost secret=key vendor=model cost token',
        latencyMs: 1,
      })),
    };

    const result = await answerInstitutionKnowledgeRagQuestion({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      question: '术后冷敷注意事项是什么？',
      repository: createRepository(),
      provider,
    });

    expect(result.status).toBe('provider_unavailable');
    expect(result.answer).toBe(`知识库问答服务暂时不可用，请稍后重试。${humanConfirmationText}`);
    expect('message' in result ? result.message : '').toBe('知识库问答服务暂时不可用，请稍后重试');
    expect(result.sources.length).toBeGreaterThan(0);
    expectNoSensitiveFields(result);
  });

  it('租户 / 机构隔离：不能使用其他机构或其他租户 chunk', async () => {
    const provider = createProvider();
    const result = await answerInstitutionKnowledgeRagQuestion({
      tenantId: 'tenant-a',
      institutionId: 'inst-current',
      question: '术后冷敷注意事项是什么？',
      topK: 10,
      repository: createRepository(),
      provider,
    });

    expect(result.sources.map((source) => source.knowledgeId)).not.toContain('knowledge-other-inst');
    expect(result.sources.map((source) => source.knowledgeId)).not.toContain('knowledge-cross-tenant');
    expect(JSON.stringify(result)).not.toContain('其他机构专属内容');
    expect(JSON.stringify(result)).not.toContain('跨租户内容');
  });
});
