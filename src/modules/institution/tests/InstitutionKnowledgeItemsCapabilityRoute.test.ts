import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initialized: string[] = [];
const modulePaths = [
  '@/modules/security/server/access-context',
  '@/server/db/client',
  '@/modules/open-platform/server/platform-knowledge-management-repository',
  '@/modules/institution/server/institution-knowledge-write-repository',
  '@/modules/institution/server/institution-knowledge-management-service',
] as const;

type Route = typeof import('@/app/api/institution/knowledge-management/items/route');

const disabledPayload = {
  status: 'capability_disabled',
  code: 'knowledge_items_capability_disabled',
  message: '机构知识库资料库暂未启用。',
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
  rejectInitialization('@/modules/institution/server/institution-knowledge-write-repository', 'write-repository');
  rejectInitialization('@/modules/institution/server/institution-knowledge-management-service', 'service');
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('fetch must not run');
  });
  const route = (await import('@/app/api/institution/knowledge-management/items/route')) as Route;
  expect(initialized).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();
  return {
    route,
    assertNoSideEffects: () => {
      expect(initialized).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  };
}

function hostileRequest() {
  const counts = { get: 0, set: 0, has: 0, ownKeys: 0, getOwnPropertyDescriptor: 0, getPrototypeOf: 0 };
  const trap = <T extends keyof typeof counts>(name: T): never => {
    counts[name] += 1;
    throw new Error(`${name} must not run`);
  };
  const request = new Proxy({}, {
    get: () => trap('get'),
    set: () => trap('set'),
    has: () => trap('has'),
    ownKeys: () => trap('ownKeys'),
    getOwnPropertyDescriptor: () => trap('getOwnPropertyDescriptor'),
    getPrototypeOf: () => trap('getPrototypeOf'),
  }) as Request;
  return { request, counts };
}

describe('机构端知识库资料库 capability route', () => {
  it('仅导出 GET、POST、PATCH，普通与伪造请求固定 capability disabled 且零副作用', async () => {
    const { route, assertNoSideEffects } = await loadBlockedRoute();
    expect(Object.keys(route).sort()).toEqual(['GET', 'PATCH', 'POST']);

    for (const [method, request] of [
      ['GET', undefined],
      ['GET', new Request('http://localhost/api/institution/knowledge-management/items?keyword=forged', {
        headers: { authorization: 'Bearer forged', 'x-institution-id': 'forged' },
      })],
      ['POST', new Request('http://localhost/api/institution/knowledge-management/items', {
        method: 'POST', body: JSON.stringify({ title: 'forged' }),
      })],
      ['PATCH', new Request('http://localhost/api/institution/knowledge-management/items', {
        method: 'PATCH', body: JSON.stringify({ action: 'archive', knowledgeId: 'forged' }),
      })],
    ] as const) {
      const response = await route[method](request as Request);
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      await expect(response.json()).resolves.toEqual(disabledPayload);
      assertNoSideEffects();
    }
  });

  it('三种方法均不触碰 hostile Proxy Request', async () => {
    const { route, assertNoSideEffects } = await loadBlockedRoute();

    for (const method of ['GET', 'POST', 'PATCH'] as const) {
      const { request, counts } = hostileRequest();
      const response = await route[method](request as Request);
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      await expect(response.json()).resolves.toEqual(disabledPayload);
      expect(counts).toEqual({ get: 0, set: 0, has: 0, ownKeys: 0, getOwnPropertyDescriptor: 0, getPrototypeOf: 0 });
      assertNoSideEffects();
    }
  });
});
