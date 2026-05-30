import { NextResponse } from 'next/server';
import {
  authenticateDemoUser,
  createDemoSession,
  DEMO_SESSION_COOKIE,
  encodeDemoSession,
  isMissingDemoSessionSecretError,
  isDemoAuthEnabled,
  sessionMaxAgeSeconds,
} from '@/modules/auth/server/demo-session';

type LoginPayload = {
  username?: unknown;
  password?: unknown;
  scope?: unknown;
};

export async function POST(request: Request) {
  if (!isDemoAuthEnabled()) {
    return NextResponse.json({ code: 503, message: 'Demo auth is disabled' }, { status: 503 });
  }

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

  const user = authenticateDemoUser({ username, password, scope });
  if (!user) {
    return NextResponse.json({ code: 401, message: '用户名或密码错误' }, { status: 401 });
  }

  const session = createDemoSession(user);
  let encodedSession: string;
  try {
    encodedSession = encodeDemoSession(session);
  } catch (error) {
    if (isMissingDemoSessionSecretError(error)) {
      return NextResponse.json({ code: 503, message: 'Demo auth is not configured' }, { status: 503 });
    }
    throw error;
  }

  const response = NextResponse.json({ code: 0, data: { user } });
  response.cookies.set(DEMO_SESSION_COOKIE, encodedSession, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionMaxAgeSeconds(),
    path: '/',
  });

  return response;
}
