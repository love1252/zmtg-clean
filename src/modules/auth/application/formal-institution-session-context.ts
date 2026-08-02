import { isProxy } from 'node:util/types';

import { isAuthoritativeMembershipFactReaderV1 } from '@/modules/access-control/application/authoritative-membership-reader';
import type {
  AuthoritativeMembershipFactReaderV1,
  AuthoritativeMembershipFactV1,
} from '@/modules/access-control/ports/authoritative-membership-reader';
import { isAuthoritativeFormalSessionIdentityFactReaderV1 } from '@/modules/auth/application/authoritative-formal-session-identity-reader';
import type { AuthRole, AuthSessionUser } from '@/modules/auth/domain/session';
import type {
  AuthoritativeFormalSessionIdentityFactReaderV1,
  AuthoritativeFormalSessionIdentityFactV1,
} from '@/modules/auth/ports/authoritative-formal-session-identity-reader';
import { isInstitutionRoleV1 } from '@/modules/institution-contracts/v1/institution-navigation';
import { isInstitutionScopeIdV1 } from '@/modules/security/domain/institution-access';
import { isAuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/application/authoritative-institution-scope-reader';
import type { AuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/ports/authoritative-institution-scope-reader';

declare const formalServerSessionUserSnapshotMarkerV1: unique symbol;

export type FormalServerSessionUserSnapshotV1 = Readonly<{
  readonly [formalServerSessionUserSnapshotMarkerV1]: 'formal_server_session_user_snapshot_v1';
}>;

export type FormalMembershipAuditSnapshotV1 = Readonly<{
  id: string;
  tenantId: string;
  role: AuthRole;
}>;

export type FormalInstitutionSessionContextResolutionV1 =
  | Readonly<{
      kind: 'resolved';
      snapshot: FormalServerSessionUserSnapshotV1;
      membershipAudit: FormalMembershipAuditSnapshotV1;
    }>
  | Readonly<{ kind: 'denied' }>
  | Readonly<{ kind: 'invalid' }>
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{ kind: 'stale' }>;

export type FormalInstitutionSessionContextResolverV1 = Readonly<{
  resolveForLogin: (input: Readonly<{
    accountId: string;
  }>) => Promise<FormalInstitutionSessionContextResolutionV1>;
  resolveForSession: (input: Readonly<{
    accountId: string;
    tenantId: string;
    institutionId: string;
  }>) => Promise<FormalInstitutionSessionContextResolutionV1>;
}>;

const FACTORY_KEYS = Object.freeze([
  'identityReader',
  'membershipReader',
  'scopeReader',
] as const);
const IDENTITY_READER_KEYS = Object.freeze(['resolve'] as const);
const MEMBERSHIP_READER_KEYS = Object.freeze([
  'resolve',
  'resolveSingleForAccount',
] as const);
const SCOPE_READER_KEYS = Object.freeze(['resolve'] as const);
const LOGIN_QUERY_KEYS = Object.freeze(['accountId'] as const);
const SESSION_QUERY_KEYS = Object.freeze([
  'accountId',
  'tenantId',
  'institutionId',
] as const);
const IDENTITY_KEYS = Object.freeze([
  'kind',
  'accountId',
  'username',
  'displayName',
  'status',
  'observedAt',
] as const);
const MEMBERSHIP_FACT_KEYS = Object.freeze([
  'kind',
  'accountId',
  'tenantId',
  'institutionId',
  'role',
  'membershipDisplayName',
  'membershipId',
  'membershipRevision',
  'membershipLifecycleStatus',
  'bindingId',
  'bindingRevision',
  'bindingRevisionAt',
  'bindingExpiresAt',
  'observedAt',
] as const);
const REJECTION_KEYS = Object.freeze(['kind', 'code'] as const);
const SCOPE_FACT_KEYS = Object.freeze([
  'kind',
  'tenantId',
  'institutionId',
  'status',
  'revision',
  'observedAt',
] as const);
const CANONICAL_UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

const resolverHandles = new WeakSet<object>();
const snapshotHandles = new WeakSet<object>();
const snapshotValues = new WeakMap<object, Readonly<AuthSessionUser>>();

const denied = Object.freeze({ kind: 'denied' } as const);
const invalid = Object.freeze({ kind: 'invalid' } as const);
const unavailable = Object.freeze({ kind: 'unavailable' } as const);
const stale = Object.freeze({ kind: 'stale' } as const);

function snapshotExactPlainRecord(
  value: unknown,
  expectedKeys: readonly string[],
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
    const ownKeys = Reflect.ownKeys(descriptors);
    if (
      ownKeys.length !== expectedKeys.length ||
      ownKeys.some((key) => typeof key !== 'string') ||
      expectedKeys.some((key) => !Object.hasOwn(descriptors, key))
    ) {
      return null;
    }
    const snapshot: Record<string, unknown> = Object.create(null) as Record<
      string,
      unknown
    >;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return null;
      }
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

function isNonProxyFunction(value: unknown): value is (...args: never[]) => unknown {
  try {
    return typeof value === 'function' && !isProxy(value);
  } catch {
    return false;
  }
}

function isCanonicalInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !CANONICAL_UTC_INSTANT.test(value)) {
    return false;
  }
  const epochMs = Date.parse(value);
  return Number.isFinite(epochMs) && new Date(epochMs).toISOString() === value;
}

