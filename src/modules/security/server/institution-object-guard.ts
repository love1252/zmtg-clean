import { isProxy } from 'node:util/types';

import {
  isInstitutionObjectActionV1,
  isInstitutionObjectTypeV1,
  type AuthoritativeInstitutionObjectFactQueryV1,
  type AuthoritativeInstitutionObjectFactResolutionV1,
  type AuthoritativeInstitutionObjectFactV1,
  type InstitutionObjectActionV1,
  type InstitutionObjectFactReaderV1,
  type InstitutionObjectTypeV1,
} from '@/modules/security/ports/institution-object-fact';
import {
  isInstitutionActionPolicyAllowV1,
  isInstitutionActionPolicyV1,
  type InstitutionActionPolicyV1,
} from '@/modules/security/server/institution-action-policy';
import {
  isInstitutionScopeAllowV1,
  isInstitutionScopeGuardV1,
  type InstitutionScopeGuardV1,
} from '@/modules/security/server/institution-scope-guard';

const READER_FACTORY_KEYS = Object.freeze(['resolve'] as const);
const QUERY_KEYS = Object.freeze([
  'objectType',
  'objectId',
  'tenantId',
  'institutionId',
] as const);
const FACT_KEYS = Object.freeze([
  'kind',
  'objectType',
  'objectId',
  'tenantId',
  'institutionId',
  'status',
  'revision',
  'observedAt',
] as const);
const REJECTION_KEYS = Object.freeze(['kind', 'code'] as const);
const GUARD_FACTORY_KEYS = Object.freeze([
  'scopeGuard',
  'objectFactReader',
  'actionPolicy',
  'now',
] as const);
const PUBLIC_INPUT_KEYS = Object.freeze([
  'objectType',
  'objectId',
  'action',
] as const);
const SCOPE_GUARD_KEYS = Object.freeze(['authorizeCurrentRequest'] as const);
const READER_KEYS = Object.freeze(['resolve'] as const);
const POLICY_KEYS = Object.freeze(['authorize'] as const);

const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const OBJECT_FACT_FRESHNESS_MS = 60 * 1_000;

export type InstitutionObjectAuthorizationInputV1 = Readonly<{
  objectType: InstitutionObjectTypeV1;
  objectId: string;
  action: InstitutionObjectActionV1;
}>;

export type InstitutionObjectGuardFailureCodeV1 =
  | 'scope_unavailable'
  | 'object_denied'
  | 'object_invalid'
  | 'object_unavailable'
  | 'object_stale'
  | 'action_unregistered'
  | 'action_role_denied'
  | 'policy_unavailable';

declare class ObjectGuardSeal {
  private readonly seal;
}

declare class ObjectAllowSeal {
  private readonly seal;
}

export type InstitutionObjectActionAllowV1 = ObjectAllowSeal &
  Readonly<{
    kind: 'institution_object_action_allow';
    objectType: InstitutionObjectTypeV1;
    action: InstitutionObjectActionV1;
    objectRevision: number;
    decidedAt: string;
    validUntil: string;
  }>;

export type InstitutionObjectGuardResolutionV1 =
  | InstitutionObjectActionAllowV1
  | Readonly<{
      kind: 'rejected';
      code: InstitutionObjectGuardFailureCodeV1;
    }>;

export type InstitutionObjectGuardV1 = ObjectGuardSeal &
  Readonly<{
    authorizeCurrentObjectAction: (
      input: InstitutionObjectAuthorizationInputV1,
    ) => Promise<InstitutionObjectGuardResolutionV1>;
  }>;

type Resolver = (
  input: AuthoritativeInstitutionObjectFactQueryV1,
) => Promise<AuthoritativeInstitutionObjectFactResolutionV1>;

type Dependencies = Readonly<{
  failure:
    | 'scope_unavailable'
    | 'object_unavailable'
    | 'policy_unavailable'
    | null;
  authorizeScope: InstitutionScopeGuardV1['authorizeCurrentRequest'] | null;
  resolveObject: InstitutionObjectFactReaderV1['resolve'] | null;
  authorizePolicy: InstitutionActionPolicyV1['authorize'] | null;
  now: (() => Date) | null;
}>;

const readerHandles = new WeakSet<object>();
const factHandles = new WeakSet<object>();
const guardHandles = new WeakSet<object>();
const allowHandles = new WeakSet<object>();

