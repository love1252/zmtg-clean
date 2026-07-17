import type { CustomerReferenceV1 } from '@/modules/institution-contracts/v1/customer';
import { isLowSensitiveCustomerText } from '@/modules/customer-center/domain/customer-query';

export type CustomerReferenceProjectionInput = Readonly<{
  customerId: unknown;
  displayName: unknown;
  maskedReference: unknown;
}>;

export type CustomerReferenceProjectionPolicy = Readonly<{
  isTrustedCustomerId: (customerId: string) => boolean;
  isApprovedDisplayName: (displayName: string) => boolean;
  isApprovedMaskedReference: (maskedReference: string) => boolean;
}>;

const CUSTOMER_REFERENCE_INPUT_KEYS = Object.freeze([
  'customerId',
  'displayName',
  'maskedReference',
] as const);
const CUSTOMER_REFERENCE_POLICY_KEYS = Object.freeze([
  'isTrustedCustomerId',
  'isApprovedDisplayName',
  'isApprovedMaskedReference',
] as const);
const normalizedIdentifierPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u;

function snapshotRequiredDataFields(
  value: unknown,
  requiredKeys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of requiredKeys) {
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

function normalizeIdentifier(value: unknown): string | null {
  return typeof value === 'string' &&
    value === value.trim() &&
    normalizedIdentifierPattern.test(value)
    ? value
    : null;
}

function normalizeDisplayText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && isLowSensitiveCustomerText(normalized)
    ? normalized
    : null;
}

function passesPolicyCheck<TArgs extends readonly unknown[]>(
  check: (...args: TArgs) => boolean,
  ...args: TArgs
) {
  try {
    return check(...args) === true;
  } catch {
    return false;
  }
}

function snapshotProjectionPolicy(
  value: unknown,
): CustomerReferenceProjectionPolicy | null {
  const snapshot = snapshotRequiredDataFields(value, CUSTOMER_REFERENCE_POLICY_KEYS);
  if (!snapshot) return null;

  const isTrustedCustomerId = snapshot.isTrustedCustomerId;
  const isApprovedDisplayName = snapshot.isApprovedDisplayName;
  const isApprovedMaskedReference = snapshot.isApprovedMaskedReference;
  if (
    typeof isTrustedCustomerId !== 'function' ||
    typeof isApprovedDisplayName !== 'function' ||
    typeof isApprovedMaskedReference !== 'function'
  ) {
    return null;
  }

  return Object.freeze({
    isTrustedCustomerId: isTrustedCustomerId as (customerId: string) => boolean,
    isApprovedDisplayName: isApprovedDisplayName as (displayName: string) => boolean,
    isApprovedMaskedReference: isApprovedMaskedReference as (
      maskedReference: string,
    ) => boolean,
  });
}

/**
 * Produces the exact public four-field customer reference. Extra source fields are deliberately
 * ignored; accessors and malformed required fields fail closed.
 */
export function mapCustomerReferenceV1(
  input: unknown,
  policy: CustomerReferenceProjectionPolicy,
): CustomerReferenceV1 | null {
  const snapshot = snapshotRequiredDataFields(input, CUSTOMER_REFERENCE_INPUT_KEYS);
  const policySnapshot = snapshotProjectionPolicy(policy);
  if (!snapshot || !policySnapshot) return null;

  const customerId = normalizeIdentifier(snapshot.customerId);
  const displayName = normalizeDisplayText(snapshot.displayName);
  const maskedReference =
    snapshot.maskedReference === null
      ? null
      : normalizeDisplayText(snapshot.maskedReference);

  if (
    !customerId ||
    !displayName ||
    !passesPolicyCheck(policySnapshot.isTrustedCustomerId, customerId) ||
    !passesPolicyCheck(policySnapshot.isApprovedDisplayName, displayName) ||
    (snapshot.maskedReference !== null &&
      (!maskedReference ||
        !passesPolicyCheck(policySnapshot.isApprovedMaskedReference, maskedReference)))
  ) {
    return null;
  }

  return {
    contractVersion: 'v1',
    customerId,
    displayName,
    maskedReference,
  };
}
