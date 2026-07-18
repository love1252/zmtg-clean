import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initialized: string[] = [];
const modulePaths = [
  '@/modules/security/server/access-context',
  '@/server/db/client',
  '@/modules/open-platform/server/platform-knowledge-management-repository',
  '@/modules/institution/server/institution-knowledge-vector-search-service',
] as const;

type Route = typeof import('@/app/api/institution/knowledge-management/retrieval/route');

const disabledPayload = {
  status: 'capability_disabled',
  code: 'knowledge_retrieval_capability_disabled',
  message: '机构知识库检索暂未启用。',
};

beforeEach(() => {
  vi.resetModules();
  initialized.length = 0;
  modulePaths.forEach((modulePath) => vi.doUnmock(modulePath));
});
afterEach(() => vi.restoreAllMocks());

function rejectInitialization(modulePath: string, label: string) {
  vi.doMock(modulePath, () => {
    initialized.push(label);
    throw new Error(`${label} must not initialize`);
  });
}

async function loadBlockedRoute() {
  rejectInitialization('@/modules/security/server/access-context', 'auth');
  rejectInitialization('@/server/db/client', 'db');
  rejectInitialization('@/modules/open-platform/server/platform-knowledge-management-repository', 'repository');
  rejectInitialization('@/modules/institution/server/institution-knowledge-vector-search-service', 'retrieval-service');
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('fetch must not run');
  });
  const route = (await import('@/app/api/institution/knowledge-management/retrieval/route')) as Route;
  expect(initialized).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();
  return { route, assertNoSideEffects: () => {
    expect(initialized).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  } };
}

describe('机构端知识库 retrieval capability route', () => {
  it('所有请求固定 capability disabled 且不初始化依赖', async () => {
    const { route, assertNoSideEffects } = await loadBlockedRoute();
    expect(Object.keys(route).sort()).toEqual(['GET']);

    for (const request of [
      undefined,
      new Request('http://localhost/api/institution/knowledge-management/retrieval?query=%E5%86%B7%E6%95%B7&mode=keyword'),
      new Request('http://localhost/api/institution/knowledge-management/retrieval?query=%E5%86%B7%E6%95%B7'),
      new Request('http://localhost/api/institution/knowledge-management/retrieval?query=%E5%86%B7%E6%95%B7&mode=vector'),
      new Request('http://localhost/api/institution/knowledge-management/retrieval?query=%E5%86%B7%E6%95%B7&mode=hybrid'),
      new Request('http://localhost/api/institution/knowledge-management/retrieval?query=%E5%86%B7%E6%95%B7&mode=forged'),
      new Request('http://localhost/api/institution/knowledge-management/retrieval?query=%E5%86%B7%E6%95%B7&mode=keyword&mode=keyword'),
      new Request('http://localhost/api/institution/knowledge-management/retrieval?query=%E5%86%B7%E6%95%B7&mode=keyword&mode=vector'),
    ]) {
      const response = await route.GET(request);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(disabledPayload);
      assertNoSideEffects();
    }
  });

  it('不触碰 hostile Proxy Request 的任一受测 trap', async () => {
    const { route, assertNoSideEffects } = await loadBlockedRoute();
    const counts = { get: 0, set: 0, has: 0, ownKeys: 0, getOwnPropertyDescriptor: 0, getPrototypeOf: 0 };
    const trap = <T extends keyof typeof counts>(name: T): never => {
      counts[name] += 1;
      throw new Error(`${name} must not run`);
    };
    const request = new Proxy({}, {
      get: () => trap('get'), set: () => trap('set'), has: () => trap('has'), ownKeys: () => trap('ownKeys'),
      getOwnPropertyDescriptor: () => trap('getOwnPropertyDescriptor'), getPrototypeOf: () => trap('getPrototypeOf'),
    }) as Request;

    const response = await route.GET(request);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(disabledPayload);
    expect(counts).toEqual({ get: 0, set: 0, has: 0, ownKeys: 0, getOwnPropertyDescriptor: 0, getPrototypeOf: 0 });
    assertNoSideEffects();
  });
});
