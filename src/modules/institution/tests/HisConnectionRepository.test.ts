import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantDatabase } from '@/server/db/client';
import { followUpTasks, hisConnections, treatmentSummaries } from '@/server/db/schema';
import {
  createHisConnectionRepository,
  mapHisConnectionRowToReadModel,
} from '@/modules/institution/server/his-connection-repository';

type HisConnectionRow = typeof hisConnections.$inferSelect;

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

function createHisConnectionInsertDatabase(input: {
  insertedRow?: HisConnectionRow | null;
  error?: unknown;
} = {}) {
  const returning = vi.fn(async () => {
    if (input.error) throw input.error;
    return input.insertedRow ? [input.insertedRow] : [];
  });
  const values = vi.fn((value: unknown) => {
    void value;
    return { returning };
  });
  const insert = vi.fn((table: unknown) => {
    void table;
    return { values };
  });
  const update = vi.fn();
  const select = vi.fn();
  const deleteMock = vi.fn();

  return {
    database: {
      delete: deleteMock,
      insert,
      select,
      update,
    } as unknown as TenantDatabase,
    deleteMock,
    insert,
    returning,
    select,
    update,
    values,
  };
}

function createHisConnectionUpdateDatabase(input: {
  updatedRow?: HisConnectionRow | null;
  error?: unknown;
} = {}) {
  const returning = vi.fn(async () => {
    if (input.error) throw input.error;
    return input.updatedRow ? [input.updatedRow] : [];
  });
  const where = vi.fn((condition: unknown) => {
    void condition;
    return { returning };
  });
  const set = vi.fn((values: Record<string, unknown>) => {
    void values;
    return { where };
  });
  const update = vi.fn((table: unknown) => {
    void table;
    return { set };
  });
  const insert = vi.fn();
  const select = vi.fn();
  const deleteMock = vi.fn();

  return {
    database: {
      delete: deleteMock,
      insert,
      select,
      update,
    } as unknown as TenantDatabase,
    deleteMock,
    insert,
    returning,
    select,
    set,
    update,
    where,
  };
}