function rejected(
  code: InstitutionObjectGuardFailureCodeV1,
): InstitutionObjectGuardResolutionV1 {
  return Object.freeze({ kind: 'rejected', code });
}

function snapshot(
  value: unknown,
  keys: readonly string[],
): Readonly<Record<string, unknown>> | null {
  try {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      Reflect.ownKeys(descriptors).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(descriptors, key))
    ) {
      return null;
    }
    const result: Record<string, unknown> = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
      Object.defineProperty(result, key, {
        value: descriptor.value,
        enumerable: true,
      });
    }
    return Object.freeze(result);
  } catch {
    return null;
  }
}

function isFunction(value: unknown): value is (...args: never[]) => unknown {
  try {
    return typeof value === 'function' && !isProxy(value);
  } catch {
    return false;
  }
}

function isId(value: unknown, max = 96): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= max &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  );
}

function instant(
  value: unknown,
): Readonly<{ raw: string; epochMs: number }> | null {
  if (typeof value !== 'string' || !CANONICAL_UTC_INSTANT.test(value)) {
    return null;
  }
  const epochMs = Date.parse(value);
  if (!Number.isFinite(epochMs) || new Date(epochMs).toISOString() !== value) {
    return null;
  }
  return Object.freeze({ raw: value, epochMs });
}

function readNow(
  now: (() => Date) | null,
): Readonly<{ raw: string; epochMs: number }> | null {
  if (!now) return null;
  try {
    const value = now();
    if (
      value === null ||
      typeof value !== 'object' ||
      isProxy(value) ||
      Object.getPrototypeOf(value) !== Date.prototype
    ) {
      return null;
    }
    const epochMs = Date.prototype.getTime.call(value);
    return Number.isFinite(epochMs)
      ? Object.freeze({
          raw: new Date(epochMs).toISOString(),
          epochMs,
        })
      : null;
  } catch {
    return null;
  }
}

function parseQuery(
  value: unknown,
): AuthoritativeInstitutionObjectFactQueryV1 | null {
  const input = snapshot(value, QUERY_KEYS);
  if (
    !input ||
    !isInstitutionObjectTypeV1(input.objectType) ||
    !isId(input.objectId) ||
    !isId(input.tenantId, 64) ||
    !isId(input.institutionId, 64)
  ) {
    return null;
  }
  return Object.freeze({
    objectType: input.objectType,
    objectId: input.objectId,
    tenantId: input.tenantId,
    institutionId: input.institutionId,
  });
}

function parsePublicInput(
  value: unknown,
): InstitutionObjectAuthorizationInputV1 | null {
  const input = snapshot(value, PUBLIC_INPUT_KEYS);
  if (
    !input ||
    !isInstitutionObjectTypeV1(input.objectType) ||
    !isId(input.objectId) ||
    !isInstitutionObjectActionV1(input.action)
  ) {
    return null;
  }
  return Object.freeze({
    objectType: input.objectType,
    objectId: input.objectId,
    action: input.action,
  });
}

function mintFact(
  value: Omit<AuthoritativeInstitutionObjectFactV1, 'kind'>,
): AuthoritativeInstitutionObjectFactV1 {
  const fact = Object.freeze({
    kind: 'current_object_fact' as const,
    ...value,
  });
  factHandles.add(fact);
  return fact;
}

function parseResolution(
  value: unknown,
): AuthoritativeInstitutionObjectFactResolutionV1 {
  const rejection = snapshot(value, REJECTION_KEYS);
  if (rejection?.kind === 'rejected') {
    const code = rejection.code;
    if (
      code === 'object_denied' ||
      code === 'object_invalid' ||
      code === 'object_unavailable'
    ) {
      return Object.freeze({ kind: 'rejected', code });
    }
    return Object.freeze({
      kind: 'rejected',
      code: 'object_invalid',
    });
  }

  const fact = snapshot(value, FACT_KEYS);
  if (
    !fact ||
    fact.kind !== 'current_object_fact' ||
    !isInstitutionObjectTypeV1(fact.objectType) ||
    !isId(fact.objectId) ||
    !isId(fact.tenantId, 64) ||
    !isId(fact.institutionId, 64) ||
    (fact.status !== 'active' && fact.status !== 'inactive') ||
    !Number.isSafeInteger(fact.revision) ||
    Number(fact.revision) <= 0 ||
    !instant(fact.observedAt)
  ) {
    return Object.freeze({
      kind: 'rejected',
      code: 'object_invalid',
    });
  }

  return mintFact({
    objectType: fact.objectType,
    objectId: fact.objectId,
    tenantId: fact.tenantId,
    institutionId: fact.institutionId,
    status: fact.status,
    revision: Number(fact.revision),
    observedAt: fact.observedAt as string,
  });
}

