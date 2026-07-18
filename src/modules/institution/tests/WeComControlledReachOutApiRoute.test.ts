import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const downstreams = vi.hoisted(() => ({
  createAuditEventRepository: vi.fn(),
  createTenantBusinessRepository: vi.fn(),
  createTrustedReachOutSafetyRepository: vi.fn(),
  createWeComCustomerMappingRepository: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  getWeComControlledReachOut: vi.fn(),
  prepareWeComControlledReachOut: vi.fn(),
  runWeComControlledReachOutTransaction: vi.fn(),
}));

vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: downstreams.createAuditEventRepository,
}));
vi.mock('@/modules/institution/server/tenant-business-repository', () => ({
  createTenantBusinessRepository: downstreams.createTenantBusinessRepository,
}));
vi.mock('@/modules/institution/server/trusted-reachout-safety-repository', () => ({
  createTrustedReachOutSafetyRepository: downstreams.createTrustedReachOutSafetyRepository,
}));
vi.mock('@/modules/institution/server/wecom-customer-mapping-repository', () => ({
  createWeComCustomerMappingRepository: downstreams.createWeComCustomerMappingRepository,
}));
vi.mock('@/modules/institution/server/wecom-controlled-reachout-service', () => ({
  getWeComControlledReachOut: downstreams.getWeComControlledReachOut,
  prepareWeComControlledReachOut: downstreams.prepareWeComControlledReachOut,
  WeComControlledReachOutTransactionAbort: class extends Error {},
}));
vi.mock('@/modules/institution/server/wecom-controlled-reachout-transaction', () => ({
  runWeComControlledReachOutTransaction: downstreams.runWeComControlledReachOutTransaction,
}));
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: downstreams.getDemoAccessContextFromRequest,
}));
vi.mock('@/server/db/client', () => ({ getDatabase: downstreams.getDatabase }));

import {
  GET,
  POST,
} from '@/app/api/institution/followup-message-drafts/[draftId]/wecom-controlled-reachout/route';

const routePath =
  'src/app/api/institution/followup-message-drafts/[draftId]/wecom-controlled-reachout/route.ts';
const routeSource = readFileSync(resolve(process.cwd(), routePath), 'utf8');
const endpoint =
  'http://localhost/api/institution/followup-message-drafts/draft-input-secret/wecom-controlled-reachout';
const capabilityDisabledPayload = {
  code: 'capability_disabled',
  error: '企业微信受控触达能力当前未启用',
} as const;
const forbiddenResponseKeys = [
  'audit',
  'confirmation',
  'customerId',
  'draftId',
  'idempotent',
  'manualReviewRequired',
  'mockDemo',
  'preflight',
  'proofContactId',
  'ready_no_send',
  'result',
  'status',
] as const;

function context(draftId = 'draft-input-secret') {
  return { params: Promise.resolve({ draftId }) };
}

function hostileInput<T>(label: string) {
  let trapCount = 0;
  const value = new Proxy(Object.create(null), {
    get() {
      trapCount += 1;
      throw new Error(`${label} must not be read`);
    },
    getOwnPropertyDescriptor() {
      trapCount += 1;
      throw new Error(`${label} must not be inspected`);
    },
    has() {
      trapCount += 1;
      throw new Error(`${label} must not be inspected`);
    },
    ownKeys() {
      trapCount += 1;
      throw new Error(`${label} must not be enumerated`);
    },
  }) as T;
  return { value, trapCount: () => trapCount };
}

async function expectCapabilityDisabled(response: Response, secret = '') {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const payload = await response.json();
  expect(payload).toEqual(capabilityDisabledPayload);
  for (const key of forbiddenResponseKeys) expect(payload).not.toHaveProperty(key);
  if (secret) expect(JSON.stringify(payload)).not.toContain(secret);
}

function expectDownstreamsIdle() {
  for (const dependency of Object.values(downstreams)) {
    expect(dependency).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WeCom controlled reach-out API capability-off route', () => {
  it.each([
    ['GET 普通输入', () => GET(new Request(endpoint, {
      headers: { cookie: 'demo_session=forged', 'x-institution-id': 'forged-institution' },
    }), context())],
    ['GET 非法参数', () => GET(new Request(`${endpoint}?draftId=forged`), context(''))],
    ['POST 普通输入', () => POST(new Request(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'demo_session=forged' },
      body: JSON.stringify({ action: 'prepare_no_send', secret: 'body-input-secret' }),
    }), context())],
    ['POST 畸形输入', () => POST(new Request(endpoint, {
      method: 'POST', body: '{not-json', headers: { 'content-type': 'application/json' },
    }), context(''))],
    ['POST 超大输入', () => POST(new Request(endpoint, {
      method: 'POST', body: 'x'.repeat(8_192), headers: { 'content-length': '8192' },
    }), context('cross-scope-draft'))],
  ])('%s 固定返回低敏 503，且不触发下游', async (_name, invoke) => {
    await expectCapabilityDisabled(await invoke(), 'body-input-secret');
    expectDownstreamsIdle();
  });

  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)('%s 对 hostile Request 与 params 零读取、零副作用', async (_method, handler) => {
    const request = hostileInput<Request>('request');
    const routeContext = hostileInput<ReturnType<typeof context>>('params');

    await expectCapabilityDisabled(await handler(request.value, routeContext.value));

    expect(request.trapCount()).toBe(0);
    expect(routeContext.trapCount()).toBe(0);
    expectDownstreamsIdle();
  });

  it('不读取 body、不出网，也不回显 URL、参数或请求内容', async () => {
    const secret = 'must-not-echo-opaque-input';
    const request = new Request(`${endpoint}?input=${secret}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: secret, confirmation: secret }),
    });
    const text = vi.spyOn(request, 'text');
    const json = vi.spyOn(request, 'json');
    const arrayBuffer = vi.spyOn(request, 'arrayBuffer');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expectCapabilityDisabled(await POST(request, context(secret)), secret);
      expect(text).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
      expect(arrayBuffer).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expectDownstreamsIdle();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('源码仅装配 NextResponse，不创建确认、审计、manual review 或 ready_no_send 事实', () => {
    const importLines = routeSource.split('\n').filter((line) => line.startsWith('import '));
    expect(importLines).toEqual(["import { NextResponse } from 'next/server';"]);
    for (const forbiddenSource of [
      'access-context',
      'audit-event',
      'confirmation',
      'fetch(',
      'getDatabase',
      'manualReview',
      'provider',
      'ready_no_send',
      'repository',
      'request.',
      'request[',
      'session',
      'transaction',
      'wecom-controlled-reachout-service',
    ]) {
      expect(routeSource).not.toContain(forbiddenSource);
    }
  });
});
