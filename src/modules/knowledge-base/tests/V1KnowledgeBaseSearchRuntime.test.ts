import { describe, expect, it, vi } from 'vitest';
import * as searchRoute from '@/app/api/v1/knowledge-base/runtime/search/route';
import {
  searchV1KnowledgeBaseRuntime,
  v1KnowledgeBaseSearchRuntimeResponseFields,
  type V1KnowledgeBaseSearchRuntimeCandidate,
  type V1KnowledgeBaseSearchRuntimeRepository,
} from '@/modules/knowledge-base/server/v1-knowledge-base-search-runtime';
import {
  createMockDemoKnowledgeBaseEmbedding,
} from '@/modules/knowledge-base/server/v1-knowledge-base-embedding-vector-index-runtime';

const searchUrl = 'http://localhost/api/v1/knowledge-base/runtime/search';
const scope = {
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
};

const candidates: V1KnowledgeBaseSearchRuntimeCandidate[] = [
  {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    workspaceId: scope.workspaceId,
    chunkId: 'kb-chunk-hydro-care',
    documentId: 'kb-document-hydro-care',
    title: '水光术后护理 demo 知识',
    snippet: 'chunk:0 / chars:128',
    sourceKind: 'demo',
    chunkIndex: 0,
    embeddingDimensions: 8,
    embeddingVectorJson: createMockDemoKnowledgeBaseEmbedding('水光 术后 护理 保湿', 8).vector,
    readonly: true,
  },
  {
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    workspaceId: scope.workspaceId,
    chunkId: 'kb-chunk-photoelectric-care',
    documentId: 'kb-document-photoelectric-care',
    title: '光电治疗恢复 seed 知识',
    snippet: 'chunk:1 / chars:96',
    sourceKind: 'seed',
    chunkIndex: 1,
    embeddingDimensions: 8,
    embeddingVectorJson: createMockDemoKnowledgeBaseEmbedding('光电 治疗 恢复 防晒', 8).vector,
    readonly: true,
  },
];

function collectFields(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => collectFields(item));
  }

  if (typeof payload !== 'object' || payload === null) {
    return [];
  }

  return Object.entries(payload).flatMap(([field, value]) => [
    field,
    ...collectFields(value),
  ]);
}

function expectResponseFieldsWhitelisted(payload: unknown) {
  const fields = collectFields(payload);
  const allowedFields = new Set<string>(v1KnowledgeBaseSearchRuntimeResponseFields);

  expect(fields.filter((field) => !allowedFields.has(field))).toEqual([]);
}

function expectNoForbiddenLeak(payload: unknown) {
  const serialized = JSON.stringify(payload);

  [
    'raw',
    'payload',
    'token',
    'secret',
    'credential',
    'HIS',
    '真实客户',
    '真实模型',
    '模型输出',
    'prompt',
    'completion',
    'process.env',
    'OPENAI',
    'API_KEY',
    'fetch(',
    'medicalRecord',
    'phone',
    'payment',
    'contract',
    'invoice',
  ].forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function createRepository(
  overrides: Partial<V1KnowledgeBaseSearchRuntimeRepository> = {},
) {
  const repository = {
    listSearchCandidates: vi.fn(async () => candidates),
    ...overrides,
  } satisfies V1KnowledgeBaseSearchRuntimeRepository;

  return repository;
}

function searchRequest(query: string, extra = '') {
  return new Request(`${searchUrl}?q=${encodeURIComponent(query)}${extra}`);
}

describe('V1 知识库检索 runtime', () => {
  it('search API happy path 返回低敏 readonly results', async () => {
    const repository = createRepository();
    const response = await searchRoute.GET(searchRequest('水光 护理'), { repository });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'ready',
      readonly: true,
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      workspaceId: scope.workspaceId,
      query: '水光 护理',
      mode: 'demo_search_mock_embedding',
      resultCount: 2,
    });
    expect(body.results[0]).toMatchObject({
      title: '水光术后护理 demo 知识',
      snippet: 'chunk:0 / chars:128',
      scoreBand: expect.stringMatching(/^(high|medium|low)$/u),
      sourceKind: 'demo',
      chunkIndex: 0,
      readonly: true,
    });
    expect(repository.listSearchCandidates).toHaveBeenCalledWith(scope);
    expectResponseFieldsWhitelisted(body);
    expectNoForbiddenLeak(body);
  });

  it('empty query 返回 readonly empty 且不读取候选', async () => {
    const repository = createRepository();
    const result = await searchV1KnowledgeBaseRuntime({
      repository,
      input: {
        ...scope,
        query: '   ',
      },
    });

    expect(result).toEqual({
      status: 'empty_query',
      readonly: true,
      query: '',
      resultCount: 0,
      results: [],
    });
    expect(repository.listSearchCandidates).not.toHaveBeenCalled();
    expectNoForbiddenLeak(result);
  });

  it('no indexed chunks 返回 empty', async () => {
    const repository = createRepository({
      listSearchCandidates: vi.fn(async () => []),
    });
    const result = await searchV1KnowledgeBaseRuntime({
      repository,
      input: {
        ...scope,
        query: '水光 护理',
      },
    });

    expect(result).toEqual({
      status: 'empty',
      readonly: true,
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      workspaceId: scope.workspaceId,
      query: '水光 护理',
      mode: 'demo_search_mock_embedding',
      resultCount: 0,
      results: [],
    });
  });

  it('scope mismatch / denied 返回低敏拒绝且不泄露跨 scope 数据', async () => {
    const repository = createRepository({
      listSearchCandidates: vi.fn(async () => [
        {
          ...candidates[0],
          tenantId: 'other-tenant',
          title: 'other tenant hidden',
        },
      ]),
    });
    const result = await searchV1KnowledgeBaseRuntime({
      repository,
      input: {
        ...scope,
        query: '水光 护理',
      },
    });

    expect(result).toEqual({
      status: 'denied',
      readonly: true,
    });
    expect(JSON.stringify(result)).not.toContain('other tenant hidden');
  });

  it('ranking deterministic', async () => {
    const repository = createRepository();
    const first = await searchV1KnowledgeBaseRuntime({
      repository,
      input: {
        ...scope,
        query: '水光 护理',
      },
    });
    const second = await searchV1KnowledgeBaseRuntime({
      repository,
      input: {
        ...scope,
        query: '水光 护理',
      },
    });

    expect(second).toEqual(first);
    if (first.status !== 'ready') {
      throw new Error('expected ready search result');
    }
    expect(first.results.map((result) => result.chunkId)).toEqual([
      'kb-chunk-hydro-care',
      'kb-chunk-photoelectric-care',
    ]);
  });
});
