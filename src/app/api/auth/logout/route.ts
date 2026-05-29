import { NextResponse } from 'next/server';
import { DEMO_SESSION_COOKIE } from '@/modules/auth/server/demo-session';

export async function POST() {
  const response = NextResponse.json({ code: 0 });
  response.cookies.set(DEMO_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  });

  return response;
}
