import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AuthRole, AuthSession, AuthSessionUser } from '@/modules/auth/domain/session';

export const DEMO_SESSION_COOKIE = 'zmtg_demo_session';

export type DemoUserRole = AuthRole;
export type DemoSessionUser = AuthSessionUser;
export type DemoSession = AuthSession;

type LoginInput = {
  username: string;
  password: string;
  scope?: string;
};

const SESSION_TTL_SECONDS = 60 * 60 * 8;
const DEV_DEMO_SESSION_SECRET = 'zmtg-local-demo-session-secret';
export const MISSING_DEMO_SESSION_SECRET_ERROR =
  'ZMTG_DEMO_SESSION_SECRET is required to sign demo session cookies in production';

const demoUsers: Array<DemoSessionUser & { password: string; scope: 'institution' | 'platform' }> = [
  {
    id: 'demo-user-admin',
    username: 'admin',
    password: 'admin123',
    name: '系统管理员',
    role: 'tenant_admin',
    tenantId: 'demo-tenant-001',
    institutionId: 'demo-inst-a',
    scope: 'institution',
  },
  {
    id: 'demo-user-platform',
    username: 'platform',
    password: 'admin123',
    name: '超级管理员',
    role: 'platform_admin',
    tenantId: null,
    scope: 'platform',
  },
];

export function isDemoAuthEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.ZMTG_ENABLE_DEMO_AUTH === 'true';
}

export function authenticateDemoUser(input: LoginInput): DemoSessionUser | null {
  const requestedScope = input.scope === 'platform' ? 'platform' : 'institution';
  const matched = demoUsers.find(
    (user) =>
      user.username === input.username &&
      user.password === input.password &&
      user.scope === requestedScope,
  );

  if (!matched) return null;

  return {
    id: matched.id,
    username: matched.username,
    name: matched.name,
    role: matched.role,
    tenantId: matched.tenantId,
    institutionId: matched.institutionId ?? null,
  };
}

export function createDemoSession(user: DemoSessionUser, now = Date.now()): DemoSession {
  return {
    user,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };
}

function getDemoSessionSecret(mode: 'encode'): string;
function getDemoSessionSecret(mode: 'decode'): string | null;
function getDemoSessionSecret(mode: 'encode' | 'decode') {
  const configuredSecret = process.env.ZMTG_DEMO_SESSION_SECRET;
  if (configuredSecret && configuredSecret.trim().length > 0) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEV_DEMO_SESSION_SECRET;
  }

  if (mode === 'encode') {
    throw new Error(MISSING_DEMO_SESSION_SECRET_ERROR);
  }

  return null;
}

function signPayload(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function signatureMatches(actualSignature: string, expectedSignature: string) {
  const actual = Buffer.from(actualSignature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function encodeDemoSession(session: DemoSession) {
  const payload = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  const secret = getDemoSessionSecret('encode');
  const signature = signPayload(payload, secret);

  return `${payload}.${signature}`;
}

export function isMissingDemoSessionSecretError(error: unknown) {
  return error instanceof Error && error.message === MISSING_DEMO_SESSION_SECRET_ERROR;
}

export function decodeDemoSession(value: string | undefined | null, now = Date.now()): DemoSession | null {
  if (!value) return null;

  const parts = value.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const secret = getDemoSessionSecret('decode');
  if (!secret) return null;

  const expectedSignature = signPayload(payload, secret);
  if (!signatureMatches(signature, expectedSignature)) return null;

  try {
    const raw = Buffer.from(payload, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as Partial<DemoSession>;
    if (!parsed.user || typeof parsed.expiresAt !== 'number') return null;
    if (parsed.expiresAt <= now) return null;

    return parsed as DemoSession;
  } catch {
    return null;
  }
}

export function readCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;

  return (
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}

export function sessionMaxAgeSeconds() {
  return SESSION_TTL_SECONDS;
}
