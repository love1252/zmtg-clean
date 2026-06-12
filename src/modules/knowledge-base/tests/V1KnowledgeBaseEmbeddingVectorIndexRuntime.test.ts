import { readFileSync } from 'node:fs';

import { getTableName } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import * as runRoute from '@/app/api/v1/knowledge-base/runtime/index-jobs/run/route';
import * as jobsRoute from '@/app/api/v1/knowledge-base/runtime/index-jobs/route';
import { knowledgeChunkEmbeddings } from '@/server/db/schema';
import {
  createMockDemoKnowledgeBaseEmbedding,
  runV1KnowledgeBaseEmbeddingVectorIndexJob,
  v1KnowledgeBaseEmbeddingVectorIndexRuntimeResponseFields,
  type V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository,
} from '@/modules/knowledge-base/server/v1-knowledge-base-embedding-vector-index-runtime';

const runUrl = 'http://localhost/api/v1/knowledge-base/runtime/index-jobs/run';
const jobsUrl = 'http://localhost/api/v1/knowledge-base/runtime/index-jobs';

const scope = {
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
};

const chunks = [
  {
    chunkId: 'kb-chunk-demo-001',
    documentId: 'kb-document-demo-001',
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    workspaceId: scope.workspaceId,
    chunkText: 'alpha demo knowledge',
    chunkIndex: 0,
  },
  {
    chunkId: 'kb-chunk-demo-002',
    documentId: 'kb-document-demo-001',
    tenantId: scope.tenantId,
    institutionId: scope.institutionId,
    workspaceId: scope.workspaceId,
    chunkText: 'beta demo knowledge',
    chunkIndex: 1,
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
  const allowedFields = new Set<string>(v1KnowledgeBaseEmbeddingVectorIndexRuntimeResponseFields);

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
    '模型输出',
    'prompt',
    'completion',
    'retrieval',
    'phone',
    'medicalRecord',
    'payment',
    'contract',
    'invoice',
    'fetch',
    'OPENAI',
    'API_KEY',
  ].forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function createRepository(
  overrides: Partial<V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository> = {},
) {
  const repository = {
    listPendingChunksForIndexJob: vi.fn(async () => chunks),
    createChunkEmbedding: vi.fn(async (input: { chunkId: string }) => ({
      status: 'created' as const,
      record: {
        embeddingId: `embedding-${input.chunkId}`,
        chunkId: input.chunkId,
        embeddingProvider: 'mock_demo_embedding' as const,
        embeddingDimensions: 8,
        status: 'ready' as const,
        readonly: true as const,
      },
    })),
    updateIndexJobStatus: vi.fn(async () => ({ status: 'updated' as const })),
    listIndexJobSummaries: vi.fn(async () => [
      {
        jobId: 'kb-index-job-demo-001',
        documentId: 'kb-document-demo-001',
        tenantId: scope.tenantId,
        institutionId: scope.institutionId,
        workspaceId: scope.workspaceId,
        status: 'ready' as const,
        embeddingCount: 2,
        readonly: true as const,
      },
    ]),
    ...overrides,
  } satisfies V1KnowledgeBaseEmbeddingVectorIndexRuntimeRepository;

  return repository;
}

function postRequest(body: unknown) {
  return new Request(runUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('V1 知识库 embedding / 向量索引 runtime', () => {
  it('migration/schema 新增 knowledge_chunk_embeddings 且不存敏感原文', () => {
    const migration = readFileSync(
      'drizzle/0010_v1_knowledge_base_embedding_vector_index_runtime.sql',
      'utf8',
    );

    expect(getTableName(knowledgeChunkEmbeddings)).toBe('knowledge_chunk_embeddings');
    [
      'CREATE TABLE "knowledge_chunk_embeddings"',
      '"chunk_id" varchar(64) NOT NULL',
      '"tenant_id" varchar(64) NOT NULL',
      '"institution_id" varchar(64) NOT NULL',
      '"workspace_id" varchar(64) NOT NULL',
      '"embedding_provider" varchar(64) DEFAULT \'mock_demo_embedding\' NOT NULL',
      '"embedding_model" varchar(96) DEFAULT \'mock-demo-embedding-v1\' NOT NULL',
      '"embedding_dimensions" integer NOT NULL',
      '"embedding_vector_json" jsonb NOT NULL',
      '"status" "knowledge_base_runtime_status" DEFAULT \'ready\' NOT NULL',
      '"created_at" timestamp with time zone DEFAULT now() NOT NULL',
      '"updated_at" timestamp with time zone DEFAULT now() NOT NULL',
    ].forEach((fragment) => {
      expect(migration).toContain(fragment);
    });
    ['raw_prompt', 'raw_payload', 'credential', 'token', 'secret', 'prompt', 'completion'].forEach(
      (fragment) => {
        expect(migration).not.toContain(fragment);
      },
    );
  });

  it('mock embedding deterministic 且不调用真实模型 / 网络 / credential', () => {
    const first = createMockDemoKnowledgeBaseEmbedding('alpha demo knowledge', 8);
    const second = createMockDemoKnowledgeBaseEmbedding('alpha demo knowledge', 8);
    const different = createMockDemoKnowledgeBaseEmbedding('beta demo knowledge', 8);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      provider: 'mock_demo_embedding',
      model: 'mock-demo-embedding-v1',
      dimensions: 8,
    });
    expect(first.vector).toHaveLength(8);
    expect(first.vector).not.toEqual(different.vector);
    expectNoForbiddenLeak(first);
  });

  it('empty chunks 时 job 标记 empty 且不创建 embedding', async () => {
    const repository = createRepository({
      listPendingChunksForIndexJob: vi.fn(async () => []),
    });
    const result = await runV1KnowledgeBaseEmbeddingVectorIndexJob({
      repository,
      input: {
        ...scope,
        jobId: 'kb-index-job-demo-empty',
      },
    });

    expect(result).toMatchObject({
      status: 'empty',
      readonly: true,
      embeddingCount: 0,
    });
    expect(repository.createChunkEmbedding).not.toHaveBeenCalled();
    expect(repository.updateIndexJobStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'empty' }),
    );
    expectNoForbiddenLeak(result);
  });

  it('scope mismatch 被拒绝且不创建 embedding', async () => {
    const repository = createRepository({
      listPendingChunksForIndexJob: vi.fn(async () => [
        {
          ...chunks[0],
          tenantId: 'other-tenant',
        },
      ]),
    });
    const result = await runV1KnowledgeBaseEmbeddingVectorIndexJob({
      repository,
      input: {
        ...scope,
        jobId: 'kb-index-job-demo-scope-mismatch',
      },
    });

    expect(result).toEqual({
      status: 'scope_mismatch',
      readonly: true,
    });
    expect(repository.createChunkEmbedding).not.toHaveBeenCalled();
  });

  it('successful index job 基于 chunks 生成 embeddings 并更新 ready', async () => {
    const repository = createRepository();
    const result = await runV1KnowledgeBaseEmbeddingVectorIndexJob({
      repository,
      input: {
        ...scope,
        jobId: 'kb-index-job-demo-001',
      },
    });

    expect(result).toMatchObject({
      status: 'ready',
      readonly: true,
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      workspaceId: scope.workspaceId,
      job: expect.objectContaining({
        jobId: 'kb-index-job-demo-001',
        status: 'ready',
        readonly: true,
      }),
      embeddingCount: 2,
    });
    expect(repository.createChunkEmbedding).toHaveBeenCalledTimes(2);
    expect(repository.createChunkEmbedding).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: scope.tenantId,
        institutionId: scope.institutionId,
        workspaceId: scope.workspaceId,
        chunkId: 'kb-chunk-demo-001',
        embeddingProvider: 'mock_demo_embedding',
        embeddingModel: 'mock-demo-embedding-v1',
        embeddingDimensions: 8,
      }),
    );
    expect(repository.updateIndexJobStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready' }),
    );
    expectResponseFieldsWhitelisted(result);
    expectNoForbiddenLeak(result);
  });

  it('failed job 返回低敏错误且不暴露技术细节', async () => {
    const repository = createRepository({
      createChunkEmbedding: vi.fn(async () => ({ status: 'failed' as const })),
    });
    const result = await runV1KnowledgeBaseEmbeddingVectorIndexJob({
      repository,
      input: {
        ...scope,
        jobId: 'kb-index-job-demo-failed',
      },
    });

    expect(result).toEqual({
      status: 'failed',
      readonly: true,
      failureReason: '知识库 demo embedding 索引生成失败',
    });
    expect(repository.updateIndexJobStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
    expectNoForbiddenLeak(result);
  });

  it('POST run route 与 GET index jobs route 仅返回低敏 summary', async () => {
    const repository = createRepository();
    const runResponse = await runRoute.POST(
      postRequest({
        ...scope,
        jobId: 'kb-index-job-demo-001',
      }),
      { repository },
    );
    expect(runResponse.status).toBe(200);
    const runBody = await runResponse.json();
    expect(runBody.status).toBe('ready');
    expectResponseFieldsWhitelisted(runBody);
    expectNoForbiddenLeak(runBody);

    const jobsResponse = await jobsRoute.GET(new Request(jobsUrl), { repository });
    expect(jobsResponse.status).toBe(200);
    const jobsBody = await jobsResponse.json();
    expect(jobsBody).toMatchObject({
      status: 'ready',
      readonly: true,
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      workspaceId: scope.workspaceId,
      jobs: [
        expect.objectContaining({
          jobId: 'kb-index-job-demo-001',
          embeddingCount: 2,
          readonly: true,
        }),
      ],
    });
    expectResponseFieldsWhitelisted(jobsBody);
    expectNoForbiddenLeak(jobsBody);
  });
});
