import type {
  AnalyticsFactResolution,
  EffectiveAnalyticsConsumptionFact,
} from '@/modules/institution-analytics/domain/analytics-consumption-facts';

export const ANALYTICS_STABLE_CONSUMPTION_RECORD_COUNT_AVAILABILITY = [
  'available',
  'unavailable_unstable_reference',
  'unavailable_incomplete_source',
] as const;

export type AnalyticsStableConsumptionRecordCountAvailability =
  (typeof ANALYTICS_STABLE_CONSUMPTION_RECORD_COUNT_AVAILABILITY)[number];

export type AnalyticsStableConsumptionRecordCurrencyQuality = Readonly<{
  missingStableConsumptionReferenceCount: number;
  conflictingStableConsumptionRecordCount: number;
  linkedRefundWithoutPaymentCount: number;
  linkedRefundAttributionMismatchCount: number;
  linkedRefundCurrencyMismatchCount: number;
  orphanRefundCount: number;
}>;

export type AnalyticsStableConsumptionRecordCurrencyGate = Readonly<{
  currency: string;
  consumptionRecordCount: number | null;
  countAvailability: AnalyticsStableConsumptionRecordCountAvailability;
  quality: AnalyticsStableConsumptionRecordCurrencyQuality;
}>;

export type AnalyticsStableConsumptionRecordGateValue = Readonly<{
  replayedFactCount: number;
  rejectedCorrectionChainCount: number;
  currencies: readonly AnalyticsStableConsumptionRecordCurrencyGate[];
}>;

export type AnalyticsStableConsumptionRecordGateResult =
  | Readonly<{ ok: true; value: AnalyticsStableConsumptionRecordGateValue }>
  | Readonly<{
      ok: false;
      reasonCode: 'invalid_fact_resolution' | 'scope_mismatch' | 'invalid_period_facts';
    }>;

export type AnalyticsStableConsumptionRecordGateInput = Readonly<{
  tenantId: string;
  institutionId: string;
  factResolution: AnalyticsFactResolution;
  periodFacts?: readonly EffectiveAnalyticsConsumptionFact[];
}>;

type MutableCurrencyState = {
  stablePaymentRecordKeys: Set<string>;
  missingStableConsumptionReferenceCount: number;
  conflictingStableConsumptionRecordKeys: Set<string>;
  linkedRefundWithoutPaymentCount: number;
  linkedRefundAttributionMismatchCount: number;
  linkedRefundCurrencyMismatchCount: number;
  orphanRefundCount: number;
  hasUnstableReference: boolean;
};

type StableRecordGroup = {
  facts: EffectiveAnalyticsConsumptionFact[];
};

type StableRecordGroupAssessment = Readonly<{
  hasDescriptorConflict: boolean;
  refundIssues: ReadonlyMap<EffectiveAnalyticsConsumptionFact, RefundIssueCode>;
}>;

type RefundIssueCode =
  | 'linked_refund_without_payment'
  | 'linked_refund_attribution_mismatch'
  | 'linked_refund_currency_mismatch';

function isNonEmptyReference(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    value.trim() === value
  );
}

function stableRecordKey(fact: EffectiveAnalyticsConsumptionFact) {
  return JSON.stringify([
    fact.tenantId,
    fact.institutionId,
    fact.source,
    fact.stableConsumptionRecordRef,
  ]);
}

function factSignature(fact: EffectiveAnalyticsConsumptionFact) {
  const customer =
    fact.customerAttribution.status === 'matched'
      ? ['matched', fact.customerAttribution.customerId]
      : fact.customerAttribution.status === 'pending_review'
        ? ['pending_review', fact.customerAttribution.candidateReference]
        : ['unmatched'];
  const project =
    fact.projectAttribution.status === 'mapped'
      ? [
          'mapped',
          fact.projectAttribution.hisDirectoryVersion,
          fact.projectAttribution.canonicalProjectId,
        ]
      : fact.projectAttribution.status === 'pending_review'
        ? ['pending_review', fact.projectAttribution.candidateReference]
        : ['unmapped'];
  return JSON.stringify([
    fact.tenantId,
    fact.institutionId,
    fact.source,
    fact.eventType,
    fact.eventAt,
    fact.amountMinor,
    fact.currency,
    fact.stableConsumptionRecordRef,
    customer,
    project,
    fact.refundLinkStatus,
  ]);
}

