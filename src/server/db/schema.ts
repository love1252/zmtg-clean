import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

import type { AuditReason } from '@/modules/audit/domain/audit-events';
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

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended']);
export const authRoleEnum = pgEnum('auth_role', [
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
  'platform_admin',
  'platform_operator',
  'security_auditor',
]);
export const customerLifecycleEnum = pgEnum('customer_lifecycle', [
  'consulting',
  'scheduled',
  'post_care',
  'repurchase_window',
  'silent_reactivation',
]);
export const customerPriorityEnum = pgEnum('customer_priority', ['high', 'medium', 'observe']);
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
export const auditResultEnum = pgEnum('audit_result', ['allowed', 'denied', 'transitioned']);
export const tenantPlanStatusEnum = pgEnum('tenant_plan_status', ['active', 'retired']);
export const tenantPlanAssignmentStatusEnum = pgEnum('tenant_plan_assignment_status', [
  'active',
  'scheduled',
  'expired',
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
    currentCustomers: integer('current_customers').notNull(),
    currentAppointments: integer('current_appointments').notNull(),
    currentFollowUps: integer('current_follow_ups').notNull(),
    currentAiCalls: integer('current_ai_calls').notNull(),
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

export const tenantMembers = pgTable(
  'tenant_members',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
    userId: varchar('user_id', { length: 96 }).notNull(),
    role: authRoleEnum('role').notNull(),
    displayName: varchar('display_name', { length: 120 }).notNull(),
    ...timestamps,
  },
  (table) => ({
    tenantUserUniqueIdx: uniqueIndex('tenant_members_tenant_user_unique_idx').on(
      table.tenantId,
      table.userId,
    ),
    tenantRoleIdx: index('tenant_members_tenant_role_idx').on(table.tenantId, table.role),
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
    ...timestamps,
  },
  (table) => ({
    tenantIdIdUnique: unique('customers_tenant_id_id_unique').on(table.tenantId, table.id),
    tenantIdx: index('customers_tenant_idx').on(table.tenantId),
    tenantPriorityIdx: index('customers_tenant_priority_idx').on(table.tenantId, table.priority),
  }),
);

export const appointments = pgTable(
  'appointments',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id),
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

export const auditEvents = pgTable(
  'audit_events',
  {
    eventId: varchar('event_id', { length: 96 }).primaryKey(),
    actorId: varchar('actor_id', { length: 96 }).notNull(),
    actorRole: authRoleEnum('actor_role').notNull(),
    tenantId: varchar('tenant_id', { length: 64 }),
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
