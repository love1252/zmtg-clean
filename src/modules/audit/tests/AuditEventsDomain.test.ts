import { describe, expect, it } from 'vitest';
import { AUDIT_REASON_VALUES } from '@/modules/audit/domain/audit-event-query';
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
