import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { demoTenantAppointmentRecords } from '@/modules/institution/domain/appointment-records';
import { demoTenantFollowUpTasks } from '@/modules/institution/domain/followup-workflow';
import { createDatabaseUrlErrorMessage } from '@/server/db/client';
import { getDemoCustomerSeedRecords } from '@/server/db/seed-demo-data';
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

function readMigrationSql() {
  const drizzleDir = join(process.cwd(), 'drizzle');
  return readdirSync(drizzleDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .map((fileName) => readFileSync(join(drizzleDir, fileName), 'utf8'))
    .join('\n')
    .toLowerCase();
}

function tenantCustomerKey(record: { tenantId: string; customerId: string }) {
  return `${record.tenantId}:${record.customerId}`;
}

describe('数据库 schema', () => {
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

  it('客户 schema 只包含脱敏字段', () => {
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

  it('演示 seed 覆盖预约和随访任务引用的同租户客户', () => {
    const customerKeys = new Set(
      getDemoCustomerSeedRecords().map((record) => `${record.tenantId}:${record.id}`),
    );
    const referencedCustomerKeys = [
      ...demoTenantAppointmentRecords.map(tenantCustomerKey),
      ...demoTenantFollowUpTasks.map(tenantCustomerKey),
    ];

    expect(referencedCustomerKeys.filter((key) => !customerKeys.has(key))).toEqual([]);
  });

  it('迁移不包含真实 PII 字段名', () => {
    const migrationSql = readMigrationSql();

    expect(migrationSql).not.toContain('"phone_number"');
    expect(migrationSql).not.toContain('"id_number"');
    expect(migrationSql).not.toContain('"medical_record_no"');
    expect(migrationSql).not.toContain('"treatment_record"');
    expect(migrationSql).not.toContain('"consultation_transcript"');
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
});
