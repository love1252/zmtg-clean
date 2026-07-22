import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const forbiddenDependencyState = vi.hoisted(() => ({
  initialized: [] as string[],
}));

vi.mock('@/modules/security/server/access-context', () => {
  forbiddenDependencyState.initialized.push('auth');
  throw new Error('auth must not initialize');
});
vi.mock('@/server/db/client', () => {
  forbiddenDependencyState.initialized.push('db');
  throw new Error('db must not initialize');
});
vi.mock('@/modules/open-platform/server/platform-knowledge-management-repository', () => {
  forbiddenDependencyState.initialized.push('repository');
  throw new Error('repository must not initialize');
});
vi.mock('@/modules/institution/server/tenant-quota-enforcement', () => {
  forbiddenDependencyState.initialized.push('quota');
  throw new Error('quota must not initialize');
});
vi.mock('@/modules/institution/server/knowledge-quota-usage-service', () => {
  forbiddenDependencyState.initialized.push('quota-usage');
  throw new Error('quota usage must not initialize');
});
vi.mock('@/modules/institution/server/institution-knowledge-rag-answer-service', () => {
  forbiddenDependencyState.initialized.push('rag');
  throw new Error('RAG must not initialize');
});
vi.mock('@/modules/institution/server/institution-rag-answer-provider', () => {
  forbiddenDependencyState.initialized.push('provider');
  throw new Error('provider must not initialize');
});
vi.mock('@/modules/institution/server/institution-ai-call-service', () => {
  forbiddenDependencyState.initialized.push('ai-call');
  throw new Error('AI call service must not initialize');
});
vi.mock('@/modules/institution/server/institution-ai-call-usage-repository', () => {
  forbiddenDependencyState.initialized.push('ai-call-usage');
  throw new Error('AI call usage repository must not initialize');
});

const expectedPayload = {
  status: 'capability_disabled',
  code: 'knowledge_capability_disabled',
  answer: '机构知识库问答暂未启用。仅供内部运营参考，需人工确认',
  sources: [],
};

type AnswerRouteModule = typeof import('@/app/api/institution/knowledge-management/answer/route');

beforeEach(() => {
  vi.resetModules();
  forbiddenDependencyState.initialized.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadRouteWithoutForbiddenDependencies() {
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => {
      throw new Error('fetch must not be called');
    });
  const route = (await import(
    '@/app/api/institution/knowledge-management/answer/route'
  )) as AnswerRouteModule;

  expect(forbiddenDependencyState.initialized).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();
  return {
    route,
    assertNoFetch: () => expect(fetchSpy).not.toHaveBeenCalled(),
  };
}

async function expectCapabilityDisabled(
  route: AnswerRouteModule,
  assertNoFetch: () => void,
  request?: Request,
) {
  const response = await route.POST(request);

  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(expectedPayload);
  expect(forbiddenDependencyState.initialized).toEqual([]);
  assertNoFetch();
}

function fullyTrappedRequest() {
  const counts = {
    apply: 0,
    construct: 0,
    defineProperty: 0,
    deleteProperty: 0,
    get: 0,
    getOwnPropertyDescriptor: 0,
    getPrototypeOf: 0,
    has: 0,
    isExtensible: 0,
    ownKeys: 0,
    preventExtensions: 0,
    set: 0,
    setPrototypeOf: 0,
  };
  const trap = <T extends keyof typeof counts>(name: T): never => {
    counts[name] += 1;
    throw new Error(`${name} trap must not run`);
  };
  const request = new Proxy(function poisonedRequest() {}, {
    apply: () => trap('apply'),
    construct: () => trap('construct'),
    defineProperty: () => trap('defineProperty'),
    deleteProperty: () => trap('deleteProperty'),
    get: () => trap('get'),
    getOwnPropertyDescriptor: () => trap('getOwnPropertyDescriptor'),
    getPrototypeOf: () => trap('getPrototypeOf'),
    has: () => trap('has'),
    isExtensible: () => trap('isExtensible'),
    ownKeys: () => trap('ownKeys'),
    preventExtensions: () => trap('preventExtensions'),
    set: () => trap('set'),
    setPrototypeOf: () => trap('setPrototypeOf'),
  });

  return { request: request as unknown as Request, counts };
}

describe('机构端知识库 answer API route', () => {
  it('动态加载后只导出 POST，不初始化 auth/db/repository/quota/RAG/provider', async () => {
    const { route, assertNoFetch } = await loadRouteWithoutForbiddenDependencies();

    expect(Object.keys(route).sort()).toEqual(['POST']);
    await expectCapabilityDisabled(route, assertNoFetch);
  });

  it('普通、未登录、伪造 header 与 provider/model 请求均得到同一固定响应', async () => {
    const { route, assertNoFetch } = await loadRouteWithoutForbiddenDependencies();
    const requests = [
      new Request('http://localhost/api/institution/knowledge-management/answer', {
        method: 'POST',
        body: JSON.stringify({ question: '术后冷敷注意事项？' }),
      }),
      new Request('http://localhost/api/institution/knowledge-management/answer', {
        method: 'POST',
      }),
      new Request('http://localhost/api/institution/knowledge-management/answer', {
        method: 'POST',
        headers: {
          'x-tenant-id': 'forged-tenant',
          'x-institution-id': 'forged-institution',
          authorization: 'Bearer forged',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'forged-provider',
          model: 'forged-model',
          question: 'ignored',
        }),
      }),
    ];

    for (const request of requests) {
      await expectCapabilityDisabled(route, assertNoFetch, request);
    }
  });

  it('完全 trapped 的 Proxy Request 不触发任何 trap', async () => {
    const { route, assertNoFetch } = await loadRouteWithoutForbiddenDependencies();
    const poisoned = fullyTrappedRequest();

    await expectCapabilityDisabled(route, assertNoFetch, poisoned.request);
    expect(poisoned.counts).toEqual({
      apply: 0,
      construct: 0,
      defineProperty: 0,
      deleteProperty: 0,
      get: 0,
      getOwnPropertyDescriptor: 0,
      getPrototypeOf: 0,
      has: 0,
      isExtensible: 0,
      ownKeys: 0,
      preventExtensions: 0,
      set: 0,
      setPrototypeOf: 0,
    });
  });
});
