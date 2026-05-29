import { NextResponse } from 'next/server';
import {
  decodeDemoSession,
  DEMO_SESSION_COOKIE,
  isDemoAuthEnabled,
  readCookieValue,
} from '@/modules/auth/server/demo-session';

export async function GET(request: Request) {
  if (!isDemoAuthEnabled()) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  const cookie = readCookieValue(request.headers.get('cookie'), DEMO_SESSION_COOKIE);
  const session = decodeDemoSession(cookie);

  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: session.user,
  });
}
