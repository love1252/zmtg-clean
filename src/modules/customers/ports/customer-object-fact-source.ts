export type CustomerObjectFactSourceQueryV1 = Readonly<{
  customerId: string;
  tenantId: string;
  institutionId: string;
}>;

export type CustomerObjectFactSourceCandidateV1 = Readonly<{
  customerId: string;
  tenantId: string;
  institutionId: string;
  updatedAt: string;
}>;

export type CustomerObjectFactSourceResolverV1 = (
  input: CustomerObjectFactSourceQueryV1,
) => Promise<CustomerObjectFactSourceCandidateV1 | null>;

export type CustomerObjectFactSourceFailureCodeV1 =
  | 'customer_denied'
  | 'customer_invalid'
  | 'customer_unavailable';

export type CustomerObjectFactSourceResolutionV1 =
  | Readonly<{
      kind: 'customer_current_source';
      customerId: string;
      tenantId: string;
      institutionId: string;
      updatedAt: string;
    }>
  | Readonly<{
      kind: 'rejected';
      code: CustomerObjectFactSourceFailureCodeV1;
    }>;

export type CustomerObjectFactSourceV1 = Readonly<{
  resolve: (
    input: CustomerObjectFactSourceQueryV1,
  ) => Promise<CustomerObjectFactSourceResolutionV1>;
}>;
