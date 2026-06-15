import { readFileSync } from 'node:fs';

import { getTableName } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { TenantDatabase } from '@/server/db/client';
import {
  knowledgeChunks,
  knowledgeDocuments,
  knowledgeIndexJobs,
  knowledgeSources,
} from '@/server/db/schema';
import {
  buildV1KnowledgeBaseRuntimeFoundationApiResponse,
  v1KnowledgeBaseRuntimeFoundationApiResponseFields,
} from '@/modules/knowledge-base/domain/v1-knowledge-base-runtime-foundation-api-contract';
import {
  createV1KnowledgeBaseRuntimeFoundationRepository,
  mapKnowledgeBaseRuntimeFoundationRowsToReadonlySummary,
  type V1KnowledgeBaseRuntimeFoundationReadonlySummary,
} from '@/modules/knowledge-base/server/v1-knowledge-base-runtime-foundation-repository';
import {
  createV1KnowledgeBaseRuntimeFoundationDemoRecordsService,
  getV1KnowledgeBaseRuntimeFoundationReadonlyService,
  type V1KnowledgeBaseRuntimeFoundationPolicy,
} from '@/modules/knowledge-base/server/v1-knowledge-base-runtime-foundation-service';

const now = new Date('2026-06-13T08:00:00.000Z');

const enabledPolicy = {
  featureEnabled: true,
  canReadKnowledgeBaseRuntimeFoundation: true,
  tenantScopeMatched: true,
  institutionScopeMatched: true,
  workspaceScopeMatched: true,
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
} satisfies V1KnowledgeBaseRuntimeFoundationPolicy;

const sourceRow = {
  id: 'kb-source-demo-001',
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
  sourceKind: 'demo',
  status: 'ready',
  readonlyStatus: 'readonly',
  sourceLabel: '知识库 demo 来源',
  createdAt: now,
  updatedAt: now,
} as const;

const documentRow = {
  id: 'kb-document-demo-001',
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
  sourceId: sourceRow.id,
  sourceKind: 'demo',
  status: 'ready',
  readonlyStatus: 'readonly',
  title: '知识库 demo 文档',
  version: 'v1',
  createdAt: now,
  updatedAt: now,
} as const;

const chunkRow = {
  id: 'kb-chunk-demo-001',
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
  documentId: documentRow.id,
  sourceKind: 'demo',
  status: 'ready',
  readonlyStatus: 'readonly',
  chunkLabel: '知识库 demo 片段',
  chunkIndex: 1,
  createdAt: now,
  updatedAt: now,
} as const;

const indexJobRow = {
  id: 'kb-index-job-demo-001',
  tenantId: 'demo-tenant-a',
  institutionId: 'demo-inst-a',
  workspaceId: 'demo-workspace-a',
  documentId: documentRow.id,
  sourceKind: 'demo',
  status: 'ready',
  readonlyStatus: 'readonly',
  jobKind: 'demo_index_prepare',
  createdAt: now,
  updatedAt: now,
} as const;

const forbiddenLowSensitivePattern =
  /raw|payload|credential|token|secret|HIS|真实客户|模型|embedding|vector|retrieval|phone|idCard|medicalRecord|order|payment|contract|invoice/i;

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
  const allowedFields = new Set<string>(v1KnowledgeBaseRuntimeFoundationApiResponseFields);

  expect(fields.filter((field) => !allowedFields.has(field))).toEqual([]);
}

function expectLowSensitivePayload(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(forbiddenLowSensitivePattern);
}

function expectReadonlyActionsOnly(actions: readonly string[]) {
  const forbiddenActions = [
    'task',
    'appointment',
    'touch',
    'marketing',
    'deal',
    'payment',
    'contract',
    'invoice',
    '任务',
    '预约',
    '触达',
    '营销',
    '成交',
    '支付',
    '合同',
    '发票',
  ];

  actions.forEach((action) => {
    expect(action.endsWith('_readonly')).toBe(true);
    forbiddenActions.forEach((fragment) => {
      expect(action.toLowerCase()).not.toContain(fragment.toLowerCase());
    });
  });
}

