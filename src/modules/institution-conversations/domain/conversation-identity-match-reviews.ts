import { types as nodeUtilTypes } from 'node:util';

/**
 * Pure, non-authorizing candidate/proposal parser. It neither reads an owner
 * snapshot nor records an IdentityMatchReview fact.
 */

export const identityMatchReviewStates = Object.freeze([
  'pending_review',
  'awaiting_customer_creation',
  'matched',
  'rejected',
  'conflict',
  'withdrawn',
  'expired',
  'revoked',
] as const);

export const identityMatchReviewLastDecisions = Object.freeze([
  'confirm_existing',
  'delegate_create_customer',
  'reject',
  'withdraw',
  'revoke',
] as const);

export const identityMatchReviewReasonCodes = Object.freeze([
  'candidate_conflict',
  'customer_creation_failed',
  'operator_rejected',
  'owner_revocation',
  'customer_withdrawal',
] as const);

export type IdentityMatchReviewState = (typeof identityMatchReviewStates)[number];
export type IdentityMatchReviewLastDecision = (typeof identityMatchReviewLastDecisions)[number];
export type IdentityMatchReviewReasonCode = (typeof identityMatchReviewReasonCodes)[number];

/**
 * Candidate field names track the frozen IdentityMatchReviewV1 vocabulary only.
 * This internal shape does not claim public-contract compatibility or authority.
 */
export type IdentityMatchReviewCandidate = Readonly<{
  contractVersion: 'v1';
  reviewId: string;
  tenantId: string;
  institutionId: string;
  conversationId: string;
  segmentId: string;
  connectionInstanceId: string;
  irreversibleIdentityReference: string;
  candidateSnapshotVersion: number;
  candidateSetDigest: string;
  submittedBy: string;
  assignedReviewer: string | null;
  lastDecision: IdentityMatchReviewLastDecision | null;
  lastDecisionReasonCode: IdentityMatchReviewReasonCode | null;
  lastDecisionActorReference: string | null;
  resolvedCustomerScope: Readonly<{ tenantId: string; institutionId: string }> | null;
  resolvedCustomerReference: string | null;
}>;

export type IdentityMatchReviewProposal = Readonly<{
  contractVersion: 'v1';
  reviewId: string;
  scope: Readonly<{ tenantId: string; institutionId: string }>;
  conversationId: string;
  segmentId: string;
  connectionInstanceId: string;
  irreversibleIdentityReference: string;
  expectedRevision: number;
  expectedCandidateSnapshotVersion: number;
  expectedCandidateSetDigest: string;
  nextCandidateSnapshotVersion: number;
  nextCandidateSetDigest: string;
  fromState: IdentityMatchReviewState;
  toState: IdentityMatchReviewState;
  action: IdentityMatchReviewAction;
  proposedCustomerScope: Readonly<{ tenantId: string; institutionId: string }> | null;
  proposedCustomerReference: string | null;
  customerResolutionRequirement: 'none' | 'owner_verified_existing_customer_reference' | 'customer_center_owner_verified_result';
  ownerRequirements: readonly OwnerRequirement[];
}>;

export type IdentityMatchReviewAction =
  | 'confirm_existing'
  | 'delegate_create_customer'
  | 'reject'
  | 'withdraw'
  | 'mark_conflict'
  | 'expire'
  | 'return_to_pending'
  | 'complete_customer_creation'
  | 'refresh_candidates'
  | 'revoke';

export type OwnerRequirement =
  | 'owner_current_snapshot'
  | 'revision_cas'
  | 'trusted_server_clock'
  | 'action_authorization'
  | 'low_sensitivity_audit_append'
  | 'owner_verified_customer_reference'
  | 'owner_verified_candidate_refresh'
  | 'customer_center_same_institution_result';

export type IdentityMatchReviewBlockCode =
  | 'candidate_snapshot_mismatch'
  | 'candidate_refresh_required'
  | 'customer_scope_mismatch'
  | 'input_invalid'
  | 'revision_conflict'
  | 'scope_mismatch'
  | 'state_conflict'
  | 'target_mismatch';

type CapturedRecord = Readonly<Record<string, unknown>>;
type CandidateResult = Readonly<{ kind: 'untrusted_candidate'; candidate: IdentityMatchReviewCandidate }>
  | Readonly<{ kind: 'blocked'; code: IdentityMatchReviewBlockCode }>;
