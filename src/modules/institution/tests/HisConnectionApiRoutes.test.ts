import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DELETE as hisConnectionSoftDeleteDelete,
  GET as hisConnectionDetailGet,
  PATCH as hisConnectionUpdatePatch,
} from '@/app/api/institution/his-connections/[connectionId]/route';
import { POST as hisConnectionPausePost } from '@/app/api/institution/his-connections/[connectionId]/pause/route';
import { POST as hisConnectionResumePost } from '@/app/api/institution/his-connections/[connectionId]/resume/route';
import { POST as hisConnectionRevokePost } from '@/app/api/institution/his-connections/[connectionId]/revoke/route';
import {
  GET as hisConnectionListGet,
  POST as hisConnectionCreatePost,
} from '@/app/api/institution/his-connections/route';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import type { HisConnectionReadModel } from '@/modules/institution/server/his-connection-repository';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
  const auditEventRepository = {
    record: vi.fn(),
  };
  const hisConnectionRepository = {
    getHisConnectionByTenant: vi.fn(),
    listHisConnectionsByTenant: vi.fn(),
  };
  const database = {
    delete: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
    update: vi.fn(),
  };

  return {
    auditEventRepository,
    createAuditEventRepository: vi.fn(() => auditEventRepository),
    createHisConnectionForTenantService: vi.fn(),
    createHisConnectionRepository: vi.fn(() => hisConnectionRepository),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    hisConnectionRepository,
    pauseHisConnectionForTenantService: vi.fn(),
    resumeHisConnectionForTenantService: vi.fn(),
    revokeHisConnectionForTenantService: vi.fn(),
    softDeleteHisConnectionForTenantService: vi.fn(),
    updateHisConnectionForTenantService: vi.fn(),
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

vi.mock('@/modules/institution/server/his-connection-repository', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/his-connection-repository')
  >();
  return {
    ...actual,
    createHisConnectionRepository: routeMocks.createHisConnectionRepository,
  };
});

vi.mock('@/modules/institution/server/his-connection-write-service', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/his-connection-write-service')
  >();
  return {
    ...actual,
    createHisConnectionForTenantService: routeMocks.createHisConnectionForTenantService,
    updateHisConnectionForTenantService: routeMocks.updateHisConnectionForTenantService,
  };
});

vi.mock('@/modules/institution/server/his-connection-status-service', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/modules/institution/server/his-connection-status-service')
  >();
  return {
    ...actual,
    pauseHisConnectionForTenantService: routeMocks.pauseHisConnectionForTenantService,
    resumeHisConnectionForTenantService: routeMocks.resumeHisConnectionForTenantService,
    revokeHisConnectionForTenantService: routeMocks.revokeHisConnectionForTenantService,
    softDeleteHisConnectionForTenantService: routeMocks.softDeleteHisConnectionForTenantService,
  };
});

const tenantContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
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

const tenantOperatorContext: AccessContext = {
  userId: 'demo-user-operator',
  role: 'tenant_operator',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

const tenantAdminWithoutTenantContext: AccessContext = {
  ...tenantContext,
  tenantId: null,
};

const hisConnectionRecord = {
  connectionId: 'his_conn_001',
  tenantId: 'demo-tenant-001',
  connectionName: '星澜 HIS 只读连接',
  sourceSystem: 'his',
  vendorType: 'demo_vendor',
  systemType: 'his',
  status: 'active',
  credentialConfigured: true,
  healthStatus: 'healthy',
  lastCheckedAt: '2026-06-03T08:30:00.000Z',
  lastErrorCode: null,
  createdAt: '2026-06-03T08:00:00.000Z',
  updatedAt: '2026-06-03T08:20:00.000Z',
  revokedAt: null,
  deletedAt: null,
} satisfies HisConnectionReadModel;

const draftHisConnectionRecord = {
  ...hisConnectionRecord,
  connectionId: 'his_conn_draft',
  connectionName: '草稿连接',
  status: 'draft',
  credentialConfigured: false,
  healthStatus: 'unknown',
  lastCheckedAt: null,
  createdAt: '2026-06-03T08:05:00.000Z',
  updatedAt: '2026-06-03T08:05:00.000Z',
} satisfies HisConnectionReadModel;

const deletedHisConnectionRecord = {
  ...hisConnectionRecord,
  connectionId: 'his_conn_deleted',
  connectionName: '已软删除连接',
  status: 'deleted',
  deletedAt: '2026-06-03T09:00:00.000Z',
} satisfies HisConnectionReadModel;

const validCreatePayload = {
  connectionName: '  星澜 HIS 写入连接  ',
  sourceSystem: '  his  ',
  vendorType: '  demo_vendor  ',
  systemType: '  his  ',
};

const validUpdatePayload = {
  connectionName: '  星澜 HIS 写入连接更新  ',
  sourceSystem: '  clinic_his  ',
};

const writableCreateFields = [
  'connectionName',
  'sourceSystem',
  'vendorType',
  'systemType',
] as const;

const forbiddenWritePayloadFields = [
  'credentialRef',
  'token',
  'secret',
  'apiKey',
  'rawPayload',
  'requestBody',
  'responseBody',
  'SQL',
  'stack',
  'DATABASE_URL',
] as const;

function listRequest(url = 'http://localhost/api/institution/his-connections') {
  return new Request(url, {
    method: 'GET',
    headers: {
      'x-tenant-id': 'other-tenant-should-not-be-trusted',
      'x-his-tenant-id': 'other-his-tenant-should-not-be-trusted',
    },
  });
}

function createRequest(
  payload: unknown = validCreatePayload,
  url = 'http://localhost/api/institution/his-connections?tenantId=demo-tenant-002',
) {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': 'other-tenant-should-not-be-trusted',
      'x-his-tenant-id': 'other-his-tenant-should-not-be-trusted',
    },
    body: JSON.stringify(payload),
  });
}

function createRawRequest(rawBody: string) {
  return new Request('http://localhost/api/institution/his-connections', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': 'other-tenant-should-not-be-trusted',
    },
    body: rawBody,
  });
}

function detailRequest(
  url = 'http://localhost/api/institution/his-connections/his_conn_001',
) {
  return new Request(url, {
    method: 'GET',
    headers: {
      'x-tenant-id': 'other-tenant-should-not-be-trusted',
      'x-his-tenant-id': 'other-his-tenant-should-not-be-trusted',
    },
  });
}

function updateRequest(
  payload: unknown = validUpdatePayload,
  url = 'http://localhost/api/institution/his-connections/his_conn_001?tenantId=demo-tenant-002',
) {
  return new Request(url, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': 'other-tenant-should-not-be-trusted',
      'x-his-tenant-id': 'other-his-tenant-should-not-be-trusted',
    },
    body: JSON.stringify(payload),
  });
}

function updateRawRequest(rawBody: string) {
  return new Request('http://localhost/api/institution/his-connections/his_conn_001', {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': 'other-tenant-should-not-be-trusted',
    },
    body: rawBody,
  });
}

function statusRequest(
  payload: unknown = { reasonCode: '  manual_status_change  ' },
  url = 'http://localhost/api/institution/his-connections/his_conn_001/pause?tenantId=demo-tenant-002',
  method = 'POST',
) {
  return new Request(url, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': 'other-tenant-should-not-be-trusted',
      'x-his-tenant-id': 'other-his-tenant-should-not-be-trusted',
    },
    body: JSON.stringify(payload),
  });
}

function statusEmptyBodyRequest(
  url = 'http://localhost/api/institution/his-connections/his_conn_001/pause?tenantId=demo-tenant-002',
  method = 'POST',
) {
  return new Request(url, {
    method,
    headers: {
      'x-tenant-id': 'other-tenant-should-not-be-trusted',
      'x-his-tenant-id': 'other-his-tenant-should-not-be-trusted',
    },
  });
}

function statusRawRequest(
  rawBody: string,
  url = 'http://localhost/api/institution/his-connections/his_conn_001/pause',
  method = 'POST',
) {
  return new Request(url, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-id': 'other-tenant-should-not-be-trusted',
    },
    body: rawBody,
  });
}

function detailContext(connectionId = 'his_conn_001') {
  return { params: Promise.resolve({ connectionId }) };
}

