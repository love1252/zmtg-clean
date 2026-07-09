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
  it('未登录 GET 和 POST 返回 401 且不记录 audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);

    const getResponse = await GET(request('GET'));
    const postResponse = await POST(request('POST', readyBody));

    expect(getResponse.status).toBe(401);
    expect(postResponse.status).toBe(401);
    expect(routeMocks.auditRecord).not.toHaveBeenCalled();
  });

  it('GET 返回当前机构 dry-run 计划状态并记录 viewed audit reason', async () => {
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

  it('POST networkMode=mock 返回 mock_dry_run_completed 且只做本地模拟', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await POST(request('POST', readyBody));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      dryRun: {
        dryRunStatus: 'mock_dry_run_completed',
        dryRunPlanReady: true,
        mockDryRunCompleted: true,
        networkMode: 'mock',
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
        noRealSend: true,
        noRealNetwork: true,
        noSecretRead: true,
        noSecretOutput: true,
        auditReason: 'wecom_official_dry_run_mock_completed',
      },
      boundary: {
        localSimulationOnly: true,
        noSecretOutput: true,
        noRealNetwork: true,
        noRealSend: true,
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expectLowSensitivePayload(payload);
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'real_channel',
        action: 'review',
        reason: 'wecom_official_dry_run_mock_completed',
        result: 'allowed',
      }),
    );
    fetchSpy.mockRestore();
  });

  it('POST networkMode=live_dry_run_requested 返回 blocked_real_network_disabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await POST(request('POST', { ...readyBody, networkMode: 'live_dry_run_requested' }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      dryRun: {
        dryRunStatus: 'blocked_real_network_disabled',
        networkMode: 'live_dry_run_requested',
        noRealNetwork: true,
        auditReason: 'wecom_official_dry_run_real_network_blocked',
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expectLowSensitivePayload(payload);
    fetchSpy.mockRestore();
  });

  it('POST 含敏感字段和值会阻断且不回显真实值', async () => {
    const response = await POST(request('POST', {
      ...readyBody,
      corpId: 'corp-real',
      secret: 'secret-real',
      token: 'access_token_real',
      encodingAESKey: 'encoding-key-real',
      webhook_secret: 'webhook-secret-real',
      external_userid: 'external_userid_real',
      userid: 'userid_real',
      agentId: 'agent-real',
      appId: 'wx-real-app',
      DATABASE_URL: 'postgres://real-db',
      hisPayload: 'HIS payload raw body',
    }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      dryRun: {
        dryRunStatus: 'blocked_sensitive_payload',
        mockDryRunCompleted: false,
        auditReason: 'wecom_official_dry_run_sensitive_payload_blocked',
        realSendAllowed: false,
      },
    });
    expectLowSensitivePayload(payload);
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'wecom_official_dry_run_sensitive_payload_blocked',
        result: 'denied',
      }),
    );
  });

  it('POST 检测 secret 读取、真实出网和真实发送企图并阻断', async () => {
    const secretRead = await json(await POST(request('POST', { ...readyBody, readSecret: true })));
    expect(secretRead).toMatchObject({ dryRun: { dryRunStatus: 'blocked_secret_read_attempt' } });
    expectLowSensitivePayload(secretRead);

    const realNetwork = await json(await POST(request('POST', { ...readyBody, endpoint: 'https://qyapi.weixin.qq.com/cgi-bin/gettoken' })));
    expect(realNetwork).toMatchObject({ dryRun: { dryRunStatus: 'blocked_real_network_disabled', noRealNetwork: true } });
    expectLowSensitivePayload(realNetwork);

    const realSend = await json(await POST(request('POST', { ...readyBody, allowRealSend: true, externalChannelEnabled: true, realSendAllowed: true })));
    expect(realSend).toMatchObject({
      dryRun: {
        dryRunStatus: 'blocked_real_send_forbidden',
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
      },
    });
    expectLowSensitivePayload(realSend);
  });
});