type ProposalResult = Readonly<{ kind: 'transition_proposal'; proposal: IdentityMatchReviewProposal }>
  | Readonly<{ kind: 'blocked'; code: IdentityMatchReviewBlockCode }>;

const scopeIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const opaqueTokenPattern = /^(?=.*[a-f])[0-9a-f]{64}$/u;

const candidateKeys = Object.freeze([
  'contractVersion', 'reviewId', 'tenantId', 'institutionId', 'conversationId', 'segmentId',
  'connectionInstanceId', 'irreversibleIdentityReference', 'candidateSnapshotVersion', 'candidateSetDigest',
  'submittedBy', 'assignedReviewer', 'lastDecision', 'lastDecisionReasonCode', 'lastDecisionActorReference',
  'resolvedCustomerScope', 'resolvedCustomerReference',
] as const);

const proposalKeys = Object.freeze([
  'contractVersion', 'reviewId', 'tenantId', 'institutionId', 'conversationId', 'segmentId',
  'connectionInstanceId', 'irreversibleIdentityReference', 'expectedRevision', 'expectedCandidateSnapshotVersion',
  'expectedCandidateSetDigest', 'nextCandidateSnapshotVersion', 'nextCandidateSetDigest', 'fromState', 'toState',
  'action', 'proposedCustomerScope', 'proposedCustomerReference',
] as const);

const scopeKeys = Object.freeze(['tenantId', 'institutionId'] as const);

export const identityMatchReviewLegalTransitions = deepFreeze([
  { from: 'pending_review', to: 'matched', action: 'confirm_existing' },
  { from: 'pending_review', to: 'awaiting_customer_creation', action: 'delegate_create_customer' },
  { from: 'pending_review', to: 'rejected', action: 'reject' },
  { from: 'pending_review', to: 'conflict', action: 'mark_conflict' },
  { from: 'pending_review', to: 'withdrawn', action: 'withdraw' },
  { from: 'pending_review', to: 'expired', action: 'expire' },
  { from: 'awaiting_customer_creation', to: 'matched', action: 'complete_customer_creation' },
  { from: 'awaiting_customer_creation', to: 'pending_review', action: 'return_to_pending' },
  { from: 'awaiting_customer_creation', to: 'conflict', action: 'mark_conflict' },
  { from: 'awaiting_customer_creation', to: 'withdrawn', action: 'withdraw' },
  { from: 'awaiting_customer_creation', to: 'expired', action: 'expire' },
  { from: 'conflict', to: 'pending_review', action: 'refresh_candidates' },
  { from: 'matched', to: 'revoked', action: 'revoke' },
] as const satisfies readonly Readonly<{ from: IdentityMatchReviewState; to: IdentityMatchReviewState; action: IdentityMatchReviewAction }>[]);

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  return Object.freeze(value);
}

function blocked(code: IdentityMatchReviewBlockCode): Readonly<{ kind: 'blocked'; code: IdentityMatchReviewBlockCode }> {
  return deepFreeze({ kind: 'blocked' as const, code });
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function captureExactRecord(raw: unknown, expectedKeys: readonly string[]): CapturedRecord | null {
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw) || nodeUtilTypes.isProxy(raw) || Object.getPrototypeOf(raw) !== Object.prototype) return null;
    const ownKeys = Reflect.ownKeys(raw);
    if (ownKeys.length !== expectedKeys.length || ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function captureScopeIdentifier(value: unknown): string | null {
  return typeof value === 'string' && scopeIdentifierPattern.test(value) ? value : null;
}

function captureScope(value: unknown): Readonly<{ tenantId: string; institutionId: string }> | null {
  const scope = captureExactRecord(value, scopeKeys);
  if (!scope) return null;
  const tenantId = captureScopeIdentifier(scope.tenantId);
  const institutionId = captureScopeIdentifier(scope.institutionId);
  return tenantId && institutionId ? deepFreeze({ tenantId, institutionId }) : null;
}

function captureReference(value: unknown, prefix: string): string | null {
  if (typeof value !== 'string' || !value.startsWith(prefix)) return null;
  return opaqueTokenPattern.test(value.slice(prefix.length)) ? value : null;
}

function capturePositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value < Number.MAX_SAFE_INTEGER
    ? value
    : null;
}

function captureNullableReference(value: unknown, prefix: string): string | null | undefined {
  return value === null ? null : captureReference(value, prefix) ?? undefined;
}

