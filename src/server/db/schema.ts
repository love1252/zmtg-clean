import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

import type { AuditReason } from '@/modules/audit/domain/audit-events';
import type { HomepageBrandConfig } from '@/modules/marketing/domain/homepageBrandConfig';
import type {
  HisConnectionCredentialCompensationState,
  HisConnectionCredentialProviderFailureCategory,
} from '@/modules/institution/server/his-connection-credential-provider-failure';
import type { TreatmentSummaryVoidReasonCode } from '@/modules/institution/domain/treatment-summaries';
import type {
  AccessContext,
  ProtectedAction,
  ProtectedResource,
} from '@/modules/security/domain/access-control';
import type { EncryptedSecretEnvelope } from '@/modules/security/server/secretEncryption';

type JsonRecord = Record<string, unknown>;

export const tenantStatusEnum = pgEnum('tenant_status', [
  'active',
  'suspended',
  'trialing',
  'expired',
]);
export const authAccountStatusEnum = pgEnum('auth_account_status', [
  'active',
  'password_reset_required',
  'disabled',
  'locked',
]);
export const authRoleEnum = pgEnum('auth_role', [
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
  'platform_admin',
  'platform_operator',
  'security_auditor',
]);
export const membershipLifecycleStatusEnum = pgEnum('membership_lifecycle_status', [
  'active',
  'revoked',
  'deleted',
]);
export const membershipProvenanceSourceEnum = pgEnum('membership_provenance_source', [
  'formal_onboarding',
  'access_control_command',
  'legacy_calibration',
]);
export const membershipTransitionTypeEnum = pgEnum('membership_transition_type', [
  'create',
  'refresh',
  'revoke',
  'reactivate',
  'delete',
  'legacy_calibration',
]);
export const customerLifecycleEnum = pgEnum('customer_lifecycle', [
  'consulting',
  'scheduled',
  'post_care',
  'repurchase_window',
  'silent_reactivation',
]);
export const customerPriorityEnum = pgEnum('customer_priority', ['high', 'medium', 'observe']);
export const weComCustomerMappingSourceModeEnum = pgEnum('wecom_customer_mapping_source_mode', [
  'real_readonly_proof',
]);
export const weComCustomerMappingStatusEnum = pgEnum('wecom_customer_mapping_status', [
  'confirmed',
  'rejected',
  'revoked',
]);
export const customerChannelTypeEnum = pgEnum('customer_channel_type', ['wechat_work']);
export const customerChannelContactConsentStatusEnum = pgEnum(
  'customer_channel_contact_consent_status',
  ['unknown', 'consented', 'opted_out', 'consent_revoked'],
);
export const customerChannelContactConsentSourceTypeEnum = pgEnum(
  'customer_channel_contact_consent_source_type',
  [
    'customer_explicit_verbal',
    'customer_explicit_written',
    'customer_opt_out_request',
    'customer_consent_revocation',
  ],
);
export const weComRealSendProofOperationStatusEnum = pgEnum(
  'wecom_real_send_proof_operation_status',
  ['requested', 'aborted', 'attempted', 'succeeded', 'failed', 'unknown_outcome'],
);
export const weComRealSendProofControlScopeKindEnum = pgEnum(
  'wecom_real_send_proof_control_scope_kind',
  ['global', 'tenant', 'institution', 'channel', 'customer', 'operator_role'],
);
export const weComRealSendProofProviderResultCategoryEnum = pgEnum(
  'wecom_real_send_proof_provider_result_category',
  ['accepted', 'rejected', 'transport_error', 'timeout', 'indeterminate'],
);
export const weComRealSendProofPostcheckStatusEnum = pgEnum(
  'wecom_real_send_proof_postcheck_status',
  ['ready', 'blocked', 'expired'],
);
export const authInstitutionBindingStatusEnum = pgEnum(
  'auth_institution_binding_status',
  ['active', 'revoked'],
);
export const authInstitutionBindingSourceEnum = pgEnum(
  'auth_institution_binding_source',
  ['manual_admin', 'migration_placeholder', 'system'],
);
export const authInstitutionBindingTransitionTypeEnum = pgEnum(
  'auth_institution_binding_transition_type',
  ['create', 'rebind', 'revoke', 'expire', 'legacy_calibration'],
);
export const institutionScopeStatusEnum = pgEnum('institution_scope_status', [
  'active',
  'suspended',
]);
export const institutionProvisioningSourceEnum = pgEnum(
  'institution_provisioning_source',
  ['formal_onboarding', 'approved_migration_manifest'],
);
export const institutionOperatingContextSourceEnum = pgEnum(
  'institution_operating_context_source',
  ['institution_config', 'product_default'],
);
export const auditInstitutionAttributionEnum = pgEnum(
  'audit_institution_attribution',
  ['not_applicable', 'verified', 'legacy_unattributed'],
);
export const weComCustomerBroadcastTaskDispatchStateEnum = pgEnum(
  'wecom_customer_broadcast_task_dispatch_state',
  [
    'not_started',
    'task_create_attempted',
    'task_created',
    'task_create_failed',
    'task_create_unknown',
  ],
);
export const weComCustomerBroadcastTaskSendResultStatusEnum = pgEnum(
  'wecom_customer_broadcast_task_send_result_status',
  [
    'not_checked',
    'awaiting_member_confirmation',
    'target_sent',
    'target_failed',
    'target_unknown',
  ],
);
export const weComCustomerBroadcastTaskFinalizeStateEnum = pgEnum(
  'wecom_customer_broadcast_task_finalize_state',
  ['not_finalized', 'success_recorded', 'failure_recorded', 'unknown_recorded'],
);
export const weComCustomerBroadcastTaskReconciliationStateEnum = pgEnum(
  'wecom_customer_broadcast_task_reconciliation_state',
  ['none', 'manual_review_required', 'reconciled'],
);
export const weComCustomerBroadcastRecipientBindingSourceKindEnum = pgEnum(
  'wecom_customer_broadcast_recipient_binding_source_kind',
  ['protected_vault_reference', 'protected_resolver_reference'],
);
export const weComCustomerBroadcastRecipientBindingStatusEnum = pgEnum(
  'wecom_customer_broadcast_recipient_binding_status',
  ['active', 'revoked', 'stale'],
);
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'pending_confirmation',
  'confirmed',
  'arrived',
  'completed',
  'reschedule_requested',
  'cancelled',
]);
export const followUpStatusEnum = pgEnum('follow_up_status', [
  'scheduled',
  'due',
  'in_progress',
  'escalated',
  'completed',
  'cancelled',
]);
export const followUpRiskLevelEnum = pgEnum('follow_up_risk_level', ['normal', 'watch', 'urgent']);
export const followUpMessageDraftStatusEnum = pgEnum('follow_up_message_draft_status', [
  'draft',
  'approved',
  'rejected',
  'marked_sent',
  'cancelled',
]);
export const followUpCustomerTimelineSourceTypeEnum = pgEnum('follow_up_customer_timeline_source_type', [
  'path_enrollment',
  'followup_task',
  'message_draft',
  'manual_note',
]);
export const followUpCustomerTimelineEventTypeEnum = pgEnum('follow_up_customer_timeline_event_type', [
  'followup_path_enrolled',
  'followup_path_cancelled',
  'followup_tasks_generated',
  'followup_task_status_changed',
  'followup_task_escalated',
  'message_draft_created',
  'message_draft_updated',
  'message_draft_approved',
  'message_draft_rejected',
  'message_draft_marked_sent',
  'manual_feedback_recorded',
]);
export const auditResultEnum = pgEnum('audit_result', ['allowed', 'denied', 'transitioned']);
export const tenantPlanStatusEnum = pgEnum('tenant_plan_status', ['active', 'retired']);
export const tenantPlanAssignmentStatusEnum = pgEnum('tenant_plan_assignment_status', [
  'active',
  'scheduled',
  'expired',
]);
export const tenantPlanVersionStatusEnum = pgEnum('tenant_plan_version_status', [
  'draft',
  'published',
  'retired',
]);
export const tenantAuthorizationSnapshotStatusEnum = pgEnum(
  'tenant_authorization_snapshot_status',
  ['active', 'superseded', 'revoked'],
);
export const tenantPlanChangeStatusEnum = pgEnum('tenant_plan_change_status', [
  'previewed',
  'applied',
  'cancelled',
  'failed',
]);
export const tenantCommercialRecordTypeEnum = pgEnum('tenant_commercial_record_type', [
  'order',
  'contract',
  'invoice',
  'payment',
  'tenant_opening',
  'account_opening',
  'plan_binding',
  'plan_change',
  'account_status_change',
]);
export const tenantCommercialRecordStatusEnum = pgEnum('tenant_commercial_record_status', [
  'draft',
  'pending',
  'manual_review',
  'completed',
  'cancelled',
]);
export const hisConnectionStatusEnum = pgEnum('his_connection_status', [
  'draft',
  'active',
  'paused',
  'revoked',
  'deleted',
  'error',
]);
export const hisConnectionHealthStatusEnum = pgEnum('his_connection_health_status', [
  'unknown',
  'healthy',
  'degraded',
  'failed',
]);
export const hisConnectionCredentialCompensationStateEnum = pgEnum(
  'his_connection_credential_compensation_state',
  [
    'compensation_pending',
    'compensation_running',
    'compensation_succeeded',
    'compensation_failed',
    'manual_review_required',
  ],
);
export const hisConnectionCredentialCompensationOperationTypeEnum = pgEnum(
  'his_connection_credential_compensation_operation_type',
  ['credential_compensation'],
);
export const hisConnectionCredentialProviderFailureCategoryEnum = pgEnum(
  'his_connection_credential_provider_failure_category',
  [
    'provider_unavailable',
    'timeout',
    'retry_exhausted',
    'circuit_open',
    'validation_failed',
    'tenant_connection_mismatch',
    'idempotency_conflict',
    'invalid_state',
    'provider_write_failed',
    'provider_revoke_failed',
    'provider_describe_failed',
    'provider_health_failed',
    'repository_after_provider_failed',
    'audit_after_provider_failed',
  ],
);
export const hisConnectionCredentialCompensationJobStateEnum = pgEnum(
  'his_connection_credential_compensation_job_state',
  [
    'queued',
    'claimed',
    'running',
    'succeeded',
    'failed',
    'dead_lettered',
    'manual_review_required',
    'cancelled',
  ],
);
export const hisConnectionCredentialCompensationDeadLetterReasonEnum = pgEnum(
  'his_connection_credential_compensation_dead_letter_reason',
  [
    'retry_exhausted',
    'claim_conflict',
    'stale_recovery_conflict',
    'provider_result_unknown',
    'audit_write_unavailable',
    'operation_state_conflict',
    'unsafe_payload_summary',
  ],
);
export const knowledgeBaseRuntimeSourceKindEnum = pgEnum(
  'knowledge_base_runtime_source_kind',
  ['mock', 'seed', 'demo'],
);
export const knowledgeBaseRuntimeStatusEnum = pgEnum('knowledge_base_runtime_status', [
  'disabled',
  'denied',
  'empty',
  'pending',
  'ready',
  'failed',
]);
export const knowledgeBaseRuntimeReadonlyStatusEnum = pgEnum(
  'knowledge_base_runtime_readonly_status',
  ['readonly', 'blocked'],
);
export const knowledgeFormalProvenanceSourceEnum = pgEnum(
  'knowledge_formal_provenance_source',
  ['formal_onboarding', 'approved_migration_manifest'],
);
export const knowledgeFormalPublicationStatusEnum = pgEnum(
  'knowledge_formal_publication_status',
  ['published', 'retired'],
);
export const knowledgeIndexingJobTypeEnum = pgEnum('knowledge_indexing_job_type', [
  'parse_file',
  'ocr_file',
  'generate_embeddings',
  'rebuild_embeddings',
  'rebuild_knowledge_index',
]);
export const knowledgeIndexingJobStatusEnum = pgEnum('knowledge_indexing_job_status', [
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]);
export const homepageBrandConfigStatusEnum = pgEnum('homepage_brand_config_status', [
  'draft',
  'published',
  'archived',
]);
export const homepageBrandAssetKindEnum = pgEnum('homepage_brand_asset_kind', [
  'logo',
  'night_logo',
  'mark_logo',
  'hero_background',
  'share_image',
]);
export const homepageBrandAuditActionEnum = pgEnum('homepage_brand_audit_action', [
  'save_draft',
  'upload_asset',
  'publish',
  'rollback',
]);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const tenants = pgTable('tenants', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  status: tenantStatusEnum('status').notNull().default('active'),
  ...timestamps,
});

