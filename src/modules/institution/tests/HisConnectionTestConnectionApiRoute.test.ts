import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as hisConnectionTestConnectionPost } from '@/app/api/institution/his-connections/[connectionId]/test-connection/route';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { AccessContext } from '@/modules/security/domain/access-control';
import type { TenantDatabase } from '@/server/db/client';

const routeMocks = vi.hoisted(() => {
  const database = { kind: 'database' } as unknown as TenantDatabase;
  const auditEventRepository = {
    record: vi.fn(),
  };
  const hisConnectionRepository = {
    getHisConnectionByTenant: vi.fn(),
    writeHisConnectionHealthSummaryForTenant: vi.fn(),
  };

  return {
    auditEventRepository,
    createAuditEventRepository: vi.fn(() => auditEventRepository),
    createHisConnectionRepository: vi.fn(() => hisConnectionRepository),
    database,
    getDatabase: vi.fn(() => database),
    getDemoAccessContextFromRequest: vi.fn(),
    hisConnectionRepository,
    testHisConnectionForTenantService: vi.fn(),
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
  const actual = await importOriginal<
    typeof import('@/modules/audit/server/audit-event-repository')
  >();
  return {
    ...actual,
    createAuditEventRepository: routeMocks.createAuditEventRepository,
  };
});

vi.mock('@/modules/institution/server/his-connection-repository', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/his-connection-repository')
  >();
  return {
    ...actual,
    createHisConnectionRepository: routeMocks.createHisConnectionRepository,
  };
});

vi.mock(
  '@/modules/institution/server/his-connection-test-connection-service',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/modules/institution/server/his-connection-test-connection-service')
    >();
    return {
      ...actual,
      testHisConnectionForTenantService: routeMocks.testHisConnectionForTenantService,
    };
  },
);

const tenantContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const tenantOperatorContext: AccessContext = {
  userId: 'demo-user-operator',
  role: 'tenant_operator',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const platformContext: AccessContext = {
  userId: 'demo-user-platform',
  role: 'platform_admin',
  scope: 'platform',
  tenantId: null,
  source: 'demo_session',
};

function routeContext(connectionId = 'his_conn_001') {
  return {
    params: Promise.resolve({ connectionId }),
  };
}

function testConnectionRequest(payload?: unknown) {
  if (payload === undefined) {
    return new Request(
      'http://localhost/api/institution/his-connections/his_conn_001/test-connection?tenantId=forged',
      {
        method: 'POST',
        headers: {
          'x-tenant-id': 'forged-tenant',
          'x-his-tenant-id': 'forged-his-tenant',
        },
      },
    );
  }

  return new Request(
    'http://localhost/api/institution/his-connections/his_conn_001/test-connection?tenantId=forged',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': 'forged-tenant',
        'x-his-tenant-id': 'forged-his-tenant',
      },
      body: JSON.stringify(payload),
    },
  );
}

function requestWithJsonSpy() {
  return {
    body: {},
    json: vi.fn(async () => {
      throw new Error('body should not be read before permission passes');
    }),
  } as unknown as Request & { json: ReturnType<typeof vi.fn> };
}

async function expectJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function expectNoSensitiveRoutePayload(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /tenantId|demo-tenant-001|credentialRef|credential_ref|cred_ref_|token|secret|apiKey|api_key|endpoint|headers|providerCode|providerRawError|rawPayload|raw_payload|rawHisPayload|externalResponseBody|DATABASE_URL|postgres:\/\/|select \* from|SQL|stack/i,
  );
}

function expectNoSensitiveRouteAuditData(event: unknown) {
  expect(JSON.stringify(event)).not.toMatch(
    /requestBody|body|credentialRef|credential_ref|cred_ref_|token|secret|apiKey|api_key|endpoint|headers|providerCode|providerRawError|rawPayload|raw_payload|rawHisPayload|externalResponseBody|DATABASE_URL|postgres:\/\/|select \* from|SQL|stack/i,
  );
}

