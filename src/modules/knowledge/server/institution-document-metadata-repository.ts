import { isProxy } from 'node:util/types';

import {
  and,
  asc,
  desc,
  eq,
} from 'drizzle-orm';

import type {
  InstitutionDocumentMetadataSourceQueryV1,
  InstitutionDocumentMetadataSourceV1,
} from '@/modules/knowledge/ports/institution-document-metadata-source';
import type { TenantDatabase } from '@/server/db/client';
import {
  knowledgeFormalDocumentPublications,
  knowledgeFormalDocumentVersions,
  knowledgeFormalSources,
} from '@/server/db/schema';

const PAGE_SIZE_WITH_SENTINEL = 21;
const MAX_OFFSET = 1980;
const QUERY_KEYS = Object.freeze([
  'tenantId',
  'institutionId',
  'limit',
  'offset',
] as const);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

function isQuery(
  value: unknown,
): value is InstitutionDocumentMetadataSourceQueryV1 {
  try {
    if (
      value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || isProxy(value)
      || Object.getPrototypeOf(value) !== Object.prototype
    ) return false;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== QUERY_KEYS.length
      || QUERY_KEYS.some(
        (key) => !Object.hasOwn(descriptors, key),
      )
    ) return false;

    const query =
      value as InstitutionDocumentMetadataSourceQueryV1;

    return (
      idPattern.test(query.tenantId)
      && idPattern.test(query.institutionId)
      && query.limit === PAGE_SIZE_WITH_SENTINEL
      && Number.isSafeInteger(query.offset)
      && query.offset >= 0
      && query.offset <= MAX_OFFSET
      && query.offset % 20 === 0
    );
  } catch {
    return false;
  }
}

export function createInstitutionDocumentMetadataRepository(
  database: TenantDatabase,
): InstitutionDocumentMetadataSourceV1 {
  return Object.freeze({
    async list(query) {
      if (!isQuery(query)) {
        throw new Error(
          'invalid_institution_document_metadata_source_query',
        );
      }

      const rows = await database
        .select({
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
        })
        .from(knowledgeFormalDocumentPublications)
        .innerJoin(
          knowledgeFormalDocumentVersions,
          and(
            eq(
              knowledgeFormalDocumentVersions.tenantId,
              knowledgeFormalDocumentPublications.tenantId,
            ),
            eq(
              knowledgeFormalDocumentVersions.institutionId,
              knowledgeFormalDocumentPublications.institutionId,
            ),
            eq(
              knowledgeFormalDocumentVersions.documentId,
              knowledgeFormalDocumentPublications.documentId,
            ),
            eq(
              knowledgeFormalDocumentVersions.version,
              knowledgeFormalDocumentPublications.currentVersion,
            ),
          ),
        )
        .innerJoin(
          knowledgeFormalSources,
          and(
            eq(
              knowledgeFormalSources.tenantId,
              knowledgeFormalDocumentVersions.tenantId,
            ),
            eq(
              knowledgeFormalSources.institutionId,
              knowledgeFormalDocumentVersions.institutionId,
            ),
            eq(
              knowledgeFormalSources.id,
              knowledgeFormalDocumentVersions.sourceId,
            ),
          ),
        )
        .where(
          and(
            eq(
              knowledgeFormalDocumentPublications.tenantId,
              query.tenantId,
            ),
            eq(
              knowledgeFormalDocumentPublications.institutionId,
              query.institutionId,
            ),
            eq(
              knowledgeFormalDocumentPublications.status,
              'published',
            ),
          ),
        )
        .orderBy(
          desc(knowledgeFormalDocumentVersions.publishedAt),
          asc(knowledgeFormalDocumentPublications.documentId),
        )
        .limit(query.limit)
        .offset(query.offset);

      if (rows.length > PAGE_SIZE_WITH_SENTINEL) {
        throw new Error(
          'institution_document_metadata_source_overflow',
        );
      }

      return Object.freeze(
        rows.map((row) => {
          if (
            row.tenantId !== query.tenantId
            || row.institutionId !== query.institutionId
            || row.publicationStatus !== 'published'
            || !(row.publishedAt instanceof Date)
            || !Number.isFinite(row.publishedAt.getTime())
          ) {
            throw new Error(
              'institution_document_metadata_source_row_invalid',
            );
          }

          return Object.freeze({
            tenantId: row.tenantId,
            institutionId: row.institutionId,
            documentId: row.documentId,
            currentVersion: row.currentVersion,
            title: row.title,
            sourceLabel: row.sourceLabel,
            publishedAt: row.publishedAt.toISOString(),
            publicationStatus: 'published' as const,
          });
        }),
      );
    },
  });
}
