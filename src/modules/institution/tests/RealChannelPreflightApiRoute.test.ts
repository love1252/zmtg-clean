import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/institution/real-channel-preflight/route';
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
  return new Request('http://localhost/api/institution/real-channel-preflight', {
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
  expect(text).not.toContain('access_token_real');
  expect(text).not.toContain('webhook-secret-real');
  expect(text).not.toContain('external_userid_real');
  expect(text).not.toContain('postgres://real-db');
  expect(text).not.toContain('HIS payload raw body');
  expect(text).not.toContain('MACHINE-REAL-001');
  expect(text).not.toContain('18888');
  expect(text).not.toContain('uip.exe');
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

describe('real-channel preflight API route', () => {
  it('GET 返回当前机构低敏 preflight 状态并记录 viewed audit reason', async () => {
    const response = await GET(request('GET'));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      preflight: {
        channelRoute: 'official_wecom_self_built',
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
      },
      boundary: {
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
        noRealExternalIntegration: true,
      },
    });
    expectLowSensitivePayload(payload);
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'real_channel',
        action: 'read',
        reason: 'real_channel_preflight_viewed',
      }),
    );
  });

  it('POST 只做本地模拟评估且官方路线不会允许真实发送', async () => {
    const response = await POST(request('POST', {
      channelRoute: 'official_wecom_self_built',
      hasManualConfirmation: true,
      hasConsent: true,
      hasOptOut: false,
      frequencyCapPassed: true,
      aiStrategyDecision: 'draft_requires_human',
      aiStrategyLevel: 'L1',
      emergencyStopEnabled: false,
      safetySwitchSummary: {
        tenantRealChannelEnabled: true,
        institutionRealChannelEnabled: true,
        weComRealSendEnabled: true,
        smsRealSendEnabled: true,
        webhookEnabled: true,
        emergencyStopEnabled: false,
      },
      allowRealSend: true,
      externalChannelEnabled: true,
    }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      preflight: {
        preflightStatus: 'mock_ready',
        proofEligibleMock: true,
        allowRealSend: false,
        externalChannelEnabled: false,
        realSendAllowed: false,
      },
      boundary: {
        localSimulationOnly: true,
        noSecretAccepted: true,
      },
    });
    expectLowSensitivePayload(payload);
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'real_channel',
        action: 'review',
        reason: 'real_channel_proof_mock_eligible',
      }),
    );
  });

  it('POST 含 secret/token/corpId/webhook payload 会受控阻断且输出低敏', async () => {
    const response = await POST(request('POST', {
      channelRoute: 'official_wecom_self_built',
      hasManualConfirmation: true,
      hasConsent: true,
      frequencyCapPassed: true,
      corpId: 'corp-real',
      token: 'access_token_real',
      webhook_secret: 'webhook-secret-real',
      external_userid: 'external_userid_real',
      DATABASE_URL: 'postgres://real-db',
      hisPayload: 'HIS payload raw body',
      webhook_payload: { raw: 'body' },
      machineNumber: 'MACHINE-REAL-001',
      loginPort: '18888',
      uipPath: 'uip.exe',
      scanLogin: true,
    }));
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      preflight: {
        preflightStatus: 'blocked_sensitive_config',
        proofEligibleMock: false,
        realSendAllowed: false,
        auditReason: 'real_channel_sensitive_config_blocked',
      },
    });
    expectLowSensitivePayload(payload);
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'real_channel',
        action: 'review',
        reason: 'real_channel_sensitive_config_blocked',
        result: 'denied',
      }),
    );
  });
});
