export const TRANSACTION_BOUND_SCOPE_REJECTION_CODES = [
  'scope_missing',
  'scope_inactive',
  'scope_invalid',
  'scope_unavailable',
] as const;

export type TransactionBoundScopeRejectionCode =
  (typeof TRANSACTION_BOUND_SCOPE_REJECTION_CODES)[number];

export type TransactionBoundInstitutionScopeResolution =
  | Readonly<{
      kind: 'active_scope';
      tenantId: string;
      institutionId: string;
      revision: number;
    }>
  | Readonly<{
      kind: 'rejected';
      code: TransactionBoundScopeRejectionCode;
    }>;

export interface TransactionBoundInstitutionScopeAssertion {
  assertActive(input: Readonly<{
    tenantId: string;
    institutionId: string;
  }>): Promise<TransactionBoundInstitutionScopeResolution>;
}
