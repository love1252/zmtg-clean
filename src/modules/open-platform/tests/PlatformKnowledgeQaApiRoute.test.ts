import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/api/institution/_shared/institution-route-guard', () => ({
  withInstitutionSectionRouteGuardV1: ({
    handler,
  }: {
    handler: (...args: unknown[]) => Response | Promise<Response>;
  }) => handler,
}));
import * as platformQaRoute from '@/app/api/v1/open-platform/knowledge-management/qa/route';
import * as platformQaAuditsRoute from '@/app/api/v1/open-platform/knowledge-management/qa/audits/route';
import * as platformCapabilitiesRoute from '@/app/api/v1/open-platform/knowledge-management/capabilities/route';
import * as institutionQaRoute from '@/app/api/institution/knowledge-management/qa/route';
import * as platformEmbeddingRoute from '@/app/api/v1/open-platform/knowledge-management/embeddings/route';
import { createPlatformKnowledgeManagementRepository } from '@/modules/open-platform/server/platform-knowledge-management-repository';
import { getDemoAccessContextFromRequest } from '@/modules/security/server/access-context';
import { getDatabase } from '@/server/db/client';

const database = { database: 'knowledge-qa-route-test-db' };
const repository = {
  listKnowledgeItems: vi.fn(),
  searchKnowledgeFileParseChunks: vi.fn(),
  listKnowledgeVectorSearchCandidates: vi.fn(),
  createKnowledgeQaAuditLog: vi.fn(),
  countKnowledgeQaAuditLogsForDay: vi.fn(),
  listKnowledgeQaAuditLogs: vi.fn(),
};

vi.mock('@/server/db/client', () => ({
  getDatabase: vi.fn(() => database),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: vi.fn(),
}));

vi.mock('@/modules/open-platform/server/platform-knowledge-management-repository', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/open-platform/server/platform-knowledge-management-repository')
  >('@/modules/open-platform/server/platform-knowledge-management-repository');

  return {
    ...actual,
    createPlatformKnowledgeManagementRepository: vi.fn(() => repository),
  };
});

const now = new Date('2026-06-14T08:00:00.000Z');
const platformQaUrl = 'http://localhost/api/v1/open-platform/knowledge-management/qa';
const platformQaAuditsUrl = 'http://localhost/api/v1/open-platform/knowledge-management/qa/audits';
const platformCapabilitiesUrl = 'http://localhost/api/v1/open-platform/knowledge-management/capabilities';
const institutionQaUrl = 'http://localhost/api/institution/knowledge-management/qa';
const institutionQaAuditsUrl = 'http://localhost/api/institution/knowledge-management/qa/audits';
const platformEmbeddingUrl = 'http://localhost/api/v1/open-platform/knowledge-management/embeddings';
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
  'postgres://',
  'DATABASE_URL',
  'prompt',
  'system prompt',
  '真实 AI 原始响应',
];

const institutionQaAuditsDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_qa_audits_capability_disabled',
  error: '机构知识库问答审计暂未启用。',
});

const visibleKnowledge = {
  knowledgeId: 'knowledge-visible',
  tenantId: 'tenant-route',
  tenantName: '路由租户',
  institutionId: 'inst-current',
  workspaceId: 'workspace-route',
  title: '授权护理知识库',
  version: 'v1',
  sourceKind: 'demo' as const,
  status: 'ready' as const,
  readonlyStatus: 'readonly' as const,
  category: '术后护理',
  descriptionPreview: '低敏摘要。',
  chunkCount: 1,
  visibleInstitutionIds: [],
  createdAt: now,
  updatedAt: now,
};

const hiddenKnowledge = {
  ...visibleKnowledge,
  knowledgeId: 'knowledge-hidden',
  institutionId: 'inst-hidden',
  title: '隐藏知识库',
};

const visibleChunk = {
  tenantId: 'tenant-route',
  knowledgeId: 'knowledge-visible',
  knowledgeTitle: '授权护理知识库',
  fileId: 'file-visible',
  fileName: '护理.txt',
  fileStatus: 'active' as const,
  parseStatus: 'succeeded' as const,
  chunkId: 'chunk-visible-0',
  chunkIndex: 0,
  textPreview: '冷敷护理建议片段。',
};

