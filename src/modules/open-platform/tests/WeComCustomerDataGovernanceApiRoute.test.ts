import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as governanceRoute from '@/app/api/open-platform/wecom/customer-data-governance/route';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => ({
  getDemoAccessContextFromRequest: vi.fn(),
  createWeComPlatformGovernancePayload: vi.fn(),
}));

vi.mock('@/modules/open-platform/domain/wecom-customer-data-governance', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/open-platform/domain/wecom-customer-data-governance')
  >();
  routeMocks.createWeComPlatformGovernancePayload.mockImplementation(
    actual.createWeComPlatformGovernancePayload,
  );
  return {
    ...actual,
    createWeComPlatformGovernancePayload: routeMocks.createWeComPlatformGovernancePayload,
  };
});

vi.mock('@/modules/security/server/access-context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/security/server/access-context')>();
  return {
    ...actual,
    getDemoAccessContextFromRequest: routeMocks.getDemoAccessContextFromRequest,
  };
});

const platformOperatorContext: AccessContext = {
  userId: 'mock-platform-operator',
  role: 'platform_operator',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const platformAdminContext: AccessContext = {
  userId: 'mock-platform-admin',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

const tenantAdminContext: AccessContext = {
  userId: 'mock-tenant-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'mock-tenant-001',
  source: 'demo_session',
};

function request() {
  return new Request('http://localhost/api/open-platform/wecom/customer-data-governance');
}

function expectNoSensitivePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const forbidden of [
    'externalContacts',
    'displayName',
    'followUsers',
    'tags',
    'remarkSummary',
    'mappingCandidates',
    'external_userid',
    'externalUserId',
    'user_id',
    'userId',
    'userid',
    'phone_number',
    'phoneNumber',
    'mobile',
    'accessToken',
    '13800138000',
    'access_token',
    'secret',
    'chatContent',
    'conversationContent',
    'archiveKey',
    'webhookPayload',
    'apiResponse',
    'sha256:',
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

beforeEach(() => {
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.createWeComPlatformGovernancePayload.mockClear();
});

describe('平台端企业微信客户数据治理只读 API', () => {
  it.each([
    ['platform_admin', platformAdminContext],
    ['platform_operator', platformOperatorContext],
  ])('%s 返回 mock/demo governance payload', async (_role, context) => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(context);

    const response = governanceRoute.GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      sourceKind: 'controlled_mock_governance_summary',
      mockDemo: true,
      dataMode: 'mock',
      readonly: true,
      containsRealCustomerData: false,
      providerStatusSummary: { externalCapabilityEnabled: false },
      failClosedStatus: {
        enabled: true,
        externalCallsAllowed: false,
      },
    });
    expect(payload.authorizationStatusSummary.totalTenants).toBeGreaterThan(0);
    expect(payload.syncHealthSummary.blockedTenantCount).toBeGreaterThan(0);
    expect(payload.anomalousTenants.length).toBeGreaterThan(0);
    expect(payload.fieldBlockingSummary.forbiddenFieldsReturned).toBe(false);
    expect(payload.auditSummary.containsSensitivePayload).toBe(false);
    expect(Object.keys(payload).sort()).toEqual([
      'anomalousTenants',
      'auditSummary',
      'authorizationStatusSummary',
      'containsRealCustomerData',
      'dataMode',
      'failClosedStatus',
      'fieldBlockingSummary',
      'generatedAt',
      'latestMockSnapshotAt',
      'mockDemo',
      'providerStatusSummary',
      'readonly',
      'sourceKind',
      'syncHealthSummary',
    ]);
    expect(Object.keys(payload.anomalousTenants[0]).sort()).toEqual([
      'authorizationStatus',
      'failClosed',
      'lastMockSnapshotAt',
      'providerState',
      'reason',
      'syncStatus',
      'tenantDisplayName',
      'tenantReference',
    ]);
    expectNoSensitivePayload(payload);
  });

  it('无登录上下文返回 401', async () => {
    const response = governanceRoute.GET(request());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: '请先登录' });
  });

  it('tenant_admin 无平台租户聚合权限时返回 403', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantAdminContext);

    const response = governanceRoute.GET(request());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: '没有访问权限' });
  });

  it('生成器混入未知敏感 payload 时 API fail-closed 且不回显内容', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformAdminContext);
    routeMocks.createWeComPlatformGovernancePayload.mockReturnValueOnce({
      sourceKind: 'controlled_mock_governance_summary',
      rawResponse: {
        externalUserId: 'raw-external-id',
        phoneNumber: '13800138000',
        accessToken: 'raw-token',
      },
    } as never);

    const response = governanceRoute.GET(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: '治理摘要未通过安全校验' });
    expectNoSensitivePayload(body);
    expect(JSON.stringify(body)).not.toContain('raw-external-id');
    expect(JSON.stringify(body)).not.toContain('raw-token');
  });

  it('provider disabled 与 external_disabled 保持 fail-closed 摘要', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformOperatorContext);

    const response = governanceRoute.GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.anomalousTenants).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providerState: 'disabled',
        failClosed: true,
        reason: 'provider_disabled',
      }),
      expect.objectContaining({
        providerState: 'external_disabled',
        failClosed: true,
        reason: 'external_provider_disabled',
      }),
    ]));
  });

  it('路由仅暴露 GET 且没有外部调用或写操作入口', () => {
    expect('GET' in governanceRoute).toBe(true);
    expect('POST' in governanceRoute).toBe(false);
    expect('PUT' in governanceRoute).toBe(false);
    expect('PATCH' in governanceRoute).toBe(false);
    expect('DELETE' in governanceRoute).toBe(false);
    expect(Object.keys(governanceRoute)).not.toEqual(expect.arrayContaining([
      'sync',
      'send',
      'getAccessToken',
      'addMsgTemplate',
      'getSendResult',
      'readConversation',
    ]));
  });
});
