import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { demoTenantAppointmentRecords } from '@/modules/institution/domain/appointment-records';
import { demoTenantFollowUpTasks } from '@/modules/institution/domain/followup-workflow';
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
  tenantMembers,
  tenants,
} from '@/server/db/schema';

type NamedColumn = { name: string };

function columnNames(columns: readonly NamedColumn[]) {
  return columns.map((column) => column.name);
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

describe('数据库结构', () => {
  it('数据库连接错误提示不泄露连接串', () => {
    expect(createDatabaseUrlErrorMessage()).toBe(
      'DATABASE_URL is required to use tenant persistence',
    );
    expect(createDatabaseUrlErrorMessage()).not.toContain('postgres://');
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
        'created_at',
        'updated_at',
      ]),
    );
    expect(treatmentColumns).toHaveLength(16);
    expect(JSON.stringify(treatmentColumns)).not.toMatch(
      /treatment_record|medical_record|diagnosis_text|clinical_note|consultation_transcript|phone_number|id_number|request_body|metadata|raw_payload|ai_generated|external_sync|token|secret|database_url/i,
    );
    expect(treatmentSummaries.appointmentId.notNull).toBe(false);
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

  it('演示种子数据覆盖预约和随访任务引用的同租户客户', () => {
    const customerKeys = new Set(
      getDemoCustomerSeedRecords().map((record) => `${record.tenantId}:${record.id}`),
    );
    const referencedCustomerKeys = [
      ...demoTenantAppointmentRecords.map(tenantCustomerKey),
      ...demoTenantFollowUpTasks.map(tenantCustomerKey),
    ];

    expect(referencedCustomerKeys.filter((key) => !customerKeys.has(key))).toEqual([]);
  });

  it('演示种子数据包含租户套餐、套餐分配和配额快照', () => {
    const plans = getDemoTenantPlanSeedRecords();
    const assignments = getDemoTenantPlanAssignmentSeedRecords();
    const snapshots = getDemoTenantQuotaSnapshotSeedRecords();

    expect(plans.map((plan) => plan.code)).toEqual(['starter-care', 'growth-care']);
    expect(assignments.map((assignment) => assignment.tenantId)).toEqual([
      'demo-tenant-001',
      'demo-tenant-002',
    ]);
    expect(snapshots.map((snapshot) => snapshot.tenantId)).toEqual([
      'demo-tenant-001',
      'demo-tenant-002',
    ]);
    expect(snapshots.every((snapshot) => snapshot.currentCustomers <= snapshot.maxCustomers)).toBe(
      true,
    );
    expect(JSON.stringify({ plans, assignments, snapshots })).not.toMatch(
      /phoneNumber|idNumber|medicalRecordNo|treatmentRecord|consultationTranscript|DATABASE_URL|secret|token/i,
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
      demoTenantAppointmentRecords.map((record) => `${record.tenantId}:${record.id}`),
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
});
