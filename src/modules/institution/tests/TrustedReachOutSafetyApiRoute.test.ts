import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GET,
  POST,
} from '@/app/api/institution/customers/[customerId]/wecom-reachout-safety/route';

type RouteContext = {
  params: Promise<{ customerId: string }>;
};

type CapabilityOffHandler = (request: Request, context: RouteContext) => Response;

type CapabilityOffContract = {
  handler: CapabilityOffHandler;
  method: 'GET' | 'POST';
  sourceExport: 'GET' | 'POST';
};

const capabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '客户企业微信触达许可能力暂未启用',
});

const routePath = '/api/institution/customers/caller_marker_customer/wecom-reachout-safety';
const routeSourcePath = 'src/app/api/institution/customers/[customerId]/wecom-reachout-safety/route.ts';

function routeContext(): RouteContext {
  return { params: Promise.resolve({ customerId: 'caller_marker_customer' }) };
}

function requestVariants(method: 'GET' | 'POST') {
  return [
    {
      label: '普通请求',
      request: new Request(`http://localhost${routePath}`, { method }),
    },
    {
      label: 'query、header 与 cookie 输入',
      request: new Request(
        `http://localhost${routePath}?tenantId=caller_marker_tenant&institutionId=caller_marker_institution`,
        {
          method,
          headers: {
            authorization: 'Bearer caller_marker_token',
            cookie: 'session=caller_marker_cookie',
            'x-customer-id': 'caller_marker_header',
          },
          body: method === 'POST' ? JSON.stringify({ input: 'caller_marker_input' }) : undefined,
        },
      ),
    },
    {
      label: '非法 JSON',
      request: new Request(`http://localhost${routePath}`, {
        method,
        body: method === 'POST' ? '{caller_marker_invalid_json' : undefined,
      }),
    },
    {
      label: '敏感或超大输入',
      request: new Request(`http://localhost${routePath}`, {
        method,
        headers: { 'content-length': '999999' },
        body: method === 'POST'
          ? JSON.stringify({ accessToken: 'caller_marker_sensitive', note: 'x'.repeat(4097) })
          : undefined,
      }),
    },
  ] as const;
}

function createHostileProxy(label: string) {
  const trap = vi.fn(() => {
    throw new Error(`${label} trap must not run`);
  });
  const proxy = new Proxy({}, {
    get: trap,
    getOwnPropertyDescriptor: trap,
    getPrototypeOf: trap,
    has: trap,
    ownKeys: trap,
    set: trap,
  });

  return { proxy, trap };
}

function expectNoDownstreamCalls() {
  expect(globalThis.fetch).not.toHaveBeenCalled();
}

async function expectCapabilityDisabledResponse(response: Response) {
  const text = await response.text();

  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(text).toBe(JSON.stringify(capabilityDisabledPayload));
  expect(Object.keys(JSON.parse(text) as Record<string, unknown>)).toEqual(['code', 'error']);
  expect(text).not.toMatch(
    /caller_marker|accessToken|authorization|cookie|tenantId|institutionId|customerId|consent|frequency|stack/iu,
  );
}

function describeCapabilityOffRoute(contract: CapabilityOffContract) {
  describe(`${contract.sourceExport} 客户企业微信触达许可 capability-off`, () => {
    it.each(requestVariants(contract.method))(
      '$label 不读取输入且同步返回固定低敏 503',
      async ({ request }) => {
        const text = vi.spyOn(request, 'text');
        const json = vi.spyOn(request, 'json');
        const response = contract.handler(request, routeContext());

        expect(response).toBeInstanceOf(Response);
        expect(text).not.toHaveBeenCalled();
        expect(json).not.toHaveBeenCalled();
        expect(request.bodyUsed).toBe(false);
        expectNoDownstreamCalls();
        await expectCapabilityDisabledResponse(response);
        expectNoDownstreamCalls();
      },
    );

    it('不读取 hostile Request 或 context Proxy', async () => {
      const hostileRequest = createHostileProxy('request');
      const hostileContext = createHostileProxy('context');
      const response = contract.handler(
        hostileRequest.proxy as unknown as Request,
        hostileContext.proxy as unknown as RouteContext,
      );

      expect(response).toBeInstanceOf(Response);
      expect(hostileRequest.trap).not.toHaveBeenCalled();
      expect(hostileContext.trap).not.toHaveBeenCalled();
      expectNoDownstreamCalls();
      await expectCapabilityDisabledResponse(response);
    });

    it('不读取 context 内嵌 params Proxy', async () => {
      const hostileParams = createHostileProxy('params');
      const response = contract.handler(
        new Request(`http://localhost${routePath}`, { method: contract.method }),
        { params: hostileParams.proxy } as unknown as RouteContext,
      );

      expect(response).toBeInstanceOf(Response);
      expect(hostileParams.trap).not.toHaveBeenCalled();
      expectNoDownstreamCalls();
      await expectCapabilityDisabledResponse(response);
    });
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('客户企业微信触达许可 route source 边界', () => {
  it('只导入 NextResponse，保留必填参数并隔离旧依赖链', () => {
    const source = readFileSync(join(process.cwd(), routeSourcePath), 'utf8');
    const importLines = source.split('\n').filter((line) => line.startsWith('import '));

    expect(importLines).toEqual(["import { NextResponse } from 'next/server';"]);
    for (const method of ['GET', 'POST'] as const) {
      expect(source).toMatch(
        new RegExp(
          `export function ${method}\\(\\s*_request: Request,\\s*_context: RouteContext,?\\s*\\)`,
          'u',
        ),
      );
    }
    expect(source).not.toMatch(/_request\?:|_context\?:|\bawait\b/u);
    expect(source).not.toMatch(
      /getDemoAccessContextFromRequest|canAccessResource|getDatabase|createTenantBusinessRepository|createTrustedReachOutSafetyRepository|readWeComReachOutSafety|recordWeComReachOutConsent|runTrustedReachOutSafetyTransaction|readJsonBody|parseRequest|\.transaction\(|\b_?request\s*(?:\.|\[)|\b_?context\s*(?:\.|\[)|fetch\s*\(/u,
    );
  });
});

describeCapabilityOffRoute({ handler: GET, method: 'GET', sourceExport: 'GET' });
describeCapabilityOffRoute({ handler: POST, method: 'POST', sourceExport: 'POST' });
