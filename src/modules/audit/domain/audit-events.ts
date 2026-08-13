import {
  ACCESS_ACTIONS,
  ACCESS_RESOURCES,
  ACCESS_ROLES,
  type AccessContext,
  type AccessDecision,
  type ProtectedAction,
  type ProtectedResource,
} from '@/modules/security/domain/access-control';
import { AUDIT_REASON_VALUES } from '@/modules/audit/domain/audit-event-query';

export type AuditResult = 'allowed' | 'denied' | 'transitioned';

export type AuditReason =
  | AccessDecision['reason']
  | 'permission_denied'
  | 'sensitive_output_blocked'
  | 'safety_switch_read'
  | 'safety_switch_updated'
  | 'real_channel_enable_blocked'
  | 'real_channel_disabled'
  | 'customer_import_permission_checked'
  | 'message_delivery_permission_checked'
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
  | 'wecom_mock_customer_contact_unavailable'
  | 'wecom_mock_reachout_created'
  | 'wecom_mock_reachout_sent'
  | 'wecom_mock_reachout_failed'
  | 'wecom_mock_reachout_skipped'
  | 'wecom_mock_reachout_external_disabled'
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
  | 'manual_review_required'
  | 'customer_import_previewed'
  | 'customer_import_completed'
  | 'customer_import_partially_completed'
  | 'customer_import_rejected'
  | 'customer_import_sensitive_field_blocked'
  | 'ai_conversation_viewed'
  | 'ai_conversation_takeover'
  | 'ai_conversation_recommendation_used'
  | 'ai_conversation_message_mock_sent'
  | 'ai_conversation_risk_blocked'
  | 'ai_conversation_closed'
  | 'ai_auto_strategy_evaluated'
  | 'ai_auto_reply_mock_allowed'
  | 'ai_auto_followup_mock_allowed'
  | 'ai_auto_reply_human_confirmation_required'
  | 'ai_auto_followup_human_confirmation_required'
  | 'ai_auto_reply_blocked'
  | 'ai_auto_followup_blocked'
  | 'ai_marketing_automation_blocked'
  | 'ai_add_friend_blocked'
  | 'real_channel_preflight_viewed'
  | 'real_channel_preflight_evaluated'
  | 'real_channel_preflight_blocked'
  | 'real_channel_proof_mock_eligible'
  | 'real_channel_sensitive_config_blocked'
  | 'account_custody_route_blocked'
  | 'wecom_dry_run_config_viewed'
  | 'wecom_dry_run_config_evaluated'
  | 'wecom_dry_run_ready'
  | 'wecom_dry_run_blocked'
  | 'wecom_dry_run_sensitive_value_blocked'
  | 'wecom_dry_run_secret_read_blocked'
  | 'wecom_official_dry_run_viewed'
  | 'wecom_official_dry_run_evaluated'
  | 'wecom_official_dry_run_plan_ready'
  | 'wecom_official_dry_run_mock_completed'
  | 'wecom_official_dry_run_blocked'
  | 'wecom_official_dry_run_sensitive_payload_blocked'
  | 'wecom_official_dry_run_real_network_blocked'
  | 'wecom_official_dry_run_real_send_blocked'
  | 'wecom_customer_mapping_confirmed'
  | 'wecom_customer_mapping_rejected'
  | 'wecom_customer_mapping_revoked'
  | 'wecom_customer_mapping_conflict_blocked'
  | 'wecom_customer_mapping_invalid_transition'
  | 'wecom_customer_mapping_customer_not_found'
  | 'wecom_reachout_consent_recorded'
  | 'wecom_reachout_opt_out_recorded'
  | 'wecom_reachout_consent_revoked'
  | 'wecom_reachout_dry_run_snapshot_ready'
  | 'wecom_reachout_dry_run_snapshot_blocked'
  | 'wecom_reachout_frequency_reserved'
  | 'wecom_reachout_frequency_blocked'
  | 'wecom_controlled_reachout_ready_no_send'
  | 'wecom_controlled_reachout_draft_not_found'
  | 'wecom_controlled_reachout_draft_not_approved'
  | 'wecom_controlled_reachout_delivery_missing'
  | 'wecom_controlled_reachout_delivery_not_unique'
  | 'wecom_controlled_reachout_delivery_customer_mismatch'
  | 'wecom_controlled_reachout_delivery_not_internal_mock'
  | 'wecom_controlled_reachout_mapping_not_confirmed'
  | 'wecom_controlled_reachout_mapping_customer_mismatch'
  | 'wecom_controlled_reachout_customer_not_found'
  | 'wecom_controlled_reachout_consent_missing'
  | 'wecom_controlled_reachout_consent_revoked'
  | 'wecom_controlled_reachout_opt_out'
  | 'wecom_controlled_reachout_frequency_cap_reached'
  | 'wecom_controlled_reachout_dry_run_not_ready'
  | 'wecom_controlled_reachout_manual_confirmation_invalid'
  | 'wecom_controlled_reachout_invalid_request'
  | 'wecom_controlled_reachout_body_too_large'
  | 'wecom_controlled_reachout_conflict'
  | 'wecom_real_send_proof_operation_requested'
  | 'wecom_real_send_proof_operation_aborted'
  | 'wecom_real_send_proof_operation_attempted'
  | 'wecom_real_send_proof_operation_succeeded'
  | 'wecom_real_send_proof_operation_failed'
  | 'wecom_real_send_proof_operation_unknown'
  | 'wecom_real_send_proof_control_blocked'
  | 'wecom_real_send_proof_environment_blocked'
  | 'wecom_real_send_proof_ready_source_blocked'
  | 'wecom_real_send_proof_attestation_blocked'
  | 'wecom_real_send_proof_readiness_changed'
  | 'wecom_real_send_proof_confirmation_consumed'
  | 'wecom_real_send_proof_confirmation_expired'
  | 'wecom_real_send_proof_completed_count_recorded';

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

