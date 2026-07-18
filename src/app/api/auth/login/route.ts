import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createAuditEvent } from '@/modules/audit/domain/audit-events';
import { createAuditEventRepository } from '@/modules/audit/server/audit-event-repository';
import type {
  AuthAccountRecord,
  AuthTenantMembershipRecord,
} from '@/modules/auth/domain/auth-account';
import type { AuthSessionSource, AuthSessionUser } from '@/modules/auth/domain/session';
import { normalizeAuthUsername } from '@/modules/auth/domain/auth-account';
import { createAuthAccountRepository } from '@/modules/auth/server/auth-account-repository';
import { createAuthAccountService } from '@/modules/auth/server/auth-account-service';
import {
  authenticateDemoUser,
  createDemoSession,
  createServerSession,
  DEMO_SESSION_COOKIE,
  encodeDemoSession,
  isMissingDemoSessionSecretError,
  isDemoAuthEnabled,
  sessionMaxAgeSeconds,
} from '@/modules/auth/server/demo-session';
import { getDatabase, type TenantDatabase } from '@/server/db/client';

type LoginPayload = {
  username?: unknown;
  password?: unknown;
  scope?: unknown;
};

type FormalLoginResult =
  | { status: 'authenticated'; user: AuthSessionUser; passwordResetRequired: boolean }
  | { status: 'rejected' }
  | { status: 'not_found_or_unavailable' };

type FormalLoginAuditReason = 'tenant_login_succeeded' | 'tenant_login_failed';

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

function createLoginResponse(input: {
  user: AuthSessionUser;
  source: AuthSessionSource;
  passwordResetRequired?: boolean;
}) {
  const session =
    input.source === 'server_session'
      ? createServerSession(input.user)
      : createDemoSession(input.user);
  let encodedSession: string;
  try {
    encodedSession = encodeDemoSession(session);
  } catch (error) {
    if (isMissingDemoSessionSecretError(error)) {
      return NextResponse.json({ code: 503, message: '演示登录未配置' }, { status: 503 });
    }
    throw error;
  }

  const response = NextResponse.json({
    code: 0,
    data: {
      user: input.user,
      ...(input.passwordResetRequired == null
        ? {}
        : { passwordResetRequired: input.passwordResetRequired }),
    },
  });
  response.cookies.set(DEMO_SESSION_COOKIE, encodedSession, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionMaxAgeSeconds(),
    path: '/',
  });

  return response;
}

async function authenticateFormalAccount(input: {
  username: string;
  password: string;
  scope?: string;
}): Promise<FormalLoginResult> {
  const requestedScope = input.scope === 'platform' ? 'platform' : 'institution';
  if (requestedScope !== 'institution') {
    return { status: 'not_found_or_unavailable' };
  }

  try {
    const database = getDatabase();
    const repository = createAuthAccountRepository(database);
    const account = await repository.findAccountByUsername(normalizeAuthUsername(input.username));
    if (!account) {
      return { status: 'not_found_or_unavailable' };
    }
    const membership = await repository.findPrimaryTenantMembershipByUserId(account.id);

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
      return { status: 'rejected' };
    }

    await recordFormalLoginAudit({
      database,
      account,
      membership,
      result: 'allowed',
      reason: 'tenant_login_succeeded',
    });

    return {
      status: 'authenticated',
      user: result.user,
      passwordResetRequired: result.passwordResetRequired,
    };
  } catch {
    return { status: 'not_found_or_unavailable' };
  }
}

export async function POST(request: Request) {
  let payload: LoginPayload;
  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ code: 400, message: '请求格式不正确' }, { status: 400 });
  }

  const username = typeof payload.username === 'string' ? payload.username.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const scope = typeof payload.scope === 'string' ? payload.scope : undefined;

  if (!username || !password) {
    return NextResponse.json({ code: 400, message: '请输入用户名和密码' }, { status: 400 });
  }

  const formalLoginResult = await authenticateFormalAccount({ username, password, scope });
  if (formalLoginResult.status === 'authenticated') {
    return createLoginResponse({
      user: formalLoginResult.user,
      source: 'server_session',
      passwordResetRequired: formalLoginResult.passwordResetRequired,
    });
  }
  if (formalLoginResult.status === 'rejected') {
    return NextResponse.json({ code: 401, message: '用户名或密码错误' }, { status: 401 });
  }

  if (!isDemoAuthEnabled()) {
    return NextResponse.json({ code: 503, message: '演示登录已禁用' }, { status: 503 });
  }

  const user = authenticateDemoUser({ username, password, scope });
  if (!user) {
    return NextResponse.json({ code: 401, message: '用户名或密码错误' }, { status: 401 });
  }

  return createLoginResponse({ user, source: 'demo_session' });
}
