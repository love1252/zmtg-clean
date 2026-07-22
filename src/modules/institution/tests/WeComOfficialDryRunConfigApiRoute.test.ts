import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GET,
  POST,
} from '@/app/api/institution/wecom-official-dry-run-config/route';

const routeSourcePath = resolve(
  process.cwd(),
  'src/app/api/institution/wecom-official-dry-run-config/route.ts',
);

const expectedPayload = Object.freeze({
  code: 'capability_disabled',
  error: '当前能力尚未开放',
});

function request(method: 'GET' | 'POST', suffix = '', body?: string): Request {
  return new Request(
    `https://institution.example.test/api/institution/wecom-official-dry-run-config${suffix}`,
    {
      method,
      headers: {
        cookie: 'demo_session=forged-session; wecom_secret=do-not-read',
        'x-institution-id': 'forged-institution',
        'content-type': 'application/json',
      },
      body,
    },
  );
}

async function expectCapabilityDisabled(response: Response): Promise<void> {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(expectedPayload);
}

function hostileRequest(requestValue: Request) {
  let trapCount = 0;
  const proxy = new Proxy(requestValue, {
    get() {
      trapCount += 1;
      throw new Error('request must not be read');
    },
    getOwnPropertyDescriptor() {
      trapCount += 1;
      throw new Error('request must not be inspected');
    },
    ownKeys() {
      trapCount += 1;
      throw new Error('request must not be enumerated');
    },
  });

  return Object.freeze({ request: proxy as Request, traps: () => trapCount });
}

describe('WeCom official dry-run config API route capability-off boundary', () => {
  it.each([
    ['GET 普通请求', () => GET(request('GET'))],
    ['GET query 与 cookie', () => GET(request('GET', '?route=official_wecom_self_built&secret=do-not-read'))],
    ['POST 普通请求', () => POST(request('POST', '', JSON.stringify({ officialRoute: 'official_wecom_self_built' })) )],
    ['POST 非法 JSON', () => POST(request('POST', '', '{not-json'))],
    ['POST 敏感输入', () => POST(request('POST', '', JSON.stringify({ corpId: 'corp-real', secret: 'secret-real', token: 'token-real' })) )],
  ])('%s 一律返回固定低敏 capability-off 响应', async (_name, invoke) => {
    await expectCapabilityDisabled(await invoke());
  });

  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)('%s 不读取 hostile Request 的任何属性或 body', async (_method, handler) => {
    const hostile = hostileRequest(request(_method));

    await expectCapabilityDisabled(await handler(hostile.request));
    expect(hostile.traps()).toBe(0);
  });

  it('仅导入 NextResponse，不初始化或调用旧 session、RBAC、DB、审计和领域依赖', () => {
    const source = readFileSync(routeSourcePath, 'utf8');
    const imports = source.match(/^import .+;$/gmu) ?? [];

    expect(imports).toEqual(["import { NextResponse } from 'next/server';"]);
    expect(source).not.toMatch(/getDemoAccessContextFromRequest|canAccessResource|getDatabase|createAuditEvent|createAuditEventRepository|evaluateRealChannelPreflight|evaluateWeComOfficialDryRunConfig|request\.json|request\.url|request\.headers|request\.cookies|request\.body/u);
    expect(source).not.toMatch(/config|route|scope|preflight|dry[_-]?run[_-]?ready|label|audit/iu);
  });
});
