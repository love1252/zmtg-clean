import { isProxy } from 'node:util/types';

import {
  KNOWLEDGE_DOCUMENT_METADATA_MAX_PAGE_V1,
  KNOWLEDGE_DOCUMENT_METADATA_PAGE_SIZE_V1,
  type KnowledgeDocumentMetadataReaderResultV1,
} from '@/modules/knowledge/application/institution/knowledge-document-metadata-pagination-contract';
import type {
  InstitutionDocumentMetadataSourceRowV1,
  InstitutionDocumentMetadataSourceV1,
} from '@/modules/knowledge/ports/institution-document-metadata-source';

export {
  KNOWLEDGE_DOCUMENT_METADATA_MAX_OFFSET_V1,
  KNOWLEDGE_DOCUMENT_METADATA_MAX_PAGE_V1,
  KNOWLEDGE_DOCUMENT_METADATA_PAGE_SIZE_V1,
  type KnowledgeDocumentMetadataItemV1,
  type KnowledgeDocumentMetadataReaderResultV1,
} from '@/modules/knowledge/application/institution/knowledge-document-metadata-pagination-contract';

export type KnowledgeDocumentMetadataReaderV1 = Readonly<{
  read: (input: Readonly<{
    tenantId: string;
    institutionId: string;
    searchParams: URLSearchParams;
  }>) => Promise<KnowledgeDocumentMetadataReaderResultV1>;
}>;

const FACTORY_KEYS = Object.freeze(['source'] as const);
const READ_KEYS = Object.freeze([
  'tenantId',
  'institutionId',
  'searchParams',
] as const);
const SOURCE_ROW_KEYS = Object.freeze([
  'tenantId',
  'institutionId',
  'documentId',
  'currentVersion',
  'title',
  'sourceLabel',
  'publishedAt',
  'publicationStatus',
] as const);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;
const canonicalUtcInstant =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const INVALID_QUERY = Object.freeze({
  kind: 'invalid_query',
  code: 'invalid_knowledge_document_query',
} as const);
const UNAVAILABLE = Object.freeze({
  kind: 'unavailable',
} as const);

function snapshot(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || isProxy(value)
      || Object.getPrototypeOf(value) !== Object.prototype
    ) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== keys.length
      || keys.some((key) => !Object.hasOwn(descriptors, key))
    ) return null;

    const result: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (
        !descriptor
        || !descriptor.enumerable
        || !('value' in descriptor)
      ) return null;

      Object.defineProperty(result, key, {
        value: descriptor.value,
        enumerable: true,
      });
    }

    return Object.freeze(result);
  } catch {
    return null;
  }
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && idPattern.test(value);
}

function isCanonicalText(
  value: unknown,
  maximumCodePoints: number,
): value is string {
  return (
    typeof value === 'string'
    && value.length > 0
    && value.trim() === value
    && value.normalize('NFC') === value
    && [...value].length <= maximumCodePoints
  );
}

function parseQuery(
  searchParams: URLSearchParams,
): Readonly<{ page: number }> | null {
  try {
    if (
      !(searchParams instanceof URLSearchParams)
      || isProxy(searchParams)
    ) return null;

    for (const key of searchParams.keys()) {
      if (
        key !== 'page'
        || searchParams.getAll(key).length !== 1
      ) return null;
    }

    const rawPage = searchParams.get('page');
    if (
      rawPage !== null
      && !/^(?:[1-9]|[1-9]\d|100)$/u.test(rawPage)
    ) return null;

    const page = rawPage === null ? 1 : Number(rawPage);
    if (
      !Number.isSafeInteger(page)
      || page < 1
      || page > KNOWLEDGE_DOCUMENT_METADATA_MAX_PAGE_V1
    ) return null;

    return Object.freeze({ page });
  } catch {
    return null;
  }
}

