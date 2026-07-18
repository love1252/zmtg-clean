import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initialized: string[] = [];
const forbiddenModulePaths = [
  '@/modules/security/server/access-context',
  '@/server/db/client',
  '@/modules/open-platform/server/platform-knowledge-management-repository',
  '@/modules/open-platform/server/platform-knowledge-indexing-job-service',
  '@/modules/institution/server/institution-knowledge-write-repository',
  '@/modules/institution/server/institution-knowledge-management-service',
] as const;

type DisabledHandler = (
  request?: Request,
  context?: unknown,
) => Response | Promise<Response>;

const embeddingsDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_embeddings_capability_disabled',
  error: '机构知识库向量索引暂未启用。',
});

const cancelDisabledPayload = Object.freeze({
  status: 'capability_disabled',
  code: 'knowledge_indexing_job_cancel_capability_disabled',
  error: '机构知识库索引任务取消暂未启用。',
});

const apiUrl = 'http://localhost/api/institution/knowledge-management';

beforeEach(() => {
  vi.resetModules();
  initialized.length = 0;
  forbiddenModulePaths.forEach((modulePath) => vi.doUnmock(modulePath));
});

afterEach(() => vi.restoreAllMocks());

function rejectInitialization(modulePath: string, label: string) {
  vi.doMock(modulePath, () => {
    initialized.push(label);
    throw new Error(`${label} must not initialize`);
  });
}

async function loadBlockedRoutes() {
  for (const [modulePath, label] of [
    ['@/modules/security/server/access-context', 'auth'],
    ['@/server/db/client', 'db'],
    ['@/modules/open-platform/server/platform-knowledge-management-repository', 'repository'],
    ['@/modules/open-platform/server/platform-knowledge-indexing-job-service', 'job-service'],
    ['@/modules/institution/server/institution-knowledge-write-repository', 'write-repository'],
    ['@/modules/institution/server/institution-knowledge-management-service', 'management-service'],
  ] as const) {
    rejectInitialization(modulePath, label);
  }

  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('fetch must not run');
  });
  const [itemsRoute, embeddingsRoute, cancelRoute] = await Promise.all([
    import('@/app/api/institution/knowledge-management/items/route'),
    import('@/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/embeddings/route'),
    import('@/app/api/institution/knowledge-management/indexing-jobs/[jobId]/cancel/route'),
  ]);

  expect(initialized).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();

  return {
    itemsRoute,
    embeddingsRoute,
    cancelRoute,
    assertNoSideEffects: () => {
      expect(initialized).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  };
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
  const value = new Proxy({}, {
    get: () => trap('get'),
    set: () => trap('set'),
    has: () => trap('has'),
    ownKeys: () => trap('ownKeys'),
    getOwnPropertyDescriptor: () => trap('getOwnPropertyDescriptor'),
    getPrototypeOf: () => trap('getPrototypeOf'),
  }) as T;

  return { value, counts };
}

async function expectDisabled(
  response: Response,
  expectedPayload: typeof embeddingsDisabledPayload | typeof cancelDisabledPayload,
) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(expectedPayload);
}

describe('机构端知识库管理 V1 只读 API route', () => {
  it('资料库根 route 保持固定 capability disabled', async () => {
    const { itemsRoute, assertNoSideEffects } = await loadBlockedRoutes();
    const response = await itemsRoute.GET(
      new Request(`${apiUrl}/items?keyword=forged`),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: 'capability_disabled',
      code: 'knowledge_items_capability_disabled',
      message: '机构知识库资料库暂未启用。',
    });
    assertNoSideEffects();
  });

  it('embeddings 与 cancel 对普通、缺失和伪造输入固定返回无缓存 503', async () => {
    const { embeddingsRoute, cancelRoute, assertNoSideEffects } = await loadBlockedRoutes();
    const sensitiveMarker = 'private-customer-name-token-provider-payload';
    const requests: Array<{
      handler: DisabledHandler;
      request?: Request;
      context?: unknown;
      payload: typeof embeddingsDisabledPayload | typeof cancelDisabledPayload;
    }> = [
      {
        handler: embeddingsRoute.POST as DisabledHandler,
        payload: embeddingsDisabledPayload,
      },
      {
        handler: embeddingsRoute.POST as DisabledHandler,
        request: new Request(`${apiUrl}/items/${sensitiveMarker}/files/${sensitiveMarker}/embeddings`, {
          method: 'POST',
          headers: { authorization: `Bearer ${sensitiveMarker}`, 'x-institution-id': sensitiveMarker },
          body: JSON.stringify({ rebuild: true, provider: sensitiveMarker }),
        }),
        context: { params: Promise.resolve({ knowledgeId: sensitiveMarker, fileId: sensitiveMarker }) },
        payload: embeddingsDisabledPayload,
      },
      {
        handler: cancelRoute.POST as DisabledHandler,
        payload: cancelDisabledPayload,
      },
      {
        handler: cancelRoute.POST as DisabledHandler,
        request: new Request(`${apiUrl}/indexing-jobs/${sensitiveMarker}/cancel`, {
          method: 'POST',
          headers: { cookie: `zmtg_demo_session=${sensitiveMarker}` },
        }),
        context: { params: Promise.resolve({ jobId: sensitiveMarker }) },
        payload: cancelDisabledPayload,
      },
    ];

    for (const { handler, request, context, payload } of requests) {
      const response = await handler(request, context);
      const replay = response.clone();
      await expectDisabled(response, payload);
      expect(JSON.stringify(await replay.json())).not.toContain(sensitiveMarker);
      assertNoSideEffects();
    }
  });

  it('embeddings 与 cancel 不触碰 hostile Request 或 params 的任一 trap', async () => {
    const { embeddingsRoute, cancelRoute, assertNoSideEffects } = await loadBlockedRoutes();

    for (const [handler, payload] of [
      [embeddingsRoute.POST as DisabledHandler, embeddingsDisabledPayload],
      [cancelRoute.POST as DisabledHandler, cancelDisabledPayload],
    ] as const) {
      const request = hostileProxy<Request>();
      const context = hostileProxy<object>();
      const response = await handler(request.value, context.value);

      await expectDisabled(response, payload);
      expect(request.counts).toEqual({
        get: 0,
        set: 0,
        has: 0,
        ownKeys: 0,
        getOwnPropertyDescriptor: 0,
        getPrototypeOf: 0,
      });
      expect(context.counts).toEqual({
        get: 0,
        set: 0,
        has: 0,
        ownKeys: 0,
        getOwnPropertyDescriptor: 0,
        getPrototypeOf: 0,
      });
      assertNoSideEffects();
    }
  });

  it('两个叶子 route 源码仅依赖 NextResponse，禁止旧数据链和输入读取', () => {
    const routePaths = [
      'src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/embeddings/route.ts',
      'src/app/api/institution/knowledge-management/indexing-jobs/[jobId]/cancel/route.ts',
    ];

    for (const routePath of routePaths) {
      const source = readFileSync(resolve(process.cwd(), routePath), 'utf8');
      const imports = source.match(/^import .+;$/gmu) ?? [];
      expect(imports).toEqual(["import { NextResponse } from 'next/server';"]);
      expect(source).not.toMatch(
        /getDemoAccessContextFromRequest|getDatabase|repository|storage|provider|cancelKnowledgeIndexingJob|createAndRun|\b_?request\s*(?:\.|\[)|\b_?context\s*(?:\.|\[)|fetch\(/u,
      );
    }
  });
});
