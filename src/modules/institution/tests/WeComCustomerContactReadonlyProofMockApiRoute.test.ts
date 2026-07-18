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

const capabilityOffBody = {
  code: 'institution_wecom_customer_contact_proof_mock_capability_off',
  error: '企业微信客户联系只读 proof mock 能力当前未开放。',
};

const fetchMock = vi.fn();

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

async function expectCapabilityOff(
  handler: (request?: Request) => Promise<Response>,
  request: Request,
) {
  const response = await handler(request);
  const body = await readBody(response);

  expect(response.status).toBe(410);
  expect(body).toEqual(capabilityOffBody);
  expect(Object.keys(body).sort()).toEqual(['code', 'error']);
  expect(JSON.stringify(body)).not.toMatch(
    /precheck|mode|tag|employee|secret|token|external.?id|provider|payload/i,
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

describe('企业微信客户联系只读 proof mock API route', () => {
  it.each([
    ['GET', GET, new Request('http://localhost/api/institution/wecom-customer-contact-readonly-proof-mock?tenantId=tenant-a&proofContactId=proof-a', {
      headers: { cookie: 'demo_session=tenant-admin; token=not-read' },
    })],
    ['POST', POST, new Request('http://localhost/api/institution/wecom-customer-contact-readonly-proof-mock?mode=detail', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'demo_session=tenant-admin' },
      body: '{',
    })],
  ] as const)('%s 对普通或非法请求均固定 capability-off 且不读取遗留依赖', async (_method, handler, request) => {
    await expectCapabilityOff(handler, request);
  });

  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)('%s 不解引用 hostile Request Proxy', async (_method, handler) => {
    let trapCount = 0;
    const hostileRequest = new Proxy({} as Request, {
      get() {
        trapCount += 1;
        throw new Error('request must not be read');
      },
      getOwnPropertyDescriptor() {
        trapCount += 1;
        throw new Error('request descriptors must not be read');
      },
      ownKeys() {
        trapCount += 1;
        throw new Error('request keys must not be read');
      },
    });

    await expectCapabilityOff(handler, hostileRequest);
    expect(trapCount).toBe(0);
  });
});
