import { isProxy } from 'node:util/types';

import { NextResponse } from 'next/server';

import { createAccessControlAuthoritativeMembershipFactReaderV1 } from '@/modules/access-control/application/authoritative-membership-reader';
import {
  consumeFormalServerSessionUserSnapshotV1,
  createFormalInstitutionSessionContextResolverV1,
} from '@/modules/auth/application/formal-institution-session-context';
import { createIdentityAuthoritativeFormalSessionIdentityFactReaderV1 } from '@/modules/auth/application/authoritative-formal-session-identity-reader';
import { isAuthRole, type AuthSessionUser } from '@/modules/auth/domain/session';
import {
  consumeFormalServerSessionVerifiedClaimsV1,
  FORMAL_SERVER_SESSION_COOKIE_V1,
  verifyFormalServerSessionCookieClaimsV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import {
  decodeDemoSession,
  DEMO_SESSION_COOKIE,
  isDemoAuthEnabled,
} from '@/modules/auth/server/demo-session';
import { resolveInstitutionGuardRuntimeConfigV1 } from '@/modules/security/server/institution-guard-runtime-config';
import { createTenancyAuthoritativeInstitutionScopeFactReaderV1 } from '@/modules/tenancy/application/authoritative-institution-scope-reader';

const SESSION_USER_KEYS = Object.freeze([
  'id',
  'username',
  'name',
  'role',
  'tenantId',
  'institutionId',
] as const);
const RUNTIME_CONFIG_KEYS = Object.freeze([
  'kind',
  'formalServerSessionKeyRing',
  'institutionGuardReferenceKeyRing',
] as const);
const MAX_COOKIE_HEADER_LENGTH = 8_192;
const MAX_COOKIE_PARTS = 64;

type CookieClassification =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'formal'; value: string }>
  | Readonly<{ kind: 'demo'; value: string }>
  | Readonly<{ kind: 'invalid'; clear: readonly string[] }>;

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
      expectedKeys.some(
        (key) => !Object.prototype.hasOwnProperty.call(descriptors, key),
      )
    ) {
      return null;
    }
    const snapshot = Object.create(null) as Record<string, unknown>;
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

