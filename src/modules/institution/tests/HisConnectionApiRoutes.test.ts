import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as hisConnectionDetailGet } from '@/app/api/institution/his-connections/[connectionId]/route';
import { GET as hisConnectionListGet } from '@/app/api/institution/his-connections/route';
import type { HisConnectionReadModel } from '@/modules/institution/server/his-connection-repository';
import type { AccessContext } from '@/modules/security/domain/access-control';

const routeMocks = vi.hoisted(() => {
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
    createHisConnectionRepository: vi.fn(() => hisConnectionRepository),
    database,
    getDatabase: vi.fn(),
    getDemoAccessContextFromRequest: vi.fn(),
    hisConnectionRepository,
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

function listRequest(url = 'http://localhost/api/institution/his-connections') {
  return new Request(url, {
    method: 'GET',
    headers: {
      'x-tenant-id': 'other-tenant-should-not-be-trusted',
      'x-his-tenant-id': 'other-his-tenant-should-not-be-trusted',
    },
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

beforeEach(() => {
  routeMocks.getDatabase.mockReset();
  routeMocks.getDatabase.mockReturnValue(routeMocks.database);
  routeMocks.database.delete.mockReset();
  routeMocks.database.insert.mockReset();
  routeMocks.database.transaction.mockReset();
  routeMocks.database.update.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReset();
  routeMocks.getDemoAccessContextFromRequest.mockReturnValue(null);
  routeMocks.createHisConnectionRepository.mockClear();
  routeMocks.hisConnectionRepository.getHisConnectionByTenant.mockReset();
  routeMocks.hisConnectionRepository.getHisConnectionByTenant.mockResolvedValue(hisConnectionRecord);
  routeMocks.hisConnectionRepository.listHisConnectionsByTenant.mockReset();
  routeMocks.hisConnectionRepository.listHisConnectionsByTenant.mockResolvedValue([
    hisConnectionRecord,
    draftHisConnectionRecord,
  ]);
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
