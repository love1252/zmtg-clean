export const FOLLOW_UP_CONTROLLED_STAGE_CODES = Object.freeze([
  'manual_followup',
] as const);

export const FOLLOW_UP_CONTROLLED_ACTION_CODES = Object.freeze([
  'manual_contact',
] as const);

export type FollowUpControlledStageCode =
  (typeof FOLLOW_UP_CONTROLLED_STAGE_CODES)[number];

export type FollowUpControlledActionCode =
  (typeof FOLLOW_UP_CONTROLLED_ACTION_CODES)[number];

export function isFollowUpControlledStageCode(
  value: unknown,
): value is FollowUpControlledStageCode {
  return FOLLOW_UP_CONTROLLED_STAGE_CODES.some((candidate) => candidate === value);
}

export function isFollowUpControlledActionCode(
  value: unknown,
): value is FollowUpControlledActionCode {
  return FOLLOW_UP_CONTROLLED_ACTION_CODES.some((candidate) => candidate === value);
}
