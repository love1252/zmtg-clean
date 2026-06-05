import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as credentialClearPost } from '@/app/api/institution/his-connections/[connectionId]/credentials/clear/route';
import { POST as credentialRevokePost } from '@/app/api/institution/his-connections/[connectionId]/credentials/revoke/route';
import { POST as credentialRotatePost } from '@/app/api/institution/his-connections/[connectionId]/credentials/rotate/route';
import {
  PATCH as credentialUpdatePatch,
  POST as credentialCreatePost,
} from '@/app/api/institution/his-connections/[connectionId]/credentials/route';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { AccessContext } from '@/modules/security/domain/access-control';
import type { TenantDatabase } from '@/server/db/client';

const routeMocks = vi.hoisted(() => {
  const auditEventRepository = {
    record: vi.fn(),
  };
  const credentialStorage = {
    storeSyntheticCredentialReference: vi.fn(),
  };
  const database = {
    transaction: vi.fn(),
  };

  return {
    auditEventRepository,
    createAuditEventRepository: vi.fn(() => auditEventRepository),
    createHisConnectionCredentialForTenantService: vi.fn(),
    createInMemoryHisConnectionCredentialStorage: vi.fn(() => credentialStorage),
    credentialStorage,
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    updateHisConnectionCredentialForTenantService: vi.fn(),
    rotateHisConnectionCredentialForTenantService: vi.fn(),
    clearHisConnectionCredentialForTenantService: vi.fn(),
    revokeHisConnectionCredentialForTenantService: vi.fn(),
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

vi.mock(
  '@/modules/institution/server/his-connection-credential-storage',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/modules/institution/server/his-connection-credential-storage')
    >();
    return {
      ...actual,
      createInMemoryHisConnectionCredentialStorage:
        routeMocks.createInMemoryHisConnectionCredentialStorage,
    };
  },
);

vi.mock('@/modules/institution/server/his-connection-credential-service', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/his-connection-credential-service')
  >();
  return {
    ...actual,
    createHisConnectionCredentialForTenantService:
      routeMocks.createHisConnectionCredentialForTenantService,
    updateHisConnectionCredentialForTenantService:
      routeMocks.updateHisConnectionCredentialForTenantService,
    rotateHisConnectionCredentialForTenantService:
      routeMocks.rotateHisConnectionCredentialForTenantService,
    clearHisConnectionCredentialForTenantService:
      routeMocks.clearHisConnectionCredentialForTenantService,
    revokeHisConnectionCredentialForTenantService:
      routeMocks.revokeHisConnectionCredentialForTenantService,
  };
});

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

const validMutationPayload = {
  credentialType: 'api_key',
  syntheticPlaceholder: 'synthetic_placeholder_route_demo',
  idempotencyKey: 'idem_route_demo',
  reasonCode: 'operator_update',
};

const validReasonPayload = {
  reasonCode: 'operator_clear',
};

function routeContext(connectionId = 'his_conn_001') {
  return {
    params: Promise.resolve({ connectionId }),
  };
}

function jsonRequest(payload: unknown, method = 'POST') {
  return new Request(
    'http://localhost/api/institution/his-connections/his_conn_001/credentials?tenantId=forged',
    {
      method,
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': 'forged-tenant',
      },
      body: JSON.stringify(payload),
    },
  );
}

function requestWithJsonSpy() {
  return {
    json: vi.fn(async () => {
      throw new Error('body should not be read before permission passes');
    }),
  } as unknown as Request & { json: ReturnType<typeof vi.fn> };
}

async function expectJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function expectNoCredentialRouteSensitiveData(payload: unknown) {
  expect(JSON.stringify(payload)).not.toMatch(
    /requestBody|responseBody|credentialRef|credential_ref|idempotencyKey|idem_route_demo|synthetic_placeholder_route_demo|sk_live|sk_test|token|secret|apiKey|api_key|API key|connectionString|connection string|rawCredential|raw_credential|rawPayload|raw HIS payload|externalSecretPath|DATABASE_URL|postgres:\/\/|select \* from|SQL|stack/i,
  );
}

