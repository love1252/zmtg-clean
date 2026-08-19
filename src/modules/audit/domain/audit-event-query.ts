import type { AuditReason, AuditResult } from '@/modules/audit/domain/audit-events';
import type {
  AccessContext,
  AccessRole,
  ProtectedAction,
  ProtectedResource,
} from '@/modules/security/domain/access-control';

export const DEFAULT_AUDIT_EVENT_QUERY_LIMIT = 50;
export const MAX_AUDIT_EVENT_QUERY_LIMIT = 100;

export const AUDIT_EVENT_QUERY_PARAM_KEYS = [
  'from',
  'to',
  'resource',
  'resourceId',
  'action',
  'result',
  'reason',
  'actorId',
  'limit',
  'cursor',
] as const;

export const AUDIT_RESULT_VALUES = ['allowed', 'denied', 'transitioned'] as const satisfies readonly AuditResult[];

export const AUDIT_REASON_VALUES = [
  'allowed_by_policy',
  'missing_tenant',
  'cross_tenant_denied',
  'role_denied',
  'sensitive_detail_denied',
  'unknown_role_denied',
  'unknown_resource_denied',
  'unknown_action_denied',
  'permission_denied',
  'sensitive_output_blocked',
  'safety_switch_read',
  'safety_switch_updated',
  'real_channel_enable_blocked',
  'real_channel_disabled',
  'customer_import_permission_checked',
  'message_delivery_permission_checked',
  'care_follow_up_created',
  'care_follow_up_claimed',
  'care_follow_up_reassigned',
  'care_follow_up_unclaimed',
  'care_follow_up_state_changed',
  'care_follow_up_risk_escalated',
  'care_follow_up_completed',
  'care_follow_up_cancelled',
  'care_appointment_created',
  'care_appointment_state_changed',
  'care_appointment_rescheduled',
  'care_appointment_cancelled',
  'customer_created',
  'customer_profile_updated',
  'customer_lifecycle_changed',
  'customer_priority_changed',
  'customer_owner_reassigned',
  'conversation_human_requested',
  'conversation_assigned',
  'conversation_reassigned',
  'conversation_takeover_started',
  'conversation_takeover_released',
  'conversation_waiting_customer',
  'conversation_closed',
  'invalid_transition',
  'stale_transition',
  'not_found_or_not_owned',
  'invalid_his_connection_payload',
  'his_connection_name_conflict',
  'invalid_treatment_summary_reference',
  'invalid_treatment_summary_payload',
  'treatment_summary_voided',
  'treatment_summary_already_voided',
  'invalid_treatment_summary_void_payload',
  'voided_treatment_summary_follow_up_blocked',
  'invalid_follow_up_suggestion',
  'active_source_follow_up_exists',
  'active_follow_up_path_enrollment_exists',
  'follow_up_path_enrollment_not_active',
  'no_matching_template',
  'follow_up_message_draft_exists',
  'follow_up_message_draft_not_draft',
  'follow_up_message_draft_not_approved',
  'unsafe_follow_up_message_content',
  'message_draft_created',
  'message_draft_updated',
  'message_draft_approved',
  'message_draft_rejected',
  'message_draft_marked_sent',
  'message_draft_cancelled',
  'message_delivery_created',
  'message_delivery_exists',
  'message_delivery_mock_sent',
  'message_delivery_mock_failed',
  'message_delivery_skipped',
  'message_delivery_external_disabled',
  'contact_safety_allowed',
  'contact_safety_consent_missing',
  'contact_safety_opt_out',
  'contact_safety_frequency_cap_reached',
  'channel_gray_tenant_blocked',
  'channel_gray_institution_blocked',
  'channel_gray_external_disabled',
  'wecom_mock_authorization_read',
  'wecom_mock_authorization_unavailable',
  'wecom_channel_default_closed',
  'wecom_reach_out_unauthorized',
  'wecom_mock_customer_contact_unavailable',
  'wecom_mock_reachout_created',
  'wecom_mock_reachout_sent',
  'wecom_mock_reachout_failed',
  'wecom_mock_reachout_skipped',
  'wecom_mock_reachout_external_disabled',
  'quota_exceeded_customers',
  'quota_exceeded_appointments',
  'quota_exceeded_knowledge_items',
  'quota_exceeded_knowledge_files',
  'quota_exceeded_knowledge_total_storage_mb',
  'quota_exceeded_knowledge_single_file_size_mb',
  'quota_exceeded_knowledge_parse_jobs_monthly',
  'quota_exceeded_knowledge_embedding_jobs_monthly',
  'quota_exceeded_knowledge_ocr_jobs_monthly',
  'quota_exceeded_knowledge_rag_answers_monthly',
  'quota_exceeded_knowledge_index_rebuild_jobs_monthly',
  'quota_exceeded_staff_seats',
  'quota_exceeded_ai_calls',
  'missing_active_plan',
  'missing_quota_limit',
  'feature_disabled',
  'tenant_plan_assignment_created',
  'tenant_account_created',
  'tenant_account_password_reset',
  'tenant_account_disabled',
  'tenant_account_enabled',
  'tenant_login_succeeded',
  'tenant_login_failed',
  'tenant_plan_changed',
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
  'test_connection_requested',
  'test_connection_provider_healthy',
  'test_connection_missing_credential',
  'test_connection_unsupported_vendor',
  'test_connection_limited_health_probe',
  'test_connection_external_unreachable',
  'test_connection_provider_timeout',
  'test_connection_connection_not_active',
  'test_connection_completed',
  'compensation_pending',
  'compensation_running',
  'compensation_succeeded',
  'compensation_failed',
  'manual_review_required',
  'customer_import_previewed',
  'customer_import_completed',
  'customer_import_partially_completed',
  'customer_import_rejected',
  'customer_import_sensitive_field_blocked',
  'wecom_customer_mapping_confirmed',
  'wecom_customer_mapping_rejected',
  'wecom_customer_mapping_revoked',
  'wecom_customer_mapping_conflict_blocked',
  'wecom_customer_mapping_invalid_transition',
  'wecom_customer_mapping_customer_not_found',
  'wecom_reachout_consent_recorded',
  'wecom_reachout_opt_out_recorded',
  'wecom_reachout_consent_revoked',
  'wecom_reachout_dry_run_snapshot_ready',
  'wecom_reachout_dry_run_snapshot_blocked',
  'wecom_reachout_frequency_reserved',
  'wecom_reachout_frequency_blocked',
  'wecom_controlled_reachout_ready_no_send',
  'wecom_controlled_reachout_draft_not_found',
  'wecom_controlled_reachout_draft_not_approved',
  'wecom_controlled_reachout_delivery_missing',
  'wecom_controlled_reachout_delivery_not_unique',
  'wecom_controlled_reachout_delivery_customer_mismatch',
  'wecom_controlled_reachout_delivery_not_internal_mock',
  'wecom_controlled_reachout_mapping_not_confirmed',
  'wecom_controlled_reachout_mapping_customer_mismatch',
  'wecom_controlled_reachout_customer_not_found',
  'wecom_controlled_reachout_consent_missing',
  'wecom_controlled_reachout_consent_revoked',
  'wecom_controlled_reachout_opt_out',
  'wecom_controlled_reachout_frequency_cap_reached',
  'wecom_controlled_reachout_dry_run_not_ready',
  'wecom_controlled_reachout_manual_confirmation_invalid',
  'wecom_controlled_reachout_invalid_request',
  'wecom_controlled_reachout_body_too_large',
  'wecom_controlled_reachout_conflict',
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
] as const satisfies readonly AuditReason[];

