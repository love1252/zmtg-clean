import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import * as schema from '@/server/db/schema';

const migration = readFileSync(
  resolve(process.cwd(), 'drizzle/0051_institution_local_excel_import.sql'),
  'utf8',
);
const runtime = readFileSync(
  resolve(process.cwd(), 'src/server/orchestration/institution-excel-import-runtime.ts'),
  'utf8',
);

describe('机构本地 Excel 导入持久化边界', () => {
  it('批次、行证据和敏感档案均精确绑定 tenant + institution', () => {
    const batch = getTableConfig(schema.institutionExcelImportBatches);
    const rows = getTableConfig(schema.institutionExcelImportRows);
    const profile = getTableConfig(schema.customerSensitiveProfiles);
    expect(batch.foreignKeys.map((key) => key.getName())).toContain('institution_excel_import_batches_scope_fk');
    expect(rows.foreignKeys.map((key) => key.getName())).toContain('institution_excel_import_rows_scope_batch_fk');
    expect(profile.foreignKeys.map((key) => key.getName())).toContain('customer_sensitive_profiles_scope_customer_fk');
    expect(rows.columns.map((column) => column.name)).toContain('protected_payload');
    expect(profile.columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      'protected_phone', 'protected_national_id', 'protected_external_patient_id',
    ]));
  });

  it('0051 只创建结构，不插入业务事实，并冻结导入证据', () => {
    expect(migration).toContain('expected_predecessor_when CONSTANT bigint := 1786982400000');
    expect(migration).toContain('institution_excel_import_batches_immutable_guard');
    expect(migration).toContain('institution_excel_import_rows_immutable_guard');
    expect(migration).not.toMatch(/\bINSERT\s+INTO\b|\bUPDATE\s+"?public"?\.|\bDELETE\s+FROM\b/iu);
  });

  it('Runtime 双重限制 development 与 loopback DATABASE_URL', () => {
    expect(runtime).toContain("process.env.NODE_ENV !== 'development'");
    expect(runtime).toContain("new Set(['localhost', '127.0.0.1', '::1'])");
    expect(runtime).toContain('pg_advisory_xact_lock');
    expect(runtime).toContain('customer_import_completed');
  });

  it('审计归属必须在单连接数据库事务开始前完成，避免事务内自锁', () => {
    const attributionResolution = runtime.indexOf(
      'const auditAttribution = await resolveInstitutionAuditWriterVerifiedAttributionV1',
    );
    const transactionStart = runtime.indexOf(
      'return await getDatabase().transaction',
    );

    expect(attributionResolution).toBeGreaterThan(-1);
    expect(transactionStart).toBeGreaterThan(attributionResolution);
  });

  it('journal 追加 0051 且不改写前序编号', () => {
    const journal = JSON.parse(readFileSync(
      resolve(process.cwd(), 'drizzle/meta/_journal.json'),
      'utf8',
    )) as { entries: Array<Record<string, unknown>> };
    expect(journal.entries).toHaveLength(53);
    expect(journal.entries[51]).toEqual({
      idx: 51,
      version: '7',
      when: 1787750400000,
      tag: '0051_institution_local_excel_import',
      breakpoints: true,
    });
  });
});
