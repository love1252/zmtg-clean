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

const hisCredentialProviderFailureCompensationReasons = [
  'provider_unavailable',
  'provider_timeout',
  'provider_retry_exhausted',
  'provider_circuit_open',
  'provider_validation_failed',
  'provider_write_failed',
  'provider_revoke_failed',
  'provider_describe_failed',
  'provider_health_failed',
  'repository_after_provider_failed',
  'audit_after_provider_failed',
  'compensation_pending',
  'compensation_running',
  'compensation_succeeded',
  'compensation_failed',
  'manual_review_required',
] as const;

const hisTestConnectionAuditReasons = [
  'test_connection_requested',
  'test_connection_provider_healthy',
  'test_connection_missing_credential',
  'test_connection_unsupported_vendor',
  'test_connection_limited_health_probe',
  'test_connection_external_unreachable',
  'test_connection_provider_timeout',
  'test_connection_connection_not_active',
  'test_connection_completed',
] as const;

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

  it('接受治疗摘要资源和稳定 invalid reason 查询', () => {
    expect(
      parseAuditEventQueryParams(
        params({
          resource: 'treatment_summary',
          action: 'create',
          result: 'denied',
          reason: 'invalid_treatment_summary_reference',
        }),
      ),
    ).toEqual({
      ok: true,
      query: {
        filters: {
          resource: 'treatment_summary',
          action: 'create',
          result: 'denied',
          reason: 'invalid_treatment_summary_reference',
        },
        limit: DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
      },
    });

    expect(
      parseAuditEventQueryParams(
        params({
          resource: 'treatment_summary',
          action: 'create',
          result: 'denied',
          reason: 'invalid_treatment_summary_payload',
        }),
      ),
    ).toEqual({
      ok: true,
      query: {
        filters: {
          resource: 'treatment_summary',
          action: 'create',
          result: 'denied',
          reason: 'invalid_treatment_summary_payload',
        },
        limit: DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
      },
    });
  });

  it('接受平台新租户套餐开通审计 reason 查询', () => {
    expect(
      parseAuditEventQueryParams(
        params({
          resource: 'tenant',
          action: 'create',
          result: 'allowed',
          reason: 'tenant_plan_assignment_created',
        }),
      ),
    ).toEqual({
      ok: true,
      query: {
        filters: {
          resource: 'tenant',
          action: 'create',
          result: 'allowed',
          reason: 'tenant_plan_assignment_created',
        },
        limit: DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
      },
    });
  });

  it('接受治疗摘要作废的稳定 reason 查询', () => {
    for (const reason of [
      'treatment_summary_voided',
      'treatment_summary_already_voided',
      'invalid_treatment_summary_void_payload',
      'voided_treatment_summary_follow_up_blocked',
    ] as const) {
      expect(
        parseAuditEventQueryParams(
          params({
            resource: 'treatment_summary',
            action: 'update',
            result: reason.includes('invalid') || reason.includes('blocked') ? 'denied' : 'allowed',
            reason,
          }),
        ),
      ).toEqual({
        ok: true,
        query: {
          filters: {
            resource: 'treatment_summary',
            action: 'update',
            result: reason.includes('invalid') || reason.includes('blocked') ? 'denied' : 'allowed',
            reason,
          },
          limit: DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
        },
      });
    }
  });

  it('接受 HIS 连接配置写入拒绝 reason 查询', () => {
    for (const reason of [
      'invalid_his_connection_payload',
      'his_connection_name_conflict',
    ] as const) {
      expect(
        parseAuditEventQueryParams(
          params({
            resource: 'open_connection',
            action: reason === 'invalid_his_connection_payload' ? 'create' : 'update',
            result: 'denied',
            reason,
          }),
        ),
      ).toEqual({
        ok: true,
        query: {
          filters: {
            resource: 'open_connection',
            action: reason === 'invalid_his_connection_payload' ? 'create' : 'update',
            result: 'denied',
            reason,
          },
          limit: DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
        },
      });
    }

    expect(
      parseAuditEventQueryParams(
        params({
          resource: 'open_connection',
          action: 'update',
          result: 'denied',
          reason: 'not_found_or_not_owned',
        }),
      ),
    ).toEqual({
      ok: true,
      query: {
        filters: {
          resource: 'open_connection',
          action: 'update',
          result: 'denied',
          reason: 'not_found_or_not_owned',
        },
        limit: DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
      },
    });

    expectParseError(
      { resource: 'open_connection', reason: 'his_connection_not_found_or_not_owned' },
      'reason 不在允许范围内',
    );
    expectParseError(
      { resource: 'open_connection', reason: 'invalid_his_connection_repository_result' },
      'reason 不在允许范围内',
    );
  });

  it('接受 HIS 连接配置凭证管理 action 和稳定 reason 查询', () => {
    for (const query of [
      {
        resource: 'open_connection',
        resourceId: 'his_conn_001',
        action: 'manage_credentials',
        result: 'allowed',
        reason: 'allowed_by_policy',
      },
      {
        resource: 'open_connection',
        resourceId: 'his_conn_001',
        action: 'manage_credentials',
        result: 'denied',
        reason: 'invalid_his_connection_payload',
      },
      {
        resource: 'open_connection',
        resourceId: 'his_conn_001',
        action: 'manage_credentials',
        result: 'denied',
        reason: 'not_found_or_not_owned',
      },
      {
        resource: 'open_connection',
        resourceId: 'his_conn_001',
        action: 'manage_credentials',
        result: 'denied',
        reason: 'invalid_transition',
      },
    ] as const) {
      expect(parseAuditEventQueryParams(params(query))).toEqual({
        ok: true,
        query: {
          filters: query,
          limit: DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
        },
      });
    }
  });

  it('接受 HIS 连接配置凭证 provider 失败与补偿稳定 reason 查询', () => {
    for (const reason of hisCredentialProviderFailureCompensationReasons) {
      const result = reason === 'compensation_succeeded' ? 'allowed' : 'denied';
      const query = {
        resource: 'open_connection',
        resourceId: 'his_conn_001',
        action: 'manage_credentials',
        result,
        reason,
      } as const;

      expect(parseAuditEventQueryParams(params(query))).toEqual({
        ok: true,
        query: {
          filters: query,
          limit: DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
        },
      });
    }
  });

  it('接受 HIS 测试连接 audit action 与稳定 reason 查询', () => {
    for (const reason of hisTestConnectionAuditReasons) {
      const result =
        reason === 'test_connection_requested' ||
        reason === 'test_connection_provider_healthy' ||
        reason === 'test_connection_completed'
          ? 'allowed'
          : 'denied';
      const query = {
        resource: 'open_connection',
        resourceId: 'his_conn_001',
        action: 'test_connection',
        result,
        reason,
      } as const;

      expect(parseAuditEventQueryParams(params(query))).toEqual({
        ok: true,
        query: {
          filters: query,
          limit: DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
        },
      });
    }

    for (const reason of [
      'invalid_his_connection_payload',
      'not_found_or_not_owned',
      'provider_validation_failed',
      'repository_after_provider_failed',
    ] as const) {
      const query = {
        resource: 'open_connection',
        resourceId: 'his_conn_001',
        action: 'test_connection',
        result: 'denied',
        reason,
      } as const;

      expect(parseAuditEventQueryParams(params(query))).toEqual({
        ok: true,
        query: {
          filters: query,
          limit: DEFAULT_AUDIT_EVENT_QUERY_LIMIT,
        },
      });
    }
  });

  it('拒绝非白名单字段，避免 tenantId 或任意 SQL 参数进入查询', () => {
    expectParseError({ tenantId: 'other-tenant' }, '不支持的筛选参数: tenantId');
    expectParseError({ orderBy: 'occurred_at desc' }, '不支持的筛选参数: orderBy');
    expectParseError({ sql: 'select * from audit_events' }, '不支持的筛选参数: sql');
  });

  it('拒绝 provider 失败与补偿越界查询字段，避免凭证引用或内部状态进入查询', () => {
    for (const key of [
      'failureCategory',
      'compensationState',
      'metadata',
      'providerPath',
      'secretPath',
      'credentialRef',
      'idempotencyKey',
      'rawProviderFilter',
    ]) {
      expectParseError({ [key]: 'not-allowed' }, `不支持的筛选参数: ${key}`);
    }

    expectParseError(
      { resource: 'open_connection', action: 'manage_credentials', result: 'failure' },
      'result 不在允许范围内',
    );
    expectParseError(
      { resource: 'open_connection', action: 'manage_credentials', reason: 'provider_secret_path_leaked' },
      'reason 不在允许范围内',
    );
    expectParseError(
      { resource: 'open_connection', action: 'manage_credentials', reason: 'provider_path_/vault/his' },
      'reason 不在允许范围内',
    );
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
