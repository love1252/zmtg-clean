import { NextResponse } from 'next/server';

import { FORMAL_SERVER_SESSION_COOKIE_V1 } from '@/modules/auth/server/formal-server-session-provenance-owner';
import { DEMO_SESSION_COOKIE } from '@/modules/auth/server/demo-session';

function clearCookie(response: NextResponse, name: string): void {
  response.cookies.set(name, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });
}

export async function POST() {
  const response = NextResponse.json({ code: 0 });
  response.headers.set('Cache-Control', 'no-store');
  clearCookie(response, FORMAL_SERVER_SESSION_COOKIE_V1);
  clearCookie(response, DEMO_SESSION_COOKIE);
  return response;
}