function expectNoHisPrivateData(payload: unknown) {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain('tenantId');
  expect(serialized).not.toContain('demo-tenant-002');
  expect(serialized).not.toContain('deletedAt');
  expect(serialized).not.toContain('credentialRef');
  expect(serialized).not.toContain('credential_ref');
  expect(serialized).not.toContain('cred_ref_internal_only');
  expect(serialized).not.toMatch(/token|secret|apiKey|api_key|oauth|basicAuth|basic_auth/i);
  expect(serialized).not.toMatch(/signingKey|signing_key|privateKey|private_key/i);
  expect(serialized).not.toMatch(/connectionString|connection_string|postgres:\/\//i);
  expect(serialized).not.toMatch(/rawPayload|raw_payload|requestBody|request_body/i);
  expect(serialized).not.toMatch(/responseBody|response_body|external response body/i);
  expect(serialized).not.toContain('完整治疗正文');
  expect(serialized).not.toContain('完整病历正文');
  expect(serialized).not.toContain('咨询全文');
  expect(serialized).not.toContain('图片 / 文件原文');
  expect(serialized).not.toContain('imageOriginal');
  expect(serialized).not.toContain('fileOriginal');
  expect(serialized).not.toMatch(/select \* from|DATABASE_URL|stack/i);
}

function expectNoRouteAuditSensitiveData(event: unknown) {
  const serialized = JSON.stringify(event);

  expect(serialized).not.toContain('demo-tenant-002');
  expect(serialized).not.toContain('other-tenant-should-not-be-trusted');
  expect(serialized).not.toMatch(
    /credentialRef|credentialConfigured|token|secret|apiKey|api_key|oauth|basicAuth|basic_auth|signingKey|signing_key|privateKey|private_key|connectionString|connection_string|rawPayload|raw_payload|requestBody|request_body|responseBody|response_body|DATABASE_URL|postgres:\/\/|select \* from|SQL|stack|constraint|index|冲突行详情|完整病历|完整治疗正文|咨询全文|图片 \/ 文件原文|imageOriginal|fileOriginal/i,
  );
}

function expectRouteDeniedAuditEvent(
  event: unknown,
  input: {
    actorId: string;
    actorRole: AccessContext['role'];
    tenantId: string | null;
    action: 'create' | 'update' | 'manage_status' | 'delete';
    reason:
      | 'role_denied'
      | 'missing_tenant'
      | 'cross_tenant_denied'
      | 'invalid_his_connection_payload';
    resourceId?: string;
  },
) {
  const eventRecord = event as TenantAuditEvent;
  const expectedKeys = [
    'eventId',
    'actorId',
    'actorRole',
    'tenantId',
    'scope',
    'resource',
    'action',
    'result',
    'reason',
    'occurredAt',
    'source',
  ];

  if (input.resourceId !== undefined) {
    expectedKeys.push('resourceId');
  }

  expect(Object.keys(eventRecord).sort()).toEqual(expectedKeys.sort());
  expect(eventRecord).toMatchObject({
    actorId: input.actorId,
    actorRole: input.actorRole,
    tenantId: input.tenantId,
    scope: 'tenant',
    source: 'demo_session',
    resource: 'open_connection',
    action: input.action,
    result: 'denied',
    reason: input.reason,
    occurredAt: expect.any(String),
  });
  expect(eventRecord.eventId).toEqual(expect.any(String));

  if (input.resourceId === undefined) {
    expect(eventRecord).not.toHaveProperty('resourceId');
  } else {
    expect(eventRecord.resourceId).toBe(input.resourceId);
  }

  expectNoRouteAuditSensitiveData(eventRecord);
}

async function expectValidationFailedResponse(response: Response) {
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload).toEqual({
    code: 'validation_failed',
    error: '请求格式不正确',
  });
  expectNoHisPrivateData(payload);

  return payload;
}

beforeEach(() => {
  routeMocks.auditEventRepository.record.mockReset();
  routeMocks.auditEventRepository.record.mockResolvedValue(undefined);
  routeMocks.createAuditEventRepository.mockClear();
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.database.delete.mockReset();
  routeMocks.database.insert.mockReset();
  routeMocks.database.transaction.mockReset();
  routeMocks.database.update.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.createHisConnectionForTenantService.mockReset();
  routeMocks.createHisConnectionForTenantService.mockResolvedValue({
    status: 'created',
    dto: { ok: true },
  });
  routeMocks.createHisConnectionRepository.mockClear();
  routeMocks.hisConnectionRepository.getHisConnectionByTenant.mockReset();
  routeMocks.hisConnectionRepository.getHisConnectionByTenant.mockResolvedValue(hisConnectionRecord);
  routeMocks.hisConnectionRepository.listHisConnectionsByTenant.mockReset();
  routeMocks.hisConnectionRepository.listHisConnectionsByTenant.mockResolvedValue([
    hisConnectionRecord,
    draftHisConnectionRecord,
  ]);
  routeMocks.updateHisConnectionForTenantService.mockReset();
  routeMocks.updateHisConnectionForTenantService.mockResolvedValue({
    status: 'updated',
    dto: { ok: true },
  });
  routeMocks.pauseHisConnectionForTenantService.mockReset();
  routeMocks.pauseHisConnectionForTenantService.mockResolvedValue({
    status: 'paused',
    dto: { ok: true },
  });
  routeMocks.resumeHisConnectionForTenantService.mockReset();
  routeMocks.resumeHisConnectionForTenantService.mockResolvedValue({
    status: 'resumed',
    dto: { ok: true },
  });
  routeMocks.revokeHisConnectionForTenantService.mockReset();
  routeMocks.revokeHisConnectionForTenantService.mockResolvedValue({
    status: 'revoked',
    dto: { ok: true },
  });
  routeMocks.softDeleteHisConnectionForTenantService.mockReset();
  routeMocks.softDeleteHisConnectionForTenantService.mockResolvedValue({
    status: 'deleted',
    dto: { ok: true },
  });
});