function stableRecordDescriptor(fact: EffectiveAnalyticsConsumptionFact) {
  const customer =
    fact.customerAttribution.status === 'matched'
      ? ['matched', fact.customerAttribution.customerId]
      : fact.customerAttribution.status === 'pending_review'
        ? ['pending_review', fact.customerAttribution.candidateReference]
        : ['unmatched'];
  const project =
    fact.projectAttribution.status === 'mapped'
      ? [
          'mapped',
          fact.projectAttribution.hisDirectoryVersion,
          fact.projectAttribution.canonicalProjectId,
        ]
      : fact.projectAttribution.status === 'pending_review'
        ? ['pending_review', fact.projectAttribution.candidateReference]
        : ['unmapped'];
  return JSON.stringify([fact.currency, customer, project]);
}

function stableRecordDescriptorWithoutCurrency(
  fact: EffectiveAnalyticsConsumptionFact,
) {
  const customer =
    fact.customerAttribution.status === 'matched'
      ? ['matched', fact.customerAttribution.customerId]
      : fact.customerAttribution.status === 'pending_review'
        ? ['pending_review', fact.customerAttribution.candidateReference]
        : ['unmatched'];
  const project =
    fact.projectAttribution.status === 'mapped'
      ? [
          'mapped',
          fact.projectAttribution.hisDirectoryVersion,
          fact.projectAttribution.canonicalProjectId,
        ]
      : fact.projectAttribution.status === 'pending_review'
        ? ['pending_review', fact.projectAttribution.candidateReference]
        : ['unmapped'];
  return JSON.stringify([customer, project]);
}

function emptyCurrencyState(): MutableCurrencyState {
  return {
    stablePaymentRecordKeys: new Set(),
    missingStableConsumptionReferenceCount: 0,
    conflictingStableConsumptionRecordKeys: new Set(),
    linkedRefundWithoutPaymentCount: 0,
    linkedRefundAttributionMismatchCount: 0,
    linkedRefundCurrencyMismatchCount: 0,
    orphanRefundCount: 0,
    hasUnstableReference: false,
  };
}

function assessStableRecordGroup(
  group: StableRecordGroup,
): StableRecordGroupAssessment {
  const payments = group.facts.filter(
    (fact) => fact.eventType === 'payment_succeeded',
  );
  const paymentDescriptors = new Set(payments.map(stableRecordDescriptor));
  const paymentDescriptorsWithoutCurrency = new Set(
    payments.map(stableRecordDescriptorWithoutCurrency),
  );
  const refundIssues = new Map<EffectiveAnalyticsConsumptionFact, RefundIssueCode>();

  for (const refund of group.facts) {
    if (
      refund.eventType !== 'refund_confirmed' ||
      refund.refundLinkStatus === 'orphan_verified'
    ) {
      continue;
    }
    if (payments.length === 0) {
      refundIssues.set(refund, 'linked_refund_without_payment');
      continue;
    }
    if (paymentDescriptors.has(stableRecordDescriptor(refund))) continue;
    if (
      paymentDescriptorsWithoutCurrency.has(
        stableRecordDescriptorWithoutCurrency(refund),
      )
    ) {
      refundIssues.set(refund, 'linked_refund_currency_mismatch');
    } else {
      refundIssues.set(refund, 'linked_refund_attribution_mismatch');
    }
  }

  return {
    hasDescriptorConflict: paymentDescriptors.size > 1,
    refundIssues,
  };
}

function isFactInExpectedScope(
  fact: EffectiveAnalyticsConsumptionFact,
  input: AnalyticsStableConsumptionRecordGateInput,
) {
  return (
    fact.tenantId === input.tenantId &&
    fact.institutionId === input.institutionId &&
    isNonEmptyReference(fact.source)
  );
}

function factCounts(
  facts: readonly EffectiveAnalyticsConsumptionFact[],
) {
  const counts = new Map<string, number>();
  for (const fact of facts) {
    const signature = factSignature(fact);
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }
  return counts;
}

function isSubsetOfResolvedFacts(
  periodFacts: readonly EffectiveAnalyticsConsumptionFact[],
  resolvedFacts: readonly EffectiveAnalyticsConsumptionFact[],
) {
  const remaining = factCounts(resolvedFacts);
  for (const fact of periodFacts) {
    const signature = factSignature(fact);
    const count = remaining.get(signature) ?? 0;
    if (count === 0) return false;
    remaining.set(signature, count - 1);
  }
  return true;
}

