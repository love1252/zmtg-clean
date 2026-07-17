export const FOLLOW_UP_COMPLETION_CODES = [
  'contact_completed',
  'no_response_closed',
  'his_appointment_linked',
  'customer_declined',
  'invalid_or_duplicate',
] as const;

export type FollowUpCompletionCode = (typeof FOLLOW_UP_COMPLETION_CODES)[number];

export const FOLLOW_UP_MANUAL_FEEDBACK_KIND = 'manual_low_sensitivity' as const;
export const FOLLOW_UP_MANUAL_FEEDBACK_MAX_LENGTH = 240 as const;

/**
 * This is an operator-supplied, low-sensitivity summary projection. It is never a completion
 * criterion, message payload, clinical conclusion, or proof of delivery.
 */
export type FollowUpManualFeedback = Readonly<{
  kind: typeof FOLLOW_UP_MANUAL_FEEDBACK_KIND;
  summary: string;
}>;

export type FollowUpCompletionResult = Readonly<{
  code: FollowUpCompletionCode;
  feedback: FollowUpManualFeedback | null;
}>;

function includesValue(values: readonly string[], value: unknown): value is string {
  return typeof value === 'string' && values.includes(value);
}

function snapshotExactDataRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== 'string') ||
      expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(descriptors, key))
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return null;
      Object.defineProperty(snapshot, key, {
        value: descriptor.value,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function toDigitXSkeleton(value: string): string {
  return Array.from(value.normalize('NFKC'), (character) => {
    if (/\d/u.test(character)) return character;
    if (character === 'X' || character === 'x') return 'X';
    return ' ';
  }).join('');
}

function containsMobileOrIdentityReference(value: string): boolean {
  const skeleton = toDigitXSkeleton(value);
  const mobile = /(?:^|[^0-9])(?:8[^0-9]*6[^0-9]*)?1[3-9](?:[^0-9]*\d){9}(?!\d)/u;
  const identity = /(?:^|[^0-9X])\d(?:[^0-9]*\d){16}[^0-9]*[0-9X](?![0-9X])/u;
  return mobile.test(skeleton) || identity.test(skeleton);
}

function isLowSensitivitySummary(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const normalizedValue = value.normalize('NFKC');

  return (
    value === value.trim() &&
    Array.from(value).length >= 1 &&
    Array.from(value).length <= FOLLOW_UP_MANUAL_FEEDBACK_MAX_LENGTH &&
    !/[\u0000-\u001F\u007F-\u009F]/u.test(value) &&
    !/[\p{Cf}\u200B-\u200D\u2060\uFEFF]/u.test(normalizedValue) &&
    !containsMobileOrIdentityReference(normalizedValue) &&
    !/(身份证|病历|病案|门诊号|住院号|病历号)/u.test(value)
  );
}

export function isFollowUpCompletionCode(value: unknown): value is FollowUpCompletionCode {
  return includesValue(FOLLOW_UP_COMPLETION_CODES, value);
}

export function parseFollowUpManualFeedback(
  value: unknown,
): FollowUpManualFeedback | null {
  const snapshot = snapshotExactDataRecord(value, ['kind', 'summary']);
  if (
    !snapshot ||
    snapshot.kind !== FOLLOW_UP_MANUAL_FEEDBACK_KIND ||
    !isLowSensitivitySummary(snapshot.summary)
  ) {
    return null;
  }

  return Object.freeze({
    kind: FOLLOW_UP_MANUAL_FEEDBACK_KIND,
    summary: snapshot.summary,
  });
}

export function parseFollowUpCompletionResult(
  value: unknown,
): FollowUpCompletionResult | null {
  const snapshot =
    snapshotExactDataRecord(value, ['code', 'feedback']) ??
    snapshotExactDataRecord(value, ['code']);
  if (!snapshot || !isFollowUpCompletionCode(snapshot.code)) return null;

  const feedback =
    snapshot.feedback === undefined || snapshot.feedback === null
      ? null
      : parseFollowUpManualFeedback(snapshot.feedback);
  if (snapshot.feedback !== undefined && snapshot.feedback !== null && feedback === null) {
    return null;
  }

  return Object.freeze({
    code: snapshot.code,
    feedback,
  });
}

/**
 * New commands must carry the complete structured shape. The code-only variant remains a
 * read-compatibility concern for persisted historical snapshots only.
 */
export function parseFollowUpCompletionResultForWrite(
  value: unknown,
): FollowUpCompletionResult | null {
  const snapshot = snapshotExactDataRecord(value, ['code', 'feedback']);
  if (!snapshot || !isFollowUpCompletionCode(snapshot.code)) return null;

  const feedback =
    snapshot.feedback === null ? null : parseFollowUpManualFeedback(snapshot.feedback);
  if (snapshot.feedback !== null && feedback === null) return null;

  return Object.freeze({
    code: snapshot.code,
    feedback,
  });
}