function createInsertDatabase(rows: unknown[]) {
  const capturedValues: unknown[] = [];
  const returning = vi.fn(async () => {
    const row = rows.shift();
    return row === undefined ? [] : [row];
  });
  const values = vi.fn((value: unknown) => {
    capturedValues.push(value);
    return { returning };
  });
  const insert = vi.fn((table: unknown) => {
    void table;
    return { values };
  });

  return {
    capturedValues,
    database: { insert } as unknown as TenantDatabase,
    insert,
    returning,
    values,
  };
}

function createReadonlyListDatabase(input: {
  sources?: unknown[];
  documents?: unknown[];
  chunks?: unknown[];
  indexJobs?: unknown[];
}) {
  const resultSets = [
    input.sources ?? [],
    input.documents ?? [],
    input.chunks ?? [],
    input.indexJobs ?? [],
  ];
  const orderBy = vi.fn(async (...columns: unknown[]) => {
    void columns;
    return resultSets.shift() ?? [];
  });
  const where = vi.fn((condition: unknown) => {
    void condition;
    return { orderBy };
  });
  const from = vi.fn((table: unknown) => {
    void table;
    return { where };
  });
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    orderBy,
    select,
    where,
  };
}

function readySummary(
  overrides: Partial<V1KnowledgeBaseRuntimeFoundationReadonlySummary> = {},
): V1KnowledgeBaseRuntimeFoundationReadonlySummary {
  return {
    status: 'ready',
    readonly: true,
    tenantId: 'demo-tenant-a',
    institutionId: 'demo-inst-a',
    workspaceId: 'demo-workspace-a',
    sourceCount: 1,
    documentCount: 1,
    chunkCount: 1,
    indexJobCount: 1,
    sourceSummaries: [
      {
        sourceId: sourceRow.id,
        sourceKind: 'demo',
        status: 'ready',
        readonlyStatus: 'readonly',
        label: sourceRow.sourceLabel,
        readonly: true,
      },
    ],
    documentSummaries: [
      {
        documentId: documentRow.id,
        sourceId: sourceRow.id,
        sourceKind: 'demo',
        status: 'ready',
        readonlyStatus: 'readonly',
        title: documentRow.title,
        version: documentRow.version,
        readonly: true,
      },
    ],
    chunkSummaries: [
      {
        chunkId: chunkRow.id,
        documentId: documentRow.id,
        sourceKind: 'demo',
        status: 'ready',
        readonlyStatus: 'readonly',
        label: chunkRow.chunkLabel,
        chunkIndex: 1,
        readonly: true,
      },
    ],
    indexJobSummaries: [
      {
        jobId: indexJobRow.id,
        documentId: documentRow.id,
        sourceKind: 'demo',
        status: 'ready',
        readonlyStatus: 'readonly',
        jobKind: indexJobRow.jobKind,
        readonly: true,
      },
    ],
    riskFlags: [],
    recommendedReadonlyActions: ['review_knowledge_base_foundation_readonly'],
    ...overrides,
  };
}