export type AuditInstitutionAttributionV1 =
  | Readonly<{
      institutionAttribution: 'verified';
      tenantId: string;
      institutionId: string;
    }>
  | Readonly<{
      institutionAttribution: 'not_applicable';
      tenantId: string | null;
      institutionId: null;
    }>;

export type AttributedTenantAuditEventV1 = Readonly<
  Omit<TenantAuditEvent, 'tenantId'> & AuditInstitutionAttributionV1
>;

export type AttemptedInstitutionDenialAuditEventV1 = Readonly<
  Omit<TenantAuditEvent, 'tenantId'> & {
    tenantId: string;
    institutionId: string;
    institutionAttribution: null;
  }
>;

export type InstitutionAuditWriterEventV1 =
  | AttributedTenantAuditEventV1
  | AttemptedInstitutionDenialAuditEventV1;

declare const verifiedInstitutionAuditAttributionMarkerV1: unique symbol;

export type VerifiedInstitutionAuditAttributionHandleV1 = Readonly<{
  readonly [verifiedInstitutionAuditAttributionMarkerV1]:
    'verified_institution_audit_attribution_v1';
}>;

declare const attemptedInstitutionDenialAttributionMarkerV1: unique symbol;

export type AttemptedInstitutionDenialAttributionHandleV1 = Readonly<{
  readonly [attemptedInstitutionDenialAttributionMarkerV1]:
    'attempted_institution_denial_attribution_v1';
}>;

export type InstitutionAuditEventAttributionV1 =
  | Readonly<{
      kind: 'verified';
      attribution: VerifiedInstitutionAuditAttributionHandleV1;
    }>
  | Readonly<{
      kind: 'attempted_denial';
      attribution: AttemptedInstitutionDenialAttributionHandleV1;
      attemptedPair: Readonly<{ tenantId: string; institutionId: string }>;
    }>;

const auditScopes = ['platform', 'tenant'] as const;
const auditSources = ['demo_session', 'server_session', 'trusted_gateway'] as const;
const auditResults = ['allowed', 'denied', 'transitioned'] as const;

const legacyAuditEventRequiredKeys = [
  'eventId',
  'actorId',
  'actorRole',
  'tenantId',
  'scope',
  'resource',
  'action',
  'result',
  'reason',
  'occurredAt',
  'source',
] as const;

const attributedAuditEventAllowedKeys = new Set<PropertyKey>([
  ...legacyAuditEventRequiredKeys,
  'resourceId',
  'institutionId',
  'institutionAttribution',
]);
const verifiedInstitutionAuditAttributionHandlesV1 = new WeakMap<
  object,
  Extract<AuditInstitutionAttributionV1, { institutionAttribution: 'verified' }>
>();
const attemptedInstitutionDenialAttributionHandlesV1 = new WeakMap<
  object,
  Readonly<{ tenantId: string; institutionId: string }>
>();

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isCanonicalNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isOneOf(values: readonly string[], value: unknown): value is string {
  return typeof value === 'string' && values.includes(value);
}

function isLegacyTenantAuditEvent(value: unknown): value is TenantAuditEvent {
  if (!isRecord(value)) return false;
  if (legacyAuditEventRequiredKeys.some((key) => !hasOwn(value, key))) return false;

  return (
    isCanonicalNonEmptyString(value.eventId) &&
    isCanonicalNonEmptyString(value.actorId) &&
    isOneOf(ACCESS_ROLES, value.actorRole) &&
    (value.tenantId === null || isCanonicalNonEmptyString(value.tenantId)) &&
    isOneOf(auditScopes, value.scope) &&
    isOneOf(ACCESS_RESOURCES, value.resource) &&
    (!hasOwn(value, 'resourceId') ||
      value.resourceId === null ||
      isCanonicalNonEmptyString(value.resourceId)) &&
    isOneOf(ACCESS_ACTIONS, value.action) &&
    isOneOf(auditResults, value.result) &&
    isOneOf(AUDIT_REASON_VALUES, value.reason) &&
    isCanonicalNonEmptyString(value.occurredAt) &&
    Number.isFinite(Date.parse(value.occurredAt)) &&
    isOneOf(auditSources, value.source)
  );
}