function parseSourceRow(
  value: unknown,
  tenantId: string,
  institutionId: string,
): InstitutionDocumentMetadataSourceRowV1 | null {
  const row = snapshot(value, SOURCE_ROW_KEYS);

  if (
    !row
    || row.tenantId !== tenantId
    || row.institutionId !== institutionId
    || !isId(row.documentId)
    || !Number.isSafeInteger(row.currentVersion)
    || Number(row.currentVersion) <= 0
    || !isCanonicalText(row.title, 200)
    || !isCanonicalText(row.sourceLabel, 160)
    || typeof row.publishedAt !== 'string'
    || !canonicalUtcInstant.test(row.publishedAt)
    || !Number.isFinite(Date.parse(row.publishedAt))
    || new Date(Date.parse(row.publishedAt)).toISOString()
      !== row.publishedAt
    || row.publicationStatus !== 'published'
  ) return null;

  return Object.freeze({
    tenantId,
    institutionId,
    documentId: row.documentId,
    currentVersion: Number(row.currentVersion),
    title: row.title,
    sourceLabel: row.sourceLabel,
    publishedAt: row.publishedAt,
    publicationStatus: 'published',
  });
}

function makeReader(
  source: InstitutionDocumentMetadataSourceV1 | null,
): KnowledgeDocumentMetadataReaderV1 {
  return Object.freeze({
    async read(value) {
      const input = snapshot(value, READ_KEYS);

      if (
        !input
        || !isId(input.tenantId)
        || !isId(input.institutionId)
        || !(input.searchParams instanceof URLSearchParams)
      ) return UNAVAILABLE;

      const query = parseQuery(input.searchParams);
      if (!query) return INVALID_QUERY;

      if (
        !source
        || typeof source.list !== 'function'
        || isProxy(source.list)
      ) return UNAVAILABLE;

      try {
        const rows = await source.list({
          tenantId: input.tenantId,
          institutionId: input.institutionId,
          limit: KNOWLEDGE_DOCUMENT_METADATA_PAGE_SIZE_V1 + 1,
          offset:
            (query.page - 1)
            * KNOWLEDGE_DOCUMENT_METADATA_PAGE_SIZE_V1,
        });

        if (
          !Array.isArray(rows)
          || rows.length
            > KNOWLEDGE_DOCUMENT_METADATA_PAGE_SIZE_V1 + 1
        ) return UNAVAILABLE;

        const parsedRows = rows.map((row) =>
          parseSourceRow(
            row,
            input.tenantId as string,
            input.institutionId as string,
          ),
        );

        if (parsedRows.some((row) => row === null)) {
          return UNAVAILABLE;
        }

        const records = Object.freeze(
          parsedRows
            .slice(0, KNOWLEDGE_DOCUMENT_METADATA_PAGE_SIZE_V1)
            .map((row) => {
              if (!row) {
                throw new Error(
                  'knowledge_document_metadata_row_unavailable',
                );
              }

              return Object.freeze({
                contractVersion: 'v1' as const,
                documentId: row.documentId,
                title: row.title,
                version: row.currentVersion,
                sourceLabel: row.sourceLabel,
                publishedAt: row.publishedAt,
              });
            }),
        );

        return Object.freeze({
          kind: 'ready' as const,
          records,
          pageInfo: Object.freeze({
            page: query.page,
            pageSize: KNOWLEDGE_DOCUMENT_METADATA_PAGE_SIZE_V1,
            hasMore:
              rows.length
              > KNOWLEDGE_DOCUMENT_METADATA_PAGE_SIZE_V1,
          }),
        });
      } catch {
        return UNAVAILABLE;
      }
    },
  });
}

export function createKnowledgeDocumentMetadataReaderV1(
  input: Readonly<{
    source: InstitutionDocumentMetadataSourceV1;
  }>,
): KnowledgeDocumentMetadataReaderV1 {
  const record = snapshot(input, FACTORY_KEYS);

  return makeReader(
    record
      && record.source !== null
      && typeof record.source === 'object'
      && !isProxy(record.source)
      && typeof (
        record.source as InstitutionDocumentMetadataSourceV1
      ).list === 'function'
      ? (record.source as InstitutionDocumentMetadataSourceV1)
      : null,
  );
}
