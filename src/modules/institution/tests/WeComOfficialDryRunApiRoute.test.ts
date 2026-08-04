import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const downstreams = vi.hoisted(() => ({
  canAccessResource: vi.fn(),
  createAuditEvent: vi.fn(),
  createAuditEventRepository: vi.fn(),
  createDefaultWeComOfficialDryRunInput: vi.fn(),
  createDeniedAccessAuditEvent: vi.fn(),
  evaluateWeComOfficialDryRun: vi.fn(),
  fetch: vi.fn(),
  getDatabase: vi.fn(),
  getDemoAccessContextFromRequest: vi.fn(),
  initialized: {
    accessContext: 0,
    accessControl: 0,
    auditDomain: 0,
    auditRepository: 0,
    database: 0,
    dryRunDomain: 0,
  },
}));

vi.mock('@/modules/security/server/access-context', () => {
  downstreams.initialized.accessContext += 1;
  return {
    getDemoAccessContextFromRequest: downstreams.getDemoAccessContextFromRequest,
  };
});

vi.mock('@/modules/security/domain/access-control', () => {
  downstreams.initialized.accessControl += 1;
  return {
    canAccessResource: downstreams.canAccessResource,
  };
});

vi.mock('@/modules/audit/domain/audit-events', () => {
  downstreams.initialized.auditDomain += 1;
  return {
    createAuditEvent: downstreams.createAuditEvent,
    createDeniedAccessAuditEvent: downstreams.createDeniedAccessAuditEvent,
  };
});

vi.mock('@/modules/audit/server/audit-event-repository', () => {
  downstreams.initialized.auditRepository += 1;
  return {
    createAuditEventRepository: downstreams.createAuditEventRepository,
  };
});

vi.mock('@/modules/institution/domain/wecom-official-dry-run', () => {
  downstreams.initialized.dryRunDomain += 1;
  return {
    createDefaultWeComOfficialDryRunInput:
      downstreams.createDefaultWeComOfficialDryRunInput,
    evaluateWeComOfficialDryRun: downstreams.evaluateWeComOfficialDryRun,
  };
});

vi.mock('@/server/db/client', () => {
  downstreams.initialized.database += 1;
  return {
    getDatabase: downstreams.getDatabase,
  };
});

import { POST } from '@/app/api/institution/wecom-official-dry-run/evaluate/route';
import { GET } from '@/app/api/institution/wecom-official-dry-run/route';

vi.mock('@/app/api/institution/_shared/institution-route-guard', () => ({
  withInstitutionSectionRouteGuardV1: ({
    handler,
  }: {
    handler: (...args: unknown[]) => Response | Promise<Response>;
  }) => handler,
}));

const getRouteSourcePath = resolve(
  process.cwd(),
  'src/app/api/institution/wecom-official-dry-run/route.ts',
);
const postRouteSourcePath = resolve(
  process.cwd(),
  'src/app/api/institution/wecom-official-dry-run/evaluate/route.ts',
);
const endpoint = 'https://institution.example.test/api/institution/wecom-official-dry-run';
const getCapabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '企业微信官方 dry-run 能力当前未启用',
});
const postCapabilityDisabledPayload = Object.freeze({
  code: 'capability_disabled',
  error: '企业微信官方 dry-run 评估能力当前未启用',
});
const forbiddenResponseKeys = [
  'allowRealSend',
  'audit',
  'boundary',
  'dryRun',
  'dryRunPlanReady',
  'dryRunStatus',
  'externalChannelEnabled',
  'institutionId',
  'labels',
  'mockDryRunCompleted',
  'realSendAllowed',
  'scope',
  'tenantId',
] as const;

