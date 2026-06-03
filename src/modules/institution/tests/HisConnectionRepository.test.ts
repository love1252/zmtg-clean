import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantDatabase } from '@/server/db/client';
import { followUpTasks, hisConnections, treatmentSummaries } from '@/server/db/schema';
import {
  createHisConnectionRepository,
  mapHisConnectionRowToReadModel,
} from '@/modules/institution/server/his-connection-repository';

const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({
    conditions,
    operator: 'and',
  })),
);
const ascMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    direction: 'asc',
  })),
);
const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'eq',
    value,
  })),
);
const isNullMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    operator: 'isNull',
  })),
);

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: andMock,
    asc: ascMock,
    eq: eqMock,
    isNull: isNullMock,
  };
});

function createHisConnectionSelectDatabase(rows: unknown[] = []) {
  const orderBy = vi.fn(async (...columns: unknown[]) => {
    void columns;
    return rows;
  });
  const where = vi.fn((condition: unknown) => {
    void condition;
    return { orderBy };
  });
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const insert = vi.fn();
  const update = vi.fn();
  const deleteMock = vi.fn();

  return {
    database: {
      delete: deleteMock,
      insert,
      select,
      update,
    } as unknown as TenantDatabase,
    deleteMock,
    from,
    insert,
    orderBy,
    select,
    update,
    where,
  };
}

function createHisConnectionLookupDatabase(rows: unknown[] = []) {
  const where = vi.fn(async (condition: unknown) => {
    void condition;
    return rows;
  });
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const insert = vi.fn();
  const update = vi.fn();
  const deleteMock = vi.fn();

  return {
    database: {
      delete: deleteMock,
      insert,
      select,
      update,
    } as unknown as TenantDatabase,
    deleteMock,
    from,
    insert,
    select,
    update,
    where,
  };
}

const hisConnectionRow = {
  id: 'his_conn_001',
  tenantId: 'demo-tenant-001',
  connectionName: '星澜 HIS 只读连接',
  sourceSystem: 'his',
  vendorType: 'demo_vendor',
  systemType: 'his',
  status: 'active',
  credentialRef: 'cred_ref_internal_only',
  healthStatus: 'healthy',
  lastCheckedAt: new Date('2026-06-03T08:30:00.000Z'),
  lastErrorCode: null,
  createdBy: 'demo-user-admin',
  updatedBy: 'demo-user-admin',
  createdAt: new Date('2026-06-03T08:00:00.000Z'),
  updatedAt: new Date('2026-06-03T08:20:00.000Z'),
  revokedAt: null,
  deletedAt: null,
} satisfies typeof hisConnections.$inferSelect;

const draftHisConnectionRow = {
  ...hisConnectionRow,
  id: 'his_conn_draft',
  connectionName: '草稿连接',
  status: 'draft',
  credentialRef: null,
  healthStatus: 'unknown',
  lastCheckedAt: null,
  updatedBy: null,
  createdAt: new Date('2026-06-03T08:05:00.000Z'),
  updatedAt: new Date('2026-06-03T08:05:00.000Z'),
} satisfies typeof hisConnections.$inferSelect;

const deletedHisConnectionRow = {
  ...hisConnectionRow,
  id: 'his_conn_deleted',
  connectionName: '已软删除连接',
  status: 'deleted',
  deletedAt: new Date('2026-06-03T09:00:00.000Z'),
} satisfies typeof hisConnections.$inferSelect;

beforeEach(() => {
  andMock.mockClear();
  ascMock.mockClear();
  eqMock.mockClear();
  isNullMock.mockClear();
});