function parseLoginQuery(value: unknown): Readonly<{ accountId: string }> | null {
  const query = snapshotExactPlainRecord(value, LOGIN_QUERY_KEYS);
  if (!query || !isInstitutionScopeIdV1(query.accountId)) return null;
  return Object.freeze({ accountId: query.accountId });
}

function parseSessionQuery(value: unknown): Readonly<{
  accountId: string;
  tenantId: string;
  institutionId: string;
}> | null {
  const query = snapshotExactPlainRecord(value, SESSION_QUERY_KEYS);
  if (
    !query ||
    !isInstitutionScopeIdV1(query.accountId) ||
    !isInstitutionScopeIdV1(query.tenantId) ||
    !isInstitutionScopeIdV1(query.institutionId)
  ) {
    return null;
  }
  return Object.freeze({
    accountId: query.accountId,
    tenantId: query.tenantId,
    institutionId: query.institutionId,
  });
}

function parseIdentity(
  value: unknown,
  accountId: string,
):
  | AuthoritativeFormalSessionIdentityFactV1
  | null
  | 'denied'
  | 'unavailable' {
  const rejection = snapshotExactPlainRecord(value, REJECTION_KEYS);
  if (rejection?.kind === 'rejected') {
    if (rejection.code === 'identity_denied') return 'denied';
    if (rejection.code === 'identity_unavailable') return 'unavailable';
    return null;
  }
  const account = snapshotExactPlainRecord(value, IDENTITY_KEYS);
  if (
    !account ||
    account.kind !== 'current_identity_fact' ||
    account.accountId !== accountId ||
    !isInstitutionScopeIdV1(account.accountId) ||
    typeof account.username !== 'string' ||
    account.username.length === 0 ||
    typeof account.displayName !== 'string' ||
    account.status !== 'active' ||
    !isCanonicalInstant(account.observedAt)
  ) {
    return null;
  }
  return Object.freeze({
    kind: 'current_identity_fact',
    accountId: account.accountId,
    username: account.username,
    displayName: account.displayName,
    status: 'active',
    observedAt: account.observedAt,
  });
}

function sameIdentityFact(
  first: AuthoritativeFormalSessionIdentityFactV1,
  second: AuthoritativeFormalSessionIdentityFactV1,
): boolean {
  return (
    first.accountId === second.accountId &&
    first.username === second.username &&
    first.displayName === second.displayName &&
    first.status === second.status
  );
}

