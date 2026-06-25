import { NextResponse } from 'next/server';
import type { AuthSessionUser } from '@/modules/auth/domain/session';
import { normalizeAuthUsername } from '@/modules/auth/domain/auth-account';
import { createAuthAccountRepository } from '@/modules/auth/server/auth-account-repository';
import { createAuthAccountService } from '@/modules/auth/server/auth-account-service';
import {
  authenticateDemoUser,
  createDemoSession,
  DEMO_SESSION_COOKIE,
  encodeDemoSession,
  isMissingDemoSessionSecretError,
  isDemoAuthEnabled,
  sessionMaxAgeSeconds,
} from '@/modules/auth/server/demo-session';
import { getDatabase } from '@/server/db/client';

type LoginPayload = {
  username?: unknown;
  password?: unknown;
  scope?: unknown;
};

type FormalLoginResult =
  | { status: 'authenticated'; user: AuthSessionUser; passwordResetRequired: boolean }
  | { status: 'rejected' }
  | { status: 'not_found_or_unavailable' };

function createLoginResponse(input: {
  user: AuthSessionUser;
  passwordResetRequired?: boolean;
}) {
  const session = createDemoSession(input.user);
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
    const repository = createAuthAccountRepository(getDatabase());
    const account = await repository.findAccountByUsername(normalizeAuthUsername(input.username));
    if (!account) {
      return { status: 'not_found_or_unavailable' };
    }

    const service = createAuthAccountService({ repository });
    const result = await service.authenticatePasswordAccount({
      username: input.username,
      plaintextPassword: input.password,
      scope: 'institution',
    });

    if (result.status !== 'authenticated') {
      return { status: 'rejected' };
    }

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

  return createLoginResponse({ user });
}
