import type { CustomerReferenceV1 } from './customer';
import type { InstitutionActionSortSignalV1 } from './institution-action';
import type { InstitutionSourceEnvelopeV1 } from './institution-source';

export const CONVERSATION_ACTION_PARTITION_KEYS_V1 = Object.freeze([
  'waiting_human',
  'unresolved_risk',
] as const);

export type ConversationActionPartitionKeyV1 =
  (typeof CONVERSATION_ACTION_PARTITION_KEYS_V1)[number];

export const CONVERSATION_ACTION_STATES_V1 = Object.freeze([
  'ai_handling',
  'awaiting_human',
  'human_handling',
  'waiting_customer',
] as const);

export type ConversationActionStateV1 = (typeof CONVERSATION_ACTION_STATES_V1)[number];

export const CONVERSATION_ACTION_RISK_STATES_V1 = Object.freeze([
  'none',
  'unconfirmed',
  'confirmed',
  'resolved',
] as const);

export type ConversationActionRiskStateV1 =
  (typeof CONVERSATION_ACTION_RISK_STATES_V1)[number];

export const CONVERSATION_ACTION_PRIORITIES_V1 = Object.freeze(['normal', 'high'] as const);

export type ConversationActionPriorityV1 =
  (typeof CONVERSATION_ACTION_PRIORITIES_V1)[number];

export const CONVERSATION_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1 = 120 as const;

export type ConversationActionSubjectV1 =
  | {
      kind: 'customer';
      customer: CustomerReferenceV1;
    }
  | {
      kind: 'unmatched_contact';
      label: '待匹配联系人';
    };

/** Low-sensitivity display projection only; never an assignment or authorization decision. */
export type ConversationActionAssigneeV1 = {
  userId: string;
  displayName: string;
};

export type ConversationActionItemV1 = {
  conversationId: string;
  segmentId: string;
  /**
   * Non-empty opaque version of this single action. It is not an internal sequence/revision,
   * source/partition refresh revision, row key, sort input, or idempotency identity.
   */
  sourceVersion: string;
  production: true;
  subject: ConversationActionSubjectV1;
  conversationState: ConversationActionStateV1;
  riskState: ConversationActionRiskStateV1;
  partitions: ConversationActionPartitionKeyV1[];
  sortSignals: InstitutionActionSortSignalV1[];
  lastCustomerMessageAt: string;
  slaAt: string | null;
  priority: ConversationActionPriorityV1;
  assignee: ConversationActionAssigneeV1 | null;
  /**
   * Provider/parser-validated low-sensitivity text or null. A non-null value is normalized and
   * limited to CONVERSATION_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1 Unicode characters. It never falls
   * back to channel identity, PII, provider payloads, external accounts, internal errors, or
   * arbitrary placeholder text. It never contains, copies, summarizes, or derives from message
   * content, chat text, or AI output/thought, and is not an authorization, sort, or state input.
   * This TypeScript declaration does not sanitize an untrusted string.
   */
  safeSummary: string | null;
  /**
   * Compile-time prefix only. The parser must require one encoded ID equal to conversationId,
   * reject empty/extra segments, query/hash and reserved static paths such as automations. The
   * target conversation page independently reauthorizes object visibility.
   */
  detailHref: `/hospital/conversations/${string}`;
};

export type ConversationActionPayloadV1 = {
  actions: ConversationActionItemV1[];
};

/**
 * Frozen V1 wire shape only. It does not parse, authorize, or sanitize runtime input.
 *
 * The Conversation provider and BASE-02 reader enforce source scope/RBAC. Each target page
 * independently reauthorizes object visibility. The parser only validates untrusted wire values
 * and cross-field consistency. The provider supplies the approved sort inputs; the workbench
 * applies the frozen shared sort order.
 *
 * Only ready partitions contribute current actions. Authoritative empty emits an empty actions
 * array; partial retains actions solely from successful and fresh partitions; stale contributes
 * no current action; unavailable, denied, and disabled contribute no action, subject, or link. A
 * scope_mismatch nulls the entire data payload. One segment that matches both partitions remains
 * one action with both partition keys.
 *
 * Production/persistence/current-segment proofs, exact partition coverage, ISO timestamps,
 * subject/assignee/safe-summary safety, unique action identity, canonical links, state-to-partition
 * rules, source versions, ordering inputs, and all remaining invariants require those separately
 * approved runtime layers.
 */
export type ConversationActionSourceV1 = InstitutionSourceEnvelopeV1<
  ConversationActionPayloadV1,
  ConversationActionPartitionKeyV1
>;

/** Scalar vocabulary guard only; not an envelope parser, reader, authorizer, or uniqueness check. */
export function isConversationActionPartitionKeyV1(
  value: unknown,
): value is ConversationActionPartitionKeyV1 {
  return CONVERSATION_ACTION_PARTITION_KEYS_V1.some((candidate) => candidate === value);
}

/** Scalar vocabulary guard only; it does not validate a Conversation action or authorization. */
export function isConversationActionStateV1(value: unknown): value is ConversationActionStateV1 {
  return CONVERSATION_ACTION_STATES_V1.some((candidate) => candidate === value);
}

/** Scalar vocabulary guard only; it does not validate a Conversation action or authorization. */
export function isConversationActionRiskStateV1(
  value: unknown,
): value is ConversationActionRiskStateV1 {
  return CONVERSATION_ACTION_RISK_STATES_V1.some((candidate) => candidate === value);
}
