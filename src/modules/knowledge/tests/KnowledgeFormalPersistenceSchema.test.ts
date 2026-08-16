import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const schemaSource = readFileSync(
  resolve(process.cwd(), 'src/server/db/schema.ts'),
  'utf8',
);

const migrationSource = readFileSync(
  resolve(
    process.cwd(),
    'drizzle/0047_knowledge_formal_fact_provenance_scope.sql',
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

describe('Knowledge formal persistence prerequisite', () => {
  it('canonical schema 明确区分正式 source provenance，不复用 mock/seed/demo', () => {
    expect(schemaSource).toContain(
      "export const knowledgeFormalProvenanceSourceEnum = pgEnum(",
    );
    expect(schemaSource).toContain("'formal_onboarding'");
    expect(schemaSource).toContain("'approved_migration_manifest'");
    expect(schemaSource).toContain(
      "export const knowledgeFormalSources = pgTable(",
    );

    const formalBlock = schemaSource.slice(
      schemaSource.indexOf('export const knowledgeFormalSources'),
      schemaSource.indexOf('export const knowledgeSources'),
    );

    expect(formalBlock).not.toMatch(/\bmock\b|\bseed\b|\bdemo\b/u);
  });

  it('正式 source 绑定 exact tenant/institution formal Scope', () => {
    expect(schemaSource).toContain(
      "name: 'knowledge_formal_sources_scope_fk'",
    );
    expect(schemaSource).toContain(
      'foreignColumns: [institutionScopes.tenantId, institutionScopes.institutionId]',
    );
  });

  it('document version 是 immutable fact，current publication 使用独立 pointer', () => {
    expect(schemaSource).toContain(
      'export const knowledgeFormalDocumentVersions = pgTable(',
    );
    expect(schemaSource).toContain(
      'export const knowledgeFormalDocumentPublications = pgTable(',
    );
    expect(schemaSource).toContain(
      "name: 'knowledge_formal_document_publications_version_fk'",
    );

    expect(migrationSource).toContain(
      'CREATE TRIGGER "knowledge_formal_document_versions_immutable_guard"',
    );
    expect(migrationSource).toContain(
      'BEFORE UPDATE OR DELETE ON "public"."knowledge_formal_document_versions"',
    );
    expect(migrationSource).toContain(
      'KNOWLEDGE_FORMAL_DOCUMENT_VERSION_IMMUTABLE',
    );
  });

  it('0047 predecessor 与 migration journal exact frozen', () => {
    expect(migrationSource).toContain(
      'expected_predecessor_when CONSTANT bigint := 1786867010908',
    );
    expect(journal.entries[47]).toEqual({
      idx: 47,
      version: '7',
      when: 1786886640000,
      tag: '0047_knowledge_formal_fact_provenance_scope',
      breakpoints: true,
    });
  });

  it('0047 只建立 formal persistence，不写入 Knowledge 业务事实', () => {
    expect(migrationSource).not.toMatch(
      /\bINSERT\s+INTO\s+"?public"?\."?knowledge_formal_/iu,
    );
    expect(migrationSource).not.toMatch(
      /\bUPDATE\s+"?public"?\."?knowledge_formal_/iu,
    );
    expect(migrationSource).not.toMatch(
      /\bDELETE\s+FROM\s+"?public"?\."?knowledge_formal_/iu,
    );
  });
});
