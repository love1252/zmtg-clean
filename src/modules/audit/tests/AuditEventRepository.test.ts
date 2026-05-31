import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auditEvents } from '@/server/db/schema';
import type { TenantDatabase } from '@/server/db/client';
import {
  createAuditEventRepository,
  mapAuditEventToInsert,
} from '@/modules/audit/server/audit-event-repository';
import type { TenantAuditEvent } from '@/modules/audit/domain/audit-events';
import {
  decodeAuditEventQueryCursor,
  encodeAuditEventQueryCursor,
} from '@/modules/audit/domain/audit-event-query';
import { mapAuditEventRowToListItem } from '@/modules/audit/server/audit-event-dto';

const eqMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'eq',
    value,
  })),
);
const andMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({
    conditions,
    operator: 'and',
  })),
);
const orMock = vi.hoisted(() =>
  vi.fn((...conditions: unknown[]) => ({
    conditions,
    operator: 'or',
  })),
);
const gteMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'gte',
    value,
  })),
);
const lteMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'lte',
    value,
  })),
);
const ltMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'lt',
    value,
  })),
);
const gtMock = vi.hoisted(() =>
  vi.fn((column: unknown, value: unknown) => ({
    column,
    operator: 'gt',
    value,
  })),
);
const descMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    direction: 'desc',
  })),
);
const ascMock = vi.hoisted(() =>
  vi.fn((column: unknown) => ({
    column,
    direction: 'asc',
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
    asc: ascMock,
    and: andMock,
    desc: descMock,
    eq: eqMock,
    gt: gtMock,
    gte: gteMock,
    isNull: isNullMock,
    lt: ltMock,
    lte: lteMock,
    or: orMock,
  };
});

const event: TenantAuditEvent = {
  eventId: 'audit_evt_001',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  tenantId: 'demo-tenant-001',
  scope: 'tenant',
  resource: 'customer',
  action: 'read_own_tenant',
  result: 'allowed',
  reason: 'allowed_by_policy',
  occurredAt: '2026-05-30T09:00:00.000Z',
  source: 'demo_session',
};

const expectedInsertRow = {
  eventId: 'audit_evt_001',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  tenantId: 'demo-tenant-001',
  scope: 'tenant',
  resource: 'customer',
  resourceId: null,
  action: 'read_own_tenant',
  result: 'allowed',
  reason: 'allowed_by_policy',
  occurredAt: new Date('2026-05-30T09:00:00.000Z'),
  source: 'demo_session',
};

function createInsertDatabase() {
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));

  return {
    database: { insert } as unknown as TenantDatabase,
    insert,
    values,
  };
}

function createSelectDatabase(rows: unknown[] = []) {
  const where = vi.fn(async (condition: unknown) => {
    void condition;
    return rows;
  });
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    select,
    where,
  };
}

function createAuditQueryDatabase(rows: unknown[] = []) {
  const limit = vi.fn(async (value: number) => {
    void value;
    return rows;
  });
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn((condition: unknown) => {
    void condition;
    return { orderBy };
  });
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as TenantDatabase,
    from,
    limit,
    orderBy,
    select,
    where,
  };
}

const auditEventRow = {
  eventId: 'audit_evt_001',
  actorId: 'demo-user-admin',
  actorRole: 'tenant_admin',
  tenantId: 'demo-tenant-001',
  scope: 'tenant',
  resource: 'customer',
  resourceId: 'cust_001',
  action: 'update',
  result: 'allowed',
  reason: 'allowed_by_policy',
  occurredAt: new Date('2026-05-30T09:00:00.000Z'),
  source: 'demo_session',
  metadata: { requestBody: { phoneNumber: '13800000000' } },
  requestBody: { phoneNumber: '13800000000' },
  stack: 'Error: DATABASE_URL=postgres://tenant:secret@localhost:5432/zmtg',
} satisfies typeof auditEvents.$inferSelect & {
  metadata: Record<string, unknown>;
  requestBody: Record<string, unknown>;
  stack: string;
};

const secondAuditEventRow = {
  ...auditEventRow,
  eventId: 'audit_evt_002',
  actorId: 'demo-user-operator',
  actorRole: 'tenant_operator',
  resource: 'appointment',
  resourceId: 'appt_001',
  action: 'read_own_tenant',
  result: 'denied',
  reason: 'role_denied',
  occurredAt: new Date('2026-05-30T08:00:00.000Z'),
} satisfies typeof auditEvents.$inferSelect & {
  metadata: Record<string, unknown>;
  requestBody: Record<string, unknown>;
  stack: string;
};

const thirdAuditEventRow = {
  ...auditEventRow,
  eventId: 'audit_evt_003',
  resource: 'follow_up',
  resourceId: 'fu_001',
  action: 'update',
  result: 'allowed',
  reason: 'allowed_by_policy',
  occurredAt: new Date('2026-05-30T07:00:00.000Z'),
} satisfies typeof auditEvents.$inferSelect & {
  metadata: Record<string, unknown>;
  requestBody: Record<string, unknown>;
  stack: string;
};

