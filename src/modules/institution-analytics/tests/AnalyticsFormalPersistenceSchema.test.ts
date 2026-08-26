import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import * as schema from '@/server/db/schema';

const schemaSource = readFileSync(
  resolve(process.cwd(), 'src/server/db/schema.ts'),
  'utf8',
);

const migrationSource = readFileSync(
  resolve(
    process.cwd(),
    'drizzle/0048_analytics_formal_fact_persistence.sql',
  ),
  'utf8',
);

const journal = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'drizzle/meta/_journal.json'),
    'utf8',
  ),
) as {
  entries: Array<{
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
};

function columnNames(columns: readonly { name: string }[]) {
  return columns.map((column) => column.name);
}

function foreignKeyColumns(
  foreignKey:
    | {
        reference(): {
          columns: readonly { name: string }[];
          foreignColumns: readonly { name: string }[];
        };
      }
    | undefined,
) {
  expect(foreignKey).toBeDefined();
  const reference = foreignKey?.reference();
  return {
    columns: columnNames(reference?.columns ?? []),
    foreignColumns: columnNames(reference?.foreignColumns ?? []),
  };
}

describe('Analytics formal persistence', () => {
  it('正式 source provenance 不允许 mock/seed/demo', () => {
    expect(schema.analyticsFormalSourceKindEnum.enumValues).toEqual([
      'approved_import_manifest',
      'approved_integration_registration',
    ]);

    const block = schemaSource.slice(
      schemaSource.indexOf('export const analyticsFormalSourceKindEnum'),
    );

    expect(block).not.toMatch(/\bmock\b|\bseed\b|\bdemo\b/u);
  });

  it('source、batch、fact 保持 exact institution scope', () => {
    const sourceConfig = getTableConfig(schema.analyticsFormalSources);
    const batchConfig = getTableConfig(schema.analyticsFormalIngestionBatches);
    const factConfig = getTableConfig(schema.analyticsConsumptionFacts);

    expect(
      foreignKeyColumns(
        sourceConfig.foreignKeys.find(
          (foreignKey) => foreignKey.getName() === 'analytics_sources_scope_fk',
        ),
      ),
    ).toEqual({
      columns: ['tenant_id', 'institution_id'],
      foreignColumns: ['tenant_id', 'institution_id'],
    });

    expect(
      foreignKeyColumns(
        batchConfig.foreignKeys.find(
          (foreignKey) => foreignKey.getName() === 'analytics_batches_source_fk',
        ),
      ),
    ).toEqual({
      columns: ['tenant_id', 'institution_id', 'source_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'id'],
    });

    expect(
      foreignKeyColumns(
        factConfig.foreignKeys.find(
          (foreignKey) => foreignKey.getName() === 'analytics_facts_batch_fk',
        ),
      ),
    ).toEqual({
      columns: [
        'tenant_id',
        'institution_id',
        'source_id',
        'batch_or_connection_ref',
      ],
      foreignColumns: [
        'tenant_id',
        'institution_id',
        'source_id',
        'batch_or_connection_ref',
      ],
    });

    expect(
      foreignKeyColumns(
        factConfig.foreignKeys.find(
          (foreignKey) => foreignKey.getName() === 'analytics_facts_customer_fk',
        ),
      ),
    ).toEqual({
      columns: ['tenant_id', 'institution_id', 'customer_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'id'],
    });
  });

  it('event、金额、attribution 与 refund link 对齐 AN-01 domain', () => {
    expect(schema.analyticsConsumptionEventTypeEnum.enumValues).toEqual([
      'payment_succeeded',
      'payment_pending',
      'payment_failed',
      'payment_cancelled',
      'refund_confirmed',
      'refund_pending',
      'refund_failed',
      'refund_cancelled',
    ]);

    expect(schema.analyticsCustomerAttributionStatusEnum.enumValues).toEqual([
      'matched',
      'unmatched',
      'pending_review',
    ]);

    expect(schema.analyticsProjectAttributionStatusEnum.enumValues).toEqual([
      'mapped',
      'unmapped',
      'pending_review',
    ]);

    expect(schema.analyticsRefundLinkStatusEnum.enumValues).toEqual([
      'not_applicable',
      'linked',
      'orphan_verified',
    ]);

    const factConfig = getTableConfig(schema.analyticsConsumptionFacts);
    const dialect = new PgDialect();
    const checks = new Map(
      factConfig.checks.map((constraint) => [
        constraint.name,
        dialect.sqlToQuery(constraint.value).sql.toLowerCase(),
      ]),
    );

    expect(checks.get('analytics_facts_amount_check')).toContain(
      'between 1 and 9007199254740991',
    );
    expect(checks.get('analytics_facts_event_family_check')).toMatch(
      /payment_succeeded.*refund_confirmed/su,
    );
    expect(checks.get('analytics_facts_customer_attribution_check')).toMatch(
      /matched.*unmatched.*pending_review/su,
    );
    expect(checks.get('analytics_facts_project_attribution_check')).toMatch(
      /mapped.*unmapped.*pending_review/su,
    );
    expect(checks.get('analytics_facts_refund_link_check')).toMatch(
      /not_applicable.*linked.*orphan_verified/su,
    );
  });

  it('source、batch、fact 均为 immutable，0048 不写业务事实', () => {
    for (const trigger of [
      'analytics_sources_immutable_guard',
      'analytics_batches_immutable_guard',
      'analytics_facts_immutable_guard',
    ]) {
      expect(migrationSource).toContain(`CREATE TRIGGER "${trigger}"`);
    }

    expect(migrationSource).toContain(
      'ANALYTICS_FORMAL_PERSISTENCE_IMMUTABLE',
    );

    expect(migrationSource).not.toMatch(
      /\bINSERT\s+INTO\s+"?public"?\."?analytics_/iu,
    );
    expect(migrationSource).not.toMatch(
      /\bUPDATE\s+"?public"?\."?analytics_/iu,
    );
    expect(migrationSource).not.toMatch(
      /\bDELETE\s+FROM\s+"?public"?\."?analytics_/iu,
    );
  });

  it('0048 predecessor 与 journal exact frozen', () => {
    expect(migrationSource).toContain(
      'expected_predecessor_when CONSTANT bigint := 1786886640000',
    );

    expect(journal.entries[47]).toEqual({
      idx: 47,
      version: '7',
      when: 1786886640000,
      tag: '0047_knowledge_formal_fact_provenance_scope',
      breakpoints: true,
    });

    expect(journal.entries[48]).toEqual({
      idx: 48,
      version: '7',
      when: 1786900800000,
      tag: '0048_analytics_formal_fact_persistence',
      breakpoints: true,
    });

    expect(journal.entries).toHaveLength(52);
  });
});
