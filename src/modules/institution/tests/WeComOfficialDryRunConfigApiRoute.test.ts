import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/institution/wecom-official-dry-run-config/route';
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

function request(method: 'GET' | 'POST', body?: unknown) {
  return new Request('http://localhost/api/institution/wecom-official-dry-run-config', {
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

describe('wecom official dry-run config API route', () => {
  it('GET 返回当前机构低敏 dry-run 配置占位状态并记录 viewed audit reason', async () => {
    const response = await GET(request('GET'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      config: {
        officialRoute: 'official_wecom_self_built',
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
        noSecretStored: true,
        noSecretRead: true,
        noRealNetwork: true,
        noRealSend: true,
      },
      boundary: {
        dryRunOnly: true,
        noSecretStored: true,
        noSecretRead: true,
        noRealNetwork: true,
        noRealSend: true,
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
      },
    });
    expectLowSensitivePayload(payload);
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'real_channel',
        action: 'read',
        reason: 'wecom_dry_run_config_viewed',
      }),
    );
  });

  it('POST 满足低敏条件时返回 dry_run_ready 且仍强制真实发送关闭', async () => {
    const response = await POST(request('POST', {
      officialRoute: 'official_wecom_self_built',
      proofInstitutionRef: '机构 ZM****001',
      callbackUrlPlaceholder: 'https://callback-placeholder.example.test/wecom/dry-run',
      hasTestWeComEnvironment: true,
      hasCallbackDomainPlaceholder: true,
      hasSecretKeeperConfirmed: true,
      hasManualConfirmation: true,
      preflightStatus: 'mock_ready',
      proofEligibleMock: true,
      dryRunOnly: true,
      allowRealSend: false,
      externalChannelEnabled: false,
      realSendAllowed: false,
    }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      config: {
        configStatus: 'dry_run_ready',
        dryRunReady: true,
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
        noSecretStored: true,
        noSecretRead: true,
        noRealNetwork: true,
        noRealSend: true,
        auditReason: 'wecom_dry_run_ready',
      },
      boundary: {
        localSimulationOnly: true,
        noSecretAccepted: true,
        noRealNetwork: true,
        noRealSend: true,
      },
    });
    expect(JSON.stringify(payload)).not.toContain('real_ready');
    expectLowSensitivePayload(payload);
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'real_channel',
        action: 'review',
        reason: 'wecom_dry_run_ready',
        result: 'allowed',
      }),
    );
  });

  it('POST 含敏感字段和值会阻断且不回显真实值', async () => {
    const response = await POST(request('POST', {
      officialRoute: 'official_wecom_self_built',
      proofInstitutionRef: '机构 ZM****001',
      callbackUrlPlaceholder: 'https://callback-placeholder.example.test/wecom/dry-run',
      hasTestWeComEnvironment: true,
      hasCallbackDomainPlaceholder: true,
      hasSecretKeeperConfirmed: true,
      hasManualConfirmation: true,
      preflightStatus: 'mock_ready',
      proofEligibleMock: true,
      corpId: 'corp-real',
      secret: 'secret-real',
      token: 'access_token_real',
      encodingAESKey: 'encoding-key-real',
      webhook_secret: 'webhook-secret-real',
      external_userid: 'external_userid_real',
      userid: 'userid_real',
      DATABASE_URL: 'postgres://real-db',
      hisPayload: 'HIS payload raw body',
    }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      config: {
        configStatus: 'blocked_sensitive_value_detected',
        dryRunReady: false,
        auditReason: 'wecom_dry_run_sensitive_value_blocked',
        realSendAllowed: false,
      },
    });
    expectLowSensitivePayload(payload);
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'wecom_dry_run_sensitive_value_blocked',
        result: 'denied',
      }),
    );
  });

  it('POST 检测 secret 读取、真实出网和真实发送企图并阻断', async () => {
    const base = {
      officialRoute: 'official_wecom_self_built',
      proofInstitutionRef: '机构 ZM****001',
      callbackUrlPlaceholder: 'https://callback-placeholder.example.test/wecom/dry-run',
      hasTestWeComEnvironment: true,
      hasCallbackDomainPlaceholder: true,
      hasSecretKeeperConfirmed: true,
      hasManualConfirmation: true,
      preflightStatus: 'mock_ready',
      proofEligibleMock: true,
    };

    const secretRead = await json(await POST(request('POST', { ...base, readSecret: true })));
    expect(secretRead).toMatchObject({ config: { configStatus: 'blocked_secret_read_attempt' } });
    expectLowSensitivePayload(secretRead);

    const realNetwork = await json(await POST(request('POST', { ...base, endpoint: 'https://qyapi.weixin.qq.com/cgi-bin/gettoken' })));
    expect(realNetwork).toMatchObject({ config: { configStatus: 'blocked_real_network_forbidden', noRealNetwork: true } });
    expectLowSensitivePayload(realNetwork);

    const realSend = await json(await POST(request('POST', { ...base, allowRealSend: true, externalChannelEnabled: true, realSendAllowed: true })));
    expect(realSend).toMatchObject({
      config: {
        configStatus: 'blocked_real_send_forbidden',
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
      },
    });
    expectLowSensitivePayload(realSend);
  });
});