describe('机构端 HIS 连接配置只读 API route', () => {
  it('list API 只按 access context 租户列出连接配置并返回安全 DTO', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await hisConnectionListGet(
      listRequest('http://localhost/api/institution/his-connections?tenantId=demo-tenant-002'),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      records: [
        {
          connectionId: 'his_conn_001',
          connectionName: '星澜 HIS 只读连接',
          sourceSystem: 'his',
          vendorType: 'demo_vendor',
          systemType: 'his',
          status: 'active',
          credentialConfigured: true,
          healthStatus: 'healthy',
          lastCheckedAt: '2026-06-03T08:30:00.000Z',
          lastErrorCode: null,
          createdAt: '2026-06-03T08:00:00.000Z',
          updatedAt: '2026-06-03T08:20:00.000Z',
          revokedAt: null,
        },
        {
          connectionId: 'his_conn_draft',
          connectionName: '草稿连接',
          sourceSystem: 'his',
          vendorType: 'demo_vendor',
          systemType: 'his',
          status: 'draft',
          credentialConfigured: false,
          healthStatus: 'unknown',
          lastCheckedAt: null,
          lastErrorCode: null,
          createdAt: '2026-06-03T08:05:00.000Z',
          updatedAt: '2026-06-03T08:05:00.000Z',
          revokedAt: null,
        },
      ],
    });
    expect(routeMocks.hisConnectionRepository.listHisConnectionsByTenant).toHaveBeenCalledWith(
      'demo-tenant-001',
    );
    expect(routeMocks.hisConnectionRepository.listHisConnectionsByTenant).not.toHaveBeenCalledWith(
      'demo-tenant-002',
    );
    expectNoHisPrivateData(payload);
  });

  it('list API 防御性过滤其他租户与软删除记录', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.hisConnectionRepository.listHisConnectionsByTenant.mockResolvedValueOnce([
      hisConnectionRecord,
      { ...hisConnectionRecord, connectionId: 'his_conn_other', tenantId: 'demo-tenant-002' },
      deletedHisConnectionRecord,
    ]);

    const response = await hisConnectionListGet(listRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.records).toHaveLength(1);
    expect(payload.records[0].connectionId).toBe('his_conn_001');
    expectNoHisPrivateData(payload);
  });

  it('list API 不接受 header 中的 tenantId 作为可信租户', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    await hisConnectionListGet(listRequest());

    expect(routeMocks.hisConnectionRepository.listHisConnectionsByTenant).toHaveBeenCalledWith(
      'demo-tenant-001',
    );
    expect(routeMocks.hisConnectionRepository.listHisConnectionsByTenant).not.toHaveBeenCalledWith(
      'other-tenant-should-not-be-trusted',
    );
  });

  it('detail API 必须使用 tenantId + connectionId 并返回安全 DTO', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await hisConnectionDetailGet(detailRequest(), detailContext('his_conn_001'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      record: {
        connectionId: 'his_conn_001',
        connectionName: '星澜 HIS 只读连接',
        sourceSystem: 'his',
        vendorType: 'demo_vendor',
        systemType: 'his',
        status: 'active',
        credentialConfigured: true,
        healthStatus: 'healthy',
        lastCheckedAt: '2026-06-03T08:30:00.000Z',
        lastErrorCode: null,
        createdAt: '2026-06-03T08:00:00.000Z',
        updatedAt: '2026-06-03T08:20:00.000Z',
        revokedAt: null,
      },
    });
    expect(routeMocks.hisConnectionRepository.getHisConnectionByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
    });
    expectNoHisPrivateData(payload);
  });

  it('detail API 不接受 query 或 header tenantId 切换租户', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    await hisConnectionDetailGet(
      detailRequest('http://localhost/api/institution/his-connections/his_conn_001?tenantId=demo-tenant-002'),
      detailContext('his_conn_001'),
    );

    expect(routeMocks.hisConnectionRepository.getHisConnectionByTenant).toHaveBeenCalledWith({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
    });
    expect(routeMocks.hisConnectionRepository.getHisConnectionByTenant).not.toHaveBeenCalledWith({
      tenantId: 'demo-tenant-002',
      connectionId: 'his_conn_001',
    });
  });

  it('detail API 跨租户、空 ID、不存在或已软删除时返回稳定 not_found', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.hisConnectionRepository.getHisConnectionByTenant.mockResolvedValueOnce(null);

    const crossTenantResponse = await hisConnectionDetailGet(
      detailRequest(),
      detailContext('his_conn_other_tenant'),
    );
    routeMocks.hisConnectionRepository.getHisConnectionByTenant.mockResolvedValueOnce({
      ...hisConnectionRecord,
      connectionId: 'his_conn_other_tenant',
      tenantId: 'demo-tenant-002',
    });
    const defensiveCrossTenantResponse = await hisConnectionDetailGet(
      detailRequest(),
      detailContext('his_conn_other_tenant'),
    );
    routeMocks.hisConnectionRepository.getHisConnectionByTenant.mockResolvedValueOnce(
      deletedHisConnectionRecord,
    );
    const deletedResponse = await hisConnectionDetailGet(
      detailRequest(),
      detailContext('his_conn_deleted'),
    );
    const emptyIdResponse = await hisConnectionDetailGet(detailRequest(), detailContext('   '));

    expect(crossTenantResponse.status).toBe(404);
    await expect(crossTenantResponse.json()).resolves.toEqual({
      code: 'not_found',
      error: '记录不存在',
    });
    expect(defensiveCrossTenantResponse.status).toBe(404);
    await expect(defensiveCrossTenantResponse.json()).resolves.toEqual({
      code: 'not_found',
      error: '记录不存在',
    });
    expect(deletedResponse.status).toBe(404);
    await expect(deletedResponse.json()).resolves.toEqual({
      code: 'not_found',
      error: '记录不存在',
    });
    expect(emptyIdResponse.status).toBe(404);
    await expect(emptyIdResponse.json()).resolves.toEqual({
      code: 'not_found',
      error: '记录不存在',
    });
  });

  it('未登录返回 401，且不初始化数据库', async () => {
    const response = await hisConnectionListGet(listRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ code: 'unauthorized', error: '请先登录' });
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.hisConnectionRepository.listHisConnectionsByTenant).not.toHaveBeenCalled();
  });

  it('无权限或非机构上下文返回 403，且不查询 repository', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(platformContext);
    const platformResponse = await hisConnectionListGet(listRequest());

    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantOperatorContext);
    const operatorResponse = await hisConnectionListGet(listRequest());

    expect(platformResponse.status).toBe(403);
    await expect(platformResponse.json()).resolves.toEqual({
      code: 'forbidden',
      error: '没有访问权限',
    });
    expect(operatorResponse.status).toBe(403);
    await expect(operatorResponse.json()).resolves.toEqual({
      code: 'forbidden',
      error: '没有访问权限',
    });
    expect(routeMocks.hisConnectionRepository.listHisConnectionsByTenant).not.toHaveBeenCalled();
  });

  it('API 响应不包含凭证、raw payload、完整正文或内部错误细节', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.hisConnectionRepository.listHisConnectionsByTenant.mockResolvedValueOnce([
      {
        ...hisConnectionRecord,
        token: 'token_should_not_return',
        secret: 'secret_should_not_return',
        apiKey: 'sk_test_should_not_return',
        oauthToken: 'oauth_should_not_return',
        basicAuth: 'user:password',
        signingKey: 'signing_should_not_return',
        privateKey: 'private_should_not_return',
        connectionString: 'postgres://tenant:secret@localhost:5432/zmtg',
        credentialRef: 'cred_ref_internal_only',
        rawPayload: { external: true },
        requestBody: { endpoint: '/external/his' },
        responseBody: { ok: false },
        treatmentRecord: '完整治疗正文',
        medicalRecordBody: '完整病历正文',
        consultationTranscript: '咨询全文',
        imageOriginal: '<binary-image>',
        fileOriginal: '<binary-file>',
        sql: 'select * from his_connections',
        stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
      } as HisConnectionReadModel,
    ]);

    const response = await hisConnectionListGet(listRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expectNoHisPrivateData(payload);
  });

  it('数据服务异常返回稳定 503，错误态不泄露 SQL、stack、DATABASE_URL 或凭证', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.hisConnectionRepository.listHisConnectionsByTenant.mockRejectedValueOnce(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg token stack'),
    );

    const response = await hisConnectionListGet(listRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      code: 'service_unavailable',
      error: '数据服务暂时不可用',
    });
    expectNoHisPrivateData(payload);
  });

  it('API 保持只读：不写数据库、不调用外部系统、不创建摘要、任务或自动触达', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    await hisConnectionListGet(listRequest());

    expect(routeMocks.database.insert).not.toHaveBeenCalled();
    expect(routeMocks.database.update).not.toHaveBeenCalled();
    expect(routeMocks.database.delete).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('demo seed 不写入 HIS 连接配置或 credentialRef', () => {
    const seedSource = readFileSync(join(process.cwd(), 'src/server/db/seed-demo-data.ts'), 'utf8');

    expect(seedSource).not.toMatch(/hisConnections|his_connections|credentialRef|credential_ref/i);
  });
});