function hasOnlyAttributedAuditEventKeys(value: Record<PropertyKey, unknown>): boolean {
  return Reflect.ownKeys(value).every((key) => attributedAuditEventAllowedKeys.has(key));
}

function isAuditInstitutionAttributionV1(
  value: unknown,
): value is AuditInstitutionAttributionV1 {
  if (!isRecord(value)) return false;

  if (value.institutionAttribution === 'verified') {
    return (
      isCanonicalNonEmptyString(value.tenantId) &&
      isCanonicalNonEmptyString(value.institutionId)
    );
  }

  if (value.institutionAttribution === 'not_applicable') {
    return (
      (value.tenantId === null || isCanonicalNonEmptyString(value.tenantId)) &&
      value.institutionId === null
    );
  }

  return false;
}

export function createAttributedTenantAuditEventV1(input: {
  event: TenantAuditEvent;
  attribution: AuditInstitutionAttributionV1;
}): AttributedTenantAuditEventV1 | null {
  try {
    if (!isRecord(input)) return null;
    if (!isLegacyTenantAuditEvent(input.event)) return null;
    if (!isAuditInstitutionAttributionV1(input.attribution)) return null;
    if (input.event.tenantId !== input.attribution.tenantId) return null;

    const eventFields = {
      eventId: input.event.eventId,
      actorId: input.event.actorId,
      actorRole: input.event.actorRole,
      scope: input.event.scope,
      resource: input.event.resource,
      ...(input.event.resourceId === undefined ? {} : { resourceId: input.event.resourceId }),
      action: input.event.action,
      result: input.event.result,
      reason: input.event.reason,
      occurredAt: input.event.occurredAt,
      source: input.event.source,
    };

    if (input.attribution.institutionAttribution === 'verified') {
      return Object.freeze({
        ...eventFields,
        tenantId: input.attribution.tenantId,
        institutionId: input.attribution.institutionId,
        institutionAttribution: 'verified' as const,
      });
    }

    return Object.freeze({
      ...eventFields,
      tenantId: input.attribution.tenantId,
      institutionId: null,
      institutionAttribution: 'not_applicable' as const,
    });
  } catch {
    return null;
  }
}

/**
 * Audit-owned mint called by server orchestration after S6 formal scope has been consumed.
 * The handle is operation-bound, opaque and reusable for multiple events in that operation.
 */
export function mintVerifiedInstitutionAuditAttributionForOrchestrationV1(input: {
  formalPair: Readonly<{ tenantId: string; institutionId: string; observedAt: string }>;
  businessPair: Readonly<{ tenantId: string; institutionId: string }>;
}): VerifiedInstitutionAuditAttributionHandleV1 | null {
  try {
    if (!isRecord(input) || !isRecord(input.formalPair) || !isRecord(input.businessPair)) {
      return null;
    }
    if (
      !isCanonicalNonEmptyString(input.formalPair.tenantId) ||
      !isCanonicalNonEmptyString(input.formalPair.institutionId) ||
      !isCanonicalNonEmptyString(input.formalPair.observedAt) ||
      !Number.isFinite(Date.parse(input.formalPair.observedAt)) ||
      !isCanonicalNonEmptyString(input.businessPair.tenantId) ||
      !isCanonicalNonEmptyString(input.businessPair.institutionId) ||
      input.formalPair.tenantId !== input.businessPair.tenantId ||
      input.formalPair.institutionId !== input.businessPair.institutionId
    ) {
      return null;
    }

    const handle = Object.freeze({}) as VerifiedInstitutionAuditAttributionHandleV1;
    verifiedInstitutionAuditAttributionHandlesV1.set(
      handle,
      Object.freeze({
        institutionAttribution: 'verified',
        tenantId: input.formalPair.tenantId,
        institutionId: input.formalPair.institutionId,
      }),
    );
    return handle;
  } catch {
    return null;
  }
}

/**
 * Audit-owned mint called only by orchestration after formal server-session claims are verified.
 * It does not imply authorization or active membership; it identifies the denied target pair.
 */