function expectRouteDeniedAuditEvent(input: {
  event: TenantAuditEvent;
  reason: TenantAuditEvent['reason'];
  connectionId?: string;
}) {
  expect(input.event).toMatchObject({
    actorId: 'demo-user-admin',
    actorRole: 'tenant_admin',
    tenantId: 'demo-tenant-001',
    resource: 'open_connection',
    action: 'manage_credentials',
    result: 'denied',
    reason: input.reason,
    source: 'demo_session',
    ...(input.connectionId === undefined ? {} : { resourceId: input.connectionId }),
  });
  expectNoCredentialRouteSensitiveData(input.event);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  routeMocks.auditEventRepository.record.mockReset();
  routeMocks.auditEventRepository.record.mockResolvedValue(undefined);
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.createHisConnectionCredentialForTenantService.mockReset();
  routeMocks.updateHisConnectionCredentialForTenantService.mockReset();
  routeMocks.rotateHisConnectionCredentialForTenantService.mockReset();
  routeMocks.clearHisConnectionCredentialForTenantService.mockReset();
  routeMocks.revokeHisConnectionCredentialForTenantService.mockReset();
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database as unknown as TenantDatabase);
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
  routeMocks.createHisConnectionCredentialForTenantService.mockResolvedValue({
    status: 'created',
    dto: { ok: true, credentialConfigured: true },
  });
  routeMocks.updateHisConnectionCredentialForTenantService.mockResolvedValue({
    status: 'updated',
    dto: { ok: true, credentialConfigured: true },
  });
  routeMocks.rotateHisConnectionCredentialForTenantService.mockResolvedValue({
    status: 'rotated',
    dto: { ok: true, credentialConfigured: true },
  });
  routeMocks.clearHisConnectionCredentialForTenantService.mockResolvedValue({
    status: 'cleared',
    dto: { ok: true, credentialConfigured: false },
  });
  routeMocks.revokeHisConnectionCredentialForTenantService.mockResolvedValue({
    status: 'revoked',
    dto: { ok: true, credentialConfigured: false },
  });
});

