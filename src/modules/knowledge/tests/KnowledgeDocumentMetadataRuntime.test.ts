import {
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  createKnowledgeDocumentMetadataReaderV1,
} from '@/modules/knowledge/application/institution/knowledge-document-metadata-reader';
import type {
  InstitutionDocumentMetadataSourceV1,
} from '@/modules/knowledge/ports/institution-document-metadata-source';
import type {
  TenantDatabase,
} from '@/server/db/client';
import {
  knowledgeFormalDocumentPublications,
  knowledgeFormalDocumentVersions,
  knowledgeFormalSources,
} from '@/server/db/schema';

const drizzleMocks = vi.hoisted(() => ({
  and: vi.fn((...conditions: unknown[]) => ({
    operator: 'and',
    conditions,
  })),
  asc: vi.fn((column: unknown) => ({
    direction: 'asc',
    column,
  })),
  desc: vi.fn((column: unknown) => ({
    direction: 'desc',
    column,
  })),
  eq: vi.fn((column: unknown, value: unknown) => ({
    operator: 'eq',
    column,
    value,
  })),
}));

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('drizzle-orm')
  >()),
  ...drizzleMocks,
}));

import {
  createInstitutionDocumentMetadataRepository,
} from '@/modules/knowledge/server/institution-document-metadata-repository';

const query = Object.freeze({
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  limit: 21,
  offset: 0,
});

const sourceRow = Object.freeze({
  tenantId: 'tenant-001',
  institutionId: 'institution-001',
  documentId: 'document-001',
  currentVersion: 2,
  title: '术后护理规范',
  sourceLabel: '机构正式资料',
  publishedAt: '2026-08-16T08:00:00.000Z',
  publicationStatus: 'published' as const,
});

function createDatabase(
  rows: readonly unknown[] = [
    {
      ...sourceRow,
      publishedAt:
        new Date(sourceRow.publishedAt),
    },
  ],
) {
  const offset = vi.fn(async () => rows);
  const limit = vi.fn(() => ({ offset }));
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const secondInnerJoin =
    vi.fn(() => ({ where }));
  const firstInnerJoin =
    vi.fn(() => ({
      innerJoin: secondInnerJoin,
    }));
  const from =
    vi.fn(() => ({
      innerJoin: firstInnerJoin,
    }));
  const select =
    vi.fn((_selection?: unknown) => ({ from }));

  return {
    database: {
      select,
    } as unknown as TenantDatabase,
    select,
    from,
    firstInnerJoin,
    secondInnerJoin,
    where,
    orderBy,
    limit,
    offset,
  };
}

beforeEach(() => {
  Object.values(drizzleMocks).forEach(
    (mock) => mock.mockClear(),
  );
});

