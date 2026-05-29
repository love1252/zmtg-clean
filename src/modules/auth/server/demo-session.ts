export const DEMO_SESSION_COOKIE = 'zmtg_demo_session';

export type DemoUserRole = 'tenant_admin' | 'platform_admin';

export type DemoSessionUser = {
  id: string;
  username: string;
  name: string;
  role: DemoUserRole;
  tenantId: string | null;
};

export type DemoSession = {
  user: DemoSessionUser;
  expiresAt: number;
};

type LoginInput = {
  username: string;
  password: string;
  scope?: string;
};

const SESSION_TTL_SECONDS = 60 * 60 * 8;

const demoUsers: Array<DemoSessionUser & { password: string; scope: 'institution' | 'platform' }> = [
  {
    id: 'demo-user-admin',
    username: 'admin',
    password: 'admin123',
    name: '系统管理员',
    role: 'tenant_admin',
    tenantId: 'demo-tenant-001',
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
  };
}

export function createDemoSession(user: DemoSessionUser, now = Date.now()): DemoSession {
  return {
    user,
    expiresAt: now + SESSION_TTL_SECONDS * 1000,
  };
}

export function encodeDemoSession(session: DemoSession) {
  return Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
}

export function decodeDemoSession(value: string | undefined | null, now = Date.now()): DemoSession | null {
  if (!value) return null;

  try {
    const raw = Buffer.from(value, 'base64url').toString('utf8');
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