describe('HIS 连接配置只读 repository', () => {
  it('把 his_connections 行映射为只读安全模型且派生 credentialConfigured', () => {
    const record = mapHisConnectionRowToReadModel(hisConnectionRow);

    expect(record).toEqual({
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
    });
    expect(JSON.stringify(record)).not.toMatch(
      /credentialRef|credential_ref|cred_ref_internal_only|token|secret|apiKey|api_key|oauth|basicAuth|basic_auth|signingKey|signing_key|privateKey|private_key|connectionString|connection_string|rawPayload|raw_payload|requestBody|request_body|responseBody|response_body|treatmentRecord|medicalRecordBody|consultationTranscript|imageOriginal|fileOriginal|sql|stack|DATABASE_URL/i,
    );
  });

  it('credentialRef 为空时只返回 credentialConfigured=false，不返回凭证引用字段', () => {
    const record = mapHisConnectionRowToReadModel(draftHisConnectionRow);

    expect(record.credentialConfigured).toBe(false);
    expect(JSON.stringify(record)).not.toMatch(/credentialRef|credential_ref/);
  });

  it('按可信 tenantId 列出未软删除连接配置并按名称稳定排序', async () => {
    const query = createHisConnectionSelectDatabase([hisConnectionRow, draftHisConnectionRow]);

    const records = await createHisConnectionRepository(
      query.database,
    ).listHisConnectionsByTenant('demo-tenant-001');

    expect(query.from).toHaveBeenCalledWith(hisConnections);
    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: hisConnections.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: hisConnections.deletedAt, operator: 'isNull' },
      ],
      operator: 'and',
    });
    expect(query.orderBy).toHaveBeenCalledWith(
      { column: hisConnections.connectionName, direction: 'asc' },
      { column: hisConnections.id, direction: 'asc' },
    );
    expect(records).toEqual([
      mapHisConnectionRowToReadModel(hisConnectionRow),
      mapHisConnectionRowToReadModel(draftHisConnectionRow),
    ]);
  });

  it('列表即使数据库 mock 混入其他租户或软删除行也不会返回', async () => {
    const query = createHisConnectionSelectDatabase([
      hisConnectionRow,
      { ...hisConnectionRow, id: 'his_conn_other_tenant', tenantId: 'demo-tenant-002' },
      deletedHisConnectionRow,
    ]);

    const records = await createHisConnectionRepository(
      query.database,
    ).listHisConnectionsByTenant('demo-tenant-001');

    expect(records).toEqual([mapHisConnectionRowToReadModel(hisConnectionRow)]);
    expect(JSON.stringify(records)).not.toContain('demo-tenant-002');
    expect(JSON.stringify(records)).not.toContain('his_conn_deleted');
  });

  it('detail 查询必须使用 tenantId + connectionId，查到本租户未删除连接时返回安全模型', async () => {
    const query = createHisConnectionLookupDatabase([hisConnectionRow]);

    const record = await createHisConnectionRepository(query.database).getHisConnectionByTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
    });

    expect(query.from).toHaveBeenCalledWith(hisConnections);
    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: hisConnections.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: hisConnections.id, operator: 'eq', value: 'his_conn_001' },
        { column: hisConnections.deletedAt, operator: 'isNull' },
      ],
      operator: 'and',
    });
    expect(record).toEqual(mapHisConnectionRowToReadModel(hisConnectionRow));
  });

  it('detail 查询跨租户、ID 不匹配或已软删除时返回 null', async () => {
    const query = createHisConnectionLookupDatabase([
      { ...hisConnectionRow, id: 'his_conn_other_id' },
      { ...hisConnectionRow, tenantId: 'demo-tenant-002' },
      deletedHisConnectionRow,
    ]);

    await expect(
      createHisConnectionRepository(query.database).getHisConnectionByTenant({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
      }),
    ).resolves.toBeNull();
  });

  it('返回字段不包含凭证、raw payload、完整正文或内部错误细节', async () => {
    const query = createHisConnectionSelectDatabase([
      {
        ...hisConnectionRow,
        token: 'token_should_not_return',
        secret: 'secret_should_not_return',
        apiKey: 'sk_test_should_not_return',
        oauthToken: 'oauth_should_not_return',
        basicAuth: 'user:password',
        signingKey: 'signing_should_not_return',
        privateKey: 'private_should_not_return',
        connectionString: 'postgres://tenant:secret@localhost:5432/zmtg',
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
      },
    ]);

    const records = await createHisConnectionRepository(
      query.database,
    ).listHisConnectionsByTenant('demo-tenant-001');
    const serialized = JSON.stringify(records);

    expect(serialized).not.toMatch(
      /token_should_not_return|secret_should_not_return|sk_test_should_not_return|oauth_should_not_return|user:password|signing_should_not_return|private_should_not_return|postgres:\/\/|rawPayload|requestBody|responseBody|完整治疗正文|完整病历正文|咨询全文|imageOriginal|fileOriginal|select \* from|DATABASE_URL|stack/i,
    );
  });

  it('repository 只读：不写数据库、不调用外部系统、不创建摘要、任务或自动触达', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const query = createHisConnectionSelectDatabase([hisConnectionRow]);

    await createHisConnectionRepository(query.database).listHisConnectionsByTenant(
      'demo-tenant-001',
    );

    expect(query.select).toHaveBeenCalledTimes(1);
    expect(query.insert).not.toHaveBeenCalled();
    expect(query.update).not.toHaveBeenCalled();
    expect(query.deleteMock).not.toHaveBeenCalled();
    expect(query.from).toHaveBeenCalledWith(hisConnections);
    expect(query.from).not.toHaveBeenCalledWith(treatmentSummaries);
    expect(query.from).not.toHaveBeenCalledWith(followUpTasks);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('demo seed 不写入 HIS 连接配置或 credentialRef', () => {
    const seedSource = readFileSync(join(process.cwd(), 'src/server/db/seed-demo-data.ts'), 'utf8');

    expect(seedSource).not.toMatch(/hisConnections|his_connections|credentialRef|credential_ref/i);
  });
});