export function resolveAnalyticsStableConsumptionRecordGate(
  input: AnalyticsStableConsumptionRecordGateInput,
): AnalyticsStableConsumptionRecordGateResult {
  if (
    !input.factResolution.ok ||
    !isNonEmptyReference(input.tenantId) ||
    !isNonEmptyReference(input.institutionId)
  ) {
    return { ok: false, reasonCode: 'invalid_fact_resolution' };
  }

  const resolvedFacts = input.factResolution.effectiveFacts;
  const periodFacts = input.periodFacts ?? resolvedFacts;
  if (
    !input.factResolution.inputScopes.every(
      (scope) =>
        scope.tenantId === input.tenantId &&
        scope.institutionId === input.institutionId,
    ) ||
    !resolvedFacts.every((fact) => isFactInExpectedScope(fact, input)) ||
    !periodFacts.every((fact) => isFactInExpectedScope(fact, input))
  ) {
    return { ok: false, reasonCode: 'scope_mismatch' };
  }
  if (!isSubsetOfResolvedFacts(periodFacts, resolvedFacts)) {
    return { ok: false, reasonCode: 'invalid_period_facts' };
  }

  const groups = new Map<string, StableRecordGroup>();
  for (const fact of resolvedFacts) {
    if (fact.stableConsumptionRecordRef === null) continue;
    const key = stableRecordKey(fact);
    const group = groups.get(key) ?? { facts: [] };
    group.facts.push(fact);
    groups.set(key, group);
  }
  const assessments = new Map<string, StableRecordGroupAssessment>();
  for (const [key, group] of groups) {
    assessments.set(key, assessStableRecordGroup(group));
  }

  const currencies = new Map<string, MutableCurrencyState>();
  for (const fact of periodFacts) {
    const state = currencies.get(fact.currency) ?? emptyCurrencyState();
    currencies.set(fact.currency, state);
    if (fact.stableConsumptionRecordRef === null) {
      state.missingStableConsumptionReferenceCount += 1;
      state.hasUnstableReference = true;
      continue;
    }

    const key = stableRecordKey(fact);
    const assessment = assessments.get(key);
    if (!assessment) return { ok: false, reasonCode: 'invalid_period_facts' };
    if (assessment.hasDescriptorConflict) {
      state.conflictingStableConsumptionRecordKeys.add(key);
      state.hasUnstableReference = true;
    }
    const refundIssue = assessment.refundIssues.get(fact);
    if (refundIssue === 'linked_refund_without_payment') {
      state.linkedRefundWithoutPaymentCount += 1;
      state.hasUnstableReference = true;
    } else if (refundIssue === 'linked_refund_attribution_mismatch') {
      state.linkedRefundAttributionMismatchCount += 1;
      state.hasUnstableReference = true;
    } else if (refundIssue === 'linked_refund_currency_mismatch') {
      state.linkedRefundCurrencyMismatchCount += 1;
      state.hasUnstableReference = true;
    }
    if (
      fact.eventType === 'refund_confirmed' &&
      fact.refundLinkStatus === 'orphan_verified'
    ) {
      state.orphanRefundCount += 1;
      state.hasUnstableReference = true;
    }
    if (
      fact.eventType === 'payment_succeeded' &&
      !assessment.hasDescriptorConflict
    ) {
      state.stablePaymentRecordKeys.add(key);
    }
  }

  const resolutionIncomplete =
    input.factResolution.status === 'partial' ||
    input.factResolution.rejectedChainCount > 0;
  const currencyGates = [...currencies.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, state]) => {
      const countAvailability: AnalyticsStableConsumptionRecordCountAvailability =
        resolutionIncomplete
          ? 'unavailable_incomplete_source'
          : state.hasUnstableReference
            ? 'unavailable_unstable_reference'
            : 'available';
      return {
        currency,
        consumptionRecordCount:
          countAvailability === 'available'
            ? state.stablePaymentRecordKeys.size
            : null,
        countAvailability,
        quality: {
          missingStableConsumptionReferenceCount:
            state.missingStableConsumptionReferenceCount,
          conflictingStableConsumptionRecordCount:
            state.conflictingStableConsumptionRecordKeys.size,
          linkedRefundWithoutPaymentCount:
            state.linkedRefundWithoutPaymentCount,
          linkedRefundAttributionMismatchCount:
            state.linkedRefundAttributionMismatchCount,
          linkedRefundCurrencyMismatchCount:
            state.linkedRefundCurrencyMismatchCount,
          orphanRefundCount: state.orphanRefundCount,
        },
      } as const;
    });

  return {
    ok: true,
    value: {
      replayedFactCount: input.factResolution.replayedFactCount,
      rejectedCorrectionChainCount: input.factResolution.rejectedChainCount,
      currencies: currencyGates,
    },
  };
}
