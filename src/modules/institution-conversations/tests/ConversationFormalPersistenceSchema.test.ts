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
    'drizzle/0049_conversations_formal_fact_persistence.sql',
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

describe('Conversation formal persistence', () => {
  it('正式 source provenance 不允许 mock/seed/demo', () => {
    expect(schema.conversationFormalSourceKindEnum.enumValues).toEqual([
      'approved_channel_connection',
      'approved_internal_operation',
    ]);

    const block = schemaSource.slice(
      schemaSource.indexOf('export const conversationFormalSourceKindEnum'),
    );
    expect(block).not.toMatch(/\bmock\b|\bseed\b|\bdemo\b/u);
  });

  it('核心 enum 与 CONV-01 domain 契约一致', () => {
    expect(schema.conversationRootIdentityStateEnum.enumValues).toEqual([
      'matched',
      'pending_review',
      'unmatched',
      'conflict',
    ]);
    expect(schema.conversationSegmentStateEnum.enumValues).toEqual([
      'ai_handling',
      'awaiting_human',
      'human_handling',
      'waiting_customer',
      'closed',
    ]);
    expect(schema.conversationMessageDirectionEnum.enumValues).toEqual([
      'inbound',
      'outbound',
      'system',
    ]);
    expect(schema.conversationMessageSenderKindEnum.enumValues).toEqual([
      'customer',
      'human',
      'ai',
      'system',
    ]);
    expect(schema.conversationAssignmentStatusEnum.enumValues).toEqual([
      'assigned',
      'accepted',
      'rejected',
      'released',
    ]);
    expect(schema.conversationRiskDomainEnum.enumValues).toEqual([
      'clinical',
      'non_clinical',
    ]);
    expect(schema.conversationMessageResultStageEnum.enumValues).toEqual([
      'message_transport',
      'provider_acceptance',
      'channel_delivery',
    ]);
  });

  it('source 与六类 Conversation persistence 均保持 exact institution scope', () => {
    const sourceConfig = getTableConfig(schema.conversationFormalSources);
    const conversationConfig = getTableConfig(schema.conversations);
    const segmentConfig = getTableConfig(schema.conversationSegments);
    const messageConfig = getTableConfig(schema.conversationMessages);
    const assignmentConfig = getTableConfig(schema.conversationAssignments);
    const riskConfig = getTableConfig(schema.conversationRisks);
    const resultConfig = getTableConfig(schema.conversationMessageResults);

    expect(
      foreignKeyColumns(
        sourceConfig.foreignKeys.find(
          (foreignKey) => foreignKey.getName() === 'conversation_formal_sources_scope_fk',
        ),
      ),
    ).toEqual({
      columns: ['tenant_id', 'institution_id'],
      foreignColumns: ['tenant_id', 'institution_id'],
    });

    expect(
      foreignKeyColumns(
        conversationConfig.foreignKeys.find(
          (foreignKey) => foreignKey.getName() === 'conversations_source_fk',
        ),
      ),
    ).toEqual({
      columns: ['tenant_id', 'institution_id', 'source_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'id'],
    });

    expect(
      foreignKeyColumns(
        segmentConfig.foreignKeys.find(
          (foreignKey) => foreignKey.getName() === 'conversation_segments_conversation_fk',
        ),
      ),
    ).toEqual({
      columns: ['tenant_id', 'institution_id', 'conversation_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'id'],
    });

    expect(
      foreignKeyColumns(
        messageConfig.foreignKeys.find(
          (foreignKey) => foreignKey.getName() === 'conversation_messages_segment_fk',
        ),
      ),
    ).toEqual({
      columns: ['tenant_id', 'institution_id', 'conversation_id', 'segment_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'conversation_id', 'id'],
    });

    expect(
      foreignKeyColumns(
        assignmentConfig.foreignKeys.find(
          (foreignKey) => foreignKey.getName() === 'conversation_assignments_segment_fk',
        ),
      ),
    ).toEqual({
      columns: ['tenant_id', 'institution_id', 'conversation_id', 'segment_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'conversation_id', 'id'],
    });

    expect(
      foreignKeyColumns(
        riskConfig.foreignKeys.find(
          (foreignKey) => foreignKey.getName() === 'conversation_risks_message_fk',
        ),
      ),
    ).toEqual({
      columns: ['tenant_id', 'institution_id', 'source_message_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'id'],
    });

    expect(
      foreignKeyColumns(
        resultConfig.foreignKeys.find(
          (foreignKey) => foreignKey.getName() === 'conversation_message_results_message_fk',
        ),
      ),
    ).toEqual({
      columns: ['tenant_id', 'institution_id', 'message_id'],
      foreignColumns: ['tenant_id', 'institution_id', 'id'],
    });
  });

  it('消息只持久化授权引用和低敏摘要，不持久化消息正文', () => {
    const messageColumns = columnNames(
      getTableConfig(schema.conversationMessages).columns,
    );

    expect(messageColumns).toEqual(expect.arrayContaining([
      'authorized_content_reference',
      'safe_summary_code',
      'source_message_ref',
      'idempotency_key',
    ]));

    expect(messageColumns).not.toEqual(expect.arrayContaining([
      'content',
      'message_content',
      'raw_payload',
      'provider_raw_response',
      'transcript',
    ]));

    const dialect = new PgDialect();
    const checks = new Map(
      getTableConfig(schema.conversationMessages).checks.map((constraint) => [
        constraint.name,
        dialect.sqlToQuery(constraint.value).sql.toLowerCase(),
      ]),
    );
    expect(checks.get('conversation_messages_sender_direction_check')).toMatch(
      /inbound.*customer.*outbound.*human.*ai.*system/su,
    );
  });

  it('current root/segment 使用 revision guard，event facts immutable，0049 不写业务事实', () => {
    expect(migrationSource).toContain(
      'CREATE TRIGGER "conversations_current_state_guard"',
    );
    expect(migrationSource).toContain(
      'CREATE TRIGGER "conversation_segments_current_state_guard"',
    );
    expect(migrationSource).toContain(
      'CONVERSATION_CURRENT_STATE_REVISION_GUARD',
    );

    for (const trigger of [
      'conversation_sources_immutable_guard',
      'conversation_messages_immutable_guard',
      'conversation_assignments_immutable_guard',
      'conversation_risks_immutable_guard',
      'conversation_message_results_immutable_guard',
    ]) {
      expect(migrationSource).toContain(`CREATE TRIGGER "${trigger}"`);
    }

    expect(migrationSource).toContain('CONVERSATION_FORMAL_FACT_IMMUTABLE');
    expect(migrationSource).not.toMatch(
      /\bINSERT\s+INTO\s+"?public"?\."?conversation/iu,
    );
    expect(migrationSource).not.toMatch(
      /\bUPDATE\s+"?public"?\."?conversation/iu,
    );
    expect(migrationSource).not.toMatch(
      /\bDELETE\s+FROM\s+"?public"?\."?conversation/iu,
    );
  });

  it('0049 predecessor 与 migration journal exact frozen', () => {
    expect(migrationSource).toContain(
      'expected_predecessor_when CONSTANT bigint := 1786900800000',
    );
    expect(journal.entries[48]).toEqual({
      idx: 48,
      version: '7',
      when: 1786900800000,
      tag: '0048_analytics_formal_fact_persistence',
      breakpoints: true,
    });
    expect(journal.entries[49]).toEqual({
      idx: 49,
      version: '7',
      when: 1786938000000,
      tag: '0049_conversations_formal_fact_persistence',
      breakpoints: true,
    });
    expect(journal.entries).toHaveLength(50);
  });
});
