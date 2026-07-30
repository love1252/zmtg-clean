import type { ProvisioningContextPolicyV1 } from './provisioning-manifest';

export const PROVISIONING_CONTEXT_POLICY_VERSION =
  'mig01-a2-local-acceptance-context-policy/v1' as const;
export const PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT =
  'local_acceptance' as const;

export const PROVISIONING_CONTEXT_POLICY_TIMEZONES = Object.freeze([
  'Asia/Shanghai',
] as const);
export const PROVISIONING_CONTEXT_POLICY_CURRENCIES = Object.freeze([
  'CNY',
] as const);

export type ProvisioningContextPolicyErrorCode =
  | 'provisioning_context_policy_invalid'
  | 'provisioning_context_policy_timezone_invalid'
  | 'provisioning_context_policy_currency_invalid'
  | 'provisioning_context_policy_environment_invalid';

export interface LocalAcceptanceProvisioningContextPolicyV1
  extends ProvisioningContextPolicyV1 {
  readonly policyVersion: typeof PROVISIONING_CONTEXT_POLICY_VERSION;
  readonly targetEnvironment: typeof PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT;
  readonly timezones: typeof PROVISIONING_CONTEXT_POLICY_TIMEZONES;
  readonly currencies: typeof PROVISIONING_CONTEXT_POLICY_CURRENCIES;
}

export class ProvisioningContextPolicyError extends Error {
  constructor(readonly code: ProvisioningContextPolicyErrorCode) {
    super(code);
    this.name = 'ProvisioningContextPolicyError';
  }
}

function fail(code: ProvisioningContextPolicyErrorCode): never {
  throw new ProvisioningContextPolicyError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function isRegisteredTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function isRegisteredCurrency(value: string): boolean {
  return (
    typeof Intl.supportedValuesOf === 'function' &&
    Intl.supportedValuesOf('currency').includes(value)
  );
}

function requireExactApprovedList(
  value: unknown,
  expected: readonly string[],
  validate: (item: string) => boolean,
  code:
    | 'provisioning_context_policy_timezone_invalid'
    | 'provisioning_context_policy_currency_invalid',
): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail(code);
  }
  const seen = new Set<string>();
  for (const item of value) {
    if (
      typeof item !== 'string' ||
      item.normalize('NFC') !== item ||
      !validate(item) ||
      seen.has(item)
    ) {
      fail(code);
    }
    seen.add(item);
  }
  if (
    value.length !== expected.length ||
    value.some((item, index) => item !== expected[index])
  ) {
    fail(code);
  }
  return Object.freeze([...value]);
}

export function createProvisioningContextPolicyV1(
  value: unknown,
): LocalAcceptanceProvisioningContextPolicyV1 {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      'currencies',
      'policyVersion',
      'targetEnvironment',
      'timezones',
    ])
  ) {
    fail('provisioning_context_policy_invalid');
  }
  if (value.policyVersion !== PROVISIONING_CONTEXT_POLICY_VERSION) {
    fail('provisioning_context_policy_invalid');
  }
  if (
    value.targetEnvironment !==
    PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT
  ) {
    fail('provisioning_context_policy_environment_invalid');
  }
  const timezones = requireExactApprovedList(
    value.timezones,
    PROVISIONING_CONTEXT_POLICY_TIMEZONES,
    isRegisteredTimezone,
    'provisioning_context_policy_timezone_invalid',
  ) as typeof PROVISIONING_CONTEXT_POLICY_TIMEZONES;
  const currencies = requireExactApprovedList(
    value.currencies,
    PROVISIONING_CONTEXT_POLICY_CURRENCIES,
    isRegisteredCurrency,
    'provisioning_context_policy_currency_invalid',
  ) as typeof PROVISIONING_CONTEXT_POLICY_CURRENCIES;

  return Object.freeze({
    policyVersion: PROVISIONING_CONTEXT_POLICY_VERSION,
    targetEnvironment: PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT,
    timezones,
    currencies,
  });
}

export const LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY =
  createProvisioningContextPolicyV1({
    policyVersion: PROVISIONING_CONTEXT_POLICY_VERSION,
    targetEnvironment: PROVISIONING_CONTEXT_POLICY_TARGET_ENVIRONMENT,
    timezones: PROVISIONING_CONTEXT_POLICY_TIMEZONES,
    currencies: PROVISIONING_CONTEXT_POLICY_CURRENCIES,
  });

export function getLocalAcceptanceProvisioningContextPolicy(): ProvisioningContextPolicyV1 {
  return LOCAL_ACCEPTANCE_PROVISIONING_CONTEXT_POLICY;
}
