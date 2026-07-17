export const FOLLOW_UP_RISK_LEVELS = ['none', 'high'] as const;

export type FollowUpRiskLevel = (typeof FOLLOW_UP_RISK_LEVELS)[number];

export const FOLLOW_UP_RISK_ESCALATION_KINDS = [
  'clinical',
  'complaint',
  'refund_dispute',
  'privacy_request',
  'opt_out',
] as const;

export type FollowUpRiskEscalationKind =
  (typeof FOLLOW_UP_RISK_ESCALATION_KINDS)[number];

export type FollowUpRiskEscalation = Readonly<{
  level: 'high';
  kind: FollowUpRiskEscalationKind;
  riskEventId: string;
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

function isRiskEventReference(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  );
}

export function isFollowUpRiskLevel(value: unknown): value is FollowUpRiskLevel {
  return includesValue(FOLLOW_UP_RISK_LEVELS, value);
}

export function isFollowUpRiskEscalationKind(
  value: unknown,
): value is FollowUpRiskEscalationKind {
  return includesValue(FOLLOW_UP_RISK_ESCALATION_KINDS, value);
}

export function parseFollowUpRiskEscalation(
  value: unknown,
): FollowUpRiskEscalation | null {
  const snapshot = snapshotExactDataRecord(value, ['level', 'kind', 'riskEventId']);
  if (
    !snapshot ||
    snapshot.level !== 'high' ||
    !isFollowUpRiskEscalationKind(snapshot.kind) ||
    !isRiskEventReference(snapshot.riskEventId)
  ) {
    return null;
  }

  return Object.freeze({
    level: 'high',
    kind: snapshot.kind,
    riskEventId: snapshot.riskEventId,
  });
}
