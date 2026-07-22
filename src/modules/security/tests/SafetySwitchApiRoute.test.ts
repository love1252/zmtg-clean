import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from '@/app/api/institution/safety-switch/route';

const routeMocks = vi.hoisted(() => ({
  auditDomainInitialized: vi.fn(),
  auditRepositoryInitialized: vi.fn(),
  safetySwitchDomainInitialized: vi.fn(),
  accessControlInitialized: vi.fn(),
  accessContextInitialized: vi.fn(),
  databaseInitialized: vi.fn(),
  createAuditEvent: vi.fn(() => ({})),
  createDeniedAccessAuditEvent: vi.fn(() => ({})),
  auditRecord: vi.fn(),
  createAuditEventRepository: vi.fn(() => ({ record: routeMocks.auditRecord })),
  deriveSafetySwitchViewModel: vi.fn(() => ({
    status: 'mock_only',
    realChannelBlocked: true,
  })),
  hasRealChannelEnableAttempt: vi.fn(() => false),
  canAccessResource: vi.fn(() => ({ allowed: true })),
  getDemoAccessContextFromRequest: vi.fn(() => ({
    userId: 'tenant-admin',
    role: 'tenant_admin',
    scope: 'tenant',
    tenantId: 'tenant-a',
    institutionId: 'institution-a',
    source: 'demo_session',
  })),
  getDatabase: vi.fn(() => ({})),
}));

vi.mock('@/modules/audit/domain/audit-events', () => {
  routeMocks.auditDomainInitialized();
  return {
    createAuditEvent: routeMocks.createAuditEvent,
    createDeniedAccessAuditEvent: routeMocks.createDeniedAccessAuditEvent,
  };
});

vi.mock('@/modules/audit/server/audit-event-repository', () => {
  routeMocks.auditRepositoryInitialized();
  return { createAuditEventRepository: routeMocks.createAuditEventRepository };
});

vi.mock('@/modules/security/domain/safety-switch', () => {
  routeMocks.safetySwitchDomainInitialized();
  return {
    deriveSafetySwitchViewModel: routeMocks.deriveSafetySwitchViewModel,
    hasRealChannelEnableAttempt: routeMocks.hasRealChannelEnableAttempt,
  };
});

vi.mock('@/modules/security/domain/access-control', () => {
  routeMocks.accessControlInitialized();
  return { canAccessResource: routeMocks.canAccessResource };
});

vi.mock('@/modules/security/server/access-context', () => {
  routeMocks.accessContextInitialized();
  return { getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest };
});

vi.mock('@/server/db/client', () => {
  routeMocks.databaseInitialized();
  return { getDatabase: routeMocks.getDatabase };
});

const capabilityDisabledBody = {
  code: 'capability_disabled',
  error: '安全开关能力当前未启用。',
};

const initializationMocks = [
  routeMocks.auditDomainInitialized,
  routeMocks.auditRepositoryInitialized,
  routeMocks.safetySwitchDomainInitialized,
  routeMocks.accessControlInitialized,
  routeMocks.accessContextInitialized,
  routeMocks.databaseInitialized,
];

const downstreamMocks = [
  routeMocks.createAuditEvent,
  routeMocks.createDeniedAccessAuditEvent,
  routeMocks.auditRecord,
  routeMocks.createAuditEventRepository,
  routeMocks.deriveSafetySwitchViewModel,
  routeMocks.hasRealChannelEnableAttempt,
  routeMocks.canAccessResource,
  routeMocks.getDemoAccessContextFromRequest,
  routeMocks.getDatabase,
];

type RouteHandler = (request: Request) => Response | Promise<Response>;

function ordinaryRequest(method: 'GET' | 'PATCH') {
  return new Request(
    'http://localhost/api/institution/safety-switch?tenantId=tenant_should_not_echo&current=blocked_should_not_echo',
    {
      method,
      headers: {
        cookie: 'demo_session=should-not-read; token=secret_should_not_echo',
        'content-type': 'application/json',
      },
      body: method === 'PATCH'
        ? '{"allowRealSend":true,"boundaryLabels":["caller_should_not_echo"]}'
        : undefined,
    },
  );
}

function hostileRequest() {
  let trapCount = 0;
  const value = new Proxy({} as Request, {
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
  return { value, trapCount: () => trapCount };
}

function expectNoLegacyInitializationOrCalls() {
  for (const mock of initializationMocks) expect(mock).not.toHaveBeenCalled();
  for (const mock of downstreamMocks) expect(mock).not.toHaveBeenCalled();
}

async function expectCapabilityDisabled(handler: RouteHandler, request: Request) {
  const response = await handler(request);
  const body = await response.json();

  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(body).toEqual(capabilityDisabledBody);
  expect(Object.keys(body as object).sort()).toEqual(['code', 'error']);
  expect(JSON.stringify(body)).not.toMatch(
    /tenant|institution|scope|boolean|status|block.?reasons|boundary.?labels|current|updated|blocked|mock.?only|caller_should_not_echo|secret|token/i,
  );
  expectNoLegacyInitializationOrCalls();
}

beforeEach(() => {
  for (const mock of downstreamMocks) mock.mockClear();
});

describe('safety-switch capability-off API route', () => {
  it.each([
    ['GET', GET],
    ['PATCH', PATCH],
  ] as const)('%s 对普通、query/cookie/body 输入固定返回低敏 503', async (method, handler) => {
    await expectCapabilityDisabled(handler, ordinaryRequest(method));
  });

  it('PATCH 不读取非法 JSON 或 body', async () => {
    const request = new Request(
      'http://localhost/api/institution/safety-switch?malformed=%ZZ',
      { method: 'PATCH', body: '{"allowRealSend":true' },
    );
    const json = vi.spyOn(request, 'json');

    await expectCapabilityDisabled(PATCH, request);
    expect(json).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
  });

  it.each([
    ['GET', GET],
    ['PATCH', PATCH],
  ] as const)('%s 不解引用 hostile Request Proxy', async (_method, handler) => {
    const hostile = hostileRequest();

    await expectCapabilityDisabled(handler, hostile.value);
    expect(hostile.trapCount()).toBe(0);
  });

  it('route 仅导入 NextResponse，且不含 session、RBAC、DB、审计或 safety-switch domain', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/app/api/institution/safety-switch/route.ts'),
      'utf8',
    );
    const imports = source.match(/^import .*$/gmu) ?? [];

    expect(imports).toEqual(["import { NextResponse } from 'next/server';"]);
    expect(source).not.toMatch(
      /getDemoAccessContextFromRequest|canAccessResource|getDatabase|createAuditEvent|deriveSafetySwitchViewModel|hasRealChannelEnableAttempt|request\.|query|cookie|body|session|tenant|institution|scope|blockReasons|boundaryLabels|current|updated|process\.env|fetch\(|Date\.|crypto|random/i,
    );
  });
});
