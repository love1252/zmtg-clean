export const ANALYTICS_CONSUMPTION_EVENT_TYPES = [
  'payment_succeeded',
  'payment_pending',
  'payment_failed',
  'payment_cancelled',
  'refund_confirmed',
  'refund_pending',
  'refund_failed',
  'refund_cancelled',
] as const;

export type AnalyticsConsumptionEventType =
  (typeof ANALYTICS_CONSUMPTION_EVENT_TYPES)[number];

export type AnalyticsCustomerAttribution =
  | Readonly<{ status: 'matched'; customerId: string }>
  | Readonly<{ status: 'unmatched' }>;

export type AnalyticsProjectAttribution =
  | Readonly<{
      status: 'mapped';
      hisDirectoryVersion: string;
      canonicalProjectId: string;
    }>
  | Readonly<{ status: 'unmapped' }>;

export type AnalyticsRefundLinkStatus =
  | 'not_applicable'
  | 'linked'
  | 'orphan_verified';

export type AnalyticsConsumptionFactInput = Readonly<{
  tenantId: string;
  institutionId: string;
  source: string;
  sourceRecordRef: string;
  sourceRevision: string;
  supersedesSourceRevision: string | null;
  eventType: AnalyticsConsumptionEventType;
  eventAt: string;
  receivedAt: string;
  batchOrConnectionRef: string;
  amountMinor: number;
  currency: string;
  stableConsumptionRecordRef: string | null;
  customerAttribution: AnalyticsCustomerAttribution;
  projectAttribution: AnalyticsProjectAttribution;
  refundLinkStatus: AnalyticsRefundLinkStatus;
}>;

export type EffectiveAnalyticsConsumptionFact = Readonly<{
  tenantId: string;
  institutionId: string;
  eventType: 'payment_succeeded' | 'refund_confirmed';
  eventAt: string;
  amountMinor: number;
  currency: string;
  stableConsumptionRecordRef: string | null;
  customerAttribution: AnalyticsCustomerAttribution;
  projectAttribution: AnalyticsProjectAttribution;
  refundLinkStatus: 'not_applicable' | 'linked' | 'orphan_verified';
}>;

export type AnalyticsFactInputScope = Readonly<{
  tenantId: string;
  institutionId: string;
}>;

export const ANALYTICS_FACT_INPUT_FAILURE_CODES = [
  'invalid_required_reference',
  'invalid_event_type',
  'invalid_amount_minor',
  'invalid_currency',
  'invalid_event_at',
  'invalid_received_at',
  'invalid_correction_reference',
  'invalid_stable_consumption_reference',
  'invalid_customer_attribution',
  'invalid_project_attribution',
  'invalid_refund_link_status',
] as const;

export type AnalyticsFactInputFailureCode =
  (typeof ANALYTICS_FACT_INPUT_FAILURE_CODES)[number];

export const ANALYTICS_FACT_CHAIN_ISSUE_CODES = [
  'conflicting_replay',
  'revision_chain_broken',
  'revision_chain_forked',
  'revision_chain_cycle',
] as const;

export type AnalyticsFactChainIssueCode =
  (typeof ANALYTICS_FACT_CHAIN_ISSUE_CODES)[number];

export type AnalyticsFactIssueSummary<Code extends string = string> = Readonly<{
  reasonCode: Code;
  count: number;
}>;

export type AnalyticsFactResolution =
  | Readonly<{
      ok: false;
      status: 'rejected';
      inputScopes: readonly [];
      effectiveFacts: readonly [];
      replayedFactCount: 0;
      excludedFinalStateCount: 0;
      rejectedChainCount: 0;
      issues: readonly AnalyticsFactIssueSummary<AnalyticsFactInputFailureCode>[];
    }>
  | Readonly<{
      ok: true;
      status: 'complete' | 'partial';
      inputScopes: readonly AnalyticsFactInputScope[];
      effectiveFacts: readonly EffectiveAnalyticsConsumptionFact[];
      replayedFactCount: number;
      excludedFinalStateCount: number;
      rejectedChainCount: number;
      issues: readonly AnalyticsFactIssueSummary<AnalyticsFactChainIssueCode>[];
    }>;

type EventFamily = 'payment' | 'refund';

