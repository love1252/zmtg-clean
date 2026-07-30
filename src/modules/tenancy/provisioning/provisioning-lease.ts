const LEASE_KEYS = Object.freeze([
  'branch',
  'expiresAt',
  'frozenBase',
  'holder',
  'invalidation',
  'journal',
  'leaseVersion',
  'operator',
  'release',
  'renewal',
  'scope',
  'startsAt',
  'targetEnvironment',
  'taskId',
]);
const SCOPE_KEYS = Object.freeze([
  'entryCount',
  'entryKeysDigest',
  'manifestDigest',
]);
const RENEWAL_KEYS = Object.freeze(['count', 'renewedAt', 'renewedBy']);
const INVALIDATION_KEYS = Object.freeze(['invalidatedAt', 'reasonCode']);
const RELEASE_KEYS = Object.freeze(['releasedAt', 'releasedBy']);
const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const FORBIDDEN_SENSITIVE_REFERENCE_PATTERN =
  /^(?:https?|postgres(?:ql)?|mysql|mongodb|redis):|(?:^|[._:/-])(?:api[_-]?key|citizen[_-]?id|database[_-]?url|id[_-]?card|mobile|password|passwd|phone|secret|token|sk-(?:proj|svcacct)?)(?:[._:/-]|$)/i;

export const PROVISIONING_EXECUTION_LEASE_VERSION =
  'mig01-a2-execution-lease/v1' as const;
export const PROVISIONING_EXPECTED_JOURNAL =
  '0038_mig_01a1_institution_isolation_expand' as const;

export interface ProvisioningExecutionLeasePayloadV1 {
  readonly leaseVersion: typeof PROVISIONING_EXECUTION_LEASE_VERSION;
  readonly taskId: string;
  readonly branch: string;
  readonly frozenBase: string;
  readonly journal: typeof PROVISIONING_EXPECTED_JOURNAL;
  readonly holder: string;
  readonly operator: string;
  readonly targetEnvironment: string;
  readonly scope: {
    readonly manifestDigest: `sha256:${string}`;
    readonly entryKeysDigest: `sha256:${string}`;
    readonly entryCount: number;
  };
  readonly startsAt: string;
  readonly expiresAt: string;
  readonly renewal: {
    readonly count: number;
    readonly renewedAt: string | null;
    readonly renewedBy: string | null;
  };
  readonly invalidation: {
    readonly invalidatedAt: string | null;
    readonly reasonCode: string | null;
  };
  readonly release: {
    readonly releasedAt: string | null;
    readonly releasedBy: string | null;
  };
}

export interface ProvisioningLeaseAuthorityPortV1 {
  verify(payload: ProvisioningExecutionLeasePayloadV1): Promise<boolean>;
}

export interface ProvisioningLeaseExpectationV1 {
  readonly leaseVersion: typeof PROVISIONING_EXECUTION_LEASE_VERSION;
  readonly taskId: string;
  readonly branch: string;
  readonly frozenBase: string;
  readonly journal: typeof PROVISIONING_EXPECTED_JOURNAL;
  readonly holder: string;
  readonly operator: string;
  readonly targetEnvironment: string;
  readonly manifestDigest: `sha256:${string}`;
  readonly entryKeysDigest: `sha256:${string}`;
  readonly entryCount: number;
  readonly approverReference: string;
}

declare const verifiedLeaseBrand: unique symbol;
export type VerifiedProvisioningExecutionLeaseV1 =
  ProvisioningExecutionLeasePayloadV1 & {
    readonly [verifiedLeaseBrand]: true;
  };

export class ProvisioningLeaseError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ProvisioningLeaseError';
  }
}

function fail(code: string): never {
  throw new ProvisioningLeaseError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  code: string,
): void {
  const keys = Object.keys(value).sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    fail(code);
  }
}

function string(
  value: unknown,
  pattern: RegExp,
  code: string,
): string {
  if (
    typeof value !== 'string' ||
    !pattern.test(value) ||
    value.normalize('NFC') !== value
  ) {
    fail(code);
  }
  return value;
}

