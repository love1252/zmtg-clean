import { NextResponse } from 'next/server';

import {
  consumeFormalServerSessionUserSnapshotV1,
  createAuthAccountRepository,
} from '@/modules/auth/server/auth-account-repository';
import {
  consumeFormalServerSessionVerifiedClaimsV1,
  FORMAL_SERVER_SESSION_COOKIE_V1,
  verifyFormalServerSessionCookieClaimsV1,
} from '@/modules/auth/server/formal-server-session-provenance-owner';
import {
  decodeDemoSession,
  DEMO_SESSION_COOKIE,
  isDemoAuthEnabled,
  readCookieValue,
} from '@/modules/auth/server/demo-session';
import { resolveInstitutionGuardRuntimeConfigV1 } from '@/modules/security/server/institution-guard-runtime-config';
import { getDatabase } from '@/server/db/client';

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

function unauthenticated(clear: readonly string[] = []): NextResponse {
  const response = json({ authenticated: false, user: null }, 401);
  for (const name of clear) clearCookie(response, name);
  return response;
}

function unavailable(): NextResponse {
  return json({ authenticated: false, user: null }, 503);
}

function hasCookieName(cookieHeader: string | null, name: string): boolean {
  if (cookieHeader === null) return false;
  return cookieHeader.split(';').some((part) => {
    const separator = part.indexOf('=');
    const candidate = (separator < 0 ? part : part.slice(0, separator)).trim();
    return candidate === name;
  });
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const hasFormalCookie = hasCookieName(
    cookieHeader,
    FORMAL_SERVER_SESSION_COOKIE_V1,
  );
  const hasDemoCookie = hasCookieName(cookieHeader, DEMO_SESSION_COOKIE);

  if (hasFormalCookie && hasDemoCookie) {
    return unauthenticated([
      FORMAL_SERVER_SESSION_COOKIE_V1,
      DEMO_SESSION_COOKIE,
    ]);
  }

  if (hasFormalCookie) {
    const runtimeConfig = resolveInstitutionGuardRuntimeConfigV1();
    if (runtimeConfig.kind !== 'available') return unavailable();

    const verification = verifyFormalServerSessionCookieClaimsV1({
      cookieHeader,
      sessionKeyRing: runtimeConfig.formalServerSessionKeyRing,
      now: () => new Date(),
    });
    if (verification.kind === 'unavailable') return unavailable();
    if (verification.kind !== 'verified') {
      return unauthenticated([FORMAL_SERVER_SESSION_COOKIE_V1]);
    }

    const claims = consumeFormalServerSessionVerifiedClaimsV1(
      verification.verifiedClaims,
    );
    if (!claims) return unavailable();

    let repository: ReturnType<typeof createAuthAccountRepository>;
    try {
      repository = createAuthAccountRepository(getDatabase());
    } catch {
      return unavailable();
    }

    let snapshot;
    try {
      snapshot = await repository.findCurrentFormalSessionUser(claims);
    } catch {
      return unavailable();
    }
    if (snapshot.kind === 'denied') {
      return unauthenticated([FORMAL_SERVER_SESSION_COOKIE_V1]);
    }
    if (snapshot.kind !== 'resolved') return unavailable();

    const user = consumeFormalServerSessionUserSnapshotV1(snapshot.snapshot);
    if (!user) return unavailable();
    return json({ authenticated: true, user });
  }

  if (!hasDemoCookie || !isDemoAuthEnabled()) return unauthenticated();
  const demoCookie = readCookieValue(cookieHeader, DEMO_SESSION_COOKIE);
  const session = decodeDemoSession(demoCookie);
  if (!session) return unauthenticated([DEMO_SESSION_COOKIE]);
  return json({ authenticated: true, user: session.user });
}