export type AuditEventQueryFilters = {
  from?: string;
  to?: string;
  resource?: ProtectedResource;
  resourceId?: string;
  action?: ProtectedAction;
  result?: AuditResult;
  reason?: AuditReason;
  actorId?: string;
};

export type AuditEventQueryCursor = {
  occurredAt: string;
  eventId: string;
};

export type AuditEventQuery = {
  filters: AuditEventQueryFilters;
  limit: number;
  cursor?: AuditEventQueryCursor;
};

export type AuditEventQueryScope =
  | { kind: 'institution'; tenantId: string; institutionId: string }
  | { kind: 'platform'; tenantId?: string | null };

export type AuditEventListItem = {
  id: string;
  tenantId: string | null;
  resource: ProtectedResource;
  resourceId: string | null;
  action: ProtectedAction;
  result: AuditResult;
  reason: AuditReason;
  actorId: string;
  actorRole: AccessRole;
  occurredAt: string;
};

export type AuditEventQueryResult = {
  records: AuditEventListItem[];
  pageInfo: {
    hasMore: boolean;
    limit: number;
    nextCursor: string | null;
  };
};

export const INSTITUTION_AUDIT_COVERAGE_STATES = [
  'complete',
  'partial_verified_only',
] as const;

export type InstitutionAuditCoverageState =
  (typeof INSTITUTION_AUDIT_COVERAGE_STATES)[number];