function lowSensitiveString(
  value: unknown,
  pattern: RegExp,
  code: string,
): string {
  const result = string(value, pattern, code);
  const compactDigits = result.replace(/[._:/-]/g, '');
  if (
    FORBIDDEN_SENSITIVE_REFERENCE_PATTERN.test(result) ||
    /^(?:1[3-9]\d{9}|\d{15}|\d{16,19}|\d{17}[0-9Xx])$/.test(
      compactDigits,
    )
  ) {
    fail(code);
  }
  return result;
}

function instant(value: unknown, code: string): string {
  const result = string(value, INSTANT_PATTERN, code);
  if (Number.isNaN(Date.parse(result)) || new Date(result).toISOString() !== result) {
    fail(code);
  }
  return result;
}

function nullableString(
  value: unknown,
  pattern: RegExp,
  code: string,
): string | null {
  return value === null ? null : lowSensitiveString(value, pattern, code);
}

export function parseProvisioningExecutionLease(
  value: unknown,
): ProvisioningExecutionLeasePayloadV1 {
  if (!isRecord(value)) {
    fail('lease_invalid');
  }
  exactKeys(value, LEASE_KEYS, 'lease_shape_invalid');
  if (!isRecord(value.scope)) {
    fail('lease_scope_invalid');
  }
  if (!isRecord(value.renewal)) {
    fail('lease_renewal_invalid');
  }
  if (!isRecord(value.invalidation)) {
    fail('lease_invalidation_invalid');
  }
  if (!isRecord(value.release)) {
    fail('lease_release_invalid');
  }
  exactKeys(value.scope, SCOPE_KEYS, 'lease_scope_shape_invalid');
  exactKeys(value.renewal, RENEWAL_KEYS, 'lease_renewal_shape_invalid');
  exactKeys(
    value.invalidation,
    INVALIDATION_KEYS,
    'lease_invalidation_shape_invalid',
  );
  exactKeys(value.release, RELEASE_KEYS, 'lease_release_shape_invalid');

  if (value.leaseVersion !== PROVISIONING_EXECUTION_LEASE_VERSION) {
    fail('lease_version_invalid');
  }
  if (value.journal !== PROVISIONING_EXPECTED_JOURNAL) {
    fail('lease_journal_invalid');
  }
  if (
    !Number.isSafeInteger(value.scope.entryCount) ||
    (value.scope.entryCount as number) <= 0
  ) {
    fail('lease_entry_count_invalid');
  }
  if (
    !Number.isSafeInteger(value.renewal.count) ||
    (value.renewal.count as number) < 0
  ) {
    fail('lease_renewal_count_invalid');
  }

  const renewedAt =
    value.renewal.renewedAt === null
      ? null
      : instant(value.renewal.renewedAt, 'lease_renewed_at_invalid');
  const renewedBy = nullableString(
    value.renewal.renewedBy,
    REFERENCE_PATTERN,
    'lease_renewed_by_invalid',
  );
  if (
    ((value.renewal.count as number) === 0 &&
      (renewedAt !== null || renewedBy !== null)) ||
    ((value.renewal.count as number) > 0 &&
      (renewedAt === null || renewedBy === null))
  ) {
    fail('lease_renewal_inconsistent');
  }

  const invalidatedAt =
    value.invalidation.invalidatedAt === null
      ? null
      : instant(
          value.invalidation.invalidatedAt,
          'lease_invalidated_at_invalid',
        );
  const reasonCode = nullableString(
    value.invalidation.reasonCode,
    REFERENCE_PATTERN,
    'lease_invalidation_reason_invalid',
  );
  if ((invalidatedAt === null) !== (reasonCode === null)) {
    fail('lease_invalidation_inconsistent');
  }

  const releasedAt =
    value.release.releasedAt === null
      ? null
      : instant(value.release.releasedAt, 'lease_released_at_invalid');
  const releasedBy = nullableString(
    value.release.releasedBy,
    REFERENCE_PATTERN,
    'lease_released_by_invalid',
  );
  if ((releasedAt === null) !== (releasedBy === null)) {
    fail('lease_release_inconsistent');
  }

  const startsAt = instant(value.startsAt, 'lease_starts_at_invalid');
  const expiresAt = instant(value.expiresAt, 'lease_expires_at_invalid');
  if (Date.parse(startsAt) >= Date.parse(expiresAt)) {
    fail('lease_time_window_invalid');
  }
  if (
    renewedAt !== null &&
    (Date.parse(renewedAt) < Date.parse(startsAt) ||
      Date.parse(renewedAt) >= Date.parse(expiresAt))
  ) {
    fail('lease_renewal_time_invalid');
  }

  return Object.freeze({
    leaseVersion: PROVISIONING_EXECUTION_LEASE_VERSION,
    taskId: lowSensitiveString(
      value.taskId,
      REFERENCE_PATTERN,
      'lease_task_id_invalid',
    ),
    branch: lowSensitiveString(
      value.branch,
      BRANCH_PATTERN,
      'lease_branch_invalid',
    ),
    frozenBase: string(
      value.frozenBase,
      SHA_PATTERN,
      'lease_frozen_base_invalid',
    ),
    journal: PROVISIONING_EXPECTED_JOURNAL,
    holder: lowSensitiveString(
      value.holder,
      REFERENCE_PATTERN,
      'lease_holder_invalid',
    ),
    operator: lowSensitiveString(
      value.operator,
      REFERENCE_PATTERN,
      'lease_operator_invalid',
    ),
    targetEnvironment: lowSensitiveString(
      value.targetEnvironment,
      REFERENCE_PATTERN,
      'lease_environment_invalid',
    ),
    scope: Object.freeze({
      manifestDigest: string(
        value.scope.manifestDigest,
        DIGEST_PATTERN,
        'lease_manifest_digest_invalid',
      ) as `sha256:${string}`,
      entryKeysDigest: string(
        value.scope.entryKeysDigest,
        DIGEST_PATTERN,
        'lease_entry_keys_digest_invalid',
      ) as `sha256:${string}`,
      entryCount: value.scope.entryCount as number,
    }),
    startsAt,
    expiresAt,
    renewal: Object.freeze({
      count: value.renewal.count as number,
      renewedAt,
      renewedBy,
    }),
    invalidation: Object.freeze({ invalidatedAt, reasonCode }),
    release: Object.freeze({ releasedAt, releasedBy }),
  });
}

