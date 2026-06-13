import { describe, expect, it, vi } from 'vitest';
import {
  handleDocumentsGET,
  handleUploadPOST,
} from '@/modules/knowledge-base/server/v1-knowledge-base-runtime-api-routes';
import {
  chunkV1KnowledgeBaseRuntimeDocument,
  parseV1KnowledgeBaseRuntimeDocument,
  uploadV1KnowledgeBaseRuntimeDocumentService,
  v1KnowledgeBaseUploadParseChunkRuntimeResponseFields,
  type V1KnowledgeBaseUploadParseChunkRuntimeRepository,
} from '@/modules/knowledge-base/server/v1-knowledge-base-upload-parse-chunk-runtime';
import type { V1KnowledgeBaseRuntimeFoundationReadonlySummary } from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';

const uploadUrl = 'http://localhost/api/v1/knowledge-base/runtime/documents/upload';
const documentsUrl = 'http://localhost/api/v1/knowledge-base/runtime/documents';

const scope = {
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
};

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
  const allowedFields = new Set<string>(v1KnowledgeBaseUploadParseChunkRuntimeResponseFields);

  expect(fields.filter((field) => !allowedFields.has(field))).toEqual([]);
}

function expectNoForbiddenRuntimeLeak(payload: unknown) {
  const serialized = JSON.stringify(payload);

  [
    'raw',
    'payload',
    'credential',
    'token',
    'secret',
    'HIS',
    '真实客户',
    '模型',
    'embedding',
    'vector',
    'retrieval',
    'phone',
    'idCard',
    'medicalRecord',
    'payment',
    'contract',
    'invoice',
    'createTask',
    'autoMarketing',
    'autoTouch',
  ].forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

function readySummary(): V1KnowledgeBaseRuntimeFoundationReadonlySummary {
  return {
    status: 'ready',
    readonly: true,
    ...scope,
    sourceCount: 1,
    documentCount: 1,
    chunkCount: 2,
    indexJobCount: 0,
    sourceSummaries: [
      {
        sourceId: 'kb-source-demo-upload-001',
        sourceKind: 'demo',
        status: 'ready',
        readonlyStatus: 'readonly',
        label: 'demo-upload.md',
        readonly: true,
      },
    ],
    documentSummaries: [
      {
        documentId: 'kb-document-demo-upload-001',
        sourceId: 'kb-source-demo-upload-001',
        sourceKind: 'demo',
        status: 'ready',
        readonlyStatus: 'readonly',
        title: 'demo-upload.md',
        version: 'v1-demo-upload',
        readonly: true,
      },
    ],
    chunkSummaries: [
      {
        chunkId: 'kb-chunk-demo-upload-001-0',
        documentId: 'kb-document-demo-upload-001',
        sourceKind: 'demo',
        status: 'ready',
        readonlyStatus: 'readonly',
        label: 'chunk:0 / chars:120',
        chunkIndex: 0,
        readonly: true,
      },
      {
        chunkId: 'kb-chunk-demo-upload-001-1',
        documentId: 'kb-document-demo-upload-001',
        sourceKind: 'demo',
        status: 'ready',
        readonlyStatus: 'readonly',
        label: 'chunk:1 / chars:80',
        chunkIndex: 1,
        readonly: true,
      },
    ],
    indexJobSummaries: [],
    riskFlags: [],
    recommendedReadonlyActions: ['review_knowledge_base_foundation_readonly'],
  };
}

function createRepository(overrides: Partial<V1KnowledgeBaseUploadParseChunkRuntimeRepository> = {}) {
  const repository = {
    createDemoSource: vi.fn(async () => ({
      status: 'created' as const,
      record: readySummary().sourceSummaries[0],
    })),
    createDemoDocument: vi.fn(async () => ({
      status: 'created' as const,
      record: readySummary().documentSummaries[0],
    })),
    createDemoChunk: vi.fn(async (input: { id: string; chunkIndex: number }) => ({
      status: 'created' as const,
      record: {
        ...readySummary().chunkSummaries[0],
        chunkId: input.id,
        chunkIndex: input.chunkIndex,
      },
    })),
    listReadonlySummaries: vi.fn(async () => readySummary()),
    ...overrides,
  } satisfies V1KnowledgeBaseUploadParseChunkRuntimeRepository;

  return repository;
}

function uploadRequest(body: unknown) {
  return new Request(uploadUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('V1 知识库上传 / 解析 / 分块 runtime', () => {
  it('parser 支持 plain text / markdown / json text 且不访问外部 runtime', () => {
    expect(
      parseV1KnowledgeBaseRuntimeDocument({
        fileName: 'demo.txt',
        mimeType: 'text/plain',
        content: '第一段 demo 知识\n\n第二段 demo 知识',
      }),
    ).toMatchObject({ status: 'parsed', text: '第一段 demo 知识\n\n第二段 demo 知识' });
    expect(
      parseV1KnowledgeBaseRuntimeDocument({
        fileName: 'demo.md',
        mimeType: 'text/markdown',
        content: '# 标题\n\n- demo 条目',
      }),
    ).toMatchObject({ status: 'parsed', text: '# 标题\n\n- demo 条目' });
    expect(
      parseV1KnowledgeBaseRuntimeDocument({
        fileName: 'demo.json',
        mimeType: 'application/json',
        content: '{"title":"demo","items":["a","b"]}',
      }),
    ).toMatchObject({ status: 'parsed' });
  });

  it('parser 拒绝 unsupported file type / oversized file / empty content / parse failed', () => {
    expect(
      parseV1KnowledgeBaseRuntimeDocument({
        fileName: 'demo.pdf',
        mimeType: 'application/pdf',
        content: 'pdf is not supported',
      }),
    ).toEqual({ status: 'unsupported_file_type' });
    expect(
      parseV1KnowledgeBaseRuntimeDocument({
        fileName: 'huge.txt',
        mimeType: 'text/plain',
        content: 'x'.repeat(32_001),
      }),
    ).toEqual({ status: 'oversized_file' });
    expect(
      parseV1KnowledgeBaseRuntimeDocument({
        fileName: 'empty.md',
        mimeType: 'text/markdown',
        content: '   ',
      }),
    ).toEqual({ status: 'empty_content' });
    expect(
      parseV1KnowledgeBaseRuntimeDocument({
        fileName: 'bad.json',
        mimeType: 'application/json',
        content: '{',
      }),
    ).toEqual({ status: 'parse_failed' });
  });

  it('chunker deterministic 生成 chunkIndex / chunkText / charLength 且不做 embedding', () => {
    const first = chunkV1KnowledgeBaseRuntimeDocument({
      text: ['alpha demo knowledge', 'beta demo knowledge', 'gamma demo knowledge'].join('\n\n'),
      maxChars: 24,
    });
    const second = chunkV1KnowledgeBaseRuntimeDocument({
      text: ['alpha demo knowledge', 'beta demo knowledge', 'gamma demo knowledge'].join('\n\n'),
      maxChars: 24,
    });

    expect(second).toEqual(first);
    expect(first).toEqual([
      expect.objectContaining({ chunkIndex: 0, chunkText: expect.any(String), charLength: 20 }),
      expect.objectContaining({ chunkIndex: 1, chunkText: expect.any(String), charLength: 19 }),
      expect.objectContaining({ chunkIndex: 2, chunkText: expect.any(String), charLength: 20 }),
    ]);
    expect(JSON.stringify(first)).not.toContain('embedding');
    expect(JSON.stringify(first)).not.toContain('vector');
    expect(JSON.stringify(first)).not.toContain('retrieval');
  });

  it('upload happy path 写入 source / document / chunks 并返回低敏 summary', async () => {
    const repository = createRepository();
    const result = await uploadV1KnowledgeBaseRuntimeDocumentService({
      repository,
      input: {
        ...scope,
        sourceKind: 'demo',
        fileName: 'demo-upload.md',
        mimeType: 'text/markdown',
        content: '第一段 demo 知识内容。\n\n第二段 demo 知识内容。',
      },
    });

    expect(result).toMatchObject({
      status: 'created',
      readonly: true,
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      workspaceId: scope.workspaceId,
      source: expect.objectContaining({ sourceKind: 'demo', readonly: true }),
      document: expect.objectContaining({ title: 'demo-upload.md', readonly: true }),
      indexJob: { status: 'not_started', readonly: true },
    });
    if (result.status !== 'created') {
      throw new Error('expected upload runtime service to create document');
    }
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(repository.createDemoSource).toHaveBeenCalledTimes(1);
    expect(repository.createDemoDocument).toHaveBeenCalledTimes(1);
    expect(repository.createDemoChunk).toHaveBeenCalled();
    expectNoForbiddenRuntimeLeak(result);
  });

  it('upload service 保留 tenant / institution / workspace scope 并拒绝非 mock / seed / demo', async () => {
    const repository = createRepository();
    await uploadV1KnowledgeBaseRuntimeDocumentService({
      repository,
      input: {
        ...scope,
        sourceKind: 'seed',
        fileName: 'seed.txt',
        mimeType: 'text/plain',
        content: 'seed knowledge',
      },
    });

    expect(repository.createDemoSource).toHaveBeenCalledWith(
      expect.objectContaining(scope),
    );
    expect(repository.createDemoDocument).toHaveBeenCalledWith(
      expect.objectContaining(scope),
    );
    expect(repository.createDemoChunk).toHaveBeenCalledWith(
      expect.objectContaining(scope),
    );

    await expect(
      uploadV1KnowledgeBaseRuntimeDocumentService({
        repository,
        input: {
          ...scope,
          sourceKind: 'external' as never,
          fileName: 'external.txt',
          mimeType: 'text/plain',
          content: 'external knowledge',
        },
      }),
    ).resolves.toEqual({ status: 'rejected_non_demo_input', readonly: true });
  });

  it('POST upload route 返回 created / unsupported / oversized / empty / parse failed', async () => {
    const repository = createRepository();
    const created = await handleUploadPOST(
      uploadRequest({
        ...scope,
        sourceKind: 'demo',
        fileName: 'demo-upload.md',
        mimeType: 'text/markdown',
        content: '第一段 demo 知识内容。\n\n第二段 demo 知识内容。',
      }),
      { repository },
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.status).toBe('created');
    expectResponseFieldsWhitelisted(createdBody);
    expectNoForbiddenRuntimeLeak(createdBody);

    const unsupported = await handleUploadPOST(
      uploadRequest({ ...scope, sourceKind: 'demo', fileName: 'x.pdf', mimeType: 'application/pdf', content: 'x' }),
      { repository },
    );
    expect(unsupported.status).toBe(415);

    const oversized = await handleUploadPOST(
      uploadRequest({ ...scope, sourceKind: 'demo', fileName: 'x.txt', mimeType: 'text/plain', content: 'x'.repeat(32_001) }),
      { repository },
    );
    expect(oversized.status).toBe(413);

    const empty = await handleUploadPOST(
      uploadRequest({ ...scope, sourceKind: 'demo', fileName: 'x.txt', mimeType: 'text/plain', content: '   ' }),
      { repository },
    );
    expect(empty.status).toBe(400);

    const parseFailed = await handleUploadPOST(
      uploadRequest({ ...scope, sourceKind: 'demo', fileName: 'x.json', mimeType: 'application/json', content: '{' }),
      { repository },
    );
    expect(parseFailed.status).toBe(400);
  });

  it('GET documents route 返回 readonly summaries 且不暴露敏感 runtime 片段', async () => {
    const repository = createRepository();
    const response = await handleDocumentsGET(new Request(documentsUrl), { repository });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      tenantId: scope.tenantId,
      institutionId: scope.institutionId,
      workspaceId: scope.workspaceId,
      status: 'ready',
      readonly: true,
      summary: expect.objectContaining({
        sourceCount: 1,
        documentCount: 1,
        chunkCount: 2,
      }),
    });
    expect(repository.listReadonlySummaries).toHaveBeenCalledWith(scope);
    expectNoForbiddenRuntimeLeak(body);
  });
});