describe('机构端 HIS 连接配置 pause / resume 状态 API route', () => {
  it('pause 成功：使用 manage_status 权限、trim 后 path ID 和 reasonCode，并只返回最小 DTO', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await hisConnectionPausePost(
      statusRequest({ reasonCode: '  manual_pause  ' }),
      detailContext('  his_conn_001  '),
    );
    const payload = await response.json();
    const serviceInput = routeMocks.pauseHisConnectionForTenantService.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(serviceInput).toBeDefined();
    expect(Object.keys(serviceInput ?? {}).sort()).toEqual(
      ['accessContext', 'connectionId', 'database', 'reasonCode'].sort(),
    );
    expect(serviceInput).toMatchObject({
      accessContext: tenantContext,
      connectionId: 'his_conn_001',
      database: routeMocks.database,
      reasonCode: 'manual_pause',
    });
    expect(JSON.stringify(serviceInput)).not.toContain('other-tenant-should-not-be-trusted');
    expect(JSON.stringify(serviceInput)).not.toContain('demo-tenant-002');
    expect(routeMocks.resumeHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.revokeHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.softDeleteHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expectNoHisPrivateData(payload);
  });

  it('resume 成功：调用 resume service，空 body 与 {} 可通过且不传 reasonCode', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const emptyBodyResponse = await hisConnectionResumePost(
      statusEmptyBodyRequest(
        'http://localhost/api/institution/his-connections/his_conn_001/resume?tenantId=demo-tenant-002',
      ),
      detailContext('his_conn_001'),
    );
    const emptyBodyPayload = await emptyBodyResponse.json();
    const emptyBodyServiceInput = routeMocks.resumeHisConnectionForTenantService.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;

    const emptyObjectResponse = await hisConnectionResumePost(
      statusRequest(
        {},
        'http://localhost/api/institution/his-connections/his_conn_001/resume?tenantId=demo-tenant-002',
      ),
      detailContext('his_conn_001'),
    );
    const emptyObjectPayload = await emptyObjectResponse.json();
    const emptyObjectServiceInput = routeMocks.resumeHisConnectionForTenantService.mock.calls[1]?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(emptyBodyResponse.status).toBe(200);
    expect(emptyBodyPayload).toEqual({ ok: true });
    expect(Object.keys(emptyBodyServiceInput ?? {}).sort()).toEqual(
      ['accessContext', 'connectionId', 'database'].sort(),
    );
    expect(emptyBodyServiceInput).toMatchObject({
      accessContext: tenantContext,
      connectionId: 'his_conn_001',
      database: routeMocks.database,
    });
    expect(emptyObjectResponse.status).toBe(200);
    expect(emptyObjectPayload).toEqual({ ok: true });
    expect(Object.keys(emptyObjectServiceInput ?? {}).sort()).toEqual(
      ['accessContext', 'connectionId', 'database'].sort(),
    );
    expect(routeMocks.pauseHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.revokeHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.softDeleteHisConnectionForTenantService).not.toHaveBeenCalled();
    expectNoHisPrivateData(emptyBodyPayload);
    expectNoHisPrivateData(emptyObjectPayload);
  });

  it('body tenantId 注入、非白名单字段、非 string reasonCode 和 malformed JSON 返回 validation_failed 且不调用 service', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const bodyTenantResponse = await hisConnectionPausePost(
      statusRequest({ tenantId: 'demo-tenant-002', reasonCode: 'manual_pause' }),
      detailContext('his_conn_001'),
    );
    const forbiddenFieldResponse = await hisConnectionPausePost(
      statusRequest({
        reasonCode: 'manual_pause',
        credentialRef: 'cred_ref_should_not_echo',
      }),
      detailContext('his_conn_001'),
    );
    const invalidReasonResponse = await hisConnectionResumePost(
      statusRequest(
        { reasonCode: 123 },
        'http://localhost/api/institution/his-connections/his_conn_001/resume',
      ),
      detailContext('his_conn_001'),
    );
    const malformedResponse = await hisConnectionPausePost(
      statusRawRequest('{"reasonCode":"sk_test_should_not_echo"'),
      detailContext('his_conn_001'),
    );

    for (const response of [
      bodyTenantResponse,
      forbiddenFieldResponse,
      invalidReasonResponse,
      malformedResponse,
    ]) {
      const payload = await expectValidationFailedResponse(response);

      expect(JSON.stringify(payload)).not.toContain('demo-tenant-002');
      expect(JSON.stringify(payload)).not.toContain('cred_ref_should_not_echo');
      expect(JSON.stringify(payload)).not.toContain('sk_test_should_not_echo');
    }
    expect(routeMocks.pauseHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.resumeHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
  });

  it('空 connectionId 返回 404，且不读取 access context、不读取 body、不调用 service', async () => {
    const response = await hisConnectionPausePost(
      statusRawRequest('{"reasonCode":"malformed"'),
      detailContext('   '),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: 'not_found',
      error: '记录不存在',
    });
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.pauseHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.resumeHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('未登录返回 401 不写 audit；权限拒绝返回 403 并写 manage_status denied audit，且不读取 body 或调用 service', async () => {
    const unauthorizedResponse = await hisConnectionPausePost(
      statusRawRequest('{"reasonCode":"malformed"'),
      detailContext('his_conn_001'),
    );
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();

    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantOperatorContext);
    const forbiddenResponse = await hisConnectionResumePost(
      statusRawRequest('{"reasonCode":"malformed"'),
      detailContext('  his_conn_001  '),
    );
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantAdminWithoutTenantContext);
    const platformForbiddenResponse = await hisConnectionPausePost(
      statusRawRequest('{"reasonCode":"malformed"'),
      detailContext('his_conn_missing_tenant'),
    );

    expect(unauthorizedResponse.status).toBe(401);
    await expect(unauthorizedResponse.json()).resolves.toEqual({
      code: 'unauthorized',
      error: '请先登录',
    });
    expect(forbiddenResponse.status).toBe(403);
    await expect(forbiddenResponse.json()).resolves.toEqual({
      code: 'forbidden',
      error: '没有访问权限',
    });
    expect(platformForbiddenResponse.status).toBe(403);
    await expect(platformForbiddenResponse.json()).resolves.toEqual({
      code: 'forbidden',
      error: '没有访问权限',
    });
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(2);
    expectRouteDeniedAuditEvent(routeMocks.auditEventRepository.record.mock.calls[0]?.[0], {
      actorId: 'demo-user-operator',
      actorRole: 'tenant_operator',
      tenantId: 'demo-tenant-001',
      action: 'manage_status',
      reason: 'role_denied',
      resourceId: 'his_conn_001',
    });
    expectRouteDeniedAuditEvent(routeMocks.auditEventRepository.record.mock.calls[1]?.[0], {
      actorId: 'demo-user-admin',
      actorRole: 'tenant_admin',
      tenantId: null,
      action: 'manage_status',
      reason: 'missing_tenant',
      resourceId: 'his_conn_missing_tenant',
    });
    expect(routeMocks.pauseHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.resumeHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('pause 权限拒绝 audit 写入失败时返回 503，且不调用 status service 或泄露异常', async () => {
    routeMocks.auditEventRepository.record.mockRejectedValueOnce(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg audit stack'),
    );
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantOperatorContext);

    const response = await hisConnectionPausePost(
      statusRawRequest('{"reasonCode":"malformed"'),
      detailContext('his_conn_001'),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      code: 'service_unavailable',
      error: '数据服务暂时不可用',
    });
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(1);
    expectRouteDeniedAuditEvent(routeMocks.auditEventRepository.record.mock.calls[0]?.[0], {
      actorId: 'demo-user-operator',
      actorRole: 'tenant_operator',
      tenantId: 'demo-tenant-001',
      action: 'manage_status',
      reason: 'role_denied',
      resourceId: 'his_conn_001',
    });
    expectNoHisPrivateData(payload);
    expect(routeMocks.pauseHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('pause / resume 只能使用 open_connection:manage_status，read_own_tenant 或 update 不能作为状态权限', () => {
    const pauseRouteSource = readFileSync(
      join(process.cwd(), 'src/app/api/institution/his-connections/[connectionId]/pause/route.ts'),
      'utf8',
    );
    const resumeRouteSource = readFileSync(
      join(process.cwd(), 'src/app/api/institution/his-connections/[connectionId]/resume/route.ts'),
      'utf8',
    );
    const routeSource = `${pauseRouteSource}\n${resumeRouteSource}`;

    expect(routeSource).toMatch(/resource:\s*'open_connection'/);
    expect(routeSource).toMatch(/action:\s*'manage_status'/);
    expect(routeSource).not.toMatch(/action:\s*'read_own_tenant'/);
    expect(routeSource).not.toMatch(/action:\s*'update'/);
    expect(routeSource).not.toMatch(/platform_admin.*manage_status|scope:\s*'platform'/);
  });

  it('service result 映射为稳定 HTTP 响应，且错误响应不泄露敏感信息', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.pauseHisConnectionForTenantService
      .mockResolvedValueOnce({ status: 'not_found' })
      .mockResolvedValueOnce({ status: 'conflict' })
      .mockResolvedValueOnce({ status: 'invalid_transition' })
      .mockResolvedValueOnce({ status: 'validation_failed' })
      .mockResolvedValueOnce({ status: 'service_unavailable' });

    const notFoundResponse = await hisConnectionPausePost(statusRequest(), detailContext('his_conn_001'));
    const conflictResponse = await hisConnectionPausePost(statusRequest(), detailContext('his_conn_001'));
    const invalidTransitionResponse = await hisConnectionPausePost(
      statusRequest(),
      detailContext('his_conn_001'),
    );
    const validationResponse = await hisConnectionPausePost(
      statusRequest(),
      detailContext('his_conn_001'),
    );
    const unavailableResponse = await hisConnectionPausePost(
      statusRequest(),
      detailContext('his_conn_001'),
    );

    expect(notFoundResponse.status).toBe(404);
    const notFoundPayload = await notFoundResponse.json();
    expect(notFoundPayload).toEqual({
      code: 'not_found',
      error: '记录不存在',
    });
    expect(conflictResponse.status).toBe(409);
    const conflictPayload = await conflictResponse.json();
    expect(conflictPayload).toEqual({
      code: 'conflict',
      error: '当前状态不允许执行该操作',
    });
    expect(invalidTransitionResponse.status).toBe(409);
    const invalidTransitionPayload = await invalidTransitionResponse.json();
    expect(invalidTransitionPayload).toEqual({
      code: 'invalid_transition',
      error: '当前状态不允许执行该操作',
    });
    expect(validationResponse.status).toBe(400);
    const validationPayload = await validationResponse.json();
    expect(validationPayload).toEqual({
      code: 'validation_failed',
      error: '请求格式不正确',
    });
    expect(unavailableResponse.status).toBe(503);
    const unavailablePayload = await unavailableResponse.json();
    expect(unavailablePayload).toEqual({
      code: 'service_unavailable',
      error: '数据服务暂时不可用',
    });
    for (const payload of [
      notFoundPayload,
      conflictPayload,
      invalidTransitionPayload,
      validationPayload,
      unavailablePayload,
    ]) {
      expectNoHisPrivateData(payload);
    }
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
  });

  it('pause / resume route 不调用 fetch、localStorage、真实 HIS、测试连接、凭证处理、摘要、任务或自动触达', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const localStorage = {
      clear: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorage);

    await hisConnectionPausePost(statusRequest(), detailContext('his_conn_001'));
    await hisConnectionResumePost(
      statusRequest(
        {},
        'http://localhost/api/institution/his-connections/his_conn_001/resume',
      ),
      detailContext('his_conn_001'),
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(routeMocks.database.insert).not.toHaveBeenCalled();
    expect(routeMocks.database.update).not.toHaveBeenCalled();
    expect(routeMocks.database.delete).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();

    const routeSource = [
      readFileSync(
        join(process.cwd(), 'src/app/api/institution/his-connections/[connectionId]/pause/route.ts'),
        'utf8',
      ),
      readFileSync(
        join(process.cwd(), 'src/app/api/institution/his-connections/[connectionId]/resume/route.ts'),
        'utf8',
      ),
    ].join('\n');

    expect(routeSource).not.toMatch(
      /fetch\(|localStorage|真实 HIS|测试连接|机构系统|企微|\bAI\b|\bRAG\b|\bAgent\b|自动触达|treatmentSummary|treatment-summary|followUp|follow-up|follow_up|credentialRef|credentialConfigured|rawPayload|requestBody|responseBody|DATABASE_URL|select \* from|SQL|stack/i,
    );

    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('机构端 HIS 连接配置 revoke / DELETE 状态 API route', () => {
  it('revoke 成功：使用 manage_status 权限、trim 后 path ID 和 reasonCode，并只返回最小 DTO', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await hisConnectionRevokePost(
      statusRequest(
        { reasonCode: '  manual_revoke  ' },
        'http://localhost/api/institution/his-connections/his_conn_001/revoke?tenantId=demo-tenant-002',
      ),
      detailContext('  his_conn_001  '),
    );
    const payload = await response.json();
    const serviceInput = routeMocks.revokeHisConnectionForTenantService.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(serviceInput).toBeDefined();
    expect(Object.keys(serviceInput ?? {}).sort()).toEqual(
      ['accessContext', 'connectionId', 'database', 'reasonCode'].sort(),
    );
    expect(serviceInput).toMatchObject({
      accessContext: tenantContext,
      connectionId: 'his_conn_001',
      database: routeMocks.database,
      reasonCode: 'manual_revoke',
    });
    expect(JSON.stringify(serviceInput)).not.toContain('other-tenant-should-not-be-trusted');
    expect(JSON.stringify(serviceInput)).not.toContain('demo-tenant-002');
    expect(routeMocks.pauseHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.resumeHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.softDeleteHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expectNoHisPrivateData(payload);
  });

  it('DELETE 成功：使用 delete 权限、调用 softDelete service，空 body 与 {} 可通过且不传 reasonCode', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const emptyBodyResponse = await hisConnectionSoftDeleteDelete(
      statusEmptyBodyRequest(
        'http://localhost/api/institution/his-connections/his_conn_001?tenantId=demo-tenant-002',
        'DELETE',
      ),
      detailContext('his_conn_001'),
    );
    const emptyBodyPayload = await emptyBodyResponse.json();
    const emptyBodyServiceInput = routeMocks.softDeleteHisConnectionForTenantService.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;

    const emptyObjectResponse = await hisConnectionSoftDeleteDelete(
      statusRequest(
        {},
        'http://localhost/api/institution/his-connections/his_conn_001?tenantId=demo-tenant-002',
        'DELETE',
      ),
      detailContext('his_conn_001'),
    );
    const emptyObjectPayload = await emptyObjectResponse.json();
    const emptyObjectServiceInput = routeMocks.softDeleteHisConnectionForTenantService.mock.calls[1]?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(emptyBodyResponse.status).toBe(200);
    expect(emptyBodyPayload).toEqual({ ok: true });
    expect(Object.keys(emptyBodyServiceInput ?? {}).sort()).toEqual(
      ['accessContext', 'connectionId', 'database'].sort(),
    );
    expect(emptyBodyServiceInput).toMatchObject({
      accessContext: tenantContext,
      connectionId: 'his_conn_001',
      database: routeMocks.database,
    });
    expect(emptyObjectResponse.status).toBe(200);
    expect(emptyObjectPayload).toEqual({ ok: true });
    expect(Object.keys(emptyObjectServiceInput ?? {}).sort()).toEqual(
      ['accessContext', 'connectionId', 'database'].sort(),
    );
    expect(routeMocks.pauseHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.resumeHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.revokeHisConnectionForTenantService).not.toHaveBeenCalled();
    expectNoHisPrivateData(emptyBodyPayload);
    expectNoHisPrivateData(emptyObjectPayload);
  });

  it('body tenantId 注入、非白名单字段、非 string reasonCode 和 malformed JSON 返回 validation_failed 且不调用 service', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const bodyTenantResponse = await hisConnectionRevokePost(
      statusRequest(
        { tenantId: 'demo-tenant-002', reasonCode: 'manual_revoke' },
        'http://localhost/api/institution/his-connections/his_conn_001/revoke',
      ),
      detailContext('his_conn_001'),
    );
    const forbiddenFieldResponse = await hisConnectionSoftDeleteDelete(
      statusRequest(
        {
          reasonCode: 'manual_delete',
          credentialRef: 'cred_ref_delete_should_not_echo',
        },
        'http://localhost/api/institution/his-connections/his_conn_001',
        'DELETE',
      ),
      detailContext('his_conn_001'),
    );
    const invalidReasonResponse = await hisConnectionRevokePost(
      statusRequest(
        { reasonCode: 123 },
        'http://localhost/api/institution/his-connections/his_conn_001/revoke',
      ),
      detailContext('his_conn_001'),
    );
    const malformedResponse = await hisConnectionSoftDeleteDelete(
      statusRawRequest(
        '{"reasonCode":"sk_test_delete_should_not_echo"',
        'http://localhost/api/institution/his-connections/his_conn_001',
        'DELETE',
      ),
      detailContext('his_conn_001'),
    );

    for (const response of [
      bodyTenantResponse,
      forbiddenFieldResponse,
      invalidReasonResponse,
      malformedResponse,
    ]) {
      const payload = await expectValidationFailedResponse(response);

      expect(JSON.stringify(payload)).not.toContain('demo-tenant-002');
      expect(JSON.stringify(payload)).not.toContain('cred_ref_delete_should_not_echo');
      expect(JSON.stringify(payload)).not.toContain('sk_test_delete_should_not_echo');
    }
    expect(routeMocks.revokeHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.softDeleteHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
  });

  it('空 connectionId 返回 404，且不读取 access context、不读取 body、不调用 service', async () => {
    const revokeResponse = await hisConnectionRevokePost(
      statusRawRequest(
        '{"reasonCode":"malformed"',
        'http://localhost/api/institution/his-connections/his_conn_001/revoke',
      ),
      detailContext('   '),
    );
    const deleteResponse = await hisConnectionSoftDeleteDelete(
      statusRawRequest(
        '{"reasonCode":"malformed"',
        'http://localhost/api/institution/his-connections/his_conn_001',
        'DELETE',
      ),
      detailContext('   '),
    );

    for (const response of [revokeResponse, deleteResponse]) {
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        code: 'not_found',
        error: '记录不存在',
      });
    }
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.revokeHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.softDeleteHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('未登录返回 401 不写 audit；权限拒绝返回 403 并写状态 route denied audit，且不读取 body 或调用 service', async () => {
    const unauthorizedResponse = await hisConnectionRevokePost(
      statusRawRequest(
        '{"reasonCode":"malformed"',
        'http://localhost/api/institution/his-connections/his_conn_001/revoke',
      ),
      detailContext('his_conn_001'),
    );
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();

    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantOperatorContext);
    const revokeForbiddenResponse = await hisConnectionRevokePost(
      statusRawRequest(
        '{"reasonCode":"malformed"',
        'http://localhost/api/institution/his-connections/his_conn_001/revoke',
      ),
      detailContext('  his_conn_revoke  '),
    );
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantOperatorContext);
    const deleteForbiddenResponse = await hisConnectionSoftDeleteDelete(
      statusRawRequest(
        '{"reasonCode":"malformed"',
        'http://localhost/api/institution/his-connections/his_conn_001',
        'DELETE',
      ),
      detailContext('  his_conn_delete  '),
    );

    expect(unauthorizedResponse.status).toBe(401);
    await expect(unauthorizedResponse.json()).resolves.toEqual({
      code: 'unauthorized',
      error: '请先登录',
    });
    for (const response of [revokeForbiddenResponse, deleteForbiddenResponse]) {
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        code: 'forbidden',
        error: '没有访问权限',
      });
    }
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(2);
    expectRouteDeniedAuditEvent(routeMocks.auditEventRepository.record.mock.calls[0]?.[0], {
      actorId: 'demo-user-operator',
      actorRole: 'tenant_operator',
      tenantId: 'demo-tenant-001',
      action: 'manage_status',
      reason: 'role_denied',
      resourceId: 'his_conn_revoke',
    });
    expectRouteDeniedAuditEvent(routeMocks.auditEventRepository.record.mock.calls[1]?.[0], {
      actorId: 'demo-user-operator',
      actorRole: 'tenant_operator',
      tenantId: 'demo-tenant-001',
      action: 'delete',
      reason: 'role_denied',
      resourceId: 'his_conn_delete',
    });
    expect(routeMocks.revokeHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.softDeleteHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('DELETE 权限拒绝 audit 写入失败时返回 503，且不调用 status service 或泄露异常', async () => {
    routeMocks.auditEventRepository.record.mockRejectedValueOnce(
      new Error('select * from audit_events token stack constraint'),
    );
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantOperatorContext);

    const response = await hisConnectionSoftDeleteDelete(
      statusRawRequest(
        '{"reasonCode":"malformed"',
        'http://localhost/api/institution/his-connections/his_conn_001',
        'DELETE',
      ),
      detailContext('  his_conn_delete  '),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      code: 'service_unavailable',
      error: '数据服务暂时不可用',
    });
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(1);
    expectRouteDeniedAuditEvent(routeMocks.auditEventRepository.record.mock.calls[0]?.[0], {
      actorId: 'demo-user-operator',
      actorRole: 'tenant_operator',
      tenantId: 'demo-tenant-001',
      action: 'delete',
      reason: 'role_denied',
      resourceId: 'his_conn_delete',
    });
    expectNoHisPrivateData(payload);
    expect(routeMocks.softDeleteHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('revoke / DELETE 使用各自权限动作，read_own_tenant、update 或错误状态动作不能替代', () => {
    const revokeRouteSource = readFileSync(
      join(process.cwd(), 'src/app/api/institution/his-connections/[connectionId]/revoke/route.ts'),
      'utf8',
    );
    const detailRouteSource = readFileSync(
      join(process.cwd(), 'src/app/api/institution/his-connections/[connectionId]/route.ts'),
      'utf8',
    );
    const deletePermissionSource = detailRouteSource.slice(
      detailRouteSource.indexOf('function getDeleteHisConnectionDeniedReason'),
      detailRouteSource.indexOf('function isVisibleToTenant'),
    );
    const deleteHandlerSource = detailRouteSource.slice(
      detailRouteSource.indexOf('export async function DELETE'),
      detailRouteSource.indexOf('export async function PATCH'),
    );

    expect(revokeRouteSource).toMatch(/resource:\s*'open_connection'/);
    expect(revokeRouteSource).toMatch(/action:\s*'manage_status'/);
    expect(revokeRouteSource).not.toMatch(/action:\s*'read_own_tenant'/);
    expect(revokeRouteSource).not.toMatch(/action:\s*'update'/);
    expect(revokeRouteSource).not.toMatch(/action:\s*'delete'/);
    expect(deletePermissionSource).toMatch(/resource:\s*'open_connection'/);
    expect(deletePermissionSource).toMatch(/action:\s*'delete'/);
    expect(deletePermissionSource).not.toMatch(/action:\s*'read_own_tenant'/);
    expect(deletePermissionSource).not.toMatch(/action:\s*'update'/);
    expect(deletePermissionSource).not.toMatch(/action:\s*'manage_status'/);
    expect(deleteHandlerSource).toMatch(/softDeleteHisConnectionForTenantService/);
    expect(`${revokeRouteSource}\n${detailRouteSource}`).not.toMatch(
      /platform_admin.*manage_status|platform_admin.*delete|scope:\s*'platform'/,
    );
  });

  it('service result 映射为稳定 HTTP 响应，且错误响应不泄露敏感信息', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.revokeHisConnectionForTenantService
      .mockResolvedValueOnce({ status: 'not_found' })
      .mockResolvedValueOnce({ status: 'conflict' })
      .mockResolvedValueOnce({ status: 'invalid_transition' })
      .mockResolvedValueOnce({ status: 'validation_failed' })
      .mockResolvedValueOnce({ status: 'service_unavailable' });

    const notFoundResponse = await hisConnectionRevokePost(
      statusRequest({}, 'http://localhost/api/institution/his-connections/his_conn_001/revoke'),
      detailContext('his_conn_001'),
    );
    const conflictResponse = await hisConnectionRevokePost(
      statusRequest({}, 'http://localhost/api/institution/his-connections/his_conn_001/revoke'),
      detailContext('his_conn_001'),
    );
    const invalidTransitionResponse = await hisConnectionRevokePost(
      statusRequest({}, 'http://localhost/api/institution/his-connections/his_conn_001/revoke'),
      detailContext('his_conn_001'),
    );
    const validationResponse = await hisConnectionRevokePost(
      statusRequest({}, 'http://localhost/api/institution/his-connections/his_conn_001/revoke'),
      detailContext('his_conn_001'),
    );
    const unavailableResponse = await hisConnectionRevokePost(
      statusRequest({}, 'http://localhost/api/institution/his-connections/his_conn_001/revoke'),
      detailContext('his_conn_001'),
    );

    expect(notFoundResponse.status).toBe(404);
    const notFoundPayload = await notFoundResponse.json();
    expect(notFoundPayload).toEqual({
      code: 'not_found',
      error: '记录不存在',
    });
    expect(conflictResponse.status).toBe(409);
    const conflictPayload = await conflictResponse.json();
    expect(conflictPayload).toEqual({
      code: 'conflict',
      error: '当前状态不允许执行该操作',
    });
    expect(invalidTransitionResponse.status).toBe(409);
    const invalidTransitionPayload = await invalidTransitionResponse.json();
    expect(invalidTransitionPayload).toEqual({
      code: 'invalid_transition',
      error: '当前状态不允许执行该操作',
    });
    expect(validationResponse.status).toBe(400);
    const validationPayload = await validationResponse.json();
    expect(validationPayload).toEqual({
      code: 'validation_failed',
      error: '请求格式不正确',
    });
    expect(unavailableResponse.status).toBe(503);
    const unavailablePayload = await unavailableResponse.json();
    expect(unavailablePayload).toEqual({
      code: 'service_unavailable',
      error: '数据服务暂时不可用',
    });
    for (const payload of [
      notFoundPayload,
      conflictPayload,
      invalidTransitionPayload,
      validationPayload,
      unavailablePayload,
    ]) {
      expectNoHisPrivateData(payload);
    }
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
  });

  it('DELETE service result 映射为稳定 HTTP 响应', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.softDeleteHisConnectionForTenantService
      .mockResolvedValueOnce({ status: 'not_found' })
      .mockResolvedValueOnce({ status: 'conflict' })
      .mockResolvedValueOnce({ status: 'invalid_transition' })
      .mockResolvedValueOnce({ status: 'validation_failed' })
      .mockResolvedValueOnce({ status: 'service_unavailable' });

    const responses = [];
    for (let index = 0; index < 5; index += 1) {
      responses.push(
        await hisConnectionSoftDeleteDelete(
          statusRequest(
            {},
            'http://localhost/api/institution/his-connections/his_conn_001',
            'DELETE',
          ),
          detailContext('his_conn_001'),
        ),
      );
    }

    const payloads = [];
    for (const response of responses) {
      payloads.push(await response.json());
    }

    expect(responses.map((response) => response.status)).toEqual([404, 409, 409, 400, 503]);
    expect(payloads).toEqual([
      { code: 'not_found', error: '记录不存在' },
      { code: 'conflict', error: '当前状态不允许执行该操作' },
      { code: 'invalid_transition', error: '当前状态不允许执行该操作' },
      { code: 'validation_failed', error: '请求格式不正确' },
      { code: 'service_unavailable', error: '数据服务暂时不可用' },
    ]);
    for (const payload of payloads) {
      expectNoHisPrivateData(payload);
    }
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
  });

  it('revoke / DELETE route 不调用 fetch、localStorage、真实 HIS、测试连接、凭证处理、摘要、任务或自动触达', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const localStorage = {
      clear: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorage);

    await hisConnectionRevokePost(
      statusRequest({}, 'http://localhost/api/institution/his-connections/his_conn_001/revoke'),
      detailContext('his_conn_001'),
    );
    await hisConnectionSoftDeleteDelete(
      statusRequest(
        {},
        'http://localhost/api/institution/his-connections/his_conn_001',
        'DELETE',
      ),
      detailContext('his_conn_001'),
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(routeMocks.database.insert).not.toHaveBeenCalled();
    expect(routeMocks.database.update).not.toHaveBeenCalled();
    expect(routeMocks.database.delete).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();

    const detailRouteSource = readFileSync(
      join(process.cwd(), 'src/app/api/institution/his-connections/[connectionId]/route.ts'),
      'utf8',
    );
    const routeSource = [
      readFileSync(
        join(process.cwd(), 'src/app/api/institution/his-connections/[connectionId]/revoke/route.ts'),
        'utf8',
      ),
      detailRouteSource.slice(
        detailRouteSource.indexOf('export async function DELETE'),
        detailRouteSource.indexOf('export async function PATCH'),
      ),
    ].join('\n');

    expect(routeSource).not.toMatch(
      /fetch\(|localStorage|真实 HIS|测试连接|机构系统|企微|\bAI\b|\bRAG\b|\bAgent\b|自动触达|treatmentSummary|treatment-summary|followUp|follow-up|follow_up|credentialRef|credentialConfigured|rawPayload|requestBody|responseBody|DATABASE_URL|select \* from|SQL|stack/i,
    );

    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe('机构端 HIS 连接配置创建更新 API route', () => {
  it('create API 使用写入权限、parser 输出和 access context 租户，并只返回最小成功 DTO', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await hisConnectionCreatePost(createRequest());
    const payload = await response.json();
    const serviceInput = routeMocks.createHisConnectionForTenantService.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(response.status).toBe(201);
    expect(payload).toEqual({ ok: true });
    expect(serviceInput).toBeDefined();
    expect(Object.keys(serviceInput ?? {}).sort()).toEqual(
      ['accessContext', 'database', 'metadata'].sort(),
    );
    expect(serviceInput).toMatchObject({
      accessContext: tenantContext,
      database: routeMocks.database,
      metadata: {
        connectionName: '星澜 HIS 写入连接',
        sourceSystem: 'his',
        vendorType: 'demo_vendor',
        systemType: 'his',
      },
    });
    expect(Object.keys((serviceInput?.metadata as Record<string, unknown>) ?? {}).sort()).toEqual(
      [...writableCreateFields].sort(),
    );
    expect(JSON.stringify(serviceInput)).not.toContain('other-tenant-should-not-be-trusted');
    expect(JSON.stringify(serviceInput?.metadata)).not.toMatch(
      /tenantId|credentialRef|token|secret|apiKey|rawPayload|requestBody|responseBody|DATABASE_URL|select \* from|stack/i,
    );
    expectNoHisPrivateData(payload);
  });

  it('update API 使用 path connectionId、写入权限、parser 输出和 access context 租户', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const response = await hisConnectionUpdatePatch(
      updateRequest(),
      detailContext('  his_conn_001  '),
    );
    const payload = await response.json();
    const serviceInput = routeMocks.updateHisConnectionForTenantService.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(serviceInput).toBeDefined();
    expect(Object.keys(serviceInput ?? {}).sort()).toEqual(
      ['accessContext', 'connectionId', 'database', 'metadata'].sort(),
    );
    expect(serviceInput).toMatchObject({
      accessContext: tenantContext,
      connectionId: 'his_conn_001',
      database: routeMocks.database,
      metadata: {
        connectionName: '星澜 HIS 写入连接更新',
        sourceSystem: 'clinic_his',
      },
    });
    expect(Object.keys((serviceInput?.metadata as Record<string, unknown>) ?? {}).sort()).toEqual(
      ['connectionName', 'sourceSystem'].sort(),
    );
    expect(JSON.stringify(serviceInput)).not.toContain('other-tenant-should-not-be-trusted');
    expect(JSON.stringify(serviceInput?.metadata)).not.toMatch(
      /tenantId|credentialRef|token|secret|apiKey|rawPayload|requestBody|responseBody|DATABASE_URL|select \* from|stack/i,
    );
    expectNoHisPrivateData(payload);
  });

  it('create / update 未登录时返回 401，且不写 tenant audit、不读取 body 或调用 service', async () => {
    const unauthorizedCreateResponse = await hisConnectionCreatePost(
      createRawRequest('{"connectionName":"malformed"'),
    );
    const unauthorizedUpdateResponse = await hisConnectionUpdatePatch(
      updateRawRequest('{"connectionName":"malformed"'),
      detailContext('his_conn_001'),
    );

    expect(unauthorizedCreateResponse.status).toBe(401);
    await expect(unauthorizedCreateResponse.json()).resolves.toEqual({
      code: 'unauthorized',
      error: '请先登录',
    });
    expect(unauthorizedUpdateResponse.status).toBe(401);
    await expect(unauthorizedUpdateResponse.json()).resolves.toEqual({
      code: 'unauthorized',
      error: '请先登录',
    });
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.createHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.updateHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('create API 权限拒绝返回 403 并写 denied audit，且不读取 body 或调用 service', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantOperatorContext);

    const response = await hisConnectionCreatePost(
      createRawRequest('{"connectionName":"malformed"'),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({
      code: 'forbidden',
      error: '没有访问权限',
    });
    expect(routeMocks.createAuditEventRepository).toHaveBeenCalledWith(routeMocks.database);
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(1);
    expectRouteDeniedAuditEvent(routeMocks.auditEventRepository.record.mock.calls[0]?.[0], {
      actorId: 'demo-user-operator',
      actorRole: 'tenant_operator',
      tenantId: 'demo-tenant-001',
      action: 'create',
      reason: 'role_denied',
    });
    expect(routeMocks.createHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('create API 缺失 tenantId 返回 403 并写 missing_tenant denied audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantAdminWithoutTenantContext);

    const response = await hisConnectionCreatePost(
      createRawRequest('{"connectionName":"malformed"'),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'forbidden',
      error: '没有访问权限',
    });
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(1);
    expectRouteDeniedAuditEvent(routeMocks.auditEventRepository.record.mock.calls[0]?.[0], {
      actorId: 'demo-user-admin',
      actorRole: 'tenant_admin',
      tenantId: null,
      action: 'create',
      reason: 'missing_tenant',
    });
    expect(routeMocks.createHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('update API 权限拒绝返回 403 并写 denied audit，且 resourceId 使用 trim 后 path ID', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantOperatorContext);

    const response = await hisConnectionUpdatePatch(
      updateRawRequest('{"connectionName":"malformed"'),
      detailContext('  his_conn_001  '),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'forbidden',
      error: '没有访问权限',
    });
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(1);
    expectRouteDeniedAuditEvent(routeMocks.auditEventRepository.record.mock.calls[0]?.[0], {
      actorId: 'demo-user-operator',
      actorRole: 'tenant_operator',
      tenantId: 'demo-tenant-001',
      action: 'update',
      reason: 'role_denied',
      resourceId: 'his_conn_001',
    });
    expect(routeMocks.updateHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('update API 缺失 tenantId 返回 403 并写 missing_tenant denied audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantAdminWithoutTenantContext);

    const response = await hisConnectionUpdatePatch(
      updateRawRequest('{"connectionName":"malformed"'),
      detailContext('his_conn_001'),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      code: 'forbidden',
      error: '没有访问权限',
    });
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(1);
    expectRouteDeniedAuditEvent(routeMocks.auditEventRepository.record.mock.calls[0]?.[0], {
      actorId: 'demo-user-admin',
      actorRole: 'tenant_admin',
      tenantId: null,
      action: 'update',
      reason: 'missing_tenant',
      resourceId: 'his_conn_001',
    });
    expect(routeMocks.updateHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('create API 拒绝 body tenantId 注入和敏感字段，且 parser 失败不调用 service', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    await expectValidationFailedResponse(
      await hisConnectionCreatePost(
        createRequest({
          ...validCreatePayload,
          tenantId: 'demo-tenant-002',
        }),
      ),
    );

    for (const field of forbiddenWritePayloadFields) {
      const response = await hisConnectionCreatePost(
        createRequest({
          ...validCreatePayload,
          [field]: `forbidden_${field}_should_not_echo`,
        }),
      );
      const payload = await expectValidationFailedResponse(response);

      expect(JSON.stringify(payload)).not.toContain(`forbidden_${field}_should_not_echo`);
    }

    expect(routeMocks.createHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('update API 空 connectionId 返回稳定 not_found，且不读取 access context 或调用 service', async () => {
    const response = await hisConnectionUpdatePatch(updateRequest(), detailContext('   '));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: 'not_found',
      error: '记录不存在',
    });
    expect(routeMocks.getDemoAccessContextFromRequest).not.toHaveBeenCalled();
    expect(routeMocks.createAuditEventRepository).not.toHaveBeenCalled();
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
    expect(routeMocks.getDatabase).not.toHaveBeenCalled();
    expect(routeMocks.updateHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('update API 拒绝 body tenantId 注入、敏感字段、空更新和 malformed JSON，且 parser 失败不调用 service', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    await expectValidationFailedResponse(
      await hisConnectionUpdatePatch(
        updateRequest({
          ...validUpdatePayload,
          tenantId: 'demo-tenant-002',
        }),
        detailContext('his_conn_001'),
      ),
    );

    for (const field of forbiddenWritePayloadFields) {
      const response = await hisConnectionUpdatePatch(
        updateRequest({
          ...validUpdatePayload,
          [field]: `forbidden_${field}_should_not_echo`,
        }),
        detailContext('his_conn_001'),
      );
      const payload = await expectValidationFailedResponse(response);

      expect(JSON.stringify(payload)).not.toContain(`forbidden_${field}_should_not_echo`);
    }

    await expectValidationFailedResponse(
      await hisConnectionUpdatePatch(updateRequest({}), detailContext('his_conn_001')),
    );
    await expectValidationFailedResponse(
      await hisConnectionUpdatePatch(
        updateRawRequest('{"connectionName":"星澜 sk_test_patch_should_not_echo"'),
        detailContext('his_conn_001'),
      ),
    );
    expect(routeMocks.updateHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('malformed JSON 或 parser 失败返回 validation_failed，且不回显原始 payload 或敏感值', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const malformedCreateResponse = await hisConnectionCreatePost(
      createRawRequest('{"connectionName":"星澜 sk_test_should_not_echo"'),
    );
    const forbiddenFieldUpdateResponse = await hisConnectionUpdatePatch(
      updateRequest({ credentialRef: 'cred_ref_should_not_echo' }),
      detailContext('his_conn_001'),
    );
    const malformedCreatePayload = await malformedCreateResponse.json();
    const forbiddenFieldUpdatePayload = await forbiddenFieldUpdateResponse.json();

    expect(malformedCreateResponse.status).toBe(400);
    expect(malformedCreatePayload).toEqual({
      code: 'validation_failed',
      error: '请求格式不正确',
    });
    expect(forbiddenFieldUpdateResponse.status).toBe(400);
    expect(forbiddenFieldUpdatePayload).toEqual({
      code: 'validation_failed',
      error: '请求格式不正确',
    });
    expect(JSON.stringify(malformedCreatePayload)).not.toContain('sk_test_should_not_echo');
    expect(JSON.stringify(forbiddenFieldUpdatePayload)).not.toContain('cred_ref_should_not_echo');
    expect(routeMocks.createHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.updateHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('create API malformed JSON 或 parser 失败返回 400 并写 invalid payload denied audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const malformedResponse = await hisConnectionCreatePost(
      createRawRequest('{"connectionName":"星澜 sk_test_should_not_echo"'),
    );
    const forbiddenFieldResponse = await hisConnectionCreatePost(
      createRequest({
        ...validCreatePayload,
        credentialRef: 'cred_ref_should_not_echo',
        token: 'token_should_not_echo',
      }),
    );

    await expectValidationFailedResponse(malformedResponse);
    await expectValidationFailedResponse(forbiddenFieldResponse);
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(2);
    for (const call of routeMocks.auditEventRepository.record.mock.calls) {
      expectRouteDeniedAuditEvent(call[0], {
        actorId: 'demo-user-admin',
        actorRole: 'tenant_admin',
        tenantId: 'demo-tenant-001',
        action: 'create',
        reason: 'invalid_his_connection_payload',
      });
      expect(JSON.stringify(call[0])).not.toContain('sk_test_should_not_echo');
      expect(JSON.stringify(call[0])).not.toContain('cred_ref_should_not_echo');
      expect(JSON.stringify(call[0])).not.toContain('token_should_not_echo');
    }
    expect(routeMocks.createHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('update API malformed JSON 或 parser 失败返回 400 并写带 resourceId 的 invalid payload denied audit', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);

    const malformedResponse = await hisConnectionUpdatePatch(
      updateRawRequest('{"connectionName":"星澜 sk_test_patch_should_not_echo"'),
      detailContext('  his_conn_001  '),
    );
    const forbiddenFieldResponse = await hisConnectionUpdatePatch(
      updateRequest({
        credentialRef: 'cred_ref_patch_should_not_echo',
        secret: 'secret_patch_should_not_echo',
      }),
      detailContext('  his_conn_001  '),
    );

    await expectValidationFailedResponse(malformedResponse);
    await expectValidationFailedResponse(forbiddenFieldResponse);
    expect(routeMocks.auditEventRepository.record).toHaveBeenCalledTimes(2);
    for (const call of routeMocks.auditEventRepository.record.mock.calls) {
      expectRouteDeniedAuditEvent(call[0], {
        actorId: 'demo-user-admin',
        actorRole: 'tenant_admin',
        tenantId: 'demo-tenant-001',
        action: 'update',
        reason: 'invalid_his_connection_payload',
        resourceId: 'his_conn_001',
      });
      expect(JSON.stringify(call[0])).not.toContain('sk_test_patch_should_not_echo');
      expect(JSON.stringify(call[0])).not.toContain('cred_ref_patch_should_not_echo');
      expect(JSON.stringify(call[0])).not.toContain('secret_patch_should_not_echo');
    }
    expect(routeMocks.updateHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('route denied audit 写入失败时返回 503，且不泄露 audit repository 异常', async () => {
    routeMocks.auditEventRepository.record.mockRejectedValueOnce(
      new Error('DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg audit stack'),
    );
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantOperatorContext);

    const forbiddenAuditFailureResponse = await hisConnectionCreatePost(createRequest());
    const forbiddenAuditFailurePayload = await forbiddenAuditFailureResponse.json();

    routeMocks.auditEventRepository.record.mockRejectedValueOnce(
      new Error('select * from audit_events token stack'),
    );
    routeMocks.getDemoAccessContextFromRequest.mockReturnValueOnce(tenantContext);

    const parserAuditFailureResponse = await hisConnectionUpdatePatch(
      updateRequest({ credentialRef: 'cred_ref_should_not_echo' }),
      detailContext('his_conn_001'),
    );
    const parserAuditFailurePayload = await parserAuditFailureResponse.json();

    expect(forbiddenAuditFailureResponse.status).toBe(503);
    expect(forbiddenAuditFailurePayload).toEqual({
      code: 'service_unavailable',
      error: '数据服务暂时不可用',
    });
    expect(parserAuditFailureResponse.status).toBe(503);
    expect(parserAuditFailurePayload).toEqual({
      code: 'service_unavailable',
      error: '数据服务暂时不可用',
    });
    expectNoHisPrivateData(forbiddenAuditFailurePayload);
    expectNoHisPrivateData(parserAuditFailurePayload);
    expect(routeMocks.createHisConnectionForTenantService).not.toHaveBeenCalled();
    expect(routeMocks.updateHisConnectionForTenantService).not.toHaveBeenCalled();
  });

  it('create / update route 不调用真实 HIS、fetch、测试连接、摘要、任务或自动触达', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const localStorage = {
      clear: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', localStorage);

    await hisConnectionCreatePost(createRequest());
    await hisConnectionUpdatePatch(updateRequest(), detailContext('his_conn_001'));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(routeMocks.database.insert).not.toHaveBeenCalled();
    expect(routeMocks.database.update).not.toHaveBeenCalled();
    expect(routeMocks.database.delete).not.toHaveBeenCalled();
    expect(routeMocks.database.transaction).not.toHaveBeenCalled();

    const routeSource = [
      readFileSync(
        join(process.cwd(), 'src/app/api/institution/his-connections/route.ts'),
        'utf8',
      ),
      readFileSync(
        join(process.cwd(), 'src/app/api/institution/his-connections/[connectionId]/route.ts'),
        'utf8',
      ),
    ].join('\n');

    expect(routeSource).not.toMatch(
      /fetch\(|localStorage|真实 HIS|测试连接|机构系统|企微|RAG|Agent|自动触达|treatmentSummary|treatment-summary|followUp|follow-up|follow_up|credentialRef|rawPayload|requestBody|responseBody|DATABASE_URL|select \* from|stack/i,
    );

    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('service result 映射为稳定 HTTP 响应', async () => {
    routeMocks.getDemoAccessContextFromRequest.mockReturnValue(tenantContext);
    routeMocks.createHisConnectionForTenantService
      .mockResolvedValueOnce({ status: 'validation_failed' })
      .mockResolvedValueOnce({ status: 'conflict' })
      .mockResolvedValueOnce({ status: 'service_unavailable' });
    routeMocks.updateHisConnectionForTenantService
      .mockResolvedValueOnce({ status: 'validation_failed' })
      .mockResolvedValueOnce({ status: 'conflict' })
      .mockResolvedValueOnce({ status: 'not_found' })
      .mockResolvedValueOnce({ status: 'service_unavailable' });

    const createValidationResponse = await hisConnectionCreatePost(createRequest());
    const createConflictResponse = await hisConnectionCreatePost(createRequest());
    const createUnavailableResponse = await hisConnectionCreatePost(createRequest());
    const updateValidationResponse = await hisConnectionUpdatePatch(
      updateRequest(),
      detailContext('his_conn_001'),
    );
    const updateConflictResponse = await hisConnectionUpdatePatch(
      updateRequest(),
      detailContext('his_conn_001'),
    );
    const updateNotFoundResponse = await hisConnectionUpdatePatch(
      updateRequest(),
      detailContext('his_conn_001'),
    );
    const updateUnavailableResponse = await hisConnectionUpdatePatch(
      updateRequest(),
      detailContext('his_conn_001'),
    );

    expect(createValidationResponse.status).toBe(400);
    const createValidationPayload = await createValidationResponse.json();
    expect(createValidationPayload).toEqual({
      code: 'validation_failed',
      error: '请求格式不正确',
    });
    expectNoHisPrivateData(createValidationPayload);
    expect(createConflictResponse.status).toBe(409);
    const createConflictPayload = await createConflictResponse.json();
    expect(createConflictPayload).toEqual({
      code: 'conflict',
      error: '连接名称已存在',
    });
    expectNoHisPrivateData(createConflictPayload);
    expect(createUnavailableResponse.status).toBe(503);
    const createUnavailablePayload = await createUnavailableResponse.json();
    expect(createUnavailablePayload).toEqual({
      code: 'service_unavailable',
      error: '数据服务暂时不可用',
    });
    expectNoHisPrivateData(createUnavailablePayload);
    expect(updateValidationResponse.status).toBe(400);
    const updateValidationPayload = await updateValidationResponse.json();
    expect(updateValidationPayload).toEqual({
      code: 'validation_failed',
      error: '请求格式不正确',
    });
    expectNoHisPrivateData(updateValidationPayload);
    expect(updateConflictResponse.status).toBe(409);
    const updateConflictPayload = await updateConflictResponse.json();
    expect(updateConflictPayload).toEqual({
      code: 'conflict',
      error: '连接名称已存在',
    });
    expectNoHisPrivateData(updateConflictPayload);
    expect(updateNotFoundResponse.status).toBe(404);
    const updateNotFoundPayload = await updateNotFoundResponse.json();
    expect(updateNotFoundPayload).toEqual({
      code: 'not_found',
      error: '记录不存在',
    });
    expectNoHisPrivateData(updateNotFoundPayload);
    expect(updateUnavailableResponse.status).toBe(503);
    const updateUnavailablePayload = await updateUnavailableResponse.json();
    expect(updateUnavailablePayload).toEqual({
      code: 'service_unavailable',
      error: '数据服务暂时不可用',
    });
    expectNoHisPrivateData(updateUnavailablePayload);
    expect(routeMocks.auditEventRepository.record).not.toHaveBeenCalled();
  });
});
