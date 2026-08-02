export type AuthoritativeFormalSessionIdentityFactQueryV1 = Readonly<{
  accountId: string;
}>;

export type AuthoritativeFormalSessionIdentityFactV1 = Readonly<{
  kind: 'current_identity_fact';
  accountId: string;
  username: string;
  displayName: string;
  status: 'active';
  observedAt: string;
}>;

export type AuthoritativeFormalSessionIdentityFactRejectionCodeV1 =
  | 'identity_denied'
  | 'identity_invalid'
  | 'identity_unavailable';

export type AuthoritativeFormalSessionIdentityFactResolutionV1 =
  | AuthoritativeFormalSessionIdentityFactV1
  | Readonly<{
      kind: 'rejected';
      code: AuthoritativeFormalSessionIdentityFactRejectionCodeV1;
    }>;

export type AuthoritativeFormalSessionIdentityFactReaderV1 = Readonly<{
  resolve: (
    input: AuthoritativeFormalSessionIdentityFactQueryV1,
  ) => Promise<AuthoritativeFormalSessionIdentityFactResolutionV1>;
}>;