function createHisConnectionStateTransitionDatabase(input: {
  currentRow?: HisConnectionRow | null;
  updatedRow?: HisConnectionRow | null;
  updateError?: unknown;
} = {}) {
  const returning = vi.fn(async () => {
    if (input.updateError) throw input.updateError;
    return input.updatedRow ? [input.updatedRow] : [];
  });
  const updateWhere = vi.fn((condition: unknown) => {
    void condition;
    return { returning };
  });
  const set = vi.fn((values: Record<string, unknown>) => {
    void values;
    return { where: updateWhere };
  });
  const update = vi.fn((table: unknown) => {
    void table;
    return { set };
  });
  const lookupWhere = vi.fn(async (condition: unknown) => {
    void condition;
    return input.currentRow ? [input.currentRow] : [];
  });
  const from = vi.fn(() => ({ where: lookupWhere }));
  const select = vi.fn(() => ({ from }));
  const insert = vi.fn();
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
    lookupWhere,
    returning,
    select,
    set,
    update,
    updateWhere,
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

const createdHisConnectionRow = {
  ...hisConnectionRow,
  id: 'his_conn_created',
  connectionName: '新建 HIS 连接',
  sourceSystem: 'his',
  vendorType: 'demo_vendor',
  systemType: 'his',
  status: 'draft',
  credentialRef: null,
  healthStatus: 'unknown',
  lastCheckedAt: null,
  lastErrorCode: null,
  createdBy: 'demo-user-admin',
  updatedBy: 'demo-user-admin',
  createdAt: new Date('2026-06-03T10:00:00.000Z'),
  updatedAt: new Date('2026-06-03T10:00:00.000Z'),
  revokedAt: null,
  deletedAt: null,
} satisfies typeof hisConnections.$inferSelect;

const updatedHisConnectionRow = {
  ...hisConnectionRow,
  connectionName: '更新后的 HIS 连接',
  sourceSystem: 'clinic_his',
  vendorType: 'updated_vendor',
  systemType: 'clinic_system',
  updatedBy: 'demo-user-operator',
  updatedAt: new Date('2026-06-03T11:00:00.000Z'),
} satisfies typeof hisConnections.$inferSelect;

const pausedHisConnectionRow = {
  ...hisConnectionRow,
  status: 'paused',
  updatedBy: 'demo-user-operator',
  updatedAt: new Date('2026-06-03T12:00:00.000Z'),
} satisfies typeof hisConnections.$inferSelect;

const errorHisConnectionRow = {
  ...hisConnectionRow,
  id: 'his_conn_error',
  connectionName: '错误态连接',
  status: 'error',
  healthStatus: 'failed',
  lastErrorCode: 'his_timeout',
  updatedAt: new Date('2026-06-03T12:10:00.000Z'),
} satisfies typeof hisConnections.$inferSelect;

const resumedHisConnectionRow = {
  ...pausedHisConnectionRow,
  status: 'active',
  updatedBy: 'demo-user-operator',
  updatedAt: new Date('2026-06-03T12:20:00.000Z'),
} satisfies typeof hisConnections.$inferSelect;

const revokedHisConnectionRow = {
  ...hisConnectionRow,
  status: 'revoked',
  updatedBy: 'demo-user-admin',
  updatedAt: new Date('2026-06-03T12:30:00.000Z'),
  revokedAt: new Date('2026-06-03T12:30:00.000Z'),
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

const uniqueNameConflictError = {
  code: '23505',
  constraint: 'his_connections_active_name_unique_idx',
  detail: 'Key (tenant_id, connection_name) already exists.',
};

const forbiddenWriteFields = {
  credentialRef: 'cred_ref_should_not_write',
  status: 'active',
  healthStatus: 'healthy',
  lastCheckedAt: new Date('2026-06-03T12:00:00.000Z'),
  lastErrorCode: 'raw_external_error',
  createdAt: new Date('2026-06-03T12:03:00.000Z'),
  updatedAt: new Date('2026-06-03T12:04:00.000Z'),
  revokedAt: new Date('2026-06-03T12:01:00.000Z'),
  deletedAt: new Date('2026-06-03T12:02:00.000Z'),
  token: 'token_should_not_write',
  secret: 'secret_should_not_write',
  apiKey: 'sk_should_not_write',
  oauthToken: 'oauth_should_not_write',
  basicAuth: 'user:password',
  signingKey: 'signing_should_not_write',
  privateKey: 'private_should_not_write',
  connectionString: 'postgres://tenant:secret@localhost:5432/zmtg',
  rawPayload: { external: true },
  requestBody: { endpoint: '/external/his' },
  responseBody: { ok: false },
  sql: 'select * from his_connections',
  stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
};

const forbiddenUpdateValues = {
  id: 'forged_connection_id',
  tenantId: 'forged-tenant',
  createdBy: 'forged-user',
  ...forbiddenWriteFields,
};

const deletedHisConnectionRow = {
  ...hisConnectionRow,
  id: 'his_conn_deleted',
  connectionName: '已软删除连接',
  status: 'deleted',
  deletedAt: new Date('2026-06-03T09:00:00.000Z'),
} satisfies typeof hisConnections.$inferSelect;

const softDeletedHisConnectionRow = {
  ...hisConnectionRow,
  status: 'deleted',
  updatedBy: 'demo-user-admin',
  updatedAt: new Date('2026-06-03T12:40:00.000Z'),
  deletedAt: new Date('2026-06-03T12:40:00.000Z'),
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

describe('HIS 连接配置写入 repository', () => {
  it('create 能为当前租户创建连接并默认写入 draft / unknown / actor 字段', async () => {
    const query = createHisConnectionInsertDatabase({ insertedRow: createdHisConnectionRow });

    const result = await createHisConnectionRepository(query.database).createHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionName: '新建 HIS 连接',
      sourceSystem: 'his',
      vendorType: 'demo_vendor',
      systemType: 'his',
      actorUserId: 'demo-user-admin',
    });

    expect(query.insert).toHaveBeenCalledWith(hisConnections);
    expect(query.values).toHaveBeenCalledWith({
      id: expect.any(String),
      tenantId: 'demo-tenant-001',
      connectionName: '新建 HIS 连接',
      sourceSystem: 'his',
      vendorType: 'demo_vendor',
      systemType: 'his',
      status: 'draft',
      healthStatus: 'unknown',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
      createdBy: 'demo-user-admin',
      updatedBy: 'demo-user-admin',
    });
    expect(result).toEqual({
      status: 'ok',
      record: mapHisConnectionRowToReadModel(createdHisConnectionRow),
    });
    expect(JSON.stringify(result)).not.toMatch(/credentialRef|credential_ref/);
  });

  it('create 只 pick 允许字段，不写 credentialRef、raw payload 或任何凭证材料', async () => {
    const query = createHisConnectionInsertDatabase({ insertedRow: createdHisConnectionRow });

    await createHisConnectionRepository(query.database).createHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionName: '新建 HIS 连接',
      sourceSystem: 'his',
      vendorType: 'demo_vendor',
      systemType: 'his',
      actorUserId: 'demo-user-admin',
      ...forbiddenWriteFields,
    } as Parameters<
      ReturnType<typeof createHisConnectionRepository>['createHisConnectionForTenant']
    >[0]);

    const written = JSON.stringify(query.values.mock.calls[0]?.[0]);

    expect(written).toMatch(/"status":"draft"/);
    expect(written).toMatch(/"healthStatus":"unknown"/);
    expect(written).not.toMatch(
      /credentialRef|credential_ref|cred_ref_should_not_write|2026-06-03T12:03:00.000Z|2026-06-03T12:04:00.000Z|lastCheckedAt|lastErrorCode|revokedAt|deletedAt|token_should_not_write|secret_should_not_write|sk_should_not_write|oauth_should_not_write|user:password|signing_should_not_write|private_should_not_write|postgres:\/\/|rawPayload|requestBody|responseBody|select \* from|DATABASE_URL|stack/i,
    );
  });

  it('create 同一租户未删除连接名冲突返回稳定 conflict', async () => {
    const query = createHisConnectionInsertDatabase({ error: uniqueNameConflictError });

    await expect(
      createHisConnectionRepository(query.database).createHisConnectionForTenant({
        tenantId: 'demo-tenant-001',
        connectionName: '星澜 HIS 只读连接',
        sourceSystem: 'his',
        vendorType: 'demo_vendor',
        systemType: 'his',
        actorUserId: 'demo-user-admin',
      }),
    ).resolves.toEqual({ status: 'conflict' });
  });

  it('create 不因其他租户同名连接冲突', async () => {
    const query = createHisConnectionInsertDatabase({
      insertedRow: { ...createdHisConnectionRow, connectionName: '共享连接名' },
    });

    const result = await createHisConnectionRepository(query.database).createHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionName: '共享连接名',
      sourceSystem: 'his',
      vendorType: 'demo_vendor',
      systemType: 'his',
      actorUserId: 'demo-user-admin',
    });

    expect(query.values).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'demo-tenant-001',
        connectionName: '共享连接名',
      }),
    );
    expect(result.status).toBe('ok');
  });

  it('create 字段为空时返回 validation_failed 且不写数据库', async () => {
    const query = createHisConnectionInsertDatabase({ insertedRow: createdHisConnectionRow });

    const result = await createHisConnectionRepository(query.database).createHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionName: '   ',
      sourceSystem: 'his',
      vendorType: 'demo_vendor',
      systemType: 'his',
      actorUserId: 'demo-user-admin',
    });

    expect(result).toEqual({ status: 'validation_failed' });
    expect(query.insert).not.toHaveBeenCalled();
  });

  it('update 只能按 tenantId + connectionId 更新当前租户未软删除连接的低风险元数据', async () => {
    const query = createHisConnectionUpdateDatabase({ updatedRow: updatedHisConnectionRow });

    const result = await createHisConnectionRepository(query.database).updateHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      values: {
        connectionName: '更新后的 HIS 连接',
        sourceSystem: 'clinic_his',
        vendorType: 'updated_vendor',
        systemType: 'clinic_system',
      },
      actorUserId: 'demo-user-operator',
    });

    expect(query.update).toHaveBeenCalledWith(hisConnections);
    expect(query.set).toHaveBeenCalledWith({
      connectionName: '更新后的 HIS 连接',
      sourceSystem: 'clinic_his',
      vendorType: 'updated_vendor',
      systemType: 'clinic_system',
      updatedAt: expect.any(Date),
      updatedBy: 'demo-user-operator',
    });
    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: hisConnections.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: hisConnections.id, operator: 'eq', value: 'his_conn_001' },
        { column: hisConnections.deletedAt, operator: 'isNull' },
      ],
      operator: 'and',
    });
    expect(result).toEqual({
      status: 'ok',
      record: mapHisConnectionRowToReadModel(updatedHisConnectionRow),
    });
  });

  it('update 跨租户、不存在或已软删除记录统一返回 not_found', async () => {
    const query = createHisConnectionUpdateDatabase({ updatedRow: null });

    await expect(
      createHisConnectionRepository(query.database).updateHisConnectionForTenant({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_other_tenant',
        values: { connectionName: '跨租户尝试' },
        actorUserId: 'demo-user-admin',
      }),
    ).resolves.toEqual({ status: 'not_found' });

    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: hisConnections.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: hisConnections.id, operator: 'eq', value: 'his_conn_other_tenant' },
        { column: hisConnections.deletedAt, operator: 'isNull' },
      ],
      operator: 'and',
    });
  });

  it('update 不修改 status、credentialRef、健康状态、检查字段和生命周期字段', async () => {
    const query = createHisConnectionUpdateDatabase({ updatedRow: updatedHisConnectionRow });

    await createHisConnectionRepository(query.database).updateHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      values: {
        connectionName: '更新后的 HIS 连接',
        ...forbiddenUpdateValues,
      },
      actorUserId: 'demo-user-operator',
    } as Parameters<
      ReturnType<typeof createHisConnectionRepository>['updateHisConnectionForTenant']
    >[0]);

    const written = JSON.stringify(query.set.mock.calls[0]?.[0]);

    expect(written).not.toMatch(
      /forged_connection_id|forged-tenant|forged-user|tenantId|credentialRef|credential_ref|cred_ref_should_not_write|status|healthStatus|lastCheckedAt|lastErrorCode|createdBy|createdAt|revokedAt|deletedAt|token_should_not_write|secret_should_not_write|sk_should_not_write|oauth_should_not_write|user:password|signing_should_not_write|private_should_not_write|postgres:\/\/|rawPayload|requestBody|responseBody|select \* from|DATABASE_URL|stack/i,
    );
  });

  it('update 同一租户未删除连接名冲突返回稳定 conflict', async () => {
    const query = createHisConnectionUpdateDatabase({ error: uniqueNameConflictError });

    await expect(
      createHisConnectionRepository(query.database).updateHisConnectionForTenant({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        values: { connectionName: '星澜 HIS 只读连接' },
        actorUserId: 'demo-user-admin',
      }),
    ).resolves.toEqual({ status: 'conflict' });
  });

  it('update 不因其他租户同名连接冲突', async () => {
    const query = createHisConnectionUpdateDatabase({
      updatedRow: { ...updatedHisConnectionRow, connectionName: '共享连接名' },
    });

    const result = await createHisConnectionRepository(query.database).updateHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      values: { connectionName: '共享连接名' },
      actorUserId: 'demo-user-admin',
    });

    expect(query.set).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionName: '共享连接名',
        updatedBy: 'demo-user-admin',
      }),
    );
    expect(result.status).toBe('ok');
  });

  it('update values 为空时返回 validation_failed 且不写数据库', async () => {
    const query = createHisConnectionUpdateDatabase({ updatedRow: updatedHisConnectionRow });

    const result = await createHisConnectionRepository(query.database).updateHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      values: {},
      actorUserId: 'demo-user-admin',
    });

    expect(result).toEqual({ status: 'validation_failed' });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('pause 允许 active / error 进入 paused，并只写状态和更新 actor 字段', async () => {
    const query = createHisConnectionStateTransitionDatabase({
      currentRow: errorHisConnectionRow,
      updatedRow: {
        ...errorHisConnectionRow,
        status: 'paused',
        updatedBy: 'demo-user-operator',
        updatedAt: new Date('2026-06-03T12:15:00.000Z'),
      },
    });

    const result = await createHisConnectionRepository(query.database).pauseHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_error',
      actorUserId: 'demo-user-operator',
      reasonCode: 'operator_pause',
    });

    expect(query.lookupWhere).toHaveBeenCalledWith({
      conditions: [
        { column: hisConnections.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: hisConnections.id, operator: 'eq', value: 'his_conn_error' },
        { column: hisConnections.deletedAt, operator: 'isNull' },
      ],
      operator: 'and',
    });
    expect(query.update).toHaveBeenCalledWith(hisConnections);
    expect(query.set).toHaveBeenCalledWith({
      status: 'paused',
      updatedAt: expect.any(Date),
      updatedBy: 'demo-user-operator',
    });
    expect(query.updateWhere).toHaveBeenCalledWith({
      conditions: [
        { column: hisConnections.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: hisConnections.id, operator: 'eq', value: 'his_conn_error' },
        { column: hisConnections.deletedAt, operator: 'isNull' },
      ],
      operator: 'and',
    });
    expect(result).toEqual({
      status: 'ok',
      record: mapHisConnectionRowToReadModel({
        ...errorHisConnectionRow,
        status: 'paused',
        updatedBy: 'demo-user-operator',
        updatedAt: new Date('2026-06-03T12:15:00.000Z'),
      }),
    });
    expect(JSON.stringify(query.set.mock.calls[0]?.[0])).not.toMatch(/reasonCode|operator_pause/i);
  });

  it('pause 禁止 draft 进入 paused，重复 pause 返回 conflict，且不写数据库', async () => {
    const draftQuery = createHisConnectionStateTransitionDatabase({
      currentRow: draftHisConnectionRow,
      updatedRow: pausedHisConnectionRow,
    });
    const pausedQuery = createHisConnectionStateTransitionDatabase({
      currentRow: pausedHisConnectionRow,
      updatedRow: pausedHisConnectionRow,
    });

    await expect(
      createHisConnectionRepository(draftQuery.database).pauseHisConnectionForTenant({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_draft',
        actorUserId: 'demo-user-admin',
      }),
    ).resolves.toEqual({ status: 'invalid_state_transition' });
    await expect(
      createHisConnectionRepository(pausedQuery.database).pauseHisConnectionForTenant({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        actorUserId: 'demo-user-admin',
      }),
    ).resolves.toEqual({ status: 'conflict' });

    expect(draftQuery.update).not.toHaveBeenCalled();
    expect(pausedQuery.update).not.toHaveBeenCalled();
  });

  it('resume 只允许 paused 进入 active，不测试连接也不刷新健康状态', async () => {
    const query = createHisConnectionStateTransitionDatabase({
      currentRow: pausedHisConnectionRow,
      updatedRow: resumedHisConnectionRow,
    });

    const result = await createHisConnectionRepository(query.database).resumeHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      actorUserId: 'demo-user-operator',
      reasonCode: 'manual_resume',
    });

    expect(query.set).toHaveBeenCalledWith({
      status: 'active',
      updatedAt: expect.any(Date),
      updatedBy: 'demo-user-operator',
    });
    expect(JSON.stringify(query.set.mock.calls[0]?.[0])).not.toMatch(
      /healthStatus|lastCheckedAt|lastErrorCode|reasonCode|manual_resume/i,
    );
    expect(result).toEqual({
      status: 'ok',
      record: mapHisConnectionRowToReadModel(resumedHisConnectionRow),
    });
  });

  it('resume 禁止 draft / error / revoked 直接进入 active', async () => {
    const draftQuery = createHisConnectionStateTransitionDatabase({
      currentRow: draftHisConnectionRow,
      updatedRow: resumedHisConnectionRow,
    });
    const errorQuery = createHisConnectionStateTransitionDatabase({
      currentRow: errorHisConnectionRow,
      updatedRow: resumedHisConnectionRow,
    });
    const revokedQuery = createHisConnectionStateTransitionDatabase({
      currentRow: revokedHisConnectionRow,
      updatedRow: resumedHisConnectionRow,
    });

    await expect(
      createHisConnectionRepository(draftQuery.database).resumeHisConnectionForTenant({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_draft',
        actorUserId: 'demo-user-admin',
      }),
    ).resolves.toEqual({ status: 'invalid_state_transition' });
    await expect(
      createHisConnectionRepository(errorQuery.database).resumeHisConnectionForTenant({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_error',
        actorUserId: 'demo-user-admin',
      }),
    ).resolves.toEqual({ status: 'invalid_state_transition' });
    await expect(
      createHisConnectionRepository(revokedQuery.database).resumeHisConnectionForTenant({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        actorUserId: 'demo-user-admin',
      }),
    ).resolves.toEqual({ status: 'invalid_state_transition' });

    expect(draftQuery.update).not.toHaveBeenCalled();
    expect(errorQuery.update).not.toHaveBeenCalled();
    expect(revokedQuery.update).not.toHaveBeenCalled();
  });

  it('revoke 允许 draft / active / paused / error 进入 revoked，并写 revokedAt / updatedAt / updatedBy', async () => {
    const query = createHisConnectionStateTransitionDatabase({
      currentRow: hisConnectionRow,
      updatedRow: revokedHisConnectionRow,
    });

    const result = await createHisConnectionRepository(query.database).revokeHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      actorUserId: 'demo-user-admin',
      reasonCode: 'admin_revoke',
    });

    expect(query.set).toHaveBeenCalledWith({
      status: 'revoked',
      revokedAt: expect.any(Date),
      updatedAt: expect.any(Date),
      updatedBy: 'demo-user-admin',
    });
    expect(result).toEqual({
      status: 'ok',
      record: mapHisConnectionRowToReadModel(revokedHisConnectionRow),
    });
    expect(JSON.stringify(query.set.mock.calls[0]?.[0])).not.toMatch(/reasonCode|admin_revoke/i);
  });

  it('revoke 重复撤销返回 conflict，且不处理凭证撤销或外部系统', async () => {
    const query = createHisConnectionStateTransitionDatabase({
      currentRow: revokedHisConnectionRow,
      updatedRow: revokedHisConnectionRow,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    await expect(
      createHisConnectionRepository(query.database).revokeHisConnectionForTenant({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
        actorUserId: 'demo-user-admin',
      }),
    ).resolves.toEqual({ status: 'conflict' });

    expect(query.update).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('softDelete 允许未删除状态进入 deleted，并写 deletedAt / updatedAt / updatedBy', async () => {
    const query = createHisConnectionStateTransitionDatabase({
      currentRow: revokedHisConnectionRow,
      updatedRow: softDeletedHisConnectionRow,
    });

    const result = await createHisConnectionRepository(query.database).softDeleteHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      actorUserId: 'demo-user-admin',
      reasonCode: 'archive_connection',
    });

    expect(query.set).toHaveBeenCalledWith({
      status: 'deleted',
      deletedAt: expect.any(Date),
      updatedAt: expect.any(Date),
      updatedBy: 'demo-user-admin',
    });
    expect(query.updateWhere).toHaveBeenCalledWith({
      conditions: [
        { column: hisConnections.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: hisConnections.id, operator: 'eq', value: 'his_conn_001' },
        { column: hisConnections.deletedAt, operator: 'isNull' },
      ],
      operator: 'and',
    });
    expect(result).toEqual({
      status: 'ok',
      record: mapHisConnectionRowToReadModel(softDeletedHisConnectionRow),
    });
    expect(JSON.stringify(query.set.mock.calls[0]?.[0])).not.toMatch(
      /reasonCode|archive_connection/i,
    );
  });

  it('状态方法对跨租户、不存在或已软删除目标统一返回 not_found', async () => {
    const query = createHisConnectionStateTransitionDatabase({ currentRow: null });

    await expect(
      createHisConnectionRepository(query.database).pauseHisConnectionForTenant({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_other_tenant',
        actorUserId: 'demo-user-admin',
      }),
    ).resolves.toEqual({ status: 'not_found' });

    expect(query.lookupWhere).toHaveBeenCalledWith({
      conditions: [
        { column: hisConnections.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: hisConnections.id, operator: 'eq', value: 'his_conn_other_tenant' },
        { column: hisConnections.deletedAt, operator: 'isNull' },
      ],
      operator: 'and',
    });
    expect(query.update).not.toHaveBeenCalled();
  });

  it('状态方法输入字段为空时返回 validation_failed 且不读写数据库', async () => {
    const query = createHisConnectionStateTransitionDatabase({
      currentRow: pausedHisConnectionRow,
      updatedRow: resumedHisConnectionRow,
    });

    const result = await createHisConnectionRepository(query.database).resumeHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      actorUserId: '   ',
    });

    expect(result).toEqual({ status: 'validation_failed' });
    expect(query.select).not.toHaveBeenCalled();
    expect(query.update).not.toHaveBeenCalled();
  });

  it('softDelete 后 list / detail 默认不可见，且不会硬删除记录', async () => {
    const deleteQuery = createHisConnectionStateTransitionDatabase({
      currentRow: hisConnectionRow,
      updatedRow: softDeletedHisConnectionRow,
    });
    const listQuery = createHisConnectionSelectDatabase([softDeletedHisConnectionRow]);
    const detailQuery = createHisConnectionLookupDatabase([softDeletedHisConnectionRow]);

    await createHisConnectionRepository(deleteQuery.database).softDeleteHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      actorUserId: 'demo-user-admin',
    });
    await expect(
      createHisConnectionRepository(listQuery.database).listHisConnectionsByTenant(
        'demo-tenant-001',
      ),
    ).resolves.toEqual([]);
    await expect(
      createHisConnectionRepository(detailQuery.database).getHisConnectionByTenant({
        tenantId: 'demo-tenant-001',
        connectionId: 'his_conn_001',
      }),
    ).resolves.toBeNull();

    expect(deleteQuery.deleteMock).not.toHaveBeenCalled();
  });

  it('repository 写入不调用外部系统、不创建摘要、任务或自动触达', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const createQuery = createHisConnectionInsertDatabase({ insertedRow: createdHisConnectionRow });
    const updateQuery = createHisConnectionUpdateDatabase({ updatedRow: updatedHisConnectionRow });
    const pauseQuery = createHisConnectionStateTransitionDatabase({
      currentRow: hisConnectionRow,
      updatedRow: pausedHisConnectionRow,
    });

    await createHisConnectionRepository(createQuery.database).createHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionName: '新建 HIS 连接',
      sourceSystem: 'his',
      vendorType: 'demo_vendor',
      systemType: 'his',
      actorUserId: 'demo-user-admin',
    });
    await createHisConnectionRepository(updateQuery.database).updateHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      values: { connectionName: '更新后的 HIS 连接' },
      actorUserId: 'demo-user-admin',
    });
    await createHisConnectionRepository(pauseQuery.database).pauseHisConnectionForTenant({
      tenantId: 'demo-tenant-001',
      connectionId: 'his_conn_001',
      actorUserId: 'demo-user-admin',
    });

    expect(createQuery.insert).toHaveBeenCalledWith(hisConnections);
    expect(createQuery.insert).not.toHaveBeenCalledWith(treatmentSummaries);
    expect(createQuery.insert).not.toHaveBeenCalledWith(followUpTasks);
    expect(createQuery.update).not.toHaveBeenCalled();
    expect(createQuery.deleteMock).not.toHaveBeenCalled();
    expect(updateQuery.update).toHaveBeenCalledWith(hisConnections);
    expect(updateQuery.update).not.toHaveBeenCalledWith(treatmentSummaries);
    expect(updateQuery.update).not.toHaveBeenCalledWith(followUpTasks);
    expect(updateQuery.insert).not.toHaveBeenCalled();
    expect(updateQuery.deleteMock).not.toHaveBeenCalled();
    expect(pauseQuery.update).toHaveBeenCalledWith(hisConnections);
    expect(pauseQuery.update).not.toHaveBeenCalledWith(treatmentSummaries);
    expect(pauseQuery.update).not.toHaveBeenCalledWith(followUpTasks);
    expect(pauseQuery.insert).not.toHaveBeenCalled();
    expect(pauseQuery.deleteMock).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