describe('HIS 连接配置凭证 API route 权限与审计最小边界', () => {
  it('空 connectionId 返回 404，且不读取 session、body 或写 route audit', async () => {
    const request = requestWithJsonSpy();

    const response = await credentialCreatePost(request, routeContext('   '));

    expect(response.status).toBe(404);
    await expect(expectJson(response)).resolves.toMatchObject({ code: 'not_found' });
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(request.json).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
    expect(routeMocks.createHisConnectionCredentialForTenantService).not.toHaveBeenCalled();
  });

  it('未登录返回 401，且不写 route audit、不读取 body、不调用 service', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
    const request = requestWithJsonSpy();

    const response = await credentialCreatePost(request, routeContext());

    expect(response.status).toBe(401);
    await expect(expectJson(response)).resolves.toMatchObject({ code: 'unauthorized' });
    expect(request.json).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
    expect(routeMocks.createHisConnectionCredentialForTenantService).not.toHaveBeenCalled();
  });

  it('tenant_admin 具备 manage_credentials 权限，create route 调用 create service 并返回最小 DTO', async () => {
    const response = await credentialCreatePost(jsonRequest(validMutationPayload), routeContext());

    expect(response.status).toBe(201);
    await expect(expectJson(response)).resolves.toEqual({
      ok: true,
      credentialConfigured: true,
    });
    expect(routeMocks.createHisConnectionCredentialForTenantService).toHaveBeenCalledWith(
      expect.objectContaining({
        accessContext: tenantContext,
        connectionId: 'his_conn_001',
        database: routeMocks.database,
        credentialInput: validMutationPayload,
        credentialStorage: routeMocks.credentialStorage,
        auditEventRepositoryFactory: routeMocks.createAuditEventRepository,
      }),
    );
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
  });

  it('update / rotate / clear / revoke route 调用对应 service 并返回最小 DTO', async () => {
    const cases = [
      {
        call: () => credentialUpdatePatch(jsonRequest(validMutationPayload, 'PATCH'), routeContext()),
        service: routeMocks.updateHisConnectionCredentialForTenantService,
        expectedStatus: 200,
        expectedBody: { ok: true, credentialConfigured: true },
        expectedInput: validMutationPayload,
      },
      {
        call: () => credentialRotatePost(jsonRequest(validMutationPayload), routeContext()),
        service: routeMocks.rotateHisConnectionCredentialForTenantService,
        expectedStatus: 200,
        expectedBody: { ok: true, credentialConfigured: true },
        expectedInput: validMutationPayload,
      },
      {
        call: () => credentialClearPost(jsonRequest(validReasonPayload), routeContext()),
        service: routeMocks.clearHisConnectionCredentialForTenantService,
        expectedStatus: 200,
        expectedBody: { ok: true, credentialConfigured: false },
        expectedInput: validReasonPayload,
      },
      {
        call: () => credentialRevokePost(jsonRequest(validReasonPayload), routeContext()),
        service: routeMocks.revokeHisConnectionCredentialForTenantService,
        expectedStatus: 200,
        expectedBody: { ok: true, credentialConfigured: false },
        expectedInput: validReasonPayload,
      },
    ] as const;

    for (const routeCase of cases) {
      const response = await routeCase.call();

      expect(response.status).toBe(routeCase.expectedStatus);
      await expect(expectJson(response)).resolves.toEqual(routeCase.expectedBody);
      expect(routeCase.service).toHaveBeenCalledWith(
        expect.objectContaining({
          accessContext: tenantContext,
          connectionId: 'his_conn_001',
          database: routeMocks.database,
          credentialInput: routeCase.expectedInput,
          auditEventRepositoryFactory: routeMocks.createAuditEventRepository,
        }),
      );
    }
  });

  it('非凭证管理权限不可替代 manage_credentials，权限拒绝不读取 body、不调用 service，并写 denied audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantOperatorContext);
    const request = requestWithJsonSpy();

    const response = await credentialCreatePost(request, routeContext());

    expect(response.status).toBe(403);
    await expect(expectJson(response)).resolves.toMatchObject({ code: 'forbidden' });
    expect(request.json).not.toHaveBeenCalled();
    expect(routeMocks.createHisConnectionCredentialForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(1);
    const event = routeMocks.auditEventRepository.record.mock.calls[0][0] as TenantAuditEvent;
    expect(event).toMatchObject({
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'manage_credentials',
      result: 'denied',
      reason: 'role_denied',
    });
    expect(event.action).not.toBe('read_own_tenant');
    expect(event.action).not.toBe('update');
    expect(event.action).not.toBe('manage_status');
  });

  it('平台管理员默认不能代管凭证写入', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(platformContext);

    const response = await credentialCreatePost(jsonRequest(validMutationPayload), routeContext());

    expect(response.status).toBe(403);
    expect(routeMocks.createHisConnectionCredentialForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(1);
  });

  it('权限拒绝 route audit 失败时 fail closed 为 503', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantOperatorContext);
    routeMocks.auditEventRepository.record.mockRejectedValue(new Error('audit unavailable'));

    const response = await credentialCreatePost(requestWithJsonSpy(), routeContext());

    expect(response.status).toBe(503);
    await expect(expectJson(response)).resolves.toMatchObject({ code: 'service_unavailable' });
    expect(routeMocks.createHisConnectionCredentialForTenantService).not.toHaveBeenCalled();
  });

  it('parser failure 拒绝敏感和越权字段，不调用 service，写 denied audit 且不回显输入', async () => {
    const invalidPayloads = [
      { ...validMutationPayload, tenantId: 'other-tenant' },
      { ...validMutationPayload, credentialRef: 'cred_ref_should_not_pass' },
      { ...validMutationPayload, credentialConfigured: true },
      { ...validMutationPayload, status: 'active' },
      { ...validMutationPayload, healthStatus: 'healthy' },
      { ...validMutationPayload, rawHisPayload: { patient: 'raw HIS payload' } },
      { ...validMutationPayload, externalSecretPath: '/vault/his/secret' },
      { ...validMutationPayload, token: 'sk_test_should_not_pass' },
      { ...validMutationPayload, secret: 'client_secret_should_not_pass' },
      { ...validMutationPayload, apiKey: 'api key should not pass' },
      { ...validMutationPayload, connectionString: 'postgres://user:secret@localhost/db' },
      { ...validMutationPayload, reasonCode: 'raw_credential' },
    ];

    for (const payload of invalidPayloads) {
      routeMocks.auditEventRepository.record.mockClear();
      routeMocks.createHisConnectionCredentialForTenantService.mockClear();

      const response = await credentialCreatePost(jsonRequest(payload), routeContext());

      expect(response.status).toBe(400);
      const body = await expectJson(response);
      expect(body).toMatchObject({ code: 'validation_failed' });
      expectNoCredentialRouteSensitiveData(body);
      expect(routeMocks.createHisConnectionCredentialForTenantService).not.toHaveBeenCalled();
      expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(1);
      const event = routeMocks.auditEventRepository.record.mock.calls[0][0] as TenantAuditEvent;
      expectRouteDeniedAuditEvent({
        event,
        reason: 'invalid_his_connection_payload',
        connectionId: 'his_conn_001',
      });
    }
  });

  it('parser failure route audit 失败时 fail closed 为 503', async () => {
    routeMocks.auditEventRepository.record.mockRejectedValue(new Error('audit unavailable'));

    const response = await credentialCreatePost(
      jsonRequest({ ...validMutationPayload, credentialRef: 'cred_ref_should_not_pass' }),
      routeContext(),
    );

    expect(response.status).toBe(503);
    await expect(expectJson(response)).resolves.toMatchObject({ code: 'service_unavailable' });
    expect(routeMocks.createHisConnectionCredentialForTenantService).not.toHaveBeenCalled();
  });

  it('service failure 映射稳定 HTTP / DTO，且不重复写 route audit', async () => {
    const cases = [
      { serviceStatus: 'not_found', httpStatus: 404, code: 'not_found' },
      {
        serviceStatus: 'invalid_state_transition',
        httpStatus: 409,
        code: 'invalid_state_transition',
      },
      { serviceStatus: 'service_unavailable', httpStatus: 503, code: 'service_unavailable' },
      { serviceStatus: 'validation_failed', httpStatus: 400, code: 'validation_failed' },
    ] as const;

    for (const routeCase of cases) {
      routeMocks.createHisConnectionCredentialForTenantService.mockResolvedValueOnce({
        status: routeCase.serviceStatus,
      });
      routeMocks.auditEventRepository.record.mockClear();

      const response = await credentialCreatePost(jsonRequest(validMutationPayload), routeContext());

      expect(response.status).toBe(routeCase.httpStatus);
      const body = await expectJson(response);
      expect(body).toMatchObject({ code: routeCase.code });
      expectNoCredentialRouteSensitiveData(body);
      expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
    }
  });

  it('route 不调用真实 HIS、测试连接或 secret manager，也不使用 query/header/localStorage tenantId', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const localStorage = {
      clear: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorage);

    const response = await credentialCreatePost(jsonRequest(validMutationPayload), routeContext());

    expect(response.status).toBe(201);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(routeMocks.createHisConnectionCredentialForTenantService).toHaveBeenCalledWith(
      expect.objectContaining({
        accessContext: expect.objectContaining({
          tenantId: 'demo-tenant-001',
        }),
      }),
    );
  });
});
