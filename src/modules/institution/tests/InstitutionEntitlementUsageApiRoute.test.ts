import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/institution/entitlement-usage/route';

const routeMocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  getTenantEntitlementUsageService: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({ getDatabase: routeMocks.getDatabase }));
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/modules/institution/server/entitlement-usage-service', () => ({
  getTenantEntitlementUsageService: routeMocks.getTenantEntitlementUsageService,
}));

const capabilityDisabledResponse = {
  code: 'capability_disabled',
  error: '机构套餐权益用量能力暂未启用。',
};

const fetchMock = vi.fn();
type RouteHandler = (...args: readonly unknown[]) => Promise<Response>;
const handler = GET as RouteHandler;

function request() {
  return new Request(
    'http://localhost/api/institution/entitlement-usage?tenantId=other-tenant&remaining=999',
    { headers: { cookie: 'demo_session=should-not-read; token=should-not-read' } },
  );
}

function hostileRequest() {
  const traps = { get: 0, ownKeys: 0, descriptor: 0 };
  const value = new Proxy({} as Request, {
    get() {
      traps.get += 1;
      throw new Error('request must not be read');
    },
    getOwnPropertyDescriptor() {
      traps.descriptor += 1;
      throw new Error('request descriptors must not be read');
    },
    ownKeys() {
      traps.ownKeys += 1;
      throw new Error('request keys must not be read');
    },
  });
  return { traps, value };
}

function expectNoDownstreamCalls() {
  for (const mock of Object.values(routeMocks)) expect(mock).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
}

async function expectCapabilityDisabled(input: unknown) {
  const response = await handler(input);
  const result = await response.json();

  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(result).toEqual(capabilityDisabledResponse);
  expect(Object.keys(result as object).sort()).toEqual(['code', 'error']);
  expect(JSON.stringify(result)).not.toMatch(
    /other-tenant|remaining|records|items|quota|used|limit|count|ai_calls|token/i,
  );
  expectNoDownstreamCalls();
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  Object.values(routeMocks).forEach((mock) => mock.mockReset());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('机构端 entitlement-usage capability-off API route', () => {
  it('普通或非法查询固定返回低敏 503，且下游零初始化零调用', async () => {
    routeMocks.getDatabase.mockImplementation(() => {
      throw new Error('DATABASE_URL must not be reached');
    });
    routeMocks.getTenantEntitlementUsageService.mockRejectedValue(
      new Error('service failure must not become empty usage'),
    );

    await expectCapabilityDisabled(
      new Request('http://localhost/api/institution/entitlement-usage'),
    );
    await expectCapabilityDisabled(request());
  });

  it('不解引用 hostile Request', async () => {
    const hostileInput = hostileRequest();

    await expectCapabilityDisabled(hostileInput.value);
    expect(hostileInput.traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
  });

  it('route 仅导入 NextResponse，且不含 session、持久化、服务或用量事实路径', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/app/api/institution/entitlement-usage/route.ts'),
      'utf8',
    );
    const imports = source.match(/^import .*$/gmu) ?? [];

    expect(imports).toEqual(["import { NextResponse } from 'next/server';"]);
    expect(source).not.toMatch(
      /getDemoAccessContextFromRequest|getDatabase|getTenantEntitlementUsageService|request\.|cookie|session|repository|service|records|items|quota|remaining|used|limit|count|fetch\(|process\.env/i,
    );
  });
});
