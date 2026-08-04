import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/api/institution/_shared/institution-route-guard', () => ({
  withInstitutionSectionRouteGuardV1: ({
    handler,
  }: {
    handler: (...args: unknown[]) => Response | Promise<Response>;
  }) => handler,
}));

import { GET } from '@/app/api/institution/wecom/external-contacts/route';

const routeSource = readFileSync(
  resolve(process.cwd(), 'src/app/api/institution/wecom/external-contacts/route.ts'),
  'utf8',
);

const capabilityDisabledPayload = Object.freeze({ code: 'capability_disabled' });

function hostileRequest() {
  let trapCount = 0;
  const request = new Proxy(Object.create(null), {
    get() {
      trapCount += 1;
      throw new Error('request must not be read');
    },
    getOwnPropertyDescriptor() {
      trapCount += 1;
      throw new Error('request must not be inspected');
    },
    has() {
      trapCount += 1;
      throw new Error('request must not be inspected');
    },
    ownKeys() {
      trapCount += 1;
      throw new Error('request must not be enumerated');
    },
  }) as Request;

  return { request, trapCount: () => trapCount };
}

async function expectCapabilityDisabled(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(capabilityDisabledPayload);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('机构端企业微信外部联系人 capability-off API', () => {
  it.each([
    ['普通请求', new Request('http://localhost/api/institution/wecom/external-contacts')],
    [
      '伪造 query、cookie 和租户头',
      new Request(
        'http://localhost/api/institution/wecom/external-contacts?scenario=ready&tenantId=MOCK-customer-input',
        {
          headers: {
            cookie: 'demo_session=DEMO-contact-input',
            'x-tenant-id': 'MOCK-tenant-input',
            'x-institution-id': 'DEMO-institution-input',
          },
        },
      ),
    ],
  ])('%s 固定返回无缓存 503，且不回显输入或联系人', async (_name, request) => {
    const fetchMock = vi.fn(() => {
      throw new Error('provider must not be called');
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(request);
    const responseCopy = response.clone();
    await expectCapabilityDisabled(response);
    const serialized = JSON.stringify(await responseCopy.json());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(serialized).not.toMatch(/mock|demo|customer|contact|tenant|institution/iu);
    expect(serialized).not.toContain('MOCK-customer-input');
    expect(serialized).not.toContain('DEMO-contact-input');
  });

  it('在读取 Request、URL、query、session 或 headers 前返回', async () => {
    const hostile = hostileRequest();

    await expectCapabilityDisabled(await GET(hostile.request));

    expect(hostile.trapCount()).toBe(0);
  });

  it('route 仅加载响应工具，不装配 session、scenario、fixture、数据库或 provider', () => {
    expect(routeSource.split('\n').filter((line) => line.startsWith('import '))).toEqual([
      "import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';",
      "import { NextResponse } from 'next/server';",
    ]);
    expect(routeSource).toContain('function GET(_request: Request)');
    expect(routeSource).toContain(
      'export { _base02B4GuardedGET as GET };',
    );
    expect(routeSource).not.toMatch(/\b_request\s*(?:\.|\[)/u);

    for (const forbiddenSource of [
      'access-context',
      'getDemoAccessContextFromRequest',
      'canAccessResource',
      'new URL',
      'searchParams',
      'scenario',
      'fixture',
      'mock',
      'demo',
      'getDatabase',
      'repository',
      'provider',
      'fetch',
      'createWeComExternalContactReadonlyApiPayload',
    ]) {
      expect(routeSource).not.toContain(forbiddenSource);
    }
  });
});