const hiddenChunk = {
  ...visibleChunk,
  knowledgeId: 'knowledge-hidden',
  knowledgeTitle: '隐藏知识库',
  fileId: 'file-hidden',
  fileName: '隐藏.txt',
  chunkId: 'chunk-hidden-0',
  textPreview: '机构 B 看不到机构 A 内容。',
};

async function readJson(response: Response) {
  expect(response.headers.get('content-type')).toContain('application/json');
  return response.json() as Promise<Record<string, unknown>>;
}

function platformContext() {
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
    userId: 'platform-user',
    role: 'platform_admin',
    scope: 'platform',
    tenantId: null,
    institutionId: null,
    source: 'demo_session',
  });
}

function institutionContext() {
  vi.mocked(getDemoAccessContextFromRequest).mockReturnValue({
    userId: 'tenant-user',
    role: 'tenant_admin',
    scope: 'tenant',
    tenantId: 'tenant-route',
    institutionId: 'inst-current',
    source: 'demo_session',
  });
}

function expectSafePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  unsafeFragments.forEach((fragment) => {
    expect(serialized).not.toContain(fragment);
  });
}

async function expectInstitutionQaAuditsDisabled(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(institutionQaAuditsDisabledPayload);
}

function hostileProxy<T extends object>() {
  const counts = {
    get: 0,
    set: 0,
    has: 0,
    ownKeys: 0,
    getOwnPropertyDescriptor: 0,
    getPrototypeOf: 0,
  };
  const trap = <K extends keyof typeof counts>(name: K): never => {
    counts[name] += 1;
    throw new Error(`${name} must not run`);
  };

  return {
    value: new Proxy({}, {
      get: () => trap('get'),
      set: () => trap('set'),
      has: () => trap('has'),
      ownKeys: () => trap('ownKeys'),
      getOwnPropertyDescriptor: () => trap('getOwnPropertyDescriptor'),
      getPrototypeOf: () => trap('getPrototypeOf'),
    }) as T,
    counts,
  };
}