function expectTestConnectionRouteDeniedAuditEvent(
  event: unknown,
  input: {
    actorId: string;
    actorRole: AccessContext['role'];
    tenantId: string | null;
    reason: TenantAuditEvent['reason'];
    resourceId?: string;
  },
) {
  expect(event).toMatchObject({
    actorId: input.actorId,
    actorRole: input.actorRole,
    tenantId: input.tenantId,
    resource: 'open_connection',
    action: 'test_connection',
    result: 'denied',
    reason: input.reason,
    source: 'demo_session',
  });
  if (input.resourceId !== undefined) {
    expect(event).toMatchObject({ resourceId: input.resourceId });
  }
  expect((event as TenantAuditEvent).eventId).toEqual(expect.any(String));
  expect(Number.isFinite(Date.parse((event as TenantAuditEvent).occurredAt))).toBe(true);
  expectNoSensitiveRouteAuditData(event);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
  routeMocks.testHisConnectionForTenantService.mockReset();
  routeMocks.testHisConnectionForTenantService.mockResolvedValue({
    status: 'tested',
    dto: {
      ok: true,
      healthStatus: 'healthy',
      checkedAt: '2026-06-07T09:30:00.000Z',
    },
  });
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.auditEventRepository.record.mockReset();
  routeMocks.createHisConnectionRepository.mockClear();
  routeMocks.hisConnectionRepository.getHisConnectionByTenant.mockReset();
  routeMocks.hisConnectionRepository.writeHisConnectionHealthSummaryForTenant.mockReset();
});

