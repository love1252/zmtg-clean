import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const forbidden = vi.hoisted(() => ({ initialized: [] as string[] }));

vi.mock('@/modules/security/server/access-context', () => { forbidden.initialized.push('auth'); throw new Error('auth must not initialize'); });
vi.mock('@/server/db/client', () => { forbidden.initialized.push('db'); throw new Error('db must not initialize'); });
vi.mock('@/modules/open-platform/server/platform-knowledge-management-repository', () => { forbidden.initialized.push('repository'); throw new Error('repository must not initialize'); });
vi.mock('@/modules/institution/server/institution-knowledge-qa-service', () => { forbidden.initialized.push('qa-service'); throw new Error('qa service must not initialize'); });

type Route = typeof import('@/app/api/institution/knowledge-management/qa/route');

beforeEach(() => {
  vi.resetModules();
  forbidden.initialized.length = 0;
});
afterEach(() => vi.restoreAllMocks());

async function loadRoute() {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('fetch must not run');
  });
  const route = (await import('@/app/api/institution/knowledge-management/qa/route')) as Route;
  expect(forbidden.initialized).toEqual([]);
  expect(fetchSpy).not.toHaveBeenCalled();
  return { route, assertNoFetch: () => expect(fetchSpy).not.toHaveBeenCalled() };
}

function trappedRequest() {
  const counts = { get: 0, set: 0, has: 0, ownKeys: 0, getOwnPropertyDescriptor: 0, getPrototypeOf: 0 };
  const trap = <T extends keyof typeof counts>(name: T): never => {
    counts[name] += 1;
    throw new Error(`${name} must not run`);
  };
  const request = new Proxy({}, {
    get: () => trap('get'), set: () => trap('set'), has: () => trap('has'), ownKeys: () => trap('ownKeys'),
    getOwnPropertyDescriptor: () => trap('getOwnPropertyDescriptor'), getPrototypeOf: () => trap('getPrototypeOf'),
  });
  return { request: request as Request, counts };
}

describe('机构端知识库 QA capability route', () => {
  it('动态加载后仅导出 POST，普通/伪造请求固定 capability disabled', async () => {
    const { route, assertNoFetch } = await loadRoute();
    expect(Object.keys(route).sort()).toEqual(['POST']);
    for (const request of [undefined, new Request('http://localhost/api/institution/knowledge-management/qa', { method: 'POST', headers: { authorization: 'Bearer forged' }, body: JSON.stringify({ provider: 'forged', question: 'ignored' }) })]) {
      const response = await route.POST(request as Request);
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      await expect(response.json()).resolves.toEqual({ status: 'capability_disabled', code: 'knowledge_qa_capability_disabled', answer: '机构知识库问答暂未启用。仅供内部运营参考，需人工确认', citations: [] });
      expect(forbidden.initialized).toEqual([]);
      assertNoFetch();
    }
  });

  it('不触碰 Proxy Request 的任一受测 trap', async () => {
    const { route, assertNoFetch } = await loadRoute();
    const poisoned = trappedRequest();
    const response = await route.POST(poisoned.request);
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(poisoned.counts).toEqual({ get: 0, set: 0, has: 0, ownKeys: 0, getOwnPropertyDescriptor: 0, getPrototypeOf: 0 });
    expect(forbidden.initialized).toEqual([]);
    assertNoFetch();
  });
});
