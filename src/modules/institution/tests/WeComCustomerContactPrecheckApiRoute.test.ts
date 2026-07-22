import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/institution/wecom-customer-contact-precheck/route';

const endpoint = 'http://localhost/api/institution/wecom-customer-contact-precheck';
const capabilityDisabledPayload = {
  code: 'capability_disabled',
  error: '企业微信客户联系预检查能力当前未启用',
};
const sensitiveInput = {
  action: 'evaluate',
  authorization: 'Bearer customer-contact-secret-local-test',
  customerId: 'customer-local-test',
  externalUserId: 'wxid-local-test',
  proof: 'customer-contact-proof-local-test',
};

function request(method: 'GET' | 'POST', options: RequestInit = {}) {
  return new Request(endpoint, { method, ...options });
}

async function expectCapabilityDisabled(response: Response) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual(capabilityDisabledPayload);
}

function createHostileRequest(method: 'GET' | 'POST') {
  const accessed: PropertyKey[] = [];
  const target = request(method, {
    body: method === 'POST' ? JSON.stringify(sensitiveInput) : undefined,
  });
  const hostile = new Proxy(target, {
    get(_target, key) {
      accessed.push(key);
      throw new Error(`request property ${String(key)} must not be read`);
    },
  });

  return { request: hostile as unknown as Request, accessed };
}

describe('wecom customer contact precheck API route', () => {
  it('GET 固定返回低敏 capability_disabled', async () => {
    await expectCapabilityDisabled(GET(request('GET')));
  });

  it('POST 固定返回低敏 capability_disabled 且不回显敏感输入', async () => {
    const response = POST(request('POST', { body: JSON.stringify(sensitiveInput) }));

    expect((await response.clone().text())).not.toContain('customer-contact-secret-local-test');
    expect((await response.clone().text())).not.toContain('customer-local-test');
    expect((await response.clone().text())).not.toContain('wxid-local-test');
    await expectCapabilityDisabled(response);
  });

  it.each([
    ['缺少认证', request('GET')],
    ['伪造 scope', request('POST', {
      headers: { 'x-tenant-id': 'forged-tenant', 'x-institution-id': 'forged-institution' },
      body: JSON.stringify(sensitiveInput),
    })],
    ['非法 JSON', request('POST', { body: '{' })],
    ['超大 body', request('POST', { body: 'x'.repeat(1_048_577) })],
  ] as const)('%s 不改变固定 capability-off 响应', async (_caseName, input) => {
    await expectCapabilityDisabled(input.method === 'GET' ? GET(input) : POST(input));
  });

  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)('%s 不读取 hostile Request 的任何属性', async (method, handler) => {
    const hostile = createHostileRequest(method);

    await expectCapabilityDisabled(handler(hostile.request));
    expect(hostile.accessed).toEqual([]);
  });

  it('POST 不读取 body/json/text/url/headers/cookies', async () => {
    const accessed: PropertyKey[] = [];
    const input = new Proxy(request('POST', { body: JSON.stringify(sensitiveInput) }), {
      get(_target, key) {
        accessed.push(key);
        throw new Error(`request property ${String(key)} must not be read`);
      },
    }) as unknown as Request;

    await expectCapabilityDisabled(POST(input));
    expect(accessed).toEqual([]);
  });

  it('响应不暴露旧配置、开关或预检查事实', async () => {
    const response = GET(request('GET'));
    const payload = (await response.clone().json()) as Record<string, unknown>;

    for (const key of [
      'configured',
      'capabilityEnabled',
      'permissionConfirmed',
      'credentialPlaceholderReady',
      'singleEmployeeSelected',
      'customerReadEnabled',
      'networkEnabled',
      'realSendEnabled',
      'precheckStatus',
      'reason',
      'proofAuthorized',
      'guards',
    ]) {
      expect(payload).not.toHaveProperty(key);
    }
    await expectCapabilityDisabled(response);
  });

  it('route 只依赖 NextResponse，不初始化 session、runtime、领域、DB、audit、provider 或 fetch', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/institution/wecom-customer-contact-precheck/route.ts'),
      'utf8',
    );

    expect(source).toBe(`import { NextResponse } from 'next/server';

const capabilityDisabledPayload = {
  code: 'capability_disabled',
  error: '企业微信客户联系预检查能力当前未启用',
} as const;

function capabilityDisabledResponse() {
  return NextResponse.json(capabilityDisabledPayload, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function GET(_request: Request) {
  return capabilityDisabledResponse();
}

export function POST(_request: Request) {
  return capabilityDisabledResponse();
}
`);
  });
});
