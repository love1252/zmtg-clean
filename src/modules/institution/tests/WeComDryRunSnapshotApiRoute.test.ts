import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const downstreams = vi.hoisted(() => ({
  createRepository: vi.fn(),
  evaluateAndPersist: vi.fn(),
  getContext: vi.fn(),
  getDatabase: vi.fn(),
  runTransaction: vi.fn(),
}));

vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: downstreams.getContext,
}));
vi.mock('@/server/db/client', () => ({ getDatabase: downstreams.getDatabase }));
vi.mock('@/modules/institution/server/trusted-reachout-safety-repository', () => ({
  createTrustedReachOutSafetyRepository: downstreams.createRepository,
}));
vi.mock('@/modules/institution/server/trusted-reachout-safety-transaction', () => ({
  runTrustedReachOutSafetyTransaction: downstreams.runTransaction,
}));
vi.mock('@/modules/institution/server/wecom-dry-run-snapshot-service', () => ({
  evaluateAndPersistWeComDryRunSnapshot: downstreams.evaluateAndPersist,
  trustedReadyWeComOfficialRoute: 'official_wecom_self_built',
  weComDryRunSnapshotConfirmation: 'test-confirmation',
}));

import {
  GET,
  POST,
} from '@/app/api/institution/wecom-official-dry-run-snapshot/route';

const routePath = 'src/app/api/institution/wecom-official-dry-run-snapshot/route.ts';
const routeSource = readFileSync(resolve(process.cwd(), routePath), 'utf8');
const endpoint = 'http://localhost/api/institution/wecom-official-dry-run-snapshot';
const capabilityDisabledPayload = {
  code: 'capability_disabled',
  error: '企业微信 dry-run 快照能力当前未启用',
} as const;
const forbiddenResponseKeys = [
  'audit',
  'boundary',
  'callbackPlaceholderRef',
  'configStatus',
  'evaluatedAt',
  'institutionId',
  'preflightStatus',
  'proofEligibleMock',
  'proofInstitutionRef',
  'result',
  'snapshot',
  'tenantId',
  'usable',
  'version',
] as const;

function request(method: 'GET' | 'POST', body?: string, headers: HeadersInit = {}) {
  return new Request(endpoint, {
    method,
    headers,
    body: method === 'POST' ? body : undefined,
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
    has() {
      trapCount += 1;
      throw new Error('request must not be inspected');
    },
    ownKeys() {
      trapCount += 1;
      throw new Error('request must not be enumerated');
    },
  }) as Request;
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

describe('企业微信 dry-run 快照 API capability-off', () => {
  it.each([
    ['GET 普通请求', () => GET(request('GET', undefined, {
      cookie: 'demo_session=forged',
      'x-tenant-id': 'forged-tenant',
      'x-institution-id': 'forged-institution',
    }))],
    ['GET 未认证请求', () => GET(request('GET'))],
    ['POST 普通请求', () => POST(request('POST', JSON.stringify({
      proofInstitutionRef: 'input-must-not-echo',
      usable: true,
    }), { 'content-type': 'application/json' }))],
    ['POST 伪 scope 请求', () => POST(request('POST', JSON.stringify({
      tenantId: 'forged-tenant',
      institutionId: 'forged-institution',
    }), {
      cookie: 'demo_session=forged',
      'content-type': 'application/json',
      'x-tenant-id': 'forged-tenant',
    }))],
    ['POST 畸形请求', () => POST(request('POST', '{not-json', {
      'content-type': 'application/json',
    }))],
    ['POST 超大请求', () => POST(request('POST', 'x'.repeat(8_192), {
      'content-length': '8192',
      'content-type': 'application/json',
    }))],
  ])('%s 固定返回低敏 503，且不触发任何下游', async (_name, invoke) => {
    await expectCapabilityDisabled(await invoke(), 'input-must-not-echo');
    expectDownstreamsIdle();
  });

  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)('%s 对 hostile Request Proxy 零读取、零副作用', async (_method, handler) => {
    const hostile = hostileRequest();

    await expectCapabilityDisabled(await handler(hostile.value));

    expect(hostile.trapCount()).toBe(0);
    expectDownstreamsIdle();
  });

  it('POST 不读取 body、不出网，也不回显 URL、header 或请求内容', async () => {
    const secret = 'opaque-input-must-not-echo';
    const body = JSON.stringify({
      proofInstitutionRef: secret,
      callbackPlaceholderRef: secret,
      configStatus: 'dry_run_ready',
    });
    const input = request('POST', body, {
      cookie: `demo_session=${secret}`,
      'content-type': 'application/json',
      'x-institution-id': secret,
    });
    const text = vi.spyOn(input, 'text');
    const json = vi.spyOn(input, 'json');
    const arrayBuffer = vi.spyOn(input, 'arrayBuffer');
    const formData = vi.spyOn(input, 'formData');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expectCapabilityDisabled(await POST(input), secret);
      expect(text).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
      expect(arrayBuffer).not.toHaveBeenCalled();
      expect(formData).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expectDownstreamsIdle();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('源码只保留 NextResponse，禁止 session、DB、repository、transaction 与 evaluator 装配', () => {
    const importLines = routeSource.split('\n').filter((line) => line.startsWith('import '));
    expect(importLines).toEqual(["import { NextResponse } from 'next/server';"]);
    for (const forbiddenSource of [
      'access-context',
      'audit',
      'callbackPlaceholderRef',
      'configStatus',
      'evaluateAndPersist',
      'fetch(',
      'getDatabase',
      'preflightStatus',
      'process.env',
      'proofEligibleMock',
      'proofInstitutionRef',
      'repository',
      'request.',
      'request[',
      'session',
      'snapshot',
      'transaction',
      'usable',
      'version',
    ]) {
      expect(routeSource).not.toContain(forbiddenSource);
    }
  });
});
