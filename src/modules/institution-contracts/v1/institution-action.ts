export const INSTITUTION_ACTION_SORT_SIGNALS_V1 = Object.freeze([
  'urgent',
  'overdue',
  'sla_due',
  'today',
  'high_priority',
] as const);

export type InstitutionActionSortSignalV1 =
  (typeof INSTITUTION_ACTION_SORT_SIGNALS_V1)[number];

/**
 * Scalar vocabulary guard only. It does not validate a signal array, uniqueness, priority
 * semantics, an action, an envelope, a reader decision, or authorization.
 */
export function isInstitutionActionSortSignalV1(
  value: unknown,
): value is InstitutionActionSortSignalV1 {
  return INSTITUTION_ACTION_SORT_SIGNALS_V1.some((candidate) => candidate === value);
}
