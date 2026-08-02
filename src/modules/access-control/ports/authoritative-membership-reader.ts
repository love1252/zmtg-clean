import type { MembershipRole } from '@/modules/access-control/domain/membership-lifecycle';

export type AuthoritativeMembershipFactQueryV1 = Readonly<{
  accountId: string;
  tenantId: string;
  institutionId: string;
}>;

export type AuthoritativeSingleMembershipFactQueryV1 = Readonly<{
  accountId: string;
}>;

export type AuthoritativeMembershipFactV1 = Readonly<{
  kind: 'current_membership_fact';
  accountId: string;
  tenantId: string;
  institutionId: string;
  role: MembershipRole;
  membershipDisplayName: string;
  membershipId: string;
  membershipRevision: number;
  membershipLifecycleStatus: 'active';
  bindingId: string;
  bindingRevision: number;
  bindingRevisionAt: string;
  bindingExpiresAt: string | null;
  observedAt: string;
}>;

export type AuthoritativeMembershipFactRejectionCodeV1 =
  | 'membership_denied'
  | 'membership_invalid'
  | 'membership_unavailable';

export type AuthoritativeMembershipFactResolutionV1 =
  | AuthoritativeMembershipFactV1
  | Readonly<{
      kind: 'rejected';
      code: AuthoritativeMembershipFactRejectionCodeV1;
    }>;

export type AuthoritativeMembershipFactReaderV1 = Readonly<{
  resolve: (
    input: AuthoritativeMembershipFactQueryV1,
  ) => Promise<AuthoritativeMembershipFactResolutionV1>;
  /**
   * Credential-login compatibility selector. It succeeds only when the account has exactly one
   * complete active Membership + Binding tuple; ambiguity never becomes an implicit tenant choice.
   */
  resolveSingleForAccount: (
    input: AuthoritativeSingleMembershipFactQueryV1,
  ) => Promise<AuthoritativeMembershipFactResolutionV1>;
}>;
