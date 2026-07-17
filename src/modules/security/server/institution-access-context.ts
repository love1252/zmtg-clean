import type { AccessContext } from '@/modules/security/domain/access-control';
import {
  isInstitutionAccessContextSourceV1,
  isNonEmptyInstitutionReferenceV1,
  type InstitutionAccessContextFailureReasonV1,
  type InstitutionAccessContextV1,
} from '@/modules/security/domain/institution-access';
import { isInstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';

export type InstitutionAccessContextResolutionV1 =
  | Readonly<{ ok: true; context: InstitutionAccessContextV1 }>
  | Readonly<{ ok: false; reason: InstitutionAccessContextFailureReasonV1 }>;

function fail(
  reason: InstitutionAccessContextFailureReasonV1,
): InstitutionAccessContextResolutionV1 {
  return Object.freeze({ ok: false, reason });
}

const REQUIRED_ACCESS_CONTEXT_KEYS = Object.freeze([
  'userId',
  'role',
  'scope',
  'tenantId',
  'source',
] as const);
const ALLOWED_ACCESS_CONTEXT_KEYS = Object.freeze([
  ...REQUIRED_ACCESS_CONTEXT_KEYS,
  'institutionId',
] as const);

function snapshotStrictAccessContext(
  value: unknown,
): Readonly<Record<string, unknown>> | null {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);

    if (
      REQUIRED_ACCESS_CONTEXT_KEYS.some(
        (key) => !Object.prototype.hasOwnProperty.call(descriptors, key),
      ) ||
      ownKeys.some(
        (key) =>
          typeof key !== 'string' ||
          !(ALLOWED_ACCESS_CONTEXT_KEYS as readonly string[]).includes(key),
      )
    ) {
      return null;
    }

    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of ownKeys) {
      if (typeof key !== 'string') return null;
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return null;
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

/**
 * Narrows an already server-resolved access context to the strict institution partition. This
 * function deliberately has no client-supplied institution argument. It rejects demo sessions,
 * but it does not query the member directory or authorize a page/object/action: the caller must
 * first obtain a fresh formal session context from the current-member reader and must reauthorize
 * the target operation after this scope narrowing succeeds.
 */
export function resolveInstitutionAccessContextV1(
  accessContext: AccessContext | null,
): InstitutionAccessContextResolutionV1 {
  if (!accessContext) return fail('unauthenticated');
  const snapshot = snapshotStrictAccessContext(accessContext);
  if (!snapshot) return fail('invalid_context_shape');
  if (snapshot.scope !== 'tenant') return fail('non_tenant_scope');
  if (!isInstitutionRoleV1(snapshot.role)) return fail('unsupported_role');
  if (!isNonEmptyInstitutionReferenceV1(snapshot.userId)) return fail('invalid_user');
  if (!isNonEmptyInstitutionReferenceV1(snapshot.tenantId)) return fail('missing_tenant');
  if (!isNonEmptyInstitutionReferenceV1(snapshot.institutionId)) {
    return fail('missing_institution');
  }
  if (!isInstitutionAccessContextSourceV1(snapshot.source)) return fail('invalid_source');

  const context: InstitutionAccessContextV1 = Object.freeze({
    userId: snapshot.userId,
    role: snapshot.role,
    tenantId: snapshot.tenantId,
    institutionId: snapshot.institutionId,
    source: snapshot.source,
  });

  return Object.freeze({ ok: true, context });
}