describe('知识库 QA API route', () => {
  beforeEach(() => {
    Object.values(repository).forEach((mock) => mock.mockReset());
    repository.countKnowledgeQaAuditLogsForDay.mockResolvedValue(0);
    repository.createKnowledgeQaAuditLog.mockImplementation(async (record) => ({
      auditId: record.auditId,
    }));
    vi.mocked(getDatabase).mockClear();
    vi.mocked(createPlatformKnowledgeManagementRepository).mockClear();
    vi.mocked(getDemoAccessContextFromRequest).mockReset();
  });

  it('平台端 POST QA 返回 answer、citations、auditId 且不泄露低层字段', async () => {
    platformContext();
    repository.listKnowledgeItems.mockResolvedValue([visibleKnowledge]);
    repository.searchKnowledgeFileParseChunks.mockResolvedValue([visibleChunk]);
    repository.listKnowledgeVectorSearchCandidates.mockResolvedValue([]);

    const response = await platformQaRoute.POST(
      new Request(platformQaUrl, {
        method: 'POST',
        body: JSON.stringify({
          tenantId: 'tenant-route',
          question: '冷敷后怎么护理？',
          retrievalMode: 'keyword',
        }),
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        answer: expect.stringContaining('基于已召回的知识片段'),
        retrievalMode: 'keyword',
        auditId: expect.stringMatching(/^kb-qa-audit-/),
        safeStatus: 'answered',
      }),
    );
    expect(payload.citations).toEqual([
      expect.objectContaining({
        knowledgeId: 'knowledge-visible',
        fileId: 'file-visible',
        chunkId: 'chunk-visible-0',
        score: expect.any(Number),
      }),
    ]);
    expect(repository.createKnowledgeQaAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-route',
        institutionId: null,
        actorScope: 'platform',
        actorUserId: 'platform-user',
        safeStatus: 'answered',
      }),
    );
    expectSafePayload(payload);
  });

  it('平台端可查 QA 审计列表且 payload 只返回低敏字段', async () => {
    platformContext();
    repository.listKnowledgeQaAuditLogs.mockResolvedValue({
      records: [
        {
          auditId: 'audit-platform-a',
          tenantId: 'tenant-route',
          institutionId: 'inst-current',
          actorScope: 'institution',
          actorUserId: 'tenant-user',
          question: '冷敷后怎么护理？',
          answerPreview: '基于已召回的知识片段：冷敷护理建议片段。',
          retrievalMode: 'hybrid',
          citationCount: 2,
          safeStatus: 'answered',
          safeFailureMessage: null,
          createdAt: '2026-06-14T08:00:00.000Z',
        },
      ],
      pageInfo: {
        page: 1,
        pageSize: 10,
        total: 1,
        pageCount: 1,
        hasPreviousPage: false,
        hasNextPage: false,
      },
    });

    const response = await platformQaAuditsRoute.GET(
      new Request(`${platformQaAuditsUrl}?tenantId=tenant-route&institutionId=inst-current`),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(repository.listKnowledgeQaAuditLogs).toHaveBeenCalledWith({
      tenantId: 'tenant-route',
      institutionId: 'inst-current',
      page: 1,
      pageSize: 10,
    });
    expect(payload.records).toEqual([
      expect.objectContaining({
        auditId: 'audit-platform-a',
        tenantId: 'tenant-route',
        institutionId: 'inst-current',
        question: '冷敷后怎么护理？',
        answerPreview: expect.stringContaining('基于已召回的知识片段'),
        retrievalMode: 'hybrid',
        citationCount: 2,
        safeStatus: 'answered',
      }),
    ]);
    expectSafePayload(payload);
  });

  it('非 platform scope 不能查看平台 QA 审计列表', async () => {
    institutionContext();

    const response = await platformQaAuditsRoute.GET(
      new Request(`${platformQaAuditsUrl}?tenantId=tenant-route`),
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ code: 'forbidden', error: '没有访问权限' });
    expect(repository.listKnowledgeQaAuditLogs).not.toHaveBeenCalled();
  });

  it('平台端可查看知识库 production capability 状态且不泄露敏感信息', async () => {
    platformContext();

    const response = await platformCapabilitiesRoute.GET(
      new Request(platformCapabilitiesUrl),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        requestId: 'knowledge-base-production-capabilities',
        readonly: true,
      }),
    );
    expect(payload.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'fileManagement', enabled: true, status: 'enabled' }),
        expect.objectContaining({
          id: 'realAiProvider',
          enabled: false,
          status: 'disabled',
          disabledReason: expect.stringMatching(/未启用|未接入/),
          entryCondition: expect.stringMatching(/审批|评审|验收|方案/),
        }),
        expect.objectContaining({
          id: 'ocr',
          enabled: false,
          status: 'disabled',
          disabledReason: expect.stringMatching(/未启用|未接入/),
          entryCondition: expect.stringMatching(/审批|评审|验收|方案/),
        }),
        expect.objectContaining({
          id: 'runtimeIngestion',
          enabled: false,
          status: 'disabled',
          disabledReason: expect.stringMatching(/未启用|未接入/),
          entryCondition: expect.stringMatching(/审批|评审|验收|方案/),
        }),
      ]),
    );
    expect(payload.qaQuotaPolicy).toEqual({
      tenantDailyLimit: 100,
      institutionDailyLimit: 30,
      usageLimitedMessage: '当前知识库问答次数已达上限，请稍后再试',
    });
    expectSafePayload(payload);
  });

  it('非 platform scope 不能查看知识库 production capability 状态', async () => {
    institutionContext();

    const response = await platformCapabilitiesRoute.GET(
      new Request(platformCapabilitiesUrl),
    );

    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ code: 'forbidden', error: '没有访问权限' });
  });

  it('机构端 POST QA 在真实 publication/citation 能力接入前固定 fail-closed', async () => {
    institutionContext();
    repository.listKnowledgeItems.mockResolvedValue([visibleKnowledge, hiddenKnowledge]);
    repository.searchKnowledgeFileParseChunks.mockResolvedValue([visibleChunk, hiddenChunk]);
    repository.listKnowledgeVectorSearchCandidates.mockResolvedValue([]);

    const response = await institutionQaRoute.POST(
      new Request(institutionQaUrl, {
        method: 'POST',
        body: JSON.stringify({
          tenantId: 'tenant-other',
          institutionId: 'inst-other',
          question: '冷敷后怎么护理？',
          retrievalMode: 'keyword',
        }),
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      status: 'capability_disabled',
      code: 'knowledge_qa_capability_disabled',
      answer: '机构知识库问答暂未启用。仅供内部运营参考，需人工确认',
      citations: [],
    });
    expect(repository.searchKnowledgeFileParseChunks).not.toHaveBeenCalled();
    expect(repository.createKnowledgeQaAuditLog).not.toHaveBeenCalled();
    expectSafePayload(payload);
  });

  it('机构端 QA 审计对普通、伪造和非法输入固定 capability-off，且不回显输入', async () => {
    const route = await import(
      '@/app/api/institution/knowledge-management/qa/audits/route'
    );
    const invokeGet = route.GET as unknown as (
      request?: unknown,
    ) => Response | Promise<Response>;
    const sensitiveMarkers = [
      'private-question-preview',
      'private-answer-preview',
      'private-institution-id',
    ];
    const responses = [
      invokeGet(),
      invokeGet(
        new Request(
          `${institutionQaAuditsUrl}?tenantId=${sensitiveMarkers[2]}&question=${sensitiveMarkers[0]}`,
          {
            headers: {
              authorization: `Bearer ${sensitiveMarkers[1]}`,
              'x-provider': 'mock-embedding',
            },
          },
        ),
      ),
      invokeGet(null),
    ];

    for (const pendingResponse of responses) {
      const response = await pendingResponse;
      const replay = response.clone();
      await expectInstitutionQaAuditsDisabled(response);
      const serialized = JSON.stringify(await replay.json());
      sensitiveMarkers.forEach((marker) => expect(serialized).not.toContain(marker));
      expect(serialized).not.toContain('mock-embedding');
    }

    expect(getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(repository.listKnowledgeQaAuditLogs).not.toHaveBeenCalled();
  });

  it('机构端 QA 审计不触碰 hostile Request 的任一 trap', async () => {
    const route = await import(
      '@/app/api/institution/knowledge-management/qa/audits/route'
    );
    const request = hostileProxy<Request>();
    const invokeGet = route.GET as unknown as (
      request?: unknown,
    ) => Response | Promise<Response>;

    const response = await invokeGet(request.value);

    await expectInstitutionQaAuditsDisabled(response);
    expect(request.counts).toEqual({
      get: 0,
      set: 0,
      has: 0,
      ownKeys: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
    });
    expect(getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createPlatformKnowledgeManagementRepository).not.toHaveBeenCalled();
    expect(repository.listKnowledgeQaAuditLogs).not.toHaveBeenCalled();
  });

  it('空问题返回中文 validation_failed', async () => {
    platformContext();

    const response = await platformQaRoute.POST(
      new Request(platformQaUrl, {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-route', question: '   ' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({
      status: 'validation_failed',
      message: '请输入知识库问答问题',
    });
    expect(repository.createKnowledgeQaAuditLog).not.toHaveBeenCalled();
  });

  it('tenant 每日 QA 超限时返回中文安全文案且不执行召回', async () => {
    platformContext();
    repository.countKnowledgeQaAuditLogsForDay.mockResolvedValueOnce(100);

    const response = await platformQaRoute.POST(
      new Request(platformQaUrl, {
        method: 'POST',
        body: JSON.stringify({
          tenantId: 'tenant-route',
          question: '冷敷后怎么护理？',
          retrievalMode: 'hybrid',
        }),
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(429);
    expect(payload).toEqual({
      status: 'usage_limited',
      message: '当前知识库问答次数已达上限，请稍后再试',
    });
    expect(repository.searchKnowledgeFileParseChunks).not.toHaveBeenCalled();
    expect(repository.listKnowledgeVectorSearchCandidates).not.toHaveBeenCalled();
  });

  it('机构端 QA 不读取配额或执行召回', async () => {
    institutionContext();
    repository.countKnowledgeQaAuditLogsForDay.mockResolvedValueOnce(30);

    const response = await institutionQaRoute.POST(
      new Request(institutionQaUrl, {
        method: 'POST',
        body: JSON.stringify({
          question: '复诊前怎么准备？',
          retrievalMode: 'hybrid',
        }),
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      status: 'capability_disabled',
      code: 'knowledge_qa_capability_disabled',
      answer: '机构知识库问答暂未启用。仅供内部运营参考，需人工确认',
      citations: [],
    });
    expect(repository.countKnowledgeQaAuditLogsForDay).not.toHaveBeenCalled();
    expect(repository.searchKnowledgeFileParseChunks).not.toHaveBeenCalled();
    expect(repository.listKnowledgeVectorSearchCandidates).not.toHaveBeenCalled();
  });

  it('非 platform scope 不能调用平台 QA 且机构端不能发起 embedding 生成', async () => {
    institutionContext();

    const qaResponse = await platformQaRoute.POST(
      new Request(platformQaUrl, {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-route', question: '冷敷？' }),
      }),
    );
    const embeddingResponse = await platformEmbeddingRoute.POST(
      new Request(platformEmbeddingUrl, {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'tenant-route' }),
      }),
    );

    expect(qaResponse.status).toBe(403);
    expect(await readJson(qaResponse)).toEqual({ code: 'forbidden', error: '没有访问权限' });
    expect(embeddingResponse.status).toBe(403);
    expect(await readJson(embeddingResponse)).toEqual({ code: 'forbidden', error: '没有访问权限' });
  });

  it('service 抛错时返回固定中文安全错误文案', async () => {
    platformContext();
    repository.listKnowledgeItems.mockRejectedValueOnce(
      new Error('SQL stack /Users/demo postgres://root:password@localhost token secret'),
    );

    const response = await platformQaRoute.POST(
      new Request(platformQaUrl, {
        method: 'POST',
        body: JSON.stringify({
          tenantId: 'tenant-route',
          question: '冷敷后怎么护理？',
          retrievalMode: 'keyword',
        }),
      }),
    );
    const payload = await readJson(response);

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      code: 'service_unavailable',
      error: '知识库问答暂时无法处理',
    });
    expectSafePayload(payload);
  });

  it('机构端 QA 审计 route 源码仅依赖 NextResponse，禁止旧数据链和输入读取', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/api/institution/knowledge-management/qa/audits/route.ts',
      ),
      'utf8',
    );
    const imports = source.match(/^import .+;$/gmu) ?? [];

    expect(imports).toEqual([
      "import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';",
      "import { NextResponse } from 'next/server';",
    ]);
    expect(source).not.toMatch(
      /getDemoAccessContextFromRequest|getDatabase|repository|storage|provider|embedding|listInstitutionKnowledgeQaAuditsService|\b_?request\s*(?:\.|\[)|fetch\(/u,
    );
  });

  it('机构端 QA 审计 route 动态加载时不初始化旧依赖或 fetch', async () => {
    vi.resetModules();
    const initialized: string[] = [];
    const forbiddenModules = [
      ['@/modules/security/server/access-context', 'auth'],
      ['@/server/db/client', 'db'],
      ['@/modules/open-platform/server/platform-knowledge-management-repository', 'repository'],
      ['@/modules/open-platform/server/platform-knowledge-qa-service', 'qa-service'],
      ['@/modules/open-platform/server/platform-knowledge-embedding-vector-search-service', 'mock-embedding'],
      ['@/modules/open-platform/server/platform-knowledge-ai-provider-adapter', 'provider'],
    ] as const;
    forbiddenModules.forEach(([modulePath, label]) => {
      vi.doMock(modulePath, () => {
        initialized.push(label);
        throw new Error(`${label} must not initialize`);
      });
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('fetch must not run');
    });

    try {
      const route = await import(
        '@/app/api/institution/knowledge-management/qa/audits/route'
      );
      const response = await route.GET();

      expect(initialized).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
      await expectInstitutionQaAuditsDisabled(response);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
