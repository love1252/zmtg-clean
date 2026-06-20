import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { createDatabaseUrlErrorMessage } from '@/server/db/client';
import {
  getDemoCustomerSeedRecords,
  getDemoTenantPlanAssignmentSeedRecords,
  getDemoTenantPlanSeedRecords,
  getDemoTenantQuotaSnapshotSeedRecords,
} from '@/server/db/seed-demo-data';
import * as seedDemoData from '@/server/db/seed-demo-data';
import * as schema from '@/server/db/schema';
import {
  appointments,
  auditEvents,
  customers,
  followUpTasks,
  hisConnectionCredentialCompensationOperations,
  tenantMembers,
  tenants,
  treatmentSummaries,
} from '@/server/db/schema';

type NamedColumn = { name: string };
type NamedForeignKey = {
  getName(): string;
  reference(): {
    columns: readonly NamedColumn[];
    foreignColumns: readonly NamedColumn[];
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
    expect(treatmentColumns).toHaveLength(20);
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

  it('演示种子数据包含租户套餐、套餐分配和配额快照', () => {
    const plans = getDemoTenantPlanSeedRecords();
    const assignments = getDemoTenantPlanAssignmentSeedRecords();
    const snapshots = getDemoTenantQuotaSnapshotSeedRecords();
    const demoTenantIds = [
      'demo-tenant-001',
      'demo-tenant-002',
      'demo-tenant-003',
      'demo-tenant-004',
    ];

    expect(plans.map((plan) => plan.code)).toEqual(
      expect.arrayContaining([
        'starter-care',
        'growth-care',
        'trial-care',
        'enterprise-care',
      ]),
    );
    expect(assignments.map((assignment) => assignment.tenantId)).toEqual(
      expect.arrayContaining(demoTenantIds),
    );
    expect(snapshots.map((snapshot) => snapshot.tenantId)).toEqual(
      expect.arrayContaining(demoTenantIds),
    );
    expect(snapshots.every((snapshot) => snapshot.currentCustomers <= snapshot.maxCustomers)).toBe(
      true,
    );
    expect(snapshots.every((snapshot) => snapshot.maxAiCalls === 0)).toBe(true);
    expect(snapshots.every((snapshot) => snapshot.currentAiCalls === 0)).toBe(true);
    expect(JSON.stringify({ plans, assignments, snapshots })).not.toMatch(
      /phoneNumber|idNumber|medicalRecordNo|treatmentRecord|consultationTranscript|DATABASE_URL|secret|token/i,
    );
  });

  it('演示种子数据包含星澜医美中心、演示角色和 Growth Plan 配额', () => {
    const tenants = getSeedRecords<{ id: string; name: string }>('getDemoTenantSeedRecords');
    const tenantMembers = getSeedRecords<{
      userId: string;
      displayName: string;
      role: string;
      tenantId: string;
    }>('getDemoTenantMemberSeedRecords');
    const plans = getDemoTenantPlanSeedRecords();
    const assignments = getDemoTenantPlanAssignmentSeedRecords();
    const quotaSnapshots = getDemoTenantQuotaSnapshotSeedRecords();

    expect(tenants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'demo-tenant-001',
          name: '星澜医美中心',
        }),
        expect.objectContaining({
          id: 'demo-tenant-002',
          name: '青禾皮肤管理',
        }),
        expect.objectContaining({
          id: 'demo-tenant-003',
          name: '澄镜医疗美容',
        }),
        expect.objectContaining({
          id: 'demo-tenant-004',
          name: '远山医美连锁',
        }),
      ]),
    );
    expect(plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'growth-care',
          name: 'Growth Plan',
        }),
        expect.objectContaining({
          code: 'trial-care',
          name: 'Trial Plan',
        }),
        expect.objectContaining({
          code: 'enterprise-care',
          name: 'Enterprise Plan',
        }),
      ]),
    );
    expect(assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'demo-tenant-001',
          planId: 'plan-growth-care',
        }),
        expect.objectContaining({
          tenantId: 'demo-tenant-002',
          planId: 'plan-starter-care',
        }),
        expect.objectContaining({
          tenantId: 'demo-tenant-003',
          planId: 'plan-trial-care',
        }),
        expect.objectContaining({
          tenantId: 'demo-tenant-004',
          planId: 'plan-enterprise-care',
        }),
      ]),
    );
    expect(quotaSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'demo-tenant-001',
          maxCustomers: expect.any(Number),
          maxAppointments: expect.any(Number),
          maxFollowUps: expect.any(Number),
        }),
        expect.objectContaining({ tenantId: 'demo-tenant-002' }),
        expect.objectContaining({ tenantId: 'demo-tenant-003' }),
        expect.objectContaining({ tenantId: 'demo-tenant-004' }),
      ]),
    );
    expect(tenantMembers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayName: '林院长', role: 'tenant_admin' }),
        expect.objectContaining({ displayName: '周运营', role: 'tenant_operator' }),
        expect.objectContaining({ displayName: '许咨询', role: 'consultant' }),
        expect.objectContaining({ displayName: '赵客服', role: 'customer_service' }),
        expect.objectContaining({ displayName: '陈医助', tenantId: 'demo-tenant-001' }),
      ]),
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

  it('演示 seed 入口采用可重复执行的 upsert 策略', () => {
    const seedSource = readFileSync(join(process.cwd(), 'src/server/db/seed-demo-data.ts'), 'utf8');

    expect(seedSource).toContain('onConflictDoUpdate');
    expect(seedSource).not.toContain('onConflictDoNothing');
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
    expect(migrationSql).not.toContain('"metadata" jsonb');
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
});