describe('V1 知识库 runtime foundation', () => {
  it('migration/schema 文件存在且命名符合项目风格', () => {
    const migration = readFileSync(
      'drizzle/0009_v1_knowledge_base_runtime_foundation.sql',
      'utf8',
    );

    expect(getTableName(knowledgeSources)).toBe('knowledge_sources');
    expect(getTableName(knowledgeDocuments)).toBe('knowledge_documents');
    expect(getTableName(knowledgeChunks)).toBe('knowledge_chunks');
    expect(getTableName(knowledgeIndexJobs)).toBe('knowledge_index_jobs');
    [
      'CREATE TYPE "public"."knowledge_base_runtime_source_kind"',
      'CREATE TYPE "public"."knowledge_base_runtime_status"',
      'CREATE TYPE "public"."knowledge_base_runtime_readonly_status"',
      'CREATE TABLE "knowledge_sources"',
      'CREATE TABLE "knowledge_documents"',
      'CREATE TABLE "knowledge_chunks"',
      'CREATE TABLE "knowledge_index_jobs"',
      '"tenant_id" varchar(64) NOT NULL',
      '"institution_id" varchar(64) NOT NULL',
      '"workspace_id" varchar(64) NOT NULL',
      '"source_kind" "knowledge_base_runtime_source_kind" DEFAULT \'demo\' NOT NULL',
      '"status" "knowledge_base_runtime_status" DEFAULT \'ready\' NOT NULL',
      '"readonly_status" "knowledge_base_runtime_readonly_status" DEFAULT \'readonly\' NOT NULL',
      '"created_at" timestamp with time zone DEFAULT now() NOT NULL',
      '"updated_at" timestamp with time zone DEFAULT now() NOT NULL',
      'CONSTRAINT "knowledge_sources_tenant_id_id_unique" UNIQUE("tenant_id","id")',
      'CONSTRAINT "knowledge_documents_tenant_id_id_unique" UNIQUE("tenant_id","id")',
    ].forEach((fragment) => {
      expect(migration).toContain(fragment);
    });
  });

  it('repository 只允许 create mock / seed / demo source/document/chunk/index job', async () => {
    const db = createInsertDatabase([sourceRow, documentRow, chunkRow, indexJobRow]);
    const repository = createV1KnowledgeBaseRuntimeFoundationRepository(db.database);

    await expect(
      repository.createDemoSource({
        id: sourceRow.id,
        tenantId: sourceRow.tenantId,
        institutionId: sourceRow.institutionId,
        workspaceId: sourceRow.workspaceId,
        sourceKind: 'demo',
        sourceLabel: sourceRow.sourceLabel,
      }),
    ).resolves.toMatchObject({ status: 'created', record: { sourceId: sourceRow.id } });
    await expect(
      repository.createDemoDocument({
        id: documentRow.id,
        tenantId: documentRow.tenantId,
        institutionId: documentRow.institutionId,
        workspaceId: documentRow.workspaceId,
        sourceId: sourceRow.id,
        sourceKind: 'seed',
        title: documentRow.title,
        version: documentRow.version,
      }),
    ).resolves.toMatchObject({ status: 'created', record: { documentId: documentRow.id } });
    await expect(
      repository.createDemoChunk({
        id: chunkRow.id,
        tenantId: chunkRow.tenantId,
        institutionId: chunkRow.institutionId,
        workspaceId: chunkRow.workspaceId,
        documentId: documentRow.id,
        sourceKind: 'mock',
        chunkLabel: chunkRow.chunkLabel,
        chunkIndex: chunkRow.chunkIndex,
      }),
    ).resolves.toMatchObject({ status: 'created', record: { chunkId: chunkRow.id } });
    await expect(
      repository.createDemoIndexJob({
        id: indexJobRow.id,
        tenantId: indexJobRow.tenantId,
        institutionId: indexJobRow.institutionId,
        workspaceId: indexJobRow.workspaceId,
        documentId: documentRow.id,
        sourceKind: 'demo',
        jobKind: indexJobRow.jobKind,
      }),
    ).resolves.toMatchObject({ status: 'created', record: { jobId: indexJobRow.id } });

    await expect(
      repository.createDemoSource({
        id: 'external-source',
        tenantId: sourceRow.tenantId,
        institutionId: sourceRow.institutionId,
        workspaceId: sourceRow.workspaceId,
        sourceKind: 'external' as never,
        sourceLabel: '外部来源不应写入',
      }),
    ).resolves.toEqual({ status: 'rejected_non_demo_input' });

    expect(db.insert).toHaveBeenCalledTimes(4);
    db.capturedValues.forEach((value) => {
      expect(value).toMatchObject({ readonlyStatus: 'readonly' });
      expectLowSensitivePayload(value);
    });
  });

  it('repository list readonly summaries 按 tenant / institution / workspace scope 输出低敏摘要', async () => {
    const db = createReadonlyListDatabase({
      sources: [
        sourceRow,
        { ...sourceRow, id: 'other-tenant-source', tenantId: 'other-tenant' },
      ],
      documents: [
        documentRow,
        { ...documentRow, id: 'other-workspace-document', workspaceId: 'other-workspace' },
      ],
      chunks: [chunkRow],
      indexJobs: [indexJobRow],
    });
    const repository = createV1KnowledgeBaseRuntimeFoundationRepository(db.database);

    const summary = await repository.listReadonlySummaries({
      tenantId: 'demo-tenant-a',
      institutionId: 'demo-inst-a',
      workspaceId: 'demo-workspace-a',
    });

    expect(summary).toMatchObject({
      status: 'ready',
      tenantId: 'demo-tenant-a',
      institutionId: 'demo-inst-a',
      workspaceId: 'demo-workspace-a',
      sourceCount: 1,
      documentCount: 1,
      chunkCount: 1,
      indexJobCount: 1,
    });
    expect(summary.sourceSummaries).toHaveLength(1);
    expect(summary.documentSummaries).toHaveLength(1);
    expectLowSensitivePayload(summary);
  });

  it('mapper 支持 disabled / denied / empty / ready 并保持低敏字段白名单', () => {
    const cases: V1KnowledgeBaseRuntimeFoundationReadonlySummary[] = [
      readySummary({
        status: 'disabled',
        sourceCount: 0,
        documentCount: 0,
        chunkCount: 0,
        indexJobCount: 0,
        sourceSummaries: [],
        documentSummaries: [],
        chunkSummaries: [],
        indexJobSummaries: [],
        recommendedReadonlyActions: [],
      }),
      readySummary({
        status: 'denied',
        sourceCount: 0,
        documentCount: 0,
        chunkCount: 0,
        indexJobCount: 0,
        sourceSummaries: [],
        documentSummaries: [],
        chunkSummaries: [],
        indexJobSummaries: [],
        recommendedReadonlyActions: [],
      }),
      readySummary({
        status: 'empty',
        sourceCount: 0,
        documentCount: 0,
        chunkCount: 0,
        indexJobCount: 0,
        sourceSummaries: [],
        documentSummaries: [],
        chunkSummaries: [],
        indexJobSummaries: [],
        recommendedReadonlyActions: ['review_knowledge_base_foundation_readonly'],
      }),
      readySummary(),
    ];

    cases.forEach((summary) => {
      const response = buildV1KnowledgeBaseRuntimeFoundationApiResponse({
        requestId: `runtime-foundation-${summary.status}`,
        summary,
      });

      expect(response.status).toBe(summary.status);
      expect(response.readonly).toBe(true);
      expectResponseFieldsWhitelisted(response);
      expectLowSensitivePayload(response);
      expectReadonlyActionsOnly(response.recommendedReadonlyActions);
    });
  });

  it('service 在 disabled / denied / empty / ready 状态下返回只读 contract', async () => {
    const repository = {
      listReadonlySummaries: vi.fn(async () => readySummary()),
    };

    await expect(
      getV1KnowledgeBaseRuntimeFoundationReadonlyService({
        policy: { ...enabledPolicy, featureEnabled: false },
        repository,
      }),
    ).resolves.toMatchObject({ status: 'disabled', sourceCount: 0 });
    await expect(
      getV1KnowledgeBaseRuntimeFoundationReadonlyService({
        policy: { ...enabledPolicy, canReadKnowledgeBaseRuntimeFoundation: false },
        repository,
      }),
    ).resolves.toMatchObject({ status: 'denied', sourceCount: 0 });
    await expect(
      getV1KnowledgeBaseRuntimeFoundationReadonlyService({
        policy: { ...enabledPolicy, workspaceScopeMatched: false },
        repository,
      }),
    ).resolves.toMatchObject({ status: 'denied', workspaceId: 'demo-workspace-a' });
    await expect(
      getV1KnowledgeBaseRuntimeFoundationReadonlyService({
        policy: enabledPolicy,
        repository: {
          listReadonlySummaries: vi.fn(async () =>
            readySummary({
              status: 'empty',
              sourceCount: 0,
              documentCount: 0,
              chunkCount: 0,
              indexJobCount: 0,
              sourceSummaries: [],
              documentSummaries: [],
              chunkSummaries: [],
              indexJobSummaries: [],
            }),
          ),
        },
      }),
    ).resolves.toMatchObject({ status: 'empty', sourceCount: 0 });
    await expect(
      getV1KnowledgeBaseRuntimeFoundationReadonlyService({
        policy: enabledPolicy,
        repository,
      }),
    ).resolves.toMatchObject({ status: 'ready', sourceCount: 1 });

    expect(repository.listReadonlySummaries).toHaveBeenCalledTimes(1);
  });

  it('service create demo records 只接受 mock / seed / demo 输入且不返回敏感字段', async () => {
    const repository = {
      createDemoSource: vi.fn(async () => ({
        status: 'created' as const,
        record: readySummary().sourceSummaries[0],
      })),
      createDemoDocument: vi.fn(async () => ({
        status: 'created' as const,
        record: readySummary().documentSummaries[0],
      })),
      createDemoChunk: vi.fn(async () => ({
        status: 'created' as const,
        record: readySummary().chunkSummaries[0],
      })),
      createDemoIndexJob: vi.fn(async () => ({
        status: 'created' as const,
        record: readySummary().indexJobSummaries[0],
      })),
    };

    const result = await createV1KnowledgeBaseRuntimeFoundationDemoRecordsService({
      repository,
      input: {
        source: {
          id: sourceRow.id,
          tenantId: sourceRow.tenantId,
          institutionId: sourceRow.institutionId,
          workspaceId: sourceRow.workspaceId,
          sourceKind: 'demo',
          sourceLabel: sourceRow.sourceLabel,
        },
        document: {
          id: documentRow.id,
          tenantId: documentRow.tenantId,
          institutionId: documentRow.institutionId,
          workspaceId: documentRow.workspaceId,
          sourceId: sourceRow.id,
          sourceKind: 'seed',
          title: documentRow.title,
          version: documentRow.version,
        },
        chunk: {
          id: chunkRow.id,
          tenantId: chunkRow.tenantId,
          institutionId: chunkRow.institutionId,
          workspaceId: chunkRow.workspaceId,
          documentId: documentRow.id,
          sourceKind: 'mock',
          chunkLabel: chunkRow.chunkLabel,
          chunkIndex: chunkRow.chunkIndex,
        },
        indexJob: {
          id: indexJobRow.id,
          tenantId: indexJobRow.tenantId,
          institutionId: indexJobRow.institutionId,
          workspaceId: indexJobRow.workspaceId,
          documentId: documentRow.id,
          sourceKind: 'demo',
          jobKind: indexJobRow.jobKind,
        },
      },
    });

    expect(result.status).toBe('created');
    expect(repository.createDemoSource).toHaveBeenCalledTimes(1);
    expect(repository.createDemoDocument).toHaveBeenCalledTimes(1);
    expect(repository.createDemoChunk).toHaveBeenCalledTimes(1);
    expect(repository.createDemoIndexJob).toHaveBeenCalledTimes(1);
    expectLowSensitivePayload(result);

    await expect(
      createV1KnowledgeBaseRuntimeFoundationDemoRecordsService({
        repository,
        input: {
          source: {
            id: 'unsafe-source',
            tenantId: sourceRow.tenantId,
            institutionId: sourceRow.institutionId,
            workspaceId: sourceRow.workspaceId,
            sourceKind: 'external' as never,
            sourceLabel: '外部来源不应创建',
          },
        },
      }),
    ).resolves.toEqual({ status: 'rejected_non_demo_input' });
  });

  it('low-sensitive response 不出现禁止字段或真实系统片段', () => {
    const response = buildV1KnowledgeBaseRuntimeFoundationApiResponse({
      requestId: 'runtime-foundation-ready',
      summary: readySummary({
        riskFlags: ['demo_runtime_foundation_review_required'],
      }),
    });

    expectResponseFieldsWhitelisted(response);
    expectLowSensitivePayload(response);
    expect(JSON.stringify(response)).not.toContain('allowedActions');
    expect(JSON.stringify(response)).not.toContain('mutation');
  });
});