export const institutionScopes = pgTable(
  'institution_scopes',
  {
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    status: institutionScopeStatusEnum('status').notNull(),
    revision: integer('revision').notNull(),
    provisioningSource: institutionProvisioningSourceEnum('provisioning_source').notNull(),
    provisioningReferenceDigest: varchar('provisioning_reference_digest', {
      length: 64,
    }).notNull(),
    approvedBy: varchar('approved_by', { length: 96 }).notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => ({
    primaryKey: primaryKey({
      name: 'institution_scopes_pk',
      columns: [table.tenantId, table.institutionId],
    }),
    tenantFk: foreignKey({
      name: 'institution_scopes_tenant_fk',
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }),
    revisionPositiveCheck: check(
      'institution_scopes_revision_positive_check',
      sql`${table.revision} > 0`,
    ),
    provisioningReferenceDigestLengthCheck: check(
      'institution_scopes_provisioning_reference_digest_length_check',
      sql`length(${table.provisioningReferenceDigest}) = 64`,
    ),
  }),
);

export const institutionOperatingContextVersions = pgTable(
  'institution_operating_context_versions',
  {
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    version: integer('version').notNull(),
    timezone: varchar('timezone', { length: 64 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    effectiveFromBusinessDate: date('effective_from_business_date', {
      mode: 'string',
    }).notNull(),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    source: institutionOperatingContextSourceEnum('source').notNull(),
    migrationProvenance: varchar('migration_provenance', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: varchar('created_by', { length: 96 }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({
      name: 'institution_operating_context_versions_pk',
      columns: [table.tenantId, table.institutionId, table.version],
    }),
    scopeFk: foreignKey({
      name: 'institution_operating_context_versions_scope_fk',
      columns: [table.tenantId, table.institutionId],
      foreignColumns: [institutionScopes.tenantId, institutionScopes.institutionId],
    }),
    effectiveAtUnique: unique(
      'institution_operating_context_versions_effective_at_unique',
    ).on(table.tenantId, table.institutionId, table.effectiveAt),
    versionPositiveCheck: check(
      'institution_operating_context_versions_version_positive_check',
      sql`${table.version} > 0`,
    ),
    timezonePresentCheck: check(
      'institution_operating_context_versions_timezone_present_check',
      sql`length(trim(${table.timezone})) > 0`,
    ),
    currencyFormatCheck: check(
      'institution_operating_context_versions_currency_format_check',
      sql`length(${table.currency}) = 3 AND ${table.currency} = upper(${table.currency})`,
    ),
  }),
);

export const institutionOperatingContexts = pgTable(
  'institution_operating_contexts',
  {
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    revision: integer('revision').notNull(),
    latestVersion: integer('latest_version').notNull(),
    updatedBy: varchar('updated_by', { length: 96 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    primaryKey: primaryKey({
      name: 'institution_operating_contexts_pk',
      columns: [table.tenantId, table.institutionId],
    }),
    scopeFk: foreignKey({
      name: 'institution_operating_contexts_scope_fk',
      columns: [table.tenantId, table.institutionId],
      foreignColumns: [institutionScopes.tenantId, institutionScopes.institutionId],
    }),
    latestVersionFk: foreignKey({
      name: 'institution_operating_contexts_latest_version_fk',
      columns: [table.tenantId, table.institutionId, table.latestVersion],
      foreignColumns: [
        institutionOperatingContextVersions.tenantId,
        institutionOperatingContextVersions.institutionId,
        institutionOperatingContextVersions.version,
      ],
    }),
    revisionPositiveCheck: check(
      'institution_operating_contexts_revision_positive_check',
      sql`${table.revision} > 0`,
    ),
    latestVersionPositiveCheck: check(
      'institution_operating_contexts_latest_version_positive_check',
      sql`${table.latestVersion} > 0`,
    ),
  }),
);

export const authUsers = pgTable(
  'auth_users',
  {
    id: varchar('id', { length: 96 }).primaryKey(),
    username: varchar('username', { length: 96 }).notNull(),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    email: varchar('email', { length: 160 }),
    passwordHash: text('password_hash').notNull(),
    passwordUpdatedAt: timestamp('password_updated_at', { withTimezone: true }).notNull(),
    passwordResetRequired: boolean('password_reset_required').notNull().default(true),
    status: authAccountStatusEnum('status').notNull().default('password_reset_required'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdBy: varchar('created_by', { length: 96 }).notNull(),
    updatedBy: varchar('updated_by', { length: 96 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    usernameUniqueIdx: uniqueIndex('auth_users_username_unique_idx').on(table.username),
    phoneIdx: index('auth_users_phone_idx').on(table.phone),
    emailIdx: index('auth_users_email_idx').on(table.email),
    statusIdx: index('auth_users_status_idx').on(table.status),
  }),
);

export const tenantContacts = pgTable(
  'tenant_contacts',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    contactName: varchar('contact_name', { length: 120 }).notNull(),
    contactPhone: varchar('contact_phone', { length: 32 }).notNull(),
    contactEmail: varchar('contact_email', { length: 160 }),
    initialAdminUserId: varchar('initial_admin_user_id', { length: 96 })
      .notNull()
      .references(() => authUsers.id),
    createdBy: varchar('created_by', { length: 96 }).notNull(),
    updatedBy: varchar('updated_by', { length: 96 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantUniqueIdx: uniqueIndex('tenant_contacts_tenant_unique_idx').on(table.tenantId),
    adminUserIdx: index('tenant_contacts_admin_user_idx').on(table.initialAdminUserId),
  }),
);

export const tenantPlans = pgTable(
  'tenant_plans',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    description: text('description').notNull(),
    status: tenantPlanStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (table) => ({
    codeUniqueIdx: uniqueIndex('tenant_plans_code_unique_idx').on(table.code),
    statusIdx: index('tenant_plans_status_idx').on(table.status),
  }),
);

export const tenantPlanVersions = pgTable(
  'tenant_plan_versions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    planId: varchar('plan_id', { length: 64 })
      .notNull()
      .references(() => tenantPlans.id),
    versionCode: varchar('version_code', { length: 64 }).notNull(),
    status: tenantPlanVersionStatusEnum('status').notNull().default('draft'),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    displayPrice: varchar('display_price', { length: 80 }).notNull(),
    priceNote: text('price_note').notNull().default(''),
    agentLimit: integer('agent_limit'),
    seatLimit: integer('seat_limit'),
    monthlyAiCallLimit: integer('monthly_ai_call_limit'),
    monthlyAiCreditLimit: integer('monthly_ai_credit_limit'),
    knowledgeStorageGb: integer('knowledge_storage_gb'),
    connectorEntitlementsJson: jsonb('connector_entitlements_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    serviceEntitlementsJson: jsonb('service_entitlements_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    featureEntitlementsJson: jsonb('feature_entitlements_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    quotaEntitlementsJson: jsonb('quota_entitlements_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    changeSummary: text('change_summary').notNull().default(''),
    createdBy: varchar('created_by', { length: 96 }).notNull(),
    updatedBy: varchar('updated_by', { length: 96 }).notNull(),
    publishedBy: varchar('published_by', { length: 96 }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    planVersionCodeUniqueIdx: uniqueIndex('tenant_plan_versions_plan_version_code_unique_idx').on(
      table.planId,
      table.versionCode,
    ),
    planStatusIdx: index('tenant_plan_versions_plan_status_idx').on(table.planId, table.status),
    statusUpdatedIdx: index('tenant_plan_versions_status_updated_idx').on(
      table.status,
      table.updatedAt,
    ),
  }),
);

export const tenantPlanAssignments = pgTable(
  'tenant_plan_assignments',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    planId: varchar('plan_id', { length: 64 })
      .notNull()
      .references(() => tenantPlans.id),
    planVersionId: varchar('plan_version_id', { length: 64 }).references(
      () => tenantPlanVersions.id,
    ),
    status: tenantPlanAssignmentStatusEnum('status').notNull().default('active'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    tenantStatusIdx: index('tenant_plan_assignments_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    planStatusIdx: index('tenant_plan_assignments_plan_status_idx').on(
      table.planId,
      table.status,
    ),
    planVersionIdx: index('tenant_plan_assignments_plan_version_idx').on(table.planVersionId),
  }),
);

export const tenantAuthorizationSnapshots = pgTable(
  'tenant_authorization_snapshots',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    planAssignmentId: varchar('plan_assignment_id', { length: 64 })
      .notNull()
      .references(() => tenantPlanAssignments.id),
    planVersionId: varchar('plan_version_id', { length: 64 })
      .notNull()
      .references(() => tenantPlanVersions.id),
    status: tenantAuthorizationSnapshotStatusEnum('status').notNull().default('active'),
    snapshotJson: jsonb('snapshot_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    quotaJson: jsonb('quota_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    connectorJson: jsonb('connector_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    serviceJson: jsonb('service_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    sourceChangeRecordId: varchar('source_change_record_id', { length: 64 }),
    generatedBy: varchar('generated_by', { length: 96 }).notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('tenant_authorization_snapshots_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    activeTenantUniqueIdx: uniqueIndex('tenant_authorization_snapshots_active_tenant_unique_idx')
      .on(table.tenantId)
      .where(sql`${table.status} = 'active'`),
    planAssignmentGeneratedIdx: index('tenant_authorization_snapshots_assignment_generated_idx').on(
      table.planAssignmentId,
      table.generatedAt,
    ),
    planVersionIdx: index('tenant_authorization_snapshots_plan_version_idx').on(
      table.planVersionId,
    ),
  }),
);

export const tenantPlanChangeRecords = pgTable(
  'tenant_plan_change_records',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    fromPlanVersionId: varchar('from_plan_version_id', { length: 64 }).references(
      () => tenantPlanVersions.id,
    ),
    toPlanVersionId: varchar('to_plan_version_id', { length: 64 })
      .notNull()
      .references(() => tenantPlanVersions.id),
    fromSnapshotId: varchar('from_snapshot_id', { length: 64 }).references(
      () => tenantAuthorizationSnapshots.id,
    ),
    toSnapshotId: varchar('to_snapshot_id', { length: 64 }).references(
      () => tenantAuthorizationSnapshots.id,
    ),
    status: tenantPlanChangeStatusEnum('status').notNull().default('previewed'),
    diffJson: jsonb('diff_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    reason: text('reason').notNull(),
    requestedBy: varchar('requested_by', { length: 96 }).notNull(),
    appliedBy: varchar('applied_by', { length: 96 }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    tenantCreatedIdx: index('tenant_plan_change_records_tenant_created_idx').on(
      table.tenantId,
      table.createdAt,
    ),
    tenantStatusIdx: index('tenant_plan_change_records_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    toPlanVersionIdx: index('tenant_plan_change_records_to_plan_version_idx').on(
      table.toPlanVersionId,
    ),
  }),
);

export const tenantCommercialRecords = pgTable(
  'tenant_commercial_records',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    recordType: tenantCommercialRecordTypeEnum('record_type').notNull(),
    status: tenantCommercialRecordStatusEnum('status').notNull().default('draft'),
    displayCode: varchar('display_code', { length: 96 }).notNull(),
    displayAmount: varchar('display_amount', { length: 80 }),
    periodLabel: varchar('period_label', { length: 80 }),
    relatedPlanChangeId: varchar('related_plan_change_id', { length: 64 }).references(
      () => tenantPlanChangeRecords.id,
    ),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }),
    createdBy: varchar('created_by', { length: 96 }).notNull(),
    updatedBy: varchar('updated_by', { length: 96 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantTypeStatusIdx: index('tenant_commercial_records_tenant_type_status_idx').on(
      table.tenantId,
      table.recordType,
      table.status,
    ),
    tenantCreatedIdx: index('tenant_commercial_records_tenant_created_idx').on(
      table.tenantId,
      table.createdAt,
    ),
    relatedPlanChangeIdx: index('tenant_commercial_records_related_plan_change_idx').on(
      table.relatedPlanChangeId,
    ),
  }),
);

export const tenantQuotaSnapshots = pgTable(
  'tenant_quota_snapshots',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    planAssignmentId: varchar('plan_assignment_id', { length: 64 })
      .notNull()
      .references(() => tenantPlanAssignments.id),
    maxCustomers: integer('max_customers').notNull(),
    maxAppointments: integer('max_appointments').notNull(),
    maxFollowUps: integer('max_follow_ups').notNull(),
    maxAiCalls: integer('max_ai_calls').notNull(),
    maxAiCredits: integer('max_ai_credits'),
    currentCustomers: integer('current_customers').notNull(),
    currentAppointments: integer('current_appointments').notNull(),
    currentFollowUps: integer('current_follow_ups').notNull(),
    currentAiCalls: integer('current_ai_calls').notNull(),
    currentAiCredits: integer('current_ai_credits'),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantSnapshotIdx: index('tenant_quota_snapshots_tenant_snapshot_idx').on(
      table.tenantId,
      table.snapshotAt,
    ),
    planAssignmentSnapshotIdx: index(
      'tenant_quota_snapshots_plan_assignment_snapshot_idx',
    ).on(table.planAssignmentId, table.snapshotAt),
  }),
);

export const platformAiProviderConfigs = pgTable(
  'platform_ai_provider_configs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    provider: varchar('provider', { length: 64 }).notNull(),
    baseUrl: varchar('base_url', { length: 256 }).notNull(),
    model: varchar('model', { length: 128 }).notNull(),
    encryptedApiKey: jsonb('encrypted_api_key').$type<EncryptedSecretEnvelope>().notNull(),
    configured: boolean('configured').notNull().default(false),
    lastCheckStatus: varchar('last_check_status', { length: 32 }).notNull().default('not_checked'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    providerIdx: index('platform_ai_provider_configs_provider_idx').on(table.provider),
    updatedAtIdx: index('platform_ai_provider_configs_updated_at_idx').on(table.updatedAt),
  }),
);

export const platformAiModelConfigSnapshots = pgTable(
  'platform_ai_model_config_snapshots',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    scenarioDefaults: jsonb('scenario_defaults').$type<Array<Record<string, unknown>>>().notNull(),
    agentInheritance: jsonb('agent_inheritance').$type<Array<Record<string, unknown>>>().notNull(),
    modelStates: jsonb('model_states').$type<Array<Record<string, unknown>>>().notNull(),
    providerStates: jsonb('provider_states').$type<Array<Record<string, unknown>>>().notNull(),
    dryRunResults: jsonb('dry_run_results').$type<Array<Record<string, unknown>>>().notNull(),
    updatedBy: varchar('updated_by', { length: 96 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    updatedAtIdx: index('platform_ai_model_config_snapshots_updated_at_idx').on(table.updatedAt),
  }),
);

export const platformAiCreditMeteringRules = pgTable(
  'platform_ai_credit_metering_rules',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    provider: varchar('provider', { length: 64 }).notNull(),
    model: varchar('model', { length: 128 }).notNull(),
    meteringVersion: varchar('metering_version', { length: 64 }).notNull(),
    inputTokenWeight: numeric('input_token_weight', { precision: 12, scale: 6 }).notNull(),
    outputTokenWeight: numeric('output_token_weight', { precision: 12, scale: 6 }).notNull(),
    modelMultiplier: numeric('model_multiplier', { precision: 12, scale: 6 }).notNull(),
    ragCreditSurcharge: integer('rag_credit_surcharge').notNull(),
    creditsPerStandardTokenUnit: integer('credits_per_standard_token_unit').notNull(),
    enabled: boolean('enabled').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    providerModelVersionUniqueIdx: uniqueIndex(
      'platform_ai_credit_metering_rules_provider_model_version_unique_idx',
    ).on(table.provider, table.model, table.meteringVersion),
    providerModelEnabledIdx: index(
      'platform_ai_credit_metering_rules_provider_model_enabled_idx',
    ).on(table.provider, table.model, table.enabled),
    effectiveFromIdx: index('platform_ai_credit_metering_rules_effective_from_idx').on(
      table.effectiveFrom,
    ),
  }),
);

export const tenantMembers = pgTable(
  'tenant_members',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    userId: varchar('user_id', { length: 96 })
      .notNull()
      .references(() => authUsers.id),
    role: authRoleEnum('role').notNull(),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    revision: integer('revision').notNull(),
    lifecycleStatus: membershipLifecycleStatusEnum('lifecycle_status').notNull(),
    currentProvenanceSource: membershipProvenanceSourceEnum(
      'current_provenance_source',
    ).notNull(),
    currentProvenanceActorId: varchar('current_provenance_actor_id', { length: 96 }),
    currentProvenanceReasonCode: varchar('current_provenance_reason_code', {
      length: 96,
    }).notNull(),
    currentProvenanceCommandId: varchar('current_provenance_command_id', {
      length: 128,
    }).notNull(),
    currentProvenanceOccurredAt: timestamp('current_provenance_occurred_at', {
      withTimezone: true,
    }),
    currentProvenanceRecordedAt: timestamp('current_provenance_recorded_at', {
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    tenantUserUniqueIdx: uniqueIndex('tenant_members_tenant_user_unique_idx').on(
      table.tenantId,
      table.userId,
    ),
    tenantRoleIdx: index('tenant_members_tenant_role_idx').on(table.tenantId, table.role),
    tenantIdIdUnique: unique('tenant_members_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    currentEnvelopeShapeCheck: check(
      'tenant_members_current_envelope_shape_check',
      sql`(
        ${table.revision} IS NOT NULL
        AND ${table.revision} BETWEEN 1 AND 2147483647
        AND ${table.lifecycleStatus} IS NOT NULL
        AND ${table.currentProvenanceSource} IS NOT NULL
        AND ${table.currentProvenanceReasonCode} IS NOT NULL
        AND ${table.currentProvenanceCommandId} IS NOT NULL
        AND ${table.currentProvenanceRecordedAt} IS NOT NULL
        AND (
          (
            ${table.currentProvenanceSource} = 'legacy_calibration'
            AND ${table.revision} = 1
            AND ${table.lifecycleStatus} = 'active'
            AND ${table.currentProvenanceActorId} IS NULL
            AND ${table.currentProvenanceReasonCode} = 'legacy_unknown'
            AND ${table.currentProvenanceOccurredAt} IS NULL
          ) OR (
            ${table.currentProvenanceSource} = 'formal_onboarding'
            AND ${table.revision} = 1
            AND ${table.lifecycleStatus} = 'active'
            AND ${table.currentProvenanceActorId} IS NOT NULL
            AND ${table.currentProvenanceOccurredAt} IS NOT NULL
            AND ${table.currentProvenanceRecordedAt} >= ${table.currentProvenanceOccurredAt}
          ) OR (
            ${table.currentProvenanceSource} = 'access_control_command'
            AND ${table.currentProvenanceActorId} IS NOT NULL
            AND ${table.currentProvenanceOccurredAt} IS NOT NULL
            AND ${table.currentProvenanceRecordedAt} >= ${table.currentProvenanceOccurredAt}
          )
        )
        AND (
          (
            ${table.lifecycleStatus} = 'active'
            AND ${table.revokedAt} IS NULL
            AND ${table.deletedAt} IS NULL
          ) OR (
            ${table.lifecycleStatus} = 'revoked'
            AND ${table.revision} >= 2
            AND ${table.revokedAt} IS NOT NULL
            AND ${table.revokedAt} = ${table.currentProvenanceOccurredAt}
            AND ${table.deletedAt} IS NULL
          ) OR (
            ${table.lifecycleStatus} = 'deleted'
            AND ${table.revision} >= 2
            AND ${table.deletedAt} IS NOT NULL
            AND ${table.deletedAt} = ${table.currentProvenanceOccurredAt}
            AND (${table.revokedAt} IS NULL OR ${table.revokedAt} <= ${table.deletedAt})
          )
        )
      )`,
    ),
  }),
);

export const tenantMembershipTransitions = pgTable(
  'tenant_membership_transitions',
  {
    id: varchar('id', { length: 96 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    membershipId: varchar('membership_id', { length: 64 }).notNull(),
    commandId: varchar('command_id', { length: 128 }).notNull(),
    transitionType: membershipTransitionTypeEnum('transition_type').notNull(),
    source: membershipProvenanceSourceEnum('source').notNull(),
    actorId: varchar('actor_id', { length: 96 }),
    reasonCode: varchar('reason_code', { length: 96 }).notNull(),
    fromRevision: integer('from_revision'),
    toRevision: integer('to_revision').notNull(),
    fromLifecycleStatus: membershipLifecycleStatusEnum('from_lifecycle_status'),
    toLifecycleStatus: membershipLifecycleStatusEnum('to_lifecycle_status').notNull(),
    fromRole: authRoleEnum('from_role'),
    toRole: authRoleEnum('to_role').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    tenantMembershipFk: foreignKey({
      name: 'tenant_membership_transitions_tenant_membership_fk',
      columns: [table.tenantId, table.membershipId],
      foreignColumns: [tenantMembers.tenantId, tenantMembers.id],
    })
      .onUpdate('no action')
      .onDelete('no action'),
    tenantCommandUnique: unique('tenant_membership_transitions_tenant_command_unique').on(
      table.tenantId,
      table.commandId,
    ),
    membershipRevisionUnique: unique(
      'tenant_membership_transitions_membership_revision_unique',
    ).on(table.membershipId, table.toRevision),
    tenantMembershipRevisionIdx: index(
      'tenant_membership_transitions_tenant_membership_revision_idx',
    ).on(table.tenantId, table.membershipId, table.toRevision),
    revisionShapeCheck: check(
      'tenant_membership_transitions_revision_shape_check',
      sql`${table.toRevision} BETWEEN 1 AND 2147483647 AND (
        (
          ${table.transitionType} IN ('create', 'legacy_calibration')
          AND ${table.fromRevision} IS NULL
          AND ${table.toRevision} = 1
        ) OR (
          ${table.transitionType} IN ('refresh', 'revoke', 'reactivate', 'delete')
          AND ${table.fromRevision} IS NOT NULL
          AND ${table.fromRevision} BETWEEN 1 AND 2147483646
          AND ${table.toRevision} = ${table.fromRevision} + 1
        )
      )`,
    ),
    lifecycleShapeCheck: check(
      'tenant_membership_transitions_lifecycle_shape_check',
      sql`(
        ${table.transitionType} IN ('create', 'legacy_calibration')
        AND ${table.fromLifecycleStatus} IS NULL
        AND ${table.toLifecycleStatus} = 'active'
      ) OR (
        ${table.transitionType} = 'refresh'
        AND ${table.fromLifecycleStatus} IS NOT NULL
        AND ${table.fromLifecycleStatus} = 'active'
        AND ${table.toLifecycleStatus} = 'active'
      ) OR (
        ${table.transitionType} = 'revoke'
        AND ${table.fromLifecycleStatus} IS NOT NULL
        AND ${table.fromLifecycleStatus} = 'active'
        AND ${table.toLifecycleStatus} = 'revoked'
      ) OR (
        ${table.transitionType} = 'reactivate'
        AND ${table.fromLifecycleStatus} IS NOT NULL
        AND ${table.fromLifecycleStatus} = 'revoked'
        AND ${table.toLifecycleStatus} = 'active'
      ) OR (
        ${table.transitionType} = 'delete'
        AND ${table.fromLifecycleStatus} IS NOT NULL
        AND ${table.fromLifecycleStatus} IN ('active', 'revoked')
        AND ${table.toLifecycleStatus} = 'deleted'
      )`,
    ),
    roleShapeCheck: check(
      'tenant_membership_transitions_role_shape_check',
      sql`(
        ${table.transitionType} IN ('create', 'legacy_calibration')
        AND ${table.fromRole} IS NULL
      ) OR (
        ${table.transitionType} = 'refresh'
        AND ${table.fromRole} IS NOT NULL
        AND (
          ${table.fromRole} <> ${table.toRole}
          OR (
            ${table.fromRole} = ${table.toRole}
            AND ${table.source} = 'access_control_command'
            AND ${table.reasonCode} = 'post_rebuild_formal_identity_adoption'
            AND ${table.fromRevision} = 1
            AND ${table.toRevision} = 2
          )
        )
      ) OR (
        ${table.transitionType} IN ('revoke', 'reactivate', 'delete')
        AND ${table.fromRole} IS NOT NULL
        AND ${table.fromRole} = ${table.toRole}
      )`,
    ),
    provenanceShapeCheck: check(
      'tenant_membership_transitions_provenance_shape_check',
      sql`(
        ${table.transitionType} = 'legacy_calibration'
        AND ${table.source} = 'legacy_calibration'
        AND ${table.actorId} IS NULL
        AND ${table.reasonCode} = 'legacy_unknown'
        AND ${table.occurredAt} IS NULL
      ) OR (
        ${table.transitionType} = 'create'
        AND ${table.source} IN ('formal_onboarding', 'access_control_command')
        AND ${table.actorId} IS NOT NULL
        AND ${table.occurredAt} IS NOT NULL
        AND ${table.recordedAt} >= ${table.occurredAt}
      ) OR (
        ${table.transitionType} IN ('refresh', 'revoke', 'reactivate', 'delete')
        AND ${table.source} = 'access_control_command'
        AND ${table.actorId} IS NOT NULL
        AND ${table.occurredAt} IS NOT NULL
        AND ${table.recordedAt} >= ${table.occurredAt}
      )`,
    ),
  }),
);

export const authAccountInstitutionBindings = pgTable(
  'auth_account_institution_bindings',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    accountId: varchar('account_id', { length: 96 }).notNull(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    status: authInstitutionBindingStatusEnum('status').notNull().default('active'),
    source: authInstitutionBindingSourceEnum('source').notNull(),
    assignedBy: varchar('assigned_by', { length: 96 }).notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique(
      'auth_account_institution_bindings_tenant_id_id_unique',
    ).on(table.tenantId, table.id),
    tenantAccountFk: foreignKey({
      name: 'auth_account_institution_bindings_tenant_account_fk',
      columns: [table.tenantId, table.accountId],
      foreignColumns: [tenantMembers.tenantId, tenantMembers.userId],
    }),
    scopeFk: foreignKey({
      name: 'auth_account_institution_bindings_scope_fk',
      columns: [table.tenantId, table.institutionId],
      foreignColumns: [institutionScopes.tenantId, institutionScopes.institutionId],
    })
      .onUpdate('no action')
      .onDelete('no action'),
    scopeIdx: index('auth_account_institution_bindings_scope_idx').on(
      table.tenantId,
      table.institutionId,
    ),
    activeAccountTenantUniqueIdx: uniqueIndex(
      'auth_account_institution_bindings_active_account_tenant_unique_idx',
    ).on(table.accountId, table.tenantId).where(sql`${table.status} = 'active'`),
    accountTenantStatusIdx: index(
      'auth_account_institution_bindings_account_tenant_status_idx',
    ).on(table.accountId, table.tenantId, table.status),
    statusShapeCheck: check(
      'auth_account_institution_bindings_status_shape_check',
      sql`(${table.status} = 'active' AND ${table.revokedAt} IS NULL AND ${table.institutionId} IS NOT NULL) OR (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL AND ${table.institutionId} IS NOT NULL AND ${table.revokedAt} >= ${table.assignedAt})`,
    ),
    expiryCheck: check(
      'auth_account_institution_bindings_expiry_check',
      sql`${table.expiresAt} IS NULL OR ${table.expiresAt} > ${table.assignedAt}`,
    ),
    sourceAuthorityCheck: check(
      'auth_account_institution_bindings_source_authority_check',
      sql`${table.status} <> 'active' OR ${table.source} IN ('manual_admin', 'system')`,
    ),
    versionPositiveCheck: check(
      'auth_account_institution_bindings_version_positive_check',
      sql`${table.version} > 0`,
    ),
  }),
);


export const authAccountInstitutionBindingTransitions = pgTable(
  'auth_account_institution_binding_transitions',
  {
    id: varchar('id', { length: 96 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    bindingId: varchar('binding_id', { length: 64 }).notNull(),
    replacementBindingId: varchar('replacement_binding_id', { length: 64 }),
    commandId: varchar('command_id', { length: 128 }).notNull(),
    transitionType: authInstitutionBindingTransitionTypeEnum('transition_type').notNull(),
    provenanceSource: membershipProvenanceSourceEnum('provenance_source').notNull(),
    assignmentSource: authInstitutionBindingSourceEnum('assignment_source').notNull(),
    actorId: varchar('actor_id', { length: 96 }),
    reasonCode: varchar('reason_code', { length: 96 }).notNull(),
    fromStatus: authInstitutionBindingStatusEnum('from_status'),
    toStatus: authInstitutionBindingStatusEnum('to_status').notNull(),
    fromVersion: integer('from_version'),
    toVersion: integer('to_version').notNull(),
    membershipRevision: integer('membership_revision').notNull(),
    scopeRevision: integer('scope_revision'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  },
  (table) => ({
    tenantBindingFk: foreignKey({
      name: 'auth_binding_transitions_binding_fk',
      columns: [table.tenantId, table.bindingId],
      foreignColumns: [
        authAccountInstitutionBindings.tenantId,
        authAccountInstitutionBindings.id,
      ],
    })
      .onUpdate('no action')
      .onDelete('no action'),
    tenantReplacementBindingFk: foreignKey({
      name: 'auth_binding_transitions_replacement_fk',
      columns: [table.tenantId, table.replacementBindingId],
      foreignColumns: [
        authAccountInstitutionBindings.tenantId,
        authAccountInstitutionBindings.id,
      ],
    })
      .onUpdate('no action')
      .onDelete('no action'),
    tenantCommandUnique: unique(
      'auth_binding_transitions_tenant_command_unique',
    ).on(table.tenantId, table.commandId),
    bindingVersionUnique: unique(
      'auth_binding_transitions_binding_version_unique',
    ).on(table.bindingId, table.toVersion),
    tenantBindingVersionIdx: index(
      'auth_binding_transitions_tenant_binding_version_idx',
    ).on(table.tenantId, table.bindingId, table.toVersion),
    identityPresentCheck: check(
      'auth_binding_transitions_identity_present_check',
      sql`length(trim(${table.id})) > 0
        AND length(trim(${table.commandId})) > 0
        AND length(trim(${table.reasonCode})) > 0`,
    ),
    versionShapeCheck: check(
      'auth_binding_transitions_version_shape_check',
      sql`${table.toVersion} BETWEEN 1 AND 2147483647
        AND ${table.membershipRevision} BETWEEN 1 AND 2147483647
        AND (
          (
            ${table.transitionType} = 'create'
            AND ${table.fromVersion} IS NULL
            AND ${table.toVersion} = 1
          ) OR (
            ${table.transitionType} = 'legacy_calibration'
            AND ${table.fromVersion} IS NULL
          ) OR (
            ${table.transitionType} IN ('rebind', 'revoke', 'expire')
            AND ${table.fromVersion} BETWEEN 1 AND 2147483646
            AND ${table.toVersion} = ${table.fromVersion} + 1
          )
        )`,
    ),
    statusShapeCheck: check(
      'auth_binding_transitions_status_shape_check',
      sql`(
          ${table.transitionType} = 'create'
          AND ${table.fromStatus} IS NULL
          AND ${table.toStatus} = 'active'
          AND ${table.replacementBindingId} IS NULL
        ) OR (
          ${table.transitionType} = 'legacy_calibration'
          AND ${table.fromStatus} IS NULL
          AND ${table.toStatus} IN ('active', 'revoked')
          AND ${table.replacementBindingId} IS NULL
        ) OR (
          ${table.transitionType} = 'rebind'
          AND ${table.fromStatus} = 'active'
          AND ${table.toStatus} = 'revoked'
          AND ${table.replacementBindingId} IS NOT NULL
          AND ${table.replacementBindingId} <> ${table.bindingId}
        ) OR (
          ${table.transitionType} IN ('revoke', 'expire')
          AND ${table.fromStatus} = 'active'
          AND ${table.toStatus} = 'revoked'
          AND ${table.replacementBindingId} IS NULL
        )`,
    ),
    observationShapeCheck: check(
      'auth_binding_transitions_observation_shape_check',
      sql`(
          ${table.transitionType} IN ('create', 'rebind')
          AND ${table.scopeRevision} BETWEEN 1 AND 2147483647
        ) OR (
          ${table.transitionType} IN ('revoke', 'expire', 'legacy_calibration')
          AND ${table.scopeRevision} IS NULL
        )`,
    ),
    provenanceShapeCheck: check(
      'auth_binding_transitions_provenance_shape_check',
      sql`(
          ${table.transitionType} = 'legacy_calibration'
          AND ${table.provenanceSource} = 'legacy_calibration'
          AND ${table.actorId} IS NULL
          AND ${table.reasonCode} = 'legacy_unknown'
          AND ${table.occurredAt} IS NULL
        ) OR (
          ${table.transitionType} = 'create'
          AND ${table.provenanceSource} IN ('formal_onboarding', 'access_control_command')
          AND ${table.assignmentSource} IN ('manual_admin', 'system')
          AND ${table.actorId} IS NOT NULL
          AND ${table.occurredAt} IS NOT NULL
          AND ${table.recordedAt} >= ${table.occurredAt}
        ) OR (
          ${table.transitionType} = 'rebind'
          AND ${table.provenanceSource} = 'access_control_command'
          AND ${table.assignmentSource} IN ('manual_admin', 'system')
          AND ${table.actorId} IS NOT NULL
          AND ${table.occurredAt} IS NOT NULL
          AND ${table.recordedAt} >= ${table.occurredAt}
        ) OR (
          ${table.transitionType} IN ('revoke', 'expire')
          AND ${table.provenanceSource} = 'access_control_command'
          AND ${table.actorId} IS NOT NULL
          AND ${table.occurredAt} IS NOT NULL
          AND ${table.recordedAt} >= ${table.occurredAt}
        )`,
    ),
  }),
);

export const hisConnections = pgTable(
  'his_connections',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    connectionName: varchar('connection_name', { length: 160 }).notNull(),
    sourceSystem: varchar('source_system', { length: 64 }).notNull(),
    vendorType: varchar('vendor_type', { length: 64 }).notNull(),
    systemType: varchar('system_type', { length: 64 }).notNull(),
    status: hisConnectionStatusEnum('status').notNull().default('draft'),
    credentialRef: varchar('credential_ref', { length: 128 }),
    healthStatus: hisConnectionHealthStatusEnum('health_status').notNull().default('unknown'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    lastErrorCode: varchar('last_error_code', { length: 96 }),
    createdBy: varchar('created_by', { length: 96 }).notNull(),
    updatedBy: varchar('updated_by', { length: 96 }),
    ...timestamps,
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    tenantIdIdUnique: unique('his_connections_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    tenantIdx: index('his_connections_tenant_idx').on(table.tenantId),
    tenantStatusIdx: index('his_connections_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    tenantSourceSystemIdx: index('his_connections_tenant_source_system_idx').on(
      table.tenantId,
      table.sourceSystem,
    ),
    tenantDeletedAtIdx: index('his_connections_tenant_deleted_at_idx').on(
      table.tenantId,
      table.deletedAt,
    ),
    tenantCredentialRefIdx: index('his_connections_tenant_credential_ref_idx').on(
      table.tenantId,
      table.credentialRef,
    ),
    tenantLastCheckedAtIdx: index('his_connections_tenant_last_checked_at_idx').on(
      table.tenantId,
      table.lastCheckedAt,
    ),
    activeNameUniqueIdx: uniqueIndex('his_connections_active_name_unique_idx')
      .on(table.tenantId, table.connectionName)
      .where(sql`${table.deletedAt} is null`),
  }),
);

export const hisConnectionCredentialCompensationOperations = pgTable(
  'his_connection_credential_compensation_operations',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    connectionId: varchar('connection_id', { length: 64 }).notNull(),
    operationId: varchar('operation_id', { length: 96 }).notNull(),
    operationType: hisConnectionCredentialCompensationOperationTypeEnum(
      'operation_type',
    ).notNull().default('credential_compensation'),
    state: hisConnectionCredentialCompensationStateEnum('state')
      .$type<HisConnectionCredentialCompensationState>()
      .notNull()
      .default('compensation_pending'),
    failureCategory: hisConnectionCredentialProviderFailureCategoryEnum(
      'failure_category',
    ).$type<HisConnectionCredentialProviderFailureCategory>().notNull(),
    retryCount: integer('retry_count').notNull().default(0),
    manualReviewRequired: boolean('manual_review_required').notNull().default(false),
    ...timestamps,
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    tenantFk: foreignKey({
      name: 'his_conn_cred_comp_ops_tenant_fk',
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }),
    connectionFk: foreignKey({
      name: 'his_conn_cred_comp_ops_connection_fk',
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [hisConnections.tenantId, hisConnections.id],
    }),
    operationIdUniqueIdx: uniqueIndex('his_conn_cred_comp_ops_operation_id_unique_idx').on(
      table.operationId,
    ),
    tenantConnectionOperationUniqueIdx: uniqueIndex(
      'his_conn_cred_comp_ops_tenant_connection_operation_unique_idx',
    ).on(table.tenantId, table.connectionId, table.operationId),
    tenantConnectionStateIdx: index(
      'his_conn_cred_comp_ops_tenant_connection_state_idx',
    ).on(table.tenantId, table.connectionId, table.state),
    tenantStateUpdatedIdx: index('his_conn_cred_comp_ops_tenant_state_updated_idx').on(
      table.tenantId,
      table.state,
      table.updatedAt,
    ),
  }),
);

export const hisConnectionCredentialCompensationJobs = pgTable(
  'his_connection_credential_compensation_jobs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    connectionId: varchar('connection_id', { length: 64 }).notNull(),
    operationId: varchar('operation_id', { length: 96 }).notNull(),
    operationType: hisConnectionCredentialCompensationOperationTypeEnum(
      'operation_type',
    ).notNull().default('credential_compensation'),
    jobState: hisConnectionCredentialCompensationJobStateEnum('job_state')
      .notNull()
      .default('queued'),
    failureCategory: hisConnectionCredentialProviderFailureCategoryEnum(
      'failure_category',
    ).$type<HisConnectionCredentialProviderFailureCategory>().notNull(),
    retryCount: integer('retry_count').notNull().default(0),
    maxRetryCount: integer('max_retry_count').notNull().default(3),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    claimId: varchar('claim_id', { length: 96 }),
    claimVersion: integer('claim_version').notNull().default(0),
    claimedBy: varchar('claimed_by', { length: 96 }),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    deadLetterReason: hisConnectionCredentialCompensationDeadLetterReasonEnum(
      'dead_letter_reason',
    ),
    manualReviewRequired: boolean('manual_review_required')
      .notNull()
      .default(false),
    ...timestamps,
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    tenantFk: foreignKey({
      name: 'his_conn_cred_comp_jobs_tenant_fk',
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
    }),
    connectionFk: foreignKey({
      name: 'his_conn_cred_comp_jobs_connection_fk',
      columns: [table.tenantId, table.connectionId],
      foreignColumns: [hisConnections.tenantId, hisConnections.id],
    }),
    operationFk: foreignKey({
      name: 'his_conn_cred_comp_jobs_operation_scope_fk',
      columns: [table.tenantId, table.connectionId, table.operationId],
      foreignColumns: [
        hisConnectionCredentialCompensationOperations.tenantId,
        hisConnectionCredentialCompensationOperations.connectionId,
        hisConnectionCredentialCompensationOperations.operationId,
      ],
    }),
    operationIdUniqueIdx: uniqueIndex('his_conn_cred_comp_jobs_operation_id_unique_idx').on(
      table.operationId,
    ),
    tenantConnectionOperationIdx: index(
      'his_conn_cred_comp_jobs_tenant_connection_operation_idx',
    ).on(table.tenantId, table.connectionId, table.operationId),
    tenantStateNextAttemptIdx: index(
      'his_conn_cred_comp_jobs_tenant_state_next_attempt_idx',
    ).on(table.tenantId, table.jobState, table.nextAttemptAt),
    lockIdx: index('his_conn_cred_comp_jobs_lock_idx').on(
      table.jobState,
      table.lockedUntil,
      table.claimVersion,
    ),
  }),
);