type NormalizedAnalyticsConsumptionFact = Readonly<{
  tenantId: string;
  institutionId: string;
  source: string;
  sourceRecordRef: string;
  sourceRevision: string;
  supersedesSourceRevision: string | null;
  eventType: AnalyticsConsumptionEventType;
  eventFamily: EventFamily;
  eventAt: string;
  receivedAt: string;
  batchOrConnectionRef: string;
  amountMinor: number;
  currency: string;
  stableConsumptionRecordRef: string | null;
  customerAttribution: AnalyticsCustomerAttribution;
  projectAttribution: AnalyticsProjectAttribution;
  refundLinkStatus: AnalyticsRefundLinkStatus;
}>;

type NormalizationResult =
  | Readonly<{ ok: true; value: NormalizedAnalyticsConsumptionFact }>
  | Readonly<{ ok: false; reasonCode: AnalyticsFactInputFailureCode }>;

const eventTypeSet = new Set<string>(ANALYTICS_CONSUMPTION_EVENT_TYPES);
const supportedCurrencyCodes = new Set(Intl.supportedValuesOf('currency'));
const explicitInstantPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/u;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function isRequiredReference(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 256 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function normalizeInstant(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = explicitInstantPattern.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[10] === undefined ? 0 : Number(match[10]);
  const offsetMinute = match[11] === undefined ? 0 : Number(match[11]);
  if (
    year < 1000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0)
  ) {
    return null;
  }

  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function isCurrencyCode(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Z]{3}$/u.test(value) &&
    supportedCurrencyCodes.has(value)
  );
}

function normalizeCustomerAttribution(value: unknown): AnalyticsCustomerAttribution | null {
  if (!isPlainObject(value)) return null;

  if (value.status === 'unmatched') {
    return { status: 'unmatched' };
  }

  if (value.status === 'matched' && isRequiredReference(value.customerId)) {
    return { status: 'matched', customerId: value.customerId };
  }

  return null;
}

function normalizeProjectAttribution(value: unknown): AnalyticsProjectAttribution | null {
  if (!isPlainObject(value)) return null;

  if (value.status === 'unmapped') {
    return { status: 'unmapped' };
  }

  if (
    value.status === 'mapped' &&
    isRequiredReference(value.hisDirectoryVersion) &&
    isRequiredReference(value.canonicalProjectId)
  ) {
    return {
      status: 'mapped',
      hisDirectoryVersion: value.hisDirectoryVersion,
      canonicalProjectId: value.canonicalProjectId,
    };
  }

  return null;
}

function normalizeFact(input: AnalyticsConsumptionFactInput): NormalizationResult {
  if (
    !isRequiredReference(input?.tenantId) ||
    !isRequiredReference(input?.institutionId) ||
    !isRequiredReference(input?.source) ||
    !isRequiredReference(input?.sourceRecordRef) ||
    !isRequiredReference(input?.sourceRevision) ||
    !isRequiredReference(input?.batchOrConnectionRef)
  ) {
    return { ok: false, reasonCode: 'invalid_required_reference' };
  }

  if (!eventTypeSet.has(input.eventType)) {
    return { ok: false, reasonCode: 'invalid_event_type' };
  }

  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { ok: false, reasonCode: 'invalid_amount_minor' };
  }

  if (!isCurrencyCode(input.currency)) {
    return { ok: false, reasonCode: 'invalid_currency' };
  }

  const eventAt = normalizeInstant(input.eventAt);
  if (!eventAt) {
    return { ok: false, reasonCode: 'invalid_event_at' };
  }

  const receivedAt = normalizeInstant(input.receivedAt);
  if (!receivedAt) {
    return { ok: false, reasonCode: 'invalid_received_at' };
  }

  if (
    input.supersedesSourceRevision !== null &&
    !isRequiredReference(input.supersedesSourceRevision)
  ) {
    return { ok: false, reasonCode: 'invalid_correction_reference' };
  }

  if (
    input.stableConsumptionRecordRef !== null &&
    !isRequiredReference(input.stableConsumptionRecordRef)
  ) {
    return { ok: false, reasonCode: 'invalid_stable_consumption_reference' };
  }

  const customerAttribution = normalizeCustomerAttribution(input.customerAttribution);
  if (!customerAttribution) {
    return { ok: false, reasonCode: 'invalid_customer_attribution' };
  }

  const projectAttribution = normalizeProjectAttribution(input.projectAttribution);
  if (!projectAttribution) {
    return { ok: false, reasonCode: 'invalid_project_attribution' };
  }

  const eventFamily = input.eventType.startsWith('payment_') ? 'payment' : 'refund';
  const refundLinkStatus = input.refundLinkStatus;
  const validRefundLinkStatus =
    (eventFamily === 'payment' && refundLinkStatus === 'not_applicable') ||
    (eventFamily === 'refund' &&
      (refundLinkStatus === 'linked' || refundLinkStatus === 'orphan_verified'));

  if (!validRefundLinkStatus) {
    return { ok: false, reasonCode: 'invalid_refund_link_status' };
  }

  return {
    ok: true,
    value: {
      tenantId: input.tenantId,
      institutionId: input.institutionId,
      source: input.source,
      sourceRecordRef: input.sourceRecordRef,
      sourceRevision: input.sourceRevision,
      supersedesSourceRevision: input.supersedesSourceRevision,
      eventType: input.eventType,
      eventFamily,
      eventAt,
      receivedAt,
      batchOrConnectionRef: input.batchOrConnectionRef,
      amountMinor: input.amountMinor,
      currency: input.currency,
      stableConsumptionRecordRef: input.stableConsumptionRecordRef,
      customerAttribution,
      projectAttribution,
      refundLinkStatus,
    },
  };
}