function snapshotSessionUser(value: unknown): AuthSessionUser | null {
  const user = snapshotExactPlainRecord(value, SESSION_USER_KEYS);
  if (
    !user ||
    typeof user.id !== 'string' ||
    user.id.length === 0 ||
    typeof user.username !== 'string' ||
    typeof user.name !== 'string' ||
    !isAuthRole(user.role) ||
    (typeof user.tenantId !== 'string' && user.tenantId !== null) ||
    (typeof user.institutionId !== 'string' && user.institutionId !== null)
  ) {
    return null;
  }
  return Object.freeze({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    institutionId: user.institutionId,
  });
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function json(value: unknown, status = 200): NextResponse {
  return noStore(NextResponse.json(value, { status }));
}

function clearCookie(response: NextResponse, name: string): void {
  response.cookies.set(name, '', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

function unauthenticated(clear: readonly string[] = []): NextResponse {
  const response = json({ authenticated: false, user: null }, 401);
  for (const name of clear) clearCookie(response, name);
  return response;
}

function unavailable(): NextResponse {
  return json({ authenticated: false, user: null }, 503);
}

function classifyCookieHeader(cookieHeader: string | null): CookieClassification {
  if (cookieHeader === null || cookieHeader.length === 0) {
    return Object.freeze({ kind: 'none' });
  }
  if (cookieHeader.length > MAX_COOKIE_HEADER_LENGTH) {
    return Object.freeze({
      kind: 'invalid',
      clear: Object.freeze([FORMAL_SERVER_SESSION_COOKIE_V1, DEMO_SESSION_COOKIE]),
    });
  }

  let formalCount = 0;
  let demoCount = 0;
  let formalValue = '';
  let demoValue = '';
  let formalInvalid = false;
  let demoInvalid = false;
  let start = 0;
  let parts = 0;
  while (start <= cookieHeader.length) {
    parts += 1;
    if (parts > MAX_COOKIE_PARTS) {
      return Object.freeze({
        kind: 'invalid',
        clear: Object.freeze([FORMAL_SERVER_SESSION_COOKIE_V1, DEMO_SESSION_COOKIE]),
      });
    }
    const end = cookieHeader.indexOf(';', start);
    const raw = cookieHeader.slice(start, end < 0 ? cookieHeader.length : end).trim();
    const separator = raw.indexOf('=');
    const name = (separator < 0 ? raw : raw.slice(0, separator)).trim();
    const value = separator < 0 ? '' : raw.slice(separator + 1);
    if (name === FORMAL_SERVER_SESSION_COOKIE_V1) {
      formalCount += 1;
      formalValue = value;
      if (separator < 0 || value.length === 0) formalInvalid = true;
    }
    if (name === DEMO_SESSION_COOKIE) {
      demoCount += 1;
      demoValue = value;
      if (separator < 0 || value.length === 0) demoInvalid = true;
    }
    if (end < 0) break;
    start = end + 1;
  }

  if (formalCount > 0 && demoCount > 0) {
    return Object.freeze({
      kind: 'invalid',
      clear: Object.freeze([FORMAL_SERVER_SESSION_COOKIE_V1, DEMO_SESSION_COOKIE]),
    });
  }
  if (formalCount > 0) {
    if (formalCount !== 1 || formalInvalid) {
      return Object.freeze({
        kind: 'invalid',
        clear: Object.freeze([FORMAL_SERVER_SESSION_COOKIE_V1]),
      });
    }
    return Object.freeze({ kind: 'formal', value: formalValue });
  }
  if (demoCount > 0) {
    if (demoCount !== 1 || demoInvalid) {
      return Object.freeze({
        kind: 'invalid',
        clear: Object.freeze([DEMO_SESSION_COOKIE]),
      });
    }
    return Object.freeze({ kind: 'demo', value: demoValue });
  }
  return Object.freeze({ kind: 'none' });
}

function snapshotAvailableRuntimeConfig(value: unknown): Readonly<{
  formalServerSessionKeyRing: unknown;
}> | null {
  const config = snapshotExactPlainRecord(value, RUNTIME_CONFIG_KEYS);
  if (!config || config.kind !== 'available') return null;
  return Object.freeze({ formalServerSessionKeyRing: config.formalServerSessionKeyRing });
}

function snapshotVerifiedClaims(value: unknown): Readonly<{ verifiedClaims: unknown }> | null {
  const verified = snapshotExactPlainRecord(value, ['kind', 'verifiedClaims']);
  if (!verified || verified.kind !== 'verified') return null;
  return Object.freeze({ verifiedClaims: verified.verifiedClaims });
}

function snapshotClaims(value: unknown): Readonly<{
  accountId: string;
  tenantId: string;
  institutionId: string;
}> | null {
  const claims = snapshotExactPlainRecord(value, ['accountId', 'tenantId', 'institutionId']);
  if (
    !claims ||
    typeof claims.accountId !== 'string' ||
    typeof claims.tenantId !== 'string' ||
    typeof claims.institutionId !== 'string'
  ) {
    return null;
  }
  return Object.freeze({
    accountId: claims.accountId,
    tenantId: claims.tenantId,
    institutionId: claims.institutionId,
  });
}

function snapshotFormalSessionLookup(
  value: unknown,
): Readonly<{ kind: 'denied' | 'invalid' | 'unavailable' | 'stale' }> | Readonly<{
  kind: 'resolved';
  snapshot: unknown;
}> | null {
  const basic = snapshotExactPlainRecord(value, ['kind']);
  if (
    basic &&
    (basic.kind === 'denied' ||
      basic.kind === 'invalid' ||
      basic.kind === 'unavailable' ||
      basic.kind === 'stale')
  ) {
    return Object.freeze({ kind: basic.kind });
  }
  const resolved = snapshotExactPlainRecord(value, [
    'kind',
    'snapshot',
    'membershipAudit',
  ]);
  if (!resolved || resolved.kind !== 'resolved') return null;
  return Object.freeze({ kind: 'resolved', snapshot: resolved.snapshot });
}

function snapshotDemoSession(value: unknown): AuthSessionUser | null {
  const session = snapshotExactPlainRecord(value, [
    'user',
    'expiresAt',
    'source',
  ]);
  const expiresAt = session?.expiresAt;

  if (
    !session ||
    session.source !== 'demo_session' ||
    typeof expiresAt !== 'number' ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    return null;
  }

  return snapshotSessionUser(session.user);
}

export async function GET(request: Request) {
  let rawCookieHeader: unknown;
  try {
    rawCookieHeader = request.headers.get('cookie');
  } catch {
    return unauthenticated();
  }
  if (
    rawCookieHeader !== null &&
    typeof rawCookieHeader !== 'string'
  ) {
    return unauthenticated();
  }
  const cookieHeader = rawCookieHeader;

  const cookies = classifyCookieHeader(cookieHeader);
  if (cookies.kind === 'invalid') return unauthenticated(cookies.clear);

  if (cookies.kind === 'formal') {
    let runtimeConfig: Readonly<{ formalServerSessionKeyRing: unknown }> | null = null;
    try {
      runtimeConfig = snapshotAvailableRuntimeConfig(
        resolveInstitutionGuardRuntimeConfigV1(),
      );
    } catch {
      return unavailable();
    }
    if (!runtimeConfig) return unavailable();

    let verification: unknown;
    try {
      verification = verifyFormalServerSessionCookieClaimsV1({
        cookieHeader,
        sessionKeyRing: runtimeConfig.formalServerSessionKeyRing as never,
        now: () => new Date(),
      });
    } catch {
      return unavailable();
    }
    const rejected = snapshotExactPlainRecord(verification, ['kind', 'code']);
    if (rejected?.kind === 'rejected' && typeof rejected.code === 'string') {
      return unauthenticated([FORMAL_SERVER_SESSION_COOKIE_V1]);
    }
    if (rejected?.kind === 'unavailable' && typeof rejected.code === 'string') {
      return unavailable();
    }
    const verified = snapshotVerifiedClaims(verification);
    if (!verified) return unavailable();

    let claims: ReturnType<typeof snapshotClaims>;
    try {
      claims = snapshotClaims(
        consumeFormalServerSessionVerifiedClaimsV1(verified.verifiedClaims as never),
      );
    } catch {
      return unavailable();
    }
    if (!claims) return unavailable();

    let contextResolver: ReturnType<
      typeof createFormalInstitutionSessionContextResolverV1
    >;
    try {
      contextResolver = createFormalInstitutionSessionContextResolverV1({
        identityReader:
          createIdentityAuthoritativeFormalSessionIdentityFactReaderV1(),
        membershipReader:
          createAccessControlAuthoritativeMembershipFactReaderV1(),
        scopeReader:
          createTenancyAuthoritativeInstitutionScopeFactReaderV1(),
      });
    } catch {
      return unavailable();
    }

    let snapshot: ReturnType<typeof snapshotFormalSessionLookup>;
    try {
      snapshot = snapshotFormalSessionLookup(
        await contextResolver.resolveForSession(claims),
      );
    } catch {
      return unavailable();
    }
    if (!snapshot) return unavailable();
    if (snapshot.kind === 'denied' || snapshot.kind === 'stale') {
      return unauthenticated([FORMAL_SERVER_SESSION_COOKIE_V1]);
    }
    if (snapshot.kind !== 'resolved') return unavailable();

    let user: AuthSessionUser | null = null;
    try {
      user = snapshotSessionUser(
        consumeFormalServerSessionUserSnapshotV1(snapshot.snapshot as never),
      );
    } catch {
      return unavailable();
    }
    if (!user) return unavailable();
    return json({ authenticated: true, user });
  }

  if (cookies.kind !== 'demo') return unauthenticated();
  let demoEnabled: unknown;
  try {
    demoEnabled = isDemoAuthEnabled();
  } catch {
    return unauthenticated([DEMO_SESSION_COOKIE]);
  }
  if (demoEnabled !== true) return unauthenticated([DEMO_SESSION_COOKIE]);

  let user: AuthSessionUser | null = null;
  try {
    user = snapshotDemoSession(decodeDemoSession(cookies.value));
  } catch {
    return unauthenticated([DEMO_SESSION_COOKIE]);
  }
  if (!user) return unauthenticated([DEMO_SESSION_COOKIE]);
  return json({ authenticated: true, user });
}