describe('Knowledge document metadata formal runtime', () => {
  it('Repository 使用 exact pair、current publication join、稳定顺序与低敏 projection', async () => {
    const db = createDatabase();
    const repository =
      createInstitutionDocumentMetadataRepository(
        db.database,
      );

    await expect(
      repository.list(query),
    ).resolves.toEqual([sourceRow]);

    expect(db.select).toHaveBeenCalledWith({
      tenantId:
        knowledgeFormalDocumentPublications.tenantId,
      institutionId:
        knowledgeFormalDocumentPublications.institutionId,
      documentId:
        knowledgeFormalDocumentPublications.documentId,
      currentVersion:
        knowledgeFormalDocumentPublications.currentVersion,
      title: knowledgeFormalDocumentVersions.title,
      sourceLabel: knowledgeFormalSources.sourceLabel,
      publishedAt:
        knowledgeFormalDocumentVersions.publishedAt,
      publicationStatus:
        knowledgeFormalDocumentPublications.status,
    });

    expect(
      Object.keys(
        db.select.mock.calls[0]?.[0] ?? {},
      ),
    ).not.toEqual(
      expect.arrayContaining([
        'provenanceReferenceDigest',
        'documentReferenceDigest',
        'approvedBy',
        'publishedBy',
        'updatedBy',
      ]),
    );

    expect(drizzleMocks.eq).toHaveBeenCalledWith(
      knowledgeFormalDocumentPublications.tenantId,
      'tenant-001',
    );
    expect(drizzleMocks.eq).toHaveBeenCalledWith(
      knowledgeFormalDocumentPublications.institutionId,
      'institution-001',
    );
    expect(drizzleMocks.eq).toHaveBeenCalledWith(
      knowledgeFormalDocumentPublications.status,
      'published',
    );
    expect(db.orderBy).toHaveBeenCalledWith(
      {
        direction: 'desc',
        column:
          knowledgeFormalDocumentVersions.publishedAt,
      },
      {
        direction: 'asc',
        column:
          knowledgeFormalDocumentPublications.documentId,
      },
    );
    expect(db.limit).toHaveBeenCalledWith(21);
    expect(db.offset).toHaveBeenCalledWith(0);
  });

  it('非法或无界 Repository query 在数据库访问前 fail-closed', async () => {
    const db = createDatabase();
    const repository =
      createInstitutionDocumentMetadataRepository(
        db.database,
      );

    for (const invalid of [
      { ...query, tenantId: '' },
      { ...query, institutionId: '' },
      { ...query, limit: 20 },
      { ...query, offset: 1 },
      { ...query, offset: 2000 },
      { ...query, extra: true },
    ]) {
      await expect(
        repository.list(invalid as never),
      ).rejects.toThrow(
        'invalid_institution_document_metadata_source_query',
      );
    }

    expect(db.select).not.toHaveBeenCalled();
  });

  it('Repository 对 cross-pair、非 published、非法时间和 overflow fail-closed', async () => {
    for (const rows of [
      [
        {
          ...sourceRow,
          institutionId: 'institution-other',
          publishedAt:
            new Date(sourceRow.publishedAt),
        },
      ],
      [
        {
          ...sourceRow,
          publicationStatus: 'retired',
          publishedAt:
            new Date(sourceRow.publishedAt),
        },
      ],
      [
        {
          ...sourceRow,
          publishedAt: new Date(Number.NaN),
        },
      ],
      Array.from(
        { length: 22 },
        () => ({
          ...sourceRow,
          publishedAt:
            new Date(sourceRow.publishedAt),
        }),
      ),
    ]) {
      const db = createDatabase(rows);

      await expect(
        createInstitutionDocumentMetadataRepository(
          db.database,
        ).list(query),
      ).rejects.toThrow();
    }
  });

  it('Reader 对 authoritative empty cohort 返回 ready_empty', async () => {
    const source: InstitutionDocumentMetadataSourceV1 =
      Object.freeze({
        list: vi.fn(async () => []),
      });

    const reader =
      createKnowledgeDocumentMetadataReaderV1({
        source,
      });

    await expect(
      reader.read({
        tenantId: 'tenant-001',
        institutionId: 'institution-001',
        searchParams: new URLSearchParams(),
      }),
    ).resolves.toEqual({
      kind: 'ready',
      records: [],
      pageInfo: {
        page: 1,
        pageSize: 20,
        hasMore: false,
      },
    });
  });

  it('Reader 输出低敏 exact contract，并正确使用 sentinel pagination', async () => {
    const list = vi.fn(async () =>
      Array.from(
        { length: 21 },
        (_, index) => ({
          ...sourceRow,
          documentId: `document-${String(
            index + 1,
          ).padStart(3, '0')}`,
        }),
      ),
    );

    const reader =
      createKnowledgeDocumentMetadataReaderV1({
        source: Object.freeze({ list }),
      });

    const result = await reader.read({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      searchParams:
        new URLSearchParams('page=2'),
    });

    expect(result).toMatchObject({
      kind: 'ready',
      pageInfo: {
        page: 2,
        pageSize: 20,
        hasMore: true,
      },
    });

    if (result.kind !== 'ready') {
      throw new Error('expected ready');
    }

    expect(result.records).toHaveLength(20);
    expect(result.records[0]).toEqual({
      contractVersion: 'v1',
      documentId: 'document-001',
      title: '术后护理规范',
      version: 2,
      sourceLabel: '机构正式资料',
      publishedAt: '2026-08-16T08:00:00.000Z',
    });
    expect(list).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      institutionId: 'institution-001',
      limit: 21,
      offset: 20,
    });
  });

  it.each([
    'page=0',
    'page=101',
    'page=1&page=2',
    'tenantId=tenant-other',
    'institutionId=institution-other',
    'keyword=护理',
  ])(
    'Reader 对非法 query %s fail-closed，且不访问 Source',
    async (queryString) => {
      const list = vi.fn(async () => []);
      const reader =
        createKnowledgeDocumentMetadataReaderV1({
          source: Object.freeze({ list }),
        });

      await expect(
        reader.read({
          tenantId: 'tenant-001',
          institutionId: 'institution-001',
          searchParams:
            new URLSearchParams(queryString),
        }),
      ).resolves.toEqual({
        kind: 'invalid_query',
        code: 'invalid_knowledge_document_query',
      });

      expect(list).not.toHaveBeenCalled();
    },
  );

  it('Reader 对 cross-pair、非法版本、非法文本和非 published row 整体 unavailable', async () => {
    for (const row of [
      {
        ...sourceRow,
        tenantId: 'tenant-other',
      },
      {
        ...sourceRow,
        currentVersion: 0,
      },
      {
        ...sourceRow,
        title: ' 术后护理规范',
      },
      {
        ...sourceRow,
        publicationStatus: 'retired',
      },
    ]) {
      const reader =
        createKnowledgeDocumentMetadataReaderV1({
          source: Object.freeze({
            list: vi.fn(async () => [row as never]),
          }),
        });

      await expect(
        reader.read({
          tenantId: 'tenant-001',
          institutionId: 'institution-001',
          searchParams: new URLSearchParams(),
        }),
      ).resolves.toEqual({
        kind: 'unavailable',
      });
    }
  });

  it('生产 Repository 不读取 legacy knowledge_sources/documents，也不投影 digest/actor', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/knowledge/server/institution-document-metadata-repository.ts',
      ),
      'utf8',
    );

    expect(source).toContain(
      'knowledgeFormalDocumentPublications',
    );
    expect(source).toContain(
      'knowledgeFormalDocumentVersions',
    );
    expect(source).toContain(
      'knowledgeFormalSources',
    );
    expect(source).not.toMatch(
      /\bknowledgeSources\b|\bknowledgeDocuments\b/u,
    );

    const projection = source.slice(
      source.indexOf('.select({'),
      source.indexOf('        })\n        .from'),
    );

    for (const forbidden of [
      'provenanceReferenceDigest:',
      'documentReferenceDigest:',
      'approvedBy:',
      'publishedBy:',
      'updatedBy:',
    ]) {
      expect(projection).not.toContain(forbidden);
    }
  });
});