function makeReader(resolver: Resolver | null): InstitutionObjectFactReaderV1 {
  const reader = Object.freeze({
    async resolve(
      value: AuthoritativeInstitutionObjectFactQueryV1,
    ): Promise<AuthoritativeInstitutionObjectFactResolutionV1> {
      const query = parseQuery(value);
      if (!query) {
        return Object.freeze({
          kind: 'rejected',
          code: 'object_invalid',
        });
      }
      if (!resolver) {
        return Object.freeze({
          kind: 'rejected',
          code: 'object_unavailable',
        });
      }
      try {
        return parseResolution(await resolver(query));
      } catch {
        return Object.freeze({
          kind: 'rejected',
          code: 'object_unavailable',
        });
      }
    },
  });
  readerHandles.add(reader);
  return reader;
}

export function createInstitutionObjectFactReaderV1(input: Readonly<{
  resolve: Resolver;
}>): InstitutionObjectFactReaderV1 {
  const record = snapshot(input, READER_FACTORY_KEYS);
  return makeReader(
    record && isFunction(record.resolve)
      ? (record.resolve as Resolver)
      : null,
  );
}

export function isInstitutionObjectFactReaderV1(
  value: unknown,
): value is InstitutionObjectFactReaderV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      readerHandles.has(value)
    );
  } catch {
    return false;
  }
}

export function isAuthoritativeInstitutionObjectFactV1(
  value: unknown,
): value is AuthoritativeInstitutionObjectFactV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      factHandles.has(value)
    );
  } catch {
    return false;
  }
}

function mintAllow(input: Readonly<{
  objectType: InstitutionObjectTypeV1;
  action: InstitutionObjectActionV1;
  objectRevision: number;
  decidedAt: string;
  validUntil: string;
}>): InstitutionObjectActionAllowV1 {
  const allow = Object.freeze({
    kind: 'institution_object_action_allow' as const,
    ...input,
  });
  allowHandles.add(allow);
  return allow as InstitutionObjectActionAllowV1;
}

async function authorize(
  deps: Dependencies,
  value: InstitutionObjectAuthorizationInputV1,
): Promise<InstitutionObjectGuardResolutionV1> {
  const input = parsePublicInput(value);
  if (!input) return rejected('action_unregistered');
  if (deps.failure) return rejected(deps.failure);
  if (!deps.authorizeScope || !deps.resolveObject || !deps.authorizePolicy) {
    return rejected('object_unavailable');
  }

  const now = readNow(deps.now);
  if (!now) return rejected('scope_unavailable');

  let rawScope: unknown;
  try {
    rawScope = await deps.authorizeScope();
  } catch {
    return rejected('scope_unavailable');
  }
  if (!isInstitutionScopeAllowV1(rawScope)) {
    return rejected('scope_unavailable');
  }

  const scopeDecidedAt = instant(rawScope.decidedAt);
  const scopeValidUntil = instant(rawScope.validUntil);
  if (
    !scopeDecidedAt ||
    !scopeValidUntil ||
    now.epochMs < scopeDecidedAt.epochMs ||
    now.epochMs >= scopeValidUntil.epochMs
  ) {
    return rejected('scope_unavailable');
  }

  let fact: AuthoritativeInstitutionObjectFactResolutionV1;
  try {
    fact = await deps.resolveObject({
      objectType: input.objectType,
      objectId: input.objectId,
      tenantId: rawScope.tenantId,
      institutionId: rawScope.institutionId,
    });
  } catch {
    return rejected('object_unavailable');
  }

  if (fact.kind === 'rejected') return rejected(fact.code);
  if (!isAuthoritativeInstitutionObjectFactV1(fact)) {
    return rejected('object_invalid');
  }
  if (
    fact.objectType !== input.objectType ||
    fact.objectId !== input.objectId ||
    fact.tenantId !== rawScope.tenantId ||
    fact.institutionId !== rawScope.institutionId
  ) {
    return rejected('object_invalid');
  }
  if (fact.status !== 'active') return rejected('object_denied');

  const observedAt = instant(fact.observedAt);
  if (!observedAt || observedAt.epochMs > now.epochMs) {
    return rejected('object_invalid');
  }
  const objectValidUntil = observedAt.epochMs + OBJECT_FACT_FRESHNESS_MS;
  if (now.epochMs >= objectValidUntil) return rejected('object_stale');

  let policy;
  try {
    policy = deps.authorizePolicy({
      objectType: input.objectType,
      action: input.action,
      role: rawScope.role,
    });
  } catch {
    return rejected('policy_unavailable');
  }
  if (!isInstitutionActionPolicyAllowV1(policy)) {
    return policy.kind === 'rejected'
      ? rejected(policy.code)
      : rejected('policy_unavailable');
  }

  const validUntil = Math.min(
    scopeValidUntil.epochMs,
    objectValidUntil,
  );
  if (validUntil <= now.epochMs) return rejected('object_stale');

  return mintAllow({
    objectType: input.objectType,
    action: input.action,
    objectRevision: fact.revision,
    decidedAt: now.raw,
    validUntil: new Date(validUntil).toISOString(),
  });
}