export const knowledgeFormalSources = pgTable(
  'knowledge_formal_sources',
  {
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    id: varchar('id', { length: 64 }).notNull(),
    sourceLabel: varchar('source_label', { length: 160 }).notNull(),
    provenanceSource: knowledgeFormalProvenanceSourceEnum('provenance_source').notNull(),
    provenanceReferenceDigest: varchar('provenance_reference_digest', {
      length: 64,
    }).notNull(),
    approvedBy: varchar('approved_by', { length: 96 }).notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => ({
    primaryKey: primaryKey({
      name: 'knowledge_formal_sources_pk',
      columns: [table.tenantId, table.institutionId, table.id],
    }),
    scopeFk: foreignKey({
      name: 'knowledge_formal_sources_scope_fk',
      columns: [table.tenantId, table.institutionId],
      foreignColumns: [institutionScopes.tenantId, institutionScopes.institutionId],
    }),
    provenanceDigestCheck: check(
      'knowledge_formal_sources_digest_check',
      sql`length(${table.provenanceReferenceDigest}) = 64`,
    ),
    scopeIdx: index('knowledge_formal_sources_scope_idx').on(
      table.tenantId,
      table.institutionId,
    ),
  }),
);

export const knowledgeFormalDocumentVersions = pgTable(
  'knowledge_formal_document_versions',
  {
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    documentId: varchar('document_id', { length: 64 }).notNull(),
    version: integer('version').notNull(),
    sourceId: varchar('source_id', { length: 64 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    documentReferenceDigest: varchar('document_reference_digest', {
      length: 64,
    }).notNull(),
    publishedBy: varchar('published_by', { length: 96 }).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    primaryKey: primaryKey({
      name: 'knowledge_formal_document_versions_pk',
      columns: [
        table.tenantId,
        table.institutionId,
        table.documentId,
        table.version,
      ],
    }),
    sourceFk: foreignKey({
      name: 'knowledge_formal_document_versions_source_fk',
      columns: [table.tenantId, table.institutionId, table.sourceId],
      foreignColumns: [
        knowledgeFormalSources.tenantId,
        knowledgeFormalSources.institutionId,
        knowledgeFormalSources.id,
      ],
    }),
    versionPositiveCheck: check(
      'knowledge_formal_document_versions_version_check',
      sql`${table.version} > 0`,
    ),
    documentDigestCheck: check(
      'knowledge_formal_document_versions_digest_check',
      sql`length(${table.documentReferenceDigest}) = 64`,
    ),
    scopeDocumentIdx: index('knowledge_formal_document_versions_scope_document_idx').on(
      table.tenantId,
      table.institutionId,
      table.documentId,
    ),
  }),
);

export const knowledgeFormalDocumentPublications = pgTable(
  'knowledge_formal_document_publications',
  {
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    documentId: varchar('document_id', { length: 64 }).notNull(),
    currentVersion: integer('current_version').notNull(),
    status: knowledgeFormalPublicationStatusEnum('status').notNull(),
    revision: integer('revision').notNull(),
    updatedBy: varchar('updated_by', { length: 96 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    primaryKey: primaryKey({
      name: 'knowledge_formal_document_publications_pk',
      columns: [table.tenantId, table.institutionId, table.documentId],
    }),
    currentVersionFk: foreignKey({
      name: 'knowledge_formal_document_publications_version_fk',
      columns: [
        table.tenantId,
        table.institutionId,
        table.documentId,
        table.currentVersion,
      ],
      foreignColumns: [
        knowledgeFormalDocumentVersions.tenantId,
        knowledgeFormalDocumentVersions.institutionId,
        knowledgeFormalDocumentVersions.documentId,
        knowledgeFormalDocumentVersions.version,
      ],
    }),
    currentVersionPositiveCheck: check(
      'knowledge_formal_document_publications_current_version_check',
      sql`${table.currentVersion} > 0`,
    ),
    revisionPositiveCheck: check(
      'knowledge_formal_document_publications_revision_check',
      sql`${table.revision} > 0`,
    ),
    scopeStatusIdx: index('knowledge_formal_document_publications_scope_status_idx').on(
      table.tenantId,
      table.institutionId,
      table.status,
    ),
  }),
);

export const knowledgeSources = pgTable(
  'knowledge_sources',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 64 }).notNull(),
    sourceKind: knowledgeBaseRuntimeSourceKindEnum('source_kind')
      .notNull()
      .default('demo'),
    status: knowledgeBaseRuntimeStatusEnum('status').notNull().default('ready'),
    readonlyStatus: knowledgeBaseRuntimeReadonlyStatusEnum('readonly_status')
      .notNull()
      .default('readonly'),
    sourceLabel: varchar('source_label', { length: 160 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('knowledge_sources_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    tenantWorkspaceStatusIdx: index('knowledge_sources_tenant_workspace_status_idx').on(
      table.tenantId,
      table.workspaceId,
      table.status,
    ),
    tenantInstitutionWorkspaceIdx: index(
      'knowledge_sources_tenant_institution_workspace_idx',
    ).on(table.tenantId, table.institutionId, table.workspaceId),
  }),
);

export const knowledgeDocuments = pgTable(
  'knowledge_documents',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 64 }).notNull(),
    sourceId: varchar('source_id', { length: 64 }).notNull(),
    sourceKind: knowledgeBaseRuntimeSourceKindEnum('source_kind')
      .notNull()
      .default('demo'),
    status: knowledgeBaseRuntimeStatusEnum('status').notNull().default('ready'),
    readonlyStatus: knowledgeBaseRuntimeReadonlyStatusEnum('readonly_status')
      .notNull()
      .default('readonly'),
    title: varchar('title', { length: 200 }).notNull(),
    version: varchar('version', { length: 64 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('knowledge_documents_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    sourceFk: foreignKey({
      name: 'knowledge_documents_tenant_source_fk',
      columns: [table.tenantId, table.sourceId],
      foreignColumns: [knowledgeSources.tenantId, knowledgeSources.id],
    }),
    tenantWorkspaceStatusIdx: index('knowledge_documents_tenant_workspace_status_idx').on(
      table.tenantId,
      table.workspaceId,
      table.status,
    ),
    tenantSourceIdx: index('knowledge_documents_tenant_source_idx').on(
      table.tenantId,
      table.sourceId,
    ),
  }),
);