beforeEach(() => {
  ascMock.mockClear();
  andMock.mockClear();
  descMock.mockClear();
  eqMock.mockClear();
  gtMock.mockClear();
  gteMock.mockClear();
  isNullMock.mockClear();
  ltMock.mockClear();
  lteMock.mockClear();
  orMock.mockClear();
});

describe('审计事件仓储映射', () => {
  it('把审计事件映射为数据库写入行', () => {
    expect(mapAuditEventToInsert(event)).toEqual(expectedInsertRow);
  });

  it('把目标资源 id 映射为固定 resource_id 列', () => {
    expect(mapAuditEventToInsert({ ...event, resourceId: 'cust_001' })).toEqual({
      ...expectedInsertRow,
      resourceId: 'cust_001',
    });
  });

  it('映射审计事件时不会把额外字段带入写入行', () => {
    const eventWithExtraField: TenantAuditEvent & {
      accessToken: string;
      consultationTranscript: string;
      idNumber: string;
      medicalRecordNo: string;
      metadata: Record<string, unknown>;
      phoneNumber: string;
      requestBody: Record<string, unknown>;
      treatmentRecord: string;
    } = {
      ...event,
      accessToken: 'sk_test_should_not_persist',
      consultationTranscript: '咨询对话全文',
      idNumber: '110101199001010011',
      medicalRecordNo: 'MR-RAW-001',
      metadata: { requestBody: { maskedPhone: '13800000000' } },
      phoneNumber: '13800000000',
      requestBody: { maskedPhone: '13800000000' },
      treatmentRecord: '完整治疗记录正文',
    };

    const insertRow = mapAuditEventToInsert(eventWithExtraField);

    expect(insertRow).toEqual(expectedInsertRow);
    expect(insertRow).not.toHaveProperty('accessToken');
    expect(insertRow).not.toHaveProperty('consultationTranscript');
    expect(insertRow).not.toHaveProperty('idNumber');
    expect(insertRow).not.toHaveProperty('medicalRecordNo');
    expect(insertRow).not.toHaveProperty('metadata');
    expect(insertRow).not.toHaveProperty('phoneNumber');
    expect(insertRow).not.toHaveProperty('requestBody');
    expect(insertRow).not.toHaveProperty('treatmentRecord');
  });

  it('把审计事件写入 audit_events 表', async () => {
    const query = createInsertDatabase();

    await createAuditEventRepository(query.database).record(event);

    expect(query.insert).toHaveBeenCalledWith(auditEvents);
    expect(query.values).toHaveBeenCalledWith(expectedInsertRow);
  });

  it('按当前租户和 customer resourceId 查询安全审计摘要', async () => {
    const query = createSelectDatabase([auditEventRow]);

    const result = await createAuditEventRepository(
      query.database,
    ).listCustomerAuditEventsByResourceId({
      tenantId: 'demo-tenant-001',
      customerId: 'cust_001',
    });

    expect(query.from).toHaveBeenCalledWith(auditEvents);
    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: auditEvents.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: auditEvents.resource, operator: 'eq', value: 'customer' },
        { column: auditEvents.resourceId, operator: 'eq', value: 'cust_001' },
      ],
      operator: 'and',
    });
    expect(result).toEqual([
      {
        id: 'audit_evt_001',
        action: 'update',
        result: 'allowed',
        reason: 'allowed_by_policy',
        actor: { id: 'demo-user-admin', role: 'tenant_admin' },
        occurredAt: '2026-05-30T09:00:00.000Z',
        resource: 'customer',
        resourceId: 'cust_001',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('metadata');
    expect(JSON.stringify(result)).not.toContain('requestBody');
    expect(JSON.stringify(result)).not.toContain('13800000000');
    expect(JSON.stringify(result)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(result)).not.toContain('postgres://');
  });

  it('DTO mapper 只返回安全字段并保留 resourceId', () => {
    const dto = mapAuditEventRowToListItem(auditEventRow);
    const serialized = JSON.stringify(dto);

    expect(dto).toEqual({
      id: 'audit_evt_001',
      tenantId: 'demo-tenant-001',
      resource: 'customer',
      resourceId: 'cust_001',
      action: 'update',
      result: 'allowed',
      reason: 'allowed_by_policy',
      actorId: 'demo-user-admin',
      actorRole: 'tenant_admin',
      occurredAt: '2026-05-30T09:00:00.000Z',
    });
    expect(dto).not.toHaveProperty('metadata');
    expect(dto).not.toHaveProperty('requestBody');
    expect(dto).not.toHaveProperty('stack');
    expect(serialized).not.toContain('13800000000');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('secret');
  });

  it('按 institution scope 的 tenantId、筛选条件和 occurredAt 倒序查询审计事件', async () => {
    const query = createAuditQueryDatabase([auditEventRow, secondAuditEventRow]);

    const result = await createAuditEventRepository(query.database).listAuditEvents({
      scope: { kind: 'institution', tenantId: 'demo-tenant-001' },
      query: {
        filters: {
          from: '2026-05-30T07:30:00.000Z',
          to: '2026-05-30T09:30:00.000Z',
          resource: 'customer',
          resourceId: 'cust_001',
          action: 'update',
          result: 'allowed',
          reason: 'allowed_by_policy',
          actorId: 'demo-user-admin',
        },
        limit: 50,
      },
    });

    expect(query.from).toHaveBeenCalledWith(auditEvents);
    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: auditEvents.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        { column: auditEvents.occurredAt, operator: 'gte', value: new Date('2026-05-30T07:30:00.000Z') },
        { column: auditEvents.occurredAt, operator: 'lte', value: new Date('2026-05-30T09:30:00.000Z') },
        { column: auditEvents.resource, operator: 'eq', value: 'customer' },
        { column: auditEvents.resourceId, operator: 'eq', value: 'cust_001' },
        { column: auditEvents.action, operator: 'eq', value: 'update' },
        { column: auditEvents.result, operator: 'eq', value: 'allowed' },
        { column: auditEvents.reason, operator: 'eq', value: 'allowed_by_policy' },
        { column: auditEvents.actorId, operator: 'eq', value: 'demo-user-admin' },
      ],
      operator: 'and',
    });
    expect(query.orderBy).toHaveBeenCalledWith(
      { column: auditEvents.occurredAt, direction: 'desc' },
      { column: auditEvents.eventId, direction: 'asc' },
    );
    expect(query.limit).toHaveBeenCalledWith(51);
    expect(result.records).toEqual([
      expect.objectContaining({ id: 'audit_evt_001', resourceId: 'cust_001' }),
      expect.objectContaining({ id: 'audit_evt_002', resourceId: 'appt_001' }),
    ]);
    expect(result.pageInfo).toEqual({
      hasMore: false,
      limit: 50,
      nextCursor: null,
    });
  });

  it('platform scope 不由 parser 决定租户范围，可查询平台级事件或受控跨租户事件', async () => {
    const platformRow = {
      ...auditEventRow,
      eventId: 'audit_platform_001',
      tenantId: null,
      scope: 'platform',
      resource: 'audit_log',
      resourceId: null,
      action: 'read_detail',
      actorRole: 'security_auditor',
    } satisfies typeof auditEvents.$inferSelect & {
      metadata: Record<string, unknown>;
      requestBody: Record<string, unknown>;
      stack: string;
    };
    const query = createAuditQueryDatabase([platformRow]);

    const result = await createAuditEventRepository(query.database).listAuditEvents({
      scope: { kind: 'platform', tenantId: null },
      query: {
        filters: { actorId: 'security-auditor-001' },
        limit: 10,
      },
    });

    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: auditEvents.tenantId, operator: 'isNull' },
        { column: auditEvents.actorId, operator: 'eq', value: 'security-auditor-001' },
      ],
      operator: 'and',
    });
    expect(result.records).toEqual([
      expect.objectContaining({
        id: 'audit_platform_001',
        tenantId: null,
        resource: 'audit_log',
        actorRole: 'security_auditor',
      }),
    ]);
  });

  it('用稳定 cursor 翻页并返回下一页 cursor', async () => {
    const cursor = encodeAuditEventQueryCursor({
      eventId: 'audit_evt_001',
      occurredAt: '2026-05-30T09:00:00.000Z',
    });
    const decodedCursor = decodeAuditEventQueryCursor(cursor);
    expect(decodedCursor.ok).toBe(true);
    const query = createAuditQueryDatabase([
      secondAuditEventRow,
      thirdAuditEventRow,
      {
        ...auditEventRow,
        eventId: 'audit_evt_004',
        occurredAt: new Date('2026-05-30T06:00:00.000Z'),
      },
    ]);

    const result = await createAuditEventRepository(query.database).listAuditEvents({
      scope: { kind: 'institution', tenantId: 'demo-tenant-001' },
      query: {
        filters: {},
        limit: 2,
        cursor: decodedCursor.ok ? decodedCursor.cursor : undefined,
      },
    });

    expect(query.where).toHaveBeenCalledWith({
      conditions: [
        { column: auditEvents.tenantId, operator: 'eq', value: 'demo-tenant-001' },
        {
          conditions: [
            { column: auditEvents.occurredAt, operator: 'lt', value: new Date('2026-05-30T09:00:00.000Z') },
            {
              conditions: [
                { column: auditEvents.occurredAt, operator: 'eq', value: new Date('2026-05-30T09:00:00.000Z') },
                { column: auditEvents.eventId, operator: 'gt', value: 'audit_evt_001' },
              ],
              operator: 'and',
            },
          ],
          operator: 'or',
        },
      ],
      operator: 'and',
    });
    expect(query.limit).toHaveBeenCalledWith(3);
    expect(result.records.map((record) => record.id)).toEqual(['audit_evt_002', 'audit_evt_003']);
    expect(result.pageInfo.hasMore).toBe(true);
    expect(result.pageInfo.limit).toBe(2);
    expect(decodeAuditEventQueryCursor(result.pageInfo.nextCursor ?? '')).toEqual({
      ok: true,
      cursor: {
        eventId: 'audit_evt_003',
        occurredAt: '2026-05-30T07:00:00.000Z',
      },
    });
  });
});
