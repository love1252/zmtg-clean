import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const initialized: string[] = [];
const modulePaths = [
  '@/modules/security/server/access-context',
  '@/server/db/client',
  '@/modules/open-platform/server/platform-knowledge-management-repository',
  '@/modules/open-platform/server/platform-knowledge-file-storage',
  '@/modules/institution/server/institution-knowledge-file-management-service',
] as const;

type Route = typeof import('@/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/download/route');

const disabledPayload = {
  status: 'capability_disabled',
  code: 'capability_disabled',
  error: '机构知识库文件下载暂未启用。',
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
  rejectInitialization(
    '@/modules/open-platform/server/platform-knowledge-management-repository',
    'repository',
  );
  rejectInitialization('@/modules/open-platform/server/platform-knowledge-file-storage', 'storage');
  rejectInitialization(
    '@/modules/institution/server/institution-knowledge-file-management-service',
    'file-service',
  );
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    throw new Error('fetch must not run');
  });
  const route = (await import(
    '@/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/download/route'
  )) as Route;

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

function hostileProxy<T>(label: string) {
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
    throw new Error(`${label}.${name} must not run`);
  };
  const value = new Proxy(
    {},
    {
      get: () => trap('get'),
      set: () => trap('set'),
      has: () => trap('has'),
      ownKeys: () => trap('ownKeys'),
      getOwnPropertyDescriptor: () => trap('getOwnPropertyDescriptor'),
      getPrototypeOf: () => trap('getPrototypeOf'),
    },
  );
  return { value: value as T, counts };
}

async function expectDisabled(response: Response, marker: string) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(disabledPayload);
  expect(JSON.stringify(disabledPayload)).not.toContain(marker);
}

describe('机构端知识库文件下载 capability route', () => {
  it('动态加载后只导出 GET，普通、非法和伪造请求均固定 capability disabled', async () => {
    const { route, assertNoSideEffects } = await loadBlockedRoute();
    const marker = 'private-customer-file-name.pdf';
    expect(Object.keys(route).sort()).toEqual(['GET']);

    for (const [request, context] of [
      [undefined, undefined],
      [
        new Request(
          `http://localhost/api/institution/knowledge-management/items/private-knowledge/files/${marker}/download`,
        ),
        { params: Promise.resolve({ knowledgeId: 'private-knowledge', fileId: marker }) },
      ],
      [
        new Request(
          `http://localhost/api/institution/knowledge-management/items/private-knowledge/files/${marker}/download?url=https%3A%2F%2Funsafe.example%2F${marker}`,
          { headers: { authorization: 'Bearer forged', 'x-institution-id': 'forged' } },
        ),
        null,
      ],
    ] as const) {
      await expectDisabled(await route.GET(request as Request, context), marker);
      assertNoSideEffects();
    }
  });

  it('不触碰 hostile Request 或 context Proxy 的任一受测 trap', async () => {
    const { route, assertNoSideEffects } = await loadBlockedRoute();
    const request = hostileProxy<Request>('request');
    const context = hostileProxy<unknown>('context');

    await expectDisabled(await route.GET(request.value, context.value), 'ignored');
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
  });

  it('源码仅依赖 NextResponse，且不包含输入或下游依赖访问', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/app/api/institution/knowledge-management/items/[knowledgeId]/files/[fileId]/download/route.ts',
      ),
      'utf8',
    );

    expect(source.match(/^import .*;$/gm)).toEqual(["import { NextResponse } from 'next/server';"]);
    expect(source).not.toMatch(
      /getDemoAccessContextFromRequest|getDatabase|repository|storage|downloadInstitutionKnowledgeFileService|\brequest\s*(?:\.|\[)|\bcontext\s*(?:\.|\[)|\bfetch\s*\(/,
    );
  });
});