export function mintAttemptedInstitutionDenialAttributionForOrchestrationV1(input: {
  signedSessionPair: Readonly<{ tenantId: string; institutionId: string }>;
}): AttemptedInstitutionDenialAttributionHandleV1 | null {
  try {
    if (!isRecord(input) || !isRecord(input.signedSessionPair)) return null;
    if (
      !isCanonicalNonEmptyString(input.signedSessionPair.tenantId) ||
      !isCanonicalNonEmptyString(input.signedSessionPair.institutionId)
    ) {
      return null;
    }

    const handle = Object.freeze({}) as AttemptedInstitutionDenialAttributionHandleV1;
    attemptedInstitutionDenialAttributionHandlesV1.set(
      handle,
      Object.freeze({
        tenantId: input.signedSessionPair.tenantId,
        institutionId: input.signedSessionPair.institutionId,
      }),
    );
    return handle;
  } catch {
    return null;
  }
}

export function createVerifiedInstitutionAttributedTenantAuditEventV1(input: {
  event: TenantAuditEvent;
  attribution: VerifiedInstitutionAuditAttributionHandleV1;
}): AttributedTenantAuditEventV1 | null {
  try {
    if (!isRecord(input)) return null;
    const attribution = verifiedInstitutionAuditAttributionHandlesV1.get(input.attribution);
    if (!attribution) return null;
    return createAttributedTenantAuditEventV1({ event: input.event, attribution });
  } catch {
    return null;
  }
}

export function createAttemptedInstitutionDenialAuditEventV1(input: {
  event: TenantAuditEvent;
  attemptedPair: Readonly<{ tenantId: string; institutionId: string }>;
  attribution: AttemptedInstitutionDenialAttributionHandleV1;
}): AttemptedInstitutionDenialAuditEventV1 | null {
  try {
    if (!isRecord(input) || !isRecord(input.attemptedPair) || input.event.result !== 'denied') {
      return null;
    }
    const attribution = attemptedInstitutionDenialAttributionHandlesV1.get(input.attribution);
    if (
      !attribution ||
      input.attemptedPair.tenantId !== attribution.tenantId ||
      input.attemptedPair.institutionId !== attribution.institutionId ||
      (input.event.tenantId !== null && input.event.tenantId !== attribution.tenantId)
    ) {
      return null;
    }
    const event = { ...input.event, tenantId: attribution.tenantId };
    if (!isLegacyTenantAuditEvent(event)) return null;
    return Object.freeze({
      eventId: event.eventId,
      actorId: event.actorId,
      actorRole: event.actorRole,
      tenantId: attribution.tenantId,
      institutionId: attribution.institutionId,
      institutionAttribution: null,
      scope: event.scope,
      resource: event.resource,
      ...(event.resourceId === undefined ? {} : { resourceId: event.resourceId }),
      action: event.action,
      result: event.result,
      reason: event.reason,
      occurredAt: event.occurredAt,
      source: event.source,
    });
  } catch {
    return null;
  }
}

export function createInstitutionAttributedTenantAuditEventV1(input: {
  event: TenantAuditEvent;
  attribution: InstitutionAuditEventAttributionV1;
}): InstitutionAuditWriterEventV1 | null {
  try {
    if (!isRecord(input) || !isRecord(input.attribution)) return null;
    if (input.attribution.kind === 'verified') {
      return createVerifiedInstitutionAttributedTenantAuditEventV1({
        event: input.event,
        attribution: input.attribution.attribution,
      });
    }
    if (input.attribution.kind === 'attempted_denial') {
      return createAttemptedInstitutionDenialAuditEventV1({
        event: input.event,
        attemptedPair: input.attribution.attemptedPair,
        attribution: input.attribution.attribution,
      });
    }
    return null;
  } catch {
    return null;
  }
}

export function isAttemptedInstitutionDenialAuditEventV1(
  value: unknown,
): value is AttemptedInstitutionDenialAuditEventV1 {
  try {
    if (!isRecord(value)) return false;
    if (!hasOnlyAttributedAuditEventKeys(value) || !isLegacyTenantAuditEvent(value)) {
      return false;
    }
    const candidate = value as Record<PropertyKey, unknown>;
    return (
      candidate.result === 'denied' &&
      isCanonicalNonEmptyString(candidate.tenantId) &&
      isCanonicalNonEmptyString(candidate.institutionId) &&
      candidate.institutionAttribution === null
    );
  } catch {
    return false;
  }
}

export function isAttributedTenantAuditEventV1(
  value: unknown,
): value is AttributedTenantAuditEventV1 {
  try {
    return (
      isRecord(value) &&
      hasOnlyAttributedAuditEventKeys(value) &&
      isLegacyTenantAuditEvent(value) &&
      hasOwn(value, 'institutionId') &&
      hasOwn(value, 'institutionAttribution') &&
      isAuditInstitutionAttributionV1(value)
    );
  } catch {
    return false;
  }
}

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
