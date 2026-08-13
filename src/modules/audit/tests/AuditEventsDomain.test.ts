import { describe, expect, it } from 'vitest';
import {
  AUDIT_REASON_VALUES,
  AUDIT_RESULT_VALUES,
} from '@/modules/audit/domain/audit-event-query';
import {
  auditForbiddenTerms,
  createAttemptedInstitutionDenialAuditEventV1,
  createAttributedTenantAuditEventV1,
  createAuditEvent,
  createDeniedAccessAuditEvent,
  createVerifiedInstitutionAttributedTenantAuditEventV1,
  isAttributedTenantAuditEventV1,
  mintAttemptedInstitutionDenialAttributionForOrchestrationV1,
  mintVerifiedInstitutionAuditAttributionForOrchestrationV1,
  type AuditInstitutionAttributionV1,
  type TenantAuditEvent,
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

const weComRealSendProofReasons = [
  'wecom_real_send_proof_operation_requested',
  'wecom_real_send_proof_operation_aborted',
  'wecom_real_send_proof_operation_attempted',
  'wecom_real_send_proof_operation_succeeded',
  'wecom_real_send_proof_operation_failed',
  'wecom_real_send_proof_operation_unknown',
  'wecom_real_send_proof_control_blocked',
  'wecom_real_send_proof_environment_blocked',
  'wecom_real_send_proof_ready_source_blocked',
  'wecom_real_send_proof_attestation_blocked',
  'wecom_real_send_proof_readiness_changed',
  'wecom_real_send_proof_confirmation_consumed',
  'wecom_real_send_proof_confirmation_expired',
  'wecom_real_send_proof_completed_count_recorded',
] as const;

function createLegacyAuditEvent(tenantId: string | null = 'demo-tenant-001') {
  return createAuditEvent({
    eventId: 'audit-attribution-001',
    context: {
      ...tenantAdminContext,
      tenantId,
      ...(tenantId === null ? { role: 'platform_admin' as const, scope: 'platform' as const } : {}),
    },
    resource: 'audit_log',
    resourceId: 'audit-resource-001',
    action: 'review',
    result: 'allowed',
    reason: 'allowed_by_policy',
    occurredAt: '2026-08-13T08:00:00.000Z',
  });
}

describe('Audit Owner 机构归因契约', () => {
  it('verified attribution handle 仅在 formal 与 business pair 完全一致时 mint，并可在同 operation 复用', () => {
    const attribution = mintVerifiedInstitutionAuditAttributionForOrchestrationV1({
      formalPair: {
        tenantId: 'demo-tenant-001',
        institutionId: 'demo-institution-001',
        observedAt: '2026-08-13T08:00:00.000Z',
      },
      businessPair: {
        tenantId: 'demo-tenant-001',
        institutionId: 'demo-institution-001',
      },
    });

    expect(attribution).not.toBeNull();
    if (!attribution) throw new Error('expected verified attribution handle');
    expect(Object.isFrozen(attribution)).toBe(true);
    expect(Reflect.ownKeys(attribution)).toEqual([]);
    const first = createVerifiedInstitutionAttributedTenantAuditEventV1({
      event: createLegacyAuditEvent(),
      attribution,
    });
    const second = createVerifiedInstitutionAttributedTenantAuditEventV1({
      event: { ...createLegacyAuditEvent(), eventId: 'audit-attribution-002' },
      attribution,
    });
    expect(first).toMatchObject({
      institutionAttribution: 'verified',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-institution-001',
    });
    expect(second).toMatchObject({
      eventId: 'audit-attribution-002',
      institutionAttribution: 'verified',
    });
  });

  it('verified attribution handle 对 pair mismatch、非法时间与 shape-only handle fail-closed', () => {
    expect(
      mintVerifiedInstitutionAuditAttributionForOrchestrationV1({
        formalPair: {
          tenantId: 'demo-tenant-001',
          institutionId: 'demo-institution-001',
          observedAt: '2026-08-13T08:00:00.000Z',
        },
        businessPair: {
          tenantId: 'demo-tenant-001',
          institutionId: 'other-institution',
        },
      }),
    ).toBeNull();
    expect(
      mintVerifiedInstitutionAuditAttributionForOrchestrationV1({
        formalPair: {
          tenantId: 'demo-tenant-001',
          institutionId: 'demo-institution-001',
          observedAt: 'not-a-time',
        },
        businessPair: {
          tenantId: 'demo-tenant-001',
          institutionId: 'demo-institution-001',
        },
      }),
    ).toBeNull();
    expect(
      createVerifiedInstitutionAttributedTenantAuditEventV1({
        event: createLegacyAuditEvent(),
        attribution: Object.freeze({}) as never,
      }),
    ).toBeNull();
  });

  it('attempted-denial handle 仅接受签名 pair 对应的 denied event，持久化为 verified target attribution', () => {
    const attribution = mintAttemptedInstitutionDenialAttributionForOrchestrationV1({
      signedSessionPair: {
        tenantId: 'demo-tenant-001',
        institutionId: 'demo-institution-001',
      },
    });
    expect(attribution).not.toBeNull();
    if (!attribution) throw new Error('expected attempted-denial attribution handle');

    const deniedEvent = {
      ...createLegacyAuditEvent(),
      result: 'denied' as const,
      reason: 'role_denied' as const,
    };
    expect(
      createAttemptedInstitutionDenialAuditEventV1({
        event: deniedEvent,
        attemptedPair: {
          tenantId: 'demo-tenant-001',
          institutionId: 'demo-institution-001',
        },
        attribution,
      }),
    ).toMatchObject({
      result: 'denied',
      institutionAttribution: 'verified',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-institution-001',
    });
    expect(
      createAttemptedInstitutionDenialAuditEventV1({
        event: deniedEvent,
        attemptedPair: {
          tenantId: 'demo-tenant-001',
          institutionId: 'other-institution',
        },
        attribution,
      }),
    ).toBeNull();
    expect(
      createAttemptedInstitutionDenialAuditEventV1({
        event: createLegacyAuditEvent(),
        attemptedPair: {
          tenantId: 'demo-tenant-001',
          institutionId: 'demo-institution-001',
        },
        attribution,
      }),
    ).toBeNull();
  });

  it('创建字段白名单且冻结的 verified attributed event', () => {
    const event = Object.assign(createLegacyAuditEvent(), {
      credential: 'credential-must-not-survive',
      requestBody: { institutionId: 'fake-institution' },
      scopeHandle: { tenantId: 'demo-tenant-001' },
      session: { cookie: 'secret' },
    });
    const attribution = {
      institutionAttribution: 'verified',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-institution-001',
      provenance: 'must-not-survive',
    } as AuditInstitutionAttributionV1 & { provenance: string };

    const attributed = createAttributedTenantAuditEventV1({ event, attribution });

    expect(attributed).toEqual({
      eventId: 'audit-attribution-001',
      actorId: 'demo-user-admin',
      actorRole: 'tenant_admin',
      tenantId: 'demo-tenant-001',
      institutionId: 'demo-institution-001',
      institutionAttribution: 'verified',
      scope: 'tenant',
      resource: 'audit_log',
      resourceId: 'audit-resource-001',
      action: 'review',
      result: 'allowed',
      reason: 'allowed_by_policy',
      occurredAt: '2026-08-13T08:00:00.000Z',
      source: 'demo_session',
    });
    expect(Object.isFrozen(attributed)).toBe(true);
    expect(isAttributedTenantAuditEventV1(attributed)).toBe(true);
    expect(attributed).not.toHaveProperty('credential');
    expect(attributed).not.toHaveProperty('provenance');
    expect(attributed).not.toHaveProperty('requestBody');
    expect(attributed).not.toHaveProperty('scopeHandle');
    expect(attributed).not.toHaveProperty('session');
  });

  it('创建 tenant-scoped 与 global not_applicable attributed event', () => {
    const tenantAttributed = createAttributedTenantAuditEventV1({
      event: createLegacyAuditEvent(),
      attribution: {
        institutionAttribution: 'not_applicable',
        tenantId: 'demo-tenant-001',
        institutionId: null,
      },
    });
    const globalAttributed = createAttributedTenantAuditEventV1({
      event: createLegacyAuditEvent(null),
      attribution: {
        institutionAttribution: 'not_applicable',
        tenantId: null,
        institutionId: null,
      },
    });

    expect(tenantAttributed).toMatchObject({
      tenantId: 'demo-tenant-001',
      institutionId: null,
      institutionAttribution: 'not_applicable',
    });
    expect(globalAttributed).toMatchObject({
      tenantId: null,
      institutionId: null,
      institutionAttribution: 'not_applicable',
      scope: 'platform',
    });
    expect(isAttributedTenantAuditEventV1(tenantAttributed)).toBe(true);
    expect(isAttributedTenantAuditEventV1(globalAttributed)).toBe(true);
  });

  it('拒绝非法归因组合、tenant mismatch、unknown 与 legacy_unattributed', () => {
    const tenantEvent = createLegacyAuditEvent();
    const invalidCases: Array<{
      event?: TenantAuditEvent;
      attribution: unknown;
    }> = [
      {
        attribution: {
          institutionAttribution: 'verified', tenantId: null, institutionId: 'inst-001',
        },
      },
      {
        attribution: {
          institutionAttribution: 'verified', tenantId: '', institutionId: 'inst-001',
        },
      },
      {
        attribution: {
          institutionAttribution: 'verified', tenantId: ' tenant-001 ', institutionId: 'inst-001',
        },
      },
      {
        attribution: {
          institutionAttribution: 'verified', tenantId: 'demo-tenant-001', institutionId: null,
        },
      },
      {
        attribution: {
          institutionAttribution: 'verified', tenantId: 'demo-tenant-001', institutionId: '',
        },
      },
      {
        attribution: {
          institutionAttribution: 'verified', tenantId: 'other-tenant', institutionId: 'inst-001',
        },
      },
      {
        attribution: {
          institutionAttribution: 'not_applicable',
          tenantId: 'demo-tenant-001',
          institutionId: 'inst-001',
        },
      },
      {
        attribution: {
          institutionAttribution: 'not_applicable', tenantId: 'other-tenant', institutionId: null,
        },
      },
      {
        attribution: {
          institutionAttribution: 'unknown', tenantId: 'demo-tenant-001', institutionId: null,
        },
      },
      {
        attribution: {
          institutionAttribution: 'legacy_unattributed',
          tenantId: 'demo-tenant-001',
          institutionId: null,
        },
      },
      { attribution: undefined },
    ];

    for (const invalidCase of invalidCases) {
      expect(
        createAttributedTenantAuditEventV1({
          event: invalidCase.event ?? tenantEvent,
          attribution: invalidCase.attribution as AuditInstitutionAttributionV1,
        }),
      ).toBeNull();
    }
  });

  it('拒绝缺少 legacy event 必填字段或伪造字段的 attributed object', () => {
    const { actorId: _actorId, ...eventWithoutActor } = createLegacyAuditEvent();
    const valid = createAttributedTenantAuditEventV1({
      event: createLegacyAuditEvent(),
      attribution: {
        institutionAttribution: 'verified',
        tenantId: 'demo-tenant-001',
        institutionId: 'demo-institution-001',
      },
    });

    expect(
      createAttributedTenantAuditEventV1({
        event: eventWithoutActor as TenantAuditEvent,
        attribution: {
          institutionAttribution: 'verified',
          tenantId: 'demo-tenant-001',
          institutionId: 'demo-institution-001',
        },
      }),
    ).toBeNull();
    expect(isAttributedTenantAuditEventV1({ ...valid, credential: 'secret' })).toBe(false);
    expect(isAttributedTenantAuditEventV1({ ...valid, actorId: undefined })).toBe(false);
    expect(isAttributedTenantAuditEventV1(createLegacyAuditEvent())).toBe(false);
    expect(
      isAttributedTenantAuditEventV1({
        ...valid,
        institutionAttribution: 'legacy_unattributed',
      }),
    ).toBe(false);
    expect(
      isAttributedTenantAuditEventV1(
        new Proxy({}, { ownKeys: () => { throw new Error('proxy trap'); } }),
      ),
    ).toBe(false);
  });

  it('保持 legacy TenantAuditEvent 工厂签名且不伪造机构归因', () => {
    const legacyEvent = createLegacyAuditEvent();

    expect(legacyEvent).toMatchObject({
      tenantId: 'demo-tenant-001',
      resource: 'audit_log',
    });
    expect(legacyEvent).not.toHaveProperty('institutionId');
    expect(legacyEvent).not.toHaveProperty('institutionAttribution');
  });
});

describe('审计事件领域模型', () => {
  it('固定真实发送 proof 审计 reason 白名单且事件仅含低敏结构字段', () => {
    expect(AUDIT_REASON_VALUES).toEqual(expect.arrayContaining([...weComRealSendProofReasons]));
    for (const reason of weComRealSendProofReasons) {
      const event = createAuditEvent({
        eventId: `audit-${reason}`,
        context: {
          userId: 'formal-admin-a', role: 'tenant_admin', scope: 'tenant', tenantId: 'tenant-a',
          institutionId: 'inst-a', source: 'server_session',
        },
        resource: 'real_channel',
        resourceId: 'wrsproof-low-sensitive-a',
        action: 'execute_once',
        result: reason.includes('blocked') || reason.includes('expired') ? 'denied' : 'transitioned',
        reason,
        occurredAt: '2026-07-12T08:00:00.000Z',
      });
      expect(event).toMatchObject({
        action: 'execute_once', source: 'server_session', reason,
        resourceId: 'wrsproof-low-sensitive-a',
      });
      expect(JSON.stringify(event)).not.toMatch(
        /confirmationToken|opaque-token|external_userid|userid|providerRaw|rawResponse|access_token|secret|https?:\/\//i,
      );
    }
  });

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
        'quota_exceeded_knowledge_files',
        'quota_exceeded_staff_seats',
        'quota_exceeded_ai_calls',
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
      expect.arrayContaining([
        'tenant_plan_assignment_created',
        'tenant_account_created',
        'tenant_account_password_reset',
        'tenant_account_disabled',
        'tenant_account_enabled',
        'tenant_login_succeeded',
        'tenant_login_failed',
      ]),
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

    for (const reason of [
      'tenant_account_password_reset',
      'tenant_account_disabled',
      'tenant_account_enabled',
    ] as const) {
      expect(
        createAuditEvent({
          eventId: `audit_evt_${reason}`,
          context: {
            userId: 'demo-user-platform',
            role: 'platform_admin',
            scope: 'platform',
            tenantId: null,
            source: 'demo_session',
          },
          resource: 'tenant_member',
          resourceId: 'tenant-member-chenlei',
          action: reason === 'tenant_account_password_reset' ? 'manage_credentials' : 'manage_status',
          result: 'transitioned',
          reason,
          occurredAt: '2026-06-25T09:00:00.000Z',
        }),
      ).toMatchObject({
        resource: 'tenant_member',
        resourceId: 'tenant-member-chenlei',
        result: 'transitioned',
        reason,
      });
    }

    for (const [reason, result] of [
      ['tenant_login_succeeded', 'allowed'],
      ['tenant_login_failed', 'denied'],
    ] as const) {
      expect(
        createAuditEvent({
          eventId: `audit_evt_${reason}`,
          context: {
            userId: 'auth-user-chenlei',
            role: 'tenant_admin',
            scope: 'tenant',
            tenantId: 'tenant-zhengpu',
            source: 'server_session',
          },
          resource: 'tenant_member',
          resourceId: 'tenant-member-chenlei',
          action: 'read_own_tenant',
          result,
          reason,
          occurredAt: '2026-06-25T09:05:00.000Z',
        }),
      ).toMatchObject({
        resource: 'tenant_member',
        resourceId: 'tenant-member-chenlei',
        action: 'read_own_tenant',
        result,
        reason,
      });
    }
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

  it('支持可信触达固定审计原因且不携带敏感证据', () => {
    const reasons = [
      'wecom_reachout_consent_recorded',
      'wecom_reachout_opt_out_recorded',
      'wecom_reachout_consent_revoked',
      'wecom_reachout_dry_run_snapshot_ready',
      'wecom_reachout_dry_run_snapshot_blocked',
      'wecom_reachout_frequency_reserved',
      'wecom_reachout_frequency_blocked',
    ] as const;
    expect(AUDIT_REASON_VALUES).toEqual(expect.arrayContaining([...reasons]));
    const events = reasons.map((reason, index) => createAuditEvent({
      eventId: `audit_evt_reachout_${index}`,
      context: tenantAdminContext,
      resource: reason.includes('dry_run') ? 'real_channel' : 'customer',
      resourceId: reason.includes('dry_run') ? null : 'customer-low-sensitive-1',
      action: reason.includes('dry_run') ? 'review' : 'update',
      result: reason.endsWith('blocked') ? 'denied' : 'transitioned',
      reason,
      occurredAt: `2026-07-11T10:0${index}:00.000Z`,
    }));
    expect(JSON.stringify(events)).not.toMatch(
      /evidenceRef|freeText|secret|token|corpId|UserID|agentId|callbackUrl|rawPayload/i,
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
