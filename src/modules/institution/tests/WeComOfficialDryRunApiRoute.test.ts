import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/institution/wecom-official-dry-run/evaluate/route';
import { GET } from '@/app/api/institution/wecom-official-dry-run/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const auditRecord = vi.fn();
  const database = { database: 'test-db' };

  return {
    auditRecord,
    createAuditEventRepository: vi.fn(() => ({ record: auditRecord })),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
  };
});

vi.mock('@/server/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/db/client')>();
  return {
    ...actual,
    getDatabase: routeMocks.getDatabase,
  };
});

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/server/access-context')>();
  return {
    ...actual,
    getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
  };
});

vi.mock('@/modules/audit/server/audit-event-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/audit/server/audit-event-repository')>();
  return {
    ...actual,
    createAuditEventRepository: routeMocks.createAuditEventRepository,
  };
});

const tenantAdminContext: AccessContext = {
  userId: 'tenant-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'tenant-a',
  institutionId: 'inst-a',
  source: 'demo_session',
};

const readyBody = {
  tenantId: 'tenant-low-sensitive-001',
  institutionId: 'institution-low-sensitive-001',
  operatorRole: 'tenant_admin',
  officialRoute: 'official_wecom_self_built',
  dryRunConfigStatus: 'dry_run_ready',
  preflightStatus: 'mock_ready',
  proofEligibleMock: true,
  hasManualConfirmation: true,
  hasSecretPlaceholder: true,
  hasCallbackUrlPlaceholder: true,
  networkMode: 'mock',
  allowRealSend: false,
  externalChannelEnabled: false,
  realSendAllowed: false,
  noSecretRead: true,
  noRealSend: true,
  dryRunOnly: true,
};

const capabilityDisabledPayload = {
  code: 'capability_disabled',
  error: '企业微信官方 dry-run 评估能力当前未启用',
};

function request(method: 'GET' | 'POST', body?: unknown) {
  return new Request('http://localhost/api/institution/wecom-official-dry-run', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

function expectLowSensitivePayload(payload: unknown) {
  const text = JSON.stringify(payload);
  expect(text).not.toContain('corp-real');
  expect(text).not.toContain('secret-real');
  expect(text).not.toContain('access_token_real');
  expect(text).not.toContain('encoding-key-real');
  expect(text).not.toContain('webhook-secret-real');
  expect(text).not.toContain('external_userid_real');
  expect(text).not.toContain('userid_real');
  expect(text).not.toContain('agent-real');
  expect(text).not.toContain('wx-real-app');
  expect(text).not.toContain('postgres://real-db');
  expect(text).not.toContain('HIS payload raw body');
  expect(text).not.toContain('qyapi.weixin.qq.com');
}

async function expectCapabilityDisabled(input: Request) {
  const fetchSpy = vi.spyOn(globalThis, 'fetch');

  try {
    const response = await POST(input);
    const payload = await json(response);

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(payload).toStrictEqual(capabilityDisabledPayload);
    expectLowSensitivePayload(payload);
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    fetchSpy.mockRestore();
  }
}

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantAdminContext);
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.auditRecord.mockReset();
  routeMocks.auditRecord.mockResolvedValue(undefined);
});

describe('wecom official route dry-run API route', () => {
  it('未登录 GET 仍返回 401 且不记录 audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const response = await GET(request('GET'));

    expect(response.status).toBe(401);
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('GET 保持返回当前机构 dry-run 计划状态并记录 viewed audit reason', async () => {
    const response = await GET(request('GET'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      dryRun: {
        dryRunStatus: 'blocked_config_not_ready',
        dryRunPlanReady: false,
        mockDryRunCompleted: false,
        noRealSend: true,
        noRealNetwork: true,
        noSecretRead: true,
        noSecretOutput: true,
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
      },
      boundary: {
        localSimulationOnly: true,
        noSecretRead: true,
        noSecretOutput: true,
        noRealNetwork: true,
        noRealSend: true,
      },
    });
    expectLowSensitivePayload(payload);
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'real_channel',
        action: 'read',
        reason: 'wecom_official_dry_run_viewed',
      }),
    );
  });

  it.each([
    ['普通请求', () => request('POST', {})],
    ['未认证请求', () => request('POST')],
    ['伪造 scope 与角色', () => request('POST', {
      tenantId: 'tenant-forged',
      institutionId: 'institution-forged',
      operatorRole: 'platform_admin',
    })],
    ['非法 JSON', () => new Request(
      'http://localhost/api/institution/wecom-official-dry-run/evaluate',
      { method: 'POST', body: '{invalid-json' },
    )],
    ['超大 body', () => request('POST', { padding: 'x'.repeat(2_000_000) })],
    ['敏感和 mock-ready 输入', () => request('POST', {
      ...readyBody,
      corpId: 'corp-real',
      secret: 'secret-real',
      token: 'access_token_real',
      endpoint: 'https://qyapi.weixin.qq.com/cgi-bin/gettoken',
      auditReason: 'caller-forged-audit',
    })],
  ])('POST 对%s在读取输入前固定返回 capability-disabled', async (_name, createRequest) => {
    await expectCapabilityDisabled(createRequest());
  });

  it('POST 对 hostile Request 不触发任何 trap', async () => {
    let traps = 0;
    const fail = () => {
      traps += 1;
      throw new Error('request must not be inspected');
    };
    const hostileRequest = new Proxy({} as Request, {
      get: fail,
      getOwnPropertyDescriptor: fail,
      getPrototypeOf: fail,
      has: fail,
      ownKeys: fail,
    });

    await expectCapabilityDisabled(hostileRequest);
    expect(traps).toBe(0);
  });

  it('evaluate route 源码只装配 NextResponse 且不读取输入或下游依赖', () => {
    const source = readFileSync(
      'src/app/api/institution/wecom-official-dry-run/evaluate/route.ts',
      'utf8',
    );
    const imports = source.match(/^import .+;$/gm) ?? [];

    expect(imports).toStrictEqual(["import { NextResponse } from 'next/server';"]);
    expect(source).toContain('export function POST(_request: Request)');
    expect(source.match(/_request/g)).toHaveLength(1);
    for (const forbidden of [
      '@/modules/',
      '@/server/',
      'getDemoAccessContextFromRequest',
      'getDatabase',
      'createAuditEventRepository',
      'evaluateWeComOfficialDryRun',
      'process.env',
      '.json()',
      '.text()',
      '.headers',
      '.cookies',
      '.url',
      'fetch(',
      'mockDryRunCompleted',
      'auditReason',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
