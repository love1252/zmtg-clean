import { existsSync, readFileSync } from 'node:fs';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InstitutionWorkspace } from '@/modules/workspace/components/InstitutionWorkspace';
import { handleSearchGET } from '@/modules/knowledge-base/server/v1-knowledge-base-runtime-api-routes';
import {
  chunkV1KnowledgeBaseRuntimeDocument,
  parseV1KnowledgeBaseRuntimeDocument,
  uploadV1KnowledgeBaseRuntimeDocumentService,
  type V1KnowledgeBaseUploadParseChunkRuntimeRepository,
} from '@/modules/knowledge-base/server/v1-knowledge-base-upload-parse-chunk-runtime';
import {
  createMockDemoKnowledgeBaseEmbedding,
  runV1KnowledgeBaseEmbeddingVectorIndexJob,
  type V1KnowledgeBaseEmbeddingVectorIndexRuntimeEmbeddingInput,
  type V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository,
} from '@/modules/knowledge-base/server/v1-knowledge-base-embedding-vector-index-runtime';
import type {
  V1KnowledgeBaseSearchRuntimeCandidate,
  V1KnowledgeBaseSearchRuntimeRepository,
} from '@/modules/knowledge-base/server/v1-knowledge-base-search-runtime';
import type {
  V1KnowledgeBaseRuntimeFoundationChunkSummary,
  V1KnowledgeBaseRuntimeFoundationDocumentSummary,
  V1KnowledgeBaseRuntimeFoundationSourceKind,
  V1KnowledgeBaseRuntimeFoundationSourceSummary,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';

const reviewPath =
  'docs/product/reviews/2026-06-13-v1-knowledge-base-mvp-e2e-acceptance-01.md';

const scope = {
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
};

type StoredChunk = V1KnowledgeBaseRuntimeFoundationChunkSummary & {
  chunkText: string;
  charLength: number;
};

type MvpMemoryStore = {
  sources: V1KnowledgeBaseRuntimeFoundationSourceSummary[];
  documents: V1KnowledgeBaseRuntimeFoundationDocumentSummary[];
  chunks: StoredChunk[];
  embeddings: V1KnowledgeBaseEmbeddingVectorIndexRuntimeEmbeddingInput[];
  indexedChunkTexts: Map<string, string>;
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
}

function createStore(): MvpMemoryStore {
  return {
    sources: [],
    documents: [],
    chunks: [],
    embeddings: [],
    indexedChunkTexts: new Map(),
  };
}

function createUploadRepository(store: MvpMemoryStore): V1KnowledgeBaseUploadParseChunkRuntimeRepository {
  return {
    async createDemoSource(input) {
      const record = {
        sourceId: input.id,
        sourceKind: input.sourceKind,
        status: 'ready' as const,
        readonlyStatus: 'readonly' as const,
        label: input.sourceLabel,
        readonly: true as const,
      };
      store.sources.push(record);
      return { status: 'created' as const, record };
    },
    async createDemoDocument(input) {
      const record = {
        documentId: input.id,
        sourceId: input.sourceId,
        sourceKind: input.sourceKind,
        status: 'ready' as const,
        readonlyStatus: 'readonly' as const,
        title: input.title,
        version: input.version,
        readonly: true as const,
      };
      store.documents.push(record);
      return { status: 'created' as const, record };
    },
    async createDemoChunk(input) {
      const record = {
        chunkId: input.id,
        documentId: input.documentId,
        sourceKind: input.sourceKind,
        status: 'ready' as const,
        readonlyStatus: 'readonly' as const,
        label: input.chunkLabel,
        chunkIndex: input.chunkIndex,
        readonly: true as const,
        chunkText: store.indexedChunkTexts.get(input.id) ?? input.chunkLabel,
        charLength: Number(input.chunkLabel.match(/chars:(\d+)/u)?.[1] ?? 0),
      };
      store.chunks.push(record);
      return { status: 'created' as const, record };
    },
    async listReadonlySummaries() {
      return {
        ...scope,
        status: 'ready' as const,
        readonly: true as const,
        sourceCount: store.sources.length,
        documentCount: store.documents.length,
        chunkCount: store.chunks.length,
        indexJobCount: 1,
        sourceSummaries: store.sources,
        documentSummaries: store.documents,
        chunkSummaries: store.chunks,
        indexJobSummaries: [],
        riskFlags: [],
        recommendedReadonlyActions: ['review_knowledge_base_foundation_readonly'],
      };
    },
  };
}

function createIndexRepository(
  store: MvpMemoryStore,
  documentId: string,
): V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository {
  return {
    async listPendingChunksForIndexJob() {
      return store.chunks
        .filter((chunk) => chunk.documentId === documentId)
        .map((chunk) => ({
          ...scope,
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          chunkText: chunk.chunkText,
          chunkIndex: chunk.chunkIndex,
        }));
    },
    async createChunkEmbedding(input) {
      store.embeddings.push(input);
      return {
        status: 'created' as const,
        record: {
          embeddingId: input.id,
          chunkId: input.chunkId,
          embeddingProvider: input.embeddingProvider,
          embeddingDimensions: input.embeddingDimensions,
          status: 'ready' as const,
          readonly: true as const,
        },
      };
    },
    async updateIndexJobStatus() {
      return { status: 'updated' as const };
    },
    async listIndexJobSummaries() {
      return [
        {
          ...scope,
          jobId: 'kb-index-job-mvp-e2e',
          documentId,
          status: 'ready' as const,
          embeddingCount: store.embeddings.length,
          readonly: true as const,
        },
      ];
    },
  };
}

function createSearchRepository(store: MvpMemoryStore): V1KnowledgeBaseSearchRuntimeRepository {
  return {
    async listSearchCandidates() {
      return store.embeddings.map((embedding): V1KnowledgeBaseSearchRuntimeCandidate => {
        const chunk = store.chunks.find((item) => item.chunkId === embedding.chunkId);
        const document = store.documents.find((item) => item.documentId === chunk?.documentId);

        return {
          ...scope,
          chunkId: embedding.chunkId,
          documentId: chunk?.documentId ?? 'missing-document',
          title: document?.title ?? '知识库 MVP demo 结果',
          snippet: chunk?.label ?? 'chunk:0 / chars:0',
          sourceKind: chunk?.sourceKind ?? 'demo',
          chunkIndex: chunk?.chunkIndex ?? 0,
          embeddingDimensions: embedding.embeddingDimensions,
          embeddingVectorJson: embedding.embeddingVectorJson,
          readonly: true,
        };
      });
    },
  };
}

function uploadPayload(input: {
  fileName: string;
  mimeType: string;
  content: string;
  sourceKind?: V1KnowledgeBaseRuntimeFoundationSourceKind;
}) {
  return {
    ...scope,
    sourceKind: input.sourceKind ?? 'demo',
    fileName: input.fileName,
    mimeType: input.mimeType,
    content: input.content,
  };
}

async function uploadIntoStore(
  store: MvpMemoryStore,
  input: ReturnType<typeof uploadPayload>,
) {
  const parsed = parseV1KnowledgeBaseRuntimeDocument(input);
  if (parsed.status !== 'parsed') {
    throw new Error(`expected parsed document for ${input.fileName}`);
  }
  const chunks = chunkV1KnowledgeBaseRuntimeDocument({ text: parsed.text });
  const prefixProbe = await uploadV1KnowledgeBaseRuntimeDocumentService({
    repository: createUploadRepository(store),
    input,
  });
  if (prefixProbe.status !== 'created') {
    throw new Error(`expected created upload for ${input.fileName}`);
  }

  prefixProbe.chunks.forEach((chunk, index) => {
    const parsedChunk = chunks[index];
    if (parsedChunk) {
      const stored = store.chunks.find((item) => item.chunkId === chunk.chunkId);
      if (stored) {
        stored.chunkText = parsedChunk.chunkText;
        stored.charLength = parsedChunk.charLength;
      }
    }
  });

  return { response: prefixProbe, parsed, chunks };
}

function expectNoForbiddenLeak(payload: unknown) {
  const serialized = JSON.stringify(payload);
  [
    'raw',
    'payload',
    'credential',
    'prompt',
    'completion',
    'token',
    'secret',
    '真实 HIS',
    '真实客户数据',
    '真实模型',
    'PDF',
    'Word',
    'OCR',
    '图片',
    '二进制',
    '营销',
    '触达',
    '预约',
    '成交',
    '支付',
    '合同',
    '发票',
  ].forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function buildKnowledgeBaseDemoReadonlyResponse() {
  return {
    requestId: 'mvp-e2e-demo-readonly',
    ...scope,
    status: 'ready',
    summary: {
      title: '知识库 demo readonly API 契约',
      statusText: 'ready / readonly',
      description: '知识库 demo readonly API 可用于低敏只读演示',
    },
    categories: [],
    folders: [],
    knowledgeItems: [],
    taskRecords: [],
    searchPreview: {
      query: '水光 护理',
      summary: '仅展示 demo 预览，不进行真实查找',
      resultCount: 0,
      results: [],
      readonly: true,
    },
    facade: { status: 'ready', readonly: true },
    riskFlags: [],
    recommendedReadonlyActions: ['review_demo_readonly_summary'],
  };
}

function createWorkspaceFetch(searchBody: unknown) {
  const fetchMock = vi.fn(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (path === '/api/institution/customers') return jsonResponse({ records: [] });
    if (path === '/api/institution/appointments') return jsonResponse({ records: [] });
    if (path === '/api/institution/followups') return jsonResponse({ records: [] });
    if (path === '/api/institution/follow-up-path-analysis') {
      return jsonResponse({
        templateSuggestionCount: 0,
        confirmedSourceTaskCount: 0,
        completedTaskCount: 0,
        overdueTaskCount: 0,
        voidedSummaryBlockedCount: 0,
        duplicateSourceTaskConflictCount: 0,
        warnings: [],
      });
    }
    if (path === '/api/v1/knowledge-base/demo-readonly') {
      return jsonResponse(buildKnowledgeBaseDemoReadonlyResponse());
    }
    if (path === '/api/v1/workspace-dashboard/readonly-aggregation') {
      return jsonResponse({
        requestId: 'mvp-e2e-workspace-readonly-aggregation',
        ...scope,
        status: 'ready',
        dashboardStatus: 'ready',
        readonly: true,
        summary: {
          title: 'workspace dashboard readonly aggregation API 契约',
          statusText: 'ready / ready',
          description: 'workspace dashboard 只读聚合可用于 demo 摘要展示',
        },
        businessLoop: {
          sectionId: 'business-loop',
          label: 'business-loop',
          summary: 'demo business loop readonly',
          readonly: true,
        },
        managementConfig: {
          sectionId: 'management-config',
          label: 'management-config',
          summary: 'demo management config readonly',
          readonly: true,
        },
        knowledgeGovernance: {
          sectionId: 'knowledge-governance',
          label: 'knowledge-governance',
          summary: 'demo knowledge governance readonly',
          readonly: true,
        },
        readonlyPolicy: {
          sectionId: 'readonly-policy',
          label: 'readonly-policy',
          summary: 'demo readonly policy',
          readonly: true,
        },
        taskRecords: [
          {
            recordId: 'workspace-dashboard-readonly-aggregation-ready',
            status: 'ready',
            title: 'workspace dashboard readonly aggregation',
            failureReason: 'not_available',
            readonly: true,
          },
        ],
        aggregation: {
          status: 'ready',
          reasonCode: 'ready',
          resultCode: 'ready',
          dashboardStatus: 'ready',
          businessLoopSummary: 'demo business loop readonly',
          managementConfigSummary: 'demo management config readonly',
          knowledgeGovernanceSummary: 'demo knowledge governance readonly',
          fieldWhitelistSummary: 'demo field whitelist readonly',
          readonlyFeaturePolicySummary: 'demo readonly feature policy',
          readonly: true,
        },
        riskFlags: [],
        recommendedReadonlyActions: ['review_workspace_readonly_summary'],
      });
    }
    if (path.startsWith('/api/v1/knowledge-base/runtime/search')) {
      return jsonResponse(searchBody);
    }

    return jsonResponse({ records: [] }, { status: 200 });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('V1 知识库 MVP 端到端验收收口', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('受控链路覆盖 upload -> parse -> chunk -> index -> search API -> UI demo', async () => {
    const store = createStore();
    const markdownPayload = uploadPayload({
      fileName: 'mvp-demo.md',
      mimeType: 'text/markdown',
      content: 'alpha demo care\n\nbeta demo recovery',
    });
    const textUpload = await uploadIntoStore(
      store,
      uploadPayload({
        fileName: 'mvp-demo.txt',
        mimeType: 'text/plain',
        content: 'plain demo text',
        sourceKind: 'mock',
      }),
    );
    const markdownUpload = await uploadIntoStore(store, markdownPayload);
    const jsonUpload = await uploadIntoStore(
      store,
      uploadPayload({
        fileName: 'mvp-demo.json',
        mimeType: 'application/json',
        content: '{"title":"json demo","items":["alpha","beta"]}',
        sourceKind: 'seed',
      }),
    );

    expect([textUpload.response.status, markdownUpload.response.status, jsonUpload.response.status]).toEqual([
      'created',
      'created',
      'created',
    ]);
    expect(markdownUpload.chunks).toEqual([
      { chunkIndex: 0, chunkText: 'alpha demo care', charLength: 15 },
      { chunkIndex: 1, chunkText: 'beta demo recovery', charLength: 18 },
    ]);
    expect(markdownUpload.response).toMatchObject({
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      workspaceId: scope.workspaceId,
      chunks: [
        expect.objectContaining({ chunkIndex: 0, charLength: 15 }),
        expect.objectContaining({ chunkIndex: 1, charLength: 18 }),
      ],
    });

    const unsupported = await uploadV1KnowledgeBaseRuntimeDocumentService({
      repository: createUploadRepository(store),
      input: uploadPayload({
        fileName: 'blocked.pdf',
        mimeType: 'application/pdf',
        content: 'blocked binary document',
      }),
    });
    const empty = await uploadV1KnowledgeBaseRuntimeDocumentService({
      repository: createUploadRepository(store),
      input: uploadPayload({
        fileName: 'empty.md',
        mimeType: 'text/markdown',
        content: '   ',
      }),
    });
    expect(unsupported).toEqual({ status: 'unsupported_file_type', readonly: true });
    expect(empty).toEqual({ status: 'empty_content', readonly: true });

    const indexResult = await runV1KnowledgeBaseEmbeddingVectorIndexJob({
      repository: createIndexRepository(store, markdownUpload.response.document.documentId),
      input: {
        ...scope,
        jobId: 'kb-index-job-mvp-e2e',
      },
    });

    expect(indexResult).toMatchObject({
      status: 'ready',
      readonly: true,
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      workspaceId: scope.workspaceId,
      embeddingCount: 2,
      embeddings: [
        expect.objectContaining({ embeddingProvider: 'mock_demo_embedding' }),
        expect.objectContaining({ embeddingProvider: 'mock_demo_embedding' }),
      ],
    });
    expect(store.embeddings.map((embedding) => embedding.embeddingVectorJson)).toEqual([
      createMockDemoKnowledgeBaseEmbedding('alpha demo care', 8).vector,
      createMockDemoKnowledgeBaseEmbedding('beta demo recovery', 8).vector,
    ]);

    const searchParams = new URLSearchParams({
      q: 'alpha care',
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      workspaceId: scope.workspaceId,
    });
    const firstSearchResponse = await handleSearchGET(
      new Request(`http://localhost/api/v1/knowledge-base/runtime/search?${searchParams.toString()}`),
      { repository: createSearchRepository(store) },
    );
    const secondSearchResponse = await handleSearchGET(
      new Request(`http://localhost/api/v1/knowledge-base/runtime/search?${searchParams.toString()}`),
      { repository: createSearchRepository(store) },
    );
    const firstSearchBody = await firstSearchResponse.json();
    const secondSearchBody = await secondSearchResponse.json();

    expect(firstSearchResponse.status).toBe(200);
    expect(secondSearchBody).toEqual(firstSearchBody);
    expect(firstSearchBody).toMatchObject({
      status: 'ready',
      readonly: true,
      mode: 'demo_search_mock_embedding',
      resultCount: 2,
    });
    expect(firstSearchBody.results.map((result: { chunkIndex: number }) => result.chunkIndex).sort()).toEqual([
      0,
      1,
    ]);
    expect(
      firstSearchBody.results.every(
        (result: { sourceKind: string; readonly: boolean }) =>
          result.sourceKind === 'demo' && result.readonly === true,
      ),
    ).toBe(true);
    expect(JSON.stringify(firstSearchBody)).not.toContain('embeddingVectorJson');
    expect(JSON.stringify(firstSearchBody)).not.toContain('chunkText');
    expectNoForbiddenLeak(firstSearchBody);

    const fetchMock = createWorkspaceFetch(firstSearchBody);
    const { container } = render(createElement(InstitutionWorkspace));
    const knowledgeBaseSection = (await screen.findByRole('heading', {
      name: '知识库只读入口',
    })).closest('section');
    expect(knowledgeBaseSection).not.toBeNull();
    const knowledgeBaseView = within(knowledgeBaseSection as HTMLElement);

    expect(await knowledgeBaseView.findByText('只读 search API')).toBeInTheDocument();
    expect(knowledgeBaseView.getByLabelText('知识库只读搜索查询')).toBeInTheDocument();
    fireEvent.change(knowledgeBaseView.getByLabelText('知识库只读搜索查询'), {
      target: { value: 'alpha care' },
    });

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => {
        const path = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        return path.startsWith('/api/v1/knowledge-base/runtime/search?q=');
      })).toBe(true);
    });
    expect(knowledgeBaseView.queryByText('mvp-demo.md')).not.toBeInTheDocument();
    expect(knowledgeBaseView.getAllByText('readonly_search').length).toBeGreaterThan(0);
    expect(within(knowledgeBaseSection as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
    const searchPanel = screen.getByRole('heading', { name: '知识库只读搜索' }).closest('div');
    expect(searchPanel).not.toBeNull();
    const searchCall = fetchMock.mock.calls.find(([input]) => {
      const path = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return path.startsWith('/api/v1/knowledge-base/runtime/search?q=');
    });
    expect(searchCall).toBeDefined();
    expect(searchCall?.[1]).toEqual({ cache: 'no-store' });
    expect(searchCall?.[1]?.method).toBeUndefined();
    expect(searchCall?.[1]?.body).toBeUndefined();
    expectNoForbiddenLeak(searchPanel?.textContent ?? '');
    expect(container.textContent ?? '').not.toContain('真实模型');
  });

  it('收口文档明确 5 个目标完成情况、GO / NO-GO 和生产化前置任务', () => {
    expect(existsSync(reviewPath)).toBe(true);
    const review = readFileSync(reviewPath, 'utf8');

    [
      'ZMTG-V1-KNOWLEDGE-BASE-MVP-E2E-ACCEPTANCE-01',
      '目标 1',
      '目标 2',
      '目标 3',
      '目标 4',
      '目标 5',
      'GO: internal controlled MVP demo',
      'NO-GO: production / real customer data / real model / HIS',
      '仅 demo / mock / seed / 低敏数据',
      '真实 HIS',
      'credential',
      '真实客户数据',
      '真实模型',
      '生产检索',
      '自动业务写入',
      '后续生产化前置任务清单',
    ].forEach((fragment) => {
      expect(review).toContain(fragment);
    });
  });
});