function captureCandidate(raw: unknown): IdentityMatchReviewCandidate | null {
  const input = captureExactRecord(raw, candidateKeys);
  if (!input || input.contractVersion !== 'v1') return null;
  const reviewId = captureReference(input.reviewId, 'review_');
  const tenantId = captureScopeIdentifier(input.tenantId);
  const institutionId = captureScopeIdentifier(input.institutionId);
  const conversationId = captureReference(input.conversationId, 'conv_');
  const segmentId = captureReference(input.segmentId, 'seg_');
  const connectionInstanceId = captureReference(input.connectionInstanceId, 'conn_');
  const irreversibleIdentityReference = captureReference(input.irreversibleIdentityReference, 'irid_');
  const candidateSnapshotVersion = capturePositiveInteger(input.candidateSnapshotVersion);
  const candidateSetDigest = captureReference(input.candidateSetDigest, 'candsum_');
  const submittedBy = captureReference(input.submittedBy, 'actor_');
  const assignedReviewer = captureNullableReference(input.assignedReviewer, 'actor_');
  const lastDecision = input.lastDecision === null ? null : isOneOf(input.lastDecision, identityMatchReviewLastDecisions) ? input.lastDecision : undefined;
  const lastDecisionReasonCode = input.lastDecisionReasonCode === null ? null : isOneOf(input.lastDecisionReasonCode, identityMatchReviewReasonCodes) ? input.lastDecisionReasonCode : undefined;
  const lastDecisionActorReference = captureNullableReference(input.lastDecisionActorReference, 'actor_');
  const resolvedCustomerScope = input.resolvedCustomerScope === null ? null : captureScope(input.resolvedCustomerScope) ?? undefined;
  const resolvedCustomerReference = captureNullableReference(input.resolvedCustomerReference, 'cust_');
  if (!reviewId || !tenantId || !institutionId || !conversationId || !segmentId || !connectionInstanceId || !irreversibleIdentityReference || !candidateSnapshotVersion || !candidateSetDigest || !submittedBy || assignedReviewer === undefined || lastDecision === undefined || lastDecisionReasonCode === undefined || lastDecisionActorReference === undefined || resolvedCustomerScope === undefined || resolvedCustomerReference === undefined) return null;
  if ((lastDecision === null) !== (lastDecisionReasonCode === null) || (lastDecision === null) !== (lastDecisionActorReference === null)) return null;
  if ((resolvedCustomerScope === null) !== (resolvedCustomerReference === null)) return null;
  if (resolvedCustomerScope !== null && (resolvedCustomerScope.tenantId !== tenantId || resolvedCustomerScope.institutionId !== institutionId)) return null;
  return deepFreeze({ contractVersion: 'v1', reviewId, tenantId, institutionId, conversationId, segmentId, connectionInstanceId, irreversibleIdentityReference, candidateSnapshotVersion, candidateSetDigest, submittedBy, assignedReviewer, lastDecision, lastDecisionReasonCode, lastDecisionActorReference, resolvedCustomerScope, resolvedCustomerReference });
}

export function parseIdentityMatchReviewCandidate(raw: unknown): CandidateResult {
  const candidate = captureCandidate(raw);
  return candidate ? deepFreeze({ kind: 'untrusted_candidate' as const, candidate }) : blocked('input_invalid');
}

export function isIdentityMatchReviewTerminalState(value: unknown): boolean {
  return value === 'rejected' || value === 'withdrawn' || value === 'expired' || value === 'revoked';
}

export function isLegalIdentityMatchReviewTransition(from: unknown, to: unknown, action: unknown): boolean {
  return identityMatchReviewLegalTransitions.some((transition) => transition.from === from && transition.to === to && transition.action === action);
}

