import {
  createKnowledgeDocumentMetadataReaderV1,
  type KnowledgeDocumentMetadataReaderResultV1,
} from '@/modules/knowledge/application/institution/knowledge-document-metadata-reader';
import {
  createInstitutionDocumentMetadataRepository,
} from '@/modules/knowledge/server/institution-document-metadata-repository';
import { getDatabase } from '@/server/db/client';
import {
  consumeInstitutionKnowledgeReadAuthorizationV1,
  resolveInstitutionKnowledgeReadAuthorizationV1,
} from '@/server/orchestration/institution-knowledge-read-authorization';

export type InstitutionKnowledgeDocumentMetadataResultV1 =
  | KnowledgeDocumentMetadataReaderResultV1
  | Readonly<{ kind: 'forbidden' }>;

const FORBIDDEN = Object.freeze({
  kind: 'forbidden',
} as const);
const UNAVAILABLE = Object.freeze({
  kind: 'unavailable',
} as const);

export async function readCurrentInstitutionKnowledgeDocumentsV1(
  searchParams: URLSearchParams,
): Promise<InstitutionKnowledgeDocumentMetadataResultV1> {
  try {
    const authorization =
      await resolveInstitutionKnowledgeReadAuthorizationV1();

    if (authorization.kind === 'forbidden') {
      return FORBIDDEN;
    }

    if (authorization.kind !== 'allowed') {
      return UNAVAILABLE;
    }

    const pair =
      consumeInstitutionKnowledgeReadAuthorizationV1(
        authorization.authorization,
      );

    if (!pair) return UNAVAILABLE;

    const source =
      createInstitutionDocumentMetadataRepository(
        getDatabase(),
      );

    const reader =
      createKnowledgeDocumentMetadataReaderV1({
        source,
      });

    return await reader.read({
      tenantId: pair.tenantId,
      institutionId: pair.institutionId,
      searchParams,
    });
  } catch {
    return UNAVAILABLE;
  }
}
