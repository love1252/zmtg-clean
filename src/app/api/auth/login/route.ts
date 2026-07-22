import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { createAuditEvent } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type {
  AuthAccountRecord,
  AuthTenantMembershipRecord,
} from '@/modules/auth/domain/auth-account';
import { normalizeAuthUsername } from '@/modules/auth/domain/auth-account';
import type { AuthSessionUser } from '@/modules/auth/domain/session';
import {
  createAuthAccountRepository,
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
  isMissingDemoSessionSecretError,
  sessionMaxAgeSeconds,
} from '@/modules/auth/server/demo-session';
import { resolveInstitutionGuardRuntimeConfigV1 } from '@/modules/security/server/institution-guard-runtime-config';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

type LoginPayload = {
  username?: unknown;
  password?: unknown;
  scope?: unknown;
};

type FormalLoginResult =
  | Readonly<{ kind: 'not_found' }>
  | Readonly<{ kind: 'rejected' }>
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{
      kind: 'authenticated';
      repository: ReturnType<typeof createAuthAccountRepository>;
      user: AuthSessionUser;
      passwordResetRequired: boolean;
    }>;

type FormalLoginAuditReason = 'tenant_login_succeeded' | 'tenant_login_failed';

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
    secure: process.env.NODE_ENV === 'production',
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

async function authenticateFormalAccount(input: {
  username: string;
  password: string;
}): Promise<FormalLoginResult> {
  try {
    const database = getDatabase();
    const repository = createAuthAccountRepository(database);
    const account = await repository.findAccountByUsername(
      normalizeAuthUsername(input.username),
    );
    if (!account) return Object.freeze({ kind: 'not_found' });

    const membership = await repository.findPrimaryTenantMembershipByUserId(
      account.id,
    );
    const service = createAuthAccountService({ repository });
    const result = await service.authenticatePasswordAccount({
      username: input.username,
      plaintextPassword: input.password,
      scope: 'institution',
    });

    if (result.status !== 'authenticated') {
      await recordFormalLoginAudit({
        database,
        account,
        membership,
        result: 'denied',
        reason: 'tenant_login_failed',
      });
      return Object.freeze({ kind: 'rejected' });
    }

    await recordFormalLoginAudit({
      database,
      account,
      membership,
      result: 'allowed',
      reason: 'tenant_login_succeeded',
    });

    return Object.freeze({
      kind: 'authenticated',
      repository,
      user: result.user,
      passwordResetRequired: result.passwordResetRequired,
    });
  } catch {
    return Object.freeze({ kind: 'unavailable' });
  }
}

function createDemoLoginResponse(user: Parameters<typeof createDemoSession>[0]): NextResponse {
  let encodedSession: string;
  try {
    encodedSession = encodeDemoSession(createDemoSession(user));
  } catch (error) {
    if (isMissingDemoSessionSecretError(error)) {
      return json({ code: 503, message: '演示登录未配置' }, 503);
    }
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
}

export async function POST(request: Request) {
  let payload: LoginPayload;
  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return json({ code: 400, message: '请求格式不正确' }, 400);
  }

  const username = typeof payload.username === 'string' ? payload.username.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  if (!username || !password) {
    return json({ code: 400, message: '请输入用户名和密码' }, 400);
  }
  if (payload.scope !== 'institution') {
    return json({ code: 400, message: '请求范围不正确' }, 400);
  }

  const formalLogin = await authenticateFormalAccount({ username, password });
  if (formalLogin.kind === 'not_found') {
    if (!isDemoAuthEnabled()) {
      return json({ code: 401, message: '用户名或密码错误' }, 401);
    }
    const demoUser = authenticateDemoUser({ username, password, scope: 'institution' });
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

  const runtimeConfig = resolveInstitutionGuardRuntimeConfigV1();
  if (runtimeConfig.kind !== 'available') {
    return json({ code: 503, message: '登录暂不可用' }, 503);
  }

  const snapshot = await formalLogin.repository.findCurrentFormalSessionUser({
    accountId: formalLogin.user.id,
    tenantId: formalLogin.user.tenantId,
    institutionId: formalLogin.user.institutionId,
  });
  if (snapshot.kind === 'denied') {
    return json({ code: 401, message: '用户名或密码错误' }, 401);
  }
  if (snapshot.kind !== 'resolved') {
    return json({ code: 503, message: '登录暂不可用' }, 503);
  }

  const issued = issueFormalServerSessionCookieV1({
    sessionUserSnapshot: snapshot.snapshot,
    sessionKeyRing: runtimeConfig.formalServerSessionKeyRing,
    now: () => new Date(),
  });
  if (issued.kind !== 'issued') {
    return json({ code: 503, message: '登录暂不可用' }, 503);
  }

  const response = json({ code: 0, data: { user: issued.sessionUser } });
  response.cookies.set(FORMAL_SERVER_SESSION_COOKIE_V1, issued.cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: issued.maxAgeSeconds,
    path: '/',
  });
  clearCookie(response, DEMO_SESSION_COOKIE);
  return response;
}
