import { randomUUID } from 'node:crypto';
import { isProxy } from 'node:util/types';

import { NextResponse } from 'next/server';

import { createAuditEvent } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type {
  AuthAccountRecord,
  AuthTenantMembershipRecord,
} from '@/modules/auth/domain/auth-account';
import { normalizeAuthUsername } from '@/modules/auth/domain/auth-account';
import { isAuthRole, type AuthSessionUser } from '@/modules/auth/domain/session';
import {
  createAuthAccountRepository,
  type FormalServerSessionUserSnapshotV1,
} from '@/modules/auth/server/auth-account-repository';
import { createAuthAccountService } from '@/modules/auth/server/auth-account-service';
import {
  FORMAL_SERVER_SESSION_COOKIE_V1,
  issueFormalServerSessionCookieV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import {
  authenticateDemoUser,
  createDemoSession,
  DEMO_SESSION_COOKIE,
  encodeDemoSession,
  isDemoAuthEnabled,
  sessionMaxAgeSeconds,
} from '@/modules/auth/server/demo-session';
import { resolveInstitutionGuardRuntimeConfigV1 } from '@/modules/security/server/institution-guard-runtime-config';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

type LoginPayload = Readonly<{
  username: string;
  password: string;
  scope: 'institution' | 'platform';
}>;

type FormalLoginResult =
  | Readonly<{ kind: 'not_found' }>
  | Readonly<{ kind: 'rejected' }>
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{
      kind: 'authenticated';
      database: TenantDatabase;
      account: AuthAccountRecord;
      membership: AuthTenantMembershipRecord | null;
      repository: ReturnType<typeof createAuthAccountRepository>;
      user: AuthSessionUser;
      passwordResetRequired: boolean;
    }>;

type FormalLoginAuditReason = 'tenant_login_succeeded' | 'tenant_login_failed';

const LOGIN_PAYLOAD_KEYS = Object.freeze(['username', 'password', 'scope'] as const);
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
const ISSUED_COOKIE_KEYS = Object.freeze([
  'kind',
  'cookieValue',
  'expiresAt',
  'maxAgeSeconds',
  'sessionUser',
] as const);

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

function snapshotLoginPayload(value: unknown): LoginPayload | null {
  const payload = snapshotExactPlainRecord(value, LOGIN_PAYLOAD_KEYS);
  if (
    !payload ||
    typeof payload.username !== 'string' ||
    typeof payload.password !== 'string' ||
    (payload.scope !== 'institution' && payload.scope !== 'platform')
  ) {
    return null;
  }
  const username = payload.username.trim();
  if (!username || !payload.password) return null;
  return Object.freeze({
    username,
    password: payload.password,
    scope: payload.scope,
  });
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

async function recordFormalLoginAudit(input: {
  database: TenantDatabase;
  account: AuthAccountRecord;
  membership: AuthTenantMembershipRecord | null;
  result: 'allowed' | 'denied';
  reason: FormalLoginAuditReason;
}) {
  if (!input.membership) return;

  try {
    await createAuditEventRepository(input.database).record(
      createAuditEvent({
        eventId: `audit_evt_login_${randomUUID()}`,
        context: {
          userId: input.account.id,
          role: input.membership.role,
          scope: 'tenant',
          tenantId: input.membership.tenantId,
          source: 'server_session',
        },
        resource: 'tenant_member',
        resourceId: input.membership.id,
        action: 'read_own_tenant',
        result: input.result,
        reason: input.reason,
        occurredAt: new Date().toISOString(),
      }),
    );
  } catch {
    // 登录审计是安全观察信号；审计写入失败不应改变认证结果。
  }
}

async function authenticateFormalAccount(input: LoginPayload): Promise<FormalLoginResult> {
  try {
    const database = getDatabase();
    const repository = createAuthAccountRepository(database);
    const account = await repository.findAccountByUsername(
      normalizeAuthUsername(input.username),
    );
    if (account === null) return Object.freeze({ kind: 'not_found' });
    if (!account || typeof account.id !== 'string') {
      return Object.freeze({ kind: 'unavailable' });
    }

    const membership = await repository.findPrimaryTenantMembershipByUserId(account.id);
    const service = createAuthAccountService({ repository });
    const result = await service.authenticatePasswordAccount({
      username: input.username,
      plaintextPassword: input.password,
      scope: 'institution',
    });
    const rejected = snapshotExactPlainRecord(result, ['status', 'reason']);
    if (rejected?.status === 'rejected' && typeof rejected.reason === 'string') {
      await recordFormalLoginAudit({
        database,
        account,
        membership,
        result: 'denied',
        reason: 'tenant_login_failed',
      });
      return Object.freeze({ kind: 'rejected' });
    }

    const authenticated = snapshotExactPlainRecord(result, [
      'status',
      'passwordResetRequired',
      'user',
    ]);
    const user = authenticated ? snapshotSessionUser(authenticated.user) : null;
    if (
      !authenticated ||
      authenticated.status !== 'authenticated' ||
      typeof authenticated.passwordResetRequired !== 'boolean' ||
      !user
    ) {
      return Object.freeze({ kind: 'unavailable' });
    }

    return Object.freeze({
      kind: 'authenticated',
      database,
      account,
      membership,
      repository,
      user,
      passwordResetRequired: authenticated.passwordResetRequired,
    });
  } catch {
    return Object.freeze({ kind: 'unavailable' });
  }
}

function createDemoLoginResponse(user: AuthSessionUser): NextResponse {
  try {
    const encodedSession = encodeDemoSession(createDemoSession(user));
    if (typeof encodedSession !== 'string' || encodedSession.length === 0) {
      return json({ code: 503, message: '登录暂不可用' }, 503);
    }
    const response = json({ code: 0, data: { user } });
    response.cookies.set(DEMO_SESSION_COOKIE, encodedSession, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionMaxAgeSeconds(),
      path: '/',
    });
    clearCookie(response, FORMAL_SERVER_SESSION_COOKIE_V1);
    return response;
  } catch {
    return json({ code: 503, message: '登录暂不可用' }, 503);
  }
}

function snapshotAvailableRuntimeConfig(value: unknown): Readonly<{
  formalServerSessionKeyRing: unknown;
}> | null {
  const config = snapshotExactPlainRecord(value, RUNTIME_CONFIG_KEYS);
  if (!config || config.kind !== 'available') return null;
  return Object.freeze({ formalServerSessionKeyRing: config.formalServerSessionKeyRing });
}

function snapshotFormalSessionLookup(
  value: unknown,
): Readonly<{ kind: 'denied' | 'invalid' | 'unavailable'; snapshot?: never }> | Readonly<{
  kind: 'resolved';
  snapshot: unknown;
}> | null {
  const basic = snapshotExactPlainRecord(value, ['kind']);
  if (
    basic &&
    (basic.kind === 'denied' || basic.kind === 'invalid' || basic.kind === 'unavailable')
  ) {
    return Object.freeze({ kind: basic.kind });
  }
  const resolved = snapshotExactPlainRecord(value, ['kind', 'snapshot']);
  if (!resolved || resolved.kind !== 'resolved') return null;
  return Object.freeze({ kind: 'resolved', snapshot: resolved.snapshot });
}

function snapshotIssuedCookie(value: unknown): Readonly<{
  cookieValue: string;
  maxAgeSeconds: number;
  sessionUser: AuthSessionUser;
}> | null {
  const issued = snapshotExactPlainRecord(value, ISSUED_COOKIE_KEYS);
  const user = issued ? snapshotSessionUser(issued.sessionUser) : null;
  const maxAgeSeconds = issued?.maxAgeSeconds;
  if (
    !issued ||
    issued.kind !== 'issued' ||
    typeof issued.cookieValue !== 'string' ||
    issued.cookieValue.length === 0 ||
    issued.cookieValue.length > 4_096 ||
    typeof issued.expiresAt !== 'string' ||
    typeof maxAgeSeconds !== 'number' ||
    !Number.isSafeInteger(maxAgeSeconds) ||
    maxAgeSeconds <= 0 ||
    !user
  ) {
    return null;
  }
  return Object.freeze({
    cookieValue: issued.cookieValue,
    maxAgeSeconds,
    sessionUser: user,
  });
}

export async function POST(request: Request) {
  let payload: LoginPayload | null = null;
  try {
    payload = snapshotLoginPayload(await request.json());
  } catch {
    return json({ code: 400, message: '请求格式不正确' }, 400);
  }
  if (!payload) return json({ code: 400, message: '请求格式不正确' }, 400);

  if (payload.scope === 'platform') {
    let demoEnabled: unknown;
    try {
      demoEnabled = isDemoAuthEnabled();
    } catch {
      return json({ code: 503, message: '登录暂不可用' }, 503);
    }
    if (demoEnabled !== true) {
      return json({ code: 401, message: '用户名或密码错误' }, 401);
    }

    let demoUser: AuthSessionUser | null = null;
    try {
      demoUser = snapshotSessionUser(
        authenticateDemoUser({
          username: payload.username,
          password: payload.password,
          scope: 'platform',
        }),
      );
    } catch {
      return json({ code: 503, message: '登录暂不可用' }, 503);
    }

    return demoUser
      ? createDemoLoginResponse(demoUser)
      : json({ code: 401, message: '用户名或密码错误' }, 401);
  }

  const formalLogin = await authenticateFormalAccount(payload);
  if (formalLogin.kind === 'not_found') {
    let demoEnabled: unknown;
    try {
      demoEnabled = isDemoAuthEnabled();
    } catch {
      return json({ code: 503, message: '登录暂不可用' }, 503);
    }
    if (demoEnabled !== true) {
      return json({ code: 401, message: '用户名或密码错误' }, 401);
    }
    let demoUser: AuthSessionUser | null = null;
    try {
      demoUser = snapshotSessionUser(
        authenticateDemoUser({
          username: payload.username,
          password: payload.password,
          scope: 'institution',
        }),
      );
    } catch {
      return json({ code: 503, message: '登录暂不可用' }, 503);
    }
    return demoUser
      ? createDemoLoginResponse(demoUser)
      : json({ code: 401, message: '用户名或密码错误' }, 401);
  }
  if (formalLogin.kind === 'unavailable') {
    return json({ code: 503, message: '登录暂不可用' }, 503);
  }
  if (formalLogin.kind === 'rejected') {
    return json({ code: 401, message: '用户名或密码错误' }, 401);
  }
  if (formalLogin.passwordResetRequired) {
    return json(
      { code: 'PASSWORD_RESET_REQUIRED', message: '需要先完成密码重置' },
      403,
    );
  }
  if (
    typeof formalLogin.user.tenantId !== 'string' ||
    typeof formalLogin.user.institutionId !== 'string'
  ) {
    return json({ code: 401, message: '用户名或密码错误' }, 401);
  }

  let runtimeConfig: Readonly<{ formalServerSessionKeyRing: unknown }> | null = null;
  try {
    runtimeConfig = snapshotAvailableRuntimeConfig(
      resolveInstitutionGuardRuntimeConfigV1(),
    );
  } catch {
    return json({ code: 503, message: '登录暂不可用' }, 503);
  }
  if (!runtimeConfig) return json({ code: 503, message: '登录暂不可用' }, 503);

  let snapshot: ReturnType<typeof snapshotFormalSessionLookup>;
  try {
    snapshot = snapshotFormalSessionLookup(
      await formalLogin.repository.findCurrentFormalSessionUser({
        accountId: formalLogin.user.id,
        tenantId: formalLogin.user.tenantId,
        institutionId: formalLogin.user.institutionId,
      }),
    );
  } catch {
    return json({ code: 503, message: '登录暂不可用' }, 503);
  }
  if (!snapshot) return json({ code: 503, message: '登录暂不可用' }, 503);
  if (snapshot.kind === 'denied') {
    return json({ code: 401, message: '用户名或密码错误' }, 401);
  }
  if (snapshot.kind !== 'resolved') {
    return json({ code: 503, message: '登录暂不可用' }, 503);
  }

  let issued: ReturnType<typeof snapshotIssuedCookie>;
  try {
    issued = snapshotIssuedCookie(
      issueFormalServerSessionCookieV1({
        sessionUserSnapshot: snapshot.snapshot as FormalServerSessionUserSnapshotV1,
        sessionKeyRing: runtimeConfig.formalServerSessionKeyRing as never,
        now: () => new Date(),
      }),
    );
  } catch {
    return json({ code: 503, message: '登录暂不可用' }, 503);
  }
  if (!issued) return json({ code: 503, message: '登录暂不可用' }, 503);

  let response: NextResponse;
  try {
    response = json({ code: 0, data: { user: issued.sessionUser } });
    response.cookies.set(FORMAL_SERVER_SESSION_COOKIE_V1, issued.cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: issued.maxAgeSeconds,
      path: '/',
    });
    clearCookie(response, DEMO_SESSION_COOKIE);
  } catch {
    return json({ code: 503, message: '登录暂不可用' }, 503);
  }
  await recordFormalLoginAudit({
    database: formalLogin.database,
    account: formalLogin.account,
    membership: formalLogin.membership,
    result: 'allowed',
    reason: 'tenant_login_succeeded',
  });
  return response;
}
