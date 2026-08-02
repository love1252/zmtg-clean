export type AuthoritativeInstitutionScopeFactQueryV1 = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

export type AuthoritativeInstitutionScopeFactV1 = Readonly<{
  kind: 'current_scope_fact';
  tenantId: string;
  institutionId: string;
  status: 'active';
  revision: number;
  observedAt: string;
}>;

export type AuthoritativeInstitutionScopeFactRejectionCodeV1 =
  | 'scope_denied'
  | 'scope_invalid'
  | 'scope_unavailable';

export type AuthoritativeInstitutionScopeFactResolutionV1 =
  | AuthoritativeInstitutionScopeFactV1
  | Readonly<{
      kind: 'rejected';
      code: AuthoritativeInstitutionScopeFactRejectionCodeV1;
    }>;

export type AuthoritativeInstitutionScopeFactReaderV1 = Readonly<{
  resolve: (
    input: AuthoritativeInstitutionScopeFactQueryV1,
  ) => Promise<AuthoritativeInstitutionScopeFactResolutionV1>;
}>;