function identityKey(fact: NormalizedAnalyticsConsumptionFact) {
  return JSON.stringify([
    fact.tenantId,
    fact.institutionId,
    fact.source,
    fact.sourceRecordRef,
    fact.sourceRevision,
    fact.eventType,
  ]);
}

function groupKey(fact: NormalizedAnalyticsConsumptionFact) {
  return JSON.stringify([
    fact.tenantId,
    fact.institutionId,
    fact.source,
    fact.sourceRecordRef,
    fact.eventFamily,
  ]);
}

function businessSignature(fact: NormalizedAnalyticsConsumptionFact) {
  const customer =
    fact.customerAttribution.status === 'matched'
      ? ['matched', fact.customerAttribution.customerId]
      : ['unmatched'];
  const project =
    fact.projectAttribution.status === 'mapped'
      ? [
          'mapped',
          fact.projectAttribution.hisDirectoryVersion,
          fact.projectAttribution.canonicalProjectId,
        ]
      : ['unmapped'];

  return JSON.stringify([
    fact.supersedesSourceRevision,
    fact.eventAt,
    fact.amountMinor,
    fact.currency,
    fact.stableConsumptionRecordRef,
    customer,
    project,
    fact.refundLinkStatus,
  ]);
}

function summarizeIssues<Code extends string>(issues: readonly Code[]) {
  const counts = new Map<Code, number>();
  for (const issue of issues) {
    counts.set(issue, (counts.get(issue) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reasonCode, count]) => ({ reasonCode, count }));
}

function toEffectiveFact(
  fact: NormalizedAnalyticsConsumptionFact,
): EffectiveAnalyticsConsumptionFact {
  return {
    tenantId: fact.tenantId,
    institutionId: fact.institutionId,
    eventType: fact.eventType as 'payment_succeeded' | 'refund_confirmed',
    eventAt: fact.eventAt,
    amountMinor: fact.amountMinor,
    currency: fact.currency,
    stableConsumptionRecordRef: fact.stableConsumptionRecordRef,
    customerAttribution: { ...fact.customerAttribution },
    projectAttribution: { ...fact.projectAttribution },
    refundLinkStatus: fact.refundLinkStatus,
  };
}

function resolveChain(
  facts: readonly NormalizedAnalyticsConsumptionFact[],
):
  | Readonly<{ ok: true; leaf: NormalizedAnalyticsConsumptionFact }>
  | Readonly<{ ok: false; reasonCode: AnalyticsFactChainIssueCode }> {
  const byRevision = new Map<string, NormalizedAnalyticsConsumptionFact>();
  for (const fact of facts) {
    if (byRevision.has(fact.sourceRevision)) {
      return { ok: false, reasonCode: 'revision_chain_forked' };
    }
    byRevision.set(fact.sourceRevision, fact);
  }

  for (const fact of facts) {
    if (
      fact.supersedesSourceRevision !== null &&
      !byRevision.has(fact.supersedesSourceRevision)
    ) {
      return { ok: false, reasonCode: 'revision_chain_broken' };
    }
  }

  const roots = facts.filter((fact) => fact.supersedesSourceRevision === null);
  if (roots.length === 0) {
    return { ok: false, reasonCode: 'revision_chain_cycle' };
  }
  if (roots.length > 1) {
    return { ok: false, reasonCode: 'revision_chain_forked' };
  }

  const childByRevision = new Map<string, NormalizedAnalyticsConsumptionFact>();
  for (const fact of facts) {
    const predecessor = fact.supersedesSourceRevision;
    if (predecessor === null) continue;
    if (childByRevision.has(predecessor)) {
      return { ok: false, reasonCode: 'revision_chain_forked' };
    }
    childByRevision.set(predecessor, fact);
  }

  const visited = new Set<string>();
  let current = roots[0];
  while (current) {
    if (visited.has(current.sourceRevision)) {
      return { ok: false, reasonCode: 'revision_chain_cycle' };
    }
    visited.add(current.sourceRevision);
    const child = childByRevision.get(current.sourceRevision);
    if (!child) break;
    current = child;
  }

  if (visited.size !== facts.length) {
    return { ok: false, reasonCode: 'revision_chain_cycle' };
  }

  return { ok: true, leaf: current };
}

