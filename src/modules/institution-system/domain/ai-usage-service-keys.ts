const AI_USAGE_SERVICE_KEY_MAX_LENGTH = 64;
const stableServiceKeyPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;

/** The caller-owned allowlist supplies business approval; this type does not define a registry. */
export type AiUsageServiceKeyPolicy = readonly string[];

export type AiUsageServiceKeyPolicySnapshotResult =
  | Readonly<{
      ok: true;
      isAllowed: (serviceKey: unknown) => serviceKey is string;
    }>
  | Readonly<{
      ok: false;
      code: 'invalid_service_key_policy';
    }>;

function isStableServiceKey(value: unknown): value is string {
  return (
    typeof value === 'string'
    && value.length > 0
    && value.length <= AI_USAGE_SERVICE_KEY_MAX_LENGTH
    && stableServiceKeyPattern.test(value)
  );
}

export function createAiUsageServiceKeyPolicySnapshot(
  policy: AiUsageServiceKeyPolicy,
): AiUsageServiceKeyPolicySnapshotResult {
  if (!Array.isArray(policy) || policy.length === 0) {
    return { ok: false, code: 'invalid_service_key_policy' };
  }

  const allowedServiceKeys = new Set<string>();

  for (const serviceKey of policy) {
    if (!isStableServiceKey(serviceKey) || allowedServiceKeys.has(serviceKey)) {
      return { ok: false, code: 'invalid_service_key_policy' };
    }

    allowedServiceKeys.add(serviceKey);
  }

  return {
    ok: true,
    isAllowed(serviceKey): serviceKey is string {
      return isStableServiceKey(serviceKey) && allowedServiceKeys.has(serviceKey);
    },
  };
}
