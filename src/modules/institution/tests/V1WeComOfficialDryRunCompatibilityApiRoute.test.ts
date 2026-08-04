import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { GET as legacyGET } from '@/app/api/institution/wecom-official-dry-run/route';
import { GET as versionedGET } from '@/app/api/v1/institution/wecom-official-dry-run/route';

vi.mock('@/app/api/institution/_shared/institution-route-guard', () => ({
  withInstitutionSectionRouteGuardV1: ({
    handler,
  }: {
    handler: (...args: unknown[]) => Response | Promise<Response>;
  }) => handler,
}));

const versionedRouteSourcePath = resolve(
  process.cwd(),
  'src/app/api/v1/institution/wecom-official-dry-run/route.ts',
);

const legacyEndpoint =
  'https://institution.example.test/api/institution/wecom-official-dry-run';

const versionedEndpoint =
  'https://institution.example.test/api/v1/institution/wecom-official-dry-run';

const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '企业微信官方 dry-run 能力当前未启用',
});

function createRequest(
  endpoint: string,
  suffix = '',
  method: 'GET' | 'POST' = 'GET',
): Request {
  return new Request(`${endpoint}${suffix}`, {
    method,
    headers: {
      cookie: 'demo_session=forged-session; wecom_secret=do-not-read',
      'content-type': 'application/json',
      'x-institution-id': 'forged-institution',
      'x-tenant-id': 'forged-tenant',
    },
    body:
      method === 'POST'
        ? JSON.stringify({
            scope: 'forged',
            secret: 'input-must-not-echo',
          })
        : undefined,
  });
}

function hostileRequest() {
  let trapCount = 0;

  const value = new Proxy(Object.create(null), {
    get() {
      trapCount += 1;
      throw new Error('request must not be read');
    },
    getOwnPropertyDescriptor() {
      trapCount += 1;
      throw new Error('request must not be inspected');
    },
    getPrototypeOf() {
      trapCount += 1;
      throw new Error('request prototype must not be inspected');
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

  return {
    value,
    trapCount: () => trapCount,
  };
}

async function responseSnapshot(response: Response) {
  return {
    status: response.status,
    cacheControl: response.headers.get('cache-control'),
    payload: await response.json(),
  };
}

describe('v1 WeCom official dry-run compatibility route', () => {
  it('新旧入口导出同一个 GET 函数引用', () => {
    expect(versionedGET).toBe(legacyGET);
  });

  it.each([
    ['普通请求', '', 'GET' as const],
    ['query、cookie 与伪造租户头', '?scope=forged&secret=input-must-not-echo', 'GET' as const],
    ['带 body 的 Request', '', 'POST' as const],
  ])('新入口对%s保持与旧入口完全相同的固定低敏响应', async (_name, suffix, method) => {
    const legacyRequest = createRequest(legacyEndpoint, suffix, method);
    const versionedRequest = createRequest(versionedEndpoint, suffix, method);

    const text = vi.spyOn(versionedRequest, 'text');
    const json = vi.spyOn(versionedRequest, 'json');
    const arrayBuffer = vi.spyOn(versionedRequest, 'arrayBuffer');
    const formData = vi.spyOn(versionedRequest, 'formData');

    const legacySnapshot = await responseSnapshot(await legacyGET(legacyRequest));
    const versionedSnapshot = await responseSnapshot(await versionedGET(versionedRequest));

    expect(versionedSnapshot).toEqual(legacySnapshot);
    expect(versionedSnapshot).toEqual({
      status: 503,
      cacheControl: 'no-store',
      payload: capabilityDisabledPayload,
    });

    expect(text).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(formData).not.toHaveBeenCalled();
    expect(JSON.stringify(versionedSnapshot)).not.toContain('input-must-not-echo');
  });

  it('新入口对 hostile Request Proxy 保持零 trap', async () => {
    const hostile = hostileRequest();

    const snapshot = await responseSnapshot(await versionedGET(hostile.value));

    expect(snapshot).toEqual({
      status: 503,
      cacheControl: 'no-store',
      payload: capabilityDisabledPayload,
    });
    expect(hostile.trapCount()).toBe(0);
  });

  it('新路由源码只有一条 GET re-export', () => {
    const source = readFileSync(versionedRouteSourcePath, 'utf8');

    expect(source).toBe(
      "export { GET } from '@/app/api/institution/wecom-official-dry-run/route';\n",
    );
  });
});