function makeGuard(deps: Dependencies): InstitutionObjectGuardV1 {
  const guard = Object.freeze({
    authorizeCurrentObjectAction(
      input: InstitutionObjectAuthorizationInputV1,
    ): Promise<InstitutionObjectGuardResolutionV1> {
      return authorize(deps, input);
    },
  });
  guardHandles.add(guard);
  return guard as InstitutionObjectGuardV1;
}

export function createInstitutionObjectGuardV1(input: Readonly<{
  scopeGuard: InstitutionScopeGuardV1;
  objectFactReader: InstitutionObjectFactReaderV1 | null;
  actionPolicy: InstitutionActionPolicyV1;
  now: () => Date;
}>): InstitutionObjectGuardV1 {
  const record = snapshot(input, GUARD_FACTORY_KEYS);
  if (!record) {
    return makeGuard(
      Object.freeze({
        failure: 'scope_unavailable',
        authorizeScope: null,
        resolveObject: null,
        authorizePolicy: null,
        now: null,
      }),
    );
  }

  const scopeRecord = isInstitutionScopeGuardV1(record.scopeGuard)
    ? snapshot(record.scopeGuard, SCOPE_GUARD_KEYS)
    : null;
  const readerRecord = isInstitutionObjectFactReaderV1(
    record.objectFactReader,
  )
    ? snapshot(record.objectFactReader, READER_KEYS)
    : null;
  const policyRecord = isInstitutionActionPolicyV1(record.actionPolicy)
    ? snapshot(record.actionPolicy, POLICY_KEYS)
    : null;

  const authorizeScope = scopeRecord?.authorizeCurrentRequest;
  const resolveObject = readerRecord?.resolve;
  const authorizePolicy = policyRecord?.authorize;

  const failure =
    !isFunction(authorizeScope) || !isFunction(record.now)
      ? 'scope_unavailable'
      : !isFunction(authorizePolicy)
        ? 'policy_unavailable'
        : !isFunction(resolveObject)
          ? 'object_unavailable'
          : null;

  return makeGuard(
    Object.freeze({
      failure,
      authorizeScope: isFunction(authorizeScope)
        ? (authorizeScope as InstitutionScopeGuardV1['authorizeCurrentRequest'])
        : null,
      resolveObject: isFunction(resolveObject)
        ? (resolveObject as InstitutionObjectFactReaderV1['resolve'])
        : null,
      authorizePolicy: isFunction(authorizePolicy)
        ? (authorizePolicy as InstitutionActionPolicyV1['authorize'])
        : null,
      now: isFunction(record.now) ? (record.now as () => Date) : null,
    }),
  );
}

export function isInstitutionObjectGuardV1(
  value: unknown,
): value is InstitutionObjectGuardV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      guardHandles.has(value)
    );
  } catch {
    return false;
  }
}

export function isInstitutionObjectActionAllowV1(
  value: unknown,
): value is InstitutionObjectActionAllowV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      allowHandles.has(value)
    );
  } catch {
    return false;
  }
}
