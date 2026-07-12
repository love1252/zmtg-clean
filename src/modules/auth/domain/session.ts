export const AUTH_ROLES = [
  'tenant_admin',
  'tenant_operator',
  'consultant',
  'customer_service',
  'platform_admin',
  'platform_operator',
  'security_auditor',
] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];

export const AUTH_SESSION_SOURCES = ['demo_session', 'server_session'] as const;

export type AuthSessionSource = (typeof AUTH_SESSION_SOURCES)[number];

export type AuthSessionUser = {
  id: string;
  username: string;
  name: string;
  role: AuthRole;
  tenantId: string | null;
  institutionId?: string | null;
};

export type AuthSession = {
  user: AuthSessionUser;
  expiresAt: number;
  source: AuthSessionSource;
};

export type LegacyAuthSession = Omit<AuthSession, 'source'> & {
  source?: undefined;
};

export type DecodedAuthSession = AuthSession | LegacyAuthSession;

export type AuthSessionPayload = {
  authenticated: boolean;
  user: AuthSessionUser | null;
};

export function isAuthRole(value: unknown): value is AuthRole {
  return typeof value === 'string' && AUTH_ROLES.includes(value as AuthRole);
}

export function isAuthSessionSource(value: unknown): value is AuthSessionSource {
  return (
    typeof value === 'string' && AUTH_SESSION_SOURCES.includes(value as AuthSessionSource)
  );
}
