export const KNOWLEDGE_DOCUMENT_METADATA_PAGE_SIZE_V1 = 20;
export const KNOWLEDGE_DOCUMENT_METADATA_MAX_PAGE_V1 = 100;
export const KNOWLEDGE_DOCUMENT_METADATA_MAX_OFFSET_V1 = 1980;

export type KnowledgeDocumentMetadataItemV1 = Readonly<{
  contractVersion: 'v1';
  documentId: string;
  title: string;
  version: number;
  sourceLabel: string;
  publishedAt: string;
}>;

export type KnowledgeDocumentMetadataReaderResultV1 =
  | Readonly<{
      kind: 'ready';
      records: readonly KnowledgeDocumentMetadataItemV1[];
      pageInfo: Readonly<{
        page: number;
        pageSize: typeof KNOWLEDGE_DOCUMENT_METADATA_PAGE_SIZE_V1;
        hasMore: boolean;
      }>;
    }>
  | Readonly<{
      kind: 'invalid_query';
      code: 'invalid_knowledge_document_query';
    }>
  | Readonly<{ kind: 'unavailable' }>;
