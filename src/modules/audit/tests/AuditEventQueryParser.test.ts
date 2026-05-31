import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
  MAX_AUDIT_EVENT_QUERY_LIMIT,
  decodeAuditEventQueryCursor,
  encodeAuditEventQueryCursor,
} from '@/modules/audit/domain/audit-event-query';
import { parseAuditEventQueryParams } from '@/modules/audit/server/audit-event-query-parser';

function params(input: Record<string, string>) {
  return new URLSearchParams(input);
}

function expectParseError(input: Record<string, string>, message: string) {
  const result = parseAuditEventQueryParams(params(input));

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toContain(message);
  }
}

describe('审计查询参数 parser', () => {
  it('只接受白名单字段并解析完整查询条件', () => {
    const cursor = encodeAuditEventQueryCursor({
      eventId: 'audit_evt_001',
      occurredAt: '2026-05-31T09:00:00.000Z',
    });

    const result = parseAuditEventQueryParams(
      params({
        from: '2026-05-31T08:00:00.000Z',
        to: '2026-05-31T10:00:00.000Z',
        resource: 'customer',
        resourceId: 'cust_001',
        action: 'update',
        result: 'allowed',
        reason: 'allowed_by_policy',
        actorId: 'demo-user-admin',
        limit: '25',
        cursor,
      }),
    );

    expect(result).toEqual({
      ok: true,
      query: {
        filters: {
          from: '2026-05-31T08:00:00.000Z',
          to: '2026-05-31T10:00:00.000Z',
          resource: 'customer',
          resourceId: 'cust_001',
          action: 'update',
          result: 'allowed',
          reason: 'allowed_by_policy',
          actorId: 'demo-user-admin',
        },
        limit: 25,
        cursor: {
          eventId: 'audit_evt_001',
          occurredAt: '2026-05-31T09:00:00.000Z',
        },
      },
    });
    expect(decodeAuditEventQueryCursor(cursor)).toEqual({
      ok: true,
      cursor: {
        eventId: 'audit_evt_001',
        occurredAt: '2026-05-31T09:00:00.000Z',
      },
    });
  });

  it('拒绝非白名单字段，避免 tenantId 或任意 SQL 参数进入查询', () => {
    expectParseError({ tenantId: 'other-tenant' }, '不支持的筛选参数: tenantId');
    expectParseError({ orderBy: 'occurred_at desc' }, '不支持的筛选参数: orderBy');
    expectParseError({ sql: 'select * from audit_events' }, '不支持的筛选参数: sql');
  });

  it('使用默认 limit，允许最大 limit，并拒绝非法 limit', () => {
    expect(parseAuditEventQueryParams(params({}))).toEqual({
      ok: true,
      query: {
        filters: {},
        limit: DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
      },
    });

    expect(parseAuditEventQueryParams(params({ limit: String(MAX_AUDIT_EVENT_QUERY_LIMIT) }))).toEqual({
      ok: true,
      query: {
        filters: {},
        limit: MAX_AUDIT_EVENT_QUERY_LIMIT,
      },
    });

    expectParseError({ limit: '0' }, 'limit 必须在 1 到 100 之间');
    expectParseError({ limit: '101' }, 'limit 必须在 1 到 100 之间');
    expectParseError({ limit: '1.5' }, 'limit 必须是整数');
    expectParseError({ limit: 'abc' }, 'limit 必须是整数');
  });

  it('拒绝非法时间、枚举、资源编号和 cursor', () => {
    expectParseError({ from: 'not-a-date' }, 'from 必须是有效时间');
    expectParseError({ to: 'not-a-date' }, 'to 必须是有效时间');
    expectParseError({ resource: 'medical_record' }, 'resource 不在允许范围内');
    expectParseError({ action: 'drop_table' }, 'action 不在允许范围内');
    expectParseError({ result: 'failed' }, 'result 不在允许范围内');
    expectParseError({ reason: 'raw_sql_error' }, 'reason 不在允许范围内');
    expectParseError({ resourceId: 'cust 001' }, 'resourceId 格式不正确');
    expectParseError({ actorId: 'demo user admin' }, 'actorId 格式不正确');
    expectParseError({ cursor: 'not-a-valid-cursor' }, 'cursor 格式不正确');
  });

  it('拒绝重复筛选参数，保持查询语义单一', () => {
    const duplicate = new URLSearchParams();
    duplicate.append('resource', 'customer');
    duplicate.append('resource', 'appointment');

    const result = parseAuditEventQueryParams(duplicate);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('resource 只能出现一次');
    }
  });
});