function parseMembershipFact(
  value: unknown,
): AuthoritativeMembershipFactV1 | null | 'denied' | 'unavailable' {
  const rejection = snapshotExactPlainRecord(value, REJECTION_KEYS);
  if (rejection?.kind === 'rejected') {
    if (rejection.code === 'membership_denied') return 'denied';
    if (rejection.code === 'membership_unavailable') return 'unavailable';
    return null;
  }
  const fact = snapshotExactPlainRecord(value, MEMBERSHIP_FACT_KEYS);
  if (
    !fact ||
    fact.kind !== 'current_membership_fact' ||
    !isInstitutionScopeIdV1(fact.accountId) ||
    !isInstitutionScopeIdV1(fact.tenantId) ||
    !isInstitutionScopeIdV1(fact.institutionId) ||
    !isInstitutionRoleV1(fact.role) ||
    typeof fact.membershipDisplayName !== 'string' ||
    !isInstitutionScopeIdV1(fact.membershipId) ||
    !Number.isSafeInteger(fact.membershipRevision) ||
    Number(fact.membershipRevision) <= 0 ||
    fact.membershipLifecycleStatus !== 'active' ||
    !isInstitutionScopeIdV1(fact.bindingId) ||
    !Number.isSafeInteger(fact.bindingRevision) ||
    Number(fact.bindingRevision) <= 0 ||
    !isCanonicalInstant(fact.bindingRevisionAt) ||
    (fact.bindingExpiresAt !== null &&
      !isCanonicalInstant(fact.bindingExpiresAt)) ||
    !isCanonicalInstant(fact.observedAt)
  ) {
    return null;
  }
  return Object.freeze({
    kind: 'current_membership_fact',
    accountId: fact.accountId,
    tenantId: fact.tenantId,
    institutionId: fact.institutionId,
    role: fact.role,
    membershipDisplayName: fact.membershipDisplayName,
    membershipId: fact.membershipId,
    membershipRevision: Number(fact.membershipRevision),
    membershipLifecycleStatus: 'active',
    bindingId: fact.bindingId,
    bindingRevision: Number(fact.bindingRevision),
    bindingRevisionAt: fact.bindingRevisionAt,
    bindingExpiresAt: fact.bindingExpiresAt,
    observedAt: fact.observedAt,
  });
}

function sameAuthorizationFact(
  first: AuthoritativeMembershipFactV1,
  second: AuthoritativeMembershipFactV1,
): boolean {
  return (
    first.accountId === second.accountId &&
    first.tenantId === second.tenantId &&
    first.institutionId === second.institutionId &&
    first.role === second.role &&
    first.membershipDisplayName === second.membershipDisplayName &&
    first.membershipId === second.membershipId &&
    first.membershipRevision === second.membershipRevision &&
    first.membershipLifecycleStatus === second.membershipLifecycleStatus &&
    first.bindingId === second.bindingId &&
    first.bindingRevision === second.bindingRevision &&
    first.bindingRevisionAt === second.bindingRevisionAt &&
    first.bindingExpiresAt === second.bindingExpiresAt
  );
}

function parseScopeFact(
  value: unknown,
  expected: Readonly<{ tenantId: string; institutionId: string }>,
):
  | Readonly<{ tenantId: string; institutionId: string; revision: number }>
  | 'denied'
  | 'invalid'
  | 'unavailable' {
  const rejection = snapshotExactPlainRecord(value, REJECTION_KEYS);
  if (rejection?.kind === 'rejected') {
    if (rejection.code === 'scope_denied') return 'denied';
    if (rejection.code === 'scope_unavailable') return 'unavailable';
    return 'invalid';
  }
  const fact = snapshotExactPlainRecord(value, SCOPE_FACT_KEYS);
  if (
    !fact ||
    fact.kind !== 'current_scope_fact' ||
    fact.status !== 'active' ||
    fact.tenantId !== expected.tenantId ||
    fact.institutionId !== expected.institutionId ||
    !Number.isSafeInteger(fact.revision) ||
    Number(fact.revision) <= 0 ||
    !isCanonicalInstant(fact.observedAt)
  ) {
    return 'invalid';
  }
  return Object.freeze({
    tenantId: fact.tenantId,
    institutionId: fact.institutionId,
    revision: Number(fact.revision),
  });
}