export const knowledgeChunks = pgTable(
  'knowledge_chunks',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 64 }).notNull(),
    documentId: varchar('document_id', { length: 64 }).notNull(),
    sourceKind: knowledgeBaseRuntimeSourceKindEnum('source_kind')
      .notNull()
      .default('demo'),
    status: knowledgeBaseRuntimeStatusEnum('status').notNull().default('ready'),
    readonlyStatus: knowledgeBaseRuntimeReadonlyStatusEnum('readonly_status')
      .notNull()
      .default('readonly'),
    chunkLabel: varchar('chunk_label', { length: 160 }).notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('knowledge_chunks_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    documentFk: foreignKey({
      name: 'knowledge_chunks_tenant_document_fk',
      columns: [table.tenantId, table.documentId],
      foreignColumns: [knowledgeDocuments.tenantId, knowledgeDocuments.id],
    }),
    tenantDocumentIdx: index('knowledge_chunks_tenant_document_idx').on(
      table.tenantId,
      table.documentId,
    ),
    tenantWorkspaceStatusIdx: index('knowledge_chunks_tenant_workspace_status_idx').on(
      table.tenantId,
      table.workspaceId,
      table.status,
    ),
  }),
);

export const knowledgeIndexJobs = pgTable(
  'knowledge_index_jobs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 64 }).notNull(),
    documentId: varchar('document_id', { length: 64 }).notNull(),
    sourceKind: knowledgeBaseRuntimeSourceKindEnum('source_kind')
      .notNull()
      .default('demo'),
    status: knowledgeBaseRuntimeStatusEnum('status').notNull().default('ready'),
    readonlyStatus: knowledgeBaseRuntimeReadonlyStatusEnum('readonly_status')
      .notNull()
      .default('readonly'),
    jobKind: varchar('job_kind', { length: 64 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('knowledge_index_jobs_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    documentFk: foreignKey({
      name: 'knowledge_index_jobs_tenant_document_fk',
      columns: [table.tenantId, table.documentId],
      foreignColumns: [knowledgeDocuments.tenantId, knowledgeDocuments.id],
    }),
    tenantDocumentStatusIdx: index('knowledge_index_jobs_tenant_document_status_idx').on(
      table.tenantId,
      table.documentId,
      table.status,
    ),
    tenantWorkspaceStatusIdx: index('knowledge_index_jobs_tenant_workspace_status_idx').on(
      table.tenantId,
      table.workspaceId,
      table.status,
    ),
  }),
);

export const platformKnowledgeInstitutionVisibility = pgTable(
  'platform_knowledge_institution_visibility',
  {
    id: varchar('id', { length: 96 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    knowledgeDocumentId: varchar('knowledge_document_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantDocumentInstitutionUnique: unique(
      'platform_kb_visibility_tenant_document_institution_unique',
    ).on(table.tenantId, table.knowledgeDocumentId, table.institutionId),
    documentFk: foreignKey({
      name: 'platform_kb_visibility_tenant_document_fk',
      columns: [table.tenantId, table.knowledgeDocumentId],
      foreignColumns: [knowledgeDocuments.tenantId, knowledgeDocuments.id],
    }),
    tenantDocumentIdx: index('platform_kb_visibility_tenant_document_idx').on(
      table.tenantId,
      table.knowledgeDocumentId,
    ),
    tenantInstitutionIdx: index('platform_kb_visibility_tenant_institution_idx').on(
      table.tenantId,
      table.institutionId,
    ),
  }),
);

export const knowledgeDocumentFiles = pgTable(
  'knowledge_document_files',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    knowledgeDocumentId: varchar('knowledge_document_id', { length: 64 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    storageKey: varchar('storage_key', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    uploadedByUserId: varchar('uploaded_by_user_id', { length: 96 }).notNull(),
    ...timestamps,
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => ({
    tenantIdIdUnique: unique('knowledge_document_files_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    documentFk: foreignKey({
      name: 'knowledge_document_files_tenant_document_fk',
      columns: [table.tenantId, table.knowledgeDocumentId],
      foreignColumns: [knowledgeDocuments.tenantId, knowledgeDocuments.id],
    }),
    tenantDocumentStatusIdx: index('knowledge_document_files_tenant_document_status_idx').on(
      table.tenantId,
      table.knowledgeDocumentId,
      table.status,
    ),
    tenantStorageKeyUnique: uniqueIndex('knowledge_document_files_tenant_storage_key_unique').on(
      table.tenantId,
      table.storageKey,
    ),
  }),
);

export const knowledgeDocumentFileParses = pgTable(
  'knowledge_document_file_parses',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    knowledgeDocumentId: varchar('knowledge_document_id', { length: 64 }).notNull(),
    fileId: varchar('file_id', { length: 64 }).notNull(),
    parseStatus: varchar('parse_status', { length: 32 }).notNull().default('pending'),
    failureReasonCode: varchar('failure_reason_code', { length: 64 }),
    safeFailureMessage: varchar('safe_failure_message', { length: 240 }),
    textContent: text('text_content').notNull().default(''),
    textLength: integer('text_length').notNull().default(0),
    chunkCount: integer('chunk_count').notNull().default(0),
    parserVersion: varchar('parser_version', { length: 64 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('knowledge_file_parses_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    tenantFileUnique: unique('knowledge_file_parses_tenant_file_unique').on(
      table.tenantId,
      table.fileId,
    ),
    documentFk: foreignKey({
      name: 'knowledge_file_parses_tenant_document_fk',
      columns: [table.tenantId, table.knowledgeDocumentId],
      foreignColumns: [knowledgeDocuments.tenantId, knowledgeDocuments.id],
    }),
    fileFk: foreignKey({
      name: 'knowledge_file_parses_tenant_file_fk',
      columns: [table.tenantId, table.fileId],
      foreignColumns: [knowledgeDocumentFiles.tenantId, knowledgeDocumentFiles.id],
    }),
    tenantDocumentStatusIdx: index('knowledge_file_parses_tenant_document_status_idx').on(
      table.tenantId,
      table.knowledgeDocumentId,
      table.parseStatus,
    ),
    tenantFileIdx: index('knowledge_file_parses_tenant_file_idx').on(
      table.tenantId,
      table.fileId,
    ),
  }),
);

export const knowledgeDocumentFileParseChunks = pgTable(
  'knowledge_document_file_parse_chunks',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    knowledgeDocumentId: varchar('knowledge_document_id', { length: 64 }).notNull(),
    fileId: varchar('file_id', { length: 64 }).notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    textPreview: text('text_preview').notNull(),
    charCount: integer('char_count').notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('knowledge_file_parse_chunks_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    tenantFileChunkUnique: unique('knowledge_file_parse_chunks_tenant_file_chunk_unique').on(
      table.tenantId,
      table.fileId,
      table.chunkIndex,
    ),
    documentFk: foreignKey({
      name: 'knowledge_file_parse_chunks_tenant_document_fk',
      columns: [table.tenantId, table.knowledgeDocumentId],
      foreignColumns: [knowledgeDocuments.tenantId, knowledgeDocuments.id],
    }),
    fileFk: foreignKey({
      name: 'knowledge_file_parse_chunks_tenant_file_fk',
      columns: [table.tenantId, table.fileId],
      foreignColumns: [knowledgeDocumentFiles.tenantId, knowledgeDocumentFiles.id],
    }),
    tenantFileIdx: index('knowledge_file_parse_chunks_tenant_file_idx').on(
      table.tenantId,
      table.fileId,
    ),
  }),
);

export const knowledgeDocumentFileParseChunkEmbeddings = pgTable(
  'knowledge_document_file_parse_chunk_embeddings',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    knowledgeDocumentId: varchar('knowledge_document_id', { length: 64 }).notNull(),
    fileId: varchar('file_id', { length: 64 }).notNull(),
    chunkId: varchar('chunk_id', { length: 64 }).notNull(),
    embeddingProvider: varchar('embedding_provider', { length: 64 })
      .notNull()
      .default('mock_local_embedding'),
    embeddingModel: varchar('embedding_model', { length: 96 })
      .notNull()
      .default('mock-local-embedding-v1'),
    embeddingDimensions: integer('embedding_dimensions').notNull(),
    embeddingVectorJson: jsonb('embedding_vector_json').$type<number[]>().notNull(),
    status: varchar('status', { length: 32 }).notNull().default('ready'),
    failureReasonCode: varchar('failure_reason_code', { length: 64 }),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('knowledge_file_parse_chunk_embeddings_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    tenantChunkUnique: unique('knowledge_file_parse_chunk_embeddings_tenant_chunk_unique').on(
      table.tenantId,
      table.chunkId,
    ),
    documentFk: foreignKey({
      name: 'knowledge_file_parse_chunk_embeddings_tenant_document_fk',
      columns: [table.tenantId, table.knowledgeDocumentId],
      foreignColumns: [knowledgeDocuments.tenantId, knowledgeDocuments.id],
    }),
    fileFk: foreignKey({
      name: 'knowledge_file_parse_chunk_embeddings_tenant_file_fk',
      columns: [table.tenantId, table.fileId],
      foreignColumns: [knowledgeDocumentFiles.tenantId, knowledgeDocumentFiles.id],
    }),
    chunkFk: foreignKey({
      name: 'knowledge_file_parse_chunk_embeddings_tenant_chunk_fk',
      columns: [table.tenantId, table.chunkId],
      foreignColumns: [knowledgeDocumentFileParseChunks.tenantId, knowledgeDocumentFileParseChunks.id],
    }),
    tenantDocumentIdx: index('knowledge_file_parse_chunk_embeddings_tenant_document_idx').on(
      table.tenantId,
      table.knowledgeDocumentId,
    ),
    tenantFileIdx: index('knowledge_file_parse_chunk_embeddings_tenant_file_idx').on(
      table.tenantId,
      table.fileId,
    ),
    tenantProviderModelIdx: index(
      'knowledge_file_parse_chunk_embeddings_tenant_provider_model_idx',
    ).on(table.tenantId, table.embeddingProvider, table.embeddingModel),
  }),
);

