import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GET,
  POST,
} from '@/app/api/institution/wecom-customer-mapping/route';

const routeSource = readFileSync(
  resolve(process.cwd(), 'src/app/api/institution/wecom-customer-mapping/route.ts'),
  'utf8',
);

const forbiddenResponseKeys = [
  'customerId',
  'proofContactId',
  'proofEmployeeId',
  'mapping',
  'status',
  'version',
  'audit',
  'mockDemo',
  'outcome',
  'result',
] as const;

async function expectCapabilityDisabled(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const payload = await response.json();
  expect(payload).toEqual({ code: 'capability_disabled' });
  for (const key of forbiddenResponseKeys) {
    expect(payload).not.toHaveProperty(key);
  }
}

function requestWithBody(body: string, headers: HeadersInit = {}) {
  return new Request('http://localhost/api/institution/wecom-customer-mapping?scope=forged', {
    method: 'POST',
    headers: {
      cookie: 'demo_session=forged',
      'content-type': 'application/json',
      'x-tenant-id': 'forged-tenant',
      'x-institution-id': 'forged-institution',
      ...headers,
    },
    body,
  });
}

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

describe('WeCom customer mapping API route', () => {
  it.each([
    ['GET 普通 query/header/cookie 请求', () => GET(new Request(
      'http://localhost/api/institution/wecom-customer-mapping?scope=forged',
      { headers: { cookie: 'demo_session=forged', 'x-tenant-id': 'forged-tenant' } },
    ))],
    ['GET 缺认证请求', () => GET(new Request('http://localhost/api/institution/wecom-customer-mapping'))],
    ['POST 伪造 scope 请求', () => POST(requestWithBody(JSON.stringify({
      action: 'confirm', proofContactId: 'forged-proof', customerId: 'forged-customer',
    })))],
    ['POST 畸形 body 请求', () => POST(requestWithBody('{not-json'))],
    ['POST 超大 body 请求', () => POST(requestWithBody('x'.repeat(4_096), { 'content-length': '4096' }))],
  ])('%s 统一 fail-closed，且不泄漏映射事实', async (_name, invoke) => {
    await expectCapabilityDisabled(await invoke());
  });

  it('GET/POST 不读取 hostile Request 的任何属性', async () => {
    const getRequest = hostileRequest();
    const postRequest = hostileRequest();

    await expectCapabilityDisabled(await GET(getRequest.request));
    await expectCapabilityDisabled(await POST(postRequest.request));

    expect(getRequest.trapCount()).toBe(0);
    expect(postRequest.trapCount()).toBe(0);
  });

  it('route 未装配 demo guard、数据库、repository、service、transaction 或 fetch', () => {
    expect(routeSource).toContain("import { NextResponse } from 'next/server';");
    for (const forbiddenSource of [
      'access-context',
      'getDatabase',
      'tenant-business-repository',
      'wecom-customer-mapping-repository',
      'wecom-customer-mapping-service',
      'wecom-customer-mapping-transaction',
      'fetch(',
      'request.',
      'request[',
      '_request.',
      '_request[',
    ]) {
      expect(routeSource).not.toContain(forbiddenSource);
    }
  });
});