function sameScopeFact(
  first: Readonly<{ tenantId: string; institutionId: string; revision: number }>,
  second: Readonly<{ tenantId: string; institutionId: string; revision: number }>,
): boolean {
  return (
    first.tenantId === second.tenantId &&
    first.institutionId === second.institutionId &&
    first.revision === second.revision
  );
}

function mintSnapshot(value: Readonly<AuthSessionUser>): FormalServerSessionUserSnapshotV1 {
  const handle = Object.freeze({}) as FormalServerSessionUserSnapshotV1;
  snapshotHandles.add(handle);
  snapshotValues.set(handle, value);
  return handle;
}

export function isFormalServerSessionUserSnapshotV1(
  value: unknown,
): value is FormalServerSessionUserSnapshotV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      snapshotHandles.has(value)
    );
  } catch {
    return false;
  }
}

export function consumeFormalServerSessionUserSnapshotV1(
  value: unknown,
): Readonly<AuthSessionUser> | null {
  if (!isFormalServerSessionUserSnapshotV1(value)) return null;
  const sessionUser = snapshotValues.get(value);
  if (!sessionUser) return null;
  snapshotValues.delete(value);
  snapshotHandles.delete(value);
  return sessionUser;
}

export function isFormalInstitutionSessionContextResolverV1(
  value: unknown,
): value is FormalInstitutionSessionContextResolverV1 {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      !isProxy(value) &&
      resolverHandles.has(value)
    );
  } catch {
    return false;
  }
}