function request(
  method: 'GET' | 'POST',
  suffix = '',
  body?: string,
): Request {
  return new Request(`${endpoint}${suffix}`, {
    method,
    headers: {
      cookie: 'demo_session=forged-session; wecom_secret=do-not-read',
      'content-type': 'application/json',
      'x-institution-id': 'forged-institution',
      'x-tenant-id': 'forged-tenant',
    },
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
    getPrototypeOf() {
      trapCount += 1;
      throw new Error('request prototype must not be inspected');
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

async function expectCapabilityDisabled(
  response: Response,
  expectedPayload: Readonly<Record<string, string>>,
  forbiddenInput = '',
) {
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const payload = await response.json();
  expect(payload).toEqual(expectedPayload);
  for (const key of forbiddenResponseKeys) expect(payload).not.toHaveProperty(key);
  if (forbiddenInput) expect(JSON.stringify(payload)).not.toContain(forbiddenInput);
}

function expectDownstreamsIdle() {
  expect(downstreams.initialized).toEqual({
    accessContext: 0,
    accessControl: 0,
    auditDomain: 0,
    auditRepository: 0,
    database: 0,
    dryRunDomain: 0,
  });
  for (const dependency of [
    downstreams.canAccessResource,
    downstreams.createAuditEvent,
    downstreams.createAuditEventRepository,
    downstreams.createDefaultWeComOfficialDryRunInput,
    downstreams.createDeniedAccessAuditEvent,
    downstreams.evaluateWeComOfficialDryRun,
    downstreams.getDatabase,
    downstreams.getDemoAccessContextFromRequest,
  ]) {
    expect(dependency).not.toHaveBeenCalled();
  }
  expect(downstreams.fetch).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', downstreams.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('企业微信官方 dry-run API capability-off', () => {
  it.each([
    ['普通请求', () => request('GET')],
    ['query 与 cookie', () => request('GET', '?scope=forged&secret=input-must-not-echo')],
    ['带 body 的 Request', () => request('POST', '', JSON.stringify({
      dryRun: 'input-must-not-echo',
      secret: 'input-must-not-echo',
    }))],
  ])('GET 对%s固定返回低敏 503，且不初始化或调用下游', async (_name, createRequest) => {
    const input = createRequest();
    const text = vi.spyOn(input, 'text');
    const json = vi.spyOn(input, 'json');
    const arrayBuffer = vi.spyOn(input, 'arrayBuffer');
    const formData = vi.spyOn(input, 'formData');

    await expectCapabilityDisabled(
      await GET(input),
      getCapabilityDisabledPayload,
      'input-must-not-echo',
    );

    expect(text).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(formData).not.toHaveBeenCalled();
    expectDownstreamsIdle();
  });

  it('GET 对 hostile Request Proxy 零 trap、零副作用', async () => {
    const hostile = hostileRequest();

    await expectCapabilityDisabled(await GET(hostile.value), getCapabilityDisabledPayload);

    expect(hostile.trapCount()).toBe(0);
    expectDownstreamsIdle();
  });

  it.each([
    ['普通请求', () => request('POST', '/evaluate', '{}')],
    ['非法 JSON', () => request('POST', '/evaluate', '{not-json')],
    ['敏感与伪造 scope 输入', () => request('POST', '/evaluate', JSON.stringify({
      tenantId: 'forged-tenant',
      institutionId: 'forged-institution',
      corpId: 'corp-real',
      secret: 'input-must-not-echo',
      token: 'input-must-not-echo',
    }))],
  ])('evaluate POST 对%s保持既有 capability-off 边界', async (_name, createRequest) => {
    await expectCapabilityDisabled(
      POST(createRequest()),
      postCapabilityDisabledPayload,
      'input-must-not-echo',
    );
    expectDownstreamsIdle();
  });

  it('evaluate POST 对 hostile Request Proxy 零 trap、零副作用', async () => {
    const hostile = hostileRequest();

    await expectCapabilityDisabled(POST(hostile.value), postCapabilityDisabledPayload);

    expect(hostile.trapCount()).toBe(0);
    expectDownstreamsIdle();
  });

  it('GET route 源码只保留共享 Guard 与 NextResponse，且可接收但不读取 Request', () => {
    const source = readFileSync(getRouteSourcePath, 'utf8');
    const imports = source.match(/^import .+;$/gmu) ?? [];

    expect(imports).toEqual([
      "import { withInstitutionSectionRouteGuardV1 } from '@/app/api/institution/_shared/institution-route-guard';",
      "import { NextResponse } from 'next/server';",
    ]);
    expect(source).toContain('function GET(_request: Request)');
    expect(source).toContain(
      'export { _base02B4GuardedGET as GET };',
    );
    expect(source.match(/_request/gmu)).toHaveLength(1);
    for (const forbidden of [
      '@/modules/',
      '@/server/',
      'access-context',
      'audit',
      'boundary',
      'canAccessResource',
      'createDefaultWeComOfficialDryRunInput',
      'dryRun',
      'evaluateWeComOfficialDryRun',
      'fetch(',
      'getDatabase',
      'getDemoAccessContextFromRequest',
      'process.env',
      'request.',
      'request[',
      'scope',
      'session',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it('evaluate POST route 保持只装配 NextResponse 的既有关闭状态', () => {
    const source = readFileSync(postRouteSourcePath, 'utf8');
    const imports = source.match(/^import .+;$/gmu) ?? [];

    expect(imports).toEqual(["import { NextResponse } from 'next/server';"]);
    expect(source).toContain('export function POST(_request: Request)');
    expect(source.match(/_request/gmu)).toHaveLength(1);
    for (const forbidden of [
      '@/modules/',
      '@/server/',
      'getDemoAccessContextFromRequest',
      'getDatabase',
      'createAuditEventRepository',
      'evaluateWeComOfficialDryRun',
      'process.env',
      'request.',
      'fetch(',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