export async function verifyProvisioningExecutionLease(
  value: unknown,
  authority: ProvisioningLeaseAuthorityPortV1,
  expected: ProvisioningLeaseExpectationV1,
  now: Date,
): Promise<VerifiedProvisioningExecutionLeaseV1> {
  const payload = parseProvisioningExecutionLease(value);
  const nowTime = now.getTime();
  if (
    !Number.isFinite(nowTime) ||
    payload.leaseVersion !== expected.leaseVersion ||
    payload.taskId !== expected.taskId ||
    payload.branch !== expected.branch ||
    payload.frozenBase !== expected.frozenBase ||
    payload.journal !== expected.journal ||
    payload.holder !== expected.holder ||
    payload.operator !== expected.operator ||
    payload.targetEnvironment !== expected.targetEnvironment ||
    payload.scope.manifestDigest !== expected.manifestDigest ||
    payload.scope.entryKeysDigest !== expected.entryKeysDigest ||
    payload.scope.entryCount !== expected.entryCount ||
    payload.operator === expected.approverReference ||
    payload.invalidation.invalidatedAt !== null ||
    payload.release.releasedAt !== null ||
    (payload.renewal.renewedAt !== null &&
      Date.parse(payload.renewal.renewedAt) > nowTime) ||
    Date.parse(payload.startsAt) > nowTime ||
    Date.parse(payload.expiresAt) <= nowTime
  ) {
    fail('lease_not_authorized');
  }

  let authorized = false;
  try {
    authorized = await authority.verify(payload);
  } catch {
    fail('lease_authority_unavailable');
  }
  if (!authorized) {
    fail('lease_not_authorized');
  }

  return payload as VerifiedProvisioningExecutionLeaseV1;
}
