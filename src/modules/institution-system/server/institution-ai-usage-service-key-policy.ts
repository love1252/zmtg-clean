import { types as nodeTypes } from 'node:util';

import type { AiUsageServiceKeyPolicy } from '@/modules/institution-system/domain/ai-usage-service-keys';

const OWNER_POLICY_MAX_MAPPINGS = 8;
const OWNER_POLICY_MAX_STRING_LENGTH = 64;
const OWNER_POLICY_REVISION = 'institution_ai_usage_service_key_policy_v1';
const stableKeyPattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;

type ExactPlainSnapshot = Readonly<Record<string, unknown>>;

export type InstitutionAiUsageServiceKeyPolicySnapshot = Readonly<{
  revision: typeof OWNER_POLICY_REVISION;
  allowedServiceKeys: AiUsageServiceKeyPolicy;
  resolve: (serviceCategory: string | null, serviceAction: string | null) => string | null;
}>;

export type InstitutionAiUsageServiceKeyPolicySnapshotResult =
  | Readonly<{ ok: true; snapshot: InstitutionAiUsageServiceKeyPolicySnapshot }>
  | Readonly<{ ok: false; code: 'owner_policy_unavailable' }>;

const ownerPolicyDefinition = Object.freeze({
  revision: OWNER_POLICY_REVISION,
  allowedServiceKeys: Object.freeze([
    'analytics_report',
    'conversation_ai',
    'knowledge_qa',
  ]),
  mappings: Object.freeze([
    Object.freeze({
      serviceCategory: 'ai_qa',
      serviceAction: 'direct_answer',
      serviceKey: 'conversation_ai',
    }),
    Object.freeze({
      serviceCategory: 'ai_qa',
      serviceAction: 'quota_rejected',
      serviceKey: 'conversation_ai',
    }),
    Object.freeze({
      serviceCategory: 'knowledge_base_qa',
      serviceAction: 'rag_answer',
      serviceKey: 'knowledge_qa',
    }),
  ]),
});

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & Readonly<{ value: unknown }> {
  return descriptor !== undefined
    && Object.prototype.hasOwnProperty.call(descriptor, 'value')
    && !Object.prototype.hasOwnProperty.call(descriptor, 'get')
    && !Object.prototype.hasOwnProperty.call(descriptor, 'set');
}

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & Readonly<{ value: unknown }> {
  return isDataDescriptor(descriptor) && descriptor.enumerable === true;
}

function snapshotExactPlainObject(
  value: unknown,
  expectedKeys: readonly string[],
): ExactPlainSnapshot | null {
  try {
    if (
      value === null
      || typeof value !== 'object'
      || Array.isArray(value)
      || nodeTypes.isProxy(value)
      || Object.getPrototypeOf(value) !== Object.prototype
    ) return null;

    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.some(key => typeof key !== 'string')
      || ownKeys.length !== expectedKeys.length
      || expectedKeys.some(key => !Object.prototype.hasOwnProperty.call(descriptors, key))
    ) return null;

    const snapshot: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!isEnumerableDataDescriptor(descriptor)) return null;
      Object.defineProperty(snapshot, key, {
        configurable: false,
        enumerable: true,
        value: descriptor.value,
        writable: false,
      });
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function snapshotExactDenseArray(value: unknown, maximumLength: number): readonly unknown[] | null {
  try {
    if (
      !Array.isArray(value)
      || nodeTypes.isProxy(value)
      || Object.getPrototypeOf(value) !== Array.prototype
    ) return null;

    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (
      !isDataDescriptor(lengthDescriptor)
      || typeof lengthDescriptor.value !== 'number'
      || !Number.isSafeInteger(lengthDescriptor.value)
      || lengthDescriptor.value < 0
      || lengthDescriptor.value > maximumLength
    ) return null;

    const length = lengthDescriptor.value;
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.some(key => typeof key !== 'string')
      || ownKeys.length !== length + 1
      || !Object.prototype.hasOwnProperty.call(descriptors, 'length')
    ) return null;

    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!isEnumerableDataDescriptor(descriptor)) return null;
      snapshot.push(descriptor.value);
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

function isStablePolicyString(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= OWNER_POLICY_MAX_STRING_LENGTH
    && stableKeyPattern.test(value);
}

function createOwnerPolicySnapshot(): InstitutionAiUsageServiceKeyPolicySnapshotResult {
  const definition = snapshotExactPlainObject(ownerPolicyDefinition, [
    'revision',
    'allowedServiceKeys',
    'mappings',
  ]);
  if (!definition || definition.revision !== OWNER_POLICY_REVISION) {
    return Object.freeze({ ok: false, code: 'owner_policy_unavailable' });
  }

  const rawAllowedServiceKeys = snapshotExactDenseArray(
    definition.allowedServiceKeys,
    OWNER_POLICY_MAX_MAPPINGS,
  );
  const rawMappings = snapshotExactDenseArray(definition.mappings, OWNER_POLICY_MAX_MAPPINGS);
  if (!rawAllowedServiceKeys || !rawMappings || rawAllowedServiceKeys.length === 0 || rawMappings.length === 0) {
    return Object.freeze({ ok: false, code: 'owner_policy_unavailable' });
  }

  const allowedServiceKeys: string[] = [];
  const allowedServiceKeySet = new Set<string>();
  for (const serviceKey of rawAllowedServiceKeys) {
    if (!isStablePolicyString(serviceKey) || allowedServiceKeySet.has(serviceKey)) {
      return Object.freeze({ ok: false, code: 'owner_policy_unavailable' });
    }
    allowedServiceKeySet.add(serviceKey);
    allowedServiceKeys.push(serviceKey);
  }

  const mapping = new Map<string, string>();
  for (const value of rawMappings) {
    const item = snapshotExactPlainObject(value, [
      'serviceCategory',
      'serviceAction',
      'serviceKey',
    ]);
    if (
      !item
      || !isStablePolicyString(item.serviceCategory)
      || !isStablePolicyString(item.serviceAction)
      || !isStablePolicyString(item.serviceKey)
      || !allowedServiceKeySet.has(item.serviceKey)
    ) return Object.freeze({ ok: false, code: 'owner_policy_unavailable' });

    const mappingKey = `${item.serviceCategory}\u0000${item.serviceAction}`;
    if (mapping.has(mappingKey)) return Object.freeze({ ok: false, code: 'owner_policy_unavailable' });
    mapping.set(mappingKey, item.serviceKey);
  }

  return Object.freeze({
    ok: true,
    snapshot: Object.freeze({
      revision: OWNER_POLICY_REVISION,
      allowedServiceKeys: Object.freeze(allowedServiceKeys),
      resolve(serviceCategory: string | null, serviceAction: string | null) {
        if (!isStablePolicyString(serviceCategory) || !isStablePolicyString(serviceAction)) return null;
        return mapping.get(`${serviceCategory}\u0000${serviceAction}`) ?? null;
      },
    }),
  });
}

const ownerPolicySnapshot = createOwnerPolicySnapshot();

/**
 * This owner boundary has no caller-supplied policy input. The reader can only consume this
 * versioned snapshot; adding a mapping requires a reviewed owner-module change.
 */
export function getInstitutionAiUsageServiceKeyPolicySnapshot(): InstitutionAiUsageServiceKeyPolicySnapshotResult {
  return ownerPolicySnapshot;
}