export function resolveAnalyticsConsumptionFacts(
  inputs: readonly AnalyticsConsumptionFactInput[],
): AnalyticsFactResolution {
  const normalizedFacts: NormalizedAnalyticsConsumptionFact[] = [];
  const inputFailures: AnalyticsFactInputFailureCode[] = [];

  for (const input of inputs) {
    const normalized = normalizeFact(input);
    if (!normalized.ok) {
      inputFailures.push(normalized.reasonCode);
      continue;
    }
    normalizedFacts.push(normalized.value);
  }

  if (inputFailures.length > 0) {
    return {
      ok: false,
      status: 'rejected',
      inputScopes: [],
      effectiveFacts: [],
      replayedFactCount: 0,
      excludedFinalStateCount: 0,
      rejectedChainCount: 0,
      issues: summarizeIssues(inputFailures),
    };
  }

  const uniqueByIdentity = new Map<
    string,
    Readonly<{
      fact: NormalizedAnalyticsConsumptionFact;
      signature: string;
    }>
  >();
  const inputScopes = [
    ...new Map(
      normalizedFacts.map((fact) => [
        JSON.stringify([fact.tenantId, fact.institutionId]),
        { tenantId: fact.tenantId, institutionId: fact.institutionId },
      ]),
    ).entries(),
  ]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, scope]) => scope);
  const conflictingGroups = new Set<string>();
  let replayedFactCount = 0;

  for (const fact of normalizedFacts) {
    const identity = identityKey(fact);
    const signature = businessSignature(fact);
    const existing = uniqueByIdentity.get(identity);
    if (!existing) {
      uniqueByIdentity.set(identity, { fact, signature });
      continue;
    }

    if (existing.signature === signature) {
      replayedFactCount += 1;
    } else {
      conflictingGroups.add(groupKey(fact));
    }
  }

  const factsByGroup = new Map<string, NormalizedAnalyticsConsumptionFact[]>();
  for (const { fact } of uniqueByIdentity.values()) {
    const key = groupKey(fact);
    const group = factsByGroup.get(key) ?? [];
    group.push(fact);
    factsByGroup.set(key, group);
  }

  const chainIssues: AnalyticsFactChainIssueCode[] = [];
  const effectiveEntries: Array<
    Readonly<{ sortKey: string; fact: EffectiveAnalyticsConsumptionFact }>
  > = [];
  let excludedFinalStateCount = 0;
  let rejectedChainCount = 0;

  for (const key of [...factsByGroup.keys()].sort((left, right) => left.localeCompare(right))) {
    if (conflictingGroups.has(key)) {
      chainIssues.push('conflicting_replay');
      rejectedChainCount += 1;
      continue;
    }

    const chain = resolveChain(factsByGroup.get(key) ?? []);
    if (!chain.ok) {
      chainIssues.push(chain.reasonCode);
      rejectedChainCount += 1;
      continue;
    }

    if (
      chain.leaf.eventType !== 'payment_succeeded' &&
      chain.leaf.eventType !== 'refund_confirmed'
    ) {
      excludedFinalStateCount += 1;
      continue;
    }

    effectiveEntries.push({ sortKey: key, fact: toEffectiveFact(chain.leaf) });
  }

  return {
    ok: true,
    status: rejectedChainCount === 0 ? 'complete' : 'partial',
    inputScopes,
    effectiveFacts: effectiveEntries
      .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
      .map(({ fact }) => fact),
    replayedFactCount,
    excludedFinalStateCount,
    rejectedChainCount,
    issues: summarizeIssues(chainIssues),
  };
}
