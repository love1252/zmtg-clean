import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/institution/real-channel-preflight/route';

const routeMocks = vi.hoisted(() => ({
  auditDomainInitialized: vi.fn(),
  auditRepositoryInitialized: vi.fn(),
  preflightDomainInitialized: vi.fn(),
  accessControlInitialized: vi.fn(),
  safetySwitchInitialized: vi.fn(),
  accessContextInitialized: vi.fn(),
  databaseInitialized: vi.fn(),
  createAuditEvent: vi.fn(() => ({})),
  createDeniedAccessAuditEvent: vi.fn(() => ({})),
  auditRecord: vi.fn(),
  createAuditEventRepository: vi.fn(() => ({ record: routeMocks.auditRecord })),
  assertRealChannelPreflightLowSensitivePayload: vi.fn(() => true),
  createDefaultRealChannelPreflightInput: vi.fn(() => ({})),
  evaluateRealChannelPreflight: vi.fn(() => ({
    blocked: true,
    auditReason: 'real_channel_safety_switch_blocked',
  })),
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

vi.mock('@/modules/institution/domain/real-channel-preflight', () => {
  routeMocks.preflightDomainInitialized();
  return {
    assertRealChannelPreflightLowSensitivePayload:
      routeMocks.assertRealChannelPreflightLowSensitivePayload,
    createDefaultRealChannelPreflightInput:
      routeMocks.createDefaultRealChannelPreflightInput,
    evaluateRealChannelPreflight: routeMocks.evaluateRealChannelPreflight,
  };
});

vi.mock('@/modules/security/domain/access-control', () => {
  routeMocks.accessControlInitialized();
  return { canAccessResource: routeMocks.canAccessResource };
});

vi.mock('@/modules/security/domain/safety-switch', () => {
  routeMocks.safetySwitchInitialized();
  return { defaultSafetySwitchState: Object.freeze({ emergencyStopEnabled: true }) };
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
  error: '真实渠道前置检查能力当前未启用。',
};

const initializationMocks = [
  routeMocks.auditDomainInitialized,
  routeMocks.auditRepositoryInitialized,
  routeMocks.preflightDomainInitialized,
  routeMocks.accessControlInitialized,
  routeMocks.safetySwitchInitialized,
  routeMocks.accessContextInitialized,
  routeMocks.databaseInitialized,
];

const downstreamMocks = [
  routeMocks.createAuditEvent,
  routeMocks.createDeniedAccessAuditEvent,
  routeMocks.auditRecord,
  routeMocks.createAuditEventRepository,
  routeMocks.assertRealChannelPreflightLowSensitivePayload,
  routeMocks.createDefaultRealChannelPreflightInput,
  routeMocks.evaluateRealChannelPreflight,
  routeMocks.canAccessResource,
  routeMocks.getDemoAccessContextFromRequest,
  routeMocks.getDatabase,
];

type RouteHandler = (request: Request) => Response | Promise<Response>;

function ordinaryRequest(method: 'GET' | 'POST') {
  return new Request(
    'http://localhost/api/institution/real-channel-preflight?tenantId=tenant_should_not_echo&channelRoute=provider_should_not_echo',
    {
      method,
      headers: {
        cookie: 'demo_session=should-not-read; token=secret_should_not_echo',
        'content-type': 'application/json',
      },
      body: method === 'POST'
        ? '{"safetySwitchSummary":{"allowRealSend":true},"proof":"proof_should_not_echo"}'
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
    /tenant|institution|scope|channel.?route|safety.?switch|preflight|boundary|proof|blocked|mock.?ready|secret|token|provider|payload/i,
  );
  expectNoLegacyInitializationOrCalls();
}

beforeEach(() => {
  for (const mock of downstreamMocks) mock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('real-channel preflight capability-off API route', () => {
  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)('%s 对普通、带 query/cookie/body 的请求固定返回低敏 503', async (method, handler) => {
    await expectCapabilityDisabled(handler, ordinaryRequest(method));
  });

  it('POST 对非法 JSON 仍返回相同 capability-off，且不读取 body', async () => {
    const request = new Request(
      'http://localhost/api/institution/real-channel-preflight?malformed=%ZZ', {
      method: 'POST',
      body: '{"secret":"secret_should_not_echo"',
      },
    );

    await expectCapabilityDisabled(POST, request);
  });

  it.each([
    ['GET', GET],
    ['POST', POST],
  ] as const)('%s 不解引用 hostile Request Proxy', async (_method, handler) => {
    const hostile = hostileRequest();

    await expectCapabilityDisabled(handler, hostile.value);
    expect(hostile.trapCount()).toBe(0);
  });

  it('route 仅导入 NextResponse，且不含 session、RBAC、DB、审计或领域 preflight', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/app/api/institution/real-channel-preflight/route.ts'),
      'utf8',
    );
    const imports = source.match(/^import .*$/gmu) ?? [];

    expect(imports).toEqual(["import { NextResponse } from 'next/server';"]);
    expect(source).not.toMatch(
      /getDemoAccessContextFromRequest|canAccessResource|getDatabase|createAuditEvent|evaluateRealChannelPreflight|createDefaultRealChannelPreflightInput|request\.|query|cookie|body|session|tenant|institution|scope|channelRoute|safetySwitch|preflight|boundary|proof|process\.env|fetch\(/i,
    );
  });
});