export const knowledgeIndexingJobs = pgTable(
  'knowledge_indexing_jobs',
  {
    jobId: varchar('job_id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    actorUserId: varchar('actor_user_id', { length: 96 }),
    knowledgeId: varchar('knowledge_id', { length: 64 }),
    fileId: varchar('file_id', { length: 64 }),
    jobType: knowledgeIndexingJobTypeEnum('job_type').notNull(),
    status: knowledgeIndexingJobStatusEnum('status').notNull().default('pending'),
    totalCount: integer('total_count').notNull().default(0),
    processedCount: integer('processed_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    failureReasonCode: varchar('failure_reason_code', { length: 64 }),
    safeMessage: varchar('safe_message', { length: 240 }),
    metadataJson: jsonb('metadata_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantStatusCreatedIdx: index('knowledge_indexing_jobs_tenant_status_created_idx').on(
      table.tenantId,
      table.status,
      table.createdAt,
    ),
    tenantInstitutionCreatedIdx: index('knowledge_indexing_jobs_tenant_institution_created_idx').on(
      table.tenantId,
      table.institutionId,
      table.createdAt,
    ),
    tenantKnowledgeCreatedIdx: index('knowledge_indexing_jobs_tenant_knowledge_created_idx').on(
      table.tenantId,
      table.knowledgeId,
      table.createdAt,
    ),
    tenantFileCreatedIdx: index('knowledge_indexing_jobs_tenant_file_created_idx').on(
      table.tenantId,
      table.fileId,
      table.createdAt,
    ),
    tenantJobTypeCreatedIdx: index('knowledge_indexing_jobs_tenant_job_type_created_idx').on(
      table.tenantId,
      table.jobType,
      table.createdAt,
    ),
  }),
);

export const knowledgeQaAuditLogs = pgTable(
  'knowledge_qa_audit_logs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    actorScope: varchar('actor_scope', { length: 24 }).notNull(),
    actorUserId: varchar('actor_user_id', { length: 96 }).notNull(),
    question: varchar('question', { length: 512 }).notNull(),
    answerPreview: varchar('answer_preview', { length: 1024 }).notNull(),
    retrievalMode: varchar('retrieval_mode', { length: 24 }).notNull(),
    citationCount: integer('citation_count').notNull(),
    safeStatus: varchar('safe_status', { length: 32 }).notNull(),
    safeFailureMessage: varchar('safe_failure_message', { length: 256 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdUnique: unique('knowledge_qa_audit_logs_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    tenantCreatedIdx: index('knowledge_qa_audit_logs_tenant_created_idx').on(
      table.tenantId,
      table.createdAt,
    ),
    tenantInstitutionCreatedIdx: index(
      'knowledge_qa_audit_logs_tenant_institution_created_idx',
    ).on(table.tenantId, table.institutionId, table.createdAt),
    tenantScopeCreatedIdx: index('knowledge_qa_audit_logs_tenant_scope_created_idx').on(
      table.tenantId,
      table.actorScope,
      table.createdAt,
    ),
  }),
);

export const knowledgeQuotaUsageRecords = pgTable(
  'knowledge_quota_usage_records',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    actorUserId: varchar('actor_user_id', { length: 96 }),
    resourceKey: varchar('resource_key', { length: 96 }).notNull(),
    action: varchar('action', { length: 96 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    safeReasonCode: varchar('safe_reason_code', { length: 96 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantCreatedIdx: index('knowledge_quota_usage_records_tenant_created_idx').on(
      table.tenantId,
      table.createdAt,
    ),
    tenantInstitutionCreatedIdx: index('knowledge_quota_usage_records_tenant_institution_created_idx').on(
      table.tenantId,
      table.institutionId,
      table.createdAt,
    ),
    tenantResourceStatusCreatedIdx: index('knowledge_quota_usage_records_resource_status_created_idx').on(
      table.tenantId,
      table.resourceKey,
      table.status,
      table.createdAt,
    ),
  }),
);

export const aiCallUsageRecords = pgTable(
  'ai_call_usage_records',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    actorUserId: varchar('actor_user_id', { length: 96 }).notNull(),
    provider: varchar('provider', { length: 64 }).notNull(),
    model: varchar('model', { length: 128 }).notNull(),
    promptTokens: integer('prompt_tokens'),
    completionTokens: integer('completion_tokens'),
    totalTokens: integer('total_tokens'),
    latencyMs: integer('latency_ms'),
    status: varchar('status', { length: 32 }).notNull(),
    errorCode: varchar('error_code', { length: 64 }),
    metadata: jsonb('metadata'),
    aiCreditsConsumed: integer('ai_credits_consumed'),
    meteringStatus: varchar('metering_status', { length: 32 }),
    meteringVersion: varchar('metering_version', { length: 64 }),
    meteringDetails: jsonb('metering_details').$type<JsonRecord>(),
    serviceCategory: varchar('service_category', { length: 64 }),
    serviceName: varchar('service_name', { length: 128 }),
    serviceSource: varchar('service_source', { length: 96 }),
    serviceAction: varchar('service_action', { length: 96 }),
    serviceVersion: varchar('service_version', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdUnique: unique('ai_call_usage_records_tenant_id_unique').on(
      table.tenantId,
      table.id,
    ),
    tenantCreatedIdx: index('ai_call_usage_records_tenant_created_idx').on(
      table.tenantId,
      table.createdAt,
    ),
    tenantInstitutionCreatedIdx: index(
      'ai_call_usage_records_tenant_institution_created_idx',
    ).on(table.tenantId, table.institutionId, table.createdAt),
  }),
);

export const knowledgeChunkEmbeddings = pgTable(
  'knowledge_chunk_embeddings',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    chunkId: varchar('chunk_id', { length: 64 }).notNull(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 64 }).notNull(),
    embeddingProvider: varchar('embedding_provider', { length: 64 })
      .notNull()
      .default('mock_demo_embedding'),
    embeddingModel: varchar('embedding_model', { length: 96 })
      .notNull()
      .default('mock-demo-embedding-v1'),
    embeddingDimensions: integer('embedding_dimensions').notNull(),
    embeddingVectorJson: jsonb('embedding_vector_json').$type<number[]>().notNull(),
    status: knowledgeBaseRuntimeStatusEnum('status').notNull().default('ready'),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('knowledge_chunk_embeddings_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    chunkFk: foreignKey({
      name: 'knowledge_chunk_embeddings_tenant_chunk_fk',
      columns: [table.tenantId, table.chunkId],
      foreignColumns: [knowledgeChunks.tenantId, knowledgeChunks.id],
    }),
    tenantChunkIdx: index('knowledge_chunk_embeddings_tenant_chunk_idx').on(
      table.tenantId,
      table.chunkId,
    ),
    tenantWorkspaceStatusIdx: index(
      'knowledge_chunk_embeddings_tenant_workspace_status_idx',
    ).on(table.tenantId, table.workspaceId, table.status),
    tenantProviderModelIdx: index(
      'knowledge_chunk_embeddings_tenant_provider_model_idx',
    ).on(table.tenantId, table.embeddingProvider, table.embeddingModel),
  }),
);

export const customers = pgTable(
  'customers',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    lifecycle: customerLifecycleEnum('lifecycle').notNull(),
    priority: customerPriorityEnum('priority').notNull(),
    ownerUserId: varchar('owner_user_id', { length: 96 }).notNull(),
    projectInterest: varchar('project_interest', { length: 160 }).notNull(),
    maskedPhone: varchar('masked_phone', { length: 32 }).notNull(),
    maskedMedicalRecordNo: varchar('masked_medical_record_no', { length: 64 }).notNull(),
    lastTouchSummary: text('last_touch_summary').notNull(),
    nextAction: text('next_action').notNull(),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    gender: varchar('gender', { length: 20 }).notNull().default(''),
    birthDate: varchar('birth_date', { length: 20 }).notNull().default(''),
    referralSource: varchar('referral_source', { length: 80 }).notNull().default(''),
    notes: text('notes').notNull().default(''),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('customers_tenant_id_id_unique').on(table.tenantId, table.id),
    tenantInstitutionIdUnique: unique('customers_tenant_institution_id_id_unique').on(
      table.tenantId,
      table.institutionId,
      table.id,
    ),
    tenantIdx: index('customers_tenant_idx').on(table.tenantId),
    tenantPriorityIdx: index('customers_tenant_priority_idx').on(table.tenantId, table.priority),
  }),
);

export const weComCustomerMappingStates = pgTable(
  'wecom_customer_mapping_states',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    proofContactId: varchar('proof_contact_id', { length: 64 }).notNull(),
    proofEmployeeId: varchar('proof_employee_id', { length: 64 }).notNull(),
    sourceMode: weComCustomerMappingSourceModeEnum('source_mode').notNull(),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    status: weComCustomerMappingStatusEnum('status').notNull(),
    decidedBy: varchar('decided_by', { length: 96 }).notNull(),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => ({
    customerFk: foreignKey({
      name: 'wecom_customer_mapping_states_tenant_institution_customer_fk',
      columns: [table.tenantId, table.institutionId, table.customerId],
      foreignColumns: [customers.tenantId, customers.institutionId, customers.id],
    }),
    scopeProofContactUnique: unique(
      'wecom_customer_mapping_states_tenant_institution_proof_contact_unique',
    ).on(table.tenantId, table.institutionId, table.proofContactId),
    scopeCustomerIdUnique: unique(
      'wecom_customer_mapping_states_scope_customer_id_unique',
    ).on(table.tenantId, table.institutionId, table.customerId, table.id),
    scopeCustomerStatusIdx: index(
      'wecom_customer_mapping_states_tenant_institution_customer_status_idx',
    ).on(table.tenantId, table.institutionId, table.customerId, table.status),
  }),
);

export const customerChannelContactConsents = pgTable(
  'customer_channel_contact_consents',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    channelType: customerChannelTypeEnum('channel_type').notNull(),
    status: customerChannelContactConsentStatusEnum('status').notNull(),
    sourceType: customerChannelContactConsentSourceTypeEnum('source_type').notNull(),
    evidenceRef: varchar('evidence_ref', { length: 96 }).notNull(),
    recordedBy: varchar('recorded_by', { length: 96 }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => ({
    customerFk: foreignKey({
      name: 'customer_channel_contact_consents_tenant_institution_customer_fk',
      columns: [table.tenantId, table.institutionId, table.customerId],
      foreignColumns: [customers.tenantId, customers.institutionId, customers.id],
    }),
    scopeUnique: unique('customer_channel_contact_consents_scope_unique').on(
      table.tenantId,
      table.institutionId,
      table.customerId,
      table.channelType,
    ),
    scopeIdUnique: unique('customer_channel_contact_consents_scope_id_unique').on(
      table.tenantId,
      table.institutionId,
      table.customerId,
      table.channelType,
      table.id,
    ),
    versionPositiveCheck: check(
      'customer_channel_contact_consents_version_positive_check',
      sql`${table.version} > 0`,
    ),
    statusSourceCheck: check(
      'customer_channel_contact_consents_status_source_check',
      sql`(${table.status} = 'consented' AND ${table.sourceType} IN ('customer_explicit_verbal', 'customer_explicit_written')) OR (${table.status} = 'opted_out' AND ${table.sourceType} = 'customer_opt_out_request') OR (${table.status} = 'consent_revoked' AND ${table.sourceType} = 'customer_consent_revocation')`,
    ),
  }),
);

export const customerChannelFrequencyStates = pgTable(
  'customer_channel_frequency_states',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    channelType: customerChannelTypeEnum('channel_type').notNull(),
    windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull(),
    windowEndsAt: timestamp('window_ends_at', { withTimezone: true }).notNull(),
    preparedCount: integer('prepared_count').notNull().default(0),
    completedCount: integer('completed_count').notNull().default(0),
    maxPreparedCount: integer('max_prepared_count').notNull().default(1),
    maxCompletedCount: integer('max_completed_count').notNull().default(1),
    nextAllowedAt: timestamp('next_allowed_at', { withTimezone: true }).notNull(),
    lastPreparedRef: varchar('last_prepared_ref', { length: 96 }),
    lastCompletedRef: varchar('last_completed_ref', { length: 96 }),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => ({
    customerFk: foreignKey({
      name: 'customer_channel_frequency_states_tenant_institution_customer_fk',
      columns: [table.tenantId, table.institutionId, table.customerId],
      foreignColumns: [customers.tenantId, customers.institutionId, customers.id],
    }),
    scopeUnique: unique('customer_channel_frequency_states_scope_unique').on(
      table.tenantId,
      table.institutionId,
      table.customerId,
      table.channelType,
    ),
    scopeIdUnique: unique('customer_channel_frequency_states_scope_id_unique').on(
      table.tenantId,
      table.institutionId,
      table.customerId,
      table.channelType,
      table.id,
    ),
    countsCheck: check(
      'customer_channel_frequency_states_counts_check',
      sql`${table.preparedCount} >= 0 AND ${table.completedCount} >= 0 AND ${table.preparedCount} <= ${table.maxPreparedCount} AND ${table.completedCount} <= ${table.maxCompletedCount}`,
    ),
    fixedCapsCheck: check(
      'customer_channel_frequency_states_fixed_caps_check',
      sql`${table.maxPreparedCount} = 1 AND ${table.maxCompletedCount} = 1`,
    ),
    windowCheck: check(
      'customer_channel_frequency_states_window_check',
      sql`${table.windowEndsAt} = ${table.windowStartedAt} + interval '24 hours' AND ${table.nextAllowedAt} = ${table.windowEndsAt}`,
    ),
    versionPositiveCheck: check(
      'customer_channel_frequency_states_version_positive_check',
      sql`${table.version} > 0`,
    ),
  }),
);

export const institutionChannelDryRunSnapshots = pgTable(
  'institution_channel_dry_run_snapshots',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    channelType: customerChannelTypeEnum('channel_type').notNull(),
    officialRoute: varchar('official_route', { length: 64 }).notNull(),
    proofInstitutionRef: varchar('proof_institution_ref', { length: 96 }).notNull(),
    callbackPlaceholderRef: varchar('callback_placeholder_ref', { length: 96 }).notNull(),
    configStatus: varchar('config_status', { length: 64 }).notNull(),
    preflightStatus: varchar('preflight_status', { length: 64 }).notNull(),
    proofEligibleMock: boolean('proof_eligible_mock').notNull(),
    evaluatedBy: varchar('evaluated_by', { length: 96 }).notNull(),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull(),
    allowRealSend: boolean('allow_real_send').notNull().default(false),
    externalChannelEnabled: boolean('external_channel_enabled').notNull().default(false),
    realSendAllowed: boolean('real_send_allowed').notNull().default(false),
    dryRunOnly: boolean('dry_run_only').notNull().default(true),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => ({
    scopeUnique: unique('institution_channel_dry_run_snapshots_scope_unique').on(
      table.tenantId,
      table.institutionId,
      table.channelType,
    ),
    scopeIdUnique: unique('institution_channel_dry_run_snapshots_scope_id_unique').on(
      table.tenantId,
      table.institutionId,
      table.channelType,
      table.id,
    ),
    safetyCheck: check(
      'institution_channel_dry_run_snapshots_safety_check',
      sql`${table.allowRealSend} = false AND ${table.externalChannelEnabled} = false AND ${table.realSendAllowed} = false AND ${table.dryRunOnly} = true`,
    ),
    routeCheck: check(
      'institution_channel_dry_run_snapshots_route_check',
      sql`${table.officialRoute} IN ('official_wecom_self_built', 'official_wecom_third_party', 'official_wecom_service_provider')`,
    ),
    readyCheck: check(
      'institution_channel_dry_run_snapshots_ready_check',
      sql`${table.configStatus} <> 'dry_run_ready' OR (${table.officialRoute} = 'official_wecom_self_built' AND ${table.preflightStatus} = 'mock_ready' AND ${table.proofEligibleMock} = true)`,
    ),
    versionPositiveCheck: check(
      'institution_channel_dry_run_snapshots_version_positive_check',
      sql`${table.version} > 0`,
    ),
  }),
);

export const weComRealSendProductionAttestations = pgTable(
  'wecom_real_send_production_attestations',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    environmentRef: varchar('environment_ref', { length: 96 }).notNull(),
    databaseIdentityRef: varchar('database_identity_ref', { length: 96 }).notNull(),
    migrationTarget: varchar('migration_target', { length: 128 }).notNull(),
    migrationHash: varchar('migration_hash', { length: 64 }).notNull(),
    journalLatest: varchar('journal_latest', { length: 128 }).notNull(),
    postcheckStatus: weComRealSendProofPostcheckStatusEnum('postcheck_status').notNull(),
    approvalRef: varchar('approval_ref', { length: 96 }).notNull(),
    reviewedBy: varchar('reviewed_by', { length: 96 }).notNull(),
    attestedBy: varchar('attested_by', { length: 96 }).notNull(),
    attestedAt: timestamp('attested_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => ({
    identityUnique: unique('wecom_real_send_production_attestations_identity_unique').on(
      table.environmentRef,
      table.databaseIdentityRef,
      table.migrationTarget,
    ),
    statusExpiresIdx: index('wecom_real_send_production_attestations_status_expires_idx').on(
      table.postcheckStatus,
      table.expiresAt,
    ),
    expiryCheck: check(
      'wecom_real_send_production_attestations_expiry_check',
      sql`${table.expiresAt} > ${table.attestedAt}`,
    ),
    hashCheck: check(
      'wecom_real_send_production_attestations_hash_check',
      sql`length(${table.migrationHash}) = 64`,
    ),
    versionPositiveCheck: check(
      'wecom_real_send_production_attestations_version_positive_check',
      sql`${table.version} > 0`,
    ),
  }),
);

export const weComRealSendProofControls = pgTable(
  'wecom_real_send_proof_controls',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    customerId: varchar('customer_id', { length: 64 }),
    channelType: customerChannelTypeEnum('channel_type'),
    operatorId: varchar('operator_id', { length: 96 }),
    role: authRoleEnum('role'),
    scopeKind: weComRealSendProofControlScopeKindEnum('scope_kind').notNull(),
    proofEnabled: boolean('proof_enabled').notNull().default(false),
    killSwitchEngaged: boolean('kill_switch_engaged').notNull().default(true),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    approvalRef: varchar('approval_ref', { length: 96 }).notNull(),
    approvedBy: varchar('approved_by', { length: 96 }).notNull(),
    updatedBy: varchar('updated_by', { length: 96 }).notNull(),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => ({
    scopeIdentityUnique: unique('wecom_real_send_proof_controls_scope_identity_unique').on(
      table.scopeKind,
      table.tenantId,
      table.institutionId,
      table.customerId,
      table.channelType,
      table.operatorId,
      table.role,
    ).nullsNotDistinct(),
    customerFk: foreignKey({
      name: 'wecom_real_send_proof_controls_tenant_institution_customer_fk',
      columns: [table.tenantId, table.institutionId, table.customerId],
      foreignColumns: [customers.tenantId, customers.institutionId, customers.id],
    }),
    scopeExpiresIdx: index('wecom_real_send_proof_controls_scope_expires_idx').on(
      table.scopeKind,
      table.expiresAt,
    ),
    timingCheck: check(
      'wecom_real_send_proof_controls_timing_check',
      sql`${table.expiresAt} > ${table.effectiveAt}`,
    ),
    versionPositiveCheck: check(
      'wecom_real_send_proof_controls_version_positive_check',
      sql`${table.version} > 0`,
    ),
    scopeShapeCheck: check(
      'wecom_real_send_proof_controls_scope_shape_check',
      sql`(${table.scopeKind} = 'global' AND ${table.tenantId} IS NULL AND ${table.institutionId} IS NULL AND ${table.customerId} IS NULL AND ${table.channelType} IS NULL AND ${table.operatorId} IS NULL AND ${table.role} IS NULL) OR (${table.scopeKind} = 'tenant' AND ${table.tenantId} IS NOT NULL AND ${table.institutionId} IS NULL AND ${table.customerId} IS NULL AND ${table.channelType} IS NULL AND ${table.operatorId} IS NULL AND ${table.role} IS NULL) OR (${table.scopeKind} = 'institution' AND ${table.tenantId} IS NOT NULL AND ${table.institutionId} IS NOT NULL AND ${table.customerId} IS NULL AND ${table.channelType} IS NULL AND ${table.operatorId} IS NULL AND ${table.role} IS NULL) OR (${table.scopeKind} = 'channel' AND ${table.tenantId} IS NULL AND ${table.institutionId} IS NULL AND ${table.customerId} IS NULL AND ${table.channelType} IS NOT NULL AND ${table.channelType} = 'wechat_work' AND ${table.operatorId} IS NULL AND ${table.role} IS NULL) OR (${table.scopeKind} = 'customer' AND ${table.tenantId} IS NOT NULL AND ${table.institutionId} IS NOT NULL AND ${table.customerId} IS NOT NULL AND ${table.channelType} IS NULL AND ${table.operatorId} IS NULL AND ${table.role} IS NULL) OR (${table.scopeKind} = 'operator_role' AND ${table.tenantId} IS NOT NULL AND ${table.institutionId} IS NOT NULL AND ${table.customerId} IS NULL AND ${table.channelType} IS NULL AND ${table.operatorId} IS NOT NULL AND ${table.role} IS NOT NULL)`,
    ),
    operatorSelfApprovalCheck: check(
      'wecom_real_send_proof_controls_operator_self_approval_check',
      sql`${table.scopeKind} <> 'operator_role' OR ${table.approvedBy} <> ${table.operatorId}`,
    ),
  }),
);