describe('HIS 测试连接 API route 最小 runtime', () => {
  it('POST test-connection 成功调用 service，并只返回安全 DTO', async () => {
    routeMocks.testHisConnectionForTenantService.mockResolvedValueOnce({
      status: 'tested',
      dto: {
        ok: true,
        healthStatus: 'healthy',
        checkedAt: '2026-06-07T09:30:00.000Z',
        credentialRef: 'cred_ref_should_not_return',
        providerRawError: 'DATABASE_URL=postgres://secret stack',
      },
    });

    const response = await hisConnectionTestConnectionPost(
      testConnectionRequest(),
      routeContext('  his_conn_001  '),
    );
    const payload = await expectJson(response);

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      healthStatus: 'healthy',
      checkedAt: '2026-06-07T09:30:00.000Z',
    });
    expect(routeMocks.testHisConnectionForTenantService).toHaveBeenCalledWith({
      accessContext: tenantContext,
      connectionId: 'his_conn_001',
      database: routeMocks.database,
    });
    expect(routeMocks.testHisConnectionForTenantService).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'forged' }),
    );
    expect(routeMocks.createHisConnectionRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
    expectNoSensitiveRoutePayload(payload);
  });

  it('空 connectionId 返回 404，且不读取 access context、不调用 service、不写 audit', async () => {
    const request = requestWithJsonSpy();

    const response = await hisConnectionTestConnectionPost(request, routeContext('   '));

    expect(response.status).toBe(404);
    await expect(expectJson(response)).resolves.toEqual({
      code: 'not_found',
      error: '记录不存在',
    });
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(request.json).not.toHaveBeenCalled();
    expect(routeMocks.testHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
  });

  it('无 test_connection 权限返回 403，且不读取 body、不调用 service，并写 route denied audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantOperatorContext);
    const request = requestWithJsonSpy();

    const response = await hisConnectionTestConnectionPost(request, routeContext());

    expect(response.status).toBe(403);
    await expect(expectJson(response)).resolves.toEqual({
      code: 'forbidden',
      error: '没有访问权限',
    });
    expect(request.json).not.toHaveBeenCalled();
    expect(routeMocks.testHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).toHaveBeenCalledWith(routeMocks.database);
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(1);
    expectTestConnectionRouteDeniedAuditEvent(
      routeMocks.auditEventRepository.record.mock.calls[0]?.[0],
      {
        actorId: 'demo-user-operator',
        actorRole: 'tenant_operator',
        tenantId: 'demo-tenant-001',
        reason: 'role_denied',
        resourceId: 'his_conn_001',
      },
    );
  });

  it('平台角色不能用其他权限替代 test_connection，并只使用可信 access context 写 audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await hisConnectionTestConnectionPost(testConnectionRequest(), routeContext());

    expect(response.status).toBe(403);
    expect(routeMocks.testHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(1);
    expectTestConnectionRouteDeniedAuditEvent(
      routeMocks.auditEventRepository.record.mock.calls[0]?.[0],
      {
        actorId: 'demo-user-platform',
        actorRole: 'platform_admin',
        tenantId: null,
        reason: 'role_denied',
        resourceId: 'his_conn_001',
      },
    );
    expect(JSON.stringify(routeMocks.auditEventRepository.record.mock.calls[0]?.[0])).not.toContain(
      'forged',
    );
  });

  it('body 中的 tenantId、健康字段、provider result 或凭证字段会被拒绝并写 parser failure audit', async () => {
    const forbiddenPayloads = [
      { tenantId: 'forged-tenant' },
      { healthStatus: 'healthy' },
      { checkedAt: '2026-06-07T09:30:00.000Z' },
      { lastErrorCode: 'provider_timeout' },
      { providerResult: { ok: true } },
      { credentialRef: 'cred_ref_should_not_pass' },
      { endpoint: 'https://external.example.test' },
      { scenario: 'fake_timeout' },
    ];

    for (const payload of forbiddenPayloads) {
      routeMocks.testHisConnectionForTenantService.mockClear();
      routeMocks.auditEventRepository.record.mockClear();

      const response = await hisConnectionTestConnectionPost(
        testConnectionRequest(payload),
        routeContext(),
      );
      const body = await expectJson(response);

      expect(response.status).toBe(400);
      expect(body).toEqual({
        code: 'validation_failed',
        error: '请求格式不正确',
      });
      expect(routeMocks.testHisConnectionForTenantService).not.toHaveBeenCalled();
      expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(1);
      expectTestConnectionRouteDeniedAuditEvent(
        routeMocks.auditEventRepository.record.mock.calls[0]?.[0],
        {
          actorId: 'demo-user-admin',
          actorRole: 'tenant_admin',
          tenantId: 'demo-tenant-001',
          reason: 'invalid_his_connection_payload',
          resourceId: 'his_conn_001',
        },
      );
      expect(JSON.stringify(routeMocks.auditEventRepository.record.mock.calls[0]?.[0])).not.toContain(
        JSON.stringify(payload),
      );
      expectNoSensitiveRoutePayload(body);
    }
  });

  it('route denied 或 parser failure audit 写入失败时返回 503，且不调用 service 或泄露异常', async () => {
    routeMocks.auditEventRepository.record.mockRejectedValueOnce(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost stack'),
    );
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantOperatorContext);

    const deniedResponse = await hisConnectionTestConnectionPost(
      requestWithJsonSpy(),
      routeContext(),
    );
    const deniedPayload = await expectJson(deniedResponse);

    expect(deniedResponse.status).toBe(503);
    expect(deniedPayload).toEqual({
      code: 'service_unavailable',
      error: '数据服务暂时不可用',
    });
    expect(routeMocks.testHisConnectionForTenantService).not.toHaveBeenCalled();
    expectNoSensitiveRoutePayload(deniedPayload);

    routeMocks.auditEventRepository.record.mockReset();
    routeMocks.auditEventRepository.record.mockRejectedValueOnce(
      new Error('audit insert failed credentialRef=cred_ref DATABASE_URL stack'),
    );

    const parserResponse = await hisConnectionTestConnectionPost(
      testConnectionRequest({ credentialRef: 'cred_ref_should_not_pass' }),
      routeContext(),
    );
    const parserPayload = await expectJson(parserResponse);

    expect(parserResponse.status).toBe(503);
    expect(parserPayload).toEqual({
      code: 'service_unavailable',
      error: '数据服务暂时不可用',
    });
    expect(routeMocks.testHisConnectionForTenantService).not.toHaveBeenCalled();
    expectNoSensitiveRoutePayload(parserPayload);
  });

  it('service result 映射为稳定 HTTP / DTO，且不重复写 route audit', async () => {
    const cases = [
      {
        result: {
          status: 'tested',
          dto: {
            ok: false,
            code: 'missing_credential',
            error: '连接测试未通过，请检查配置或稍后重试',
            healthStatus: 'failed',
            checkedAt: '2026-06-07T09:31:00.000Z',
          },
        },
        status: 200,
        code: 'missing_credential',
      },
      { result: { status: 'not_found' }, status: 404, code: 'not_found' },
      { result: { status: 'validation_failed' }, status: 400, code: 'validation_failed' },
      {
        result: {
          status: 'connection_not_active',
          dto: {
            ok: false,
            code: 'connection_not_active',
            error: '当前连接状态不允许测试',
            healthStatus: 'unknown',
          },
        },
        status: 409,
        code: 'connection_not_active',
      },
      { result: { status: 'service_unavailable' }, status: 503, code: 'service_unavailable' },
    ];

    for (const routeCase of cases) {
      routeMocks.testHisConnectionForTenantService.mockResolvedValueOnce(routeCase.result);

      const response = await hisConnectionTestConnectionPost(testConnectionRequest(), routeContext());
      const body = await expectJson(response);

      expect(response.status).toBe(routeCase.status);
      expect(body).toMatchObject({ code: routeCase.code });
      expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
      expectNoSensitiveRoutePayload(body);
    }
  });
});
