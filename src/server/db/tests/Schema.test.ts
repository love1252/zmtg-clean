import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  appointments,
  auditEvents,
  customers,
  followUpTasks,
  tenantMembers,
  tenants,
} from '@/server/db/schema';

function readMigrationSql() {
  const drizzleDir = join(process.cwd(), 'drizzle');
  return readdirSync(drizzleDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .map((fileName) => readFileSync(join(drizzleDir, fileName), 'utf8'))
    .join('\n')
    .toLowerCase();
}

describe('数据库 schema', () => {
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
    const customerUniqueConstraintNames = getTableConfig(customers).uniqueConstraints.map(
      (constraint) => constraint.getName(),
    );
    const tenantMemberIndexes = getTableConfig(tenantMembers).indexes.map((index) => index.config);

    expect(customerUniqueConstraintNames).toContain('customers_tenant_id_id_unique');
    expect(tenantMemberIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'tenant_members_tenant_user_unique_idx',
          unique: true,
        }),
        expect.objectContaining({
          name: 'tenant_members_tenant_role_idx',
          unique: false,
        }),
      ]),
    );
  });

  it('预约和随访任务通过租户加客户复合外键关联客户', () => {
    expect(getTableConfig(appointments).foreignKeys.map((foreignKey) => foreignKey.getName()))
      .toContain('appointments_tenant_customer_fk');
    expect(getTableConfig(followUpTasks).foreignKeys.map((foreignKey) => foreignKey.getName()))
      .toContain('follow_up_tasks_tenant_customer_fk');
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

    expect(migrationSql).toContain('appointments_tenant_customer_fk');
    expect(migrationSql).toContain(
      'foreign key ("tenant_id","customer_id") references "public"."customers"("tenant_id","id")',
    );
    expect(migrationSql).toContain('follow_up_tasks_tenant_customer_fk');
  });
});