export const weComRealSendProofOperations = pgTable(
  'wecom_real_send_proof_operations',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    channelType: customerChannelTypeEnum('channel_type').notNull().default('wechat_work'),
    draftId: varchar('draft_id', { length: 64 }).notNull(),
    deliveryId: varchar('delivery_id', { length: 96 }).notNull(),
    sourceReadyNoSendRef: varchar('source_ready_no_send_ref', { length: 128 }).notNull(),
    sourceReadyNoSendDigest: varchar('source_ready_no_send_digest', { length: 64 }).notNull(),
    readinessFingerprint: varchar('readiness_fingerprint', { length: 64 }).notNull(),
    mappingId: varchar('mapping_id', { length: 64 }).notNull(),
    consentId: varchar('consent_id', { length: 64 }).notNull(),
    frequencyStateId: varchar('frequency_state_id', { length: 64 }).notNull(),
    dryRunSnapshotId: varchar('dry_run_snapshot_id', { length: 64 }).notNull(),
    productionAttestationId: varchar('production_attestation_id', { length: 64 }).notNull(),
    operationRef: varchar('operation_ref', { length: 96 }).notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    recipientBindingRef: varchar('recipient_binding_ref', { length: 96 }).notNull(),
    recipientBindingDigest: varchar('recipient_binding_digest', { length: 64 }).notNull(),
    status: weComRealSendProofOperationStatusEnum('status').notNull().default('requested'),
    confirmationTokenDigest: varchar('confirmation_token_digest', { length: 64 }).notNull(),
    confirmationIssuedAt: timestamp('confirmation_issued_at', { withTimezone: true }).notNull(),
    confirmationExpiresAt: timestamp('confirmation_expires_at', { withTimezone: true }).notNull(),
    confirmationConsumedAt: timestamp('confirmation_consumed_at', { withTimezone: true }),
    operatorId: varchar('operator_id', { length: 96 }).notNull(),
    sessionProvenance: varchar('session_provenance', { length: 32 })
      .$type<'server_session' | 'formal_session'>()
      .notNull(),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull(),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }),
    terminalAt: timestamp('terminal_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    providerResultCategory: weComRealSendProofProviderResultCategoryEnum('provider_result_category'),
    completedFrequencyRef: varchar('completed_frequency_ref', { length: 96 }),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => ({
    operationRefUnique: unique('wecom_real_send_proof_operations_operation_ref_unique').on(
      table.operationRef,
    ),
    tokenDigestUnique: unique('wecom_real_send_proof_operations_token_digest_unique').on(
      table.confirmationTokenDigest,
    ),
    sourceUnique: unique('wecom_real_send_proof_operations_source_unique').on(
      table.tenantId,
      table.institutionId,
      table.draftId,
      table.sourceReadyNoSendRef,
    ),
    scopeRefIdUnique: unique(
      'wecom_real_send_proof_operations_scope_ref_id_unique',
    ).on(
      table.tenantId,
      table.institutionId,
      table.customerId,
      table.operationRef,
      table.id,
    ),
    customerFk: foreignKey({
      name: 'wecom_real_send_proof_operations_tenant_institution_customer_fk',
      columns: [table.tenantId, table.institutionId, table.customerId],
      foreignColumns: [customers.tenantId, customers.institutionId, customers.id],
    }),
    draftFk: foreignKey({
      name: 'wecom_real_send_proof_operations_scope_draft_fk',
      columns: [table.tenantId, table.institutionId, table.customerId, table.draftId],
      foreignColumns: [
        followUpMessageDrafts.tenantId,
        followUpMessageDrafts.institutionId,
        followUpMessageDrafts.customerId,
        followUpMessageDrafts.id,
      ],
    }),
    mappingFk: foreignKey({
      name: 'wecom_real_send_proof_operations_scope_mapping_fk',
      columns: [table.tenantId, table.institutionId, table.customerId, table.mappingId],
      foreignColumns: [
        weComCustomerMappingStates.tenantId,
        weComCustomerMappingStates.institutionId,
        weComCustomerMappingStates.customerId,
        weComCustomerMappingStates.id,
      ],
    }),
    consentFk: foreignKey({
      name: 'wecom_real_send_proof_operations_scope_consent_fk',
      columns: [table.tenantId, table.institutionId, table.customerId, table.channelType, table.consentId],
      foreignColumns: [
        customerChannelContactConsents.tenantId,
        customerChannelContactConsents.institutionId,
        customerChannelContactConsents.customerId,
        customerChannelContactConsents.channelType,
        customerChannelContactConsents.id,
      ],
    }),
    frequencyFk: foreignKey({
      name: 'wecom_real_send_proof_operations_scope_frequency_fk',
      columns: [table.tenantId, table.institutionId, table.customerId, table.channelType, table.frequencyStateId],
      foreignColumns: [
        customerChannelFrequencyStates.tenantId,
        customerChannelFrequencyStates.institutionId,
        customerChannelFrequencyStates.customerId,
        customerChannelFrequencyStates.channelType,
        customerChannelFrequencyStates.id,
      ],
    }),
    dryRunSnapshotFk: foreignKey({
      name: 'wecom_real_send_proof_operations_scope_dry_run_snapshot_fk',
      columns: [table.tenantId, table.institutionId, table.channelType, table.dryRunSnapshotId],
      foreignColumns: [
        institutionChannelDryRunSnapshots.tenantId,
        institutionChannelDryRunSnapshots.institutionId,
        institutionChannelDryRunSnapshots.channelType,
        institutionChannelDryRunSnapshots.id,
      ],
    }),
    productionAttestationFk: foreignKey({
      name: 'wecom_real_send_proof_operations_production_attestation_fk',
      columns: [table.productionAttestationId],
      foreignColumns: [weComRealSendProductionAttestations.id],
    }),
    tenantStatusIdx: index('wecom_real_send_proof_operations_tenant_status_idx').on(
      table.tenantId,
      table.institutionId,
      table.status,
    ),
    attemptCountCheck: check(
      'wecom_real_send_proof_operations_attempt_count_check',
      sql`${table.attemptCount} BETWEEN 0 AND 1`,
    ),
    tokenTimingCheck: check(
      'wecom_real_send_proof_operations_token_timing_check',
      sql`${table.confirmationExpiresAt} > ${table.confirmationIssuedAt} AND (${table.confirmationConsumedAt} IS NULL OR (${table.confirmationConsumedAt} > ${table.confirmationIssuedAt} AND ${table.confirmationConsumedAt} < ${table.confirmationExpiresAt}))`,
    ),
    consumedOperatorCheck: check(
      'wecom_real_send_proof_operations_consumed_operator_check',
      sql`${table.confirmationConsumedAt} IS NULL OR ${table.operatorId} IS NOT NULL`,
    ),
    sessionProvenanceCheck: check(
      'wecom_real_send_proof_operations_session_provenance_check',
      sql`${table.sessionProvenance} IN ('server_session', 'formal_session')`,
    ),
    attemptedCheck: check(
      'wecom_real_send_proof_operations_attempted_check',
      sql`${table.status} NOT IN ('attempted', 'succeeded', 'failed', 'unknown_outcome') OR (${table.attemptedAt} IS NOT NULL AND ${table.confirmationConsumedAt} IS NOT NULL AND ${table.attemptCount} = 1)`,
    ),
    terminalCheck: check(
      'wecom_real_send_proof_operations_terminal_check',
      sql`(${table.status} IN ('succeeded', 'failed', 'unknown_outcome', 'aborted') AND ${table.terminalAt} IS NOT NULL) OR (${table.status} NOT IN ('succeeded', 'failed', 'unknown_outcome', 'aborted') AND ${table.terminalAt} IS NULL)`,
    ),
    statusShapeCheck: check(
      'wecom_real_send_proof_operations_status_shape_check',
      sql`(${table.status} = 'requested' AND ${table.confirmationConsumedAt} IS NULL AND ${table.attemptedAt} IS NULL AND ${table.terminalAt} IS NULL AND ${table.attemptCount} = 0) OR (${table.status} = 'aborted' AND ${table.confirmationConsumedAt} IS NULL AND ${table.attemptedAt} IS NULL AND ${table.terminalAt} IS NOT NULL AND ${table.attemptCount} = 0) OR (${table.status} = 'attempted' AND ${table.confirmationConsumedAt} IS NOT NULL AND ${table.attemptedAt} IS NOT NULL AND ${table.terminalAt} IS NULL AND ${table.attemptCount} = 1) OR (${table.status} IN ('succeeded', 'failed', 'unknown_outcome') AND ${table.confirmationConsumedAt} IS NOT NULL AND ${table.attemptedAt} IS NOT NULL AND ${table.terminalAt} IS NOT NULL AND ${table.attemptCount} = 1)`,
    ),
    completedFrequencyCheck: check(
      'wecom_real_send_proof_operations_completed_frequency_check',
      sql`(${table.status} = 'succeeded' AND ${table.completedFrequencyRef} IS NOT NULL AND ${table.completedFrequencyRef} = ${table.operationRef}) OR (${table.status} <> 'succeeded' AND ${table.completedFrequencyRef} IS NULL)`,
    ),
    providerResultCheck: check(
      'wecom_real_send_proof_operations_provider_result_check',
      sql`(${table.status} = 'succeeded' AND ${table.providerResultCategory} IS NOT NULL AND ${table.providerResultCategory} = 'accepted') OR (${table.status} = 'failed' AND ${table.providerResultCategory} IS NOT NULL AND ${table.providerResultCategory} = 'rejected') OR (${table.status} = 'unknown_outcome' AND ${table.providerResultCategory} IS NOT NULL AND ${table.providerResultCategory} IN ('transport_error', 'timeout', 'indeterminate')) OR (${table.status} IN ('requested', 'aborted', 'attempted') AND ${table.providerResultCategory} IS NULL)`,
    ),
    digestLengthsCheck: check(
      'wecom_real_send_proof_operations_digest_lengths_check',
      sql`length(${table.sourceReadyNoSendDigest}) = 64 AND length(${table.readinessFingerprint}) = 64 AND length(${table.contentHash}) = 64 AND length(${table.recipientBindingDigest}) = 64 AND length(${table.confirmationTokenDigest}) = 64`,
    ),
    versionPositiveCheck: check(
      'wecom_real_send_proof_operations_version_positive_check',
      sql`${table.version} > 0`,
    ),
  }),
);

export const weComCustomerBroadcastTaskProviderAttempts = pgTable(
  'wecom_customer_broadcast_task_provider_attempts',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    operationId: varchar('operation_id', { length: 64 }).notNull(),
    operationRef: varchar('operation_ref', { length: 96 }).notNull(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    capabilityKind: varchar('capability_kind', { length: 64 })
      .notNull()
      .default('customer_broadcast_task'),
    providerKind: varchar('provider_kind', { length: 64 })
      .notNull()
      .default('wecom_official_customer_broadcast'),
    dispatchState: weComCustomerBroadcastTaskDispatchStateEnum('dispatch_state')
      .notNull()
      .default('not_started'),
    dispatchCount: integer('dispatch_count').notNull().default(0),
    dispatchStartedAt: timestamp('dispatch_started_at', { withTimezone: true }),
    dispatchTerminalAt: timestamp('dispatch_terminal_at', { withTimezone: true }),
    taskRefDigest: varchar('task_ref_digest', { length: 64 }),
    memberConfirmationRequired: boolean('member_confirmation_required')
      .notNull()
      .default(true),
    providerResultCategory: weComRealSendProofProviderResultCategoryEnum(
      'provider_result_category',
    ),
    sendResultStatus: weComCustomerBroadcastTaskSendResultStatusEnum('send_result_status')
      .notNull()
      .default('not_checked'),
    sendResultCheckedAt: timestamp('send_result_checked_at', { withTimezone: true }),
    finalizeState: weComCustomerBroadcastTaskFinalizeStateEnum('finalize_state')
      .notNull()
      .default('not_finalized'),
    reconciliationState: weComCustomerBroadcastTaskReconciliationStateEnum(
      'reconciliation_state',
    ).notNull().default('none'),
    manualReviewRequired: boolean('manual_review_required').notNull().default(false),
    automaticRetryAllowed: boolean('automatic_retry_allowed').notNull().default(false),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => ({
    operationUnique: unique(
      'wecom_customer_broadcast_task_provider_attempts_operation_unique',
    ).on(table.operationId),
    operationScopeFk: foreignKey({
      name: 'wecom_customer_broadcast_task_provider_attempts_operation_scope_fk',
      columns: [
        table.tenantId,
        table.institutionId,
        table.customerId,
        table.operationRef,
        table.operationId,
      ],
      foreignColumns: [
        weComRealSendProofOperations.tenantId,
        weComRealSendProofOperations.institutionId,
        weComRealSendProofOperations.customerId,
        weComRealSendProofOperations.operationRef,
        weComRealSendProofOperations.id,
      ],
    }),
    scopeDispatchIdx: index(
      'wecom_customer_broadcast_task_provider_attempts_scope_dispatch_idx',
    ).on(table.tenantId, table.institutionId, table.dispatchState),
    capabilityCheck: check(
      'wecom_customer_broadcast_task_provider_attempts_capability_check',
      sql`${table.capabilityKind} = 'customer_broadcast_task' AND ${table.providerKind} = 'wecom_official_customer_broadcast' AND ${table.memberConfirmationRequired} = true`,
    ),
    dispatchOnceCheck: check(
      'wecom_customer_broadcast_task_provider_attempts_dispatch_once_check',
      sql`${table.dispatchCount} BETWEEN 0 AND 1 AND ((${table.dispatchState} = 'not_started' AND ${table.dispatchCount} = 0) OR (${table.dispatchState} <> 'not_started' AND ${table.dispatchCount} = 1))`,
    ),
    dispatchTimingCheck: check(
      'wecom_customer_broadcast_task_provider_attempts_dispatch_timing_check',
      sql`(${table.dispatchState} = 'not_started' AND ${table.dispatchStartedAt} IS NULL AND ${table.dispatchTerminalAt} IS NULL) OR (${table.dispatchState} = 'task_create_attempted' AND ${table.dispatchStartedAt} IS NOT NULL AND ${table.dispatchTerminalAt} IS NULL) OR (${table.dispatchState} IN ('task_created', 'task_create_failed', 'task_create_unknown') AND ${table.dispatchStartedAt} IS NOT NULL AND ${table.dispatchTerminalAt} IS NOT NULL AND ${table.dispatchTerminalAt} >= ${table.dispatchStartedAt})`,
    ),
    taskRefDigestCheck: check(
      'wecom_customer_broadcast_task_provider_attempts_task_ref_digest_check',
      sql`(${table.taskRefDigest} IS NULL OR (length(${table.taskRefDigest}) = 64 AND ${table.taskRefDigest} ~ '^[0-9a-f]{64}$')) AND (${table.dispatchState} <> 'task_created' OR ${table.taskRefDigest} IS NOT NULL)`,
    ),
    providerResultCheck: check(
      'wecom_customer_broadcast_task_provider_attempts_provider_result_check',
      sql`(${table.dispatchState} IN ('not_started', 'task_create_attempted') AND ${table.providerResultCategory} IS NULL) OR (${table.dispatchState} = 'task_created' AND ${table.providerResultCategory} = 'accepted') OR (${table.dispatchState} = 'task_create_failed' AND ${table.providerResultCategory} = 'rejected') OR (${table.dispatchState} = 'task_create_unknown' AND ${table.providerResultCategory} IN ('transport_error', 'timeout', 'indeterminate'))`,
    ),
    sendResultCheck: check(
      'wecom_customer_broadcast_task_provider_attempts_send_result_check',
      sql`(${table.sendResultStatus} = 'not_checked' OR ${table.dispatchState} = 'task_created') AND ((${table.sendResultStatus} IN ('not_checked', 'awaiting_member_confirmation') AND ${table.sendResultCheckedAt} IS NULL) OR (${table.sendResultStatus} IN ('target_sent', 'target_failed', 'target_unknown') AND ${table.sendResultCheckedAt} IS NOT NULL AND ${table.dispatchTerminalAt} IS NOT NULL AND ${table.sendResultCheckedAt} >= ${table.dispatchTerminalAt}))`,
    ),
    finalizeCandidateCheck: check(
      'wecom_customer_broadcast_task_provider_attempts_finalize_candidate_check',
      sql`${table.finalizeState} = 'not_finalized' OR (${table.finalizeState} = 'success_recorded' AND ${table.sendResultStatus} = 'target_sent') OR (${table.finalizeState} = 'failure_recorded' AND (${table.dispatchState} = 'task_create_failed' OR ${table.sendResultStatus} = 'target_failed')) OR (${table.finalizeState} = 'unknown_recorded' AND (${table.dispatchState} = 'task_create_unknown' OR ${table.sendResultStatus} = 'target_unknown'))`,
    ),
    reconciliationCheck: check(
      'wecom_customer_broadcast_task_provider_attempts_reconciliation_check',
      sql`(${table.reconciliationState} = 'manual_review_required' AND ${table.manualReviewRequired} = true) OR (${table.reconciliationState} IN ('none', 'reconciled') AND ${table.manualReviewRequired} = false)`,
    ),
    unknownReviewCheck: check(
      'wecom_customer_broadcast_task_provider_attempts_unknown_review_check',
      sql`${table.automaticRetryAllowed} = false AND ((${table.dispatchState} <> 'task_create_unknown' AND ${table.sendResultStatus} <> 'target_unknown') OR ${table.reconciliationState} IN ('manual_review_required', 'reconciled'))`,
    ),
    versionPositiveCheck: check(
      'wecom_customer_broadcast_task_provider_attempts_version_positive_check',
      sql`${table.version} > 0`,
    ),
  }),
);

export const weComCustomerBroadcastRecipientBindings = pgTable(
  'wecom_customer_broadcast_recipient_bindings',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    operationId: varchar('operation_id', { length: 64 }).notNull(),
    operationRef: varchar('operation_ref', { length: 96 }).notNull(),
    mappingId: varchar('mapping_id', { length: 64 }).notNull(),
    recipientBindingRef: varchar('recipient_binding_ref', { length: 96 }).notNull(),
    recipientBindingDigest: varchar('recipient_binding_digest', { length: 64 }).notNull(),
    recipientBindingVersion: integer('recipient_binding_version').notNull(),
    opaqueHandleRef: varchar('opaque_handle_ref', { length: 128 }).notNull(),
    sourceKind: weComCustomerBroadcastRecipientBindingSourceKindEnum('source_kind').notNull(),
    status: weComCustomerBroadcastRecipientBindingStatusEnum('status')
      .notNull()
      .default('active'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    operationScopeFk: foreignKey({
      name: 'wecom_customer_broadcast_recipient_bindings_operation_scope_fk',
      columns: [
        table.tenantId,
        table.institutionId,
        table.customerId,
        table.operationRef,
        table.operationId,
      ],
      foreignColumns: [
        weComRealSendProofOperations.tenantId,
        weComRealSendProofOperations.institutionId,
        weComRealSendProofOperations.customerId,
        weComRealSendProofOperations.operationRef,
        weComRealSendProofOperations.id,
      ],
    }),
    mappingScopeFk: foreignKey({
      name: 'wecom_customer_broadcast_recipient_bindings_mapping_scope_fk',
      columns: [table.tenantId, table.institutionId, table.customerId, table.mappingId],
      foreignColumns: [
        weComCustomerMappingStates.tenantId,
        weComCustomerMappingStates.institutionId,
        weComCustomerMappingStates.customerId,
        weComCustomerMappingStates.id,
      ],
    }),
    activeOperationUniqueIdx: uniqueIndex(
      'wecom_customer_broadcast_recipient_bindings_active_operation_unique_idx',
    ).on(
      table.tenantId,
      table.institutionId,
      table.customerId,
      table.operationRef,
    ).where(sql`${table.status} = 'active'`),
    scopeBindingRefUnique: unique(
      'wecom_customer_broadcast_recipient_bindings_scope_ref_unique',
    ).on(table.tenantId, table.institutionId, table.recipientBindingRef),
    scopeStatusIdx: index(
      'wecom_customer_broadcast_recipient_bindings_scope_status_idx',
    ).on(table.tenantId, table.institutionId, table.customerId, table.status),
    operationIdIdx: index(
      'wecom_customer_broadcast_recipient_bindings_operation_id_idx',
    ).on(table.operationId),
    mappingIdIdx: index(
      'wecom_customer_broadcast_recipient_bindings_mapping_id_idx',
    ).on(table.mappingId),
    digestLengthCheck: check(
      'wecom_customer_broadcast_recipient_bindings_digest_length_check',
      sql`length(${table.recipientBindingDigest}) = 64 AND ${table.recipientBindingDigest} ~ '^[0-9a-f]{64}$'`,
    ),
    versionPositiveCheck: check(
      'wecom_customer_broadcast_recipient_bindings_version_positive_check',
      sql`${table.recipientBindingVersion} > 0`,
    ),
    referenceCheck: check(
      'wecom_customer_broadcast_recipient_bindings_reference_check',
      sql`length(trim(${table.recipientBindingRef})) > 0 AND length(trim(${table.opaqueHandleRef})) > 0`,
    ),
    statusShapeCheck: check(
      'wecom_customer_broadcast_recipient_bindings_status_shape_check',
      sql`(${table.status} = 'active' AND ${table.revokedAt} IS NULL) OR (${table.status} IN ('revoked', 'stale') AND ${table.revokedAt} IS NOT NULL AND ${table.revokedAt} >= ${table.createdAt})`,
    ),
  }),
);

