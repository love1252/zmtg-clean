import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PATCH } from '@/app/api/institution/safety-switch/route';
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

const staffContext: AccessContext = {
  ...tenantAdminContext,
  userId: 'staff-user',
  role: 'customer_service',
};

function request(body?: unknown) {
  return new Request('http://localhost/api/institution/safety-switch', {
    method: body === undefined ? 'GET' : 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
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

describe('safety switch API route', () => {
  it('读取默认关闭的安全开关并写入低敏审计', async () => {
    const response = await GET(request());
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      tenantRealChannelEnabled: false,
      institutionRealChannelEnabled: false,
      weComRealSendEnabled: false,
      smsRealSendEnabled: false,
      webhookEnabled: false,
      emergencyStopEnabled: true,
      allowRealSend: false,
      externalChannelEnabled: false,
      realChannelBlocked: true,
      status: 'mock_only',
    });
    expect(payload.boundaryLabels).toEqual(
      expect.arrayContaining([
        '真实渠道默认关闭',
        '企业微信真实发送关闭',
        '短信真实发送关闭',
        'webhook 关闭',
        '当前仍为 mock',
        '不接真实 HIS / 企业微信 / 短信 / webhook',
        '不真实发送 / 不真实出网',
      ]),
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'safety_switch',
        action: 'read',
        reason: 'safety_switch_read',
      }),
    );
  });

  it('普通员工不能更新安全开关或开启真实渠道', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(staffContext);

    const response = await PATCH(request({ weComRealSendEnabled: true, allowRealSend: true }));
    const payload = await json(response);

    expect(response.status).toBe(403);
    expect(payload.error).toBe('没有访问权限');
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'safety_switch',
        action: 'update',
        reason: 'role_denied',
        result: 'denied',
      }),
    );
  });

  it('管理员尝试开启真实渠道也会被 mock policy 阻断', async () => {
    const response = await PATCH(
      request({
        tenantRealChannelEnabled: true,
        institutionRealChannelEnabled: true,
        weComRealSendEnabled: true,
        smsRealSendEnabled: true,
        webhookEnabled: true,
        emergencyStopEnabled: false,
        allowRealSend: true,
        externalChannelEnabled: true,
      }),
    );
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.allowRealSend).toBe(false);
    expect(payload.externalChannelEnabled).toBe(false);
    expect(payload.realChannelBlocked).toBe(true);
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'safety_switch',
        action: 'update',
        reason: 'real_channel_enable_blocked',
        result: 'denied',
      }),
    );
    expect(routeMocks.auditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'safety_switch',
        action: 'update',
        reason: 'safety_switch_updated',
        result: 'allowed',
      }),
    );
  });
});
