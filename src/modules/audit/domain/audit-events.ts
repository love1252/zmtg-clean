import type {
  AccessContext,
  AccessDecision,
  ProtectedAction,
  ProtectedResource,
} from '@/modules/security/domain/access-control';

export type AuditResult = 'allowed' | 'denied' | 'transitioned';

export type AuditReason =
  | AccessDecision['reason']
  | 'invalid_transition'
  | 'stale_transition'
  | 'not_found_or_not_owned'
  | 'invalid_his_connection_payload'
  | 'his_connection_name_conflict'
  | 'invalid_treatment_summary_reference'
  | 'invalid_treatment_summary_payload'
  | 'treatment_summary_voided'
  | 'treatment_summary_already_voided'
  | 'invalid_treatment_summary_void_payload'
  | 'voided_treatment_summary_follow_up_blocked'
  | 'invalid_follow_up_suggestion'
  | 'active_source_follow_up_exists'
  | 'active_follow_up_path_enrollment_exists'
  | 'follow_up_path_enrollment_not_active'
  | 'no_matching_template'
  | 'follow_up_message_draft_exists'
  | 'follow_up_message_draft_not_draft'
  | 'follow_up_message_draft_not_approved'
  | 'unsafe_follow_up_message_content'
  | 'message_draft_created'
  | 'message_draft_updated'
  | 'message_draft_approved'
  | 'message_draft_rejected'
  | 'message_draft_marked_sent'
  | 'message_draft_cancelled'
  | 'message_delivery_created'
  | 'message_delivery_exists'
  | 'message_delivery_mock_sent'
  | 'message_delivery_mock_failed'
  | 'message_delivery_skipped'
  | 'message_delivery_external_disabled'
  | 'contact_safety_allowed'
  | 'contact_safety_consent_missing'
  | 'contact_safety_opt_out'
  | 'contact_safety_frequency_cap_reached'
  | 'channel_gray_tenant_blocked'
  | 'channel_gray_institution_blocked'
  | 'channel_gray_external_disabled'
  | 'wecom_mock_authorization_read'
  | 'wecom_mock_authorization_unavailable'
  | 'wecom_channel_default_closed'
  | 'wecom_reach_out_unauthorized'
  | 'quota_exceeded_customers'
  | 'quota_exceeded_appointments'
  | 'quota_exceeded_knowledge_items'
  | 'quota_exceeded_knowledge_files'
  | 'quota_exceeded_knowledge_total_storage_mb'
  | 'quota_exceeded_knowledge_single_file_size_mb'
  | 'quota_exceeded_knowledge_parse_jobs_monthly'
  | 'quota_exceeded_knowledge_embedding_jobs_monthly'
  | 'quota_exceeded_knowledge_ocr_jobs_monthly'
  | 'quota_exceeded_knowledge_rag_answers_monthly'
  | 'quota_exceeded_knowledge_index_rebuild_jobs_monthly'
  | 'quota_exceeded_staff_seats'
  | 'quota_exceeded_ai_calls'
  | 'missing_active_plan'
  | 'missing_quota_limit'
  | 'feature_disabled'
  | 'tenant_plan_assignment_created'
  | 'tenant_account_created'
  | 'tenant_account_password_reset'
  | 'tenant_account_disabled'
  | 'tenant_account_enabled'
  | 'tenant_login_succeeded'
  | 'tenant_login_failed'
  | 'tenant_plan_changed'
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'provider_retry_exhausted'
  | 'provider_circuit_open'
  | 'provider_validation_failed'
  | 'provider_write_failed'
  | 'provider_revoke_failed'
  | 'provider_describe_failed'
  | 'provider_health_failed'
  | 'repository_after_provider_failed'
  | 'audit_after_provider_failed'
  | 'test_connection_requested'
  | 'test_connection_provider_healthy'
  | 'test_connection_missing_credential'
  | 'test_connection_unsupported_vendor'
  | 'test_connection_limited_health_probe'
  | 'test_connection_external_unreachable'
  | 'test_connection_provider_timeout'
  | 'test_connection_connection_not_active'
  | 'test_connection_completed'
  | 'compensation_pending'
  | 'compensation_running'
  | 'compensation_succeeded'
  | 'compensation_failed'
  | 'manual_review_required';

export type TenantAuditEvent = {
  eventId: string;
  actorId: string;
  actorRole: AccessContext['role'];
  tenantId: string | null;
  scope: AccessContext['scope'];
  resource: ProtectedResource;
  resourceId?: string | null;
  action: ProtectedAction;
  result: AuditResult;
  reason: AuditReason;
  occurredAt: string;
  source: AccessContext['source'];
};

export const auditForbiddenTerms = [
  'client_secret',
  'access_token',
  'refresh_token',
  'private_key',
  'webhook_secret',
  'sk_live',
  'sk_test',
  'zmtg_sk_',
] as const;

export function createAuditEvent(input: {
  eventId: string;
  context: AccessContext;
  resource: ProtectedResource;
  resourceId?: string | null;
  action: ProtectedAction;
  result: AuditResult;
  reason: AuditReason;
  occurredAt: string;
}): TenantAuditEvent {
  return {
    eventId: input.eventId,
    actorId: input.context.userId,
    actorRole: input.context.role,
    tenantId: input.context.tenantId,
    scope: input.context.scope,
    resource: input.resource,
    ...(input.resourceId == null ? {} : { resourceId: input.resourceId }),
    action: input.action,
    result: input.result,
    reason: input.reason,
    occurredAt: input.occurredAt,
    source: input.context.source,
  };
}

export function createDeniedAccessAuditEvent(input: {
  eventId: string;
  context: AccessContext;
  resource: ProtectedResource;
  resourceId?: string | null;
  action: ProtectedAction;
  reason: Extract<AccessDecision, { allowed: false }>['reason'] | AuditReason;
  occurredAt: string;
}): TenantAuditEvent {
  return createAuditEvent({
    eventId: input.eventId,
    context: input.context,
    resource: input.resource,
    resourceId: input.resourceId,
    action: input.action,
    result: 'denied',
    reason: input.reason,
    occurredAt: input.occurredAt,
  });
}
