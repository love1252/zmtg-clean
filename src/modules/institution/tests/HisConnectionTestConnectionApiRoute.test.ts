import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as hisConnectionTestConnectionPost } from '@/app/api/institution/his-connections/[connectionId]/test-connection/route';

const routeMocks = vi.hoisted(() => ({
  canAccessResource: vi.fn(),
  createAuditEventRepository: vi.fn(),
  createDeniedAccessAuditEvent: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  testHisConnectionForTenantService: vi.fn(),
}));

vi.mock('@/modules/audit/domain/audit-events', () => ({
  createDeniedAccessAuditEvent: routeMocks.createDeniedAccessAuditEvent,
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));
vi.mock('@/modules/institution/server/his-connection-test-connection-service', () => ({
  testHisConnectionForTenantService: routeMocks.testHisConnectionForTenantService,
}));
vi.mock('@/modules/security/domain/access-control', () => ({
  canAccessResource: routeMocks.canAccessResource,
}));
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/server/db/client', () => ({ getDatabase: routeMocks.getDatabase }));

const capabilityDisabledBody = {
  code: 'capability_disabled',
  error: 'HIS 连接测试能力暂未启用。',
};

const fetchMock = vi.fn();
type RouteHandler = (...args: readonly unknown[]) => Promise<Response>;
const handler = hisConnectionTestConnectionPost as RouteHandler;

function request(body?: string) {
  return new Request(
    'http://localhost/api/institution/his-connections/his_conn_should_not_echo/test-connection?tenantId=other-tenant&credentialRef=should-not-read',
    {
      method: 'POST',
      headers: {
        cookie: 'demo_session=should-not-read; token=should-not-read',
        'content-type': 'application/json',
      },
      body,
    },
  );
}

function hostileRequest() {
  const traps = { get: 0, ownKeys: 0, descriptor: 0 };
  const value = new Proxy({} as Request, {
    get() {
      traps.get += 1;
      throw new Error('request must not be read');
    },
    getOwnPropertyDescriptor() {
      traps.descriptor += 1;
      throw new Error('request descriptors must not be read');
    },
    ownKeys() {
      traps.ownKeys += 1;
      throw new Error('request keys must not be read');
    },
  });
  return { traps, value };
}

function hostileContext() {
  const traps = { get: 0, ownKeys: 0, descriptor: 0 };
  const value = new Proxy({}, {
    get() {
      traps.get += 1;
      throw new Error('params must not be read');
    },
    getOwnPropertyDescriptor() {
      traps.descriptor += 1;
      throw new Error('params descriptors must not be read');
    },
    ownKeys() {
      traps.ownKeys += 1;
      throw new Error('params keys must not be read');
    },
  });
  return { traps, value };
}

function expectNoDownstreamCalls() {
  for (const mock of Object.values(routeMocks)) expect(mock).not.toHaveBeenCalled();
  expect(fetchMock).not.toHaveBeenCalled();
}

async function expectCapabilityDisabled(args: readonly unknown[]) {
  const response = await handler(...args);
  const body = await response.json();

  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(body).toEqual(capabilityDisabledBody);
  expect(Object.keys(body as object).sort()).toEqual(['code', 'error']);
  expect(JSON.stringify(body)).not.toMatch(
    /his_conn_should_not_echo|other-tenant|credentialRef|secret|token|provider|payload/i,
  );
  expectNoDownstreamCalls();
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

describe('HIS test-connection capability-off API route', () => {
  it('普通请求固定返回低敏 503，且不读取 Request、params 或下游', async () => {
    await expectCapabilityDisabled([
      request(),
      { params: Promise.resolve({ connectionId: 'his_conn_should_not_echo' }) },
    ]);
  });

  it('非法 JSON、敏感 body 与空 params 仍返回同一响应且不回显输入', async () => {
    await expectCapabilityDisabled([
      request('{"connectionId":"his_conn_should_not_echo","secret":"should-not-read"'),
      { params: Promise.resolve({ connectionId: '' }) },
    ]);
  });

  it('不解引用 hostile Request 或 params', async () => {
    const hostileInput = hostileRequest();
    const hostileParams = hostileContext();

    await expectCapabilityDisabled([hostileInput.value, hostileParams.value]);
    expect(hostileInput.traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
    expect(hostileParams.traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
  });

  it('route 仅导入 NextResponse，且不含 session、持久化、凭证、审计或外部连接路径', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/app/api/institution/his-connections/[connectionId]/test-connection/route.ts',
      ),
      'utf8',
    );
    const imports = source.match(/^import .*$/gmu) ?? [];

    expect(imports).toEqual(["import { NextResponse } from 'next/server';"]);
    expect(source).not.toMatch(
      /getDemoAccessContextFromRequest|getDatabase|testHisConnectionForTenantService|canAccessResource|createAuditEvent|request\.|params|body|cookie|session|credential|fetch\(|process\.env|provider|audit/i,
    );
  });
});