function captureProposalTarget(input: CapturedRecord): Readonly<{
  reviewId: string;
  scope: Readonly<{ tenantId: string; institutionId: string }>;
  conversationId: string;
  segmentId: string;
  connectionInstanceId: string;
  irreversibleIdentityReference: string;
  expectedRevision: number;
  expectedCandidateSnapshotVersion: number;
  expectedCandidateSetDigest: string;
  nextCandidateSnapshotVersion: number;
  nextCandidateSetDigest: string;
}> | null {
  const reviewId = captureReference(input.reviewId, 'review_');
  const tenantId = captureScopeIdentifier(input.tenantId);
  const institutionId = captureScopeIdentifier(input.institutionId);
  const conversationId = captureReference(input.conversationId, 'conv_');
  const segmentId = captureReference(input.segmentId, 'seg_');
  const connectionInstanceId = captureReference(input.connectionInstanceId, 'conn_');
  const irreversibleIdentityReference = captureReference(input.irreversibleIdentityReference, 'irid_');
  const expectedRevision = capturePositiveInteger(input.expectedRevision);
  const expectedCandidateSnapshotVersion = capturePositiveInteger(input.expectedCandidateSnapshotVersion);
  const expectedCandidateSetDigest = captureReference(input.expectedCandidateSetDigest, 'candsum_');
  const nextCandidateSnapshotVersion = capturePositiveInteger(input.nextCandidateSnapshotVersion);
  const nextCandidateSetDigest = captureReference(input.nextCandidateSetDigest, 'candsum_');
  if (!reviewId || !tenantId || !institutionId || !conversationId || !segmentId || !connectionInstanceId || !irreversibleIdentityReference || !expectedRevision || !expectedCandidateSnapshotVersion || !expectedCandidateSetDigest || !nextCandidateSnapshotVersion || !nextCandidateSetDigest) return null;
  return deepFreeze({ reviewId, scope: { tenantId, institutionId }, conversationId, segmentId, connectionInstanceId, irreversibleIdentityReference, expectedRevision, expectedCandidateSnapshotVersion, expectedCandidateSetDigest, nextCandidateSnapshotVersion, nextCandidateSetDigest });
}

export function proposeIdentityMatchReviewTransition(raw: unknown): ProposalResult {
  const input = captureExactRecord(raw, proposalKeys);
  if (!input || input.contractVersion !== 'v1') return blocked('input_invalid');
  const target = captureProposalTarget(input);
  const fromState = isOneOf(input.fromState, identityMatchReviewStates) ? input.fromState : null;
  const toState = isOneOf(input.toState, identityMatchReviewStates) ? input.toState : null;
  const action = isOneOf(input.action, identityMatchReviewLegalTransitions.map((transition) => transition.action)) ? input.action : null;
  const proposedCustomerScope = input.proposedCustomerScope === null ? null : captureScope(input.proposedCustomerScope) ?? undefined;
  const proposedCustomerReference = captureNullableReference(input.proposedCustomerReference, 'cust_');
  if (!target || !fromState || !toState || !action || proposedCustomerScope === undefined || proposedCustomerReference === undefined) return blocked('input_invalid');
  if (!isLegalIdentityMatchReviewTransition(fromState, toState, action)) return blocked('state_conflict');
  if ((proposedCustomerScope === null) !== (proposedCustomerReference === null)) return blocked('input_invalid');
  if (proposedCustomerScope !== null && (proposedCustomerScope.tenantId !== target.scope.tenantId || proposedCustomerScope.institutionId !== target.scope.institutionId)) return blocked('customer_scope_mismatch');

  const candidateRefresh = action === 'refresh_candidates';
  if (candidateRefresh) {
    if (target.nextCandidateSnapshotVersion <= target.expectedCandidateSnapshotVersion || target.nextCandidateSetDigest === target.expectedCandidateSetDigest || proposedCustomerReference !== null) return blocked('candidate_refresh_required');
  } else if (target.nextCandidateSnapshotVersion !== target.expectedCandidateSnapshotVersion || target.nextCandidateSetDigest !== target.expectedCandidateSetDigest) return blocked('candidate_snapshot_mismatch');

  const customerResolutionRequirement = toState === 'matched'
    ? action === 'complete_customer_creation'
      ? 'customer_center_owner_verified_result' as const
      : 'owner_verified_existing_customer_reference' as const
    : 'none' as const;
  if ((toState === 'matched') !== (proposedCustomerReference !== null)) return blocked('input_invalid');

  const ownerRequirements: OwnerRequirement[] = [
    'owner_current_snapshot',
    'revision_cas',
    'trusted_server_clock',
    'action_authorization',
    'low_sensitivity_audit_append',
  ];
  if (customerResolutionRequirement === 'owner_verified_existing_customer_reference') ownerRequirements.push('owner_verified_customer_reference');
  if (customerResolutionRequirement === 'customer_center_owner_verified_result') ownerRequirements.push('customer_center_same_institution_result');
  if (candidateRefresh) ownerRequirements.push('owner_verified_candidate_refresh');

  return deepFreeze({
    kind: 'transition_proposal' as const,
    proposal: {
      contractVersion: 'v1',
      ...target,
      fromState,
      toState,
      action,
      proposedCustomerScope,
      proposedCustomerReference,
      customerResolutionRequirement,
      ownerRequirements,
    },
  });
}
