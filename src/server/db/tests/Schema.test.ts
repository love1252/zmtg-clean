import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { createDatabaseUrlErrorMessage, type TenantDatabase } from '@/server/db/client';
import { authenticateDemoUser } from '@/modules/auth/server/demo-session';
import {
  demoSeedDatabaseWriteDisabledMessage,
  getDemoSeedAuthUserRecords,
  getDemoCustomerSeedRecords,
  getDemoTenantAuthorizationSnapshotSeedRecords,
  getDemoTenantCommercialRecordSeedRecords,
  getDemoTenantMemberSeedRecords,
  getDemoTenantPlanAssignmentSeedRecords,
  getDemoTenantPlanSeedRecords,
  getDemoTenantPlanVersionSeedRecords,
  getDemoTenantQuotaSnapshotSeedRecords,
  getDemoTenantSeedRecords,
} from '@/server/db/seed-demo-data';
import * as seedDemoData from '@/server/db/seed-demo-data';
import * as schema from '@/server/db/schema';
import {
  appointments,
  authAccountInstitutionBindings,
  authUsers,
  auditEvents,
  customerChannelContactConsents,
  customerChannelFrequencyStates,
  customers,
  followUpTasks,
  hisConnectionCredentialCompensationOperations,
  institutionOperatingContexts,
  institutionOperatingContextVersions,
  institutionScopes,
  institutionChannelDryRunSnapshots,
  tenantMembershipTransitions,
  tenantMembers,
  tenants,
  treatmentSummaries,
  weComCustomerBroadcastRecipientBindings,
  weComCustomerBroadcastTaskProviderAttempts,
  weComCustomerMappingStates,
  weComRealSendProductionAttestations,
  weComRealSendProofControls,
  weComRealSendProofOperations,
} from '@/server/db/schema';

type NamedColumn = { name: string };
type NamedForeignKey = {
  getName(): string;
  reference(): {
    columns: readonly NamedColumn[];
    foreignColumns: readonly NamedColumn[];
    foreignTable?: unknown;
  };
};

function columnNames(columns: readonly NamedColumn[]) {
  return columns.map((column) => column.name);
}

function foreignKeyColumns(foreignKey: NamedForeignKey | undefined) {
  expect(foreignKey).toBeDefined();
  const reference = foreignKey?.reference();

  return {
    columns: columnNames(reference?.columns ?? []),
    foreignColumns: columnNames(reference?.foreignColumns ?? []),
  };
}

