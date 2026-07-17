export const FOLLOW_UP_COMMAND_PRECONDITION_ERROR_CODES = [
  'invalid_command_context',
  'scope_mismatch',
  'revision_conflict',
] as const;

export type FollowUpCommandPreconditionError =
  (typeof FOLLOW_UP_COMMAND_PRECONDITION_ERROR_CODES)[number];

export type FollowUpCommandPreconditionResult =
  | Readonly<{ ok: true; currentRevision: number }>
  | Readonly<{ ok: false; code: FollowUpCommandPreconditionError }>;

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function checkFollowUpCommandPreconditions(input: Readonly<{
  taskInstitutionId: unknown;
  currentRevision: unknown;
  institutionId: unknown;
  expectedRevision: unknown;
}>): FollowUpCommandPreconditionResult {
  if (
    !isNonEmptyText(input.taskInstitutionId) ||
    !isValidRevision(input.currentRevision) ||
    !isNonEmptyText(input.institutionId) ||
    !isValidRevision(input.expectedRevision)
  ) {
    return { ok: false, code: 'invalid_command_context' };
  }

  if (input.institutionId !== input.taskInstitutionId) {
    return { ok: false, code: 'scope_mismatch' };
  }
  if (input.expectedRevision !== input.currentRevision) {
    return { ok: false, code: 'revision_conflict' };
  }

  return { ok: true, currentRevision: input.currentRevision };
}
