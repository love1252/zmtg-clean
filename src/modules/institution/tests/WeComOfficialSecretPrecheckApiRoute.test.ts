import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const downstream = vi.hoisted(() => ({
  canAccessResource: vi.fn(() => {
    throw new Error('access control must not run');
  }),
  createClient: vi.fn(() => {
    throw new Error('client must not be created');
  }),
  evaluatePrecheck: vi.fn(() => {
    throw new Error('provider must not run');
  }),
  getAccessContext: vi.fn(() => {
    throw new Error('session must not be read');
  }),
  readConfig: vi.fn(() => {
    throw new Error('config and secrets must not be read');
  }),
  summarizeConfig: vi.fn(() => {
    throw new Error('config must not be summarized');
  }),
}));

vi.mock('@/modules/security/domain/access-control', () => ({
  canAccessResource: downstream.canAccessResource,
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: downstream.getAccessContext,
}));

vi.mock('@/modules/institution/domain/wecom-official-secret-precheck', () => ({
  evaluateWeComOfficialSecretPrecheck: downstream.evaluatePrecheck,
  summarizeWeComOfficialSecretPrecheckConfig: downstream.summarizeConfig,
}));

vi.mock('@/modules/institution/server/wecom-official-secret-precheck-runtime', () => ({
  createWeComOfficialTokenPreflightClient: downstream.createClient,
  readWeComOfficialSecretPrecheckConfig: downstream.readConfig,
}));

import {
  GET,
  POST,
} from '@/app/api/institution/wecom-official-secret-precheck/route';

type RouteHandler = (request: Request) => Response;

const routeSource = readFileSync(
  resolve(
    process.cwd(),
    'src/app/api/institution/wecom-official-secret-precheck/route.ts',
  ),
  'utf8',
);

const expectedBody = Object.freeze({
  code: 'capability_disabled',
  error: '企业微信官方密钥预检能力暂未启用。',
});

const routeCases: ReadonlyArray<{ name: 'GET' | 'POST'; handler: RouteHandler }> = [
  { name: 'GET', handler: GET },
  { name: 'POST', handler: POST },
];

const fetchMock = vi.fn(() => {
  throw new Error('network must not be called');
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function expectNoDownstreamCalls() {
  for (const dependency of Object.values(downstream)) {
    expect(dependency).not.toHaveBeenCalled();
  }
  expect(fetchMock).not.toHaveBeenCalled();
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
      throw new Error('request descriptors must not be read');
    },
    has() {
      trapCount += 1;
      throw new Error('request keys must not be checked');
    },
    ownKeys() {
      trapCount += 1;
      throw new Error('request keys must not be enumerated');
    },
  }) as Request;

  return { request, trapCount: () => trapCount };
}

async function expectCapabilityDisabled(handler: RouteHandler, request: Request) {
  const response = handler(request);

  expect(response).toBeInstanceOf(Response);
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  await expect(response.json()).resolves.toEqual(expectedBody);
  expectNoDownstreamCalls();
}

describe('企业微信官方密钥预检 capability-off API', () => {
  it.each([
    [
      '普通 GET',
      GET,
      new Request('http://localhost/api/institution/wecom-official-secret-precheck'),
    ],
    [
      '带伪造 query、cookie 与机构头的 GET',
      GET,
      new Request(
        'http://localhost/api/institution/wecom-official-secret-precheck?action=SENSITIVE_ACTION&tenantId=SENSITIVE_TENANT',
        {
          headers: {
            authorization: 'Bearer SENSITIVE_TOKEN',
            cookie: 'demo_session=SENSITIVE_SESSION',
            'x-institution-id': 'SENSITIVE_INSTITUTION',
          },
        },
      ),
    ],
    [
      '非法 body 的 POST',
      POST,
      new Request(
        'http://localhost/api/institution/wecom-official-secret-precheck?payload=SENSITIVE_QUERY',
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer SENSITIVE_TOKEN',
            'content-type': 'application/json',
          },
          body: '{"agentSecret":"SENSITIVE_BODY"',
        },
      ),
    ],
  ] as const)('%s 固定同步返回无缓存 503 且不回显输入', async (_name, handler, request) => {
    const response = handler(request);
    const responseCopy = response.clone();

    expect(response).toBeInstanceOf(Response);
    await expectCapabilityDisabled(handler, request);
    const serialized = JSON.stringify(await responseCopy.json());

    expect(serialized).not.toMatch(/SENSITIVE_|tenantId|institutionId|token|secret|payload/iu);
  });

  it.each(routeCases)('$name 在读取 hostile Request 前同步返回', async ({ handler }) => {
    const hostile = hostileRequest();

    await expectCapabilityDisabled(handler, hostile.request);

    expect(hostile.trapCount()).toBe(0);
  });

  it('route 仅保留响应工具，且不装配访问、配置、密钥、client、provider 或网络链路', () => {
    const importSources = [...routeSource.matchAll(/from ['"]([^'"]+)['"]/gu)].map(
      (match) => match[1],
    );

    expect(importSources).toEqual(['next/server']);
    expect(routeSource).toContain('export function GET(_request: Request)');
    expect(routeSource).toContain('export function POST(_request: Request)');
    expect(routeSource).not.toContain('export async function');
    expect(routeSource).not.toMatch(/\b_request\s*(?:\.|\[)/u);

    for (const forbidden of [
      'getDemoAccessContextFromRequest',
      'canAccessResource',
      'readWeComOfficialSecretPrecheckConfig',
      'createWeComOfficialTokenPreflightClient',
      'evaluateWeComOfficialSecretPrecheck',
      'summarizeWeComOfficialSecretPrecheckConfig',
      'process.env',
      'request.json',
      'request.text',
      'searchParams',
      'new URL',
      'session',
      'config',
      'secret',
      'client',
      'provider',
      'fetch',
      'params',
    ]) {
      expect(routeSource).not.toContain(forbidden);
    }
  });
});