export const appointments = pgTable(
  'appointments',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    customerDisplayName: varchar('customer_display_name', { length: 120 }).notNull(),
    project: varchar('project', { length: 160 }).notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    consultantUserId: varchar('consultant_user_id', { length: 96 }).notNull(),
    status: appointmentStatusEnum('status').notNull(),
    note: text('note').notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('appointments_tenant_id_id_unique').on(table.tenantId, table.id),
    customerFk: foreignKey({
      name: 'appointments_tenant_customer_fk',
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
    tenantStatusIdx: index('appointments_tenant_status_idx').on(table.tenantId, table.status),
  }),
);

export const treatmentSummaries = pgTable(
  'treatment_summaries',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    appointmentId: varchar('appointment_id', { length: 64 }),
    treatmentDate: timestamp('treatment_date', { withTimezone: true }).notNull(),
    treatmentProject: varchar('treatment_project', { length: 160 }).notNull(),
    treatmentCategory: varchar('treatment_category', { length: 96 }).notNull(),
    treatmentStage: varchar('treatment_stage', { length: 120 }).notNull(),
    recoveryStage: varchar('recovery_stage', { length: 120 }).notNull(),
    riskLevel: followUpRiskLevelEnum('risk_level').notNull(),
    ownerUserId: varchar('owner_user_id', { length: 96 }).notNull(),
    summary: text('summary').notNull(),
    nextCareAction: text('next_care_action').notNull(),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: varchar('voided_by', { length: 96 }),
    voidReasonCode: varchar('void_reason_code', { length: 64 }).$type<TreatmentSummaryVoidReasonCode>(),
    voidReason: varchar('void_reason', { length: 200 }),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('treatment_summaries_tenant_id_id_unique').on(table.tenantId, table.id),
    customerFk: foreignKey({
      name: 'treatment_summaries_tenant_customer_fk',
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
    appointmentFk: foreignKey({
      name: 'treatment_summaries_tenant_appointment_fk',
      columns: [table.tenantId, table.appointmentId],
      foreignColumns: [appointments.tenantId, appointments.id],
    }),
    tenantCustomerDateIdx: index('treatment_summaries_tenant_customer_date_idx').on(
      table.tenantId,
      table.customerId,
      table.treatmentDate,
    ),
    tenantRiskDateIdx: index('treatment_summaries_tenant_risk_date_idx').on(
      table.tenantId,
      table.riskLevel,
      table.treatmentDate,
    ),
    tenantAppointmentIdx: index('treatment_summaries_tenant_appointment_idx').on(
      table.tenantId,
      table.appointmentId,
    ),
    tenantVoidedDateIdx: index('treatment_summaries_tenant_voided_date_idx').on(
      table.tenantId,
      table.voidedAt,
      table.treatmentDate,
    ),
  }),
);

export const followUpTasks = pgTable(
  'follow_up_tasks',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    customerDisplayName: varchar('customer_display_name', { length: 120 }).notNull(),
    journeyId: varchar('journey_id', { length: 96 }).notNull(),
    stage: varchar('stage', { length: 120 }).notNull(),
    status: followUpStatusEnum('status').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    suggestedAction: text('suggested_action').notNull(),
    riskLevel: followUpRiskLevelEnum('risk_level').notNull(),
    sourceTreatmentSummaryId: varchar('source_treatment_summary_id', { length: 64 }),
    sourceSuggestionKey: varchar('source_suggestion_key', { length: 180 }),
    updatedBy: varchar('updated_by', { length: 96 }),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdUnique: unique('follow_up_tasks_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    customerFk: foreignKey({
      name: 'follow_up_tasks_tenant_customer_fk',
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
    sourceTreatmentSummaryFk: foreignKey({
      name: 'follow_up_tasks_tenant_source_treatment_summary_fk',
      columns: [table.tenantId, table.sourceTreatmentSummaryId],
      foreignColumns: [treatmentSummaries.tenantId, treatmentSummaries.id],
    }),
    tenantStatusIdx: index('follow_up_tasks_tenant_status_idx').on(table.tenantId, table.status),
    tenantSourceTreatmentSummaryIdx: index(
      'follow_up_tasks_tenant_source_treatment_summary_idx',
    ).on(table.tenantId, table.sourceTreatmentSummaryId),
    activeSourceUniqueIdx: uniqueIndex('follow_up_tasks_active_source_unique_idx')
      .on(table.tenantId, table.sourceTreatmentSummaryId, table.sourceSuggestionKey)
      .where(
        sql`${table.sourceTreatmentSummaryId} is not null and ${table.sourceSuggestionKey} is not null and ${table.status} not in ('completed','cancelled')`,
      ),
  }),
);

export const followUpPathEnrollments = pgTable(
  'follow_up_path_enrollments',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    treatmentSummaryId: varchar('treatment_summary_id', { length: 64 }),
    sourceType: varchar('source_type', { length: 40 })
      .$type<'treatment_summary' | 'manual_treatment_event'>()
      .notNull(),
    sourceId: varchar('source_id', { length: 64 }).notNull(),
    templateKey: varchar('template_key', { length: 64 }).notNull(),
    templateVersion: varchar('template_version', { length: 64 }).notNull().default('v0.6-static'),
    templateSnapshotJson: jsonb('template_snapshot_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: varchar('status', { length: 32 })
      .$type<'active' | 'completed' | 'cancelled'>()
      .notNull()
      .default('active'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    safeReasonCode: varchar('safe_reason_code', { length: 96 }).notNull(),
    metadataJson: jsonb('metadata_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('follow_up_path_enrollments_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    customerFk: foreignKey({
      name: 'follow_up_path_enrollments_tenant_customer_fk',
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
    treatmentSummaryFk: foreignKey({
      name: 'follow_up_path_enrollments_tenant_treatment_summary_fk',
      columns: [table.tenantId, table.treatmentSummaryId],
      foreignColumns: [treatmentSummaries.tenantId, treatmentSummaries.id],
    }),
    activeSourceTemplateUniqueIdx: uniqueIndex(
      'follow_up_path_enrollments_active_source_template_unique_idx',
    )
      .on(table.tenantId, table.sourceType, table.sourceId, table.templateKey)
      .where(sql`${table.status} = 'active'`),
    tenantStatusIdx: index('follow_up_path_enrollments_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    tenantInstitutionStatusIdx: index(
      'follow_up_path_enrollments_tenant_institution_status_idx',
    ).on(table.tenantId, table.institutionId, table.status),
    tenantCustomerIdx: index('follow_up_path_enrollments_tenant_customer_idx').on(
      table.tenantId,
      table.customerId,
    ),
  }),
);

export const followUpPathStages = pgTable(
  'follow_up_path_stages',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    enrollmentId: varchar('enrollment_id', { length: 64 }).notNull(),
    nodeKey: varchar('node_key', { length: 96 }).notNull(),
    stageKey: varchar('stage_key', { length: 64 }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    status: followUpStatusEnum('status').notNull().default('scheduled'),
    followUpTaskId: varchar('follow_up_task_id', { length: 64 }),
    handlerRole: varchar('handler_role', { length: 64 }).notNull(),
    riskLevel: followUpRiskLevelEnum('risk_level').notNull(),
    safeMessage: varchar('safe_message', { length: 240 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdUnique: unique('follow_up_path_stages_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    enrollmentFk: foreignKey({
      name: 'follow_up_path_stages_tenant_enrollment_fk',
      columns: [table.tenantId, table.enrollmentId],
      foreignColumns: [followUpPathEnrollments.tenantId, followUpPathEnrollments.id],
    }),
    followUpTaskFk: foreignKey({
      name: 'follow_up_path_stages_tenant_follow_up_task_fk',
      columns: [table.tenantId, table.followUpTaskId],
      foreignColumns: [followUpTasks.tenantId, followUpTasks.id],
    }),
    enrollmentNodeUnique: unique('follow_up_path_stages_enrollment_node_unique').on(
      table.tenantId,
      table.enrollmentId,
      table.nodeKey,
    ),
    tenantEnrollmentIdx: index('follow_up_path_stages_tenant_enrollment_idx').on(
      table.tenantId,
      table.enrollmentId,
    ),
    tenantDueStatusIdx: index('follow_up_path_stages_tenant_due_status_idx').on(
      table.tenantId,
      table.status,
      table.dueAt,
    ),
  }),
);

export const followUpMessageTemplates = pgTable(
  'follow_up_message_templates',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }).references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    templateKey: varchar('template_key', { length: 96 }).notNull(),
    templateName: varchar('template_name', { length: 160 }).notNull(),
    templateType: varchar('template_type', { length: 40 })
      .$type<'post_care' | 'revisit' | 'risk_check' | 'manual'>()
      .notNull(),
    applicableTemplateKey: varchar('applicable_template_key', { length: 64 }),
    applicableNodeKey: varchar('applicable_node_key', { length: 96 }),
    channelType: varchar('channel_type', { length: 32 }).$type<'manual'>().notNull().default('manual'),
    contentTemplate: text('content_template').notNull(),
    variablesJson: jsonb('variables_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: varchar('status', { length: 32 }).$type<'active' | 'archived'>().notNull().default('active'),
    requiresHumanApproval: boolean('requires_human_approval').notNull().default(true),
    forbidAutoSend: boolean('forbid_auto_send').notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    tenantInstitutionIdx: index('follow_up_message_templates_tenant_institution_idx').on(
      table.tenantId,
      table.institutionId,
    ),
    templateKeyIdx: index('follow_up_message_templates_template_key_idx').on(table.templateKey),
    statusIdx: index('follow_up_message_templates_status_idx').on(table.status),
    applicableIdx: index('follow_up_message_templates_applicable_idx').on(
      table.applicableTemplateKey,
      table.applicableNodeKey,
    ),
  }),
);

