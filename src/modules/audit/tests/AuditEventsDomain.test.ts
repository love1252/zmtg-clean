import { describe, expect, it } from 'vitest';
import {
  AUDIT_REASON_VALUES,
  AUDIT_RESULT_VALUES,
} from '@/modules/audit/domain/audit-event-query';
import {
  auditForbiddenTerms,
  createAuditEvent,
  createDeniedAccessAuditEvent,
} from '@/modules/audit/domain/audit-events';
import type { AccessContext } from '@/modules/security/domain/access-control';

const tenantAdminContext: AccessContext = {
  userId: 'demo-user-admin',
  role: 'tenant_admin',
  scope: 'tenant',
  tenantId: 'demo-tenant-001',
  source: 'demo_session',
};

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

describe('审计事件领域模型', () => {
  it('创建允许访问审计事件并包含完整字段', () => {
    expect(
      createAuditEvent({
        eventId: 'audit_evt_001',
        context: tenantAdminContext,
        resource: 'customer',
        action: 'read_own_tenant',
        result: 'allowed',
        reason: 'allowed_by_policy',
        occurredAt: '2026-05-30T09:00:00.000Z',
      }),
    ).toEqual({
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
    });
  });

  it('创建拒绝访问审计事件', () => {
    expect(
      createDeniedAccessAuditEvent({
        eventId: 'audit_evt_denied_001',
        context: tenantAdminContext,
        resource: 'customer',
        action: 'read_own_tenant',
        reason: 'cross_tenant_denied',
        occurredAt: '2026-05-30T09:01:00.000Z',
      }),
    ).toMatchObject({
      result: 'denied',
      reason: 'cross_tenant_denied',
      resource: 'customer',
      action: 'read_own_tenant',
    });
  });

  it('创建允许访问审计事件时可携带目标资源 id', () => {
    expect(
      createAuditEvent({
        eventId: 'audit_evt_002',
        context: tenantAdminContext,
        resource: 'customer',
        resourceId: 'cust_001',
        action: 'update',
        result: 'allowed',
        reason: 'allowed_by_policy',
        occurredAt: '2026-05-30T09:02:00.000Z',
      }),
    ).toMatchObject({
      resource: 'customer',
      resourceId: 'cust_001',
      action: 'update',
      result: 'allowed',
    });
  });

  it('创建拒绝访问审计事件时可携带已确认的目标资源 id', () => {
    expect(
      createDeniedAccessAuditEvent({
        eventId: 'audit_evt_denied_002',
        context: tenantAdminContext,
        resource: 'follow_up',
        resourceId: 'fu_001',
        action: 'update',
        reason: 'invalid_transition',
        occurredAt: '2026-05-30T09:03:00.000Z',
      }),
    ).toMatchObject({
      resource: 'follow_up',
      resourceId: 'fu_001',
      action: 'update',
      result: 'denied',
      reason: 'invalid_transition',
    });
  });

  it('支持套餐配额 enforcement 的稳定拒绝 reason', () => {
    expect(AUDIT_REASON_VALUES).toEqual(
      expect.arrayContaining([
        'quota_exceeded_customers',
        'quota_exceeded_appointments',
        'missing_active_plan',
        'missing_quota_limit',
      ]),
    );

    expect(
      createDeniedAccessAuditEvent({
        eventId: 'audit_evt_denied_quota_001',
        context: tenantAdminContext,
        resource: 'customer',
        action: 'create',
        reason: 'quota_exceeded_customers',
        occurredAt: '2026-05-31T09:00:00.000Z',
      }),
    ).toMatchObject({
      action: 'create',
      reason: 'quota_exceeded_customers',
      resource: 'customer',
      result: 'denied',
    });
  });

  it('支持租户正式录入和初始管理员账号创建审计 reason，且不携带密码或请求体', () => {
    expect(AUDIT_REASON_VALUES).toEqual(
      expect.arrayContaining(['tenant_plan_assignment_created', 'tenant_account_created']),
    );

    const event = createAuditEvent({
      eventId: 'audit_evt_tenant_account_created_001',
      context: {
        userId: 'demo-user-platform',
        role: 'platform_admin',
        scope: 'platform',
        tenantId: null,
        source: 'demo_session',
      },
      resource: 'tenant_member',
      resourceId: 'tenant-member-chenlei',
      action: 'create',
      result: 'allowed',
      reason: 'tenant_account_created',
      occurredAt: '2026-06-25T09:00:00.000Z',
    });

    expect(event).toMatchObject({
      resource: 'tenant_member',
      resourceId: 'tenant-member-chenlei',
      action: 'create',
      result: 'allowed',
      reason: 'tenant_account_created',
    });
    expect(JSON.stringify(event)).not.toMatch(
      /PlaintextPasswordShouldNotPass|passwordHash|scrypt\$|requestBody|SQL|select \*|DATABASE_URL|stack/i,
    );
  });

  it('支持治疗摘要创建审计决策，且不携带请求体、正文、PII 或内部敏感信息', () => {
    expect(AUDIT_REASON_VALUES).toContain('invalid_treatment_summary_reference');
    expect(AUDIT_REASON_VALUES).toContain('invalid_treatment_summary_payload');

    expect(
      createAuditEvent({
        eventId: 'audit_evt_treatment_summary_create_001',
        context: tenantAdminContext,
        resource: 'treatment_summary',
        resourceId: 'trt_001',
        action: 'create',
        result: 'allowed',
        reason: 'allowed_by_policy',
        occurredAt: '2026-05-31T09:10:00.000Z',
      }),
    ).toMatchObject({
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'create',
      result: 'allowed',
      reason: 'allowed_by_policy',
    });

    const denied = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_treatment_summary_denied_001',
      context: tenantAdminContext,
      resource: 'treatment_summary',
      action: 'create',
      reason: 'invalid_treatment_summary_reference',
      occurredAt: '2026-05-31T09:11:00.000Z',
    });

    expect(denied).toMatchObject({
      resource: 'treatment_summary',
      action: 'create',
      result: 'denied',
      reason: 'invalid_treatment_summary_reference',
    });

    expect(
      createDeniedAccessAuditEvent({
        eventId: 'audit_evt_treatment_summary_invalid_payload_001',
        context: tenantAdminContext,
        resource: 'treatment_summary',
        action: 'create',
        reason: 'invalid_treatment_summary_payload',
        occurredAt: '2026-05-31T09:12:00.000Z',
      }),
    ).toMatchObject({
      resource: 'treatment_summary',
      action: 'create',
      result: 'denied',
      reason: 'invalid_treatment_summary_payload',
    });

    const serialized = JSON.stringify(denied);
    expect(serialized).not.toMatch(
      /requestBody|完整治疗记录正文|完整病历正文|咨询对话全文|13800000000|select \*|DATABASE_URL|stack|token|secret/i,
    );
  });

  it('支持治疗摘要编辑审计决策，且不携带请求体、正文、PII 或内部敏感信息', () => {
    expect(AUDIT_REASON_VALUES).toContain('invalid_treatment_summary_reference');
    expect(AUDIT_REASON_VALUES).toContain('invalid_treatment_summary_payload');

    const allowed = createAuditEvent({
      eventId: 'audit_evt_treatment_summary_update_001',
      context: tenantAdminContext,
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'update',
      result: 'allowed',
      reason: 'allowed_by_policy',
      occurredAt: '2026-06-02T09:10:00.000Z',
    });
    const invalidPayload = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_treatment_summary_update_denied_001',
      context: tenantAdminContext,
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'update',
      reason: 'invalid_treatment_summary_payload',
      occurredAt: '2026-06-02T09:11:00.000Z',
    });
    const invalidReference = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_treatment_summary_update_denied_002',
      context: tenantAdminContext,
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'update',
      reason: 'invalid_treatment_summary_reference',
      occurredAt: '2026-06-02T09:12:00.000Z',
    });

    expect(allowed).toMatchObject({
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'update',
      result: 'allowed',
      reason: 'allowed_by_policy',
    });
    expect(invalidPayload).toMatchObject({
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'update',
      result: 'denied',
      reason: 'invalid_treatment_summary_payload',
    });
    expect(invalidReference).toMatchObject({
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'update',
      result: 'denied',
      reason: 'invalid_treatment_summary_reference',
    });

    expect(JSON.stringify([allowed, invalidPayload, invalidReference])).not.toMatch(
      /requestBody|完整治疗记录正文|完整病历正文|咨询对话全文|13800000000|select \*|DATABASE_URL|stack|token|secret/i,
    );
  });

  it('预留治疗摘要作废审计 reason，且不携带请求体、正文、PII 或内部敏感信息', () => {
    expect(AUDIT_REASON_VALUES).toEqual(
      expect.arrayContaining([
        'treatment_summary_voided',
        'treatment_summary_already_voided',
        'invalid_treatment_summary_void_payload',
        'voided_treatment_summary_follow_up_blocked',
      ]),
    );

    const allowed = createAuditEvent({
      eventId: 'audit_evt_treatment_summary_void_001',
      context: tenantAdminContext,
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'update',
      result: 'allowed',
      reason: 'treatment_summary_voided',
      occurredAt: '2026-06-02T09:20:00.000Z',
    });
    const repeated = createAuditEvent({
      eventId: 'audit_evt_treatment_summary_void_002',
      context: tenantAdminContext,
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'update',
      result: 'allowed',
      reason: 'treatment_summary_already_voided',
      occurredAt: '2026-06-02T09:21:00.000Z',
    });
    const invalidPayload = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_treatment_summary_void_denied_001',
      context: tenantAdminContext,
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'update',
      reason: 'invalid_treatment_summary_void_payload',
      occurredAt: '2026-06-02T09:22:00.000Z',
    });

    expect(allowed).toMatchObject({
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'update',
      result: 'allowed',
      reason: 'treatment_summary_voided',
    });
    expect(repeated).toMatchObject({
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'update',
      result: 'allowed',
      reason: 'treatment_summary_already_voided',
    });
    expect(invalidPayload).toMatchObject({
      resource: 'treatment_summary',
      resourceId: 'trt_001',
      action: 'update',
      result: 'denied',
      reason: 'invalid_treatment_summary_void_payload',
    });
    expect(JSON.stringify([allowed, repeated, invalidPayload])).not.toMatch(
      /requestBody|完整治疗记录正文|完整病历正文|咨询对话全文|13800000000|select \*|DATABASE_URL|stack|token|secret/i,
    );
  });

  it('支持治疗摘要随访联动的稳定审计 reason', () => {
    expect(AUDIT_REASON_VALUES).toEqual(
      expect.arrayContaining([
        'active_source_follow_up_exists',
        'invalid_follow_up_suggestion',
      ]),
    );

    const duplicateEvent = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_follow_up_duplicate_001',
      context: tenantAdminContext,
      resource: 'follow_up',
      resourceId: 'fu_phase15_confirm',
      action: 'update',
      reason: 'active_source_follow_up_exists',
      occurredAt: '2026-06-01T09:00:00.000Z',
    });
    const invalidSuggestionEvent = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_follow_up_invalid_001',
      context: tenantAdminContext,
      resource: 'follow_up',
      action: 'update',
      reason: 'invalid_follow_up_suggestion',
      occurredAt: '2026-06-01T09:01:00.000Z',
    });

    expect(duplicateEvent).toMatchObject({
      resource: 'follow_up',
      resourceId: 'fu_phase15_confirm',
      result: 'denied',
      reason: 'active_source_follow_up_exists',
    });
    expect(invalidSuggestionEvent).toMatchObject({
      resource: 'follow_up',
      result: 'denied',
      reason: 'invalid_follow_up_suggestion',
    });
    expect(JSON.stringify([duplicateEvent, invalidSuggestionEvent])).not.toMatch(
      /requestBody|完整治疗记录正文|完整病历正文|咨询对话全文|13800000000|select \*|DATABASE_URL|stack|token|secret/i,
    );
  });

  it('支持 HIS 连接配置写入拒绝审计 reason，且不携带 payload、凭证或内部错误信息', () => {
    expect(AUDIT_REASON_VALUES).toEqual(
      expect.arrayContaining([
        'invalid_his_connection_payload',
        'his_connection_name_conflict',
      ]),
    );
    expect(AUDIT_REASON_VALUES).not.toContain('his_connection_not_found_or_not_owned');
    expect(AUDIT_REASON_VALUES).not.toContain('invalid_his_connection_repository_result');

    const invalidPayload = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_his_connection_invalid_payload_001',
      context: tenantAdminContext,
      resource: 'open_connection',
      action: 'create',
      reason: 'invalid_his_connection_payload',
      occurredAt: '2026-06-04T09:30:00.000Z',
    });
    const nameConflict = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_his_connection_name_conflict_001',
      context: tenantAdminContext,
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'update',
      reason: 'his_connection_name_conflict',
      occurredAt: '2026-06-04T09:31:00.000Z',
    });
    const notFoundOrNotOwned = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_his_connection_not_found_001',
      context: tenantAdminContext,
      resource: 'open_connection',
      resourceId: 'his_conn_002',
      action: 'update',
      reason: 'not_found_or_not_owned',
      occurredAt: '2026-06-04T09:32:00.000Z',
    });
    const roleDenied = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_his_connection_role_denied_001',
      context: tenantAdminContext,
      resource: 'open_connection',
      action: 'create',
      reason: 'role_denied',
      occurredAt: '2026-06-04T09:33:00.000Z',
    });
    const missingTenant = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_his_connection_missing_tenant_001',
      context: { ...tenantAdminContext, tenantId: null },
      resource: 'open_connection',
      action: 'create',
      reason: 'missing_tenant',
      occurredAt: '2026-06-04T09:34:00.000Z',
    });
    const crossTenantDenied = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_his_connection_cross_tenant_001',
      context: tenantAdminContext,
      resource: 'open_connection',
      action: 'update',
      reason: 'cross_tenant_denied',
      occurredAt: '2026-06-04T09:35:00.000Z',
    });

    expect(invalidPayload).toMatchObject({
      resource: 'open_connection',
      action: 'create',
      result: 'denied',
      reason: 'invalid_his_connection_payload',
    });
    expect(nameConflict).toMatchObject({
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'update',
      result: 'denied',
      reason: 'his_connection_name_conflict',
    });
    expect(notFoundOrNotOwned).toMatchObject({
      resource: 'open_connection',
      resourceId: 'his_conn_002',
      action: 'update',
      result: 'denied',
      reason: 'not_found_or_not_owned',
    });
    expect(roleDenied).toMatchObject({
      resource: 'open_connection',
      action: 'create',
      result: 'denied',
      reason: 'role_denied',
    });
    expect(missingTenant).toMatchObject({
      resource: 'open_connection',
      action: 'create',
      result: 'denied',
      reason: 'missing_tenant',
    });
    expect(crossTenantDenied).toMatchObject({
      resource: 'open_connection',
      action: 'update',
      result: 'denied',
      reason: 'cross_tenant_denied',
    });

    expect(
      JSON.stringify([
        invalidPayload,
        nameConflict,
        notFoundOrNotOwned,
        roleDenied,
        missingTenant,
        crossTenantDenied,
      ]),
    ).not.toMatch(
      /requestBody|responseBody|credentialRef|token|secret|API key|OAuth token|basic auth|签名密钥|私钥|连接串|raw HIS payload|SQL|select \*|stack|DATABASE_URL|数据库约束|冲突细节/i,
    );
  });

  it('支持 HIS 连接配置凭证管理审计 action，且不携带凭证明文或内部引用', () => {
    const allowed = createAuditEvent({
      eventId: 'audit_evt_his_connection_credentials_allowed_001',
      context: tenantAdminContext,
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'manage_credentials',
      result: 'allowed',
      reason: 'allowed_by_policy',
      occurredAt: '2026-06-06T09:30:00.000Z',
    });
    const invalidPayload = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_his_connection_credentials_denied_001',
      context: tenantAdminContext,
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'manage_credentials',
      reason: 'invalid_his_connection_payload',
      occurredAt: '2026-06-06T09:31:00.000Z',
    });
    const notFoundOrNotOwned = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_his_connection_credentials_denied_002',
      context: tenantAdminContext,
      resource: 'open_connection',
      resourceId: 'his_conn_002',
      action: 'manage_credentials',
      reason: 'not_found_or_not_owned',
      occurredAt: '2026-06-06T09:32:00.000Z',
    });
    const invalidTransition = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_his_connection_credentials_denied_003',
      context: tenantAdminContext,
      resource: 'open_connection',
      resourceId: 'his_conn_003',
      action: 'manage_credentials',
      reason: 'invalid_transition',
      occurredAt: '2026-06-06T09:33:00.000Z',
    });

    expect(allowed).toMatchObject({
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'manage_credentials',
      result: 'allowed',
      reason: 'allowed_by_policy',
    });
    expect(invalidPayload).toMatchObject({
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'manage_credentials',
      result: 'denied',
      reason: 'invalid_his_connection_payload',
    });
    expect(notFoundOrNotOwned).toMatchObject({
      resource: 'open_connection',
      resourceId: 'his_conn_002',
      action: 'manage_credentials',
      result: 'denied',
      reason: 'not_found_or_not_owned',
    });
    expect(invalidTransition).toMatchObject({
      resource: 'open_connection',
      resourceId: 'his_conn_003',
      action: 'manage_credentials',
      result: 'denied',
      reason: 'invalid_transition',
    });

    expect(JSON.stringify([allowed, invalidPayload, notFoundOrNotOwned, invalidTransition]))
      .not.toMatch(
        /requestBody|responseBody|credentialRef|credential_ref|idempotencyKey|synthetic_placeholder|sk_live|sk_test|token|secret|API key|connection string|raw credential|raw HIS payload|SQL|select \*|stack|DATABASE_URL/i,
      );
  });

  it('预留 HIS 连接配置凭证 provider 失败与补偿审计 reason，且不扩展 result 或敏感材料', () => {
    expect(AUDIT_REASON_VALUES).toEqual(
      expect.arrayContaining([...hisCredentialProviderFailureCompensationReasons]),
    );
    expect(AUDIT_RESULT_VALUES).toEqual(['allowed', 'denied', 'transitioned']);
    expect(AUDIT_RESULT_VALUES).not.toContain('failure');

    const events = hisCredentialProviderFailureCompensationReasons.map((reason, index) =>
      createAuditEvent({
        eventId: `audit_evt_his_connection_provider_reason_${index}`,
        context: tenantAdminContext,
        resource: 'open_connection',
        resourceId: 'his_conn_001',
        action: 'manage_credentials',
        result: reason === 'compensation_succeeded' ? 'allowed' : 'denied',
        reason,
        occurredAt: `2026-06-06T10:${String(index).padStart(2, '0')}:00.000Z`,
      }),
    );

    expect(events).toEqual(
      hisCredentialProviderFailureCompensationReasons.map((reason, index) =>
        expect.objectContaining({
          eventId: `audit_evt_his_connection_provider_reason_${index}`,
          resource: 'open_connection',
          resourceId: 'his_conn_001',
          action: 'manage_credentials',
          result: reason === 'compensation_succeeded' ? 'allowed' : 'denied',
          reason,
        }),
      ),
    );
    expect(JSON.stringify(events)).not.toMatch(
      /requestBody|responseBody|credentialRef|credential_ref|providerPath|secretPath|idempotencyKey|synthetic_placeholder|sk_live|sk_test|token|secret|API key|connection string|raw credential|raw HIS payload|SQL|select \*|stack|DATABASE_URL|vault|kms|keyId/i,
    );
  });

  it('支持 HIS 测试连接审计 action / reason，且不携带 raw provider 或凭证材料', () => {
    expect(AUDIT_REASON_VALUES).toEqual(
      expect.arrayContaining([...hisTestConnectionAuditReasons]),
    );
    expect(AUDIT_RESULT_VALUES).toEqual(['allowed', 'denied', 'transitioned']);

    const requested = createAuditEvent({
      eventId: 'audit_evt_his_test_connection_requested_001',
      context: tenantAdminContext,
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'test_connection',
      result: 'allowed',
      reason: 'test_connection_requested',
      occurredAt: '2026-06-07T09:30:00.000Z',
    });
    const providerFailed = createDeniedAccessAuditEvent({
      eventId: 'audit_evt_his_test_connection_provider_001',
      context: tenantAdminContext,
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'test_connection',
      reason: 'test_connection_missing_credential',
      occurredAt: '2026-06-07T09:31:00.000Z',
    });
    const completed = createAuditEvent({
      eventId: 'audit_evt_his_test_connection_completed_001',
      context: tenantAdminContext,
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'test_connection',
      result: 'allowed',
      reason: 'test_connection_completed',
      occurredAt: '2026-06-07T09:32:00.000Z',
    });

    expect(requested).toMatchObject({
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'test_connection',
      result: 'allowed',
      reason: 'test_connection_requested',
    });
    expect(providerFailed).toMatchObject({
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'test_connection',
      result: 'denied',
      reason: 'test_connection_missing_credential',
    });
    expect(completed).toMatchObject({
      resource: 'open_connection',
      resourceId: 'his_conn_001',
      action: 'test_connection',
      result: 'allowed',
      reason: 'test_connection_completed',
    });
    expect(JSON.stringify([requested, providerFailed, completed])).not.toMatch(
      /requestBody|responseBody|credentialRef|credential_ref|providerCode|providerRawError|endpoint|headers|sk_live|sk_test|token|secret|API key|connection string|raw credential|raw HIS payload|SQL|select \*|stack|DATABASE_URL|vault|kms|keyId/i,
    );
  });

  it('审计事件风险词列表覆盖凭证明文模式', () => {
    expect(auditForbiddenTerms).toEqual([
      'client_secret',
      'access_token',
      'refresh_token',
      'private_key',
      'webhook_secret',
      'sk_live',
      'sk_test',
      'zmtg_sk_',
    ]);

    const serialized = JSON.stringify(
      createAuditEvent({
        eventId: 'audit_evt_002',
        context: tenantAdminContext,
        resource: 'follow_up',
        action: 'review',
        result: 'allowed',
        reason: 'allowed_by_policy',
        occurredAt: '2026-05-30T09:02:00.000Z',
      }),
    ).toLowerCase();

    auditForbiddenTerms.forEach((term) => {
      expect(serialized).not.toContain(term);
    });
  });
});