function readMigrationSql(fileNameIncludes?: string) {
  const drizzleDir = join(process.cwd(), 'drizzle');
  return readdirSync(drizzleDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .filter((fileName) => !fileNameIncludes || fileName.includes(fileNameIncludes))
    .map((fileName) => readFileSync(join(drizzleDir, fileName), 'utf8'))
    .join('\n')
    .toLowerCase();
}

function tenantCustomerKey(record: { tenantId: string; customerId: string }) {
  return `${record.tenantId}:${record.customerId}`;
}

function getSeedRecords<T>(getterName: string): T[] {
  const getter = (seedDemoData as unknown as Record<string, unknown>)[getterName];

  expect(typeof getter).toBe('function');
  return (getter as () => T[])();
}

function serializeSeedRecords(records: unknown[]) {
  return JSON.stringify(records);
}


const sensitiveDemoSeedPattern =
  /(1[3-9]\d{9}|[1-9]\d{16}[\dXx]|DATABASE_URL|token|secret|password|Bearer\s+|mysql:\/\/|postgres:\/\/|stack trace|SQLSTATE|完整治疗记录|完整病历|咨询对话全文|图片原文|文件原文)/i;

describe('数据库结构', () => {
  it('数据库连接错误提示不泄露连接串', () => {
    expect(createDatabaseUrlErrorMessage()).toBe(
      'DATABASE_URL is required to use tenant persistence',
    );
    expect(createDatabaseUrlErrorMessage()).not.toContain(['postgres', '://'].join(''));
  });

  it('定义租户业务和审计表', () => {
    expect(tenants).toBeDefined();
    expect(tenantMembers).toBeDefined();
    expect(customers).toBeDefined();
    expect(appointments).toBeDefined();
    expect(followUpTasks).toBeDefined();
    expect(auditEvents).toBeDefined();
  });

  it('定义平台租户套餐、套餐分配和配额快照表', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const tenantPlans = schemaModule.tenantPlans;
    const tenantPlanAssignments = schemaModule.tenantPlanAssignments;
    const tenantQuotaSnapshots = schemaModule.tenantQuotaSnapshots;

    expect(tenantPlans).toBeDefined();
    expect(tenantPlanAssignments).toBeDefined();
    expect(tenantQuotaSnapshots).toBeDefined();

    const planColumns = columnNames(getTableConfig(tenantPlans as never).columns);
    const assignmentColumns = columnNames(getTableConfig(tenantPlanAssignments as never).columns);
    const quotaColumns = columnNames(getTableConfig(tenantQuotaSnapshots as never).columns);

    expect(planColumns).toEqual(
      expect.arrayContaining(['id', 'name', 'code', 'description', 'status', 'created_at', 'updated_at']),
    );
    expect(assignmentColumns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'plan_id',
        'status',
        'started_at',
        'expires_at',
        'created_at',
        'updated_at',
      ]),
    );
    expect(quotaColumns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'plan_assignment_id',
        'max_customers',
        'max_appointments',
        'max_follow_ups',
        'max_ai_calls',
        'current_customers',
        'current_appointments',
        'current_follow_ups',
        'current_ai_calls',
        'snapshot_at',
        'created_at',
      ]),
    );
    expect(JSON.stringify({ planColumns, assignmentColumns, quotaColumns })).not.toMatch(
      /phone_number|id_number|medical_record_no|treatment_record|consultation_transcript|request_body|metadata/i,
    );
  });

  it('定义平台套餐商业化闭环基础表、版本状态枚举和安全字段边界', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const tenantPlanVersions = schemaModule.tenantPlanVersions;
    const tenantAuthorizationSnapshots = schemaModule.tenantAuthorizationSnapshots;
    const tenantPlanChangeRecords = schemaModule.tenantPlanChangeRecords;
    const tenantCommercialRecords = schemaModule.tenantCommercialRecords;
    const tenantPlanVersionStatusEnum = schemaModule.tenantPlanVersionStatusEnum as
      | { enumValues?: string[] }
      | undefined;
    const tenantAuthorizationSnapshotStatusEnum =
      schemaModule.tenantAuthorizationSnapshotStatusEnum as { enumValues?: string[] } | undefined;
    const tenantPlanChangeStatusEnum = schemaModule.tenantPlanChangeStatusEnum as
      | { enumValues?: string[] }
      | undefined;
    const tenantCommercialRecordTypeEnum = schemaModule.tenantCommercialRecordTypeEnum as
      | { enumValues?: string[] }
      | undefined;
    const tenantCommercialRecordStatusEnum = schemaModule.tenantCommercialRecordStatusEnum as
      | { enumValues?: string[] }
      | undefined;

    expect(tenantPlanVersions).toBeDefined();
    expect(tenantAuthorizationSnapshots).toBeDefined();
    expect(tenantPlanChangeRecords).toBeDefined();
    expect(tenantCommercialRecords).toBeDefined();
    expect(tenantPlanVersionStatusEnum?.enumValues).toEqual(['draft', 'published', 'retired']);
    expect(tenantAuthorizationSnapshotStatusEnum?.enumValues).toEqual([
      'active',
      'superseded',
      'revoked',
    ]);
    expect(tenantPlanChangeStatusEnum?.enumValues).toEqual([
      'previewed',
      'applied',
      'cancelled',
      'failed',
    ]);
    expect(tenantCommercialRecordTypeEnum?.enumValues).toEqual([
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
    expect(tenantCommercialRecordStatusEnum?.enumValues).toEqual([
      'draft',
      'pending',
      'manual_review',
      'completed',
      'cancelled',
    ]);

    const versionColumns = columnNames(getTableConfig(tenantPlanVersions as never).columns);
    const snapshotColumns = columnNames(
      getTableConfig(tenantAuthorizationSnapshots as never).columns,
    );
    const changeColumns = columnNames(getTableConfig(tenantPlanChangeRecords as never).columns);
    const commercialColumns = columnNames(getTableConfig(tenantCommercialRecords as never).columns);
    const assignmentColumns = columnNames(getTableConfig(schema.tenantPlanAssignments).columns);

    expect(assignmentColumns).toContain('plan_version_id');
    expect(versionColumns).toEqual(
      expect.arrayContaining([
        'id',
        'plan_id',
        'version_code',
        'status',
        'display_name',
        'display_price',
        'price_note',
        'agent_limit',
        'seat_limit',
        'monthly_ai_call_limit',
        'knowledge_storage_gb',
        'connector_entitlements_json',
        'service_entitlements_json',
        'feature_entitlements_json',
        'quota_entitlements_json',
        'change_summary',
        'created_by',
        'updated_by',
        'published_by',
        'published_at',
        'retired_at',
        'created_at',
        'updated_at',
      ]),
    );
    expect(snapshotColumns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'plan_assignment_id',
        'plan_version_id',
        'status',
        'snapshot_json',
        'quota_json',
        'connector_json',
        'service_json',
        'source_change_record_id',
        'generated_by',
        'generated_at',
        'superseded_at',
        'created_at',
      ]),
    );
    expect(changeColumns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'from_plan_version_id',
        'to_plan_version_id',
        'from_snapshot_id',
        'to_snapshot_id',
        'status',
        'diff_json',
        'reason',
        'requested_by',
        'applied_by',
        'applied_at',
        'created_at',
        'updated_at',
      ]),
    );
    expect(commercialColumns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'record_type',
        'status',
        'display_code',
        'display_amount',
        'period_label',
        'related_plan_change_id',
        'note',
        'occurred_at',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at',
      ]),
    );
    expect(
      JSON.stringify({
        versionColumns,
        snapshotColumns,
        changeColumns,
        commercialColumns,
      }),
    ).not.toMatch(
      /card_number|payment_token|webhook_secret|contract_body|invoice_tax_no|client_secret|api_key|encrypted_api_key/i,
    );
  });

  it('定义 HIS 连接配置安全元数据表、状态枚举和租户内索引约束', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const hisConnections = schemaModule.hisConnections;
    const hisConnectionStatusEnum = schemaModule.hisConnectionStatusEnum as
      | { enumValues?: string[] }
      | undefined;
    const hisConnectionHealthStatusEnum = schemaModule.hisConnectionHealthStatusEnum as
      | { enumValues?: string[] }
      | undefined;

    expect(hisConnections).toBeDefined();
    expect(hisConnectionStatusEnum?.enumValues).toEqual([
      'draft',
      'active',
      'paused',
      'revoked',
      'deleted',
      'error',
    ]);
    expect(hisConnectionHealthStatusEnum?.enumValues).toEqual([
      'unknown',
      'healthy',
      'degraded',
      'failed',
    ]);

    const hisConfig = getTableConfig(hisConnections as never);
    const hisColumns = columnNames(hisConfig.columns);
    const hisIndexes = hisConfig.indexes.map((index) => ({
      name: index.config.name,
      unique: index.config.unique,
      columns: columnNames(index.config.columns as NamedColumn[]),
    }));
    const hisColumnsByProperty = hisConnections as unknown as {
      credentialRef: { notNull: boolean };
      revokedAt: { notNull: boolean };
      deletedAt: { notNull: boolean };
    };
    const hisUniqueConstraint = hisConfig.uniqueConstraints.find(
      (constraint) => constraint.getName() === 'his_connections_tenant_id_id_unique',
    );
    const hisTenantFk = hisConfig.foreignKeys.find(
      (foreignKey) => foreignKey.getName() === 'his_connections_tenant_id_tenants_id_fk',
    );
    const hisTenantReference = hisTenantFk?.reference();

    expect(getTableConfig(hisConnections as never).name).toBe('his_connections');
    expect(hisColumns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'connection_name',
        'source_system',
        'vendor_type',
        'system_type',
        'status',
        'credential_ref',
        'health_status',
        'last_checked_at',
        'last_error_code',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at',
        'revoked_at',
        'deleted_at',
      ]),
    );
    expect(hisColumns).toHaveLength(17);
    expect(hisColumnsByProperty.credentialRef.notNull).toBe(false);
    expect(hisColumnsByProperty.revokedAt.notNull).toBe(false);
    expect(hisColumnsByProperty.deletedAt.notNull).toBe(false);

    expect(hisTenantFk).toBeDefined();
    expect(columnNames(hisTenantReference?.columns ?? [])).toEqual(['tenant_id']);
    expect(getTableConfig(hisTenantReference?.foreignTable ?? tenants).name).toBe('tenants');
    expect(columnNames(hisTenantReference?.foreignColumns ?? [])).toEqual(['id']);
    expect(hisUniqueConstraint).toBeDefined();
    expect(columnNames(hisUniqueConstraint?.columns ?? [])).toEqual(['tenant_id', 'id']);
    expect(hisIndexes).toEqual(
      expect.arrayContaining([
        {
          name: 'his_connections_tenant_idx',
          unique: false,
          columns: ['tenant_id'],
        },
        {
          name: 'his_connections_tenant_status_idx',
          unique: false,
          columns: ['tenant_id', 'status'],
        },
        {
          name: 'his_connections_tenant_source_system_idx',
          unique: false,
          columns: ['tenant_id', 'source_system'],
        },
        {
          name: 'his_connections_tenant_deleted_at_idx',
          unique: false,
          columns: ['tenant_id', 'deleted_at'],
        },
        {
          name: 'his_connections_tenant_credential_ref_idx',
          unique: false,
          columns: ['tenant_id', 'credential_ref'],
        },
        {
          name: 'his_connections_tenant_last_checked_at_idx',
          unique: false,
          columns: ['tenant_id', 'last_checked_at'],
        },
        {
          name: 'his_connections_active_name_unique_idx',
          unique: true,
          columns: ['tenant_id', 'connection_name'],
        },
      ]),
    );

    expect(JSON.stringify(hisColumns)).not.toMatch(
      /raw_payload|request_body|response_body|treatment_record|medical_record_body|diagnosis_text|clinical_note|consultation_transcript|image_original|file_original|credential_secret|credential_value|credential_plaintext|token|secret|api_key|oauth|basic_auth|signing_key|private_key|connection_string|database_url|"sql"|"stack"/i,
    );
  });

  it('定义 HIS 连接配置凭证补偿 operation 安全 metadata 表、状态枚举和 operationId 约束', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const compensationOperations = schemaModule.hisConnectionCredentialCompensationOperations;
    const compensationStateEnum = schemaModule.hisConnectionCredentialCompensationStateEnum as
      | { enumValues?: string[] }
      | undefined;
    const compensationOperationTypeEnum = schemaModule.hisConnectionCredentialCompensationOperationTypeEnum as
      | { enumValues?: string[] }
      | undefined;
    const providerFailureCategoryEnum = schemaModule.hisConnectionCredentialProviderFailureCategoryEnum as
      | { enumValues?: string[] }
      | undefined;

    expect(compensationOperations).toBeDefined();
    expect(compensationStateEnum?.enumValues).toEqual([
      'compensation_pending',
      'compensation_running',
      'compensation_succeeded',
      'compensation_failed',
      'manual_review_required',
    ]);
    expect(compensationOperationTypeEnum?.enumValues).toEqual([
      'credential_compensation',
    ]);
    expect(providerFailureCategoryEnum?.enumValues).toEqual([
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
    ]);

    const tableConfig = getTableConfig(compensationOperations as never);
    const columns = columnNames(tableConfig.columns);
    const indexes = tableConfig.indexes.map((index) => ({
      name: index.config.name,
      unique: index.config.unique,
      columns: columnNames(index.config.columns as NamedColumn[]),
    }));
    const columnsByProperty = compensationOperations as unknown as {
      operationId: { notNull: boolean };
      state: { notNull: boolean };
      retryCount: { notNull: boolean };
      manualReviewRequired: { notNull: boolean };
      lastAttemptAt: { notNull: boolean };
      completedAt: { notNull: boolean };
    };

    expect(tableConfig.name).toBe('his_connection_credential_compensation_operations');
    expect(columns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'connection_id',
        'operation_id',
        'operation_type',
        'state',
        'failure_category',
        'retry_count',
        'manual_review_required',
        'created_at',
        'updated_at',
        'last_attempt_at',
        'completed_at',
      ]),
    );
    expect(columns).toHaveLength(13);
    expect(columnsByProperty.operationId.notNull).toBe(true);
    expect(columnsByProperty.state.notNull).toBe(true);
    expect(columnsByProperty.retryCount.notNull).toBe(true);
    expect(columnsByProperty.manualReviewRequired.notNull).toBe(true);
    expect(columnsByProperty.lastAttemptAt.notNull).toBe(false);
    expect(columnsByProperty.completedAt.notNull).toBe(false);
    expect(indexes).toEqual(
      expect.arrayContaining([
        {
          name: 'his_conn_cred_comp_ops_operation_id_unique_idx',
          unique: true,
          columns: ['operation_id'],
        },
        {
          name: 'his_conn_cred_comp_ops_tenant_connection_operation_unique_idx',
          unique: true,
          columns: ['tenant_id', 'connection_id', 'operation_id'],
        },
        {
          name: 'his_conn_cred_comp_ops_tenant_connection_state_idx',
          unique: false,
          columns: ['tenant_id', 'connection_id', 'state'],
        },
        {
          name: 'his_conn_cred_comp_ops_tenant_state_updated_idx',
          unique: false,
          columns: ['tenant_id', 'state', 'updated_at'],
        },
      ]),
    );
    expect(JSON.stringify({ columns, indexes })).not.toMatch(
      /credential_ref|credentialref|idempotency|synthetic_placeholder|provider_path|secret_path|raw_payload|raw_credential|request_body|response_body|token|secret|api_key|oauth|basic_auth|signing_key|private_key|connection_string|database_url|"sql"|"stack"/i,
    );
  });

  it('定义 HIS 连接配置凭证补偿 job queue 安全调度表、状态枚举和 claim 字段', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const compensationJobs = schemaModule.hisConnectionCredentialCompensationJobs;
    const compensationJobStateEnum = schemaModule.hisConnectionCredentialCompensationJobStateEnum as
      | { enumValues?: string[] }
      | undefined;
    const compensationDeadLetterReasonEnum = schemaModule.hisConnectionCredentialCompensationDeadLetterReasonEnum as
      | { enumValues?: string[] }
      | undefined;

    expect(compensationJobs).toBeDefined();
    expect(compensationJobStateEnum?.enumValues).toEqual([
      'queued',
      'claimed',
      'running',
      'succeeded',
      'failed',
      'dead_lettered',
      'manual_review_required',
      'cancelled',
    ]);
    expect(compensationDeadLetterReasonEnum?.enumValues).toEqual([
      'retry_exhausted',
      'claim_conflict',
      'stale_recovery_conflict',
      'provider_result_unknown',
      'audit_write_unavailable',
      'operation_state_conflict',
      'unsafe_payload_summary',
    ]);

    const tableConfig = getTableConfig(compensationJobs as never);
    const columns = columnNames(tableConfig.columns);
    const indexes = tableConfig.indexes.map((index) => ({
      name: index.config.name,
      unique: index.config.unique,
      columns: columnNames(index.config.columns as NamedColumn[]),
    }));
    const columnsByProperty = compensationJobs as unknown as {
      operationId: { notNull: boolean };
      jobState: { notNull: boolean };
      retryCount: { notNull: boolean };
      maxRetryCount: { notNull: boolean };
      nextAttemptAt: { notNull: boolean };
      lockedUntil: { notNull: boolean };
      claimId: { notNull: boolean };
      claimVersion: { notNull: boolean };
      claimedBy: { notNull: boolean };
      claimedAt: { notNull: boolean };
      lastHeartbeatAt: { notNull: boolean };
      deadLetterReason: { notNull: boolean };
      manualReviewRequired: { notNull: boolean };
      completedAt: { notNull: boolean };
    };
    const tenantFk = tableConfig.foreignKeys.find(
      (foreignKey) => foreignKey.getName() === 'his_conn_cred_comp_jobs_tenant_fk',
    );
    const connectionFk = tableConfig.foreignKeys.find(
      (foreignKey) => foreignKey.getName() === 'his_conn_cred_comp_jobs_connection_fk',
    );
    const operationFk = tableConfig.foreignKeys.find(
      (foreignKey) => foreignKey.getName() === 'his_conn_cred_comp_jobs_operation_scope_fk',
    );

    expect(tableConfig.name).toBe('his_connection_credential_compensation_jobs');
    expect(columns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'connection_id',
        'operation_id',
        'operation_type',
        'job_state',
        'failure_category',
        'retry_count',
        'max_retry_count',
        'next_attempt_at',
        'locked_until',
        'claim_id',
        'claim_version',
        'claimed_by',
        'claimed_at',
        'last_heartbeat_at',
        'dead_letter_reason',
        'manual_review_required',
        'created_at',
        'updated_at',
        'completed_at',
      ]),
    );
    expect(columns).toHaveLength(21);
    expect(columnsByProperty.operationId.notNull).toBe(true);
    expect(columnsByProperty.jobState.notNull).toBe(true);
    expect(columnsByProperty.retryCount.notNull).toBe(true);
    expect(columnsByProperty.maxRetryCount.notNull).toBe(true);
    expect(columnsByProperty.nextAttemptAt.notNull).toBe(true);
    expect(columnsByProperty.lockedUntil.notNull).toBe(false);
    expect(columnsByProperty.claimId.notNull).toBe(false);
    expect(columnsByProperty.claimVersion.notNull).toBe(true);
    expect(columnsByProperty.claimedBy.notNull).toBe(false);
    expect(columnsByProperty.claimedAt.notNull).toBe(false);
    expect(columnsByProperty.lastHeartbeatAt.notNull).toBe(false);
    expect(columnsByProperty.deadLetterReason.notNull).toBe(false);
    expect(columnsByProperty.manualReviewRequired.notNull).toBe(true);
    expect(columnsByProperty.completedAt.notNull).toBe(false);
    expect(foreignKeyColumns(tenantFk)).toEqual({
      columns: ['tenant_id'],
      foreignColumns: ['id'],
    });
    expect(foreignKeyColumns(connectionFk)).toEqual({
      columns: ['tenant_id', 'connection_id'],
      foreignColumns: ['tenant_id', 'id'],
    });
    expect(foreignKeyColumns(operationFk)).toEqual({
      columns: ['tenant_id', 'connection_id', 'operation_id'],
      foreignColumns: ['tenant_id', 'connection_id', 'operation_id'],
    });
    expect(indexes).toEqual(
      expect.arrayContaining([
        {
          name: 'his_conn_cred_comp_jobs_operation_id_unique_idx',
          unique: true,
          columns: ['operation_id'],
        },
        {
          name: 'his_conn_cred_comp_jobs_tenant_connection_operation_idx',
          unique: false,
          columns: ['tenant_id', 'connection_id', 'operation_id'],
        },
        {
          name: 'his_conn_cred_comp_jobs_tenant_state_next_attempt_idx',
          unique: false,
          columns: ['tenant_id', 'job_state', 'next_attempt_at'],
        },
        {
          name: 'his_conn_cred_comp_jobs_lock_idx',
          unique: false,
          columns: ['job_state', 'locked_until', 'claim_version'],
        },
      ]),
    );
    expect(JSON.stringify({ columns, indexes })).not.toMatch(
      /credential_ref|credentialref|idempotency_key|idempotencykey|scoped_idempotency|synthetic_placeholder|provider_path|secret_path|raw_payload|raw_credential|request_body|response_body|token|secret|api_key|oauth|basic_auth|signing_key|private_key|connection_string|database_url|"sql"|"stack"/i,
    );
  });

  it('客户表结构只包含脱敏字段', () => {
    expect(customers.maskedPhone).toBeDefined();
    expect(customers.maskedMedicalRecordNo).toBeDefined();
    expect('phoneNumber' in customers).toBe(false);
    expect('idNumber' in customers).toBe(false);
    expect('medicalRecordNo' in customers).toBe(false);
    expect('treatmentRecord' in customers).toBe(false);
    expect('consultationTranscript' in customers).toBe(false);
  });

  it('定义租户内唯一约束和唯一索引', () => {
    const customerUniqueConstraint = getTableConfig(customers).uniqueConstraints.find(
      (constraint) => constraint.getName() === 'customers_tenant_id_id_unique',
    );
    const tenantMemberIndexes = getTableConfig(tenantMembers).indexes.map((index) => ({
      name: index.config.name,
      unique: index.config.unique,
      columns: columnNames(index.config.columns as NamedColumn[]),
    }));

    expect(customerUniqueConstraint).toBeDefined();
    expect(columnNames(customerUniqueConstraint?.columns ?? [])).toEqual(['tenant_id', 'id']);
    expect(tenantMemberIndexes).toEqual(
      expect.arrayContaining([
        {
          name: 'tenant_members_tenant_user_unique_idx',
          unique: true,
          columns: ['tenant_id', 'user_id'],
        },
        {
          name: 'tenant_members_tenant_role_idx',
          unique: false,
          columns: ['tenant_id', 'role'],
        },
      ]),
    );
  });

  it('Membership M7 Enforce 收紧完整 current 并保留条件字段与 immutable transition evidence', () => {
    expect(schema.membershipLifecycleStatusEnum.enumValues).toEqual([
      'active',
      'revoked',
      'deleted',
    ]);
    expect(schema.membershipProvenanceSourceEnum.enumValues).toEqual([
      'formal_onboarding',
      'access_control_command',
      'legacy_calibration',
    ]);
    expect(schema.membershipTransitionTypeEnum.enumValues).toEqual([
      'create',
      'refresh',
      'revoke',
      'reactivate',
      'delete',
      'legacy_calibration',
    ]);

    const memberConfig = getTableConfig(tenantMembers);
    const memberColumns = Object.fromEntries(
      memberConfig.columns.map((column) => [column.name, column]),
    );
    const requiredCurrentColumnNames = [
      'revision',
      'lifecycle_status',
      'current_provenance_source',
      'current_provenance_reason_code',
      'current_provenance_command_id',
      'current_provenance_recorded_at',
    ];
    const conditionalCurrentColumnNames = [
      'current_provenance_actor_id',
      'current_provenance_occurred_at',
      'revoked_at',
      'deleted_at',
    ];

    expect(tenantMembers.id.primary).toBe(true);
    expect(tenantMembers.id.getSQLType()).toBe('varchar(64)');

    for (const columnName of requiredCurrentColumnNames) {
      expect(memberColumns[columnName]).toBeDefined();
      expect(memberColumns[columnName]?.notNull).toBe(true);
      expect(memberColumns[columnName]?.hasDefault).toBe(false);
    }
    for (const columnName of conditionalCurrentColumnNames) {
      expect(memberColumns[columnName]).toBeDefined();
      expect(memberColumns[columnName]?.notNull).toBe(false);
      expect(memberColumns[columnName]?.hasDefault).toBe(false);
    }
    expect(memberColumns.revision?.getSQLType()).toBe('integer');
    expect(memberColumns.lifecycle_status?.getSQLType()).toBe('membership_lifecycle_status');
    expect(memberColumns.current_provenance_source?.getSQLType()).toBe(
      'membership_provenance_source',
    );
    expect(memberColumns.current_provenance_actor_id?.getSQLType()).toBe('varchar(96)');
    expect(memberColumns.current_provenance_reason_code?.getSQLType()).toBe('varchar(96)');
    expect(memberColumns.current_provenance_command_id?.getSQLType()).toBe('varchar(128)');
    expect(memberColumns.current_provenance_occurred_at?.getSQLType()).toBe(
      'timestamp with time zone',
    );
    expect(memberColumns.current_provenance_recorded_at?.getSQLType()).toBe(
      'timestamp with time zone',
    );

    const tenantIdentityUnique = memberConfig.uniqueConstraints.find(
      (constraint) => constraint.getName() === 'tenant_members_tenant_id_id_unique',
    );
    expect(columnNames(tenantIdentityUnique?.columns ?? [])).toEqual(['tenant_id', 'id']);

    const dialect = new PgDialect();
    const envelopeCheck = memberConfig.checks.find(
      (constraint) => constraint.name === 'tenant_members_current_envelope_shape_check',
    );
    expect(envelopeCheck).toBeDefined();
    const envelopeCheckSql = dialect.sqlToQuery(envelopeCheck!.value).sql.toLowerCase();
    for (const requiredFragment of [
      'revision',
      'between 1 and 2147483647',
      'legacy_calibration',
      'legacy_unknown',
      'formal_onboarding',
      'access_control_command',
      'revoked_at',
      'deleted_at',
      'current_provenance_recorded_at',
      'current_provenance_occurred_at',
    ]) {
      expect(envelopeCheckSql).toContain(requiredFragment);
    }
    expect(envelopeCheckSql).toMatch(/revision"? is not null/u);
    expect(envelopeCheckSql).not.toMatch(/revision"? is null/u);
    expect(envelopeCheckSql).toMatch(
      /current_provenance_source"? = 'formal_onboarding'.*revision"? = 1.*lifecycle_status"? = 'active'/su,
    );
    expect(envelopeCheckSql).toMatch(
      /lifecycle_status"? = 'revoked'.*revision"? >= 2/su,
    );
    expect(envelopeCheckSql).toMatch(
      /lifecycle_status"? = 'deleted'.*revision"? >= 2/su,
    );

    const transitionConfig = getTableConfig(tenantMembershipTransitions);
    expect(columnNames(transitionConfig.columns)).toEqual([
      'id',
      'tenant_id',
      'membership_id',
      'command_id',
      'transition_type',
      'source',
      'actor_id',
      'reason_code',
      'from_revision',
      'to_revision',
      'from_lifecycle_status',
      'to_lifecycle_status',
      'from_role',
      'to_role',
      'occurred_at',
      'recorded_at',
    ]);
    expect(tenantMembershipTransitions.id.primary).toBe(true);
    expect(tenantMembershipTransitions.id.getSQLType()).toBe('varchar(96)');
    expect(tenantMembershipTransitions.commandId.getSQLType()).toBe('varchar(128)');
    expect(tenantMembershipTransitions.fromRevision.notNull).toBe(false);
    expect(tenantMembershipTransitions.toRevision.notNull).toBe(true);
    expect(tenantMembershipTransitions.actorId.notNull).toBe(false);
    expect(tenantMembershipTransitions.occurredAt.notNull).toBe(false);
    expect(tenantMembershipTransitions.recordedAt.notNull).toBe(true);
    const transitionColumnShape = Object.fromEntries(
      transitionConfig.columns.map((column) => [
        column.name,
        {
          type: column.getSQLType(),
          notNull: column.notNull,
          hasDefault: column.hasDefault,
        },
      ]),
    );
    expect(transitionColumnShape).toEqual({
      id: { type: 'varchar(96)', notNull: true, hasDefault: false },
      tenant_id: { type: 'varchar(64)', notNull: true, hasDefault: false },
      membership_id: { type: 'varchar(64)', notNull: true, hasDefault: false },
      command_id: { type: 'varchar(128)', notNull: true, hasDefault: false },
      transition_type: {
        type: 'membership_transition_type',
        notNull: true,
        hasDefault: false,
      },
      source: {
        type: 'membership_provenance_source',
        notNull: true,
        hasDefault: false,
      },
      actor_id: { type: 'varchar(96)', notNull: false, hasDefault: false },
      reason_code: { type: 'varchar(96)', notNull: true, hasDefault: false },
      from_revision: { type: 'integer', notNull: false, hasDefault: false },
      to_revision: { type: 'integer', notNull: true, hasDefault: false },
      from_lifecycle_status: {
        type: 'membership_lifecycle_status',
        notNull: false,
        hasDefault: false,
      },
      to_lifecycle_status: {
        type: 'membership_lifecycle_status',
        notNull: true,
        hasDefault: false,
      },
      from_role: { type: 'auth_role', notNull: false, hasDefault: false },
      to_role: { type: 'auth_role', notNull: true, hasDefault: false },
      occurred_at: {
        type: 'timestamp with time zone',
        notNull: false,
        hasDefault: false,
      },
      recorded_at: {
        type: 'timestamp with time zone',
        notNull: true,
        hasDefault: false,
      },
    });

    const membershipFk = transitionConfig.foreignKeys.find(
      (foreignKey) =>
        foreignKey.getName() === 'tenant_membership_transitions_tenant_membership_fk',
    );
    expect(foreignKeyColumns(membershipFk)).toEqual({
      columns: ['tenant_id', 'membership_id'],
      foreignColumns: ['tenant_id', 'id'],
    });
    expect(membershipFk?.reference().foreignTable).toBe(tenantMembers);
    expect((membershipFk as unknown as { onUpdate?: string }).onUpdate).toBe('no action');
    expect((membershipFk as unknown as { onDelete?: string }).onDelete).toBe('no action');
    expect(transitionConfig.foreignKeys.map((foreignKey) => foreignKey.getName())).toEqual([
      'tenant_membership_transitions_tenant_membership_fk',
    ]);

    const transitionUniques = transitionConfig.uniqueConstraints.map((constraint) => ({
      name: constraint.getName(),
      columns: columnNames(constraint.columns),
    }));
    expect(transitionUniques).toEqual([
      {
        name: 'tenant_membership_transitions_tenant_command_unique',
        columns: ['tenant_id', 'command_id'],
      },
      {
        name: 'tenant_membership_transitions_membership_revision_unique',
        columns: ['membership_id', 'to_revision'],
      },
    ]);
    expect(
      transitionConfig.indexes.map((index) => ({
        name: index.config.name,
        unique: index.config.unique,
        columns: columnNames(index.config.columns as NamedColumn[]),
      })),
    ).toEqual([
      {
        name: 'tenant_membership_transitions_tenant_membership_revision_idx',
        unique: false,
        columns: ['tenant_id', 'membership_id', 'to_revision'],
      },
    ]);

    const transitionChecks = new Map(
      transitionConfig.checks.map((constraint) => [
        constraint.name,
        dialect.sqlToQuery(constraint.value).sql.toLowerCase(),
      ]),
    );
    expect([...transitionChecks.keys()]).toEqual([
      'tenant_membership_transitions_revision_shape_check',
      'tenant_membership_transitions_lifecycle_shape_check',
      'tenant_membership_transitions_role_shape_check',
      'tenant_membership_transitions_provenance_shape_check',
    ]);
    expect(transitionChecks.get('tenant_membership_transitions_revision_shape_check')).toContain(
      'from_revision',
    );
    expect(transitionChecks.get('tenant_membership_transitions_revision_shape_check')).toContain(
      'to_revision',
    );
    expect(transitionChecks.get('tenant_membership_transitions_revision_shape_check')).toMatch(
      /from_revision"? is not null.*from_revision"? between 1 and 2147483646/su,
    );
    const lifecycleCheckSql = transitionChecks.get(
      'tenant_membership_transitions_lifecycle_shape_check',
    );
    for (const transition of [
      'create',
      'refresh',
      'revoke',
      'reactivate',
      'delete',
      'legacy_calibration',
    ]) {
      expect(lifecycleCheckSql).toContain(transition);
    }
    expect(lifecycleCheckSql?.match(/from_lifecycle_status"? is not null/gu)).toHaveLength(4);
    expect(transitionChecks.get('tenant_membership_transitions_role_shape_check')).toMatch(
      /refresh.*from_role.*to_role/su,
    );
    expect(transitionChecks.get('tenant_membership_transitions_provenance_shape_check')).toMatch(
      /legacy_calibration.*legacy_unknown.*formal_onboarding.*access_control_command/su,
    );
  });

  it('客户机构归属可空并提供机构范围复合唯一键', () => {
    const config = getTableConfig(customers);
    const institutionColumn = config.columns.find((column) => column.name === 'institution_id');
    const tenantIdUnique = config.uniqueConstraints.find(
      (constraint) => constraint.getName() === 'customers_tenant_id_id_unique',
    );
    const institutionUnique = config.uniqueConstraints.find(
      (constraint) => constraint.getName() === 'customers_tenant_institution_id_id_unique',
    );

    expect(institutionColumn?.notNull).toBe(false);
    expect(institutionColumn?.hasDefault).toBe(false);
    expect(columnNames(tenantIdUnique?.columns ?? [])).toEqual(['tenant_id', 'id']);
    expect(columnNames(institutionUnique?.columns ?? [])).toEqual([
      'tenant_id',
      'institution_id',
      'id',
    ]);
  });

  it('企业微信客户映射表使用严格机构范围复合外键、唯一约束和查询索引', () => {
    const config = getTableConfig(weComCustomerMappingStates);
    const columns = columnNames(config.columns);
    const customerFk = config.foreignKeys.find(
      (foreignKey) =>
        foreignKey.getName() ===
        'wecom_customer_mapping_states_tenant_institution_customer_fk',
    );
    const scopeUnique = config.uniqueConstraints.find(
      (constraint) =>
        constraint.getName() ===
        'wecom_customer_mapping_states_tenant_institution_proof_contact_unique',
    );
    const indexes = config.indexes.map((index) => ({
      name: index.config.name,
      unique: index.config.unique,
      columns: columnNames(index.config.columns as NamedColumn[]),
    }));

    expect(columns).toEqual([
      'id',
      'tenant_id',
      'institution_id',
      'proof_contact_id',
      'proof_employee_id',
      'source_mode',
      'customer_id',
      'status',
      'decided_by',
      'decided_at',
      'created_at',
      'updated_at',
    ]);
    expect(schema.weComCustomerMappingSourceModeEnum.enumValues).toEqual([
      'real_readonly_proof',
    ]);
    expect(schema.weComCustomerMappingStatusEnum.enumValues).toEqual([
      'confirmed',
      'rejected',
      'revoked',
    ]);
    for (const name of ['tenant_id', 'institution_id', 'customer_id']) {
      expect(config.columns.find((column) => column.name === name)?.notNull).toBe(true);
    }
    expect(foreignKeyColumns(customerFk)).toEqual({
      columns: ['tenant_id', 'institution_id', 'customer_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'id'],
    });
    expect(columnNames(scopeUnique?.columns ?? [])).toEqual([
      'tenant_id',
      'institution_id',
      'proof_contact_id',
    ]);
    expect(indexes).toContainEqual({
      name: 'wecom_customer_mapping_states_tenant_institution_customer_status_idx',
      unique: false,
      columns: ['tenant_id', 'institution_id', 'customer_id', 'status'],
    });
    expect(JSON.stringify({ columns, indexes })).not.toMatch(
      /external_userid|userid|corp_id|phone|raw_payload|response_body|secret|token/i,
    );
  });

  it('0034 migration 不回填历史客户并建立机构范围映射约束', () => {
    const migrationSql = readMigrationSql('0034_v08_04f_ea_customer_mapping_data_foundation');

    expect(migrationSql).toContain('alter table "customers" add column "institution_id" varchar(64)');
    expect(migrationSql).not.toMatch(/add column "institution_id"[^;]*(not null|default)/i);
    expect(migrationSql).toContain(
      'foreign key ("tenant_id","institution_id","customer_id") references "public"."customers"("tenant_id","institution_id","id")',
    );
    expect(migrationSql).toContain(
      'unique("tenant_id","institution_id","proof_contact_id")',
    );
    expect(migrationSql).not.toMatch(/\b(drop\s+(table|column)|truncate|delete\s+from)\b/i);
    expect(migrationSql).not.toMatch(/\bupdate\s+"?customers"?\b/i);
    expect(migrationSql).not.toMatch(/\bon\s+delete\s+cascade\b/i);
    expect(migrationSql).not.toMatch(/external_userid|userid|corp_id|secret|token|raw_payload/i);
  });

  it('定义客户许可、系统频控和机构 dry-run 最新快照三类可信事实', () => {
    const consentConfig = getTableConfig(customerChannelContactConsents);
    const frequencyConfig = getTableConfig(customerChannelFrequencyStates);
    const snapshotConfig = getTableConfig(institutionChannelDryRunSnapshots);
    const consentFk = consentConfig.foreignKeys.find((foreignKey) =>
      foreignKey.getName() === 'customer_channel_contact_consents_tenant_institution_customer_fk');
    const frequencyFk = frequencyConfig.foreignKeys.find((foreignKey) =>
      foreignKey.getName() === 'customer_channel_frequency_states_tenant_institution_customer_fk');

    expect(schema.customerChannelTypeEnum.enumValues).toEqual(['wechat_work']);
    expect(schema.customerChannelContactConsentStatusEnum.enumValues).toEqual([
      'unknown',
      'consented',
      'opted_out',
      'consent_revoked',
    ]);
    expect(schema.customerChannelContactConsentSourceTypeEnum.enumValues).toEqual([
      'customer_explicit_verbal',
      'customer_explicit_written',
      'customer_opt_out_request',
      'customer_consent_revocation',
    ]);
    expect(foreignKeyColumns(consentFk)).toEqual({
      columns: ['tenant_id', 'institution_id', 'customer_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'id'],
    });
    expect(foreignKeyColumns(frequencyFk)).toEqual({
      columns: ['tenant_id', 'institution_id', 'customer_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'id'],
    });

    const consentColumns = columnNames(consentConfig.columns);
    const frequencyColumns = columnNames(frequencyConfig.columns);
    const snapshotColumns = columnNames(snapshotConfig.columns);
    expect(consentColumns).toEqual(expect.arrayContaining([
      'status', 'source_type', 'evidence_ref', 'recorded_by', 'recorded_at', 'version',
    ]));
    expect(frequencyColumns).toEqual(expect.arrayContaining([
      'window_started_at', 'window_ends_at', 'prepared_count', 'completed_count',
      'max_prepared_count', 'max_completed_count', 'next_allowed_at',
      'last_prepared_ref', 'last_completed_ref', 'version',
    ]));
    expect(snapshotColumns).toEqual(expect.arrayContaining([
      'official_route', 'proof_institution_ref', 'callback_placeholder_ref',
      'config_status', 'preflight_status', 'proof_eligible_mock', 'evaluated_by',
      'evaluated_at', 'allow_real_send', 'external_channel_enabled',
      'real_send_allowed', 'dry_run_only', 'version',
    ]));
    expect(JSON.stringify({ consentColumns, frequencyColumns, snapshotColumns })).not.toMatch(
      /secret|token|corp_id|userid|user_id|agent_id|raw_payload|callback_url/i,
    );
  });

  it('0035 migration 只新增安全事实并固定频控和 dry-run 安全约束', () => {
    const migrationSql = readMigrationSql('0035_v08_04f_fa_trusted_reachout_safety_foundation');

    expect(migrationSql).toContain('create table if not exists "customer_channel_contact_consents"');
    expect(migrationSql).toContain('create table if not exists "customer_channel_frequency_states"');
    expect(migrationSql).toContain('create table if not exists "institution_channel_dry_run_snapshots"');
    expect(migrationSql).toContain('"max_prepared_count" = 1 and "max_completed_count" = 1');
    expect(migrationSql).toContain('interval \'24 hours\'');
    expect(migrationSql).toContain('"next_allowed_at" = "window_ends_at"');
    expect(migrationSql).toContain('customer_channel_contact_consents_status_source_check');
    expect(migrationSql).toContain('institution_channel_dry_run_snapshots_route_check');
    expect(migrationSql).toContain('institution_channel_dry_run_snapshots_ready_check');
    expect(migrationSql).toContain('"allow_real_send" = false');
    expect(migrationSql).toContain('"external_channel_enabled" = false');
    expect(migrationSql).toContain('"real_send_allowed" = false');
    expect(migrationSql).toContain('"dry_run_only" = true');
    expect(migrationSql).not.toMatch(/\b(drop|truncate|delete\s+from|insert\s+into)\b|(^|;)\s*update\s+/i);
    expect(migrationSql).not.toMatch(/\bon\s+delete\s+cascade\b/i);
    expect(migrationSql).not.toMatch(/secret|token|corp_id|userid|agent_id|raw_payload|callback_url/i);
  });

  it('dry-run ready check 仅允许 self-built mock-ready eligible，blocked 保留三类规划路线', () => {
    const snapshotConfig = getTableConfig(institutionChannelDryRunSnapshots);
    const readyCheck = snapshotConfig.checks.find((constraint) =>
      constraint.name === 'institution_channel_dry_run_snapshots_ready_check');
    const migrationSql = readMigrationSql('0035_v08_04f_fa_trusted_reachout_safety_foundation');

    expect(readyCheck).toBeDefined();
    const schemaReadyCheckSql = new PgDialect().sqlToQuery(readyCheck!.value).sql
      .replaceAll('"institution_channel_dry_run_snapshots".', '');
    const expectedReadyRule = '"config_status" <> \'dry_run_ready\' or ("official_route" = \'official_wecom_self_built\' and "preflight_status" = \'mock_ready\' and "proof_eligible_mock" = true)';
    expect(schemaReadyCheckSql.toLowerCase()).toContain(expectedReadyRule);
    expect(migrationSql).toContain(`check (${expectedReadyRule})`);

    const satisfiesReadyCheck = (input: {
      officialRoute: 'official_wecom_self_built' | 'official_wecom_third_party' | 'official_wecom_service_provider';
      configStatus: 'dry_run_ready' | 'blocked_route_unverified';
      preflightStatus: 'mock_ready' | 'blocked_route_unverified';
      proofEligibleMock: boolean;
    }) => input.configStatus !== 'dry_run_ready' || (
      input.officialRoute === 'official_wecom_self_built'
      && input.preflightStatus === 'mock_ready'
      && input.proofEligibleMock
    );

    expect(satisfiesReadyCheck({
      officialRoute: 'official_wecom_self_built', configStatus: 'dry_run_ready',
      preflightStatus: 'mock_ready', proofEligibleMock: true,
    })).toBe(true);
    expect(satisfiesReadyCheck({
      officialRoute: 'official_wecom_third_party', configStatus: 'dry_run_ready',
      preflightStatus: 'mock_ready', proofEligibleMock: true,
    })).toBe(false);
    expect(satisfiesReadyCheck({
      officialRoute: 'official_wecom_service_provider', configStatus: 'dry_run_ready',
      preflightStatus: 'mock_ready', proofEligibleMock: true,
    })).toBe(false);
    for (const officialRoute of [
      'official_wecom_self_built',
      'official_wecom_third_party',
      'official_wecom_service_provider',
    ] as const) {
      expect(satisfiesReadyCheck({
        officialRoute, configStatus: 'blocked_route_unverified',
        preflightStatus: 'blocked_route_unverified', proofEligibleMock: false,
      })).toBe(true);
    }
  });

  it('定义单条真实发送 proof operation、六层 controls 与 production attestation', () => {
    const operationConfig = getTableConfig(weComRealSendProofOperations);
    const controlConfig = getTableConfig(weComRealSendProofControls);
    const attestationConfig = getTableConfig(weComRealSendProductionAttestations);
    const operationColumns = columnNames(operationConfig.columns);
    const controlColumns = columnNames(controlConfig.columns);
    const attestationColumns = columnNames(attestationConfig.columns);

    expect(schema.weComRealSendProofOperationStatusEnum.enumValues).toEqual([
      'requested', 'aborted', 'attempted', 'succeeded', 'failed', 'unknown_outcome',
    ]);
    expect(schema.weComRealSendProofControlScopeKindEnum.enumValues).toEqual([
      'global', 'tenant', 'institution', 'channel', 'customer', 'operator_role',
    ]);
    expect(schema.weComRealSendProofProviderResultCategoryEnum.enumValues).toEqual([
      'accepted', 'rejected', 'transport_error', 'timeout', 'indeterminate',
    ]);
    expect(schema.weComRealSendProofPostcheckStatusEnum.enumValues).toEqual([
      'ready', 'blocked', 'expired',
    ]);
    expect(operationColumns).toEqual(expect.arrayContaining([
      'operation_ref', 'channel_type', 'source_ready_no_send_ref', 'source_ready_no_send_digest',
      'readiness_fingerprint', 'content_hash', 'recipient_binding_ref',
      'recipient_binding_digest', 'confirmation_token_digest', 'confirmation_issued_at',
      'confirmation_expires_at', 'confirmation_consumed_at', 'attempt_count',
      'provider_result_category', 'completed_frequency_ref', 'session_provenance',
    ]));
    expect(controlColumns).toEqual(expect.arrayContaining([
      'scope_kind', 'proof_enabled', 'kill_switch_engaged', 'effective_at', 'expires_at',
      'approval_ref', 'approved_by', 'updated_by', 'version',
    ]));
    expect(attestationColumns).toEqual(expect.arrayContaining([
      'environment_ref', 'database_identity_ref', 'migration_target', 'migration_hash',
      'journal_latest', 'postcheck_status', 'approval_ref', 'reviewed_by', 'attested_by',
      'attested_at', 'expires_at', 'version',
    ]));
    expect(operationConfig.uniqueConstraints.map(constraint => constraint.getName())).toEqual(
      expect.arrayContaining([
        'wecom_real_send_proof_operations_operation_ref_unique',
        'wecom_real_send_proof_operations_token_digest_unique',
        'wecom_real_send_proof_operations_source_unique',
      ]),
    );
    expect(operationConfig.foreignKeys.map(foreignKey => foreignKey.getName())).toEqual(
      expect.arrayContaining([
        'wecom_real_send_proof_operations_tenant_institution_customer_fk',
        'wecom_real_send_proof_operations_scope_draft_fk',
        'wecom_real_send_proof_operations_scope_mapping_fk',
        'wecom_real_send_proof_operations_scope_consent_fk',
        'wecom_real_send_proof_operations_scope_frequency_fk',
        'wecom_real_send_proof_operations_scope_dry_run_snapshot_fk',
        'wecom_real_send_proof_operations_production_attestation_fk',
      ]),
    );
    expect(foreignKeyColumns(operationConfig.foreignKeys.find(foreignKey =>
      foreignKey.getName() === 'wecom_real_send_proof_operations_production_attestation_fk')))
      .toEqual({ columns: ['production_attestation_id'], foreignColumns: ['id'] });
    expect(operationConfig.columns.find(column => column.name === 'confirmation_token_digest')?.notNull)
      .toBe(true);
    expect(operationConfig.columns.find(column => column.name === 'operator_id')?.notNull)
      .toBe(true);
    expect(operationConfig.checks.map(check => check.name)).toEqual(expect.arrayContaining([
      'wecom_real_send_proof_operations_attempt_count_check',
      'wecom_real_send_proof_operations_token_timing_check',
      'wecom_real_send_proof_operations_consumed_operator_check',
      'wecom_real_send_proof_operations_session_provenance_check',
      'wecom_real_send_proof_operations_attempted_check',
      'wecom_real_send_proof_operations_terminal_check',
      'wecom_real_send_proof_operations_status_shape_check',
      'wecom_real_send_proof_operations_completed_frequency_check',
      'wecom_real_send_proof_operations_provider_result_check',
    ]));
    expect(controlConfig.checks.map(check => check.name)).toContain(
      'wecom_real_send_proof_controls_scope_shape_check',
    );
    expect(controlConfig.checks.map(check => check.name)).toContain(
      'wecom_real_send_proof_controls_operator_self_approval_check',
    );
    expect(attestationConfig.checks.map(check => check.name)).toContain(
      'wecom_real_send_production_attestations_expiry_check',
    );
    expect(JSON.stringify({ operationColumns, controlColumns, attestationColumns })).not.toMatch(
      /token_plaintext|confirmation_token(?!_digest)|external_userid|userid|user_id|provider_raw|raw_response|access_token|client_secret|database_url|password|callback_url/i,
    );

    const dialect = new PgDialect();
    const checkSql = (
      checks: typeof operationConfig.checks,
      name: string,
    ) => dialect
      .sqlToQuery(checks.find(check => check.name === name)!.value)
      .sql
      .toLowerCase()
      .replace(/"[^"]+"\./gu, '');
    expect(checkSql(operationConfig.checks, 'wecom_real_send_proof_operations_token_timing_check'))
      .toContain('"confirmation_consumed_at" > "confirmation_issued_at"');
    expect(checkSql(operationConfig.checks, 'wecom_real_send_proof_operations_status_shape_check'))
      .toContain('"status" in (\'succeeded\', \'failed\', \'unknown_outcome\')');
    expect(checkSql(operationConfig.checks, 'wecom_real_send_proof_operations_provider_result_check'))
      .toContain('"provider_result_category" is not null');
    expect(checkSql(operationConfig.checks, 'wecom_real_send_proof_operations_provider_result_check'))
      .toContain('"status" = \'failed\' and "provider_result_category" is not null and "provider_result_category" = \'rejected\'');
    expect(checkSql(operationConfig.checks, 'wecom_real_send_proof_operations_completed_frequency_check'))
      .toContain('"completed_frequency_ref" = "operation_ref"');
    expect(checkSql(controlConfig.checks as typeof operationConfig.checks, 'wecom_real_send_proof_controls_scope_shape_check'))
      .toContain('"channel_type" is not null');
    expect(checkSql(controlConfig.checks as typeof operationConfig.checks, 'wecom_real_send_proof_controls_operator_self_approval_check'))
      .toContain('"approved_by" <> "operator_id"');
  });

  it('0036 migration forward-only 建立 proof 基础且不修改 0034/0035 safety', () => {
    const migrationSql = readMigrationSql('0036_v08_05b_a_single_real_send_proof_foundation');
    const migration0034 = readFileSync(join(process.cwd(), 'drizzle/0034_v08_04f_ea_customer_mapping_data_foundation.sql'), 'utf8');
    const migration0035 = readFileSync(join(process.cwd(), 'drizzle/0035_v08_04f_fa_trusted_reachout_safety_foundation.sql'), 'utf8');
    const journal = JSON.parse(readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; tag: string; version: string; when: number; breakpoints: boolean }>;
    };

    expect(migrationSql).toContain('create table if not exists "wecom_real_send_proof_operations"');
    expect(migrationSql).toContain('create table if not exists "wecom_real_send_proof_controls"');
    expect(migrationSql).toContain('create table if not exists "wecom_real_send_production_attestations"');
    expect(migrationSql).toContain('unique("operation_ref")');
    expect(migrationSql).toContain('unique("confirmation_token_digest")');
    expect(migrationSql).toContain('"attempt_count" between 0 and 1');
    expect(migrationSql).toContain('"confirmation_expires_at" > "confirmation_issued_at"');
    expect(migrationSql).toContain('"confirmation_consumed_at" > "confirmation_issued_at"');
    expect(migrationSql).toContain('wecom_real_send_proof_operations_terminal_check');
    expect(migrationSql).toContain('wecom_real_send_proof_operations_status_shape_check');
    expect(migrationSql).toContain('wecom_real_send_proof_operations_completed_frequency_check');
    expect(migrationSql).toContain('wecom_real_send_proof_controls_scope_shape_check');
    expect(migrationSql).toContain('wecom_real_send_proof_controls_operator_self_approval_check');
    expect(migrationSql).toContain('unique nulls not distinct');
    expect(migrationSql).toContain('"channel_type" is not null and "channel_type" = \'wechat_work\'');
    expect(migrationSql).toContain('"provider_result_category" is not null');
    expect(migrationSql).toContain('"completed_frequency_ref" = "operation_ref"');
    expect(migrationSql).not.toMatch(/\b(drop|truncate|delete\s+from|insert\s+into)\b|(^|;)\s*update\s+/i);
    expect(migrationSql).not.toMatch(/external_userid|userid|provider_raw|raw_response|access_token|client_secret|database_url|password|callback_url/i);
    expect(createHash('sha256').update(migration0034).digest('hex')).toBe(
      '00e258a60d9975ac27e7c7dea5c9b6b10d242df19cd9cbfbe3d411b3abdfe701',
    );
    expect(createHash('sha256').update(migration0035).digest('hex')).toBe(
      '6c36ba5c25344c33aab904ff1c09a091011e9d7373fcf053776106e26ecd8987',
    );
    expect(migration0035.toLowerCase()).toContain('"allow_real_send" = false and "external_channel_enabled" = false and "real_send_allowed" = false and "dry_run_only" = true');
    expect(journal.entries.find((entry) => entry.idx === 36)).toEqual({
      idx: 36,
      tag: '0036_v08_05b_a_single_real_send_proof_foundation',
      version: '7',
      when: 1783843200000,
      breakpoints: true,
    });
  });

  it('定义 formal institution binding、真实任务 outcome sidecar 与低敏 recipient metadata', () => {
    const bindingConfig = getTableConfig(authAccountInstitutionBindings);
    const attemptConfig = getTableConfig(weComCustomerBroadcastTaskProviderAttempts);
    const recipientConfig = getTableConfig(weComCustomerBroadcastRecipientBindings);
    const bindingColumns = columnNames(bindingConfig.columns);
    const attemptColumns = columnNames(attemptConfig.columns);
    const recipientColumns = columnNames(recipientConfig.columns);

    expect(schema.authInstitutionBindingStatusEnum.enumValues).toEqual(['active', 'revoked']);
    expect(schema.authInstitutionBindingSourceEnum.enumValues).toEqual([
      'manual_admin', 'migration_placeholder', 'system',
    ]);
    expect(schema.weComCustomerBroadcastTaskDispatchStateEnum.enumValues).toEqual([
      'not_started', 'task_create_attempted', 'task_created', 'task_create_failed',
      'task_create_unknown',
    ]);
    expect(schema.weComCustomerBroadcastTaskSendResultStatusEnum.enumValues).toEqual([
      'not_checked', 'awaiting_member_confirmation', 'target_sent', 'target_failed',
      'target_unknown',
    ]);
    expect(schema.weComCustomerBroadcastTaskFinalizeStateEnum.enumValues).toEqual([
      'not_finalized', 'success_recorded', 'failure_recorded', 'unknown_recorded',
    ]);
    expect(schema.weComCustomerBroadcastTaskReconciliationStateEnum.enumValues).toEqual([
      'none', 'manual_review_required', 'reconciled',
    ]);
    expect(schema.weComCustomerBroadcastRecipientBindingSourceKindEnum.enumValues).toEqual([
      'protected_vault_reference', 'protected_resolver_reference',
    ]);
    expect(schema.weComCustomerBroadcastRecipientBindingStatusEnum.enumValues).toEqual([
      'active', 'revoked', 'stale',
    ]);

    expect(bindingColumns).toEqual(expect.arrayContaining([
      'account_id', 'tenant_id', 'institution_id', 'status', 'source', 'assigned_by',
      'assigned_at', 'expires_at', 'revoked_at', 'version',
    ]));
    expect(attemptColumns).toEqual(expect.arrayContaining([
      'operation_id', 'operation_ref', 'tenant_id', 'institution_id', 'customer_id',
      'capability_kind', 'provider_kind', 'dispatch_state', 'dispatch_count',
      'dispatch_started_at', 'dispatch_terminal_at', 'task_ref_digest',
      'member_confirmation_required', 'provider_result_category', 'send_result_status',
      'send_result_checked_at', 'finalize_state', 'reconciliation_state',
      'manual_review_required', 'automatic_retry_allowed', 'version',
    ]));
    expect(recipientColumns).toEqual(expect.arrayContaining([
      'tenant_id', 'institution_id', 'customer_id', 'operation_id', 'operation_ref',
      'mapping_id', 'recipient_binding_ref', 'recipient_binding_digest',
      'recipient_binding_version', 'opaque_handle_ref', 'source_kind', 'status', 'revoked_at',
    ]));

    expect(bindingConfig.indexes.find(index =>
      index.config.name === 'auth_account_institution_bindings_active_account_tenant_unique_idx')
      ?.config.unique).toBe(true);
    expect(bindingConfig.indexes.find(index =>
      index.config.name === 'auth_account_institution_bindings_active_account_tenant_unique_idx')
      ?.config.where).toBeDefined();
    const bindingScopeIndex = bindingConfig.indexes.find(index =>
      index.config.name === 'auth_account_institution_bindings_scope_idx');
    expect({
      name: bindingScopeIndex?.config.name,
      unique: bindingScopeIndex?.config.unique,
      method: bindingScopeIndex?.config.method,
      columns: columnNames((bindingScopeIndex?.config.columns ?? []) as NamedColumn[]),
    }).toEqual({
      name: 'auth_account_institution_bindings_scope_idx',
      unique: false,
      method: 'btree',
      columns: ['tenant_id', 'institution_id'],
    });
    expect(bindingScopeIndex?.config.where).toBeUndefined();
    expect(bindingScopeIndex?.config.concurrently).not.toBe(true);
    expect(bindingScopeIndex?.config.with ?? {}).toEqual({});
    expect(recipientConfig.indexes.find(index =>
      index.config.name === 'wecom_customer_broadcast_recipient_bindings_active_operation_unique_idx')
      ?.config.unique).toBe(true);
    expect(recipientConfig.indexes.find(index =>
      index.config.name === 'wecom_customer_broadcast_recipient_bindings_active_operation_unique_idx')
      ?.config.where).toBeDefined();
    expect(recipientConfig.indexes.map(index => index.config.name)).toEqual(expect.arrayContaining([
      'wecom_customer_broadcast_recipient_bindings_operation_id_idx',
      'wecom_customer_broadcast_recipient_bindings_mapping_id_idx',
    ]));
    expect(attemptConfig.uniqueConstraints.map(constraint => constraint.getName())).toContain(
      'wecom_customer_broadcast_task_provider_attempts_operation_unique',
    );

    expect(foreignKeyColumns(bindingConfig.foreignKeys.find(foreignKey =>
      foreignKey.getName() === 'auth_account_institution_bindings_tenant_account_fk'))).toEqual({
      columns: ['tenant_id', 'account_id'],
      foreignColumns: ['tenant_id', 'user_id'],
    });
    const bindingScopeFk = bindingConfig.foreignKeys.find(foreignKey =>
      foreignKey.getName() === 'auth_account_institution_bindings_scope_fk');
    expect(foreignKeyColumns(bindingScopeFk)).toEqual({
      columns: ['tenant_id', 'institution_id'],
      foreignColumns: ['tenant_id', 'institution_id'],
    });
    expect(bindingScopeFk?.reference().foreignTable).toBe(institutionScopes);
    expect((bindingScopeFk as unknown as { onUpdate?: string }).onUpdate).toBe('no action');
    expect((bindingScopeFk as unknown as { onDelete?: string }).onDelete).toBe('no action');
    expect(bindingConfig.foreignKeys.map(foreignKey => foreignKey.getName())).toEqual([
      'auth_account_institution_bindings_tenant_account_fk',
      'auth_account_institution_bindings_scope_fk',
    ]);
    expect(foreignKeyColumns(attemptConfig.foreignKeys.find(foreignKey =>
      foreignKey.getName() ===
        'wecom_customer_broadcast_task_provider_attempts_operation_scope_fk'))).toEqual({
      columns: ['tenant_id', 'institution_id', 'customer_id', 'operation_ref', 'operation_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'customer_id', 'operation_ref', 'id'],
    });
    expect(foreignKeyColumns(recipientConfig.foreignKeys.find(foreignKey =>
      foreignKey.getName() ===
        'wecom_customer_broadcast_recipient_bindings_operation_scope_fk'))).toEqual({
      columns: ['tenant_id', 'institution_id', 'customer_id', 'operation_ref', 'operation_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'customer_id', 'operation_ref', 'id'],
    });
    expect(foreignKeyColumns(recipientConfig.foreignKeys.find(foreignKey =>
      foreignKey.getName() ===
        'wecom_customer_broadcast_recipient_bindings_mapping_scope_fk'))).toEqual({
      columns: ['tenant_id', 'institution_id', 'customer_id', 'mapping_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'customer_id', 'id'],
    });

    const dialect = new PgDialect();
    const checkSql = (
      checks: typeof attemptConfig.checks,
      name: string,
    ) => dialect
      .sqlToQuery(checks.find(check => check.name === name)!.value)
      .sql
      .toLowerCase()
      .replace(/"[^"]+"\./gu, '');
    expect(checkSql(
      bindingConfig.checks as typeof attemptConfig.checks,
      'auth_account_institution_bindings_status_shape_check',
    )).toContain('"status" = \'revoked\' and "revoked_at" is not null');
    expect(checkSql(
      bindingConfig.checks as typeof attemptConfig.checks,
      'auth_account_institution_bindings_source_authority_check',
    )).toContain('"status" <> \'active\' or "source" in (\'manual_admin\', \'system\')');
    expect(checkSql(
      attemptConfig.checks,
      'wecom_customer_broadcast_task_provider_attempts_dispatch_once_check',
    )).toContain('"dispatch_count" between 0 and 1');
    expect(checkSql(
      attemptConfig.checks,
      'wecom_customer_broadcast_task_provider_attempts_task_ref_digest_check',
    )).toContain("'^[0-9a-f]{64}$'");
    expect(checkSql(
      attemptConfig.checks,
      'wecom_customer_broadcast_task_provider_attempts_finalize_candidate_check',
    )).toContain('"finalize_state" = \'success_recorded\' and "send_result_status" = \'target_sent\'');
    expect(checkSql(
      attemptConfig.checks,
      'wecom_customer_broadcast_task_provider_attempts_send_result_check',
    )).toContain('"send_result_checked_at" >= "dispatch_terminal_at"');
    expect(checkSql(
      attemptConfig.checks,
      'wecom_customer_broadcast_task_provider_attempts_unknown_review_check',
    )).toContain('"automatic_retry_allowed" = false');
    expect(checkSql(
      recipientConfig.checks as typeof attemptConfig.checks,
      'wecom_customer_broadcast_recipient_bindings_digest_length_check',
    )).toContain("'^[0-9a-f]{64}$'");
    expect(checkSql(
      recipientConfig.checks as typeof attemptConfig.checks,
      'wecom_customer_broadcast_recipient_bindings_status_shape_check',
    )).toContain('"revoked_at" >= "created_at"');
    expect(JSON.stringify({ bindingColumns, attemptColumns, recipientColumns })).not.toMatch(
      /external_userid|userid|employee_id|phone|sender|recipient_plain|raw_msgid|msgid|raw_response|provider_url|access_token|secret|message_content|content_plain/i,
    );
    expect(attemptColumns).not.toContain('completed_count');
  });

  it('0037 forward-only 追加三表与 scope FK，且保持 0034/0035/0036 原文不变', () => {
    const migrationSql = readMigrationSql('0037_v08_05b_b3a_real_task_readiness_foundation');
    const migration0034 = readFileSync(
      join(process.cwd(), 'drizzle/0034_v08_04f_ea_customer_mapping_data_foundation.sql'),
      'utf8',
    );
    const migration0035 = readFileSync(
      join(process.cwd(), 'drizzle/0035_v08_04f_fa_trusted_reachout_safety_foundation.sql'),
      'utf8',
    );
    const migration0036 = readFileSync(
      join(process.cwd(), 'drizzle/0036_v08_05b_a_single_real_send_proof_foundation.sql'),
      'utf8',
    );
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8'),
    ) as {
      entries: Array<{
        idx: number;
        tag: string;
        version: string;
        when: number;
        breakpoints: boolean;
      }>;
    };

    expect(migrationSql).toContain('create table if not exists "auth_account_institution_bindings"');
    expect(migrationSql).toContain('create table if not exists "wecom_customer_broadcast_task_provider_attempts"');
    expect(migrationSql).toContain('create table if not exists "wecom_customer_broadcast_recipient_bindings"');
    expect(migrationSql).toContain('wecom_real_send_proof_operations_scope_ref_id_unique');
    expect(migrationSql).toContain('wecom_customer_broadcast_task_provider_attempts_operation_scope_fk');
    expect(migrationSql).toContain('wecom_customer_broadcast_recipient_bindings_operation_scope_fk');
    expect(migrationSql).toContain('wecom_customer_broadcast_recipient_bindings_mapping_scope_fk');
    expect(migrationSql).toContain('wecom_customer_broadcast_recipient_bindings_operation_id_idx');
    expect(migrationSql).toContain('wecom_customer_broadcast_recipient_bindings_mapping_id_idx');
    expect(migrationSql).toContain('where "status" = \'active\'');
    expect(migrationSql).toContain('"status" <> \'active\' or "source" in (\'manual_admin\', \'system\')');
    expect(migrationSql).toContain('"dispatch_count" between 0 and 1');
    expect(migrationSql).toContain('"task_ref_digest" ~ \'^[0-9a-f]{64}$\'');
    expect(migrationSql).toContain('"recipient_binding_digest" ~ \'^[0-9a-f]{64}$\'');
    expect(migrationSql).toContain('"automatic_retry_allowed" = false');
    expect(migrationSql).toContain('"send_result_status" = \'target_sent\'');
    expect(migrationSql).toContain('"send_result_checked_at" >= "dispatch_terminal_at"');
    expect(migrationSql).not.toContain('"completed_count"');
    expect(migrationSql).not.toMatch(
      /external_userid|userid|employee_id|phone|sender|recipient_plain|raw_msgid|\bmsgid\b|raw_response|provider_url|access_token|secret|message_content|content_plain/i,
    );
    expect(migrationSql).not.toMatch(
      /\b(drop|truncate|delete\s+from|insert\s+into)\b|(^|;)\s*update\s+/i,
    );
    expect(createHash('sha256').update(migration0034).digest('hex')).toBe(
      '00e258a60d9975ac27e7c7dea5c9b6b10d242df19cd9cbfbe3d411b3abdfe701',
    );
    expect(createHash('sha256').update(migration0035).digest('hex')).toBe(
      '6c36ba5c25344c33aab904ff1c09a091011e9d7373fcf053776106e26ecd8987',
    );
    expect(createHash('sha256').update(migration0036).digest('hex')).toBe(
      '62328524a4f1a36a619e23a8ebbfb4bd70b25da6aede1db5751d6f795e8c2329',
    );
    expect(journal.entries.find((entry) => entry.idx === 36)).toEqual({
      idx: 36,
      tag: '0036_v08_05b_a_single_real_send_proof_foundation',
      version: '7',
      when: 1783843200000,
      breakpoints: true,
    });
    expect(journal.entries.find((entry) => entry.idx === 37)).toEqual({
      idx: 37,
      tag: '0037_v08_05b_b3a_real_task_readiness_foundation',
      version: '7',
      when: 1783846800000,
      breakpoints: true,
    });
    expect(journal.entries.filter(entry => entry.idx === 37)).toHaveLength(1);
  });

  it('定义正式租户账号、联系人表和账号状态枚举', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const authUsers = schemaModule.authUsers;
    const tenantContacts = schemaModule.tenantContacts;
    const authAccountStatusEnum = schemaModule.authAccountStatusEnum as
      | { enumValues?: string[] }
      | undefined;
    const tenantStatusEnum = schemaModule.tenantStatusEnum as
      | { enumValues?: string[] }
      | undefined;

    expect(authUsers).toBeDefined();
    expect(tenantContacts).toBeDefined();
    expect(authAccountStatusEnum?.enumValues).toEqual([
      'active',
      'password_reset_required',
      'disabled',
      'locked',
    ]);
    expect(tenantStatusEnum?.enumValues).toEqual([
      'active',
      'suspended',
      'trialing',
      'expired',
    ]);

    const authConfig = getTableConfig(authUsers as never);
    const contactConfig = getTableConfig(tenantContacts as never);
    const authColumns = columnNames(authConfig.columns);
    const contactColumns = columnNames(contactConfig.columns);
    const authIndexes = authConfig.indexes.map((index) => ({
      name: index.config.name,
      unique: index.config.unique,
      columns: columnNames(index.config.columns as NamedColumn[]),
    }));
    const contactIndexes = contactConfig.indexes.map((index) => ({
      name: index.config.name,
      unique: index.config.unique,
      columns: columnNames(index.config.columns as NamedColumn[]),
    }));
    const memberUserFk = getTableConfig(tenantMembers).foreignKeys.find(
      (foreignKey) => foreignKey.getName() === 'tenant_members_user_id_auth_users_id_fk',
    );
    const contactTenantFk = contactConfig.foreignKeys.find(
      (foreignKey) => foreignKey.getName() === 'tenant_contacts_tenant_id_tenants_id_fk',
    );
    const contactAdminFk = contactConfig.foreignKeys.find(
      (foreignKey) => foreignKey.getName() === 'tenant_contacts_initial_admin_user_id_auth_users_id_fk',
    );

    expect(authConfig.name).toBe('auth_users');
    expect(contactConfig.name).toBe('tenant_contacts');
    expect(authColumns).toEqual(
      expect.arrayContaining([
        'id',
        'username',
        'display_name',
        'phone',
        'email',
        'password_hash',
        'password_updated_at',
        'password_reset_required',
        'status',
        'last_login_at',
        'failed_login_count',
        'locked_until',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at',
      ]),
    );
    expect(contactColumns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'contact_name',
        'contact_phone',
        'contact_email',
        'initial_admin_user_id',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at',
      ]),
    );
    expect(authIndexes).toEqual(
      expect.arrayContaining([
        { name: 'auth_users_username_unique_idx', unique: true, columns: ['username'] },
        { name: 'auth_users_phone_idx', unique: false, columns: ['phone'] },
        { name: 'auth_users_email_idx', unique: false, columns: ['email'] },
        { name: 'auth_users_status_idx', unique: false, columns: ['status'] },
      ]),
    );
    expect(contactIndexes).toEqual(
      expect.arrayContaining([
        { name: 'tenant_contacts_tenant_unique_idx', unique: true, columns: ['tenant_id'] },
        {
          name: 'tenant_contacts_admin_user_idx',
          unique: false,
          columns: ['initial_admin_user_id'],
        },
      ]),
    );
    expect(foreignKeyColumns(memberUserFk)).toEqual({
      columns: ['user_id'],
      foreignColumns: ['id'],
    });
    expect(foreignKeyColumns(contactTenantFk)).toEqual({
      columns: ['tenant_id'],
      foreignColumns: ['id'],
    });
    expect(foreignKeyColumns(contactAdminFk)).toEqual({
      columns: ['initial_admin_user_id'],
      foreignColumns: ['id'],
    });
    expect(
      JSON.stringify({ authColumns, contactColumns, authIndexes, contactIndexes }),
    ).not.toMatch(
      /plain_password|password_plaintext|temporary_password|request_body|response_body|raw_payload|sql\b|stack|database_url|secret|token|api_key|oauth|private_key/i,
    );
  });

  it('预约和随访任务通过租户加客户复合外键关联客户', () => {
    const appointmentCustomerFk = getTableConfig(appointments).foreignKeys.find(
      (foreignKey) => foreignKey.getName() === 'appointments_tenant_customer_fk',
    );
    const followUpCustomerFk = getTableConfig(followUpTasks).foreignKeys.find(
      (foreignKey) => foreignKey.getName() === 'follow_up_tasks_tenant_customer_fk',
    );
    const appointmentReference = appointmentCustomerFk?.reference();
    const followUpReference = followUpCustomerFk?.reference();

    expect(appointmentCustomerFk).toBeDefined();
    expect(columnNames(appointmentReference?.columns ?? [])).toEqual(['tenant_id', 'customer_id']);
    expect(getTableConfig(appointmentReference?.foreignTable ?? tenants).name).toBe('customers');
    expect(columnNames(appointmentReference?.foreignColumns ?? [])).toEqual(['tenant_id', 'id']);

    expect(followUpCustomerFk).toBeDefined();
    expect(columnNames(followUpReference?.columns ?? [])).toEqual(['tenant_id', 'customer_id']);
    expect(getTableConfig(followUpReference?.foreignTable ?? tenants).name).toBe('customers');
    expect(columnNames(followUpReference?.foreignColumns ?? [])).toEqual(['tenant_id', 'id']);
  });

  it('随访任务支持治疗摘要建议来源关联且保持租户隔离', () => {
    const followUpConfig = getTableConfig(followUpTasks);
    const treatmentConfig = getTableConfig(treatmentSummaries);
    const followUpColumns = columnNames(followUpConfig.columns);
    const sourceSummaryFk = followUpConfig.foreignKeys.find(
      (foreignKey) => foreignKey.getName() === 'follow_up_tasks_tenant_source_treatment_summary_fk',
    );
    const sourceSummaryReference = sourceSummaryFk?.reference();
    const sourceIndexes = followUpConfig.indexes.map((index) => ({
      name: index.config.name,
      unique: index.config.unique,
      columns: columnNames(index.config.columns as NamedColumn[]),
    }));
    const treatmentSummaryUnique = treatmentConfig.uniqueConstraints.find(
      (constraint) => constraint.getName() === 'treatment_summaries_tenant_id_id_unique',
    );

    expect(followUpColumns).toEqual(
      expect.arrayContaining(['source_treatment_summary_id', 'source_suggestion_key']),
    );
    expect(followUpTasks.sourceTreatmentSummaryId.notNull).toBe(false);
    expect(followUpTasks.sourceSuggestionKey.notNull).toBe(false);

    expect(treatmentSummaryUnique).toBeDefined();
    expect(columnNames(treatmentSummaryUnique?.columns ?? [])).toEqual(['tenant_id', 'id']);
    expect(sourceSummaryFk).toBeDefined();
    expect(columnNames(sourceSummaryReference?.columns ?? [])).toEqual([
      'tenant_id',
      'source_treatment_summary_id',
    ]);
    expect(getTableConfig(sourceSummaryReference?.foreignTable ?? tenants).name).toBe(
      'treatment_summaries',
    );
    expect(columnNames(sourceSummaryReference?.foreignColumns ?? [])).toEqual(['tenant_id', 'id']);
    expect(sourceIndexes).toEqual(
      expect.arrayContaining([
        {
          name: 'follow_up_tasks_tenant_source_treatment_summary_idx',
          unique: false,
          columns: ['tenant_id', 'source_treatment_summary_id'],
        },
        {
          name: 'follow_up_tasks_active_source_unique_idx',
          unique: true,
          columns: ['tenant_id', 'source_treatment_summary_id', 'source_suggestion_key'],
        },
      ]),
    );
    expect(JSON.stringify(followUpColumns)).not.toMatch(
      /phone_number|id_number|medical_record_no|treatment_record|medical_record_body|consultation_transcript|request_body|metadata|raw_payload|ai_generated|external_sync|token|secret|database_url/i,
    );
  });

  it('定义治疗结构化摘要表且只包含安全白名单字段', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const treatmentSummaries = schemaModule.treatmentSummaries;

    expect(treatmentSummaries).toBeDefined();

    const treatmentConfig = getTableConfig(treatmentSummaries as never);
    const treatmentColumns = columnNames(treatmentConfig.columns);
    const treatmentForeignKeys = treatmentConfig.foreignKeys.map((foreignKey) => {
      const reference = foreignKey.reference();

      return {
        name: foreignKey.getName(),
        columns: columnNames(reference.columns),
        foreignTable: getTableConfig(reference.foreignTable).name,
        foreignColumns: columnNames(reference.foreignColumns),
      };
    });
    const treatmentIndexes = treatmentConfig.indexes.map((index) => ({
      name: index.config.name,
      columns: columnNames(index.config.columns as NamedColumn[]),
    }));

    expect(treatmentColumns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'institution_id',
        'customer_id',
        'appointment_id',
        'treatment_date',
        'treatment_project',
        'treatment_category',
        'treatment_stage',
        'recovery_stage',
        'risk_level',
        'owner_user_id',
        'summary',
        'next_care_action',
        'tags',
        'voided_at',
        'voided_by',
        'void_reason_code',
        'void_reason',
        'created_at',
        'updated_at',
      ]),
    );
    expect(treatmentColumns).toHaveLength(21);
    expect(JSON.stringify(treatmentColumns)).not.toMatch(
      /treatment_record|medical_record|diagnosis_text|clinical_note|consultation_transcript|phone_number|id_number|request_body|metadata|raw_payload|ai_generated|external_sync|token|secret|database_url/i,
    );
    expect(treatmentSummaries.appointmentId.notNull).toBe(false);
    expect(treatmentSummaries.voidedAt.notNull).toBe(false);
    expect(treatmentSummaries.voidedBy.notNull).toBe(false);
    expect(treatmentSummaries.voidReasonCode.notNull).toBe(false);
    expect(treatmentSummaries.voidReason.notNull).toBe(false);
    expect(treatmentForeignKeys).toEqual(
      expect.arrayContaining([
        {
          name: 'treatment_summaries_tenant_customer_fk',
          columns: ['tenant_id', 'customer_id'],
          foreignTable: 'customers',
          foreignColumns: ['tenant_id', 'id'],
        },
        {
          name: 'treatment_summaries_tenant_appointment_fk',
          columns: ['tenant_id', 'appointment_id'],
          foreignTable: 'appointments',
          foreignColumns: ['tenant_id', 'id'],
        },
      ]),
    );
    expect(treatmentIndexes).toEqual(
      expect.arrayContaining([
        {
          name: 'treatment_summaries_tenant_customer_date_idx',
          columns: ['tenant_id', 'customer_id', 'treatment_date'],
        },
        {
          name: 'treatment_summaries_tenant_risk_date_idx',
          columns: ['tenant_id', 'risk_level', 'treatment_date'],
        },
        {
          name: 'treatment_summaries_tenant_appointment_idx',
          columns: ['tenant_id', 'appointment_id'],
        },
        {
          name: 'treatment_summaries_tenant_voided_date_idx',
          columns: ['tenant_id', 'voided_at', 'treatment_date'],
        },
      ]),
    );
  });

  it('预约表提供租户加预约 ID 复合唯一约束供治疗摘要校验同租户预约', () => {
    const appointmentUniqueConstraint = getTableConfig(appointments).uniqueConstraints.find(
      (constraint) => constraint.getName() === 'appointments_tenant_id_id_unique',
    );

    expect(appointmentUniqueConstraint).toBeDefined();
    expect(columnNames(appointmentUniqueConstraint?.columns ?? [])).toEqual(['tenant_id', 'id']);
  });

  it('审计事件支持最小 resource_id 关联和租户内目标资源索引', () => {
    const auditConfig = getTableConfig(auditEvents);
    const auditColumns = columnNames(auditConfig.columns);
    const auditIndexes = auditConfig.indexes.map((index) => ({
      name: index.config.name,
      columns: columnNames(index.config.columns as NamedColumn[]),
    }));

    expect(auditColumns).toContain('resource_id');
    expect(auditEvents.resourceId).toBeDefined();
    expect(auditEvents.resourceId.notNull).toBe(false);
    expect(auditIndexes).toEqual(
      expect.arrayContaining([
        {
          name: 'audit_events_tenant_resource_id_occurred_idx',
          columns: ['tenant_id', 'resource', 'resource_id', 'occurred_at'],
        },
      ]),
    );
  });

  it('平台 AI 模型配置提供持久化边界表和低敏索引', () => {
    const {
      platformAiModelConfigSnapshots,
    } = schema as typeof schema & {
      platformAiModelConfigSnapshots: typeof import('@/server/db/schema').platformAiModelConfigSnapshots;
    };
    const config = getTableConfig(platformAiModelConfigSnapshots);
    const columns = columnNames(config.columns);
    const indexes = config.indexes.map((index) => ({
      name: index.config.name,
      columns: columnNames(index.config.columns as NamedColumn[]),
    }));

    expect(columns).toEqual(
      expect.arrayContaining([
        'id',
        'scenario_defaults',
        'agent_inheritance',
        'model_states',
        'provider_states',
        'dry_run_results',
        'updated_by',
        'created_at',
        'updated_at',
      ]),
    );
    expect(columns).not.toContain('api_key');
    expect(columns).not.toContain('encrypted_api_key');
    expect(columns).not.toContain('ciphertext');
    expect(indexes).toEqual(
      expect.arrayContaining([
        {
          name: 'platform_ai_model_config_snapshots_updated_at_idx',
          columns: ['updated_at'],
        },
      ]),
    );
  });

  it('V0.6 AI credits schema 只新增内部计量字段并保留现有 calls/token 字段', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const aiCallUsageRecords = schemaModule.aiCallUsageRecords;
    const tenantPlanVersions = schemaModule.tenantPlanVersions;
    const tenantQuotaSnapshots = schemaModule.tenantQuotaSnapshots;
    const platformAiCreditMeteringRules = schemaModule.platformAiCreditMeteringRules;

    expect(aiCallUsageRecords).toBeDefined();
    expect(tenantPlanVersions).toBeDefined();
    expect(tenantQuotaSnapshots).toBeDefined();
    expect(platformAiCreditMeteringRules).toBeDefined();

    const usageColumns = columnNames(getTableConfig(aiCallUsageRecords as never).columns);
    const planVersionColumns = columnNames(getTableConfig(tenantPlanVersions as never).columns);
    const quotaColumns = columnNames(getTableConfig(tenantQuotaSnapshots as never).columns);
    const meteringRuleColumns = columnNames(getTableConfig(platformAiCreditMeteringRules as never).columns);
    const meteringRuleIndexes = getTableConfig(platformAiCreditMeteringRules as never).indexes.map((index) => ({
      name: index.config.name,
      columns: columnNames(index.config.columns as NamedColumn[]),
    }));

    expect(usageColumns).toEqual(
      expect.arrayContaining([
        'prompt_tokens',
        'completion_tokens',
        'total_tokens',
        'ai_credits_consumed',
        'metering_status',
        'metering_version',
        'metering_details',
      ]),
    );
    expect(planVersionColumns).toEqual(
      expect.arrayContaining(['monthly_ai_call_limit', 'monthly_ai_credit_limit']),
    );
    expect(quotaColumns).toEqual(
      expect.arrayContaining([
        'max_ai_calls',
        'current_ai_calls',
        'max_ai_credits',
        'current_ai_credits',
      ]),
    );
    expect(meteringRuleColumns).toEqual(
      expect.arrayContaining([
        'id',
        'provider',
        'model',
        'metering_version',
        'input_token_weight',
        'output_token_weight',
        'model_multiplier',
        'rag_credit_surcharge',
        'credits_per_standard_token_unit',
        'enabled',
        'effective_from',
        'effective_to',
        'created_at',
        'updated_at',
      ]),
    );
    expect(meteringRuleIndexes).toEqual(
      expect.arrayContaining([
        {
          name: 'platform_ai_credit_metering_rules_provider_model_version_unique_idx',
          columns: ['provider', 'model', 'metering_version'],
        },
      ]),
    );
    expect(meteringRuleColumns).not.toEqual(
      expect.arrayContaining([
        'api_key',
        'encrypted_api_key',
        'base_url',
        'authorization',
        'prompt',
        'answer',
        'raw_response',
        'provider_raw_response',
      ]),
    );
  });

  it('旧演示 tenant member 均由唯一且不可登录的 auth user 外键记录覆盖', () => {
    const authUsers = getDemoSeedAuthUserRecords();
    const members = getDemoTenantMemberSeedRecords();
    const authUserIds = authUsers.map((record) => record.id);
    const memberUserIds = members.map((record) => record.userId);
    const usernames = authUsers.map((record) => record.username);
    const demoSessionUsernames = new Set([
      'admin',
      'platform',
      'yunlan_admin',
      'baiyue_admin',
      'xinghe_admin',
      'yubai_admin',
      'chengxing_admin',
      'qingmang_admin',
    ]);

    expect(authUsers).toHaveLength(11);
    expect(new Set(authUserIds).size).toBe(authUsers.length);
    expect(new Set(usernames).size).toBe(authUsers.length);
    expect(new Set(memberUserIds)).toEqual(new Set(authUserIds));
    expect(members.filter((record) => !authUserIds.includes(record.userId))).toEqual([]);
    expect(authUsers.every((record) => !demoSessionUsernames.has(record.username))).toBe(true);
    expect(
      authUsers.every(
        (record) =>
          record.phone === null &&
          record.email === null &&
          record.passwordResetRequired === true &&
          record.status === 'disabled' &&
          record.lastLoginAt === null &&
          record.failedLoginCount === 0 &&
          record.lockedUntil === null &&
          record.createdBy === 'legacy-demo-seed-actor' &&
          record.updatedBy === 'legacy-demo-seed-actor' &&
          record.passwordUpdatedAt?.toISOString() === '2026-06-01T01:00:00.000Z' &&
          record.createdAt?.toISOString() === '2026-06-01T01:00:00.000Z' &&
          record.updatedAt?.toISOString() === '2026-06-01T01:00:00.000Z',
      ),
    ).toBe(true);
    expect(authUsers.map((record) => record.passwordHash).join('\n')).not.toMatch(
      /admin123|platform|yunlan_admin|chengxing_admin|\$2[aby]\$|argon2|scrypt|pbkdf2/i,
    );
  });

  it('旧 demo seed 写入口固定关闭且不读取传入数据库', async () => {
    const databaseAccess = vi.fn();
    const database = new Proxy(
      {},
      {
        get(_target, property) {
          databaseAccess(property);
          throw new Error('database_must_not_be_used');
        },
      },
    ) as TenantDatabase;

    await expect(seedDemoData.seedDemoData(database)).rejects.toThrow(
      demoSeedDatabaseWriteDisabledMessage,
    );
    await expect(seedDemoData.seedDemoData(database)).rejects.toThrow(
      demoSeedDatabaseWriteDisabledMessage,
    );

    expect(databaseAccess).not.toHaveBeenCalled();
  });

  it('旧演示客户数量和 admin、platform 会话映射保持不变', () => {
    const customers = getDemoCustomerSeedRecords();
    const admin = authenticateDemoUser({ username: 'admin', password: 'admin123' });
    const platform = authenticateDemoUser({
      username: 'platform',
      password: 'admin123',
      scope: 'platform',
    });

    expect(customers).toHaveLength(9);
    expect(
      customers.filter((record) => record.tenantId === 'growth-tenant-chengxing'),
    ).toHaveLength(8);
    expect(admin).toMatchObject({
      id: 'demo-user-admin',
      tenantId: 'growth-tenant-chengxing',
      institutionId: 'growth-inst-chengxing',
    });
    expect(platform).toMatchObject({
      id: 'demo-user-platform',
      role: 'platform_admin',
      tenantId: null,
      institutionId: null,
    });
  });

  it('演示 seed 记录不包含真实手机号、身份证号、数据库地址或访问密钥', () => {
    const allSeedRecords = [
      ...getDemoSeedAuthUserRecords(),
      ...getDemoTenantSeedRecords(),
      ...getDemoTenantPlanSeedRecords(),
      ...getDemoTenantPlanVersionSeedRecords(),
      ...getDemoTenantPlanAssignmentSeedRecords(),
      ...getDemoTenantAuthorizationSnapshotSeedRecords(),
      ...getDemoTenantQuotaSnapshotSeedRecords(),
      ...getDemoTenantCommercialRecordSeedRecords(),
      ...getDemoTenantMemberSeedRecords(),
      ...getDemoCustomerSeedRecords(),
      ...getSeedRecords('getDemoAppointmentSeedRecords'),
      ...seedDemoData.getDemoTreatmentSummarySeedRecords(),
      ...getSeedRecords('getDemoFollowUpTaskSeedRecords'),
      ...getSeedRecords('getDemoAuditEventSeedRecords'),
    ];

    expect(serializeSeedRecords(allSeedRecords)).not.toMatch(
      /\b1[3-9]\d{9}\b|[1-9]\d{16}[\dXx]|(?:postgres(?:ql)?|mysql):\/\/|api[_-]?key|access[_-]?token|bearer\s+|secret/i,
    );
  });

  it('演示种子数据覆盖预约和随访任务引用的同租户客户', () => {
    const customerKeys = new Set(
      getDemoCustomerSeedRecords().map((record) => `${record.tenantId}:${record.id}`),
    );
    const appointments = getSeedRecords<{ tenantId: string; customerId: string }>(
      'getDemoAppointmentSeedRecords',
    );
    const followUpTasks = getSeedRecords<{ tenantId: string; customerId: string }>(
      'getDemoFollowUpTaskSeedRecords',
    );
    const referencedCustomerKeys = [
      ...appointments.map(tenantCustomerKey),
      ...followUpTasks.map(tenantCustomerKey),
    ];

    expect(referencedCustomerKeys.filter((key) => !customerKeys.has(key))).toEqual([]);
  });

  it('商业试用初始化数据只包含三档套餐和六个虚拟机构', () => {
    const tenants = getDemoTenantSeedRecords();
    const plans = getDemoTenantPlanSeedRecords();
    const versions = getDemoTenantPlanVersionSeedRecords();
    const assignments = getDemoTenantPlanAssignmentSeedRecords();
    const quotaSnapshots = getDemoTenantQuotaSnapshotSeedRecords();
    const authorizationSnapshots = getDemoTenantAuthorizationSnapshotSeedRecords();
    const members = getDemoTenantMemberSeedRecords();
    const serialized = JSON.stringify({
      tenants,
      plans,
      versions,
      assignments,
      quotaSnapshots,
      authorizationSnapshots,
      members,
    });

    expect(plans.map((plan) => plan.code).sort()).toEqual([
      'growth-care',
      'starter-care',
      'trial-care',
    ]);
    expect(plans.map((plan) => plan.name).sort()).toEqual(['专业版', '基础版', '试用版']);
    expect(tenants.map((tenant) => tenant.id).sort()).toEqual([
      'growth-tenant-chengxing',
      'growth-tenant-qingmang',
      'starter-tenant-xinghe',
      'starter-tenant-yubai',
      'trial-tenant-baiyue',
      'trial-tenant-yunlan',
    ]);
    expect(tenants.every((tenant) => tenant.status === 'active')).toBe(true);
    expect(assignments).toHaveLength(6);
    expect(assignments.every((assignment) => typeof assignment.planVersionId === 'string')).toBe(
      true,
    );
    expect(quotaSnapshots).toHaveLength(6);
    expect(quotaSnapshots.every((snapshot) => snapshot.currentCustomers <= snapshot.maxCustomers)).toBe(
      true,
    );
    expect(quotaSnapshots.every((snapshot) => snapshot.currentAiCalls === 0)).toBe(true);
    expect(authorizationSnapshots).toHaveLength(6);
    expect(authorizationSnapshots.every((snapshot) => snapshot.status === 'active')).toBe(true);
    expect(versions.map((version) => version.displayName).sort()).toEqual([
      '专业版',
      '基础版',
      '试用版',
    ]);
    expect(members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'trial-tenant-yunlan',
          userId: 'trial-user-yunlan-admin',
          role: 'tenant_admin',
        }),
        expect.objectContaining({
          tenantId: 'growth-tenant-qingmang',
          userId: 'growth-user-qingmang-admin',
          role: 'tenant_admin',
        }),
      ]),
    );
    expect(serialized).not.toContain('Enterprise');
    expect(serialized).not.toContain('集团版');
    expect(serialized).not.toContain('demo-tenant-004');
    expect(serialized).not.toContain('Growth Plan');
    expect(serialized).not.toMatch(sensitiveDemoSeedPattern);
  });

  it('演示种子数据包含只读商业化预留记录', () => {
    const tenants = new Set(getSeedRecords<{ id: string }>('getDemoTenantSeedRecords').map((tenant) => tenant.id));
    const commercialRecords = getSeedRecords<{
      tenantId: string;
      recordType: string;
      status: string;
      displayCode: string;
      displayAmount: string | null;
      periodLabel: string | null;
      note: string | null;
    }>('getDemoTenantCommercialRecordSeedRecords');
    const recordTypes = new Set(commercialRecords.map((record) => record.recordType));
    const allowedStatuses = new Set(['draft', 'pending', 'manual_review', 'completed', 'cancelled']);

    expect(recordTypes).toEqual(new Set(['order', 'contract', 'invoice', 'payment']));
    expect(commercialRecords.length).toBeGreaterThanOrEqual(4);
    expect(
      commercialRecords.every(
        (record) =>
          tenants.has(record.tenantId) &&
          allowedStatuses.has(record.status) &&
          Boolean(record.displayCode) &&
          Boolean(record.periodLabel),
      ),
    ).toBe(true);
    expect(serializeSeedRecords(commercialRecords)).not.toMatch(sensitiveDemoSeedPattern);
    expect(serializeSeedRecords(commercialRecords)).not.toMatch(
      /真实支付|真实扣费|立即支付|自动扣费|自动续费|银行卡|第三方支付|stripe|支付宝|微信支付|payment_token|webhook_secret|api_key|DATABASE_URL/i,
    );
  });

  it('演示种子数据包含虚构客户和预约演示场景', () => {
    const customers = getDemoCustomerSeedRecords();
    const appointments = getSeedRecords<{
      tenantId: string;
      customerId: string;
      status: string;
      project: string;
    }>('getDemoAppointmentSeedRecords');

    expect(customers.map((customer) => customer.displayName)).toEqual(
      expect.arrayContaining([
        '沈知夏',
        '许若宁',
        '顾安然',
        '梁思语',
        '陆清禾',
        '程晚晴',
        '叶舒颜',
        '唐以沫',
      ]),
    );
    expect(appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ project: '面诊预约', status: 'pending_confirmation' }),
        expect.objectContaining({ project: '光子嫩肤治疗', status: 'completed' }),
        expect.objectContaining({ project: '水光复诊', status: 'confirmed' }),
        expect.objectContaining({ status: 'cancelled' }),
      ]),
    );
  });

  it('正式 demo customer seed 使用明确且非空的机构归属', () => {
    const customerRecords = getDemoCustomerSeedRecords();
    const institutionByTenant = new Map([
      ['growth-tenant-chengxing', 'growth-inst-chengxing'],
      ['starter-tenant-xinghe', 'starter-inst-xinghe'],
    ]);

    expect(
      customerRecords.every(
        (record) =>
          typeof record.institutionId === 'string' && record.institutionId.length > 0,
      ),
    ).toBe(true);
    expect(
      customerRecords.every(
        (record) => institutionByTenant.get(record.tenantId) === record.institutionId,
      ),
    ).toBe(true);
    expect(
      customerRecords
        .filter((record) => record.tenantId === 'growth-tenant-chengxing')
        .every((record) => record.institutionId === 'growth-inst-chengxing'),
    ).toBe(true);
    expect(
      customerRecords
        .filter((record) => record.tenantId === 'starter-tenant-xinghe')
        .every((record) => record.institutionId === 'starter-inst-xinghe'),
    ).toBe(true);
    expect(JSON.stringify(customerRecords)).not.toMatch(
      /\b1[3-9]\d{9}\b|secret|access[_-]?token|api[_-]?key/i,
    );
  });

  it('演示种子数据覆盖 active、edited、voided 治疗摘要和来源随访任务', () => {
    const summaries = seedDemoData.getDemoTreatmentSummarySeedRecords();
    const followUpTasks = getSeedRecords<{
      id: string;
      tenantId: string;
      customerId: string;
      status: string;
      sourceTreatmentSummaryId: string | null;
      sourceSuggestionKey: string | null;
    }>('getDemoFollowUpTaskSeedRecords');

    expect(summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'TS-001',
          customerId: 'demo-customer-shen-zhixia',
          treatmentProject: '光子嫩肤',
          voidedAt: null,
        }),
        expect.objectContaining({
          id: 'TS-005',
          customerId: 'demo-customer-ye-shuyan',
          voidedAt: expect.any(Date),
          voidedBy: 'demo-user-admin',
          voidReason: expect.stringContaining('保留历史追溯'),
        }),
        expect.objectContaining({
          id: 'TS-006',
          customerId: 'demo-customer-tang-yimo',
          riskLevel: 'watch',
        }),
      ]),
    );
    expect(followUpTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceTreatmentSummaryId: 'TS-001',
          status: 'due',
        }),
        expect.objectContaining({
          sourceTreatmentSummaryId: 'TS-006',
          sourceSuggestionKey: expect.stringContaining('TS-006:'),
        }),
        expect.objectContaining({ status: 'completed' }),
        expect.objectContaining({ status: 'due' }),
      ]),
    );
  });

  it('演示种子数据包含安全审计事件且不含敏感字段', () => {
    const auditSeedEvents = getSeedRecords<{
      eventId: string;
      resource: string;
      action: string;
      result: string;
      reason: string;
    }>('getDemoAuditEventSeedRecords');
    const allSeedRecords = [
      ...getSeedRecords('getDemoTenantSeedRecords'),
      ...getDemoCustomerSeedRecords(),
      ...getSeedRecords('getDemoAppointmentSeedRecords'),
      ...seedDemoData.getDemoTreatmentSummarySeedRecords(),
      ...getSeedRecords('getDemoFollowUpTaskSeedRecords'),
      ...auditSeedEvents,
    ];

    expect(auditSeedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resource: 'customer', action: 'create', result: 'allowed' }),
        expect.objectContaining({ resource: 'appointment', action: 'create', result: 'allowed' }),
        expect.objectContaining({
          resource: 'treatment_summary',
          action: 'create',
          result: 'allowed',
        }),
        expect.objectContaining({
          resource: 'treatment_summary',
          action: 'update',
          result: 'allowed',
        }),
        expect.objectContaining({
          resource: 'treatment_summary',
          action: 'update',
          result: 'allowed',
          reason: 'treatment_summary_voided',
        }),
        expect.objectContaining({ resource: 'follow_up', action: 'update', result: 'allowed' }),
        expect.objectContaining({ result: 'denied', reason: 'role_denied' }),
        expect.objectContaining({ result: 'denied', reason: 'quota_exceeded_appointments' }),
      ]),
    );
    expect(serializeSeedRecords(allSeedRecords)).not.toMatch(sensitiveDemoSeedPattern);
  });

  it('演示 seed 数据库写入口已物理移除且保持固定关闭', () => {
    const seedSource = readFileSync(join(process.cwd(), 'src/server/db/seed-demo-data.ts'), 'utf8');

    expect(seedSource).toContain('demoSeedDatabaseWriteDisabledMessage');
    expect(seedSource).not.toContain('.insert(tenantMembers)');
    expect(seedSource).not.toContain('.update(tenantMembers)');
    expect(seedSource).not.toContain('.delete(tenantMembers)');
    expect(seedSource).not.toContain('cleanupLegacyDemoSeedRecords');
    expect(seedSource).not.toContain('dependencies.createPostgresClient(');
    expect(seedSource).not.toContain('dependencies.createDatabase(');
  });

  it('静态 demo fixture 保留，但不再携带旧 Membership 清理路径', () => {
    const seedSource = readFileSync(join(process.cwd(), 'src/server/db/seed-demo-data.ts'), 'utf8');
    const membershipPreviewRecords = getDemoTenantMemberSeedRecords();

    expect(getDemoTenantSeedRecords()).not.toHaveLength(0);
    expect(membershipPreviewRecords).not.toHaveLength(0);
    expect(seedSource).not.toContain('tenantMembers.$inferInsert');
    for (const record of membershipPreviewRecords) {
      expect(Object.keys(record).sort()).toEqual([
        'displayName',
        'id',
        'role',
        'tenantId',
        'userId',
      ]);
    }
    expect(seedSource).not.toContain('legacyDemoTenantIds');
    expect(seedSource).not.toContain('legacyDemoPlanIds');
    expect(seedSource).not.toContain('legacyDemoPlanVersionIds');
  });

  it('演示 seed 不写入 HIS 连接配置或凭证引用数据', () => {
    const seedSource = readFileSync(join(process.cwd(), 'src/server/db/seed-demo-data.ts'), 'utf8');

    expect(seedSource).not.toMatch(
      /hisConnections|his_connections|credentialRef|credential_ref|raw_payload|request_body|response_body|token|secret|api_key|oauth|basic_auth|signing_key|private_key|connection_string/i,
    );
  });

  it('演示种子数据包含安全的治疗结构化摘要并保持同租户引用', () => {
    const seedModule = seedDemoData as typeof seedDemoData & Record<string, unknown>;
    const getDemoTreatmentSummarySeedRecords =
      seedModule.getDemoTreatmentSummarySeedRecords as
        | (() => Array<Record<string, unknown>>)
        | undefined;

    expect(getDemoTreatmentSummarySeedRecords).toBeDefined();

    const treatmentSummaries = getDemoTreatmentSummarySeedRecords?.() ?? [];
    const customerKeys = new Set(
      getDemoCustomerSeedRecords().map((record) => `${record.tenantId}:${record.id}`),
    );
    const appointmentKeys = new Set(
      getSeedRecords<{ tenantId: string; id: string }>('getDemoAppointmentSeedRecords').map(
        (record) => `${record.tenantId}:${record.id}`,
      ),
    );
    const serialized = JSON.stringify(treatmentSummaries);

    expect(treatmentSummaries.length).toBeGreaterThan(0);
    expect(
      treatmentSummaries.every(
        (summary) =>
          typeof summary.tenantId === 'string' &&
          typeof summary.customerId === 'string' &&
          typeof summary.treatmentProject === 'string' &&
          typeof summary.summary === 'string' &&
          customerKeys.has(`${summary.tenantId}:${summary.customerId}`),
      ),
    ).toBe(true);
    expect(
      treatmentSummaries
        .filter((summary) => summary.appointmentId)
        .every((summary) =>
          appointmentKeys.has(`${summary.tenantId}:${summary.appointmentId as string}`),
        ),
    ).toBe(true);
    expect(serialized).not.toMatch(/1[3-9]\d{9}|\d{17}[\dxX]/);
    expect(serialized).not.toMatch(
      /完整治疗记录正文|完整病历正文|诊疗原文|咨询对话全文|phoneNumber|idNumber|medicalRecordNo|treatmentRecord|medicalRecordBody|diagnosisText|clinicalNote|consultationTranscript|requestBody|rawPayload|aiGenerated|externalSync|DATABASE_URL|secret|token/i,
    );
  });

  it('迁移不包含真实个人信息字段名', () => {
    const migrationSql = readMigrationSql();

    expect(migrationSql).not.toContain('"phone_number"');
    expect(migrationSql).not.toContain('"id_number"');
    expect(migrationSql).not.toContain('"medical_record_no"');
    expect(migrationSql).not.toContain('"treatment_record"');
    expect(migrationSql).not.toContain('"consultation_transcript"');
    expect(Array.from(migrationSql.matchAll(/"metadata" jsonb/g))).toHaveLength(2);
    expect(migrationSql).toContain('create table "homepage_brand_audit_logs"');
    expect(migrationSql).toContain('"metadata" jsonb default \'{}\'::jsonb not null');
    expect(migrationSql).not.toContain('"request_body"');
  });

  it('迁移包含审计 resource_id 字段和查询索引', () => {
    const migrationSql = readMigrationSql();

    expect(migrationSql).toContain(
      'alter table "audit_events" add column "resource_id" varchar(96)',
    );
    expect(migrationSql).toContain(
      'create index "audit_events_tenant_resource_id_occurred_idx" on "audit_events" using btree ("tenant_id","resource","resource_id","occurred_at")',
    );
  });

  it('迁移包含平台租户套餐、分配和配额快照表', () => {
    const migrationSql = readMigrationSql();

    expect(migrationSql).toContain('create table "tenant_plans"');
    expect(migrationSql).toContain('create table "tenant_plan_assignments"');
    expect(migrationSql).toContain('create table "tenant_quota_snapshots"');
    expect(migrationSql).toContain(
      'alter table "tenant_plan_assignments" add constraint "tenant_plan_assignments_tenant_id_tenants_id_fk" foreign key ("tenant_id") references "public"."tenants"("id")',
    );
    expect(migrationSql).toContain(
      'alter table "tenant_plan_assignments" add constraint "tenant_plan_assignments_plan_id_tenant_plans_id_fk" foreign key ("plan_id") references "public"."tenant_plans"("id")',
    );
    expect(migrationSql).toContain(
      'alter table "tenant_quota_snapshots" add constraint "tenant_quota_snapshots_tenant_id_tenants_id_fk" foreign key ("tenant_id") references "public"."tenants"("id")',
    );
    expect(migrationSql).toContain(
      'alter table "tenant_quota_snapshots" add constraint "tenant_quota_snapshots_plan_assignment_id_tenant_plan_assignments_id_fk" foreign key ("plan_assignment_id") references "public"."tenant_plan_assignments"("id")',
    );
    expect(migrationSql).toContain(
      'create index "tenant_plan_assignments_tenant_status_idx" on "tenant_plan_assignments" using btree ("tenant_id","status")',
    );
    expect(migrationSql).toContain(
      'create index "tenant_quota_snapshots_tenant_snapshot_idx" on "tenant_quota_snapshots" using btree ("tenant_id","snapshot_at")',
    );
  });

  it('迁移包含平台套餐商业化闭环基础表且不包含真实支付敏感字段', () => {
    const migrationSql = readMigrationSql('platform_plan_commercialization_v1_schema');
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8'),
    ) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    expect(migrationSql).toContain('create type "public"."tenant_plan_version_status"');
    expect(migrationSql).toContain('create type "public"."tenant_authorization_snapshot_status"');
    expect(migrationSql).toContain('create type "public"."tenant_plan_change_status"');
    expect(migrationSql).toContain('create type "public"."tenant_commercial_record_type"');
    expect(migrationSql).toContain('create type "public"."tenant_commercial_record_status"');
    expect(migrationSql).toContain('create table "tenant_plan_versions"');
    expect(migrationSql).toContain('create table "tenant_authorization_snapshots"');
    expect(migrationSql).toContain('create table "tenant_plan_change_records"');
    expect(migrationSql).toContain('create table "tenant_commercial_records"');
    expect(migrationSql).toContain(
      'alter table "tenant_plan_assignments" add column "plan_version_id" varchar(64)',
    );
    expect(migrationSql).toContain(
      'alter table "tenant_plan_assignments" add constraint "tenant_plan_assignments_plan_version_id_tenant_plan_versions_id_fk" foreign key ("plan_version_id") references "public"."tenant_plan_versions"("id")',
    );
    expect(migrationSql).toContain(
      'alter table "tenant_authorization_snapshots" add constraint "tenant_authorization_snapshots_plan_version_id_tenant_plan_versions_id_fk" foreign key ("plan_version_id") references "public"."tenant_plan_versions"("id")',
    );
    expect(migrationSql).toContain(
      'create unique index "tenant_plan_versions_plan_version_code_unique_idx" on "tenant_plan_versions" using btree ("plan_id","version_code")',
    );
    expect(migrationSql).toContain(
      'create unique index "tenant_authorization_snapshots_active_tenant_unique_idx" on "tenant_authorization_snapshots" using btree ("tenant_id") where "tenant_authorization_snapshots"."status" = \'active\'',
    );
    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idx: 19,
          tag: '0019_platform_plan_commercialization_v1_schema',
        }),
      ]),
    );
    expect(migrationSql).not.toMatch(
      /stripe|payment_token|webhook_secret|card_number|contract_body|invoice_tax_no|client_secret|api_key|encrypted_api_key|ciphertext|auth_tag/i,
    );
  });

  it('迁移包含平台 AI 模型配置持久化候选表且不包含密钥字段', () => {
    const migrationSql = readMigrationSql('ai_model_config_persistence');

    expect(migrationSql).toContain('create table "platform_ai_model_config_snapshots"');
    expect(migrationSql).toContain('"scenario_defaults" jsonb not null');
    expect(migrationSql).toContain('"agent_inheritance" jsonb not null');
    expect(migrationSql).toContain('"model_states" jsonb not null');
    expect(migrationSql).toContain('"provider_states" jsonb not null');
    expect(migrationSql).toContain('"dry_run_results" jsonb not null');
    expect(migrationSql).toContain(
      'create index "platform_ai_model_config_snapshots_updated_at_idx" on "platform_ai_model_config_snapshots" using btree ("updated_at")',
    );
    expect(migrationSql).not.toContain('api_key');
    expect(migrationSql).not.toContain('encrypted_api_key');
    expect(migrationSql).not.toContain('ciphertext');
    expect(migrationSql).not.toContain('auth_tag');
  });

  it('V0.6 AI credits 迁移只新增 additive 计量结构且不包含敏感字段或 backfill', () => {
    const migrationSql = readMigrationSql('v06_ai_credits_metering_schema');
    const journal = JSON.parse(readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    expect(migrationSql).toContain('create table "platform_ai_credit_metering_rules"');
    expect(migrationSql).toContain('"provider" varchar(64) not null');
    expect(migrationSql).toContain('"model" varchar(128) not null');
    expect(migrationSql).toContain('"metering_version" varchar(64) not null');
    expect(migrationSql).toContain('"input_token_weight" numeric(12, 6) not null');
    expect(migrationSql).toContain('"output_token_weight" numeric(12, 6) not null');
    expect(migrationSql).toContain('"model_multiplier" numeric(12, 6) not null');
    expect(migrationSql).toContain('"rag_credit_surcharge" integer not null');
    expect(migrationSql).toContain('"credits_per_standard_token_unit" integer not null');
    expect(migrationSql).toContain('"enabled" boolean not null');
    expect(migrationSql).toContain('"effective_from" timestamp with time zone not null');
    expect(migrationSql).toContain('"effective_to" timestamp with time zone');
    expect(migrationSql).toContain(
      'alter table "ai_call_usage_records" add column "ai_credits_consumed" integer',
    );
    expect(migrationSql).toContain(
      'alter table "ai_call_usage_records" add column "metering_status" varchar(32)',
    );
    expect(migrationSql).toContain(
      'alter table "ai_call_usage_records" add column "metering_version" varchar(64)',
    );
    expect(migrationSql).toContain(
      'alter table "ai_call_usage_records" add column "metering_details" jsonb',
    );
    expect(migrationSql).toContain(
      'alter table "tenant_plan_versions" add column "monthly_ai_credit_limit" integer',
    );
    expect(migrationSql).toContain(
      'alter table "tenant_quota_snapshots" add column "max_ai_credits" integer',
    );
    expect(migrationSql).toContain(
      'alter table "tenant_quota_snapshots" add column "current_ai_credits" integer',
    );
    expect(migrationSql).toContain(
      'create unique index "platform_ai_credit_metering_rules_provider_model_version_unique_idx" on "platform_ai_credit_metering_rules" using btree ("provider","model","metering_version")',
    );
    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ idx: 25, tag: '0025_v06_ai_credits_metering_schema' }),
      ]),
    );
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b|\bdrop\s+column\b|\balter\s+column\b|\brename\b/i);
    expect(migrationSql).not.toMatch(/\bdelete\s+from\b|\binsert\s+into\b|(^|;)\s*update\s+/i);
    expect(migrationSql).not.toMatch(
      /api_key|apikey|encrypted_api_key|base_url|authorization|bearer|prompt\b|answer\b|raw_response|provider_raw_response|ciphertext|auth_tag|secret|database_url/i,
    );
  });

  it('V0.6 AI usage 服务项目 schema 只新增低敏 nullable 字段', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const aiCallUsageRecords = schemaModule.aiCallUsageRecords;
    const migrationSql = readMigrationSql('v06_ai_usage_service_project_fields');
    const journal = JSON.parse(readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    expect(aiCallUsageRecords).toBeDefined();

    const usageColumns = columnNames(getTableConfig(aiCallUsageRecords as never).columns);

    expect(usageColumns).toEqual(
      expect.arrayContaining([
        'service_category',
        'service_name',
        'service_source',
        'service_action',
        'service_version',
      ]),
    );
    expect(migrationSql).toContain(
      'alter table "ai_call_usage_records" add column "service_category" varchar(64)',
    );
    expect(migrationSql).toContain(
      'alter table "ai_call_usage_records" add column "service_name" varchar(128)',
    );
    expect(migrationSql).toContain(
      'alter table "ai_call_usage_records" add column "service_source" varchar(96)',
    );
    expect(migrationSql).toContain(
      'alter table "ai_call_usage_records" add column "service_action" varchar(96)',
    );
    expect(migrationSql).toContain(
      'alter table "ai_call_usage_records" add column "service_version" varchar(64)',
    );
    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ idx: 26, tag: '0026_v06_ai_usage_service_project_fields' }),
      ]),
    );
    expect(migrationSql).not.toMatch(/\bnot\s+null\b|\bdefault\b/i);
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b|\bdrop\s+column\b|\balter\s+column\b|\brename\b/i);
    expect(migrationSql).not.toMatch(/\bdelete\s+from\b|\binsert\s+into\b|(^|;)\s*update\s+/i);
    expect(migrationSql).not.toMatch(
      /api_key|apikey|encrypted_api_key|base_url|authorization|cookie|bearer|token\b|prompt\b|question\b|answer\b|raw_response|provider_raw_response|metadata|metering_details|signed_url|storage_key|secret|database_url/i,
    );
  });

  it('迁移包含租户客户一致性的复合外键', () => {
    const migrationSql = readMigrationSql();

    expect(migrationSql).toContain(
      'alter table "appointments" add constraint "appointments_tenant_customer_fk" foreign key ("tenant_id","customer_id") references "public"."customers"("tenant_id","id")',
    );
    expect(migrationSql).toContain(
      'alter table "follow_up_tasks" add constraint "follow_up_tasks_tenant_customer_fk" foreign key ("tenant_id","customer_id") references "public"."customers"("tenant_id","id")',
    );
  });

  it('迁移只新增治疗摘要表、必要索引和外键且不包含敏感字段', () => {
    const migrationSql = readMigrationSql('phase12_treatment_summaries');

    expect(migrationSql).toContain('create table "treatment_summaries"');
    expect(migrationSql).toContain(
      'alter table "appointments" add constraint "appointments_tenant_id_id_unique" unique("tenant_id","id")',
    );
    expect(migrationSql).toContain(
      'alter table "treatment_summaries" add constraint "treatment_summaries_tenant_id_tenants_id_fk" foreign key ("tenant_id") references "public"."tenants"("id")',
    );
    expect(migrationSql).toContain(
      'alter table "treatment_summaries" add constraint "treatment_summaries_tenant_customer_fk" foreign key ("tenant_id","customer_id") references "public"."customers"("tenant_id","id")',
    );
    expect(migrationSql).toContain(
      'alter table "treatment_summaries" add constraint "treatment_summaries_tenant_appointment_fk" foreign key ("tenant_id","appointment_id") references "public"."appointments"("tenant_id","id")',
    );
    expect(migrationSql).toContain(
      'create index "treatment_summaries_tenant_customer_date_idx" on "treatment_summaries" using btree ("tenant_id","customer_id","treatment_date")',
    );
    expect(migrationSql).toContain(
      'create index "treatment_summaries_tenant_risk_date_idx" on "treatment_summaries" using btree ("tenant_id","risk_level","treatment_date")',
    );
    expect(migrationSql).toContain(
      'create index "treatment_summaries_tenant_appointment_idx" on "treatment_summaries" using btree ("tenant_id","appointment_id")',
    );
    expect(migrationSql.indexOf('appointments_tenant_id_id_unique')).toBeLessThan(
      migrationSql.indexOf('treatment_summaries_tenant_appointment_fk'),
    );
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b|\bdrop\s+column\b|\balter\s+column\b/i);
    expect(migrationSql).not.toMatch(
      /phone_number|id_number|medical_record_no|treatment_record|medical_record_body|diagnosis_text|clinical_note|consultation_transcript|request_body|metadata|raw_payload|ai_generated|external_sync|token|secret|database_url/i,
    );
  });

  it('Phase 15 迁移只新增随访来源关联字段、约束和索引', () => {
    const migrationSql = readMigrationSql('phase15_followup_source_link');
    const journal = JSON.parse(readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const latestSnapshot = readFileSync(
      join(process.cwd(), 'drizzle/meta/0004_snapshot.json'),
      'utf8',
    ).toLowerCase();

    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ idx: 4, tag: '0004_phase15_followup_source_link' }),
      ]),
    );
    expect(latestSnapshot).toContain('"source_treatment_summary_id"');
    expect(latestSnapshot).toContain('"source_suggestion_key"');
    expect(migrationSql).toContain(
      'alter table "treatment_summaries" add constraint "treatment_summaries_tenant_id_id_unique" unique("tenant_id","id")',
    );
    expect(migrationSql).toContain(
      'alter table "follow_up_tasks" add column "source_treatment_summary_id" varchar(64)',
    );
    expect(migrationSql).toContain(
      'alter table "follow_up_tasks" add column "source_suggestion_key" varchar(180)',
    );
    expect(migrationSql).toContain(
      'alter table "follow_up_tasks" add constraint "follow_up_tasks_tenant_source_treatment_summary_fk" foreign key ("tenant_id","source_treatment_summary_id") references "public"."treatment_summaries"("tenant_id","id")',
    );
    expect(migrationSql).toContain(
      'create index "follow_up_tasks_tenant_source_treatment_summary_idx" on "follow_up_tasks" using btree ("tenant_id","source_treatment_summary_id")',
    );
    expect(migrationSql).toContain(
      'create unique index "follow_up_tasks_active_source_unique_idx" on "follow_up_tasks" using btree ("tenant_id","source_treatment_summary_id","source_suggestion_key")',
    );
    expect(migrationSql).toContain(
      'where "follow_up_tasks"."source_treatment_summary_id" is not null and "follow_up_tasks"."source_suggestion_key" is not null and "follow_up_tasks"."status" not in (\'completed\',\'cancelled\')',
    );
    expect(migrationSql.indexOf('treatment_summaries_tenant_id_id_unique')).toBeLessThan(
      migrationSql.indexOf('follow_up_tasks_tenant_source_treatment_summary_fk'),
    );
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b|\bdrop\s+column\b|\balter\s+column\b/i);
    expect(migrationSql).not.toMatch(
      /phone_number|id_number|medical_record_no|treatment_record|medical_record_body|diagnosis_text|clinical_note|consultation_transcript|request_body|metadata|raw_payload|ai_generated|external_sync|token|secret|database_url/i,
    );
  });

  it('Phase 19 迁移只新增治疗摘要作废字段和必要索引', () => {
    const migrationSql = readMigrationSql('phase19_treatment_summary_void');
    const journal = JSON.parse(readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const latestSnapshot = readFileSync(
      join(process.cwd(), 'drizzle/meta/0005_snapshot.json'),
      'utf8',
    ).toLowerCase();

    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ idx: 5, tag: '0005_phase19_treatment_summary_void' }),
      ]),
    );
    expect(latestSnapshot).toContain('"voided_at"');
    expect(latestSnapshot).toContain('"voided_by"');
    expect(latestSnapshot).toContain('"void_reason_code"');
    expect(latestSnapshot).toContain('"void_reason"');
    expect(migrationSql).toContain(
      'alter table "treatment_summaries" add column "voided_at" timestamp with time zone',
    );
    expect(migrationSql).toContain(
      'alter table "treatment_summaries" add column "voided_by" varchar(96)',
    );
    expect(migrationSql).toContain(
      'alter table "treatment_summaries" add column "void_reason_code" varchar(64)',
    );
    expect(migrationSql).toContain(
      'alter table "treatment_summaries" add column "void_reason" varchar(200)',
    );
    expect(migrationSql).toContain(
      'create index "treatment_summaries_tenant_voided_date_idx" on "treatment_summaries" using btree ("tenant_id","voided_at","treatment_date")',
    );
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b|\bdrop\s+column\b|\balter\s+column\b/i);
    expect(migrationSql).not.toMatch(/\bdelete\s+from\b|\bupdate\s+treatment_summaries\b/i);
    expect(migrationSql).not.toMatch(
      /phone_number|id_number|medical_record_no|treatment_record|medical_record_body|diagnosis_text|clinical_note|consultation_transcript|request_body|metadata|raw_payload|ai_generated|external_sync|token|secret|database_url/i,
    );
  });

  it('HIS 连接配置迁移只新增安全元数据表、状态枚举、索引和约束', () => {
    const migrationSql = readMigrationSql('his_connections');
    const journal = JSON.parse(readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const latestSnapshot = readFileSync(
      join(process.cwd(), 'drizzle/meta/0006_snapshot.json'),
      'utf8',
    ).toLowerCase();

    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ idx: 6, tag: '0006_his_connections' }),
      ]),
    );
    expect(latestSnapshot).toContain('"his_connections"');
    expect(latestSnapshot).toContain('"credential_ref"');
    expect(latestSnapshot).toContain('"revoked_at"');
    expect(latestSnapshot).toContain('"deleted_at"');
    expect(migrationSql).toContain(
      'create type "public"."his_connection_status" as enum(\'draft\', \'active\', \'paused\', \'revoked\', \'deleted\', \'error\')',
    );
    expect(migrationSql).toContain(
      'create type "public"."his_connection_health_status" as enum(\'unknown\', \'healthy\', \'degraded\', \'failed\')',
    );
    expect(migrationSql).toContain('create table "his_connections"');
    expect(migrationSql).toContain('"credential_ref" varchar(128)');
    expect(migrationSql).toContain('"revoked_at" timestamp with time zone');
    expect(migrationSql).toContain('"deleted_at" timestamp with time zone');
    expect(migrationSql).toContain(
      'constraint "his_connections_tenant_id_id_unique" unique("tenant_id","id")',
    );
    expect(migrationSql).toContain(
      'alter table "his_connections" add constraint "his_connections_tenant_id_tenants_id_fk" foreign key ("tenant_id") references "public"."tenants"("id")',
    );
    expect(migrationSql).toContain(
      'create index "his_connections_tenant_idx" on "his_connections" using btree ("tenant_id")',
    );
    expect(migrationSql).toContain(
      'create index "his_connections_tenant_status_idx" on "his_connections" using btree ("tenant_id","status")',
    );
    expect(migrationSql).toContain(
      'create index "his_connections_tenant_source_system_idx" on "his_connections" using btree ("tenant_id","source_system")',
    );
    expect(migrationSql).toContain(
      'create index "his_connections_tenant_deleted_at_idx" on "his_connections" using btree ("tenant_id","deleted_at")',
    );
    expect(migrationSql).toContain(
      'create index "his_connections_tenant_credential_ref_idx" on "his_connections" using btree ("tenant_id","credential_ref")',
    );
    expect(migrationSql).toContain(
      'create index "his_connections_tenant_last_checked_at_idx" on "his_connections" using btree ("tenant_id","last_checked_at")',
    );
    expect(migrationSql).toContain(
      'create unique index "his_connections_active_name_unique_idx" on "his_connections" using btree ("tenant_id","connection_name")',
    );
    expect(migrationSql).toContain('where "his_connections"."deleted_at" is null');
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b|\bdrop\s+column\b|\balter\s+column\b/i);
    expect(migrationSql).not.toMatch(/\bdelete\s+from\b|\binsert\s+into\b|(^|;)\s*update\s+/i);
    expect(migrationSql).not.toMatch(
      /phone_number|id_number|medical_record_no|raw_payload|request_body|response_body|treatment_record|medical_record_body|diagnosis_text|clinical_note|consultation_transcript|image_original|file_original|credential_secret|credential_value|credential_plaintext|token|secret|api_key|oauth|basic_auth|signing_key|private_key|connection_string|database_url|"sql"|"stack"/i,
    );
  });

  it('迁移包含正式租户账号和联系人表且不保存明文密码或请求细节', () => {
    const migrationSql = readMigrationSql('tenant_formal_accounts');
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8'),
    ) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idx: 20,
          tag: '0020_tenant_formal_accounts',
        }),
      ]),
    );
    expect(migrationSql).toContain('alter type "public"."tenant_status" add value \'trialing\'');
    expect(migrationSql).toContain('alter type "public"."tenant_status" add value \'expired\'');
    expect(migrationSql).toContain('create type "public"."auth_account_status"');
    expect(migrationSql).toContain('create table "auth_users"');
    expect(migrationSql).toContain('"password_hash" text not null');
    expect(migrationSql).toContain('"password_reset_required" boolean default true not null');
    expect(migrationSql).toContain('"failed_login_count" integer default 0 not null');
    expect(migrationSql).toContain('create table "tenant_contacts"');
    expect(migrationSql).toContain(
      'alter table "tenant_members" add constraint "tenant_members_user_id_auth_users_id_fk" foreign key ("user_id") references "public"."auth_users"("id")',
    );
    expect(migrationSql).toContain(
      'alter table "tenant_contacts" add constraint "tenant_contacts_tenant_id_tenants_id_fk" foreign key ("tenant_id") references "public"."tenants"("id")',
    );
    expect(migrationSql).toContain(
      'alter table "tenant_contacts" add constraint "tenant_contacts_initial_admin_user_id_auth_users_id_fk" foreign key ("initial_admin_user_id") references "public"."auth_users"("id")',
    );
    expect(migrationSql).toContain(
      'create unique index "auth_users_username_unique_idx" on "auth_users" using btree ("username")',
    );
    expect(migrationSql).toContain(
      'create unique index "tenant_contacts_tenant_unique_idx" on "tenant_contacts" using btree ("tenant_id")',
    );
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b|\bdrop\s+column\b|\balter\s+column\b/i);
    expect(migrationSql).not.toMatch(/\bdelete\s+from\b|\binsert\s+into\b|(^|;)\s*update\s+/i);
    expect(migrationSql).not.toMatch(
      /plain_password|password_plaintext|temporary_password|request_body|response_body|raw_payload|credential_secret|credential_plaintext|token|secret|api_key|oauth|basic_auth|signing_key|private_key|connection_string|database_url|"sql"|"stack"/i,
    );
  });

  it('HIS 连接配置凭证补偿 metadata / operationId 迁移只新增安全状态承载表', () => {
    const migrationSql = readMigrationSql('compensation_metadata_operationid');
    const journal = JSON.parse(readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const latestSnapshot = readFileSync(
      join(process.cwd(), 'drizzle/meta/0007_snapshot.json'),
      'utf8',
    ).toLowerCase();

    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idx: 7,
          tag: '0007_phase23_his_connection_credential_compensation_metadata_operationid',
        }),
      ]),
    );
    expect(latestSnapshot).toContain(
      '"his_connection_credential_compensation_operations"',
    );
    expect(latestSnapshot).toContain('"operation_id"');
    expect(latestSnapshot).toContain('"manual_review_required"');
    expect(migrationSql).toContain(
      'create type "public"."his_connection_credential_compensation_state" as enum(\'compensation_pending\', \'compensation_running\', \'compensation_succeeded\', \'compensation_failed\', \'manual_review_required\')',
    );
    expect(migrationSql).toContain(
      'create type "public"."his_connection_credential_compensation_operation_type" as enum(\'credential_compensation\')',
    );
    expect(migrationSql).toContain(
      'create type "public"."his_connection_credential_provider_failure_category" as enum(\'provider_unavailable\', \'timeout\', \'retry_exhausted\', \'circuit_open\', \'validation_failed\', \'tenant_connection_mismatch\', \'idempotency_conflict\', \'invalid_state\', \'provider_write_failed\', \'provider_revoke_failed\', \'provider_describe_failed\', \'provider_health_failed\', \'repository_after_provider_failed\', \'audit_after_provider_failed\')',
    );
    expect(migrationSql).toContain(
      'create table "his_connection_credential_compensation_operations"',
    );
    expect(migrationSql).toContain('"operation_id" varchar(96) not null');
    expect(migrationSql).toContain('"retry_count" integer default 0 not null');
    expect(migrationSql).toContain(
      '"manual_review_required" boolean default false not null',
    );
    expect(migrationSql).toContain(
      'alter table "his_connection_credential_compensation_operations" add constraint "his_conn_cred_comp_ops_tenant_fk" foreign key ("tenant_id") references "public"."tenants"("id")',
    );
    expect(migrationSql).toContain(
      'alter table "his_connection_credential_compensation_operations" add constraint "his_conn_cred_comp_ops_connection_fk" foreign key ("tenant_id","connection_id") references "public"."his_connections"("tenant_id","id")',
    );
    expect(migrationSql).toContain(
      'create unique index "his_conn_cred_comp_ops_operation_id_unique_idx" on "his_connection_credential_compensation_operations" using btree ("operation_id")',
    );
    expect(migrationSql).toContain(
      'create index "his_conn_cred_comp_ops_tenant_connection_state_idx" on "his_connection_credential_compensation_operations" using btree ("tenant_id","connection_id","state")',
    );
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b|\bdrop\s+column\b|\balter\s+column\b/i);
    expect(migrationSql).not.toMatch(/\bdelete\s+from\b|\binsert\s+into\b|(^|;)\s*update\s+/i);
    expect(migrationSql).not.toMatch(
      /credential_ref|credentialref|idempotency_key|idempotencykey|scoped_idempotency|synthetic_placeholder|provider_path|secret_path|raw_payload|raw_credential|request_body|response_body|token|secret|api_key|oauth|basic_auth|signing_key|private_key|connection_string|database_url|"sql"|"stack"/i,
    );
  });

  it('HIS 连接配置凭证补偿 job queue 迁移只新增安全调度表', () => {
    const migrationSql = readMigrationSql('compensation_job_queue_schema_min');
    const journal = JSON.parse(readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const latestSnapshot = readFileSync(
      join(process.cwd(), 'drizzle/meta/0008_snapshot.json'),
      'utf8',
    ).toLowerCase();

    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idx: 8,
          tag: '0008_phase23_his_connection_credential_compensation_job_queue_schema_min',
        }),
      ]),
    );
    expect(latestSnapshot).toContain(
      '"his_connection_credential_compensation_jobs"',
    );
    expect(latestSnapshot).toContain('"job_state"');
    expect(latestSnapshot).toContain('"dead_letter_reason"');
    expect(migrationSql).toContain(
      'create type "public"."his_connection_credential_compensation_job_state" as enum(\'queued\', \'claimed\', \'running\', \'succeeded\', \'failed\', \'dead_lettered\', \'manual_review_required\', \'cancelled\')',
    );
    expect(migrationSql).toContain(
      'create type "public"."his_connection_credential_compensation_dead_letter_reason" as enum(\'retry_exhausted\', \'claim_conflict\', \'stale_recovery_conflict\', \'provider_result_unknown\', \'audit_write_unavailable\', \'operation_state_conflict\', \'unsafe_payload_summary\')',
    );
    expect(migrationSql).toContain(
      'create table "his_connection_credential_compensation_jobs"',
    );
    expect(migrationSql).toContain('"operation_id" varchar(96) not null');
    expect(migrationSql).toContain(
      '"job_state" "his_connection_credential_compensation_job_state" default \'queued\' not null',
    );
    expect(migrationSql).toContain('"retry_count" integer default 0 not null');
    expect(migrationSql).toContain('"max_retry_count" integer default 3 not null');
    expect(migrationSql).toContain('"next_attempt_at" timestamp with time zone default now() not null');
    expect(migrationSql).toContain('"locked_until" timestamp with time zone');
    expect(migrationSql).toContain('"claim_id" varchar(96)');
    expect(migrationSql).toContain('"claim_version" integer default 0 not null');
    expect(migrationSql).toContain('"claimed_by" varchar(96)');
    expect(migrationSql).toContain('"last_heartbeat_at" timestamp with time zone');
    expect(migrationSql).toContain(
      '"dead_letter_reason" "his_connection_credential_compensation_dead_letter_reason"',
    );
    expect(migrationSql).toContain(
      '"manual_review_required" boolean default false not null',
    );
    expect(migrationSql).toContain(
      'alter table "his_connection_credential_compensation_jobs" add constraint "his_conn_cred_comp_jobs_tenant_fk" foreign key ("tenant_id") references "public"."tenants"("id")',
    );
    expect(migrationSql).toContain(
      'alter table "his_connection_credential_compensation_jobs" add constraint "his_conn_cred_comp_jobs_connection_fk" foreign key ("tenant_id","connection_id") references "public"."his_connections"("tenant_id","id")',
    );
    expect(migrationSql).toContain(
      'alter table "his_connection_credential_compensation_jobs" add constraint "his_conn_cred_comp_jobs_operation_scope_fk" foreign key ("tenant_id","connection_id","operation_id") references "public"."his_connection_credential_compensation_operations"("tenant_id","connection_id","operation_id")',
    );
    expect(migrationSql).not.toContain(
      'foreign key ("operation_id") references "public"."his_connection_credential_compensation_operations"("operation_id")',
    );
    expect(migrationSql).toContain(
      'create unique index "his_conn_cred_comp_ops_tenant_connection_operation_unique_idx" on "his_connection_credential_compensation_operations" using btree ("tenant_id","connection_id","operation_id")',
    );
    expect(migrationSql).toContain(
      'create unique index "his_conn_cred_comp_jobs_operation_id_unique_idx" on "his_connection_credential_compensation_jobs" using btree ("operation_id")',
    );
    expect(migrationSql).toContain(
      'create index "his_conn_cred_comp_jobs_tenant_connection_operation_idx" on "his_connection_credential_compensation_jobs" using btree ("tenant_id","connection_id","operation_id")',
    );
    expect(migrationSql).toContain(
      'create index "his_conn_cred_comp_jobs_tenant_state_next_attempt_idx" on "his_connection_credential_compensation_jobs" using btree ("tenant_id","job_state","next_attempt_at")',
    );
    expect(migrationSql).toContain(
      'create index "his_conn_cred_comp_jobs_lock_idx" on "his_connection_credential_compensation_jobs" using btree ("job_state","locked_until","claim_version")',
    );
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b|\bdrop\s+column\b|\balter\s+column\b/i);
    expect(migrationSql).not.toMatch(/\bdelete\s+from\b|\binsert\s+into\b|(^|;)\s*update\s+/i);
    expect(migrationSql).not.toMatch(
      /credential_ref|credentialref|idempotency_key|idempotencykey|scoped_idempotency|synthetic_placeholder|provider_path|secret_path|raw_payload|raw_credential|request_body|response_body|token|secret|api_key|oauth|basic_auth|signing_key|private_key|connection_string|database_url|"sql"|"stack"/i,
    );
  });

  it('定义知识库文件解析结果和解析 chunk 最小表结构', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const parses = schemaModule.knowledgeDocumentFileParses;
    const parseChunks = schemaModule.knowledgeDocumentFileParseChunks;
    const migrationSql = readMigrationSql('knowledge_document_file_parsing');
    const journal = JSON.parse(readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    expect(parses).toBeDefined();
    expect(parseChunks).toBeDefined();
    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idx: 13,
          tag: '0013_v1_knowledge_document_file_parsing',
        }),
      ]),
    );

    const parseColumns = columnNames(getTableConfig(parses as never).columns);
    const chunkColumns = columnNames(getTableConfig(parseChunks as never).columns);

    expect(parseColumns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'knowledge_document_id',
        'file_id',
        'parse_status',
        'failure_reason_code',
        'safe_failure_message',
        'text_content',
        'text_length',
        'chunk_count',
        'parser_version',
        'created_at',
        'updated_at',
      ]),
    );
    expect(chunkColumns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'knowledge_document_id',
        'file_id',
        'chunk_index',
        'text_preview',
        'char_count',
        'created_at',
        'updated_at',
      ]),
    );
    expect(migrationSql).toContain('create table "knowledge_document_file_parses"');
    expect(migrationSql).toContain('create table "knowledge_document_file_parse_chunks"');
    expect(migrationSql).toContain('"parse_status" varchar(32) default \'pending\' not null');
    expect(migrationSql).toContain('"text_content" text default \'\' not null');
    expect(migrationSql).toContain('"text_preview" text not null');
    expect(migrationSql).toContain(
      'foreign key ("tenant_id","file_id") references "public"."knowledge_document_files"("tenant_id","id")',
    );
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b|\bdrop\s+column\b|\balter\s+column\b/i);
    expect(migrationSql).not.toMatch(
      /embedding_vector|embedding_provider|ocr|ai_provider|question_answer|training_content|token|secret|password|database_url|"sql"|"stack"/i,
    );
  });

  it('定义知识库文件解析 chunk embedding 最小持久化表结构', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const embeddings = schemaModule.knowledgeDocumentFileParseChunkEmbeddings;
    const migrationSql = readMigrationSql('knowledge_document_file_parse_chunk_embeddings');
    const journal = JSON.parse(readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    expect(embeddings).toBeDefined();
    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idx: 14,
          tag: '0014_v1_knowledge_document_file_parse_chunk_embeddings',
        }),
      ]),
    );

    const embeddingColumns = columnNames(getTableConfig(embeddings as never).columns);
    expect(embeddingColumns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'knowledge_document_id',
        'file_id',
        'chunk_id',
        'embedding_provider',
        'embedding_model',
        'embedding_dimensions',
        'embedding_vector_json',
        'status',
        'created_at',
        'updated_at',
      ]),
    );
    expect(migrationSql).toContain(
      'create table "knowledge_document_file_parse_chunk_embeddings"',
    );
    expect(migrationSql).toContain('"embedding_provider" varchar(64) default \'mock_local_embedding\' not null');
    expect(migrationSql).toContain('"embedding_model" varchar(96) default \'mock-local-embedding-v1\' not null');
    expect(migrationSql).toContain('"embedding_vector_json" jsonb not null');
    expect(migrationSql).toContain(
      'foreign key ("tenant_id","chunk_id") references "public"."knowledge_document_file_parse_chunks"("tenant_id","id")',
    );
    expect(migrationSql).toContain(
      'unique("tenant_id","chunk_id")',
    );
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b|\bdrop\s+column\b|\balter\s+column\b/i);
    expect(migrationSql).not.toMatch(
      /ocr|ai_provider|openai|question_answer|training_content|storage_key|text_content|raw_content|token|secret|password|database_url|"sql"|"stack"/i,
    );
  });

  it('定义知识库 QA 审计最小持久化表结构', () => {
    const schemaModule = schema as typeof schema & Record<string, unknown>;
    const qaAuditLogs = schemaModule.knowledgeQaAuditLogs;
    const migrationSql = readMigrationSql('knowledge_qa_audit_logs');
    const journal = JSON.parse(readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    expect(qaAuditLogs).toBeDefined();
    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idx: 15,
          tag: '0015_v1_knowledge_qa_audit_logs',
        }),
      ]),
    );

    const auditColumns = columnNames(getTableConfig(qaAuditLogs as never).columns);
    expect(auditColumns).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'institution_id',
        'actor_scope',
        'actor_user_id',
        'question',
        'answer_preview',
        'retrieval_mode',
        'citation_count',
        'safe_status',
        'safe_failure_message',
        'created_at',
      ]),
    );
    expect(migrationSql).toContain('create table "knowledge_qa_audit_logs"');
    expect(migrationSql).toContain('"question" varchar(512) not null');
    expect(migrationSql).toContain('"answer_preview" varchar(1024) not null');
    expect(migrationSql).toContain('"retrieval_mode" varchar(24) not null');
    expect(migrationSql).toContain('"citation_count" integer not null');
    expect(migrationSql).toContain('"safe_status" varchar(32) not null');
    expect(migrationSql).not.toMatch(/\bdrop\s+table\b|\bdrop\s+column\b|\balter\s+column\b/i);
    expect(migrationSql).not.toMatch(
      /embedding_vector_json|storage_key|text_content|raw_content|full_text|ocr|openai|ai_provider|training_content|token|secret|password|database_url|"sql"|"stack"/i,
    );
  });

  it('MIG-01A1 定义机构锚点和版本化运行上下文且 revision 无默认值', () => {
    const scopeConfig = getTableConfig(institutionScopes);
    const contextConfig = getTableConfig(institutionOperatingContexts);
    const versionConfig = getTableConfig(institutionOperatingContextVersions);
    const scopeRevision = scopeConfig.columns.find((column) => column.name === 'revision');
    const contextRevision = contextConfig.columns.find((column) => column.name === 'revision');
    const latestVersion = contextConfig.columns.find((column) => column.name === 'latest_version');
    const scopePrimaryKey = scopeConfig.primaryKeys[0];
    const contextPrimaryKey = contextConfig.primaryKeys[0];
    const versionPrimaryKey = versionConfig.primaryKeys[0];
    const contextScopeFk = contextConfig.foreignKeys.find(
      (foreignKey) => foreignKey.getName() === 'institution_operating_contexts_scope_fk',
    );
    const contextLatestVersionFk = contextConfig.foreignKeys.find(
      (foreignKey) =>
        foreignKey.getName() === 'institution_operating_contexts_latest_version_fk',
    );
    const versionScopeFk = versionConfig.foreignKeys.find(
      (foreignKey) =>
        foreignKey.getName() === 'institution_operating_context_versions_scope_fk',
    );

    expect(schema.institutionScopeStatusEnum.enumValues).toEqual(['active', 'suspended']);
    expect(schema.institutionProvisioningSourceEnum.enumValues).toEqual([
      'formal_onboarding',
      'approved_migration_manifest',
    ]);
    expect(schema.institutionOperatingContextSourceEnum.enumValues).toEqual([
      'institution_config',
      'product_default',
    ]);
    expect(columnNames(scopeConfig.columns)).toEqual([
      'tenant_id',
      'institution_id',
      'status',
      'revision',
      'provisioning_source',
      'provisioning_reference_digest',
      'approved_by',
      'approved_at',
      'created_at',
      'updated_at',
    ]);
    expect(scopeRevision?.notNull).toBe(true);
    expect(scopeRevision?.hasDefault).toBe(false);
    expect(columnNames(scopePrimaryKey?.columns ?? [])).toEqual(['tenant_id', 'institution_id']);
    expect(scopeConfig.checks.map((constraint) => constraint.name)).toContain(
      'institution_scopes_revision_positive_check',
    );

    expect(columnNames(versionConfig.columns)).toEqual([
      'tenant_id',
      'institution_id',
      'version',
      'timezone',
      'currency',
      'effective_from_business_date',
      'effective_at',
      'source',
      'migration_provenance',
      'created_at',
      'created_by',
    ]);
    expect(columnNames(versionPrimaryKey?.columns ?? [])).toEqual([
      'tenant_id',
      'institution_id',
      'version',
    ]);
    expect(foreignKeyColumns(versionScopeFk)).toEqual({
      columns: ['tenant_id', 'institution_id'],
      foreignColumns: ['tenant_id', 'institution_id'],
    });

    expect(columnNames(contextConfig.columns)).toEqual([
      'tenant_id',
      'institution_id',
      'revision',
      'latest_version',
      'updated_by',
      'created_at',
      'updated_at',
    ]);
    expect(contextRevision?.notNull).toBe(true);
    expect(contextRevision?.hasDefault).toBe(false);
    expect(latestVersion?.notNull).toBe(true);
    expect(latestVersion?.hasDefault).toBe(false);
    expect(columnNames(contextPrimaryKey?.columns ?? [])).toEqual([
      'tenant_id',
      'institution_id',
    ]);
    expect(foreignKeyColumns(contextScopeFk)).toEqual({
      columns: ['tenant_id', 'institution_id'],
      foreignColumns: ['tenant_id', 'institution_id'],
    });
    expect(foreignKeyColumns(contextLatestVersionFk)).toEqual({
      columns: ['tenant_id', 'institution_id', 'latest_version'],
      foreignColumns: ['tenant_id', 'institution_id', 'version'],
    });
  });

  it('MIG-01A1 只扩展可空机构归属和可空审计归因', () => {
    const businessTables = [appointments, treatmentSummaries, followUpTasks];

    for (const table of businessTables) {
      const institutionColumn = getTableConfig(table).columns.find(
        (column) => column.name === 'institution_id',
      );
      expect(institutionColumn?.notNull).toBe(false);
      expect(institutionColumn?.hasDefault).toBe(false);
    }

    const auditConfig = getTableConfig(auditEvents);
    const auditInstitution = auditConfig.columns.find(
      (column) => column.name === 'institution_id',
    );
    const auditAttribution = auditConfig.columns.find(
      (column) => column.name === 'institution_attribution',
    );

    expect(schema.auditInstitutionAttributionEnum.enumValues).toEqual([
      'not_applicable',
      'verified',
      'legacy_unattributed',
    ]);
    expect(auditInstitution?.notNull).toBe(false);
    expect(auditInstitution?.hasDefault).toBe(false);
    expect(auditAttribution?.notNull).toBe(false);
    expect(auditAttribution?.hasDefault).toBe(false);
  });

  it('0038 MIG-01A1 migration 仅执行 expand，不 provision、回填或收紧约束', () => {
    const migrationSql = readMigrationSql('0038_mig_01a1_institution_isolation_expand');
    const journal = JSON.parse(
      readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ idx: number; tag: string }> };

    expect(journal.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idx: 38,
          tag: '0038_mig_01a1_institution_isolation_expand',
        }),
      ]),
    );
    expect(migrationSql).toContain('create table if not exists "institution_scopes"');
    expect(migrationSql).toContain(
      'create table if not exists "institution_operating_context_versions"',
    );
    expect(migrationSql).toContain(
      'create table if not exists "institution_operating_contexts"',
    );
    expect(migrationSql).toContain(
      'constraint "institution_scopes_revision_positive_check" check ("revision" > 0)',
    );
    const institutionScopesSql = migrationSql.slice(
      migrationSql.indexOf('create table if not exists "institution_scopes"'),
      migrationSql.indexOf(
        'create table if not exists "institution_operating_context_versions"',
      ),
    );
    expect(institutionScopesSql).toContain('"revision" integer not null');
    expect(institutionScopesSql).not.toMatch(/"revision" integer default/i);
    for (const tableName of [
      'appointments',
      'treatment_summaries',
      'follow_up_tasks',
      'audit_events',
    ]) {
      expect(migrationSql).toContain(
        `alter table "${tableName}" add column "institution_id" varchar(64)`,
      );
      expect(migrationSql).not.toMatch(
        new RegExp(`alter table "${tableName}" add column "institution_id"[^;]*(default|not null)`, 'i'),
      );
    }
    expect(migrationSql).toContain(
      'alter table "audit_events" add column "institution_attribution" "audit_institution_attribution"',
    );
    expect(migrationSql).not.toMatch(
      /(^|;)\s*(insert\s+into|update\s+|delete\s+from|truncate)\b/im,
    );
    expect(migrationSql).not.toMatch(
      /\b(drop\s+(table|column)|alter\s+column|set\s+not\s+null)\b/i,
    );
    expect(migrationSql).not.toMatch(/migration_placeholder|demo|fixture|default_institution/i);
    expect(migrationSql).not.toMatch(
      /alter table "(auth_account_institution_bindings|customers|appointments|treatment_summaries|follow_up_tasks|audit_events)" add constraint/i,
    );
  });

  it('A2-P2 P1 只建立普通双键索引与 NOT VALID Scope 关系', () => {
    const drizzleDir = join(process.cwd(), 'drizzle');
    const migrationFiles = readdirSync(drizzleDir).filter((fileName) =>
      /^\d{4}_mig_01a2_anchor_bridge\.sql$/u.test(fileName));
    const journal = JSON.parse(
      readFileSync(join(drizzleDir, 'meta/_journal.json'), 'utf8'),
    ) as {
      version: string;
      dialect: string;
      entries: Array<{
        idx: number;
        tag: string;
        version: string;
        when: number;
        breakpoints: boolean;
      }>;
    };

    expect(migrationFiles).toHaveLength(1);
    const migrationFile = migrationFiles[0]!;
    const migrationStem = migrationFile.replace(/\.sql$/u, '');
    const migrationNumber = Number(migrationFile.slice(0, 4));
    const migrationSql = readFileSync(join(drizzleDir, migrationFile), 'utf8').toLowerCase();
    const migrationEntry = journal.entries.find((entry) => entry.tag === migrationStem);
    const predecessorEntry = journal.entries[(migrationEntry?.idx ?? 0) - 1];
    const predecessorSql = readFileSync(
      join(drizzleDir, `${predecessorEntry?.tag}.sql`),
      'utf8',
    );
    const predecessorHash = createHash('sha256').update(predecessorSql).digest('hex');

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(migrationEntry).toEqual({
      idx: migrationNumber,
      tag: migrationStem,
      version: '7',
      when: expect.any(Number),
      breakpoints: true,
    });
    expect(migrationEntry?.when).toBeGreaterThan(predecessorEntry?.when ?? 0);
    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      journal.entries.map((_, index) => index),
    );
    expect(migrationSql).toContain(
      `expected_predecessor_count constant integer := ${migrationEntry?.idx}`,
    );
    expect(migrationSql).toContain(String(predecessorEntry?.when));
    expect(migrationSql).toContain(predecessorHash);
    expect(migrationSql).toContain('expected_predecessor_hash');
    expect(migrationSql).toContain('a2_p2_p1_journal_drift');
    expect(migrationSql).toContain('a2_p2_p1_journal_postcheck_failed');

    for (const terminalStateGuard of [
      'approved_migration_manifest',
      "source in ('institution_config', 'product_default')",
      "timezone = 'asia/shanghai'",
      "currency = 'cny'",
      'revision = 1',
      'version = 1',
      'latest_version = 1',
      'a2_p2_p1_terminal_state_drift',
    ]) {
      expect(migrationSql).toContain(terminalStateGuard);
    }
    expect(migrationSql).toMatch(
      /from public\.institution_scopes\s+where status = 'active'\s+and revision = 1\s+and provisioning_source = 'approved_migration_manifest'/u,
    );
    expect(migrationSql).toMatch(
      /from public\.institution_operating_context_versions\s+where version = 1\s+and source in \('institution_config', 'product_default'\)\s+and timezone = 'asia\/shanghai'\s+and currency = 'cny'/u,
    );
    expect(migrationSql).toMatch(
      /from public\.institution_operating_contexts\s+where revision = 1\s+and latest_version = 1/u,
    );

    expect(migrationSql).toContain("set local lock_timeout = '1s'");
    expect(migrationSql).toContain("set local statement_timeout = '5s'");
    expect(migrationSql).toContain('set local search_path = pg_catalog, public;');
    const bindingLock =
      'lock table "public"."auth_account_institution_bindings" in share row exclusive mode;';
    const scopeLock =
      'lock table "public"."institution_scopes" in share row exclusive mode;';
    expect(migrationSql.split(bindingLock)).toHaveLength(2);
    expect(migrationSql.split(scopeLock)).toHaveLength(2);
    expect(migrationSql.indexOf(bindingLock)).toBeGreaterThanOrEqual(0);
    expect(migrationSql.indexOf(scopeLock)).toBeGreaterThanOrEqual(0);
    expect(migrationSql.indexOf(bindingLock)).toBeLessThan(migrationSql.indexOf(scopeLock));
    expect(migrationSql).toContain('all_missing');
    expect(migrationSql).toContain('all_exact');
    expect(migrationSql).toContain('a2_p2_p1_catalog_conflict');
    expect(migrationSql).toContain('planned_count <> created_count + reused_count');
    expect(migrationSql).toContain('conflict_count <> 0');
    expect(migrationSql).toContain('unexpected_count <> 0');
    for (const catalogGuard of [
      'pg_trigger',
      'pg_rewrite',
      'relrowsecurity',
      'relforcerowsecurity',
      'pg_policy',
      'pg_inherits',
      'pg_publication_rel',
      'pg_depend',
      "dependency_row.refclassid = 'pg_class'::regclass",
      'institution_scopes_pk',
      'a2_p2_p1_scope_primary_index_drift',
      'auth_account_institution_bindings_pkey',
      'auth_account_institution_bindings_tenant_account_fk',
      'auth_account_institution_bindings_active_account_tenant_unique_',
      'auth_account_institution_bindings_account_tenant_status_idx',
      'auth_account_institution_bindings_status_shape_check',
      'auth_account_institution_bindings_expiry_check',
      'auth_account_institution_bindings_source_authority_check',
      'auth_account_institution_bindings_version_positive_check',
      'a2_p2_p1_binding_primary_key_drift',
      'a2_p2_p1_binding_tenant_account_fk_drift',
      'a2_p2_p1_binding_index_drift',
      'a2_p2_p1_binding_check_drift',
      'a2_p2_p1_binding_catalog_set_drift',
      'a2_p2_p1_binding_catalog_postcheck_failed',
      'pre_binding_historical_orphan_count',
      'post_binding_historical_orphan_count',
      "binding_row.status = 'active'",
      'binding_row.created_at <',
      'regexp_replace(',
      'pg_get_expr(constraint_row.conbin, constraint_row.conrelid, false)',
    ]) {
      expect(migrationSql).toContain(catalogGuard);
    }
    const migrationSqlWithAdjacentLiteralsJoined = migrationSql.replace(
      /'[ \t]*\n[ \t]*'/gu,
      '',
    );
    for (const exactCheckExpression of [
      "(((status=''active''::auth_institution_binding_status)and(revoked_atisnull)and"
        + "(institution_idisnotnull))or((status=''revoked''::auth_institution_binding_status)"
        + 'and(revoked_atisnotnull)and(institution_idisnotnull)and'
        + '(revoked_at>=assigned_at)))',
      '((expires_atisnull)or(expires_at>assigned_at))',
      "((status<>''active''::auth_institution_binding_status)or(source=any(array["
        + "''manual_admin''::auth_institution_binding_source,"
        + "''system''::auth_institution_binding_source])))",
      '(version>0)',
    ]) {
      expect(migrationSqlWithAdjacentLiteralsJoined).toContain(exactCheckExpression);
    }
    expect(migrationSql).not.toContain(
      "'auth_account_institution_bindings_active_account_tenant_unique_idx'",
    );

    const preCatalogSetStart = migrationSql.indexOf('if array(');
    const preCatalogSetEnd = migrationSql.indexOf(
      "raise exception using message = 'a2_p2_p1_binding_catalog_set_drift'",
    );
    const postCatalogSetStart = migrationSql.indexOf('if array(', preCatalogSetStart + 1);
    const postCatalogSetEnd = migrationSql.indexOf(
      "raise exception using message = 'a2_p2_p1_binding_catalog_postcheck_failed'",
    );
    expect(preCatalogSetStart).toBeGreaterThanOrEqual(0);
    expect(preCatalogSetEnd).toBeGreaterThan(preCatalogSetStart);
    expect(postCatalogSetStart).toBeGreaterThan(preCatalogSetEnd);
    expect(postCatalogSetEnd).toBeGreaterThan(postCatalogSetStart);
    const preCatalogSetGuard = migrationSql.slice(preCatalogSetStart, preCatalogSetEnd);
    const postCatalogSetGuard = migrationSql.slice(postCatalogSetStart, postCatalogSetEnd);
    expect(preCatalogSetGuard).toContain(
      "constraint_row.conname <> 'auth_account_institution_bindings_scope_fk'",
    );
    expect(preCatalogSetGuard).toContain(
      "index_relation.relname <> 'auth_account_institution_bindings_scope_idx'",
    );
    expect(postCatalogSetGuard).not.toContain(' <> ');
    for (const knownCatalogName of [
      'auth_account_institution_bindings_expiry_check',
      'auth_account_institution_bindings_pkey',
      'auth_account_institution_bindings_source_authority_check',
      'auth_account_institution_bindings_status_shape_check',
      'auth_account_institution_bindings_tenant_account_fk',
      'auth_account_institution_bindings_version_positive_check',
      'auth_account_institution_bindings_account_tenant_status_idx',
      'auth_account_institution_bindings_active_account_tenant_unique_',
    ]) {
      expect(preCatalogSetGuard).toContain(knownCatalogName);
      expect(postCatalogSetGuard).toContain(knownCatalogName);
    }
    expect(postCatalogSetGuard).toContain('auth_account_institution_bindings_scope_fk');
    expect(postCatalogSetGuard).toContain('auth_account_institution_bindings_scope_idx');

    for (const phase of ['pre', 'post']) {
      expect(migrationSql).toMatch(
        new RegExp(
          `select count\\(\\*\\) into ${phase}_binding_historical_orphan_count\\s+`
          + 'from public\\.auth_account_institution_bindings binding_row\\s+'
          + 'left join public\\.institution_scopes scope_row\\s+'
          + 'using \\(tenant_id, institution_id\\)\\s+'
          + 'where scope_row\\.tenant_id is null\\s+'
          + "and binding_row\\.status = 'active'\\s+"
          + 'and binding_row\\.created_at < \\(\\s+'
          + 'select min\\(scope_created\\.created_at\\)\\s+'
          + 'from public\\.institution_scopes scope_created\\s+\\)',
          'u',
        ),
      );
    }
    expect(migrationSql).toContain('or pre_binding_historical_orphan_count <> 1');

    const executedDdl = [...migrationSql.matchAll(/execute\s+((?:'[^']*'\s*)+);/gu)]
      .map((match) => match[1]!
        .replace(/'\s*'/gu, '')
        .replace(/^'|'$/gu, '')
        .replace(/\s+/gu, ' ')
        .trim());
    expect(migrationSql.match(/\bexecute\s+/gu)).toHaveLength(2);
    expect(migrationSql.match(/\bcreate\s+index\b/gu)).toHaveLength(1);
    expect(migrationSql.match(/\badd\s+constraint\b/gu)).toHaveLength(1);
    expect(executedDdl).toHaveLength(2);
    expect(executedDdl).toEqual([
      'create index "auth_account_institution_bindings_scope_idx" '
        + 'on "public"."auth_account_institution_bindings" '
        + 'using btree ("tenant_id", "institution_id")',
      'alter table "public"."auth_account_institution_bindings" '
        + 'add constraint "auth_account_institution_bindings_scope_fk" '
        + 'foreign key ("tenant_id", "institution_id") '
        + 'references "public"."institution_scopes" ("tenant_id", "institution_id") '
        + 'match simple on update no action on delete no action '
        + 'not deferrable initially immediate not valid',
    ]);
    expect(migrationSql).toContain('not constraint_row.convalidated');

    expect(migrationSql).toMatch(
      /if\s+index_named_count = 0\s+and index_exact_named_count = 0\s+and index_equivalent_count = 0\s+and fk_named_count = 0\s+and fk_exact_named_count = 0\s+and fk_equivalent_count = 0\s+then/iu,
    );
    expect(migrationSql).toMatch(
      /elsif\s+index_named_count = 1\s+and index_exact_named_count = 1\s+and index_equivalent_count = 1\s+and fk_named_count = 1\s+and fk_exact_named_count = 1\s+and fk_equivalent_count = 1\s+then/iu,
    );
    expect(migrationSql.match(/a2_p2_p1_catalog_conflict/gu)).toHaveLength(1);

    const sqlWithoutStringLiterals = migrationSql.replace(/'(?:''|[^'])*'/gu, "''");
    expect(migrationSql).not.toContain('if not exists');
    expect(migrationSql).not.toContain('duplicate_object');
    expect(migrationSql).not.toContain('create index concurrently');
    expect(sqlWithoutStringLiterals).not.toMatch(
      /\b(start\s+transaction|begin\s+(transaction|work)|commit|rollback|savepoint|release\s+savepoint)\b/iu,
    );
    expect(migrationSql).not.toMatch(/(^|\n)\s*begin\s*;/mu);
    expect(sqlWithoutStringLiterals).not.toMatch(
      /\b(insert\s+into|update|upsert|delete\s+from|truncate)\b/iu,
    );
    expect(migrationSql).not.toMatch(
      /validate\s+constraint|set\s+not\s+null|alter\s+column|\bdrop\b|\bcascade\b/iu,
    );
    expect(migrationSql).not.toMatch(
      /create\s+unique\s+index|add\s+constraint[^;]+\b(unique|check)\b/iu,
    );
    expect(sqlWithoutStringLiterals).not.toMatch(
      /\b(create\s+(table|type|function|trigger|sequence|view|materialized\s+view|extension)|alter\s+(table|type|column)|grant|revoke|comment\s+on|security\s+label)\b/iu,
    );
    expect(migrationSql).not.toContain('retry');
  });

  it('Membership M1 migration 只执行 Expand 并保持 legacy 数据不变', () => {
    const drizzleDir = join(process.cwd(), 'drizzle');
    const migrationFiles = readdirSync(drizzleDir).filter((fileName) =>
      /^\d{4}_base02_membership_revision_expand\.sql$/u.test(fileName),
    );
    const journal = JSON.parse(
      readFileSync(join(drizzleDir, 'meta/_journal.json'), 'utf8'),
    ) as {
      version: string;
      dialect: string;
      entries: Array<{
        idx: number;
        tag: string;
        version: string;
        when: number;
        breakpoints: boolean;
      }>;
    };

    expect(migrationFiles).toHaveLength(1);
    const migrationFile = migrationFiles[0]!;
    const migrationStem = migrationFile.replace(/\.sql$/u, '');
    const migrationNumber = Number(migrationFile.slice(0, 4));
    const migrationSql = readFileSync(join(drizzleDir, migrationFile), 'utf8').toLowerCase();
    const migrationEntry = journal.entries.find((entry) => entry.tag === migrationStem);
    expect(migrationEntry).toBeDefined();
    const predecessorEntry = journal.entries[(migrationEntry?.idx ?? 0) - 1];
    const predecessorSql = readFileSync(
      join(drizzleDir, `${predecessorEntry?.tag}.sql`),
      'utf8',
    );
    const predecessorHash = createHash('sha256').update(predecessorSql).digest('hex');

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(migrationEntry).toEqual({
      idx: migrationNumber,
      tag: migrationStem,
      version: '7',
      when: expect.any(Number),
      breakpoints: true,
    });
    expect(migrationEntry?.when).toBeGreaterThan(predecessorEntry?.when ?? 0);
    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      journal.entries.map((_, index) => index),
    );
    expect(migrationSql).toContain(
      `expected_predecessor_count constant integer := ${migrationEntry?.idx}`,
    );
    expect(migrationSql).toContain(String(predecessorEntry?.when));
    expect(migrationSql).toContain(predecessorHash);
    expect(migrationSql).toContain('base02_membership_m1_journal_drift');
    expect(migrationSql).toContain('base02_membership_m1_journal_postcheck_failed');
    expect(
      migrationSql.match(
        /array_agg\(enum_row\.enumlabel::text order by enum_row\.enumsortorder\)/gu,
      ),
    ).toHaveLength(3);
    expect(migrationSql).not.toMatch(
      /array_agg\(enum_row\.enumlabel\s+order by enum_row\.enumsortorder\)/u,
    );

    expect(migrationSql).toContain("set local lock_timeout = '1s'");
    expect(migrationSql).toContain("set local statement_timeout = '5s'");
    expect(migrationSql).toContain('set local search_path = pg_catalog, public;');
    const memberLock =
      'lock table "public"."tenant_members" in share row exclusive mode;';
    const bindingLock =
      'lock table "public"."auth_account_institution_bindings" in share mode;';
    expect(migrationSql.indexOf(memberLock)).toBeGreaterThanOrEqual(0);
    expect(migrationSql.indexOf(bindingLock)).toBeGreaterThan(migrationSql.indexOf(memberLock));

    for (const requiredFragment of [
      "create type public.membership_lifecycle_status as enum",
      "create type public.membership_provenance_source as enum",
      "create type public.membership_transition_type as enum",
      'add column revision integer',
      'add column lifecycle_status public.membership_lifecycle_status',
      'tenant_members_tenant_id_id_unique',
      'tenant_members_current_envelope_shape_check',
      'create table public.tenant_membership_transitions',
      'tenant_membership_transitions_tenant_membership_fk',
      'tenant_membership_transitions_tenant_command_unique',
      'tenant_membership_transitions_membership_revision_unique',
      'tenant_membership_transitions_tenant_membership_revision_idx',
      'tenant_membership_transitions_revision_shape_check',
      'tenant_membership_transitions_lifecycle_shape_check',
      'tenant_membership_transitions_role_shape_check',
      'tenant_membership_transitions_provenance_shape_check',
      'reject_tenant_membership_transition_mutation',
      'tenant_membership_transitions_reject_row_mutation',
      'tenant_membership_transitions_reject_truncate',
      'before update or delete',
      'before truncate',
      'all_missing',
      'base02_membership_m1_preexisting_catalog',
      'base02_membership_m1_data_drift',
      'from_revision is not null',
      'from_lifecycle_status is not null',
      "tgenabled = 'o'",
      'tgtype = 27',
      'tgtype = 34',
      'pg_index index_row',
      "index_relation.relname = 'tenant_members_tenant_user_unique_idx'",
      "constraint_row.conname = 'tenant_members_pkey'",
      'base02_membership_m1_existing_primary_key_drift',
      'base02_membership_m1_equivalent_unique_preexists',
      'select count(*) <> 1 from public.institution_scopes',
      'select count(*) <> 1 from public.institution_operating_context_versions',
      'select count(*) <> 1 from public.institution_operating_contexts',
      'left join public.institution_scopes scope_row using (tenant_id, institution_id)',
      'left join public.institution_operating_context_versions version_row',
    ]) {
      expect(migrationSql).toContain(requiredFragment);
    }

    const currentAlterStart = migrationSql.indexOf('alter table public.tenant_members');
    const transitionTableStart = migrationSql.indexOf(
      'create table public.tenant_membership_transitions',
    );
    const currentAlterSql = migrationSql.slice(currentAlterStart, transitionTableStart);
    for (const columnName of [
      'revision',
      'lifecycle_status',
      'current_provenance_source',
      'current_provenance_actor_id',
      'current_provenance_reason_code',
      'current_provenance_command_id',
      'current_provenance_occurred_at',
      'current_provenance_recorded_at',
      'revoked_at',
      'deleted_at',
    ]) {
      expect(currentAlterSql).toMatch(new RegExp(`add column ${columnName}\\b`, 'u'));
    }
    expect(currentAlterSql).not.toMatch(/add column[^,;]+\b(default|not null)\b/iu);

    const sqlWithoutStringLiterals = migrationSql.replace(/'(?:''|[^'])*'/gu, "''");
    expect(sqlWithoutStringLiterals).not.toMatch(
      /\b(start\s+transaction|begin\s+(transaction|work)|commit|rollback|savepoint|release\s+savepoint)\b/iu,
    );
    expect(migrationSql).not.toMatch(/(^|\n)\s*begin\s*;/mu);
    expect(sqlWithoutStringLiterals).not.toMatch(
      /(^|;)\s*(insert\s+into|update\s+|upsert\s+|delete\s+from|truncate\s+(table\s+)?)[a-z_"]/imu,
    );
    expect(migrationSql).not.toMatch(
      /validate\s+constraint|set\s+not\s+null|alter\s+column|\bdrop\b|\bcascade\b|create\s+index\s+concurrently/iu,
    );
    expect(sqlWithoutStringLiterals).not.toMatch(/\b(grant|revoke)\b/iu);
    expect(migrationSql).not.toContain('if not exists');
    expect(migrationSql).not.toContain('duplicate_object');
    expect(migrationSql).not.toContain('db:generate');
    expect(migrationSql).not.toContain('auth_account_institution_bindings_scope_fk not valid');
    expect(migrationSql).not.toContain('retry');
  });

  it('Membership M4 migration 确定性校准 legacy current 并原子建立 baseline evidence', () => {
    const drizzleDir = join(process.cwd(), 'drizzle');
    const migrationFiles = readdirSync(drizzleDir).filter((fileName) =>
      /^\d{4}_base02_membership_revision_legacy_calibration\.sql$/u.test(fileName),
    );
    const journal = JSON.parse(
      readFileSync(join(drizzleDir, 'meta/_journal.json'), 'utf8'),
    ) as {
      version: string;
      dialect: string;
      entries: Array<{
        idx: number;
        tag: string;
        version: string;
        when: number;
        breakpoints: boolean;
      }>;
    };

    expect(migrationFiles).toHaveLength(1);
    const migrationFile = migrationFiles[0]!;
    expect(migrationFile).toBe('0041_base02_membership_revision_legacy_calibration.sql');
    const migrationStem = migrationFile.replace(/\.sql$/u, '');
    const migrationNumber = Number(migrationFile.slice(0, 4));
    const migrationSqlRaw = readFileSync(join(drizzleDir, migrationFile), 'utf8');
    const migrationSql = migrationSqlRaw.toLowerCase();
    const migrationEntry = journal.entries.find((entry) => entry.tag === migrationStem);
    expect(migrationEntry).toBeDefined();
    const predecessorEntry = journal.entries[(migrationEntry?.idx ?? 0) - 1];
    const predecessorSql = readFileSync(
      join(drizzleDir, `${predecessorEntry?.tag}.sql`),
      'utf8',
    );
    const predecessorHash = createHash('sha256').update(predecessorSql).digest('hex');

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(migrationNumber).toBe(41);
    expect(migrationEntry).toEqual({
      idx: 41,
      tag: '0041_base02_membership_revision_legacy_calibration',
      version: '7',
      when: 1785614756000,
      breakpoints: true,
    });
    expect(journal.entries[migrationEntry?.idx ?? -1]).toEqual(migrationEntry);
    expect(journal.entries[(migrationEntry?.idx ?? -1) + 1]?.tag).toBe(
      '0042_base02_membership_revision_high_water_catch_up',
    );
    expect(
      readdirSync(drizzleDir)
        .filter((fileName) => /^\d{4}_.+\.sql$/u.test(fileName))
        .sort(),
    ).toEqual(journal.entries.map((entry) => `${entry.tag}.sql`));
    expect(migrationEntry?.when).toBeGreaterThan(predecessorEntry?.when ?? 0);
    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      journal.entries.map((_, index) => index),
    );
    expect(migrationSql).toContain(
      `expected_predecessor_count constant integer := ${migrationEntry?.idx}`,
    );
    expect(migrationSql).toContain(String(predecessorEntry?.when));
    expect(migrationSql).toContain(predecessorHash);
    expect(createHash('sha256').update(predecessorSql).digest('hex')).toBe(
      '41b6572cb725ed5f7ff79a0e1d6172110caab52ad63c7971be87d3e2fe034641',
    );
    expect(
      createHash('sha256')
        .update(readFileSync(join(drizzleDir, 'meta/0026_snapshot.json'), 'utf8'))
        .digest('hex'),
    ).toBe('d7b1c85f42c9be783503d73abd1fa34d356d71450ec40f9f57e5be9427260e95');

    expect(migrationSql).toContain("set local lock_timeout = '1s';");
    expect(migrationSql).toContain("set local statement_timeout = '30s';");
    expect(migrationSql).toContain('set local search_path = pg_catalog, public;');
    const memberLock =
      'lock table "public"."tenant_members" in share row exclusive mode;';
    const transitionLock =
      'lock table "public"."tenant_membership_transitions" in share row exclusive mode;';
    expect(migrationSql.match(/lock table "public"\."tenant_members"/gu)).toHaveLength(1);
    expect(
      migrationSql.match(/lock table "public"\."tenant_membership_transitions"/gu),
    ).toHaveLength(1);
    expect(migrationSql.indexOf(memberLock)).toBeGreaterThanOrEqual(0);
    expect(migrationSql.indexOf(transitionLock)).toBeGreaterThan(migrationSql.indexOf(memberLock));

    const highWaterStart = migrationSql.indexOf(
      'select member_row.created_at, member_row.id\n  into high_water_created_at, high_water_id',
    );
    const currentUpdateStart = migrationSql.indexOf(
      'update public.tenant_members as target_member',
    );
    const transitionInsertStart = migrationSql.indexOf(
      'insert into public.tenant_membership_transitions',
    );
    expect(highWaterStart).toBeGreaterThan(migrationSql.indexOf(transitionLock));
    expect(currentUpdateStart).toBeGreaterThan(highWaterStart);
    expect(transitionInsertStart).toBeGreaterThan(currentUpdateStart);
    expect(migrationSql).toContain(
      'order by member_row.created_at desc, member_row.id collate "c" desc',
    );
    expect(migrationSql).toContain(
      'order by member_row.created_at asc, member_row.id collate "c" asc',
    );
    expect(migrationSql).toContain(
      'member_row.id collate "c" <= high_water_id collate "c"',
    );
    expect(
      migrationSql.match(
        /member_row\.created_at < high_water_created_at\s+or \(\s+member_row\.created_at = high_water_created_at\s+and member_row\.id collate "c" <= high_water_id collate "c"\s+\)/gu,
      ),
    ).toHaveLength(2);
    const highWaterSql = migrationSql.slice(
      highWaterStart,
      migrationSql.indexOf('select count(*) into planned_count', highWaterStart),
    );
    expect(highWaterSql).toContain('pg_catalog.num_nonnulls(');
    expect(highWaterSql).toContain(') = 0');
    expect(highWaterSql).toContain('limit 1;');
    const envelopeColumns = [
      'revision',
      'lifecycle_status',
      'current_provenance_source',
      'current_provenance_actor_id',
      'current_provenance_reason_code',
      'current_provenance_command_id',
      'current_provenance_occurred_at',
      'current_provenance_recorded_at',
      'revoked_at',
      'deleted_at',
    ];
    const exactAllNullPredicate = (alias: string) => new RegExp(
      `pg_catalog\\.num_nonnulls\\(\\s*${envelopeColumns
        .map((columnName) => `${alias}\\.${columnName}`)
        .join(',\\s*')}\\s*\\) = 0`,
      'u',
    );
    expect(highWaterSql).toMatch(exactAllNullPredicate('member_row'));
    const plannedSql = migrationSql.slice(
      migrationSql.indexOf('select count(*) into planned_count'),
      migrationSql.indexOf('calibration_recorded_at :='),
    );
    expect(plannedSql).toMatch(exactAllNullPredicate('member_row'));
    expect(plannedSql).toContain(
      'if planned_count <= 0 or planned_count <> pre_all_null_count then',
    );
    const candidateLoopStart = migrationSql.indexOf('for candidate_row in');
    const preCandidateLoopSql = migrationSql.slice(0, candidateLoopStart);
    expect(candidateLoopStart).toBeGreaterThan(0);
    expect(migrationSql.search(/\bcandidate_row\.[a-z_]+/u)).toBeGreaterThan(
      candidateLoopStart,
    );
    expect(migrationSql).not.toMatch(/from public\.tenant_members candidate_row\b/u);
    expect(preCandidateLoopSql).not.toContain(
      'from public.tenant_members candidate_row',
    );
    expect(preCandidateLoopSql).toContain(
      'from public.tenant_members candidate_member',
    );
    expect(preCandidateLoopSql).toMatch(exactAllNullPredicate('candidate_member'));
    const loopCandidateSql = migrationSql.slice(
      candidateLoopStart,
      migrationSql.indexOf('loop\n    command_identity'),
    );
    expect(loopCandidateSql).toMatch(exactAllNullPredicate('member_row'));
    expect(
      migrationSql.match(/calibration_recorded_at := pg_catalog\.clock_timestamp\(\);/gu),
    ).toHaveLength(1);

    for (const identityFragment of [
      'zmtg:membership-calibration-command:v1',
      'zmtg:membership-calibration-transition:v1',
      'tenant_synthetic_m4',
      'membership_synthetic_m4',
      'mcal1_fdbd37decb6f6af2edafaf56fd3f9fa0bd73b8cf6f6f152856a96d71f36c11d6',
      'mtcl1_77ad99278836422ed1074f3a3ca2fe9254f6607cbef4e6ae3028388b51ba11b6',
      "pg_catalog.convert_to(command_domain, 'utf8')",
      "pg_catalog.convert_to(transition_domain, 'utf8')",
      "pg_catalog.decode('00', 'hex')",
      'pg_catalog.sha256(',
      "pg_catalog.encode(\n      pg_catalog.sha256(",
      "'^mcal1_[0-9a-f]{64}$'",
      "'^mtcl1_[0-9a-f]{64}$'",
    ]) {
      expect(migrationSql).toContain(identityFragment);
    }
    expect(migrationSql).toContain("pg_catalog.current_setting('server_version_num')");
    expect(migrationSql).toContain("pg_catalog.to_regprocedure('pg_catalog.sha256(bytea)')");
    expect(migrationSql).toMatch(
      /command_identity := 'mcal1_' \|\| pg_catalog\.encode\(\s+pg_catalog\.sha256\(\s+pg_catalog\.convert_to\(command_domain, 'utf8'\)\s+\|\| pg_catalog\.decode\('00', 'hex'\)\s+\|\| pg_catalog\.convert_to\(candidate_row\.tenant_id, 'utf8'\)\s+\|\| pg_catalog\.decode\('00', 'hex'\)\s+\|\| pg_catalog\.convert_to\(candidate_row\.id, 'utf8'\)\s+\),\s+'hex'\s+\);/u,
    );
    expect(migrationSql).toMatch(
      /evidence_identity := 'mtcl1_' \|\| pg_catalog\.encode\(\s+pg_catalog\.sha256\(\s+pg_catalog\.convert_to\(transition_domain, 'utf8'\)\s+\|\| pg_catalog\.decode\('00', 'hex'\)\s+\|\| pg_catalog\.convert_to\(candidate_row\.tenant_id, 'utf8'\)\s+\|\| pg_catalog\.decode\('00', 'hex'\)\s+\|\| pg_catalog\.convert_to\(candidate_row\.id, 'utf8'\)\s+\),\s+'hex'\s+\);/u,
    );

    const catalogFingerprintArrays = [
      ...migrationSql.matchAll(/is distinct from array\[\s*([\s\S]*?)\s*\]::text\[\]/gu),
    ]
      .map((match) => [...(match[1] ?? '').matchAll(/'([^']+:[0-9a-f]{64})'/gu)]
        .map((fingerprintMatch) => fingerprintMatch[1]))
      .filter((fingerprints) => fingerprints.length > 0);
    expect(catalogFingerprintArrays).toEqual([
      [
        'tenant_members_current_envelope_shape_check:82796868c10f6bcd25a49786b9652badcf88c577b7b440da3545cd518016ec1f',
        'tenant_members_pkey:8c8464f42472e42ee190fc91ca8db79b5351d3a4609040516578d229c56f6fa5',
        'tenant_members_tenant_id_id_unique:df85201802c68cde29d160aa847142747ee29b47a7699f4a3b0d143b054cad73',
        'tenant_members_tenant_id_tenants_id_fk:d931da577fc120910fe105fe12727c52721a31800b4baf73445d56de61900526',
        'tenant_members_user_id_auth_users_id_fk:058d1e81ee627f1b5d45598b07bd6cdfe67fc541654147b661297e10fbf101b0',
      ],
      [
        'tenant_members_pkey:7ae73a32a715719614e05bafb26e3b6bd9e1d2eb32d6c6a2fa014899f9f0da16',
        'tenant_members_tenant_id_id_unique:6e43c3122c3333c08151edda05e61e552d7bba6fc9373fe3b2b297996437a926',
        'tenant_members_tenant_role_idx:902c85e1272f42eb13ec1621649a530485879cfb5c0319fff87e0bc45e8151ec',
        'tenant_members_tenant_user_unique_idx:7acc4c982277001f8457e34060eac78374584e3bf21f9be0818a5ac8789c0cdb',
      ],
      [
        'tenant_membership_transitions_lifecycle_shape_check:70dfcaf4c8bf10950f8ef6922785eb7ddf86074c62755582891cb857f64c66de',
        'tenant_membership_transitions_membership_revision_unique:cd57b2e0e2769a37d38f06102279ea2c2a09080002d3977d9621e4817a585b0c',
        'tenant_membership_transitions_pkey:8c8464f42472e42ee190fc91ca8db79b5351d3a4609040516578d229c56f6fa5',
        'tenant_membership_transitions_provenance_shape_check:4cf86510af7b437df78fdabd5ba51f2ba1db5c050687502978eff5109d97197b',
        'tenant_membership_transitions_revision_shape_check:fb4db87e5708fc21c06e70b23f6890f02c0a78ec1d7e27ea839576fade715df3',
        'tenant_membership_transitions_role_shape_check:8563ca26c2662fd0a4b177ab2019c556dafe79035e74d8e5796c39e0480c2d97',
        'tenant_membership_transitions_tenant_command_unique:bf606fb60edbc83eafa9136366009a69ac18a74fb9c02fb17a41ebbaa024cb08',
        'tenant_membership_transitions_tenant_membership_fk:e6c34612976e004d31887ffaf8801efee9fbf10c7a5b07f11454acf58053e5cc',
      ],
      [
        'tenant_membership_transitions_membership_revision_unique:56dd77b2f14f6e15b878cf31e73912138521d484ca64e7ef21c959da8eef2d9a',
        'tenant_membership_transitions_pkey:ca8a0aa892429195d3dd8e245587e0a56a3c9e8d28a13611c72f1c4470980e37',
        'tenant_membership_transitions_tenant_command_unique:1cec9eef095a4b7c6845707649db8965a33d5cfba5ae82a69c463b50ac250687',
        'tenant_membership_transitions_tenant_membership_revision_idx:271306c04b53ae45db169680d91245ef45a9e8b007bec0444f2c34d662019b8c',
      ],
      [
        'tenant_membership_transitions_reject_row_mutation:ccf75bfb2a4814e1a2ac74288abc8d11b0f574dde0c2c9674ddca92346652ef6',
        'tenant_membership_transitions_reject_truncate:ba2700919090be08fc1666d3c10b24d4f3cbf34ed280979a4c068f7c871bcdf0',
      ],
    ]);
    expect(migrationSql).toMatch(
      /pg_catalog\.encode\(pg_catalog\.sha256\(pg_catalog\.convert_to\(\s+pg_catalog\.pg_get_functiondef\(function_row\.oid\),\s+'utf8'\s+\)\), 'hex'\) = '076415514e37e9d4c6ebc4dfd3b6cb9f12f02c0ff5ed4f9935177d6b588e1a64'/u,
    );
    for (const exactCatalogFunction of [
      'pg_catalog.pg_get_constraintdef(',
      'pg_catalog.pg_get_indexdef(',
      'pg_catalog.pg_get_triggerdef(',
      'pg_catalog.pg_get_functiondef(',
    ]) {
      expect(migrationSql).toContain(exactCatalogFunction);
    }
    for (const fkFragment of [
      "constraint_row.confmatchtype = 's'",
      "constraint_row.confupdtype = 'a'",
      "constraint_row.confdeltype = 'a'",
      'not constraint_row.condeferrable',
      'not constraint_row.condeferred',
      "constraint_row.confrelid = 'public.auth_users'::regclass",
      "constraint_row.confrelid = 'public.institution_scopes'::regclass",
      "= array['user_id']::text[]",
      "= array['tenant_id', 'institution_id']::text[]",
    ]) {
      expect(migrationSql).toContain(fkFragment);
    }
    for (const repeatedFkFragment of [
      "constraint_row.confmatchtype = 's'",
      "constraint_row.confupdtype = 'a'",
      "constraint_row.confdeltype = 'a'",
      'not constraint_row.condeferrable',
      'not constraint_row.condeferred',
    ]) {
      expect(migrationSql.split(repeatedFkFragment)).toHaveLength(3);
    }
    expect(migrationSql.split("= array['tenant_id', 'institution_id']::text[]"))
      .toHaveLength(3);
    expect(migrationSql.split("= array['user_id']::text[]")).toHaveLength(2);
    expect(migrationSql.split("= array['id']::text[]")).toHaveLength(2);

    const updateMatch = migrationSql.match(
      /update public\.tenant_members as target_member\s+set([\s\S]*?)\s+where target_member\.id/u,
    );
    expect(updateMatch).not.toBeNull();
    const currentUpdateSql = migrationSql.slice(
      currentUpdateStart,
      migrationSql.indexOf('returning', currentUpdateStart),
    );
    expect(currentUpdateSql).toMatch(exactAllNullPredicate('target_member'));
    expect(currentUpdateSql).toContain('target_member.id = candidate_row.id');
    expect(currentUpdateSql).toContain('target_member.tenant_id = candidate_row.tenant_id');
    const updatedColumns = [...(updateMatch?.[1] ?? '').matchAll(/^\s*([a-z_]+)\s*=/gmu)]
      .map((match) => match[1]);
    expect(updatedColumns).toEqual([
      'revision',
      'lifecycle_status',
      'current_provenance_source',
      'current_provenance_actor_id',
      'current_provenance_reason_code',
      'current_provenance_command_id',
      'current_provenance_occurred_at',
      'current_provenance_recorded_at',
      'revoked_at',
      'deleted_at',
    ]);
    expect(updateMatch?.[1]).toContain('revision = 1');
    expect(updateMatch?.[1]).toContain("lifecycle_status = 'active'");
    expect(updateMatch?.[1]).toContain("current_provenance_source = 'legacy_calibration'");
    expect(updateMatch?.[1]).toContain('current_provenance_actor_id = null');
    expect(updateMatch?.[1]).toContain("current_provenance_reason_code = 'legacy_unknown'");
    expect(updateMatch?.[1]).toContain('current_provenance_command_id = command_identity');
    expect(updateMatch?.[1]).toContain('current_provenance_occurred_at = null');
    expect(updateMatch?.[1]).toContain(
      'current_provenance_recorded_at = calibration_recorded_at',
    );
    for (const immutableColumn of [
      'id',
      'tenant_id',
      'user_id',
      'role',
      'display_name',
      'created_at',
      'updated_at',
    ]) {
      expect(updatedColumns).not.toContain(immutableColumn);
    }
    for (const immutableColumn of [
      'id',
      'tenant_id',
      'user_id',
      'role',
      'display_name',
      'created_at',
      'updated_at',
    ]) {
      expect(migrationSql).toContain(
        `updated_row.${immutableColumn} is distinct from candidate_row.${immutableColumn}`,
      );
    }

    const insertMatch = migrationSql.match(
      /insert into public\.tenant_membership_transitions\s*\(([\s\S]*?)\)\s*values\s*\(([\s\S]*?)\)\s*;/u,
    );
    expect(insertMatch).not.toBeNull();
    expect((insertMatch?.[1] ?? '').split(',').map((column) => column.trim())).toEqual([
      'id',
      'tenant_id',
      'membership_id',
      'command_id',
      'transition_type',
      'source',
      'actor_id',
      'reason_code',
      'from_revision',
      'to_revision',
      'from_lifecycle_status',
      'to_lifecycle_status',
      'from_role',
      'to_role',
      'occurred_at',
      'recorded_at',
    ]);
    expect((insertMatch?.[2] ?? '').split(',').map((value) => value.trim())).toEqual([
      'evidence_identity',
      'candidate_row.tenant_id',
      'candidate_row.id',
      'command_identity',
      "'legacy_calibration'",
      "'legacy_calibration'",
      'null',
      "'legacy_unknown'",
      'null',
      '1',
      'null',
      "'active'",
      'null',
      'candidate_row.role',
      'null',
      'calibration_recorded_at',
    ]);

    for (const countInvariant of [
      'planned_count <> created_count + reused_count',
      'updated_count <> inserted_count',
      'updated_count <> created_count',
      'inserted_count <> created_count',
      'created_count <> planned_count',
      'reused_count <> 0',
      'conflict_count <> 0',
      'unexpected_count <> 0',
      'pre_membership_count <> 1',
      'pre_transition_count <> 0',
      'pre_binding_count <> 1',
      'pre_scope_count <> 1',
      'pre_context_version_count <> 1',
      'pre_context_head_count <> 1',
      'pre_all_null_count <> 1',
      'pre_partial_count <> 0',
      'pre_complete_count <> 0',
      'pre_scope_relation_orphan_count <> 1',
      'pre_active_historical_orphan_count <> 1',
      'post_membership_count <> pre_membership_count',
      'post_transition_count <> pre_transition_count + created_count',
      'post_binding_count <> pre_binding_count',
      'post_scope_count <> pre_scope_count',
      'post_context_version_count <> pre_context_version_count',
      'post_context_head_count <> pre_context_head_count',
      'post_all_null_count <> pre_all_null_count - planned_count',
      'post_partial_count <> 0',
      'post_complete_count <> pre_complete_count + created_count',
      'post_scope_relation_orphan_count <> pre_scope_relation_orphan_count',
      'post_active_historical_orphan_count <> pre_active_historical_orphan_count',
    ]) {
      expect(migrationSql).toContain(countInvariant);
    }
    for (const failClosedCode of [
      'base02_membership_m4_journal_drift',
      'base02_membership_m4_current_catalog_drift',
      'base02_membership_m4_transition_catalog_drift',
      'base02_membership_m4_user_fk_drift',
      'base02_membership_m4_scope_fk_drift',
      'base02_membership_m4_data_baseline_drift',
      'base02_membership_m4_candidate_parent_missing',
      'base02_membership_m4_identity_conflict',
      'base02_membership_m4_current_update_drift',
      'base02_membership_m4_transition_insert_drift',
      'base02_membership_m4_count_postcheck_failed',
      'base02_membership_m4_current_evidence_postcheck_failed',
      'base02_membership_m4_journal_postcheck_failed',
    ]) {
      expect(migrationSql).toContain(failClosedCode);
    }

    const sqlWithoutStringLiterals = migrationSql.replace(/'(?:''|[^'])*'/gu, "''");
    expect(
      sqlWithoutStringLiterals.match(/update\s+public\.tenant_members\s+as\s+target_member/gu),
    ).toHaveLength(1);
    expect(
      sqlWithoutStringLiterals.match(/insert\s+into\s+public\.tenant_membership_transitions/gu),
    ).toHaveLength(1);
    expect(sqlWithoutStringLiterals.match(/(^|[;\n])\s*update\s+/gmu)).toHaveLength(1);
    expect(sqlWithoutStringLiterals.match(/(^|[;\n])\s*insert\s+into\s+/gmu)).toHaveLength(1);
    expect(migrationSql.match(/get diagnostics (update|insert)_row_count = row_count;/gu))
      .toHaveLength(2);
    expect(migrationSql).toContain('if update_row_count <> 1');
    expect(migrationSql).toContain('if insert_row_count <> 1');
    expect(migrationSql).toContain('updated_count := updated_count + update_row_count');
    expect(migrationSql).toContain('inserted_count := inserted_count + insert_row_count');
    expect(migrationSql).toContain('created_count := created_count + 1');
    const updateDiagnosticsStart = migrationSql.indexOf(
      'get diagnostics update_row_count = row_count;',
      currentUpdateStart,
    );
    const updateRowCountGuardStart = migrationSql.indexOf(
      'if update_row_count <> 1',
      updateDiagnosticsStart,
    );
    const insertDiagnosticsStart = migrationSql.indexOf(
      'get diagnostics insert_row_count = row_count;',
      transitionInsertStart,
    );
    const insertRowCountGuardStart = migrationSql.indexOf(
      'if insert_row_count <> 1',
      insertDiagnosticsStart,
    );
    expect(updateDiagnosticsStart).toBeGreaterThan(currentUpdateStart);
    expect(updateRowCountGuardStart).toBeGreaterThan(updateDiagnosticsStart);
    expect(transitionInsertStart).toBeGreaterThan(updateRowCountGuardStart);
    expect(insertDiagnosticsStart).toBeGreaterThan(transitionInsertStart);
    expect(insertRowCountGuardStart).toBeGreaterThan(insertDiagnosticsStart);
    expect(sqlWithoutStringLiterals).not.toMatch(
      /\b(update\s+(?!public\.tenant_members\b)|insert\s+into\s+(?!public\.tenant_membership_transitions\b)|upsert|delete\s+from|truncate\s+(table\s+)?)/iu,
    );
    expect(sqlWithoutStringLiterals).not.toMatch(
      /\b(start\s+transaction|begin\s+(transaction|work)|commit|rollback|savepoint|release\s+savepoint)\b/iu,
    );
    expect(migrationSql).not.toMatch(/(^|\n)\s*begin\s*;/mu);
    expect(sqlWithoutStringLiterals).not.toMatch(
      /\b(create|alter|drop|grant|revoke|comment\s+on|security\s+label|execute|merge|copy|call)\b/iu,
    );
    expect(migrationSql).not.toMatch(
      /on\s+conflict|if\s+not\s+exists|duplicate_object|validate\s+constraint|set\s+not\s+null|\bcascade\b|create\s+extension|\bdigest\s*\(|db:generate|retry/iu,
    );
  });

  it('Membership M5 migration 允许零候选并以高水位原子追赶合法 legacy residual', () => {
    const drizzleDir = join(process.cwd(), 'drizzle');
    const migrationFiles = readdirSync(drizzleDir).filter((fileName) =>
      /^\d{4}_base02_membership_revision_high_water_catch_up\.sql$/u.test(fileName),
    );
    const journal = JSON.parse(
      readFileSync(join(drizzleDir, 'meta/_journal.json'), 'utf8'),
    ) as {
      version: string;
      dialect: string;
      entries: Array<{
        idx: number;
        tag: string;
        version: string;
        when: number;
        breakpoints: boolean;
      }>;
    };

    expect(migrationFiles).toEqual([
      '0042_base02_membership_revision_high_water_catch_up.sql',
    ]);
    const migrationFile = migrationFiles[0]!;
    const migrationStem = migrationFile.replace(/\.sql$/u, '');
    const migrationSqlRaw = readFileSync(join(drizzleDir, migrationFile), 'utf8');
    const migrationSql = migrationSqlRaw.toLowerCase();
    const migrationEntry = journal.entries.find((entry) => entry.tag === migrationStem);
    const predecessorEntry = journal.entries[(migrationEntry?.idx ?? 0) - 1];
    const predecessorSql = readFileSync(
      join(drizzleDir, `${predecessorEntry?.tag}.sql`),
      'utf8',
    );
    const predecessorHash = createHash('sha256').update(predecessorSql).digest('hex');

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(migrationEntry).toEqual({
      idx: 42,
      tag: '0042_base02_membership_revision_high_water_catch_up',
      version: '7',
      when: 1785634157848,
      breakpoints: true,
    });
    expect(journal.entries[migrationEntry?.idx ?? -1]).toEqual(migrationEntry);
    expect(predecessorEntry?.tag).toBe(
      '0041_base02_membership_revision_legacy_calibration',
    );
    expect(predecessorHash).toBe('85efc99f76a871cb90cf5beb3d2c6fa5ae0d70665f3821d5e42f9d30125bb591');
    expect(
      createHash('sha256')
        .update(readFileSync(join(drizzleDir, 'meta/0026_snapshot.json'), 'utf8'))
        .digest('hex'),
    ).toBe('d7b1c85f42c9be783503d73abd1fa34d356d71450ec40f9f57e5be9427260e95');
    expect(
      readdirSync(drizzleDir)
        .filter((fileName) => /^\d{4}_.+\.sql$/u.test(fileName))
        .sort(),
    ).toEqual(journal.entries.map((entry) => `${entry.tag}.sql`));
    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      journal.entries.map((_, index) => index),
    );
    expect(migrationEntry?.when).toBeGreaterThan(predecessorEntry?.when ?? 0);
    expect(migrationSql).toContain(
      `expected_predecessor_count constant integer := ${migrationEntry?.idx}`,
    );
    expect(migrationSql).toContain(String(predecessorEntry?.when));
    expect(migrationSql).toContain(predecessorHash);

    expect(migrationSql).toContain("set local lock_timeout = '1s';");
    expect(migrationSql).toContain("set local statement_timeout = '30s';");
    expect(migrationSql).toContain('set local search_path = pg_catalog, public;');
    const memberLock =
      'lock table "public"."tenant_members" in share row exclusive mode;';
    const transitionLock =
      'lock table "public"."tenant_membership_transitions" in share row exclusive mode;';
    expect(migrationSql.match(/lock table "public"\."tenant_members"/gu)).toHaveLength(1);
    expect(
      migrationSql.match(/lock table "public"\."tenant_membership_transitions"/gu),
    ).toHaveLength(1);
    expect(migrationSql.indexOf(memberLock)).toBeGreaterThanOrEqual(0);
    expect(migrationSql.indexOf(transitionLock)).toBeGreaterThan(
      migrationSql.indexOf(memberLock),
    );

    const zeroCandidateStart = migrationSql.indexOf('if pre_all_null_count = 0 then');
    const highWaterStart = migrationSql.indexOf(
      'select member_row.created_at, member_row.id\n    into high_water_created_at, high_water_id',
    );
    const loopStart = migrationSql.indexOf('for candidate_row in');
    const currentUpdateStart = migrationSql.indexOf(
      'update public.tenant_members as target_member',
    );
    const transitionInsertStart = migrationSql.indexOf(
      'insert into public.tenant_membership_transitions',
    );
    expect(zeroCandidateStart).toBeGreaterThan(migrationSql.indexOf(transitionLock));
    expect(highWaterStart).toBeGreaterThan(zeroCandidateStart);
    expect(loopStart).toBeGreaterThan(highWaterStart);
    expect(currentUpdateStart).toBeGreaterThan(loopStart);
    expect(transitionInsertStart).toBeGreaterThan(currentUpdateStart);
    expect(migrationSql.slice(zeroCandidateStart, highWaterStart)).toContain(
      'high_water_created_at := null',
    );
    expect(migrationSql.slice(zeroCandidateStart, highWaterStart)).toContain(
      'high_water_id := null',
    );
    expect(migrationSql.slice(zeroCandidateStart, highWaterStart)).toContain(
      'calibration_recorded_at := null',
    );
    expect(migrationSql.slice(zeroCandidateStart, highWaterStart)).toContain(
      'planned_count := 0',
    );
    expect(migrationSql).not.toContain('base02_membership_m5_no_candidates');
    expect(migrationSql).not.toContain('planned_count <= 0');

    expect(migrationSql).toContain(
      'order by member_row.created_at desc, member_row.id collate "c" desc',
    );
    expect(migrationSql).toContain(
      'order by member_row.created_at asc, member_row.id collate "c" asc',
    );
    expect(
      migrationSql.match(
        /member_row\.id collate "c" <= high_water_id collate "c"/gu,
      ),
    ).toHaveLength(2);
    expect(
      migrationSql.match(
        /member_row\.created_at < high_water_created_at\s+or \(\s+member_row\.created_at = high_water_created_at\s+and member_row\.id collate "c" <= high_water_id collate "c"\s+\)/gu,
      ),
    ).toHaveLength(2);
    expect(migrationSql).toContain(
      'calibration_recorded_at := pg_catalog.clock_timestamp()',
    );
    expect(migrationSql.indexOf('calibration_recorded_at := pg_catalog.clock_timestamp()'))
      .toBeLessThan(loopStart);

    const envelopeColumns = [
      'revision',
      'lifecycle_status',
      'current_provenance_source',
      'current_provenance_actor_id',
      'current_provenance_reason_code',
      'current_provenance_command_id',
      'current_provenance_occurred_at',
      'current_provenance_recorded_at',
      'revoked_at',
      'deleted_at',
    ];
    const exactAllNullPredicate = (alias: string) => new RegExp(
      `pg_catalog\\.num_nonnulls\\(\\s*${envelopeColumns
        .map((columnName) => `${alias}\\.${columnName}`)
        .join(',\\s*')}\\s*\\) = 0`,
      'u',
    );
    const preCandidateLoopSql = migrationSql.slice(0, loopStart);
    expect(loopStart).toBeGreaterThan(0);
    expect(migrationSql.search(/\bcandidate_row\.[a-z_]+/u)).toBeGreaterThan(loopStart);
    expect(migrationSql).not.toMatch(/from public\.tenant_members candidate_row\b/u);
    expect(preCandidateLoopSql).not.toContain('from public.tenant_members candidate_row');
    expect(preCandidateLoopSql).toContain('from public.tenant_members candidate_member');
    expect(preCandidateLoopSql).toMatch(exactAllNullPredicate('candidate_member'));
    expect(preCandidateLoopSql).toContain('from public.tenant_members residual_member');
    expect(preCandidateLoopSql).toMatch(exactAllNullPredicate('residual_member'));
    const parentCheckStart = migrationSql.indexOf(
      'from public.tenant_members candidate_member\n    left join public.tenants tenant_row',
    );
    const parentCheckSql = migrationSql.slice(parentCheckStart, zeroCandidateStart);
    expect(parentCheckStart).toBeGreaterThan(0);
    expect(parentCheckSql).toMatch(exactAllNullPredicate('candidate_member'));
    expect(parentCheckSql).toContain(
      'left join public.auth_users user_row on user_row.id = candidate_member.user_id',
    );
    expect(parentCheckSql).toContain('tenant_row.id is null or user_row.id is null');
    const loopCandidateSql = migrationSql.slice(
      loopStart,
      migrationSql.indexOf('loop\n    command_identity'),
    );
    expect(loopCandidateSql).toMatch(exactAllNullPredicate('member_row'));

    expect(migrationSql).toContain('enum_row.enumlabel::text');
    expect(migrationSql).not.toMatch(
      /array_agg\(enum_row\.enumlabel\s+order\s+by/iu,
    );
    expect(migrationSql).toContain(
      "command_domain constant text := 'zmtg:membership-calibration-command:v1'",
    );
    expect(migrationSql).toContain(
      "transition_domain constant text := 'zmtg:membership-calibration-transition:v1'",
    );
    expect(migrationSql).toContain("pg_catalog.convert_to(command_domain, 'utf8')");
    expect(migrationSql).toContain("pg_catalog.convert_to(transition_domain, 'utf8')");
    expect(migrationSql).toContain("pg_catalog.decode('00', 'hex')");
    expect(migrationSql).toContain('pg_catalog.sha256(');
    expect(migrationSql).toContain("pg_catalog.encode(");

    const updateMatch = migrationSql.match(
      /update public\.tenant_members as target_member\s+set([\s\S]*?)\s+where target_member\.id/u,
    );
    expect(updateMatch).not.toBeNull();
    const currentUpdateSql = migrationSql.slice(
      currentUpdateStart,
      migrationSql.indexOf('returning', currentUpdateStart),
    );
    expect(currentUpdateSql).toMatch(exactAllNullPredicate('target_member'));
    expect(currentUpdateSql).toContain('target_member.id = candidate_row.id');
    expect(currentUpdateSql).toContain('target_member.tenant_id = candidate_row.tenant_id');
    const updatedColumns = [...(updateMatch?.[1] ?? '').matchAll(/^\s*([a-z_]+)\s*=/gmu)]
      .map((match) => match[1]);
    expect(updatedColumns).toEqual([
      'revision',
      'lifecycle_status',
      'current_provenance_source',
      'current_provenance_actor_id',
      'current_provenance_reason_code',
      'current_provenance_command_id',
      'current_provenance_occurred_at',
      'current_provenance_recorded_at',
      'revoked_at',
      'deleted_at',
    ]);
    expect(updateMatch?.[1]).toContain('revision = 1');
    expect(updateMatch?.[1]).toContain("lifecycle_status = 'active'");
    expect(updateMatch?.[1]).toContain("current_provenance_source = 'legacy_calibration'");
    expect(updateMatch?.[1]).toContain('current_provenance_actor_id = null');
    expect(updateMatch?.[1]).toContain("current_provenance_reason_code = 'legacy_unknown'");
    expect(updateMatch?.[1]).toContain('current_provenance_command_id = command_identity');
    expect(updateMatch?.[1]).toContain('current_provenance_occurred_at = null');
    expect(updateMatch?.[1]).toContain(
      'current_provenance_recorded_at = calibration_recorded_at',
    );
    expect(updateMatch?.[1]).toContain('revoked_at = null');
    expect(updateMatch?.[1]).toContain('deleted_at = null');
    for (const immutableColumn of [
      'id',
      'tenant_id',
      'user_id',
      'role',
      'display_name',
      'created_at',
      'updated_at',
    ]) {
      expect(updatedColumns).not.toContain(immutableColumn);
      expect(migrationSql).toContain(
        `updated_row.${immutableColumn} is distinct from candidate_row.${immutableColumn}`,
      );
    }

    const insertMatch = migrationSql.match(
      /insert into public\.tenant_membership_transitions\s*\(([\s\S]*?)\)\s*values\s*\(([\s\S]*?)\)\s*;/u,
    );
    expect(insertMatch).not.toBeNull();
    expect((insertMatch?.[1] ?? '').split(',').map((column) => column.trim())).toEqual([
      'id',
      'tenant_id',
      'membership_id',
      'command_id',
      'transition_type',
      'source',
      'actor_id',
      'reason_code',
      'from_revision',
      'to_revision',
      'from_lifecycle_status',
      'to_lifecycle_status',
      'from_role',
      'to_role',
      'occurred_at',
      'recorded_at',
    ]);
    expect((insertMatch?.[2] ?? '').split(',').map((value) => value.trim())).toEqual([
      'evidence_identity',
      'candidate_row.tenant_id',
      'candidate_row.id',
      'command_identity',
      "'legacy_calibration'",
      "'legacy_calibration'",
      'null',
      "'legacy_unknown'",
      'null',
      '1',
      'null',
      "'active'",
      'null',
      'candidate_row.role',
      'null',
      'calibration_recorded_at',
    ]);

    const preCollisionStart = migrationSql.indexOf(
      'select count(*) into pre_identity_collision_count',
    );
    const preCollisionSql = migrationSql.slice(
      preCollisionStart,
      migrationSql.indexOf('if pre_membership_count < 1', preCollisionStart),
    );
    expect(preCollisionStart).toBeGreaterThan(0);
    expect(preCollisionSql).toMatch(exactAllNullPredicate('residual_member'));
    for (const collisionFragment of [
      'existing_member.current_provenance_command_id =',
      'existing_transition.command_id =',
      'existing_transition.id =',
      'existing_transition.membership_id = residual_member.id',
      'existing_transition.to_revision = 1',
      'existing_transition.membership_id = candidate_row.id',
    ]) {
      expect(migrationSql).toContain(collisionFragment);
    }

    for (const invariant of [
      'pre_membership_count < 1',
      'pre_transition_count < pre_complete_count',
      'pre_membership_count <> pre_all_null_count + pre_complete_count',
      'pre_exact_current_head_count <> pre_complete_count',
      'pre_legacy_exact_head_count <> 1',
      'pre_duplicate_command_count <> 0',
      'pre_duplicate_revision_count <> 0',
      'pre_identity_collision_count <> 0',
      'pre_binding_count <> 1',
      'pre_scope_count <> 1',
      'pre_context_version_count <> 1',
      'pre_context_head_count <> 1',
      'pre_scope_relation_orphan_count <> 1',
      'pre_active_historical_orphan_count <> 1',
      'planned_count <> created_count + reused_count',
      'updated_count <> inserted_count',
      'updated_count <> created_count',
      'inserted_count <> created_count',
      'created_count <> planned_count',
      'reused_count <> 0',
      'conflict_count <> 0',
      'unexpected_count <> 0',
      'post_membership_count <> pre_membership_count',
      'post_transition_count <> pre_transition_count + created_count',
      'post_binding_count <> pre_binding_count',
      'post_scope_count <> pre_scope_count',
      'post_context_version_count <> pre_context_version_count',
      'post_context_head_count <> pre_context_head_count',
      'post_all_null_count <> pre_all_null_count - planned_count',
      'post_all_null_count <> 0',
      'post_partial_count <> 0',
      'post_complete_count <> pre_complete_count + created_count',
      'post_exact_current_head_count <> pre_exact_current_head_count + created_count',
      'post_exact_current_head_count <> post_complete_count',
      'post_legacy_exact_head_count <> pre_legacy_exact_head_count + created_count',
      'post_duplicate_command_count <> 0',
      'post_duplicate_revision_count <> 0',
      'post_scope_relation_orphan_count <> pre_scope_relation_orphan_count',
      'post_active_historical_orphan_count <> pre_active_historical_orphan_count',
    ]) {
      expect(migrationSql).toContain(invariant);
    }
    expect(migrationSql.match(/select count\(\*\) into (pre|post)_legacy_exact_head_count/gu))
      .toHaveLength(2);
    expect(migrationSql.match(/current_member\.current_provenance_command_id = \(/gu))
      .toHaveLength(2);
    expect(migrationSql.match(/head_transition\.id = \(/gu)).toHaveLength(2);
    expect(migrationSql.match(/head_transition\.recorded_at = current_member\.current_provenance_recorded_at/gu))
      .toHaveLength(4);
    for (const failClosedCode of [
      'base02_membership_m5_postgres_version_drift',
      'base02_membership_m5_identity_function_drift',
      'base02_membership_m5_identity_vector_drift',
      'base02_membership_m5_journal_missing',
      'base02_membership_m5_journal_drift',
      'base02_membership_m5_required_relation_missing',
      'base02_membership_m5_enum_drift',
      'base02_membership_m5_current_catalog_drift',
      'base02_membership_m5_transition_catalog_drift',
      'base02_membership_m5_user_fk_drift',
      'base02_membership_m5_scope_fk_drift',
      'base02_membership_m5_data_baseline_drift',
      'base02_membership_m5_candidate_parent_missing',
      'base02_membership_m5_high_water_missing',
      'base02_membership_m5_planned_count_drift',
      'base02_membership_m5_identity_conflict',
      'base02_membership_m5_current_update_drift',
      'base02_membership_m5_transition_insert_drift',
      'base02_membership_m5_count_postcheck_failed',
      'base02_membership_m5_current_evidence_postcheck_failed',
      'base02_membership_m5_journal_postcheck_failed',
    ]) {
      expect(migrationSql).toContain(failClosedCode);
    }

    const sqlWithoutStringLiterals = migrationSql.replace(/'(?:''|[^'])*'/gu, "''");
    expect(
      sqlWithoutStringLiterals.match(/update\s+public\.tenant_members\s+as\s+target_member/gu),
    ).toHaveLength(1);
    expect(
      sqlWithoutStringLiterals.match(/insert\s+into\s+public\.tenant_membership_transitions/gu),
    ).toHaveLength(1);
    expect(sqlWithoutStringLiterals.match(/(^|[;\n])\s*update\s+/gmu)).toHaveLength(1);
    expect(sqlWithoutStringLiterals.match(/(^|[;\n])\s*insert\s+into\s+/gmu))
      .toHaveLength(1);
    expect(migrationSql.match(/get diagnostics (update|insert)_row_count = row_count;/gu))
      .toHaveLength(2);
    expect(sqlWithoutStringLiterals).not.toMatch(
      /\b(update\s+(?!public\.tenant_members\b)|insert\s+into\s+(?!public\.tenant_membership_transitions\b)|upsert|delete\s+from|truncate\s+(table\s+)?)/iu,
    );
    expect(sqlWithoutStringLiterals).not.toMatch(
      /\b(start\s+transaction|begin\s+(transaction|work)|commit|rollback|savepoint|release\s+savepoint)\b/iu,
    );
    expect(migrationSql).not.toMatch(/(^|\n)\s*begin\s*;/mu);
    expect(sqlWithoutStringLiterals).not.toMatch(
      /\b(create|alter|drop|grant|revoke|comment\s+on|security\s+label|execute|merge|copy|call)\b/iu,
    );
    expect(migrationSql).not.toMatch(
      /on\s+conflict|if\s+not\s+exists|duplicate_object|validate\s+constraint|set\s+not\s+null|\bcascade\b|create\s+extension|\bdigest\s*\(|db:generate|retry|skip\s+locked/iu,
    );
  });

  it('Membership M7 migration 只收紧六列 NOT NULL 与同名 current CHECK', () => {
    const drizzleDir = join(process.cwd(), 'drizzle');
    const migrationFiles = readdirSync(drizzleDir).filter((fileName) =>
      /^\d{4}_base02_membership_revision_enforce\.sql$/u.test(fileName),
    );
    const journal = JSON.parse(
      readFileSync(join(drizzleDir, 'meta/_journal.json'), 'utf8'),
    ) as {
      version: string;
      dialect: string;
      entries: Array<{
        idx: number;
        tag: string;
        version: string;
        when: number;
        breakpoints: boolean;
      }>;
    };

    expect(migrationFiles).toEqual(['0043_base02_membership_revision_enforce.sql']);
    const migrationFile = migrationFiles[0]!;
    const migrationStem = migrationFile.replace(/\.sql$/u, '');
    const migrationSqlRaw = readFileSync(join(drizzleDir, migrationFile), 'utf8');
    const migrationSql = migrationSqlRaw.toLowerCase();
    const migrationEntry = journal.entries.find((entry) => entry.tag === migrationStem);
    const predecessorEntry = journal.entries[(migrationEntry?.idx ?? 0) - 1];
    const predecessorHash = createHash('sha256')
      .update(readFileSync(join(drizzleDir, `${predecessorEntry?.tag}.sql`), 'utf8'))
      .digest('hex');

    expect(journal.version).toBe('7');
    expect(journal.dialect).toBe('postgresql');
    expect(migrationEntry).toEqual({
      idx: 43,
      tag: '0043_base02_membership_revision_enforce',
      version: '7',
      when: 1785656610916,
      breakpoints: true,
    });
    expect(journal.entries.at(-1)).toEqual(migrationEntry);
    expect(predecessorEntry?.tag).toBe(
      '0042_base02_membership_revision_high_water_catch_up',
    );
    expect(predecessorHash).toBe(
      '589fa6de705b826bfe758335919c6dbaca020ba9a1de89b48f71fd1a939bb6fc',
    );
    expect(
      createHash('sha256')
        .update(readFileSync(join(drizzleDir, 'meta/0026_snapshot.json'), 'utf8'))
        .digest('hex'),
    ).toBe('d7b1c85f42c9be783503d73abd1fa34d356d71450ec40f9f57e5be9427260e95');
    expect(
      readdirSync(drizzleDir)
        .filter((fileName) => /^\d{4}_.+\.sql$/u.test(fileName))
        .sort(),
    ).toEqual(journal.entries.map((entry) => `${entry.tag}.sql`));
    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      journal.entries.map((_, index) => index),
    );
    expect(migrationEntry?.when).toBeGreaterThan(predecessorEntry?.when ?? 0);

    expect(migrationSql).toContain('expected_predecessor_count constant integer := 43');
    expect(migrationSql).toContain(String(predecessorEntry?.when));
    expect(migrationSql).not.toContain('__final_hash__');
    expect(migrationSql).toContain("set local lock_timeout = '1s';");
    expect(migrationSql).toContain("set local statement_timeout = '30s';");
    expect(migrationSql).toContain('set local search_path = pg_catalog, public;');

    const memberLock = 'lock table "public"."tenant_members" in access exclusive mode;';
    const transitionLock =
      'lock table "public"."tenant_membership_transitions" in share mode;';
    expect(migrationSql.match(/lock table "public"\."tenant_members"/gu)).toHaveLength(1);
    expect(
      migrationSql.match(/lock table "public"\."tenant_membership_transitions"/gu),
    ).toHaveLength(1);
    expect(migrationSql.indexOf(memberLock)).toBeGreaterThanOrEqual(0);
    expect(migrationSql.indexOf(transitionLock)).toBeGreaterThan(
      migrationSql.indexOf(memberLock),
    );

    expect(migrationSql).toContain("catalog_state := 'expected_m1_predecessor'");
    expect(migrationSql).toContain("catalog_state := 'all_exact'");
    expect(migrationSql).not.toContain("catalog_state := 'all_missing'");
    expect(migrationSql).toContain('planned_count integer := 7');
    expect(migrationSql).toContain('created_count := 7');
    expect(migrationSql).toContain('reused_count := 7');
    expect(migrationSql).toContain('planned_count <> created_count + reused_count');
    expect(migrationSql).toContain('conflict_count <> 0');
    expect(migrationSql).toContain('unexpected_count <> 0');

    const requiredColumns = [
      'revision',
      'lifecycle_status',
      'current_provenance_source',
      'current_provenance_reason_code',
      'current_provenance_command_id',
      'current_provenance_recorded_at',
    ];
    const setNotNullColumns = [
      ...migrationSql.matchAll(/alter column ([a-z_]+) set not null/gu),
    ].map((match) => match[1]);
    expect(setNotNullColumns).toEqual(requiredColumns);
    for (const conditionalColumn of [
      'current_provenance_actor_id',
      'current_provenance_occurred_at',
      'revoked_at',
      'deleted_at',
    ]) {
      expect(setNotNullColumns).not.toContain(conditionalColumn);
    }

    expect(
      migrationSql.match(
        /drop constraint tenant_members_current_envelope_shape_check/gu,
      ),
    ).toHaveLength(1);
    expect(
      migrationSql.match(
        /add constraint tenant_members_current_envelope_shape_check check/gu,
      ),
    ).toHaveLength(1);
    expect(migrationSql).toContain('revision is not null');
    expect(migrationSql).toContain('revision between 1 and 2147483647');
    expect(migrationSql).toContain("current_provenance_source = 'legacy_calibration'");
    expect(migrationSql).toContain("current_provenance_source = 'formal_onboarding'");
    expect(migrationSql).toContain(
      "current_provenance_source = 'access_control_command'",
    );
    expect(migrationSql).toContain("lifecycle_status = 'revoked'");
    expect(migrationSql).toContain("lifecycle_status = 'deleted'");

    for (const protectedInvariant of [
      "conname = 'auth_account_institution_bindings_scope_fk'",
      'and not constraint_row.convalidated',
      'pre_scope_relation_orphan_count <> 1',
      'pre_active_historical_orphan_count <> 1',
      'post_scope_relation_orphan_count <> pre_scope_relation_orphan_count',
      'post_active_historical_orphan_count <> pre_active_historical_orphan_count',
      'post_membership_fingerprint is distinct from pre_membership_fingerprint',
      'post_transition_fingerprint is distinct from pre_transition_fingerprint',
      'journal_count <> expected_predecessor_count',
      'journal_latest_when <> expected_predecessor_when',
    ]) {
      expect(migrationSql).toContain(protectedInvariant);
    }

    for (const failClosedCode of [
      'base02_membership_m7_postgres_version_drift',
      'base02_membership_m7_journal_missing',
      'base02_membership_m7_journal_drift',
      'base02_membership_m7_required_relation_missing',
      'base02_membership_m7_enum_drift',
      'base02_membership_m7_current_column_drift',
      'base02_membership_m7_current_catalog_conflict',
      'base02_membership_m7_current_dependency_drift',
      'base02_membership_m7_transition_catalog_drift',
      'base02_membership_m7_scope_fk_drift',
      'base02_membership_m7_data_baseline_drift',
      'base02_membership_m7_parent_or_identity_drift',
      'base02_membership_m7_postcheck_failed',
    ]) {
      expect(migrationSql).toContain(failClosedCode);
    }

    const sqlWithoutStringLiterals = migrationSql.replace(/'(?:''|[^'])*'/gu, "''");
    expect(sqlWithoutStringLiterals).not.toMatch(
      /\b(insert\s+into|update\s+|upsert|delete\s+from|truncate\s+(table\s+)?|merge\s+into|copy\s+)/iu,
    );
    expect(sqlWithoutStringLiterals).not.toMatch(
      /\b(start\s+transaction|begin\s+(transaction|work)|commit|rollback|savepoint|release\s+savepoint)\b/iu,
    );
    expect(migrationSql).not.toMatch(/(^|\n)\s*begin\s*;/mu);
    expect(migrationSql).not.toMatch(
      /if\s+not\s+exists|duplicate_object|validate\s+constraint|create\s+index\s+concurrently|\bcascade\b|db:generate|retry|skip\s+locked/iu,
    );
    expect(sqlWithoutStringLiterals).not.toMatch(
      /alter\s+table\s+public\.(?!tenant_members\b)/iu,
    );
    expect(sqlWithoutStringLiterals).not.toMatch(
      /drop\s+(table|type|index|schema)|create\s+(table|type|index|schema|trigger|function)/iu,
    );
  });
});