export const followUpMessageDrafts = pgTable(
  'follow_up_message_drafts',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    followUpTaskId: varchar('follow_up_task_id', { length: 64 }).notNull(),
    enrollmentId: varchar('enrollment_id', { length: 64 }),
    stageId: varchar('stage_id', { length: 64 }),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    templateId: varchar('template_id', { length: 64 }),
    channelType: varchar('channel_type', { length: 32 }).$type<'manual'>().notNull().default('manual'),
    status: followUpMessageDraftStatusEnum('status').notNull().default('draft'),
    draftContent: text('draft_content').notNull(),
    editedContent: text('edited_content'),
    safePreview: varchar('safe_preview', { length: 240 }).notNull(),
    approvedBy: varchar('approved_by', { length: 96 }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedBy: varchar('rejected_by', { length: 96 }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    markedSentBy: varchar('marked_sent_by', { length: 96 }),
    markedSentAt: timestamp('marked_sent_at', { withTimezone: true }),
    safeReasonCode: varchar('safe_reason_code', { length: 96 }).notNull(),
    metadataJson: jsonb('metadata_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('follow_up_message_drafts_tenant_id_id_unique').on(
      table.tenantId,
      table.id,
    ),
    scopeCustomerIdUnique: unique('follow_up_message_drafts_scope_customer_id_unique').on(
      table.tenantId,
      table.institutionId,
      table.customerId,
      table.id,
    ),
    followUpTaskFk: foreignKey({
      name: 'follow_up_message_drafts_tenant_follow_up_task_fk',
      columns: [table.tenantId, table.followUpTaskId],
      foreignColumns: [followUpTasks.tenantId, followUpTasks.id],
    }),
    customerFk: foreignKey({
      name: 'follow_up_message_drafts_tenant_customer_fk',
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
    enrollmentFk: foreignKey({
      name: 'follow_up_message_drafts_tenant_enrollment_fk',
      columns: [table.tenantId, table.enrollmentId],
      foreignColumns: [followUpPathEnrollments.tenantId, followUpPathEnrollments.id],
    }),
    stageFk: foreignKey({
      name: 'follow_up_message_drafts_tenant_stage_fk',
      columns: [table.tenantId, table.stageId],
      foreignColumns: [followUpPathStages.tenantId, followUpPathStages.id],
    }),
    templateFk: foreignKey({
      name: 'follow_up_message_drafts_template_fk',
      columns: [table.templateId],
      foreignColumns: [followUpMessageTemplates.id],
    }),
    tenantInstitutionIdx: index('follow_up_message_drafts_tenant_institution_idx').on(
      table.tenantId,
      table.institutionId,
    ),
    followUpTaskIdx: index('follow_up_message_drafts_follow_up_task_idx').on(
      table.followUpTaskId,
    ),
    customerIdx: index('follow_up_message_drafts_customer_idx').on(table.customerId),
    statusIdx: index('follow_up_message_drafts_status_idx').on(table.status),
    createdAtIdx: index('follow_up_message_drafts_created_at_idx').on(table.createdAt),
  }),
);

export const followUpCustomerTimelineEvents = pgTable(
  'follow_up_customer_timeline_events',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    institutionId: varchar('institution_id', { length: 64 }),
    customerId: varchar('customer_id', { length: 64 }).notNull(),
    sourceType: followUpCustomerTimelineSourceTypeEnum('source_type').notNull(),
    sourceId: varchar('source_id', { length: 96 }).notNull(),
    eventType: followUpCustomerTimelineEventTypeEnum('event_type').notNull(),
    eventTitle: varchar('event_title', { length: 160 }).notNull(),
    safeSummary: varchar('safe_summary', { length: 240 }).notNull(),
    riskLevel: followUpRiskLevelEnum('risk_level'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    safeActorRole: varchar('safe_actor_role', { length: 64 }),
    safeReasonCode: varchar('safe_reason_code', { length: 96 }).notNull(),
    metadataJson: jsonb('metadata_json')
      .$type<JsonRecord>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    ...timestamps,
  },
  (table) => ({
    customerFk: foreignKey({
      name: 'follow_up_customer_timeline_events_tenant_customer_fk',
      columns: [table.tenantId, table.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }),
    tenantInstitutionCustomerOccurredIdx: index(
      'follow_up_customer_timeline_events_tenant_institution_customer_occurred_idx',
    ).on(table.tenantId, table.institutionId, table.customerId, table.occurredAt),
    tenantSourceEventIdx: index('follow_up_customer_timeline_events_tenant_source_event_idx').on(
      table.tenantId,
      table.sourceType,
      table.sourceId,
      table.eventType,
    ),
    tenantEventTypeOccurredIdx: index('follow_up_customer_timeline_events_tenant_event_type_occurred_idx').on(
      table.tenantId,
      table.eventType,
      table.occurredAt,
    ),
    sourceEventUniqueIdx: uniqueIndex('follow_up_customer_timeline_events_source_event_unique_idx').on(
      table.tenantId,
      table.sourceType,
      table.sourceId,
      table.eventType,
    ),
  }),
);

export const auditEvents = pgTable(
  'audit_events',
  {
    eventId: varchar('event_id', { length: 96 }).primaryKey(),
    actorId: varchar('actor_id', { length: 96 }).notNull(),
    actorRole: authRoleEnum('actor_role').notNull(),
    tenantId: varchar('tenant_id', { length: 64 }),
    institutionId: varchar('institution_id', { length: 64 }),
    institutionAttribution: auditInstitutionAttributionEnum('institution_attribution'),
    scope: varchar('scope', { length: 24 }).$type<AccessContext['scope']>().notNull(),
    resource: varchar('resource', { length: 64 }).$type<ProtectedResource>().notNull(),
    resourceId: varchar('resource_id', { length: 96 }),
    action: varchar('action', { length: 64 }).$type<ProtectedAction>().notNull(),
    result: auditResultEnum('result').notNull(),
    reason: varchar('reason', { length: 80 }).$type<AuditReason>().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    source: varchar('source', { length: 48 }).$type<AccessContext['source']>().notNull(),
  },
  (table) => ({
    tenantOccurredIdx: index('audit_events_tenant_occurred_idx').on(
      table.tenantId,
      table.occurredAt,
    ),
    actorOccurredIdx: index('audit_events_actor_occurred_idx').on(table.actorId, table.occurredAt),
    tenantResourceIdOccurredIdx: index('audit_events_tenant_resource_id_occurred_idx').on(
      table.tenantId,
      table.resource,
      table.resourceId,
      table.occurredAt,
    ),
  }),
);

export const homepageBrandConfigs = pgTable(
  'homepage_brand_configs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    status: homepageBrandConfigStatusEnum('status').notNull().default('draft'),
    draftConfigJson: jsonb('draft_config_json').$type<HomepageBrandConfig>().notNull(),
    publishedVersionId: varchar('published_version_id', { length: 64 }),
    draftUpdatedBy: varchar('draft_updated_by', { length: 96 }).notNull(),
    publishedBy: varchar('published_by', { length: 96 }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    statusUpdatedIdx: index('homepage_brand_configs_status_updated_idx').on(
      table.status,
      table.updatedAt,
    ),
  }),
);

export const homepageBrandConfigVersions = pgTable(
  'homepage_brand_config_versions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    configId: varchar('config_id', { length: 64 })
      .notNull()
      .references(() => homepageBrandConfigs.id),
    versionNumber: integer('version_number').notNull(),
    configJson: jsonb('config_json').$type<HomepageBrandConfig>().notNull(),
    summary: varchar('summary', { length: 240 }).notNull(),
    publishedBy: varchar('published_by', { length: 96 }).notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => ({
    configVersionUnique: unique('homepage_brand_config_versions_config_version_unique').on(
      table.configId,
      table.versionNumber,
    ),
    configPublishedIdx: index('homepage_brand_config_versions_config_published_idx').on(
      table.configId,
      table.publishedAt,
    ),
  }),
);

export const homepageBrandAssets = pgTable(
  'homepage_brand_assets',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    kind: homepageBrandAssetKindEnum('kind').notNull(),
    originalFilename: varchar('original_filename', { length: 180 }).notNull(),
    mimeType: varchar('mime_type', { length: 96 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: varchar('storage_key', { length: 240 }).notNull(),
    publicUrl: varchar('public_url', { length: 240 }).notNull(),
    checksumSha256: varchar('checksum_sha256', { length: 64 }).notNull(),
    uploadedBy: varchar('uploaded_by', { length: 96 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    kindCreatedIdx: index('homepage_brand_assets_kind_created_idx').on(table.kind, table.createdAt),
    storageKeyUnique: unique('homepage_brand_assets_storage_key_unique').on(table.storageKey),
    checksumIdx: index('homepage_brand_assets_checksum_idx').on(table.checksumSha256),
  }),
);

export const homepageBrandAuditLogs = pgTable(
  'homepage_brand_audit_logs',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    action: homepageBrandAuditActionEnum('action').notNull(),
    configId: varchar('config_id', { length: 64 }).references(() => homepageBrandConfigs.id),
    versionId: varchar('version_id', { length: 64 }).references(() => homepageBrandConfigVersions.id),
    assetId: varchar('asset_id', { length: 64 }).references(() => homepageBrandAssets.id),
    actorId: varchar('actor_id', { length: 96 }).notNull(),
    summary: varchar('summary', { length: 240 }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actionCreatedIdx: index('homepage_brand_audit_logs_action_created_idx').on(
      table.action,
      table.createdAt,
    ),
    configCreatedIdx: index('homepage_brand_audit_logs_config_created_idx').on(
      table.configId,
      table.createdAt,
    ),
    actorCreatedIdx: index('homepage_brand_audit_logs_actor_created_idx').on(
      table.actorId,
      table.createdAt,
    ),
  }),
);

export const analyticsFormalSourceKindEnum = pgEnum(
  'analytics_formal_source_kind',
  [
    'approved_import_manifest',
    'approved_integration_registration',
  ],
);

export const analyticsConsumptionEventFamilyEnum = pgEnum(
  'analytics_consumption_event_family',
  ['payment', 'refund'],
);

export const analyticsConsumptionEventTypeEnum = pgEnum(
  'analytics_consumption_event_type',
  [
    'payment_succeeded',
    'payment_pending',
    'payment_failed',
    'payment_cancelled',
    'refund_confirmed',
    'refund_pending',
    'refund_failed',
    'refund_cancelled',
  ],
);

export const analyticsCustomerAttributionStatusEnum = pgEnum(
  'analytics_customer_attribution_status',
  ['matched', 'unmatched', 'pending_review'],
);

export const analyticsProjectAttributionStatusEnum = pgEnum(
  'analytics_project_attribution_status',
  ['mapped', 'unmapped', 'pending_review'],
);

export const analyticsRefundLinkStatusEnum = pgEnum(
  'analytics_refund_link_status',
  ['not_applicable', 'linked', 'orphan_verified'],
);

export const analyticsFormalSources = pgTable(
  'analytics_formal_sources',
  {
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    id: varchar('id', { length: 64 }).notNull(),
    sourceLabel: varchar('source_label', { length: 160 }).notNull(),
    sourceKind: analyticsFormalSourceKindEnum('source_kind').notNull(),
    provenanceReferenceDigest: varchar(
      'provenance_reference_digest',
      { length: 64 },
    ).notNull(),
    approvedBy: varchar('approved_by', { length: 96 }).notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    primaryKey: primaryKey({
      name: 'analytics_sources_pk',
      columns: [table.tenantId, table.institutionId, table.id],
    }),
    scopeFk: foreignKey({
      name: 'analytics_sources_scope_fk',
      columns: [table.tenantId, table.institutionId],
      foreignColumns: [institutionScopes.tenantId, institutionScopes.institutionId],
    }),
    scopeIdx: index('analytics_sources_scope_idx').on(
      table.tenantId,
      table.institutionId,
    ),
    labelCheck: check(
      'analytics_sources_label_check',
      sql`length(trim(${table.sourceLabel})) > 0`,
    ),
    digestCheck: check(
      'analytics_sources_digest_check',
      sql`length(${table.provenanceReferenceDigest}) = 64`,
    ),
  }),
);

export const analyticsFormalIngestionBatches = pgTable(
  'analytics_formal_ingestion_batches',
  {
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    sourceId: varchar('source_id', { length: 64 }).notNull(),
    batchOrConnectionRef: varchar('batch_or_connection_ref', { length: 256 }).notNull(),
    provenanceReferenceDigest: varchar(
      'provenance_reference_digest',
      { length: 64 },
    ).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    approvedBy: varchar('approved_by', { length: 96 }).notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    primaryKey: primaryKey({
      name: 'analytics_batches_pk',
      columns: [
        table.tenantId,
        table.institutionId,
        table.sourceId,
        table.batchOrConnectionRef,
      ],
    }),
    sourceFk: foreignKey({
      name: 'analytics_batches_source_fk',
      columns: [table.tenantId, table.institutionId, table.sourceId],
      foreignColumns: [
        analyticsFormalSources.tenantId,
        analyticsFormalSources.institutionId,
        analyticsFormalSources.id,
      ],
    }),
    scopeReceivedIdx: index('analytics_batches_scope_received_idx').on(
      table.tenantId,
      table.institutionId,
      table.receivedAt,
    ),
    referenceCheck: check(
      'analytics_batches_reference_check',
      sql`length(trim(${table.batchOrConnectionRef})) > 0`,
    ),
    digestCheck: check(
      'analytics_batches_digest_check',
      sql`length(${table.provenanceReferenceDigest}) = 64`,
    ),
  }),
);

export const analyticsConsumptionFacts = pgTable(
  'analytics_consumption_facts',
  {
    tenantId: varchar('tenant_id', { length: 64 }).notNull(),
    institutionId: varchar('institution_id', { length: 64 }).notNull(),
    sourceId: varchar('source_id', { length: 64 }).notNull(),
    batchOrConnectionRef: varchar('batch_or_connection_ref', { length: 256 }).notNull(),
    sourceRecordRef: varchar('source_record_ref', { length: 256 }).notNull(),
    eventFamily: analyticsConsumptionEventFamilyEnum('event_family').notNull(),
    sourceRevision: varchar('source_revision', { length: 256 }).notNull(),
    supersedesSourceRevision: varchar('supersedes_source_revision', { length: 256 }),
    eventType: analyticsConsumptionEventTypeEnum('event_type').notNull(),
    eventAt: timestamp('event_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    stableConsumptionRecordRef: varchar(
      'stable_consumption_record_ref',
      { length: 256 },
    ),
    customerAttributionStatus: analyticsCustomerAttributionStatusEnum(
      'customer_attribution_status',
    ).notNull(),
    customerId: varchar('customer_id', { length: 64 }),
    customerCandidateReference: varchar('customer_candidate_reference', { length: 256 }),
    projectAttributionStatus: analyticsProjectAttributionStatusEnum(
      'project_attribution_status',
    ).notNull(),
    hisDirectoryVersion: varchar('his_directory_version', { length: 256 }),
    canonicalProjectId: varchar('canonical_project_id', { length: 64 }),
    projectCandidateReference: varchar('project_candidate_reference', { length: 256 }),
    refundLinkStatus: analyticsRefundLinkStatusEnum('refund_link_status').notNull(),
    recordedBy: varchar('recorded_by', { length: 96 }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    primaryKey: primaryKey({
      name: 'analytics_facts_pk',
      columns: [
        table.tenantId,
        table.institutionId,
        table.sourceId,
        table.sourceRecordRef,
        table.eventType,
        table.sourceRevision,
      ],
    }),
    groupRevisionUnique: unique('analytics_facts_group_revision_unique').on(
      table.tenantId,
      table.institutionId,
      table.sourceId,
      table.sourceRecordRef,
      table.eventFamily,
      table.sourceRevision,
    ),
    batchFk: foreignKey({
      name: 'analytics_facts_batch_fk',
      columns: [
        table.tenantId,
        table.institutionId,
        table.sourceId,
        table.batchOrConnectionRef,
      ],
      foreignColumns: [
        analyticsFormalIngestionBatches.tenantId,
        analyticsFormalIngestionBatches.institutionId,
        analyticsFormalIngestionBatches.sourceId,
        analyticsFormalIngestionBatches.batchOrConnectionRef,
      ],
    }),
    customerFk: foreignKey({
      name: 'analytics_facts_customer_fk',
      columns: [table.tenantId, table.institutionId, table.customerId],
      foreignColumns: [customers.tenantId, customers.institutionId, customers.id],
    }),
    periodIdx: index('analytics_facts_period_idx').on(
      table.tenantId,
      table.institutionId,
      table.eventAt,
      table.eventType,
    ),
    chainIdx: index('analytics_facts_chain_idx').on(
      table.tenantId,
      table.institutionId,
      table.sourceId,
      table.sourceRecordRef,
      table.eventFamily,
    ),
    stableIdx: index('analytics_facts_stable_idx').on(
      table.tenantId,
      table.institutionId,
      table.sourceId,
      table.stableConsumptionRecordRef,
    ),
    requiredRefCheck: check(
      'analytics_facts_required_ref_check',
      sql`length(trim(${table.sourceRecordRef})) > 0 AND length(trim(${table.sourceRevision})) > 0 AND length(trim(${table.recordedBy})) > 0`,
    ),
    correctionCheck: check(
      'analytics_facts_correction_check',
      sql`${table.supersedesSourceRevision} IS NULL OR (length(trim(${table.supersedesSourceRevision})) > 0 AND ${table.supersedesSourceRevision} <> ${table.sourceRevision})`,
    ),
    eventFamilyCheck: check(
      'analytics_facts_event_family_check',
      sql`(${table.eventFamily} = 'payment' AND ${table.eventType} IN ('payment_succeeded', 'payment_pending', 'payment_failed', 'payment_cancelled')) OR (${table.eventFamily} = 'refund' AND ${table.eventType} IN ('refund_confirmed', 'refund_pending', 'refund_failed', 'refund_cancelled'))`,
    ),
    amountCheck: check(
      'analytics_facts_amount_check',
      sql`${table.amountMinor} BETWEEN 1 AND 9007199254740991`,
    ),
    currencyCheck: check(
      'analytics_facts_currency_check',
      sql`length(${table.currency}) = 3 AND ${table.currency} = upper(${table.currency}) AND ${table.currency} ~ '^[A-Z]{3}$'`,
    ),
    stableRefCheck: check(
      'analytics_facts_stable_ref_check',
      sql`${table.stableConsumptionRecordRef} IS NULL OR length(trim(${table.stableConsumptionRecordRef})) > 0`,
    ),
    customerAttributionCheck: check(
      'analytics_facts_customer_attribution_check',
      sql`(${table.customerAttributionStatus} = 'matched' AND ${table.customerId} IS NOT NULL AND length(trim(${table.customerId})) > 0 AND ${table.customerCandidateReference} IS NULL) OR (${table.customerAttributionStatus} = 'unmatched' AND ${table.customerId} IS NULL AND ${table.customerCandidateReference} IS NULL) OR (${table.customerAttributionStatus} = 'pending_review' AND ${table.customerId} IS NULL AND ${table.customerCandidateReference} ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,255}$')`,
    ),
    projectAttributionCheck: check(
      'analytics_facts_project_attribution_check',
      sql`(${table.projectAttributionStatus} = 'mapped' AND ${table.hisDirectoryVersion} IS NOT NULL AND length(trim(${table.hisDirectoryVersion})) > 0 AND ${table.canonicalProjectId} IS NOT NULL AND length(trim(${table.canonicalProjectId})) > 0 AND ${table.projectCandidateReference} IS NULL) OR (${table.projectAttributionStatus} = 'unmapped' AND ${table.hisDirectoryVersion} IS NULL AND ${table.canonicalProjectId} IS NULL AND ${table.projectCandidateReference} IS NULL) OR (${table.projectAttributionStatus} = 'pending_review' AND ${table.hisDirectoryVersion} IS NULL AND ${table.canonicalProjectId} IS NULL AND ${table.projectCandidateReference} ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,255}$')`,
    ),
    refundLinkCheck: check(
      'analytics_facts_refund_link_check',
      sql`(${table.eventFamily} = 'payment' AND ${table.refundLinkStatus} = 'not_applicable') OR (${table.eventFamily} = 'refund' AND ${table.refundLinkStatus} IN ('linked', 'orphan_verified'))`,
    ),
  }),
);
