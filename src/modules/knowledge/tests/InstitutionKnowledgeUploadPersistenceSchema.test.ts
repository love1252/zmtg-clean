import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import * as schema from '@/server/db/schema';

const migration = readFileSync(
  resolve(process.cwd(), 'drizzle/0052_institution_knowledge_upload_publication.sql'),
  'utf8',
);

describe('机构知识上传与正式发布持久化边界', () => {
  it('上传草稿绑定机构、文档、来源和原始文件', () => {
    const table = getTableConfig(schema.institutionKnowledgeUploadDrafts);
    expect(table.foreignKeys.map((key) => key.getName())).toEqual(expect.arrayContaining([
      'institution_knowledge_upload_drafts_scope_fk',
      'institution_knowledge_upload_drafts_document_fk',
      'institution_knowledge_upload_drafts_source_fk',
      'institution_knowledge_upload_drafts_file_fk',
    ]));
    expect(table.columns.map((column) => column.name)).toEqual(expect.arrayContaining([
      'file_digest',
      'content_digest',
      'parser_type',
      'warning_codes',
      'revision',
      'confirmed_by',
      'published_by',
      'published_version',
    ]));
  });

  it('0052 只新增流程结构和来源枚举，不插入业务事实', () => {
    expect(migration).toContain('expected_predecessor_when CONSTANT bigint := 1787750400000');
    expect(migration).toContain("ADD VALUE 'institution_upload'");
    expect(migration).toContain('institution_knowledge_upload_drafts_publication_shape_check');
    expect(migration).not.toMatch(/\bINSERT\s+INTO\b|\bUPDATE\s+"?public"?\.|\bDELETE\s+FROM\b/iu);
  });

  it('journal 追加 0052 且保留 0051 前序', () => {
    const journal = JSON.parse(readFileSync(
      resolve(process.cwd(), 'drizzle/meta/_journal.json'),
      'utf8',
    )) as { entries: Array<Record<string, unknown>> };
    expect(journal.entries).toHaveLength(53);
    expect(journal.entries[51]?.tag).toBe('0051_institution_local_excel_import');
    expect(journal.entries[52]).toEqual({
      idx: 52,
      version: '7',
      when: 1788162722000,
      tag: '0052_institution_knowledge_upload_publication',
      breakpoints: true,
    });
  });
});
