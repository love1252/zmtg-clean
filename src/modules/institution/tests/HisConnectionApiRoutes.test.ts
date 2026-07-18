import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DELETE as hisConnectionSoftDeleteDelete,
  GET as hisConnectionDetailGet,
  PATCH as hisConnectionUpdatePatch,
} from '@/app/api/institution/his-connections/[connectionId]/route';
import { POST as hisConnectionPausePost } from '@/app/api/institution/his-connections/[connectionId]/pause/route';
import { POST as hisConnectionResumePost } from '@/app/api/institution/his-connections/[connectionId]/resume/route';
import { POST as hisConnectionRevokePost } from '@/app/api/institution/his-connections/[connectionId]/revoke/route';
import {
  GET as hisConnectionListGet,
  POST as hisConnectionCreatePost,
} from '@/app/api/institution/his-connections/route';

const routeMocks = vi.hoisted(() => ({
  canAccessResource: vi.fn(),
  createAuditEventRepository: vi.fn(),
  createDeniedAccessAuditEvent: vi.fn(),
  createHisConnectionForTenantService: vi.fn(),
  createHisConnectionRepository: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  parseCreateHisConnectionInput: vi.fn(),
  parseUpdateHisConnectionInput: vi.fn(),
  pauseHisConnectionForTenantService: vi.fn(),
  resumeHisConnectionForTenantService: vi.fn(),
  revokeHisConnectionForTenantService: vi.fn(),
  softDeleteHisConnectionForTenantService: vi.fn(),
  updateHisConnectionForTenantService: vi.fn(),
}));

vi.mock('@/modules/audit/domain/audit-events', () => ({
  createDeniedAccessAuditEvent: routeMocks.createDeniedAccessAuditEvent,
}));
vi.mock('@/modules/audit/server/audit-event-repository', () => ({
  createAuditEventRepository: routeMocks.createAuditEventRepository,
}));
vi.mock('@/modules/institution/server/his-connection-repository', () => ({
  createHisConnectionRepository: routeMocks.createHisConnectionRepository,
}));
vi.mock('@/modules/institution/server/his-connection-write-input', () => ({
  parseCreateHisConnectionInput: routeMocks.parseCreateHisConnectionInput,
  parseUpdateHisConnectionInput: routeMocks.parseUpdateHisConnectionInput,
}));
vi.mock('@/modules/institution/server/his-connection-write-service', () => ({
  createHisConnectionForTenantService: routeMocks.createHisConnectionForTenantService,
  updateHisConnectionForTenantService: routeMocks.updateHisConnectionForTenantService,
}));
vi.mock('@/modules/institution/server/his-connection-status-service', () => ({
  pauseHisConnectionForTenantService: routeMocks.pauseHisConnectionForTenantService,
  resumeHisConnectionForTenantService: routeMocks.resumeHisConnectionForTenantService,
  revokeHisConnectionForTenantService: routeMocks.revokeHisConnectionForTenantService,
  softDeleteHisConnectionForTenantService: routeMocks.softDeleteHisConnectionForTenantService,
}));
vi.mock('@/modules/security/domain/access-control', () => ({
  canAccessResource: routeMocks.canAccessResource,
}));
vi.mock('@/modules/security/server/access-context', () => ({
  getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
}));
vi.mock('@/server/db/client', () => ({ getDatabase: routeMocks.getDatabase }));

const capabilityDisabledBody = {
  code: 'institution_his_connections_capability_disabled',
  error: 'HIS 连接管理能力暂未启用。',
};

const routePaths = [
  'src/app/api/institution/his-connections/route.ts',
  'src/app/api/institution/his-connections/[connectionId]/route.ts',
  'src/app/api/institution/his-connections/[connectionId]/pause/route.ts',
  'src/app/api/institution/his-connections/[connectionId]/resume/route.ts',
  'src/app/api/institution/his-connections/[connectionId]/revoke/route.ts',
] as const;

type RouteHandler = (...args: readonly unknown[]) => Promise<Response>;

const allHandlers = [
  ['list', hisConnectionListGet],
  ['create', hisConnectionCreatePost],
  ['detail', hisConnectionDetailGet],
  ['update', hisConnectionUpdatePatch],
  ['soft-delete', hisConnectionSoftDeleteDelete],
  ['pause', hisConnectionPausePost],
  ['resume', hisConnectionResumePost],
  ['revoke', hisConnectionRevokePost],
] as const satisfies readonly [string, RouteHandler][];

const fetchMock = vi.fn();

function ordinaryRequest(method: string) {
  return new Request(
    'http://localhost/api/institution/his-connections/his_conn_should_not_echo?tenantId=other-tenant&credentialRef=should-not-read',
    {
      method,
      headers: {
        cookie: 'demo_session=should-not-read; token=should-not-read',
        'content-type': 'application/json',
      },
      body: method === 'GET' ? undefined : '{"connectionId":"his_conn_should_not_echo","secret":"should-not-read"}',
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

async function expectCapabilityDisabled(handler: RouteHandler, args: readonly unknown[]) {
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

describe('HIS 连接管理 capability-off API routes', () => {
  it.each(allHandlers)('%s 对普通和非法输入均固定 503，且不读取 body 或 params', async (_name, handler) => {
    await expectCapabilityDisabled(handler, [ordinaryRequest('POST'), { params: Promise.resolve({ connectionId: 'his_conn_should_not_echo' }) }]);
    await expectCapabilityDisabled(handler, [ordinaryRequest('GET'), { params: Promise.resolve({ connectionId: '' }) }]);
  });

  it.each(allHandlers)('%s 不解引用 hostile Request 或 params', async (_name, handler) => {
    const request = hostileRequest();
    const context = hostileContext();

    await expectCapabilityDisabled(handler, [request.value, context.value]);
    expect(request.traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
    expect(context.traps).toEqual({ get: 0, ownKeys: 0, descriptor: 0 });
  });

  it('所有授权路由只导入 NextResponse，且不含 session、持久化、审计或外部 HIS 路径', () => {
    for (const routePath of routePaths) {
      const source = readFileSync(join(process.cwd(), routePath), 'utf8');
      const imports = source.match(/^import .*$/gmu) ?? [];

      expect(imports).toEqual(["import { NextResponse } from 'next/server';"]);
      expect(source).not.toMatch(
        /getDemoAccessContextFromRequest|getDatabase|createHisConnection|parse(?:Create|Update)HisConnection|canAccessResource|createAuditEvent|request\.|params|credential|fetch\(|process\.env|provider|audit/i,
      );
    }
  });
});