export function createFormalInstitutionSessionContextResolverV1(input: Readonly<{
  identityReader: AuthoritativeFormalSessionIdentityFactReaderV1;
  membershipReader: AuthoritativeMembershipFactReaderV1;
  scopeReader: AuthoritativeInstitutionScopeFactReaderV1;
}>): FormalInstitutionSessionContextResolverV1 {
  const factory = snapshotExactPlainRecord(input, FACTORY_KEYS);
  const identityReader =
    factory &&
    isAuthoritativeFormalSessionIdentityFactReaderV1(factory.identityReader)
      ? snapshotExactPlainRecord(factory.identityReader, IDENTITY_READER_KEYS)
    : null;
  const membershipReader =
    factory && isAuthoritativeMembershipFactReaderV1(factory.membershipReader)
      ? snapshotExactPlainRecord(
          factory.membershipReader,
          MEMBERSHIP_READER_KEYS,
        )
      : null;
  const scopeReader =
    factory && isAuthoritativeInstitutionScopeFactReaderV1(factory.scopeReader)
      ? snapshotExactPlainRecord(factory.scopeReader, SCOPE_READER_KEYS)
      : null;
  const resolveIdentity =
    identityReader && isNonProxyFunction(identityReader.resolve)
      ? (identityReader.resolve as AuthoritativeFormalSessionIdentityFactReaderV1['resolve'])
      : null;
  const resolveMembership =
    membershipReader && isNonProxyFunction(membershipReader.resolve)
      ? (membershipReader.resolve as AuthoritativeMembershipFactReaderV1['resolve'])
      : null;
  const resolveSingleMembership =
    membershipReader &&
    isNonProxyFunction(membershipReader.resolveSingleForAccount)
      ? (membershipReader.resolveSingleForAccount as AuthoritativeMembershipFactReaderV1['resolveSingleForAccount'])
      : null;
  const resolveScope =
    scopeReader && isNonProxyFunction(scopeReader.resolve)
      ? (scopeReader.resolve as AuthoritativeInstitutionScopeFactReaderV1['resolve'])
      : null;
  async function resolveContext(
    query: Readonly<{
      accountId: string;
      tenantId?: string;
      institutionId?: string;
    }>,
  ): Promise<FormalInstitutionSessionContextResolutionV1> {
    if (
      !resolveIdentity ||
      !resolveMembership ||
      !resolveSingleMembership ||
      !resolveScope
    ) {
      return unavailable;
    }
    let identityValue: unknown;
    try {
      identityValue = await resolveIdentity({ accountId: query.accountId });
    } catch {
      return unavailable;
    }
    const identity = parseIdentity(identityValue, query.accountId);
    if (identity === 'denied') return denied;
    if (identity === 'unavailable') return unavailable;
    if (!identity) return invalid;

    let firstValue: unknown;
    try {
      firstValue = query.tenantId && query.institutionId
        ? await resolveMembership({
            accountId: query.accountId,
            tenantId: query.tenantId,
            institutionId: query.institutionId,
          })
        : await resolveSingleMembership({ accountId: query.accountId });
    } catch {
      return unavailable;
    }
    const first = parseMembershipFact(firstValue);
    if (first === 'denied') return denied;
    if (first === 'unavailable') return unavailable;
    if (!first) return invalid;
    if (
      query.tenantId &&
      (first.tenantId !== query.tenantId ||
        first.institutionId !== query.institutionId)
    ) {
      return invalid;
    }

    let scopeValue: unknown;
    try {
      scopeValue = await resolveScope({
        tenantId: first.tenantId,
        institutionId: first.institutionId,
      });
    } catch {
      return unavailable;
    }
    const scope = parseScopeFact(scopeValue, first);
    if (scope === 'denied') return denied;
    if (scope === 'unavailable') return unavailable;
    if (scope === 'invalid') return invalid;

    let secondValue: unknown;
    try {
      secondValue = await resolveMembership({
        accountId: first.accountId,
        tenantId: first.tenantId,
        institutionId: first.institutionId,
      });
    } catch {
      return unavailable;
    }
    const second = parseMembershipFact(secondValue);
    if (second === 'denied') return denied;
    if (second === 'unavailable') return unavailable;
    if (!second) return invalid;
    if (!sameAuthorizationFact(first, second)) return stale;

    let secondScopeValue: unknown;
    try {
      secondScopeValue = await resolveScope({
        tenantId: second.tenantId,
        institutionId: second.institutionId,
      });
    } catch {
      return unavailable;
    }
    const secondScope = parseScopeFact(secondScopeValue, second);
    if (secondScope === 'denied') return denied;
    if (secondScope === 'unavailable') return unavailable;
    if (secondScope === 'invalid') return invalid;
    if (!sameScopeFact(scope, secondScope)) return stale;

    let secondIdentityValue: unknown;
    try {
      secondIdentityValue = await resolveIdentity({
        accountId: query.accountId,
      });
    } catch {
      return unavailable;
    }
    const secondIdentity = parseIdentity(secondIdentityValue, query.accountId);
    if (secondIdentity === 'denied') return denied;
    if (secondIdentity === 'unavailable') return unavailable;
    if (!secondIdentity) return invalid;
    if (!sameIdentityFact(identity, secondIdentity)) return stale;

    const sessionUser = Object.freeze({
      id: secondIdentity.accountId,
      username: secondIdentity.username,
      name: second.membershipDisplayName || secondIdentity.displayName,
      role: second.role,
      tenantId: second.tenantId,
      institutionId: second.institutionId,
    }) satisfies Readonly<AuthSessionUser>;
    return Object.freeze({
      kind: 'resolved',
      snapshot: mintSnapshot(sessionUser),
      membershipAudit: Object.freeze({
        id: second.membershipId,
        tenantId: second.tenantId,
        role: second.role,
      }),
    });
  }

  const resolver = Object.freeze({
    async resolveForLogin(value: unknown) {
      const query = parseLoginQuery(value);
      return query ? resolveContext(query) : invalid;
    },
    async resolveForSession(value: unknown) {
      const query = parseSessionQuery(value);
      return query ? resolveContext(query) : invalid;
    },
  }) as FormalInstitutionSessionContextResolverV1;
  resolverHandles.add(resolver);
  return resolver;
}
