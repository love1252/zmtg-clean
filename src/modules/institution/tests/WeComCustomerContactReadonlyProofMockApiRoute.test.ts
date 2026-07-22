import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/institution/wecom-customer-contact-readonly-proof-mock/route';

const routeMocks = vi.hoisted(() => ({
  canAccessResource: vi.fn(),
  createWeComCustomerContactReadonlyProofMockDetail: vi.fn(),
  createWeComCustomerContactReadonlyProofMockList: vi.fn(),
  evaluateWeComCustomerContactPrecheck: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  readWeComCustomerContactPrecheckConfig: vi.fn(),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));

vi.mock('@/modules/security/domain/access-control', () => ({
  canAccessResource: routeMocks.canAccessResource,
}));

vi.mock('@/modules/institution/server/wecom-customer-contact-precheck-runtime', () => ({
  readWeComCustomerContactPrecheckConfig: routeMocks.readWeComCustomerContactPrecheckConfig,
}));

vi.mock('@/modules/institution/domain/wecom-customer-contact-precheck', () => ({
  evaluateWeComCustomerContactPrecheck: routeMocks.evaluateWeComCustomerContactPrecheck,
}));

vi.mock('@/modules/institution/domain/wecom-customer-contact-readonly-proof-mock', () => ({
  createWeComCustomerContactReadonlyProofMockDetail:
    routeMocks.createWeComCustomerContactReadonlyProofMockDetail,
  createWeComCustomerContactReadonlyProofMockList:
    routeMocks.createWeComCustomerContactReadonlyProofMockList,
}));

const capabilityDisabledPayload = {
  code: 'capability_disabled',
  error: '企业微信客户联系只读凭据能力当前未启用',
};

const fetchMock = vi.fn();

type Handler = (request: Request) => Response | Promise<Response>;

function request(method: 'GET' | 'POST', body?: unknown, query = '') {
  return new Request(`http://localhost/api/institution/wecom-customer-contact-readonly-proof-mock${query}`, {
    method,
    headers: {
      cookie: 'demo_session=tenant-admin; token=must-not-read',
      'x-institution-id': 'institution-forged',
      'x-role': 'platform_admin',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readBody(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function expectNoLegacyCalls() {
  expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
  expect(routeMocks.canAccessResource).not.toHaveBeenCalled();
  expect(routeMocks.readWeComCustomerContactPrecheckConfig).not.toHaveBeenCalled();
  expect(routeMocks.evaluateWeComCustomerContactPrecheck).not.toHaveBeenCalled();
  expect(routeMocks.createWeComCustomerContactReadonlyProofMockList).not.toHaveBeenCalled();
  expect(routeMocks.createWeComCustomerContactReadonlyProofMockDetail).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
}

async function expectCapabilityDisabled(handler: Handler, input: Request) {
  const response = await handler(input);
  const body = await readBody(response);

  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(body).toStrictEqual(capabilityDisabledPayload);
  expect(Object.keys(body).sort()).toStrictEqual(['code', 'error']);
  expect(JSON.stringify(body)).not.toMatch(
    /proof|mock|precheck|tenant|institution|customer|contact|scope|status|external|provider|payload|token/i,
  );
  expectNoLegacyCalls();
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

describe('企业微信客户联系只读凭据 capability-off API route', () => {
  it.each([
    ['GET 普通请求', GET, () => request('GET', undefined, '?proofContactId=proof-forged')],
    ['GET 未认证请求', GET, () => new Request(
      'http://localhost/api/institution/wecom-customer-contact-readonly-proof-mock',
    )],
    ['POST 伪造机构和角色', POST, () => request('POST', {
      tenantId: 'tenant-forged',
      institutionId: 'institution-forged',
      operatorRole: 'platform_admin',
      proofContactId: 'proof-forged',
    })],
    ['POST 非法 JSON', POST, () => new Request(
      'http://localhost/api/institution/wecom-customer-contact-readonly-proof-mock',
      { method: 'POST', body: '{invalid-json' },
    )],
    ['POST 超大 body', POST, () => request('POST', { padding: 'x'.repeat(2_000_000) })],
    ['POST 敏感和 mock-ready 输入', POST, () => request('POST', {
      proofContactId: 'proof-forged',
      mockReady: true,
      externalAccountId: 'external-account-forged',
      token: 'token-must-not-echo',
    })],
  ] as const)('%s 固定 capability-disabled 且不读取输入或遗留依赖', async (_name, handler, createRequest) => {
    await expectCapabilityDisabled(handler, createRequest());
  });

  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)('%s 不解引用 hostile Request Proxy', async (_method, handler) => {
    let trapCount = 0;
    const fail = () => {
      trapCount += 1;
      throw new Error('request must not be read');
    };
    const hostileRequest = new Proxy({} as Request, {
      get: fail,
      getOwnPropertyDescriptor: fail,
      getPrototypeOf: fail,
      has: fail,
      ownKeys: fail,
    });

    await expectCapabilityDisabled(handler, hostileRequest);
    expect(trapCount).toBe(0);
  });

  it('route 源码仅装配 NextResponse 且不读取输入或下游依赖', () => {
    const source = readFileSync(
      'src/app/api/institution/wecom-customer-contact-readonly-proof-mock/route.ts',
      'utf8',
    );
    const imports = source.match(/^import .+;$/gm) ?? [];

    expect(imports).toStrictEqual(["import { NextResponse } from 'next/server';"]);
    expect(source).toContain('export function GET(_request: Request)');
    expect(source).toContain('export function POST(_request: Request)');
    expect(source.match(/_request/g)).toHaveLength(2);
    for (const forbidden of [
      '@/modules/',
      '@/server/',
      'process.env',
      'fetch(',
      'async function',
      '_request.',
      'proof',
      'mock',
      'precheck',
      'getDemoAccessContextFromRequest',
      'canAccessResource',
      'readWeComCustomerContactPrecheckConfig',
      'evaluateWeComCustomerContactPrecheck',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
