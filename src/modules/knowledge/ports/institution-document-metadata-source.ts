export type InstitutionDocumentMetadataSourceQueryV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  limit: number;
  offset: number;
}>;

export type InstitutionDocumentMetadataSourceRowV1 = Readonly<{
  tenantId: string;
  institutionId: string;
  documentId: string;
  currentVersion: number;
  title: string;
  sourceLabel: string;
  publishedAt: string;
  publicationStatus: 'published';
}>;

export type InstitutionDocumentMetadataSourceV1 = Readonly<{
  list: (
    query: InstitutionDocumentMetadataSourceQueryV1,
  ) => Promise<readonly InstitutionDocumentMetadataSourceRowV1[]>;
}>;
