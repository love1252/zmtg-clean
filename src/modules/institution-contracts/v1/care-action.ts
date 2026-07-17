import type { CustomerReferenceV1 } from './customer';
import type { InstitutionActionSortSignalV1 } from './institution-action';
import type { InstitutionRoleV1 } from './institution-navigation';
import type { InstitutionSourceEnvelopeV1 } from './institution-source';

export const CARE_ACTION_PARTITION_KEYS_V1 = Object.freeze([
  'pending_confirmation_appointments',
  'reschedule_requested_appointments',
  'overdue_followups',
  'today_due_followups',
] as const);

export type CareActionPartitionKeyV1 = (typeof CARE_ACTION_PARTITION_KEYS_V1)[number];

export const CARE_APPOINTMENT_BUSINESS_STATES_V1 = Object.freeze([
  'pending_confirmation',
  'confirmed',
  'arrived',
  'completed',
  'cancelled',
  'no_show',
] as const);

export type CareAppointmentBusinessStateV1 =
  (typeof CARE_APPOINTMENT_BUSINESS_STATES_V1)[number];

export const CARE_FOLLOW_UP_BUSINESS_STATES_V1 = Object.freeze([
  'pending',
  'in_progress',
  'waiting_customer',
  'escalated',
  'completed',
  'cancelled',
] as const);

export type CareFollowUpBusinessStateV1 =
  (typeof CARE_FOLLOW_UP_BUSINESS_STATES_V1)[number];

export const CARE_ACTION_RISK_LEVELS_V1 = Object.freeze([
  'normal',
  'watch',
  'urgent',
] as const);

export type CareActionRiskLevelV1 = (typeof CARE_ACTION_RISK_LEVELS_V1)[number];

export const CARE_ACTION_PRIORITIES_V1 = Object.freeze(['normal', 'high'] as const);

export type CareActionPriorityV1 = (typeof CARE_ACTION_PRIORITIES_V1)[number];

export const CARE_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1 = 120 as const;

export type CareActionCardV1 =
  | {
      key: 'pending_confirmation_appointments';
      count: number;
      canonicalHref: '/hospital/care/appointments?status=pending_confirmation';
    }
  | {
      key: 'reschedule_requested_appointments';
      count: number;
      canonicalHref: '/hospital/care/appointments?status=reschedule_requested';
    }
  | {
      key: 'overdue_followups';
      count: number;
      canonicalHref: '/hospital/care/followups?bucket=overdue';
    }
  | {
      key: 'today_due_followups';
      count: number;
      canonicalHref: '/hospital/care/followups?bucket=today';
    };

/** Low-sensitivity assignment projection only; never an authorization decision. */
export type CareActionOwnerV1 =
  | {
      kind: 'user';
      userId: string;
      displayName: string;
    }
  | {
      kind: 'role_pool';
      role: InstitutionRoleV1;
    };

type CareActionItemBaseV1 = {
  objectId: string;
  /**
   * Non-empty opaque version of this single action. It is not an internal numeric revision,
   * source/partition refresh revision, row key, sort input, or idempotency identity.
   */
  sourceVersion: string;
  customer: CustomerReferenceV1;
  cardKeys: CareActionPartitionKeyV1[];
  sortSignals: InstitutionActionSortSignalV1[];
  appointmentAt: string | null;
  dueAt: string | null;
  slaAt: string | null;
  riskLevel: CareActionRiskLevelV1;
  priority: CareActionPriorityV1;
  owner: CareActionOwnerV1 | null;
  /**
   * Provider/parser-validated low-sensitivity text or null. A non-null value is normalized and
   * limited to CARE_ACTION_SAFE_SUMMARY_MAX_LENGTH_V1 Unicode characters. It never falls back
   * to PII, message/treatment content, HIS/provider payloads, external accounts, internal errors,
   * or arbitrary placeholder text, and is not an authorization, sort, or state input. This
   * TypeScript declaration does not sanitize an untrusted string.
   */
  safeSummary: string | null;
};

export type CareAppointmentActionItemV1 = CareActionItemBaseV1 & {
  entityType: 'appointment';
  businessState: CareAppointmentBusinessStateV1;
  /**
   * Compile-time prefix only. The parser must require one encoded object ID equal to objectId,
   * reject empty/extra path segments, query and hash, and the target page must reauthorize scope.
   */
  detailHref: `/hospital/care/appointments/${string}`;
};

export type CareFollowUpActionItemV1 = CareActionItemBaseV1 & {
  entityType: 'followup';
  businessState: CareFollowUpBusinessStateV1;
  /** See CareAppointmentActionItemV1.detailHref for parser and authorization requirements. */
  detailHref: `/hospital/care/followups/${string}`;
};

export type CareActionItemV1 = CareAppointmentActionItemV1 | CareFollowUpActionItemV1;

export type CareActionPayloadV1 = {
  cards: CareActionCardV1[];
  actions: CareActionItemV1[];
};

/**
 * Frozen V1 wire shape only. It does not parse, authorize, or sanitize runtime input.
 *
 * The Care provider and BASE-02 reader enforce source scope/RBAC. Each target detail page
 * independently reauthorizes object visibility. The parser only validates untrusted wire values
 * and cross-field consistency. The provider supplies the approved sort inputs, while the
 * workbench applies the frozen shared sort order.
 *
 * Cross-field rules remain mandatory: only ready partitions contribute current actions; an
 * authoritative empty partition emits its matching zero card and no action; stale may carry only a safe
 * card snapshot with freshness and never a current action; unavailable, denied, and disabled
 * contribute no card, count, action, or link. Without real HIS appointment facts, both appointment
 * partitions are disabled. A scope_mismatch nulls the entire data payload.
 *
 * Exact four-partition/card coverage, canonical object identifiers and links, ISO timestamps,
 * non-negative counts, safe-summary limits, source versions, ordering inputs, and all remaining
 * invariants require those separately approved runtime layers.
 */
export type CareActionSourceV1 = InstitutionSourceEnvelopeV1<
  CareActionPayloadV1,
  CareActionPartitionKeyV1
>;

/** Scalar vocabulary guard only; not an envelope parser, reader, authorizer, or uniqueness check. */
export function isCareActionPartitionKeyV1(
  value: unknown,
): value is CareActionPartitionKeyV1 {
  return CARE_ACTION_PARTITION_KEYS_V1.some((candidate) => candidate === value);
}

/** Scalar vocabulary guard only; it does not validate a Care action or its authorization. */
export function isCareAppointmentBusinessStateV1(
  value: unknown,
): value is CareAppointmentBusinessStateV1 {
  return CARE_APPOINTMENT_BUSINESS_STATES_V1.some((candidate) => candidate === value);
}

/** Scalar vocabulary guard only; it does not validate a Care action or its authorization. */
export function isCareFollowUpBusinessStateV1(
  value: unknown,
): value is CareFollowUpBusinessStateV1 {
  return CARE_FOLLOW_UP_BUSINESS_STATES_V1.some((candidate) => candidate === value);
}
