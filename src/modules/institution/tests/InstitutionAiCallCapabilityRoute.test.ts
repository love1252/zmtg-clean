import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initialized: string[] = [];
const guardedModules = [
  '@/modules/security/server/access-context',
  '@/server/db/client',
  '@/modules/institution/server/institution-ai-call-usage-repository',
  '@/modules/institution/server/tenant-quota-enforcement',
  '@/modules/institution/server/institution-ai-call-service',
  '@/modules/security/server/secretEncryption',
] as const;

type Route = typeof import('@/app/api/institution/knowledge-management/ai-call/route');

const disabledPayload = {
  status: 'capability_disabled',
  code: 'institution_ai_call_capability_disabled',
  message: '机构 AI 调用暂未启用。',
};

beforeEach(() => {
  vi.resetModules();
  initialized.length = 0;
  guardedModules.forEach((modulePath) => vi.doUnmock(modulePath));
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
  rejectInitialization('@/modules/institution/server/institution-ai-call-usage-repository', 'repository');
  rejectInitialization('@/modules/institution/server/tenant-quota-enforcement', 'quota');
  rejectInitialization('@/modules/institution/server/institution-ai-call-service', 'service');
  rejectInitialization('@/modules/security/server/secretEncryption', 'provider-secret');
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('fetch must not run');
  });
  const route = (await import('@/app/api/institution/knowledge-management/ai-call/route')) as Route;
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

function trappedRequest() {
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

describe('机构端 AI 调用 capability route', () => {
  it('模块初始化与普通、伪造请求均不触发依赖', async () => {
    const { route, assertNoSideEffects } = await loadBlockedRoute();
    expect(Object.keys(route).sort()).toEqual(['POST']);

    for (const request of [
      undefined,
      new Request('http://localhost/api/institution/knowledge-management/ai-call', { method: 'POST' }),
      new Request('http://localhost/api/institution/knowledge-management/ai-call', { method: 'POST', headers: { authorization: 'Bearer forged', 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'forged', model: 'forged', question: 'ignored' }) }),
    ]) {
      const response = await route.POST(request);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(disabledPayload);
      assertNoSideEffects();
    }
  });

  it('不触碰 hostile Proxy Request 的任一受测 trap', async () => {
    const { route, assertNoSideEffects } = await loadBlockedRoute();
    const poisoned = trappedRequest();
    const response = await route.POST(poisoned.request);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(disabledPayload);
    expect(poisoned.counts).toEqual({ get: 0, set: 0, has: 0, ownKeys: 0, getOwnPropertyDescriptor: 0, getPrototypeOf: 0 });
    assertNoSideEffects();
  });
});