export type InstitutionAuditCoverage =
  | Readonly<{
      state: 'complete';
      safeDataAvailable: boolean;
      historicalCoverageComplete: true;
      partialCoverageSafe: false;
    }>
  | Readonly<{
      state: 'partial_verified_only';
      safeDataAvailable: boolean;
      historicalCoverageComplete: false;
      partialCoverageSafe: true;
    }>;

const INSTITUTION_AUDIT_COVERAGE_KEYS = Object.freeze([
  'state',
  'safeDataAvailable',
  'historicalCoverageComplete',
  'partialCoverageSafe',
] as const);

export type ParseAuditEventQueryResult =
  | { ok: true; query: AuditEventQuery }
  | { ok: false; error: string };

export type DecodeAuditEventQueryCursorResult =
  | { ok: true; cursor: AuditEventQueryCursor }
  | { ok: false; error: string };

function isJsonObject(input: unknown): input is Record<string, unknown> {
  return Object.prototype.toString.call(input) === '[object Object]';
}

export function createInstitutionAuditCoverage(input: {
  verifiedRecordCount: number;
  unclassifiableHistoricalRecordCount: number;
}): InstitutionAuditCoverage | null {
  if (
    !Number.isSafeInteger(input.verifiedRecordCount) ||
    input.verifiedRecordCount < 0 ||
    !Number.isSafeInteger(input.unclassifiableHistoricalRecordCount) ||
    input.unclassifiableHistoricalRecordCount < 0
  ) {
    return null;
  }

  const safeDataAvailable = input.verifiedRecordCount > 0;
  return input.unclassifiableHistoricalRecordCount > 0
    ? Object.freeze({
        state: 'partial_verified_only',
        safeDataAvailable,
        historicalCoverageComplete: false,
        partialCoverageSafe: true,
      })
    : Object.freeze({
        state: 'complete',
        safeDataAvailable,
        historicalCoverageComplete: true,
        partialCoverageSafe: false,
      });
}

export function isInstitutionAuditCoverage(
  input: unknown,
): input is InstitutionAuditCoverage {
  if (
    !isJsonObject(input) ||
    Reflect.ownKeys(input).length !== INSTITUTION_AUDIT_COVERAGE_KEYS.length ||
    !INSTITUTION_AUDIT_COVERAGE_KEYS.every((key) =>
      Object.prototype.hasOwnProperty.call(input, key),
    ) ||
    typeof input.safeDataAvailable !== 'boolean'
  ) {
    return false;
  }

  return input.state === 'complete'
    ? input.historicalCoverageComplete === true &&
        input.partialCoverageSafe === false
    : input.state === 'partial_verified_only' &&
        input.historicalCoverageComplete === false &&
        input.partialCoverageSafe === true;
}

function encodeBase64Url(value: string) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64url');
  }

  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function decodeBase64Url(value: string) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64url').toString('utf8');
  }

  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  return atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
}

export function encodeAuditEventQueryCursor(cursor: AuditEventQueryCursor) {
  return encodeBase64Url(JSON.stringify(cursor));
}

export function decodeAuditEventQueryCursor(
  value: string,
): DecodeAuditEventQueryCursorResult {
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(value));
    if (
      !isJsonObject(parsed) ||
      typeof parsed.occurredAt !== 'string' ||
      typeof parsed.eventId !== 'string' ||
      !Number.isFinite(Date.parse(parsed.occurredAt)) ||
      parsed.eventId.trim().length === 0
    ) {
      return { ok: false, error: 'cursor 格式不正确' };
    }

    return {
      ok: true,
      cursor: {
        occurredAt: new Date(parsed.occurredAt).toISOString(),
        eventId: parsed.eventId,
      },
    };
  } catch {
    return { ok: false, error: 'cursor 格式不正确' };
  }
}

export function createAuditEventQueryCursor(input: { id: string; occurredAt: string }) {
  return encodeAuditEventQueryCursor({
    eventId: input.id,
    occurredAt: input.occurredAt,
  });
}
