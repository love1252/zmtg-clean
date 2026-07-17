import { isFollowUpTaskState } from './follow-up-task';
import { projectFollowUpBusinessDate } from './follow-up-business-time';

export const FOLLOW_UP_DUE_BUCKETS = ['not_due', 'due_today', 'overdue'] as const;

export type FollowUpDueBucket = (typeof FOLLOW_UP_DUE_BUCKETS)[number];

export function deriveFollowUpDueBucket(input: Readonly<{
  state: unknown;
  dueAt: unknown;
  now: unknown;
  timeZone: unknown;
  operatingContextVersion: unknown;
}>): FollowUpDueBucket | null {
  if (!isFollowUpTaskState(input.state)) return null;
  if (input.state === 'completed' || input.state === 'cancelled') return null;

  const dueDate = projectFollowUpBusinessDate({
    instant: input.dueAt,
    timeZone: input.timeZone,
    operatingContextVersion: input.operatingContextVersion,
  });
  const currentDate = projectFollowUpBusinessDate({
    instant: input.now,
    timeZone: input.timeZone,
    operatingContextVersion: input.operatingContextVersion,
  });
  if (!dueDate || !currentDate) return null;

  if (dueDate.date < currentDate.date) return 'overdue';
  if (dueDate.date > currentDate.date) return 'not_due';
  return 'due_today';
}
