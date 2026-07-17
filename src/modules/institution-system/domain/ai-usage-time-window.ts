export type AiUsageTimeWindow = Readonly<{
  startInclusiveEpochMs: number;
  endExclusiveEpochMs: number;
}>;

export type AiUsageTimeWindowPosition = 'inside' | 'outside' | 'invalid';

export type AiUsageTimeWindowSnapshotResult =
  | Readonly<{
      ok: true;
      classify: (occurredAtEpochMs: unknown) => AiUsageTimeWindowPosition;
    }>
  | Readonly<{
      ok: false;
      code: 'invalid_time_window';
    }>;

function isSafeEpochMilliseconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function createAiUsageTimeWindowSnapshot(
  timeWindow: AiUsageTimeWindow,
): AiUsageTimeWindowSnapshotResult {
  if (timeWindow === null || typeof timeWindow !== 'object' || Array.isArray(timeWindow)) {
    return { ok: false, code: 'invalid_time_window' };
  }

  const timeWindowPrototype = Object.getPrototypeOf(timeWindow);
  if (timeWindowPrototype !== Object.prototype && timeWindowPrototype !== null) {
    return { ok: false, code: 'invalid_time_window' };
  }

  const startInclusiveEpochMs = timeWindow.startInclusiveEpochMs;
  const endExclusiveEpochMs = timeWindow.endExclusiveEpochMs;

  if (
    !isSafeEpochMilliseconds(startInclusiveEpochMs)
    || !isSafeEpochMilliseconds(endExclusiveEpochMs)
    || startInclusiveEpochMs >= endExclusiveEpochMs
  ) {
    return { ok: false, code: 'invalid_time_window' };
  }

  return {
    ok: true,
    classify(occurredAtEpochMs) {
      if (!isSafeEpochMilliseconds(occurredAtEpochMs)) {
        return 'invalid';
      }

      return occurredAtEpochMs >= startInclusiveEpochMs
        && occurredAtEpochMs < endExclusiveEpochMs
        ? 'inside'
        : 'outside';
    },
  };
}
